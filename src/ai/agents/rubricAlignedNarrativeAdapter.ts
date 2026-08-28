import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { QuestionResponseFormat } from '../schemas/questionResourceAdmission.schema.ts';
import {
  containsForbiddenStudentVisibleKey,
  isStudentVisibleFeedbackGrounding,
  type StudentVisibleFeedbackGrounding,
} from '../schemas/rubricFeedbackProjection.schema.ts';
import {
  isStudentFeedbackActionPlan,
  type StudentFeedbackActionPlan,
} from '../schemas/studentFeedbackActionPlan.schema.ts';

export const RUBRIC_ALIGNED_NARRATIVE_INTEGRATION_VERSION =
  'rubric_aligned_narrative_integration_v1' as const;

export const DEFAULT_RUBRIC_ALIGNED_FEEDBACK_SURFACE_MODE = 'shadow' as const;

export type RubricAlignedFeedbackSurfaceMode =
  | 'legacy'
  | 'shadow'
  | 'student_visible';

export type RubricAlignedNarrativeContext = {
  studentId: string;
  learningRoundId: string;
  taskId: string;
  executionSessionId: string;
  responseId: string;
  questionVersionId: string;
};

export type RubricAlignedNarrativeInput = {
  integrationVersion: typeof RUBRIC_ALIGNED_NARRATIVE_INTEGRATION_VERSION;
  sourceMode: 'rubric_projection';
  context: RubricAlignedNarrativeContext;
  responseFormat: Extract<QuestionResponseFormat, 'short_text' | 'long_text'>;
  taskRole: RecommendedTaskRole;
  projectionId: string;
  grounding: StudentVisibleFeedbackGrounding;
  actionPlan: StudentFeedbackActionPlan;
};

export type RubricAlignedNarrativeGuardContext = {
  studentId: string;
  learningRoundId?: string;
  taskId?: string;
  executionSessionId?: string;
  responseId?: string;
  questionVersionId?: string;
  responseFormat?: 'text' | 'single_choice';
  taskRole?: RecommendedTaskRole;
};

export type RubricAlignedNarrativeGuardResult = {
  passed: boolean;
  issues: string[];
};

const FORBIDDEN_DISCLOSURE_PATTERN = /(?:acceptedSignals|calibrationAnswer|完整评分标准|参考答案|正确答案)/i;

export function resolveRubricAlignedFeedbackSurfaceMode(
  value?: string | null,
): RubricAlignedFeedbackSurfaceMode {
  if (value === 'legacy' || value === 'shadow' || value === 'student_visible') return value;
  return DEFAULT_RUBRIC_ALIGNED_FEEDBACK_SURFACE_MODE;
}

export function validateRubricAlignedNarrativeInput(
  input: RubricAlignedNarrativeInput | undefined,
  current: RubricAlignedNarrativeGuardContext,
): RubricAlignedNarrativeGuardResult {
  const issues: string[] = [];
  if (!input || typeof input !== 'object') return fail('rubric_narrative_input_missing');
  if (input.integrationVersion !== RUBRIC_ALIGNED_NARRATIVE_INTEGRATION_VERSION) {
    issues.push('rubric_narrative_integration_version_mismatch');
  }
  if (input.sourceMode !== 'rubric_projection') issues.push('rubric_narrative_source_mode_invalid');
  if (!isStudentVisibleFeedbackGrounding(input.grounding)) {
    issues.push('rubric_narrative_grounding_invalid');
  }
  if (!isStudentFeedbackActionPlan(input.actionPlan) || !input.actionPlan.validation.passed) {
    issues.push('rubric_narrative_action_plan_invalid');
  }
  if (containsForbiddenStudentVisibleKey(input)) {
    issues.push('rubric_narrative_forbidden_disclosure_field');
  }
  if (!['short_text', 'long_text'].includes(input.responseFormat)) {
    issues.push('rubric_narrative_response_format_invalid');
  }
  if (current.responseFormat === 'single_choice') {
    issues.push('rubric_narrative_single_choice_must_use_independent_path');
  }
  if (
    input.context.studentId !== current.studentId
    || input.actionPlan.studentId !== current.studentId
  ) issues.push('rubric_narrative_student_identity_mismatch');
  if (
    current.learningRoundId
    && (
      input.context.learningRoundId !== current.learningRoundId
      || input.actionPlan.learningRoundId !== current.learningRoundId
    )
  ) issues.push('rubric_narrative_round_identity_mismatch');
  if (current.taskId && input.context.taskId !== current.taskId) {
    issues.push('rubric_narrative_task_identity_mismatch');
  }
  if (current.responseId && input.context.responseId !== current.responseId) {
    issues.push('rubric_narrative_response_identity_mismatch');
  }
  if (
    current.executionSessionId
    && input.context.executionSessionId !== current.executionSessionId
  ) issues.push('rubric_narrative_execution_session_identity_mismatch');
  if (
    current.questionVersionId
    && input.context.questionVersionId !== current.questionVersionId
  ) issues.push('rubric_narrative_question_version_identity_mismatch');
  if (current.taskRole && input.taskRole !== current.taskRole) {
    issues.push('rubric_narrative_task_role_mismatch');
  }
  if (input.actionPlan.taskRole && input.actionPlan.taskRole !== input.taskRole) {
    issues.push('rubric_narrative_action_plan_role_mismatch');
  }
  if (input.grounding.sourceProjectionId !== input.projectionId) {
    issues.push('rubric_narrative_projection_identity_mismatch');
  }
  if (!input.actionPlan.evidenceLinks.includes(input.projectionId)) {
    issues.push('rubric_narrative_action_plan_projection_source_missing');
  }
  if (
    ['retest', 'transfer'].includes(input.taskRole)
    && (
      input.grounding.feedbackDepth !== 'result_only'
      || input.actionPlan.feedbackDepth !== 1
      || input.actionPlan.nextOperations.length > 0
    )
  ) issues.push('rubric_narrative_independent_validation_disclosure_exceeded');
  const studentVisibleText = [
    input.grounding.acknowledgedStudentAction,
    input.grounding.safeClueLocator,
    input.grounding.nextThinkingAction,
    input.actionPlan.acknowledgedAction,
    input.actionPlan.missingAnswerPart,
    input.actionPlan.thinkingPrompt,
    ...input.actionPlan.nextOperations,
  ].filter(Boolean).join('\n');
  if (FORBIDDEN_DISCLOSURE_PATTERN.test(studentVisibleText)) {
    issues.push('rubric_narrative_student_visible_disclosure_blocked');
  }
  return { passed: issues.length === 0, issues: [...new Set(issues)] };
}

function fail(issue: string): RubricAlignedNarrativeGuardResult {
  return { passed: false, issues: [issue] };
}
