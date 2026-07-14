# Phase 11.3：本轮学习结束页最小闭环（Student Round Summary）

## 一、阶段目标

Phase 11.3 只解决一个核心问题：

```text
一轮学习结束后，学生能否知道自己完成了什么，以及下一步该怎么做？
```

Phase 11.3 的一句话定义：

```text
将 LearningRoundResult 和 StudentLearningFeedback 转换为 StudentRoundSummary，让学生理解本轮学习结果和下一步入口。
```

## 二、阶段背景

Phase 11.1 已经完成：

```text
LearningRoundStartResult
或
ConcreteLearningTask
↓
StudentLearningEntryState
↓
学生进入可作答状态
```

Phase 11.2 已经完成：

```text
Runtime Result
↓
StudentFeedbackAdapter
↓
StudentLearningFeedback
↓
学生获得可理解反馈
```

Phase 10 已经能够生成：

```text
LearningRoundResult
```

Phase 11.3 不重新执行 Learning Round，不重新诊断，不重新生成 Evidence，也不重新生成学习策略。

Phase 11.3 负责把本轮最终状态和 11.2 的学生反馈，整理为学生可理解的结束页。

## 三、核心链路

Phase 11.3 的最小链路：

```text
LearningRoundResult
+
StudentLearningFeedback
↓
StudentRoundSummaryAdapter
↓
StudentRoundSummary
↓
本轮学习结束页
↓
下一步入口
```

Phase 11.3 证明：

```text
学生完成一轮学习后，
系统能告诉学生本轮完成了什么、当前需要关注什么、下一步可以做什么。
```

## 四、输入

Phase 11.3 输入：

```text
LearningRoundResult
StudentLearningFeedback
StudentLearningEntryState
```

说明：

- `LearningRoundResult` 提供本轮最终流程状态；
- `StudentLearningFeedback` 提供学生已看到的提交反馈；
- `StudentLearningEntryState` 提供本轮任务标题、关注点和题目信息；
- Phase 11.3 必须消费已有结果，不重新运行 Runtime。

## 五、输出

Phase 11.3 输出：

```text
StudentRoundSummary
```

建议最小结构：

```ts
type StudentRoundSummaryStatus =
  | 'completed'
  | 'retry_required'
  | 'review_required'
  | 'blocked'
  | 'abandoned';

type StudentRoundNextAction =
  | 'continue_learning'
  | 'retry_answer'
  | 'supplement_answer'
  | 'wait_for_review'
  | 'finish_round'
  | 'restart_later';

type StudentRoundSummary = {
  learningRoundId: string;
  studentId: string;

  status: StudentRoundSummaryStatus;

  title: string;
  completedTaskTitle: string;

  roundFocus: {
    title: string;
    description: string;
  };

  completionSummary: string;
  studentReadableResult: string;

  positiveTakeaway: string[];
  continueAttention: string[];

  nextAction: StudentRoundNextAction;
  nextActionText: string;

  canContinue: boolean;
  canRetry: boolean;
  canFinish: boolean;

  debugState?: {
    roundStatus?: string;
    feedbackStatus?: string;
    nextStep?: string;
    issues?: string[];
  };
};
```

说明：

- `StudentRoundSummary` 是学生结束页展示对象；
- 它不替代 `LearningRoundResult`；
- 它不保存长期成长记录；
- 它只描述本轮学习结束时，学生应该如何理解当前结果。
- `completionSummary` 表示流程摘要，例如“你已经完成本轮练习，答案已被记录和分析”；
- `studentReadableResult` 表示表现摘要，例如“你找到了部分依据，但理由和结论之间还需要连接得更清楚”；
- 二者不得重复表达同一件事。

## 六、StudentRoundSummaryAdapter

Phase 11.3 建议新增：

```text
StudentRoundSummaryAdapter
```

它负责将本轮最终 Runtime 状态和学生反馈转换为结束页内容。

输入：

```text
LearningRoundResult
StudentLearningFeedback
StudentLearningEntryState
```

输出：

```text
StudentRoundSummary
```

`StudentRoundSummaryAdapter` 只做结束页摘要适配。

建议处理顺序：

1. 校验 `learningRoundId` 和 `studentId` 是否一致；
2. 读取 `LearningRoundResult` 的最终流程状态；
3. 检查 `StudentLearningFeedback` 是否与最终流程状态冲突；
4. 从 `StudentLearningEntryState` 获取任务标题与本轮关注点；
5. 从 `StudentLearningFeedback` 复制可靠的正向点和关注点；
6. 根据 Runtime 的 `nextStep` 映射学生端下一步入口；
7. 输出 `StudentRoundSummary`。

关键词是：

```text
复制
摘要
映射
```

不是重新推断。

它不负责：

- 重新判断答案是否正确；
- 重新判断学生能力；
- 重新生成 AbilityEvidence；
- 重新更新 GrowthMemory；
- 重新生成 NextLearningStrategy；
- 生成长期学习报告。

## 七、状态映射规则

### 状态来源规则

`LearningRoundResult` 决定 `StudentRoundSummary.status` 的最终流程状态。

`StudentLearningFeedback` 只提供学生可读表现内容。

如果二者状态冲突，例如：

```text
LearningRoundResult.status = completed
StudentLearningFeedback.resultStatus = review_required
```

`StudentRoundSummaryAdapter` 不得静默选择成功状态。

应输出保守状态：

```text
review_required
或
blocked
```

并在 `debugState.issues` 中记录：

```text
status_conflict
```

### 身份一致性规则

`StudentRoundSummaryAdapter` 必须校验：

```text
LearningRoundResult.learningRoundId
= StudentLearningFeedback.learningRoundId
= StudentLearningEntryState.learningRoundId

LearningRoundResult.studentId
= StudentLearningFeedback.studentId
= StudentLearningEntryState.studentId
```

如果不一致：

```text
status = blocked
```

不得展示混合结果，不得把上一轮反馈带入当前结束页。

`debugState.issues` 应记录：

```text
identity_mismatch
```

### completed

当 `LearningRoundResult.status = completed` 时，学生端可以展示：

```text
本轮已经完成。
你完成了本次任务，系统已经记录本轮表现。
```

不得展示：

```text
你已经掌握了；
你的能力已经提升；
你已经彻底解决薄弱点。
```

### retry_required

当 `LearningRoundResult.status = retry_required` 时，学生端可以展示：

```text
本轮还没有形成完整结果。
你需要先补充回答，再继续。
```

下一步入口应优先是：

```text
补充回答 / 重新提交
```

### review_required

当 `LearningRoundResult.status = review_required` 时，学生端可以展示：

```text
本轮结果需要进一步确认。
你的回答已经记录，但暂时不会据此改变能力状态。
```

不得展示底层错误、Schema 问题、模型异常或内部状态名。

### blocked

当 `LearningRoundResult.status = blocked` 时，学生端可以展示：

```text
本轮暂时无法完成。
请稍后重试或重新开始。
```

### abandoned

`abandoned` 是 Phase 11 的页面生命周期状态。

它来源于：

- 学生主动退出；
- 学生中断本轮；
- 页面记录到本轮被放弃。

如果当前 Runtime 的 `LearningRoundResult.status` 尚未包含 `abandoned`，Phase 11.3 不应反向修改 Phase 10 Schema。

第一版可以将 `abandoned` 保留为页面扩展状态。

当存在明确退出或中断记录时，学生端可以展示：

```text
本轮已经停止。
这次不会形成正式学习结果。
```

## 八、学生端内容规则

学生端可以展示：

- 本轮是否完成；
- 本轮做了什么任务；
- 本轮主要关注什么；
- 本次反馈中已经确认的正向表现；
- 仍需继续注意的地方；
- 下一步可以点击什么入口。

学生端不展示：

- `LearningRoundResult` 原始字段；
- `TaskEvidenceReturnResult` 原始字段；
- `AbilityEvidence` 原始结构；
- `GrowthMemoryRecord` 原始结构；
- `ProfileUpdateDecision` 原始结构；
- `confidence`；
- Prompt；
- 模型原始输出；
- 内部追溯 ID。

开发者调试信息可以放在折叠区域。

折叠区域必须与学生主体验区明显隔离。

## 九、正向内容来源规则

`positiveTakeaway` 只能来自：

1. `StudentLearningFeedback.whatYouDidWell`；
2. `LearningRoundResult` 中已成功完成的流程事实；
3. `StudentLearningEntryState` 中的任务信息。

不得凭空生成：

- 你已经掌握；
- 你能力提升明显；
- 你已经解决问题；
- 你这次一定答对了。

如果没有可靠正向信息，允许：

```ts
positiveTakeaway: []
```

## 十、继续关注内容来源规则

`continueAttention` 只能来自：

1. `StudentLearningFeedback.whatNeedsAttention`；
2. `LearningRoundResult.issues` 的学生可读摘要；
3. 本轮未完成、需重试或需复核的流程状态。

如果本轮 `completed`，但没有明确薄弱观察，不应强行输出新的问题。

## 十一、下一步入口规则

Phase 11.3 可以展示以下入口：

- 继续学习；
- 补充回答；
- 重新尝试；
- 等待确认；
- 结束本轮；
- 稍后重新开始。

Phase 11.3 不得自行决定：

- 下一轮训练哪项能力；
- 是否切换能力；
- 是否降低难度；
- 是否进入复测；
- 是否生成新任务；
- 是否改变学习策略。

这些仍由 Phase 10 / Phase 8.3 的 Runtime 决定。

## 十二、页面最小内容

Phase 11.3 页面最少展示：

1. 本轮完成状态；
2. 本轮任务标题；
3. 本轮关注点；
4. 本轮结果摘要；
5. 一个或多个可确认的正向点；
6. 一个或多个需要继续注意的点；
7. 下一步行动按钮；
8. 必要的复核、阻断、重试提示。

第一版不需要：

- 长期成长报告；
- 家长报告；
- 成长曲线；
- 能力雷达图；
- 多轮历史对比；
- 排名或分数；
- 复杂奖励系统；
- AI Coach 长对话。

## 十三、Debug 流程

Phase 11.3 Debug 最小流程：

1. 创建 mock StudentLearningEntryState；
2. 创建 mock StudentLearningFeedback；
3. 创建 mock LearningRoundResult；
4. 调用 StudentRoundSummaryAdapter；
5. 生成 StudentRoundSummary；
6. 校验 Summary 中不包含 Runtime 原始字段；
7. 输出 PASS / FAIL。

## 十四、Debug Case

Phase 11.3 Debug 至少覆盖以下样例：

| Case | 输入状态 | 预期摘要 |
| --- | --- | --- |
| 本轮完成 | `LearningRoundResult.status = completed` | 展示完成摘要，不宣称掌握或提升 |
| 需要补充回答 | `retry_required` | 引导补充回答，不输出能力结论 |
| 需要复核 | `review_required` | 温和说明等待确认，不展示底层错误 |
| 流程阻断 | `blocked` | 说明暂时无法完成，可稍后重试 |
| 学生中断 | `abandoned` | 说明本轮已停止，不形成正式结果 |
| 无正向反馈 | `whatYouDidWell = []` | `positiveTakeaway` 允许为空 |
| 有继续关注点 | `whatNeedsAttention.length > 0` | 转成学生可理解提醒 |
| 下一步入口 | 不同 `nextStep` | 映射为正确页面动作 |
| 原始字段隔离 | 任意状态 | 学生摘要不暴露 Runtime 字段 |
| 状态冲突 | `LearningRoundResult.completed` + `Feedback.review_required` | 输出保守状态并记录 `status_conflict` |
| 身份不一致 | `learningRoundId` 或 `studentId` 不一致 | 输出 `blocked`，不展示混合结果，记录 `identity_mismatch` |

## 十五、Debug Report

Debug Report 至少展示：

- learningRoundId；
- studentId；
- roundStatus；
- feedbackStatus；
- summaryStatus；
- title；
- completedTaskTitle；
- completionSummary；
- positiveTakeaway；
- continueAttention；
- nextAction；
- nextActionText；
- canContinue；
- canRetry；
- canFinish；
- debugState；
- PASS / FAIL。

## 十六、验收条件

Phase 11.3 通过条件：

1. 能消费 LearningRoundResult；
2. 能消费 StudentLearningFeedback；
3. 能消费 StudentLearningEntryState；
4. 能生成 StudentRoundSummary；
5. 能区分 completed / retry_required / review_required / blocked / abandoned；
6. completed 不被描述为答对、掌握或能力提升；
7. retry_required 不被描述为能力不足；
8. review_required 不展示底层错误；
9. positiveTakeaway 不会在没有可靠来源时被强行填充；
10. continueAttention 来自已有反馈或流程状态；
11. 能生成下一步入口；
12. 下一步入口不替代下一步教育策略；
13. 能识别 `LearningRoundResult` 与 `StudentLearningFeedback` 的状态冲突；
14. 状态冲突时输出保守状态并记录 `status_conflict`；
15. 能校验 `learningRoundId` 和 `studentId` 一致性；
16. 身份不一致时输出 `blocked` 并记录 `identity_mismatch`；
17. `completionSummary` 与 `studentReadableResult` 语义分工清楚；
18. 学生主体验区不暴露 Runtime 原始字段；
19. Debug 输出 PASS；
20. `pnpm run build` 通过。

## 十七、体验验收条件

Phase 11.3 应进行最小体验验收：

1. 学生能否知道本轮是否完成；
2. 学生能否知道刚才做了什么任务；
3. 学生能否说出本轮主要关注点；
4. 学生能否说出自己哪里做得还可以；
5. 学生能否说出下一步要做什么；
6. 复核或阻断状态下，学生是否不会被底层错误吓到；
7. 学生是否不会把“本轮完成”误解为“已经掌握”。

建议让学生回答：

1. 这轮你完成了什么？
2. 这轮主要练什么？
3. 下一步你要做什么？

## 十八、本阶段不做

Phase 11.3 不做：

- 不启动新的 LearningRound；
- 不重新生成 ConcreteLearningTask；
- 不重新运行 Diagnosis；
- 不重新生成 AbilityEvidence；
- 不更新 GrowthMemory；
- 不生成 NextLearningStrategy；
- 不生成长期学习报告；
- 不做家长端；
- 不做多轮历史分析；
- 不做复杂 AI 对话；
- 不做正式产品视觉打磨。

## 十九、与 Phase 11 冻结的关系

Phase 11.3 是 Phase 11 的收尾闭环。

Phase 11.3 完成后，Phase 11 应具备：

```text
学习入口
↓
学生作答
↓
学生可读反馈
↓
本轮结束页
```

如果 11.1、11.2、11.3 均完成 Debug / Build / Demo 验收，则 Phase 11 可以整体冻结。

Phase 11 冻结后，可以宣称：

```text
Student Experience Alpha 最小闭环成立。
```

但仍不能宣称：

- 正式 Beta 已经成立；
- 学生可以长期独立使用；
- 真实学习效果已经被证明；
- 长期成长报告已经可用；
- 产品已具备完整日常学习体验。

## 二十、阶段完成定义

Phase 11.3 完成时，应能通过一个页面证明：

```text
LearningRoundResult
+ StudentLearningFeedback
-> StudentRoundSummary
-> 学生看到本轮结果和下一步入口
```

这一条本轮结束体验闭环已经成立。

Phase 11.3 完成后，可以宣称：

```text
系统能够将一轮学习结果转换为学生可理解的结束页。
```

但还不能宣称：

- 学生能力已经提升；
- 下一轮策略已经由页面决定；
- 长期成长报告已经成立；
- 正式 Beta 已经成立。
