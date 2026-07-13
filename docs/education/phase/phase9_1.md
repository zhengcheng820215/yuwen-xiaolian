# Phase 9.1：任务实例化最小闭环（Concrete Learning Task Instantiation）

## 一、阶段目标

Phase 9.1 只解决一个核心问题：

```text
系统能否把 ExecutableLearningTask 或 TaskGenerationRequest
转化为学生真正可以看到、理解、作答，并能被诊断的 ConcreteLearningTask？
```

Phase 9.1 的一句话定义：

```text
将任务资源匹配结果或任务生成请求实例化为学生可执行的具体学习任务。
```

## 二、阶段背景

Phase 8.4 已经完成：

```text
TaskRequest
-> TaskFulfillmentRequest
-> TaskResourceMatchResult
-> ExecutableLearningTask / TaskGenerationRequest
```

但 `ExecutableLearningTask` 或 `TaskGenerationRequest` 仍然不是完整的学生执行输入。

学生真正需要的是：

- 阅读材料；
- 题干；
- 作答要求；
- 参考表达、评分要点或 Rubric；
- Rubric；
- QuestionMetadata；
- 目标能力；
- 诊断关注点；
- 可执行性校验结果。

Phase 9.1 负责补齐这些任务内容。

## 三、核心链路

Phase 9.1 的最小链路：

```text
ExecutableLearningTask
或
TaskGenerationRequest
↓
ConcreteLearningTask
↓
TaskReadinessValidation
```

Phase 9.1 到“任务可执行”就停止。

Phase 9.1 不接收学生答案，不启动任务执行，不调用 Diagnosis Runtime，不生成 AbilityEvidence。

## 四、输入

Phase 9.1 支持两类输入。

### 1. ExecutableLearningTask

来自 Phase 8.4 资源匹配成功分支。

它表示系统已经找到一个可用任务资源。

Phase 9.1 需要将其整理为标准 `ConcreteLearningTask`。

### 2. TaskGenerationRequest

来自 Phase 8.4 无匹配或需要生成分支。

它表示当前没有合适任务资源，需要生成或临时构造一个任务。

Phase 9.1 第一版可以使用：

- 人工预置任务；
- mock 真实任务；
- 少量合法自建任务。

本阶段不要求接真实 LLM 出题。

## 五、输出

Phase 9.1 输出两个对象：

```text
ConcreteLearningTask
TaskReadinessValidation
```

### ConcreteLearningTask

`ConcreteLearningTask` 是学生真实执行任务的标准输入。

建议最小结构：

```ts
type ConcreteLearningTask = {
  taskId: string;
  studentId: string;

  sourceType: 'matched_resource' | 'generated_request' | 'mock';
  sourceTaskRequestId?: string;
  sourceExecutableTaskId?: string;
  sourceTaskGenerationRequestId?: string;

  targetAbilityId: string;
  targetAbilityName: string;
  taskRole: 'training' | 'retest' | 'transfer' | 'diagnosis' | 'observation';
  validationGoal: string;

  readingText?: string;
  question: string;
  answerRequirements: string[];
  referenceAnswer?: string;
  scoringPoints: string[];
  rubric: Rubric[];

  questionMetadata: QuestionMetadata;

  expectedDiagnosisFocus: string[];
};
```

说明：

- `QuestionMetadata` 必须复用现有题目元数据模型，不在 Phase 9.1 中重新定义一套相似结构。
- `Rubric` 必须复用现有 Rubric 语义，不在 Phase 9.1 中创造新的评分字段体系。
- `referenceAnswer` 是参考表达，不代表唯一接受答案。
- 开放题诊断主要依赖 `scoringPoints`、`rubric`、`questionMetadata` 和作答质量，而不是简单匹配 `referenceAnswer`。
- `readingText` 是否必填取决于任务类型。阅读类任务必须具备文本材料；表达修改、微写作、单句理解等任务可以没有独立阅读材料。

### TaskReadinessValidation

`TaskReadinessValidation` 用于判断任务是否可以进入 Phase 9.2 任务执行。

建议最小结构：

```ts
type TaskReadinessValidation = {
  taskId: string;
  canExecute: boolean;

  checks: {
    canDisplay: boolean;
    canAcceptResponse: boolean;
    hasAssessmentBasis: boolean;
    metadataComplete: boolean;
    targetAbilityAligned: boolean;
    taskRoleAligned: boolean;
    validationGoalPreserved: boolean;
    sourceTraceable: boolean;
    canEnterDiagnosisRuntime: boolean;
  };

  issues: TaskReadinessIssue[];
};
```

其中：

```text
canDisplay
表示任务内容能否展示给学生。

canAcceptResponse
表示任务是否有明确作答要求，能够接收学生答案。

hasAssessmentBasis
表示任务是否具备诊断依据。
它不要求 referenceAnswer 永远非空，而是满足以下任一条件即可：

referenceAnswer 非空
或 scoringPoints.length > 0
或 rubric.length > 0

metadataComplete
表示 QuestionMetadata 是否完整。

sourceTraceable
表示任务能否回溯到上游 TaskRequest、ExecutableLearningTask 或 TaskGenerationRequest。
```

`canExecute` 的最小判断规则：

```text
canExecute =
  canDisplay
  && canAcceptResponse
  && hasAssessmentBasis
  && metadataComplete
  && targetAbilityAligned
  && taskRoleAligned
  && validationGoalPreserved
  && sourceTraceable
  && canEnterDiagnosisRuntime
```

## 六、内部步骤

Phase 9.1 不再拆成更细 Phase，但内部包含三个步骤。

### 1. 输入解析

识别当前输入来自：

- `ExecutableLearningTask`
- `TaskGenerationRequest`

并保留来源信息。

系统必须能够追溯：

- 任务来自哪个 `TaskRequest`；
- 任务来自匹配资源还是生成请求；
- 目标能力和验证目标是什么。

### 2. 任务实例化

将输入转化为 `ConcreteLearningTask`。

实例化必须补齐：

- `question`
- `answerRequirements`
- `referenceAnswer`、`scoringPoints` 或 `rubric` 中至少一种评价依据
- `questionMetadata`
- `expectedDiagnosisFocus`

对于阅读类任务，还必须补齐 `readingText`。

任务必须让学生能够直接完成。

### 3. 可执行性校验

生成 `TaskReadinessValidation`。

只有当任务具备以下条件时，才能进入 Phase 9.2：

- 如果任务类型需要阅读材料，则必须有明确阅读材料或任务材料；
- 有明确题干；
- 有明确作答要求；
- 有参考表达、评分要点或 Rubric 作为评价依据；
- 有 QuestionMetadata；
- 目标能力与任务内容一致；
- 学生、任务角色、验证目标和来源 ID 可追溯；
- 能够进入 Diagnosis Runtime。

## 七、核心规则

1. `ConcreteLearningTask.targetAbilityId` 必须来自上游任务请求或可执行任务。
2. `ConcreteLearningTask.validationGoal` 必须保留上游策略目标。
3. 任务内容必须能被学生理解和作答。
4. 任务必须包含可供 Diagnosis 使用的评价依据：`referenceAnswer`、`scoringPoints` 或 `rubric` 至少一种。
5. 任务必须包含 `questionMetadata`，Diagnosis 不应重新解释题目意图。
6. `rubric` 必须可观察、可诊断。
7. `referenceAnswer` 是参考表达，不代表唯一标准答案。
8. 阅读类任务缺少 `readingText` 时，`TaskReadinessValidation.canExecute = false`。
9. 非阅读类任务不因 `readingText` 缺失而自动失败。
10. `studentId` 必须与上游任务来源一致。
11. `targetAbilityId` 必须与上游任务来源一致。
12. `taskRole` 必须与上游任务来源一致。
13. `validationGoal` 不得被改写或丢失。
14. `questionMetadata.mainAbility` 应与目标能力保持一致。
15. `rubric` 主能力应与目标能力保持一致。
16. 任务必须能回溯到上游 `TaskRequest`、`ExecutableLearningTask` 或 `TaskGenerationRequest`。
17. 如果关键字段缺失或语义不一致，`TaskReadinessValidation.canExecute = false`。
18. `canExecute = false` 时不得进入 Phase 9.2。
19. 本阶段不得因为缺少资源而直接调用真实 LLM 出题。
20. 本阶段不得生成 AbilityEvidence。

## 八、Debug 最小流程

Debug 需要同时覆盖成功路径和关键失败路径，证明 Readiness Validation 不只是检查字段是否存在，也检查字段是否一致。

### Case 1：matched resource

```text
ExecutableLearningTask
-> ConcreteLearningTask
-> TaskReadinessValidation(canExecute = true)
```

### Case 2：generation request

```text
TaskGenerationRequest
-> mock ConcreteLearningTask
-> TaskReadinessValidation(canExecute = true)
```

### Case 3：缺少评价依据

```text
缺少 referenceAnswer、scoringPoints 和 rubric
-> hasAssessmentBasis = false
-> TaskReadinessValidation(canExecute = false)
```

### Case 4：能力不一致

```text
targetAbilityId = reasoning
questionMetadata.mainAbility = information_extraction
-> targetAbilityAligned = false
-> TaskReadinessValidation(canExecute = false)
```

### Case 5：来源不可追溯

```text
缺少 sourceTaskRequestId / sourceExecutableTaskId / sourceTaskGenerationRequestId
-> sourceTraceable = false
-> TaskReadinessValidation(canExecute = false)
```

### Case 6：阅读类任务缺少阅读材料

```text
任务类型需要阅读材料
但 readingText 缺失
-> canDisplay = false
-> TaskReadinessValidation(canExecute = false)
```

## 九、Debug Report

Debug Report 至少展示：

- inputType；
- sourceTaskRequestId；
- targetAbilityId；
- taskRole；
- validationGoal；
- generated taskId；
- readingText 是否存在；
- readingText 是否为当前任务类型必需；
- question 是否存在；
- referenceAnswer 是否存在；
- scoringPoints 数量；
- rubric 数量；
- questionMetadata.mainAbility；
- expectedDiagnosisFocus；
- canDisplay；
- canAcceptResponse；
- hasAssessmentBasis；
- metadataComplete；
- targetAbilityAligned；
- taskRoleAligned；
- validationGoalPreserved；
- sourceTraceable；
- canEnterDiagnosisRuntime；
- canExecute；
- validation issues；
- PASS / FAIL。

## 十、验收标准

Phase 9.1 通过条件：

1. 能读取 `ExecutableLearningTask`。
2. 能读取 `TaskGenerationRequest`。
3. 能生成 `ConcreteLearningTask`。
4. `ConcreteLearningTask.taskId` 非空。
5. `ConcreteLearningTask.targetAbilityId` 非空。
6. `ConcreteLearningTask.validationGoal` 非空。
7. 阅读类任务中 `ConcreteLearningTask.readingText` 非空。
8. `ConcreteLearningTask.question` 非空。
9. `ConcreteLearningTask.answerRequirements.length > 0`。
10. `ConcreteLearningTask.referenceAnswer`、`scoringPoints` 或 `rubric` 至少提供一种评价依据。
11. 开放题不把 `referenceAnswer` 当作唯一标准答案。
12. `ConcreteLearningTask.rubric` 复用现有 Rubric 语义。
13. `ConcreteLearningTask.questionMetadata.mainAbility` 非空。
14. `ConcreteLearningTask.questionMetadata` 复用现有 QuestionMetadata 语义。
15. `ConcreteLearningTask.expectedDiagnosisFocus.length > 0`。
16. 能生成 `TaskReadinessValidation`。
17. 合法任务 `TaskReadinessValidation.canExecute = true`。
18. 缺少评价依据时 `TaskReadinessValidation.canExecute = false`。
19. 能力不一致时 `TaskReadinessValidation.canExecute = false`。
20. 来源不可追溯时 `TaskReadinessValidation.canExecute = false`。
21. 阅读类任务缺少阅读材料时 `TaskReadinessValidation.canExecute = false`。
22. Debug 输出 PASS。
23. Build 通过。

## 十一、本阶段不做

Phase 9.1 不做：

- 不展示学生执行页面；
- 不接收学生答案；
- 不创建 TaskExecutionSession；
- 不生成 StudentResponse；
- 不调用 Diagnosis Runtime；
- 不生成 DiagnosisResult；
- 不生成 AbilityEvidence；
- 不执行 Evaluation；
- 不更新 StudentAbilityProfile；
- 不写入 GrowthMemory；
- 不接真实题库；
- 不接真实 LLM 出题；
- 不做正式 UI。

## 十二、与 Phase 9.2 的关系

Phase 9.1 输出：

```text
ConcreteLearningTask
TaskReadinessValidation
```

Phase 9.2 消费：

```text
ConcreteLearningTask
```

并继续完成：

```text
ConcreteLearningTask
-> TaskExecutionSession
-> StudentResponse
```

因此，Phase 9.1 的完成标准不是“学生已经作答”，而是：

```text
任务已经具备进入学生执行环节的条件。
```

## 十三、工程验收记录

验收状态：

```text
PASS
```

验收性质：

```text
工程最小闭环通过
```

已完成工程文件：

- `src/ai/schemas/concreteLearningTask.schema.ts`
- `src/ai/agents/concreteLearningTaskAgent.ts`
- `src/ai/tests/runConcreteLearningTaskDebug.ts`

新增 Debug 命令：

```text
debug:phase9-1
```

Debug 已覆盖：

1. matched resource 成功生成 `ConcreteLearningTask`。
2. generation request 成功生成 mock `ConcreteLearningTask`。
3. 缺少评价依据时 `canExecute = false`。
4. 能力不一致时 `canExecute = false`。
5. 来源不可追溯时 `canExecute = false`。
6. 阅读类任务缺少 `readingText` 时 `canExecute = false`。

验收结果：

```text
Debug PASS
Build PASS
Demo Not Required
```

说明：

Phase 9.1 不涉及学生作答，因此不需要 Demo 页面验收。

Phase 9.1 的通过只证明任务可以被实例化为可执行学习任务，不证明任务执行、诊断回流或学习效果。

## 十四、最终结论

Phase 9.1 是真实任务执行链路的入口。

它不负责学习效果，也不负责诊断。

它只负责把上游策略和任务请求真正落成一个可执行任务：

```text
有内容
有题干
有要求
有评分依据
有元数据
可作答
可诊断
```

只有完成这一步，Phase 9.2 才能让学生真实开始任务执行。
