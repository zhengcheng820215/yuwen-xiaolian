import { decideProfileUpdate } from '../agents/profileUpdateDecisionAgent.ts';
import { isProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import type { EvaluationResult } from '../schemas/evaluationResult.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';

const studentId = 'demo-student';
const ability = '推理';
const decidedAt = '2026-07-11T08:20:00.000Z';

function runPhase812ProfileDecisionDebug(): void {
  const profile = makeProfile();
  const cases = buildDecisionCases();
  const failures: string[] = [];

  console.log('\nPhase 8.1.2 Profile Update Decision Debug');
  console.log('=========================================');

  for (const item of cases) {
    const decision = decideProfileUpdate({
      evaluationResult: item.evaluation,
      currentProfile: profile,
      decidedAt,
    });

    console.log(`\n${item.name}`);
    console.log('------------------------------');
    console.log(`action: ${decision.action}`);
    console.log(`reason: ${decision.reason}`);
    console.log(`warnings: ${decision.warnings.join(' / ') || 'none'}`);

    if (!isProfileUpdateDecision(decision)) {
      failures.push(`${item.name}: decision should match ProfileUpdateDecision schema.`);
    }

    item.expect(decision, failures);
  }

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.1.2 profile update decision debug passed.');
  } else {
    console.log('[FAIL] Phase 8.1.2 profile update decision debug failed.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
    throw new Error('Phase 8.1.2 debug check failed.');
  }
}

function buildDecisionCases(): Array<{
  name: string;
  evaluation: EvaluationResult;
  expect: (decision: ReturnType<typeof decideProfileUpdate>, failures: string[]) => void;
}> {
  return [
    {
      name: 'Case 1: 证据不足',
      evaluation: makeEvaluation('insufficient', 'unconfirmed', 'none', 'collect_more_evidence'),
      expect: (decision, failures) => {
        if (decision.action !== 'append_evidence_only') failures.push('Case 1 should append evidence only.');
      },
    },
    {
      name: 'Case 2: 早期改善迹象',
      evaluation: makeEvaluation('limited', 'early_signal', 'minor', 'independent_retest'),
      expect: (decision, failures) => {
        if (decision.action !== 'update_confidence') failures.push('Case 2 should update confidence only.');
      },
    },
    {
      name: 'Case 3: 改善较明确',
      evaluation: makeEvaluation('sufficient', 'improving', 'none', 'transfer_test'),
      expect: (decision, failures) => {
        if (decision.action !== 'update_status') failures.push('Case 3 should update status.');
        if (decision.toStatus !== 'improving') failures.push('Case 3 toStatus should be improving.');
      },
    },
    {
      name: 'Case 4: 表现波动',
      evaluation: makeEvaluation('sufficient', 'fluctuating', 'minor', 'independent_retest'),
      expect: (decision, failures) => {
        if (decision.action !== 'mark_fluctuating') failures.push('Case 4 should mark fluctuating.');
      },
    },
    {
      name: 'Case 5: 明显冲突',
      evaluation: makeEvaluation('sufficient', 'fluctuating', 'significant', 'human_review'),
      expect: (decision, failures) => {
        if (decision.action !== 'human_review') failures.push('Case 5 should require human review.');
      },
    },
  ];
}

function makeEvaluation(
  evidenceSufficiency: EvaluationResult['evidenceSufficiency'],
  growthLevel: EvaluationResult['growthLevel'],
  conflictStatus: EvaluationResult['conflictStatus'],
  nextAction: EvaluationResult['nextAction'],
): EvaluationResult {
  return {
    evaluationId: `eval-${evidenceSufficiency}-${growthLevel}-${conflictStatus}`,
    studentId,
    abilityId: ability,
    abilityLabel: ability,
    evidenceSufficiency,
    growthLevel,
    weaknessEvidenceCount: growthLevel === 'unconfirmed' ? 3 : 1,
    positiveEvidenceCount: growthLevel === 'fluctuating' ? 2 : 0,
    growthEvidenceCount: growthLevel === 'unconfirmed' ? 0 : 1,
    insufficientEvidenceCount: evidenceSufficiency === 'insufficient' ? 2 : 0,
    hasIndependentRetestEvidence: growthLevel === 'improving',
    hasTransferEvidence: nextAction === 'transfer_test',
    conflictStatus,
    confidence: evidenceSufficiency === 'sufficient' ? 0.78 : 0.52,
    summary: `${ability} evaluation debug: ${evidenceSufficiency}/${growthLevel}/${conflictStatus}`,
    limitations: evidenceSufficiency === 'sufficient' ? ['仍需后续验证稳定性。'] : ['有效证据不足。'],
    nextAction,
    evidenceLinks: ['ev-1', 'ev-2'],
    createdAt: decidedAt,
  };
}

function makeProfile(): StudentAbilityProfile {
  return {
    studentId,
    generatedAt: decidedAt,
    current_weakness: {
      primary: ability,
      secondary: [],
    },
    ability_status: [{
      ability,
      status: 'weak',
      summary: '推理当前仍以薄弱证据为主。',
      weakness_count: 3,
      positive_count: 0,
      growth_count: 0,
      insufficient_count: 0,
      evidence_links: [{
        evidenceId: 'ev-old',
        ability,
        evidenceType: 'weakness',
        source: 'diagnosis',
        observation: '缺少文本依据。',
        confidence: 0.72,
      }],
    }],
    improvement_signals: [],
    continue_training_focus: '继续围绕推理训练。',
    evidence_links: [{
      evidenceId: 'ev-old',
      ability,
      evidenceType: 'weakness',
      source: 'diagnosis',
      observation: '缺少文本依据。',
      confidence: 0.72,
    }],
    next_step_recommendation: '继续围绕推理进行训练。',
  };
}

runPhase812ProfileDecisionDebug();
