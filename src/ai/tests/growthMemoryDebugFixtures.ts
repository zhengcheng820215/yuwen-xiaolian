import { evaluateAbilityEvidence } from '../agents/evaluationAgent.ts';
import { decideProfileUpdate } from '../agents/profileUpdateDecisionAgent.ts';
import { applyProfileUpdateDecision } from '../agents/profileUpdateExecutor.ts';
import { createGrowthMemoryRecord } from '../agents/growthMemoryRecordAgent.ts';
import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import type { ProfileUpdateAction } from '../schemas/profileUpdateDecision.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';

const defaultStudentId = 'demo-student';
const defaultAbility = '推理';
const defaultRunAt = '2026-07-12T08:20:00.000Z';

export function buildGrowthMemoryRecordFixture(
  expectedAction?: ProfileUpdateAction,
  options: {
    student?: string;
    targetAbility?: string;
    runTime?: string;
    evidence?: AbilityEvidence[];
    profile?: StudentAbilityProfile;
    relatedSessionId?: string;
  } = {},
) {
  const studentId = options.student || defaultStudentId;
  const ability = options.targetAbility || defaultAbility;
  const runAt = options.runTime || defaultRunAt;
  const evidence = options.evidence || makeImprovingEvidence(studentId, ability);
  const currentProfile = options.profile || makeProfile(studentId, ability);
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
  const record = createGrowthMemoryRecord({
    evaluationResult,
    profileUpdateDecision,
    beforeProfile: executionResult.beforeProfile,
    afterProfile: executionResult.afterProfile,
    createdAt: runAt,
    sourceRuntime: 'phase8_2_debug',
    relatedSessionId: options.relatedSessionId || 'session-phase82-debug',
  });

  if (expectedAction && record.action !== expectedAction) {
    throw new Error(`Expected action ${expectedAction}, got ${record.action}.`);
  }

  return record;
}

export function makeImprovingEvidence(
  studentId = defaultStudentId,
  ability = defaultAbility,
): AbilityEvidence[] {
  return [
    makeEvidence('gm-weak-1', studentId, ability, 'weakness', 'diagnosis', 0.72, '缺少文本依据。'),
    makeEvidence('gm-weak-2', studentId, ability, 'weakness', 'training', 0.74, '训练中推理链仍不完整。'),
    makeEvidence('gm-growth-1', studentId, ability, 'growth', 'training', 0.78, '开始使用文本线索说明结论。'),
    makeEvidence('gm-retest-growth-1', studentId, ability, 'growth', 'retest', 0.83, '独立复测中能够使用新文本依据解释结论。'),
  ];
}

export function makeProfile(
  studentId = defaultStudentId,
  ability = defaultAbility,
): StudentAbilityProfile {
  return {
    studentId,
    generatedAt: '2026-07-12T08:00:00.000Z',
    current_weakness: {
      primary: ability,
      secondary: [],
    },
    ability_status: [{
      ability,
      status: 'weak',
      summary: `${ability} 当前仍以薄弱证据为主。`,
      weakness_count: 2,
      positive_count: 0,
      growth_count: 0,
      insufficient_count: 0,
      evidence_links: [{
        evidenceId: 'gm-weak-1',
        ability,
        evidenceType: 'weakness',
        source: 'diagnosis',
        observation: '缺少文本依据。',
        confidence: 0.72,
      }],
    }],
    improvement_signals: [],
    continue_training_focus: `继续围绕${ability}训练。`,
    evidence_links: [{
      evidenceId: 'gm-weak-1',
      ability,
      evidenceType: 'weakness',
      source: 'diagnosis',
      observation: '缺少文本依据。',
      confidence: 0.72,
    }],
    next_step_recommendation: `继续围绕${ability}训练。`,
  };
}

function makeEvidence(
  id: string,
  studentId: string,
  ability: string,
  evidenceType: AbilityEvidence['evidenceType'],
  source: AbilityEvidence['source'],
  confidence: number,
  observation: string,
): AbilityEvidence {
  return normalizeAbilityEvidence({
    id,
    studentId,
    ability,
    evidenceType,
    source,
    detail: observation,
    observation,
    confidence,
    createdAt: defaultRunAt,
  });
}
