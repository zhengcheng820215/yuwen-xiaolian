# Phase 10.3：学习回合完成最小闭环（Learning Round Completion）

## 一、阶段目标

Phase 10.3 只解决一个核心问题：

```text
当一轮学习已经完成有效作答后，
系统能否将执行结果回流为 Evidence，
更新成长记忆，
并输出本轮学习的最终状态和下一步流程动作？
```

Phase 10.3 的一句话定义：

```text
消费 Phase 10.2 的 LearningRoundExecutionResult，调用 / 复用 Phase 9.3 Task Evidence Return 的完整结果，并将其映射为 LearningRoundResult。
```

## 二、阶段背景

Phase 10.1 已经完成：

```text
StudentAbilityProfile
+ GrowthMemorySummary
+ CurrentLearningContext
-> LearningRoundStartResult
```

Phase 10.2 已经完成：

```text
LearningRoundStartResult
+ StudentResponse
-> LearningRoundExecutionResult
```

当：

```text
LearningRoundExecutionResult.status = evidence_return_ready
LearningRoundExecutionResult.canEnterEvidenceReturn = true
```

表示本轮学生作答已经具备进入 Evidence 回流的最低条件。

Phase 9.3 已经能够完成：

```text
Valid TaskExecutionResult
+ ConcreteLearningTask
-> DiagnosisResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
```

Phase 10.3 不重新实现 Diagnosis、AbilityEvidence、Evaluation、ProfileUpdateDecision、Profile Executor 或 GrowthMemory。

Phase 10.3 负责把 Phase 10.2 的执行结果与 Phase 9.3 的证据回流结果串起来，形成一次完整学习回合的最终结果。

Phase 10.3 通过调用 Phase 9.3 间接复用 Existing Phase 8 Runtime。

Phase 10.3 不得在获得 `TaskEvidenceReturnResult` 后，再次单独调用：

- Evaluation Agent；
- ProfileUpdateDecision Agent；
- Profile Executor；
- GrowthMemory Builder。

这样可以避免同一轮学习产生重复 `EvaluationResult`、重复 `ProfileUpdateDecision` 或重复 `GrowthMemoryRecord`。

## 三、核心链路

Phase 10.3 的最小链路：

```text
LearningRoundExecutionResult
+ ConcreteLearningTask
↓
调用 / 复用 Phase 9.3 Task Evidence Return
↓
TaskEvidenceReturnResult
├─ evidence_returned
│  ├─ DiagnosisResult
│  ├─ AbilityEvidence[]
│  ├─ EvaluationResult
│  ├─ ProfileUpdateDecision
│  └─ GrowthMemoryRecord
│
├─ blocked_invalid_execution
│  ↓
│  blocked
│
├─ diagnosis_failed
│  ↓
│  review_required
│
└─ review_required
   ↓
   human_review
↓
LearningRoundResult
```

Phase 10.3 证明：

```text
一轮学习可以从启动、执行走到结束，
并把本轮结果沉淀为成长记忆与下一步流程动作。
```

## 四、输入

Phase 10.3 输入：

```text
LearningRoundExecutionResult
ConcreteLearningTask
```

输入条件：

```text
LearningRoundExecutionResult.canEnterEvidenceReturn = true
LearningRoundExecutionResult.taskExecutionResult 存在
LearningRoundExecutionResult.taskExecutionResult.canEnterDiagnosisRuntime = true
ConcreteLearningTask.taskId 与 TaskExecutionResult.taskId 一致
```

如果上述条件不满足，Phase 10.3 必须阻断，不得调用 Diagnosis Runtime。

## 五、输出

Phase 10.3 输出：

```text
LearningRoundResult
```

建议最小结构：

```ts
type LearningRoundStatus =
  | 'completed'
  | 'blocked'
  | 'retry_required'
  | 'review_required'
  | 'abandoned';

type LearningRoundNextStep =
  | 'continue'
  | 'supplement_response'
  | 'regenerate_task'
  | 'human_review'
  | 'stop';

type LearningRoundResult = {
  learningRoundId: string;
  studentId: string;
  status: LearningRoundStatus;

  startResult: LearningRoundStartResult;
  executionResult: LearningRoundExecutionResult;

  taskEvidenceReturnResult?: TaskEvidenceReturnResult;

  nextStep: LearningRoundNextStep;
  nextStepReason: string;
  issues: string[];
};
```

说明：

- `LearningRoundResult` 是一次学习回合的最终运行结果。
- `nextStep` 只表示流程动作，不替代 `NextLearningStrategy`。
- 下一轮教育策略仍应由 Phase 8.3 基于新的 `GrowthMemorySummary` 重新生成。
- `EvaluationResult`、`ProfileUpdateDecision`、`GrowthMemoryRecord` 应从 `taskEvidenceReturnResult` 中读取，不由 Phase 10.3 再次生成。

## 六、状态规则

### TaskEvidenceReturnResult 字段规则

Phase 10.3 消费现有 `TaskEvidenceReturnResult`。

当前工程中的 `TaskEvidenceReturnResult` 使用以下关键字段：

```text
status
diagnosisResult?
abilityEvidence[]
evaluationResult?
profileUpdateDecision?
growthMemoryRecord?
validation
```

字段规则：

1. 当 `status = evidence_returned` 时，必须存在：
   - `diagnosisResult`
   - `abilityEvidence[]` 且至少一条
   - `evaluationResult`
   - `profileUpdateDecision`
   - `growthMemoryRecord`

2. 当 `status = diagnosis_failed` 时：
   - `diagnosisResult` 可以不存在；
   - 不得生成正式 `abilityEvidence`；
   - 不得进入 Existing Phase 8 Runtime；
   - `evaluationResult`、`profileUpdateDecision`、`growthMemoryRecord` 不应存在。

3. 当 `status = review_required` 时：
   - 可以保留 `diagnosisResult`；
   - 可以保留 `validation.issues`；
   - 不得将结果直接作为目标能力改善依据；
   - 后续 Phase 8 输出是否存在，应严格服从 Phase 9.3 已有实现，不由 Phase 10.3 补造。

4. 当 `status = blocked_invalid_execution` 时：
   - 不得调用 Diagnosis；
   - 不得生成 `abilityEvidence`；
   - 不得生成 `growthMemoryRecord`。

不要为了统一返回结构而伪造空对象。

### completed

当以下条件全部满足：

```text
LearningRoundExecutionResult.canEnterEvidenceReturn = true
TaskEvidenceReturnResult.status = evidence_returned
TaskEvidenceReturnResult.evaluationResult 存在
TaskEvidenceReturnResult.profileUpdateDecision 存在
TaskEvidenceReturnResult.growthMemoryRecord 存在
```

输出：

```text
status = completed
nextStep = continue
```

说明：

`completed` 只表示本轮 Runtime 完成，不表示学生能力已经稳定提升。

### retry_required

当 Phase 10.2 输出：

```text
status = retry_required
```

或：

```text
canEnterEvidenceReturn = false
nextAction = supplement_response / retry_task
```

输出：

```text
status = retry_required
nextStep = supplement_response
```

不得调用 Diagnosis Runtime，不得生成 AbilityEvidence。

### blocked

当执行结果不满足 Evidence 回流条件，且不能通过学生补充作答解决时：

```text
status = blocked
nextStep = stop 或 regenerate_task
```

典型情况：

```text
LearningRoundExecutionResult.status = blocked
ConcreteLearningTask 缺失
TaskExecutionResult 缺失
taskId 不一致
TaskEvidenceReturnResult.status = blocked_invalid_execution
```

`blocked_invalid_execution` 不得被自动改为 completed。

### review_required

当 Phase 9.3 回流过程中出现诊断失败、能力不一致或需要人工复核时：

```text
status = review_required
nextStep = human_review
```

典型情况：

```text
TaskEvidenceReturnResult.status = diagnosis_failed
TaskEvidenceReturnResult.status = review_required
DiagnosisResult 与目标能力不一致
```

不得把结果直接作为目标能力改善依据。

`review_required` 不得被自动改为 completed。

### abandoned

当 Phase 10.2 输出：

```text
status = abandoned
```

输出：

```text
status = abandoned
nextStep = stop
```

不得调用 Diagnosis Runtime，不得生成 AbilityEvidence。

## 七、编排规则

Phase 10.3 必须遵守以下规则：

1. 不重新生成 `NextLearningStrategy`。
2. 不重新生成 `TaskRequest`。
3. 不重新生成 `ConcreteLearningTask`。
4. 不重新执行任务。
5. 不重新判断作答有效性。
6. 只有 `LearningRoundExecutionResult.canEnterEvidenceReturn = true` 才能进入 Phase 9.3。
7. 不直接调用底层 Diagnosis 逻辑绕过 Phase 9.3。
8. 不直接生成 AbilityEvidence 绕过 Phase 9.3。
9. 不直接执行 Evaluation、ProfileUpdateDecision、Profile Executor 或 GrowthMemory Builder。
10. 不直接更新 StudentAbilityProfile。
11. 不直接写入 GrowthMemory，必须消费 Phase 9.3 已返回的 `growthMemoryRecord`。
12. `learningRoundId` 必须贯穿最终结果。
13. `studentId` 必须在 `LearningRoundExecutionResult`、`ConcreteLearningTask`、`TaskEvidenceReturnResult` 中保持一致。
14. 如果 Phase 9.3 输出 `review_required`，Phase 10.3 必须保留复核状态，不得自动改为 completed。
15. Orchestrator 不得自行补造缺失的 DiagnosisResult、AbilityEvidence、EvaluationResult、ProfileUpdateDecision 或 GrowthMemoryRecord。

## 八、ID 与追溯要求

Phase 10.3 至少需要保留：

- `learningRoundId`
- `studentId`
- `concreteTaskId`
- `executionSessionId`
- `responseId`
- `diagnosisResultId`
- `evidenceIds`
- `evaluationResultId`
- `profileUpdateDecisionId`
- `growthMemoryRecordId`

一致性要求：

1. `LearningRoundExecutionResult.studentId = ConcreteLearningTask.studentId = TaskExecutionResult.studentId = TaskEvidenceReturnResult.studentId`。
2. `ConcreteLearningTask.taskId = TaskExecutionResult.taskId = TaskEvidenceReturnResult.taskId`。
3. `executionSessionId` 在 `LearningRoundExecutionResult`、`TaskExecutionResult`、`TaskEvidenceReturnResult` 中一致。
4. `learningRoundId` 必须贯穿 `LearningRoundStartResult`、`LearningRoundExecutionResult` 和 `LearningRoundResult`。

如果现有 `TaskEvidenceReturnResult` 尚未直接保存 `learningRoundId`，Phase 10.3 应通过 `LearningRoundExecutionResult` 保留可靠关联，并在 `issues` 或 Debug Report 中记录追溯缺口。

追溯目标：

```text
后续系统能够从 LearningRoundResult 追溯：
本轮为什么开始，
学生做了什么任务，
答案是否有效，
生成了哪些 Evidence，
是否更新了成长记忆，
下一步为什么这样走。
```

## 九、NextStep 规则

`LearningRoundResult.nextStep` 只表示流程动作。

它可以是：

```text
continue
supplement_response
regenerate_task
human_review
stop
```

它不决定：

- 下一轮训练哪项能力；
- 是否降低难度；
- 是否进入迁移；
- 是否切换长期学习目标。

正确关系是：

```text
LearningRoundResult.nextStep = continue
↓
重新生成 GrowthMemorySummary
↓
进入 Phase 8.3
↓
生成新的 NextLearningStrategy
```

Phase 10.3 不替代 Phase 8.3。

如果后续流程需要复测，也应由下一轮 Phase 8.3 根据新的 GrowthMemorySummary 生成 `independent_retest`、`transfer_test` 或 `maintenance_validation` 等策略。

## 十、Debug Case

Phase 10.3 Debug 至少覆盖以下 6 类 Case。

### Case 1：正常完成一轮

```text
LearningRoundExecutionResult.status = evidence_return_ready
TaskEvidenceReturnResult.status = evidence_returned
Existing Phase 8 Runtime 成功
```

预期：

```text
status = completed
nextStep = continue
```

### Case 2：执行结果未准备好

```text
LearningRoundExecutionResult.status = retry_required
```

预期：

```text
status = retry_required
nextStep = supplement_response
不调用 Phase 9.3
```

### Case 3：学生中断

```text
LearningRoundExecutionResult.status = abandoned
```

预期：

```text
status = abandoned
nextStep = stop
不调用 Phase 9.3
```

### Case 4：任务 ID 不一致

```text
ConcreteLearningTask.taskId != TaskExecutionResult.taskId
```

预期：

```text
status = blocked 或 review_required
nextStep = human_review 或 stop
不生成正式 Evidence
```

### Case 5：Diagnosis 失败

```text
TaskEvidenceReturnResult.status = diagnosis_failed
```

预期：

```text
status = review_required
nextStep = human_review
不更新 GrowthMemory
```

### Case 6：能力不一致

```text
TaskEvidenceReturnResult.status = review_required
```

预期：

```text
status = review_required
nextStep = human_review
不直接作为目标能力改善依据
```

### Case 7：本轮输出可作为下一轮输入

```text
TaskEvidenceReturnResult.status = evidence_returned
获得 GrowthMemoryRecord
写入现有 GrowthMemoryStore 或 mock store
重新生成 GrowthMemorySummary
```

预期：

```text
GrowthMemorySummary 包含本轮结果
StudentAbilityProfile + GrowthMemorySummary + CurrentLearningContext 结构完整
可以作为下一轮 Phase 8.3 输入
不在 Phase 10.3 内直接生成 NextLearningStrategy
```

## 十一、Debug Report

Debug Report 至少展示：

- caseId；
- learningRoundId；
- studentId；
- executionResult.status；
- executionResult.canEnterEvidenceReturn；
- concreteTaskId；
- taskExecutionResult.status；
- taskEvidenceReturnResult.status；
- diagnosisResult.mainAbility；
- evidenceIds；
- evaluationResult.id；
- profileUpdateDecision.id；
- growthMemoryRecord.id；
- final status；
- nextStep；
- nextStepReason；
- issues；
- phase9_3_called；
- phase8_runtime_reused；
- duplicate_phase8_execution_detected；
- PASS / FAIL。

其中：

```text
duplicate_phase8_execution_detected 必须为 false。
```

## 十二、验收标准

Phase 10.3 通过条件：

1. 能读取 `LearningRoundExecutionResult`。
2. 能校验 `canEnterEvidenceReturn`。
3. 能读取 `ConcreteLearningTask`。
4. 能校验 `ConcreteLearningTask.taskId` 与 `TaskExecutionResult.taskId` 一致。
5. 能在合法条件下调用或复用 Phase 9.3。
6. 能生成 `TaskEvidenceReturnResult`。
7. 能通过 Phase 9.3 间接复用 Existing Phase 8 Runtime。
8. 不重复执行 Existing Phase 8 Runtime。
9. 能从 `TaskEvidenceReturnResult` 获得 `EvaluationResult`。
10. 能从 `TaskEvidenceReturnResult` 获得 `ProfileUpdateDecision`。
11. 能从 `TaskEvidenceReturnResult` 获得 `GrowthMemoryRecord`。
12. 一个正常学习回合只生成一组正式 `EvaluationResult`、`ProfileUpdateDecision`、`GrowthMemoryRecord`。
13. 能输出 `LearningRoundResult`。
14. `LearningRoundResult.learningRoundId` 非空。
15. `LearningRoundResult.studentId` 非空。
16. 正常 Case 输出 `status = completed`。
17. 正常 Case 输出 `nextStep = continue`。
18. retry Case 不调用 Phase 9.3。
19. abandoned Case 不调用 Phase 9.3。
20. diagnosis_failed Case 输出 `review_required`。
21. ability mismatch Case 输出 `review_required`。
22. `TaskEvidenceReturnResult` 失败状态下，不要求成功对象存在。
23. 失败 Case 通过 `issues` 说明具体原因。
24. 能验证 GrowthMemoryRecord 可成为下一轮 GrowthMemorySummary 的数据来源。
25. Debug 覆盖成功、重试、中断、ID 不一致、Diagnosis 失败、能力不一致、下一轮输入可用性。
26. Debug 输出 PASS。
27. Build 通过。

## 十三、本阶段不做

Phase 10.3 不做：

- 不重新生成学习策略；
- 不重新生成任务请求；
- 不重新实例化任务；
- 不重新执行任务；
- 不重新判断作答有效性；
- 不直接写 StudentAbilityProfile；
- 不绕过 Existing Phase 8 Runtime；
- 不生成下一轮 `NextLearningStrategy`；
- 不做正式 UI；
- 不接数据库；
- 不做长期报告；
- 不做多天学习计划；
- 不做家长端。

## 十四、与下一轮学习的关系

Phase 10.3 输出：

```text
LearningRoundResult
GrowthMemoryRecord
```

下一轮学习不直接消费 `LearningRoundResult.nextStep` 作为教育策略。

正确流程是：

```text
GrowthMemoryRecord
↓
GrowthMemorySummary
↓
StudentAbilityProfile
+ CurrentLearningContext
↓
Phase 8.3 NextLearningStrategy
```

也就是说：

```text
Phase 10.3 结束一轮。
Phase 8.3 决定下一轮。
```

## 十五、最终结论

Phase 10.3 是学习回合的完成节点。

它不负责重新判断学生作答，也不负责重新制定学习策略。

它只负责证明：

```text
一轮学习可以完成 Evidence 回流，
可以沉淀成长记忆，
并能输出清晰的下一步流程动作。
```

Phase 10.3 完成后，系统将具备：

```text
开始一轮学习
-> 执行本轮任务
-> 回流本轮证据
-> 形成本轮结果
-> 为下一轮提供 GrowthMemory 输入
```

的最小学习回合编排能力。

## 十六、工程验收记录

验收时间：2026-07-13

验收结论：PASS

已完成文件：

- `src/ai/schemas/learningRound.schema.ts`
- `src/ai/agents/learningRoundCompletionAgent.ts`
- `src/ai/tests/runLearningRoundCompletionDebug.ts`
- `package.json` 中新增 `debug:phase10-3`

Debug 覆盖 Case：

1. 正常完成一轮，输出 `completed` 和 `nextStep = continue`。
2. 执行结果未准备好，输出 `retry_required`，不调用 Phase 9.3。
3. 学生中断，输出 `abandoned`，不调用 Phase 9.3。
4. 任务 ID 不一致，输出 `blocked`，不生成正式 Evidence。
5. Diagnosis 失败，输出 `review_required`。
6. 能力不一致，输出 `review_required`。
7. 本轮 GrowthMemoryRecord 可重新汇总为 GrowthMemorySummary，作为下一轮 Phase 8.3 输入。

验收命令：

```bash
pnpm run debug:phase10-3
pnpm run build
```

验收结果：

```text
debug:phase10-3 PASS
build PASS
```

本次工程实现只完成 Phase 10.3 Learning Round Completion。

本阶段没有重复执行 Existing Phase 8 Runtime；`EvaluationResult`、`ProfileUpdateDecision`、`GrowthMemoryRecord` 均来自 Phase 9.3 的 `TaskEvidenceReturnResult`。
