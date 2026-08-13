# 真实 Learning 最小采集 WP3 工程验收记录

日期：`2026-08-13`

状态：`WP3 PASS`

范围：正式 `/learning` 五事件接入、Application Service、稳定提交意图与非阻塞 Outbox 降级；不包含 WP4 的 Outbox 自动重试／Round 重建，也不包含 WP5 校准 Projection。

## 一、实现结果

### 1.1 Application Service

新增 `LearningObservationService`：

- Event Schema 合法时调用 Repository；
- `created / unchanged / conflict` 原样返回；
- Event Store 抛错时写入稳定 Outbox 并返回 `queued`；
- Outbox 再失败也不向学生主链抛错；
- Demo、错误学生或非法 Event 返回 `dropped`。

### 1.2 五事件触发点

| 事件 | 正式触发点 |
| --- | --- |
| `question_presented` | 题目页面完成渲染后的 animation frame，且处于可作答／修改状态 |
| `answer_submitted` | Task Execution 预检已经形成 `StudentResponse` 后，包括有效与无效提交 |
| `diagnosis_completed` | `FormalDiagnosisCommit.status === committed` 且有 `committedAt` |
| `feedback_presented` | 完成反馈首次内容可见；分阶段反馈在第一段出现时；暂停反馈实际渲染后 |
| `learning_round_completed` | `LearningPersistenceRecord.learningRoundResult.status === completed` |

UI 只调用 API，不直接写 IndexedDB。事件不复制答案、材料、Diagnosis 或 Feedback 正文。

### 1.3 提交意图身份

当前同一 Execution Session 修改答案后 `responseId` 不变。WP3 使用：

```text
submissionIntentId = stableId(responseId + normalizedAnswerText)
attemptId = stableId(student + session + round + submissionIntentId)
```

只保留哈希身份，不把答案复制进 Event ID：

- 同一答案刷新或重复点击复用 Event / Attempt；
- 实质修改答案后再次提交形成新 Event / Attempt；
- 无效答案修改为有效答案时不会把两次提交混为一份样本。

恢复处理优先复用 Checkpoint 中首次提交时间，避免重复处理制造时间冲突。

## 二、Debug 与回归

### 2.1 WP3 专项 Debug

命令：`debug:learning-minimum-collection-wp3`

结果：`9 / 9 PASS`。

覆盖：正常五事件、共享 Attempt、刷新幂等、无效提交事件边界、Event Store 故障转 Outbox、错误保存、Demo 丢弃，以及修改答案形成新提交意图。

### 2.2 浏览器正式入口验收

通过正式 `http://localhost:5174/learning#/learning`：

1. 从学习入口点击“开始学习”；
2. 正式材料、题目与作答区实际可见；
3. `question_presented = 1`；
4. 刷新后仍为 `1`；
5. Event 绑定固定 Product 学生、当前 Round 和实际 `resourceVersionId`；
6. 无重复 Event ID。

本次没有替学生提交答案，因此没有人为写入 Answer、Diagnosis、Feedback 或 Round Completed；后四类事件将在真实作答自然发生时产生。

### 2.3 自动化回归

| 检查 | 结果 |
| --- | --- |
| WP1 Schema / Identity | `13 / 13 PASS` |
| WP2 Repository | `19 / 19 PASS` |
| Phase 16.3 正式学习主链 | `16 / 16 PASS` |
| Phase 16.3 Day 0 | `15 / 15 PASS` |
| Product / Demo 隔离 | `11 / 11 PASS` |
| Production Build | `PASS` |
| `git diff --check` | `PASS` |

Build 继续存在既有动态导入和大 Chunk Warning，不是 WP3 新失败。

## 三、验收结论

WP3 已达到工程 PASS：正式 `/learning` 已接入五事件触发点，刷新和重复处理幂等，修改答案形成新提交意图，采集失败不阻断学习，Demo 数据不能进入 Product Event。

当前已开始形成真实事件，但尚未实现 WP4 Outbox 自动重试与权威 Round 补写，也尚未实现 WP5 校准 Attempt Projection。因此不能把 Event Store 的存在解释为校准接续已经完成。
