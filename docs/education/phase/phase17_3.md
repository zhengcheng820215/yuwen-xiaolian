# Phase 17.3：正式资源运行集成与来源保持

英文名称：Formal Resource Runtime Integration and Source Preservation

设计状态：READY FOR REVIEW

工程状态：NOT STARTED；BATCH A MINIMUM ENTRY GATE OPEN

所属总纲：[Phase 17：学习资源覆盖扩展与基于材料的能力观测基础](./phase17.md)

产品控制入口：[Product Control Table](../../product/PRODUCT_CONTROL_TABLE.md)

前置阶段：

- Phase 16.2 Resource Metadata and Matching Quality：`PASS / FROZEN`
- Phase 16.3 Real Learning Operation：A / B 已冻结，C 工程与受控 Demo 已通过
- Phase 17.1 Resource Coverage Contract：`ENGINEERING + HUMAN DEMO PASS`
- Phase 17.2 Material Observation Design：Runtime 与最小生产工作台工程基础已通过；Batch A 8 道资源已完成 Review / Freeze / Registry / active Observation Link，可作为 17.3 最小工程输入；完整首批正式内容包仍在建设

## 一、阶段目标

Phase 17.3 只解决一个核心问题：

> 第一批经过 Review、Freeze、Registry 和 Observation Link 的正式资源，进入真实学习主链后，其教育目标、内容来源和运行身份能否被稳定保留，并由上一轮正式结果驱动下一道正确资源？

正式链路：

```text
Frozen Resource Current Version
+ ResourceObservationLink
+ Registry Current Head
-> /learning Formal Task
-> StudentResponse
-> Answer Validity
-> Existing Real Diagnosis Runtime
-> Formal Diagnosis Commit
-> AbilityEvidence
-> Existing Evaluation / ProfileUpdateDecision / GrowthMemory
-> NextLearningStrategy
-> AdaptiveTaskConstraints
-> TaskRequest
-> Coverage Preflight
-> Phase 16.2 Resource Matching Quality
├─ matched
│  -> ExecutableLearningTask
│  -> Next LearningRound
└─ partial / no_match / review_required
   -> Structured Resource Gap
   -> blocked / review workflow
```

Phase 17.3 不新增教育推理模型。它验证的是：

1. 正式资源能否被真实学习入口消费；
2. 资源声明的能力、任务角色、材料和观测来源能否进入后续正式链路；
3. Diagnosis 与 Evidence 是否仍围绕该资源的正式目标；
4. 下一任务是否由 Existing Strategy 发出，而不是页面或题库自行决定；
5. 缺少合格资源时，系统是否宁可阻断，也不拿错题凑匹配。

## 二、一句话定义

> Phase 17.3 证明“正式题目为什么被选中、它在观察什么、学生产生了什么证据、下一题为什么继续或变化”能够在同一条正式学习链中保持一致。

## 三、用户可感知结果

完成后，学生应能够感受到：

1. 当前题目确实在练一个明确能力，而不是随机抽题；
2. Feedback 回应的是本题和本次答案，不会套用另一类能力的模板；
3. 下一题与上一轮结果存在可解释关系；
4. Retest 与 Transfer 不会退化成原题重做或普通训练；
5. 暂时没有合适题目时，系统会明确停止，不会用能力错位的题目填空。

内部复核人员应能够追溯：

```text
为什么选这道题
-> 使用了哪个 Strategy / TaskRequest
-> 匹配了哪个 Resource Version
-> 来自哪个 Material Version
-> 对应哪个 Observation Task Plan
-> Diagnosis 围绕哪个 Ability
-> Evidence 来自哪次 Response
-> 下一任务为何继续、复测、迁移或阻断
```

## 四、进入工程开发的两道门

### 4.1 最小串联启动门

Phase 17.3 文档可以先冻结，但工程串联至少应等待 Phase 17.2 Batch A 提供约 8 道真实正式资源。

Batch A 至少满足：

1. 全部完成 Human Review；
2. 全部形成 Frozen Current Version；
3. 全部进入 Registry；
4. 全部拥有有效 ResourceObservationLink；
5. 全部可被正式 Repository 查询；
6. 至少覆盖 3—4 项 Ability；
7. 至少形成 1 条 Training -> Retest；
8. 至少形成 1 条 Training -> Transfer；
9. 核心链路题已准备有效完整、部分完成和典型错误答案 Fixture。

满足此门后，可以启动确定性 Runtime 串联与小范围受控 Live，不必等待全部 24—28 道资源完成。

### 4.2 Phase 17.3 最终产品验收门

Phase 17.3 不得仅凭 Batch A 宣称最终 PASS。最终验收前应满足：

1. Phase 17.2 首批 24—28 道正式资源包已冻结；
2. 六项核心 Ability 均存在正式可消费资源；
3. 2 条 Training -> Retest 链完整；
4. 2 条 Training -> Transfer 链完整；
5. 1 条 3—4 节点跨 Ability 路径完整；
6. 所有用于验收的 Resource 都达到 Runtime Verified；
7. Coverage Dashboard 与 Runtime Matching 使用相同 Registry Current Head。

## 五、权威边界

### 5.1 正式资源权威

只有以下组合可以进入正式学习：

```text
Reviewed Resource
+ Frozen Current Version
+ Registry Current Head
+ Valid ResourceObservationLink
```

Draft、pending review、rejected、superseded、retired、Link invalid 或 Material Version 错位的资源，不得进入 `/learning`。

### 5.2 学习方向权威

学习方向仍由既有正式结果决定：

```text
Evaluation / ProfileUpdateDecision / GrowthMemory
-> NextLearningStrategy
-> AdaptiveTaskConstraints
-> TaskRequest
```

Resource Registry、Coverage Dashboard、工作台和页面都不能反向修改 Strategy。

### 5.3 资源匹配权威

Phase 17.3 必须复用 Phase 16.2 Resource Matching Quality，不建立第二套选择器。

匹配结果仍为：

```ts
type ResourceMatchingOutcome =
  | 'matched'
  | 'partial'
  | 'no_match'
  | 'review_required';
```

只有 `matched` 可以生成 ExecutableLearningTask。其余状态必须保留 Gap 或 Review 事实。

### 5.4 Observation Dimension 边界

Phase 17.3 V1 中，Observation Dimension 是：

- 正式资源的设计来源；
- 运行追溯上下文；
- Coverage 偏斜检查依据；
- Retest / Transfer 人工复核依据。

它不是：

- 新的 Ability；
- Profile 维度；
- GrowthMemory 维度；
- Evaluation 的隐藏权重；
- Resource Matching 的未声明硬约束。

Existing Strategy / TaskRequest 没有正式表达 Observation Dimension 约束时，Matching 不得根据 `observationFocus` 私自拒绝或偏好资源。

### 5.5 Evidence 边界

资源匹配成功只证明：

> 当前存在满足正式任务约束、可以执行的资源。

它不证明：

- 学生会有效作答；
- Diagnosis 一定通过质量门；
- Evidence 一定为 high quality；
- 学生已经掌握；
- Retest 一定可比；
- Transfer 一定成功。

实际 Evidence 质量仍由执行后的 Phase 14.1 重新评估。

## 六、最小运行输入

Phase 17.3 不要求为集成新建大型 Schema。运行至少需要消费现有正式事实：

### 6.1 来自资源侧

- resourceId；
- resourceVersionId；
- materialId；
- materialVersionId；
- registry current 状态；
- abilityId；
- taskRole；
- difficulty；
- response form；
- Rubric / Answer Acceptance version；
- ResourceObservationLink；
- Observation Task Plan 来源。

### 6.2 来自学习侧

- studentId；
- learningSessionId；
- learningRoundId；
- previous formal result；
- NextLearningStrategy；
- AdaptiveTaskConstraints；
- TaskRequest；
- recent resource / material history；
- RetestPlan 或 Transfer 请求来源。

### 6.3 最小输出

Phase 17.3 使用既有正式对象，至少应形成：

- ExecutableLearningTask，或 Structured Resource Gap；
- 完整的 Resource / Material / Ability / TaskRole 追溯；
- 与本次 Response 对齐的 Formal Diagnosis；
- 与本次 Task 对齐的 AbilityEvidence；
- 由 Existing Strategy 产生的下一 TaskRequest；
- 可解释的 next task resolution；
- 幂等恢复所需的 operation / checkpoint 事实。

## 七、来源保持规则

从 Frozen Resource 到 Evidence，以下事实不得被页面、默认值或旧 Demo Fixture 覆盖：

1. `abilityId`；
2. `taskRole`；
3. `resourceId` 与 `resourceVersionId`；
4. `materialId` 与 `materialVersionId`；
5. Rubric / Answer Acceptance 来源；
6. student / session / round / response 身份；
7. ResourceObservationLink 引用；
8. Strategy / TaskRequest 来源。

若某个下游既有对象暂时没有 Observation 字段，应通过受控运行上下文或 Trace 保留引用，不得顺手修改 Evidence、Profile 或 GrowthMemory Schema。

## 八、任务角色规则

### 8.1 Training

Training 资源应满足当前 Strategy 的目标 Ability、难度和支持条件。

普通 Training 不得冒充：

- Retest；
- Transfer；
- Delayed Retest；
- Independent Retest。

### 8.2 Retest

Retest 至少要求：

1. 核心 Ability 与计划一致；
2. 来源 RetestPlan 可追溯；
3. 不复用原题；
4. 不拿普通 Training 题静默替代；
5. Material / difficulty / hint 条件满足既有约束；
6. 产生新的 Response 与 Evidence。

### 8.3 Transfer

Transfer 至少要求：

1. 核心 Ability 保持一致；
2. 使用独立 Material Cluster；
3. 不复用 Training Material 的表面改写；
4. 提示条件不比 Strategy 允许范围更宽；
5. 不把“更换题干”自动解释为迁移成立。

### 8.4 跨 Ability 路径

跨 Ability 路径必须由正式 Strategy 逐轮发出，不得一次性按预设顺序硬编码在页面。

例如：

```text
extraction
-> comprehension
-> summarization
-> inference
```

每一跳都必须能够回答：

> 上一轮的哪项正式结果支持了这次方向变化？

## 九、异常与安全分支

### 9.1 Ability 错位

TaskRequest 要求 `summarization`，候选资源为 `inference`：

```text
do not match
-> structured gap
-> blocked / review_required
```

不得用“都属于阅读理解”作为放宽理由。

### 9.2 TaskRole 错位

Retest / Transfer 缺少对应正式资源时：

```text
do not downgrade to training
-> preserve requested role
-> report gap
```

### 9.3 Registry 或 Link 失效

若资源不是 current，或 ResourceObservationLink 无效：

```text
do not execute
-> preserve existing history
-> review_required
```

不得在页面中临时修复或生成新 Link。

### 9.4 正式提交部分失败

若 Diagnosis 已完成，但 Formal Commit、Evidence、Profile 或 next state 保存失败：

1. 不展示“本轮已完成”；
2. 不进入下一 Round；
3. 刷新后恢复原 operation；
4. 不重复调用 Provider；
5. 不重复写入 Evidence；
6. 内部入口能够定位失败段。

### 9.5 补齐资源后的恢复

当 Resource Gap 被新资源补齐：

```text
reuse previous formal round result
-> rerun coverage preflight
-> rerun resource matching
-> do not rerun previous Diagnosis
-> do not recreate previous Evidence
```

## 十、工程工作包

以下为同一 Phase 内的顺序工作包，不新增子阶段。

### Work Package A：Batch A 确定性串联

目标：

- 使用 Batch A 真实 Frozen Resource；
- 跑通至少一条 Training -> Retest；
- 跑通至少一条 Training -> Transfer；
- 验证来源、身份、角色和幂等；
- 不调用真实 Provider也能完成稳定回归。

### Work Package B：受控真实 Provider 与 `/learning`

目标：

- 使用 2—3 道 Batch A 正式资源；
- 通过 Application Boundary 调用真实 Provider；
- 验证 Diagnosis 与正式 Ability / Rubric 对齐；
- 验证 Evidence 来源和下一任务；
- Provider 失败时安全恢复；
- 不把受控 Smoke 当成长期教学效果。

### Work Package C：完整资源包验收

目标：

- 使用完整 24—28 道资源包；
- 验证六项 Ability 查询；
- 验证 2 条 Retest、2 条 Transfer 和 1 条跨 Ability 路径；
- 与 Coverage Dashboard 对账；
- 完成产品级 Demo 与负责人验收。

## 十一、核心 Debug Cases

### Case 1：正式 Training 资源进入学习页

Frozen Current Resource：

```text
ability = comprehension
taskRole = training
```

预期：

- `/learning` 展示同一 Resource Version；
- Diagnosis 使用 comprehension 目标；
- Evidence 保留同一 resource / material 来源。

### Case 2：Retest 不复用原题

RetestPlan 已到期，原 Training Resource 仍在 Registry。

预期：

- 原题被排除；
- 匹配新的 Retest Resource；
- 形成新的 Response 与 Evidence。

### Case 3：Transfer 使用独立 Material Cluster

Training 与 Transfer Ability 相同。

预期：

- Transfer 不使用 Training 的 Material Cluster；
- 若无独立 Cluster，返回 Resource Gap。

### Case 4：Ability 错位被阻断

TaskRequest 要求 summarization，只有 inference 资源。

预期：

- 不凑匹配；
- 不生成 ExecutableLearningTask；
- Gap 原因可追溯。

### Case 5：TaskRole 错位被阻断

请求 retest，只有普通 training。

预期：

- 不静默降级；
- 保留 retest 请求；
- 返回 partial / no_match / review_required。

### Case 6：Difficulty 不被静默修改

请求 intermediate，候选资源仅有 basic / advanced。

预期：

- 按 Existing Matching Policy 处理；
- 页面不得自行挑选；
- 任何放宽必须是正式、可追溯结果。

### Case 7：Observation 来源保持

Resource 拥有有效 ResourceObservationLink。

预期：

- Task Runtime 可追溯 Plan、primaryDimension 与 Ability Action；
- 页面不改写；
- 不直接写入 Profile。

### Case 8：Registry Current Head 一致

同一 resourceId 存在旧版和 current version。

预期：

- Coverage 与 Matching 只消费 current；
- 旧版只用于历史追溯。

### Case 9：重复提交与刷新恢复

同一 Response 重复提交或页面刷新。

预期：

- Provider 调用不增加；
- Formal Diagnosis、Evidence 和下一 Task 不重复；
- 恢复同一 operation 结果。

### Case 10：资源补齐后只重跑匹配

先发生 Resource Gap，后新增正式资源。

预期：

- 复用上一轮正式结果；
- 只重跑 Coverage / Matching；
- 不重跑 Diagnosis，不重写 Evidence。

### Case 11：Diagnosis 与 Resource 目标错位

正式题为 analysis，Diagnosis Candidate 使用 inference。

预期：

- Identity / Boundary Gate 阻断；
- 不生成 Evidence；
- 不用页面文案掩盖错位。

### Case 12：匹配成功但 Response 无效

Resource 匹配正确，学生提交空答案或占位答案。

预期：

- Answer Validity 阻断；
- 不因匹配成功生成能力 Evidence；
- 资源状态保持有效。

### Case 13：同 Observation 不等于同 Ability

两个 Resource 都观察 character，但 Ability 分别为 extraction 和 inference。

预期：

- Diagnosis 与 Evidence 按各自 Ability 运行；
- observationFocus 不覆盖 abilityId。

### Case 14：跨 Ability 路径由 Strategy 驱动

上一轮正式结果支持从 comprehension 进入 summarization。

预期：

- Strategy 明确产生新 Ability；
- TaskRequest 与匹配结果一致；
- 页面不使用预设题目顺序替代 Strategy。

## 十二、自动化验收

Phase 17.3 工程验收至少包括：

1. Phase 17.3 专项 Debug 全部 PASS；
2. Phase 16.2A / 16.2B 回归 PASS；
3. Phase 16.3 单对象 E2E 与恢复回归 PASS；
4. Phase 17.1 Coverage 回归 PASS；
5. Phase 17.2 Observation / Production 回归 PASS；
6. Production Build PASS；
7. 不调用真实 Provider 的确定性回归可重复；
8. 真实 Provider 仅在受控 Smoke 中使用，结果单独记录。

## 十三、产品级 PASS

产品负责人只需验收以下五项：

1. **正式资源进入学习页且身份不变**  
   Resource、Version、Material、Ability 和 TaskRole 与 Registry 一致。

2. **Diagnosis 对应正式目标**  
   概括题按概括目标判断，分析题按分析目标判断；不会被默认 inference 覆盖。

3. **Evidence 来源正确**  
   Evidence 能追溯本次 Task、Response、Resource Version 和 Material。

4. **下一任务由正式结果驱动**  
   Strategy 发出正确 Ability / TaskRole，Matching 选择满足约束的下一资源。

5. **错位或缺资源时安全阻断**  
   不拿错题凑匹配，不重复 Diagnosis / Evidence，并提供可恢复的内部出口。

## 十四、人工 Demo 路径

最小 Demo 使用两道不同 Ability 的正式题：

```text
正式概括题
-> /learning
-> 学生作答
-> Diagnosis / Evidence 来源复核
-> Strategy / TaskRequest
-> 下一正式资源

正式分析题
-> /learning
-> 学生作答
-> Diagnosis / Evidence 来源复核
-> Strategy / TaskRequest
-> 下一正式资源或明确 Gap
```

Demo 中至少展示：

- 当前题为什么被选中；
- 当前正式 Ability / TaskRole；
- Material 与 Resource Version；
- 本次 Diagnosis 围绕什么目标；
- Evidence 来自哪次 Response；
- 下一题为什么继续、复测、迁移或阻断；
- 重复提交后是否复用同一正式结果。

## 十五、非目标

Phase 17.3 不建设：

- 新的 Diagnosis Agent；
- 新的 Strategy Runtime；
- 第二套 Resource Matcher；
- 自动课程编排系统；
- Observation Dimension Profile；
- 双坐标 Ability Evidence；
- 多学生资源权限；
- 题库搜索与运营后台；
- AI 自动生成并 Freeze 资源；
- 学习效果或商业可用性结论；
- Phase 16.3C 的 5—7 个自然日替代验收。

## 十六、问题归类

出现不符合预期时，产品负责人先按四类定位：

| 问题类型 | 典型表现 | 优先检查 |
| --- | --- | --- |
| 内容问题 | 题目实际观察不到目标 Ability，Rubric / Acceptance 不合理 | Material、Observation Plan、Question、Rubric |
| Runtime 问题 | Ability、TaskRole、Version、Link 或 Evidence 来源丢失 | Registry、Task Adapter、Diagnosis Input、Evidence Return |
| 表达问题 | 判断正确，但学生反馈没有回应本题或说明下一步 | Student Learning Narrative / Feedback Adapter |
| 交互问题 | 状态正确，但页面恢复、继续或错误出口混乱 | Entry Resolver、Operation、Checkpoint、UI State |

修复顺序：

```text
先确认正式内容
-> 再确认来源传递
-> 再确认教育判断
-> 最后调整学生表达与页面
```

不得用改文案掩盖 Runtime 错位，也不得用改 Runtime 掩盖低质量题目。

## 十七、停止条件

Phase 17.3 达到以下条件后立即停止扩展并进入验收记录：

1. 五项产品级 PASS 全部通过；
2. 14 个核心 Debug Case 及必要回归通过；
3. Batch A Controlled Live 通过；
4. 完整资源包的 Retest、Transfer 与跨 Ability 路径通过；
5. Coverage 与 Runtime Registry 对账一致；
6. 已知边界已记录；
7. 没有为了提高展示效果新增教育模型、Agent 或 Schema。

不得因为：

- 内部追溯页还能更漂亮；
- Observation 字段还能更丰富；
- Demo 还能覆盖更多题；
- 工作台还能增加筛选；

继续扩大 Phase 17.3。

## 十八、完成声明

Phase 17.3 完成后可以宣称：

> 系统能够将经过审核、冻结并登记的正式学习资源稳定接入单学生学习主链，保留资源的 Ability、TaskRole、Material、Version 与 Observation 来源，使真实作答围绕正式目标形成 Diagnosis 和 Evidence，并由 Existing Strategy 驱动下一道满足约束的正式资源；当资源错位或缺失时，系统会安全阻断而不是用错误资源凑匹配。

仍不能宣称：

- 24—28 道资源代表完整课程；
- Observation Dimension 已进入正式学生画像；
- 所有 Retest 都具备长期可比性；
- 所有 Transfer 都证明迁移成功；
- 学生长期教学效果已经验证；
- Phase 16.3C 自然日验收已经完成；
- Phase 17 已冻结。

## 十九、当前准确状态

```text
Phase 17.3 Design
= READY FOR REVIEW

Phase 17.3 Engineering
= NOT STARTED

Minimum Engineering Entry
= Phase 17.2 Batch A PENDING

Final Product Acceptance
= Full 24-28 Formal Resource Pack PENDING
```
