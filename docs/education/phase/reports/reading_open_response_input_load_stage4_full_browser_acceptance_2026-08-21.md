# 阅读开放文本题输入负担阶段 4 全量真实浏览器联调验收

日期：`2026-08-21`
状态：`ENGINEERING COMPLETE / FULL BROWSER ACCEPTED / REAL CALIBRATION PENDING`

## 一、验收结论

`B4-01—B4-16` 已在真实应用内浏览器、正式前端构建和 `debug` 隔离运行范围中逐项通过。验收调用正式治理 Agent、版本解析、过程事实服务、版本级校准投影和完整性审计；结果只保存在当前标签页，不写入正式治理库、正式题目、学生作答或真实校准分母。

本次浏览器联调只证明工程闭环，不证明题目已经完成真实校准，也不证明教育效果。

## 二、运行入口与隔离边界

- 验收入口：`/internal/acceptance/reading-open-response-stage4`；
- 运行范围：`debug`；
- Provider：确定性 Candidate Gateway；
- Repository：隔离 In-memory Repository；
- 页面恢复：`sessionStorage` 只保存本标签页验收结果；
- 真实样本分母：`0`；
- 正式资源写入：`0`；
- 正式学生 Attempt 写入：`0`。

## 三、B4-01—B4-16 结果

| 编号 | 结果 | 浏览器证据 |
| --- | --- | --- |
| B4-01 | PASS | 当前治理列表只保留 1 条待治理题，retain 未进入活动批次。 |
| B4-02 | PASS | 卡片同时显示原题、问题摘要、完整后继题干和稳定治理身份。 |
| B4-03 | PASS | 候选决策只有“重新优化 / 采用并发布”，没有字段编辑或审核人入口。 |
| B4-04 | PASS | blocked 提供重新优化，stale 停止发布并指向重新审计。 |
| B4-05 | PASS | advisory 保留为说明，不增加二次确认，不阻断采用发布。 |
| B4-06 | PASS | 发布运行期间卡片只有 1 个“正在发布…”按钮，且为 disabled；“采用并发布”数量为 0。 |
| B4-07 | PASS | 发布完成原位显示 successor v2，同时保留 predecessor v1。 |
| B4-08 | PASS | 发布前已打开的 Session 继续消费冻结 v1。 |
| B4-09 | PASS | 新 Session 消费 v2，并保留 short_text、题干与思路提示。 |
| B4-10 | PASS | 刷新、恢复与重复提交后仍只有 1 个 Attempt 过程事实。 |
| B4-11 | PASS | 校准投影区分 awaiting_data / insufficient_sample / calibrated。 |
| B4-12 | PASS | debug 验收记录的有效真实样本分母保持 0。 |
| B4-13 | PASS | 版本身份冲突提示位于当前治理卡片，不要求滚动到页面顶部。 |
| B4-14 | PASS | 治理批次暂停后，已冻结正式 Session 继续消费 v1。 |
| B4-15 | PASS | 过程事实写入失败被隔离，不阻断 Learning 主动作，并留下完整性问题。 |
| B4-16 | PASS | 页面刷新后恢复 `16 / 16`；治理、暂停批次、校准三态和隔离边界保持一致。 |

## 四、额外浏览器证据

- 初始态正确显示“可以发布”，未执行时不再误报“已发布新版本”；
- 运行中发布按钮唯一且不可重复触发；
- 刷新后结果仍为 `16 / 16 全部通过`；
- 验收页控制台新增错误：`0`；
- `/internal/learning-collection` 能读取开放文本题治理与校准视图；
- `/learning` 可访问，无“暂时无法打开学习入口”；
- `/material-resource-workbench` 可访问，无 `RUNTIME_OPERATION_FAILED`。

## 五、联调中发现并修复的问题

首次打开验收页时，空报告的 `undefined === undefined` 被错误解释为已经完成，页面提前显示“已发布新版本”。现已改为必须存在报告且 `passed === total` 才进入完成态，并重新执行全量矩阵。

## 六、剩余边界

阶段 4 工程、Debug 和浏览器验收已经完成。尚未完成的是使用期真实校准：需要真实产品身份、真实作答、完整事件与过程事实，并按 Question Version 独立累计。当前继续保持：

```text
REAL CALIBRATION PENDING
EDUCATIONAL EFFECT NOT PROVEN
```
