import type { StudentAbilityProfileEvidenceLink } from './studentAbilityProfile.schema.ts';

export type ProfileUpdateAction =
  | 'no_change'
  | 'append_evidence_only'
  | 'update_confidence'
  | 'update_status'
  | 'mark_fluctuating'
  | 'request_retest'
  | 'human_review';

export type ProfileUpdateDecision = {
  decisionId: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;
  action: ProfileUpdateAction;
  reason: string;
  fromStatus?: string;
  toStatus?: string;
  confidenceDelta?: number;
  appendEvidenceIds: string[];
  profileEvidenceLinks?: StudentAbilityProfileEvidenceLink[];
  pendingVerification?: string[];
  warnings: string[];
  evidenceLinks: string[];
  createdAt: string;
};

export const PROFILE_UPDATE_ACTIONS: ProfileUpdateAction[] = [
  'no_change',
  'append_evidence_only',
  'update_confidence',
  'update_status',
  'mark_fluctuating',
  'request_retest',
  'human_review',
];

export function isProfileUpdateDecision(value: unknown): value is ProfileUpdateDecision {
  if (!value || typeof value !== 'object') return false;

  const decision = value as ProfileUpdateDecision;

  return (
    isNonEmptyString(decision.decisionId) &&
    isNonEmptyString(decision.studentId) &&
    isNonEmptyString(decision.abilityId) &&
    (decision.abilityLabel === undefined || isNonEmptyString(decision.abilityLabel)) &&
    PROFILE_UPDATE_ACTIONS.includes(decision.action) &&
    isNonEmptyString(decision.reason) &&
    (decision.fromStatus === undefined || typeof decision.fromStatus === 'string') &&
    (decision.toStatus === undefined || typeof decision.toStatus === 'string') &&
    (decision.confidenceDelta === undefined || typeof decision.confidenceDelta === 'number') &&
    Array.isArray(decision.appendEvidenceIds) &&
    decision.appendEvidenceIds.every(isNonEmptyString) &&
    (decision.profileEvidenceLinks === undefined || Array.isArray(decision.profileEvidenceLinks)) &&
    (decision.pendingVerification === undefined || (
      Array.isArray(decision.pendingVerification) &&
      decision.pendingVerification.every(isNonEmptyString)
    )) &&
    Array.isArray(decision.warnings) &&
    decision.warnings.every((item) => typeof item === 'string') &&
    Array.isArray(decision.evidenceLinks) &&
    decision.evidenceLinks.length > 0 &&
    decision.evidenceLinks.every(isNonEmptyString) &&
    isNonEmptyString(decision.createdAt)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
