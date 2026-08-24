# 阅读开放文本题输入负担阶段 4 工程与 Debug 验收报告

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / FORMAL GOVERNANCE CLOSURE APPLIED / REAL CALIBRATION PENDING`

验收日期：`2026-08-21`

基线 Git：`a7dad87`（验收时工作树含阶段 1—4 未提交实施变更）

## 一、实施结果

已实现：

- `ExistingQuestionGovernanceCase` Schema、Guard、IndexedDB/In-memory Repository；
- 治理 Case 幂等创建、stale 判定、优先级与最多 5 道批次；
- Finding 到生成约束的转译，以及后继 Candidate 的受控生成；
- adoption / publication / predecessor / successor 身份检查与可恢复状态；
- 正式 Learning 中的展示、首次输入、提示打开、提交、完成与修订过程事实；
- 过程事实采集失败不阻断 Learning 主链；
- 按 `resourceVersionId` 分离的版本级校准投影、样本资格、去重、时间中位数和完整性审计；
- 内部“学习采集完整性”页的开放文本题治理与校准视图；
- 工程状态、样本状态和教育效果结论三者分离。

## 二、自动化验收

| 验收项 | 结果 |
| --- | ---: |
| 阶段 1 输入负担审计 | `28 / 28 PASS` |
| 阶段 2 Planner / Prompt / 长度策略 | `40 / 40 PASS` |
| 阶段 3 质量门禁与顺序 | `48 / 48 PASS` |
| 阶段 4 治理与真实校准 | `56 / 56 PASS` |
| Candidate Workflow | `12 / 12 PASS` |
| Candidate Workbench P4 | `16 / 16 PASS` |
| Workbench Command E2E | `7 / 7 PASS` |
| 单项选择 Stage 4 | `13 / 13 PASS` |
| Targeted Micro-training Stage 4 | `51 / 51 PASS` |
| Feedback Revision Stage 4 | `19 / 19 PASS` |
| Learning Session Task Queue | `21 / 21 PASS` |
| Learning Session History | `PASS` |
| Task Publication Orchestration | `PASS` |

## 三、生产构建

使用 Codex 工作区内置 Node.js `24.19.0` 执行 Vite 生产构建，退出码为 `0`。

仅保留两类既有非阻断警告：

- `phase163RealLearningChainDemo.ts` 同时静态/动态引入；
- 主 bundle 大于 `500 kB`。

系统默认 Node.js `18.20.5` 不支持当前 Rolldown 使用的 `node:util.styleText`，因此本次验收显式使用工作区内置新版 Node.js；该环境问题不是阶段 4 业务回归。

## 四、真实浏览器验收

已对本地运行产品执行不写入主产品的全量隔离验收：

1. `/internal/learning-collection`：阶段 4 视图可见，能区分工程、样本与教育结论；
2. `/learning`：学习入口可恢复，无“暂时无法打开”；
3. `/material-resource-workbench`：工作台可读取，无 `RUNTIME_OPERATION_FAILED`。

另在 `/internal/acceptance/reading-open-response-stage4` 中使用正式治理 Agent、版本解析、过程事实服务与校准投影执行 `B4-01—B4-16`，得到 `16 / 16 PASS`。运行中验证了唯一发布按钮、刷新恢复、卡片内错误、版本冻结和隔离分母；没有提交真实学生作答、创建正式 Candidate 或发布正式版本。

## 五、真实数据边界

当前历史 Projection 中存在本阶段过程事实上线前的记录。内部页会将“有校准 Projection 但缺少过程事实”显示为完整性问题，不会伪装为已完整采集。

工程验收不等于真实校准完成。当前仍为：

```text
REAL CALIBRATION PENDING
EDUCATIONAL EFFECT NOT PROVEN
```

## 六、后续验收门

阶段 4 工程与全量浏览器验收门已经关闭。下一步只启动真实 Learning 观察，并继续保持版本隔离、样本资格检查和 `REAL CALIBRATION PENDING`；浏览器通过不得替代真实使用数据。

## 七、正式题治理收口

2026-08-21 已完成正式题治理收口：正式题审计与 Learning 实际调度顺序已统一，12 个核心题组的阅读入口缺失和无理由负担跳跃均已清零；仅对《春》和《女娲造人》各发布一个后继正式版本，既有 Frozen Version 与已打开 Session 均保持不变。

详细记录见：[阅读开放文本题正式题治理收口报告](./reading_open_response_formal_question_governance_closure_2026-08-21.md)。
