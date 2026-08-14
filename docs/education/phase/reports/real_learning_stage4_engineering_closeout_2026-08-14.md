# 真实 Learning 第四阶段工程收口记录

日期：`2026-08-14`

状态：`ENGINEERING CLOSEOUT PASS / REAL USE VALIDATION PENDING`

## 一、范围

本阶段收口以下工程风险：

1. 正式事件运行代际与完整性报告代际不一致；
2. 多标签页同时写入同一校准 Attempt 时存在事务外竞态；
3. IndexedDB v2 → v3 只验证结构升级，没有证明旧数据保留；
4. 同一学生重复完成多轮时可能被误读为多个独立使用者；
5. WP0—WP7、正式学习主链和浏览器闭环缺少同批次最终复验。

本阶段不生成或伪造真实学生作答，不把隔离 Fixture 写成真实校准数据。

## 二、实现结论

- `CURRENT_LEARNING_COLLECTION_GENERATION` 与起始时间移入独立代际模块；
- 正式 Learning 的 `appVersion` 使用 `real_learning_collection_v1`；
- Projection 使用同一 IndexedDB `readwrite` Transaction 完成读取、冲突决策和写入；
- In-memory 与 IndexedDB Repository 共用同一纯冲突决策函数，避免两套规则漂移；
- v2 迁移 Fixture 预置 Event、Outbox、Projection 和旧 Store，升级后逐项读取确认；
- 浏览器并发覆盖相同记录幂等和不同 Projection 身份冲突；
- WP6 新增同一学生双轮、双 eligible、单一 `subjectKey` 的计数回归。

## 三、验证结果

- WP1—WP7：`13/13、19/19、9/9、12/12、16/16、29/29、12/12 PASS`；
- Question Calibration：`6/6 PASS`；
- 正式主链基线：Task Execution `16/16`、Real Chain `16/16`、Day 0 `15/15`、Scope Isolation `11/11`、Phase 16.1→16.2 `5/5`、Phase 17.3 Batch A `17/17`；
- 浏览器 IndexedDB Upgrade / Cross-tab：`28/28 PASS`；
- 浏览器 WP7 Final：`7/7 PASS`；
- 内部完整性页面：当前采集链与全部历史均可切换，空范围保持 `AWAITING DATA`；
- Production Build：`PASS`。

## 四、未完成项

仅剩真实使用验证，不是工程缺陷：

1. 真实使用者完成一次有效回答；
2. 真实使用者完成一次无效回答，再修改并有效提交；
3. 内部页面确认每个 `answer_submitted.attemptId` 都有且只有一个 eligible、excluded 或 projection failed；
4. 刷新后事件和 Projection 数量不增加；
5. 当前采集链只判断当前代际，全部历史继续保留旧事实。

在上述真实行为发生前，只能宣称“工程可进入真实使用”，不能宣称“已完成真实数据校准”。
