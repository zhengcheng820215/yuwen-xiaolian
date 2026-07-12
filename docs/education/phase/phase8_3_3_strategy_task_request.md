# Phase 8.3.3：策略到任务请求转换（Strategy to Task Request）

## 一、阶段目标

Phase 8.3.3 只解决一个问题：

```text
将通过校验的 NextLearningStrategy 转换为下游任务模块可消费的 TaskRequest。
```

本阶段不生成具体题目。
本阶段只生成任务请求。

## 二、所属关系

Phase 8.3.3 属于 Phase 8.3 的第三个子闭环。

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
Valid NextLearningStrategy
+ StrategyValidationResult
-> TaskRequest
```

## 三、输入

最小输入：

- `NextLearningStrategy`
- `StrategyValidationResult`

前置条件：

```text
StrategyValidationResult.isValid = true
StrategyValidationResult.nextStep = create_task_request
```

如果不满足前置条件，不允许生成 `TaskRequest`。

## 四、输出

输出 `TaskRequest`。

建议最小结构：

```ts
type TaskRequest = {
  taskRequestId: string;
  strategyId: string;
  studentId: string;
  targetAbilityId: string;

  taskRole:
    | 'training'
    | 'retest'
    | 'transfer'
    | 'diagnosis'
    | 'observation';

  action: NextLearningStrategy['action'];
  validationGoal: string;
  evidenceLinks: string[];
  growthMemoryRecordIds: string[];
  constraints: string[];
};
```

## 五、处理规则

`TaskRequest` 是给下游任务生成模块的输入。

它可以表达：

- 目标能力；
- 任务角色；
- 本次任务要验证什么；
- 为什么需要这个任务；
- 支撑该请求的 Evidence 和 Growth Memory；
- 当前限制条件。

它不允许：

- 直接生成文章；
- 直接生成题干；
- 直接评价学生能力；
- 修改 Profile；
- 重新生成 Evaluation；
- 忽略 StrategyValidationResult；
- 从 invalid strategy 生成任务请求。

## 六、失败分支

如果策略校验失败：

```text
StrategyValidationResult.isValid = false
```

则本阶段输出应为：

```text
TaskRequest = null
blockedReason = validationErrors
```

不得生成兜底任务。

## 七、验收标准

通过条件：

1. 合法策略可以生成稳定结构的 `TaskRequest`。
2. `TaskRequest.strategyId` 与输入策略一致。
3. `TaskRequest.targetAbilityId` 与输入策略一致。
4. `TaskRequest.taskRole` 来自 `recommendedTaskRole`。
5. `TaskRequest.validationGoal` 保留策略中的验证目标。
6. `TaskRequest.evidenceLinks` 保留策略证据链接。
7. `TaskRequest.growthMemoryRecordIds` 保留成长记忆记录引用。
8. 校验失败时不生成 `TaskRequest`。
9. 输出结构便于后续任务生成模块消费。

## 八、本阶段不包含

- 不生成具体题目；
- 不接真实题库；
- 不接数据库；
- 不修改 Profile；
- 不重新评估 Evidence；
- 不判断任务是否最终有效；
- 不做 UI。

## 九、当前验收结果

PASS。

通过依据：

```text
pnpm run debug:phase8-3-3  PASS
```

已覆盖：

- 合法策略可以生成 `TaskRequest`；
- `TaskRequest` 保留 `strategyId`、`targetAbilityId`、`taskRole`、`validationGoal`、`evidenceLinks` 和 `growthMemoryRecordIds`；
- 校验失败时 `TaskRequest = null`；
- 校验失败时返回 `blockedReason`。
