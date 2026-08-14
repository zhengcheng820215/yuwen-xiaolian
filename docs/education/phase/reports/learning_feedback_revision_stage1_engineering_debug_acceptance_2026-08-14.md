# Learning 反馈后修订阶段 1 工程与 Debug 验收

日期：`2026-08-14`

状态：`STAGE 1 ENGINEERING + DEBUG PASS`

## 一、验收范围

本次只验收反馈后一次修订的第一阶段基础工程：

- `LearningTaskAttempt`、`FeedbackGuidedRevision`、`RevisedResponse`、`RevisionEvaluation` Schema；
- Initial Attempt、LearningTaskAttempt、Revision、Revised Response 与 Revision Evaluation 稳定身份；
- In-memory 与 IndexedDB Repository；
- Initial Response 与已提交 Revised Response 不可变；
- 每个 Initial Attempt 只形成一个 LearningTaskAttempt，每题最多一个 Revision；
- 创建、开始修订、保存草稿、提交与刷新恢复的幂等和冲突处理；
- IndexedDB v3 → v4 迁移时保留既有 Event、Outbox、Calibration Projection 与其他 Store；
- Revision 不创建第二个题目校准 Projection。

本阶段不实现 Revision Offer Policy、学生端按钮、Revision Mode、Revision Evaluation Runtime、Evidence 回流或扩展事件。

## 二、工程产物

| 类型 | 文件 / 结果 |
| --- | --- |
| Schema | `src/ai/schemas/learningFeedbackRevision.schema.ts` |
| 稳定身份 | `src/ai/agents/learningFeedbackRevisionIdentity.ts` |
| Repository Contract | `src/ai/repositories/learningTaskAttemptRepository.ts` |
| In-memory Repository | `src/ai/repositories/inMemoryLearningTaskAttemptRepository.ts` |
| IndexedDB Repository | `src/ai/repositories/indexedDBLearningCollectionRepositories.ts`，数据库版本升级为 v4 |
| Persistence Service | `src/ai/services/learningFeedbackRevisionPersistenceService.ts` |
| 领域 Debug | `src/ai/tests/runLearningFeedbackRevisionStage1Debug.ts` |
| 浏览器验收 | `learning-feedback-revision-stage1.html` 与 `src/ai/tests/runLearningFeedbackRevisionStage1BrowserAcceptance.ts` |

## 三、Debug 结果

| 验收组 | 结果 | 核心覆盖 |
| --- | ---: | --- |
| Revision Stage 1 领域 Debug | `26 / 26 PASS` | 身份、Schema、不可变、单次 Revision、幂等、状态迁移、恢复 |
| Revision Stage 1 浏览器验收 | `18 / 18 PASS` | v3→v4、旧数据保留、索引、双实例并发、草稿 / 提交恢复、Projection 唯一 |
| 既有 Learning Collection WP2 浏览器回归 | `30 / 30 PASS` | v2→v4、旧 Store / 数据、Event / Outbox / Projection、跨标签页事务 |
| Learning Minimum Collection WP1 | `13 / 13 PASS` | Attempt / Event 身份和校准口径 |
| Learning Minimum Collection WP2 | `19 / 19 PASS` | Repository 幂等、冲突与查询 |
| Learning Minimum Collection WP3 | `9 / 9 PASS` | 五事件记录、Outbox 和刷新幂等 |
| Learning Minimum Collection WP7 | `12 / 12 PASS` | 完整链、唯一 Projection、完整性报告 |
| Learning Persistence | `13 / 13 PASS` | 刷新恢复、提交中断、损坏数据阻断 |
| Phase 16.3 Real Learning Chain | `16 / 16 PASS` | 正式主链、Provider / Persistence 恢复和重复提交 |
| Production Build | `PASS` | Vite production bundle 成功 |

自动化检查合计 `156 / 156 PASS`。专项浏览器控制台 `error / warn = 0`。

## 四、Debug 中发现并修复的问题

1. Node strip-only 模式不支持 TypeScript parameter property：Persistence Service 改为显式字段赋值，保持项目现有 Debug 运行方式可执行。
2. Revision 尚无 Evaluation 时，Schema 的可选关联判断会误判非法：改为只在 Evaluation 存在时检查 `revisionId` 对齐。
3. 草稿保存路径误引用提交参数：删除错误分支，提交后的不可变与重复提交幂等统一由 `submitRevision` 处理。
4. 既有 WP2 浏览器迁移名称和 Store 检查停留在 v3：升级为 v2→v4，并纳入 LearningTaskAttempt Store 与唯一 Initial Attempt 索引。

## 五、验收结论

第一阶段基础已经能够作为后续工程的正式底座：首次独立表现不会被修订覆盖；修订草稿和提交结果具有稳定身份，可在刷新和 Repository 重建后恢复；同一题不会因重试或跨实例写入产生第二个 LearningTaskAttempt、Revision 或校准 Projection。

可以进入阶段 2，但阶段 2 必须在该 Repository 与状态模型上实现资格决策和学生交互，不得另建前端临时修订状态，也不得提前接入 Revision Evaluation 或扩展事件。
