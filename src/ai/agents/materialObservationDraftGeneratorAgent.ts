import {
  MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION,
  SINGLE_CHOICE_TARGET_SHORTFALL_REASONS,
  type ExistingObservationInventoryItem,
  type ExistingQuestionInventoryItem,
  type MaterialObservationDraftCalibrationAnswer,
  type MaterialObservationDraftGeneratorInput,
  type MaterialObservationDraftGeneratorResult,
  type MaterialObservationPlanningCandidate,
  type RejectedMaterialObservationCandidate,
  type SingleChoiceTargetShortfallReason,
} from '../schemas/materialObservationDraftGenerator.schema.ts';
import {
  OBSERVATION_DIMENSIONS,
  type ObservationCalibrationCaseCategory,
} from '../schemas/materialObservation.schema.ts';
import {
  PRIMARY_ABILITY_IDS,
  QUESTION_RESPONSE_FORMATS,
  QUESTION_RESOURCE_DIFFICULTIES,
  STRUCTURED_QUESTION_TYPES,
  type PrimaryAbilityId,
  type QuestionResourceRubricItem,
  type TextMinimumAnswerRequirement,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  AssessmentMode,
  OpenResponseAnswerStatus,
} from '../schemas/diagnosis.schema.ts';
import {
  DiagnosisProviderError,
  type DiagnosisProviderAdapter,
} from '../providers/diagnosisProviderAdapter.ts';
import {
  buildMaterialObservationDraftPrompt,
  buildMaterialObservationDraftPlanningPrompt,
  buildMaterialObservationDraftRepairPrompt,
  buildMaterialObservationDraftRealizationPrompt,
} from '../prompts/materialObservationDraftPrompt.ts';
import {
  AUTHORING_FIELD_CONTRACT_VERSION,
  validateAuthoringAiOutput,
} from '../contracts/authoringFieldContract.ts';
import {
  isSingleChoiceMinimumResponseRequirement,
  type SingleChoiceInteraction,
} from '../schemas/singleChoiceInteraction.schema.ts';
import {
  evaluateGeneratedSingleChoiceOptions,
  evaluateSingleChoiceTrainingFit,
} from './singleChoiceGenerationPolicy.ts';
import {
  createDefaultTrainingTaskSequencePreference,
  planTrainingTaskSequence,
} from './trainingTaskSequencePlanner.ts';
import {
  isTrainingTaskSequenceReason,
  isTrainingTaskSequenceStrategy,
  type TrainingTaskSequencePlanningPreference,
} from '../schemas/trainingTaskSequencePlanning.schema.ts';
import {
  assessQuestionStemRubricAlignment,
  formatHiddenRubricDimensions,
} from '../patterns/questionStemRubricAlignment.ts';
import {
  projectTargetedMaterialUsage,
  validateTargetedMaterialUsage,
  validateTargetedTrainingResourceMetadata,
} from '../schemas/targetedMicroTraining.schema.ts';
import {
  projectReadingOpenResponseCandidateLoad,
  stableTextResponsePromptFingerprint,
} from './readingOpenResponseLoadPlanningAgent.ts';
import { isTextResponseFormat } from
  '../schemas/readingOpenResponseInputLoad.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  '../schemas/readingTrainingProgressionAudit.schema.ts';
import {
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  isReadingTaskPlanningSeed,
  stableProgressionIdentity,
  type ReadingTaskPlanningSeed,
  type TaskGroupProgressionPlanningResult,
} from '../schemas/readingTaskGroupProgression.schema.ts';
import {
  planReadingTaskGroupProgression,
  planReadingTaskGroupProgressionSeeds,
} from
  './readingTaskGroupProgressionPlanner.ts';

const ASSESSMENT_MODES: AssessmentMode[] = [
  'exact_match',
  'key_points',
  'reasoning_chain',
  'expression_quality',
];
const CALIBRATION_CATEGORIES: ObservationCalibrationCaseCategory[] = [
  'fully_meets',
  'partially_meets',
  'typical_error',
  'reasonable_alternative',
  'concise_valid',
  'irrelevant',
];
const REQUIRED_CALIBRATION_CATEGORIES: ObservationCalibrationCaseCategory[] = [
  'fully_meets',
  'partially_meets',
  'typical_error',
  'reasonable_alternative',
  'irrelevant',
];
const ANSWER_STATUSES: OpenResponseAnswerStatus[] = [
  'fully_meets',
  'partially_meets',
  'does_not_meet',
  'insufficient_evidence',
];
const MATERIAL_ANCHOR_TYPE_ALIASES: Record<string, 'paragraph' | 'paragraph_range' | 'full_text'> = {
  single_paragraph: 'paragraph',
  paragraph_span: 'paragraph_range',
  whole_text: 'full_text',
};
const EVIDENCE_ELIGIBILITY = ['eligible', 'eligible_but_weak', 'ineligible'] as const;
const EVIDENCE_POTENTIAL = ['weak', 'moderate', 'strong'] as const;
const PROHIBITED_CANDIDATE_FIELDS = [
  'status',
  'reviewStatus',
  'formalizationStatus',
  'resourceId',
  'resourceVersionId',
  'planId',
  'materialObservationPlanId',
  'taskRole',
];

export type MaterialObservationDraftGeneratorConfig = {
  providerName: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxAttempts: number;
  /** Live generation uses authoritative Seed -> Plan -> Realization. */
  stage2TwoPassPlanning: boolean;
};

type PendingCandidateRepair = {
  originalPayload: Record<string, unknown>;
  initialResult: MaterialObservationDraftGeneratorResult;
  rejectedCandidates: RejectedMaterialObservationCandidate[];
  issueCounts: Record<string, number>;
};

export function createMaterialObservationDraftGeneratorConfig(input: {
  providerName: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  stage2TwoPassPlanning?: boolean;
}): MaterialObservationDraftGeneratorConfig {
  return {
    providerName: input.providerName,
    model: input.model,
    temperature: input.temperature ?? 0.2,
    maxOutputTokens: input.maxOutputTokens ?? 8_000,
    timeoutMs: input.timeoutMs ?? 30_000,
    maxAttempts: input.maxAttempts ?? 2,
    stage2TwoPassPlanning: input.stage2TwoPassPlanning ?? false,
  };
}

type AuthoritativeProgressionRealization = {
  seeds: ReadingTaskPlanningSeed[];
  progressionPlanning: {
    orderedSeeds: ReadingTaskPlanningSeed[];
    sequencePlanningResult: MaterialObservationDraftGeneratorResult['sequencePlanningResult'];
    planningResult: TaskGroupProgressionPlanningResult;
  };
};

async function generateMaterialObservationDraftCandidatesTwoPass(
  input: MaterialObservationDraftGeneratorInput,
  dependencies: {
    provider: DiagnosisProviderAdapter;
    config: MaterialObservationDraftGeneratorConfig;
  },
): Promise<MaterialObservationDraftGeneratorResult> {
  let totalLatencyMs = 0;
  let tokenUsage: MaterialObservationDraftGeneratorResult['provider']['tokenUsage'];
  try {
    const planningResponse = await dependencies.provider.diagnose({
      requestId: `${input.requestId}:stage2-plan`,
      attempt: 1,
      prompt: buildMaterialObservationDraftPlanningPrompt(input),
      model: dependencies.config.model,
      temperature: dependencies.config.temperature,
      maxOutputTokens: Math.min(dependencies.config.maxOutputTokens, 4_000),
      timeoutMs: dependencies.config.timeoutMs,
    });
    totalLatencyMs += planningResponse.latencyMs;
    tokenUsage = mergeUsage(tokenUsage, planningResponse.tokenUsage);
    const planningPayload = parseProviderOutput(planningResponse.rawOutput);
    if (!planningPayload) {
      return emptyResult(input, dependencies.config, {
        status: 'review_required',
        issues: ['stage2_planning_output_not_valid_json'],
        limitations: ['任务规划输出无法解析；未进入题面生成。'],
        attemptCount: 1,
        latencyMs: totalLatencyMs,
        tokenUsage,
      });
    }
    const seedResult = parseStage2PlanningSeeds(input, planningPayload);
    if (seedResult.issues.length > 0 || seedResult.seeds.length === 0) {
      return emptyResult(input, dependencies.config, {
        status: 'review_required',
        issues: seedResult.issues.length > 0
          ? seedResult.issues : ['stage2_planning_seed_empty'],
        limitations: ['任务 Seed 未通过结构校验；未进入题面生成。'],
        attemptCount: 1,
        latencyMs: totalLatencyMs,
        tokenUsage,
      });
    }
    const providerSequenceDecision = resolveProviderSequencePlanningDecision(
      input,
      planningPayload.sequencePlanningDecision,
      seedResult.seeds.length,
    );
    const progressionPlanning = planReadingTaskGroupProgressionSeeds({
      materialVersionId: input.material.materialVersionId,
      observationPlanRevisionId: input.preferences?.observationPlanRevisionId
        || `draft:${input.requestId}`,
      seeds: seedResult.seeds,
      preference: providerSequenceDecision.preference,
    });
    const authoritative: AuthoritativeProgressionRealization = {
      seeds: seedResult.seeds,
      progressionPlanning,
    };
    const realizationResponse = await dependencies.provider.diagnose({
      requestId: `${input.requestId}:stage2-realization`,
      attempt: 1,
      prompt: buildMaterialObservationDraftRealizationPrompt({
        baseInput: input,
        seeds: progressionPlanning.orderedSeeds,
        progressionPlan: progressionPlanning.planningResult.progressionPlan,
      }),
      model: dependencies.config.model,
      temperature: dependencies.config.temperature,
      maxOutputTokens: dependencies.config.maxOutputTokens,
      timeoutMs: dependencies.config.timeoutMs,
    });
    totalLatencyMs += realizationResponse.latencyMs;
    tokenUsage = mergeUsage(tokenUsage, realizationResponse.tokenUsage);
    const realizationPayload = parseProviderOutput(realizationResponse.rawOutput);
    if (!realizationPayload) {
      return emptyResult(input, dependencies.config, {
        status: 'review_required',
        issues: ['stage2_realization_output_not_valid_json'],
        limitations: ['题面实现输出无法解析；规划结果未写入正式资源。'],
        attemptCount: 2,
        latencyMs: totalLatencyMs,
        tokenUsage,
      });
    }
    return evaluateProviderCandidates(input, realizationPayload, {
      config: dependencies.config,
      attemptCount: 2,
      latencyMs: totalLatencyMs,
      tokenUsage,
      authoritativeProgression: authoritative,
    });
  } catch (error) {
    return emptyResult(input, dependencies.config, {
      status: 'provider_failed',
      issues: [error instanceof DiagnosisProviderError
        ? `provider_${error.category}` : 'provider_failed'],
      limitations: ['阶段 2 两步式生成未完成；未写入正式资源。'],
      attemptCount: 1,
      latencyMs: totalLatencyMs,
      tokenUsage,
    });
  }
}

function parseStage2PlanningSeeds(
  input: MaterialObservationDraftGeneratorInput,
  payload: Record<string, unknown>,
): { seeds: ReadingTaskPlanningSeed[]; issues: string[] } {
  const rawSeeds = Array.isArray(payload.planningSeeds) ? payload.planningSeeds : [];
  const issues: string[] = [];
  const seeds = rawSeeds.flatMap((rawSeed, index): ReadingTaskPlanningSeed[] => {
    if (!isRecord(rawSeed)) {
      issues.push(`stage2_seed_${index}_invalid`);
      return [];
    }
    const seedKey = isNonEmptyString(rawSeed.seedKey)
      ? rawSeed.seedKey.trim() : `seed-${index + 1}`;
    const loadIntent = isRecord(rawSeed.loadIntent) ? rawSeed.loadIntent : {};
    const seed: ReadingTaskPlanningSeed = {
      planningTaskKey: stableProgressionIdentity({
        materialVersionId: input.material.materialVersionId,
        seedKey,
        dimension: rawSeed.observationDimension,
        object: rawSeed.observationObject,
        anchor: rawSeed.materialAnchor,
        abilityId: rawSeed.primaryAbilityId,
      }),
      observationDimension: rawSeed.observationDimension as ReadingTaskPlanningSeed['observationDimension'],
      observationObject: typeof rawSeed.observationObject === 'string'
        ? rawSeed.observationObject.trim() : '',
      materialAnchor: rawSeed.materialAnchor as ReadingTaskPlanningSeed['materialAnchor'],
      primaryAbilityId: rawSeed.primaryAbilityId as ReadingTaskPlanningSeed['primaryAbilityId'],
      taskRole: (rawSeed.taskRole || 'training') as ReadingTaskPlanningSeed['taskRole'],
      responseFormat: rawSeed.responseFormat as ReadingTaskPlanningSeed['responseFormat'],
      loadIntent: {
        primaryAction: loadIntent.primaryAction as ReadingTaskPlanningSeed['loadIntent']['primaryAction'],
        supportingAction: loadIntent.supportingAction as ReadingTaskPlanningSeed['loadIntent']['supportingAction'],
        responsibilities: Array.isArray(loadIntent.responsibilities)
          ? loadIntent.responsibilities as ReadingTaskPlanningSeed['loadIntent']['responsibilities']
          : [],
        textResponseLoadProfile: isRecord(loadIntent.textResponseLoadProfile)
          ? loadIntent.textResponseLoadProfile as ReadingTaskPlanningSeed['loadIntent']['textResponseLoadProfile']
          : undefined,
      },
    };
    if (!isReadingTaskPlanningSeed(seed)) {
      issues.push(`stage2_seed_${index}_contract_invalid`);
      return [];
    }
    return [seed];
  });
  if (new Set(seeds.map((seed) => seed.planningTaskKey)).size !== seeds.length) {
    issues.push('stage2_seed_identity_duplicate');
  }
  return { seeds, issues };
}

export async function generateMaterialObservationDraftCandidates(
  input: MaterialObservationDraftGeneratorInput,
  dependencies: {
    provider: DiagnosisProviderAdapter;
    config: MaterialObservationDraftGeneratorConfig;
  },
): Promise<MaterialObservationDraftGeneratorResult> {
  const inputIssues = validateInput(input);
  if (inputIssues.length > 0) {
    return emptyResult(input, dependencies.config, {
      status: 'insufficient_material_for_observation_planning',
      issues: inputIssues,
      limitations: inputIssues,
    });
  }
  if (dependencies.provider.providerName !== dependencies.config.providerName) {
    return emptyResult(input, dependencies.config, {
      status: 'provider_failed',
      issues: ['provider_config_mismatch'],
      limitations: ['Provider identity does not match the configured generator.'],
    });
  }

  if (dependencies.config.stage2TwoPassPlanning) {
    return generateMaterialObservationDraftCandidatesTwoPass(input, dependencies);
  }

  let prompt = buildMaterialObservationDraftPrompt(input);
  let totalLatencyMs = 0;
  let tokenUsage: MaterialObservationDraftGeneratorResult['provider']['tokenUsage'];
  let lastIssues = ['provider_failed'];
  let pendingRepair: PendingCandidateRepair | undefined;

  for (let attempt = 1; attempt <= dependencies.config.maxAttempts; attempt += 1) {
    try {
      const response = await dependencies.provider.diagnose({
        requestId: input.requestId,
        attempt,
        prompt,
        model: dependencies.config.model,
        temperature: dependencies.config.temperature,
        maxOutputTokens: dependencies.config.maxOutputTokens,
        timeoutMs: dependencies.config.timeoutMs,
      });
      totalLatencyMs += response.latencyMs;
      tokenUsage = mergeUsage(tokenUsage, response.tokenUsage);
      const parsed = parseProviderOutput(response.rawOutput);
      if (!parsed) {
        lastIssues = ['provider_output_not_valid_json'];
        if (attempt < dependencies.config.maxAttempts) continue;
        if (pendingRepair) {
          return finalizeRepairFallback(pendingRepair, {
            attemptCount: attempt,
            latencyMs: totalLatencyMs,
            tokenUsage,
            limitation: 'Candidate repair output was invalid JSON; previously admitted candidates were preserved.',
          });
        }
        return emptyResult(input, dependencies.config, {
          status: 'review_required',
          issues: lastIssues,
          limitations: ['Provider output could not be converted into isolated candidates.'],
          attemptCount: attempt,
          latencyMs: totalLatencyMs,
          tokenUsage,
        });
      }

      const repairedCandidateIndexes = pendingRepair
        ? readRepairedCandidateIndexes(parsed, pendingRepair.rejectedCandidates)
        : new Set<number>();
      const evaluatedPayload = pendingRepair
        ? mergeRepairedCandidates(pendingRepair.originalPayload, parsed, pendingRepair.rejectedCandidates)
        : parsed;
      const result = evaluateProviderCandidates(input, evaluatedPayload, {
        config: dependencies.config,
        attemptCount: attempt,
        latencyMs: totalLatencyMs,
        tokenUsage,
        repairedCandidateIndexes,
        repairIssuesByCandidateIndex: pendingRepair
          ? new Map(pendingRepair.rejectedCandidates.map((candidate) => [
            candidate.candidateIndex,
            candidate.issues,
          ]))
          : new Map(),
      });
      if (pendingRepair) {
        return finalizeRepairResult(result, pendingRepair);
      }

      const rejectedCandidatesForRepair = selectRejectedCandidatesForRepair(result);
      const repairItems = buildRepairItems(parsed, rejectedCandidatesForRepair);
      if (
        repairItems.length > 0 &&
        attempt < dependencies.config.maxAttempts
      ) {
        pendingRepair = {
          originalPayload: parsed,
          initialResult: result,
          rejectedCandidates: rejectedCandidatesForRepair,
          issueCounts: countRejectedIssues(rejectedCandidatesForRepair),
        };
        prompt = buildMaterialObservationDraftRepairPrompt(input, repairItems);
        continue;
      }
      return result;
    } catch (error) {
      const retryable = error instanceof DiagnosisProviderError && error.retryable;
      lastIssues = [error instanceof DiagnosisProviderError ? `provider_${error.category}` : 'provider_failed'];
      if (retryable && attempt < dependencies.config.maxAttempts) continue;
      if (pendingRepair) {
        return finalizeRepairFallback(pendingRepair, {
          attemptCount: attempt,
          latencyMs: totalLatencyMs,
          tokenUsage,
          limitation: 'Candidate repair call failed; previously admitted candidates were preserved.',
        });
      }
      return emptyResult(input, dependencies.config, {
        status: 'provider_failed',
        issues: lastIssues,
        limitations: ['Provider failed before any candidate was admitted.'],
        attemptCount: attempt,
        latencyMs: totalLatencyMs,
        tokenUsage,
      });
    }
  }

  return emptyResult(input, dependencies.config, {
    status: 'provider_failed',
    issues: lastIssues,
    limitations: ['Provider retry budget was exhausted.'],
    attemptCount: dependencies.config.maxAttempts,
    latencyMs: totalLatencyMs,
    tokenUsage,
  });
}

function buildRepairItems(
  payload: Record<string, unknown>,
  rejectedCandidates: RejectedMaterialObservationCandidate[],
) {
  const rawCandidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  return rejectedCandidates.flatMap((rejected) => {
    const candidate = rawCandidates[rejected.candidateIndex];
    if (rejected.candidateIndex >= 6 || !isRecord(candidate)) return [];
    const allowedRubricAbilityIds = getDeclaredCandidateAbilities(candidate);
    return [{
      candidateIndex: rejected.candidateIndex,
      issues: rejected.issues,
      allowedRubricAbilityIds,
      repairInstructions: buildCandidateRepairInstructions(rejected.issues, allowedRubricAbilityIds),
      candidate,
    }];
  });
}

function selectRejectedCandidatesForRepair(
  result: MaterialObservationDraftGeneratorResult,
): RejectedMaterialObservationCandidate[] {
  if (result.status === 'review_required') return result.rejectedCandidates;
  return result.rejectedCandidates.filter((candidate) => {
    if (candidate.disposition === 'unsupported_by_material'
      || candidate.issues.length === 0) return false;
    const responseFormat = candidate.diagnosticContext?.responseFormat;
    if (responseFormat === 'short_text' || responseFormat === 'long_text') {
      return candidate.issues.some((issue) => issue.startsWith('text_response_load.'));
    }
    return result.singleChoicePlanningResult?.status === 'underfilled'
      && responseFormat === 'single_choice'
      && candidate.issues.every(isRepairableSingleChoiceCandidateIssue);
  });
}

function isRepairableSingleChoiceCandidateIssue(issue: string): boolean {
  if (
    issue === 'choice.training_action_requires_text'
    || issue === 'choice.training_action_requires_constructed_response'
    || issue === 'choice.rubric_too_dense'
    || issue === 'choice.high_order_action_not_bounded'
  ) return false;
  return issue.startsWith('choice.')
    || issue === 'answer_acceptance_option_mismatch'
    || issue === 'answer_acceptance_choice_keywords_not_allowed'
    || issue === 'choice_minimum_answer_requirement_invalid';
}

function getDeclaredCandidateAbilities(candidate: Record<string, unknown>): PrimaryAbilityId[] {
  const declared = [
    candidate.primaryAbilityId,
    ...(Array.isArray(candidate.supportingAbilityIds) ? candidate.supportingAbilityIds : []),
  ];
  return [...new Set(declared.filter(
    (abilityId): abilityId is PrimaryAbilityId => (
      typeof abilityId === 'string' &&
      (PRIMARY_ABILITY_IDS as readonly string[]).includes(abilityId)
    ),
  ))];
}

function buildCandidateRepairInstructions(
  issues: string[],
  allowedRubricAbilityIds: PrimaryAbilityId[],
): string[] {
  const instructions: string[] = [];
  if (issues.some((issue) => /^rubric_\d+_ability_undeclared$/.test(issue))) {
    instructions.push(
      `Rubric 的 abilityId 只能使用：${allowedRubricAbilityIds.join(', ') || '当前候选没有合法已声明能力'}。保持 primaryAbilityId 和 supportingAbilityIds 不变，不得新增辅助能力。`,
    );
  }
  if (issues.includes('choice.misconception_duplicate')
    || issues.includes('choice.diagnosis_meaning_duplicate')) {
    instructions.push(
      '逐一重检全部错误选项：每项必须使用互不重复、且与选项语义一致的 misconceptionCode 和 diagnosisMeaning。可从 surface_reading、entity_confusion、evidence_omission、over_inference、causal_reversal、scope_shift、other_explainable_bias 中重新分配；必要时同步重写错误选项内容。保留正确答案身份与所有 optionId，不得只给重复偏差换同义词。',
    );
  }
  if (issues.includes('choice.option_too_thin')) {
    instructions.push(
      '重写残缺选项，使每个选项都成为语法完整、脱离题干后仍可理解的判断陈述；每项至少包含四个有效中文语义字符，并保持正确项与错误项长度大致均衡。保留 optionId 和正确答案身份。',
    );
  }
  if (issues.includes('choice.distractor_evidence_boundary_missing')) {
    instructions.push(
      '为每个错误选项补充可在当前材料中核对的 evidenceBoundary，必须说明应检查的段落、对象或事实范围，不能只写“原文不支持”。',
    );
  }
  if (issues.includes('choice.distractor_diagnosis_too_vague')) {
    instructions.push(
      '逐项改写 diagnosisMeaning，明确学生选择该项体现的是哪一种具体表面理解、对象混淆、证据遗漏、因果倒置、范围偏移或过度推断，不能只写“错误”或“不符合原文”。',
    );
  }
  if (issues.includes('choice.correct_option_length_cue')) {
    instructions.push(
      '在不改变正确答案身份和语义的前提下平衡各选项长度，避免正确项明显更长或更短；错误选项仍必须保持独立、可解释的偏差。',
    );
  }
  if (issues.includes('answer_acceptance_option_mismatch')) {
    instructions.push(
      'answerAcceptanceDraft.acceptedOptionIds 必须且只能等于 choiceInteraction.correctOptionIds；以正确答案身份为准，不得反向改变正确答案来迁就接受范围。',
    );
  }
  if (issues.some((issue) => issue.startsWith('rubric_requirement_not_in_stem:'))) {
    instructions.push(
      '逐项核对 questionStem 与 rubricDraft。优先删除题干未要求的 Rubric；只有该维度属于原 Observation 的核心训练意图时，才同步改写题干明确要求。短段落只保留一个主要认知动作和一至两个相互依赖的核心评分项。',
    );
  }
  if (issues.some((issue) => issue === 'text_response_load.composite_core_actions'
    || issue === 'text_response_load.three_or_more_independent_actions')) {
    instructions.push(
      '开放文本题只保留一个主要认知动作和最多一个紧密依赖的支撑动作。删除可独立评分的概括、人物、主题、结构或表达等多余目标，并同步精简题干、Rubric、答案接受条件与作答要求。',
    );
  }
  if (issues.includes('text_response_load.hidden_rubric_requirement')) {
    instructions.push(
      '删除题干没有要求的 Required Rubric；只有原 Observation Focus 明确要求的核心维度才能保留，并须在题干中用学生可理解的动作明确表达。',
    );
  }
  if (issues.includes('text_response_load.evidence_scope_insufficient')
    || issues.includes('text_response_load.evidence_requirement_excessive')) {
    instructions.push(
      '保持回答对象不变，把证据数量和范围收窄到当前 Material Anchor 实际支持的内容；不得凭空扩大到全文或增加不存在的证据。',
    );
  }
  if (issues.includes('text_response_load.response_format_load_mismatch')) {
    instructions.push(
      '按实际训练动作调整 short_text / long_text；局部单一动作优先 short_text，多证据综合关系才使用 long_text。不得改变主要能力和回答对象。',
    );
  }
  if (issues.includes('text_response_load.minimum_length_overweighted')
    || issues.includes('text_response_load.minimum_length_under_supports_rubric')) {
    instructions.push(
      'minimumAnswerRequirement 只表达内容有效性的最低边界，不得复制内部推荐长度区间。同步保证题干、Rubric 与最短完整答案相容。',
    );
  }
  return instructions;
}

function mergeRepairedCandidates(
  originalPayload: Record<string, unknown>,
  repairPayload: Record<string, unknown>,
  rejectedCandidates: RejectedMaterialObservationCandidate[],
): Record<string, unknown> {
  const originalCandidates = Array.isArray(originalPayload.candidates)
    ? [...originalPayload.candidates]
    : [];
  const rejectedByIndex = new Map(rejectedCandidates.map((item) => [
    item.candidateIndex,
    item,
  ]));
  const rejectedIndexes = new Set(rejectedByIndex.keys());
  const repairedCandidates = Array.isArray(repairPayload.candidates) ? repairPayload.candidates : [];

  repairedCandidates.forEach((candidate) => {
    if (!isRecord(candidate)) return;
    const repairIndex = readRepairCandidateIndex(candidate.repairOfCandidateIndex);
    if (repairIndex === undefined || !rejectedIndexes.has(repairIndex)) return;
    const original = originalCandidates[repairIndex];
    const replacement = { ...candidate };
    delete replacement.repairOfCandidateIndex;
    if (!isRecord(original) || !preservesRepairLockedIdentity(
      original,
      replacement,
      rejectedByIndex.get(repairIndex)?.issues || [],
    )) return;
    originalCandidates[repairIndex] = replacement;
  });

  const originalLimitations = Array.isArray(originalPayload.materialLimitations)
    ? originalPayload.materialLimitations
    : [];
  const repairLimitations = Array.isArray(repairPayload.materialLimitations)
    ? repairPayload.materialLimitations
    : [];
  return {
    ...originalPayload,
    candidates: originalCandidates,
    materialLimitations: [...originalLimitations, ...repairLimitations],
  };
}

function preservesRepairLockedIdentity(
  original: Record<string, unknown>,
  replacement: Record<string, unknown>,
  issues: string[],
): boolean {
  if (original.primaryAbilityId !== replacement.primaryAbilityId) return false;
  if (original.observationDimension !== replacement.observationDimension) return false;
  if (stableSerializeForRepair(original.observationFocus)
    !== stableSerializeForRepair(replacement.observationFocus)) return false;
  const materialAnchorMayBeCorrected = issues.some((issue) => (
    issue === 'material_anchor_missing'
    || issue === 'material_anchor_type_invalid'
    || issue === 'material_anchor_out_of_range'
  ));
  if (!materialAnchorMayBeCorrected
    && stableSerializeForRepair(original.materialAnchor)
      !== stableSerializeForRepair(replacement.materialAnchor)) return false;
  const responseFormatMayChange = issues.includes(
    'text_response_load.response_format_load_mismatch',
  );
  if (!responseFormatMayChange) {
    const originalDraft = isRecord(original.questionDraft) ? original.questionDraft : {};
    const replacementDraft = isRecord(replacement.questionDraft) ? replacement.questionDraft : {};
    if (originalDraft.responseFormat !== replacementDraft.responseFormat) return false;
  }
  return true;
}

function stableSerializeForRepair(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerializeForRepair).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stableSerializeForRepair(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) || 'null';
}

function materialAnchorsEqual(
  left: ReadingTaskPlanningSeed['materialAnchor'],
  right: ReadingTaskPlanningSeed['materialAnchor'],
): boolean {
  if (left.anchorType !== right.anchorType) return false;
  if (left.anchorType === 'full_text') return true;
  if (left.startParagraph !== right.startParagraph) return false;
  if (left.anchorType === 'paragraph') return true;
  return left.endParagraph === right.endParagraph;
}

function readRepairCandidateIndex(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function readRepairedCandidateIndexes(
  repairPayload: Record<string, unknown>,
  rejectedCandidates: RejectedMaterialObservationCandidate[],
): Set<number> {
  const allowed = new Set(rejectedCandidates.map((candidate) => candidate.candidateIndex));
  const repaired = Array.isArray(repairPayload.candidates) ? repairPayload.candidates : [];
  return new Set(repaired.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const index = readRepairCandidateIndex(candidate.repairOfCandidateIndex);
    return index !== undefined && allowed.has(index) ? [index] : [];
  }));
}

function countRejectedIssues(
  rejectedCandidates: RejectedMaterialObservationCandidate[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  rejectedCandidates.forEach((candidate) => {
    candidate.issues.forEach((issue) => {
      const issueFamily = issue.split(':')[0];
      counts[issueFamily] = (counts[issueFamily] || 0) + 1;
    });
  });
  return counts;
}

function finalizeRepairResult(
  result: MaterialObservationDraftGeneratorResult,
  pendingRepair: PendingCandidateRepair,
): MaterialObservationDraftGeneratorResult {
  const unresolvedIndexes = new Set(result.rejectedCandidates.map((item) => item.candidateIndex));
  const recoveredCandidateCount = pendingRepair.rejectedCandidates
    .filter((item) => !unresolvedIndexes.has(item.candidateIndex))
    .length;
  const unresolvedCandidateCount = pendingRepair.rejectedCandidates.length - recoveredCandidateCount;
  return {
    ...result,
    provider: {
      ...result.provider,
      repair: {
        attempted: true,
        requestedCandidateCount: pendingRepair.rejectedCandidates.length,
        recoveredCandidateCount,
        unresolvedCandidateCount,
        issueCounts: pendingRepair.issueCounts,
      },
    },
    limitations: unique([
      ...result.limitations,
      `Candidate-level repair recovered ${recoveredCandidateCount} of ${pendingRepair.rejectedCandidates.length} structurally rejected candidate(s).`,
    ]),
  };
}

function finalizeRepairFallback(
  pendingRepair: PendingCandidateRepair,
  runtime: {
    attemptCount: number;
    latencyMs: number;
    tokenUsage?: MaterialObservationDraftGeneratorResult['provider']['tokenUsage'];
    limitation: string;
  },
): MaterialObservationDraftGeneratorResult {
  return {
    ...pendingRepair.initialResult,
    provider: {
      ...pendingRepair.initialResult.provider,
      attemptCount: runtime.attemptCount,
      latencyMs: runtime.latencyMs,
      tokenUsage: runtime.tokenUsage,
      repair: {
        attempted: true,
        requestedCandidateCount: pendingRepair.rejectedCandidates.length,
        recoveredCandidateCount: 0,
        unresolvedCandidateCount: pendingRepair.rejectedCandidates.length,
        issueCounts: pendingRepair.issueCounts,
      },
    },
    limitations: unique([
      ...pendingRepair.initialResult.limitations,
      runtime.limitation,
    ]),
  };
}

function evaluateProviderCandidates(
  input: MaterialObservationDraftGeneratorInput,
  payload: Record<string, unknown>,
  runtime: {
    config: MaterialObservationDraftGeneratorConfig;
    attemptCount: number;
    latencyMs: number;
    tokenUsage?: MaterialObservationDraftGeneratorResult['provider']['tokenUsage'];
    repairedCandidateIndexes?: Set<number>;
    repairIssuesByCandidateIndex?: Map<number, string[]>;
    authoritativeProgression?: AuthoritativeProgressionRealization;
  },
): MaterialObservationDraftGeneratorResult {
  const rawCandidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const rejectedCandidates: RejectedMaterialObservationCandidate[] = [];
  const candidates: MaterialObservationPlanningCandidate[] = [];
  const materialParagraphs = splitParagraphs(input.material.content);

  rawCandidates.forEach((rawCandidate, candidateIndex) => {
    if (candidateIndex >= 6) {
      rejectedCandidates.push({
        candidateIndex,
        issues: ['candidate_count_above_6'],
        diagnosticContext: buildRejectionDiagnosticContext(rawCandidate, materialParagraphs.length),
      });
      return;
    }
    const authoritativeTask = runtime.authoritativeProgression
      ?.progressionPlanning.planningResult.progressionPlan.orderedTasks[candidateIndex];
    const authoritativeSeed = authoritativeTask
      ? runtime.authoritativeProgression?.progressionPlanning.orderedSeeds[candidateIndex]
      : undefined;
    const authoritativeSemantics = authoritativeTask
      ? runtime.authoritativeProgression?.progressionPlanning.planningResult.plannedTasks.find(
          (item) => item.planningTaskKey === authoritativeTask.planningTaskKey,
        )
      : undefined;
    if (runtime.authoritativeProgression && (!isRecord(rawCandidate)
      || !authoritativeTask
      || !authoritativeSeed
      || rawCandidate.planningTaskKey !== authoritativeTask.planningTaskKey
      || rawCandidate.taskLoadSemanticsHash !== authoritativeTask.taskLoadSemanticsHash
      || rawCandidate.taskGroupProgressionPlanHash
        !== runtime.authoritativeProgression.progressionPlanning.planningResult.progressionPlan.planHash
      || rawCandidate.sequenceRank !== candidateIndex + 1)) {
      rejectedCandidates.push({
        candidateIndex,
        issues: ['stage2_realization_receipt_mismatch'],
        diagnosticContext: buildRejectionDiagnosticContext(rawCandidate, materialParagraphs.length),
      });
      return;
    }
    const parsed = parseCandidate(
      rawCandidate,
      candidateIndex,
      input,
      materialParagraphs,
      runtime.repairedCandidateIndexes?.has(candidateIndex)
        ? {
            attemptCount: 1,
            issueCodes: runtime.repairIssuesByCandidateIndex?.get(candidateIndex) || [],
          }
        : undefined,
    );
    const allowedTargetAbilities = input.material.usageType === 'targeted_excerpt'
      ? input.material.targetedExcerptMetadata?.targetAbilityIds || []
      : [];
    if (parsed.candidate && authoritativeSeed && (
      parsed.candidate.primaryAbilityId !== authoritativeSeed.primaryAbilityId
      || parsed.candidate.observationDimension !== authoritativeSeed.observationDimension
      || parsed.candidate.questionDraft.responseFormat !== authoritativeSeed.responseFormat
      || !materialAnchorsEqual(
        parsed.candidate.materialAnchor,
        authoritativeSeed.materialAnchor,
      )
    )) {
      rejectedCandidates.push({
        candidateIndex,
        issues: ['stage2_realization_seed_drift'],
        diagnosticContext: buildRejectionDiagnosticContext(rawCandidate, materialParagraphs.length),
      });
    } else if (
      parsed.candidate
      && allowedTargetAbilities.length > 0
      && !allowedTargetAbilities.includes(parsed.candidate.primaryAbilityId)
    ) {
      rejectedCandidates.push({
        candidateIndex,
        issues: ['targeted_primary_ability_out_of_scope'],
        diagnosticContext: buildRejectionDiagnosticContext(rawCandidate, materialParagraphs.length),
      });
    } else if (parsed.candidate) candidates.push(authoritativeTask && authoritativeSemantics
      ? {
          ...parsed.candidate,
          planningTaskKey: authoritativeTask.planningTaskKey,
          taskGroupProgressionPlanHash:
            runtime.authoritativeProgression!.progressionPlanning.planningResult.progressionPlan.planHash,
          taskLoadSemantics: authoritativeSemantics.taskLoadSemantics,
        }
      : parsed.candidate);
    else rejectedCandidates.push({
      candidateIndex,
      issues: parsed.issues,
      disposition: parsed.issues.some(isUnsupportedByMaterialIssue)
        ? 'unsupported_by_material'
        : undefined,
      diagnosticContext: buildRejectionDiagnosticContext(rawCandidate, materialParagraphs.length),
    });
  });

  const existingObservations = input.existingInventory?.observations || [];
  const existingQuestions = input.existingInventory?.questions || [];
  const duplicatePairs: string[] = [];
  const newObservationCandidates: MaterialObservationPlanningCandidate[] = [];
  const withheldCandidates: MaterialObservationPlanningCandidate[] = [];

  for (const candidate of candidates) {
    const inventoryRelation = classifyAgainstInventory(candidate, existingObservations, existingQuestions);
    if (inventoryRelation.disposition !== 'new_observation_candidate') {
      const classified = { ...candidate, inventoryRelation };
      withheldCandidates.push(classified);
      if (inventoryRelation.disposition === 'likely_duplicate') {
        duplicatePairs.push(`${candidate.candidateId}:${inventoryRelation.matchedQuestionId || inventoryRelation.matchedObservationId || 'existing'}`);
      }
      continue;
    }

    const sameBatchMatch = newObservationCandidates.find((item) => areObservationCandidatesDuplicates(item, candidate));
    if (sameBatchMatch) {
      withheldCandidates.push({
        ...candidate,
        inventoryRelation: {
          disposition: 'likely_duplicate',
          matchedObservationId: sameBatchMatch.candidateId,
          reason: '与本批次另一候选观察同一认知动作，不能作为新增覆盖。',
        },
      });
      duplicatePairs.push(`${sameBatchMatch.candidateId}:${candidate.candidateId}`);
      continue;
    }

    newObservationCandidates.push({
      ...candidate,
      inventoryRelation,
    });
  }

  const materialLimitations = Array.isArray(payload.materialLimitations)
    ? payload.materialLimitations.filter(isNonEmptyString).map((item) => item.trim()).slice(0, 8)
    : [];
  const batchIssues: string[] = [];
  const planningIntent = input.preferences?.planningIntent;
  const isTargetedExcerpt = input.material.usageType === 'targeted_excerpt';
  const minimumCandidateCount = isTargetedExcerpt
    ? planningIntent === 'supplement' ? 0 : 1
    : planningIntent === 'supplement' ? 0 : planningIntent ? 2 : 3;
  const maximumCandidateCount = isTargetedExcerpt
    ? input.material.targetedExcerptMetadata?.intendedTaskCount || 1
    : planningIntent === 'supplement' ? 2 : planningIntent ? 3 : 6;
  if (rawCandidates.length < minimumCandidateCount || rawCandidates.length > maximumCandidateCount) {
    batchIssues.push(planningIntent ? 'candidate_count_outside_planning_range' : 'candidate_count_must_be_3_to_6');
  }
  const minimumIndependentCandidateCount = isTargetedExcerpt
    ? minimumCandidateCount
    : planningIntent ? 2 : 3;
  if (existingObservations.length === 0 && newObservationCandidates.length < minimumIndependentCandidateCount) {
    batchIssues.push(isTargetedExcerpt
      ? 'fewer_than_1_valid_targeted_candidate'
      : planningIntent ? 'fewer_than_2_valid_independent_candidates' : 'fewer_than_3_valid_independent_candidates');
  }
  if (existingObservations.length > 0 && newObservationCandidates.length === 0) {
    batchIssues.push('no_new_observation_candidate');
  }
  const providerSequenceDecision = resolveProviderSequencePlanningDecision(
    input,
    payload.sequencePlanningDecision,
    newObservationCandidates.length,
  );
  const derivedProgressionPlanning = runtime.authoritativeProgression
    ? undefined
    : planReadingTaskGroupProgression({
        materialVersionId: input.material.materialVersionId,
        observationPlanRevisionId: input.preferences?.observationPlanRevisionId
          || `draft:${input.requestId}`,
        candidates: newObservationCandidates,
        preference: providerSequenceDecision.preference,
      });
  const progressionPlanning = runtime.authoritativeProgression?.progressionPlanning;
  const orderedObservationCandidates = progressionPlanning
    ? progressionPlanning.planningResult.progressionPlan.orderedTasks.flatMap((task) => {
        const candidate = newObservationCandidates.find(
          (item) => item.planningTaskKey === task.planningTaskKey,
        );
        return candidate ? [candidate] : [];
      })
    : derivedProgressionPlanning!.orderedCandidates;
  if (runtime.authoritativeProgression
    && orderedObservationCandidates.length
      !== progressionPlanning!.planningResult.progressionPlan.orderedTasks.length) {
    batchIssues.push('stage2_realization_candidate_count_mismatch');
  }
  const singleChoiceCandidateCount = orderedObservationCandidates.filter(
    (candidate) => candidate.questionDraft.responseFormat === 'single_choice',
  ).length;
  const singleChoicePlanningResult = resolveSingleChoicePlanningResult({
    input,
    generatedCount: singleChoiceCandidateCount,
    withheldCandidates,
    rejectedCandidates,
    materialLimitations,
  });
  const status = batchIssues.length === 0 ? 'candidates_ready' : 'review_required';
  const authoringContractLimitations = orderedObservationCandidates.flatMap((candidate, candidateIndex) => {
    const validation = validateAuthoringAiOutput({
      authoringContractVersion: AUTHORING_FIELD_CONTRACT_VERSION,
      abilityId: candidate.primaryAbilityId,
      specificTrainingPoint: candidate.observationFocus.displayName,
      questionStem: candidate.questionStem,
      studentTask: candidate.expectedStudentAction,
      observationTarget: candidate.observationFocus.definition,
    });
    return [
      ...validation.errors.map((error) => (
        `候选题目 ${candidateIndex + 1} 未满足字段契约：${error}`
      )),
      ...validation.warnings.map((issue) => (
        `候选题目 ${candidateIndex + 1} 字段职责需要人工确认：${issue.message}。${issue.suggestion}`
      )),
    ];
  });
  const limitations = unique([
    ...materialLimitations,
    ...(providerSequenceDecision.limitation ? [providerSequenceDecision.limitation] : []),
    ...authoringContractLimitations,
    ...(rejectedCandidates.length ? [`${rejectedCandidates.length} candidate(s) were rejected before import.`] : []),
    ...(withheldCandidates.length ? [`${withheldCandidates.length} candidate(s) matched existing or same-batch observations and were withheld from import.`] : []),
    'Candidates are AI-assisted drafts and require human educational review.',
    'Evidence potential is not actual Evidence quality.',
    input.generationMode === 'optimize_existing_observation'
      ? 'Candidates optimize one existing observation and remain non-formal until adoption.'
      : 'Only new observation candidates are importable in discover_new_observation mode.',
  ]);

  return {
    requestId: input.requestId,
    status,
    candidates: orderedObservationCandidates,
    withheldCandidates,
    rejectedCandidates,
    singleChoicePlanningResult,
    sequencePlanningResult: progressionPlanning?.sequencePlanningResult
      || derivedProgressionPlanning!.sequencePlanningResult,
    progressionStageRuleVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
    taskGroupProgressionPlan: progressionPlanning?.planningResult.progressionPlan
      || derivedProgressionPlanning!.planningResult.progressionPlan,
    coveragePreview: {
      surfaceCandidateCount: rawCandidates.length,
      independentObservationCount: orderedObservationCandidates.length,
      newObservationCount: orderedObservationCandidates.length,
      alternateQuestionCount: withheldCandidates.filter((item) => item.inventoryRelation.disposition === 'alternate_question_for_existing_observation').length,
      likelyDuplicateCount: withheldCandidates.filter((item) => item.inventoryRelation.disposition === 'likely_duplicate').length,
      unsupportedByMaterialCount: rejectedCandidates.filter((item) => item.disposition === 'unsupported_by_material').length,
      existingObservationCount: existingObservations.length,
      existingQuestionCount: existingQuestions.length,
      primaryAbilityIds: unique(orderedObservationCandidates.map((item) => item.primaryAbilityId)),
      observationDimensions: unique(orderedObservationCandidates.map((item) => item.observationDimension)),
      possibleDuplicatePairs: duplicatePairs,
    },
    validation: {
      passed: status === 'candidates_ready',
      issues: batchIssues,
      failureIssueCounts: countRejectedIssues(rejectedCandidates),
    },
    provider: {
      providerName: runtime.config.providerName,
      model: runtime.config.model,
      attemptCount: runtime.attemptCount,
      latencyMs: runtime.latencyMs,
      tokenUsage: runtime.tokenUsage,
    },
    limitations,
    trainingModelPolicyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    version: MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION,
  };
}

function resolveSequencePlanningPreference(
  input: MaterialObservationDraftGeneratorInput,
  generatedCandidateCount: number,
) {
  if (input.preferences?.sequencePlanning) return input.preferences.sequencePlanning;
  const preference = createDefaultTrainingTaskSequencePreference(generatedCandidateCount);
  const requestedChoiceCount = input.preferences?.singleChoiceCandidateTarget || 0;
  return requestedChoiceCount > 0
    ? {
        ...preference,
        preferredPreludeChoiceCount: Math.min(2, requestedChoiceCount),
      }
    : preference;
}

function resolveProviderSequencePlanningDecision(
  input: MaterialObservationDraftGeneratorInput,
  value: unknown,
  generatedCandidateCount: number,
): {
  preference: TrainingTaskSequencePlanningPreference;
  limitation?: string;
} {
  const inputPreference = resolveSequencePlanningPreference(input, generatedCandidateCount);
  if (inputPreference.strategy !== 'entry_first' || value === undefined) {
    return { preference: inputPreference };
  }
  if (!isRecord(value)) {
    return {
      preference: inputPreference,
      limitation: 'sequence_planning_decision_invalid:fallback_to_entry_first',
    };
  }
  const strategy = value.strategy;
  const reason = value.reason;
  const preferredPreludeChoiceCount = value.preferredPreludeChoiceCount;
  const validCount = Number.isInteger(preferredPreludeChoiceCount) &&
    Number(preferredPreludeChoiceCount) >= 0 &&
    Number(preferredPreludeChoiceCount) <= 2;
  if (
    strategy === 'entry_first' &&
    reason === 'default_foundation_entry' &&
    validCount
  ) {
    return {
      preference: {
        strategy,
        reason,
        preferredPreludeChoiceCount: Number(preferredPreludeChoiceCount),
      },
    };
  }
  if (
    strategy === 'holistic_first' &&
    ['holistic_judgment_required', 'independent_expression_baseline'].includes(String(reason)) &&
    validCount
  ) {
    return {
      preference: {
        strategy,
        reason: reason as 'holistic_judgment_required' | 'independent_expression_baseline',
        preferredPreludeChoiceCount: Number(preferredPreludeChoiceCount),
      },
    };
  }
  return {
    preference: inputPreference,
    limitation: 'sequence_planning_decision_invalid:fallback_to_entry_first',
  };
}

function resolveSingleChoicePlanningResult({
  input,
  generatedCount,
  withheldCandidates,
  rejectedCandidates,
  materialLimitations,
}: {
  input: MaterialObservationDraftGeneratorInput;
  generatedCount: number;
  withheldCandidates: MaterialObservationPlanningCandidate[];
  rejectedCandidates: RejectedMaterialObservationCandidate[];
  materialLimitations: string[];
}): NonNullable<MaterialObservationDraftGeneratorResult['singleChoicePlanningResult']> {
  const planning = input.preferences?.singleChoicePlanning;
  const requestedSupplementCount = input.preferences?.singleChoiceCandidateTarget || 0;
  const currentCount = planning?.currentSingleChoiceCount || 0;
  const targetCount = planning?.targetSingleChoiceCount
    ?? (currentCount + requestedSupplementCount);
  const projectedTotalCount = currentCount + generatedCount;
  const shortfallCount = Math.max(0, targetCount - projectedTotalCount);

  if (targetCount === 0) {
    return {
      status: 'not_applicable',
      targetCount,
      actualCount: projectedTotalCount,
      currentCount,
      requestedSupplementCount,
      generatedCount,
      projectedTotalCount,
      shortfallCount: 0,
      reasons: [],
    };
  }
  if (shortfallCount === 0) {
    return {
      status: 'met',
      targetCount,
      actualCount: projectedTotalCount,
      currentCount,
      requestedSupplementCount,
      generatedCount,
      projectedTotalCount,
      shortfallCount,
      reasons: [],
    };
  }

  const reasons = new Set<SingleChoiceTargetShortfallReason>();
  for (const limitation of materialLimitations) {
    if (!limitation.startsWith('single_choice_target_unfilled:')) continue;
    for (const reason of SINGLE_CHOICE_TARGET_SHORTFALL_REASONS) {
      if (limitation.includes(reason)) reasons.add(reason);
    }
  }

  const targetGapBeforeGeneration = Math.max(0, targetCount - currentCount);
  if (requestedSupplementCount < targetGapBeforeGeneration) {
    if ((planning?.availableTaskCapacity ?? requestedSupplementCount) < targetGapBeforeGeneration) {
      reasons.add('insufficient_task_capacity');
    } else {
      reasons.add('insufficient_supplement_scope');
    }
  }
  if (withheldCandidates.some((candidate) => (
    candidate.questionDraft.responseFormat === 'single_choice'
  ))) {
    reasons.add('duplicate_with_existing_task');
  }
  if (rejectedCandidates.some((candidate) => (
    candidate.diagnosticContext?.responseFormat === 'single_choice'
      || candidate.issues.some((issue) => (
        issue.startsWith('choice.')
          || issue.includes('single_choice')
          || issue.includes('answer_acceptance_option')
      ))
  ))) {
    reasons.add('distractor_quality_insufficient');
  }
  if (reasons.size === 0) {
    reasons.add('no_independent_observation');
  }

  return {
    status: 'underfilled',
    targetCount,
    actualCount: projectedTotalCount,
    currentCount,
    requestedSupplementCount,
    generatedCount,
    projectedTotalCount,
    shortfallCount,
    reasons: [...reasons],
  };
}

function parseCandidate(
  value: unknown,
  candidateIndex: number,
  input: MaterialObservationDraftGeneratorInput,
  materialParagraphs: string[],
  repairContext?: { attemptCount: 1; issueCodes: string[] },
): { candidate?: MaterialObservationPlanningCandidate; issues: string[] } {
  const issues: string[] = [];
  const paragraphCount = materialParagraphs.length;
  if (!isRecord(value)) return { issues: ['candidate_not_object'] };
  const prohibited = PROHIBITED_CANDIDATE_FIELDS.filter((field) => field in value);
  if (prohibited.length) issues.push(`prohibited_formal_fields:${prohibited.join(',')}`);

  const questionStem = readString(value.questionStem, 'question_stem_missing', issues);
  const questionDraft = readQuestionDraft(value.questionDraft, issues);
  const primaryAbilityId = readEnum(value.primaryAbilityId, PRIMARY_ABILITY_IDS, 'primary_ability_invalid', issues);
  const observationDimension = readEnum(value.observationDimension, OBSERVATION_DIMENSIONS, 'observation_dimension_invalid', issues);
  const difficultySuggestion = readEnum(value.difficultySuggestion, QUESTION_RESOURCE_DIFFICULTIES, 'difficulty_invalid', issues);
  const assessmentMode = readEnum(value.assessmentMode, ASSESSMENT_MODES, 'assessment_mode_invalid', issues);
  const expectedStudentAction = readString(value.expectedStudentAction, 'expected_student_action_missing', issues);
  const designRationale = readString(value.designRationale, 'design_rationale_missing', issues);
  const observationFocus = readFocus(value.observationFocus, issues);
  const materialAnchor = readAnchor(value.materialAnchor, paragraphCount, issues);
  const supportingAbilityIds = readEnumArray(value.supportingAbilityIds, PRIMARY_ABILITY_IDS, 'supporting_ability_invalid', issues);
  if (primaryAbilityId && supportingAbilityIds.includes(primaryAbilityId)) issues.push('supporting_ability_duplicates_primary');
  const rubricDraft = readRubric(value.rubricDraft, primaryAbilityId, supportingAbilityIds, issues);
  const choiceInteraction = readChoiceInteraction(
    value.choiceInteraction,
    questionDraft?.responseFormat,
    issues,
  );
  const declaredCorrectOptionId = readSingleChoiceCorrectOptionId(
    value.choiceInteraction,
    questionDraft?.responseFormat,
  );
  const answerAcceptanceDraft = readAnswerAcceptance(
    value.answerAcceptanceDraft,
    questionDraft?.responseFormat,
    declaredCorrectOptionId,
    issues,
  );
  const minimumAnswerRequirement = readMinimumAnswerRequirement(
    value.minimumAnswerRequirement,
    questionDraft?.responseFormat,
    issues,
  );
  const calibrationAnswers = readCalibrationAnswers(value.calibrationAnswers, rubricDraft.map((item) => item.name), issues);
  const evidencePotential = readEnum(value.evidencePotential, EVIDENCE_POTENTIAL, 'evidence_potential_invalid', issues);
  const evidenceBoundary = readEvidenceBoundary(value.evidenceBoundary, issues);
  const safetyBoundary = readSafetyBoundary(value.safetyBoundary, issues);

  if (questionStem && rubricDraft.length > 0) {
    const isSingleChoice = questionDraft?.responseFormat === 'single_choice';
    const alignment = assessQuestionStemRubricAlignment(
      questionStem,
      rubricDraft.map((item, index) => ({
        itemId: `draft-rubric-${index + 1}`,
        name: item.name,
        description: item.description,
        abilityId: item.abilityId,
        importance: 'critical' as const,
        required: true,
        evidenceRequirement: {
          // A single-choice response demonstrates the bounded judgment through
          // the selected option. It must not inherit open-response requirements
          // to quote evidence, explain reasoning, or write a conclusion.
          requireTextEvidence: !isSingleChoice,
          requireExplanation: !isSingleChoice && item.abilityId !== 'extraction',
          requireConclusion: !isSingleChoice && item.abilityId !== 'extraction',
        },
        acceptedSignals: item.acceptedSignals,
      })),
    );
    if (!alignment.aligned) {
      issues.push(
        `rubric_requirement_not_in_stem:${formatHiddenRubricDimensions(alignment.hiddenDimensions)}`,
      );
    }
  }

  if (questionDraft?.responseFormat === 'single_choice' && primaryAbilityId
    && observationDimension && questionStem && expectedStudentAction) {
    const fit = evaluateSingleChoiceTrainingFit({
      primaryAbilityId,
      observationDimension,
      questionStem,
      expectedStudentAction,
      requiredRubricCount: rubricDraft.length,
    });
    issues.push(...fit.issues.map((issue) => issue.code));
  }

  if (issues.length > 0 || !questionStem || !primaryAbilityId || !observationDimension || !difficultySuggestion ||
    !assessmentMode || !expectedStudentAction || !designRationale || !observationFocus || !materialAnchor ||
    !evidencePotential || !evidenceBoundary || !safetyBoundary || !answerAcceptanceDraft ||
    !questionDraft || !minimumAnswerRequirement) {
    return { issues: unique(issues) };
  }

  const candidateId = `observation-candidate-${stableHash(`${input.material.materialVersionId}|${questionStem}|${candidateIndex}`)}`;
  const textResponseLoadProjection = isTextResponseFormat(questionDraft.responseFormat)
    ? projectReadingOpenResponseCandidateLoad({
        planningInput: {
          sourceIdentity: {
            materialVersionId: input.material.materialVersionId,
            trainingTaskId: input.preferences?.targetObservationId,
            taskRole: 'training',
          },
          questionIdentity: candidateId,
          materialTitle: input.material.title,
          questionStem,
          responseObject: observationFocus.displayName,
          responseFormat: questionDraft.responseFormat,
          rubric: toLoadRubric(rubricDraft, minimumAnswerRequirement),
          minimumAnswerRequirement: minimumAnswerRequirement as TextMinimumAnswerRequirement,
          abilityMetadata: {
            abilityId: primaryAbilityId,
            supportingAbilityIds,
            difficulty: difficultySuggestion,
          },
          expectedStudentAction,
          sourceAnchorIds: materialAnchorIds(materialAnchor, paragraphCount),
          sourceEvidenceCharacterCount: materialAnchorCharacterCount(
            materialAnchor,
            materialParagraphs,
          ),
          sequenceContext: resolveLoadSequenceContext(input, candidateIndex),
        },
        promptInputFingerprint: stableTextResponsePromptFingerprint({
          requestId: input.requestId,
          materialVersionId: input.material.materialVersionId,
          generationMode: input.generationMode || 'discover_new_observation',
          preferences: input.preferences || {},
          candidateIndex,
        }),
        repairAttemptCount: repairContext?.attemptCount || 0,
        repairIssueCodes: repairContext?.issueCodes || [],
      })
    : undefined;
  if (textResponseLoadProjection?.blockingIssueCodes.length) {
    return { issues: unique(textResponseLoadProjection.blockingIssueCodes) };
  }
  if (
    textResponseLoadProjection
    && textResponseLoadProjection.planningResult.status !== 'planned'
  ) {
    return {
      issues: textResponseLoadProjection.planningResult.status === 'requires_task_refocus'
        ? textResponseLoadProjection.planningResult.reasonCodes.map(
            (code) => `text_response_load.${code}`,
          )
        : ['text_response_load.not_applicable'],
    };
  }

  return {
    candidate: {
      candidateId,
      questionStem,
      questionDraft,
      choiceInteraction,
      primaryAbilityId,
      supportingAbilityIds,
      observationDimension,
      observationFocus,
      materialAnchor,
      expectedStudentAction,
      designRationale,
      difficultySuggestion,
      assessmentMode,
      rubricDraft,
      answerAcceptanceDraft,
      minimumAnswerRequirement,
      calibrationAnswers,
      evidencePotential,
      evidenceBoundary,
      safetyBoundary,
      ...(textResponseLoadProjection?.trace
        && textResponseLoadProjection.planningResult.status === 'planned'
        ? {
            textResponseLoadPlanning: {
              intent: textResponseLoadProjection.planningResult.intent,
              trace: textResponseLoadProjection.trace,
            },
          }
        : {}),
      inventoryRelation: {
        disposition: 'new_observation_candidate',
        reason: '尚未与已有 Observation Inventory 建立同质匹配。',
      },
    },
    issues: [],
  };
}

function toLoadRubric(
  rubricDraft: MaterialObservationPlanningCandidate['rubricDraft'],
  minimumAnswerRequirement: TextMinimumAnswerRequirement,
): QuestionResourceRubricItem[] {
  return rubricDraft.map((item, index) => ({
    itemId: `generated-load-rubric-${index + 1}`,
    name: item.name,
    description: item.description,
    abilityId: item.abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: minimumAnswerRequirement.requireTextEvidence,
      requireExplanation: minimumAnswerRequirement.requireExplanation,
      requireConclusion: minimumAnswerRequirement.requireExplanation,
    },
    acceptedSignals: item.acceptedSignals,
  }));
}

function materialAnchorIds(
  anchor: MaterialObservationPlanningCandidate['materialAnchor'],
  paragraphCount: number,
): string[] {
  if (anchor.anchorType === 'full_text') {
    return Array.from({ length: paragraphCount }, (_, index) => `paragraph-${index + 1}`);
  }
  const start = Math.max(1, anchor.startParagraph || 1);
  const end = Math.min(paragraphCount, anchor.endParagraph || start);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => (
    `paragraph-${start + index}`
  ));
}

function materialAnchorCharacterCount(
  anchor: MaterialObservationPlanningCandidate['materialAnchor'],
  paragraphs: string[],
): number {
  if (anchor.anchorType === 'full_text') {
    return paragraphs.reduce((sum, paragraph) => sum + Array.from(paragraph).length, 0);
  }
  const startIndex = Math.max(0, (anchor.startParagraph || 1) - 1);
  const endIndex = Math.min(paragraphs.length - 1, (anchor.endParagraph || anchor.startParagraph || 1) - 1);
  return paragraphs.slice(startIndex, endIndex + 1)
    .reduce((sum, paragraph) => sum + Array.from(paragraph).length, 0);
}

function resolveLoadSequenceContext(
  input: MaterialObservationDraftGeneratorInput,
  candidateIndex: number,
) {
  const sequence = input.preferences?.sequencePlanning;
  if (sequence?.strategy === 'holistic_first') {
    return {
      position: candidateIndex,
      singleChoiceFoundationSatisfied: false,
      sequencePreference: 'holistic_judgment_first' as const,
      exceptionReason: sequence.reason === 'independent_expression_baseline'
        ? 'text_expression_required' as const
        : 'holistic_judgment_required' as const,
    };
  }
  if (sequence?.strategy === 'role_driven') {
    return {
      position: candidateIndex,
      singleChoiceFoundationSatisfied: false,
      sequencePreference: 'role_driven' as const,
      exceptionReason: sequence.reason === 'transfer_in_new_context'
        ? 'transfer_role' as const
        : 'retest_role' as const,
    };
  }
  const preferredPreludeChoiceCount = sequence?.preferredPreludeChoiceCount
    ?? input.preferences?.singleChoiceCandidateTarget
    ?? 0;
  return {
    position: candidateIndex,
    singleChoiceFoundationSatisfied: candidateIndex >= preferredPreludeChoiceCount,
    sequencePreference: 'foundation_first' as const,
  };
}

function buildRejectionDiagnosticContext(
  value: unknown,
  materialParagraphCount: number,
): NonNullable<RejectedMaterialObservationCandidate['diagnosticContext']> {
  if (!isRecord(value)) return { materialParagraphCount };
  const questionDraft = isRecord(value.questionDraft) ? value.questionDraft : undefined;
  const materialAnchor = isRecord(value.materialAnchor) ? value.materialAnchor : undefined;
  return {
    questionType: readDiagnosticString(questionDraft?.questionType),
    responseFormat: readDiagnosticString(questionDraft?.responseFormat),
    materialAnchor: materialAnchor
      ? {
        anchorType: readDiagnosticString(materialAnchor.anchorType),
        startParagraph: readDiagnosticNumber(materialAnchor.startParagraph),
        endParagraph: readDiagnosticNumber(materialAnchor.endParagraph),
      }
      : undefined,
    materialParagraphCount,
  };
}

function readDiagnosticString(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 80) : undefined;
}

function readDiagnosticNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readQuestionDraft(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push('question_draft_missing');
    return undefined;
  }
  const questionType = readEnum(value.questionType, STRUCTURED_QUESTION_TYPES, 'question_type_invalid', issues);
  const responseFormat = readEnum(value.responseFormat, QUESTION_RESPONSE_FORMATS, 'response_format_invalid', issues);
  return questionType && responseFormat ? { questionType, responseFormat } : undefined;
}

function readFocus(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push('observation_focus_missing');
    return undefined;
  }
  const displayName = readString(value.displayName, 'observation_focus_name_missing', issues);
  const definition = readString(value.definition, 'observation_focus_definition_missing', issues);
  return displayName && definition ? { displayName, definition } : undefined;
}

function readAnchor(value: unknown, paragraphCount: number, issues: string[]) {
  if (!isRecord(value)) {
    issues.push('material_anchor_missing');
    return undefined;
  }
  const rawAnchorType = typeof value.anchorType === 'string' ? value.anchorType : value.anchorType;
  const normalizedAnchorType = typeof rawAnchorType === 'string'
    ? MATERIAL_ANCHOR_TYPE_ALIASES[rawAnchorType] || rawAnchorType
    : rawAnchorType;
  const anchorType = readEnum(normalizedAnchorType, ['paragraph', 'paragraph_range', 'full_text'] as const, 'material_anchor_type_invalid', issues);
  if (!anchorType) return undefined;
  if (anchorType === 'full_text') return { anchorType };
  const startParagraph = readPositiveInteger(value.startParagraph);
  const endParagraph = anchorType === 'paragraph_range'
    ? readPositiveInteger(value.endParagraph)
    : startParagraph;
  if (!startParagraph || !endParagraph || startParagraph > endParagraph || endParagraph > paragraphCount) {
    issues.push('material_anchor_out_of_range');
    return undefined;
  }
  return { anchorType, startParagraph, endParagraph };
}

function readRubric(
  value: unknown,
  primaryAbilityId: PrimaryAbilityId | undefined,
  supportingAbilityIds: PrimaryAbilityId[],
  issues: string[],
) {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push('rubric_missing');
    return [];
  }
  const declaredAbilities = new Set([primaryAbilityId, ...supportingAbilityIds]);
  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      issues.push(`rubric_${index}_invalid`);
      return [];
    }
    const name = readString(item.name, `rubric_${index}_name_missing`, issues);
    const description = readString(item.description, `rubric_${index}_description_missing`, issues);
    const abilityId = readEnum(item.abilityId, PRIMARY_ABILITY_IDS, `rubric_${index}_ability_invalid`, issues);
    const acceptedSignals = readStringArray(item.acceptedSignals);
    if (abilityId && !declaredAbilities.has(abilityId)) issues.push(`rubric_${index}_ability_undeclared`);
    if (acceptedSignals.length === 0) issues.push(`rubric_${index}_accepted_signals_missing`);
    return name && description && abilityId
      ? [{ name, description, abilityId, acceptedSignals }]
      : [];
  });
}

function readChoiceInteraction(
  value: unknown,
  responseFormat: string | undefined,
  issues: string[],
): SingleChoiceInteraction | undefined {
  if (responseFormat !== 'single_choice') {
    if (value !== undefined && value !== null) issues.push('choice_interaction_unused');
    return undefined;
  }
  const evaluation = evaluateGeneratedSingleChoiceOptions(
    isRecord(value) ? value as SingleChoiceInteraction : undefined,
  );
  issues.push(...evaluation.issues.map((issue) => issue.code));
  return evaluation.passed ? value as SingleChoiceInteraction : undefined;
}

function readAnswerAcceptance(
  value: unknown,
  responseFormat: string | undefined,
  declaredCorrectOptionId: string | undefined,
  issues: string[],
) {
  if (!isRecord(value)) {
    issues.push('answer_acceptance_missing');
    return undefined;
  }
  if (responseFormat === 'single_choice') {
    const acceptedOptionIds = readStringArray(value.acceptedOptionIds);
    if (acceptedOptionIds.length !== 1
      || (declaredCorrectOptionId !== undefined
        && acceptedOptionIds[0] !== declaredCorrectOptionId)) {
      issues.push('answer_acceptance_option_mismatch');
    }
    if (readStringArray(value.acceptedKeywords).length > 0) {
      issues.push('answer_acceptance_choice_keywords_not_allowed');
    }
    return {
      acceptedKeywords: [],
      semanticEquivalentAllowed: false,
      acceptedOptionIds,
    };
  }
  const acceptedKeywords = readStringArray(value.acceptedKeywords);
  if (acceptedKeywords.length === 0) issues.push('answer_acceptance_keywords_missing');
  if (value.semanticEquivalentAllowed !== true) issues.push('semantic_equivalent_must_be_allowed');
  return {
    acceptedKeywords,
    semanticEquivalentAllowed: value.semanticEquivalentAllowed === true,
  };
}

function readSingleChoiceCorrectOptionId(
  value: unknown,
  responseFormat: string | undefined,
): string | undefined {
  if (responseFormat !== 'single_choice' || !isRecord(value)) return undefined;
  const correctOptionIds = readStringArray(value.correctOptionIds);
  return correctOptionIds.length === 1 ? correctOptionIds[0] : undefined;
}

function readMinimumAnswerRequirement(
  value: unknown,
  responseFormat: string | undefined,
  issues: string[],
) {
  if (!isRecord(value)) {
    issues.push('minimum_answer_requirement_missing');
    return undefined;
  }
  if (responseFormat === 'single_choice') {
    if (!isSingleChoiceMinimumResponseRequirement(value)) {
      issues.push('choice_minimum_answer_requirement_invalid');
      return undefined;
    }
    return value;
  }
  const minLength = readPositiveInteger(value.minLength);
  if (!minLength || minLength > 500) issues.push('minimum_answer_length_invalid');
  if (typeof value.requireTextEvidence !== 'boolean' || typeof value.requireExplanation !== 'boolean') {
    issues.push('minimum_answer_flags_invalid');
  }
  return minLength && minLength <= 500 &&
    typeof value.requireTextEvidence === 'boolean' &&
    typeof value.requireExplanation === 'boolean'
    ? {
      minLength,
      requireTextEvidence: value.requireTextEvidence,
      requireExplanation: value.requireExplanation,
    }
    : undefined;
}

function readCalibrationAnswers(
  value: unknown,
  rubricNames: string[],
  issues: string[],
): MaterialObservationDraftCalibrationAnswer[] {
  if (!Array.isArray(value)) {
    issues.push('calibration_answers_missing');
    return [];
  }
  const answers = value.flatMap((item, index) => {
    if (!isRecord(item)) {
      issues.push(`calibration_${index}_invalid`);
      return [];
    }
    const category = readEnum(item.category, CALIBRATION_CATEGORIES, `calibration_${index}_category_invalid`, issues);
    const answerText = readString(item.answerText, `calibration_${index}_answer_missing`, issues);
    const expectedAnswerStatus = readEnum(item.expectedAnswerStatus, ANSWER_STATUSES, `calibration_${index}_status_invalid`, issues);
    const expectedDiagnosisBoundary = readString(item.expectedDiagnosisBoundary, `calibration_${index}_diagnosis_boundary_missing`, issues);
    const expectedEvidenceEligibility = readEnum(item.expectedEvidenceEligibility, EVIDENCE_ELIGIBILITY, `calibration_${index}_eligibility_invalid`, issues);
    const expectedRubricCoverage = Array.isArray(item.expectedRubricCoverage)
      ? item.expectedRubricCoverage.flatMap((coverage, coverageIndex) => {
        if (!isRecord(coverage)) {
          issues.push(`calibration_${index}_coverage_${coverageIndex}_invalid`);
          return [];
        }
        const rubricName = readString(coverage.rubricName, `calibration_${index}_coverage_name_missing`, issues);
        const status = readEnum(coverage.status, ['completed', 'partial', 'missing'] as const, `calibration_${index}_coverage_status_invalid`, issues);
        if (rubricName && !rubricNames.includes(rubricName)) issues.push(`calibration_${index}_coverage_rubric_unknown`);
        return rubricName && status ? [{ rubricName, status }] : [];
      })
      : [];
    if (expectedRubricCoverage.length === 0) issues.push(`calibration_${index}_coverage_missing`);
    return category && answerText && expectedAnswerStatus && expectedDiagnosisBoundary && expectedEvidenceEligibility
      ? [{
        category,
        answerText,
        expectedAnswerStatus,
        expectedRubricCoverage,
        expectedDiagnosisBoundary,
        expectedEvidenceEligibility,
      }]
      : [];
  });
  const categories = new Set(answers.map((item) => item.category));
  REQUIRED_CALIBRATION_CATEGORIES.forEach((category) => {
    if (!categories.has(category)) issues.push(`calibration_category_missing:${category}`);
  });
  return answers;
}

function readEvidenceBoundary(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push('evidence_boundary_missing');
    return undefined;
  }
  const canObserve = readString(value.canObserve, 'evidence_boundary_can_observe_missing', issues);
  const cannotConclude = readString(value.cannotConclude, 'evidence_boundary_cannot_conclude_missing', issues);
  if (cannotConclude && !/(不能|不得|不代表|不可)/.test(cannotConclude)) {
    issues.push('evidence_boundary_cannot_conclude_not_explicit');
  }
  return canObserve && cannotConclude ? { canObserve, cannotConclude } : undefined;
}

function readSafetyBoundary(value: unknown, issues: string[]) {
  if (!isRecord(value) || value.taskRole !== 'training_candidate' || value.requiresHumanReview !== true) {
    issues.push('safety_boundary_invalid');
    return undefined;
  }
  return { taskRole: 'training_candidate' as const, requiresHumanReview: true as const };
}

function areObservationCandidatesDuplicates(
  left: MaterialObservationPlanningCandidate,
  right: MaterialObservationPlanningCandidate,
): boolean {
  if (
    left.primaryAbilityId !== right.primaryAbilityId ||
    left.observationDimension !== right.observationDimension
  ) return false;
  const leftText = `${left.observationFocus.displayName}${left.observationFocus.definition}${left.expectedStudentAction}`;
  const rightText = `${right.observationFocus.displayName}${right.observationFocus.definition}${right.expectedStudentAction}`;
  return bigramSimilarity(leftText, rightText) >= 0.72;
}

function classifyAgainstInventory(
  candidate: MaterialObservationPlanningCandidate,
  observations: ExistingObservationInventoryItem[],
  questions: ExistingQuestionInventoryItem[],
): MaterialObservationPlanningCandidate['inventoryRelation'] {
  const exactQuestionMatch = questions.find(
    (item) => normalize(item.questionStem) === normalize(candidate.questionStem),
  );
  if (exactQuestionMatch) {
    return {
      disposition: 'likely_duplicate',
      matchedObservationId: exactQuestionMatch.observationId,
      matchedQuestionId: exactQuestionMatch.questionId,
      reason: '题干与同材料已有题目完全相同；改变能力、训练方向或作答形式不能形成新增任务。',
    };
  }

  const matchedObservation = observations
    .filter((item) => (
      item.primaryAbilityId === candidate.primaryAbilityId &&
      item.observationDimension === candidate.observationDimension
    ))
    .map((item) => ({
      item,
      similarity: observationInventorySimilarity(candidate, item),
    }))
    .sort((left, right) => right.similarity - left.similarity)[0];

  const matchedQuestion = questions
    .filter((item) => (
      item.primaryAbilityId === candidate.primaryAbilityId &&
      item.observationDimension === candidate.observationDimension &&
      (!matchedObservation || !item.observationId || item.observationId === matchedObservation.item.observationId)
    ))
    .map((item) => ({
      item,
      similarity: bigramSimilarity(candidate.questionStem, item.questionStem),
    }))
    .sort((left, right) => right.similarity - left.similarity)[0];

  if (matchedQuestion && matchedQuestion.similarity >= 0.64) {
    return {
      disposition: 'likely_duplicate',
      matchedObservationId: matchedObservation?.item.observationId,
      matchedQuestionId: matchedQuestion.item.questionId,
      reason: '题目入口与已有题目高度相似，不能作为新增 Observation 或新增题量导入。',
    };
  }

  if (matchedObservation && matchedObservation.similarity >= 0.58) {
    return {
      disposition: 'alternate_question_for_existing_observation',
      matchedObservationId: matchedObservation.item.observationId,
      matchedQuestionId: matchedQuestion?.item.questionId,
      reason: '认知动作与已有 Observation 相同，但题目入口不同；当前发现模式不导入替代题。',
    };
  }

  return {
    disposition: 'new_observation_candidate',
    reason: '未与已有 Observation Inventory 形成足够强的同质匹配。',
  };
}

function observationInventorySimilarity(
  candidate: MaterialObservationPlanningCandidate,
  existing: ExistingObservationInventoryItem,
): number {
  const candidateFocus = `${candidate.observationFocus.displayName}${candidate.observationFocus.definition}`;
  const existingFocus = `${existing.focusDisplayName}${existing.focusDefinition}`;
  const focusSimilarity = bigramSimilarity(candidateFocus, existingFocus);
  const actionSimilarity = bigramSimilarity(candidate.expectedStudentAction, existing.expectedStudentAction);
  return Math.max(focusSimilarity, (focusSimilarity * 0.65) + (actionSimilarity * 0.35));
}

function isUnsupportedByMaterialIssue(issue: string): boolean {
  return issue === 'material_anchor_missing'
    || issue === 'material_anchor_type_invalid'
    || issue === 'material_anchor_out_of_range';
}

function bigramSimilarity(left: string, right: string): number {
  const leftSet = ngrams(normalize(left), 2);
  const rightSet = ngrams(normalize(right), 2);
  if (leftSet.size === 0 || rightSet.size === 0) return normalize(left) === normalize(right) ? 1 : 0;
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

function ngrams(value: string, size: number): Set<string> {
  const values = new Set<string>();
  for (let index = 0; index <= value.length - size; index += 1) values.add(value.slice(index, index + size));
  return values;
}

function validateInput(input: MaterialObservationDraftGeneratorInput): string[] {
  const issues: string[] = [];
  if (!input.requestId?.trim()) issues.push('request_id_missing');
  if (!input.material?.materialVersionId?.trim()) issues.push('material_version_id_missing');
  if (!input.material?.title?.trim()) issues.push('material_title_missing');
  const content = input.material?.content?.trim() || '';
  if (content.length < 20) issues.push('material_content_too_short');
  if (splitParagraphs(content).length === 0) issues.push('material_has_no_paragraph');
  const materialUsage = projectTargetedMaterialUsage(input.material);
  if (materialUsage.usageType === 'targeted_excerpt') {
    const materialValidation = validateTargetedMaterialUsage(input.material);
    issues.push(...materialValidation.issues.map((item) => item.code));
    const targetedPlanning = input.preferences?.targetedTrainingPlanning;
    const targetedValidation = validateTargetedTrainingResourceMetadata(
      targetedPlanning,
      input.material.materialVersionId,
    );
    issues.push(...targetedValidation.issues.map((item) => item.code));
    if (
      targetedPlanning
      && !materialUsage.targetedExcerptMetadata?.supportedGapReasonCodes.includes(
        targetedPlanning.primaryGapReasonCode,
      )
    ) issues.push('targeted_primary_gap_out_of_scope');
    if (
      (input.preferences?.candidateCount || 0)
        > (materialUsage.targetedExcerptMetadata?.intendedTaskCount || 0)
    ) issues.push('targeted_candidate_count_exceeds_intended_count');
  } else if (input.preferences?.targetedTrainingPlanning !== undefined) {
    issues.push('core_material_has_targeted_training_planning');
  }
  const requestedCount = input.preferences?.candidateCount;
  const planningIntent = input.preferences?.planningIntent;
  const minimumCandidateCount = planningIntent ? 1 : 3;
  const maximumCandidateCount = planningIntent === 'supplement' ? 2 : planningIntent ? 3 : 6;
  if (requestedCount !== undefined && (!Number.isInteger(requestedCount) || requestedCount < minimumCandidateCount || requestedCount > maximumCandidateCount)) {
    issues.push('candidate_count_preference_invalid');
  }
  if (input.preferences?.planningIntent && !['initial', 'replacement', 'supplement'].includes(input.preferences.planningIntent)) {
    issues.push('planning_intent_invalid');
  }
  if (input.preferences?.preferredAbilityIds?.some((ability) => !PRIMARY_ABILITY_IDS.includes(ability))) {
    issues.push('preferred_ability_invalid');
  }
  const singleChoiceCandidateTarget = input.preferences?.singleChoiceCandidateTarget;
  if (singleChoiceCandidateTarget !== undefined && (
    !Number.isInteger(singleChoiceCandidateTarget)
    || singleChoiceCandidateTarget < 0
    || singleChoiceCandidateTarget > (requestedCount || maximumCandidateCount)
  )) {
    issues.push('single_choice_candidate_target_invalid');
  }
  const singleChoicePlanning = input.preferences?.singleChoicePlanning;
  if (singleChoicePlanning) {
    const planningValues = [
      singleChoicePlanning.currentEffectiveTaskCount,
      singleChoicePlanning.currentSingleChoiceCount,
      singleChoicePlanning.intendedSupplementTaskCount,
      singleChoicePlanning.targetEffectiveTaskCount,
      singleChoicePlanning.defaultSingleChoiceTarget,
      singleChoicePlanning.maximumSingleChoiceCount,
      singleChoicePlanning.targetSingleChoiceCount,
      singleChoicePlanning.availableTaskCapacity,
      singleChoicePlanning.requestedSupplementSingleChoiceCount,
    ];
    const planningContextInvalid = planningValues.some(
      (value) => !Number.isInteger(value) || value < 0,
    )
      || singleChoicePlanning.currentEffectiveTaskCount > 6
      || singleChoicePlanning.currentSingleChoiceCount
        > singleChoicePlanning.currentEffectiveTaskCount
      || singleChoicePlanning.targetEffectiveTaskCount
        < singleChoicePlanning.currentEffectiveTaskCount
      || singleChoicePlanning.targetEffectiveTaskCount > 6
      || singleChoicePlanning.maximumSingleChoiceCount > 3
      || singleChoicePlanning.defaultSingleChoiceTarget
        > singleChoicePlanning.maximumSingleChoiceCount
      || singleChoicePlanning.targetSingleChoiceCount
        > singleChoicePlanning.maximumSingleChoiceCount
      || singleChoicePlanning.requestedSupplementSingleChoiceCount
        > singleChoicePlanning.intendedSupplementTaskCount
      || singleChoicePlanning.requestedSupplementSingleChoiceCount
        > singleChoicePlanning.availableTaskCapacity
      || singleChoicePlanning.requestedSupplementSingleChoiceCount
        !== (singleChoiceCandidateTarget || 0);
    if (planningContextInvalid) {
      issues.push('single_choice_planning_context_invalid');
    }
  }
  const sequencePlanning = input.preferences?.sequencePlanning;
  if (sequencePlanning) {
    const reasonMatchesStrategy = (
      sequencePlanning.strategy === 'entry_first' &&
        ['default_foundation_entry', 'no_qualified_single_choice'].includes(sequencePlanning.reason)
    ) || (
      sequencePlanning.strategy === 'holistic_first' &&
        ['holistic_judgment_required', 'independent_expression_baseline'].includes(sequencePlanning.reason)
    ) || (
      sequencePlanning.strategy === 'role_driven' &&
        ['retest_after_training', 'transfer_in_new_context'].includes(sequencePlanning.reason)
    );
    if (
      !isTrainingTaskSequenceStrategy(sequencePlanning.strategy) ||
      !isTrainingTaskSequenceReason(sequencePlanning.reason) ||
      !Number.isInteger(sequencePlanning.preferredPreludeChoiceCount) ||
      sequencePlanning.preferredPreludeChoiceCount < 0 ||
      sequencePlanning.preferredPreludeChoiceCount > 2 ||
      !reasonMatchesStrategy
    ) {
      issues.push('sequence_planning_context_invalid');
    }
  }
  if ((input.preferences?.requestedFocus?.length || 0) > 160) {
    issues.push('requested_focus_too_long');
  }
  if (input.generationMode && ![
    'discover_new_observation',
    'optimize_existing_observation',
  ].includes(input.generationMode)) {
    issues.push('generation_mode_invalid');
  }
  if (input.generationMode === 'optimize_existing_observation'
    && !input.preferences?.targetObservationId?.trim()) {
    issues.push('target_observation_id_missing');
  }
  const targetQuestionContext = input.preferences?.targetQuestionContext;
  if (targetQuestionContext && (
    !targetQuestionContext.questionStem?.trim()
    || !targetQuestionContext.expectedStudentAction?.trim()
    || !targetQuestionContext.observationFocus?.displayName?.trim()
    || !targetQuestionContext.observationFocus?.definition?.trim()
    || !Array.isArray(targetQuestionContext.hiddenRequiredDimensions)
    || !Array.isArray(targetQuestionContext.rubric)
    || targetQuestionContext.rubric.some((item) => (
      !item?.name?.trim() || !item?.description?.trim()
    ))
  )) {
    issues.push('target_question_context_invalid');
  }
  if (input.existingInventory) {
    if ((input.existingInventory.observations?.length || 0) > 40) issues.push('existing_observation_inventory_too_large');
    if ((input.existingInventory.questions?.length || 0) > 60) issues.push('existing_question_inventory_too_large');
    if (!Array.isArray(input.existingInventory.observations) || input.existingInventory.observations.some((item) => (
      !item.observationId?.trim() ||
      !PRIMARY_ABILITY_IDS.includes(item.primaryAbilityId) ||
      !OBSERVATION_DIMENSIONS.includes(item.observationDimension)
    ))) issues.push('existing_observation_inventory_invalid');
    if (!Array.isArray(input.existingInventory.questions) || input.existingInventory.questions.some((item) => (
      !item.questionId?.trim() ||
      !item.questionStem?.trim() ||
      !PRIMARY_ABILITY_IDS.includes(item.primaryAbilityId) ||
      !OBSERVATION_DIMENSIONS.includes(item.observationDimension)
    ))) issues.push('existing_question_inventory_invalid');
  }
  return issues;
}

function emptyResult(
  input: MaterialObservationDraftGeneratorInput,
  config: MaterialObservationDraftGeneratorConfig,
  details: {
    status: MaterialObservationDraftGeneratorResult['status'];
    issues: string[];
    limitations: string[];
    attemptCount?: number;
    latencyMs?: number;
    tokenUsage?: MaterialObservationDraftGeneratorResult['provider']['tokenUsage'];
  },
): MaterialObservationDraftGeneratorResult {
  const sequencePlan = planTrainingTaskSequence({
    tasks: [],
    preference: resolveSequencePlanningPreference(input, 0),
  });
  return {
    requestId: input.requestId,
    status: details.status,
    candidates: [],
    withheldCandidates: [],
    rejectedCandidates: [],
    sequencePlanningResult: sequencePlan.result,
    coveragePreview: {
      surfaceCandidateCount: 0,
      independentObservationCount: 0,
      newObservationCount: 0,
      alternateQuestionCount: 0,
      likelyDuplicateCount: 0,
      unsupportedByMaterialCount: 0,
      existingObservationCount: input.existingInventory?.observations.length || 0,
      existingQuestionCount: input.existingInventory?.questions.length || 0,
      primaryAbilityIds: [],
      observationDimensions: [],
      possibleDuplicatePairs: [],
    },
    validation: {
      passed: false,
      issues: details.issues,
      failureIssueCounts: details.issues.reduce<Record<string, number>>((counts, issue) => {
        counts[issue] = (counts[issue] || 0) + 1;
        return counts;
      }, {}),
    },
    provider: {
      providerName: config.providerName,
      model: config.model,
      attemptCount: details.attemptCount ?? 0,
      latencyMs: details.latencyMs ?? 0,
      tokenUsage: details.tokenUsage,
    },
    limitations: details.limitations,
    trainingModelPolicyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    version: MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION,
  };
}

function parseProviderOutput(rawOutput: string): Record<string, unknown> | null {
  const trimmed = rawOutput.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readString(value: unknown, issue: string, issues: string[]): string | undefined {
  if (!isNonEmptyString(value)) {
    issues.push(issue);
    return undefined;
  }
  return value.trim();
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? unique(value.filter(isNonEmptyString).map((item) => item.trim())) : [];
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  issue: string,
  issues: string[],
): T | undefined {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issues.push(issue);
    return undefined;
  }
  return value as T;
}

function readEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  issue: string,
  issues: string[],
): T[] {
  if (!Array.isArray(value)) {
    issues.push(issue);
    return [];
  }
  const invalid = value.some((item) => typeof item !== 'string' || !allowed.includes(item as T));
  if (invalid) issues.push(issue);
  return unique(value.filter((item): item is T => typeof item === 'string' && allowed.includes(item as T)));
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function splitParagraphs(content: string): string[] {
  return content.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s，。；：、“”‘’！？,.!?;:'"()[\]{}<>《》·—-]/g, '');
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function mergeUsage(
  current: MaterialObservationDraftGeneratorResult['provider']['tokenUsage'],
  next: MaterialObservationDraftGeneratorResult['provider']['tokenUsage'],
) {
  if (!current && !next) return undefined;
  return {
    inputTokens: (current?.inputTokens || 0) + (next?.inputTokens || 0),
    outputTokens: (current?.outputTokens || 0) + (next?.outputTokens || 0),
    totalTokens: (current?.totalTokens || 0) + (next?.totalTokens || 0),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
