# AI 题目优化阶段4采用发布报告

状态：`PUBLICATION_COMPLETED`

执行日期：`2026-08-13`

执行前基线：Shared Store revision `772`，摘要 `fnv1a-d2d931c1`

执行后基线：Shared Store revision `915`，摘要 `fnv1a-51fc9fbd`

## 一、执行范围与结果

阶段4从阶段3形成的 `10` 个合格候选中逐题选择一个完整方案，并通过工作台唯一人工操作“采用并发布”完成后继版本发布。没有修改材料正文，没有原位覆盖既有 Frozen Version，也没有增加审核人、审核意见或第二次确认。

| 材料 | 采用方案 | 新正式版本 | 发布结果 |
| --- | --- | --- | --- |
| 《皇帝的新装》 | AI 方案2：聚焦两类人物心理、骗子利用方式与骗局持续的因果关系 | `question-observation-task-plan-z8hqcb:v4` | v4 已活动，v3 已转为历史版本 |
| 《秋天的怀念》 | AI 方案2：明确菊花象征对象、主题关系与跨段证据 | `resource-observation-task-plan-1nincnp:v4` | v4 已活动，v3 已转为历史版本 |
| 《散步》 | AI 方案1：比较“家庭 / 生命传承”解释并结合全文论证 | `resource-observation-task-plan-g8v18a:v4` | v4 已活动，v3 已转为历史版本 |
| 《狼》 | AI 方案3：从屠户与狼两个角度概括主旨并引用依据 | `question-observation-task-plan-1dkgzj1:v4` | v4 已活动，v3 已转为历史版本；主能力更新为分析 |

四次采用均属于同一个用户决定。底层依次保留 Adoption、Validation、Assessment、Publication 等阶段结果用于幂等、诊断和断点恢复，但没有把它们投射为额外人工步骤。

## 二、阶段4发现并修复的问题

### 2.1 新 Draft 被旧发布状态遮蔽

当任务已有旧正式版本、同时又存在待发布的新 Draft 时，页面曾直接投影为“已发布”，导致用户看不到继续发布入口。现仅当活动正式版本的 `sourceDraftId` 与当前 Draft 一致时才显示当前方案已发布。

### 2.2 继续发布没有真正执行命令

`open_confirmation` 曾只展开旧确认区域而不继续工作流。现“继续发布”直接恢复同一次采用命令，自动运行剩余阶段，不再制造第二次人工确认。

### 2.3 候选与任务计划身份不一致

候选允许重新计算能力、难度和作答格式，但原任务计划没有同步，发布前校验可能发生身份不一致。现采用时先自动生成并确认与候选一致的后继 Plan Revision，再继续冻结和发布。

### 2.4 合法后继版本被误判为 Registry 冲突

原子发布曾把 v3 → v4 的正常 Registry Head 推进识别为 `identity_content_conflict`。现只允许“当前 Head 正好是新版本声明的 previousVersionId”这一种受控推进，其余覆盖冲突仍然阻断。

### 2.5 未改动兄弟任务的 Observation Link 断开

新 Plan Revision 会为同组任务生成后继任务身份，未改动的兄弟任务一度无法继承旧 Frozen Version，审计短暂降至 `26 / 34`。现同步逻辑会依据 `parentObservationTaskPlanId` 和 `taskRevisionRootId` 继承正式版本并重建活动关联；完成一次真实数据修复后恢复为 `34 / 34`。

### 2.6 技术错误反馈使用了包装错误

发布失败信息曾显示外层通用错误。现优先读取 `originalError`，让技术中断能够显示可执行的继续发布提示，同时仍把内容不合格导向重新生成。

## 三、最终一致性结果

阶段4完成后的只读审计结果：

- 活动材料：`10`；
- 当前 Observation Plan：`10`；
- 当前训练任务：`34`；
- Active Observation Link：`34`；
- Active Registry：`34`；
- 当前 Formal Version：`34`；
- Frozen Quality Trace：`34`；
- Learning 可消费题目：`34`；
- 一致性问题：`0`。

正式题总数没有因四道题升级而增加；旧版本保留审计历史，新 Learning Session 读取 v4，已启动 Session 继续绑定其原 Frozen Version。

## 四、验证记录

- 工作台状态回归：`20 / 20`；
- Learning 入口集成：`14 / 14`；
- 统一资源生产 P0–P7：`26 / 26`；
- 题目质量持久化：`25 / 25`；
- 当前资源只读基线审计：通过；
- 生产构建：通过。

## 五、后续阶段

阶段4至此结束。后续不再继续人工改题，而是等待真实 Learning 作答样本。校准数据必须绑定具体 `resourceVersionId`，在未达到当前版本化试运行阈值前只报告样本不足，不自动回滚、不自动改题；如发现稳定问题，重新进入“生成完整候选 → 采用并发布 / 重新生成题目”的标准路径。
