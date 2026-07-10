import {
  learningEntryMockDiagnosisCaller,
  runLearningEntryAgent,
} from '../agents/learningEntryAgent.ts';
import { isLearningEntryResult } from '../schemas/learningEntry.schema.ts';

const studentId = 'phase71-demo-student';
const question = '阅读片段：父亲反复整理旧书，翻到“我”小时候夹在书里的树叶时，停了很久。由此可以推断出父亲怎样的心理？请结合文本线索说明理由。';
const referenceAnswer = '可以推断父亲看到旧书和树叶后想起与孩子共同读书的回忆，内心有不舍、珍惜和牵挂。理由应结合“反复整理旧书”“停了很久”等文本线索说明。';
const studentAnswer = '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。';

async function runLearningEntryDebug(): Promise<void> {
  const failures: string[] = [];
  const result = await runLearningEntryAgent({
    studentId,
    question,
    referenceAnswer,
    studentAnswer,
    diagnosisCaller: learningEntryMockDiagnosisCaller,
    createdAt: '2026-07-10T13:00:00.000Z',
  });

  validate(result, failures);
  printReport(result, failures);

  if (failures.length > 0) {
    throw new Error('Learning Entry debug check failed.');
  }
}

function validate(
  result: Awaited<ReturnType<typeof runLearningEntryAgent>>,
  failures: string[],
): void {
  if (!isLearningEntryResult(result)) failures.push('LearningEntryResult should match schema.');
  if (!result.session_id.trim()) failures.push('session_id should not be empty.');
  if (result.student_id !== studentId) failures.push('student_id should match input.');
  if (result.question !== question) failures.push('question should match input.');
  if (result.student_answer !== studentAnswer) failures.push('student_answer should match input.');
  if (!result.diagnosis_result.mainAbility.trim()) failures.push('diagnosis_result.mainAbility should not be empty.');
  if (!result.new_ability_evidence.ability.trim()) failures.push('new_ability_evidence.ability should not be empty.');
  if (!['diagnosis', 'training', 'retest'].includes(result.new_ability_evidence.source)) {
    failures.push('new_ability_evidence.source should be valid.');
  }
  if (result.updated_evidence.length === 0) failures.push('updated_evidence should not be empty.');
  if (!result.student_ability_profile.current_weakness.primary.trim()) {
    failures.push('student_ability_profile.current_weakness.primary should not be empty.');
  }
  if (!result.initial_target_ability.trim()) failures.push('initial_target_ability should not be empty.');
  if (!result.next_step_hint.trim()) failures.push('next_step_hint should not be empty.');
  if (!result.student_feedback.title.trim()) failures.push('student_feedback.title should not be empty.');
  if (!result.student_feedback.summary.trim()) failures.push('student_feedback.summary should not be empty.');
  if (!result.student_feedback.next_step.trim()) failures.push('student_feedback.next_step should not be empty.');
  if (!result.validation.passed) {
    failures.push(`validation should pass: ${result.validation.issues.join('; ')}`);
  }
}

function printReport(
  result: Awaited<ReturnType<typeof runLearningEntryAgent>>,
  failures: string[],
): void {
  console.log('\nLearning Entry Debug Report');
  console.log('===========================');

  console.log('\nInput');
  console.log('-----');
  console.log(`studentId: ${studentId}`);
  console.log(`question: ${question}`);
  console.log(`studentAnswer: ${studentAnswer}`);

  console.log('\nDiagnosis');
  console.log('---------');
  console.log(`mainAbility: ${result.diagnosis_result.mainAbility}`);
  console.log(`answerStatus: ${result.diagnosis_result.answerStatus || 'unknown'}`);
  console.log(`rootCause: ${result.diagnosis_result.rootCause}`);

  console.log('\nAbility Evidence');
  console.log('----------------');
  console.log(`ability: ${result.new_ability_evidence.ability}`);
  console.log(`evidenceType: ${result.new_ability_evidence.evidenceType}`);
  console.log(`source: ${result.new_ability_evidence.source}`);
  console.log(`confidence: ${Math.round(result.new_ability_evidence.confidence * 100)}%`);

  console.log('\nStudent Ability Profile');
  console.log('-----------------------');
  console.log(`currentWeakness: ${result.student_ability_profile.current_weakness.primary}`);
  console.log(`abilityStatus: ${result.student_ability_profile.ability_status.map((item) => `${item.ability}/${item.status}`).join(', ')}`);
  console.log(`nextStepRecommendation: ${result.student_ability_profile.next_step_recommendation}`);

  console.log('\nStudent Feedback');
  console.log('----------------');
  console.log(`title: ${result.student_feedback.title}`);
  console.log(`summary: ${result.student_feedback.summary}`);
  console.log(`next_step: ${result.student_feedback.next_step}`);

  console.log('\nLearning Entry Result');
  console.log('---------------------');
  console.log(`session_id: ${result.session_id}`);
  console.log(`initial_target_ability: ${result.initial_target_ability}`);
  console.log(`next_step_hint: ${result.next_step_hint}`);

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 7.1 Student Learning Entry minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 7.1 Student Learning Entry minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

runLearningEntryDebug();
