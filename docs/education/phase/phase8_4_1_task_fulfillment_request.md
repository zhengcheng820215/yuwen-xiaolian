# Phase 8.4.1：任务请求标准化（Task Fulfillment Request）

## 一、阶段目标

Phase 8.4.1 只解决一个问题：

```text
将 TaskRequest 转换为资源系统可以理解的 TaskFulfillmentRequest。
```

本阶段不查题库。
本阶段不匹配资源。
本阶段不生成题目。

## 二、所属关系

Phase 8.4.1 属于 Phase 8.4 的第一个子闭环。

完整 Phase 8.4 链路是：

```text
TaskRequest
-> TaskFulfillmentRequest
-> TaskResourceMatchResult
-> ExecutableLearningTask / TaskGenerationRequest
```

本阶段只完成第一段：

```text
TaskRequest
-> TaskFulfillmentRequest
```

## 三、输入

最小输入：

- `TaskRequest`

`TaskRequest` 来自 Phase 8.3，并且必须满足：

```text
StrategyValidationResult.isValid = true
```

如果输入 `TaskRequest` 缺失关键字段，本阶段应返回 fulfillment blocked，不进入资源匹配。

## 四、输出

输出结构稳定的 `TaskFulfillmentRequest`。

最小字段包括：

- `requestId`
- `studentId`
- `taskRole`
- `targetAbilityId`
- `contentType`
- `questionType`
- `responseMode`
- `difficultyRange`
- `validationGoal`
- `requiredCapabilities`
- `hardConstraints`
- `softPreferences`
- `recentTaskIds`
- `sourceTaskRequestId`
- `sourceStrategyId`

## 五、处理规则

`TaskFulfillmentRequest` 把策略层语言翻译为资源检索或生成条件。

例如：

```text
TaskRequest:
验证能否在新文本中独立完成推理

TaskFulfillmentRequest:
transfer role
targetAbilityId = reasoning
contentType = new_text
questionType = open_response
responseMode = written
difficultyRange.preferred = same
requiredCapabilities = [text_evidence, inference_chain]
```

## 六、边界约束

本阶段不允许：

- 查找题库；
- 选择任务；
- 生成题干；
- 生成标准答案；
- 调用 LLM；
- 修改 TaskRequest；
- 修改 Student Profile；
- 重新判断策略是否合理。

本阶段必须保留来源追踪：

```text
NextLearningStrategy
-> TaskRequest
-> TaskFulfillmentRequest
```

因此输出应至少保留：

- `sourceStrategyId`
- `sourceTaskRequestId`

## 七、验收标准

通过条件：

1. 能读取合法 `TaskRequest`。
2. 能输出 `TaskFulfillmentRequest`。
3. 输出保留 `sourceTaskRequestId`。
4. 输出保留 `validationGoal`。
5. 输出包含 `targetAbilityId`。
6. 输出包含 `taskRole`。
7. 输出包含 `difficultyRange`。
8. 输出包含 `requiredCapabilities`。
9. 输出包含 `hardConstraints`。
10. 输出包含 `softPreferences`。
11. 输出可携带 `recentTaskIds`。
12. 不生成具体题目。

## 八、本阶段不包含

- 不做资源匹配；
- 不做生成请求；
- 不做可执行任务封装；
- 不接真实题库；
- 不接数据库；
- 不接 LLM；
- 不做 UI。

## 九、当前验收结果

PASS。

通过依据：

```text
pnpm run debug:phase8-4-1  PASS
```

已覆盖：

- 合法 `TaskRequest` 可以生成 `TaskFulfillmentRequest`；
- 无效 `TaskRequest` 会返回 blocked；
- `sourceTaskRequestId` 可以保留；
- `sourceStrategyId` 可以保留；
- `recentTaskIds` 可以保留。
