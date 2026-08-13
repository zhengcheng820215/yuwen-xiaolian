# 真实 Learning 最小采集 WP0 / WP1 工程验收记录

日期：`2026-08-13`

状态：`WP0 PASS / WP1 PASS`

范围：工程工作包 WP0 基线保护与 WP1 Schema／稳定身份；未接入正式 `/learning` 事件、IndexedDB 新 Store、Outbox、Attempt 投影或内部报告页面。

## 一、WP0 基线保护

### 1.1 已确认的本地持久化基线

| Repository | IndexedDB | Version | Store |
| --- | --- | ---: | --- |
| Learning Persistence | `yuwen_xiaolian_learning_runtime` | 1 | `learning_persistence_records` |
| Learning Session | `yuwen_xiaolian_learning_sessions` | 1 | `learning_session_records` |
| Real Learning Operation | `yuwen_xiaolian_real_learning_operations` | 1 | `operation_checkpoints` |
| Multi-day Run | `yuwen_xiaolian_phase16_3_multiday` | 1 | `multiday_runs` |

WP1 未修改这些 Database、Version 或 Store，未写入浏览器真实数据。

### 1.2 基线 Debug

| 检查 | 结果 |
| --- | --- |
| Task Execution 有效／无效回答 | `16 / 16 PASS` |
| Phase 16.3 正式学习主链 | `16 / 16 PASS` |
| Phase 16.3 Day 0 入口、恢复与重复提交 | `15 / 15 PASS` |
| Product / Demo 隔离 | `11 / 11 PASS` |
| Phase 16.1 → 16.2 资源串联 | `5 / 5 PASS` |
| Phase 17.3 Batch A 正式资源串联 | `17 / 17 PASS` |
| 既有题目校准 Debug | `6 / 6 PASS` |
| Production Build | `PASS` |

### 1.3 基线缺陷与修复

Product / Demo 隔离回归首次运行在 transfer Fixture 上失败。原因是正式准入规则已统一为“只有 retest 使用 `no_hint`，其他角色默认 `limited_hint`”，但 `phase161To162IntegrationDemo` 仍给 transfer 写入 `no_hint`，且测试 Envelope 同样保留旧派生逻辑。

修复只统一 Fixture 与测试 Envelope 的提示策略，没有改变正式 Learning 主链、学生身份或运行编排。修复后 Product / Demo 隔离、Phase 16 资源串联与 Phase 17.3 Batch A 回归全部通过。

## 二、WP1 Schema 与稳定身份

### 2.1 实现内容

- `LearningObservationEvent` 与五种受控 Payload；
- Product scope、固定学生、时间、必填身份及 Event／Payload 一致性校验；
- `QuestionCalibrationProjectionRecord` 与 eligible／excluded／failed 状态；
- `LearningCollectionIntegrityReport`、Issue Code 与状态优先级；
- `attemptId / eventId / projectionId / presentationId` 稳定生成函数；
- `question_empirical_calibration_v2`；
- v1 Attempt 只读兼容，不把未知主体的多次作答伪装为独立使用者；
- 缺少可比 `totalScore` 时只计算均分，不计算高低组区分度。

### 2.2 WP1 专项 Debug

`debug:learning-minimum-collection-wp1`：`13 / 13 PASS`。

覆盖：

1. 相同输入产生稳定 Attempt ID；
2. 不同 Round 产生不同 Attempt ID；
3. 时间不参与 Event ID；
4. 合法 Product Event 通过；
5. Event／Payload 错配被拒绝；
6. Demo 身份被拒绝；
7. 单学生 eligible Projection 不要求伪造总分；
8. 单轮伪造总分被拒绝；
9. Demo Projection 不能 eligible；
10. 同一学生30次作答仍只有一个独立主体；
11. 30个独立主体无可比总分时可算均分但不算区分度；
12. v1 历史输入可读取但不会伪造独立主体；
13. 完整性报告状态按 fail 优先。

## 三、验收结论

WP0 与 WP1 已达到工程 PASS：既有学习链基线明确，新增 Schema、校验器、身份算法和校准 v2 兼容边界已实现并通过专项测试，且尚未改变学生页面或写入真实事件。

下一工作包为 WP2：实现独立 IndexedDB Repository、Upgrade、幂等写入和冲突语义。WP2 未完成前，不得宣称五事件已经被采集。
