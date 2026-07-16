import {
  buildLearningSessionHistoryResult,
  saveLearningSessionRecord,
} from '../agents/learningSessionHistoryAgent.ts';
import { IndexedDBLearningSessionRepository } from '../repositories/indexedDBLearningSessionRepository.ts';
import type { LearningSessionRecord } from '../schemas/learningSessionHistory.schema.ts';

export type BrowserSmokeCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type LearningSessionHistoryBrowserSmokeReport = {
  passed: boolean;
  checks: BrowserSmokeCheck[];
};

const studentId = 'phase13-browser-smoke-student';

export async function runLearningSessionHistoryBrowserSmoke(): Promise<LearningSessionHistoryBrowserSmokeReport> {
  const writer = new IndexedDBLearningSessionRepository();
  await writer.clear(studentId);

  const reasoningSession = buildSession({
    sessionId: 'phase13-browser-session-reasoning',
    roundId: 'phase13-browser-round-reasoning',
    abilityId: '推理',
    startedAt: '2026-07-15T09:00:00.000Z',
    endedAt: '2026-07-15T09:30:00.000Z',
  });
  const expressionSession = buildSession({
    sessionId: 'phase13-browser-session-expression',
    roundId: 'phase13-browser-round-expression',
    abilityId: '表达',
    startedAt: '2026-07-16T09:00:00.000Z',
    endedAt: '2026-07-16T09:30:00.000Z',
  });

  try {
    await saveLearningSessionRecord(writer, reasoningSession);
    await saveLearningSessionRecord(writer, expressionSession);
    await saveLearningSessionRecord(writer, reasoningSession);

    const reader = new IndexedDBLearningSessionRepository();
    const allCandidates = await reader.query({ studentId });
    const history = buildLearningSessionHistoryResult(studentId, allCandidates);
    const abilityHistory = buildLearningSessionHistoryResult(
      studentId,
      allCandidates,
      { studentId, abilityId: '表达' },
    );
    const timeHistory = buildLearningSessionHistoryResult(
      studentId,
      allCandidates,
      {
        studentId,
        startedFrom: '2026-07-16T00:00:00.000Z',
        startedTo: '2026-07-16T23:59:59.999Z',
      },
    );
    const roundOwner = await reader.findByRoundId(studentId, reasoningSession.learningRoundIds[0]);

    const conflicting = buildSession({
      sessionId: 'phase13-browser-session-conflict',
      roundId: reasoningSession.learningRoundIds[0],
      abilityId: '推理',
      startedAt: '2026-07-17T09:00:00.000Z',
      endedAt: '2026-07-17T09:30:00.000Z',
    });
    const conflictError = await captureError(() => saveLearningSessionRecord(reader, conflicting));

    const checks: BrowserSmokeCheck[] = [
      check(history.total === 2, `重新创建 Repository 后 total=${history.total}`),
      check(history.rejectedTotal === 0, `rejectedTotal=${history.rejectedTotal}`),
      check(history.latestSessionId === expressionSession.sessionId, `latestSessionId=${history.latestSessionId}`),
      check(history.latestLearningAt === expressionSession.lastActivityAt, `latestLearningAt=${history.latestLearningAt}`),
      check(abilityHistory.total === 1 && abilityHistory.sessions[0]?.sessionId === expressionSession.sessionId, `ability query total=${abilityHistory.total}`),
      check(timeHistory.total === 1 && timeHistory.sessions[0]?.sessionId === expressionSession.sessionId, `time query total=${timeHistory.total}`),
      check(roundOwner?.sessionId === reasoningSession.sessionId, `roundOwner=${roundOwner?.sessionId || 'none'}`),
      check(conflictError.includes('already belongs to another session'), conflictError || 'round conflict not blocked'),
    ];

    await reader.clear(studentId);
    const afterClear = await new IndexedDBLearningSessionRepository().query({ studentId });
    checks.push(check(afterClear.length === 0, `clear 后 remaining=${afterClear.length}`));

    return {
      passed: checks.every((item) => item.passed),
      checks,
    };
  } finally {
    await new IndexedDBLearningSessionRepository().clear(studentId);
  }
}

function buildSession(input: {
  sessionId: string;
  roundId: string;
  abilityId: string;
  startedAt: string;
  endedAt: string;
}): LearningSessionRecord {
  return {
    sessionId: input.sessionId,
    studentId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    lastActivityAt: input.endedAt,
    timezone: 'Asia/Shanghai',
    learningRoundIds: [input.roundId],
    persistenceRecordIds: [`learning-state::${studentId}::${input.roundId}`],
    evidenceIds: [`evidence-${input.roundId}`],
    primaryAbilityId: input.abilityId,
    targetAbilityIds: [input.abilityId],
    status: 'completed',
    endReason: 'student_finished',
    roundCount: 1,
    completedRoundCount: 1,
    schemaVersion: 'learning_session_history_v1',
    createdAt: input.startedAt,
    updatedAt: input.endedAt,
    validation: {
      passed: true,
      issues: [],
    },
  };
}

function check(passed: boolean, detail: string): BrowserSmokeCheck {
  return { name: detail.split('=')[0].trim(), passed, detail };
}

async function captureError(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
