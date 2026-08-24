import {
  isTextResponseLoadLevel,
  isTextResponseLoadProfile,
  type TextResponseLoadLevel,
  type TextResponseLoadProfile,
} from './readingOpenResponseInputLoad.schema.ts';
import type {
  TrainingTaskSequenceStrategy,
} from './trainingTaskSequencePlanning.schema.ts';

export const READING_OPEN_RESPONSE_LOAD_GATE_VERSION =
  'reading_open_response_load_gate_v1' as const;

export const READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION =
  'question-candidate-p3-load-gate-v1' as const;

export const READING_OPEN_RESPONSE_LOAD_BLOCKER_CODES = [
  'planning_trace_missing_or_stale',
  'composite_core_actions',
  'required_rubric_not_in_stem',
  'material_evidence_insufficient',
  'response_format_load_mismatch',
  'minimum_requirement_overweighted',
  'hint_creates_hidden_task',
  'load_identity_mismatch',
] as const;

export type ReadingOpenResponseLoadBlockerCode =
  typeof READING_OPEN_RESPONSE_LOAD_BLOCKER_CODES[number];

export const READING_OPEN_RESPONSE_LOAD_ADVISORY_CODES = [
  'related_actions_near_boundary',
  'length_band_boundary',
  'developing_entry_with_foundation',
  'answer_acceptance_needs_calibration',
  'higher_order_coverage_thin',
] as const;

export type ReadingOpenResponseLoadAdvisoryCode =
  typeof READING_OPEN_RESPONSE_LOAD_ADVISORY_CODES[number];

export const READING_TASK_GROUP_LOAD_BLOCKER_CODES = [
  'missing_accessible_entry',
  'unexplained_entry_to_integrated_jump',
  'required_higher_order_observation_missing',
  'duplicate_observation_value',
  'sequence_identity_mismatch',
  'sequence_exception_missing_or_invalid',
] as const;

export type ReadingTaskGroupLoadBlockerCode =
  typeof READING_TASK_GROUP_LOAD_BLOCKER_CODES[number];

export const READING_TASK_GROUP_LOAD_ADVISORY_CODES = [
  'focused_to_integrated_jump',
  'developing_entry_with_foundation',
  'higher_order_coverage_thin',
] as const;

export type ReadingTaskGroupLoadAdvisoryCode =
  typeof READING_TASK_GROUP_LOAD_ADVISORY_CODES[number];

export type ReadingOpenResponseLoadGateDecision =
  | 'pass'
  | 'pass_with_advisory'
  | 'blocked';

export type ReadingOpenResponseLoadGateAssessment = {
  assessmentId: string;
  subject: {
    kind: 'candidate' | 'draft_revision';
    subjectId: string;
    revision?: number;
    contentHash: string;
  };
  materialVersionId: string;
  trainingTaskId: string;
  responseFormat: 'short_text' | 'long_text';
  generationPlanningVersion?: string;
  inputLoadRuleVersion: string;
  gateRuleVersion: typeof READING_OPEN_RESPONSE_LOAD_GATE_VERSION;
  recomputedLoadProfile: TextResponseLoadProfile;
  decision: ReadingOpenResponseLoadGateDecision;
  blockerCodes: ReadingOpenResponseLoadBlockerCode[];
  advisoryCodes: ReadingOpenResponseLoadAdvisoryCode[];
  evidencePaths: string[];
  assessedAt: string;
};

export type ReadingTaskGroupLoadGateAssessment = {
  assessmentId: string;
  materialVersionId: string;
  observationPlanRevisionId: string;
  orderedSubjectIdentities: Array<{
    trainingTaskId: string;
    subjectId: string;
    subjectRevision?: number;
    responseFormat: string;
    loadLevel?: TextResponseLoadLevel;
    taskRole: 'training' | 'retest' | 'transfer';
  }>;
  groupSnapshotHash: string;
  sequencePlanningVersion: string;
  sequenceStrategy: TrainingTaskSequenceStrategy;
  sequenceReasonCode: string;
  decision: ReadingOpenResponseLoadGateDecision;
  blockerCodes: ReadingTaskGroupLoadBlockerCode[];
  advisoryCodes: ReadingTaskGroupLoadAdvisoryCode[];
  effectiveLoadSequence: Array<TextResponseLoadLevel | 'single_choice'>;
  retainedHigherOrderObservationIds: string[];
  assessedAt: string;
  gateRuleVersion: typeof READING_OPEN_RESPONSE_LOAD_GATE_VERSION;
};

export type ReadingOpenResponsePublicationReadiness = {
  subjectIdentity: string;
  contentFingerprint: string;
  groupSnapshotFingerprint: string;
  singleGateAssessmentId?: string;
  groupGateAssessmentId: string;
  status: 'ready' | 'blocked' | 'stale';
  canPublish: boolean;
  blockerCodes: string[];
  advisoryCodes: string[];
};

export function isReadingOpenResponseLoadGateAssessment(
  value: unknown,
): value is ReadingOpenResponseLoadGateAssessment {
  if (!value || typeof value !== 'object') return false;
  const assessment = value as ReadingOpenResponseLoadGateAssessment;
  return Boolean(assessment.assessmentId?.trim())
    && ['candidate', 'draft_revision'].includes(assessment.subject?.kind)
    && Boolean(assessment.subject?.subjectId?.trim())
    && Boolean(assessment.subject?.contentHash?.trim())
    && Boolean(assessment.materialVersionId?.trim())
    && Boolean(assessment.trainingTaskId?.trim())
    && ['short_text', 'long_text'].includes(assessment.responseFormat)
    && assessment.gateRuleVersion === READING_OPEN_RESPONSE_LOAD_GATE_VERSION
    && isTextResponseLoadProfile(assessment.recomputedLoadProfile)
    && ['pass', 'pass_with_advisory', 'blocked'].includes(assessment.decision)
    && isCodeList(assessment.blockerCodes, READING_OPEN_RESPONSE_LOAD_BLOCKER_CODES)
    && isCodeList(assessment.advisoryCodes, READING_OPEN_RESPONSE_LOAD_ADVISORY_CODES)
    && Array.isArray(assessment.evidencePaths)
    && assessment.evidencePaths.every(isNonEmptyString)
    && Boolean(assessment.assessedAt?.trim());
}

export function isReadingTaskGroupLoadGateAssessment(
  value: unknown,
): value is ReadingTaskGroupLoadGateAssessment {
  if (!value || typeof value !== 'object') return false;
  const assessment = value as ReadingTaskGroupLoadGateAssessment;
  return Boolean(assessment.assessmentId?.trim())
    && Boolean(assessment.materialVersionId?.trim())
    && Boolean(assessment.observationPlanRevisionId?.trim())
    && Boolean(assessment.groupSnapshotHash?.trim())
    && Array.isArray(assessment.orderedSubjectIdentities)
    && assessment.orderedSubjectIdentities.every((item) => (
      Boolean(item.trainingTaskId?.trim())
      && Boolean(item.subjectId?.trim())
      && Boolean(item.responseFormat?.trim())
      && ['training', 'retest', 'transfer'].includes(item.taskRole)
      && (item.loadLevel === undefined || isTextResponseLoadLevel(item.loadLevel))
    ))
    && ['entry_first', 'holistic_first', 'role_driven'].includes(
      assessment.sequenceStrategy,
    )
    && ['pass', 'pass_with_advisory', 'blocked'].includes(assessment.decision)
    && isCodeList(assessment.blockerCodes, READING_TASK_GROUP_LOAD_BLOCKER_CODES)
    && isCodeList(assessment.advisoryCodes, READING_TASK_GROUP_LOAD_ADVISORY_CODES)
    && Array.isArray(assessment.effectiveLoadSequence)
    && assessment.effectiveLoadSequence.every((item) => (
      item === 'single_choice' || isTextResponseLoadLevel(item)
    ))
    && Array.isArray(assessment.retainedHigherOrderObservationIds)
    && assessment.gateRuleVersion === READING_OPEN_RESPONSE_LOAD_GATE_VERSION
    && Boolean(assessment.assessedAt?.trim());
}

function isCodeList<T extends readonly string[]>(value: unknown, allowed: T): boolean {
  return Array.isArray(value)
    && value.every((item) => typeof item === 'string' && allowed.includes(item));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
