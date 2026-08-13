# 正式资源生产契约地图

英文名称：Formal Resource Production Contract Map

状态：ACTIVE CONTRACT INDEX / AI CANDIDATE P0-P7 COMPLETE / ACCEPTANCE RECORDED
文档版本：`formal_resource_production_contract_map_v4.0`
更新日期：2026-08-13

## 一、目标与权威边界

本文说明素材录入、训练任务规划、题目审核与正式发布相关契约的职责关系、阅读顺序和问题路由。

材料正文、来源元数据、题组覆盖和历史质量证据的版本化校准，统一遵循 [MATERIAL_CORPUS_QUALITY_AND_VERSIONING_CONTRACT.md](./MATERIAL_CORPUS_QUALITY_AND_VERSIONING_CONTRACT.md)。该合同禁止原地覆盖 Material Version 或 Frozen Question Version，并定义生产端与 Learning 的共同当前资源口径。

AI 题目的人工作业和真实样本观察遵循 [AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md)。生产主链只有“采用并发布 / 不采用并重新优化”一次人工选择；真实作答校准只在 Learning 使用后后台运行，不增加审核步骤。

AI 题目的完整生成、作答格式匹配、同篇去重、能力梯度与少量定向替换遵循 [AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md](./AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md)。该契约禁止整批覆盖正式题，并要求未采用候选不影响 Registry、Observation Link 或 Learning。

阶段1—5已经完成十篇材料、34道正式题的基线、规则、候选、逐题采用发布和素材收口；最终执行状态见[阶段5收口计划与执行记录](./AI_QUESTION_OPTIMIZATION_STAGE5_CLOSURE_PLAN_2026-08-13.md)。真实作答校准已具备能力但仍等待真实 Learning 样本，不得以模拟样本提前宣称稳定。

本文只是一份契约索引地图，不新增字段、状态、身份、版本或业务规则，也不替代被引用契约。

当本文摘要与正式契约不一致时，以对应职责范围内的正式契约为准，并同步修正本文。

统一资源生产工作台是单人模式的目标态唯一可写生产与发布入口。目标态中，素材录入、AI 规划、不可变 Candidate 生成与采用、内联质量检查、自动正式化编排和失败恢复在同一页面完成；旧题目工作台只承担安全适配与只读审计。正常路径以“采用并发布”为唯一主操作，采用后由应用层自动编排发布；底层仍分别保存 Revision、Validation / Assessment、Human Review、Freeze、Formal Version 和 Registry 结果。

P0-P7 既有对象关系、命令边界、任务卡主链路、按任务部分发布和端到端 Debug 已完成验收。单页发布收口已按 P0-P2 完成工程实现、专项回归与浏览器验收；完成结论以统一工作台契约和专项验收记录为准，而不是仅沿用历史 P0-P7 结论。

### 1.1 契约目标与工程状态

本地图同时记录长期契约目标和阶段工程事实。二者必须分开读取：

| 层级 | 当前状态 | 解释 |
| --- | --- | --- |
| 领域对象与写入边界 | 已冻结 | Revision、Assessment、Human Review、Freeze、Formal Version 和 Registry 的身份与写入边界继续有效 |
| 历史 P0-P7 基线 | 已验收 | 证明对象关系、命令边界、部分发布和端到端主链已经通过回归 |
| AI Candidate 生产边界 | 已完成 | Candidate 是正式生产的唯一前置入口，采用后才创建 Question Revision；旧 Working Content 仅保留只读迁移能力 |
| 单页生产与发布目标 | 已冻结 | 当前产品与设计实现以统一工作台和“采用后自动发布”为唯一主链 |
| 单页发布 P0-P2 工程实现 | 已完成 | 统一状态、任务卡动作和单页发布链已落地并通过专项回归 |
| 工程与浏览器验收 | 已记录 | P0-P7 聚合套件、生产构建及 P2 浏览器证据均已归档 |
| 专项产品校准 | 进行中 | 十素材校准和单任务完整采用发布验收独立跟踪，不反向标记主链工程未完成 |

因此，“目标态唯一入口”既是当前契约要求，也是 P0-P2 已完成的工程事实。页面、测试和验收报告引用状态时，仍必须注明是在描述历史基线、当前运行态还是尚未完成的专项产品校准。

统一交付状态固定为：

- **Engineering Complete**：契约、工程实现、自动化回归与已记录浏览器验收完成；
- **Operational Validation In Progress**：十素材校准、真实单任务长流程与连续运行仍在验证；
- **Production Scale Approval Pending**：多人并发、长期真实数据和规模化运营批准尚未完成。

`Engineering Complete` 不等于长期运营验收完成，也不得被用作规模化生产批准的替代结论。

## 二、正式资源生产主链

```text
Material Version
-> Observation Plan Revision
-> Training Task
-> Question Candidate
-> Adopt Decision
-> Question Lineage
-> Question Draft Revision
-> Contract Validation / Quality Assessment
-> Human Review Decision（由采用后的应用层编排形成）
-> Frozen Resource Version
-> Registry / Active Link
-> Formal Runtime
```

| 对象或阶段 | 核心职责 |
| --- | --- |
| Material Version | 保存可追溯的素材内容与来源版本 |
| Observation Plan Revision | 冻结一次训练任务规划的提交版本 |
| Training Task | 描述学生需要完成的学习动作与观察目标 |
| Question Candidate | 承载 AI 生成、重新生成、优化或异常纠错形成的不可变候选，不进入正式资源链 |
| Adopt Decision | 记录人工采用决定，是 Candidate 创建 Question Lineage 或后继 Question Draft Revision 的唯一边界 |
| Question Lineage | 维持一项训练任务对应题目从活动草稿到多个正式版本的稳定身份 |
| Question Draft Revision | 承载可编辑、可校验、可送审的题目草稿 |
| Contract Validation | 判断草稿结构是否合法，失败时阻断送审 |
| Quality Assessment | 判断候选是否值得审核，输出可追溯的质量结论 |
| Human Review Decision | 记录用户基于当前 Revision 与 Assessment Bundle 作出的发布决定，不要求独立审核页面 |
| Frozen Resource Version | 形成不可静默修改的正式资源版本 |
| Registry / Active Link | 指向当前可用的正式版本并管理启用关系 |
| Formal Runtime | 消费正式资源，不回写或改写资源语义 |

## 三、AI 候选支线

AI 生成内容在被人工采用前不属于正式资源主链。Candidate 不进入编辑缓冲区或可变工作草稿；标准流程不提供字段级人工编辑。

```text
Material Version + Observation Plan Revision + Training Task
-> AI 生成不可变 Question Candidate
-> 人工判断
   -> 重新生成 Candidate
   -> 结构化优化 Candidate
   -> 权限受控异常纠错 Candidate
   -> 采用 Candidate
-> Question Lineage
-> Question Draft Revision
-> Validation / Assessment / Human Review / Freeze / Publication
```

预览、生成、重新生成或优化 Candidate 均不能被解释为已经创建 Revision、完成审核或正式化。只有显式采用 Candidate 才允许进入 Question Revision；未采用 Candidate 不得进入 Validation、Assessment、Human Review、Freeze、Formal Resource 或 Registry。

### 3.1 Candidate 命名空间与写入边界

生产链存在两类处于不同层级的候选，文档、命令、Schema 和测试不得仅使用无前缀的 `Candidate` 指代二者：

| 对象 | 所属阶段 | 采用目标 | 何时创建 Revision | 禁止行为 |
| --- | --- | --- | --- | --- |
| `TrainingTaskCandidate` | 上游 Observation Plan / 训练任务规划 | Plan 编辑缓冲区 | 用户确认任务组时创建或更新 Plan Revision | 不创建 Question Revision，不进入题目检查或发布 |
| `QuestionCandidate` | 下游正式题目生产 | Question Lineage | 显式采用时创建一个 Question Draft Revision | 不进入 Plan 编辑缓冲区，不在采用前进入检查或发布 |

`TrainingTaskCandidate` 的“采用”与 `QuestionCandidate` 的“采用”不是同一命令，也不共享 Revision 语义。新接口、事件和存储对象必须携带完整对象前缀；仅在上下文已经唯一确定时，界面文案可以使用“候选”。

## 四、契约关系

| 契约 | 负责回答 | 不负责回答 |
| --- | --- | --- |
| [录入字段契约](./AUTHORING_FIELD_CONTRACT.md) | 字段由谁生成、Candidate 如何映射、采用后何时失效，以及异常纠错如何审计 | AI 候选组操作和审核发布状态流 |
| [单训练任务重新生成契约](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md) | 单个候选任务重新生成、采用、身份和版本边界 | 整组任务规划和正式题目发布 |
| [训练任务组 AI 规划契约](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md) | 补充候选、整组替代方案、工作草稿和批量采用边界 | 单题审核与 Frozen Resource 状态 |
| [AI 资源生成与优化工作流契约](./AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md) | Question Candidate 的身份、不可变规则、生成、优化、采用、异常纠错及旧 Working Content 退出边界 | 上游训练任务组规划和采用后的审核发布状态流 |
| [AI 题目生成质量与定向优化契约](./AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md) | 完整题目方案、作答格式匹配、同篇去重、能力梯度、4道试点和逐题原子替换 | 材料正文换版、人工字段编辑和批量自动覆盖 |
| [AI 题目采用与真实作答校准契约](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md) | 单次采用发布、内部断点结果、失败恢复及 Learning 后台真实样本校准 | 人工字段编辑、第二次确认和模拟样本造数 |
| [正式资源不可变性契约](./FORMAL_RESOURCE_IMMUTABILITY_CONTRACT.md) | Formal Resource 发布后的不可变边界、新版 Candidate、活动 Registry 切换和历史学习版本引用 | Candidate Prompt、Assessment 规则和 Runtime 选题策略 |
| [材料语料质量与版本升级契约](./MATERIAL_CORPUS_QUALITY_AND_VERSIONING_CONTRACT.md) | 正文换版、材料元数据、Plan / Task / Formal Resource 接续、历史关系清理及 Learning 当前版本消费 | Candidate Prompt 与单题编辑字段 |
| [统一资源生产工作台契约](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md) | TrainingTask 与 QuestionLineage 关系、统一任务状态、任务卡主操作、部分发布和分阶段迁移 | 不替代字段、Assessment、Human Review、Freeze 与 Registry 的领域契约 |
| [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md) | 编辑与检查、人工发布决定、正式化三类领域职责；这些职责不等于三个页面 | 每个页面字段和按钮的详细实现 |
| [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md) | 任务卡内检查、人工发布决定、冻结、发布、部分失败与恢复的具体工作流 | 上游 AI 候选生成与任务组规划 |
| [产品颜色语义规范](./PRODUCT_COLOR_SEMANTICS.md) | 跨平台状态色、操作色和组件颜色语义 | 业务状态本身及其转换规则 |

## 五、建议阅读顺序

### 5.1 快速理解完整生产链

1. 本文；
2. [统一资源生产工作台契约](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md)；
3. [AI 资源生成与优化工作流契约](./AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md)；
4. [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md)；
5. [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)。

### 5.2 开发统一工作台与任务卡状态

1. [统一资源生产工作台契约](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md)；
2. [AI 资源生成与优化工作流契约](./AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md)；
3. [录入字段契约](./AUTHORING_FIELD_CONTRACT.md)；
4. [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)；
5. [产品颜色语义规范](./PRODUCT_COLOR_SEMANTICS.md)。

### 5.3 开发字段映射、校验与异常纠错能力

1. 本文；
2. [录入字段契约](./AUTHORING_FIELD_CONTRACT.md)；
3. 根据操作颗粒度继续阅读单任务或任务组 AI 契约。

### 5.4 开发 AI 候选与重新生成能力

1. [AI 资源生成与优化工作流契约](./AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md)；
2. [AI 题目生成质量与定向优化契约](./AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md)；
3. [单训练任务重新生成契约](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md)；
4. [训练任务组 AI 规划契约](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md)；
5. [录入字段契约](./AUTHORING_FIELD_CONTRACT.md)。

### 5.5 开发人工发布决定、冻结与恢复能力

1. [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md)；
2. [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)；
3. [正式资源不可变性契约](./FORMAL_RESOURCE_IMMUTABILITY_CONTRACT.md)；
4. [产品颜色语义规范](./PRODUCT_COLOR_SEMANTICS.md)。

### 5.6 执行材料正文、任务覆盖或历史关系校准

1. [材料语料质量与版本升级契约](./MATERIAL_CORPUS_QUALITY_AND_VERSIONING_CONTRACT.md)；
2. [正式资源不可变性契约](./FORMAL_RESOURCE_IMMUTABILITY_CONTRACT.md)；
3. [统一资源生产工作台契约](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md)；
4. [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)。

### 5.7 执行 P7 最终端到端验收

1. [统一资源生产工作台契约 P7](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md#p7端到端验收与文档同步)；
2. [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md)；
3. [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)；
4. [学生产品界面收口文档](./STUDENT_PRODUCT_INTERFACE_CONSOLIDATION.md)。

P7 的详细场景、故障注入、缺陷门禁和完成定义只在统一资源生产工作台契约中维护；本地图不复制第二份验收清单。

P7 已于 2026-08-03 完成，验收证据见 [Phase 17 统一资源生产工作台 P7 Debug 验收记录](../education/phase/reports/phase17_unified_resource_production_p7_debug_acceptance_2026-08-03.md)。

P0-P7 最终串联验收已于 2026-08-03 完成，统一命令为 `pnpm run debug:unified-resource-production-final`，完整证据见 [Phase 17 统一资源生产 P0-P7 最终串联验收报告](../education/phase/reports/phase17_unified_resource_production_p0_p7_final_integration_acceptance_2026-08-03.md)。

人工 Demo 与后续问题复验证据见 [Phase 17 统一资源生产工作台人工 Demo 验收记录](../education/phase/reports/phase17_unified_resource_production_manual_demo_acceptance_2026-08-03.md)。单题检查过程可见性、素材标题格式幂等和学习入口空结果分型统一由 [统一资源生产工作台契约 21.10](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md#2110-单题检查可观察性标题幂等与学习空状态) 约束。

2026-08-06 版本收口进一步确认：未生成题目的任务卡只进入 Question Candidate 生成与采用流程；Candidate 采用产生的 Draft 同时写入任务身份标签，并对仅保留 `taskId` 的历史数据提供任务身份恢复；生成、采用、检查、最终确认、发布及刷新恢复的人工 Demo 已通过。Node 执行环境统一声明为 ESM，`MODULE_TYPELESS_PACKAGE_JSON` 警告已消除。对应门禁为 `pnpm debug:task-production-state`、`pnpm debug:material-resource-workbench-state`、`pnpm debug:question-publication-recovery`、`pnpm debug:question-candidate-optimization`、`pnpm debug:unified-resource-production-final` 与 `pnpm build`。

## 六、问题冲突路由

| 问题类型 | 权威文档 |
| --- | --- |
| 字段含义、来源、Candidate 映射、异常纠错、审计和失效冲突 | [AUTHORING_FIELD_CONTRACT.md](./AUTHORING_FIELD_CONTRACT.md) |
| 单个训练任务候选、身份或 Revision 冲突 | [SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md) |
| 补充候选、整组规划或工作草稿冲突 | [TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md) |
| Question Candidate 身份、不可变性、生成、优化、采用、异常纠错或旧 Working Content 退出冲突 | [AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md](./AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md) |
| 已发布内容修改、新版候选、正式版本覆盖、活动 Registry 切换或历史学习版本引用冲突 | [FORMAL_RESOURCE_IMMUTABILITY_CONTRACT.md](./FORMAL_RESOURCE_IMMUTABILITY_CONTRACT.md) |
| 材料正文修订、元数据、Plan 换代、历史活动关系或 Learning 当前版本消费冲突 | [MATERIAL_CORPUS_QUALITY_AND_VERSIONING_CONTRACT.md](./MATERIAL_CORPUS_QUALITY_AND_VERSIONING_CONTRACT.md) |
| 统一入口、任务卡主状态、任务组汇总、部分发布或迁移顺序冲突 | [UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md) |
| 编辑与检查、人工发布决定、正式化职责冲突 | [AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md) |
| Revision 绑定、内联检查、Human Review、冻结、发布或恢复冲突 | [QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md) |
| 颜色、标签和操作组件语义冲突 | [PRODUCT_COLOR_SEMANTICS.md](./PRODUCT_COLOR_SEMANTICS.md) |

## 七、冲突裁决原则

1. 本文只负责路由，不凭索引摘要创造业务规则。
2. 每项问题由其职责范围内的正式契约解释。
3. Phase 文档用于记录阶段目标、实现状态和验收，不替代长期有效的产品契约。
4. 当多个契约同时涉及同一流程时，先按职责边界拆分问题，再分别应用字段、候选操作、审核状态或颜色语义契约。
5. 若发现契约之间存在真实冲突，应修订契约并记录版本，不在页面代码中增加未被文档承认的隐式适配。

## 八、不覆盖范围

本文不负责以下内容：

1. 学生学习 Runtime、Session 与任务消费流程；
2. Diagnosis、Learning Gap、Evidence、Evaluation 与 Student Profile；
3. Shared Store、备份、迁移和跨设备同步的基础设施实现；
4. 学习效果、反馈有用性和学生长期成长验证；
5. Phase 状态、工程 Debug 结果和产品验收结论。

这些内容应继续由相应模型、Runtime、Phase 和验收文档维护。

## 九、维护规则

出现以下变化时必须更新本文：

1. 新增、重命名或废弃正式资源生产契约；
2. Material、Plan、Question、Review、Freeze 或 Registry 的职责边界发生变化；
3. 主链增加新的正式对象或删除现有对象；
4. 冲突路由的权威文档发生变化。

本文不复制契约中的详细 Schema、状态枚举、按钮文案或 Debug 清单，避免产生第二套事实来源。

## 十、当前结论

正式资源生产已经形成从素材版本、训练任务规划、不可变 Question Candidate、人工采用、题目 Revision、内联质量检查、人工发布决定到冻结发布和学习读取的可追溯主链。单人模式的现行体验目标是一个页面、一次发布决定，不暴露常驻版本选择，也不重复进入审核或最终确认页面。Candidate 不进入正式资源链；Revision、Assessment、Human Review、Freeze 与 Registry 仍作为底层正式对象保留。

历史 P0-P7 已完成最终聚合自动化、浏览器、失败恢复、学习入口、静态检查和生产构建验收；单页发布 P0-P2 工程实现、专项回归与浏览器验收也已完成。十素材校准、单任务完整采用发布验收和 Bundle 性能优化属于独立后续项，不影响主链的 Engineering Complete。多人独立审核模式仍是后续独立决策。

本地图为产品、设计、开发和验收提供统一入口，使问题能够回到正确契约解决，而不是在页面实现或阶段文档中重复定义规则。
