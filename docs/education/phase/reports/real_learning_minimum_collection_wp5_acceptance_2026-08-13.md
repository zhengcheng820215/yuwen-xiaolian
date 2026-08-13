# 真实 Learning 最小采集 WP5 工程验收记录

日期：`2026-08-13`

状态：`WP5 PASS`

范围：真实作答校准 Projection、资格判定、开放题评分、匿名 Attempt 输出与正式 Learning 接入；不包含 WP6 完整性报告。

## 一、实现结果

### 1.1 Projection Service

新增 `QuestionCalibrationProjectionService`，按工程契约固定顺序生成一条投影审计记录：

1. 非 Product：`excluded_non_product_scope`；
2. Response 非 valid：`excluded_invalid_response`；
3. Round 未正式完成：`excluded_incomplete_round`；
4. Formal Diagnosis 未 committed：`excluded_missing_formal_diagnosis`；
5. 无 required Rubric：`excluded_unscorable`；
6. 身份或版本错绑：`projection_failed`；
7. 全部满足：`eligible`。

Repository 故障被转换为失败结果，不阻断学生学习流程。

### 1.2 itemScore 与匿名输出

评分策略固定为 `rubric_required_equal_weight_v1`：

```text
itemScore = matched required Rubric Items / required Rubric Items
```

optional Rubric 不进入分母。不得用答案长度、`scoreBand`、`correct` 或 Diagnosis confidence 替代 Rubric 得分。

单学生单轮固定：

- `totalScore = undefined`
- `totalScoreStatus = unavailable_single_round`
- `assessmentWindowId = undefined`

只有 `eligible` Projection 输出 `AnonymousQuestionCalibrationAttempt`。匿名输出不含 student、operation、session、round、response、diagnosis 或原始答案，`subjectKey` 由固定 Product Student 确定性映射，同一学生的多次作答不会伪装为多个独立使用者。

### 1.3 状态与幂等

- 每个 `attemptId` 只有一个稳定 `projectionId`；
- 完全相同输入重复执行返回 `unchanged`；
- 权威事实从未完成逐步补齐时，允许排除状态受控升级为更强状态直至 `eligible`；
- 升级记录保留 `resolved_previous_status:*` 历史 Issue；
- 已 `eligible` 不被较弱状态覆盖；
- 同为 eligible 但评分或业务内容变化仍返回 `conflict`，不静默覆盖。

### 1.4 正式 Learning 接入

- 无效提交形成对应 excluded Projection；
- 主链返回后按真实 Checkpoint、Formal Diagnosis 与 Persistence 投影；
- 页面恢复通过权威对象重复投影，保持幂等；
- 资源版本直接绑定实际消费的 `resourceVersionId`，不同题目版本不合并。

## 二、Debug 与验收

### 2.1 WP5 专项 Debug

命令：`debug:learning-minimum-collection-wp5`

结果：`16 / 16 PASS`。

覆盖 required Rubric 3/4 得 0.75、无 totalScore、匿名输出、幂等、五类排除/失败边界、受控升级、eligible 终态保护、Repository 故障不阻塞和资源版本隔离。

### 2.2 浏览器 IndexedDB 验收

隔离数据库页面：`learning-collection-wp5-smoke.html`

结果：`6 / 6 PASS`：

- `excluded_projection_created`
- `projection_upgraded_to_eligible`
- `required_rubric_score_0_75`
- `single_round_total_unavailable`
- `anonymous_attempt_exported`
- `repeat_projection_idempotent`

第一次浏览器验收发现升级后保留的历史 Issue 会干扰重复投影比较；已修复为仅在幂等比较时忽略受控历史 Issue，评分等业务字段变化仍保持冲突。复验通过。隔离数据库在测试结束后删除，不污染正式 Learning 数据。

### 2.3 回归

| 检查 | 结果 |
| --- | --- |
| WP1 Schema / Identity | `13 / 13 PASS` |
| WP2 Repository | `19 / 19 PASS` |
| WP3 Runtime Collection | `9 / 9 PASS` |
| WP4 Recovery | `12 / 12 PASS` |
| WP5 Projection | `16 / 16 PASS` |
| Question Empirical Calibration v2 | `6 / 6 PASS` |
| 浏览器 IndexedDB Projection | `6 / 6 PASS` |
| Production Build | `PASS` |

Build 仍有既有动态导入和大 Chunk Warning，不是 WP5 新失败。

## 三、验收结论

WP5 已达到工程 `PASS`。正式作答现在可以形成可审计的校准 Projection；只有 Product、有效回答、正式完成、正式诊断且 Rubric 可评分的数据进入 eligible 样本。系统能够诚实生成单轮 `itemScore`，不会伪造总分、独立使用者或区分度。

下一工作包是 WP6：实现集合完整性公式、Issue Code、只读内部报告及故障注入审计。
