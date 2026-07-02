import type { DiagnosisResult } from './diagnosis.schema';

export type TrainingInput = {
  diagnosisResult: DiagnosisResult;
  question: string;
  studentAnswer: string;
};

export type TrainingResult = {
  targetAbility: string;
  rootCause: string;
  trainingGoal: string;
  trainingStrategy: string;
  trainingSteps: string[];
  practiceTasks: string[];
  coachGuidance: string[];
  completionCriteria: string[];
  nextEvaluation: string;
  confidence: number;
};

export const TRAINING_RESULT_FIELDS: Array<keyof TrainingResult> = [
  'targetAbility',
  'rootCause',
  'trainingGoal',
  'trainingStrategy',
  'trainingSteps',
  'practiceTasks',
  'coachGuidance',
  'completionCriteria',
  'nextEvaluation',
  'confidence',
];

export function normalizeTrainingResult(value: Partial<TrainingResult>): TrainingResult {
  const confidence = typeof value.confidence === 'number'
    ? Math.min(1, Math.max(0, value.confidence))
    : 0.5;

  return {
    targetAbility: value.targetAbility || '待训练能力',
    rootCause: value.rootCause || '需要依据诊断结果进一步确认训练根因',
    trainingGoal: value.trainingGoal || '形成更稳定、独立、可迁移的能力表现',
    trainingStrategy: value.trainingStrategy || '针对训练',
    trainingSteps: Array.isArray(value.trainingSteps) ? value.trainingSteps : [],
    practiceTasks: Array.isArray(value.practiceTasks) ? value.practiceTasks : [],
    coachGuidance: Array.isArray(value.coachGuidance) ? value.coachGuidance : [],
    completionCriteria: Array.isArray(value.completionCriteria) ? value.completionCriteria : [],
    nextEvaluation: value.nextEvaluation || '完成训练后进入同能力复测验证',
    confidence,
  };
}

export function isTrainingInput(value: unknown): value is TrainingInput {
  if (!value || typeof value !== 'object') return false;

  const input = value as TrainingInput;
  return (
    !!input.diagnosisResult &&
    typeof input.question === 'string' &&
    typeof input.studentAnswer === 'string'
  );
}
