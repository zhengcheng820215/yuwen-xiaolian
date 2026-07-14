import {
  retryContinuousLearningPersistence,
  runContinuousLearning,
  type ContinuousLearningRunInput,
} from '../agents/continuousLearningRunAgent.ts';
import { summarizeGrowthMemory } from '../agents/growthMemorySummaryAgent.ts';
import { createLearningPersistenceRecord, restoreLearningState } from '../agents/learningPersistenceAgent.ts';
import { completeLearningRound } from '../agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import { applyProfileUpdateDecision } from '../agents/profileUpdateExecutor.ts';
import { buildStudentLearningFeedback } from '../agents/studentFeedbackAdapter.ts';
import { buildStudentLearningEntryState } from '../agents/studentLearningEntryAgent.ts';
import { buildStudentRoundSummary } from '../agents/studentRoundSummaryAdapter.ts';
import {
  createTaskResource,
  createTaskResourceDraft,
  prepareConcreteLearningTaskFromResource,
} from '../agents/taskResourcePreparationAgent.ts';
import { InMemoryLearningPersistenceRepository } from '../repositories/inMemoryLearningPersistenceRepository.ts';
import type { LearningPersistenceRepository } from '../repositories/learningPersistenceRepository.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import {
  isContinuousLearningRunResult,
  type ContinuousLearningRunOutput,
} from '../schemas/continuousLearningRun.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { GrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import type { LearningPersistenceRecord, RestoredLearningState } from '../schemas/learningPersistence.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { TaskResource } from '../schemas/taskResource.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildStudentAbilityProfileFixture,
  phase83StudentId,
} from './nextLearningStrategyDebugFixtures.ts';

const runAt = '2026-07-14T16:00:00.000Z';
const targetAbility = '推理';
const validAnswer = '父亲反复翻看旧书并在树下停留，说明这些物品让他想起过去陪孩子读书的时光，因此他感到怀念、不舍和牵挂。';

type DebugReport = {
  id: string;
  title: string;
  status: string;
  endReason: string;
  roundCount: number;
  completedRoundCount: number;
  transitionCount: number;
  persistenceStatuses: string[];
  pass: boolean;
  reasons: string[];
};

async function runDebug(): Promise<void> {
  const reports: DebugReport[] = [];
  reports.push(await caseNormalThreeRounds());
  reports.push(await caseSameAbilityTraceability());
  reports.push(await caseInvalidSecondResponse());
  reports.push(await caseNoAvailableTask());
  reports.push(await casePersistedStateDrivesNextRound());
  reports.push(await caseInvalidRestoreIdentity());
  reports.push(await caseDiagnosisMismatch());
  reports.push(await casePersistenceRetryWithoutRerun());

  const passed = reports.every((item) => item.pass);
  console.log('Phase 12.3 Continuous Learning Debug Report');
  console.log('============================================');
  console.log(`total: ${reports.length}`);
  console.log(`pass: ${reports.filter((item) => item.pass).length}`);
  console.log(`fail: ${reports.filter((item) => !item.pass).length}`);
  console.log('');

  reports.forEach((report) => {
    console.log(`[${report.pass ? 'PASS' : 'FAIL'}] ${report.id} ${report.title}`);
    console.log(`status / endReason: ${report.status} / ${report.endReason}`);
    console.log(`rounds: ${report.roundCount}, completed: ${report.completedRoundCount}`);
    console.log(`transitions: ${report.transitionCount}`);
    console.log(`persistence: ${report.persistenceStatuses.join(', ') || 'none'}`);
    console.log(`reasons: ${report.reasons.join(' | ') || 'none'}`);
    console.log('');
  });

  if (!passed) {
    console.error('[FAIL] Phase 12.3 Continuous Learning debug failed.');
    process.exitCode = 1;
    return;
  }
  console.log('[PASS] Phase 12.3 Continuous Learning debug passed.');
}

async function caseNormalThreeRounds(): Promise<DebugReport> {
  const fixture = await buildRunFixture();
  const output = await runContinuousLearning(fixture.input);
  const result = output.result;
  const pass = Boolean(
    isContinuousLearningRunResult(result) &&
    result.status === 'completed' &&
    result.endReason === 'max_rounds_reached' &&
    result.completedRoundCount === 3 &&
    result.rounds.length === 3 &&
    result.rounds.every((item) => item.persistenceStatus === 'saved') &&
    result.validation.noDuplicateRoundIds &&
    result.validation.noDuplicateEvidenceIds &&
    result.validation.persistedBetweenRounds,
  );
  return report('case_1', '正常三轮运行并达到计划轮数', output, pass);
}

async function caseSameAbilityTraceability(): Promise<DebugReport> {
  const fixture = await buildRunFixture();
  const output = await runContinuousLearning(fixture.input);
  const transitions = output.result.transitions;
  const pass = Boolean(
    transitions.length === 3 &&
    transitions.every((item) => (
      item.traceable &&
      item.targetAbilityId === targetAbility &&
      item.transitionType === 'collect_more_evidence' &&
      item.sourceStrategyAction === 'collect_more_evidence' &&
      item.sourceTaskRole === 'observation' &&
      item.fromPersistenceRecordId &&
      item.fromGrowthMemoryRecordIds.length > 0
    )),
  );
  return report('case_2', '同能力继续时仍由正式 Strategy / TaskRequest 驱动', output, pass);
}

async function caseInvalidSecondResponse(): Promise<DebugReport> {
  const fixture = await buildRunFixture({
    answers: [validAnswer, '不知道', validAnswer],
  });
  const output = await runContinuousLearning(fixture.input);
  const result = output.result;
  const second = result.rounds[1];
  const pass = Boolean(
    result.status === 'retry_required' &&
    result.endReason === 'response_retry_required' &&
    result.completedRoundCount === 1 &&
    result.rounds.length === 2 &&
    second?.status === 'retry_required' &&
    second.persistenceStatus === 'not_started' &&
    second.evidenceIds.length === 0,
  );
  return report('case_3', '第二轮无效作答阻断 Diagnosis 与后续轮次', output, pass);
}

async function caseNoAvailableTask(): Promise<DebugReport> {
  const fixture = await buildRunFixture({ resources: [] });
  const output = await runContinuousLearning(fixture.input);
  const pass = Boolean(
    output.result.status === 'blocked' &&
    output.result.endReason === 'no_available_task' &&
    output.result.completedRoundCount === 0 &&
    output.result.rounds[0]?.evidenceIds.length === 0,
  );
  return report('case_4', '没有正式任务资源时不创建可执行学习轮次', output, pass);
}

async function casePersistedStateDrivesNextRound(): Promise<DebugReport> {
  const fixture = await buildRunFixture();
  const output = await runContinuousLearning(fixture.input);
  const latest = output.result.latestPersistenceRecordId
    ? await fixture.repository.loadByRound(
      phase83StudentId,
      output.result.rounds[output.result.rounds.length - 1].learningRoundId,
    )
    : null;
  const uniqueTaskIds = new Set(output.result.rounds.map((item) => item.concreteTaskId));
  const pass = Boolean(
    latest &&
    latest.recordId === output.result.latestPersistenceRecordId &&
    output.result.transitions.slice(1).every((item, index) => (
      item.fromLearningRoundId === output.result.rounds[index].learningRoundId &&
      item.fromPersistenceRecordId === output.result.rounds[index].persistenceRecordId
    )) &&
    uniqueTaskIds.size === 3,
  );
  return report('case_5', '保存并恢复后的正式结果成为下一轮输入', output, pass);
}

async function caseInvalidRestoreIdentity(): Promise<DebugReport> {
  const fixture = await buildRunFixture();
  const record = fixture.restored.restoredRecord!;
  const corrupted = restoreLearningState({
    ...record,
    studentId: 'other-student',
  }, phase83StudentId);
  const output = await runContinuousLearning({
    ...fixture.input,
    restoredLearningState: corrupted,
  });
  const pass = Boolean(
    output.result.status === 'blocked' &&
    output.result.completedRoundCount === 0 &&
    output.result.rounds.length === 0 &&
    output.result.validation.issues.some((item) => item.includes('RestoredLearningState')),
  );
  return report('case_6', '损坏或身份不一致的恢复记录被阻断', output, pass);
}

async function caseDiagnosisMismatch(): Promise<DebugReport> {
  const fixture = await buildRunFixture({ diagnosisAbilities: ['表达', targetAbility, targetAbility] });
  const output = await runContinuousLearning(fixture.input);
  const pass = Boolean(
    output.result.status === 'review_required' &&
    output.result.endReason === 'review_required' &&
    output.result.completedRoundCount === 0 &&
    output.result.rounds[0]?.status === 'review_required' &&
    output.result.rounds[0]?.evidenceIds.length === 0,
  );
  return report('case_7', 'Diagnosis 能力不一致时进入复核且不污染 Evidence', output, pass);
}

async function casePersistenceRetryWithoutRerun(): Promise<DebugReport> {
  const fixture = await buildRunFixture();
  const failOnce = new FailOnceRepository(fixture.repository, '-round-1');
  const output = await runContinuousLearning({
    ...fixture.input,
    repository: failOnce,
  });
  const pending = output.pendingPersistence;
  const evidenceIdsBeforeRetry = output.updatedEvidence.map((item) => item.id);
  const diagnosisIdBeforeRetry = pending?.record.learningRoundResult?.taskEvidenceReturnResult?.diagnosisResultId;
  const retry = pending
    ? await retryContinuousLearningPersistence(failOnce, pending)
    : { saved: false, issues: ['Missing pending persistence record.'] };
  const saved = pending
    ? await failOnce.loadByRound(pending.record.studentId, pending.record.learningRoundId)
    : null;
  const evidenceIdsAfterRetry = saved?.learningRoundResult?.taskEvidenceReturnResult?.abilityEvidence.map((item) => item.id) || [];
  const diagnosisIdAfterRetry = saved?.learningRoundResult?.taskEvidenceReturnResult?.diagnosisResultId;
  const pass = Boolean(
    output.result.status === 'retry_required' &&
    output.result.endReason === 'persistence_failed' &&
    pending &&
    retry.saved &&
    retry.restoredState?.resumeMode === 'start_next_round' &&
    diagnosisIdBeforeRetry === diagnosisIdAfterRetry &&
    evidenceIdsAfterRetry.every((id) => evidenceIdsBeforeRetry.includes(id)) &&
    failOnce.failedSaveCount === 1 &&
    failOnce.successfulSaveCount === 1,
  );
  return report('case_8', '保存失败只重试持久化，不重跑 Diagnosis', output, pass, retry.issues);
}

async function buildRunFixture(options: {
  answers?: string[];
  resources?: TaskResource[];
  diagnosisAbilities?: string[];
} = {}): Promise<{
  repository: InMemoryLearningPersistenceRepository;
  restored: RestoredLearningState;
  input: ContinuousLearningRunInput;
}> {
  const repository = new InMemoryLearningPersistenceRepository();
  const resources = options.resources ?? buildObservationResources(4);
  const seed = await buildSeedState(repository, resources[0] || buildObservationResources(1)[0]);
  const runResources = options.resources === undefined ? resources.slice(1) : resources;
  const answers = options.answers || [validAnswer, validAnswer, validAnswer];
  const diagnosisAbilities = options.diagnosisAbilities || [targetAbility, targetAbility, targetAbility];

  return {
    repository,
    restored: seed.restored,
    input: {
      runId: `phase12-3-${stableId(`${answers.join('|')}-${diagnosisAbilities.join('|')}-${runResources.length}`)}`,
      studentId: phase83StudentId,
      restoredLearningState: seed.restored,
      growthMemoryRecords: [seed.growthMemoryRecord],
      growthMemorySummary: seed.growthMemorySummary,
      studentAbilityProfile: seed.profile,
      currentLearningContext: buildCurrentLearningContextFixture({
        currentPhase: 'observation',
        targetAbilityId: targetAbility,
        allowTraining: true,
        allowRetest: true,
        allowTransfer: true,
      }),
      availableTaskResources: runResources,
      submissions: answers.map((answer, index) => ({
        studentAnswer: { answerText: answer },
        diagnosisResult: buildDiagnosisResult(diagnosisAbilities[index] || targetAbility, 'does_not_meet'),
        diagnosisResultId: `phase12-3-diagnosis-${index + 1}`,
        completedAt: new Date(Date.parse(runAt) + (index + 1) * 60_000).toISOString(),
      })),
      previousEvidence: seed.evidence,
      maxRounds: 3,
      repository,
      startedAt: runAt,
    },
  };
}

async function buildSeedState(
  repository: InMemoryLearningPersistenceRepository,
  resource: TaskResource,
): Promise<{
  restored: RestoredLearningState;
  growthMemoryRecord: GrowthMemoryRecord;
  growthMemorySummary: ReturnType<typeof summarizeGrowthMemory>;
  profile: StudentAbilityProfile;
  evidence: AbilityEvidence[];
}> {
  const profile = buildStudentAbilityProfileFixture();
  const previousEvidence = buildPreviousEvidence();
  const initialGrowthRecord = buildInitialGrowthRecord(profile);
  const initialSummary = summarizeGrowthMemory({
    studentId: phase83StudentId,
    abilityId: targetAbility,
    records: [initialGrowthRecord],
  });
  const start = startLearningRound({
    studentAbilityProfile: profile,
    growthMemorySummary: initialSummary,
    currentLearningContext: buildCurrentLearningContextFixture({ currentPhase: 'observation' }),
    availableTaskResources: [resource.availableTaskResource],
    learningRoundId: 'phase12-3-seed-round',
    createdAt: new Date(Date.parse(runAt) - 120_000).toISOString(),
  });
  if (!start.taskFulfillmentRequest) throw new Error(`Seed start failed: ${start.issues.join(' ')}`);
  const prepared = prepareConcreteLearningTaskFromResource({
    resource,
    fulfillmentRequest: start.taskFulfillmentRequest,
    createdAt: new Date(Date.parse(runAt) - 120_000).toISOString(),
  });
  if (!prepared.concreteTaskResult.concreteTask || !prepared.concreteTaskResult.readiness.canExecute) {
    throw new Error('Seed TaskResource could not produce a ready ConcreteLearningTask.');
  }
  const hydratedStart = {
    ...start,
    concreteTask: prepared.concreteTaskResult.concreteTask,
    taskReadinessValidation: prepared.concreteTaskResult.readiness,
  };
  const execution = executeLearningRound({
    startResult: hydratedStart,
    studentAnswer: { answerText: validAnswer },
  });
  const completedAt = new Date(Date.parse(runAt) - 60_000).toISOString();
  const round = completeLearningRound({
    executionResult: execution,
    concreteTask: prepared.concreteTaskResult.concreteTask,
    previousEvidence,
    currentProfile: profile,
    diagnosisResult: buildDiagnosisResult(targetAbility, 'does_not_meet'),
    diagnosisResultId: 'phase12-3-seed-diagnosis',
    completedAt,
  });
  const returned = round.taskEvidenceReturnResult;
  if (!returned?.growthMemoryRecord || !returned.profileUpdateDecision) {
    throw new Error(`Seed completion failed: ${round.issues.join(' ')}`);
  }
  const afterProfile = applyProfileUpdateDecision({
    currentProfile: profile,
    decision: returned.profileUpdateDecision,
    appliedAt: completedAt,
  }).afterProfile;
  const evidence = dedupeEvidence([...previousEvidence, ...returned.abilityEvidence]);
  const growthMemorySummary = summarizeGrowthMemory({
    studentId: phase83StudentId,
    abilityId: targetAbility,
    records: [returned.growthMemoryRecord],
  });
  const entry = buildStudentLearningEntryState({ startResult: hydratedStart, answerDraft: validAnswer });
  const feedback = buildStudentLearningFeedback({ entryState: entry, learningRoundResult: round });
  const summary = buildStudentRoundSummary({
    learningRoundResult: round,
    studentLearningFeedback: feedback,
    studentLearningEntryState: entry,
  });
  const record = createLearningPersistenceRecord({
    studentId: phase83StudentId,
    learningRoundId: round.learningRoundId,
    savedAt: completedAt,
    updatedAt: completedAt,
    learningRoundResult: round,
    concreteTask: prepared.concreteTaskResult.concreteTask,
    studentResponse: execution.studentResponse,
    studentLearningFeedback: feedback,
    studentRoundSummary: summary,
    growthMemoryRecord: returned.growthMemoryRecord,
    growthMemorySummary,
    studentAbilityProfile: afterProfile,
  });
  await repository.save(record);
  const restored = restoreLearningState(await repository.loadByRound(phase83StudentId, round.learningRoundId), phase83StudentId);
  if (!restored.canResume || restored.resumeMode !== 'start_next_round') {
    throw new Error(`Seed restore failed: ${restored.validation.issues.join(' ')}`);
  }
  return {
    restored,
    growthMemoryRecord: returned.growthMemoryRecord,
    growthMemorySummary,
    profile: afterProfile,
    evidence,
  };
}

function buildObservationResources(count: number): TaskResource[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `phase12-3-resource-${index + 1}`;
    const draft = createTaskResourceDraft({
      draftId: `draft-${id}`,
      createdAt: runAt,
      input: {
        title: `推理观察题 ${index + 1}`,
        readingText: `父亲在整理旧书时停了很久，又轻轻抚平夹在书中的树叶。第 ${index + 1} 个新情境中，他把书放回原位后久久没有离开。`,
        questionText: '结合父亲的行为，推断他的心理，并说明文本依据。',
        answerRequirements: ['写出人物心理。', '引用至少一处文本行为作为依据。', '说明依据与结论之间的关系。'],
        questionType: 'reading_open_response',
        targetAbilityId: targetAbility,
        referenceAnswer: '父亲想起过去和孩子共同读书的时光，内心怀念、不舍；反复整理和停留是推断依据。',
        assessmentBasis: ['是否提取人物行为线索。', '是否从线索推出人物心理。', '是否说明依据与结论之间的关系。'],
        source: {
          type: 'manual',
          description: `Phase 12.3 Debug 正式资源 ${index + 1}`,
        },
      },
    });
    const created = createTaskResource({
      draft,
      resourceId: id,
      taskRole: 'observation',
      createdAt: runAt,
    });
    if (!created.resource) throw new Error(`Could not create TaskResource ${id}.`);
    return {
      ...created.resource,
      availableTaskResource: {
        ...created.resource.availableTaskResource,
        contentType: 'diagnostic_text',
        capabilities: [
          'open_response',
          'ability_observation',
          'text_evidence',
          'inference_chain',
          'independent_answer',
        ],
        validationTags: ['general_validation'],
      },
    };
  });
}

function buildDiagnosisResult(
  mainAbility: string,
  answerStatus: DiagnosisResult['answerStatus'],
): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: answerStatus === 'fully_meets' ? true : false,
    strategyUsed: 'phase12_3_mock_diagnosis',
    answerStatus,
    scoreBand: answerStatus === 'fully_meets' ? 'high' : answerStatus === 'partially_meets' ? 'medium' : 'low',
    rubricItems: [],
    matchedRubricItems: ['文本线索'],
    missingRubricItems: ['推理链说明'],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: '答案提到部分线索，但推理链说明仍不完整。',
    rootCause: '学生尚未完整建立“文本线索 -> 人物心理 -> 结论表达”的推理链。',
    errorType: '推理错误',
    abilityEvidence: ['学生能够提到线索，但没有完整解释线索与结论的关系。'],
    diagnosisSummary: '本次作答形成推理薄弱证据。',
    nextTraining: '继续收集同能力表现证据。',
    confidence: 0.74,
  };
}

function buildPreviousEvidence(): AbilityEvidence[] {
  return [{
    id: 'phase12-3-prev-evidence',
    studentId: phase83StudentId,
    ability: targetAbility,
    evidenceType: 'weakness',
    reason: 'reasoning_error',
    detail: '学生此前未完整说明文本线索与人物心理的关系。',
    source: 'diagnosis',
    observation: '回答停留在表层行为描述。',
    rootCause: '推理链不完整。',
    confidence: 0.72,
    createdAt: new Date(Date.parse(runAt) - 300_000).toISOString(),
    taskId: 'phase12-3-previous-task',
    diagnosisId: 'phase12-3-previous-diagnosis',
  }];
}

function buildInitialGrowthRecord(profile: StudentAbilityProfile): GrowthMemoryRecord {
  return {
    recordId: 'phase12-3-initial-growth-record',
    studentId: phase83StudentId,
    abilityId: targetAbility,
    abilityLabel: targetAbility,
    createdAt: new Date(Date.parse(runAt) - 240_000).toISOString(),
    evaluationResultId: 'phase12-3-initial-evaluation',
    profileUpdateDecisionId: 'phase12-3-initial-decision',
    evidenceLinks: profile.evidence_links.map((item) => item.evidenceId),
    action: 'append_evidence_only',
    beforeProfileSummary: {
      abilityId: targetAbility,
      abilityStatus: 'weak',
      evidenceCount: profile.evidence_links.length,
      summary: '初始画像仍需继续观察。',
    },
    afterProfileSummary: {
      abilityId: targetAbility,
      abilityStatus: 'weak',
      evidenceCount: profile.evidence_links.length,
      summary: '仅追加历史证据，画像状态不变。',
    },
    reason: '当前只形成历史薄弱证据，需要继续观察。',
    limitations: ['当前记录数量有限。'],
    nextAction: '继续收集有效证据。',
    sourceRuntime: 'phase12_3_debug_seed',
    relatedSessionId: 'phase12-3-seed-session',
  };
}

function report(
  id: string,
  title: string,
  output: ContinuousLearningRunOutput,
  pass: boolean,
  extraReasons: string[] = [],
): DebugReport {
  return {
    id,
    title,
    status: output.result.status,
    endReason: output.result.endReason,
    roundCount: output.result.rounds.length,
    completedRoundCount: output.result.completedRoundCount,
    transitionCount: output.result.transitions.length,
    persistenceStatuses: output.result.rounds.map((item) => item.persistenceStatus),
    pass,
    reasons: pass ? [] : [...output.result.validation.issues, ...extraReasons],
  };
}

class FailOnceRepository implements LearningPersistenceRepository {
  failedSaveCount = 0;
  successfulSaveCount = 0;
  private failed = false;
  private readonly delegate: LearningPersistenceRepository;
  private readonly failRoundFragment: string;

  constructor(
    delegate: LearningPersistenceRepository,
    failRoundFragment: string,
  ) {
    this.delegate = delegate;
    this.failRoundFragment = failRoundFragment;
  }

  async save(record: LearningPersistenceRecord): Promise<LearningPersistenceRecord> {
    if (!this.failed && record.learningRoundId.includes(this.failRoundFragment)) {
      this.failed = true;
      this.failedSaveCount += 1;
      throw new Error('Simulated persistence failure.');
    }
    this.successfulSaveCount += 1;
    return this.delegate.save(record);
  }

  loadLatest(studentId: string): Promise<LearningPersistenceRecord | null> {
    return this.delegate.loadLatest(studentId);
  }

  loadByRound(studentId: string, learningRoundId: string): Promise<LearningPersistenceRecord | null> {
    return this.delegate.loadByRound(studentId, learningRoundId);
  }

  listByStudent(studentId: string): Promise<LearningPersistenceRecord[]> {
    return this.delegate.listByStudent(studentId);
  }

  clear(studentId: string): Promise<void> {
    return this.delegate.clear(studentId);
  }
}

function dedupeEvidence(items: AbilityEvidence[]): AbilityEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function stableId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

runDebug().catch((error) => {
  console.error('[FAIL] Phase 12.3 debug crashed.');
  console.error(error);
  process.exitCode = 1;
});
