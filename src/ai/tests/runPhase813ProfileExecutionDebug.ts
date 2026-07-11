import { applyProfileUpdateDecision } from '../agents/profileUpdateExecutor.ts';
import type { ProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import { isStudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';

const studentId = 'demo-student';
const ability = '推理';
const appliedAt = '2026-07-11T08:30:00.000Z';

function runPhase813ProfileExecutionDebug(): void {
  const cases = buildExecutionCases();
  const failures: string[] = [];

  console.log('\nPhase 8.1.3 Profile Decision Execution Debug');
  console.log('============================================');

  for (const item of cases) {
    const result = applyProfileUpdateDecision({
      currentProfile: makeProfile(),
      decision: item.decision,
      appliedAt,
    });

    console.log(`\n${item.name}`);
    console.log('------------------------------');
    console.log(`action: ${result.action}`);
    console.log(`changedFields: ${result.changedFields.join(', ') || 'none'}`);
    console.log(`next_step_recommendation: ${result.afterProfile.next_step_recommendation}`);

    if (!isStudentAbilityProfile(result.afterProfile)) {
      failures.push(`${item.name}: afterProfile should match StudentAbilityProfile schema.`);
    }

    item.expect(result, failures);
  }

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.1.3 profile decision execution debug passed.');
  } else {
    console.log('[FAIL] Phase 8.1.3 profile decision execution debug failed.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
    throw new Error('Phase 8.1.3 debug check failed.');
  }
}

function buildExecutionCases(): Array<{
  name: string;
  decision: ProfileUpdateDecision;
  expect: (result: ReturnType<typeof applyProfileUpdateDecision>, failures: string[]) => void;
}> {
  return [
    {
      name: 'Case 1: 只追加证据',
      decision: makeDecision('append_evidence_only'),
      expect: (result, failures) => {
        const status = findAbilityStatus(result.afterProfile);
        if (status?.status !== 'weak') failures.push('Case 1 should not change long-term status.');
        if (!status?.evidence_links.some((link) => link.evidenceId === 'ev-new')) failures.push('Case 1 should append evidence link.');
      },
    },
    {
      name: 'Case 2: 更新置信度',
      decision: makeDecision('update_confidence', { confidenceDelta: 0.08 }),
      expect: (result, failures) => {
        const status = findAbilityStatus(result.afterProfile);
        if (status?.status !== 'weak') failures.push('Case 2 should not upgrade ability status.');
      },
    },
    {
      name: 'Case 3: 更新状态为 improving',
      decision: makeDecision('update_status', { toStatus: 'improving' }),
      expect: (result, failures) => {
        const status = findAbilityStatus(result.afterProfile);
        if (status?.status !== 'improving') failures.push('Case 3 should update status to improving.');
        if (!result.changedFields.includes('ability_status.status')) failures.push('Case 3 should report status change.');
      },
    },
    {
      name: 'Case 4: 标记波动',
      decision: makeDecision('mark_fluctuating'),
      expect: (result, failures) => {
        const status = findAbilityStatus(result.afterProfile);
        if (!status?.summary.includes('波动')) failures.push('Case 4 summary should mention fluctuation.');
        if (status?.status === 'stable_positive') failures.push('Case 4 should not output stable status.');
      },
    },
    {
      name: 'Case 5: 请求复测',
      decision: makeDecision('request_retest'),
      expect: (result, failures) => {
        const status = findAbilityStatus(result.afterProfile);
        if (status?.status !== 'weak') failures.push('Case 5 should not change long-term status.');
        if (!result.afterProfile.next_step_recommendation.includes('复测')) failures.push('Case 5 should request retest.');
      },
    },
  ];
}

function makeDecision(
  action: ProfileUpdateDecision['action'],
  overrides: Partial<ProfileUpdateDecision> = {},
): ProfileUpdateDecision {
  return {
    decisionId: `decision-${action}`,
    studentId,
    abilityId: ability,
    abilityLabel: ability,
    action,
    reason: `${ability} ${action} debug decision`,
    fromStatus: 'weak',
    appendEvidenceIds: ['ev-new'],
    pendingVerification: ['安排同能力独立复测。'],
    warnings: action === 'update_status' ? ['状态更新仍需后续验证。'] : [],
    evidenceLinks: ['ev-new'],
    createdAt: appliedAt,
    ...overrides,
  };
}

function makeProfile(): StudentAbilityProfile {
  return {
    studentId,
    generatedAt: '2026-07-11T08:00:00.000Z',
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

function findAbilityStatus(profile: StudentAbilityProfile) {
  return profile.ability_status.find((item) => item.ability === ability);
}

runPhase813ProfileExecutionDebug();
