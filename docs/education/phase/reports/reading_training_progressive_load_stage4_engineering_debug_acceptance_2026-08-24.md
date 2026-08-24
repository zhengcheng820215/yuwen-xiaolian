# 阅读训练递进负担阶段 4 工程与 Debug 验收报告

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION NOT STARTED`

日期：2026-08-24

## 1. 验收范围

本次完成历史高风险正式题的 successor 治理、真实 Learning 校准事件旁路、Outbox 恢复、完整性审计、版本级投影、内部只读观察和隔离浏览器验收入口。工程不重建 `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 主链，不原地修改 Frozen Resource，不增加人工审核步骤。

## 2. 关键实现

- `src/ai/schemas/progressiveLoadStage4.schema.ts`：Governance Context、Calibration Event、Outbox、Threshold Policy、Projection 与 Guard。
- `src/ai/repositories/*ProgressiveLoadStage4Repository.ts`：内存与 IndexedDB v2 持久化。
- `src/ai/services/progressiveLoadGovernanceService.ts`：高风险、小批次、只建立旁路上下文并链接既有治理 Case。
- `src/ai/services/progressiveLoadCalibrationService.ts`：事件幂等、失败隔离、Outbox 重放、完整性审计、版本级投影和人工确认 calibrated。
- `src/api/phase163LiveLearning.ts`：既有 Observation 成功后派生校准事实；区分有效首答与无效提交，记录提示、修订、完成和进入下一题；同一道题所有事件保持同一 responseFormat。
- `src/api/progressiveLoadStage4Review.ts` 与 `src/pages/ProgressiveLoadStage4Review.jsx`：内部事实与限制投射。
- `src/api/readingTrainingProgressionStage4BrowserAcceptance.ts` 与对应页面：B4-01—B4-16 隔离运行时。

## 3. 自动化结果

| 命令 / 范围 | 结果 |
| --- | --- |
| `npm run debug:reading-training-progression-stage4` | `64 / 64 PASS` |
| B4-01—B4-16 隔离运行时 | `16 / 16 PASS` |
| 阶段 0 | `24 / 24 PASS` |
| 阶段 1 | `40 / 40 PASS` |
| 阶段 2 | `48 / 48 PASS` |
| 阶段 3 | `59 / 59 PASS` |
| Learning Session Queue | `21 / 21 PASS` |
| Phase 16.3 Real Learning Chain | `17 / 17 PASS` |
| 开放文本负担阶段 4 | `56 / 56 PASS` |
| 单项选择阶段 4 | `13 / 13 PASS` |
| Targeted Micro-training 阶段 4 | `51 / 51 PASS` |
| `npm run build` | PASS |

构建仅保留既有大 Chunk 和同模块静态 / 动态导入提示，没有新增编译错误。

## 4. 数据与失败边界

- 校准事件不保存学生完整答案、材料正文、反馈正文或诊断正文。
- Fixture、Demo、Debug、Internal Acceptance 与 isolated source 不进入真实分母。
- 校准仓库失败不回滚正式 Answer、Diagnosis、Feedback、Revision、Persistence 或下一题。
- Revision、Targeted、Retest 和 Transfer 使用不同 Support Mode，不覆盖首次独立表现。
- Question Version、Plan Hash、Load Semantics Hash、Observation Thread、Sequence Rank、Support Mode 与 responseFormat 共同限定投影语境。
- 当前 `30` 份只是 `progressive_load_calibration_trial_policy_v1` 的复核门槛；达到门槛仅进入 `review_ready`。

## 5. 浏览器签署与尚未完成边界

`B4-01—B4-16` 已于 2026-08-24 在真实应用内浏览器中完成 `16 / 16 PASS` 人工签署；记录见[阶段 4 全量真实浏览器联调验收](./reading_training_progressive_load_stage4_full_browser_acceptance_2026-08-24.md)。隔离验收产生的正式资源、Student Attempt、Student Profile 与真实校准分母写入均为 `0`。

本报告不宣称：

- `PILOT DATA SUFFICIENT`；
- `REAL CALIBRATION COMPLETE`；
- `EDUCATIONAL EFFECT PROVEN`。

下一步是进入小批次真实使用和样本完整性观察。隔离验收数据不得转入真实分母。
