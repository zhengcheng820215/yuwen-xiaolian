# Phase 6.3：能力变化评估最小闭环（Ability Change Evaluation）

## 一句话定义

基于训练前 Evidence、训练 / 任务执行 Evidence 和复测 Evidence，判断目标能力是否出现可解释的变化，并输出下一步学习决策。

## 阶段背景

Phase 6.1 已完成：

```text
LearningSessionMemory
-> RetestTask
```

Phase 6.2 已完成：

```text
RetestTask
+ Student Retest Answer
-> Diagnosis Runtime
-> Retest Evidence
-> updatedEvidence
-> Evidence Summary
-> Student Ability Profile
```

Phase 6.1 / 6.2 证明了复测任务可以生成，复测答案可以转化为 `source = retest` 的 Ability Evidence，并回流到能力画像。

但它们还没有回答 Phase 6 最核心的问题：

> 训练前、训练中、复测后，学生某项能力是否真的发生了变化？

因此 Phase 6.3 的目标不是继续生成新证据，而是消费已有证据，判断能力变化。

## 阶段目标

建立 Ability Change Evaluation 最小闭环：

```text
Before Evidence
+ Training / Task Execution Evidence
+ Retest Evidence
-> AbilityChangeEvaluation
-> Next Decision
```

本阶段要证明：

- 系统可以区分训练前、训练中、复测后的证据。
- 系统可以围绕同一个 `target_ability` 判断能力变化趋势。
- 系统可以识别“训练中改善但复测未迁移”的情况。
- 系统可以识别“仍然薄弱”“可能改善”“证据不足”“可以切换能力”等状态。
- 系统可以输出可解释的下一步学习决策。

## 核心问题

Phase 6.3 回答的问题是：

> 复测之后，目标能力到底有没有发生变化？

具体包括：

- 训练前该能力的证据状态是什么？
- 训练或任务执行中是否出现 growth / positive evidence？
- 复测中是否出现 retest growth / positive evidence？
- 复测是否证明能力迁移，还是只证明训练题表现改善？
- 现有证据是否足够判断能力变化？
- 下一步应该继续训练、重新复测，还是切换能力？

## 最小闭环

Phase 6.3 的最小链路为：

```text
previousEvidence
-> split before / training / retest evidence
-> evaluate target ability change
-> generate AbilityChangeEvaluation
-> generate Next Decision
-> Debug Report
```

本阶段不重新调用 Diagnosis Runtime。

本阶段只消费已经生成的 Ability Evidence。

## 输入

Phase 6.3 输入包括：

- `studentId`
- `targetAbility`
- `beforeEvidence`
- `trainingEvidence`
- `taskExecutionEvidence`
- `retestEvidence`
- `updatedEvidence`
- `studentAbilityProfile`

其中：

- `beforeEvidence` 表示训练前已有的目标能力证据；
- `trainingEvidence` 表示训练过程或训练任务中的表现证据；
- `taskExecutionEvidence` 表示 Personalized Task Execution 后生成的证据；
- `retestEvidence` 表示 Phase 6.2 生成的复测证据；
- `updatedEvidence` 表示当前完整证据池；
- `studentAbilityProfile` 表示复测后更新的学生能力画像。

最小 Debug 可以先使用 mock evidence，不要求接数据库。

Phase 6.3 最小实现中：

```text
training_summary = trainingEvidence + taskExecutionEvidence
```

也就是说，训练过程证据和个性化任务执行证据都属于“训练后、复测前”的表现记录。后续阶段可以再细分，但本阶段先合并为 `training_summary`，避免过早复杂化。

## 输出

Phase 6.3 输出 `AbilityChangeEvaluation`。

建议包含：

- `evaluation_id`
- `student_id`
- `target_ability`
- `before_summary`
- `training_summary`
- `retest_summary`
- `change_status`
- `change_reason`
- `evidence_basis`
- `confidence`
- `next_decision`
- `next_decision_reason`
- `validation`

## 建议新增 Schema

```ts
export type AbilityChangeStatus =
  | 'likely_improved'
  | 'not_transferred'
  | 'still_weak'
  | 'needs_more_evidence'
  | 'ready_to_switch_ability';

export type AbilityChangeNextDecision =
  | 'continue_training'
  | 'retest_again'
  | 'switch_ability'
  | 'collect_more_evidence';

export type AbilityChangeEvidenceSummary = {
  weakness_count: number;
  growth_count: number;
  positive_count: number;
  insufficient_count: number;
  evidence_ids: string[];
  key_observations: string[];
};

export type AbilityChangeEvaluation = {
  evaluation_id: string;

  student_id: string;

  target_ability: string;

  before_summary: AbilityChangeEvidenceSummary;

  training_summary: AbilityChangeEvidenceSummary;

  retest_summary: AbilityChangeEvidenceSummary;

  change_status: AbilityChangeStatus;

  change_reason: string;

  evidence_basis: string[];

  confidence: number;

  next_decision: AbilityChangeNextDecision;

  next_decision_reason: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

## 字段说明

| 字段 | 含义 |
| --- | --- |
| `evaluation_id` | 本次能力变化评估 ID |
| `student_id` | 学生 ID |
| `target_ability` | 本次评估的目标能力 |
| `before_summary` | 训练前目标能力证据摘要 |
| `training_summary` | 训练或任务执行中的目标能力证据摘要 |
| `retest_summary` | 复测中的目标能力证据摘要 |
| `change_status` | 本次能力变化判断结果 |
| `change_reason` | 为什么得出该变化判断 |
| `evidence_basis` | 支撑判断的证据说明 |
| `confidence` | 本次变化判断置信度 |
| `next_decision` | 下一步学习决策 |
| `next_decision_reason` | 为什么给出该下一步决策 |
| `validation` | Runtime 结构校验结果 |

## Change Status 定义

### likely_improved

表示学生在训练后出现改善迹象，并且复测中也出现 `growth` 或 `positive` evidence。

典型条件：

- before evidence 中存在 weakness；
- training / task execution 中出现 growth 或 positive；
- retest evidence 中出现 growth 或 positive；
- retest evidence 与 `target_ability` 一致；
- 复测 evidence 不是 insufficient。

注意：

`likely_improved` 不等于长期稳定掌握，只表示当前证据支持“可能已经改善”。

### not_transferred

表示学生在训练中出现改善，但复测中没有迁移成功。

典型条件：

- training / task execution 中出现 growth 或 positive；
- retest evidence 为 weakness；
- 或 retest evidence 显示学生回到原有薄弱表现；
- 说明训练题表现不能迁移到新题、新文本或新情境。

### still_weak

表示训练前、训练中或复测后仍持续出现 weakness evidence。

典型条件：

- before evidence 中存在 weakness；
- training / task execution 未出现有效 growth；
- retest evidence 仍为 weakness；
- 或目标能力同一 rootCause 反复出现。

### needs_more_evidence

表示当前证据不足或冲突，无法判断能力是否变化。

典型条件：

- before / training / retest 任一关键阶段缺少证据；
- retest evidence 为 insufficient；
- evidence ability 与 `target_ability` 不一致；
- evidence 数量太少；
- evidence 方向冲突，无法形成稳定判断。

### ready_to_switch_ability

表示目标能力已经出现较稳定的 positive / growth 证据，且当前画像中其他能力薄弱更突出。

典型条件：

- retest evidence 为 positive；
- training / task execution 中也存在 positive 或 growth；
- 目标能力近期 weakness 压力下降；
- Student Ability Profile 中其他能力成为更高优先级薄弱点。

注意：

`ready_to_switch_ability` 只表示可以降低当前能力训练优先级，不表示该能力永久掌握。

## Evidence Source 使用规则

Phase 6.3 必须区分不同 evidence source：

| Source | 含义 | 在变化判断中的作用 |
| --- | --- | --- |
| `diagnosis` | 普通题目诊断证据 | 主要用于表示训练前或真实题表现 |
| `training` | 训练过程证据 | 可表示改善信号，但不能单独证明迁移 |
| `retest` | 复测证据 | 用于判断训练后是否迁移，是 Phase 6.3 的关键证据 |

判断能力变化时，`retest` evidence 权重应高于 `training` evidence。

如果 training evidence 改善，但 retest evidence 失败，应优先判断为 `not_transferred`。

## Ability Change Evaluation Rules

### 规则一：只评估同一 target_ability

Phase 6.3 必须围绕单一目标能力评估。

进入评估的核心证据应满足：

```text
evidence.ability === targetAbility
```

如果存在其他能力证据，可以作为背景信息，但不能直接证明目标能力变化。

### 规则二：training_summary 合并训练与任务执行证据

Phase 6.3 最小实现中，`training_summary` 必须由以下两类证据合并生成：

```text
trainingEvidence + taskExecutionEvidence
```

这两类证据都表示复测前的训练表现。

如果它们出现 `growth` 或 `positive`，只能说明训练阶段出现改善信号，不能单独证明能力迁移。

### 规则三：复测证据优先

如果 retest evidence 与 training evidence 方向冲突，优先参考 retest evidence。

例如：

```text
training evidence = positive
retest evidence = weakness
```

应判断为：

```text
not_transferred
```

而不是：

```text
likely_improved
```

### 规则四：positive 不直接等于稳定掌握

一次 positive evidence 只能说明本次表现达到要求。

即使 retest evidence 为 positive，也只能输出：

- `likely_improved`
- 或在证据足够时输出 `ready_to_switch_ability`

不应输出“已经掌握”“长期稳定”等结论。

### 规则五：insufficient 不参与强弱判断

`insufficient` 表示证据不足。

它不能证明能力变强，也不能证明能力仍弱。

如果关键阶段只有 insufficient evidence，应输出：

```text
needs_more_evidence
```

### 规则六：同一 rootCause 反复出现代表仍需训练

如果 before、training、retest 中反复出现相同或相近 rootCause，应倾向判断：

```text
still_weak
```

或：

```text
not_transferred
```

具体取决于训练阶段是否曾出现改善信号。

### 规则七：证据不足不是 Runtime 失败

如果证据结构完整，但证据数量不足、复测缺失、复测为 insufficient 或证据方向冲突，本阶段不应让 Runtime 失败。

这种情况应输出：

```text
change_status = needs_more_evidence
```

或：

```text
change_status = not_transferred
```

只有缺少关键输入、无法生成结构化结果或 evidence schema 不可消费时，才应设置：

```text
validation.passed = false
```

## Next Decision 规则

### continue_training

适用：

- `change_status = still_weak`
- 或 `change_status = not_transferred`

说明：

继续围绕同一目标能力训练，必要时降低难度或调整训练方式。

### retest_again

适用：

- `change_status = likely_improved`
- 但复测证据数量不足；
- 或只有一次 retest growth，尚不能判断稳定。

说明：

再安排一题同能力、不同文本的复测，验证改善是否稳定。

### switch_ability

适用：

- `change_status = ready_to_switch_ability`

说明：

当前能力可降低优先级，进入下一项更突出的薄弱能力。

### collect_more_evidence

适用：

- `change_status = needs_more_evidence`

说明：

先收集更多有效作答或复测证据，再判断能力变化。

## REVIEW 与 FAIL 区分

Phase 6.3 应区分“结构失败”和“证据不足”。

### Runtime FAIL

以下情况属于 `validation.passed = false`：

- 缺少 `studentId`；
- 缺少 `targetAbility`；
- 没有任何可消费 Evidence；
- evidence 缺少必要字段；
- confidence 不在 0 到 1 之间；
- 无法生成 `change_status`；
- 无法生成 `next_decision`。

### 非阻断情况

以下情况不一定是 Runtime FAIL，但应体现在 `change_status` 或 `validation.issues` 中：

- retest evidence 缺失；
- retest evidence 为 insufficient；
- evidence 方向冲突；
- training evidence 改善但 retest evidence 失败；
- 目标能力以外的证据较多。

这些情况通常应输出：

- `needs_more_evidence`
- 或 `not_transferred`

而不是让 Runtime 失败。

## Debug Report 要求

新增 Debug 脚本建议：

```text
pnpm run debug:ability-change-evaluation
```

Debug Report 必须展示：

- Student ID
- Target Ability
- Before Evidence Summary
- Training / Task Execution Evidence Summary
- Retest Evidence Summary
- Change Status
- Change Reason
- Evidence Basis
- Confidence
- Next Decision
- Next Decision Reason
- Validation Issues
- PASS / FAIL

## 建议新增文件

```text
src/ai/schemas/abilityChangeEvaluation.schema.ts
src/ai/agents/abilityChangeEvaluationAgent.ts
src/ai/tests/runAbilityChangeEvaluationDebug.ts
```

建议新增脚本：

```text
debug:ability-change-evaluation
```

## Debug 样例建议

Phase 6.3 最小 Debug 至少包含 4 类样例：

### 样例一：likely_improved

```text
before: weakness
training: growth
retest: growth / positive
```

预期：

```text
change_status = likely_improved
next_decision = retest_again 或 switch_ability
```

### 样例二：not_transferred

```text
before: weakness
training: growth / positive
retest: weakness
```

预期：

```text
change_status = not_transferred
next_decision = continue_training
```

### 样例三：still_weak

```text
before: weakness
training: weakness
retest: weakness
```

预期：

```text
change_status = still_weak
next_decision = continue_training
```

### 样例四：needs_more_evidence

```text
before: weakness
training: insufficient
retest: insufficient / missing
```

预期：

```text
change_status = needs_more_evidence
next_decision = collect_more_evidence
```

## Definition of Done

Phase 6.3 完成标准：

1. 已定义 `AbilityChangeEvaluation` Schema。
2. 已实现 Ability Change Evaluation Agent。
3. Debug 能读取 before / training / task execution / retest evidence。
4. Debug 能围绕同一个 `targetAbility` 生成变化判断。
5. 能输出以下至少一种 `change_status`：
   - `likely_improved`
   - `not_transferred`
   - `still_weak`
   - `needs_more_evidence`
   - `ready_to_switch_ability`
6. 能输出 `next_decision`。
7. `change_reason` 必须引用 evidence basis。
8. `confidence` 必须是 0 到 1 之间的数字。
9. Debug Report 可以清楚展示判断依据。
10. Debug 输出 PASS。
11. `pnpm run build` 通过。

## 本阶段不包含

Phase 6.3 不做以下内容：

- 不重新调用 Diagnosis Runtime；
- 不生成新的 RetestTask；
- 不处理学生新答案；
- 不修改 Diagnosis Result Schema；
- 不修改 Ability Evidence Schema；
- 不接数据库；
- 不做正式 UI；
- 不生成长期成长报告；
- 不判断学生已经永久掌握某项能力；
- 不做复杂统计模型；
- 不做多学生对比；
- 不做家长端报告。

## 与前后阶段关系

Phase 6.3 位于 Retest Runtime 的变化判断层。

上游：

```text
Phase 6.1 RetestTask
Phase 6.2 RetestExecutionResult / Retest Evidence
```

本阶段：

```text
Ability Evidence
-> AbilityChangeEvaluation
-> Next Decision
```

下游可继续进入：

```text
Phase 6.4 Retest Acceptance / Phase 6 Summary
或
Phase 7 Long-term Student Growth Memory
```

## 验收结论口径

Phase 6.3 通过后，只能说明：

> 系统可以基于已有 Evidence 判断某项能力是否出现可解释的变化，并输出下一步学习决策。

Phase 6.3 不证明：

- 学生真实能力已经长期提升；
- 复测结果已经具备长期统计稳定性；
- 任务训练一定有效；
- AI 诊断在所有题目上都准确；
- Student Ability Profile 已经等同正式成长档案。

## 最终目标

Phase 6.3 的最终目标是让系统从“生成复测证据”进一步升级为：

```text
解释能力是否变化
```

这是 Phase 6 的核心价值。

因为产品真正关心的不是学生是否完成训练或复测，而是：

> 训练之后，能力有没有发生可验证、可解释、可继续追踪的变化？
