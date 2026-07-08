# Weakness Ranking Model

## 一、文档定位

本文档定义 Phase 3.1 中如何基于 Ability Evidence 生成薄弱点排序。

Weakness Ranking 的目标不是给学生贴标签，而是回答：

```text
当前最应该优先训练哪 1-3 个能力点？
```

它服务于后续 Training Plan，不直接等同于长期能力画像。

## 二、输入与输出

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

### 输出

输出薄弱点排序：

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

## 三、排序原则

### 1. Evidence 优先

没有 evidence，不输出薄弱点。

### 2. 多次重复优先

同一能力多次出现 `weakness`，优先级高于单次 `weakness`。

### 3. 置信度优先

高置信度 weakness 的权重高于低置信度 weakness。

### 4. 最近表现优先

最近出现的 weakness 比很久以前的 weakness 更影响当前训练优先级。

Phase 3.1 可以暂不实现复杂时间衰减，但文档保留该原则。

### 5. 不把 insufficient 当作 weakness

`insufficient` 代表作答证据不足，不能直接证明能力薄弱。

但如果某个能力下长期出现 `insufficient`，可以作为“需要补充有效作答”的提示，而不是能力短板结论。

### 6. Positive 可以降低优先级

如果某能力同时有多条 `positive`，说明该能力并非完全薄弱。排序时可以降低其优先级，或提示“表现不稳定”。

## 四、Phase 3.1 最小评分规则

Phase 3.1 不需要复杂算法。

建议最小评分：

```text
priority =
  weaknessCount * 10
  + averageConfidence * 5
  - positiveCount * 3
```

规则说明：

- `weaknessCount` 是主因。
- `averageConfidence` 用于区分证据强弱。
- `positiveCount` 用于避免把已有正向证据的能力过度排高。
- `insufficientCount` 不直接加分。

如果两个能力分数接近，优先选择：

1. rootCause 更集中、重复度更高的能力。
2. 位于能力路径前置位置的能力。
3. 更影响后续学习任务的能力。

## 五、Reason 生成规则

每个 WeaknessRankingItem 必须包含 reasons。

Reason 应来自 Evidence，而不是空泛判断。

推荐 Reason：

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

## 六、Suggested Training Focus

Weakness Ranking 不生成完整训练计划，但必须给出下一步训练焦点。

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

## 七、Debug 输出要求

`npm run debug:ability-evidence` 应输出 Weakness Ranking。

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

## 八、验收标准

Weakness Ranking Model 在 Phase 3.1 中验收标准：

- 能从 Ability Evidence[] 输出 Top 1-3。
- `insufficient` 不作为 weakness 主证据。
- 每个 ranking item 都包含 reasons。
- 每个 ranking item 都包含 suggestedTrainingFocus。
- 多条 weakness 的能力应排在单条 weakness 前面。
- 有多条 positive 的能力不应被过度排高。
- Debug 输出可读，便于家长和开发者理解。

## 九、最终原则

Weakness Ranking 的最终原则是：

> 排序是为了决定下一步训练焦点，不是给学生贴长期能力标签。

Phase 3.1 的排序只是一种基于当前 evidence 的行动建议。真正的能力状态仍需要 Student Profile、Training、Retest 和 Evaluation 在后续阶段共同确认。
