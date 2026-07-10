import {
  generateLearningSessionMemory,
  type LearningSessionExecutionInput,
} from '../agents/learningSessionAgent.ts';
import { isLearningSessionMemory } from '../schemas/learningSession.schema.ts';
import type { PersonalizedTaskExecutionSummary } from '../schemas/personalizedTaskExecution.schema.ts';

const studentId = 'phase53-demo-student';
const targetAbility = '推理';

const executions: LearningSessionExecutionInput[] = [
  {
    evidence_id: 'phase53-evidence-inference-001',
    evidence_source: 'diagnosis',
    summary: buildExecutionSummary({
      index: 1,
      answerStatus: 'does_not_meet',
      evidenceType: 'weakness',
      beforeWeakness: 1,
      beforeGrowth: 0,
      afterWeakness: 2,
      afterGrowth: 0,
      afterStatus: 'weak',
      nextDecision: 'continue_reinforcement',
      decisionReason: '本次仍暴露推理链薄弱，需要继续强化。',
    }),
  },
  {
    evidence_id: 'phase53-evidence-inference-002',
    evidence_source: 'training',
    summary: buildExecutionSummary({
      index: 2,
      answerStatus: 'partially_meets',
      evidenceType: 'growth',
      beforeWeakness: 2,
      beforeGrowth: 0,
      afterWeakness: 2,
      afterGrowth: 1,
      afterStatus: 'improving',
      nextDecision: 'continue_reinforcement',
      decisionReason: '出现成长证据，但历史 weakness 仍存在，需要继续巩固。',
    }),
  },
  {
    evidence_id: 'phase53-evidence-inference-003',
    evidence_source: 'training',
    summary: buildExecutionSummary({
      index: 3,
      answerStatus: 'partially_meets',
      evidenceType: 'growth',
      beforeWeakness: 2,
      beforeGrowth: 1,
      afterWeakness: 2,
      afterGrowth: 2,
      afterStatus: 'improving',
      nextDecision: 'retest',
      decisionReason: '连续出现改善迹象，需要复测验证迁移稳定性。',
    }),
  },
];

function runLearningSessionDebug(): void {
  const failures: string[] = [];
  const memory = generateLearningSessionMemory({
    sessionId: 'phase53-session-inference-001',
    studentId,
    targetAbility,
    startedAt: '2026-07-10T10:00:00.000Z',
    endedAt: '2026-07-10T10:30:00.000Z',
    executions,
  });

  validate(memory, failures);
  printReport(memory, failures);

  if (failures.length > 0) {
    throw new Error('Learning Session Memory debug check failed.');
  }
}

function buildExecutionSummary(input: {
  index: number;
  answerStatus: string;
  evidenceType: string;
  beforeWeakness: number;
  beforeGrowth: number;
  afterWeakness: number;
  afterGrowth: number;
  afterStatus: string;
  nextDecision: PersonalizedTaskExecutionSummary['next_decision'];
  decisionReason: string;
}): PersonalizedTaskExecutionSummary {
  return {
    before: {
      target_ability: targetAbility,
      weakness_evidence_count: input.beforeWeakness,
      growth_evidence_count: input.beforeGrowth,
      status: input.beforeWeakness > 0 && input.beforeGrowth > 0 ? 'improving' : 'weak',
      reason: `第 ${input.index} 次任务前，「${targetAbility}」仍存在 ${input.beforeWeakness} 条 weakness evidence。`,
    },
    execution: {
      task_id: `phase53-task-inference-00${input.index}`,
      target_ability: targetAbility,
      student_answer: `第 ${input.index} 次模拟答案。`,
      diagnosis_answer_status: input.answerStatus,
      diagnosis_main_ability: targetAbility,
      diagnosis_focus_match: true,
      new_evidence_type: input.evidenceType,
    },
    after: {
      target_ability: targetAbility,
      evidence_updated: true,
      weakness_evidence_count: input.afterWeakness,
      growth_evidence_count: input.afterGrowth,
      status: input.afterStatus,
    },
    review_status: 'PASS',
    review_reason: 'DiagnosisResult.mainAbility 与 PersonalizedNextTask.target_ability 一致，本次证据可进入目标能力更新。',
    next_decision: input.nextDecision,
    decision_reason: input.decisionReason,
  };
}

function validate(
  memory: ReturnType<typeof generateLearningSessionMemory>,
  failures: string[],
): void {
  if (!isLearningSessionMemory(memory)) failures.push('LearningSessionMemory should match schema.');
  if (executions.length !== 3) failures.push('Debug should use exactly 3 task execution summaries.');
  if (memory.task_count !== 3) failures.push('task_count should equal 3.');
  if (memory.target_ability !== '推理') failures.push('target_ability should be 推理.');
  if (memory.task_execution_ids.length !== 3) failures.push('task_execution_ids length should equal 3.');
  if (memory.task_execution_snapshots.length !== 3) failures.push('task_execution_snapshots length should equal 3.');
  if (memory.evidence_ids.length === 0) failures.push('evidence_ids should not be empty.');
  if (!memory.session_outcome) failures.push('session_outcome should not be empty.');
  if (!memory.next_recommendation.decision) failures.push('next_recommendation.decision should not be empty.');
  if (!memory.next_recommendation.reason) failures.push('next_recommendation.reason should not be empty.');
  if (!memory.task_execution_snapshots.every((snapshot) => snapshot.diagnosis_focus_match)) {
    failures.push('All task execution snapshots should keep diagnosis_focus_match=true.');
  }
}

function printReport(
  memory: ReturnType<typeof generateLearningSessionMemory>,
  failures: string[],
): void {
  console.log('\nLearning Session Debug Report');
  console.log('=============================');

  console.log('\nSession');
  console.log('-------');
  console.log(`Session ID: ${memory.session_id}`);
  console.log(`Student ID: ${memory.student_id}`);
  console.log(`Target Ability: ${memory.target_ability}`);

  console.log('\nBefore');
  console.log('------');
  console.log(`weakness count: ${memory.weakness_evidence_count_before}`);
  console.log(`growth count: ${memory.growth_evidence_count_before}`);
  console.log(`positive count: ${memory.positive_evidence_count_before}`);
  console.log(`ability status: ${executions[0].summary.before.status}`);

  console.log('\nTask Executions');
  console.log('---------------');
  for (const [index, snapshot] of memory.task_execution_snapshots.entries()) {
    console.log(`${index + 1}. ${snapshot.task_id}`);
    console.log(`   diagnosis_answer_status: ${snapshot.diagnosis_answer_status}`);
    console.log(`   diagnosis_main_ability: ${snapshot.diagnosis_main_ability}`);
    console.log(`   diagnosis_focus_match: ${snapshot.diagnosis_focus_match}`);
    console.log(`   new_evidence_type: ${snapshot.new_evidence_type}`);
    console.log(`   next_decision: ${snapshot.next_decision}`);
  }

  console.log('\nAfter');
  console.log('-----');
  console.log(`weakness count: ${memory.weakness_evidence_count_after}`);
  console.log(`growth count: ${memory.growth_evidence_count_after}`);
  console.log(`positive count: ${memory.positive_evidence_count_after}`);
  console.log(`ability status: ${executions[executions.length - 1].summary.after.status}`);

  console.log('\nSession Outcome');
  console.log('---------------');
  console.log(memory.session_outcome);

  console.log('\nNext Recommendation');
  console.log('-------------------');
  console.log(`${memory.next_recommendation.decision}: ${memory.next_recommendation.reason}`);

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(memory, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 5.3 Learning Session Memory minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 5.3 Learning Session Memory minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

runLearningSessionDebug();
