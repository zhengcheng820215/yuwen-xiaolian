import {
  createLearningPersistenceRecord,
  restoreLearningState,
  saveLearningPersistenceRecord,
} from '../agents/learningPersistenceAgent.ts';
import { completeLearningRound } from '../agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import { buildStudentLearningFeedback } from '../agents/studentFeedbackAdapter.ts';
import { buildStudentLearningEntryState } from '../agents/studentLearningEntryAgent.ts';
import { buildStudentRoundSummary } from '../agents/studentRoundSummaryAdapter.ts';
import { InMemoryLearningPersistenceRepository } from '../repositories/inMemoryLearningPersistenceRepository.ts';
import type { LearningPersistenceRecord, RestoredLearningState } from '../schemas/learningPersistence.schema.ts';
import { isRestoredLearningState } from '../schemas/learningPersistence.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
  phase83StudentId,
} from './nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  name: string;
  run: () => Promise<CaseReport>;
};

type CaseReport = {
  name: string;
  recordId?: string;
  studentId?: string;
  learningRoundId?: string;
  status?: string;
  resumeMode?: string;
  canResume?: boolean;
  hasLearningRoundResult?: boolean;
  hasStudentLearningFeedback?: boolean;
  hasStudentRoundSummary?: boolean;
  hasGrowthMemorySummary?: boolean;
  validationIssues: string[];
  passed: boolean;
  failReasons: string[];
};

const readyStartResult = startLearningRound({
  studentAbilityProfile: buildStudentAbilityProfileFixture(),
  growthMemorySummary: buildGrowthMemorySummaryFixture('retest_pending'),
  currentLearningContext: buildCurrentLearningContextFixture({
    currentPhase: 'retest',
    targetAbilityId: '推理',
    allowRetest: true,
  }),
  availableTaskResources: buildMockTaskResources(),
  learningRoundId: 'learning-persistence-debug-round',
  createdAt: phase83RunAt,
});

if (!readyStartResult.concreteTask) {
  throw new Error('Phase 12.1 debug fixture failed: missing concreteTask.');
}

const entryState = buildStudentLearningEntryState({
  startResult: readyStartResult,
  answerDraft: '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。',
});

const validExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: {
    answerText: '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。',
  },
});

const completedRound = completeLearningRound({
  executionResult: validExecution,
  concreteTask: readyStartResult.concreteTask,
  diagnosisResult: buildDiagnosisResult('推理', 'fully_meets'),
  completedAt: '2026-07-14T12:00:00.000Z',
});

const completedFeedback = buildStudentLearningFeedback({
  entryState,
  learningRoundResult: completedRound,
});

const completedSummary = buildStudentRoundSummary({
  learningRoundResult: completedRound,
  studentLearningFeedback: completedFeedback,
  studentLearningEntryState: entryState,
});

const growthMemorySummary = buildGrowthMemorySummaryFixture('status_improving');
const studentProfile = buildStudentAbilityProfileFixture();

const cases: DebugCase[] = [
  {
    name: 'Case 1 已完成回合保存：save 成功',
    run: async () => {
      const repository = new InMemoryLearningPersistenceRepository();
      const saved = await saveLearningPersistenceRecord(repository, buildCompletedInput(false));
      const restored = restoreLearningState(saved, phase83StudentId);

      return validateReport('Case 1 已完成回合保存：save 成功', restored, {
        expectedRecordStatus: 'restore_ready',
        expectedResumeMode: 'view_completed_round',
      });
    },
  },
  {
    name: 'Case 2 刷新后恢复完成页：view_completed_round',
    run: async () => {
      const repository = new InMemoryLearningPersistenceRepository();
      await saveLearningPersistenceRecord(repository, buildCompletedInput(false));
      const restored = await repository.loadLatest(phase83StudentId).then((record) => restoreLearningState(record, phase83StudentId));

      return validateReport('Case 2 刷新后恢复完成页：view_completed_round', restored, {
        expectedResumeMode: 'view_completed_round',
      });
    },
  },
  {
    name: 'Case 3 任务页刷新：恢复同一个 learningRoundId',
    run: async () => {
      const repository = new InMemoryLearningPersistenceRepository();
      await saveLearningPersistenceRecord(repository, {
        studentId: phase83StudentId,
        learningRoundId: readyStartResult.learningRoundId,
        concreteTask: readyStartResult.concreteTask,
        studentAbilityProfile: studentProfile,
      });
      const restored = await repository.loadLatest(phase83StudentId).then((record) => restoreLearningState(record, phase83StudentId));

      return validateReport('Case 3 任务页刷新：恢复同一个 learningRoundId', restored, {
        expectedResumeMode: 'continue_unfinished_round',
        expectedLearningRoundId: readyStartResult.learningRoundId,
      });
    },
  },
  {
    name: 'Case 4 答案草稿恢复：草稿不等于正式 StudentResponse',
    run: async () => {
      const repository = new InMemoryLearningPersistenceRepository();
      await saveLearningPersistenceRecord(repository, {
        studentId: phase83StudentId,
        learningRoundId: readyStartResult.learningRoundId,
        concreteTask: readyStartResult.concreteTask,
        answerDraft: '父亲很怀念过去。',
      });
      const record = await repository.loadLatest(phase83StudentId);
      const restored = restoreLearningState(record, phase83StudentId);
      const report = validateReport('Case 4 答案草稿恢复：草稿不等于正式 StudentResponse', restored, {
        expectedResumeMode: 'continue_unfinished_round',
      });
      if (record?.studentResponse) report.failReasons.push('Answer draft should not be saved as formal StudentResponse.');
      report.passed = report.failReasons.length === 0;
      return report;
    },
  },
  {
    name: 'Case 5 可进入下一轮：start_next_round',
    run: async () => {
      const repository = new InMemoryLearningPersistenceRepository();
      await saveLearningPersistenceRecord(repository, buildCompletedInput(true));
      const restored = await repository.loadLatest(phase83StudentId).then((record) => restoreLearningState(record, phase83StudentId));

      return validateReport('Case 5 可进入下一轮：start_next_round', restored, {
        expectedResumeMode: 'start_next_round',
      });
    },
  },
  {
    name: 'Case 6 已完成回合恢复：不重新运行 Diagnosis，不重复 Evidence',
    run: async () => {
      const repository = new InMemoryLearningPersistenceRepository();
      const saved = await saveLearningPersistenceRecord(repository, buildCompletedInput(false));
      const restored = restoreLearningState(saved, phase83StudentId);
      const report = validateReport('Case 6 已完成回合恢复：不重新运行 Diagnosis，不重复 Evidence', restored, {
        expectedResumeMode: 'view_completed_round',
      });
      const originalEvidenceCount = saved.learningRoundResult?.taskEvidenceReturnResult?.abilityEvidence.length || 0;
      const restoredEvidenceCount = restored.restoredRecord?.learningRoundResult?.taskEvidenceReturnResult?.abilityEvidence.length || 0;
      if (originalEvidenceCount !== restoredEvidenceCount) {
        report.failReasons.push('Restored evidence count changed; restore may have duplicated evidence.');
      }
      report.passed = report.failReasons.length === 0;
      return report;
    },
  },
  {
    name: 'Case 7 提交过程中刷新：不重复提交或重复回流',
    run: async () => {
      const repository = new InMemoryLearningPersistenceRepository();
      await saveLearningPersistenceRecord(repository, {
        studentId: phase83StudentId,
        learningRoundId: readyStartResult.learningRoundId,
        concreteTask: readyStartResult.concreteTask,
        studentResponse: validExecution.studentResponse,
      });
      const record = await repository.loadLatest(phase83StudentId);
      const restored = restoreLearningState(record, phase83StudentId);
      const report = validateReport('Case 7 提交过程中刷新：不重复提交或重复回流', restored, {
        expectedResumeMode: 'continue_unfinished_round',
      });
      if (record?.learningRoundResult?.taskEvidenceReturnResult) {
        report.failReasons.push('Submitting state restore must not contain new evidence return result.');
      }
      report.passed = report.failReasons.length === 0;
      return report;
    },
  },
  {
    name: 'Case 8 studentId 不一致：阻断恢复',
    run: async () => {
      const record = createLearningPersistenceRecord(buildCompletedInput(false));
      const restored = restoreLearningState(record, 'other-student');

      return validateReport('Case 8 studentId 不一致：阻断恢复', restored, {
        expectedResumeMode: 'cannot_restore',
        expectedCanResume: false,
        mustContainIssue: 'studentId mismatch',
      });
    },
  },
  {
    name: 'Case 9 learningRoundId 不一致：阻断恢复',
    run: async () => {
      const record = createLearningPersistenceRecord(buildCompletedInput(false));
      const corrupted: LearningPersistenceRecord = {
        ...record,
        studentRoundSummary: record.studentRoundSummary
          ? {
            ...record.studentRoundSummary,
            learningRoundId: 'other-round',
          }
          : undefined,
      };
      const restored = restoreLearningState(corrupted, phase83StudentId);

      return validateReport('Case 9 learningRoundId 不一致：阻断恢复', restored, {
        expectedResumeMode: 'cannot_restore',
        expectedCanResume: false,
        mustContainIssue: 'StudentRoundSummary.learningRoundId',
      });
    },
  },
  {
    name: 'Case 10 缺少 StudentRoundSummary：restore_failed',
    run: async () => {
      const record = createLearningPersistenceRecord({
        ...buildCompletedInput(false),
        studentRoundSummary: undefined,
      });
      const restored = restoreLearningState(record, phase83StudentId);

      return validateReport('Case 10 缺少 StudentRoundSummary：restore_failed', restored, {
        expectedResumeMode: 'cannot_restore',
        expectedCanResume: false,
        mustContainIssue: 'StudentRoundSummary',
      });
    },
  },
  {
    name: 'Case 11 版本不支持：cannot_restore',
    run: async () => {
      const record = createLearningPersistenceRecord(buildCompletedInput(false));
      const unsupported = {
        ...record,
        schemaVersion: 'legacy_schema_v0',
      } as unknown as LearningPersistenceRecord;
      const restored = restoreLearningState(unsupported, phase83StudentId);

      return validateReport('Case 11 版本不支持：cannot_restore', restored, {
        expectedResumeMode: 'cannot_restore',
        expectedCanResume: false,
        mustContainIssue: 'schema',
      });
    },
  },
  {
    name: 'Case 12 数据损坏：不拼装残缺状态',
    run: async () => {
      const damaged = {
        recordId: 'damaged-record',
        studentId: phase83StudentId,
        learningRoundId: readyStartResult.learningRoundId,
        savedAt: '2026-07-14T12:10:00.000Z',
        updatedAt: '2026-07-14T12:10:00.000Z',
      } as unknown as LearningPersistenceRecord;
      const restored = restoreLearningState(damaged, phase83StudentId);

      return validateReport('Case 12 数据损坏：不拼装残缺状态', restored, {
        expectedResumeMode: 'cannot_restore',
        expectedCanResume: false,
        mustContainIssue: 'schema',
      });
    },
  },
  {
    name: 'Case 13 清除记录：不再恢复旧状态',
    run: async () => {
      const repository = new InMemoryLearningPersistenceRepository();
      await saveLearningPersistenceRecord(repository, buildCompletedInput(false));
      await repository.clear(phase83StudentId);
      const restored = await repository.loadLatest(phase83StudentId).then((record) => restoreLearningState(record, phase83StudentId));

      return validateReport('Case 13 清除记录：不再恢复旧状态', restored, {
        expectedResumeMode: 'cannot_restore',
        expectedCanResume: false,
        mustContainIssue: 'No persistence record',
      });
    },
  },
];

const reports = await Promise.all(cases.map((item) => item.run()));
const failedReports = reports.filter((report) => !report.passed);

printReport(reports);

if (failedReports.length > 0) {
  console.error('[FAIL] Phase 12.1 Learning Persistence debug failed.');
  process.exit(1);
}

console.log('[PASS] Phase 12.1 Learning Persistence debug passed.');

function buildCompletedInput(includeGrowthSummary: boolean) {
  return {
    studentId: phase83StudentId,
    learningRoundId: completedRound.learningRoundId,
    learningRoundResult: completedRound,
    concreteTask: readyStartResult.concreteTask,
    studentResponse: validExecution.studentResponse,
    studentLearningFeedback: completedFeedback,
    studentRoundSummary: completedSummary,
    growthMemoryRecord: completedRound.taskEvidenceReturnResult?.growthMemoryRecord,
    growthMemorySummary: includeGrowthSummary ? growthMemorySummary : undefined,
    studentAbilityProfile: studentProfile,
    savedAt: '2026-07-14T12:05:00.000Z',
    updatedAt: '2026-07-14T12:05:00.000Z',
  };
}

function validateReport(
  name: string,
  restored: RestoredLearningState,
  expected: {
    expectedResumeMode: RestoredLearningState['resumeMode'];
    expectedCanResume?: boolean;
    expectedLearningRoundId?: string;
    expectedRecordStatus?: string;
    mustContainIssue?: string;
  },
): CaseReport {
  const failReasons: string[] = [];

  if (!isRestoredLearningState(restored)) failReasons.push('RestoredLearningState schema validation failed.');
  if (restored.resumeMode !== expected.expectedResumeMode) {
    failReasons.push(`Expected resumeMode ${expected.expectedResumeMode}, got ${restored.resumeMode}.`);
  }
  if (
    expected.expectedCanResume !== undefined &&
    restored.canResume !== expected.expectedCanResume
  ) {
    failReasons.push(`Expected canResume=${expected.expectedCanResume}, got ${restored.canResume}.`);
  }
  if (
    expected.expectedLearningRoundId &&
    restored.learningRoundId !== expected.expectedLearningRoundId
  ) {
    failReasons.push(`Expected learningRoundId ${expected.expectedLearningRoundId}, got ${restored.learningRoundId}.`);
  }
  if (
    expected.expectedRecordStatus &&
    restored.restoredRecord?.status !== expected.expectedRecordStatus
  ) {
    failReasons.push(`Expected record status ${expected.expectedRecordStatus}, got ${restored.restoredRecord?.status || 'none'}.`);
  }
  if (
    expected.mustContainIssue &&
    !restored.validation.issues.join('\n').includes(expected.mustContainIssue) &&
    !restored.restoredRecord?.issues.join('\n').includes(expected.mustContainIssue)
  ) {
    failReasons.push(`Expected issues to contain ${expected.mustContainIssue}.`);
  }

  return {
    name,
    recordId: restored.restoredRecord?.recordId,
    studentId: restored.studentId,
    learningRoundId: restored.learningRoundId,
    status: restored.restoredRecord?.status,
    resumeMode: restored.resumeMode,
    canResume: restored.canResume,
    hasLearningRoundResult: Boolean(restored.restoredRecord?.learningRoundResult),
    hasStudentLearningFeedback: Boolean(restored.restoredRecord?.studentLearningFeedback),
    hasStudentRoundSummary: Boolean(restored.restoredRecord?.studentRoundSummary),
    hasGrowthMemorySummary: Boolean(restored.restoredRecord?.growthMemorySummary),
    validationIssues: restored.validation.issues,
    passed: failReasons.length === 0,
    failReasons,
  };
}

function buildDiagnosisResult(
  mainAbility: string,
  answerStatus: DiagnosisResult['answerStatus'],
): DiagnosisResult {
  const correct = answerStatus === 'fully_meets'
    ? true
    : answerStatus === 'does_not_meet'
      ? false
      : null;

  return {
    taskType: 'open_response',
    correct,
    strategyUsed: 'phase12_1_mock_diagnosis',
    answerStatus,
    scoreBand: answerStatus === 'fully_meets' ? 'high' : answerStatus === 'partially_meets' ? 'medium' : 'low',
    rubricItems: [],
    matchedRubricItems: answerStatus === 'fully_meets' ? ['文本线索', '心理推断'] : [],
    missingRubricItems: answerStatus === 'fully_meets' ? [] : ['推理链说明'],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: '本次作答能够回应任务要求。',
    rootCause: '学生能够从文本线索推出人物心理。',
    errorType: '待验证',
    abilityEvidence: ['学生能够结合文本线索说明人物心理。'],
    diagnosisSummary: '本次作答基本满足推理任务要求。',
    nextTraining: '进入本轮结果页，等待下一步学习安排。',
    confidence: 0.82,
  };
}

function printReport(caseReports: CaseReport[]): void {
  console.log('Phase 12.1 Learning Persistence Debug Report');
  console.log('============================================');
  console.log(`total: ${caseReports.length}`);
  console.log(`pass: ${caseReports.filter((report) => report.passed).length}`);
  console.log(`fail: ${caseReports.filter((report) => !report.passed).length}`);
  console.log('');

  for (const report of caseReports) {
    console.log(`${report.passed ? '[PASS]' : '[FAIL]'} ${report.name}`);
    console.log(`recordId: ${report.recordId || 'none'}`);
    console.log(`studentId: ${report.studentId || 'none'}`);
    console.log(`learningRoundId: ${report.learningRoundId || 'none'}`);
    console.log(`status: ${report.status || 'none'}`);
    console.log(`resumeMode: ${report.resumeMode || 'none'}`);
    console.log(`canResume: ${report.canResume}`);
    console.log(`hasLearningRoundResult: ${report.hasLearningRoundResult}`);
    console.log(`hasStudentLearningFeedback: ${report.hasStudentLearningFeedback}`);
    console.log(`hasStudentRoundSummary: ${report.hasStudentRoundSummary}`);
    console.log(`hasGrowthMemorySummary: ${report.hasGrowthMemorySummary}`);
    console.log(`validationIssues: ${report.validationIssues.length ? report.validationIssues.join(' | ') : 'none'}`);
    if (report.failReasons.length > 0) console.log(`failReasons: ${report.failReasons.join(' | ')}`);
    console.log('');
  }
}
