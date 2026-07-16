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
  stage: 'seeded' | 'verified';
  reloadRequired: boolean;
  checks: BrowserSmokeCheck[];
};

const studentId = 'phase13-browser-smoke-student';
const reloadMarker = 'phase13-learning-session-browser-smoke-seeded';

export async function runLearningSessionHistoryBrowserSmoke(): Promise<LearningSessionHistoryBrowserSmokeReport> {
  if (sessionStorage.getItem(reloadMarker) !== 'true') {
    return seedBrowserSmokeData();
  }

  return verifyBrowserSmokeDataAfterReload();
}

async function seedBrowserSmokeData(): Promise<LearningSessionHistoryBrowserSmokeReport> {
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
  const unfinishedSession = buildUnfinishedSession();
  const incompatibleSession = {
    ...buildSession({
      sessionId: 'phase13-browser-session-incompatible',
      roundId: 'phase13-browser-round-incompatible',
      abilityId: '推理',
      startedAt: '2030-07-20T09:00:00.000Z',
      endedAt: '2030-07-20T09:30:00.000Z',
    }),
    schemaVersion: 'learning_session_history_v0',
  } as unknown as LearningSessionRecord;

  await saveLearningSessionRecord(writer, reasoningSession);
  await saveLearningSessionRecord(writer, expressionSession);
  await saveLearningSessionRecord(writer, unfinishedSession);
  await saveLearningSessionRecord(writer, reasoningSession);
  await writer.save(incompatibleSession);

  sessionStorage.setItem(reloadMarker, 'true');
  return {
    passed: false,
    stage: 'seeded',
    reloadRequired: true,
    checks: [
      check(true, '已写入 3 条正式 Session、1 条不兼容记录和 1 次幂等重复保存'),
    ],
  };
}

async function verifyBrowserSmokeDataAfterReload(): Promise<LearningSessionHistoryBrowserSmokeReport> {
  const reader = new IndexedDBLearningSessionRepository();

  try {
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
    const unfinishedHistory = buildLearningSessionHistoryResult(
      studentId,
      allCandidates,
      { studentId, hasUnfinishedRound: true },
    );
    const reasoningSession = allCandidates.find((session) => (
      session.sessionId === 'phase13-browser-session-reasoning'
    ));
    const expressionSession = allCandidates.find((session) => (
      session.sessionId === 'phase13-browser-session-expression'
    ));
    const unfinishedSession = allCandidates.find((session) => (
      session.sessionId === 'phase13-browser-session-unfinished'
    ));
    const reasoningRoundId = 'phase13-browser-round-reasoning';
    const roundOwner = await reader.findByRoundId(studentId, reasoningRoundId);

    const conflicting = buildSession({
      sessionId: 'phase13-browser-session-conflict',
      roundId: reasoningRoundId,
      abilityId: '推理',
      startedAt: '2026-07-17T09:00:00.000Z',
      endedAt: '2026-07-17T09:30:00.000Z',
    });
    const conflictError = await captureError(() => saveLearningSessionRecord(reader, conflicting));

    const checks: BrowserSmokeCheck[] = [
      check(history.total === 3, `刷新并重新创建 Repository 后正式 total=${history.total}`),
      check(history.rejectedTotal === 1, `不兼容记录 rejectedTotal=${history.rejectedTotal}`),
      check(history.sessions.every((session) => session.schemaVersion === 'learning_session_history_v1'), '正式 sessions 只包含兼容版本'),
      check(history.latestSessionId === unfinishedSession?.sessionId, `latestSessionId=${history.latestSessionId}`),
      check(history.latestLearningAt === unfinishedSession?.lastActivityAt, `latestLearningAt=${history.latestLearningAt}`),
      check(abilityHistory.total === 1 && abilityHistory.sessions[0]?.sessionId === expressionSession?.sessionId, `ability query total=${abilityHistory.total}`),
      check(timeHistory.total === 1 && timeHistory.sessions[0]?.sessionId === expressionSession?.sessionId, `time query total=${timeHistory.total}`),
      check(unfinishedHistory.total === 1 && unfinishedHistory.sessions[0]?.unfinishedRoundId === 'phase13-browser-round-unfinished', `unfinished query total=${unfinishedHistory.total}`),
      check(allCandidates.filter((session) => session.sessionId === reasoningSession?.sessionId).length === 1, '重复保存同一 Session 未产生重复记录'),
      check(roundOwner?.sessionId === reasoningSession?.sessionId, `roundOwner=${roundOwner?.sessionId || 'none'}`),
      check(conflictError.includes('already belongs to another session'), conflictError || 'round conflict not blocked'),
    ];

    await reader.clear(studentId);
    const afterClear = await new IndexedDBLearningSessionRepository().query({ studentId });
    checks.push(check(afterClear.length === 0, `clear 后 remaining=${afterClear.length}`));

    return {
      passed: checks.every((item) => item.passed),
      stage: 'verified',
      reloadRequired: false,
      checks,
    };
  } finally {
    sessionStorage.removeItem(reloadMarker);
    await reader.clear(studentId);
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

function buildUnfinishedSession(): LearningSessionRecord {
  return {
    sessionId: 'phase13-browser-session-unfinished',
    studentId,
    startedAt: '2026-07-17T09:00:00.000Z',
    lastActivityAt: '2026-07-17T09:15:00.000Z',
    timezone: 'Asia/Shanghai',
    learningRoundIds: ['phase13-browser-round-unfinished'],
    persistenceRecordIds: ['learning-state::phase13-browser-round-unfinished'],
    evidenceIds: [],
    primaryAbilityId: '推理',
    targetAbilityIds: ['推理'],
    status: 'in_progress',
    unfinishedRoundId: 'phase13-browser-round-unfinished',
    roundCount: 1,
    completedRoundCount: 0,
    schemaVersion: 'learning_session_history_v1',
    createdAt: '2026-07-17T09:00:00.000Z',
    updatedAt: '2026-07-17T09:15:00.000Z',
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
