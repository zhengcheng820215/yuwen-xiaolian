# 正式资源生产契约地图

英文名称：Formal Resource Production Contract Map

状态：ACTIVE  
文档版本：`formal_resource_production_contract_map_v1`  
更新日期：2026-07-29

## 一、目标与权威边界

本文说明素材录入、训练任务规划、题目审核与正式发布相关契约的职责关系、阅读顺序和问题路由。

本文只是一份契约索引地图，不新增字段、状态、身份、版本或业务规则，也不替代被引用契约。

当本文摘要与正式契约不一致时，以对应职责范围内的正式契约为准，并同步修正本文。

## 二、正式资源生产主链

```text
Material Version
-> Observation Plan Revision
-> Training Task
-> Question Draft Revision
-> Contract Validation / Quality Assessment
-> Human Review
-> Frozen Resource Version
-> Registry / Active Link
-> Formal Runtime
```

| 对象或阶段 | 核心职责 |
| --- | --- |
| Material Version | 保存可追溯的素材内容与来源版本 |
| Observation Plan Revision | 冻结一次训练任务规划的提交版本 |
| Training Task | 描述学生需要完成的学习动作与观察目标 |
| Question Draft Revision | 承载可编辑、可校验、可送审的题目草稿 |
| Contract Validation | 判断草稿结构是否合法，失败时阻断送审 |
| Quality Assessment | 判断候选是否值得审核，输出可追溯的质量结论 |
| Human Review | 由人工决定通过、退回修改或拒绝 |
| Frozen Resource Version | 形成不可静默修改的正式资源版本 |
| Registry / Active Link | 指向当前可用的正式版本并管理启用关系 |
| Formal Runtime | 消费正式资源，不回写或改写资源语义 |

## 三、AI 候选支线

AI 生成内容在被人工采用前不属于正式资源主链。

```text
AI Candidate Session
-> 人工采用候选
-> 编辑缓冲区
-> 保存工作草稿
-> 提交并冻结 Observation Plan Revision
-> 进入正式资源生产主链
```

候选、编辑缓冲区和工作草稿必须与已提交版本区分。预览、生成候选或在页面中展开内容，均不能被解释为已经保存、审核或正式化。

## 四、契约关系

| 契约 | 负责回答 | 不负责回答 |
| --- | --- | --- |
| [录入字段契约](./AUTHORING_FIELD_CONTRACT.md) | 字段由谁生成、谁编辑、如何保存、何时失效，以及字段如何跨阶段适配 | AI 候选组操作和审核发布状态流 |
| [单训练任务重新生成契约](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md) | 单个候选任务重新生成、采用、身份和版本边界 | 整组任务规划和正式题目发布 |
| [训练任务组 AI 规划契约](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md) | 补充候选、整组替代方案、工作草稿和批量采用边界 | 单题审核与 Frozen Resource 状态 |
| [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md) | 录入端负责改、审核端负责判、发布负责正式化的跨平台边界 | 每个页面字段和按钮的详细实现 |
| [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md) | 审核、退回、通过、冻结、发布与恢复的具体工作流 | 上游 AI 候选生成与任务组规划 |
| [产品颜色语义规范](./PRODUCT_COLOR_SEMANTICS.md) | 跨平台状态色、操作色和组件颜色语义 | 业务状态本身及其转换规则 |

## 五、建议阅读顺序

### 5.1 快速理解完整生产链

1. 本文；
2. [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md)；
3. [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)。

### 5.2 开发录入字段与保存能力

1. 本文；
2. [录入字段契约](./AUTHORING_FIELD_CONTRACT.md)；
3. 根据操作颗粒度继续阅读单任务或任务组 AI 契约。

### 5.3 开发 AI 候选与重新生成能力

1. [单训练任务重新生成契约](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md)；
2. [训练任务组 AI 规划契约](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md)；
3. [录入字段契约](./AUTHORING_FIELD_CONTRACT.md)。

### 5.4 开发审核、冻结与发布能力

1. [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md)；
2. [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)；
3. [产品颜色语义规范](./PRODUCT_COLOR_SEMANTICS.md)。

## 六、问题冲突路由

| 问题类型 | 权威文档 |
| --- | --- |
| 字段含义、来源、编辑权、保存和失效冲突 | [AUTHORING_FIELD_CONTRACT.md](./AUTHORING_FIELD_CONTRACT.md) |
| 单个训练任务候选、身份或 Revision 冲突 | [SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md) |
| 补充候选、整组规划或工作草稿冲突 | [TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md) |
| 录入端、审核端与发布端职责冲突 | [AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md) |
| 审核状态、退回、冻结、发布或恢复冲突 | [QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md) |
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

正式资源生产已经形成从素材版本、训练任务规划、题目草稿、质量检查、人工审核到冻结发布的可追溯主链。

本地图为产品、设计、开发和验收提供统一入口，使问题能够回到正确契约解决，而不是在页面实现或阶段文档中重复定义规则。
