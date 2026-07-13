# Phase 9.3：执行结果回流最小闭环（Task Evidence Return）

## 一、阶段目标

Phase 9.3 只解决一个核心问题：

```text
经过作答有效性校验的真实任务执行结果，
能否进入 Diagnosis Runtime，
并重新回流为 AbilityEvidence 和 Existing Phase 8 Runtime 可消费的数据？
```

Phase 9.3 的一句话定义：

```text
将有效 TaskExecutionResult 接入 Diagnosis Runtime，生成可追溯 AbilityEvidence，并复用 Existing Phase 8 Runtime 完成评估、画像更新决策和成长记忆沉淀。
```

## 二、阶段背景

Phase 9.1 已经完成：

```text
ExecutableLearningTask / TaskGenerationRequest
-> ConcreteLearningTask
-> TaskReadinessValidation
```

Phase 9.2 已经完成：

```text
Ready ConcreteLearningTask
-> TaskExecutionSession
-> StudentResponse
-> ResponseValidityResult
-> TaskExecutionResult
```

当 `TaskExecutionResult.canEnterDiagnosisRuntime = true` 时，说明本次学生作答已经具备进入 Diagnosis Runtime 的最低条件。

Phase 9.3 承接这个结果，验证真实作答是否可以重新沉淀为能力证据，并进入后续成长 Runtime。

## 三、核心链路

Phase 9.3 的完整最小链路：

```text
Valid TaskExecutionResult
+ ConcreteLearningTask
↓
Diagnosis Runtime
├─ Diagnosis 失败 / Schema 非法
│  ↓
│  diagnosis_failed
│  ↓
│  不生成正式 AbilityEvidence
│  ↓
│  不进入 Existing Phase 8 Runtime
│
└─ Diagnosis 合法
   ↓
   Diagnosis / Task Alignment Validation
   ├─ aligned
   │  ↓
   │  AbilityEvidence[]
   │  ↓
   │  Existing Phase 8 Runtime
   │  ↓
   │  EvaluationResult
   │  ↓
   │  ProfileUpdateDecision
   │  ↓
   │  GrowthMemoryRecord
   │
   └─ misaligned
      ↓
      review_required
      ↓
      不把结果直接作为目标能力提升依据
```

Phase 9.3 必须保留四类分支：

1. 无效执行阻断；
2. Diagnosis 失败阻断；
3. 能力不一致进入复核；
4. 成功生成 Evidence 并回流 Existing Phase 8 Runtime。

## 四、输入

Phase 9.3 输入：

```text
ConcreteLearningTask
TaskExecutionResult
```

输入条件：

```text
TaskExecutionResult.canEnterDiagnosisRuntime = true
```

如果 `canEnterDiagnosisRuntime = false`，Phase 9.3 必须阻断，不得调用 Diagnosis Runtime。

## 五、输出

Phase 9.3 输出：

```text
TaskEvidenceReturnResult
```

建议最小结构：

```ts
type TaskEvidenceReturnStatus =
  | 'blocked_invalid_execution'
  | 'diagnosis_failed'
  | 'review_required'
  | 'evidence_returned';

type TaskEvidenceReturnResult = {
  returnId: string;
  status: TaskEvidenceReturnStatus;

  studentId: string;
  taskId: string;
  executionSessionId: string;
  responseId?: string;

  concreteTask: ConcreteLearningTask;
  taskExecutionResult: TaskExecutionResult;

  diagnosisResult?: DiagnosisResult;
  abilityEvidence?: AbilityEvidence[];

  evaluationResult?: EvaluationResult;
  profileUpdateDecision?: ProfileUpdateDecision;
  growthMemoryRecord?: GrowthMemoryRecord;

  supportContext: {
    usedHint: boolean;
    hintCount: number;
  };

  validation: {
    passed: boolean;
    diagnosisSchemaValid: boolean;
    taskDiagnosisAligned: boolean;
    studentIdConsistent: boolean;
    traceabilityComplete: boolean;
    reviewRequired: boolean;
    issues: string[];
  };
};
```

说明：

- `TaskEvidenceReturnResult` 是 Phase 9.3 的阶段结果对象。
- 它记录一次真实任务执行如何回流为 Evidence。
- 它不替代 `AbilityEvidence`、`EvaluationResult`、`ProfileUpdateDecision` 或 `GrowthMemoryRecord`。
- 它只负责把这些 Runtime 结果串联为一次可追溯的回流事件。

## 六、状态规则

### blocked_invalid_execution

当输入的 `TaskExecutionResult.canEnterDiagnosisRuntime = false` 时，输出：

```text
status = blocked_invalid_execution
```

此时：

- 不调用 Diagnosis Runtime；
- 不生成 DiagnosisResult；
- 不生成 AbilityEvidence；
- 不进入 Existing Phase 8 Runtime。

### diagnosis_failed

当 Diagnosis Runtime 返回失败、无法解析或 Schema 非法时，输出：

```text
status = diagnosis_failed
```

此时：

- 不生成正式 AbilityEvidence；
- 不进入 Existing Phase 8 Runtime；
- 必须保留失败原因；
- 不得把异常结果当作 weakness Evidence。

### review_required

当 Diagnosis 合法，但诊断能力与任务目标能力不一致时，输出：

```text
status = review_required
```

典型情况：

```text
ConcreteLearningTask.targetAbilityId = 推理
DiagnosisResult.mainAbility = 表达
```

此时：

- 可以保留 DiagnosisResult；
- 可以保留观察结果；
- 不把结果直接作为目标能力提升依据；
- 不直接生成用于目标能力升级的 Evidence；
- 需要进入人工复核或后续规则复核。

### evidence_returned

当 Diagnosis 合法，且诊断结果与任务目标能力对齐时，输出：

```text
status = evidence_returned
```

此时：

```text
DiagnosisResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
-> EvaluationResult
-> ProfileUpdateDecision
-> GrowthMemoryRecord
```

## 七、一致性检查

Phase 9.3 必须进行以下一致性检查。

### 输入一致性

- `TaskExecutionResult.studentId` 必须与 `ConcreteLearningTask.studentId` 一致。
- `TaskExecutionResult.taskId` 必须与 `ConcreteLearningTask.taskId` 一致。
- `TaskExecutionResult.studentResponse.taskId` 必须与 `TaskExecutionResult.taskId` 一致。
- `TaskExecutionResult.studentResponse.executionSessionId` 必须与 `TaskExecutionResult.executionSessionId` 一致。

### Diagnosis 一致性

- `DiagnosisResult.studentId` 应与 `TaskExecutionResult.studentId` 一致。
- `DiagnosisResult.mainAbility` 应与 `ConcreteLearningTask.targetAbilityId` 或 `questionMetadata.mainAbility` 对齐。
- 如果不一致，应进入 `review_required`，不得直接作为目标能力提升依据。

### Evidence 可追溯性

生成的 `AbilityEvidence` 必须能够追溯：

- `studentId`
- `taskId`
- `executionSessionId`
- `responseId`
- `diagnosisResultId`

建议通过以下结构保留：

```ts
evidenceLinks: {
  taskId: string;
  executionSessionId: string;
  responseId: string;
  diagnosisResultId: string;
}[];
```

或在当前既有 Evidence Schema 允许的字段中保留等价引用。

## 八、提示依赖规则

如果本次作答使用过提示：

```text
TaskExecutionResult.usedHint = true
```

Phase 9.3 必须将提示依赖事实传递到 Evidence 或回流结果中：

```ts
supportContext: {
  usedHint: boolean;
  hintCount: number;
}
```

规则：

- 使用提示后的正确表现可以进入 Diagnosis。
- 使用提示后的表现不得等同于独立掌握。
- Phase 9.3 只保留提示依赖事实。
- Phase 9.3 不自行决定置信度如何调整。
- 置信度、独立性、能力状态判断应交由 Existing Phase 8 Runtime 消费。

## 九、Existing Phase 8 Runtime 复用规则

Phase 9.3 复用 Existing Phase 8 Runtime。

复用对象包括：

- Diagnosis Runtime；
- AbilityEvidence 转换；
- EvaluationResult；
- ProfileUpdateDecision；
- Profile Decision Execution；
- GrowthMemoryRecord。

Phase 9.3 不重新定义、不复制、不创建第二条能力判断或画像更新链路。

Phase 9.3 新增的核心能力只是：

```text
将真实任务执行结果适配到现有 Diagnosis 和 Evidence 链路，
并验证 Evidence 能重新进入 Existing Phase 8 Runtime。
```

## 十、Debug Case

Phase 9.3 Debug 至少覆盖以下 6 类 Case。

### Case 1：有效作答正常回流

```text
TaskExecutionResult.status = submitted_valid
canEnterDiagnosisRuntime = true
Diagnosis 合法
Diagnosis / Task aligned
```

预期：

```text
status = evidence_returned
生成 DiagnosisResult
生成 AbilityEvidence
进入 Existing Phase 8 Runtime
生成 EvaluationResult / ProfileUpdateDecision / GrowthMemoryRecord
```

### Case 2：无效作答被阻断

```text
TaskExecutionResult.status = submitted_invalid
canEnterDiagnosisRuntime = false
```

预期：

```text
status = blocked_invalid_execution
不调用 Diagnosis Runtime
不生成 AbilityEvidence
不进入 Existing Phase 8 Runtime
```

### Case 3：使用提示后作答

```text
TaskExecutionResult.usedHint = true
hintCount > 0
```

预期：

```text
supportContext.usedHint = true
supportContext.hintCount > 0
Evidence 或回流结果保留提示依赖信息
不等同独立掌握
```

### Case 4：Diagnosis 与任务目标能力一致

```text
DiagnosisResult.mainAbility = ConcreteLearningTask.targetAbilityId
```

预期：

```text
taskDiagnosisAligned = true
status = evidence_returned
```

### Case 5：Diagnosis 与任务目标能力不一致

```text
DiagnosisResult.mainAbility != ConcreteLearningTask.targetAbilityId
```

预期：

```text
status = review_required
reviewRequired = true
不直接作为目标能力提升依据
```

### Case 6：Diagnosis Schema 失败

```text
Diagnosis Runtime 返回缺字段、非法 mainAbility 或不可解析结构
```

预期：

```text
status = diagnosis_failed
diagnosisSchemaValid = false
不生成正式 AbilityEvidence
不进入 Existing Phase 8 Runtime
```

## 十一、Debug Report

Debug Report 至少展示：

- caseId；
- studentId；
- taskId；
- executionSessionId；
- responseId；
- taskExecutionResult.status；
- canEnterDiagnosisRuntime；
- usedHint；
- hintCount；
- diagnosisStatus；
- diagnosisResult.mainAbility；
- targetAbility；
- taskDiagnosisAligned；
- generatedEvidenceCount；
- traceabilityComplete；
- evaluationResult status；
- profileUpdateDecision decision；
- growthMemoryRecord id；
- final status；
- validation issues；
- PASS / FAIL。

## 十二、验收标准

Phase 9.3 通过条件：

1. 能读取 `ConcreteLearningTask`。
2. 能读取 `TaskExecutionResult`。
3. 能识别 `canEnterDiagnosisRuntime`。
4. 无效作答必须被阻断。
5. 无效作答不调用 Diagnosis Runtime。
6. 无效作答不生成 AbilityEvidence。
7. 有效作答能调用 Diagnosis Runtime 或 mock Diagnosis Runtime。
8. Diagnosis Schema 非法时输出 `diagnosis_failed`。
9. Diagnosis Schema 非法时不生成正式 AbilityEvidence。
10. Diagnosis 合法时能生成 DiagnosisResult。
11. 能检查 DiagnosisResult 与任务目标能力是否一致。
12. 能力不一致时输出 `review_required`。
13. 能力不一致时不直接作为目标能力提升依据。
14. 能生成 AbilityEvidence。
15. AbilityEvidence 能追溯 `studentId`。
16. AbilityEvidence 能追溯 `taskId`。
17. AbilityEvidence 能追溯 `executionSessionId`。
18. AbilityEvidence 能追溯 `responseId`。
19. AbilityEvidence 能追溯 `diagnosisResultId`。
20. 使用提示时保留 `usedHint`。
21. 使用提示时保留 `hintCount`。
22. 新 Evidence 能进入 Existing Phase 8 Runtime。
23. 能生成 EvaluationResult。
24. 能生成 ProfileUpdateDecision。
25. 能生成 GrowthMemoryRecord。
26. Debug 覆盖 6 类 Case。
27. Debug 输出 PASS。
28. Build 通过。

## 十三、工程验收记录

验收时间：2026-07-13

验收结论：PASS

通过类型：Runtime Debug 验收 + Build 验收

本阶段已完成：

- `src/ai/schemas/taskEvidenceReturn.schema.ts`
- `src/ai/agents/taskEvidenceReturnAgent.ts`
- `src/ai/tests/runTaskEvidenceReturnDebug.ts`
- `debug:phase9-3`

Debug 覆盖 Case：

1. 有效作答正常回流；
2. 无效作答被阻断；
3. 使用提示后作答并保留提示依赖；
4. Diagnosis 与任务目标能力一致；
5. Diagnosis 与任务目标能力不一致并进入复核；
6. Diagnosis Schema 失败并阻断 Evidence 生成。

Debug 验收结果：

```text
PASS 6 / 6
```

Build 验收结果：

```text
PASS
```

本阶段已证明：

```text
Valid TaskExecutionResult
+ ConcreteLearningTask
-> DiagnosisResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
-> EvaluationResult
-> ProfileUpdateDecision
-> GrowthMemoryRecord
```

这一段执行结果回流最小闭环成立。

本阶段未接入 Demo 页面。

原因：

Phase 9.3 的核心是 Runtime 集成与分支闸门，不是用户界面体验。

Diagnosis 失败、Schema 非法、能力不一致、提示依赖、成功回流等分支更适合通过 Debug 验收。

## 十四、本阶段不做

Phase 9.3 不做：

- 不重新判断作答是否有效；
- 不重新实例化任务；
- 不生成新的 ConcreteLearningTask；
- 不重写 Diagnosis Runtime；
- 不重新定义 AbilityEvidence Schema；
- 不重新定义 EvaluationResult；
- 不重新定义 ProfileUpdateDecision；
- 不重新定义 GrowthMemoryRecord；
- 不直接更新正式数据库；
- 不做正式 UI；
- 不做长期成长报告；
- 不证明任务策略有效；
- 不证明学生能力真实提升；
- 不证明 AI 诊断质量已经稳定。

## 十五、与 Phase 9.2 的关系

Phase 9.2 输出：

```text
TaskExecutionResult
```

Phase 9.3 只消费：

```text
Valid TaskExecutionResult
+ ConcreteLearningTask
```

如果：

```text
TaskExecutionResult.canEnterDiagnosisRuntime = false
```

则 Phase 9.3 必须阻断。

Phase 9.2 判断：

```text
这次作答是否值得诊断？
```

Phase 9.3 判断：

```text
这次有效作答能否安全回流为 Evidence？
```

## 十六、与 Phase 8 的关系

Phase 9.3 成功生成 Evidence 后，必须重新接入 Existing Phase 8 Runtime：

```text
AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> GrowthMemoryRecord
```

Phase 9.3 不替代 Phase 8。

Phase 9.3 只是 Phase 8 的真实任务数据入口。

## 十七、最终结论

Phase 9.3 是 Phase 9 的证据回流节点。

它不负责让任务更好，也不负责证明学生能力提升。

它只负责证明：

```text
经过有效性校验的学生真实作答，
可以安全进入 Diagnosis Runtime，
生成可追溯 AbilityEvidence，
并重新接入 Existing Phase 8 Runtime。
```

Phase 9.3 完成后，Phase 9 的真实任务执行闭环将成立：

```text
ConcreteLearningTask
-> StudentResponse
-> TaskExecutionResult
-> DiagnosisResult
-> AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> GrowthMemoryRecord
```
