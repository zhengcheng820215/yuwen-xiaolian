# Ability Evidence Contract

## 一、文档定位

本文档定义 Phase 3.1 中 Ability Evidence 的数据契约。

Ability Evidence 是连接单次 Diagnosis Result 和长期 Student Ability Profile 的中间层。

Diagnosis Result 回答：

```text
这一次作答表现如何？
```

Ability Evidence 回答：

```text
这一次作答能为长期能力画像提供什么证据？
```

Student Profile 未来回答：

```text
多次证据共同说明学生当前能力状态如何？
```

因此，Ability Evidence 不是页面展示字段，也不是考试评分结果，而是长期能力成长系统的证据单元。

## 二、核心定义

Ability Evidence 是一次可追溯、可累计、可解释的能力表现记录。

它必须满足：

- 能追溯到来源任务或诊断。
- 能说明关联能力。
- 能表达证据类型。
- 能解释观察表现。
- 能被后续聚合、排序和画像更新消费。

## 三、TypeScript Schema

Phase 3.1 建议新增：

```text
src/ai/schemas/abilityEvidence.schema.ts
```

最小类型定义：

```ts
export type AbilityEvidenceType =
  | 'weakness'
  | 'positive'
  | 'growth'
  | 'insufficient';

export type AbilityEvidenceSource =
  | 'diagnosis'
  | 'training'
  | 'retest';

export type AbilityEvidence = {
  id: string;
  studentId: string;
  ability: string;
  evidenceType: AbilityEvidenceType;
  source: AbilityEvidenceSource;
  observation: string;
  rootCause?: string;
  confidence: number;
  createdAt: string;
  taskId?: string;
  diagnosisId?: string;
};
```

## 四、字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | Evidence 唯一标识 |
| `studentId` | 是 | 学生标识，Phase 3.1 可使用 `demo-student` |
| `ability` | 是 | 对应能力，如信息提取、理解、概括、分析、推理、表达 |
| `evidenceType` | 是 | 证据类型 |
| `source` | 是 | 证据来源 |
| `observation` | 是 | 观察到的具体表现 |
| `rootCause` | 否 | 来自 Diagnosis 的能力根因或主要问题 |
| `confidence` | 是 | 证据置信度，范围 0 到 1 |
| `createdAt` | 是 | ISO 时间字符串 |
| `taskId` | 否 | 来源题目或任务 ID |
| `diagnosisId` | 否 | 来源 Diagnosis Result ID |

## 五、Evidence Type 语义

### `positive`

说明本次作答形成正向能力证据。

常见来源：

- `answerStatus='fully_meets'`
- `correct=true`
- 学生完整覆盖核心 rubric

注意：

`positive` 不等于能力已经稳定掌握。它只是一次正向证据，仍需多次任务和迁移验证。

### `weakness`

说明本次作答形成薄弱或不稳定证据。

常见来源：

- `answerStatus='partially_meets'`
- `answerStatus='does_not_meet'`
- `correct=false`
- required rubric 缺失

注意：

单条 `weakness` 不等于长期能力薄弱。只有多条一致 evidence 才能提高薄弱点优先级。

### `growth`

说明训练、修正或复测后形成成长证据。

Phase 3.1 暂不要求生成 `growth`，但 Schema 必须预留。

常见来源：

- 训练后同能力任务表现提升
- 修正答案明显补足原缺口
- 复测中表现优于诊断前

### `insufficient`

说明本次作答无法形成稳定能力判断。

常见来源：

- 空答案
- 敷衍答案
- 无关答案
- 证据不足

注意：

`insufficient` 不应进入薄弱点排序的主证据，不应直接生成能力短板结论。

## 六、Diagnosis Result 到 Evidence 的映射

最小映射规则：

| Diagnosis 字段 | Evidence 字段 |
| --- | --- |
| `mainAbility` | `ability` |
| `answerStatus` | `evidenceType` 判断依据 |
| `rootCause` | `rootCause` |
| `surfaceError` / `diagnosisSummary` | `observation` 候选来源 |
| `confidence` | `confidence` |
| task context | `taskId` |

映射规则：

```text
fully_meets -> positive
partially_meets -> weakness
does_not_meet -> weakness
insufficient_evidence -> insufficient
```

对于 exact match 题：

```text
correct=true -> positive
correct=false -> weakness
correct=null -> insufficient
```

## 七、Observation 生成原则

`observation` 必须是学生表现描述，而不是抽象标签。

推荐格式：

```text
学生答案部分满足要求，但缺少文本依据或推理链说明。
```

不推荐：

```text
推理弱。
```

原因：

- 后者无法追溯到具体表现。
- 后者容易把单次表现误写成长期能力结论。

## 八、Evidence 校验规则

Phase 3.1 最小校验：

- `studentId` 必须非空。
- `ability` 必须非空。
- `evidenceType` 必须属于枚举。
- `source` 必须属于枚举。
- `observation` 必须非空。
- `confidence` 必须是 0 到 1 的数字。
- `createdAt` 必须非空。

建议提供：

```ts
export function isAbilityEvidence(value: unknown): value is AbilityEvidence
export function normalizeAbilityEvidence(value: Partial<AbilityEvidence>): AbilityEvidence
```

## 九、Phase 3.1 验收

Ability Evidence Contract 在 Phase 3.1 中验收标准：

- 一条有效 Diagnosis Result 可以生成一条 Ability Evidence。
- 无效作答生成 `insufficient`，不生成 `weakness`。
- 正确或满足要求的作答生成 `positive`。
- 部分满足或不满足的作答生成 `weakness`。
- 所有 Evidence 都可被 JSON 序列化。
- 所有 Evidence 都可进入 Debug 聚合统计。

## 十、最终原则

Ability Evidence 的最终原则是：

> 记录证据，不急于下长期结论。

Phase 3.1 不要求判断学生能力等级，只要求将每一次作答中可观察的能力表现沉淀为可靠证据。
