# Phase 8.1.2：画像更新决策最小闭环（Profile Update Decision Minimum Loop）

## 一、阶段目标

Phase 8.1.2 只解决一个问题：

```text
EvaluationResult 能否被转化为一个明确、克制、可执行的 ProfileUpdateDecision。
```

本阶段不重新评估 AbilityEvidence。

本阶段不直接修改 StudentAbilityProfile。

本阶段只回答：

- 当前评估结果是否允许画像变化。
- 如果允许变化，变化类型是什么。
- 如果不允许变化，应保持不变、追加证据、请求复测还是人工复核。
- 画像执行层可以依据什么规则安全更新。

## 二、所属关系

Phase 8.1.2 属于 Phase 8.1 的第二个子模块。

完整 Phase 8.1 链路是：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

本阶段只完成其中第二段：

```text
EvaluationResult
-> ProfileUpdateDecision
```

## 三、输入

最小输入：

- `EvaluationResult`
- `currentStudentAbilityProfile`

可选输入：

- 当前 ability 的旧状态
- 当前 ability 的历史 confidence
- 当前 ability 的待验证事项

输入边界：

```text
Profile Decision 不直接读取原始 Student Answer。
Profile Decision 不重新聚合 AbilityEvidence。
Profile Decision 不重新判断 rootCause。
```

它只消费已经形成的 `EvaluationResult`。

## 四、输出

输出一个稳定结构的 `ProfileUpdateDecision`。

最小结构建议：

```ts
type ProfileUpdateAction =
  | 'no_change'
  | 'append_evidence_only'
  | 'update_confidence'
  | 'update_status'
  | 'mark_fluctuating'
  | 'request_retest'
  | 'human_review';

type ProfileUpdateDecision = {
  decisionId: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;

  action: ProfileUpdateAction;
  reason: string;

  fromStatus?: string;
  toStatus?: string;
  confidenceDelta?: number;

  appendEvidenceIds: string[];
  pendingVerification?: string[];

  warnings: string[];
  evidenceLinks: string[];
  createdAt: string;
};
```

## 五、最小闭环

本阶段最小闭环：

```text
输入 EvaluationResult
↓
读取 evidenceSufficiency / growthLevel / conflictStatus / nextAction
↓
判断是否允许画像状态变化
↓
生成 ProfileUpdateDecision
↓
输出可被 Profile Runtime 执行的 action
```

## 六、决策规则

### 1. 证据不足时不更新长期状态

如果：

```text
evidenceSufficiency = 'insufficient'
```

则建议：

```text
action = 'append_evidence_only' 或 'request_retest'
```

不能输出：

```text
action = 'update_status'
```

### 2. 单次 early_signal 不直接升级能力状态

如果：

```text
growthLevel = 'early_signal'
```

则建议：

```text
action = 'update_confidence' 或 'request_retest'
```

不能直接宣布长期能力提升。

### 3. improving 可以更新状态，但必须保留限制

如果：

```text
growthLevel = 'improving'
evidenceSufficiency = 'sufficient'
conflictStatus = 'none' 或 'minor'
```

可以输出：

```text
action = 'update_status'
toStatus = 'improving'
```

但仍应记录：

```text
pendingVerification
```

### 4. fluctuating 应标记不稳定

如果：

```text
growthLevel = 'fluctuating'
```

则建议：

```text
action = 'mark_fluctuating'
```

或：

```text
action = 'request_retest'
```

不应直接升级画像状态。

### 5. significant conflict 进入复核或复测

如果：

```text
conflictStatus = 'significant'
```

则建议：

```text
action = 'human_review'
```

或：

```text
action = 'request_retest'
```

## 七、Debug 验收案例

Phase 8.1.2 至少覆盖 5 组 Debug Case。

### Case 1：证据不足

输入：

```text
evidenceSufficiency = 'insufficient'
growthLevel = 'unconfirmed'
```

预期：

```text
action = 'append_evidence_only' 或 'request_retest'
```

### Case 2：早期改善迹象

输入：

```text
evidenceSufficiency = 'limited'
growthLevel = 'early_signal'
```

预期：

```text
action = 'update_confidence' 或 'request_retest'
```

### Case 3：改善较明确

输入：

```text
evidenceSufficiency = 'sufficient'
growthLevel = 'improving'
conflictStatus = 'none'
```

预期：

```text
action = 'update_status'
toStatus = 'improving'
```

### Case 4：表现波动

输入：

```text
growthLevel = 'fluctuating'
conflictStatus = 'minor'
```

预期：

```text
action = 'mark_fluctuating'
```

### Case 5：明显冲突

输入：

```text
conflictStatus = 'significant'
```

预期：

```text
action = 'human_review' 或 'request_retest'
```

## 八、验收标准

运行 Debug 后，应能证明：

1. 系统可以读取 EvaluationResult。
2. 系统可以生成稳定 ProfileUpdateDecision。
3. 证据不足时不会更新长期状态。
4. early_signal 不会被误判为能力稳定提升。
5. improving 可以形成受控的状态更新决策。
6. fluctuating 可以形成不稳定标记。
7. significant conflict 可以进入复测或人工复核。
8. ProfileUpdateDecision 必须包含 reason 和 evidenceLinks。

## 九、本阶段不做

Phase 8.1.2 不做：

- 不读取原始学生答案。
- 不重新生成 EvaluationResult。
- 不重新聚合 AbilityEvidence。
- 不更新 StudentAbilityProfile。
- 不接数据库。
- 不做 UI。
- 不做长期成长报告。
- 不证明学生能力已经提升。
- 不重构 Phase 1-7 Runtime。

## 十、建议新增内容

代码实现阶段可以新增：

```text
src/ai/schemas/profileUpdateDecision.schema.ts
src/ai/agents/profileUpdateDecisionAgent.ts
src/ai/tests/runPhase812ProfileDecisionDebug.ts
```

建议新增 npm script：

```json
{
  "debug:phase8-1-2": "tsx src/ai/tests/runPhase812ProfileDecisionDebug.ts"
}
```

## 当前工程结果

当前验收结果：

```text
PASS
```

已实现：

```text
src/ai/schemas/profileUpdateDecision.schema.ts
src/ai/agents/profileUpdateDecisionAgent.ts
src/ai/tests/runPhase812ProfileDecisionDebug.ts
```

已跑通：

```text
debug:phase8-1-2  PASS
```

当前结论：

```text
EvaluationResult
可以稳定生成 ProfileUpdateDecision，
并且 ProfileUpdateDecision 不直接修改 StudentAbilityProfile。
```

## 十一、完成定义

Phase 8.1.2 完成的标准是：

```text
EvaluationResult
可以稳定生成 ProfileUpdateDecision，
并且 ProfileUpdateDecision 不直接修改 StudentAbilityProfile。
```

一句话定义：

> Phase 8.1.2 是在评估结果和画像更新之间建立决策闸门，防止评估结论未经决策约束就直接改变学生长期画像。
