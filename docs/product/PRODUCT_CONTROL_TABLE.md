# 产品负责人控制表

英文名称：Product Owner Control Table

状态：ACTIVE  
更新日期：2026-08-18

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
| Phase 17.2 首批正式资源包 | 生产经过审核、能被正式学习系统使用的真实题目 | PASS | UNIFIED WORKBENCH 26 / 26 + PLAN CONTINUATION WP-C5 / WP-C6 + ASSISTED DRAFT GENERATION 38 / 38 PASS | BATCH A OWNER REVIEW / FREEZE 8 / 8 PASS；WORKBENCH READ-ONLY 42 / 42 VERIFIED | THREE-ROUND PROVIDER QUALITY REVIEW PENDING |
| Phase 17.3 正式资源运行集成 | 证明资源目标、来源、诊断、证据和下一任务在主链中不丢失 | PASS | WORK PACKAGE A 17 / 17 PASS / WORK PACKAGE B CONTROLLED LIVE 3 / 3 PASS | BATCH A `/learning` SINGLE-ROUND PASS | CONTROLLED DEEPSEEK LIVE PASS |
| Phase 17.4 本机共享正式资源 | 让不同本机客户端读取同一份正式资源，并保护版本与冲突 | PASS | DEBUG 10 / 10 + BASELINE CUTOVER + FRESH INITIALIZATION PASS | CONTROLLED DUAL-CLIENT + INDEPENDENT BROWSER-KERNEL CHECK PASS | RESTART PERSISTENCE PASS |
| Phase 17.5 题目生成质量评估 | 在发布前发现结构、语义和批次质量问题 | PASS | 17.5A / B / C1 / C2 / C3A / C3B RUNTIME PASS + REVIEW / PUBLICATION WORKFLOW P0 PASS | STAGE 1–5 TEN-MATERIAL / 34-QUESTION CALIBRATION PASS | REAL LEARNING SAMPLE CALIBRATION AWAITING DATA |
| `/learning` 正式学习入口 | 让单学生从一个入口开始、恢复、作答、反馈并继续 | PASS | MAIN PATH PASS / SHARED FORMAL SNAPSHOT READ FIXED / CONSOLIDATION IN PROGRESS | UNIFIED ENTRY 20 / 20 + FORMAL ENTRY 10 / 10 PASS | `0 / 5` |
| Learning 反馈后一次修订 | 保留首次独立表现，并观察学生能否利用反馈完成一次改善 | PASS | STAGES 1–4 ENGINEERING + DEBUG + E2E PASS | ISOLATED BROWSER + E2E PASS / REAL STUDENT ACCEPTANCE PENDING | AWAITING REAL RETEST / TRANSFER DATA |
| 阅读训练单项选择作答 | 用低输入成本观察基础理解，并通过可解释干扰项形成具体诊断 | PASS | STAGES 1–4 65 / 65 PASS；FINAL RESUME REGRESSION 89 / 89 PASS | REAL-MATERIAL E2E + CONTROLLED PC / TABLET + FINAL BROWSER RESUME SMOKE PASS；CAPABILITY GATE OPEN | AWAITING REAL STUDENT DATA |
| 真实 Learning 数据采集与观察 | 在不干扰学生的前提下记录匿名使用者、过程、答案与版本化校准样本 | PASS | WP0—WP7 + STAGE 4 ENGINEERING CLOSEOUT PASS | ISOLATED BROWSER ACCEPTANCE PASS / REAL USE PENDING | AWAITING REAL DATA |
| 多能力调度 | 根据表现和正式资源决定下一步练什么 | PASS | RUNTIME PASS | LIMITED BY RESOURCE PACK | PENDING |
| Student Learning Narrative | 把系统已有判断转化为学生可理解、可执行的表达 | PASS | BASELINE PASS | REAL STUDENT CALIBRATION PENDING | PENDING |
| 跨 Session、复测与长期记忆 | 跨天记住学习历史并在合适时间复测 | PASS | PASS / FROZEN | CONTROLLED DEMO PASS | `0 / 5` |

## 四、Phase 17.2：首批正式资源包

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | Runtime 已能诊断和调度，但缺少足够真实正式内容。 |
| 使用者变化 | 学生可持续做真实题；内容人员通过“已有素材 / 素材录入 / 停用素材”管理 Material。AI 训练任务组只提供“采用当前任务方案 / 重新生成任务方案”，采用后系统自动保存并检查 Observation Plan；AI 单题只提供“采用并发布 / 重新生成题目”，采用后系统自动完成 Revision、Assessment、发布决定、Freeze、Registry 与 Link。标准路径不提供人工改题、删除任务、保存任务组修改、提交审核或填写审核意见；停用素材和正式版本仍保留完整追溯。 |
| 只做 | 4 个核心 Cluster、1—2 个独立新材料 Cluster、24—28 道正式资源、四条纵向链和一条跨 Ability 路径。 |
| 不做 | 不新增正式教育判断 Agent、Repository 或 `chainId`；辅助 Draft Generator 只执行“发现新 Observation”，替代题、重复题与材料不支持项不得增加 Coverage 或批量导入；不具备 Review / Freeze 权威；不重构工作台；不建设完整 CMS。 |
| 产品级 PASS | ① 24—28 道全部 Review / Freeze / Registry / Link；② 六项 Ability 均有正式资源；③ 两条 Retest、两条 Transfer、一条跨 Ability 路径可查询；④ 核心题 Rubric、Acceptance 与答案 Fixture 通过；⑤ 无明显低质量或错位题。 |
| 演示路径 | 选择或保存 Material -> 生成训练任务方案 -> 采用方案并由系统自动保存 Plan -> 生成题目方案 -> 采用并发布 -> 确认任务卡原位显示已发布 -> `/learning` 从 Active Registry 消费正式版本；不满意时重新生成，不进入人工编辑或独立审核页。另选一条已停用素材执行重新启用，确认历史关系保留并返回已有素材库存。未选择 Material 时不显示下游生产模块。 |
| FAIL 先查 | 题目与 Rubric：内容；Freeze / Registry / Link：Runtime；录入审核困难：交互。 |
| 证据 | [Phase 17.2](../education/phase/phase17_2.md) · [统一资源生产工作台契约](UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md) · [共享正式资源并发与恢复契约](SHARED_FORMAL_RESOURCE_CONCURRENCY_CONTRACT.md) · [材料工作台 UX 规范](MATERIAL_WORKBENCH_UX_CALIBRATION_2026-07-30.md) · [WP-C5 验收](../education/phase/reports/shared_formal_resource_semantic_state_reload_wp_c5_acceptance_2026-08-14.md) · [WP-C6 验收](../education/phase/reports/shared_formal_resource_plan_continuation_wp_c6_acceptance_2026-08-14.md) · [录入字段契约 v1](AUTHORING_FIELD_CONTRACT.md) · [题目审核与发布工作流契约](QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md) · [辅助首稿生成验收](../education/phase/reports/phase17_2_assisted_draft_generation_engineering_2026-07-23.md) |

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

### 6.1 真实 Learning 数据采集与观察

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | 五事件最小链和自动校准 Attempt 接续已经完成；当前需要在真实使用中持续核对链路完整率、版本级样本资格与失败恢复，避免把工程验收误当成真实样本已经充足。 |
| 使用者变化 | 第一阶段学生体验不增加步骤，只继续看到保存、提交、反馈和完成；内部人员默认核对“当前采集链”，并可切换“全部历史”查看不补造、不删除的旧缺口。家长报告和多使用者后置。 |
| 只做 | 当前维持固定单学生五个核心事件、稳定 attemptId、完成轮次后的匿名校准投影和内部完整性报告；进入真实运行，不增加学生操作步骤。 |
| 不做 | 不记录逐键、鼠标轨迹、剪贴板、其他网页活动；不建立广告画像；不把单人重复作答解释为群体样本；不静默上传本地数据。 |
| 产品级 PASS | ① 正常作答形成五事件；② 每次不同提交意图创建稳定 attemptId，相同提交重试保持幂等；③ 每个提交恰好对应 eligible、excluded 或 projection failed 之一；④ 只有完成且已评分的 Attempt 进入有效样本；⑤ 内部报告能发现缺失、重复、错绑和 Demo 泄漏；⑥ 旧历史 FAIL 与当前链健康状态分层展示，空当前范围不冒充 PASS。 |
| 演示路径 | 固定产品学生完成一题 → 核对五事件 → 刷新恢复 → 核对同一 resourceVersionId 只有一个匿名 Attempt → 查看内部完整性报告。 |
| FAIL 先查 | 身份、版本、幂等或时间：Runtime；学生被干扰：交互；家长观察被当成系统结论：表达 / Runtime；样本资格错误：数据治理。 |
| 证据 | [真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md) · [最小采集工程契约](./REAL_LEARNING_MINIMUM_COLLECTION_ENGINEERING_CONTRACT.md) · [AI 题目采用与真实作答校准契约](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md) |

### 6.2 Learning 反馈后一次修订

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | 只展示反馈无法证明学生理解或使用了反馈；一次受控修订可以把反馈转化为真实学习行为，并观察改善是否发生。 |
| 学生变化 | Training 首答存在可执行缺口时，可以选择“根据反馈修订”；原答案自动带入且首次回答不会被覆盖。修订后只查看一次改善评价，然后继续下一题。 |
| 只做 | 每题最多一次 Revision；保留 Initial 与 Revised Response；按正式 Diagnosis 决定是否展示入口；生成独立 Revision Evaluation；失败可恢复；Revision 形成 feedback-supported evidence。 |
| 不做 | 不允许无限修改、实时逐句指导、AI 代写、数值 Revision Score、详细 Diff、历史版本时间轴；不在 Retest、Transfer、Maintenance 或 Formal Assessment 开放即时修订；不把 Revision 计为新题或校准 Attempt。 |
| 产品级 PASS | ① 首答充分达标时不出现无意义修订；② 存在可修正缺口时显示明确 Revision Goal；③ Initial Response 不可变，Revised Response 独立保存；④ 每题最多一次且刷新、重复点击不重复；⑤ Revision Evaluation 说明已改善、未解决和新问题；⑥ Revision 不改变首次题目校准与独立 Evidence。 |
| 演示路径 | Training 部分达标回答 → 查看正式反馈与 Revision Goal → 进入 Revision Mode → 在原答案基础上修改 → 提交 → 查看改善评价 → 继续下一题；随后对照内部 Initial / Revision 记录和唯一校准 Projection。 |
| FAIL 先查 | 入口资格错误：Diagnosis / Policy；原答案或证据被覆盖：Runtime；反馈空泛或泄露答案：表达；重复 Revision、刷新丢失或校准数增加：Runtime / 数据治理。 |
| 证据 | [Learning 反馈后修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md) · [修订观察、审计与指标契约](./LEARNING_FEEDBACK_REVISION_OBSERVATION_AND_AUDIT_CONTRACT.md) · [端到端联调验收](../education/phase/reports/learning_feedback_revision_end_to_end_integration_debug_2026-08-14.md) · [学习流程模型](../education/LEARNING_FLOW.md) · [反馈行动转换模型](../education/FEEDBACK_ACTION_MODEL.md) · [训练模型](../education/TRAINING_MODEL.md) |

> 阶段 1–4 已完成：稳定身份、Initial / Revised Response 不可变、单次 Revision、草稿恢复、差异评价、feedback-supported Evidence、Profile 只追加证据、扩展事件、Outbox 恢复、完整性审计和诚实指标均已落地。阶段回归 `88 / 88 PASS`，端到端联调 `13 / 13 PASS`，IndexedDB 恢复 `18 / 18 PASS`，Production Build PASS。系统只在正式 Evaluation 完成后表述修订结果，不把“已提交”直接解释为“已经改善”；真实教育效果仍需后续无提示 Retest / Transfer 校准。

### 6.3 阅读训练单项选择作答

| 控制项 | 产品负责人视图 |
| --- | --- |
| 为什么需要 | 信息定位、基础理解和局部判断不一定需要学生反复输入长文本；稳定干扰项还能提供比单纯判错更具体的理解偏差信号。 |
| 使用者变化 | 单选题作为阅读任务组中的独立任务出现，与短文本、长文本并列；学生选择一个答案后提交并获得针对所选偏差的反馈。两类任务形成互补观察，用于区分基础理解缺口与概括、证据组织、分析、推理或表达缺口。 |
| 只做 | 第一版只做 `single_choice`；稳定 optionId、唯一正确答案、逐项干扰依据、答案键隔离、Learning恢复、Diagnosis与真实数据采集；任务顺序由 Observation Plan 决定；互补任务保持独立 Attempt、Diagnosis 与 Evidence，只形成可追溯的联合解释。 |
| 不做 | 不做多选、部分得分、选择后追问、反馈后立即改选、固定“选择题排第一”、每篇题型配额或高阶能力选择题化。 |
| 产品级 PASS | ① 每个错误选项都对应独立可解释偏差；② 学生投影不含答案键；③ 刷新、重复提交和中断恢复不重复 Attempt；④ 错误选择形成具体但不过度推断的 Diagnosis；⑤ 文本题和现有生产发布链无回归；⑥ 单选与文本联合解释能区分前置理解、文本组织和证据冲突，但不生成不可追溯总分。 |
| 演示路径 | 选择一篇材料中的独立单选任务 → 选择错误干扰项并提交 → 查看对应理解偏差反馈 → 刷新确认结果恢复 → 再完成同篇文本任务；生产端对照 Candidate 采用发布和 Frozen Version。 |
| FAIL 先查 | 选项、答案键或干扰项：内容 / Schema；提交恢复或版本绑定：Runtime；反馈空泛：Diagnosis / 表达；题序或按钮状态：交互。 |
| 证据 | [阅读训练单项选择作答契约](READING_SINGLE_CHOICE_RESPONSE_FORMAT_CONTRACT.md) · [阶段 1 工程与 Debug 验收](../education/phase/reports/reading_single_choice_stage1_engineering_debug_acceptance_2026-08-18.md) · [阶段 2 工程实施与验收清单](READING_SINGLE_CHOICE_STAGE2_ENGINEERING_PLAN.md) · [阶段 2 工程与 Debug 验收](../education/phase/reports/reading_single_choice_stage2_engineering_debug_acceptance_2026-08-18.md) · [阶段 3 工程实施与验收清单](READING_SINGLE_CHOICE_STAGE3_ENGINEERING_PLAN.md) · [阶段 3 工程与 Debug 验收](../education/phase/reports/reading_single_choice_stage3_engineering_debug_acceptance_2026-08-18.md) · [阶段 4 端到端联调与产品验收清单](READING_SINGLE_CHOICE_STAGE4_E2E_AND_PRODUCT_ACCEPTANCE_PLAN.md) · [阶段 4 端到端与产品验收报告](../education/phase/reports/reading_single_choice_stage4_e2e_product_acceptance_2026-08-18.md) · [AI 题目生成质量与定向优化契约](AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md) · [AI 题目采用与真实作答校准契约](AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md) |

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

> 已完成10篇材料、34道正式题的资源生产校准，以及真实 Learning 最小采集 `WP0—WP7`；具备正式资源录入、AI生成、质量门禁、采用发布、版本治理、Learning消费、本机学习记录、五事件采集、失败恢复、校准 Projection 和内部完整性审计能力。当前进入固定单学生的受控真实运行，尚缺真实样本量、多轮连续 Session 和自然日稳定性证明。

```text
1. 真实 Learning：由固定单学生使用当前10篇材料、34道题完成连续 Session，重点观察12道长文本提示题与4道 v4 试点题
2. 每个新轮次后检查内部完整性页，记录五事件完整率、eligible / excluded / projection failed 闭合、Outbox 恢复、版本绑定和真实 Diagnosis 可用性
3. 在真实 Training 轮次中观察 Revision Offer、开始、提交、评价完成和后续 Retest / Transfer；不得把反馈支持下改善直接解释为独立掌握
4. 累积真实样本并按独立使用者口径解释；单一学生的重复作答和 Revision 均不得充当多人样本或群体校准
5. 完成多轮连续 Session 与至少5个自然日稳定性证明，区分历史缺失记录和新链路数据
6. 根据真实数据调整反馈、题目、Rubric 或调度策略；没有观察证据时不继续增加学生操作或第二次 Revision
7. P4 家长报告与广泛过程指标、P5 多使用者继续后置；扩大试用前单独完成材料来源与版权核验
8. 单项选择按独立四阶段方案实施，第一版只做 `single_choice`；它不阻塞当前文本题真实试用，也不得在完整端到端验收前进入正式 Learning 库
```

产品负责人不需要重新掌握全部字段和对象。主要责任是守住目标、用户结果、PASS 标准、模块边界和问题分类。
