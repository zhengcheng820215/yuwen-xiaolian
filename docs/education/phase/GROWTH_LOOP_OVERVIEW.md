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
```

## Demo 演示入口

当前 Demo 只用于验证最小闭环，不代表正式产品 UI。

```text
/#/diagnosis-demo
/#/training-plan-demo
/#/training-evidence-demo
/#/student-profile-demo
/#/personalized-next-task-demo
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
```

后续新增 Phase 时，应继续围绕“证据是否能进入成长记忆、下一步动作是否可验证”这两个问题展开。


