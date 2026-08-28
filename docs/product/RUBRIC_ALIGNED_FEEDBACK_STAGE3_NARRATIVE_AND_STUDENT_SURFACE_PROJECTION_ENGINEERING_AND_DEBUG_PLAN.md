# Rubric 对齐反馈阶段 3：Narrative 与学生页面投射工程实施与 Debug 验收文档

**English Name:** Rubric-aligned Feedback Stage 3 Narrative and Student Surface Projection Engineering and Debug Plan

**状态：** `ENGINEERING COMPLETE / AUTOMATED DEBUG VERIFIED / FULL BROWSER ACCEPTED`

**阶段版本：** `rubric_aligned_feedback_stage3_v1`

**上游版本：** `rubric_aligned_feedback_stage2_v1`

**Projection Schema：** `rubric_feedback_projection_v1`

**Student-visible Grounding Schema：** `student_visible_feedback_grounding_v1`

**Narrative Schema：** `student_learning_narrative_projection_v1`（保持不变）

**更新日期：** 2026-08-28

上游工程文档：

- [阶段 1：确定性 Projection](./RUBRIC_ALIGNED_FEEDBACK_STAGE1_DETERMINISTIC_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 2：Grounding 与 Action Plan 最小接入](./RUBRIC_ALIGNED_FEEDBACK_STAGE2_GROUNDING_ACTION_PLAN_INTEGRATION_ENGINEERING_AND_DEBUG_PLAN.md)

## 一、阶段目标

阶段 3 只负责把阶段 2 已经通过门禁的最小反馈事实，接入现有 Narrative 与 Learning 学生页面：

```text
RubricFeedbackProjection（完整、内部）
↓ 最小裁剪
StudentVisibleFeedbackGrounding（受限、内部）
↓
StudentFeedbackActionPlan（受限、内部）
↓ 身份校验 + 原子路径选择
StudentLearningNarrativeProjection v1
↓
StudentLearningPresentation
↓
现有 Learning 反馈区
```

阶段 3 必须实现：

1. 文本题 Narrative 可以消费合法的 Rubric 对齐 Action Plan；
2. 学生页面只显示“已经做到 / 主要缺口 / 一个下一步动作”中当前确有事实支持的区块；
3. 完整覆盖时不制造缺口和修改动作；
4. 新路径失败时完整回退旧路径，不出现空白页、字段混拼或半套反馈；
5. 单项选择继续使用独立反馈链；
6. Revision、固定题组续题、Retest / Transfer 的既有行为不被扩大；
7. 全部正式题静态审计、代表性动态回归与真实浏览器验收形成阶段准入证据。

阶段 3 完成后只能声明：

> 通过身份与披露门禁的 Rubric 对齐反馈，已经能够在受控开关下原子投射到学生 Narrative 与现有 Learning 反馈页面。

不能声明：

- 学生已经掌握 Rubric 所代表的能力；
- 一次修订已经构成独立掌握证据；
- `limited / not_assessable` 可以通过 Narrative 模板补成具体结论；
- 完整 Rubric、`acceptedSignals` 或参考答案可以进入 Narrative；
- 阶段 3 已完成真实学生效果校准。

## 二、贯穿性验收原则

每项工程必须同时证明：

1. 旧 `Publish → Learning → Diagnosis → Evidence → Revision` 主链零回归；
2. 新语义只在阶段 3 允许的 Narrative 与学生页面投射边界内生效；
3. 正式资源、Rubric、Diagnosis、Evidence、Profile 和 Growth Memory 零写入；
4. 新旧反馈不能按字段混合，必须按完整来源原子选择；
5. 页面不得为了保持固定版式制造肯定、缺口、线索或下一步；
6. 任何学生可见文本都必须可追溯，且不能组合成完整答案；
7. 相同输入、相同开关与相同身份必须得到确定输出；
8. 关闭开关时，学生页面与阶段 2 验收基线完全一致。

统一原则冻结为：

> Narrative 只表达已成立的教学事实，不重新诊断；页面只投射当前决策需要的信息，不补齐系统缺失的信息。

## 三、保持不变的主链与责任边界

以下主链保持不变：

```text
Material → Observation Plan → TrainingTask → QuestionCandidate
→ Adopt → Frozen Resource → Learning → Formal Diagnosis → Evidence
```

以下责任保持不变：

- Formal Diagnosis 决定本次回答覆盖与缺口；
- Requirement Coverage 保存可观察的任务完成状态；
- Rubric Feedback Projection 只进行确定性转换和 Primary Item 选择；
- Action Plan 只将一个已确认断点转换为一个行动；
- Narrative 只将合法 Action Plan 转换成学生语言；
- Learning 页面只负责按当前状态展示，不重新解释缺口；
- Revision Eligibility 继续决定是否允许一次反馈后修订；
- Evidence Return 继续决定哪些表现可进入正式证据链。

阶段 3 禁止：

- 修改 Frozen Question / Rubric；
- 让 Narrative 读取完整 Rubric、Calibration Answer 或完整学生回答；
- 根据页面是否“看起来空”补造反馈；
- 让页面从 `answerStatus`、题干关键词或自然语言文案猜测缺口；
- 让新路径扩大 Revision、Retest、Transfer 或 Targeted Micro-training 资格；
- 把 Rubric 对齐反馈写入 Student Profile 或长期能力结论。

## 四、阶段 3 最小接入接口

### 4.1 Narrative 接入包

阶段 3 建议新增只读内部输入包，不改变现有学生输出 Schema：

```ts
type RubricAlignedNarrativeInput = {
  integrationVersion: 'rubric_aligned_narrative_integration_v1';
  sourceMode: 'rubric_projection';
  context: {
    studentId: string;
    learningRoundId: string;
    taskId: string;
    executionSessionId: string;
    responseId: string;
    questionVersionId: string;
  };
  responseFormat: 'short_text' | 'long_text';
  taskRole: 'observation' | 'diagnosis' | 'training' | 'retest' | 'transfer';
  projectionId: string;
  grounding: StudentVisibleFeedbackGrounding;
  actionPlan: StudentFeedbackActionPlan;
};
```

该接入包只允许由阶段 2 Adapter 组装。Narrative Builder 不得自行构建 Projection，也不得用完整 Rubric 修补接入包。

现有 `StudentLearningNarrativeInput` 只增加可选字段：

```ts
type StudentLearningNarrativeInput = {
  // existing fields stay unchanged
  rubricAlignedFeedback?: RubricAlignedNarrativeInput;
};
```

### 4.2 Narrative 输出保持不变

阶段 3 继续输出：

```ts
StudentLearningNarrativeProjection v1
→ StudentLearningPresentation
```

不新增第二套学生反馈对象，不改变以下学生展示字段：

- `outcome.achieved`；
- `outcome.primaryGap`；
- `outcome.primaryGapMode`；
- `outcome.primaryGapReasonCode`；
- `nextAction`；
- `continuationReason`。

`responseAnchor` 可以继续作为内部追溯信息保留，但阶段 3 不新增独立学生展示区块。

### 4.3 身份 Guard

只有以下条件全部满足时，Narrative 才允许选择 Rubric 对齐路径：

1. `integrationVersion` 正确；
2. `grounding` 与 `actionPlan` 均通过 Schema Guard；
3. `studentId / learningRoundId / taskId / executionSessionId / responseId / questionVersionId` 与当前执行链一致；
4. `grounding.sourceProjectionId = projectionId`；
5. `actionPlan.evidenceLinks` 包含 `projectionId`；
6. `actionPlan.studentId / learningRoundId` 与 Context 一致；
7. `actionPlan.validation.passed = true`；
8. `responseFormat` 为文本题；
9. `taskRole` 与当前正式任务一致；
10. 接入包没有禁止字段和完整答案组合。

任一条件失败：

- 整个 Rubric 对齐 Narrative 路径失效；
- 不允许只采用其中某个字段；
- 记录结构化 issue；
- 回到完整旧 Narrative 路径。

## 五、Narrative 的确定性投射规则

### 5.1 已经做到

`outcome.achieved` 只能来自：

```text
actionPlan.acknowledgedAction
```

且必须满足：

- 对应学生本人已核验动作；
- 能回溯到当前 Response 与 Rubric Projection；
- 不扩大为“已经理解、已经掌握、表现很好”；
- 不补充学生尚未写出的完整依据或结论。

`acknowledgedAction` 缺失时，允许省略“已经做到”，不得从旧链或完整 Rubric 单独补一条肯定。

### 5.2 主要缺口

`outcome.primaryGap` 只能来自：

```text
actionPlan.missingAnswerPart
```

并保留阶段 1 已确认的唯一 Primary Item 语义。Narrative 不得：

- 增加第二个缺口；
- 把 `problemMechanism` 改写成新的学生能力结论；
- 把缺少关键词等同于缺少理解；
- 把 `not_assessable` 写成具体错误。

`primaryGapMode / primaryGapReasonCode` 继续来自正式 Requirement Coverage / Formal Diagnosis，不由 Rubric 对齐文案反推。

### 5.3 下一步动作

`nextAction` 按以下优先级确定：

```text
actionPlan.nextOperations[0]
↓ 若为空
actionPlan.thinkingPrompt
↓ 若仍为空
省略
```

只允许一个动作。禁止：

- 把多个步骤拼成标准答案拆解；
- 同时给出正确结论、完整依据和完整解释关系；
- 用“深入思考、加强理解、再结合材料分析”等通用兜底；
- 首次反馈直接输出 `scaffoldTemplate`；
- 为保持按钮上方有文案而创造下一步。

### 5.4 完整覆盖

当合法 Grounding 表示完整达成：

- 可以显示一个真实完成动作；
- 不显示主要缺口；
- 不显示修改动作；
- 可以按固定题组状态显示“进入第 k 题（共 n 题）”；
- 不生成“继续巩固、补充不足”等暗示未完成的说明。

### 5.5 `limited / not_assessable`

当 Projection 未达到 `ready`，阶段 3 不生成 Rubric 对齐 Narrative：

- `limited`：完整使用旧 Narrative 路径；
- `not_assessable`：旧路径只能显示其已成立的最低安全说明；
- 不允许新旧字段拼装成“看似具体”的反馈；
- 不得把 Runtime 限制投射成学生能力不足。

## 六、题型与任务角色分流

### 6.1 文本题

`short_text / long_text` 可以进入 Rubric 对齐路径。学生一次只看到：

- 一个已完成动作（如果成立）；
- 一个主要缺口（如果成立）；
- 一个下一步动作（如果允许）。

### 6.2 单项选择

单项选择不进入本阶段文本 Narrative 接入包，继续使用既有独立链：

```text
selectedOptionId
→ option identity
→ distractorRationale
→ 典型误读
→ 一个重新核对动作
```

阶段 3 不改变单选页面标题、Revision 资格或反馈 Schema。单选错误不得出现“补充文本依据、解释关系、重新组织答案”。

### 6.3 Revision

- Rubric 对齐 Narrative 可以说明本次主要缺口；
- 是否显示“根据反馈修订”继续由既有 Revision Eligibility 决定；
- Narrative 不得自行开放修订；
- 修订后的 Evaluation 继续比较首次主要缺口；
- 首次 Evidence 不被覆盖；
- 新路径失败时，Revision 入口不能消失或新增。

### 6.4 Retest / Transfer

- 只允许 `result_only`；
- 不显示即时完整修复路径；
- 不开放反馈后修订；
- 不泄露下一次独立验证需要的答案；
- 现有 Retest / Transfer 的 Evidence 规则不变。

### 6.5 固定题组与动态调度

- 固定题组继续只显示“进入第 k 题（共 n 题）”；
- Rubric 对齐反馈不得把普通续题解释为动态策略变化；
- `continuationReason` 仅在现有 Narrative 契约允许的真实动态调度中显示；
- 新路径不得改变 `canAdvance / sessionComplete / primaryAction`。

### 6.6 Targeted Micro-training

- 阶段 3 不修改触发与匹配规则；
- 新反馈只可以解释已确认的当前缺口；
- 是否调度专项训练继续由正式 Reason Code、资源匹配和既有策略决定；
- Narrative 不得因为存在 Rubric Gap 自动创建微训练。

## 七、学生页面投射边界

### 7.1 复用现有页面结构

阶段 3 复用现有 `StudentLearningNarrativeOutcome`，不新增平行反馈卡片。页面允许的区块为：

| 状态 | 显示 |
| --- | --- |
| 只有达成 | “已经完成的思考” |
| 只有缺口 | “思考缺口 / 还需补充 / 需要重新判断” |
| 达成 + 缺口 | 依次显示两个区块 |
| 有合法行动 | “下一步训练” |
| 完整覆盖 | 达成 + 续题按钮，不制造缺口 |
| 无合法 Narrative | 完整回退旧受控反馈或最低安全说明 |

页面不展示：

- Projection ID；
- Rubric Item ID；
- Requirement ID；
- `acceptedSignals`；
- 权重、置信度、Provider Metadata；
- `primaryObservedGap` 枚举；
- Action Plan 内部限制与 Evidence Links。

### 7.2 原子来源选择

单个结果页必须先选择完整展示来源：

```text
合法 Rubric-aligned Presentation
→ 整页使用新 Narrative

否则，合法 Legacy Presentation
→ 整页使用旧 Narrative

否则，合法 Controlled Feedback Fallback
→ 显示最低安全说明
```

禁止以下混拼：

- 新路径的肯定 + 旧路径的缺口；
- 旧路径的肯定 + 新路径的行动；
- 新路径失败后仍保留其一半字段；
- 页面分别对每个字段执行 fallback。

### 7.3 空区块与顺序

- 无内容的标题和区块不得渲染；
- `achieved → primaryGap → nextAction` 是信息顺序，不是强制三块模板；
- 不单独展示 `responseAnchor`；
- 不重复显示旧 `thinkingReview / guidance`；
- 不增加“评分要点”“Rubric 对齐”等内部术语；
- 结果页保持一个主要操作入口和既有 Revision 次操作。

### 7.4 可访问性与状态恢复

- 刷新、恢复 Session、进入修订和返回反馈页时，来源选择必须稳定；
- 新旧路径切换不得改变题目进度；
- 内容渐进展示不得隐藏主要操作；
- Narrative 缺失不得形成空白卡片；
- 错误与回退信息必须在当前可见区域出现；
- 页面重建不得产生新的正式写入。

## 八、开关、Shadow 与回退策略

冻结三种模式：

```ts
type RubricAlignedFeedbackSurfaceMode =
  | 'legacy'
  | 'shadow'
  | 'student_visible';
```

### 8.1 `legacy`

- 不构建学生可见新路径；
- 页面与阶段 2 基线完全一致；
- 用于紧急回退。

### 8.2 `shadow`

- 构建 Projection、Grounding、Action Plan 与 Narrative；
- 执行身份、泄露和一致性校验；
- 页面仍显示 Legacy Presentation；
- 只记录不含学生原文、完整 Rubric、Prompt 或 Raw Output 的结构化 Debug 结果；
- 不写入正式教育事实。

### 8.3 `student_visible`

- 只有新路径全链合法时才显示新 Narrative；
- 任一步失败即原子回退 Legacy；
- 不改变 Diagnosis、Evidence、Revision 与任务队列状态；
- 首次启用只限本地受控验收和真实 Trial 准入范围。

模式默认值在阶段 3 工程验收前必须为 `legacy` 或 `shadow`，不得未经浏览器验收直接全量开启 `student_visible`。

## 九、泄露与表达质量门禁

学生可见 Narrative 必须同时满足：

1. 所有陈述具有当前执行链来源；
2. 不包含内部 ID、枚举、权重或 Provider 术语；
3. 不包含完整 `acceptedSignals`；
4. 不复制完整 Rubric Item；
5. 不同时给出正确结论、完整依据和完整关系解释；
6. 不把学生未写出的内容表述为“你已经做到”；
7. 不把一次任务缺口写成长期能力缺陷；
8. 不使用通用兜底文案代替具体断点；
9. 不在单选中使用文本题补全逻辑；
10. 不在完整覆盖后制造改进建议。

质量门禁失败时必须丢弃整条新 Narrative，不得通过删掉个别敏感词后继续展示。

## 十、零写入与历史兼容

阶段 3 的新链必须是纯投射或等价只读服务，不得调用：

- Shared Formal Resource Store 写接口；
- Question / Rubric 发布接口；
- Diagnosis / Evidence Repository 写接口；
- Revision Attempt 写接口；
- Student Profile / Growth Memory 写接口；
- Trial / Calibration 事件写接口。

历史兼容：

- 历史 Frozen Resource 有完整 Rubric 且 Projection `ready`：允许走新路径；
- 历史 Rubric 信息有限：保持 Legacy；
- 历史 Response / Session 身份不完整：保持 Legacy，不猜测绑定；
- 历史单选：保持独立反馈链；
- 不为启用阶段 3 批量生成 successor Candidate；
- 不修改 Shared Store revision。

## 十一、建议工程文件

新增：

```text
src/ai/agents/rubricAlignedNarrativeAdapter.ts
src/ai/tests/runRubricAlignedFeedbackStage3Debug.ts
```

窄范围修改：

```text
src/ai/agents/studentLearningNarrativeAgent.ts
src/ai/schemas/studentLearningNarrative.schema.ts（仅在需要声明可选内部输入时）
src/api/phase163LiveLearning.ts
src/pages/Phase163LiveLearningWorkspace.jsx
package.json
```

阶段 3 禁止修改：

```text
Frozen Resource / Rubric Schema
Formal Diagnosis Agent
Evidence Return
Revision Eligibility
Task Queue Ordering
Targeted Micro-training Scheduler
Student Profile / Growth Memory
正式资源发布逻辑
```

## 十二、Debug 验收矩阵

### 12.1 接口、身份与原子选择

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RG3-01 | 合法接入包 | 构建新 Narrative |
| RG3-02 | Projection ID 错位 | 整条新路径失效 |
| RG3-03 | Response ID 错位 | 原子回退 Legacy |
| RG3-04 | Task / Round / Session 错位 | 不显示新反馈 |
| RG3-05 | Action Plan 校验失败 | 不使用其中任何字段 |
| RG3-06 | Grounding 与 Action Plan 不同源 | 阻断新路径 |
| RG3-07 | `legacy` 模式 | 页面与阶段 2 一致 |
| RG3-08 | `shadow` 模式 | 构建但不展示、不写入 |
| RG3-09 | `student_visible` 模式且全链合法 | 完整选择新来源 |
| RG3-10 | 新路径中途失败 | 完整选择 Legacy，不混拼 |

### 12.2 Narrative 语义

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RG3-11 | 全部达成 | 只显示真实达成，不制造缺口与动作 |
| RG3-12 | 结论成立、缺依据 | 肯定已有判断，只聚焦一处依据 |
| RG3-13 | 有依据、缺解释 | 肯定已找到内容，只要求说明关系 |
| RG3-14 | 多方面完成一部分 | 只投射 Primary Item |
| RG3-15 | 范围偏离 | 指向题干范围，不给正确答案 |
| RG3-16 | 表达未组织 | 给一个组织动作，不改写成范文 |
| RG3-17 | 无合法肯定动作 | 省略“已经做到” |
| RG3-18 | 无合法下一步 | 省略行动区块 |
| RG3-19 | `limited` | 使用完整 Legacy 来源 |
| RG3-20 | `not_assessable` | 不生成具体错误或能力结论 |

### 12.3 题型、角色与连续流程

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RG3-21 | 单选正确 | 独立链简洁确认 |
| RG3-22 | 单选错误 | 使用 distractor 线索，不要求写文本 |
| RG3-23 | Revision 可用 | 入口保持，目标与 Primary Gap 同源 |
| RG3-24 | Revision 不可用 | 新 Narrative 不自行开放入口 |
| RG3-25 | Retest | result_only，不显示即时修复路径 |
| RG3-26 | Transfer | result_only，不泄露独立验证答案 |
| RG3-27 | 固定题组下一题 | 进度与按钮保持，不显示动态继续理由 |
| RG3-28 | Session 刷新恢复 | 同一来源、同一 Narrative、进度不变 |
| RG3-29 | Targeted Micro-training | 不改变触发、匹配与返回队列 |
| RG3-30 | Runtime retry / blocked | 不形成空白卡片或错误能力提示 |

### 12.4 泄露、页面与零回归

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RG3-31 | 输入包含完整 Rubric / acceptedSignals | 进入 Narrative 前已移除或阻断 |
| RG3-32 | 新 Narrative 可拼成完整答案 | 语义组合门禁阻断整条新路径 |
| RG3-33 | 页面无内容字段 | 不渲染空标题、空卡片 |
| RG3-34 | 新旧 Presentation 同时存在 | 页面只选一个完整来源 |
| RG3-35 | 重复执行 | 输出确定且 Shared Store 零写入 |
| RG3-36 | 旧主链全回归 | Publish、Diagnosis、Evidence、Revision 无变化 |

## 十三、真实浏览器验收矩阵

至少完成以下真实浏览器场景：

| 编号 | 浏览器场景 | 验收重点 |
| --- | --- | --- |
| B3-01 | 文本题完整达成 | 无虚假缺口和修改动作 |
| B3-02 | 有结论、缺依据 | 反馈与学生原回答对应 |
| B3-03 | 有依据、缺解释 | 一个清晰思考动作 |
| B3-04 | 无有效肯定 | 页面不制造表扬区块 |
| B3-05 | 单选正确 | 不出现文本补全反馈 |
| B3-06 | 单选错误 | 显示对应误读与核对动作 |
| B3-07 | Revision 可用 | 主次操作与目标一致 |
| B3-08 | 修订完成 | 不宣称独立掌握 |
| B3-09 | 固定题组连续下一题 | 题号、队列和按钮正确 |
| B3-10 | 刷新与恢复 | Narrative 与操作状态稳定 |
| B3-11 | Retest / Transfer | 不开放即时修订与答案路径 |
| B3-12 | 新路径故障注入 | 页面完整回退旧链，无混拼 |
| B3-13 | `legacy / shadow / student_visible` 切换 | 只影响允许的展示边界 |
| B3-14 | 历史资源 | 可兼容或安全回退 |
| B3-15 | Runtime blocked / retry | 当前区域可见、安全可恢复 |
| B3-16 | 连续 5—6 题完整 Session | 无反馈死循环、无提前返回入口 |

浏览器验收必须保存：

- 模式与 Runtime Identity；
- 当前正式资源版本；
- Response Format / Task Role；
- 选择的新旧来源；
- 是否发生回退；
- 页面截图或等价观察记录；
- Shared Store revision 前后值。

不得保存 API Key、完整 Prompt、学生完整原回答或 Provider Raw Output。

## 十四、旧主链回归范围

阶段 3 至少运行：

```bash
npm run debug:rubric-aligned-feedback-stage0
npm run debug:rubric-aligned-feedback-stage1
npm run debug:rubric-aligned-feedback-stage2
npm run debug:student-feedback-grounding
npm run debug:student-feedback-action-plan
npm run debug:student-learning-narrative
npm run debug:learning-feedback-presentation
npm run debug:controlled-feedback-expression
npm run debug:reading-single-choice-stage4
npm run debug:learning-feedback-revision-stage1
npm run debug:learning-feedback-revision-stage2
npm run debug:learning-feedback-revision-stage3
npm run debug:learning-feedback-revision-stage4
npm run audit:formal-question-hint-feedback
npm run build
```

阶段 3 新增命令建议冻结为：

```bash
npm run debug:rubric-aligned-feedback-stage3
```

验收报告必须记录每项命令的实际通过数，不得只写“回归通过”。

## 十五、工程实施顺序

### Step 1：Narrative 接入包与 Guard

- 新增 `RubricAlignedNarrativeInput`；
- 完成身份、同源性、题型和角色 Guard；
- 完成 `RG3-01—RG3-10`。

### Step 2：确定性 Narrative 映射

- 映射达成、Primary Gap 和一个行动；
- 建立完整覆盖、limited、not_assessable 分支；
- 完成 `RG3-11—RG3-20`。

### Step 3：原子来源选择与开关

- 接入 `legacy / shadow / student_visible`；
- 禁止页面逐字段 fallback；
- 完成 `RG3-31—RG3-35`。

### Step 4：Learning 页面窄范围接入

- 复用现有反馈区和操作入口；
- 验证单选、Revision、Retest / Transfer、固定题组和恢复；
- 完成 `RG3-21—RG3-30`。

### Step 5：批量审计、浏览器联调与零回归

- 完成全部正式题静态审计；
- 完成代表性动态样例；
- 完成 `B3-01—B3-16`；
- 完成 `RG3-36`、production build 与零写入证明；
- 输出独立验收报告。

## 十六、完成定义

阶段 3 只有满足以下全部条件才能验收：

1. Narrative 只能消费通过门禁的最小 Grounding 与 Action Plan；
2. 完整 Rubric、`acceptedSignals`、Calibration Answer 和完整答案组合不能进入 Narrative；
3. 新旧路径按完整来源原子选择，不按字段混拼；
4. 完整达成不制造缺口和修改动作；
5. 部分达成只显示一个已确认 Primary Gap 与一个行动；
6. 单项选择保持独立链；
7. Revision 入口与目标不被扩大或错配；
8. Retest / Transfer 保持独立性；
9. 固定题组、Session 恢复和 Targeted Micro-training 无回归；
10. 页面不出现空白卡片、重复反馈块或内部术语；
11. `legacy / shadow / student_visible` 三种模式行为确定；
12. `RG3-01—RG3-36` 全部通过；
13. `B3-01—B3-16` 全部完成并签署；
14. 全部正式题审计和代表性动态回归通过；
15. Shared Store revision、正式资源、Diagnosis、Evidence、Revision 与 Profile 零写入；
16. production build 通过；
17. 输出独立工程与浏览器验收报告。

## 十七、阶段 4 准入条件

只有阶段 3 完成定义全部满足后，阶段 4 才允许进行真实 Trial 校准。阶段 4 只观察：

- 反馈是否准确对应学生原回答；
- 学生能否复述“已做到、还缺什么、下一步做什么”；
- 学生是否能执行一个行动完成一次修订；
- 同一主要缺口在修订或后续独立任务中是否减少；
- 是否出现答案泄露、错误肯定、题型串用或反馈阅读负担。

真实 Trial 不得直接修改正式 Rubric、长期能力状态或历史 Evidence。任何资源质量问题继续通过审计 Finding 与 successor Candidate 治理。

## 十八、关联文档

- [评分要点对齐的学生反馈优化方案](./RUBRIC_ALIGNED_STUDENT_FEEDBACK_OPTIMIZATION_PLAN.md)
- [学生学习叙事校准](./STUDENT_LEARNING_NARRATIVE_CALIBRATION.md)
- [反馈观察对象投射收口](./FEEDBACK_OBSERVATION_TARGET_PROJECTION_CONVERGENCE_ENGINEERING_DEBUG_ACCEPTANCE.md)
- [Learning 反馈后修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)
- [全部正式题提示与反馈批量审计契约](./FORMAL_QUESTION_HINT_AND_FEEDBACK_BATCH_AUDIT_CONTRACT.md)
- [阶段 0 只读审计报告](../education/phase/reports/rubric_aligned_feedback_stage0_readonly_audit_2026-08-27.md)
- [阶段 1 工程验收报告](../education/phase/reports/rubric_aligned_feedback_stage1_engineering_debug_acceptance_2026-08-27.md)
- [阶段 2 工程验收报告](../education/phase/reports/rubric_aligned_feedback_stage2_engineering_debug_acceptance_2026-08-27.md)
- [阶段 3 工程与自动化 Debug 验收报告](../education/phase/reports/rubric_aligned_feedback_stage3_engineering_debug_acceptance_2026-08-28.md)
- [阶段 3 全量真实浏览器联调签署](../education/phase/reports/rubric_aligned_feedback_stage3_full_browser_acceptance_2026-08-28.md)
- [阶段 4：真实 Trial 校准与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE4_REAL_TRIAL_CALIBRATION_AND_DEBUG_ACCEPTANCE_PLAN.md)

## 十九、工程实施记录（2026-08-28）

阶段 3 已完成以下工程内容：

1. 新增 `RubricAlignedNarrativeInput v1` 与完整身份 Guard；
2. 在现有 `StudentLearningNarrativeProjection v1` 内实现 Rubric 对齐的确定性映射，不新增第二套学生输出 Schema；
3. 新增 `legacy / shadow / student_visible` 三态来源选择，默认保持 `shadow`；
4. 新旧反馈按完整来源原子选择，新路径任一校验失败即整包回退 Legacy；
5. Learning 运行时从当前 Frozen Resource、Formal Diagnosis、Requirement Coverage、Grounding 与 Action Plan 组装最小接入包；
6. 单项选择继续走独立链；Retest / Transfer 只投射 `result_only`，不显示即时修复缺口与动作；
7. `RG3-01—RG3-36` 自动化工程验收 36/36 PASS；
8. 阶段 0、阶段 1、阶段 2、旧 Narrative、反馈展示、固定题组、Revision、单选和真实学习链关键回归全部通过；
9. 全部正式题提示与反馈批量审计通过；Shared Store revision 在验收前后保持 `1963`；
10. production build 通过；
11. 新增隔离零写入的阶段 3 浏览器验收入口；
12. 修复 Browser 路径直接依赖 `node:crypto` 导致的运行时空白；
13. `B3-01—B3-16` 在干净应用内浏览器中完成 `16/16 PASS`，控制台 `0 error / 0 warning`，正式 Revision `1963 → 1963`，六类正式写入均为 `0`；
14. 页面刷新后验收结果可稳定恢复。

阶段 3 的工程、自动化 Debug 与真实浏览器签署现已完成。默认模式仍保持 `shadow`，因此本次签署不会直接改变真实学生反馈；是否切换为 `student_visible` 必须由后续 Trial 激活决策单独授权。
