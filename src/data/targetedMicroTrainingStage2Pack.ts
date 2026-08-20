import type { ObservationDimension } from '../ai/schemas/materialObservation.schema.ts';
import type { PrimaryAbilityId } from '../ai/schemas/questionResourceAdmission.schema.ts';
import type { TargetedGapReasonCode } from '../ai/schemas/targetedMicroTraining.schema.ts';
import {
  SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
  type SingleChoiceInteraction,
} from '../ai/schemas/singleChoiceInteraction.schema.ts';

export type TargetedMicroTrainingStage2PackItem = {
  key: string;
  title: string;
  content: string;
  primaryGapReasonCode: TargetedGapReasonCode;
  abilityId: PrimaryAbilityId;
  dimension: ObservationDimension;
  questionStem: string;
  expectedStudentAction: string;
  choiceInteraction?: SingleChoiceInteraction;
  secondaryTask?: {
    abilityId: PrimaryAbilityId;
    dimension: ObservationDimension;
    questionStem: string;
    expectedStudentAction: string;
    choiceInteraction?: SingleChoiceInteraction;
  };
};

/**
 * Controlled-original seed pack for Stage 2 engineering and isolated acceptance.
 * It is not inserted into the user's active formal store by importing this module.
 */
export const TARGETED_MICRO_TRAINING_STAGE2_PACK:
readonly TargetedMicroTrainingStage2PackItem[] = [
  {
    key: 'evidence-1', title: '雨后操场的脚印', primaryGapReasonCode: 'missing_text_evidence',
    abilityId: 'extraction', dimension: 'fact',
    content: '雨停后，操场边留下两排湿脚印，一排通向器材室，另一排停在排水沟旁。值日生小林先把倒下的警示牌扶起，又取来扫帚清理积水。上课铃响时，排水沟已经畅通，器材室的门仍然关着。',
    questionStem: '哪些直接信息能证明小林清理了操场积水？请找出两处依据。',
    expectedStudentAction: '限定小林的行动，从片段中提取两处直接证据。',
    secondaryTask: {
      abilityId: 'comprehension', dimension: 'fact',
      questionStem: '“器材室的门仍然关着”能否证明小林进入过器材室？请选择最准确的判断。',
      expectedStudentAction: '辨认证据能够支持的范围，排除与材料事实相反的解释。',
      choiceInteraction: {
        schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
        selectionMode: 'single',
        optionSetVersion: 1,
        options: [
          { optionId: 'evidence-1-secondary-surface', content: '能，因为清理操场通常需要去器材室取工具' },
          { optionId: 'evidence-1-secondary-correct', content: '不能，门仍关着只说明器材室没有被打开' },
          { optionId: 'evidence-1-secondary-entity', content: '能，因为值日生小林一定拥有器材室钥匙' },
          { optionId: 'evidence-1-secondary-over', content: '不能，因为小林没有参与清理操场积水' },
        ],
        correctOptionIds: ['evidence-1-secondary-correct'],
        distractorRationales: [
          {
            optionId: 'evidence-1-secondary-surface',
            misconceptionCode: 'surface_reading',
            diagnosisMeaning: '用生活经验替代片段中“门仍然关着”的直接证据。',
            evidenceBoundary: '只能依据片段已经明确呈现的门和行动状态判断。',
          },
          {
            optionId: 'evidence-1-secondary-entity',
            misconceptionCode: 'entity_confusion',
            diagnosisMeaning: '把值日生身份误当成已经进入器材室的事实。',
            evidenceBoundary: '身份不能自动推出片段未写明的行动。',
          },
          {
            optionId: 'evidence-1-secondary-over',
            misconceptionCode: 'evidence_omission',
            diagnosisMeaning: '忽略了扶警示牌、取扫帚和排水沟畅通等已呈现行动。',
            evidenceBoundary: '否定进入器材室不等于否定清理积水。',
          },
        ],
      },
    },
  },
  {
    key: 'evidence-2', title: '迟到的公交车', primaryGapReasonCode: 'missing_text_evidence',
    abilityId: 'comprehension', dimension: 'causality',
    content: '站牌下的人越聚越多。电子屏先显示“还有两分钟”，随后连续三次跳回“还有五分钟”。远处路口亮起红灯，一辆公交车停在长长的车队末尾。小周看了看表，没有离开站台，只把书包带重新系紧。',
    questionStem: '从哪些信息可以判断公交车暂时无法按时到站？',
    expectedStudentAction: '区分直接交通线索与人物动作，提取能支持判断的材料依据。',
    secondaryTask: {
      abilityId: 'extraction', dimension: 'fact',
      questionStem: '电子屏和远处路口分别提供了什么与等车时间有关的信息？',
      expectedStudentAction: '从两个不同位置提取直接信息，不把人物动作当成交通证据。',
    },
  },
  {
    key: 'evidence-3', title: '窗边的绿芽', primaryGapReasonCode: 'missing_text_evidence',
    abilityId: 'analysis', dimension: 'language',
    content: '花盆里的种子几天没有动静。清晨，小芽终于顶开薄土，茎还弯着，叶尖却朝向窗外的光。午后风大，窗帘一次次扫过花盆，小芽伏下去又慢慢直起。奶奶把花盆向里挪了半尺。',
    questionStem: '哪些描写共同表现了小芽生命力顽强？',
    expectedStudentAction: '找到相互呼应的动作描写，并说明它们共同支持的特点。',
    secondaryTask: {
      abilityId: 'extraction', dimension: 'language',
      questionStem: '风吹过后，小芽的状态发生了怎样的变化？请按先后找出依据。',
      expectedStudentAction: '按先后提取小芽“伏下”和“直起”的动作证据。',
    },
  },
  {
    key: 'relation-1', title: '没有说完的话', primaryGapReasonCode: 'missing_reasoning_relation',
    abilityId: 'comprehension', dimension: 'character',
    content: '我把比赛报名表推到父亲面前，他没有立刻签字，只问：“准备了多久？”我低下头。过了一会儿，他把表推回来，旁边多了一张写满时间安排的纸，说：“先照这个练一周，再来找我。”',
    questionStem: '父亲没有立即签字，为什么仍可看出他支持“我”参赛？',
    expectedStudentAction: '连接父亲的追问、时间安排与支持判断，写清证据和结论之间的关系。',
    secondaryTask: {
      abilityId: 'analysis', dimension: 'character',
      questionStem: '父亲写下时间安排这一行动，与“先练一周”的要求有什么联系？',
      expectedStudentAction: '解释行动如何落实要求，写清做法与目的之间的关系。',
    },
  },
  {
    key: 'relation-2', title: '被擦掉的名字', primaryGapReasonCode: 'missing_reasoning_relation',
    abilityId: 'analysis', dimension: 'plot',
    content: '黑板报评比前，负责绘画的小雨发现自己的名字被擦掉了。她站了一会儿，没有争辩，转身把右下角褪色的花纹重新描亮。放学后，班长拿着名单来道歉，她只问：“明天还要不要补背景？”',
    questionStem: '小雨后续的两个行动为什么能表现她更看重集体成果？',
    expectedStudentAction: '分别解释行动的指向，再把行动与人物品质判断连接起来。',
    secondaryTask: {
      abilityId: 'comprehension', dimension: 'character',
      questionStem: '小雨没有争辩却继续补画，这两个表现放在一起说明了什么？',
      expectedStudentAction: '连接前后行为，说明沉默与继续完成任务共同表达的态度。',
    },
  },
  {
    key: 'relation-3', title: '灯亮了', primaryGapReasonCode: 'missing_reasoning_relation',
    abilityId: 'inference', dimension: 'causality',
    content: '楼道的灯坏了三天。晚上回家时，爷爷总把手机手电筒打开，让我走在前面。第四天傍晚，灯忽然亮了。爷爷袖口沾着灰，工具袋放在门后，却只说物业今天来得很快。',
    questionStem: '为什么可以推断楼道灯很可能是爷爷修好的？',
    expectedStudentAction: '把人物状态、工具位置与说法之间的关系组织成有根据的推断。',
    secondaryTask: {
      abilityId: 'analysis', dimension: 'language',
      questionStem: '爷爷说“物业今天来得很快”，这句话与袖口和工具袋的细节形成了怎样的关系？',
      expectedStudentAction: '比较人物说法与现场细节，解释二者如何共同形成暗示。',
    },
  },
  {
    key: 'conclusion-1', title: '空着的座位', primaryGapReasonCode: 'conclusion_inconsistent',
    abilityId: 'comprehension', dimension: 'character',
    content: '合唱排练时，小安旁边的座位一直空着。老师问谁愿意留下来陪缺席的同学补练，小安先看了看门口，随后举起手。第二天，她提前十分钟到教室，把两份歌词并排放在桌上。',
    questionStem: '“小安不愿意帮助同学”这一判断是否符合片段？请依据材料判断。',
    expectedStudentAction: '对照结论与人物行动，识别和修正不符合材料的判断。',
  },
  {
    key: 'conclusion-2', title: '慢下来的队伍', primaryGapReasonCode: 'conclusion_inconsistent',
    abilityId: 'inference', dimension: 'plot',
    content: '登山队快到坡顶时，走在最后的小程鞋带断了。前面的人没有停下喊话，却把速度一点点放慢。领队绕到队尾，用备用绳帮他系好鞋。大家到达坡顶的时间比计划晚了十分钟。',
    questionStem: '能否据“队伍晚到”判断大家缺乏时间观念？为什么？',
    expectedStudentAction: '检验结论是否忽略关键情境，用完整因果链修正过度判断。',
  },
  {
    key: 'conclusion-3', title: '两次关窗', primaryGapReasonCode: 'conclusion_inconsistent',
    abilityId: 'analysis', dimension: 'structure',
    content: '午休前，班主任看见风大，顺手关上靠走廊的窗。放学时教室已经没人，他又返回来检查了一遍，把另一扇没有扣紧的窗重新关好，还把窗台上的作业本移到柜子里。',
    questionStem: '对“两次关窗”作用的理解，最准确的一项是？',
    expectedStudentAction: '比较两次动作的情境和附带行为，判断结论是否遗漏结构作用。',
    choiceInteraction: {
      schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
      selectionMode: 'single',
      optionSetVersion: 1,
      options: [
        { optionId: 'conclusion-3-primary-surface', content: '两次动作完全重复，只是交代班主任关了两扇窗' },
        { optionId: 'conclusion-3-primary-entity', content: '两次动作不同，因为午休前关窗的人不是班主任' },
        { optionId: 'conclusion-3-primary-correct', content: '第二次还写检查和转移作业本，进一步表现班主任细心负责' },
        { optionId: 'conclusion-3-primary-over', content: '第二次返回说明班主任故意延长了自己的下班时间' },
      ],
      correctOptionIds: ['conclusion-3-primary-correct'],
      distractorRationales: [
        {
          optionId: 'conclusion-3-primary-surface',
          misconceptionCode: 'surface_reading',
          diagnosisMeaning: '只看到关窗动作相似，忽略第二次检查与保护作业本的新增信息。',
          evidenceBoundary: '需要比较两次行动的情境和附带行为。',
        },
        {
          optionId: 'conclusion-3-primary-entity',
          misconceptionCode: 'entity_confusion',
          diagnosisMeaning: '混淆两次行动的执行者。',
          evidenceBoundary: '片段两处行动的主语都是班主任。',
        },
        {
          optionId: 'conclusion-3-primary-over',
          misconceptionCode: 'over_inference',
          diagnosisMeaning: '从返回教室过度推断人物故意延长下班时间。',
          evidenceBoundary: '材料只支持细心检查和保护物品，不能推出主观拖延。',
        },
      ],
    },
  },
  {
    key: 'requirement-1', title: '图书角值日', primaryGapReasonCode: 'incomplete_task_requirement',
    abilityId: 'extraction', dimension: 'fact',
    content: '图书角值日要求先按编号归还图书，再擦净书架，最后登记破损情况。小文把散放的书排好，发现一本封面脱落，便在登记表上写下书名和编号。离开前，她又把借阅卡放回盒子。',
    questionStem: '按要求概括小文完成的两项规定动作，并分别写出对应依据。',
    expectedStudentAction: '同时完成“概括动作”和“提供依据”两个明确要求。',
  },
  {
    key: 'requirement-2', title: '小桥修复记录', primaryGapReasonCode: 'incomplete_task_requirement',
    abilityId: 'summarization', dimension: 'plot',
    content: '木桥被雨水冲坏后，村民先在两端立起警示牌，又用粗绳固定松动的桥板。第二天，木匠换掉腐朽木板，孩子们把散落的碎木搬走。傍晚，桥面恢复通行，警示牌仍保留了一夜。',
    questionStem: '概括修桥过程，并说明这些安排体现了怎样的处理顺序。',
    expectedStudentAction: '先概括关键步骤，再说明先保障安全、后完成修复的顺序特点。',
  },
  {
    key: 'requirement-3', title: '风筝落下以后', primaryGapReasonCode: 'incomplete_task_requirement',
    abilityId: 'analysis', dimension: 'causality',
    content: '风筝挂上树梢后，弟弟急着拉线，线却越缠越紧。姐姐让他先放松线轴，再从侧面绕到树后。风向一变，风筝向低处滑落，两人合力接住。弟弟笑着说，原来用力不一定能解决问题。',
    questionStem: '分析风筝脱困的原因，并说明结尾感悟与前文行动的联系。',
    expectedStudentAction: '同时解释脱困原因和结尾感悟，完整回应题目的两个部分。',
  },
] as const;
