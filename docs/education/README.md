# 教育模型文档索引（Education Documentation Index）

本文档用于说明 `docs/education/` 目录下教育模型文档的职责、分类和推荐阅读顺序。

当前阶段暂不移动核心模型文件，仅通过本索引建立逻辑分组，避免影响已有代码中的文档路径引用。

## 一、目录职责

### `docs/product/`

定义产品目标、产品边界和核心价值。

### `docs/runtime/`

定义 Agent、Runtime 和开放题诊断的执行规范。

其中 `SYSTEM_MAP.md` 是当前系统的人类可读地图，用于快速理解总链路、当前进度、当前 Phase 目标和下一步方向。

### `docs/education/phase/`

记录各阶段目标、任务、验收与冻结状态。

### `docs/education/` 根目录下的模型文档

定义能力、题目、诊断、学习缺口、训练、证据、评估和学生画像等系统模型。

## 二、核心文档分类

### 基础模型

- `ABILITY_MODEL.md`
- `QUESTION_MODEL.md`
- `QUESTION_METADATA_MODEL.md`

### 学习行为模型

- `DIAGNOSIS_MODEL.md`
- `LEARNING_GAP_MODEL.md`
- `STUDENT_THINKING_MODEL.md`
- `FEEDBACK_ACTION_MODEL.md`
- `TRAINING_MODEL.md`
- `AI_COACH_MODEL.md`
- `LEARNING_FLOW.md`

### 证据与长期状态

- `ABILITY_EVIDENCE_CONTRACT.md`
- `WEAKNESS_RANKING_MODEL.md`
- `EVALUATION_MODEL.md`
- `STUDENT_PROFILE_MODEL.md`

### 评估资产

- `EVALUATION_CASE_SET.md`

## 三、推荐阅读顺序

建议按以下顺序理解系统：

```text
SYSTEM_MAP
↓
PRODUCT
↓
ABILITY_MODEL
↓
QUESTION_MODEL
↓
QUESTION_METADATA_MODEL
↓
DIAGNOSIS_MODEL
↓
LEARNING_GAP_MODEL
↓
STUDENT_THINKING_MODEL
↓
FEEDBACK_ACTION_MODEL
↓
ABILITY_EVIDENCE_CONTRACT
↓
WEAKNESS_RANKING_MODEL
↓
TRAINING_MODEL
↓
AI_COACH_MODEL
↓
LEARNING_FLOW
↓
EVALUATION_MODEL
↓
STUDENT_PROFILE_MODEL
↓
EVALUATION_CASE_SET
↓
LEARNING_RUNTIME_OVERVIEW
```

## 四、当前状态

- 12 份既有核心模型文档已完成第一轮审查增强；Learning Gap、Student Thinking 与 Feedback Action 已形成表现到干预之间的受控解释层。当前已实现确定性 `StudentThinkingAnalysis` 与 `StudentFeedbackActionPlan`；结论偏差反馈会以正式 `StudentResponse` 为只读锚点，对照材料线索生成思考缺口与下一步训练，不替代 Diagnosis、Root Cause 或长期 Evaluation。
- Phase 14.1 Evidence Quality Assessment 已通过 17 / 17 Debug 验收。
- Phase 14.2 Evidence Conflict Coordination 已通过 25 / 25 Debug 验收。
- Phase 14.3 Adaptive Task Constraints 已完成结构化 Rule、Context Snapshot、TaskRequest Envelope 与 Fulfillment 接入，26 / 26 Debug 通过；执行后质量重评集成 Case 27 为 16 / 16 PASS，Phase 14 总体状态为 `PASS / FROZEN`。
- Phase 14 冻结能力声明：系统能够根据正式任务、作答、提示、时间和追溯事实评估 Evidence 的判断价值，协调多条 Evidence 的方向关系，并在 Existing Strategy 的边界内生成受控任务约束；任务执行后，系统会依据真实表现重新评估 Evidence 质量，而不会把目标质量当成实际结果。
- Phase 15.1 Real LLM Runtime Foundation 已通过并冻结：确定性 Debug 为 `22 / 22 PASS`，DeepSeek `deepseek-v4-flash` Live Smoke 为 `4 / 4 PASS`。Phase 15.2 已完成 Prompt v4 真实质量验证、Policy v2.1 校准、负责人确认和正式启用回归；Root Cause 为 90 / 93，完整质量为 accepted 79、questionable 6、unacceptable 8、critical 0，正式验收 `15 / 15 PASS`。Phase 15.2 当前为 `PASS / FROZEN`，正式质量 Evaluator 默认使用 Policy v2.1。
- [Phase 15.3 Controlled Feedback Expression](./phase/phase15_3.md) 已通过并冻结：确定性 Debug `24 / 24`、DeepSeek Prompt v1.1 Live `12 / 12`、Controlled Safety `2 / 2`、脱敏人工抽检 `12 / 12`、关键回归与 Production Build 全部通过。Phase 15 当前为 `PASS / FROZEN`。
- Phase 15 总纲见 [Phase 15](./phase/phase15.md)，Diagnosis 质量冻结记录见 [Phase 15.2 验收](./phase/phase15_2_acceptance_report.md)，受控表达质量记录见 [Phase 15.3 验收](./phase/reports/phase15_3/phase15_3_controlled_feedback_acceptance_2026-07-17.md)，整链记录见 [Phase 15 集成验收](./phase/reports/phase15_integration_acceptance_2026-07-17.md)。确定性整链 Debug 已 `11 / 11 PASS`；Prompt v4 默认切换和真实外部 Provider 完整产品主链的受控试跑仍未完成。
- [Phase 16 总纲](./phase/phase16.md) 当前为 `ACCEPTED / IN PROGRESS`；[Phase 16.1](./phase/phase16_1.md) 与 [Phase 16.2](./phase/phase16_2.md) 已完成。Phase 16.3A / 16.3B 为 `PASS / FROZEN`。2026-07-21 [Phase 16.3C Engineering Preflight](./phase/reports/phase16_3c_engineering_preflight_2026-07-21.md)、[Application Boundary Controlled Live Smoke](./phase/reports/phase16_3c_application_boundary_live_smoke_2026-07-21.md) 与 [Lightweight Demo Acceptance](./phase/reports/phase16_3c_demo_acceptance_2026-07-21.md) 已完成：真实 `/learning`、服务端 DeepSeek 回流、策略驱动下一 Frozen Resource、IndexedDB 恢复、无效作答前置闸门、内部多日复核和受控人工验收成立。当前状态为 `ENGINEERING + HUMAN DEMO PASS / NATURAL-DAY ACCEPTANCE PENDING (0 / 5)`。
- [Phase 17 总纲](./phase/phase17.md) 已接受并进入工程阶段。其目标不是扩充题目数量，而是建立以 Material Cluster 为组织基础、以能力观测为目标、能够被正式 Runtime 消费和验证的第一套学习资源体系。阶段采用 `Material -> Observation Dimension -> Ability Action -> Question Resource` 的设计关系：17.1 保持 `abilityId + taskRole` Coverage Contract；17.2 建立 Material Observation Plan，并以 4 个核心 Material Cluster、1—2 个独立新材料 Cluster 和 24—28 道 Frozen Resource 形成首批最小资源生态；17.3 验证正式资源消费、观测引用、两条 Training -> Retest、两条 Training -> Transfer 与一条跨能力连续学习路径。题量只记录资源包规模，不单独构成完成条件；Observation Dimension 第一版只用于规划和偏斜审查，不直接进入 Evidence、Profile 或正式 Coverage denominator。Phase 17 不替代 Phase 16.3C 的 5—7 个自然日真实运行验收。
- [Phase 17.1 Resource Coverage Contract](./phase/phase17_1.md) 已完成工程实现与 `22 / 22` Debug，Phase 16.1A、16.2A、16.2B 回归和 Production Build 全部通过。V1 使用 `materialId` 作为 Material Cluster 聚合键，以 `abilityId + taskRole` 作为 Primary Cell，分别统计产品端可执行资源、Material Cluster 与独立 Context；Coverage Report 对 Registry 只读，Dashboard 不自行拼装覆盖，也不替代 Phase 16.2 正式匹配。`#/resource-coverage-dashboard-demo` 已完成负责人轻量人工验收 `8 / 8 PASS`；浏览器 IndexedDB 读取与刷新重算 Smoke 仍为 `PENDING`。
- [Phase 17.2 Material Observation Design and First Frozen Resource Pack](./phase/phase17_2.md) 设计已接受，17.2A / 17.2B Runtime、Manifest / Diversity Runtime 基础和最小资源生产工作台工程实现已完成；核心专项 Debug `26 / 26 PASS`，生产工作台专项 Debug `13 / 13 PASS`，工作台状态回归 `5 / 5 PASS`。Assisted Draft Generation 已完成候选生成、逐项隔离校验、只读库存比较和工作台人工导入，专项 `38 / 38 PASS`；Prompt v1.4 / Generator Contract v1.2 向 Provider 暴露 Runtime 同源段落编号、完整枚举和题型映射，并在结构拒绝导致整批不足时只修复失败候选一次。已通过候选不会被覆盖，修复失败安全回退；替代题、疑似重复、材料不支持和教育语义越界继续隔离。当前状态为 `ENGINEERING PASS / CONTROLLED LIVE EFFECTIVENESS PENDING`，仍需 3 轮真实生成确认结构合格率。该模块默认只生成 Training Candidate，不直接写 Repository、Review、Freeze 或 Registry。Batch A 已实现两篇项目原创 Material、8 道内容完整资源、1 条 Training -> Retest、1 条 Training -> Transfer 和 16 组答案 Fixture，隔离正式 Repository 的受控正式化 `14 / 14 PASS`；浏览器负责人审核、逐题 Freeze、Registry 和 active Observation Link 已完成 `8 / 8`，Phase 17.3 最小入口门已开放。《潼关》Material Cluster 校准专项 `12 / 12 PASS`，其 Plan 仍为 pending-review，不计入正式题量。首批完整 4 个核心 Cluster、1—2 个独立新材料 Cluster和 24—28 道 Frozen Resource 继续按 [生产蓝图](./phase/phase17_2_first_resource_pack_blueprint.md) 建设。[Batch A 记录](./phase/reports/phase17_2_batch_a_controlled_formalization_2026-07-23.md)、[《潼关》校准记录](./phase/reports/phase17_2_tongguan_material_cluster_calibration_2026-07-23.md)、[辅助首稿生成记录](./phase/reports/phase17_2_assisted_draft_generation_engineering_2026-07-23.md)。
- [Phase 17.3 Formal Resource Runtime Integration and Source Preservation](./phase/phase17_3.md) 设计已接受，Work Package A 已使用 Batch A 完成确定性正式资源串联 `17 / 17 PASS`。只读 Formal Resource Source Resolver 已验证 Frozen Current Version、Registry、不可变 Material Version、Frozen Material Snapshot、Material Structure contentHash、active ResourceObservationLink、reviewed Observation Plan、Observation Task 与 Source Anchor；Training -> Retest、Training -> Transfer、Ability / TaskRole 错位阻断、Diagnosis / Evidence 对齐和重复提交幂等均成立。Material 已作为正式内容、语境和来源权威进入运行校验：历史结果保留执行时版本和内容哈希，缺失、错位或 Anchor 失效时安全阻断。Work Package B Controlled DeepSeek Live 使用三条固定 `v2` Training / Retest / Transfer 样例，在隔离正式 Repository 镜像中取得 `3 / 3 PASS`。Batch A `/learning` 单轮人工 Demo 也已通过：正式 `analysis / training` 资源形成 `fully_meets` Formal Diagnosis 和 `1` 条 Evidence，学生反馈正确回应人物特点与具体动作，刷新不重复 Diagnosis / Evidence；下一资源缺失时安全阻断。当前准确定位为“已通过真实单轮学习链路验收、具备封闭 Beta 基础的单学生教育系统”，仍等待完整 24—28 道资源包、连续 Session 和学生感知验收。[串联 Debug](./phase/reports/phase17_3_batch_a_integration_debug_acceptance_2026-07-23.md)、[Live 前置验收](./phase/reports/phase17_3_work_package_b_preflight_2026-07-23.md)、[Controlled DeepSeek Live](./phase/reports/phase17_3_controlled_deepseek_live_2026-07-23.md)、[Batch A `/learning` Demo](./phase/reports/phase17_3_batch_a_learning_demo_acceptance_2026-07-23.md)。
- [Phase 17.4 Local Shared Formal Resource Persistence](./phase/phase17_4.md) 已完成 A / B 拆分。`17.4A Shared Store Cutover` 的 Shared Store、Local API、Repository Adapter、显式基线初始化和基本备份已实现，专项 `10 / 10 PASS`；标准浏览器基线切换、全新基线 `questionQuality` 初始化、A 写 B 读、B 发布 A 读、旧 Revision `409`、服务重启持久化和临时数据清理均已通过。Codex 内置浏览器与隔离用户目录的独立 Google Chrome 已完成双向写入、刷新读取和恢复清理，当前为 `INDEPENDENT BROWSER-KERNEL CONSISTENCY PASS`。`17.4B Migration and Recovery Hardening` 为 `P2 / PLANNED`。
- [Phase 17.5 Question Generation Quality Assessment](./phase/phase17_5.md) 的 17.5A Rule v2 `14 / 14 PASS`、17.5B `11 / 11 PASS`、17.5C1 `18 / 18 PASS`、17.5C2 `22 / 22 PASS`、17.5C3A `13 / 13 PASS`、17.5C3B Calibration Runtime `16 / 16 PASS`。正式 Workbench 已接入完整质量 Bundle、Human Review 身份绑定与 Frozen Trace 原子主链。当前剩余主任务是固定真实十篇材料的采集、运行、人工观察与签署。质量评估只提供可解释审核建议，不自动改题、删题、审核、冻结，也不替代 Phase 16.2 Resource Matching Quality Gate。
- Phase 17 统一资源生产工作台已完成 2026-08-05 真实数据长流程与稳定性加固：素材保存、AI Candidate、采用、独立 Question Revision、检查、正式发布和学习入口消费完成串联；单人模式以“采用后自动发布”为唯一正常主链，质量提醒与失败恢复留在任务卡内。任务数量边界已分层冻结：现行 AI 首次规划推荐 2—3 个任务，补充采用后当前任务组最多 5 个；计划存储与结构校验层兼容既有 6 任务计划。P0-P7 最终门禁扩展为 `26 / 26 SUITES PASS`；审计快照为 29 个 Formal Version、27 个 active Registry Entry，差额 2 是同一资源演进线保留的历史 `v1 / v2`，Registry 当前指向 `v3`，不是断链或资源丢失。历史 `hint_policy` 缺省仅作为兼容提醒，不回写 Frozen Version。下一阶段进入真实十篇材料校准与连续运行观察。记录见 [真实数据长流程验收](./phase/reports/phase17_real_data_long_flow_acceptance_2026-08-05.md) 与 [资源生产稳定性加固](./phase/reports/phase17_resource_production_stability_hardening_2026-08-05.md)。
- 真实 Learning 最小采集已完成 WP0—WP7 与第四阶段工程收口：当前/历史报告分层、逐 Attempt 闭合、Projection 跨标签页单事务幂等、IndexedDB v2→v3 数据保留和运行代际统一均已验收；工程状态为 PASS，真实使用数据仍待产生，不以 Fixture 冒充真实校准。记录见 [第四阶段工程收口](./phase/reports/real_learning_stage4_engineering_closeout_2026-08-14.md)。
- Learning 反馈后一次修订已完成阶段 1–4 工程、Debug 和端到端联调验收：Initial / Revised Response 独立不可变，每题最多一次 Revision；资格决策、草稿恢复、独立提交、差异评价、feedback-supported Evidence、Outbox 恢复、完整性审计和诚实指标已接入。阶段 1–4 回归 `88 / 88 PASS`，端到端联调 `13 / 13 PASS`，IndexedDB 升级与跨标签恢复 `18 / 18 PASS`，Production Build PASS。Revision 不增加首次 Attempt 或 Calibration Projection，学生端不增加人工审核步骤。记录见 [完整工程契约](../product/LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)、[阶段 4 工程与 Debug 验收](./phase/reports/learning_feedback_revision_stage4_engineering_debug_acceptance_2026-08-14.md)和[端到端联调验收](./phase/reports/learning_feedback_revision_end_to_end_integration_debug_2026-08-14.md)。
- 阅读训练递进负担模型阶段 1 已完成原生负担语义、稳定 Hash、PlanningCandidate → TrainingTask → QuestionCandidate 同源继承与漂移 Verification；专项 `40 / 40 PASS`、统一资源生产 P0–P7 `26 / 26 SUITES PASS`、正式 Learning 入口 `17 / 17 PASS`、Production Build PASS。阶段 1 只在规划任务与候选题边界内生效，没有启用阶段 2 Planner / Prompt / 题组 Gate，也没有修改 Frozen、Learning、Diagnosis、Evidence 或 Student Profile。记录见 [阶段 1 契约](../product/READING_TRAINING_PROGRESSIVE_LOAD_STAGE1_NATIVE_SEMANTICS_ENGINEERING_AND_DEBUG_PLAN.md)与[工程验收](./phase/reports/reading_training_progressive_load_stage1_engineering_debug_acceptance_2026-08-21.md)。
- 阅读训练递进负担模型阶段 2 已完成，状态为 `IMPLEMENTED / DEBUG ACCEPTED`。真实生成边界已采用 `Seed → Plan → Realization` 两步式生成，Candidate 必须回显 Task / Plan Hash 与 rank，题组 Gate 阻止身份漂移、重复观察价值和无理由同线程跨级；不机械要求题型数量或全部负担等级，也未提前修改 Learning、Diagnosis、Evidence 或历史 Frozen Resource。专项 `48 / 48 PASS`、Draft Generator（含两步式联调）`45 / 45 PASS`。详见[阶段 2 工程计划](../product/READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_PLANNER_PROMPT_GROUP_GATE_ENGINEERING_AND_DEBUG_PLAN.md)与[工程验收](./phase/reports/reading_training_progressive_load_stage2_engineering_debug_acceptance_2026-08-24.md)。
- 阅读训练递进负担模型阶段 3 已完成工程实现、自动化 Debug 与全量浏览器联调，状态为 `IMPLEMENTED / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION PENDING`。Learning 已在 Attempt 开始时冻结正式 Progression Context，Diagnosis 保持单题表现判断，Progression Assessment 只在同一观察线程和身份一致的相邻负担层之间形成受约束归因，Evidence Admission 在长期画像前隔离题目负担风险、反馈修订与跨线程差异；历史 Frozen Resource 继续走兼容顺序，不原地补字段。专项矩阵为 `59/59 PASS`，`B3-01—B3-16` 为 `16/16 PASS`，阶段 0–2、Learning Queue、Phase 16.3 Real Chain、Persistence、Evidence 与 Production Build 已回归通过；浏览器验收使用隔离内存数据，不代表真实教育效果完成。详见[阶段 3 工程与 Debug 计划](../product/READING_TRAINING_PROGRESSIVE_LOAD_STAGE3_LEARNING_DIAGNOSIS_EVIDENCE_ENGINEERING_AND_DEBUG_PLAN.md)与[阶段 3 全量浏览器联调验收](./phase/reports/reading_training_progressive_load_stage3_full_browser_acceptance_2026-08-24.md)。
- 阅读训练递进负担模型阶段 4 已完成工程开发、自动化 Debug 与全量真实浏览器联调，状态为 `ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION NOT STARTED`。高风险历史题治理复用既有 Candidate → Adopt → Revision → Publish 形成不可变 successor；Phase 16.3 Learning 旁路追加版本绑定的真实校准事件，支持 Outbox 恢复、完整性审计和只读投影，不阻断旧主链，也不把负担风险写成学生能力。专项 `64 / 64 PASS`，`B4-01—B4-16` 为 `16 / 16 PASS`；阶段 0—3、Learning Queue、Phase 16.3、单选、开放题、Targeted 与 Production Build 均零回归。浏览器联调使用隔离内存数据，正式资源、Student Attempt、Student Profile 与真实校准分母写入均为 `0`。当前 `30` 份仅是版本化试运行复核门槛；真实样本校准尚未开始。详见[阶段 4 工程清单](../product/READING_TRAINING_PROGRESSIVE_LOAD_STAGE4_SUCCESSOR_GOVERNANCE_AND_REAL_CALIBRATION_ENGINEERING_AND_DEBUG_PLAN.md)、[工程验收报告](./phase/reports/reading_training_progressive_load_stage4_engineering_debug_acceptance_2026-08-24.md)与[全量真实浏览器联调](./phase/reports/reading_training_progressive_load_stage4_full_browser_acceptance_2026-08-24.md)。
- [产品复杂度收口契约](../product/PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)已正式冻结，状态为 `DESIGN FROZEN / ENGINEERING READY`。该契约不是阶段 5 Training Model 开发，而是跨阶段收敛页面投射、条件触发、反馈表达和能力退役复杂度；主链、Frozen Resource、Evidence 隔离、Session Snapshot、幂等、Outbox 与 Registry Version Chain 保持冻结。条件能力收益使用结构化 `expectedBenefitCode`，自由文本仅作内部说明；工程实施须按只读审计、页面投射、条件触发、反馈与 Profile 投射、稳定试用顺序推进。
- [复杂度收口阶段 0 工程与 Debug 计划](../product/PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_READ_ONLY_AUDIT_ENGINEERING_AND_DEBUG_PLAN.md)已完成，状态为 `ENGINEERING COMPLETE / DEBUG ACCEPTED / READ-ONLY VERIFIED`。`C0-01—C0-24` 为 `24/24 PASS`，`CB0-01—CB0-12` 为 `12/12 PASS`，旧主链回归通过，正式资源 / Attempt / Profile / 真实校准分母写入为 `0 / 0 / 0 / 0`；验收事实见[阶段 0 工程与 Debug 验收报告](phase/reports/product_complexity_convergence_stage0_engineering_debug_acceptance_2026-08-24.md)。
- [复杂度收口阶段 1 页面投射与默认展示收口工程计划](../product/PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)与[工程验收报告](./phase/reports/product_complexity_convergence_stage1_engineering_debug_browser_acceptance_2026-08-24.md)已经完成，状态为 `ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`。录入端和 Learning 已接入版本化纯函数投射、唯一主操作、内部术语隐藏、条件能力未触发时不可见，以及本地错误恢复；`C1-01—C1-28`、`B1-01—B1-18`、Production Build 与 685 项旧主链专项回归全部通过，正式资源、Attempt、Profile 和真实校准分母写入均为 0。
- [复杂度收口阶段 2 条件触发策略收口工程实施与 Debug 验收文档](../product/PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_CONDITIONAL_POLICY_ENGINEERING_AND_DEBUG_PLAN.md)与[工程、Debug 和浏览器验收报告](./phase/reports/product_complexity_convergence_stage2_engineering_debug_browser_acceptance_2026-08-24.md)已经完成，状态为 `ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`。阶段 2 不建立第五套调度系统，以既有 Revision、Targeted、Retest、Transfer 对象为事实权威，仅增加统一判定封套、Owner Adapter、Shadow 一致性审计、Session 策略冻结和逐项启用边界；`C2-01—C2-40` 为 `40 / 40 PASS`，`B2-01—B2-18` 为 `18 / 18 PASS`，旧主链专项回归 `353 / 353 PASS`，Production Build PASS，正式资源、Attempt、Evidence、Profile 与真实校准分母写入均为 0。生产默认仍为四项能力全部 `legacy`，本结论不等于已整体切换生产策略或完成真实教育效果验证。
- 当前暂不移动目录。
- 后续根据文档增长情况再评估是否迁移到 `models/` 分层目录。
- 后续新增教育模型文档，必须先在本 README 中登记。

## 五、文档层级关系

### Knowledge Layer

`docs/education/` 根目录下的核心模型文档定义长期教育语义，包括能力、题目、诊断、学习缺口、训练、证据、评估和学生画像。

这些文档回答：

```text
系统应该如何理解学习、能力、证据和成长？
```

### Runtime Layer

`docs/runtime/` 定义 Agent、Runtime 和开放题诊断的执行规范。

这些文档回答：

```text
模型语义如何进入可运行的 Agent / Runtime 协作？
```

### Phase Records

`docs/education/phase/` 记录各阶段当时完成的最小实现、验收标准、冻结边界和历史结论。

Phase 文档是历史记录，不会因为长期模型增强而自动重写。若 Phase 记录与最新核心模型存在差异，以最新核心模型和 Runtime 协议作为长期语义标准。

## 六、当前实现与长期协议

当前 Phase 1-7 已经跑通多条最小 Runtime 链路，其中部分实现仍采用早期组合方式，例如：

```text
AbilityEvidence
-> EvidenceSummary
-> StudentAbilityProfile
```

长期标准协议应逐步收敛为：

```text
DiagnosisResult
-> AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

因此，当前工程中的 Evidence 回流和 Profile 重算可以继续作为兼容实现保留，但不代表单条 Evidence、一次训练、一次复测或一次 Session 可以直接确认长期能力状态变化。
