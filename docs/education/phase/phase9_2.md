# Phase 9.2：任务执行与作答有效性最小闭环（Task Execution & Response Validity）

## 一、阶段目标

Phase 9.2 只解决一个核心问题：

```text
学生能否基于 Ready ConcreteLearningTask 开始任务、提交作答，
系统能否判断作答是否有效，并生成 TaskExecutionResult？
```

Phase 9.2 的一句话定义：

```text
将可执行学习任务交给学生完成，接收学生作答，并判断这次作答是否允许进入 Diagnosis Runtime。
```

## 二、阶段背景

Phase 9.1 已经完成：

```text
ExecutableLearningTask / TaskGenerationRequest
-> ConcreteLearningTask
-> TaskReadinessValidation
```

当 `TaskReadinessValidation.canExecute = true` 时，说明任务已经具备进入学生执行环节的条件。

Phase 9.2 承接这个结果，验证：

```text
Ready ConcreteLearningTask
-> TaskExecutionSession
-> StudentResponse
-> ResponseValidityResult
-> TaskExecutionResult
```

Phase 9.2 只负责任务执行与作答有效性判断，不负责能力诊断。

## 三、核心链路

Phase 9.2 的最小链路：

```text
Ready ConcreteLearningTask
↓
TaskExecutionSession
↓
StudentResponse
↓
ResponseValidityResult
↓
TaskExecutionResult
├─ canEnterDiagnosisRuntime = true
│  ↓
│  Phase 9.3
│
└─ canEnterDiagnosisRuntime = false
   ↓
   blocked / retry / supplement response / stop
```

关键约束：

- 任务已提交不等于作答有效。
- 作答有效不等于能力已经形成。
- 无效作答不得进入 Diagnosis Runtime。
- 无效作答不得生成 weakness Evidence。
- Phase 9.2 不判断学生能力。
- Validity 判断“有没有可观察表现”。
- Diagnosis 判断“这个表现说明了什么”。

Phase 9.2 不得用作答有效性判断替代 Diagnosis。

## 四、输入

Phase 9.2 输入：

```text
ConcreteLearningTask
TaskReadinessValidation
StudentAnswerInput
```

### 输入条件

只有当以下条件满足时，Phase 9.2 才能开始：

```text
TaskReadinessValidation.canExecute = true
```

如果 `canExecute = false`，不得创建正式任务执行 Session。

## 五、输出

Phase 9.2 输出：

```text
TaskExecutionSession
StudentResponse
ResponseValidityResult
TaskExecutionResult
```

其中：

- `TaskExecutionSession` 记录任务执行过程。
- `StudentResponse` 记录学生提交的原始作答。
- `ResponseValidityResult` 判断作答是否有效。
- `TaskExecutionResult` 是 Phase 9.2 与 Phase 9.3 的正式交接对象。

## 六、TaskExecutionSession

`TaskExecutionSession` 表示一次任务执行过程。

建议最小结构：

```ts
type TaskExecutionSession = {
  executionSessionId: string;
  studentId: string;
  taskId: string;

  status:
    | 'started'
    | 'submitted'
    | 'interrupted'
    | 'abandoned';

  startedAt: string;
  submittedAt?: string;
  interruptedAt?: string;

  usedHint: boolean;
  hintCount: number;
  elapsedSeconds?: number;
};
```

说明：

- `TaskExecutionSession` 不包含能力判断。
- `usedHint` 和 `hintCount` 用于后续 Evidence 价值判断。
- 使用提示后完成可以进入诊断，但不能等同于独立掌握。

## 七、StudentResponse

`StudentResponse` 表示学生对某个 ConcreteLearningTask 的一次提交。

建议最小结构：

```ts
type StudentResponse = {
  responseId: string;
  executionSessionId: string;
  studentId: string;
  taskId: string;

  answerText: string;
  submittedAt: string;

  usedHint: boolean;
  hintCount: number;
};
```

说明：

- `StudentResponse` 保存学生原始作答。
- `StudentResponse` 本身不代表作答有效。
- Phase 9.3 不直接消费未经验证的 `StudentResponse`。

## 八、ResponseValidityResult

`ResponseValidityResult` 是学生作答进入 Diagnosis 前的有效性闸门。

建议最小结构：

```ts
type ResponseValidityResult = {
  responseId: string;

  status:
    | 'valid'
    | 'empty'
    | 'placeholder'
    | 'irrelevant'
    | 'insufficient';

  canDiagnose: boolean;
  reasons: string[];
};
```

### 有效作答

有效作答至少满足：

- 答案非空；
- 不是纯占位或无意义文本；
- 与任务要求有关；
- 能够形成最低限度的可观察表现；
- 能进入 Diagnosis Runtime 进行本次作答诊断。

注意：

```text
短答案不等于无效答案。
```

如果学生答案虽然简短，但与任务要求有关，并包含最低限度的可观察表现，应判断为 `valid`。

例如：

```text
父亲舍不得过去和孩子一起读书的时光。
```

虽然较短，但表达了明确推断，可以进入 Diagnosis Runtime。

### 无效作答

以下作答不得进入 Diagnosis Runtime：

- 空答案；
- 纯数字；
- 无意义字符；
- “哈哈”；
- “不知道”；
- 复制题干；
- 高确定性的明显无关回答；
- 内容无法形成任何可观察表现。

`irrelevant` 判断第一版必须保持克制。

Phase 9.2 只拦截高确定性的无关输入，例如：

- 明显随机字符；
- 与题目和材料不存在可识别关键关联的长篇纯中文随机拼接；
- 夹杂明显输入法乱码、且只与任务产生一到两个低占比偶然文本重合的拼接输入；
- 与任务完全无关的固定测试文本；
- 复制预设无关样例；
- 完全无法形成语文作答的内容。

字符重合数量不能单独替代相关性判断。正常答案包含 `AI`、`flashback` 等英文术语或中英混合表达时，不得仅凭拉丁字符判为无关；只有同时满足高置信噪声模式、极低任务锚点占比等条件时，确定性 Gate 才能阻断。其余看似相关但质量较差或措辞特殊的回答继续进入语义有效性与 Diagnosis 判断。

对于“看似相关但内容很差”的回答，不应在 Validity 层拦截。

这类回答应进入 Diagnosis Runtime，由 Diagnosis 判断：

- 是否部分相关；
- 是否错误；
- 是否证据不足；
- 是否暴露能力问题。

无效作答应输出：

```text
canDiagnose = false
```

并进入：

```text
blocked / retry / supplement response / stop
```

无效作答不得生成 weakness Evidence。

## 九、TaskExecutionResult

`TaskExecutionResult` 是 Phase 9.2 与 Phase 9.3 之间的正式交接对象。

建议最小结构：

```ts
type TaskExecutionResult = {
  executionSessionId: string;
  studentId: string;
  taskId: string;

  status:
    | 'submitted_valid'
    | 'submitted_invalid'
    | 'interrupted'
    | 'abandoned';

  studentResponse?: StudentResponse;
  responseValidity: ResponseValidityResult;

  usedHint: boolean;
  hintCount: number;
  canEnterDiagnosisRuntime: boolean;
};
```

规则：

```text
canEnterDiagnosisRuntime = responseValidity.canDiagnose
```

`TaskExecutionResult` 必须直接保留：

```text
usedHint
hintCount
```

这样 Phase 9.3 在生成 Evidence 时可以直接读取提示依赖信息，避免提示信息在跨阶段传递中丢失。

Phase 9.3 只消费：

```text
TaskExecutionResult.canEnterDiagnosisRuntime = true
```

如果 `canEnterDiagnosisRuntime = false`，Phase 9.3 不得继续生成 DiagnosisResult。

## 十、核心规则

1. Phase 9.2 只能消费 `TaskReadinessValidation.canExecute = true` 的任务。
2. 必须创建 `TaskExecutionSession`。
3. 必须保留 `studentId`。
4. 必须保留 `taskId`。
5. 必须记录任务开始时间。
6. 学生提交后必须生成 `StudentResponse`。
7. `StudentResponse.executionSessionId` 必须与 `TaskExecutionSession.executionSessionId` 一致。
8. `StudentResponse.studentId` 必须与 `TaskExecutionSession.studentId` 一致。
9. `StudentResponse.taskId` 必须与 `TaskExecutionSession.taskId` 一致。
10. 必须生成 `ResponseValidityResult`。
11. 空答案不得进入 Diagnosis Runtime。
12. 占位回答不得进入 Diagnosis Runtime。
13. 明显无关回答不得进入 Diagnosis Runtime。
14. 无效作答不得生成 weakness Evidence。
15. 使用提示后完成可以进入 Diagnosis，但后续 Evidence 必须保留提示依赖信息。
16. 必须生成 `TaskExecutionResult`。
17. `TaskExecutionResult` 必须直接保留 `usedHint` 和 `hintCount`。
18. `TaskExecutionResult.canEnterDiagnosisRuntime` 必须与 `ResponseValidityResult.canDiagnose` 一致。
19. 短答案不自动判定为无效。
20. `irrelevant` 只用于高确定性无关输入。
21. Phase 9.2 不判断答案正确与否。
22. Phase 9.2 不判断是否满足评分点。
23. Phase 9.2 不判断 rootCause。
24. Phase 9.2 不判断能力是否不足。
25. Phase 9.2 不生成 positive / weakness Evidence。
26. Phase 9.2 不生成 DiagnosisResult。
27. Phase 9.2 不生成 AbilityEvidence。
28. Phase 9.2 不更新 StudentAbilityProfile。

## 十一、Debug 最小流程

Debug 需要覆盖以下 Case。

### Case 1：正常有效作答

```text
ConcreteLearningTask
-> StudentResponse(answerText 有效)
-> ResponseValidityResult.status = valid
-> TaskExecutionResult.status = submitted_valid
-> canEnterDiagnosisRuntime = true
```

### Case 2：空答案

```text
answerText = ''
-> ResponseValidityResult.status = empty
-> canEnterDiagnosisRuntime = false
-> TaskExecutionResult.status = submitted_invalid
```

### Case 3：“不知道”或占位回答

```text
answerText = '不知道'
-> ResponseValidityResult.status = placeholder
-> canEnterDiagnosisRuntime = false
```

### Case 4：明显无关回答

```text
answerText 为高确定性无关输入
-> ResponseValidityResult.status = irrelevant
-> canEnterDiagnosisRuntime = false
```

### Case 5：使用提示后完成

```text
usedHint = true
answerText 有效
-> canEnterDiagnosisRuntime = true
-> TaskExecutionResult 保留 usedHint / hintCount
```

### Case 6：ID 不一致

```text
StudentResponse.studentId / taskId / executionSessionId 与 Session 不一致
-> TaskExecutionResult.status = submitted_invalid
-> canEnterDiagnosisRuntime = false
```

### Case 7：任务未通过 readiness

```text
TaskReadinessValidation.canExecute = false
-> 不创建正式 TaskExecutionSession
-> 不进入学生作答
```

### Case 8：简短但有效回答

```text
answerText = '父亲舍不得过去和孩子一起读书的时光。'
-> ResponseValidityResult.status = valid
-> canEnterDiagnosisRuntime = true
```

该 Case 用于防止 Validity 逻辑退化为：

```text
字数少
-> invalid
```

## 十二、Debug Report

Debug Report 至少展示：

- caseId；
- taskId；
- studentId；
- executionSessionId；
- sessionStatus；
- answerText 摘要；
- usedHint；
- hintCount；
- responseValidity.status；
- responseValidity.canDiagnose；
- responseValidity.reasons；
- taskExecutionResult.status；
- canEnterDiagnosisRuntime；
- PASS / FAIL。

## 十三、验收标准

Phase 9.2 通过条件：

1. 能消费 Ready ConcreteLearningTask。
2. 能识别 `TaskReadinessValidation.canExecute = false` 并阻断执行。
3. 能创建 `TaskExecutionSession`。
4. 能接收学生答案并生成 `StudentResponse`。
5. 能记录 `startedAt`。
6. 能记录 `submittedAt`。
7. 能记录 `usedHint`。
8. 能记录 `hintCount`。
9. 能生成 `ResponseValidityResult`。
10. 有效作答 `canDiagnose = true`。
11. 空答案 `canDiagnose = false`。
12. 占位回答 `canDiagnose = false`。
13. 高确定性明显无关回答 `canDiagnose = false`。
14. 能生成 `TaskExecutionResult`。
15. `TaskExecutionResult` 直接保留 `usedHint`。
16. `TaskExecutionResult` 直接保留 `hintCount`。
17. `TaskExecutionResult.canEnterDiagnosisRuntime` 与 `ResponseValidityResult.canDiagnose` 一致。
18. ID 不一致时阻断流程。
19. 简短但有效回答 `canDiagnose = true`。
20. 无效作答不进入 Diagnosis Runtime。
21. 无效作答不生成 weakness Evidence。
22. Debug 输出 PASS。
23. Build 通过。

## 十四、工程验收记录

验收时间：2026-07-13

验收结论：PASS

通过类型：Runtime Debug 验收 + Build 验收

本阶段已完成：

- `src/ai/schemas/taskExecution.schema.ts`
- `src/ai/agents/taskExecutionAgent.ts`
- `src/ai/tests/runTaskExecutionDebug.ts`
- `debug:phase9-2`

Debug 覆盖 Case：

1. 正常有效作答；
2. 空答案；
3. 占位回答；
4. 高确定性明显无关回答；
5. 使用提示后的有效作答；
6. `studentId / taskId / executionSessionId` 不一致；
7. `TaskReadinessValidation.canExecute = false` 阻断；
8. 简短但有效回答。

Debug 验收结果：

```text
PASS 8 / 8
```

Build 验收结果：

```text
PASS
```

本阶段已证明：

```text
Ready ConcreteLearningTask
-> TaskExecutionSession
-> StudentResponse
-> ResponseValidityResult
-> TaskExecutionResult
```

这一段任务执行与作答有效性最小闭环成立。

本阶段未接入 Demo 页面。

原因：

Phase 9.2 的核心是 Runtime 闸门，不是用户体验。

空答案、占位回答、无关回答、ID 不一致、提示使用等分支更适合通过 Debug 验收。

## 十五、本阶段不做

Phase 9.2 不做：

- 不调用 Diagnosis Runtime；
- 不生成 DiagnosisResult；
- 不生成 AbilityEvidence；
- 不执行 Evaluation；
- 不生成 ProfileUpdateDecision；
- 不更新 StudentAbilityProfile；
- 不写入 GrowthMemory；
- 不判断学生能力；
- 不证明学习效果；
- 不做复杂 UI；
- 不接数据库；
- 不做正式账号系统。

## 十六、与 Phase 9.3 的关系

Phase 9.2 输出：

```text
TaskExecutionResult
```

Phase 9.3 消费：

```text
Valid TaskExecutionResult
+ ConcreteLearningTask
```

如果：

```text
TaskExecutionResult.canEnterDiagnosisRuntime = false
```

则 Phase 9.3 不得继续执行。

因此，Phase 9.2 的完成标准不是“已经诊断学生答案”，而是：

```text
系统已经确认这次作答是否具备进入诊断链路的资格。
```

## 十七、最终结论

Phase 9.2 是真实任务执行链路中的作答入口。

它不负责能力诊断，也不负责证据生成。

它只负责：

```text
学生开始任务
-> 学生提交答案
-> 判断作答有效性
-> 形成 TaskExecutionResult
```

只有完成这一步，Phase 9.3 才能安全地将有效作答送入 Diagnosis Runtime，并继续生成 AbilityEvidence。
