import type {
  AbilityStatus,
  StudentAbilityProfile,
} from '../schemas/studentAbilityProfile.schema.ts';
import type { ProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';

export type ProfileDecisionExecutionResult = {
  studentId: string;
  abilityId: string;
  action: string;
  beforeProfile: StudentAbilityProfile;
  afterProfile: StudentAbilityProfile;
  appliedDecisionId: string;
  changedFields: string[];
  warnings: string[];
};

export function applyProfileUpdateDecision(input: {
  currentProfile: StudentAbilityProfile;
  decision: ProfileUpdateDecision;
  appliedAt?: string;
}): ProfileDecisionExecutionResult {
  const beforeProfile = cloneProfile(input.currentProfile);
  const afterProfile = cloneProfile(input.currentProfile);
  const changedFields: string[] = [];
  const warnings = [...input.decision.warnings];

  if (afterProfile.studentId !== input.decision.studentId) {
    warnings.push('Decision studentId does not match profile studentId; profile left unchanged.');
    return buildExecutionResult(input.decision, beforeProfile, afterProfile, changedFields, warnings);
  }

  afterProfile.generatedAt = input.appliedAt || new Date().toISOString();
  changedFields.push('generatedAt');

  const statusItem = afterProfile.ability_status.find((item) => item.ability === input.decision.abilityId);

  if (!statusItem) {
    warnings.push('Target ability is missing from profile ability_status; only top-level recommendation can be updated.');
  }

  if (input.decision.action === 'append_evidence_only') {
    appendEvidenceIds(statusItem, input.decision.appendEvidenceIds, input.decision.profileEvidenceLinks);
    appendTopLevelEvidenceLinks(afterProfile, input.decision.profileEvidenceLinks || []);
    afterProfile.next_step_recommendation = buildRecommendation(input.decision, '继续收集有效证据，暂不改变长期能力状态。');
    changedFields.push('ability_status.evidence_links', 'evidence_links', 'next_step_recommendation');
  }

  if (input.decision.action === 'update_confidence') {
    appendEvidenceIds(statusItem, input.decision.appendEvidenceIds);
    afterProfile.next_step_recommendation = buildRecommendation(input.decision, '已经出现改善信号，建议安排独立复测确认。');
    changedFields.push('ability_status.evidence_links', 'next_step_recommendation');
  }

  if (input.decision.action === 'update_status') {
    if (statusItem && input.decision.toStatus) {
      statusItem.status = toProfileStatus(input.decision.toStatus);
      statusItem.summary = `${input.decision.abilityId} 已按评估决策更新为 ${input.decision.toStatus}，但仍需后续证据验证稳定性。`;
      appendEvidenceIds(statusItem, input.decision.appendEvidenceIds);
      changedFields.push('ability_status.status', 'ability_status.summary', 'ability_status.evidence_links');
    }
    afterProfile.next_step_recommendation = buildRecommendation(input.decision, '继续通过独立复测或迁移任务验证改善是否稳定。');
    changedFields.push('next_step_recommendation');
  }

  if (input.decision.action === 'mark_fluctuating') {
    if (statusItem) {
      statusItem.summary = `${input.decision.abilityId} 当前表现波动，需要继续验证，不能宣布稳定提升。`;
      appendEvidenceIds(statusItem, input.decision.appendEvidenceIds);
      changedFields.push('ability_status.summary', 'ability_status.evidence_links');
    }
    afterProfile.next_step_recommendation = buildRecommendation(input.decision, '安排同能力独立复测，确认当前波动来源。');
    changedFields.push('next_step_recommendation');
  }

  if (input.decision.action === 'request_retest') {
    afterProfile.next_step_recommendation = buildRecommendation(input.decision, '安排同能力独立复测或迁移验证。');
    changedFields.push('next_step_recommendation');
  }

  if (input.decision.action === 'human_review') {
    afterProfile.next_step_recommendation = buildRecommendation(input.decision, '当前证据冲突明显，建议人工复核后再调整画像。');
    changedFields.push('next_step_recommendation');
  }

  if (input.decision.action === 'no_change') {
    afterProfile.next_step_recommendation = buildRecommendation(input.decision, '画像保持不变。');
    changedFields.push('next_step_recommendation');
  }

  return buildExecutionResult(input.decision, beforeProfile, afterProfile, unique(changedFields), unique(warnings));
}

function appendTopLevelEvidenceLinks(
  profile: StudentAbilityProfile,
  links: StudentAbilityProfile['evidence_links'],
): void {
  const existing = new Set(profile.evidence_links.map((link) => link.evidenceId));
  for (const link of links) {
    if (existing.has(link.evidenceId)) continue;
    profile.evidence_links.push(structuredClone(link));
    existing.add(link.evidenceId);
  }
}

function appendEvidenceIds(
  statusItem: StudentAbilityProfile['ability_status'][number] | undefined,
  evidenceIds: string[],
  suppliedLinks: StudentAbilityProfile['evidence_links'] = [],
): void {
  if (!statusItem) return;

  const existing = new Set(statusItem.evidence_links.map((link) => link.evidenceId));
  for (const evidenceId of evidenceIds) {
    if (existing.has(evidenceId)) continue;
    const supplied = suppliedLinks.find((link) => link.evidenceId === evidenceId);
    statusItem.evidence_links.push(supplied || {
      evidenceId,
      ability: statusItem.ability,
      evidenceType: 'insufficient',
      source: 'diagnosis',
      observation: '由 ProfileUpdateDecision 追加的证据引用，详情需回查 Evidence Store。',
      confidence: 0.5,
    });
    existing.add(evidenceId);
  }
}

function toProfileStatus(status: string): AbilityStatus {
  if (status === 'improving') return 'improving';
  if (status === 'stable_positive') return 'stable_positive';
  if (status === 'weak') return 'weak';
  return 'insufficient_evidence';
}

function buildRecommendation(
  decision: ProfileUpdateDecision,
  fallback: string,
): string {
  const pendingText = decision.pendingVerification?.join(' ') || fallback;
  return `${decision.abilityId}：${pendingText}`;
}

function buildExecutionResult(
  decision: ProfileUpdateDecision,
  beforeProfile: StudentAbilityProfile,
  afterProfile: StudentAbilityProfile,
  changedFields: string[],
  warnings: string[],
): ProfileDecisionExecutionResult {
  return {
    studentId: decision.studentId,
    abilityId: decision.abilityId,
    action: decision.action,
    beforeProfile,
    afterProfile,
    appliedDecisionId: decision.decisionId,
    changedFields,
    warnings,
  };
}

function cloneProfile(profile: StudentAbilityProfile): StudentAbilityProfile {
  return JSON.parse(JSON.stringify(profile)) as StudentAbilityProfile;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
