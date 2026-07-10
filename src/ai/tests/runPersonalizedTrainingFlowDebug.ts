import {
  learningEntryMockDiagnosisCaller,
  runLearningEntryAgent,
} from '../agents/learningEntryAgent.ts';
import {
  personalizedTrainingFlowMockDiagnosisCaller,
  runPersonalizedTrainingFlowAgent,
} from '../agents/personalizedTrainingFlowAgent.ts';
import { isPersonalizedTrainingFlowResult } from '../schemas/personalizedTrainingFlow.schema.ts';

const studentId = 'phase72-demo-student';
const question = '阅读片段：父亲反复整理旧书，翻到“我”小时候夹在书里的树叶时，停了很久。由此可以推断出父亲怎样的心理？请结合文本线索说明理由。';
const referenceAnswer = '可以推断父亲看到旧书和树叶后想起与孩子共同读书的回忆，内心有不舍、珍惜和牵挂。理由应结合“反复整理旧书”“停了很久”等文本线索说明。';
const entryStudentAnswer = '父亲很喜欢整理东西。';
const studentTaskAnswer = '父亲反复整理旧书，翻到我小时候夹在书里的树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。';

async function runPersonalizedTrainingFlowDebug(): Promise<void> {
  const failures: string[] = [];
  const learningEntryResult = await runLearningEntryAgent({
    studentId,
    question,
    referenceAnswer,
    studentAnswer: entryStudentAnswer,
    diagnosisCaller: learningEntryMockDiagnosisCaller,
    createdAt: '2026-07-10T14:00:00.000Z',
  });
  const result = await runPersonalizedTrainingFlowAgent({
    learningEntryResult,
    studentTaskAnswer,
    diagnosisCaller: personalizedTrainingFlowMockDiagnosisCaller,
    createdAt: '2026-07-10T14:05:00.000Z',
  });

  validate(result, failures);
  printReport(result, failures);

  if (failures.length > 0) {
    throw new Error('Personalized Training Flow debug check failed.');
  }
}

function validate(
  result: Awaited<ReturnType<typeof runPersonalizedTrainingFlowAgent>>,
  failures: string[],
): void {
  const entryEvidenceIds = new Set(result.learning_entry_result.updated_evidence.map((item) => item.id));

  if (!isPersonalizedTrainingFlowResult(result)) {
    failures.push('PersonalizedTrainingFlowResult should match schema.');
  }
  if (result.student_id !== studentId) failures.push('student_id should match input.');
  if (!result.session_id.trim()) failures.push('session_id should not be empty.');
  if (!result.target_ability.trim()) failures.push('target_ability should not be empty.');
  if (result.personalized_task.target_ability !== result.target_ability) {
    failures.push('personalized_task.target_ability should match target_ability.');
  }
  if (!result.personalized_task.why_this_task.trim()) failures.push('why_this_task should not be empty.');
  if (result.personalized_task.success_criteria.length === 0) {
    failures.push('success_criteria should not be empty.');
  }
  if (!result.personalized_task.linked_evidence.some((item) => entryEvidenceIds.has(item.evidence_id))) {
    failures.push('linked_evidence should include Phase 7.1 evidence id.');
  }
  if (result.student_task_answer !== studentTaskAnswer) failures.push('student_task_answer should match input.');
  if (!result.task_diagnosis_result.mainAbility.trim()) failures.push('task_diagnosis_result.mainAbility should not be empty.');
  if (!result.new_ability_evidence.ability.trim()) failures.push('new_ability_evidence.ability should not be empty.');
  if (result.new_ability_evidence.source === 'retest') failures.push('new_ability_evidence.source should not be retest.');
  if (!['diagnosis', 'training'].includes(result.new_ability_evidence.source)) {
    failures.push('new_ability_evidence.source should be legal for Phase 7.2.');
  }
  if (result.updated_evidence.length < result.learning_entry_result.updated_evidence.length) {
    failures.push('updated_evidence should not shrink.');
  }
  if (!result.updated_student_ability_profile.current_weakness.primary.trim()) {
    failures.push('updated_student_ability_profile.current_weakness.primary should not be empty.');
  }
  if (!result.task_execution_summary.execution.diagnosis_focus_match) {
    failures.push('task_execution_summary.diagnosisFocusMatch should be true in debug sample.');
  }
  if (!result.student_readable_feedback.task_goal.trim()) failures.push('student_readable_feedback.task_goal should not be empty.');
  if (!result.student_readable_feedback.performance_summary.trim()) {
    failures.push('student_readable_feedback.performance_summary should not be empty.');
  }
  if (!result.student_readable_feedback.what_to_improve_next.trim()) {
    failures.push('student_readable_feedback.what_to_improve_next should not be empty.');
  }
  if (result.flow_status !== 'ready_for_retest') failures.push('flow_status should be ready_for_retest.');
  if (!result.validation.passed) {
    failures.push(`validation should pass: ${result.validation.issues.join('; ')}`);
  }
}

function printReport(
  result: Awaited<ReturnType<typeof runPersonalizedTrainingFlowAgent>>,
  failures: string[],
): void {
  const beforeWeakness = result.learning_entry_result.student_ability_profile.current_weakness.primary;

  console.log('\nPersonalized Training Flow Debug Report');
  console.log('=======================================');

  console.log('\nInput');
  console.log('-----');
  console.log(`studentId: ${result.student_id}`);
  console.log(`sessionId: ${result.session_id}`);
  console.log(`targetAbility: ${result.target_ability}`);
  console.log(`previousWeakness: ${beforeWeakness}`);
  console.log(`evidenceCountBefore: ${result.learning_entry_result.updated_evidence.length}`);

  console.log('\nGenerated Task');
  console.log('--------------');
  console.log(`taskId: ${result.personalized_task.task_id}`);
  console.log(`targetAbility: ${result.personalized_task.target_ability}`);
  console.log(`taskGoal: ${result.personalized_task.task_goal}`);
  console.log(`whyThisTask: ${result.personalized_task.why_this_task}`);
  console.log(`linkedEvidence: ${result.personalized_task.linked_evidence.map((item) => item.evidence_id).join(', ')}`);
  console.log(`successCriteria: ${result.personalized_task.success_criteria.join('；')}`);

  console.log('\nStudent Task Answer');
  console.log('-------------------');
  console.log(result.student_task_answer);

  console.log('\nTask Diagnosis');
  console.log('--------------');
  console.log(`mainAbility: ${result.task_diagnosis_result.mainAbility}`);
  console.log(`answerStatus: ${result.task_diagnosis_result.answerStatus || 'unknown'}`);
  console.log(`rootCause: ${result.task_diagnosis_result.rootCause}`);

  console.log('\nNew Ability Evidence');
  console.log('--------------------');
  console.log(`ability: ${result.new_ability_evidence.ability}`);
  console.log(`evidenceType: ${result.new_ability_evidence.evidenceType}`);
  console.log(`source: ${result.new_ability_evidence.source}`);
  console.log(`confidence: ${Math.round(result.new_ability_evidence.confidence * 100)}%`);

  console.log('\nUpdated Profile');
  console.log('---------------');
  console.log(`currentWeakness: ${result.updated_student_ability_profile.current_weakness.primary}`);
  console.log(`abilityStatus: ${result.updated_student_ability_profile.ability_status.map((item) => `${item.ability}/${item.status}`).join(', ')}`);
  console.log(`nextStepRecommendation: ${result.updated_student_ability_profile.next_step_recommendation}`);

  console.log('\nTask Execution Summary');
  console.log('----------------------');
  console.log(`diagnosisFocusMatch: ${result.task_execution_summary.execution.diagnosis_focus_match}`);
  console.log(`executionSummary: ${result.task_execution_summary.decision_reason}`);
  console.log(`newEvidenceId: ${result.new_ability_evidence.id}`);

  console.log('\nStudent Readable Feedback');
  console.log('-------------------------');
  console.log(`taskGoal: ${result.student_readable_feedback.task_goal}`);
  console.log(`performanceSummary: ${result.student_readable_feedback.performance_summary}`);
  console.log(`whatToImproveNext: ${result.student_readable_feedback.what_to_improve_next}`);

  console.log('\nFlow');
  console.log('----');
  console.log(`flowStatus: ${result.flow_status}`);

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 7.2 Personalized Training Flow minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 7.2 Personalized Training Flow minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

runPersonalizedTrainingFlowDebug();
