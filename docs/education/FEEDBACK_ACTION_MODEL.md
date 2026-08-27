# 反馈行动转换模型（Feedback Action Model）

**Status:** DETERMINISTIC V1 IMPLEMENTED

## Rubric 对齐反馈的阶段边界

`RubricFeedbackProjection v1` 已完成阶段 1 工程验收；`StudentVisibleFeedbackGrounding v1` 的阶段 2 最小接入也已通过 30/30 专项验收、旧主链回归和 production build。当前只在显式传入合法 `projectionGrounding` 时影响 Action Plan 内部结果；尚未接入学生可见 Narrative Runtime，也不改变 Learning 页面。

后续接入必须保持以下责任分离：

```text
Formal Diagnosis / Requirement Coverage
→ RubricFeedbackProjection
→ StudentVisibleFeedbackGrounding（最小必要裁剪）
→ StudentFeedbackActionPlan
→ Student Learning Narrative
```

Projection 不得成为第二个 Diagnosis；Narrative 不得读取完整 Rubric、`acceptedSignals`、权重、标准答案或正确选项身份。单选继续使用 `selectedOption → distractor rationale → 重新核对动作` 的独立反馈链，不套用文本题 Rubric 补全逻辑。

## 文档定位

本文档定义系统如何把 `StudentThinkingAnalysis` 与 `Learning Gap` 转换为学生能够理解和执行的反馈，不重新诊断、不生成能力结论，也不直接给出完整答案。

## 核心链路

```text
Diagnosis Result / Requirement Coverage
↓
Learning Gap
+ StudentThinkingAnalysis
↓
StudentFeedbackActionPlan
↓
Student Learning Narrative
```

## 学生反馈结构

### 1. 已经完成的思考

回答两个问题：

- 学生已经完成了哪个具体答案或思考动作？
- 这个动作为什么有助于完成当前题目？

肯定必须能够回到学生原始答案，不使用无依据的“理解得很好”。

### 2. 思考缺口

不只说“缺少依据”，还应说明：

- 当前答案从哪一步直接跳到了哪一步；
- 缺少这个连接会使读者无法判断什么；
- 该判断是可观察问题，还是仍待验证的原因假设。

当正式原因码为 `conclusion_inconsistent` 时，反馈必须尽可能同时引用：

- 学生原回答中的心理判断；
- 当前正在核对的材料动作或语句；
- 两者为什么暂时不能对应。

不得只写“人物心理与材料意思不一致”。如果历史记录缺少学生原回答或材料线索，应明确保留信息限制，不得编造具体内容。

### 3. 下一步训练

优先提供思考支架，而不是把标准答案拆成机械填写步骤：

- 提出一个指向关键连接的思考问题；
- 首次反馈默认只提供能够补上当前连接的思考问题；
- 只有学生经过思考仍无法表达、且 Runtime 已记录明确的提示升级状态时，才提供不含完整答案的句式支架；
- 避免连续输出“先找、再写、最后合并”式答案组装清单。

示例：

```text
想一想：父亲为什么会停留很久？这个动作除了说明他珍惜树叶，还表现了怎样的心理？

先别急着改答案。看看材料中的这个动作，想一想：它说明人物当时在想什么？再根据这个心理重新组织答案。
```

## 禁止表达

- 你的答案不够完整；
- 缺少细节；
- 需要深入分析；
- 加强理解；
- 仅复述“找动作、说明关系”而不点明当前答案的具体断点；
- 把一次表现写成固定能力标签。

## 校验要求

- `acknowledgedAction` 必须引用已核验学生表现；
- `whyItMatters` 必须说明与本题要求的关系；
- `problemMechanism` 必须来自可追溯的思考断点；
- 结论偏差反馈必须能够追溯到 `StudentResponse` 与正式材料线索；
- `thinkingPrompt` 必须推动学生补上关键连接；
- `scaffoldTemplate` 不得在首次正式反馈中默认出现，也不得让学生用固定句式替代思考；
- Scaffold 不得泄露完整结论；
- 无效作答只请求完成有效回答，不生成虚构肯定或具体能力缺口。

## 反馈后修订边界

当正式 Training 任务存在一个可执行缺口时，`StudentFeedbackActionPlan` 可以进一步形成 `Revision Goal`，用于引导学生完成一次反馈后修订。

```text
Initial Response
↓
Initial Diagnosis
↓
StudentFeedbackActionPlan
↓
Revision Goal
↓
Revised Response
↓
Revision Evaluation
```

Revision Goal 必须：

- 绑定首次 Diagnosis 与首次 Feedback；
- 只保留一个主要修改目标，最多包含两个紧密相关观察点；
- 明确“缺什么、关注什么、下一步做什么”；
- 不泄露完整结论、标准答案或可直接复制的答案结构；
- 不因为页面存在反馈就机械生成；首次回答已经充分达标时不生成。

学生进入修订状态后，反馈应压缩成一至两条修改提示，不把完整 Diagnosis Metadata、Rubric 内部判断或多层分析同时展示给学生。

完整任务角色、资格决策和一次修订限制遵循[Learning 反馈后修订契约](../product/LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)。

## Revision Evaluation

Revision Evaluation 不是第二次普通 Diagnosis，也不是重复输出第一次反馈。它只比较：

1. 首次反馈指出的主要问题是否得到修复；
2. Revised Response 是否实际响应了 Revision Goal；
3. 修改是否引入新的错误；
4. 最终回答是否达到当前任务要求。

学生端输出保持三部分：

```text
已改善
你补充了……，解决了……

仍需注意
……

下次遇到类似题目
先……
```

如果修订没有解决主要问题，应明确指出“改动了什么”和“关键问题为何仍未解决”，不得只写“还需要继续努力”。如果 Revision Evaluation 暂时失败，只能说明“修改已保存，评价暂时不可用”，不得伪造改善结论。

Revision Evaluation 形成的是 feedback-supported improvement evidence。它不得覆盖 Initial Evidence，不得直接宣布长期能力提升，也不得替代 Retest、Transfer 或 delayed retest。

工程判定必须使用同一冻结题目版本下的首次与修订 Formal Diagnosis 作差异比较；Revised Diagnosis 只服务于本次评价，不再次进入普通 Feedback、Task Evidence Return 或题目校准。Formal Diagnosis 未形成或版本错位时进入待补评价，不能退化为按字数、关键词或字符串差异宣布改善。

## Rubric Projection 阶段边界（2026-08-27）

系统已完成 `rubric_aligned_feedback_stage1_v1` 的确定性、只读 Projection：仅在题目、回答、执行 Session 与已提交 Formal Diagnosis 身份一致时，把正式 Requirement Coverage 投射为 `achieved / partially_achieved / missing / not_assessable`，并选择一个一次行动可改善的主要断点。该层不重新诊断、不写入 Evidence 或 Profile、不投射到 Learning 学生界面；单项选择继续使用独立反馈契约。学生可见反馈接入必须等待后续阶段另行冻结与验收。

## 修订反馈校验要求

- 每条“已改善”必须能够引用 Revised Response 中相对 Initial Response 的真实变化；
- `resolvedIssueCodes` 必须是首次正式缺口的子集；
- `remainingIssueCodes` 必须说明首次主要缺口中尚未解决的部分；
- `newIssueCodes` 只记录修订新引入的问题，不把首次问题重复计入；
- `feedbackRespondedTo` 只表示修改是否响应反馈，不等同于最终回答已经达标；
- 不向学生展示数值 Revision Score 或反馈利用能力分数；
- 修订完成后不再生成第三轮修改动作，剩余严重缺口交给后续 Training Task。
- Profile 只允许 `append_evidence_only`；能力状态和长期置信度保持不变，Growth Memory 必须标注反馈支持条件并要求后续独立复测或迁移验证。
