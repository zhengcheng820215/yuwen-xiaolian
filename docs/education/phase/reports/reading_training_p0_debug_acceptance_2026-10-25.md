# 阅读训练 P0 工程与 Debug 验收

日期：2026-10-25。

结论：本轮 P0 工程改动及定向回归通过；不代表真实 AI 校准或真实学生训练效果已经通过。未提交或推送 Git。

## 变更范围

1. 普通阅读配置字数改为建议，允许有意义的短结论和局部原文依据进入正式诊断。题干明确写出的数字最低字数仍由页面和领域层保护；空白、占位、符号、整题或整段材料照抄的闸门保留。不修改历史 Frozen Resource。
2. 现有 v3/v4 诊断 Prompt 共同增加 `reading_response_calibration_p0_v1` 补充约束，区分对象或范围错位、缺依据、缺解释、必要要点遗漏，要求使用输入中的 Rubric ID 返回逐项结果。新运行记录以 `promptCalibrationVersion` 标识补充版本，历史 Commit 的复用不冒充新 Prompt 已运行。
3. 反馈只提供一个主要动作；不把语气、标点、结构等题型统一套为人物心理。原话必须能在实际回答中找到；题干结论词的重复不自动当作独立判断。
4. 修订 Offer/Evaluation 升至策略 v3，绑定主要要求与评分项，不再按缺项减少数量切片推断目标已解决。相同答案、仅改标点、凑字数、无关项改善均不得伪报原目标改善。页面使用同一评价的观察和下一步动作。
5. Initial Response 保持冻结。修订仍为一次反馈支持下的独立记录，只追加支持性证据，不提升长期能力状态。Retest/Transfer 仍不开放即时修订。
6. `shadow` 默认值、试验激活门禁、正式发布及学习数据边界未改动；本轮未激活真实学生 Trial，也未向真实学生记录写入测试答案。

## 自动化验收

- 新增 `npm run debug:reading-training-p0`：38/38，通过短答案有效性、四类缺口的隔离反馈投射、原话核验、聚焦目标绑定、标点与字数假改善、初答不变与支持性证据边界测试。
- Controlled Feedback：66/66，包含新增的说话者/范围错位和题干结论重复用例。
- Revision Stage 1–4：26/26、29/29、18/18、19/19。
- Rubric Aligned Feedback Stage 1–4：30/30、30/30、36/36、24/24。
- Reading Open Response Input Load Stage 1–4：28/28、40/40、50/50、56/56。
- 提交超时恢复：9/9；Thinking Analysis：5/5；Action Plan：8/8；Grounding：6/6；Narrative：33/33；Revision Presentation：10/10；Prompt v4：15/15。
- Task Execution、Task Evidence Return、Student Learning Feedback、Real LLM Runtime Foundation、Phase163 主链、Wrong Answer Feedback Action Contract Stage2、Wave A 亦通过。
- 合计 28 个选定套件通过。诊断主链使用 scripted provider/隔离仓库，不是 DeepSeek Live 调用。
- `vite build` 通过；仍有既有大包及动态/静态混合导入警告。`git diff --check` 通过。

## 浏览器验收

本地入口：`http://127.0.0.1:5174/learning-feedback-revision-stage2.html`。

使用已有隔离验收页和实际 `FeedbackGuidedRevision` 组件：

- 进入一次修订，首次回答保留。
- 输入“父亲不舍”（4 字），显示“建议 20 字左右，以题目要求为准”。
- 提交按钮可用，点击后进入 `revision_submitted`，首次回答未被覆盖，`revisionCount=1`。
- 页面无明显遮挡；浏览器截图保留在本地 `tmp/reading-p0-short-revision.png`，不包含真实学生答卷。

该浏览器用例验证组件与修订提交交互；实际目标是否改善由上述独立评价测试核验，不将隔离页的提交状态当作真实 AI 已完成评价。

## 未完成的外部验收

- 额外尝试 `runWrongAnswerFeedbackStage3WaveBAcceptance.ts`，在基线断言 `before.revision >= 1965` 处失败。当前本地数据不满足该历史批次前提，本轮没有为通过测试修改正式库，也没有计入通过套件。
- 尚未进行真实 AI 多轮盲测与真实学生后续独立复测。后续应以四类匿名改编样本对照教师判断，观察主要缺口、反馈可执行性、一次修订效果和无提示迁移。
- 真实反馈 Trial 是否可激活，仍需当前 Runtime、正式资源版本、学生和时间范围的 Preflight；不能从本轮隔离验收推断已对真实学生启用。

## 关联规范

- [训练模型](../../TRAINING_MODEL.md)
- [提交后恢复契约](../phase16_3_submission_recovery_contract.md)
- [Rubric 对齐反馈计划](../../../product/RUBRIC_ALIGNED_STUDENT_FEEDBACK_OPTIMIZATION_PLAN.md)
- [反馈后修订契约](../../../product/LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)
