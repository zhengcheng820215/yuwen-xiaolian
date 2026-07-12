import type {
  NextLearningAction,
  NextLearningStrategy,
  NextLearningStrategyInput,
  RecommendedTaskRole,
} from '../schemas/nextLearningStrategy.schema.ts';

export function generateNextLearningStrategy(
  input: NextLearningStrategyInput,
): NextLearningStrategy {
  const now = input.createdAt || new Date().toISOString();
  const targetAbilityId = (
    input.currentLearningContext.targetAbilityId ||
    input.growthMemorySummary.abilityId ||
    input.studentAbilityProfile.current_weakness.primary
  );
  const action = inferAction(input);
  const recommendedTaskRole = inferRecommendedTaskRole(action);

  return {
    strategyId: buildStrategyId(input.growthMemorySummary.studentId, targetAbilityId, now),
    studentId: input.growthMemorySummary.studentId,
    targetAbilityId,
    action,
    reason: buildReason(input, action),
    evidenceLinks: unique(input.growthMemorySummary.evidenceLinks),
    growthMemoryRecordIds: unique([
      input.growthMemorySummary.latestRecordId || '',
    ]),
    validationGoal: buildValidationGoal(targetAbilityId, action),
    recommendedTaskRole,
    limitations: buildLimitations(input, action),
    strategySource: 'growth_memory',
    createdAt: now,
  };
}

function inferAction(input: NextLearningStrategyInput): NextLearningAction {
  const { recentTrend } = input.growthMemorySummary;
  const { currentLearningContext } = input;

  if (currentLearningContext.reviewRequired) return 'human_review';

  if (recentTrend === 'retest_pending') return 'independent_retest';
  if (recentTrend === 'fluctuating') {
    if ((currentLearningContext.recentFailureCount || 0) >= 2 || currentLearningContext.cognitiveLoad === 'high') {
      return 'lower_difficulty_training';
    }
    return 'diagnostic_verification';
  }
  if (recentTrend === 'continued_observation' || recentTrend === 'insufficient_evidence') return 'collect_more_evidence';
  if (recentTrend === 'confidence_increasing') {
    if (currentLearningContext.allowTransfer) return 'transfer_test';
    return 'continue_training';
  }
  if (recentTrend === 'status_improving') {
    if (currentLearningContext.allowTransfer) return 'transfer_test';
    return 'maintenance_validation';
  }
  if (recentTrend === 'mixed') return 'human_review';

  return 'collect_more_evidence';
}

function inferRecommendedTaskRole(action: NextLearningAction): RecommendedTaskRole {
  const map: Record<NextLearningAction, RecommendedTaskRole> = {
    continue_training: 'training',
    independent_retest: 'retest',
    transfer_test: 'transfer',
    diagnostic_verification: 'diagnosis',
    collect_more_evidence: 'observation',
    lower_difficulty_training: 'training',
    maintenance_validation: 'retest',
    switch_ability: 'training',
    human_review: 'observation',
  };

  return map[action];
}

function buildReason(input: NextLearningStrategyInput, action: NextLearningAction): string {
  const ability = input.growthMemorySummary.abilityLabel || input.growthMemorySummary.abilityId;
  const trend = input.growthMemorySummary.recentTrend;
  const actionText: Record<NextLearningAction, string> = {
    continue_training: '继续同能力训练',
    independent_retest: '安排独立复测',
    transfer_test: '安排迁移验证',
    diagnostic_verification: '先做诊断性验证',
    collect_more_evidence: '继续收集有效证据',
    lower_difficulty_training: '降低难度继续训练',
    maintenance_validation: '进行保持性验证',
    switch_ability: '切换到更需要处理的能力',
    human_review: '进入人工复核',
  };

  return `${ability} 的成长记忆趋势为 ${trend}，因此下一步建议${actionText[action]}。`;
}

function buildValidationGoal(abilityId: string, action: NextLearningAction): string {
  const goals: Record<NextLearningAction, string> = {
    continue_training: `继续观察 ${abilityId} 在同类任务中的训练表现是否更稳定。`,
    independent_retest: `验证 ${abilityId} 是否能在少提示或无提示条件下独立表现。`,
    transfer_test: `验证 ${abilityId} 是否能迁移到新文本或新情境。`,
    diagnostic_verification: `确认 ${abilityId} 当前波动或薄弱表现的主要来源。`,
    collect_more_evidence: `收集更多 ${abilityId} 的有效作答证据。`,
    lower_difficulty_training: `在较低认知负担下继续观察 ${abilityId} 的可训练表现。`,
    maintenance_validation: `验证 ${abilityId} 的改善迹象是否能保持。`,
    switch_ability: `确认下一阶段是否应转向其他更优先能力。`,
    human_review: `由人工复核 ${abilityId} 的混合或冲突记录。`,
  };

  return goals[action];
}

function buildLimitations(
  input: NextLearningStrategyInput,
  action: NextLearningAction,
): string[] {
  const limitations = [...input.growthMemorySummary.limitations];

  if (input.growthMemorySummary.recordCount < 3) limitations.push('成长记忆记录数量仍有限。');
  if (!input.currentLearningContext.allowRetest && action === 'independent_retest') limitations.push('当前上下文暂不允许复测。');
  if (!input.currentLearningContext.allowTransfer && action === 'transfer_test') limitations.push('当前上下文暂不允许迁移任务。');
  if (action === 'human_review') limitations.push('人工复核策略不应直接生成普通任务。');

  return unique(limitations);
}

function buildStrategyId(studentId: string, abilityId: string, createdAt: string): string {
  const timestamp = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `next-strategy-${studentId}-${abilityId}-${timestamp}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
