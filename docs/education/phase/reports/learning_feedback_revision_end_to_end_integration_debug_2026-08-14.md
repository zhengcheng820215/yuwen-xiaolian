# Learning 反馈后修订端到端联调 Debug 验收

日期：`2026-08-14`

结论：`PASS`

## 一、联调范围

本次使用隔离 IndexedDB 和正式 Product 身份规则，跨层串联：

```text
LearningTaskAttempt Repository
→ Revision Persistence
→ Revision Evaluation
→ Learning Observation / Outbox
→ Integrity Audit
→ Controlled Metrics
→ Initial Calibration Projection Isolation
```

另外通过浏览器验证学生端修订入口、草稿保存、刷新恢复和独立提交。所有联调数据都位于临时数据库，完成后删除，不污染当前学生记录。

## 二、业务场景结果

| 场景 | 结果 | 核心事实 |
| --- | --- | --- |
| 正常修订 | PASS | 三类事件各一条，重复记录全部 unchanged |
| 跳过修订 | PASS | Attempt 完成为 initial only，不生成 Revision 事件 |
| 评价失败 | PASS | Revised Response 保留，恢复后无需重答即完成 Evaluation |
| 事件写入失败 | PASS | 进入 Outbox，重试后恢复恰好一条事件 |
| 草稿恢复 | PASS | 保存后刷新，修订文本和首次回答均保持 |
| 独立提交 | PASS | Revised Response 单独保存，Initial Response 未被覆盖 |
| 校准隔离 | PASS | 4 个 Attempt、3 个 Revision，Projection 仍只有 1 条 Initial 记录 |

## 三、联调自动检查

第四阶段浏览器联调：`13 / 13 PASS`

- Event Schema 合法；
- 三类事件创建与幂等重试；
- Skip 不创建 Revision；
- Evaluation 失败保留提交结果；
- Evaluation 恢复不要求重新提交；
- Event 失败进入 Outbox 并成功补写；
- 组合完整性审计 PASS，Issue `0`；
- Offer / Start / Completion / Evaluation 分母与分子精确；
- Revision 未污染 Initial Calibration；
- 跳过和修订仍共享单一 Attempt 模型。

数据核对结果：

- Attempt：`4`；
- Revision：`3`；
- Revision Event：`7`；
- Initial Projection：`1`；
- Audit：`pass / 0 issues`；
- Offer Rate：`4/4`；
- Start Rate：`3/4`；
- Completion Rate：`2/3`；
- Evaluation Completion Rate：`2/2`。

## 四、关联回归

| 验收组 | 结果 |
| --- | --- |
| IndexedDB 升级、跨标签幂等与恢复 | `18 / 18 PASS` |
| Revision 阶段 1 | `26 / 26 PASS` |
| Revision 阶段 2 | `28 / 28 PASS` |
| Revision 阶段 3 | `15 / 15 PASS` |
| Revision 阶段 4 | `19 / 19 PASS` |
| Learning Collection WP7 | `12 / 12 PASS` |
| Production Build | `PASS` |
| 联调页、学生修订页、正式 Learning 入口 Console | `0 errors` |

Production Build 仍只有既有的非阻断提示：Demo 模块静态 / 动态引入重叠以及主 Chunk 大于 500 kB。

## 五、Debug 过程说明

初次联调暴露了两个验收脚本假失败：

1. 新建数据库首次升级时，测试脚本并发写三条事件，而正式 `reconcileRound` 为顺序写入；脚本已改为与正式路径一致。
2. 测试最初使用自定义 Student ID，Product Event Schema 正确返回 `invalid_product_student`；现在临时数据库内使用正式单学生身份验收完整 Product Schema。

两项均属于联调脚本与正式边界未对齐，不是产品主链缺陷；修正后全部复验 PASS。

## 六、结论

反馈后修订已通过正式使用前联调。当前没有阻断真实单学生试用的联调问题；下一步应进入真实使用并观察 Retest / Transfer，不继续增加修订次数或人工审核环节。
