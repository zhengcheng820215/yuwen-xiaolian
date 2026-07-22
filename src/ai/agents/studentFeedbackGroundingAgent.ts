import type {
  StudentLearningFeedback,
  TaskRequirementCoverage,
  TaskRequirementGapReasonCode,
} from '../schemas/studentLearningFeedback.schema.ts';
import {
  STUDENT_FEEDBACK_GROUNDING_SCHEMA_VERSION,
  isStudentFeedbackGrounding,
  type StudentFeedbackGroundedGap,
  type StudentFeedbackGroundedPoint,
  type StudentFeedbackGrounding,
  type StudentFeedbackLearningGapCode,
} from '../schemas/studentFeedbackGrounding.schema.ts';

export function buildStudentFeedbackGrounding(
  feedback: StudentLearningFeedback,
): StudentFeedbackGrounding {
  const issues: string[] = [];
  const coverage = feedback.thinkingReview?.requirementCoverage || [];
  const achievedPoints = buildAchievedPoints(coverage, feedback.learningRoundId);
  const primaryCoverage = coverage.find((item) =>
    item.requirementId === feedback.thinkingReview?.primaryGapRequirementId);
  const primaryGap = buildPrimaryGap(feedback, primaryCoverage);
  const status = primaryGap?.reasonCode === 'insufficient_to_judge'
    ? 'cannot_assess'
    : primaryGap
      ? 'grounded'
      : 'no_gap';
  const actionTexts = feedback.guidance?.revisionActions
    .map((item) => item.trim())
    .filter(Boolean) || [];
  const actions = actionTexts.map((text) => ({
    text,
    targetGapId: primaryGap?.gapId,
    validationGoal: primaryGap
      ? `补充后重新检查：${primaryGap.missingRequirement}`
      : '完成当前反馈建议并重新检查答案。',
    evidenceLinks: primaryGap?.evidenceLinks || [feedback.learningRoundId],
  }));

  const allClaimsTraceable = [
    ...achievedPoints.map((item) => item.evidenceLinks),
    ...(primaryGap ? [primaryGap.evidenceLinks] : []),
    ...actions.map((item) => item.evidenceLinks),
  ].every((links) => links.length > 0);
  if (!allClaimsTraceable) issues.push('feedback_grounding_source_missing');

  const noUnsupportedPositiveClaim = achievedPoints.every((point) => {
    const item = coverage.find((candidate) => candidate.requirementId === point.requirementId);
    return Boolean(item?.studentEvidence.length);
  });
  if (!noUnsupportedPositiveClaim) issues.push('feedback_positive_claim_not_grounded');

  const actionsBoundToGap = actions.length === 0 || Boolean(primaryGap) &&
    actions.every((item) => item.targetGapId === primaryGap.gapId);
  if (!actionsBoundToGap) issues.push('feedback_action_not_bound_to_gap');

  const result: StudentFeedbackGrounding = {
    schemaVersion: STUDENT_FEEDBACK_GROUNDING_SCHEMA_VERSION,
    studentId: feedback.studentId,
    learningRoundId: feedback.learningRoundId,
    status,
    achievedPoints,
    primaryGap,
    actions,
    validation: {
      passed: issues.length === 0,
      allClaimsTraceable,
      noUnsupportedPositiveClaim,
      actionsBoundToGap,
      issues,
    },
  };

  if (isStudentFeedbackGrounding(result)) return result;
  return {
    ...result,
    achievedPoints: [],
    primaryGap: undefined,
    actions: [],
    validation: {
      ...result.validation,
      passed: false,
      issues: [...issues, 'feedback_grounding_schema_invalid'],
    },
  };
}

function buildAchievedPoints(
  coverage: TaskRequirementCoverage[],
  learningRoundId: string,
): StudentFeedbackGroundedPoint[] {
  const supported = coverage
    .filter((item) => ['covered', 'partially_covered'].includes(item.status) && item.studentEvidence.length > 0)
    .map((item) => ({
      text: item.studentMessage || describeObservedAction(item),
      requirementId: item.requirementId,
      evidenceLinks: [learningRoundId, item.requirementId, `student-evidence:${item.requirementId}`],
    }));
  if (supported.length > 0) return uniquePoints(supported).slice(0, 2);

  return [];
}

function buildPrimaryGap(
  feedback: StudentLearningFeedback,
  coverage?: TaskRequirementCoverage,
): StudentFeedbackGroundedGap | undefined {
  const text = feedback.thinkingReview?.primaryGap;
  if (!text) return undefined;
  const requirementId = coverage?.requirementId || feedback.thinkingReview?.primaryGapRequirementId;
  const reasonCode = coverage?.gapReasonCode;
  return {
    gapId: `${feedback.learningRoundId}:${requirementId || 'unresolved-gap'}`,
    gapCode: mapGapCode(reasonCode, coverage),
    reasonCode,
    verificationStatus: reasonCode === 'insufficient_to_judge' || !coverage
      ? 'needs_verification'
      : coverage.source === 'formal_diagnosis'
        ? 'supported'
        : 'observed',
    missingRequirement: coverage?.requirementText || '完成当前题目的关键要求',
    feedbackText: text,
    evidenceLinks: [requirementId || feedback.learningRoundId],
    limitations: reasonCode === 'insufficient_to_judge'
      ? ['当前回答不足以形成具体 Learning Gap。']
      : ['该 Gap 只描述本次任务表现，不代表长期能力状态。'],
  };
}

function mapGapCode(
  reasonCode?: TaskRequirementGapReasonCode,
  coverage?: TaskRequirementCoverage,
): StudentFeedbackLearningGapCode | undefined {
  if (reasonCode === 'conclusion_inconsistent') return 'LG02_CONCLUSION_REVISION_REQUIRED';
  if (reasonCode === 'missing_text_evidence') return 'LG04_TEXT_EVIDENCE_MISSING';
  if (reasonCode === 'missing_reasoning_relation') return 'LG05_REASONING_RELATION_MISSING';
  if (reasonCode === 'insufficient_to_judge') return undefined;
  if (reasonCode !== 'incomplete_task_requirement') return undefined;
  if (coverage?.requirementType === 'expression') return 'LG07_EXPRESSION_ORGANIZATION_INCOMPLETE';
  if (coverage?.requirementType === 'text_evidence') return 'LG04_TEXT_EVIDENCE_MISSING';
  if (coverage?.requirementType === 'reasoning_relation') return 'LG05_REASONING_RELATION_MISSING';
  return 'LG01_TASK_REQUIREMENT_MISALIGNED';
}

function describeObservedAction(item: TaskRequirementCoverage): string {
  if (item.requirementType === 'text_evidence') return '你已经从材料中找到了与题目有关的具体内容。';
  if (item.requirementType === 'reasoning_relation') return '你已经尝试说明材料内容与判断之间的关系。';
  if (item.requirementType === 'expression') return '你已经把主要想法写进了答案。';
  return describeAttemptedConclusion(item.requirementText);
}

function describeAttemptedConclusion(requirementText: string): string {
  if (/心理/.test(requirementText)) return '你已经尝试写出人物的心理判断。';
  if (/特点|形象/.test(requirementText)) return '你已经尝试写出人物特点或形象判断。';
  if (/原因/.test(requirementText)) return '你已经尝试写出原因判断。';
  return '你已经针对题目的核心要求写出了自己的判断。';
}

function uniquePoints(points: StudentFeedbackGroundedPoint[]): StudentFeedbackGroundedPoint[] {
  return points.filter((point, index) => points.findIndex((candidate) => candidate.text === point.text) === index);
}
