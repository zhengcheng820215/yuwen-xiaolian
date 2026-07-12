# Phase 8.4.3：任务匹配结果分流（Task Fulfillment Branching）

## 一、阶段目标

Phase 8.4.3 只解决一个问题：

```text
根据 TaskResourceMatchResult，
将匹配成功的结果封装为 ExecutableLearningTask，
或将匹配失败的结果转换为 TaskGenerationRequest。
```

本阶段不生成具体题目。
本阶段只做分流和封装。

## 二、所属关系

Phase 8.4.3 属于 Phase 8.4 的第三个子闭环。

完整 Phase 8.4 链路是：

```text
TaskRequest
-> TaskFulfillmentRequest
-> TaskResourceMatchResult
-> ExecutableLearningTask / TaskGenerationRequest
```

本阶段只完成：

```text
TaskResourceMatchResult
├─ matched -> ExecutableLearningTask
├─ partial_match -> blocked / review / TaskGenerationRequest
└─ no_match -> TaskGenerationRequest
```

## 三、输入

最小输入：

- `TaskFulfillmentRequest`
- `TaskResourceMatchResult`
- `AvailableTaskResources`

## 四、输出

输出之一：

- `ExecutableLearningTask`
- `TaskGenerationRequest`

如果匹配成功：

```text
matched
-> ExecutableLearningTask
```

如果部分匹配：

```text
partial_match
-> blocked / review / TaskGenerationRequest
```

如果没有匹配：

```text
no_match
-> TaskGenerationRequest
```

## 五、ExecutableLearningTask 边界

`ExecutableLearningTask` 表示：

```text
当前有一个任务资源或任务草案，
可以承接本次 TaskRequest 的验证目标。
```

它不表示：

- 题目质量已正式合格；
- 已完成长期题库审核；
- 已证明教学有效；
- 已经可以长期复用。

建议最小字段：

- `executableTaskId`
- `studentId`
- `sourceType`
- `sourceTaskId`
- `contentRef`
- `questionRef`
- `rubricRef`
- `sourceStrategyId`
- `sourceTaskRequestId`
- `sourceFulfillmentRequestId`
- `taskRole`
- `targetAbilityId`
- `validationGoal`
- `taskSummary`
- `limitations`

## 六、TaskGenerationRequest 边界

`TaskGenerationRequest` 表示：

```text
当前没有合适资源，需要后续题目生成模块生成任务。
```

它不自己生成题目。

建议最小结构：

```ts
type TaskGenerationRequest = {
  generationRequestId: string;
  taskRole: string;
  targetAbilityId: string;
  validationGoal: string;
  difficultyPreference: string;
  contentConstraints: string[];
  answerRequirements: string[];
  evaluationRequirements: string[];
  sourceTaskRequestId: string;
  sourceFulfillmentRequestId: string;
  sourceStrategyId?: string;
};
```

## 七、分流规则

最小分流规则：

| Match status | 输出 |
| --- | --- |
| `matched` | `ExecutableLearningTask` |
| `partial_match` | `blocked` / `review` / `TaskGenerationRequest` |
| `no_match` | `TaskGenerationRequest` |

如果 `partial_match`：

- 默认不生成 `ExecutableLearningTask`；
- 必须说明未满足哪些软偏好或复核原因；
- 可以进入人工复核；
- 可以形成 `TaskGenerationRequest`；
- 不允许伪装成完全匹配。

如果 `no_match`：

- 不允许伪造 `ExecutableLearningTask`；
- 必须说明生成请求的来源；
- 必须保留 `validationGoal`；
- 必须保留 `sourceTaskRequestId`；
- 必须保留 `sourceFulfillmentRequestId`。

## 八、验收标准

通过条件：

1. `matched` 能生成 `ExecutableLearningTask`。
2. `partial_match` 不自动生成 `ExecutableLearningTask`。
3. `partial_match` 能进入 blocked / review / `TaskGenerationRequest`。
4. `no_match` 能生成 `TaskGenerationRequest`。
5. `no_match` 不生成 `ExecutableLearningTask`。
6. 输出保留 `sourceStrategyId`。
7. 输出保留 `sourceTaskRequestId`。
8. 输出保留 `sourceFulfillmentRequestId`。
9. 输出保留 `validationGoal`。
10. 输出保留 `targetAbilityId`。
11. 输出不包含真实生成题目内容。

## 九、本阶段不包含

- 不调用 LLM；
- 不生成最终题目；
- 不执行学生作答；
- 不生成 DiagnosisResult；
- 不更新 Profile；
- 不接真实题库；
- 不接数据库；
- 不做 UI。

## 十、当前验收结果

PASS。

通过依据：

```text
pnpm run debug:phase8-4-3  PASS
```

已覆盖：

- `matched` 可以生成 `ExecutableLearningTask`；
- `partial_match` 不会生成 `ExecutableLearningTask`；
- `partial_match` 可以生成 `TaskGenerationRequest`；
- `no_match` 可以生成 `TaskGenerationRequest`；
- `sourceTaskRequestId` 和 `sourceFulfillmentRequestId` 可以保留。
