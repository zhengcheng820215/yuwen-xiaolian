# 产品领域语义与主链契约

英文名称：Product Domain Semantics and Main Chain Contract

文档类型：`NORMATIVE_CONTRACT`

状态：`ACTIVE / DESIGN FROZEN / SEMANTIC AUTHORITY`

生效日期：2026-08-31

当前状态来源：[当前产品状态](./CURRENT_PRODUCT_STATE.md)

文档治理：[产品文档治理契约](./PRODUCT_DOCUMENT_GOVERNANCE_CONTRACT.md)

## 一、目标

本契约是产品核心对象、主链、状态和同名概念的统一语义入口。它不新增领域对象、不改变已发布资源，也不重建 Material → Plan → Task → Candidate → Publish → Learning 主链。

其他 ACTIVE 契约可以负责某个子领域，但不得重新定义本文已经冻结的对象身份、所有权和跨边界含义。

## 二、完整领域主链

正式资源到 Learning 的完整领域链为：

```text
Material
→ MaterialVersion
→ ObservationPlan / PlanRevision
→ TrainingTask
→ QuestionLineage
→ QuestionCandidate
→ AdoptionCommand
→ QuestionRevision
→ Validation
→ QualityAssessment
→ ResourceReviewDecision（同次采用的内部审计记录）
→ FrozenResourceVersion
→ ActiveRegistryLink + ActiveObservationLink + FrozenQualityTrace
→ LearningConsumable
→ LearningSessionTaskQueue
→ Attempt
→ Diagnosis
→ AbilityEvidence
→ RevisedResponse（条件触发，最多一次）
→ Retest / Transfer
```

文档可以使用以下概念简写：

```text
Material → Plan → Task → Candidate → Publish → Learning
```

简写只用于说明产品阶段，不表示 Adoption、Revision、Validation、Assessment、Freeze、Registry 或 Quality Trace 可以省略。涉及写入、失败恢复、身份或验收时必须使用完整领域链或明确链接本文。

## 三、Candidate 语义

### 3.1 TrainingTaskCandidate

- 属于 Observation Plan / Plan Revision；
- 表示一组待采用的训练任务规划；
- 用户操作为“采用当前任务方案”或重新生成；
- 采用后保存 Plan Revision 并执行结构检查；
- 不创建 Question Revision，不发布题目，不进入 Learning。

### 3.2 QuestionCandidate

- 属于具体 Question Lineage 和 TrainingTask；
- 是一道完整、不可拆分的题目方案；
- 采用前不得写入 Frozen Resource 或 Active Registry；
- 用户操作为“采用并发布”或重新优化；
- 只有采用命令完成正式化阶段后才成为 Learning Consumable。

`TrainingTaskCandidate` 与 `QuestionCandidate` 不共享 Revision、命令或存储语义。界面只有在上下文绝对唯一时才可简称“候选”。

## 四、采用、审核与发布

单人产品的人工责任只有一次：接受或拒绝 AI 完整方案。

```text
前台：采用并发布
后台：Adoption → Revision → Validation → Assessment
      → ResourceReviewDecision → Freeze → Registry
```

`ResourceReviewDecision` 是同一次采用产生的结构化审计记录，不等于第二位审核人、第二次确认或自由文本审核意见。默认单人工作台不得展示“提交教师审核”“填写审核意见”“最终确认后发布”等连续步骤。

只有未来显式启用多人治理模式时，独立审核角色才可以成为新的用户责任；该模式必须另行冻结，不得借内部字段暗中进入当前主链。

## 五、Revision 语义

“Revision”必须带所有者或完整对象名：

| 名称 | 所属边界 | 含义 |
| --- | --- | --- |
| `PlanRevision` | 生产端 | Observation Plan 的版本 |
| `QuestionRevision` | 生产端 | 采用 QuestionCandidate 后形成的待正式化题目版本 |
| `RevisedResponse` | Learning | 学生在正式反馈后的一次受控修订回答 |

`RevisedResponse` 不覆盖首次独立 Attempt，不改变 QuestionRevision，也不自动升级 Student Ability Profile。

## 六、正式资源与数量语义

正式题数量、材料数量、Store Revision、Registry 数量和 Learning Consumable 数量都是带身份与采样时间的运行事实，不是长期契约常量。

历史文档中的 `34 / 34`、`46 / 46`、`81 / 81` 等只表示对应报告时点的完整性证据。ACTIVE 契约引用这些数字时必须使用“当时”“该次验收”或“历史基线”，并链接证据；不得写成“当前必须保持 N 道”。

当前数量只能从实时 Formal Store / Registry 复读，并由[当前产品状态](./CURRENT_PRODUCT_STATE.md)记录最近一次采样结论。

一个 Question Version 成为当前 Learning Consumable，至少必须同时满足：

- Material Version 当前有效；
- Frozen Resource Version 身份完整；
- Active Registry Link 与 Active Observation Link 同源；
- Frozen Quality Trace 身份一致；
- 题型能力与 Learning Renderer 可用。

## 七、Learning 与能力解释

1. `TaskLoadSemantics / Load Profile` 是题目负担属性，不是学生能力等级。
2. Diagnosis 必须区分题目负担过高、回答无效、具体动作缺口和能力证据不足。
3. Ability Evidence 只能来自身份完整、满足准入条件的 Attempt。
4. RevisedResponse 是反馈支持下形成的修订证据，不能替代独立 Retest / Transfer。
5. Single Choice 的错误反馈由选项身份与 distractor rationale 驱动，不套用文本题 Rubric 补全模板。
6. Targeted Micro-training 复用同一正式资源与 Learning 链，只改变材料角色和调度条件，不建立第二套题库。

## 八、状态与 Trial

Design、Engineering、Product Acceptance 和 Live 四轴严格遵循[产品文档治理契约](./PRODUCT_DOCUMENT_GOVERNANCE_CONTRACT.md)。

- Engineering PASS 不自动产生 Product Acceptance PASS；
- Product Acceptance PASS 不自动产生 Live ACTIVE；
- 历史 Trial 激活不证明当前 Trial 有效；
- Runtime Identity、Provider、正式资源或策略身份变化后必须重新准入；
- 当前 Trial 状态只读取实时绑定与[当前产品状态](./CURRENT_PRODUCT_STATE.md)。

## 九、冲突处理

同一概念出现多个定义时：

1. 先读取 [`product-semantic-authority.json`](./product-semantic-authority.json) 指定的概念权威文档；
2. 子领域契约只补充本领域规则，不得改变上位身份和所有权；
3. 阶段计划和验收报告只记录实施与证据；
4. 历史数字和状态必须保留时间边界；
5. 无法消歧时停止扩展，先更新本契约和语义权威表。

## 十、P2 完成定义

1. 核心概念均有且只有一个语义权威来源；
2. ACTIVE 规范不再把历史题量写成当前不变量；
3. 学生修订、生产 Revision 和 Plan Revision 不再混用；
4. 单次人工采用与内部审核留痕不再投射成两次人工步骤；
5. 语义审计和 P1 文档治理审计同时通过；
6. 产品运行代码、正式资源和 Learning 数据零写入。

