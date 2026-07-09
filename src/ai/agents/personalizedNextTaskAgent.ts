import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import {
  normalizePersonalizedNextTask,
  type PersonalizedNextTask,
  type PersonalizedNextTaskLinkedEvidence,
} from '../schemas/personalizedNextTask.schema.ts';
import type {
  AbilityEvidenceSummary,
  WeaknessRankingItem,
} from './weaknessRankingAgent.ts';

export type PersonalizedNextTaskInput = {
  studentAbilityProfile: StudentAbilityProfile;
  topWeakness: WeaknessRankingItem[];
  evidenceSummary: AbilityEvidenceSummary[];
  updatedEvidence: AbilityEvidence[];
  generatedAt?: string;
};

export function generatePersonalizedNextTask(
  input: PersonalizedNextTaskInput,
): PersonalizedNextTask {
  const primaryWeakness = input.topWeakness[0];
  const targetAbility = primaryWeakness?.ability || input.studentAbilityProfile.current_weakness.primary || '待训练能力';
  const abilitySummary = input.evidenceSummary.find((item) => item.ability === targetAbility);
  const linkedEvidence = buildLinkedEvidence(input.updatedEvidence, targetAbility, primaryWeakness);
  const taskTemplate = buildTaskTemplate(targetAbility);

  return normalizePersonalizedNextTask({
    task_id: buildTaskId(targetAbility, input.generatedAt),
    target_ability: targetAbility,
    task_goal: buildTaskGoal(targetAbility, primaryWeakness),
    why_this_task: buildWhyThisTask(targetAbility, primaryWeakness, abilitySummary),
    question: taskTemplate.question,
    reference_answer: taskTemplate.reference_answer,
    scoring_points: taskTemplate.scoring_points,
    answer_requirements: taskTemplate.answer_requirements,
    success_criteria: buildSuccessCriteria(targetAbility, taskTemplate.success_criteria),
    linked_evidence: linkedEvidence,
    expected_diagnosis_focus: buildExpectedDiagnosisFocus(targetAbility, primaryWeakness),
  });
}

function buildLinkedEvidence(
  updatedEvidence: AbilityEvidence[],
  targetAbility: string,
  primaryWeakness?: WeaknessRankingItem,
): PersonalizedNextTaskLinkedEvidence[] {
  const sameAbilityEvidence = updatedEvidence
    .filter((item) => item.ability === targetAbility)
    .sort((left, right) => {
      if (left.evidenceType === 'weakness' && right.evidenceType !== 'weakness') return -1;
      if (right.evidenceType === 'weakness' && left.evidenceType !== 'weakness') return 1;
      return right.confidence - left.confidence;
    });

  const selected = sameAbilityEvidence.length > 0 ? sameAbilityEvidence : updatedEvidence.slice(0, 2);

  return selected.slice(0, 3).map((evidence) => ({
    evidence_id: evidence.id,
    ability: evidence.ability,
    evidence_type: evidence.evidenceType,
    reason: evidence.rootCause || evidence.observation || primaryWeakness?.reasons[0] || '该证据与当前优先薄弱能力相关。',
  }));
}

function buildTaskGoal(targetAbility: string, weakness?: WeaknessRankingItem): string {
  if (weakness?.suggestedTrainingFocus) {
    return `围绕「${targetAbility}」完成一次下一步任务，重点训练：${weakness.suggestedTrainingFocus}。`;
  }

  return `围绕「${targetAbility}」完成一次可诊断的下一步任务。`;
}

function buildWhyThisTask(
  targetAbility: string,
  weakness: WeaknessRankingItem | undefined,
  summary: AbilityEvidenceSummary | undefined,
): string {
  if (!weakness) {
    return `学生能力画像当前优先薄弱能力为「${targetAbility}」，需要补充一次可诊断任务。`;
  }

  const rootCause = summary?.rootCauses[0] || weakness.reasons[0] || '已有能力证据指向该能力需要优先训练。';
  return `topWeakness 显示「${targetAbility}」优先级为 ${weakness.priority}，存在 ${weakness.weaknessCount} 条薄弱证据；主要依据：${rootCause}`;
}

function buildExpectedDiagnosisFocus(
  targetAbility: string,
  weakness?: WeaknessRankingItem,
): string[] {
  const focus = [weakness?.suggestedTrainingFocus, ...weakness?.reasons || []]
    .filter((item): item is string => Boolean(item));

  if (focus.length > 0) {
    return [
      `观察学生是否能完成「${targetAbility}」任务的关键步骤。`,
      ...focus.slice(0, 2),
    ];
  }

  return [
    `观察学生是否能完成「${targetAbility}」任务的关键步骤。`,
    '观察学生答案是否形成可进入 Ability Evidence 的表现记录。',
  ];
}

function buildSuccessCriteria(targetAbility: string, templateCriteria: string[]): string[] {
  return [
    ...templateCriteria,
    `学生答案能够支撑后续对「${targetAbility}」生成新的 Ability Evidence。`,
  ];
}

type TaskTemplate = {
  question: string;
  reference_answer: string;
  scoring_points: string[];
  answer_requirements: string[];
  success_criteria: string[];
};

function buildTaskTemplate(targetAbility: string): TaskTemplate {
  const templates: Record<string, TaskTemplate> = {
    推理: {
      question: '阅读片段：父亲反复整理旧书，翻到“我”小时候夹在书里的树叶时，停了很久。由此可以推断出父亲怎样的心理？请结合文本线索说明理由。',
      reference_answer: '可以推断父亲看到旧书和树叶后想起与孩子共同读书的回忆，内心有不舍、珍惜和牵挂。理由应结合“反复整理旧书”“停了很久”等文本线索说明。',
      scoring_points: ['提取至少一处文本线索', '从线索推断人物心理', '说明线索与心理结论之间的关系'],
      answer_requirements: ['先写出心理判断', '至少引用或转述一处文本线索', '说明这处线索为什么能支持判断'],
      success_criteria: ['答案不是只描述表面行为', '答案包含“线索 -> 心理 -> 说明”的推理链'],
    },
    表达: {
      question: '请围绕“真正的陪伴不一定有声音”写一段话表达你的看法，要求观点明确，并结合文本内容说明理由。',
      reference_answer: '应明确表达是否赞同，并结合文本中父亲默默等待、接送或陪伴的情节，说明无声陪伴也能体现关爱，语言表达完整通顺。',
      scoring_points: ['观点明确', '包含文本依据', '能说明依据如何支持观点', '语言完整通顺'],
      answer_requirements: ['先写出明确观点', '补充一条文本依据', '用一句话解释依据与观点的关系'],
      success_criteria: ['答案不是只写结论', '答案包含“观点 + 文本依据 + 说明”的表达结构'],
    },
    概括: {
      question: '阅读片段：雨天傍晚，外婆撑伞来到校门口，把热好的饭盒递给“我”，又转身走进雨里。请用简洁语言概括这段文字的主要内容。',
      reference_answer: '雨天傍晚，外婆到校门口给“我”送热饭，又默默离开，表现了外婆对“我”的关心和爱。',
      scoring_points: ['交代人物', '概括核心事件', '保留结果或情感主题', '语言简洁完整'],
      answer_requirements: ['保留人物和核心事件', '删除天气等非核心细节', '尽量用一句完整话概括'],
      success_criteria: ['答案包含人物、事件和主题', '答案不是只写背景或感受'],
    },
    理解: {
      question: '阅读片段：“那盏灯不仅照亮了回家的路，也照亮了父亲对我的牵挂。”请结合上下文，说说你对“照亮了父亲对我的牵挂”的理解。',
      reference_answer: '“照亮”不是指灯光真正照亮，而是指作者通过那盏灯感受到父亲长期默默的关爱和牵挂，表达了作者对父爱的理解与感动。',
      scoring_points: ['解释关键词的非字面含义', '结合上下文或人物情感', '说明深层含义或主题'],
      answer_requirements: ['说明关键词的字面意思与语境意思', '结合人物情感解释', '不要只写泛化感受'],
      success_criteria: ['答案能完成字面含义到深层含义的转换', '答案能结合语境说明情感'],
    },
    信息提取: {
      question: '阅读片段：清晨，母亲把雨伞、热牛奶和写着提醒的小纸条放进“我”的书包。请找出文中表现母亲关心“我”的三个细节。',
      reference_answer: '雨伞、热牛奶、写着提醒的小纸条都表现了母亲对“我”的关心。',
      scoring_points: ['准确找到雨伞', '准确找到热牛奶', '准确找到提醒小纸条'],
      answer_requirements: ['直接列出三个文本细节', '不要加入文本外推测', '注意题目要求是三个细节'],
      success_criteria: ['答案能完整定位三个信息点', '答案没有遗漏限定数量'],
    },
    分析: {
      question: '阅读片段：结尾写父亲仍站在门口，望着“我”离开的方向。请分析这一描写在文章中的作用。',
      reference_answer: '这一描写照应父亲长期等待和牵挂的内容，突出父亲深沉无言的爱，也深化了文章主题。',
      scoring_points: ['指出描写对象', '结合文本内容说明作用', '能联系人物情感或文章主题'],
      answer_requirements: ['先指出描写体现了什么', '再说明对人物形象或主题的作用', '结合文本内容作答'],
      success_criteria: ['答案包含文本依据和作用说明', '答案不是只写情感结论'],
    },
  };

  return templates[targetAbility] || {
    question: `请完成一题「${targetAbility}」专项任务，并写出你的思考过程。`,
    reference_answer: `答案应体现「${targetAbility}」的关键步骤，并提供必要依据。`,
    scoring_points: [`体现「${targetAbility}」关键步骤`, '作答完整', '能够提供依据'],
    answer_requirements: ['完整作答', '写出依据或思考过程'],
    success_criteria: ['答案可进入后续诊断', `答案能观察「${targetAbility}」能力表现`],
  };
}

function buildTaskId(targetAbility: string, generatedAt?: string): string {
  const safeAbility = targetAbility.replace(/\s+/g, '');
  const timestamp = (generatedAt || new Date().toISOString()).replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `personalized-next-task-${safeAbility}-${timestamp}`;
}
