export type TrainingPlanSource = 'ability_evidence';

export type TrainingPlanEvidenceLink = {
  ability: string;
  weaknessCount: number;
  averageConfidence: number;
  reasons: string[];
};

export type TrainingPlanSuccessCriteria = {
  measurable: boolean;
  description: string;
};

export type TrainingPlanDay = {
  day: number;
  training_goal: string;
  target_ability: string;
  targetSkill: string;
  strategy: string;
  reason_from_evidence: string;
  focus_skills: string[];
  tasks: string[];
  practice_type: string;
  success_criteria: string[];
  successCriteria: TrainingPlanSuccessCriteria;
  evidence_links: TrainingPlanEvidenceLink[];
};

export type TrainingPlan = {
  plan_id: string;
  student_id: string;
  source: TrainingPlanSource;
  cycle_days: number;
  primary_target_ability: string;
  generated_at: string;
  summary: string;
  days: TrainingPlanDay[];
};

export const TRAINING_PLAN_DAY_COUNT = 3;

export function normalizeTrainingPlan(value: Partial<TrainingPlan>): TrainingPlan {
  const generatedAt = value.generated_at || new Date().toISOString();
  const studentId = value.student_id || 'demo-student';
  const primaryTargetAbility = value.primary_target_ability || '待训练能力';

  return {
    plan_id: value.plan_id || buildTrainingPlanId(studentId, generatedAt),
    student_id: studentId,
    source: value.source || 'ability_evidence',
    cycle_days: value.cycle_days || TRAINING_PLAN_DAY_COUNT,
    primary_target_ability: primaryTargetAbility,
    generated_at: generatedAt,
    summary: value.summary || `优先围绕「${primaryTargetAbility}」进行阶段训练。`,
    days: Array.isArray(value.days) ? value.days.map(normalizeTrainingPlanDay) : [],
  };
}

export function isTrainingPlan(value: unknown): value is TrainingPlan {
  if (!value || typeof value !== 'object') return false;

  const plan = value as TrainingPlan;
  return (
    typeof plan.plan_id === 'string' &&
    plan.plan_id.trim().length > 0 &&
    typeof plan.student_id === 'string' &&
    plan.student_id.trim().length > 0 &&
    plan.source === 'ability_evidence' &&
    plan.cycle_days === TRAINING_PLAN_DAY_COUNT &&
    typeof plan.primary_target_ability === 'string' &&
    plan.primary_target_ability.trim().length > 0 &&
    typeof plan.generated_at === 'string' &&
    plan.generated_at.trim().length > 0 &&
    typeof plan.summary === 'string' &&
    plan.summary.trim().length > 0 &&
    Array.isArray(plan.days) &&
    plan.days.length === TRAINING_PLAN_DAY_COUNT &&
    plan.days.every(isTrainingPlanDay)
  );
}

function normalizeTrainingPlanDay(value: Partial<TrainingPlanDay>): TrainingPlanDay {
  return {
    day: typeof value.day === 'number' ? value.day : 1,
    training_goal: value.training_goal || '完成一个可验证的能力训练目标。',
    target_ability: value.target_ability || '待训练能力',
    targetSkill: value.targetSkill || inferTargetSkill(value.target_ability, value.focus_skills),
    strategy: value.strategy || '依据 Ability Evidence 的薄弱原因选择针对训练策略。',
    reason_from_evidence: value.reason_from_evidence || '来自 Ability Evidence 的薄弱点排序。',
    focus_skills: Array.isArray(value.focus_skills) ? value.focus_skills : [],
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    practice_type: value.practice_type || 'targeted_practice',
    success_criteria: Array.isArray(value.success_criteria) ? value.success_criteria : [],
    successCriteria: normalizeSuccessCriteria(value.successCriteria, value.success_criteria),
    evidence_links: Array.isArray(value.evidence_links) ? value.evidence_links : [],
  };
}

function isTrainingPlanDay(value: TrainingPlanDay): boolean {
  return (
    typeof value.day === 'number' &&
    value.day >= 1 &&
    value.day <= TRAINING_PLAN_DAY_COUNT &&
    typeof value.training_goal === 'string' &&
    value.training_goal.trim().length > 0 &&
    typeof value.target_ability === 'string' &&
    value.target_ability.trim().length > 0 &&
    typeof value.targetSkill === 'string' &&
    value.targetSkill.trim().length > 0 &&
    typeof value.strategy === 'string' &&
    value.strategy.trim().length > 0 &&
    typeof value.reason_from_evidence === 'string' &&
    value.reason_from_evidence.trim().length > 0 &&
    Array.isArray(value.focus_skills) &&
    value.focus_skills.length > 0 &&
    Array.isArray(value.tasks) &&
    value.tasks.length > 0 &&
    typeof value.practice_type === 'string' &&
    value.practice_type.trim().length > 0 &&
    Array.isArray(value.success_criteria) &&
    value.success_criteria.length > 0 &&
    typeof value.successCriteria === 'object' &&
    value.successCriteria !== null &&
    value.successCriteria.measurable === true &&
    typeof value.successCriteria.description === 'string' &&
    value.successCriteria.description.trim().length > 0 &&
    Array.isArray(value.evidence_links) &&
    value.evidence_links.length > 0
  );
}

function inferTargetSkill(targetAbility = '', focusSkills: string[] | undefined): string {
  if (Array.isArray(focusSkills) && focusSkills.length > 0) return focusSkills[0];

  const fallback: Record<string, string> = {
    推理: '文本证据 -> 观点推断',
    表达: '观点 -> 依据 -> 说明',
    信息提取: '关键词定位与限定条件识别',
    概括: '核心事件筛选与压缩表达',
    理解: '语境信息 -> 深层含义转换',
    分析: '文本依据 -> 作用说明',
  };

  return fallback[targetAbility] || `${targetAbility || '目标能力'}具体技能`;
}

function normalizeSuccessCriteria(
  value: TrainingPlanSuccessCriteria | undefined,
  legacyCriteria: string[] | undefined,
): TrainingPlanSuccessCriteria {
  if (
    value &&
    typeof value.measurable === 'boolean' &&
    typeof value.description === 'string' &&
    value.description.trim().length > 0
  ) {
    return value;
  }

  return {
    measurable: true,
    description: Array.isArray(legacyCriteria) && legacyCriteria.length > 0
      ? legacyCriteria[0]
      : '学生能够完成本日训练任务，并留下可复核的作答证据。',
  };
}

function buildTrainingPlanId(studentId: string, generatedAt: string): string {
  const safeGeneratedAt = generatedAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `${studentId}-training-plan-${safeGeneratedAt}`;
}
