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
import type { RecommendedTaskRole } from '../ai/schemas/nextLearningStrategy.schema.ts';
import type {
  CoreResourceEligibilityResult,
  QualityGatedExecutableTaskResult,
  ResourceEligibilitySnapshot,
  ResourceMatchQualityResult,
  ResourceMatchRecentHistory,
} from '../ai/schemas/resourceMatchQuality.schema.ts';
import type { TaskFulfillmentRequest } from '../ai/schemas/taskFulfillment.schema.ts';
import { getResourceMatchingQualityDemoData } from './resourceMatchingQualityDemo.ts';
import { PHASE163_DEMO_STUDENT_ID } from './phase163LearningIdentity.ts';

const NOW = '2026-07-20T13:00:00.000Z';
const LATER = '2026-07-20T14:00:00.000Z';
const STUDENT_ID = PHASE163_DEMO_STUDENT_ID;
const MATERIAL_TEXT =
  '周末午后，父亲整理准备搬走的书柜，一本多年没有翻过的旧书从高处滑了下来。' +
  '书里夹着一片已经褪色的树叶，旁边还留着孩子小时候写下的日期和“第一次春游”几个歪歪扭扭的字。' +
  '父亲原本收拾得很快，看到这里却停了下来。他用指腹轻轻抚过叶脉，捏着树叶站了很久。' +
  '孩子在门外催他时，他只笑了笑，说：“这本先别收。”随后掸去书页上的灰尘，把树叶小心地夹回原处，又把书放回书柜最上层。';

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

export type Phase163FormalResourcePoolItem = {
  version: FrozenQuestionResourceVersion;
  task: NonNullable<QualityGatedExecutableTaskResult['task']>;
};

type ResourceFixtureOptions = {
  taskRole?: RecommendedTaskRole;
  materialTitle?: string;
  materialText?: string;
  taskTitle?: string;
  questionStem?: string;
  acceptedKeywords?: string[];
  acceptedSignals?: [string, string];
  tags?: string[];
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

export async function getPhase163FormalResourcePoolData(
  studentId = STUDENT_ID,
): Promise<Phase163FormalResourcePoolItem[]> {
  const specifications: Array<{ suffix: string; options: ResourceFixtureOptions }> = [
    {
      suffix: 'phase163-training-leaf-v2',
      options: {},
    },
    {
      suffix: 'phase163-training-umbrella-v2',
      options: {
        materialTitle: '雨中的伞',
        materialText:
          '放学时突然下起大雨，校门口挤满了等候的家长。母亲匆匆赶来时，裤脚已经湿了一截，手里只带着一把不大的伞。' +
          '回家的路上，风不断把雨吹进伞下。母亲几次停下来调整伞的位置，又把伞往孩子那边推了推。' +
          '孩子提醒她自己的半边肩膀已经湿透，她却低头看了看孩子怀里的书包，只说：“别让书和校服淋湿，明天还要用。”' +
          '走到屋檐下后，她先替孩子擦去袖口的雨水，才拧了拧自己湿透的衣角。',
        taskTitle: '人物心理推断练习',
        questionStem: '母亲把伞推向孩子一侧，表现出怎样的心理？请结合她的动作说明理由。',
        acceptedKeywords: ['关心', '爱护', '担心'],
        acceptedSignals: ['指出母亲把伞推向孩子、关注书包校服或先替孩子擦雨水', '说明这些动作与关心、爱护孩子之间的联系'],
      },
    },
    {
      suffix: 'phase163-retest-window-v2',
      options: {
        taskRole: 'retest',
        materialTitle: '离开教室前',
        materialText:
          '放学铃响后，同学们很快收拾书包离开了教室。李老师站在讲台旁，把散落的作业纸按小组重新分好，' +
          '又在黑板右下角写下第二天要提醒大家的事项。窗外起了风，她走到窗边关好半开的窗户，' +
          '顺手扶正被吹歪的花盆，还把一张掉在地上的值日表重新贴牢。走到门口时，她回头看了看整齐的课桌和已经关好的电灯，' +
          '确认没有遗漏后，才轻轻带上教室门。',
        taskTitle: '人物心理独立复测',
        questionStem: '李老师离开教室前的动作表现出怎样的心理？请结合材料中的细节说明理由。',
        acceptedKeywords: ['关心', '负责', '留意'],
        acceptedSignals: ['指出整理作业、记录提醒、关窗扶花盆或离开前再次确认等细节', '说明这些动作与关心学生、做事认真负责之间的联系'],
        tags: ['material_relation:new_context', 'hint_policy:no_hint', '人物心理', '独立复测'],
      },
    },
    {
      suffix: 'phase163-transfer-platform-v2',
      options: {
        taskRole: 'transfer',
        materialTitle: '站台上的目光',
        materialText:
          '女儿第一次独自去外地参加为期一个月的夏令营。候车时，父亲一遍遍检查行李牌，又把写着联系电话的小纸条塞进背包侧袋。' +
          '广播响起后，他没有再多叮嘱，只替女儿理了理衣领，说：“到了记得报平安。”列车缓缓开动，' +
          '父亲没有追着车走，只站在原地朝车窗挥手。女儿隔着玻璃回头时，看见他仍望着车厢的方向。' +
          '直到列车驶过站台尽头、再也看不见了，他才慢慢放下举着的手臂。',
        taskTitle: '人物心理迁移验证',
        questionStem: '父亲在列车开动后的动作表现出怎样的心理？请结合新的材料情境说明理由。',
        acceptedKeywords: ['不舍', '牵挂', '留恋'],
        acceptedSignals: ['指出反复检查行李、留下联系方式、一直挥手或看不见后才放下手臂', '说明这些动作与不舍、牵挂或担心之间的联系'],
        tags: ['material_relation:new_context', 'hint_policy:limited_hint', '人物心理', '迁移验证'],
      },
    },
    {
      suffix: 'phase163-observation-notebook-v2',
      options: {
        taskRole: 'observation',
        materialTitle: '合上的笔记本',
        materialText:
          '下课铃响后，学生们离开了教室，周老师仍坐在讲台旁整理刚批改完的阅读笔记。她把笔记本逐本合好，' +
          '看到小宇的那一本时，又重新翻到最后一页。那一页有好几处擦掉重写的痕迹，页角还写着一句“我还是没有想明白”。' +
          '周老师在这句话旁停留了一会儿，没有立刻写评语，而是在备课本上记下小宇的名字和一道较短的练习题。' +
          '随后，她把这本笔记放在最上面，准备第二天课前先找小宇谈一谈。',
        taskTitle: '人物心理继续观察',
        questionStem: '周老师停留片刻后才放回笔记本，表现出怎样的心理？请结合材料中的动作说明理由。',
        acceptedKeywords: ['关注', '在意', '思考', '担心'],
        acceptedSignals: ['指出重新翻阅、在留言旁停留、记录名字与练习题或准备谈话等细节', '说明这些动作与老师关注学生困难、认真思考帮助方法之间的联系'],
        tags: ['material_relation:similar_context', 'hint_policy:limited_hint', '人物心理', '继续观察'],
      },
    },
    {
      suffix: 'phase163-diagnosis-corridor-v2',
      options: {
        taskRole: 'diagnosis',
        materialTitle: '走廊里的脚步',
        materialText:
          '班级辩论赛结果公布后，小林所在的小组只差一票落败。掌声响起时，他低头把自己的发言稿折了几下，' +
          '没有和队友说话便快步走出教室。走到走廊拐角，他听见队友正在感谢彼此的配合，也有人说下一次还想和他一起准备。' +
          '小林停下脚步，回头望了望仍围在一起的同学。他把折皱的发言稿慢慢展开，犹豫片刻后又走回教室，' +
          '在空着的座位旁坐下，听队友复盘刚才的比赛。',
        taskTitle: '人物心理诊断观察',
        questionStem: '小林走出教室后又返回，表现出怎样的心理变化？请结合前后动作说明理由。',
        acceptedKeywords: ['失落', '犹豫', '不舍', '想融入'],
        acceptedSignals: ['指出低头离开、听见队友后停步回望、展开发言稿或返回教室等前后变化', '说明动作变化与失落、犹豫以及愿意重新面对团队之间的联系'],
        tags: ['material_relation:similar_context', 'hint_policy:limited_hint', 'capability:root_cause_probe', '人物心理', '诊断观察'],
      },
    },
  ];

  const pool: Phase163FormalResourcePoolItem[] = [];
  for (const specification of specifications) {
    const fixture = await createFrozenRepositoryResource(specification.suffix, specification.options);
    const role = specification.options.taskRole || 'training';
    const pipeline = await runPipeline(fixture.repository, 'inference', role, studentId);
    const taskResult = createQualityGatedExecutableTask({
      qualityResult: pipeline.qualityResult,
      fulfillmentRequest: pipeline.fulfillment,
      currentResourceSnapshot: pipeline.snapshot,
      createdAt: NOW,
    });
    if (
      pipeline.coreEligibility.status !== 'eligible' ||
      pipeline.qualityResult.evaluation?.status !== 'matched' ||
      taskResult.status !== 'created' ||
      !taskResult.task
    ) {
      const details = [
        `core=${pipeline.coreEligibility.status}`,
        `quality=${pipeline.qualityResult.evaluation?.status || 'missing'}`,
        `task=${taskResult.status}`,
        ...pipeline.coreEligibility.issues,
        ...(pipeline.qualityResult.evaluation?.issues || []),
        ...taskResult.issues,
      ];
      throw new Error(`Formal Phase 16.3 resource failed admission or matching: ${specification.suffix}; ${details.join(', ')}`);
    }
    pool.push({ version: fixture.version, task: taskResult.task });
  }
  return pool;
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
  taskRole: RecommendedTaskRole = 'training',
  studentId = STUDENT_ID,
): Promise<PipelineResult> {
  const envelope = buildEnvelope(targetAbilityId, taskRole, studentId);
  const fulfillment = buildFulfillment(targetAbilityId, taskRole, studentId);
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
    recentHistory: buildHistory(studentId),
    evaluatedAt: NOW,
  });
  return { snapshot, coreEligibility, qualityResult, fulfillment };
}

async function createFrozenRepositoryResource(
  suffix: string,
  options: ResourceFixtureOptions = {},
): Promise<RepositoryFixture> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  const materialId = `material-integration-demo-${suffix}`;
  const materialVersionId = `${materialId}:v1`;
  const resourceId = `resource-integration-demo-${suffix}`;
  const draftId = `draft-integration-demo-${suffix}`;

  await createQuestionMaterial(repository, {
    materialId,
    materialVersionId,
    versionNumber: 1,
    title: options.materialTitle || '旧书中的树叶',
    content: options.materialText || MATERIAL_TEXT,
    source: { sourceType: 'manual', description: 'Phase 16.1 -> 16.2 browser integration fixture.' },
    createdAt: NOW,
  });
  await createStructuredQuestionDraft(repository, {
    draftId,
    resourceId,
    taskId: `task-integration-demo-${suffix}`,
    materialVersionId,
    title: options.taskTitle || '人物心理推断训练',
    questionStem: options.questionStem || '父亲当时有怎样的心理？请根据材料中的动作说明理由。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: options.acceptedKeywords || ['怀念', '不舍', '珍惜'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: validRubric('inference', options.acceptedSignals),
    minimumAnswerRequirement: {
      minLength: 8,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'inference',
      supportingAbilityIds: ['comprehension'],
      prerequisiteAbilityIds: ['comprehension'],
      taskRole: options.taskRole || 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: { sourceType: 'manual', description: 'Phase 16.1 -> 16.2 browser integration fixture.' },
    tags: options.tags || ['material_relation:similar_context', 'hint_policy:limited_hint', '人物心理'],
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

function buildEnvelope(
  targetAbilityId: PrimaryAbilityId,
  taskRole: RecommendedTaskRole = 'training',
  studentId = STUDENT_ID,
): AdaptiveTaskRequestEnvelope {
  const base = clone(getResourceMatchingQualityDemoData().cases[0].scenario.envelope);
  const isRetest = taskRole === 'retest';
  const isTransfer = taskRole === 'transfer';
  const isDiagnosis = taskRole === 'diagnosis';
  const isObservation = taskRole === 'observation';
  const action = isRetest
    ? 'independent_retest'
    : isTransfer
      ? 'transfer_test'
      : isDiagnosis
        ? 'diagnostic_verification'
        : isObservation ? 'collect_more_evidence' : 'continue_training';
  const materialNovelty = isRetest || isTransfer ? 'new_context' : 'similar_context';
  const hintPolicy = isRetest ? 'no_hint' : 'limited_hint';
  base.taskRequest.studentId = studentId;
  base.taskRequest.targetAbilityId = targetAbilityId;
  base.taskRequest.taskRole = taskRole;
  base.taskRequest.action = action;
  base.taskRequest.constraints = [`targetAbilityId:${targetAbilityId}`, `taskRole:${taskRole}`];
  base.adaptiveConstraints.studentId = studentId;
  base.adaptiveConstraints.targetAbilityId = targetAbilityId;
  base.adaptiveConstraints.sourceStrategyAction = base.taskRequest.action;
  base.adaptiveConstraints.sourceStrategyTaskRole = taskRole;
  base.adaptiveConstraints.learningIntent = isRetest
    ? 'independent_validation'
    : isTransfer
      ? 'transfer_validation'
      : isDiagnosis
        ? 'diagnostic_observation'
        : isObservation ? 'discriminating_observation' : 'consolidation';
  base.adaptiveConstraints.observationTarget = isRetest
    ? 'verify_independence'
    : isTransfer
      ? 'verify_transfer'
      : 'recheck_weakness';
  base.adaptiveConstraints.recommendedTaskRole = taskRole;
  base.adaptiveConstraints.materialNovelty = materialNovelty;
  base.adaptiveConstraints.hintPolicy = hintPolicy;
  base.adaptiveConstraints.targetEvidenceQuality = isRetest || isTransfer ? 'high' : 'medium';
  base.adaptiveConstraints.preExecutionQualityConditions.requireNovelMaterial = isRetest || isTransfer;
  base.adaptiveConstraints.preExecutionQualityConditions.requiredHintPolicy = hintPolicy;
  base.adaptiveConstraints.requiredCapabilities = capabilitiesForRole(taskRole);
  for (const rule of base.adaptiveConstraints.hardConstraints) {
    if (rule.code === 'target_ability') rule.value = targetAbilityId;
    if (rule.code === 'task_role') rule.value = taskRole;
    if (rule.code === 'material_novelty') rule.value = base.adaptiveConstraints.materialNovelty;
    if (rule.code === 'hint_policy') rule.value = base.adaptiveConstraints.hintPolicy;
  }
  return base;
}

function buildFulfillment(
  targetAbilityId: PrimaryAbilityId,
  taskRole: RecommendedTaskRole = 'training',
  studentId = STUDENT_ID,
): TaskFulfillmentRequest {
  const base = clone(getResourceMatchingQualityDemoData().cases[0].scenario.fulfillment);
  base.studentId = studentId;
  base.targetAbilityId = targetAbilityId;
  base.taskRole = taskRole;
  base.contentType = taskRole === 'retest' || taskRole === 'transfer' ? 'new_text' : 'comparable_text';
  base.requiredCapabilities = capabilitiesForRole(taskRole);
  return base;
}

function buildHistory(studentId = STUDENT_ID): ResourceMatchRecentHistory {
  return {
    studentId,
    recentTaskIds: [],
    recentResourceIds: [],
    recentResourceVersionIds: [],
    recentMaterialIds: [],
    recentExecutionSessionIds: [],
    historyWindowStartedAt: '2026-07-13T13:00:00.000Z',
    historyWindowEndedAt: NOW,
  };
}

function validRubric(
  abilityId: PrimaryAbilityId,
  acceptedSignals: [string, string] = [
    '指出父亲站了很久或小心夹回树叶',
    '说明动作与怀念、不舍之间的联系',
  ],
): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence',
      name: '文本依据',
      abilityId,
      importance: 'critical',
      required: true,
      evidenceRequirement: { requireTextEvidence: true },
      acceptedSignals: [acceptedSignals[0]],
    },
    {
      itemId: 'explanation',
      name: '解释关系',
      abilityId,
      importance: 'important',
      required: true,
      evidenceRequirement: { requireExplanation: true, requireConclusion: true },
      acceptedSignals: [acceptedSignals[1]],
    },
  ];
}

function capabilitiesForRole(taskRole: RecommendedTaskRole): string[] {
  const common = ['open_response', 'ability_observation', 'text_evidence', 'inference_chain'];
  if (taskRole === 'retest') return [...common, 'independent_answer'];
  if (taskRole === 'transfer') return [...common, 'new_context_transfer'];
  if (taskRole === 'diagnosis') return [...common, 'root_cause_probe'];
  if (taskRole === 'observation') return common;
  return [...common, 'focused_practice'];
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
