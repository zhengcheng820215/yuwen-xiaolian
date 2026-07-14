import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type {
  LearningRoundExecutionResult,
  LearningRoundResult,
} from '../schemas/learningRound.schema.ts';
import type {
  StudentLearningFeedback,
  StudentLearningFeedbackInput,
  StudentLearningFeedbackSource,
  StudentLearningFeedbackStage,
  StudentLearningFeedbackStatus,
} from '../schemas/studentLearningFeedback.schema.ts';
import type { TaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';
import type { TaskExecutionResult } from '../schemas/taskExecution.schema.ts';

type SelectedFeedbackSource =
  | { source: 'learning_round'; result: LearningRoundResult }
  | { source: 'evidence_return'; result: TaskEvidenceReturnResult }
  | { source: 'learning_round_execution'; result: LearningRoundExecutionResult }
  | { source: 'task_execution'; result: TaskExecutionResult };

export function buildStudentLearningFeedback(
  input: StudentLearningFeedbackInput,
): StudentLearningFeedback {
  const selected = selectMostAuthoritativeSource(input);

  if (!selected) {
    return buildFallbackFeedback(input);
  }

  if (selected.source === 'learning_round') {
    return mapLearningRoundResult(selected.result, input);
  }
  if (selected.source === 'evidence_return') {
    return mapTaskEvidenceReturnResult(selected.result, input);
  }
  if (selected.source === 'learning_round_execution') {
    return mapLearningRoundExecutionResult(selected.result, input);
  }

  return mapTaskExecutionResult(selected.result, input);
}

function selectMostAuthoritativeSource(input: StudentLearningFeedbackInput): SelectedFeedbackSource | null {
  if (input.learningRoundResult) return { source: 'learning_round', result: input.learningRoundResult };
  if (input.taskEvidenceReturnResult) return { source: 'evidence_return', result: input.taskEvidenceReturnResult };
  if (input.learningRoundExecutionResult) return { source: 'learning_round_execution', result: input.learningRoundExecutionResult };
  if (input.taskExecutionResult) return { source: 'task_execution', result: input.taskExecutionResult };

  return null;
}

function mapLearningRoundResult(
  result: LearningRoundResult,
  input: StudentLearningFeedbackInput,
): StudentLearningFeedback {
  if (result.status === 'completed') {
    const evidenceReturn = result.taskEvidenceReturnResult;
    return buildFeedback({
      input,
      learningRoundId: result.learningRoundId,
      studentId: result.studentId,
      stage: 'result',
      resultStatus: 'completed',
      source: 'learning_round',
      sourceStatus: result.status,
      headline: '本轮已经完成',
      summary: '你的答案已经完成分析，本轮结果已经记录。下一步会根据本轮结果继续安排学习。',
      whatYouDidWell: evidenceReturn ? buildPositiveFeedback(evidenceReturn) : [],
      whatNeedsAttention: evidenceReturn ? buildAttentionFromEvidenceReturn(evidenceReturn) : [],
      nextActionText: result.nextStep === 'continue'
        ? '可以进入本轮结果页，查看下一步学习安排。'
        : result.nextStepReason,
      canRetry: false,
      canFinishRound: true,
      issues: result.issues,
    });
  }

  if (result.status === 'retry_required') {
    return buildFeedback({
      input,
      learningRoundId: result.learningRoundId,
      studentId: result.studentId,
      stage: 'submission',
      resultStatus: 'retry_required',
      source: 'learning_round',
      sourceStatus: result.status,
      headline: '还需要补充回答',
      summary: '这次回答还不够进入稳定分析，请先补充你的判断和理由。',
      whatYouDidWell: [],
      whatNeedsAttention: ['请写出你的判断，并结合文中的一个细节说明理由。'],
      nextActionText: result.nextStepReason || '请补充后重新提交。',
      canRetry: true,
      canFinishRound: false,
      issues: result.issues,
    });
  }

  if (result.status === 'review_required') {
    return buildFeedback({
      input,
      learningRoundId: result.learningRoundId,
      studentId: result.studentId,
      stage: 'result',
      resultStatus: 'review_required',
      source: 'learning_round',
      sourceStatus: result.status,
      headline: '这次结果需要进一步确认',
      summary: '你的回答已经记录，但系统需要进一步确认，暂时不会据此改变你的能力状态。',
      whatYouDidWell: [],
      whatNeedsAttention: ['可以先保留这次作答，等待确认后再继续。'],
      nextActionText: result.nextStepReason || '可以结束本轮或稍后重试。',
      canRetry: false,
      canFinishRound: true,
      issues: result.issues,
    });
  }

  return buildFeedback({
    input,
    learningRoundId: result.learningRoundId,
    studentId: result.studentId,
    stage: 'result',
    resultStatus: result.status === 'abandoned' ? 'blocked' : 'blocked',
    source: 'learning_round',
    sourceStatus: result.status,
    headline: result.status === 'abandoned' ? '本轮已停止' : '本轮暂时无法继续',
    summary: result.status === 'abandoned'
      ? '你已经中断本轮任务，本轮不会继续分析。'
      : '本次提交暂时无法处理，请稍后重试。',
    whatYouDidWell: [],
    whatNeedsAttention: result.issues.length > 0 ? ['本轮流程暂时无法继续。'] : [],
    nextActionText: result.nextStepReason || '可以稍后重新开始。',
    canRetry: result.nextStep !== 'stop',
    canFinishRound: true,
    issues: result.issues,
  });
}

function mapTaskEvidenceReturnResult(
  result: TaskEvidenceReturnResult,
  input: StudentLearningFeedbackInput,
): StudentLearningFeedback {
  if (result.status === 'evidence_returned') {
    return buildFeedback({
      input,
      learningRoundId: getLearningRoundId(input),
      studentId: result.studentId,
      stage: 'result',
      resultStatus: 'completed',
      source: 'evidence_return',
      sourceStatus: result.status,
      headline: '分析已经完成',
      summary: '你的答案已经被系统分析，本次结果已经形成记录。',
      whatYouDidWell: buildPositiveFeedback(result),
      whatNeedsAttention: buildAttentionFromEvidenceReturn(result),
      nextActionText: '可以进入本轮结果页，查看下一步学习安排。',
      canRetry: false,
      canFinishRound: true,
      issues: result.validation.issues,
    });
  }

  if (result.status === 'diagnosis_failed') {
    return buildFeedback({
      input,
      learningRoundId: getLearningRoundId(input),
      studentId: result.studentId,
      stage: 'result',
      resultStatus: 'review_required',
      source: 'evidence_return',
      sourceStatus: result.status,
      headline: '这次分析需要稍后确认',
      summary: '这次回答已经记录，但系统暂时无法稳定分析结果。你可以稍后重试或先结束本轮。',
      whatYouDidWell: [],
      whatNeedsAttention: ['这不是你的答案问题，而是系统暂时无法稳定完成分析。'],
      nextActionText: '可以稍后重试，或先结束本轮。',
      canRetry: true,
      canFinishRound: true,
      issues: result.validation.issues,
    });
  }

  if (result.status === 'review_required') {
    return buildFeedback({
      input,
      learningRoundId: getLearningRoundId(input),
      studentId: result.studentId,
      stage: 'result',
      resultStatus: 'review_required',
      source: 'evidence_return',
      sourceStatus: result.status,
      headline: '这次结果需要进一步确认',
      summary: '这次回答已经记录，系统需要进一步确认，暂时不会据此改变你的能力状态。',
      whatYouDidWell: [],
      whatNeedsAttention: ['可以先保留这次回答，等待确认后再继续。'],
      nextActionText: '可以结束本轮或稍后重试。',
      canRetry: false,
      canFinishRound: true,
      issues: result.validation.issues,
    });
  }

  return buildFeedback({
    input,
    learningRoundId: getLearningRoundId(input),
    studentId: result.studentId,
    stage: 'result',
    resultStatus: 'blocked',
    source: 'evidence_return',
    sourceStatus: result.status,
    headline: '本次提交暂时无法处理',
    summary: '这次回答没有进入稳定分析流程，请根据提示补充或稍后重试。',
    whatYouDidWell: [],
    whatNeedsAttention: ['请先补充可分析的答案，再重新提交。'],
    nextActionText: '请补充后重新提交。',
    canRetry: true,
    canFinishRound: false,
    issues: result.validation.issues,
  });
}

function mapLearningRoundExecutionResult(
  result: LearningRoundExecutionResult,
  input: StudentLearningFeedbackInput,
): StudentLearningFeedback {
  if (result.status === 'evidence_return_ready') {
    return buildFeedback({
      input,
      learningRoundId: result.learningRoundId,
      studentId: result.studentId,
      stage: 'analysis',
      resultStatus: 'completed',
      source: 'task_execution',
      sourceStatus: result.status,
      headline: '答案已提交，正在分析',
      summary: '你的答案已经具备最低分析条件，系统正在整理本次反馈。',
      whatYouDidWell: buildPositiveExecutionFacts(result.taskExecutionResult),
      whatNeedsAttention: [],
      nextActionText: '请稍等，分析完成后会显示本次反馈。',
      canRetry: false,
      canFinishRound: false,
      issues: result.issues,
    });
  }

  if (result.status === 'retry_required') {
    return buildFeedback({
      input,
      learningRoundId: result.learningRoundId,
      studentId: result.studentId,
      stage: 'submission',
      resultStatus: 'retry_required',
      source: 'task_execution',
      sourceStatus: result.status,
      headline: '还需要补充回答',
      summary: buildValiditySummary(result.taskExecutionResult),
      whatYouDidWell: [],
      whatNeedsAttention: buildValidityAttention(result.taskExecutionResult),
      nextActionText: '请补充后重新提交。',
      canRetry: true,
      canFinishRound: false,
      issues: result.issues,
    });
  }

  if (result.status === 'review_required') {
    return buildFeedback({
      input,
      learningRoundId: result.learningRoundId,
      studentId: result.studentId,
      stage: 'result',
      resultStatus: 'review_required',
      source: 'task_execution',
      sourceStatus: result.status,
      headline: '这次提交需要进一步确认',
      summary: '这次回答已经记录，但系统需要进一步确认，暂时不会据此改变你的能力状态。',
      whatYouDidWell: [],
      whatNeedsAttention: ['请不要重复提交，等待确认或稍后重试。'],
      nextActionText: '可以稍后重试，或先结束本轮。',
      canRetry: true,
      canFinishRound: true,
      issues: result.issues,
    });
  }

  return buildFeedback({
    input,
    learningRoundId: result.learningRoundId,
    studentId: result.studentId,
    stage: 'submission',
    resultStatus: 'blocked',
    source: 'task_execution',
    sourceStatus: result.status,
    headline: result.status === 'abandoned' ? '本轮已停止' : '本次提交暂时无法处理',
    summary: result.status === 'abandoned'
      ? '你已经中断本轮任务，本轮不会继续分析。'
      : '本次提交暂时无法继续处理。',
    whatYouDidWell: [],
    whatNeedsAttention: result.status === 'blocked' ? ['请稍后重试。'] : [],
    nextActionText: result.nextAction === 'stop' ? '可以结束本轮。' : '可以稍后重试。',
    canRetry: result.nextAction !== 'stop',
    canFinishRound: true,
    issues: result.issues,
  });
}

function mapTaskExecutionResult(
  result: TaskExecutionResult,
  input: StudentLearningFeedbackInput,
): StudentLearningFeedback {
  if (result.status === 'submitted_valid') {
    return buildFeedback({
      input,
      learningRoundId: getLearningRoundId(input),
      studentId: result.studentId,
      stage: 'submission',
      resultStatus: 'completed',
      source: 'task_execution',
      sourceStatus: result.status,
      headline: '答案已提交',
      summary: '你的答案已经具备最低分析条件，接下来系统会继续整理反馈。',
      whatYouDidWell: buildPositiveExecutionFacts(result),
      whatNeedsAttention: [],
      nextActionText: '请等待系统分析完成。',
      canRetry: false,
      canFinishRound: false,
      issues: result.responseValidity.reasons,
    });
  }

  if (result.status === 'submitted_invalid') {
    return buildFeedback({
      input,
      learningRoundId: getLearningRoundId(input),
      studentId: result.studentId,
      stage: 'submission',
      resultStatus: 'retry_required',
      source: 'task_execution',
      sourceStatus: result.responseValidity.status,
      headline: '还需要补充回答',
      summary: buildValiditySummary(result),
      whatYouDidWell: [],
      whatNeedsAttention: buildValidityAttention(result),
      nextActionText: '请补充后重新提交。',
      canRetry: true,
      canFinishRound: false,
      issues: result.responseValidity.reasons,
    });
  }

  return buildFeedback({
    input,
    learningRoundId: getLearningRoundId(input),
    studentId: result.studentId,
    stage: 'submission',
    resultStatus: 'blocked',
    source: 'task_execution',
    sourceStatus: result.status,
    headline: result.status === 'abandoned' ? '本轮已停止' : '本次提交未完成',
    summary: result.status === 'abandoned'
      ? '你已经中断本轮任务，本轮不会继续分析。'
      : '本次提交还没有完成，暂时不能分析。',
    whatYouDidWell: [],
    whatNeedsAttention: [],
    nextActionText: result.status === 'abandoned' ? '可以结束本轮。' : '请重新提交。',
    canRetry: result.status !== 'abandoned',
    canFinishRound: true,
    issues: result.responseValidity.reasons,
  });
}

function buildFeedback(input: {
  input: StudentLearningFeedbackInput;
  learningRoundId: string;
  studentId: string;
  stage: StudentLearningFeedbackStage;
  resultStatus: StudentLearningFeedbackStatus;
  source: StudentLearningFeedbackSource;
  sourceStatus: string;
  headline: string;
  summary: string;
  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;
  canRetry: boolean;
  canFinishRound: boolean;
  issues: string[];
}): StudentLearningFeedback {
  return {
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    stage: input.stage,
    resultStatus: input.resultStatus,
    headline: input.headline,
    summary: input.summary,
    whatYouDidWell: input.whatYouDidWell,
    whatNeedsAttention: input.whatNeedsAttention,
    nextActionText: input.nextActionText,
    canRetry: input.canRetry,
    canFinishRound: input.canFinishRound,
    source: input.source,
    studentRoundFocus: input.input.entryState?.studentRoundFocus,
    debugState: {
      sourceStatus: input.sourceStatus,
      sourceType: input.source,
      issues: input.issues,
    },
  };
}

function buildFallbackFeedback(input: StudentLearningFeedbackInput): StudentLearningFeedback {
  return {
    learningRoundId: input.entryState?.learningRoundId || 'unknown-learning-round',
    studentId: input.entryState?.studentId || 'unknown-student',
    stage: 'submission',
    resultStatus: 'blocked',
    headline: '暂时没有可展示的反馈',
    summary: '系统还没有收到本次提交结果，请稍后重试。',
    whatYouDidWell: [],
    whatNeedsAttention: ['请确认任务已经提交。'],
    nextActionText: '请稍后重试。',
    canRetry: true,
    canFinishRound: false,
    source: 'task_execution',
    studentRoundFocus: input.entryState?.studentRoundFocus,
    debugState: {
      sourceStatus: 'missing_source',
      sourceType: 'task_execution',
      issues: ['No Runtime Result was provided.'],
    },
  };
}

function buildPositiveFeedback(result: TaskEvidenceReturnResult): string[] {
  const feedback: string[] = [];

  for (const evidence of result.abilityEvidence) {
    if (evidence.evidenceType === 'positive' || evidence.evidenceType === 'growth') {
      feedback.push(toStudentText(evidence.detail || evidence.observation));
    }
  }

  if (feedback.length > 0) return dedupe(feedback);

  const matchedRubricItems = result.diagnosisResult?.matchedRubricItems || [];
  for (const item of matchedRubricItems) {
    feedback.push(`你已经涉及「${item}」这一点。`);
  }

  if (feedback.length > 0) return dedupe(feedback);

  return buildPositiveExecutionFacts(result.taskExecutionResult);
}

function buildPositiveExecutionFacts(result?: TaskExecutionResult): string[] {
  const answerText = result?.studentResponse?.answerText.trim() || '';
  const facts: string[] = [];

  if (!result || result.status !== 'submitted_valid') return facts;
  if (answerText.length >= 8) facts.push('你已经提交了可分析的完整回答。');
  if (/“|”|"|文中|因为|所以|说明|可以看出/.test(answerText)) {
    facts.push('你的回答中已经出现了可以继续分析的依据或理由。');
  }

  return dedupe(facts);
}

function buildAttentionFromEvidenceReturn(result: TaskEvidenceReturnResult): string[] {
  const attention: string[] = [];

  for (const evidence of result.abilityEvidence) {
    if (evidence.evidenceType === 'weakness') {
      attention.push(evidence.rootCause || evidence.detail || evidence.observation);
    }
    if (evidence.evidenceType === 'insufficient') {
      attention.push('这次回答还需要更多依据，才能形成稳定判断。');
    }
  }

  if (attention.length > 0) return dedupe(attention);

  if (result.diagnosisResult?.rootCause) {
    const answerStatus = result.diagnosisResult.answerStatus;
    if (answerStatus !== 'fully_meets') {
      attention.push(toStudentText(result.diagnosisResult.rootCause));
    }
  }

  return dedupe(attention);
}

function toStudentText(value: string): string {
  return value
    .replace(/^学生/, '你')
    .replace(/学生/g, '你')
    .replace(/可形成正向能力证据/g, '表现达到本次要求')
    .replace(/能力证据/g, '本次表现')
    .replace(/Evidence/gi, '记录')
    .trim();
}

function buildValiditySummary(result?: TaskExecutionResult): string {
  const status = result?.responseValidity.status;

  if (status === 'empty') return '这次还没有填写答案，请先写出你的判断。';
  if (status === 'placeholder') return '这次回答的信息还不够，请不要只写“不知道”或占位内容。';
  if (status === 'irrelevant') return '这次回答和题目要求关系不够明确，请重新围绕题目作答。';
  if (status === 'insufficient') return '这次回答还不够进入稳定分析，请补充判断和理由。';

  return '这次回答还需要补充，才能进入稳定分析。';
}

function buildValidityAttention(result?: TaskExecutionResult): string[] {
  const status = result?.responseValidity.status;

  if (status === 'empty') return ['请先填写答案。'];
  if (status === 'placeholder') return ['请写出自己的判断，并补充一个理由或文本依据。'];
  if (status === 'irrelevant') return ['请重新围绕题目要求回答。'];
  if (status === 'insufficient') return ['请先写出判断，再结合文中的一个行为或细节说明理由。'];

  return result?.responseValidity.reasons.length
    ? result.responseValidity.reasons
    : ['请补充你的判断和理由。'];
}

function getLearningRoundId(input: StudentLearningFeedbackInput): string {
  return input.entryState?.learningRoundId ||
    input.learningRoundExecutionResult?.learningRoundId ||
    input.learningRoundResult?.learningRoundId ||
    'unknown-learning-round';
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
