# Phase 15.2：Real Diagnosis Validation 验收与冻结记录

状态：PASS / FROZEN
正式质量策略：`diagnosis_quality_policy_v2_1`
验收日期：2026-07-17

## 一、验收结论

Phase 15.2 已完成真实 DeepSeek Diagnosis 的版本化评估集验证、Prompt v4 回归、Root Cause 失败归因、Policy v2.1 校准、完整 Evaluator Dry Run、负责人确认和正式启用回归。

负责人已确认：

- 29 个 Root Cause 恢复项语义合理；
- Sample 06 的 3 个 Prompt 错误必须持续阻断；
- 61 个原 Root Cause 维度通过项无回退；
- `questionable` 必须进入复核，`unacceptable / critical_violation` 必须阻断，`unknown / conflicting` 不得自动通过。

## 二、正式验收结果

使用 Prompt v4 冻结 Shadow Candidate 和启用后的正式质量 Evaluator 重评：

- Candidate：93 / 93；
- 正式 Policy v2.1：93 / 93；
- Root Cause Accepted：90 / 93（96.8%）；
- 完整质量：accepted 79、questionable 6、unacceptable 8、critical 0；
- Sample 06 Prompt 错误继续阻断：3 / 3；
- 正式验收检查：15 / 15 PASS；
- Provider 调用：0；
- Evidence 创建：0；
- Profile 更新：0；
- Production Build：PASS。

正式报告：[Policy v2.1 Acceptance](./reports/phase15_2/phase15-diagnosis-quality-policy-v2-1-acceptance-2026-07-17T11-00-12-239Z.md)。

## 三、冻结能力

Phase 15.2 完成后，系统能够：

1. 使用冻结 Dataset 与人工边界重复验证真实 LLM Diagnosis；
2. 区分模型问题、Policy 问题和 Evaluator 误报；
3. 对合理异表述、简短有效答案和核心错误采用受控判断边界；
4. 使用 Policy v2.1 对 Root Cause 做来源无关、非样本特化的语义分类；
5. 保证 Root Cause 校准不会绕过 Answer Status、Required Facts、引用真实性或越权边界；
6. 只允许 `accepted` 进入正式候选，其余状态保持复核或阻断。

## 四、冻结边界

本阶段不证明：

- DeepSeek 已达到人工教师水平；
- Dataset v1 覆盖全部题型和真实学生表达；
- accepted 等于长期能力结论；
- Prompt v4 已经切换为所有正式 Provider 调用的默认 Prompt；
- 真实新答案可以跳过 Runtime Gate；
- Controlled Student Feedback 已完成。

旧 Policy v2 仍保留显式复现入口，用于历史报告回归；正式质量 Evaluator 默认使用 Policy v2.1。Prompt v4 已完成质量验证，后续正式运行切换必须继续使用版本化配置，不得静默替换 Prompt v3。

## 五、最终结论

> Phase 15.2 Real Diagnosis Validation 已通过并冻结。系统已经证明真实 LLM Diagnosis 可以通过版本化样本、人工边界和受控质量策略形成可复现的接受、复核与阻断结果；Policy v2.1 已正式启用，且不会因 Root Cause 校准而放宽其他安全门槛。

下一阶段进入 Phase 15.3 Controlled Feedback Expression。
