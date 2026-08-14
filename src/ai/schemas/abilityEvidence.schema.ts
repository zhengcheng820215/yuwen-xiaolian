export type AbilityEvidenceType =
  | 'weakness'
  | 'positive'
  | 'growth'
  | 'insufficient';

export type AbilityEvidenceSource =
  | 'diagnosis'
  | 'training'
  | 'retest';

export type AbilityEvidenceReason =
  | 'missing_skill'
  | 'incomplete_understanding'
  | 'reasoning_error'
  | 'expression_issue'
  | 'knowledge_gap'
  | 'unstable_performance';

export type AbilityEvidence = {
  id: string;
  studentId: string;
  ability: string;
  evidenceType: AbilityEvidenceType;
  reason?: AbilityEvidenceReason;
  detail: string;
  source: AbilityEvidenceSource;
  observation: string;
  rootCause?: string;
  confidence: number;
  supportLevel?: 'independent' | 'feedback_supported';
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

export const ABILITY_EVIDENCE_REASONS: AbilityEvidenceReason[] = [
  'missing_skill',
  'incomplete_understanding',
  'reasoning_error',
  'expression_issue',
  'knowledge_gap',
  'unstable_performance',
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
  const explicitReason = ABILITY_EVIDENCE_REASONS.includes(value.reason as AbilityEvidenceReason)
    ? value.reason as AbilityEvidenceReason
    : undefined;
  const detail = value.detail || value.observation || value.rootCause || '本次记录缺少可消费的证据详情。';
  const observation = value.observation || value.detail || '本次记录缺少可消费的观察表现。';
  const reason = explicitReason || inferEvidenceReason({
    ability,
    evidenceType,
    detail,
    observation,
    rootCause: value.rootCause,
  });

  return {
    id: value.id || buildEvidenceId(value.studentId || 'demo-student', ability, source, createdAt),
    studentId: value.studentId || 'demo-student',
    ability,
    evidenceType,
    reason,
    detail,
    source,
    observation,
    rootCause: value.rootCause,
    confidence,
    supportLevel: value.supportLevel,
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
    (
      evidence.reason === undefined ||
      ABILITY_EVIDENCE_REASONS.includes(evidence.reason)
    ) &&
    typeof evidence.detail === 'string' &&
    evidence.detail.trim().length > 0 &&
    ABILITY_EVIDENCE_SOURCES.includes(evidence.source) &&
    typeof evidence.observation === 'string' &&
    evidence.observation.trim().length > 0 &&
    typeof evidence.confidence === 'number' &&
    !Number.isNaN(evidence.confidence) &&
    evidence.confidence >= 0 &&
    evidence.confidence <= 1 &&
    (evidence.supportLevel === undefined || ['independent', 'feedback_supported'].includes(evidence.supportLevel)) &&
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

function inferEvidenceReason(input: {
  ability: string;
  evidenceType: AbilityEvidenceType;
  detail: string;
  observation: string;
  rootCause?: string;
}): AbilityEvidenceReason | undefined {
  if (input.evidenceType !== 'weakness') return undefined;

  if (input.ability === '信息提取') return 'missing_skill';
  if (input.ability === '理解') return 'incomplete_understanding';
  if (input.ability === '推理') return 'reasoning_error';
  if (input.ability === '表达') return 'expression_issue';

  const text = [
    input.ability,
    input.detail,
    input.observation,
    input.rootCause,
  ].filter(Boolean).join('\n');

  if (/修辞|说明方法|表现手法|写作手法|知识/.test(text)) return 'knowledge_gap';
  if (/表达|完整|观点|依据|说明|组织|结构/.test(text)) return 'expression_issue';
  if (/推理|推断|结论|推理链/.test(text)) return 'reasoning_error';
  if (/理解|含义|表层|深层|语境|情感|主题/.test(text)) return 'incomplete_understanding';
  if (/信息|提取|定位|关键词|限定|文本依据|线索/.test(text)) return 'missing_skill';
  if (/不稳定|波动|偶然|时好时坏/.test(text)) return 'unstable_performance';

  return 'unstable_performance';
}
