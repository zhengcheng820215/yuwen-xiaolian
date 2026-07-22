import type { StudentLearningNarrative } from '../schemas/studentLearningNarrative.schema.ts';

export type NarrativeCalibrationGapReason =
  | 'missing_response_anchor'
  | 'achieved_not_specific'
  | 'primary_gap_not_unique'
  | 'next_action_not_executable'
  | 'continuation_not_grounded'
  | 'language_too_generic'
  | 'unsupported_inference';

export type NarrativeCalibrationSample = {
  sampleId: string;
  title: string;
  taskRole: 'diagnosis' | 'training' | 'retest' | 'transfer';
  materialExcerpt: string;
  question: string;
  studentAnswer: string;
  rubricCoverage: string[];
  diagnosisSummary: string;
  evidenceSummary?: string;
  strategySummary?: string;
  currentNarrative: StudentLearningNarrative;
  idealNarrative: StudentLearningNarrative;
  gapReasons: NarrativeCalibrationGapReason[];
};

export const narrativeCalibrationSamples: NarrativeCalibrationSample[] = [
  {
    sampleId: 'narrative-calibration-01',
    title: '结论成立，但缺少文本依据',
    taskRole: 'training',
    materialExcerpt: '列车缓缓开动，父亲仍站在原地挥手，直到车厢消失在转弯处。',
    question: '父亲此时有怎样的心理？请结合具体动作说明理由。',
    studentAnswer: '父亲很舍不得孩子离开。',
    rubricCoverage: ['人物心理：完成', '具体动作：未体现', '动作与心理关系：未体现'],
    diagnosisSummary: '心理方向成立，但缺少动作依据和关系说明。',
    evidenceSummary: '学生明确写出“不舍”，未引用材料动作。',
    strategySummary: '保留正确判断，补充文本依据。',
    currentNarrative: {
      achieved: '你已经写出了人物心理。',
      currentGap: '还需要结合具体内容说明理由。',
      nextAction: '做人物心理题时要结合动作分析。',
    },
    idealNarrative: {
      responseAnchor: '你写出了“父亲很舍不得孩子离开”这一理解。',
      achieved: '人物心理这一要求已经完成。',
      currentGap: '答案里还没有写出能体现这种不舍的具体动作。',
      nextAction: '保留“不舍”的判断，再补充父亲挥手或停留的动作，并说明这个动作为什么能体现不舍。',
    },
    gapReasons: ['missing_response_anchor', 'primary_gap_not_unique', 'next_action_not_executable'],
  },
  {
    sampleId: 'narrative-calibration-02',
    title: '找到了动作，但心理判断偏差',
    taskRole: 'training',
    materialExcerpt: '母亲把伞推向孩子，自己的肩膀却被雨淋湿了。',
    question: '母亲的动作表现出怎样的心理？请说明理由。',
    studentAnswer: '母亲不耐烦，因为她把伞推了过去。',
    rubricCoverage: ['人物动作：部分完成', '人物心理：需要重新判断', '动作与心理关系：未成立'],
    diagnosisSummary: '学生找到动作，但心理结论与动作所表达的含义不一致。',
    evidenceSummary: '学生使用了“把伞推了过去”，该动作可保留。',
    strategySummary: '保留动作，重新判断心理，再解释关系。',
    currentNarrative: {
      currentGap: '你对母亲心理的理解还需要重新想一想。',
      nextAction: '先找动作，再分析人物心理。',
    },
    idealNarrative: {
      responseAnchor: '你注意到了母亲“把伞推了过去”这个动作。',
      achieved: '你已经找到了一个与题目有关的具体动作。',
      currentGap: '这个动作表现的心理还需要重新判断。',
      nextAction: '保留已经找到的动作，重新想一想它表现了母亲怎样的心理，再说明你为什么这样理解。',
    },
    gapReasons: ['missing_response_anchor', 'achieved_not_specific', 'next_action_not_executable'],
  },
  {
    sampleId: 'narrative-calibration-03',
    title: '结论、依据和关系均成立',
    taskRole: 'transfer',
    materialExcerpt: '小林把散落的书一本本放回书架，又把地面打扫干净。',
    question: '结合具体动作，概括小林的人物特点。',
    studentAnswer: '小林做事认真负责。他把书一本本放回去，还主动打扫了地面。',
    rubricCoverage: ['人物特点：完成', '具体动作：完成', '动作与特点关系：完成'],
    diagnosisSummary: '学生在新材料中完成了人物特点、动作依据与关系说明。',
    evidenceSummary: '本次回答有效且任务要求覆盖完整。',
    strategySummary: '不强造不足，保留本轮具体完成事实。',
    currentNarrative: {
      achieved: '你回答得很好，已经完成了本题。',
      nextAction: '继续保持。',
    },
    idealNarrative: {
      responseAnchor: '你写出了“小林做事认真负责”，并用整理书籍和打扫地面说明理由。',
      achieved: '人物特点、具体动作和两者之间的关系都已经写清楚。',
    },
    gapReasons: ['missing_response_anchor', 'achieved_not_specific', 'language_too_generic'],
  },
  {
    sampleId: 'narrative-calibration-04',
    title: '回答信息不足',
    taskRole: 'diagnosis',
    materialExcerpt: '父亲把那片旧树叶捏在手里看了很久，又小心地夹回书中。',
    question: '结合父亲的动作，推断他此时的心理。',
    studentAnswer: '不知道。',
    rubricCoverage: ['人物心理：无法判断', '具体动作：未体现', '关系说明：未体现'],
    diagnosisSummary: '当前回答不足以形成可靠的能力判断。',
    strategySummary: '只提示补充当前答案，不生成能力结论。',
    currentNarrative: {
      currentGap: '回答信息不足，请继续努力。',
      nextAction: '认真阅读文章后重新作答。',
    },
    idealNarrative: {
      currentGap: '这次回答还没有写出父亲的心理，也没有说明理由。',
      nextAction: '先写出你认为父亲当时的心理，再从文中找一个具体动作说明理由。',
    },
    gapReasons: ['next_action_not_executable', 'language_too_generic'],
  },
];
