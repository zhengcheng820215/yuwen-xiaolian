import type { TaskResourceInput } from '../ai/schemas/taskResource.schema.ts';
import type { RecommendedTaskRole } from '../ai/schemas/nextLearningStrategy.schema.ts';

export type Phase12IntegrationResourceDefinition = {
  resourceId: string;
  taskRole: RecommendedTaskRole;
  input: TaskResourceInput;
};

const PHASE12_OBSERVATION_RESOURCES: Phase12IntegrationResourceDefinition[] = [
  {
    resourceId: 'phase12-real-inference-v1-001',
    taskRole: 'observation',
    input: {
      title: '旧书里的树叶',
      externalResourceId: 'phase12-reading-inference-001',
      readingText:
        '父亲整理书柜时，从一本旧书里发现一片已经褪色的树叶。' +
        '他捏着树叶站了很久，最后把它小心地夹回原处。',
      questionText: '结合父亲的动作，推断他此时的心理，并说明文本依据。',
      answerRequirements: [
        '写出父亲此时的心理。',
        '引用至少一处文本行为作为依据。',
        '说明行为与心理之间的关系。',
      ],
      questionType: 'reading_open_response',
      targetAbilityId: '推理',
      referenceAnswer:
        '父亲想起过去与孩子共同读书的时光，内心怀念、不舍。“站了很久”“小心地夹回原处”是推断依据。',
      assessmentBasis: [
        '能提取“站了很久”“小心地夹回原处”等行为线索。',
        '能从行为线索推断父亲的怀念或不舍。',
        '能说明文本依据与心理结论之间的关系。',
      ],
      source: {
        type: 'manual',
        description: 'Phase 12 基础全链路集成资源 1，人工整理的初中语文阅读开放题。',
        title: '单学生连续学习集成题组',
        grade: '七年级',
        pageOrQuestionNo: 'Integration-Q1',
      },
    },
  },
  {
    resourceId: 'phase12-real-inference-v1-002',
    taskRole: 'observation',
    input: {
      title: '母亲留下的旧杯子',
      externalResourceId: 'phase12-reading-inference-002',
      readingText:
        '搬家前，母亲把一只缺角的旧杯子洗了又洗。家人劝她换掉，' +
        '她却说：“这个还能用。”说完，她把杯子单独包好放进行李箱。',
      questionText: '从母亲处理旧杯子的行为中，可以推断出她怎样的心理？请结合文本说明。',
      answerRequirements: [
        '写出母亲的心理。',
        '引用至少一处动作或语言作为依据。',
        '说明依据怎样支持你的推断。',
      ],
      questionType: 'reading_open_response',
      targetAbilityId: '推理',
      referenceAnswer:
        '母亲珍惜旧杯子承载的生活记忆，对过去有留恋。“洗了又洗”“单独包好”说明她舍不得丢弃这段记忆。',
      assessmentBasis: [
        '能提取“洗了又洗”“单独包好”等行为线索。',
        '能从行为线索推断母亲的珍惜或留恋。',
        '能清楚连接行为依据与心理结论。',
      ],
      source: {
        type: 'manual',
        description: 'Phase 12 基础全链路集成资源 2，人工整理的初中语文阅读开放题。',
        title: '单学生连续学习集成题组',
        grade: '七年级',
        pageOrQuestionNo: 'Integration-Q2',
      },
    },
  },
  {
    resourceId: 'phase12-real-inference-v1-003',
    taskRole: 'observation',
    input: {
      title: '熄灯后的球场',
      externalResourceId: 'phase12-reading-inference-003',
      readingText:
        '比赛结束后，小林没有立刻离开。他把队友落在场边的号码牌一一收好，' +
        '又回头看了几次已经熄灯的球场。',
      questionText: '小林离开前的表现反映了怎样的心理？请写出推断过程。',
      answerRequirements: [
        '写出小林的心理。',
        '引用文本行为作为依据。',
        '写清从行为到心理的推断过程。',
      ],
      questionType: 'reading_open_response',
      targetAbilityId: '推理',
      referenceAnswer:
        '小林珍惜与队友共同比赛的经历，对比赛结束有留恋。“收好号码牌”“回头看球场”支持这一推断。',
      assessmentBasis: [
        '能提取“收好号码牌”“回头看球场”等行为线索。',
        '能从行为线索推断小林的珍惜或留恋。',
        '能完整表达推断过程。',
      ],
      source: {
        type: 'manual',
        description: 'Phase 12 连续学习 Demo 的第三道正式资源。',
        title: '单学生连续学习集成题组',
        grade: '七年级',
        pageOrQuestionNo: 'Integration-Q3',
      },
    },
  },
];

const ROLE_VARIANTS: RecommendedTaskRole[] = ['training', 'retest', 'transfer', 'diagnosis'];

export const PHASE12_INTEGRATION_RESOURCES: Phase12IntegrationResourceDefinition[] = [
  ...PHASE12_OBSERVATION_RESOURCES,
  ...PHASE12_OBSERVATION_RESOURCES.flatMap((definition) => (
    ROLE_VARIANTS.map((taskRole) => ({
      resourceId: `${definition.resourceId}-${taskRole}-v2`,
      taskRole,
      input: {
        ...definition.input,
        source: {
          ...definition.input.source,
          description: `${definition.input.source.description || 'Phase 12 正式资源'}（${taskRole} 角色）。`,
          pageOrQuestionNo: `${definition.input.source.pageOrQuestionNo || definition.resourceId}-${taskRole}`,
        },
      },
    }))
  )),
];
