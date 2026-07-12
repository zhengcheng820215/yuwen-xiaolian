# Phase 8.3.1：下一步学习策略生成（Next Learning Strategy）

## 一、阶段目标

Phase 8.3.1 只解决一个问题：

```text
基于 GrowthMemorySummary、StudentAbilityProfile 和 CurrentLearningContext，
生成下一步学习策略 NextLearningStrategy。
```

本阶段不生成具体题目。
本阶段不校验策略是否可执行。
本阶段不生成 TaskRequest。

## 二、所属关系

Phase 8.3.1 属于 Phase 8.3 的第一个子闭环。

完整 Phase 8.3 链路是：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
-> NextLearningStrategy
-> StrategyValidationResult
-> TaskRequest
```

本阶段只完成第一段：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
-> NextLearningStrategy
```

## 三、输入

最小输入：

- `studentId`
- `GrowthMemorySummary`
- `StudentAbilityProfile`
- `CurrentLearningContext`

`CurrentLearningContext` 至少应表达：

- 当前学习目标；
- 最近一次任务角色；
- 当前是否处于训练、复测、迁移或观察阶段；
- 当前是否允许继续训练；
- 当前是否需要复测、验证或人工复核。

## 四、输出

输出一条稳定结构的 `NextLearningStrategy`。

最小字段包括：

- `strategyId`
- `studentId`
- `targetAbilityId`
- `action`
- `reason`
- `evidenceLinks`
- `growthMemoryRecordIds`
- `validationGoal`
- `recommendedTaskRole`
- `limitations`

## 五、处理规则

`NextLearningStrategy` 只回答：

```text
下一步最适合做什么，为什么？
```

它可以建议：

- 继续训练；
- 独立复测；
- 迁移测试；
- 诊断性验证；
- 收集更多证据；
- 降低难度训练；
- 保持性验证；
- 切换能力；
- 人工复核。

它不允许：

- 生成具体题目；
- 修改 Profile；
- 重新判断 Evaluation；
- 宣布能力已经提升；
- 直接进入任务执行；
- 绕过 Strategy Validation。

## 六、最小策略映射

| recentTrend | action | recommendedTaskRole |
| --- | --- | --- |
| `retest_pending` | `independent_retest` | `retest` |
| `fluctuating` | `diagnostic_verification` | `diagnosis` |
| `continued_observation` | `collect_more_evidence` | `observation` |
| `confidence_increasing` | `transfer_test` | `transfer` |
| `status_improving` | `maintenance_validation` | `retest` |
| `mixed` | `human_review` | `observation` |

如果上下文显示学生连续失败或负荷较高，`fluctuating` 也可以映射为：

```text
lower_difficulty_training
```

## 七、验收标准

通过条件：

1. 能根据 `retest_pending` 生成 `independent_retest`。
2. 能根据 `fluctuating` 生成 `diagnostic_verification` 或 `lower_difficulty_training`。
3. 能根据 `continued_observation` 生成 `collect_more_evidence`。
4. 能根据 `confidence_increasing` 生成 `transfer_test` 或 `continue_training`。
5. 能根据 `status_improving` 生成 `transfer_test` 或 `maintenance_validation`。
6. 每条策略都有明确 `reason`。
7. 每条策略都有 `evidenceLinks`。
8. 每条策略都有 `growthMemoryRecordIds`。
9. 每条策略都有 `validationGoal`。
10. 每条策略都有 `recommendedTaskRole`。

## 八、本阶段不包含

- 不校验策略；
- 不生成 TaskRequest；
- 不生成具体题目；
- 不修改 Profile；
- 不重新评估 Evidence；
- 不接真实题库；
- 不接数据库；
- 不做 UI。

## 九、当前验收结果

PASS。

通过依据：

```text
pnpm run debug:phase8-3-1  PASS
```

已覆盖：

- `retest_pending -> independent_retest`
- `fluctuating -> diagnostic_verification`
- `fluctuating + high load -> lower_difficulty_training`
- `continued_observation -> collect_more_evidence`
- `confidence_increasing -> transfer_test`
- `status_improving -> transfer_test`
- `mixed -> human_review`
