# 学习缺口模型（Learning Gap Model）

**Status:** MODEL ACCEPTED / LIGHTWEIGHT DERIVED RUNTIME IMPLEMENTED

## 文档定位

本文档定义系统如何描述学生当前有效表现与明确任务要求之间的、可观察、可验证、可干预的能力动作缺口。

Learning Gap 不判断学生“能力好坏”，也不形成长期能力标签。

它只回答：

> 相对于当前任务要求，学生下一步最需要补充、修正或验证哪个能力动作？

本模型属于 Knowledge Layer。当前工程已通过 `TaskRequirementCoverage`、`StudentFeedbackGrounding`、`StudentThinkingAnalysis` 和 `StudentFeedbackActionPlan` 形成轻量确定性派生链路，但尚未将 `LearningGapAssessment` 建立为独立持久化对象。

## 一、为什么需要 Learning Gap

现有核心模型分别回答：

| 模型 | 回答的问题 |
| --- | --- |
| Ability Model | 系统培养什么能力？ |
| Question Model / Metadata | 当前任务要求学生完成什么？ |
| Diagnosis Model | 学生本次表现怎样，当前证据支持哪些根因假设？ |
| Ability Evidence Contract | 本次表现如何成为可累计证据？ |
| Training Model | 下一步如何组织训练、验证或迁移？ |

系统仍需要一层统一语言，把不同题目中的 Rubric 缺失、作答问题和反馈缺口转换为稳定、可追溯的“能力动作缺口”。

例如：

```text
任务要求
结合人物动作推断人物心理并说明理由

学生表现
父亲很爱我

Learning Gap
当前回答缺少文本动作证据，以及证据如何支持“父亲爱我”的解释关系

Root Cause
尚未确认：可能没有找到证据，也可能已经理解但没有写出

候选行动
先要求学生指出一个具体动作，再说明该动作与已有判断的关系
```

Learning Gap 连接“表现”与“干预”，但不替代 Diagnosis、Root Cause、Evidence、Evaluation 或 Training Strategy。

## 二、基本定义

```text
Learning Gap
=
学生当前可观察表现
与
任务要求的关键能力动作
之间的差距
```

一项正式 Learning Gap 必须同时满足：

1. **可观察**：能够从有效作答、修正、提示依赖、复测或迁移表现中定位；
2. **可追溯**：能够引用具体任务要求、Rubric Item 和表现依据；
3. **可验证**：能够通过追问、修正、诊断性任务、复测或迁移继续确认；
4. **可干预**：能够支持明确的反馈、验证或教学行动；
5. **有边界**：只描述当前表现，不扩展为性格、智力或长期能力结论。

Learning Gap 不要求每次都直接进入训练。有些缺口更适合先补充作答、进行诊断验证、独立复测、继续观察或人工复核。

## 三、核心边界

### 3.1 Gap 不等于 Ability

```text
一次回答缺少文本依据
不等于
学生的信息提取或推理能力长期薄弱
```

推荐表达：

> 当前回答已经写出人物心理，但还没有提供支持该判断的文本动作或语句，需要进一步验证学生是没有找到依据，还是没有把依据写出来。

禁止表达：

> 学生推理能力差。

### 3.2 Gap 不等于 Root Cause

Learning Gap 描述“缺少了什么能力动作”。

Root Cause Hypothesis 描述“为什么可能缺少这个动作”。

例如：

| 对象 | 内容 |
| --- | --- |
| Observable Performance | 写出了“父亲爱我” |
| Learning Gap | 缺少文本证据 |
| Root Cause Hypothesis A | 可能没有找到关键动作 |
| Root Cause Hypothesis B | 可能找到了，但没有外显到答案中 |
| Verification | 请指出文中哪个动作支持这一判断 |

Learning Gap 不得为了产生确定结论而自行选择 Root Cause。

### 3.3 Gap 不等于 Training Strategy

Learning Gap 可以提供 `candidateAction`，但不能直接决定具体训练题。

最终行动仍需结合：

- Root Cause 是否得到支持；
- 当前 Evidence 与 Evaluation Result；
- Student Ability Profile；
- 最近训练和提示依赖；
- 当前适合训练、验证、复测还是观察；
- 可用正式资源。

### 3.4 Gap 不等于 Ability Evidence

Learning Gap 是本次任务相对缺口的结构化解释。

是否生成 Ability Evidence，还必须经过：

- Answer Validity；
- Diagnosis 质量与身份校验；
- Evidence Extractor；
- aggregation eligibility；
- evidenceLinks 完整性检查。

无效答案不能生成具体 Learning Gap，也不能形成 weakness Evidence。

### 3.5 Gap 不直接更新长期状态

Learning Gap 不进入 Student Profile，不修改 GrowthMemory，不宣布能力提升、退化、稳定或薄弱。

长期状态仍必须遵循：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

## 四、前置条件与结果分支

Learning Gap Assessment 必须在以下条件成立后执行：

- 学生回答通过 Answer Validity Gate；
- Question Metadata 与版本身份有效；
- 任务具有明确的 target ability、task role 和最低作答要求；
- Rubric 或 Task Requirement 足以说明需要观察的能力动作；
- DiagnosisResult 已形成可追溯的 observed signals。

建议采用结果分支：

```ts
type LearningGapAssessmentResult =
  | {
      status: 'identified';
      primaryGap: LearningGap;
      secondaryGaps: LearningGap[];
    }
  | {
      status: 'no_gap_observed';
      evidenceLinks: string[];
      limitations: string[];
    }
  | {
      status: 'cannot_assess';
      reason:
        | 'invalid_response'
        | 'insufficient_response'
        | 'metadata_incomplete'
        | 'rubric_incomplete'
        | 'identity_mismatch'
        | 'diagnosis_blocked';
      nextAction: 'supplement_response' | 'human_review' | 'stop';
      evidenceLinks: string[];
    };
```

`cannot_assess` 不是 Learning Gap 类型，不得转换成某项能力缺口。

## 五、Gap Scope

### 5.1 Current Response Gap

`current_response` 描述当前有效作答相对于本次任务要求缺少的能力动作。

例如：

- 未回应题目限定对象；
- 漏掉关键条件；
- 缺少文本依据；
- 没有说明证据与结论的关系；
- 概括停留在细节罗列；
- 已有理解没有被清晰组织表达。

Current Response Gap 不需要长期历史，但必须有当前任务和当前答案依据。

### 5.2 Cross-task Gap

`cross_task` 描述跨任务比较后出现的、需要继续验证的缺口。

例如：

- 在训练题中完成，但在新材料中不能独立使用同一方法；
- 即时复测表现较好，延迟复测中同类能力动作再次缺失；
- 多次在不同材料中出现同一任务动作断裂。

Cross-task Gap 必须引用：

- 可比较的 baseline Evidence；
- 当前 Evidence；
- taskRole 与材料关系；
- 提示依赖；
- Evaluation Result 或正式比较结果。

单次答案不得生成“迁移失败”“保持失败”或“长期不稳定”结论。

## 六、Gap 分类视角

第一版按能力动作过程分类，不按学科题型直接分类：

| Category | 说明 |
| --- | --- |
| `task_alignment` | 是否理解并回应当前任务要求 |
| `information_access` | 是否找到完成任务所需的关键信息 |
| `information_organization` | 是否筛选、合并和组织已获得的信息 |
| `reasoning_relation` | 是否建立证据、解释与结论之间的关系 |
| `expression_externalization` | 是否将已经形成的理解完整、准确地外显 |
| `cross_task_transfer` | 是否能在可比较的新任务中独立使用同类能力动作 |

这些 Category 是分类视角，不是固定认知流水线。

它们可以并行、回退或相互影响。后一类问题不自动证明前一类能力已经完成，前置能力也不得仅因位于常见路径前方就被认定为 Root Cause。

## 七、V0.1 Gap Taxonomy

V0.1 只冻结七类单题 Gap。分类数量保持克制，优先保证边界清晰和可验证。

### `LG01_TASK_REQUIREMENT_MISALIGNED`

**名称：** 作答目标偏离

**定义：** 学生提供了有效语义内容，但没有回应题目指定的对象、范围、关系或作答动作。

**可观察表现：**

- 题目要求分析人物心理，答案只复述事件；
- 题目要求结合文本，答案只提供生活经验；
- 题目要求概括原因，答案只写结果。

**不足以形成该 Gap：**

- 空答案或无效输入；
- 题干本身含糊；
- Metadata 缺少明确任务要求。

**候选验证：** 要求学生用自己的话说明题目要完成什么。

**候选行动：** `diagnostic_verification` 或 `supplement_response`。

### `LG02_CONCLUSION_REVISION_REQUIRED`

**名称：** 当前结论需要调整

**定义：** 学生已经回应任务并给出明确结论，但正式 Diagnosis 有充分材料事实支持该结论与当前任务对象、文本事实或 Rubric 核心要求不一致。

**可观察表现：**

- 对人物心理、事件原因或句子含义形成了与材料事实冲突的判断；
- 使用了与文本对象不一致的结论；
- 已经提供依据，但依据不能支持当前结论。

**严格边界：**

- 只有正式 Diagnosis 明确支持 `conclusion_inconsistent` 时才能使用；
- 缺少文本证据不等于结论错误；
- 合理的不同表达、开放题多解和参考答案未枚举内容不得被标记为该 Gap；
- 结论不确定时应保持 `needs_verification`，不能为了生成反馈强行判错。

**候选验证：** 回到材料事实，比较“当前结论解释了什么”和“材料实际呈现了什么”。

**候选行动：** `diagnostic_verification` 或引导学生保留已找到的有效事实并重新形成结论。

### `LG03_KEY_INFORMATION_MISSING`

**名称：** 关键信息遗漏

**定义：** 学生回应了任务方向，但遗漏完成当前要求所必需的关键条件、对象、事实或限定信息。

**可观察表现：**

- 只关注局部细节；
- 忽略转折、范围或限定条件；
- 概括中缺少决定主题或事件结果的关键信息。

**易混淆边界：**

- “没有引用文本”不一定是信息遗漏，可能属于 `LG04`；
- “找到了多个事实但没有组织”更接近 `LG06` 或 `LG05`；
- 是否因为没有找到信息，属于 Root Cause，不能由 Gap 自动确认。

**候选验证：** 让学生圈出完成题目必需的条件或关键句。

**候选行动：** `diagnostic_verification` 或聚焦式信息提取训练。

### `LG04_TEXT_EVIDENCE_MISSING`

**名称：** 文本证据缺失

**定义：** 学生已经给出与任务相关的判断或结论，但没有提供题目要求的文本动作、语句、事实或细节作为支撑。

**可观察表现：**

```text
父亲很爱我。
```

答案给出了人物心理或形象判断，但没有说明该判断来自哪个具体行为。

**正向对照：**

```text
父亲身体不便仍坚持为我买橘子，这个动作表现出他对孩子的关心。
```

**易混淆边界：**

- 学生是否已经在头脑中找到证据仍然未知；
- 不得直接归因为信息提取能力不足；
- 找到证据但没有解释关系时，还可能同时出现 `LG05`。

**候选验证：** 请指出文中哪个动作或语句支持已有判断。

**候选行动：** `supplement_response` 或 `diagnostic_verification`。

### `LG05_REASONING_RELATION_MISSING`

**名称：** 证据与结论关系缺失

**定义：** 学生已经提供相关事实或文本证据，也给出了结论，但没有说明该证据为什么能够支持结论。

**可观察表现：**

```text
父亲蹒跚地走过去。父亲很伟大。
```

事实和结论同时出现，但中间的解释关系没有建立或没有外显。

**正向对照：**

```text
父亲行动已经很困难，却仍亲自去买橘子，说明他把照顾孩子放在自己的不便之前。
```

**易混淆边界：**

- 如果没有任何证据，优先使用 `LG04`；
- 如果关系已经成立但语言顺序不清，可能属于 `LG07`；
- “不会推理”不能作为该 Gap 的展示名称或长期结论。

**候选验证：** 追问“这个动作为什么能说明你的判断？”

**候选行动：** `supplement_response`、`diagnostic_verification` 或关系解释训练。

### `LG06_SUMMARY_LEVEL_MISALIGNED`

**名称：** 概括层级不当

**定义：** 学生已经提取多个相关信息，但没有按照任务要求完成筛选、合并、抽象或层级控制。

**可观察表现：**

- 用细节罗列代替主要内容；
- 只写过度抽象的主题，不保留必要事件；
- 只写局部内容，未覆盖核心结构；
- 把人物评价代替事件概括。

**易混淆边界：**

- 缺少关键事实可能属于 `LG03`；
- 已形成合理概括但句子组织混乱，可能属于 `LG07`；
- 主旨、情感或观点的深层提炼可能同时涉及理解、分析或推理，不能全部归入概括能力。

**候选验证：** 要求学生区分“必须保留的信息”和“可以删除的细节”。

**候选行动：** 信息筛选、要点合并或概括层级训练。

### `LG07_EXPRESSION_ORGANIZATION_INCOMPLETE`

**名称：** 表达组织不完整

**定义：** 已有证据表明学生形成了相关理解、分析或推理结果，但答案没有完整、准确、有序地外显这些内容。

**可观察表现：**

- 已在追问中说出理由，但正式答案遗漏；
- 要点存在但顺序混乱、关系不清；
- 指代不明导致已有结论无法被准确理解；
- 修正时能够补全，首次答案未完成组织。

**严格边界：**

只有当学生已经表现出相应理解、分析或推理结果时，才优先形成表达组织 Gap。

如果当前证据无法区分“没有理解”与“理解但没有写出”，应标记需要验证，不能把表达作为兜底原因。

**候选验证：** 让学生口头解释或按“结论—依据—说明”重新组织答案。

**候选行动：** `diagnostic_verification` 或结构化表达训练。

## 八、暂不冻结的候选 Gap

以下候选需要跨任务或更充分 Evidence，V0.1 不作为单次 Diagnosis 的固定 Gap：

| Candidate | 暂缓原因 |
| --- | --- |
| `KEYWORD_DEPENDENCY` | 需要证明学生反复依赖词语表面匹配，而不是一次合理使用关键词 |
| `CAUSAL_CHAIN_BREAK` | 可先由 `LG05` 表达，待真实案例证明需要独立拆分 |
| `VIEWPOINT_NOT_EXPANDED` | 与证据缺失、关系缺失和表达组织存在重叠 |
| `TRANSFER_NOT_DEMONSTRATED` | 必须具有正式基线、可比较任务和独立表现 |
| `RETENTION_NOT_DEMONSTRATED` | 必须由延迟复测与 Evaluation 支持 |

候选 Gap 只有在真实 Evaluation Case Set 中形成稳定、互斥、可验证边界后才能进入正式 Taxonomy。

## 九、建议结构

```ts
type LearningGapCode =
  | 'LG01_TASK_REQUIREMENT_MISALIGNED'
  | 'LG02_CONCLUSION_REVISION_REQUIRED'
  | 'LG03_KEY_INFORMATION_MISSING'
  | 'LG04_TEXT_EVIDENCE_MISSING'
  | 'LG05_REASONING_RELATION_MISSING'
  | 'LG06_SUMMARY_LEVEL_MISALIGNED'
  | 'LG07_EXPRESSION_ORGANIZATION_INCOMPLETE';

type LearningGap = {
  learningGapId: string;
  studentId: string;
  taskId: string;
  diagnosisResultId: string;

  scope: 'current_response' | 'cross_task';
  gapCode: LearningGapCode;
  category:
    | 'task_alignment'
    | 'information_access'
    | 'information_organization'
    | 'reasoning_relation'
    | 'expression_externalization'
    | 'cross_task_transfer';

  targetAbilityId: PrimaryAbilityId;
  observation: string;

  taskRequirementIds: string[];
  rubricItemIds: string[];
  evidenceLinks: string[];

  verificationStatus:
    | 'observed'
    | 'needs_verification'
    | 'supported';

  gapConfidence: number;
  verificationNeed?: string;
  candidateActions: (
    | 'supplement_response'
    | 'diagnostic_verification'
    | 'training'
    | 'retest'
    | 'transfer_test'
    | 'observe'
    | 'human_review'
  )[];

  rootCauseReference?: {
    status: 'unresolved' | 'hypothesis' | 'supported' | 'confirmed';
    diagnosisResultId: string;
  };

  comparisonEvidenceIds?: string[];
  limitations: string[];
  createdAt: string;
};
```

字段语义：

- `targetAbilityId` 表示本题主要观察的能力，不表示该能力长期薄弱；
- `gapConfidence` 表示当前证据支持这项任务相对缺口的可靠程度，不表示长期能力置信度；
- `rootCauseReference` 只引用 Diagnosis 已形成的根因状态，不在 Learning Gap 中重新归因；
- `candidateActions` 是候选行动，不是最终 TaskRequest；
- `comparisonEvidenceIds` 只用于合法的跨任务 Gap；
- `evidenceLinks` 必须能够回到学生答案、Rubric、Task Requirement 或正式比较结果。

## 十、主缺口选择

一次作答可能暴露多个 Gap，但学生反馈和当前干预应保持聚焦。

主缺口选择顺序：

1. 优先选择当前任务的 critical / required requirement；
2. 优先选择阻断后续任务动作的缺口；
3. 优先选择证据更充分、可立即验证或修正的缺口；
4. 不用不确定的 Root Cause 替代可观察 Gap；
5. 同等条件下优先选择更小、可执行的能力动作；
6. 其余缺口作为 `secondaryGaps` 保留，不同时展示给学生。

主缺口只表示当前干预优先级，不表示长期最弱能力。

## 十一、与当前工程的兼容映射

当前工程已经存在：

- `TaskRequirementCoverage`；
- `primaryGapRequirementId`；
- `primaryGap`；
- `TaskRequirementGapReasonCode`；
- `nextActionText`。

V0.1 建议兼容映射：

| 当前 `gapReasonCode` | Learning Gap 兼容方向 |
| --- | --- |
| `missing_text_evidence` | `LG04_TEXT_EVIDENCE_MISSING` |
| `missing_reasoning_relation` | `LG05_REASONING_RELATION_MISSING` |
| `conclusion_inconsistent` | 只有正式 Diagnosis 明确支持时映射为 `LG02_CONCLUSION_REVISION_REQUIRED`，不得由参考答案差异或缺少证据自动生成 |
| `incomplete_task_requirement` | 根据正式 Requirement / Rubric 映射到 `LG01 / LG03 / LG06 / LG07`，不得只靠文案猜测 |
| `insufficient_to_judge` | 不生成具体 Learning Gap，返回 `cannot_assess` 或补充作答需求 |

兼容阶段不得为了生成 Gap 修改现有正式 Diagnosis、Ability Evidence 或学生反馈事实。

新模型首先用于统一语义、Evaluation Case 和后续 Contract 设计；独立 Schema、Agent、Repository 或持久化需要由后续 Phase 明确立项。

### 当前反馈侧只读投影

`Student Learning Narrative Calibration v1.1` 已新增只读 `StudentFeedbackGrounding` 契约。它从现有 `TaskRequirementCoverage / primaryGapRequirementId / gapReasonCode` 投影：

- 有学生答案依据的已完成动作；
- 当前唯一主要缺口及其兼容 `Learning Gap Code`；
- 与该缺口绑定的可执行修改动作；
- Requirement、Learning Round 和学生作答证据的内部来源链接。

该投影只服务当前学生反馈，不持久化为长期 Learning Gap，不修改正式 Diagnosis、Ability Evidence、Evaluation 或 Student Profile。`insufficient_to_judge` 只产生 `cannot_assess / needs_verification`，不得映射为具体 Gap。

### Feedback Action Plan 当前实现

`StudentFeedbackActionPlan` 已作为确定性反馈行动转换层接入学生 Narrative：

```text
TaskRequirementCoverage
+ StudentFeedbackGrounding
+ 当前反馈状态
↓
StudentFeedbackActionPlan
↓
Student Learning Narrative
```

它将当前唯一主要 Gap 转换为：

- 学生已经完成的具体答案动作；
- 当前缺少的答案组成部分；
- 下一步可以直接执行的修改动作；
- 在允许的反馈深度下使用的句式支架；
- 与 Requirement、Gap 和当前 Round 对齐的 `evidenceLinks`。

该层不重新执行 Diagnosis，不生成新的 Learning Gap，也不修改 Ability Evidence。Narrative Agent 只能表达已经通过 Action Plan 校验的内容，不得自行补造材料依据、学生观点或教学结论。

反馈深度必须保持克制：无效作答只请求重新完成有效回答；需要复核的结果不提供完整修复路径；正式结果可以提供区块级修改步骤，但默认只使用材料位置或释义提示，不直接泄露参考答案。

## 十二、与 Phase 17 的关系

Phase 17 建立：

```text
Material
-> Observation Dimension
-> Ability Action
-> Question Resource / Rubric
```

Learning Gap 衔接学生表现：

```text
Material
-> Observation Dimension
-> Ability Action
-> Question Resource / Rubric
-> Student Response
-> DiagnosisResult
-> LearningGapAssessment
-> Verification / Training Candidate
```

边界如下：

- Observation Dimension 描述材料的观察侧面；
- Ability Action 描述学生需要执行的认知活动；
- Learning Gap 描述当前表现相对于该活动缺少什么；
- Resource Observation Link 不是学生 Evidence；
- Material 标签不能直接生成 Learning Gap；
- Learning Gap 不进入 Phase 17 Coverage denominator；
- Resource Matching 不得根据未确认 Gap 静默放宽能力、角色或难度约束。

## 十三、模型关系

```text
Question Metadata / Rubric
+ Student Response
↓
Response Validity
├─ invalid -> cannot_assess / supplement response
└─ valid
   ↓
DiagnosisResult
├─ RootCauseHypothesis（Diagnosis 已有输出，可为 unresolved）
├─ LearningGapAssessment
│  ├─ 当前缺少的能力动作
│  ├─ 验证需求
│  └─ 候选行动
└─ Evidence Proposal
   ↓
AbilityEvidenceExtractor
   ↓
AbilityEvidence
   ↓
Evaluation / Profile / Strategy
```

Learning Gap 与 Evidence Proposal 是对同一正式 Diagnosis 的不同消费方向，不构成彼此的强制上下游。这里不是要求每个 Session 必须经过所有步骤，也不表示 Learning Gap 可以绕过 Evidence 与 Evaluation 修改长期状态。

## 十四、底层约束

Learning Gap Model 定义能力动作缺口，不创造教育事实。

它只能：

- 比较学生有效表现与正式任务要求；
- 描述缺失、偏离或未完成的可观察能力动作；
- 引用 Task Requirement、Rubric 和 evidenceLinks；
- 标记是否需要进一步验证；
- 提供候选反馈、验证或教学行动。

它不得：

- 从空答案、纯数字、敷衍回答或无关内容推断具体 Gap；
- 把 missing rubric 自动写成能力短板；
- 把 Gap 当作 Root Cause；
- 把单次 Gap 写入 Student Profile；
- 把 Gap 数量当作能力水平；
- 把表达能力作为无法定位问题时的兜底标签；
- 根据能力依赖图机械追溯前置根因；
- 根据单次作答判断迁移失败或长期不稳定；
- 直接生成具体训练题；
- 给学生使用“你不擅长、你总是、能力差”等固定标签。

## 十五、最小验收案例

后续若进入工程实现，至少应覆盖：

1. 空答案、纯数字、敷衍回答 -> `cannot_assess`，不生成 Gap；
2. 写出人物心理但无依据 -> `LG04`；
3. 写出依据和结论但未说明关系 -> `LG05`；
4. 只复述事件、未回答人物心理 -> `LG01`；
5. 结论与材料事实明确冲突 -> 只有正式 Diagnosis 支持时生成 `LG02`；
6. 概括罗列大量细节、未提炼核心 -> `LG06`；
7. 已在追问中体现理解但正式答案组织不完整 -> `LG07`；
8. 无法区分信息提取与表达问题 -> Gap 可识别，Root Cause 保持 `unresolved`；
9. 单次新题失败 -> 不生成 Transfer Gap；
10. 合法跨任务比较显示方法未迁移 -> 可形成 `cross_task` Gap，但不直接修改 Profile；
11. Learning Gap 与 Task Requirement、Rubric、DiagnosisResult、evidenceLinks 身份一致；
12. candidateAction 不直接变成 TaskRequest；
13. 学生端只展示当前主缺口，不展示内部 Gap ID、置信度或 Root Cause 候选。

## 十六、当前状态与下一步

当前已完成：

- Learning Gap 的上位语义与职责边界；
- V0.1 七类单题 Gap Taxonomy；
- Current Response 与 Cross-task Scope 区分；
- 与现有反馈字段的兼容映射；
- 与 Phase 17 Material Observation 的关系；
- 最小验收案例。

当前尚未完成：

- 独立 `LearningGapAssessment` Schema；
- Learning Gap Agent / Runtime；
- 独立 Repository 或持久化；
- 真实学生 Gap Taxonomy 校准；
- Learning Gap Evaluation Case Set；
- 与 Strategy、TaskRequest 的正式工程接入。

下一步应先用真实题目与学生回答验证七类 Gap 是否稳定、互斥且可干预，再决定是否建立独立工程对象。不得因为文档已经建立，就宣称 Learning Gap Runtime 已实现。

## 十七、准确能力声明

本模型建立后可以宣称：

> 系统已经定义一种克制、可追溯的学习缺口语言，用于描述学生当前有效表现与正式任务要求之间缺少的能力动作，并能区分任务缺口、根因假设、长期能力状态和下一步教学策略。

仍不能宣称：

- 系统已经自动识别所有 Learning Gap；
- 七类 Gap 已经过真实学生长期验证；
- Gap 已独立进入 Evidence、Profile 或 GrowthMemory；
- 单次 Gap 可以证明学生能力薄弱；
- Gap 已经能够自动决定最有效的训练任务。
