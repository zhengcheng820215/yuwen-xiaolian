# Phase 17.5C：独立语义评估、质量持久化与批次校准

英文定位：Independent Semantic Assessment, Quality Persistence and Batch Calibration

设计状态：ENGINEERING TASK SPEC READY

工程状态：17.5C1 ENGINEERING + AUTOMATED DEBUG PASS（18 / 18）；C1 LIGHT DEMO + HUMAN ACCEPTANCE PASS（12 / 12）；17.5C2 ENGINEERING + AUTOMATED DEBUG PASS（17 / 17），LIGHT DEMO + HUMAN ACCEPTANCE PASS（12 / 12）；17.5C3A BATCH QUALITY SUMMARY ENGINEERING + AUTOMATED DEBUG PASS（13 / 13），LIGHT DEMO + HUMAN ACCEPTANCE PASS；17.5C3B CALIBRATION RUNTIME + AUTOMATED DEBUG PASS（16 / 16），REAL TEN-MATERIAL CALIBRATION PENDING

优先级：P1，在恢复 Phase 17.2 Batch B / C 规模化生产前完成

上位文档：[Phase 17.5：题目生成质量评估](./phase17_5.md)

17.5C1 验收记录：[Phase 17.5C1 独立语义质量评估工程 Debug 验收记录](./reports/phase17_5c1_semantic_quality_engineering_debug_acceptance_2026-07-26.md)

17.5C1 Demo 验收记录：[Phase 17.5C1 轻量 Demo 接入与人工验收记录](./reports/phase17_5c1_semantic_quality_demo_acceptance_2026-07-26.md)

17.5C2 验收记录：[Phase 17.5C2 Assessment Persistence and Frozen Traceability 工程 Debug 验收记录](./reports/phase17_5c2_quality_persistence_engineering_debug_acceptance_2026-07-26.md)

17.5C2 Demo 接入记录：[Phase 17.5C2 Persistence Demo 工程接入与 Debug 记录](./reports/phase17_5c2_persistence_demo_engineering_acceptance_2026-07-26.md)

17.5C3A 验收记录：[Phase 17.5C3A Batch Quality Summary 工程 Debug 验收记录](./reports/phase17_5c3a_batch_quality_summary_engineering_debug_acceptance_2026-07-26.md)

17.5C3A Demo 接入记录：[Phase 17.5C3A Batch Quality Summary 轻量 Demo 工程接入与 Debug 记录](./reports/phase17_5c3a_batch_quality_summary_demo_engineering_acceptance_2026-07-26.md)

17.5C3B 验收记录：[Phase 17.5C3B Ten-material Calibration Runtime 工程 Debug 验收记录](./reports/phase17_5c3b_ten_material_calibration_engineering_debug_acceptance_2026-07-26.md)

前置状态：

- Phase 17.5A 已完成确定性 `QuestionQualityAssessment`，专项 Debug `12 / 12 PASS`；
- Phase 17.5B 已完成审核页消费、Revision Currentness Guard 与 Freeze Guard，专项 Debug `9 / 9 PASS`；
- Phase 17.4A 已建立本机 Shared Store、Local API、Repository Boundary 与基本备份；
- 既有 Question Resource Admission、Review、Freeze、Registry 与 Learning 链路必须保持不变。

## 一、阶段目标

Phase 17.5C 只补齐三项能力：

1. 对结构合法且已经完成确定性检查的 Question Draft 进行独立语义质量评估；
2. 将质量评估及 Frozen Resource 的质量追溯关系写入 Shared Store；
3. 对固定批次形成可重复计算、可保存、可人工签署的质量摘要与十篇材料校准报告。

完整链路：

```text
Current StructuredQuestionDraft
+
Current Passed ResourceValidationResult
+
Material Snapshot
↓
Deterministic QuestionQualityAssessment
↓
Independent Semantic Quality Assessment
↓
QuestionQualityAssessmentBundle
↓
Human Review
├─ revision_required / reject
└─ approve
   ↓
Atomic Freeze Commit
├─ FrozenQuestionResourceVersion
├─ ResourceRegistryEntry
└─ FrozenQuestionQualityTrace
↓
QuestionGenerationBatchQualitySummary
↓
Ten-material Calibration Report
```

## 二、一句话定义

> Phase 17.5C 负责为当前 Revision 的题目形成独立语义评估，将确定性与语义结果组合成可追溯的审核依据，并把评估、冻结引用和批次校准结果保存为 Shared Store 中的正式质量事实；它不自动审核、修改、删除或冻结题目。

## 三、内部最小闭环

### 3.1 Phase 17.5C1：Independent Semantic Quality Assessment

```text
Current Draft + Validation + Material
↓
Semantic Provider Request
↓
Provider Output Validation
↓
QuestionSemanticQualityAssessment
↓
Deterministic + Semantic Merge
↓
QuestionQualityAssessmentBundle
```

只解决：

- 语义评估输入输出契约；
- Provider 成功、失败、超时和结构非法分支；
- Prompt、Model、Rule 与 Assessment 身份；
- 确定性检查和语义检查如何合并；
- 降级时哪些动作允许继续。

### 3.2 Phase 17.5C2：Assessment Persistence and Frozen Traceability

```text
Current Assessment Bundle
↓
Shared Store Repository
↓
Human Review
↓
Atomic Freeze + Quality Trace
```

只解决：

- Shared Store 集合；
- Repository 接口；
- 幂等和 Revision 冲突；
- Frozen Resource 质量追溯；
- Schema Migration；
- 写入失败阻断。

### 3.3 Phase 17.5C3：Batch Quality Summary and Ten-material Calibration

```text
Frozen Calibration Manifest
+
Current Assessment Bundles
+
Human Review Decisions
↓
QuestionGenerationBatchQualitySummary
↓
TenMaterialCalibrationReport
```

只解决：

- 批次输入范围；
- 缺失、旧规则和混合 Revision 处理；
- 指标公式；
- Summary 身份和保存；
- 固定十篇材料校准；
- 人工 PASS 签署。

## 四、职责边界

### 4.1 Contract Validator

回答：

> 这个 Draft 是否结构合法？

负责：

- Material Anchor 是否存在；
- Ability、Task Role、Question Type 是否合法；
- Rubric、Answer Acceptance、Response Format 是否完整；
- Draft Revision、Validation 身份是否一致。

结果：

```text
invalid -> reject / repair
valid   -> 允许进入质量评估
```

### 4.2 Deterministic Quality Assessment

回答：

> 依据稳定规则，可以发现哪些明确质量风险？

继续使用 Phase 17.5A 已实现的：

- `QuestionQualityAssessment`
- `QUESTION_QUALITY_RULE_VERSION`
- 七项确定性检查；
- Revision Currentness Guard。

### 4.3 Independent Semantic Quality Assessment

回答：

> 结合材料、题目要求和评分语义，这道题是否具有清晰、可区分、可解释的观察价值？

它不负责：

- 重做 Contract Validation；
- 读取确定性 Assessment 的 Decision 后照抄结论；
- 形成 Human Review Decision；
- 自动改写 Question；
- 自动 Freeze。

### 4.4 Human Review

回答：

> 审核者是否接受当前题目及其质量风险？

质量评估只提供审核依据，不替代人工决定。

## 五、17.5C1 输入契约

```ts
type QuestionSemanticQualityAssessmentInput = {
  requestId: string;

  draft: StructuredQuestionDraft;
  validation: ResourceValidationResult;
  material: QuestionMaterialVersion;

  deterministicAssessmentId: string;

  identity: {
    draftId: string;
    resourceId: string;
    draftRevision: number;
    validationId: string;
    materialVersionId: string;
  };

  provider: {
    providerId: string;
    modelId: string;
    timeoutMs: number;
  };

  promptVersion: string;
  semanticRuleVersion: string;
  outputSchemaVersion: string;
};
```

`semanticRequestKey` 由 Runtime 根据 Draft、Validation、Material、Provider、
Model、Prompt、Rule 与 Output Schema 版本稳定生成，不由页面或调用方传入。

输入必须满足：

1. `draft.revision === identity.draftRevision`；
2. `validation.validatedDraftRevision === draft.revision`；
3. `validation.validationId === identity.validationId`；
4. `validation.passed === true`；
5. `draft.materialVersionId === material.materialVersionId`；
6. `deterministicAssessmentId` 指向当前 Revision、当前 Validation 和当前确定性 Rule Version；
7. 输入对象使用不可变快照，不允许 Provider 调用过程中读取正在变化的页面状态。

任一条件不满足：

```text
semantic assessment blocked
```

不得调用 Provider。

## 六、17.5C1 输出契约

```ts
type SemanticAssessmentStatus =
  | 'completed'
  | 'provider_failed'
  | 'timeout'
  | 'invalid_output';

type SemanticCheckStatus =
  | 'pass'
  | 'warning'
  | 'strong_warning';

type SemanticQualityFinding = {
  check:
    | 'materialGrounding'
    | 'observationClarity'
    | 'observationDistinctness'
    | 'discriminativePower'
    | 'difficultyCoherence'
    | 'rubricAlignment'
    | 'scopeClarity';

  status: SemanticCheckStatus;
  reason: string;
  evidenceRefs: string[];
  suggestedReviewQuestion?: string;
};

type QuestionSemanticQualityAssessment = {
  semanticAssessmentId: string;
  semanticRequestKey: string;
  requestId: string;

  draftId: string;
  resourceId: string;
  assessedDraftRevision: number;
  validationId: string;
  materialVersionId: string;
  deterministicAssessmentId: string;

  status: SemanticAssessmentStatus;
  findings: SemanticQualityFinding[];
  limitations: string[];

  providerId: string;
  modelId: string;
  promptVersion: string;
  semanticRuleVersion: string;
  outputSchemaVersion: string;

  startedAt: string;
  completedAt: string;
};
```

约束：

- `completed` 必须包含七项合法 Finding；
- `provider_failed / timeout / invalid_output` 的 `findings` 必须为空；
- 失败分支必须保留 `limitations`，但不得保存密钥、完整 Provider 原始响应或学生隐私；
- Finding 必须引用具体材料、题干、Rubric、Calibration Answer 或 Observation 字段；
- `suggestedReviewQuestion` 只能帮助人工复核，不能写成自动修改指令。

## 七、独立语义评估原则

### 7.1 独立性

Provider 输入可以获得：

- Draft；
- Material Snapshot；
- Validation 通过事实；
- Calibration Answers；
- Rubric；
- Observation Focus；
- Expected Student Action。

Provider 不获得：

- 确定性 Assessment 的 Decision；
- 确定性 Warning 文案；
- 审核者历史决定；
- “希望本题通过”之类的目标性提示。

这样避免语义评估被已有结论锚定。

### 7.2 克制性

语义评估只判断题目质量，不判断：

- 学生能力；
- 教学效果；
- 题目适合哪一个具体学生；
- 该题是否应自动发布。

### 7.3 证据性

禁止：

```text
题目很好。
难度合适。
观察价值较高。
```

必须说明：

```text
依据哪个材料片段；
题目要求学生完成什么动作；
Rubric 如何区分不同表现；
风险发生在哪一处。
```

## 八、Provider 与 Prompt 版本

### 8.1 身份规则

`semanticRequestKey` 必须由以下身份稳定生成：

```text
draftId
+ assessedDraftRevision
+ validationId
+ materialVersionId
+ providerId
+ modelId
+ promptVersion
+ semanticRuleVersion
+ outputSchemaVersion
```

它表示“同一份 Draft 在同一套语义评估配置下的一次逻辑请求”。

`semanticAssessmentId` 必须额外绑定：

```text
semanticRequestKey
+ requestId 或 attempt
```

它表示一次不可变的实际运行记录。

相同 `semanticRequestKey` 重复调用：

- 已存在 `completed` 结果时直接幂等返回；
- 已存在失败结果时允许显式 Retry；
- Retry 形成新的 `requestId` 与 `semanticAssessmentId`，不能覆盖旧失败事实；
- Provider、Model、Prompt、Rule 或 Schema 任一版本变化，必须形成新的 `semanticRequestKey`。

### 8.2 Prompt 约束

Prompt 必须：

- 只要求结构化 JSON；
- 提供完整合法枚举；
- 明确不得生成审核决定；
- 明确不得改写题目；
- 明确每个 Warning 必须有 Evidence Ref；
- 明确材料不支持时输出 Strong Warning；
- 明确不确定时保留限制，不得编造材料依据。

### 8.3 Rule Version 与 Prompt Version

两者职责不同：

- `promptVersion`：Provider 指令与输出组织版本；
- `semanticRuleVersion`：如何解释 Provider 结果、计算 Finding 和合并 Decision 的规则版本；
- `outputSchemaVersion`：结构契约版本；
- `QUESTION_QUALITY_RULE_VERSION`：Phase 17.5A 确定性规则版本。

四者不得合并为一个模糊的 `version`。

## 九、Provider 失败分支

### 9.1 Provider Failed

包括：

- 网络不可达；
- Provider 返回 5xx；
- 账户不可用；
- 上游拒绝请求。

处理：

```text
status = provider_failed
↓
保存失败事实
↓
允许人工查看 Draft 和确定性 Assessment
↓
阻断 approve / Freeze
↓
允许 retry、revision_required 或 reject
```

### 9.2 Timeout

到达 `timeoutMs` 后：

```text
status = timeout
```

不得继续等待并产生第二次隐式提交。

### 9.3 Invalid Output

包括：

- 非 JSON；
- 缺失必填字段；
- Finding 枚举非法；
- Evidence Ref 不存在；
- 输出包含自动审核或 Freeze 指令。

处理：

```text
status = invalid_output
```

第一版最多允许一次结构修复请求。修复仍失败时保留失败结果，不使用自由文本猜测结构。

## 十、安全降级规则

第一版只允许“可见但不可正式通过”的安全降级：

```text
Semantic Assessment unavailable
↓
Deterministic Assessment 仍可展示
↓
Human Review Workspace 仍可打开
├─ revision_required -> allowed
├─ reject            -> allowed
└─ approve            -> blocked
↓
Freeze -> blocked
```

不允许：

```text
Provider 失败
→ 默认 semantic pass
→ 继续 Freeze
```

第一版不提供人工 Override。未来如确有生产必要，必须另行建立带 Reviewer Identity、Reason 和 Audit Record 的显式协议。

## 十一、确定性与语义结果合并

新增组合对象：

```ts
type QuestionQualityBundleDecision =
  | 'ready_for_review'
  | 'review_with_warnings'
  | 'revision_recommended'
  | 'semantic_unavailable';

type QuestionQualityAssessmentBundle = {
  bundleId: string;

  draftId: string;
  resourceId: string;
  assessedDraftRevision: number;
  validationId: string;

  deterministicAssessmentId: string;
  semanticAssessmentId: string;

  effectiveChecks: {
    materialGrounding: 'pass' | 'warning' | 'fail';
    observationClarity: 'pass' | 'warning';
    observationDistinctness: 'pass' | 'warning';
    discriminativePower: 'pass' | 'warning';
    difficultyCoherence: 'pass' | 'warning';
    rubricAlignment: 'pass' | 'warning';
    scopeClarity: 'pass' | 'warning';
  };

  decision: QuestionQualityBundleDecision;
  warningCodes: string[];

  deterministicRuleVersion: string;
  semanticRuleVersion: string;
  mergeRuleVersion: string;
  createdAt: string;
};
```

### 11.1 合并优先级

每项 Check 使用最保守结果：

```text
fail > strong_warning > warning > pass
```

其中：

- 语义 `strong_warning` 映射为有效 `warning`，并使 Bundle 至少为 `revision_recommended`；
- 确定性 `materialGrounding = fail` 不可被语义 `pass` 抵消；
- 语义 Warning 不得删除确定性 Warning；
- 相同风险可以去重展示，但两个来源必须继续保留。

### 11.2 Bundle Decision

```text
semantic status != completed
→ semantic_unavailable

materialGrounding = fail
或存在 strong_warning
→ revision_recommended

存在普通 warning
→ review_with_warnings

全部 pass
→ ready_for_review
```

Bundle Decision 仍然不是 Human Review Decision。

### 11.3 Bundle 身份

`bundleId` 稳定绑定：

```text
deterministicAssessmentId
+ semanticAssessmentId
+ mergeRuleVersion
```

任一来源更新，旧 Bundle 保留但失效。

## 十二、17.5C2 Shared Store 结构

在 17.4A Shared Store 中新增：

```ts
type SharedQuestionQualityState = {
  deterministicAssessments: QuestionQualityAssessment[];
  semanticAssessments: QuestionSemanticQualityAssessment[];
  assessmentBundles: QuestionQualityAssessmentBundle[];
  frozenQualityTraces: FrozenQuestionQualityTrace[];
  batchSummaries: QuestionGenerationBatchQualitySummary[];
  calibrationReports: TenMaterialCalibrationReport[];
};

type SharedFormalResourceData = {
  questionResources: SharedQuestionResourceState;
  materialObservations: SharedMaterialObservationState;
  questionQuality: SharedQuestionQualityState;
};
```

原则：

- 复用 17.4A Local API、Shared Store 与原子写入边界；
- 不新建第二套数据库或浏览器私有正式存储；
- 页面状态和未保存输入仍可留在浏览器；
- 正式 Assessment、Bundle、Trace、Summary 和 Calibration Report 必须进入 Shared Store。

## 十三、Repository 接口

### 13.1 Deterministic Assessment Repository

```ts
type SharedQuestionQualityAssessmentRepository = {
  saveAssessment(value: QuestionQualityAssessment): Promise<QuestionQualityAssessment>;
  getAssessment(id: string): Promise<QuestionQualityAssessment | null>;
  listForDraft(draftId: string): Promise<QuestionQualityAssessment[]>;
  getCurrentForRevision(
    draftId: string,
    revision: number,
    validationId: string,
    ruleVersion: string,
  ): Promise<QuestionQualityAssessment | null>;
};
```

### 13.2 Semantic Assessment Repository

```ts
type QuestionSemanticQualityAssessmentRepository = {
  saveAssessment(
    value: QuestionSemanticQualityAssessment,
  ): Promise<QuestionSemanticQualityAssessment>;

  getAssessment(
    semanticAssessmentId: string,
  ): Promise<QuestionSemanticQualityAssessment | null>;

  listForDraft(
    draftId: string,
  ): Promise<QuestionSemanticQualityAssessment[]>;

  getCurrentCompleted(
    identity: SemanticAssessmentCurrentIdentity,
  ): Promise<QuestionSemanticQualityAssessment | null>;
};
```

### 13.3 Bundle Repository

```ts
type QuestionQualityAssessmentBundleRepository = {
  saveBundle(
    value: QuestionQualityAssessmentBundle,
  ): Promise<QuestionQualityAssessmentBundle>;

  getBundle(bundleId: string): Promise<QuestionQualityAssessmentBundle | null>;

  getCurrentForDraft(
    identity: QualityBundleCurrentIdentity,
  ): Promise<QuestionQualityAssessmentBundle | null>;
};
```

### 13.4 Batch Repository

```ts
type QuestionGenerationBatchQualityRepository = {
  saveSummary(
    value: QuestionGenerationBatchQualitySummary,
  ): Promise<QuestionGenerationBatchQualitySummary>;

  getSummary(summaryId: string): Promise<QuestionGenerationBatchQualitySummary | null>;

  saveCalibrationReport(
    value: TenMaterialCalibrationReport,
  ): Promise<TenMaterialCalibrationReport>;
};
```

## 十四、幂等与冲突规则

### 14.1 对象幂等

相同 ID、相同内容：

```text
idempotent success
```

相同 ID、不同内容：

```text
identity_content_conflict
```

必须阻断，不得覆盖。

### 14.2 Shared Store Revision

所有写入继续使用 17.4A Optimistic Revision：

```text
expectedStoreRevision !== actualStoreRevision
→ shared_resource_revision_conflict
→ 重新读取后由调用方显式重试
```

不得自动以最后写入覆盖前一次写入。

### 14.3 Draft Revision

同一 Draft 可以保留多个 Revision 的 Assessment，但只有同时满足以下条件者为 Current：

- Draft Revision 相同；
- Validation ID 相同；
- Deterministic Rule Version 相同；
- Semantic Rule、Prompt、Provider、Model 和 Output Schema 版本相同；
- Bundle Merge Rule Version 相同。

旧 Assessment 不删除，只失去正式消费资格。

## 十五、Frozen Resource 质量追溯

为了不改写既有 `FrozenQuestionResourceVersion` Contract，新增独立追溯对象：

```ts
type FrozenQuestionQualityTrace = {
  traceId: string;

  resourceId: string;
  resourceVersionId: string;
  sourceDraftId: string;
  frozenDraftRevision: number;

  validationId: string;
  reviewId: string;

  deterministicAssessmentId: string;
  semanticAssessmentId: string;
  bundleId: string;

  deterministicRuleVersion: string;
  semanticRuleVersion: string;
  mergeRuleVersion: string;

  tracedAt: string;
  schemaVersion: string;
};
```

追溯关系：

```text
FrozenQuestionResourceVersion
↕ resourceVersionId
FrozenQuestionQualityTrace
↕ bundleId
QuestionQualityAssessmentBundle
├─ deterministicAssessmentId
└─ semanticAssessmentId
```

### 15.1 Freeze 原子性

新 Freeze Commit 必须在同一 Shared Store Revision 中写入：

1. `FrozenQuestionResourceVersion`
2. `ResourceRegistryEntry`
3. `FrozenQuestionQualityTrace`

任一写入失败：

```text
entire freeze transaction rolled back
```

不得出现：

- Resource 已 Frozen，但 Trace 缺失；
- Trace 已保存，但 Registry 尚未切换；
- Assessment 写入失败后仍然 Freeze。

### 15.2 Freeze 前置条件

只有以下条件同时成立才允许 Freeze：

- 当前 Draft Validation 通过；
- Human Review Action 为 `approve`；
- Deterministic Assessment Current；
- Semantic Assessment `completed` 且 Current；
- Bundle Current；
- Bundle Decision 不是 `semantic_unavailable`；
- Shared Store 可写。

`revision_recommended` 仍允许审核者 Approve，但必须保留 Review Notes；它不能自动放行，也不能自动拒绝。

## 十六、旧数据迁移与 Schema Version

### 16.1 Additive Migration

Shared Store 从：

```text
17.4A-v1
```

升级到 17.5C 新版本时，只做增量迁移：

- 新增空 `questionQuality` 集合；
- 保留现有 Question、Material、Observation、Review、Version 和 Registry；
- 迁移前创建 `.bak`；
- 迁移失败时继续使用迁移前文件；
- 不重新生成或改写既有 Frozen Resource。

### 16.2 历史 Frozen Resource

17.5C Cutover 前形成的 Frozen Resource 标记为：

```text
legacy_quality_trace_absent
```

不得根据现有题目内容反向伪造当时不存在的 Assessment。

历史资源仍可按既有协议运行，但：

- 不计入 17.5C 十篇材料校准；
- 页面必须明确“冻结时尚未建立质量追溯”；
- 新版本 Freeze 必须满足 17.5C Trace 要求。

### 16.3 既有内存 Assessment

Phase 17.5A/B 的 In-memory Assessment 不是 Shared Store 正式事实。

Cutover 时：

- 可以根据当前 Draft、Validation 和当前 Rule 重新生成；
- 不直接把无法验证来源的内存对象导入正式集合；
- 重新生成后形成新的 Shared Store Assessment Identity。

## 十七、写入失败阻断

### 17.1 Assessment Save Failed

```text
Assessment 计算完成
↓
Shared Store 写入失败
↓
页面显示“质量评估尚未保存”
↓
Approve / Freeze blocked
```

不得只把结果保留在 React State 后继续正式流程。

### 17.2 Bundle Save Failed

确定性和语义结果即使都存在，Bundle 未保存时：

```text
formal quality state incomplete
```

Review 可以查看来源，但不能 Approve 或 Freeze。

### 17.3 Trace Save Failed

Freeze 事务整体回滚，Registry Current Head 保持原值。

## 十八、17.5C3 Batch 输入边界

新增批次清单：

```ts
type QuestionGenerationQualityBatchManifest = {
  manifestId: string;
  batchId: string;
  batchVersion: string;

  materialVersionIds: string[];
  generationRequestIds: string[];
  generatedCandidateCount: number;

  draftRefs: Array<{
    draftId: string;
    resourceId: string;
    draftRevision: number;
    validationId: string;
  }>;

  createdAt: string;
  frozenAt: string;
};
```

Summary 只消费 Manifest 中明确列出的当前对象。

不得：

- 扫描 Repository 后猜测哪些 Draft 属于本批次；
- 混入别的 Material Version；
- 使用 Draft 的 Latest Revision 代替 Manifest Revision；
- 用旧 Rule Assessment 填补当前评估缺失。

## 十九、Batch Quality Summary 契约

```ts
type BatchSummaryStatus =
  | 'complete'
  | 'incomplete'
  | 'mixed_versions'
  | 'blocked';

type QuestionGenerationBatchQualitySummary = {
  summaryId: string;
  batchId: string;
  batchVersion: string;

  manifestId: string;
  reviewIds: string[];
  materialVersionIds: string[];
  bundleIds: string[];

  status: BatchSummaryStatus;

  counts: {
    materialCount: number;
    draftCount: number;
    currentBundleCount: number;
    missingAssessmentCount: number;
    staleAssessmentCount: number;
    reviewedCount: number;
  };

  decisionDistribution: Record<QuestionQualityBundleDecision, number>;
  warningDistribution: Record<string, number>;
  abilityDistribution: Record<string, number>;
  difficultyDistribution: Record<string, number>;

  humanDecisionDistribution: {
    approve: number;
    revisionRequired: number;
    reject: number;
    pending: number;
  };

  metrics: {
    contractValidationPassRate: number | null;
    semanticCompletionRate: number | null;
    currentAssessmentCoverage: number | null;
    duplicateObservationRate: number | null;
    humanRetentionRate: number | null;
    humanModificationRate: number | null;
    humanRejectionRate: number | null;
    averageReviewDurationMs: number | null;
  };

  issues: string[];

  deterministicRuleVersions: string[];
  semanticRuleVersions: string[];
  promptVersions: string[];
  mergeRuleVersions: string[];
  summaryRuleVersion: string;

  generatedAt: string;
};
```

## 二十、Summary Currentness

Summary 生成前必须检查：

1. 每个 Draft Ref 对应当前 Draft Revision；
2. 每个 Validation ID 与 Manifest 一致；
3. 每个 Bundle 引用 Current Deterministic 与 Semantic Assessment；
4. 所有 Bundle 使用同一批次要求的 Rule、Prompt 和 Merge Version；
5. 所有 Material Version 与 Manifest 一致；
6. Human Review Decision 引用同一 Draft Revision；
7. 重复 `draftId + revision` 不计入两次。

处理：

```text
缺失 Assessment
→ incomplete

混合 Revision / Rule / Prompt / Material Version
→ mixed_versions

身份冲突或重复 Current Bundle
→ blocked
```

不允许忽略缺项后按剩余数据计算“看起来完整”的 Summary。

## 二十一、指标公式

所有比例在分母为 0 时返回 `null`，不得返回 0 伪装为真实结果。

```text
Contract Validation Pass Rate
= passed valid drafts / generated structured candidates
```

```text
Semantic Completion Rate
= completed semantic assessments / current deterministic assessments
```

```text
Current Assessment Coverage
= current complete bundles / manifest drafts
```

```text
Duplicate Observation Rate
= drafts carrying duplicate-observation warning / assessed drafts
```

```text
Human Retention Rate
= approve decisions / reviewed drafts
```

```text
Human Modification Rate
= revision_required decisions / reviewed drafts
```

```text
Human Rejection Rate
= reject decisions / reviewed drafts
```

```text
Average Review Duration
= sum(reviewedAt - reviewStartedAt) / reviewed drafts with complete timestamps
```

每个指标必须同时保存：

- numerator；
- denominator；
- value。

Schema 可采用嵌套 Metric 对象实现，避免只保存不可复核的小数。

## 二十二、Summary 是否保存

区分两类用途：

### 22.1 页面即时预览

可以只读计算，不进入正式存储。

### 22.2 正式批次验收与十篇材料校准

必须保存不可变 Summary：

- 固定 Manifest；
- 固定 Bundle IDs；
- 固定 Rule Versions；
- 固定生成时间；
- 固定人工决定统计。

相同 `summaryId`、相同内容幂等返回；相同 ID、不同内容阻断。

`summaryId` 绑定：

```text
batchId
+ batchVersion
+ sorted bundleIds
+ sorted reviewIds
+ summaryRuleVersion
```

## 二十三、十篇材料校准集

新增不可变清单：

```ts
type TenMaterialCalibrationManifest = {
  calibrationSetId: string;
  calibrationSetVersion: string;

  materials: Array<{
    materialId: string;
    materialVersionId: string;
    title: string;
    expectedCoverageNotes: string[];
  }>;

  requiredProviderId: string;
  requiredModelId: string;
  requiredPromptVersion: string;
  requiredSemanticRuleVersion: string;
  requiredMergeRuleVersion: string;

  frozenAt: string;
};
```

要求：

- 恰好 10 个不同 `materialVersionId`；
- Material Version 冻结后不得静默替换；
- 材料应覆盖不同长度、体裁和观察潜力；
- 不要求每篇强制生成相同题数；
- 校准材料与版本在第一次正式运行前由人工确认；
- Manifest 未冻结时不得宣称开始正式十篇材料校准。

第一版不在本任务文档中虚构十篇正式材料名称。工程完成后，应从已确认可用的材料版本中形成真实 Manifest。

## 二十四、校准报告

```ts
type CalibrationPassDecision =
  | 'pass'
  | 'conditional_pass'
  | 'fail';

type CalibrationAdjustmentTarget =
  | 'none'
  | 'prompt'
  | 'deterministic_rule'
  | 'semantic_rule'
  | 'merge_rule'
  | 'question_revision'
  | 'material_manifest';

type TenMaterialCalibrationReport = {
  reportId: string;

  calibrationSetId: string;
  calibrationSetVersion: string;
  batchSummaryId: string;

  systemChecks: {
    allMaterialsProcessed: boolean;
    allDraftsContractValidated: boolean;
    currentAssessmentCoverageComplete: boolean;
    noMixedRevision: boolean;
    noMixedRuleVersion: boolean;
    noSilentSemanticFallback: boolean;
    freezeTraceComplete: boolean;
    repeatedSummaryStable: boolean;
  };

  qualityObservations: string[];
  reviewerNotes: string[];

  decision: CalibrationPassDecision;
  adjustmentTarget: CalibrationAdjustmentTarget;
  decisionReason: string;

  approvedBy: string;
  approvedAt: string;
  reportRuleVersion: string;
};
```

## 二十五、校准 PASS 标准

### 25.1 系统级硬条件

全部满足：

- 10 / 10 Material Version 被处理；
- Manifest 中所有 Draft 均有 Current Validation；
- Current Assessment Coverage = 100%；
- 不存在混合 Draft Revision；
- 不存在混合 Rule、Prompt、Model 或 Material Version；
- Provider 失败没有被静默记为 Pass；
- 新 Frozen Resource 的 Quality Trace 完整；
- 相同固定输入重复生成 Summary 时身份和统计结果一致；
- 没有 Quality Assessment 越权自动 Review、修改、删除或 Freeze。

任一失败：

```text
Calibration Decision = fail
```

### 25.2 质量观察条件

以下指标必须完整报告，但第一版不设置脱离真实数据的武断统一阈值：

- Human Retention Rate；
- Human Modification Rate；
- Human Rejection Rate；
- Warning Distribution；
- Duplicate Observation Rate；
- Ability Distribution；
- Difficulty Distribution；
- Average Review Duration。

人工验收者必须明确签署：

- 当前质量是否足以恢复受控 Batch B / C 生产；
- 是否需要先调整 Prompt、Rule 或具体 Draft；
- 哪些指标成为下一批的比较基线。

允许：

```text
conditional_pass
```

但必须带：

- 限制；
- 调整对象；
- 下一次复核条件。

## 二十六、失败后的调整归因

### 26.1 调 Prompt

适用于：

- Provider 经常遗漏 Evidence Ref；
- 输出结构虽合法但理由泛化；
- 语义 Finding 缺乏材料依据；
- 相同输入的关注重点明显漂移。

Prompt Version 升级后，旧 Semantic Assessment 不再是 Current。

### 26.2 调 Deterministic Rule

适用于：

- 稳定可计算风险长期漏检；
- 规则误报可以由明确字段逻辑修正；
- 不需要语义理解即可判断。

### 26.3 调 Semantic Rule / Merge Rule

适用于：

- Provider 输出合理，但严重程度映射错误；
- Deterministic 与 Semantic 冲突时合并结果不合理；
- Bundle Decision 过严或过松。

### 26.4 返回修改题目

适用于：

- 单个 Draft 的材料依据、Rubric 或范围确实存在问题；
- 问题属于内容本身，不属于系统规则。

不得为了提高批次统计而修改审核事实。

## 二十七、17.5C1 专项 Debug

至少覆盖：

1. 当前 Draft 和 Validation 形成 Completed Semantic Assessment；
2. 旧 Draft Revision 在 Provider 调用前阻断；
3. 旧 Validation ID 阻断；
4. Material Version 错位阻断；
5. Provider Failed 形成可保存失败对象；
6. Timeout 不发生隐式第二次提交；
7. 非 JSON 输出进入一次结构修复；
8. 二次结构非法形成 `invalid_output`；
9. 非法 Evidence Ref 被拒绝；
10. Prompt Version 改变形成新身份；
11. Model Version 改变形成新身份；
12. 同身份 Completed 结果幂等；
13. Semantic Failure 不静默 Pass；
14. Merge 使用最保守 Check；
15. Deterministic Material Fail 不被 Semantic Pass 抵消；
16. Semantic Strong Warning 形成 `revision_recommended`；
17. Semantic Unavailable 阻断 Approve / Freeze；
18. Revision Required / Reject 在降级状态仍允许。

## 二十八、17.5C2 专项 Debug

至少覆盖：

1. Deterministic Assessment 写入 Shared Store；
2. Semantic Assessment 写入 Shared Store；
3. Bundle 写入 Shared Store；
4. 服务重启后 Assessment 和 Bundle 可恢复；
5. 相同 ID、相同内容幂等；
6. 相同 ID、不同内容冲突；
7. Store Revision 冲突不覆盖；
8. Draft Revision 更新后旧 Assessment 保留但失效；
9. Rule Version 更新后旧 Bundle 不可正式消费；
10. Freeze 同时写入 Version、Registry 和 Trace；
11. Trace 写入失败时整个 Freeze 回滚；
12. Assessment 写入失败阻断 Review Approve；
13. Bundle 写入失败阻断 Freeze；
14. Frozen Resource 能回放到两个来源 Assessment；
15. 17.4A-v1 Additive Migration 成功；
16. Migration 失败恢复 `.bak`；
17. Legacy Frozen Resource 不伪造 Trace；
18. 两个浏览器读取同一 Assessment 集合。

## 二十九、17.5C3 专项 Debug

至少覆盖：

1. 完整 Manifest 形成 Complete Summary；
2. 缺失 Assessment 形成 Incomplete；
3. 混合 Draft Revision 形成 Mixed Versions；
4. 混合 Rule Version 形成 Mixed Versions；
5. 重复 Draft Ref 不重复计数；
6. 分母为 0 时指标为 `null`；
7. Decision Distribution 正确；
8. Warning Distribution 正确；
9. Human Decision Distribution 正确；
10. 未审核 Draft 计入 Pending；
11. Summary ID 对输入顺序不敏感；
12. Bundle 或 Review 改变后形成新 Summary ID；
13. 正式 Summary 可保存并重启恢复；
14. 校准 Manifest 不是 10 个材料时阻断；
15. Material Version 被替换时阻断；
16. 十篇材料系统级硬条件可计算；
17. 重复 Summary 统计一致；
18. Calibration Report 必须有人工作者身份；
19. Fail 必须指出 Adjustment Target；
20. Summary 和 Report 不改变 Review / Freeze 事实。

## 三十、回归范围

### 29.1 Phase 17.5C3A 工程结果

17.5C3A 已完成批次摘要的最小工程闭环：

- 固定 `QuestionGenerationQualityBatchManifest`，Summary 不扫描 Repository 猜测批次成员；
- 只消费 Manifest 中指定的 Draft Revision、Validation、Material Version 与当前质量规则；
- 缺失 Current Bundle 输出 `incomplete`；
- Revision、Rule、Prompt、Merge Rule 或 Material Version 错位输出 `mixed_versions`；
- 重复 Current Bundle 或身份冲突输出 `blocked`；
- 输出 Decision、Warning、Ability、Difficulty 与 Human Review 分布；
- 所有比例保存 numerator、denominator 与 value，分母为 `0` 时 value 为 `null`；
- Summary 身份对输入顺序不敏感，Bundle 或 Review 改变时生成新身份；
- Manifest 与正式 Summary 可幂等保存到 Shared Store，并可在运行重启后恢复。

专项 Debug：`13 / 13 PASS`。

轻量 Demo 已接入：

`#/phase17-5c3a-batch-quality-summary-demo`

Demo 直接调用正式 `summarizeQuestionGenerationBatchQuality`，覆盖：

- `complete`：完整批次与 100% 当前质量覆盖；
- `incomplete`：缺少当前 Bundle；
- `mixed_versions`：Draft Revision 与质量事实版本混杂；
- `blocked`：同一 Draft 存在重复 Current Bundle；
- 零分母：指标 value 保持 `null`，页面显示“暂无数据”并保留原始分子、分母。

Demo 自动化 Debug：`13 / 13 PASS`；Production Build：`PASS`；浏览器冒烟：`PASS`。

2026-07-26 人工演示验收结论：`PASS`。五个 Case 的状态、计数、指标分母与问题代码均符合预期。

C3A 本阶段不包含固定十篇材料 Manifest、Calibration Report 或人工校准签署；这些属于 17.5C3B。

### 29.2 Phase 17.5C3B 工程结果

17.5C3B 已完成十篇材料校准的工程 Runtime：

- 固定 `TenMaterialCalibrationManifest`，要求恰好 10 个互不重复的 Material Version；
- 形成独立 `TenMaterialCalibrationReport`，绑定 Manifest、Batch Summary、人工签署身份与 Report Rule Version；
- 计算八项系统硬检查，任一失败时禁止形成 `pass` 或 `conditional_pass`；
- `fail` 与 `conditional_pass` 必须指出明确的 Adjustment Target；
- `conditional_pass` 必须保留限制或后续复核说明；
- 重复 Summary 必须保持统计稳定，版本、Provider、Prompt、Rule、冻结追溯缺失均可阻断；
- Calibration Manifest 与 Report 作为不可变事实写入 Shared Store；
- 相同身份、相同内容保持幂等，相同身份、不同内容明确冲突；
- 服务重启后可恢复 Manifest、Summary 与 Report；
- 校准计算不修改既有 Summary、Review 或 Freeze 事实。

专项 Debug：`16 / 16 PASS`。

本结果只证明校准 Runtime 与隔离工程样例成立。固定真实十篇材料的采集、运行、人工观察、签署和正式报告仍未执行，因此 Phase 17.5C 尚不能标记整体 PASS。

### 29.3 真实材料准备基线（2026-07-26）

当前 Shared Store 共保存 6 条 Material Version：

- 3 份可暂计入真实文本候选：《散步》《秋天的怀念》与谭嗣同《潼关》；
- 2 份为 Phase 17 Batch A 的 AI 辅助项目原创材料，不计入本次“真实十篇材料”口径；
- 1 份为已停用的《秋天的怀念》重复记录，不计入校准集。

因此当前真实十篇材料准备度为：`3 / 10`。

《潼关》正文属于公版文本，但创作背景为人工概括；冻结正式 Calibration Manifest 前仍须完成人工来源复核。其余 7 份真实材料尚待录入、来源检查与版本冻结。

17.5C 完成后至少回归：

- Phase 17.5A Deterministic Assessment；
- Phase 17.5B Review Gate；
- Question Resource Admission；
- Material Observation Draft Generator；
- Phase 17.4A Shared Store；
- Review -> Freeze -> Registry；
- Formal Resource Matching；
- `/learning` 正式学习入口；
- Production Build。

## 三十一、明确不做

Phase 17.5C 不做：

- 自动改写低质量题目；
- 自动删除 Candidate 或 Draft；
- 自动形成 Human Review Decision；
- 自动 Freeze；
- 用质量分数替代 Reviewer；
- 根据具体学生自动匹配难度；
- 证明教学有效；
- 多题型扩展；
- 多人内容协作；
- 云端 Shared Store；
- 大型统计平台；
- 自动学习题目难度；
- 修改 Diagnosis、Evidence、Evaluation 或 Profile。

## 三十二、工程顺序

1. 冻结 C1 Schema、身份和失败分支；
2. 实现 Semantic Provider Adapter 与 Output Validator；
3. 实现 Deterministic + Semantic Merge；
4. 跑通 17.5C1 Debug；
5. 扩展 Shared Store Schema；
6. 实现四类质量 Repository；
7. 实现 Frozen Quality Trace 与原子 Freeze；
8. 完成 Additive Migration；
9. 跑通 17.5C2 Debug；
10. 实现 Batch Manifest 与 Summary；
11. 实现 Calibration Manifest 与 Report；
12. 跑通 17.5C3 Debug；
13. 完成固定十篇材料人工校准；
14. 全链回归；
15. 人工决定是否恢复 Batch B / C。

## 三十三、完成定义

Phase 17.5C 完成后，系统可以宣称：

> 系统能够对当前 Revision 的结构合法题目形成独立语义质量评估，将其与确定性检查组合成可追溯的审核依据，并把 Assessment、Bundle、Frozen Quality Trace、批次摘要和十篇材料校准报告保存到 Shared Store；Provider 失败、旧 Revision、混合规则版本或持久化失败不会静默放行 Review Approve 与 Freeze。

系统仍不能宣称：

- AI 可以取消人工审核；
- 题目质量已经证明真实教学有效；
- 所有材料都能稳定产生高质量题目；
- 难度已经完成统计标定；
- 系统已经支持多学科或多题型规模化生产；
- 质量评估可以自动决定正式发布。

## 三十四、Phase 完成声明

17.5C 只有同时满足以下条件才可标记 PASS：

- C1、C2、C3 专项 Debug 全部通过；
- Shared Store 重启恢复与双浏览器读取通过；
- Frozen Resource 质量追溯通过；
- 固定十篇材料校准报告已保存；
- 人工签署 `pass` 或带明确限制的 `conditional_pass`；
- A、B 与正式学习链回归通过；
- 文档记录最终 Rule、Prompt、Provider、Model、Schema 与 Summary Version。

在此之前，准确状态保持：

> 17.5C1 ENGINEERING + AUTOMATED DEBUG PASS / C1 LIGHT DEMO HUMAN ACCEPTANCE PASS / 17.5C2 ENGINEERING + AUTOMATED DEBUG PASS / C2 LIGHT DEMO HUMAN ACCEPTANCE PASS / 17.5C3A BATCH QUALITY SUMMARY ENGINEERING + AUTOMATED DEBUG PASS / C3A LIGHT DEMO HUMAN ACCEPTANCE PASS / 17.5C3B CALIBRATION RUNTIME + AUTOMATED DEBUG PASS / REAL TEN-MATERIAL CALIBRATION PENDING
