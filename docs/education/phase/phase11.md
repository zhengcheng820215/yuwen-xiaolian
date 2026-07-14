# Phase 11：学生学习体验最小闭环（Student Learning Experience）

## 一、阶段定位

Phase 11 的目标是把已经成立的 Learning Round Runtime 转化为学生可以实际完成的一轮最小学习体验。

Phase 8 已经完成：

```text
GrowthMemorySummary
-> NextLearningStrategy
-> TaskRequest
-> TaskFulfillment
```

Phase 9 已经完成：

```text
ConcreteLearningTask
-> StudentResponse
-> TaskExecutionResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
```

Phase 10 已经完成：

```text
Phase 8 Strategy Runtime
+ Phase 9 Execution Runtime
-> LearningRoundResult
```

Phase 11 不重新定义 Runtime。

Phase 11 负责把 Runtime 结果转化为学生能看懂、能操作、能完成的一轮学习体验。

## 二、一句话定义

Phase 11 是学生学习体验最小闭环。

它验证：

```text
学生能否从一个清晰入口开始学习，
完成一轮任务，
获得可理解反馈，
并知道下一步该做什么。
```

## 三、核心问题

Phase 11 只回答一个核心问题：

```text
一个真实学生能不能不依赖工程解释，
独立走完一轮学习？
```

Phase 11 的关注对象不是底层 Schema，也不是 Debug 报告。

Phase 11 的关注对象是：

```text
学生是否知道：
从哪里开始；
要做什么；
如何作答；
如何修改；
本轮结果是什么；
下一步该做什么。
```

## 四、完整目标链路

Phase 11 的目标链路：

```text
进入学习
↓
启动 LearningRound
↓
展示 ConcreteLearningTask
↓
学生输入答案
↓
提交
↓
Runtime 完成执行、诊断与 Evidence 回流
↓
StudentLearningFeedback
↓
本轮结束状态
↓
下一步入口
```

前台只展示学生需要理解的内容。

后台继续运行 Phase 8 到 Phase 10 的 Runtime。

## 五、与 Phase 8 / Phase 9 / Phase 10 的分界

### Phase 8

Phase 8 负责：

```text
长期评估、成长记忆与下一步策略。
```

Phase 11 不替代 Phase 8 的策略判断。

### Phase 9

Phase 9 负责：

```text
任务执行、作答有效性判断与 Evidence 回流。
```

Phase 11 不替代 Phase 9 的作答有效性判断。

### Phase 10

Phase 10 负责：

```text
编排一轮 LearningRound。
```

Phase 11 不替代 Phase 10 的学习回合编排。

### Phase 11

Phase 11 负责：

```text
把 LearningRound 变成学生可操作、可理解的一轮学习体验。
```

Phase 11 只做体验层适配。

Phase 11 不重新判断能力，不生成新的 Evidence，不直接更新 GrowthMemory。

## 六、学生端展示原则

学生端不直接展示以下工程字段：

- Schema；
- ID；
- Runtime 字段；
- `evidenceType`；
- `source`；
- `confidence`；
- `canEnterDiagnosisRuntime`；
- `ProfileUpdateDecision` 原始结构；
- `GrowthMemoryRecord` 原始结构。

学生端应展示：

- 当前要做什么；
- 本题或本轮主要练什么；
- 如何作答；
- 本次回答哪里有效；
- 还需要补充什么；
- 下一步建议。

## 七、StudentLearningFeedback

Phase 11 建议引入展示层对象：

```ts
type StudentLearningFeedbackStage =
  | 'submission'
  | 'analysis'
  | 'result';

type StudentLearningFeedback = {
  stage: StudentLearningFeedbackStage;

  resultStatus:
    | 'completed'
    | 'retry_required'
    | 'review_required'
    | 'blocked';

  headline: string;
  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;

  canRetry: boolean;
  canFinishRound: boolean;

  source:
    | 'task_execution'
    | 'evidence_return'
    | 'learning_round';
};
```

`StudentLearningFeedback` 只负责把 Runtime 结果翻译成学生可理解语言。

`StudentLearningFeedback` 不只消费成功回流结果。

它可能来自以下 Runtime 状态：

```text
LearningRoundStartResult
LearningRoundExecutionResult
TaskExecutionResult
TaskEvidenceReturnResult
LearningRoundResult
```

因此 Phase 11 建议引入：

```text
StudentFeedbackAdapter
```

最小链路：

```text
LearningRoundStartResult
或
LearningRoundExecutionResult
或
TaskExecutionResult
或
TaskEvidenceReturnResult
或
LearningRoundResult
↓
StudentFeedbackAdapter
↓
StudentLearningFeedback
```

`StudentFeedbackAdapter` 只映射已有 Runtime 状态，不重新解释教育结论。

当多个 Runtime Result 同时存在时，必须优先使用链路中最靠后的正式结果：

```text
LearningRoundResult
>
TaskEvidenceReturnResult
>
LearningRoundExecutionResult
>
TaskExecutionResult
```

`StudentLearningFeedback` 必须区分过程反馈与结果反馈：

```text
submission = 提交或补充阶段
analysis   = 分析处理中
result     = 正式结果反馈
```

`whatYouDidWell` 只能来自 DiagnosisResult、AbilityEvidence 或可确认的任务执行事实。

如果没有可靠正向信息，允许为空，不得为了鼓励而凭空生成正向能力评价。

它不负责：

- 重新诊断；
- 重新生成 Evidence；
- 判断长期能力状态；
- 替代 Evaluation；
- 替代 NextLearningStrategy。

示例：

```text
后台状态：
ResponseValidityResult.status = placeholder

学生看到：
这次回答的信息还不够，请再补充一下你的理由。
```

示例：

```text
后台状态：
review_required

学生看到：
这次回答已经记录，系统需要进一步确认，暂时不会据此改变你的能力状态。
```

## 八、StudentLearningViewStatus

Phase 11 需要区分 Runtime 状态和页面体验状态。

页面体验状态用于让学生知道系统当前正在做什么，不写入能力 Runtime。

建议最小结构：

```ts
type StudentLearningViewStatus =
  | 'loading_task'
  | 'ready'
  | 'submitting'
  | 'analyzing'
  | 'feedback_ready'
  | 'error';
```

说明：

- `loading_task`：正在准备任务；
- `ready`：任务已准备好，可以作答；
- `submitting`：正在提交答案；
- `analyzing`：Runtime 正在分析答案；
- `feedback_ready`：反馈已生成；
- `error`：任务加载或 Runtime 执行失败。

这些状态只服务页面体验。

它们不代表答案正确，也不代表能力变化。

## 九、StudentRoundFocus

Phase 11 学生端不宜直接展示过重的长期标签。

不建议展示：

```text
你的推理能力弱。
你的概括能力不足。
```

更建议展示：

```text
本轮需要继续关注：
是否能用完整依据支持自己的判断。
```

因此 Phase 11 区分：

```text
StudentAbilityProfile = 系统长期能力状态；
StudentRoundFocus = 本轮学生可读关注点。
```

学生端优先展示 `StudentRoundFocus`。

长期能力判断继续保留在 Runtime 和开发者调试区，不直接作为学生标签输出。

## 十、下一步入口与下一步策略边界

Phase 11 可以展示下一步入口。

例如：

```text
继续学习；
补充回答；
重新尝试；
结束本轮；
等待确认。
```

但 Phase 11 页面层不得自行决定下一步教育策略。

页面层不决定：

- 换能力；
- 降低难度；
- 做迁移题；
- 做独立复测；
- 进入新的训练策略。

这些策略仍然应来自：

```text
LearningRoundResult.nextStep
或
下一轮 Phase 8.3 NextLearningStrategy
```

Phase 11 只把 Runtime 已经给出的流程动作翻译成学生可点击、可理解的入口。

## 十一、学生隐私与调试信息隔离

Phase 11 即使是内部 Alpha，也必须保持学生体验区域和开发者调试区域隔离。

学生端不得通过页面文本、URL、错误弹窗或可见调试信息暴露：

- 完整 StudentAbilityProfile；
- 完整 AbilityEvidence；
- Prompt；
- 模型原始输出；
- 内部追溯 ID；
- GrowthMemoryRecord 原始结构；
- ProfileUpdateDecision 原始结构。

可以保留开发者面板。

但开发者面板必须与学生主体验区明显隔离，并默认不作为学生理解页面的一部分。

## 十二、阶段拆分

Phase 11 拆为三个最小闭环。

| 阶段 | 核心问题 | 输入 | 输出 |
| --- | --- | --- | --- |
| Phase 11.1 | 学生能否自然进入一轮学习，并开始完成任务 | LearningRoundStartResult / ConcreteLearningTask | StudentLearningEntryState |
| Phase 11.2 | 学生提交答案后，能否得到可理解、可行动的反馈 | LearningRoundExecutionResult / TaskExecutionResult / TaskEvidenceReturnResult / LearningRoundResult | StudentLearningFeedback |
| Phase 11.3 | 一轮结束后，学生能否知道完成了什么和下一步做什么 | LearningRoundResult / StudentLearningFeedback | StudentRoundSummary |

Phase 11 不再继续拆分 11.1.1、11.2.1 等更细阶段。

如果需要说明内部步骤，应写在对应 Phase 文档中。

## 十三、Phase 11.1：学生学习入口

Phase 11.1 只解决：

```text
进入学习页面
↓
启动 LearningRound
↓
获取 ConcreteLearningTask
↓
展示阅读材料、题干和作答区域
↓
进入作答状态
```

它证明：

```text
学生能从一个入口开始学习，并知道当前任务要求。
```

## 十四、Phase 11.2：学生作答与可读反馈

Phase 11.2 只解决：

```text
Student Answer
↓
LearningRoundExecutionResult
或
TaskExecutionResult
或
TaskEvidenceReturnResult
或
LearningRoundResult
↓
StudentFeedbackAdapter
↓
StudentLearningFeedback
```

它证明：

```text
学生提交答案后，系统能给出可理解、可行动的反馈。
```

Phase 11.2 特别强调：

```text
Validity 判断“有没有可观察表现”；
Diagnosis 判断“这个表现说明了什么”。
```

空答案、占位回答和证据不足只能生成补充作答提示，不应被描述为能力不足。

## 十五、Phase 11.3：本轮学习结束页

Phase 11.3 只解决：

```text
LearningRoundResult
+
StudentLearningFeedback
↓
StudentRoundSummary
↓
下一步入口
```

它证明：

```text
一轮学习结束后，学生知道自己完成了什么，以及下一步该做什么。
```

Phase 11.3 不重新判断能力，不生成长期报告，也不替代 NextLearningStrategy。

Phase 11.3 还必须保证：

```text
LearningRoundResult 决定最终流程状态；
StudentLearningFeedback 只提供学生可读表现内容；
多输入状态冲突时必须保守处理；
learningRoundId / studentId 不一致时必须阻断；
completionSummary 描述流程结果；
studentReadableResult 描述表现摘要。
```

## 十六、状态语义边界

Phase 11 必须继续遵守 Phase 10 已确认的状态语义：

```text
作答有效 != 答案正确
本轮流程完成 != 答案正确
Evidence 回流 != 能力提升
```

学生端不能把 `completed` 解释为：

```text
你答对了；
你已经掌握了；
你的能力已经提升了。
```

更合适的表达是：

```text
本轮已经完成。
你的答案已经被系统分析。
下一步会继续练习某个具体动作。
```

## 十七、体验验收原则

Phase 11 的验收不只看 Debug 和 Build。

Phase 11 必须增加真实体验验收：

1. 学生是否知道在哪里开始；
2. 学生是否知道题目要求；
3. 学生是否知道如何提交；
4. 无效回答后是否知道如何修改；
5. 反馈是否听得懂；
6. 学生是否知道本轮已经结束；
7. 学生是否知道下一步该做什么。

建议至少进行一次真实观察：

```text
不提前讲解页面；
让学生自己操作；
记录卡住的位置；
记录学生问出的每个问题；
记录提交后能否复述反馈含义。
```

学生完成后，建议至少能回答三个问题：

1. 刚才这道题主要让你做什么？
2. 系统认为你哪里做得不错？
3. 下一步你需要做什么？

如果学生无法复述反馈含义，说明体验层仍未通过。

## 十八、本阶段不做

Phase 11 不做：

- 不做完整 App；
- 不做正式账号系统；
- 不做家长端；
- 不做大型题库；
- 不做奖励系统；
- 不做长期成长曲线；
- 不做复杂课程导航；
- 不做多轮自动学习系统；
- 不做商业化 UI；
- 不重新实现 Phase 8 到 Phase 10 的 Runtime；
- 不用单次反馈宣称长期能力提升。

## 十九、最小验收目标

Phase 11 完成后，应能证明：

```text
一个学生可以从入口开始，
看到任务，
完成作答，
得到可理解反馈，
知道本轮结果和下一步动作。
```

后台仍应完成：

```text
LearningRound Runtime
-> TaskExecutionResult
-> TaskEvidenceReturnResult
-> LearningRoundResult
```

## 二十、最终结论

Phase 11 是从工程 Runtime 走向学生可试用体验的阶段。

Phase 11 的目标不是增加新的智能能力，而是让已经成立的 Runtime 变成学生能够实际完成的一轮学习。

Phase 11 完成后，系统将从：

```text
Runtime Beta 成立
```

进入：

```text
Student Experience Alpha 成立
```

这里的 `Alpha` 表示：

```text
单学生最小可试用学习体验成立。
```

它不表示正式 Beta。

正式 Beta 仍需要进一步验证：

- 持久化；
- 中断恢复；
- 稳定题目输入；
- 连续多轮体验；
- 多设备访问；
- 诊断质量抽检；
- 基本数据管理。

## 二十一、Phase 11 验收冻结记录

验收时间：2026-07-14

验收结论：PASS

冻结状态：Frozen

通过类型：

```text
Student Experience Alpha 最小闭环通过
```

Phase 11 已完成以下三个最小闭环：

```text
Phase 11.1
LearningRoundStartResult
或
ConcreteLearningTask
-> StudentLearningEntryState
-> 学生进入可作答状态

Phase 11.2
LearningRoundExecutionResult
或
TaskExecutionResult
或
TaskEvidenceReturnResult
或
LearningRoundResult
-> StudentFeedbackAdapter
-> StudentLearningFeedback

Phase 11.3
LearningRoundResult
+
StudentLearningFeedback
-> StudentRoundSummaryAdapter
-> StudentRoundSummary
```

本阶段已验证：

1. 学生可以从统一入口进入一轮学习；
2. 学生可以看到阅读材料、题目和作答要求；
3. 学生可以输入答案并提交；
4. 系统可以把提交后的 Runtime 状态转换为学生可读反馈；
5. 空答案、占位回答、复核、阻断状态不会被错误描述为能力不足；
6. 本轮结束页可以说明本轮是否完成、练了什么、结果是什么、下一步入口是什么；
7. `completed` 不会被描述为“答对、掌握或能力提升”；
8. 学生主体验区不暴露 Runtime 原始字段、Evidence、Profile、Prompt 或内部追溯 ID；
9. 开发者调试信息与学生主体验区隔离；
10. Demo 人工验收通过。

Debug / Build / Demo 状态：

```text
Phase 11.1  Debug PASS / Build PASS / Demo PASS
Phase 11.2  Debug PASS / Build PASS / Demo PASS
Phase 11.3  Debug PASS / Build PASS / Demo PASS
```

Demo 验收结论：

```text
进入任务
-> 看懂题目
-> 作答提交
-> 获得反馈
-> 看懂本轮结果
-> 知道下一步方向
```

已经通过最小演示验收。

## 二十二、冻结边界

Phase 11 冻结后，不继续扩展以下内容：

- 不接数据库；
- 不做账号系统；
- 不做家长端；
- 不做连续多轮自动学习；
- 不做长期成长报告；
- 不做多设备同步；
- 不做正式视觉打磨；
- 不新增能力判断模型；
- 不重构 Phase 8 到 Phase 10 Runtime；
- 不把下一步入口实现为真实下一轮策略生成。

Phase 11 证明的是：

```text
学生端一轮最小学习体验成立。
```

Phase 11 不证明：

```text
系统已经具备长期可用 Beta；
诊断质量已经稳定适用于所有真实题；
学生能力已经真实提升；
连续多轮学习已经可自动运行。
```

## 二十三、下一阶段建议

Phase 11 冻结后，下一阶段不应继续修补单页体验。

建议进入：

```text
Phase 12：Continuous Learning Flow
```

Phase 12 的核心问题应是：

```text
一轮结束后的下一步入口，能否真正启动下一轮学习？
```

也就是从：

```text
学生知道下一步方向
```

推进到：

```text
学生可以连续完成多轮学习
```
