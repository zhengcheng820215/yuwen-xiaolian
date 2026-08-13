import {
  QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION,
  type AnonymousQuestionCalibrationAttempt,
  type QuestionEmpiricalCalibrationReport,
} from '../schemas/questionEmpiricalCalibration.schema.ts';
import { buildStableId } from './reviewedResourceCandidateAdapter.ts';

export function calibrateQuestionFromAnonymousAttempts(input: {
  resourceVersionId: string;
  attempts: AnonymousQuestionCalibrationAttempt[];
  generatedAt: string;
  minimumSampleSize?: number;
}): QuestionEmpiricalCalibrationReport {
  const minimumSampleSize = input.minimumSampleSize ?? 30;
  const uniqueAttempts = new Map<string, AnonymousQuestionCalibrationAttempt>();
  for (const attempt of input.attempts) {
    if (
      attempt.resourceVersionId !== input.resourceVersionId
      || !attempt.valid
      || !Number.isFinite(attempt.itemScore)
      || !Number.isFinite(attempt.totalScore)
      || attempt.itemScore < 0
      || attempt.itemScore > 1
    ) continue;
    uniqueAttempts.set(attempt.attemptId, attempt);
  }
  const attempts = [...uniqueAttempts.values()];
  const base = {
    reportId: buildStableId('empirical-calibration-report', [
      input.resourceVersionId,
      input.generatedAt,
      String(attempts.length),
    ]),
    resourceVersionId: input.resourceVersionId,
    sampleSize: attempts.length,
    minimumSampleSize,
    generatedAt: input.generatedAt,
    schemaVersion: QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION,
  };
  if (attempts.length === 0) {
    return {
      ...base,
      status: 'awaiting_data',
      limitations: ['尚无真实有效作答样本，不生成难度或区分度结论。'],
    };
  }
  if (attempts.length < minimumSampleSize) {
    return {
      ...base,
      status: 'insufficient_sample',
      limitations: [`当前仅有 ${attempts.length} 份有效样本，至少需要 ${minimumSampleSize} 份才计算试运行指标。`],
    };
  }
  const meanItemScore = average(attempts.map((attempt) => attempt.itemScore));
  const ordered = [...attempts].sort((left, right) => right.totalScore - left.totalScore);
  const groupSize = Math.max(1, Math.floor(ordered.length * 0.27));
  const high = ordered.slice(0, groupSize);
  const low = ordered.slice(-groupSize);
  return {
    ...base,
    status: 'calibrated',
    meanItemScore: round(meanItemScore),
    highLowDiscrimination: round(
      average(high.map((attempt) => attempt.itemScore))
      - average(low.map((attempt) => attempt.itemScore)),
    ),
    limitations: ['当前指标来自首轮真实样本，只用于题目试运行治理，不等同于正式测量学标定。'],
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
