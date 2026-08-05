import {
  createPhase173BatchABootstrapTaskRequest,
  loadCurrentFormalResourceVersions,
  loadPhase173BatchACurrentVersions,
  matchCurrentFormalResource,
  matchPhase173BatchAFormalResource,
  resolveFormalResourceBootstrapMatch,
} from '../agents/phase173FormalResourceMatchingService.ts';
import { adaptReviewedResourceCandidate } from '../agents/reviewedResourceCandidateAdapter.ts';
import { buildScopedFormalResourceHistory } from '../agents/formalResourceHistoryScope.ts';
import { preparePhase173BatchAPreflight } from '../agents/phase173BatchAPreflightService.ts';
import { producePhase17BatchA } from '../agents/phase17BatchAProductionService.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type {
  RecommendedTaskRole,
  TaskRequest,
} from '../schemas/nextLearningStrategy.schema.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { PrimaryAbilityId } from '../schemas/questionResourceAdmission.schema.ts';
import type { ResourceMatchRecentHistory } from '../schemas/resourceMatchQuality.schema.ts';

const NOW = '2026-07-23T16:00:00.000Z';
const STUDENT_ID = 'phase17-3-learning-entry-student';
const REVIEWER_ID = 'phase17-3-learning-entry-reviewer';
const REVIEW_NOTE = 'Phase 17.3 Batch A /learning entry integration Debug review.';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;
type CaseResult = { name: string; passed: boolean; detail: string };

const reports: CaseResult[] = [];

async function main(): Promise<void> {
  const environment = await createEnvironment();
  await genericRegistryRead(environment);
  await genericFormalMatch(environment);
  await legacyHintPolicyCompatibility(environment);
  await dynamicBootstrapAbility(environment);
  await endedSessionDoesNotLeakMaterialContext(environment);
  await activeSessionKeepsMaterialContext(environment);
  await bootstrapTraining(environment);
  await retestMatch(environment);
  await transferMatch(environment);
  await abilityMismatch(environment);
  await formalSourcePreparation(environment);

  console.log('\nPhase 17.3 Batch A /learning Entry Integration Debug');
  console.log('='.repeat(82));
  for (const report of reports) {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail}`);
  }
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(82));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  console.log('Provider mode: none');
  console.log('DeepSeek Live calls: 0');
  console.log('Formal side effects: isolated in-memory repositories');
  if (passed !== reports.length) {
    throw new Error('Phase 17.3 Batch A /learning entry integration Debug failed.');
  }
}

async function endedSessionDoesNotLeakMaterialContext(environment: Environment): Promise<void> {
  const usedVersion = environment.versions.find((item) => (
    item.status === 'frozen' &&
    item.abilityMetadata.taskRole === 'training' &&
    Boolean(item.materialId)
  ));
  expect(usedVersion, 'Ended-session history version is missing.');
  const history = buildScopedFormalResourceHistory({
    studentId: STUDENT_ID,
    records: [persistenceRecord('ended-session', usedVersion.resourceVersionId)],
    currentVersions: environment.versions,
    historyWindowEndedAt: NOW,
  });
  record(
    '04 已结束会话不向新学习泄漏素材上下文',
    history.recentResourceVersionIds?.includes(usedVersion.resourceVersionId) === true &&
      history.recentTaskIds?.length === 0 &&
      history.recentResourceIds?.length === 0 &&
      history.recentMaterialIds?.length === 0,
    `versions=${history.recentResourceVersionIds?.length || 0}, tasks=${history.recentTaskIds?.length || 0}, resources=${history.recentResourceIds?.length || 0}, materials=${history.recentMaterialIds?.length || 0}`,
  );
}

async function activeSessionKeepsMaterialContext(environment: Environment): Promise<void> {
  const usedVersion = environment.versions.find((item) => (
    item.status === 'frozen' &&
    item.abilityMetadata.taskRole === 'training' &&
    Boolean(item.materialId)
  ));
  expect(usedVersion, 'Active-session history version is missing.');
  const history = buildScopedFormalResourceHistory({
    studentId: STUDENT_ID,
    records: [persistenceRecord('active-session', usedVersion.resourceVersionId)],
    currentVersions: environment.versions,
    activeLearningSessionId: 'active-session',
    historyWindowEndedAt: NOW,
  });
  record(
    '05 活动会话继续保留同素材训练上下文',
    history.recentResourceVersionIds?.includes(usedVersion.resourceVersionId) === true &&
      history.recentTaskIds?.includes(usedVersion.taskId) === true &&
      history.recentResourceIds?.includes(usedVersion.resourceId) === true &&
      history.recentMaterialIds?.includes(usedVersion.materialId!) === true,
    `versions=${history.recentResourceVersionIds?.length || 0}, tasks=${history.recentTaskIds?.length || 0}, resources=${history.recentResourceIds?.length || 0}, materials=${history.recentMaterialIds?.join('|') || 'none'}`,
  );
}

async function genericRegistryRead(environment: Environment): Promise<void> {
  const repository = withoutBatchResourcePrefix(environment.resources);
  const [allVersions, batchVersions] = await Promise.all([
    loadCurrentFormalResourceVersions(repository),
    loadPhase173BatchACurrentVersions(repository),
  ]);
  record(
    '01 正式学习读取全部 active Registry，不依赖 Batch A 前缀',
    allVersions.length === 8 && batchVersions.length === 0 && allVersions.every((item) => (
      item.resourceId.startsWith('formal-runtime-resource-')
    )),
    `formal=${allVersions.length}, batch=${batchVersions.length}, first=${allVersions[0]?.resourceId || 'none'}`,
  );
}

async function genericFormalMatch(environment: Environment): Promise<void> {
  const request = createPhase173BatchABootstrapTaskRequest(STUDENT_ID, NOW);
  const result = await matchCurrentFormalResource({
    taskRequest: request,
    studentId: STUDENT_ID,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
    recentHistory: { recentMaterialIds: ['phase17-batch-a-material-station'] },
    evaluatedAt: NOW,
  });
  record(
    '02 正式学习通用匹配器可准备当前 Registry 资源',
    result.status === 'matched' &&
      result.resourceVersion?.abilityMetadata.abilityId === 'analysis' &&
      result.resourceVersion.abilityMetadata.taskRole === 'training' &&
      result.taskReadiness?.canExecute === true,
    `status=${result.status}, resource=${result.resourceVersion?.resourceId || 'none'}, executable=${result.taskReadiness?.canExecute || false}`,
  );
}

async function legacyHintPolicyCompatibility(environment: Environment): Promise<void> {
  const training = environment.versions.find((item) => (
    item.status === 'frozen' && item.abilityMetadata.taskRole === 'training'
  ));
  const retest = environment.versions.find((item) => (
    item.status === 'frozen' && item.abilityMetadata.taskRole === 'retest'
  ));
  expect(training && retest, 'Legacy hint policy fixtures are missing.');

  const legacyTraining = adaptReviewedResourceCandidate({
    version: {
      ...training,
      tags: training.tags.filter((tag) => !tag.startsWith('hint_policy:')),
    },
  });
  const legacyRetest = adaptReviewedResourceCandidate({
    version: {
      ...retest,
      tags: retest.tags.filter((tag) => !tag.startsWith('hint_policy:')),
    },
  });

  record(
    '02B 历史正式资源缺少提示策略时按任务角色兼容读取',
    legacyTraining.capabilities.includes('hint_policy:limited_hint') &&
      legacyRetest.capabilities.includes('hint_policy:no_hint'),
    `training=${legacyTraining.capabilities.filter((item) => item.startsWith('hint_policy:')).join('|') || 'none'}, retest=${legacyRetest.capabilities.filter((item) => item.startsWith('hint_policy:')).join('|') || 'none'}`,
  );
}

async function dynamicBootstrapAbility(environment: Environment): Promise<void> {
  const usedVersion = environment.versions.find((item) => (
    item.status === 'frozen' &&
    item.abilityMetadata.abilityId === 'analysis' &&
    item.abilityMetadata.taskRole === 'training' &&
    item.materialId === 'phase17-batch-a-material-station'
  ));
  expect(usedVersion, 'Dynamic bootstrap analysis history version is missing.');
  const recentHistory: ResourceMatchRecentHistory = {
    studentId: STUDENT_ID,
    recentTaskIds: [usedVersion.taskId],
    recentResourceIds: [usedVersion.resourceId],
    recentResourceVersionIds: [usedVersion.resourceVersionId],
    recentMaterialIds: [usedVersion.materialId!],
  };
  const resolution = await resolveFormalResourceBootstrapMatch({
    studentId: STUDENT_ID,
    versions: environment.versions,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
    recentHistory,
    evaluatedAt: NOW,
  });
  record(
    '03 首轮能力动态解析，同材料已用版本不耗尽其他能力任务',
    resolution.taskRequest.targetAbilityId !== 'analysis' &&
      resolution.matched.status === 'matched' &&
      resolution.matched.resourceVersion?.materialId === usedVersion.materialId,
    `selectedAbility=${resolution.taskRequest.targetAbilityId}, status=${resolution.matched.status}, resource=${resolution.matched.resourceVersion?.resourceId || 'none'}, material=${resolution.matched.resourceVersion?.materialId || 'none'}`,
  );
}

async function bootstrapTraining(environment: Environment): Promise<void> {
  const request = createPhase173BatchABootstrapTaskRequest(STUDENT_ID, NOW);
  const result = await match(environment, request, {
    recentMaterialIds: ['phase17-batch-a-material-station'],
  });
  record(
    '06 /learning 首轮从 Batch A 匹配 analysis Training',
    result.status === 'matched' &&
      result.resourceVersion?.resourceId === 'phase17-batch-a-resource-station-analysis-training' &&
      result.resourceVersion.abilityMetadata.abilityId === 'analysis' &&
      result.resourceVersion.abilityMetadata.taskRole === 'training',
    `status=${result.status}, resource=${result.resourceVersion?.resourceId || 'none'}, version=${result.resourceVersion?.resourceVersionId || 'none'}`,
  );
}

async function retestMatch(environment: Environment): Promise<void> {
  const result = await match(
    environment,
    makeTaskRequest('retest', 'inference', 'retest'),
    historyFor('station-inference-training', environment),
  );
  record(
    '07 Retest 保持 inference 并切换正式材料',
    result.status === 'matched' &&
      result.resourceVersion?.resourceId === 'phase17-batch-a-resource-riverbank-inference-retest' &&
      result.resourceVersion.materialId === 'phase17-batch-a-material-riverbank',
    `status=${result.status}, resource=${result.resourceVersion?.resourceId || 'none'}, material=${result.resourceVersion?.materialId || 'none'}`,
  );
}

async function transferMatch(environment: Environment): Promise<void> {
  const result = await match(
    environment,
    makeTaskRequest('transfer', 'analysis', 'transfer'),
    historyFor('station-analysis-training', environment),
  );
  record(
    '08 Transfer 保持 analysis 并进入新材料',
    result.status === 'matched' &&
      result.resourceVersion?.resourceId === 'phase17-batch-a-resource-riverbank-analysis-transfer' &&
      result.resourceVersion.materialId === 'phase17-batch-a-material-riverbank',
    `status=${result.status}, resource=${result.resourceVersion?.resourceId || 'none'}, material=${result.resourceVersion?.materialId || 'none'}`,
  );
}

async function abilityMismatch(environment: Environment): Promise<void> {
  const result = await match(
    environment,
    makeTaskRequest('mismatch', 'summarization', 'training'),
    { recentMaterialIds: ['phase17-batch-a-material-station'] },
  );
  record(
    '09 缺少 summarization 时不拿其他 Ability 凑匹配',
    result.status === 'no_match' && !result.resourceVersion,
    `status=${result.status}, resource=${result.resourceVersion?.resourceId || 'none'}, issues=${result.issues.join('|') || 'none'}`,
  );
}

async function formalSourcePreparation(environment: Environment): Promise<void> {
  const result = await match(
    environment,
    createPhase173BatchABootstrapTaskRequest(STUDENT_ID, NOW),
    { recentMaterialIds: ['phase17-batch-a-material-station'] },
  );
  record(
    '10 匹配结果携带可执行 Concrete Task 与正式 Observation 来源',
    result.status === 'matched' &&
      Boolean(result.concreteTask) &&
      result.taskReadiness?.canExecute === true &&
      result.concreteTask?.questionMetadata.questionId === result.resourceVersion?.resourceVersionId &&
      result.concreteTask?.targetAbilityId === 'analysis' &&
      result.concreteTask?.taskRole === 'training' &&
      result.resourceVersion?.abilityMetadata.abilityId === result.concreteTask?.targetAbilityId &&
      result.resourceVersion?.abilityMetadata.taskRole === result.concreteTask?.taskRole &&
      result.concreteTask?.rubric.some((item) => (
        item.id === 'character-evidence' &&
        item.description?.includes('关注检票信息')
      )) &&
      result.concreteTask?.referenceAnswer?.includes('整理水杯和肩带') &&
      result.concreteTask?.referenceAnswer?.includes('动作体现细心'),
    `status=${result.status}, executable=${result.taskReadiness?.canExecute || false}, question=${result.concreteTask?.questionMetadata.questionId || 'none'}, ability=${result.concreteTask?.targetAbilityId || 'none'}, role=${result.concreteTask?.taskRole || 'none'}, rubricSignals=${result.concreteTask?.rubric.some((item) => item.description?.includes('关注检票信息')) || false}, referenceSignals=${result.concreteTask?.referenceAnswer?.includes('动作体现细心') || false}`,
  );
}

function withoutBatchResourcePrefix(
  repository: QuestionResourceAdmissionRepository,
): QuestionResourceAdmissionRepository {
  const rename = (resourceId: string) => resourceId.replace(
    'phase17-batch-a-resource-',
    'formal-runtime-resource-',
  );
  return new Proxy(repository, {
    get(target, property) {
      if (property === 'listRegistryEntries') {
        return async () => (await target.listRegistryEntries()).map((entry) => ({
          ...entry,
          resourceId: rename(entry.resourceId),
        }));
      }
      if (property === 'getVersion') {
        return async (resourceVersionId: string) => {
          const version = await target.getVersion(resourceVersionId);
          return version ? { ...version, resourceId: rename(version.resourceId) } : null;
        };
      }
      const value = target[property as keyof QuestionResourceAdmissionRepository];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

async function createEnvironment() {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const observations = new InMemoryMaterialObservationRepository();
  await producePhase17BatchA({
    resourceRepository: resources,
    observationRepository: observations,
    targetState: 'controlled_frozen',
    reviewerId: REVIEWER_ID,
    reviewNote: REVIEW_NOTE,
    now: NOW,
  });
  const preflight = await preparePhase173BatchAPreflight({
    resourceRepository: resources,
    observationRepository: observations,
    reviewerId: REVIEWER_ID,
    reviewNote: REVIEW_NOTE,
    now: NOW,
  });
  expect(preflight.status !== 'blocked', preflight.issues.join('|'));
  expect(preflight.activeRegistryCount === 8, 'Batch A active Registry count is not 8.');
  expect(preflight.activeObservationLinkCount === 8, 'Batch A Observation Link count is not 8.');
  const versions = await resources.listVersions();
  return { resources, observations, versions };
}

async function match(
  environment: Environment,
  taskRequest: TaskRequest,
  recentHistory: Partial<ResourceMatchRecentHistory>,
) {
  return matchPhase173BatchAFormalResource({
    taskRequest,
    studentId: STUDENT_ID,
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
    recentHistory,
    evaluatedAt: NOW,
  });
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
      : 'continue_training';
  return {
    taskRequestId: `phase17-3-learning-entry-request-${suffix}`,
    strategyId: `phase17-3-learning-entry-strategy-${suffix}`,
    studentId: STUDENT_ID,
    targetAbilityId,
    taskRole,
    action,
    validationGoal: `观察 ${targetAbilityId} 在 ${taskRole} 正式任务中的表现。`,
    evidenceLinks: [`phase17-3-learning-entry-evidence-${suffix}`],
    growthMemoryRecordIds: [`phase17-3-learning-entry-memory-${suffix}`],
    constraints: [],
    createdAt: NOW,
  };
}

function historyFor(resourceKey: string, environment: Environment): Partial<ResourceMatchRecentHistory> {
  const version = environment.versions.find((item) => (
    item.tags.includes(`batch_a_resource:${resourceKey}`) &&
    item.status === 'frozen'
  ));
  expect(version, `Batch A history resource is missing: ${resourceKey}`);
  return {
    recentTaskIds: [version.taskId],
    recentResourceIds: [version.resourceId],
    recentResourceVersionIds: [version.resourceVersionId],
    recentMaterialIds: version.materialId ? [version.materialId] : [],
  };
}

function persistenceRecord(
  learningSessionId: string,
  resourceVersionId: string,
): LearningPersistenceRecord {
  return {
    recordId: `${STUDENT_ID}::${learningSessionId}-round-1`,
    studentId: STUDENT_ID,
    learningRoundId: `${learningSessionId}-round-1`,
    concreteTask: {
      questionMetadata: { questionId: resourceVersionId },
    } as LearningPersistenceRecord['concreteTask'],
    status: 'saved',
    issues: [],
    savedAt: NOW,
    updatedAt: NOW,
    version: 'phase12_1_v1',
    schemaVersion: 'learning_persistence_v1',
  };
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
