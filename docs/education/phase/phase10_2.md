# Phase 10.2：学习回合执行最小闭环（Learning Round Execution）

## 一、阶段目标

Phase 10.2 只解决一个核心问题：

```text
当一轮学习已经被启动，并且任务已经准备好后，
学生能否完成本轮任务，
系统能否形成本轮任务执行结果？
```

Phase 10.2 的一句话定义：

```text
消费 Phase 10.1 的 LearningRoundStartResult，接收 StudentResponse，复用 Phase 9.2 的任务执行与作答有效性判断，形成 LearningRoundExecutionResult。
```

## 二、阶段背景

Phase 10.1 已经能够输出：

```text
LearningRoundStartResult
```

其中当：

```text
status = ready_for_execution
```

表示本轮学习已经具备进入任务执行的条件。

Phase 9.2 已经能够完成：

```text
ConcreteLearningTask
-> TaskExecutionSession
-> StudentResponse
-> ResponseValidityResult
-> TaskExecutionResult
```

Phase 10.2 不重新实现任务执行模型。

Phase 10.2 负责把 Phase 10.1 的启动结果与 Phase 9.2 的执行结果串起来，形成一轮学习的执行结果。

## 三、核心链路

Phase 10.2 的最小链路：

```text
LearningRoundStartResult
+ StudentResponse
↓
TaskExecutionSession
↓
ResponseValidityResult
↓
TaskExecutionResult
↓
LearningRoundExecutionResult
```

Phase 10.2 证明：

```text
一轮已经启动的学习，可以进入学生作答，
并形成是否可继续进入证据回流的执行结果。
```

## 四、输入

Phase 10.2 输入：

```text
LearningRoundStartResult
StudentResponseInput
```

说明：

- `LearningRoundStartResult` 来自 Phase 10.1；
- 只有 `status = ready_for_execution` 才允许进入 Phase 10.2；
- `StudentResponseInput` 表示学生对本轮任务的作答；
- 学生作答必须关联本轮 `learningRoundId`、`taskId`、`studentId`。

## 五、输出

Phase 10.2 输出：

```text
LearningRoundExecutionResult
```

建议最小结构：

```ts
type LearningRoundExecutionStatus =
  | 'evidence_return_ready'
  | 'retry_required'
  | 'blocked'
  | 'review_required'
  | 'abandoned';

type LearningRoundExecutionResult = {
  learningRoundId: string;
  studentId: string;
  status: LearningRoundExecutionStatus;

  startResult: LearningRoundStartResult;
  taskExecutionSession?: TaskExecutionSession;
  studentResponse?: StudentResponse;
  responseValidityResult?: ResponseValidityResult;
  taskExecutionResult?: TaskExecutionResult;

  canEnterEvidenceReturn: boolean;

  nextAction:
    | 'enter_evidence_return'
    | 'supplement_response'
    | 'retry_task'
    | 'human_review'
    | 'stop';

  issues: string[];
};
```

说明：

- `LearningRoundExecutionResult` 是 Phase 10.2 与 Phase 10.3 的交接对象。
- 当 `status = evidence_return_ready` 时，Phase 10.3 可以进入执行结果回流。
- 当 `canEnterEvidenceReturn = false` 时，Phase 10.3 不得调用 Diagnosis Runtime。
- 具体失败原因通过 `issues` 表达，不通过不断扩展状态枚举表达。

## 六、状态规则

### evidence_return_ready

当以下条件全部满足：

```text
LearningRoundStartResult.status = ready_for_execution
TaskExecutionSession 创建成功
StudentResponse 存在
ResponseValidityResult.status = valid
TaskExecutionResult.status = submitted_valid
TaskExecutionResult.canEnterDiagnosisRuntime = true
```

输出：

```text
status = evidence_return_ready
canEnterEvidenceReturn = true
nextAction = enter_evidence_return
```

### retry_required

当学生作答无效，但可以补充或重试时：

```text
ResponseValidityResult.status = empty
或 placeholder
或 insufficient
```

输出：

```text
status = retry_required
canEnterEvidenceReturn = false
nextAction = supplement_response 或 retry_task
```

无效作答不得进入 Phase 10.3。

### blocked

当本轮启动结果不满足执行条件，或关键 ID 缺失时：

```text
status = blocked
canEnterEvidenceReturn = false
nextAction = stop
```

典型情况：

```text
LearningRoundStartResult.status != ready_for_execution
ConcreteLearningTask 缺失
taskReadinessValidation.canExecute = false
studentId / taskId / learningRoundId 不一致
```

### review_required

当执行结果存在冲突但系统无法自动判断时：

```text
status = review_required
canEnterEvidenceReturn = false
nextAction = human_review
```

典型情况：

```text
TaskExecutionResult 与 LearningRoundStartResult 的 studentId 不一致
TaskExecutionResult 与 ConcreteLearningTask 的 taskId 不一致
ResponseValidityResult 与 TaskExecutionResult 状态冲突
```

### abandoned

当学生中断或放弃本轮任务时：

```text
status = abandoned
canEnterEvidenceReturn = false
nextAction = stop
```

不得生成 DiagnosisResult 或 AbilityEvidence。

## 七、编排规则

Phase 10.2 必须遵守以下规则：

1. 不重新生成 `NextLearningStrategy`。
2. 不重新生成 `TaskRequest`。
3. 不重新生成 `ConcreteLearningTask`。
4. 不跳过 `ResponseValidityResult`。
5. 不把无效作答送入 Diagnosis Runtime。
6. 不把“任务已提交”直接等同于“作答有效”。
7. `learningRoundId` 必须从 Phase 10.1 贯穿到执行结果。
8. `studentId` 必须在 `LearningRoundStartResult`、`StudentResponse`、`TaskExecutionResult` 中保持一致。
9. `taskId` 必须与 `ConcreteLearningTask.taskId` 保持一致。
10. 如果 Phase 9.2 输出失败或无效，Phase 10.2 只负责阻断或要求补充，不得自行生成替代答案、替代诊断或替代 Evidence。

## 八、ID 与追溯要求

Phase 10.2 至少需要保留：

- `learningRoundId`
- `studentId`
- `concreteTaskId`
- `executionSessionId`
- `responseId`
- `taskExecutionResult.status`
- `responseValidityResult.status`

追溯目标：

```text
后续 Phase 10.3 能知道：
本轮学生回答的是哪一道任务，
作答是否有效，
是否使用提示，
是否允许进入 Diagnosis / Evidence 回流。
```

## 九、Debug Case

Phase 10.2 Debug 至少覆盖以下 5 类 Case。

### Case 1：正常执行

```text
LearningRoundStartResult.status = ready_for_execution
+ valid StudentResponse
-> TaskExecutionResult.submitted_valid
-> LearningRoundExecutionResult.evidence_return_ready
```

预期：

```text
status = evidence_return_ready
canEnterEvidenceReturn = true
nextAction = enter_evidence_return
```

### Case 2：启动结果未 ready

```text
LearningRoundStartResult.status = blocked
+ StudentResponse
```

预期：

```text
status = blocked
canEnterEvidenceReturn = false
不创建新的有效执行结果
```

### Case 3：空答案

```text
StudentResponse.answerText = ''
```

预期：

```text
ResponseValidityResult.status = empty
status = retry_required
canEnterEvidenceReturn = false
```

### Case 4：占位回答

```text
StudentResponse.answerText = '不知道'
```

预期：

```text
ResponseValidityResult.status = placeholder
status = retry_required
canEnterEvidenceReturn = false
```

### Case 5：ID 不一致

```text
StudentResponse.studentId != LearningRoundStartResult.studentId
或 taskId 不一致
```

预期：

```text
status = review_required
canEnterEvidenceReturn = false
nextAction = human_review
```

### Case 6：学生中断

```text
TaskExecutionResult.status = interrupted
或 abandoned
```

预期：

```text
status = abandoned
canEnterEvidenceReturn = false
nextAction = stop
```

## 十、Debug Report

Debug Report 至少展示：

- caseId；
- learningRoundId；
- studentId；
- startResult.status；
- concreteTaskId；
- executionSessionId；
- responseId；
- answerText 摘要；
- usedHint / hintCount；
- responseValidityResult.status；
- taskExecutionResult.status；
- taskExecutionResult.canEnterDiagnosisRuntime；
- final status；
- canEnterEvidenceReturn；
- nextAction；
- issues；
- PASS / FAIL。

## 十一、验收标准

Phase 10.2 通过条件：

1. 能读取 `LearningRoundStartResult`。
2. 能校验 `LearningRoundStartResult.status = ready_for_execution`。
3. 能读取 `ConcreteLearningTask`。
4. 能接收 `StudentResponseInput`。
5. 能创建或复用 `TaskExecutionSession`。
6. 能生成 `StudentResponse`。
7. 能生成 `ResponseValidityResult`。
8. 能生成 `TaskExecutionResult`。
9. 能输出 `LearningRoundExecutionResult`。
10. `LearningRoundExecutionResult.learningRoundId` 非空。
11. `LearningRoundExecutionResult.studentId` 非空。
12. 正常 Case 输出 `status = evidence_return_ready`。
13. 正常 Case 输出 `canEnterEvidenceReturn = true`。
14. 正常 Case 输出 `nextAction = enter_evidence_return`。
15. 无效作答 Case 输出 `canEnterEvidenceReturn = false`。
16. 无效作答 Case 不进入 Diagnosis Runtime。
17. ID 不一致 Case 输出 `review_required`。
18. 中断 Case 输出 `abandoned`。
19. 失败 Case 通过 `issues` 说明具体阻断原因。
20. Debug 覆盖至少 5 类 Case。
21. Debug 输出 PASS。
22. Build 通过。

## 十二、本阶段不做

Phase 10.2 不做：

- 不重新生成学习策略；
- 不重新生成任务请求；
- 不重新实例化任务；
- 不调用 Diagnosis Runtime；
- 不生成 DiagnosisResult；
- 不生成 AbilityEvidence；
- 不进入 Existing Phase 8 Runtime；
- 不更新 GrowthMemory；
- 不生成 LearningRoundResult；
- 不做正式 UI；
- 不接数据库；
- 不做长期报告。

## 十三、与 Phase 10.3 的关系

Phase 10.2 输出：

```text
LearningRoundExecutionResult
```

Phase 10.3 消费：

```text
LearningRoundExecutionResult
+ ConcreteLearningTask
```

如果：

```text
LearningRoundExecutionResult.canEnterEvidenceReturn = false
```

则 Phase 10.3 不得调用 Diagnosis Runtime，不得生成 AbilityEvidence。

## 十四、最终结论

Phase 10.2 是学习回合的执行节点。

它不负责判断能力，也不负责证据回流。

它只负责证明：

```text
学生可以完成本轮任务，
系统可以判断本次作答是否有效，
并明确是否允许进入执行结果回流。
```

Phase 10.2 完成后，系统将具备：

```text
开始一轮学习
-> 执行本轮任务
-> 判断作答是否可进入 Evidence 回流
```

的最小编排能力。

## 十五、工程验收记录

验收时间：2026-07-13

验收结论：PASS

已完成文件：

- `src/ai/schemas/learningRound.schema.ts`
- `src/ai/agents/learningRoundExecutionAgent.ts`
- `src/ai/tests/runLearningRoundExecutionDebug.ts`
- `package.json` 中新增 `debug:phase10-2`

Debug 覆盖 Case：

1. 正常执行，有效作答进入 Evidence Return。
2. 启动结果未 ready，阻断执行。
3. 空答案，要求补充作答。
4. 占位回答，要求补充作答。
5. `studentId` 不一致，进入人工复核。
6. 学生中断，回合执行状态为 `abandoned`。

验收命令：

```bash
pnpm run debug:phase10-2
pnpm run build
```

验收结果：

```text
debug:phase10-2 PASS
build PASS
```

本次工程实现只完成 Phase 10.2 Learning Round Execution。

本阶段仍不调用 Diagnosis Runtime、不生成 AbilityEvidence、不进入 Existing Phase 8 Runtime、不更新 GrowthMemory。
