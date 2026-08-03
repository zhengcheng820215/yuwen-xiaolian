import {
  MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION,
  type ExistingObservationInventoryItem,
  type ExistingQuestionInventoryItem,
  type MaterialObservationDraftCalibrationAnswer,
  type MaterialObservationDraftGeneratorInput,
  type MaterialObservationDraftGeneratorResult,
  type MaterialObservationPlanningCandidate,
  type RejectedMaterialObservationCandidate,
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
  buildMaterialObservationDraftRepairPrompt,
} from '../prompts/materialObservationDraftPrompt.ts';
import {
  AUTHORING_FIELD_CONTRACT_VERSION,
  validateAuthoringAiOutput,
} from '../contracts/authoringFieldContract.ts';

const ASSESSMENT_MODES: AssessmentMode[] = [
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
}): MaterialObservationDraftGeneratorConfig {
  return {
    providerName: input.providerName,
    model: input.model,
    temperature: input.temperature ?? 0.2,
    maxOutputTokens: input.maxOutputTokens ?? 8_000,
    timeoutMs: input.timeoutMs ?? 30_000,
    maxAttempts: input.maxAttempts ?? 2,
  };
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

      const evaluatedPayload = pendingRepair
        ? mergeRepairedCandidates(pendingRepair.originalPayload, parsed, pendingRepair.rejectedCandidates)
        : parsed;
      const result = evaluateProviderCandidates(input, evaluatedPayload, {
        config: dependencies.config,
        attemptCount: attempt,
        latencyMs: totalLatencyMs,
        tokenUsage,
      });
      if (pendingRepair) {
        return finalizeRepairResult(result, pendingRepair);
      }

      const repairItems = buildRepairItems(parsed, result.rejectedCandidates);
      if (
        result.status === 'review_required' &&
        repairItems.length > 0 &&
        attempt < dependencies.config.maxAttempts
      ) {
        pendingRepair = {
          originalPayload: parsed,
          initialResult: result,
          rejectedCandidates: result.rejectedCandidates,
          issueCounts: countRejectedIssues(result.rejectedCandidates),
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
  const rejectedIndexes = new Set(rejectedCandidates.map((item) => item.candidateIndex));
  const repairedCandidates = Array.isArray(repairPayload.candidates) ? repairPayload.candidates : [];

  repairedCandidates.forEach((candidate) => {
    if (!isRecord(candidate)) return;
    const repairIndex = readRepairCandidateIndex(candidate.repairOfCandidateIndex);
    if (repairIndex === undefined || !rejectedIndexes.has(repairIndex)) return;
    const replacement = { ...candidate };
    delete replacement.repairOfCandidateIndex;
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

function readRepairCandidateIndex(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
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
    const parsed = parseCandidate(rawCandidate, candidateIndex, input, materialParagraphs.length);
    if (parsed.candidate) candidates.push(parsed.candidate);
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
  const minimumCandidateCount = planningIntent === 'supplement' ? 0 : planningIntent ? 2 : 3;
  const maximumCandidateCount = planningIntent === 'supplement' ? 2 : planningIntent ? 3 : 6;
  if (rawCandidates.length < minimumCandidateCount || rawCandidates.length > maximumCandidateCount) {
    batchIssues.push(planningIntent ? 'candidate_count_outside_planning_range' : 'candidate_count_must_be_3_to_6');
  }
  if (existingObservations.length === 0 && newObservationCandidates.length < (planningIntent ? 2 : 3)) {
    batchIssues.push(planningIntent ? 'fewer_than_2_valid_independent_candidates' : 'fewer_than_3_valid_independent_candidates');
  }
  if (existingObservations.length > 0 && newObservationCandidates.length === 0) {
    batchIssues.push('no_new_observation_candidate');
  }
  const status = batchIssues.length === 0 ? 'candidates_ready' : 'review_required';
  const authoringContractLimitations = newObservationCandidates.flatMap((candidate, candidateIndex) => {
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
    ...authoringContractLimitations,
    ...(rejectedCandidates.length ? [`${rejectedCandidates.length} candidate(s) were rejected before import.`] : []),
    ...(withheldCandidates.length ? [`${withheldCandidates.length} candidate(s) matched existing or same-batch observations and were withheld from import.`] : []),
    'Candidates are AI-assisted drafts and require human educational review.',
    'Evidence potential is not actual Evidence quality.',
    'Only new observation candidates are importable in discover_new_observation mode.',
  ]);

  return {
    requestId: input.requestId,
    status,
    candidates: newObservationCandidates,
    withheldCandidates,
    rejectedCandidates,
    coveragePreview: {
      surfaceCandidateCount: rawCandidates.length,
      independentObservationCount: newObservationCandidates.length,
      newObservationCount: newObservationCandidates.length,
      alternateQuestionCount: withheldCandidates.filter((item) => item.inventoryRelation.disposition === 'alternate_question_for_existing_observation').length,
      likelyDuplicateCount: withheldCandidates.filter((item) => item.inventoryRelation.disposition === 'likely_duplicate').length,
      unsupportedByMaterialCount: rejectedCandidates.filter((item) => item.disposition === 'unsupported_by_material').length,
      existingObservationCount: existingObservations.length,
      existingQuestionCount: existingQuestions.length,
      primaryAbilityIds: unique(newObservationCandidates.map((item) => item.primaryAbilityId)),
      observationDimensions: unique(newObservationCandidates.map((item) => item.observationDimension)),
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
    version: MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION,
  };
}

function parseCandidate(
  value: unknown,
  candidateIndex: number,
  input: MaterialObservationDraftGeneratorInput,
  paragraphCount: number,
): { candidate?: MaterialObservationPlanningCandidate; issues: string[] } {
  const issues: string[] = [];
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
  const answerAcceptanceDraft = readAnswerAcceptance(value.answerAcceptanceDraft, issues);
  const minimumAnswerRequirement = readMinimumAnswerRequirement(value.minimumAnswerRequirement, issues);
  const calibrationAnswers = readCalibrationAnswers(value.calibrationAnswers, rubricDraft.map((item) => item.name), issues);
  const evidencePotential = readEnum(value.evidencePotential, EVIDENCE_POTENTIAL, 'evidence_potential_invalid', issues);
  const evidenceBoundary = readEvidenceBoundary(value.evidenceBoundary, issues);
  const safetyBoundary = readSafetyBoundary(value.safetyBoundary, issues);

  if (issues.length > 0 || !questionStem || !primaryAbilityId || !observationDimension || !difficultySuggestion ||
    !assessmentMode || !expectedStudentAction || !designRationale || !observationFocus || !materialAnchor ||
    !evidencePotential || !evidenceBoundary || !safetyBoundary || !answerAcceptanceDraft ||
    !questionDraft || !minimumAnswerRequirement) {
    return { issues: unique(issues) };
  }

  return {
    candidate: {
      candidateId: `observation-candidate-${stableHash(`${input.material.materialVersionId}|${questionStem}|${candidateIndex}`)}`,
      questionStem,
      questionDraft,
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
      inventoryRelation: {
        disposition: 'new_observation_candidate',
        reason: '尚未与已有 Observation Inventory 建立同质匹配。',
      },
    },
    issues: [],
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

function readAnswerAcceptance(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push('answer_acceptance_missing');
    return undefined;
  }
  const acceptedKeywords = readStringArray(value.acceptedKeywords);
  if (acceptedKeywords.length === 0) issues.push('answer_acceptance_keywords_missing');
  if (value.semanticEquivalentAllowed !== true) issues.push('semantic_equivalent_must_be_allowed');
  return {
    acceptedKeywords,
    semanticEquivalentAllowed: value.semanticEquivalentAllowed === true,
  };
}

function readMinimumAnswerRequirement(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push('minimum_answer_requirement_missing');
    return undefined;
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
  if ((input.preferences?.requestedFocus?.length || 0) > 160) {
    issues.push('requested_focus_too_long');
  }
  if (input.generationMode && input.generationMode !== 'discover_new_observation') {
    issues.push('generation_mode_invalid');
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
  return {
    requestId: input.requestId,
    status: details.status,
    candidates: [],
    withheldCandidates: [],
    rejectedCandidates: [],
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
    version: MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION,
  };
}

function parseProviderOutput(rawOutput: string): Record<string, unknown> | null {
  const trimmed = rawOutput.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
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
