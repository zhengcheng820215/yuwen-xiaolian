# 学生唯一入口、正式阅读题库与轻量知识练习角色对齐决策（WP0A）

状态：`DECISION CONFIRMED / WP1—WP6 + WP7A + WP7B ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5)`

版本：`student_single_entry_resource_role_alignment_wp0a_v1.0`

日期：2026-08-29

确认记录：2026-08-29，产品负责人确认 D1—D8，授权输出 WP7A 工程实施文档并同步中央产品控制文档；在 WP7A `ENGINEERING PASS` 前不进入 WP5 代码开发。

执行更新：2026-08-31，WP7A、WP5、WP6 与 WP7B Engineering Acceptance 均已 PASS；当前只进入 WP7B-5 真实学生受控产品验收，Product Acceptance 仍为 `0 / 5`，Live 与 Educational Evidence 继续 PENDING。

上位依据：

- [全项目文档审计报告（2026-08-29）](./FULL_PROJECT_DOCUMENT_AUDIT_2026-08-29.md)
- [PRODUCT](./PRODUCT.md)
- [学生产品界面收口契约](./STUDENT_PRODUCT_INTERFACE_CONSOLIDATION.md)
- [产品控制表](./PRODUCT_CONTROL_TABLE.md)
- [知识练习可用产品第一阶段总体工程方案](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)
- [知识练习第一阶段执行清单](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

## 一、决策目的

本文只回答五个问题：

1. 学生从哪里进入产品；
2. 81 道正式阅读题与轻量知识题分别承担什么职责；
3. 两类训练共享什么、隔离什么；
4. WP1—WP4 已完成能力如何保留；
5. WP5—WP7 按什么顺序继续。

本文不设计具体页面，不修改正式资源，不扩充题目，也不直接授权 WP5 开发。

## 二、当前事实

### 2.1 正式阅读题库

当前正式资源基线为：

- 24 篇正式材料；
- 81 道 Current Frozen Resource；
- 其中 63 道属于普通新会话核心阅读题；
- 18 道属于条件触发的针对性短片段微训练题；
- 81 道均保留正式 Resource、Registry、Version、Quality Trace 和 Learning 消费契约。

### 2.2 轻量知识题

当前知识练习数据为：

- 27 道历史迁移题；
- WP5 新增 7 道人工审核补充题；
- 当前 19 道 `approved`，可进入学生练习；
- 当前 15 道 `draft`，不得进入学生练习；
- 当前 3 个批准变式组、6 条有向 ReinforcementLink；
- WP1—WP4 已完成数据、选题、会话、判题、反馈、本地持久化和恢复工程能力。

### 2.3 当前冲突

中央产品契约规定 `/learning` 是学生唯一正式入口；现有代码仍允许学生通过 `/practice/knowledge` 进入独立知识练习链。两条链拥有不同 Session、Store、反馈和结果语义，尚未形成统一产品解释。

## 三、角色模型

### 3.1 唯一学生入口

冻结以下决策：

> `/learning` 继续作为学生唯一产品入口。

“唯一入口”不表示所有任务使用同一判题器或同一数据结构，而表示学生只在一个产品壳中完成：

- 开始或继续学习；
- 理解当前推荐；
- 选择允许主动进入的训练；
- 查看本轮反馈与结果；
- 获得下一步行动。

`/practice`、`/practice/knowledge`、`/mistakes` 和旧 `/profile` 不再作为并列一级学生入口扩展。

### 3.2 正式阅读题库角色

81 道正式题继续承担能力成长主链任务：

```text
正式任务
→ 独立作答
→ Diagnosis / Evidence
→ 针对反馈或训练
→ 独立复测 / 迁移验证
→ Profile 与下一任务
```

正式题库不迁入知识练习 Repository，不写入知识练习 localStorage，不降级为普通随机刷题池。

学生端展示数量时必须区分：

- 正式题库库存：81；
- 普通核心阅读池：63；
- 条件触发微训练池：18。

数量必须从当前只读资源基线获得，不长期硬编码。

### 3.3 轻量知识练习角色

轻量知识练习定义为 `/learning` 内的 `knowledge_practice` 任务家族，承担：

- 字词、成语、病句、古诗文等基础知识巩固；
- 5 题专项或 10 题综合练习；
- 当前客观答案的确定性反馈；
- 本轮错题巩固、短期结果和下一组练习建议；
- 低负担、可主动进入的补充练习。

轻量知识练习不得：

- 直接生成正式 Diagnosis、Ability Evidence 或长期 Profile 结论；
- 把一次答对表述为“已经掌握”或“能力已经提升”；
- 替代正式阅读、复测和迁移任务；
- 建立第二套并列学生首页或成长叙事。

### 3.4 学生入口中的呈现关系

`/learning` 第一阶段至少提供两个清晰任务方向：

| 任务方向 | 产品名称 | 进入规则 | 结论边界 |
| --- | --- | --- | --- |
| 正式能力主线 | 阅读与能力训练 | 系统根据正式计划推荐、开始或恢复 | 可形成正式 Evidence，但长期结论仍需多次证据 |
| 轻量辅助训练 | 基础知识巩固 | 学生可主动选择；系统可给出短期建议 | 只输出本轮事实和短期巩固建议 |

正式推荐必须保持主要视觉优先级。基础知识巩固是清晰可见的辅助动作，不与正式主任务争夺“当前唯一主要动作”。

## 四、共享与隔离边界

### 4.1 必须共享

两类训练共享：

- `/learning` 产品入口与统一导航；
- 当前学生身份；
- 页面视觉、可访问性、错误恢复和术语规范；
- “继续未完成任务”的入口表达；
- 工程健康与产品验收口径。

### 4.2 当前继续隔离

第一阶段继续隔离：

- Formal Learning Session 与 PracticeSession ID；
- 正式 Evidence Repository 与知识练习 localStorage；
- Rubric / Diagnosis 与确定性客观题判题器；
- 正式长期画像与知识练习本轮结果；
- 正式资源发布链与轻量知识题数据门禁。

入口统一不等于数据强行合库。

### 4.3 禁止反向污染

知识练习错题、正确率或短期推荐不得未经新契约直接写入：

- Ability Evidence；
- Student Ability Profile；
- 正式阅读任务的 Diagnosis；
- 正式资源质量校准样本；
- 真实 Trial 的正式教育效果分母。

后续如需把知识练习事实用于正式推荐，只能新增版本化 Adapter，并明确其证据强度和降级规则。

## 五、WP1—WP4 资产处置

WP1—WP4 保留，不推倒重做：

| 已完成资产 | 决策 |
| --- | --- |
| Question 契约、迁移和校验 | 保留 |
| Knowledge Question Repository | 保留 |
| 5/10 题选题、seed、去重和近期降权 | 保留 |
| PracticeSession、Queue、Response、Feedback | 保留 |
| 确定性判题、错因和解题步骤 | 保留 |
| localStorage 持久化、备份、隔离和恢复 | 第一阶段保留 |
| `/practice/knowledge` 独立产品入口 | 转为兼容入口，不再继续扩展 |
| 独立第二套成长叙事 | 禁止继续建设 |

旧 `/practice/knowledge` 在入口整合时必须保护已有 active PracticeSession。兼容路由可以导航到 `/learning` 内的基础知识巩固视图，但不得静默删除、覆盖或重建学生未完成会话。

## 六、WP5—WP7 调整

原顺序为：

```text
WP5 错题巩固
→ WP6 结果与推荐
→ WP7 入口和产品验收
```

调整为：

```text
WP0A 角色与入口决策
→ WP7A 唯一入口最小整合
→ WP5 错题即时巩固
→ WP6 结果摘要与下一步推荐
→ WP7B 全链回归与产品验收
```

### 6.1 WP7A：唯一入口最小整合

WP7A 只完成：

- `/learning` 展示正式能力主线与基础知识巩固的正确角色；
- 能开始或恢复现有 PracticeSession；
- 旧知识练习路由安全兼容；
- 移除旧入口的一级产品地位；
- 展示动态且不误导的内容口径；
- 不改变正式 Evidence 和知识练习本地事实边界。

WP7A 通过后才允许继续 WP5。

### 6.2 WP5：错题即时巩固

WP5 保持原领域目标，但必须在 `/learning` 产品壳中完成体验验收；巩固题仍属于轻量知识练习，不进入正式 Evidence。

### 6.3 WP6：结果与推荐

WP6 只输出：

- 首次正确率和真实用时；
- 本轮知识点与预设错因摘要；
- 短期巩固建议；
- 返回正式主线或开始下一组知识练习的明确动作。

WP6 不输出长期掌握、能力提升或画像结论。

### 6.4 WP7B：产品验收

WP7B 同时验证：

- 唯一入口是否可理解；
- 81 道正式题与轻量知识题是否被正确解释；
- 连续使用是否出现重复、枯竭和恢复问题；
- 学生是否理解反馈及下一步动作；
- 正式事实和轻量事实是否保持隔离；
- PC、手机、刷新、异常与旧路由兼容是否通过。

## 七、题量与反馈口径

### 7.1 题量

取消把“达到 100 道”作为孤立的产品成功标准。轻量知识题数量由以下覆盖指标倒推：

- 首阶段知识点覆盖；
- 每个知识点的独立基础题数量；
- 已审核的真实干扰项和错因；
- 可用变式关系；
- 连续 5 次和 10 次练习的重复率、枯竭率。

`100 道 approved` 暂时降级为内容建设目标，不再作为未经上位验证的固定产品门禁。

### 7.2 反馈

反馈验收分为三层：

| 层级 | 必须证明 |
| --- | --- |
| Engineering PASS | 当前答案被正确判定，反馈结构稳定、可恢复、可追溯 |
| Product Acceptance PASS | 学生看得懂为什么错、下一次先检查什么，并能顺利继续 |
| Educational Evidence | 学生在独立新题、新文本或间隔复练中仍有改善 |

WP3 当前只完成第一层。WP5—WP7B 不得把工程通过自动升级为反馈效果成立。

## 八、完成门禁

WP0A 只有在以下事项全部成立后才为 `DECISION CONFIRMED`：

1. 产品负责人确认 `/learning` 是唯一学生入口；
2. 产品负责人确认知识练习作为 `/learning` 内的轻量任务家族；
3. 确认 81 道正式题不迁入知识练习 Store；
4. 确认知识练习不直接生成正式 Evidence / Profile；
5. 确认保留 WP1—WP4 领域资产；
6. 确认先做 WP7A，再进入 WP5、WP6 和 WP7B；
7. 确认 100 道降级为内容目标，由覆盖和连续使用指标决定最终题量；
8. 确认 Engineering、Product Acceptance、Educational Evidence 三层验收不得混用。

确认后允许：

- 将本文状态更新为 `DECISION CONFIRMED / WP7A AUTHORIZED`；
- 输出 WP7A 工程实施文档；
- 同步产品控制表、系统地图和知识练习执行清单。

确认前禁止：

- 直接进入 WP5 代码开发；
- 删除或迁移学生现有 PracticeSession；
- 把正式 81 道题合并到轻量知识题库；
- 扩展 `/practice/knowledge` 为第二套学生主产品。

## 九、产品负责人确认记录

以下决策已由产品负责人确认：

| 编号 | 待确认决策 | 推荐结论 |
| --- | --- | --- |
| D1 | 学生唯一入口 | `/learning` |
| D2 | 知识练习角色 | `/learning` 内的轻量辅助任务家族 |
| D3 | 正式 81 道题 | 保持正式 Resource / Learning 契约，不并入轻量 Store |
| D4 | 知识练习事实 | 保持本轮、短期、本地边界，不直接进入 Evidence / Profile |
| D5 | WP1—WP4 | 全部保留并复用 |
| D6 | 后续顺序 | `WP7A → WP5 → WP6 → WP7B` |
| D7 | 100 道目标 | 降级为内容目标，由覆盖和连续使用指标校准 |
| D8 | 验收层级 | Engineering / Product Acceptance / Educational Evidence 分层 |

签署语：

> 确认 WP0A 的 D1—D8，授权输出 WP7A 工程实施文档，并同步中央产品控制文档；在 WP7A Engineering PASS 前不进入 WP5 代码开发。

签署结果：`CONFIRMED`
