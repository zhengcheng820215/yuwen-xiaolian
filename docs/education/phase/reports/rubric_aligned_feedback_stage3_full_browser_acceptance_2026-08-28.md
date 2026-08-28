# Rubric 对齐反馈阶段 3 全量真实浏览器联调签署

**日期：** 2026-08-28  
**矩阵：** `B3-01—B3-16`  
**结论：** `FULL BROWSER ACCEPTED / 16 OF 16 PASS / ZERO FORMAL WRITE`  
**默认展示模式：** `shadow`（本次签署不授权自动切换为 `student_visible`）

## 1. 实测环境

- 真实页面：`http://localhost:5174/?b3accept=20260828#/internal/acceptance/rubric-aligned-feedback-stage3`
- 浏览器：Codex 应用内 Browser，干净标签页会话
- Runtime：本地产品 Runtime，端口 `5174`
- 正式资源 Revision：`1963 → 1963`
- 控制台：`0 error / 0 warning`
- 页面刷新：刷新后仍恢复 `16/16 全部通过`

验收 Fixture 只使用浏览器内存和专用 `sessionStorage`，不写入正式作答、Evidence、Profile、Revision 或真实校准分母。

## 2. B3-01—B3-16 签署结果

| 编号 | 场景 | 结果 | 实测结论 |
| --- | --- | --- | --- |
| B3-01 | 文本题完整达成 | PASS | 只呈现真实达成，不制造缺口或修改动作 |
| B3-02 | 有结论、缺依据 | PASS | 确认已有判断，只指出缺少材料依据 |
| B3-03 | 有依据、缺解释 | PASS | 选择 `rubric_projection`；只提示说明依据与判断关系 |
| B3-04 | 无有效肯定 | PASS | 不制造表扬区块 |
| B3-05 | 单选正确 | PASS | 保持单选独立反馈链 |
| B3-06 | 单选错误 | PASS | 显示对应误读与一个核对动作，不套用开放文本补全 |
| B3-07 | Revision 可用 | PASS | Primary Gap 与唯一修订动作同源 |
| B3-08 | 修订完成 | PASS | 说明具体改善，不宣称独立掌握 |
| B3-09 | 固定题组连续下一题 | PASS | 六题题号连续，末题才显示完成出口 |
| B3-10 | 刷新与恢复 | PASS | Response、来源、反馈与下一题状态可恢复 |
| B3-11 | Retest / Transfer | PASS | 只投射独立验证结果，不开放即时修订路径 |
| B3-12 | 新路径故障注入 | PASS | 身份错误时整包回退 Legacy，无字段混拼 |
| B3-13 | 三态模式切换 | PASS | `legacy / shadow / student_visible` 行为确定 |
| B3-14 | 历史资源 | PASS | 缺少新接入包时安全回退，不猜测 Gap |
| B3-15 | Runtime blocked / retry | PASS | 当前区域显示安全重试说明，不暴露内部错误码 |
| B3-16 | 连续 5—6 题完整 Session | PASS | 无反馈死循环、无提前返回入口、无内部术语 |

## 3. 联调期间发现并修复的问题

首次打开真实页面时发现 `rubricFeedbackProjectionAgent` 在浏览器路径直接引用 `node:crypto`，导致页面运行时空白。生产构建此前只给出兼容性警告，真实浏览器联调确认其为阻断级问题。

本次改为同步、确定、浏览器与 Node 共用的 24 字符运行时中立摘要实现；Projection Schema、同步接口和身份形状保持不变。修复后：

- 阶段 3 专项 Debug：`36/36 PASS`；
- production build：PASS；
- 干净浏览器会话：`16/16 PASS`；
- 控制台：`0 error / 0 warning`。

另修正隔离 Fixture 中 `evidence_without_relation` 与冻结枚举 `evidence_without_explanation` 的命名不一致；该修正只影响验收 Fixture，不改变正式数据。

## 4. 零写入签署

| 写入域 | 写入数 |
| --- | ---: |
| 正式资源 | 0 |
| Student Attempt | 0 |
| Evidence | 0 |
| Profile | 0 |
| Revision | 0 |
| 真实校准分母 | 0 |

正式 Revision 与摘要在每次矩阵执行前后保持一致。

## 5. 自动化回归

| 回归项 | 结果 |
| --- | --- |
| Rubric Stage 0 | 8/8 PASS |
| Rubric Stage 1 | 30/30 PASS |
| Rubric Stage 2 | 30/30 PASS |
| Rubric Stage 3 | 36/36 PASS |
| Student Feedback Grounding | 6/6 PASS |
| Student Feedback Action Plan | 8/8 PASS |
| Student Learning Narrative | 33/33 PASS |
| Learning Feedback Presentation | 10/10 PASS |
| Controlled Feedback Expression | 63/63 PASS |
| Revision Stage 1 / 2 / 3 / 4 | 26/26、29/29、18/18、19/19 PASS |
| Reading Single Choice Stage 4 E2E | 13/13 PASS |
| Formal Question Hint & Feedback Audit | PASS |
| Production Build | PASS |

## 6. 签署边界

本报告签署的是阶段 3 的工程与真实浏览器行为已经满足准入矩阵。默认模式继续保持 `shadow`；是否切换为 `student_visible`，仍需由后续 Trial 激活决策单独授权，不能由本次验收自动触发。

