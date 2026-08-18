import {
  QUESTION_QUALITY_CHECKS,
  cloneQuestionQualityValue,
  type MaterialGroundingCheckStatus,
  type QuestionQualityAssessment,
  type QuestionQualityCheck,
  type QuestionQualityCheckStatus,
} from './questionQualityAssessment.schema.ts';

export const QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION =
  'question_semantic_quality_output_v1';
export const QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION =
  'question_semantic_quality_prompt_v2';
export const QUESTION_SEMANTIC_QUALITY_RULE_VERSION =
  'question_semantic_quality_rules_v2';
export const QUESTION_QUALITY_MERGE_RULE_VERSION =
  'question_quality_merge_rules_v1';

export type SemanticAssessmentStatus =
  | 'completed'
  | 'provider_failed'
  | 'timeout'
  | 'invalid_output';

export type SemanticCheckStatus = 'pass' | 'warning' | 'strong_warning';

export type SemanticQualityFinding = {
  check: QuestionQualityCheck;
  status: SemanticCheckStatus;
  reason: string;
  evidenceRefs: string[];
  suggestedReviewQuestion?: string;
};

export type QuestionSemanticQualityAssessment = {
  semanticAssessmentId: string;
  semanticRequestKey: string;
  requestId: string;
  draftId: string;
  resourceId: string;
  assessedDraftRevision: number;
  validationId: string;
  materialVersionId: string;
  deterministicAssessmentId: string;
  status: SemanticAssessmentStatus;
  findings: SemanticQualityFinding[];
  limitations: string[];
  providerId: string;
  modelId: string;
  promptVersion: string;
  semanticRuleVersion: string;
  outputSchemaVersion: string;
  startedAt: string;
  completedAt: string;
};

export type QuestionQualityBundleDecision =
  | 'ready_for_review'
  | 'review_with_warnings'
  | 'revision_recommended'
  | 'semantic_unavailable';

export type QuestionQualityAssessmentBundle = {
  bundleId: string;
  draftId: string;
  resourceId: string;
  assessedDraftRevision: number;
  validationId: string;
  deterministicAssessmentId: string;
  semanticAssessmentId: string;
  effectiveChecks: {
    materialGrounding: MaterialGroundingCheckStatus;
    observationClarity: QuestionQualityCheckStatus;
    observationDistinctness: QuestionQualityCheckStatus;
    discriminativePower: QuestionQualityCheckStatus;
    difficultyCoherence: QuestionQualityCheckStatus;
    rubricAlignment: QuestionQualityCheckStatus;
    scopeClarity: QuestionQualityCheckStatus;
  };
  decision: QuestionQualityBundleDecision;
  warningCodes: string[];
  deterministicRuleVersion: string;
  semanticRuleVersion: string;
  mergeRuleVersion: string;
  createdAt: string;
};

export type QuestionQualityReviewAction =
  | 'approve'
  | 'revision_required'
  | 'reject';

export function isQuestionSemanticQualityAssessment(
  value: unknown,
): value is QuestionSemanticQualityAssessment {
  if (!value || typeof value !== 'object') return false;
  const assessment = value as QuestionSemanticQualityAssessment;
  const baseValid = (
    nonEmpty(assessment.semanticAssessmentId) &&
    nonEmpty(assessment.semanticRequestKey) &&
    nonEmpty(assessment.requestId) &&
    nonEmpty(assessment.draftId) &&
    nonEmpty(assessment.resourceId) &&
    Number.isInteger(assessment.assessedDraftRevision) &&
    assessment.assessedDraftRevision > 0 &&
    nonEmpty(assessment.validationId) &&
    nonEmpty(assessment.materialVersionId) &&
    nonEmpty(assessment.deterministicAssessmentId) &&
    ['completed', 'provider_failed', 'timeout', 'invalid_output']
      .includes(assessment.status) &&
    Array.isArray(assessment.findings) &&
    Array.isArray(assessment.limitations) &&
    assessment.limitations.every(nonEmpty) &&
    nonEmpty(assessment.providerId) &&
    nonEmpty(assessment.modelId) &&
    nonEmpty(assessment.promptVersion) &&
    nonEmpty(assessment.semanticRuleVersion) &&
    nonEmpty(assessment.outputSchemaVersion) &&
    nonEmpty(assessment.startedAt) &&
    nonEmpty(assessment.completedAt)
  );
  if (!baseValid) return false;
  if (assessment.status !== 'completed') return assessment.findings.length === 0;
  return hasExactlyOneFindingPerCheck(assessment.findings);
}

export function isQuestionQualityAssessmentBundle(
  value: unknown,
): value is QuestionQualityAssessmentBundle {
  if (!value || typeof value !== 'object') return false;
  const bundle = value as QuestionQualityAssessmentBundle;
  const checks = bundle.effectiveChecks;
  return (
    nonEmpty(bundle.bundleId) &&
    nonEmpty(bundle.draftId) &&
    nonEmpty(bundle.resourceId) &&
    Number.isInteger(bundle.assessedDraftRevision) &&
    bundle.assessedDraftRevision > 0 &&
    nonEmpty(bundle.validationId) &&
    nonEmpty(bundle.deterministicAssessmentId) &&
    nonEmpty(bundle.semanticAssessmentId) &&
    Boolean(checks) &&
    ['pass', 'warning', 'fail'].includes(checks.materialGrounding) &&
    QUESTION_QUALITY_CHECKS
      .filter((check) => check !== 'materialGrounding')
      .every((check) => ['pass', 'warning'].includes(checks[check])) &&
    [
      'ready_for_review',
      'review_with_warnings',
      'revision_recommended',
      'semantic_unavailable',
    ].includes(bundle.decision) &&
    Array.isArray(bundle.warningCodes) &&
    bundle.warningCodes.every(nonEmpty) &&
    nonEmpty(bundle.deterministicRuleVersion) &&
    nonEmpty(bundle.semanticRuleVersion) &&
    nonEmpty(bundle.mergeRuleVersion) &&
    nonEmpty(bundle.createdAt)
  );
}

export function cloneSemanticQualityValue<T>(value: T): T {
  return cloneQuestionQualityValue(value);
}

export function validateSemanticFindings(
  value: unknown,
  allowedEvidenceRefPrefixes: string[],
): SemanticQualityFinding[] | null {
  if (!Array.isArray(value) || !hasExactlyOneFindingPerCheck(value)) return null;
  const findings = value as SemanticQualityFinding[];
  if (!findings.every((finding) => (
    finding.evidenceRefs.every((ref) => (
      allowedEvidenceRefPrefixes.some((prefix) => (
        ref === prefix ||
        ref.startsWith(`${prefix}:`) ||
        ref.startsWith(`${prefix}.`) ||
        ref.startsWith(`${prefix}[`)
      ))
    )) &&
    (
      finding.suggestedReviewQuestion === undefined ||
      (
        nonEmpty(finding.suggestedReviewQuestion) &&
        !/(自动|直接).*(通过|发布|冻结|freeze)|删除(该|这)?题|必须改成/i
          .test(finding.suggestedReviewQuestion)
      )
    )
  ))) return null;
  return cloneSemanticQualityValue(findings);
}

export function assertBundleIdentityAligned(
  deterministic: QuestionQualityAssessment,
  semantic: QuestionSemanticQualityAssessment,
): void {
  if (
    deterministic.draftId !== semantic.draftId ||
    deterministic.resourceId !== semantic.resourceId ||
    deterministic.assessedDraftRevision !== semantic.assessedDraftRevision ||
    deterministic.validationId !== semantic.validationId ||
    deterministic.assessmentId !== semantic.deterministicAssessmentId
  ) {
    throw new Error('Question quality assessments are not identity-aligned.');
  }
}

function hasExactlyOneFindingPerCheck(value: unknown[]): boolean {
  if (value.length !== QUESTION_QUALITY_CHECKS.length) return false;
  const findings = value as SemanticQualityFinding[];
  return (
    findings.every(isSemanticQualityFinding) &&
    QUESTION_QUALITY_CHECKS.every(
      (check) => findings.filter((finding) => finding.check === check).length === 1,
    )
  );
}

function isSemanticQualityFinding(value: unknown): value is SemanticQualityFinding {
  if (!value || typeof value !== 'object') return false;
  const finding = value as SemanticQualityFinding;
  return (
    QUESTION_QUALITY_CHECKS.includes(finding.check) &&
    ['pass', 'warning', 'strong_warning'].includes(finding.status) &&
    nonEmpty(finding.reason) &&
    Array.isArray(finding.evidenceRefs) &&
    finding.evidenceRefs.length > 0 &&
    finding.evidenceRefs.every(nonEmpty) &&
    (
      finding.suggestedReviewQuestion === undefined ||
      nonEmpty(finding.suggestedReviewQuestion)
    )
  );
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
