import type { CompletedPracticeSessionSummary } from '../practice/practiceSessionTypes.ts';
import type { PracticeAttempt } from '../response/practiceResponseTypes.ts';
import { buildPracticeResult } from '../result/buildPracticeResult.ts';
import type { PracticeCompletionRecord, PracticeCompletionRecordV1, PracticeCompletionRecordV2 } from './localPracticeStoreTypes.ts';

export function buildPracticeCompletionRecord(attempt: PracticeAttempt): PracticeCompletionRecordV2 {
  if (attempt.session.status !== 'completed' || !attempt.session.completedAt) {
    throw new Error('Only a completed practice attempt can produce a completion record.');
  }
  const baseResponses = attempt.responses.filter((response) => response.role === 'base');
  const correct = baseResponses.filter((response) => response.isCorrect).length;
  const reinforcementResponses = attempt.responses.filter((response) => response.role === 'reinforcement');
  const total = attempt.session.actualBaseQuestionCount;
  return {
    schemaVersion: 2,
    sessionId: attempt.session.id,
    completedAttempt: attempt,
    completedAt: attempt.session.completedAt,
    summary: {
      schemaVersion: 1,
      sessionId: attempt.session.id,
      mode: attempt.session.mode,
      ...(attempt.session.category ? { category: attempt.session.category } : {}),
      baseQuestionCount: total,
      firstAttemptCorrectCount: correct,
      firstAttemptAccuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      durationMs: baseResponses.reduce((sum, response) => sum + response.durationMs, 0),
      mistakeCount: total - correct,
      ...(reinforcementResponses.length > 0 ? {
        reinforcementQuestionCount: reinforcementResponses.length,
        reinforcementCorrectCount: reinforcementResponses.filter((response) => response.isCorrect).length,
        reinforcementDurationMs: reinforcementResponses.reduce((sum, response) => sum + response.durationMs, 0),
      } : {}),
      completedAt: attempt.session.completedAt,
    },
    result: buildPracticeResult({ completedAttempt: attempt }),
  };
}

export function upgradePracticeCompletionRecord(record: PracticeCompletionRecord): PracticeCompletionRecordV2 {
  if (record.schemaVersion === 2) return record;
  return {
    schemaVersion: 2,
    sessionId: record.sessionId,
    completedAttempt: record.completedAttempt,
    summary: record.summary,
    result: buildPracticeResult({ completedAttempt: record.completedAttempt }),
    completedAt: record.completedAt,
  };
}

export function isLegacyPracticeCompletionRecord(record: PracticeCompletionRecord | null): record is PracticeCompletionRecordV1 {
  return record?.schemaVersion === 1;
}

export function buildCompletedSessionSummary(attempt: PracticeAttempt): CompletedPracticeSessionSummary {
  if (!attempt.session.completedAt) throw new Error('Completed time is required.');
  return {
    sessionId: attempt.session.id,
    completedAt: attempt.session.completedAt,
    baseQuestionIds: [...attempt.session.baseQuestionIds],
  };
}
