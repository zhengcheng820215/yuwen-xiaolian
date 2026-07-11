# Phase 8.1.3：画像决策执行最小闭环（Profile Decision Execution Minimum Loop）

## 一、阶段目标

Phase 8.1.3 只解决一个问题：

```text
StudentAbilityProfile 能否只按照 ProfileUpdateDecision 执行更新，而不是自行重新解释 Evidence。
```

本阶段不生成 EvaluationResult。

本阶段不生成 ProfileUpdateDecision。

本阶段只回答：

- Profile Runtime 是否能读取合法决策。
- Profile Runtime 是否能按 action 更新或保持不变。
- Profile Runtime 是否能追加 Evidence 引用。
- Profile Runtime 是否避免自行判断能力是否提升。

## 二、所属关系

Phase 8.1.3 属于 Phase 8.1 的第三个子模块。

完整 Phase 8.1 链路是：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

本阶段只完成其中第三段：

```text
StudentAbilityProfile
+ ProfileUpdateDecision
-> UpdatedStudentAbilityProfile
```

## 三、输入

最小输入：

- `currentStudentAbilityProfile`
- `ProfileUpdateDecision`

输入边界：

```text
Profile Runtime 不直接读取 AbilityEvidence[]。
Profile Runtime 不直接读取 EvaluationResult 后自行决策。
Profile Runtime 不重新判断 growthLevel。
Profile Runtime 不重新计算 conflictStatus。
```

它只执行已经形成的 `ProfileUpdateDecision`。

## 四、输出

输出：

```ts
type ProfileDecisionExecutionResult = {
  studentId: string;
  abilityId: string;
  action: string;
  beforeProfile: StudentAbilityProfile;
  afterProfile: StudentAbilityProfile;
  appliedDecisionId: string;
  changedFields: string[];
  warnings: string[];
};
```

其中：

- `beforeProfile` 用于 Debug 对照。
- `afterProfile` 是执行后的画像。
- `changedFields` 必须说明具体改了什么。
- 如果 action 不允许状态变化，`changedFields` 应保持受控。

## 五、最小闭环

本阶段最小闭环：

```text
输入 StudentAbilityProfile
+ ProfileUpdateDecision
↓
校验 decision 是否属于当前 student / ability
↓
按 action 执行最小更新
↓
记录 changedFields
↓
输出 UpdatedStudentAbilityProfile
```

## 六、执行规则

### 1. no_change

如果：

```text
action = 'no_change'
```

则：

```text
StudentAbilityProfile 状态不变。
可以记录本次 decision 已被处理。
```

### 2. append_evidence_only

如果：

```text
action = 'append_evidence_only'
```

则只能：

```text
追加 evidenceLinks / lastObservedAt / history item
```

不能修改：

```text
abilityStatus
growthStage
longTermLevel
```

### 3. update_confidence

如果：

```text
action = 'update_confidence'
```

则只能更新置信度或待验证信息。

不能直接升级为稳定提升。

### 4. update_status

如果：

```text
action = 'update_status'
```

则可以按 `toStatus` 更新当前能力状态。

但必须保留：

```text
evidenceLinks
appliedDecisionId
pendingVerification
```

### 5. mark_fluctuating

如果：

```text
action = 'mark_fluctuating'
```

则画像应表达：

```text
当前表现不稳定 / 需要继续验证
```

而不是：

```text
能力已经提升
```

### 6. request_retest

如果：

```text
action = 'request_retest'
```

则画像应增加待复测需求。

不应修改长期能力状态。

### 7. human_review

如果：

```text
action = 'human_review'
```

则画像应标记待人工复核。

不应自动更新长期能力状态。

## 七、Debug 验收案例

Phase 8.1.3 至少覆盖 5 组 Debug Case。

### Case 1：只追加证据

输入：

```text
action = 'append_evidence_only'
```

预期：

```text
evidenceLinks 增加
长期状态不变
```

### Case 2：更新置信度

输入：

```text
action = 'update_confidence'
confidenceDelta = 0.1
```

预期：

```text
confidence 变化
abilityStatus 不变
```

### Case 3：更新状态为 improving

输入：

```text
action = 'update_status'
toStatus = 'improving'
```

预期：

```text
abilityStatus = 'improving'
evidenceLinks 保留
appliedDecisionId 保留
```

### Case 4：标记波动

输入：

```text
action = 'mark_fluctuating'
```

预期：

```text
abilityStatus = 'fluctuating' 或 pendingVerification 增加
不输出 stable
```

### Case 5：请求复测

输入：

```text
action = 'request_retest'
```

预期：

```text
pendingVerification 增加复测需求
长期状态不变
```

## 八、验收标准

运行 Debug 后，应能证明：

1. Profile Runtime 可以读取 ProfileUpdateDecision。
2. Profile Runtime 可以按 action 执行更新。
3. append_evidence_only 不会修改长期状态。
4. update_confidence 不会直接升级能力。
5. update_status 只按 toStatus 更新，不自行判断。
6. request_retest 只增加待验证需求。
7. human_review 不会自动修改长期能力状态。
8. 输出能展示 beforeProfile、afterProfile 和 changedFields。

## 九、本阶段不做

Phase 8.1.3 不做：

- 不生成 EvaluationResult。
- 不生成 ProfileUpdateDecision。
- 不重新读取 AbilityEvidence。
- 不重新判断能力是否提升。
- 不接数据库。
- 不做 UI。
- 不做长期成长报告。
- 不做成长曲线。
- 不重构 Phase 1-7 Runtime。

## 十、建议新增内容

代码实现阶段可以新增：

```text
src/ai/agents/profileUpdateExecutor.ts
src/ai/tests/runPhase813ProfileExecutionDebug.ts
```

建议新增 npm script：

```json
{
  "debug:phase8-1-3": "tsx src/ai/tests/runPhase813ProfileExecutionDebug.ts"
}
```

## 当前工程结果

当前验收结果：

```text
PASS
```

已实现：

```text
src/ai/agents/profileUpdateExecutor.ts
src/ai/tests/runPhase813ProfileExecutionDebug.ts
```

已跑通：

```text
debug:phase8-1-3  PASS
```

当前结论：

```text
StudentAbilityProfile
+ ProfileUpdateDecision
可以稳定生成 UpdatedStudentAbilityProfile，
并且 Profile Runtime 不自行重新解释 Evidence。
```

## 十一、完成定义

Phase 8.1.3 完成的标准是：

```text
StudentAbilityProfile
+ ProfileUpdateDecision
可以稳定生成 UpdatedStudentAbilityProfile，
并且 Profile Runtime 不自行重新解释 Evidence。
```

一句话定义：

> Phase 8.1.3 是让学生画像从“自主判断型对象”收紧为“受决策约束的状态执行对象”。
