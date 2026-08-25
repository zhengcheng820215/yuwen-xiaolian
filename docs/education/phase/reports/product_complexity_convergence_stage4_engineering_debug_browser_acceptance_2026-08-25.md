# 产品复杂度收口阶段 4 工程、Debug 与浏览器验收报告

日期：2026-08-25

对应契约：`product_complexity_convergence_stage4_stable_trial_retirement_v1`

结论：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL TRIAL READY / REAL TRIAL NOT STARTED`

## 1. 工程边界

本次只实现稳定试用观察、版本化聚合和内部能力决策提案，没有新增 Training Model、学习任务或调度状态机，也没有修改：

- `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 主链；
- Frozen Resource、Registry、Session Snapshot 与正式题组顺序；
- Attempt、Diagnosis、Evidence、Profile 与 Calibration 的正式写入者；
- Revision、Targeted、Retest、Transfer 的 Owner Decision；
- 普通录入端和 Learning 的用户交互。

真实观察模式默认 `off`。Internal Acceptance 使用隔离内存仓库，不能进入真实试用分母。

## 2. 已完成工程能力

1. 完成 Append-only Observation Event、Trial Window、Aggregate Snapshot 和 Decision Proposal Schema；
2. 完成八类既有能力事实的只读 Adapter；
3. 完成 `real_learning + product + identity aligned + source validated + active window + participant` 真实准入门禁；
4. 完成 Event / Snapshot / Proposal 稳定身份、冲突检测和终态保护；
5. 完成 14—28 日窗口创建、受控关闭和失效生命周期；
6. 完成分子、分母、零分母、样本充分性和完整性状态聚合；
7. 完成结构化 `expectedBenefitCode`、维护成本 Band 和内部决策提案；
8. 完成 Internal 只读观察页和隔离浏览器验收页；
9. Observation Repository 写入失败保持 fail-open，不阻断 Learning；
10. 默认关闭和退役只形成候选，不自动修改 Feature Flag、停止写入或删除能力。

## 3. 自动化 Debug

| 验收范围 | 结果 |
| --- | --- |
| 阶段 4 `C4-01—C4-64` | `64 / 64 PASS` |
| 阶段 0 | `24 / 24 PASS` |
| 阶段 1 | `28 / 28 PASS` |
| 阶段 2 | `40 / 40 PASS` |
| 阶段 3 | `48 / 48 PASS` |
| Learning Revision Stage 4 | `19 / 19 PASS` |
| Targeted Micro-training Stage 4 | `51 / 51 PASS` |
| Reading Progression Stage 4 | `64 / 64 PASS` |
| Learning Session Task Queue | `21 / 21 PASS` |
| 旧主链专项回归合计 | `295 / 295 PASS` |
| Production Build | `PASS` |

Production Build 保留既有 Chunk Size 与混合静态/动态导入提示，没有新增构建错误。

## 4. 真实浏览器联调

内部路由：`#/internal/acceptance/product-complexity-convergence-stage4`

真实浏览器实际点击执行 `B4-01—B4-20`，结果：

- `20 / 20 PASS`；
- 检查项 ID 从 `B4-01` 到 `B4-20` 连续完整；
- 页面控制台错误：`0`；
- 隔离事件：`8`；
- 正式资源写入：`0`；
- Student Attempt 写入：`0`；
- Evidence 写入：`0`；
- Student Profile 写入：`0`；
- 真实试用分母写入：`0`。

## 5. 结论边界

工程已经具备启动真实 Trial Window 的技术条件，但本报告不代表：

- 真实试用已经开始或完成；
- 某项复杂能力已经证明有效；
- 教育效果已经得到验证；
- 可以立即默认关闭或退役任何能力。

下一步只能在明确参与范围、Registry / Policy 快照和 14—28 日窗口后，显式启用 `real_trial` 并另行形成真实运行报告。样本不足时必须保持 `insufficient_evidence`，不得用本报告中的 Fixture 或浏览器数据替代真实证据。
