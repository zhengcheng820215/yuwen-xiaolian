import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import { evaluateAbilityEvidence } from '../agents/evaluationAgent.ts';
import { decideProfileUpdate } from '../agents/profileUpdateDecisionAgent.ts';
import { applyProfileUpdateDecision } from '../agents/profileUpdateExecutor.ts';
import { isEvaluationResult } from '../schemas/evaluationResult.schema.ts';
import { isProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import {
  isStudentAbilityProfile,
  type StudentAbilityProfile,
} from '../schemas/studentAbilityProfile.schema.ts';

const studentId = 'demo-student';
const ability = '推理';
const runAt = '2026-07-11T08:40:00.000Z';

function runPhase81Debug(): void {
  const evidence = makeEvidence();
  const currentProfile = makeProfile();
  const evaluationResult = evaluateAbilityEvidence({
    studentId,
    targetAbility: ability,
    evidence,
    evaluatedAt: runAt,
  });
  const profileUpdateDecision = decideProfileUpdate({
    evaluationResult,
    currentProfile,
    decidedAt: runAt,
  });
  const executionResult = applyProfileUpdateDecision({
    currentProfile,
    decision: profileUpdateDecision,
    appliedAt: runAt,
  });
  const failures: string[] = [];

  if (!isEvaluationResult(evaluationResult)) failures.push('EvaluationResult should match schema.');
  if (!isProfileUpdateDecision(profileUpdateDecision)) failures.push('ProfileUpdateDecision should match schema.');
  if (!isStudentAbilityProfile(executionResult.afterProfile)) failures.push('Updated profile should match schema.');
  if (evaluationResult.growthLevel !== 'improving') failures.push(`Expected growthLevel improving, got ${evaluationResult.growthLevel}.`);
  if (profileUpdateDecision.action !== 'update_status') failures.push(`Expected decision action update_status, got ${profileUpdateDecision.action}.`);
  const reasoningStatus = executionResult.afterProfile.ability_status.find((item) => item.ability === ability);
  if (reasoningStatus?.status !== 'improving') failures.push(`Expected profile status improving, got ${reasoningStatus?.status || 'missing'}.`);

  printReport({
    evidence,
    currentProfile,
    evaluationResult,
    profileUpdateDecision,
    executionResult,
    failures,
  });

  if (failures.length > 0) {
    throw new Error('Phase 8.1 debug check failed.');
  }
}

function makeEvidence(): AbilityEvidence[] {
  return [
    normalizeAbilityEvidence({
      id: 'phase81-weak-1',
      studentId,
      ability,
      evidenceType: 'weakness',
      source: 'diagnosis',
      detail: '答案缺少文本依据。',
      observation: '学生给出结论，但没有说明依据来自哪里。',
      confidence: 0.76,
      createdAt: '2026-07-10T08:00:00.000Z',
    }),
    normalizeAbilityEvidence({
      id: 'phase81-weak-2',
      studentId,
      ability,
      evidenceType: 'weakness',
      source: 'training',
      detail: '训练中仍需要提示才能补充推理过程。',
      observation: '学生能找到部分线索，但解释链条不完整。',
      confidence: 0.72,
      createdAt: '2026-07-10T08:20:00.000Z',
    }),
    normalizeAbilityEvidence({
      id: 'phase81-growth-1',
      studentId,
      ability,
      evidenceType: 'growth',
      source: 'training',
      detail: '训练后能够补充依据和解释关系。',
      observation: '学生开始使用文本线索说明结论。',
      confidence: 0.78,
      createdAt: '2026-07-10T08:40:00.000Z',
    }),
    normalizeAbilityEvidence({
      id: 'phase81-retest-growth-1',
      studentId,
      ability,
      evidenceType: 'growth',
      source: 'retest',
      detail: '独立复测中能够解释文本依据与结论关系。',
      observation: '学生在新题中独立写出依据和因果说明。',
      confidence: 0.82,
      createdAt: '2026-07-10T09:00:00.000Z',
    }),
  ];
}

function makeProfile(): StudentAbilityProfile {
  return {
    studentId,
    generatedAt: '2026-07-10T07:50:00.000Z',
    current_weakness: {
      primary: ability,
      secondary: ['表达'],
    },
    ability_status: [{
      ability,
      status: 'weak',
      summary: '推理当前仍以薄弱证据为主。',
      weakness_count: 2,
      positive_count: 0,
      growth_count: 0,
      insufficient_count: 0,
      evidence_links: [{
        evidenceId: 'phase81-weak-1',
        ability,
        evidenceType: 'weakness',
        source: 'diagnosis',
        observation: '学生给出结论，但没有说明依据来自哪里。',
        confidence: 0.76,
      }],
    }],
    improvement_signals: [],
    continue_training_focus: '继续围绕推理进行文本依据与推理链训练。',
    evidence_links: [{
      evidenceId: 'phase81-weak-1',
      ability,
      evidenceType: 'weakness',
      source: 'diagnosis',
      observation: '学生给出结论，但没有说明依据来自哪里。',
      confidence: 0.76,
    }],
    next_step_recommendation: '继续围绕推理进行训练。',
  };
}

function printReport(input: {
  evidence: AbilityEvidence[];
  currentProfile: StudentAbilityProfile;
  evaluationResult: ReturnType<typeof evaluateAbilityEvidence>;
  profileUpdateDecision: ReturnType<typeof decideProfileUpdate>;
  executionResult: ReturnType<typeof applyProfileUpdateDecision>;
  failures: string[];
}): void {
  console.log('\nPhase 8.1 Minimum Loop Debug Report');
  console.log('===================================');

  console.log('\nInput Evidence');
  console.log('--------------');
  for (const item of input.evidence) {
    console.log(`${item.id} / ${item.ability} / ${item.source} / ${item.evidenceType} / confidence ${formatPercent(item.confidence)}`);
  }

  console.log('\nEvaluationResult');
  console.log('----------------');
  console.log(JSON.stringify(input.evaluationResult, null, 2));

  console.log('\nProfileUpdateDecision');
  console.log('---------------------');
  console.log(JSON.stringify(input.profileUpdateDecision, null, 2));

  console.log('\nProfile Execution');
  console.log('-----------------');
  console.log(`action: ${input.executionResult.action}`);
  console.log(`changedFields: ${input.executionResult.changedFields.join(', ') || 'none'}`);
  console.log(`before status: ${input.currentProfile.ability_status[0]?.status}`);
  console.log(`after status: ${input.executionResult.afterProfile.ability_status[0]?.status}`);
  console.log(`next step: ${input.executionResult.afterProfile.next_step_recommendation}`);

  console.log('\nAcceptance');
  console.log('----------');
  if (input.failures.length === 0) {
    console.log('[PASS] Phase 8.1 minimum loop debug passed.');
  } else {
    console.log('[FAIL] Phase 8.1 minimum loop debug failed.');
    for (const failure of input.failures) {
      console.log(`- ${failure}`);
    }
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

runPhase81Debug();
