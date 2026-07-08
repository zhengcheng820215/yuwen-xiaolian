import { readFileSync } from 'node:fs';
import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import { runTrainingEvidenceLoop } from '../agents/trainingEvaluationAgent.ts';
import {
  rankWeaknesses,
  summarizeAbilityEvidence,
} from '../agents/weaknessRankingAgent.ts';
import {
  generateStudentAbilityProfile,
} from '../agents/studentAbilityProfileAgent.ts';
import {
  isStudentAbilityProfile,
  type StudentAbilityProfile,
} from '../schemas/studentAbilityProfile.schema.ts';
import type { TrainingEvidenceLoopInput } from '../schemas/trainingEvaluation.schema.ts';

const studentId = 'demo-student';
const generatedAt = '2026-07-08T12:00:00.000Z';

const trainingLoopInput: Omit<TrainingEvidenceLoopInput, 'previousEvidence'> = {
  studentId,
  ability: '推理',
  weakness: '推理链不完整',
  trainingFocus: '文本依据 + 推理链训练',
  dayTask: '阅读短文，回答：作者为什么说“秋天的落叶像信件”？',
  studentTrainingAnswer: '因为落叶很多。',
  retestQuestion: '作者为什么说“落叶记录了季节变化”？',
  studentRetestAnswer: '因为落叶记录了季节变化，表达作者对时间流逝的感受。',
  createdAt: '2026-07-08T11:00:00.000Z',
};

function runStudentAbilityProfileDebug(): void {
  const previousEvidence = loadPreviousEvidence();
  const trainingLoopResult = runTrainingEvidenceLoop({
    ...trainingLoopInput,
    previousEvidence,
  });
  const updatedEvidence = trainingLoopResult.updatedEvidence;
  const evidenceSummary = summarizeAbilityEvidence(updatedEvidence);
  const topWeakness = rankWeaknesses(updatedEvidence, 3);
  const trainingEvidence = trainingLoopResult.generatedEvidence.find((item) => item.source === 'training');
  const retestEvidence = trainingLoopResult.generatedEvidence.find((item) => item.source === 'retest');
  const profile = generateStudentAbilityProfile({
    studentId,
    evidenceSummary,
    topWeakness,
    evidence: updatedEvidence,
    trainingEvidence,
    retestEvidence,
    generatedAt,
  });
  const failures: string[] = [];

  validateProfile(profile, failures);
  printReport(profile, failures);

  if (failures.length > 0) {
    throw new Error('Student Ability Profile debug check failed.');
  }
}

function loadPreviousEvidence(): AbilityEvidence[] {
  const evidenceUrl = new URL('../../data/studentAbilityEvidence.mock.json', import.meta.url);
  const raw = readFileSync(evidenceUrl, 'utf8');
  const parsed = JSON.parse(raw) as Partial<AbilityEvidence>[];

  return parsed.map((item) => normalizeAbilityEvidence(item));
}

function validateProfile(profile: StudentAbilityProfile, failures: string[]): void {
  if (!isStudentAbilityProfile(profile)) {
    failures.push('Profile should match StudentAbilityProfile schema.');
  }

  if (profile.current_weakness.primary !== '表达') {
    failures.push(`Primary weakness should be 表达 after 推理 growth evidence, got ${profile.current_weakness.primary}.`);
  }

  if (!profile.current_weakness.secondary.includes('推理')) {
    failures.push('Secondary weakness should keep 推理 for continued observation.');
  }

  const reasoningStatus = profile.ability_status.find((item) => item.ability === '推理');
  if (reasoningStatus?.status !== 'improving') {
    failures.push(`推理 status should be improving, got ${reasoningStatus?.status || 'missing'}.`);
  }

  if (profile.improvement_signals.length < 2) {
    failures.push('Profile should include training and retest improvement signals.');
  }

  if (!profile.continue_training_focus.includes('表达')) {
    failures.push('continue_training_focus should mention 表达.');
  }

  if (!profile.next_step_recommendation.includes('表达')) {
    failures.push('next_step_recommendation should recommend next action for 表达.');
  }

  if (profile.evidence_links.length === 0) {
    failures.push('Profile should include evidence_links.');
  }
}

function printReport(profile: StudentAbilityProfile, failures: string[]): void {
  console.log('\nStudent Ability Profile Debug Report');
  console.log('====================================');
  console.log(`studentId: ${profile.studentId}`);
  console.log(`generatedAt: ${profile.generatedAt}`);

  console.log('\nCurrent Weakness');
  console.log('----------------');
  console.log(`primary: ${profile.current_weakness.primary}`);
  console.log(`secondary: ${profile.current_weakness.secondary.join(', ') || 'none'}`);

  console.log('\nAbility Status');
  console.log('--------------');
  for (const item of profile.ability_status) {
    console.log(`${item.ability}: ${item.status}`);
    console.log(`  weakness ${item.weakness_count}, positive ${item.positive_count}, growth ${item.growth_count}, insufficient ${item.insufficient_count}`);
    console.log(`  summary: ${item.summary}`);
  }

  console.log('\nImprovement Signals');
  console.log('-------------------');
  for (const signal of profile.improvement_signals) {
    console.log(`${signal.ability} / ${signal.from} / confidence ${formatPercent(signal.confidence)}`);
    console.log(`  ${signal.signal}`);
  }

  console.log('\nContinue Training Focus');
  console.log('-----------------------');
  console.log(profile.continue_training_focus);

  console.log('\nNext Step Recommendation');
  console.log('------------------------');
  console.log(profile.next_step_recommendation);

  console.log('\nEvidence Links');
  console.log('--------------');
  for (const link of profile.evidence_links) {
    console.log(`${link.evidenceId} / ${link.ability} / ${link.source} / ${link.evidenceType} / confidence ${formatPercent(link.confidence)}`);
  }

  console.log('\nStable JSON Output');
  console.log('------------------');
  console.log(JSON.stringify(profile, null, 2));

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Student Ability Profile debug demo meets Phase 4.1 minimum loop acceptance.');
  } else {
    console.log('[FAIL] Student Ability Profile debug demo did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

runStudentAbilityProfileDebug();
