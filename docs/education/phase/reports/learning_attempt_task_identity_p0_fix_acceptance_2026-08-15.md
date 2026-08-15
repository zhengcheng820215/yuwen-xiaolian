# Learning Attempt 任务身份 P0 修复验收

日期：2026-08-15
状态：`ENGINEERING PASS / REAL USER RETEST PENDING`

## 问题

学生在正式 Learning 提交有效回答后，页面弹出 `learning_task_attempt_input_invalid`。主链已形成 Initial Response、Diagnosis 与 Feedback，但在创建反馈修订 `LearningTaskAttempt` 时失败，阻断了结果呈现。

根因是同一 Attempt 同时接收两份不同语义的任务身份：

- `StudentResponse.taskId` 来自实际执行的 `ConcreteLearningTask.taskId`；
- 调用方传入的 `taskId` 来自 `FrozenQuestionResourceVersion.taskId`。

两者本来可以不同，却被写入一个要求相等的 Schema，因而触发确定性校验错误。

## P0 修复

1. `CreateLearningTaskAttemptInput` 删除调用方独立传入的 `taskId`。
2. `LearningTaskAttempt.taskId` 唯一从冻结的 `Initial Response.taskId` 派生。
3. `resourceId / resourceVersionId / materialVersionId` 继续独立保存正式资源追溯关系。
4. 新增正式资源到执行任务再到 Attempt 的身份回归，明确证明资源任务 ID 与执行任务 ID 不同时仍可合法持久化。
5. 学生端不再暴露内部对象名；相关失败统一说明回答已保留，并开放“重新分析”，无需重新作答。

本修复不迁移、不删除、不重写既有真实学习记录，也不改变题目发布数据。

## 验收结果

| 验收层 | 结果 |
| --- | --- |
| Feedback Revision Stage 1 | `26 / 26 PASS` |
| Feedback Revision Stage 2 | `28 / 28 PASS` |
| Feedback Revision Stage 3 | `15 / 15 PASS` |
| Feedback Revision Stage 4 | `19 / 19 PASS` |
| Phase 1—16.2 单对象端到端（含新增身份用例） | `6 / 6 PASS` |
| Phase 16.3 Day 0 集成 | `15 / 15 PASS` |
| Unified Learning Entry | `24 / 24 PASS` |
| Learning Feedback Presentation | `6 / 6 PASS` |
| Production Build | `PASS` |

构建保留既有大 Chunk 与动态导入提示，均非本次 P0 引入，也不阻断本修复。

## 放行结论

代码层 P0 已关闭，可以进行一次受控真实提交复测。复测应确认：提交后不再出现内部错误弹窗、反馈正常展示、刷新后仍能恢复同一 Attempt；若 Provider 或后续评价短暂失败，应显示“回答已保留”并允许重新分析。
