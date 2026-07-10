import {
  type AbilityEvidence,
  isAbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import {
  type AbilityChangeEvaluation,
  type AbilityChangeEvidenceSummary,
  type AbilityChangeNextDecision,
  type AbilityChangeStatus,
} from '../schemas/abilityChangeEvaluation.schema.ts';

export type AbilityChangeEvaluationInput = {
  studentId: string;
  targetAbility: string;
  beforeEvidence: AbilityEvidence[];
  trainingEvidence?: AbilityEvidence[];
  taskExecutionEvidence?: AbilityEvidence[];
  retestEvidence?: AbilityEvidence[];
  updatedEvidence?: AbilityEvidence[];
  studentAbilityProfile?: StudentAbilityProfile;
  evaluatedAt?: string;
};

export function evaluateAbilityChange(
  input: AbilityChangeEvaluationInput,
): AbilityChangeEvaluation {
  const issues = validateInput(input);
  const targetAbility = input.targetAbility || '待评估能力';
  const beforeEvidence = filterTargetEvidence(input.beforeEvidence || [], targetAbility);
  const trainingEvidence = filterTargetEvidence([
    ...(input.trainingEvidence || []),
    ...(input.taskExecutionEvidence || []),
  ], targetAbility);
  const retestEvidence = filterTargetEvidence(input.retestEvidence || [], targetAbility);
  const beforeSummary = summarizeChangeEvidence(beforeEvidence);
  const trainingSummary = summarizeChangeEvidence(trainingEvidence);
  const retestSummary = summarizeChangeEvidence(retestEvidence);
  const decision = decideChangeStatus({
    beforeSummary,
    trainingSummary,
    retestSummary,
    studentAbilityProfile: input.studentAbilityProfile,
    targetAbility,
  });
  const evidenceBasis = buildEvidenceBasis({
    beforeSummary,
    trainingSummary,
    retestSummary,
    changeStatus: decision.changeStatus,
  });
  const confidence = calculateConfidence({
    beforeEvidence,
    trainingEvidence,
    retestEvidence,
    changeStatus: decision.changeStatus,
    validationPassed: issues.length === 0,
  });

  return {
    evaluation_id: buildEvaluationId(input.studentId || 'unknown-student', targetAbility, input.evaluatedAt),
    student_id: input.studentId || 'unknown-student',
    target_ability: targetAbility,
    before_summary: beforeSummary,
    training_summary: trainingSummary,
    retest_summary: retestSummary,
    change_status: decision.changeStatus,
    change_reason: buildChangeReason(decision.changeStatus, evidenceBasis),
    evidence_basis: evidenceBasis,
    confidence,
    next_decision: decision.nextDecision,
    next_decision_reason: decision.nextDecisionReason,
    validation: {
      passed: issues.length === 0,
      issues,
    },
  };
}

function validateInput(input: AbilityChangeEvaluationInput): string[] {
  const issues: string[] = [];

  if (!input.studentId?.trim()) issues.push('studentId is required.');
  if (!input.targetAbility?.trim()) issues.push('targetAbility is required.');

  const evidenceGroups = [
    ...(input.beforeEvidence || []),
    ...(input.trainingEvidence || []),
    ...(input.taskExecutionEvidence || []),
    ...(input.retestEvidence || []),
  ];

  if (evidenceGroups.length === 0) {
    issues.push('At least one AbilityEvidence item is required.');
  }

  for (const evidence of evidenceGroups) {
    if (!isAbilityEvidence(evidence)) {
      issues.push(`Invalid AbilityEvidence item found: ${(evidence as AbilityEvidence | undefined)?.id || 'unknown-id'}.`);
    }
  }

  return issues;
}

function filterTargetEvidence(
  evidenceList: AbilityEvidence[],
  targetAbility: string,
): AbilityEvidence[] {
  return evidenceList.filter((evidence) => evidence.ability === targetAbility);
}

function summarizeChangeEvidence(
  evidenceList: AbilityEvidence[],
): AbilityChangeEvidenceSummary {
  return {
    weakness_count: evidenceList.filter((item) => item.evidenceType === 'weakness').length,
    growth_count: evidenceList.filter((item) => item.evidenceType === 'growth').length,
    positive_count: evidenceList.filter((item) => item.evidenceType === 'positive').length,
    insufficient_count: evidenceList.filter((item) => item.evidenceType === 'insufficient').length,
    evidence_ids: evidenceList.map((item) => item.id),
    key_observations: unique(evidenceList.flatMap((item) => [
      item.observation,
      item.rootCause,
    ].filter(Boolean) as string[])).slice(0, 5),
  };
}

function decideChangeStatus(input: {
  beforeSummary: AbilityChangeEvidenceSummary;
  trainingSummary: AbilityChangeEvidenceSummary;
  retestSummary: AbilityChangeEvidenceSummary;
  studentAbilityProfile?: StudentAbilityProfile;
  targetAbility: string;
}): {
  changeStatus: AbilityChangeStatus;
  nextDecision: AbilityChangeNextDecision;
  nextDecisionReason: string;
} {
  const beforeHasWeakness = input.beforeSummary.weakness_count > 0;
  const trainingHasGrowthOrPositive = hasGrowthOrPositive(input.trainingSummary);
  const trainingHasWeakness = input.trainingSummary.weakness_count > 0;
  const retestHasGrowthOrPositive = hasGrowthOrPositive(input.retestSummary);
  const retestHasWeakness = input.retestSummary.weakness_count > 0;
  const retestMissing = input.retestSummary.evidence_ids.length === 0;
  const retestOnlyInsufficient = (
    input.retestSummary.insufficient_count > 0 &&
    input.retestSummary.weakness_count === 0 &&
    input.retestSummary.growth_count === 0 &&
    input.retestSummary.positive_count === 0
  );

  if (isReadyToSwitchAbility(input)) {
    return {
      changeStatus: 'ready_to_switch_ability',
      nextDecision: 'switch_ability',
      nextDecisionReason: '目标能力已经出现训练与复测正向证据，且画像中其他能力薄弱更突出，可以切换能力焦点。',
    };
  }

  if (trainingHasGrowthOrPositive && retestHasWeakness) {
    return {
      changeStatus: 'not_transferred',
      nextDecision: 'continue_training',
      nextDecisionReason: '训练阶段出现改善，但复测仍产生 weakness evidence，说明改善尚未迁移到新情境。',
    };
  }

  if (beforeHasWeakness && trainingHasGrowthOrPositive && retestHasGrowthOrPositive) {
    return {
      changeStatus: 'likely_improved',
      nextDecision: 'retest_again',
      nextDecisionReason: '训练和复测均出现 growth / positive evidence，但仍需再次复测验证稳定性。',
    };
  }

  if (beforeHasWeakness && trainingHasWeakness && retestHasWeakness) {
    return {
      changeStatus: 'still_weak',
      nextDecision: 'continue_training',
      nextDecisionReason: '训练前、训练中和复测后持续出现 weakness evidence，需要继续围绕同一能力训练。',
    };
  }

  if (retestMissing || retestOnlyInsufficient) {
    return {
      changeStatus: 'needs_more_evidence',
      nextDecision: 'collect_more_evidence',
      nextDecisionReason: '复测证据缺失或证据不足，暂不能判断能力是否发生变化。',
    };
  }

  if (retestHasGrowthOrPositive) {
    return {
      changeStatus: 'likely_improved',
      nextDecision: 'retest_again',
      nextDecisionReason: '复测出现 growth / positive evidence，但仍需继续验证改善是否稳定。',
    };
  }

  if (retestHasWeakness) {
    return {
      changeStatus: 'still_weak',
      nextDecision: 'continue_training',
      nextDecisionReason: '复测仍出现 weakness evidence，当前目标能力仍需继续训练。',
    };
  }

  return {
    changeStatus: 'needs_more_evidence',
    nextDecision: 'collect_more_evidence',
    nextDecisionReason: '现有证据方向不足以形成能力变化判断，需要继续收集证据。',
  };
}

function isReadyToSwitchAbility(input: {
  beforeSummary: AbilityChangeEvidenceSummary;
  trainingSummary: AbilityChangeEvidenceSummary;
  retestSummary: AbilityChangeEvidenceSummary;
  studentAbilityProfile?: StudentAbilityProfile;
  targetAbility: string;
}): boolean {
  const hasTargetImprovement = (
    hasGrowthOrPositive(input.trainingSummary) &&
    input.retestSummary.positive_count > 0
  );
  const primaryWeakness = input.studentAbilityProfile?.current_weakness.primary;
  const otherAbilityIsPrimaryWeakness = Boolean(primaryWeakness && primaryWeakness !== input.targetAbility);

  return hasTargetImprovement && otherAbilityIsPrimaryWeakness;
}

function hasGrowthOrPositive(summary: AbilityChangeEvidenceSummary): boolean {
  return summary.growth_count + summary.positive_count > 0;
}

function buildEvidenceBasis(input: {
  beforeSummary: AbilityChangeEvidenceSummary;
  trainingSummary: AbilityChangeEvidenceSummary;
  retestSummary: AbilityChangeEvidenceSummary;
  changeStatus: AbilityChangeStatus;
}): string[] {
  const basis = [
    `before: weakness=${input.beforeSummary.weakness_count}, growth=${input.beforeSummary.growth_count}, positive=${input.beforeSummary.positive_count}, insufficient=${input.beforeSummary.insufficient_count}`,
    `training: weakness=${input.trainingSummary.weakness_count}, growth=${input.trainingSummary.growth_count}, positive=${input.trainingSummary.positive_count}, insufficient=${input.trainingSummary.insufficient_count}`,
    `retest: weakness=${input.retestSummary.weakness_count}, growth=${input.retestSummary.growth_count}, positive=${input.retestSummary.positive_count}, insufficient=${input.retestSummary.insufficient_count}`,
    `change_status=${input.changeStatus}`,
  ];

  const observations = unique([
    ...input.beforeSummary.key_observations,
    ...input.trainingSummary.key_observations,
    ...input.retestSummary.key_observations,
  ]).slice(0, 3);

  return [...basis, ...observations.map((observation) => `observation: ${observation}`)];
}

function buildChangeReason(
  changeStatus: AbilityChangeStatus,
  evidenceBasis: string[],
): string {
  const basisText = evidenceBasis.slice(0, 3).join('；');

  const labels: Record<AbilityChangeStatus, string> = {
    likely_improved: '训练与复测证据均出现改善信号，当前可判断为可能改善。',
    not_transferred: '训练中出现改善，但复测仍暴露薄弱，说明能力尚未完成迁移。',
    still_weak: '训练前、训练中和复测后仍持续出现薄弱证据。',
    needs_more_evidence: '当前复测证据缺失、证据不足或方向不稳定，暂不能判断能力变化。',
    ready_to_switch_ability: '目标能力已有训练和复测正向证据，且其他能力成为更突出薄弱点。',
  };

  return `${labels[changeStatus]} 依据：${basisText}`;
}

function calculateConfidence(input: {
  beforeEvidence: AbilityEvidence[];
  trainingEvidence: AbilityEvidence[];
  retestEvidence: AbilityEvidence[];
  changeStatus: AbilityChangeStatus;
  validationPassed: boolean;
}): number {
  if (!input.validationPassed) return 0.35;

  const allEvidence = [
    ...input.beforeEvidence,
    ...input.trainingEvidence,
    ...input.retestEvidence,
  ];
  const averageConfidence = allEvidence.length > 0
    ? allEvidence.reduce((sum, item) => sum + item.confidence, 0) / allEvidence.length
    : 0.45;
  const retestBonus = input.retestEvidence.length > 0 ? 0.08 : -0.12;
  const statusAdjustment = input.changeStatus === 'needs_more_evidence' ? -0.12 : 0;

  return clamp(round(averageConfidence + retestBonus + statusAdjustment));
}

function buildEvaluationId(
  studentId: string,
  targetAbility: string,
  evaluatedAt?: string,
): string {
  const timestamp = (evaluatedAt || new Date().toISOString()).replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  const safeAbility = targetAbility.replace(/\s+/g, '');
  return `ability-change-${studentId}-${safeAbility}-${timestamp}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
