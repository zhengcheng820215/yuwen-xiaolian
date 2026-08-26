import type { RevisionEvaluation } from '../schemas/learningFeedbackRevision.schema.ts';
import type { StudentFeedbackActionPlan } from '../schemas/studentFeedbackActionPlan.schema.ts';
import type {
  StudentLearningFeedback,
  TaskRequirementCoverage,
} from '../schemas/studentLearningFeedback.schema.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_EXPRESSION_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION,
  buildConvergenceFeedbackProjectionIdentity,
  validateConvergenceFeedbackPresentation,
  type ConvergenceFeedbackActionProjection,
  type ConvergenceFeedbackDisplayBlock,
  type ConvergenceFeedbackFocusKind,
  type ConvergenceFeedbackFocusReasonCode,
  type ConvergenceFeedbackPresentation,
  type ConvergenceFeedbackSourceRef,
} from '../schemas/productComplexityConvergenceFeedbackProjection.schema.ts';

export type ConvergenceFeedbackRuntimeActions = {
  canContinue: boolean;
  canReviseOnce: boolean;
  canRetryAnalysis: boolean;
  canRecoverSavedState: boolean;
  continueLabel?: string;
  reviseLabel?: string;
};

export type ConvergenceFeedbackProjectionInput = {
  feedback: StudentLearningFeedback;
  feedbackId: string;
  learningTaskAttemptId?: string;
  formalDiagnosisId?: string;
  actionPlan?: StudentFeedbackActionPlan;
  runtimeActions: ConvergenceFeedbackRuntimeActions;
};

export type ConvergenceRevisionFeedbackProjectionInput = {
  studentId: string;
  learningRoundId: string;
  feedbackId: string;
  learningTaskAttemptId?: string;
  revisionEvaluation: RevisionEvaluation;
  runtimeActions: ConvergenceFeedbackRuntimeActions;
};

const INTERNAL_LANGUAGE = /\b(?:Diagnosis|Evidence|Profile|Policy|Hash|Confidence|Scheduler|Pipeline)\b|正式诊断|证据准入|能力画像|置信度|策略版本|调度器|内部代码/i;
const GENERIC_ACTION = /^(?:继续努力|认真审题|加强理解|深入思考|注意逻辑关系|提升.+能力)[。！]?$|进一步(?:提高|提升|加强)/;

export function projectConvergenceLearningFeedback(
  input: ConvergenceFeedbackProjectionInput,
): ConvergenceFeedbackPresentation {
  const identityAligned = input.feedback.studentId === input.actionPlan?.studentId || !input.actionPlan;
  const roundAligned = input.feedback.learningRoundId === input.actionPlan?.learningRoundId || !input.actionPlan;
  if (!identityAligned || !roundAligned) {
    return fallbackProjection(input, 'feedback_identity_mismatch', ['feedback_identity_mismatch']);
  }
  if (['blocked', 'retry_required'].includes(input.feedback.resultStatus)) {
    return recoveryProjection(input);
  }

  const requiredCoverage = (input.feedback.thinkingReview?.requirementCoverage || [])
    .filter((coverage) => coverage.required);
  if (requiredCoverage.length > 0 && requiredCoverage.every((coverage) => coverage.status === 'covered')) {
    return buildProjection(input, {
      focusKind: 'confirmed_understanding',
      focusReasonCode: 'answer_meets_current_requirement',
      blocks: confirmationBlocks(input, requiredCoverage),
    });
  }

  const primaryGap = resolvePrimaryGap(input.feedback, requiredCoverage);
  if (primaryGap.ambiguous) {
    return fallbackProjection(input, 'structured_focus_unavailable', ['structured_primary_gap_ambiguous']);
  }
  if (primaryGap.coverage) {
    const coverage = primaryGap.coverage;
    const acknowledgement = resolveAcknowledgement(input.feedback, requiredCoverage, coverage.requirementId);
    const gapText = resolveGapText(input, coverage);
    const nextAction = resolveNextAction(input, coverage);
    if (!gapText) return fallbackProjection(input, 'structured_focus_unavailable', ['primary_gap_text_missing']);
    return buildProjection(input, {
      focusKind: coverage.status === 'insufficient_to_judge'
        ? 'insufficient_to_judge'
        : 'primary_actionable_gap',
      focusReasonCode: coverage.status === 'partially_covered'
        ? 'partial_required_gap_selected'
        : coverage.status === 'insufficient_to_judge'
          ? 'formal_result_insufficient'
          : 'required_gap_selected',
      primaryRequirementId: coverage.status === 'insufficient_to_judge' ? undefined : coverage.requirementId,
      blocks: [
        acknowledgement ? block('acknowledgement', acknowledgement, [coverage.requirementId]) : undefined,
        block('primary_gap', gapText, [coverage.requirementId]),
        nextAction ? block('next_action', nextAction, actionSourceIds(input, coverage)) : undefined,
      ].filter((item): item is ConvergenceFeedbackDisplayBlock => Boolean(item)),
    });
  }

  // 历史自由文本反馈没有 Requirement Coverage，不能由阶段 3 反向猜测
  // “已经做到”或新的 Gap；保留既有展示才是可审计的兼容路径。
  return fallbackProjection(input, 'structured_focus_unavailable', ['structured_primary_gap_unavailable']);
}

export function projectConvergenceRevisionFeedback(
  input: ConvergenceRevisionFeedbackProjectionInput,
): ConvergenceFeedbackPresentation {
  const evaluation = input.revisionEvaluation;
  let reasonCode: ConvergenceFeedbackFocusReasonCode = 'revision_gap_unresolved';
  if (evaluation.outcome === 'improved') reasonCode = 'revision_gap_resolved';
  else if (evaluation.outcome === 'partially_improved') reasonCode = 'revision_gap_partially_resolved';
  const acknowledgement = safeStudentText(evaluation.improvedObservation)
    || revisionOutcomeAcknowledgement(evaluation.outcome);
  const remaining = evaluation.outcome === 'improved'
    ? undefined
    : safeStudentText(evaluation.remainingFocus);
  const nextAction = safeExecutableAction(evaluation.nextSimilarTaskAction);
  const sourceRefs: ConvergenceFeedbackSourceRef[] = [{
    sourceType: 'revision_evaluation',
    sourceId: evaluation.revisionEvaluationId,
    sourceSchemaVersion: evaluation.schemaVersion,
  }];
  const actions = runtimeActionProjections(input.runtimeActions);
  return finalize({
    studentId: input.studentId,
    learningRoundId: input.learningRoundId,
    feedbackId: input.feedbackId,
    learningTaskAttemptId: input.learningTaskAttemptId,
    focusKind: 'revision_change',
    focusReasonCode: reasonCode,
    sourceRefs,
    blocks: [
      block('acknowledgement', acknowledgement, [evaluation.revisionEvaluationId]),
      remaining ? block('primary_gap', remaining, [evaluation.revisionEvaluationId]) : undefined,
      nextAction ? block('next_action', nextAction, [evaluation.revisionEvaluationId]) : undefined,
    ].filter((item): item is ConvergenceFeedbackDisplayBlock => Boolean(item)),
    actions,
    fallbackUsed: false,
    identityAligned: true,
    extraIssues: [],
  });
}

function buildProjection(
  input: ConvergenceFeedbackProjectionInput,
  selection: {
    focusKind: ConvergenceFeedbackFocusKind;
    focusReasonCode: ConvergenceFeedbackFocusReasonCode;
    primaryRequirementId?: string;
    blocks: ConvergenceFeedbackDisplayBlock[];
  },
): ConvergenceFeedbackPresentation {
  const sourceRefs: ConvergenceFeedbackSourceRef[] = [{
    sourceType: 'student_learning_feedback',
    sourceId: input.feedbackId,
  }];
  if (input.formalDiagnosisId) {
    sourceRefs.push({ sourceType: 'formal_diagnosis', sourceId: input.formalDiagnosisId });
  }
  if (selection.primaryRequirementId) {
    sourceRefs.push({ sourceType: 'requirement_coverage', sourceId: selection.primaryRequirementId });
  }
  if (input.actionPlan?.validation.passed) {
    sourceRefs.push({
      sourceType: 'feedback_action_plan',
      sourceId: `${input.actionPlan.studentId}:${input.actionPlan.learningRoundId}:${input.actionPlan.sourceGapId || 'no-gap'}`,
      sourceSchemaVersion: input.actionPlan.schemaVersion,
    });
  }
  return finalize({
    studentId: input.feedback.studentId,
    learningRoundId: input.feedback.learningRoundId,
    feedbackId: input.feedbackId,
    learningTaskAttemptId: input.learningTaskAttemptId,
    ...selection,
    sourceRefs,
    actions: runtimeActionProjections(input.runtimeActions),
    fallbackUsed: false,
    identityAligned: true,
    extraIssues: [],
  });
}

function recoveryProjection(input: ConvergenceFeedbackProjectionInput): ConvergenceFeedbackPresentation {
  const recoveryText = input.runtimeActions.canRetryAnalysis
    ? '本次回答已经保留。分析完成前不评价这次表现，可以稍后重新分析。'
    : '本次回答已经保留。当前处理暂未完成，可以稍后继续。';
  return finalize({
    studentId: input.feedback.studentId,
    learningRoundId: input.feedback.learningRoundId,
    feedbackId: input.feedbackId,
    learningTaskAttemptId: input.learningTaskAttemptId,
    focusKind: 'recovery_only',
    focusReasonCode: 'runtime_recovery_required',
    sourceRefs: [{ sourceType: 'student_learning_feedback', sourceId: input.feedbackId }],
    blocks: [block('recovery', recoveryText, [input.feedbackId])],
    actions: runtimeActionProjections(input.runtimeActions),
    fallbackUsed: false,
    identityAligned: true,
    extraIssues: [],
  });
}

function fallbackProjection(
  input: ConvergenceFeedbackProjectionInput,
  reasonCode: ConvergenceFeedbackFocusReasonCode,
  issues: string[],
): ConvergenceFeedbackPresentation {
  return finalize({
    studentId: input.feedback.studentId,
    learningRoundId: input.feedback.learningRoundId,
    feedbackId: input.feedbackId,
    learningTaskAttemptId: input.learningTaskAttemptId,
    focusKind: reasonCode === 'feedback_identity_mismatch'
      ? 'insufficient_to_judge'
      : 'insufficient_to_judge',
    focusReasonCode: reasonCode,
    sourceRefs: [{ sourceType: 'student_learning_feedback', sourceId: input.feedbackId }],
    blocks: [],
    actions: runtimeActionProjections(input.runtimeActions),
    fallbackUsed: true,
    identityAligned: reasonCode !== 'feedback_identity_mismatch',
    extraIssues: issues,
  });
}

function finalize(input: {
  studentId: string;
  learningRoundId: string;
  feedbackId: string;
  learningTaskAttemptId?: string;
  focusKind: ConvergenceFeedbackFocusKind;
  focusReasonCode: ConvergenceFeedbackFocusReasonCode;
  primaryRequirementId?: string;
  sourceRefs: ConvergenceFeedbackSourceRef[];
  blocks: ConvergenceFeedbackDisplayBlock[];
  actions: ConvergenceFeedbackActionProjection[];
  fallbackUsed: boolean;
  identityAligned: boolean;
  extraIssues: string[];
}): ConvergenceFeedbackPresentation {
  const studentSafe = input.blocks.every((item) => !INTERNAL_LANGUAGE.test(item.text));
  const grounded = input.blocks.every((item) => item.sourceRefIds.length > 0);
  const actionAligned = input.actions.every((action) => action.existingCommand.length > 0);
  const singleFocus = input.blocks.filter((item) => item.kind === 'primary_gap').length <= 1;
  const identity = buildConvergenceFeedbackProjectionIdentity({
    studentId: input.studentId,
    learningRoundId: input.learningRoundId,
    feedbackId: input.feedbackId,
    stableInput: {
      studentId: input.studentId,
      learningRoundId: input.learningRoundId,
      feedbackId: input.feedbackId,
      learningTaskAttemptId: input.learningTaskAttemptId || null,
      focusKind: input.focusKind,
      focusReasonCode: input.focusReasonCode,
      primaryRequirementId: input.primaryRequirementId || null,
      sourceRefs: input.sourceRefs,
      blocks: input.blocks,
      actions: input.actions,
      fallbackUsed: input.fallbackUsed,
    },
  });
  const base = {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION,
    expressionPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_EXPRESSION_POLICY_VERSION,
    ...identity,
    persistenceRole: 'presentation_projection' as const,
    studentId: input.studentId,
    learningRoundId: input.learningRoundId,
    ...(input.learningTaskAttemptId ? { learningTaskAttemptId: input.learningTaskAttemptId } : {}),
    feedbackId: input.feedbackId,
    focusKind: input.focusKind,
    focusReasonCode: input.focusReasonCode,
    ...(input.primaryRequirementId ? { primaryRequirementId: input.primaryRequirementId } : {}),
    sourceRefs: input.sourceRefs,
    blocks: input.blocks,
    actions: input.actions,
    fallbackUsed: input.fallbackUsed,
  };
  const structuralIssues = validateConvergenceFeedbackPresentation({
    ...base,
    validation: {
      passed: true,
      identityAligned: input.identityAligned,
      grounded,
      singleFocus,
      actionAligned,
      studentSafe,
      issues: [],
    },
  });
  const issues = unique([
    ...input.extraIssues,
    ...structuralIssues,
    ...(!input.identityAligned ? ['identity_not_aligned'] : []),
    ...(!grounded ? ['feedback_block_not_grounded'] : []),
    ...(!singleFocus ? ['multiple_feedback_focus'] : []),
    ...(!actionAligned ? ['feedback_action_not_aligned'] : []),
    ...(!studentSafe ? ['feedback_internal_language_detected'] : []),
  ]);
  const passed = structuralIssues.length === 0 && grounded && singleFocus && actionAligned && studentSafe
    && (input.identityAligned || input.fallbackUsed);
  return {
    ...base,
    validation: {
      passed,
      identityAligned: input.identityAligned,
      grounded,
      singleFocus,
      actionAligned,
      studentSafe,
      issues,
    },
  };
}

function resolvePrimaryGap(
  feedback: StudentLearningFeedback,
  requiredCoverage: TaskRequirementCoverage[],
): { coverage?: TaskRequirementCoverage; ambiguous: boolean } {
  const explicitId = feedback.thinkingReview?.primaryGapRequirementId;
  if (explicitId) {
    const explicit = requiredCoverage.find((coverage) => coverage.requirementId === explicitId);
    return explicit ? { coverage: explicit, ambiguous: false } : { ambiguous: true };
  }
  const gaps = requiredCoverage.filter((coverage) => coverage.status !== 'covered');
  return gaps.length === 1 ? { coverage: gaps[0], ambiguous: false } : { ambiguous: gaps.length > 1 };
}

function confirmationBlocks(
  input: ConvergenceFeedbackProjectionInput,
  coverage: TaskRequirementCoverage[],
): ConvergenceFeedbackDisplayBlock[] {
  const acknowledgement = resolveAcknowledgement(input.feedback, coverage);
  return [block(
    'acknowledgement',
    acknowledgement || '这次回答完成了当前题目的主要要求。',
    [coverage[0]?.requirementId || input.feedbackId],
  )];
}

function resolveAcknowledgement(
  feedback: StudentLearningFeedback,
  coverage: TaskRequirementCoverage[],
  excludedRequirementId?: string,
): string | undefined {
  const covered = coverage.find((item) => item.status === 'covered' && item.requirementId !== excludedRequirementId);
  const value = covered?.studentMessage || feedback.whatYouDidWell[0];
  return safeStudentText(value);
}

function resolveGapText(
  input: ConvergenceFeedbackProjectionInput,
  coverage: TaskRequirementCoverage,
): string | undefined {
  return safeStudentText(coverage.gapMessage)
    || safeStudentText(input.feedback.thinkingReview?.primaryGap)
    || safeStudentText(input.feedback.whatNeedsAttention[0]);
}

function resolveNextAction(
  input: ConvergenceFeedbackProjectionInput,
  coverage: TaskRequirementCoverage,
): string | undefined {
  if (input.runtimeActions.canReviseOnce && input.actionPlan?.validation.passed) {
    const planAction = input.actionPlan.nextOperations.find(safeExecutableAction)
      || safeExecutableAction(input.actionPlan.scaffoldTemplate);
    if (planAction) return planAction;
  }
  const guidanceAction = input.feedback.guidance?.revisionActions.find(safeExecutableAction);
  return guidanceAction || safeExecutableAction(input.feedback.nextActionText)
    || requirementAction(coverage);
}

function requirementAction(coverage: TaskRequirementCoverage): string | undefined {
  if (coverage.status === 'insufficient_to_judge') return '检查回答是否已经回应题目，再补充一个清楚的判断。';
  if (coverage.requirementType === 'text_evidence') return '回到材料找到能直接支持判断的内容，再把它补进回答。';
  if (coverage.requirementType === 'reasoning_relation') return '保留已有依据，再补一句它为什么能支持你的判断。';
  if (coverage.requirementType === 'conclusion') return '回到题目要求，先写清楚你的判断。';
  if (coverage.requirementType === 'expression') return '保留已经答对的内容，再按题目要求整理表达。';
  return undefined;
}

function runtimeActionProjections(
  runtime: ConvergenceFeedbackRuntimeActions,
): ConvergenceFeedbackActionProjection[] {
  const actions: ConvergenceFeedbackActionProjection[] = [];
  if (runtime.canContinue) actions.push({
    kind: 'continue', label: runtime.continueLabel || '继续', existingCommand: 'continue_after_feedback', enabled: true,
  });
  if (runtime.canReviseOnce) actions.push({
    kind: 'revise_once', label: runtime.reviseLabel || '根据反馈修订', existingCommand: 'start_feedback_revision', enabled: true,
  });
  if (runtime.canRetryAnalysis) actions.push({
    kind: 'retry_analysis', label: '重新分析', existingCommand: 'resume_analysis', enabled: true,
  });
  if (runtime.canRecoverSavedState) actions.push({
    kind: 'recover_saved_state', label: '继续处理', existingCommand: 'recover_saved_state', enabled: true,
  });
  return actions;
}

function block(
  kind: ConvergenceFeedbackDisplayBlock['kind'],
  text: string,
  sourceRefIds: string[],
): ConvergenceFeedbackDisplayBlock {
  return { kind, text: text.trim(), sourceRefIds: unique(sourceRefIds.filter(Boolean)) };
}

function actionSourceIds(
  input: ConvergenceFeedbackProjectionInput,
  coverage: TaskRequirementCoverage,
): string[] {
  return input.actionPlan?.validation.passed
    ? [input.actionPlan.sourceGapId || coverage.requirementId]
    : [coverage.requirementId];
}

function safeStudentText(value?: string): string | undefined {
  const text = value?.trim().replace(/\s+/g, ' ');
  if (!text || INTERNAL_LANGUAGE.test(text)) return undefined;
  return text;
}

function safeExecutableAction(value?: string): string | undefined {
  const text = safeStudentText(value);
  if (!text || GENERIC_ACTION.test(text)) return undefined;
  return /(?:回到|找到|找出|保留|补充|说明|写出|核对|对照|判断|检查|整理|结合|选择)/.test(text)
    ? text
    : undefined;
}

function revisionOutcomeAcknowledgement(outcome: RevisionEvaluation['outcome']): string {
  if (outcome === 'improved') return '这次修改补上了反馈指出的主要内容。';
  if (outcome === 'partially_improved') return '这次修改已经补充了一部分关键内容。';
  if (outcome === 'regressed') return '这次修改影响了原来答对的内容。';
  return '这次修改还没有补上反馈指出的关键内容。';
}

function unique(values: string[]): string[] { return [...new Set(values)]; }
