# Phase 4.2：Real AI Diagnosis / Evidence 最小闭环

## 阶段目标

Phase 3.1、3.2、3.3、4.1 已完成并验收。

这些阶段已经验证：

```text
Diagnosis Result
-> Ability Evidence
-> Weakness Ranking
-> Training Plan
-> Training Evidence
-> Retest Evidence
-> Student Ability Profile
```

Phase 4.2 不返工、不重构前序模块。

本阶段的目标是验证当前最大不确定性：

> 真实 AI 能否基于真实题目、参考答案和学生答案，稳定生成可信的 Diagnosis Result，并沉淀为 Ability Evidence。

## 核心链路

Phase 4.2 的最小闭环为：

```text
真实题目 + 参考答案 + 学生答案
-> Prompt Builder
-> Real AI Diagnosis
-> Diagnosis Result
-> Ability Evidence
-> Student Ability Profile
```

Phase 4.2 的最终验收闭环必须支持长期 Runtime 衔接：

```text
previousEvidence
+ Real AI Diagnosis Result
-> newAbilityEvidence
-> updatedEvidence
-> evidenceSummary
-> topWeakness
-> Student Ability Profile
```

因此 Phase 4.2 不是单次诊断 Demo，而是能够接入历史证据、更新证据池，并支撑后续 Training Plan / Personalized Next Task 的 Runtime 节点。

## 输入

本阶段输入包括：

- `question`
- `referenceAnswer`
- `studentAnswer`
- `questionMetadata`（可选，优先由现有 QuestionMetadataAgent 生成）
- `studentId`
- `previousEvidence`（可选，来自历史诊断、训练或复测证据）

## 输出

本阶段输出包括：

- `prompt`
- `diagnosisResult`
- `newAbilityEvidence`
- `abilityEvidence`（兼容别名，指向 `newAbilityEvidence`）
- `updatedEvidence`
- `evidenceSummary`
- `topWeakness`
- `studentAbilityProfile`
- `usedLiveAI`
- `rawLLMOutput`

其中：

- `diagnosisResult` 必须符合现有 `DiagnosisResult` Schema。
- `newAbilityEvidence` 必须符合现有 `AbilityEvidence` Schema。
- `updatedEvidence` 必须等于 `previousEvidence + newAbilityEvidence`，并按 `evidence.id` 去重。
- `evidenceSummary` 必须基于 `updatedEvidence` 生成。
- `topWeakness` 必须基于 `evidenceSummary` 生成。
- `studentAbilityProfile` 必须基于 `updatedEvidence` 生成，不能只基于单条新证据生成。

## 本阶段允许开发

允许新增：

- Real AI Diagnosis Prompt Builder
- Real AI Diagnosis Agent
- Real AI Diagnosis Debug Script
- npm debug script

允许复用：

- `QuestionMetadataAgent`
- `DiagnosisResult` Schema
- `AbilityEvidenceExtractor`
- `WeaknessRankingAgent`
- `StudentAbilityProfileAgent`

## 本阶段不允许开发

本阶段不做：

- UI 优化
- 旧 Demo 改造
- 数据库
- 长期学生记录
- 大规模题库
- Training Plan 重构
- Student Profile 重构

本阶段不大规模优化 Phase 3.1、3.2、3.3、4.1。

## Real AI 调用策略

Phase 4.2 支持两种运行模式：

### Dry Run

默认模式。

用于验证：

- Prompt Builder 能生成提示词。
- Diagnosis Result 结构可被解析。
- Ability Evidence 可生成。
- Student Ability Profile 可消费 Evidence。

Dry Run 不证明真实 AI 诊断质量。

### Live AI

当配置真实 AI 环境变量后，Debug 脚本可调用真实大模型。

建议环境变量：

```text
REAL_AI_DIAGNOSIS_LIVE=true
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

Live AI 模式用于验证：

- 真实模型是否稳定输出 JSON。
- 真实诊断是否符合 Diagnosis Schema。
- 真实诊断是否能转成 Ability Evidence。
- 真实 Evidence 是否能进入 Student Ability Profile。

## 验收标准

Phase 4.2 的最小验收标准：

1. 能基于真实题目生成 Prompt。
2. 能得到结构化 Diagnosis Result。
3. Diagnosis Result 可被 normalize。
4. 能从 Diagnosis Result 生成 `newAbilityEvidence`。
5. 能接收 `previousEvidence`。
6. 能输出 `updatedEvidence = previousEvidence + newAbilityEvidence`。
7. 能基于 `updatedEvidence` 生成 `evidenceSummary`。
8. 能基于 `evidenceSummary` 生成 `topWeakness`。
9. Student Ability Profile 必须基于 `updatedEvidence` 生成。
10. Ability Evidence / evidenceSummary / topWeakness 可作为后续 Training Plan 或 Personalized Next Task 的输入。
11. Debug 脚本可重复运行。
12. Dry Run 必须通过。
13. Live AI 模式至少验证 5 到 10 道真实题后，才能认为真实 AI 诊断进入可评估状态。

## 当前阶段边界

Phase 4.2 验证的是真实 AI 诊断能否进入现有 Runtime。

Phase 4.2 还必须验证输出能支撑后续闭环：

```text
topWeakness -> Training Plan
studentAbilityProfile -> Personalized Next Task
```

Phase 4.2 不证明：

- 学生长期能力已经提升。
- 诊断质量已经达到最终可用。
- 所有题型都能稳定诊断。
- 训练计划已经完全个性化。

真实 AI 质量需要通过真实题目样例、人工复核和持续回归样例逐步验证。

## 验收结果

验收时间：2026-07-09

验收结论：

> Phase 4.2 Dry Run 最小闭环验收通过。

本次验收已证明以下 Runtime 链路成立：

```text
真实题目 + 参考答案 + 学生答案
-> Question Metadata
-> Prompt Builder
-> Diagnosis Result
-> newAbilityEvidence
-> updatedEvidence
-> evidenceSummary
-> topWeakness
-> Student Ability Profile
```

已通过的核心能力包括：

- 能基于真实题目和 Question Metadata 构建诊断 Prompt。
- 能输出结构化 `DiagnosisResult`。
- 能将 `DiagnosisResult` 转换为 `newAbilityEvidence`。
- 能接收 `previousEvidence`。
- 能将 `previousEvidence + newAbilityEvidence` 合并为 `updatedEvidence`。
- `updatedEvidence` 已按 `evidence.id` 去重。
- 能基于 `updatedEvidence` 生成 `evidenceSummary`。
- 能基于 `evidenceSummary` 生成 `topWeakness`。
- 能基于 `updatedEvidence` 生成 `Student Ability Profile`。
- Demo 页面能够完整展示 Phase 4.2 Runtime 链路。

本次手动验收样例包括：

- 句子含义理解题：验证“理解”能力诊断链路。
- 概括题：验证“概括”能力诊断链路。
- 推理题：验证“推理”能力诊断链路，并验证本次新增薄弱证据能够进入能力画像。

其中推理题验收结果符合预期：

- Prompt Builder 识别为“推理”任务。
- Diagnosis Result 输出主要能力为“推理”。
- newAbilityEvidence 输出为“推理 / 薄弱证据”。
- updatedEvidence 合并后共 3 条证据。
- evidenceSummary 正确聚合“表达、概括、推理”三类能力证据。
- topWeakness 将“推理”识别为当前优先薄弱能力。
- Student Ability Profile 将“推理”作为当前薄弱能力，并给出后续训练方向。

验证命令：

```bash
pnpm run debug:real-ai-diagnosis
pnpm run build
```

当前本地默认 Node 版本低于 Vite 要求，验证时使用 Codex bundled Node 执行构建。

### 验收边界

本次通过的是 Dry Run Runtime 链路验收。

本次验收不代表真实 AI 诊断质量已经通过。

真实 AI 诊断质量仍需在 Live AI 模式下，使用 5 到 10 道真实题进行人工复核后，才能进入可评估状态。

## 当前阶段结论

Phase 4.2 是从规则 / mock 驱动 Runtime 走向真实 AI Runtime 的第一步。

本阶段的核心不是增加功能数量，而是验证：

```text
真实 AI 输出
是否能够稳定进入现有能力证据和学生画像体系。
```

