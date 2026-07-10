import { evaluateAbilityChange } from './abilityChangeEvaluationAgent.ts';
import { generateRetestTask } from './retestTaskAgent.ts';
import { runRetestExecution } from './retestExecutionAgent.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { LearningSessionMemory } from '../schemas/learningSession.schema.ts';
import type { PersonalizedTrainingFlowResult } from '../schemas/personalizedTrainingFlow.schema.ts';
import type { RetestTask } from '../schemas/retestTask.schema.ts';
import type {
  BetaLearningSessionFeedback,
  BetaLearningSessionResult,
  BetaLearningSessionStatus,
  BetaLearningSessionSummary,
} from '../schemas/betaLearningSessionResult.schema.ts';

export type BetaLearningSessionResultInput = {
  personalizedTrainingFlowResult: PersonalizedTrainingFlowResult;
  studentRetestAnswer: string;
  retestTask?: RetestTask;
  createdAt?: string;
};

export function generateRetestTaskFromTrainingFlow(
  personalizedTrainingFlowResult: PersonalizedTrainingFlowResult,
): ReturnType<typeof generateRetestTask> {
  const memory = buildLearningSessionMemory(personalizedTrainingFlowResult);

  return generateRetestTask({
    learningSessionMemory: memory,
    recentTrainingQuestions: [personalizedTrainingFlowResult.personalized_task.question],
  });
}

export async function runBetaLearningSessionResultAgent(
  input: BetaLearningSessionResultInput,
): Promise<BetaLearningSessionResult> {
  const trainingResult = input.personalizedTrainingFlowResult;
  const createdAt = input.createdAt || new Date().toISOString();
  const notReadyIssues = validateReadyForRetest(trainingResult);

  if (notReadyIssues.length > 0) {
    return buildNotReadyResult({
      trainingResult,
      issues: notReadyIssues,
      createdAt,
    });
  }

  const retestTaskResult = input.retestTask
    ? {
        can_generate: true,
        retest_task: input.retestTask,
        validation: { passed: true, issues: [] },
      }
    : generateRetestTaskFromTrainingFlow(trainingResult);
  const retestTask = retestTaskResult.retest_task;
  const generationIssues = [
    ...retestTaskResult.validation.issues,
    ...validateRetestTaskAgainstTraining({
      retestTask,
      trainingResult,
    }),
  ];

  if (!retestTaskResult.can_generate || !retestTask) {
    return buildNotReadyResult({
      trainingResult,
      issues: [
        'retest_task_generation_failed',
        retestTaskResult.skip_reason || 'RetestTaskAgent did not generate a retest task.',
        ...generationIssues,
      ],
      createdAt,
    });
  }

  const retestExecutionResult = await runRetestExecution({
    studentId: trainingResult.student_id,
    retestTask,
    studentRetestAnswer: input.studentRetestAnswer,
    previousEvidence: trainingResult.updated_evidence,
    createdAt,
  });
  const beforeEvidence = extractBeforeEvidence(trainingResult);
  const trainingEvidence = extractTrainingEvidence(trainingResult);
  const retestEvidence = [retestExecutionResult.new_retest_evidence];
  const abilityChangeEvaluation = evaluateAbilityChange({
    studentId: trainingResult.student_id,
    targetAbility: trainingResult.target_ability,
    beforeEvidence,
    trainingEvidence,
    taskExecutionEvidence: [],
    retestEvidence,
    updatedEvidence: retestExecutionResult.updated_evidence,
    studentAbilityProfile: retestExecutionResult.updated_student_ability_profile,
    evaluatedAt: createdAt,
  });
  const sessionStatus = mapSessionStatus(abilityChangeEvaluation.change_status);
  const summary = buildSessionSummary({
    trainingResult,
    retestTask,
    retestEvidence: retestExecutionResult.new_retest_evidence,
    abilityChangeEvaluation,
  });
  const feedback = buildStudentFeedback({
    targetAbility: trainingResult.target_ability,
    sessionStatus,
    summary,
    changeStatus: abilityChangeEvaluation.change_status,
  });
  const validation = validateResult({
    trainingResult,
    retestTask,
    retestExecutionResult,
    abilityChangeEvaluation,
    generationIssues,
  });

  return {
    session_id: trainingResult.session_id,
    student_id: trainingResult.student_id,
    target_ability: trainingResult.target_ability,
    personalized_training_result_id: trainingResult.personalized_task.task_id,
    personalized_training_result: trainingResult,
    retest_task: retestTask,
    student_retest_answer: input.studentRetestAnswer,
    retest_execution_result: retestExecutionResult,
    ability_change_evaluation: abilityChangeEvaluation,
    session_summary: summary,
    student_readable_feedback: feedback,
    session_status: validation.passed ? sessionStatus : 'validation_failed',
    persistence_status: 'not_persisted',
    validation,
  };
}

function buildLearningSessionMemory(
  trainingResult: PersonalizedTrainingFlowResult,
): LearningSessionMemory {
  const summary = trainingResult.task_execution_summary;
  const beforeWeakness = summary.before.weakness_evidence_count;
  const afterWeakness = summary.after.weakness_evidence_count;
  const beforeGrowth = summary.before.growth_evidence_count;
  const afterGrowth = summary.after.growth_evidence_count;
  const afterPositive = trainingResult.updated_evidence.filter((item) => (
    item.ability === trainingResult.target_ability &&
    item.evidenceType === 'positive'
  )).length;

  return {
    session_id: trainingResult.session_id,
    student_id: trainingResult.student_id,
    target_ability: trainingResult.target_ability,
    started_at: trainingResult.learning_entry_result.new_ability_evidence.createdAt,
    ended_at: trainingResult.new_ability_evidence.createdAt,
    task_execution_ids: [trainingResult.personalized_task.task_id],
    task_execution_snapshots: [
      {
        task_id: trainingResult.personalized_task.task_id,
        diagnosis_answer_status: summary.execution.diagnosis_answer_status,
        diagnosis_main_ability: summary.execution.diagnosis_main_ability,
        diagnosis_focus_match: summary.execution.diagnosis_focus_match,
        new_evidence_type: summary.execution.new_evidence_type,
        next_decision: summary.next_decision,
      },
    ],
    evidence_ids: trainingResult.updated_evidence.map((item) => item.id),
    task_count: 1,
    weakness_evidence_count_before: beforeWeakness,
    weakness_evidence_count_after: afterWeakness,
    growth_evidence_count_before: beforeGrowth,
    growth_evidence_count_after: afterGrowth,
    positive_evidence_count_before: 0,
    positive_evidence_count_after: afterPositive,
    session_status: 'needs_retest',
    session_outcome: trainingResult.new_ability_evidence.evidenceType === 'positive'
      ? 'needs_retest_validation'
      : 'early_improvement_signal',
    summary: trainingResult.student_readable_feedback.performance_summary,
    next_recommendation: {
      decision: 'retest',
      reason: trainingResult.next_step_hint || '训练任务已完成，需要通过复测验证迁移表现。',
    },
  };
}

function validateReadyForRetest(trainingResult: PersonalizedTrainingFlowResult): string[] {
  const issues: string[] = [];

  if (trainingResult.flow_status !== 'ready_for_retest') {
    issues.push('not_ready_for_retest');
  }
  if (!trainingResult.session_id.trim()) issues.push('session_id is required.');
  if (!trainingResult.student_id.trim()) issues.push('student_id is required.');
  if (!trainingResult.target_ability.trim()) issues.push('target_ability is required.');

  return issues;
}

function validateRetestTaskAgainstTraining(input: {
  retestTask?: RetestTask;
  trainingResult: PersonalizedTrainingFlowResult;
}): string[] {
  const issues: string[] = [];

  if (!input.retestTask) return ['retest_task is required.'];

  if (input.retestTask.target_ability !== input.trainingResult.target_ability) {
    issues.push('RetestTask.target_ability should match PersonalizedTrainingFlowResult.target_ability.');
  }
  if (normalize(input.retestTask.question) === normalize(input.trainingResult.personalized_task.question)) {
    issues.push('RetestTask.question should not repeat the personalized training task question.');
  }
  if (!input.retestTask.reference_answer.trim()) issues.push('RetestTask.reference_answer is required.');
  if (input.retestTask.scoring_points.length === 0) issues.push('RetestTask.scoring_points should not be empty.');
  if (input.retestTask.success_criteria.length === 0) issues.push('RetestTask.success_criteria should not be empty.');
  if (!input.retestTask.linked_session_id.trim()) {
    issues.push('RetestTask.linked_session_id or traceable training reference is required.');
  }

  return issues;
}

function extractBeforeEvidence(trainingResult: PersonalizedTrainingFlowResult): AbilityEvidence[] {
  return [trainingResult.learning_entry_result.new_ability_evidence]
    .filter((item) => item.ability === trainingResult.target_ability);
}

function extractTrainingEvidence(trainingResult: PersonalizedTrainingFlowResult): AbilityEvidence[] {
  return [trainingResult.new_ability_evidence]
    .filter((item) => item.ability === trainingResult.target_ability);
}

function buildSessionSummary(input: {
  trainingResult: PersonalizedTrainingFlowResult;
  retestTask: RetestTask;
  retestEvidence: AbilityEvidence;
  abilityChangeEvaluation: ReturnType<typeof evaluateAbilityChange>;
}): BetaLearningSessionSummary {
  return {
    initial_problem: input.trainingResult.learning_entry_result.diagnosis_result.rootCause,
    training_focus: input.trainingResult.personalized_task.task_goal,
    retest_result: input.retestEvidence.observation,
    ability_change_summary: input.abilityChangeEvaluation.change_reason,
    next_learning_decision: input.abilityChangeEvaluation.next_decision_reason,
  };
}

function buildStudentFeedback(input: {
  targetAbility: string;
  sessionStatus: BetaLearningSessionStatus;
  summary: BetaLearningSessionSummary;
  changeStatus: string;
}): BetaLearningSessionFeedback {
  if (input.changeStatus === 'likely_improved') {
    return {
      title: `本轮学习结果：${input.targetAbility}能力出现改善迹象`,
      summary: '你完成了诊断、训练和复测。复测中已经能更好地使用刚才练过的方法。',
      what_improved: input.summary.retest_result,
      what_still_needs_work: '这还不等于长期稳定掌握，后续还需要用不同文本继续验证。',
      next_step: '下一步建议再做一次同能力复测，确认这种方法能否稳定迁移。',
    };
  }

  if (input.changeStatus === 'not_transferred') {
    return {
      title: '本轮学习结果：训练中有改善，但复测没有迁移成功',
      summary: '你在训练任务中出现进步，但换到新题后表现又不稳定。',
      what_still_needs_work: '需要继续练习把文本依据和结论联系起来。',
      next_step: '下一步建议降低一点难度，继续围绕同一能力训练。',
    };
  }

  if (input.changeStatus === 'still_weak') {
    return {
      title: '本轮学习结果：当前能力仍然不稳定',
      summary: '从第一题、训练任务到复测，目标能力仍持续暴露薄弱表现。',
      what_still_needs_work: input.summary.initial_problem,
      next_step: '下一步建议继续围绕同一能力训练，从更短文本开始。',
    };
  }

  if (input.changeStatus === 'ready_to_switch_ability') {
    return {
      title: '本轮学习结果：当前能力可以暂时降低训练优先级',
      summary: '本轮证据显示目标能力出现较稳定的改善迹象。',
      what_improved: input.summary.retest_result,
      next_step: '下一步可以观察是否转向当前更突出的薄弱能力。',
    };
  }

  return {
    title: '本轮学习结果：目前证据还不足',
    summary: '这次复测还不足以判断训练是否真正有效。',
    what_still_needs_work: '需要补充一题同能力复测，形成更稳定的判断依据。',
    next_step: '下一步建议再完成一题同能力复测，收集更多有效证据。',
  };
}

function mapSessionStatus(changeStatus: string): BetaLearningSessionStatus {
  if (changeStatus === 'likely_improved') return 'completed';
  if (changeStatus === 'not_transferred') return 'needs_more_training';
  if (changeStatus === 'still_weak') return 'needs_more_training';
  if (changeStatus === 'needs_more_evidence') return 'needs_more_evidence';
  if (changeStatus === 'ready_to_switch_ability') return 'ready_for_next_ability';

  return 'needs_more_evidence';
}

function validateResult(input: {
  trainingResult: PersonalizedTrainingFlowResult;
  retestTask: RetestTask;
  retestExecutionResult: Awaited<ReturnType<typeof runRetestExecution>>;
  abilityChangeEvaluation: ReturnType<typeof evaluateAbilityChange>;
  generationIssues: string[];
}): BetaLearningSessionResult['validation'] {
  const issues = [...input.generationIssues];

  if (input.retestTask.target_ability !== input.trainingResult.target_ability) {
    issues.push('retest_target_ability_mismatch.');
  }
  if (input.retestExecutionResult.new_retest_evidence.source !== 'retest') {
    issues.push('retest_evidence_source_should_be_retest.');
  }
  if (!input.retestExecutionResult.new_retest_evidence.ability.trim()) {
    issues.push('retest_evidence_ability_required.');
  }
  if (input.retestExecutionResult.new_retest_evidence.ability !== input.trainingResult.target_ability) {
    issues.push('retest_evidence_ability_mismatch.');
  }
  if (input.retestExecutionResult.diagnosis_result.mainAbility !== input.trainingResult.target_ability) {
    issues.push('retest_diagnosis_focus_mismatch.');
  }
  if (!input.abilityChangeEvaluation.change_status.trim()) {
    issues.push('ability_change_status_required.');
  }
  if (!input.abilityChangeEvaluation.next_decision.trim()) {
    issues.push('ability_change_next_decision_required.');
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function buildNotReadyResult(input: {
  trainingResult: PersonalizedTrainingFlowResult;
  issues: string[];
  createdAt: string;
}): BetaLearningSessionResult {
  const summary = {
    initial_problem: input.trainingResult.learning_entry_result.diagnosis_result.rootCause,
    training_focus: input.trainingResult.personalized_task.task_goal,
    retest_result: '训练流程尚未进入 ready_for_retest，暂不生成复测结果。',
    ability_change_summary: '当前不能进行能力变化判断。',
    next_learning_decision: '请先完成训练任务并等待训练诊断完成。',
  };

  return {
    session_id: input.trainingResult.session_id,
    student_id: input.trainingResult.student_id,
    target_ability: input.trainingResult.target_ability,
    personalized_training_result_id: input.trainingResult.personalized_task.task_id,
    personalized_training_result: input.trainingResult,
    session_summary: summary,
    student_readable_feedback: {
      title: '暂时不能进入复测',
      summary: '当前训练流程还没有完成到可以复测的状态。',
      next_step: '请先完成个性化训练任务，再进入复测。',
    },
    session_status: 'not_ready_for_retest',
    persistence_status: 'not_persisted',
    validation: {
      passed: false,
      issues: input.issues,
    },
  };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').trim();
}
