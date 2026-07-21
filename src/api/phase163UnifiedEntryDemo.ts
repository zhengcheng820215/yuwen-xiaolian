import {
  buildUnifiedLearningEntryState,
  createUnifiedLearningActivityContext,
} from '../ai/agents/unifiedLearningEntryAgent.ts';
import { InMemoryUnifiedLearningEntryRepository } from '../ai/repositories/inMemoryUnifiedLearningEntryRepository.ts';
import type { LearningPersistenceRecord } from '../ai/schemas/learningPersistence.schema.ts';
import type { RealLearningOperationCheckpoint } from '../ai/schemas/realLearningOperation.schema.ts';
import type {
  UnifiedLearningEntryInput,
  UnifiedLearningEntryState,
} from '../ai/schemas/unifiedLearningEntry.schema.ts';

const NOW = '2026-07-21T12:00:00.000Z';
const STUDENT_ID = 'phase16-3b-demo-student';

export type Phase163UnifiedEntryDemoCase = {
  id: string;
  label: string;
  description: string;
  expected: string;
  expectedStatus: UnifiedLearningEntryState['status'];
};

export type Phase163UnifiedEntryDemoResult = {
  state: UnifiedLearningEntryState;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
};

const CASES: Phase163UnifiedEntryDemoCase[] = [
  {
    id: 'start', label: '开始学习', description: '没有活动 Session，但存在可用正式任务。',
    expected: '显示单一开始入口，不暴露内部字段。', expectedStatus: 'start_new_round',
  },
  {
    id: 'draft', label: '恢复草稿', description: '已有未完成 Round 和尚未提交的答案草稿。',
    expected: '恢复同一轮并提示草稿已保留。', expectedStatus: 'continue_round',
  },
  {
    id: 'feedback', label: '查看反馈', description: '上一轮正式完成，反馈已保存但尚未查看。',
    expected: '进入反馈入口，不重新执行 Diagnosis。', expectedStatus: 'feedback_available',
  },
  {
    id: 'retest', label: '到期复测', description: '正式 DelayedRetestPlan 已到期且可开始。',
    expected: '展示复测原因和单一复测入口。', expectedStatus: 'delayed_retest_available',
  },
  {
    id: 'blocked', label: '安全阻断', description: '当前运行已被正式安全 Gate 阻断。',
    expected: '不展示残缺任务，只给出稍后重试提示。', expectedStatus: 'blocked',
  },
  {
    id: 'review', label: '等待复核', description: '结果需要人工确认，暂不允许回流。',
    expected: '使用学生可读语言说明等待确认。', expectedStatus: 'review_required',
  },
  {
    id: 'recovering', label: '提交恢复', description: '已提交结果正在从正式 Checkpoint 恢复。',
    expected: '阻止重复提交，并提供恢复状态入口。', expectedStatus: 'recovering_submission',
  },
  {
    id: 'ended', label: '结束学习', description: '学生已主动结束当前 LearningSession。',
    expected: '显示本次学习结束，不把结束解释为能力完成。', expectedStatus: 'session_ended',
  },
  {
    id: 'idempotency', label: '重复启动保护', description: '重复启动同一 Session，并尝试创建第二个活动 Session。',
    expected: '同一 Session 复用，第二个活动 Session 被拒绝。', expectedStatus: 'start_new_round',
  },
  {
    id: 'response_revision', label: '补充回答', description: '本次提交的信息不足，正式流程要求返回原题补充。',
    expected: '保留原任务并返回可编辑状态，不进入结束页。', expectedStatus: 'continue_round',
  },
  {
    id: 'no_task', label: '暂无任务', description: '当前没有通过资格与匹配 Gate 的正式任务。',
    expected: '不拼装残缺任务，入口保持不可用并给出克制说明。', expectedStatus: 'no_task',
  },
];

export function getPhase163UnifiedEntryDemoCases(): Phase163UnifiedEntryDemoCase[] {
  return CASES;
}

export async function runPhase163UnifiedEntryDemoCase(
  caseId: string,
): Promise<Phase163UnifiedEntryDemoResult> {
  const demoCase = CASES.find((item) => item.id === caseId) || CASES[0];
  const state = buildUnifiedLearningEntryState(buildInput(demoCase.id));
  const serialized = JSON.stringify(state);
  const forbidden = ['operationId', 'learningSessionId', 'evidenceIds', 'rawOutput', 'promptVersion', 'confidence'];
  const checks: Phase163UnifiedEntryDemoResult['checks'] = [
    {
      label: '状态与预期一致',
      passed: state.status === demoCase.expectedStatus,
      detail: `${state.status} / ${demoCase.expectedStatus}`,
    },
    {
      label: '学生入口通过结构校验',
      passed: state.validation.passed,
      detail: state.validation.issues.join('；') || '无校验问题',
    },
    {
      label: '学生字段隔离',
      passed: forbidden.every((key) => !serialized.includes(key)),
      detail: forbidden.filter((key) => serialized.includes(key)).join('、') || '未发现内部字段',
    },
  ];

  if (demoCase.id === 'idempotency') {
    const repository = new InMemoryUnifiedLearningEntryRepository();
    const first = activeContext({ learningSessionId: 'session-demo-a' });
    const second = activeContext({ learningSessionId: 'session-demo-b' });
    await repository.save(first);
    const repeated = await repository.save(first);
    const conflict = await repository.save(second);
    checks.push({
      label: '重复启动保持幂等',
      passed: repeated.status === 'reused',
      detail: `同一 Session：${repeated.status}`,
    });
    checks.push({
      label: '第二活动 Session 被拒绝',
      passed: conflict.status === 'conflict',
      detail: `第二 Session：${conflict.status}`,
    });
  }

  return { state, checks };
}

function buildInput(caseId: string): UnifiedLearningEntryInput {
  const base: UnifiedLearningEntryInput = {
    studentId: STUDENT_ID,
    now: NOW,
    activeContexts: [],
    hasAvailableTask: true,
    completedRoundCount: 0,
  };
  if (caseId === 'draft') {
    return { ...base, activeContexts: [activeContext()], latestPersistenceRecord: record({ answerDraft: '父亲舍不得这片树叶，因为他站了很久。' }) };
  }
  if (caseId === 'feedback') {
    return { ...base, activeContexts: [activeContext()], latestPersistenceRecord: completedRecord(), completedRoundCount: 1 };
  }
  if (caseId === 'retest') return { ...base, delayedRetestPlans: [retestPlan()] };
  if (caseId === 'blocked') {
    return { ...base, activeContexts: [activeContext()], operationCheckpoint: checkpoint({ status: 'blocked', nextAction: 'prepare_resource' }) };
  }
  if (caseId === 'review') {
    return { ...base, activeContexts: [activeContext()], operationCheckpoint: checkpoint({ status: 'review_required', nextAction: 'human_review' }) };
  }
  if (caseId === 'recovering') {
    return { ...base, activeContexts: [activeContext()], operationCheckpoint: checkpoint({ status: 'retry_required', stage: 'diagnosis_committed', nextAction: 'retry_provider' }) };
  }
  if (caseId === 'ended') {
    return { ...base, activeContexts: [activeContext({ status: 'ended' })], latestPersistenceRecord: completedRecord(), completedRoundCount: 1 };
  }
  if (caseId === 'response_revision') {
    return { ...base, activeContexts: [activeContext()], operationCheckpoint: checkpoint({ status: 'retry_required', stage: 'task_prepared', nextAction: 'submit_answer' }) };
  }
  if (caseId === 'no_task') return { ...base, hasAvailableTask: false };
  return base;
}

function activeContext(overrides: Record<string, string> = {}) {
  return createUnifiedLearningActivityContext({
    studentId: STUDENT_ID,
    learningSessionId: 'session-phase16-3b-demo',
    currentLearningRoundId: 'round-1',
    createdAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-21T11:00:00.000Z',
    ...overrides,
  });
}

function record(overrides: Partial<LearningPersistenceRecord> = {}): LearningPersistenceRecord {
  return {
    recordId: 'record-phase16-3b-demo', studentId: STUDENT_ID, learningRoundId: 'round-1',
    savedAt: NOW, updatedAt: NOW, version: 'phase12_1_v1', schemaVersion: 'learning_persistence_v1',
    status: 'saved', issues: [], ...overrides,
  };
}

function completedRecord(): LearningPersistenceRecord {
  return record({
    learningRoundResult: { status: 'completed' } as LearningPersistenceRecord['learningRoundResult'],
    studentLearningFeedback: { summary: '你已经完成本轮回答，可以查看具体反馈。' } as LearningPersistenceRecord['studentLearningFeedback'],
  });
}

function retestPlan() {
  return {
    planId: 'retest-plan-demo', candidateId: 'candidate-demo', studentId: STUDENT_ID, targetAbilityId: 'inference',
    sourceSessionIds: ['session-before'], sourceEvidenceIds: ['evidence-before'], baselineEvidenceId: 'evidence-before',
    scheduledAt: '2026-07-18T12:00:00.000Z', plannedRetestAt: '2026-07-21T11:00:00.000Z', status: 'available' as const,
    whyRetestNow: '距离上次练习已有一段时间，现在可以看看自己是否还能独立完成。', retestGoal: '观察保持情况',
    validationGoal: '验证独立表现', requestedTaskRole: 'retest' as const, requireNewMaterial: true as const, allowHint: false as const,
    constraints: ['new_material'], policyVersion: 'phase13_2_policy_v1' as const, schemaVersion: 'delayed_retest_scheduling_v1' as const,
    createdAt: NOW, updatedAt: NOW, validation: { passed: true, issues: [] },
  };
}

function checkpoint(overrides: Partial<RealLearningOperationCheckpoint> = {}): RealLearningOperationCheckpoint {
  return {
    schemaVersion: 'real_learning_operation_v1', operationId: 'operation-phase16-3b-demo', learningSessionId: 'session-phase16-3b-demo',
    learningRoundId: 'round-1', studentId: STUDENT_ID, stage: 'task_prepared', status: 'retry_required', nextAction: 'submit_answer',
    sourceResourceId: 'resource-demo', sourceResourceVersionId: 'resource-version-demo', sourceTaskId: 'task-demo',
    diagnosisRequestId: 'diagnosis-demo', issues: [], createdAt: NOW, updatedAt: NOW, ...overrides,
  };
}
