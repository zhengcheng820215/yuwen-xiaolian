import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';
import type {
  PrimaryAbilityId,
  QuestionResponseFormat,
  QuestionResourceDifficulty,
  QuestionResourceRubricItem,
  TextMinimumAnswerRequirement,
} from './questionResourceAdmission.schema.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  TEXT_RESPONSE_LOAD_FINDING_CODES,
  isCanonicalTextResponseAction,
  isTextResponseLoadLevel,
  isTextResponseLoadProfile,
  type CanonicalTextResponseAction,
  type TextResponseLoadFindingCode,
  type TextResponseLoadLevel,
  type TextResponseLoadProfile,
} from './readingOpenResponseInputLoad.schema.ts';

export const READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION =
  'reading_open_response_load_planner_v1' as const;
export const READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION =
  'reading_open_response_candidate_prompt_v2' as const;

export const TEXT_RESPONSE_LOAD_SEQUENCE_PREFERENCES = [
  'foundation_first',
  'holistic_judgment_first',
  'role_driven',
] as const;

export type TextResponseLoadSequencePreference =
  typeof TEXT_RESPONSE_LOAD_SEQUENCE_PREFERENCES[number];

export const TEXT_RESPONSE_LOAD_SEQUENCE_EXCEPTION_REASONS = [
  'holistic_judgment_required',
  'text_expression_required',
  'retest_role',
  'transfer_role',
] as const;

export type TextResponseLoadSequenceExceptionReason =
  typeof TEXT_RESPONSE_LOAD_SEQUENCE_EXCEPTION_REASONS[number];

export const TEXT_RESPONSE_LOAD_PLANNING_RATIONALE_CODES = [
  'single_primary_action',
  'dependent_supporting_action',
  'bounded_evidence_scope',
  'foundation_entry_available',
  'holistic_judgment_preserved',
  'text_expression_preserved',
  'retest_role_preserved',
  'transfer_role_preserved',
  'higher_order_text_observation_preserved',
] as const;

export type TextResponseLoadPlanningRationaleCode =
  typeof TEXT_RESPONSE_LOAD_PLANNING_RATIONALE_CODES[number];

export const TEXT_RESPONSE_LOAD_PLANNING_BLOCK_CODES = [
  'source_identity_incomplete',
  'response_object_missing',
  'analysis_input_incomplete',
  'three_or_more_independent_actions',
  'unsupported_task_role',
] as const;

export type TextResponseLoadPlanningBlockCode =
  typeof TEXT_RESPONSE_LOAD_PLANNING_BLOCK_CODES[number];

export const TEXT_RESPONSE_LOAD_REPAIR_REASON_CODES = [
  'composite_core_actions',
  'hidden_rubric_requirement',
  'evidence_scope_insufficient',
  'evidence_requirement_excessive',
  'response_format_load_mismatch',
  'minimum_length_overweighted',
  'minimum_length_under_supports_rubric',
  'premature_integrated_entry',
  'hint_exceeds_task_load',
] as const;

export type TextResponseLoadRepairReasonCode =
  typeof TEXT_RESPONSE_LOAD_REPAIR_REASON_CODES[number];

export type TextResponseLoadTaskRole = Extract<
  RecommendedTaskRole,
  'training' | 'retest' | 'transfer'
>;

export type TextResponseLoadPlanningIntent = {
  policyVersion: typeof READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION;
  plannerVersion: typeof READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION;
  sourceIdentity: {
    materialVersionId: string;
    observationPlanId?: string;
    trainingTaskId?: string;
    taskRole: TextResponseLoadTaskRole;
  };
  primaryAction: CanonicalTextResponseAction;
  supportingAction?: CanonicalTextResponseAction;
  responseObject: string;
  evidenceScope: {
    sourceAnchorIds: string[];
    requiredEvidenceUnitCount: 0 | 1 | 2 | '3_or_more';
  };
  requiredRelationCount: 0 | 1 | '2_or_more';
  requiredObjectCount: 1 | 2 | '3_or_more';
  targetLoadLevel: TextResponseLoadLevel;
  preferredResponseFormat: 'short_text' | 'long_text';
  expectedAnswerLengthBand: {
    recommendedMin: number;
    recommendedMax: number;
  };
  sequenceContext: {
    position: number;
    singleChoiceFoundationSatisfied: boolean;
    previousLoadLevel?: TextResponseLoadLevel;
    sequencePreference: TextResponseLoadSequencePreference;
    exceptionReason?: TextResponseLoadSequenceExceptionReason;
  };
  preserveHigherOrderTextObservation: boolean;
  rationaleCodes: TextResponseLoadPlanningRationaleCode[];
};

export type TextResponseLoadPlanningInput = {
  sourceIdentity: {
    materialVersionId: string;
    observationPlanId?: string;
    trainingTaskId?: string;
    taskRole: RecommendedTaskRole;
  };
  questionIdentity: string;
  materialTitle?: string;
  questionStem: string;
  responseObject: string;
  responseFormat: QuestionResponseFormat;
  rubric: QuestionResourceRubricItem[];
  minimumAnswerRequirement: TextMinimumAnswerRequirement;
  abilityMetadata: {
    abilityId: PrimaryAbilityId;
    supportingAbilityIds: PrimaryAbilityId[];
    difficulty: QuestionResourceDifficulty;
  };
  expectedStudentAction?: string;
  sourceAnchorIds: string[];
  sourceEvidenceCharacterCount?: number;
  sequenceContext?: {
    position?: number;
    singleChoiceFoundationSatisfied?: boolean;
    previousLoadLevel?: TextResponseLoadLevel;
    sequencePreference?: TextResponseLoadSequencePreference;
    exceptionReason?: TextResponseLoadSequenceExceptionReason;
  };
};

export type TextResponseLoadPlanningResult =
  | {
      status: 'planned';
      intent: TextResponseLoadPlanningIntent;
      effectiveProfile: TextResponseLoadProfile;
      findingCodes: TextResponseLoadFindingCode[];
    }
  | {
      status: 'requires_task_refocus';
      reasonCodes: TextResponseLoadPlanningBlockCode[];
      evidencePaths: string[];
      findingCodes: TextResponseLoadFindingCode[];
    }
  | {
      status: 'not_applicable';
      reason: 'non_text_response_format';
    };

export type TextResponseCandidateGenerationTrace = {
  planningIntent: TextResponseLoadPlanningIntent;
  promptVersion: typeof READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION;
  promptInputFingerprint: string;
  initialProfile?: TextResponseLoadProfile;
  initialFindingCodes: TextResponseLoadFindingCode[];
  repairAttemptCount: 0 | 1;
  repairReasonCodes: TextResponseLoadRepairReasonCode[];
  finalProfile?: TextResponseLoadProfile;
  outcome:
    | 'candidate_created'
    | 'requires_task_refocus'
    | 'generation_contract_failed'
    | 'repair_failed';
};

export function isTextResponseLoadPlanningIntent(
  value: unknown,
): value is TextResponseLoadPlanningIntent {
  if (!value || typeof value !== 'object') return false;
  const intent = value as TextResponseLoadPlanningIntent;
  const source = intent.sourceIdentity;
  const sequence = intent.sequenceContext;
  return intent.policyVersion === READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION
    && intent.plannerVersion === READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION
    && Boolean(source?.materialVersionId?.trim())
    && ['training', 'retest', 'transfer'].includes(source?.taskRole)
    && isCanonicalTextResponseAction(intent.primaryAction)
    && (intent.supportingAction === undefined
      || isCanonicalTextResponseAction(intent.supportingAction))
    && Boolean(intent.responseObject?.trim())
    && Array.isArray(intent.evidenceScope?.sourceAnchorIds)
    && isEvidenceBucket(intent.evidenceScope?.requiredEvidenceUnitCount)
    && isRelationBucket(intent.requiredRelationCount)
    && isObjectBucket(intent.requiredObjectCount)
    && isTextResponseLoadLevel(intent.targetLoadLevel)
    && ['short_text', 'long_text'].includes(intent.preferredResponseFormat)
    && Number.isInteger(intent.expectedAnswerLengthBand?.recommendedMin)
    && Number.isInteger(intent.expectedAnswerLengthBand?.recommendedMax)
    && intent.expectedAnswerLengthBand.recommendedMin >= 0
    && intent.expectedAnswerLengthBand.recommendedMax
      >= intent.expectedAnswerLengthBand.recommendedMin
    && Number.isInteger(sequence?.position)
    && sequence.position >= 0
    && typeof sequence.singleChoiceFoundationSatisfied === 'boolean'
    && TEXT_RESPONSE_LOAD_SEQUENCE_PREFERENCES.includes(sequence.sequencePreference)
    && (sequence.exceptionReason === undefined
      || TEXT_RESPONSE_LOAD_SEQUENCE_EXCEPTION_REASONS.includes(sequence.exceptionReason))
    && typeof intent.preserveHigherOrderTextObservation === 'boolean'
    && Array.isArray(intent.rationaleCodes)
    && intent.rationaleCodes.every((code) => (
      TEXT_RESPONSE_LOAD_PLANNING_RATIONALE_CODES.includes(code)
    ));
}

export function isTextResponseCandidateGenerationTrace(
  value: unknown,
): value is TextResponseCandidateGenerationTrace {
  if (!value || typeof value !== 'object') return false;
  const trace = value as TextResponseCandidateGenerationTrace;
  return isTextResponseLoadPlanningIntent(trace.planningIntent)
    && trace.promptVersion === READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION
    && Boolean(trace.promptInputFingerprint?.trim())
    && (trace.initialProfile === undefined || isTextResponseLoadProfile(trace.initialProfile))
    && Array.isArray(trace.initialFindingCodes)
    && trace.initialFindingCodes.every((code) => TEXT_RESPONSE_LOAD_FINDING_CODES.includes(code))
    && (trace.repairAttemptCount === 0 || trace.repairAttemptCount === 1)
    && Array.isArray(trace.repairReasonCodes)
    && trace.repairReasonCodes.every((code) => TEXT_RESPONSE_LOAD_REPAIR_REASON_CODES.includes(code))
    && (trace.finalProfile === undefined || isTextResponseLoadProfile(trace.finalProfile))
    && [
      'candidate_created',
      'requires_task_refocus',
      'generation_contract_failed',
      'repair_failed',
    ].includes(trace.outcome);
}

function isEvidenceBucket(value: unknown): boolean {
  return value === 0 || value === 1 || value === 2 || value === '3_or_more';
}

function isRelationBucket(value: unknown): boolean {
  return value === 0 || value === 1 || value === '2_or_more';
}

function isObjectBucket(value: unknown): boolean {
  return value === 1 || value === 2 || value === '3_or_more';
}
