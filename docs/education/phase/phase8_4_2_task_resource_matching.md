# Phase 8.4.2：任务资源匹配（Task Resource Matching）

## 一、阶段目标

Phase 8.4.2 只解决一个问题：

```text
基于 TaskFulfillmentRequest 和 mock 任务资源，
判断是否存在可匹配任务资源。
```

本阶段不生成题目。
本阶段不执行任务。
本阶段不更新画像。

## 二、所属关系

Phase 8.4.2 属于 Phase 8.4 的第二个子闭环。

完整 Phase 8.4 链路是：

```text
TaskRequest
-> TaskFulfillmentRequest
-> TaskResourceMatchResult
-> ExecutableLearningTask / TaskGenerationRequest
```

本阶段只完成：

```text
TaskFulfillmentRequest
+ AvailableTaskResources
-> TaskResourceMatchResult
```

## 三、输入

最小输入：

- `TaskFulfillmentRequest`
- `AvailableTaskResources`

第一版 `AvailableTaskResources` 使用 mock 数据。

每个资源至少包含：

- `taskId`
- `taskRole`
- `targetAbilityIds`
- `difficulty`
- `contentType`
- `questionType`
- `responseMode`
- `capabilities`
- `source`

可选输入：

- `recentTaskIds`：学生近期已完成任务 ID；
- 资源质量状态；
- 是否允许重复使用。

## 四、输出

输出 `TaskResourceMatchResult`。

建议最小结构：

```ts
type TaskResourceMatchResult = {
  fulfillmentRequestId: string;
  sourceTaskRequestId: string;

  status:
    | 'matched'
    | 'partial_match'
    | 'no_match';

  matchedTaskIds: string[];
  selectedTaskId?: string;

  matchReasons: string[];
  unmetConstraints: string[];
  unmetPreferences: string[];
};
```

## 五、匹配规则

### 硬约束与软偏好

匹配必须区分硬约束和软偏好。

硬约束不满足时，不能输出 `matched`。

软偏好不满足时，可以输出 `partial_match`，但默认不自动执行。

硬约束示例：

- `taskRole` 必须匹配；
- `targetAbilityId` 必须匹配；
- `responseMode` 必须匹配；
- 资源必须能验证 `validationGoal`；
- 资源必须覆盖核心 `requiredCapabilities`。

软偏好示例：

- 难度尽量在 `difficultyRange.preferred`；
- 文本体裁偏好；
- 推荐时长；
- 近期未使用；
- 内容来源偏好。

### 最小匹配规则

1. `taskRole` 应匹配。
2. `targetAbilityId` 应匹配。
3. `difficulty` 应尽量落在 `difficultyRange` 内。
4. `contentType`、`questionType`、`responseMode` 应尽量匹配。
5. `requiredCapabilities` 应尽量被资源覆盖。
6. `recentTaskIds` 中出现的任务应优先避免重复。

状态定义：

| status | 含义 |
| --- | --- |
| `matched` | 有资源满足所有硬约束，并可选择一个任务 |
| `partial_match` | 有候选资源，但存在硬约束以外的偏好未满足，或需要人工复核 |
| `no_match` | 没有可用候选资源 |

`partial_match` 默认不进入自动执行。
它只表示存在候选资源，但仍需要 review、blocked 或 generation request 分流。

## 六、边界约束

本阶段不允许：

- 生成题目；
- 修改资源；
- 修改 TaskFulfillmentRequest；
- 修改 Student Profile；
- 判断任务教学效果；
- 因为没有资源就伪造 `matched`。

## 七、验收标准

通过条件：

1. 能使用 mock 资源进行匹配。
2. 能按 `taskRole` 匹配。
3. 能按 `targetAbilityId` 匹配。
4. 能考虑 `difficultyRange`。
5. 能考虑 `requiredCapabilities`。
6. 能输出 `matched`。
7. 能输出 `partial_match`。
8. 能输出 `no_match`。
9. `no_match` 时不返回 `selectedTaskId`。
10. `partial_match` 时应说明 `unmetPreferences` 或需要复核的原因。
11. 能说明 `matchReasons`、`unmetConstraints` 和 `unmetPreferences`。

## 八、本阶段不包含

- 不做生成请求；
- 不封装可执行任务；
- 不接真实题库；
- 不接数据库；
- 不接 LLM；
- 不做 UI。

## 九、当前验收结果

PASS。

通过依据：

```text
pnpm run debug:phase8-4-2  PASS
```

已覆盖：

- `matched`；
- `partial_match`；
- `no_match`；
- `partial_match` 不返回 `selectedTaskId`；
- `no_match` 不返回 `selectedTaskId`；
- `matchReasons`、`unmetConstraints` 和 `unmetPreferences` 可以输出。
