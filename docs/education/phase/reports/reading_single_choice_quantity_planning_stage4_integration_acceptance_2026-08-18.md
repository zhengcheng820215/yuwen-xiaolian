# 单选数量与分布工程任务 4 联调验收

日期：`2026-08-18`

状态：`PASS`

## 1. 阶段目标

对工程任务 1–3 形成的数量规划、生成约束和目标不足治理执行全链收口，确认它们不会破坏既有 Candidate → Adopt → Revision → Publish → Learning 主链。

本阶段只做联调、回归、真实页面冒烟和必要的窄范围修复，不扩展新题型，不增加人工操作，也不改写真实已发布资源。

## 2. 统一回归入口

新增：

```text
npm run debug:single-choice-quantity-planning:stage4
```

该入口依次覆盖：

1. 单选数量与容量确定性规划；
2. 双单选生成、独立观察与软目标不足放行；
3. Learning 单选作答、Diagnosis、Evidence 与文本互补观察；
4. 两篇真实材料的 Candidate、发布、Frozen、Registry、Active Link 与 Learning E2E；
5. 补充计划采用和单题发布的状态隔离；
6. 生产端采用、重新生成与目标不足提示语义。

## 3. 自动化验收结果

| 验收项 | 结果 |
| --- | --- |
| 工程任务 4 统一回归 | `6 / 6 PASS` |
| 单选数量规划 | `18 / 18 PASS` |
| 单选生成与生产 | `23 / 23 PASS` |
| Learning / Diagnosis / Evidence | `20 / 20 PASS` |
| 真实材料发布与 Learning E2E | `10 / 10 PASS` |
| 工作台状态隔离 | `23 / 23 PASS` |
| Resource Coverage | `22 / 22 PASS` |
| Learning Persistence | `13 / 13 PASS` |
| 真实数据最小采集 WP3 | `9 / 9 PASS` |
| Question Empirical Calibration | `6 / 6 PASS` |
| Production Build | `PASS` |

真实材料 E2E 使用当前正式语料库的《狼》与《天上的街市》，在隔离内存仓库中执行，不修改产品数据。

## 4. 真实浏览器只读冒烟

### 4.1 录入工作台

- 页面：`#/material-resource-workbench`；
- 当前批次：`10` 篇材料、`37` 道题、全部已发布；
- 当前《秋天的怀念》：`5` 道任务，其中 `1` 道显示“单项选择”；
- 任务状态：待发布 `0`、已发布 `5`；
- 页面无横向溢出；
- 控制台错误 `0`。

当前正式材料是在新数量规划规则前完成发布，因此只含 `1` 道单选不构成回归。新规则不得回写 Frozen Resource；后续新规划、补充生成或明确的单题替代优化才应用 `2–3` 道推荐目标。

### 4.2 Learning

- 页面：`#/learning`；
- 已有学习状态能够恢复到“本次学习已经结束”；
- 页面无横向溢出；
- 控制台错误 `0`；
- 冒烟过程未开始新学习、未提交答案，也未创建真实 Attempt。

单选真实交互、草稿恢复、选项版本、提交幂等和反馈边界继续由阶段 3 / 原阶段 4 自动化与既有浏览器验收覆盖。

## 5. 最终结论

```text
Engineering Verification = PASS
Quantity Planning Integration = PASS
Candidate / Publication Integration = PASS
Learning Consumption Integration = PASS
Browser Smoke = PASS
Existing Formal Resource Integrity = PASS
```

工程任务 1–4 已完成。单选推荐数量能够进入后续新生成流程，同时质量门禁、正式资源不可覆盖、发布状态隔离和 Learning 消费边界保持成立。下一步应在真实使用中采集正确率、干扰项分布、作答时间和文本互补表现，不需要继续增加生产端操作。
