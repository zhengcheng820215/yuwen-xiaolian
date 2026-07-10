import { readFileSync } from 'node:fs';
import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import { runTrainingEvidenceLoop } from '../agents/trainingEvaluationAgent.ts';
import {
  isTrainingEvidenceLoopResult,
  type TrainingEvidenceLoopInput,
} from '../schemas/trainingEvaluation.schema.ts';
import { summarizeAbilityEvidence } from '../agents/weaknessRankingAgent.ts';

const studentId = 'demo-student';
const createdAt = '2026-07-08T11:00:00.000Z';

const debugInput: Omit<TrainingEvidenceLoopInput, 'previousEvidence'> = {
  studentId,
  ability: '推理',
  weakness: '推理链不完整',
  trainingFocus: '文本依据 + 推理链训练',
  targetSkill: '文本证据 -> 观点推断',
  dayTask: '阅读短文，回答：作者为什么说“秋天的落叶像信件”？',
  studentTrainingAnswer: '因为落叶很多。',
  retestQuestion: '作者为什么说“落叶记录了季节变化”？',
  studentRetestAnswer: '因为落叶记录了季节变化，表达作者对时间流逝的感受。',
  createdAt,
};

function runTrainingEvidenceDebug(): void {
  const previousEvidence = loadPreviousEvidence();
  const result = runTrainingEvidenceLoop({
    ...debugInput,
    previousEvidence,
  });
  const failures: string[] = [];

  validateResult(result, previousEvidence, failures);
  printReport(previousEvidence, result, failures);

  if (failures.length > 0) {
    throw new Error('Training Evidence debug check failed.');
  }
}

function loadPreviousEvidence(): AbilityEvidence[] {
  const evidenceUrl = new URL('../../data/studentAbilityEvidence.mock.json', import.meta.url);
  const raw = readFileSync(evidenceUrl, 'utf8');
  const parsed = JSON.parse(raw) as Partial<AbilityEvidence>[];

  return parsed.map((item) => normalizeAbilityEvidence(item));
}

function validateResult(
  result: ReturnType<typeof runTrainingEvidenceLoop>,
  previousEvidence: AbilityEvidence[],
  failures: string[],
): void {
  if (!isTrainingEvidenceLoopResult(result)) {
    failures.push('Result should match TrainingEvidenceLoopResult schema.');
  }

  const trainingEvidence = result.generatedEvidence.find((item) => item.source === 'training');
  const retestEvidence = result.generatedEvidence.find((item) => item.source === 'retest');

  if (!trainingEvidence) {
    failures.push('Generated evidence should include source="training".');
  }

  if (!retestEvidence) {
    failures.push('Generated evidence should include source="retest".');
  }

  if (trainingEvidence?.ability !== debugInput.ability || retestEvidence?.ability !== debugInput.ability) {
    failures.push('Generated evidence should keep the target ability.');
  }

  if (result.updatedEvidence.length !== previousEvidence.length + result.generatedEvidence.length) {
    failures.push('Updated evidence should append generated evidence to previous evidence.');
  }

  if (result.trainingEvaluation.status !== 'improving_not_stable') {
    failures.push(`Training status should be improving_not_stable, got ${result.trainingEvaluation.status}.`);
  }

  if (result.retestEvaluation.abilityChange !== '+1') {
    failures.push(`Retest abilityChange should be +1, got ${result.retestEvaluation.abilityChange}.`);
  }

  if (result.retestEvaluation.transferLevel !== 'successful') {
    failures.push(`Retest transferLevel should be successful, got ${result.retestEvaluation.transferLevel}.`);
  }

  if (result.abilityChange.change !== 'improved') {
    failures.push(`Ability change should be improved, got ${result.abilityChange.change}.`);
  }

  if (!result.targetSkill) {
    failures.push('Result should include targetSkill.');
  }
}

function printReport(
  previousEvidence: AbilityEvidence[],
  result: ReturnType<typeof runTrainingEvidenceLoop>,
  failures: string[],
): void {
  console.log('\nTraining Evidence Debug Report');
  console.log('==============================');

  console.log('\nOriginal Weakness');
  console.log('-----------------');
  console.log(`ability: ${result.ability}`);
  console.log(`weakness: ${result.originalWeakness}`);
  console.log(`trainingFocus: ${result.trainingFocus}`);
  console.log(`targetSkill: ${result.targetSkill}`);

  console.log('\nTraining Task');
  console.log('-------------');
  console.log(`task: ${result.trainingEvaluation.trainingTask}`);
  console.log(`studentAnswer: ${result.trainingEvaluation.studentAnswer}`);
  console.log(`status: ${result.trainingEvaluation.status}`);
  console.log(`targetSkill: ${result.trainingEvaluation.targetSkill}`);
  console.log(`observation: ${result.trainingEvaluation.observation}`);
  console.log('processFindings:');
  for (const finding of result.trainingEvaluation.processFindings) {
    console.log(`- ${finding}`);
  }

  console.log('\nRetest');
  console.log('------');
  console.log(`question: ${result.retestEvaluation.retestQuestion}`);
  console.log(`studentAnswer: ${result.retestEvaluation.studentAnswer}`);
  console.log(`abilityChange: ${result.retestEvaluation.abilityChange}`);
  console.log(`abilityChangeSignal: ${result.retestEvaluation.abilityChangeSignal}`);
  console.log(`transferLevel: ${result.retestEvaluation.transferLevel}`);
  console.log(`targetSkill: ${result.retestEvaluation.targetSkill}`);
  console.log(`comparison: ${result.retestEvaluation.comparison}`);
  console.log(`observation: ${result.retestEvaluation.observation}`);

  console.log('\nAbility Change');
  console.log('--------------');
  console.log(`ability: ${result.abilityChange.ability}`);
  console.log(`before: weakness ${result.abilityChange.before.weaknessCount}, positive ${result.abilityChange.before.positiveCount}, growth ${result.abilityChange.before.growthCount}`);
  console.log(`after: weakness ${result.abilityChange.after.weaknessCount}, positive ${result.abilityChange.after.positiveCount}, growth ${result.abilityChange.after.growthCount}`);
  console.log(`change: ${result.abilityChange.change}`);
  console.log(`reason: ${result.abilityChange.reason}`);

  console.log('\nGenerated Evidence');
  console.log('------------------');
  for (const evidence of result.generatedEvidence) {
    console.log(`${evidence.source} / ${evidence.evidenceType} / ${evidence.ability}`);
    console.log(`  reason: ${evidence.reason || 'none'}`);
    console.log(`  detail: ${evidence.detail}`);
    console.log(`  observation: ${evidence.observation}`);
    console.log(`  rootCause: ${evidence.rootCause}`);
    console.log(`  confidence: ${formatPercent(evidence.confidence)}`);
  }

  console.log('\nEvidence Growth');
  console.log('---------------');
  console.log(`previousEvidence: ${previousEvidence.length}`);
  console.log(`generatedEvidence: ${result.generatedEvidence.length}`);
  console.log(`updatedEvidence: ${result.updatedEvidence.length}`);

  console.log('\nUpdated Ability Evidence Summary');
  console.log('--------------------------------');
  for (const summary of summarizeAbilityEvidence(result.updatedEvidence)) {
    console.log(`${summary.ability}: weakness ${summary.weaknessCount}, positive ${summary.positiveCount}, growth ${summary.growthCount}, insufficient ${summary.insufficientCount}, avgConfidence ${formatPercent(summary.averageConfidence)}`);
  }

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Training Evidence debug demo meets Phase 3.3 minimum loop acceptance.');
  } else {
    console.log('[FAIL] Training Evidence debug demo did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

runTrainingEvidenceDebug();
