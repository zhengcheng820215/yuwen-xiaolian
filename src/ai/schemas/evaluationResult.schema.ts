export type EvidenceSufficiency =
  | 'insufficient'
  | 'limited'
  | 'sufficient';

export type GrowthLevel =
  | 'unconfirmed'
  | 'early_signal'
  | 'improving'
  | 'stable'
  | 'fluctuating';

export type EvaluationNextAction =
  | 'collect_more_evidence'
  | 'continue_training'
  | 'independent_retest'
  | 'transfer_test'
  | 'maintenance'
  | 'human_review';

export type EvaluationConflictStatus =
  | 'none'
  | 'minor'
  | 'significant';

export type EvaluationResult = {
  evaluationId: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;
  evidenceSufficiency: EvidenceSufficiency;
  growthLevel: GrowthLevel;
  weaknessEvidenceCount: number;
  positiveEvidenceCount: number;
  growthEvidenceCount: number;
  insufficientEvidenceCount: number;
  hasIndependentRetestEvidence: boolean;
  hasTransferEvidence: boolean;
  conflictStatus: EvaluationConflictStatus;
  confidence: number;
  summary: string;
  limitations: string[];
  nextAction: EvaluationNextAction;
  evidenceLinks: string[];
  createdAt: string;
};

export const EVIDENCE_SUFFICIENCIES: EvidenceSufficiency[] = [
  'insufficient',
  'limited',
  'sufficient',
];

export const GROWTH_LEVELS: GrowthLevel[] = [
  'unconfirmed',
  'early_signal',
  'improving',
  'stable',
  'fluctuating',
];

export const EVALUATION_NEXT_ACTIONS: EvaluationNextAction[] = [
  'collect_more_evidence',
  'continue_training',
  'independent_retest',
  'transfer_test',
  'maintenance',
  'human_review',
];

export const EVALUATION_CONFLICT_STATUSES: EvaluationConflictStatus[] = [
  'none',
  'minor',
  'significant',
];

export function isEvaluationResult(value: unknown): value is EvaluationResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as EvaluationResult;

  return (
    isNonEmptyString(result.evaluationId) &&
    isNonEmptyString(result.studentId) &&
    isNonEmptyString(result.abilityId) &&
    (result.abilityLabel === undefined || isNonEmptyString(result.abilityLabel)) &&
    EVIDENCE_SUFFICIENCIES.includes(result.evidenceSufficiency) &&
    GROWTH_LEVELS.includes(result.growthLevel) &&
    isNonNegativeNumber(result.weaknessEvidenceCount) &&
    isNonNegativeNumber(result.positiveEvidenceCount) &&
    isNonNegativeNumber(result.growthEvidenceCount) &&
    isNonNegativeNumber(result.insufficientEvidenceCount) &&
    typeof result.hasIndependentRetestEvidence === 'boolean' &&
    typeof result.hasTransferEvidence === 'boolean' &&
    EVALUATION_CONFLICT_STATUSES.includes(result.conflictStatus) &&
    isConfidence(result.confidence) &&
    isNonEmptyString(result.summary) &&
    Array.isArray(result.limitations) &&
    result.limitations.every((item) => typeof item === 'string') &&
    EVALUATION_NEXT_ACTIONS.includes(result.nextAction) &&
    Array.isArray(result.evidenceLinks) &&
    result.evidenceLinks.length > 0 &&
    result.evidenceLinks.every(isNonEmptyString) &&
    isNonEmptyString(result.createdAt)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}

function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 1;
}
