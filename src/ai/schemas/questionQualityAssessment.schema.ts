import type {
  PrimaryAbilityId,
  QuestionResourceDifficulty,
} from './questionResourceAdmission.schema.ts';

export const QUESTION_QUALITY_ASSESSMENT_VERSION = 'phase17_5a_v1';
export const QUESTION_QUALITY_RULE_VERSION = 'question_quality_rules_v7';

export const QUESTION_QUALITY_CHECKS = [
  'materialGrounding',
  'observationClarity',
  'observationDistinctness',
  'discriminativePower',
  'difficultyCoherence',
  'rubricAlignment',
  'scopeClarity',
] as const;

export type QuestionQualityCheck = typeof QUESTION_QUALITY_CHECKS[number];
export type QuestionQualityCheckStatus = 'pass' | 'warning';
export type MaterialGroundingCheckStatus = QuestionQualityCheckStatus | 'fail';
export type QuestionQualityDecision =
  | 'pass'
  | 'pass_with_warnings'
  | 'revision_recommended';

export type QuestionQualityWarning = {
  code: string;
  check: QuestionQualityCheck;
  severity: 'warning' | 'strong_warning';
  message: string;
  evidenceRefs: string[];
  comparison?: {
    peerDraftId: string;
    peerResourceId: string;
    peerQuestionStem: string;
    stemSimilarity: number;
    rubricEvidenceSimilarity: number;
  };
};

export type QuestionQualityAssessment = {
  assessmentId: string;
  draftId: string;
  resourceId: string;
  assessedDraftRevision: number;
  validationId: string;
  comparisonContextHash?: string;
  checks: {
    materialGrounding: MaterialGroundingCheckStatus;
    observationClarity: QuestionQualityCheckStatus;
    observationDistinctness: QuestionQualityCheckStatus;
    discriminativePower: QuestionQualityCheckStatus;
    difficultyCoherence: QuestionQualityCheckStatus;
    rubricAlignment: QuestionQualityCheckStatus;
    scopeClarity: QuestionQualityCheckStatus;
  };
  decision: QuestionQualityDecision;
  warnings: QuestionQualityWarning[];
  assessedAt: string;
  ruleVersion: string;
  version: typeof QUESTION_QUALITY_ASSESSMENT_VERSION;
};

export type QuestionGenerationBatchQualitySummary = {
  generationRequestId: string;
  candidateCount: number;
  validDraftCount: number;
  abilityBreakdown: Partial<Record<PrimaryAbilityId, number>>;
  difficultyBreakdown: Partial<Record<QuestionResourceDifficulty, number>>;
  duplicateObservationCount: number;
  strongEvidencePotentialCount: number;
  portfolioWarnings: string[];
};

export function isQuestionQualityAssessment(
  value: unknown,
): value is QuestionQualityAssessment {
  if (!value || typeof value !== 'object') return false;
  const assessment = value as QuestionQualityAssessment;
  const checks = assessment.checks;

  return (
    nonEmpty(assessment.assessmentId) &&
    nonEmpty(assessment.draftId) &&
    nonEmpty(assessment.resourceId) &&
    Number.isInteger(assessment.assessedDraftRevision) &&
    assessment.assessedDraftRevision > 0 &&
    nonEmpty(assessment.validationId) &&
    (
      assessment.comparisonContextHash === undefined ||
      nonEmpty(assessment.comparisonContextHash)
    ) &&
    Boolean(checks) &&
    ['pass', 'warning', 'fail'].includes(checks.materialGrounding) &&
    QUESTION_QUALITY_CHECKS
      .filter((check) => check !== 'materialGrounding')
      .every((check) => ['pass', 'warning'].includes(checks[check])) &&
    ['pass', 'pass_with_warnings', 'revision_recommended'].includes(assessment.decision) &&
    Array.isArray(assessment.warnings) &&
    assessment.warnings.every(isQuestionQualityWarning) &&
    nonEmpty(assessment.assessedAt) &&
    nonEmpty(assessment.ruleVersion) &&
    assessment.version === QUESTION_QUALITY_ASSESSMENT_VERSION
  );
}

export function cloneQuestionQualityValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isQuestionQualityWarning(value: unknown): value is QuestionQualityWarning {
  if (!value || typeof value !== 'object') return false;
  const warning = value as QuestionQualityWarning;
  return (
    nonEmpty(warning.code) &&
    QUESTION_QUALITY_CHECKS.includes(warning.check) &&
    ['warning', 'strong_warning'].includes(warning.severity) &&
    nonEmpty(warning.message) &&
    Array.isArray(warning.evidenceRefs) &&
    warning.evidenceRefs.every(nonEmpty) &&
    isWarningComparison(warning.comparison)
  );
}

function isWarningComparison(
  value: QuestionQualityWarning['comparison'] | undefined,
): boolean {
  if (value === undefined) return true;
  return (
    nonEmpty(value.peerDraftId) &&
    nonEmpty(value.peerResourceId) &&
    nonEmpty(value.peerQuestionStem) &&
    finiteRatio(value.stemSimilarity) &&
    finiteRatio(value.rubricEvidenceSimilarity)
  );
}

function finiteRatio(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
