# Phase 12.3：连续多轮学习运行最小闭环（Continuous Multi-Round Learning）

## 一、阶段目标

Phase 12.3 只解决一个核心问题：

```text
上一轮学习的正式结果，能否经过保存与恢复，真实驱动下一轮学习？
```

Phase 12.3 的一句话定义：

```text
复用已有 GrowthMemory、策略、任务、LearningRound 与持久化模块，连续运行 2 至 3 个学习回合，并证明每一轮的正式结果都成为下一轮可追溯的输入。
```

Phase 12.3 不新增教育判断能力。

它是一个编排与连续运行闭环。

## 二、阶段背景

Phase 12.1 已经证明：

```text
LearningRound 正式结果可以保存、恢复，
并且恢复不会重复提交、重复生成 Evidence 或重复更新 Profile。
```

Phase 12.2 已经证明：

```text
真实题目可以被录入为 TaskResource，
并通过既有 TaskFulfillment 生成 ConcreteLearningTask。
```

Phase 10 已经证明单个 LearningRound 可以从策略运行到 Evidence 回流。

Phase 11 已经证明学生可以独立完成一轮学习体验。

Phase 12.3 需要把这些能力连接起来：

```text
上一轮结果
-> 正式保存
-> 恢复 GrowthMemory / Profile
-> 生成下一轮策略
-> 获取下一道真实任务
-> 完成下一轮
```

## 三、核心问题

Phase 12.3 必须回答：

1. Round 1 的正式结果是否被保存；
2. 保存后的 GrowthMemory / Profile 是否成为 Round 2 的输入；
3. Round 2 的 `NextLearningStrategy` 是否来自恢复后的正式状态；
4. Round 2 的任务是否通过现有 `TaskFulfillment` 获得；
5. Round 2 完成后是否再次产生 Evidence 与 GrowthMemory；
6. 系统能否继续 Round 3，或按照正式状态正常结束；
7. 刷新、恢复或重试是否会造成重复回合、重复 Evidence 或重复 GrowthMemory。

## 四、最小核心链路

Phase 12.3 的最小链路：

```text
RestoredLearningState
+ GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
+ TaskResource[]
↓
Round 1 / 已完成 Round
↓
LearningRoundResult
+ TaskEvidenceReturnResult
+ GrowthMemoryRecord
↓
LearningPersistenceRepository.save
↓
LearningPersistenceRepository.restore
↓
重新生成 GrowthMemorySummary
↓
Phase 8 NextLearningStrategy
↓
TaskRequest
↓
TaskFulfillment
↓
Round 2 ConcreteLearningTask
↓
Round 2 执行与 Evidence 回流
↓
保存并恢复
↓
Round 3 或正常结束
```

Phase 12.3 证明的是：

```text
本轮输出
可以成为
下一轮输入。
```

## 五、连续多轮的定义

连续完成多道固定题，不等于连续学习 Runtime 成立。

Phase 12.3 中的“连续多轮”必须同时满足：

1. 每一轮都有唯一 `learningRoundId`；
2. 每一轮都通过现有 LearningRound Runtime 启动、执行和完成；
3. 完成轮产生正式 `TaskEvidenceReturnResult`；
4. 完成轮产生正式 `GrowthMemoryRecord`；
5. 完成轮被保存为 `LearningPersistenceRecord`；
6. 下一轮从 Repository 恢复正式状态；
7. 下一轮策略由恢复后的 `GrowthMemorySummary` 生成；
8. 下一轮任务由该策略生成的 `TaskRequest` 进入 `TaskFulfillment` 后获得；
9. 轮次之间存在可验证的 ID 与数据追溯关系。

如果 Round 2 仍训练同一能力，也可以通过。

但必须能够说明：

```text
继续同一能力
是上一轮 GrowthMemory 经过策略规则后的正式结果，
不是页面或 Debug 继续使用固定 Mock。
```

## 六、Round 与 Session 的边界

Phase 12.3 延续 Phase 10 的定义：

```text
LearningRound
= 一次策略到 Evidence 回流的最小学习回合
```

```text
ContinuousLearningRun
= 同一学生在一个连续运行过程中完成的 2 至 3 个 LearningRound
```

Phase 12.3 不重新定义 `LearningSessionMemory`。

`ContinuousLearningRun` 只描述多轮运行与轮次交接，不生成新的长期能力结论。

## 七、输入

Phase 12.3 输入：

```text
studentId
RestoredLearningState
GrowthMemoryRecord[]
GrowthMemorySummary
StudentAbilityProfile
CurrentLearningContext
TaskResource[]
maxRounds
```

第一版规则：

- `maxRounds` 最小为 2，最大为 3；
- Debug 可以注入每一轮的学生答案；
- Demo 可以由学生逐轮输入答案；
- 学生答案不能由连续运行 Agent 自动伪造；
- 正式任务必须来自 Phase 12.2 的合法资源或既有可执行资源；
- 输入中的 `studentId` 必须在所有正式对象中保持一致。

建议最小输入结构：

```ts
type ContinuousLearningRunInput = {
  runId?: string;
  studentId: string;

  restoredLearningState: RestoredLearningState;
  growthMemoryRecords: GrowthMemoryRecord[];
  growthMemorySummary: GrowthMemorySummary;
  studentAbilityProfile: StudentAbilityProfile;
  currentLearningContext: CurrentLearningContext;

  availableTaskResources: TaskResource[];
  maxRounds: 2 | 3;
};
```

说明：

- Repository 属于运行依赖，不作为需要序列化的业务字段塞入输入对象；
- 学生答案在每一轮执行时单独提交；
- `restoredLearningState` 必须通过 Phase 12.1 的版本与身份校验；
- `TaskResource` 必须通过 Phase 12.2 的正式资源校验。

## 八、核心新增对象

Phase 12.3 建议新增两个最小对象：

```text
LearningRoundTransition
ContinuousLearningRunResult
```

### 8.1 LearningRoundTransition

`LearningRoundTransition` 用于证明上一轮如何成为下一轮输入。

建议最小结构：

```ts
type LearningRoundTransition = {
  transitionId: string;
  studentId: string;

  fromLearningRoundId: string;
  fromPersistenceRecordId: string;
  fromGrowthMemoryRecordIds: string[];
  fromGrowthMemorySummaryLatestRecordId?: string;

  toLearningRoundId: string;
  nextLearningStrategyId: string;
  taskRequestId: string;
  concreteTaskId: string;
  targetAbilityId: string;

  sourceStrategyAction: NextLearningStrategy['action'];
  sourceTaskRole: TaskRequest['taskRole'];

  transitionType:
    | 'continue_same_ability'
    | 'retest'
    | 'transfer'
    | 'diagnostic_verification'
    | 'collect_more_evidence'
    | 'switch_ability';

  traceable: boolean;
  issues: string[];
};
```

说明：

- `fromLearningRoundId` 是上一轮；
- `toLearningRoundId` 是下一轮；
- `fromPersistenceRecordId` 证明下一轮读取了正式保存记录；
- `fromGrowthMemoryRecordIds` 证明策略基于正式 GrowthMemory；
- `nextLearningStrategyId`、`taskRequestId` 和 `concreteTaskId` 证明策略到任务链路完整；
- `sourceStrategyAction` 与 `sourceTaskRole` 保留正式策略来源；
- `transitionType` 只描述轮次衔接类型，不重新判断教育策略；
- `transitionType` 必须由 `NextLearningStrategy.action` 与 `TaskRequest.taskRole` 映射得到，Orchestrator 不得仅根据前后 `targetAbilityId` 自行推断。

### 8.2 ContinuousLearningRunResult

建议最小结构：

```ts
type ContinuousLearningRunStatus =
  | 'completed'
  | 'stopped'
  | 'blocked'
  | 'retry_required'
  | 'review_required';

type ContinuousLearningRunEndReason =
  | 'max_rounds_reached'
  | 'runtime_stop'
  | 'student_stopped'
  | 'no_available_task'
  | 'response_retry_required'
  | 'review_required'
  | 'persistence_failed'
  | 'blocked';

type ContinuousLearningRoundPersistenceStatus =
  | 'not_started'
  | 'saved'
  | 'retry_required'
  | 'failed';

type ContinuousLearningRoundSnapshot = {
  roundIndex: number;
  learningRoundId: string;
  status: LearningRoundResult['status'];

  strategyId?: string;
  taskRequestId?: string;
  concreteTaskId?: string;
  targetAbilityId?: string;

  evidenceIds: string[];
  growthMemoryRecordId?: string;
  persistenceRecordId?: string;
  persistenceStatus: ContinuousLearningRoundPersistenceStatus;

  nextStep: LearningRoundResult['nextStep'];
  issues: string[];
};

type ContinuousLearningRunResult = {
  runId: string;
  studentId: string;
  startedAt: string;
  endedAt?: string;

  status: ContinuousLearningRunStatus;
  endReason: ContinuousLearningRunEndReason;
  maxRounds: 2 | 3;
  completedRoundCount: number;

  rounds: ContinuousLearningRoundSnapshot[];
  transitions: LearningRoundTransition[];

  latestGrowthMemorySummary?: GrowthMemorySummary;
  latestStudentAbilityProfile?: StudentAbilityProfile;
  latestPersistenceRecordId?: string;

  nextStep:
    | 'continue_next_round'
    | 'supplement_response'
    | 'regenerate_task'
    | 'human_review'
    | 'finish_run';

  nextStepReason: string;

  validation: {
    passed: boolean;
    noDuplicateRoundIds: boolean;
    noDuplicateEvidenceIds: boolean;
    transitionsTraceable: boolean;
    persistedBetweenRounds: boolean;
    studentIdConsistent: boolean;
    issues: string[];
  };
};
```

`ContinuousLearningRunResult` 是运行摘要。

其中：

- `status` 描述连续运行在工程层是否正常完成、停止、阻断、需要重试或需要复核；
- `endReason` 描述本次连续运行为什么结束；
- `status = completed` 只表示本次计划内的多轮 Runtime 正常完成；
- `endReason = max_rounds_reached` 只表示达到本次最多轮数，不代表训练目标已经完成，也不代表学生能力已经提升或掌握。

它不替代：

- `LearningRoundResult`；
- `GrowthMemoryRecord`；
- `GrowthMemorySummary`；
- `StudentAbilityProfile`；
- `NextLearningStrategy`。

## 九、轮次交接规则

从 Round N 进入 Round N+1 时，必须按以下顺序执行：

1. Round N 的 `LearningRoundResult.status` 必须为 `completed`；
2. `TaskEvidenceReturnResult.status` 必须为 `evidence_returned`；
3. 必须存在合法 `AbilityEvidence`；
4. 必须存在 `EvaluationResult`；
5. 必须存在 `ProfileUpdateDecision`；
6. 必须存在 `GrowthMemoryRecord`；
7. Round N 正式结果必须保存到 Repository；
8. 保存成功后必须恢复并校验 `RestoredLearningState`；
9. 基于正式 `GrowthMemoryRecord[]` 重新生成 `GrowthMemorySummary`；
10. 使用恢复后的 Profile、Memory 和 Context 进入 Phase 8.3；
11. 生成新的 `NextLearningStrategy`；
12. 生成新的 `TaskRequest`；
13. 通过 `TaskFulfillment` 获取新的 `ConcreteLearningTask`；
14. 生成 `LearningRoundTransition`；
15. 只有 `transition.traceable = true` 时才能启动下一轮。

Orchestrator 不得：

- 自己补造 GrowthMemory；
- 自己决定目标能力；
- 自己生成替代任务；
- 跳过保存和恢复步骤；
- 直接复用上一轮固定 Mock 策略；
- 在缺少正式结果时强行启动下一轮。

## 十、策略边界

Phase 12.3 不决定下一轮“学什么”。

下一轮教育策略仍由现有 Phase 8.3 生成：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
↓
NextLearningStrategy
```

Phase 12.3 只负责：

- 准备经过恢复的正式输入；
- 调用已有策略链；
- 记录策略与上一轮结果的关联；
- 根据已有流程状态决定继续、重试、复核或结束。

`ContinuousLearningRunResult.nextStep` 是运行流程动作。

它不替代 `NextLearningStrategy` 的教育决策。

### Transition Type 映射规则

`LearningRoundTransition.transitionType` 必须从已有正式策略对象映射。

建议映射顺序：

```text
NextLearningStrategy.action = switch_ability
-> switch_ability

TaskRequest.taskRole = retest
-> retest

TaskRequest.taskRole = transfer
-> transfer

NextLearningStrategy.action = diagnostic_verification
或 TaskRequest.taskRole = diagnosis
-> diagnostic_verification

NextLearningStrategy.action = collect_more_evidence
或 TaskRequest.taskRole = observation
-> collect_more_evidence

NextLearningStrategy.action = continue_training
或 lower_difficulty_training
-> continue_same_ability
```

如果 Strategy 与 TaskRequest 无法得到一致映射：

```text
transition.traceable = false
-> review_required
-> 不启动下一轮
```

同一能力可能对应训练、复测、迁移或观察。

因此不得使用以下简化规则：

```text
前后 targetAbilityId 相同
-> 自动认定 continue_same_ability
```

## 十一、任务资源规则

每一轮任务必须进入现有任务链：

```text
NextLearningStrategy
↓
TaskRequest
↓
TaskFulfillmentRequest
↓
TaskResourceMatchResult
↓
ConcreteLearningTask
↓
TaskReadinessValidation
```

规则：

1. 不得由页面直接拼接下一轮题目；
2. 不得绕过 `TaskFulfillment`；
3. `ConcreteLearningTask.studentId` 必须与运行学生一致；
4. `ConcreteLearningTask.targetAbilityId` 必须与策略目标一致；
5. 任务必须通过 readiness；
6. 最近使用过的任务 ID 应进入资源匹配排除条件；
7. 资源不足时应输出 `regenerate_task` 或 `blocked`，不得重复展示残缺任务；
8. 使用相同能力时，下一轮仍应使用新任务或新的验证情境。

## 十二、持久化与幂等规则

Phase 12.3 必须复用 Phase 12.1 的 Repository。

每个完成轮至少保存：

- `learningRoundId`；
- `LearningRoundResult`；
- `ConcreteLearningTask`；
- `StudentResponse`；
- `StudentLearningFeedback`；
- `StudentRoundSummary`；
- `GrowthMemoryRecord`；
- `GrowthMemorySummary`；
- `StudentAbilityProfile`。

幂等规则：

1. 同一 `learningRoundId` 不得因恢复重新启动；
2. 同一 `responseId` 不得重复提交；
3. 同一 Evidence ID 不得重复进入正式 Evidence 集合；
4. 同一 `GrowthMemoryRecord.recordId` 不得重复写入；
5. 同一完成结果不得重复更新 Profile；
6. 恢复后应从已保存状态继续，不重新运行已完成的 Diagnosis；
7. 版本不兼容或数据损坏时必须阻断下一轮；
8. 保存失败时不得宣称本轮已经具备连续运行条件。

### 保存事务失败规则

如果 Round N 的 Runtime 已经完成，但 Repository 保存失败：

```text
保留 Round N 已生成的正式 Runtime 结果
↓
ContinuousLearningRunResult.status = retry_required
ContinuousLearningRunResult.endReason = persistence_failed
RoundSnapshot.persistenceStatus = retry_required
↓
不启动 Round N+1
↓
只重试持久化
```

重试持久化时不得重新执行：

- StudentResponse 提交；
- Response Validity；
- Diagnosis；
- AbilityEvidence 生成；
- Evaluation；
- ProfileUpdateDecision；
- Profile 更新；
- GrowthMemoryRecord 生成。

保存重试必须使用同一份已经完成的正式 Runtime 结果和相同业务 ID。

持久化成功后：

```text
RoundSnapshot.persistenceStatus = saved
↓
执行 Restore Validation
↓
允许生成 Round N+1
```

## 十三、停止与异常分支

连续运行不等于无限自动运行。

第一版最多运行 3 轮。

### 正常继续

```text
Round completed
+ Persistence saved
+ Restored state valid
+ LearningRoundResult.nextStep = continue
↓
生成下一轮策略
```

### 正常结束

满足以下任一条件时可以结束：

- 已达到 `maxRounds`；
- 现有 Runtime 返回 `stop`；
- 当前策略要求人工复核；
- 当前没有安全可执行的下一轮任务；
- 学生主动结束连续学习。

结束时必须同时记录 `status` 与 `endReason`。

建议最小对应关系：

```text
完成计划轮数
-> status = completed
-> endReason = max_rounds_reached

Runtime 正常要求停止
-> status = stopped
-> endReason = runtime_stop

学生主动停止
-> status = stopped
-> endReason = student_stopped

没有可执行任务
-> status = blocked
-> endReason = no_available_task

需要人工复核
-> status = review_required
-> endReason = review_required

持久化失败且可重试
-> status = retry_required
-> endReason = persistence_failed
```

任何结束状态都不能被解释为长期能力结论。

### 无效作答

```text
TaskExecutionResult = submitted_invalid
↓
retry_required / supplement_response
↓
不生成正式 Evidence
↓
不计入 completedRoundCount
↓
不启动下一轮
```

### Diagnosis 或 Evidence 回流失败

```text
diagnosis_failed / review_required
↓
ContinuousLearningRunResult.status = review_required
↓
不生成新的正式轮次交接
```

### 任务不可执行

```text
TaskReadinessValidation.canExecute = false
↓
blocked / regenerate_task
↓
不创建正式 TaskExecutionSession
```

### 身份或追溯不一致

任一 `studentId`、`learningRoundId`、`taskId`、`responseId` 或来源 ID 不一致：

```text
blocked
↓
不混合两轮数据
↓
不更新 GrowthMemory
```

## 十四、建议新增文件

Phase 12.3 工程实现建议新增：

```text
src/ai/schemas/continuousLearningRun.schema.ts
src/ai/agents/continuousLearningRunAgent.ts
src/ai/tests/runContinuousLearningDebug.ts
```

新增命令：

```text
pnpm run debug:continuous-learning
```

第一版应尽量复用：

- `learningRoundStartAgent.ts`；
- `learningRoundExecutionAgent.ts`；
- `learningRoundCompletionAgent.ts`；
- `learningPersistenceAgent.ts`；
- `LearningPersistenceRepository`；
- `growthMemorySummaryAgent.ts`；
- `nextLearningStrategyAgent.ts`；
- `TaskFulfillment` 相关模块；
- Phase 12.2 的正式 `TaskResource`。

不得复制实现第二套 Round、Strategy、Evidence、Profile 或 Persistence Runtime。

## 十五、Debug 最小流程

Debug 至少运行 3 个连续回合：

```text
1. 准备 studentId、初始 Profile、GrowthMemory 和真实 TaskResource；
2. 启动 Round 1；
3. 注入 Round 1 学生答案；
4. 完成 Diagnosis、Evidence 回流和 GrowthMemory 更新；
5. 保存 Round 1；
6. 从 Repository 恢复 Round 1；
7. 基于恢复结果生成 Round 2 Strategy；
8. 生成 Round 2 TaskRequest 和 ConcreteLearningTask；
9. 注入 Round 2 学生答案并完成回流；
10. 保存并恢复 Round 2；
11. 生成 Round 3 或正常结束；
12. 输出 ContinuousLearningRunResult；
13. 输出 PASS / FAIL。
```

Debug 不得通过直接修改固定变量来模拟“策略受到上一轮影响”。

策略输入必须来自上一轮保存后恢复的数据。

## 十六、Debug Report

Debug Report 至少展示：

```text
Run ID
Student ID
Max Rounds

Round 1:
- learningRoundId
- strategyId
- targetAbilityId
- taskRequestId
- concreteTaskId
- responseId
- evidenceIds
- growthMemoryRecordId
- persistenceRecordId
- round status

Transition 1 -> 2:
- fromLearningRoundId
- fromPersistenceRecordId
- fromGrowthMemoryRecordIds
- toLearningRoundId
- nextLearningStrategyId
- taskRequestId
- concreteTaskId
- transitionType
- traceable

Round 2 / Round 3:
- 同上

Final:
- completedRoundCount
- status / endReason
- latestGrowthMemorySummary
- latestStudentAbilityProfile
- duplicate round count
- duplicate evidence count
- persistedBetweenRounds
- persistenceStatus per round
- nextStep
- validation issues
- PASS / FAIL
```

## 十七、Debug Case

至少覆盖以下案例：

### Case 1：正常完成 3 轮

```text
Round 1 completed
-> 保存和恢复
-> Round 2 completed
-> 保存和恢复
-> Round 3 completed
-> ContinuousLearningRunResult.status = completed
```

预期：

- `completedRoundCount === 3`；
- `status = completed` 且 `endReason = max_rounds_reached`；
- 该结束原因不解释为训练目标已完成；
- 三个 `learningRoundId` 唯一；
- 每轮都有正式 Evidence、GrowthMemory 与 Persistence Record；
- 两条 Transition 均可追溯。

### Case 2：继续相同能力

Round 2 仍选择与 Round 1 相同的能力。

预期：

- 可以通过；
- Strategy reason 引用新的 GrowthMemory 趋势；
- Transition 标记为 `continue_same_ability`、`retest` 或其他真实策略类型；
- 不能复用 Round 1 的固定 Strategy ID 或 Task ID。

### Case 3：无效作答

Round 2 输入空答案、“不知道”或占位回答。

预期：

- `retry_required`；
- 不生成 weakness Evidence；
- 不增加 `completedRoundCount`；
- 不启动 Round 3；
- Round 1 正式结果保持不变。

### Case 4：没有可执行任务

下一轮没有匹配资源，且不能安全生成任务。

预期：

- `blocked` 或 `regenerate_task`；
- `endReason = no_available_task`；
- 不创建正式执行 Session；
- 不伪造 `ConcreteLearningTask`。

### Case 5：保存后恢复再继续

Round 1 完成后模拟页面退出，再从 Repository 恢复。

预期：

- 恢复同一 Round 1 记录；
- 不重新运行 Round 1 Diagnosis；
- 不重复写入 Evidence 或 GrowthMemory；
- Round 2 使用新的 `learningRoundId`。

### Case 6：版本或身份不一致

保存记录版本不兼容，或恢复对象的 `studentId` 不一致。

预期：

- 阻断下一轮；
- 不拼装残缺 Profile / GrowthMemory；
- Validation 记录明确问题。

### Case 7：Diagnosis 或能力对齐失败

Diagnosis Schema 非法，或 Diagnosis 能力与任务目标明显不一致。

预期：

- `review_required`；
- `endReason = review_required`；
- 不把结果直接用于下一轮目标能力变化；
- 不生成可追溯的成功 Transition。

### Case 8：回合完成但保存失败

Round 1 已完成 Diagnosis、Evidence、Evaluation、Profile Update 和 GrowthMemory 生成，但 Repository 首次保存失败。

预期：

- `status = retry_required`；
- `endReason = persistence_failed`；
- Round 1 `persistenceStatus = retry_required`；
- 不启动 Round 2；
- 重试时只执行 Persistence Save；
- 重试成功后 `persistenceStatus = saved`；
- Diagnosis、Evidence、Profile Update 与 GrowthMemory 均只执行一次；
- 保存和恢复通过后才允许启动 Round 2。

## 十八、验收标准

Phase 12.3 通过条件：

1. 已定义 `LearningRoundTransition`；
2. 已定义 `ContinuousLearningRunResult`；
3. 能读取 Phase 12.1 恢复后的正式数据；
4. 能读取 Phase 12.2 生成的正式任务资源；
5. 能连续完成至少 2 个、Debug 建议 3 个 LearningRound；
6. 每轮 `learningRoundId` 唯一；
7. 每轮学生答案进入现有 Task Execution Runtime；
8. 每个完成轮生成正式 `AbilityEvidence`；
9. 每个完成轮生成 `GrowthMemoryRecord`；
10. 每个完成轮生成 `LearningPersistenceRecord`；
11. 下一轮开始前完成上一轮保存和恢复；
12. Round 2 的 `GrowthMemorySummary` 包含 Round 1 的正式记录；
13. Round 2 的 `NextLearningStrategy` 基于恢复后的正式状态生成；
14. Round 2 的 `TaskRequest` 保留上一轮 GrowthMemory 追溯关系；
15. Round 2 的任务通过既有 `TaskFulfillment` 获得；
16. `LearningRoundTransition.traceable === true`；
17. 即使继续相同能力，也能说明继续原因；
18. 无效作答不生成 weakness Evidence；
19. 无效作答不启动下一轮；
20. 保存恢复不重复 Diagnosis；
21. 保存恢复不重复 Evidence；
22. 保存恢复不重复 Profile 更新；
23. 保存恢复不重复 GrowthMemory；
24. 任务不足、版本冲突或身份冲突会阻断；
25. 不重新实现 Phase 8、9、10、11、12.1、12.2；
26. `ContinuousLearningRunResult` 能区分运行状态和结束原因；
27. 达到 `maxRounds` 不得被解释为训练目标已经完成；
28. `transitionType` 来自正式 `NextLearningStrategy` / `TaskRequest` 映射；
29. Orchestrator 不根据能力 ID 自行猜测 Transition 类型；
30. 每轮 Snapshot 能记录 `persistenceStatus`；
31. 保存失败时不启动下一轮；
32. 保存重试不重新执行 Diagnosis、Evidence、Profile Update 或 GrowthMemory 生成；
33. 保存成功并完成 Restore Validation 后才允许继续下一轮；
34. Debug 输出 PASS；
35. `pnpm run build` 通过。

## 工程验收记录（2026-07-14）

Phase 12.3 已完成工程最小闭环实现：

- `src/ai/schemas/continuousLearningRun.schema.ts`
- `src/ai/agents/continuousLearningRunAgent.ts`
- `src/ai/tests/runContinuousLearningDebug.ts`
- `debug:continuous-learning`

Debug 验收结果：

```text
total: 8
pass: 8
fail: 0
```

已通过场景：

1. 正常完成三轮并以 `max_rounds_reached` 结束；
2. 同能力继续时仍由正式 Strategy / TaskRequest 驱动；
3. 第二轮无效作答时阻断 Diagnosis、Evidence 与后续轮次；
4. 缺少正式任务资源时阻断运行；
5. 上一轮保存并恢复后的正式状态驱动下一轮；
6. 损坏或身份不一致的恢复记录被阻断；
7. Diagnosis 能力错位时进入 `review_required`，不污染 Evidence；
8. 持久化失败时只重试同一记录，不重新执行 Diagnosis。

当前验收状态：

```text
Docs   READY
Debug  PASS
Build  PASS
Demo   PASS
Phase  PASS
```

Phase 12.3 已完成文档、工程、Debug、Build 与轻量 Demo 验收。Phase 12 当前已具备总体验收与冻结条件，但本记录不替代 Phase 12 总结冻结记录。

## 十九、Demo 验收记录（2026-07-14）

验收结论：`PASS`

Demo 已完成以下学生可见链路：

```text
完成 Round 1
-> 保存结果
-> 点击继续下一轮
-> Round 2 读取上一轮正式状态
-> 展示新的任务
-> 完成 Round 2
-> Round 3 或达到计划轮数后正常结束
```

人工验收确认：

1. 页面能够显示当前轮次、阅读材料、题目、作答要求和答案输入区；
2. 空答案不能提交；
3. 答案草稿保存后，刷新页面能够恢复同一 `learningRoundId` 与草稿内容；
4. 有效答案能够完成诊断、Evidence 回流、正式结果保存与恢复校验；
5. 正式结果保存成功前不能进入下一轮；
6. Round 1 完成后，Round 2 能读取上一轮正式 GrowthMemory 与 StudentAbilityProfile；
7. 三轮使用不同阅读材料与题目，但保持相同目标能力，用于验证同能力连续学习；
8. 达到三轮后正常结束，不生成第四轮；
9. 结束页明确“达到计划轮数不等于能力已经掌握”；
10. 开发者折叠区能够查看轮次、策略、任务请求和成长记忆追溯摘要；
11. 模拟持久化失败时不会进入下一轮，并提供本轮重试入口。

样例边界：

- 当前三轮是固定、可重复的 Demo 样例；
- 点击“重新验收三轮流程”后仍会从相同三题重新开始；
- 三题属于同一能力下的不同情境，不代表题库轮换或自动生成能力；
- 本次通过只证明连续运行、保存恢复和跨轮衔接，不证明训练内容的真实教学效果。

学生主体验区已展示：

- 当前是第几轮；
- 当前任务；
- 作答区域；
- 学生可读反馈；
- 本轮完成状态；
- “继续下一轮”或“结束学习”入口。

学生主体验区不展示：

- Evidence 原始字段；
- GrowthMemory 原始字段；
- Profile 内部状态；
- Strategy ID；
- TaskRequest ID；
- Persistence Record ID；
- Debug JSON。

开发者折叠区可以展示轮次追溯摘要，但必须与学生体验区隔离。

## 二十、本阶段不做

Phase 12.3 不做：

- 不做无限自动学习；
- 不做多天学习计划；
- 不做正式账号系统；
- 不做云端同步；
- 不做多学生管理；
- 不做家长端；
- 不做大型题库；
- 不做自动 LLM 出题；
- 不重新判断学生能力；
- 不重新实现 Diagnosis；
- 不重新实现 Evidence / Evaluation / Profile Update；
- 不重新实现 NextLearningStrategy；
- 不重构 LearningRound Runtime；
- 不做长期成长效果结论；
- 不做商业化 UI。

## 二十一、与后续阶段的关系

Phase 12.3 完成后，系统将具备：

```text
真实题目进入
+ 学生真实作答
+ 正式结果保存
+ 页面退出后恢复
+ 上一轮驱动下一轮
```

这意味着 Phase 12 的三个最小闭环全部成立。

后续阶段可以在此基础上验证：

- 多天使用；
- 更稳定的真实题目覆盖；
- 诊断质量抽检；
- 本地数据管理；
- 账号、同步和数据安全；
- 长期学习效果观察。

## 二十二、完成定义

Phase 12.3 完成时，应能证明：

```text
Round 1 正式结果
-> 保存与恢复
-> Round 2 策略与真实任务
-> Round 2 正式结果
-> 保存与恢复
-> Round 3 或正常结束
```

这一条连续多轮学习最小闭环已经成立。

Phase 12.3 通过后，Phase 12 可以进入总体验收，并将产品状态标记为：

```text
Single-Student Usable Learning Foundation
```

它仍然不证明学生能力已经长期提升，也不代表正式 Beta 已完成。
