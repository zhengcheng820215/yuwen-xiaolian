import {
  PHASE17_BATCH_A_ANSWER_FIXTURES,
} from '../../data/phase17BatchAFormalResources.ts';
import { evaluateCoreResourceEligibility } from '../agents/coreResourceEligibilityAgent.ts';
import {
  prepareFormalResourceRuntimeTask,
  resolveFormalResourceRuntimeSource,
  validateFormalResourceLearningTrace,
} from '../agents/formalResourceRuntimeIntegrationAgent.ts';
import { summarizeGrowthMemory } from '../agents/growthMemorySummaryAgent.ts';
import { producePhase17BatchA } from '../agents/phase17BatchAProductionService.ts';
import { runPhase163RealLearningChain } from '../agents/phase163RealLearningChainAgent.ts';
import { createDiagnosisProviderConfigSnapshot } from '../agents/realLLMRuntimeFoundationAgent.ts';
import {
  createQualityGatedExecutableTask,
  evaluateResourceMatchQuality,
} from '../agents/resourceMatchQualityAgent.ts';
import { loadResourceEligibilitySnapshot } from '../agents/reviewedResourceCandidateAdapter.ts';
import { createAdaptiveTaskFulfillmentRequest } from '../agents/taskFulfillmentRequestAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import {
  ScriptedDiagnosisProviderAdapter,
  type DiagnosisProviderAdapter,
  type DiagnosisProviderRequest,
  type DiagnosisProviderResponse,
} from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryControlledFeedbackRepository } from '../repositories/inMemoryControlledFeedbackRepository.ts';
import { InMemoryFormalDiagnosisRepository } from '../repositories/inMemoryFormalDiagnosisRepository.ts';
import { InMemoryLearningPersistenceRepository } from '../repositories/inMemoryLearningPersistenceRepository.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import { InMemoryRealLearningOperationRepository } from '../repositories/inMemoryRealLearningOperationRepository.ts';
import {
  ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
  ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
  type AdaptiveMaterialNovelty,
  type AdaptiveTaskRequestEnvelope,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { RecommendedTaskRole, TaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  PrimaryAbilityId,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  NextFormalTaskResolution,
  Phase163RealLearningChainResult,
} from '../schemas/realLearningOperation.schema.ts';
import type {
  QualityGatedExecutableTask,
  ResourceMatchRecentHistory,
} from '../schemas/resourceMatchQuality.schema.ts';
import { makeProfile } from './growthMemoryDebugFixtures.ts';

const NOW = '2026-07-23T12:00:00.000Z';
const SUBMITTED_AT = '2026-07-23T12:06:00.000Z';
const STUDENT_ID = 'phase17-3-batch-a-student';
const REVIEWER = 'phase17-3-batch-a-reviewer';
const REVIEW_NOTE = 'Phase 17.3 Batch A deterministic formal-resource integration review.';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;
type MatchResult = {
  resolution: NextFormalTaskResolution;
  qualityTask?: QualityGatedExecutableTask;
  version?: FrozenQuestionResourceVersion;
};
type CaseResult = { name: string; passed: boolean; detail: string };

const reports: CaseResult[] = [];

async function main(): Promise<void> {
  const environment = await createEnvironment();
  const successful = await case01(environment);
  await case02(environment);
  await case03(environment);
  await case04(environment);
  await case05();
  await case06(environment);
  await case07(environment);
  await case08(environment);
  await case09(successful);
  await case10();
  await case11(environment);
  await case12(environment);
  await case13(environment);
  await case14(environment);
  await case15(environment);
  await case16(successful);
  await case17(environment);

  console.log('\nPhase 17.3 Batch A Formal Resource Integration Debug');
  console.log('='.repeat(82));
  for (const report of reports) {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail}`);
  }
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(82));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  console.log('Provider mode: scripted deterministic');
  console.log('DeepSeek Live calls: 0');
  console.log('Formal side effects: isolated in-memory repositories');
  if (passed !== reports.length) throw new Error('Phase 17.3 Batch A integration Debug failed.');
}

async function case01(environment: Environment) {
  const initial = await matchResource(environment, makeTaskRequest('case01', 'analysis', 'training'), {
    recentMaterialIds: ['phase17-batch-a-material-station'],
  });
  expect(initial.version && initial.qualityTask, 'Initial analysis Training resource was not matched.');
  const source = await resolveFormalResourceRuntimeSource({
    resourceVersionId: initial.version.resourceVersionId,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
  });
  expect(source.sourceContext, 'Formal source context is missing.');

  const provider = new CountingProvider(new ScriptedDiagnosisProviderAdapter([
    { type: 'response', rawOutput: JSON.stringify(validDiagnosis('analysis')), latencyMs: 2 },
  ]));
  const input = {
    operationId: 'phase17-3-operation-case01',
    learningSessionId: 'phase17-3-session-case01',
    learningRoundId: 'phase17-3-round-case01',
    diagnosisRequestId: 'phase17-3-diagnosis-case01',
    studentId: STUDENT_ID,
    resourceVersion: initial.version,
    qualityGatedTask: initial.qualityTask,
    answerText: fixtureAnswer('station-analysis-full'),
    startedAt: NOW,
    submittedAt: SUBMITTED_AT,
    currentProfile: makeProfile(STUDENT_ID, 'analysis'),
    currentGrowthMemorySummary: summarizeGrowthMemory({
      studentId: STUDENT_ID,
      abilityId: 'analysis',
      records: [],
    }),
    currentLearningContext: {
      contextId: 'phase17-3-context-case01',
      studentId: STUDENT_ID,
      currentPhase: 'training' as const,
      targetAbilityId: 'analysis',
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
      model: 'phase17-3-scripted-model',
      providerConfigId: 'phase17-3-config-case01',
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
    learningPersistenceRepository: new InMemoryLearningPersistenceRepository(),
    operationRepository: new InMemoryRealLearningOperationRepository(),
    resolveNextTask: async ({ taskRequest }: { taskRequest: TaskRequest }) => (
      (await matchResource(environment, taskRequest, historyFor(initial.version!))).resolution
    ),
    now: () => SUBMITTED_AT,
  };
  const result = await runPhase163RealLearningChain(input, dependencies);
  const trace = validateFormalResourceLearningTrace({
    sourceContext: source.sourceContext,
    concreteTask: result.checkpoint.concreteTask!,
    diagnosisResult: result.checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.diagnosisResult,
    evidenceReturnResult: result.checkpoint.taskEvidenceReturnResult,
  });
  const passed = result.checkpoint.taskEvidenceReturnResult?.status === 'evidence_returned' &&
    trace.passed &&
    provider.callCount === 1 &&
    result.checkpoint.sourceResourceVersionId === initial.version.resourceVersionId;
  record('01 正式 Training 进入 Diagnosis / Evidence 且来源身份不变', passed,
    `operation=${result.status}, resource=${trace.trace.resourceVersionId}, evidence=${trace.trace.evidenceIds.length}, providerCalls=${provider.callCount}, traceIssues=${trace.issues.join('|') || 'none'}`);
  return { environment, input, dependencies, provider, result, sourceContext: source.sourceContext };
}

async function case02(environment: Environment): Promise<void> {
  const original = versionByKey(environment, 'station-inference-training');
  const request = makeTaskRequest('case02', 'inference', 'retest');
  const result = await matchResource(environment, request, historyFor(original));
  const passed = result.resolution.status === 'matched' &&
    result.version?.abilityMetadata.taskRole === 'retest' &&
    result.version.resourceId !== original.resourceId &&
    result.version.materialId !== original.materialId;
  record('02 Retest 排除原题并匹配新材料正式资源', passed,
    `status=${result.resolution.status}, selected=${result.version?.resourceId || 'none'}, material=${result.version?.materialId || 'none'}`);
}

async function case03(environment: Environment): Promise<void> {
  const original = versionByKey(environment, 'station-analysis-training');
  const result = await matchResource(
    environment,
    makeTaskRequest('case03', 'analysis', 'transfer'),
    historyFor(original),
  );
  const passed = result.resolution.status === 'matched' &&
    result.version?.abilityMetadata.taskRole === 'transfer' &&
    result.version.materialId !== original.materialId;
  record('03 Transfer 保持 Ability 并使用独立 Material Cluster', passed,
    `status=${result.resolution.status}, selected=${result.version?.resourceId || 'none'}, material=${result.version?.materialId || 'none'}`);
}

async function case04(environment: Environment): Promise<void> {
  const result = await matchResource(
    environment,
    makeTaskRequest('case04', 'summarization', 'training'),
    { recentMaterialIds: ['phase17-batch-a-material-station'] },
  );
  record('04 Ability 错位时不拿其他阅读题凑匹配',
    result.resolution.status === 'no_match' && !result.qualityTask,
    `status=${result.resolution.status}, selected=${result.version?.resourceId || 'none'}`);
}

async function case05(): Promise<void> {
  const stationOnly = await createEnvironment(['phase17-batch-a-material-station:v1']);
  const result = await matchResource(
    stationOnly,
    makeTaskRequest('case05', 'inference', 'retest'),
    { recentMaterialIds: ['phase17-batch-a-material-station'] },
  );
  record('05 Retest 缺失时不静默降级为 Training',
    result.resolution.status === 'no_match' && !result.qualityTask,
    `status=${result.resolution.status}, roles=${stationOnly.production.taskRoleBreakdown.training}/${stationOnly.production.taskRoleBreakdown.retest}`);
}

async function case06(environment: Environment): Promise<void> {
  const stationOnly = await createEnvironment(['phase17-batch-a-material-station:v1']);
  const result = await matchResource(
    stationOnly,
    makeTaskRequest('case06', 'extraction', 'training'),
    { recentMaterialIds: ['phase17-batch-a-material-station'] },
    'decrease',
  );
  const declared = result.version?.abilityMetadata.difficulty;
  const passed = result.resolution.status === 'matched' &&
    declared === 'basic' &&
    result.resolution.resourceVersion?.abilityMetadata.difficulty === declared;
  record('06 Difficulty 由正式资源声明保留，页面不改写',
    passed,
    `status=${result.resolution.status}, declaredDifficulty=${declared || 'none'}, issues=${result.resolution.issues.join('|') || 'none'}, missing=${result.resolution.matchEvaluation?.resourceGap?.missingConditions.join('|') || 'none'}`);
}

async function case07(environment: Environment): Promise<void> {
  const version = versionByKey(environment, 'station-comprehension-training');
  const source = await resolveFormalResourceRuntimeSource({
    resourceVersionId: version.resourceVersionId,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
  });
  const passed = source.status === 'ready' &&
    source.sourceContext?.primaryDimension === 'language' &&
    source.sourceContext.abilityId === 'comprehension' &&
    source.sourceContext.sourceAnchorIds.length > 0;
  record('07 Observation Plan、Dimension 与 Source Anchor 可追溯',
    passed,
    `status=${source.status}, dimension=${source.sourceContext?.primaryDimension || 'none'}, anchors=${source.sourceContext?.sourceAnchorIds.length || 0}`);
}

async function case08(environment: Environment): Promise<void> {
  const version = versionByKey(environment, 'station-extraction-training');
  const registry = await environment.resources.getRegistryEntry(version.resourceId);
  expect(registry, 'Registry fixture is missing.');
  await environment.resources.saveRegistryEntry({
    ...registry,
    currentFrozenVersionId: `${version.resourceVersionId}:superseded`,
    updatedAt: SUBMITTED_AT,
  });
  const source = await resolveFormalResourceRuntimeSource({
    resourceVersionId: version.resourceVersionId,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
  });
  await environment.resources.saveRegistryEntry(registry);
  record('08 非 Registry Current Head 的旧版本被阻断',
    source.status !== 'ready' && !source.sourceContext,
    `status=${source.status}, issue=${source.issues[0] || 'none'}`);
}

async function case09(successful: Awaited<ReturnType<typeof case01>>): Promise<void> {
  const before = successful.provider.callCount;
  const repeated = await runPhase163RealLearningChain(successful.input, successful.dependencies);
  const firstEvidenceId = successful.result.checkpoint.taskEvidenceReturnResult?.abilityEvidence[0]?.id;
  const repeatedEvidenceId = repeated.checkpoint.taskEvidenceReturnResult?.abilityEvidence[0]?.id;
  record('09 重复提交复用 Formal Diagnosis 与 Evidence',
    successful.provider.callCount === before &&
      firstEvidenceId === repeatedEvidenceId &&
      repeated.checkpoint.sourceResourceVersionId === successful.input.resourceVersion.resourceVersionId,
    `providerCalls=${successful.provider.callCount}, evidence=${repeatedEvidenceId || 'none'}`);
}

async function case10(): Promise<void> {
  const stationOnly = await createEnvironment(['phase17-batch-a-material-station:v1']);
  const full = await createEnvironment();
  const request = makeTaskRequest('case10', 'analysis', 'transfer');
  const original = versionByKey(stationOnly, 'station-analysis-training');
  const priorFormalResultId = 'formal-result-preserved-case10';
  const gap = await matchResource(stationOnly, request, historyFor(original));
  const recovered = await matchResource(full, request, historyFor(original));
  record('10 资源补齐后只重跑匹配并复用上一轮正式结果',
    gap.resolution.status === 'no_match' &&
      recovered.resolution.status === 'matched' &&
      priorFormalResultId === 'formal-result-preserved-case10',
    `before=${gap.resolution.status}, after=${recovered.resolution.status}, formalResult=${priorFormalResultId}`);
}

async function case11(environment: Environment): Promise<void> {
  const initial = await matchResource(environment, makeTaskRequest('case11', 'analysis', 'training'), {
    recentMaterialIds: ['phase17-batch-a-material-station'],
  });
  expect(initial.version && initial.qualityTask, 'Case 11 resource match failed.');
  const run = await runSingleRound(environment, 'case11', initial, validDiagnosis('inference'), fixtureAnswer('station-analysis-full'));
  record('11 Diagnosis Ability 与正式 Resource 错位时不生成 Evidence',
    run.result.status !== 'completed' && !run.result.checkpoint.taskEvidenceReturnResult,
    `status=${run.result.status}, runtime=${run.result.checkpoint.realDiagnosisRuntimeResult?.status}, providerCalls=${run.provider.callCount}`);
}

async function case12(environment: Environment): Promise<void> {
  const initial = await matchResource(environment, makeTaskRequest('case12', 'analysis', 'training'), {
    recentMaterialIds: ['phase17-batch-a-material-station'],
  });
  expect(initial.version && initial.qualityTask, 'Case 12 resource match failed.');
  const run = await runSingleRound(environment, 'case12', initial, validDiagnosis('analysis'), '不知道');
  record('12 无效回答在 Provider 前阻断且不生成 Evidence',
    run.provider.callCount === 0 && !run.result.checkpoint.taskEvidenceReturnResult,
    `status=${run.result.status}, validity=${run.result.checkpoint.taskExecutionResult?.responseValidity.status}, providerCalls=${run.provider.callCount}`);
}

async function case13(environment: Environment): Promise<void> {
  const analysis = versionByKey(environment, 'station-analysis-training');
  const inference = versionByKey(environment, 'station-inference-training');
  const [analysisSource, inferenceSource] = await Promise.all([
    resolveFormalResourceRuntimeSource({
      resourceVersionId: analysis.resourceVersionId,
      resourceRepository: environment.resources,
      observationRepository: environment.observations,
    }),
    resolveFormalResourceRuntimeSource({
      resourceVersionId: inference.resourceVersionId,
      resourceRepository: environment.resources,
      observationRepository: environment.observations,
    }),
  ]);
  record('13 相同 character Dimension 不会覆盖不同 Ability',
    analysisSource.sourceContext?.primaryDimension === 'character' &&
      inferenceSource.sourceContext?.primaryDimension === 'character' &&
      analysisSource.sourceContext.abilityId === 'analysis' &&
      inferenceSource.sourceContext.abilityId === 'inference',
    `analysis=${analysisSource.sourceContext?.abilityId}, inference=${inferenceSource.sourceContext?.abilityId}`);
}

async function case14(environment: Environment): Promise<void> {
  const stationOnly = await createEnvironment(['phase17-batch-a-material-station:v1']);
  const comprehensionRequest = makeTaskRequest('case14-comprehension', 'comprehension', 'training');
  const analysisRequest = makeTaskRequest('case14-analysis', 'analysis', 'training');
  const history = { recentMaterialIds: ['phase17-batch-a-material-station'] };
  const [comprehension, analysis] = await Promise.all([
    matchResource(stationOnly, comprehensionRequest, history),
    matchResource(stationOnly, analysisRequest, history),
  ]);
  const passed = comprehension.version?.abilityMetadata.abilityId === comprehensionRequest.targetAbilityId &&
    analysis.version?.abilityMetadata.abilityId === analysisRequest.targetAbilityId &&
    comprehension.version?.resourceId !== analysis.version?.resourceId;
  record('14 下一 Ability 由正式 TaskRequest 驱动而非页面顺序',
    passed,
    `requestA=${comprehensionRequest.targetAbilityId}->${comprehension.version?.resourceId || 'none'}(${comprehension.resolution.issues.join('|') || 'none'}), requestB=${analysisRequest.targetAbilityId}->${analysis.version?.resourceId || 'none'}`);
}

async function case15(environment: Environment): Promise<void> {
  const version = versionByKey(environment, 'station-analysis-training');
  const links = await environment.observations.listLinks(version.resourceId);
  const link = links.find((item) => (
    item.status === 'active' &&
    item.resourceVersionId === version.resourceVersionId
  ));
  expect(link, 'Case 15 active Observation Link is missing.');
  await environment.observations.saveLink({
    ...link,
    materialVersionId: `${link.materialId}:wrong-version`,
  });
  const source = await resolveFormalResourceRuntimeSource({
    resourceVersionId: version.resourceVersionId,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
  });
  await environment.observations.saveLink(link);
  record('15 Material Version 错位时不生成正式 Source Context',
    source.status !== 'ready' &&
      !source.sourceContext &&
      source.issues.includes('formal_resource_source_check_failed:observationLinkIdentityAligned'),
    `status=${source.status}, issues=${source.issues.join('|') || 'none'}`);
}

async function case16(successful: Awaited<ReturnType<typeof case01>>): Promise<void> {
  const originalMaterialVersionId = successful.sourceContext.materialVersionId;
  const originalMaterial = await successful.environment.resources.getMaterial(originalMaterialVersionId);
  expect(originalMaterial, 'Case 16 original Material Version is missing.');
  let overwriteBlocked = false;
  try {
    await successful.environment.resources.saveMaterial({
      ...originalMaterial,
      content: `${originalMaterial.content}\n这段内容不得覆盖既有 Material Version。`,
      updatedAt: SUBMITTED_AT,
    });
  } catch {
    overwriteBlocked = true;
  }
  await successful.environment.resources.saveMaterial({
    ...originalMaterial,
    materialVersionId: `${originalMaterial.materialId}:v2`,
    versionNumber: 2,
    content: `${originalMaterial.content}\n这是独立保存的新 Material Version。`,
    createdAt: SUBMITTED_AT,
    updatedAt: SUBMITTED_AT,
  });
  const source = await resolveFormalResourceRuntimeSource({
    resourceVersionId: successful.input.resourceVersion.resourceVersionId,
    resourceRepository: successful.environment.resources,
    observationRepository: successful.environment.observations,
  });
  const trace = validateFormalResourceLearningTrace({
    sourceContext: successful.sourceContext,
    concreteTask: successful.result.checkpoint.concreteTask!,
    diagnosisResult: successful.result.checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.diagnosisResult,
    evidenceReturnResult: successful.result.checkpoint.taskEvidenceReturnResult,
  });
  record('16 Material 新版本不覆盖历史 Response / Diagnosis / Evidence 来源',
    overwriteBlocked &&
      source.status === 'ready' &&
      source.sourceContext?.materialVersionId === originalMaterialVersionId &&
      trace.passed &&
      trace.trace.materialVersionId === originalMaterialVersionId &&
      trace.trace.materialContentHash === successful.sourceContext.materialContentHash,
    `overwriteBlocked=${overwriteBlocked}, source=${source.sourceContext?.materialVersionId || 'none'}, trace=${trace.trace.materialVersionId}, hash=${trace.trace.materialContentHash}`);
}

async function case17(environment: Environment): Promise<void> {
  const version = versionByKey(environment, 'station-comprehension-training');
  expect(version.materialVersionId, 'Case 17 Material Version is missing from Frozen Resource.');
  const missingMaterialRepository = repositoryWithMissingMaterial(
    environment.resources,
    version.materialVersionId,
  );
  const missingMaterial = await resolveFormalResourceRuntimeSource({
    resourceVersionId: version.resourceVersionId,
    resourceRepository: missingMaterialRepository,
    observationRepository: environment.observations,
  });

  const links = await environment.observations.listLinks(version.resourceId);
  const link = links.find((item) => (
    item.status === 'active' &&
    item.resourceVersionId === version.resourceVersionId
  ));
  expect(link, 'Case 17 active Observation Link is missing.');
  const plan = await environment.observations.getPlan(link.materialObservationPlanId);
  const task = plan?.taskPlans.find((item) => item.observationTaskPlanId === link.observationTaskPlanId);
  const anchorId = task?.sourceAnchorIds[0];
  expect(anchorId, 'Case 17 Source Anchor ID is missing.');
  const anchor = await environment.observations.getAnchor(anchorId);
  expect(anchor, 'Case 17 Source Anchor is missing.');
  await environment.observations.saveAnchor({
    ...anchor,
    excerpt: `${anchor.excerpt || ''}（失效）`,
  });
  const invalidAnchor = await resolveFormalResourceRuntimeSource({
    resourceVersionId: version.resourceVersionId,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
  });
  await environment.observations.saveAnchor(anchor);

  record('17 Material 缺失或 Source Anchor 失效时安全阻断',
    missingMaterial.status === 'blocked' &&
      !missingMaterial.sourceContext &&
      missingMaterial.issues.includes('formal_resource_source_check_failed:materialExists') &&
      invalidAnchor.status === 'blocked' &&
      !invalidAnchor.sourceContext &&
      invalidAnchor.issues.includes('formal_resource_source_check_failed:sourceAnchorsTraceable'),
    `missingMaterial=${missingMaterial.status}, invalidAnchor=${invalidAnchor.status}, issues=${unique([...missingMaterial.issues, ...invalidAnchor.issues]).join('|')}`);
}

async function createEnvironment(materialVersionIds?: string[]) {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const observations = new InMemoryMaterialObservationRepository();
  const production = await producePhase17BatchA({
    resourceRepository: resources,
    observationRepository: observations,
    targetState: 'controlled_frozen',
    materialVersionIds,
    reviewerId: REVIEWER,
    reviewNote: REVIEW_NOTE,
    now: NOW,
  });
  const cachedVersions = await resources.listVersions();
  return { resources, observations, production, cachedVersions };
}

async function matchResource(
  environment: Environment,
  taskRequest: TaskRequest,
  historyOverrides: Partial<ResourceMatchRecentHistory> = {},
  difficultyDirection: 'decrease' | 'maintain' | 'increase' = 'maintain',
): Promise<MatchResult> {
  const envelope = buildEnvelope(taskRequest, difficultyDirection);
  const fulfillment = createAdaptiveTaskFulfillmentRequest({
    adaptiveTaskRequestEnvelope: envelope,
    recentTaskIds: historyOverrides.recentTaskIds || [],
    createdAt: SUBMITTED_AT,
  }).request;
  expect(fulfillment, 'Adaptive TaskFulfillment request was blocked.');
  const snapshot = await loadResourceEligibilitySnapshot(environment.resources, SUBMITTED_AT);
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
    recentHistory: {
      studentId: STUDENT_ID,
      recentTaskIds: [],
      recentResourceIds: [],
      recentResourceVersionIds: [],
      recentMaterialIds: [],
      recentExecutionSessionIds: [],
      historyWindowStartedAt: NOW,
      historyWindowEndedAt: SUBMITTED_AT,
      ...historyOverrides,
    },
    evaluatedAt: SUBMITTED_AT,
  });
  const taskResult = createQualityGatedExecutableTask({
    qualityResult: quality,
    fulfillmentRequest: fulfillment,
    currentResourceSnapshot: snapshot,
    createdAt: SUBMITTED_AT,
  });
  if (taskResult.status !== 'created' || !taskResult.task) {
    const status = quality.evaluation?.status === 'review_required'
      ? 'review_required'
      : quality.evaluation?.status === 'partial_match'
        ? 'partial_match'
        : quality.evaluation?.status === 'no_match'
          ? 'no_match'
          : 'blocked';
    return {
      resolution: {
        status,
        taskRequestId: taskRequest.taskRequestId,
        matchEvaluation: quality.evaluation || undefined,
        issues: unique([...quality.issues, ...taskResult.issues]),
      },
    };
  }
  const version = snapshot.frozenVersions.find((item) => (
    item.resourceVersionId === taskResult.task!.resourceVersionId
  ));
  expect(version, 'Matched Frozen Resource version is missing.');
  const preparation = await prepareFormalResourceRuntimeTask({
    resourceVersionId: version.resourceVersionId,
    qualityGatedTask: taskResult.task,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
    createdAt: SUBMITTED_AT,
  });
  expect(preparation.status === 'prepared', preparation.issues.join(','));
  return {
    version,
    qualityTask: taskResult.task,
    resolution: {
      status: 'matched',
      taskRequestId: taskRequest.taskRequestId,
      resourceVersion: version,
      qualityGatedTask: taskResult.task,
      concreteTask: preparation.taskPreparation?.concreteTaskResult.concreteTask || undefined,
      taskReadiness: preparation.taskPreparation?.concreteTaskResult.readiness,
      matchEvaluation: quality.evaluation || undefined,
      issues: [],
    },
  };
}

function buildEnvelope(
  taskRequest: TaskRequest,
  difficultyDirection: 'decrease' | 'maintain' | 'increase',
): AdaptiveTaskRequestEnvelope {
  const constraintsId = `phase17-3-constraints-${taskRequest.taskRequestId}`;
  const materialNovelty = noveltyFor(taskRequest.taskRole);
  const hintPolicy = taskRequest.taskRole === 'retest' ? 'no_hint' : 'limited_hint';
  const capabilities = requiredCapabilities(taskRequest.targetAbilityId, taskRequest.taskRole);
  return {
    envelopeId: `phase17-3-envelope-${taskRequest.taskRequestId}`,
    taskRequest,
    adaptiveConstraints: {
      constraintsId,
      studentId: taskRequest.studentId,
      targetAbilityId: taskRequest.targetAbilityId,
      sourceStrategyId: taskRequest.strategyId,
      sourceStrategyAction: taskRequest.action,
      sourceStrategyTaskRole: taskRequest.taskRole,
      sourceValidationGoal: taskRequest.validationGoal,
      sourceContextSnapshotId: `phase17-3-context-${taskRequest.taskRequestId}`,
      sourceConflictAssessmentId: `phase17-3-conflict-${taskRequest.taskRequestId}`,
      sourceConflictStatus: 'aligned_weakness_evidence',
      sourceQualityAssessmentIds: ['phase17-3-quality-current'],
      sourceEvidenceIds: taskRequest.evidenceLinks,
      sourceObservationUnitIds: ['phase17-3-observation-current'],
      learningIntent: taskRequest.taskRole === 'transfer'
        ? 'transfer_validation'
        : taskRequest.taskRole === 'retest'
          ? 'independent_validation'
          : 'consolidation',
      observationTarget: taskRequest.taskRole === 'transfer'
        ? 'verify_transfer'
        : taskRequest.taskRole === 'retest'
          ? 'verify_independence'
          : 'collect_comparable_evidence',
      recommendedTaskRole: taskRequest.taskRole,
      difficultyDirection,
      materialNovelty,
      hintPolicy,
      targetEvidenceQuality: taskRequest.taskRole === 'retest' ? 'high' : 'medium',
      preExecutionQualityConditions: {
        requireNovelMaterial: taskRequest.taskRole === 'transfer',
        requireKnownDifficulty: true,
        requireAbilityAlignment: true,
        requiredHintPolicy: hintPolicy,
        requireTraceability: true,
      },
      requiredCapabilities: capabilities,
      hardConstraints: [
        { code: 'task_role', operator: 'eq', value: taskRequest.taskRole, source: 'strategy' },
        { code: 'target_ability', operator: 'eq', value: taskRequest.targetAbilityId, source: 'strategy' },
        { code: 'difficulty', operator: 'eq', value: difficultyDirection, source: 'strategy' },
        { code: 'material_novelty', operator: 'eq', value: materialNovelty, source: 'strategy' },
        { code: 'hint_policy', operator: 'eq', value: hintPolicy, source: 'quality' },
      ],
      softPreferences: [],
      reasons: ['Phase 17.3 must reuse the formal Phase 16.2 quality gate.'],
      limitations: [],
      schemaVersion: ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
      policyVersion: ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
      generatedAt: SUBMITTED_AT,
      validation: { passed: true, issues: [] },
    },
    alignmentResult: {
      alignmentId: `phase17-3-alignment-${taskRequest.taskRequestId}`,
      strategyId: taskRequest.strategyId,
      constraintsId,
      contextSnapshotId: `phase17-3-context-${taskRequest.taskRequestId}`,
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

function makeTaskRequest(
  suffix: string,
  targetAbilityId: PrimaryAbilityId,
  taskRole: RecommendedTaskRole,
): TaskRequest {
  const action = taskRole === 'retest'
    ? 'independent_retest'
    : taskRole === 'transfer'
      ? 'transfer_test'
      : taskRole === 'observation'
        ? 'collect_more_evidence'
        : 'continue_training';
  return {
    taskRequestId: `phase17-3-task-request-${suffix}`,
    strategyId: `phase17-3-strategy-${suffix}`,
    studentId: STUDENT_ID,
    targetAbilityId,
    taskRole,
    action,
    validationGoal: `观察 ${targetAbilityId} 在 ${taskRole} 任务中的正式表现。`,
    evidenceLinks: [`phase17-3-evidence-${suffix}`],
    growthMemoryRecordIds: [`phase17-3-memory-${suffix}`],
    constraints: [],
    createdAt: NOW,
  };
}

async function runSingleRound(
  environment: Environment,
  suffix: string,
  initial: MatchResult,
  diagnosis: DiagnosisResult,
  answerText: string,
): Promise<{ result: Phase163RealLearningChainResult; provider: CountingProvider }> {
  expect(initial.version && initial.qualityTask, 'Initial resource is incomplete.');
  const provider = new CountingProvider(new ScriptedDiagnosisProviderAdapter([
    { type: 'response', rawOutput: JSON.stringify(diagnosis), latencyMs: 2 },
  ]));
  const result = await runPhase163RealLearningChain({
    operationId: `phase17-3-operation-${suffix}`,
    learningSessionId: `phase17-3-session-${suffix}`,
    learningRoundId: `phase17-3-round-${suffix}`,
    diagnosisRequestId: `phase17-3-diagnosis-${suffix}`,
    studentId: STUDENT_ID,
    resourceVersion: initial.version,
    qualityGatedTask: initial.qualityTask,
    answerText,
    startedAt: NOW,
    submittedAt: SUBMITTED_AT,
    currentProfile: makeProfile(STUDENT_ID, initial.version.abilityMetadata.abilityId),
    currentGrowthMemorySummary: summarizeGrowthMemory({
      studentId: STUDENT_ID,
      abilityId: initial.version.abilityMetadata.abilityId,
      records: [],
    }),
    currentLearningContext: {
      contextId: `phase17-3-context-${suffix}`,
      studentId: STUDENT_ID,
      currentPhase: 'training',
      targetAbilityId: initial.version.abilityMetadata.abilityId,
      recentTaskRole: initial.version.abilityMetadata.taskRole,
      allowTraining: true,
      allowRetest: true,
      allowTransfer: true,
    },
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: provider.providerName,
      model: 'phase17-3-scripted-model',
      providerConfigId: `phase17-3-config-${suffix}`,
      promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
      maxAttempts: 1,
      timeoutMs: 1_000,
      createdAt: NOW,
    }),
    timezone: 'Asia/Shanghai',
  }, {
    provider,
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    controlledFeedbackRepository: new InMemoryControlledFeedbackRepository(),
    learningPersistenceRepository: new InMemoryLearningPersistenceRepository(),
    operationRepository: new InMemoryRealLearningOperationRepository(),
    resolveNextTask: async ({ taskRequest, previousResourceVersion }) => (
      (await matchResource(environment, taskRequest, historyFor(previousResourceVersion))).resolution
    ),
    now: () => SUBMITTED_AT,
  });
  return { result, provider };
}

function validDiagnosis(mainAbility: PrimaryAbilityId): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'phase17_3_batch_a_formal_resource',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    mainAbility,
    relatedAbilities: [],
    surfaceError: '本次回答能够回应正式题目要求。',
    rootCause: '本次作答已完成正式 Rubric 中的关键观察步骤。',
    errorType: '待验证',
    abilityEvidence: [`学生围绕 ${mainAbility} 的正式任务目标完成了本次回答。`],
    diagnosisSummary: `本次回答与 ${mainAbility} 的正式观察目标一致。`,
    nextTraining: '后续方向由正式 Strategy 根据本次 Evidence 决定。',
    confidence: 0.84,
  };
}

function noveltyFor(taskRole: RecommendedTaskRole): AdaptiveMaterialNovelty {
  if (taskRole === 'transfer') return 'new_context';
  if (taskRole === 'retest') return 'similar_context';
  return 'same_context';
}

function requiredCapabilities(abilityId: string, taskRole: RecommendedTaskRole): string[] {
  const capabilities = ['open_response', 'ability_observation', 'text_evidence'];
  if (abilityId !== 'extraction') capabilities.push('inference_chain');
  if (taskRole === 'training') capabilities.push('focused_practice');
  if (taskRole === 'retest') capabilities.push('independent_answer');
  if (taskRole === 'transfer') capabilities.push('new_context_transfer');
  return capabilities;
}

function historyFor(version: FrozenQuestionResourceVersion): Partial<ResourceMatchRecentHistory> {
  return {
    recentTaskIds: [version.taskId],
    recentResourceIds: [version.resourceId],
    recentResourceVersionIds: [version.resourceVersionId],
    recentMaterialIds: version.materialId ? [version.materialId] : [],
  };
}

function versionByKey(environment: Environment, resourceKey: string): FrozenQuestionResourceVersion {
  const version = environment.cachedVersions.find((item) => (
    item.tags.includes(`batch_a_resource:${resourceKey}`)
  ));
  if (!version) throw new Error(`Batch A resource is missing: ${resourceKey}`);
  return version;
}

function fixtureAnswer(fixtureId: string): string {
  const fixture = PHASE17_BATCH_A_ANSWER_FIXTURES.find((item) => item.fixtureId === fixtureId);
  if (!fixture) throw new Error(`Batch A answer fixture is missing: ${fixtureId}`);
  return fixture.studentAnswer;
}

function repositoryWithMissingMaterial(
  repository: InMemoryQuestionResourceAdmissionRepository,
  missingMaterialVersionId: string,
): InMemoryQuestionResourceAdmissionRepository {
  return new Proxy(repository, {
    get(target, property) {
      if (property === 'getMaterial') {
        return async (materialVersionId: string) => (
          materialVersionId === missingMaterialVersionId
            ? null
            : target.getMaterial(materialVersionId)
        );
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
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

function record(name: string, passed: boolean, detail: string): void {
  reports.push({ name, passed, detail });
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
