# 真实 Learning 最小采集 WP2 工程验收记录

日期：`2026-08-13`

状态：`WP2 PASS`

范围：事件、Outbox 与校准投影 Repository、独立 IndexedDB Upgrade、幂等和冲突语义；未接入正式 `/learning` 触发点。

## 一、实现结果

新增 Repository：

- `LearningObservationRepository`；
- `LearningObservationOutboxRepository`；
- `QuestionCalibrationProjectionRepository`；
- 三套 In-memory 合同实现；
- 三套 IndexedDB 实现。

采集使用独立数据库：

```text
yuwen_xiaolian_learning_collection
version: 2
```

Object Store：

| Store | 主键 | 关键索引 |
| --- | --- | --- |
| `learningObservationEvents` | `eventId` | `studentRound`、`resourceVersionId`、`eventType` |
| `learningObservationOutbox` | `outboxId` | unique `eventId`、`learningRoundId`、`nextRetryAt`、`status` |
| `questionCalibrationProjections` | `projectionId` | unique `attemptId`、`studentRound`、`resourceVersionStatus`、`status` |

独立数据库不会修改现有 Learning Persistence、Session、Operation 与 Multi-day 数据库版本。Upgrade 使用存在性检查，保留同库旧 Store 和历史记录。

## 二、Repository 语义

- Event 首次写入为 `created`；相同业务内容即使 `recordedAt` 不同也为 `unchanged`，保留首次记录；同 ID 不同业务内容为 `conflict`，禁止覆盖。
- Outbox 相同身份允许更新 retry 状态和次数；改变 `eventId` 或 `createdAt` 为身份冲突。
- Projection 同内容为 `unchanged`；同 `projectionId` 不同内容为冲突；`attemptId` 建立唯一索引，禁止两个 Projection 争用一个 Attempt。
- 所有 In-memory 返回值均为副本，调用方不能通过引用修改 Repository 内部状态。
- 查询支持 Round、Resource Version、Eligible 状态及 Outbox 到期时间。

## 三、Debug 结果

### 3.1 Repository 合同 Debug

命令：`debug:learning-minimum-collection-wp2`

结果：`19 / 19 PASS`

覆盖首次写入、幂等、冲突不覆盖、Round/Version 查询、副本隔离、Outbox 更新/到期/删除、Projection Attempt 唯一性及各 Store 清理。

### 3.2 浏览器 IndexedDB 隔离验收

通过隔离数据库执行 v1 → v2 Upgrade 与真实 IndexedDB CRUD：`19 / 19 PASS`。

验证：

- 旧 `legacySentinel` Store 在升级后仍存在；
- 三个新 Store 与复合、唯一索引均存在；
- Event 创建、幂等、冲突与 Round 查询通过；
- Outbox 到期查询与删除通过；
- Projection 创建、幂等、Attempt 唯一约束与版本查询通过。

测试数据库使用随机隔离名称，完成后已删除；没有写入正式 `yuwen_xiaolian_learning_collection`，也没有修改现有 Learning 数据。

### 3.3 回归

| 检查 | 结果 |
| --- | --- |
| WP1 Schema / Identity | `13 / 13 PASS` |
| Production Build | `PASS` |
| `git diff --check` | `PASS` |

Build 保留既有动态导入和大 Chunk Warning，不属于 WP2 新失败。

## 四、验收结论

WP2 已达到工程 PASS。Repository、独立 IndexedDB Upgrade、索引、幂等、冲突和隔离验收均成立，且尚未采集任何正式事件。

## 五、2026-08-14 第四阶段工程收口补充

- 浏览器隔离验收更新为 `28 / 28 PASS`；
- Upgrade 从空库结构检查增强为带实际 Event、Outbox、Projection 与无关旧 Store 的 v2 → v3 数据保留检查；
- Projection 的重复检查、冲突判断和写入合并进同一个 `readwrite` Transaction；
- 两个 Repository 实例并发写入同一 Attempt 时，相同记录稳定返回 `created + unchanged`，不同 Projection 身份稳定返回 `created + conflict`；
- 唯一索引继续保留为最后一道数据库约束，但正常并发不再向调用方暴露原始 ConstraintError。

第四阶段结论：`INDEXEDDB UPGRADE PASS / CROSS-TAB PROJECTION IDEMPOTENCY PASS`。

下一工作包为 WP3：通过 Application Service 把五个事件逐项接入正式 `/learning`。WP3 前不得把 Repository 存在误报为真实数据已经开始采集。
