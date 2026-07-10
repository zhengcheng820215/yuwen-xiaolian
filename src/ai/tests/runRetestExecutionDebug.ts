import { runRetestExecution } from '../agents/retestExecutionAgent.ts';
import { summarizeAbilityEvidence } from '../agents/weaknessRankingAgent.ts';
import { normalizeAbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import { isRetestExecutionResult } from '../schemas/retestExecution.schema.ts';
import type { RetestTask } from '../schemas/retestTask.schema.ts';
import { isStudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';

const studentId = 'phase62-demo-student';
const targetAbility = '推理';

const retestTask: RetestTask = {
  retest_task_id: 'phase61-retest-inference-001',
  target_ability: targetAbility,
  retest_goal: '验证学生能否在新文本中完成“文本线索 -> 人物心理 -> 结论表达”的迁移推理。',
  why_retest_now: 'Session Outcome=needs_retest_validation；训练任务中出现改善，但缺少 retest evidence，下一步应换题验证。',
  question: [
    '阅读片段：',
    '雨停后，母亲没有立刻回屋，而是蹲在院子里，把被风吹倒的小菜苗一株株扶正。她的袖口沾满了泥水，却一直没有停。第二天清晨，我发现菜畦旁多了一排小竹竿，每棵菜苗都被轻轻绑住。',
    '请结合文本，推断母亲当时的心理，并说明依据。',
  ].join('\n'),
  reference_answer: '母亲可能既心疼菜苗被风雨损伤，也珍惜自己一直照料的生活成果。依据是她雨停后没有立刻回屋，而是蹲在院子里把菜苗一株株扶正，第二天还用小竹竿固定菜苗，说明她细心、珍惜并希望菜苗继续生长。',
  scoring_points: [
    '能提取文本行为线索，如“没有立刻回屋”“一株株扶正”“袖口沾满泥水”“用小竹竿固定”。',
    '能从行为线索推断人物心理，如心疼、珍惜、牵挂、希望菜苗继续生长。',
    '能说明线索与心理判断之间的关系，而不是只复述行为。',
  ],
  success_criteria: [
    '答案回应“推断心理”这一核心要求。',
    '答案至少引用或概括一处文本依据。',
    '答案形成“文本线索 -> 人物心理 -> 结论表达”的基本推理链。',
  ],
  linked_session_id: 'phase61-session-inference-001',
  source_session_outcome: 'needs_retest_validation',
  source_next_recommendation: 'retest',
  expected_evaluation_focus: [
    '是否能够从新文本中提取有效线索。',
    '是否能够基于线索推断人物心理。',
    '是否能够说明依据与结论之间的关系。',
  ],
};

const studentRetestAnswer = '母亲看到菜苗被风雨吹倒后，雨停了还蹲在院子里一株株扶正，袖口沾满泥水也没有停，说明她很心疼这些菜苗，也珍惜自己一直照料的生活成果。第二天她还用小竹竿固定菜苗，所以可以看出她细心，希望菜苗继续好好生长。';

const previousEvidence = [
  normalizeAbilityEvidence({
    id: 'phase62-prev-inference-weakness-001',
    studentId,
    ability: targetAbility,
    evidenceType: 'weakness',
    reason: 'reasoning_error',
    detail: '学生此前在推理题中只描述表层行为，缺少文本线索到心理判断的说明。',
    source: 'diagnosis',
    observation: '学生能够看到人物行为，但不能稳定推断人物心理。',
    rootCause: '尚未建立“文本行为线索 -> 人物心理 -> 结论表达”的推理链。',
    confidence: 0.78,
    createdAt: '2026-07-10T09:00:00.000Z',
    taskId: 'phase52-task-inference-001',
  }),
  normalizeAbilityEvidence({
    id: 'phase62-prev-inference-growth-001',
    studentId,
    ability: targetAbility,
    evidenceType: 'growth',
    detail: '学生在训练中能够提取部分行为线索，并尝试推断人物心理。',
    source: 'training',
    observation: '学生在训练环境中出现推理链改善迹象。',
    confidence: 0.7,
    createdAt: '2026-07-10T09:20:00.000Z',
    taskId: 'phase52-task-inference-002',
  }),
];

async function runRetestExecutionDebug(): Promise<void> {
  const failures: string[] = [];
  const result = await runRetestExecution({
    studentId,
    retestTask,
    studentRetestAnswer,
    previousEvidence,
    createdAt: '2026-07-10T11:00:00.000Z',
  });
  const invalidAnswerResult = await runRetestExecution({
    studentId,
    retestTask,
    studentRetestAnswer: '445',
    previousEvidence,
    createdAt: '2026-07-10T11:05:00.000Z',
  });

  validate(result, failures);
  validateInvalidAnswerResult(invalidAnswerResult, failures);
  printReport(result, failures);

  if (failures.length > 0) {
    throw new Error('Retest Execution debug check failed.');
  }
}

function validateInvalidAnswerResult(
  result: Awaited<ReturnType<typeof runRetestExecution>>,
  failures: string[],
): void {
  if (result.diagnosis_result.answerStatus !== 'insufficient_evidence') {
    failures.push('Numeric-only retest answer should be diagnosed as insufficient_evidence.');
  }
  if (result.diagnosis_result.scoreBand !== 'invalid') {
    failures.push('Numeric-only retest answer should be invalid scoreBand.');
  }
  if (result.new_retest_evidence.evidenceType !== 'insufficient') {
    failures.push('Numeric-only retest answer should generate insufficient evidence.');
  }
  if (!result.validation.passed) {
    failures.push(`numeric-only validation should pass: ${result.validation.issues.join('; ')}`);
  }
}

function validate(
  result: Awaited<ReturnType<typeof runRetestExecution>>,
  failures: string[],
): void {
  if (!isRetestExecutionResult(result)) failures.push('RetestExecutionResult should match schema.');
  if (result.retest_task_id !== retestTask.retest_task_id) failures.push('retest_task_id should match RetestTask.');
  if (result.target_ability !== retestTask.target_ability) failures.push('target_ability should match RetestTask.');
  if (!result.student_retest_answer.trim()) failures.push('student_retest_answer should not be empty.');
  if (result.new_retest_evidence.source !== 'retest') failures.push('newRetestEvidence.source should be retest.');
  if (result.new_retest_evidence.ability !== retestTask.target_ability) {
    failures.push('newRetestEvidence.ability should equal RetestTask.target_ability.');
  }
  if (result.new_retest_evidence.taskId !== retestTask.retest_task_id) {
    failures.push('newRetestEvidence.taskId should equal RetestTask.retest_task_id.');
  }
  if (
    result.new_retest_evidence.confidence < 0 ||
    result.new_retest_evidence.confidence > 1
  ) {
    failures.push('newRetestEvidence.confidence should be between 0 and 1.');
  }
  if (!['positive', 'growth', 'weakness', 'insufficient'].includes(result.new_retest_evidence.evidenceType)) {
    failures.push('newRetestEvidence.evidenceType should be valid.');
  }

  const expectedUpdatedCount = new Set([
    ...previousEvidence.map((item) => item.id),
    result.new_retest_evidence.id,
  ]).size;
  if (result.updated_evidence.length !== expectedUpdatedCount) {
    failures.push('updatedEvidence should equal previousEvidence + newRetestEvidence after dedupe.');
  }
  if (result.evidence_summary.length === 0) failures.push('evidence_summary should not be empty.');
  if (!isStudentAbilityProfile(result.updated_student_ability_profile)) {
    failures.push('updatedStudentAbilityProfile should match schema.');
  }
  if (!result.validation.diagnosis_focus_match) failures.push('diagnosis_focus_match should be true for this debug.');
  if (result.validation.review_required) failures.push('review_required should be false for this debug.');
  if (!result.validation.passed) {
    failures.push(`validation should pass: ${result.validation.issues.join('; ')}`);
  }

  const recomputedSummary = summarizeAbilityEvidence(result.updated_evidence);
  if (JSON.stringify(recomputedSummary) !== JSON.stringify(result.evidence_summary)) {
    failures.push('Evidence Summary should be based on updatedEvidence.');
  }
}

function printReport(
  result: Awaited<ReturnType<typeof runRetestExecution>>,
  failures: string[],
): void {
  console.log('\nRetest Execution Debug Report');
  console.log('=============================');

  console.log('\nInput');
  console.log('-----');
  console.log(`retest_task_id: ${retestTask.retest_task_id}`);
  console.log(`target_ability: ${retestTask.target_ability}`);
  console.log(`student_retest_answer: ${studentRetestAnswer}`);
  console.log(`previousEvidence count: ${previousEvidence.length}`);

  console.log('\nDiagnosis');
  console.log('---------');
  console.log(`mainAbility: ${result.diagnosis_result.mainAbility}`);
  console.log(`answerStatus: ${result.diagnosis_result.answerStatus}`);
  console.log(`rootCause: ${result.diagnosis_result.rootCause}`);
  console.log(`confidence: ${Math.round(result.diagnosis_result.confidence * 100)}%`);

  console.log('\nRetest Evidence');
  console.log('---------------');
  console.log(`id: ${result.new_retest_evidence.id}`);
  console.log(`ability: ${result.new_retest_evidence.ability}`);
  console.log(`source: ${result.new_retest_evidence.source}`);
  console.log(`evidenceType: ${result.new_retest_evidence.evidenceType}`);
  console.log(`reason: ${result.new_retest_evidence.reason || 'none'}`);
  console.log(`confidence: ${Math.round(result.new_retest_evidence.confidence * 100)}%`);

  console.log('\nEvidence Update');
  console.log('---------------');
  console.log(`previousEvidence count: ${previousEvidence.length}`);
  console.log('newRetestEvidence count: 1');
  console.log(`updatedEvidence count: ${result.updated_evidence.length}`);
  console.log(`dedupe result: ${previousEvidence.length + 1} -> ${result.updated_evidence.length}`);

  console.log('\nProfile Update');
  console.log('--------------');
  console.log(`current_weakness: ${result.updated_student_ability_profile.current_weakness.primary}`);
  console.log(`ability_status: ${result.updated_student_ability_profile.ability_status.map((item) => `${item.ability}/${item.status}`).join(', ')}`);
  console.log(`improvementSignals: ${result.updated_student_ability_profile.improvement_signals.map((item) => item.signal).join(' | ') || 'none'}`);
  console.log(`nextStepRecommendation: ${result.updated_student_ability_profile.next_step_recommendation}`);

  console.log('\nValidation');
  console.log('----------');
  console.log(`diagnosis_focus_match: ${result.validation.diagnosis_focus_match}`);
  console.log(`review_required: ${result.validation.review_required}`);
  console.log(`issues: ${result.validation.issues.join(' | ') || 'none'}`);

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 6.2 Retest Execution Evidence minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 6.2 Retest Execution Evidence minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

runRetestExecutionDebug();
