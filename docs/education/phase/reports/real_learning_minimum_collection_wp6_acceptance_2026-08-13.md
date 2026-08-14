# 真实 Learning 最小采集 WP6 工程验收记录

日期：`2026-08-13`

状态：`WP6 PASS`

范围：完整性审计 Service、14 类 Issue Code、内部只读报告与真实浏览器验收；不包含 WP7 最终端到端验收收口。

## 一、实现结果

### 1.1 完整性审计

新增 `LearningCollectionIntegrityService`，以 Checkpoint、Persistence、Event 和 Projection 为输入，按权威身份重新闭合 Session、Round、Response、Diagnosis 和 Resource Version。

已实现：

- 五类事件计数；
- Session、正式轮次、完成轮次、提交、eligible/excluded Projection 和独立主体计数；
- `warning / fail / pass` 优先级；
- 契约规定的 14 类 Issue Code；
- 重复、缺失、版本错绑、身份错绑、Demo 泄漏、时间倒置、未完成却 eligible 与独立主体过计检查。

报告使用权威 Response 重新计算 Attempt 身份，不相信外部传入的声称值。审计 Service 无任何 Repository 写入方法。

### 1.2 Repository 只读查询

Event、Projection 和 Operation Repository 增加只读列表查询；Learning Collection IndexedDB 升级到 v3，补充 `studentId` 索引。升级保留原有 Event、Outbox 和 Projection 数据。

### 1.3 内部页面

新增内部路由：`/internal/learning-collection`。

页面显示：

- 总体 `PASS / WARNING / FAIL`；
- 轮次、完成、提交、有效/排除样本、独立使用者计数；
- Issue Code、等级与说明；
- 按 Round 展开的五事件、Projection 状态和题目版本。

页面不显示原始答案、Diagnosis 正文或学生技术身份，不进入学生默认入口，不自动补写或修改正式数据，也不使用“题目已验证”表述。

## 二、Debug 与验收

### 2.1 WP6 公式 Debug

命令：`debug:learning-minimum-collection-wp6`

结果：`18 / 18 PASS`。

正常完整链得到 `pass`；缺少题目/反馈展示得到 warning；其余关键缺失、重复、错绑、泄漏和过计得到 fail；同时验证 fail 优先于 warning。

### 2.2 全量回归

| 检查 | 结果 |
| --- | --- |
| WP1 Schema / Identity | `13 / 13 PASS` |
| WP2 Repository | `19 / 19 PASS` |
| WP3 Runtime Collection | `9 / 9 PASS` |
| WP4 Recovery | `12 / 12 PASS` |
| WP5 Projection | `16 / 16 PASS` |
| WP6 Integrity | `18 / 18 PASS` |
| Production Build | `PASS` |

### 2.3 真实浏览器页面

内部页面成功打开，IndexedDB v3 升级成功，刷新前后可见报告一致，页面明确显示只读说明。

当前正式历史数据报告为 `FAIL`，发现：

- `missing_answer_submitted`
- `missing_diagnosis_completed`
- `missing_round_completed`
- `missing_projection`

这是符合预期的历史状态：已有正式轮次早于 WP3—WP5 完整采集链部署，不能在 WP6 中为了得到绿色报告而补造学生当时的展示、提交或校准事实。新完成的真实 Learning 轮次将按当前链路自然形成完整事件与 Projection；WP7 再执行固定端到端健康轮次，验证内部报告转为 pass。

## 三、验收结论

WP6 已达到工程 `PASS`：内部系统能够只读识别完整链与不完整链，并准确暴露历史缺口，不会把已有事件误当作权威完成事实，也不会通过自动修复掩盖本次发现的问题。

下一工作包 WP7：执行最终自动化回归、正式浏览器健康轮次、刷新恢复和内部报告闭环验收。

## 四、2026-08-14 报告范围分层补充验收

为避免 WP3—WP5 上线前的真实历史缺口永久污染新采集链健康状态，完整性报告 Schema 升级为 `learning_collection_integrity_report_v2`，新增：

- 默认 `current_collection` 与只读 `all_history` 两种范围；
- 固定采集代际 `real_learning_collection_v1`；
- 以 Checkpoint `createdAt >= 2026-08-13T14:03:24.000Z` 判定当前代际；
- 纳入 Round、当前代际 Round 与旧历史 Round 三项范围计数；
- 当前范围无 Round 时的 `AWAITING DATA` 页面状态。

范围只过滤报告输入，不改写 Checkpoint、Persistence、Event 或 Projection。旧历史继续在 `all_history` 中保留原有 FAIL；`current_collection` 独立判断新链健康度。

补充 Debug 结果：`23 / 23 PASS`。新增覆盖：

1. 旧历史 FAIL 与当前健康 Round 并存时，当前范围为 PASS；
2. 全部历史范围继续显示旧 FAIL；
3. 当前范围为空时纳入 Round 为 0；
4. 当前 Round 五事件和 Projection 全部缺失时仍归入当前范围并正确 FAIL；
5. 当前/历史范围计数和代际标识稳定。

生产构建通过；内部页面实测默认当前范围、全部历史切换、空状态和刷新均正常，无页面控制台错误。

## 五、2026-08-14 逐提交 Attempt 审计补充验收

完整性审计已从“每个 Round 最终 Checkpoint Response”升级为“每个不同 `answer_submitted.payload.attemptId`”。当前公式为：

```text
submittedAttempts
= eligibleCalibrationAttempts
+ excludedCalibrationAttempts
+ projectionFailedAttempts
```

实现结果：

- `submittedAttempts` 按不同提交意图计数；
- 每个 `answer_submitted` 必须存在唯一 Projection；
- Checkpoint 最终 Response 仍用于检查最终正式提交事件没有缺失；
- 同轮早期无效提交只与自己的 `attemptId -> responseId` 闭合，不再被错误要求等于最终 Response；
- Projection 没有对应提交事件时报告 `identity_mismatch`；
- 内部页面新增“投影失败”计数，并在 Round 详情显示各 Attempt 身份和状态。

补充 Debug 结果更新为 `28 / 28 PASS`。新增覆盖同轮无效后有效提交、早期 Projection 缺失、早期提交不能掩盖最终提交事件缺失、`projection_failed` 闭合计数和孤立 Projection。WP7 最终闭环回归继续 `12 / 12 PASS`，生产构建与浏览器页面复验通过，页面无控制台错误。
