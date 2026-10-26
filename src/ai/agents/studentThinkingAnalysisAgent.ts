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
  const coverage = (feedback.thinkingReview?.requirementCoverage || []).map((item) => ({
    ...item,
    studentEvidence: item.studentEvidence.filter((span) => !studentResponse
      || studentResponse.answerText.replace(/\s/g, '').includes(span.replace(/\s/g, ''))),
  }));
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
        whyItMatters: item.status === 'covered'
          ? `这个判断回应题目要求说明${taskTarget}的方向`
          : `这部分内容可以继续对照题目要求核实，尚不代表已经完成${taskTarget}的说明`,
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
  if (/语气/.test(requirement)) return '语气差异';
  if (/标点/.test(requirement)) return '标点的表达效果';
  if (/结构/.test(requirement)) return '文章结构';
  if (/人物的特点|人物特点|人物形象/.test(requirement)) return '人物特点';
  if (/人物的心理|人物心理|心情/.test(requirement)) return '人物心理';
  if (/情感/.test(requirement)) return '情感的具体含义';
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
  const target = describeCoverageTarget(coverage);

  if (primaryCoverage.gapReasonCode === 'missing_text_evidence') {
    return {
      fromStep: '材料中的具体内容',
      toStep: target,
      observedProblem: conclusion
        ? `答案写出了“${short(conclusion)}”这个结论，却没有呈现支持它的文本内容，因此读者看不出这个判断来自材料中的哪一处。`
        : `答案没有呈现具体文本依据，因此${target}的判断缺少可以核对的材料起点。`,
      evidenceLinks: links,
      certainty,
    };
  }
  if (primaryCoverage.gapReasonCode === 'missing_reasoning_relation') {
    return {
      fromStep: '已经找到的材料依据',
      toStep: target,
      observedProblem: materialEvidence && conclusion
        ? `答案同时写出了“${short(materialEvidence)}”和“${short(conclusion)}”，但省略了这处依据为什么能支持这个判断的解释。`
        : '答案尚未说明文本依据怎样支持题目要求的判断。',
      evidenceLinks: links,
      certainty,
    };
  }
  if (primaryCoverage.gapReasonCode === 'conclusion_inconsistent') {
    return {
      fromStep: '材料内容与题目要求',
      toStep: target,
      observedProblem: conclusion && taskCue
        ? `你写的是“${short(conclusion)}”，但需对照“${short(taskCue)}”核实这一判断是否符合题目要求。`
        : conclusion
          ? `你写的是“${short(conclusion)}”，但这个判断与题目要求不一致，需要回到原文核对。`
        : '答案中的结论与材料或题目要求不一致。',
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
