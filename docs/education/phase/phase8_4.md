# Phase 8.4：任务请求落地最小闭环（Task Request Fulfillment Minimum Loop）

## 一、阶段目标

Phase 8.4 只解决一个核心问题：

```text
系统能否消费经过校验的 TaskRequest，
将其转换为明确的任务资源需求，
并完成最小资源匹配或生成请求分流。
```

Phase 8.4 的一句话定义：

```text
消费经过校验的 TaskRequest，将其转换为任务资源需求，
并完成最小资源匹配或生成请求分流。
```

## 二、阶段背景

Phase 8.3 已经完成：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
-> NextLearningStrategy
-> StrategyValidationResult
-> TaskRequest
```

但 `TaskRequest` 仍然是任务策略层语言。

例如：

```text
taskRole: transfer
targetAbilityId: reasoning
validationGoal: 验证能否在新文本中独立完成推理
```

它还不是学生可以直接完成的题目。

Phase 8.4 需要补上从任务请求到任务资源需求的落地层。

## 三、核心链路

Phase 8.4 的完整链路：

```text
TaskRequest
↓
TaskFulfillmentRequest
↓
TaskResourceMatchResult
├─ matched
│  ↓
│  ExecutableLearningTask
│
├─ partial_match
│  ↓
│  blocked / review / TaskGenerationRequest
│
└─ no_match
   ↓
   TaskGenerationRequest
```

这条链路表达两个原则：

1. 优先消费已有资源，不默认交给 LLM 临时生成。
2. 资源匹配和内容生成请求是两条独立路径。

## 四、子闭环拆分

Phase 8.4 拆成三个最小闭环：

| 子阶段 | 核心问题 | 输入 | 输出 |
| --- | --- | --- | --- |
| Phase 8.4.1 | TaskRequest 如何转成资源需求 | TaskRequest | TaskFulfillmentRequest |
| Phase 8.4.2 | 是否有可匹配任务资源 | TaskFulfillmentRequest + AvailableTaskResources | TaskResourceMatchResult |
| Phase 8.4.3 | 匹配结果如何分流 | TaskResourceMatchResult | ExecutableLearningTask / TaskGenerationRequest |

## 五、核心对象边界

### TaskRequest

`TaskRequest` 描述：

- 为什么需要这个任务；
- 要验证什么；
- 目标能力是什么；
- 任务角色是什么；
- 它来自哪个策略。

`TaskRequest` 不描述：

- 学生实际要读什么文本；
- 题干是什么；
- 标准答案是什么；
- Rubric 是什么。

### LearningTask / Question

`LearningTask` 或 `Question` 描述：

- 学生实际完成什么内容；
- 文本、题干、作答要求是什么；
- 如何评价作答；
- 题目元数据和 Rubric 是什么。

### 二者关系

```text
一个 TaskRequest
-> 可能匹配多个候选任务
-> 最终选择一个 ExecutableLearningTask
```

不能理解为：

```text
TaskRequest = Question
```

## 六、Phase 8.4.1：TaskRequest 解释与标准化

只解决：

```text
TaskRequest
-> TaskFulfillmentRequest
```

建议最小结构：

```ts
type TaskFulfillmentRequest = {
  requestId: string;
  studentId: string;

  taskRole: 'training' | 'retest' | 'transfer' | 'diagnosis' | 'observation';
  targetAbilityId: string;

  contentType?: string;
  questionType?: string;
  responseMode?: string;

  difficultyRange: {
    preferred: string;
    minimum?: string;
    maximum?: string;
  };

  validationGoal: string;
  requiredCapabilities: string[];
  hardConstraints: string[];
  softPreferences: string[];
  recentTaskIds?: string[];

  sourceTaskRequestId: string;
  sourceStrategyId?: string;
};
```

本阶段不查题库，不调用 LLM，只把需求翻译清楚。

如果 `TaskRequest` 缺失关键字段，应输出 fulfillment blocked，不进入资源匹配。

## 七、Phase 8.4.2：任务资源匹配

只解决：

```text
TaskFulfillmentRequest
+ AvailableTaskResources
-> TaskResourceMatchResult
```

第一版使用 mock 任务资源即可。

例如：

```text
task_001
task_002
task_003
```

需要验证：

- 能否按 `taskRole` 匹配；
- 能否按 `targetAbilityId` 匹配；
- 能否满足难度偏好；
- 能否满足验证目标；
- 找不到合适资源时能否返回 `no_match`；
- 是否可以避免重复使用学生近期已经做过的任务。

建议输出：

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

本阶段不生成最终题目，只输出匹配结果。

### 硬约束与软偏好

资源匹配必须区分硬约束和软偏好。

硬约束不满足时，不能输出 `matched`。

软偏好不满足时，可以输出 `partial_match`，但默认不自动执行。

硬约束示例：

- `targetAbilityId` 必须匹配；
- `taskRole` 必须匹配；
- 必须支持指定 `responseMode`；
- 必须能验证 `validationGoal`；
- 必须覆盖核心 `requiredCapabilities`。

软偏好示例：

- 难度尽量相同；
- 文本体裁偏好；
- 推荐时长；
- 近期未使用；
- 内容来源偏好。

## 八、Phase 8.4.3：匹配结果分流

只解决：

```text
TaskResourceMatchResult
├─ matched -> ExecutableLearningTask
├─ partial_match -> blocked / review / TaskGenerationRequest
└─ no_match -> TaskGenerationRequest
```

只有 `matched` 可以自动输出 `ExecutableLearningTask`。

`partial_match` 默认不自动执行，应进入 review、blocked 或 `TaskGenerationRequest`。

`no_match` 输出 `TaskGenerationRequest`。

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

`TaskGenerationRequest` 的职责只是告诉未来的题目生成模块：

```text
需要生成什么样的任务。
```

它不自己生成题目。

## 九、ExecutableLearningTask 边界

`ExecutableLearningTask` 表示本轮可被下游执行模块消费的任务封装。

它不等于：

- 正式题目质量已合格；
- 已完成题库审核；
- 已证明教学有效；
- 已经可以长期复用。

它只表示：

```text
当前有一个任务资源或任务草案，
可以承接本次 TaskRequest 的验证目标，
并进入后续执行或人工检查流程。
```

建议最小结构：

```ts
type ExecutableLearningTask = {
  executableTaskId: string;
  studentId: string;

  sourceType: 'resource_match' | 'generated_candidate';
  sourceTaskId?: string;

  taskRole: string;
  targetAbilityId: string;
  validationGoal: string;

  contentRef: string;
  questionRef?: string;
  rubricRef?: string;

  sourceStrategyId?: string;
  sourceTaskRequestId: string;
  sourceFulfillmentRequestId: string;

  limitations: string[];
};
```

## 十、验收标准

Phase 8.4 通过条件：

1. 能读取合法 `TaskRequest`。
2. 能生成结构稳定的 `TaskFulfillmentRequest`。
3. 能使用 mock 任务资源完成匹配。
4. 能输出 `matched`、`partial_match` 或 `no_match`。
5. `matched` 时能输出 `ExecutableLearningTask`。
6. `partial_match` 时不自动输出 `ExecutableLearningTask`。
7. `no_match` 时能输出 `TaskGenerationRequest`。
8. 匹配失败时不伪造可执行任务。
9. 能保留 `sourceStrategyId` / `sourceTaskRequestId` / `sourceFulfillmentRequestId`。
10. 能保留 `validationGoal`。
11. 不生成具体题目内容。

## 十一、本阶段不包含

- 不直接调用真实 LLM 出题；
- 不建设大型题库；
- 不做 OCR 题目导入；
- 不做题目质量人工审核后台；
- 不执行学生作答；
- 不生成 DiagnosisResult；
- 不更新 Profile；
- 不制定多 Session 计划；
- 不验证题目实际教学效果。

## 十二、当前验收结果

PASS。

## 十三、通过依据

已完成最小工程闭环：

- `TaskFulfillmentRequest` schema；
- `TaskResourceMatchResult` schema；
- `ExecutableLearningTask` schema；
- `TaskGenerationRequest` schema；
- `taskFulfillmentRequestAgent`；
- `taskResourceMatchingAgent`；
- `taskFulfillmentBranchingAgent`；
- `debug:phase8-4-1`；
- `debug:phase8-4-2`；
- `debug:phase8-4-3`；
- `debug:phase8-4`。

当前验证结果：

```text
pnpm run debug:phase8-4-1  PASS
pnpm run debug:phase8-4-2  PASS
pnpm run debug:phase8-4-3  PASS
pnpm run debug:phase8-4    PASS
pnpm run build             PASS
```

已验证：

1. 合法 `TaskRequest` 可以生成 `TaskFulfillmentRequest`。
2. 无效 `TaskRequest` 会被 blocked，不进入资源匹配。
3. mock 资源可以输出 `matched`。
4. mock 资源可以输出 `partial_match`。
5. mock 资源可以输出 `no_match`。
6. `matched` 可以生成 `ExecutableLearningTask`。
7. `partial_match` 不会生成 `ExecutableLearningTask`。
8. `no_match` 可以生成 `TaskGenerationRequest`。
9. 来源追踪字段可以保留。

当前状态：

```text
代码 Debug 验收通过，Demo 人工验收通过。
```

Demo 接入：

```text
/#/phase84-task-fulfillment-demo
```

Demo 覆盖：

- `matched -> ExecutableLearningTask`
- `partial_match -> TaskGenerationRequest`
- `no_match -> TaskGenerationRequest`
- invalid `TaskRequest -> fulfillment blocked`

Demo 验收结果：

```text
PASS
```

Demo 验收依据：

1. 完全匹配 Case 能生成 `TaskFulfillmentRequest`。
2. 完全匹配 Case 能生成 `TaskResourceMatchResult`，状态为 `matched`。
3. 完全匹配 Case 能生成 `ExecutableLearningTask`，且不生成 `TaskGenerationRequest`。
4. 部分匹配 Case 不自动生成 `ExecutableLearningTask`，而是进入生成请求分支。
5. 无匹配 Case 能形成 `TaskGenerationRequest`。
6. 无效请求 Case 会被 blocked，不进入资源匹配。
7. Demo 页面能够展示 8.4 三段链路的关键中间对象。

## 十四、下一阶段

Phase 8.4 已完成 Debug、Build 和 Demo 人工验收。

本阶段冻结的最小闭环为：

```text
TaskRequest
-> TaskFulfillmentRequest
-> TaskResourceMatchResult
-> ExecutableLearningTask / TaskGenerationRequest
```

后续可以评估 Phase 8.5 或 Phase 9，进入真实任务资源管理、真实任务生成或真实学习任务执行。
