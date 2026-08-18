# Learning 任务理由具体化验收记录（2026-08-18）

## 1. 问题与结论

Learning 页“为什么练这题”曾只按能力标签生成通用说明，例如“继续练习理解，把阅读思路用在当前材料中”。该说明没有回答当前题目具体练什么，也会让首次训练错误地呈现为“继续练习”。

本次修复后，任务理由优先使用正式资源绑定的 Observation Task 事实：

- `expectedStudentAction`
- `observationGoal`
- `designReason`
- `TrainingTask Role`

学生端不展示答案、选项身份、评分项、干扰项或内部对象名。首次普通 Training 不再无依据使用“继续练习”。

## 2. 目标示例

针对题目“女娲最初感到孤独，是因为什么？”，正式资源中的预期动作是：

> 阅读第 1–2 段，定位描述女娲孤独的句子，并判断最直接的原因。

学生端目标文案为：

> 这道题先练习阅读第 1–2 段，定位描述女娲孤独的句子，并判断最直接的原因，为后面的解释和分析打基础。

该说明与单项选择的基础理解入口定位一致，不再使用“阅读思路”等空泛表述。

## 3. 根因与修复边界

根因有两层：

1. `ConcreteLearningTask` 未携带 Observation Task 的学习意图；
2. 实时 Learning 入口匹配正式资源后，又重复构造 Concrete Task，丢失了已解析的运行时上下文。

修复包括：

- 在 Concrete Task 中增加只读 `learningIntent`；
- 正式资源运行时适配器传递具体观察目标、学生动作与设计理由；
- Learning 当前轮次优先复用正式资源匹配结果，不再无条件重复构造任务；
- Narrative Agent 按 Training / Retest / Transfer / Diagnosis 角色生成不同语义；
- 增加答案和内部评分类信息泄漏门禁，异常时安全降级。

## 4. 自动化验收

以下回归全部通过：

- Student Learning Narrative：30 / 30
- Reading Single Choice Stage 4 E2E：13 / 13
- Phase 17.3 Learning Entry：16 / 16
- Unified Learning Entry：24 / 24
- Phase 16.3 Real Learning Chain：16 / 16
- Phase 16.3 Day0 Integration：15 / 15
- Phase 17.3 Batch A Integration：17 / 17
- Vite production build：通过

覆盖边界包括：

- 基础理解单选的具体进入层说明；
- 普通文本 Training 的具体任务动作；
- Retest、Transfer、Diagnosis 的角色语义；
- 不泄漏正确答案、选项 ID、评分项与干扰项；
- 正式资源到 Learning 的学习意图完整传递。

## 5. 浏览器验收说明

验收时真实 `/learning` 页面已经处于“本轮学习已经完成 / 下一任务待检查”状态。为避免重置真实学习进度，没有通过浏览器重新开始或重复提交。当前题目的目标文案由正式资源事实与已通过的端到端测试验证；下一次正常进入对应正式任务时会使用新说明。

## 6. 验收结论

本次修复达到以下要求：

- 说明与当前题目、作答形式和训练角色匹配；
- 基础理解单选能明确呈现“定位—判断—为后续分析打基础”的层级作用；
- 不增加新的人工步骤；
- 不修改已发布题目内容，不要求重新解析或重新发布正式资源；
- 保持现有 Learning 失败恢复与进度状态。
