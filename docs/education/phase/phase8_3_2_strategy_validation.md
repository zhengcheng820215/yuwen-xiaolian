# Phase 8.3.2：学习策略校验（Strategy Validation）

## 一、阶段目标

Phase 8.3.2 只解决一个问题：

```text
判断 NextLearningStrategy 是否具备进入 TaskRequest 转换的最低条件。
```

本阶段是策略到执行请求之间的闸门。

## 二、所属关系

Phase 8.3.2 属于 Phase 8.3 的第二个子闭环。

完整 Phase 8.3 链路是：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
-> NextLearningStrategy
-> StrategyValidationResult
-> TaskRequest
```

本阶段只完成：

```text
NextLearningStrategy
-> StrategyValidationResult
```

## 三、输入

最小输入：

- `NextLearningStrategy`
- `StudentAbilityProfile`
- `CurrentLearningContext`

可选输入：

- 可用任务资源摘要；
- 最近失败次数；
- 最近提示依赖；
- 人工复核标记；
- 当前阶段限制。

## 四、输出

输出 `StrategyValidationResult`。

建议最小结构：

```ts
type StrategyValidationResult = {
  strategyId: string;
  isValid: boolean;
  validationErrors: string[];
  warnings: string[];
  blockedReason?: string;
  nextStep:
    | 'create_task_request'
    | 'review_required'
    | 'regenerate_strategy'
    | 'blocked';
};
```

## 五、失败分支

策略校验失败时，系统必须：

```text
isValid = false
-> 不生成 TaskRequest
-> 返回 validationErrors
-> 进入 review / regenerate / blocked
```

系统不得：

- 校验失败仍生成 TaskRequest；
- 用默认题目兜底；
- 忽略空 `evidenceLinks`；
- 忽略空 `validationGoal`；
- 忽略 action 与 taskRole 不匹配；
- 把人工复核策略转换成普通训练任务。

## 六、最小校验规则

策略必须满足：

1. `strategyId` 存在。
2. `studentId` 存在。
3. `targetAbilityId` 存在。
4. `action` 属于允许枚举。
5. `reason` 不为空。
6. `evidenceLinks` 不为空。
7. `growthMemoryRecordIds` 不为空。
8. `validationGoal` 不为空。
9. `recommendedTaskRole` 属于允许枚举。
10. `action` 与 `recommendedTaskRole` 基本匹配。

基础匹配关系：

| action | 合法 recommendedTaskRole |
| --- | --- |
| `continue_training` | `training` |
| `lower_difficulty_training` | `training` |
| `independent_retest` | `retest` |
| `transfer_test` | `transfer` |
| `diagnostic_verification` | `diagnosis` |
| `collect_more_evidence` | `observation` / `diagnosis` |
| `maintenance_validation` | `retest` / `transfer` |
| `switch_ability` | `training` / `diagnosis` |
| `human_review` | `observation` |

## 七、验收标准

通过条件：

1. 合法策略返回 `isValid = true`。
2. 合法策略返回 `nextStep = create_task_request`。
3. 缺少 evidenceLinks 时返回 `isValid = false`。
4. 缺少 validationGoal 时返回 `isValid = false`。
5. action 与 taskRole 不匹配时返回 `isValid = false` 或 warning。
6. `human_review` 不得生成普通训练 TaskRequest。
7. 校验失败时不得生成 TaskRequest。
8. validationErrors 必须明确说明失败原因。

## 八、本阶段不包含

- 不生成 NextLearningStrategy；
- 不生成 TaskRequest；
- 不生成具体题目；
- 不修改 Profile；
- 不重新执行 Evaluation；
- 不接真实题库；
- 不做 UI。

## 九、当前验收结果

PASS。

通过依据：

```text
pnpm run debug:phase8-3-2  PASS
```

已覆盖：

- 合法策略通过校验；
- 缺少 `evidenceLinks` 会失败；
- action 与 role 不匹配会失败；
- `human_review` 会进入 `review_required`；
- 校验失败时保留明确 `validationErrors`。
