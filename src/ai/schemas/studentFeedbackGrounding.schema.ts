import type { TaskRequirementGapReasonCode } from './studentLearningFeedback.schema.ts';

export const STUDENT_FEEDBACK_GROUNDING_SCHEMA_VERSION = 'student_feedback_grounding_v1' as const;

export type StudentFeedbackGroundingStatus =
  | 'grounded'
  | 'cannot_assess'
  | 'no_gap';

export type StudentFeedbackLearningGapCode =
  | 'LG01_TASK_REQUIREMENT_MISALIGNED'
  | 'LG02_CONCLUSION_REVISION_REQUIRED'
  | 'LG04_TEXT_EVIDENCE_MISSING'
  | 'LG05_REASONING_RELATION_MISSING'
  | 'LG07_EXPRESSION_ORGANIZATION_INCOMPLETE';

export type StudentFeedbackGroundedPoint = {
  text: string;
  requirementId: string;
  evidenceLinks: string[];
};

export type StudentFeedbackGroundedGap = {
  gapId: string;
  gapCode?: StudentFeedbackLearningGapCode;
  reasonCode?: TaskRequirementGapReasonCode;
  verificationStatus: 'observed' | 'needs_verification' | 'supported';
  missingRequirement: string;
  feedbackText: string;
  evidenceLinks: string[];
  limitations: string[];
};

export type StudentFeedbackGroundedAction = {
  text: string;
  targetGapId?: string;
  validationGoal: string;
  evidenceLinks: string[];
};

export type StudentFeedbackGrounding = {
  schemaVersion: typeof STUDENT_FEEDBACK_GROUNDING_SCHEMA_VERSION;
  studentId: string;
  learningRoundId: string;
  status: StudentFeedbackGroundingStatus;
  achievedPoints: StudentFeedbackGroundedPoint[];
  primaryGap?: StudentFeedbackGroundedGap;
  actions: StudentFeedbackGroundedAction[];
  validation: {
    passed: boolean;
    allClaimsTraceable: boolean;
    noUnsupportedPositiveClaim: boolean;
    actionsBoundToGap: boolean;
    issues: string[];
  };
};

export function isStudentFeedbackGrounding(value: unknown): value is StudentFeedbackGrounding {
  if (!value || typeof value !== 'object') return false;
  const grounding = value as StudentFeedbackGrounding;
  return grounding.schemaVersion === STUDENT_FEEDBACK_GROUNDING_SCHEMA_VERSION &&
    nonEmpty(grounding.studentId) &&
    nonEmpty(grounding.learningRoundId) &&
    ['grounded', 'cannot_assess', 'no_gap'].includes(grounding.status) &&
    Array.isArray(grounding.achievedPoints) &&
    grounding.achievedPoints.every(isGroundedPoint) &&
    (grounding.primaryGap === undefined || isGroundedGap(grounding.primaryGap)) &&
    Array.isArray(grounding.actions) &&
    grounding.actions.every(isGroundedAction) &&
    typeof grounding.validation?.passed === 'boolean' &&
    typeof grounding.validation?.allClaimsTraceable === 'boolean' &&
    typeof grounding.validation?.noUnsupportedPositiveClaim === 'boolean' &&
    typeof grounding.validation?.actionsBoundToGap === 'boolean' &&
    Array.isArray(grounding.validation?.issues);
}

function isGroundedPoint(value: unknown): value is StudentFeedbackGroundedPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as StudentFeedbackGroundedPoint;
  return nonEmpty(point.text) && nonEmpty(point.requirementId) && linksValid(point.evidenceLinks);
}

function isGroundedGap(value: unknown): value is StudentFeedbackGroundedGap {
  if (!value || typeof value !== 'object') return false;
  const gap = value as StudentFeedbackGroundedGap;
  return nonEmpty(gap.gapId) &&
    (gap.gapCode === undefined || [
      'LG01_TASK_REQUIREMENT_MISALIGNED',
      'LG02_CONCLUSION_REVISION_REQUIRED',
      'LG04_TEXT_EVIDENCE_MISSING',
      'LG05_REASONING_RELATION_MISSING',
      'LG07_EXPRESSION_ORGANIZATION_INCOMPLETE',
    ].includes(gap.gapCode)) &&
    ['observed', 'needs_verification', 'supported'].includes(gap.verificationStatus) &&
    nonEmpty(gap.missingRequirement) &&
    nonEmpty(gap.feedbackText) &&
    linksValid(gap.evidenceLinks) &&
    Array.isArray(gap.limitations);
}

function isGroundedAction(value: unknown): value is StudentFeedbackGroundedAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as StudentFeedbackGroundedAction;
  return nonEmpty(action.text) &&
    (action.targetGapId === undefined || nonEmpty(action.targetGapId)) &&
    nonEmpty(action.validationGoal) &&
    linksValid(action.evidenceLinks);
}

function linksValid(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmpty);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
