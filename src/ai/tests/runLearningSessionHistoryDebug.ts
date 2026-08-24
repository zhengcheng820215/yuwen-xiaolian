import {
  appendLearningRoundToSession,
  buildLearningSessionHistoryResult,
  closeLearningSessionRecord,
  createLearningSessionRecord,
  queryLearningSessionHistory,
  saveLearningSessionRecord,
  validateLearningSessionRecord,
} from '../agents/learningSessionHistoryAgent.ts';
import { createLearningPersistenceRecord } from '../agents/learningPersistenceAgent.ts';
import { completeLearningRound } from '../agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import { buildStudentLearningFeedback } from '../agents/studentFeedbackAdapter.ts';
import { buildStudentLearningEntryState } from '../agents/studentLearningEntryAgent.ts';
import { buildStudentRoundSummary } from '../agents/studentRoundSummaryAdapter.ts';
import { InMemoryLearningSessionRepository } from '../repositories/inMemoryLearningSessionRepository.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { LearningSessionRecord } from '../schemas/learningSessionHistory.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83StudentId,
} from './nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from './taskFulfillmentDebugFixtures.ts';

type CaseReport = {
  name: string;
  passed: boolean;
  details: string[];
  failReasons: string[];
};

type DebugCase = {
  name: string;
  run: () => Promise<CaseReport>;
};

const studentId = phase83StudentId;
const session1Start = '2026-07-13T09:00:00.000Z';
const session1End = '2026-07-13T09:35:00.000Z';
const session2Start = '2026-07-14T10:00:00.000Z';

const round1 = buildCompletedPersistenceRecord(
  'phase13-session1-round1',
  '2026-07-13T09:10:00.000Z',
  '父亲看到旧书和树叶后想起以前与孩子读书的时光，因此感到怀念和不舍。',
);
const round2 = buildCompletedPersistenceRecord(
  'phase13-session1-round2',
  '2026-07-13T09:30:00.000Z',
  '父亲反复整理旧书并看着夹在书里的树叶停了很久，说明这件旧物唤起了他和孩子共同读书的回忆，也表现出他的怀念与不舍。',
);
const unfinishedExpressionRound = buildUnfinishedPersistenceRecord(
  'phase13-session2-round1',
  '表达',
  session2Start,
);

const cases: DebugCase[] = [
  {
    name: 'Case 1 单 Session 多 Round：roundCount = 2',
    run: async () => {
      const session = buildCompletedSession1();
      return reportFromChecks('Case 1 单 Session 多 Round：roundCount = 2', [
        check(session.roundCount === 2, `roundCount=${session.roundCount}`),
        check(session.completedRoundCount === 2, `completedRoundCount=${session.completedRoundCount}`),
        check(session.learningRoundIds.length === 2, `roundIds=${session.learningRoundIds.join(', ')}`),
        check(session.evidenceIds.length === 2, `evidenceIds=${session.evidenceIds.join(', ')}`),
      ]);
    },
  },
  {
    name: 'Case 2 多 Session 跨天：同一学生返回两个 Session',
    run: async () => {
      const repository = await buildTwoSessionRepository();
      const history = await queryLearningSessionHistory(repository, { studentId });
      return reportFromChecks('Case 2 多 Session 跨天：同一学生返回两个 Session', [
        check(history.validation.passed, history.validation.issues.join('; ') || 'history valid'),
        check(history.total === 2, `total=${history.total}`),
        check(history.sessions[0]?.sessionId === 'phase13-session-2', `latest=${history.sessions[0]?.sessionId}`),
      ]);
    },
  },
  {
    name: 'Case 3 按能力查询：只返回表达 Session',
    run: async () => {
      const repository = await buildTwoSessionRepository();
      const history = await queryLearningSessionHistory(repository, { studentId, abilityId: '表达' });
      return reportFromChecks('Case 3 按能力查询：只返回表达 Session', [
        check(history.total === 1, `total=${history.total}`),
        check(history.sessions[0]?.sessionId === 'phase13-session-2', `session=${history.sessions[0]?.sessionId}`),
        check(history.sessions[0]?.targetAbilityIds.includes('表达') === true, `abilities=${history.sessions[0]?.targetAbilityIds.join(', ')}`),
      ]);
    },
  },
  {
    name: 'Case 4 按时间查询：第二天只返回 Session 2',
    run: async () => {
      const repository = await buildTwoSessionRepository();
      const history = await queryLearningSessionHistory(repository, {
        studentId,
        startedFrom: '2026-07-14T00:00:00.000Z',
        startedTo: '2026-07-14T23:59:59.999Z',
      });
      return reportFromChecks('Case 4 按时间查询：第二天只返回 Session 2', [
        check(history.total === 1, `total=${history.total}`),
        check(history.sessions[0]?.sessionId === 'phase13-session-2', `session=${history.sessions[0]?.sessionId}`),
      ]);
    },
  },
  {
    name: 'Case 5 未完成回合：可查询且不生成能力结论',
    run: async () => {
      const repository = await buildTwoSessionRepository();
      const history = await queryLearningSessionHistory(repository, { studentId, hasUnfinishedRound: true });
      const session = history.sessions[0];
      return reportFromChecks('Case 5 未完成回合：可查询且不生成能力结论', [
        check(history.total === 1, `total=${history.total}`),
        check(session?.unfinishedRoundId === unfinishedExpressionRound.learningRoundId, `unfinishedRoundId=${session?.unfinishedRoundId}`),
        check(session?.evidenceIds.length === 0, `evidenceCount=${session?.evidenceIds.length}`),
        check(session?.status === 'in_progress', `status=${session?.status}`),
      ]);
    },
  },
  {
    name: 'Case 6 最近学习时间：来自最新正式活动',
    run: async () => {
      const repository = await buildTwoSessionRepository();
      const history = await queryLearningSessionHistory(repository, { studentId });
      return reportFromChecks('Case 6 最近学习时间：来自最新正式活动', [
        check(history.latestSessionId === 'phase13-session-2', `latestSessionId=${history.latestSessionId}`),
        check(history.latestLearningAt === session2Start, `latestLearningAt=${history.latestLearningAt}`),
      ]);
    },
  },
  {
    name: 'Case 7 重复追加 Round：正式计数保持幂等',
    run: async () => {
      let session = createLearningSessionRecord({
        sessionId: 'phase13-idempotent-session',
        studentId,
        startedAt: session1Start,
        timezone: 'Asia/Shanghai',
      });
      session = appendLearningRoundToSession(session, { persistenceRecord: round1 });
      const first = session;
      session = appendLearningRoundToSession(session, { persistenceRecord: round1 });
      return reportFromChecks('Case 7 重复追加 Round：正式计数保持幂等', [
        check(session.roundCount === first.roundCount, `roundCount=${session.roundCount}`),
        check(session.completedRoundCount === first.completedRoundCount, `completedRoundCount=${session.completedRoundCount}`),
        check(session.evidenceIds.length === first.evidenceIds.length, `evidenceCount=${session.evidenceIds.length}`),
        check(session.persistenceRecordIds.length === first.persistenceRecordIds.length, `persistenceCount=${session.persistenceRecordIds.length}`),
      ]);
    },
  },
  {
    name: 'Case 8 Round 跨 Session 冲突：Repository 阻断',
    run: async () => {
      const repository = new InMemoryLearningSessionRepository();
      let session1 = createLearningSessionRecord({
        sessionId: 'phase13-owner-session',
        studentId,
        startedAt: session1Start,
        timezone: 'Asia/Shanghai',
      });
      session1 = appendLearningRoundToSession(session1, { persistenceRecord: round1 });
      await saveLearningSessionRecord(repository, session1);

      let session2 = createLearningSessionRecord({
        sessionId: 'phase13-conflict-session',
        studentId,
        startedAt: session2Start,
        timezone: 'Asia/Shanghai',
      });
      session2 = appendLearningRoundToSession(session2, { persistenceRecord: round1 });

      const error = await captureError(() => saveLearningSessionRecord(repository, session2));
      return reportFromChecks('Case 8 Round 跨 Session 冲突：Repository 阻断', [
        check(error.includes('already belongs to another session'), error || 'no error'),
      ]);
    },
  },
  {
    name: 'Case 9 studentId 不一致：阻断追加',
    run: async () => {
      const session = createLearningSessionRecord({
        sessionId: 'phase13-identity-session',
        studentId,
        startedAt: session1Start,
        timezone: 'Asia/Shanghai',
      });
      const mismatched: LearningPersistenceRecord = {
        ...round1,
        studentId: 'other-student',
      };
      const error = captureSyncError(() => appendLearningRoundToSession(session, { persistenceRecord: mismatched }));
      return reportFromChecks('Case 9 studentId 不一致：阻断追加', [
        check(error.includes('studentId mismatch'), error || 'no error'),
      ]);
    },
  },
  {
    name: 'Case 10 completed 缺少结束信息：validation FAIL',
    run: async () => {
      const completed = buildCompletedSession1();
      const corrupted: LearningSessionRecord = {
        ...completed,
        endedAt: undefined,
        endReason: undefined,
        validation: { passed: true, issues: [] },
      };
      const issues = validateLearningSessionRecord(corrupted);
      return reportFromChecks('Case 10 completed 缺少结束信息：validation FAIL', [
        check(issues.some((issue) => issue.includes('requires endedAt and endReason')), issues.join('; ')),
      ]);
    },
  },
  {
    name: 'Case 11 版本不兼容：不读取为正常记录',
    run: async () => {
      const incompatible = {
        ...buildCompletedSession1(),
        schemaVersion: 'learning_session_history_v0',
      } as unknown as LearningSessionRecord;
      const history = buildLearningSessionHistoryResult(studentId, [incompatible]);
      return reportFromChecks('Case 11 版本不兼容：不读取为正常记录', [
        check(!history.validation.passed, `passed=${history.validation.passed}`),
        check(history.validation.issues.some((issue) => issue.includes('schemaVersion')), history.validation.issues.join('; ')),
        check(history.sessions.length === 0, `accepted=${history.sessions.length}`),
        check(history.rejectedTotal === 1, `rejected=${history.rejectedTotal}`),
        check(history.latestLearningAt === undefined, `latestLearningAt=${history.latestLearningAt || 'none'}`),
      ]);
    },
  },
  {
    name: 'Case 12 max_rounds_reached：只表示流程结束',
    run: async () => {
      const session = buildCompletedSession1();
      const serialized = JSON.stringify(session);
      return reportFromChecks('Case 12 max_rounds_reached：只表示流程结束', [
        check(session.endReason === 'max_rounds_reached', `endReason=${session.endReason}`),
        check(!serialized.includes('mastered'), 'no mastered field'),
        check(!serialized.includes('能力已经提升'), 'no improvement conclusion'),
      ]);
    },
  },
  {
    name: 'Case 13 无效最新记录：不影响正式查询和 latestLearningAt',
    run: async () => {
      const valid = buildCompletedSession1();
      const invalid = {
        ...valid,
        sessionId: 'phase13-invalid-latest-session',
        startedAt: '2026-07-20T09:00:00.000Z',
        lastActivityAt: '2026-07-20T09:30:00.000Z',
        endedAt: '2026-07-20T09:35:00.000Z',
        schemaVersion: 'learning_session_history_v0',
      } as unknown as LearningSessionRecord;
      const history = buildLearningSessionHistoryResult(
        studentId,
        [invalid, valid],
        { studentId, limit: 1 },
        '2026-07-20T10:00:00.000Z',
      );
      return reportFromChecks('Case 13 无效最新记录：不影响正式查询和 latestLearningAt', [
        check(history.sessions.length === 1, `accepted=${history.sessions.length}`),
        check(history.sessions[0]?.sessionId === valid.sessionId, `acceptedSession=${history.sessions[0]?.sessionId}`),
        check(history.rejectedTotal === 1, `rejected=${history.rejectedTotal}`),
        check(history.latestLearningAt === valid.lastActivityAt, `latestLearningAt=${history.latestLearningAt}`),
      ]);
    },
  },
  {
    name: 'Case 14 completed 含未完成 Round：校验失败且拒绝保存',
    run: async () => {
      let session = createLearningSessionRecord({
        sessionId: 'phase13-invalid-completed-session',
        studentId,
        startedAt: session2Start,
        timezone: 'Asia/Shanghai',
      });
      session = appendLearningRoundToSession(session, { persistenceRecord: unfinishedExpressionRound });
      const invalidCompleted = closeLearningSessionRecord(session, {
        status: 'completed',
        endReason: 'student_finished',
        endedAt: '2026-07-14T10:20:00.000Z',
      });
      const repository = new InMemoryLearningSessionRepository();
      const saveError = await captureError(() => saveLearningSessionRecord(repository, invalidCompleted));
      return reportFromChecks('Case 14 completed 含未完成 Round：校验失败且拒绝保存', [
        check(!invalidCompleted.validation.passed, invalidCompleted.validation.issues.join('; ')),
        check(invalidCompleted.validation.issues.some((issue) => issue.includes('unfinishedRoundId')), invalidCompleted.validation.issues.join('; ')),
        check(invalidCompleted.validation.issues.some((issue) => issue.includes('completedRoundCount')), invalidCompleted.validation.issues.join('; ')),
        check(saveError.includes('Completed session'), saveError || 'no error'),
      ]);
    },
  },
  {
    name: 'Case 15 Evidence / Round / Trace 身份错位：全部阻断',
    run: async () => {
      const evidenceReturn = round1.learningRoundResult?.taskEvidenceReturnResult;
      if (!round1.learningRoundResult || !evidenceReturn) throw new Error('Missing formal evidence fixture.');

      const evidenceStudentMismatch: LearningPersistenceRecord = {
        ...round1,
        learningRoundResult: {
          ...round1.learningRoundResult,
          taskEvidenceReturnResult: {
            ...evidenceReturn,
            abilityEvidence: evidenceReturn.abilityEvidence.map((evidence, index) => (
              index === 0 ? { ...evidence, studentId: 'other-student' } : evidence
            )),
          },
        },
      };
      const evidenceTaskMismatch: LearningPersistenceRecord = {
        ...round1,
        learningRoundResult: {
          ...round1.learningRoundResult,
          taskEvidenceReturnResult: {
            ...evidenceReturn,
            abilityEvidence: evidenceReturn.abilityEvidence.map((evidence, index) => (
              index === 0 ? { ...evidence, taskId: 'other-task' } : evidence
            )),
          },
        },
      };
      const roundMismatch: LearningPersistenceRecord = {
        ...round1,
        learningRoundResult: {
          ...round1.learningRoundResult,
          learningRoundId: 'other-round',
        },
      };
      const traceMismatch: LearningPersistenceRecord = {
        ...round1,
        learningRoundResult: {
          ...round1.learningRoundResult,
          taskEvidenceReturnResult: {
            ...evidenceReturn,
            evidenceTraceLinks: evidenceReturn.evidenceTraceLinks.map((trace, index) => (
              index === 0 ? { ...trace, responseId: 'other-response' } : trace
            )),
          },
        },
      };

      const errors = [
        captureAppendError(evidenceStudentMismatch),
        captureAppendError(evidenceTaskMismatch),
        captureAppendError(roundMismatch),
        captureAppendError(traceMismatch),
      ];
      return reportFromChecks('Case 15 Evidence / Round / Trace 身份错位：全部阻断', [
        check(errors[0].includes('AbilityEvidence.studentId mismatch'), errors[0] || 'student mismatch not blocked'),
        check(errors[1].includes('AbilityEvidence.taskId mismatch'), errors[1] || 'task mismatch not blocked'),
        check(errors[2].includes('learningRoundId does not match'), errors[2] || 'round mismatch not blocked'),
        check(errors[3].includes('TaskEvidenceTraceLink.responseId'), errors[3] || 'trace mismatch not blocked'),
      ]);
    },
  },
];

const reports: CaseReport[] = [];
for (const debugCase of cases) reports.push(await debugCase.run());

printReport(reports);

if (reports.some((report) => !report.passed)) {
  console.error('[FAIL] Phase 13.1 Learning Session History debug failed.');
  process.exit(1);
}

console.log('[PASS] Phase 13.1 Learning Session History debug passed.');

async function buildTwoSessionRepository(): Promise<InMemoryLearningSessionRepository> {
  const repository = new InMemoryLearningSessionRepository();
  await saveLearningSessionRecord(repository, buildCompletedSession1());

  let session2 = createLearningSessionRecord({
    sessionId: 'phase13-session-2',
    studentId,
    startedAt: session2Start,
    timezone: 'Asia/Shanghai',
    primaryAbilityId: '表达',
  });
  session2 = appendLearningRoundToSession(session2, {
    persistenceRecord: unfinishedExpressionRound,
    activityAt: session2Start,
  });
  await saveLearningSessionRecord(repository, session2);
  return repository;
}

function buildCompletedSession1(): LearningSessionRecord {
  let session = createLearningSessionRecord({
    sessionId: 'phase13-session-1',
    studentId,
    startedAt: session1Start,
    timezone: 'Asia/Shanghai',
    primaryAbilityId: '推理',
  });
  session = appendLearningRoundToSession(session, { persistenceRecord: round1 });
  session = appendLearningRoundToSession(session, { persistenceRecord: round2 });
  return closeLearningSessionRecord(session, {
    status: 'completed',
    endReason: 'max_rounds_reached',
    endedAt: session1End,
  });
}

function buildCompletedPersistenceRecord(
  learningRoundId: string,
  createdAt: string,
  answerText: string,
): LearningPersistenceRecord {
  const startResult = startLearningRound({
    studentAbilityProfile: buildStudentAbilityProfileFixture(),
    growthMemorySummary: buildGrowthMemorySummaryFixture('retest_pending'),
    currentLearningContext: buildCurrentLearningContextFixture({
      currentPhase: 'retest',
      targetAbilityId: '推理',
      allowRetest: true,
    }),
    availableTaskResources: buildMockTaskResources(),
    learningRoundId,
    createdAt,
  });

  if (!startResult.concreteTask) throw new Error(`Missing concrete task for ${learningRoundId}.`);

  const entryState = buildStudentLearningEntryState({ startResult, answerDraft: answerText });
  const execution = executeLearningRound({ startResult, studentAnswer: { answerText } });
  const roundResult = completeLearningRound({
    executionResult: execution,
    concreteTask: startResult.concreteTask,
    diagnosisResult: buildDiagnosisResult('推理'),
    completedAt: createdAt,
  });
  if (roundResult.status !== 'completed') {
    throw new Error(
      `Completed-session fixture ${learningRoundId} produced ${roundResult.status}: ${roundResult.issues.join('; ')}`,
    );
  }
  const feedback = buildStudentLearningFeedback({ entryState, learningRoundResult: roundResult });
  const summary = buildStudentRoundSummary({
    learningRoundResult: roundResult,
    studentLearningFeedback: feedback,
    studentLearningEntryState: entryState,
  });

  return createLearningPersistenceRecord({
    studentId,
    learningRoundId,
    learningRoundResult: roundResult,
    concreteTask: startResult.concreteTask,
    studentResponse: execution.studentResponse,
    studentLearningFeedback: feedback,
    studentRoundSummary: summary,
    growthMemoryRecord: roundResult.taskEvidenceReturnResult?.growthMemoryRecord,
    studentAbilityProfile: buildStudentAbilityProfileFixture(),
    savedAt: createdAt,
    updatedAt: createdAt,
  });
}

function buildUnfinishedPersistenceRecord(
  learningRoundId: string,
  targetAbilityId: string,
  createdAt: string,
): LearningPersistenceRecord {
  const concreteTask = {
    ...round1.concreteTask!,
    taskId: `${learningRoundId}-task`,
    targetAbilityId,
  };

  return createLearningPersistenceRecord({
    studentId,
    learningRoundId,
    concreteTask,
    answerDraft: '正在整理这一轮的回答。',
    savedAt: createdAt,
    updatedAt: createdAt,
  });
}

function buildDiagnosisResult(mainAbility: string): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'phase13_1_mock_diagnosis',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    rubricItems: [],
    matchedRubricItems: ['文本线索', '心理推断'],
    missingRubricItems: [],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: '本次作答能够回应任务要求。',
    rootCause: '学生能够从文本线索推出人物心理。',
    errorType: '待验证',
    abilityEvidence: ['学生能够结合文本线索说明人物心理。'],
    diagnosisSummary: '本次作答满足当前推理任务要求。',
    nextTraining: '等待下一步学习安排。',
    confidence: 0.82,
  };
}

function check(passed: boolean, detail: string): { passed: boolean; detail: string } {
  return { passed, detail };
}

function reportFromChecks(
  name: string,
  checks: Array<{ passed: boolean; detail: string }>,
): CaseReport {
  return {
    name,
    passed: checks.every((item) => item.passed),
    details: checks.map((item) => item.detail),
    failReasons: checks.filter((item) => !item.passed).map((item) => item.detail),
  };
}

async function captureError(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function captureSyncError(action: () => unknown): string {
  try {
    action();
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function captureAppendError(persistenceRecord: LearningPersistenceRecord): string {
  const session = createLearningSessionRecord({
    sessionId: `phase13-trace-check-${persistenceRecord.learningRoundId}`,
    studentId,
    startedAt: session1Start,
    timezone: 'Asia/Shanghai',
  });
  return captureSyncError(() => appendLearningRoundToSession(session, { persistenceRecord }));
}

function printReport(reports: CaseReport[]): void {
  console.log('Phase 13.1 Learning Session History Debug Report');
  console.log('================================================');
  console.log(`total: ${reports.length}`);
  console.log(`pass: ${reports.filter((report) => report.passed).length}`);
  console.log(`fail: ${reports.filter((report) => !report.passed).length}`);
  console.log('');

  for (const report of reports) {
    console.log(`${report.passed ? '[PASS]' : '[FAIL]'} ${report.name}`);
    for (const detail of report.details) console.log(`  ${detail}`);
    for (const reason of report.failReasons) console.log(`  issue: ${reason}`);
  }
  console.log('');
}
