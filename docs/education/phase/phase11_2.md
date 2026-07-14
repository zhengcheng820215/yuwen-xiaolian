# Phase 11.2：学生作答与可读反馈最小闭环（Student Answer Feedback）

## 一、阶段目标

Phase 11.2 只解决一个核心问题：

```text
学生提交答案后，能否得到听得懂、知道怎么改的反馈？
```

Phase 11.2 的一句话定义：

```text
将 LearningRoundExecutionResult、TaskExecutionResult、TaskEvidenceReturnResult 或 LearningRoundResult 转换为 StudentLearningFeedback，让学生理解本次作答状态和下一步动作。
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

Phase 10 已经能够生成：

```text
LearningRoundExecutionResult
LearningRoundResult
```

Phase 9 已经能够生成：

```text
TaskExecutionResult
TaskEvidenceReturnResult
```

Phase 11.2 不重新执行 Diagnosis，不重新生成 Evidence，也不重新判断能力。

Phase 11.2 负责把已有 Runtime 状态翻译成学生可理解反馈。

## 三、核心链路

Phase 11.2 的最小链路：

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
↓
学生可读反馈区域
```

Phase 11.2 证明：

```text
学生提交答案后，
系统能把 Runtime 结果转成学生能理解、能行动的反馈。
```

## 四、输入

Phase 11.2 输入可以来自以下对象之一或组合：

```text
StudentLearningEntryState
StudentResponse
LearningRoundExecutionResult
TaskExecutionResult
TaskEvidenceReturnResult
LearningRoundResult
```

说明：

- `StudentLearningEntryState` 提供本轮任务和页面上下文；
- `StudentResponse` 提供学生答案；
- `LearningRoundExecutionResult` 提供任务执行状态；
- `TaskExecutionResult` 提供作答有效性判断；
- `TaskEvidenceReturnResult` 提供诊断与 Evidence 回流状态；
- `LearningRoundResult` 提供本轮最终流程状态。

## 五、输出

Phase 11.2 输出：

```text
StudentLearningFeedback
```

建议最小结构：

```ts
type StudentLearningFeedbackStage =
  | 'submission'
  | 'analysis'
  | 'result';

type StudentLearningFeedbackStatus =
  | 'completed'
  | 'retry_required'
  | 'review_required'
  | 'blocked';

type StudentLearningFeedbackSource =
  | 'task_execution'
  | 'evidence_return'
  | 'learning_round';

type StudentLearningFeedback = {
  learningRoundId: string;
  studentId: string;

  stage: StudentLearningFeedbackStage;
  resultStatus: StudentLearningFeedbackStatus;

  headline: string;
  summary: string;

  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;

  canRetry: boolean;
  canFinishRound: boolean;

  source: StudentLearningFeedbackSource;

  studentRoundFocus?: {
    title: string;
    description: string;
  };

  debugState?: {
    sourceStatus?: string;
    sourceType?: string;
    issues?: string[];
  };
};
```

说明：

- `StudentLearningFeedback` 是学生展示层对象；
- 它不替代 Runtime Result；
- 它不保存长期学习记录；
- 它只描述学生此刻应该如何理解本次提交结果。

`stage` 用于区分反馈处于哪个阶段：

- `submission`：学生答案已提交，但尚未形成诊断结果；
- `analysis`：答案已具备分析条件，Runtime 正在处理或等待回流；
- `result`：Runtime 已返回正式结果，可以展示本次反馈。

`source` 用于标识反馈基于哪个正式 Runtime 结果生成，方便 Debug 和验收。

## 六、StudentFeedbackAdapter

Phase 11.2 建议新增：

```text
StudentFeedbackAdapter
```

它负责将不同 Runtime 状态映射为学生可读反馈。

输入来源可能是：

```text
LearningRoundExecutionResult
TaskExecutionResult
TaskEvidenceReturnResult
LearningRoundResult
```

输出统一为：

```text
StudentLearningFeedback
```

`StudentFeedbackAdapter` 只做状态翻译。

它不负责：

- 重新判断答案是否正确；
- 重新判断学生能力；
- 重新生成 DiagnosisResult；
- 重新生成 AbilityEvidence；
- 重新更新 StudentAbilityProfile；
- 重新生成 NextLearningStrategy。

## 七、状态来源优先级

同一轮学习中，多个 Runtime Result 可能同时存在。

例如：

```text
TaskExecutionResult.status = submitted_valid
TaskEvidenceReturnResult.status = diagnosis_failed
LearningRoundResult.status = review_required
```

此时 `StudentFeedbackAdapter` 不能只根据较早阶段的 `submitted_valid` 输出“本轮已完成”。

当多个输入同时存在时，必须优先使用链路中最靠后的正式结果。

状态来源优先级：

```text
LearningRoundResult
>
TaskEvidenceReturnResult
>
LearningRoundExecutionResult
>
TaskExecutionResult
```

规则：

1. 如果存在 `LearningRoundResult`，优先基于它生成反馈；
2. 如果没有 `LearningRoundResult`，但存在 `TaskEvidenceReturnResult`，基于 Evidence 回流状态生成反馈；
3. 如果没有 Evidence 回流结果，才使用 `LearningRoundExecutionResult`；
4. 如果只存在 `TaskExecutionResult`，只生成提交或补充类过程反馈；
5. 不得用较早阶段状态覆盖较晚阶段的失败、复核或阻断结果。

## 八、反馈阶段规则

`StudentLearningFeedback` 必须区分过程反馈和结果反馈。

### submission

表示学生刚完成提交，或作答有效性已完成判断。

适用：

```text
TaskExecutionResult.status = submitted_valid
ResponseValidityResult.status = empty / placeholder / insufficient
```

学生端应表达：

```text
你的答案已经提交。
```

或：

```text
这次回答的信息还不够，请补充判断和理由。
```

### analysis

表示答案可以进入分析，或 Runtime 正在处理。

适用：

```text
LearningRoundExecutionResult.status = evidence_return_ready
```

学生端应表达：

```text
你的答案已经可以被分析，系统正在整理反馈。
```

### result

表示 Runtime 已经形成正式结果。

适用：

```text
TaskEvidenceReturnResult.status = evidence_returned / diagnosis_failed / review_required
LearningRoundResult.status = completed / review_required / blocked / retry_required
```

学生端应表达本次结果或当前阻断状态。

## 九、反馈映射规则

### 作答有效但答案未必正确

当 Runtime 表明答案具备最低可诊断条件时：

```text
TaskExecutionResult.status = submitted_valid
或
LearningRoundExecutionResult.status = evidence_return_ready
```

学生端不应看到：

```text
你答对了。
```

而应看到：

```text
你的答案已经可以被分析。
接下来系统会根据你的依据和表达给出反馈。
```

此类反馈属于过程反馈，不应标记为最终诊断反馈。

### 空答案或占位回答

当 Runtime 表明答案无效：

```text
ResponseValidityResult.status = empty
或
ResponseValidityResult.status = placeholder
```

学生端应看到：

```text
这次回答的信息还不够，请补充你的想法或理由。
```

不应看到：

```text
你的能力不足。
```

此类反馈只能来自 `ResponseValidityResult`。

它只能说明“当前回答不够进入分析”，不能说明能力弱、理解差或推理不足。

### 作答过短或证据不足

当 Runtime 表明作答不足以形成有效判断：

```text
ResponseValidityResult.status = insufficient
```

学生端应看到：

```text
你的回答还需要更多依据。请补充你是根据文中哪里判断的。
```

短回答不必然无效。

如果短回答已经包含最低限度的可观察表现，例如清楚判断、明确理由或文本依据，应允许进入 Runtime 分析。

### Diagnosis 失败

当 Runtime 表明诊断失败：

```text
TaskEvidenceReturnResult.status = diagnosis_failed
```

学生端应看到：

```text
这次回答已经记录，但系统暂时无法稳定分析结果。你可以稍后重试或先结束本轮。
```

不应展示底层异常、模型输出或 Schema 错误。

### 需要复核

当 Runtime 表明需要复核：

```text
review_required
```

学生端应看到：

```text
这次回答已经记录，系统需要进一步确认，暂时不会据此改变你的能力状态。
```

### Evidence 回流成功

当 Runtime 表明 Evidence 已成功回流：

```text
TaskEvidenceReturnResult.status = evidence_returned
或
LearningRoundResult.status = completed
```

学生端应看到：

```text
本轮已经完成。你的答案已经被系统分析，下一步会继续围绕本轮关注点练习。
```

但不得宣称：

```text
你已经掌握了；
你的能力已经提升了；
薄弱点已经解决。
```

## 十、正向反馈来源规则

`whatYouDidWell` 不得由 `StudentFeedbackAdapter` 自行推断。

正向反馈只能来自以下可靠来源：

1. `DiagnosisResult` 中明确的正向观察；
2. `AbilityEvidence` 中的 positive / growth / 可解释表现；
3. `TaskExecutionResult` 中可确认的执行事实。

可展示的执行事实示例：

- 已提交完整句子；
- 已引用一处文本内容；
- 已按要求补充理由；
- 已回应题目核心要求。

不得凭空展示：

- 你推理做得很好；
- 你理解很准确；
- 你的能力已经提升；
- 你已经掌握本题方法；
- 你已经认真思考。

如果没有可靠正向信息，允许：

```ts
whatYouDidWell: []
```

反馈对象不需要为了结构对称强行填满所有字段。

## 十一、补充提示与表现反馈分离

`whatNeedsAttention` 必须区分两类来源。

### 来自 ResponseValidityResult

当作答为空、占位、无关或不足时，只生成补充作答提示。

示例：

```text
请先写出你的判断，再结合文中的一个行为说明理由。
```

此时不得输出能力表现问题，例如：

```text
你的推理链不完整。
```

### 来自 DiagnosisResult / AbilityEvidence

只有当 Runtime 已经形成诊断或 Evidence，才可以生成内容表现反馈。

示例：

```text
你找到了人物的行为，但还需要说明这些行为和心理之间的联系。
```

核心边界：

```text
Validity 判断“有没有可观察表现”；
Diagnosis 判断“这个表现说明了什么”。
```

`StudentFeedbackAdapter` 必须保持这两层分离。

## 十二、页面最小内容

Phase 11.2 页面反馈区域最少展示：

1. 反馈标题；
2. 本次提交状态；
3. 学生做得好的地方；
4. 需要注意或补充的地方；
5. 下一步行动；
6. 是否可以重试；
7. 是否可以结束本轮。

第一版不需要：

- 长篇学习报告；
- 能力雷达图；
- 成长曲线；
- 家长解释；
- 多轮历史对比；
- AI Coach 长对话。

## 十三、学生端展示规则

学生端可以展示：

```text
你的回答已经提交；
这次回答还需要补充；
你已经找到部分依据；
下一步请补充理由；
本轮已完成。
```

学生端不展示：

```text
ResponseValidityResult.status;
TaskEvidenceReturnResult.status;
evidenceType;
confidence;
DiagnosisResult 原始字段；
AbilityEvidence 原始字段；
GrowthMemoryRecord 原始结构；
模型原始输出；
Prompt。
```

开发者调试信息可以放在折叠区域。

折叠区域必须与学生主体验区明显隔离。

## 十四、状态规则

### completed

表示本次 Runtime 已形成可展示反馈。

学生端表达：

```text
本轮已经完成，系统已经分析了你的答案。
```

### retry_required

表示答案还不具备最低分析条件，需要学生补充。

学生端表达：

```text
请再补充一下你的想法或依据。
```

### review_required

表示 Runtime 发现诊断失败、能力不一致或需要人工确认。

学生端表达：

```text
这次回答已经记录，但需要进一步确认。
```

### blocked

表示流程无法继续。

学生端表达：

```text
本次提交暂时无法处理，请稍后重试。
```

## 十五、下一步入口边界

Phase 11.2 可以展示以下入口：

- 继续补充；
- 重新尝试；
- 结束本轮；
- 等待确认；
- 进入本轮结果页。

Phase 11.2 不得自行决定：

- 换能力；
- 降低难度；
- 做迁移题；
- 进入复测；
- 生成下一轮学习策略。

这些仍由 Phase 10 / Phase 8.3 提供。

## 十六、Debug 流程

Phase 11.2 Debug 最小流程：

1. 创建 mock StudentLearningEntryState；
2. 创建 mock StudentResponse；
3. 创建 mock TaskExecutionResult；
4. 创建 mock LearningRoundExecutionResult；
5. 创建 mock TaskEvidenceReturnResult 或 LearningRoundResult；
6. 调用 StudentFeedbackAdapter；
7. 生成 StudentLearningFeedback；
8. 校验反馈中不包含 Runtime 原始字段；
9. 输出 PASS / FAIL。

## 十七、Debug Case

Phase 11.2 Debug 至少覆盖以下样例：

| Case | 输入状态 | 预期反馈 |
| --- | --- | --- |
| 空答案 | `ResponseValidityResult.status = empty` | 提示填写答案，不输出能力评价 |
| 占位回答 | `ResponseValidityResult.status = placeholder` | 提示补充想法或依据 |
| 简短但有效 | `TaskExecutionResult.status = submitted_valid` | 允许分析，不因字数少要求重写 |
| 有效作答，分析中 | `LearningRoundExecutionResult.status = evidence_return_ready` | 显示正在分析，不提前输出结论 |
| Evidence 回流成功 | `TaskEvidenceReturnResult.status = evidence_returned` | 基于正式结果展示优点与关注点 |
| Diagnosis 失败 | `TaskEvidenceReturnResult.status = diagnosis_failed` | 不展示底层错误，不伪造内容反馈 |
| 能力不一致 | `review_required` | 温和说明需要确认，不输出目标能力改善 |
| 多结果状态冲突 | 多个 Result 同时存在 | 使用最靠后的正式状态 |
| 无可靠正向证据 | 无 Diagnosis 正向观察 | `whatYouDidWell` 允许为空 |
| 本轮完成 | `LearningRoundResult.status = completed` | 不使用“答对、掌握、提升”等表述 |

## 十八、Debug Report

Debug Report 至少展示：

- learningRoundId；
- studentId；
- sourceType；
- sourceStatus；
- stage；
- resultStatus；
- headline；
- summary；
- whatYouDidWell；
- whatNeedsAttention；
- nextActionText；
- canRetry；
- canFinishRound；
- debugState；
- PASS / FAIL。

## 十九、验收条件

Phase 11.2 通过条件：

1. 能消费 LearningRoundExecutionResult；
2. 能消费 TaskExecutionResult；
3. 能消费 TaskEvidenceReturnResult；
4. 能消费 LearningRoundResult；
5. 能生成 StudentLearningFeedback；
6. 能区分 completed / retry_required / review_required / blocked；
7. 能区分 submission / analysis / result；
8. 多个输入同时存在时，能按状态来源优先级选择最终反馈依据；
9. 空答案或占位回答不会被描述为能力不足；
10. 短回答不会仅因字数少被判定为无效；
11. Diagnosis 失败不会展示底层错误；
12. Evidence 回流成功不会被描述为能力提升；
13. `whatYouDidWell` 不会在没有可靠来源时被强行填充；
14. ResponseValidity 反馈与 Diagnosis 表现反馈保持分离；
15. 反馈语言学生可理解；
16. 反馈能说明下一步动作；
17. 学生主体验区不暴露 Runtime 原始字段；
18. Debug 输出 PASS；
19. `pnpm run build` 通过。

## 二十、体验验收条件

Phase 11.2 应进行最小体验验收：

1. 学生提交空答案后，是否知道要补充什么；
2. 学生提交占位回答后，是否知道不能只写“不知道”；
3. 学生提交有效答案后，是否知道系统已经开始分析；
4. 反馈出现后，学生是否能复述自己哪里做得好；
5. 学生是否能复述下一步该做什么；
6. 诊断失败或复核状态下，学生是否不会被底层错误吓到；
7. 学生是否不会把“本轮完成”误解为“已经答对或掌握”。

建议让学生回答：

1. 系统刚才告诉你什么？
2. 你哪里做得还可以？
3. 下一步你要补充或练什么？

## 二十一、本阶段不做

Phase 11.2 不做：

- 不启动新的 LearningRound；
- 不重新生成 ConcreteLearningTask；
- 不重新判断作答有效性；
- 不重新运行 Diagnosis；
- 不重新生成 AbilityEvidence；
- 不更新 GrowthMemory；
- 不生成 LearningRoundResult；
- 不生成本轮结束页；
- 不做长期能力报告；
- 不做家长端；
- 不做复杂 AI 对话。

## 二十二、与 Phase 11.3 的关系

Phase 11.2 输出：

```text
StudentLearningFeedback
```

Phase 11.3 接着处理：

```text
LearningRoundResult
+ StudentLearningFeedback
↓
StudentRoundSummary
↓
下一步入口
```

也就是说：

```text
Phase 11.2 = 提交后反馈；
Phase 11.3 = 本轮结束结果。
```

## 二十三、阶段完成定义

Phase 11.2 完成时，应能通过一个页面证明：

```text
学生提交答案
-> Runtime 返回执行或回流状态
-> StudentFeedbackAdapter 转换反馈
-> 学生获得可理解、可行动的反馈
```

这一条学生可读反馈闭环已经成立。

Phase 11.2 完成后，可以宣称：

```text
系统能够将任务执行与 Evidence 回流状态转换为学生可理解反馈。
```

但还不能宣称：

- 学生已经完成完整一轮；
- 本轮学习结果页已经成立；
- 学生能力已经提升；
- 长期成长报告已经可用；
- 正式 Beta 已经成立。

## 二十四、工程验收记录

验收时间：2026-07-14

当前工程状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
Status Frozen
```

已完成工程模块：

- `studentLearningFeedback.schema.ts`
- `studentFeedbackAdapter.ts`
- `runStudentLearningFeedbackDebug.ts`
- `debug:student-learning-feedback`

Debug 已覆盖：

- 空答案；
- 占位回答；
- 简短但有效回答；
- 有效作答分析中；
- Evidence 回流成功；
- Diagnosis 失败；
- 能力不一致；
- 多个 Runtime Result 状态冲突；
- 无可靠正向证据；
- 本轮完成但不宣称答对、掌握或提升。

Demo 已完成最小人工验收：

- 空答案：提示补充，不输出能力评价；
- 占位回答：提示写出判断和依据；
- 有效答案：显示分析完成与学生可读反馈，不宣称答对、掌握或能力提升。

当前结论：

```text
Phase 11.2 已完成学生可读反馈适配层的最小工程闭环。
```

Phase 11.2 可以冻结。
