import {
  createPhase173BatchABootstrapTaskRequest,
  matchPhase173BatchAFormalResource,
} from '../agents/phase173FormalResourceMatchingService.ts';
import { preparePhase173BatchAPreflight } from '../agents/phase173BatchAPreflightService.ts';
import { producePhase17BatchA } from '../agents/phase17BatchAProductionService.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type {
  RecommendedTaskRole,
  TaskRequest,
} from '../schemas/nextLearningStrategy.schema.ts';
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

async function bootstrapTraining(environment: Environment): Promise<void> {
  const request = createPhase173BatchABootstrapTaskRequest(STUDENT_ID, NOW);
  const result = await match(environment, request, {
    recentMaterialIds: ['phase17-batch-a-material-station'],
  });
  record(
    '01 /learning 首轮从 Batch A 匹配 analysis Training',
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
    '02 Retest 保持 inference 并切换正式材料',
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
    '03 Transfer 保持 analysis 并进入新材料',
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
    '04 缺少 summarization 时不拿其他 Ability 凑匹配',
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
    '05 匹配结果携带可执行 Concrete Task 与正式 Observation 来源',
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
