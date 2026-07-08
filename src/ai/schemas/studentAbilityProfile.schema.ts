import type { AbilityEvidence, AbilityEvidenceType, AbilityEvidenceSource } from './abilityEvidence.schema.ts';

export type AbilityStatus =
  | 'weak'
  | 'improving'
  | 'stable_positive'
  | 'insufficient_evidence';

export type StudentAbilityProfileEvidenceLink = {
  evidenceId: string;
  ability: string;
  evidenceType: AbilityEvidenceType;
  source: AbilityEvidenceSource;
  observation: string;
  confidence: number;
};

export type AbilityStatusItem = {
  ability: string;
  status: AbilityStatus;
  summary: string;
  weakness_count: number;
  positive_count: number;
  growth_count: number;
  insufficient_count: number;
  evidence_links: StudentAbilityProfileEvidenceLink[];
};

export type StudentCurrentWeakness = {
  primary: string;
  secondary: string[];
};

export type ImprovementSignal = {
  ability: string;
  signal: string;
  from: 'training' | 'retest';
  confidence: number;
  evidence_links: StudentAbilityProfileEvidenceLink[];
};

export type StudentAbilityProfile = {
  studentId: string;
  generatedAt: string;
  current_weakness: StudentCurrentWeakness;
  ability_status: AbilityStatusItem[];
  improvement_signals: ImprovementSignal[];
  continue_training_focus: string;
  evidence_links: StudentAbilityProfileEvidenceLink[];
  next_step_recommendation: string;
};

export function toStudentAbilityProfileEvidenceLink(
  evidence: AbilityEvidence,
): StudentAbilityProfileEvidenceLink {
  return {
    evidenceId: evidence.id,
    ability: evidence.ability,
    evidenceType: evidence.evidenceType,
    source: evidence.source,
    observation: evidence.observation,
    confidence: evidence.confidence,
  };
}

export function isStudentAbilityProfile(value: unknown): value is StudentAbilityProfile {
  if (!value || typeof value !== 'object') return false;

  const profile = value as StudentAbilityProfile;
  return (
    typeof profile.studentId === 'string' &&
    profile.studentId.trim().length > 0 &&
    typeof profile.generatedAt === 'string' &&
    profile.generatedAt.trim().length > 0 &&
    isCurrentWeakness(profile.current_weakness) &&
    Array.isArray(profile.ability_status) &&
    profile.ability_status.length > 0 &&
    profile.ability_status.every(isAbilityStatusItem) &&
    Array.isArray(profile.improvement_signals) &&
    profile.improvement_signals.every(isImprovementSignal) &&
    typeof profile.continue_training_focus === 'string' &&
    profile.continue_training_focus.trim().length > 0 &&
    Array.isArray(profile.evidence_links) &&
    profile.evidence_links.length > 0 &&
    profile.evidence_links.every(isEvidenceLink) &&
    typeof profile.next_step_recommendation === 'string' &&
    profile.next_step_recommendation.trim().length > 0
  );
}

function isCurrentWeakness(value: unknown): value is StudentCurrentWeakness {
  if (!value || typeof value !== 'object') return false;

  const currentWeakness = value as StudentCurrentWeakness;
  return (
    typeof currentWeakness.primary === 'string' &&
    currentWeakness.primary.trim().length > 0 &&
    Array.isArray(currentWeakness.secondary) &&
    currentWeakness.secondary.every((item) => typeof item === 'string')
  );
}

function isAbilityStatusItem(value: unknown): value is AbilityStatusItem {
  if (!value || typeof value !== 'object') return false;

  const item = value as AbilityStatusItem;
  return (
    typeof item.ability === 'string' &&
    item.ability.trim().length > 0 &&
    ['weak', 'improving', 'stable_positive', 'insufficient_evidence'].includes(item.status) &&
    typeof item.summary === 'string' &&
    typeof item.weakness_count === 'number' &&
    typeof item.positive_count === 'number' &&
    typeof item.growth_count === 'number' &&
    typeof item.insufficient_count === 'number' &&
    Array.isArray(item.evidence_links) &&
    item.evidence_links.every(isEvidenceLink)
  );
}

function isImprovementSignal(value: unknown): value is ImprovementSignal {
  if (!value || typeof value !== 'object') return false;

  const signal = value as ImprovementSignal;
  return (
    typeof signal.ability === 'string' &&
    signal.ability.trim().length > 0 &&
    typeof signal.signal === 'string' &&
    signal.signal.trim().length > 0 &&
    (signal.from === 'training' || signal.from === 'retest') &&
    typeof signal.confidence === 'number' &&
    Array.isArray(signal.evidence_links) &&
    signal.evidence_links.every(isEvidenceLink)
  );
}

function isEvidenceLink(value: unknown): value is StudentAbilityProfileEvidenceLink {
  if (!value || typeof value !== 'object') return false;

  const link = value as StudentAbilityProfileEvidenceLink;
  return (
    typeof link.evidenceId === 'string' &&
    link.evidenceId.trim().length > 0 &&
    typeof link.ability === 'string' &&
    link.ability.trim().length > 0 &&
    ['weakness', 'positive', 'growth', 'insufficient'].includes(link.evidenceType) &&
    ['diagnosis', 'training', 'retest'].includes(link.source) &&
    typeof link.observation === 'string' &&
    link.observation.trim().length > 0 &&
    typeof link.confidence === 'number'
  );
}
