# Phase 8.1.1：证据评估最小闭环（Evidence Evaluation Minimum Loop）

## 一、阶段目标

Phase 8.1.1 只解决一个问题：

```text
多条 AbilityEvidence 能否被评估为一个克制、可追溯的 EvaluationResult。
```

本阶段不更新 StudentAbilityProfile。

本阶段不决定画像如何变化。

本阶段只回答：

- 当前证据是否足够。
- 当前证据是否支持改善迹象。
- 当前证据是否存在冲突。
- 当前证据是否需要继续训练、复测、迁移验证或人工复核。

## 二、所属关系

Phase 8.1.1 属于 Phase 8.1 的第一个子模块。

完整 Phase 8.1 链路是：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

本阶段只完成其中第一段：

```text
AbilityEvidence[]
-> EvaluationResult
```

## 三、输入

最小输入：

- `AbilityEvidence[]`
- `studentId`
- `targetAbilityId` 或 legacy `ability`

兼容说明：

当前代码中部分 Evidence 仍可能使用：

```ts
ability: string
```

Phase 8.1.1 暂不强制修改旧 Schema。

实现时可以通过 normalize / adapter 做兼容映射：

```text
ability -> abilityId / abilityLabel
id -> evidenceId
source / taskId / diagnosisId -> evidenceLinks
```

## 四、输出

输出一个稳定结构的 `EvaluationResult`。

最小结构建议：

```ts
type EvidenceSufficiency =
  | 'insufficient'
  | 'limited'
  | 'sufficient';

type GrowthLevel =
  | 'unconfirmed'
  | 'early_signal'
  | 'improving'
  | 'stable'
  | 'fluctuating';

type EvaluationNextAction =
  | 'collect_more_evidence'
  | 'continue_training'
  | 'independent_retest'
  | 'transfer_test'
  | 'maintenance'
  | 'human_review';

type EvaluationResult = {
  evaluationId: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;

  evidenceSufficiency: EvidenceSufficiency;
  growthLevel: GrowthLevel;

  weaknessEvidenceCount: number;
  positiveEvidenceCount: number;
  growthEvidenceCount: number;
  insufficientEvidenceCount: number;

  hasIndependentRetestEvidence: boolean;
  hasTransferEvidence: boolean;
  conflictStatus: 'none' | 'minor' | 'significant';

  confidence: number;
  summary: string;
  limitations: string[];
  nextAction: EvaluationNextAction;

  evidenceLinks: string[];
  createdAt: string;
};
```

## 五、最小闭环

本阶段最小闭环：

```text
输入 AbilityEvidence[]
↓
过滤当前 ability 的有效证据
↓
统计 positive / weakness / growth / insufficient
↓
判断证据充分性
↓
判断是否存在改善迹象
↓
判断是否存在证据冲突
↓
输出 EvaluationResult
```

## 六、判断规则

### 1. insufficient 不参与成长判断

`insufficient` 可以被统计，但不能作为 weakness、positive 或 growth 的主证据。

如果全部 Evidence 都是 insufficient：

```text
evidenceSufficiency = 'insufficient'
growthLevel = 'unconfirmed'
nextAction = 'collect_more_evidence'
```

### 2. 单次 positive 不等于能力提升

单次较好表现可以形成 positive Evidence。

但不能直接输出：

```text
growthLevel = 'stable'
```

更稳妥的输出是：

```text
growthLevel = 'early_signal'
```

或：

```text
growthLevel = 'unconfirmed'
```

### 3. growth 必须有比较基础

如果没有历史 weakness 或 baseline Evidence，不能仅凭一次好答案判断为 growth。

没有比较基础时，最多输出 positive 信号。

### 4. 独立复测证据价值高于训练内证据

如果 Evidence 中存在独立复测或迁移证据，可以提高 EvaluationResult 的可信度。

但一次复测仍然不等于长期稳定提升。

### 5. 冲突证据必须保留不确定性

如果同一能力同时存在明显 weakness 和 positive / growth Evidence：

```text
conflictStatus = 'significant'
growthLevel = 'fluctuating'
nextAction = 'independent_retest' 或 'human_review'
```

## 七、Debug 验收案例

Phase 8.1.1 至少覆盖 4 组 Debug Case。

### Case 1：全部证据不足

输入：

```text
insufficient x 2
```

预期：

```text
evidenceSufficiency = 'insufficient'
growthLevel = 'unconfirmed'
nextAction = 'collect_more_evidence'
```

### Case 2：仍以 weakness 为主

输入：

```text
weakness x 3
positive x 0
growth x 0
```

预期：

```text
evidenceSufficiency = 'sufficient'
growthLevel = 'unconfirmed'
nextAction = 'continue_training'
```

### Case 3：出现早期改善迹象

输入：

```text
weakness x 2
growth x 1
```

预期：

```text
evidenceSufficiency = 'limited' 或 'sufficient'
growthLevel = 'early_signal'
nextAction = 'independent_retest'
```

### Case 4：证据冲突

输入：

```text
weakness x 2
positive x 2
growth x 1
```

预期：

```text
conflictStatus = 'minor' 或 'significant'
growthLevel = 'fluctuating'
nextAction = 'independent_retest' 或 'human_review'
```

## 八、验收标准

运行 Debug 后，应能证明：

1. 系统可以读取多条 AbilityEvidence。
2. 系统可以按目标 ability 聚合证据。
3. insufficient 不会被误判为能力薄弱或能力成长。
4. 单次 positive 不会被误判为稳定提升。
5. 有历史 weakness 和新 growth 时，可以输出早期改善迹象。
6. 正反 Evidence 冲突时，可以输出 fluctuating 或 review 方向。
7. 输出的 EvaluationResult 结构稳定。
8. EvaluationResult 必须包含 evidenceLinks。

## 九、本阶段不做

Phase 8.1.1 不做：

- 不生成 ProfileUpdateDecision。
- 不更新 StudentAbilityProfile。
- 不接数据库。
- 不做 UI。
- 不做长期成长报告。
- 不做成长曲线。
- 不证明学生能力已经提升。
- 不重构 Phase 1-7 Runtime。
- 不强制修改 AbilityEvidence Schema。

## 十、建议新增内容

代码实现阶段可以新增：

```text
src/ai/schemas/evaluationResult.schema.ts
src/ai/agents/evaluationAgent.ts
src/ai/tests/runPhase811EvidenceEvaluationDebug.ts
```

建议新增 npm script：

```json
{
  "debug:phase8-1-1": "tsx src/ai/tests/runPhase811EvidenceEvaluationDebug.ts"
}
```

## 当前工程结果

当前验收结果：

```text
PASS
```

已实现：

```text
src/ai/schemas/evaluationResult.schema.ts
src/ai/agents/evaluationAgent.ts
src/ai/tests/runPhase811EvidenceEvaluationDebug.ts
```

已跑通：

```text
debug:phase8-1-1  PASS
```

当前结论：

```text
AbilityEvidence[]
可以稳定生成 EvaluationResult，
并且 EvaluationResult 不直接改变 StudentAbilityProfile。
```

## 十一、完成定义

Phase 8.1.1 完成的标准是：

```text
AbilityEvidence[]
可以稳定生成 EvaluationResult，
并且 EvaluationResult 不直接改变 StudentAbilityProfile。
```

一句话定义：

> Phase 8.1.1 是在 Evidence 和 Profile 之间建立第一道评估闸门，防止单条或低质量 Evidence 直接改变长期学生画像。
