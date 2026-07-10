import { evaluateAbilityChange } from '../agents/abilityChangeEvaluationAgent.ts';
import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
  type AbilityEvidenceType,
} from '../schemas/abilityEvidence.schema.ts';
import {
  isAbilityChangeEvaluation,
  type AbilityChangeStatus,
} from '../schemas/abilityChangeEvaluation.schema.ts';

type AbilityChangeDebugSample = {
  id: string;
  title: string;
  studentId: string;
  targetAbility: string;
  beforeEvidence: AbilityEvidence[];
  trainingEvidence: AbilityEvidence[];
  taskExecutionEvidence: AbilityEvidence[];
  retestEvidence: AbilityEvidence[];
  expectedChangeStatus: AbilityChangeStatus;
};

const studentId = 'phase63-demo-student';
const targetAbility = '推理';

const samples: AbilityChangeDebugSample[] = [
  {
    id: 'phase63_likely_improved_001',
    title: '训练与复测均出现改善信号',
    studentId,
    targetAbility,
    beforeEvidence: [
      buildEvidence('before-weakness-001', 'weakness', 'diagnosis', '学生此前缺少文本线索到心理判断的推理链。', 0.78),
    ],
    trainingEvidence: [
      buildEvidence('training-growth-001', 'growth', 'training', '学生在训练中能够提取行为线索，并尝试说明人物心理。', 0.74),
    ],
    taskExecutionEvidence: [],
    retestEvidence: [
      buildEvidence('retest-growth-001', 'growth', 'retest', '学生在新文本复测中能够完成基本线索到心理判断。', 0.76),
    ],
    expectedChangeStatus: 'likely_improved',
  },
  {
    id: 'phase63_not_transferred_001',
    title: '训练改善但复测未迁移',
    studentId,
    targetAbility,
    beforeEvidence: [
      buildEvidence('before-weakness-002', 'weakness', 'diagnosis', '学生此前只描述人物行为，不能推断心理。', 0.8),
    ],
    trainingEvidence: [
      buildEvidence('training-positive-002', 'positive', 'training', '学生在训练题中能够按照提示完成推理链。', 0.78),
    ],
    taskExecutionEvidence: [],
    retestEvidence: [
      buildEvidence('retest-weakness-002', 'weakness', 'retest', '学生在新文本中再次只写表层行为，未完成心理推断。', 0.82),
    ],
    expectedChangeStatus: 'not_transferred',
  },
  {
    id: 'phase63_still_weak_001',
    title: '训练前、训练中、复测后持续薄弱',
    studentId,
    targetAbility,
    beforeEvidence: [
      buildEvidence('before-weakness-003', 'weakness', 'diagnosis', '学生训练前缺少推理链表达。', 0.77),
    ],
    trainingEvidence: [
      buildEvidence('training-weakness-003', 'weakness', 'training', '学生训练中仍不能说明线索如何支持心理判断。', 0.73),
    ],
    taskExecutionEvidence: [],
    retestEvidence: [
      buildEvidence('retest-weakness-003', 'weakness', 'retest', '学生复测中仍未提取有效文本依据。', 0.79),
    ],
    expectedChangeStatus: 'still_weak',
  },
  {
    id: 'phase63_needs_more_evidence_001',
    title: '复测证据不足，无法判断变化',
    studentId,
    targetAbility,
    beforeEvidence: [
      buildEvidence('before-weakness-004', 'weakness', 'diagnosis', '学生此前存在推理链薄弱。', 0.76),
    ],
    trainingEvidence: [
      buildEvidence('training-insufficient-004', 'insufficient', 'training', '训练作答过短，无法形成有效改善判断。', 0.52),
    ],
    taskExecutionEvidence: [],
    retestEvidence: [
      buildEvidence('retest-insufficient-004', 'insufficient', 'retest', '复测答案证据不足，暂不能判断迁移表现。', 0.48),
    ],
    expectedChangeStatus: 'needs_more_evidence',
  },
];

function buildEvidence(
  id: string,
  evidenceType: AbilityEvidenceType,
  source: AbilityEvidence['source'],
  observation: string,
  confidence: number,
): AbilityEvidence {
  return normalizeAbilityEvidence({
    id: `phase63-${id}`,
    studentId,
    ability: targetAbility,
    evidenceType,
    source,
    observation,
    detail: observation,
    rootCause: evidenceType === 'positive' ? undefined : observation,
    confidence,
    createdAt: '2026-07-10T12:00:00.000Z',
  });
}

function runAbilityChangeEvaluationDebug(): void {
  const failures: string[] = [];
  const results = samples.map((sample) => {
    const evaluation = evaluateAbilityChange({
      studentId: sample.studentId,
      targetAbility: sample.targetAbility,
      beforeEvidence: sample.beforeEvidence,
      trainingEvidence: sample.trainingEvidence,
      taskExecutionEvidence: sample.taskExecutionEvidence,
      retestEvidence: sample.retestEvidence,
      updatedEvidence: [
        ...sample.beforeEvidence,
        ...sample.trainingEvidence,
        ...sample.taskExecutionEvidence,
        ...sample.retestEvidence,
      ],
      evaluatedAt: '2026-07-10T12:30:00.000Z',
    });

    validateSample(sample, evaluation, failures);

    return {
      sample,
      evaluation,
    };
  });

  printReport(results, failures);

  if (failures.length > 0) {
    throw new Error('Ability Change Evaluation debug check failed.');
  }
}

function validateSample(
  sample: AbilityChangeDebugSample,
  evaluation: ReturnType<typeof evaluateAbilityChange>,
  failures: string[],
): void {
  if (!isAbilityChangeEvaluation(evaluation)) {
    failures.push(`${sample.id}: AbilityChangeEvaluation should match schema.`);
  }
  if (evaluation.student_id !== sample.studentId) {
    failures.push(`${sample.id}: student_id should match input.`);
  }
  if (evaluation.target_ability !== sample.targetAbility) {
    failures.push(`${sample.id}: target_ability should match input.`);
  }
  if (evaluation.change_status !== sample.expectedChangeStatus) {
    failures.push(`${sample.id}: expected ${sample.expectedChangeStatus}, got ${evaluation.change_status}.`);
  }
  if (!evaluation.next_decision) {
    failures.push(`${sample.id}: next_decision should not be empty.`);
  }
  if (!evaluation.change_reason.includes(evaluation.evidence_basis[0])) {
    failures.push(`${sample.id}: change_reason should cite evidence_basis.`);
  }
  if (evaluation.confidence < 0 || evaluation.confidence > 1) {
    failures.push(`${sample.id}: confidence should be between 0 and 1.`);
  }
  if (!evaluation.validation.passed) {
    failures.push(`${sample.id}: validation should pass: ${evaluation.validation.issues.join('; ')}`);
  }
}

function printReport(
  results: Array<{
    sample: AbilityChangeDebugSample;
    evaluation: ReturnType<typeof evaluateAbilityChange>;
  }>,
  failures: string[],
): void {
  console.log('\nAbility Change Evaluation Debug Report');
  console.log('=====================================');

  for (const { sample, evaluation } of results) {
    console.log(`\n[${evaluation.change_status === sample.expectedChangeStatus ? 'PASS' : 'FAIL'}] ${sample.id}`);
    console.log(`title: ${sample.title}`);
    console.log(`Student ID: ${evaluation.student_id}`);
    console.log(`Target Ability: ${evaluation.target_ability}`);

    console.log('\nBefore Evidence Summary');
    printSummary(evaluation.before_summary);

    console.log('\nTraining / Task Execution Evidence Summary');
    printSummary(evaluation.training_summary);

    console.log('\nRetest Evidence Summary');
    printSummary(evaluation.retest_summary);

    console.log('\nEvaluation');
    console.log(`Change Status: ${evaluation.change_status}`);
    console.log(`Change Reason: ${evaluation.change_reason}`);
    console.log(`Evidence Basis: ${evaluation.evidence_basis.join(' | ')}`);
    console.log(`Confidence: ${Math.round(evaluation.confidence * 100)}%`);
    console.log(`Next Decision: ${evaluation.next_decision}`);
    console.log(`Next Decision Reason: ${evaluation.next_decision_reason}`);
    console.log(`Validation Issues: ${evaluation.validation.issues.join(' | ') || 'none'}`);
  }

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(results.map((item) => item.evaluation), null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 6.3 Ability Change Evaluation minimum loop is ready.');
  } else {
    console.log('[FAIL] Phase 6.3 Ability Change Evaluation minimum loop did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

function printSummary(summary: ReturnType<typeof evaluateAbilityChange>['before_summary']): void {
  console.log(`weakness: ${summary.weakness_count}`);
  console.log(`growth: ${summary.growth_count}`);
  console.log(`positive: ${summary.positive_count}`);
  console.log(`insufficient: ${summary.insufficient_count}`);
  console.log(`evidence_ids: ${summary.evidence_ids.join(', ') || 'none'}`);
  console.log(`key_observations: ${summary.key_observations.join(' | ') || 'none'}`);
}

runAbilityChangeEvaluationDebug();
