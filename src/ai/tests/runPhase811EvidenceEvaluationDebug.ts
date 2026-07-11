import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import { evaluateAbilityEvidence } from '../agents/evaluationAgent.ts';
import { isEvaluationResult } from '../schemas/evaluationResult.schema.ts';

const studentId = 'demo-student';
const targetAbility = '推理';
const evaluatedAt = '2026-07-11T08:10:00.000Z';

function runPhase811EvidenceEvaluationDebug(): void {
  const cases = buildEvaluationCases();
  const failures: string[] = [];

  console.log('\nPhase 8.1.1 Evidence Evaluation Debug');
  console.log('=====================================');

  for (const item of cases) {
    const result = evaluateAbilityEvidence({
      studentId,
      targetAbility,
      evidence: item.evidence,
      evaluatedAt,
    });

    console.log(`\n${item.name}`);
    console.log('------------------------------');
    console.log(`evidenceSufficiency: ${result.evidenceSufficiency}`);
    console.log(`growthLevel: ${result.growthLevel}`);
    console.log(`conflictStatus: ${result.conflictStatus}`);
    console.log(`nextAction: ${result.nextAction}`);
    console.log(`summary: ${result.summary}`);

    if (!isEvaluationResult(result)) {
      failures.push(`${item.name}: result should match EvaluationResult schema.`);
    }

    item.expect(result, failures);
  }

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.1.1 evidence evaluation debug passed.');
  } else {
    console.log('[FAIL] Phase 8.1.1 evidence evaluation debug failed.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
    throw new Error('Phase 8.1.1 debug check failed.');
  }
}

function buildEvaluationCases(): Array<{
  name: string;
  evidence: AbilityEvidence[];
  expect: (result: ReturnType<typeof evaluateAbilityEvidence>, failures: string[]) => void;
}> {
  return [
    {
      name: 'Case 1: 全部证据不足',
      evidence: makeEvidence([
        ['ev-ins-1', 'insufficient', 'diagnosis'],
        ['ev-ins-2', 'insufficient', 'retest'],
      ]),
      expect: (result, failures) => {
        if (result.evidenceSufficiency !== 'insufficient') failures.push('Case 1 should be insufficient.');
        if (result.growthLevel !== 'unconfirmed') failures.push('Case 1 should be unconfirmed.');
        if (result.nextAction !== 'collect_more_evidence') failures.push('Case 1 should collect more evidence.');
      },
    },
    {
      name: 'Case 2: weakness 为主',
      evidence: makeEvidence([
        ['ev-weak-1', 'weakness', 'diagnosis'],
        ['ev-weak-2', 'weakness', 'training'],
        ['ev-weak-3', 'weakness', 'retest'],
      ]),
      expect: (result, failures) => {
        if (result.evidenceSufficiency !== 'sufficient') failures.push('Case 2 should be sufficient.');
        if (result.growthLevel !== 'unconfirmed') failures.push('Case 2 should be unconfirmed.');
        if (result.nextAction !== 'continue_training') failures.push('Case 2 should continue training.');
      },
    },
    {
      name: 'Case 3: 出现早期改善迹象',
      evidence: makeEvidence([
        ['ev-weak-4', 'weakness', 'diagnosis'],
        ['ev-weak-5', 'weakness', 'training'],
        ['ev-growth-1', 'growth', 'training'],
      ]),
      expect: (result, failures) => {
        if (result.growthLevel !== 'early_signal') failures.push('Case 3 should be early_signal.');
        if (result.nextAction !== 'independent_retest') failures.push('Case 3 should request independent retest.');
      },
    },
    {
      name: 'Case 4: 证据冲突',
      evidence: makeEvidence([
        ['ev-weak-6', 'weakness', 'diagnosis'],
        ['ev-weak-7', 'weakness', 'retest'],
        ['ev-pos-1', 'positive', 'training'],
        ['ev-pos-2', 'positive', 'retest'],
        ['ev-growth-2', 'growth', 'training'],
      ]),
      expect: (result, failures) => {
        if (result.conflictStatus !== 'significant') failures.push('Case 4 should be significant conflict.');
        if (result.growthLevel !== 'fluctuating') failures.push('Case 4 should be fluctuating.');
        if (result.nextAction !== 'human_review') failures.push('Case 4 should require human review.');
      },
    },
  ];
}

function makeEvidence(items: Array<[string, AbilityEvidence['evidenceType'], AbilityEvidence['source']]>): AbilityEvidence[] {
  return items.map(([id, evidenceType, source], index) => normalizeAbilityEvidence({
    id,
    studentId,
    ability: targetAbility,
    evidenceType,
    source,
    detail: `${targetAbility} ${evidenceType} debug detail`,
    observation: `${targetAbility} ${evidenceType} debug observation`,
    confidence: 0.72 + index * 0.02,
    createdAt: `2026-07-11T08:0${index}:00.000Z`,
  }));
}

runPhase811EvidenceEvaluationDebug();
