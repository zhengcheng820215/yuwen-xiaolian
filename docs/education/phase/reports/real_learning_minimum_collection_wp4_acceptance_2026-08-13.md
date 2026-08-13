# 真实 Learning 最小采集 WP4 工程验收记录

日期：`2026-08-13`

状态：`WP4 PASS`

范围：Outbox 到期重试、指数退避、终止失败、页面启动与提交完成恢复、权威 Round 补写；不包含 WP5 校准 Projection。

## 一、实现结果

### 1.1 Outbox 恢复

- `LearningObservationService.retryDue()` 按 `nextRetryAt` 处理到期记录，默认单次最多 50 条；
- 写入 Event Store 成功或已存在相同事件后删除 Outbox；
- 临时失败按有上限的指数退避重新排队；
- 达到最大次数或发生 Event 身份冲突后进入 `failed`，不再被到期队列反复消费；
- 重试复用 Outbox 中的原事件，`occurredAt` 不改写为恢复时间；
- Outbox 查询或处理失败均不阻断学生学习主链。

### 1.2 Round 权威补写

正式 Learning 在工作区加载时先重试到期 Outbox，再依据现有权威对象补写：

| 事件 | 权威依据 |
| --- | --- |
| `answer_submitted` | `RealLearningOperationCheckpoint.taskExecutionResult.studentResponse` |
| `diagnosis_completed` | `formalDiagnosisCommit.status === committed` 与 `committedAt` |
| `learning_round_completed` | `LearningPersistenceRecord.learningRoundResult.status === completed` |

补写继续使用原始提交、诊断提交和持久化时间，并复用 WP3 的稳定 Event/Attempt 身份。刷新或重复恢复只返回 `unchanged`，不新增重复记录。

`question_presented` 和 `feedback_presented` 没有从后台状态反推；它们仍只由实际 UI 可见触发，防止把“后台已生成”误记成“学生已看见”。

### 1.3 恢复触发点

- `/learning` 工作区加载；
- 无效提交处理完成；
- 正式学习主链完成并记录结果之后。

## 二、Debug 与验收

### 2.1 WP4 故障注入

命令：`debug:learning-minimum-collection-wp4`

结果：`12 / 12 PASS`。

覆盖首次失败入 Outbox、原发生时间保留、成功恢复、成功后删除、重复恢复幂等、指数退避、到期前不执行、最大次数终止、终止记录不再消费、三类权威事件补写，以及两类 UI 可见事件不反推。

### 2.2 浏览器 IndexedDB 验收

隔离数据库页面：`learning-collection-wp4-smoke.html`

结果：`6 / 6 PASS`：

- `outbox_seeded`
- `due_retry_succeeded`
- `original_occurred_at_preserved`
- `outbox_deleted_after_success`
- `repeat_retry_noop`
- `single_event_after_repeat`

验收使用临时 IndexedDB，结束后删除，不污染正式 Learning 采集数据。

### 2.3 回归

| 检查 | 结果 |
| --- | --- |
| WP1 Schema / Identity | `13 / 13 PASS` |
| WP2 Repository | `19 / 19 PASS` |
| WP3 Runtime Collection | `9 / 9 PASS` |
| WP4 Recovery | `12 / 12 PASS` |
| 浏览器 IndexedDB Recovery | `6 / 6 PASS` |
| Production Build | `PASS` |

Build 仍有既有的动态导入与大 Chunk Warning，不是 WP4 新失败。

## 三、验收结论

WP4 已达到工程 `PASS`：采集临时失败可以自动恢复，恢复不会重写事实时间或制造重复事件；正式 Round 可从权威 Checkpoint/Persistence 补齐三类后台事实，同时不伪造学生实际看见题目或反馈的行为。

下一工作包是 WP5：把 `answer_submitted` 与正式诊断、完成事实投影为 `AnonymousQuestionCalibrationAttempt`，并落实 eligible/excluded 判定。
