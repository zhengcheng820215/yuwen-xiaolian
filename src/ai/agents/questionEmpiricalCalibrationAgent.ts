import {
  QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION,
  normalizeQuestionCalibrationAttempt,
  type AnonymousQuestionCalibrationAttempt,
  type QuestionCalibrationAttemptInput,
  type QuestionEmpiricalCalibrationReport,
} from '../schemas/questionEmpiricalCalibration.schema.ts';
import { buildStableId } from './reviewedResourceCandidateAdapter.ts';

export function calibrateQuestionFromAnonymousAttempts(input: {
  resourceVersionId: string;
  attempts: QuestionCalibrationAttemptInput[];
  generatedAt: string;
  minimumSampleSize?: number;
}): QuestionEmpiricalCalibrationReport {
  const minimumSampleSize = input.minimumSampleSize ?? 30;
  const uniqueAttempts = new Map<string, AnonymousQuestionCalibrationAttempt>();
  for (const candidate of input.attempts) {
    const attempt = normalizeQuestionCalibrationAttempt(candidate);
    if (
      !attempt
      ||
      attempt.resourceVersionId !== input.resourceVersionId
    ) continue;
    uniqueAttempts.set(attempt.attemptId, attempt);
  }
  const attempts = [...uniqueAttempts.values()];
  const independentSubjectCount = new Set(attempts.map((attempt) => attempt.subjectKey)).size;
  const base = {
    reportId: buildStableId('empirical-calibration-report', [
      input.resourceVersionId,
      input.generatedAt,
      String(attempts.length),
    ]),
    resourceVersionId: input.resourceVersionId,
    sampleSize: attempts.length,
    independentSubjectCount,
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
  if (independentSubjectCount < minimumSampleSize) {
    return {
      ...base,
      status: 'insufficient_sample',
      limitations: [`当前有 ${attempts.length} 份有效作答、${independentSubjectCount} 个独立使用者；至少需要 ${minimumSampleSize} 个独立使用者才计算试运行指标。`],
    };
  }
  const meanItemScore = average(attempts.map((attempt) => attempt.itemScore));
  const comparableGroups = comparableAttemptsByWindow(attempts)
    .filter((group) => new Set(group.map((attempt) => attempt.subjectKey)).size >= minimumSampleSize)
    .sort((left, right) => right.length - left.length);
  const report: QuestionEmpiricalCalibrationReport = {
    ...base,
    status: 'calibrated',
    meanItemScore: round(meanItemScore),
    limitations: comparableGroups.length > 0
      ? ['当前指标来自首轮真实样本，只用于题目试运行治理，不等同于正式测量学标定。']
      : ['当前缺少足量且属于同一可比评估窗口的 totalScore，仅计算平均题目得分，不计算高低组区分度。'],
  };
  const comparable = comparableGroups[0];
  if (comparable) {
    const ordered = [...comparable].sort((left, right) => (right.totalScore || 0) - (left.totalScore || 0));
    const groupSize = Math.max(1, Math.floor(ordered.length * 0.27));
    const high = ordered.slice(0, groupSize);
    const low = ordered.slice(-groupSize);
    report.highLowDiscrimination = round(
      average(high.map((attempt) => attempt.itemScore))
      - average(low.map((attempt) => attempt.itemScore)),
    );
  }
  return report;
}

function comparableAttemptsByWindow(
  attempts: AnonymousQuestionCalibrationAttempt[],
): AnonymousQuestionCalibrationAttempt[][] {
  const groups = new Map<string, AnonymousQuestionCalibrationAttempt[]>();
  for (const attempt of attempts) {
    if (
      attempt.totalScoreStatus !== 'available_comparable_window'
      || !Number.isFinite(attempt.totalScore)
      || !attempt.assessmentWindowId
    ) continue;
    const group = groups.get(attempt.assessmentWindowId) || [];
    group.push(attempt);
    groups.set(attempt.assessmentWindowId, group);
  }
  return [...groups.values()];
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
