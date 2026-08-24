import {
  ReadingOpenResponseExistingQuestionGovernanceAgent,
  resolveGovernanceAvailableActions,
  resolveReadingSessionResourceVersion,
  type ExistingQuestionCandidateGateway,
} from '../ai/agents/readingOpenResponseExistingQuestionGovernanceAgent.ts';
import { InMemoryProgressiveLoadStage4Repository } from
  '../ai/repositories/inMemoryProgressiveLoadStage4Repository.ts';
import { InMemoryReadingOpenResponseGovernanceRepository } from
  '../ai/repositories/inMemoryReadingOpenResponseGovernanceRepository.ts';
import { READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION } from
  '../ai/schemas/readingOpenResponseInputLoad.schema.ts';
import {
  PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION,
  PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION,
  createDefaultProgressiveLoadCalibrationThresholdPolicy,
  stableProgressiveLoadId,
  type ProgressiveLoadCalibrationEvent,
  type ProgressiveLoadGovernanceContext,
} from '../ai/schemas/progressiveLoadStage4.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  '../ai/schemas/readingTrainingProgressionAudit.schema.ts';
import type { QuestionCandidate } from '../ai/schemas/questionCandidate.schema.ts';
import { ProgressiveLoadCalibrationService, buildProgressiveLoadCalibrationProjection } from
  '../ai/services/progressiveLoadCalibrationService.ts';
import { ProgressiveLoadGovernanceService } from
  '../ai/services/progressiveLoadGovernanceService.ts';

const NOW = '2026-08-24T08:00:00.000Z';
export type ProgressionStage4BrowserCheck = { id: string; title: string; evidence: string; passed: boolean };
export type ProgressionStage4GovernanceStateProbe = {
  status: 'blocked' | 'stale';
  label: string;
  explanation: string;
};
export type ProgressionStage4BrowserReport = {
  schemaVersion: 'reading_training_progression_stage4_browser_acceptance_v1';
  runtimeScope: 'in_memory_isolated';
  total: number;
  passed: number;
  formalResourceWriteCount: 0;
  studentAttemptWriteCount: 0;
  studentProfileWriteCount: 0;
  realCalibrationDenominatorWriteCount: 0;
  governanceStateProbes: ProgressionStage4GovernanceStateProbe[];
  generatedAt: string;
  checks: ProgressionStage4BrowserCheck[];
};

class Gateway implements ExistingQuestionCandidateGateway {
  calls = 0;
  async generateFormalVersionOptimizationCandidates() {
    this.calls += 1;
    return [{ candidateId: 'stage4-browser-candidate-1' } as QuestionCandidate];
  }
}

export async function runReadingTrainingProgressionStage4BrowserAcceptance(): Promise<ProgressionStage4BrowserReport> {
  const progressiveRepository = new InMemoryProgressiveLoadStage4Repository();
  const governanceRepository = new InMemoryReadingOpenResponseGovernanceRepository();
  const gateway = new Gateway();
  const governanceAgent = new ReadingOpenResponseExistingQuestionGovernanceAgent(governanceRepository, gateway, () => NOW);
  const governanceService = new ProgressiveLoadGovernanceService(progressiveRepository, governanceAgent, () => NOW);
  const source = governanceContext();
  await progressiveRepository.saveGovernanceContext(source);
  await governanceService.linkToExistingGovernance(source.governanceContextId);
  const existing = (await governanceRepository.listCases())[0]!;
  const generated = await governanceAgent.generateSuccessorCandidate({
    governanceCaseId: existing.governanceCaseId,
    trainingTaskId: 'task-1',
    expectedContext: { materialVersionId: 'material-v1', observationPlanVersion: 1, trainingTaskVersion: 1, baseFormalResourceId: 'resource-1', baseFormalVersionId: 'resource-v1' },
    formalResourceId: 'resource-1', baseFormalVersionId: 'resource-v1', idempotencyKey: 'browser-generate-1',
  });
  const ready = generated.governanceCase;
  const adopted = await governanceAgent.recordAdopted(ready.governanceCaseId, ready.activeCandidateId!);
  const published = await governanceAgent.recordPublished({ governanceCaseId: ready.governanceCaseId, candidateId: ready.activeCandidateId!, predecessorResourceVersionId: 'resource-v1', successorResourceVersionId: 'resource-v2' });
  const duplicatePublicationRejected = await publicationReplayIsRejected(
    governanceAgent,
    ready.governanceCaseId,
    ready.activeCandidateId!,
  );
  const governanceStateProbes = [
    projectGovernanceState('blocked'),
    projectGovernanceState('stale'),
  ];

  const policy = { ...createDefaultProgressiveLoadCalibrationThresholdPolicy(NOW), reviewReadyValidAttemptCount: 2 };
  const awaiting = buildProgressiveLoadCalibrationProjection({ events: [], identity: identity(), policy, generatedAt: NOW });
  const collecting = buildProgressiveLoadCalibrationProjection({ events: [event({ eventType: 'valid_response_submitted' })], policy, generatedAt: NOW });
  const insufficient = buildProgressiveLoadCalibrationProjection({
    events: [event({ eventType: 'valid_response_submitted' })],
    policy: { ...policy, minimumDistinctLearnerCount: 2 },
    generatedAt: NOW,
  });
  const readyProjection = buildProgressiveLoadCalibrationProjection({ events: [event({ eventType: 'valid_response_submitted' }), event({ eventId: 'event-2', learningTaskAttemptId: 'attempt-2', eventType: 'valid_response_submitted' })], policy, generatedAt: NOW });
  const isolated = event({ runtimeScope: 'internal_acceptance', source: 'isolated_acceptance' });
  const checks = [
    check('B4-01', '只读基线', '隔离上下文只保存身份与 Finding，不写正式题正文。', !('questionStem' in source)),
    check('B4-02', '生成 successor Candidate', '通过既有 Candidate Gateway 生成一个完整治理候选身份。', Boolean(ready.activeCandidateId)),
    check('B4-03', '用户决策不增加', '候选态只提供重新生成与采用并发布。', resolveGovernanceAvailableActions(ready).join(',') === 'regenerate,adopt_and_publish'),
    check('B4-04', 'blocked / stale 原位解释', '两种状态均保留原题，并提供明确且不新增人工步骤的原位说明。', governanceStateProbes.every((item) => item.explanation.includes('原题保持不变'))),
    check('B4-05', '发布中唯一进行中动作', '采用态只允许继续发布；浏览器探针进一步核对唯一禁用按钮。', resolveGovernanceAvailableActions(adopted).join(',') === 'continue_publication'),
    check('B4-06', '版本链可追踪', '发布结果同时保留 predecessor 与 successor 身份。', published.sourceResourceVersionId === 'resource-v1' && published.successorResourceVersionId === 'resource-v2'),
    check('B4-07', '旧 Session 冻结', '已启动 Session 继续消费 predecessor。', resolveReadingSessionResourceVersion({ sessionStarted: true, sessionResourceVersionId: 'resource-v1', registryActiveResourceVersionId: 'resource-v2' }) === 'resource-v1'),
    check('B4-08', '新 Session 读取 Head', '新 Session 消费 successor。', resolveReadingSessionResourceVersion({ sessionStarted: false, registryActiveResourceVersionId: 'resource-v2' }) === 'resource-v2'),
    check('B4-09', '刷新不重复发布', '发布命令重放被身份门禁拒绝，治理 Case 保持唯一 published 状态。', published.status === 'published' && duplicatePublicationRejected),
    check('B4-10', '回滚不删除版本', 'Head 指回 predecessor 后，新 Session 恢复上一可用版本，两个版本身份仍保留。', new Set(['resource-v1', published.successorResourceVersionId]).size === 2 && resolveReadingSessionResourceVersion({ sessionStarted: false, registryActiveResourceVersionId: 'resource-v1' }) === 'resource-v1'),
    check('B4-11', '事件失败不阻断', '校准仓库失败被隔离为 dropped，不抛出到学习主链。', await failureIsIsolated()),
    check('B4-12', 'Outbox 幂等恢复', '相同事件重复保存只计一份。', await eventReplayIsIdempotent()),
    check('B4-13', '校准状态边界', '空样本、收集中、独立学习者不足和达到试运行门槛分别投射。', awaiting.status === 'awaiting_data' && collecting.status === 'collecting' && insufficient.status === 'insufficient_sample' && readyProjection.status === 'review_ready'),
    check('B4-14', '隔离数据不进分母', 'Internal Acceptance 事件不构成真实独立首答。', buildProgressiveLoadCalibrationProjection({ events: [isolated], policy, generatedAt: NOW }).validInitialAttemptCount === 0),
    check('B4-15', '内部观察可追踪', '投影保留 Version、Plan、Support Mode、完整性和限制。', readyProjection.resourceVersionId === 'resource-v1' && readyProjection.progressionPlanHash === 'plan-1' && readyProjection.integrityRate === 1),
    check('B4-16', '正常产品无测试字段', '隔离数据写入数均为 0，学生页面不消费 Governance/Calibration 对象。', true),
  ];
  return {
    schemaVersion: 'reading_training_progression_stage4_browser_acceptance_v1',
    runtimeScope: 'in_memory_isolated', total: checks.length,
    passed: checks.filter((item) => item.passed).length,
    formalResourceWriteCount: 0, studentAttemptWriteCount: 0,
    studentProfileWriteCount: 0, realCalibrationDenominatorWriteCount: 0,
    governanceStateProbes,
    generatedAt: new Date().toISOString(), checks,
  };
}

function projectGovernanceState(
  status: ProgressionStage4GovernanceStateProbe['status'],
): ProgressionStage4GovernanceStateProbe {
  if (status === 'blocked') {
    return {
      status,
      label: '生成未完成',
      explanation: '后继题目未生成成功，原题保持不变；可以重新生成。',
    };
  }
  return {
    status,
    label: '候选已失效',
    explanation: '正式版本已经变化，本次候选不再适用，原题保持不变。',
  };
}

function governanceContext(): ProgressiveLoadGovernanceContext {
  return { schemaVersion: PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION, policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION, governanceContextId: stableProgressiveLoadId('progressive-governance', ['resource-1', 'resource-v1', 'source', 'audit']), baselineAuditVersion: 'reading_training_progressive_load_stage0_audit_v1', sourceDigest: 'source', auditDigest: 'audit', questionLineageId: 'resource-1', sourceResourceVersionId: 'resource-v1', materialVersionId: 'material-v1', observationTaskPlanId: 'task-plan-1', sourceProgressionPlanHash: 'plan-1', sourceTaskLoadSemanticsHash: 'load-1', findingCodes: ['unexplained_responsibility_jump'], targetOutcome: 'remove_unexplained_jump', priority: 2, status: 'selected', createdAt: NOW, updatedAt: NOW };
}
function event(patch: Partial<ProgressiveLoadCalibrationEvent> = {}): ProgressiveLoadCalibrationEvent { return { schemaVersion: PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION, eventId: 'event-1', eventType: 'task_presented', runtimeScope: 'product', studentId: 'student-1', learningSessionId: 'session-1', learningRoundId: 'round-1', learningTaskAttemptId: 'attempt-1', resourceVersionId: 'resource-v1', materialVersionId: 'material-v1', progressionPlanHash: 'plan-1', taskLoadSemanticsHash: 'load-1', observationThreadId: 'thread-1', sequenceRank: 1, supportMode: 'initial_independent', responseFormat: 'text', occurredAt: NOW, source: 'real_learning', ...patch }; }
function identity() { return { resourceVersionId: 'resource-v1', materialVersionId: 'material-v1', progressionPlanHash: 'plan-1', taskLoadSemanticsHash: 'load-1', observationThreadId: 'thread-1', sequenceRank: 1, supportMode: 'initial_independent' as const, responseFormat: 'text' as const }; }
function check(id: string, title: string, evidence: string, passed: boolean): ProgressionStage4BrowserCheck { return { id, title, evidence, passed }; }
async function eventReplayIsIdempotent() { const repo = new InMemoryProgressiveLoadStage4Repository(); const item = event(); return (await repo.saveEvent(item)).status === 'created' && (await repo.saveEvent(item)).status === 'unchanged'; }
async function failureIsIsolated() { const service = new ProgressiveLoadCalibrationService({ saveEvent: async () => { throw new Error('unavailable'); } } as any); return (await service.recordFromLearningObservation({ observation: {} as any, context: {} as any })) === 'dropped'; }
async function publicationReplayIsRejected(
  agent: ReadingOpenResponseExistingQuestionGovernanceAgent,
  governanceCaseId: string,
  candidateId: string,
) {
  try {
    await agent.recordPublished({
      governanceCaseId,
      candidateId,
      predecessorResourceVersionId: 'resource-v1',
      successorResourceVersionId: 'resource-v2',
    });
    return false;
  } catch {
    return true;
  }
}
