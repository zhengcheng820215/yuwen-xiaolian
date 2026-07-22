import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';

export const STUDENT_FEEDBACK_ACTION_PLAN_SCHEMA_VERSION = 'student_feedback_action_plan_v1' as const;

export type StudentFeedbackDepth = 1 | 2 | 3 | 4;

export type StudentFeedbackHintLevel =
  | 'none'
  | 'location'
  | 'paraphrase'
  | 'explicit';

export type StudentFeedbackActionPlan = {
  schemaVersion: typeof STUDENT_FEEDBACK_ACTION_PLAN_SCHEMA_VERSION;
  studentId: string;
  learningRoundId: string;
  taskRole?: RecommendedTaskRole;
  feedbackDepth: StudentFeedbackDepth;
  hintLevel: StudentFeedbackHintLevel;
  acknowledgedAction?: string;
  whyItMatters?: string;
  missingAnswerPart?: string;
  problemMechanism?: string;
  thinkingPrompt?: string;
  nextOperations: string[];
  scaffoldTemplate?: string;
  sourceGapId?: string;
  evidenceLinks: string[];
  limitations: string[];
  validation: {
    passed: boolean;
    actionGrounded: boolean;
    gapSpecific: boolean;
    operationsExecutable: boolean;
    disclosureAllowed: boolean;
    issues: string[];
  };
};

export function isStudentFeedbackActionPlan(value: unknown): value is StudentFeedbackActionPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as StudentFeedbackActionPlan;
  return plan.schemaVersion === STUDENT_FEEDBACK_ACTION_PLAN_SCHEMA_VERSION &&
    nonEmpty(plan.studentId) &&
    nonEmpty(plan.learningRoundId) &&
    [1, 2, 3, 4].includes(plan.feedbackDepth) &&
    ['none', 'location', 'paraphrase', 'explicit'].includes(plan.hintLevel) &&
    (plan.acknowledgedAction === undefined || nonEmpty(plan.acknowledgedAction)) &&
    (plan.whyItMatters === undefined || nonEmpty(plan.whyItMatters)) &&
    (plan.missingAnswerPart === undefined || nonEmpty(plan.missingAnswerPart)) &&
    (plan.problemMechanism === undefined || nonEmpty(plan.problemMechanism)) &&
    (plan.thinkingPrompt === undefined || nonEmpty(plan.thinkingPrompt)) &&
    Array.isArray(plan.nextOperations) && plan.nextOperations.every(nonEmpty) &&
    (plan.scaffoldTemplate === undefined || nonEmpty(plan.scaffoldTemplate)) &&
    (plan.sourceGapId === undefined || nonEmpty(plan.sourceGapId)) &&
    Array.isArray(plan.evidenceLinks) && plan.evidenceLinks.length > 0 && plan.evidenceLinks.every(nonEmpty) &&
    Array.isArray(plan.limitations) && plan.limitations.every(nonEmpty) &&
    typeof plan.validation?.passed === 'boolean' &&
    typeof plan.validation?.actionGrounded === 'boolean' &&
    typeof plan.validation?.gapSpecific === 'boolean' &&
    typeof plan.validation?.operationsExecutable === 'boolean' &&
    typeof plan.validation?.disclosureAllowed === 'boolean' &&
    Array.isArray(plan.validation?.issues);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
