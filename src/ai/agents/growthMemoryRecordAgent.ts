import type { EvaluationResult } from '../schemas/evaluationResult.schema.ts';
import type { ProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type {
  AbilityProfileSnapshot,
  GrowthMemoryRecord,
} from '../schemas/growthMemory.schema.ts';

export type GrowthMemoryRecordInput = {
  evaluationResult: EvaluationResult;
  profileUpdateDecision: ProfileUpdateDecision;
  beforeProfile: StudentAbilityProfile;
  afterProfile: StudentAbilityProfile;
  createdAt?: string;
  sourceRuntime?: string;
  relatedSessionId?: string;
};

export function createGrowthMemoryRecord(
  input: GrowthMemoryRecordInput,
): GrowthMemoryRecord {
  const createdAt = input.createdAt || new Date().toISOString();
  const abilityId = input.profileUpdateDecision.abilityId;
  const abilityLabel = input.profileUpdateDecision.abilityLabel || input.evaluationResult.abilityLabel;

  return {
    recordId: buildRecordId(input.profileUpdateDecision.studentId, abilityId, input.profileUpdateDecision.decisionId, createdAt),
    studentId: input.profileUpdateDecision.studentId,
    abilityId,
    abilityLabel,
    createdAt,
    evaluationResultId: input.evaluationResult.evaluationId,
    profileUpdateDecisionId: input.profileUpdateDecision.decisionId,
    evidenceLinks: unique([
      ...input.evaluationResult.evidenceLinks,
      ...input.profileUpdateDecision.evidenceLinks,
    ]),
    action: input.profileUpdateDecision.action,
    beforeProfileSummary: buildAbilitySnapshot(input.beforeProfile, abilityId, abilityLabel),
    afterProfileSummary: buildAbilitySnapshot(input.afterProfile, abilityId, abilityLabel),
    reason: input.profileUpdateDecision.reason,
    limitations: unique([
      ...input.evaluationResult.limitations,
      ...input.profileUpdateDecision.warnings,
    ]),
    nextAction: buildNextAction(input),
    sourceRuntime: input.sourceRuntime,
    relatedSessionId: input.relatedSessionId,
  };
}

function buildAbilitySnapshot(
  profile: StudentAbilityProfile,
  abilityId: string,
  abilityLabel?: string,
): AbilityProfileSnapshot {
  const statusItem = profile.ability_status.find((item) => item.ability === abilityId);

  return {
    abilityId,
    abilityLabel,
    abilityStatus: statusItem?.status,
    confidence: inferSnapshotConfidence(statusItem),
    currentWeakness: profile.current_weakness.primary === abilityId
      ? profile.current_weakness.primary
      : undefined,
    evidenceCount: statusItem?.evidence_links.length || 0,
    summary: statusItem?.summary,
    updatedAt: profile.generatedAt,
  };
}

function inferSnapshotConfidence(
  statusItem: StudentAbilityProfile['ability_status'][number] | undefined,
): number | undefined {
  if (!statusItem || statusItem.evidence_links.length === 0) return undefined;

  const total = statusItem.evidence_links.reduce((sum, link) => sum + link.confidence, 0);
  return Math.round((total / statusItem.evidence_links.length) * 100) / 100;
}

function buildNextAction(input: GrowthMemoryRecordInput): string | undefined {
  if (input.profileUpdateDecision.pendingVerification?.length) {
    return input.profileUpdateDecision.pendingVerification.join(' ');
  }

  return input.evaluationResult.nextAction;
}

function buildRecordId(
  studentId: string,
  abilityId: string,
  decisionId: string,
  createdAt: string,
): string {
  const timestamp = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  const safeAbility = abilityId.replace(/\s+/g, '');
  const safeDecision = decisionId.replace(/[^0-9a-zA-Z-]/g, '').slice(-18);
  return `growth-memory-${studentId}-${safeAbility}-${safeDecision}-${timestamp}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
