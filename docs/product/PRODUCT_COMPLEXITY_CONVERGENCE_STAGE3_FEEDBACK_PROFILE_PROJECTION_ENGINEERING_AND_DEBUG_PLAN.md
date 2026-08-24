# 产品复杂度收口阶段 3：反馈与 Profile 投射收口工程实施与 Debug 验收文档

英文名称：Product Complexity Convergence Stage 3 Feedback and Profile Projection Engineering and Debug Plan

阶段契约版本：`product_complexity_convergence_stage3_feedback_profile_projection_v1`

对应总契约：`product_complexity_convergence_v1`

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`

日期：2026-08-24

关联文档：

- [产品复杂度收口总契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [阶段 1 页面投射与默认展示收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 2 条件触发策略收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_CONDITIONAL_POLICY_ENGINEERING_AND_DEBUG_PLAN.md)
- [Learning 反馈后一次修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)
- [反馈行动转换模型](../education/FEEDBACK_ACTION_MODEL.md)
- [阶段 3 工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage3_engineering_debug_browser_acceptance_2026-08-24.md)

## 一、阶段定位

阶段 3 只收敛两类普通用户投射：

1. 当前题反馈：从已有正式反馈、Diagnosis 与 Requirement Coverage 中选择一个最重要的展示焦点，并形成学生能够立即理解的表达；
2. 长期能力概况：从现有 `StudentAbilityProfile` 形成粗粒度、只读的 `CoreAbilitySummary`。

本阶段解决的是：

- 反馈同时罗列多个问题，学生不知道先处理哪个；
- 正确回答仍出现模板化“思考缺口”；
- 下一步建议只有能力术语，没有可执行动作；
- 反馈重复题目目标、解释调度原因或暴露内部治理语义；
- Profile 信息过细、过早或带有伪精确感；
- 页面为了展示能力而复制一套新的长期判断。

本阶段不改变正式 Diagnosis、Evidence、Profile、Revision、Targeted、Retest 或 Transfer 的领域事实，不建立新的反馈状态机，也不证明真实教育效果已经改善。

核心原则：

> 反馈只呈现当前最有学习价值的一点，并在需要时给出一个立即可执行的动作；长期能力只投射已有稳定结论，不用单次表现制造新画像。

## 二、贯穿全部阶段的验收原则

阶段 3 必须同时证明：

> 旧主链零回归，并且新语义只在阶段 3 允许的反馈与 Profile 只读投射边界内生效。

具体要求：

1. `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 主链不变；
2. Attempt、Diagnosis、Evidence、Progression、Profile 与 Calibration 的写入者和状态机不变；
3. 阶段 3 不读取阶段 2 Audit Projection 作为反馈或画像事实来源；
4. 阶段 3 不改变 Revision、Targeted、Retest、Transfer 是否触发；
5. 页面操作继续调用既有正式 Command，不建立展示专用业务命令；
6. 新表达失败时安全回退已有正式反馈，不阻断学生继续；
7. 历史反馈和历史 Profile 不做批量回写；
8. 普通页面不显示 Diagnosis Code、Gap Code、Evidence ID、Profile Pipeline、Policy、Hash 或 Confidence 数值；
9. Internal Acceptance / Fixture / Shadow 记录不进入正式资源、Attempt、Evidence、Profile 或真实校准分母；
10. Production Build 与旧主链专项回归必须通过。

## 三、本阶段绝对禁止的修改

阶段 3 不得修改：

- Material、Material Version、Observation Plan 与 TrainingTask；
- QuestionCandidate、Question Revision、Admission、Frozen Resource 与 Registry；
- 正式题组顺序、当前题号、Load Profile 与 Progression Assessment；
- Student Response、Attempt、Diagnosis 与 Requirement Coverage；
- Evidence Admission、Evidence Confidence 与 Profile Update Decision；
- Revision 的资格、次数、提交、评价和 Evidence 身份；
- Targeted、Retest、Transfer 的触发、匹配、顺序和退出；
- Outbox、幂等键、恢复身份和 Calibration 分母；
- 阶段 1 的普通页面术语白名单；
- 阶段 2 的 Owner Authority、Feature Flag 与条件策略语义。

禁止以“反馈更易懂”为理由：

- 改写正式 Diagnosis 结论；
- 从反馈自由文本反向推断新的 Gap；
- 把次要缺口删除出正式记录；
- 生成新的训练任务或改变下一题；
- 把 Revision 后改善写成独立掌握；
- 把 Targeted 成功写成长期能力提升；
- 根据单次失败降低长期 Profile；
- 建立第二套 Student Profile 或独立保存 `CoreAbilitySummary`；
- 展示百分比分数、能力分、置信度小数或排行榜；
- 为保持固定版式而机械输出“做得好 / 缺口 / 下一步”三段。

## 四、架构边界与事实权威

### 4.1 既有对象继续承担事实权威

| 展示内容 | 权威事实 | 阶段 3 只允许做什么 |
| --- | --- | --- |
| 当前完成点 | `StudentLearningFeedback.whatYouDidWell`、Requirement Coverage、正式 Diagnosis | 选择一个有直接依据的完成点并压缩表达 |
| 当前主要缺口 | `primaryGapRequirementId` 或既有 Primary Gap | 选择一个焦点；不得发明或改写缺口 |
| 下一步动作 | `StudentFeedbackActionPlan`、正式 Revision Offer、既有 Runtime Action | 用学生可执行语言表达一个动作 |
| 修订结果 | `FeedbackGuidedRevisionEvaluation` | 说明这次修改的实际变化，不重评首答 |
| 长期能力 | `StudentAbilityProfile` | 只读映射为粗粒度 `CoreAbilitySummary` |

阶段 3 输出是 `presentation_projection`，不是 Diagnosis、Evidence 或 Profile。

### 4.2 输入与输出方向

```text
Formal Attempt / Diagnosis / Requirement Coverage
                        ↓
Existing StudentLearningFeedback / Action Plan
                        ↓
Stage 3 Feedback Focus + Expression Projection
                        ↓
Student-facing Feedback

Existing StudentAbilityProfile
                        ↓
Stage 3 CoreAbilitySummary Projection
                        ↓
Optional low-burden summary display
```

任何箭头都不得反向写回上游事实。

### 4.3 不建立新状态机

阶段 3 不新增：

- Feedback Lifecycle；
- Profile Lifecycle；
- Presentation Repository；
- Student Action Queue；
- Feedback-specific Evidence；
- Profile-specific Calibration。

投射器必须是确定性纯函数；页面刷新时可以从原有正式事实重新得到相同结果。

## 五、Schema 冻结

### 5.1 版本常量

```ts
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION =
  'product_complexity_convergence_stage3_feedback_profile_projection_v1' as const;

export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_EXPRESSION_POLICY_VERSION =
  'product_complexity_convergence_stage3_expression_policy_v1' as const;
```

Schema Version 描述投射结构；Expression Policy Version 描述焦点选择与表达规则。二者独立升级。

### 5.2 反馈焦点类型

```ts
export type ConvergenceFeedbackFocusKind =
  | 'confirmed_understanding'
  | 'primary_actionable_gap'
  | 'revision_change'
  | 'insufficient_to_judge'
  | 'recovery_only';

export type ConvergenceFeedbackFocusReasonCode =
  | 'answer_meets_current_requirement'
  | 'required_gap_selected'
  | 'partial_required_gap_selected'
  | 'revision_gap_resolved'
  | 'revision_gap_partially_resolved'
  | 'revision_gap_unresolved'
  | 'formal_result_insufficient'
  | 'feedback_identity_mismatch'
  | 'structured_focus_unavailable'
  | 'runtime_recovery_required';
```

规则：

- 一次投射必须且只能有一个主 `focusKind`；
- `primary_actionable_gap` 必须引用一个正式 Requirement 或 Primary Gap；
- `confirmed_understanding` 必须有答案或正式评价依据；
- `insufficient_to_judge` 不得伪装成能力不足；
- `recovery_only` 只表达数据保留和恢复动作，不输出学习结论；
- 自由文本不得作为统计、触发或聚合键。

### 5.3 来源引用

```ts
export type ConvergenceFeedbackSourceRef = {
  sourceType:
    | 'student_learning_feedback'
    | 'formal_diagnosis'
    | 'requirement_coverage'
    | 'feedback_action_plan'
    | 'revision_evaluation';
  sourceId: string;
  sourceSchemaVersion?: string;
};
```

投射必须引用既有身份，不复制完整答案、正文、Diagnosis 或 Evidence。

### 5.4 反馈展示块

```ts
export type ConvergenceFeedbackBlockKind =
  | 'acknowledgement'
  | 'primary_gap'
  | 'next_action'
  | 'recovery';

export type ConvergenceFeedbackDisplayBlock = {
  kind: ConvergenceFeedbackBlockKind;
  text: string;
  sourceRefIds: string[];
};
```

硬边界：

- `acknowledgement` 最多一个；
- `primary_gap` 最多一个；
- `next_action` 最多一个；
- `recovery` 与学习评价块不并存；
- 总块数最多三个，但不要求必须有三个；
- 同一事实不得换句话重复出现在多个块中。

### 5.5 学生操作投射

```ts
export type ConvergenceFeedbackActionKind =
  | 'continue'
  | 'revise_once'
  | 'retry_analysis'
  | 'recover_saved_state';

export type ConvergenceFeedbackActionProjection = {
  kind: ConvergenceFeedbackActionKind;
  label: string;
  existingCommand: string;
  enabled: boolean;
};
```

`existingCommand` 只能引用当前 Runtime 已允许的正式操作。投射层不得自行开放 Revision、重试或下一题。

### 5.6 完整反馈投射

```ts
export type ConvergenceFeedbackPresentation = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION;
  expressionPolicyVersion:
    typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_EXPRESSION_POLICY_VERSION;
  projectionId: string;
  projectionHash: string;
  persistenceRole: 'presentation_projection';
  studentId: string;
  learningRoundId: string;
  learningTaskAttemptId?: string;
  feedbackId: string;
  focusKind: ConvergenceFeedbackFocusKind;
  focusReasonCode: ConvergenceFeedbackFocusReasonCode;
  primaryRequirementId?: string;
  sourceRefs: ConvergenceFeedbackSourceRef[];
  blocks: ConvergenceFeedbackDisplayBlock[];
  actions: ConvergenceFeedbackActionProjection[];
  fallbackUsed: boolean;
  validation: {
    passed: boolean;
    identityAligned: boolean;
    grounded: boolean;
    singleFocus: boolean;
    actionAligned: boolean;
    studentSafe: boolean;
    issues: string[];
  };
};
```

约束：

1. `projectionId` 和 `projectionHash` 必须确定性生成；
2. 相同正式事实与相同 Policy Version 产生相同投射；
3. 输出不得包含答案全文、材料正文、完整 Diagnosis、Evidence ID 或内部 Code；
4. `primaryRequirementId` 只用于内部追溯，不直接显示；
5. `validation.passed = false` 时不得显示不完整新投射；
6. `fallbackUsed = true` 时回退既有正式反馈，核心链继续；
7. 投射不持久化为新的学习事实。

### 5.7 CoreAbilitySummary 只读投射

```ts
export type CoreAbilitySummaryStatus =
  | 'stable'
  | 'developing'
  | 'uncertain'
  | 'needs_attention';

export type CoreAbilitySummaryConfidence =
  | 'low'
  | 'medium'
  | 'high';

export type CoreAbilitySummary = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION;
  projectionId: string;
  persistenceRole: 'profile_read_model';
  studentId: string;
  sourceProfileGeneratedAt: string;
  abilityId: string;
  status: CoreAbilitySummaryStatus;
  confidence: CoreAbilitySummaryConfidence;
  recentEvidenceSummary: string;
  lastUpdatedAt: string;
  sourceEvidenceCount: number;
  validation: {
    passed: boolean;
    sourceProfileValid: boolean;
    noNewAbilityInference: boolean;
    noUnsupportedPrecision: boolean;
    issues: string[];
  };
};
```

固定状态映射：

| `StudentAbilityProfile.AbilityStatus` | `CoreAbilitySummary.status` |
| --- | --- |
| `stable_positive` | `stable` |
| `improving` | `developing` |
| `insufficient_evidence` | `uncertain` |
| `weak` | `needs_attention` |

V1 的 Confidence 采用保守映射：

- 只有一条有效 Evidence Link，或源 Profile 为 `insufficient_evidence` 时，只能为 `low`；
- 至少两条身份有效的 Evidence Link 且源 Profile 已形成非 `insufficient_evidence` 状态时，可以为 `medium`；
- `high` 只允许映射未来由正式 Profile 明确提供的聚合置信等级；当前 Profile 没有该权威字段，因此 V1 Adapter 不自行生成 `high`；
- 单条 Evidence 的数值 Confidence 不直接显示，也不得简单平均成新的长期能力分数。

`recentEvidenceSummary` 优先使用源 Profile 已有的 `summary` 或 `improvement_signal`，经学生术语白名单处理后展示；来源不足或包含不安全内部语义时宁可省略，不调用模型生成新的能力结论。

不得从单次 Attempt、单次 Revision、Targeted 完成或一次 Progression Breakpoint 直接生成 `CoreAbilitySummary`。

## 六、主要反馈焦点选择规则

### 6.1 选择优先级

反馈焦点按以下顺序确定：

1. 身份和正式结果是否完整；
2. 是否已经满足当前题的全部必需要求；
3. 是否存在正式 `primaryGapRequirementId`；
4. 若无显式 Primary Gap，是否只有一个必需且可执行的 `missing` Requirement；
5. 若有多个缺口，优先选择阻断当前题核心动作、且一次操作可改善的缺口；
6. 无法确定唯一焦点时回退既有反馈，不由投射层猜测。

### 6.2 不重算 Diagnosis

阶段 3 可以在多个已存在缺口中选择“展示哪一个”，但不得：

- 改变 Coverage Status；
- 把 `partially_covered` 改成 `missing`；
- 为了提供 Revision 而创造可执行缺口；
- 依据学生界面文案重新分类 Gap；
- 把表达问题替代证据或推理问题；
- 隐藏正式主要缺口并展示更容易表达的次要问题。

### 6.3 正确答案边界

当正式结果表明当前要求已经满足：

- 只输出一句有依据的真实确认；
- 不生成“思考缺口”；
- 不为了保持三段式而制造下一步训练；
- 单选题可说明选择符合材料和题意，但不重复展示完整正确答案解释；
- 若仍有后续正式题，只显示真实下一题操作，不解释调度原因。

### 6.4 不足以判断

输入为空、身份错位、分析未完成或正式结果不足时：

- 不评价能力；
- 不输出模板化鼓励或猜测性缺口；
- 说明回答是否保留；
- 提供现有恢复或重新分析入口；
- 恢复失败不改变 Attempt、Evidence 或 Profile。

## 七、反馈表达策略

### 7.1 内容上限，不是固定模板

一次反馈最多回答：

1. 已经做到什么；
2. 当前最重要的一个缺口；
3. 下一步立即做什么。

允许的组合：

| 场景 | 推荐展示 |
| --- | --- |
| 完全满足 | 一句真实确认 |
| 部分满足、可修订 | 一个完成点 + 一个缺口 + 一个修订动作 |
| 未满足但有有效基础 | 一个已有基础 + 一个主要缺口 + 一个操作 |
| 无可执行 Revision | 一个主要缺口 + 一个以后可复用的方法，或直接继续 |
| 修订已改善 | 说明具体改善 + 必要时一个仍需注意点 |
| 系统暂不可评价 | 恢复说明 + 一个恢复操作 |

### 7.2 表达质量门禁

学生反馈必须：

- 引用当前答案实际出现的动作、判断或证据；
- 把能力术语转换为可以执行的阅读动作；
- 一句话尽量只承担一个意思；
- 下一步动作包含对象或位置与动作，不暴露答案；
- 与页面上真实可用操作一致；
- 适合当前学生直接阅读，不要求理解系统模型。

默认禁止：

- “继续加强理解能力”“注意逻辑关系”等无对象建议；
- “正式诊断确认”“反馈支持下证据”“后续独立验证”等内部口径；
- 重复题目、作答要求或训练目标；
- 解释为什么系统安排下一题；
- 同义反复的表扬与缺口；
- 把学生答案大段复述给学生；
- 用固定开场、固定三段或固定结尾制造模板感；
- 在提示中直接给出结论、证据句或正确选项。

### 7.3 下一步动作

好的下一步动作示例：

> 回到第二段，先找人物做了什么，再说明这个动作支持你的哪个判断。

不合格示例：

> 加强文本证据意识，并进一步提升逻辑关系理解。

下一步动作只用于帮助当前修订或以后复用方法，不得代替 Revision Offer 或 Scheduler 决策。

### 7.4 模型表达与确定性回退

允许在既有 Controlled Feedback Expression 边界内使用模型改善措辞，但必须：

- 输入只包含已有结构化事实和允许引用的短片段；
- 输出通过来源、单焦点、动作一致性、答案泄露和内部术语校验；
- 模型不得选择新的 Diagnosis 或改变 Profile；
- 模型失败、超时或输出不合格时使用确定性投射；
- 确定性回退仍只呈现一个主要焦点；
- 模型版本变化不得改变正式领域事实。

## 八、操作一致性边界

反馈文案与页面操作必须来自同一份正式 Runtime 事实：

| Runtime 事实 | 可投射主操作 |
| --- | --- |
| Revision Offer = recommended / optional | `revise_once`，同时允许继续 |
| Revision 不允许 | `continue` |
| Analysis 可安全重试 | `retry_analysis` |
| 已保存但读取失败 | `recover_saved_state` |
| 尚有正式下一题 | `continue` 指向真实下一题 |
| 题组完成 | 使用既有完成出口，不伪造下一题 |

不得出现：

- 文案要求修改答案但没有修订入口；
- 已完成全部题目却显示下一题；
- 尚有题目却只允许返回学习入口；
- 正确单选仍展示开放文本修订建议；
- Targeted / Retest / Transfer 被解释为学生当前错误导致的惩罚。

## 九、Profile 只读投射边界

### 9.1 展示条件

`CoreAbilitySummary` 只在以下条件成立时生成：

- 存在通过校验的正式 `StudentAbilityProfile`；
- Ability Status 来自身份一致的现有 Profile Item；
- 至少存在一个可追溯 Evidence Link；
- Profile 的时间和学生身份有效；
- 当前页面确实需要能力概况，而不是为了展示已有字段。

没有足够证据时显示 `uncertain` 或完全不展示，不用空卡片制造焦虑。

### 9.2 展示内容

普通用户最多看到：

- 能力名称；
- 粗粒度状态；
- 一句近期证据概况；
- 一句可选的后续练习方向。

普通用户不得看到：

- Evidence ID 或数量明细；
- Confidence 小数、得分或百分比；
- Weakness Count、Growth Count 等内部计数；
- Load Level、Breakpoint、Support Mode；
- Profile Update Action；
- 单次题目对长期状态的即时跳变。

### 9.3 不形成第二套画像

`CoreAbilitySummary`：

- 不单独保存；
- 不被 Scheduler、Diagnosis、Evidence 或 Profile Writer 读取；
- 不参与后续能力计算；
- 不产生自己的更新时间；
- `lastUpdatedAt` 必须来自源 Profile 或其正式 Evidence；
- 删除投射代码后不影响任何正式学习事实。

## 十、历史兼容、迁移与回滚

### 10.1 历史反馈

历史反馈按以下顺序读取：

1. 有结构化 Requirement Coverage 与 Primary Gap：使用阶段 3 投射；
2. 有 Coverage、无 Primary Gap，但只有一个明确必需缺口：允许确定性选择；
3. 多个缺口且无法可靠排序：保留既有正式反馈；
4. 只有自由文本：保留既有展示，不从文本反推 Gap；
5. 身份或正式状态不完整：进入既有恢复投射。

不得批量重写历史 `StudentLearningFeedback`。

### 10.2 历史 Profile

- 通过现有 `isStudentAbilityProfile` 校验的 Profile 可以只读投射；
- 缺少新字段不视为损坏；
- 无 Evidence Link 的旧 Profile 不生成可靠能力概况；
- 不补写新的状态、置信度或摘要；
- Profile Adapter 失败时隐藏概况，不阻断 Learning。

### 10.3 Feature Flag 与回滚

```ts
export type ConvergenceStage3PresentationFlag =
  | 'legacy'
  | 'convergence_v1';
```

规则：

- 默认先以 Internal Acceptance 和受控页面启用；
- 普通页面启用前必须完成 C3、B3 和旧主链回归；
- 回滚为 `legacy` 只改变展示，不修改或删除正式事实；
- 阶段 3 不为 Feature Flag 建立新的领域 Repository；
- 已经展示过的历史反馈仍可从正式源事实恢复，不依赖投射持久化。

## 十一、失败与恢复边界

| 失败位置 | 页面行为 | 正式事实行为 |
| --- | --- | --- |
| 来源身份不一致 | 使用既有安全错误投射 | 不写入、不重算 |
| Primary Gap 不唯一 | 回退旧反馈 | Diagnosis 不变 |
| 表达模型超时 | 使用确定性表达 | Attempt / Evidence 不变 |
| 新投射校验失败 | 不显示半成品投射 | 保留原反馈 |
| Profile 校验失败 | 隐藏能力概况 | Profile 不变 |
| 页面刷新 | 从正式事实重建相同投射 | 不创建新事实 |
| 重复打开反馈 | 显示相同结果 | 不重复写事件或 Evidence |
| 恢复操作失败 | 原位说明数据保留与重试 | 不覆盖成功状态 |

任何展示故障都不得阻止：

- 查看已保存回答；
- 完成一次允许的 Revision；
- 进入真实下一题；
- 完成题组；
- 恢复原 Owner Flow。

## 十二、建议工程结构

建议新增：

```text
src/ai/schemas/productComplexityConvergenceFeedbackProjection.schema.ts
src/ai/agents/productComplexityConvergenceFeedbackProjectionAgent.ts
src/ai/agents/productComplexityConvergenceProfileProjectionAgent.ts
src/ui/productComplexityConvergenceStage3Presentation.ts
src/ai/tests/runProductComplexityConvergenceStage3Debug.ts
src/api/productComplexityConvergenceStage3BrowserAcceptance.ts
src/pages/ProductComplexityConvergenceStage3BrowserAcceptance.jsx
```

优先复用：

- `StudentLearningFeedback`；
- `TaskRequirementCoverage`；
- `StudentFeedbackActionPlan`；
- `ControlledFeedbackExpressionAgent`；
- `FeedbackGuidedRevisionEvaluation`；
- `StudentAbilityProfile`；
- 阶段 1 的普通页面 Presentation；
- 阶段 2 的 Owner Authority 与失败回退边界。

不得新增：

- Feedback 或 Profile 正式 Repository；
- 第二个 Diagnosis / Evidence / Profile Agent；
- 新的学生任务状态；
- 独立反馈 Queue；
- 由 UI 反推的能力事实。

## 十三、分阶段工程包

### WP3-01：Schema 与 Validator

完成：

- Feedback Focus、Source Ref、Display Block、Action Projection；
- `CoreAbilitySummary` 只读 Schema；
- Validator、稳定 ID / Hash；
- 保护字段与内部术语校验。

本包不得接入普通页面。

### WP3-02：反馈焦点选择 Agent

完成：

- 正确、部分满足、缺口、不可判断、Revision 评价五类焦点；
- 一个主要 Requirement 选择；
- 多缺口不确定时安全回退；
- 不重算 Diagnosis 的不可变快照测试。

### WP3-03：反馈表达与 Action 对齐

完成：

- 最多三个非固定展示块；
- 一个立即可执行动作；
- Controlled Model 输出校验与确定性回退；
- 答案泄露、模板化、内部术语与重复内容门禁；
- Revision / Continue / Retry / Recover 与真实 Runtime 对齐。

### WP3-04：CoreAbilitySummary Adapter

完成：

- 固定状态映射；
- 粗粒度 Confidence；
- 近期证据摘要；
- 无可靠来源时不展示；
- Profile Digest 零变化。

### WP3-05：普通页面接入

完成：

- Learning 当前题反馈；
- Revision 完成反馈；
- 题组完成或入口处可选能力概况；
- 阶段 1 白名单与唯一主操作继续成立；
- Legacy 一键回退。

### WP3-06：全链收口

完成：

- C3 全量专项；
- B3 全量真实浏览器联调；
- 历史反馈与 Profile 兼容；
- 旧主链、Production Build 和零写入证明；
- 工程与 Debug 验收报告。

## 十四、自动化 Debug 验收矩阵

### 14.1 Schema、身份与确定性

| 编号 | 验收项 |
| --- | --- |
| C3-01 | Schema / Expression Policy Version 独立固定 |
| C3-02 | 非法 Focus、Reason、Block 与 Action 被拒绝 |
| C3-03 | 投射缺少 Feedback 或 Source Ref 时校验失败 |
| C3-04 | 相同正式事实产生相同 Projection ID 与 Hash |
| C3-05 | Source Identity 或 Policy Version 变化产生新 Hash |
| C3-06 | 输出不包含答案、正文、完整 Diagnosis 或 Evidence ID |
| C3-07 | 投射前后 Attempt / Diagnosis / Evidence / Profile Digest 不变 |
| C3-08 | 投射器没有正式 Repository 写依赖 |

### 14.2 主要焦点选择

| 编号 | 验收项 |
| --- | --- |
| C3-09 | 全部必需项满足时选择真实确认，不制造缺口 |
| C3-10 | 显式 Primary Gap 保持为展示主焦点 |
| C3-11 | 唯一必需 Missing Requirement 可被确定性选择 |
| C3-12 | 多个不可排序缺口回退旧反馈，不猜测 |
| C3-13 | Partially Covered 不被改写为 Missing |
| C3-14 | 次要问题不覆盖正式主要缺口 |
| C3-15 | Insufficient 不被表达成学生能力不足 |
| C3-16 | 自由文本不能反向产生 Gap Code |

### 14.3 反馈表达

| 编号 | 验收项 |
| --- | --- |
| C3-17 | 最多一个完成点、一个缺口、一个下一步 |
| C3-18 | 三类信息不是固定必填三段 |
| C3-19 | 完全满足时允许只输出一句确认 |
| C3-20 | 下一步包含可定位对象和可执行动作 |
| C3-21 | 下一步不泄露结论、证据句或正确选项 |
| C3-22 | 不重复题目、训练目标或下一题调度理由 |
| C3-23 | 不出现内部能力、Evidence、Policy、Hash 与 Profile 术语 |
| C3-24 | 不出现与当前答案无关的模板化表扬 |
| C3-25 | 模型表达失败时确定性回退可用 |
| C3-26 | 回退反馈仍保持单焦点与操作一致 |

### 14.4 操作与条件能力一致性

| 编号 | 验收项 |
| --- | --- |
| C3-27 | 可修订反馈提供真实一次修订入口 |
| C3-28 | Revision 不允许时不出现修改要求 |
| C3-29 | 正确单选不出现开放文本修订建议 |
| C3-30 | 分析失败只提供现有安全重试 |
| C3-31 | 尚有正式题时继续动作指向准确下一题 |
| C3-32 | 题组完成时不伪造下一题 |
| C3-33 | Targeted / Retest / Transfer 不显示工程身份 |
| C3-34 | 阶段 3 不改变阶段 2 四能力触发结果 |

### 14.5 Revision 评价

| 编号 | 验收项 |
| --- | --- |
| C3-35 | Revision Improved 说明真实改善内容 |
| C3-36 | Partially Improved 只保留一个仍需注意点 |
| C3-37 | Not Improved 不贬低学生、不开放第三次修改 |
| C3-38 | Revision 反馈不覆盖首次回答或 Initial Evidence |
| C3-39 | Feedback-supported Improvement 不表达成独立掌握 |
| C3-40 | 评价不可用时说明保存状态并允许继续 |

### 14.6 Profile 只读投射

| 编号 | 验收项 |
| --- | --- |
| C3-41 | 四类 Ability Status 使用固定映射 |
| C3-42 | CoreAbilitySummary 只来自有效 StudentAbilityProfile |
| C3-43 | 单次失败、Revision 或 Targeted 不直接改变 Summary |
| C3-44 | 无 Evidence Link 时隐藏或标记 uncertain |
| C3-45 | 普通页面不显示 Confidence 小数和内部计数 |
| C3-46 | Summary 不被任何 Writer、Scheduler 或 Gate 读取 |
| C3-47 | Legacy Profile 无法安全映射时不阻断 Learning |
| C3-48 | 删除投射结果后正式 Profile 可完整恢复 |

阶段 3 自动化最低门槛：`48 / 48 PASS`。

## 十五、真实浏览器验收矩阵

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| B3-01 | 正确单选反馈 | 一句真实确认，直接进入真实下一题 |
| B3-02 | 错误单选反馈 | 说明当前误读方向和一个重新观察动作，不开放即时改选 |
| B3-03 | 开放题完全满足 | 不制造缺口和无意义建议 |
| B3-04 | 开放题部分满足 | 只突出一个主要缺口和一个动作 |
| B3-05 | 多个正式缺口 | 页面只显示正式主焦点，次要缺口不罗列 |
| B3-06 | Revision 推荐 | 反馈与“根据反馈修订”入口一致 |
| B3-07 | Revision 跳过 | 直接进入准确下一题，不显示解释性阻拦 |
| B3-08 | Revision 改善 | 说明具体变化，不显示第三次修改 |
| B3-09 | Revision 未改善 | 给出可复用方法并正常继续，不写独立掌握 |
| B3-10 | Feedback 分析失败 | 原位说明回答已保留，并提供安全重试 |
| B3-11 | 模型表达失败 | 自动回退确定性反馈，无空白页 |
| B3-12 | 历史结构化反馈 | 正常形成单焦点投射 |
| B3-13 | 历史自由文本反馈 | 保留旧展示，不猜测新 Gap |
| B3-14 | 尚有正式题 | 主操作显示准确下一题编号与总数 |
| B3-15 | 题组完成 | 使用完成出口，不解释 Scheduler |
| B3-16 | 有效 Profile | 只显示粗粒度能力概况，无伪精确数值 |
| B3-17 | Profile 证据不足 | 隐藏概况或显示证据不足，不制造弱项 |
| B3-18 | 刷新、重复打开与跨标签 | 投射稳定、无重复正式写入、控制台无错误 |

阶段 3 浏览器最低门槛：`18 / 18 PASS`。

## 十六、旧主链强制回归

至少回归：

- Product Complexity Convergence Stage 0—2；
- Material Resource Production P0—P7；
- Question Candidate Adoption / Publication / Recovery；
- Learning Queue、连续题组、题号和完成边界；
- Controlled Feedback、Student Thinking、Feedback Action；
- Single Choice Stage 1—4；
- Reading Open Response Input Load Stage 1—4；
- Reading Training Progressive Load Stage 0—4；
- Learning Feedback Revision Stage 1—4；
- Targeted Micro-training Stage 1—4；
- Delayed Retest、Retest Execution 与 Transfer；
- Phase 16.3 Real Learning Chain 与 Unified Entry；
- Evidence Admission、Profile Update 与 Calibration；
- IndexedDB、Outbox、重复提交、刷新和跨标签恢复；
- Production Build。

零回归快照至少比较：

- Formal Resource / Registry Digest；
- Session / Queue / Current Question Digest；
- Student Response / Attempt Digest；
- Diagnosis / Requirement Coverage Digest；
- Evidence / Profile / Calibration Digest；
- Revision / Targeted / Retest / Transfer Identity；
- Command 调用次数；
- Outbox Pending / Completed Identity。

## 十七、完成定义

阶段 3 只有同时满足以下条件才可标记 `ENGINEERING COMPLETE / DEBUG ACCEPTED`：

1. Feedback Projection 与 CoreAbilitySummary Schema、Validator、稳定身份完成；
2. 反馈焦点只从正式结构化事实中选择，不重算 Diagnosis；
3. 每次反馈最多一个完成点、一个主要缺口和一个下一步，但不机械输出三段；
4. 正确答案不制造缺口，错误与部分满足反馈不罗列多个问题；
5. 下一步动作具体、可执行、不泄露答案且与真实操作一致；
6. Controlled Model 失败时确定性回退可用；
7. Revision 评价不开放第三次修改，不把支持下改善写成独立掌握；
8. CoreAbilitySummary 只读映射现有 Profile，不形成第二套状态或写入链；
9. 历史结构化反馈、自由文本反馈和历史 Profile 均有安全兼容路径；
10. Feature Flag 可回退 Legacy，且回退不修改正式事实；
11. 普通页面没有内部术语、伪精确数值和调度解释；
12. `C3-01—C3-48` 为 `48 / 48 PASS`；
13. `B3-01—B3-18` 为 `18 / 18 PASS`；
14. 旧主链专项回归与 Production Build 通过；
15. 正式资源、Attempt、Diagnosis、Evidence、Profile 与 Calibration 无非预期写入；
16. 验收报告明确区分 Fixture、浏览器体验和真实教育效果；
17. 未提前执行阶段 4 的真实收益观察或能力退役决策。

## 十八、进入阶段 4 的边界

阶段 3 完成后，阶段 4 才允许：

- 运行 2—4 周真实封闭试用；
- 观察反馈一次理解率、Revision 触发与完成、条件能力后续独立改善；
- 比较触发率、完成率、中断率、真实收益与维护成本；
- 对低价值能力提出保留、默认关闭或退役建议。

阶段 4 仍不得：

- 用一次学生表现证明教育效果；
- 以 Fixture 或浏览器验收冒充真实数据；
- 自动删除正式能力或历史事实；
- 因展示效果较好而放宽 Evidence 与 Profile 边界。

## 十九、冻结声明

`product_complexity_convergence_stage3_feedback_profile_projection_v1` 冻结以下事实：

1. 阶段 3 是反馈与 Profile 投射收口，不是新的 Diagnosis、Evidence 或 Profile 系统；
2. 反馈可以选择一个正式焦点，但不得重算或改写正式结论；
3. 三类反馈信息是上限，不是固定模板；
4. 正确答案允许只显示一句真实确认；
5. 下一步动作必须具体、可执行、不泄露答案并与真实 Runtime 操作一致；
6. 表达模型只改善措辞，失败时必须确定性回退；
7. CoreAbilitySummary 是现有 Profile 的可删除只读投射；
8. 历史自由文本不反推新的 Gap，历史 Profile 不批量补写；
9. 阶段 3 失败不得阻断核心学习链；
10. 每个阶段必须证明旧主链零回归，新语义只在本阶段授权边界内生效。

阶段 3 已完成工程开发与验收。`C3-01—C3-48` 为 `48 / 48 PASS`，`B3-01—B3-18` 为 `18 / 18 PASS`，旧主链专项回归 `405 / 405 PASS`，Production Build PASS；正式资源、Attempt、Evidence、Profile 与真实校准分母写入均为 `0`。本结论只证明工程边界与浏览器体验满足契约，不等于已完成阶段 4 的真实教育效果验证。
