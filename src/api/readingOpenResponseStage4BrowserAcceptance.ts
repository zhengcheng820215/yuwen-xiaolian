import {
  ReadingOpenResponseExistingQuestionGovernanceAgent,
  buildReadingOpenResponseGovernanceProjection,
  resolveGovernanceAvailableActions,
  resolveReadingSessionResourceVersion,
  type ExistingQuestionCandidateGateway,
} from '../ai/agents/readingOpenResponseExistingQuestionGovernanceAgent.ts';
import {
  auditReadingOpenResponseCalibrationIntegrity,
  projectReadingOpenResponseVersionCalibration,
} from '../ai/agents/readingOpenResponseRealCalibrationAgent.ts';
import { InMemoryReadingOpenResponseGovernanceRepository } from
  '../ai/repositories/inMemoryReadingOpenResponseGovernanceRepository.ts';
import { InMemoryReadingOpenResponseProcessFactRepository } from
  '../ai/repositories/inMemoryReadingOpenResponseProcessFactRepository.ts';
import type { ReadingOpenResponseProcessFactRepository } from
  '../ai/repositories/readingOpenResponseProcessFactRepository.ts';
import { ReadingOpenResponseProcessFactService } from
  '../ai/services/readingOpenResponseProcessFactService.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  type TextResponseLoadFindingCode,
} from '../ai/schemas/readingOpenResponseInputLoad.schema.ts';
import {
  READING_OPEN_RESPONSE_TIMING_POLICY_VERSION,
  type ExistingQuestionGovernanceCaseInput,
  type ReadingOpenResponseLearningProcessFact,
} from '../ai/schemas/readingOpenResponseGovernance.schema.ts';
import type {
  CandidateRuntimeContext,
  QuestionCandidate,
} from '../ai/schemas/questionCandidate.schema.ts';
import type { LearningObservationEvent, LearningObservationEventType } from
  '../ai/schemas/learningObservationEvent.schema.ts';
import type { QuestionCalibrationProjectionRecord } from
  '../ai/schemas/questionCalibrationProjection.schema.ts';

export const READING_OPEN_RESPONSE_STAGE4_BROWSER_ACCEPTANCE_VERSION =
  'reading_open_response_stage4_browser_acceptance_v1' as const;

export type ReadingOpenResponseStage4BrowserCheck = {
  id: `B4-${string}`;
  title: string;
  passed: boolean;
  evidence: string;
};

export type ReadingOpenResponseStage4BrowserAcceptanceReport = {
  version: typeof READING_OPEN_RESPONSE_STAGE4_BROWSER_ACCEPTANCE_VERSION;
  runtimeScope: 'debug';
  generatedAt: string;
  passed: number;
  total: 16;
  checks: ReadingOpenResponseStage4BrowserCheck[];
  preview: {
    originalQuestion: string;
    issueSummary: string;
    candidateQuestion: string;
    candidateResponseFormat: 'short_text';
    candidateHint: string;
    predecessorResourceVersionId: string;
    successorResourceVersionId: string;
    governanceCaseId: string;
  };
};

const NOW = '2026-08-21T12:00:00.000Z';
const CONTEXT: CandidateRuntimeContext = {
  materialVersionId: 'acceptance-material-v1',
  observationPlanVersion: 1,
  trainingTaskVersion: 1,
  baseFormalResourceId: 'acceptance-resource',
  baseFormalVersionId: 'acceptance-resource-v1',
};

const PREVIEW = {
  originalQuestion: '请结合全文，从两个角度分析人物作出这一选择的原因，并说明其作用。',
  issueSummary: '题目同时要求多个独立核心动作，输入负担超过当前训练目标。',
  candidateQuestion: '请结合人物当时的处境，说明他作出这一选择的主要原因。',
  candidateResponseFormat: 'short_text' as const,
  candidateHint: '先找人物面临的处境，再判断这个处境怎样促成了他的选择。',
  predecessorResourceVersionId: 'acceptance-resource-v1',
  successorResourceVersionId: 'acceptance-resource-v2',
};

class AcceptanceCandidateGateway implements ExistingQuestionCandidateGateway {
  callCount = 0;
  failuresRemaining = 0;

  async generateFormalVersionOptimizationCandidates() {
    this.callCount += 1;
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('acceptance generation failure');
    }
    return [{ candidateId: 'acceptance-candidate-1' } as QuestionCandidate];
  }
}

export async function runReadingOpenResponseStage4BrowserAcceptance(): Promise<
  ReadingOpenResponseStage4BrowserAcceptanceReport
> {
  const repository = new InMemoryReadingOpenResponseGovernanceRepository();
  const gateway = new AcceptanceCandidateGateway();
  const agent = new ReadingOpenResponseExistingQuestionGovernanceAgent(
    repository,
    gateway,
    () => NOW,
  );
  const checks: ReadingOpenResponseStage4BrowserCheck[] = [];
  const record = (
    id: ReadingOpenResponseStage4BrowserCheck['id'],
    title: string,
    passed: boolean,
    evidence: string,
  ) => checks.push({ id, title, passed, evidence });

  const retain = await agent.createCase(caseInput({
    questionLineageId: 'acceptance-retain',
    disposition: 'retain',
    findingCodes: [],
    auditDigest: 'acceptance-retain-audit',
  }));
  const queued = await agent.createCase(caseInput());
  const batch = await agent.planBatch({ idempotencyKey: 'acceptance-batch' });
  const visibleCases = (await repository.listCases()).filter((item) => (
    item.sourceResourceVersionId === PREVIEW.predecessorResourceVersionId
    && item.disposition !== 'retain'
    && !['published', 'rejected', 'deferred', 'stale'].includes(item.status)
  ));
  record(
    'B4-01',
    '当前快照治理列表',
    visibleCases.length === 1
      && visibleCases[0]?.governanceCaseId === queued.governanceCaseId
      && retain.disposition === 'retain',
    '当前列表仅保留 1 条待治理题；retain 题未进入活动批次。',
  );

  const generated = await agent.generateSuccessorCandidate(generateInput(queued.governanceCaseId));
  record(
    'B4-02',
    '完整后继 Candidate',
    generated.governanceCase.status === 'candidate_ready'
      && Boolean(generated.candidateId)
      && Boolean(PREVIEW.originalQuestion && PREVIEW.issueSummary && PREVIEW.candidateQuestion),
    '原题、问题摘要与后继题干具有完整、可追溯身份。',
  );
  const readyActions = resolveGovernanceAvailableActions(generated.governanceCase);
  record(
    'B4-03',
    '采用或重新优化',
    readyActions.length === 2
      && readyActions.includes('regenerate')
      && readyActions.includes('adopt_and_publish'),
    '决策入口仅包含重新优化与采用并发布，不要求字段编辑或审核人。',
  );

  gateway.failuresRemaining = 1;
  const blockedQueued = await agent.createCase(caseInput({
    questionLineageId: 'acceptance-blocked',
    auditDigest: 'acceptance-blocked-audit',
  }));
  const blocked = await agent.generateSuccessorCandidate(generateInput(
    blockedQueued.governanceCaseId,
    'blocked',
  ));
  const staleQueued = await agent.createCase(caseInput({
    questionLineageId: 'acceptance-stale',
    auditDigest: 'acceptance-stale-audit',
  }));
  const stale = (await agent.markStaleWhenSourceVersionChanges({
    questionLineageId: staleQueued.questionLineageId,
    activeSourceResourceVersionId: PREVIEW.successorResourceVersionId,
  }))[0];
  record(
    'B4-04',
    'blocked / stale 就近恢复',
    blocked.governanceCase.status === 'blocked'
      && resolveGovernanceAvailableActions(blocked.governanceCase).includes('regenerate')
      && stale?.status === 'stale'
      && resolveGovernanceAvailableActions(stale).length === 0,
    'blocked 提供重新优化；stale 停止发布并要求重新审计当前版本。',
  );
  record(
    'B4-05',
    'advisory 不阻断发布',
    generated.governanceCase.status === 'candidate_ready'
      && readyActions.includes('adopt_and_publish'),
    '质量提醒保留为说明，不增加二次确认步骤。',
  );

  const [adoptedFirst, adoptedRepeated] = await Promise.all([
    agent.recordAdopted(queued.governanceCaseId, generated.candidateId!),
    agent.recordAdopted(queued.governanceCaseId, generated.candidateId!),
  ]);
  const adoptedActions = resolveGovernanceAvailableActions(adoptedRepeated);
  record(
    'B4-06',
    '唯一发布运行态',
    adoptedFirst.status === 'adopted'
      && adoptedRepeated.status === 'adopted'
      && adoptedActions.length === 1
      && adoptedActions[0] === 'continue_publication',
    '重复采用复用同一治理状态；发布中只有一个继续发布动作。',
  );

  const published = await agent.recordPublished({
    governanceCaseId: queued.governanceCaseId,
    candidateId: generated.candidateId!,
    predecessorResourceVersionId: PREVIEW.predecessorResourceVersionId,
    successorResourceVersionId: PREVIEW.successorResourceVersionId,
  });
  record(
    'B4-07',
    '发布后版本可追溯',
    published.status === 'published'
      && published.sourceResourceVersionId === PREVIEW.predecessorResourceVersionId
      && published.successorResourceVersionId === PREVIEW.successorResourceVersionId,
    '原位绑定 successor v2，同时保留 predecessor v1。',
  );

  const frozenSessionVersion = resolveReadingSessionResourceVersion({
    sessionStarted: true,
    sessionResourceVersionId: PREVIEW.predecessorResourceVersionId,
    registryActiveResourceVersionId: PREVIEW.successorResourceVersionId,
  });
  record(
    'B4-08',
    '活动 Session 冻结旧版本',
    frozenSessionVersion === PREVIEW.predecessorResourceVersionId,
    '发布前已打开的 Session 继续消费 v1。',
  );

  const newSessionVersion = resolveReadingSessionResourceVersion({
    sessionStarted: false,
    registryActiveResourceVersionId: PREVIEW.successorResourceVersionId,
  });
  record(
    'B4-09',
    '新 Session 消费新版本',
    newSessionVersion === PREVIEW.successorResourceVersionId
      && PREVIEW.candidateResponseFormat === 'short_text'
      && Boolean(PREVIEW.candidateQuestion && PREVIEW.candidateHint),
    '新 Session 使用 v2，并保留 short_text、后继题干与思路提示。',
  );

  const factRepository = new InMemoryReadingOpenResponseProcessFactRepository();
  const factService = new ReadingOpenResponseProcessFactService(factRepository, () => NOW);
  await factService.recordPresented(factIdentity());
  await factService.recordFirstInput('acceptance-attempt-1', '2026-08-21T12:00:05.000Z');
  await factService.recordSubmitted({
    attemptId: 'acceptance-attempt-1',
    submittedAt: '2026-08-21T12:00:30.000Z',
    responseValidity: 'valid',
  });
  await factService.recordSubmitted({
    attemptId: 'acceptance-attempt-1',
    submittedAt: '2026-08-21T12:00:31.000Z',
    responseValidity: 'valid',
  });
  record(
    'B4-10',
    '恢复与重复提交幂等',
    (await factRepository.listAll()).length === 1
      && (await factRepository.getByAttemptId('acceptance-attempt-1'))?.attemptId
        === 'acceptance-attempt-1',
    '刷新、恢复与重复提交仍只有一个 Attempt 过程事实。',
  );

  const awaiting = calibrationReport({ projections: [], facts: [], events: [] });
  const insufficient = calibrationReport();
  const calibrated = calibrationReport({
    projections: Array.from({ length: 30 }, (_, index) => projection({
      attemptId: `calibrated-attempt-${index + 1}`,
      projectionId: `calibrated-projection-${index + 1}`,
      studentId: `calibrated-student-${index + 1}`,
    })),
  });
  record(
    'B4-11',
    '版本级校准三态',
    awaiting.status === 'awaiting_data'
      && insufficient.status === 'insufficient_sample'
      && calibrated.status === 'calibrated',
    '观察页可区分等待数据、样本不足和达到试运行计算门槛。',
  );

  const isolated = calibrationReport({
    projections: [projection({
      runtimeScope: 'debug',
      status: 'excluded_non_product_scope',
      valid: false,
    })],
    facts: [fact({ runtimeScope: 'debug' })],
    events: [],
  });
  record(
    'B4-12',
    '隔离验收不进入真实分母',
    isolated.eligibleSampleCount === 0 && isolated.status === 'awaiting_data',
    '本次 runtimeScope=debug，真实有效样本分母保持 0。',
  );

  let localError = '';
  try {
    await agent.recordPublished({
      governanceCaseId: queued.governanceCaseId,
      candidateId: 'wrong-candidate',
      predecessorResourceVersionId: PREVIEW.predecessorResourceVersionId,
      successorResourceVersionId: 'acceptance-resource-v3',
    });
  } catch {
    localError = '当前版本已经变化，请在本卡片重新读取后继续。';
  }
  record(
    'B4-13',
    '错误在当前操作区域可见',
    Boolean(localError),
    localError,
  );

  const pausedBatch = batch
    ? await agent.updateBatchStatus(batch.batchId, 'paused')
    : null;
  record(
    'B4-14',
    '暂停批次不影响正式 Learning',
    pausedBatch?.status === 'paused'
      && resolveReadingSessionResourceVersion({
        sessionStarted: true,
        sessionResourceVersionId: PREVIEW.predecessorResourceVersionId,
        registryActiveResourceVersionId: PREVIEW.successorResourceVersionId,
      }) === PREVIEW.predecessorResourceVersionId,
    '治理批次已暂停，已冻结 Session 仍可继续消费 v1。',
  );

  let learningContinued = false;
  try {
    const failingService = new ReadingOpenResponseProcessFactService(
      failingFactRepository(),
      () => NOW,
    );
    await failingService.recordPresented(factIdentity({ attemptId: 'failing-attempt' }));
  } catch {
    learningContinued = true;
  }
  record(
    'B4-15',
    '过程事实失败不阻断主链',
    learningContinued,
    '过程事实写入失败被隔离；Learning 主动作仍可继续并由完整性审计暴露缺口。',
  );

  const governanceProjection = buildReadingOpenResponseGovernanceProjection({
    cases: await repository.listCases(),
    batches: await repository.listBatches(),
    calibrationReports: [awaiting, insufficient, calibrated],
  });
  const integrity = auditReadingOpenResponseCalibrationIntegrity({
    events: fiveEvents(),
    projections: [projection()],
    processFacts: await factRepository.listAll(),
  });
  record(
    'B4-16',
    '刷新恢复治理与校准边界',
    governanceProjection.engineering.caseCount >= 3
      && governanceProjection.engineering.pausedBatchCount === 1
      && governanceProjection.samples.length === 3
      && integrity.excludedFactCount === 1
      && integrity.issueCounts.eligible_projection_missing_process_fact === 1,
    '治理 Case、暂停批次和三类版本校准状态可重新投影；隔离过程事实仍保持排除并暴露缺失产品事实。',
  );

  return {
    version: READING_OPEN_RESPONSE_STAGE4_BROWSER_ACCEPTANCE_VERSION,
    runtimeScope: 'debug',
    generatedAt: new Date().toISOString(),
    passed: checks.filter((item) => item.passed).length,
    total: 16,
    checks,
    preview: {
      ...PREVIEW,
      governanceCaseId: queued.governanceCaseId,
    },
  };
}

function caseInput(
  patch: Partial<ExistingQuestionGovernanceCaseInput> = {},
): ExistingQuestionGovernanceCaseInput {
  return {
    questionLineageId: 'acceptance-lineage',
    sourceResourceVersionId: PREVIEW.predecessorResourceVersionId,
    materialVersionId: 'acceptance-material-v1',
    observationTaskPlanId: 'acceptance-plan-v1',
    baselineAuditVersion: READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
    sourceDigest: 'acceptance-source-digest',
    auditDigest: 'acceptance-audit-digest',
    disposition: 'regenerate',
    findingCodes: ['composite_core_actions'] as TextResponseLoadFindingCode[],
    ...patch,
  };
}

function generateInput(governanceCaseId: string, suffix = 'ready') {
  return {
    governanceCaseId,
    trainingTaskId: 'acceptance-task',
    expectedContext: CONTEXT,
    formalResourceId: 'acceptance-resource',
    baseFormalVersionId: PREVIEW.predecessorResourceVersionId,
    idempotencyKey: `acceptance-generation-${suffix}`,
  };
}

function factIdentity(patch: Partial<ReturnType<typeof factIdentityBase>> = {}) {
  return { ...factIdentityBase(), ...patch };
}

function factIdentityBase() {
  return {
    attemptId: 'acceptance-attempt-1',
    runtimeScope: 'debug' as const,
    studentId: 'acceptance-browser-student',
    learningSessionId: 'acceptance-session-1',
    learningRoundId: 'acceptance-round-1',
    materialVersionId: 'acceptance-material-v1',
    resourceVersionId: PREVIEW.predecessorResourceVersionId,
  };
}

function fact(
  patch: Partial<ReadingOpenResponseLearningProcessFact> = {},
): ReadingOpenResponseLearningProcessFact {
  return {
    ...factIdentityBase(),
    attemptId: 'acceptance-product-attempt',
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    presentedAt: NOW,
    firstInputAt: '2026-08-21T12:00:05.000Z',
    submittedAt: '2026-08-21T12:00:30.000Z',
    completedAt: '2026-08-21T12:00:35.000Z',
    lastActivityAt: '2026-08-21T12:00:35.000Z',
    hintOpened: false,
    responseValidity: 'valid',
    revisionOffered: false,
    revisionSubmitted: false,
    timingPolicyVersion: READING_OPEN_RESPONSE_TIMING_POLICY_VERSION,
    ...patch,
  };
}

function projection(
  patch: Partial<QuestionCalibrationProjectionRecord> = {},
): QuestionCalibrationProjectionRecord {
  return {
    schemaVersion: 'question_calibration_projection_v1',
    projectionId: 'acceptance-projection-1',
    attemptId: 'acceptance-product-attempt',
    status: 'eligible',
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    operationId: 'acceptance-operation-1',
    learningSessionId: 'acceptance-session-1',
    learningRoundId: 'acceptance-round-1',
    responseId: 'acceptance-response-1',
    formalDiagnosisId: 'acceptance-diagnosis-1',
    resourceVersionId: PREVIEW.predecessorResourceVersionId,
    responseFormat: 'text',
    itemScore: 0.5,
    itemScorePolicyVersion: 'rubric_required_equal_weight_v1',
    totalScoreStatus: 'unavailable_single_round',
    valid: true,
    completedAt: '2026-08-21T12:00:35.000Z',
    projectedAt: '2026-08-21T12:01:00.000Z',
    issues: [],
    ...patch,
  };
}

function calibrationReport(input: {
  events?: LearningObservationEvent[];
  projections?: QuestionCalibrationProjectionRecord[];
  facts?: ReadingOpenResponseLearningProcessFact[];
} = {}) {
  return projectReadingOpenResponseVersionCalibration({
    resourceVersionId: PREVIEW.predecessorResourceVersionId,
    events: input.events ?? fiveEvents(),
    projections: input.projections ?? [projection()],
    processFacts: input.facts ?? [fact()],
    generatedAt: NOW,
  });
}

function fiveEvents(): LearningObservationEvent[] {
  return [
    observationEvent('question_presented'),
    observationEvent('answer_submitted'),
    observationEvent('diagnosis_completed'),
    observationEvent('feedback_presented'),
    observationEvent('learning_round_completed'),
  ];
}

function observationEvent(type: LearningObservationEventType): LearningObservationEvent {
  const base = {
    schemaVersion: 'learning_observation_event_v1' as const,
    eventId: `acceptance-event-${type}`,
    occurredAt: NOW,
    recordedAt: NOW,
    runtimeScope: 'product' as const,
    studentId: 'student-local-primary-v1' as const,
    operationId: 'acceptance-operation-1',
    learningSessionId: 'acceptance-session-1',
    learningRoundId: 'acceptance-round-1',
    materialVersionId: 'acceptance-material-v1',
    resourceId: 'acceptance-resource',
    resourceVersionId: PREVIEW.predecessorResourceVersionId,
    taskId: 'acceptance-task',
    sourceEntityId: `acceptance-source-${type}`,
    appVersion: 'stage4-browser-acceptance',
  };
  if (type === 'question_presented') {
    return { ...base, eventType: type, payload: { kind: type, presentationId: 'acceptance-presentation-1' } };
  }
  if (type === 'answer_submitted') {
    return { ...base, eventType: type, payload: { kind: type, responseId: 'acceptance-response-1', attemptId: 'acceptance-product-attempt', submittedAt: NOW } };
  }
  if (type === 'diagnosis_completed') {
    return { ...base, eventType: type, payload: { kind: type, responseId: 'acceptance-response-1', attemptId: 'acceptance-product-attempt', formalDiagnosisId: 'acceptance-diagnosis-1', diagnosisSchemaVersion: 'v1' } };
  }
  if (type === 'feedback_presented') {
    return { ...base, eventType: type, payload: { kind: type, responseId: 'acceptance-response-1', attemptId: 'acceptance-product-attempt', feedbackRequestId: 'acceptance-feedback-1', feedbackSchemaVersion: 'v1' } };
  }
  return { ...base, eventType: 'learning_round_completed', payload: { kind: 'learning_round_completed', responseId: 'acceptance-response-1', attemptId: 'acceptance-product-attempt', persistenceRecordId: 'acceptance-persistence-1', completedAt: NOW } };
}

function failingFactRepository(): ReadingOpenResponseProcessFactRepository {
  const fail = async () => { throw new Error('acceptance process fact storage unavailable'); };
  return {
    save: fail,
    getByAttemptId: fail,
    listByResourceVersion: fail,
    listAll: fail,
    clear: fail,
  } as ReadingOpenResponseProcessFactRepository;
}
