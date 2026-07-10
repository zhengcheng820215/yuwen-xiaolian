import { generatePersonalizedNextTask } from './personalizedNextTaskAgent.ts';
import {
  runPersonalizedTaskExecutionAgent,
  type PersonalizedTaskExecutionResult,
} from './personalizedTaskExecutionAgent.ts';
import { runRealAIDiagnosisLoop, type RealAILLMCaller } from './realAIDiagnosisAgent.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
} from './weaknessRankingAgent.ts';
import type { LearningEntryResult } from '../schemas/learningEntry.schema.ts';
import type { PersonalizedNextTask } from '../schemas/personalizedNextTask.schema.ts';
import type {
  PersonalizedTrainingFlowFeedback,
  PersonalizedTrainingFlowResult,
  PersonalizedTrainingFlowStatus,
} from '../schemas/personalizedTrainingFlow.schema.ts';

export type PersonalizedTrainingFlowInput = {
  learningEntryResult: LearningEntryResult;
  studentTaskAnswer: string;
  personalizedTask?: PersonalizedNextTask;
  createdAt?: string;
  diagnosisCaller?: RealAILLMCaller;
};

export async function runPersonalizedTrainingFlowAgent(
  input: PersonalizedTrainingFlowInput,
): Promise<PersonalizedTrainingFlowResult> {
  const createdAt = input.createdAt || new Date().toISOString();
  const targetAbility = resolveTargetAbility(input.learningEntryResult);
  const evidenceSummary = summarizeAbilityEvidence(input.learningEntryResult.updated_evidence);
  const topWeakness = rankWeaknessSummaries(evidenceSummary, 3);
  const personalizedTask = input.personalizedTask || generatePersonalizedNextTask({
    studentAbilityProfile: input.learningEntryResult.student_ability_profile,
    topWeakness,
    evidenceSummary,
    updatedEvidence: input.learningEntryResult.updated_evidence,
    generatedAt: createdAt,
  });
  const executionResult = await runPersonalizedTaskExecutionAgent({
    studentId: input.learningEntryResult.student_id,
    studentAbilityProfile: input.learningEntryResult.student_ability_profile,
    evidenceSummary,
    updatedEvidence: input.learningEntryResult.updated_evidence,
    personalizedNextTask: personalizedTask,
    studentAnswer: input.studentTaskAnswer,
    createdAt,
    diagnosisCaller: input.diagnosisCaller,
  });
  const feedback = buildStudentReadableFeedback({
    targetAbility,
    taskGoal: personalizedTask.task_goal,
    whyThisTask: personalizedTask.why_this_task,
    executionResult,
  });
  const nextStepHint = buildNextStepHint(executionResult);
  const validation = validatePersonalizedTrainingFlow({
    learningEntryResult: input.learningEntryResult,
    targetAbility,
    studentTaskAnswer: input.studentTaskAnswer,
    personalizedTask,
    executionResult,
    feedback,
    nextStepHint,
  });
  const flowStatus = resolveFlowStatus(validation.passed, executionResult.diagnosisFocusMatch);

  return {
    session_id: input.learningEntryResult.session_id,
    student_id: input.learningEntryResult.student_id,
    target_ability: targetAbility,
    learning_entry_result: input.learningEntryResult,
    personalized_task: personalizedTask,
    student_task_answer: input.studentTaskAnswer,
    task_diagnosis_result: executionResult.diagnosisResult,
    new_ability_evidence: executionResult.newAbilityEvidence,
    updated_evidence: executionResult.updatedEvidence,
    updated_student_ability_profile: executionResult.updatedStudentAbilityProfile,
    task_execution_summary: executionResult.taskExecutionSummary,
    student_readable_feedback: feedback,
    next_step_hint: nextStepHint,
    flow_status: flowStatus,
    validation,
  };
}

export async function personalizedTrainingFlowMockDiagnosisCaller(
  _prompt: string,
  input: Parameters<typeof runRealAIDiagnosisLoop>[0],
): Promise<string> {
  const answer = input.studentAnswer.trim();
  const mainAbility = input.questionMetadata?.mainAbility || '推理';
  const questionType = input.questionMetadata?.questionType || mainAbility;

  if (!answer) {
    return JSON.stringify({
      taskType: 'open_response',
      correct: null,
      strategyUsed: 'phase7_2_personalized_training_mock',
      answerStatus: 'insufficient_evidence',
      scoreBand: 'invalid',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: '学生未提交有效训练答案。',
      rootCause: '作答证据不足，暂不能判断训练任务完成情况。',
      errorType: '待验证',
      abilityEvidence: ['训练答案为空，无法形成有效能力证据。'],
      diagnosisSummary: '本次训练答案信息不足。',
      nextTraining: '请先补充训练答案，并写出文本依据或思考过程。',
      confidence: 0.42,
    });
  }

  const hasTextClue = /旧书|树叶|停了很久|反复整理|翻到|文本|线索|依据/.test(answer);
  const hasAbilityAction = /推断|说明|因为|所以|可以看出|由此|理由|心理|不舍|怀念|牵挂/.test(answer);
  const hasCompleteChain = /因为|所以|说明|可以看出|由此|理由/.test(answer) && hasTextClue && hasAbilityAction;

  if (hasCompleteChain) {
    return JSON.stringify({
      taskType: 'open_response',
      correct: true,
      strategyUsed: 'phase7_2_personalized_training_mock',
      answerStatus: 'fully_meets',
      scoreBand: 'high',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: '暂未发现明显表面错误。',
      rootCause: '学生能够围绕训练目标完成“文本线索 -> 能力动作 -> 说明”的完整表达。',
      errorType: '待验证',
      abilityEvidence: [
        `训练任务被识别为「${questionType}」，主要观察「${mainAbility}」。`,
        '学生答案包含文本线索。',
        '学生答案能够说明线索与结论之间的关系。',
      ],
      diagnosisSummary: '本次训练任务完成度较高，可以形成正向能力证据。',
      nextTraining: '建议进入同能力复测，观察方法是否能迁移到新文本。',
      confidence: 0.86,
    });
  }

  if (hasTextClue || hasAbilityAction) {
    return JSON.stringify({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'phase7_2_personalized_training_mock',
      answerStatus: 'partially_meets',
      scoreBand: 'medium',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: '学生答案已有训练目标相关内容，但链条不够完整。',
      rootCause: '学生能抓到部分线索或结论，但还没有稳定完成“文本线索 -> 结论 -> 说明”的完整训练动作。',
      errorType: '推理错误',
      abilityEvidence: [
        `训练任务被识别为「${questionType}」，主要观察「${mainAbility}」。`,
        '学生答案包含部分文本线索或判断。',
        '学生答案仍缺少完整说明过程。',
      ],
      diagnosisSummary: '本次训练任务部分满足要求，出现成长迹象但仍需巩固。',
      nextTraining: '继续练习把线索、判断和说明写完整。',
      confidence: 0.74,
    });
  }

  return JSON.stringify({
    taskType: 'open_response',
    correct: false,
    strategyUsed: 'phase7_2_personalized_training_mock',
    answerStatus: 'does_not_meet',
    scoreBand: 'low',
    mainAbility,
    relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
    surfaceError: '学生答案未回应训练任务的关键要求。',
    rootCause: '学生尚未提取有效文本线索，也没有完成目标能力动作。',
    errorType: '推理错误',
    abilityEvidence: [
      `训练任务被识别为「${questionType}」，主要观察「${mainAbility}」。`,
      '学生答案缺少有效文本依据。',
      '学生答案缺少可诊断的思考过程。',
    ],
    diagnosisSummary: '本次训练任务尚未达到要求，需要回到基础步骤。',
    nextTraining: '先找出一处文本线索，再写出它能说明什么。',
    confidence: 0.68,
  });
}

function resolveTargetAbility(learningEntryResult: LearningEntryResult): string {
  return learningEntryResult.initial_target_ability ||
    learningEntryResult.student_ability_profile.current_weakness.primary ||
    learningEntryResult.new_ability_evidence.ability ||
    learningEntryResult.diagnosis_result.mainAbility;
}

function buildStudentReadableFeedback(input: {
  targetAbility: string;
  taskGoal: string;
  whyThisTask: string;
  executionResult: PersonalizedTaskExecutionResult;
}): PersonalizedTrainingFlowFeedback {
  return {
    task_goal: input.taskGoal,
    why_this_task: input.whyThisTask,
    performance_summary: buildPerformanceSummary(input.executionResult),
    what_to_improve_next: buildImproveNext(input.targetAbility, input.executionResult),
  };
}

function buildPerformanceSummary(executionResult: PersonalizedTaskExecutionResult): string {
  const evidenceType = executionResult.newAbilityEvidence.evidenceType;

  if (!executionResult.diagnosisFocusMatch) {
    return '这次训练答案和原本训练目标不完全一致，需要先确认题目目标和作答方向是否对齐。';
  }

  if (evidenceType === 'positive') {
    return '这次训练完成度较高，答案能够回应任务要求，并提供了比较清楚的依据或说明。';
  }

  if (evidenceType === 'growth') {
    return '这次训练已经出现进步迹象，你能完成一部分关键步骤，但还需要继续巩固。';
  }

  if (evidenceType === 'weakness') {
    return '这次训练仍暴露出薄弱点，答案里还缺少关键依据、过程或完整说明。';
  }

  return '这次训练答案信息还不够，系统暂时不能稳定判断训练效果。';
}

function buildImproveNext(
  targetAbility: string,
  executionResult: PersonalizedTaskExecutionResult,
): string {
  if (!executionResult.diagnosisFocusMatch) {
    return `先回到「${targetAbility}」的训练目标，重新确认这道任务要练什么。`;
  }

  if (executionResult.next_decision === 'retest') {
    return '下一步可以进入复测，用新文本验证这次训练方法是否能迁移。';
  }

  if (executionResult.next_decision === 'increase_difficulty') {
    return `下一步可以继续练「${targetAbility}」，但适当提高任务难度。`;
  }

  if (executionResult.next_decision === 'switch_ability') {
    return '下一步可以降低当前能力优先级，观察是否需要切换到其他薄弱能力。';
  }

  return executionResult.diagnosisResult.nextTraining ||
    `下一步继续围绕「${targetAbility}」完成一次巩固训练。`;
}

function buildNextStepHint(executionResult: PersonalizedTaskExecutionResult): string {
  if (executionResult.next_decision === 'retest') {
    return '训练任务已完成，建议进入 Phase 7.3 复测验证。';
  }

  if (executionResult.next_decision === 'increase_difficulty') {
    return '训练任务已完成，可以提高同能力任务难度后继续练习。';
  }

  if (executionResult.next_decision === 'switch_ability') {
    return '训练任务已完成，可以观察是否切换到新的薄弱能力。';
  }

  return '训练任务已完成，建议继续进行一次同能力巩固训练。';
}

function resolveFlowStatus(
  validationPassed: boolean,
  diagnosisFocusMatch: boolean,
): PersonalizedTrainingFlowStatus {
  if (!validationPassed) return 'validation_failed';
  if (!diagnosisFocusMatch) return 'diagnosis_completed';

  return 'ready_for_retest';
}

function validatePersonalizedTrainingFlow(input: {
  learningEntryResult: LearningEntryResult;
  targetAbility: string;
  studentTaskAnswer: string;
  personalizedTask: ReturnType<typeof generatePersonalizedNextTask>;
  executionResult: PersonalizedTaskExecutionResult;
  feedback: PersonalizedTrainingFlowFeedback;
  nextStepHint: string;
}): PersonalizedTrainingFlowResult['validation'] {
  const issues: string[] = [];
  const entryEvidenceIds = new Set(input.learningEntryResult.updated_evidence.map((item) => item.id));

  if (!input.learningEntryResult.session_id.trim()) issues.push('session_id is required.');
  if (!input.learningEntryResult.student_id.trim()) issues.push('student_id is required.');
  if (!input.targetAbility.trim()) issues.push('target_ability is required.');
  if (input.personalizedTask.target_ability !== input.targetAbility) {
    issues.push('personalized_task.target_ability should match target_ability.');
  }
  if (!input.personalizedTask.why_this_task.trim()) issues.push('personalized_task.why_this_task is required.');
  if (input.personalizedTask.success_criteria.length === 0) {
    issues.push('personalized_task.success_criteria should not be empty.');
  }
  if (!input.personalizedTask.linked_evidence.some((item) => entryEvidenceIds.has(item.evidence_id))) {
    issues.push('personalized_task.linked_evidence should include evidence from Phase 7.1 updatedEvidence.');
  }
  if (typeof input.studentTaskAnswer !== 'string') issues.push('student_task_answer should be a string.');
  if (!input.executionResult.diagnosisResult.mainAbility.trim()) {
    issues.push('task_diagnosis_result.mainAbility is required.');
  }
  if (!input.executionResult.newAbilityEvidence.ability.trim()) {
    issues.push('new_ability_evidence.ability is required.');
  }
  if (!['diagnosis', 'training'].includes(input.executionResult.newAbilityEvidence.source)) {
    issues.push('new_ability_evidence.source should be diagnosis or training, not retest.');
  }
  if (input.executionResult.newAbilityEvidence.source === 'retest') {
    issues.push('new_ability_evidence.source should not be retest in Phase 7.2.');
  }
  if (!input.executionResult.diagnosisFocusMatch) {
    issues.push('diagnosis_focus_mismatch.');
  }
  if (input.executionResult.updatedEvidence.length < input.learningEntryResult.updated_evidence.length) {
    issues.push('updated_evidence should not shrink.');
  }
  if (!input.executionResult.updatedStudentAbilityProfile.current_weakness.primary.trim()) {
    issues.push('updated_student_ability_profile.current_weakness.primary is required.');
  }
  if (!input.feedback.task_goal.trim()) issues.push('student_readable_feedback.task_goal is required.');
  if (!input.feedback.why_this_task.trim()) issues.push('student_readable_feedback.why_this_task is required.');
  if (!input.feedback.performance_summary.trim()) {
    issues.push('student_readable_feedback.performance_summary is required.');
  }
  if (!input.feedback.what_to_improve_next.trim()) {
    issues.push('student_readable_feedback.what_to_improve_next is required.');
  }
  if (!input.nextStepHint.trim()) issues.push('next_step_hint is required.');

  return {
    passed: issues.length === 0,
    issues,
  };
}
