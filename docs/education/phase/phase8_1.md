# Phase 8.1：EvaluationResult / ProfileUpdateDecision 最小闭环（Evaluation and Profile Decision Minimum Loop）

## 一、阶段目标

Phase 8.1 只解决一个核心问题：

```text
AbilityEvidence 不能再直接改变 StudentAbilityProfile，
必须先经过 EvaluationResult 和 ProfileUpdateDecision。
```

核心链路：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

本阶段不证明长期学习效果。

本阶段只证明：

- 多条 AbilityEvidence 可以被评估。
- 评估结果可以形成明确的画像更新决策。
- StudentAbilityProfile 只执行合法决策。
- 证据不足、单次改善或证据冲突时，不会错误更新长期能力状态。

## 二、阶段背景

Phase 1-7 已经完成单次 Beta Learning Flow：

```text
Start Learning
-> Diagnosis
-> Ability Evidence
-> Personalized Training
-> Retest
-> AbilityChangeEvaluation
-> BetaLearningSessionResult
```

当前工程中仍存在早期最小实现链路：

```text
updatedEvidence
-> EvidenceSummary
-> StudentAbilityProfile
```

这条链路可以作为 Legacy-compatible Runtime 保留，但不能继续作为长期画像更新的唯一规则。

Phase 8.1 的价值是给 Evidence 和 Profile 之间补上一层最小评估与决策：

```text
Evidence
-> Evaluation
-> Profile Decision
-> Profile Update
```

## 三、最小功能闭环

### 输入

Phase 8.1 输入至少包括：

- `AbilityEvidence[]`
- `currentStudentAbilityProfile`

可选兼容输入：

- `AbilityChangeEvaluation`

### 兼容现有 Evidence

长期理想结构会使用：

```ts
type EvaluationEvidenceInput = {
  evidenceId: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;
  evidenceType: 'positive' | 'weakness' | 'growth' | 'insufficient';
  observation: string;
  confidence: number;
  source: {
    taskId?: string;
    diagnosisId?: string;
    sessionId?: string;
    taskRole?: 'diagnosis' | 'training' | 'retest' | 'transfer';
  };
  createdAt: string;
};
```

但 Phase 8.1 不要求立即修改现有 `AbilityEvidence` Schema。

当前代码仍使用：

```ts
ability: string
```

因此 Phase 8.1 应通过 adapter 或 normalize 函数从旧字段生成评估所需信息：

```text
ability -> abilityId / abilityLabel
id -> evidenceId
taskId / diagnosisId / source -> evidence source reference
```

### 处理过程

Phase 8.1 的最小处理过程：

1. 接收同一学生的一组 AbilityEvidence。
2. 按 abilityId / legacy ability 选择本次评估能力。
3. 排除或单独统计 insufficient Evidence。
4. 判断证据数量和证据类型。
5. 判断是否包含独立复测或迁移证据。
6. 判断 positive、weakness、growth Evidence 是否冲突。
7. 生成 EvaluationResult。
8. 根据 EvaluationResult 生成 ProfileUpdateDecision。
9. Profile Runtime 执行该 Decision。
10. 输出 updatedStudentAbilityProfile。

### 输出

Phase 8.1 输出：

```ts
type Phase81Result = {
  evaluationResult: EvaluationResult;
  profileUpdateDecision: ProfileUpdateDecision;
  updatedStudentAbilityProfile: StudentAbilityProfile;
};
```

同时 Debug 输出应保留：

- 输入 Evidence
- 当前 Profile
- EvaluationResult
- ProfileUpdateDecision
- 更新后 Profile

确保整条链路可以追溯。

## 四、EvaluationResult 最小结构

```ts
export type EvidenceSufficiency =
  | 'insufficient'
  | 'limited'
  | 'sufficient';

export type GrowthLevel =
  | 'unconfirmed'
  | 'early_signal'
  | 'improving'
  | 'stable'
  | 'fluctuating';

export type EvaluationNextAction =
  | 'collect_more_evidence'
  | 'continue_training'
  | 'independent_retest'
  | 'transfer_test'
  | 'maintenance'
  | 'human_review';

export type EvaluationResult = {
  evaluationId: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;

  evidenceLinks: string[];
  evidenceSufficiency: EvidenceSufficiency;
  growthLevel: GrowthLevel;

  positiveEvidenceCount: number;
  weaknessEvidenceCount: number;
  growthEvidenceCount: number;
  insufficientEvidenceCount: number;

  hasIndependentRetestEvidence: boolean;
  hasTransferEvidence: boolean;
  conflictStatus: 'none' | 'minor' | 'significant';

  confidence: number;
  summary: string;
  limitations: string[];
  nextAction: EvaluationNextAction;

  createdAt: string;
};
```

### EvaluationResult 职责

EvaluationResult 只回答：

- 当前有哪些证据；
- 证据是否充分；
- 当前最多能表达多强的成长判断；
- 证据是否冲突；
- 下一步需要什么。

EvaluationResult 不直接修改 StudentAbilityProfile。

Phase 8.1 可以保留 `stable` 类型，但默认不应轻易输出 `stable`。稳定提升判断应留给后续多 Session 阶段。

## 五、ProfileUpdateDecision 最小结构

```ts
export type ProfileUpdateAction =
  | 'no_change'
  | 'append_evidence_only'
  | 'update_confidence'
  | 'update_status'
  | 'mark_fluctuating'
  | 'request_retest'
  | 'human_review';

export type ProfileUpdateDecision = {
  decisionId: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;

  evaluationResultId: string;
  evidenceLinks: string[];

  action: ProfileUpdateAction;
  reason: string;

  proposedChanges?: {
    confidence?: number;
    status?: string;
    growthState?: string;
  };

  createdAt: string;
};
```

### ProfileUpdateDecision 职责

ProfileUpdateDecision 只回答：

```text
本次评估允许 Profile 做什么？
```

例如 `append_evidence_only` 表示：

- Evidence 可以进入历史；
- Profile 可以保存本次观察；
- 但长期能力状态和等级不变。

## 六、Profile 执行规则

Phase 8.1 必须建立硬规则：

```text
StudentAbilityProfile 只能消费 ProfileUpdateDecision。

它不能直接消费 EvaluationResult 后自行决定，
也不能直接根据单条 AbilityEvidence 更新长期状态。
```

### 不同 action 的最小行为

| action | 行为 |
| --- | --- |
| `no_change` | 保持 Profile 不变，仅返回当前 Profile 与原因 |
| `append_evidence_only` | 追加 evidenceLinks / evaluationResultId，长期状态不变 |
| `update_confidence` | 调整该能力判断置信度，不自动升级能力等级 |
| `update_status` | 在证据充分、冲突不显著时允许有限状态更新 |
| `mark_fluctuating` | 记录能力表现波动，不强行判断提升或退化 |
| `request_retest` | 记录待验证事项，下一步进入独立复测 |
| `human_review` | 保留当前状态，记录需要人工复核 |

Phase 8.1 不应重写现有 `studentAbilityProfileAgent.ts`。

建议新增最小执行器：

```text
applyProfileUpdateDecision(currentProfile, decision)
```

## 七、建议拆分

### Phase 8.1.1：Evidence Evaluation

```text
AbilityEvidence[]
-> EvaluationResult
```

目标：

- 能按 abilityId / legacy ability 评估一组 Evidence。
- 能判断证据充分性。
- 能识别证据冲突。
- 能输出克制的成长层级。
- 能给出下一步动作。

验收重点：

- 单条 Evidence 不得输出 stable。
- 只有 training evidence 不得确认长期提升。
- insufficient evidence 不得机械转成 weakness。

### Phase 8.1.2：Profile Decision

```text
EvaluationResult
-> ProfileUpdateDecision
```

目标：

- 把评估结果转换为明确的 Profile 更新动作。
- 证据不足时输出 `append_evidence_only`、`request_retest` 或 `no_change`。
- 证据冲突时输出 `mark_fluctuating`。
- 不让 Evaluation 直接改 Profile。

### Phase 8.1.3：Profile Decision Execution

```text
CurrentProfile
+ ProfileUpdateDecision
-> UpdatedProfile
```

目标：

- Profile 只执行 Decision。
- 未授权字段保持不变。
- 所有更新保留 evidenceLinks 和 evaluationResultId。
- 旧链路仍可运行，不破坏 Phase 1-7。

## 八、最小验收案例

Phase 8.1 至少覆盖 6 组 Debug Case。

### Case 1：证据不足

输入：

- 1 条 weakness Evidence
- 无复测
- 无迁移

期望：

- `evidenceSufficiency = insufficient | limited`
- `growthLevel = unconfirmed`
- `action = append_evidence_only | request_retest`
- Profile 长期状态不变

### Case 2：单次训练改善

输入：

- 1 条 weakness Evidence
- 1 条 training growth Evidence

期望：

- `growthLevel = early_signal`
- `hasIndependentRetestEvidence = false`
- `action = request_retest | append_evidence_only`
- 不得升级长期能力状态

### Case 3：训练后独立复测改善

输入：

- 1 条 weakness Evidence
- 1 条 training growth Evidence
- 1 条 retest positive Evidence

期望：

- `evidenceSufficiency = limited | sufficient`
- `growthLevel = improving`
- `action = update_confidence | update_status`
- 保留所有 evidenceLinks
- 不直接输出 stable

### Case 4：存在迁移证据

输入：

- 多条不同任务 Evidence
- 包含 retest Evidence
- 包含 transfer-like Evidence
- 表现一致

期望：

- `evidenceSufficiency = sufficient`
- `growthLevel = improving`
- `conflictStatus = none`
- 允许 `update_status`

说明：

Phase 8.1 可以保留 `stable` 类型，但 Debug 默认只要求支持 `improving`。`stable` 留到多 Session 阶段更稳。

### Case 5：证据冲突

输入：

- 2 条 positive
- 2 条 weakness
- 时间接近
- 任务角色相近

期望：

- `conflictStatus = significant`
- `growthLevel = fluctuating`
- `action = mark_fluctuating | request_retest`
- Profile 不升级

### Case 6：全部为 insufficient

输入：

- 空答案、纯数字或无效作答产生的 insufficient Evidence

期望：

- `evidenceSufficiency = insufficient`
- `growthLevel = unconfirmed`
- `nextAction = collect_more_evidence`
- `action = append_evidence_only | no_change`
- 不得形成 weakness 状态
- 不得改变 Profile 长期等级

## 九、正式验收标准

### 1. 数据契约验收

必须满足：

- EvaluationResult 有稳定结构。
- ProfileUpdateDecision 有稳定结构。
- 两者都有唯一 ID。
- 两者都保留 studentId、abilityId。
- 两者都保留 evidenceLinks。
- Decision 必须引用 evaluationResultId。
- 不使用自然语言作为唯一跨模块协议。

### 2. 职责边界验收

必须满足：

- AbilityEvidence 不直接修改 Profile。
- EvaluationResult 不直接修改 Profile。
- ProfileUpdateDecision 是画像更新的唯一新入口。
- Profile Runtime 不自行重新判断 Evidence。

### 3. 教育语义验收

必须满足：

- 单次表现不等于长期能力。
- 单次 growth Evidence 不等于能力提升。
- Training completed 不等于 growth confirmed。
- 无效答案不形成 weakness。
- 证据不足允许不更新。
- 证据冲突允许保留不确定性。
- Evaluation 必须表达 limitations。
- 长期结论必须有 evidenceLinks。

### 4. 运行闭环验收

必须能够完整执行：

```text
准备 Evidence
-> 运行 Evaluation
-> 输出 EvaluationResult
-> 运行 Decision
-> 输出 ProfileUpdateDecision
-> 执行 Profile Update
-> 输出 Updated Profile
```

并且每一步都可以单独 Debug。

### 5. 兼容性验收

必须满足：

- AbilityChangeEvaluation 不被删除。
- 现有 `updatedEvidence -> StudentAbilityProfile` 旧路径不被强制移除。
- 可以通过适配器将旧结果转换或补充为新结构。
- RealAIDiagnosisRuntime 不强制拆分。
- Phase 1-7 Debug / Demo 继续可运行。
- 不进行全量 Runtime 重构。

### 6. 工程验收

代码完成后至少执行：

```bash
npm run debug:phase8-1
npm run build
```

建议先只新增一个 Debug 命令：

```bash
npm run debug:phase8-1
```

该命令覆盖 6 个核心 Case。

现有核心 Debug 不应因 Phase 8.1 发生明显回归。

## 十、建议新增内容

Phase 8.1 建议新增：

```text
src/ai/schemas/evaluationResult.schema.ts
src/ai/schemas/profileUpdateDecision.schema.ts
src/ai/agents/evaluationAgent.ts
src/ai/agents/profileUpdateDecisionAgent.ts
src/ai/agents/profileUpdateExecutor.ts
src/ai/tests/runPhase81Debug.ts
```

新增 npm script：

```json
{
  "debug:phase8-1": "tsx src/ai/tests/runPhase81Debug.ts"
}
```

可选但不强制：

```text
src/ai/adapters/abilityChangeEvaluationAdapter.ts
```

## 十一、本阶段不做

Phase 8.1 不做：

- 不接数据库。
- 不做多 Session 历史。
- 不做正式成长报告。
- 不做成长曲线。
- 不做多学生支持。
- 不做完整长期成长算法。
- 不做复杂 LLM 评估。
- 不改页面。
- 不全面重命名。
- 不删除或重命名 AbilityChangeEvaluation。
- 不强制拆分 RealAIDiagnosisRuntime。
- 不重构 Phase 1-7 已验收 Runtime。
- 不重写 AbilityEvidence Schema。
- 不把 stable 作为默认输出目标。

## 十二、完成后可以宣称什么

Phase 8.1 完成后可以宣称：

```text
系统已经建立 Evidence 到长期画像之间的最小评估与决策层，
画像更新不再只能由 Evidence 直接触发。
```

还不能宣称：

- 系统已经具备完整长期成长评估。
- 系统已经支持多 Session 历史。
- 能力提升已经被长期验证。
- 已经具备成长报告或成长曲线。
- 已经完成正式学习记忆。

## 当前工程结果

当前验收结果：

```text
PASS
```

已新增 Schema：

```text
src/ai/schemas/evaluationResult.schema.ts
src/ai/schemas/profileUpdateDecision.schema.ts
```

已新增 Agent / Runtime：

```text
src/ai/agents/evaluationAgent.ts
src/ai/agents/profileUpdateDecisionAgent.ts
src/ai/agents/profileUpdateExecutor.ts
```

已新增 Debug：

```text
src/ai/tests/runPhase811EvidenceEvaluationDebug.ts
src/ai/tests/runPhase812ProfileDecisionDebug.ts
src/ai/tests/runPhase813ProfileExecutionDebug.ts
src/ai/tests/runPhase81Debug.ts
```

已新增 npm script：

```text
debug:phase8-1-1
debug:phase8-1-2
debug:phase8-1-3
debug:phase8-1
```

工程验收结果：

```text
debug:phase8-1-1  PASS
debug:phase8-1-2  PASS
debug:phase8-1-3  PASS
debug:phase8-1    PASS
build             PASS
```

当前已跑通的最小工程链路：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

通过依据：

- `AbilityEvidence[]` 可以生成稳定 `EvaluationResult`。
- `EvaluationResult` 可以生成稳定 `ProfileUpdateDecision`。
- `StudentAbilityProfile` 可以按 `ProfileUpdateDecision` 更新或保持不变。
- `append_evidence_only` 不会修改长期能力状态。
- `update_confidence` 不会直接宣布能力提升。
- `update_status` 只能按决策更新为 `improving`。
- `mark_fluctuating` 只表达波动和待验证，不输出稳定提升。
- `human_review` 和 `request_retest` 不会自动改变长期状态。

当前仍不包含：

- 不接数据库。
- 不接 UI。
- 不做多 Session 历史。
- 不做长期成长报告。
- 不做成长曲线。
- 不证明学生能力已经长期提升。

## 十三、完成定义

Phase 8.1 只有同时满足下面三条才算完成：

```text
AbilityEvidence[]
可以生成 EvaluationResult

EvaluationResult
可以生成 ProfileUpdateDecision

StudentAbilityProfile
可以按 Decision 更新或保持不变
```

最终一句话定义：

> Phase 8.1 的最小闭环，是让系统第一次能够基于多条能力证据形成克制评估，并通过明确决策控制学生画像是否以及如何更新。
