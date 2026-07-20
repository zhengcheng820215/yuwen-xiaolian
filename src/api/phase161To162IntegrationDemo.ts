import {
  createNextQuestionResourceVersionDraft,
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
} from '../ai/agents/questionResourceAdmissionAgent.ts';
import { evaluateCoreResourceEligibility } from '../ai/agents/coreResourceEligibilityAgent.ts';
import {
  createQualityGatedExecutableTask,
  evaluateResourceMatchQuality,
} from '../ai/agents/resourceMatchQualityAgent.ts';
import { loadResourceEligibilitySnapshot } from '../ai/agents/reviewedResourceCandidateAdapter.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../ai/repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type { AdaptiveTaskRequestEnvelope } from '../ai/schemas/adaptiveTaskConstraints.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  PrimaryAbilityId,
  QuestionResourceRubricItem,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import type {
  CoreResourceEligibilityResult,
  QualityGatedExecutableTaskResult,
  ResourceEligibilitySnapshot,
  ResourceMatchQualityResult,
  ResourceMatchRecentHistory,
} from '../ai/schemas/resourceMatchQuality.schema.ts';
import type { TaskFulfillmentRequest } from '../ai/schemas/taskFulfillment.schema.ts';
import { getResourceMatchingQualityDemoData } from './resourceMatchingQualityDemo.ts';

const NOW = '2026-07-20T13:00:00.000Z';
const LATER = '2026-07-20T14:00:00.000Z';
const STUDENT_ID = 'student-phase16-integration-demo';
const MATERIAL_TEXT = '父亲从旧书中发现一片褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。';

type Repository = InMemoryQuestionResourceAdmissionRepository;

type PipelineResult = {
  snapshot: ResourceEligibilitySnapshot;
  coreEligibility: CoreResourceEligibilityResult;
  qualityResult: ResourceMatchQualityResult;
  fulfillment: TaskFulfillmentRequest;
};

type RepositoryFixture = {
  repository: Repository;
  draftId: string;
  version: FrozenQuestionResourceVersion;
};

export type ResourceIntegrationDemoCase = {
  id: string;
  label: string;
  description: string;
  expected: string;
  acceptancePoints: string[];
  passed: boolean;
  stages: Array<{
    id: string;
    label: string;
    status: 'passed' | 'blocked' | 'review';
    detail: string;
  }>;
  selectedVersion: FrozenQuestionResourceVersion | null;
  studentPreview: {
    title: string;
    abilityLabel: string;
    readingText: string;
    questionText: string;
  } | null;
  repositoryState: {
    registryEntries: Awaited<ReturnType<Repository['listRegistryEntries']>>;
    versions: Awaited<ReturnType<Repository['listVersions']>>;
    snapshot: ResourceEligibilitySnapshot;
    currentSnapshot: ResourceEligibilitySnapshot;
  };
  coreEligibility: CoreResourceEligibilityResult;
  qualityResult: ResourceMatchQualityResult;
  taskResult: QualityGatedExecutableTaskResult;
};

export async function getPhase161To162IntegrationDemoData(): Promise<{
  defaultCaseId: string;
  cases: ResourceIntegrationDemoCase[];
  summary: { total: number; passed: number };
}> {
  const cases = await Promise.all([
    buildNormalCase(),
    buildVersionSwitchCase(),
    buildRegistryChangeCase(),
    buildResourceGapCase(),
  ]);
  return {
    defaultCaseId: 'repository-handoff',
    cases,
    summary: {
      total: cases.length,
      passed: cases.filter((item) => item.passed).length,
    },
  };
}

async function buildNormalCase(): Promise<ResourceIntegrationDemoCase> {
  const fixture = await createFrozenRepositoryResource('handoff');
  const pipeline = await runPipeline(fixture.repository);
  const taskResult = createQualityGatedExecutableTask({
    qualityResult: pipeline.qualityResult,
    fulfillmentRequest: pipeline.fulfillment,
    currentResourceSnapshot: pipeline.snapshot,
    createdAt: NOW,
  });
  const passed = pipeline.coreEligibility.status === 'eligible' &&
    pipeline.qualityResult.evaluation?.status === 'matched' &&
    taskResult.status === 'created' &&
    taskResult.task?.resourceVersionId === fixture.version.resourceVersionId;

  return createCaseResult({
    id: 'repository-handoff',
    label: '正式资源完整交接',
    description: '从 Phase 16.1 Repository 创建并冻结一道真实结构化题目，再由 Phase 16.2 读取并生成可执行任务。',
    expected: '六步链路全部通过，并在学生预览区展示最终题目内容。',
    acceptancePoints: [
      '资源经过校验、审核和冻结后才进入候选池。',
      'Snapshot、Registry、Version 与任务追溯身份一致。',
      '学生预览不暴露内部 ID 或 Runtime 字段。',
    ],
    fixture,
    pipeline,
    taskResult,
    passed,
  });
}

async function buildVersionSwitchCase(): Promise<ResourceIntegrationDemoCase> {
  const fixture = await createFrozenRepositoryResource('version-switch');
  const v2 = await freezeNextVersion(fixture.repository, fixture.version, 'draft-integration-version-switch-v2');
  const pipeline = await runPipeline(fixture.repository);
  const taskResult = createQualityGatedExecutableTask({
    qualityResult: pipeline.qualityResult,
    fulfillmentRequest: pipeline.fulfillment,
    currentResourceSnapshot: pipeline.snapshot,
    createdAt: LATER,
  });
  const versions = await fixture.repository.listVersions(fixture.version.resourceId);
  const v1 = versions.find((item) => item.resourceVersionId === fixture.version.resourceVersionId);
  const passed = v1?.status === 'superseded' &&
    pipeline.qualityResult.evaluation?.selectedResourceVersionId === v2.resourceVersionId &&
    taskResult.task?.resourceVersionId === v2.resourceVersionId;

  return createCaseResult({
    id: 'version-switch',
    label: '正式版本切换',
    description: '同一资源冻结 v2 后，Repository 将 v1 标记为 superseded，并把 Registry 切换到最新正式版本。',
    expected: 'v1 保留追溯但不可选择，系统只使用 v2 创建任务。',
    acceptancePoints: [
      '历史版本仍可查询，但不会重新进入任务匹配。',
      'Registry 当前版本与最终任务版本一致。',
      '新版本内容进入学生题目预览。',
    ],
    fixture,
    pipeline,
    taskResult,
    passed,
  });
}

async function buildRegistryChangeCase(): Promise<ResourceIntegrationDemoCase> {
  const fixture = await createFrozenRepositoryResource('registry-change');
  const pipeline = await runPipeline(fixture.repository);
  await freezeNextVersion(fixture.repository, fixture.version, 'draft-integration-registry-change-v2');
  const currentSnapshot = await loadResourceEligibilitySnapshot(fixture.repository, LATER);
  const taskResult = createQualityGatedExecutableTask({
    qualityResult: pipeline.qualityResult,
    fulfillmentRequest: pipeline.fulfillment,
    currentResourceSnapshot: currentSnapshot,
    createdAt: LATER,
  });
  const passed = pipeline.qualityResult.evaluation?.status === 'matched' &&
    taskResult.status === 'blocked' &&
    taskResult.issues.includes('selected_resource_is_no_longer_current');

  return createCaseResult({
    id: 'registry-changed',
    label: 'Registry 变化阻断',
    description: '资源匹配完成后 Registry 切换到 v2，模拟任务正式创建前资源版本已经变化。',
    expected: '原 matched 结果立即失效，不得使用 v1 创建任务。',
    acceptancePoints: [
      '匹配时的 Snapshot 与创建时当前 Snapshot 被分别保留。',
      '创建前二次 Registry 校验可以阻断过期结果。',
      '阻断分支不显示学生题目预览。',
    ],
    fixture,
    pipeline,
    taskResult,
    passed,
    currentSnapshot,
  });
}

async function buildResourceGapCase(): Promise<ResourceIntegrationDemoCase> {
  const fixture = await createFrozenRepositoryResource('resource-gap');
  const pipeline = await runPipeline(fixture.repository, 'comprehension');
  const taskResult = createQualityGatedExecutableTask({
    qualityResult: pipeline.qualityResult,
    fulfillmentRequest: pipeline.fulfillment,
    currentResourceSnapshot: pipeline.snapshot,
    createdAt: NOW,
  });
  const passed = pipeline.coreEligibility.status === 'no_eligible_resource' &&
    pipeline.qualityResult.evaluation?.status === 'no_match' &&
    Boolean(pipeline.qualityResult.evaluation?.resourceGap) &&
    taskResult.status === 'blocked';

  return createCaseResult({
    id: 'resource-gap',
    label: '无合适正式资源',
    description: 'Repository 中只有推理资源，但当前请求需要理解能力，模拟正式资源池无法满足任务请求。',
    expected: '输出 Resource Gap，不猜测使用错位资源，也不创建任务。',
    acceptancePoints: [
      '主要能力错位在 16.2A 被识别。',
      '16.2B 形成结构化 Resource Gap。',
      '错误资源不会进入学生体验区。',
    ],
    fixture,
    pipeline,
    taskResult,
    passed,
  });
}

async function createCaseResult(input: {
  id: string;
  label: string;
  description: string;
  expected: string;
  acceptancePoints: string[];
  fixture: RepositoryFixture;
  pipeline: PipelineResult;
  taskResult: QualityGatedExecutableTaskResult;
  passed: boolean;
  currentSnapshot?: ResourceEligibilitySnapshot;
}): Promise<ResourceIntegrationDemoCase> {
  const registryEntries = await input.fixture.repository.listRegistryEntries();
  const versions = await input.fixture.repository.listVersions();
  const currentSnapshot = input.currentSnapshot || input.pipeline.snapshot;
  const selectedVersionId = input.taskResult.task?.resourceVersionId ||
    input.pipeline.qualityResult.evaluation?.selectedResourceVersionId;
  const selectedVersion = versions.find((item) => item.resourceVersionId === selectedVersionId) || null;
  const qualityStatus = input.pipeline.qualityResult.evaluation?.status || 'review_required';
  const admissionPassed = versions.length > 0 && registryEntries.length > 0;
  const taskCreated = input.taskResult.status === 'created';

  return {
    id: input.id,
    label: input.label,
    description: input.description,
    expected: input.expected,
    acceptancePoints: input.acceptancePoints,
    passed: input.passed,
    stages: [
      { id: 'draft', label: '材料与草稿', status: 'passed', detail: '正式录入对象已创建' },
      { id: 'review', label: '校验与审核', status: 'passed', detail: 'Validation 与 Review 已通过' },
      { id: 'freeze', label: '冻结与登记', status: admissionPassed ? 'passed' : 'blocked', detail: admissionPassed ? 'Frozen Version 已进入 Registry' : '正式资源未建立' },
      { id: 'eligibility', label: '16.2A 核心资格', status: stageStatus(input.pipeline.coreEligibility.status === 'eligible', input.pipeline.coreEligibility.status === 'review_required'), detail: readableCoreStatus(input.pipeline.coreEligibility.status) },
      { id: 'quality', label: '16.2B 匹配质量', status: stageStatus(qualityStatus === 'matched', qualityStatus === 'review_required'), detail: readableQualityStatus(qualityStatus) },
      { id: 'task', label: '可执行任务', status: taskCreated ? 'passed' : 'blocked', detail: taskCreated ? '任务已创建并可预览' : '任务创建已安全阻断' },
    ],
    selectedVersion,
    studentPreview: taskCreated && selectedVersion ? {
      title: selectedVersion.title,
      abilityLabel: abilityLabel(selectedVersion.abilityMetadata.abilityId),
      readingText: selectedVersion.materialSnapshot?.content || MATERIAL_TEXT,
      questionText: selectedVersion.questionStem,
    } : null,
    repositoryState: {
      registryEntries,
      versions,
      snapshot: input.pipeline.snapshot,
      currentSnapshot,
    },
    coreEligibility: input.pipeline.coreEligibility,
    qualityResult: input.pipeline.qualityResult,
    taskResult: input.taskResult,
  };
}

async function runPipeline(
  repository: Repository,
  targetAbilityId: PrimaryAbilityId = 'inference',
): Promise<PipelineResult> {
  const envelope = buildEnvelope(targetAbilityId);
  const fulfillment = buildFulfillment(targetAbilityId);
  const snapshot = await loadResourceEligibilitySnapshot(repository, NOW);
  const coreEligibility = evaluateCoreResourceEligibility({
    adaptiveTaskRequestEnvelope: envelope,
    taskFulfillmentRequest: fulfillment,
    resourceSnapshot: snapshot,
    evaluatedAt: NOW,
  });
  const qualityResult = evaluateResourceMatchQuality({
    adaptiveRequestEnvelope: envelope,
    fulfillmentRequest: fulfillment,
    coreEligibility,
    resourceSnapshot: snapshot,
    recentHistory: buildHistory(),
    evaluatedAt: NOW,
  });
  return { snapshot, coreEligibility, qualityResult, fulfillment };
}

async function createFrozenRepositoryResource(suffix: string): Promise<RepositoryFixture> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  const materialId = `material-integration-demo-${suffix}`;
  const materialVersionId = `${materialId}:v1`;
  const resourceId = `resource-integration-demo-${suffix}`;
  const draftId = `draft-integration-demo-${suffix}`;

  await createQuestionMaterial(repository, {
    materialId,
    materialVersionId,
    versionNumber: 1,
    title: '旧书中的树叶',
    content: MATERIAL_TEXT,
    source: { sourceType: 'manual', description: 'Phase 16.1 -> 16.2 browser integration fixture.' },
    createdAt: NOW,
  });
  await createStructuredQuestionDraft(repository, {
    draftId,
    resourceId,
    taskId: `task-integration-demo-${suffix}`,
    materialVersionId,
    title: '人物心理推断训练',
    questionStem: '父亲当时有怎样的心理？请根据材料中的动作说明理由。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['怀念', '不舍', '珍惜'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: validRubric('inference'),
    minimumAnswerRequirement: {
      minLength: 8,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'inference',
      supportingAbilityIds: ['comprehension'],
      prerequisiteAbilityIds: ['comprehension'],
      taskRole: 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: { sourceType: 'manual', description: 'Phase 16.1 -> 16.2 browser integration fixture.' },
    tags: ['material_relation:similar_context', 'hint_policy:limited_hint', '人物心理'],
    now: NOW,
  });
  const validation = await validateStructuredQuestionDraft(repository, draftId, NOW);
  if (!validation.passed) throw new Error(`Integration resource validation failed: ${suffix}`);
  await submitQuestionResourceForReview(repository, draftId, NOW);
  await reviewQuestionResourceDraft(repository, {
    draftId,
    action: 'approve',
    reviewerId: 'reviewer-integration-demo',
    notes: 'Approved for browser integration acceptance.',
    now: NOW,
  });
  const version = (await freezeQuestionResourceDraft(repository, draftId, NOW)).version;
  return { repository, draftId, version };
}

async function freezeNextVersion(
  repository: Repository,
  current: FrozenQuestionResourceVersion,
  draftId: string,
): Promise<FrozenQuestionResourceVersion> {
  const draft = await createNextQuestionResourceVersionDraft(repository, {
    resourceId: current.resourceId,
    draftId,
    now: LATER,
  });
  await updateStructuredQuestionDraft(repository, draft.draftId, {
    questionStem: `${draft.questionStem} 请把动作和心理之间的关系说清楚。`,
  }, LATER);
  const validation = await validateStructuredQuestionDraft(repository, draft.draftId, LATER);
  if (!validation.passed) throw new Error('Integration v2 validation failed.');
  await submitQuestionResourceForReview(repository, draft.draftId, LATER);
  await reviewQuestionResourceDraft(repository, {
    draftId: draft.draftId,
    action: 'approve',
    reviewerId: 'reviewer-integration-demo',
    notes: 'Approved v2 for browser integration acceptance.',
    now: LATER,
  });
  return (await freezeQuestionResourceDraft(repository, draft.draftId, LATER)).version;
}

function buildEnvelope(targetAbilityId: PrimaryAbilityId): AdaptiveTaskRequestEnvelope {
  const base = clone(getResourceMatchingQualityDemoData().cases[0].scenario.envelope);
  base.taskRequest.studentId = STUDENT_ID;
  base.taskRequest.targetAbilityId = targetAbilityId;
  base.adaptiveConstraints.studentId = STUDENT_ID;
  base.adaptiveConstraints.targetAbilityId = targetAbilityId;
  for (const rule of base.adaptiveConstraints.hardConstraints) {
    if (rule.code === 'target_ability') rule.value = targetAbilityId;
  }
  return base;
}

function buildFulfillment(targetAbilityId: PrimaryAbilityId): TaskFulfillmentRequest {
  const base = clone(getResourceMatchingQualityDemoData().cases[0].scenario.fulfillment);
  base.studentId = STUDENT_ID;
  base.targetAbilityId = targetAbilityId;
  return base;
}

function buildHistory(): ResourceMatchRecentHistory {
  return {
    studentId: STUDENT_ID,
    recentTaskIds: [],
    recentResourceIds: [],
    recentResourceVersionIds: [],
    recentMaterialIds: [],
    recentExecutionSessionIds: [],
    historyWindowStartedAt: '2026-07-13T13:00:00.000Z',
    historyWindowEndedAt: NOW,
  };
}

function validRubric(abilityId: PrimaryAbilityId): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence',
      name: '文本依据',
      abilityId,
      importance: 'critical',
      required: true,
      evidenceRequirement: { requireTextEvidence: true },
      acceptedSignals: ['指出父亲站了很久或小心夹回树叶'],
    },
    {
      itemId: 'explanation',
      name: '解释关系',
      abilityId,
      importance: 'important',
      required: true,
      evidenceRequirement: { requireExplanation: true, requireConclusion: true },
      acceptedSignals: ['说明动作与怀念、不舍之间的联系'],
    },
  ];
}

function stageStatus(passed: boolean, review: boolean): 'passed' | 'blocked' | 'review' {
  if (passed) return 'passed';
  return review ? 'review' : 'blocked';
}

function readableCoreStatus(status: CoreResourceEligibilityResult['status']): string {
  return {
    eligible: '核心资格通过',
    no_eligible_resource: '没有满足核心约束的资源',
    review_required: '需要人工复核',
    blocked: '输入已阻断',
  }[status];
}

function readableQualityStatus(status: string): string {
  return {
    matched: '上下文完全匹配',
    partial_match: '只满足部分条件',
    no_match: '已形成资源缺口',
    review_required: '需要人工复核',
  }[status] || status;
}

function abilityLabel(abilityId: string): string {
  return {
    inference: '推理',
    comprehension: '理解',
    summarization: '概括',
    expression: '表达',
  }[abilityId] || abilityId;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
