import type { AssessmentMode, OpenResponseAnswerStatus } from '../ai/schemas/diagnosis.schema.ts';
import type {
  PrimaryAbilityId,
  QuestionResourceRubricItem,
  QuestionResponseFormat,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import type {
  MaterialProductionTaskInput,
} from '../ai/agents/materialObservationApplicationService.ts';

export const PHASE17_BATCH_A_VERSION = 'phase17-batch-a-v1';
export const PHASE17_BATCH_A_CREATED_AT = '2026-07-23T08:00:00.000Z';

export type BatchAAnswerFixture = {
  fixtureId: string;
  resourceKey: string;
  category:
    | 'fully_meets'
    | 'partially_meets'
    | 'typical_error'
    | 'reasonable_alternative'
    | 'concise_valid'
    | 'irrelevant';
  studentAnswer: string;
  expectedAnswerStatus: OpenResponseAnswerStatus;
  reviewFocus: string;
};

export type BatchAResourceDefinition = MaterialProductionTaskInput & {
  resourceKey: string;
  title: string;
  responseFormat: QuestionResponseFormat;
  assessmentMode: AssessmentMode;
  answerAcceptance: {
    acceptedAnswers?: string[];
    acceptedKeywords?: string[];
    semanticEquivalentAllowed: boolean;
    normalizationRules: Array<'trim' | 'ignore_punctuation' | 'ignore_whitespace'>;
  };
  rubric: QuestionResourceRubricItem[];
  minimumAnswerRequirement: {
    minLength: number;
    requireTextEvidence: boolean;
    requireExplanation: boolean;
  };
  planningChainKey?: 'batch-a-inference-retest' | 'batch-a-analysis-transfer';
  strategyRequestReason: string;
  possibleNextDirection: string;
};

export type BatchAMaterialDefinition = {
  materialId: string;
  materialVersionId: string;
  title: string;
  content: string;
  sourceDescription: string;
  copyrightNote: string;
  tasks: BatchAResourceDefinition[];
};

const sharedSource = {
  sourceDescription: 'Phase 17 Batch A 项目原创教学材料，经受控内容校对后用于首批正式资源验证。',
  copyrightNote: '项目原创教学内容，仅用于本产品内部教学与验收；正式对外使用前需完成内容负责人复核。',
};

export const PHASE17_BATCH_A_MATERIALS: BatchAMaterialDefinition[] = [
  {
    materialId: 'phase17-batch-a-material-station',
    materialVersionId: 'phase17-batch-a-material-station:v1',
    title: '站台上的蓝布包',
    content: [
      '周六清晨，我要独自坐火车去市里参加作文比赛。父亲把我的蓝布包背在肩上，陪我走进还带着雨气的车站。候车厅里人不多，他没有问我紧不紧张，只低头又看了一遍车票上的车次和站台。',
      '坐下后，父亲把玻璃水杯用毛巾裹好，塞进布包侧袋，又把已经松开的肩带重新扣紧。他试着提了提布包，确认不会滑落，才把包放回我脚边。',
      '广播提醒列车即将进站时，父亲蹲下来替我系好散开的鞋带。站起身后，他往后退了两步，嘴里说着“进去吧”，眼睛却仍盯着电子屏上的检票信息。',
      '我笑着说：“我又不是第一次去市里，你别担心。”父亲也笑了，把伞塞进我手里，说自己回去只有几步路。直到这时我才发现，他右边的袖口已经被雨打湿了一片。',
      '列车缓缓开动，父亲还站在黄色安全线外。他没有追着车走，只抬起手朝我挥了挥。隔着车窗，我看见他下意识地摸了摸刚才放车票的衣袋，然后像想起什么似的，又朝我点了点头。',
      '我打开蓝布包，发现水杯旁压着一张小纸条：“到了发个消息。题目慢慢读，按你自己的想法写。”那一刻我明白，父亲一路上反复检查的并不只是车票和行李。',
    ].join('\n'),
    ...sharedSource,
    tasks: [
      {
        resourceKey: 'station-extraction-training',
        primaryDimension: 'fact',
        abilityId: 'extraction',
        taskRole: 'training',
        difficulty: 'basic',
        startParagraph: 2,
        endParagraph: 3,
        questionStem: '根据第2、3段，写出父亲在列车进站前为“我”做的两件具体事情。',
        expectedStudentAction: '从指定段落中准确提取父亲的两个具体动作，不把心理判断当作动作。',
        designReason: '用明确段落范围观察学生能否定位并提取人物行为，为后续人物分析提供事实基础。',
        materialRelationIntent: 'same_context',
        title: '父亲做了哪些准备',
        responseFormat: 'short_text',
        assessmentMode: 'key_points',
        answerAcceptance: {
          acceptedKeywords: ['裹好水杯', '扣紧肩带', '系好鞋带'],
          semanticEquivalentAllowed: true,
          normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
        },
        rubric: [
          rubric('action-one', '提取第一个动作', 'extraction', '准确写出父亲整理水杯、肩带或鞋带中的一个具体动作。', ['用毛巾裹好水杯', '重新扣紧肩带', '替我系好鞋带']),
          rubric('action-two', '提取第二个动作', 'extraction', '再写出另一个不同的具体动作。', ['用毛巾裹好水杯', '重新扣紧肩带', '替我系好鞋带']),
        ],
        minimumAnswerRequirement: { minLength: 10, requireTextEvidence: true, requireExplanation: false },
        strategyRequestReason: '学生需要先稳定定位人物动作，再进入人物心理和形象分析。',
        possibleNextDirection: '动作提取稳定后，可进入动作含义理解或人物心理推理。',
      },
      {
        resourceKey: 'station-comprehension-training',
        primaryDimension: 'language',
        abilityId: 'comprehension',
        taskRole: 'training',
        difficulty: 'intermediate',
        startParagraph: 6,
        questionStem: '结合全文，说说父亲纸条中“按你自己的想法写”这句话除了提醒比赛，还表达了什么。',
        expectedStudentAction: '结合父亲一路上的行为，理解这句话包含的信任、支持和尊重。',
        designReason: '观察学生能否把关键语句放回全文情境理解，而不是只解释字面意思。',
        materialRelationIntent: 'same_context',
        title: '理解纸条里的话',
        responseFormat: 'long_text',
        assessmentMode: 'reasoning_chain',
        answerAcceptance: {
          acceptedKeywords: ['信任', '支持', '尊重', '鼓励'],
          semanticEquivalentAllowed: true,
          normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
        },
        rubric: [
          rubric('meaning', '理解语句含义', 'comprehension', '指出父亲对孩子的信任、支持、尊重或鼓励。', ['相信孩子能独立完成', '支持孩子表达自己的想法', '尊重孩子']),
          rubric('context', '联系全文情境', 'comprehension', '联系父亲准备行李、等待检票或留下纸条等行为解释。', ['反复检查行李和车票', '一直关注检票信息', '留下纸条']),
        ],
        minimumAnswerRequirement: { minLength: 20, requireTextEvidence: true, requireExplanation: true },
        strategyRequestReason: '学生已能找到关键语句，需要训练结合上下文理解言外之意。',
        possibleNextDirection: '语句理解稳定后，可进入人物形象分析或主题理解。',
      },
      {
        resourceKey: 'station-analysis-training',
        primaryDimension: 'character',
        abilityId: 'analysis',
        taskRole: 'training',
        difficulty: 'intermediate',
        startParagraph: 2,
        endParagraph: 6,
        questionStem: '结合父亲在车站中的具体表现，分析他是一个怎样的父亲。',
        expectedStudentAction: '用至少一个具体动作支持人物特点，并说明动作与特点之间的关系。',
        designReason: '作为 Training -> Transfer 的起点，训练“事实依据—人物特点—关系说明”的分析链。',
        materialRelationIntent: 'same_context',
        title: '分析父亲的形象',
        responseFormat: 'long_text',
        assessmentMode: 'reasoning_chain',
        answerAcceptance: {
          acceptedKeywords: ['细心', '关爱', '克制', '尊重', '信任'],
          semanticEquivalentAllowed: true,
          normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
        },
        rubric: [
          rubric('character-trait', '概括人物特点', 'analysis', '形成与全文表现相容的人物特点。', ['细心', '关爱孩子', '克制而体贴', '尊重并信任孩子']),
          rubric('character-evidence', '使用具体依据', 'analysis', '引用或概括父亲整理物品、关注检票、淋湿袖口、留下纸条等具体表现。', ['整理水杯和肩带', '关注检票信息', '袖口被雨淋湿', '留下纸条']),
          rubric('character-relation', '说明依据关系', 'analysis', '解释具体表现为什么能体现所概括的人物特点。', ['动作体现细心', '克制的表达体现尊重', '持续关注体现关爱']),
        ],
        minimumAnswerRequirement: { minLength: 30, requireTextEvidence: true, requireExplanation: true },
        planningChainKey: 'batch-a-analysis-transfer',
        strategyRequestReason: '学生需要在熟悉材料中建立人物分析的完整证据链。',
        possibleNextDirection: '分析链成立后，换用独立材料验证能否迁移。',
      },
      {
        resourceKey: 'station-inference-training',
        primaryDimension: 'character',
        abilityId: 'inference',
        taskRole: 'training',
        difficulty: 'intermediate',
        startParagraph: 3,
        endParagraph: 5,
        questionStem: '父亲嘴里说着“进去吧”，却仍盯着检票信息。结合后文动作，推断他当时的心理，并说明理由。',
        expectedStudentAction: '根据父亲前后动作推断担心、不舍又不愿增加孩子压力的心理，并解释线索关系。',
        designReason: '作为 Training -> Retest 的起点，观察学生能否由显性动作推导隐性心理。',
        materialRelationIntent: 'same_context',
        title: '从动作推断父亲心理',
        responseFormat: 'long_text',
        assessmentMode: 'reasoning_chain',
        answerAcceptance: {
          acceptedKeywords: ['担心', '不舍', '放心不下', '克制'],
          semanticEquivalentAllowed: true,
          normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
        },
        rubric: [
          rubric('psychology', '形成心理判断', 'inference', '推断出担心、不舍、放心不下或克制关心等相容心理。', ['担心孩子', '舍不得孩子离开', '放心不下但不想增加压力']),
          rubric('action-evidence', '找到动作线索', 'inference', '使用盯着检票信息、站在线外挥手、摸衣袋等动作。', ['盯着检票信息', '站在线外挥手', '摸放车票的衣袋']),
          rubric('inference-link', '解释推断关系', 'inference', '说明这些动作怎样支持心理判断。', ['持续关注说明放心不下', '没有追车表现出克制']),
        ],
        minimumAnswerRequirement: { minLength: 30, requireTextEvidence: true, requireExplanation: true },
        planningChainKey: 'batch-a-inference-retest',
        strategyRequestReason: '学生需要在有明确动作线索的材料中训练人物心理推理。',
        possibleNextDirection: '完成后用新材料、相近难度和更少表面提示进行 Retest。',
      },
    ],
  },
  {
    materialId: 'phase17-batch-a-material-riverbank',
    materialVersionId: 'phase17-batch-a-material-riverbank:v1',
    title: '河堤边的三盏灯',
    content: [
      '暑假里，学校组织我们到河堤边参加志愿活动。前一夜的大风吹歪了几块指路牌，三盏太阳能路灯也蒙满泥点。带队的赵师傅是一位退休电工，他把卷尺、砂纸和螺丝分开放好，才带我们沿河检查。',
      '我原以为修路牌只是把木板重新钉牢。赵师傅却先量了每块牌子的高度，又把翘起的边角一点点磨平。他还叫住一位常来散步的老人，问夜里从桥下走来时，能不能看清箭头。',
      '一阵小雨落下来，大家都往廊檐下跑。赵师傅先用雨布盖住工具，又把刚拆下的路牌搬到干燥处。他摊开旧地图，对着牌子背面居民手写的路线，一处一处核对。',
      '同组的小陈有些不耐烦，说旧牌上的字还能认出来，没有必要全部重画。赵师傅指着已经褪色的箭头说：“我们白天站得近，当然看得清。晚上拐过弯的人，可只有几秒钟找方向。”',
      '小陈没再争辩。他拆下自己刚钉好的牌子，把箭头重新描粗，又在边缘贴上反光条。装好以后，他没有马上收工具，而是走到河道转弯处，请一位路人从远处试着辨认方向。',
      '天暗下来，三盏擦净的路灯先后亮起，新画的箭头在灯下很清楚。小陈在活动记录上写道：“修好，不只是把牌子挂回去，还要让经过这里的人看得见、信得过。”',
    ].join('\n'),
    ...sharedSource,
    tasks: [
      {
        resourceKey: 'riverbank-inference-retest',
        primaryDimension: 'character',
        abilityId: 'inference',
        taskRole: 'retest',
        difficulty: 'intermediate',
        startParagraph: 2,
        endParagraph: 4,
        questionStem: '赵师傅反复测量、询问路人，还核对旧地图。根据这些动作，推断他修路牌时的想法，并说明理由。',
        expectedStudentAction: '在新材料中根据连续动作推断认真负责、从使用者角度考虑的想法，并建立动作与心理的关系。',
        designReason: '作为人物心理推理的 Retest，保持核心能力和难度，使用新材料且不复用原题。',
        materialRelationIntent: 'similar_context',
        title: '复测人物心理推理',
        responseFormat: 'long_text',
        assessmentMode: 'reasoning_chain',
        answerAcceptance: {
          acceptedKeywords: ['认真', '负责', '安全', '方便路人', '实际使用'],
          semanticEquivalentAllowed: true,
          normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
        },
        rubric: [
          rubric('retest-psychology', '形成相容推断', 'inference', '推断赵师傅认真负责、重视实际使用或为行人着想。', ['认真负责', '考虑路人实际需要', '重视夜间安全']),
          rubric('retest-evidence', '使用动作依据', 'inference', '使用测量、询问路人、核对地图等动作。', ['反复测量', '询问散步老人', '核对旧地图和手写路线']),
          rubric('retest-link', '解释推断关系', 'inference', '说明动作为什么能支持该心理或态度判断。', ['反复核对说明不只求完成', '询问使用者说明重视实际效果']),
        ],
        minimumAnswerRequirement: { minLength: 30, requireTextEvidence: true, requireExplanation: true },
        planningChainKey: 'batch-a-inference-retest',
        strategyRequestReason: '上一轮人物心理推理需要在新材料中复测，并限制原题记忆影响。',
        possibleNextDirection: '根据新 Evidence 决定继续巩固、延迟复测或进入其他推理维度。',
      },
      {
        resourceKey: 'riverbank-analysis-transfer',
        primaryDimension: 'character',
        abilityId: 'analysis',
        taskRole: 'transfer',
        difficulty: 'intermediate',
        startParagraph: 4,
        endParagraph: 6,
        questionStem: '结合小陈前后的言行，分析他在这次志愿活动中发生了怎样的变化。',
        expectedStudentAction: '比较人物前后表现，概括变化，并用两个阶段的事实解释变化依据。',
        designReason: '作为人物分析的 Transfer，使用独立材料和变化型人物线索，验证分析方法能否迁移。',
        materialRelationIntent: 'new_context',
        title: '迁移分析人物变化',
        responseFormat: 'long_text',
        assessmentMode: 'reasoning_chain',
        answerAcceptance: {
          acceptedKeywords: ['不耐烦', '敷衍', '认真', '负责', '为他人考虑'],
          semanticEquivalentAllowed: true,
          normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
        },
        rubric: [
          rubric('change-conclusion', '概括人物变化', 'analysis', '概括小陈从只求完成、缺少耐心转向认真负责、重视使用者。', ['从不耐烦到认真', '从只求完成到考虑实际效果', '开始为路人着想']),
          rubric('before-evidence', '使用变化前依据', 'analysis', '引用或概括小陈认为字能看清、没有必要重画。', ['认为没有必要重画', '觉得字还能认出来']),
          rubric('after-evidence', '使用变化后依据', 'analysis', '引用或概括重描箭头、贴反光条、请路人测试等行动。', ['重新描粗箭头', '贴反光条', '请路人从远处测试']),
          rubric('change-relation', '解释前后关系', 'analysis', '说明前后行动怎样体现态度或认识变化。', ['后来主动检查实际效果', '从完成任务转向帮助使用者']),
        ],
        minimumAnswerRequirement: { minLength: 35, requireTextEvidence: true, requireExplanation: true },
        planningChainKey: 'batch-a-analysis-transfer',
        strategyRequestReason: '上一轮人物分析方法已在熟悉情境建立，需要在独立材料中验证迁移。',
        possibleNextDirection: '迁移成立后可降低同类训练优先级，或进入结构和主题分析。',
      },
      {
        resourceKey: 'riverbank-extraction-training',
        primaryDimension: 'fact',
        abilityId: 'extraction',
        taskRole: 'training',
        difficulty: 'basic',
        startParagraph: 5,
        questionStem: '第5段中，小陈为了让路牌更容易被看清，具体做了哪三件事？',
        expectedStudentAction: '从单一段落中提取三个连续动作，并保持事实完整。',
        designReason: '在新材料中继续校准多动作信息提取，检查遗漏和混入推断的问题。',
        materialRelationIntent: 'same_context',
        title: '提取小陈的三个动作',
        responseFormat: 'short_text',
        assessmentMode: 'key_points',
        answerAcceptance: {
          acceptedKeywords: ['描粗箭头', '贴反光条', '请路人辨认'],
          semanticEquivalentAllowed: true,
          normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
        },
        rubric: [
          rubric('action-repaint', '提取描粗箭头', 'extraction', '写出小陈重新描粗箭头。', ['重新描粗箭头', '重画箭头']),
          rubric('action-reflective', '提取反光处理', 'extraction', '写出小陈在边缘贴反光条。', ['贴上反光条', '增加反光条']),
          rubric('action-test', '提取远处测试', 'extraction', '写出小陈请路人从远处辨认。', ['请路人从远处测试', '让路人辨认方向']),
        ],
        minimumAnswerRequirement: { minLength: 12, requireTextEvidence: true, requireExplanation: false },
        strategyRequestReason: '学生需要在连续动作较多的段落中练习完整提取。',
        possibleNextDirection: '提取稳定后可进入人物变化概括或行为原因理解。',
      },
      {
        resourceKey: 'riverbank-comprehension-training',
        primaryDimension: 'language',
        abilityId: 'comprehension',
        taskRole: 'training',
        difficulty: 'intermediate',
        startParagraph: 6,
        questionStem: '怎样理解小陈所说的“修好，不只是把牌子挂回去，还要让经过这里的人看得见、信得过”？',
        expectedStudentAction: '结合修牌过程说明“修好”既包含完成安装，也包含安全、清晰和实际可用。',
        designReason: '观察学生能否由人物总结语回看事件过程，理解字面之外的责任意识。',
        materialRelationIntent: 'same_context',
        title: '理解“修好”的含义',
        responseFormat: 'long_text',
        assessmentMode: 'reasoning_chain',
        answerAcceptance: {
          acceptedKeywords: ['完成安装', '实际可用', '看清方向', '安全', '负责'],
          semanticEquivalentAllowed: true,
          normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
        },
        rubric: [
          rubric('literal-meaning', '说明字面层次', 'comprehension', '指出“修好”不只是把路牌重新安装。', ['不只是把牌子挂回去', '不仅是完成安装']),
          rubric('context-meaning', '说明实际含义', 'comprehension', '指出还要让路人能看清、辨认并信任路牌。', ['让路人看清方向', '保证实际可用', '让人能够信任']),
          rubric('responsibility', '联系责任意识', 'comprehension', '联系赵师傅和小陈的做法，说明工作要考虑使用者和实际效果。', ['考虑使用者', '对结果负责', '重视安全和效果']),
        ],
        minimumAnswerRequirement: { minLength: 25, requireTextEvidence: true, requireExplanation: true },
        strategyRequestReason: '学生需要在具体事件中理解总结性语句的深层含义。',
        possibleNextDirection: '理解成立后可进入主题概括或观点表达。',
      },
    ],
  },
];

export const PHASE17_BATCH_A_ANSWER_FIXTURES: BatchAAnswerFixture[] = [
  fixture('station-analysis-full', 'station-analysis-training', 'fully_meets', '父亲细心、关爱孩子，也尊重孩子。他把水杯裹好、扣紧肩带，还一直关注检票信息，说明他处处替孩子考虑；但他没有追着车走，只留下纸条鼓励孩子按自己的想法写，也表现出克制和信任。', 'fully_meets', '完整覆盖特点、依据和关系。'),
  fixture('station-analysis-partial', 'station-analysis-training', 'partially_meets', '父亲是一个很关心孩子的人，他一直看着检票信息。', 'partially_meets', '特点和事实成立，但依据较少且关系说明不足。'),
  fixture('station-analysis-error', 'station-analysis-training', 'typical_error', '父亲做事很粗心，因为他把自己的袖口弄湿了。', 'does_not_meet', '核心特点与材料事实不相容。'),
  fixture('station-analysis-alternative', 'station-analysis-training', 'reasonable_alternative', '父亲的爱很有分寸。他默默整理好行李、留意检票，却只在安全线外挥手，没有用焦虑影响孩子。', 'fully_meets', '未使用预设词语，但形成了合理等价分析。'),
  fixture('station-inference-full', 'station-inference-training', 'fully_meets', '父亲既担心又舍不得孩子，但不愿让孩子更紧张。他嘴上催“进去吧”，眼睛却还盯着检票信息，列车开动后也一直站在线外挥手，这些动作说明他放心不下，只是把情绪克制住了。', 'fully_meets', '心理、动作和推断关系完整。'),
  fixture('station-inference-partial', 'station-inference-training', 'partially_meets', '父亲有些担心，因为他还在看电子屏。', 'partially_meets', '推断成立但证据与关系较单薄。'),
  fixture('station-inference-error', 'station-inference-training', 'typical_error', '父亲急着让孩子离开，所以一直催他进去。', 'does_not_meet', '只取表面话语，忽略相反动作线索。'),
  fixture('station-inference-concise', 'station-inference-training', 'concise_valid', '父亲放心不下却不想给孩子压力；嘴上让他进去，目光仍跟着检票信息。', 'fully_meets', '答案简短但包含结论、依据和关系。'),
  fixture('riverbank-inference-full', 'riverbank-inference-retest', 'fully_meets', '赵师傅想把路牌真正修得安全、好用，而不是只完成表面任务。他反复测量、询问夜间散步的人，还核对旧地图，说明他认真负责，也会从使用者的角度考虑。', 'fully_meets', '新材料中的推断链完整。'),
  fixture('riverbank-inference-partial', 'riverbank-inference-retest', 'partially_meets', '赵师傅很认真，他量了路牌的高度。', 'partially_meets', '推断合理，但只使用一处动作且解释不足。'),
  fixture('riverbank-inference-error', 'riverbank-inference-retest', 'typical_error', '赵师傅不相信学生，所以什么都要自己检查。', 'does_not_meet', '把认真负责错误解释为不信任学生。'),
  fixture('riverbank-inference-irrelevant', 'riverbank-inference-retest', 'irrelevant', '河边下过雨，路灯晚上会亮。', 'insufficient_evidence', '只复述背景，没有回答人物想法。'),
  fixture('riverbank-analysis-full', 'riverbank-analysis-transfer', 'fully_meets', '小陈从只求快点完成，变得认真负责、会考虑路人的实际需要。开始时他觉得旧字能看清，不愿重画；后来他主动描粗箭头、贴反光条，还请路人从远处测试，说明他明白了修好要看实际效果。', 'fully_meets', '变化结论与前后依据完整。'),
  fixture('riverbank-analysis-partial', 'riverbank-analysis-transfer', 'partially_meets', '小陈后来变认真了，因为他重新画了箭头。', 'partially_meets', '变化方向正确，但缺少变化前事实和完整关系。'),
  fixture('riverbank-analysis-error', 'riverbank-analysis-transfer', 'typical_error', '小陈一直都很负责，只是赵师傅不让他休息。', 'does_not_meet', '忽略人物前后变化并虚构原因。'),
  fixture('riverbank-analysis-alternative', 'riverbank-analysis-transfer', 'reasonable_alternative', '小陈开始只看“有没有装回去”，后来开始看“别人能不能用”。从反对重画到主动请路人测试，可以看出他的责任意识增强了。', 'fully_meets', '不同措辞准确概括变化机制。'),
];

export const PHASE17_BATCH_A_EXPECTED = {
  materialCount: 2,
  resourceCount: 8,
  abilities: ['extraction', 'comprehension', 'analysis', 'inference'] as PrimaryAbilityId[],
  trainingCount: 6,
  retestCount: 1,
  transferCount: 1,
  coreChainKeys: ['batch-a-inference-retest', 'batch-a-analysis-transfer'],
  fixtureCount: 16,
} as const;

function rubric(
  itemId: string,
  name: string,
  abilityId: PrimaryAbilityId,
  description: string,
  acceptedSignals: string[],
): QuestionResourceRubricItem {
  return {
    itemId,
    name,
    description,
    abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: true,
      requireExplanation: abilityId !== 'extraction',
      requireConclusion: true,
    },
    acceptedSignals,
  };
}

function fixture(
  fixtureId: string,
  resourceKey: string,
  category: BatchAAnswerFixture['category'],
  studentAnswer: string,
  expectedAnswerStatus: OpenResponseAnswerStatus,
  reviewFocus: string,
): BatchAAnswerFixture {
  return { fixtureId, resourceKey, category, studentAnswer, expectedAnswerStatus, reviewFocus };
}
