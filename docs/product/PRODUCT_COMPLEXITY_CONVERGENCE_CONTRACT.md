# 产品复杂度收口契约

英文名称：Product Complexity Convergence Contract
契约版本：`product_complexity_convergence_v1`
状态：`DESIGN FROZEN / ENGINEERING READY`
生效范围：资源录入端、Learning、内部观察与既有训练调度链
日期：2026-08-24

## 一、契约定位

本契约是跨阶段的产品投射、触发策略和维护复杂度治理，不是阶段 5 Training Model 功能开发。

它不削弱已经建立的训练、诊断、证据、持久化和版本治理能力，也不重新设计产品主链。目标只有一个：

> 内部允许复杂，外部必须简单；只有真正影响当前决策的能力，才允许进入用户视野和当前运行路径。

最终普通用户体验保持为：

```text
阅读材料
→ 完成题目
→ 获得清楚反馈
→ 必要时进行一次针对处理
→ 继续学习
```

录入者不需要理解 Candidate、Gate、Admission、Revision Identity、Registry 或 Governance；学生不需要理解 Planning、Progression Assessment、Evidence Admission、Load Semantics 或版本校准。

## 二、核心原则

1. 内部系统负责复杂地判断，用户只负责简单地学习和做决定。
2. 复杂能力默认隐藏，只有当它能够改变当前下一步行动时才出现。
3. 核心学习链不能依赖任一高级能力才能完成。
4. 高级能力必须同时具有明确问题、明确收益、明确触发条件和明确退出条件。
5. 收口优先减少体验复杂度和默认运行复杂度，不通过破坏底层可靠性降低复杂度。
6. 已经开发完成不构成继续默认启用或长期保留的理由。
7. 每个工程阶段都必须证明旧主链零回归，并且新规则只在本阶段允许的边界内生效。

## 三、目标与非目标

### 3.1 目标

- 普通页面只展示当前任务所需信息和操作；
- 条件能力在不满足触发条件时完全不占用用户注意力；
- 反馈只突出一个当前主要缺口和一个可执行动作；
- 内部事实保持可追踪、可恢复和可审计；
- 用真实触发率、完成率和后续改善决定能力去留；
- 降低页面状态、操作入口、解释文案和默认调度的组合复杂度。

### 3.2 非目标

本轮不执行：

- 重建 Training Model；
- 重新设计 Material、Plan、Task、Candidate、Publish 或 Learning；
- 批量改写 Frozen Resource；
- 合并首次独立回答、Revision、Targeted、Retest 或 Transfer 证据；
- 建立第二套 Profile、第二条发布链或第二套事实来源；
- 因界面隐藏而删除历史数据；
- 以收口为名降低幂等、恢复、身份校验或审计标准。

## 四、主链与基础设施冻结

本轮禁止重构：

```text
Material
→ Plan
→ Task
→ Candidate
→ Adopt
→ Revision
→ Publish
→ Learning
```

同时冻结：

- Frozen Resource；
- Resource Version Identity；
- TaskGroupProgressionPlan；
- Progression Load Semantics；
- Session Snapshot；
- 首答、Revision、Targeted、Retest、Transfer 的身份与证据隔离；
- Evidence 不可变性；
- Registry Version Chain；
- 幂等、Outbox 与失败恢复；
- Learning 已完成事实优先于旁路分析和校准写入。

本轮优先只修改六个面：

1. 页面投射；
2. 功能可见性；
3. 条件触发策略；
4. 状态与反馈文案；
5. 操作入口；
6. Internal / Product 边界。

## 五、能力分层

### 5.1 A 类：核心能力

必须长期保留，并且始终支持一次完整学习：

- Material 与正式学习材料；
- 训练任务规划；
- 单项选择与开放文本训练；
- 从低负担到高负担的合理题组递进；
- 正式题版本与 Frozen Resource；
- Learning Session / Round / Attempt；
- 首次独立回答；
- 当前题 Diagnosis；
- 基础反馈；
- Learning Persistence；
- 幂等、失败恢复与 Outbox；
- 基础 Evidence 留存。

即使 Revision、Targeted、Retest 和 Transfer 均未触发，学生仍必须能够正常完成：

```text
阅读 → 作答 → 反馈 → 下一题 → 完成题组
```

### 5.2 B 类：条件触发能力

能力完整保留，但默认不出现在用户界面，也不因“系统具备该能力”而自动运行：

- Revision；
- Targeted Micro-training；
- Retest；
- Transfer；
- Successor Governance；
- Calibration Review。

### 5.3 C 类：后台能力

保留为系统事实和内部工具，但不属于普通产品体验：

- Candidate；
- Planning Seed；
- Revision Identity；
- Governance Case；
- Admission Decision；
- Progression Artifact；
- TaskLoadSemantics；
- Plan Hash / Semantics Hash；
- Observation Thread；
- Registry；
- Projection；
- Calibration Event；
- Outbox 内部状态；
- Quality Code / Gate Code；
- Threshold Policy；
- Evidence Identity Chain。

后台事实可以决定系统行为，但不能要求普通用户理解。只有 Internal Review、Debug 和受控治理页面允许查看。

### 5.4 D 类：待观察或可淘汰能力

同时呈现以下特征的能力进入淘汰观察：

- 很少触发；
- 触发后对后续学习没有明确收益；
- 用户难以理解；
- 容易造成流程中断；
- 与其他能力高度重复；
- 测试、恢复、兼容和维护成本明显高于价值。

进入 D 类不等于立即删除，必须遵守第十三章的退役流程。

## 六、普通用户页面白名单

以后普通页面采用白名单投射，不采用“开发了什么就展示什么”的默认规则。

### 6.1 录入端允许长期显示

- 生成训练任务；
- 重新优化；
- 采用并发布；
- 正在生成或正在发布；
- 已发布；
- 当前必须解决、且具有明确操作出口的错误。

即使内部实际经过：

```text
Candidate → Verification → Group Gate → Adoption → Revision → Frozen → Registry
```

用户仍只看到：

```text
采用并发布
```

录入端默认禁止显示 Candidate、Revision、Plan、Hash、Gate、Admission、Registry、Governance 和工程状态码。

### 6.2 Learning 允许长期显示

- 文章标题、作者与正文；
- 当前题；
- 必要的作答组件；
- 按需查看的提示；
- 提交；
- 当前反馈；
- 有价值时的一次修订；
- 有价值时的一次针对练习；
- 下一题；
- 题组完成结果；
- 中断时明确、可执行的恢复入口。

Learning 默认禁止显示：

- 能力等级；
- Load Level；
- Observation Thread；
- Breakpoint；
- Evidence / Admission 状态；
- Profile 更新说明；
- Scheduler 选择理由；
- Revision / Targeted / Retest / Transfer 的工程身份；
- Plan Hash、Semantics Hash、Gate Code 或内部阶段码。

## 七、条件触发统一契约

### 7.1 决策要求

任何条件能力只有同时满足以下条件才允许触发：

```text
明确问题
+ 明确收益
+ 明确触发条件
+ 明确退出条件
```

缺少任意一项时，系统必须安全地不触发，并继续核心学习链。

### 7.2 内部可追踪事实

条件触发决策应复用现有 Schema 和事实链，至少能够追踪：

- `triggerReasonCode`：为什么触发；
- `sourceEvidenceIds`：依据哪些已存在事实；
- `expectedBenefitCode`：预期解决哪一类当前问题；
- `expectedBenefitDescription`：可选的内部展示说明；
- `exitCondition`：何时退出；
- `decisionPolicyVersion`：依据哪一版本策略；
- `notTriggeredReason`：为什么没有触发。

这些是内部事实，不得直接展示给学生，也不得为其增加新的人工审核步骤。实现前应优先映射到既有对象；只有无法表达且存在真实决策缺口时，才允许扩展 Schema。

`expectedBenefitCode` 冻结为结构化分析依据：

```ts
type ComplexityConvergenceBenefitCode =
  | 'resolve_revision_gap'
  | 'isolate_atomic_gap'
  | 'verify_independent_retention'
  | 'verify_transfer'
  | 'repair_resource_risk'
  | 'review_calibration_evidence';
```

推荐映射：

| 条件能力 | expectedBenefitCode |
| --- | --- |
| Revision | `resolve_revision_gap` |
| Targeted Micro-training | `isolate_atomic_gap` |
| Retest | `verify_independent_retention` |
| Transfer | `verify_transfer` |
| Successor Governance | `repair_resource_risk` |
| Calibration Review | `review_calibration_evidence` |

`expectedBenefitDescription` 只能用于内部说明，不得作为触发、退出、统计聚合或效果判断依据。语义相同的收益必须归入同一个 Code；新增 Code 必须升级策略版本并补充兼容映射。

### 7.3 无动作原则

不触发也是合法且可解释的决策。系统不得为了形成完整功能链而强制安排 Revision、Targeted、Retest 或 Transfer。

## 八、各条件能力边界

### 8.1 Revision

仅当以下条件同时成立时显示一次修订入口：

- 当前回答存在一个明确、可修订的主要缺口；
- 修订具有实际学习价值；
- 学生可以在当前题上完成修订，不需要重新完成整道题；
- 当前题尚未使用过 Revision。

否则直接进入下一题。Revision 后的改善必须标记为反馈支持下表现，不覆盖首次独立回答。

### 8.2 Targeted Micro-training

仅当以下条件同时成立时插入：

- Gap 足够具体，能够通过一次小任务重新执行；
- 存在身份和训练动作匹配的正式资源；
- 不重复原题的观察对象、证据范围与评分目标；
- 当前 Session 仍适合插入；
- 不打断正式序列恢复；
- 不形成递归训练循环。

防循环硬边界：

1. 同一核心 Gap 在同一 Round 最多插入一次 Targeted；
2. Targeted 失败不得递归生成第二个 Targeted；
3. Targeted 完成后必须回到原正式序列或结束当前题组；
4. 资源不匹配时安全跳过，不阻断下一题；
5. Targeted 表现不得覆盖首次独立表现。

### 8.3 Retest

Retest 仅用于验证学生脱离提示、反馈或针对训练后，能否独立完成相同核心动作。不得因为存在 Retest 能力而自动安排。

### 8.4 Transfer

Transfer 只有在已有相对稳定的独立证据后才允许安排，用于验证同一能力能否迁移到新材料或新情境。Transfer 不能成为普通训练题的另一种名称。

### 8.5 Successor Governance

只针对以下明确风险进入治理：

- 身份错误；
- 明显入口过载；
- 无理由负担跳跃；
- 重复观察；
- 真实数据持续出现 task-load-risk；
- 明确正式题质量风险。

普通正式题不主动进入治理流程；治理继续复用既有 Candidate → Adopt → Revision → Publish 链，不原地覆盖 Frozen Resource。

### 8.6 Calibration Review

校准状态必须区分：

- `awaiting_data / collecting / insufficient_sample`：继续收集，不制造普通用户需要处理的新状态；
- `integrity_blocked`：仅在内部处理事件身份或完整性问题；
- `review_ready`：允许内部复核，不自动调整题目或学生能力；
- `calibrated`：必须满足当时版本策略并完成人工复核。

隔离验收、Fixture、Demo 和 Debug 数据不得进入真实分母。

## 九、反馈收敛契约

每次正式反馈最多回答三个问题：

1. 当前答案哪一点已经做到；
2. 当前最重要的一个缺口是什么；
3. 下一步可以立即做什么。

三类信息是输出上限，不是固定三段式模板：

- 答案正确且无需继续训练时，可以只输出一句真实确认；
- 不存在可执行修订价值时，不展示修订建议；
- 只有存在明确缺口时，才展示缺口与下一步动作；
- 次要问题留在内部 Diagnosis，不全部投射给学生。

下一步动作必须具体，例如：

> 回到第二段，找一句能够直接支持你判断的话。

不得使用只有能力术语、没有操作价值的表述，例如：

> 需要进一步加强文本证据意识和逻辑关系理解。

默认禁止：

- 同时罗列多个问题；
- 暴露内部能力、负担或归因术语；
- 解释系统为什么安排下一题；
- 把 provisional 判断写成长期能力；
- 重复题目训练目标；
- 输出与当前答案无关的模板化表扬或建议。

核心标准：学生读完反馈后，应立即知道自己已经做到什么，以及必要时下一步做什么。

## 十、长期能力画像收口

长期 Profile 不承担所有学习过程信息。事实顺序保持为：

```text
Attempt
↓
Diagnosis
↓
Evidence
↓
Progression / Validation
↓
足够稳定且身份一致的证据
↓
Long-term Profile
```

以下内容不得直接写成学生长期能力：

- `loadLevel`；
- `sequenceRole`；
- `observationThread`；
- 单次 breakpoint；
- 一次题目失败；
- Revision 后改善；
- Targeted 成功；
- 单次提示使用。

如产品需要展示简化的能力概况，可以形成 `CoreAbilitySummary`，但它只能是现有长期 Profile 的只读简化投影：

```ts
type CoreAbilitySummary = {
  abilityId: string;
  status: 'stable' | 'developing' | 'uncertain' | 'needs_attention';
  confidence: 'low' | 'medium' | 'high';
  recentEvidenceSummary: string;
  lastUpdatedAt: string;
};
```

禁止为此建立独立写入链、独立状态机或第二套能力结论。底层观察可以细，长期画像必须粗而稳。

## 十一、异常与恢复投射

隐藏工程错误码不等于隐藏故障。普通用户遇到异常时，页面至少应回答：

1. 当前发生了什么；
2. 已完成内容是否保留；
3. 用户现在能够执行什么操作。

允许提供的出口包括重试、继续、恢复当前题组或返回入口。普通页面不得只显示内部错误码，也不得把无法操作的错误固定在页面不可见位置。

恢复和错误投射不得绕过身份校验、幂等、Outbox 或正式版本门禁。

## 十二、复杂度预算

每增加一个功能，必须回答：

1. 它解决什么真实学习问题；
2. 没有它，现有系统具体哪里做不到；
3. 它是否增加新的长期状态；
4. 收益是否值得增加测试、恢复、兼容和维护成本。

无法回答第 1、2 项时，不开发。

新增能力若需要增加新领域对象、新状态机、新人工步骤、新长期 Profile 字段或第二套事实来源，默认进入高风险评审。高风险评审必须先证明无法复用既有模型，并给出迁移、回滚和退役方案。

## 十三、能力退役流程

能力不得从“低频或低收益”直接进入代码删除。统一流程为：

```text
保留但隐藏
→ 默认关闭
→ 观察兼容影响
→ 标记 deprecated
→ 停止新写入
→ 保留历史只读解释能力
→ 最后删除运行代码
```

退役期间必须保证：

- 历史 Frozen Resource 仍可消费；
- 历史 Attempt、Evidence 和 Session Snapshot 仍可解释；
- 旧版本恢复不依赖已删除的新写逻辑；
- 删除前具有明确迁移或永久只读策略；
- 不通过清除历史事实制造“复杂度降低”。

## 十四、2—4 周稳定试用期

完成界面和触发策略收口后，进入功能冻结期。原则上不增加新的 Training Model 能力，只观察：

- 各条件能力实际触发频率；
- Revision 后是否改善；
- Targeted 是否解决对应 Gap；
- Retest 是否保持；
- Transfer 是否成立；
- 学生是否顺畅进入并完成题组；
- 哪个 Transition 容易中断；
- 用户是否一次理解反馈；
- Session 恢复失败；
- 重复动作或状态冲突；
- task-load-risk；
- 无效或低价值功能触发。

时间窗口与样本事实必须同时披露。达到 2—4 周不自动证明能力有效；样本不足时只记录趋势。

## 十五、试用后的能力分级

| 真实表现 | 处理 |
| --- | --- |
| 高频 + 明显有效 | 核心能力 |
| 低频 + 关键价值 | 后台条件能力 |
| 高频 + 收益有限 | 优化策略 |
| 低频 + 收益有限 | 默认关闭 |
| 低频 + 无收益 + 高维护 | 进入退役流程 |
| 无法判断 | 保留但不扩展 |

能力去留必须结合触发率、完成率、后续独立改善、中断率和维护成本，不以“已经开发完成”作为保留依据。

## 十六、分阶段工程方案

### 阶段 0：只读复杂度审计

工程实施与验收要求见：[阶段 0 只读复杂度审计工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_READ_ONLY_AUDIT_ENGINEERING_AND_DEBUG_PLAN.md)。

允许：

- 统计普通页面暴露的内部术语、状态、入口和说明；
- 建立页面白名单差异报告；
- 统计条件能力触发与无动作路径；
- 输出只读风险清单。

禁止：改变调度、证据、Profile、发布或正式资源。

### 阶段 1：页面投射收口

工程实施与验收要求见：[阶段 1 页面投射与默认展示收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)。

允许：

- 隐藏内部术语；
- 合并重复状态与操作；
- 收敛录入端和 Learning 的展示白名单；
- 改善异常提示与恢复入口。

禁止：改变条件能力是否触发、题组顺序或证据写入。

### 阶段 2：条件触发策略收口

工程实施与验收要求见：[阶段 2 条件触发策略收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_CONDITIONAL_POLICY_ENGINEERING_AND_DEBUG_PLAN.md)。

先以 shadow audit 记录“将触发 / 不触发”结果，不立即改变正式行为；通过一致性和回归验收后，才允许按能力逐项启用新策略。

必须覆盖 Revision、Targeted、Retest、Transfer 的触发、退出、不触发原因与防循环边界。

工程状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`。`C2-01—C2-40` 为 `40 / 40 PASS`，`B2-01—B2-18` 为 `18 / 18 PASS`，旧主链专项回归 `353 / 353 PASS`，Production Build PASS；正式资源、Attempt、Evidence、Profile 与真实校准分母零写入。生产默认仍为四项能力全部 `legacy`，仅具备按单项能力进入 Shadow、验收后再 Enforced 的工程条件，不视为生产策略已经整体切换。验收事实见：[阶段 2 工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage2_engineering_debug_browser_acceptance_2026-08-24.md)。

### 阶段 3：反馈与 Profile 投射收口

允许收敛学生反馈和现有 Profile 的只读展示，不允许建立第二套 Diagnosis、Evidence 或 Profile 写入链。

### 阶段 4：稳定试用与退役决策

冻结新增能力，运行 2—4 周真实试用。只对具有真实证据的能力执行保留、默认关闭或退役决策。

## 十七、跨阶段验收原则

每个阶段都必须同时证明：

1. `Material → Plan → Task → Candidate → Publish → Learning` 旧主链零回归；
2. 本阶段新规则只在授权边界内生效；
3. 禁止修改的领域事实前后保持一致；
4. Internal Acceptance / Fixture 不进入正式资源、Attempt、Profile 或真实校准分母；
5. 普通页面没有新增内部字段泄露；
6. 刷新、恢复、重复点击和跨标签状态不制造重复事实；
7. Production Build 通过；
8. 阶段报告明确记录未完成和不允许宣称的结论。

## 十八、Convergence V1 完成定义

同时满足以下条件时，复杂度收口第一阶段才可完成：

- 用户能够完成一次完整资源录入，却不需要理解 Candidate、Gate、Revision 或 Registry；
- 学生能够完成一次完整训练，却不需要理解 Load、Thread、Evidence Admission 或 Profile Pipeline；
- 没有触发 Revision 时不显示 Revision；
- 没有触发 Targeted 时不显示 Targeted；
- 没有 Retest / Transfer 决策时不存在对应入口；
- 普通页面没有工程状态和内部代码；
- 学生反馈能够一次读懂；
- 异常具有当前状态、数据保留和可执行出口；
- 内部版本、Evidence、Hash、恢复和审计能力继续正常工作；
- 旧主链与历史正式资源零回归。

## 十九、最终冻结原则

> 内部系统负责复杂地判断，用户只负责简单地学习和做决定。

> 复杂能力默认隐藏，只有当它能够改变当前下一步行动时才出现。

本契约批准的是体验投射、条件触发和维护复杂度的收敛，不批准删除核心训练模型、削弱证据边界或绕过版本治理。

`product_complexity_convergence_v1` 自状态进入 `DESIGN FROZEN / ENGINEERING READY` 后，不再以无版本修改改变能力分类、主链冻结边界、普通页面白名单、条件触发原则或退役流程。后续工程文档只能细化实施与验收方式；如需改变上述契约事实，必须建立 V2 契约并提供迁移、兼容和回滚说明。
