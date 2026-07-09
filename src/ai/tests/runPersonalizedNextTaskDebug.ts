import { runRealAIDiagnosisLoop } from '../agents/realAIDiagnosisAgent.ts';
import { generatePersonalizedNextTask } from '../agents/personalizedNextTaskAgent.ts';
import { generateStudentAbilityProfile } from '../agents/studentAbilityProfileAgent.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
} from '../agents/weaknessRankingAgent.ts';
import { isAbilityEvidence, normalizeAbilityEvidence, type AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import { isPersonalizedNextTask } from '../schemas/personalizedNextTask.schema.ts';
import { isStudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';

const studentId = 'phase51-demo-student';
const generatedAt = '2026-07-09T16:00:00.000Z';

const initialEvidence: AbilityEvidence[] = [
  normalizeAbilityEvidence({
    id: 'phase51-prev-inference-001',
    studentId,
    ability: '推理',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生答案停留在表面行为，没有从文本线索推断人物心理。',
    rootCause: '学生尚未建立“文本行为线索 -> 人物心理 -> 结论表达”的推理链。',
    confidence: 0.82,
    createdAt: '2026-07-09T15:20:00.000Z',
    taskId: 'phase51-prev-task-001',
    diagnosisId: 'phase51-prev-diagnosis-001',
  }),
  normalizeAbilityEvidence({
    id: 'phase51-prev-expression-001',
    studentId,
    ability: '表达',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生能够给出结论，但解释时缺少“观点 + 文本依据 + 说明”的完整结构。',
    rootCause: '表达链条不完整，容易只写结论。',
    confidence: 0.68,
    createdAt: '2026-07-09T15:25:00.000Z',
    taskId: 'phase51-prev-task-002',
    diagnosisId: 'phase51-prev-diagnosis-002',
  }),
  normalizeAbilityEvidence({
    id: 'phase51-prev-summary-001',
    studentId,
    ability: '概括',
    evidenceType: 'positive',
    source: 'diagnosis',
    observation: '学生能够抓住人物和主要事件，完成简短概括。',
    confidence: 0.76,
    createdAt: '2026-07-09T15:30:00.000Z',
    taskId: 'phase51-prev-task-003',
    diagnosisId: 'phase51-prev-diagnosis-003',
  }),
];

async function runPersonalizedNextTaskDebug(): Promise<void> {
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
  const simulatedStudentAnswer = buildSimulatedStudentAnswer(personalizedNextTask.target_ability);
  const diagnosisLoopResult = await runRealAIDiagnosisLoop({
    studentId,
    question: personalizedNextTask.question,
    referenceAnswer: buildReferenceAnswer(personalizedNextTask),
    studentAnswer: simulatedStudentAnswer,
    previousEvidence: initialEvidence,
    taskId: personalizedNextTask.task_id,
    diagnosisId: `phase51-diagnosis-${personalizedNextTask.task_id}`,
    createdAt: '2026-07-09T16:10:00.000Z',
  });

  validateLoop({
    topWeakness,
    studentAbilityProfile,
    personalizedNextTask,
    simulatedStudentAnswer,
    diagnosisLoopResult,
    failures,
  });

  printReport({
    evidenceSummary,
    topWeakness,
    studentAbilityProfile,
    personalizedNextTask,
    simulatedStudentAnswer,
    diagnosisLoopResult,
    failures,
  });

  if (failures.length > 0) {
    throw new Error('Personalized Next Task debug check failed.');
  }
}

function validateLoop(input: {
  topWeakness: ReturnType<typeof rankWeaknessSummaries>;
  studentAbilityProfile: ReturnType<typeof generateStudentAbilityProfile>;
  personalizedNextTask: ReturnType<typeof generatePersonalizedNextTask>;
  simulatedStudentAnswer: string;
  diagnosisLoopResult: Awaited<ReturnType<typeof runRealAIDiagnosisLoop>>;
  failures: string[];
}): void {
  const {
    topWeakness,
    studentAbilityProfile,
    personalizedNextTask,
    simulatedStudentAnswer,
    diagnosisLoopResult,
    failures,
  } = input;
  const primaryWeakness = topWeakness[0];

  if (!primaryWeakness) failures.push('topWeakness should contain at least one weakness.');
  if (!isStudentAbilityProfile(studentAbilityProfile)) failures.push('Student Ability Profile should match schema.');
  if (!isPersonalizedNextTask(personalizedNextTask)) failures.push('Personalized Next Task should match schema.');
  if (primaryWeakness && personalizedNextTask.target_ability !== primaryWeakness.ability) {
    failures.push('Personalized Next Task target_ability should equal topWeakness[0].ability.');
  }
  if (personalizedNextTask.linked_evidence.length === 0) {
    failures.push('Personalized Next Task should include linked_evidence.');
  }
  if (!personalizedNextTask.why_this_task.includes(personalizedNextTask.target_ability)) {
    failures.push('why_this_task should explain the target ability relationship.');
  }
  if (!simulatedStudentAnswer.trim()) failures.push('Debug should include simulated student answer.');
  if (!diagnosisLoopResult.diagnosisResult.mainAbility) failures.push('Diagnosis Result should include mainAbility.');
  if (diagnosisLoopResult.diagnosisResult.mainAbility !== personalizedNextTask.target_ability) {
    failures.push('Diagnosis Result mainAbility should match Personalized Next Task target_ability.');
  }
  if (!diagnosisLoopResult.diagnosisResult.rootCause) failures.push('Diagnosis Result should include rootCause.');
  if (!isAbilityEvidence(diagnosisLoopResult.newAbilityEvidence)) {
    failures.push('newAbilityEvidence should match AbilityEvidence schema.');
  }
  if (diagnosisLoopResult.updatedEvidence.length !== initialEvidence.length + 1) {
    failures.push('updatedEvidence should equal previous evidence plus one new evidence item.');
  }
  if (!diagnosisLoopResult.updatedEvidence.some((item) => item.id === diagnosisLoopResult.newAbilityEvidence.id)) {
    failures.push('updatedEvidence should include newAbilityEvidence.');
  }
  if (!isStudentAbilityProfile(diagnosisLoopResult.studentAbilityProfile)) {
    failures.push('Updated Student Ability Profile should match schema.');
  }
}

function buildSimulatedStudentAnswer(targetAbility: string): string {
  const answers: Record<string, string> = {
    推理: '父亲很喜欢整理东西。',
    表达: '我赞同。文中父亲虽然没有说很多话，但他一直等待和接送孩子，这说明陪伴也可以是安静的行动。',
    概括: '这段写雨天外婆到校门口给我送热饭，又默默离开，表现了外婆对我的关心。',
    理解: '“照亮”不只是灯光照路，也表示作者感受到父亲一直默默关心和牵挂自己。',
    信息提取: '雨伞、热牛奶、提醒的小纸条。',
    分析: '这一描写表现父亲一直牵挂孩子，也深化了父爱的主题。',
  };

  return answers[targetAbility] || `我会围绕${targetAbility}认真作答，并写出依据。`;
}

function buildReferenceAnswer(task: ReturnType<typeof generatePersonalizedNextTask>): string {
  return [
    task.reference_answer,
    `评分要点：${task.scoring_points.join('；')}`,
    `成功标准：${task.success_criteria.join('；')}`,
  ].join('\n');
}

function printReport(input: {
  evidenceSummary: ReturnType<typeof summarizeAbilityEvidence>;
  topWeakness: ReturnType<typeof rankWeaknessSummaries>;
  studentAbilityProfile: ReturnType<typeof generateStudentAbilityProfile>;
  personalizedNextTask: ReturnType<typeof generatePersonalizedNextTask>;
  simulatedStudentAnswer: string;
  diagnosisLoopResult: Awaited<ReturnType<typeof runRealAIDiagnosisLoop>>;
  failures: string[];
}): void {
  const {
    evidenceSummary,
    topWeakness,
    studentAbilityProfile,
    personalizedNextTask,
    simulatedStudentAnswer,
    diagnosisLoopResult,
    failures,
  } = input;

  console.log('\nPhase 5.1 Personalized Next Task Debug Report');
  console.log('============================================');

  console.log('\nInput Runtime State');
  console.log('-------------------');
  console.log(`initialEvidence: ${initialEvidence.length}`);
  console.log(`evidenceSummary: ${evidenceSummary.length}`);
  console.log(`topWeakness[0]: ${topWeakness[0]?.ability || 'none'}`);
  console.log(`studentProfile.current_weakness: ${studentAbilityProfile.current_weakness.primary}`);

  console.log('\nPersonalized Next Task');
  console.log('----------------------');
  console.log(`task_id: ${personalizedNextTask.task_id}`);
  console.log(`target_ability: ${personalizedNextTask.target_ability}`);
  console.log(`task_goal: ${personalizedNextTask.task_goal}`);
  console.log(`why_this_task: ${personalizedNextTask.why_this_task}`);
  console.log(`linked_evidence: ${personalizedNextTask.linked_evidence.map((item) => item.evidence_id).join(', ')}`);
  console.log(`question: ${personalizedNextTask.question}`);
  console.log(`answer_requirements: ${personalizedNextTask.answer_requirements.join(' / ')}`);
  console.log(`success_criteria: ${personalizedNextTask.success_criteria.join(' / ')}`);
  console.log(`expected_diagnosis_focus: ${personalizedNextTask.expected_diagnosis_focus.join(' / ')}`);

  console.log('\nStudent Answer -> Diagnosis Runtime');
  console.log('-----------------------------------');
  console.log(`simulated_student_answer: ${simulatedStudentAnswer}`);
  console.log(`diagnosisResult.mainAbility: ${diagnosisLoopResult.diagnosisResult.mainAbility}`);
  console.log(`diagnosisResult.rootCause: ${diagnosisLoopResult.diagnosisResult.rootCause}`);
  console.log(`diagnosisResult.answerStatus: ${diagnosisLoopResult.diagnosisResult.answerStatus || 'unknown'}`);

  console.log('\nEvidence Return Flow');
  console.log('--------------------');
  console.log(`newAbilityEvidence: ${diagnosisLoopResult.newAbilityEvidence.id}`);
  console.log(`newAbilityEvidence.ability: ${diagnosisLoopResult.newAbilityEvidence.ability}`);
  console.log(`newAbilityEvidence.evidenceType: ${diagnosisLoopResult.newAbilityEvidence.evidenceType}`);
  console.log(`updatedEvidence: ${initialEvidence.length} -> ${diagnosisLoopResult.updatedEvidence.length}`);
  console.log(`updatedProfile.current_weakness: ${diagnosisLoopResult.studentAbilityProfile.current_weakness.primary}`);
  console.log(`updatedProfile.next_step: ${diagnosisLoopResult.studentAbilityProfile.next_step_recommendation}`);

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify({
    personalizedNextTask,
    simulatedStudentAnswer,
    diagnosisResult: diagnosisLoopResult.diagnosisResult,
    newAbilityEvidence: diagnosisLoopResult.newAbilityEvidence,
    updatedEvidenceCount: diagnosisLoopResult.updatedEvidence.length,
    updatedStudentAbilityProfile: diagnosisLoopResult.studentAbilityProfile,
  }, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 5.1 Personalized Next Task minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 5.1 Personalized Next Task minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

runPersonalizedNextTaskDebug().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
