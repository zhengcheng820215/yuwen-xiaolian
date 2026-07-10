import { readFileSync } from 'node:fs';
import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import {
  rankWeaknesses,
  summarizeAbilityEvidence,
  type AbilityEvidenceSummary,
  type WeaknessRankingItem,
} from '../agents/weaknessRankingAgent.ts';
import { generateTrainingPlan } from '../agents/trainingPlanAgent.ts';
import {
  isTrainingPlan,
  TRAINING_PLAN_DAY_COUNT,
  type TrainingPlan,
} from '../schemas/trainingPlan.schema.ts';

const studentId = 'demo-student';
const generatedAt = '2026-07-08T10:00:00.000Z';

function runTrainingPlanDebug(): void {
  const evidenceList = loadMockEvidence();
  const summaries = summarizeAbilityEvidence(evidenceList);
  const ranking = rankWeaknesses(evidenceList, 3);
  const plan = generateTrainingPlan({
    studentId,
    weaknessRanking: ranking,
    evidenceSummary: summaries,
    generatedAt,
  });
  const failures: string[] = [];

  validateTrainingPlan(plan, ranking, summaries, failures);
  printReport(summaries, ranking, plan, failures);

  if (failures.length > 0) {
    throw new Error('Training Plan debug check failed.');
  }
}

function loadMockEvidence(): AbilityEvidence[] {
  const evidenceUrl = new URL('../../data/studentAbilityEvidence.mock.json', import.meta.url);
  const historicalEvidence = JSON.parse(readFileSync(evidenceUrl, 'utf8')) as Partial<AbilityEvidence>[];
  const phase32Evidence: Partial<AbilityEvidence>[] = [
    {
      id: 'phase32-diagnosis-inference-001',
      studentId,
      ability: '推理',
      evidenceType: 'weakness',
      source: 'diagnosis',
      observation: '学生有结论，但没有写出文本线索到结论的推理链。',
      rootCause: '缺少文本依据，推理链不完整。',
      confidence: 0.74,
      createdAt: '2026-07-08T09:00:00.000Z',
      taskId: 'task-inference-001',
      diagnosisId: 'diagnosis-inference-001',
    },
    {
      id: 'phase32-diagnosis-inference-002',
      studentId,
      ability: '推理',
      evidenceType: 'weakness',
      source: 'diagnosis',
      observation: '学生用主观判断替代文本依据。',
      rootCause: '尚未建立从文本线索到结论的推理链。',
      confidence: 0.69,
      createdAt: '2026-07-08T09:05:00.000Z',
      taskId: 'task-inference-002',
      diagnosisId: 'diagnosis-inference-002',
    },
    {
      id: 'phase32-diagnosis-expression-001',
      studentId,
      ability: '表达',
      evidenceType: 'weakness',
      source: 'diagnosis',
      observation: '学生能表达观点，但缺少依据和说明。',
      rootCause: '答案组织不完整，尚未形成观点、依据、说明的表达结构。',
      confidence: 0.67,
      createdAt: '2026-07-08T09:10:00.000Z',
      taskId: 'task-expression-001',
      diagnosisId: 'diagnosis-expression-001',
    },
    {
      id: 'phase32-diagnosis-extraction-001',
      studentId,
      ability: '信息提取',
      evidenceType: 'weakness',
      source: 'diagnosis',
      observation: '学生找到部分信息，但遗漏题干限定条件。',
      rootCause: '关键文本定位不稳定，容易遗漏题干限定条件。',
      confidence: 0.71,
      createdAt: '2026-07-08T09:15:00.000Z',
      taskId: 'task-extraction-001',
      diagnosisId: 'diagnosis-extraction-001',
    },
    {
      id: 'phase32-diagnosis-summary-001',
      studentId,
      ability: '概括',
      evidenceType: 'positive',
      source: 'diagnosis',
      observation: '学生能够提取核心事件并概括主要内容。',
      rootCause: '本次概括任务已达到要求。',
      confidence: 0.81,
      createdAt: '2026-07-08T09:20:00.000Z',
      taskId: 'task-summary-001',
      diagnosisId: 'diagnosis-summary-001',
    },
  ];

  return [...historicalEvidence, ...phase32Evidence].map((item) => normalizeAbilityEvidence(item));
}

function validateTrainingPlan(
  plan: TrainingPlan,
  ranking: WeaknessRankingItem[],
  summaries: AbilityEvidenceSummary[],
  failures: string[],
): void {
  if (!isTrainingPlan(plan)) {
    failures.push('Training plan should match the stable Phase 3.2 schema.');
  }

  if (ranking.length === 0) {
    failures.push('Debug input should include Top Weakness ranking.');
    return;
  }

  if (plan.primary_target_ability !== ranking[0].ability) {
    failures.push(`Primary target ability should be "${ranking[0].ability}", got "${plan.primary_target_ability}".`);
  }

  if (plan.days.length !== TRAINING_PLAN_DAY_COUNT) {
    failures.push(`Training plan should include ${TRAINING_PLAN_DAY_COUNT} days.`);
  }

  for (const day of plan.days) {
    const linkedRanking = ranking.find((item) => item.ability === day.target_ability);
    const linkedSummary = summaries.find((item) => item.ability === day.target_ability);

    if (!linkedRanking) {
      failures.push(`Day ${day.day} target ability "${day.target_ability}" should come from Top Weakness.`);
    }

    if (!linkedSummary || linkedSummary.weaknessCount <= 0) {
      failures.push(`Day ${day.day} should connect to weakness evidence summary.`);
    }

    if (!day.reason_from_evidence.includes('Phase 3.1')) {
      failures.push(`Day ${day.day} should explicitly reference Phase 3.1 evidence.`);
    }

    if (!day.targetSkill) {
      failures.push(`Day ${day.day} should include targetSkill.`);
    }

    if (!day.strategy) {
      failures.push(`Day ${day.day} should include training strategy.`);
    }

    if (!day.successCriteria?.measurable || !day.successCriteria.description) {
      failures.push(`Day ${day.day} should include measurable successCriteria.`);
    }

    if (day.tasks.length === 0) {
      failures.push(`Day ${day.day} should include daily tasks.`);
    }

    if (day.success_criteria.length === 0) {
      failures.push(`Day ${day.day} should include success criteria.`);
    }

    if (day.evidence_links.length === 0) {
      failures.push(`Day ${day.day} should include evidence links.`);
    }
  }
}

function printReport(
  summaries: AbilityEvidenceSummary[],
  ranking: WeaknessRankingItem[],
  plan: TrainingPlan,
  failures: string[],
): void {
  console.log('\nTraining Plan Debug Report');
  console.log('==========================');

  console.log('\nPhase 3.1 Evidence Summary');
  console.log('--------------------------');
  for (const summary of summaries) {
    console.log(`${summary.ability}: weakness ${summary.weaknessCount}, positive ${summary.positiveCount}, growth ${summary.growthCount}, insufficient ${summary.insufficientCount}, avgConfidence ${formatPercent(summary.averageConfidence)}`);
  }

  console.log('\nPhase 3.1 Top Weakness');
  console.log('----------------------');
  for (let index = 0; index < ranking.length; index += 1) {
    const item = ranking[index];
    console.log(`${index + 1}. ${item.ability} | weakness ${item.weaknessCount} | confidence ${formatPercent(item.averageConfidence)} | focus ${item.suggestedTrainingFocus}`);
  }

  console.log('\nPhase 3.2 Training Plan');
  console.log('-----------------------');
  console.log(`plan_id: ${plan.plan_id}`);
  console.log(`student_id: ${plan.student_id}`);
  console.log(`primary_target_ability: ${plan.primary_target_ability}`);
  console.log(`summary: ${plan.summary}`);

  for (const day of plan.days) {
    console.log(`\nDay ${day.day}: ${day.target_ability}`);
    console.log(`  targetSkill: ${day.targetSkill}`);
    console.log(`  strategy: ${day.strategy}`);
    console.log(`  training_goal: ${day.training_goal}`);
    console.log(`  reason_from_evidence: ${day.reason_from_evidence}`);
    console.log(`  focus_skills: ${day.focus_skills.join(' / ')}`);
    console.log(`  practice_type: ${day.practice_type}`);
    console.log('  tasks:');
    for (const task of day.tasks) {
      console.log(`  - ${task}`);
    }
    console.log('  success_criteria:');
    for (const criterion of day.success_criteria) {
      console.log(`  - ${criterion}`);
    }
    console.log(`  successCriteria: measurable=${day.successCriteria.measurable}, ${day.successCriteria.description}`);
    console.log('  evidence_links:');
    for (const link of day.evidence_links) {
      console.log(`  - ${link.ability}: weakness ${link.weaknessCount}, confidence ${formatPercent(link.averageConfidence)}`);
    }
  }

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(plan, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Training Plan debug demo meets Phase 3.2 minimum loop acceptance.');
  } else {
    console.log('[FAIL] Training Plan debug demo did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

runTrainingPlanDebug();
