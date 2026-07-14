import {
  createTaskResource,
  createTaskResourceDraft,
  prepareConcreteLearningTaskFromResource,
  validateTaskResourceDraft,
} from '../agents/taskResourcePreparationAgent.ts';
import { InMemoryTaskResourceRepository } from '../repositories/inMemoryTaskResourceRepository.ts';
import {
  isTaskResource,
  isTaskResourceDraft,
  isTaskResourceValidationResult,
  type TaskResourceInput,
} from '../schemas/taskResource.schema.ts';
import { isConcreteLearningTask, isTaskReadinessValidation } from '../schemas/concreteLearningTask.schema.ts';
import { buildFulfillmentRequestFixture } from './taskFulfillmentDebugFixtures.ts';

const runAt = '2026-07-14T15:20:00.000Z';

type DebugCaseResult = {
  id: string;
  title: string;
  pass: boolean;
  draftId?: string;
  resourceId?: string;
  canSaveDraft?: boolean;
  canCreateResource?: boolean;
  canEnterTaskFulfillment?: boolean;
  matchStatus?: string;
  concreteTaskId?: string;
  readinessCanExecute?: boolean;
  issues: string[];
};

async function runTaskResourcePreparationDebug(): Promise<void> {
  const repository = new InMemoryTaskResourceRepository();
  const results: DebugCaseResult[] = [];

  results.push(await runNormalReadingCase(repository));
  results.push(await runMissingAssessmentBasisCase(repository));
  results.push(await runEmptyRubricCase(repository));
  results.push(await runMissingTargetAbilityCase(repository));
  results.push(await runMissingReadingTextCase(repository));
  results.push(await runExpressionWithoutReadingTextCase(repository));
  results.push(await runUntraceableSourceCase(repository));
  results.push(await runDuplicateResourceIdCase(repository));
  results.push(await runAbilityMismatchCase(repository));
  results.push(await runTraceabilityCase(repository));

  const pass = results.every((result) => result.pass);

  console.log('Phase 12.2 Task Resource Preparation Debug Report');
  console.log('==================================================');
  console.log(`total: ${results.length}`);
  console.log(`pass: ${results.filter((result) => result.pass).length}`);
  console.log(`fail: ${results.filter((result) => !result.pass).length}`);
  console.log('');

  results.forEach((result) => {
    console.log(`[${result.pass ? 'PASS' : 'FAIL'}] ${result.id} ${result.title}`);
    console.log(`draftId: ${result.draftId || 'none'}`);
    console.log(`resourceId: ${result.resourceId || 'none'}`);
    console.log(`canSaveDraft: ${String(result.canSaveDraft)}`);
    console.log(`canCreateResource: ${String(result.canCreateResource)}`);
    console.log(`canEnterTaskFulfillment: ${String(result.canEnterTaskFulfillment)}`);
    console.log(`matchStatus: ${result.matchStatus || 'none'}`);
    console.log(`concreteTaskId: ${result.concreteTaskId || 'none'}`);
    console.log(`readinessCanExecute: ${String(result.readinessCanExecute)}`);
    console.log(`issues: ${result.issues.length > 0 ? result.issues.join(' | ') : 'none'}`);
    console.log('');
  });

  if (!pass) {
    console.error('[FAIL] Phase 12.2 Task Resource Preparation debug failed.');
    process.exitCode = 1;
    return;
  }

  console.log('[PASS] Phase 12.2 Task Resource Preparation debug passed.');
}

async function runNormalReadingCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: buildReadingInput(),
    draftId: 'draft-normal-reading',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);
  const { resource, validation } = createTaskResource({
    draft,
    existingResourceIds: (await repository.listResources()).map((item) => item.resourceId),
    resourceId: 'resource-normal-reading',
    createdAt: runAt,
  });
  if (resource) await repository.saveResource(resource);

  const prepared = resource
    ? prepareConcreteLearningTaskFromResource({
      resource,
      fulfillmentRequest: buildFulfillmentRequestFixture({
        requestId: 'fulfillment-normal-reading',
        targetAbilityId: '推理',
      }),
      createdAt: runAt,
    })
    : null;

  return buildResult('case_1', '正常阅读题生成可执行任务', draft, validation, {
    resourceId: resource?.resourceId,
    matchStatus: prepared?.matchResult.status,
    concreteTaskId: prepared?.concreteTaskResult.concreteTask?.taskId,
    readinessCanExecute: prepared?.concreteTaskResult.readiness.canExecute,
    pass: Boolean(
      isTaskResourceDraft(draft) &&
      resource &&
      isTaskResource(resource) &&
      validation.canCreateResource &&
      prepared?.matchResult.status === 'matched' &&
      prepared.concreteTaskResult.concreteTask &&
      isConcreteLearningTask(prepared.concreteTaskResult.concreteTask) &&
      isTaskReadinessValidation(prepared.concreteTaskResult.readiness) &&
      prepared.concreteTaskResult.readiness.canExecute,
    ),
  });
}

async function runMissingAssessmentBasisCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: {
      ...buildReadingInput(),
      referenceAnswer: undefined,
      assessmentBasis: [],
      rubric: undefined,
    },
    draftId: 'draft-missing-assessment',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);
  const validation = validateTaskResourceDraft(draft);

  return buildResult('case_2', '缺少评价依据只能保存草稿', draft, validation, {
    pass: validation.canSaveDraft && !validation.canCreateResource && hasIssue(validation, 'MISSING_ASSESSMENT_BASIS'),
  });
}

async function runEmptyRubricCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: {
      ...buildReadingInput(),
      referenceAnswer: undefined,
      assessmentBasis: [],
      rubric: [{} as never],
    },
    draftId: 'draft-empty-rubric',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);
  const validation = validateTaskResourceDraft(draft);

  return buildResult('case_3', '空 rubric 不算有效评价依据', draft, validation, {
    pass: !validation.checks.hasAssessmentBasis && !validation.canCreateResource,
  });
}

async function runMissingTargetAbilityCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: {
      ...buildReadingInput(),
      targetAbilityId: '',
    },
    draftId: 'draft-missing-ability',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);
  const validation = validateTaskResourceDraft(draft);

  return buildResult('case_4', '缺少目标能力阻断正式资源', draft, validation, {
    pass: !validation.canCreateResource && hasIssue(validation, 'MISSING_TARGET_ABILITY'),
  });
}

async function runMissingReadingTextCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: {
      ...buildReadingInput(),
      readingText: '',
    },
    draftId: 'draft-missing-reading-text',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);
  const validation = validateTaskResourceDraft(draft);

  return buildResult('case_5', '阅读题缺少材料阻断正式资源', draft, validation, {
    pass: !validation.canCreateResource && hasIssue(validation, 'MISSING_READING_TEXT'),
  });
}

async function runExpressionWithoutReadingTextCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: {
      ...buildReadingInput(),
      title: '表达练习',
      readingText: undefined,
      questionType: 'expression',
      targetAbilityId: '表达',
      questionText: '请把“我很高兴”扩写成一句更具体的句子。',
      answerRequirements: ['补充具体原因。', '表达要清楚完整。'],
      assessmentBasis: ['是否写出具体原因。', '表达是否完整。'],
      referenceAnswer: '我看到自己的努力终于有了结果，心里特别高兴。',
      source: {
        type: 'manual',
        description: 'Phase 12.2 表达题样例。',
      },
    },
    draftId: 'draft-expression-no-reading',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);
  const { resource, validation } = createTaskResource({
    draft,
    existingResourceIds: (await repository.listResources()).map((item) => item.resourceId),
    resourceId: 'resource-expression-no-reading',
    taskRole: 'training',
    createdAt: runAt,
  });
  if (resource) await repository.saveResource(resource);

  const prepared = resource
    ? prepareConcreteLearningTaskFromResource({
      resource,
      fulfillmentRequest: buildFulfillmentRequestFixture({
        requestId: 'fulfillment-expression',
        taskRole: 'training',
        targetAbilityId: '表达',
        contentType: 'short_text',
        requiredCapabilities: ['open_response', 'ability_observation', 'independent_answer', 'focused_practice'],
        hardConstraints: ['taskRole:training', 'targetAbilityId:表达', 'responseMode:written', 'questionType:open_response'],
      }),
      createdAt: runAt,
    })
    : null;

  return buildResult('case_6', '非阅读表达题可不提供 readingText', draft, validation, {
    resourceId: resource?.resourceId,
    matchStatus: prepared?.matchResult.status,
    concreteTaskId: prepared?.concreteTaskResult.concreteTask?.taskId,
    readinessCanExecute: prepared?.concreteTaskResult.readiness.canExecute,
    pass: Boolean(resource && validation.canCreateResource && prepared?.concreteTaskResult.readiness.canExecute),
  });
}

async function runUntraceableSourceCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: {
      ...buildReadingInput(),
      source: {
        type: 'exam',
      },
    },
    draftId: 'draft-untraceable-source',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);
  const validation = validateTaskResourceDraft(draft);

  return buildResult('case_7', '来源不可追溯阻断正式资源', draft, validation, {
    pass: !validation.canCreateResource && hasIssue(validation, 'SOURCE_NOT_TRACEABLE'),
  });
}

async function runDuplicateResourceIdCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: buildReadingInput({ title: '重复资源测试' }),
    draftId: 'draft-duplicate-resource',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);

  const duplicateId = 'resource-normal-reading';
  const { resource, validation } = createTaskResource({
    draft,
    existingResourceIds: (await repository.listResources()).map((item) => item.resourceId),
    resourceId: duplicateId,
    createdAt: runAt,
  });

  return buildResult('case_8', '重复 resourceId 不静默覆盖', draft, validation, {
    resourceId: resource?.resourceId || duplicateId,
    pass: !resource && !validation.canCreateResource && hasIssue(validation, 'DUPLICATE_RESOURCE_ID'),
  });
}

async function runAbilityMismatchCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const draft = createTaskResourceDraft({
    input: buildReadingInput({ title: '能力不一致测试' }),
    draftId: 'draft-ability-mismatch',
    createdAt: runAt,
  });
  await repository.saveDraft(draft);
  const { resource, validation } = createTaskResource({
    draft,
    existingResourceIds: (await repository.listResources()).map((item) => item.resourceId),
    resourceId: 'resource-ability-mismatch',
    createdAt: runAt,
  });
  if (resource) await repository.saveResource(resource);

  const prepared = resource
    ? prepareConcreteLearningTaskFromResource({
      resource,
      fulfillmentRequest: buildFulfillmentRequestFixture({
        requestId: 'fulfillment-ability-mismatch',
        targetAbilityId: '理解',
      }),
      createdAt: runAt,
    })
    : null;

  return buildResult('case_9', 'TaskRequest 与 TaskResource 能力不一致不匹配', draft, validation, {
    resourceId: resource?.resourceId,
    matchStatus: prepared?.matchResult.status,
    concreteTaskId: prepared?.concreteTaskResult.concreteTask?.taskId,
    readinessCanExecute: prepared?.concreteTaskResult.readiness.canExecute,
    pass: Boolean(resource && prepared?.matchResult.status === 'no_match' && !prepared.concreteTaskResult.readiness.canExecute),
  });
}

async function runTraceabilityCase(repository: InMemoryTaskResourceRepository): Promise<DebugCaseResult> {
  const resource = await repository.loadResource('resource-normal-reading');
  if (!resource) {
    return {
      id: 'case_10',
      title: '资源可追溯性',
      pass: false,
      issues: ['resource-normal-reading missing.'],
    };
  }

  const prepared = prepareConcreteLearningTaskFromResource({
    resource,
    fulfillmentRequest: buildFulfillmentRequestFixture({
      requestId: 'fulfillment-traceability',
      targetAbilityId: '推理',
    }),
    createdAt: runAt,
  });

  const concreteTask = prepared.concreteTaskResult.concreteTask;

  return {
    id: 'case_10',
    title: 'resourceId 进入 ConcreteLearningTask 追溯链',
    pass: Boolean(
      concreteTask &&
      concreteTask.sourceExecutableTaskId &&
      concreteTask.sourceTaskRequestId &&
      concreteTask.sourceFulfillmentRequestId &&
      concreteTask.sourceExecutableTaskId.includes(resource.resourceId),
    ),
    draftId: 'none',
    resourceId: resource.resourceId,
    canSaveDraft: true,
    canCreateResource: true,
    canEnterTaskFulfillment: true,
    matchStatus: prepared.matchResult.status,
    concreteTaskId: concreteTask?.taskId,
    readinessCanExecute: prepared.concreteTaskResult.readiness.canExecute,
    issues: prepared.concreteTaskResult.readiness.issues.map((issue) => issue.message),
  };
}

function buildReadingInput(overrides: Partial<TaskResourceInput> = {}): TaskResourceInput {
  return {
    title: '父亲整理旧书阅读题',
    readingText:
      '傍晚，父亲把旧书一本本擦干净，又把折角的书页压平。' +
      '我问他为什么还要整理这些旧书，父亲说：“有些东西旧了，但不能随便丢。”' +
      '说完，他把其中一本童话书放回我的书架，站在门口看了很久。',
    questionText: '从父亲整理旧书并停留观看的行为中，可以推断出他怎样的心理？请结合文本说明。',
    answerRequirements: [
      '先找出文本中的关键行为或细节。',
      '说明这些行为与人物心理之间的关系。',
      '用完整句子表达推断结论。',
    ],
    questionType: 'reading_open_response',
    targetAbilityId: '推理',
    referenceAnswer:
      '可以推断父亲舍不得过去与孩子共同阅读的回忆，也珍惜和牵挂孩子。',
    assessmentBasis: [
      '能提取“整理旧书”“放回童话书”“站在门口看了很久”等文本线索。',
      '能从行为线索推断父亲的不舍、怀念或牵挂。',
      '能说明文本依据与心理结论之间的关系。',
    ],
    source: {
      type: 'exam',
      description: 'Phase 12.2 手工录入阅读题样例。',
      title: '初中语文阅读训练样题',
      grade: '七年级',
      year: '2026',
      pageOrQuestionNo: 'Q1',
    },
    ...overrides,
  };
}

function buildResult(
  id: string,
  title: string,
  draft: ReturnType<typeof createTaskResourceDraft>,
  validation: ReturnType<typeof validateTaskResourceDraft>,
  extra: Partial<DebugCaseResult> & { pass: boolean },
): DebugCaseResult {
  return {
    id,
    title,
    pass: extra.pass,
    draftId: draft.draftId,
    resourceId: extra.resourceId,
    canSaveDraft: validation.canSaveDraft,
    canCreateResource: validation.canCreateResource,
    canEnterTaskFulfillment: validation.canEnterTaskFulfillment,
    matchStatus: extra.matchStatus,
    concreteTaskId: extra.concreteTaskId,
    readinessCanExecute: extra.readinessCanExecute,
    issues: [
      ...validation.issues.map((issue) => `${issue.code}: ${issue.message}`),
      ...(extra.issues || []),
    ],
  };
}

function hasIssue(validation: ReturnType<typeof validateTaskResourceDraft>, code: string): boolean {
  return validation.issues.some((issue) => issue.code === code);
}

runTaskResourcePreparationDebug();
