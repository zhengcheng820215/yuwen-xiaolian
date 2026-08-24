import { analyzeReadingOpenResponseInputLoad } from './readingOpenResponseInputLoadAnalyzer.ts';
import {
  READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION,
  READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION,
  TEXT_RESPONSE_LOAD_REPAIR_REASON_CODES,
  type TextResponseCandidateGenerationTrace,
  type TextResponseLoadPlanningInput,
  type TextResponseLoadPlanningIntent,
  type TextResponseLoadPlanningRationaleCode,
  type TextResponseLoadPlanningResult,
  type TextResponseLoadRepairReasonCode,
  type TextResponseLoadSequenceExceptionReason,
  type TextResponseLoadSequencePreference,
} from '../schemas/readingOpenResponseGenerationPlanning.schema.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  isTextResponseFormat,
  type TextResponseLoadFindingCode,
  type TextResponseLoadLevel,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';

export const STAGE2_REPAIRABLE_FINDING_CODES = [
  'composite_core_actions',
  'hidden_rubric_requirement',
  'evidence_scope_insufficient',
  'evidence_requirement_excessive',
  'response_format_load_mismatch',
  'minimum_length_overweighted',
  'minimum_length_under_supports_rubric',
] as const satisfies readonly TextResponseLoadFindingCode[];

const STAGE2_GENERATION_BLOCKING_FINDING_CODES = [
  'composite_core_actions',
  'hidden_rubric_requirement',
  'evidence_scope_insufficient',
] as const satisfies readonly TextResponseLoadFindingCode[];

const HIGHER_ORDER_ACTIONS = new Set([
  'infer_from_evidence',
  'compare_objects',
  'analyze_character',
  'analyze_theme',
  'analyze_structure',
  'evaluate_expression',
]);

export type TextResponseLoadCandidateProjection = {
  planningResult: TextResponseLoadPlanningResult;
  trace?: TextResponseCandidateGenerationTrace;
  blockingIssueCodes: string[];
};

export function planReadingOpenResponseLoad(
  input: TextResponseLoadPlanningInput,
): TextResponseLoadPlanningResult {
  if (!isTextResponseFormat(input.responseFormat)) {
    return { status: 'not_applicable', reason: 'non_text_response_format' };
  }
  const reasonCodes: Array<
    'source_identity_incomplete'
    | 'response_object_missing'
    | 'analysis_input_incomplete'
    | 'three_or_more_independent_actions'
    | 'unsupported_task_role'
  > = [];
  const evidencePaths: string[] = [];

  if (!input.sourceIdentity.materialVersionId?.trim()) {
    reasonCodes.push('source_identity_incomplete');
    evidencePaths.push('sourceIdentity.materialVersionId');
  }
  if (!input.responseObject?.trim()) {
    reasonCodes.push('response_object_missing');
    evidencePaths.push('responseObject');
  }
  if (!['training', 'retest', 'transfer'].includes(input.sourceIdentity.taskRole)) {
    reasonCodes.push('unsupported_task_role');
    evidencePaths.push('sourceIdentity.taskRole');
  }

  const audit = analyzeReadingOpenResponseInputLoad({
    questionVersionId: input.questionIdentity,
    materialVersionId: input.sourceIdentity.materialVersionId,
    title: input.materialTitle,
    questionStem: input.questionStem,
    responseFormat: input.responseFormat,
    rubric: input.rubric,
    minimumAnswerRequirement: input.minimumAnswerRequirement,
    abilityMetadata: {
      abilityId: input.abilityMetadata.abilityId,
      supportingAbilityIds: input.abilityMetadata.supportingAbilityIds,
      taskRole: input.sourceIdentity.taskRole,
      difficulty: input.abilityMetadata.difficulty,
    },
    expectedStudentAction: input.expectedStudentAction,
    sourceAnchorIds: input.sourceAnchorIds,
    sourceEvidenceCharacterCount: input.sourceEvidenceCharacterCount,
  });

  if (!audit || !audit.profile || audit.analysisCompleteness === 'insufficient_input') {
    reasonCodes.push('analysis_input_incomplete');
    evidencePaths.push('questionStem', 'rubric', 'minimumAnswerRequirement');
  }
  const findingCodes = audit?.findings.map((finding) => finding.code) || [];
  if (findingCodes.includes('composite_core_actions')) {
    reasonCodes.push('three_or_more_independent_actions');
    evidencePaths.push('questionStem', 'rubric');
  }

  if (reasonCodes.length > 0 || !audit?.profile) {
    return {
      status: 'requires_task_refocus',
      reasonCodes: unique(reasonCodes),
      evidencePaths: unique(evidencePaths).sort(),
      findingCodes: unique(findingCodes).sort(),
    };
  }

  const sequence = resolveSequenceContext(input);
  const rationaleCodes: TextResponseLoadPlanningRationaleCode[] = [
    'single_primary_action',
    'bounded_evidence_scope',
  ];
  if (audit.profile.supportingAction) rationaleCodes.push('dependent_supporting_action');
  if (sequence.sequencePreference === 'foundation_first') {
    rationaleCodes.push('foundation_entry_available');
  }
  if (sequence.exceptionReason === 'holistic_judgment_required') {
    rationaleCodes.push('holistic_judgment_preserved');
  }
  if (sequence.exceptionReason === 'text_expression_required') {
    rationaleCodes.push('text_expression_preserved');
  }
  if (sequence.exceptionReason === 'retest_role') {
    rationaleCodes.push('retest_role_preserved');
  }
  if (sequence.exceptionReason === 'transfer_role') {
    rationaleCodes.push('transfer_role_preserved');
  }
  const preserveHigherOrderTextObservation = HIGHER_ORDER_ACTIONS.has(
    audit.profile.primaryAction,
  );
  if (preserveHigherOrderTextObservation) {
    rationaleCodes.push('higher_order_text_observation_preserved');
  }

  const intent: TextResponseLoadPlanningIntent = {
    policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
    plannerVersion: READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION,
    sourceIdentity: {
      materialVersionId: input.sourceIdentity.materialVersionId,
      ...(input.sourceIdentity.observationPlanId
        ? { observationPlanId: input.sourceIdentity.observationPlanId }
        : {}),
      ...(input.sourceIdentity.trainingTaskId
        ? { trainingTaskId: input.sourceIdentity.trainingTaskId }
        : {}),
      taskRole: input.sourceIdentity.taskRole as 'training' | 'retest' | 'transfer',
    },
    primaryAction: audit.profile.primaryAction,
    ...(audit.profile.supportingAction
      ? { supportingAction: audit.profile.supportingAction }
      : {}),
    responseObject: input.responseObject.trim(),
    evidenceScope: {
      sourceAnchorIds: unique(input.sourceAnchorIds).sort(),
      requiredEvidenceUnitCount: audit.profile.requiredEvidenceUnitCount,
    },
    requiredRelationCount: audit.profile.requiredRelationCount,
    requiredObjectCount: audit.profile.requiredObjectCount,
    targetLoadLevel: audit.profile.loadLevel,
    preferredResponseFormat: preferredFormatFor(audit.profile.loadLevel),
    expectedAnswerLengthBand: audit.profile.expectedAnswerLengthBand,
    sequenceContext: sequence,
    preserveHigherOrderTextObservation,
    rationaleCodes: unique(rationaleCodes),
  };

  return {
    status: 'planned',
    intent,
    effectiveProfile: audit.profile,
    findingCodes: unique(findingCodes).sort(),
  };
}

export function projectReadingOpenResponseCandidateLoad(input: {
  planningInput: TextResponseLoadPlanningInput;
  promptInputFingerprint: string;
  repairAttemptCount?: 0 | 1;
  repairIssueCodes?: string[];
}): TextResponseLoadCandidateProjection {
  const planningResult = planReadingOpenResponseLoad(input.planningInput);
  if (planningResult.status !== 'planned') {
    return {
      planningResult,
      blockingIssueCodes: planningResult.status === 'requires_task_refocus'
        ? planningResult.reasonCodes.map((code) => `text_response_load.${code}`)
        : [],
    };
  }

  const blockingFindingCodes = planningResult.findingCodes.filter((code) => (
    STAGE2_GENERATION_BLOCKING_FINDING_CODES.includes(code as (
      typeof STAGE2_GENERATION_BLOCKING_FINDING_CODES[number]
    ))
  ));
  const repairReasonCodes = unique([
    ...planningResult.findingCodes,
    ...(input.repairIssueCodes || []).map(stripLoadIssuePrefix),
  ]).filter(isRepairReasonCode);
  const repairAttemptCount = input.repairAttemptCount || 0;
  const blockingIssueCodes = blockingFindingCodes.map(
    (code) => `text_response_load.${code}`,
  );
  const trace: TextResponseCandidateGenerationTrace = {
    planningIntent: planningResult.intent,
    promptVersion: READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION,
    promptInputFingerprint: input.promptInputFingerprint,
    initialProfile: repairAttemptCount === 0
      ? planningResult.effectiveProfile
      : undefined,
    initialFindingCodes: repairAttemptCount === 0
      ? planningResult.findingCodes
      : repairReasonCodes.filter(isLoadFindingCode),
    repairAttemptCount,
    repairReasonCodes,
    finalProfile: planningResult.effectiveProfile,
    outcome: blockingIssueCodes.length > 0
      ? repairAttemptCount === 1 ? 'repair_failed' : 'generation_contract_failed'
      : 'candidate_created',
  };

  return { planningResult, trace, blockingIssueCodes };
}

export function buildReadingOpenResponseLoadPromptPolicy(): string {
  return `开放文本题负担策略（${READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION}）：
1. short_text / long_text 每题必须只有一个主要认知动作，最多增加一个共享对象与证据的紧密支撑动作。
2. 不得为凑 entry_short / focused_short / developing / integrated 而制造任务；梯度只要求避免无理由跳跃。
3. 先确定训练动作、对象、证据与关系，再选择作答形式和内部内容密度；不得先定字数再增加评分点。
4. 推荐长度只用于内部生成：entry_short 10—25、focused_short 20—40、developing 30—60、integrated 50—100；不得把这些区间写入题干、作答要求、提示或反馈。
5. minimumAnswerRequirement 必须独立反映最小内容有效性，不得机械复制推荐长度下限。
6. 每个 required Rubric 必须在题干中有明确对应要求；三个以上独立动作必须收窄，无法收窄时不要返回该候选。
7. 已有单选确认基础事实时，文本题必须增加解释、证据组织、推理或表达价值，不得只换成文字复述同一结论。
8. 保留必要的高阶文本观察；不得为了降低输入负担把概括、推理、人物、主题或表达训练全部选择题化。
9. 常规顺序优先由低负担进入；整体判断、独立表达、Retest 或 Transfer 可按已给定受控原因调整。
10. 不输出 loadLevel、recommendedMin、recommendedMax、planningIntent 或其他内部治理字段。`;
}

export function stableTextResponsePromptFingerprint(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 2166136261;
  for (const character of serialized) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return `text-load-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function resolveSequenceContext(input: TextResponseLoadPlanningInput): {
  position: number;
  singleChoiceFoundationSatisfied: boolean;
  previousLoadLevel?: TextResponseLoadLevel;
  sequencePreference: TextResponseLoadSequencePreference;
  exceptionReason?: TextResponseLoadSequenceExceptionReason;
} {
  const provided = input.sequenceContext;
  if (input.sourceIdentity.taskRole === 'retest') {
    return {
      position: Math.max(0, provided?.position || 0),
      singleChoiceFoundationSatisfied: provided?.singleChoiceFoundationSatisfied || false,
      ...(provided?.previousLoadLevel ? { previousLoadLevel: provided.previousLoadLevel } : {}),
      sequencePreference: 'role_driven',
      exceptionReason: 'retest_role',
    };
  }
  if (input.sourceIdentity.taskRole === 'transfer') {
    return {
      position: Math.max(0, provided?.position || 0),
      singleChoiceFoundationSatisfied: provided?.singleChoiceFoundationSatisfied || false,
      ...(provided?.previousLoadLevel ? { previousLoadLevel: provided.previousLoadLevel } : {}),
      sequencePreference: 'role_driven',
      exceptionReason: 'transfer_role',
    };
  }
  return {
    position: Math.max(0, provided?.position || 0),
    singleChoiceFoundationSatisfied: provided?.singleChoiceFoundationSatisfied || false,
    ...(provided?.previousLoadLevel ? { previousLoadLevel: provided.previousLoadLevel } : {}),
    sequencePreference: provided?.sequencePreference || 'foundation_first',
    ...(provided?.exceptionReason ? { exceptionReason: provided.exceptionReason } : {}),
  };
}

function preferredFormatFor(level: TextResponseLoadLevel): 'short_text' | 'long_text' {
  return level === 'integrated' ? 'long_text' : 'short_text';
}

function stripLoadIssuePrefix(value: string): string {
  return value.replace(/^text_response_load\./u, '').split(':')[0] || value;
}

function isRepairReasonCode(value: string): value is TextResponseLoadRepairReasonCode {
  return TEXT_RESPONSE_LOAD_REPAIR_REASON_CODES.includes(
    value as TextResponseLoadRepairReasonCode,
  );
}

function isLoadFindingCode(value: string): value is TextResponseLoadFindingCode {
  return STAGE2_REPAIRABLE_FINDING_CODES.includes(
    value as typeof STAGE2_REPAIRABLE_FINDING_CODES[number],
  );
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) || 'null';
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
