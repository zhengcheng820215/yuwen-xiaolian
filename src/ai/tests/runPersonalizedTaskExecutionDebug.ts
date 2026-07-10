import { generatePersonalizedNextTask } from '../agents/personalizedNextTaskAgent.ts';
import { runPersonalizedTaskExecutionAgent } from '../agents/personalizedTaskExecutionAgent.ts';
import { generateStudentAbilityProfile } from '../agents/studentAbilityProfileAgent.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
} from '../agents/weaknessRankingAgent.ts';
import {
  isAbilityEvidence,
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import { isPersonalizedNextTask } from '../schemas/personalizedNextTask.schema.ts';
import {
  isPersonalizedTaskExecutionSummary,
  isPersonalizedTaskNextDecision,
} from '../schemas/personalizedTaskExecution.schema.ts';
import { isStudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';

const studentId = 'phase52-demo-student';
const generatedAt = '2026-07-10T09:00:00.000Z';

const initialEvidence: AbilityEvidence[] = [
  normalizeAbilityEvidence({
    id: 'phase52-prev-inference-001',
    studentId,
    ability: '推理',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生答案停留在表面行为，没有从文本线索推断人物心理。',
    rootCause: '学生尚未建立“文本行为线索 -> 人物心理 -> 结论表达”的推理链。',
    confidence: 0.82,
    createdAt: '2026-07-10T08:20:00.000Z',
    taskId: 'phase52-prev-task-001',
    diagnosisId: 'phase52-prev-diagnosis-001',
  }),
  normalizeAbilityEvidence({
    id: 'phase52-prev-expression-001',
    studentId,
    ability: '表达',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生能够给出结论，但解释时缺少“观点 + 文本依据 + 说明”的完整结构。',
    rootCause: '表达链条不完整，容易只写结论。',
    confidence: 0.68,
    createdAt: '2026-07-10T08:25:00.000Z',
    taskId: 'phase52-prev-task-002',
    diagnosisId: 'phase52-prev-diagnosis-002',
  }),
  normalizeAbilityEvidence({
    id: 'phase52-prev-summary-001',
    studentId,
    ability: '概括',
    evidenceType: 'positive',
    source: 'diagnosis',
    observation: '学生能够抓住人物和主要事件，完成简短概括。',
    confidence: 0.76,
    createdAt: '2026-07-10T08:30:00.000Z',
    taskId: 'phase52-prev-task-003',
    diagnosisId: 'phase52-prev-diagnosis-003',
  }),
];

async function runPersonalizedTaskExecutionDebug(): Promise<void> {
  const failures: string[] = [];
  const evidenceSummary = summarizeAbilityEvidence(initialEvidence);
  const topWeakness = rankWeaknessSummaries(evidenceSummary, 3);
  const studentAbilityProfile = generateStudentAbilityProfile({
    studentId,
    evidenceSummary,
    topWeakness,
    evidence: initialEvidence,
    generatedAt,
  });
  const personalizedNextTask = generatePersonalizedNextTask({
    studentAbilityProfile,
    topWeakness,
    evidenceSummary,
    updatedEvidence: initialEvidence,
    generatedAt,
  });
  const studentAnswer = buildStudentAnswer(personalizedNextTask.target_ability);
  const result = await runPersonalizedTaskExecutionAgent({
    studentId,
    studentAbilityProfile,
    evidenceSummary,
    updatedEvidence: initialEvidence,
    personalizedNextTask,
    studentAnswer,
    createdAt: '2026-07-10T09:10:00.000Z',
  });

  validate({
    evidenceSummary,
    topWeakness,
    studentAbilityProfile,
    personalizedNextTask,
    studentAnswer,
    result,
    failures,
  });
  printReport({
    evidenceSummary,
    topWeakness,
    studentAbilityProfile,
    personalizedNextTask,
    studentAnswer,
    result,
    failures,
  });

  if (failures.length > 0) {
    throw new Error('Personalized Task Execution debug check failed.');
  }
}

function validate(input: {
  evidenceSummary: ReturnType<typeof summarizeAbilityEvidence>;
  topWeakness: ReturnType<typeof rankWeaknessSummaries>;
  studentAbilityProfile: ReturnType<typeof generateStudentAbilityProfile>;
  personalizedNextTask: ReturnType<typeof generatePersonalizedNextTask>;
  studentAnswer: string;
  result: Awaited<ReturnType<typeof runPersonalizedTaskExecutionAgent>>;
  failures: string[];
}): void {
  const {
    topWeakness,
    studentAbilityProfile,
    personalizedNextTask,
    studentAnswer,
    result,
    failures,
  } = input;
  const primaryWeakness = topWeakness[0];

  if (!primaryWeakness) failures.push('topWeakness should contain at least one item.');
  if (!isStudentAbilityProfile(studentAbilityProfile)) failures.push('Input Student Ability Profile should match schema.');
  if (!isPersonalizedNextTask(personalizedNextTask)) failures.push('PersonalizedNextTask should match schema.');
  if (personalizedNextTask.target_ability !== '推理') failures.push('Phase 5.2 debug target ability should be 推理.');
  if (primaryWeakness && personalizedNextTask.target_ability !== primaryWeakness.ability) {
    failures.push('personalizedNextTask.target_ability should equal topWeakness[0].ability.');
  }
  if (!studentAnswer.trim()) failures.push('studentAnswer should not be empty.');
  if (result.taskExecutionSummary.before.target_ability !== '推理') {
    failures.push('before.target_ability should be 推理.');
  }
  if (result.taskExecutionSummary.before.weakness_evidence_count < 1) {
    failures.push('before should include at least one 推理 weakness evidence.');
  }
  if (result.diagnosisResult.mainAbility !== personalizedNextTask.target_ability) {
    failures.push('DiagnosisResult.mainAbility should match personalizedNextTask.target_ability.');
  }
  if (!isAbilityEvidence(result.newAbilityEvidence)) {
    failures.push('newAbilityEvidence should match AbilityEvidence schema.');
  }
  if (result.newAbilityEvidence.ability !== personalizedNextTask.target_ability) {
    failures.push('newAbilityEvidence.ability should match personalizedNextTask.target_ability.');
  }
  if (!result.diagnosisFocusMatch) failures.push('diagnosisFocusMatch should be true for the default debug sample.');
  if (!isPersonalizedTaskExecutionSummary(result.taskExecutionSummary)) {
    failures.push('taskExecutionSummary should match schema.');
  }
  if (!result.taskExecutionSummary.after.evidence_updated) {
    failures.push('after.evidence_updated should be true when diagnosis focus matches.');
  }
  if (result.updatedEvidence.length !== initialEvidence.length + 1) {
    failures.push('updatedEvidence should equal previous evidence plus one new accepted evidence item.');
  }
  if (!result.updatedEvidence.some((item) => item.id === result.newAbilityEvidence.id)) {
    failures.push('updatedEvidence should include newAbilityEvidence.');
  }
  if (!isStudentAbilityProfile(result.updatedStudentAbilityProfile)) {
    failures.push('updatedStudentAbilityProfile should match schema.');
  }
  if (!isPersonalizedTaskNextDecision(result.next_decision)) {
    failures.push('next_decision should match supported enum.');
  }
}

function buildStudentAnswer(targetAbility: string): string {
  if (targetAbility === '推理') {
    return '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。';
  }

  return `我会围绕「${targetAbility}」完成作答，并尽量写出依据。`;
}

function printReport(input: {
  evidenceSummary: ReturnType<typeof summarizeAbilityEvidence>;
  topWeakness: ReturnType<typeof rankWeaknessSummaries>;
  studentAbilityProfile: ReturnType<typeof generateStudentAbilityProfile>;
  personalizedNextTask: ReturnType<typeof generatePersonalizedNextTask>;
  studentAnswer: string;
  result: Awaited<ReturnType<typeof runPersonalizedTaskExecutionAgent>>;
  failures: string[];
}): void {
  const {
    evidenceSummary,
    topWeakness,
    studentAbilityProfile,
    personalizedNextTask,
    studentAnswer,
    result,
    failures,
  } = input;

  console.log('\nPhase 5.2 Personalized Task Execution Debug Report');
  console.log('==================================================');

  console.log('\nBefore');
  console.log('------');
  console.log(`initialEvidence: ${initialEvidence.length}`);
  console.log(`evidenceSummary: ${evidenceSummary.length}`);
  console.log(`topWeakness[0]: ${topWeakness[0]?.ability || 'none'}`);
  console.log(`studentProfile.current_weakness: ${studentAbilityProfile.current_weakness.primary}`);
  console.log(`before.status: ${result.taskExecutionSummary.before.status}`);
  console.log(`before.reason: ${result.taskExecutionSummary.before.reason}`);

  console.log('\nTask');
  console.log('----');
  console.log(`task_id: ${personalizedNextTask.task_id}`);
  console.log(`target_ability: ${personalizedNextTask.target_ability}`);
  console.log(`task_goal: ${personalizedNextTask.task_goal}`);
  console.log(`question: ${personalizedNextTask.question}`);
  console.log(`student_answer: ${studentAnswer}`);

  console.log('\nDiagnosis Runtime');
  console.log('-----------------');
  console.log(`diagnosisResult.mainAbility: ${result.diagnosisResult.mainAbility}`);
  console.log(`diagnosisResult.answerStatus: ${result.diagnosisResult.answerStatus || 'unknown'}`);
  console.log(`diagnosisResult.rootCause: ${result.diagnosisResult.rootCause}`);
  console.log(`diagnosisFocusMatch: ${result.diagnosisFocusMatch}`);

  console.log('\nEvidence Update');
  console.log('---------------');
  console.log(`newAbilityEvidence.id: ${result.newAbilityEvidence.id}`);
  console.log(`newAbilityEvidence.ability: ${result.newAbilityEvidence.ability}`);
  console.log(`newAbilityEvidence.evidenceType: ${result.newAbilityEvidence.evidenceType}`);
  console.log(`updatedEvidence: ${initialEvidence.length} -> ${result.updatedEvidence.length}`);
  console.log(`updatedStudentProfile.current_weakness: ${result.updatedStudentAbilityProfile.current_weakness.primary}`);

  console.log('\nTask Execution Summary');
  console.log('----------------------');
  console.log(JSON.stringify(result.taskExecutionSummary, null, 2));

  console.log('\nNext Decision');
  console.log('-------------');
  console.log(`next_decision: ${result.next_decision}`);
  console.log(`decision_reason: ${result.taskExecutionSummary.decision_reason}`);

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify({
    personalizedNextTask,
    studentAnswer,
    diagnosisResult: result.diagnosisResult,
    newAbilityEvidence: result.newAbilityEvidence,
    updatedEvidenceCount: result.updatedEvidence.length,
    updatedStudentAbilityProfile: result.updatedStudentAbilityProfile,
    taskExecutionSummary: result.taskExecutionSummary,
    next_decision: result.next_decision,
  }, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 5.2 Personalized Task Execution Evidence minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 5.2 Personalized Task Execution Evidence minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

runPersonalizedTaskExecutionDebug().catch((error) => {
  console.error(error);
  process.exit(1);
});
