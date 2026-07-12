# Phase 8.3：下一步学习策略最小闭环（Next Learning Strategy Minimum Loop）

## 一、阶段目标

Phase 8.3 只解决一个核心问题：

```text
系统能否基于 GrowthMemorySummary、StudentAbilityProfile 和当前学习情境，
生成并校验下一步学习策略，
再将合法策略转换为下游任务模块可消费的 TaskRequest。
```

Phase 8.3 不回答：

- 下一题的文章是什么；
- 下一题的题干是什么；
- 是否已经证明策略有效；
- 是否已经形成完整自适应训练计划。

它先回答：

```text
当前最合适的学习动作是什么，为什么？
```

## 二、阶段背景

Phase 8.1 已经完成：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

Phase 8.2 已经完成：

```text
EvaluationResult
+ ProfileUpdateDecision
+ beforeProfile
+ afterProfile
-> GrowthMemoryRecord
-> GrowthMemoryStore
-> GrowthMemorySummary
```

Phase 8.3 继续向下游推进：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
-> NextLearningStrategy
-> StrategyValidationResult
-> TaskRequest
```

## 三、核心链路

Phase 8.3 的完整链路必须包含失败分支：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
↓
NextLearningStrategy
↓
StrategyValidationResult
├─ valid -> TaskRequest
└─ invalid -> blocked / review / regenerate
```

如果策略校验失败，系统必须：

- `isValid = false`；
- 不生成 `TaskRequest`；
- 返回明确 `validationErrors`；
- 进入人工检查、重新生成策略或阻断本轮执行。

系统不得：

- 在校验失败时尽量生成一个任务；
- 忽略缺失证据；
- 绕过 Strategy Validation 直接进入任务生成；
- 把策略建议伪装成已验证任务请求。

## 四、子闭环拆分

Phase 8.3 拆成三个最小闭环：

| 子阶段 | 核心问题 | 输入 | 输出 |
| --- | --- | --- | --- |
| Phase 8.3.1 | 下一步做什么 | GrowthMemorySummary / Profile / Context | NextLearningStrategy |
| Phase 8.3.2 | 这个决定是否可执行 | NextLearningStrategy | StrategyValidationResult |
| Phase 8.3.3 | 如何交给任务模块 | Valid Strategy | TaskRequest |

这三个子闭环的职责是：

- 8.3.1：决定下一步做什么；
- 8.3.2：确认这个决定是否可执行；
- 8.3.3：把决定翻译成任务请求。

## 五、NextLearningStrategy 最小结构

建议最小结构：

```ts
type NextLearningStrategy = {
  strategyId: string;
  studentId: string;
  targetAbilityId: string;

  action:
    | 'continue_training'
    | 'independent_retest'
    | 'transfer_test'
    | 'diagnostic_verification'
    | 'collect_more_evidence'
    | 'lower_difficulty_training'
    | 'maintenance_validation'
    | 'switch_ability'
    | 'human_review';

  reason: string;
  evidenceLinks: string[];
  growthMemoryRecordIds: string[];

  validationGoal: string;
  recommendedTaskRole:
    | 'training'
    | 'retest'
    | 'transfer'
    | 'diagnosis'
    | 'observation';

  limitations: string[];
};
```

## 六、最小映射规则

Phase 8.3 的第一版只需要验证以下映射稳定成立：

| GrowthMemorySummary.recentTrend | 候选 action | 说明 |
| --- | --- | --- |
| `retest_pending` | `independent_retest` | 已经出现复测需求，下一步优先验证独立表现 |
| `fluctuating` | `diagnostic_verification` / `lower_difficulty_training` | 表现波动，优先确认根因或降低认知负担 |
| `continued_observation` | `collect_more_evidence` | 当前证据仍不足，继续收集有效表现 |
| `confidence_increasing` | `transfer_test` / `continue_training` | 置信度提升，但仍需迁移或继续强化 |
| `status_improving` | `transfer_test` / `maintenance_validation` | 已出现状态改善记录，下一步验证迁移或保持 |
| `mixed` | `human_review` / `diagnostic_verification` | 近期记录混合，优先复核或诊断验证 |

该映射只是 Phase 8.3 的最小策略规则。
长期版本可以继续引入更多上下文，例如最近失败次数、任务难度、提示依赖、可用题目资源和学生负荷。

## 七、验收标准

运行 Debug 后，系统应能证明：

1. 能读取 `GrowthMemorySummary`。
2. 能结合 `StudentAbilityProfile` 和 `CurrentLearningContext`。
3. 能生成结构稳定的 `NextLearningStrategy`。
4. 每个策略都说明为什么这样安排。
5. 每个策略都包含 `evidenceLinks` 和 `growthMemoryRecordIds`。
6. 每个策略都包含 `validationGoal`。
7. 每个策略都包含 `recommendedTaskRole`。
8. 策略必须经过 `StrategyValidationResult`。
9. 校验失败时不得生成 `TaskRequest`。
10. 校验通过时才能生成下游可消费的 `TaskRequest`。

## 八、本阶段不包含

- 不生成具体题目；
- 不接真实题库；
- 不接数据库；
- 不修改 Student Ability Profile；
- 不重新执行 Evaluation；
- 不证明策略有效；
- 不生成完整多 Session 学习计划；
- 不做家长报告；
- 不做长期成长曲线；
- 不做复杂教学编排。

## 九、阶段能力定义

Phase 8.3 完成后，可以宣称：

```text
系统能够基于成长记忆、学生画像和当前学习情境，
生成并校验下一步学习策略，
并将合法策略转换为下游任务模块可消费的 TaskRequest。
```

但还不能宣称：

- 已经自动生成了下一题；
- 已经完成自适应训练计划；
- 已经证明策略有效；
- 已经形成完整教学编排；
- 已实现多 Session 自动运行。

## 十、当前验收结果

PASS。

## 十一、通过依据

已完成最小工程闭环：

- `NextLearningStrategy` schema；
- `StrategyValidationResult` schema；
- `TaskRequest` schema；
- `nextLearningStrategyAgent`；
- `strategyValidationAgent`；
- `taskRequestAgent`；
- `debug:phase8-3-1`；
- `debug:phase8-3-2`；
- `debug:phase8-3-3`；
- `debug:phase8-3`。

当前验证结果：

```text
pnpm run debug:phase8-3-1  PASS
pnpm run debug:phase8-3-2  PASS
pnpm run debug:phase8-3-3  PASS
pnpm run debug:phase8-3    PASS
pnpm run build             PASS
```

已验证：

1. `GrowthMemorySummary` 可以生成 `NextLearningStrategy`。
2. `StrategyValidationResult` 可以校验策略是否可执行。
3. 合法策略可以生成 `TaskRequest`。
4. 校验失败时不会生成 `TaskRequest`。
5. `human_review` 会被阻断到 review 分支，不会生成普通训练任务。

Demo 接入：

```text
/#/phase83-next-strategy-demo
```

当前状态：

```text
Demo 人工验收通过。
```

Demo 验收依据：

- 页面能展示 6 个验收 Case；
- 正常策略可生成 `TaskRequest`；
- `human_review` 和 invalid strategy 会被阻断；
- 校验失败时不会生成 `TaskRequest`；
- 页面没有生成具体题目；
- 页面没有修改 Profile；
- 页面没有重新执行 Evaluation。

## 十二、下一阶段

Phase 8.3.1：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
-> NextLearningStrategy
```
