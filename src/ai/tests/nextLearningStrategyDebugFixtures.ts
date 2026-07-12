import type { GrowthMemoryRecentTrend, GrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import type {
  CurrentLearningContext,
  NextLearningAction,
  NextLearningStrategy,
  RecommendedTaskRole,
} from '../schemas/nextLearningStrategy.schema.ts';
import { makeProfile } from './growthMemoryDebugFixtures.ts';

export const phase83StudentId = 'demo-student';
export const phase83AbilityId = '推理';
export const phase83RunAt = '2026-07-12T09:30:00.000Z';

export function buildGrowthMemorySummaryFixture(
  recentTrend: GrowthMemoryRecentTrend,
  overrides: Partial<GrowthMemorySummary> = {},
): GrowthMemorySummary {
  return {
    studentId: phase83StudentId,
    abilityId: phase83AbilityId,
    abilityLabel: phase83AbilityId,
    recordCount: recentTrend === 'insufficient_evidence' ? 0 : 3,
    latestRecordId: recentTrend === 'insufficient_evidence' ? undefined : `gm-record-${recentTrend}`,
    latestAction: recentTrend === 'retest_pending'
      ? 'request_retest'
      : recentTrend === 'fluctuating'
        ? 'mark_fluctuating'
        : recentTrend === 'confidence_increasing'
          ? 'update_confidence'
          : recentTrend === 'status_improving'
            ? 'update_status'
            : recentTrend === 'mixed'
              ? 'human_review'
              : 'append_evidence_only',
    recentActions: [],
    recentTrend,
    pendingActions: [],
    evidenceLinks: recentTrend === 'insufficient_evidence' ? ['ev-limited-1'] : [`ev-${recentTrend}-1`, `ev-${recentTrend}-2`],
    limitations: recentTrend === 'status_improving'
      ? ['状态变化仍需后续独立复测或迁移验证。']
      : ['当前成长记忆记录仍需继续观察。'],
    summary: `${phase83AbilityId} recent trend is ${recentTrend}.`,
    ...overrides,
  };
}

export function buildCurrentLearningContextFixture(
  overrides: Partial<CurrentLearningContext> = {},
): CurrentLearningContext {
  return {
    contextId: 'phase83-context',
    studentId: phase83StudentId,
    currentPhase: 'observation',
    targetAbilityId: phase83AbilityId,
    recentTaskRole: 'training',
    allowTraining: true,
    allowRetest: true,
    allowTransfer: true,
    recentFailureCount: 0,
    cognitiveLoad: 'medium',
    reviewRequired: false,
    notes: [],
    ...overrides,
  };
}

export function buildStudentAbilityProfileFixture() {
  return makeProfile(phase83StudentId, phase83AbilityId);
}

export function buildStrategyFixture(
  overrides: Partial<NextLearningStrategy> = {},
): NextLearningStrategy {
  const action = overrides.action || 'independent_retest';
  const role = overrides.recommendedTaskRole || inferRole(action);

  return {
    strategyId: 'next-strategy-debug',
    studentId: phase83StudentId,
    targetAbilityId: phase83AbilityId,
    action,
    reason: '基于成长记忆，下一步需要验证独立表现。',
    evidenceLinks: ['ev-debug-1'],
    growthMemoryRecordIds: ['gm-record-debug'],
    validationGoal: '验证推理是否能独立完成。',
    recommendedTaskRole: role,
    limitations: [],
    strategySource: 'growth_memory',
    createdAt: phase83RunAt,
    ...overrides,
  };
}

export const phase83MappingCases: Array<{
  name: string;
  trend: GrowthMemoryRecentTrend;
  context?: Partial<CurrentLearningContext>;
  expectedAction: NextLearningAction;
  expectedRole: RecommendedTaskRole;
}> = [
  {
    name: 'retest_pending -> independent_retest',
    trend: 'retest_pending',
    expectedAction: 'independent_retest',
    expectedRole: 'retest',
  },
  {
    name: 'fluctuating -> diagnostic_verification',
    trend: 'fluctuating',
    expectedAction: 'diagnostic_verification',
    expectedRole: 'diagnosis',
  },
  {
    name: 'fluctuating with high load -> lower_difficulty_training',
    trend: 'fluctuating',
    context: { recentFailureCount: 2, cognitiveLoad: 'high' },
    expectedAction: 'lower_difficulty_training',
    expectedRole: 'training',
  },
  {
    name: 'continued_observation -> collect_more_evidence',
    trend: 'continued_observation',
    expectedAction: 'collect_more_evidence',
    expectedRole: 'observation',
  },
  {
    name: 'confidence_increasing -> transfer_test',
    trend: 'confidence_increasing',
    expectedAction: 'transfer_test',
    expectedRole: 'transfer',
  },
  {
    name: 'status_improving -> transfer_test',
    trend: 'status_improving',
    expectedAction: 'transfer_test',
    expectedRole: 'transfer',
  },
  {
    name: 'mixed -> human_review',
    trend: 'mixed',
    expectedAction: 'human_review',
    expectedRole: 'observation',
  },
];

function inferRole(action: NextLearningAction): RecommendedTaskRole {
  if (action === 'independent_retest' || action === 'maintenance_validation') return 'retest';
  if (action === 'transfer_test') return 'transfer';
  if (action === 'diagnostic_verification') return 'diagnosis';
  if (action === 'continue_training' || action === 'lower_difficulty_training' || action === 'switch_ability') return 'training';
  return 'observation';
}
