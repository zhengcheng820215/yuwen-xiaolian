# 教育模型文档索引（Education Documentation Index）

本文档用于说明 `docs/education/` 目录下教育模型文档的职责、分类和推荐阅读顺序。

当前阶段暂不移动核心模型文件，仅通过本索引建立逻辑分组，避免影响已有代码中的文档路径引用。

## 一、目录职责

### `docs/product/`

定义产品目标、产品边界和核心价值。

### `docs/runtime/`

定义 Agent、Runtime 和开放题诊断的执行规范。

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
- 当前暂不移动目录。
- Phase 8 前后，根据文档增长情况再评估是否迁移到 `models/` 分层目录。
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
