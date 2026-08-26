# 固定题组继续说明收口验收（2026-08-20）

## 一、问题

Learning 在固定题组完成一题后，同时展示：

- 本题反馈；
- “为什么继续下一项任务”；
- “下一题（当前序号 / 总题数）”。

其中“为什么继续下一项任务”来自后台下一策略说明，但固定题组的下一题已经由 Session Task Queue 确定，并不是基于本题结果重新调度。该说明既重复导航信息，也可能在正确作答后错误暗示“信息还不充分”。

## 二、冻结规则

1. 固定 Session Task Queue 按序进入下一题时，不展示 `continuationReason`；
2. 固定题组只需呈现本题反馈和“下一题（当前序号 / 总题数）”；
3. `continuationReason` 继续保留给真实动态调度，例如正式 Retest、Transfer 或其他可追溯策略变化；
4. 动态说明必须具体且与本题结果一致，不能在正确作答后使用未经正式缺口支持的不足暗示；
5. 本轮只调整只读学生投影和页面展示，不修改 Diagnosis、Evidence、Strategy、Frozen Resource、正式题组或学习记录。

## 三、工程实现

- `StudentLearningPresentation` 新增 `continuationMode` 投影上下文；
- `fixed_task_queue` 模式下清除展示层 `continuationReason`；
- Phase 16.3 正式 Learning 在已完成本题且队列仍有下一题时使用该模式；
- 完成反馈页删除固定队列专用的“为什么继续下一项任务”区块；
- 通用 Narrative Builder 仍保留正式动态 Retest / Transfer 的继续原因生成能力。

## 四、验收结果

- Student Learning Narrative Calibration：`31 / 31 PASS`；
- Learning Feedback Presentation：`10 / 10 PASS`；
- Learning Session Task Queue：`19 / 19 PASS`；
- Phase 16.3 Day 0 Integration：`15 / 15 PASS`；
- Vite Production Build：`PASS`；
- `git diff --check`：`PASS`；
- 真实浏览器状态：反馈页仅显示本题反馈与“下一题（2/6）”，未出现继续说明区块。

构建仍保留既有的大 Chunk 与动态导入提示，均与本次展示收口无关，不构成功能阻断。

## 五、结论

本次收口通过。固定题组连续训练恢复为“反馈 → 下一题”的简洁节奏；动态调度解释能力未被删除，只在学生确实需要理解任务为何发生变化时出现。

## 六、2026-08-26 历史续题身份恢复补充

真实 Session 发现一类历史兼容问题：第 1 题正式结果已保存，题组总数为 6，但旧的自适应下一任务结果处于 `review_required`，页面只显示“返回学习入口”。同时，错误单选沿用了文本题的修订式行动提示。

本轮冻结并实现：

1. 固定队列的下一题由预期 Frozen Resource Version 身份决定；旧匹配只有同时命中该身份才算完整 Admission；
2. 队列内续题使用目标版本派生的确定性 Task Request，不再让旧自适应策略阻断固定顺序；
3. `next_task_review` 且当前题正式结果已保存时，页面投射为可恢复的完成态，并提供“进入第 N 题（共 M 题）”；
4. 单选反馈把干扰项内部依据转换为学生口吻，并把行动限定为“对照具体线索后重新判断选项”；
5. 真实浏览器已验证从《散步》第 1 / 6 题反馈直接进入第 2 / 6 题，未重复提交第 1 题。

## 七、2026-08-26 正式结果优先恢复补充

后续真实 Session 再次出现“第 1 / 5 题已完成，但只显示返回学习入口”。复盘确认该历史 Operation Checkpoint 已进入完成态，却缺少可选的 `taskExecutionResult.studentResponse`；旧页面恢复条件把该易缺失快照当成继续固定队列的必要事实，因此未触发下一题 Admission 重建。

本轮验收边界补强为：

1. 正式持久化记录是当前题完成的主事实，Checkpoint 作答快照只作为恢复输入来源之一；
2. 正式结果已保存、固定队列仍有下一题且下一 Frozen Version 可用时，页面不得投射 `return_to_entry`；
3. 原作答优先从 Checkpoint 恢复，缺失时从正式持久化记录恢复；
4. 恢复动作只重建下一题 Admission，不重新生成当前题 Diagnosis、Evidence、Profile 或正式结果；
5. 新增“正确单选 + 历史完成态缺作答快照 + 第 1 / 5 题”回归，并以真实浏览器从反馈页进入第 2 题作为最终验收。

### 7.1 下一轮直接消费已冻结准入

本轮继续复盘发现：恢复后页面虽然显示“进入第 2 题（共 5 题）”，点击时却再次对同一 Frozen Version 执行动态匹配，实时历史窗口可能把已准入题目重新判为不可进入，导致页面停留在第 1 题。

收口规则如下：

1. 上一题 Checkpoint 已保存的 `matched` 下一题准入快照是固定队列的进入凭据；
2. 版本身份一致、Quality Gated Task 完整且 Readiness 可执行时，下一轮直接消费该快照；
3. 不在进入动作中重复运行受历史窗口影响的动态匹配；
4. 快照不完整或版本身份不一致时才重新执行 Admission；
5. 浏览器验收必须证明一次点击后 Round 从 1 前进到 2，而不只是按钮文案正确。

固定题组的后续 Frozen Version 已经跨过正式发布门禁。恢复和续题链必须对队列中的精确版本确定性重建 Quality Gated Task 封装、Concrete Task 与 Readiness，不再让新的学习历史窗口重新运行动态候选匹配。该规则只适用于已经启动且身份冻结的题组；新 Session 的首题选择及非固定队列调度继续使用既有 Admission Gate。

历史快照即便写有 `matched`，只要缺少 Quality Gated Task、Concrete Task 或可执行 Readiness，仍按不完整处理；但不得立即丢弃已经冻结的合法身份。资源版本与固定队列一致且 Quality Gated Task 已存在时，恢复器优先从该冻结资源确定性补建 Concrete Task 与 Readiness。只有冻结资源或质量任务缺失、身份不一致、补建失败时，才清除残缺准入并重新执行纯 Admission。这样既避免旧 `blocked / review_required` 状态在工程链入口提前返回，也避免实时历史窗口重新否决已经形成的固定题组。若准入本身已经完整，只是 Operation 状态残留旧人工复核或阻断标记，则规范化为可进入下一题，不再重复匹配。
