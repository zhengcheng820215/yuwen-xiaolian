# Phase 10.1：学习回合启动最小闭环（Learning Round Start）

## 一、阶段目标

Phase 10.1 只解决一个核心问题：

```text
系统能否从当前学生画像、成长记忆和学习上下文出发，
启动一轮学习，
并生成本轮可执行任务？
```

Phase 10.1 的一句话定义：

```text
将 StudentAbilityProfile、GrowthMemorySummary 和 CurrentLearningContext 编排为 NextLearningStrategy、TaskRequest、TaskFulfillment 和 ConcreteLearningTask，形成一轮学习的启动结果。
```

## 二、阶段背景

Phase 8 已经能够生成：

```text
NextLearningStrategy
TaskRequest
TaskFulfillmentRequest
TaskResourceMatchResult
ExecutableLearningTask / TaskGenerationRequest
```

Phase 9.1 已经能够将任务结果实例化为：

```text
ConcreteLearningTask
TaskReadinessValidation
```

Phase 10.1 不重新实现这些能力。

Phase 10.1 负责把它们串成一次学习回合的启动过程。

## 三、核心链路

Phase 10.1 的最小链路：

```text
StudentAbilityProfile
+ GrowthMemorySummary
+ CurrentLearningContext
↓
NextLearningStrategy
↓
StrategyValidationResult
↓
TaskRequest
↓
TaskFulfillmentRequest
↓
TaskResourceMatchResult
↓
ExecutableLearningTask / TaskGenerationRequest
↓
ConcreteLearningTask
↓
TaskReadinessValidation
↓
LearningRoundStartResult
```

Phase 10.1 证明：

```text
一轮学习可以被启动，
并且系统知道接下来让学生做什么。
```

## 四、输入

Phase 10.1 输入：

```text
StudentAbilityProfile
GrowthMemorySummary
CurrentLearningContext
AvailableTaskResource[]
```

说明：

- `StudentAbilityProfile` 提供当前能力状态；
- `GrowthMemorySummary` 提供近期成长记忆；
- `CurrentLearningContext` 提供当前学习场景；
- `AvailableTaskResource[]` 提供可匹配任务资源。

## 五、输出

Phase 10.1 输出：

```text
LearningRoundStartResult
```

建议最小结构：

```ts
type LearningRoundStartStatus =
  | 'ready_for_execution'
  | 'blocked'
  | 'review_required';

type LearningRoundStartResult = {
  learningRoundId: string;
  studentId: string;
  status: LearningRoundStartStatus;

  growthMemorySummary: GrowthMemorySummary;
  studentAbilityProfile: StudentAbilityProfile;
  currentLearningContext: CurrentLearningContext;

  nextLearningStrategy?: NextLearningStrategy;
  strategyValidationResult?: StrategyValidationResult;
  taskRequest?: TaskRequest;
  taskFulfillmentRequest?: TaskFulfillmentRequest;
  taskResourceMatchResult?: TaskResourceMatchResult;
  executableTask?: ExecutableLearningTask;
  taskGenerationRequest?: TaskGenerationRequest;
  concreteTask?: ConcreteLearningTask;
  taskReadinessValidation?: TaskReadinessValidation;

  nextAction:
    | 'start_task_execution'
    | 'regenerate_strategy'
    | 'regenerate_task'
    | 'human_review'
    | 'stop';

  issues: string[];
};
```

说明：

- `LearningRoundStartResult` 是 Phase 10.1 与 Phase 10.2 的交接对象。
- 当 `status = ready_for_execution` 时，Phase 10.2 可以开始任务执行。
- 当 `status != ready_for_execution` 时，不得创建正式任务执行 Session。
- 具体失败原因通过 `issues` 表达，不通过不断扩展状态枚举表达。

## 六、状态规则

### ready_for_execution

当以下条件全部满足：

```text
NextLearningStrategy 存在
StrategyValidationResult 通过
TaskRequest 存在
TaskFulfillment 成功
ConcreteLearningTask 存在
TaskReadinessValidation.canExecute = true
```

输出：

```text
status = ready_for_execution
nextAction = start_task_execution
```

### blocked

当任一关键步骤无法继续时：

```text
status = blocked
```

典型情况：

```text
无法生成策略
StrategyValidationResult 不通过
无法生成 TaskRequest
Task Fulfillment 无法得到可执行任务或生成请求
TaskReadinessValidation.canExecute = false
```

对应 `nextAction` 可为：

```text
regenerate_strategy
regenerate_task
human_review
stop
```

如果上一步失败，不得继续调用下游步骤。

### review_required

当系统发现状态冲突、ID 不一致或策略与当前上下文存在风险但不能自动处理时：

```text
status = review_required
nextAction = human_review
```

不得进入 Phase 10.2。

## 七、编排规则

Phase 10.1 必须遵守以下规则：

1. 不跳过 Strategy Validation。
2. 不跳过 Task Fulfillment。
3. 不跳过 TaskReadinessValidation。
4. 不直接手写 ConcreteLearningTask 绕过 Phase 9.1。
5. 如果上一步失败，不得继续调用下游步骤。
6. 所有 ID 必须保留可追溯关系。
7. `learningRoundId` 必须贯穿本轮启动结果，并传递给后续 Phase 10.2 / 10.3。
8. `studentId` 必须在所有主要对象中保持一致。
9. `targetAbility` 必须来自 Strategy / TaskRequest / ConcreteLearningTask 的一致链路。
10. `LearningRoundStartResult.status` 必须能解释当前是否可以进入 Phase 10.2。
11. Orchestrator 不得自行生成替代策略、替代任务、替代 Evidence 或默认 Profile 状态。

## 八、ID 与追溯要求

Phase 10.1 至少需要保留：

- `learningRoundId`
- `studentId`
- `strategyId`
- `taskRequestId`
- `fulfillmentRequestId`
- `taskResourceMatchResult` 相关信息
- `executableTaskId` 或 `taskGenerationRequestId`
- `concreteTaskId`

追溯目标：

```text
后续 Phase 10.2 / 10.3 能知道：
本轮任务为什么被选择，
来自哪条策略，
对应哪个能力目标，
是否经过可执行性校验。
```

## 九、Debug Case

Phase 10.1 Debug 至少覆盖以下 5 类 Case。

### Case 1：正常启动

```text
Profile + GrowthMemory + Context
-> Strategy
-> TaskRequest
-> TaskFulfillment
-> ConcreteLearningTask
-> ready_for_execution
```

预期：

```text
status = ready_for_execution
nextAction = start_task_execution
concreteTask 存在
taskReadinessValidation.canExecute = true
```

### Case 2：策略无法生成

```text
输入缺少有效 Profile 或 GrowthMemory
```

预期：

```text
status = blocked
不生成 TaskRequest
不生成 ConcreteLearningTask
```

### Case 3：策略校验失败

```text
NextLearningStrategy 与 CurrentLearningContext 冲突
```

预期：

```text
status = blocked
不生成 TaskRequest
```

### Case 4：无可用任务

```text
TaskRequest 存在
但 TaskFulfillment 无法匹配资源或生成请求
```

预期：

```text
status = blocked
不进入任务执行
```

### Case 5：任务不可执行

```text
ConcreteLearningTask 存在
但 TaskReadinessValidation.canExecute = false
```

预期：

```text
status = blocked
不进入 Phase 10.2
```

## 十、Debug Report

Debug Report 至少展示：

- caseId；
- learningRoundId；
- studentId；
- currentWeakness；
- growthMemorySummary；
- nextLearningStrategy.action；
- strategyValidationResult.status；
- taskRequestId；
- fulfillmentRequestId；
- matchStatus；
- executableTaskId / taskGenerationRequestId；
- concreteTaskId；
- taskReadinessValidation.canExecute；
- final status；
- nextAction；
- issues；
- PASS / FAIL。

## 十一、验收标准

Phase 10.1 通过条件：

1. 能读取 `StudentAbilityProfile`。
2. 能读取 `GrowthMemorySummary`。
3. 能读取 `CurrentLearningContext`。
4. 能生成或消费 `NextLearningStrategy`。
5. 能生成 `StrategyValidationResult`。
6. 能生成 `TaskRequest`。
7. 能生成 `TaskFulfillmentRequest`。
8. 能生成 `TaskResourceMatchResult`。
9. 能生成 `ExecutableLearningTask` 或 `TaskGenerationRequest`。
10. 能生成 `ConcreteLearningTask`。
11. 能生成 `TaskReadinessValidation`。
12. 能输出 `LearningRoundStartResult`。
13. `LearningRoundStartResult.learningRoundId` 非空。
14. `LearningRoundStartResult.studentId` 非空。
15. 正常 Case 输出 `status = ready_for_execution`。
16. `status = ready_for_execution` 时 `nextAction = start_task_execution`。
17. `status = ready_for_execution` 时 `ConcreteLearningTask` 存在。
18. `status = ready_for_execution` 时 `TaskReadinessValidation.canExecute = true`。
19. 失败 Case 不继续调用下游步骤。
20. 失败 Case 通过 `issues` 说明具体阻断原因。
21. Orchestrator 不补造缺失的下游对象。
22. Debug 覆盖 5 类 Case。
23. Debug 输出 PASS。
24. Build 通过。

## 十二、本阶段不做

Phase 10.1 不做：

- 不接收学生答案；
- 不创建 TaskExecutionSession；
- 不生成 StudentResponse；
- 不生成 TaskExecutionResult；
- 不调用 Diagnosis Runtime；
- 不生成 AbilityEvidence；
- 不更新 GrowthMemory；
- 不生成 LearningRoundResult；
- 不做正式 UI；
- 不接数据库；
- 不做长期报告。

## 十三、与 Phase 10.2 的关系

Phase 10.1 输出：

```text
LearningRoundStartResult
```

Phase 10.2 消费：

```text
LearningRoundStartResult
+ StudentResponse
```

如果：

```text
LearningRoundStartResult.status != ready_for_execution
```

则 Phase 10.2 不得开始。

## 十四、最终结论

Phase 10.1 是学习回合的启动节点。

它不负责学生作答，也不负责证据回流。

它只负责证明：

```text
系统能够从当前学生状态出发，
生成本轮学习策略，
准备可执行任务，
并明确是否可以进入任务执行阶段。
```

Phase 10.1 完成后，系统将具备：

```text
开始一轮学习
-> 决定做什么
-> 准备可执行任务
```

的最小编排能力。

## 十五、工程验收记录

验收时间：2026-07-13

验收结论：PASS

已完成文件：

- `src/ai/schemas/learningRound.schema.ts`
- `src/ai/agents/learningRoundStartAgent.ts`
- `src/ai/tests/runLearningRoundStartDebug.ts`
- `package.json` 中新增 `debug:phase10-1`

Debug 覆盖 Case：

1. 正常启动，输出 `ready_for_execution`。
2. 成长记忆不足，阻断在策略生成前。
3. 策略校验失败，不生成 `TaskRequest`。
4. 任务履约无法得到任务，输出 `regenerate_task`。
5. 任务不可执行，输出 `TaskReadinessValidation` 问题。
6. `studentId` 不一致，输出 `review_required`。

验收命令：

```bash
pnpm run debug:phase10-1
pnpm run build
```

验收结果：

```text
debug:phase10-1 PASS
build PASS
```

本次工程实现只完成 Phase 10.1 Learning Round Start。

本阶段仍不接收学生答案、不创建任务执行 Session、不调用 Diagnosis Runtime、不生成 Evidence、不更新 GrowthMemory。
