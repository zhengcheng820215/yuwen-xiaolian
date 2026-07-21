# 单学生产品界面与入口收敛

英文名称：Single-Student Product Interface Consolidation  
文档定位：Phase 16 Post-Integration Product Consolidation  
设计状态：ACCEPTED  
工程状态：IN PROGRESS（`/learning` 学生反馈体验校准与 Product / Demo 数据隔离已完成）  
记录日期：2026-07-21

## 一、文档定位

本文定义 Phase 16 Runtime 主链成立后，单学生真实使用页面与内部入口的收敛方式。

它不新增 Phase 编号，不新增教育判断能力，不重写已冻结的 Phase 8—15，也不改变 Phase 16.3C 自然日验收边界。

它只回答：

> 已经成立的题目、作答、Diagnosis、Evidence、反馈、恢复和复测能力，如何整理为学生能够连续使用、内部人员能够稳定维护的产品入口？

本文是产品执行与页面职责规范，不是完整设计系统，也不是视觉品牌规范。

## 二、当前基础

当前已经成立：

- `/learning` 统一学生入口；
- 正式 Frozen Resource 到学生作答的主链；
- 服务端 Diagnosis Application Boundary；
- AbilityEvidence、Profile、GrowthMemory 与下一任务回流；
- IndexedDB 本地持久化和同一回合恢复；
- Learning Session History 与 Delayed Retest；
- 独立内部复核入口；
- Phase 16.3A / B `PASS / FROZEN`；
- Phase 16.3C Engineering、Controlled Live 与 Lightweight Human Demo `PASS`；
- Phase 16.3C 自然日验收仍为 `PENDING (0 / 5)`。
- 正式 `/learning` 使用独立产品学生身份，Demo / Debug 使用独立验收身份；作用域隔离 Debug `9 / 9 PASS`。

页面收敛的目标不是再次证明这些 Runtime 能力存在，而是减少真实使用中的入口分散、状态重复、工程信息暴露和操作死路。

## 三、一句话目标

> 让一个学生只通过一个正式入口完成开始、作答、反馈、恢复、复测和下一轮；让内部人员只通过一个内部入口完成内容准备、运行复核和验收检查。

## 四、入口信息架构

目标入口只保留三个层次：

```text
/learning
学生唯一正式入口

/internal
内部内容与运行工作入口

/internal/acceptance
开发、Debug 与人工验收入口
```

### 4.1 学生入口 `/learning`

使用者：学生。

只负责：

- 开始新的学习；
- 继续未完成回合；
- 恢复答案草稿；
- 处理已提交但尚未完成的结果；
- 完成到期复测；
- 查看正式反馈；
- 进入下一轮；
- 结束当前 Session。

学生不需要知道任务来自哪个 Phase、哪个 Agent 或哪个 Repository。

### 4.2 内部入口 `/internal`

第一版主要使用者：内容维护人员、开发者、运行复核与验收人员。

第一版只聚合既有能力：

- 结构化题目录入与审核；
- Frozen Resource 与 Registry 状态；
- 资源匹配质量检查；
- Diagnosis、Evidence 与 ProfileUpdateDecision 复核；
- Learning Session 与 Multi-day History；
- Provider、持久化与运行异常；
- 进入独立验收入口。

内部入口只负责导航、状态摘要和进入既有工作页面，不重新实现各模块 Runtime。

`/internal` 第一版是内部工作导航集合，不代表未来家长、教师、内容人员和开发者共用相同的信息权限或页面结构。本阶段不为家长使用场景扩展功能；家长端、正式报告与角色权限仍属于后续产品范围。

### 4.3 验收入口 `/internal/acceptance`

使用者：开发与验收人员。

聚合：

- 当前仍有维护价值的 Phase Demo；
- Debug / Smoke / Human Acceptance 入口；
- 每个入口的验证范围和限制；
- 是否调用真实 Provider；
- 是否写入正式数据；
- 当前验收状态。

该入口必须与学生体验隔离。生产环境可以隐藏或受权限控制，学生端导航不得出现。

### 4.4 正式入口状态解析

项目继续复用已有的 `unifiedLearningEntryAgent` 与 `UnifiedLearningEntryState`，不创建第二套 `LearningEntryState`、入口 Agent 或平行状态机。

正式入口关系为：

```text
Session / Checkpoint / Draft / Operation
RetestPlan / Feedback / Next Task
↓
unifiedLearningEntryAgent
↓
UnifiedLearningEntryState
↓
/learning
```

`UnifiedLearningEntryState` 是 `/learning` 当前主流程状态、主要动作和允许进入工作区与否的唯一权威输出。页面只能消费该正式状态及对应 Application Service 提供的命令，不得并行读取多个 Repository 的原始记录后自行决定当前入口。

学生反馈同样遵循单一正式来源：页面只消费 `StudentLearningFeedback` / `ControlledFeedbackResult` 中经过转译的 Teaching Plan，不得读取或拼接 Diagnosis `rootCause`、Evidence detail、evaluator message 或内部 reason。Teaching Plan 应根据 Frozen Task 的题干与作答要求提取“题目对象 + 考查维度 + 依据类型”，将运行状态转成当前题目的具体提示；无法可靠提取时必须使用克制的通用提示，不得猜测。反馈展示顺序采用“理解提示 → 已核验原文细节 → 修改动作”；表达字段缺失时使用安全模板，不得回退展示内部诊断原文。

正向反馈也必须经过同一转译边界。学生端统一使用“思路点评”，不以空泛表扬代替具体反馈。`Positive / Growth Evidence` 只有在包含具体、可追溯的本次作答事实时，才能直接生成点评；若 Evidence 已正式确认正向方向，但其 detail 只有能力码或运行摘要，则必须同时绑定学生原答案，使用可逐字核验的回答片段形成克制点评。“任务基本满足要求”“可形成正向能力证据”、能力码或其他运行摘要不得展示给学生。没有 Positive / Growth Evidence，或答案为 `does_not_meet` / `insufficient_evidence` 时，不得仅凭学生原文生成正向点评。旧持久化反馈恢复时必须按当前规则只读重建正向展示和学生可读摘要，不重跑 Provider，也不改写正式 Evidence。

“思路点评”的正式含义是本题关键任务要求覆盖，不是表扬模块，也不是学生答案复述。Feedback Adapter 应先把 Frozen Task 拆为结论、文本依据、依据与结论关系及其他明确表达要求，再为每个环节生成 `covered / partially_covered / missing / insufficient_to_judge` 状态。完整状态保存在 `thinkingReview.requirementCoverage` 中；学生端只消费安全投影 `coveredPoints`、`primaryGap` 和兼容字段 `missingPoints`，分别显示为“回答到位”和“还需调整 / 还需补充”。学生端最多展示一至两个到位点和一个主要缺口，不直接暴露完整评分清单。

关键点只能来自 Frozen Task 的正式作答要求、Rubric / assessment basis、材料中可核验的内容以及已提交的正式 Diagnosis / Evidence。参考答案只能提供可接受方向，不能成为唯一措辞；合理异表述应通过受控语义归一、动作谓词和上下文对象关系识别，不要求命中参考答案关键词。无法可靠判断时必须标记 `insufficient_to_judge`，不得强行归为错误或遗漏。表达模型不能新增、删除或改变覆盖结论。

文本依据的学生端展示还必须通过“完整事实片段 + 语义关联”校验。关键词或子串重合不能单独构成 `studentEvidence`；“自己、当时、这样、那里”等孤立代词、时间词和指示词，以及泛化名词或无动作关系的碎片，即使同时出现在答案与材料中，也不能通过。有效依据必须能在学生答案中定位到完整句段，并与正式任务事实共享可核验的动作、对象或状态关系。学生使用“把雨伞往孩子那边推”等合理动作改写时可以通过，不要求逐字复刻材料。没有可定位的完整学生表达时，正式评价结果也不得直接生成具体依据点评。`taskEvidence` 只用于内部核验；学生尚未写出的材料细节，除非题干已经公开或正式提示策略允许，否则不能通过点评或缺口文案直接泄露。

“思路点评”只回答“这次完成得怎么样”，“思路建议”只回答“下一次怎样组织或补充答案”，两者不得重复。生成顺序必须先完成 `requirementCoverage`，再选出唯一 `primaryGapRequirementId`，最后由同一个主要缺口生成 `primaryGap` 和 `revisionActions`；不得让点评与建议分别读取不同 Diagnosis 文案独立判断。点评只允许描述 `covered / partially_covered / missing / insufficient_to_judge` 对应的本次完成情况，不使用“先、再、最后、按照、下次、修改时”等方法性语言；建议只给下一步动作或组织方法，不再次输出“判断不准确、尚未完成、缺少依据”等评价句。`thinkingReview` 已形成时，“需要留意”不再重复展示相同问题。旧记录可以在读取时按当前 Adapter 只读重建 `thinkingReview`，但不得重新调用 Provider 或修改正式学习事实。

展示不要求结构对称：回答完整时可以只显示“思路点评”，不得强造建议；全部要求均为 `insufficient_to_judge` 且没有可靠已完成点时，不展示完成度点评，只给克制的下一步动作。若主要缺口是核心结论错误，学生端小标题使用“还需调整”；其他可补充缺口使用“还需补充”。

反馈不得只写“补充具体细节”或“用细节支持判断”。必须进一步说明当前题目中的细节类型（如动作、语言、神态或关键语句）、什么样的内容算该类细节，以及学生应怎样把该内容与题目目标联系起来。阅读开放题优先使用“重新想一想”“从这个动作看出”“说明为什么”等直接动作语言；只有题目本身要求作出判断时，才在学生反馈中保留“判断”。理解偏差应转成与题目目标对应的自然追问，例如“人物当时可能有怎样的心理”或“这些动作表现了人物怎样的特点”，不得使用“理解还需要再检查”等生硬搭配。

若现有状态无法表达新的正式场景，应先在既有入口协议中完成兼容性评估和版本化调整，不得由页面临时增加优先级或创建同义状态。

## 五、学生主流程

学生主流程保持为一条状态驱动路径：

```text
进入 /learning
↓
读取正式入口状态
├─ 可以开始
│  → 准备任务
├─ 有未完成回合
│  → 恢复同一 learningRoundId
├─ 有答案草稿
│  → 恢复草稿与任务上下文
├─ 提交处理中
│  → 查询已有执行结果
├─ 有到期复测
│  → 从正式 RetestPlan 准备任务
├─ 有正式反馈
│  → 展示反馈与下一步
└─ blocked / review_required
   → 展示安全说明与允许动作
```

页面层不得通过缺失字段猜测当前状态，也不得自行创建替代任务、替代反馈或默认 Profile。

## 六、学生页面状态

### 6.1 开始或继续

学生需要理解：

- 现在可以开始什么；
- 是否恢复上次学习；
- 是否有待完成复测；
- 当前是否暂时无法继续；
- 唯一主要动作是什么。

页面不展示多个同等优先级入口，不把 Demo、练习分类或内部工具混入正式学习入口。

### 6.2 任务准备

任务尚未通过 Readiness 时，不展示残缺材料或空题目。

学生看到：

- 正在准备任务；
- 准备失败后的单一重试动作；
- 需要等待复核时的克制说明。

### 6.3 阅读与作答

继续复用 [PC / 平板学习工作台体验校准](./PC_LEARNING_WORKSPACE_UX_CALIBRATION.md)：

- PC 与平板横屏优先使用稳定双栏；
- 左侧阅读材料，右侧题目与作答；
- 内容优先，色彩和视觉元素克制；
- 正文使用 `14px / 16px / 18px` 三档字号；
- 题干已经充分时，不重复展示笼统作答引导；
- 答案输入区支持真实长答案；
- 保存草稿与正式提交明确区分。

### 6.4 提交与分析

提交后必须：

- 禁止重复提交；
- 显示正在提交或分析；
- 使用既有 operationId / responseId 查询结果；
- 刷新后恢复同一提交；
- Provider 失败时进入重试、阻断或复核；
- 不回退到 mock Diagnosis 形成正式 Evidence。

当已提交回答因临时分析错误进入可重试状态时，页面必须明确说明无需刷新或重新作答，保留并暂时锁定原回答，主动作显示“重新分析”，次级动作允许“返回修改”。`review_required` 与 `blocked` 不得复用该重试文案或按钮。

`/learning` 在开放正式提交前必须通过服务端 Application Boundary 检查 Diagnosis Runtime 可用性。服务端优先读取进程环境中的 Provider Key，并允许在本地单学生运行中从受控 macOS Keychain 读取；浏览器不得持有、提交或展示 Key。Runtime 未配置时，学生仍可编辑和保存草稿，但提交入口必须禁用并明确显示“分析服务尚未就绪”，不得伪装成可无限重试的临时失败。

下一任务资源缺口必须明确表达为“当前没有符合要求的正式任务，需要先补充合适任务”，不能使用“正在准备”“暂未准备好”等可能暗示后台会自动完成的模糊表述。本轮正式结果已经保存时，应先告诉学生本轮已完成，再提供“检查下一任务”和“返回学习入口”；资源补齐后的重试只允许重新执行资源匹配，不得重新调用 Diagnosis、重复生成 Evidence 或重复更新 Profile。

### 6.5 补充回答

无效、占位或信息不足的回答应原地返回可编辑答案。

页面只表达：

- 当前内容为什么还不能稳定分析；
- 学生现在可以补充什么；
- 原答案和任务上下文仍被保留。

不得把作答不足表达成长期能力不足。

### 6.6 正式反馈

反馈只消费正式 `StudentLearningFeedback` 或 `ControlledFeedbackResult`。

建议保持：

```text
反馈
→ 思路点评（存在可靠依据时）
→ 需要留意（存在可靠依据时）
→ 思路建议
→ 下一步流程动作
```

学生端固定使用以下标题语义：

- `思路点评`：只展示已经获得正式事实支持、且能从本次答案中核验的思路表现；
- `需要留意`：指出当前答案中需要重新检查的具体内容，不使用“问题定位”等内部诊断语言；
- `思路建议`：说明下一次可以执行的阅读或表达动作，不复述内部 Root Cause，也不直接提供完整答案。

反馈正文必须说明“什么算具体内容”和“如何使用该内容”。例如心理推断题不能只写“补充一个能够支持判断的具体细节”，而应根据 Frozen Task 转译为：

```text
从文中找出父亲的一个具体动作，写清父亲做了什么或怎样做。
再说明你为什么能从这个动作看出父亲有这样的心理。
```

阅读开放题优先使用“重新想一想”“从这个动作看出”“说明为什么”等直接语言。只有题型本身要求作出判断时，才使用“判断”；不得把内部诊断中的“核心事实冲突、证据不足、Root Cause、confidence”等术语带入学生端。

反馈不得：

- 新增 Diagnosis；
- 扩写学生没有表达的内容；

高确定性的错别字可以通过独立 `WritingCorrectionSuggestion` 在反馈中提示，但必须保留学生原文，不得静默替换，不得因此生成 weakness Evidence 或修改 Profile。第一版采用“受控 LLM 候选 + 确定性校验 Gate”：模型只提出疑似错别字，服务端必须确认原词逐字存在于学生答案、建议属于最小修改、置信度为高且不改变语义，才能进入学生端；纠错失败或 Provider 不可用不得阻断正式反馈。纠错置信度不足时不自动展示；只有错字导致语义无法判断时，才要求学生确认后重新分析。纠错提示与内容表现反馈必须分区呈现。
- 把单次表现写成长期掌握；
- 显示 Evidence 类型、置信度或内部 ID；
- 为了结构对称强行生成表扬或不足。

### 6.7 下一轮或结束

当前回合正式完成且正式结果持久化成功后，才能进入下一轮。

页面入口只映射 Runtime 流程动作：

- 进入下一轮任务；
- 重新尝试；
- 补充回答；
- 等待确认；
- 结束本次学习。

页面不自行决定下一能力、难度、材料或提示策略。

### 6.8 阻断与复核

`blocked`、`review_required`、Provider 失败和资源不足必须使用不同的内部事实，但学生端可以使用克制、可行动的表达。

每个状态至少提供一种明确出口：

- 重试；
- 返回当前任务；
- 稍后继续；
- 结束 Session；
- 等待人工确认。

不得出现只有错误文本、没有后续动作的死路页面。

## 七、页面与 Runtime 的边界

页面可以：

- 通过统一入口 Application Service 读取 `UnifiedLearningEntryState`；
- 读取其他正式 Application Service 或 Adapter 输出，完成当前状态允许的页面动作；
- 映射学生可读文案；
- 管理加载、提交和展示状态；
- 保存未提交答案草稿；
- 调用已定义的开始、继续、提交、重试和结束动作。

页面不可以：

- 并行读取 Session、Checkpoint、Draft、Operation、RetestPlan、Feedback 或 Next Task 原始记录决定主流程；
- 直接操作 IndexedDB 或 localStorage 正式记录；
- 自行生成 Diagnosis、Evidence、Profile 或 GrowthMemory；
- 自行选择下一项教育策略；
- 从可选字段拼装“看起来完整”的任务；
- 因刷新重新启动 Round；
- 因 Provider 失败改用 mock 正式回流；
- 把 Debug 对象放入学生展示状态。

## 八、身份、恢复与幂等

页面收敛不得削弱以下不变量：

1. 同一未完成回合恢复同一 `learningRoundId`；
2. 同一提交恢复同一正式执行结果；
3. 同一 `responseId` 不重复调用 Diagnosis；
4. 同一 Formal Diagnosis 不重复生成 Evidence；
5. 草稿不等于 StudentResponse；
6. 草稿保存不等于回合完成；
7. 正式结果保存失败时不启动下一轮；
8. Session、Round、Task、Response 和 Evidence 身份错位时阻断；
9. 学生入口不通过 URL、文本、弹窗或折叠区泄露内部追溯字段。

## 九、内部入口边界

内部入口不是学生产品首页，也不是新的教育决策模块。

要求：

- 学生页面不显示内部入口链接；
- 内部页面使用独立布局和清楚的“内部工具”标识；
- 正式数据操作与受控 Demo 数据明确区分；
- 调用真实 Provider 的入口必须显式标记；
- 清理、重放或重试正式结果必须有明确影响说明；
- 验收 Demo 默认不得污染自然日记录；
- 未来接入账号后，内部入口必须增加权限控制。

## 十、信息与视觉原则

继续使用以下原则：

1. 内容优先于装饰；
2. 学习任务优先于产品说明；
3. 当前动作优先于完整系统状态；
4. 一个页面只保留一个视觉上明确的主要动作，必要的重试、稍后继续和退出应降级为次级或退出操作；
5. 反馈、总结和过渡信息不得重复；
6. 蓝色只用于当前状态和操作焦点；
7. 绿色只表示正式成功；
8. 红色只表示明确阻断或错误；
9. 不使用游戏化、装饰插图或多层卡片填充页面；
10. 学生无需理解工程术语即可继续。

## 十一、第一版工程范围

第一版只做：

- 盘点并收敛 `/learning` 当前状态；
- 强化现有 `UnifiedLearningEntryState` 作为学生入口唯一权威状态；
- 统一开始、恢复、作答、提交、反馈和下一轮页面关系；
- 建立轻量 `/internal` 入口集合；
- 建立 `/internal/acceptance` 验收入口集合；
- 将仍有价值的既有页面挂入正确入口；
- 隐藏或移除学生导航中的 Demo 入口；
- 完成 PC / 平板人工验收；
- 为 Phase 16.3C 自然日运行准备稳定入口。

第一版不要求重写全部页面，也不要求把所有历史 Demo 迁移成正式产品页面。

## 十二、不在本阶段完成

本阶段不做：

- 新教育 Runtime；
- 新 Diagnosis、Evidence 或 Strategy Schema；
- 全新品牌视觉；
- 大规模设计系统重构；
- 游戏化、奖励或复杂动效；
- 家长端、成长曲线或正式报告；
- 多学生账号和权限系统；
- 云端持久化；
- 移动端复杂开放题体验；
- 所有历史 Demo 的视觉统一；
- 教学效果结论。

## 十三、实施顺序

```text
1. 页面与路由盘点
2. 明确学生、内部、验收三类入口归属
3. 建立轻量内部入口集合
4. 收敛 /learning 状态与页面动作
5. 处理恢复、补充、阻断和复核出口
6. PC / 平板浏览器人工验收
7. 回归 Phase 16.3A / B / C 与 Production Build
8. 记录页面收敛后的自然日验收基线版本
9. 从同一稳定构建开始 5—7 个自然日真实运行
```

入口集合先建立轻量导航骨架，学生页面优化随后围绕真实使用问题推进。两者不应扩展成新的大型后台或视觉 Phase。

### 13.1 自然日验收版本冻结

Phase 16.3C 自然日验收必须以页面收敛、PC / 平板人工验收和关键回归通过后的同一稳定构建为验收对象。当前记录仍为 `0 / 5`，因此应在本次入口收敛完成后记录 `acceptanceBaselineVersion`，再开始计算 5—7 个自然日。

验收期间：

- 除阻断性缺陷外，不再调整入口结构、状态优先级、身份关联和主流程；
- 纯视觉或文案修复必须记录构建版本，并在相关回归通过后继续验收；
- 若修复改变入口状态机、身份关系、正式保存顺序或下一轮主流程，受影响的自然日记录不得继续计入，必须重新建立稳定基线并重新计时；
- 不允许 Day 1、Day 2 和后续日期使用不同的主流程语义后仍合并宣称连续验收通过。

## 十四、最小验收 Case

### Case 1：首次开始

进入 `/learning`，能够读取 Ready Formal Task 并进入作答；不显示内部入口或 Runtime 字段。

### Case 2：草稿恢复

输入答案并主动保存，刷新后恢复同一任务和草稿；不创建新 Round。

### Case 3：提交处理中刷新

提交后刷新，页面查询已有 Operation；不重复调用 Provider，不重复生成 Evidence。

### Case 4：无效回答

空答案或占位回答原地返回修改；不进入 Diagnosis，不显示能力结论。

### Case 5：正式反馈

只显示可追溯的优点、`需要留意`、`思路建议`和流程动作；不暴露内部字段，不扩大事实；不得只要求学生“补充具体细节”，必须说明当前题目需要哪类细节以及如何使用。

### Case 6：下一轮

正式结果持久化成功后进入下一 Frozen Resource；草稿保存不允许进入下一轮。

### Case 7：延迟复测

到期 RetestPlan 通过统一学生入口进入正式复测任务，不由页面直接拼题。

### Case 8：Provider 异常

页面给出重试、稍后继续或结束本次学习的入口；失败不产生 Evidence 或 Profile 更新。没有真实承接人的复核状态不得向学生显示“等待确认”。

### Case 9：内部入口隔离

内部人员可以从 `/internal` 进入内容、复核、历史和验收页面；学生导航中不存在这些入口。

### Case 10：PC / 平板

`1366 × 768` PC 与平板横屏下，阅读、作答、提交、反馈和主要动作无遮挡、无横向溢出。

### Case 11：新旧回合状态交接

正式反馈确认后进入下一轮：

- 旧 Checkpoint 不再锁定当前入口；
- 旧反馈不覆盖新任务；
- 新 Round 使用新的 `learningRoundId`；
- 上一 Round 保持可追溯，但不参与当前页面主流程决策。

### Case 12：下一任务已解析但资源不可用

当 Next Task 已解析，但没有满足目标能力和 `taskRole` 的当前 Frozen Resource：

- 不改写其他资源凑匹配；
- 不自动降级为普通 training；
- 进入 `blocked` 或 `review_required`；
- 学生获得明确、可行动且不泄露内部信息的出口。

### Case 13：正式保存部分失败

当 Diagnosis 成功，但 Formal Commit、Evidence、Profile 或下一状态保存过程中失败：

- 不展示“学习已完成”；
- 不进入下一 Round；
- 刷新后查询原 Operation 与已有正式结果；
- 不重复调用 Provider；
- `/internal` 能够识别并复核部分提交状态。

## 十五、完成标准

完成后必须满足：

- 学生只需记住一个入口；
- 学生可以独立完成开始、作答、反馈和下一轮；
- 刷新、恢复和异常没有流程死路；
- 学生端没有工程文案和内部导航；
- 内部工具和验收入口可以从一个集合页到达；
- Demo 与正式数据影响范围明确；
- Demo / Debug 的 `studentId`、Operation、Session、Round 和持久化记录不得被 `/learning` 恢复或计入正式自然日；
- 页面没有重新实现教育判断；
- `/learning` 只通过 `UnifiedLearningEntryState` 决定当前入口和主要动作；
- Phase 16.3 关键 Debug、浏览器 Smoke 与 Production Build 通过；
- 已记录自然日验收使用的稳定构建版本；
- 已具备开始 5—7 个自然日真实运行的页面条件。

## 十六、完成后的准确声明

完成后可以宣称：

> 单学生正式学习页面与内部工作入口已经收敛，学生能够从唯一入口连续完成学习、恢复、复测和反馈，内部人员能够从独立入口准备内容并复核运行状态。

不能宣称：

- Phase 16.3C 自然日验收已经完成；
- 产品已经支持多学生；
- 已具备云端、跨设备和正式权限；
- 所有页面已经达到商业级视觉质量；
- 已证明长期教学效果。

## 十七、交接关系

```text
Phase 16.3 Engineering + Human Demo PASS
↓
Student Product Interface Consolidation
↓
PC / Tablet Human Acceptance
↓
Stable Acceptance Baseline Version
↓
Phase 16.3C 5–7 Natural-day Run
↓
Phase 16 Acceptance / Freeze
```

本阶段的核心不是增加页面数量，而是：

> 让已经成立的学习 Runtime 通过更少、更清楚、更安全的页面真正被使用。

## 十八、Product / Demo 数据隔离记录

2026-07-21 完成正式入口与验收数据边界收紧：

- 正式单学生入口使用 `student-local-primary-v1`；
- Phase 16.3 Demo 保留 `student-phase16-integration-demo`，旧 Demo 数据不删除、不迁移为正式数据；
- `/learning`、Session History、Persistence、Multi-day 与 Operation 查询只消费产品身份；
- 正式入口读取到 Demo 标记或身份错位对象时必须安全拒绝，不得拼装为正常任务；
- 内部“清除旧 Demo 数据”只按 Demo 学生范围清理，不得全库清理 Operation，也不得清除正式学习记录；
- Frozen Resource 仍是可复用内容资源，进入本轮形成 `QualityGatedExecutableTask` 时绑定当前产品学生身份；
- `review_required` 仍保留为内部 Runtime 状态，但学生端必须按发生阶段解释：正式结果尚未保存时显示“本次结果暂不采用”；本轮正式结果已经保存、仅下一任务决策需要检查时显示“本轮学习已经完成 / 下一任务待检查”。后者不得暗示本次回答、Evidence 或学习记录被作废；
- `blocked + prepare_resource` 表示当前缺少符合要求的正式任务，必须明确说明需要补充任务，而不是暗示系统正在后台准备；
- Product / Demo Scope Isolation Debug：`11 / 11 PASS`；统一入口 `17 / 17 PASS`；Phase 16.3A `16 / 16 PASS`；Day 0 串联 `11 / 11 PASS`；Phase 15 集成 `11 / 11 PASS`；受控反馈 `46 / 46 PASS`；Production Build `PASS`。

详细验收记录见：[Phase 16.3 Product / Demo Scope Isolation Debug](../education/phase/reports/phase16_3_product_demo_scope_isolation_debug_2026-07-21.md)。
