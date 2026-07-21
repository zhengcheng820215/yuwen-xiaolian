import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import { evaluateCoreResourceEligibility } from '../agents/coreResourceEligibilityAgent.ts';
import {
  createQualityGatedExecutableTask,
  evaluateResourceMatchQuality,
} from '../agents/resourceMatchQualityAgent.ts';
import { loadResourceEligibilitySnapshot } from '../agents/reviewedResourceCandidateAdapter.ts';
import { createAdaptiveTaskFulfillmentRequest } from '../agents/taskFulfillmentRequestAgent.ts';
import { runPhase163RealLearningChain } from '../agents/phase163RealLearningChainAgent.ts';
import { summarizeGrowthMemory } from '../agents/growthMemorySummaryAgent.ts';
import { createDiagnosisProviderConfigSnapshot } from '../agents/realLLMRuntimeFoundationAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import {
  ScriptedDiagnosisProviderAdapter,
  type DiagnosisProviderAdapter,
  type DiagnosisProviderRequest,
  type DiagnosisProviderResponse,
  type ScriptedDiagnosisProviderStep,
} from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryControlledFeedbackRepository } from '../repositories/inMemoryControlledFeedbackRepository.ts';
import { InMemoryFormalDiagnosisRepository } from '../repositories/inMemoryFormalDiagnosisRepository.ts';
import {
  createInMemoryLearningPersistenceStore,
  InMemoryLearningPersistenceRepository,
} from '../repositories/inMemoryLearningPersistenceRepository.ts';
import {
  createInMemoryRealLearningOperationStore,
  InMemoryRealLearningOperationRepository,
} from '../repositories/inMemoryRealLearningOperationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { LearningPersistenceRepository } from '../repositories/learningPersistenceRepository.ts';
import {
  ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
  ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
  type AdaptiveTaskRequestEnvelope,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { TaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  PrimaryAbilityId,
  QuestionResourceRubricItem,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  NextFormalTaskResolution,
  Phase163RealLearningChainResult,
} from '../schemas/realLearningOperation.schema.ts';
import type { ResourceMatchRecentHistory } from '../schemas/resourceMatchQuality.schema.ts';
import type { TaskFulfillmentRequest } from '../schemas/taskFulfillment.schema.ts';
import { getPhase161To162IntegrationDemoData } from '../../api/phase161To162IntegrationDemo.ts';
import { makeProfile } from './growthMemoryDebugFixtures.ts';

const NOW = '2026-07-21T10:00:00.000Z';
const SUBMITTED_AT = '2026-07-21T10:05:00.000Z';
const STUDENT_ID = 'student-phase16-integration-demo';
const VALID_ANSWER = '父亲捏着褪色的树叶站了很久，又小心地夹回原处，说明他想起过去，因此感到怀念和不舍。';

type CaseResult = { name: string; passed: boolean; detail: string };
type NextResolverMode = 'matched' | 'no_resource' | 'superseded' | 'ability_mismatch';

const reports: CaseResult[] = [];

async function main(): Promise<void> {
  const success = await caseA1();
  await caseA2();
  await caseA3();
  await caseA4();
  await caseA5();
  await caseA6();
  await caseA7(success);
  await caseA8(success);
  await caseA9();
  await caseA10();
  await caseA11();
  await caseA12();
  await caseA13();
  await caseA14(success);
  await caseA15();
  await caseA16();

  console.log('\nPhase 16.3A Real Learning Chain Debug');
  console.log('='.repeat(78));
  reports.forEach((item) => {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.name}`);
    console.log(`       ${item.detail}`);
  });
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  console.log('Provider mode: scripted deterministic (no DeepSeek Live call)');
  console.log('Formal side effects: isolated in-memory repositories');
  if (passed !== reports.length) throw new Error('Phase 16.3A Debug failed.');
}

async function caseA1(): Promise<SuccessfulRun> {
  const env = await createEnvironment('a1', [responseStep(validDiagnosis())], 'matched');
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  const next = result.checkpoint.nextTaskResolution;
  const passed = result.status === 'completed' &&
    result.checkpoint.stage === 'next_task_ready' &&
    result.checkpoint.taskEvidenceReturnResult?.status === 'evidence_returned' &&
    result.checkpoint.learningPersistenceRecordId !== undefined &&
    next?.status === 'matched' &&
    next.taskReadiness?.canExecute === true &&
    next.resourceVersion?.resourceId !== env.input.resourceVersion.resourceId &&
    Object.values(result.acceptanceReport.checks).every(Boolean);
  record('A1 完整主链：正式资源 A → Evidence/Memory → 正式资源 B', passed,
    `status=${result.status}, next=${next?.resourceVersion?.resourceId || 'none'}, providerCalls=${env.provider.callCount}, failedChecks=${Object.entries(result.acceptanceReport.checks).filter(([, value]) => !value).map(([key]) => key).join('|') || 'none'}`);
  return { env, result };
}

async function caseA2(): Promise<void> {
  const env = await createEnvironment('a2', [responseStep(validDiagnosis())], 'matched', '不知道');
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A2 无效作答在 Provider 前阻断',
    result.status === 'retry_required' && env.provider.callCount === 0 && !result.checkpoint.taskEvidenceReturnResult,
    `validity=${result.checkpoint.taskExecutionResult?.responseValidity.status}, providerCalls=${env.provider.callCount}`);
}

async function caseA3(): Promise<void> {
  const env = await createEnvironment('a3', [{ type: 'error', category: 'provider_unavailable', retryable: false }], 'matched');
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A3 Provider 失败不生成 mock Diagnosis 或 Evidence',
    result.status !== 'completed' && !result.checkpoint.taskEvidenceReturnResult && !result.checkpoint.updatedStudentAbilityProfile,
    `status=${result.status}, action=${result.checkpoint.nextAction}, providerCalls=${env.provider.callCount}`);
}

async function caseA4(): Promise<void> {
  const env = await createEnvironment('a4', [{ type: 'response', rawOutput: '{invalid-json' }], 'matched');
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A4 Schema 非法不进入 Evidence Return',
    result.status !== 'completed' && !result.checkpoint.taskEvidenceReturnResult,
    `status=${result.status}, runtime=${result.checkpoint.realDiagnosisRuntimeResult?.status}`);
}

async function caseA5(): Promise<void> {
  const env = await createEnvironment('a5', [responseStep(validDiagnosis())], 'matched');
  env.dependencies.assessDiagnosisAdmission = () => ({
    status: 'questionable',
    basis: 'quality_policy',
    sourceIds: ['quality-run-a5'],
    limitations: ['requires_human_review'],
    issues: ['diagnosis_quality_questionable'],
  });
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A5 questionable Diagnosis 进入人工复核且不回流 Evidence',
    result.status === 'review_required' && !result.checkpoint.taskEvidenceReturnResult,
    `admission=${result.checkpoint.diagnosisAdmission?.status}, evidence=${Boolean(result.checkpoint.taskEvidenceReturnResult)}`);
}

async function caseA6(): Promise<void> {
  const env = await createEnvironment('a6', [responseStep(validDiagnosis({ mainAbility: 'expression' }))], 'matched');
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A6 Diagnosis 能力错位不更新目标 Profile',
    result.status !== 'completed' && !result.checkpoint.taskEvidenceReturnResult && !result.checkpoint.updatedStudentAbilityProfile,
    `status=${result.status}, runtime=${result.checkpoint.realDiagnosisRuntimeResult?.status}`);
}

async function caseA7(success: SuccessfulRun): Promise<void> {
  const before = success.env.provider.callCount;
  const repeated = await runPhase163RealLearningChain(success.env.input, success.env.dependencies);
  record('A7 重复提交复用同一 Formal Commit、Evidence 与下一任务',
    repeated.status === 'completed' && success.env.provider.callCount === before &&
      repeated.checkpoint.taskEvidenceReturnResult?.returnId === success.result.checkpoint.taskEvidenceReturnResult?.returnId,
    `providerCalls=${success.env.provider.callCount}, returnId=${repeated.checkpoint.taskEvidenceReturnResult?.returnId}`);
}

async function caseA8(success: SuccessfulRun): Promise<void> {
  const restoredDependencies = {
    ...success.env.dependencies,
    operationRepository: new InMemoryRealLearningOperationRepository(success.env.operationStore),
    learningPersistenceRepository: new InMemoryLearningPersistenceRepository(success.env.learningStore),
  };
  const before = success.env.provider.callCount;
  const restored = await runPhase163RealLearningChain(success.env.input, restoredDependencies);
  record('A8 完成后 Repository 重建可恢复且不重跑 Diagnosis',
    restored.status === 'completed' && restored.acceptanceReport.persistence.recoveredFromCheckpoint &&
      success.env.provider.callCount === before,
    `stage=${restored.checkpoint.stage}, providerCalls=${success.env.provider.callCount}`);
}

async function caseA9(): Promise<void> {
  const env = await createEnvironment('a9', [responseStep(validDiagnosis())], 'matched', VALID_ANSWER, true);
  const first = await runPhase163RealLearningChain(env.input, env.dependencies);
  const calls = env.provider.callCount;
  const restoredDependencies = {
    ...env.dependencies,
    operationRepository: new InMemoryRealLearningOperationRepository(env.operationStore),
    learningPersistenceRepository: new InMemoryLearningPersistenceRepository(env.learningStore),
  };
  const second = await runPhase163RealLearningChain(env.input, restoredDependencies);
  record('A9 提交中断后从 Evidence Checkpoint 恢复',
    first.checkpoint.stage === 'evidence_returned' && second.status === 'completed' && env.provider.callCount === calls,
    `first=${first.checkpoint.stage}/${first.checkpoint.nextAction}, second=${second.checkpoint.stage}, providerCalls=${calls}`);
}

async function caseA10(): Promise<void> {
  const env = await createEnvironment('a10', [responseStep(validDiagnosis())], 'no_resource');
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A10 下一正式资源不存在时输出 no_match 并停止',
    result.status === 'blocked' && result.checkpoint.nextTaskResolution?.status === 'no_match' && result.checkpoint.nextAction === 'prepare_resource',
    `status=${result.status}, match=${result.checkpoint.nextTaskResolution?.status}`);
}

async function caseA11(): Promise<void> {
  const env = await createEnvironment('a11', [responseStep(validDiagnosis())], 'superseded');
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A11 Registry Head 变化阻断 superseded 旧版本',
    result.status === 'blocked' && result.checkpoint.nextTaskResolution?.issues.includes('selected_resource_is_no_longer_current') === true,
    `status=${result.status}, issues=${result.checkpoint.nextTaskResolution?.issues.join('|')}`);
}

async function caseA12(): Promise<void> {
  const env = await createEnvironment('a12', [responseStep(validDiagnosis())], 'ability_mismatch');
  const result = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A12 能力错位资源不用于凑匹配',
    result.status === 'blocked' && result.checkpoint.nextTaskResolution?.status === 'no_match' && !result.checkpoint.nextTaskResolution?.qualityGatedTask,
    `status=${result.status}, match=${result.checkpoint.nextTaskResolution?.status}`);
}

async function caseA13(): Promise<void> {
  const env = await createEnvironment('a13', [responseStep(validDiagnosis())], 'matched', VALID_ANSWER, true);
  const first = await runPhase163RealLearningChain(env.input, env.dependencies);
  const calls = env.provider.callCount;
  const second = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A13 持久化失败可重试且不重新执行 Diagnosis',
    first.checkpoint.nextAction === 'retry_persistence' && second.status === 'completed' && env.provider.callCount === calls,
    `first=${first.checkpoint.nextAction}, second=${second.status}, providerCalls=${calls}`);
}

async function caseA14(success: SuccessfulRun): Promise<void> {
  const stored = await new InMemoryLearningPersistenceRepository(success.env.learningStore)
    .loadByRound(success.env.input.studentId, success.env.input.learningRoundId);
  const request = success.result.checkpoint.nextTaskRequest;
  const memoryId = stored?.growthMemoryRecord?.recordId;
  record('A14 恢复后的正式 Profile/Memory 驱动下一 TaskRequest 与资源 B',
    Boolean(stored?.studentAbilityProfile && stored.growthMemorySummary && request && memoryId &&
      request.growthMemoryRecordIds.includes(memoryId) &&
      request.evidenceLinks.some((id) => stored.growthMemorySummary?.evidenceLinks.includes(id)) &&
      success.result.checkpoint.nextTaskResolution?.resourceVersion?.resourceId !== success.env.input.resourceVersion.resourceId),
    `memory=${memoryId}, request=${request?.taskRequestId}, next=${success.result.checkpoint.nextTaskResolution?.resourceVersion?.resourceId}`);
}

async function caseA15(): Promise<void> {
  const env = await createEnvironment('a15', [responseStep(validDiagnosis())], 'no_resource');
  const first = await runPhase163RealLearningChain(env.input, env.dependencies);
  const providerCalls = env.provider.callCount;
  const formalDiagnosisId = first.checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.formalDiagnosisId;
  env.dependencies.resolveNextTask = buildNextResolver('matched', 'a15-recovered');
  const second = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A15 正式资源补齐后恢复下一任务且不重跑 Diagnosis',
    first.status === 'blocked' && first.checkpoint.nextAction === 'prepare_resource' &&
      second.status === 'completed' && second.checkpoint.nextTaskResolution?.status === 'matched' &&
      env.provider.callCount === providerCalls &&
      second.checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.formalDiagnosisId === formalDiagnosisId,
    `first=${first.status}/${first.checkpoint.nextAction}, second=${second.status}/${second.checkpoint.nextTaskResolution?.status}, providerCalls=${env.provider.callCount}`);
}

async function caseA16(): Promise<void> {
  const env = await createEnvironment('a16', [responseStep(validDiagnosis())], 'no_resource');
  const first = await runPhase163RealLearningChain(env.input, env.dependencies);
  const providerCalls = env.provider.callCount;
  await env.dependencies.operationRepository.save({
    ...first.checkpoint,
    nextAction: 'stop',
    issues: [...first.checkpoint.issues, 'operation_identity_mismatch:resourceVersionId'],
  });
  env.dependencies.resolveNextTask = buildNextResolver('matched', 'a16-recovered');
  const second = await runPhase163RealLearningChain(env.input, env.dependencies);
  record('A16 已保存资源缺口曾被身份阻断后仍可安全重匹配',
    second.status === 'completed' && second.checkpoint.nextTaskResolution?.status === 'matched' &&
      env.provider.callCount === providerCalls &&
      !second.checkpoint.issues.some((issue) => issue.startsWith('operation_identity_mismatch:')),
    `second=${second.status}/${second.checkpoint.nextTaskResolution?.status}, providerCalls=${env.provider.callCount}, issues=${second.checkpoint.issues.join(',') || 'none'}`);
}

type Environment = Awaited<ReturnType<typeof createEnvironment>>;
type SuccessfulRun = { env: Environment; result: Phase163RealLearningChainResult };

async function createEnvironment(
  suffix: string,
  providerSteps: ScriptedDiagnosisProviderStep[],
  resolverMode: NextResolverMode,
  answerText = VALID_ANSWER,
  failPersistenceOnce = false,
) {
  const demo = await getPhase161To162IntegrationDemoData();
  const initial = demo.cases.find((item) => item.id === 'repository-handoff');
  expect(initial?.selectedVersion && initial.taskResult.task, 'Initial formal resource fixture is unavailable.');
  const provider = new CountingProvider(new ScriptedDiagnosisProviderAdapter(providerSteps));
  const operationStore = createInMemoryRealLearningOperationStore();
  const learningStore = createInMemoryLearningPersistenceStore();
  const baseLearningRepository = new InMemoryLearningPersistenceRepository(learningStore);
  const persistenceRepository = failPersistenceOnce
    ? new FailOnceLearningPersistenceRepository(baseLearningRepository)
    : baseLearningRepository;
  const profile = makeProfile(STUDENT_ID, 'inference');
  const growthSummary = summarizeGrowthMemory({ studentId: STUDENT_ID, abilityId: 'inference', records: [] });
  const input = {
    operationId: `phase16-3-operation-${suffix}`,
    learningSessionId: `phase16-3-session-${suffix}`,
    learningRoundId: `phase16-3-round-${suffix}`,
    diagnosisRequestId: `phase16-3-diagnosis-${suffix}`,
    studentId: STUDENT_ID,
    resourceVersion: initial.selectedVersion,
    qualityGatedTask: initial.taskResult.task,
    answerText,
    startedAt: NOW,
    submittedAt: SUBMITTED_AT,
    currentProfile: profile,
    currentGrowthMemorySummary: growthSummary,
    currentLearningContext: {
      contextId: `phase16-3-context-${suffix}`,
      studentId: STUDENT_ID,
      currentPhase: 'observation' as const,
      targetAbilityId: 'inference',
      recentTaskRole: 'training' as const,
      allowTraining: true,
      allowRetest: true,
      allowTransfer: true,
      recentFailureCount: 0,
      cognitiveLoad: 'medium' as const,
      reviewRequired: false,
    },
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: provider.providerName,
      model: 'phase16-3-scripted-model',
      providerConfigId: `phase16-3-config-${suffix}`,
      promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
      maxAttempts: 1,
      timeoutMs: 1_000,
      createdAt: NOW,
    }),
    timezone: 'Asia/Shanghai',
  };
  const dependencies = {
    provider,
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    controlledFeedbackRepository: new InMemoryControlledFeedbackRepository(),
    learningPersistenceRepository: persistenceRepository,
    operationRepository: new InMemoryRealLearningOperationRepository(operationStore),
    resolveNextTask: buildNextResolver(resolverMode, suffix),
    now: () => SUBMITTED_AT,
  };
  return { input, dependencies, provider, operationStore, learningStore };
}

function buildNextResolver(mode: NextResolverMode, suffix: string) {
  return async ({ taskRequest, previousResourceVersion }: {
    taskRequest: TaskRequest;
    previousResourceVersion: FrozenQuestionResourceVersion;
  }): Promise<NextFormalTaskResolution> => {
    const repository = new InMemoryQuestionResourceAdmissionRepository();
    if (mode === 'no_resource') {
      return runResourcePipeline(repository, taskRequest, previousResourceVersion, mode);
    }
    const ability = mode === 'ability_mismatch' ? 'comprehension' : taskRequest.targetAbilityId as PrimaryAbilityId;
    const fixture = await createFrozenResource(repository, `${suffix}-next`, ability, taskRequest.taskRole);
    return runResourcePipeline(repository, taskRequest, previousResourceVersion, mode, fixture);
  };
}

async function runResourcePipeline(
  repository: InMemoryQuestionResourceAdmissionRepository,
  taskRequest: TaskRequest,
  previousResourceVersion: FrozenQuestionResourceVersion,
  mode: NextResolverMode,
  fixture?: { version: FrozenQuestionResourceVersion; draftId: string },
): Promise<NextFormalTaskResolution> {
  const envelope = buildEnvelope(taskRequest);
  const fulfillmentResult = createAdaptiveTaskFulfillmentRequest({
    adaptiveTaskRequestEnvelope: envelope,
    recentTaskIds: [previousResourceVersion.taskId],
    createdAt: SUBMITTED_AT,
  });
  if (!fulfillmentResult.request) {
    return { status: 'blocked', taskRequestId: taskRequest.taskRequestId, issues: [fulfillmentResult.blockedReason || 'fulfillment_blocked'] };
  }
  const fulfillment = fulfillmentResult.request;
  const snapshot = await loadResourceEligibilitySnapshot(repository, SUBMITTED_AT);
  const core = evaluateCoreResourceEligibility({
    adaptiveTaskRequestEnvelope: envelope,
    taskFulfillmentRequest: fulfillment,
    resourceSnapshot: snapshot,
    evaluatedAt: SUBMITTED_AT,
  });
  const quality = evaluateResourceMatchQuality({
    adaptiveRequestEnvelope: envelope,
    fulfillmentRequest: fulfillment,
    coreEligibility: core,
    resourceSnapshot: snapshot,
    recentHistory: buildHistory(taskRequest.studentId, previousResourceVersion),
    evaluatedAt: SUBMITTED_AT,
  });
  if (mode === 'superseded' && fixture && quality.evaluation?.status === 'matched') {
    await createReplacementVersion(repository, fixture.version, `${fixture.draftId}-replacement`);
  }
  const currentSnapshot = mode === 'superseded'
    ? await loadResourceEligibilitySnapshot(repository, '2026-07-21T10:06:00.000Z')
    : snapshot;
  const taskResult = createQualityGatedExecutableTask({
    qualityResult: quality,
    fulfillmentRequest: fulfillment,
    currentResourceSnapshot: currentSnapshot,
    createdAt: SUBMITTED_AT,
  });
  const evaluation = quality.evaluation || undefined;
  if (taskResult.status !== 'created' || !taskResult.task) {
    return {
      status: evaluation?.status === 'review_required' ? 'review_required' : evaluation?.status === 'partial_match' ? 'partial_match' : evaluation?.status === 'no_match' ? 'no_match' : 'blocked',
      taskRequestId: taskRequest.taskRequestId,
      matchEvaluation: evaluation,
      issues: [...quality.issues, ...taskResult.issues],
    };
  }
  const version = currentSnapshot.frozenVersions.find((item) => item.resourceVersionId === taskResult.task!.resourceVersionId);
  return {
    status: 'matched',
    taskRequestId: taskRequest.taskRequestId,
    resourceVersion: version,
    qualityGatedTask: taskResult.task,
    matchEvaluation: evaluation,
    issues: [],
  };
}

function buildEnvelope(taskRequest: TaskRequest): AdaptiveTaskRequestEnvelope {
  const constraintsId = `phase16-3-constraints-${taskRequest.taskRequestId}`;
  const capabilities = requiredCapabilities(taskRequest.taskRole);
  return {
    envelopeId: `phase16-3-envelope-${taskRequest.taskRequestId}`,
    taskRequest,
    adaptiveConstraints: {
      constraintsId,
      studentId: taskRequest.studentId,
      targetAbilityId: taskRequest.targetAbilityId,
      sourceStrategyId: taskRequest.strategyId,
      sourceStrategyAction: taskRequest.action,
      sourceStrategyTaskRole: taskRequest.taskRole,
      sourceValidationGoal: taskRequest.validationGoal,
      sourceContextSnapshotId: `phase16-3-context-${taskRequest.taskRequestId}`,
      sourceConflictAssessmentId: `phase16-3-conflict-${taskRequest.taskRequestId}`,
      sourceConflictStatus: 'aligned_weakness_evidence',
      sourceQualityAssessmentIds: ['phase16-3-quality-current'],
      sourceEvidenceIds: taskRequest.evidenceLinks,
      sourceObservationUnitIds: ['phase16-3-observation-current'],
      learningIntent: taskRequest.taskRole === 'transfer' ? 'transfer_validation' : 'consolidation',
      observationTarget: taskRequest.taskRole === 'transfer' ? 'verify_transfer' : 'collect_comparable_evidence',
      recommendedTaskRole: taskRequest.taskRole,
      difficultyDirection: 'maintain',
      materialNovelty: 'similar_context',
      hintPolicy: 'limited_hint',
      targetEvidenceQuality: 'medium',
      preExecutionQualityConditions: {
        requireNovelMaterial: false,
        requireKnownDifficulty: true,
        requireAbilityAlignment: true,
        requiredHintPolicy: 'limited_hint',
        requireTraceability: true,
      },
      requiredCapabilities: capabilities,
      hardConstraints: [
        { code: 'task_role', operator: 'eq', value: taskRequest.taskRole, source: 'strategy' },
        { code: 'target_ability', operator: 'eq', value: taskRequest.targetAbilityId, source: 'strategy' },
        { code: 'difficulty', operator: 'eq', value: 'maintain', source: 'strategy' },
        { code: 'material_novelty', operator: 'eq', value: 'similar_context', source: 'strategy' },
        { code: 'hint_policy', operator: 'eq', value: 'limited_hint', source: 'quality' },
      ],
      softPreferences: [],
      reasons: ['Phase 16.3 next task must use the formal Phase 16.2 quality gate.'],
      limitations: [],
      schemaVersion: ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
      policyVersion: ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
      generatedAt: SUBMITTED_AT,
      validation: { passed: true, issues: [] },
    },
    alignmentResult: {
      alignmentId: `phase16-3-alignment-${taskRequest.taskRequestId}`,
      strategyId: taskRequest.strategyId,
      constraintsId,
      contextSnapshotId: `phase16-3-context-${taskRequest.taskRequestId}`,
      status: 'aligned',
      checks: {
        identityAligned: true,
        strategyValidationPassed: true,
        sourceStrategyAligned: true,
        targetAbilityAligned: true,
        taskRoleAligned: true,
        validationGoalAligned: true,
        difficultyAllowed: true,
        materialAllowed: true,
        hintPolicyAllowed: true,
        contextAllowed: true,
        conflictAllowed: true,
      },
      canCreateTaskRequest: true,
      nextStep: 'create_task_request',
      issues: [],
      warnings: [],
      alignedAt: SUBMITTED_AT,
      validation: { passed: true, issues: [] },
    },
    constraintsId,
    canEnterTaskFulfillment: true,
    schemaVersion: ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
    validation: { passed: true, issues: [] },
  };
}

async function createFrozenResource(
  repository: InMemoryQuestionResourceAdmissionRepository,
  suffix: string,
  abilityId: PrimaryAbilityId,
  taskRole: FrozenQuestionResourceVersion['abilityMetadata']['taskRole'],
): Promise<{ version: FrozenQuestionResourceVersion; draftId: string }> {
  const materialId = `phase16-3-material-${suffix}`;
  const materialVersionId = `${materialId}:v1`;
  const draftId = `phase16-3-draft-${suffix}`;
  await createQuestionMaterial(repository, {
    materialId,
    materialVersionId,
    versionNumber: 1,
    title: '窗边的旧照片',
    content: '母亲擦拭旧照片时停下手，轻轻叹了一口气，又把照片放回最上层的抽屉。',
    source: { sourceType: 'manual', description: 'Phase 16.3 formal next-resource fixture.' },
    createdAt: SUBMITTED_AT,
  });
  await createStructuredQuestionDraft(repository, {
    draftId,
    resourceId: `phase16-3-resource-${suffix}`,
    taskId: `phase16-3-task-${suffix}`,
    materialVersionId,
    title: '人物心理观察',
    questionStem: '母亲此时可能有怎样的心理？请结合动作说明理由。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['怀念', '不舍'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: validRubric(abilityId),
    minimumAnswerRequirement: { minLength: 8, requireTextEvidence: true, requireExplanation: true },
    abilityMetadata: {
      abilityId,
      supportingAbilityIds: abilityId === 'inference' ? ['comprehension'] : [],
      prerequisiteAbilityIds: [],
      taskRole,
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: { sourceType: 'manual', description: 'Phase 16.3 formal next-resource fixture.' },
    tags: ['material_relation:similar_context', 'hint_policy:limited_hint'],
    now: SUBMITTED_AT,
  });
  const validation = await validateStructuredQuestionDraft(repository, draftId, SUBMITTED_AT);
  expect(validation.passed, `Resource validation failed: ${validation.issues.map((item) => item.code).join(',')}`);
  await submitQuestionResourceForReview(repository, draftId, SUBMITTED_AT);
  await reviewQuestionResourceDraft(repository, {
    draftId,
    action: 'approve',
    reviewerId: 'phase16-3-reviewer',
    notes: 'Approved for Phase 16.3 deterministic integration.',
    now: SUBMITTED_AT,
  });
  const version = (await freezeQuestionResourceDraft(repository, draftId, SUBMITTED_AT)).version;
  return { version, draftId };
}

async function createReplacementVersion(
  repository: InMemoryQuestionResourceAdmissionRepository,
  current: FrozenQuestionResourceVersion,
  draftId: string,
): Promise<void> {
  const materialVersionId = current.materialVersionId!;
  await createStructuredQuestionDraft(repository, {
    draftId,
    resourceId: current.resourceId,
    taskId: current.taskId,
    proposedVersionNumber: current.versionNumber + 1,
    parentVersionId: current.resourceVersionId,
    materialVersionId,
    title: current.title,
    questionStem: `${current.questionStem} 请完整作答。`,
    questionType: current.questionType,
    responseFormat: current.responseFormat,
    assessmentMode: current.assessmentMode,
    answerAcceptance: current.answerAcceptance,
    rubric: current.rubric,
    minimumAnswerRequirement: current.minimumAnswerRequirement,
    abilityMetadata: current.abilityMetadata,
    source: current.source,
    tags: current.tags,
    now: '2026-07-21T10:06:00.000Z',
  });
  const validation = await validateStructuredQuestionDraft(repository, draftId, '2026-07-21T10:06:00.000Z');
  expect(validation.passed, 'Replacement resource validation failed.');
  await submitQuestionResourceForReview(repository, draftId, '2026-07-21T10:06:00.000Z');
  await reviewQuestionResourceDraft(repository, {
    draftId,
    action: 'approve',
    reviewerId: 'phase16-3-reviewer',
    notes: 'Replacement version.',
    now: '2026-07-21T10:06:00.000Z',
  });
  await freezeQuestionResourceDraft(repository, draftId, '2026-07-21T10:06:00.000Z');
}

function requiredCapabilities(role: TaskRequest['taskRole']): string[] {
  const values = ['open_response', 'ability_observation', 'text_evidence', 'inference_chain'];
  if (role === 'training') values.push('focused_practice');
  if (role === 'retest') values.push('independent_answer');
  if (role === 'transfer') values.push('new_context_transfer');
  if (role === 'diagnosis') values.push('root_cause_probe');
  return values;
}

function buildHistory(studentId: string, previous: FrozenQuestionResourceVersion): ResourceMatchRecentHistory {
  return {
    studentId,
    recentTaskIds: [previous.taskId],
    recentResourceIds: [previous.resourceId],
    recentResourceVersionIds: [previous.resourceVersionId],
    recentMaterialIds: previous.materialId ? [previous.materialId] : [],
    recentExecutionSessionIds: [],
    historyWindowStartedAt: '2026-07-14T10:00:00.000Z',
    historyWindowEndedAt: SUBMITTED_AT,
  };
}

function validRubric(abilityId: PrimaryAbilityId): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence', name: '文本依据', description: '指出与判断相关的动作或细节。', abilityId,
      importance: 'critical', required: true,
      evidenceRequirement: { requireTextEvidence: true },
      acceptedSignals: ['指出人物动作'],
    },
    {
      itemId: 'explanation', name: '解释关系', description: '说明动作与心理之间的关系。', abilityId,
      importance: 'important', required: true,
      evidenceRequirement: { requireExplanation: true, requireConclusion: true },
      acceptedSignals: ['说明动作与心理的联系'],
    },
  ];
}

function validDiagnosis(overrides: Partial<DiagnosisResult> = {}): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'controlled_phase16_3_diagnosis',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    mainAbility: 'inference',
    relatedAbilities: ['comprehension'],
    surfaceError: '本次回答能够回应题目要求。',
    rootCause: '学生能够使用人物动作支持本次心理判断。',
    errorType: '待验证',
    abilityEvidence: ['学生写出怀念、不舍，并引用站了很久和小心夹回原处作为依据。'],
    diagnosisSummary: '本次回答形成了人物动作到人物心理的推理关系。',
    nextTraining: '后续可在新材料中继续观察独立推理表现。',
    confidence: 0.82,
    ...overrides,
  };
}

function responseStep(diagnosis: DiagnosisResult): ScriptedDiagnosisProviderStep {
  return { type: 'response', rawOutput: JSON.stringify(diagnosis), latencyMs: 2 };
}

class CountingProvider implements DiagnosisProviderAdapter {
  readonly providerName: string;
  callCount = 0;
  private readonly delegate: DiagnosisProviderAdapter;
  constructor(delegate: DiagnosisProviderAdapter) {
    this.delegate = delegate;
    this.providerName = delegate.providerName;
  }
  async diagnose(request: DiagnosisProviderRequest): Promise<DiagnosisProviderResponse> {
    this.callCount += 1;
    return this.delegate.diagnose(request);
  }
}

class FailOnceLearningPersistenceRepository implements LearningPersistenceRepository {
  private failed = false;
  private readonly delegate: LearningPersistenceRepository;
  constructor(delegate: LearningPersistenceRepository) {
    this.delegate = delegate;
  }
  async save(record: LearningPersistenceRecord): Promise<LearningPersistenceRecord> {
    if (!this.failed) {
      this.failed = true;
      throw new Error('controlled_persistence_failure');
    }
    return this.delegate.save(record);
  }
  loadLatest(studentId: string) { return this.delegate.loadLatest(studentId); }
  loadByRound(studentId: string, learningRoundId: string) { return this.delegate.loadByRound(studentId, learningRoundId); }
  listByStudent(studentId: string) { return this.delegate.listByStudent(studentId); }
  clear(studentId: string) { return this.delegate.clear(studentId); }
}

function record(name: string, passed: boolean, detail: string): void {
  reports.push({ name, passed, detail });
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
