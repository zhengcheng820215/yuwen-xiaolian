import type { OpenResponseAnswerStatus } from '../schemas/diagnosis.schema.ts';
import type { RevisionGoal } from '../schemas/learningFeedbackRevision.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type {
  StudentFeedbackGuidance,
  TaskRequirementCoverage,
  TaskRequirementGapReasonCode,
} from '../schemas/studentLearningFeedback.schema.ts';

export const LEARNING_FEEDBACK_REVISION_OFFER_POLICY_VERSION =
  'learning_feedback_revision_offer_policy_v2' as const;

export type LearningFeedbackRevisionOfferLevel = 'none' | 'optional' | 'recommended';

export type LearningFeedbackRevisionOfferReason =
  | 'eligible_missing_requirement'
  | 'eligible_partial_requirement'
  | 'eligible_actionable_foundation'
  | 'task_role_not_eligible'
  | 'formal_feedback_unavailable'
  | 'initial_response_fully_meets'
  | 'initial_response_not_revision_eligible'
  | 'no_actionable_revision_goal';

export type LearningFeedbackRevisionOfferDecision = {
  policyVersion: typeof LEARNING_FEEDBACK_REVISION_OFFER_POLICY_VERSION;
  level: LearningFeedbackRevisionOfferLevel;
  reason: LearningFeedbackRevisionOfferReason;
  actionLabel?: '根据反馈修订' | '完善回答';
  revisionGoal?: RevisionGoal;
};

export type LearningFeedbackRevisionOfferInput = {
  taskRole: RecommendedTaskRole;
  answerStatus?: OpenResponseAnswerStatus;
  formalDiagnosisId?: string;
  formalFeedbackId?: string;
  formalFeedbackReady: boolean;
  requirementCoverage?: TaskRequirementCoverage[];
  guidance?: StudentFeedbackGuidance;
};

export function decideLearningFeedbackRevisionOffer(
  input: LearningFeedbackRevisionOfferInput,
): LearningFeedbackRevisionOfferDecision {
  if (input.taskRole !== 'training') return none('task_role_not_eligible');
  if (!input.formalFeedbackReady || !input.formalDiagnosisId || !input.formalFeedbackId) {
    return none('formal_feedback_unavailable');
  }
  if (input.answerStatus === 'fully_meets') return none('initial_response_fully_meets');
  if (input.answerStatus !== 'partially_meets' && input.answerStatus !== 'does_not_meet') {
    return none('initial_response_not_revision_eligible');
  }

  const coverage = input.requirementCoverage || [];
  const actionable = coverage
    .filter((item) => item.required)
    .filter((item) => item.status === 'missing' || item.status === 'partially_covered')
    .filter((item) => item.gapReasonCode !== 'insufficient_to_judge')
    .sort((left, right) => priority(left.status) - priority(right.status));
  const primary = actionable[0];
  if (!primary) return none('no_actionable_revision_goal');
  if (input.answerStatus === 'does_not_meet' && !hasRequiredFoundation(coverage)) {
    return none('initial_response_not_revision_eligible');
  }

  const level = input.answerStatus === 'does_not_meet' || primary.status === 'missing'
    ? 'recommended'
    : 'optional';
  const primaryIssueCode = issueCode(primary);
  const relatedIssueCodes = actionable
    .slice(1)
    .map(issueCode)
    .filter((code, index, codes) => code !== primaryIssueCode && codes.indexOf(code) === index)
    .slice(0, 2);
  return {
    policyVersion: LEARNING_FEEDBACK_REVISION_OFFER_POLICY_VERSION,
    level,
    reason: input.answerStatus === 'does_not_meet'
      ? 'eligible_actionable_foundation'
      : level === 'recommended'
        ? 'eligible_missing_requirement'
        : 'eligible_partial_requirement',
    actionLabel: level === 'recommended' ? '根据反馈修订' : '完善回答',
    revisionGoal: {
      primaryIssueCode,
      relatedIssueCodes,
      instruction: revisionInstruction(primary, input.guidance),
      sourceDiagnosisId: input.formalDiagnosisId,
      sourceFeedbackId: input.formalFeedbackId,
    },
  };
}

function hasRequiredFoundation(coverage: TaskRequirementCoverage[]): boolean {
  return coverage.some((item) => (
    item.required
    && (item.status === 'covered' || item.status === 'partially_covered')
  ));
}

function none(reason: LearningFeedbackRevisionOfferReason): LearningFeedbackRevisionOfferDecision {
  return {
    policyVersion: LEARNING_FEEDBACK_REVISION_OFFER_POLICY_VERSION,
    level: 'none',
    reason,
  };
}

function priority(status: TaskRequirementCoverage['status']): number {
  return status === 'missing' ? 0 : 1;
}

function issueCode(coverage: TaskRequirementCoverage): string {
  return coverage.gapReasonCode || fallbackIssueCode(coverage.requirementType);
}

function fallbackIssueCode(requirementType: TaskRequirementCoverage['requirementType']): TaskRequirementGapReasonCode {
  if (requirementType === 'text_evidence') return 'missing_text_evidence';
  if (requirementType === 'reasoning_relation') return 'missing_reasoning_relation';
  return 'incomplete_task_requirement';
}

function revisionInstruction(
  coverage: TaskRequirementCoverage,
  guidance?: StudentFeedbackGuidance,
): string {
  const guided = guidance?.revisionActions.find((item) => item.trim().length > 0)?.trim();
  if (guided) return guided;
  if (coverage.gapMessage?.trim()) return coverage.gapMessage.trim();
  if (coverage.studentMessage?.trim()) return coverage.studentMessage.trim();
  return `围绕“${coverage.requirementText}”补充必要信息，并说明它如何支持你的判断。`;
}
