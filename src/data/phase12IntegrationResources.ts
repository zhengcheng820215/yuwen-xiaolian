import type { TaskResourceInput } from '../ai/schemas/taskResource.schema.ts';
import type { RecommendedTaskRole } from '../ai/schemas/nextLearningStrategy.schema.ts';

export type Phase12IntegrationResourceDefinition = {
  resourceId: string;
  taskRole: RecommendedTaskRole;
  input: TaskResourceInput;
};

const PHASE12_OBSERVATION_RESOURCES: Phase12IntegrationResourceDefinition[] = [
  {
    resourceId: 'phase12-real-inference-v3-001',
    taskRole: 'observation',
    input: {
      title: '旧书里的树叶',
      externalResourceId: 'phase12-reading-inference-v3-001',
      readingText:
        '周末午后，父亲整理准备搬走的书柜，一本多年没有翻过的旧书从高处滑了下来。' +
        '书里夹着一片已经褪色的树叶，旁边还留着孩子小时候写下的日期和“第一次春游”几个歪歪扭扭的字。' +
        '父亲原本收拾得很快，看到这里却停了下来。他用指腹轻轻抚过叶脉，捏着树叶站了很久。' +
        '孩子在门外催他时，他只笑了笑，说：“这本先别收。”随后掸去书页上的灰尘，把树叶小心地夹回原处，又把书放回书柜最上层。',
      questionText:
        '父亲“捏着树叶站了很久”，又把它“小心地夹回原处”。' +
        '这些动作表现了他怎样的心理？请结合文中内容说明理由。',
      answerRequirements: [
        '写出父亲此时的心理。',
        '引用至少一处文本行为作为依据。',
        '说明行为与心理之间的关系。',
      ],
      questionType: 'reading_open_response',
      targetAbilityId: '推理',
      referenceAnswer:
        '孩子小时候留下的日期和春游字样勾起了父亲对往事的回忆，他感到怀念、不舍，也很珍惜这段记忆。' +
        '他停下收拾、轻抚叶脉、站了很久，并把树叶小心夹回原处、将书放回上层，这些动作共同支持这一判断。',
      assessmentBasis: [
        '能提取“孩子小时候写下的日期”“第一次春游”“轻抚叶脉”“站了很久”“小心地夹回原处”等线索。',
        '能结合往事线索与父亲动作的变化，推断他的怀念、不舍或珍惜。',
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
    resourceId: 'phase12-real-inference-v2-002',
    taskRole: 'observation',
    input: {
      title: '母亲留下的旧杯子',
      externalResourceId: 'phase12-reading-inference-v2-002',
      readingText:
        '搬家前，家人把厨房里不用的旧物集中到纸箱旁。母亲从柜子深处拿出一只缺角的旧杯子，' +
        '杯底还留着一行已经模糊的小字，那是外婆多年前写给她的祝福。母亲先用水把杯子洗了又洗，又拿软布慢慢擦干。' +
        '家人劝她换掉，说新家已经买了整套餐具。她沉默了一会儿，只说：“这个还能用。”' +
        '随后，她找来一块干净毛巾，把杯子单独包好，放进随身携带的行李箱里。',
      questionText: '从母亲处理旧杯子的行为中，可以推断出她怎样的心理？请结合文本说明。',
      answerRequirements: [
        '写出母亲的心理。',
        '引用至少一处动作或语言作为依据。',
        '说明依据怎样支持你的推断。',
      ],
      questionType: 'reading_open_response',
      targetAbilityId: '推理',
      referenceAnswer:
        '母亲珍惜旧杯子承载的亲情记忆，对外婆和过去的生活有所留恋。' +
        '她“洗了又洗”、沉默后仍决定留下，并把杯子“单独包好”随身携带，说明她舍不得丢弃这段记忆。',
      assessmentBasis: [
        '能提取“外婆写下的祝福”“洗了又洗”“沉默了一会儿”“单独包好”等线索。',
        '能结合亲情背景与行为线索推断母亲的珍惜或留恋。',
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
    resourceId: 'phase12-real-inference-v2-003',
    taskRole: 'observation',
    input: {
      title: '熄灯后的球场',
      externalResourceId: 'phase12-reading-inference-v2-003',
      readingText:
        '初中最后一场班级篮球赛结束时，记分牌上的数字已经不再变化。小林和队友们在这块球场训练了整整三年，' +
        '虽然这次没能赢下比赛，大家还是围在一起互相拍了拍肩。队友陆续离开后，小林没有马上走。' +
        '他把散落在场边的号码牌一一捡起，按照大家平时使用的顺序放回袋中，又弯腰捡走了长椅旁的空水瓶。' +
        '工作人员关灯后，他背起球包走到门口，却又停下脚步，回头看了几次已经暗下来的球场。',
      questionText: '小林离开前的表现反映了怎样的心理？请写出推断过程。',
      answerRequirements: [
        '写出小林的心理。',
        '引用文本行为作为依据。',
        '写清从行为到心理的推断过程。',
      ],
      questionType: 'reading_open_response',
      targetAbilityId: '推理',
      referenceAnswer:
        '小林珍惜与队友共同训练和比赛的经历，对初中最后一场比赛结束感到不舍、留恋。' +
        '他留下来收好号码牌、整理场边物品，并在离开时多次回头看球场，这些行为支持这一推断。',
      assessmentBasis: [
        '能提取“初中最后一场”“训练了三年”“收好号码牌”“停下脚步回头看球场”等线索。',
        '能结合比赛背景与离开前的行为推断小林的珍惜、不舍或留恋。',
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
