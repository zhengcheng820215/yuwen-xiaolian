# Phase 3 Growth Loop

## 文档定位

本文档记录 Phase 3 的完整能力成长闭环。

Phase 3 的目标不是做一个刷题系统，而是建立一个能帮助学生持续成长的最小闭环：

```text
发现问题
-> 制定方案
-> 执行训练
-> 验证改善
-> 沉淀证据
```

## 产品目标

帮助学生在语文学习中发现真实能力薄弱点，并围绕薄弱点制定可执行训练计划，再通过训练证据和复测证据验证是否出现改善迹象。

Phase 3 完成后，产品应第一次具备：

```text
发现问题 -> 解决问题 -> 验证是否解决
```

这也是从 AI 诊断工具走向 AI 学习陪伴系统的关键分界。

## 完整链路

```text
Diagnosis
-> Ability Evidence
-> Top Weakness
-> Training Plan
-> Training Execution
-> Training Evidence
-> Retest Evidence
-> Ability Update
```

说明：

当前 `Ability Update` 指 evidence 层更新，即 Ability Evidence / Ability Evidence Summary 被更新；不等同于正式 Student Profile / Ability State 更新。

## 代码与命令对照

| Phase | 核心模块 | Debug 命令 |
| --- | --- | --- |
| Phase 1.0 | 工程与产品基础能力基线 | `pnpm run build` |
| Phase 2.1 | `questionMetadataAgent` | `pnpm run debug:question-metadata` |
| Phase 2.2 | Question Metadata 验收与冻结记录 | `pnpm run debug:question-metadata` |
| Phase 3.1 | `abilityEvidenceExtractor`, `weaknessRankingAgent` | `pnpm run debug:ability-evidence` |
| Phase 3.2 | `trainingPlanAgent` | `pnpm run debug:training-plan` |
| Phase 3.3 | `trainingEvaluationAgent` | `pnpm run debug:training-evidence` |
| Phase 4.1 | `studentAbilityProfileAgent` | `pnpm run debug:student-profile` |

## Phase 3.1：发现问题

目标：

把单次 Diagnosis Result 转换为可累计的 Ability Evidence，并基于多条 evidence 生成 Top Weakness。

链路：

```text
Diagnosis Result
-> Ability Evidence
-> Evidence Summary
-> Weakness Ranking
```

核心产物：

- `AbilityEvidence`
- `AbilityEvidenceSummary`
- `WeaknessRankingItem`

验收重点：

- 能从诊断结果生成 evidence。
- 能区分 weakness / positive / growth / insufficient。
- `insufficient` 不作为薄弱点主证据。
- 能输出 Top 1-3 Weakness。
- 每个 Weakness 都有 evidence 支撑。

Debug：

```bash
pnpm run debug:ability-evidence
```

## Phase 3.2：制定方案

目标：

基于 Phase 3.1 的 Top Weakness，生成 3 天阶段训练计划。

链路：

```text
Top Weakness
-> Training Plan
-> Day 1 / Day 2 / Day 3 Tasks
```

核心产物：

- `TrainingPlan`
- `TrainingPlanDay`
- `evidence_links`

验收重点：

- 能说明当前优先训练能力。
- 能说明为什么练这个能力。
- 能生成 3 天训练计划。
- 每一天都有训练目标、任务、成功标准。
- 每一天能追溯到 evidence。
- 不复用旧的单题 `trainingAgent` 作为核心。

Debug：

```bash
pnpm run debug:training-plan
```

Demo：

```text
/#/training-plan-demo
```

## Phase 3.3：验证改善

目标：

让训练计划进入执行，基于学生训练回答和复测回答生成新的 Ability Evidence。

链路：

```text
Training Plan
-> Day 1 Task
-> Student Training Answer
-> Training Evidence
-> Retest Question
-> Student Retest Answer
-> Retest Evidence
-> Updated Ability Evidence
```

核心产物：

- `TrainingEvidenceLoopInput`
- `TrainingTaskEvaluation`
- `RetestEvaluation`
- `TrainingEvidenceLoopResult`
- `source='training'` 的 Ability Evidence
- `source='retest'` 的 Ability Evidence

验收重点：

- 能模拟学生完成训练任务。
- 能评估训练回答。
- 能生成 training evidence。
- 能模拟复测回答。
- 能生成 retest evidence。
- 能判断原薄弱点是否有改善迹象。
- 能把新增 evidence 合并回 Ability Evidence Summary。

Debug：

```bash
pnpm run debug:training-evidence
```

## 当前 Phase 3 边界

Phase 3 当前只验证能力成长闭环，不做以下内容：

- 不做完整课程体系。
- 不做真实题库规模化建设。
- 不做排行榜。
- 不做复杂奖励系统。
- 不做家长端。
- 不做长期成长曲线。
- 不证明学生长期能力已经真实提升。

长期提升需要持续任务、持续 evidence 和真实复测数据共同验证。

## 当前 UI 原则

工程 Demo 阶段 UI 只服务验收：

- 非必要图标不保留。
- 非关键信息尽量精简。
- 不突出旧的刷题、错题、等级经验体系。
- 页面优先回答“当前链路是否跑通”。
- 数据结构稳定优先于视觉丰富度。

## Phase 3 完成判断

当系统能够完成以下链路时，Phase 3 的最小目标成立：

```text
一次诊断发现薄弱点
-> 多条 evidence 排出 Top Weakness
-> Top Weakness 生成训练计划
-> 学生完成一天训练
-> 系统生成 training evidence
-> 学生完成复测
-> 系统生成 retest evidence
-> Ability Evidence 被更新
```

这里的“Ability Evidence 被更新”仅指证据层更新；正式能力画像更新仍属于后续阶段。

此时产品具备最小的能力成长闭环：

```text
发现问题 -> 制定方案 -> 执行训练 -> 验证改善 -> 记录成长
```

## 下一步方向

Phase 3 之后，不建议立即扩展大题库或复杂 UI。

更合理的下一步是：

1. 设计最小 Ability Update 视图。
2. 明确 evidence 层更新如何进入 Student Profile / Ability State。
3. 再考虑真实题目和持久化。
4. 最后再扩展训练交互和长期成长曲线。

当前 Phase 3.3 已接入页面 Demo：

```text
/#/training-evidence-demo
```
