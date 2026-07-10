import {
  learningEntryMockDiagnosisCaller,
  runLearningEntryAgent,
} from '../agents/learningEntryAgent.ts';
import {
  personalizedTrainingFlowMockDiagnosisCaller,
  runPersonalizedTrainingFlowAgent,
} from '../agents/personalizedTrainingFlowAgent.ts';
import {
  generateRetestTaskFromTrainingFlow,
  runBetaLearningSessionResultAgent,
} from '../agents/betaLearningSessionResultAgent.ts';
import { isBetaLearningSessionResult } from '../schemas/betaLearningSessionResult.schema.ts';

const studentId = 'phase73-demo-student';
const question = '阅读片段：父亲反复整理旧书，翻到“我”小时候夹在书里的树叶时，停了很久。由此可以推断出父亲怎样的心理？请结合文本线索说明理由。';
const referenceAnswer = '可以推断父亲看到旧书和树叶后想起与孩子共同读书的回忆，内心有不舍、珍惜和牵挂。理由应结合“反复整理旧书”“停了很久”等文本线索说明。';
const entryStudentAnswer = '父亲很喜欢整理东西。';
const trainingAnswer = '父亲反复整理旧书，翻到我小时候夹在书里的树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。';
const studentRetestAnswer = '母亲雨停后没有立刻回屋，而是把菜苗一株株扶正，袖口还沾满泥水，第二天又用小竹竿固定菜苗。由此可以看出她很心疼这些菜苗，也很珍惜自己照料的生活成果，希望菜苗继续生长。';

async function runBetaLearningSessionResultDebug(): Promise<void> {
  const failures: string[] = [];
  const learningEntryResult = await runLearningEntryAgent({
    studentId,
    question,
    referenceAnswer,
    studentAnswer: entryStudentAnswer,
    diagnosisCaller: learningEntryMockDiagnosisCaller,
    createdAt: '2026-07-10T15:00:00.000Z',
  });
  const trainingFlowResult = await runPersonalizedTrainingFlowAgent({
    learningEntryResult,
    studentTaskAnswer: trainingAnswer,
    diagnosisCaller: personalizedTrainingFlowMockDiagnosisCaller,
    createdAt: '2026-07-10T15:05:00.000Z',
  });
  const result = await runBetaLearningSessionResultAgent({
    personalizedTrainingFlowResult: trainingFlowResult,
    studentRetestAnswer,
    createdAt: '2026-07-10T15:10:00.000Z',
  });

  validate(result, failures);
  printReport(result, failures);

  if (failures.length > 0) {
    throw new Error('Beta Learning Session Result debug check failed.');
  }
}

function validate(
  result: Awaited<ReturnType<typeof runBetaLearningSessionResultAgent>>,
  failures: string[],
): void {
  if (!isBetaLearningSessionResult(result)) failures.push('BetaLearningSessionResult should match schema.');
  if (result.student_id !== studentId) failures.push('student_id should match input.');
  if (!result.session_id.trim()) failures.push('session_id should not be empty.');
  if (!result.target_ability.trim()) failures.push('target_ability should not be empty.');
  if (result.personalized_training_result.flow_status !== 'ready_for_retest') {
    failures.push('training flow should be ready_for_retest.');
  }
  if (!result.retest_task) failures.push('retest_task should exist.');
  if (result.retest_task && result.retest_task.target_ability !== result.target_ability) {
    failures.push('RetestTask.target_ability should match target_ability.');
  }
  if (
    result.retest_task &&
    normalize(result.retest_task.question) === normalize(result.personalized_training_result.personalized_task.question)
  ) {
    failures.push('RetestTask.question should not repeat training question.');
  }
  if (!result.retest_execution_result) failures.push('retest_execution_result should exist.');
  if (result.retest_execution_result?.new_retest_evidence.source !== 'retest') {
    failures.push('Retest Evidence source should be retest.');
  }
  if (!result.retest_execution_result?.new_retest_evidence.ability.trim()) {
    failures.push('Retest Evidence ability should not be empty.');
  }
  if (!result.ability_change_evaluation) failures.push('ability_change_evaluation should exist.');
  if (!result.ability_change_evaluation?.change_status.trim()) {
    failures.push('change_status should not be empty.');
  }
  if (!result.ability_change_evaluation?.next_decision.trim()) {
    failures.push('next_decision should not be empty.');
  }
  if (result.persistence_status !== 'not_persisted') failures.push('persistence_status should be not_persisted.');
  if (!result.student_readable_feedback.title.trim()) failures.push('student feedback title should not be empty.');
  if (!result.student_readable_feedback.summary.trim()) failures.push('student feedback summary should not be empty.');
  if (!result.student_readable_feedback.next_step.trim()) failures.push('student feedback next_step should not be empty.');
  if (!result.validation.passed) {
    failures.push(`validation should pass: ${result.validation.issues.join('; ')}`);
  }
}

function printReport(
  result: Awaited<ReturnType<typeof runBetaLearningSessionResultAgent>>,
  failures: string[],
): void {
  const retestTask = result.retest_task;
  const retestExecution = result.retest_execution_result;
  const abilityChange = result.ability_change_evaluation;
  const generatedTask = generateRetestTaskFromTrainingFlow(result.personalized_training_result);

  console.log('\nBeta Learning Session Result Debug Report');
  console.log('=========================================');

  console.log('\nInput');
  console.log('-----');
  console.log(`studentId: ${result.student_id}`);
  console.log(`sessionId: ${result.session_id}`);
  console.log(`targetAbility: ${result.target_ability}`);
  console.log(`trainingFlowStatus: ${result.personalized_training_result.flow_status}`);
  console.log(`evidenceCountBeforeRetest: ${result.personalized_training_result.updated_evidence.length}`);

  console.log('\nRetest Task');
  console.log('-----------');
  console.log(`canGenerate: ${generatedTask.can_generate}`);
  console.log(`retestTaskId: ${retestTask?.retest_task_id || 'none'}`);
  console.log(`targetAbility: ${retestTask?.target_ability || 'none'}`);
  console.log(`retestGoal: ${retestTask?.retest_goal || 'none'}`);
  console.log(`whyRetestNow: ${retestTask?.why_retest_now || 'none'}`);
  console.log(`successCriteria: ${retestTask?.success_criteria.join('；') || 'none'}`);

  console.log('\nStudent Retest Answer');
  console.log('---------------------');
  console.log(result.student_retest_answer || 'none');

  console.log('\nRetest Execution');
  console.log('----------------');
  console.log(`diagnosisMainAbility: ${retestExecution?.diagnosis_result.mainAbility || 'none'}`);
  console.log(`answerStatus: ${retestExecution?.diagnosis_result.answerStatus || 'unknown'}`);
  console.log(`rootCause: ${retestExecution?.diagnosis_result.rootCause || 'none'}`);
  console.log(`retestEvidenceId: ${retestExecution?.new_retest_evidence.id || 'none'}`);
  console.log(`retestEvidenceType: ${retestExecution?.new_retest_evidence.evidenceType || 'none'}`);
  console.log(`retestEvidenceSource: ${retestExecution?.new_retest_evidence.source || 'none'}`);

  console.log('\nAbility Change Evaluation');
  console.log('-------------------------');
  console.log(`changeStatus: ${abilityChange?.change_status || 'none'}`);
  console.log(`changeReason: ${abilityChange?.change_reason || 'none'}`);
  console.log(`evidenceBasis: ${abilityChange?.evidence_basis.join('；') || 'none'}`);
  console.log(`confidence: ${abilityChange ? Math.round(abilityChange.confidence * 100) : 0}%`);
  console.log(`nextDecision: ${abilityChange?.next_decision || 'none'}`);

  console.log('\nSession Result');
  console.log('--------------');
  console.log(`sessionStatus: ${result.session_status}`);
  console.log(`persistenceStatus: ${result.persistence_status}`);
  console.log(`initialProblem: ${result.session_summary.initial_problem}`);
  console.log(`trainingFocus: ${result.session_summary.training_focus}`);
  console.log(`retestResult: ${result.session_summary.retest_result}`);
  console.log(`abilityChangeSummary: ${result.session_summary.ability_change_summary}`);
  console.log(`nextLearningDecision: ${result.session_summary.next_learning_decision}`);

  console.log('\nStudent Feedback');
  console.log('----------------');
  console.log(`title: ${result.student_readable_feedback.title}`);
  console.log(`summary: ${result.student_readable_feedback.summary}`);
  console.log(`nextStep: ${result.student_readable_feedback.next_step}`);

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 7.3 Retest & Session Result minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 7.3 Retest & Session Result minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

runBetaLearningSessionResultDebug();
