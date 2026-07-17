import type { AbilityEvidence, AbilityEvidenceType } from './abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from './concreteLearningTask.schema.ts';
import type { RetentionDifficultyRelation, RetentionMaterialRelation } from './retentionEvaluation.schema.ts';
import type { TaskEvidenceReturnResult } from './taskEvidenceReturn.schema.ts';
import type { TaskExecutionResult } from './taskExecution.schema.ts';

export const EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION = 'evidence_quality_assessment_v1' as const;
export const EVIDENCE_QUALITY_POLICY_VERSION = 'evidence_quality_policy_v1' as const;

export type EvidenceQualityLevel = 'low' | 'medium' | 'high' | 'insufficient';

export type EvidenceEvaluationEligibility =
  | 'eligible'
  | 'limited'
  | 'blocked'
  | 'review_required';

export type EvidenceHintDependency = 'none' | 'low' | 'medium' | 'high' | 'unknown';
export type EvidenceTaskNovelty = 'same' | 'similar' | 'transfer' | 'unknown';
export type EvidenceTimingType = 'immediate' | 'delayed' | 'unknown';

export type EvidenceQualityRetentionContext = {
  delayedRetestPlanId?: string;
  baselineTaskId?: string;
  baselineEvidenceAt?: string;
  materialRelation?: RetentionMaterialRelation;
  difficultyRelation?: RetentionDifficultyRelation;
  source: 'delayed_retest_plan' | 'retention_evaluation' | 'comparison_adapter';
  validationPassed: boolean;
};

export type EvidenceQualityFacts = {
  responseValid: boolean;
  taskAbilityAligned: boolean;
  diagnosisAligned: boolean;
  traceabilityComplete: boolean;
  independentPerformance: boolean;
  usedHint: boolean;
  hintCount: number;
  hintDependency: EvidenceHintDependency;
  taskNovelty: EvidenceTaskNovelty;
  timingType: EvidenceTimingType;
  taskRole: ConcreteLearningTask['taskRole'];
  difficultyRelation: RetentionDifficultyRelation;
  diagnosisReliable: boolean;
};

export type EvidenceQualitySourceLinks = {
  taskId: string;
  executionSessionId: string;
  responseId: string;
  diagnosisResultId: string;
  taskEvidenceReturnId: string;
  delayedRetestPlanId?: string;
};

export type EvidenceQualityAssessment = {
  assessmentId: string;
  evidenceId: string;
  studentId: string;
  abilityId: string;
  observationUnitId: string;
  contextFingerprint: string;
  policyVersion: typeof EVIDENCE_QUALITY_POLICY_VERSION;
  supersedesAssessmentId?: string;
  evidenceType: AbilityEvidenceType;
  qualityLevel: EvidenceQualityLevel;
  evaluationEligibility: EvidenceEvaluationEligibility;
  facts: EvidenceQualityFacts;
  qualityReasons: string[];
  limitations: string[];
  sourceLinks: EvidenceQualitySourceLinks;
  schemaVersion: typeof EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION;
  assessedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type EvidenceQualityAssessmentInput = {
  studentId: string;
  targetAbilityId: string;
  abilityEvidence: AbilityEvidence;
  concreteLearningTask: ConcreteLearningTask;
  taskExecutionResult: TaskExecutionResult;
  taskEvidenceReturnResult: TaskEvidenceReturnResult;
  retentionContext?: EvidenceQualityRetentionContext;
  supersedesAssessment?: EvidenceQualityAssessment;
  assessedAt: string;
  timezone: string;
};

export type CurrentEvidenceQualityAssessmentResolution = {
  evidenceId: string;
  status: 'resolved' | 'missing' | 'review_required';
  assessment: EvidenceQualityAssessment | null;
  issues: string[];
};

export const EVIDENCE_QUALITY_LEVELS: EvidenceQualityLevel[] = [
  'low',
  'medium',
  'high',
  'insufficient',
];

export const EVIDENCE_EVALUATION_ELIGIBILITIES: EvidenceEvaluationEligibility[] = [
  'eligible',
  'limited',
  'blocked',
  'review_required',
];

export const EVIDENCE_HINT_DEPENDENCIES: EvidenceHintDependency[] = [
  'none',
  'low',
  'medium',
  'high',
  'unknown',
];

export const EVIDENCE_TASK_NOVELTIES: EvidenceTaskNovelty[] = [
  'same',
  'similar',
  'transfer',
  'unknown',
];

export const EVIDENCE_TIMING_TYPES: EvidenceTimingType[] = [
  'immediate',
  'delayed',
  'unknown',
];

export function isEvidenceQualityAssessment(value: unknown): value is EvidenceQualityAssessment {
  if (!value || typeof value !== 'object') return false;

  const assessment = value as EvidenceQualityAssessment;
  return (
    isNonEmptyString(assessment.assessmentId) &&
    isNonEmptyString(assessment.evidenceId) &&
    isNonEmptyString(assessment.studentId) &&
    isNonEmptyString(assessment.abilityId) &&
    isNonEmptyString(assessment.observationUnitId) &&
    isNonEmptyString(assessment.contextFingerprint) &&
    assessment.policyVersion === EVIDENCE_QUALITY_POLICY_VERSION &&
    (assessment.supersedesAssessmentId === undefined || isNonEmptyString(assessment.supersedesAssessmentId)) &&
    ['weakness', 'positive', 'growth', 'insufficient'].includes(assessment.evidenceType) &&
    EVIDENCE_QUALITY_LEVELS.includes(assessment.qualityLevel) &&
    EVIDENCE_EVALUATION_ELIGIBILITIES.includes(assessment.evaluationEligibility) &&
    isEvidenceQualityFacts(assessment.facts) &&
    nonEmptyStringArray(assessment.qualityReasons) &&
    stringArray(assessment.limitations) &&
    isEvidenceQualitySourceLinks(assessment.sourceLinks) &&
    assessment.schemaVersion === EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION &&
    isTimestamp(assessment.assessedAt) &&
    isValidation(assessment.validation)
  );
}

export function resolveCurrentEvidenceQualityAssessment(
  evidenceId: string,
  assessments: EvidenceQualityAssessment[],
): CurrentEvidenceQualityAssessmentResolution {
  const validAssessments = assessments.filter((assessment) => (
    isEvidenceQualityAssessment(assessment) && assessment.evidenceId === evidenceId
  ));

  if (validAssessments.length === 0) {
    return {
      evidenceId,
      status: 'missing',
      assessment: null,
      issues: ['No valid EvidenceQualityAssessment was found for this Evidence.'],
    };
  }

  const issues: string[] = [];
  const ids = validAssessments.map((assessment) => assessment.assessmentId);
  if (new Set(ids).size !== ids.length) issues.push('Duplicate assessmentId detected.');

  const byId = new Map(validAssessments.map((assessment) => [assessment.assessmentId, assessment]));
  const supersededIds = new Set<string>();

  for (const assessment of validAssessments) {
    const supersedesId = assessment.supersedesAssessmentId;
    if (!supersedesId) continue;
    if (supersedesId === assessment.assessmentId) {
      issues.push('Assessment cannot supersede itself.');
      continue;
    }
    if (!byId.has(supersedesId)) {
      issues.push(`Superseded assessment ${supersedesId} was not found.`);
      continue;
    }
    supersededIds.add(supersedesId);
  }

  if (hasSupersedeCycle(validAssessments, byId)) {
    issues.push('Assessment supersede chain contains a cycle.');
  }

  const currentCandidates = validAssessments.filter((assessment) => (
    !supersededIds.has(assessment.assessmentId) && assessment.validation.passed
  ));

  if (currentCandidates.length !== 1) {
    issues.push(`Expected one current valid Assessment, found ${currentCandidates.length}.`);
  }

  const current = currentCandidates.length === 1 ? currentCandidates[0] : null;
  if (current && current.policyVersion !== EVIDENCE_QUALITY_POLICY_VERSION) {
    issues.push(`Unsupported policyVersion: ${current.policyVersion}.`);
  }

  return {
    evidenceId,
    status: issues.length === 0 && current ? 'resolved' : 'review_required',
    assessment: issues.length === 0 ? current : null,
    issues: uniqueStrings(issues),
  };
}

function isEvidenceQualityFacts(value: unknown): value is EvidenceQualityFacts {
  if (!value || typeof value !== 'object') return false;
  const facts = value as EvidenceQualityFacts;
  return (
    typeof facts.responseValid === 'boolean' &&
    typeof facts.taskAbilityAligned === 'boolean' &&
    typeof facts.diagnosisAligned === 'boolean' &&
    typeof facts.traceabilityComplete === 'boolean' &&
    typeof facts.independentPerformance === 'boolean' &&
    typeof facts.usedHint === 'boolean' &&
    isNonNegativeInteger(facts.hintCount) &&
    EVIDENCE_HINT_DEPENDENCIES.includes(facts.hintDependency) &&
    EVIDENCE_TASK_NOVELTIES.includes(facts.taskNovelty) &&
    EVIDENCE_TIMING_TYPES.includes(facts.timingType) &&
    ['training', 'retest', 'transfer', 'diagnosis', 'observation'].includes(facts.taskRole) &&
    ['lower', 'comparable', 'higher', 'unknown'].includes(facts.difficultyRelation) &&
    typeof facts.diagnosisReliable === 'boolean'
  );
}

function isEvidenceQualitySourceLinks(value: unknown): value is EvidenceQualitySourceLinks {
  if (!value || typeof value !== 'object') return false;
  const links = value as EvidenceQualitySourceLinks;
  return (
    isNonEmptyString(links.taskId) &&
    isNonEmptyString(links.executionSessionId) &&
    isNonEmptyString(links.responseId) &&
    isNonEmptyString(links.diagnosisResultId) &&
    isNonEmptyString(links.taskEvidenceReturnId) &&
    (links.delayedRetestPlanId === undefined || isNonEmptyString(links.delayedRetestPlanId))
  );
}

function isValidation(value: unknown): value is EvidenceQualityAssessment['validation'] {
  if (!value || typeof value !== 'object') return false;
  const validation = value as EvidenceQualityAssessment['validation'];
  return typeof validation.passed === 'boolean' && stringArray(validation.issues);
}

function hasSupersedeCycle(
  assessments: EvidenceQualityAssessment[],
  byId: Map<string, EvidenceQualityAssessment>,
): boolean {
  for (const assessment of assessments) {
    const visited = new Set<string>();
    let current: EvidenceQualityAssessment | undefined = assessment;
    while (current?.supersedesAssessmentId) {
      if (visited.has(current.assessmentId)) return true;
      visited.add(current.assessmentId);
      current = byId.get(current.supersedesAssessmentId);
    }
  }
  return false;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
