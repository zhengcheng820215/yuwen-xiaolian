# Phase 17 AI 资源生成与优化工作流契约

英文名称：AI Resource Generation and Optimization Workflow Contract

状态：DESIGN FROZEN / P0-P7 ENGINEERING COMPLETE / SINGLE-OPERATOR ADOPTION ORCHESTRATION DEBUG ACCEPTED
契约版本：`ai_resource_generation_and_optimization_workflow_contract_v1_15`
更新日期：2026-08-18

产品确认日期：2026-08-05
产品确认结论：同意以不可变 `QuestionCandidate` 作为 AI 生成、重新生成、优化和异常纠错的统一承载对象；只有采用 Candidate 才进入 Question Revision、检查、确认和发布链。P1-P5 已依次完成 Candidate 基础能力、页面接入、正式 Revision 采用、优化与异常纠错；P6 已将 Candidate 设为唯一正式生产主链，并把历史 Working Content 降级为只读迁移兼容数据。已发布资源读取链路保持不变。

2026-08-06 增补确认（2026-08-09 文案校准）：当 AI 训练任务规划结果已经包含符合 `QuestionEditableContent` 契约的完整题目内容时，系统必须基于该内容形成不可变的初始 Candidate，不得要求用户再次执行一次 AI 生成。页面将该初始 Candidate 标记为“当前方案”，与本轮 AI 新方案进入同一单选列表，主操作统一为“采用并发布”；用户不采用新方案时可以继续保留当前方案，或按当前上下文生成新一轮方案。只有训练任务确实没有完整题目内容时，才显示“生成题目”。该调整不改变“采用后才创建 Revision”的底层边界。

2026-08-06 单人模式收敛确认（2026-08-09 决策语义校准）：用户点击采用主操作即对当前可见 Candidate 及其已展示质量提醒作出明确采用决定。系统在创建 Question Revision 后，应自动串联 Validation、Assessment、Human Review Decision、Freeze、Formal Resource 与 Registry；采用前必须展示质量提醒，采用时按 warning code 写入固定结构化留痕，不再要求填写第二份确认说明。检查失败、身份冲突或发布失败仍必须中断，且不得回滚已经成功的领域阶段。多人审核模式仍可恢复为分阶段操作，但不改变底层命令和审计边界。

2026-08-09 用户动作收口确认：单人生产界面的采用主按钮统一命名为“采用并发布”。它只合并用户需要理解的决策，不合并领域写入：系统仍依次执行 Candidate Adopt、Revision、Validation、Assessment、Human Review Decision、Freeze、Formal Resource 与 Registry。阻断问题、采用后新发现且未在采用前展示的提醒，或任一领域阶段失败时，必须停在对应任务卡，显示“需要处理”或“发布未完成”及唯一恢复动作；不得回滚已成功阶段，也不得重新要求用户选择同一 Candidate。采用前已经展示的非阻断提醒，由“采用并发布”一次性作出明确接受决定，并按 warning code 分别留痕，不得再次要求用户确认。正常路径不得再出现“采用题目”“提交最终确认”“发布任务”或“发布已确认题目”等连续按钮。

2026-08-10 质量提醒语义收口确认：`warning` 必须在“采用并发布”前完整展示。用户点击该主操作即接受当前可见的非阻断提醒；系统必须为每个 warning code 分别写入结构化 acknowledgement，并记录当前 Revision、Assessment、规则版本、操作人和时间。该留痕可以使用系统固定的决定来源 `single_operator_adopt_and_publish`，不得合并为一条无 warning 身份的批量记录，也不得再弹出自由文本理由表单或第二次最终确认。`blocking` 始终禁止发布，只能进入生成优化题目、重新生成或对应恢复动作。

2026-08-06 组级操作收口确认：任务卡直接展示当前可执行动作，不再添加“下一步：”前缀。题目采用属于单任务动作，采用后不需要任务组级再次确认。页面底部常驻区只保留“重新规划整组任务”和“补充生成训练任务”两项组级 AI 生成动作；旧“确认任务并保存”不得常驻或以禁用态出现。只有训练任务组本身发生候选组采用、增删等未保存变化时，才临时显示“保存任务组修改”，该动作只维护 Observation Plan，不确认题目、不创建 Question Revision，也不进入题目发布链。

2026-08-13 任务组候选采用收口确认：TrainingTaskCandidate 的人工采用动作在前台统一为“采用当前任务方案”。应用层必须先计算采用后的任务组，再自动调用 Observation Plan 保存与结构检查；保存成功后才关闭候选区并显示任务卡，保存失败时保留原候选。页面不再提供逐项勾选、删除任务、编辑缓冲或独立保存入口；不采用时直接“重新生成任务方案”。该动作不得创建 Question Revision、Assessment、Human Review、Formal Resource 或 Registry 记录，更不得直接发布；单任务 QuestionCandidate 的“采用并发布”边界保持不变。

2026-08-18 补充候选与单选替代边界确认（同日由数量与分布规划进一步收敛）：补充生成只能增加尚未覆盖的新 Observation，不得把同一题干改成另一种 `responseFormat` 后作为新任务并存。题干完全重复必须在任何能力、训练方向、题型或 Observation 标签比较之前全局阻断；高度相似题干继续进入语义重复检查。当前题组存在单选基础理解入口缺口时，补充生成按本轮规划完成后的目标任务组规模请求合格单选候选；候选仍必须对应新的低负荷观察点。若适合单选的观察已经存在，应转入该 TrainingTask 的单题替代优化并形成后继 Revision，不得伪装成补充任务。采用前必须按最终任务组再次检查题干唯一性，并直接指出重复任务；不得等待 Repository 抛出英文异常后只显示通用失败。

2026-08-18 补充计划发布继承确认：补充候选被采用时，新 Observation Plan 只能为新增任务建立新身份；当前任务组中已经发布的任务必须通过 `taskRevisionRootId / parentObservationTaskPlanId` 继承原 Formal Resource、Frozen Version、Registry 与 Active Link，不得因 Plan Revision、Draft 同步或 Candidate 后台恢复重新变成“可以发布”。单题“采用并发布”只能推进目标题的 Candidate、Draft、Assessment、Publication 与可见状态，不得修改相邻任务的 Active Link 或状态投影。发布完成后的权威刷新必须得到“原已发布数量 + 1”；若正式关联尚未同步完成，不得先显示发布成功。

2026-08-18 单选数量与分布规划确认：单选数量采用“目标区间 + 质量约束”，不采用机械配额。常规 `5–6` 道有效任务默认规划 `2` 道单选，材料、独立观察和干扰项质量充分时可以增加到 `3` 道；`4` 道任务推荐 `1–2` 道，`3` 道任务默认 `1` 道。数量只统计当前规范 Active Plan 中仍有效的任务。补充生成的实际单选数量必须取“目标缺口、总任务剩余容量、合格独立观察数”的最小值；任务组总数不得超过 `6`，不得挤压必要文本观察。目标不足允许基于容量、重复、观察缺口、干扰项质量或文本覆盖原因解释放行，不得投射成新的人工审核步骤。

2026-08-18 单选进入层与顺序规划确认（同日完成持久化收口）：常规 Training 任务组默认采用 `entry_first`，优先将 `1–2` 道合格基础理解单选安排在首个高负荷文本任务之前；第 `3` 道及后续单选即使合格，也不得继续被当作进入层，存在文本任务时首个文本任务必须紧随进入层。当前 Observation Plan 要求先形成整体判断或保留独立文本表达基线时，可以使用 `holistic_first`，并由确定性 Planner 保证首个文本任务位于本轮新候选首位；单选承担 Retest / Transfer 时使用 `role_driven`。例外必须写入受控原因码。进入层具体 Candidate 身份、数量、策略、原因和序号必须写入正式任务标签，并在 Observation Plan 权威刷新后恢复，禁止仅凭题型或当前位置重新推断。初始或整组替代只排序新候选，补充生成只追加且不得重排已发布任务；Learning 只对尚未消费任务应用投放优先级，已完成任务和 Retest / Transfer 的时间依赖不得被改写。顺序不足或受控调整属于规划软结果，不新增人工审核，也不单独阻断高质量 Candidate。

2026-08-18 单选质量提醒分流确认：质量评估必须以 `responseFormat` 为事实来源。`single_choice` 的可观察动作由题干选择语义、完整选项和单选交互共同确认，不得要求题干使用开放题动词；其区分度由唯一答案、选项集合、逐项干扰依据与可解释偏差建立，不得要求两个以上 Rubric 项来模拟“完整/部分/未达到”的开放作答分层。`quality.observation.unclear` 与 `quality.discrimination.weak` 只有在单选专用条件确实不成立时才可出现。文本题原有检查保持不变。题型错配产生的提醒属于系统误报，不得要求用户接受，也不得形成无效 warning acknowledgement。

2026-08-12 “可以发布”承诺确认：任务卡显示“可以发布 / 采用并发布”即表示所有可预见发布前置条件已经满足，或可由同一次点击确定性自动完成。应用层必须在 Candidate Adopt 前完成 Observation Plan 校验、提交与单人模式审核确认，并让可见状态与执行命令消费同一前置检查结果。不得先采用 Candidate，再以 `plan_not_reviewed`、Plan 缺失、任务身份缺失或已知校验失败阻断用户。点击后仅网络、存储、Provider 或并发状态变化等不可预见运行时异常可以中断；中断时保留已完成领域阶段并显示唯一恢复动作，不得要求重新采用同一 Candidate。

## 一、目的

本文定义统一资源生产工作台中 AI 生成、重新生成、优化、采用和异常纠错的职责边界。

当完整 Candidate 使用 `responseFormat = single_choice` 时，选择交互仍属于 `content` 的不可变组成部分，并遵循[阅读训练单项选择作答契约](./READING_SINGLE_CHOICE_RESPONSE_FORMAT_CONTRACT.md)。选项、答案键或干扰项依据变化都必须形成新 Candidate 和新内容哈希；不得把它们拆成采用后的人工编辑步骤。

本契约的目标不是把现有题库编辑器更换一组按钮，而是把标准生产模式冻结为：

```text
AI 提出不可变候选
-> 人判断方向与质量
-> 人采用候选
-> 系统创建正式题目版本
-> 自动检查、写入采用决定并发布
-> 异常时中断处理
```

标准流程中：

1. AI 负责生成和优化资源候选；
2. 人负责选择、判断并提供结构化优化方向；
3. 人不直接编辑标准生产流程中的正式资源字段；
4. Candidate 不属于正式资源链；
5. 只有采用 Candidate 才能创建 `QuestionDraft Revision`；
6. 系统保留权限受控、强审计的异常纠错入口，但该入口不属于常规生产流程；
7. AI 规划 TrainingTask 时已经生成的完整题目内容，必须被视为初始候选来源，不得在页面上误报为“未生成题目”；
8. Candidate 是工程与审计边界，用户主流程使用“题目、采用并发布、重新生成题目”等任务语义，不要求用户理解 Candidate 数据模型。

本文不替代以下既有契约：

- [正式资源生产契约地图](./FORMAL_RESOURCE_PRODUCTION_CONTRACT_MAP.md)；
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
-> 形成初始 Candidate
   -> TrainingTask 已包含完整题目：由现有题目内容确定性形成
   -> TrainingTask 尚无完整题目：调用 AI 生成
-> 人工判断
   -> 方向错误：重新生成 Candidate
   -> 细节不足：优化 Candidate
   -> 满意：采用并发布 Candidate
-> QuestionLineage
-> QuestionDraft Revision
-> Validation
-> Assessment
-> Human Review Decision（单人正常路径自动编排并独立留痕）
-> Freeze
-> Formal Resource
-> Registry
```

人工主要负责选择候选、判断候选是否符合训练意图、提供结构化优化目标，并决定候选是否进入正式版本链。

在单人生产模式中，“采用并发布”是唯一正常路径的人工确认动作。采用后的检查、审核决定和发布由应用层编排器继续执行，但每一步仍写入独立领域记录。任何提醒或失败都会停止编排并把任务交还用户处理。

### 2.2 初始题目来源

初始 Candidate 有两种来源，但进入同一后续链路：

```text
来源 A：训练任务规划已输出完整题目
TrainingTask Question Payload
-> 确定性形成 initial Candidate
-> 题目待采用

来源 B：训练任务仅定义训练意图
TrainingTask
-> 用户执行“生成题目”
-> AI 生成 initial Candidate
-> 题目待采用
```

来源 A 不得再次调用 AI，不得创建 Revision，也不得在刷新时重复创建 Candidate。来源 B 只有在题目内容确实不完整时才允许出现。

### 2.3 异常流程

以下内容可以进入异常纠错入口：

1. 明确错别字；
2. 专有名词错误；
3. 版权或来源信息错误；
4. 必须人工指定的固定表达；
5. AI 无法可靠修正且继续生成成本明显不合理的特殊问题。

异常纠错不得成为默认入口，不得用于日常题目改写、训练方向调整或 Rubric 重构。

### 2.4 标准能力边界

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
| `QuestionCandidate` | 表达针对训练意图形成的不可变题目候选，包括训练任务规划已生成的初始题目和后续 AI 生成结果 |
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

### 3.2 训练任务初始候选

TrainingTask 可以携带训练规划阶段已经生成的题目内容，但该内容仍不属于正式题目版本。系统必须通过同一个领域函数校验其是否满足完整 `QuestionEditableContent` 契约，页面组件、按钮和统计模块不得分别判断：

```ts
type InitialCandidateCompleteness = {
  complete: boolean;
  missingFields: CandidateFieldKey[];
};

function inspectInitialCandidateCompleteness(
  content: QuestionEditableContent,
): InitialCandidateCompleteness;
```

完整性检查继续覆盖 `questionStem`、`studentTask`、`observationTarget`、`rubric`、`answerAcceptance`、能力目标和材料关联，但它只用于采用后的 Validation 与 Assessment，不得直接生成“补全题目方案”等人工生产步骤。

只要 `questionStem` 非空，系统就必须以 `trainingTaskId + trainingTaskVersion + contentHash + CandidateRuntimeContext` 形成稳定业务身份，并创建或恢复唯一的 `training_task_compatibility_wrap` 初始 Candidate。`CandidateRuntimeContext` 至少包含 Material Version、Observation Plan Version、Active Draft 身份与 Revision、Base Formal Resource Version；刷新、路由切换、重复读取和重复请求不得增加候选数量。只有 `questionStem` 为空时，页面才进入“未生成题目”状态并提供“生成题目”。版本、内容哈希或上下文冲突时必须展示可恢复错误，不得静默选用任一份内容。

### 3.3 首次采用

当 TrainingTask 尚无正式题目身份时：

```text
Candidate B
-> Adopt
-> 创建 QuestionLineage
-> 创建 QuestionDraft
-> 创建 QuestionDraft Revision 1
```

历史兼容任务可能已经存在与 `training_task_compatibility_wrap` 内容完全相同的活动 QuestionDraft。此时采用初始 Candidate 必须绑定既有 QuestionLineage、Draft 与 Revision，不得因内容相同报错，也不得重复创建 Revision。该例外只适用于兼容包装 Candidate；普通 AI Candidate 与当前 Draft 内容完全相同时，仍按无变化命令处理。

### 3.4 已有题目的再次优化

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
  candidateOrigin: 'training_task_compatibility_wrap' | 'question_generation' | 'regeneration' | 'optimization' | 'exception_correction';

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
  source: 'ai_generated' | 'training_task_compatibility_wrap';
  modelId: string;
  promptVersion: string;
  promptHash: string;
  ruleVersion: string;
  materialVersionId: string;
  observationPlanVersion: number;
  trainingTaskVersion: number;
  trainingTaskContentHash: string;
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

训练任务初始候选同样遵守本节规则。它虽然复用训练任务规划阶段已经生成的题目内容，但仍只是 Candidate；在用户采用之前，不得进入 Validation、Assessment、Human Review 或 Publication。

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

### 6.1 初始候选解析

系统必须通过应用层兼容适配器执行统一解析和确定性固化：

```ts
ensureInitialCandidateFromTrainingTask({
  trainingTaskId,
  expectedTrainingTaskVersion,
  expectedContentHash,
  idempotencyKey,
})
```

解析规则：

1. TrainingTask 已包含完整题目内容：确定性创建或恢复一个 `candidateOrigin: 'training_task_compatibility_wrap'` 的 `initial` Candidate，不调用 AI；
2. 已存在相同上下文和 `contentHash` 的初始 Candidate：返回原 Candidate；
3. TrainingTask 内容不完整：返回 `question_generation_required`；
4. 上下文或内容发生冲突：返回明确冲突，不追加候选；
5. 解析成功不创建 Question Revision，不改变正式题目状态。
6. Candidate 必须记录 TrainingTask 版本、内容哈希和兼容来源；相同任务版本和内容不得重复写入。
7. TrainingTask 内容变化后，基于旧内容且尚未采用的初始 Candidate 进入 `expired`；已经采用的 Candidate 继续保留审计事实，不得回写或删除。
8. 适配器只允许复制并固化 TrainingTask 题目内容，TrainingTask 本身不得被当作 Candidate。

历史任务采用按需兼容：读取任务时发现完整题目且缺少对应 Candidate，才执行上述命令；不得执行无差别批量迁移。该过程不得调用 Provider、创建 Revision、修改 Formal Version 或更新 Registry。

### 6.2 首次 AI 生成

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

该命令只在 `ensureInitialCandidateFromTrainingTask()` 返回 `question_generation_required` 时作为页面主操作。不得因为页面尚未加载 Candidate Repository，就忽略 TrainingTask 已有题目并重复调用 AI。

### 6.3 重新生成

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

### 6.4 AI 局部优化

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

### 6.5 补充任务、作答形式缺口与题干判重

`supplement_group` 的唯一职责是补充新的 TrainingTask Observation。系统可以把“当前题组缺少足够的单项选择基础理解入口”作为生成目标，但不得因此放宽 Observation、容量、文本覆盖与题干重复规则。

数量计算只能基于同一材料当前规范 `Active Observation Plan Revision` 中仍有效的 TrainingTask：历史 Plan、已停用或被替代任务、未采用 Candidate 以及同一任务谱系的旧 Revision 均不计入当前总数。规划器必须向生成器提供或确定性推导以下上下文事实：

- `currentEffectiveTaskCount`：当前有效任务总数；
- `currentSingleChoiceCount`：当前有效单选数；
- `maxEffectiveTaskCount = 6`：当前任务组容量上限；
- `targetEffectiveTaskCount`：本轮 Plan 完成后预期的有效任务总数，必须位于当前有效任务数与 `6` 之间；
- `targetSingleChoiceCount`：按 `targetEffectiveTaskCount` 推导的本轮软目标；
- `availableTaskCapacity`：当前剩余任务容量；
- `requestedSupplementSingleChoiceCount`：本轮实际请求补充的单选数。

其中：

```text
targetEffectiveTaskCount = min(
  6,
  currentEffectiveTaskCount + intendedSupplementTaskCount
)
singleChoiceGap = max(0, targetSingleChoiceCount - currentSingleChoiceCount)
availableTaskCapacity = max(0, 6 - currentEffectiveTaskCount)
requestedSupplementSingleChoiceCount = min(
  singleChoiceGap,
  intendedSupplementTaskCount,
  availableTaskCapacity,
  qualifiedIndependentSingleChoiceObservationCount
)
```

`intendedSupplementTaskCount` 由本轮 Observation 规划目标确定，不得超过剩余容量。`targetSingleChoiceCount` 的默认规划规则遵循[阅读训练单项选择作答契约 3.3 节](./READING_SINGLE_CHOICE_RESPONSE_FORMAT_CONTRACT.md)：目标有效任务组为 `5–6` 道时默认 `2` 道、适合时最多 `3` 道；`4` 道任务推荐 `1–2` 道；`3` 道任务默认 `1` 道、特殊情况下最多 `2` 道。它是软目标，不是绕过质量门禁的发布条件。例如当前已有 `3` 道文本任务、本轮计划补充 `2` 道时，`targetEffectiveTaskCount = 5`，因此默认单选目标为 `2` 道，而不是按生成前的 `3` 道规模只请求 `1` 道。

生成与采用必须遵守：

1. 先对候选题干与同材料现有题干执行归一化全局精确比较，不受 `primaryAbilityId`、`observationDimension`、`responseFormat` 或模型重新标注影响；
2. 精确重复直接归为 `likely_duplicate`，不得进入可采用候选；
3. 精确比较通过后，再比较回答对象、材料依据、认知动作与评分目标，识别高度相似题或既有 Observation 的替代问法；
4. 仅改变 `short_text / long_text / single_choice` 不会产生新的 Observation；
5. 当目标有效任务组为 `5–6` 道时，当前为 `0` 道单选优先请求 `2` 道、当前为 `1` 道优先请求 `1` 道；较小目标组按数量矩阵收敛。当前为 `2` 道时仅在第 `3` 道具有独立价值且容量允许时继续；已有 `3` 道时默认不再增加；
6. 实际生成数不得超过 `requestedSupplementSingleChoiceCount`，不得使有效任务总数超过 `6`，也不得突破不同任务规模对应的单选上限；
7. 多道单选必须在观察对象、证据范围或认知动作至少一项上形成实质差异，不能连续改写同一事实定位；
8. 若合适的基础理解 Observation 已存在，系统不得复制题干来满足单选目标，而应提示从对应 TrainingTask 发起单题替代优化；
9. 当前任务组已满时不得通过补充生成突破容量。替代优化必须由用户从明确的单个 TrainingTask 发起，并形成同一谱系后继 Revision，不得批量覆盖正式资源；
10. 若材料无法形成足量合格单选，返回结构化不足结果，不得用重复题、明显错误干扰项或低价值观察凑数。

结构化不足结果至少包含 `targetCount`、`actualCount` 和一个或多个原因码：

- `insufficient_task_capacity`；
- `insufficient_supplement_scope`；
- `no_independent_observation`；
- `duplicate_with_existing_task`；
- `distractor_quality_insufficient`；
- `would_displace_text_observation`。

该结果属于生成治理信息，不建立新的人工审批步骤。若已生成的任务均满足硬门禁，目标数量不足不得单独阻断“采用当前任务方案”；前台可以用一句受控说明解释为何少于目标，并继续保留“采用当前任务方案 / 重新生成任务方案”两个决策。

“采用当前任务方案”执行 Repository 写入前，应用层必须对合并后的最终任务组再次执行同一归一化题干唯一性检查。检查失败时保留候选与当前任务组，错误信息必须指出重复的候选和现有任务，并提供“重新生成补充候选”这一唯一恢复动作。

最低回归矩阵必须覆盖：

1. `3 / 4 / 5 / 6` 道当前有效任务规模；
2. 当前已有 `0 / 1 / 2 / 3` 道单选；
3. 容量充足、容量仅剩 `1`、容量为 `0`；
4. 合格观察数小于、等于和大于目标缺口；
5. 第 `2` 或第 `3` 道单选与现有任务重复、干扰项不足或会挤压文本观察；
6. 目标不足被解释放行，硬约束失败继续阻断；
7. 补充采用后已发布任务身份和状态不变，发布新增单选只增加目标题的正式状态。

工程任务 1 已于 `2026-08-18` 完成确定性数量规划基础：任务组容量统一为 `6`，新增默认/扩展目标区间、目标任务组规模、单选缺口、剩余容量、合格独立观察上限、实际请求数量和既有超限标记计算。专项 Debug `18 / 18 PASS`，任务组规划、规划 E2E、草稿生成、资源生产、工作台状态与 Production Build 回归通过。本阶段未把新计算结果接入生成 Prompt，也未改变“目标不足”的 Agent 校验与页面表达；这些边界继续由后续工程任务完成。执行证据见[单选数量与分布工程任务 1 Debug 验收](../education/phase/reports/reading_single_choice_quantity_planning_stage1_debug_acceptance_2026-08-18.md)。

工程任务 2 已于 `2026-08-18` 完成 Prompt 与生成接入：工作台补充生成请求使用工程任务 1 的规划结果，并向 Generator 传递当前有效任务数、当前单选数、本轮补充数、目标任务组规模、默认/实际单选目标、单选上限、剩余容量与本批次实际请求数。Prompt 明确数量只是后置软目标，要求多道单选形成独立观察，禁止为凑数降低干扰项质量，并要求不足时返回受控原因。典型“3 道文本任务 + 补充 2 道”已验证能够请求并接纳 2 道独立单选；上下文与请求目标不一致时在 Provider 调用前阻断。单选专项 Debug `21 / 21 PASS`，数量规划、任务组规划、草稿生成和 Production Build 回归通过。目标不足的结构化结果、可解释放行和页面表达仍属于工程任务 3。执行证据见[单选数量与分布工程任务 2 Debug 验收](../education/phase/reports/reading_single_choice_quantity_planning_stage2_debug_acceptance_2026-08-18.md)。

工程任务 3 已于 `2026-08-18` 完成目标不足治理：Generator 使用 `singleChoicePlanningResult` 保存目标数、实际数、当前数、本次生成数、缺口数和受控原因码；单选数量目标不足从批次硬错误改为规划软结果。只要已生成 Candidate 均满足结构、去重、干扰项质量、任务容量和文本观察边界，当前方案继续保持可采用；结构非法、没有任何新观察或其他硬门禁失败仍保持阻断。工作台用一句受控说明展示目标、预计数量和不足原因，不新增确认、审核或人工填写步骤。执行证据见[单选数量与分布工程任务 3 Debug 验收](../education/phase/reports/reading_single_choice_quantity_planning_stage3_debug_acceptance_2026-08-18.md)。

单选进入层顺序工程已于 `2026-08-18` 完成最终收口：`training_task_sequence_planning_v2`、确定性 Planner、Generator / Prompt、五项顺序标签恢复和 Learning 未消费任务调度已经串联。默认规划只将显式选中的 `1–2` 道基础单选作为进入层，第 `3` 道单选不会继续压在首个文本任务之前；`holistic_first` 确定性文本优先，Retest 与 Transfer 按角色顺序执行。补充生成只追加，已发布顺序和学生已消费历史均不可变。旧版无显式进入层标记的正式资源按同材料最多 `2` 道保守兼容；历史整体判断意图无法安全反推，不自动改写旧资源。顺序调整或不足保持规划软结果，不引入新的人工动作。执行证据见[单选进入层顺序规划与 Learning 调度验收报告](../education/phase/reports/reading_single_choice_sequence_planning_learning_scheduling_acceptance_2026-08-18.md)。

工程任务 4 已于 `2026-08-18` 完成整体联调收口：统一回归入口覆盖数量规划、双单选生成、软目标不足放行、Candidate 采用与正式发布、补充计划发布状态隔离、Learning 作答、确定性 Diagnosis、Evidence、恢复与页面交互语义。真实浏览器只读冒烟确认工作台与 Learning 页面可恢复、无控制台错误和横向溢出；既有已发布材料不会因为新数量目标被自动回填或覆盖，只有后续新规划、补充生成或明确的单题替代优化才应用新规则。执行证据见[单选数量与分布工程任务 4 联调验收](../education/phase/reports/reading_single_choice_quantity_planning_stage4_integration_acceptance_2026-08-18.md)。

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

### 7.4 单人模式采用后自动编排

单人模式采用命令成功后，应用层必须按以下顺序执行或恢复：

```text
Adopt Candidate
-> Create Question Revision
-> Validation
-> Assessment
-> Record Human Review Decision
-> Freeze / Publish
-> Formal Resource / Registry
```

冻结规则：

1. “采用题目”是用户对当前 Candidate 的明确人工决定，不得再要求一次无新增信息的“最终确认”；
2. Validation 未通过时停止在 `需要处理`，不得继续 Assessment；
3. Assessment 失败或不可用时停止在 `需要处理`，允许从检查阶段重试；
4. Assessment 存在任何待确认 warning 时停止在 `需要处理`，必须由用户处理或提供结构化保留理由；系统不得填写统一理由或自动接受；
5. 无 warning 且质量门禁通过时，系统可以记录绑定当前 Revision 与 Assessment Bundle 的 Human Review Decision，并继续发布；
6. 发布失败不得回滚已创建的 Revision、Assessment 或 Human Review Decision，页面显示“需要处理”并提供“重试发布”；
7. 重试必须从最后未完成阶段继续，不得重复创建 Revision、审核决定、Formal Version 或 Registry Entry；
8. 已发布 Formal Version 在新版本发布成功前持续有效，不得被 Candidate 或失败中的 Revision 覆盖。

编排结果至少包含：

```ts
type CandidateAdoptionOrchestrationResult = {
  draftId: string;
  revision: number;
  completedStages: Array<
    'adopt' | 'validation' | 'assessment' | 'review' | 'publication'
  >;
  visibleState: 'processing' | 'published' | 'action_required';
  nextAction?:
    | 'resolve_validation'
    | 'retry_assessment'
    | 'resolve_warnings'
    | 'retry_review'
    | 'retry_publication';
};
```

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

### 9.1 题目待采用状态

```text
训练任务1
状态：题目待采用

当前方案 | AI方案1 | AI方案2 | AI方案3

当前方案预览：……

[重新生成题目] [采用并发布]
```

主流程不得使用“生成题目候选”“查看候选”“采用候选”“候选待采用”作为用户必须理解的主要文案。Candidate 名称只保留在技术信息、调试、审计和差异比较的内部语境中。

未发布任务已有完整题目时，页面必须把该内容对应的唯一 `initial` Candidate 投影为“当前方案”，不得复制成第二份可变草稿或重复 Candidate。单次生成最多再展示三个 AI Candidate，因此同一判断区最多出现“一个当前方案 + 三个 AI 方案”。页面只允许单选切换查看，不提供多选、并排合并或字段级编辑；“采用并发布”只作用于当前选中的 Candidate，并继续执行 Revision 精确绑定和完整质量检查，不因选择“当前方案”而绕过检查。

界面不再常驻“放弃本轮方案”。用户不选择 AI 新方案时，当前方案及其上游内容保持不变；关闭或折叠判断区也不产生领域写入。底层拒绝、废弃和失效命令继续保留：生成新一轮方案时自动将上一轮未采用 AI Candidate 标记为 `superseded`，Material、Plan、TrainingTask、基础 Revision 或内容哈希变化时标记为 `expired`。上述状态迁移不得修改当前题目、Draft Revision、Formal Resource 或 Registry。AI 优化、重新生成和异常纠错不得与采用动作并列为常驻主入口，只允许以“生成新一轮方案”次操作或明确失败恢复动作出现。

### 9.2 未生成题目状态

只有 `resolveInitialTaskCandidate()` 确认 TrainingTask 不含完整题目内容时才显示：

```text
训练任务1
状态：未生成题目

[生成题目]
```

点击后应立即显示“正在生成题目…”。生成成功后，同一任务卡直接进入“题目待采用”，将可用的当前方案与本轮最多三个 AI 方案纳入统一单选，并提供唯一“采用并发布”主操作，不得只增加 Candidate 数量而让任务卡继续显示“未生成题目”。

### 9.3 采用后的正常路径

```text
训练任务1
状态：处理中
```

系统自动执行检查、确认和发布。正常路径不再外显“待检查、待最终确认、已确认待发布”等内部阶段，也不要求用户逐步点击。

### 9.4 异常中断状态

```text
训练任务1
状态：需要处理

[处理问题 / 重试检查 / 重试发布]
```

仅在存在真实失败或待确认提醒时显示对应恢复动作。AI 优化始终产生新的 Candidate；采用后创建后继 Revision，并重新进入同一自动编排。

### 9.5 迁移完成后删除的界面状态

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
  | 'question_missing'
  | 'resolving_initial_candidate'
  | 'generating'
  | 'question_pending_adoption'
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

type TaskProductionVisibleState =
  | 'question_missing'
  | 'question_pending_adoption'
  | 'processing'
  | 'published'
  | 'action_required';
```

页面标题、任务卡状态、主操作和按钮禁用规则必须消费统一 Resolver，不得在组件中分别拼装生命周期。

统一映射冻结为：

| Candidate / Task 事实 | 用户状态 | 主操作 | 次操作 |
| --- | --- | --- | --- |
| 训练任务无完整题目，且无可用 Candidate | 未生成题目 | 生成题目 | 无 |
| 训练任务已有完整题目，初始 Candidate 正在恢复 | 正在准备题目… | Loading | 无 |
| 存在可用 Candidate，尚未采用 | 题目待采用 | 采用并发布 | 切换查看当前方案或 AI 方案；按需生成新一轮方案 |
| 已采用，自动编排正在执行 | 处理中 | Loading | 无 |
| 自动编排全部完成 | 已发布 | 无 | 无 |
| 存在提醒或任一阶段失败 | 需要处理 | 按 `nextAction` 显示必要的恢复动作 | 无常驻入口 |

页面状态、主按钮、统计和刷新恢复必须消费同一个可见状态 Resolver。内部详细状态继续用于审计和恢复，不得逐项重新暴露成用户步骤。顶部只固定显示互斥的“待发布 / 已发布”两类统计：没有完整 Formal Resource 与 Active Registry 的当前任务统一计入“待发布”；只有 Formal Resource 与 Registry 完整提交后才计入“已发布”。任务卡主状态进一步冻结为“待处理 / 处理中 / 已发布”：Candidate 待判断、内容缺失或提醒待处理时显示“待处理”；Candidate 已采用且正式发布尚未完成时显示“处理中”；Formal Resource 与 Registry 完整后显示“已发布”。“题目待采用、检查中、发布未完成”等只作为卡内原因和恢复说明，不再成为业务状态标签。两项顶部统计之和必须始终等于当前训练任务总数。

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
10. 2026-08-06 过渡实现曾通过逐项结构化理由处理质量提醒；该交互已由 2026-08-10 质量提醒语义收口规则取代。现行单人模式在采用前展示提醒，并由“采用并发布”按 warning code 分别留痕；结构或字段阻断仍不得绕过。历史 Revision 没有活动 Candidate 时明确说明其为既有题目版本，不再误报为 Candidate 缺失故障。

P6 代码退出审计状态：`ready`。不同设备上的运行时存量仍可能返回 `migration_required` 或 `blocked`，必须按统一 Resolver 引导迁移或解决冲突。底层 Working Content Repository 作为只读迁移兼容层暂时保留，待存量审计持续为零后再执行物理删除。

### P7：训练任务初始题目对齐（已完成）

P7 只修正“TrainingTask 已有完整题目，但页面仍要求再次生成 Candidate”的语义断裂，不回退 P0-P6 已冻结的 Candidate、Adopt、Revision、检查、确认和发布边界。

实施顺序：

1. 增加 `inspectInitialCandidateCompleteness()`，统一判断 TrainingTask 是否已经具备完整题目；
2. 增加 `ensureInitialCandidateFromTrainingTask()`，为符合条件的 TrainingTask 确定性创建或恢复唯一 `training_task_compatibility_wrap` Candidate；
3. 将历史 TrainingTask 兼容为按需恢复，不进行破坏性批量迁移；
4. 统一状态 Resolver，把已有题目映射为 `question_pending_adoption`，真正缺失题目才映射为 `question_missing`；
5. P7 当时将任务卡主文案调整为“生成题目 / 题目待采用 / 采用题目 / 重新生成题目”；其中“采用题目”已在后续单人动作收口中统一替换为“采用并发布”；
6. 采用继续复用现有 Candidate Adoption Gateway，保持一次采用只创建一个 Revision；
7. 重新生成创建新 Candidate，保留原初始 Candidate，不覆盖 TrainingTask、Revision 或已发布资源；
8. 修正顶部统计，未采用题目独立归入“待采用”，不得与异常任务共用“需处理”，也不得提前归入“待发布”；
9. 完成刷新恢复、重复点击、历史数据、采用幂等和正式发布回归。

P7 不新增人工编辑，不让 TrainingTask 直接进入正式链，也不把初始题目内容原地升级为 Revision。

P7 回归必须覆盖：完整旧任务首次读取只形成一个初始 Candidate；刷新和重复读取不重复形成；兼容固化不调用 AI、不创建 Revision；字段不足时禁止采用；TrainingTask 内容变化后旧未采用 Candidate 失效；重新生成保留原初始 Candidate；采用只创建一次 Revision；已发布 Formal Version 与 Registry 不受影响；页面不再出现“已有题目但显示未生成”的矛盾状态。

P7 历史验收结论（2026-08-06，禁止作为现行交互实现依据）：训练任务初始题目兼容服务、完整性检查、确定性 Candidate 恢复、状态投影和单人采用发布编排均已接入。初始 Candidate 回归 `4 / 4`、Candidate 工作台 P4 回归 `14 / 14`、P6 退出审计与生产构建通过。当时的浏览器真实数据验收仍采用“保留当前题目 + 逐项填写结构化理由”的过渡交互；该交互已被本章 P7.1 及 2026-08-10 质量提醒语义收口规则取代，不得恢复。现行单人模式只保留 Candidate 选择与“采用并发布”，并按 warning code 自动形成结构化留痕。P7 不调用 Provider 包装历史题目，不在包装阶段创建 Revision，也不改变已发布 Formal Version 与 Registry。

### P7.1 质量提醒处理与阻断分流补充

Candidate 采用后的质量治理必须区分两类结果，页面不得仅根据提示文字自行猜测严重度：

本节仅适用于尚未发布的 Candidate、Draft 与 Revision。已发布 Formal Resource 始终只读；其后续调整必须使用“生成新版方案”，并遵循 [正式资源不可变性契约](./FORMAL_RESOURCE_IMMUTABILITY_CONTRACT.md)，不得复用本节的原地优化入口。

1. `warning`：完整检查已形成，题目可以保留；采用前必须完整展示，采用时按 warning code 分别记录结构化接受决定；
2. `blocking`：结构、必填字段、Rubric、答案范围或发布前置条件不成立，必须生成优化题目或重新生成，不得显示保留并发布入口。

质量提醒生成前必须完成题型分流：文本题使用开放作答可观察动作与多层 Rubric 标准；单选题使用选择语义、唯一答案、选项完整性和干扰项诊断价值标准。不得因单选题只有一个核心 Rubric，或题干使用“哪一项最准确”等选择表达，生成面向开放作答的两项误提醒。

单人模式普通提醒的现行标准交互为：

```text
质量提醒
→ 生成优化题目
或
→ 采用并发布
→ 为每项可见 warning 写入结构化 acknowledgement
→ 自动继续检查、人工决定与发布编排
```

每条 `AuthorWarningAcknowledgement` 必须独立保存 `warningCode`、决定、决定来源、`draftRevision`、`assessmentId`、`ruleVersion`、操作人和时间。单人模式允许使用系统固定决定来源 `single_operator_adopt_and_publish`，但不得用一条固定记录代替多个 warning code，也不得要求用户为同一采用决定再次填写自由文本说明。

“保留当前题目”“逐项选择理由”“提交最终确认”和“确认保留并发布”属于 2026-08-06 过渡实现，不再定义当前单人交互。若 Human Review 已成功而 Publication 失败，审核决定不得回滚，页面进入“发布未完成”，只提供重试发布。

任务卡状态可继续使用“需要处理”，但必须紧邻显示具体原因，例如“3 项质量提醒”。“题目处理中”只用于 Candidate 生成、检查或发布等真实异步阶段，不得作为静态兜底状态。

提醒区只保留一份问题列表和一组决策动作。没有新 Candidate 时不得同时渲染重复的“AI 题目方案”说明；用户开始生成优化题目后，才展开当前题目与优化题目的比较和采用操作。

P7.1 历史浏览器验收（2026-08-06）：当时真实任务卡采用“生成优化题目 / 保留当前题目”，并在确认层逐项选择理由。该记录只保留为过渡实现的验收证据，已由 2026-08-10 质量提醒语义收口规则取代，不得据此恢复第二次确认页面。浏览器控制台错误为 `0`。

### P7.2 任务卡与顶部汇总同源规则

顶部“待发布、已发布”不得重新拼装一套生命周期。任务卡状态、主操作和顶部汇总必须消费同一份 `TaskProductionView` 与质量处理投影，并按互斥桶计数。

状态优先级固定为：

1. `published` 是终态事实，必须计入“已发布”；历史 Candidate 失败、旧操作结果或残留质量提示不得将已发布任务降级为“待发布”；
2. 其余任务，无论处于内容缺失、题目待采用、处理中、质量提醒或发布失败，顶部统一计入“待发布”；
3. 具体原因和唯一下一步动作必须留在任务卡内部，不得因顶部合并而丢失；
4. 两项计数必须与当前任务卡逐项对应，且总和严格等于训练任务数量。

汇总回归必须覆盖“已发布任务仍残留旧 Candidate 错误 + 另一任务存在质量提醒 + 一项题目待采用”的组合，预期顶部结果必须为“待发布 2、已发布 1”；任务卡仍须分别显示质量提醒和题目待采用原因，不得因顶部合并而发生状态丢失。

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
19. TrainingTask 已有完整题目时，页面首次打开即可显示题目正文和“题目待采用”，不得要求再次调用 AI；
20. 同一 TrainingTask 重复刷新、切换页面或重复解析，不得增加重复初始 Candidate；
21. 已有题目的主操作必须是“采用并发布”，重新生成只能作为次操作并创建新 Candidate；
22. 真正缺少完整题目内容时才显示“未生成题目 / 生成题目”；
23. 生成完成后任务卡必须立即进入“题目待采用”，不得继续显示“未生成题目”或只增加候选数量；
24. 采用训练任务初始 Candidate 仍只创建一个 Question Revision，并完整复用检查、确认和发布链；
25. 未采用、缺失、失效、处理中或失败的题目在顶部统一计入“待发布”，具体原因保留在任务卡内部。
26. 顶部“待发布 + 已发布”必须等于当前训练任务总数，两类任务不得重复计数。
27. 已发布任务的终态优先于 Candidate 面板残留反馈；顶部汇总不得把卡片已显示“已发布”的任务计入其他桶。
28. 质量提醒必须保留在任务卡内部并提供唯一处理动作；顶部统一计入“待发布”，不得恢复独立“需处理”统计项，也不得丢失提醒原因。

## 十四、最终冻结表述

> 系统不提供标准化字段级人工编辑生产流程。训练资源由 AI 生成不可变候选，人通过结构化反馈指导优化，并通过采用决定候选是否进入正式版本链。只有采用候选后，系统才创建 Question Revision，并进入检查、确认和发布流程。
>
> 系统保留权限受控、强审计的异常纠错入口，用于处理 AI 无法可靠修正的特殊内容问题。任何异常纠错都必须创建新的 Candidate 或 Question Revision，不得覆盖历史 Candidate、Revision 或 Formal Resource。
>
> 当 TrainingTask 已经携带完整题目内容时，该内容确定性形成初始 Candidate，页面直接进入候选判断；不得让用户重复执行一次没有产品价值的 AI 生成。Candidate 继续作为底层不可变与审计边界，但主流程以“生成题目、重新生成题目、采用并发布”表达用户任务。

## P0 采用并发布编排落地（2026-08-09）

当前用户主流程进一步收敛为“生成题目 / 重新生成题目 / 采用并发布”。“采用并发布”只合并人工动作，不取消 Candidate、Revision、Validation、Assessment、Human Review、Freeze 与 Registry 的独立领域留痕。正常成功路径不再要求用户重复采用、确认、审核或发布；质量提醒会中断编排，发布阶段失败会保留已完成结果并提供“重试发布”。

验收结果：Candidate 编排专项 `14 / 14 PASS`，P0-P7 最终集成 `26 / 26 PASS`，Production Build 通过。

## P1 任务卡三态投影落地（2026-08-09）

任务卡已统一使用“待处理 / 处理中 / 已发布”三态投影。Candidate、Revision、Validation、Assessment、Human Review、Freeze 与 Registry 的详细状态继续保留在领域和恢复链路中；页面只把具体提醒、处理中阶段和发布失败作为卡内原因展示。发布失败不会回退采用结果，以“处理中 + 发布未完成 + 重试发布”表达。

## 最终用户决策模型与页面收口（2026-08-09）

普通生产、质量提醒和正式资源升级统一消费同一个 Candidate 决策模型：

1. 普通生产：生成题目候选 -> 选择方案 -> 采用并发布；
2. 质量提醒：查看当前方案 -> 必要时生成新方案 -> 选择方案 -> 采用并发布；
3. 正式资源升级：从冻结版本生成新版 Candidate -> 选择方案 -> 发布新版本。

“当前方案”是当前未发布题目内容对应的稳定 `initial` Candidate，与 AI 新方案共同进入单选列表。它不是例外分支，也不需要“保留当前题目”按钮。活动页面不得再提供独立确认说明、提醒保留弹窗、人工审核页或常驻发布按钮；这些行为所需的领域记录继续由 `adoptAndPublishCandidate` 应用编排在后台按阶段生成。

## Candidate 单一人工决策入口（2026-08-09）

Candidate 一旦存在，当前任务的人工决策只能在 Candidate 判断区完成：

1. 方案切换只改变当前预览选择，不修改 Candidate、不创建 Revision；
2. 可见界面不再提供“放弃本轮方案”；底层幂等拒绝命令只供新一轮生成、上下文失效和审计恢复调用，且不得修改当前 Draft、Formal Resource 或 Registry；
3. “采用并发布”是唯一主动作，继续由应用层串联现有独立领域命令；
4. 质量提醒区只展示触发原因，不得同时提供“生成优化题目 / 保留当前题目”等第二套决策入口；
5. 没有 Candidate 时，页面才可以依据当前原因显示“生成题目方案”或“生成新版方案”；
6. 已发布正式资源的“生成新版方案”必须绑定 `baseFormalVersionId`，不得转化为对当前正式版本的编辑。
7. 同一视图、同一任务状态下，同一个 Command 不得同时出现两个可见入口。只要当前任务存在可采用 Candidate，无论它是普通“题目待采用”还是“质量提醒待处理”，任务卡收起时都应在摘要区提供“重新生成题目 / 采用并发布”快捷操作；任务卡展开后，摘要区的同命令入口必须隐藏，由 Candidate 判断区承接同一组操作。两处只允许作为互斥的响应式投影，不得让用户误以为需要重复执行。同一 Command 在不同投影中的用户文案和视觉层级也必须一致，不得交替使用“生成新一轮方案”等近义表达；“重新生成题目”统一使用 AI 紫色线框次按钮，“采用并发布”统一使用 AI 紫色实心主按钮。两者宽度按文字与内边距自然适配，并共享高度、焦点态、加载态与禁用态。

上述规则只收敛可见交互，不改变 Candidate 不可变性、Revision 绑定、提醒阻断、部分失败恢复和正式资源不可覆盖边界。

## 旧链路清理与页面状态收口验收（2026-08-09）

活动工作台已删除提醒保留弹窗、确认说明和独立确认面板。质量提醒只读展示；“当前方案 + AI 新方案”构成唯一判断区，用户选择候选并点击“采用并发布”后，系统依据当前 Assessment warning code 自动生成固定结构化留痕，再继续后台正式化编排。

页面状态统一为“待处理 / 处理中 / 已发布”。`pending_confirmation`、`confirmed`、`publishing` 与可恢复发布失败仍保留为内部生命周期状态，但不再以“待最终确认”“已确认待发布”或常驻“发布任务”暴露。专项 Debug、P0-P7 26 组集成、Formal Resource 新版链 6 项回归、Candidate 编排 14 项回归与 Production Build 全部通过；真实《狼》页面确认旧可见入口为 0，浏览器控制台错误为 0。

## 素材切换状态恢复约束（2026-08-09）

Candidate 与发布状态的页面投影必须绑定明确的 `materialVersionId + materialObservationPlanId`。工作台切换素材时应恢复该素材最近一次有效 Plan；路由 Plan 只能作用于同一素材，不能跨素材复用。切换行为不得创建、失效或重排 Candidate，也不得改变 Formal Resource 与 Active Registry。回归测试必须覆盖多 Plan 素材切出再切回后，已发布任务仍保持已发布、待处理任务仍保持待处理，顶部统计与任务卡逐项一致。

## 采用并发布后的读取一致性（2026-08-09）

`adoptAndPublishCandidate` 的成功结果与工作台的可见发布状态属于两个不同边界：前者是应用命令结果，后者必须由 Shared Store 中的 Formal Resource 与 Active Registry 重新投影。命令成功后，工作台必须按当前 Material 与 Plan 刷新快照，再展示成功提示、已发布标签、顶部统计和正式资源入口。

禁止仅依赖 `visibleState = published` 写入临时成功文案，同时继续使用采用前的 `publishedResources` 缓存。刷新操作不得重放采用或发布命令；它只负责读取正式结果，因此不会产生重复 Formal Version 或 Registry Entry。

专项回归已覆盖“发布成功分支必须刷新当前素材和 Plan 快照”。浏览器真实数据验收显示《狼》三个训练任务均恢复为已发布，顶部为“待发布 0 / 已发布 3”，控制台无异常。

## 补充计划修订的发布状态继承与单题隔离（2026-08-18）

采用 `supplement_group` 后形成新 Observation Plan Revision 时，应用层必须以稳定 TrainingTask 谱系而非当前 Plan ID 判断既有正式资源：

1. 原任务的 `taskRevisionRootId` 必须保持不变，新 Plan 中的任务可以拥有新的 `observationTaskPlanId`，但必须保留父任务身份；
2. 原 Active Link 可以继续指向谱系中的旧任务身份，也可以幂等同步到新任务身份；两种形式在读取投影中都必须解析为同一个已发布任务；
3. Draft 同步只更新仍可编辑的 Draft，不得把已冻结或已发布 Draft 复制成“当前未发布草稿”，也不得用 Draft 身份差异覆盖已成立的正式资源；
4. 新增任务不得复用现有任务的 TrainingTask、QuestionLineage、Formal Resource 或 Active Link 身份；
5. Candidate 后台加载、初始 Candidate 恢复和单题发布运行态必须按稳定 TrainingTask 身份隔离，不得触发相邻卡片状态变化；
6. 卡片与顶部统计必须消费同一个权威发布投影。只要谱系中存在当前 Active Formal Resource，状态必须优先显示“已发布”，Candidate 可用性不得覆盖该状态；
7. 单题发布成功必须在权威刷新后确认目标题形成 Active Link，再显示成功并更新统计。其余任务的发布状态和正式版本不得变化。

最低回归场景固定为：某材料已有 3 道已发布任务，补充采用 2 道新任务（其中至少 1 道为 `single_choice`）。补充采用完成后必须保持“已发布 3 / 待发布 2”；发布该单选题后必须变为“已发布 4 / 待发布 1”。旧三题始终保持已发布，另一道新增题保持待处理，不得出现整组“可以发布”、发布数量回退或多道题共同进入运行态。

## 初始 Candidate 上下文恢复一致性（2026-08-09）

TrainingTask 已携带完整题目时，页面是否显示“生成题目”必须由当前有效初始 Candidate 决定，不能只根据历史 Candidate 是否存在判断。初始 Candidate 的确定性身份必须纳入完整 `CandidateRuntimeContext`；Material、Plan、Active Draft 或 Base Formal Version 任一身份变化时，应创建当前上下文对应的新 Candidate，并使旧上下文 Candidate 失效。

已失效的旧 Candidate 不得因复用相同 `trainingTaskId + trainingTaskVersion + contentHash` 阻断当前 Candidate 的恢复。切换素材、切换 Plan 或刷新后，只要训练任务仍含完整题目，任务卡就必须显示题目正文以及“重新生成题目 / 采用并发布”，不得误显示“生成题目”。

专项 Debug 已增加 Plan 上下文变化用例，初始 Candidate 回归 `6 / 6 PASS`；Candidate Workbench P6、任务生产状态与 Production Build 均通过。真实《皇帝的新装》页面验收确认三个已有题目的任务均恢复为当前候选，不再显示“生成题目”。

## 单人生产可见状态与内部资料缺口收口（2026-08-11）

本节覆盖此前将内部 Candidate 完整性直接表达为“题目方案待补全 / 补全题目方案”的页面规则。单人 AI 生产场景中，人工只判断题目是否可以采用，不负责理解或补写 Candidate、Rubric、Answer Acceptance 等内部生产字段。

任务卡主状态统一为 `待处理 / 处理中 / 已发布`。以下五项只定义三种主状态下的卡内决策情形与原因文案，不得作为新的主状态标签或顶部统计项：

| 决策情形 | 主状态映射 | 卡内原因与操作 |
| --- | --- | --- |
| `未生成题目` | 待处理 | 题目正文尚未形成，主操作为“生成题目” |
| `可以发布` | 待处理 | 题目方案完整且没有需要人工判断的质量提醒，操作为“重新生成题目 / 采用并发布” |
| `需要判断` | 待处理 | 题目存在可见质量提醒，用户在当前方案与 AI 新方案中作出选择，再执行“采用并发布” |
| `命令执行中` | 处理中 | 采用、检查、确认留痕、冻结或发布命令正在运行，不提供重复提交入口 |
| `正式资源已成立` | 已发布 | Formal Resource 与 Active Registry 均已成立，正式资源保持只读 |

顶部统计继续只保留互斥的 `待发布 / 已发布`。上述决策情形、任务卡主状态与顶部统计必须消费同一份任务生产投影，并与《统一资源生产工作台契约》22.2 的映射保持一致。

题目是否已经形成，只由用户可见的题目正文判断。题目正文非空时，兼容适配器必须确定性创建或恢复初始 Candidate；Candidate 完整性检查发现评分、答案范围或其他内部字段缺失时：

- 页面不得显示“题目方案待补全”“补全题目方案”或字段级人工编辑入口；
- 不得把已有题目重新投影成“未生成题目”，也不得要求用户先补全 Candidate；
- 缺失的内部资料由采用后的 Validation 与 Assessment 统一判断：可自动补齐的由系统处理，普通提醒作为“待处理”卡片内的“需要判断”原因展示，真实阻断项才禁止发布；
- 只有题目正文为空时，页面才显示“未生成题目 / 生成题目”。

已有题目且没有提醒时，卡片主状态显示“待处理”，卡内原因可表达为“可以发布”；存在普通提醒时，卡片仍显示“待处理”，卡内原因表达为“需要判断”，并由唯一主操作“采用并发布”承接结构化留痕；真实阻断问题仍禁止发布，只允许系统重新生成或修复。Candidate 完整性与上述原因文案都不得单独成为用户生命周期状态。Candidate、Revision、Validation、Assessment、Human Review、Freeze、Formal Resource 与 Registry 的领域边界保持不变。

## 候选操作状态隔离与错误可见性（2026-08-12）

1. Candidate 的生成、重新生成、采用与发布状态必须按任务身份隔离；一项任务运行命令时，不得把相邻任务投影为相同 Loading；
2. 候选列表的后台重新读取不等于候选生成，不得复用 `regenerating / adopting` 的按钮文案或禁用语义；
3. 摘要快捷按钮与展开 Candidate 决策区必须传递同一个已选 Candidate，执行层不得再次用不同工作状态默认值寻找候选；
4. 主按钮触发的错误必须同步进入任务卡摘要的 `alert`，即使卡片保持折叠也能看到；详情区只补充原因与恢复动作；
5. 对 `expired` 初始 Candidate 的上下文恢复必须由 Candidate Service 完成，不允许页面绕过不可变记录直接修改状态；
6. 回归测试必须断言：单任务采用不会改变其他任务的操作文案、已显示主操作不会静默返回、失败反馈不依赖展开卡片。
