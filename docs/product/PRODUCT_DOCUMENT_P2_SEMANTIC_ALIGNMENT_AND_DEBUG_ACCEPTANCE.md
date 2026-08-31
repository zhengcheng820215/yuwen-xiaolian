# P2 产品文档语义对齐与 Debug 验收记录

英文名称：Product Documentation P2 Semantic Alignment and Debug Acceptance

文档类型：`ACCEPTANCE_REPORT`

状态：`ENGINEERING COMPLETE / DOCUMENT ACCEPTED / ZERO PRODUCT DATA WRITE`

日期：2026-08-31

## 一、范围

P2 只治理 ACTIVE 权威文档中的对象、主链、状态与历史基线表达，不修改 Runtime、正式资源、Learning 数据或 Trial Binding。

## 二、发现与处理

| Finding | 风险 | 处理 |
| --- | --- | --- |
| 主链存在概念简写与完整领域链两种写法 | 容易误解为可跳过正式化阶段 | 冻结简写和完整链的适用边界 |
| TrainingTaskCandidate 与 QuestionCandidate 都被简称“候选” | 采用命令、Revision 和发布责任混淆 | 冻结对象所有权和各自用户操作 |
| `ResourceReviewDecision` 容易被解释为第二次人工审核 | 增加不必要的人为步骤 | 明确它是同次采用的内部审计记录 |
| `Revision` 同时指生产版本和学生修订 | Evidence 与首次独立表现可能被覆盖 | 强制使用 PlanRevision、QuestionRevision、RevisedResponse |
| ACTIVE 契约保留 34、46、81 道等不同“当前”题量 | 形成互相冲突的当前事实 | 改为带日期的历史基线，当前数量统一回到 Current Product State |
| UX 权威文档保留旧 Engineering Pending | 当前规范与后续实现证据冲突 | 改为历史决策说明，不再声明即时工程状态 |

## 三、验收边界

- 语义权威表中每个概念只有一个 authority；
- authority 与 supporting document 都在 P1 清单中；
- authority 必须是 ACTIVE `CURRENT_CONTROL` 或 `NORMATIVE_CONTRACT`；
- 所有 required token 必须存在于权威正文；
- ACTIVE 规范中的历史数量不得伪装成当前硬编码门槛；
- P1 治理审计与 P2 语义审计必须同时 PASS。

## 四、Debug 验收结果

执行结果：

- P1 文档治理审计：`PASS`，`106 / 106` 份 Markdown 均有唯一清单记录；
- P2 语义审计：`PASS`，`11` 个核心概念均有唯一 authority；
- 完整主链对象检查：`18 / 18 PASS`；
- ACTIVE 权威文档扫描：`39` 份；
- 历史数量当前化禁用检查：`PASS`；
- 相对链接检查：`PASS`；
- 产品运行代码、Formal Store、Registry、Learning 与 Trial 数据写入：`0`。

## 五、结论

P2 对齐完成后，产品继续保留原有 Material → Plan → Task → Candidate → Publish → Learning 架构。新增的是统一解释和自动防漂移能力，不是新的产品功能或运行步骤。
