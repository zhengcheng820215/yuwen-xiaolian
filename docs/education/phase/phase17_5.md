# Phase 17.5：题目生成质量评估

英文定位：Question Generation Quality Assessment

设计状态：17.5A-B IMPLEMENTED / 17.5C1-C2 IMPLEMENTED / 17.5C3A IMPLEMENTED / 17.5C3B CALIBRATION RUNTIME IMPLEMENTED

工程状态：17.5A RULE V2 + AUTOMATED DEBUG PASS（14 / 14）；REVIEW STEM OPTIMIZATION + AUTOMATED DEBUG PASS（5 / 5）；17.5B REVIEW CONSUMPTION + AUTOMATED DEBUG PASS（9 / 9）；17.5C1 INDEPENDENT SEMANTIC ASSESSMENT + AUTOMATED DEBUG PASS（18 / 18），LIGHT DEMO + HUMAN ACCEPTANCE PASS（12 / 12）；17.5C2 ASSESSMENT PERSISTENCE + FROZEN TRACEABILITY AUTOMATED DEBUG PASS（17 / 17），LIGHT DEMO + HUMAN ACCEPTANCE PASS（12 / 12）；17.5C3A BATCH QUALITY SUMMARY ENGINEERING + AUTOMATED DEBUG PASS（13 / 13），LIGHT DEMO + HUMAN ACCEPTANCE PASS；17.5C3B CALIBRATION RUNTIME + AUTOMATED DEBUG PASS（16 / 16）；固定真实十篇材料校准尚未完成

17.5C 独立工程任务文档：[Phase 17.5C：独立语义评估、质量持久化与批次校准](./phase17_5c.md)

优先级：P1，在继续规模化生产 Phase 17.2 Batch B / C 之前完成

前置条件：

- Phase 16.1 正式题目准入、审核、冻结与版本协议已成立；
- Phase 17.2 Assisted Draft Generation 已具备结构化候选生成能力；
- Phase 17.4A Shared Store 基线应在恢复规模化录题前完成真实浏览器切换与一致性确认。

## 一、阶段目标

Phase 17.5 只解决一个问题：

> 在不改变现有 Question Resource Contract 的前提下，对结构合法的 Question Draft 进行独立、可追溯的质量评估，帮助审核者判断候选题是否值得保留和修改。

当前 Assisted Draft Generation 已能生成结构化候选，并通过既有 Validator 阻断非法对象。但“结构合法”不等于“具有足够的观察价值”。

仍可能出现：

- 题目有材料引用，但问题与材料关联较弱；
- 题目范围过宽，无法形成明确观察；
- 多道题重复观察同一动作；
- 难度建议与题目要求不一致；
- Rubric 与题目实际要求错位；
- 优秀、部分和错误回答难以形成可区分 Evidence；
- 一批题全部集中在高阶分析，缺少合理分布。

Phase 17.5 不重新定义 Question Metadata，也不建立第二套题目审核协议。它在既有 Draft 与 Human Review 之间增加独立质量评估层。

## 二、一句话定义

> Phase 17.5 将结构合法的 Question Draft 转化为带有版本身份、质量检查结果和可解释警告的可审核对象，但不替代人工审核，也不自动修改或冻结题目。

## 三、核心链路

```text
Material
↓
AI Candidate Generation
↓
Candidate Contract Validation
├─ invalid -> reject / repair
└─ valid
   ↓
Candidate Selection / StructuredQuestionDraft
↓
Draft Contract Validation
├─ invalid -> reject / repair
└─ valid
   ↓
QuestionQualityAssessment
↓
Human Review
↓
Freeze
↓
ResourceRegistry
```

质量评估只消费通过 Draft Contract Validation 的对象。

没有通过 Contract Validation 的 Draft 不得通过质量分数或人工偏好绕过结构阻断。

## 四、不新增平行 Metadata

Phase 17.5 继续使用现有字段：

- `difficultySuggestion / difficulty`
- `primaryAbilityId / abilityId`
- `observationFocus`
- `expectedStudentAction`
- `designRationale / designReason`
- `evidencePotential`
- `materialAnchor`
- `calibrationAnswers`
- `rubric`
- `questionType`
- `responseFormat`

不新增与上述字段语义重复的：

- `difficultyLevel`
- `questionRole`
- `observationValue`
- 第二套 `designReason`

原则：

> Question Metadata 描述题目是什么、观察什么；QuestionQualityAssessment 描述这些既有声明是否充分、一致和值得进入人工审核。

## 五、核心对象

```ts
type QuestionQualityCheckStatus =
  | 'pass'
  | 'warning';

type MaterialGroundingCheckStatus =
  | 'pass'
  | 'warning'
  | 'fail';

type QuestionQualityDecision =
  | 'pass'
  | 'pass_with_warnings'
  | 'revision_recommended';

type QuestionQualityWarning = {
  code: string;
  check:
    | 'materialGrounding'
    | 'observationClarity'
    | 'observationDistinctness'
    | 'discriminativePower'
    | 'difficultyCoherence'
    | 'rubricAlignment'
    | 'scopeClarity';
  severity:
    | 'warning'
    | 'strong_warning';
  message: string;
  evidenceRefs: string[];
};

type QuestionQualityAssessment = {
  assessmentId: string;
  draftId: string;
  resourceId: string;
  assessedDraftRevision: number;

  checks: {
    materialGrounding: MaterialGroundingCheckStatus;
    observationClarity: QuestionQualityCheckStatus;
    observationDistinctness: QuestionQualityCheckStatus;
    discriminativePower: QuestionQualityCheckStatus;
    difficultyCoherence: QuestionQualityCheckStatus;
    rubricAlignment: QuestionQualityCheckStatus;
    scopeClarity: QuestionQualityCheckStatus;
  };

  decision: QuestionQualityDecision;
  warnings: QuestionQualityWarning[];

  assessedAt: string;
  ruleVersion: string;
};
```

第一版正式评估对象是 `StructuredQuestionDraft`，不是尚未进入 Draft 的临时候选。

候选层可以展示轻量预检，但不能把候选预检结果冒充为正式 `QuestionQualityAssessment`。

## 六、Draft Revision 约束

`QuestionQualityAssessment` 必须绑定：

- `draftId`
- `resourceId`
- `assessedDraftRevision`
- `ruleVersion`

当题干、材料锚点、能力、难度、Rubric、AnswerAcceptance 或 Calibration Answer 等影响质量判断的字段发生修改时：

```text
Draft Revision N
↓
QuestionQualityAssessment N

Draft 修改
↓
Draft Revision N + 1
↓
旧 Assessment 失效
↓
重新评估
```

Human Review 与 Freeze 只能消费和当前 Draft Revision 一致的最新 Assessment。

旧 Assessment 可以保留用于追溯，但不能继续代表当前版本。

## 七、Validator 与 Quality Assessment 边界

### Contract Validator

回答：

> 这个 Question Draft 是否合法？

典型阻断：

- 缺少 `materialAnchor`；
- `abilityId` 不合法；
- Rubric 缺失或结构非法；
- AnswerAcceptance 缺失或与题型冲突；
- QuestionType 与 ResponseFormat 不兼容；
- 版本、身份或必填字段不完整。

结果：

```text
invalid
-> reject / repair
-> 不进入 Human Review
```

### Question Quality Assessment

回答：

> 这个合法 Draft 是否值得人工审核，当前有哪些质量风险？

典型警告：

- 问题范围过宽；
- 观察目标不清晰；
- 与同批其他题重复观察；
- 难度建议与实际要求不一致；
- Rubric 虽合法但不能充分支持题目目标；
- Calibration Answers 难以形成明显区分；
- 材料锚点存在，但题目语义与锚点支持不足。

结果：

```text
pass
pass_with_warnings
revision_recommended
```

`materialGrounding = fail` 表示 Draft 具有结构合法的锚点，但题目语义缺少材料支持。它产生 `revision_recommended`，不等同缺少锚点的 Contract Validation Error。

## 八、七项质量检查

### 1. Material Grounding

检查题目、Observation Focus、Material Anchor 和材料内容是否形成明确关系。

低质量示例：

> 请谈谈你对亲情的理解。

较高质量示例：

> 结合父亲保存旧树叶的动作，分析这一细节表现出的心理。

### 2. Observation Clarity

检查题目是否能观察明确的学生动作，而不是笼统要求“深入分析”。

### 3. Observation Distinctness

检查同一生成批次或同一材料现有库存中，是否已有题目观察相同：

```text
Material Anchor
+ Primary Ability
+ Expected Student Action
+ Observation Focus
```

该检查复用既有只读库存比较，不建立第二套重复检测事实源。

### 4. Discriminative Power

结合 `calibrationAnswers`、Rubric 和 `evidencePotential`，检查优秀、部分与错误回答是否可能形成不同的可观察结果。

第一版只判断“是否具有合理区分条件”，不能证明真实教学中的统计区分度。

### 5. Difficulty Coherence

检查 `difficultySuggestion / difficulty` 是否与题目范围、推理步骤、作答要求和 Rubric 一致。

### 6. Rubric Alignment

检查 Rubric 是否真正覆盖题目要求观察的动作，而不只是结构存在。

### 7. Scope Clarity

检查题目是否过宽、包含过多子任务，或无法在一次作答中形成清晰判断。

## 九、独立性原则

质量评估不得直接相信 Generator 对自身输出的全部判断。

第一版采用组合方式：

- 确定性规则检查身份、Revision、锚点存在性、Rubric 结构、Calibration 结构和库存重复；
- 独立语义评估检查材料支持、范围清晰度、难度一致性和区分潜力；
- 所有规则与语义评估必须记录 `ruleVersion`；
- AI 评估结果只提供审核建议，不产生正式教育结论。

Generator 的 `evidencePotential` 和 `designRationale` 是评估输入，不是自动通过依据。

## 十、批次质量摘要

单题 Assessment 之外，可以形成只读批次摘要：

```ts
type QuestionGenerationBatchQualitySummary = {
  generationRequestId: string;
  candidateCount: number;
  validDraftCount: number;

  abilityBreakdown: Partial<Record<PrimaryAbilityId, number>>;
  difficultyBreakdown: Partial<Record<QuestionResourceDifficulty, number>>;

  duplicateObservationCount: number;
  strongEvidencePotentialCount: number;
  portfolioWarnings: string[];
};
```

它用于发现：

- 全部集中在同一 Ability；
- 全部集中在高难度；
- Observation 重复；
- 有效候选过少；
- 材料不足以支持预期覆盖。

该摘要不是长期教育对象，不修改 Question、Evidence、Profile 或 Resource Match 结果。

## 十一、生成数量与分布策略

默认生成目标为 3 道候选题。

这不是硬性配额。

生成时应尝试形成不同 Ability、Difficulty 或 Observation，但优先保证：

1. 材料具有明确支持；
2. 每题具有独立观察价值；
3. 题目能形成可区分表现；
4. 不为了凑数量生成材料不支持的题。

当材料只支持 1—2 个高质量观察时，系统应：

- 返回较少候选；
- 记录材料限制；
- 不强行补齐六项 Ability；
- 不强行生成基础、分析、推理各一道。

## 十二、审核页面

审核页面增加紧凑的 `Question Quality` 摘要，例如：

```text
Question Quality

✓ 材料依据充分
✓ 观察目标明确
⚠ 难度可能偏高
✓ Rubric 与题目一致

建议：人工确认是否适合作为当前阶段训练题。
```

审核者可以展开查看：

- Warning 原因；
- 对应字段或材料锚点；
- Assessment Revision；
- Rule Version。

页面不展示大量重复 Metadata，也不把 `pass` 设计成自动审核通过。

## 十三、失败与人工分支

```text
Draft Contract invalid
-> blocked
-> 不生成正式 Quality Assessment

Quality decision = pass
-> 进入 Human Review

Quality decision = pass_with_warnings
-> 带警告进入 Human Review

Quality decision = revision_recommended
-> 默认建议返回修改
-> 允许人工查看并记录决定
```

质量评估不得：

- 自动删除 Candidate 或 Draft；
- 自动修改题干、Rubric 或 Metadata；
- 自动形成 Review Decision；
- 自动 Freeze；
- 自动写入 ResourceRegistry；
- 生成 AbilityEvidence；
- 判断学生能力。

## 十四、最小验收案例

### Case 1：结构非法

Draft 缺少 Material Anchor。

期望：

- Contract Validator 阻断；
- 不生成正式 Quality Assessment；
- 不进入 Human Review。

### Case 2：材料关联弱

Anchor 存在，但题目要求泛谈主题，无法由材料明确支持。

期望：

- `materialGrounding = fail`；
- `decision = revision_recommended`；
- Warning 指向题目与材料锚点。

### Case 3：观察清晰

题目明确要求提取动作并解释人物心理。

期望：

- Material Grounding、Observation Clarity 与 Scope Clarity 通过；
- Assessment 保留对应 Evidence Refs。

### Case 4：重复观察

同一材料已有题目观察相同动作、能力和学生行动。

期望：

- `observationDistinctness = warning`；
- 不自动删除新 Draft；
- 人工可以比较两题。

### Case 5：区分力不足

优秀、部分和错误答案都可能得到相同 Rubric 结果。

期望：

- `discriminativePower = warning`；
- 指明 Calibration / Rubric 的不足位置。

### Case 6：Draft 修改

Revision 3 已完成 Assessment，随后修改 Rubric 形成 Revision 4。

期望：

- Revision 3 Assessment 失效；
- Review / Freeze 不得消费旧 Assessment；
- Revision 4 必须重新评估。

### Case 7：批次偏斜

一批三题全部为 `analysis` 且难度偏高。

期望：

- 单题结果仍按各自事实形成；
- Batch Summary 输出分布警告；
- 不强制生成低质量补位题。

### Case 8：人工保留带警告题目

Assessment 为 `pass_with_warnings`，审核者判断警告可接受。

期望：

- Human Review 独立记录决定与理由；
- Assessment 不被改写为无警告；
- Freeze 后保留 Assessment 追溯。

## 十五、十篇材料校准

工程完成后使用固定的 10 篇材料校准集，覆盖不同：

- 长度；
- 体裁；
- 信息密度；
- 可观察能力；
- 可支持题目数量。

统计：

### 生产指标

- 平均候选数量；
- Contract Validation 通过率；
- Quality Assessment 各 Decision 比例。

### 质量指标

- Warning 分布；
- 重复 Observation 比例；
- 人工保留率；
- 人工修改率；
- 质量警告与人工决定的一致情况。

### 结构指标

- Ability 分布；
- Difficulty 分布；
- 每篇材料的独立 Observation 数量。

### 效率指标

- 单题平均审核时间；
- 从生成到形成 Reviewed Draft 的平均操作次数。

验收不要求每篇材料至少生成 3 道题。材料支持时以中位数 3 道作为生产目标；不足时必须留下限制说明。

## 十六、明确不做

Phase 17.5 不做：

- 自动根据学生水平匹配难度；
- 自动改写低质量题目；
- 自动删除 Candidate 或 Draft；
- 自动审核或自动 Freeze；
- 新增选择、填空、判断或作文等题型支持；
- 修改 Diagnosis、AbilityEvidence、Evaluation 或 Profile；
- 证明题目真实教学效果；
- 建立统计难度自动标定；
- 替代 Phase 16.2 Resource Matching Quality Gate；
- 建立大型题库或多人内容协作系统。

## 十七、与 Phase 16.2 的区别

```text
QuestionQualityAssessment
```

回答：

> 这道结构合法的 Draft 是否值得进入人工审核？

它发生在 Freeze 之前。

```text
ResourceMatchQualityResult
```

回答：

> 这道已经冻结的正式资源是否适合当前学生、策略和任务请求？

它发生在正式资源匹配期间。

二者不能合并，也不能相互替代。

## 十八、完成定义

Phase 17.5 完成后，系统可以宣称：

> 系统能够对结构合法的 Question Draft 形成绑定 Revision 的独立质量评估，识别材料支持、观察清晰度、重复观察、区分潜力、难度一致性、Rubric 对齐和题目范围风险，并将可解释结果交给人工审核；质量评估不会自动修改、删除、审核或冻结题目。

仍不能宣称：

- AI 已经能够稳定生成所有高质量题目；
- 质量评估已经证明题目教学有效；
- 题目难度已经完成统计标定；
- 人工审核可以取消；
- 正式资源已经适配具体学生；
- 24—28 道首批资源包已经完成。

## 十九、推荐工程顺序

1. 冻结 `QuestionQualityAssessment` 与 Warning Contract；
2. 建立 Draft Revision 失效规则；
3. 实现确定性质量检查；
4. 接入独立语义质量评估；
5. 形成 Batch Quality Summary；
6. 在审核页展示紧凑质量摘要；
7. 完成最小 Debug Cases；
8. 使用固定 10 篇材料完成校准；
9. 回归 Draft -> Review -> Freeze -> Registry -> Learning 链路；
10. 验收后恢复 Phase 17.2 Batch B / C 规模化生产。

## 二十、Phase 17.5A 工程结果

Phase 17.5A 已完成以下最小工程闭环：

```text
Current Passed Draft Validation
↓
QuestionQualityAssessment
↓
Revision Currentness Guard
↓
Immutable Assessment Repository
```

已实现：

- 独立 `QuestionQualityAssessment` Schema、Warning Contract 与类型守卫；
- 七项确定性质量检查；
- `pass / pass_with_warnings / revision_recommended` 决策；
- Assessment 与 `draftId + resourceId + assessedDraftRevision + validationId + ruleVersion` 绑定；
- Draft 修改后旧 Assessment 失效；
- 只有当前 Revision 且已通过 Contract Validation 的 Draft 才能评估；
- Assessment Repository 幂等保存、不可变返回、按 Draft 与 Revision 查询；
- 材料依据采用具体引用或连续材料锚点判断，避免仅凭常用字重合把泛化问题误判为有材料支持。

专项 Debug：

```text
Phase 17.5A Question Generation Quality Assessment
12 / 12 PASS
```

覆盖：

1. 合法 Draft 形成无警告 Assessment；
2. Contract Validation 失败时阻断；
3. 旧 Validation 不能评估新 Revision；
4. 材料语义缺失建议修订；
5. 范围过宽产生警告；
6. 重复 Observation 被识别；
7. 区分条件不足被识别；
8. 难度声明不一致被识别；
9. Rubric 语义错位建议修订；
10. Draft Revision 使旧 Assessment 失效；
11. Repository 幂等与不可变；
12. Schema Guard 拒绝非法对象。

相关回归：

- Question Resource Admission：`22 / 22 PASS`；
- Material Observation Draft Generator：`38 / 38 PASS`；
- Phase 17.4A Shared Resource Persistence：`9 / 9 PASS`；
- Production Build：`PASS`。

Phase 17.5A 完成不等于整个 Phase 17.5 完成。当前尚未完成：

- 审核页 `Question Quality` 摘要和 Warning 展示；
- Human Review / Freeze 对当前 Assessment 的正式消费接线；
- 独立语义质量评估；
- Batch Quality Summary 运行逻辑；
- 固定十篇材料校准及人工保留率、修改率、审核时间统计。

因此当前准确结论是：

> 系统已经具备绑定 Draft Revision 的题目质量评估基础运行能力，并通过自动化 Debug；质量结果尚未接入人工审核页面和正式审核消费链，不能据此恢复无约束规模化录题。

## 二十一、Phase 17.5B 工程结果

Phase 17.5B 已完成质量结果进入人工审核与冻结边界的最小闭环：

```text
Current Passed Draft Validation
→ Current QuestionQualityAssessment
→ Review Workspace Quality Summary
→ Human Review
→ Freeze Guard
```

已实现：

- 工作台在当前 Draft 已通过结构校验后自动生成或复用当前规则版本的质量评估；
- 审核流程与审核预览展示七项质量检查、Decision、Warning、Draft Revision 与规则版本；
- `revision_recommended` 仍是人工审核建议，不会越权自动拒绝、删题或冻结；
- 提交审核、人工审核决定和 Freeze 都必须消费当前 Revision、当前 Validation、当前规则版本的 Assessment；
- Draft 修改后旧 Assessment 立即失效，未重新校验与评估前不能继续正式审核链；
- 质量规则升级后旧 Assessment 保留用于追溯，但不能继续作为当前审核依据；
- 历史 Admission Runtime 保持不变，由独立 Review Gate 组合质量约束，避免污染既有 Phase 行为。

专项 Debug：

```text
Phase 17.5B Question Quality Review Gate
9 / 9 PASS
```

覆盖：

1. 当前合法 Draft 自动获得质量评估；
2. 未校验 Draft 不产生评估；
3. 提交审核必须具备当前评估；
4. Warning / Revision Recommendation 保持人工建议语义；
5. Draft 修改使旧评估失效并阻断提交；
6. 人工审核决定必须具备当前评估；
7. Freeze 必须具备当前评估；
8. 完整质量感知审核与冻结链通过；
9. 旧规则评估在消费前被当前规则评估替换。

回归结果：

- Phase 17.5A：`12 / 12 PASS`；
- Question Resource Admission：`22 / 22 PASS`；
- Material Observation Draft Generator：`38 / 38 PASS`；
- Production Build：`PASS`。

Phase 17.5B 完成后仍未完成：

- 独立语义质量评估；
- Batch Quality Summary；
- 固定十篇材料的人工保留率、修改率与审核时间校准；
- Assessment 在 Shared Store 中的正式持久化与 Frozen Resource 的持久追溯引用。

因此当前准确结论是：

> 系统已经能够把当前题目质量评估安全地呈现给审核者，并在提交审核、人工决定与冻结前校验其时效；质量评估仍只提供审核依据，不替代人工决定。Phase 17.5C 完成批次校准与持久化补齐前，不宣称整个 Phase 17.5 已完成。
## Phase 17.5B Demo 验收记录

验收入口：

`#/phase17-5-question-quality-demo`

Demo 直接消费正式 `QuestionQualityAssessment` 规则，不使用固定结论文案模拟评估结果。

覆盖四类最小 Case：

- `pass`：七项检查通过，但仍需人工审核；
- `pass_with_warnings`：保留具体提醒，允许进入人工审核；
- `revision_recommended`：突出修改建议，但不自动拒绝；
- stale assessment：Draft Revision 改变后旧评估失效，并阻断提交审核。

自动化验收：

- Phase 17.5B Demo Debug：9 / 9 PASS；
- Phase 17.5B Review Gate Debug：9 / 9 PASS；
- Production Build：PASS。

浏览器冒烟验收：

- 四个 Case 可正常切换；
- decision、warning 数量和检查状态随正式输入变化；
- `revision_recommended` 仍保持人工决定边界；
- stale assessment 明确显示旧评估身份并阻断提交；
- 页面在当前桌面视口无横向溢出。

人工演示验收：

- 验收日期：2026-07-25；
- 验收结论：`PASS`；
- `pass`、`pass_with_warnings`、`revision_recommended` 与 stale assessment 四类 Case 均符合预期；
- Phase 17.5B Demo 正式通过人工演示验收。

当前结论：

> Phase 17.5B 已完成工程 Debug、生产构建、浏览器冒烟与人工 Demo 验收。Demo 证明质量评估结果能够被审核流程正确消费，并能在 Draft Revision 改变后阻断旧评估；它不代表题目已自动审核通过，也不改变人工审核与 Freeze 的职责边界。
## 2026-07-26 审核页质量评估并发幂等修复

题目审核页重复加载同一 Draft Revision 时，质量评估现在保持单一正式身份：

- 仅评估时间不同的同内容重复请求复用第一次 Assessment；
- Decision、Checks 或 Warnings 不同的同身份写入仍然阻断；
- Question Quality Assessment Debug 保持 `12 / 12 PASS`，并强化并发重复写入验收；
- 浏览器验证中 3 道待审核题目正常加载，不再显示 immutable conflict。

完整记录见：
[Phase 17 训练任务到题目审核交接修复记录](./reports/phase17_review_handoff_idempotency_fix_2026-07-26.md)

## 2026-07-27 题干优化与检查时效补强

题目审核平台新增受控“AI 优化题干”能力，但不改变人工审核边界：

```text
当前 Draft + Material + Quality Warning
-> AI 题干建议
-> 候选预检查
-> 如仍有提醒，针对剩余问题重试一次或转人工修改
-> 人工采用
-> 旧 Assessment 失效
-> 保存当前 Draft Revision
-> 重新校验与质量评估
-> 人工审核
```

正式规则：

1. AI 只能改写题干文字，不得修改能力、Observation、难度、Rubric、Answer Acceptance 或 Material；
2. 建议先进入预览，人工采用前不写入 Draft，采用后也不自动保存、提交或发布；
3. 手工或 AI 修改题干后，旧质量结果立即失效，页面必须显示等待重新检查，不得继续展示旧“检查通过”或旧提醒作为当前结论；
4. 提交审核只能消费保存后、绑定当前 Draft Revision 的 Validation 与 QuestionQualityAssessment；
5. 材料依据规则升级为 `question_quality_rules_v2`，合法段落引用可作为明确依据，越界段落引用形成强提醒；
6. AI 建议仍未解决提醒时保留人工关注，不通过隐藏 Warning 提高表面通过率；
7. 候选预检查只覆盖题干能够直接影响的材料依据、考查动作和作答范围；它不是正式 Assessment；
8. Observation 重复、Rubric 区分度、难度和评分标准对齐等问题必须返回对应编辑位置，不能通过反复改写题干伪装为已解决；
9. 单次题干编辑最多执行 2 次受控 AI 优化；仍未改善时停止调用并转人工处理。

专项验收：

- Question Quality Assessment：`14 / 14 PASS`；
- Question Stem Optimization：`8 / 8 PASS`；
- Production Build：`PASS`；
- 浏览器确认修改题干后旧质量结果消失、等待重新检查提示出现、提交审核保持阻断；
- AI 候选未通过预检查时不展示直接采用入口，页面改为提供“针对提醒再次优化”“转到题干手动修改”和“保留原题干”。

完整记录见：
[Phase 17.5 题干优化与检查时效补强记录](./reports/phase17_5_question_stem_optimization_and_review_freshness_2026-07-27.md)

## 2026-07-27 质量相关编辑统一失效规则

题干优化建立的检查时效机制已经扩展到题目编辑器中的全部正式资源字段。题干、题型、作答格式、材料关联、能力映射、任务角色、难度、Answer Acceptance、Rubric、最低作答要求和来源声明等内容发生修改后，只要当前 Revision 已存在 Validation 或 QuestionQualityAssessment，页面立即将旧结果标记为历史结果，并阻断继续提交审核。

保存修改后系统创建新的 Draft Revision；旧 Revision 与旧 Assessment 保留用于审计，但 Human Review、Freeze 和正式发布只能消费新 Revision 重新形成的当前结果。审核说明等不写入正式题目内容的操作不触发失效。

该规则采用保守默认：当前题目编辑器中所有持久化正式字段均视为质量相关字段。后续只有在能够证明某字段不参与任何质量判断时，才允许从失效依赖中排除。

专项验收：

- Question Quality Assessment：`14 / 14 PASS`；
- Phase 17.5B Review Gate：`9 / 9 PASS`；
- Question Stem Optimization：`8 / 8 PASS`；
- Production Build：`PASS`。

跨对象原则与依赖范围见：
[基于 Revision 的质量评估失效记录](./reports/revision_bound_assessment_invalidation_2026-07-27.md)

## 2026-07-29 题目审核与发布工作流契约冻结

本轮新增 [Phase 17 题目审核与发布工作流契约](../../product/QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)，把既有录入字段、Revision、Validation、QuestionQualityAssessment、Human Review、Freeze 与 Formal Resource 规则翻译为统一审核工作流。

正式主链冻结为：

```text
确认题目内容
→ 处理质量问题
→ 保存当前 Draft Revision
→ 基于当前 Revision 重新检查
→ 提交人工审核
→ 形成审核决定
→ 完成正式发布
```

本次文档补强明确：

1. 页面采用“当前状态与下一步、题目核心内容、评分与判定规则、高级设置与追溯信息”四层结构；
2. 保存草稿只在内容变化时创建新 Draft Revision，重新检查不创建内容 Revision；
3. 系统检查、人工审核和正式发布保持三层独立判断；
4. 质量问题分为阻断问题、人工关注和优化建议；
5. 修改字段后问题进入“等待重新检查”，只有新 Assessment 才能关闭问题；
6. 右侧列表只做批次导航，主编辑区负责内容修改，检查区负责问题处理，预览页保持只读；
7. 已知发布阻断必须在发布按钮可用前进入发布准备区，不得延迟到点击发布后首次暴露；
8. 定位修改必须切换正确题目、展开模块并聚焦准确字段；Plan 受控字段问题不得错误定位到题干；
9. 重复保存、检查、提交和发布不得制造空 Revision、重复 Assessment、重复 Review 或重复正式版本；
10. 页面、提交审核和发布必须消费同一个 `CurrentAssessmentState`，统一判断 Revision、Validation、规则版本、比较上下文和语义检查状态；
11. `pending_review` 中正式内容只读，需要修改时必须先“退回修改”并返回 Draft；
12. 切换题目、返回、刷新和进入预览统一执行未保存保护，明确区分“保存后切换、放弃修改并切换、取消”；
13. 发布部分成功后必须可恢复，Registry 重试复用已经创建的 `FrozenQuestionResourceVersion`，不得增加正式版本号；
14. 完整工作流允许由内容编辑者、审核者和发布者分工完成，但不得改变各阶段的 Revision 和状态边界。

该契约不新增一条资源生产流程，不替代录入字段契约、单任务重新生成契约或任务组 AI 规划契约。它是 Phase 17.5 审核端的工作流解释层，后续工程校准按 P0 状态与问题闭环、P1 信息层级与页面职责、P2 批次效率与真实校准依次执行。

## 2026-07-29 题目审核与发布工作流工程对齐

本轮完成契约 P0 的关键工程闭环：

1. 新增领域层唯一 Assessment 状态解析器，统一返回 `missing`、`current`、`stale_by_revision`、`stale_by_rule_version` 或 `failed`；
2. 原有 `isCurrentQuestionQualityAssessment` 改为消费统一解析结果，提交审核与发布继续通过同一领域判断校验时效；
3. `pending_review` 等非草稿状态继续保持正式字段只读，必须退回修改后才能创建新 Draft Revision；
4. 切换题目、新建题目、返回素材平台和刷新审核数据统一接入未保存保护；
5. 未保存保护提供“保存后继续”“放弃修改并继续”“取消”三个明确动作，保存后继续只保存当前题目，不自动提交审核；
6. 发布已创建 Frozen Version、但 Registry 写入缺失时，重试会复用原 `resourceVersionId` 并补齐 Registry，不增加正式版本号。

Debug 与构建结果：

- Question Quality Assessment：`23 / 23 PASS`；
- Question Resource Intake / Admission：`24 / 24 PASS`；
- Material Resource Production Commands：`6 / 6 PASS`；
- Phase 17.5C2：`17 / 17 PASS`；
- Production Build：`PASS`；
- 浏览器真实交互：取消切换保留当前编辑；放弃修改后切换成功且未保存内容不写入草稿；`PASS`；
- `git diff --check`：`PASS`。

本轮证明审核平台已具备一致的 Assessment 时效判断、审核中只读边界、明确的题目切换保护和发布部分失败恢复能力。真实十素材校准仍是 Phase 17.5 后续产品验收项，不因本次工程通过而自动完成。
