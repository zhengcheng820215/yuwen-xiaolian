import type { AbilityEvidenceType } from './abilityEvidence.schema.ts';

export type PersonalizedNextTaskLinkedEvidence = {
  evidence_id: string;
  ability: string;
  evidence_type: AbilityEvidenceType;
  reason: string;
};

export type PersonalizedNextTask = {
  task_id: string;
  target_ability: string;
  task_goal: string;
  why_this_task: string;
  question: string;
  reference_answer: string;
  scoring_points: string[];
  answer_requirements: string[];
  success_criteria: string[];
  linked_evidence: PersonalizedNextTaskLinkedEvidence[];
  expected_diagnosis_focus: string[];
};

export function normalizePersonalizedNextTask(
  value: Partial<PersonalizedNextTask>,
): PersonalizedNextTask {
  const targetAbility = value.target_ability || '待训练能力';

  return {
    task_id: value.task_id || `personalized-next-task-${Date.now()}`,
    target_ability: targetAbility,
    task_goal: value.task_goal || `围绕「${targetAbility}」完成一次可诊断的下一步训练任务。`,
    why_this_task: value.why_this_task || `当前学生画像显示「${targetAbility}」需要优先训练。`,
    question: value.question || `请完成一题「${targetAbility}」专项任务。`,
    reference_answer: value.reference_answer || '参考答案需要覆盖题目核心要求，并呈现清晰作答过程。',
    scoring_points: normalizeStringArray(value.scoring_points, ['覆盖核心要点', '表达清楚', '能够提供文本依据或思考过程']),
    answer_requirements: normalizeStringArray(value.answer_requirements, ['按题目要求完整作答', '写出关键依据或思考过程']),
    success_criteria: normalizeStringArray(value.success_criteria, ['答案能够体现本次目标能力', '答案可进入后续诊断']),
    linked_evidence: Array.isArray(value.linked_evidence) ? value.linked_evidence.filter(isLinkedEvidence) : [],
    expected_diagnosis_focus: normalizeStringArray(value.expected_diagnosis_focus, [`观察「${targetAbility}」是否出现改善证据`]),
  };
}

export function isPersonalizedNextTask(value: unknown): value is PersonalizedNextTask {
  if (!value || typeof value !== 'object') return false;

  const task = value as PersonalizedNextTask;
  return (
    isNonEmptyString(task.task_id) &&
    isNonEmptyString(task.target_ability) &&
    isNonEmptyString(task.task_goal) &&
    isNonEmptyString(task.why_this_task) &&
    isNonEmptyString(task.question) &&
    isNonEmptyString(task.reference_answer) &&
    Array.isArray(task.scoring_points) &&
    task.scoring_points.length > 0 &&
    task.scoring_points.every(isNonEmptyString) &&
    Array.isArray(task.answer_requirements) &&
    task.answer_requirements.length > 0 &&
    task.answer_requirements.every(isNonEmptyString) &&
    Array.isArray(task.success_criteria) &&
    task.success_criteria.length > 0 &&
    task.success_criteria.every(isNonEmptyString) &&
    Array.isArray(task.linked_evidence) &&
    task.linked_evidence.length > 0 &&
    task.linked_evidence.every(isLinkedEvidence) &&
    Array.isArray(task.expected_diagnosis_focus) &&
    task.expected_diagnosis_focus.length > 0 &&
    task.expected_diagnosis_focus.every(isNonEmptyString)
  );
}

function isLinkedEvidence(value: unknown): value is PersonalizedNextTaskLinkedEvidence {
  if (!value || typeof value !== 'object') return false;

  const evidence = value as PersonalizedNextTaskLinkedEvidence;
  return (
    isNonEmptyString(evidence.evidence_id) &&
    isNonEmptyString(evidence.ability) &&
    ['weakness', 'positive', 'growth', 'insufficient'].includes(evidence.evidence_type) &&
    isNonEmptyString(evidence.reason)
  );
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
