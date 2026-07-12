import { generateNextLearningStrategy } from '../ai/agents/nextLearningStrategyAgent.ts';
import { createTaskRequest } from '../ai/agents/taskRequestAgent.ts';
import { validateNextLearningStrategy } from '../ai/agents/strategyValidationAgent.ts';
import type { CurrentLearningContext, NextLearningStrategy } from '../ai/schemas/nextLearningStrategy.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from '../ai/tests/nextLearningStrategyDebugFixtures.ts';

export function getPhase83NextStrategyDemoData() {
  const cases = getPhase83NextStrategyDemoCases();

  return {
    cases,
    defaultCaseId: 'retest_pending',
  };
}

export function getPhase83NextStrategyDemoCases() {
  return [
    buildDemoCase({
      id: 'retest_pending',
      label: '需要独立复测',
      description: 'Growth Memory 显示当前存在复测需求，系统应生成 independent_retest 策略。',
      expected: '策略校验通过，并生成 role 为 retest 的 TaskRequest。',
      trend: 'retest_pending',
      acceptancePoints: [
        'NextLearningStrategy action 为 independent_retest。',
        'StrategyValidationResult isValid 为 true。',
        'TaskRequest 被创建，但不包含具体题目。',
      ],
    }),
    buildDemoCase({
      id: 'fluctuating',
      label: '表现波动',
      description: '同一能力近期表现波动，系统应先做诊断性验证，而不是直接进入强化训练。',
      expected: '策略校验通过，并生成 diagnosis 类型 TaskRequest。',
      trend: 'fluctuating',
      acceptancePoints: [
        'NextLearningStrategy action 为 diagnostic_verification。',
        'recommendedTaskRole 为 diagnosis。',
        'TaskRequest 只表达验证目标，不生成题目内容。',
      ],
    }),
    buildDemoCase({
      id: 'high_load',
      label: '波动且负荷较高',
      description: '表现波动且连续失败或认知负荷较高时，系统应降低难度继续训练。',
      expected: '策略校验通过，并生成 training 类型 TaskRequest。',
      trend: 'fluctuating',
      contextOverride: {
        recentFailureCount: 2,
        cognitiveLoad: 'high',
      },
      acceptancePoints: [
        'NextLearningStrategy action 为 lower_difficulty_training。',
        'recommendedTaskRole 为 training。',
        'reason 能说明该策略来自波动和当前上下文。',
      ],
    }),
    buildDemoCase({
      id: 'confidence_increasing',
      label: '置信度增加',
      description: '近期决策轨迹显示置信度增加，下一步适合验证是否能迁移到新情境。',
      expected: '策略校验通过，并生成 transfer 类型 TaskRequest。',
      trend: 'confidence_increasing',
      acceptancePoints: [
        'NextLearningStrategy action 为 transfer_test。',
        'validationGoal 指向迁移验证。',
        'TaskRequest 保留 evidenceLinks 和 growthMemoryRecordIds。',
      ],
    }),
    buildDemoCase({
      id: 'human_review',
      label: '人工复核阻断',
      description: '近期记录混合或上下文要求人工复核时，系统必须阻断 TaskRequest。',
      expected: 'StrategyValidationResult isValid 为 false，TaskRequest 为 null。',
      trend: 'mixed',
      contextOverride: {
        reviewRequired: true,
      },
      acceptancePoints: [
        'NextLearningStrategy action 为 human_review。',
        'StrategyValidationResult nextStep 为 review_required。',
        '不会生成 TaskRequest。',
      ],
    }),
    buildInvalidDemoCase(),
  ];
}

function buildDemoCase(input: {
  id: string;
  label: string;
  description: string;
  expected: string;
  trend: Parameters<typeof buildGrowthMemorySummaryFixture>[0];
  contextOverride?: Partial<CurrentLearningContext>;
  acceptancePoints: string[];
}) {
  const growthMemorySummary = buildGrowthMemorySummaryFixture(input.trend);
  const studentAbilityProfile = buildStudentAbilityProfileFixture();
  const currentLearningContext = buildCurrentLearningContextFixture(input.contextOverride);
  const strategy = generateNextLearningStrategy({
    growthMemorySummary,
    studentAbilityProfile,
    currentLearningContext,
    createdAt: phase83RunAt,
  });
  const validationResult = validateNextLearningStrategy({
    strategy,
    currentLearningContext,
    validatedAt: phase83RunAt,
  });
  const conversionResult = createTaskRequest({
    strategy,
    validationResult,
    createdAt: phase83RunAt,
  });

  return {
    id: input.id,
    label: input.label,
    description: input.description,
    expected: input.expected,
    acceptancePoints: input.acceptancePoints,
    growthMemorySummary,
    currentLearningContext,
    strategy,
    validationResult,
    taskRequest: conversionResult.taskRequest,
    blockedReason: conversionResult.blockedReason,
  };
}

function buildInvalidDemoCase() {
  const base = buildDemoCase({
    id: 'invalid_missing_evidence',
    label: '缺少证据链接',
    description: '人为构造一个缺少 evidenceLinks 的策略，用于验证失败分支。',
    expected: 'StrategyValidationResult isValid 为 false，TaskRequest 为 null。',
    trend: 'retest_pending',
    acceptancePoints: [
      'validationErrors 能指出 evidenceLinks 缺失。',
      '校验失败后不会创建 TaskRequest。',
      '失败原因会保留给人工检查或重新生成策略。',
    ],
  });
  const invalidStrategy: NextLearningStrategy = {
    ...base.strategy,
    strategyId: `${base.strategy.strategyId}-invalid`,
    evidenceLinks: [],
  };
  const validationResult = validateNextLearningStrategy({
    strategy: invalidStrategy,
    currentLearningContext: base.currentLearningContext,
    validatedAt: phase83RunAt,
  });
  const conversionResult = createTaskRequest({
    strategy: invalidStrategy,
    validationResult,
    createdAt: phase83RunAt,
  });

  return {
    ...base,
    strategy: invalidStrategy,
    validationResult,
    taskRequest: conversionResult.taskRequest,
    blockedReason: conversionResult.blockedReason,
  };
}
