import { generateRetestTask } from '../agents/retestTaskAgent.ts';
import { isLearningSessionMemory, type LearningSessionMemory } from '../schemas/learningSession.schema.ts';
import { isRetestTaskGenerationResult } from '../schemas/retestTask.schema.ts';

const learningSessionMemory: LearningSessionMemory = {
  session_id: 'phase61-session-inference-001',
  student_id: 'phase61-demo-student',
  target_ability: '推理',
  started_at: '2026-07-10T10:00:00.000Z',
  ended_at: '2026-07-10T10:30:00.000Z',
  task_execution_ids: [
    'phase53-task-inference-001',
    'phase53-task-inference-002',
    'phase53-task-inference-003',
  ],
  task_execution_snapshots: [
    {
      task_id: 'phase53-task-inference-001',
      diagnosis_answer_status: 'does_not_meet',
      diagnosis_main_ability: '推理',
      diagnosis_focus_match: true,
      new_evidence_type: 'weakness',
      next_decision: 'continue_reinforcement',
    },
    {
      task_id: 'phase53-task-inference-002',
      diagnosis_answer_status: 'partially_meets',
      diagnosis_main_ability: '推理',
      diagnosis_focus_match: true,
      new_evidence_type: 'growth',
      next_decision: 'continue_reinforcement',
    },
    {
      task_id: 'phase53-task-inference-003',
      diagnosis_answer_status: 'partially_meets',
      diagnosis_main_ability: '推理',
      diagnosis_focus_match: true,
      new_evidence_type: 'growth',
      next_decision: 'retest',
    },
  ],
  evidence_ids: [
    'phase53-evidence-inference-001',
    'phase53-evidence-inference-002',
    'phase53-evidence-inference-003',
  ],
  task_count: 3,
  weakness_evidence_count_before: 1,
  weakness_evidence_count_after: 2,
  growth_evidence_count_before: 0,
  growth_evidence_count_after: 2,
  positive_evidence_count_before: 0,
  positive_evidence_count_after: 0,
  session_status: 'needs_retest',
  session_outcome: 'needs_retest_validation',
  summary: '本轮 Session 围绕「推理」完成 3 次任务执行，训练中出现改善迹象，但缺少 retest evidence。',
  next_recommendation: {
    decision: 'retest',
    reason: '训练任务中出现改善，但缺少 retest evidence，下一步应换题验证。',
  },
};

const recentTrainingQuestions = [
  [
    '阅读片段：',
    '父亲反复整理旧书，又在树下停了很久。',
    '请结合文本推断父亲当时的心理，并说明依据。',
  ].join('\n'),
];

function runRetestTaskDebug(): void {
  const failures: string[] = [];

  if (!isLearningSessionMemory(learningSessionMemory)) {
    failures.push('Input LearningSessionMemory should match schema.');
  }

  const result = generateRetestTask({
    learningSessionMemory,
    recentTrainingQuestions,
  });

  validate(result, failures);
  printReport(result, failures);

  if (failures.length > 0) {
    throw new Error('Retest Task debug check failed.');
  }
}

function validate(
  result: ReturnType<typeof generateRetestTask>,
  failures: string[],
): void {
  if (!isRetestTaskGenerationResult(result)) {
    failures.push('RetestTaskGenerationResult should match schema.');
    return;
  }

  if (!result.can_generate) failures.push('can_generate should be true for retest recommendation.');
  if (!result.retest_task) {
    failures.push('retest_task should exist.');
    return;
  }

  const task = result.retest_task;

  if (learningSessionMemory.next_recommendation.decision !== 'retest') {
    failures.push('Debug input should use next_recommendation.decision=retest.');
  }
  if (!task.retest_task_id) failures.push('retest_task_id should not be empty.');
  if (task.target_ability !== learningSessionMemory.target_ability) {
    failures.push('target_ability should match LearningSessionMemory.target_ability.');
  }
  if (task.linked_session_id !== learningSessionMemory.session_id) {
    failures.push('linked_session_id should match LearningSessionMemory.session_id.');
  }
  if (task.source_session_outcome !== learningSessionMemory.session_outcome) {
    failures.push('source_session_outcome should match LearningSessionMemory.session_outcome.');
  }
  if (task.source_next_recommendation !== learningSessionMemory.next_recommendation.decision) {
    failures.push('source_next_recommendation should match LearningSessionMemory.next_recommendation.decision.');
  }
  if (!task.why_retest_now.includes(learningSessionMemory.session_outcome)) {
    failures.push('why_retest_now should reference session_outcome.');
  }
  if (recentTrainingQuestions.includes(task.question)) {
    failures.push('Retest question should not repeat recent training question.');
  }
  if (!task.question.includes('母亲') && !task.question.includes('菜苗')) {
    failures.push('Retest question should use a new text/context.');
  }
  if (!task.reference_answer) failures.push('reference_answer should not be empty.');
  if (task.scoring_points.length === 0) failures.push('scoring_points should not be empty.');
  if (task.success_criteria.length === 0) failures.push('success_criteria should not be empty.');
  if (task.expected_evaluation_focus.length === 0) {
    failures.push('expected_evaluation_focus should not be empty.');
  }
  if (!result.validation.passed) {
    failures.push(`Agent validation should pass: ${result.validation.issues.join('; ')}`);
  }
}

function printReport(
  result: ReturnType<typeof generateRetestTask>,
  failures: string[],
): void {
  console.log('\nRetest Task Debug Report');
  console.log('========================');

  console.log('\nInput Session');
  console.log('-------------');
  console.log(`session_id: ${learningSessionMemory.session_id}`);
  console.log(`target_ability: ${learningSessionMemory.target_ability}`);
  console.log(`session_outcome: ${learningSessionMemory.session_outcome}`);
  console.log(`next_recommendation: ${learningSessionMemory.next_recommendation.decision}`);
  console.log(`next_recommendation.reason: ${learningSessionMemory.next_recommendation.reason}`);

  console.log('\nGenerated Retest Task');
  console.log('---------------------');
  if (result.retest_task) {
    const task = result.retest_task;
    console.log(`retest_task_id: ${task.retest_task_id}`);
    console.log(`target_ability: ${task.target_ability}`);
    console.log(`retest_goal: ${task.retest_goal}`);
    console.log(`why_retest_now: ${task.why_retest_now}`);
    console.log(`question:\n${task.question}`);
    console.log(`scoring_points: ${task.scoring_points.join(' / ')}`);
    console.log(`success_criteria: ${task.success_criteria.join(' / ')}`);
    console.log(`expected_evaluation_focus: ${task.expected_evaluation_focus.join(' / ')}`);
  } else {
    console.log(`skip_reason: ${result.skip_reason || 'unknown'}`);
  }

  console.log('\nValidation');
  console.log('----------');
  console.log(`target ability match: ${result.retest_task?.target_ability === learningSessionMemory.target_ability}`);
  console.log(`linked session match: ${result.retest_task?.linked_session_id === learningSessionMemory.session_id}`);
  console.log(`has new context: ${Boolean(result.retest_task && !recentTrainingQuestions.includes(result.retest_task.question))}`);
  console.log(`can enter Diagnosis Runtime: ${Boolean(result.retest_task?.question && result.retest_task.reference_answer)}`);
  console.log(`generation result valid: ${result.validation.passed}`);

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 6.1 Retest Task Generation minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 6.1 Retest Task Generation minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

runRetestTaskDebug();
