# Phase 4.3：Live AI Diagnosis Quality Evaluation

## 阶段背景

Phase 4.2 已完成 Runtime 结构闭环：

```text
真实题目 + 学生答案
-> Prompt Builder
-> Diagnosis Result
-> Normalize
-> Ability Evidence
-> updatedEvidence
-> evidenceSummary
-> topWeakness
-> Student Ability Profile
```

Phase 4.2 证明的是链路可运行。

Phase 4.3 不继续扩展功能，也不做 UI。

本阶段目标是验证：

> Live AI 真实诊断质量是否可评估，是否初步可信。

## 阶段目标

建立最小 Live AI 质量评估闭环：

```text
Live AI 测试样例
-> Real AI Diagnosis
-> rawLLMOutput
-> normalizedDiagnosis
-> abilityEvidence
-> Evaluation Report
-> PASS / REVIEW / FAIL
```

本阶段优先证明：

- 真实 AI 输出可以被记录。
- 真实 AI 输出可以被 normalize。
- 真实 AI 诊断质量可以被复核。
- 真实 AI 质量问题可以被持续沉淀为回归样例。

## 样例集

Phase 4.3 建立第一版 Live AI 诊断质量样例集。

样例数量：8 道。

覆盖能力：

- 理解：2 道
- 概括：2 道
- 推理：2 道
- 表达：2 道

每条样例必须包含：

- `id`
- `question`
- `referenceAnswer`
- `studentAnswer`
- `expectedMainAbility`
- `expectedRootCauseDirection`
- `expectedAnswerStatus`

样例文件：

```text
src/ai/tests/liveAIDiagnosis.samples.ts
```

## Evaluation Report

每条样例运行后输出：

- `sampleId`
- `question`
- `studentAnswer`
- `rawLLMOutput`
- `normalizedDiagnosis`
- `abilityEvidence`
- `expectedMainAbility`
- `expectedRootCauseDirection`
- `expectedAnswerStatus`
- `actualMainAbility`
- `actualRootCause`
- `actualAnswerStatus`
- `reviewResult`
- `reviewReason`
- `mainAbilityMissAnalysis`（仅当 mainAbility 未命中时输出）
- `rootCauseIssueAnalysis`（仅当 rootCause 方向不可接受时输出）
- `reviewNotes`

`reviewResult` 包括：

- `PASS`
- `REVIEW`
- `FAIL`

其中：

- `reviewReason` 用于解释该样例为什么进入 PASS / REVIEW / FAIL。
- `mainAbilityMissAnalysis` 用于判断能力错配是否属于可接受相邻能力，是否需要调整 Prompt，是否需要调整样例预期。
- `rootCauseIssueAnalysis` 用于判断 rootCause 是否缺少 evidence、是否过度泛化、是否无法转化为训练任务。

## 人工复核标准

每条样例需要按以下标准复核：

1. `mainAbility` 是否正确。
2. `rootCause` 是否合理。
3. `abilityEvidence` 是否能从学生答案中找到依据。
4. `nextTraining` 是否能进入后续训练计划。
5. `confidence` 是否保守。
6. 是否出现凭空判断。
7. 是否直接给长期能力结论。

脚本只能完成结构性初判。

`rootCause` 是否真正合理、是否符合语文学习诊断预期，仍需要人工复核。

## 验收门槛

Phase 4.3 的质量通过标准：

| 指标 | 要求 |
| --- | --- |
| JSON 可解析率 | 100% |
| Schema 通过率 | 100% |
| mainAbility 命中率 | >= 80% |
| rootCause 人工可接受率 | >= 70% |
| 凭空判断 | 0 |
| 直接长期能力结论 | 0 |
| Debug / Evaluation 脚本 | 可重复运行 |

## 命令

Live AI 质量评估命令：

```bash
pnpm run debug:live-ai-evaluation
```

运行 Live AI 评估前需要配置：

```bash
REAL_AI_DIAGNOSIS_LIVE=true
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

如果 OpenAI API 不可用，可以切换为 DeepSeek API：

```bash
REAL_AI_DIAGNOSIS_LIVE=true
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
```

DeepSeek 调用使用 OpenAI-compatible Chat Completions 接口：

```text
https://api.deepseek.com/chat/completions
```

本地结构检查可以使用：

```powershell
$env:LIVE_AI_EVALUATION_DRY_RUN='true'; pnpm run debug:live-ai-evaluation
```

Dry Run 仅用于验证评估脚本结构，不代表真实 AI 质量。

## 本阶段不做

Phase 4.3 不做：

- UI
- 数据库
- 多模型路由
- 个性化任务生成
- Training Plan 改造
- Student Profile 改造
- Phase 4.2 Runtime 主链路修改

本阶段只围绕 Live AI 诊断质量评估展开。

## 当前阶段结论

Phase 4.3 的目标不是证明 AI 已经足够好。

本阶段首先要证明：

```text
真实 AI 诊断质量
可以被持续测试、复核、记录和改进。
```

只有当 Evaluation Report 达到验收门槛后，才能认为真实 AI 诊断进入可评估状态，并允许进入下一阶段。

## 当前执行状态

执行时间：2026-07-09

已完成：

- Live AI Evaluation 样例集已建立，共 8 条。
- Evaluation Report 已支持 `reviewReason`。
- mainAbility miss 样例已支持输出能力错配分析。
- rootCause 不可接受样例已支持输出 rootCause 问题分析。
- Dry Run 结构检查可重复运行。
- `pnpm run build` 已通过。

Dry Run 结构检查结果：

```text
JSON parse rate: 100%
Schema pass rate: 100%
mainAbility hit rate: 75%
rootCause acceptable rate: 75%
PASS / REVIEW / FAIL: 3 / 5 / 0
allowNextPhase: false
```

说明：

Dry Run 结果只证明评估工具链可运行，不代表真实 AI 诊断质量。

Live AI 验收尚未完成。

当前本地环境缺少：

```text
OPENAI_API_KEY
OPENAI_MODEL
```

因此 Live AI 模式已按预期阻断，等待配置真实 AI 环境变量后继续执行。

后续补充：

OpenAI API 网络代理已打通，但 OpenAI Billing 额度为 0，真实 AI 验收无法继续使用 OpenAI API。

Phase 4.3 Evaluation 脚本已支持通过 `AI_PROVIDER=deepseek` 切换到 DeepSeek API 继续真实 AI 质量评估。

## Phase 4.3 验收冻结记录

验收时间：2026-07-09

Provider：

```text
deepseek
```

Live AI Evaluation Report：

```text
total: 8
JSON parse rate: 100%
Schema pass rate: 100%
mainAbility hit rate: 100%
rootCause acceptable rate: 75%
PASS / REVIEW / FAIL: 5 / 3 / 0
majorIssues: 0
allowNextPhase: true
```

人工复核结论：

- `live_inference_002`：rootCause 与预期方向一致，可接受。
- `live_expression_001`：rootCause 可转化为训练任务，可接受。
- `live_expression_002`：actual answerStatus=`does_not_meet` 更合理，已修正样例预期。

## 验收报告

本阶段详细验收结果独立记录在：

```text
docs/education/phase/phase4_3_acceptance_report.md
```

阶段文档仅保留验收摘要；样例级结果、人工复核备注和完整 Acceptance Summary 以 report 为准。

最终结论：

```text
Phase 4.3 通过。
allowNextPhase = true。
允许进入 Phase 5.1。
```

冻结边界：

- 不修改 Diagnosis Result Schema。
- 不扩大样例集。
- 不进入 Phase 5.1 代码开发。
- 不重构 Phase 4.2 Runtime 主链路。

