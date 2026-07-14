import {
  createTaskResource,
  createTaskResourceDraft,
  prepareConcreteLearningTaskFromResource,
  validateTaskResourceDraft,
} from '../ai/agents/taskResourcePreparationAgent.ts';
import type { TaskResource, TaskResourceInput } from '../ai/schemas/taskResource.schema.ts';
import { buildFulfillmentRequestFixture } from '../ai/tests/taskFulfillmentDebugFixtures.ts';
import { PHASE12_INTEGRATION_RESOURCES } from '../data/phase12IntegrationResources.ts';
import { taskResourceRepository as repository } from './taskResourceRepository.ts';

const demoRunAt = '2026-07-14T15:20:00.000Z';

export function getTaskResourcePreparationDemoInput(): TaskResourceInput {
  return {
    title: '父亲整理旧书阅读题',
    externalResourceId: 'manual-reading-001',
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
    referenceAnswer: '可以推断父亲舍不得过去与孩子共同阅读的回忆，也珍惜和牵挂孩子。',
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
  };
}

export async function saveTaskResourceDraftDemo(input: TaskResourceInput) {
  const draft = createTaskResourceDraft({
    input,
    draftId: `demo-draft-${Date.now()}`,
    createdAt: demoRunAt,
  });
  const validation = validateTaskResourceDraft(draft);
  await repository.saveDraft(draft);

  return {
    draft,
    validation,
  };
}

export async function createTaskResourceDemo(input: TaskResourceInput) {
  const draft = createTaskResourceDraft({
    input,
    draftId: `demo-draft-${Date.now()}`,
    createdAt: demoRunAt,
  });
  await repository.saveDraft(draft);

  const existingResourceIds = (await repository.listResources()).map((resource) => resource.resourceId);
  const creation = createTaskResource({
    draft,
    existingResourceIds,
    resourceId: `resource-demo-${Date.now()}`,
    createdAt: demoRunAt,
  });

  if (!creation.resource) {
    return {
      draft,
      validation: creation.validation,
      resource: null,
      preparation: null,
    };
  }

  const resource = await repository.saveResource(creation.resource);
  const preparation = prepareConcreteLearningTaskFromResource({
    resource,
    fulfillmentRequest: buildFulfillmentRequestFixture({
      requestId: `fulfillment-demo-${Date.now()}`,
      targetAbilityId: resource.targetAbilityId,
    }),
    createdAt: demoRunAt,
  });

  return {
    draft,
    validation: creation.validation,
    resource,
    preparation,
  };
}

export async function clearTaskResourcePreparationDemo() {
  await repository.clear();
}

export async function ensurePhase12IntegrationResources(): Promise<TaskResource[]> {
  for (const definition of PHASE12_INTEGRATION_RESOURCES) {
    const existing = await repository.getResource(definition.resourceId);
    if (existing) continue;

    const draft = createTaskResourceDraft({
      input: definition.input,
      draftId: `draft-${definition.resourceId}`,
      createdAt: demoRunAt,
    });
    await repository.saveDraft(draft);
    const creation = createTaskResource({
      draft,
      existingResourceIds: (await repository.listResources()).map((item) => item.resourceId),
      resourceId: definition.resourceId,
      taskRole: definition.taskRole,
      createdAt: demoRunAt,
    });
    if (!creation.resource || !creation.validation.canEnterTaskFulfillment) {
      throw new Error(`集成资源 ${definition.resourceId} 未通过 Phase 12.2 正式校验。`);
    }
    try {
      await repository.saveResource(creation.resource);
    } catch (error) {
      const concurrentlySaved = await repository.getResource(definition.resourceId);
      if (!concurrentlySaved) throw error;
    }
  }

  return repository.listResources();
}
