# Phase 17.2：首批正式资源包生产蓝图

英文名称：First Formal Resource Pack Production Blueprint

状态：ACCEPTED / BATCH A CONTENT IMPLEMENTED / CONTROLLED FORMALIZATION PASS / OWNER REVIEW PENDING

当前记录：[Batch A 受控正式化验收](./reports/phase17_2_batch_a_controlled_formalization_2026-07-23.md)

所属阶段：[Phase 17.2：材料观测设计与首批正式资源包](./phase17_2.md)

材料观测校准记录：[《潼关》Material Cluster 校准](./reports/phase17_2_tongguan_material_cluster_calibration_2026-07-23.md)。该案例用于校准“同一 Material 下形成不同 Observation 与 Ability Action”的生产能力；在负责人审核、Freeze、Registry 和 active Link 完成前，不计入 Batch A 或首批正式题量。

## 一、文档定位

本文档用于在真实录入前冻结首批资源的生产范围、批次、学习链和验收方式。

它是内容生产与人工验收蓝图，不是新的 Runtime Schema、Repository、课程模型或发题顺序。本文中的 `planningChainKey` 只用于规划、复核和报告，不进入正式教育事实，也不能替代 Existing Strategy、TaskRequest、Resource Matching 或 ResourceObservationLink。

首批资源包的目标不是拥有尽可能多的题，而是形成一套：

- 单题正式性完整；
- 学习链可以真实运行；
- 整体覆盖不过度偏斜；
- 能被 Existing Runtime 查询、匹配和消费；
- 能用真实学生答案验证 Diagnosis、Acceptance 与 Narrative。

## 二、三层正式产出

### 2.1 单题正式性

每道正式资源必须完成：

```text
Material Version
-> Material Observation Plan
-> Observation Task Plan
-> Structured Question Draft
-> Rubric / Answer Acceptance
-> Validation
-> Human Review
-> Freeze
-> Registry Current Head
-> Active ResourceObservationLink
-> Runtime Query
```

冻结前必须确认：

1. Observation Dimension 描述观察材料的哪个侧面；
2. Ability Action 描述学生需要完成什么认知活动；
3. 题目确实能够观察目标 Ability；
4. Rubric 能区分完成、部分完成和关键缺口；
5. Answer Acceptance 能接受合理异表述，不退化为关键词命中；
6. 题目没有隐性依赖未声明的另一项核心 Ability；
7. TaskRole 与题目的真实用途一致；
8. Material、Plan、Task、Draft、Version、Registry 与 Link 身份闭合；
9. Runtime 可以读取并形成正式 TaskFulfillment Candidate。

题量压力不能降低单题标准。达到 24 道且质量、覆盖与链路成立即可冻结，不为接近 28 道加入低价值资源。

### 2.2 资源链可运行

资源链必须在录题前规划，不能在题目生产完成后临时拼接。

首批 Pack 至少包含：

- 2 条 `Training -> Retest`；
- 2 条 `Training -> Transfer`；
- 1 条 3—4 节点的跨 Ability 连续学习路径。

`Training -> Retest` 必须保持核心 Ability 与主要 Observation Intent，可更换表面内容或材料，但不能只是改写原题，也不能静默改变观测目标。

`Training -> Transfer` 必须保持核心 Ability，使用独立材料情境，并由正式任务约束控制材料新颖性和提示政策。Transfer 不是“换材料的普通复测”。

跨 Ability 路径只用于证明：

```text
Previous Evidence
-> Existing Strategy
-> TaskRequest
-> Resource Matching
-> Correct Next Frozen Resource
```

它不是固定课程顺序，不反向约束 Strategy。

### 2.3 整体覆盖不失衡

首批 Pack 至少审查：

| 覆盖侧面 | 检查问题 |
| --- | --- |
| Ability | 是否存在明显过少、过多或机械补齐 |
| Material Cluster | 是否过度依赖单篇材料或同一内容世界 |
| Observation Dimension | 同一 Ability 是否只观察单一内容侧面 |
| TaskRole | Training、Retest、Transfer 是否形成真实链路 |
| Response Form | 是否高度集中；V1 只提示限制，不设置硬性多样性配额 |

Observation Dimension 与 Ability Action 必须保持分离。例如：

```text
character × inference × training
```

`character` 表示观察人物侧面，`inference` 表示学生需要根据线索形成推断。

## 三、录入前资源规划表

正式录入前，每道候选题必须先进入规划表。

推荐字段：

| 字段 | 用途 |
| --- | --- |
| `planningRowId` | 蓝图内稳定行号 |
| `batch` | `A / B / C` |
| `materialCluster` | 核心或独立新材料 Cluster |
| `materialCandidate` | 待校对材料 |
| `observationDimension` | 观察材料的哪个侧面 |
| `observationFocus` | 本 Plan 内的具体观察说明 |
| `abilityId` | 学生需要完成的能力动作 |
| `taskRole` | `training / retest / transfer` 等正式角色 |
| `difficulty` | 当前计划难度 |
| `responseFormat` | 当前正式链已支持的作答形式 |
| `planningChainKey` | 仅用于规划的学习链标记 |
| `strategyRequestReason` | 哪类正式 Strategy 会请求它 |
| `possibleNextDirection` | 完成后可能进入的训练方向，不是固定发题顺序 |
| `reviewTier` | `core_chain / coverage / calibration` |

每一行在进入工作台前必须能够回答：

1. 这道题为什么存在；
2. 它观察材料的什么侧面；
3. 学生需要完成什么能力动作；
4. 它属于哪条学习链或覆盖目标；
5. 什么 Strategy / TaskRequest 可能请求它；
6. 学生完成后可能转向哪里。

无法回答时先保留为规划缺口，不进入正式生产。

## 四、分批冻结计划

### 4.1 Batch A：核心链验证

目标数量：约 8 道。

必须完成：

- 1 条 `Training -> Retest`；
- 1 条 `Training -> Transfer`；
- 覆盖 3—4 项 Ability；
- 核心题完成完整答案 Fixture；
- Plan -> Draft -> Review -> Freeze -> Registry -> Link -> Runtime Query 全链验证。

Batch A 是工作台和正式 Runtime 的真实内容验收门。未通过前不批量生产 Batch B。

2026-07-23 当前进度：

- 两篇项目原创 Material 已形成；
- 8 道内容完整资源定义已形成；
- 1 条 Training -> Retest 与 1 条 Training -> Transfer 已形成；
- 16 组核心答案 Fixture 已形成；
- 隔离 Repository 受控正式化 `14 / 14 PASS`；
- 浏览器已载入 2 份 pending-review Plan；
- 产品负责人内容审核、逐题 Freeze 与 active Link 确认仍为 `PENDING`。

### 4.2 Batch B：能力覆盖扩展

目标数量：8—10 道。

必须完成：

- 六项 Ability 形成基础正式覆盖；
- 第二条 `Training -> Retest`；
- 第二条 `Training -> Transfer`；
- 一条 3—4 节点跨 Ability 路径；
- 修正 Batch A 已暴露的 Rubric、Acceptance 或匹配问题。

### 4.3 Batch C：偏斜修正与校准

目标数量：8—10 道。

依据正式 Coverage 与人工验收补充：

- Ability 薄弱区域；
- Material Cluster 过度集中；
- Observation Dimension 重复；
- 缺少独立材料情境；
- 真实学生作答暴露的资源缺口。

Batch C 不按初始蓝图机械生产。若 Batch A + B 已形成 24 道高质量正式资源并满足全部链路与覆盖条件，可以停止扩题。

## 五、答案 Fixture 与诊断校准

边界验证优先使用“正式题目 + 多种学生答案 Fixture”，不为了测试边界额外建设低价值题目。

每道核心链路题至少准备：

1. 有效完整回答；
2. 部分完成回答；
3. 典型错误回答。

代表性核心题还应覆盖：

- 合理异表述；
- 简短但有效；
- 结论正确但缺少依据；
- 有依据但关系解释不成立；
- 混入无关信息；
- 无效或答非所问。

Fixture 用于验证：

- Answer Acceptance 不把合理异表述误判为错误；
- Rubric 能区分完成、部分完成与关键缺口；
- Diagnosis 不扩大一次作答问题；
- Narrative 能指出真实完成点和唯一主要缺口。

Fixture 不是 Frozen Question Resource，不计入 24—28 道正式题量。

校准答案还必须遵守：

- 只锚定本题 Rubric 与 Answer Acceptance；
- 类别和 expected answer status 使用受控枚举；
- 不进入正式 Question Draft、Diagnosis、Evidence 或 Profile；
- 不通过校准样例反向制造 Retest / Transfer 关系；
- 合理异表述与简短有效回答必须保留独立审核边界。

## 六、分级审核

所有正式题都必须完成：

- 教学目标审核；
- 结构与追溯审核；
- Rubric / Answer Acceptance 审核；
- Human Review 与 Freeze；
- Registry、Observation Link 与 Runtime Query 确认。

`core_chain` 题额外执行完整答案 Fixture、Diagnosis、Evidence 与 Narrative 验证。

`coverage` 题使用代表性答案组合抽检，重点确认能力与 Observation 不错位。

`calibration` 题重点验证合理异表述、部分完成和高风险误判边界。

分级只调整验证深度，不降低任何正式资源的准入条件。

## 七、Runtime Verified 派生规则

第一版不新增 Dashboard 状态 Schema。只读验收报告按现有正式事实派生：

```text
Frozen Resource Version
+ Registry Current Head
+ Active ResourceObservationLink
+ Runtime Query / Matching Success
= Runtime Verified
```

`Runtime Verified` 只用于生产验收显示，不写回 Resource、Registry、Coverage 或 Profile。

Draft、Reviewed、Frozen、Registered、Linked 与 Runtime Verified 必须分开统计。不得使用 Draft 数量冒充正式覆盖。

## 八、正式 PASS 标准

### 数量与状态

- 24—28 道 Registry current Frozen Resource；
- 100% 具有 active ResourceObservationLink；
- 100% 可以由 Runtime 查询；
- 100% 具有 Material、Rubric、Answer Acceptance、Review 与版本追溯。

### 覆盖

- 六项 Ability 均有正式资源；
- 4 个核心 Material Cluster；
- 1—2 个独立新材料 Cluster；
- Ability 与 Observation Dimension 无明显异常集中；
- Response Form 高度单一时保留限制，但不为多样性新增未验收题型。

### 链路

- 2 条 `Training -> Retest`；
- 2 条 `Training -> Transfer`；
- 1 条跨 Ability 连续路径；
- Retest 与 Transfer 不混用；
- `planningChainKey` 不成为 Runtime 权威输入。

### 质量

- 每道题至少一次正式人工审核；
- 核心链路题完成答案 Fixture 验证；
- Rubric、Acceptance、Observation 与 Ability Action 不冲突；
- 合理异表述不会被不当拒绝；
- 不使用错位资源凑数量或链路。

### 工程

- Frozen Resource 不被普通编辑覆盖；
- Registry 无重复身份；
- Observation Link 无悬空引用；
- Runtime 查询和匹配成功；
- Phase 17、Phase 16 与 Production Build 回归通过。

## 九、明确非目标

本蓝图不要求：

- 新增教育模型或 Repository；
- 修改 Diagnosis、Evidence、Profile、GrowthMemory 或 Strategy；
- 新增正式 `chainId`；
- 重写资源工作台；
- 建设完整 CMS、题库搜索或运营后台；
- 自动生成全部题目；
- 为每项 Ability 建设完整课程体系；
- 让 24—28 道题覆盖全部教材场景；
- 为 Response Form 多样性扩展未验收的交互类型。

真实生产若出现阻断，优先使用现有 Schema、ViewModel、校验和工作台解决。只有现有正式对象无法准确表达且阻止安全生产时，才重新评估 Contract。

## 十、执行顺序

```text
冻结规划表
-> 选定 Batch A Material
-> 生产约 8 道核心链资源
-> 完成答案 Fixture
-> Review / Freeze / Registry / Link
-> Runtime Query 与人工验收
-> 生产 Batch B
-> Coverage / Chain Review
-> 按真实缺口生产 Batch C
-> 24 道起执行停止条件审查
-> Phase 17.2 Freeze
-> Phase 17.3
```

首要交付物是 Batch A 的真实正式资源，不是继续扩建工作台。
