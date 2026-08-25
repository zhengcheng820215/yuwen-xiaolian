# 产品复杂度收口阶段 4 真实 Trial 启动前工程、Debug 与浏览器验收报告

日期：2026-08-25

工程基线 Commit：`119a019`

构建版本：`product-complexity-convergence-preflight-build-v1`

结论：`PREFLIGHT ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / OBSERVATION MODE OFF / OPERATIONAL SIGNATURE PENDING / REAL TRIAL NOT STARTED`

后续状态：本报告记录的是启动前验收时点。2026-08-25 已完成独立操作签署与真实浏览器激活，当前状态见：[真实 Trial 激活签署与执行记录](./product_complexity_convergence_real_trial_activation_signoff_2026-08-25.md)。

## 1. 本次完成范围

1. 完成八项正式 Owner Fact Adapter 与不可变 Source Registry；
2. 完成 Revision、Targeted Micro-training、Retest、Transfer 与 Feedback Projection 正式提交后的非阻断观察接线；
3. 其余正式 Owner 通过同一版本化 Adapter 入口接入，未知 Schema、身份错位或非法 Outcome 一律排除；
4. 完成 `off / isolated_acceptance / real_trial` Activation Controller；
5. 完成 Trial Window、Preflight Report、Launch Record 与 Append-only Activation Audit Schema；
6. 完成 IndexedDB 增量 Store，未重写旧 Window、Event、Snapshot 或 Proposal；
7. 完成内部只读预检页和独立浏览器验收页；
8. 普通 Learning 与录入工作台没有真实 Trial 激活入口，也不能通过 Query 参数激活；
9. Owner Adapter 或 Observation Repository 故障始终 fail-open，不阻断 Learning；
10. 观察事实不包含学生答案、修订正文、题目正文、材料正文或模型自由文本。

## 2. 自动化 Debug

| 验收范围 | 结果 |
| --- | --- |
| 启动前工程 `PF-C01—PF-C56` | `56 / 56 PASS` |
| 浏览器矩阵 `PF-B01—PF-B20` | `20 / 20 PASS` |
| 阶段 0 | `24 / 24 PASS` |
| 阶段 1 | `28 / 28 PASS` |
| 阶段 2 | `40 / 40 PASS` |
| 阶段 3 | `48 / 48 PASS` |
| 阶段 4 | `64 / 64 PASS` |
| Unified Learning Entry | `27 / 27 PASS` |
| Phase 16.3 Day 0 Integration | `15 / 15 PASS` |
| Production Build | `PASS` |

Production Build 保留既有 Chunk Size 与混合静态/动态导入提示，没有新增构建错误。

## 3. 真实浏览器验收

内部路由：

- `#/internal/product-complexity-convergence-stage4-preflight`
- `#/internal/acceptance/product-complexity-convergence-stage4-real-trial-preflight`

真实浏览器检查结果：

- `PF-B01—PF-B20`：`20 / 20 PASS`；
- 内部预检页显示 requested / effective mode 均为 `off`；
- Source Registry 显示八项能力；
- 页面不提供激活按钮；
- 普通 Learning 与普通 Workbench 无真实 Trial 文案或入口；
- 控制台错误与警告：`0`；
- 页面与控制台未出现学生答案、材料正文或题目正文泄漏。

## 4. 写入与隔离结果

| 写入类型 | 数量 |
| --- | ---: |
| 正式资源写入 | 0 |
| Student Attempt 写入 | 0 |
| Evidence 写入 | 0 |
| Student Profile 写入 | 0 |
| 真实校准 / Trial 分母写入 | 0 |

隔离烟测形成 1 条 `internal_acceptance` 来源事件，真实分母写入为 0；烟测结束后模式恢复 `off`。

## 5. RTW-S01—RTW-S18 边界

`RTW-S01—RTW-S18` 的 Schema、门禁、恢复、隐私与自动化证据已在隔离环境中通过。生产操作签署仍未执行，原因是以下事实必须在启动时显式冻结，不能由工程脚本代填：

- 真实参与学生身份；
- 14—28 日正式起止时间；
- 当前 Git Commit、构建版本、Registry Hash 与 Policy Hash；
- 无未解决 P0 / P1 的人工确认；
- 不可变 Preflight Report；
- `approved_to_activate` Launch Record。

因此当前允许进入“启动前人工签署”，但不等于已经批准或启动真实 Trial。

## 6. 最终结论

工程开发已经完成，旧主链零回归，新语义只在预检控制面与正式 Owner 结果后的非阻断观察边界内生效。当前 requested / effective mode 均保持 `off`，真实 Trial 未启动。

下一任务是独立的启动签署与显式激活操作，不是继续扩展功能：

```text
冻结参与者与时间窗
→ 复核 RTW-S01—RTW-S18
→ 保存不可变 Preflight Report
→ 保存 approved_to_activate Launch Record
→ 显式激活 real_trial
→ 验证第一条真实事实
```

任何一步不满足都必须保持 `off`，且不得阻断 Learning。
