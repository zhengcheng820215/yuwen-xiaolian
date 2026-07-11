# 能力证据契约（Ability Evidence Contract）

## 一、文档定位

本文档定义 Ability Evidence 的数据契约。

当前代码最小实现来自 Phase 3.1；本文档同时定义后续进入多 Session、Growth Memory 和 Evaluation Runtime 时需要遵守的 vNext 契约方向。

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
- 能使用稳定 abilityId 参与跨 Session 聚合。
- 能表达证据类型。
- 能解释观察表现。
- 能记录提示依赖、题目角色和证据质量条件。
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

兼容说明：

> 上述类型是 Phase 3.1 最小契约，用于跑通 Diagnosis -> Evidence -> Weakness Ranking 的 Debug 闭环。
> 后续长期聚合不应继续依赖 `ability: string`、粗粒度 `source` 或字符串型 `rootCause` 作为唯一依据。

vNext 推荐契约：

```ts
export type AbilityEvidenceType =
  | 'weakness'
  | 'positive'
  | 'growth'
  | 'insufficient';

export type AbilityEvidenceSource =
  | 'diagnosis'
  | 'guided_training'
  | 'independent_training'
  | 'revision'
  | 'retest'
  | 'transfer'
  | 'delayed_retest'
  | 'maintenance';

export type EvidenceIndependenceLevel =
  | 'independent'
  | 'light_hint'
  | 'guided'
  | 'high_support';

export type EvidenceRootCause = {
  abilityId?: string;
  status: 'unresolved' | 'hypothesis' | 'supported' | 'confirmed';
  explanation: string;
  evidenceLinks?: string[];
};

export type EvidenceComparison = {
  baselineEvidenceIds: string[];
  improvedDimensions: string[];
  remainingGaps?: string[];
};

export type AbilityEvidence = {
  id: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;
  evidenceType: AbilityEvidenceType;
  source: AbilityEvidenceSource;
  questionRole?: string;
  observation: string;
  rootCause?: EvidenceRootCause;
  evidenceConfidence: number;
  independenceLevel: EvidenceIndependenceLevel;
  hintLevel?: number;
  aggregationEligible: boolean;
  evidenceLinks: string[];
  studentAnswerSnapshot?: string;
  rubricItemIds?: string[];
  comparison?: EvidenceComparison;
  questionMetadataVersion?: string;
  rubricVersion?: string;
  createdAt: string;
  taskId?: string;
  diagnosisId?: string;
};
```

vNext 契约先作为文档约束，不要求当前 Phase 3.1 代码立即全部实现。

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

### vNext 字段语义

| 字段 | 说明 |
| --- | --- |
| `abilityId` | 稳定能力 ID，长期聚合必须依赖它 |
| `abilityLabel` | 展示名称，可由 ABILITY_MODEL 映射得到 |
| `source` | 证据来源，应区分 diagnosis、guided_training、independent_training、retest、transfer 等 |
| `questionRole` | 题目在本次使用中的角色，如 diagnostic、guided_practice、retest、transfer |
| `independenceLevel` | 学生完成任务的独立程度 |
| `hintLevel` | 提示层级，可选 |
| `evidenceConfidence` | 当前作答支持这条 evidence 判断的可靠程度 |
| `aggregationEligible` | 是否可参与长期能力聚合 |
| `evidenceLinks` | 指向原始答案、答案片段、rubric、提示记录、复测任务等证据来源 |
| `studentAnswerSnapshot` | 学生答案快照，缺少统一链接机制时可临时保留 |
| `rubricItemIds` | 本条 evidence 关联的 rubric item |
| `comparison` | growth evidence 的比较基线 |
| `questionMetadataVersion` | 生成本条 evidence 时使用的题目元数据版本 |
| `rubricVersion` | 生成本条 evidence 时使用的 rubric 版本 |

### 字段边界

#### `abilityId`

长期聚合必须使用稳定 `abilityId`，不能依赖中文展示名。

不稳定示例：

```text
概括
概括能力
要点概括
内容概括
```

这些表达都可能指向同一能力，但如果直接用字符串聚合，会污染跨 Session 统计。

规则：

```text
聚合依据 = abilityId
展示名称 = abilityLabel / ABILITY_MODEL 映射
```

兼容阶段可以保留 `ability` 或 `abilityLabel`，但不能作为长期聚合主键。

#### `source`

Phase 3.1 的 `diagnosis | training | retest` 只适合最小闭环。

长期 Evaluation 需要区分证据来源质量：

- guided_training；
- independent_training；
- revision；
- retest；
- transfer；
- delayed_retest；
- maintenance。

不同来源的证据不能被等价处理。

#### `independenceLevel`

提示依赖是判断能力是否真正成长的关键。

```text
independent evidence
> light_hint evidence
> guided evidence
> high_support evidence
```

一个学生在五级提示后完成，与完全独立完成，不能形成同等强度的 evidence。

#### `growth` comparison

`growth` 是相对概念，必须说明“相比什么发生了改善”。

规则：

```text
没有可引用的历史基线
-> 不能生成 growth
-> 最多生成 positive
```

例如，孩子第一次就答得很好，只能形成 `positive`，不能形成 `growth`。

#### `rootCause`

`rootCause` 保存的是本次 Diagnosis 的根因判断或假设，不代表长期确认事实。

推荐使用结构化 rootCause：

```ts
rootCause: {
  status: 'unresolved' | 'hypothesis' | 'supported' | 'confirmed';
  explanation: string;
}
```

避免把一句 AI 推测长期保存成“真实根因”。

#### `evidenceConfidence`

`evidenceConfidence` 表示：

> 当前作答能够支持这条 Evidence 判断的可靠程度。

它不表示长期能力置信度。

长期能力置信度应由 Evaluation 聚合产生。

#### `aggregationEligible`

`insufficient` 应保存为运行记录，但不参与正向、薄弱或成长趋势聚合。

规则：

| evidenceType | aggregationEligible |
| --- | --- |
| positive | true |
| weakness | true |
| growth | true |
| insufficient | false |

`insufficient` 仍有价值，因为它可以帮助观察：

- 学生是否经常跳过任务；
- 输入体验是否有问题；
- 某类题是否难以理解；
- 是否需要重新完成。

但它不能被解释成能力弱。

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

注意：

`growth` 只是一次成长证据或改善信号，不等于能力已经提升。能力提升必须由多条 evidence、时间跨度和独立复测共同支持。

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

### Phase 3.1 最小默认映射

| Diagnosis 字段 | Evidence 字段 |
| --- | --- |
| `mainAbility` | `ability` / `abilityId` |
| `answerStatus` | `evidenceType` 判断依据 |
| `rootCause` | `rootCause` |
| `surfaceError` / `diagnosisSummary` | `observation` 候选来源 |
| `confidence` | `confidence` / `evidenceConfidence` |
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

上述规则是 Phase 3.1 最小默认映射，不作为长期 Evaluation 的唯一依据。

### vNext 映射原则

长期 evidenceType 不应只根据 `answerStatus` 一对一映射。

更合理的判断应综合：

- answerStatus；
- rubric 命中结果；
- 当前任务角色 questionRole；
- 历史基线；
- 提示程度；
- required / critical rubric 是否缺失；
- 是否存在 comparison baseline；
- evidenceLinks 是否足够。

示例：

| 情况 | 更合理的 evidenceType |
| --- | --- |
| `partially_meets`，比基线明显改善，仍有缺口 | growth |
| `partially_meets`，核心 required rubric 缺失 | weakness |
| `partially_meets`，只缺非核心表达项 | positive 或 low-confidence weakness |
| 第一次完整作答且无历史基线 | positive |
| 无效输入、纯数字、敷衍答案 | insufficient |

也就是说：

```text
answerStatus
+ rubric 结果
+ questionRole
+ historical baseline
+ hint dependency
-> evidenceType
```

而不是：

```text
answerStatus
-> evidenceType
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

vNext 推荐校验：

- `abilityId` 必须非空。
- `abilityLabel` 只能用于展示，不得作为聚合主键。
- `source` 必须能区分 guided / independent / retest / transfer 等关键来源。
- `independenceLevel` 必须非空。
- `evidenceConfidence` 必须是 0 到 1 的数字。
- `evidenceLinks` 应至少包含一个可追溯来源。
- `growth` 必须包含 `comparison.baselineEvidenceIds`。
- `insufficient` 必须设置 `aggregationEligible=false`。
- `rootCause.status` 不得默认为 `confirmed`。
- 如果存在 `questionMetadataVersion`，应随 evidence 一起保存。

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

兼容迁移规则：

- 当前代码仍可读取 `ability`，但新增实现应优先写入 `abilityId`。
- 当前代码仍可读取 `confidence`，但文档语义应逐步迁移为 `evidenceConfidence`。
- 当前 `training` source 可作为兼容大类，但新 evidence 应尽量写入更细 source。
- 当前字符串 `rootCause` 可继续展示，但长期存储应迁移为结构化 rootCause。
- 当前 `insufficient` 可保存为运行记录，但不应进入 weakness ranking 主聚合。

## 十、最终原则

Ability Evidence 的最终原则是：

> 记录证据，不急于下长期结论。

底层约束：

> “能力提升”不是 AI 输出的描述字段，而是一个需要经过时间、多次表现和独立复测才能成立的状态。

因此：

- 单条 `positive` 只能表示本次表现满足要求；
- 单条 `growth` 只能表示本次出现改善信号；
- 单条 `retest` evidence 只能表示一次迁移验证结果；
- 单条 `insufficient` 只能表示当前证据不足；
- 任何单条 evidence 都不能单独宣布能力已经提升或薄弱点已经解决。

Phase 3.1 不要求判断学生能力等级，只要求将每一次作答中可观察的能力表现沉淀为可靠证据。

进入 Phase 8 / Growth Memory 后，Ability Evidence 应成为：

> 可跨 Session 聚合、可追溯、可比较、可评估的能力证据单元。
