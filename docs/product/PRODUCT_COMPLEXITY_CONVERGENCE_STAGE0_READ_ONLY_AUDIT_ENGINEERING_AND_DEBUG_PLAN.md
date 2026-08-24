# 产品复杂度收口阶段 0：只读复杂度审计工程实施与 Debug 验收文档

英文名称：Product Complexity Convergence Stage 0 Read-only Audit Engineering and Debug Plan
对应契约：`product_complexity_convergence_v1`
状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / READ-ONLY VERIFIED`
日期：2026-08-24

关联总契约：[产品复杂度收口契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)

## 一、阶段定位

阶段 0 只回答以下问题：

1. 普通页面当前暴露了哪些内部概念、重复状态、低价值说明和非必要操作；
2. Revision、Targeted、Retest、Transfer 等条件能力当前如何触发、退出和失败恢复；
3. 哪些复杂度可以仅通过页面投射收口，哪些确实需要调整触发策略；
4. 阶段 1 可以修改哪些页面边界，哪些领域事实必须保持冻结。

阶段 0 不修改产品行为，不改变条件能力触发结果，不写正式数据。它是进入页面投射收口前的只读基线，不是“边审计边优化”。

## 二、贯穿性验收原则

阶段 0 必须同时证明：

> 旧主链零回归，并且审计语义只存在于只读报告和 Internal Acceptance 中。

具体要求：

- `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 不变；
- 普通录入端与 Learning 的正式行为不变；
- 审计 Finding 不进入发布门禁、Scheduler、Diagnosis、Evidence 或 Profile；
- Internal Acceptance、Fixture 和审计报告不进入正式资源、Student Attempt、Student Profile 或真实校准分母；
- 阶段 0 发现的问题只能形成阶段 1 建议，不能在本阶段自动修复。

## 三、绝对禁止的修改与写入

阶段 0 不得修改：

- Material、Material Version 与正文；
- Observation Plan、TrainingTask 与 TaskGroupProgressionPlan；
- QuestionCandidate、Assessment、Adoption、Revision 与 Publication；
- Frozen Resource、Resource Version 与 Registry Head；
- Learning Session、Round、Queue、Attempt 与 Session Snapshot；
- Diagnosis、Feedback、Hint、Targeted、Retest 与 Transfer 决策；
- Evidence、Progression Assessment 与 Student Profile；
- Calibration Event、Projection 与真实样本分母；
- 任何功能的默认启用状态或触发门槛。

禁止调用保存、采用、发布、删除、迁移、Profile 重算、校准确认和治理 Apply 接口。

## 四、审计范围

### 4.1 录入端

至少覆盖：

- 素材录入；
- 已有素材选择与恢复；
- AI 训练任务规划；
- 候选生成、重新优化与补充生成；
- 题目卡片折叠与展开；
- 采用并发布；
- 发布中、成功、失败与恢复；
- 已发布资源与历史题治理入口；
- 页面顶部、卡片内部与底部错误提示。

### 4.2 Learning

至少覆盖：

- 学习入口与题组恢复；
- 文章、题目和作答组件；
- 单选与开放文本提交；
- 提示；
- 正确反馈与存在缺口的反馈；
- Revision 可用与不可用；
- Targeted 插入、完成和返回正式序列；
- Retest / Transfer 的普通用户投射；
- 下一题与题组完成；
- 刷新、退出、服务不可用和恢复。

### 4.3 内部页面

Internal Review、Debug、Acceptance 和 Governance 页面只用于确认内部事实有合法承载位置。它们不参与普通页面简化评分，也不得作为“普通用户已经理解复杂状态”的替代证据。

## 五、审计维度

每个页面或状态至少审计以下维度：

1. **信息必要性**：是否影响用户当前判断或动作；
2. **术语边界**：是否暴露后台对象、Hash、Code 或工程身份；
3. **操作唯一性**：同一用户意图是否出现多个主按钮或重复保存步骤；
4. **状态一致性**：标签、正文、按钮和反馈是否描述同一事实；
5. **条件可见性**：未触发能力是否仍占据页面；
6. **反馈负担**：是否超过一个主要缺口和一个可执行动作；
7. **异常可操作性**：是否说明发生了什么、数据是否保留、下一步能做什么；
8. **错误可发现性**：错误是否出现在当前操作附近或具有自动定位；
9. **恢复连续性**：刷新、重试和继续是否保持当前上下文；
10. **事实来源**：页面是否自行拼装第二套状态或结论。

## 六、只读审计对象

### 6.1 页面投射审计

输出 `ConvergenceSurfaceAudit`：

```ts
type ConvergenceSurfaceAudit = {
  auditVersion: 'product_complexity_convergence_stage0_audit_v1';
  routeId: string;
  surfaceId: string;
  audience: 'authoring' | 'student' | 'internal';
  stateName: string;
  visibleTerms: string[];
  visibleActions: string[];
  visibleStatuses: string[];
  visibleExplanations: string[];
  findings: ComplexityConvergenceFinding[];
  recommendedDisposition: 'retain' | 'hide' | 'merge' | 'rewrite' | 'move_internal' | 'stage2_review';
  evidenceRefs: string[];
};
```

该对象只存在于审计运行时与报告，不写回页面组件或正式 Store。

### 6.2 条件能力审计

输出 `ConditionalCapabilityAudit`：

```ts
type ConditionalCapabilityAudit = {
  capability: 'revision' | 'targeted' | 'retest' | 'transfer' | 'successor_governance' | 'calibration_review';
  triggerSource: string;
  triggerConditions: string[];
  exitConditions: string[];
  noActionPath: string;
  recoveryPath: string;
  loopProtection: string[];
  userVisibleWhenInactive: boolean;
  currentBenefitCode?: ComplexityConvergenceBenefitCode;
  traceability: 'complete' | 'partial' | 'insufficient';
  findings: ComplexityConvergenceFinding[];
};
```

阶段 0 不补写缺失的 `expectedBenefitCode`，只报告当前能否映射以及映射限制。

### 6.3 不可变性快照

审计前后必须比较：

- Shared Formal Resource Store Revision；
- Material / Plan / Task / Candidate / Frozen Resource / Registry 数量与摘要；
- Learning Session / Attempt / Evidence / Profile 数量与摘要；
- Progressive Load Calibration Event / Projection 数量；
- 当前标签页的正式学习进度和恢复身份。

任何未经明确排除的变化都使阶段 0 验收失败。

## 七、Finding 口径

阶段 0 使用版本化、只读 Finding：

| Finding | 说明 | 默认去向 |
| --- | --- | --- |
| `internal_term_exposed` | 普通页面暴露后台对象、Hash、Code 或工程身份 | 阶段 1 隐藏或改写 |
| `non_actionable_status` | 状态存在但不能改变当前动作 | 阶段 1 隐藏 |
| `duplicate_primary_action` | 同一意图出现多个主操作 | 阶段 1 合并 |
| `duplicate_state_message` | 标签、正文或提示重复表达同一事实 | 阶段 1 收敛 |
| `conditional_feature_visible_without_trigger` | 条件能力未触发却占据页面 | 阶段 1 隐藏 |
| `scheduler_explanation_exposed` | 向学生解释内部调度理由 | 阶段 1 移除 |
| `profile_pipeline_exposed` | 向学生说明画像或证据管线 | 阶段 1 移除 |
| `error_without_local_action` | 错误没有当前可执行出口 | 阶段 1 改善 |
| `hidden_error_location` | 错误远离当前操作且不可发现 | 阶段 1 改善 |
| `feedback_overloaded` | 同时展示多个缺口、术语或说明 | 阶段 3 重点治理 |
| `fixed_feedback_template` | 无论表现如何都固定输出三段 | 阶段 3 重点治理 |
| `conditional_exit_missing` | 条件能力缺少明确退出路径 | 阶段 2 审查 |
| `targeted_loop_risk` | Targeted 可能递归或阻断正式序列 | 阶段 2 审查 |
| `benefit_code_unstructured` | 当前收益只能由自由文本推断 | 阶段 2 审查 |
| `parallel_fact_source_risk` | 页面或能力建立第二套事实来源 | 禁止直接修复，进入架构复核 |
| `retirement_compatibility_missing` | 拟淘汰能力缺少历史只读兼容路径 | 阶段 4 前阻断退役 |

Finding 不等于产品错误、发布阻断或学生能力结论。它只用于确定后续收口范围。

## 八、报告与分级输出

阶段 0 必须输出：

1. 普通页面白名单差异；
2. 内部术语泄露清单；
3. 重复状态、操作和说明清单；
4. 条件能力触发、退出、无动作和恢复路径；
5. 反馈负担分布；
6. 异常可发现性与可操作性问题；
7. 拟保留、隐藏、合并、改写、移入内部、进入阶段 2 审查的项目；
8. 阶段 1 精确授权修改范围；
9. 不可变性前后摘要；
10. 已知限制和不能据此得出的结论。

风险优先级：

- `P0`：可能造成数据丢失、重复事实、错误发布或学习阻断；
- `P1`：普通用户必须理解内部对象，或错误没有可执行出口；
- `P2`：重复状态、冗长解释、低价值入口和反馈负担；
- `P3`：低频一致性和文案精简建议。

## 九、工程工作包

### WP0-A：审计 Schema 与纯函数规则

- 建立只读 Audit Schema、Finding Code 与 Guard；
- 建立页面白名单和内部术语字典；
- 所有规则必须为纯函数，不依赖写接口；
- 未知页面状态保守标记 `partial`，不得抛出到产品主链。

### WP0-B：静态页面与状态清单

- 扫描路由、页面、组件和用户文案；
- 识别按钮、标签、错误、说明和内部术语；
- 建立“路由 → 状态 → 用户可见事实”清单；
- 不根据组件名直接推断用户可见性，必须结合实际渲染路径。

### WP0-C：条件能力路径审计

- 审计 Revision、Targeted、Retest、Transfer、Successor Governance 与 Calibration Review；
- 标记触发、退出、无动作、恢复、防循环和收益 Code 可追踪性；
- 不修改正式策略。

### WP0-D：真实浏览器只读走查

- 在真实应用内浏览器中逐项走查录入端和 Learning；
- 允许刷新、展开、折叠、切换已有材料和恢复未完成题组；
- 禁止提交答案、发布、采用、删除或执行治理；
- 需要验证交互状态时使用隔离 Acceptance Fixture，四类正式写入必须为 `0`。

### WP0-E：报告、零写入和进入阶段 1 边界

- 生成机器可读摘要和人工报告；
- 比较审计前后不可变性快照；
- 输出阶段 1 允许修改列表；
- 对阶段 2、3、4 问题只登记，不提前修改。

## 十、Debug 验收矩阵

冻结 `C0-01—C0-24`：

| 编号 | 验收项 |
| --- | --- |
| C0-01 | 合法 Surface Audit 通过 Guard |
| C0-02 | 未知版本、路由或受众被拒绝 |
| C0-03 | 相同页面事实重复审计结果稳定 |
| C0-04 | Internal 页面术语不误判为普通页面泄露 |
| C0-05 | 普通页面 Candidate / Hash / Gate 暴露被识别 |
| C0-06 | 同一意图两个主按钮被识别 |
| C0-07 | 状态标签与成功正文冲突被识别 |
| C0-08 | 无操作价值的状态被识别 |
| C0-09 | 未触发 Revision 时存在入口被识别 |
| C0-10 | 未触发 Targeted 时存在入口被识别 |
| C0-11 | Scheduler 解释投射到学生端被识别 |
| C0-12 | 固定三段式反馈与多缺口反馈分别被识别 |
| C0-13 | 本地错误具备状态、数据保留和操作出口时通过 |
| C0-14 | 页面顶部不可发现错误被识别 |
| C0-15 | Revision 触发与退出路径可追踪 |
| C0-16 | Targeted 防递归、返回正式序列边界可追踪 |
| C0-17 | Retest / Transfer 无动作路径可追踪 |
| C0-18 | Successor Governance 只治理明确风险 |
| C0-19 | Calibration 样本不足与 integrity_blocked 被区分 |
| C0-20 | Benefit 自由文本只形成 `benefit_code_unstructured`，不用于统计 |
| C0-21 | 审计不调用保存、采用、发布、删除或 Profile 重算接口 |
| C0-22 | 审计前后正式资源、Registry 与 Store Revision 不变 |
| C0-23 | 审计前后 Session、Attempt、Evidence、Profile 与校准分母不变 |
| C0-24 | 报告汇总与逐项 Finding、风险优先级和建议去向一致 |

## 十一、真实浏览器验收矩阵

阶段 0 工程完成后执行 `CB0-01—CB0-12`：

| 编号 | 场景 |
| --- | --- |
| CB0-01 | 录入端正常加载且审计过程不改变当前材料 |
| CB0-02 | 录入端生成、优化、发布按钮与状态被只读记录 |
| CB0-03 | 已发布卡片展开与收起不改变正式资源 |
| CB0-04 | 错误提示位置、可发现性和操作出口被记录 |
| CB0-05 | Learning 入口与未完成题组恢复保持原状态 |
| CB0-06 | 单选与文本作答页面仅只读检查，不提交答案 |
| CB0-07 | 提示、反馈与 Revision 使用隔离 Fixture 审计 |
| CB0-08 | Targeted、Retest、Transfer 使用隔离 Fixture 审计 |
| CB0-09 | 题组下一题和完成页使用隔离 Fixture 审计 |
| CB0-10 | 普通页面与 Internal 页面术语边界符合受众规则 |
| CB0-11 | 页面刷新后审计报告可恢复且不制造第二份正式事实 |
| CB0-12 | 正式资源 / Attempt / Profile / 真实校准分母写入均为 `0` |

## 十二、旧主链回归集合

阶段 0 至少回归：

- Material Resource Workbench State / Selection；
- Question Candidate Workbench 与 Adoption / Publication；
- Learning Session Queue；
- Phase 16.3 Real Learning Chain；
- Learning Persistence；
- Revision Stage 1—4；
- Single Choice；
- Targeted Micro-training Stage 1—4；
- Reading Training Progressive Load Stage 0—4；
- Production Build。

阶段 0 只新增审计代码时，任何既有行为变化都视为回归，不得以“后续会收口”为理由接受。

## 十三、工程交付物

阶段 0 工程完成时至少交付：

- 版本化 Audit Schema 与 Finding Code；
- 纯函数页面白名单和文案审计规则；
- 条件能力路径审计器；
- 只读快照与 Digest 比较；
- `C0-01—C0-24` Debug；
- `CB0-01—CB0-12` 浏览器验收入口；
- 普通页面复杂度只读审计报告；
- 阶段 1 授权修改清单；
- 零写入和旧主链零回归报告。

## 十四、阶段完成门槛

只有同时满足以下条件，才可将阶段 0 标记为 `ENGINEERING COMPLETE / DEBUG ACCEPTED / READ-ONLY VERIFIED`：

1. `C0-01—C0-24` 全部通过；
2. `CB0-01—CB0-12` 全部通过；
3. 录入端和 Learning 主要状态均被覆盖，未覆盖状态明确记录原因；
4. 六类条件能力均形成触发、退出、无动作、恢复和限制报告；
5. 审计前后正式资源、Attempt、Profile 与真实校准分母写入均为 `0`；
6. 旧主链专项回归和 Production Build 通过；
7. 报告明确区分阶段 1、2、3、4 的建议，不提前修改；
8. 没有从审计 Finding 形成学生能力、教育效果或正式题质量结论。

## 十五、进入阶段 1 的边界

阶段 0 完成后，阶段 1 只允许处理：

- 普通页面内部术语隐藏；
- 重复状态、说明和主操作合并；
- 未触发能力入口隐藏；
- Scheduler / Profile Pipeline 工程说明移出学生页面；
- 错误提示的本地可发现性与可执行出口；
- 不改变业务事实的反馈文案减负。

以下问题必须留到后续阶段：

- Revision / Targeted / Retest / Transfer 触发与退出策略：阶段 2；
- Feedback 生成策略与 Profile 只读投影：阶段 3；
- 能力默认关闭、deprecated 和退役：阶段 4。

阶段 1 不得根据阶段 0 Finding 修改正式资源、题组顺序、证据写入或长期能力结论。

阶段 1 的精确页面白名单、投射适配边界、工程工作包与验收矩阵见：[阶段 1 页面投射与默认展示收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)。

## 十六、当前结论边界

阶段 0 工程与验收已经完成，但其结论仍严格限制为“只读审计能力已建立且零写入得到验证”，不得宣称：

- 页面复杂度已经降低；
- 条件能力触发已经收口；
- 用户理解成本已经改善；
- 低价值能力已经退出；
- 真实试用效果已经验证。

本文件冻结的工程、Debug、真实浏览器只读联调和零写入证明已经完成，现已具备进入阶段 1 的工程前提。

## 十七、工程完成记录

2026-08-24 已完成：

- `C0-01—C0-24`：`24/24 PASS`；
- `CB0-01—CB0-12`：`12/12 PASS`；
- 正式资源 / Attempt / Profile / 真实校准分母写入：`0 / 0 / 0 / 0`；
- 旧主链专项回归与 Production Build：通过；
- 真实浏览器报告恢复、局部披露和控制台检查：通过。

验收报告见：[阶段 0 工程与 Debug 验收报告](../education/phase/reports/product_complexity_convergence_stage0_engineering_debug_acceptance_2026-08-24.md)。
