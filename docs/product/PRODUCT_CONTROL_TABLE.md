# 产品负责人控制表

英文名称：Product Owner Control Table

状态：ACTIVE  
更新日期：2026-07-29

## 一、用途

本文是产品负责人的只读控制面，只回答：

1. 模块为什么存在；
2. 使用者能感受到什么；
3. 本阶段做什么、不做什么；
4. 哪 3—5 条结果才算产品级 PASS；
5. 如何现场演示；
6. FAIL 时先归入哪一层。

本文不替代 Phase Contract、Runtime Contract、Schema、Debug Case 或 Acceptance Report。

```text
Product Control Table
-> 产品负责人日常判断与任务分派

Phase / Product / Runtime Document
-> 正式功能与边界来源

Debug / Acceptance Report
-> 工程与人工验收证据
```

## 二、状态口径

禁止用一个笼统的 `PASS` 代替四种状态：

| 状态 | 含义 |
| --- | --- |
| Design | 目标和边界是否已接受 |
| Engineering | Runtime、数据和页面主链是否已实现 |
| Product Acceptance | 使用者是否通过可观察的人工验收 |
| Live / Natural-day | 是否在稳定版本上完成真实持续使用 |

`Engineering = PASS / Product Acceptance = PENDING` 是合法状态，表示能力已实现但产品结果尚未被真实使用证明。

## 三、当前总览

| 模块 | 一句话职责 | Design | Engineering | Product Acceptance | Live |
| --- | --- | --- | --- | --- | --- |
| Phase 17.2 首批正式资源包 | 生产经过审核、能被正式学习系统使用的真实题目 | PASS | BATCH A CONTROLLED FORMALIZATION + ASSISTED DRAFT GENERATION 38 / 38 PASS | BATCH A OWNER REVIEW / FREEZE 8 / 8 PASS | THREE-ROUND PROVIDER QUALITY REVIEW PENDING |
| Phase 17.3 正式资源运行集成 | 证明资源目标、来源、诊断、证据和下一任务在主链中不丢失 | PASS | WORK PACKAGE A 17 / 17 PASS / WORK PACKAGE B CONTROLLED LIVE 3 / 3 PASS | BATCH A `/learning` SINGLE-ROUND PASS | CONTROLLED DEEPSEEK LIVE PASS |
| Phase 17.4 本机共享正式资源 | 让不同本机客户端读取同一份正式资源，并保护版本与冲突 | PASS | DEBUG 10 / 10 + BASELINE CUTOVER + FRESH INITIALIZATION PASS | CONTROLLED DUAL-CLIENT + INDEPENDENT BROWSER-KERNEL CHECK PASS | RESTART PERSISTENCE PASS |
| Phase 17.5 题目生成质量评估 | 在发布前发现结构、语义和批次质量问题 | PASS | 17.5A / B / C1 / C2 / C3A / C3B RUNTIME PASS + REVIEW / PUBLICATION WORKFLOW P0 PASS | LIGHTWEIGHT DEMO + UNSAVED NAVIGATION ACCEPTANCE PASS | REAL TEN-MATERIAL CALIBRATION PENDING |
| `/learning` 正式学习入口 | 让单学生从一个入口开始、恢复、作答、反馈并继续 | PASS | MAIN PATH PASS / CONSOLIDATION IN PROGRESS | CONTROLLED DEMO PASS | `0 / 5` |
| 多能力调度 | 根据表现和正式资源决定下一步练什么 | PASS | RUNTIME PASS | LIMITED BY RESOURCE PACK | PENDING |
| Student Learning Narrative | 把系统已有判断转化为学生可理解、可执行的表达 | PASS | BASELINE PASS | REAL STUDENT CALIBRATION PENDING | PENDING |
| 跨 Session、复测与长期记忆 | 跨天记住学习历史并在合适时间复测 | PASS | PASS / FROZEN | CONTROLLED DEMO PASS | `0 / 5` |

## 四、Phase 17.2：首批正式资源包

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | Runtime 已能诊断和调度，但缺少足够真实正式内容。 |
| 使用者变化 | 学生可持续做真实题；内容人员通过“已有素材 / 素材录入 / 停用素材”三个明确模式管理 Material，再只处理当前素材的待审核资源、已发布练习与 AI 首稿；训练任务以来源、审核状态及“能力目标、题目、学生任务、观察目标”作为首层信息，详细评分与设计依据按需展开；单任务重生成、补充候选和整组替代候选均先由人工采用到编辑缓冲区，同一轮修改只维护一个工作草稿，反复生成、采用和保存不会堆叠 Revision；提交题目审核时才冻结新 Revision，并只核对版本、覆盖、材料范围和结构检查；同一素材的题号跨待审核、已发布状态保持稳定，明细按统一题号升序且不会因筛选重新编号；题目质量提醒提供具体修改位置、修改原则和参考写法，评分标准按可独立判断的评分项编辑；停用素材可逐条恢复且不丢失历史；最后将 Question 作为可执行入口完成 Review / Freeze；验收人员可追溯来源。 |
| 只做 | 4 个核心 Cluster、1—2 个独立新材料 Cluster、24—28 道正式资源、四条纵向链和一条跨 Ability 路径。 |
| 不做 | 不新增正式教育判断 Agent、Repository 或 `chainId`；辅助 Draft Generator 只执行“发现新 Observation”，替代题、重复题与材料不支持项不得增加 Coverage 或批量导入；不具备 Review / Freeze 权威；不重构工作台；不建设完整 CMS。 |
| 产品级 PASS | ① 24—28 道全部 Review / Freeze / Registry / Link；② 六项 Ability 均有正式资源；③ 两条 Retest、两条 Transfer、一条跨 Ability 路径可查询；④ 核心题 Rubric、Acceptance 与答案 Fixture 通过；⑤ 无明显低质量或错位题。 |
| 演示路径 | 选择或保存 Batch A Material -> 核对当前素材的待审核资源与已发布练习，并确认两类明细沿用同一题号顺序 -> 校准训练任务 -> 在“提交题目审核”核对版本、能力覆盖、材料范围与结构检查 -> Question / Rubric / Acceptance -> Review -> Freeze -> Registry -> Link -> Runtime Query；另选一条已停用素材执行重新启用，确认历史关系保留并返回已有素材库存。未选择 Material 时不显示下游生产模块。 |
| FAIL 先查 | 题目与 Rubric：内容；Freeze / Registry / Link：Runtime；录入审核困难：交互。 |
| 证据 | [Phase 17.2](../education/phase/phase17_2.md) · [录入字段契约 v1](AUTHORING_FIELD_CONTRACT.md) · [题目审核与发布工作流契约](QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md) · [单训练任务重新生成契约](SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md) · [训练任务组 AI 规划契约](TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md) · [生产蓝图](../education/phase/phase17_2_first_resource_pack_blueprint.md) · [辅助首稿生成验收](../education/phase/reports/phase17_2_assisted_draft_generation_engineering_2026-07-23.md) |

## 五、Phase 17.3：正式资源运行集成

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | 有正式资源不代表学习链正确使用了它，必须验证目标和来源没有在中途丢失。 |
| 使用者变化 | 每道题练明确能力；Diagnosis 对应正式目标；下一题由上一轮结果驱动；缺资源时不拿错题凑匹配。 |
| 只做 | 复用 Existing Strategy、TaskRequest 和 Phase 16.2 Matching，验证 Ability、TaskRole、Material Version、Observation、Diagnosis 与 Evidence 传递；Material 作为正式内容与语境来源，不作为题目附属文本处理。 |
| 不做 | 不新增第二套 Strategy / Matching；不把 Observation 直接写入 Profile；不由页面决定能力和资源；不扩展完整 Material Quality / Difficulty / Domain / Tags / Coverage 治理系统。 |
| 产品级 PASS | ① Frozen Resource 进入 `/learning` 且身份不变；② Diagnosis 对应正式 Ability / Observation；③ Evidence 来源正确并保留执行时的 Material Version；④ Strategy 产生正确 TaskRole 的下一资源；⑤ Resource / Material 错位或缺失时阻断且不重复 Diagnosis / Evidence。 |
| 演示路径 | 一题概括 + 一题分析 -> `/learning` 作答 -> Diagnosis 对照 -> Evidence 来源 -> Strategy / TaskRequest -> 下一资源。 |
| FAIL 先查 | 元数据丢失或默认值覆盖：Runtime；资源标注错误：内容；判断对但学生看不懂：表达；旧状态覆盖：交互 / Runtime。 |
| 证据 | [Phase 17.3](../education/phase/phase17_3.md) · [Batch A 串联 Debug](../education/phase/reports/phase17_3_batch_a_integration_debug_acceptance_2026-07-23.md) · [Work Package B 前置验收](../education/phase/reports/phase17_3_work_package_b_preflight_2026-07-23.md) · [Controlled DeepSeek Live](../education/phase/reports/phase17_3_controlled_deepseek_live_2026-07-23.md) · [Batch A `/learning` Demo](../education/phase/reports/phase17_3_batch_a_learning_demo_acceptance_2026-07-23.md) · [Phase 17 总纲](../education/phase/phase17.md) · [Phase 16.2](../education/phase/phase16_2.md) · [Phase 16.3](../education/phase/phase16_3.md) |

## 六、`/learning` 正式学习入口

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | Runtime 只有通过稳定、连续、可恢复的入口进入学习，才构成真实产品。 |
| 学生变化 | 从一个入口开始或继续；知道提交后发生什么；能查看反馈和下一步；刷新或隔天不丢进度。 |
| 只做 | 统一 Entry Resolver；展示任务、作答、提交、反馈、复测与继续；恢复 Round / Draft / Operation；隔离 Product / Demo。 |
| 不做 | 页面不拼多个 Repository、不产生 Diagnosis / Evidence / Strategy、不展示内部状态、不混入 Demo 数据。 |
| 产品级 PASS | ① 唯一入口可开始和恢复；② 等待、失败、反馈和下一任务不互相覆盖；③ 刷新和重复提交不重复 Provider / Evidence；④ Product / Demo 隔离；⑤ PC / Tablet 与自然日验收通过。 |
| 演示路径 | `/learning` -> 完成一轮 -> 查看反馈 -> 下一任务 -> 刷新恢复 -> 关闭后重新进入。 |
| FAIL 先查 | 不知道点哪里：交互；恢复、重复、状态错位：Runtime；反馈无价值：表达；题目无法完成：内容。 |
| 证据 | [界面与入口收敛](./STUDENT_PRODUCT_INTERFACE_CONSOLIDATION.md) · [Phase 16.3](../education/phase/phase16_3.md) |

## 七、多能力调度

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | 系统不能长期固定练推理或固定题型，应根据表现和可用资源决定下一项任务。 |
| 学生变化 | 下一题与刚才表现相关；可在巩固、复测、迁移和不同 Ability 间切换；资源不足时不会收到错位题。 |
| 只做 | 消费 Evaluation、GrowthMemory、Strategy；形成 Constraints / TaskRequest；经 Phase 16.2 匹配；无安全匹配时输出 Gap。 |
| 不做 | 不按正确率直接升级；不由页面选 Ability；不绕过 Strategy；不用近似 Ability / 错误 TaskRole 凑题。 |
| 产品级 PASS | ① 不同表现产生不同 Strategy；② 六项 Ability 有资源时可匹配；③ Training / Retest / Transfer 不互换；④ 缺资源明确阻断；⑤ Narrative 能解释下一任务原因。 |
| 演示路径 | 两份不同表现 -> Evaluation / Strategy 对照 -> TaskRequest 对照 -> 匹配结果 -> 学生端下一任务原因。 |
| FAIL 先查 | Strategy 不合理：Runtime；Strategy 对但匹配错：Runtime / 内容；原因不清：表达；切换迷失：交互。 |
| 证据 | [Phase 14](../education/phase/phase14.md) · [Phase 16.2](../education/phase/phase16_2.md) · [Phase 17](../education/phase/phase17.md) |

## 八、Student Learning Narrative

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | 系统内部知道 Diagnosis、Evidence 和 Strategy，不代表学生能感受到系统理解自己。 |
| 学生变化 | 知道系统注意到自己写了什么、做对什么、先改哪里、怎么改以及为什么继续。 |
| 只做 | 只读转译正式事实；锚定学生答案和唯一主要缺口；组织“为什么练、发生了什么、怎么办、为什么继续”。 |
| 不做 | 不新增 Diagnosis / Evidence / Profile / Strategy；不虚构学生原话和历史；不形成长期结论；不做自由聊天。 |
| 产品级 PASS | ① 至少回应一个本轮具体事实；② 已完成点真实、主要缺口唯一；③ 下一动作能直接修改当前答案；④ 下一任务原因来自 Strategy / Resource；⑤ 学生能复述系统注意到什么和自己先改哪里。 |
| 演示路径 | 同一正式题的完整、部分、错误、无效答案 -> Narrative 对照 -> 学生复述四个理解问题。 |
| FAIL 先查 | Diagnosis / Rubric 错：内容或 Runtime；机械不可执行：表达；页面重复或隐藏：交互；新增正式结论：Runtime。 |
| 证据 | [Narrative Calibration](./STUDENT_LEARNING_NARRATIVE_CALIBRATION.md) · [Phase 15.3](../education/phase/phase15_3.md) |

## 九、跨 Session、复测与长期记忆

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | 一次学习不能证明长期能力，系统必须跨 Session 保存历史并在合适时间重新观察。 |
| 学生变化 | 第二天知道昨天练了什么；未完成可继续；到期出现有原因的复测；不会因记录变旧就被判定退步。 |
| 只做 | 保存 Session History；生成 DelayedRetestPlan；通过正式任务开始复测；比较基线与延迟 Evidence；关联 Existing Evaluation。 |
| 不做 | Session 结束不等于目标完成；到期不自动开始；打开页面不等于复测；Evidence 变旧不等于退化；单次失败不直接改画像。 |
| 产品级 PASS | ① 跨刷新和 Session 保存恢复；② 复测有来源、时间、目的和正式任务；③ 产生新 Evidence；④ 检查 Ability、材料、提示和可比性；⑤ 稳定版本完成至少 5 个自然日。 |
| 演示路径 | Day 1 学习 -> 保存关闭 -> Day 2 恢复 -> Retest 到期 -> 新任务 / Evidence -> Retention -> 下一 Strategy。 |
| FAIL 先查 | 历史、身份、时间错：Runtime；Retest 不可比：内容；不懂为何复测：表达；恢复入口乱：交互。 |
| 证据 | [Phase 13 验收](../education/phase/phase13_acceptance_report.md) · [Phase 16.3](../education/phase/phase16_3.md) |

## 十、问题分类

| 类别 | 典型现象 | 默认调查入口 |
| --- | --- | --- |
| 内容问题 | 题目观察不到能力、Rubric 模糊、Acceptance 太死、Transfer 只是重复 | Material、Observation、Question、Rubric、Answer Acceptance |
| Runtime 问题 | Ability / TaskRole / 来源丢失、匹配错题、重复提交、历史恢复错误 | Resource、Operation、Diagnosis、Evidence、Strategy、Repository |
| 表达问题 | 判断正确但反馈空泛、机械、不可执行，任务原因说不清 | Controlled Feedback、Narrative、Presentation |
| 交互问题 | 不知道下一步、入口分散、录入繁琐、状态提示含糊 | `/learning`、内部工作台、Entry Resolver 展示 |

给 Codex 的推荐任务格式：

```text
当前问题：用户看到的具体异常。
预期：用户应感受到什么，正式来源应如何保持。
边界：不新增什么，不修改哪些已冻结语义。
请定位：属于内容、Runtime、表达还是交互；在哪一层丢失、错用或被默认值覆盖。
产品验收：使用 1—2 个有区分度的真实 Case 证明修复。
```

## 十一、维护规则

1. 只覆盖当前活跃模块，不重写 Phase 1—16 全部历史；
2. 每个模块最多保留 5 条产品级 PASS；
3. 底层 Debug 只链接证明，不复制全部 Case；
4. Product Acceptance 必须有人工可观察结果；
5. Live 状态只能由稳定版本真实使用更新；
6. 已冻结且不活跃的模块保留在 SYSTEM_MAP；
7. 本表不新增教育结论，不参与 Runtime；
8. 与正式文档冲突时修正本表。

## 十二、当前优先顺序

当前产品定位：

> 已通过真实单轮学习链路验收，具备正式资源录入、审核、发布、发布前质量治理和本机共享持久化基础的单学生封闭 Beta；尚未完成真实十素材校准、完整资源生态、多轮连续 Session 和自然日稳定性证明。

```text
1. 真实十素材校准：固定 10 篇代表材料，运行生成、质量评估与人工观察，形成 Phase 17.5 校准结论
2. 资源生态：继续生产 Phase 17.2 Batch B / C，完成 24—28 道正式资源与既定 Retest / Transfer / 跨能力路径
3. 连续 Session 与学生感知：完成 3 个受控 Session，并使用 6—10 组真实记录验收 Narrative
4. 冻结稳定构建，开始 Phase 16.3C 5—7 个自然日运行
```

产品负责人不需要重新掌握全部字段和对象。主要责任是守住目标、用户结果、PASS 标准、模块边界和问题分类。
