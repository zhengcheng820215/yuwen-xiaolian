# 教育模型文档索引（Education Documentation Index）

本文档用于说明 `docs/education/` 目录下教育模型文档的职责、分类和推荐阅读顺序。

当前阶段暂不移动核心模型文件，仅通过本索引建立逻辑分组，避免影响已有代码中的文档路径引用。

## 一、目录职责

### `docs/product/`

定义产品目标、产品边界和核心价值。

### `docs/runtime/`

定义 Agent、Runtime 和开放题诊断的执行规范。

其中 `SYSTEM_MAP.md` 是当前系统的人类可读地图，用于快速理解总链路、当前进度、当前 Phase 目标和下一步方向。

### `docs/education/phase/`

记录各阶段目标、任务、验收与冻结状态。

### `docs/education/` 根目录下的模型文档

定义能力、题目、诊断、训练、证据、评估和学生画像等系统模型。

## 二、核心文档分类

### 基础模型

- `ABILITY_MODEL.md`
- `QUESTION_MODEL.md`
- `QUESTION_METADATA_MODEL.md`

### 学习行为模型

- `DIAGNOSIS_MODEL.md`
- `TRAINING_MODEL.md`
- `AI_COACH_MODEL.md`
- `LEARNING_FLOW.md`

### 证据与长期状态

- `ABILITY_EVIDENCE_CONTRACT.md`
- `WEAKNESS_RANKING_MODEL.md`
- `EVALUATION_MODEL.md`
- `STUDENT_PROFILE_MODEL.md`

### 评估资产

- `EVALUATION_CASE_SET.md`

## 三、推荐阅读顺序

建议按以下顺序理解系统：

```text
SYSTEM_MAP
↓
PRODUCT
↓
ABILITY_MODEL
↓
QUESTION_MODEL
↓
QUESTION_METADATA_MODEL
↓
DIAGNOSIS_MODEL
↓
ABILITY_EVIDENCE_CONTRACT
↓
WEAKNESS_RANKING_MODEL
↓
TRAINING_MODEL
↓
AI_COACH_MODEL
↓
LEARNING_FLOW
↓
EVALUATION_MODEL
↓
STUDENT_PROFILE_MODEL
↓
EVALUATION_CASE_SET
↓
LEARNING_RUNTIME_OVERVIEW
```

## 四、当前状态

- 12 份核心模型文档已完成第一轮审查增强。
- Phase 14.1 Evidence Quality Assessment 已通过 17 / 17 Debug 验收。
- Phase 14.2 Evidence Conflict Coordination 已通过 25 / 25 Debug 验收。
- Phase 14.3 Adaptive Task Constraints 已完成结构化 Rule、Context Snapshot、TaskRequest Envelope 与 Fulfillment 接入，26 / 26 Debug 通过；执行后质量重评集成 Case 27 为 16 / 16 PASS，Phase 14 总体状态为 `PASS / FROZEN`。
- Phase 14 冻结能力声明：系统能够根据正式任务、作答、提示、时间和追溯事实评估 Evidence 的判断价值，协调多条 Evidence 的方向关系，并在 Existing Strategy 的边界内生成受控任务约束；任务执行后，系统会依据真实表现重新评估 Evidence 质量，而不会把目标质量当成实际结果。
- Phase 15.1 Real LLM Runtime Foundation 已通过并冻结：确定性 Debug 为 `22 / 22 PASS`，DeepSeek `deepseek-v4-flash` Live Smoke 为 `4 / 4 PASS`。Phase 15.2 已完成 Prompt v4 真实质量验证、Policy v2.1 校准、负责人确认和正式启用回归；Root Cause 为 90 / 93，完整质量为 accepted 79、questionable 6、unacceptable 8、critical 0，正式验收 `15 / 15 PASS`。Phase 15.2 当前为 `PASS / FROZEN`，正式质量 Evaluator 默认使用 Policy v2.1。
- [Phase 15.3 Controlled Feedback Expression](./phase/phase15_3.md) 已通过并冻结：确定性 Debug `24 / 24`、DeepSeek Prompt v1.1 Live `12 / 12`、Controlled Safety `2 / 2`、脱敏人工抽检 `12 / 12`、关键回归与 Production Build 全部通过。Phase 15 当前为 `PASS / FROZEN`。
- Phase 15 总纲见 [Phase 15](./phase/phase15.md)，Diagnosis 质量冻结记录见 [Phase 15.2 验收](./phase/phase15_2_acceptance_report.md)，受控表达质量记录见 [Phase 15.3 验收](./phase/reports/phase15_3/phase15_3_controlled_feedback_acceptance_2026-07-17.md)，整链记录见 [Phase 15 集成验收](./phase/reports/phase15_integration_acceptance_2026-07-17.md)。确定性整链 Debug 已 `11 / 11 PASS`；Prompt v4 默认切换和真实外部 Provider 完整产品主链的受控试跑仍未完成。
- [Phase 16 总纲](./phase/phase16.md) 当前为 `ACCEPTED / IN PROGRESS`；阶段目标是建立结构化题目准入、资源匹配质量和单学生 5—7 天真实学习运行基础。[Phase 16.1](./phase/phase16_1.md) 已完成：16.1A 资源准入 Runtime 取得 `22 / 22 PASS`，16.1B 最小录入工作台通过人工 Demo 验收；当前工作台 UX 仍有较大欠缺，保留为后续专项优化项。[Phase 16.2](./phase/phase16_2.md) 已通过并冻结：16.2A Core Eligibility 为 `12 / 12 PASS`，16.2B Context-sensitive Match Quality 为 `16 / 16 PASS`，关键回归与 Build 通过，轻量 Match Review Demo `8 / 8` Case 人工验收、Phase 16.1 -> 16.2 人工联调 Demo `4 / 4 PASS` 及 PC / 平板布局检查通过。2026-07-20 [Phase 1–16.2 组合式全链路 Runtime 回归](./phase/reports/phase1_16_2_integrated_runtime_regression_2026-07-20.md) 已完成：48 个确定性 Debug / 集成脚本与 Production Build 全部通过；该结果不包含 DeepSeek Live 或浏览器人工验收。Phase 16.3 子阶段文档仍待输出。
- 当前暂不移动目录。
- 后续根据文档增长情况再评估是否迁移到 `models/` 分层目录。
- 后续新增教育模型文档，必须先在本 README 中登记。

## 五、文档层级关系

### Knowledge Layer

`docs/education/` 根目录下的核心模型文档定义长期教育语义，包括能力、题目、诊断、训练、证据、评估和学生画像。

这些文档回答：

```text
系统应该如何理解学习、能力、证据和成长？
```

### Runtime Layer

`docs/runtime/` 定义 Agent、Runtime 和开放题诊断的执行规范。

这些文档回答：

```text
模型语义如何进入可运行的 Agent / Runtime 协作？
```

### Phase Records

`docs/education/phase/` 记录各阶段当时完成的最小实现、验收标准、冻结边界和历史结论。

Phase 文档是历史记录，不会因为长期模型增强而自动重写。若 Phase 记录与最新核心模型存在差异，以最新核心模型和 Runtime 协议作为长期语义标准。

## 六、当前实现与长期协议

当前 Phase 1-7 已经跑通多条最小 Runtime 链路，其中部分实现仍采用早期组合方式，例如：

```text
AbilityEvidence
-> EvidenceSummary
-> StudentAbilityProfile
```

长期标准协议应逐步收敛为：

```text
DiagnosisResult
-> AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

因此，当前工程中的 Evidence 回流和 Profile 重算可以继续作为兼容实现保留，但不代表单条 Evidence、一次训练、一次复测或一次 Session 可以直接确认长期能力状态变化。
