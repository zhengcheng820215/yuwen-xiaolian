# Phase 10：学习回合编排最小闭环（Learning Round Orchestration）

## 一、阶段定位

Phase 10 的目标是把 Phase 8 的策略链和 Phase 9 的任务执行链串成一次可连续运行、可结束、可产生下一步结果的真实学习回合。

Phase 8 已经完成：

```text
GrowthMemorySummary
-> NextLearningStrategy
-> StrategyValidationResult
-> TaskRequest
-> TaskFulfillment
```

Phase 9 已经完成：

```text
ConcreteLearningTask
-> TaskExecutionResult
-> DiagnosisResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
```

Phase 10 不重新定义这些能力。

Phase 10 负责把它们编排成一个完整学习回合。

## 二、Round / Session 命名边界

Phase 10 使用 `LearningRound` 作为核心编排单位。

```text
LearningRound = 一次从策略生成到证据回流的最小学习回合。

LearningSession = 用户一次进入产品后的学习过程，未来可以包含一个或多个 LearningRound。
```

本阶段只做 `LearningRound Orchestration`。

已有对象中：

- `LearningSessionMemory` 记录阶段性学习记忆；
- `TaskExecutionSession` 记录一次任务执行过程；
- `LearningRoundResult` 记录一次完整学习回合的运行结果。

三者不得混用。

## 三、一句话定义

Phase 10 是学习回合编排最小闭环。

它验证系统能否从当前成长记忆和学生画像出发，自动生成策略、准备任务、接收作答、回流证据，并在回合结束后输出新的成长记忆和流程下一步。

## 四、核心问题

Phase 10 只回答一个核心问题：

```text
系统能否从当前成长记忆出发，
自动完成一次完整学习回合，
并在回合结束后生成新的成长记忆和下一步方向？
```

Phase 10 不是新增能力判断模型。

Phase 10 是 Runtime Orchestration 层。

## 五、完整目标链路

Phase 10 的完整目标链路：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
↓
NextLearningStrategy
↓
StrategyValidationResult
↓
TaskRequest
↓
TaskFulfillment
↓
ConcreteLearningTask
↓
TaskExecutionSession
↓
StudentResponse
↓
TaskExecutionResult
↓
TaskEvidenceReturnResult
↓
Updated GrowthMemory
↓
LearningRoundResult.nextStep
```

这条链路第一次证明：

```text
一个学习回合能从起点走到终点。
```

## 六、与 Phase 8 / Phase 9 的分界

### Phase 8

Phase 8 负责：

```text
判断下一步学什么，并准备任务资源。
```

核心职责：

- 评估 Evidence；
- 更新 Profile 决策；
- 形成 GrowthMemory；
- 生成 NextLearningStrategy；
- 生成 TaskRequest；
- 匹配或请求任务资源。

### Phase 9

Phase 9 负责：

```text
让学生完成任务，并把结果回流为 Evidence。
```

核心职责：

- 实例化任务；
- 接收学生作答；
- 判断作答有效性；
- 将有效作答接入 Diagnosis；
- 生成 AbilityEvidence；
- 回流 Existing Phase 8 Runtime。

### Phase 10

Phase 10 负责：

```text
编排 Phase 8 和 Phase 9，形成一个完整学习回合。
```

Phase 10 不替代 Phase 8。

Phase 10 不替代 Phase 9。

Phase 10 只负责：

```text
把上游输出交给下游，
保留上下文，
控制状态，
处理阻断，
输出本轮结果。
```

### NextStep 与 NextLearningStrategy 的边界

Phase 10 的 `nextStep` 只表示运行流转动作。

例如：

```text
continue
retry
supplement_response
regenerate_task
human_review
stop
```

`nextStep` 不决定：

- 下一轮训练哪项能力；
- 是否进入迁移；
- 是否降低难度；
- 是否做独立复测；
- 下一轮具体教学策略。

这些教育策略仍然由下一轮 Phase 8.3 的 `NextLearningStrategy` 生成。

正确关系是：

```text
LearningRoundResult.nextStep = continue
↓
重新生成或读取 GrowthMemorySummary
↓
进入 Phase 8.3
↓
生成新的 NextLearningStrategy
```

Phase 10 不得直接生成下一轮教育策略。

### Orchestrator 不补造数据原则

Phase 10 是编排层，不是兜底生成层。

当下游所需对象缺失或校验失败时，Orchestrator 必须阻断并返回明确问题。

Phase 10 不得自行生成：

- 替代策略；
- 替代任务；
- 替代 Evidence；
- 默认 Profile 状态；
- 默认 GrowthMemory；
- 伪造的 DiagnosisResult。

## 七、阶段拆分

Phase 10 拆为三个最小闭环。

| 阶段 | 核心问题 | 输入 | 输出 |
| --- | --- | --- | --- |
| Phase 10.1 | 一轮学习能否被启动，并生成可执行任务 | StudentAbilityProfile / GrowthMemorySummary / CurrentLearningContext | LearningRoundStartResult |
| Phase 10.2 | 学生完成任务后，能否形成一轮执行结果 | LearningRoundStartResult + StudentResponse | LearningRoundExecutionResult |
| Phase 10.3 | 一轮结束后，能否形成回合结论和下一步方向 | LearningRoundExecutionResult + Updated GrowthMemory | LearningRoundResult |

Phase 10 不再继续拆分 10.1.1、10.1.2 等更细阶段。

如果需要说明内部步骤，应写在对应 Phase 文档中，不新增更细 Phase 文件。

## 八、Phase 10.1：Learning Round Start

Phase 10.1 只解决：

```text
StudentAbilityProfile
+ GrowthMemorySummary
+ CurrentLearningContext
↓
NextLearningStrategy
↓
TaskRequest
↓
TaskFulfillment
↓
ConcreteLearningTask
↓
LearningRoundStartResult
```

它证明：

```text
系统能够启动一轮学习，并知道接下来让学生做什么。
```

Phase 10.1 不接收学生答案，不执行任务，不生成 Evidence。

## 九、Phase 10.2：Learning Round Execution

Phase 10.2 只解决：

```text
LearningRoundStartResult
+ StudentResponse
↓
TaskExecutionResult
↓
LearningRoundExecutionResult
```

它证明：

```text
学生作答可以在一轮学习上下文中执行，
并判断是否具备进入 Evidence 回流的条件。
```

Phase 10.2 不重新生成策略，不重新创建任务。

Phase 10.2 不调用 Diagnosis Runtime，不生成 AbilityEvidence，不更新 GrowthMemory。

## 十、Phase 10.3：Learning Round Completion

Phase 10.3 只解决：

```text
LearningRoundExecutionResult
↓
TaskEvidenceReturnResult
↓
Updated GrowthMemory
↓
LearningRoundResult
↓
LearningRoundResult.nextStep
↓
Next Round Input
```

它证明：

```text
一轮学习可以结束，并为下一轮提供明确输入。
```

Phase 10.3 不做长期报告，不做多天计划。

## 十一、核心数据对象

Phase 10 至少涉及以下对象：

- `StudentAbilityProfile`
- `GrowthMemorySummary`
- `CurrentLearningContext`
- `NextLearningStrategy`
- `StrategyValidationResult`
- `TaskRequest`
- `TaskFulfillmentRequest`
- `TaskResourceMatchResult`
- `ExecutableLearningTask`
- `TaskGenerationRequest`
- `ConcreteLearningTask`
- `TaskExecutionResult`
- `TaskEvidenceReturnResult`
- `GrowthMemoryRecord`
- `LearningRoundStartResult`
- `LearningRoundExecutionResult`
- `LearningRoundResult`

其中：

```text
LearningRoundResult 是一次学习回合的最终运行结果。
```

它不判断能力，只记录一轮学习是否完成、停在哪里、下一步应该做什么。

## 十二、建议状态模型

### LearningRoundStartResult

```ts
type LearningRoundStartStatus =
  | 'ready_for_execution'
  | 'blocked'
  | 'review_required';

type LearningRoundStartResult = {
  learningRoundId: string;
  studentId: string;
  status: LearningRoundStartStatus;
  strategy?: NextLearningStrategy;
  taskRequest?: TaskRequest;
  concreteLearningTask?: ConcreteLearningTask;
  taskReadinessValidation?: TaskReadinessValidation;
  issues: string[];
};
```

### LearningRoundExecutionResult

```ts
type LearningRoundExecutionStatus =
  | 'evidence_returned'
  | 'retry_required'
  | 'blocked'
  | 'review_required'
  | 'abandoned';

type LearningRoundExecutionResult = {
  learningRoundId: string;
  studentId: string;
  status: LearningRoundExecutionStatus;
  taskExecutionResult?: TaskExecutionResult;
  taskEvidenceReturnResult?: TaskEvidenceReturnResult;
  issues: string[];
};
```

### LearningRoundResult

`LearningRoundResult` 可以使用以下状态：

```ts
type LearningRoundStatus =
  | 'completed'
  | 'blocked'
  | 'retry_required'
  | 'review_required'
  | 'abandoned';
```

建议下一步方向：

```ts
type LearningRoundNextStep =
  | 'continue'
  | 'supplement_response'
  | 'regenerate_task'
  | 'human_review'
  | 'stop';
```

这里的 `nextStep` 仍然只是流程动作，不是新的教学策略对象。

`retest` 不作为 Phase 10 的 `nextStep`。如果下一轮需要复测，应由新的 `GrowthMemorySummary` 进入 Phase 8.3 后生成 `independent_retest`、`transfer_test` 或 `maintenance_validation` 等策略。

这些状态是后续 UI 的主要消费入口。

页面不需要理解所有底层 Agent，只需要消费：

```text
LearningRoundResult.status
LearningRoundResult.nextStep
LearningRoundResult.issues
```

## 十三、learningRoundId 全链路追踪

Phase 10 必须引入：

```ts
learningRoundId: string;
```

`learningRoundId` 至少出现在：

- `LearningRoundStartResult`
- `LearningRoundExecutionResult`
- `LearningRoundResult`

必要时应传入或关联：

- `TaskExecutionSession`
- `TaskEvidenceReturnResult`
- `GrowthMemoryRecord`

追踪目标：

```text
系统必须能够回答：
这条 Evidence 属于哪一轮学习？
这个 TaskExecutionResult 属于哪一轮学习？
这个 GrowthMemoryRecord 来自哪一轮回合？
```

## 十四、Phase 10 最小验收目标

Phase 10 完成时，系统应能证明：

1. 能从 `GrowthMemorySummary` 和 `StudentAbilityProfile` 启动一轮学习。
2. 能生成 `NextLearningStrategy`。
3. 能生成 `TaskRequest`。
4. 能完成 Task Fulfillment。
5. 能生成 `ConcreteLearningTask`。
6. 能接收学生作答。
7. 能生成 `TaskExecutionResult`。
8. 能生成 `TaskEvidenceReturnResult`。
9. 能生成新的 `GrowthMemoryRecord`。
10. 能输出 `LearningRoundResult`。
11. 能输出明确 `nextStep`。
12. 能处理任务不可执行。
13. 能处理无效作答。
14. 能处理 Diagnosis 失败。
15. 能处理能力不一致。
16. 能证明一轮完成后可作为下一轮输入。
17. `learningRoundId` 能贯穿 Start / Execution / Result。
18. `nextStep` 不替代 `NextLearningStrategy`。
19. 编排层不会补造缺失的下游数据。
20. Debug 可以重复运行并输出 PASS / FAIL。
21. Build 可以通过。

## 十五、Debug Case

Phase 10 最终至少需要覆盖以下 Case：

1. 正常完整回合：输出 `completed`，生成 GrowthMemory 更新，`nextStep = continue`。
2. 策略校验失败：输出 `blocked`，不进入 Task Fulfillment。
3. 任务资源不足：输出 `regenerate_task`，不创建执行 Session。
4. TaskReadiness 失败：输出 `blocked`。
5. 无效作答：输出 `retry_required / supplement_response`，不进入 Diagnosis。
6. Diagnosis 失败：输出 `review_required`，不生成正式 Evidence。
7. 能力不一致：输出 `review_required`，不直接更新目标能力。
8. 成功回流后重新读取 GrowthMemory，证明本轮输出可以作为下一轮 Phase 8 输入。

其中 Case 8 是 Phase 10 成立的关键。

它证明：

```text
本轮输出
-> 下一轮输入
```

## 十六、本阶段不做

Phase 10 不做：

- 不做正式学习页面；
- 不做多天计划；
- 不接数据库；
- 不做大型题库；
- 不做家长报告；
- 不做自动 LLM 出题；
- 不做完整学生账号；
- 不做长期成长曲线；
- 不重写 Phase 8；
- 不重写 Phase 9；
- 不证明长期学习效果。

## 十七、阶段能力表述

Phase 10 完成后，可以宣称：

```text
系统能够将策略生成、任务准备、任务执行和证据回流编排成一次可连续运行、可结束、可输出下一步方向的学习回合。
```

Phase 10 完成后，不能宣称：

- 已形成正式学生产品；
- 已具备完整日常学习体验；
- 已证明任务策略有效；
- 已证明学生能力长期提升；
- 已完成多轮长期学习系统。

## 十八、最终结论

Phase 10 是从“模块可运行”走向“学习回合可运行”的关键阶段。

它不新增能力模型。

它新增的是：

```text
Orchestration 能力。
```

完成 Phase 10 后，系统将第一次具备：

```text
从成长记忆出发，
生成策略，
准备任务，
完成执行，
回流证据，
形成下一步方向
```

的一轮完整学习 Runtime。
