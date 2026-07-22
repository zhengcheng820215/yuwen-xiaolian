import type { StudentLearningEntryState } from './studentLearningEntry.schema.ts';
import type { LearningRoundExecutionResult, LearningRoundResult } from './learningRound.schema.ts';
import type { TaskEvidenceReturnResult } from './taskEvidenceReturn.schema.ts';
import type { TaskExecutionResult } from './taskExecution.schema.ts';

export type StudentLearningFeedbackStage =
  | 'submission'
  | 'analysis'
  | 'result';

export type StudentLearningFeedbackStatus =
  | 'completed'
  | 'retry_required'
  | 'review_required'
  | 'blocked';

export type StudentLearningFeedbackSource =
  | 'task_execution'
  | 'evidence_return'
  | 'learning_round';

export type StudentLearningFeedbackDebugState = {
  sourceStatus?: string;
  sourceType?: string;
  issues?: string[];
};

export type StudentFeedbackGuidance = {
  understandingNotice?: string;
  detailsToReview: string[];
  revisionActions: string[];
};

export type TaskRequirementCoverageType =
  | 'conclusion'
  | 'text_evidence'
  | 'reasoning_relation'
  | 'expression';

export type TaskRequirementCoverageStatus =
  | 'covered'
  | 'partially_covered'
  | 'missing'
  | 'insufficient_to_judge';

export type TaskRequirementGapReasonCode =
  | 'conclusion_inconsistent'
  | 'missing_text_evidence'
  | 'missing_reasoning_relation'
  | 'incomplete_task_requirement'
  | 'insufficient_to_judge';

export type TaskRequirementCoverage = {
  requirementId: string;
  requirementType: TaskRequirementCoverageType;
  requirementText: string;
  required: boolean;
  status: TaskRequirementCoverageStatus;
  studentEvidence: string[];
  taskEvidence: string[];
  source: 'formal_diagnosis' | 'ability_evidence' | 'rubric' | 'task_requirement';
  studentMessage?: string;
  gapMessage?: string;
  gapReasonCode?: TaskRequirementGapReasonCode;
};

export type StudentThinkingReview = {
  requirementCoverage?: TaskRequirementCoverage[];
  coveredPoints: string[];
  primaryGapRequirementId?: string;
  primaryGap?: string;
  missingPoints: string[];
};

export type StudentLearningFeedback = {
  learningRoundId: string;
  studentId: string;

  stage: StudentLearningFeedbackStage;
  resultStatus: StudentLearningFeedbackStatus;

  headline: string;
  summary: string;

  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;
  guidance?: StudentFeedbackGuidance;
  thinkingReview?: StudentThinkingReview;

  canRetry: boolean;
  canFinishRound: boolean;

  source: StudentLearningFeedbackSource;

  studentRoundFocus?: {
    title: string;
    description: string;
  };

  debugState?: StudentLearningFeedbackDebugState;
};

export type StudentLearningFeedbackInput = {
  entryState?: StudentLearningEntryState;
  taskExecutionResult?: TaskExecutionResult;
  learningRoundExecutionResult?: LearningRoundExecutionResult;
  taskEvidenceReturnResult?: TaskEvidenceReturnResult;
  learningRoundResult?: LearningRoundResult;
};

export function isStudentLearningFeedback(value: unknown): value is StudentLearningFeedback {
  if (!value || typeof value !== 'object') return false;

  const feedback = value as StudentLearningFeedback;
  return (
    isNonEmptyString(feedback.learningRoundId) &&
    isNonEmptyString(feedback.studentId) &&
    ['submission', 'analysis', 'result'].includes(feedback.stage) &&
    ['completed', 'retry_required', 'review_required', 'blocked'].includes(feedback.resultStatus) &&
    isNonEmptyString(feedback.headline) &&
    isNonEmptyString(feedback.summary) &&
    Array.isArray(feedback.whatYouDidWell) &&
    feedback.whatYouDidWell.every(isNonEmptyString) &&
    Array.isArray(feedback.whatNeedsAttention) &&
    feedback.whatNeedsAttention.every(isNonEmptyString) &&
    isNonEmptyString(feedback.nextActionText) &&
    (
      feedback.thinkingReview === undefined ||
      (
        typeof feedback.thinkingReview === 'object' &&
        feedback.thinkingReview !== null &&
        Array.isArray(feedback.thinkingReview.coveredPoints) &&
        feedback.thinkingReview.coveredPoints.every(isNonEmptyString) &&
        (
          feedback.thinkingReview.primaryGapRequirementId === undefined ||
          isNonEmptyString(feedback.thinkingReview.primaryGapRequirementId)
        ) &&
        (feedback.thinkingReview.primaryGap === undefined || isNonEmptyString(feedback.thinkingReview.primaryGap)) &&
        Array.isArray(feedback.thinkingReview.missingPoints) &&
        feedback.thinkingReview.missingPoints.every(isNonEmptyString) &&
        (
          feedback.thinkingReview.requirementCoverage === undefined ||
          (
            Array.isArray(feedback.thinkingReview.requirementCoverage) &&
            feedback.thinkingReview.requirementCoverage.every(isTaskRequirementCoverage)
          )
        )
      )
    ) &&
    (
      feedback.guidance === undefined ||
      (
        typeof feedback.guidance === 'object' &&
        feedback.guidance !== null &&
        (feedback.guidance.understandingNotice === undefined || isNonEmptyString(feedback.guidance.understandingNotice)) &&
        Array.isArray(feedback.guidance.detailsToReview) &&
        feedback.guidance.detailsToReview.every(isNonEmptyString) &&
        Array.isArray(feedback.guidance.revisionActions) &&
        feedback.guidance.revisionActions.every(isNonEmptyString)
      )
    ) &&
    typeof feedback.canRetry === 'boolean' &&
    typeof feedback.canFinishRound === 'boolean' &&
    ['task_execution', 'evidence_return', 'learning_round'].includes(feedback.source)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTaskRequirementCoverage(value: unknown): value is TaskRequirementCoverage {
  if (!value || typeof value !== 'object') return false;
  const coverage = value as TaskRequirementCoverage;
  return (
    isNonEmptyString(coverage.requirementId) &&
    ['conclusion', 'text_evidence', 'reasoning_relation', 'expression'].includes(coverage.requirementType) &&
    isNonEmptyString(coverage.requirementText) &&
    typeof coverage.required === 'boolean' &&
    ['covered', 'partially_covered', 'missing', 'insufficient_to_judge'].includes(coverage.status) &&
    Array.isArray(coverage.studentEvidence) &&
    coverage.studentEvidence.every(isNonEmptyString) &&
    Array.isArray(coverage.taskEvidence) &&
    coverage.taskEvidence.every(isNonEmptyString) &&
    ['formal_diagnosis', 'ability_evidence', 'rubric', 'task_requirement'].includes(coverage.source) &&
    (coverage.studentMessage === undefined || isNonEmptyString(coverage.studentMessage)) &&
    (coverage.gapMessage === undefined || isNonEmptyString(coverage.gapMessage)) &&
    (coverage.gapReasonCode === undefined || [
      'conclusion_inconsistent',
      'missing_text_evidence',
      'missing_reasoning_relation',
      'incomplete_task_requirement',
      'insufficient_to_judge',
    ].includes(coverage.gapReasonCode))
  );
}
