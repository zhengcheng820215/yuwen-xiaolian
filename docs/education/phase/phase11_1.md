# Phase 11.1：学生学习入口最小闭环（Student Learning Entry）

## 一、阶段目标

Phase 11.1 只解决一个核心问题：

```text
学生能否自然进入一轮学习，并开始完成任务？
```

Phase 11.1 的一句话定义：

```text
将 LearningRoundStartResult 或 ConcreteLearningTask 转化为学生可见、可理解、可作答的学习入口页面。
```

## 二、阶段背景

Phase 10 已经能够生成：

```text
LearningRoundStartResult
```

当启动成功时，系统可以得到：

```text
ConcreteLearningTask
TaskReadinessValidation
nextAction = start_task_execution
```

Phase 11.1 不重新生成策略，不重新匹配任务，也不重新判断任务可执行性。

Phase 11.1 负责把已经准备好的任务展示给学生，并让学生进入作答状态。

## 三、核心链路

Phase 11.1 的最小链路：

```text
进入学习页面
↓
启动 LearningRound
↓
获取 LearningRoundStartResult
↓
校验 status = ready_for_execution
↓
读取 ConcreteLearningTask
↓
展示阅读材料、题干和作答区域
↓
进入作答状态
```

Phase 11.1 证明：

```text
学生能从一个入口开始学习，
并清楚知道当前任务要求。
```

## 四、输入

Phase 11.1 输入：

```text
StudentAbilityProfile
GrowthMemorySummary
CurrentLearningContext
AvailableTaskResource[]
```

或直接输入：

```text
LearningRoundStartResult
```

说明：

- 当页面负责启动一轮学习时，应调用 Phase 10.1 获取 `LearningRoundStartResult`；
- 当页面用于调试时，可以直接使用 mock `LearningRoundStartResult`；
- 无论来源如何，页面只能展示已经通过 readiness 校验的任务。

## 五、输出

Phase 11.1 输出：

```text
StudentLearningEntryState
```

建议最小结构：

```ts
type StudentLearningEntryStatus =
  | 'loading_task'
  | 'ready_to_answer'
  | 'blocked'
  | 'retry_required'
  | 'error';

type StudentLearningViewStatus =
  | 'loading_task'
  | 'ready'
  | 'submitting'
  | 'analyzing'
  | 'feedback_ready'
  | 'error';

type StudentLearningEntryState = {
  learningRoundId: string;
  studentId: string;
  status: StudentLearningEntryStatus;
  viewStatus: StudentLearningViewStatus;

  taskTitle: string;
  readingText?: string;
  questionText: string;
  answerRequirements: string[];
  successCriteriaText: string[];

  studentRoundFocus: {
    title: string;
    description: string;
  };

  canAnswer: boolean;
  canSubmit: boolean;
  message?: string;

  debugState?: {
    startStatus?: string;
    taskReadiness?: boolean;
    sourceType?: string;
    issues?: string[];
  };
};
```

说明：

- `StudentLearningEntryState` 是学生学习入口页面的展示对象；
- 它不替代 `LearningRoundStartResult`；
- 它不保存长期学习结果；
- 它只描述当前页面是否可以开始作答。

`taskTitle` 是展示标题，只能来自任务角色和学生可读能力名称。

例如：

```text
推理练习
概括练习
独立复测
迁移验证
```

`taskTitle` 不得由页面临时根据 `questionText` 或模型输出自由命名，也不得重新解释题目目标。

`answerRequirements` 必须保留为数组，页面可以逐条展示。

例如：

```text
请结合文本回答；
写出人物的特点；
至少引用一处依据。
```

不得为了展示方便提前合成为不可追溯的单个字符串。

`canAnswer` 表示任务已经准备好，学生可以进入作答状态。

`canSubmit` 表示当前答案草稿已经满足最低输入条件，可以触发提交。

任务 ready 不等于答案可提交。

因此：

```text
ready_to_answer -> canAnswer = true
空答案 -> canSubmit = false
```

`debugState` 只能保存摘要信息，不保存完整 Runtime 对象。

完整 JSON 如需查看，应由独立开发者面板读取 Runtime 调试结果，而不是塞入学生展示状态。

## 六、页面最小内容

Phase 11.1 页面最少需要展示：

1. 阅读材料；
2. 题干；
3. 作答要求；
4. 答案输入框；
5. 提交按钮；
6. 当前任务状态；
7. 必要的加载、失败和重试提示。

第一版不需要：

- 复杂首页；
- 课程导航；
- 任务列表；
- 历史记录；
- 奖励系统；
- 家长视图。

## 七、学生端展示规则

学生端可以展示：

```text
本轮练习重点；
阅读材料；
题目；
作答要求；
如何提交；
失败时该怎么办。
```

学生端不展示：

```text
Schema；
ID；
Runtime 字段；
TaskReadinessValidation 原始结构；
LearningRoundStartResult 原始结构；
confidence；
evidenceType；
GrowthMemory 原始内容。
```

开发者调试信息可以放在折叠区域。

## 八、状态规则

### loading_task

页面正在启动 LearningRound 或加载任务。

学生看到：

```text
正在准备本轮学习任务。
```

输出：

```text
status = loading_task
viewStatus = loading_task
canAnswer = false
canSubmit = false
```

### ready_to_answer

当以下条件全部满足：

```text
LearningRoundStartResult.status = ready_for_execution
ConcreteLearningTask 存在
TaskReadinessValidation.canExecute = true
任务内容可展示
答案输入区域可用
```

输出：

```text
status = ready_to_answer
viewStatus = ready
canAnswer = true
canSubmit = false
```

说明：

`ready_to_answer` 只表示任务可以作答。

提交按钮是否可用，还需要结合 `studentAnswerDraft` 是否满足最低输入条件。

### blocked

当启动失败、任务不可执行或任务内容残缺时：

```text
status = blocked
viewStatus = error
canAnswer = false
canSubmit = false
```

页面应展示明确提示，而不是展示残缺任务。

### retry_required

当启动过程出现可恢复错误时：

```text
status = retry_required
viewStatus = error
canAnswer = false
canSubmit = false
```

页面应提供重试入口。

### error

当任务加载或页面状态转换出现不可恢复错误时：

```text
status = error
viewStatus = error
canAnswer = false
canSubmit = false
```

页面应展示学生可理解的错误提示，不展示底层异常、堆栈或 Runtime 原始字段。

## 九、提交前体验状态

Phase 11.1 虽然不处理提交后的诊断反馈，但页面必须为后续提交行为预留体验状态。

页面至少应支持：

```text
ready
submitting
analyzing
feedback_ready
error
```

说明：

- `ready`：学生可以作答；
- `submitting`：学生点击提交后，防止重复提交；
- `analyzing`：Runtime 正在分析答案；
- `feedback_ready`：反馈准备完成；
- `error`：提交或分析失败。

这些状态属于页面体验状态，不写入能力 Runtime。

Phase 11.1 预留完整 `StudentLearningViewStatus` 枚举，但本阶段不负责驱动 `submitting`、`analyzing` 和 `feedback_ready` 的业务转换。

这些提交后状态由 Phase 11.2 负责。

## 十、readiness 展示边界

如果 `TaskReadinessValidation.canExecute = false`：

```text
不得展示残缺任务；
不得允许学生提交；
不得创建正式作答状态。
```

页面可以展示：

```text
本轮任务暂时无法开始，请稍后重试。
```

或：

```text
任务内容还没有准备完整，系统需要重新生成任务。
```

## 十一、重复启动控制

Phase 11.1 必须避免页面刷新或误操作导致重复启动多轮。

最小规则：

1. 同一页面生命周期内只主动启动一次 LearningRound；
2. 如果已有 `learningRoundId` 和可执行任务，不重复启动；
3. 重试必须由明确按钮触发；
4. 调试模式可以允许手动重置；
5. 不因输入框变化重新启动 LearningRound。

## 十二、学生隐私与调试信息隔离

Phase 11.1 页面不得在学生主体验区展示：

- 完整 Profile；
- 完整 Evidence；
- Prompt；
- 模型原始输出；
- 内部追溯 ID；
- Runtime 原始错误；
- Debug JSON。

开发者调试信息可以保留在折叠面板中。

折叠面板必须与学生主体验区明显隔离，且不作为学生理解任务的必要内容。

## 十三、学生可读语言要求

Phase 11.1 的页面文字应面向学生，而不是面向开发者。

不建议：

```text
TaskReadinessValidation failed.
status = ready_for_execution
```

建议：

```text
本轮任务已经准备好，请阅读材料并回答问题。
```

不建议：

```text
ConcreteLearningTask 缺少 assessmentBasis。
```

建议：

```text
这道任务还没有准备完整，暂时不能开始。
```

## 十四、体验验收 Case

Phase 11.1 至少应覆盖以下体验场景：

### Case 1：正常进入学习

```text
开始学习
-> 任务加载完成
-> 展示阅读材料、题干和作答要求
-> 学生可以输入答案
```

预期：

```text
status = ready_to_answer
viewStatus = ready
canAnswer = true
canSubmit = false
```

当学生输入满足最低条件的答案草稿后，页面才可以将提交按钮置为可用。

### Case 2：启动阻断

```text
上游条件不足或任务未准备好
```

预期：

```text
不展示残缺题目；
不允许提交；
展示简单重试提示。
```

### Case 3：任务加载中

```text
任务尚未准备完成
```

预期：

```text
显示“正在准备本轮学习任务”；
不允许重复启动；
不允许提交。
```

### Case 4：页面错误

```text
任务加载或状态转换失败
```

预期：

```text
不展示底层错误；
提示学生稍后重试；
保留开发者调试入口。
```

## 十五、Debug 流程

Phase 11.1 Debug 最小流程：

1. 创建 mock studentId；
2. 创建 mock StudentAbilityProfile；
3. 创建 mock GrowthMemorySummary；
4. 创建 mock CurrentLearningContext；
5. 调用 Phase 10.1 或使用 mock LearningRoundStartResult；
6. 校验 `status = ready_for_execution`；
7. 读取 ConcreteLearningTask；
8. 转换为 StudentLearningEntryState；
9. 输出学生可读展示字段；
10. 输出 PASS / FAIL。

## 十六、Debug Report

Debug Report 至少展示：

- studentId；
- learningRoundId；
- LearningRoundStartResult.status；
- TaskReadinessValidation.canExecute；
- taskTitle；
- questionText；
- answerRequirements；
- studentRoundFocus；
- StudentLearningEntryState.status；
- StudentLearningEntryState.viewStatus；
- canAnswer；
- canSubmit；
- message；
- PASS / FAIL。

## 十七、验收条件

Phase 11.1 通过条件：

1. 能从统一入口启动 LearningRound；
2. 能得到 LearningRoundStartResult；
3. 当 `status = ready_for_execution` 时，能展示 ConcreteLearningTask；
4. 能展示阅读材料；
5. 能展示题干；
6. 能展示作答要求；
7. 能展示答案输入框；
8. 能展示提交按钮；
9. 学生端不展示 Schema、ID 和 Runtime 原始字段；
10. 启动失败时有明确提示；
11. readiness 失败时不会展示残缺任务；
12. 页面刷新或误操作不会轻易重复启动多轮；
13. 页面能够进入作答状态；
14. `canAnswer` 与任务 ready 状态一致；
15. `canSubmit` 不因任务 ready 自动为 true，必须结合答案草稿最小输入条件；
16. `answerRequirements` 保持数组结构；
17. `taskTitle` 来源稳定，不由页面自由命名；
18. `debugState` 不包含完整 Runtime 对象；
19. 页面具备加载、错误、重试等最小体验状态；
20. 学生主体验区不暴露 Debug JSON 或内部追溯信息；
21. Debug 输出 PASS；
22. `pnpm run build` 通过。

## 十八、体验验收条件

Phase 11.1 还应进行最小体验验收：

1. 学生是否知道从哪里开始；
2. 学生是否知道当前要阅读什么；
3. 学生是否知道题目要求；
4. 学生是否知道在哪里输入答案；
5. 学生是否知道如何提交；
6. 如果任务加载失败，学生是否知道下一步该重试。

体验验收不要求页面精美。

体验验收只要求学生能自然开始本轮学习。

建议让学生在不提前讲解页面的情况下回答：

1. 这道题主要让你做什么？
2. 你应该在哪里输入答案？
3. 如果任务没有加载出来，你知道下一步该怎么做吗？

建议同时观察：

1. 学生是否会先读作答要求，再开始输入；
2. 学生是否会误点开发者折叠区或被非核心信息吸引。

如果学生不看作答要求，不一定是学生问题，可能说明页面信息层级仍需调整。

## 十九、本阶段不做

Phase 11.1 不做：

- 不处理学生提交后的反馈；
- 不生成 StudentLearningFeedback；
- 不生成 LearningRoundResult；
- 不生成本轮结束页；
- 不重新生成策略；
- 不重新实例化任务；
- 不重新判断任务可执行性；
- 不生成 AbilityEvidence；
- 不更新 GrowthMemory；
- 不做账号系统；
- 不做家长端；
- 不做完整课程导航；
- 不做复杂 UI 打磨。

## 二十、与 Phase 11.2 的关系

Phase 11.1 输出：

```text
StudentLearningEntryState
learningRoundId
ConcreteLearningTask
studentAnswer draft
```

Phase 11.2 接着处理：

```text
StudentAnswer
↓
TaskExecutionResult
↓
TaskEvidenceReturnResult
↓
StudentLearningFeedback
```

也就是说：

```text
Phase 11.1 = 让学生开始答题；
Phase 11.2 = 让学生提交后得到可读反馈。
```

## 二十一、阶段完成定义

Phase 11.1 完成时，应能通过一个页面证明：

```text
进入学习
-> 启动 LearningRound
-> 展示任务
-> 学生进入作答状态
```

这一条学生学习入口闭环已经成立。

Phase 11.1 完成后，可以宣称：

```text
系统已经能够从统一入口启动一轮 LearningRound，
把准备完成的 ConcreteLearningTask 转换为学生可读页面，
并让学生进入可作答状态。
```

但还不能宣称：

- 学生已经完成了一轮；
- 提交后反馈可理解；
- Evidence 已经回流；
- 学生能够长期独立使用；
- 已经形成正式 Beta。

## 二十二、当前工程验收记录

当前 Phase 11.1 已完成最小工程实现。

新增能力：

```text
LearningRoundStartResult
或
ConcreteLearningTask
↓
StudentLearningEntryState
↓
学生可读学习入口页面
```

已完成：

- `studentLearningEntry.schema.ts`
- `studentLearningEntryAgent.ts`
- `runStudentLearningEntryDebug.ts`
- `studentLearningEntry.ts`
- `StudentLearningEntryDemo.jsx`
- 首页入口：`开始学习 Alpha`

已通过：

```text
Debug  PASS
Build  PASS
Demo   PASS
```

Debug 已覆盖：

1. 任务已准备好，但空答案不能提交；
2. 任务已准备好，答案草稿满足最低提交条件；
3. 启动阶段阻断时不展示可作答状态；
4. readiness 失败时不展示残缺任务。

验收结论：

```text
Phase 11.1 Student Learning Entry 最小闭环通过。
```

## 二十三、Demo 人工验收记录

验收时间：2026-07-14

验收入口：

```text
/#/student-learning-entry-demo
```

验收结论：

```text
PASS / Frozen
```

本次人工验收确认：

1. 学生能够知道当前练习内容为「推理复测」；
2. 页面可以展示阅读材料；
3. 学生可以看懂题目；
4. 页面能够展示清晰作答要求；
5. 空答案状态下不能提交；
6. 输入有效答案草稿后可以提交；
7. 异常 Case 显示「任务暂时无法开始」，不展示残缺任务；
8. 学生主体验区不暴露 Runtime、Evidence、Profile 等工程字段，仅保留独立隔离的开发者调试信息。

本次验收说明：

```text
Phase 11.1 已经能够把 LearningRoundStartResult / ConcreteLearningTask
转换为学生可读学习入口，
并让学生进入可作答状态。
```

冻结边界：

- 本阶段不验收提交后的诊断反馈；
- 本阶段不验收 Evidence 回流；
- 本阶段不验收 LearningRoundResult；
- 本阶段不证明学生完成了一轮学习；
- 本阶段不证明学生能力提升。

后续进入：

```text
Phase 11.2：学生作答与可读反馈
```
