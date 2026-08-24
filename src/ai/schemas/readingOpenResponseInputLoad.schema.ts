import type {
  PrimaryAbilityId,
  QuestionResourceRubricItem,
  QuestionResponseFormat,
  QuestionResourceDifficulty,
  TextMinimumAnswerRequirement,
} from './questionResourceAdmission.schema.ts';
import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';
import type { TrainingTaskSequenceReason } from './trainingTaskSequencePlanning.schema.ts';

export const READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION =
  'reading_open_response_input_load_policy_v1_1' as const;
export const READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION =
  'reading_open_response_input_load_audit_v1' as const;

export const TEXT_RESPONSE_LOAD_LEVELS = [
  'entry_short',
  'focused_short',
  'developing',
  'integrated',
] as const;

export type TextResponseLoadLevel = typeof TEXT_RESPONSE_LOAD_LEVELS[number];

export const CANONICAL_TEXT_RESPONSE_ACTIONS = [
  'locate_information',
  'extract_evidence',
  'identify_relation',
  'explain_local_meaning',
  'summarize_content',
  'connect_evidence_and_conclusion',
  'infer_from_evidence',
  'compare_objects',
  'analyze_character',
  'analyze_theme',
  'analyze_structure',
  'evaluate_expression',
] as const;

export type CanonicalTextResponseAction =
  typeof CANONICAL_TEXT_RESPONSE_ACTIONS[number];

export const TEXT_RESPONSE_COMPOSITE_LOAD_REASONS = [
  'multiple_independent_actions',
  'multiple_required_evidence_units',
  'multiple_required_relations',
  'multiple_required_objects',
  'whole_text_integration',
  'rubric_requirement_density',
] as const;

export type TextResponseCompositeLoadReason =
  typeof TEXT_RESPONSE_COMPOSITE_LOAD_REASONS[number];

export type TextResponseLoadProfile = {
  policyVersion: typeof READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION;
  loadLevel: TextResponseLoadLevel;
  primaryAction: CanonicalTextResponseAction;
  supportingAction?: CanonicalTextResponseAction;
  requiredEvidenceUnitCount: 0 | 1 | 2 | '3_or_more';
  requiredRelationCount: 0 | 1 | '2_or_more';
  requiredObjectCount: 1 | 2 | '3_or_more';
  expectedAnswerLengthBand: {
    recommendedMin: number;
    recommendedMax: number;
  };
  compositeLoadReasons: TextResponseCompositeLoadReason[];
};

export type TextResponseLoadAnalysisCompleteness =
  | 'complete'
  | 'partial'
  | 'insufficient_input';

export const TEXT_RESPONSE_LOAD_FINDING_CODES = [
  'analysis_input_incomplete',
  'composite_core_actions',
  'hidden_rubric_requirement',
  'evidence_scope_insufficient',
  'evidence_requirement_excessive',
  'object_scope_overloaded',
  'relation_load_overloaded',
  'response_format_load_mismatch',
  'minimum_length_overweighted',
  'minimum_length_under_supports_rubric',
  'unexplained_load_jump',
  'missing_entry_path',
  'duplicate_load_observation',
] as const;

export type TextResponseLoadFindingCode =
  typeof TEXT_RESPONSE_LOAD_FINDING_CODES[number];

export type TextResponseLoadAuditSeverity = 'info' | 'warning' | 'high_risk';

export const TEXT_RESPONSE_LOAD_DISPOSITIONS = [
  'retain',
  'copy_or_length_adjustment',
  'decompose_or_refocus',
  'regenerate',
] as const;

export type TextResponseLoadDisposition =
  typeof TEXT_RESPONSE_LOAD_DISPOSITIONS[number];

export type TextResponseLoadAuditFinding = {
  code: TextResponseLoadFindingCode;
  severity: TextResponseLoadAuditSeverity;
  evidencePaths: string[];
  explanation: string;
  recommendedDisposition: TextResponseLoadDisposition;
};

export type TextResponseLoadAnalysisInput = {
  questionVersionId: string;
  materialVersionId?: string;
  title?: string;
  questionStem: string;
  responseFormat: QuestionResponseFormat;
  rubric: QuestionResourceRubricItem[];
  minimumAnswerRequirement: TextMinimumAnswerRequirement;
  abilityMetadata: {
    abilityId: PrimaryAbilityId;
    supportingAbilityIds: PrimaryAbilityId[];
    taskRole: RecommendedTaskRole;
    difficulty: QuestionResourceDifficulty;
  };
  expectedStudentAction?: string;
  sourceAnchorIds?: string[];
  sourceEvidenceCharacterCount?: number;
  tags?: string[];
};

export type TextResponseLoadAuditResult = {
  questionVersionId: string;
  materialVersionId?: string;
  responseFormat: 'short_text' | 'long_text';
  analysisCompleteness: TextResponseLoadAnalysisCompleteness;
  profile?: TextResponseLoadProfile;
  findings: TextResponseLoadAuditFinding[];
  disposition: TextResponseLoadDisposition;
  analyzerVersion: typeof READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION;
};

export type TextResponseTaskGroupItem = {
  questionVersionId: string;
  responseFormat: QuestionResponseFormat;
  taskRole: RecommendedTaskRole;
  sourceAnchorIds: string[];
  sequenceRank?: number;
  auditResult?: TextResponseLoadAuditResult;
};

export type TextResponseTaskGroupLoadAudit = {
  materialVersionId: string;
  orderedQuestionVersionIds: string[];
  textQuestionCount: number;
  singleChoiceCount: number;
  levelDistribution: Record<TextResponseLoadLevel, number>;
  sequenceFindings: TextResponseLoadAuditFinding[];
  questionResults: TextResponseLoadAuditResult[];
};

export type TextResponseTaskGroupAuditInput = {
  materialVersionId: string;
  tasks: TextResponseTaskGroupItem[];
  sequenceReason?: TrainingTaskSequenceReason;
};

export function isTextResponseFormat(
  value: QuestionResponseFormat,
): value is 'short_text' | 'long_text' {
  return value === 'short_text' || value === 'long_text';
}

export function isTextResponseLoadLevel(value: unknown): value is TextResponseLoadLevel {
  return typeof value === 'string'
    && (TEXT_RESPONSE_LOAD_LEVELS as readonly string[]).includes(value);
}

export function isCanonicalTextResponseAction(
  value: unknown,
): value is CanonicalTextResponseAction {
  return typeof value === 'string'
    && (CANONICAL_TEXT_RESPONSE_ACTIONS as readonly string[]).includes(value);
}

export function isTextResponseLoadProfile(value: unknown): value is TextResponseLoadProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as TextResponseLoadProfile;
  return profile.policyVersion === READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION
    && isTextResponseLoadLevel(profile.loadLevel)
    && isCanonicalTextResponseAction(profile.primaryAction)
    && (profile.supportingAction === undefined
      || isCanonicalTextResponseAction(profile.supportingAction))
    && isEvidenceUnitBucket(profile.requiredEvidenceUnitCount)
    && isRelationBucket(profile.requiredRelationCount)
    && isObjectBucket(profile.requiredObjectCount)
    && Number.isInteger(profile.expectedAnswerLengthBand?.recommendedMin)
    && Number.isInteger(profile.expectedAnswerLengthBand?.recommendedMax)
    && profile.expectedAnswerLengthBand.recommendedMin >= 0
    && profile.expectedAnswerLengthBand.recommendedMax
      >= profile.expectedAnswerLengthBand.recommendedMin
    && Array.isArray(profile.compositeLoadReasons)
    && profile.compositeLoadReasons.every((reason) => (
      (TEXT_RESPONSE_COMPOSITE_LOAD_REASONS as readonly string[]).includes(reason)
    ));
}

export function isTextResponseLoadAuditResult(
  value: unknown,
): value is TextResponseLoadAuditResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as TextResponseLoadAuditResult;
  return Boolean(result.questionVersionId?.trim())
    && isTextResponseFormat(result.responseFormat)
    && ['complete', 'partial', 'insufficient_input'].includes(result.analysisCompleteness)
    && (result.profile === undefined || isTextResponseLoadProfile(result.profile))
    && Array.isArray(result.findings)
    && result.findings.every(isFinding)
    && (TEXT_RESPONSE_LOAD_DISPOSITIONS as readonly string[]).includes(result.disposition)
    && result.analyzerVersion === READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION;
}

function isEvidenceUnitBucket(value: unknown): boolean {
  return value === 0 || value === 1 || value === 2 || value === '3_or_more';
}

function isRelationBucket(value: unknown): boolean {
  return value === 0 || value === 1 || value === '2_or_more';
}

function isObjectBucket(value: unknown): boolean {
  return value === 1 || value === 2 || value === '3_or_more';
}

function isFinding(value: unknown): value is TextResponseLoadAuditFinding {
  if (!value || typeof value !== 'object') return false;
  const finding = value as TextResponseLoadAuditFinding;
  return (TEXT_RESPONSE_LOAD_FINDING_CODES as readonly string[]).includes(finding.code)
    && ['info', 'warning', 'high_risk'].includes(finding.severity)
    && Array.isArray(finding.evidencePaths)
    && finding.evidencePaths.every((path) => typeof path === 'string')
    && Boolean(finding.explanation?.trim())
    && (TEXT_RESPONSE_LOAD_DISPOSITIONS as readonly string[])
      .includes(finding.recommendedDisposition);
}
