import {
  buildInternalLearningReviewSummary,
  buildUnifiedLearningEntryState,
  createUnifiedLearningActivityContext,
} from '../agents/unifiedLearningEntryAgent.ts';
import { InMemoryUnifiedLearningEntryRepository } from '../repositories/inMemoryUnifiedLearningEntryRepository.ts';
import {
  isUnifiedLearningEntryState,
  type UnifiedLearningEntryInput,
} from '../schemas/unifiedLearningEntry.schema.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';
import { withUnifiedLearningEntryReadDeadline } from '../../api/unifiedLearningEntry.ts';
import { LocalApiFormalResourceClient } from '../repositories/localApiFormalResourceClient.ts';
import {
  createEmptySharedFormalResourceData,
  SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';

const NOW = '2026-07-21T12:00:00.000Z';
const STUDENT_ID = 'student-phase16-3b-debug';
type Report = { name: string; passed: boolean; detail: string };
const reports: Report[] = [];

async function main(): Promise<void> {
  checkState('B1 新学生进入统一入口', baseInput(), 'start_new_round');
  checkState('B2 未完成 Round 优先恢复', baseInput({
    activeContexts: [activeContext()],
    latestPersistenceRecord: record({ answerDraft: '' }),
  }), 'continue_round');
  checkState('B2.1 刷新后从活动题组当前题恢复', baseInput({
    activeContexts: [activeContext({ currentLearningRoundId: 'session-phase16-3b-round-2' })],
  }), 'continue_round', (state) => (
    state.currentRoundNumber === 2 &&
    state.title === '继续当前题组' &&
    state.message.includes('第 2 题')
  ));
  checkState('B3 答案草稿恢复', baseInput({
    activeContexts: [activeContext()],
    latestPersistenceRecord: record({ answerDraft: '这是上次保留的回答。' }),
  }), 'continue_round', (state) => state.hasDraft);
  checkState('B4 已完成结果恢复反馈', baseInput({
    activeContexts: [activeContext()],
    latestPersistenceRecord: completedRecord('下面是根据本次正式记录整理的受限反馈。'),
    completedRoundCount: 1,
  }), 'feedback_available', (state) => state.hasUnviewedFeedback &&
    state.message === '下面是根据本次回答整理的反馈。');
  checkState('B5 到期复测生成正式入口', baseInput({
    delayedRetestPlans: [retestPlan()],
  }), 'delayed_retest_available', (state) => state.retest?.targetAbilityId === 'inference');
  checkState('B6 review_required 具有最高优先级', baseInput({
    activeContexts: [activeContext()],
    latestPersistenceRecord: record({ answerDraft: '草稿' }),
    operationCheckpoint: checkpoint({ status: 'review_required', nextAction: 'human_review' }),
    delayedRetestPlans: [retestPlan()],
  }), 'review_required');
  checkState('B6.1 已保存结果的旧下一题复核态可进入工作区迁移题组', baseInput({
    activeContexts: [activeContext()],
    latestPersistenceRecord: completedRecord(),
    operationCheckpoint: checkpoint({
      status: 'review_required',
      stage: 'persisted',
      nextAction: 'human_review',
      learningPersistenceRecordId: 'record-phase16-3b',
    }),
  }), 'feedback_available', (state) => (
    state.canEnterWorkspace &&
    state.primaryActionText === '查看反馈并继续'
  ));
  checkState('B7 blocked 不展示残缺任务', baseInput({
    activeContexts: [activeContext()],
    operationCheckpoint: checkpoint({ status: 'blocked', nextAction: 'prepare_resource' }),
  }), 'blocked', (state) => !state.canEnterWorkspace);
  checkState('B8 提交恢复期间阻止重复提交入口', baseInput({
    activeContexts: [activeContext()],
    operationCheckpoint: checkpoint({ status: 'retry_required', stage: 'diagnosis_committed', nextAction: 'retry_provider' }),
  }), 'recovering_submission');
  checkState('B9 无资源时不拼装任务', baseInput({ hasAvailableTask: false }), 'no_task');
  checkState('B10 身份错位进入人工确认', baseInput({
    latestPersistenceRecord: record({ studentId: 'another-student' }),
  }), 'review_required', (state) => !state.validation.passed);
  checkState('B11 已结束 Session 不等同能力完成', baseInput({
    activeContexts: [activeContext({ status: 'ended' })],
    latestPersistenceRecord: completedRecord(),
    completedRoundCount: 1,
  }), 'session_ended');
  checkState('B11.1 已完成活动题组忽略旧阻断快照并开放新一轮', baseInput({
    activeContexts: [activeContext({ status: 'blocked' })],
    latestPersistenceRecord: completedRecord(),
    operationCheckpoint: checkpoint({
      status: 'blocked',
      stage: 'persisted',
      nextAction: 'prepare_resource',
      learningPersistenceRecordId: 'record-phase16-3b',
    }),
    completedRoundCount: 5,
    sessionGroupCompleted: true,
    hasAvailableTask: true,
  }), 'session_ended', (state) => (
    state.primaryAction === 'start_new_session' &&
    state.primaryActionText === '开始新的学习' &&
    state.canEnterWorkspace
  ));
  checkState('B12 下一资源缺口保留正式结果并阻断新任务', baseInput({
    activeContexts: [activeContext()],
    latestPersistenceRecord: completedRecord(),
    operationCheckpoint: checkpoint({
      status: 'blocked',
      stage: 'persisted',
      nextAction: 'prepare_resource',
      learningPersistenceRecordId: 'record-phase16-3b',
    }),
  }), 'blocked', (state) => state.canEnterWorkspace &&
    state.title === '需要检查下一任务' &&
    state.primaryAction === 'retry_resource' &&
    state.primaryActionText === '检查下一任务');
  checkState('B12.1 旧资源缺口被身份阻断后仍保留检查入口', baseInput({
    activeContexts: [activeContext()],
    latestPersistenceRecord: completedRecord(),
    operationCheckpoint: checkpoint({
      status: 'blocked',
      stage: 'persisted',
      nextAction: 'stop',
      learningPersistenceRecordId: 'record-phase16-3b',
      nextTaskResolution: {
        status: 'no_match',
        taskRequestId: 'task-request-phase16-3b',
        issues: ['quality_evaluation_not_executable'],
      },
      issues: ['quality_evaluation_not_executable', 'operation_identity_mismatch:resourceVersionId'],
    }),
  }), 'blocked', (state) => state.primaryAction === 'retry_resource' && state.canEnterWorkspace);
  checkState('B12.2 失效旧题组提供结束入口而非通用读取失败', baseInput({
    activeContexts: [activeContext()],
    hasAvailableTask: false,
    taskAvailabilityState: 'stale_session',
    taskAvailabilityMessage: '当前旧题组引用的正式题目已经更新，无法安全继续。已有学习结果已经保留，请结束本次学习后重新开始。',
  }), 'blocked', (state) => (
    state.hasActiveSession &&
    !state.canEnterWorkspace &&
    state.title === '当前题组需要重新开始' &&
    state.primaryAction === 'none'
  ));
  checkState('B13 正式保存恢复不重新开放作答入口', baseInput({
    activeContexts: [activeContext()],
    operationCheckpoint: checkpoint({
      status: 'retry_required',
      stage: 'evidence_returned',
      nextAction: 'retry_persistence',
    }),
  }), 'recovering_submission', (state) => state.primaryAction === 'resume_processing');
  checkState('B20 无正式资源时保留准确原因', baseInput({
    hasAvailableTask: false,
    taskAvailabilityState: 'no_formal_resource',
    taskAvailabilityMessage: '当前还没有已发布的正式训练任务。',
  }), 'no_task', (state) => (
    state.taskAvailabilityState === 'no_formal_resource' &&
    state.title === '当前还没有正式任务'
  ));
  checkState('B21 无符合本轮条件的资源时不误报读取失败', baseInput({
    hasAvailableTask: false,
    taskAvailabilityState: 'no_eligible_match',
    taskAvailabilityMessage: '当前没有同时符合能力、任务角色且未重复使用的正式资源。',
  }), 'no_task', (state) => (
    state.taskAvailabilityState === 'no_eligible_match' &&
    state.title === '当前没有符合本轮条件的新任务' &&
    !state.message.includes('读取失败')
  ));
  checkState('B22 本轮资源已使用时返回可解释空状态', baseInput({
    hasAvailableTask: false,
    taskAvailabilityState: 'already_used',
    taskAvailabilityMessage: '本轮可用的正式资源已经完成。',
  }), 'no_task', (state) => (
    state.taskAvailabilityState === 'already_used' &&
      state.title === '本轮可用任务已经完成'
  ));
  checkState('B23 已结束且无可用任务时不显示可点击的新学习入口', baseInput({
    activeContexts: [activeContext({ status: 'ended' })],
    latestPersistenceRecord: completedRecord(),
    hasAvailableTask: false,
    taskAvailabilityState: 'already_used',
    taskAvailabilityMessage: '当前没有可用任务。',
  }), 'no_task', (state) => (
    state.primaryAction === 'none' &&
    state.primaryActionText === '暂无任务' &&
    !state.canEnterWorkspace
  ));
  await checkRepositoryConflict();
  checkInternalSummary();
  checkStudentStateSurface();
  await checkEntryReadDeadline();
  await checkFormalResourceRequestDeadline();
  await checkFormalResourceReadCoalescing();

  console.log('\nPhase 16.3B Unified Learning Entry Debug');
  console.log('='.repeat(76));
  for (const report of reports) {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail}`);
  }
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(76));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  console.log('Provider mode: none (entry orchestration only)');
  console.log('Persistence mode: deterministic in-memory repository');
  if (passed !== reports.length) throw new Error('Phase 16.3B Unified Learning Entry Debug failed.');
}

async function checkFormalResourceRequestDeadline(): Promise<void> {
  const client = new LocalApiFormalResourceClient(
    '/debug/formal-resources',
    (() => new Promise<Response>(() => {})) as typeof fetch,
    15,
  );
  const startedAt = Date.now();
  try {
    await client.read();
    reports.push({
      name: 'B18 正式资源服务请求超时收敛',
      passed: false,
      detail: 'request deadline did not reject',
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    reports.push({
      name: 'B18 正式资源服务请求超时收敛',
      passed: /读取超时/.test(error instanceof Error ? error.message : String(error)) && elapsedMs < 250,
      detail: `elapsedMs=${elapsedMs}, message=${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function checkFormalResourceReadCoalescing(): Promise<void> {
  let requestCount = 0;
  const fetcher = (async () => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({
      snapshot: {
        schemaVersion: SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
        initialized: true,
        revision: 1,
        baselineSource: 'learning-entry-coalescing-debug',
        createdAt: NOW,
        updatedAt: NOW,
        data: createEmptySharedFormalResourceData(),
      },
      status: {
        initialized: true,
        revision: 1,
        baselineSource: 'learning-entry-coalescing-debug',
        updatedAt: NOW,
        backupAvailable: false,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  const clientA = new LocalApiFormalResourceClient('/debug/coalesced-formal-resources', fetcher);
  const clientB = new LocalApiFormalResourceClient('/debug/coalesced-formal-resources', fetcher);

  const [first, second, third] = await Promise.all([
    clientA.read(),
    clientB.read(),
    clientA.read(),
  ]);
  await clientB.read();
  reports.push({
    name: 'B19 正式资源共享快照合并读取',
    passed: requestCount === 1 &&
      first.snapshot.revision === second.snapshot.revision &&
      second.snapshot.revision === third.snapshot.revision,
    detail: `requestCount=${requestCount}, revision=${first.snapshot.revision}`,
  });
}

async function checkEntryReadDeadline(): Promise<void> {
  const startedAt = Date.now();
  try {
    await withUnifiedLearningEntryReadDeadline(new Promise<never>(() => {}), 15);
    reports.push({
      name: 'B17 学习入口读取超时结束 Loading',
      passed: false,
      detail: 'deadline did not reject',
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    reports.push({
      name: 'B17 学习入口读取超时结束 Loading',
      passed: /读取超时/.test(error instanceof Error ? error.message : String(error)) && elapsedMs < 250,
      detail: `elapsedMs=${elapsedMs}, message=${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function checkState(
  name: string,
  input: UnifiedLearningEntryInput,
  expectedStatus: string,
  extra: (state: ReturnType<typeof buildUnifiedLearningEntryState>) => boolean = () => true,
): void {
  const state = buildUnifiedLearningEntryState(input);
  const passed = isUnifiedLearningEntryState(state) && state.status === expectedStatus && extra(state);
  reports.push({ name, passed, detail: `status=${state.status}, action=${state.primaryAction}, validation=${state.validation.passed}` });
}

async function checkRepositoryConflict(): Promise<void> {
  const repository = new InMemoryUnifiedLearningEntryRepository();
  const first = activeContext({ learningSessionId: 'session-a' });
  const second = activeContext({ learningSessionId: 'session-b' });
  await repository.save(first);
  const repeated = await repository.save(first);
  const conflict = await repository.save(second);
  reports.push({
    name: 'B14 重复开始保持幂等且拒绝第二个活动 Session',
    passed: repeated.status === 'reused' && conflict.status === 'conflict' && (await repository.getByStudent(STUDENT_ID))?.learningSessionId === 'session-a',
    detail: `repeat=${repeated.status}, second=${conflict.status}`,
  });
}

function checkInternalSummary(): void {
  const summary = buildInternalLearningReviewSummary(checkpoint({ status: 'completed', stage: 'next_task_ready', nextAction: 'start_next_task' }));
  reports.push({
    name: 'B15 内部入口可追溯正式链路且隐藏敏感数据',
    passed: summary.status === 'completed' && summary.sensitiveDataHidden && summary.stages.every((stage) => stage.status === 'completed') && !JSON.stringify(summary).includes('api-key'),
    detail: `status=${summary.status}, stages=${summary.stages.length}, sensitiveHidden=${summary.sensitiveDataHidden}`,
  });
}

function checkStudentStateSurface(): void {
  const state = buildUnifiedLearningEntryState(baseInput({ latestPersistenceRecord: completedRecord() }));
  const serialized = JSON.stringify(state);
  const forbidden = ['operationId', 'learningSessionId', 'evidenceIds', 'rawOutput', 'promptVersion', 'confidence'];
  reports.push({
    name: 'B16 学生入口状态不暴露 Runtime 字段',
    passed: forbidden.every((key) => !serialized.includes(key)),
    detail: `forbiddenFields=${forbidden.filter((key) => serialized.includes(key)).join('|') || 'none'}`,
  });
}

function baseInput(overrides: Partial<UnifiedLearningEntryInput> = {}): UnifiedLearningEntryInput {
  return {
    studentId: STUDENT_ID,
    now: NOW,
    activeContexts: [],
    hasAvailableTask: true,
    completedRoundCount: 0,
    ...overrides,
  };
}

function activeContext(overrides: Partial<ReturnType<typeof createUnifiedLearningActivityContext>> = {}) {
  return createUnifiedLearningActivityContext({
    studentId: STUDENT_ID,
    learningSessionId: 'session-phase16-3b',
    currentLearningRoundId: 'round-1',
    createdAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-21T11:00:00.000Z',
    ...overrides,
  });
}

function record(overrides: Partial<LearningPersistenceRecord> = {}): LearningPersistenceRecord {
  return {
    recordId: 'record-phase16-3b', studentId: STUDENT_ID, learningRoundId: 'round-1',
    savedAt: NOW, updatedAt: NOW, version: 'phase12_1_v1', schemaVersion: 'learning_persistence_v1',
    status: 'saved', issues: [], ...overrides,
  };
}

function completedRecord(summary = '本轮反馈已经保存。'): LearningPersistenceRecord {
  return record({
    learningRoundResult: { status: 'completed' } as LearningPersistenceRecord['learningRoundResult'],
    studentLearningFeedback: { summary } as LearningPersistenceRecord['studentLearningFeedback'],
  });
}

function retestPlan() {
  return {
    planId: 'retest-plan-1', candidateId: 'candidate-1', studentId: STUDENT_ID, targetAbilityId: 'inference',
    sourceSessionIds: ['session-0'], sourceEvidenceIds: ['evidence-0'], baselineEvidenceId: 'evidence-0',
    scheduledAt: '2026-07-18T12:00:00.000Z', plannedRetestAt: '2026-07-21T11:00:00.000Z', status: 'available' as const,
    whyRetestNow: '距离上次学习已有一段时间，可以重新观察这项能力。', retestGoal: '观察保持情况', validationGoal: '验证独立表现',
    requestedTaskRole: 'retest' as const, requireNewMaterial: true as const, allowHint: false as const,
    constraints: ['new_material'], policyVersion: 'phase13_2_policy_v1' as const, schemaVersion: 'delayed_retest_scheduling_v1' as const,
    createdAt: NOW, updatedAt: NOW, validation: { passed: true, issues: [] },
  };
}

function checkpoint(overrides: Partial<RealLearningOperationCheckpoint> = {}): RealLearningOperationCheckpoint {
  return {
    schemaVersion: 'real_learning_operation_v1', operationId: 'operation-phase16-3b', learningSessionId: 'session-phase16-3b',
    learningRoundId: 'round-1', studentId: STUDENT_ID, stage: 'task_prepared', status: 'retry_required', nextAction: 'submit_answer',
    sourceResourceId: 'resource-1', sourceResourceVersionId: 'resource-version-1', sourceTaskId: 'task-1', diagnosisRequestId: 'diagnosis-1',
    issues: [], createdAt: NOW, updatedAt: NOW, ...overrides,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
