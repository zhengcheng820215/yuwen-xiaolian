# Growth Loop Overview

## 文档定位

本文档记录当前产品从工程基础到连续成长闭环的阶段脉络。

它不是某一个 Phase 的验收报告，而是用于回答：

```text
系统现在如何从诊断，走向训练，再走向持续理解学生？
```

当前主线是：

```text
诊断题目与学生答案
-> 生成能力证据
-> 聚合薄弱点
-> 制定训练计划
-> 执行训练与复测
-> 更新能力画像
-> 推荐下一次任务
```

## 产品目标

产品目标不是做一个单纯刷题工具，而是辅助学生在初中语文学习中持续发现能力薄弱点，并围绕薄弱点制定可验证的提升方案。

核心闭环是：

```text
发现问题 -> 制定方案 -> 执行训练 -> 验证改善 -> 沉淀成长记忆
```

完成这条链路后，系统才从“AI 诊断工具”进入“AI 学习陪伴系统”的雏形。

## Minimal Loop Principle

本系统采用最小闭环驱动开发。

任何复杂能力都必须拆解为可独立运行、可独立验收的最小闭环。

每个最小闭环只解决一个核心问题，并且必须明确：

- 输入是什么
- 输出是什么
- 处理什么
- 不处理什么
- 如何 Debug
- 如何验收

复杂系统不是一次性设计完整，而是由一组边界清晰的最小闭环逐步连接起来。

只要每个闭环足够单一，即使整体 Runtime 逐渐复杂，系统仍然可以保持可理解、可调试、可维护。

本项目的核心原则是：

> 模块可以复杂，但边界必须简单。  
> 代码可以复杂，但输入输出必须清楚。  
> AI 可以复杂，但输出必须进入结构化 Schema。  
> Runtime 可以变长，但每一步都必须可 Debug。

能力提升判断必须遵守底层约束：

> “能力提升”不是 AI 输出的描述字段，而是一个需要经过时间、多次表现和独立复测才能成立的状态。

因此，Growth Runtime 可以记录改善迹象和复测表现，但不能仅凭单次作答、单次训练或单次 AI 评价宣布能力已经提升。

## Current Growth Loop Decomposition

当前系统不是由一个大 Agent 完成全部能力，而是拆分为多个最小闭环：

1. Question Metadata Loop

```text
Question -> QuestionMetadata -> Metadata Validator
```

2. Diagnosis Evidence Loop

```text
DiagnosisResult -> AbilityEvidence -> EvidenceSummary
```

3. Student Profile Loop

```text
updatedEvidence -> StudentAbilityProfile
```

4. Personalized Task Loop

```text
StudentAbilityProfile + TopWeakness -> PersonalizedNextTask
```

5. Task Execution Loop

```text
PersonalizedNextTask + StudentAnswer -> DiagnosisRuntime -> newAbilityEvidence
```

6. Learning Session Loop

```text
PersonalizedTaskExecutionSummary x 3 -> LearningSessionMemory
```

7. Retest Loop

```text
LearningSessionMemory -> RetestTask -> RetestEvidence
```

每个闭环都可以单独运行、单独 Debug、单独验收。

多个闭环通过结构化数据连接，最终组成完整的 Growth Runtime。

## 阶段脉络

| Phase | 阶段定位 | 核心产物 | 验收入口 |
| --- | --- | --- | --- |
| Phase 1.0 | 工程与产品基础能力基线 | 前端工程、基础页面、AI 模块组织、Debug 能力 | `pnpm run build` |
| Phase 2.1 | Question Metadata Pattern Library v1 | 题型元数据识别与规则库 | `pnpm run debug:question-metadata` |
| Phase 2.2 | Question Metadata 验收与冻结 | Phase 2 元数据能力冻结记录 | `pnpm run debug:question-metadata` |
| Phase 3.1 | Ability Evidence Foundation | Diagnosis -> Ability Evidence -> Top Weakness | `pnpm run debug:ability-evidence` |
| Phase 3.2 | 阶段训练计划生成 | Top Weakness -> 3 天训练计划 | `pnpm run debug:training-plan` |
| Phase 3.3 | 训练执行与复测证据 | Training Evidence / Retest Evidence / Evidence Update | `pnpm run debug:training-evidence` |
| Phase 4.1 | Student Ability Profile | Evidence -> Student Ability Profile -> Next Training Direction | `pnpm run debug:student-profile` |
| Phase 4.2 | Real AI Diagnosis / Evidence Runtime | 真实 AI 诊断 Runtime 与 Evidence 链路 | `pnpm run debug:real-ai-diagnosis` |
| Phase 4.3 | Live AI Diagnosis Quality Evaluation | 真实 AI 诊断质量评估与人工复核门槛 | `pnpm run debug:live-ai-evaluation` |
| Phase 5.1 | Personalized Next Task | Student Ability Profile -> 下一次个性化任务 -> Evidence 更新 | `pnpm run debug:personalized-next-task` |
| Phase 5.2 | Personalized Task Execution Evidence | PersonalizedTask -> Student Answer -> 同能力 Evidence 更新 -> 下一步决策 | `pnpm run debug:personalized-task-execution` |
| Phase 5.3 | Learning Session Memory | 多次 Task Execution -> LearningSessionMemory -> Session Outcome | `pnpm run debug:learning-session` |
| Phase 6.1 | Retest Task Generation | LearningSessionMemory -> RetestTask | `pnpm run debug:retest-task` |
| Phase 6.2 | Retest Execution Evidence | RetestTask + Student Answer -> Retest Evidence -> Profile Update | `pnpm run debug:retest-execution` |
| Phase 6.3 | Ability Change Evaluation | Before / Training / Retest Evidence -> AbilityChangeEvaluation -> Next Decision | `pnpm run debug:ability-change-evaluation` |
| Phase 6 Summary | Retest / Evaluation Runtime 冻结 | Phase 6 复测与能力变化判断冻结记录 | `docs/education/phase/phase6_summary.md` |
| Phase 7.1 | Student Learning Entry | Start Learning -> First Question Diagnosis -> Initial Session State | `pnpm run debug:learning-entry` |
| Phase 7.2 | Personalized Training Flow | LearningEntryResult -> Personalized Training -> Evidence 回流 | `pnpm run debug:personalized-training-flow` |
| Phase 7.3 | Retest & Session Result Flow | PersonalizedTrainingFlowResult -> Retest -> Beta Session Result | `pnpm run debug:beta-learning-session-result` |
| Phase 7 Summary | Beta Learning Flow 冻结 | Phase 7 单次 Beta 学习闭环验收记录 | `docs/education/phase/phase7_summary.md` |

## 当前核心链路

```text
Question Metadata
-> Diagnosis Result
-> Ability Evidence
-> Evidence Summary
-> Top Weakness
-> Training Plan
-> Training Execution
-> Training Evidence
-> Retest Evidence
-> Student Ability Profile
-> Personalized Next Task
-> Personalized Task Execution Evidence
-> Learning Session Memory
-> Retest Task
-> Retest Execution Evidence
-> Ability Change Evaluation
-> Beta Learning Session Result
```

## Demo 演示入口

当前 Demo 只用于验证最小闭环，不代表正式产品 UI。

```text
/#/diagnosis-demo
/#/training-plan-demo
/#/training-evidence-demo
/#/student-profile-demo
/#/personalized-next-task-demo
/#/personalized-task-execution-demo
/#/beta-learning-entry-demo
/#/beta-personalized-training-demo
/#/beta-session-result-demo
```

## 当前边界

当前阶段重点是打通可验证的能力成长链路。

暂不追求：

- 完整题库。
- 数据库持久化。
- 家长端。
- 长期成长曲线。
- 奖励系统。
- 正式课程体系。
- 完整商业化 UI。

## 文档组织原则

- 单个 Phase 文档记录该阶段目标、输入、输出、链路、验收标准和边界。
- Acceptance Report 只记录已经执行过的验收结果。
- 本总览只记录阶段脉络，不替代具体 Phase 文档。
- 命令口径统一使用 `pnpm run ...`。

## 当前结论

当前 `phase` 目录已经形成较清晰的产品演进链路：

```text
工程基础
-> 题目理解
-> 能力证据
-> 训练计划
-> 训练验证
-> 学生画像
-> 真实 AI 质量评估
-> 下一次个性化任务
-> 任务执行回流
-> 学习 Session 记忆
-> 复测验证
-> Beta 学习闭环
```

Phase 7 已经证明单次 Beta Learning Flow 可以成立：

```text
开始学习
-> 第一题诊断
-> 个性化训练
-> 复测验证
-> 本轮学习结果
```

Phase 7 冻结后，不建议继续堆叠新的单次流程 Demo；后续应转向更高层问题，例如多次 Session 后的成长记忆、阶段报告或正式产品 Runtime 收敛。

后续新增 Phase 时，应继续围绕“证据是否能进入成长记忆、下一步动作是否可验证”这两个问题展开。
