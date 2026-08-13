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
