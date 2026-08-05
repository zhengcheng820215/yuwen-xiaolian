# Phase 17 AI 资源生成与优化工作流契约

英文名称：AI Resource Generation and Optimization Workflow Contract

状态：DESIGN FROZEN / P0 ACCEPTED
契约版本：`ai_resource_generation_and_optimization_workflow_contract_v1`  
更新日期：2026-08-05

产品确认日期：2026-08-05
产品确认结论：同意以不可变 `QuestionCandidate` 作为 AI 生成、重新生成、优化和异常纠错的统一承载对象；只有采用 Candidate 才进入 Question Revision、检查、确认和发布链。P1 只建设 Candidate 基础能力，不删除现有 Working Draft，不接入正式 Revision 创建，不改动已发布资源读取链路。

## 一、目的

本文定义统一资源生产工作台中 AI 生成、重新生成、优化、采用和异常纠错的职责边界。

本契约的目标不是把现有题库编辑器更换一组按钮，而是把标准生产模式冻结为：

```text
AI 提出不可变候选
-> 人判断方向与质量
-> 人采用候选
-> 系统创建正式题目版本
-> 检查、确认和发布
```

标准流程中：

1. AI 负责生成和优化资源候选；
2. 人负责选择、判断并提供结构化优化方向；
3. 人不直接编辑标准生产流程中的正式资源字段；
4. Candidate 不属于正式资源链；
5. 只有采用 Candidate 才能创建 `QuestionDraft Revision`；
6. 系统保留权限受控、强审计的异常纠错入口，但该入口不属于常规生产流程。

本文不替代以下既有契约：

- [统一资源生产工作台契约](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md)；
- [录入字段契约](./AUTHORING_FIELD_CONTRACT.md)；
- [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md)；
- [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)。

本文只重新定义“正式 Question Revision 产生之前”的 AI 生产和人工决策过程。

## 二、生产模型

### 2.1 标准流程

```text
Material
-> Observation Plan
-> TrainingTask
-> AI 生成 Candidate
-> 人工判断
   -> 方向错误：重新生成 Candidate
   -> 细节不足：优化 Candidate
   -> 满意：采用 Candidate
-> QuestionLineage
-> QuestionDraft Revision
-> Validation
-> Assessment
-> Human Review
-> Freeze
-> Formal Resource
-> Registry
```

人工主要负责选择候选、判断候选是否符合训练意图、提供结构化优化目标，并决定候选是否进入正式版本链。

### 2.2 异常流程

以下内容可以进入异常纠错入口：

1. 明确错别字；
2. 专有名词错误；
3. 版权或来源信息错误；
4. 必须人工指定的固定表达；
5. AI 无法可靠修正且继续生成成本明显不合理的特殊问题。

异常纠错不得成为默认入口，不得用于日常题目改写、训练方向调整或 Rubric 重构。

### 2.3 标准能力边界

标准生产流程不提供：

- 字段级人工编辑；
- 人工逐字维护题目；
- 依赖编辑模式的 `dirty / saving / saved / editing` 生命周期；
- 把 AI 结果先写入工作草稿、再由人长期维护的 CMS 式生产方式。

标准生产流程提供：

- AI 生成；
- AI 重新生成；
- AI 局部优化；
- 候选比较；
- 人工采用或放弃；
- 权限受控的异常纠错。

## 三、身份与关系

### 3.1 领域对象的唯一职责

| 对象 | 唯一职责 |
| --- | --- |
| `Material` | 提供学习材料及版本化内容 |
| `Observation Plan` | 定义材料上的训练规划和覆盖约束 |
| `TrainingTask` | 定义一个稳定的训练意图 |
| `QuestionCandidate` | 表达 AI 针对训练意图提出的不可变候选方案 |
| `QuestionLineage` | 表达正式题目的稳定身份 |
| `QuestionDraft Revision` | 表达正式题目身份下的一次不可变内容版本 |
| `Formal Resource Version` | 表达冻结发布后的正式资源版本 |

关系冻结为：

```text
TrainingTask
  └─ QuestionCandidate 1..N
       └─ Adopt
            └─ QuestionLineage
                 └─ QuestionDraft Revision 1..N
```

`QuestionCandidate` 不是 `TrainingTask`，不是 `QuestionDraft`，也不是 `QuestionDraft Revision`。

### 3.2 首次采用

当 TrainingTask 尚无正式题目身份时：

```text
Candidate B
-> Adopt
-> 创建 QuestionLineage
-> 创建 QuestionDraft
-> 创建 QuestionDraft Revision 1
```

### 3.3 已有题目的再次优化

```text
QuestionDraft Revision 3
-> OptimizationCandidate
-> Adopt
-> 同一 QuestionLineage 下创建 Revision 4
```

已存在的 Revision 3、Assessment、Human Review 和 Formal Resource 继续保留，不允许原地覆盖。

## 四、Candidate 契约

### 4.1 最小数据结构

```ts
type QuestionCandidate = {
  candidateId: string;
  trainingTaskId: string;
  candidateType: 'initial' | 'regenerated' | 'optimized' | 'exception_corrected';

  basedOnCandidateId?: string;
  basedOnDraftId?: string;
  basedOnRevision?: number;
  basedOnContentHash?: string;

  content: QuestionEditableContent;
  contentHash: string;

  generationReason: string;
  changedFields: AuthoringFieldKey[];
  allowedFields: AuthoringFieldKey[];
  lockedFields: AuthoringFieldKey[];

  generationContext: CandidateGenerationContext;
  status: 'ready' | 'adopted' | 'rejected' | 'expired' | 'superseded';

  createdAt: string;
  adoptedAt?: string;
};
```

### 4.2 生成上下文

```ts
type CandidateGenerationContext = {
  modelId: string;
  promptVersion: string;
  promptHash: string;
  ruleVersion: string;
  materialVersionId: string;
  observationPlanVersion: number;
  trainingTaskVersion: number;
  generatedAt: string;
};
```

默认不保存完整 Prompt 明文。工程侧使用 `promptVersion + promptHash` 完成问题追溯。

### 4.3 不可变与失效规则

Candidate 创建后不可修改：

1. AI 再生成必须创建新的 Candidate；
2. AI 优化必须创建新的 Candidate；
3. 异常纠错必须创建 `exception_corrected` Candidate；
4. 放弃候选只修改状态，不删除候选内容；
5. 采用候选只记录采用结果，不把 Candidate 转换为可变 Draft；
6. Material、Plan、TrainingTask 或基础 Revision 已变化时，旧 Candidate 必须标记为 `expired`，不得继续采用。

新的重新生成结果创建后，旧候选可以标记为 `superseded`，但不得物理删除。

### 4.4 Candidate 不进入正式链

Candidate 不产生 Question Revision、Validation、Assessment、Human Review、Freeze、Formal Resource 或 Registry Entry。

Candidate 可以执行 AI 自检，但 AI 自检结果只用于候选选择，不能伪装为正式 Assessment。

## 五、人机职责边界

### 5.1 AI 负责

AI 根据 Material Version、Observation Plan、TrainingTask、能力目标、适用学段、训练重点、材料范围和规则版本生成候选。

候选可以包含具体训练点、题目、学生任务、观察目标、Rubric、Answer Acceptance 和设计依据。

### 5.2 人负责

人工负责判断候选是否符合训练目标、材料切入和难度方向，并通过受控选项提供优化方向：

```text
表达：减少歧义 / 压缩题干 / 明确指代
能力：强化提取 / 强化理解 / 强化推理 / 强化表达
难度：降低难度 / 提升挑战
评分：优化 Rubric / 明确答案范围
```

自由文本只用于补充说明，不得绕过受控字段和锁定规则。

### 5.3 决策记录

```ts
type CandidateDecisionEvent = {
  eventId: string;
  candidateId: string;
  trainingTaskId: string;
  decision: 'adopted' | 'rejected' | 'regenerated' | 'optimized';
  reasonCodes: string[];
  note?: string;
  decidedBy: string;
  decidedAt: string;
};
```

结构化决策记录用于分析常见拒绝原因、有效优化目标、Prompt 或规则版本质量，以及采用后的检查通过率。

## 六、生成、重新生成和优化

### 6.1 初次生成

```ts
generateTaskCandidates({
  trainingTaskId,
  expectedMaterialVersionId,
  expectedPlanVersion,
  count,
  idempotencyKey,
})
```

输出一至多个 `initial` Candidate。生成成功不改变正式题目状态。

### 6.2 重新生成

适用于能力方向、题型、材料切入或难度方向错误：

```ts
regenerateTaskCandidates({
  trainingTaskId,
  baseCandidateId,
  reasonCodes,
  goals,
  count,
  idempotencyKey,
})
```

重新生成不会覆盖基础 Candidate，也不会影响已存在的 Question Revision。

### 6.3 AI 局部优化

适用于方向正确，但表达、难度或评分细节不足：

```ts
optimizeTaskCandidate({
  trainingTaskId,
  baseCandidateId,
  basedOnDraftId,
  basedOnRevision,
  goals: ['reduce_ambiguity', 'clarify_answer_scope'],
  allowedFields: ['questionStem', 'answerAcceptance'],
  lockedFields: ['abilityTarget', 'materialScope'],
  idempotencyKey,
})
```

优化结果必须提供预览、修改字段、前后差异、优化原因和锁定字段自检结果。

未经授权的字段不得改变。若 AI 输出改变锁定字段，该 Candidate 生成失败，不得展示为可采用结果。

## 七、采用与 Revision

### 7.1 Adopt Command

```ts
adoptTaskCandidate({
  candidateId,
  expectedCandidateHash,
  expectedDraftRevision,
  expectedDraftContentHash,
  idempotencyKey,
})
```

采用命令必须：

1. 校验 Candidate 仍为 `ready`；
2. 校验生成上下文仍匹配当前 Material、Plan 和 TrainingTask；
3. 对已有题目校验基础 Revision 和内容哈希；
4. 重复请求只返回同一采用结果；
5. 一个 Candidate 最多创建一次 Question Revision；
6. 成功后将 Candidate 标记为 `adopted`；
7. 失败时不产生半成品 Revision。

### 7.2 Revision 规则

```text
AI 生成 / 重新生成 / 优化 Candidate：不产生 Revision
异常纠错 Candidate：不产生 Revision
放弃 Candidate：不产生 Revision
采用 Candidate：创建一个 Revision
```

首次采用创建 Revision 1；已有题目采用优化候选时，在同一 QuestionLineage 下创建后继 Revision。

### 7.3 检查当前性

采用后：

1. 新 Revision 必须重新执行 Validation 和 Assessment；
2. 旧 Assessment 继续绑定旧 Revision，不删除；
3. 旧 Human Review 不得代表新 Revision；
4. 已发布 Formal Version 在新 Revision 再次完成发布前继续有效。

## 八、异常纠错

### 8.1 纠错落点

采用前：

```text
Candidate A -> 异常纠错 -> Exception-corrected Candidate B -> Adopt -> Revision 1
```

采用后：

```text
Revision 3 -> 异常纠错入口 -> Exception-corrected Candidate -> Adopt -> Revision 4
```

已发布资源：

```text
Formal Version 3 保持有效
-> Exception-corrected Candidate
-> Adopt 为新 Revision
-> 检查、确认、发布
-> Formal Version 4 生效
```

任何异常纠错都不得原地修改历史 Candidate、Revision 或 Formal Version。

### 8.2 权限与审计

```ts
type ExceptionCorrectionRecord = {
  correctionId: string;
  targetType: 'candidate' | 'question_revision';
  targetId: string;
  reasonCode: 'typo' | 'proper_noun' | 'copyright' | 'required_wording' | 'other';
  beforeHash: string;
  afterHash: string;
  changedFields: AuthoringFieldKey[];
  correctedBy: string;
  correctedAt: string;
};
```

异常纠错必须经过权限判断，选择原因，展示差异，写入审计，并重新进入 Adopt、Validation、Assessment、Review 和 Publication 链路。

## 九、任务卡交互

### 9.1 AI 候选状态

```text
训练任务1
状态：AI 候选待选择

题目预览：……

[采用候选] [AI 优化] [重新生成]
```

存在多个候选时提供候选切换和差异比较，不允许把多个 Candidate 合并成一个可变编辑区。

### 9.2 已采用状态

```text
训练任务1
状态：待检查
当前版本：Revision 3

[检查题目] [AI 优化] [重新生成]
```

在已采用状态执行 AI 优化或重新生成，只创建 Candidate，不修改 Revision 3。

### 9.3 检查后状态

```text
训练任务1
状态：检查完成

[提交最终确认] [AI 优化]
```

AI 优化始终产生新的 Candidate；采用后创建后继 Revision，并使新版本重新进入检查。

### 9.4 迁移完成后删除的界面状态

Candidate 新流程完成迁移后，标准任务卡删除：

- 人工编辑校准；
- 退出人工校准；
- 保存当前任务；
- 工作进度已保存；
- 编辑模式的 dirty、saving、saved 和 save_failed 状态。

异常纠错入口不得常驻在主操作区，应进入权限受控的更多操作或独立纠错界面。

## 十、与现有 Working Draft 的迁移关系

现有 `WorkingTaskContent` 和 `TaskGroupSubmission` 在迁移期继续有效，不立即删除。

迁移原则：

1. Candidate 能力先与旧链路双轨运行；
2. 新流程通过 Feature Flag 控制；
3. 已存在的 Working Content 不得静默丢弃；
4. 活跃 Working Content 必须允许提交、放弃或迁移为异常纠错 Candidate；
5. Candidate 链路完成端到端验收前，不删除旧 Repository、Service、Command 和测试；
6. 旧入口可以隐藏，但必须保留恢复路径；
7. 清理旧链前必须确认无页面、自动化任务和历史数据依赖旧 Handler。

退出双轨前需要观察活跃 Working Draft 数量、Candidate 生成和采用率、优化后采用率、平均重新生成次数、异常纠错使用率、采用后检查通过率及 Revision 冲突率。

## 十一、统一状态计算

Candidate 状态与正式生产状态必须分开计算：

```ts
type TaskCandidateState =
  | 'not_generated'
  | 'generating'
  | 'candidate_ready'
  | 'optimizing'
  | 'regenerating'
  | 'candidate_failed'
  | 'candidate_expired';

type TaskProductionState =
  | 'not_adopted'
  | 'draft'
  | 'checking'
  | 'check_failed'
  | 'ready_for_confirmation'
  | 'pending_confirmation'
  | 'confirmed'
  | 'publishing'
  | 'publication_failed'
  | 'published';
```

页面标题、任务卡状态、主操作和按钮禁用规则必须消费统一 Resolver，不得在组件中分别拼装生命周期。

## 十二、工程实施顺序

### P0：契约冻结

冻结 Candidate 身份、不可变规则、Adopt 语义、Revision 创建时机、字段锁定、异常纠错边界及双轨退出条件。

### P1：Candidate 基础能力

新增 Candidate Schema、Repository、状态 Resolver、四条 Command，以及幂等、过期和冲突测试。P1 不删除现有 Working Draft 链路。

### P2：Agent 与字段锁定

实现 Optimization Agent、结构化优化目标、`allowedFields / lockedFields`、差异说明、生成上下文和决策事件。

### P3：页面双轨

实现 Candidate 预览、比较、采用、优化、重新生成、Feature Flag 和旧 Working Draft 恢复入口。

### P4：Revision 与正式检查接入

```text
Adopt Candidate
-> Question Revision
-> Validation
-> Assessment
-> Human Review
-> Publication
```

### P5：异常纠错与迁移

实现权限受控纠错，处理已有 Working Content，并完成历史数据迁移和恢复验收。

### P6：旧流程收口

在退出条件全部满足后删除人工校准模式、Working Draft 主流程入口、旧保存 Handler、不再可达的状态字段和旧测试。

## 十三、验收标准

必须满足：

1. AI 生成不会自动创建 Question Revision；
2. 重新生成不会覆盖 Candidate 或当前 Revision；
3. AI 优化不会修改未授权字段；
4. 放弃 Candidate 不改变正式任务状态；
5. 采用 Candidate 只创建一次 Revision；
6. 重复采用请求返回同一结果，不重复升版；
7. 基础 Revision 变化后，旧 Candidate 不得采用；
8. 首次采用创建 QuestionLineage 和 Revision 1；
9. 已有题目采用优化候选时，在同一 Lineage 下创建后继 Revision；
10. Candidate 不进入 Assessment、Human Review、Freeze 或 Registry；
11. 已发布 Formal Version 不被新 Candidate 或新 Draft 覆盖；
12. 异常纠错创建新 Candidate 或 Revision，不修改历史；
13. 异常纠错记录权限、原因、字段差异和操作人；
14. 新 Revision 完整复用现有检查、确认和发布链路；
15. 历史 Candidate、Decision Event、Revision 和 Formal Version 均可追溯；
16. 双轨期间现有 Working Content 可以恢复，不发生静默丢失；
17. Candidate 流程失败时可以回到稳定旧链，不污染正式资源；
18. 删除旧链前，活跃 Working Content、旧入口依赖和旧 Handler 引用均为零。

## 十四、最终冻结表述

> 系统不提供标准化字段级人工编辑生产流程。训练资源由 AI 生成不可变候选，人通过结构化反馈指导优化，并通过采用决定候选是否进入正式版本链。只有采用候选后，系统才创建 Question Revision，并进入检查、确认和发布流程。
>
> 系统保留权限受控、强审计的异常纠错入口，用于处理 AI 无法可靠修正的特殊内容问题。任何异常纠错都必须创建新的 Candidate 或 Question Revision，不得覆盖历史 Candidate、Revision 或 Formal Resource。
