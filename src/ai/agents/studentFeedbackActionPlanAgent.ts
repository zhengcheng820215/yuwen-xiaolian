import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { StudentFeedbackGrounding } from '../schemas/studentFeedbackGrounding.schema.ts';
import {
  STUDENT_FEEDBACK_ACTION_PLAN_SCHEMA_VERSION,
  isStudentFeedbackActionPlan,
  type StudentFeedbackActionPlan,
  type StudentFeedbackDepth,
  type StudentFeedbackHintLevel,
} from '../schemas/studentFeedbackActionPlan.schema.ts';
import type {
  StudentLearningFeedback,
  TaskRequirementCoverage,
} from '../schemas/studentLearningFeedback.schema.ts';
import type { StudentThinkingAnalysis } from '../schemas/studentThinkingAnalysis.schema.ts';
import type { StudentResponse } from '../schemas/taskExecution.schema.ts';

type StudentFeedbackActionPlanInput = {
  feedback: StudentLearningFeedback;
  grounding: StudentFeedbackGrounding;
  thinkingAnalysis: StudentThinkingAnalysis;
  studentResponse?: StudentResponse;
  taskRole?: RecommendedTaskRole;
};

const GENERIC_ONLY_PATTERN = /^(?:你的回答)?(?:还)?(?:不够完整|缺少细节|需要深入分析|需要补充说明|需要加强理解)[。！]?$/;
const EXECUTABLE_ACTION_PATTERN = /(?:想一想|比较|思考|回到|找到|找出|选择|补上|写出|改成|说明|合并|连接|保留|检查|重新|查看)/;

export function buildStudentFeedbackActionPlan(
  input: StudentFeedbackActionPlanInput,
): StudentFeedbackActionPlan {
  const { feedback, grounding, thinkingAnalysis, studentResponse, taskRole } = input;
  const coverage = feedback.thinkingReview?.requirementCoverage || [];
  const primaryCoverage = coverage.find((item) => item.requirementId === grounding.primaryGap?.evidenceLinks[0]) ||
    coverage.find((item) => item.requirementId === feedback.thinkingReview?.primaryGapRequirementId);
  const conclusionCoverage = coverage.find((item) =>
    item.requirementType === 'conclusion' && item.studentEvidence.length > 0);
  const evidenceCoverage = coverage.find((item) => item.requirementType === 'text_evidence');
  const studentClaim = firstUseful(conclusionCoverage?.studentEvidence) ||
    (primaryCoverage?.gapReasonCode === 'conclusion_inconsistent'
      ? conciseAnswer(studentResponse?.answerText)
      : undefined);
  const observedEvidence = firstUseful(evidenceCoverage?.studentEvidence);
  const taskCue = selectTaskCue(primaryCoverage, evidenceCoverage);
  const feedbackDepth = selectFeedbackDepth(feedback, grounding);
  const hintLevel = selectHintLevel(feedbackDepth, taskCue);
  const completedThinking = thinkingAnalysis.completedSteps[0];
  const supportingThinking = thinkingAnalysis.completedSteps.find((item) =>
    item.stepId.endsWith(':text_evidence'));
  const acknowledgedAction = completedThinking && supportingThinking &&
    supportingThinking.stepId !== completedThinking.stepId
    ? `你${completedThinking.action}，也${supportingThinking.action}。`
    : completedThinking
      ? `你${completedThinking.action}。`
    : buildAcknowledgedAction(studentClaim, observedEvidence, grounding);
  const whyItMatters = supportingThinking || completedThinking
    ? `这一步${(supportingThinking || completedThinking)!.whyItMatters}。`
    : undefined;
  const missingAnswerPart = buildMissingAnswerPart({
    grounding,
    primaryCoverage,
    studentClaim,
    observedEvidence,
    taskCue,
    hintLevel,
  });
  const { nextOperations, scaffoldTemplate } = buildOperations({
    grounding,
    primaryCoverage,
    studentClaim,
    observedEvidence,
    taskCue,
    feedbackDepth,
    hintLevel,
  });
  const problemMechanism = thinkingAnalysis.interruptedTransition?.observedProblem;
  const thinkingPrompt = buildThinkingPrompt({
    primaryCoverage,
    studentClaim,
    observedEvidence,
    taskCue,
    feedbackDepth,
  });
  const evidenceLinks = unique([
    feedback.learningRoundId,
    ...(grounding.primaryGap?.evidenceLinks || []),
    ...(conclusionCoverage ? [conclusionCoverage.requirementId] : []),
    ...(evidenceCoverage ? [evidenceCoverage.requirementId] : []),
    ...(studentResponse?.responseId ? [studentResponse.responseId] : []),
  ]);
  const issues: string[] = [];
  const actionGrounded = !acknowledgedAction || Boolean(studentClaim || observedEvidence || grounding.achievedPoints.length);
  if (!actionGrounded) issues.push('feedback_action_acknowledgement_not_grounded');
  const gapSpecific = !missingAnswerPart || !GENERIC_ONLY_PATTERN.test(missingAnswerPart.trim());
  if (!gapSpecific) issues.push('feedback_action_gap_not_specific');
  const operationsExecutable = nextOperations.length === 0 ||
    nextOperations.every((item) => EXECUTABLE_ACTION_PATTERN.test(item));
  if (!operationsExecutable) issues.push('feedback_action_operation_not_executable');
  const disclosureAllowed = hintLevel !== 'explicit';
  if (!disclosureAllowed) issues.push('feedback_action_answer_disclosure_not_allowed');

  const result: StudentFeedbackActionPlan = {
    schemaVersion: STUDENT_FEEDBACK_ACTION_PLAN_SCHEMA_VERSION,
    studentId: feedback.studentId,
    learningRoundId: feedback.learningRoundId,
    taskRole,
    feedbackDepth,
    hintLevel,
    acknowledgedAction,
    whyItMatters,
    missingAnswerPart,
    problemMechanism,
    thinkingPrompt,
    nextOperations,
    scaffoldTemplate,
    sourceGapId: grounding.primaryGap?.gapId,
    evidenceLinks,
    limitations: [
      '本计划只转换当前答案的可观察缺口，不形成长期能力结论。',
      '材料提示不得替代学生完成最终判断。',
    ],
    validation: {
      passed: issues.length === 0,
      actionGrounded,
      gapSpecific,
      operationsExecutable,
      disclosureAllowed,
      issues,
    },
  };

  if (isStudentFeedbackActionPlan(result)) return result;
  return {
    ...result,
    acknowledgedAction: undefined,
    whyItMatters: undefined,
    missingAnswerPart: undefined,
    problemMechanism: undefined,
    thinkingPrompt: undefined,
    nextOperations: [],
    scaffoldTemplate: undefined,
    validation: {
      ...result.validation,
      passed: false,
      issues: [...issues, 'feedback_action_plan_schema_invalid'],
    },
  };
}

function selectFeedbackDepth(
  feedback: StudentLearningFeedback,
  grounding: StudentFeedbackGrounding,
): StudentFeedbackDepth {
  if (grounding.status === 'cannot_assess' || feedback.resultStatus === 'blocked') return 1;
  if (feedback.resultStatus === 'review_required') return 2;
  if (feedback.canRetry) return 3;
  return 4;
}

function selectHintLevel(depth: StudentFeedbackDepth, taskCue?: string): StudentFeedbackHintLevel {
  if (depth <= 1) return 'none';
  if (depth === 2 || !taskCue) return 'location';
  return 'paraphrase';
}

function buildAcknowledgedAction(
  studentClaim: string | undefined,
  observedEvidence: string | undefined,
  grounding: StudentFeedbackGrounding,
): string | undefined {
  if (studentClaim) return `你已经写出了“${short(studentClaim)}”这个想法。`;
  if (observedEvidence) return `你已经在答案中用到了“${short(observedEvidence)}”这一具体内容。`;
  return grounding.achievedPoints[0]?.text;
}

function buildMissingAnswerPart(input: {
  grounding: StudentFeedbackGrounding;
  primaryCoverage?: TaskRequirementCoverage;
  studentClaim?: string;
  observedEvidence?: string;
  taskCue?: string;
  hintLevel: StudentFeedbackHintLevel;
}): string | undefined {
  const { grounding, primaryCoverage, studentClaim, observedEvidence, taskCue, hintLevel } = input;
  if (!grounding.primaryGap) return undefined;
  if (grounding.status === 'cannot_assess') return grounding.primaryGap.feedbackText;

  if (primaryCoverage?.gapReasonCode === 'missing_text_evidence') {
    const claim = studentClaim ? `“${short(studentClaim)}”这个判断` : '你的判断';
    const cue = taskCue && hintLevel === 'paraphrase'
      ? `材料中“${short(taskCue)}”这一处动作还没有写进答案。`
      : '答案里还没有写出人物做了什么来支持这个判断。';
    return `你现在已经有${claim}，但还缺少支持它的材料依据。${cue}`;
  }

  if (primaryCoverage?.gapReasonCode === 'missing_reasoning_relation') {
    if (observedEvidence && studentClaim) {
      return `你已经写到“${short(observedEvidence)}”，也提出了“${short(studentClaim)}”，但还没有说明这个动作为什么能支持这个判断。`;
    }
    if (observedEvidence) {
      return `你已经找到了“${short(observedEvidence)}”这一处内容，但还没有说明它表现了人物怎样的心理。`;
    }
  }

  if (primaryCoverage?.gapReasonCode === 'conclusion_inconsistent' && studentClaim) {
    return `你写出了“${short(studentClaim)}”这个判断，但它还不能准确概括材料中人物此时的心理。`;
  }
  return grounding.primaryGap.feedbackText;
}

function buildOperations(input: {
  grounding: StudentFeedbackGrounding;
  primaryCoverage?: TaskRequirementCoverage;
  studentClaim?: string;
  observedEvidence?: string;
  taskCue?: string;
  feedbackDepth: StudentFeedbackDepth;
  hintLevel: StudentFeedbackHintLevel;
}): { nextOperations: string[]; scaffoldTemplate?: string } {
  const { grounding, primaryCoverage, observedEvidence, taskCue, feedbackDepth } = input;
  if (!grounding.primaryGap) return { nextOperations: [] };
  if (grounding.status === 'cannot_assess') {
    return { nextOperations: ['请重新写出人物此时的心理，并至少说明一条理由。'] };
  }

  if (primaryCoverage?.gapReasonCode === 'missing_text_evidence') {
    const prompt = buildThinkingPrompt({
      primaryCoverage,
      studentClaim: input.studentClaim,
      observedEvidence,
      taskCue,
      feedbackDepth,
    });
    return { nextOperations: prompt ? [prompt] : [] };
  }

  if (primaryCoverage?.gapReasonCode === 'missing_reasoning_relation') {
    const prompt = buildThinkingPrompt({
      primaryCoverage,
      studentClaim: input.studentClaim,
      observedEvidence,
      taskCue,
      feedbackDepth,
    });
    return { nextOperations: prompt ? [prompt] : [] };
  }

  if (primaryCoverage?.gapReasonCode === 'conclusion_inconsistent') {
    const prompt = buildThinkingPrompt({
      primaryCoverage,
      studentClaim: input.studentClaim,
      observedEvidence,
      taskCue,
      feedbackDepth,
    });
    return {
      nextOperations: prompt ? [prompt] : ['重新比较人物的动作和你写出的心理判断。'],
    };
  }

  const fallback = grounding.actions.map((item) => item.text).filter((item) => EXECUTABLE_ACTION_PATTERN.test(item));
  return { nextOperations: fallback };
}

function buildThinkingPrompt(input: {
  primaryCoverage?: TaskRequirementCoverage;
  studentClaim?: string;
  observedEvidence?: string;
  taskCue?: string;
  feedbackDepth: StudentFeedbackDepth;
}): string | undefined {
  const { primaryCoverage, studentClaim, observedEvidence, taskCue, feedbackDepth } = input;
  if (feedbackDepth <= 1 || !primaryCoverage) return undefined;
  const subject = inferSubject(studentClaim, observedEvidence, taskCue);
  const pronoun = subject.includes('母') || subject.includes('她') ? '她' : '他';
  const cue = removeLeadingSubject(observedEvidence || taskCue, subject);

  if (['missing_text_evidence', 'missing_reasoning_relation'].includes(primaryCoverage.gapReasonCode || '')) {
    if (cue && studentClaim) {
      return `先别急着改答案。看看材料中的“${short(cue)}”，想一想：这个动作说明${subject}当时在想什么？再根据这个心理重新组织答案。`;
    }
    if (cue) return `先看看材料中的“${short(cue)}”，想一想：这个动作说明${subject}当时在想什么？`;
    return `先回到材料中找一个${subject}的动作，再问自己：这个动作说明${pronoun}当时在想什么？`;
  }
  if (primaryCoverage.gapReasonCode === 'conclusion_inconsistent') {
    return cue && studentClaim
      ? `先别急着改结论。看看材料中的“${short(cue)}”，想一想：这个动作真的能说明“${short(studentClaim)}”吗？如果不能，它更接近怎样的心理？`
      : cue
        ? `先别急着改结论。看看“${short(cue)}”，想一想：这个动作更接近${subject}怎样的心理？`
        : `重新查看${subject}前后的动作和语气：哪些词能同时解释${pronoun}为什么这样做？`;
  }
  return undefined;
}

function removeLeadingSubject(value: string | undefined, subject: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  return normalized.startsWith(subject)
    ? normalized.slice(subject.length).trim()
    : normalized;
}

function inferSubject(...values: Array<string | undefined>): string {
  const text = values.filter(Boolean).join(' ');
  return text.match(/父亲|母亲|小林|周老师|老师|孩子|人物/)?.[0] || '人物';
}

function selectTaskCue(
  primaryCoverage?: TaskRequirementCoverage,
  evidenceCoverage?: TaskRequirementCoverage,
): string | undefined {
  const candidates = [
    ...(primaryCoverage?.taskEvidence || []),
    ...(evidenceCoverage?.taskEvidence || []),
  ];
  for (const candidate of candidates) {
    const cue = extractTaskCue(candidate);
    if (cue) return cue;
  }
  return undefined;
}

function extractTaskCue(value: string): string | undefined {
  const quoted = [...value.matchAll(/[“\"]([^”\"]{2,36})[”\"]/g)]
    .map((match) => match[1]?.trim())
    .find(Boolean);
  if (quoted) return quoted;
  const normalized = value
    .replace(/^(?:题目要求|正式任务|能提取|能结合|能说明|引用|根据)/, '')
    .replace(/[。；]$/, '')
    .trim();
  if (
    normalized.length < 3 ||
    normalized.length > 44 ||
    /^(?:写出|说明|结合|使用).*(?:心理|依据|关系|要求)$/.test(normalized)
  ) return undefined;
  return normalized;
}

function firstUseful(values?: string[]): string | undefined {
  return values?.map((item) => item.trim()).find((item) => item.length >= 2);
}

function conciseAnswer(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) return undefined;
  const firstSentence = normalized.split(/[。！？!?]/)[0]?.trim();
  return firstSentence ? short(firstSentence) : undefined;
}

function short(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ').replace(/[。！？!?]$/, '');
  return normalized.length <= 36 ? normalized : `${normalized.slice(0, 35)}…`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
