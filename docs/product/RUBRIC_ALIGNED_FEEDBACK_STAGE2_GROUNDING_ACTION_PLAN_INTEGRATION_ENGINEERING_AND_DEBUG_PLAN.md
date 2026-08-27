# Rubric 对齐反馈阶段 2：Grounding 与 Action Plan 最小接入工程实施与 Debug 验收文档

英文名称：Rubric-aligned Feedback Stage 2 Minimal Grounding and Action Plan Integration Engineering and Debug Plan

状态：`ENGINEERING ACCEPTED`

阶段版本：`rubric_aligned_feedback_stage2_v1`

上游版本：`rubric_aligned_feedback_stage1_v1`

Projection Schema：`rubric_feedback_projection_v1`

Student-visible Grounding Schema：`student_visible_feedback_grounding_v1`

更新日期：2026-08-27

工程验收报告：[`rubric_aligned_feedback_stage2_engineering_debug_acceptance_2026-08-27.md`](../education/phase/reports/rubric_aligned_feedback_stage2_engineering_debug_acceptance_2026-08-27.md)

阶段 1 验收基线：[`rubric_aligned_feedback_stage1_engineering_debug_acceptance_2026-08-27.md`](../education/phase/reports/rubric_aligned_feedback_stage1_engineering_debug_acceptance_2026-08-27.md)

## 一、阶段目标

阶段 2 只建立以下内部接入：

```text
RubricFeedbackProjection（完整、内部）
↓ 最小信息裁剪
StudentVisibleFeedbackGrounding（受限、内部传递）
↓ 可选输入
StudentFeedbackActionPlan（现有输出契约）
```

目标是让现有 Grounding 与 Action Plan 能够优先消费已经通过阶段 1 验收的确定性 Projection，同时保证：

1. Action Plan 不读取完整 Rubric；
2. Action Plan 不重新判断 Rubric Coverage；
3. 学生可见信息只包含完成当前思考动作所需的最小信息；
4. 阶段 2 不修改 Learning 页面和 Narrative 展示；
5. Projection 不可用时，旧反馈链保持原样运行；
6. 单项选择继续走独立反馈链；
7. 接入不写入正式资源、Diagnosis、Evidence、Revision 或 Student Profile。

阶段 2 完成后只能声明：

> 系统已经能把一个 ready Projection 安全裁剪为最小 Grounding，并让 Action Plan 使用该 Grounding 生成内部行动计划。

不能声明：

- 学生页面已经展示 Rubric 对齐反馈；
- 新反馈已经替代旧链；
- `limited / not_assessable` 可以通过模板补全；
- Revision、Retest 或 Transfer 的学生交互已经变化；
- 完整 Rubric 可以传入 Narrative Agent。

## 二、贯穿性验收原则

每项工程必须同时证明：

1. 旧 Publish → Learning → Diagnosis → Evidence → Revision 主链零回归；
2. 新语义只在本阶段允许的 Grounding / Action Plan 内部边界内生效；
3. 学生界面在阶段 2 前后完全不变；
4. 失败不能回退为关键词猜测、完整 Rubric 改写或新的通用反馈模板；
5. 同一输入输出确定，重复运行零写入。

## 三、主链接入边界

保持不变：

```text
Material → Plan → TrainingTask → Candidate → Publish
→ Learning → Response → Formal Diagnosis → Evidence
```

阶段 2 只增加一个旁路适配器：

```text
Formal Diagnosis Commit
→ RubricFeedbackProjection
→ RubricFeedbackGroundingAdapter
→ StudentVisibleFeedbackGrounding
→ StudentFeedbackActionPlanAdapter
```

禁止：

- 修改 Frozen Question / Rubric；
- 将 Projection 持久化为新的教育事实；
- 让 Projection 写入 Student Profile 或 Growth Memory；
- 让 Action Plan 直接接收 `QuestionResourceRubricItem[]`；
- 用 Projection 覆盖原有 `TaskRequirementCoverage`；
- 在本阶段修改 Learning UI、完成页或修订按钮。

## 四、最小接入接口

### 4.1 Grounding Adapter 输入

冻结为：

```ts
type RubricFeedbackGroundingAdapterInput = {
  projection: RubricFeedbackProjection;
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
  verifiedStudentEvidenceByRef: Record<string, string>;
  safeClueLocatorByRequirementId?: Record<string, string>;
  feedbackDepth: 'result_only' | 'thinking_prompt' | 'scaffold';
};
```

规则：

- `verifiedStudentEvidenceByRef` 只能由已核验回答片段解析器提供，不允许 Adapter 读取完整回答再抽取；
- `safeClueLocatorByRequirementId` 只能来自已通过披露门禁的 Formal Guidance / Task Cue；
- Grounding Adapter 不接收 Calibration Answer、完整 Rubric、`acceptedSignals`、正确选项身份或全部 Task Evidence；
- `responseFormat = single_choice` 不允许调用该 Adapter；
- Context 必须与 Projection Source Links 完全一致。

### 4.2 Grounding Adapter 输出

只允许输出 `StudentVisibleFeedbackGrounding v1`：

```ts
type StudentVisibleFeedbackGrounding = {
  groundingVersion: 'student_visible_feedback_grounding_v1';
  acknowledgedStudentAction?: string;
  primaryObservedGap?:
    | 'conclusion_without_evidence'
    | 'evidence_without_explanation'
    | 'partial_required_aspects'
    | 'scope_misaligned'
    | 'expression_not_organized';
  safeClueLocator?: string;
  nextThinkingAction?: string;
  feedbackDepth: 'result_only' | 'thinking_prompt' | 'scaffold';
  sourceProjectionId: string;
};
```

这里的“Student-visible”表示它满足学生可见安全标准，不表示阶段 2 已经把它展示到页面。

### 4.3 Action Plan 最小扩展

现有 `StudentFeedbackActionPlanInput` 只增加一个可选字段：

```ts
type StudentFeedbackActionPlanInput = {
  // existing fields stay unchanged
  projectionGrounding?: StudentVisibleFeedbackGrounding;
};
```

Action Plan 不得接收完整 Projection。优先级冻结为：

```text
合法 projectionGrounding
→ 用于 acknowledgedAction / missingAnswerPart / thinkingPrompt / nextOperations

projectionGrounding 缺失或不合法
→ 完整沿用现有 Grounding / Action Plan 行为
```

现有 Action Plan 输出 Schema 不在阶段 2 升级，Revision 资格算法也不改变。

## 五、身份与准入 Guard

只有同时满足以下条件，Projection Grounding 才可被消费：

1. `projection.projectionStatus = ready`；
2. Projection 通过 Schema Guard；
3. `questionVersionId` 与当前正式题一致；
4. Projection 的 `responseId` 与当前 Response 一致；
5. `taskId / learningRoundId / executionSessionId` 属于同一执行链；
6. `sourceProjectionId` 可回溯到当前 Projection；
7. Primary Item 存在时必须是 `partially_achieved / missing`；
8. 所有学生片段引用均能在 `verifiedStudentEvidenceByRef` 中解析；
9. 单选、文本题和 Retest / Transfer 角色分流正确。

任一条件不满足：

- 不构建 Projection Grounding；
- 不部分拼装看似针对性的反馈；
- 不修改旧 Action Plan 输入；
- 输出结构化 issue，旧链继续运行。

## 六、Coverage 到最小 Grounding 的裁剪规则

### 6.1 完整达成

当 Projection 没有 Primary Item，且至少一个 Item 为 `achieved`：

- 最多选择一个可核验的学生动作形成 `acknowledgedStudentAction`；
- 不生成 `primaryObservedGap`；
- 不生成 `safeClueLocator`；
- 不生成 `nextThinkingAction`；
- `feedbackDepth = result_only`。

不得为了固定版式制造“下一步”。

### 6.2 部分达成或缺失

只消费 `primaryItemId` 指向的一个 Item：

- 最多保留一个已完成动作；
- 只保留 Primary Item 的一个 `primaryObservedGap`；
- 最多保留一个安全线索；
- 只保留一个思考动作；
- 丢弃其他非 Primary Rubric Item 的细节。

### 6.3 不可判断

`limited / not_assessable` 不得形成具体 Rubric Gap。阶段 2 不向旧链注入任何新结论。

## 七、学生可见信息最小化边界

### 7.1 允许信息

只允许：

- 一条来自学生本人回答的已核验短片段或安全释义；
- 一个结构化主要断点；
- 一个不会直接给出结论的材料位置或局部线索；
- 一个思考动作；
- 反馈深度；
- 内部追溯使用的 Projection ID（不得渲染到页面）。

### 7.2 禁止字段

以下字段不得进入 Grounding Adapter 输出或 Action Plan 的 Narrative 输入：

- 完整 Rubric；
- Rubric Item 描述全集；
- `acceptedSignals`；
- `calibrationAnswer`；
- `correctOptionIds`；
- `distractorRationale`（单选独立链除外）；
- `weight / importance / abilityId`；
- 完整 Task Evidence；
- Formal Diagnosis 内部 Code、置信度和 Provider Metadata；
- 非 Primary Item 的缺口与完整答案信息。

### 7.3 语义组合门禁

即使字段名合法，只要一条 Grounding 同时给出以下完整组合，也必须阻断：

```text
正确结论
+ 完整文本依据
+ 依据与结论的完整解释关系
```

系统知道完整 Rubric，不代表学生需要看到完整 Rubric。安全线索只能帮助定位或启动思考，不能替学生完成判断。

### 7.4 长度边界

- `acknowledgedStudentAction`：最多一个动作，不复制完整回答；
- `safeClueLocator`：最多一个局部线索；
- `nextThinkingAction`：一个动作，不输出多步答案模板；
- 首次正式反馈禁止 `scaffold`；只有已有提示升级记录时才允许该深度；
- 阶段 2 不新增学生端字数要求。

## 八、Action Plan 消费规则

Action Plan 使用 Projection Grounding 时：

1. `acknowledgedAction` 只能改写 `acknowledgedStudentAction`，不得扩大肯定范围；
2. `missingAnswerPart` 只能解释 `primaryObservedGap`，不得新增第二个缺口；
3. `thinkingPrompt` 只能组合 `safeClueLocator + nextThinkingAction`；
4. `nextOperations` 默认最多一项；
5. `problemMechanism` 继续来自正式 Thinking Analysis，不由 Projection Grounding 推断；
6. Grounding 没有安全线索时允许只给思考动作，不允许从完整 Rubric 补线索；
7. 完整达成时不输出修改动作；
8. `not_assessable` 不输出具体教学断点；
9. Action Plan Validation 失败时丢弃新路径，旧 Action Plan 结果保持可用。

## 九、题型与任务角色分流

### 9.1 单项选择

单选永远不进入文本 Rubric Grounding Adapter，继续使用：

```text
selectedOptionId
→ distractorRationale
→ typical misconception
→ one recheck action
```

### 9.2 Training / Observation / Diagnosis

- 可以内部消费最小 Grounding；
- 是否允许 Revision 继续由现有 Revision Eligibility 决定；
- Projection 不扩大 Revision 资格。

### 9.3 Retest / Transfer

- 可以形成 `result_only` Grounding；
- 不提供完整修复路径；
- 不开放即时修订；
- 不因独立任务失败向学生泄露下一次验证答案。

## 十、失败回退与双轨策略

阶段 2 采用 optional adapter，不采用强制替换：

```text
Projection ready + Grounding valid + Action Plan valid
→ 记录新路径 Debug 结果

任一步失败
→ 保持旧 Grounding / Action Plan 结果
```

冻结要求：

- 新路径失败不影响提交、Diagnosis、Evidence Return 或继续下一题；
- 不以“当前无法生成针对性反馈”等新文案覆盖旧可用反馈；
- 不静默把 `limited` 当成 `ready`；
- Debug 可比较新旧输出，但学生端在阶段 2 仍只使用旧路径；
- 阶段 3 才能决定切换和展示策略。

## 十一、零写入边界

阶段 2 的 Adapter 必须是纯函数或等价只读服务，不得调用：

- Shared Formal Resource Store 写接口；
- Diagnosis / Evidence Repository 写接口；
- Revision Attempt 写接口；
- Student Profile / Growth Memory 写接口；
- Trial / Calibration 事件写接口。

重复运行必须保持 Shared Store revision、Frozen Resource、Attempt、Evidence 和 Profile 完全不变。

## 十二、建议工程文件

新增：

```text
src/ai/agents/rubricFeedbackGroundingAdapter.ts
src/ai/tests/runRubricAlignedFeedbackStage2Debug.ts
```

窄范围修改：

```text
src/ai/agents/studentFeedbackActionPlanAgent.ts
src/ai/schemas/rubricFeedbackProjection.schema.ts
package.json
```

阶段 2 禁止修改：

```text
src/pages/**
src/components/**
Learning 路由与页面状态机
Revision Eligibility
Evidence / Profile 写入逻辑
正式资源发布逻辑
```

## 十三、Debug 验收矩阵

### 13.1 接口与身份

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RG2-01 | ready Projection + 完整身份 | 构建最小 Grounding |
| RG2-02 | limited Projection | 不接入，旧链保持 |
| RG2-03 | not_assessable Projection | 不生成具体 Gap |
| RG2-04 | Question Version 错位 | 阻断新路径 |
| RG2-05 | Response ID 错位 | 阻断新路径 |
| RG2-06 | Session / Round 错位 | 阻断新路径 |
| RG2-07 | Student Evidence Ref 无法解析 | 不生成肯定 |
| RG2-08 | 相同输入重复执行 | 输出完全一致且零写入 |

### 13.2 最小裁剪与泄露门禁

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RG2-09 | 全部达成 | 只保留一个真实完成动作 |
| RG2-10 | 有结论、缺依据 | 一个 Gap + 一个思考动作 |
| RG2-11 | 有依据、缺解释 | 肯定依据，不给完整关系答案 |
| RG2-12 | 多个 Rubric Item | 只消费 Primary Item |
| RG2-13 | 输入包含 acceptedSignals | 输出不得包含 |
| RG2-14 | 输入可拼出完整答案 | 语义组合门禁阻断 |
| RG2-15 | 无安全线索 | 省略线索，不从 Rubric 猜测 |
| RG2-16 | 首次反馈请求 scaffold | 降为 thinking_prompt |

### 13.3 Action Plan 接入

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RG2-17 | 合法 Projection Grounding | Action Plan 优先使用 |
| RG2-18 | Grounding 无肯定动作 | 不虚构肯定 |
| RG2-19 | Grounding 无 Gap | 不制造 missingAnswerPart |
| RG2-20 | 一个 Primary Gap | 最多一个 nextOperation |
| RG2-21 | Action Plan 试图新增第二缺口 | Validation 阻断 |
| RG2-22 | Action Plan 新路径失败 | 旧结果保持可用 |

### 13.4 分流与零回归

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RG2-23 | 单选正确 | 独立链，不进入 Adapter |
| RG2-24 | 单选错误 | 仅 distractor 反馈 |
| RG2-25 | Retest | result_only，不开放修订 |
| RG2-26 | Transfer | result_only，不泄露修复路径 |
| RG2-27 | Revision Eligibility | 阶段 2 前后完全一致 |
| RG2-28 | Feedback Presentation | 学生页面前后完全一致 |
| RG2-29 | Diagnosis / Evidence / Profile | 前后完全一致 |
| RG2-30 | Frozen Resource / Registry | revision 与数据完全一致 |

## 十四、工程实施顺序

### Step 1：Adapter 与 Guard

- 建立 Grounding Adapter 输入输出；
- 建立 Schema、身份与题型 Guard；
- 完成 `RG2-01—RG2-08`。

### Step 2：最小信息裁剪

- 实现完整达成、Primary Gap 和不可判断分支；
- 增加字段与语义组合泄露门禁；
- 完成 `RG2-09—RG2-16`。

### Step 3：Action Plan optional 接入

- 仅增加可选 `projectionGrounding`；
- 保持旧路径和输出 Schema；
- 完成 `RG2-17—RG2-22`。

### Step 4：分流与回归

- 验证单选、Retest、Transfer、Revision；
- 验证页面零变化和全链零写入；
- 完成 `RG2-23—RG2-30`。

## 十五、完成定义

阶段 2 只有满足以下全部条件才能验收：

1. Projection 到 Grounding 的接口、身份和失败状态固定；
2. Action Plan 只消费最小 Grounding，不读取完整 Projection 或 Rubric；
3. 完整达成不制造缺口；
4. 部分达成只保留一个可行动断点；
5. `limited / not_assessable` 不被模板或关键词补全；
6. 完整答案组合、acceptedSignals、权重和内部 Code 无法进入学生安全 Grounding；
7. 单选不进入文本链；
8. Retest / Transfer 不开放即时修订；
9. 旧 Grounding / Action Plan 可在新路径失败时原样运行；
10. Learning 页面没有任何变化；
11. Revision、Diagnosis、Evidence、Profile 和 Frozen Resource 零回归；
12. `RG2-01—RG2-30` 全部通过；
13. production build 通过；
14. 输出独立工程验收报告。

## 十六、阶段 3 准入条件

只有阶段 2 验收完成后，阶段 3 才允许：

- 让受控 Narrative 消费已经通过门禁的最小 Grounding；
- 在 Learning 学生端展示 Rubric 对齐反馈；
- 建立新旧路径切换开关和真实浏览器回归；
- 调整完成页反馈块，但不得改变 Diagnosis 与 Evidence 事实。

阶段 3 仍不得把完整 Rubric 或 acceptedSignals 发送给 Narrative Agent。

## 十七、工程验收记录（2026-08-27）

- `RG2-01—RG2-30`：30/30 PASS；
- Stage 0：8/8 PASS；
- Stage 1：30/30 PASS；
- Grounding / Action Plan：6/6、8/8 PASS；
- Narrative / Presentation：33/33、10/10 PASS；
- Controlled Feedback：63/63 PASS；
- Revision Stage 1—4：26/26、29/29、18/18、19/19 PASS；
- Production build：PASS；
- Shared Formal Resource Store：revision 1963，前后数据一致；
- Learning 页面：未接入新路径，符合阶段边界。
