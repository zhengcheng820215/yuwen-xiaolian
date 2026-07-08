import type { AbilityEvidence } from './abilityEvidence.schema.ts';

export type TrainingImprovementStatus =
  | 'not_improved'
  | 'improving_not_stable'
  | 'improved';

export type AbilityChange = '-1' | '0' | '+1';

export type TrainingEvidenceLoopInput = {
  studentId: string;
  ability: string;
  weakness: string;
  trainingFocus: string;
  dayTask: string;
  studentTrainingAnswer: string;
  retestQuestion: string;
  studentRetestAnswer: string;
  previousEvidence: AbilityEvidence[];
  createdAt?: string;
};

export type TrainingTaskEvaluation = {
  ability: string;
  trainingTask: string;
  studentAnswer: string;
  status: TrainingImprovementStatus;
  processFindings: string[];
  observation: string;
  confidence: number;
};

export type RetestEvaluation = {
  ability: string;
  retestQuestion: string;
  studentAnswer: string;
  abilityChange: AbilityChange;
  comparison: string;
  observation: string;
  confidence: number;
};

export type TrainingEvidenceLoopResult = {
  studentId: string;
  ability: string;
  originalWeakness: string;
  trainingFocus: string;
  trainingEvaluation: TrainingTaskEvaluation;
  retestEvaluation: RetestEvaluation;
  generatedEvidence: AbilityEvidence[];
  updatedEvidence: AbilityEvidence[];
  summary: string;
};

export function normalizeTrainingEvidenceLoopResult(
  value: Partial<TrainingEvidenceLoopResult>,
): TrainingEvidenceLoopResult {
  return {
    studentId: value.studentId || 'demo-student',
    ability: value.ability || '待评估能力',
    originalWeakness: value.originalWeakness || '待验证薄弱点',
    trainingFocus: value.trainingFocus || '待验证训练目标',
    trainingEvaluation: normalizeTrainingTaskEvaluation(value.trainingEvaluation),
    retestEvaluation: normalizeRetestEvaluation(value.retestEvaluation),
    generatedEvidence: Array.isArray(value.generatedEvidence) ? value.generatedEvidence : [],
    updatedEvidence: Array.isArray(value.updatedEvidence) ? value.updatedEvidence : [],
    summary: value.summary || '训练与复测证据已生成。',
  };
}

export function isTrainingEvidenceLoopResult(value: unknown): value is TrainingEvidenceLoopResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as TrainingEvidenceLoopResult;
  return (
    typeof result.studentId === 'string' &&
    result.studentId.trim().length > 0 &&
    typeof result.ability === 'string' &&
    result.ability.trim().length > 0 &&
    typeof result.originalWeakness === 'string' &&
    result.originalWeakness.trim().length > 0 &&
    typeof result.trainingFocus === 'string' &&
    result.trainingFocus.trim().length > 0 &&
    isTrainingTaskEvaluation(result.trainingEvaluation) &&
    isRetestEvaluation(result.retestEvaluation) &&
    Array.isArray(result.generatedEvidence) &&
    result.generatedEvidence.length >= 2 &&
    Array.isArray(result.updatedEvidence) &&
    result.updatedEvidence.length >= result.generatedEvidence.length &&
    typeof result.summary === 'string' &&
    result.summary.trim().length > 0
  );
}

function normalizeTrainingTaskEvaluation(
  value: Partial<TrainingTaskEvaluation> | undefined,
): TrainingTaskEvaluation {
  return {
    ability: value?.ability || '待评估能力',
    trainingTask: value?.trainingTask || '待评估训练任务',
    studentAnswer: value?.studentAnswer || '',
    status: normalizeImprovementStatus(value?.status),
    processFindings: Array.isArray(value?.processFindings) ? value.processFindings : [],
    observation: value?.observation || '训练表现尚未形成可解释观察。',
    confidence: normalizeConfidence(value?.confidence),
  };
}

function normalizeRetestEvaluation(value: Partial<RetestEvaluation> | undefined): RetestEvaluation {
  return {
    ability: value?.ability || '待评估能力',
    retestQuestion: value?.retestQuestion || '待评估复测任务',
    studentAnswer: value?.studentAnswer || '',
    abilityChange: normalizeAbilityChange(value?.abilityChange),
    comparison: value?.comparison || '暂无训练前后对比。',
    observation: value?.observation || '复测表现尚未形成可解释观察。',
    confidence: normalizeConfidence(value?.confidence),
  };
}

function isTrainingTaskEvaluation(value: unknown): value is TrainingTaskEvaluation {
  if (!value || typeof value !== 'object') return false;

  const evaluation = value as TrainingTaskEvaluation;
  return (
    typeof evaluation.ability === 'string' &&
    typeof evaluation.trainingTask === 'string' &&
    typeof evaluation.studentAnswer === 'string' &&
    ['not_improved', 'improving_not_stable', 'improved'].includes(evaluation.status) &&
    Array.isArray(evaluation.processFindings) &&
    evaluation.processFindings.length > 0 &&
    typeof evaluation.observation === 'string' &&
    typeof evaluation.confidence === 'number'
  );
}

function isRetestEvaluation(value: unknown): value is RetestEvaluation {
  if (!value || typeof value !== 'object') return false;

  const evaluation = value as RetestEvaluation;
  return (
    typeof evaluation.ability === 'string' &&
    typeof evaluation.retestQuestion === 'string' &&
    typeof evaluation.studentAnswer === 'string' &&
    ['-1', '0', '+1'].includes(evaluation.abilityChange) &&
    typeof evaluation.comparison === 'string' &&
    typeof evaluation.observation === 'string' &&
    typeof evaluation.confidence === 'number'
  );
}

function normalizeImprovementStatus(value: unknown): TrainingImprovementStatus {
  if (value === 'not_improved' || value === 'improving_not_stable' || value === 'improved') {
    return value;
  }

  return 'improving_not_stable';
}

function normalizeAbilityChange(value: unknown): AbilityChange {
  if (value === '-1' || value === '0' || value === '+1') return value;
  return '0';
}

function normalizeConfidence(value: unknown): number {
  return typeof value === 'number' ? Math.min(1, Math.max(0, value)) : 0.5;
}
