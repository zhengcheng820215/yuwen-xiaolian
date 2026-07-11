import type { EvaluationResult } from '../schemas/evaluationResult.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type {
  ProfileUpdateAction,
  ProfileUpdateDecision,
} from '../schemas/profileUpdateDecision.schema.ts';

export type ProfileUpdateDecisionInput = {
  evaluationResult: EvaluationResult;
  currentProfile: StudentAbilityProfile;
  decidedAt?: string;
};

export function decideProfileUpdate(
  input: ProfileUpdateDecisionInput,
): ProfileUpdateDecision {
  const currentStatus = input.currentProfile.ability_status.find((item) => item.ability === input.evaluationResult.abilityId)?.status;
  const action = inferAction(input.evaluationResult);
  const toStatus = inferToStatus(action, input.evaluationResult.growthLevel, currentStatus);
  const warnings = buildWarnings(input.evaluationResult, action);

  return {
    decisionId: buildDecisionId(input.evaluationResult.studentId, input.evaluationResult.abilityId, input.decidedAt),
    studentId: input.evaluationResult.studentId,
    abilityId: input.evaluationResult.abilityId,
    abilityLabel: input.evaluationResult.abilityLabel,
    action,
    reason: buildReason(input.evaluationResult, action),
    fromStatus: currentStatus,
    toStatus,
    confidenceDelta: inferConfidenceDelta(action, input.evaluationResult.confidence),
    appendEvidenceIds: input.evaluationResult.evidenceLinks,
    pendingVerification: inferPendingVerification(input.evaluationResult, action),
    warnings,
    evidenceLinks: input.evaluationResult.evidenceLinks,
    createdAt: input.decidedAt || new Date().toISOString(),
  };
}

function inferAction(result: EvaluationResult): ProfileUpdateAction {
  if (result.conflictStatus === 'significant') return 'human_review';
  if (result.growthLevel === 'fluctuating') return 'mark_fluctuating';
  if (result.evidenceSufficiency === 'insufficient') return 'append_evidence_only';
  if (result.growthLevel === 'improving' && result.evidenceSufficiency === 'sufficient') return 'update_status';
  if (result.growthLevel === 'early_signal') return 'update_confidence';
  if (result.nextAction === 'independent_retest' || result.nextAction === 'transfer_test') return 'request_retest';
  return 'append_evidence_only';
}

function inferToStatus(
  action: ProfileUpdateAction,
  growthLevel: EvaluationResult['growthLevel'],
  currentStatus?: string,
): string | undefined {
  if (action === 'update_status' && growthLevel === 'improving') return 'improving';
  if (action === 'mark_fluctuating') return currentStatus || 'improving';
  return undefined;
}

function inferConfidenceDelta(
  action: ProfileUpdateAction,
  confidence: number,
): number | undefined {
  if (action === 'update_confidence') return confidence >= 0.65 ? 0.08 : 0.04;
  if (action === 'update_status') return confidence >= 0.7 ? 0.12 : 0.08;
  return undefined;
}

function inferPendingVerification(
  result: EvaluationResult,
  action: ProfileUpdateAction,
): string[] | undefined {
  const pending: string[] = [];

  if (action === 'append_evidence_only') pending.push('继续收集有效证据。');
  if (action === 'request_retest') pending.push('安排同能力独立复测。');
  if (action === 'mark_fluctuating') pending.push('用独立复测验证当前波动是否持续。');
  if (action === 'human_review') pending.push('需要人工复核冲突证据。');
  if (result.nextAction === 'transfer_test') pending.push('安排新文本或新情境迁移验证。');
  if (result.limitations.length > 0) pending.push(...result.limitations.slice(0, 2));

  return pending.length > 0 ? unique(pending) : undefined;
}

function buildWarnings(
  result: EvaluationResult,
  action: ProfileUpdateAction,
): string[] {
  const warnings: string[] = [];

  if (result.evidenceSufficiency !== 'sufficient') warnings.push('证据尚不足，不应更新长期能力状态。');
  if (result.growthLevel === 'early_signal') warnings.push('早期改善迹象不能等同于长期能力提升。');
  if (result.conflictStatus !== 'none') warnings.push('当前存在证据冲突，画像更新必须保留不确定性。');
  if (action === 'update_status') warnings.push('状态更新仍需后续复测或迁移任务验证稳定性。');

  return warnings;
}

function buildReason(
  result: EvaluationResult,
  action: ProfileUpdateAction,
): string {
  const actionText: Record<ProfileUpdateAction, string> = {
    no_change: '保持画像不变',
    append_evidence_only: '仅追加证据',
    update_confidence: '只更新置信度',
    update_status: '受控更新状态',
    mark_fluctuating: '标记表现波动',
    request_retest: '请求复测验证',
    human_review: '进入人工复核',
  };

  return `${actionText[action]}：${result.summary}`;
}

function buildDecisionId(
  studentId: string,
  ability: string,
  decidedAt?: string,
): string {
  const timestamp = (decidedAt || new Date().toISOString()).replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  const safeAbility = ability.replace(/\s+/g, '');
  return `profile-decision-${studentId}-${safeAbility}-${timestamp}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
