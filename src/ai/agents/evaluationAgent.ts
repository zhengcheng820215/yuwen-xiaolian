import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type {
  EvaluationConflictStatus,
  EvaluationNextAction,
  EvaluationResult,
  EvidenceSufficiency,
  GrowthLevel,
} from '../schemas/evaluationResult.schema.ts';

export type EvidenceEvaluationInput = {
  studentId: string;
  targetAbility: string;
  evidence: AbilityEvidence[];
  evaluatedAt?: string;
};

export function evaluateAbilityEvidence(
  input: EvidenceEvaluationInput,
): EvaluationResult {
  const targetEvidence = input.evidence.filter((item) => item.ability === input.targetAbility);
  const weaknessEvidence = targetEvidence.filter((item) => item.evidenceType === 'weakness');
  const positiveEvidence = targetEvidence.filter((item) => item.evidenceType === 'positive');
  const growthEvidence = targetEvidence.filter((item) => item.evidenceType === 'growth');
  const insufficientEvidence = targetEvidence.filter((item) => item.evidenceType === 'insufficient');
  const validEvidenceCount = weaknessEvidence.length + positiveEvidence.length + growthEvidence.length;
  const hasIndependentRetestEvidence = targetEvidence.some((item) => (
    item.source === 'retest' &&
    (item.evidenceType === 'positive' || item.evidenceType === 'growth')
  ));
  const hasTransferEvidence = targetEvidence.some((item) => (
    item.source === 'retest' &&
    /迁移|新文本|新情境|独立/.test(`${item.detail}\n${item.observation}`)
  ));
  const evidenceSufficiency = inferEvidenceSufficiency(validEvidenceCount, insufficientEvidence.length);
  const conflictStatus = inferConflictStatus({
    weaknessCount: weaknessEvidence.length,
    positiveCount: positiveEvidence.length,
    growthCount: growthEvidence.length,
  });
  const growthLevel = inferGrowthLevel({
    evidenceSufficiency,
    conflictStatus,
    weaknessCount: weaknessEvidence.length,
    positiveCount: positiveEvidence.length,
    growthCount: growthEvidence.length,
    hasIndependentRetestEvidence,
  });
  const nextAction = inferNextAction({
    evidenceSufficiency,
    growthLevel,
    conflictStatus,
    weaknessCount: weaknessEvidence.length,
    hasIndependentRetestEvidence,
  });
  const confidence = calculateConfidence({
    targetEvidence,
    validEvidenceCount,
    evidenceSufficiency,
    growthLevel,
    conflictStatus,
    hasIndependentRetestEvidence,
  });
  const limitations = buildLimitations({
    targetEvidenceCount: targetEvidence.length,
    validEvidenceCount,
    evidenceSufficiency,
    growthLevel,
    conflictStatus,
    hasIndependentRetestEvidence,
  });

  return {
    evaluationId: buildEvaluationId(input.studentId, input.targetAbility, input.evaluatedAt),
    studentId: input.studentId,
    abilityId: input.targetAbility,
    abilityLabel: input.targetAbility,
    evidenceSufficiency,
    growthLevel,
    weaknessEvidenceCount: weaknessEvidence.length,
    positiveEvidenceCount: positiveEvidence.length,
    growthEvidenceCount: growthEvidence.length,
    insufficientEvidenceCount: insufficientEvidence.length,
    hasIndependentRetestEvidence,
    hasTransferEvidence,
    conflictStatus,
    confidence,
    summary: buildSummary({
      ability: input.targetAbility,
      evidenceSufficiency,
      growthLevel,
      weaknessCount: weaknessEvidence.length,
      positiveCount: positiveEvidence.length,
      growthCount: growthEvidence.length,
      insufficientCount: insufficientEvidence.length,
      conflictStatus,
    }),
    limitations,
    nextAction,
    evidenceLinks: targetEvidence.map((item) => item.id),
    createdAt: input.evaluatedAt || new Date().toISOString(),
  };
}

function inferEvidenceSufficiency(
  validEvidenceCount: number,
  insufficientCount: number,
): EvidenceSufficiency {
  if (validEvidenceCount === 0) return 'insufficient';
  if (validEvidenceCount < 3 || insufficientCount > validEvidenceCount) return 'limited';
  return 'sufficient';
}

function inferConflictStatus(input: {
  weaknessCount: number;
  positiveCount: number;
  growthCount: number;
}): EvaluationConflictStatus {
  if (input.weaknessCount >= 2 && input.positiveCount >= 2) return 'significant';
  if (input.weaknessCount > 0 && input.positiveCount > 0) return 'minor';
  if (input.weaknessCount > 0 && input.growthCount > 0) return 'minor';
  return 'none';
}

function inferGrowthLevel(input: {
  evidenceSufficiency: EvidenceSufficiency;
  conflictStatus: EvaluationConflictStatus;
  weaknessCount: number;
  positiveCount: number;
  growthCount: number;
  hasIndependentRetestEvidence: boolean;
}): GrowthLevel {
  if (input.evidenceSufficiency === 'insufficient') return 'unconfirmed';
  if (input.conflictStatus === 'significant') return 'fluctuating';
  if (input.weaknessCount > 0 && input.growthCount > 0 && input.hasIndependentRetestEvidence) return 'improving';
  if (input.weaknessCount > 0 && input.growthCount > 0) return 'early_signal';
  if (input.weaknessCount === 0 && input.growthCount + input.positiveCount >= 3 && input.hasIndependentRetestEvidence) return 'improving';
  if (input.positiveCount > 0 || input.growthCount > 0) return 'early_signal';
  return 'unconfirmed';
}

function inferNextAction(input: {
  evidenceSufficiency: EvidenceSufficiency;
  growthLevel: GrowthLevel;
  conflictStatus: EvaluationConflictStatus;
  weaknessCount: number;
  hasIndependentRetestEvidence: boolean;
}): EvaluationNextAction {
  if (input.evidenceSufficiency === 'insufficient') return 'collect_more_evidence';
  if (input.conflictStatus === 'significant') return 'human_review';
  if (input.growthLevel === 'fluctuating') return 'independent_retest';
  if (input.growthLevel === 'early_signal') return 'independent_retest';
  if (input.growthLevel === 'improving' && !input.hasIndependentRetestEvidence) return 'independent_retest';
  if (input.growthLevel === 'improving') return 'transfer_test';
  if (input.weaknessCount > 0) return 'continue_training';
  return 'collect_more_evidence';
}

function calculateConfidence(input: {
  targetEvidence: AbilityEvidence[];
  validEvidenceCount: number;
  evidenceSufficiency: EvidenceSufficiency;
  growthLevel: GrowthLevel;
  conflictStatus: EvaluationConflictStatus;
  hasIndependentRetestEvidence: boolean;
}): number {
  if (input.targetEvidence.length === 0) return 0.25;

  const averageEvidenceConfidence = input.targetEvidence.reduce((sum, item) => sum + item.confidence, 0) / input.targetEvidence.length;
  const sufficiencyAdjustment = input.evidenceSufficiency === 'sufficient' ? 0.08 : input.evidenceSufficiency === 'limited' ? -0.02 : -0.18;
  const retestAdjustment = input.hasIndependentRetestEvidence ? 0.08 : 0;
  const conflictAdjustment = input.conflictStatus === 'significant' ? -0.18 : input.conflictStatus === 'minor' ? -0.08 : 0;
  const growthAdjustment = input.growthLevel === 'stable' ? 0.05 : 0;

  return round(clamp(averageEvidenceConfidence + sufficiencyAdjustment + retestAdjustment + conflictAdjustment + growthAdjustment));
}

function buildLimitations(input: {
  targetEvidenceCount: number;
  validEvidenceCount: number;
  evidenceSufficiency: EvidenceSufficiency;
  growthLevel: GrowthLevel;
  conflictStatus: EvaluationConflictStatus;
  hasIndependentRetestEvidence: boolean;
}): string[] {
  const limitations: string[] = [];

  if (input.targetEvidenceCount === 0) limitations.push('当前能力没有可评估证据。');
  if (input.evidenceSufficiency !== 'sufficient') limitations.push('当前有效证据数量仍有限。');
  if (!input.hasIndependentRetestEvidence) limitations.push('当前缺少独立复测或迁移证据。');
  if (input.conflictStatus !== 'none') limitations.push('当前同一能力存在正反证据冲突。');
  if (input.growthLevel === 'early_signal') limitations.push('当前只能说明出现早期改善迹象，不能宣布长期提升。');
  if (limitations.length === 0) limitations.push('当前评估仍需后续 Session 验证稳定性。');

  return limitations;
}

function buildSummary(input: {
  ability: string;
  evidenceSufficiency: EvidenceSufficiency;
  growthLevel: GrowthLevel;
  weaknessCount: number;
  positiveCount: number;
  growthCount: number;
  insufficientCount: number;
  conflictStatus: EvaluationConflictStatus;
}): string {
  return `${input.ability} 当前证据评估为 ${input.evidenceSufficiency}，成长层级为 ${input.growthLevel}。证据统计：weakness=${input.weaknessCount}, positive=${input.positiveCount}, growth=${input.growthCount}, insufficient=${input.insufficientCount}，冲突状态=${input.conflictStatus}。`;
}

function buildEvaluationId(
  studentId: string,
  ability: string,
  evaluatedAt?: string,
): string {
  const timestamp = (evaluatedAt || new Date().toISOString()).replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  const safeAbility = ability.replace(/\s+/g, '');
  return `evaluation-${studentId}-${safeAbility}-${timestamp}`;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
