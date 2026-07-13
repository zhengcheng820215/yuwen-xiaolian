# Phase 9：真实任务执行与证据回流最小闭环（Real Task Execution & Evidence Return）

## 一、阶段定位

Phase 9 的目标是让系统从“决定下一步做什么”进入“学生实际完成任务并产生新证据”。

Phase 8 已经完成：

```text
GrowthMemorySummary
-> NextLearningStrategy
-> StrategyValidationResult
-> TaskRequest
-> TaskFulfillmentRequest
-> TaskResourceMatchResult
-> ExecutableLearningTask / TaskGenerationRequest
```

这说明系统已经能够回答：

```text
学生下一步需要什么任务？
有没有可匹配的任务资源？
如果没有，是否需要请求生成任务？
```

但 Phase 8 尚未完成：

```text
学生看到任务
-> 学生作答
-> 系统接收答案
-> 生成 DiagnosisResult
-> 形成新的 AbilityEvidence
-> 回流到 Evaluation / Profile / Growth Memory
```

Phase 9 补齐这一段。

## 二、一句话定义

Phase 9 是真实任务执行与证据回流最小闭环。

它将 Phase 8.4 产出的 `ExecutableLearningTask` 或 `TaskGenerationRequest` 转化为学生可完成的 `ConcreteLearningTask`，接收学生真实作答，并将执行结果重新沉淀为 `AbilityEvidence`。

## 三、核心问题

Phase 9 只回答一个核心问题：

```text
一个真实可执行任务，能否被学生完成，并将结果稳定回流为可评估证据？
```

Phase 9 不证明：

- 任务质量已经足够好；
- 学生能力已经提升；
- 任务能够长期稳定提高成绩；
- 系统已经具备完整题库能力；
- 系统已经具备正式学习产品体验。

Phase 9 证明的是：

```text
真实任务执行结果可以进入 Diagnosis，
并形成可被 Evaluation 和 Growth Runtime 消费的新 Evidence。
```

## 四、核心链路

Phase 9 的完整目标链路：

```text
ExecutableLearningTask
或
TaskGenerationRequest
↓
ConcreteLearningTask
↓
TaskReadinessValidation
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
│  DiagnosisResult
│  ↓
│  AbilityEvidence
│  ↓
│  Existing Phase 8 Runtime
│  ↓
│  EvaluationResult
│  ↓
│  ProfileUpdateDecision
│  ↓
│  GrowthMemoryRecord
│
└─ canEnterDiagnosisRuntime = false
   ↓
   blocked / retry / supplement response / stop
```

核心约束：

- 无效作答不得进入 Diagnosis Runtime。
- 无效作答不得生成 weakness Evidence。
- 任务已提交不等于作答有效。
- 作答有效不等于能力已经形成。
- 产生 Evidence 不等于允许更新 Profile。

这条链路使系统第一次形成真正的连续学习循环：

```text
历史记忆
-> 学习策略
-> 任务请求
-> 真实任务
-> 学生作答
-> 新证据
-> 新评估
-> 新记忆
-> 下一步策略
```

## 五、阶段拆分

Phase 9 拆为三个最小闭环。

| 阶段 | 核心问题 | 输入 | 输出 |
| --- | --- | --- | --- |
| Phase 9.1 | 任务能否被实例化为学生可完成内容 | ExecutableLearningTask / TaskGenerationRequest | ConcreteLearningTask / TaskReadinessValidation |
| Phase 9.2 | 学生能否真实开始、提交任务并通过作答有效性判断 | Ready ConcreteLearningTask | TaskExecutionSession / StudentResponse / ResponseValidityResult / TaskExecutionResult |
| Phase 9.3 | 有效作答能否回流为诊断与证据 | Valid TaskExecutionResult + ConcreteLearningTask | DiagnosisResult / AbilityEvidence，并集成调用 Existing Phase 8 Runtime |

Phase 9 不再继续拆分 9.1.1、9.1.2 等更细阶段。

如果需要说明内部步骤，应写在对应 Phase 文档中，不新增更细 Phase 文件。

## 六、Phase 9.1：任务实例化

Phase 9.1 只解决：

```text
ExecutableLearningTask / TaskGenerationRequest
-> ConcreteLearningTask
-> TaskReadinessValidation
```

它负责让任务从“资源匹配结果或生成请求”变成学生真正可以看到、理解、作答，并能被诊断的任务内容。

Phase 9.1 不接收学生答案，不调用 Diagnosis，不生成 Evidence。

## 七、Phase 9.2：任务执行

Phase 9.2 只解决：

```text
ConcreteLearningTask
-> TaskExecutionSession
-> StudentResponse
-> ResponseValidityResult
-> TaskExecutionResult
```

它负责：

- 向学生展示任务；
- 创建任务执行 Session；
- 接收学生作答；
- 记录开始、提交和中断状态；
- 记录是否使用提示；
- 记录作答时间；
- 判断作答是否有效；
- 生成 ResponseValidityResult；
- 生成 TaskExecutionResult；
- 决定 canEnterDiagnosisRuntime。

Phase 9.2 不负责判断能力，不更新画像，不生成长期结论。

Phase 9.2 不负责：

- 解释学生能力；
- 生成 DiagnosisResult；
- 生成 AbilityEvidence；
- 更新 StudentAbilityProfile；
- 生成长期结论。

## 八、Phase 9.3：执行结果回流

Phase 9.3 只解决：

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

它证明：

- 真实作答可以进入 Diagnosis Runtime；
- 作答结果可以形成新的 AbilityEvidence；
- Evidence 可以重新进入 Existing Phase 8 Runtime；
- EvaluationResult 可以形成 ProfileUpdateDecision；
- 本次执行事件可以沉淀为 GrowthMemoryRecord。

Phase 9.3 不证明学生能力已经长期提升。

Phase 9.3 复用已有的 Diagnosis Runtime、AbilityEvidence 转换、Evaluation、ProfileUpdateDecision、Profile Executor 和 GrowthMemory 模块。

Phase 9.3 不重新定义、不复制、不创建第二条能力判断或画像更新链路。

Phase 9.3 新增的核心能力只是：

```text
将真实任务执行结果适配到现有 Diagnosis 和 Evidence 链路，
并验证 Evidence 能重新进入 Phase 8 Runtime。
```

工程验收状态：

```text
Debug  PASS
Build  PASS
Demo   Not Required
```

Phase 9.3 已完成 6 类 Debug Case：

1. 有效作答正常回流；
2. 无效作答被阻断；
3. 使用提示后作答并保留提示依赖；
4. Diagnosis 与任务目标能力一致；
5. Diagnosis 与任务目标能力不一致并进入复核；
6. Diagnosis Schema 失败并阻断 Evidence 生成。

## 九、核心数据对象

Phase 9 至少涉及以下对象：

- `ExecutableLearningTask`
- `TaskGenerationRequest`
- `ConcreteLearningTask`
- `TaskReadinessValidation`
- `TaskExecutionSession`
- `StudentResponse`
- `ResponseValidityResult`
- `TaskExecutionResult`
- `DiagnosisResult`
- `AbilityEvidence`
- `TaskEvidenceReturnResult`
- `EvaluationResult`
- `ProfileUpdateDecision`
- `GrowthMemoryRecord`

其中：

```text
ConcreteLearningTask 是 Phase 9 的关键新增对象。
```

它是学生真实执行任务的标准输入。

同时：

```text
ResponseValidityResult 是学生作答进入 Diagnosis 前的有效性闸门。

TaskExecutionResult 是 Phase 9.2 与 Phase 9.3 之间的正式交接对象。
```

### ResponseValidityResult

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

无效作答包括：

- 空答案；
- 纯数字或无意义字符；
- “哈哈”；
- “不知道”；
- 复制题干；
- 明显无关回答。

这些作答均不能直接生成能力弱点结论。

它们应输出 `insufficient evidence` 或对应无效状态，并阻断 Diagnosis。

### TaskExecutionResult

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

  canEnterDiagnosisRuntime: boolean;
};
```

`TaskExecutionResult` 属于 Phase 9.2 输出。

Phase 9.3 不直接消费未经验证的 `StudentResponse`。

Phase 9.3 应消费：

```text
TaskExecutionResult
+ ConcreteLearningTask
```

## 十、Phase 9 最小验收目标

Phase 9 完成时，系统应能证明：

1. 能消费 Phase 8.4 产出的 `ExecutableLearningTask`。
2. 能消费 Phase 8.4 产出的 `TaskGenerationRequest`。
3. 能生成学生可完成的 `ConcreteLearningTask`。
4. 学生能够看到任务内容并提交答案。
5. 系统能够生成 `StudentResponse`。
6. 系统能够判断作答是否有效。
7. 系统能够生成 `ResponseValidityResult`。
8. 系统能够生成 `TaskExecutionResult`。
9. 无效作答不得进入 Diagnosis Runtime。
10. 无效作答不得生成 weakness Evidence。
11. 有效作答能够进入 Diagnosis Runtime。
12. DiagnosisResult 能够转换为 AbilityEvidence。
13. AbilityEvidence 能进入 Existing Phase 8 Runtime。
14. EvaluationResult 能生成 ProfileUpdateDecision。
15. 本次任务执行能形成 GrowthMemoryRecord。
16. Debug 可以重复运行并输出 PASS / FAIL。
17. Build 可以通过。

## 十一、验收案例

Phase 9 至少需要覆盖以下验收案例：

### Case 1：正常有效作答

```text
ResponseValidityResult.status = valid
canEnterDiagnosisRuntime = true
-> 生成 DiagnosisResult 和 AbilityEvidence
```

### Case 2：空答案

```text
canEnterDiagnosisRuntime = false
-> 不生成 weakness Evidence
```

### Case 3：“不知道”或占位回答

```text
ResponseValidityResult.status = placeholder / insufficient
-> insufficient evidence
-> 不修改 Profile
```

### Case 4：明显无关回答

```text
ResponseValidityResult.status = irrelevant
-> blocked
-> 不进入 Diagnosis
```

### Case 5：使用提示后完成

```text
允许诊断
但 Evidence 必须保留 usedHint / 提示依赖信息
-> 不等同独立掌握
```

### Case 6：身份或来源不一致

```text
studentId / taskId / executionSessionId 不一致
-> 阻断流程
```

### Case 7：合法 Evidence 回流

```text
复用 Existing Phase 8 Runtime
-> 形成 EvaluationResult、ProfileUpdateDecision、GrowthMemoryRecord
```

## 十二、本阶段不做

Phase 9 不做：

- 不做大型题库；
- 不做自动无限出题；
- 不做真实 LLM 出题；
- 不做复杂家长报告；
- 不做多天学习计划；
- 不做完整学生账号系统；
- 不做长期成长曲线；
- 不做商业化 UI；
- 不做复杂课程体系；
- 不证明任务教学效果已经稳定；
- 不证明学生能力已经长期提升。

## 十三、与 Phase 8 的关系

Phase 8 负责：

```text
从 Evidence / Growth Memory 中决定下一步需要什么任务。
```

Phase 9 负责：

```text
让这个任务真正被学生完成，并把结果回流为新的 Evidence。
```

二者关系：

```text
Phase 8:
GrowthMemorySummary
-> NextLearningStrategy
-> TaskRequest
-> ExecutableLearningTask / TaskGenerationRequest

Phase 9:
ExecutableLearningTask / TaskGenerationRequest
-> ConcreteLearningTask
-> TaskExecutionResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
-> GrowthMemoryRecord
```

## 十四、阶段能力表述

Phase 9 完成后，可以宣称：

```text
系统能够将任务资源或生成请求实例化为可执行学习任务，
接收并校验学生真实作答，
将有效作答转换为 DiagnosisResult 和 AbilityEvidence，
并重新接入已有 Evaluation、Profile Update 和 Growth Memory 链路。
```

Phase 9 完成后，不能宣称：

- 已形成正式学生产品；
- 已具备大型题库；
- 已证明任务策略有效；
- 已证明学生能力长期提升；
- 已具备完整日常学习体验。

## 十五、最终结论

Phase 9 的目标不是增加更多题目，也不是一次性完成正式学习产品。

Phase 9 的目标是完成真实学习行为进入 Runtime 的关键一跳：

```text
任务可执行
-> 学生可作答
-> 结果可诊断
-> 证据可回流
```

完成 Phase 9 后，系统才真正从“可运行的学习 Runtime”进入“能够消费真实学习行为的学习 Runtime”。
