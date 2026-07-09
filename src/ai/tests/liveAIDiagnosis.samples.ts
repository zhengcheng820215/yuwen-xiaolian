import type { OpenResponseAnswerStatus } from '../schemas/diagnosis.schema.ts';

export type LiveAIDiagnosisEvaluationSample = {
  id: string;
  question: string;
  referenceAnswer: string;
  studentAnswer: string;
  expectedMainAbility: string;
  expectedRootCauseDirection: string;
  expectedRootCauseKeywords: string[];
  expectedAnswerStatus: OpenResponseAnswerStatus;
};

export const liveAIDiagnosisEvaluationSamples: LiveAIDiagnosisEvaluationSample[] = [
  {
    id: 'live_understanding_001',
    question: '阅读片段：“那盏灯不仅照亮了回家的路，也照亮了父亲对我的牵挂。”请结合上下文，说说你对“照亮了父亲对我的牵挂”的理解。',
    referenceAnswer: '“照亮”不是指灯光真正照亮，而是指作者通过那盏灯感受到父亲长期默默的关爱和牵挂，表达了作者对父爱的理解与感动。',
    studentAnswer: '这句话表现了作者感受到父亲对自己的爱，也表达了作者的感动。',
    expectedMainAbility: '理解',
    expectedRootCauseDirection: '理解情感主题，但没有解释关键词的象征意义或深层含义。',
    expectedRootCauseKeywords: ['象征', '深层含义', '字面', '语境', '照亮'],
    expectedAnswerStatus: 'partially_meets',
  },
  {
    id: 'live_understanding_002',
    question: '阅读片段：“母亲把那件洗得发白的旧外套叠好，轻轻放进我的行李箱。”请分析这句话中动作描写的含义。',
    referenceAnswer: '母亲叠外套、放行李箱的动作表现了她对孩子离家的不舍和细致关爱，也暗含了沉默的牵挂。',
    studentAnswer: '母亲把衣服放进箱子里，说明她很会整理东西。',
    expectedMainAbility: '理解',
    expectedRootCauseDirection: '停留在字面动作，没有结合语境理解人物情感。',
    expectedRootCauseKeywords: ['字面', '动作', '语境', '情感', '不舍'],
    expectedAnswerStatus: 'does_not_meet',
  },
  {
    id: 'live_summary_001',
    question: '阅读片段：父亲多年坚持骑车送“我”上学，后来“我”长大离家，他仍习惯在门口等待“我”回家。请概括选文主要内容。',
    referenceAnswer: '文章写父亲多年坚持接送“我”上学，并在“我”长大离家后仍默默等待“我”回家，表现了父亲深沉而无言的爱。',
    studentAnswer: '文章写父亲很爱我，我很感动。',
    expectedMainAbility: '概括',
    expectedRootCauseDirection: '有主题感受，但遗漏人物、事件经过或关键结果，主要内容概括不完整。',
    expectedRootCauseKeywords: ['事件', '人物', '经过', '结果', '概括'],
    expectedAnswerStatus: 'partially_meets',
  },
  {
    id: 'live_summary_002',
    question: '阅读片段：小城下雨的傍晚，外婆撑伞来到校门口，把热好的饭盒递给“我”，又转身走进雨里。请用简洁语言概括这段文字的主要内容。',
    referenceAnswer: '雨天傍晚，外婆到校门口给“我”送热饭，又默默离开，表现了外婆对“我”的关心和爱。',
    studentAnswer: '这段写下雨了。',
    expectedMainAbility: '概括',
    expectedRootCauseDirection: '只抓住背景信息，没有提取核心事件和人物关系。',
    expectedRootCauseKeywords: ['核心事件', '人物', '背景', '信息', '主要内容'],
    expectedAnswerStatus: 'does_not_meet',
  },
  {
    id: 'live_inference_001',
    question: '阅读片段：父亲反复整理旧书，翻到“我”小时候夹在书里的树叶时，停了很久。由此可以推断父亲怎样的心理？',
    referenceAnswer: '可以推断父亲舍不得过去的生活，也珍惜与孩子共同读书的回忆，内心有不舍和牵挂。',
    studentAnswer: '父亲很喜欢整理东西。',
    expectedMainAbility: '推理',
    expectedRootCauseDirection: '停留在表面行为，没有从文本线索推断人物心理。',
    expectedRootCauseKeywords: ['文本线索', '行为', '心理', '推断', '表面'],
    expectedAnswerStatus: 'does_not_meet',
  },
  {
    id: 'live_inference_002',
    question: '阅读片段：老师看完试卷后没有立刻批评小林，只把错题本推到他面前，说：“你再看看这几道题。”从老师的做法可以推断她的教育态度是什么？',
    referenceAnswer: '可以推断老师希望学生自己发现问题，重视引导和反思，而不是简单批评。',
    studentAnswer: '老师没有生气，她让小林再看错题。',
    expectedMainAbility: '推理',
    expectedRootCauseDirection: '能提取部分行为线索，但没有进一步概括教育态度或原因。',
    expectedRootCauseKeywords: ['行为线索', '线索', '态度', '原因', '结论', '逻辑连接', '推断'],
    expectedAnswerStatus: 'partially_meets',
  },
  {
    id: 'live_expression_001',
    question: '请结合文本内容，谈谈你是否赞同文中“真正的陪伴不一定有声音”这一观点，并说明理由。',
    referenceAnswer: '应明确表达是否赞同，并结合文本中父亲默默等待、接送或陪伴的情节，说明无声陪伴也能体现关爱。',
    studentAnswer: '我赞同，因为陪伴很重要。',
    expectedMainAbility: '表达',
    expectedRootCauseDirection: '有观点，但缺少文本依据和解释说明，表达结构不完整。',
    expectedRootCauseKeywords: ['观点', '文本依据', '说明', '结构', '理由'],
    expectedAnswerStatus: 'partially_meets',
  },
  {
    id: 'live_expression_002',
    question: '请围绕“真正的陪伴不一定有声音”写一段话表达你的看法，要求观点明确、语言通顺，并结合文本内容说明理由。',
    referenceAnswer: '应围绕“无声陪伴也能体现关爱”形成明确观点，并结合文本中父亲默默等待、接送或陪伴的情节说明理由，语言表达完整通顺。',
    studentAnswer: '陪伴很重要。',
    expectedMainAbility: '表达',
    expectedRootCauseDirection: '观点过于简单，缺少文本依据和语言组织，表达内容不完整。',
    expectedRootCauseKeywords: ['观点', '笼统', '文本依据', '说明', '语言组织', '内容支撑'],
    expectedAnswerStatus: 'does_not_meet',
  },
];
