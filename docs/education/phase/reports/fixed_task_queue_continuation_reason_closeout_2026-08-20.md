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
