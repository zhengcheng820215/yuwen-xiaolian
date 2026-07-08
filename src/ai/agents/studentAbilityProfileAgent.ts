import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import {
  toStudentAbilityProfileEvidenceLink,
  type AbilityStatus,
  type AbilityStatusItem,
  type ImprovementSignal,
  type StudentAbilityProfile,
  type StudentAbilityProfileEvidenceLink,
} from '../schemas/studentAbilityProfile.schema.ts';
import type {
  AbilityEvidenceSummary,
  WeaknessRankingItem,
} from './weaknessRankingAgent.ts';

export type StudentAbilityProfileInput = {
  studentId: string;
  evidenceSummary: AbilityEvidenceSummary[];
  topWeakness: WeaknessRankingItem[];
  evidence: AbilityEvidence[];
  trainingEvidence?: AbilityEvidence;
  retestEvidence?: AbilityEvidence;
  generatedAt?: string;
};

export function generateStudentAbilityProfile(
  input: StudentAbilityProfileInput,
): StudentAbilityProfile {
  const primaryWeakness = input.topWeakness[0]?.ability || inferPrimaryWeakness(input.evidenceSummary);
  const secondaryWeakness = input.topWeakness
    .slice(1)
    .map((item) => item.ability);
  const abilityStatus = input.evidenceSummary.map((summary) => buildAbilityStatus(summary, input.evidence));
  const improvementSignals = buildImprovementSignals(input.trainingEvidence, input.retestEvidence);
  const evidenceLinks = buildEvidenceLinks(input.evidence, primaryWeakness, secondaryWeakness);

  return {
    studentId: input.studentId,
    generatedAt: input.generatedAt || new Date().toISOString(),
    current_weakness: {
      primary: primaryWeakness,
      secondary: secondaryWeakness,
    },
    ability_status: abilityStatus,
    improvement_signals: improvementSignals,
    continue_training_focus: buildContinueTrainingFocus(primaryWeakness, input.topWeakness, abilityStatus),
    evidence_links: evidenceLinks,
    next_step_recommendation: buildNextStepRecommendation(primaryWeakness, abilityStatus, improvementSignals),
  };
}

function buildAbilityStatus(
  summary: AbilityEvidenceSummary,
  evidence: AbilityEvidence[],
): AbilityStatusItem {
  const status = inferAbilityStatus(summary);
  const evidenceLinks = evidence
    .filter((item) => item.ability === summary.ability)
    .map(toStudentAbilityProfileEvidenceLink);

  return {
    ability: summary.ability,
    status,
    summary: buildStatusSummary(summary, status),
    weakness_count: summary.weaknessCount,
    positive_count: summary.positiveCount,
    growth_count: summary.growthCount,
    insufficient_count: summary.insufficientCount,
    evidence_links: evidenceLinks,
  };
}

function inferAbilityStatus(summary: AbilityEvidenceSummary): AbilityStatus {
  if (
    summary.insufficientCount > 0 &&
    summary.weaknessCount === 0 &&
    summary.positiveCount === 0 &&
    summary.growthCount === 0
  ) {
    return 'insufficient_evidence';
  }

  if (summary.weaknessCount > 0 && summary.growthCount > 0) return 'improving';
  if (summary.weaknessCount > 0) return 'weak';
  if (summary.positiveCount > 0 || summary.growthCount > 0) return 'stable_positive';

  return 'insufficient_evidence';
}

function buildStatusSummary(summary: AbilityEvidenceSummary, status: AbilityStatus): string {
  if (status === 'improving') {
    return `${summary.ability} 仍有薄弱证据，但已经出现成长证据，需要继续巩固。`;
  }

  if (status === 'weak') {
    return `${summary.ability} 当前主要表现为薄弱证据，仍需优先训练。`;
  }

  if (status === 'stable_positive') {
    return `${summary.ability} 当前以正向或成长证据为主，可作为相对稳定能力。`;
  }

  return `${summary.ability} 当前有效证据不足，暂不判断具体能力状态。`;
}

function buildImprovementSignals(
  trainingEvidence?: AbilityEvidence,
  retestEvidence?: AbilityEvidence,
): ImprovementSignal[] {
  return [trainingEvidence, retestEvidence]
    .filter((item): item is AbilityEvidence => Boolean(item))
    .filter((item) => item.evidenceType === 'growth' || item.source === 'retest')
    .map((item) => ({
      ability: item.ability,
      signal: buildImprovementSignalText(item),
      from: item.source === 'retest' ? 'retest' : 'training',
      confidence: item.confidence,
      evidence_links: [toStudentAbilityProfileEvidenceLink(item)],
    }));
}

function buildImprovementSignalText(evidence: AbilityEvidence): string {
  if (evidence.source === 'retest' && evidence.evidenceType === 'growth') {
    return `${evidence.ability} 在复测中出现改善迹象：${evidence.observation}`;
  }

  if (evidence.source === 'training' && evidence.evidenceType === 'growth') {
    return `${evidence.ability} 在训练过程中出现改善迹象：${evidence.observation}`;
  }

  return `${evidence.ability} 有新的训练或复测证据，需要继续观察：${evidence.observation}`;
}

function buildEvidenceLinks(
  evidence: AbilityEvidence[],
  primaryWeakness: string,
  secondaryWeakness: string[],
): StudentAbilityProfileEvidenceLink[] {
  const priorityAbilities = new Set([primaryWeakness, ...secondaryWeakness].filter(Boolean));
  const linked = evidence
    .filter((item) => priorityAbilities.has(item.ability) || item.source === 'training' || item.source === 'retest')
    .map(toStudentAbilityProfileEvidenceLink);

  return uniqueEvidenceLinks(linked);
}

function buildContinueTrainingFocus(
  primaryWeakness: string,
  topWeakness: WeaknessRankingItem[],
  abilityStatus: AbilityStatusItem[],
): string {
  const primaryRanking = topWeakness.find((item) => item.ability === primaryWeakness);
  const primaryStatus = abilityStatus.find((item) => item.ability === primaryWeakness);
  const suggestedFocus = primaryRanking?.suggestedTrainingFocus || `${primaryWeakness} 针对性训练`;

  if (primaryStatus?.status === 'improving') {
    return `继续围绕「${primaryWeakness}」巩固训练，重点是：${suggestedFocus}。`;
  }

  if (primaryStatus?.status === 'weak') {
    return `优先训练「${primaryWeakness}」，重点是：${suggestedFocus}。`;
  }

  return `继续观察「${primaryWeakness}」，必要时安排短周期复测。`;
}

function buildNextStepRecommendation(
  primaryWeakness: string,
  abilityStatus: AbilityStatusItem[],
  improvementSignals: ImprovementSignal[],
): string {
  const primaryStatus = abilityStatus.find((item) => item.ability === primaryWeakness);
  const hasRetestGrowth = improvementSignals.some((item) => item.ability === primaryWeakness && item.from === 'retest');

  if (primaryStatus?.status === 'improving' && hasRetestGrowth) {
    return `下一步建议继续进行「${primaryWeakness}」Day 2 训练，并用同类不同题复测稳定性。`;
  }

  if (primaryStatus?.status === 'weak') {
    return `下一步建议先完成「${primaryWeakness}」的 3 天阶段训练计划，再进行复测。`;
  }

  if (primaryStatus?.status === 'stable_positive') {
    return `下一步建议降低「${primaryWeakness}」优先级，转向次级薄弱能力。`;
  }

  return `下一步建议先补充「${primaryWeakness}」的有效作答证据，再判断训练方向。`;
}

function inferPrimaryWeakness(evidenceSummary: AbilityEvidenceSummary[]): string {
  const sorted = [...evidenceSummary].sort((left, right) => right.weaknessCount - left.weaknessCount);
  return sorted[0]?.ability || '待观察能力';
}

function uniqueEvidenceLinks(
  evidenceLinks: StudentAbilityProfileEvidenceLink[],
): StudentAbilityProfileEvidenceLink[] {
  const seen = new Set<string>();
  const result: StudentAbilityProfileEvidenceLink[] = [];

  for (const link of evidenceLinks) {
    if (seen.has(link.evidenceId)) continue;
    seen.add(link.evidenceId);
    result.push(link);
  }

  return result;
}
