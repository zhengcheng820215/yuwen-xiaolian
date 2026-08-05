# Phase 17 AI 资源生成与优化工作流契约

英文名称：AI Resource Generation and Optimization Workflow Contract

状态：DESIGN FROZEN / P0-P6 ENGINEERING COMPLETE / DEBUG ACCEPTED
契约版本：`ai_resource_generation_and_optimization_workflow_contract_v1`  
更新日期：2026-08-05

产品确认日期：2026-08-05
产品确认结论：同意以不可变 `QuestionCandidate` 作为 AI 生成、重新生成、优化和异常纠错的统一承载对象；只有采用 Candidate 才进入 Question Revision、检查、确认和发布链。P1-P5 已依次完成 Candidate 基础能力、页面接入、正式 Revision 采用、优化与异常纠错；P6 已将 Candidate 设为唯一正式生产主链，并把历史 Working Content 降级为只读迁移兼容数据。已发布资源读取链路保持不变。

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
  candidateId: string;
  targetType: 'candidate' | 'question_revision';
  targetId: string;
  reasonCode: 'typo' | 'proper_noun' | 'copyright' | 'required_wording' | 'other';
  beforeHash: string;
  afterHash: string;
  changedFields: AuthoringFieldKey[];
  correctedBy: string;
  permissionRole: 'resource_admin' | 'quality_reviewer';
  note?: string;
  sourceWorkingContentHash?: string;
  correctedAt: string;
};
```

异常纠错必须经过权限判断，选择原因，展示差异，写入审计，并重新进入 Adopt、Validation、Assessment、Review 和 Publication 链路。

### 8.3 权限与入口边界

异常纠错不是标准生产步骤，也不是普通字段编辑器。入口只允许出现在任务卡“更多操作”或独立纠错界面，并同时满足：

1. 当前用户具备 `resource_admin` 或 `quality_reviewer` 角色；
2. 纠错对象是明确的 Candidate 或 `draftId + revision`；
3. 原因属于错别字、专有名词、版权信息、指定表达或附带说明的其他异常；
4. 页面在提交前展示变更字段与前后差异；
5. 未授权请求、空变更请求和缺少原因的请求必须被阻断。

异常纠错只创建不可变的 `exception_corrected` Candidate。原 Candidate、Question Revision、Human Review、Formal Version 和 Registry 均不得原地修改。

### 8.4 Command 与幂等

```ts
correctTaskCandidate({
  trainingTaskId,
  targetType,
  targetId,
  correctedContent,
  reasonCode,
  note,
  correctedBy,
  permissionRole,
  expectedContext,
  idempotencyKey,
})
```

同一 `idempotencyKey` 重试必须返回同一个 Candidate 和同一条纠错记录，不得生成重复候选或重复审计。Candidate 已写入而回执中断时，重试必须先恢复并核对已写入结果。

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

### 10.1 Working Content 迁移结果

```ts
type WorkingContentMigrationResult =
  | { status: 'migrated'; candidateId: string; correctionId: string }
  | { status: 'no_working_content' }
  | { status: 'no_changes' }
  | { status: 'base_revision_conflict'; reason: string }
  | { status: 'requires_legacy_resolution'; reason: string };
```

迁移命令必须遵守：

1. Working Content 的基础 `draftId + revision + contentHash` 与当前活动 Draft 一致时才允许迁移；
2. 存在 `base_revision_conflict` 时禁止自动套用，必须保留 Working Content，并提供查看正式内容、保留工作修改、放弃工作修改或人工重新应用；
3. Working Content 含训练计划级 `taskContent` 时，不得只迁移题目字段造成静默丢失，返回 `requires_legacy_resolution` 并继续保留旧流程；
4. 内容哈希未变化时返回 `no_changes`，不创建 Candidate 或审计记录；
5. Candidate 与审计记录均保存成功后才允许清理对应 Working Content；
6. 迁移失败或页面刷新后，原 Working Content 必须仍可恢复。

### 10.2 迁移 Command

```ts
migrateWorkingTaskContentToCorrectionCandidate({
  trainingTaskId,
  reasonCode: 'legacy_working_content',
  correctedBy,
  permissionRole,
  expectedContext,
  idempotencyKey,
})
```

迁移只是把旧可变工作内容固化为一个不可变纠错 Candidate，不创建 Revision。用户仍需显式采用，采用后才进入既有 Validation、Assessment、Review 和 Publication 链路。

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

#### P1 工程落地记录（2026-08-05）

P1 已完成以下基础能力：

1. 建立不可变 `QuestionCandidate` Schema，区分初始生成、重新生成、优化和异常纠错候选；
2. 建立内存与 IndexedDB Repository，Candidate 内容只允许首次写入，后续仅能通过显式状态迁移更新生命周期；
3. 建立 Candidate 与正式生产状态分离的统一 Resolver；
4. 实现 `generateTaskCandidates`、`regenerateTaskCandidates`、`optimizeTaskCandidate`、`adoptTaskCandidate` 四条独立 Command；
5. Command 使用请求指纹和幂等回执，重复请求不重复生成、采用或写入决策事件；
6. Candidate 保存模型、Prompt、规则、素材、观察计划和训练任务版本上下文；上下文变化后旧 Candidate 进入过期冲突，不得静默采用；
7. AI 优化执行 `allowedFields / lockedFields` 校验，禁止未授权字段变化；
8. Adopt 通过注入式 Gateway 保留正式链边界；P1 只验证采用语义，不在本阶段直接接入正式 Question Revision 创建；
9. 部分生成结果不得登记为完整成功，重新生成重试不得产生重复决策事件。

P1 Debug 结果：

- `debug:question-candidate-workflow`：10 / 10 PASS；
- `debug:working-task-content`：13 / 13 PASS；
- `debug:task-group-submission`：PASS；
- `debug:task-production-state`：PASS；
- `npm run build`：PASS。

P1 完成不代表旧链退役。Working Draft、单任务保存、现有 Revision、Assessment、Human Review、Publication 和学习入口读取逻辑继续保持原状；页面双轨、正式 Revision 接入和旧链收口必须分别经过后续阶段验收。

### P2：Optimization Agent 与策略执行

P2 不重新实现 P1 已具备的 Candidate 不可变存储、Command 幂等、上下文校验和
`allowedFields / lockedFields` 守卫。P2 只负责把结构化优化目标可靠地转换为一次可审计的
Agent 调用，并将模型结果交回 P1 Candidate 服务完成最终字段校验和持久化。

#### P2.1 优化目标目录

页面和调用方不得自行拼装字段白名单。系统必须维护统一的优化目标目录：

| 优化目标 | 允许变化 | 必须锁定 |
| --- | --- | --- |
| `reduce_ambiguity` | `questionStem`、`answerAcceptance` | `abilityTarget`、`observationTarget`、`materialScope` |
| `strengthen_material_evidence` | `questionStem`、`studentTask`、`answerAcceptance` | `abilityTarget`、`materialScope` |
| `narrow_answer_scope` | `answerAcceptance`、`rubric` | `abilityTarget`、`observationTarget`、`materialScope` |
| `lower_difficulty` | `questionStem`、`studentTask`、`answerAcceptance`、`rubric` | `abilityTarget`、`materialScope` |
| `increase_challenge` | `questionStem`、`studentTask`、`answerAcceptance`、`rubric` | `abilityTarget`、`materialScope` |
| `optimize_rubric` | `rubric`、`answerAcceptance` | `abilityTarget`、`observationTarget`、`materialScope` |

多个目标合并时，允许字段取并集，锁定字段取并集；同一字段同时出现在允许和锁定集合时，
锁定优先，并从允许集合中移除。未知目标必须在调用 Agent 前阻断。

#### P2.2 Agent 输入输出

Optimization Agent 输入必须包含：

```ts
type QuestionCandidateOptimizationRequest = {
  requestId: string;
  trainingTaskId: string;
  baseCandidateId: string;
  baseContent: QuestionEditableFields;
  goals: CandidateOptimizationGoal[];
  reasonCodes: string[];
  allowedFields: CandidateFieldKey[];
  lockedFields: CandidateFieldKey[];
  generationContext: CandidateGenerationContext;
};
```

Agent 输出必须是单个结构化对象：

```ts
type QuestionCandidateOptimizationOutput = {
  content: QuestionEditableFields;
  changedFields: CandidateFieldKey[];
  reason: string;
  changeSummary: Array<{
    field: CandidateFieldKey;
    summary: string;
  }>;
};
```

`changeSummary` 是用户可读的变化说明，不得包含内部 Prompt、模型推理过程或工程标识。
Agent 返回结果必须通过 Schema 解析；不得从自由文本中猜测或部分恢复正式字段。

#### P2.3 结果校验与失败语义

P2 必须提供稳定错误码：

| 错误码 | 含义 | 是否可重试 |
| --- | --- | --- |
| `CANDIDATE_OPTIMIZATION_GOAL_UNSUPPORTED` | 包含未知优化目标 | 否 |
| `CANDIDATE_AGENT_INVALID_OUTPUT` | Agent 输出不是完整合法对象 | 视修复策略而定 |
| `CANDIDATE_AGENT_TIMEOUT` | Agent 调用超时 | 是 |
| `CANDIDATE_AGENT_FAILED` | 上游服务失败 | 依据 Provider 错误 |
| `CANDIDATE_NO_EFFECTIVE_CHANGE` | 归一化后内容与基础 Candidate 相同 | 否 |
| `CANDIDATE_LOCKED_FIELD_CHANGE` | Agent 修改锁定字段 | 否 |
| `CANDIDATE_UNDECLARED_FIELD_CHANGE` | Agent 修改允许集合以外字段 | 否 |
| `CANDIDATE_CHANGE_SUMMARY_MISMATCH` | 实际变化与声明变化不一致 | 否 |
| `CANDIDATE_GENERATION_CONTEXT_MISMATCH` | Agent 返回生成上下文不一致 | 否 |

无有效变化不得创建一个“看似成功”的新 Candidate。失败时不得保存 Candidate、Command
成功回执或 `optimized` 决策事件。

#### P2.4 幂等与决策事件

同一 `idempotencyKey` 和相同请求指纹只能调用 Agent 一次并得到同一 Candidate；相同 Key
配合不同请求必须返回幂等冲突。优化成功后必须在基础 Candidate 上记录一个
`optimized` 决策事件，并关联生成的新 Candidate；重试不得重复写入事件。

决策事件只表达“基于该 Candidate 生成了优化候选”，不得把基础 Candidate 标记为失效或
覆盖。基础 Candidate 与优化 Candidate 均保持可选择，直至用户明确采用、放弃或重新生成。

#### P2.5 工程边界

P2 不包含：

1. 页面 Candidate 比较和采用交互；
2. Question Revision 创建；
3. Validation、Assessment、Human Review 或 Publication 接入；
4. Working Draft 删除或历史数据迁移；
5. 异常纠错入口。

这些能力分别由 P3、P4、P5 和 P6 承担。P2 上线不得改变现有正式资源读取链。

#### P2.6 Debug 验收矩阵

P2 至少验证：

1. 每个结构化目标映射到稳定的允许和锁定字段；
2. 多目标合并遵守“锁定优先”；
3. 合法结构化输出创建一个优化 Candidate 和一条差异说明；
4. 锁定字段变化、越权字段变化和变化摘要不一致均被阻断；
5. 无有效变化不创建 Candidate；
6. 非 JSON、缺字段和非法字段输出映射为统一错误；
7. Provider 超时和失败保留可重试语义；
8. 幂等重试不重复调用 Agent、不重复创建 Candidate 或决策事件；
9. Material、Observation Plan、Training Task 或活动 Draft 上下文变化后不得保存结果；
10. P1 Candidate、Working Draft、Task Group Submission 和生产状态回归继续通过。

#### P2.7 工程落地与 Debug 验收记录（2026-08-05）

P2 已完成以下能力：

1. 建立统一优化目标目录，由服务端解析目标对应的允许字段和锁定字段，调用方不得自行扩大字段权限；
2. 建立结构化 Optimization Agent 输入、输出 Schema 和 Prompt Builder，Provider 结果必须完整解析后才能进入 Candidate 服务；
3. 建立 Agent 超时、上游失败、非法输出、无有效变化、字段越权、锁定字段变化和上下文漂移的稳定错误语义；
4. Agent 输出先经过字段规范化，再计算实际差异，避免对象键顺序不同被误判为内容变化；
5. 实际变化字段必须与 Agent 声明的 `changedFields` 及 `changeSummary` 一致；
6. 优化执行期间重新校验 Material、Observation Plan、Training Task 和活动 Draft 上下文，漂移后不得持久化结果；
7. 同一幂等请求只调用 Agent 一次、只创建一个优化 Candidate，并只写入一条关联新 Candidate 的 `optimized` 决策事件；
8. 无有效变化或任何校验失败时，不保存 Candidate、成功回执或决策事件。

P2 Debug 结果：

- `debug:question-candidate-optimization`：10 / 10 PASS；
- `debug:question-candidate-workflow`：10 / 10 PASS；
- `debug:working-task-content`：13 / 13 PASS；
- `debug:task-group-submission`：PASS；
- `debug:task-production-state`：PASS；
- `pnpm run build`：PASS；
- `git diff --check`：PASS。

本阶段没有改动 Candidate 页面交互、Question Revision 创建、Validation、Assessment、Human Review、Publication、Working Draft 或学习入口读取链路。Candidate 页面双轨和正式 Revision 接入仍分别由 P3、P4 承担。

### P3：页面双轨

P3 将 Candidate 决策界面接入任务卡，但不提前承担 P4 的正式 Revision 写入职责。
新旧流程必须通过 Feature Flag 双轨运行，已有 Working Draft 不得因新界面上线而被静默丢弃。

#### P3.1 范围与非目标

P3 实现：

1. Candidate 列表、预览和差异比较；
2. 结构化优化目标选择与 AI 优化；
3. 重新生成候选；
4. 候选操作的 Loading、成功、失败和重试反馈；
5. Candidate 新流程 Feature Flag；
6. 已有 Working Draft 的识别和旧流程恢复入口；
7. 采用入口的能力门控和用户可读说明。

P3 不实现：

1. Candidate 到 Question Revision 的正式写入；
2. Validation、Assessment、Human Review 或 Publication 接入；
3. Working Draft 数据迁移或删除；
4. 异常纠错入口；
5. 旧 Handler、Repository 和测试清理。

以上能力分别由 P4、P5 和 P6 承担。P3 不得为了让按钮“看起来可用”而回写旧人工编辑区、
修改当前 Question Draft、把 Candidate 标记为已采用，或伪造 Revision 创建成功。

#### P3.2 页面状态边界

任务卡必须同时消费三类互不替代的状态：

```ts
type TaskCandidatePanelOperation =
  | 'idle'
  | 'loading_candidates'
  | 'regenerating'
  | 'optimizing'
  | 'failed';
```

1. `TaskCandidateState`：描述候选是否存在、是否可采用或已过期；
2. `TaskProductionState`：描述正式题目所处的检查、确认和发布阶段；
3. `TaskWorkingState`：仅在旧流程恢复时描述未保存、已保存或冲突的工作内容。

页面标题、候选操作、正式生产操作和旧流程恢复提示不得共用一个模糊状态字段。点击 AI 操作后，
按钮必须立即进入对应 Loading 状态并阻止重复提交；完成后必须在当前任务卡可见位置给出结果，
不能只在页面顶部展示反馈。

#### P3.3 Candidate 预览与比较

任务卡默认只展示当前选中 Candidate 的核心内容和变化摘要。存在多个 Candidate 时允许切换，
比较视图最多同时展示两个 Candidate，不允许把多个 Candidate 合并为可编辑内容。

比较至少包含：

1. 题目；
2. 学生任务；
3. 答案接受范围；
4. Rubric；
5. AI 变化说明；
6. 生成类型和创建时间。

桌面端可使用并列比较；窄屏按顺序展示，不得依赖横向滚动才能完成主要判断。
Candidate 内容只读，页面不得提供字段级输入框。

#### P3.4 AI 优化与重新生成

AI 优化必须从 P2 统一目标目录选择目标，不得由页面自行扩大 `allowedFields`。至少提供：

- 减少歧义；
- 强化文本依据；
- 收紧答案范围；
- 降低难度；
- 提升挑战；
- 优化评分标准。

用户必须至少选择一个目标才能发起优化。优化结果创建新的不可变 Candidate，基础 Candidate
继续保留。重新生成同样创建新 Candidate，不覆盖当前 Candidate 或正式 Revision。

同一任务同一时间只允许一个 Candidate 生成操作。失败时保留已有 Candidate，并提供针对当前操作的
重试入口；超时、上游失败、锁定字段变化和无有效变化必须映射为用户可理解的信息。

#### P3.5 采用入口边界

P3 可以展示“采用候选”的下一步语义，但正式按钮必须由 Candidate Adoption Gateway 的能力状态控制：

```ts
type CandidateAdoptionCapability = {
  enabled: boolean;
  reason?: string;
};
```

在 P4 Gateway 尚未接入时：

1. 采用按钮必须明确禁用；
2. 页面说明“当前可预览和优化候选，正式采用将在版本接入完成后开放”；
3. 不得调用旧 `adoptSingleTrainingTaskCandidate`；
4. 不得把 Candidate 内容复制到人工编辑字段；
5. 不得写入 `adopted` 状态或采用决策事件。

P4 完成后，页面只替换 Gateway 能力和结果处理，不重新实现 Candidate 选择与比较界面。

#### P3.6 Feature Flag

Candidate 页面必须支持显式开关，优先级冻结为：

```text
URL 显式参数
-> localStorage 显式设置
-> 构建环境变量
-> 环境默认值
```

URL 参数使用 `candidateWorkflow=enabled|legacy`。开关只控制页面入口，不改变 Candidate、Working Draft
或正式资源数据。关闭开关后旧人工校准流程继续可用；重新开启后已生成 Candidate 仍可恢复。

#### P3.7 旧 Working Draft 恢复

任务存在 `dirty`、`saved`、`save_failed` 或 `base_revision_conflict` Working Draft 时，新界面必须提示：

```text
此任务存在旧流程工作修改
[返回旧流程处理]
```

恢复旧流程只切换当前任务的页面投影，不得自动提交、放弃、迁移或覆盖工作内容。Working Draft 已保存时
允许刷新、折叠和切换任务；只有浏览器内尚未保存的内容继续执行离开保护。

P3 不提供自动迁移为 Candidate。迁移规则由 P5 冻结后实施。

#### P3.8 Debug 验收矩阵

P3 至少验证：

1. Feature Flag 按 URL、localStorage、环境变量和默认值优先级解析；
2. Candidate 关闭时旧流程不受影响；
3. 任务卡可以加载、切换和预览多个 Candidate；
4. 比较视图最多展示两个 Candidate；
5. 优化目标为空时不能提交；
6. 优化和重新生成立即显示 Loading，期间不能重复提交；
7. 成功创建新 Candidate，不覆盖基础 Candidate；
8. 失败保留已有 Candidate，并能重试；
9. P4 未接入时采用按钮禁用，且不会写入 Candidate 或 Revision；
10. 已有 Working Draft 可显式返回旧流程处理，刷新后内容仍存在；
11. Candidate 新流程与正式检查、确认、发布状态互不覆盖；
12. P1、P2、Working Draft、Task Group Submission、生产状态和构建回归继续通过。

#### P3.9 工程实施与验收记录

完成日期：2026-08-05

已完成：

1. 任务卡接入 Candidate 空态、读取态、失败态、待判断态和过期态；
2. 支持 Candidate 列表、只读预览和最多两项对比；
3. 支持结构化优化目标、AI 优化和重新生成，结果继续作为不可变 Candidate 保存；
4. P4 接入前“采用候选”保持禁用，不写 Candidate 决策、Question Revision 或正式资源；
5. 支持 URL、localStorage、环境变量和默认值四级 Feature Flag；
6. 旧 Working Draft 继续走显式恢复入口，新 Candidate 页面不静默迁移或覆盖；
7. Candidate 操作反馈显示在当前任务卡内，生成结果不会覆盖原任务内容。

自动化验收：

- `debug:question-candidate-workflow`：10 / 10 PASS；
- `debug:question-candidate-optimization`：10 / 10 PASS；
- `debug:question-candidate-workbench-p3`：PASS；
- `npm run build`：PASS。

界面端到端验收：

- URL 开启 Candidate 双轨后，任务卡可生成 3 个候选并恢复到“候选待判断”；
- 生成期间显示任务卡内 Loading，完成后显示预览、差异摘要和操作入口；
- Candidate 对比上限为 2，第三项选择不会突破上限；
- AI 优化先展示结构化目标，不直接改写 Candidate 或正式任务；
- “采用候选”在 P3 保持禁用，并显示 P4 版本接入说明；
- 关闭 Candidate Feature Flag 后，旧人工校准入口继续可用。

### P4：Revision 与正式检查接入

```text
Adopt Candidate
-> Question Revision
-> Validation
-> Assessment
-> Human Review
-> Publication
```

#### P4.1 范围与职责

P4 只负责把一个当前有效、可采用的 Candidate 接入既有正式题目版本链，并完成正式检查：

```text
Candidate Adoption
-> Question Revision Binding
-> QuestionDraftValidation
-> QuestionQualityAssessment
```

Human Review、Freeze、Formal Version 与 Registry 继续复用既有命令和状态边界，不在 Candidate
Adoption Gateway 内重复实现。采用不是发布，也不得自动形成审核决定。

#### P4.2 身份与 Revision 创建规则

采用时必须保持以下身份关系：

```text
TrainingTask
-> Candidate
-> QuestionLineage
-> Active QuestionDraft
-> Question Revision
```

规则冻结为：

1. TrainingTask 尚无 QuestionLineage 时，首次采用创建 Lineage、Draft 与 Revision 1；
2. 已存在可编辑 Active Draft 时，在同一 Lineage、同一 Draft 下只新增一个 Revision；
3. 已审核、已冻结或已发布的 Draft 不允许原位改写；采用时在同一 Lineage 下创建可编辑后继 Draft；
4. 已发布 Formal Version 与 Registry Entry 继续有效，直到后继 Revision 再次完成确认和发布；
5. Candidate 内容与当前 Revision 内容完全一致时不得制造空 Revision；
6. 同一 Candidate 的同一采用命令只允许绑定一个 Revision，重复请求必须返回同一结果；
7. Candidate 的生成上下文、预期基础 Revision 或内容哈希已经变化时，采用必须阻断。

#### P4.3 Adoption Gateway

正式采用必须只通过统一 Gateway：

```ts
type CandidateAdoptionResult = {
  candidateId: string;
  questionLineageId: string;
  draftId: string;
  revision: number;
  contentHash: string;
  adoptedAt: string;
};
```

Gateway 必须先完成持久化 Revision 绑定，再写入 Candidate 的 `adopted` 状态和决策事件。若进程在
Revision 已写入、Candidate 回执尚未写入之间中断，重试必须通过 Draft 身份、Revision 和内容哈希恢复
同一采用结果，不得再次升版。

Candidate Adoption Gateway 不得：

1. 直接写入 Human Review；
2. 自动冻结或发布资源；
3. 修改历史 Revision；
4. 覆盖已发布 Formal Version；
5. 把 Candidate 复制回旧人工编辑字段。

#### P4.4 正式检查与失败恢复

Revision 绑定成功后依次执行：

```text
QuestionDraftValidation
-> QuestionQualityAssessment
```

每个阶段必须返回可恢复结果：

```ts
type CandidateAdoptionWorkflowResult = {
  adoption: CandidateAdoptionResult;
  validation: {
    status: 'completed' | 'failed';
    passed?: boolean;
    message?: string;
  };
  assessment: {
    status: 'completed' | 'failed' | 'blocked';
    message?: string;
  };
  nextAction:
    | 'resolve_validation'
    | 'retry_assessment'
    | 'ready_for_confirmation';
};
```

失败恢复规则：

1. Revision 创建成功后，后续 Validation 或 Assessment 失败不得回滚 Revision；
2. Validation 失败时 Assessment 标记为 `blocked`，页面引导重新生成或优化 Candidate；
3. Assessment 失败时保留 Validation 结果，只重试 Assessment；
4. 重试采用命令不得创建第二个 Revision；
5. 页面不得把“采用成功、检查失败”伪装成“采用失败”；
6. 检查结果必须绑定采用结果中的明确 `draftId + revision`，不得读取漂移的最新内容。

#### P4.5 任务卡交互

采用按钮只在 Candidate 当前、内容哈希匹配且 Gateway 可用时启用。点击后必须立即在当前任务卡显示：

```text
正在采用候选…
-> 正在创建题目版本…
-> 正在检查题目…
```

完成后按真实阶段显示：

- `采用并检查完成`：可进入最终确认；
- `已采用，结构检查未通过`：保留 Revision，提供重新生成或 AI 优化；
- `已采用，完整质量检查未完成`：提供重试检查；
- `候选已过期`：禁止采用，重新生成当前上下文 Candidate。

操作期间按钮保持标准 Loading 状态并阻止重复提交。成功或失败反馈必须出现在当前任务卡内，不能只依赖
页面顶部 Toast。采用完成后旧人工校准入口不自动开启。

#### P4.6 Debug 验收矩阵

P4 至少验证：

1. 首次采用创建 Lineage、Draft 和 Revision 1；
2. 已有可编辑 Draft 采用时只新增一个 Revision；
3. 已发布资源采用新 Candidate 时原 Formal Version 与 Registry 不变；
4. 同一幂等键重复采用返回同一 Revision；
5. Revision 写入后回执中断可恢复，不重复升版；
6. Candidate 过期、内容哈希变化或基础 Revision 冲突时阻断采用；
7. Validation 失败保留新 Revision，Assessment 不运行；
8. Assessment 失败保留 Revision 与 Validation，重试不重复升版；
9. 采用成功后 Candidate 状态和决策事件只写入一次；
10. 页面采用按钮具备卡内 Loading、成功、阶段失败和重试反馈；
11. 未采用 Candidate 不进入 Validation、Assessment、Review 或 Publication；
12. P1-P3、旧 Working Draft 恢复、现有确认发布链和构建继续通过。

#### P4.7 Debug 验收记录（2026-08-05）

本轮已完成 Candidate Adoption 到正式检查链路的工程与界面验收：

1. P4 自动化用例 `9 / 9` 通过，覆盖首次采用、可编辑 Draft 升版、幂等重试、回执中断恢复、Validation 失败、Assessment 重试、已审核 Draft 后继创建、空变更与过期候选阻断、卡内 Loading 投影；
2. P1 Candidate 基础回归 `10 / 10` 通过；
3. P2 Optimization Agent 回归 `10 / 10` 通过；
4. P3 双轨工作台回归通过；
5. Vite 生产构建通过；现存动态导入和大 Chunk 提示属于非阻断构建告警，本轮未扩大；
6. 本地工作台启用 `candidateWorkflow=enabled` 后可正常加载，现有已发布任务保持稳定，浏览器控制台无错误；
7. 当前演示数据没有待采用 Candidate，因此真实按钮点击视觉链路由状态投影测试覆盖；后续 Demo 产生候选时，仍需补一次卡内“采用中 -> 阶段结果”的人工可视验收。

P4 结论：Candidate Adoption 已成为 Candidate 进入 Question Revision 的唯一写入边界；采用后的 Validation 与 Assessment 具备阶段结果和可恢复语义，不会因重试重复升版，也不会覆盖既有审核或正式资源。

### P5：异常纠错与迁移

实现权限受控纠错，处理已有 Working Content，并完成历史数据迁移和恢复验收。

#### P5.1 数据与 Repository

1. 新增不可变 `ExceptionCorrectionRecord`；
2. Candidate Repository 持久化纠错记录并支持按 Candidate 查询；
3. IndexedDB 升级必须兼容已有 Candidate、Decision Event 和 Command Receipt；
4. `clear()` 同时清理纠错记录，仅用于测试或明确的数据清理操作。

#### P5.2 异常纠错 Service

1. 校验角色、原因、目标身份和运行上下文；
2. 计算真实变化字段，拒绝空变更；
3. 创建 `exception_corrected` Candidate，不修改纠错目标；
4. 写入前后内容哈希、变化字段、操作人和权限角色；
5. 支持幂等重试及 Candidate 已落库后的阶段恢复。

#### P5.3 Working Content 迁移

1. `current` 且只有 Question 字段的 Working Content 可以迁移；
2. Revision、Draft 或基础内容变化时返回冲突并保留原数据；
3. 含任务级字段时返回旧流程处理，不做不完整迁移；
4. 成功迁移后生成 Candidate 和审计记录，再清理 Working Content；
5. 失败任务继续保留旧恢复入口，不能因 Candidate Feature Flag 丢失数据。

#### P5.4 页面接入

异常纠错放在“更多操作”，迁移入口只在检测到旧 Working Content 时出现。操作按钮点击后立即显示卡内 Loading；成功后选中新 Candidate，失败或冲突信息显示在当前任务卡，不能只依赖顶部 Toast。

#### P5.5 Debug 验收矩阵

P5 至少验证：

1. 未授权纠错被阻断且不产生 Candidate 或审计；
2. 授权纠错创建新 Candidate 和唯一审计记录，原目标不变；
3. 同一幂等键重试不重复生成；
4. 空变更和无原因的其他纠错被阻断；
5. 当前 Working Content 可迁移并在成功后清理；
6. Revision 冲突时迁移阻断且 Working Content 保留；
7. 含任务级字段时要求继续旧流程且数据保留；
8. 迁移失败、刷新和重试后仍能恢复；
9. P1-P4 Candidate、采用检查和旧 Working Draft 回归继续通过；
10. 生产构建与浏览器 Demo 无运行错误。

P5 完成不代表可以删除旧人工校准与 Working Draft。只有 P6 的活跃数据、入口依赖和旧 Handler 引用退出条件全部满足后，才允许执行旧链收口。

#### P5.6 Debug 验收记录（2026-08-05）

本轮已完成异常纠错、历史 Working Content 迁移和双轨页面的工程验收：

1. P5 自动化用例 `9 / 9` 通过，覆盖权限阻断、不可变纠错 Candidate、审计记录、幂等重试、Working Content 成功迁移、无变化清理、Revision 冲突保留、任务级字段回退旧流程和迁移重试；
2. P1 Candidate 基础回归 `10 / 10`、P2 Optimization Agent 回归 `10 / 10`、P3 双轨工作台回归、P4 Adoption 回归 `9 / 9` 均通过；
3. Vite 生产构建通过；现存 ESM 模块类型、动态导入和大 Chunk 提示属于非阻断告警，本轮未扩大；
4. 浏览器实页启用 `candidateWorkflow=enabled` 后可正常生成单任务 Candidate，并显示候选比较、重新生成、采用和“更多操作”；
5. “更多操作”可打开权限受控的异常纠错表单，原因、说明和纠正内容均在当前任务卡内呈现；
6. 历史人工调整任务不会因 Candidate 模式自动进入旧编辑区；旧 Working Content 仅在检测到真实迁移对象时显示迁移或继续旧流程入口；
7. 候选生成期间有即时 Loading，完成后切换为“候选待判断”；补充候选验收数据已放弃，不进入 Revision、检查或正式资源；
8. 浏览器控制台无 `error` 或 `warn` 级运行日志，页面未出现重叠、阻断或无反馈状态。

P5 结论：异常纠错已落到不可变 Candidate 和独立审计记录；历史 Working Content 迁移具备冲突保护、失败保留和临时兼容退路。Candidate 新链已可安全承接存量数据，但旧人工校准与 Working Draft 的删除仍属于 P6，必须继续遵守退出条件。

> P6 覆盖说明：P3、P5 中“返回 / 继续旧流程”的表述只描述当时的阶段性双轨方案。P6 生效后不再恢复旧人工编辑器；无法自动迁移的内容统一进入 `requires_protected_resolution`，只允许受保护保留或显式放弃。

### P6：旧流程收口

P6 将 Candidate 工作流设为统一资源生产工作台的唯一主流程，并把旧 Working Content 降级为只读迁移兼容数据。收口必须按“契约补强 -> 退出条件审计 -> 分批清理 -> 串联 Debug”执行，不得先删数据层再补恢复能力。

#### P6.1 主流程冻结

统一工作台固定采用以下链路：

```text
TrainingTask
-> AI Candidate
-> 人工判断 / 结构化优化 / 权限受控纠错
-> Adopt
-> Question Revision
-> Validation
-> Assessment
-> Final Confirmation
-> Publication
```

页面不再读取 Route、Local Storage 或环境变量来决定是否回到人工校准主流程。历史 Feature Flag 解析函数只允许作为兼容代码暂存，不得被正式页面消费。

以下入口从正式页面移除：

- 人工编辑校准 / 退出人工校准；
- 保存当前任务 / 提交当前任务并检查；
- 提交全部已保存修改；
- 继续处理旧修改；
- 重新应用工作修改；
- 任何通过本地集合、URL 参数或隐藏状态重新开启旧字段编辑器的入口。

#### P6.2 Working Content 兼容边界

Working Content Repository 在 P6 不立即物理删除。它仅用于识别和迁移历史数据，必须满足：

1. 页面不得把 Working Content 合并回任务表单，也不得让检查、确认、冻结、发布或 Runtime 读取；
2. `current` 且只含 Question 字段时，允许迁移为不可变异常纠错 Candidate；
3. 无真实变化时允许清理 Working Content，但不得创建 Candidate 或 Revision；
4. 基础 Revision 冲突、Draft 缺失或含任务级字段时，保留原数据并显示阻断原因；
5. 对无法自动迁移的数据，只提供“保留数据”和“放弃旧修改”两类受控处理，不得恢复旧人工编辑器；
6. 放弃旧修改必须由用户显式触发，并在当前任务卡反馈结果；
7. 只有当持久化存量审计为零且迁移观察期结束后，才允许后续版本物理删除 Repository、Schema 与底层兼容 API。

#### P6.3 退出条件审计

旧流程清理前必须生成机器可验证的审计结果：

```ts
type LegacyWorkflowExitAudit = {
  canonicalCandidateWorkflow: boolean;
  reachableLegacyEntryCount: number;
  reachableLegacyHandlerCount: number;
  candidateFeatureFlagCount: number;
  workingContentMergedIntoForm: boolean;
  migratableWorkingContentCount: number;
  protectedWorkingContentCount: number;
  unprotectedWorkingContentCount: number;
  status: 'ready' | 'migration_required' | 'blocked';
};
```

退出条件固定为：

1. 正式页面只运行 Candidate 工作流；
2. 可达旧入口、旧写 Handler 和旧编辑状态引用均为零；
3. 页面只读识别历史 Working Content，不再写入或重新基线化；
4. 所有存量 Working Content 均已迁移、显式放弃，或进入可解释的受保护阻断态；
5. Candidate 采用、检查、最终确认和发布不依赖旧 Working Content；
6. 已发布 Formal Version、Registry 和学习入口读取不受清理影响。

审计状态解释：

- `ready`：代码退出条件满足，且没有待迁移或冲突数据；
- `migration_required`：代码已收口，但仍有可迁移数据，主流程可继续使用；
- `blocked`：仍存在可达旧写链，或存在未提供受控处理方式的历史数据。

#### P6.4 分批清理顺序

第一批清理页面入口与开关：

- Candidate 工作流改为常开；
- 删除 URL / Local Storage / 环境变量的旧链选择；
- 删除人工校准和继续旧修改入口。

第二批清理页面写链：

- 删除 `saveCurrentTaskWorkingContent`、`reapplyCurrentTaskWorkingContent`、`submitWorkingTaskChanges` 等旧 Handler；
- 删除只服务于旧写链的 Loading、幂等键、编辑集合和批量提交状态；
- 切换素材或任务时不再把历史 Working Content 当作未保存表单修改。

第三批清理不可达实现：

- 删除不再被正式页面引用的人工校准 Disclosure 行为和旧 UI 测试；
- 保留迁移所需的 Working Repository 只读、迁移和显式放弃能力；
- 将历史模式解析器、批量 Working Commit 等暂未物理删除模块标记为 deprecated compatibility，等待存量审计为零后另行移除。

#### P6.5 失败与恢复

1. 迁移失败不得删除 Working Content；
2. 迁移成功后先确认 Candidate 和纠错审计已落库，再删除 Working Content；
3. 含任务级字段的历史数据不得不完整迁移，也不得通过旧编辑器继续生产；
4. 用户显式放弃后，页面重新读取当前正式 Revision，不得保留旧字段投影；
5. P6 清理失败不得影响 Candidate、Revision、Assessment、Review、Formal Version 或 Registry 既有数据。

#### P6.6 Debug 验收矩阵

P6 至少验证：

1. 任意 Route、Local Storage 和环境变量均不能切回旧人工校准页面；
2. 正式页面不存在人工校准、旧保存、批量 Working 提交和继续旧修改入口；
3. 历史 Working Content 不会合并进当前任务字段；
4. 可迁移 Working Content 生成纠错 Candidate 后才被清理；
5. 无变化 Working Content 可安全清理且不创建 Revision；
6. Revision 冲突和任务级字段数据保持原样，并显示可解释阻断信息；
7. 用户显式放弃旧修改后，当前正式内容和 Candidate 主流程继续可用；
8. Candidate 生成、优化、纠错、采用和采用后检查回归通过；
9. 最终确认、发布、Registry 与学习入口串联回归通过；
10. 页面静态审计中旧入口和旧写 Handler 引用为零；
11. 生产构建通过，浏览器控制台无运行错误；
12. P1-P5 自动化继续通过。

#### P6.7 完成定义

P6 工程完成表示“旧写流程不可达、历史数据仍可受控迁移”，不等同于立即删除全部 Working Content 底层文件。底层物理删除是后续数据迁移完成后的维护任务，不能阻塞 Candidate 主流程成为唯一正式入口。

#### P6.8 工程审计与 Debug 记录（2026-08-05）

本轮按契约、审计、分批清理、串联 Debug 的顺序完成收口：

1. Candidate 工作流已改为正式页面唯一生产路径，页面不再消费 Route、Local Storage 或环境变量中的候选开关；
2. 主工作台可达旧入口、旧写 Handler、旧编辑集合、旧批量提交状态和 Working Content 表单合并引用均为 `0`；
3. 历史 Working Content 只读识别为 `migration_required` 或 `base_revision_conflict`，可迁移为纠错 Candidate 或由用户显式放弃；
4. 含任务级字段的历史数据返回 `requires_protected_resolution`，保留原数据，不再恢复旧人工编辑器；
5. 新增统一退出审计 Resolver，固定输出 `ready / migration_required / blocked`，并以 P6 静态测试阻止旧入口和旧 Handler 回流；
6. Candidate 生成 `10 / 10`、Optimization Agent `10 / 10`、P3 页面投影、P4 采用与检查 `9 / 9`、P5 纠错迁移 `9 / 9`、P6 退出审计全部通过；
7. 旧人工校准相关颜色断言和折叠辅助函数已删除，颜色语义回归改为覆盖 AI 优化、生成优化候选和重新生成候选；
8. 浏览器实页携带历史 `candidateWorkflow=legacy` 参数时仍只展示 Candidate 主流程，人工校准、旧批量提交和继续旧修改入口均未出现，控制台无运行错误；
9. Vite 生产构建通过；现存 ESM 模块类型、动态导入和大 Chunk 提示为仓库既有非阻断告警。

P6 代码退出审计状态：`ready`。不同设备上的运行时存量仍可能返回 `migration_required` 或 `blocked`，必须按统一 Resolver 引导迁移或解决冲突。底层 Working Content Repository 作为只读迁移兼容层暂时保留，待存量审计持续为零后再执行物理删除。

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
17. Candidate 流程失败时停留在稳定 Candidate / Revision 状态并支持重试，不得回到旧人工写链；
18. P6 收口时，旧入口依赖和旧写 Handler 引用均为零；历史 Working Content 只能处于已迁移、已显式放弃或受保护阻断态。

## 十四、最终冻结表述

> 系统不提供标准化字段级人工编辑生产流程。训练资源由 AI 生成不可变候选，人通过结构化反馈指导优化，并通过采用决定候选是否进入正式版本链。只有采用候选后，系统才创建 Question Revision，并进入检查、确认和发布流程。
>
> 系统保留权限受控、强审计的异常纠错入口，用于处理 AI 无法可靠修正的特殊内容问题。任何异常纠错都必须创建新的 Candidate 或 Question Revision，不得覆盖历史 Candidate、Revision 或 Formal Resource。
