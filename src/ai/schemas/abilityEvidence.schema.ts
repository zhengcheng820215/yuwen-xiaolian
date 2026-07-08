export type AbilityEvidenceType =
  | 'weakness'
  | 'positive'
  | 'growth'
  | 'insufficient';

export type AbilityEvidenceSource =
  | 'diagnosis'
  | 'training'
  | 'retest';

export type AbilityEvidence = {
  id: string;
  studentId: string;
  ability: string;
  evidenceType: AbilityEvidenceType;
  source: AbilityEvidenceSource;
  observation: string;
  rootCause?: string;
  confidence: number;
  createdAt: string;
  taskId?: string;
  diagnosisId?: string;
};

export const ABILITY_EVIDENCE_TYPES: AbilityEvidenceType[] = [
  'weakness',
  'positive',
  'growth',
  'insufficient',
];

export const ABILITY_EVIDENCE_SOURCES: AbilityEvidenceSource[] = [
  'diagnosis',
  'training',
  'retest',
];

export function normalizeAbilityEvidence(value: Partial<AbilityEvidence>): AbilityEvidence {
  const confidence = typeof value.confidence === 'number'
    ? Math.min(1, Math.max(0, value.confidence))
    : 0.5;
  const createdAt = value.createdAt || new Date().toISOString();
  const ability = value.ability || '待诊断';
  const evidenceType = ABILITY_EVIDENCE_TYPES.includes(value.evidenceType as AbilityEvidenceType)
    ? value.evidenceType as AbilityEvidenceType
    : 'insufficient';
  const source = ABILITY_EVIDENCE_SOURCES.includes(value.source as AbilityEvidenceSource)
    ? value.source as AbilityEvidenceSource
    : 'diagnosis';

  return {
    id: value.id || buildEvidenceId(value.studentId || 'demo-student', ability, source, createdAt),
    studentId: value.studentId || 'demo-student',
    ability,
    evidenceType,
    source,
    observation: value.observation || '本次记录缺少可消费的观察表现。',
    rootCause: value.rootCause,
    confidence,
    createdAt,
    taskId: value.taskId,
    diagnosisId: value.diagnosisId,
  };
}

export function isAbilityEvidence(value: unknown): value is AbilityEvidence {
  if (!value || typeof value !== 'object') return false;

  const evidence = value as AbilityEvidence;
  return (
    typeof evidence.id === 'string' &&
    evidence.id.trim().length > 0 &&
    typeof evidence.studentId === 'string' &&
    evidence.studentId.trim().length > 0 &&
    typeof evidence.ability === 'string' &&
    evidence.ability.trim().length > 0 &&
    ABILITY_EVIDENCE_TYPES.includes(evidence.evidenceType) &&
    ABILITY_EVIDENCE_SOURCES.includes(evidence.source) &&
    typeof evidence.observation === 'string' &&
    evidence.observation.trim().length > 0 &&
    typeof evidence.confidence === 'number' &&
    !Number.isNaN(evidence.confidence) &&
    evidence.confidence >= 0 &&
    evidence.confidence <= 1 &&
    typeof evidence.createdAt === 'string' &&
    evidence.createdAt.trim().length > 0
  );
}

function buildEvidenceId(
  studentId: string,
  ability: string,
  source: AbilityEvidenceSource,
  createdAt: string,
): string {
  const safeCreatedAt = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  const safeAbility = ability.replace(/\s+/g, '');
  return `${studentId}-${source}-${safeAbility}-${safeCreatedAt}`;
}
