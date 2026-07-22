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

type StudentFeedbackActionPlanInput = {
  feedback: StudentLearningFeedback;
  grounding: StudentFeedbackGrounding;
  thinkingAnalysis: StudentThinkingAnalysis;
  taskRole?: RecommendedTaskRole;
};

const GENERIC_ONLY_PATTERN = /^(?:你的回答)?(?:还)?(?:不够完整|缺少细节|需要深入分析|需要补充说明|需要加强理解)[。！]?$/;
const EXECUTABLE_ACTION_PATTERN = /(?:想一想|比较|思考|回到|找到|找出|选择|补上|写出|改成|说明|合并|连接|保留|检查|重新|查看)/;

export function buildStudentFeedbackActionPlan(
  input: StudentFeedbackActionPlanInput,
): StudentFeedbackActionPlan {
  const { feedback, grounding, thinkingAnalysis, taskRole } = input;
  const coverage = feedback.thinkingReview?.requirementCoverage || [];
  const primaryCoverage = coverage.find((item) => item.requirementId === grounding.primaryGap?.evidenceLinks[0]) ||
    coverage.find((item) => item.requirementId === feedback.thinkingReview?.primaryGapRequirementId);
  const conclusionCoverage = coverage.find((item) =>
    item.requirementType === 'conclusion' && item.studentEvidence.length > 0);
  const evidenceCoverage = coverage.find((item) => item.requirementType === 'text_evidence');
  const studentClaim = firstUseful(conclusionCoverage?.studentEvidence);
  const observedEvidence = firstUseful(evidenceCoverage?.studentEvidence);
  const taskCue = selectTaskCue(primaryCoverage, evidenceCoverage);
  const feedbackDepth = selectFeedbackDepth(feedback, grounding);
  const hintLevel = selectHintLevel(feedbackDepth, taskCue);
  const completedThinking = thinkingAnalysis.completedSteps[0];
  const acknowledgedAction = completedThinking
    ? `你${completedThinking.action}。`
    : buildAcknowledgedAction(studentClaim, observedEvidence, grounding);
  const whyItMatters = completedThinking
    ? `这一步${completedThinking.whyItMatters}。`
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
  const { grounding, primaryCoverage, observedEvidence, taskCue, feedbackDepth, hintLevel } = input;
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
    if (feedbackDepth < 4) return { nextOperations: prompt ? [prompt] : [] };
    return {
      nextOperations: prompt ? [prompt] : [],
      scaffoldTemplate: '可以按“人物……，说明这件事让他……，因此表现出……”重新组织答案。',
    };
  }

  if (primaryCoverage?.gapReasonCode === 'missing_reasoning_relation') {
    const prompt = buildThinkingPrompt({
      primaryCoverage,
      studentClaim: input.studentClaim,
      observedEvidence,
      taskCue,
      feedbackDepth,
    });
    if (feedbackDepth < 4) return { nextOperations: prompt ? [prompt] : [] };
    return {
      nextOperations: prompt ? [prompt] : [],
      scaffoldTemplate: '可以按“人物……，这个动作说明……，因此表现出……”重新组织答案。',
    };
  }

  if (primaryCoverage?.gapReasonCode === 'conclusion_inconsistent') {
    return {
      nextOperations: [
        taskCue && hintLevel === 'paraphrase'
          ? `重新查看“${short(taskCue)}”这一处内容。`
          : '重新查看人物前后动作和语气的变化。',
        '根据这些表现重新写出人物当时的心理。',
      ],
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
      return `想一想：${subject}为什么会“${short(cue)}”？这个动作除了说明“${short(studentClaim)}”，还表现了${pronoun}当时怎样的心理？`;
    }
    if (cue) return `想一想：${subject}为什么会“${short(cue)}”？这个动作表现了${pronoun}怎样的态度或心理？`;
    return `想一想：${subject}做了什么，让你得出这个判断？这个动作表现了${pronoun}怎样的心理？`;
  }
  if (primaryCoverage.gapReasonCode === 'conclusion_inconsistent') {
    return cue
      ? `重新比较“${short(cue)}”和当前判断：哪些词能同时解释${subject}为什么这样做？`
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

function short(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ').replace(/[。！？!?]$/, '');
  return normalized.length <= 36 ? normalized : `${normalized.slice(0, 35)}…`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
