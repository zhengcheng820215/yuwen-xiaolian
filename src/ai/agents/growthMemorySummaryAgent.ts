import type { ProfileUpdateAction } from '../schemas/profileUpdateDecision.schema.ts';
import type {
  GrowthMemoryRecentTrend,
  GrowthMemoryRecord,
  GrowthMemorySummary,
} from '../schemas/growthMemory.schema.ts';

export type GrowthMemorySummaryInput = {
  studentId: string;
  abilityId: string;
  records: GrowthMemoryRecord[];
  limit?: number;
};

export function summarizeGrowthMemory(
  input: GrowthMemorySummaryInput,
): GrowthMemorySummary {
  const scopedRecords = input.records
    .filter((record) => (
      record.studentId === input.studentId &&
      record.abilityId === input.abilityId
    ))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recentRecords = scopedRecords.slice(0, input.limit || 5);
  const latestRecord = recentRecords[0];
  const recentActions = recentRecords.map((record) => record.action);
  const recentTrend = inferRecentTrend(recentActions, recentRecords);
  const pendingActions = inferPendingActions(recentRecords);
  const limitations = inferLimitations(recentRecords, recentTrend);

  return {
    studentId: input.studentId,
    abilityId: input.abilityId,
    abilityLabel: latestRecord?.abilityLabel,
    recordCount: scopedRecords.length,
    latestRecordId: latestRecord?.recordId,
    latestAction: latestRecord?.action,
    recentActions,
    recentTrend,
    pendingActions,
    evidenceLinks: unique(recentRecords.flatMap((record) => record.evidenceLinks)),
    limitations,
    summary: buildSummaryText({
      abilityId: input.abilityId,
      recordCount: scopedRecords.length,
      latestAction: latestRecord?.action,
      recentTrend,
    }),
  };
}

function inferRecentTrend(
  actions: ProfileUpdateAction[],
  records: GrowthMemoryRecord[],
): GrowthMemoryRecentTrend {
  if (records.length === 0) return 'insufficient_evidence';
  if (actions.includes('mark_fluctuating')) return 'fluctuating';
  if (actions.includes('human_review')) return 'mixed';
  if (actions.includes('request_retest')) return 'retest_pending';
  if (actions.includes('update_status')) return 'status_improving';
  if (actions.length >= 2 && actions.every((action) => action === 'update_confidence')) {
    return 'confidence_increasing';
  }
  if (actions.every((action) => action === 'append_evidence_only' || action === 'no_change')) {
    return 'continued_observation';
  }

  const uniqueActions = new Set(actions);
  if (uniqueActions.size > 2) return 'mixed';

  return 'continued_observation';
}

function inferPendingActions(records: GrowthMemoryRecord[]): string[] {
  return unique(records.flatMap((record) => {
    const actions: string[] = [];

    if (record.action === 'request_retest') actions.push('安排同能力独立复测。');
    if (record.action === 'mark_fluctuating') actions.push('继续验证当前波动来源。');
    if (record.action === 'human_review') actions.push('需要人工复核冲突证据。');
    if (record.nextAction) actions.push(record.nextAction);

    return actions;
  }));
}

function inferLimitations(
  records: GrowthMemoryRecord[],
  recentTrend: GrowthMemoryRecentTrend,
): string[] {
  const limitations = unique(records.flatMap((record) => record.limitations));

  if (records.length === 0) limitations.push('当前没有可汇总的成长记忆记录。');
  if (records.length < 3) limitations.push('当前成长记忆记录数量仍有限。');
  if (recentTrend === 'confidence_increasing') limitations.push('置信度增加不等于长期能力已经提升。');
  if (recentTrend === 'status_improving') limitations.push('状态变化仍需后续独立复测或迁移验证。');
  if (recentTrend === 'fluctuating') limitations.push('当前存在波动，不能宣布稳定提升。');

  return unique(limitations);
}

function buildSummaryText(input: {
  abilityId: string;
  recordCount: number;
  latestAction?: ProfileUpdateAction;
  recentTrend: GrowthMemoryRecentTrend;
}): string {
  if (input.recordCount === 0) {
    return `${input.abilityId} 暂无成长记忆记录。`;
  }

  return `最近 ${input.recordCount} 条成长记忆中，${input.abilityId} 的决策轨迹为 ${input.recentTrend}，最近一次动作为 ${input.latestAction || 'none'}。该摘要只描述历史轨迹，不生成新的能力评价结论。`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
