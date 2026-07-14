# Phase 12.2：真实题目输入与任务准备最小闭环（Real Question Resource Preparation）

## 一、阶段目标

Phase 12.2 只解决一个核心问题：

```text
真实题目能否以完整、可追溯、可执行的结构进入 Runtime？
```

Phase 12.2 的一句话定义：

```text
将人工录入的一道真实语文阅读题转换为可复用 TaskResource，并通过现有 TaskFulfillment 生成 ConcreteLearningTask。
```

Phase 12.2 不是题库系统。

Phase 12.2 也不是自动出题系统。

它只验证：

```text
一题真实题目
↓
结构化资源
↓
完整性校验
↓
TaskFulfillment
↓
可执行学习任务
```

这一条最小链路是否成立。

## 二、阶段背景

Phase 12.1 已经完成学习回合持久化与恢复。

系统已经能够保存：

```text
LearningRoundResult
StudentResponse
StudentLearningFeedback
StudentRoundSummary
GrowthMemorySummary
```

但如果题目仍来自 Demo Mock，系统还不能自然用于真实学习。

Phase 12.2 的目标是让真实题目进入 Runtime。

注意：

```text
真实题目录入的是可复用资源，不是一次性页面题目。
```

因此 Phase 12.2 必须继续接入现有 Phase 8 / Phase 9 / Phase 10 的任务链路，而不是绕开它们。

## 三、核心链路

Phase 12.2 的最小链路：

```text
Raw Question Input
↓
TaskResourceDraft
↓
Resource Validation
↓
TaskResource
↓
Phase 8 TaskFulfillment
↓
ConcreteLearningTask
↓
TaskReadinessValidation
```

Phase 12.2 证明：

```text
真实录入的题目可以成为 Runtime 可消费的任务资源。
```

## 四、输入

Phase 12.2 输入一份人工录入的真实题目。

最小输入：

```ts
type TaskResourceInput = {
  title?: string;
  externalResourceId?: string;

  readingText?: string;
  questionText: string;
  answerRequirements: string[];

  questionType:
    | 'reading_open_response'
    | 'sentence_interpretation'
    | 'expression'
    | 'micro_writing';
  targetAbilityId: string;

  referenceAnswer?: string;
  assessmentBasis: string[];
  rubric?: unknown;

  source: {
    type: 'manual' | 'textbook' | 'exam';
    description?: string;
    title?: string;
    grade?: string;
    edition?: string;
    year?: string;
    pageOrQuestionNo?: string;
  };
};
```

字段说明：

- `readingText` 是阅读材料；阅读类题目必须提供；
- `questionText` 是题干；
- `answerRequirements` 是学生作答要求；
- `questionType` 使用受控集合描述题目类型；
- `targetAbilityId` 描述本题主要训练或验证的能力；
- `referenceAnswer` 是参考表达，不代表唯一标准答案；
- `assessmentBasis` 是评分或诊断依据；
- `rubric` 是可选细化评价规则；
- `source` 用于追溯题目来源。
- `externalResourceId` 用于记录外部题库或教材编号，不作为系统内部主键。

`TaskResourceInput` 不包含正式 `resourceId`。

正式 `resourceId` 必须由系统在创建 `TaskResource` 时生成。

这样可以避免人工录入造成重复 ID、格式不一致或外部编号污染内部主键。

开放题的判断依据不应只依赖 `referenceAnswer`。

Phase 12.2 的评价依据规则是：

```text
referenceAnswer 非空
或 assessmentBasis.length > 0
或 rubric 足以支持诊断
```

只要三者之一足以支持后续 Diagnosis，即可认为存在评价依据。

`rubric` 是否足以支持诊断，不能只看对象是否存在。

以下情况不能算作有效评价依据：

```text
rubric = {}
rubric = []
rubric 存在但没有有效评价维度
rubric 存在但没有可观察判断规则
```

rubric 必须通过既有 Rubric Schema 或专门校验器确认，至少包含一个有效评价维度、评分点或诊断规则。

## 五、输出

Phase 12.2 输出三个对象：

```text
TaskResourceDraft
TaskResourceValidationResult
TaskResource
```

并验证该 `TaskResource` 可以进入：

```text
TaskFulfillment
↓
ConcreteLearningTask
```

建议最小结构：

```ts
type TaskResourceDraft = {
  draftId: string;
  studentId?: string;
  input: TaskResourceInput;
  status: 'draft' | 'validation_failed' | 'ready';
  createdAt: string;
  updatedAt: string;
};

type TaskResourceValidationResult = {
  draftId: string;
  canSaveDraft: boolean;
  canCreateResource: boolean;
  canEnterTaskFulfillment: boolean;
  checks: {
    hasQuestionText: boolean;
    hasAnswerRequirements: boolean;
    hasAssessmentBasis: boolean;
    hasTargetAbility: boolean;
    hasSource: boolean;
    readingTextRequired: boolean;
    readingTextProvided: boolean;
    abilityAligned: boolean;
    metadataReady: boolean;
    traceable: boolean;
  };
  issues: {
    code: string;
    message: string;
    blocking: boolean;
  }[];
};

type TaskResource = {
  resourceId: string;
  externalResourceId?: string;
  title: string;
  readingText?: string;
  questionText: string;
  answerRequirements: string[];
  questionType:
    | 'reading_open_response'
    | 'sentence_interpretation'
    | 'expression'
    | 'micro_writing';
  targetAbilityId: string;
  referenceAnswer?: string;
  assessmentBasis: string[];
  rubric?: unknown;
  status: 'ready' | 'active';
  source: {
    type: 'manual' | 'textbook' | 'exam';
    description?: string;
    title?: string;
    grade?: string;
    edition?: string;
    year?: string;
    pageOrQuestionNo?: string;
  };
  createdAt: string;
  updatedAt: string;
};
```

说明：

- `TaskResourceDraft` 是录入草稿；
- `TaskResourceValidationResult` 是资源完整性检查结果；
- `TaskResource` 是正式可复用任务资源；
- `TaskResource` 不是页面临时题目；
- `TaskResource` 必须能被 Phase 8 TaskFulfillment 消费。

三种状态必须区分：

```text
canSaveDraft
= 是否可以保存录入草稿；

canCreateResource
= 是否可以生成正式 TaskResource；

canEnterTaskFulfillment
= 是否满足当前 Runtime 消费条件。
```

规则：

- Draft 默认允许保存；
- `canCreateResource = false` 时只能保留 Draft；
- 只有正式 `TaskResource` 创建成功后，才允许进入 `TaskFulfillment`；
- `canEnterTaskFulfillment = false` 时不得生成 `ConcreteLearningTask`。

最小资源生命周期：

```text
draft
↓
validation_failed / ready
↓
active
```

说明：

- `draft` 表示尚未完成录入；
- `validation_failed` 表示校验未通过，只能继续编辑；
- `ready` 表示可以生成正式资源或等待进入 TaskFulfillment；
- `active` 表示已经成为正式可用资源。

## 六、资源完整性规则

### 1. 题干必须存在

`questionText` 不能为空。

没有题干的资源不能生成正式 `TaskResource`。

### 2. 作答要求必须存在

`answerRequirements` 至少包含一条。

学生必须知道如何作答。

### 3. 必须存在评价依据

以下至少满足一项：

```text
referenceAnswer 非空；
assessmentBasis.length > 0；
rubric 可支持诊断。
```

没有评价依据的题目可以保存为草稿，但不能生成正式 `TaskResource`，也不能进入 `TaskFulfillment`。

### 4. 目标能力必须存在

`targetAbilityId` 不能为空。

Phase 12.2 不负责自动判断目标能力。

如果后续需要自动生成能力 Metadata，应由 Question Metadata Agent 或后续阶段承担。

### 5. 阅读材料是否必填由题型决定

`questionType` 必须使用受控集合。

Phase 12.2 MVP 支持：

```ts
type QuestionType =
  | 'reading_open_response'
  | 'sentence_interpretation'
  | 'expression'
  | 'micro_writing';
```

不得通过自由文本或题型名称关键词判断是否需要阅读材料。

对于阅读类题目：

```text
readingTextRequired = true
readingTextProvided = true
```

第一版中：

- `reading_open_response` 必须提供 `readingText`；
- `sentence_interpretation` 可以提供 `readingText`，但不一定强制；
- `expression` 可以不提供 `readingText`；
- `micro_writing` 可以不提供 `readingText`。

如果题型不需要独立阅读材料，例如单句修改、表达练习、微写作，则 `readingText` 可以为空。

第一版 MVP 可以优先支持阅读类开放题。

### 6. 来源必须可追溯

`source.type` 必须存在。

`manual` 表示人工录入；
`textbook` 表示教材来源；
`exam` 表示试卷来源。

无来源信息的资源不得直接进入正式 Runtime。

来源字段建议包含：

```ts
source: {
  type: 'manual' | 'textbook' | 'exam';
  description?: string;
  title?: string;
  grade?: string;
  edition?: string;
  year?: string;
  pageOrQuestionNo?: string;
}
```

对于 `textbook` 或 `exam`，至少必须提供 `description` 或等价来源说明。

仅有：

```text
source.type = exam
```

不足以证明来源可追溯。

### 7. 不允许绕开 TaskFulfillment

Phase 12.2 不得直接把录入内容拼成页面题目。

正确链路是：

```text
TaskResource
↓
TaskFulfillment
↓
ConcreteLearningTask
```

页面只展示 `ConcreteLearningTask`。

## 七、与 Question Metadata 的关系

Phase 12.2 不重新定义 Question Metadata。

如果需要题目元数据，应复用现有：

```text
QuestionMetadata
```

TaskResource 可以包含或关联 QuestionMetadata，但不得创建另一套相似结构。

规则：

```text
QuestionMetadata 描述题目如何被系统理解；
TaskResource 描述真实题目资源如何被保存和复用；
ConcreteLearningTask 描述某一轮中学生实际要完成的任务。
```

三者不能混用。

## 八、与 Phase 8 TaskFulfillment 的关系

Phase 12.2 的 `TaskResource` 必须能进入现有 Phase 8 TaskFulfillment。

Phase 8 仍然负责：

```text
TaskRequest
↓
TaskFulfillment
↓
ConcreteLearningTask
```

Phase 12.2 只提供真实资源。

它不决定下一步策略，不决定任务是否适合当前学生，也不直接生成学习回合。

## 九、存储边界

Phase 12.2 可以复用 Phase 12.1 的 Repository 思想。

建议新增或复用：

```text
TaskResourceRepository
```

职责：

```text
saveDraft(draft)
saveResource(resource)
loadResource(resourceId)
listResources()
clear()
```

第一版可以使用 IndexedDB。

页面不得直接读写：

```text
localStorage
indexedDB
```

页面只能调用 API / Agent / Repository 边界。

## 十、最小 Debug 流程

Phase 12.2 Debug 最小流程：

1. 创建一条真实阅读题输入；
2. 生成 `TaskResourceDraft`；
3. 运行 Resource Validation；
4. 校验 `canSaveDraft`、`canCreateResource`、`canEnterTaskFulfillment`；
5. 生成正式 `TaskResource`；
6. 构造一个最小 `TaskRequest`；
7. 进入现有 TaskFulfillment；
8. 生成 `ConcreteLearningTask`；
9. 运行 TaskReadinessValidation；
10. 输出 PASS / FAIL。

Debug 不需要学生作答。

Debug 不需要进入 Diagnosis。

Debug 只证明：

```text
真实题目资源可以准备好，并生成可执行任务。
```

## 十一、Debug Case

Phase 12.2 Debug 至少覆盖以下样例：

| Case | 输入 | 预期 |
| --- | --- | --- |
| 正常阅读题 | readingText + questionText + answerRequirements + assessmentBasis + targetAbilityId + source | 生成 TaskResource，进入 TaskFulfillment，生成 ConcreteLearningTask |
| 缺少评价依据 | 无 referenceAnswer、assessmentBasis、rubric | canSaveDraft = true，canCreateResource = false |
| 空 rubric | rubric = {}，referenceAnswer 为空，assessmentBasis 为空 | hasAssessmentBasis = false，canCreateResource = false |
| 缺少目标能力 | targetAbilityId 为空 | canCreateResource = false |
| 阅读题缺少材料 | questionType 为阅读类，但 readingText 为空 | canCreateResource = false |
| 非阅读表达题 | readingText 为空，但 questionType 不要求阅读材料 | 可生成 TaskResource |
| 缺少来源 | source 缺失 | canCreateResource = false |
| 来源不可追溯 | source.type = exam，但无 description / title / year / questionNo | canCreateResource = false |
| 重复资源 ID | 系统创建正式资源时出现重复 resourceId | 第二次创建被阻断或生成新的唯一 ID，不得静默覆盖旧资源 |
| 能力不一致 | TaskRequest targetAbility 与 TaskResource targetAbility 不一致 | TaskFulfillment / readiness 不通过 |
| 可追溯性 | resourceId 存在并进入 ConcreteLearningTask | source traceable = true |

## 十二、Debug Report

Debug Report 至少展示：

- draftId；
- resourceId；
- questionText；
- targetAbilityId；
- questionType；
- hasAssessmentBasis；
- readingTextRequired；
- readingTextProvided；
- source type；
- source traceability；
- canSaveDraft；
- canCreateResource；
- canEnterTaskFulfillment；
- resource status；
- validation issues；
- concreteTaskId；
- task readiness result；
- PASS / FAIL。

## 十三、验收标准

Phase 12.2 通过条件：

1. 已定义 `TaskResourceInput`；
2. 已定义 `TaskResourceDraft`；
3. 已定义 `TaskResourceValidationResult`；
4. 已定义 `TaskResource`；
5. 能从真实题目输入生成 Draft；
6. Draft 可以在字段不完整时保存；
7. `resourceId` 由系统生成，不由录入者填写；
8. 能校验题干是否存在；
9. 能校验作答要求是否存在；
10. 能校验评价依据是否存在；
11. 空 `rubric` 不得被当作有效评价依据；
12. 能校验目标能力是否存在；
13. 能使用受控 `questionType` 判断是否必须提供阅读材料；
14. 能校验来源是否可追溯；
15. 能防止重复 `resourceId` 静默覆盖正式资源；
16. 正常阅读题可以生成正式 TaskResource；
17. 缺少关键字段时只能保存 Draft，不能生成可执行资源；
18. TaskResource 可以进入现有 TaskFulfillment；
19. TaskFulfillment 可以生成 ConcreteLearningTask；
20. ConcreteLearningTask 可以通过 readiness 检查；
21. 不绕过 TaskFulfillment 直接生成页面题目；
22. 不重新定义 QuestionMetadata；
23. 页面不直接读写 IndexedDB 或 localStorage；
24. Debug 输出 PASS；
25. `pnpm run build` 通过。

## 十四、页面验收建议

Phase 12.2 可以接入轻量 Demo。

Demo 最少支持：

1. 输入阅读材料；
2. 输入题干；
3. 输入作答要求；
4. 输入参考答案或评价依据；
5. 选择目标能力；
6. 选择题型；
7. 点击“保存草稿”；
8. 点击“生成正式资源”；
9. 展示 Resource Validation 结果；
10. 展示生成的 ConcreteLearningTask；
11. 明确提示是否可以进入学生学习入口。

学生端不展示资源录入页面。

资源录入页面属于开发者 / 家长 / 教师侧准备入口。

## 十五、工程验收记录

Phase 12.2 已完成工程最小闭环实现。

已实现：

- `taskResource.schema.ts`
- `taskResourcePreparationAgent.ts`
- `taskResourceRepository.ts`
- `inMemoryTaskResourceRepository.ts`
- `runTaskResourcePreparationDebug.ts`
- `debug:task-resource-preparation`

Debug 验收结果：

```text
total: 10
pass: 10
fail: 0
```

覆盖样例：

1. 正常阅读题生成可执行任务；
2. 缺少评价依据只能保存草稿；
3. 空 `rubric` 不算有效评价依据；
4. 缺少目标能力阻断正式资源；
5. 阅读题缺少材料阻断正式资源；
6. 非阅读表达题可不提供 `readingText`；
7. 来源不可追溯阻断正式资源；
8. 重复 `resourceId` 不静默覆盖；
9. `TaskRequest` 与 `TaskResource` 能力不一致不匹配；
10. `resourceId` 进入 `ConcreteLearningTask` 追溯链。

Build 验收：

```text
vite build PASS
```

当前结论：

```text
Phase 12.2 Debug / Build 验收通过。
真实题目资源准备工程闭环成立。
Demo 已完成轻量接入，可在资源准备页验证草稿、正式资源、校验结果和 ConcreteLearningTask。
```

Demo 接入记录：

- 页面：`task-resource-preparation-demo`
- 支持输入阅读材料、题干、作答要求、参考答案、评价依据、目标能力、题型和来源；
- 支持保存草稿；
- 支持生成正式 `TaskResource`；
- 支持展示 `TaskResourceValidationResult`；
- 支持展示生成后的 `ConcreteLearningTask`；
- 不进入学生作答；
- 不进入 Diagnosis；
- 不展示为学生端页面。

Demo 验收记录：

```text
验收日期：2026-07-14
验收结论：PASS
验收类型：轻量 Demo 最小闭环验收
```

本次演示已确认：

1. 完整的阅读题输入可以生成正式 `TaskResource`；
2. 正式资源可以进入既有 `TaskFulfillment` 并生成 `ConcreteLearningTask`；
3. 不完整输入仍可保存为 Draft，但不会被误判为正式资源；
4. 缺少参考答案、评价依据和有效 `rubric` 时，资源创建会被阻断；
5. 阅读类题目缺少阅读材料时，资源创建会被阻断；
6. 不要求阅读材料的受控题型可以在其他字段完整时生成正式资源；
7. 来源不可追溯时，资源创建会被阻断；
8. 页面只承担资源准备与校验职责，不进入学生作答、Diagnosis 或 Evidence 回流。

Phase 12.2 当前状态：

```text
Docs   READY
Debug  PASS
Build  PASS
Demo   PASS
Phase  PASS
```

验收结论：

```text
真实题目输入
-> Draft 保存
-> Resource Validation
-> 正式 TaskResource
-> TaskFulfillment
-> ConcreteLearningTask

最小闭环已成立。
```

## 十六、本阶段不做

Phase 12.2 不做：

- 不做大型题库；
- 不做自动出题；
- 不做教材批量导入；
- 不做截图识别；
- 不做 OCR；
- 不做真实 LLM 出题；
- 不做学生作答；
- 不做 Diagnosis；
- 不做 Evidence 回流；
- 不做连续多轮；
- 不做复杂资源管理；
- 不做云端同步；
- 不做权限系统；
- 不做正式产品 UI。

## 十七、与 Phase 12.3 的关系

Phase 12.2 输出：

```text
TaskResource
ConcreteLearningTask
TaskReadinessValidation
```

Phase 12.3 将基于这些能力继续验证：

```text
上一轮结果
↓
下一轮策略
↓
真实题目资源
↓
下一轮 ConcreteLearningTask
```

也就是说：

```text
12.2 证明真实题目可以进入 Runtime；
12.3 证明真实题目可以支撑连续多轮学习。
```

## 十八、完成定义

Phase 12.2 完成时，应能证明：

```text
一题真实语文阅读题
可以被录入、校验、保存为 TaskResource，
并通过现有 TaskFulfillment 生成 ConcreteLearningTask。
```

这意味着系统第一次具备：

```text
真实题目资源准备能力。
```

根据 Debug、Build 与轻量 Demo 验收结果，Phase 12.2 已达到本阶段完成定义，可以进入 Phase 12.3 连续多轮学习运行。

Phase 12 基础全链路集成进一步确认：正式 `TaskResource` 已通过共享 `TaskResourceRepository` 保存；浏览器使用 `IndexedDBTaskResourceRepository`，Debug 使用同一接口的 `InMemoryTaskResourceRepository`。Phase 12.3 不再依赖本模块之外的固定正式资源副本。

但它还不证明：

```text
题库已经成立；
学生已经完成真实作答；
连续多轮已经跑通；
真实学习效果已经形成。
```
