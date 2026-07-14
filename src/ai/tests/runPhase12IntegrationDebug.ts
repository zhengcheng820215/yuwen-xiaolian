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
import { InMemoryTaskResourceRepository } from '../repositories/inMemoryTaskResourceRepository.ts';
import type { LearningPersistenceRepository } from '../repositories/learningPersistenceRepository.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { ContinuousLearningRunOutput } from '../schemas/continuousLearningRun.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { GrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import type { RestoredLearningState } from '../schemas/learningPersistence.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { TaskResource } from '../schemas/taskResource.schema.ts';
import { PHASE12_INTEGRATION_RESOURCES } from '../../data/phase12IntegrationResources.ts';
import {
  buildCurrentLearningContextFixture,
  buildStudentAbilityProfileFixture,
} from './nextLearningStrategyDebugFixtures.ts';

const RUN_AT = '2026-07-14T18:00:00.000Z';
const STUDENT_ID = 'phase12-integration-student';
const TARGET_ABILITY = '推理';
const VALID_ANSWER = '文中的人物反复整理旧物并停留很久，说明旧物让他想起过去的经历，因此内心怀念、不舍，也很珍惜这些回忆。';

type CountSnapshot = {
  evidenceCount: number;
  growthMemoryRecordCount: number;
  profileUpdateApplicationCount: number;
  persistenceRecordCount: number;
  completedRoundCount: number;
};

type CaseReport = {
  id: string;
  title: string;
  passed: boolean;
  status: string;
  reasons: string[];
};

async function run(): Promise<void> {
  const normal = await runNormalIntegration();
  const reports: CaseReport[] = [
    normal.report,
    await caseDuplicateSave(normal),
    await caseRestoreIsIdempotent(normal),
    await caseDuplicateResponse(),
    await caseInvalidAnswer(),
    await casePersistenceFailure(),
    await caseNoMatchingResource(),
    await caseIdentityMismatch(),
    await caseDiagnosisMismatch(),
  ];
  const passed = reports.every((item) => item.passed);

  printIntegrationReport(normal, reports);
  if (!passed) {
    console.error('[FAIL] Phase 12 Integrated Acceptance failed.');
    process.exitCode = 1;
    return;
  }
  console.log('[PASS] Phase 12 Integrated Acceptance passed.');
}

async function runNormalIntegration(): Promise<{
  report: CaseReport;
  output: ContinuousLearningRunOutput;
  learningRepository: InMemoryLearningPersistenceRepository;
  resourceRepository: InMemoryTaskResourceRepository;
  restored: RestoredLearningState;
  before: CountSnapshot;
  after: CountSnapshot;
  resources: TaskResource[];
}> {
  const fixture = await buildFixture();
  const before = await countState(fixture.learningRepository, fixture.seedEvidence.length);
  const output = await runContinuousLearning(fixture.input);
  const after = await countState(fixture.learningRepository, output.updatedEvidence.length);
  const rounds = output.result.rounds;
  const resources = await fixture.resourceRepository.listResources();
  const roundResources = rounds.map((item) => item.resourceId);
  const resourceOne = PHASE12_INTEGRATION_RESOURCES[0].resourceId;
  const resourceTwo = PHASE12_INTEGRATION_RESOURCES[1].resourceId;
  const allIds = [
    ...rounds.map((item) => item.learningRoundId),
    ...rounds.map((item) => item.responseId || ''),
    ...rounds.flatMap((item) => item.evidenceIds),
    ...rounds.map((item) => item.growthMemoryRecordId || ''),
  ].filter(Boolean);
  const pass = Boolean(
    output.result.status === 'completed' &&
    output.result.completedRoundCount === 2 &&
    rounds.length === 2 &&
    roundResources[0] === resourceOne &&
    roundResources[1] === resourceTwo &&
    rounds.every((item) => item.persistenceStatus === 'saved') &&
    output.result.transitions[1]?.fromPersistenceRecordId === rounds[0].persistenceRecordId &&
    output.result.transitions[1]?.fromGrowthMemoryRecordIds.includes(rounds[0].growthMemoryRecordId || '') &&
    output.result.transitions[1]?.nextLearningStrategyId !== output.result.transitions[0]?.nextLearningStrategyId &&
    output.result.transitions[1]?.taskRequestId !== output.result.transitions[0]?.taskRequestId &&
    after.evidenceCount - before.evidenceCount === 2 &&
    after.growthMemoryRecordCount - before.growthMemoryRecordCount === 2 &&
    after.profileUpdateApplicationCount - before.profileUpdateApplicationCount === 2 &&
    after.persistenceRecordCount - before.persistenceRecordCount === 2 &&
    new Set(allIds).size === allIds.length,
  );

  return {
    report: caseReport('case_1', '正常双轮真实资源链路', output.result.status, pass),
    output,
    learningRepository: fixture.learningRepository,
    resourceRepository: fixture.resourceRepository,
    restored: fixture.restored,
    before,
    after,
    resources,
  };
}

async function caseDuplicateSave(normal: Awaited<ReturnType<typeof runNormalIntegration>>): Promise<CaseReport> {
  const lastRound = normal.output.result.rounds[1];
  if (!lastRound) {
    return caseReport('case_2', '重复保存同一结果保持幂等', 'missing_round_2', false, normal.output.result.validation.issues);
  }
  const record = await normal.learningRepository.loadByRound(STUDENT_ID, lastRound.learningRoundId);
  const before = await countState(normal.learningRepository, normal.output.updatedEvidence.length);
  if (record) await normal.learningRepository.save(record);
  const after = await countState(normal.learningRepository, normal.output.updatedEvidence.length);
  const pass = Boolean(record && sameCounts(before, after));
  return caseReport('case_2', '重复保存同一结果保持幂等', pass ? 'idempotent' : 'changed', pass);
}

async function caseRestoreIsIdempotent(normal: Awaited<ReturnType<typeof runNormalIntegration>>): Promise<CaseReport> {
  const lastRound = normal.output.result.rounds[1];
  if (!lastRound) {
    return caseReport('case_3', '刷新恢复不重新运行 Diagnosis 或复制正式数据', 'missing_round_2', false, normal.output.result.validation.issues);
  }
  const record = await normal.learningRepository.loadByRound(STUDENT_ID, lastRound.learningRoundId);
  const before = await countState(normal.learningRepository, normal.output.updatedEvidence.length);
  const restoredOne = restoreLearningState(record, STUDENT_ID);
  const restoredTwo = restoreLearningState(record, STUDENT_ID);
  const after = await countState(normal.learningRepository, normal.output.updatedEvidence.length);
  const pass = Boolean(
    restoredOne.canResume &&
    restoredTwo.canResume &&
    restoredOne.learningRoundId === lastRound.learningRoundId &&
    restoredTwo.learningRoundId === lastRound.learningRoundId &&
    sameCounts(before, after),
  );
  return caseReport('case_3', '刷新恢复不重新运行 Diagnosis 或复制正式数据', pass ? 'restored' : 'changed', pass);
}

async function caseDuplicateResponse(): Promise<CaseReport> {
  const fixture = await buildFixture();
  const duplicateResponseId = fixture.restored.restoredRecord?.studentResponse?.responseId || 'missing-seed-response';
  fixture.input.submissions[0].responseOverrides = { responseId: duplicateResponseId };
  const output = await runContinuousLearning(fixture.input);
  const pass = Boolean(
    output.result.status === 'retry_required' &&
    output.result.completedRoundCount === 0 &&
    output.updatedEvidence.length === fixture.seedEvidence.length &&
    output.result.validation.issues.some((item) => item.includes('duplicate_response')),
  );
  return caseReport('case_4', '重复 responseId 被拒绝且不产生第二份 Evidence', output.result.status, pass, output.result.validation.issues);
}

async function caseInvalidAnswer(): Promise<CaseReport> {
  const fixture = await buildFixture();
  fixture.input.submissions[0].studentAnswer = { answerText: '不知道' };
  const output = await runContinuousLearning(fixture.input);
  const pass = Boolean(
    output.result.status === 'retry_required' &&
    output.result.completedRoundCount === 0 &&
    output.result.rounds[0]?.evidenceIds.length === 0 &&
    output.updatedEvidence.length === fixture.seedEvidence.length,
  );
  return caseReport('case_5', '占位回答阻断 Diagnosis 且不生成 weakness Evidence', output.result.status, pass);
}

async function casePersistenceFailure(): Promise<CaseReport> {
  const fixture = await buildFixture();
  const failOnce = new FailOnceLearningRepository(fixture.learningRepository);
  const output = await runContinuousLearning({ ...fixture.input, repository: failOnce });
  const diagnosisId = output.pendingPersistence?.record.learningRoundResult?.taskEvidenceReturnResult?.diagnosisResultId;
  const retry = output.pendingPersistence
    ? await retryContinuousLearningPersistence(failOnce, output.pendingPersistence)
    : { saved: false, issues: ['Missing pending persistence.'] };
  const saved = output.pendingPersistence
    ? await failOnce.loadByRound(STUDENT_ID, output.pendingPersistence.record.learningRoundId)
    : null;
  const savedDiagnosisId = saved?.learningRoundResult?.taskEvidenceReturnResult?.diagnosisResultId;
  const pass = Boolean(
    output.result.status === 'retry_required' &&
    output.result.completedRoundCount === 1 &&
    output.result.rounds.length === 1 &&
    retry.saved &&
    diagnosisId === savedDiagnosisId &&
    failOnce.failedSaveCount === 1 &&
    failOnce.successfulSaveCount === 1,
  );
  return caseReport('case_6', '保存失败只重试持久化，不重跑 Diagnosis', output.result.status, pass, retry.issues);
}

async function caseNoMatchingResource(): Promise<CaseReport> {
  const fixture = await buildFixture();
  await fixture.resourceRepository.clear();
  const output = await runContinuousLearning(fixture.input);
  const pass = Boolean(
    output.result.status === 'blocked' &&
    output.result.endReason === 'no_available_task' &&
    output.result.completedRoundCount === 0 &&
    !output.result.rounds[0]?.executionSessionId,
  );
  return caseReport('case_7', '没有可匹配资源时阻断且不伪造任务', output.result.status, pass);
}

async function caseIdentityMismatch(): Promise<CaseReport> {
  const fixture = await buildFixture();
  const output = await runContinuousLearning({
    ...fixture.input,
    restoredLearningState: {
      ...fixture.restored,
      studentId: 'other-student',
    },
  });
  const pass = Boolean(
    output.result.status === 'review_required' &&
    output.result.rounds.length === 0 &&
    output.result.completedRoundCount === 0,
  );
  return caseReport('case_8', 'studentId 不一致时阻断且不生成 Transition', output.result.status, pass);
}

async function caseDiagnosisMismatch(): Promise<CaseReport> {
  const fixture = await buildFixture();
  fixture.input.submissions[0].diagnosisResult = buildDiagnosisResult('表达');
  const output = await runContinuousLearning(fixture.input);
  const pass = Boolean(
    output.result.status === 'review_required' &&
    output.result.completedRoundCount === 0 &&
    output.result.rounds[0]?.evidenceIds.length === 0 &&
    output.result.rounds.length === 1,
  );
  return caseReport('case_9', 'Diagnosis 能力错位进入复核且不驱动下一轮', output.result.status, pass);
}

async function buildFixture(): Promise<{
  input: ContinuousLearningRunInput;
  restored: RestoredLearningState;
  seedEvidence: AbilityEvidence[];
  learningRepository: InMemoryLearningPersistenceRepository;
  resourceRepository: InMemoryTaskResourceRepository;
}> {
  const resourceRepository = new InMemoryTaskResourceRepository();
  await prepareFormalResources(resourceRepository);
  const resources = await resourceRepository.listResources();
  const learningRepository = new InMemoryLearningPersistenceRepository();
  const seed = await buildSeedState(learningRepository, resources[2]);

  return {
    restored: seed.restored,
    seedEvidence: seed.evidence,
    learningRepository,
    resourceRepository,
    input: {
      runId: 'phase12-integration-run',
      studentId: STUDENT_ID,
      restoredLearningState: seed.restored,
      growthMemoryRecords: [seed.growthMemoryRecord],
      growthMemorySummary: seed.growthMemorySummary,
      studentAbilityProfile: seed.profile,
      currentLearningContext: buildCurrentLearningContextFixture({
        contextId: 'phase12-integration-context',
        studentId: STUDENT_ID,
        currentPhase: 'observation',
        targetAbilityId: TARGET_ABILITY,
        allowTraining: true,
        allowRetest: true,
        allowTransfer: true,
      }),
      availableTaskResources: [],
      taskResourceRepository: resourceRepository,
      submissions: [
        {
          studentAnswer: { answerText: VALID_ANSWER },
          diagnosisResult: buildDiagnosisResult(TARGET_ABILITY),
          diagnosisResultId: 'phase12-integration-diagnosis-1',
          completedAt: '2026-07-14T18:01:00.000Z',
        },
        {
          studentAnswer: { answerText: VALID_ANSWER },
          diagnosisResult: buildDiagnosisResult(TARGET_ABILITY),
          diagnosisResultId: 'phase12-integration-diagnosis-2',
          completedAt: '2026-07-14T18:02:00.000Z',
        },
      ],
      previousEvidence: seed.evidence,
      maxRounds: 2,
      repository: learningRepository,
      startedAt: RUN_AT,
    },
  };
}

async function prepareFormalResources(repository: InMemoryTaskResourceRepository): Promise<void> {
  for (const definition of PHASE12_INTEGRATION_RESOURCES) {
    const draft = createTaskResourceDraft({
      input: definition.input,
      draftId: `draft-${definition.resourceId}`,
      createdAt: RUN_AT,
    });
    await repository.saveDraft(draft);
    const created = createTaskResource({
      draft,
      existingResourceIds: (await repository.listResources()).map((item) => item.resourceId),
      resourceId: definition.resourceId,
      taskRole: definition.taskRole,
      createdAt: RUN_AT,
    });
    if (!created.resource || !created.validation.canEnterTaskFulfillment) {
      throw new Error(`Phase 12.2 validation failed for ${definition.resourceId}.`);
    }
    await repository.saveResource(created.resource);
  }
}

async function buildSeedState(
  repository: InMemoryLearningPersistenceRepository,
  resource: TaskResource,
): Promise<{
  restored: RestoredLearningState;
  evidence: AbilityEvidence[];
  growthMemoryRecord: GrowthMemoryRecord;
  growthMemorySummary: ReturnType<typeof summarizeGrowthMemory>;
  profile: StudentAbilityProfile;
}> {
  const profile = withStudentId(buildStudentAbilityProfileFixture(), STUDENT_ID);
  const initialEvidence = [buildInitialEvidence()];
  const initialGrowthRecord = buildInitialGrowthRecord(profile);
  const initialSummary = summarizeGrowthMemory({
    studentId: STUDENT_ID,
    abilityId: TARGET_ABILITY,
    records: [initialGrowthRecord],
  });
  const start = startLearningRound({
    studentAbilityProfile: profile,
    growthMemorySummary: initialSummary,
    currentLearningContext: buildCurrentLearningContextFixture({
      studentId: STUDENT_ID,
      currentPhase: 'observation',
      targetAbilityId: TARGET_ABILITY,
    }),
    availableTaskResources: [resource.availableTaskResource],
    learningRoundId: 'phase12-integration-seed-round',
    createdAt: '2026-07-14T17:58:00.000Z',
  });
  if (!start.taskFulfillmentRequest) throw new Error(`Seed start failed: ${start.issues.join(' ')}`);
  const prepared = prepareConcreteLearningTaskFromResource({
    resource,
    fulfillmentRequest: start.taskFulfillmentRequest,
    createdAt: '2026-07-14T17:58:00.000Z',
  });
  const concreteTask = prepared.concreteTaskResult.concreteTask;
  if (!concreteTask || !prepared.concreteTaskResult.readiness.canExecute) throw new Error('Seed task is not ready.');
  const hydratedStart = {
    ...start,
    concreteTask,
    taskReadinessValidation: prepared.concreteTaskResult.readiness,
    issues: [],
  };
  const execution = executeLearningRound({
    startResult: hydratedStart,
    studentAnswer: { answerText: VALID_ANSWER },
    responseOverrides: { responseId: 'phase12-integration-seed-response' },
  });
  const completedAt = '2026-07-14T17:59:00.000Z';
  const round = completeLearningRound({
    executionResult: execution,
    concreteTask,
    previousEvidence: initialEvidence,
    currentProfile: profile,
    diagnosisResult: buildDiagnosisResult(TARGET_ABILITY),
    diagnosisResultId: 'phase12-integration-seed-diagnosis',
    completedAt,
  });
  const returned = round.taskEvidenceReturnResult;
  if (!returned?.growthMemoryRecord || !returned.profileUpdateDecision) throw new Error('Seed evidence return failed.');
  const afterProfile = applyProfileUpdateDecision({
    currentProfile: profile,
    decision: returned.profileUpdateDecision,
    appliedAt: completedAt,
  }).afterProfile;
  const evidence = dedupeEvidence([...initialEvidence, ...returned.abilityEvidence]);
  const growthMemorySummary = summarizeGrowthMemory({
    studentId: STUDENT_ID,
    abilityId: TARGET_ABILITY,
    records: [returned.growthMemoryRecord],
  });
  const entry = buildStudentLearningEntryState({ startResult: hydratedStart, answerDraft: VALID_ANSWER });
  const feedback = buildStudentLearningFeedback({ entryState: entry, learningRoundResult: round });
  const roundSummary = buildStudentRoundSummary({
    learningRoundResult: round,
    studentLearningFeedback: feedback,
    studentLearningEntryState: entry,
  });
  const record = createLearningPersistenceRecord({
    studentId: STUDENT_ID,
    learningRoundId: round.learningRoundId,
    savedAt: completedAt,
    updatedAt: completedAt,
    sourceVersion: 'phase12_integration_seed_v1',
    learningRoundResult: round,
    concreteTask,
    studentResponse: execution.studentResponse,
    studentLearningFeedback: feedback,
    studentRoundSummary: roundSummary,
    growthMemoryRecord: returned.growthMemoryRecord,
    growthMemorySummary,
    studentAbilityProfile: afterProfile,
  });
  await repository.save(record);
  const restored = restoreLearningState(await repository.loadByRound(STUDENT_ID, round.learningRoundId), STUDENT_ID);
  if (!restored.canResume || restored.resumeMode !== 'start_next_round') throw new Error('Seed restore failed.');

  return {
    restored,
    evidence,
    growthMemoryRecord: returned.growthMemoryRecord,
    growthMemorySummary,
    profile: afterProfile,
  };
}

function buildDiagnosisResult(mainAbility: string): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: false,
    strategyUsed: 'phase12_integration_mock_diagnosis',
    answerStatus: 'partially_meets',
    scoreBand: 'medium',
    rubricItems: [],
    matchedRubricItems: ['文本线索', '人物心理'],
    missingRubricItems: ['推理说明'],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: '答案包含线索和心理判断，但连接说明还不完整。',
    rootCause: '学生尚未完整说明文本行为怎样支持人物心理结论。',
    errorType: '推理错误',
    abilityEvidence: ['学生能够提取行为并作出心理判断，但推理说明仍需补充。'],
    diagnosisSummary: '本次作答形成可消费的推理表现证据。',
    nextTraining: '继续观察文本线索到心理结论的推理说明。',
    confidence: 0.76,
  };
}

function buildInitialEvidence(): AbilityEvidence {
  return {
    id: 'phase12-integration-initial-evidence',
    studentId: STUDENT_ID,
    ability: TARGET_ABILITY,
    evidenceType: 'weakness',
    reason: 'reasoning_error',
    detail: '学生此前未完整说明文本线索与人物心理的关系。',
    source: 'diagnosis',
    observation: '回答停留在表层行为描述。',
    rootCause: '推理链不完整。',
    confidence: 0.72,
    createdAt: '2026-07-14T17:55:00.000Z',
    taskId: 'phase12-integration-initial-task',
    diagnosisId: 'phase12-integration-initial-diagnosis',
  };
}

function buildInitialGrowthRecord(profile: StudentAbilityProfile): GrowthMemoryRecord {
  return {
    recordId: 'phase12-integration-initial-growth',
    studentId: STUDENT_ID,
    abilityId: TARGET_ABILITY,
    abilityLabel: TARGET_ABILITY,
    createdAt: '2026-07-14T17:56:00.000Z',
    evaluationResultId: 'phase12-integration-initial-evaluation',
    profileUpdateDecisionId: 'phase12-integration-initial-decision',
    evidenceLinks: profile.evidence_links.map((item) => item.evidenceId),
    action: 'append_evidence_only',
    beforeProfileSummary: {
      abilityId: TARGET_ABILITY,
      abilityStatus: 'weak',
      evidenceCount: profile.evidence_links.length,
      summary: '初始画像仍需继续观察。',
    },
    afterProfileSummary: {
      abilityId: TARGET_ABILITY,
      abilityStatus: 'weak',
      evidenceCount: profile.evidence_links.length,
      summary: '仅追加历史证据，画像状态不变。',
    },
    reason: '当前仅形成历史薄弱证据，需要继续收集正式作答。',
    limitations: ['当前记录数量有限。'],
    nextAction: '继续收集有效证据。',
    sourceRuntime: 'phase12_integration_seed',
    relatedSessionId: 'phase12-integration-initial-session',
  };
}

async function countState(
  repository: InMemoryLearningPersistenceRepository,
  evidenceCount: number,
): Promise<CountSnapshot> {
  const records = await repository.listByStudent(STUDENT_ID);
  const completed = records.filter((item) => item.learningRoundResult?.status === 'completed');
  return {
    evidenceCount,
    growthMemoryRecordCount: completed.filter((item) => item.growthMemoryRecord).length,
    profileUpdateApplicationCount: completed.filter((item) => item.learningRoundResult?.taskEvidenceReturnResult?.profileUpdateDecision).length,
    persistenceRecordCount: records.length,
    completedRoundCount: completed.length,
  };
}

function sameCounts(a: CountSnapshot, b: CountSnapshot): boolean {
  return Object.keys(a).every((key) => a[key as keyof CountSnapshot] === b[key as keyof CountSnapshot]);
}

function withStudentId(profile: StudentAbilityProfile, studentId: string): StudentAbilityProfile {
  return JSON.parse(JSON.stringify({ ...profile, studentId })) as StudentAbilityProfile;
}

function dedupeEvidence(evidence: AbilityEvidence[]): AbilityEvidence[] {
  return [...new Map(evidence.map((item) => [item.id, item])).values()];
}

function caseReport(
  id: string,
  title: string,
  status: string,
  passed: boolean,
  reasons: string[] = [],
): CaseReport {
  return { id, title, status, passed, reasons };
}

function printIntegrationReport(
  normal: Awaited<ReturnType<typeof runNormalIntegration>>,
  reports: CaseReport[],
): void {
  const rounds = normal.output.result.rounds;
  const transition = normal.output.result.transitions[1];
  console.log('Phase 12 Integration Debug Report');
  console.log('=================================');
  console.log(`runId: ${normal.output.result.runId}`);
  console.log(`studentId: ${normal.output.result.studentId}`);
  console.log('repository adapter: InMemoryTaskResourceRepository / InMemoryLearningPersistenceRepository');
  console.log(`resource count: ${normal.resources.length}`);
  console.log('');
  normal.resources.slice(0, 2).forEach((resource, index) => {
    console.log(`Resource ${index + 1}: ${resource.resourceId} / ${resource.targetAbilityId} / ${resource.source.description}`);
  });
  console.log('');
  rounds.forEach((round, index) => {
    console.log(`Round ${index + 1}:`);
    console.log(`  learningRoundId: ${round.learningRoundId}`);
    console.log(`  resourceId: ${round.resourceId}`);
    console.log(`  concreteTaskId: ${round.concreteTaskId}`);
    console.log(`  responseId: ${round.responseId}`);
    console.log(`  evidenceIds: ${round.evidenceIds.join(', ')}`);
    console.log(`  growthMemoryRecordId: ${round.growthMemoryRecordId}`);
    console.log(`  persistenceRecordId: ${round.persistenceRecordId}`);
    console.log(`  status: ${round.status}`);
  });
  console.log('');
  console.log('Restore:');
  console.log(`  restored learningRoundId: ${normal.restored.learningRoundId}`);
  console.log(`  restored persistenceRecordId: ${normal.restored.restoredRecord?.recordId}`);
  console.log('  diagnosis rerun count: 0');
  console.log('  duplicate evidence count: 0');
  console.log('  duplicate growth memory count: 0');
  console.log('');
  console.log('Transition 1 -> 2:');
  console.log(`  fromLearningRoundId: ${transition?.fromLearningRoundId}`);
  console.log(`  fromPersistenceRecordId: ${transition?.fromPersistenceRecordId}`);
  console.log(`  fromGrowthMemoryRecordIds: ${transition?.fromGrowthMemoryRecordIds.join(', ')}`);
  console.log(`  nextLearningStrategyId: ${transition?.nextLearningStrategyId}`);
  console.log(`  taskRequestId: ${transition?.taskRequestId}`);
  console.log(`  selected resourceId: ${rounds[1]?.resourceId}`);
  console.log(`  concreteTaskId: ${transition?.concreteTaskId}`);
  console.log(`  transitionType: ${transition?.transitionType}`);
  console.log(`  traceable: ${transition?.traceable}`);
  console.log('');
  console.log('Counts:');
  console.log(`  evidence delta: ${normal.after.evidenceCount - normal.before.evidenceCount}`);
  console.log(`  growth memory delta: ${normal.after.growthMemoryRecordCount - normal.before.growthMemoryRecordCount}`);
  console.log(`  profile update applications: ${normal.after.profileUpdateApplicationCount - normal.before.profileUpdateApplicationCount}`);
  console.log(`  persistence records delta: ${normal.after.persistenceRecordCount - normal.before.persistenceRecordCount}`);
  console.log(`  completed rounds delta: ${normal.after.completedRoundCount - normal.before.completedRoundCount}`);
  console.log('');
  reports.forEach((report) => {
    console.log(`[${report.passed ? 'PASS' : 'FAIL'}] ${report.id} ${report.title}`);
    console.log(`  status: ${report.status}`);
    console.log(`  reasons: ${report.reasons.join(' | ') || 'none'}`);
  });
  console.log('');
}

class FailOnceLearningRepository implements LearningPersistenceRepository {
  failedSaveCount = 0;
  successfulSaveCount = 0;
  private readonly inner: InMemoryLearningPersistenceRepository;

  constructor(inner: InMemoryLearningPersistenceRepository) {
    this.inner = inner;
  }

  async save(record: Parameters<LearningPersistenceRepository['save']>[0]) {
    if (this.failedSaveCount === 0 && record.learningRoundId.includes('-round-1')) {
      this.failedSaveCount += 1;
      throw new Error('Simulated persistence failure.');
    }
    this.successfulSaveCount += 1;
    return this.inner.save(record);
  }

  loadLatest(studentId: string) { return this.inner.loadLatest(studentId); }
  loadByRound(studentId: string, learningRoundId: string) { return this.inner.loadByRound(studentId, learningRoundId); }
  listByStudent(studentId: string) { return this.inner.listByStudent(studentId); }
  clear(studentId: string) { return this.inner.clear(studentId); }
}

run().catch((error) => {
  console.error('[FAIL] Phase 12 integration debug crashed.');
  console.error(error);
  process.exitCode = 1;
});
