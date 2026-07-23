import type { StudentFeedbackGrounding } from '../schemas/studentFeedbackGrounding.schema.ts';
import {
  STUDENT_THINKING_ANALYSIS_SCHEMA_VERSION,
  isStudentThinkingAnalysis,
  type StudentThinkingAnalysis,
  type StudentThinkingStep,
  type StudentThinkingTransition,
} from '../schemas/studentThinkingAnalysis.schema.ts';
import type {
  StudentLearningFeedback,
  TaskRequirementCoverage,
} from '../schemas/studentLearningFeedback.schema.ts';
import type { StudentResponse } from '../schemas/taskExecution.schema.ts';

const ABILITY_LABEL_PATTERN = /(?:能力差|能力弱|不会推理|不会理解|不擅长|总是|就是不会)/;

export function buildStudentThinkingAnalysis(
  feedback: StudentLearningFeedback,
  grounding: StudentFeedbackGrounding,
  studentResponse?: StudentResponse,
): StudentThinkingAnalysis {
  const coverage = feedback.thinkingReview?.requirementCoverage || [];
  const completedSteps = buildCompletedSteps(coverage);
  const primaryCoverage = coverage.find((item) =>
    item.requirementId === feedback.thinkingReview?.primaryGapRequirementId);
  const interruptedTransition = buildInterruptedTransition(primaryCoverage, coverage, grounding, studentResponse);
  const status = grounding.status === 'cannot_assess'
    ? 'cannot_assess'
    : interruptedTransition
      ? 'analyzed'
      : 'no_gap';
  const unresolvedQuestions = grounding.status === 'cannot_assess'
    ? ['当前回答是否包含足以分析的观点、依据或解释？']
    : interruptedTransition?.certainty === 'needs_verification'
      ? ['该断点来自没有形成相应理解，还是已经理解但没有写进答案？']
      : [];
  const issues: string[] = [];
  const completedStepsGrounded = completedSteps.every((item) => item.evidenceLinks.length > 0);
  if (!completedStepsGrounded) issues.push('thinking_analysis_completed_step_not_grounded');
  const transitionGrounded = !interruptedTransition || interruptedTransition.evidenceLinks.length > 0;
  if (!transitionGrounded) issues.push('thinking_analysis_transition_not_grounded');
  const noAbilityLabel = !ABILITY_LABEL_PATTERN.test(JSON.stringify({ completedSteps, interruptedTransition }));
  if (!noAbilityLabel) issues.push('thinking_analysis_ability_label_detected');

  const result: StudentThinkingAnalysis = {
    schemaVersion: STUDENT_THINKING_ANALYSIS_SCHEMA_VERSION,
    studentId: feedback.studentId,
    learningRoundId: feedback.learningRoundId,
    status,
    completedSteps: grounding.status === 'cannot_assess' ? [] : completedSteps,
    interruptedTransition: grounding.status === 'cannot_assess' ? undefined : interruptedTransition,
    unresolvedQuestions,
    limitations: [
      '思考断点只描述当前答案中可观察的连接，不等同于长期能力或已确认 Root Cause。',
    ],
    validation: {
      passed: issues.length === 0,
      completedStepsGrounded,
      transitionGrounded,
      noAbilityLabel,
      issues,
    },
  };

  if (isStudentThinkingAnalysis(result)) return result;
  return {
    ...result,
    completedSteps: [],
    interruptedTransition: undefined,
    validation: {
      ...result.validation,
      passed: false,
      issues: [...issues, 'student_thinking_analysis_schema_invalid'],
    },
  };
}

function buildCompletedSteps(coverage: TaskRequirementCoverage[]): StudentThinkingStep[] {
  const steps: StudentThinkingStep[] = [];
  const taskTarget = describeCoverageTarget(coverage);
  for (const item of coverage) {
    if (!['covered', 'partially_covered'].includes(item.status) || item.studentEvidence.length === 0) continue;
    const evidence = short(item.studentEvidence[0]!);
    if (item.requirementType === 'conclusion') {
      steps.push({
        stepId: item.requirementId,
        action: `写出了“${evidence}”这一想法`,
        whyItMatters: `没有只停留在复述材料内容，已经开始回应题目要求说明${taskTarget}的方向`,
        evidenceLinks: [item.requirementId, `student-evidence:${item.requirementId}`],
        verificationStatus: item.status === 'covered' ? 'supported' : 'observed',
      });
    } else if (item.requirementType === 'text_evidence') {
      steps.push({
        stepId: item.requirementId,
        action: `在答案中使用了“${evidence}”这一处材料内容`,
        whyItMatters: `让${taskTarget}的判断能够回到原文进行核对`,
        evidenceLinks: [item.requirementId, `student-evidence:${item.requirementId}`],
        verificationStatus: item.status === 'covered' ? 'supported' : 'observed',
      });
    } else if (item.requirementType === 'reasoning_relation') {
      steps.push({
        stepId: item.requirementId,
        action: `说明了材料内容与${taskTarget}之间的联系`,
        whyItMatters: '让读者能够看见判断是怎样从材料中得出的',
        evidenceLinks: [item.requirementId, `student-evidence:${item.requirementId}`],
        verificationStatus: item.status === 'covered' ? 'supported' : 'observed',
      });
    }
  }
  return steps.slice(0, 2);
}

function describeCoverageTarget(coverage: TaskRequirementCoverage[]): string {
  const requirement = coverage.find((item) => item.requirementType === 'conclusion')?.requirementText || '';
  if (/人物的特点|人物特点|人物形象/.test(requirement)) return '人物特点';
  if (/人物的心理|人物心理|心情|情感/.test(requirement)) return '人物心理';
  if (/事情的原因|原因/.test(requirement)) return '事情原因';
  return '题目结论';
}

function buildInterruptedTransition(
  primaryCoverage: TaskRequirementCoverage | undefined,
  coverage: TaskRequirementCoverage[],
  grounding: StudentFeedbackGrounding,
  studentResponse?: StudentResponse,
): StudentThinkingTransition | undefined {
  if (!primaryCoverage || !grounding.primaryGap) return undefined;
  const conclusion = firstEvidence(coverage, 'conclusion') ||
    (primaryCoverage.gapReasonCode === 'conclusion_inconsistent'
      ? conciseAnswer(studentResponse?.answerText)
      : undefined);
  const materialEvidence = firstEvidence(coverage, 'text_evidence');
  const taskCue = firstTaskCue(primaryCoverage, coverage);
  const links = unique([
    primaryCoverage.requirementId,
    ...grounding.primaryGap.evidenceLinks,
    ...(studentResponse?.responseId ? [studentResponse.responseId] : []),
  ]);
  const certainty = grounding.primaryGap.verificationStatus;

  if (primaryCoverage.gapReasonCode === 'missing_text_evidence') {
    return {
      fromStep: '材料中的人物动作或语句',
      toStep: '人物心理判断',
      observedProblem: conclusion
        ? `答案直接写出了“${short(conclusion)}”这个结论，却没有呈现人物做了什么，因此读者看不出这个判断来自材料中的哪一处。`
        : '答案没有呈现人物的具体动作或语句，因此人物心理判断缺少可以核对的材料起点。',
      evidenceLinks: links,
      certainty,
    };
  }
  if (primaryCoverage.gapReasonCode === 'missing_reasoning_relation') {
    return {
      fromStep: '已经找到的材料动作',
      toStep: '动作所表现的人物心理',
      observedProblem: materialEvidence && conclusion
        ? `答案同时写出了“${short(materialEvidence)}”和“${short(conclusion)}”，但省略了这个动作为什么能表现这种心理的解释。`
        : '答案已经出现材料依据和人物心理，但两者之间的解释没有写出来。',
      evidenceLinks: links,
      certainty,
    };
  }
  if (primaryCoverage.gapReasonCode === 'conclusion_inconsistent') {
    return {
      fromStep: '材料中人物前后的表现',
      toStep: '人物此时的心理',
      observedProblem: conclusion && taskCue
        ? `你写的是“${short(conclusion)}”，但材料重点呈现的是“${short(taskCue)}”。这个动作不能直接说明“${short(conclusion)}”，所以需要重新判断人物当时的心理。`
        : conclusion
          ? `你写的是“${short(conclusion)}”，但这个判断还不能解释材料中人物前后的表现，所以需要重新判断人物当时的心理。`
        : '答案中的人物心理结论与材料表现出的意思不一致。',
      evidenceLinks: links,
      certainty,
    };
  }
  if (primaryCoverage.gapReasonCode === 'incomplete_task_requirement') {
    return {
      fromStep: '已经表达的主要想法',
      toStep: primaryCoverage.requirementText,
      observedProblem: primaryCoverage.gapMessage || grounding.primaryGap.feedbackText,
      evidenceLinks: links,
      certainty,
    };
  }
  return undefined;
}

function firstTaskCue(
  primaryCoverage: TaskRequirementCoverage,
  coverage: TaskRequirementCoverage[],
): string | undefined {
  const evidenceCoverage = coverage.find((item) => item.requirementType === 'text_evidence');
  const candidates = [...primaryCoverage.taskEvidence, ...(evidenceCoverage?.taskEvidence || [])];
  for (const candidate of candidates) {
    const quoted = candidate.match(/[“"]([^”"]{2,36})[”"]/)?.[1]?.trim();
    if (quoted) return quoted;
    const normalized = candidate.replace(/^(?:题目要求|正式任务|根据|结合|引用)/, '').replace(/[。；]$/, '').trim();
    if (normalized.length >= 3 && normalized.length <= 44) return normalized;
  }
  return undefined;
}

function conciseAnswer(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) return undefined;
  const firstSentence = normalized.split(/[。！？!?]/)[0]?.trim();
  return firstSentence ? short(firstSentence) : undefined;
}

function firstEvidence(
  coverage: TaskRequirementCoverage[],
  type: TaskRequirementCoverage['requirementType'],
): string | undefined {
  return coverage.find((item) => item.requirementType === type)?.studentEvidence[0]?.trim();
}

function short(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ').replace(/[。！？!?]$/, '');
  return normalized.length <= 36 ? normalized : `${normalized.slice(0, 35)}…`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
