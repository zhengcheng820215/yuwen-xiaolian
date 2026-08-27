import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { QuestionResponseFormat } from '../schemas/questionResourceAdmission.schema.ts';
import {
  STUDENT_VISIBLE_FEEDBACK_GROUNDING_SCHEMA_VERSION,
  containsForbiddenStudentVisibleKey,
  isRubricFeedbackProjection,
  isStudentVisibleFeedbackGrounding,
  type RubricFeedbackProjection,
  type RubricFeedbackProjectionItem,
  type StudentVisibleFeedbackGrounding,
} from '../schemas/rubricFeedbackProjection.schema.ts';

export const RUBRIC_ALIGNED_FEEDBACK_STAGE2_VERSION =
  'rubric_aligned_feedback_stage2_v1' as const;

export const RUBRIC_FEEDBACK_GROUNDING_ADAPTER_ISSUE_CODES = [
  'single_choice_uses_independent_feedback_contract',
  'response_format_not_supported',
  'projection_not_ready',
  'projection_schema_invalid',
  'projection_context_identity_mismatch',
  'projection_primary_item_invalid',
  'verified_student_evidence_missing',
  'safe_clue_not_authorized',
  'feedback_depth_downgraded',
  'student_visible_grounding_disclosure_blocked',
  'student_visible_grounding_schema_invalid',
] as const;

export type RubricFeedbackGroundingAdapterIssueCode =
  typeof RUBRIC_FEEDBACK_GROUNDING_ADAPTER_ISSUE_CODES[number];

export type RubricFeedbackGroundingAdapterIssue = {
  code: RubricFeedbackGroundingAdapterIssueCode;
  severity: 'info' | 'warning' | 'error';
  evidencePaths: string[];
};

export type RubricFeedbackGroundingAdapterInput = {
  projection: RubricFeedbackProjection;
  context: {
    studentId: string;
    learningRoundId: string;
    taskId: string;
    executionSessionId: string;
    responseId: string;
    questionVersionId: string;
  };
  responseFormat: QuestionResponseFormat;
  taskRole: RecommendedTaskRole;
  verifiedStudentEvidenceByRef: Record<string, string>;
  safeClueLocatorByRequirementId?: Record<string, string>;
  feedbackDepth: StudentVisibleFeedbackGrounding['feedbackDepth'];
};

export type RubricFeedbackGroundingAdapterResult = {
  stageVersion: typeof RUBRIC_ALIGNED_FEEDBACK_STAGE2_VERSION;
  outcome: 'grounded' | 'fallback' | 'single_choice_passthrough';
  grounding?: StudentVisibleFeedbackGrounding;
  issues: RubricFeedbackGroundingAdapterIssue[];
};

const UNSAFE_CLUE_PATTERN = /(?:答案|正确|应当|应该|说明了|体现了|表现出|从而|因此|可见|结论是)/;

export function buildStudentVisibleFeedbackGroundingFromProjection(
  input: RubricFeedbackGroundingAdapterInput,
): RubricFeedbackGroundingAdapterResult {
  const issues: RubricFeedbackGroundingAdapterIssue[] = [];
  if (input.responseFormat === 'single_choice') {
    issues.push(issue(
      'single_choice_uses_independent_feedback_contract',
      'info',
      ['responseFormat'],
    ));
    return result('single_choice_passthrough', issues);
  }
  if (!['short_text', 'long_text'].includes(input.responseFormat)) {
    issues.push(issue('response_format_not_supported', 'warning', ['responseFormat']));
    return result('fallback', issues);
  }
  if (!isRubricFeedbackProjection(input.projection)) {
    issues.push(issue('projection_schema_invalid', 'error', ['projection']));
    return result('fallback', issues);
  }
  if (input.projection.projectionStatus !== 'ready') {
    issues.push(issue('projection_not_ready', 'warning', ['projection.projectionStatus']));
    return result('fallback', issues);
  }
  if (!contextAligned(input)) {
    issues.push(issue(
      'projection_context_identity_mismatch',
      'error',
      ['context', 'projection.items.sourceLinks'],
    ));
    return result('fallback', issues);
  }

  const primary = findPrimary(input.projection);
  if (input.projection.primaryItemId && !primary) {
    issues.push(issue(
      'projection_primary_item_invalid',
      'error',
      ['projection.primaryItemId'],
    ));
    return result('fallback', issues);
  }

  const acknowledged = selectAcknowledgedAction(input, primary, issues);
  if (acknowledged.blocked) return result('fallback', issues);
  const feedbackDepth = selectFeedbackDepth(input, primary, issues);
  const safeClueLocator = primary
    ? resolveSafeClue(input, primary, issues)
    : undefined;
  const grounding: StudentVisibleFeedbackGrounding = {
    groundingVersion: STUDENT_VISIBLE_FEEDBACK_GROUNDING_SCHEMA_VERSION,
    acknowledgedStudentAction: acknowledged.text,
    primaryObservedGap: primary?.observedGap,
    safeClueLocator,
    nextThinkingAction: primary?.nextThinkingAction,
    feedbackDepth,
    sourceProjectionId: input.projection.projectionId,
  };

  if (unsafeSemanticCombination(grounding) || containsForbiddenStudentVisibleKey(grounding)) {
    issues.push(issue(
      'student_visible_grounding_disclosure_blocked',
      'error',
      ['grounding'],
    ));
    return result('fallback', issues);
  }
  if (!isStudentVisibleFeedbackGrounding(grounding)) {
    issues.push(issue(
      'student_visible_grounding_schema_invalid',
      'error',
      ['grounding'],
    ));
    return result('fallback', issues);
  }
  return result('grounded', issues, grounding);
}

function contextAligned(input: RubricFeedbackGroundingAdapterInput): boolean {
  if (input.projection.questionVersionId !== input.context.questionVersionId) return false;
  return input.projection.items.every((item) => (
    item.sourceLinks.questionVersionId === input.context.questionVersionId
    && item.sourceLinks.responseId === input.context.responseId
    && item.sourceLinks.taskId === input.context.taskId
    && item.sourceLinks.learningRoundId === input.context.learningRoundId
    && item.sourceLinks.executionSessionId === input.context.executionSessionId
  ));
}

function findPrimary(projection: RubricFeedbackProjection): RubricFeedbackProjectionItem | undefined {
  if (!projection.primaryItemId) return undefined;
  const primary = projection.items.find((item) => item.rubricItemId === projection.primaryItemId);
  if (!primary || !['partially_achieved', 'missing'].includes(primary.coverageStatus)) {
    return undefined;
  }
  return primary;
}

function selectAcknowledgedAction(
  input: RubricFeedbackGroundingAdapterInput,
  primary: RubricFeedbackProjectionItem | undefined,
  issues: RubricFeedbackGroundingAdapterIssue[],
): { text?: string; blocked: boolean } {
  const ordered = primary
    ? [primary, ...input.projection.items.filter((item) => item.rubricItemId !== primary.rubricItemId)]
    : input.projection.items;
  for (const item of ordered) {
    if (!['achieved', 'partially_achieved'].includes(item.coverageStatus)) continue;
    for (const reference of item.studentEvidenceRefs) {
      const evidence = input.verifiedStudentEvidenceByRef[reference]?.trim();
      if (!evidence) continue;
      return { text: `你已经写出了“${short(evidence, 36)}”。`, blocked: false };
    }
    issues.push(issue(
      'verified_student_evidence_missing',
      'warning',
      item.studentEvidenceRefs.map((reference) => `verifiedStudentEvidenceByRef.${reference}`),
    ));
    return { blocked: true };
  }
  return { blocked: false };
}

function selectFeedbackDepth(
  input: RubricFeedbackGroundingAdapterInput,
  primary: RubricFeedbackProjectionItem | undefined,
  issues: RubricFeedbackGroundingAdapterIssue[],
): StudentVisibleFeedbackGrounding['feedbackDepth'] {
  if (!primary) return 'result_only';
  if (['retest', 'transfer'].includes(input.taskRole)) return 'result_only';
  if (input.feedbackDepth === 'scaffold') {
    issues.push(issue('feedback_depth_downgraded', 'info', ['feedbackDepth']));
    return 'thinking_prompt';
  }
  return input.feedbackDepth === 'result_only' ? 'thinking_prompt' : input.feedbackDepth;
}

function resolveSafeClue(
  input: RubricFeedbackGroundingAdapterInput,
  primary: RubricFeedbackProjectionItem,
  issues: RubricFeedbackGroundingAdapterIssue[],
): string | undefined {
  if (['retest', 'transfer'].includes(input.taskRole) || !primary.requirementId) return undefined;
  const clue = input.safeClueLocatorByRequirementId?.[primary.requirementId]?.trim();
  if (!clue) return undefined;
  if (clue.length > 48 || UNSAFE_CLUE_PATTERN.test(clue)) {
    issues.push(issue(
      'safe_clue_not_authorized',
      'warning',
      [`safeClueLocatorByRequirementId.${primary.requirementId}`],
    ));
    return undefined;
  }
  return clue;
}

function unsafeSemanticCombination(grounding: StudentVisibleFeedbackGrounding): boolean {
  const combined = [
    grounding.acknowledgedStudentAction,
    grounding.safeClueLocator,
    grounding.nextThinkingAction,
  ].filter(Boolean).join(' ');
  if (!combined) return false;
  const givesConclusion = /(?:答案是|结论是|应当指出|应该指出)/.test(combined);
  const givesEvidence = /(?:依据是|原文写道|文中明确写)/.test(combined);
  const givesRelation = /(?:这说明|这体现|这表现|从而说明)/.test(combined);
  return givesConclusion && givesEvidence && givesRelation;
}

function short(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, ' ').replace(/[。！？!?]$/, '').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function issue(
  code: RubricFeedbackGroundingAdapterIssueCode,
  severity: RubricFeedbackGroundingAdapterIssue['severity'],
  evidencePaths: string[],
): RubricFeedbackGroundingAdapterIssue {
  return { code, severity, evidencePaths };
}

function result(
  outcome: RubricFeedbackGroundingAdapterResult['outcome'],
  issues: RubricFeedbackGroundingAdapterIssue[],
  grounding?: StudentVisibleFeedbackGrounding,
): RubricFeedbackGroundingAdapterResult {
  return {
    stageVersion: RUBRIC_ALIGNED_FEEDBACK_STAGE2_VERSION,
    outcome,
    grounding,
    issues,
  };
}
