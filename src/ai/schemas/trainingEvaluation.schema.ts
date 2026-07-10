import type { AbilityEvidence } from './abilityEvidence.schema.ts';

export type TrainingImprovementStatus =
  | 'not_improved'
  | 'improving_not_stable'
  | 'improved';

export type AbilityChange = '-1' | '0' | '+1';

export type AbilityChangeSignal =
  | 'improved'
  | 'unchanged'
  | 'declined'
  | 'insufficient_data';

export type TransferLevel =
  | 'none'
  | 'partial'
  | 'successful';

export type TrainingEvidenceLoopInput = {
  studentId: string;
  ability: string;
  weakness: string;
  trainingFocus: string;
  targetSkill?: string;
  dayTask: string;
  studentTrainingAnswer: string;
  retestQuestion: string;
  studentRetestAnswer: string;
  previousEvidence: AbilityEvidence[];
  createdAt?: string;
};

export type TrainingTaskEvaluation = {
  ability: string;
  targetSkill: string;
  trainingTask: string;
  studentAnswer: string;
  status: TrainingImprovementStatus;
  processFindings: string[];
  observation: string;
  confidence: number;
};

export type RetestEvaluation = {
  ability: string;
  targetSkill: string;
  retestQuestion: string;
  studentAnswer: string;
  abilityChange: AbilityChange;
  abilityChangeSignal: AbilityChangeSignal;
  transferLevel: TransferLevel;
  comparison: string;
  observation: string;
  confidence: number;
};

export type AbilityChangeSummary = {
  ability: string;
  before: {
    weaknessCount: number;
    positiveCount: number;
    growthCount: number;
  };
  after: {
    weaknessCount: number;
    positiveCount: number;
    growthCount: number;
  };
  change: AbilityChangeSignal;
  reason: string;
};

export type TrainingEvidenceLoopResult = {
  studentId: string;
  ability: string;
  originalWeakness: string;
  trainingFocus: string;
  targetSkill: string;
  trainingEvaluation: TrainingTaskEvaluation;
  retestEvaluation: RetestEvaluation;
  abilityChange: AbilityChangeSummary;
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
    targetSkill: value.targetSkill || '待验证目标技能',
    trainingEvaluation: normalizeTrainingTaskEvaluation(value.trainingEvaluation),
    retestEvaluation: normalizeRetestEvaluation(value.retestEvaluation),
    abilityChange: normalizeAbilityChangeSummary(value.abilityChange, value.ability),
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
    typeof result.targetSkill === 'string' &&
    result.targetSkill.trim().length > 0 &&
    isTrainingTaskEvaluation(result.trainingEvaluation) &&
    isRetestEvaluation(result.retestEvaluation) &&
    isAbilityChangeSummary(result.abilityChange) &&
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
    targetSkill: value?.targetSkill || '待验证目标技能',
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
    targetSkill: value?.targetSkill || '待验证目标技能',
    retestQuestion: value?.retestQuestion || '待评估复测任务',
    studentAnswer: value?.studentAnswer || '',
    abilityChange: normalizeAbilityChange(value?.abilityChange),
    abilityChangeSignal: normalizeAbilityChangeSignal(value?.abilityChangeSignal),
    transferLevel: normalizeTransferLevel(value?.transferLevel),
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
    typeof evaluation.targetSkill === 'string' &&
    evaluation.targetSkill.trim().length > 0 &&
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
    typeof evaluation.targetSkill === 'string' &&
    evaluation.targetSkill.trim().length > 0 &&
    typeof evaluation.retestQuestion === 'string' &&
    typeof evaluation.studentAnswer === 'string' &&
    ['-1', '0', '+1'].includes(evaluation.abilityChange) &&
    ['improved', 'unchanged', 'declined', 'insufficient_data'].includes(evaluation.abilityChangeSignal) &&
    ['none', 'partial', 'successful'].includes(evaluation.transferLevel) &&
    typeof evaluation.comparison === 'string' &&
    typeof evaluation.observation === 'string' &&
    typeof evaluation.confidence === 'number'
  );
}

function normalizeAbilityChangeSummary(
  value: Partial<AbilityChangeSummary> | undefined,
  fallbackAbility: unknown,
): AbilityChangeSummary {
  return {
    ability: value?.ability || (typeof fallbackAbility === 'string' ? fallbackAbility : '待评估能力'),
    before: normalizeChangeCounts(value?.before),
    after: normalizeChangeCounts(value?.after),
    change: normalizeAbilityChangeSignal(value?.change),
    reason: value?.reason || '训练与复测证据尚不足以形成稳定能力变化判断。',
  };
}

function isAbilityChangeSummary(value: unknown): value is AbilityChangeSummary {
  if (!value || typeof value !== 'object') return false;

  const summary = value as AbilityChangeSummary;
  return (
    typeof summary.ability === 'string' &&
    summary.ability.trim().length > 0 &&
    isChangeCounts(summary.before) &&
    isChangeCounts(summary.after) &&
    ['improved', 'unchanged', 'declined', 'insufficient_data'].includes(summary.change) &&
    typeof summary.reason === 'string' &&
    summary.reason.trim().length > 0
  );
}

function normalizeChangeCounts(value: AbilityChangeSummary['before'] | undefined): AbilityChangeSummary['before'] {
  return {
    weaknessCount: normalizeCount(value?.weaknessCount),
    positiveCount: normalizeCount(value?.positiveCount),
    growthCount: normalizeCount(value?.growthCount),
  };
}

function isChangeCounts(value: unknown): value is AbilityChangeSummary['before'] {
  if (!value || typeof value !== 'object') return false;
  const counts = value as AbilityChangeSummary['before'];
  return (
    typeof counts.weaknessCount === 'number' &&
    typeof counts.positiveCount === 'number' &&
    typeof counts.growthCount === 'number'
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

function normalizeAbilityChangeSignal(value: unknown): AbilityChangeSignal {
  if (
    value === 'improved' ||
    value === 'unchanged' ||
    value === 'declined' ||
    value === 'insufficient_data'
  ) {
    return value;
  }

  return 'insufficient_data';
}

function normalizeTransferLevel(value: unknown): TransferLevel {
  if (value === 'none' || value === 'partial' || value === 'successful') return value;
  return 'none';
}

function normalizeConfidence(value: unknown): number {
  return typeof value === 'number' ? Math.min(1, Math.max(0, value)) : 0.5;
}

function normalizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}
