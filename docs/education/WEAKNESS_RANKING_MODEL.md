# 薄弱点排序模型（Weakness Ranking Model）

## 一、文档定位（Document Scope）

本文档定义 Phase 3.1 中如何基于 Ability Evidence 生成薄弱点排序。

Weakness Ranking 的目标不是给学生贴标签，而是回答：

```text
基于当前有效 Evidence，哪些问题值得优先关注？
```

它服务于后续 Training Plan 和 Personalized Next Task，但不直接等同于长期能力画像，也不直接等同于最终训练决策。

Phase 3.1 的最小闭环必须继续保留：

- 输入为 `AbilityEvidence[]`
- 输出 Top 1-3 薄弱点
- `insufficient` 不作为 weakness 主证据
- 每个排序项包含 `reasons`
- 每个排序项包含 `suggestedTrainingFocus`
- 当前轻量评分公式可继续作为 Debug 规则
- `pnpm run debug:ability-evidence` 的现有验收逻辑继续有效

本文档的增强目标是收紧职责边界，并说明长期演进方向，不推翻 Phase 3.1 已经完成和冻结的最小实现。

## 二、模型边界（Model Boundary）

Weakness Ranking 负责：

- 聚合当前观察窗口内的有效 Ability Evidence
- 识别重复出现的能力问题和具体表现模式
- 生成候选薄弱能力排序
- 提供可追溯的排序理由
- 为 Training Plan 或 Personalized Next Task 提供候选行动方向

Weakness Ranking 不负责：

- 判断学生长期能力等级
- 宣布某项能力长期薄弱
- 更新 Student Ability Profile
- 判断能力是否提升或退化
- 直接决定具体训练题
- 给学生形成固定能力标签

底层原则：

```text
薄弱证据、长期能力状态和下一步行动优先级是三个不同对象。

Weakness Ranking 只回答：
基于当前有效 Evidence，哪些问题值得优先关注？

它不回答：
学生长期能力到底是什么水平？
```

## 三、Weakness Ranking 与 Training Priority

Weakness Ranking 回答：

```text
哪些能力或问题存在较强的薄弱、不稳定证据？
```

Training Priority 回答：

```text
当前最值得先采取什么行动？
```

最终训练优先级还应考虑：

- 是否属于前置能力
- 根因是否已经得到支持
- 当前更适合训练、复测还是继续诊断
- 最近是否已经完成同能力训练
- 是否存在 Evidence 冲突
- 是否具备合适任务资源
- 当前认知负荷和连续失败风险

因此，Weakness Ranking 的输出是候选输入，不是最终训练决策。

Phase 3.1 中可以继续使用 `suggestedTrainingFocus`。

长期模型中，`suggestedTrainingFocus` 应理解为 `candidateTrainingFocus`：它表示候选训练焦点，最终 Training Plan 仍需结合 Student Profile、Evaluation Result 和当前学习阶段决定。

## 四、输入与输出（Input and Output）

### 输入

输入是一组 Ability Evidence：

```ts
AbilityEvidence[]
```

这些 Evidence 可以来自：

- Diagnosis
- Training
- Retest

Phase 3.1 主要使用 `source='diagnosis'`。

长期系统中，Evidence 来源、提示依赖、Question Role 和 Evidence Quality 会影响排序权重，但不属于 Phase 3.1 必须实现范围。

### 输出

Phase 3.1 输出薄弱点排序：

```ts
export type WeaknessRankingItem = {
  ability: string;
  priority: number;
  weaknessCount: number;
  positiveCount: number;
  insufficientCount: number;
  averageConfidence: number;
  reasons: string[];
  suggestedTrainingFocus: string;
};
```

字段兼容说明：

- 当前代码仍使用 `ability: string`，长期可逐步演进为 `abilityId + abilityLabel`。
- 当前代码仍使用 `suggestedTrainingFocus`，长期语义可视为 `candidateTrainingFocus`。
- 当前代码中的 `positiveCount` 已合并 `positive + growth`，用于 Phase 3.1 轻量排序。

## 五、排序原则（Ranking Principles）

### 1. Evidence 优先

没有 evidence，不输出薄弱点。

至少存在 1 条 `weakness` Evidence，才可以进入 Phase 3.1 排序。

### 2. 多次重复优先

同一能力多次出现 `weakness`，优先级高于单次 `weakness`。

重复必须来自可参与聚合的有效 Evidence。

同一任务中的重复修正不应被重复计数。

### 3. 置信度优先

高置信度 weakness 的权重高于低置信度 weakness。

Phase 3.1 中，`averageConfidence` 应理解为该能力下参与排序 Evidence 的平均置信度。当前代码使用该能力全部 Evidence 的平均置信度，作为 Debug 规则可以接受；长期版本应进一步区分 weakness confidence、positive confidence 和 evidence quality。

### 4. 最近表现优先

最近出现的 weakness 比很久以前的 weakness 更影响当前训练优先级。

Phase 3.1 可以暂不实现复杂时间衰减，但文档保留该原则。

### 5. 不把 insufficient 当作 weakness

`insufficient` 代表作答证据不足，不能直接证明能力薄弱。

`insufficient` 较多，表示当前数据质量不足或需要重新完成有效作答，不表示该能力更薄弱。

长期系统可以引入：

```ts
type EvidenceDataQuality = {
  insufficientCount: number;
  validObservationCount: number;
  status: 'sufficient' | 'limited' | 'poor';
};
```

Phase 3.1 暂不要求实现该结构。

### 6. Positive 可以降低优先级，但不能简单抵消 Weakness

如果某能力同时有多条 `positive`，说明该能力并非完全薄弱。排序时可以降低其优先级，或提示“表现不稳定”。

长期系统中，Positive 不能简单抵消 Weakness。

例如：

```text
guided_training positive
不能简单抵消
independent_retest weakness
```

不同来源 Evidence 的价值不同，长期模型需要考虑：

- Evidence 来源
- 独立完成程度
- 提示依赖
- 复测或迁移价值
- Evidence quality

## 六、Phase 3.1 最小评分规则（Minimum Scoring Rule）

Phase 3.1 不需要复杂算法。

当前已运行代码使用的最小评分：

```text
priority =
  weaknessCount * 10
  + averageConfidence * 5
  - positiveCount * 3
```

说明：

- `weaknessCount` 是主因。
- `averageConfidence` 用于区分证据强弱。
- `positiveCount` 用于避免把已有正向或成长证据的能力过度排高。
- `insufficientCount` 不直接加分。
- 至少存在 1 条 `weakness` Evidence 才能进入排序。
- 只统计当前允许参与聚合的 Evidence。

该公式仅用于 Phase 3.1 Debug 和最小闭环验证，不代表长期能力排序或正式训练推荐算法。

当前阶段暂不实现：

- 复杂时间衰减
- Evidence 质量权重
- Evidence 冲突处理
- 观察次数归一化
- Root Cause 支持等级权重

如果两个能力分数接近，优先选择：

1. rootCause 更集中、重复度更高的能力。
2. 有有效 weakness Evidence 支持的前置能力。
3. 更影响后续学习任务的能力。

前置能力不能被机械优先。

只有当前置能力本身存在有效 weakness Evidence 时，才可以作为优先项。不得仅因为它处于能力依赖路径前面，就默认它是根因。

## 七、Reason 生成规则（Reason Traceability）

每个 WeaknessRankingItem 必须包含 `reasons`。

Reason 应来自具体 Ability Evidence，而不是空泛判断。

Reason 应优先引用 Evidence ID。

Reason 不允许使用“推理能力差”“表达能力弱”等固定标签。

Reason 应描述重复出现的可观察表现。

推荐 Reason：

```text
3 次独立任务中出现“给出结论但缺少文本依据与说明关系”。
支持 Evidence：EV-014、EV-021、EV-026。
```

```text
多次 Diagnosis 中出现“缺少文本依据”。
```

```text
3 条推理相关 weakness evidence 均指向“推理链不完整”。
```

```text
表达能力有 2 条 weakness evidence，主要表现为答案要点不完整。
```

不推荐：

```text
推理能力差。
```

原因：

- 它没有证据。
- 它容易形成固定标签。
- 它不利于家长和学生理解下一步训练方向。

## 八、建议训练重点（Suggested Training Focus）

Weakness Ranking 不生成完整训练计划，但 Phase 3.1 必须给出下一步候选训练焦点。

示例：

| Ability | 常见 rootCause | suggestedTrainingFocus |
| --- | --- | --- |
| 信息提取 | 找不到文本依据 | 关键词定位 + 限定条件标注训练 |
| 理解 | 停留字面理解 | 语境理解 + 深层含义转换训练 |
| 概括 | 缺少核心事件 | 核心事件提取 + 主要内容概括训练 |
| 分析 | 只给结论缺少依据 | 文本依据 + 分析说明训练 |
| 推理 | 推理链不完整 | 文本线索提取 + 推理链表达训练 |
| 表达 | 答案不完整或逻辑不清 | “观点 + 依据 + 说明”结构表达训练 |

Phase 3.1 的 focus 可以是规则生成，不需要 LLM。

长期模型中，`suggestedTrainingFocus` 只是候选训练焦点，不是最终训练计划。Training Plan Agent 和 Personalized Next Task Agent 需要结合当前 Profile、Evaluation、任务资源和学习阶段决定具体行动。

## 九、Root Cause 与排序依据（Root Cause Support）

Root Cause 必须有 Evidence 支持。

只有 `supported` 或 `confirmed` 的 Root Cause 才能作为较强排序依据。

`hypothesis` 只能作为候选解释，不能直接形成稳定薄弱点。

如果根因仍不明确，候选行动应优先是：

```text
diagnostic_verification
```

而不是直接安排强针对性训练。

Phase 3.1 当前代码尚未实现结构化 Root Cause 支持等级，因此仍以已有 `rootCause` 文本和 reasons 作为最小可追溯依据。

## 十、Evidence 冲突处理（Evidence Conflict）

当同一能力同时存在 `positive`、`weakness` 和 `growth` Evidence 时，不应只做简单加减。

长期模型需要允许输出：

- likely_weakness
- unstable
- needs_more_evidence
- improving_but_unstable

冲突明显时，下一步可能是复测或继续观察，而不是直接继续训练。

Phase 3.1 当前仅用 `positiveCount` 轻量降低优先级，用于 Debug 闭环可以接受。

## 十一、长期演进注意事项（Long-Term Evolution）

### 1. Evidence 数量偏差

某项能力 Evidence 更多，可能只是因为被观察次数更多，不一定更薄弱。

长期模型需要逐步引入：

- validObservationCount
- weaknessRate
- observationWindow

### 2. 一级能力粒度过大

排序不能长期只输出“推理、表达、理解”等一级能力。

长期应逐步支持：

```text
abilityId + issuePattern / targetGap
```

例如：

- 推理 / 依据与结论连接不足
- 信息提取 / 限定条件遗漏
- 表达 / 要点组织不完整

### 3. Evidence 质量不同

训练中提示后完成、独立训练完成、即时复测完成、迁移任务完成，证据价值不同。

长期排序必须考虑 Question Role、supportLevel、hintLevel、metadataVersion 和 Evidence Quality。

### 4. 排序不等于固定标签

Weakness Ranking 输出的是当前行动候选，不是学生的长期能力标签。

同一能力在不同观察窗口中可以出现不同排序结果。

## 十二、Future / Phase 8+ 建议结构

以下结构是长期演进方向，不属于 Phase 3.1 必须实现范围。

```ts
export type WeaknessRankingItem = {
  abilityId: string;
  issuePatternId?: string;

  priorityScore: number;

  weaknessCount: number;
  positiveCount: number;
  validObservationCount: number;
  weaknessRate?: number;

  weaknessConfidenceAverage: number;
  evidenceQuality?: 'low' | 'medium' | 'high';

  conflictStatus?:
    | 'none'
    | 'minor'
    | 'significant';

  rankingStatus?:
    | 'likely_weakness'
    | 'unstable'
    | 'needs_more_evidence'
    | 'improving_but_unstable';

  supportingEvidenceIds: string[];
  counterEvidenceIds?: string[];

  reasons: {
    summary: string;
    evidenceIds: string[];
  }[];

  candidateAction?:
    | 'training'
    | 'diagnostic_verification'
    | 'retest'
    | 'transfer_test'
    | 'observe';

  candidateTrainingFocus?: string;

  evaluationWindow?: {
    from: string;
    to: string;
  };
};
```

Phase 3.1 当前结构与长期结构的兼容关系：

| Phase 3.1 字段 | Phase 8+ 方向 |
| --- | --- |
| `ability` | `abilityId` + 展示名 |
| `priority` | `priorityScore` |
| `averageConfidence` | `weaknessConfidenceAverage` + Evidence Quality |
| `reasons: string[]` | `reasons: { summary; evidenceIds }[]` |
| `suggestedTrainingFocus` | `candidateTrainingFocus` |

## 十三、模型关系（Model Relationship）

系统关系：

```text
Ability Evidence
↓
Weakness Ranking
↓
候选薄弱能力 / 候选问题模式
↓
Training Plan / Personalized Next Task
↓
具体训练、复测或验证任务
```

Evaluation 负责长期能力状态判断。

Student Profile 负责保存长期状态。

Weakness Ranking 只提供当前行动候选。

## 十四、Debug 输出要求（Debug Output）

`pnpm run debug:ability-evidence` 应输出 Weakness Ranking。

示例：

```text
Top Weakness
------------
1. 推理
   priority: 34.1
   weaknessCount: 3
   positiveCount: 0
   insufficientCount: 0
   averageConfidence: 0.82
   reasons:
   - 多次出现文本依据不足。
   - 多次出现推理链不完整。
   suggestedTrainingFocus: 文本线索提取 + 推理链表达训练
```

Phase 3.1 Debug 输出继续使用当前字段，不要求输出 Phase 8+ 扩展结构。

## 十五、验收标准（Acceptance Criteria）

Weakness Ranking Model 在 Phase 3.1 中验收标准：

- 能从 `AbilityEvidence[]` 输出 Top 1-3。
- `insufficient` 不作为 weakness 主证据。
- 每个 ranking item 都包含 `reasons`。
- 每个 ranking item 都包含 `suggestedTrainingFocus`。
- 多条 weakness 的能力应排在单条 weakness 前面。
- 有多条 positive 的能力不应被过度排高。
- Debug 输出可读，便于家长和开发者理解。
- `pnpm run debug:ability-evidence` 的现有验收逻辑继续有效。

## 十六、底层约束（Core Constraints）

Weakness Ranking 不创造长期能力结论。

它只能：

- 聚合当前时间窗口内有效的 Ability Evidence
- 识别重复出现的能力问题和表现模式
- 比较候选问题的当前行动优先级
- 提供可追溯的排序理由
- 向 Training Plan 提供候选训练焦点或验证需求

它不得：

- 把 `insufficient` 当作能力薄弱
- 仅按 Evidence 数量判断能力高低
- 把单次 Root Cause Hypothesis 当作稳定薄弱点
- 绕过 Evaluation 修改 Student Profile
- 直接决定具体训练任务
- 给学生输出固定能力标签

## 十七、最终原则（Final Principle）

Weakness Ranking 的最终原则是：

> 排序是为了提出当前最值得关注的候选问题，不是给学生贴长期能力标签。

Phase 3.1 的排序只是一种基于当前 Evidence 的行动建议。真正的能力状态仍需要 Student Profile、Training、Retest 和 Evaluation 在后续阶段共同确认。
