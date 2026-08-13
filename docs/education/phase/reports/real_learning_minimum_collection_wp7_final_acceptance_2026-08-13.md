# 真实 Learning 最小采集 WP7 最终验收记录

日期：`2026-08-13`

状态：`WP7 PASS / WP0—WP7 COMPLETE`

范围：最小采集工程契约最终端到端收口，包括五事件、恢复、Projection、匿名 Attempt、完整性报告、刷新幂等、浏览器 IndexedDB 与全量回归。

## 一、最终闭环

固定健康轮次完整执行：

```text
question_presented
→ answer_submitted
→ diagnosis_completed
→ feedback_presented
→ learning_round_completed
→ eligible Projection
→ AnonymousQuestionCalibrationAttempt
→ Integrity PASS
```

验证结果：

- 五类事件各一条；
- 一个稳定 Attempt 对应一个 eligible Projection；
- required Rubric 3/4，`itemScore = 0.75`；
- 单轮 `totalScore` 缺省；
- 匿名 Attempt 不含原文或学习链身份；
- 刷新恢复后事件和 Projection 数量不变；
- Outbox 无遗留；
- 无效输入只产生 excluded Projection，不增加 eligible 样本。

## 二、自动化 Debug

### 2.1 WP7 专项

命令：`debug:learning-minimum-collection-wp7`

结果：`12 / 12 PASS`。

### 2.2 全量回归

| 检查 | 结果 |
| --- | --- |
| WP1 Schema / Identity | `13 / 13 PASS` |
| WP2 Repository | `19 / 19 PASS` |
| WP3 Runtime Collection | `9 / 9 PASS` |
| WP4 Recovery | `12 / 12 PASS` |
| WP5 Projection | `16 / 16 PASS` |
| WP6 Integrity | `18 / 18 PASS` |
| WP7 Final E2E | `12 / 12 PASS` |
| Question Calibration v2 | `6 / 6 PASS` |
| Phase 16.3 Real Chain | `16 / 16 PASS` |
| Phase 16.3 Day 0 | `15 / 15 PASS` |
| Product / Demo Isolation | `11 / 11 PASS` |
| Production Build | `PASS` |
| `git diff --check` | `PASS` |

## 三、浏览器 IndexedDB 验收

隔离验收页面：`learning-collection-wp7-final.html`

复验结果：`7 / 7 PASS`：

- `five_events_created`
- `eligible_projection_0_75`
- `integrity_pass`
- `refresh_idempotent`
- `five_events_one_projection`
- `outbox_empty`
- `technical_identity_and_answer_hidden`

首次运行发现验收页遗漏导入 Fixture 答案常量，属于测试脚本错误；已修复并复验通过。隔离数据库在验收结束后删除，没有污染正式数据。

## 四、正式历史数据说明

内部正式报告当前仍可能显示 WP3—WP5 上线前轮次的缺失 Issue。这些历史缺口不会被隔离健康验收覆盖，也不会被自动补造。工程结论应区分：

- 新链路能力：WP7 健康 Fixture 与浏览器隔离闭环均为 PASS；
- 既有历史事实：按实际缺失继续显示 FAIL；
- 后续真实 Learning：应自然形成五事件和 Projection，再通过内部页面观察真实报告变化。

这一区分符合“检查是系统能力，决策才是用户任务”和“技术落盘不能伪装成业务里程碑”的产品原则。

## 五、最终结论

真实 Learning 最小采集 `WP0—WP7` 已完成工程开发与 Debug 验收。产品已具备采集第一批真实学习数据、失败恢复、题目校准接续和内部完整性审计的工程基础。

下一阶段不再增加最小采集基础功能，应进入真实 Learning 运行：让真实使用者完成新轮次，观察事件完整率、eligible/excluded 比例、Rubric 得分分布、失败恢复情况及跨独立使用者样本量。
