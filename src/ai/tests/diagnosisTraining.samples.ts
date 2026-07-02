export type DiagnosisTrainingSample = {
  id: string;
  title: string;
  question: string;
  referenceAnswer: string;
  studentAnswer: string;
  expectedMainAbility: string;
  expectedRootCauseKeyword: string;
  expectedTrainingKeyword: string;
};

export const diagnosisTrainingSamples: DiagnosisTrainingSample[] = [
  {
    id: 'sample_summary_001',
    title: '概括错误',
    question: '请概括这段文字的主要内容。',
    referenceAnswer: '文章通过描写父亲雨中送伞的细节，表现父亲默默付出的关爱，以及作者逐渐理解父爱的过程。',
    studentAnswer: '文章写父亲下雨天来了，还拿了一把伞，后来作者回家了。',
    expectedMainAbility: '概括',
    expectedRootCauseKeyword: '核心信息',
    expectedTrainingKeyword: '概括',
  },
  {
    id: 'sample_extraction_001',
    title: '信息提取错误',
    question: '根据原文，找出母亲改变主意的两个原因。',
    referenceAnswer: '一是她看见孩子一直坚持练习，二是老师说明孩子确实有进步。',
    studentAnswer: '母亲觉得孩子很喜欢，所以同意了。',
    expectedMainAbility: '信息提取',
    expectedRootCauseKeyword: '关键文本',
    expectedTrainingKeyword: '关键词',
  },
  {
    id: 'sample_comprehension_001',
    title: '理解错误',
    question: '如何理解文中“他终于放慢了脚步”这句话的含义？',
    referenceAnswer: '这句话表明人物从一开始急于逃避，到后来愿意停下来面对问题，体现了心理转变。',
    studentAnswer: '意思是他走累了，所以走得慢。',
    expectedMainAbility: '理解',
    expectedRootCauseKeyword: '能力路径',
    expectedTrainingKeyword: '理解',
  },
  {
    id: 'sample_inference_001',
    title: '推理错误',
    question: '从文中父亲反复整理旧书的行为，可以推断出他怎样的心理？',
    referenceAnswer: '可以推断父亲舍不得过去的生活，也珍惜与孩子共同读书的回忆，内心有不舍和牵挂。',
    studentAnswer: '父亲很喜欢书。',
    expectedMainAbility: '推理',
    expectedRootCauseKeyword: '文本依据',
    expectedTrainingKeyword: '推理',
  },
  {
    id: 'sample_expression_001',
    title: '表达不完整',
    question: '请结合文本分析这个人物形象。',
    referenceAnswer: '人物勤劳、善良且有责任感。文中他主动帮助邻居修门，说明他热心；坚持照顾家人，表现出责任感。',
    studentAnswer: '他是一个好人，很负责。',
    expectedMainAbility: '分析',
    expectedRootCauseKeyword: '依据',
    expectedTrainingKeyword: '依据',
  },
];
