import type { DelayedRetestPlan } from '../schemas/delayedRetestScheduling.schema.ts';
import type { EvidenceQualityAssessment } from '../schemas/evidenceQualityAssessment.schema.ts';
import type { GrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import type { NextLearningStrategy } from '../schemas/nextLearningStrategy.schema.ts';
import type { NextFormalTaskResolution } from '../schemas/realLearningOperation.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { StudentLearningFeedback } from '../schemas/studentLearningFeedback.schema.ts';
import type { StudentResponse } from '../schemas/taskExecution.schema.ts';
import { buildStudentFeedbackGrounding } from './studentFeedbackGroundingAgent.ts';
import type { StudentFeedbackGrounding } from '../schemas/studentFeedbackGrounding.schema.ts';
import { buildStudentFeedbackActionPlan } from './studentFeedbackActionPlanAgent.ts';
import type { StudentFeedbackActionPlan } from '../schemas/studentFeedbackActionPlan.schema.ts';
import { buildStudentThinkingAnalysis } from './studentThinkingAnalysisAgent.ts';
import {
  STUDENT_LEARNING_NARRATIVE_SCHEMA_VERSION,
  isStudentLearningNarrativeProjection,
  type StudentLearningNarrativeProjection,
  type StudentLearningNarrativeStatement,
} from '../schemas/studentLearningNarrative.schema.ts';

export type StudentLearningNarrativeInput = {
  studentId: string;
  currentTask?: ConcreteLearningTask;
  feedback?: StudentLearningFeedback;
  studentResponse?: StudentResponse;
  evidenceQualityAssessment?: EvidenceQualityAssessment;
  growthMemorySummary?: GrowthMemorySummary;
  nextLearningStrategy?: NextLearningStrategy;
  nextTaskResolution?: NextFormalTaskResolution;
  delayedRetestPlan?: DelayedRetestPlan;
};

const INTERNAL_LANGUAGE = /\b(?:Evidence|Diagnosis|Profile|GrowthMemory|Root Cause|confidence|evaluator|operationId|responseId|taskRole)\b/i;
const UNSAFE_TASK_REASON_INTENT = /(?:正确答案|答案是|正确选项|应选|选择选项\s*[A-D0-9]|option[-_]?\d+|可接受观察信号|评分项|干扰项|acceptedSignal)/i;

export function buildStudentLearningNarrativeProjection(
  input: StudentLearningNarrativeInput,
): StudentLearningNarrativeProjection {
  const issues: string[] = [];
  const identityAligned = validateIdentity(input, issues);
  const isSingleChoiceFeedback = input.currentTask?.responseFormat === 'single_choice' && Boolean(input.feedback);
  const feedbackGrounding = input.feedback && !isSingleChoiceFeedback
    ? buildStudentFeedbackGrounding(input.feedback)
    : undefined;
  if (feedbackGrounding && !feedbackGrounding.validation.passed) {
    issues.push(...feedbackGrounding.validation.issues);
  }
  const thinkingAnalysis = input.feedback && feedbackGrounding
    ? buildStudentThinkingAnalysis(input.feedback, feedbackGrounding, input.studentResponse)
    : undefined;
  if (thinkingAnalysis && !thinkingAnalysis.validation.passed) {
    issues.push(...thinkingAnalysis.validation.issues);
  }
  const feedbackActionPlan = input.feedback && feedbackGrounding && thinkingAnalysis
    ? buildStudentFeedbackActionPlan({
        feedback: input.feedback,
        grounding: feedbackGrounding,
        thinkingAnalysis,
        studentResponse: input.studentResponse,
        taskRole: input.currentTask?.taskRole,
      })
    : undefined;
  if (feedbackActionPlan && !feedbackActionPlan.validation.passed) {
    issues.push(...feedbackActionPlan.validation.issues);
  }
  const taskReason = buildTaskReason(input.currentTask);
  const responseAnchor = isSingleChoiceFeedback
    ? buildSingleChoiceResponseAnchor(input)
    : buildResponseAnchor(input);
  const achieved = isSingleChoiceFeedback
    ? buildSingleChoiceAchieved(input)
    : buildAchieved(feedbackActionPlan, feedbackGrounding);
  const currentGap = isSingleChoiceFeedback
    ? buildSingleChoiceCurrentGap(input)
    : buildCurrentGap(feedbackActionPlan, feedbackGrounding);
  const currentGapReasonCode = buildCurrentGapReasonCode(input.feedback);
  const currentGapMode = buildCurrentGapMode(input.feedback);
  const nextAction = isSingleChoiceFeedback
    ? buildSingleChoiceNextAction(input)
    : buildNextAction(feedbackActionPlan, feedbackGrounding, input.feedback);
  const progressMeaning = buildProgressMeaning(input);
  const nextTaskReason = buildNextTaskReason(input);
  const statements = [taskReason, responseAnchor, achieved, currentGap, nextAction, progressMeaning, nextTaskReason]
    .filter((item): item is StudentLearningNarrativeStatement => Boolean(item));
  const allStatementsTraceable = statements.every((item) => item.sourceLinks.length > 0);
  if (!allStatementsTraceable) issues.push('narrative_statement_source_missing');
  const noInternalLanguage = statements.every((item) => !INTERNAL_LANGUAGE.test(item.text));
  if (!noInternalLanguage) issues.push('narrative_internal_language_detected');
  const progressComparisonEligible = !progressMeaning || canDescribeProgress(input);
  if (!progressComparisonEligible) issues.push('narrative_progress_comparison_not_eligible');

  const projection: StudentLearningNarrativeProjection = {
    schemaVersion: STUDENT_LEARNING_NARRATIVE_SCHEMA_VERSION,
    studentId: input.studentId,
    taskReason,
    responseAnchor,
    achieved,
    currentGap,
    currentGapMode,
    currentGapReasonCode,
    nextAction,
    progressMeaning,
    nextTaskReason,
    validation: {
      passed: issues.length === 0,
      identityAligned,
      allStatementsTraceable,
      progressComparisonEligible,
      noInternalLanguage,
      issues,
    },
  };

  if (!isStudentLearningNarrativeProjection(projection)) {
    return {
      ...projection,
      taskReason: undefined,
      responseAnchor: undefined,
      achieved: undefined,
      currentGap: undefined,
      currentGapMode: undefined,
      currentGapReasonCode: undefined,
      nextAction: undefined,
      progressMeaning: undefined,
      nextTaskReason: undefined,
      validation: {
        ...projection.validation,
        passed: false,
        issues: [...projection.validation.issues, 'narrative_projection_schema_invalid'],
      },
    };
  }
  return projection;
}

function buildSingleChoiceResponseAnchor(
  input: StudentLearningNarrativeInput,
): StudentLearningNarrativeStatement | undefined {
  const task = input.currentTask;
  const response = input.studentResponse;
  const selectedOptionId = response?.singleChoiceAnswer?.selectedOptionIds[0];
  const selectedOption = task?.singleChoiceDelivery?.options.find((option) => option.optionId === selectedOptionId);
  if (!task || !response || !selectedOption) return undefined;
  return statement(
    `你选择了“${shortExcerpt(selectedOption.content)}”。`,
    'current_response',
    'student_response',
    [response.responseId, task.taskId],
  );
}

function buildSingleChoiceAchieved(
  input: StudentLearningNarrativeInput,
): StudentLearningNarrativeStatement | undefined {
  const coverage = input.feedback?.thinkingReview?.requirementCoverage?.find((item) =>
    item.status === 'covered' && item.requirementId.endsWith(':choice_judgment'));
  const message = coverage?.studentMessage?.trim();
  if (!coverage || !message) return undefined;
  return statement(message, 'current_response', 'task_requirement_coverage', [coverage.requirementId]);
}

function buildSingleChoiceCurrentGap(
  input: StudentLearningNarrativeInput,
): StudentLearningNarrativeStatement | undefined {
  const review = input.feedback?.thinkingReview;
  const coverage = review?.requirementCoverage?.find((item) =>
    item.requirementId === review.primaryGapRequirementId && item.requirementId.endsWith(':choice_judgment'));
  if (!coverage || !review?.primaryGap) return undefined;
  return statement(review.primaryGap, 'current_response', 'learning_gap', [coverage.requirementId]);
}

function buildSingleChoiceNextAction(
  input: StudentLearningNarrativeInput,
): StudentLearningNarrativeStatement | undefined {
  const task = input.currentTask;
  const response = input.studentResponse;
  const selectedOptionId = response?.singleChoiceAnswer?.selectedOptionIds[0];
  const hasGap = Boolean(input.feedback?.thinkingReview?.primaryGap);
  if (!task || !response || !selectedOptionId || !hasGap) return undefined;
  const rationale = task.singleChoiceEvaluation?.distractorRationales.find((item) => item.optionId === selectedOptionId);
  const boundary = rationale?.evidenceBoundary?.trim();
  const text = boundary
    ? `回到材料核对：${finishSentence(boundary)}`
    : '回到材料重新核对题目要求的关键信息。';
  return statement(text, 'current_response', 'learning_gap', [
    response.responseId,
    input.feedback?.thinkingReview?.primaryGapRequirementId || task.taskId,
  ]);
}

function buildResponseAnchor(input: StudentLearningNarrativeInput): StudentLearningNarrativeStatement | undefined {
  const feedback = input.feedback;
  const coverage = feedback?.thinkingReview?.requirementCoverage?.find((item) =>
    ['covered', 'partially_covered'].includes(item.status) && item.studentEvidence.length > 0);
  const evidence = coverage?.studentEvidence.find((item) => meaningfulAnchor(item));
  if (feedback && coverage && evidence) {
    const excerpt = shortExcerpt(evidence);
    const text = coverage.requirementType === 'text_evidence'
      ? `你在回答中用到了“${excerpt}”这一具体内容。`
      : coverage.requirementType === 'conclusion'
        ? `你在回答中写出了“${excerpt}”这一理解。`
        : `你在回答中说明了“${excerpt}”。`;
    return statement(text, 'current_response', 'task_requirement_coverage', [coverage.requirementId]);
  }

  const response = input.studentResponse;
  const answerAnchor = response && safeAnswerAnchor(response.answerText);
  if (!response || !answerAnchor) return undefined;
  const primaryRequirementId = feedback?.thinkingReview?.primaryGapRequirementId;
  return statement(
    `你在回答中写到“${answerAnchor}”。`,
    'current_response',
    'student_response',
    [response.responseId, primaryRequirementId || feedback?.learningRoundId || response.taskId],
  );
}

function buildCurrentGapMode(
  feedback?: StudentLearningFeedback,
): StudentLearningNarrativeProjection['currentGapMode'] {
  const coverage = resolvePrimaryGapCoverage(feedback);
  if (!feedback?.thinkingReview?.primaryGap) return undefined;
  if (!coverage) return 'needs_completion';
  if (coverage.gapReasonCode === 'conclusion_inconsistent') return 'needs_adjustment';
  if (coverage.gapReasonCode === 'insufficient_to_judge' || coverage.status === 'insufficient_to_judge') {
    return 'insufficient_to_judge';
  }
  return 'needs_completion';
}

function buildCurrentGapReasonCode(
  feedback?: StudentLearningFeedback,
): StudentLearningNarrativeProjection['currentGapReasonCode'] {
  return resolvePrimaryGapCoverage(feedback)?.gapReasonCode;
}

function resolvePrimaryGapCoverage(feedback?: StudentLearningFeedback) {
  const review = feedback?.thinkingReview;
  return review?.requirementCoverage?.find((item) =>
    item.requirementId === review.primaryGapRequirementId);
}

function buildTaskReason(task?: ConcreteLearningTask): StudentLearningNarrativeStatement | undefined {
  if (!task) return undefined;
  const ability = studentAbilityLabel(task.targetAbilityName);
  const action = specificStudentTaskAction(task);
  const text = task.taskRole === 'retest'
    ? action
      ? `这道题会在间隔一段时间后再次练习${action}，看看你能否独立完成。`
      : `这道题会在间隔一段时间后再次练习${ability}，看看你能否独立完成。`
    : task.taskRole === 'transfer'
      ? action
        ? `这道题会换一份材料练习${action}，看看你能否把之前的方法用到新内容中。`
        : `这道题会换一份材料练习${ability}，看看你能否把之前的方法用到新内容中。`
      : task.taskRole === 'diagnosis' || task.taskRole === 'observation'
        ? action
          ? `这道题先了解你目前怎样完成${action}，后面的练习会根据这次回答继续安排。`
          : `这道题先了解你目前怎样处理${ability}相关要求，后面的练习会根据这次回答继续安排。`
        : action
          ? task.responseFormat === 'single_choice' && task.learningIntent?.isFoundationEntry
            ? `这道题先练习${action}，为后面的解释和分析打基础。`
            : `这道题练习${action}。`
          : `这道题练习${ability}，重点是把阅读思路用在当前材料中。`;
  return statement(text, 'current_task', 'formal_task', [
    task.taskId,
    task.learningIntent?.sourceObservationTaskPlanId,
  ].filter((value): value is string => Boolean(value)));
}

function specificStudentTaskAction(task: ConcreteLearningTask): string | undefined {
  const intent = task.learningIntent;
  if (!intent) return undefined;
  const candidates = [intent.expectedStudentAction, intent.observationGoal];
  for (const candidate of candidates) {
    const action = normalizeStudentTaskAction(candidate);
    if (action && !UNSAFE_TASK_REASON_INTENT.test(action) && !INTERNAL_LANGUAGE.test(action)) {
      return action;
    }
  }
  return undefined;
}

function normalizeStudentTaskAction(value: string): string | undefined {
  let action = value
    .trim()
    .replace(/^(?:要求)?(?:学生|学习者)(?:需要|应当|应该|应|需)\s*/, '')
    .replace(/^请\s*/, '')
    .replace(/选择最(符合|直接|准确|恰当)的/g, '判断最$1的')
    .replace(/[。！？?]+$/g, '')
    .trim();
  if (!action || action.length > 88) return undefined;
  if (/是因为什么$/.test(action)) {
    action = `理解${action.replace(/，?是因为什么$/, '')}的直接原因`;
  }
  return action;
}

function buildAchieved(
  actionPlan?: StudentFeedbackActionPlan,
  grounding?: StudentFeedbackGrounding,
): StudentLearningNarrativeStatement | undefined {
  const point = grounding?.validation.passed ? grounding.achievedPoints[0] : undefined;
  const actionText = actionPlan?.validation.passed ? actionPlan.acknowledgedAction : point?.text;
  const text = actionText && actionPlan?.validation.passed && actionPlan.whyItMatters
    ? `${actionText}${actionPlan.whyItMatters}`
    : actionText;
  if (!point || !text) return undefined;
  return statement(
    text,
    'current_response',
    'task_requirement_coverage',
    point.evidenceLinks,
  );
}

function buildCurrentGap(
  actionPlan?: StudentFeedbackActionPlan,
  grounding?: StudentFeedbackGrounding,
): StudentLearningNarrativeStatement | undefined {
  const gap = grounding?.validation.passed ? grounding.primaryGap : undefined;
  if (!gap) return undefined;
  return statement(
    actionPlan?.validation.passed && (actionPlan.problemMechanism || actionPlan.missingAnswerPart)
      ? actionPlan.problemMechanism || actionPlan.missingAnswerPart!
      : gap.feedbackText,
    'current_response',
    'learning_gap',
    gap.evidenceLinks,
  );
}

function buildNextAction(
  actionPlan?: StudentFeedbackActionPlan,
  grounding?: StudentFeedbackGrounding,
  feedback?: StudentLearningFeedback,
): StudentLearningNarrativeStatement | undefined {
  if (!grounding?.validation.passed || !feedback) return undefined;
  const plannedActions = actionPlan?.validation.passed
    ? [...actionPlan.nextOperations, actionPlan.scaffoldTemplate].filter((item): item is string => Boolean(item))
    : [];
  const text = plannedActions.length > 0
    ? plannedActions.join('\n')
    : grounding.actions.length > 0
      ? grounding.actions.map((item) => item.text).join(' ')
      : feedback.nextActionText?.trim();
  if (!text || !isExecutableCurrentAnswerAction(text)) return undefined;
  return statement(
    text,
    'current_response',
    grounding.primaryGap ? 'learning_gap' : 'student_feedback',
    grounding.primaryGap?.evidenceLinks || [feedback.learningRoundId],
  );
}

function buildProgressMeaning(
  input: StudentLearningNarrativeInput,
): StudentLearningNarrativeStatement | undefined {
  if (!canDescribeProgress(input)) return undefined;
  const quality = input.evidenceQualityAssessment!;
  const ability = studentAbilityLabel(input.currentTask?.targetAbilityName || input.growthMemorySummary?.abilityLabel || '这项能力');
  const context = quality.facts.taskNovelty === 'transfer' ? '面对新材料时' : '间隔一段时间后';
  return statement(
    `这次${context}，你仍能独立完成${ability}相关要求，为观察这种学习方法能否保持下来增加了一次可靠记录。`,
    'cross_session',
    'evidence_quality',
    [quality.assessmentId, input.delayedRetestPlan!.planId, input.growthMemorySummary!.latestRecordId!],
  );
}

function buildNextTaskReason(
  input: StudentLearningNarrativeInput,
): StudentLearningNarrativeStatement | undefined {
  const strategy = input.nextLearningStrategy;
  const resolution = input.nextTaskResolution;
  if (!strategy || resolution?.status !== 'matched' || !resolution.resourceVersion) return undefined;
  const ability = studentAbilityLabel(input.currentTask?.targetAbilityName || input.growthMemorySummary?.abilityLabel || '这项能力');
  const text = strategy.recommendedTaskRole === 'transfer'
    ? `下一项任务会换一份材料继续练习${ability}，用来看看刚才的方法能否用到新的内容中。`
    : strategy.recommendedTaskRole === 'retest'
      ? `下一项任务会再次练习${ability}，用来看看你能否更独立地完成。`
      : strategy.recommendedTaskRole === 'diagnosis' || strategy.recommendedTaskRole === 'observation'
        ? `下一项任务会从另一个角度继续观察${ability}，补充目前还不够充分的信息。`
        : `下一项任务会继续练习${ability}，重点处理本轮还需要巩固的部分。`;
  return statement(
    text,
    'next_strategy',
    'next_learning_strategy',
    [strategy.strategyId, resolution.taskRequestId, resolution.resourceVersion.resourceVersionId],
  );
}

function canDescribeProgress(input: StudentLearningNarrativeInput): boolean {
  const quality = input.evidenceQualityAssessment;
  const memory = input.growthMemorySummary;
  const plan = input.delayedRetestPlan;
  return Boolean(
    quality?.validation.passed &&
    quality.evaluationEligibility === 'eligible' &&
    ['medium', 'high'].includes(quality.qualityLevel) &&
    quality.facts.responseValid &&
    quality.facts.taskAbilityAligned &&
    quality.facts.diagnosisAligned &&
    quality.facts.traceabilityComplete &&
    quality.facts.independentPerformance &&
    quality.facts.timingType === 'delayed' &&
    plan?.baselineEvidenceId &&
    plan.sourceEvidenceIds.includes(plan.baselineEvidenceId) &&
    memory && memory.recordCount >= 2 && memory.latestRecordId &&
    ['confidence_increasing', 'status_improving'].includes(memory.recentTrend),
  );
}

function validateIdentity(input: StudentLearningNarrativeInput, issues: string[]): boolean {
  const mismatches = [
    input.studentResponse?.studentId,
    input.feedback?.studentId,
    input.evidenceQualityAssessment?.studentId,
    input.growthMemorySummary?.studentId,
    input.nextLearningStrategy?.studentId,
    input.delayedRetestPlan?.studentId,
  ].filter((value): value is string => Boolean(value && value !== input.studentId));
  if (mismatches.length > 0) issues.push('narrative_student_identity_mismatch');
  if (input.currentTask && input.evidenceQualityAssessment &&
    input.currentTask.targetAbilityId !== input.evidenceQualityAssessment.abilityId) {
    issues.push('narrative_ability_identity_mismatch');
  }
  if (input.currentTask && input.studentResponse &&
    input.currentTask.taskId !== input.studentResponse.taskId) {
    issues.push('narrative_response_task_identity_mismatch');
  }
  return issues.length === 0;
}

function statement(
  text: string,
  scope: StudentLearningNarrativeStatement['scope'],
  sourceType: StudentLearningNarrativeStatement['sourceType'],
  sourceLinks: string[],
): StudentLearningNarrativeStatement {
  return { text: text.trim(), scope, sourceType, sourceLinks: sourceLinks.filter(Boolean) };
}

function studentAbilityLabel(value: string): string {
  const normalized = value.trim().replace(/能力$/, '');
  return normalized === '这项能力' ? normalized : `“${normalized}”`;
}

function meaningfulAnchor(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= 2 && !/^(?:自己|当时|这样|那里|这个|那个|所以|因为)$/.test(normalized);
}

function shortExcerpt(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length <= 32 ? normalized : `${normalized.slice(0, 31)}…`;
}

function finishSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /[。！？!?]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function safeAnswerAnchor(value: string): string | undefined {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (
    normalized.length < 2 ||
    /^(?:不知道|不会|不清楚|没写|无|暂无|略|占位|测试)[。！？!?]?$/.test(normalized) ||
    /忽略(?:之前|前面|以上).*规则|打印.*(?:prompt|提示词)|修改.*mainAbility|判定.*掌握/i.test(normalized)
  ) return undefined;
  const clause = normalized.split(/[。！？!?；;]/).map((item) => item.trim()).find((item) => item.length >= 2);
  return clause ? shortExcerpt(clause) : undefined;
}

function isExecutableCurrentAnswerAction(value: string): boolean {
  return /(?:保留|补充|重新|找出|说明|写出|修改|检查|整理|结合)/.test(value) &&
    !/^(?:继续努力|加强理解|深入思考|认真审题)[。！]?$/.test(value.trim());
}
