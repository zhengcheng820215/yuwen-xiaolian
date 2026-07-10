# Phase 1.0：工程与产品基础能力基线

## 阶段定位

Phase 1.0 记录项目最初建立的工程底座、页面框架和基础 AI 链路。

本阶段不是完整教育产品验收，也不证明学生能力提升；它的价值是确认项目已经具备继续进入 Phase 2 / Phase 3 的基础承载能力。

## 阶段目标

建立一个可以运行、可以演示、可以继续迭代的最小工程基础。

核心目标：

- 前端工程可以启动和构建。
- 页面路由和移动端容器可用。
- 基础学习模块原型可展示。
- Diagnosis Demo 能作为 AI 链路入口。
- AI agent / schema / debug script 形成初步组织方式。
- 后续可以在不重建工程的前提下继续扩展 Phase 2 和 Phase 3。

## 已具备能力

### 1. 前端工程能力

- React / Vite 工程可运行。
- Tailwind 样式体系可用。
- Hash Router 路由可用。
- 移动端宽度容器和底部导航已建立。
- 页面组件可复用，例如 `Layout`、`PageHeader`、`Card`。

### 2. 初始产品页面

已具备基础页面外壳：

- 首页
- 练习
- 错题本
- 我的
- Diagnosis Demo
- Quiz / Result 等基础练习流程页面

这些页面在 Phase 3 产品方向调整后不再全部作为当前主线，但它们构成了早期产品外壳和工程验证基础。

### 3. AI 工程组织方式

已形成基础目录结构：

```text
src/ai/agents
src/ai/schemas
src/ai/tests
src/api
```

这为后续能力提供了统一位置：

- Diagnosis Agent
- Question Metadata Agent
- Ability Evidence Extractor
- Training Plan Agent
- Training Evidence / Retest Evaluation

### 4. Debug 与构建能力

项目已经具备基础命令：

```bash
pnpm run dev
pnpm run build
```

后续 Phase 2 / Phase 3 在此基础上持续增加 debug 命令：

```bash
pnpm run debug:question-metadata
pnpm run debug:ability-evidence
pnpm run debug:training-plan
pnpm run debug:training-evidence
```

## 当前状态

- 状态：Completed / Baseline
- 记录日期：2026-07-08

Phase 1.0 已完成其基础使命：项目可以运行、可以构建、可以承载后续 AI 学习闭环开发。

## Phase 1.0 Definition of Done

Phase 1.0 完成标准：

1. 项目可以通过 `pnpm run dev` 正常启动。
2. 项目可以通过 `pnpm run build` 正常构建。
3. 基础路由可访问，包括首页、练习、错题本、我的、Diagnosis Demo。
4. 移动端容器和底部导航可正常展示。
5. 基础页面组件可复用，例如 `Layout`、`PageHeader`、`Card`。
6. `src/ai/agents`、`src/ai/schemas`、`src/ai/tests` 等 AI 工程目录已经建立。
7. Diagnosis Demo 能作为后续 AI 链路的最小入口。
8. 后续 Phase 2 / Phase 3 可以在当前工程基础上继续扩展，而不需要重建项目。

## 与 Phase 2 的关系

Phase 2 在 Phase 1.0 的基础上，重点补充题目结构化能力：

```text
Question
-> Question Metadata
-> Diagnosis
```

Phase 2 的核心价值是让题目不再只是纯文本，而是能被转成可供 Diagnosis 使用的结构化 Metadata。

## 与 Phase 3 的关系

Phase 3 在 Phase 1.0 和 Phase 2 的基础上，转向真正的能力成长闭环：

```text
Diagnosis
-> Ability Evidence
-> Top Weakness
-> Training Plan
-> Training Execution
-> Training Evidence
-> Retest Evidence
-> Ability Evidence Update
```

Phase 1.0 提供工程外壳；Phase 2 提供题目结构化能力；Phase 3 承担产品主线闭环。

## 冻结说明

Phase 1.0 中的部分旧模块暂时冻结：

- 练习
- 错题本
- 我的
- 等级经验
- 今日学习
- 学习反馈
- 继续昨天
- 错题回顾

冻结含义：

- 不删除。
- 不作为当前开发重点。
- 后续根据 Phase 3 主线需要，逐步改造为训练任务入口、Evidence Review 或 Student Ability Profile。

## 验收边界

Phase 1.0 只验收工程和产品外壳能力，不验收学习效果。

本阶段通过不代表：

- 题目结构化能力已经稳定。
- Diagnosis Agent 已经准确。
- 学生能力画像已经建立。
- 训练计划已经可用。
- 产品已经具备真实学习闭环。

以上能力由 Phase 2 / Phase 3 分阶段承担。

## 本阶段不包含

- 不要求完整题库。
- 不要求长期学习画像。
- 不要求训练计划生成。
- 不要求训练执行与复测。
- 不要求证明学生真实提升。

这些能力分别由 Phase 2 和 Phase 3 承担。

## 基线结论

Phase 1.0 可以视为项目的工程和产品基线。

它回答的问题是：

```text
这个系统是否已经具备继续迭代的基本工程承载能力？
```

当前结论：

```text
YES
```

后续开发不再围绕 Phase 1.0 扩展旧功能，而是围绕 Phase 3 的能力成长闭环继续推进。

