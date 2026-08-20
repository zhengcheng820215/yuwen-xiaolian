import { createGrowthMemoryRecord } from './growthMemoryRecordAgent.ts';
import {
  buildFeedbackSupportedRevisionEvidenceId,
  buildRevisionEvaluationId,
  buildRevisionProfileDecisionId,
  buildRevisionProfileEvaluationId,
} from './learningFeedbackRevisionIdentity.ts';
import { applyProfileUpdateDecision } from './profileUpdateExecutor.ts';
import type { DiagnosisResult, OpenResponseAnswerStatus } from '../schemas/diagnosis.schema.ts';
import type { EvaluationResult } from '../schemas/evaluationResult.schema.ts';
import {
  FEEDBACK_SUPPORTED_REVISION_EVIDENCE_SCHEMA_VERSION,
  REVISION_EVALUATION_SCHEMA_VERSION,
  type FeedbackSupportedRevisionEvidence,
  type RevisionEvaluation,
  type RevisionGoal,
  type RevisionOutcome,
} from '../schemas/learningFeedbackRevision.schema.ts';
import type { GrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import type { ProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';

export const LEARNING_FEEDBACK_REVISION_EVALUATION_POLICY_VERSION =
  'learning_feedback_revision_evaluation_policy_v2' as const;

export type LearningFeedbackRevisionEvaluationInput = {
  revisionId: string;
  studentId: string;
  taskId: string;
  abilityId: string;
  abilityLabel?: string;
  resourceVersionId: string;
  rubricVersion: string;
  initialAnswer: string;
  revisedAnswer: string;
  revisionGoal: RevisionGoal;
  initialDiagnosisId: string;
  initialDiagnosis: DiagnosisResult;
  revisedDiagnosisId: string;
  revisedDiagnosisSchemaVersion: string;
  revisedDiagnosis: DiagnosisResult;
  currentProfile: StudentAbilityProfile;
  evaluatedAt?: string;
};

export type LearningFeedbackRevisionEvaluationBundle = {
  evaluation: RevisionEvaluation;
  feedbackSupportedEvidence: FeedbackSupportedRevisionEvidence;
  profileUpdateDecision: ProfileUpdateDecision;
  profileAfterRevision: StudentAbilityProfile;
  growthMemoryRecord: GrowthMemoryRecord;
};

export function evaluateLearningFeedbackRevision(
  input: LearningFeedbackRevisionEvaluationInput,
): LearningFeedbackRevisionEvaluationBundle {
  validateIdentity(input);
  const evaluatedAt = input.evaluatedAt || new Date().toISOString();
  const goalCodes = unique([
    input.revisionGoal.primaryIssueCode,
    ...input.revisionGoal.relatedIssueCodes,
  ]);
  const initialRank = answerStatusRank(input.initialDiagnosis.answerStatus);
  const revisedRank = answerStatusRank(input.revisedDiagnosis.answerStatus);
  const initialMissing = unique(input.initialDiagnosis.missingRubricItems || []);
  const revisedMissing = unique(input.revisedDiagnosis.missingRubricItems || []);
  const newDiagnosisIssues = revisedMissing.filter((item) => !initialMissing.includes(item));
  const resolvedDiagnosisCount = initialMissing.filter((item) => !revisedMissing.includes(item)).length;
  const substantiveChange = hasSubstantiveChange(input.initialAnswer, input.revisedAnswer);
  const outcome = decideOutcome({
    initialRank,
    revisedRank,
    initialMissingCount: initialMissing.length,
    revisedMissingCount: revisedMissing.length,
    newIssueCount: newDiagnosisIssues.length,
  });
  const feedbackRespondedTo = substantiveChange
    && outcome !== 'regressed'
    && (revisedRank > initialRank || resolvedDiagnosisCount > 0 || outcome === 'improved');
  const resolvedCount = outcome === 'improved'
    ? goalCodes.length
    : outcome === 'partially_improved'
      ? Math.max(1, Math.min(goalCodes.length, resolvedDiagnosisCount || 1))
      : 0;
  const resolvedIssueCodes = goalCodes.slice(0, resolvedCount);
  const remainingIssueCodes = goalCodes.filter((code) => !resolvedIssueCodes.includes(code));
  const newIssueCodes = newDiagnosisIssues.length
    ? newDiagnosisIssues
    : outcome === 'regressed'
      ? ['revision_regression']
      : [];
  const revisionEvaluationId = buildRevisionEvaluationId({
    revisionId: input.revisionId,
    policyVersion: LEARNING_FEEDBACK_REVISION_EVALUATION_POLICY_VERSION,
  });
  const improvedObservation = buildObservation(input, outcome);
  const nextSimilarTaskAction = buildNextAction(input, outcome);
  const evaluation: RevisionEvaluation = {
    schemaVersion: REVISION_EVALUATION_SCHEMA_VERSION,
    revisionEvaluationId,
    revisionId: input.revisionId,
    outcome,
    feedbackRespondedTo,
    resolvedIssueCodes,
    remainingIssueCodes,
    newIssueCodes,
    improvedObservation,
    remainingFocus: remainingIssueCodes.length || newIssueCodes.length
      ? compact(input.revisedDiagnosis.nextTraining || input.revisedDiagnosis.rootCause, 120)
      : undefined,
    nextSimilarTaskAction,
    evaluatedAt,
    policyVersion: LEARNING_FEEDBACK_REVISION_EVALUATION_POLICY_VERSION,
    initialDiagnosisId: input.initialDiagnosisId,
    revisedDiagnosisId: input.revisedDiagnosisId,
    revisedDiagnosisSchemaVersion: input.revisedDiagnosisSchemaVersion,
    resourceVersionId: input.resourceVersionId,
    rubricVersion: input.rubricVersion,
  };
  const evidenceId = buildFeedbackSupportedRevisionEvidenceId({
    revisionId: input.revisionId,
    revisionEvaluationId,
  });
  const confidence = Math.min(0.6, Math.max(0.3, input.revisedDiagnosis.confidence * 0.6));
  const feedbackSupportedEvidence: FeedbackSupportedRevisionEvidence = {
    schemaVersion: FEEDBACK_SUPPORTED_REVISION_EVIDENCE_SCHEMA_VERSION,
    evidenceId,
    revisionId: input.revisionId,
    revisionEvaluationId,
    studentId: input.studentId,
    taskId: input.taskId,
    abilityId: input.abilityId,
    supportLevel: 'feedback_supported',
    outcome,
    observation: improvedObservation,
    resolvedIssueCodes,
    remainingIssueCodes,
    confidence,
    requiresIndependentVerification: true,
    nextVerificationRoles: ['retest', 'transfer'],
    createdAt: evaluatedAt,
  };
  const profileEvaluation = buildProfileEvaluation(input, feedbackSupportedEvidence, evaluatedAt);
  const profileUpdateDecision = buildProfileDecision(input, feedbackSupportedEvidence, revisionEvaluationId, evaluatedAt);
  const profileExecution = applyProfileUpdateDecision({
    currentProfile: input.currentProfile,
    decision: profileUpdateDecision,
    appliedAt: evaluatedAt,
  });
  const growthMemoryRecord = createGrowthMemoryRecord({
    evaluationResult: profileEvaluation,
    profileUpdateDecision,
    beforeProfile: input.currentProfile,
    afterProfile: profileExecution.afterProfile,
    createdAt: evaluatedAt,
    sourceRuntime: 'learning_feedback_revision_evaluation_v1',
    relatedSessionId: input.revisionId,
  });
  return {
    evaluation,
    feedbackSupportedEvidence,
    profileUpdateDecision,
    profileAfterRevision: profileExecution.afterProfile,
    growthMemoryRecord,
  };
}

function decideOutcome(input: {
  initialRank: number;
  revisedRank: number;
  initialMissingCount: number;
  revisedMissingCount: number;
  newIssueCount: number;
}): RevisionOutcome {
  if (input.revisedRank < input.initialRank) return 'regressed';
  if (input.newIssueCount > 0 && input.revisedRank <= input.initialRank) return 'regressed';
  const improved = input.revisedRank > input.initialRank
    || input.revisedMissingCount < input.initialMissingCount;
  if (!improved) return 'unchanged';
  if (input.revisedRank >= answerStatusRank('fully_meets') && input.newIssueCount === 0) return 'improved';
  return 'partially_improved';
}

function buildObservation(
  input: LearningFeedbackRevisionEvaluationInput,
  outcome: RevisionOutcome,
): string {
  if (outcome === 'improved' || outcome === 'partially_improved') {
    const focus = issueFocus(input.revisionGoal.primaryIssueCode);
    return outcome === 'improved'
      ? `修订回答已经补充${focus}，主要要求已经完成。`
      : `修订回答已经补充${focus}，仍有部分要求需要完善。`;
  }
  if (outcome === 'regressed') {
    return '修订回答影响了原来已经满足的要求，需要保留正确内容后再修改。';
  }
  return '修订回答已有变化，但题目需要的关键内容仍未补充完整。';
}

function buildNextAction(
  input: LearningFeedbackRevisionEvaluationInput,
  outcome: RevisionOutcome,
): string {
  if (outcome === 'regressed') return '先保留原来答对的内容，再只修改反馈指出的部分。';
  return issueMethodReminder(input.revisionGoal.primaryIssueCode);
}

function buildProfileEvaluation(
  input: LearningFeedbackRevisionEvaluationInput,
  evidence: FeedbackSupportedRevisionEvidence,
  createdAt: string,
): EvaluationResult {
  const positive = evidence.outcome === 'improved' || evidence.outcome === 'partially_improved';
  return {
    evaluationId: buildRevisionProfileEvaluationId({
      revisionId: input.revisionId,
      revisionEvaluationId: evidence.revisionEvaluationId,
    }),
    studentId: input.studentId,
    abilityId: input.abilityId,
    abilityLabel: input.abilityLabel,
    evidenceSufficiency: 'limited',
    growthLevel: positive ? 'early_signal' : evidence.outcome === 'regressed' ? 'fluctuating' : 'unconfirmed',
    weaknessEvidenceCount: 0,
    positiveEvidenceCount: 0,
    growthEvidenceCount: positive ? 1 : 0,
    insufficientEvidenceCount: positive ? 0 : 1,
    hasIndependentRetestEvidence: false,
    hasTransferEvidence: false,
    conflictStatus: evidence.outcome === 'regressed' ? 'minor' : 'none',
    confidence: evidence.confidence,
    summary: `${evidence.observation} 该证据在明确反馈支持下形成，不能代表独立掌握。`,
    limitations: ['feedback_supported', '需要后续独立复测或迁移验证。'],
    nextAction: 'independent_retest',
    evidenceLinks: [evidence.evidenceId],
    createdAt,
  };
}

function buildProfileDecision(
  input: LearningFeedbackRevisionEvaluationInput,
  evidence: FeedbackSupportedRevisionEvidence,
  revisionEvaluationId: string,
  createdAt: string,
): ProfileUpdateDecision {
  const currentStatus = input.currentProfile.ability_status.find((item) => item.ability === input.abilityId)?.status;
  return {
    decisionId: buildRevisionProfileDecisionId({ revisionId: input.revisionId, revisionEvaluationId }),
    studentId: input.studentId,
    abilityId: input.abilityId,
    abilityLabel: input.abilityLabel,
    action: 'append_evidence_only',
    reason: '修订表现是在明确反馈支持下形成，只追加证据，不改变长期能力状态或置信度。',
    fromStatus: currentStatus,
    appendEvidenceIds: [evidence.evidenceId],
    profileEvidenceLinks: [{
      evidenceId: evidence.evidenceId,
      ability: input.abilityId,
      evidenceType: evidence.outcome === 'improved' || evidence.outcome === 'partially_improved'
        ? 'growth'
        : 'insufficient',
      source: 'training',
      observation: evidence.observation,
      confidence: evidence.confidence,
      supportLevel: 'feedback_supported',
    }],
    pendingVerification: ['安排同能力独立复测。', '在新材料中进行迁移验证。'],
    warnings: ['反馈支持下的改善不能等同于独立掌握。', '能力状态和长期置信度保持不变。'],
    evidenceLinks: [evidence.evidenceId],
    createdAt,
  };
}

function validateIdentity(input: LearningFeedbackRevisionEvaluationInput): void {
  if (!input.revisionId || !input.studentId || !input.taskId || !input.abilityId) {
    throw new Error('revision_evaluation_identity_incomplete');
  }
  if (input.revisionGoal.sourceDiagnosisId !== input.initialDiagnosisId) {
    throw new Error('revision_evaluation_initial_diagnosis_mismatch');
  }
  if (!input.resourceVersionId || !input.rubricVersion || !input.revisedDiagnosisId) {
    throw new Error('revision_evaluation_version_binding_incomplete');
  }
}

function answerStatusRank(status?: OpenResponseAnswerStatus): number {
  if (status === 'fully_meets') return 3;
  if (status === 'partially_meets') return 2;
  if (status === 'does_not_meet') return 1;
  return 0;
}

function hasSubstantiveChange(initialAnswer: string, revisedAnswer: string): boolean {
  const initial = normalize(initialAnswer);
  const revised = normalize(revisedAnswer);
  if (initial === revised) return false;
  return Math.abs(revised.length - initial.length) >= 4 || revised !== initial;
}

function compact(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').replace(/^[，。；：、\s]+|[，。；：、\s]+$/g, '').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function issueFocus(issueCode: string): string {
  if (issueCode === 'missing_text_evidence' || issueCode === 'evidence') return '文本依据';
  if (issueCode === 'missing_reasoning_relation' || issueCode === 'relation') return '依据与判断之间的关系';
  if (issueCode === 'conclusion_inconsistent') return '与文章内容一致的判断';
  if (issueCode === 'incomplete_task_requirement') return '题目要求的关键信息';
  return '题目要求的关键内容';
}

function issueMethodReminder(issueCode: string): string {
  if (issueCode === 'missing_text_evidence' || issueCode === 'evidence') {
    return '先找到能支持判断的原文，再说明它怎样支持你的判断。';
  }
  if (issueCode === 'missing_reasoning_relation' || issueCode === 'relation') {
    return '写出依据后，再用一句话说明它为什么能支持你的判断。';
  }
  if (issueCode === 'conclusion_inconsistent') {
    return '作出判断后回到原文核对，看看文章是否真的支持这个结论。';
  }
  if (issueCode === 'incomplete_task_requirement') {
    return '提交前逐项对照题目要求，确认每一项都已经回答。';
  }
  return '回答后对照题目要求检查一遍，确认关键信息已经说清楚。';
}

function normalize(value: string): string {
  return value.replace(/[\s，。！？；：“”‘’、,.!?;:'"()-]/g, '').toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
