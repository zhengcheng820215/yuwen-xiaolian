# 统一资源生产工作台契约

英文名称：Unified Resource Production Workbench Contract

状态：DESIGN FROZEN / P0-P7 FINAL INTEGRATION ACCEPTED / AI QUANTITY CALIBRATION ENGINEERING IMPLEMENTED / REAL MATERIAL ACCEPTANCE PENDING
文档版本：`unified_resource_production_workbench_v1.1`
更新日期：2026-08-03

## 一、文档目标

本文冻结素材录入、训练任务规划、题目修改、质量检查、最终确认与正式发布在统一工作台中的产品边界、对象关系、状态计算和迁移顺序。

统一工作台的目标是让用户围绕同一组训练任务完成一条连续生产链：

```text
素材录入
-> AI 规划训练任务
-> 人工编辑与保存
-> 题目检查
-> 最终确认
-> 正式发布
```

本文合并的是前台工作路径，不合并底层领域命令、审计结果和正式资源边界。

以下能力仍必须独立、可追溯并可单独失败或重试：

1. 保存 Draft Revision；
2. 运行 Contract Validation 与 Quality Assessment；
3. 提交最终确认；
4. 记录 Human Review Decision；
5. Freeze 当前确认的 Revision；
6. 创建 Formal Question Version；
7. 更新 Registry 与材料观测关联。

## 二、与现有契约的关系

本文是统一工作台的目标架构契约，不废弃现有领域契约。

| 契约 | 在统一工作台中的职责 |
| --- | --- |
| [录入字段契约](./AUTHORING_FIELD_CONTRACT.md) | 继续负责字段含义、来源、读写路径、失效和错误定位 |
| [单训练任务重新生成契约](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md) | 继续负责单任务 AI 候选、采用和身份边界 |
| [训练任务组 AI 规划契约](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md) | 继续负责整组规划、补充候选、采用与 Revision 边界 |
| [录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md) | 继续负责内容编辑权、人工裁决权和正式化权的领域边界 |
| [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md) | 继续负责 Assessment、Human Review、Freeze、Publication 和失败恢复 |
| [产品颜色语义规范](./PRODUCT_COLOR_SEMANTICS.md) | 继续负责状态色、操作色和 AI 相关能力的颜色语义 |

当本文与现有契约涉及不同层级时：

1. 本文负责统一入口、任务卡状态和前台操作顺序；
2. 现有领域契约负责字段、命令、审计和正式资源写入；
3. 不得为了前台合并而删除领域记录或绕过现有校验；
4. 若出现真实冲突，必须先修订契约，不得在页面组件中建立第二套状态解释。

## 三、核心产品原则

### 3.1 一条生产线，而不是两个平台来回跳转

用户从素材进入后，应在同一工作台中持续看到：

1. 当前训练任务组；
2. 每项训练任务的当前状态；
3. 每项任务唯一的下一步操作；
4. 已发布正式题目与当前修订工作的并存关系；
5. 当前可发布任务数量和失败恢复入口。

页面可以按任务展开编辑、检查、确认和发布内容，但不得要求用户通过另一个平台重新定位同一任务。

### 3.2 前台合并，领域命令保持独立

统一页面不得把保存、检查、确认和发布实现为一个不可追溯的写入操作。

即使提供“确认通过并发布”快捷操作，内部也必须按顺序调用独立命令，并返回每一阶段的结果。

### 3.3 状态属于任务，不属于页面

页面标题、页签或当前展开区域不能决定业务状态。

每项训练任务必须根据相同的领域记录计算状态。离开页面、刷新、切换素材或重新进入时，状态必须可恢复。

### 3.4 一项任务只有一个主状态和一个主操作

同一时刻，任务卡只强调一个当前主状态和一个推荐主操作。

AI 生成、人工调整、来源、历史正式版本等属于辅助信息，不得与生命周期主状态并列竞争。

## 四、Training Task 与 Question 的关系

### 4.1 对象定义

`TrainingTask` 是生产过程中的训练目标容器，描述本项任务训练什么、基于什么材料、要求学生完成什么以及系统观察什么。

`QuestionLineage` 是该训练任务对应题目的稳定演进线，承载草稿、Revision 和正式版本之间的身份关系。

`QuestionDraft` 是当前可编辑内容。

`QuestionRevision` 是一次保存或提交形成的不可变快照。

`FormalQuestionVersion` 是由已确认 Revision 冻结形成的正式题目版本。

### 4.2 冻结关系

本阶段采用以下关系：

```text
TrainingTask
    1:1
QuestionLineage
    ├── ActiveQuestionDraft：最多 1 个
    ├── QuestionRevision：1..n 个不可变快照
    └── FormalQuestionVersion：0..n 个正式版本
```

硬规则如下：

1. 一项 `TrainingTask` 在本阶段只对应一条 `QuestionLineage`；
2. 一条 `QuestionLineage` 同时最多存在一个活动草稿；
3. 修改已发布题目时，不覆盖已有正式版本，而是在同一 Lineage 下创建新 Revision；
4. 发布单位是某项 `TrainingTask` 当前已确认且未变化的 `QuestionRevision`；
5. 若要从同一训练目标生产第二道独立题目，应创建新的 `TrainingTask`，不得在同一活动草稿中隐式分叉；
6. AI 重新生成只产生候选或更新活动草稿，不得静默创建第二条题目 Lineage；
7. 任务删除、停用或替换不得删除历史 Revision、Human Review 或 Formal Version。

### 4.3 建议身份字段

```ts
type TrainingTaskQuestionBinding = {
  trainingTaskId: string;
  questionLineageId: string;
  activeDraftId?: string;
  activeRevisionId?: string;
  confirmedRevisionId?: string;
  latestFormalVersionId?: string;
};
```

`trainingTaskId` 和 `questionLineageId` 必须稳定。页面顺序号、卡片标题和显示名称不得充当持久化身份。

## 五、写入与失效边界

### 5.1 编辑

人工编辑或采用 AI 候选后：

1. 只更新当前任务的活动草稿；
2. 标记当前任务为 dirty；
3. 使旧 Assessment 对当前活动内容失效；
4. 使绑定旧 Revision 的最终确认失效；
5. 不影响其他任务；
6. 不覆盖已发布正式版本。

### 5.2 保存

保存负责持久化当前任务内容，不等于检查、最终确认或发布。

连续多次编辑在未形成正式检查或提交边界前，应优先复用当前活动 Revision，避免无意义堆积版本。

创建新 Revision 的时机必须由 Revision 契约统一决定，页面按钮不得自行生成版本号。

### 5.3 检查

Assessment 必须绑定：

1. `draftId`；
2. `draftRevision`；
3. `ruleVersion`；
4. 完整检查状态；
5. 检查时间与执行结果。

只有当前 Revision、当前规则版本且状态完成的 Assessment 才可用于最终确认。

### 5.4 最终确认

最终确认必须绑定精确的 `QuestionRevision` 和当前 Assessment。

确认后正式字段只读。如需修改，必须退回当前任务进入修订状态，形成新 Revision 并重新检查。

### 5.5 发布

发布只消费已确认且自确认后未变化的 Revision。

发布必须幂等：同一 Revision 重试不得创建重复 Formal Version。

若 Human Review 已完成但 Registry 写入失败，应保留审核决定和已创建的 Freeze / Formal Version，并从失败阶段继续重试。

## 六、统一命令边界

统一工作台必须通过明确命令执行操作，不得让多个按钮共用含义模糊的 handler。

```ts
type TaskProductionCommand =
  | 'createTaskQuestionDraft'
  | 'editTaskQuestion'
  | 'saveTaskDraft'
  | 'runTaskCheck'
  | 'submitTaskForFinalConfirmation'
  | 'recordTaskConfirmationDecision'
  | 'returnTaskForRevision'
  | 'publishConfirmedTask'
  | 'retryTaskPublication'
  | 'viewFormalQuestion';
```

命令语义：

| 命令 | 允许写入 | 禁止隐含行为 |
| --- | --- | --- |
| `createTaskQuestionDraft` | 为当前 Training Task 创建或复用唯一活动 Draft | 不创建平行 Draft、不检查、不确认、不发布 |
| `editTaskQuestion` | 活动草稿 | 不保存、不检查、不确认、不发布 |
| `saveTaskDraft` | 当前活动 Draft / Revision | 不自动检查、不自动确认 |
| `runTaskCheck` | 当前 Revision 的 Assessment | 不修改正式字段 |
| `submitTaskForFinalConfirmation` | 提交记录 | 不形成通过决定、不发布 |
| `recordTaskConfirmationDecision` | Human Review Decision | 不静默修改题目 |
| `returnTaskForRevision` | 退回记录与任务状态 | 不创建第二个 Draft |
| `publishConfirmedTask` | Freeze、Formal Version、Registry | 不重新审核、不覆盖旧正式版本 |
| `retryTaskPublication` | 从已有发布结果继续 | 不重复创建已成功对象 |
| `viewFormalQuestion` | 无 | 只读，不触发状态迁移 |

### 6.1 P3 可执行命令契约

页面按钮不得直接串联 Repository、API 或领域写入。页面只负责发出一个明确命令，应用层命令执行器负责阶段编排、幂等、并发保护和失败恢复。

```ts
type TaskProductionCommandStatus =
  | 'completed'
  | 'reused';

type TaskProductionCommandResult<T = unknown> = {
  command: TaskProductionCommand;
  commandId: string;
  idempotencyKey: string;
  targetId: string;
  expectedRevision?: number;
  status: TaskProductionCommandStatus;
  completedStages: string[];
  value?: T;
};

type TaskProductionCommandStageError<T = unknown> = Error & {
  status: 'partially_completed';
  command: TaskProductionCommand;
  commandId: string;
  idempotencyKey: string;
  targetId: string;
  expectedRevision?: number;
  completedStages: string[];
  failedStage: string;
  nextCommand?: TaskProductionCommand;
  partialValue?: T;
};
```

幂等键至少由以下事实组成：

```ts
`${command}:${targetId}:r${expectedRevision ?? 'none'}`
```

其中 `targetId` 必须稳定指向本次写入对象：优先使用 `draftId`，尚无 Draft 时使用 `questionLineageId` 或 `trainingTaskId`，计划级命令使用 `planId`。页面不得用展示序号或临时数组下标生成该值。

同一目标、同一 Revision、同一命令在执行期间只能存在一个活动 Promise。重复点击必须复用当前执行结果，不得再次发起写入；与当前命令冲突的操作必须暂时禁用并显示正在执行的动作。

### 6.2 Revision 与写入规则

1. `saveTaskDraft` 只在正式字段发生变化时创建一个新 Revision；内容未变化时复用当前 Revision；
2. `runTaskCheck` 只为当前 Draft Revision 和当前规则版本写入 Assessment，不创建 Revision；
3. `submitTaskForFinalConfirmation` 只创建或恢复当前 Revision 的提交记录，不形成 Human Review Decision；
4. `recordTaskConfirmationDecision` 只绑定当前 Revision 写入审核决定，不修改 Draft；
5. `publishConfirmedTask` 只消费已确认且未变化的 Revision；同一 Revision 重试必须复用 Freeze、Formal Version 和 Registry 结果；
6. `retryTaskPublication` 必须从已持久化的成功阶段继续，不得重新创建已存在的审核决定、Freeze 或 Formal Version；
7. `returnTaskForRevision` 返回原 Draft Lineage，后续修改产生新 Revision，不创建平行 Draft。

页面可提供“保存并重新检查”等组合动作，但组合只能存在于应用层命令执行器中。成功时返回 `TaskProductionCommandResult`；任一阶段失败时抛出 `TaskProductionCommandStageError`，由错误对象携带完整阶段结果。例如：

```ts
{
  command: 'runTaskCheck',
  completedStages: ['draft_saved'],
  failedStage: 'assessment_completed',
  nextCommand: 'runTaskCheck',
  status: 'partially_completed'
}
```

页面应据此显示“草稿已保存，检查未完成，可继续检查”，不得把部分成功伪装成完全失败，也不得要求用户重复保存。

### 6.3 失败恢复与反馈

命令失败必须保留并返回：

1. 已完成阶段；
2. 失败阶段；
3. 当前持久化 Revision；
4. 可重试的下一条命令；
5. 面向用户的阶段化提示；
6. 折叠展示的技术错误信息。

所有异步命令点击后必须立即进入 Loading，按钮文案描述当前动作；完成后在操作附近显示结果并刷新统一生产状态。不得仅把按钮变灰后静默等待。

### 6.4 P3 验收边界

P3 至少验证：

1. 连续点击同一命令只产生一次写入；
2. 保存成功、检查失败后重试只执行检查；
3. 提交成功、草稿创建失败后重试不重复提交训练计划；
4. 审核决定成功、发布失败后保留审核结果并只重试发布；
5. Registry 写入失败后复用已有 Freeze 和 Formal Version；
6. 页面不再直接组合保存、检查、提交、确认和发布 API；
7. 所有命令完成后，任务卡、总览和主操作读取同一个 Resolver 结果。

## 七、唯一生产状态解析

### 7.1 单一解析函数

任务卡、主操作、任务组总览、刷新恢复和深链接必须消费同一个纯函数结果：

```ts
type TaskProductionState =
  | 'draft_empty'
  | 'editing'
  | 'check_required'
  | 'checking'
  | 'revision_required'
  | 'pending_confirmation'
  | 'confirmed'
  | 'publishing'
  | 'publication_failed'
  | 'published';

type TaskProductionAction =
  | 'edit'
  | 'save'
  | 'run_check'
  | 'open_confirmation'
  | 'confirm'
  | 'return_for_revision'
  | 'publish'
  | 'retry_publication'
  | 'view_formal_resource';

type TaskProductionView = {
  trainingTaskId: string;
  questionLineageId: string;
  primaryState: TaskProductionState;
  activeDraftId?: string;
  activeRevisionId?: string;
  confirmedRevisionId?: string;
  latestFormalVersionId?: string;
  hasPublishedVersion: boolean;
  availableActions: TaskProductionAction[];
  primaryAction?: TaskProductionAction;
  blockedReasons: string[];
  statusReasonCodes: string[];
};

function resolveTaskProductionState(input: TaskProductionSource): TaskProductionView;
```

禁止以下做法：

1. 任务卡单独读取 `reviewStatus` 决定状态；
2. 总览单独读取 `publicationStatus` 决定数量；
3. 按钮仅根据 `validation.pass` 决定是否可用；
4. 通过页面路由、展开状态或按钮文案反推领域状态；
5. 在组件内拼接一套与 Resolver 不一致的生命周期。

### 7.2 主状态优先级

若一项任务已经有正式版本，同时又存在新 Revision，主状态必须反映当前正在处理的新 Revision，正式版本作为辅助事实保留。

示例：

```ts
{
  primaryState: 'revision_required',
  hasPublishedVersion: true,
  latestFormalVersionId: 'formal-question:v1',
  activeRevisionId: 'question-revision:3'
}
```

页面应显示“需要修改”，并提供“继续修改”；同时可提供次要链接“查看已发布题目”。不得因为存在旧正式版本而把当前任务误显示为“已发布完成”。

### 7.3 状态与主操作

| 主状态 | 用户可见文案 | 主操作 |
| --- | --- | --- |
| `draft_empty` | 尚未生成题目 | AI 生成或人工创建 |
| `editing` | 编辑中 | 保存任务 |
| `check_required` | 待检查 | 运行题目检查 |
| `checking` | 正在检查 | 无，显示 Loading |
| `revision_required` | 需要修改 | 继续修改 |
| `pending_confirmation` | 待最终确认 | 进入最终确认 |
| `confirmed` | 已确认，待发布 | 发布正式题目 |
| `publishing` | 正在发布 | 无，显示 Loading |
| `publication_failed` | 发布未完成 | 重试发布 |
| `published` | 已发布 | 查看正式题目 |

`pending_confirmation` 可在内部继续区分“尚未提交确认”和“等待形成确认决定”，但任务卡仍只展示一个可理解的主状态。

## 八、任务卡职责

### 8.1 卡片首层

每张训练任务卡首层只展示：

1. 训练任务编号或名称；
2. 当前主状态；
3. 唯一主操作；
4. 来源、能力、难度、材料范围等少量辅助标签；
5. 若存在正式版本，展示“查看已发布题目”次要入口。

来源信息和生命周期状态必须分开：

```text
来源：AI 生成
状态：需要修改
```

不得把“AI 生成”“人工调整”“审核通过”“已发布”当成同一维度的并列状态。

### 8.2 展开区

卡片展开后根据 `primaryState` 呈现对应工作区：

1. 编辑中：题目字段、评分规则与保存；
2. 待检查：检查摘要与运行检查；
3. 需要修改：问题、原因、建议和定位修改；
4. 待最终确认：只读内容、学生预览、待确认事项和确认决定；
5. 已确认：发布准备和发布操作；
6. 发布失败：阶段化失败结果和重试入口；
7. 已发布：正式资源摘要和查看入口。

一个展开区不得同时展示多个阶段的主按钮。

## 九、任务组总览与数量守恒

### 9.1 派生计算

任务组状态必须从全部 `TaskProductionView` 派生，不得单独维护一份可漂移的任务组状态。

```ts
type TaskGroupProductionSummary = {
  total: number;
  editingOrCheckRequired: number;
  pendingConfirmation: number;
  confirmedNotPublished: number;
  published: number;
  aggregateState: 'empty' | 'in_progress' | 'ready' | 'partial' | 'published';
};

function resolveTaskGroupSummary(
  tasks: TaskProductionView[]
): TaskGroupProductionSummary;
```

### 9.2 数量守恒

总览采用互斥分类，必须满足：

```text
editingOrCheckRequired
+ pendingConfirmation
+ confirmedNotPublished
+ published
= total
```

阻断、提醒、失败次数、重复修改次数属于附加指标，不参与主状态数量相加。

### 9.3 任务组状态

| 派生状态 | 条件 |
| --- | --- |
| `empty` | 没有训练任务 |
| `in_progress` | 至少一项任务仍在编辑、检查、确认或失败恢复 |
| `ready` | 所有未发布任务均已确认，可执行发布 |
| `partial` | 同时存在已发布任务和未完成任务 |
| `published` | 所有任务均已发布 |

任务组状态不得人工选择或持久化为第二套事实来源。

## 十、部分发布

部分发布依赖本契约前置能力完成后再实施。

### 10.1 可发布集合

可发布任务必须同时满足：

1. 当前活动 Revision 已形成有效 Assessment；
2. 已形成绑定该 Revision 的最终确认决定；
3. 确认后内容未变化；
4. 该 Revision 尚未成功发布；
5. 当前不存在不可恢复的发布冲突。

### 10.2 页面操作

任务卡提供单项发布；任务组可提供：

```text
发布已确认题目（N）
```

该操作只发布满足条件的任务。其他任务保留当前状态，不被自动删除、退回或重建。

### 10.3 失败恢复

批量发布返回逐项结果：

```ts
type BatchPublicationResult = {
  succeededTaskIds: string[];
  failed: Array<{
    trainingTaskId: string;
    failedStage: 'freeze' | 'formal_version' | 'registry';
    retryable: boolean;
    errorCode: string;
  }>;
};
```

成功项立即显示已发布；失败项显示发布未完成并保留单项重试入口。不得因为部分失败回滚已成功任务，也不得重复生成正式版本。

## 十一、统一页面区域

统一工作台建议固定为以下区域：

1. 素材与任务组总览：只展示素材、版本和互斥状态数量；
2. AI 规划区：首次生成、补充生成、重新规划和候选采用；
3. 训练任务列表：承载每项任务的状态、主操作和展开区；
4. 任务组操作区：保存任务组、批量检查或发布已确认任务；
5. 历史与审计入口：查看 Revision、Assessment、Human Review 和正式版本。

总览数据只负责导航和理解整体进度，具体状态原因与查看操作必须落到对应训练任务卡。

### 11.1 AI 规划数量与上下文

AI 规划区的产品行为统一为：

1. 首次规划由 AI 在 `2—3` 条范围内推荐任务数量；`3` 条是常见建议，不是固定目标；
2. 首次结果必须展示推荐数量、推荐理由、能力覆盖和观察方向，让用户理解“为什么适合这些任务”；
3. 首次生成不提供“为了凑数量继续生成”的隐式重试；用户完成初步检查并发现覆盖缺口后，才通过“补充生成候选任务”补足缺失观察；
4. “补充生成候选任务”根据覆盖缺口返回 `1—2` 条候选，采用后当前任务组最多 `5` 条；
5. 已有 `5` 条任务时禁用补充入口，并明确提示先检查、删除或完成现有任务；
6. 补充生成必须感知当前任务、未采用候选及同一 Material Version 下待审核或已发布兄弟任务，围绕覆盖缺口生成，不得退化为无上下文续写；
7. 页面展示候选的新增观察价值及与已有任务的差异；没有有效增量时展示正常空结果，不创建候选或 Revision；
8. 候选生成、放弃和采用到编辑缓冲区继续遵守既有版本边界，只有真实保存与提交审核才形成对应工作草稿或不可变 Revision；
9. 页面不得使用“添加更多任务”“补充更多任务”或“再生成几个”等数量导向文案；补充数量不作为用户选择项。

具体输入、去重集合、数量计算和质量优先级以 [训练任务组 AI 规划契约 v1.3](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md) 为准。当前工程实现与自动化 Debug 已完成；真实材料浏览器验收完成前不得标记为最终验收通过。

## 十二、旧审核页兼容策略

现有题目审核与发布页面不立即删除，先退化为 `Question Review Detail`。

该页面用于：

1. 历史链接兼容；
2. 审计与问题追溯；
3. Debug 和客服定位；
4. 查看旧 Revision、Assessment、Human Review 和 Publication；
5. 未来多人权限模式下恢复独立审核入口。

迁移完成后，该页面默认只读，不再作为单人生产主入口，不再提供与统一工作台重复的保存、检查、确认或发布动作。

## 十三、异步反馈与错误处理

所有异步主操作必须立即提供可见反馈：

1. 点击后首帧进入 Loading；
2. 只禁用冲突操作，不把正常按钮伪装为永久禁用；
3. Loading 文案说明正在执行的具体阶段；
4. 成功反馈靠近操作位置，并可辅以 Toast；
5. 失败反馈说明已完成阶段、失败阶段、是否可重试和下一步；
6. 错误码默认折叠到技术信息，不直接替代用户可理解文案；
7. 刷新恢复后必须继续显示真实状态，不依赖内存中的临时 Loading。

阶段化操作示例：

```text
训练任务已保存
题目检查已完成
最终确认提交失败，可重试
```

不得只显示“操作失败”或长时间无响应。

## 十四、实施顺序

### P0：冻结契约与身份边界

1. 评审并冻结本文；
2. 冻结 `TrainingTask -> QuestionLineage` 关系；
3. 明确稳定 ID、活动草稿、Revision 和 Formal Version；
4. 明确统一工作台与现有契约的权威关系；
5. 暂不移动页面和写入逻辑。

### P1：统一只读状态模型

1. 实现 `resolveTaskProductionState()` 纯函数；
2. 实现 `resolveTaskGroupSummary()` 纯函数；
3. 为状态优先级、数量守恒和正式版本并存场景补测试；
4. 让两个现有页面先读取同一个 Resolver；
5. 暂不改变写入命令。

### P2：改造录入端训练任务卡

1. 每张任务卡展示主状态和主操作；
2. 将来源与状态分层；
3. 将题目状态和查看入口下沉到任务卡；
4. 上部只保留互斥数据总览；
5. 保持现有编辑能力不变。

### P3：统一命令与写入边界

1. 盘点保存、检查、提交、确认、发布与重试 handler；
2. 建立带幂等键和单目标并发保护的应用层 Command Runner；
3. 将页面中的保存并检查、提交最终确认、审核决定和发布链路迁入独立 Command；
4. 清除按钮直接拼装领域写入的路径；
5. 返回 `completedStages`、`failedStage` 和 `nextCommand` 等阶段化结果；
6. 补齐 Loading、重复点击复用和部分成功恢复；
7. 用真实 Revision 冲突、Assessment 失效和发布部分失败场景完成回归。

### P4：迁移检查与最终确认

1. 将题目检查嵌入任务卡；
2. 将最终确认嵌入任务卡；
3. 保留 Human Review 与 Revision 绑定；
4. 将旧审核页改为只读详情；
5. 验证退回后回到同一 Draft 和同一 TrainingTask。

#### P4.1 页面职责

1. 训练任务卡是日常生产主入口，负责展示当前主状态、下一步主操作、检查摘要、待确认事项和发布结果；
2. 任务卡内可执行保存、题目检查、提交最终确认、记录确认决定、退回修改和查看正式资源；
3. 旧题目审核页退化为 `Question Review Detail`，只用于历史链接、审计、调试和完整字段查看，不再作为正常生产链主入口；
4. 旧页不得继续提供与任务卡重复的保存、检查、提交、确认或发布写入控件；
5. 任务卡需要查看完整详情时可以进入只读详情，但返回后必须恢复原素材、原任务和原滚动上下文。

#### P4.2 检查结果与当前性

题目检查必须区分两个结果：

1. `QuestionDraftValidation`：结构、必填字段和受控字段校验；
2. `QuestionQualityAssessment`：语义质量、提醒、阻断项和人工确认项。

只有以下条件同时成立，任务才可显示“题目检查完成”：

```ts
type CurrentTaskCheckState =
  | 'missing'
  | 'checking'
  | 'current'
  | 'stale_by_revision'
  | 'stale_by_rule_version'
  | 'failed';

const isTaskCheckCurrent =
  validation.passed === true &&
  assessment.draftRevision === draft.revision &&
  assessment.ruleVersion === currentRuleVersion &&
  assessment.status === 'completed';
```

工程硬规则：

1. 结构校验通过不得单独映射为完整检查通过；
2. 任务卡、只读详情、提交最终确认和发布准备必须消费同一个当前性结果；
3. 修改任一正式字段后，旧 Assessment 立即失效；
4. 检查命令必须针对同一 `draftId + draftRevision` 依次形成结构校验和完整 Assessment；
5. 结构校验成功但 Assessment 失败时，页面显示阶段化结果和可重试动作，不得伪装为检查完成。

#### P4.3 状态与任务卡动作

| 生产状态 | 任务卡主提示 | 主操作 | 辅助操作 |
| --- | --- | --- | --- |
| `editing` / `check_required` | 当前题目需要完成检查 | 保存并检查 / 检查题目 | 编辑并校准 |
| `checking` | 正在检查当前题目 | Loading，不可重复触发 | 无 |
| `revision_required` | 当前题目需要修改 | 定位修改 | 查看退回原因 |
| `pending_confirmation` 且尚未提交 | 检查完成，等待最终确认 | 提交最终确认 | 查看检查记录 |
| `pending_confirmation` 且已提交 | 当前 Revision 正在最终确认 | 确认通过 / 退回修改 | 查看提交信息 |
| `confirmed` | 已确认，待发布 | 进入发布 | 查看确认记录 |
| `publication_failed` | 审核已通过，发布未完成 | 重试发布 | 查看技术信息 |
| `published` | 已发布 | 查看正式资源 | 查看历史 |

任务卡只显示一个主操作。辅助操作不得复制主操作，也不得用状态标签伪装成按钮。

#### P4.4 命令与写入边界

任务卡只能调用 P3 已冻结的应用层命令：

```ts
createTaskQuestionDraft
runTaskCheck
submitTaskForFinalConfirmation
recordTaskConfirmationDecision
returnTaskForRevision
```

约束如下：

1. 页面不得直接调用 Repository 或拼装 Human Review、Assessment、Revision 写入；
2. 每个命令必须绑定 `trainingTaskId + questionLineageId + draftId + expectedRevision`；
3. 每个命令必须返回 `completedStages`、`failedStage`、`nextCommand` 和用户可理解的阶段提示；
4. 点击后立即进入 Loading，完成后原地显示结果；失败提示应出现在触发动作附近，技术信息默认折叠；
5. 重复点击复用同一个执行，不得创建重复 Assessment、Human Review 或 Draft。
6. 同一 `draftId + actionKind` 在命令完成前只能存在一个在途请求。前端必须在事件入口同步加锁，不能只依赖 React 禁用态；命令完成、失败或抛错后必须释放锁，并由统一 Resolver 重新计算任务卡状态。
7. 尚无题目 Draft 的训练任务必须通过 `createTaskQuestionDraft` 创建首个活动 Draft；命令以 `observationTaskPlanId` 为稳定幂等目标，成功后路由必须携带返回的 `draftId`，不得先跳转到空白编辑表单。

#### P4.5 提醒与最终确认

1. 非阻断提醒必须在任务卡内展示简洁标题、当前设置、原因、建议和定位修改；
2. 用户保留当前设置时，必须为每项提醒填写理由；
3. 提交最终确认前，所有需要确认的提醒必须有录入处理记录；
4. 最终确认展示系统提醒、录入处理方式和理由，确认人只作接受或退回决定；
5. 任一提醒被退回时，当前提交整体进入 `revision_required`，并回到同一 TrainingTask 和同一 Draft；
6. 退回后的第一次内容修改创建新 Revision，旧 Assessment 和 Human Review 保持只读。
7. 任务存在待确认提醒时，点击“进入最终确认”必须先展开当前任务卡，并将理由输入区滚入当前操作上下文；不得把必填字段或校验反馈留在关闭的折叠区内。
8. 缺少提醒处理理由时，提交命令保持原 Draft 不变，错误必须显示在该任务卡内；补充理由后可直接重试，不得要求重新创建题目或重新运行已有效的检查。

#### P4.6 兼容页收口

1. 历史 `/question-resource-workbench` 链接必须继续可打开；
2. 当链接指向已提交、已确认或已发布 Revision 时，页面默认只读；
3. 当链接指向仍可修改的活动 Draft 时，页面提示“请返回训练任务卡继续处理”，不得再提供第二套写入链路；
4. 兼容页的刷新、预览、检查记录和审计信息可保留；
5. 旧可写 handler 在 P4 完成后标记弃用，在 P6 删除。

#### P4.7 Debug 验收

P4 至少通过以下回归：

1. 结构校验通过但缺少当前 Assessment 时，任务卡仍显示“需要完成检查”；
2. 点击检查立即出现 Loading，并在同一 Revision 形成结构校验与完整 Assessment；
3. 检查完成后任务卡原地进入“等待最终确认”，无需跳转旧审核页；
4. 提交最终确认后不创建重复 Draft，重复点击不创建重复 Human Review；
5. 最终确认退回后，任务卡定位同一 TrainingTask 和同一 Draft；
6. 修改、保存并重新检查后 Revision 增加一次，旧 Assessment 失效且新 Assessment 绑定新 Revision；
7. 旧审核链接仍可查看，但不能重复写入；
8. 刷新和跨页返回后，原素材和原任务选择保持；
9. 错误提示出现在当前操作附近，技术错误默认折叠；
10. 构建、P0-P3 回归和 P4 端到端回归全部通过。
11. 首次点击“创建题目”立即显示 Loading，成功后进入已预填的唯一活动 Draft；重复进入复用同一 `draftId`。
12. 带 `materialVersionId` 返回素材工作台时直接恢复“已有素材”和原素材，不得先渲染素材录入表单再延迟切换。
13. 带提醒的任务点击“进入最终确认”后，任务卡自动展开并立即展示提醒理由输入；缺少理由时错误在同一卡片内可见，填写后可完成提交。

#### P4.8 工程落地与 Debug 记录（2026-08-02）

本轮已完成训练任务卡主链路的界面与命令级验收：

1. 真实页面已走通“恢复素材与计划 -> 创建题目 -> 复用唯一活动 Draft -> 检查题目 -> 等待最终确认”；
2. 首个活动 Draft 由 `observationTaskPlanId` 保持幂等，重复进入不会创建第二个 Draft；
3. 检查完成后任务卡直接消费统一生产状态，不再依赖旧审核页拼装下一步；
4. 定位到带提醒任务点击“进入最终确认”无可见反馈的根因：提醒理由输入区位于关闭的任务卡折叠内容中，按钮阻止了 `summary` 默认展开行为；
5. 修复后，该操作会先展开当前任务卡，再把提醒理由区滚入当前操作上下文；必填错误与命令反馈均在同一卡片内显示；
6. 缺少理由时不写入 Draft、Revision 或 Human Review，填写后可直接重试；
7. 独立命令运行时验证了在途请求复用、失败释放锁、不同 Revision 使用不同幂等键，以及阶段失败保留部分结果；
8. 自动回归共执行 8 组、63 条断言，覆盖单任务生产状态、素材选择恢复、题目命令 E2E、最终确认提交恢复、工作流投影和生产命令边界，全部通过；
9. `vite build` 与 `git diff --check` 通过；构建仅保留既有的大 Chunk 和动态导入提示，不影响本轮结论；
10. 独立 SSR 命令环境缺少页面运行时共享资源服务，真实正式写入会被服务保护正确阻断，且未污染本地正式资源存储；该结果不得误判为页面命令失败；
11. 修复后的最后一段自动视觉点击因应用内浏览器安全策略未能再次执行，命令级 E2E、状态回归和生产构建已覆盖逻辑正确性；后续恢复浏览器控制时仍需补一次视觉确认，检查折叠展开、滚动定位和 Loading 反馈。

P4 当前结论：界面主链路、统一读取状态与独立命令边界已经对齐，可以进入后续部分发布或旧流程收口；不得重新引入隐藏必填项、组件自行判断状态或按钮直接写领域数据。

### P5：实现部分发布

P5 在 P0-P4 已统一的对象关系、状态 Resolver、独立 Command 和任务卡主链路之上增加“按训练任务发布”。部分发布指同一任务组中的不同训练任务可以分别处于待处理、待最终确认、已确认待发布和已发布状态，不表示一次发布命令可以跳过 Revision、Assessment、Human Review、Freeze、Formal Version 或 Registry 边界。

#### P5.1 发布资格唯一计算

所有页面、任务卡、批量操作和刷新恢复必须消费同一个发布资格结果，不得在组件内分别判断 `review.status`、`publication.status` 或按钮可用性。

```ts
type TaskPublicationEligibilityState =
  | 'eligible'
  | 'already_published'
  | 'publishing'
  | 'retryable_failure'
  | 'ineligible';

type TaskPublicationEligibility = {
  trainingTaskId: string;
  questionLineageId: string;
  draftId: string | null;
  confirmedRevisionId: string | null;
  state: TaskPublicationEligibilityState;
  reasonCode: string | null;
  nextCommand: 'publishConfirmedTask' | 'retryTaskPublication' | null;
};

function resolveTaskPublicationEligibility(
  task: TrainingTask,
  binding: TrainingTaskQuestionBinding,
  productionState: TaskProductionView
): TaskPublicationEligibility;
```

任务只有同时满足以下条件才是 `eligible`：

1. `trainingTaskId`、`questionLineageId`、`draftId` 和已确认 Revision 身份完整且互相对应；
2. 当前结构校验与完整 Assessment 均绑定该已确认 Revision 和当前规则版本；
3. Human Review 已通过且绑定同一 Revision；
4. 所有阻断项已关闭，所有需要确认的提醒已有录入处理和最终确认决定；
5. Material Version、Observation Plan、Training Task、Question Lineage 和 Draft 来源链完整；
6. 当前不存在同任务同 Revision 的发布中操作；
7. 尚未存在同一幂等目标的完整正式资源；若已经存在，应返回 `already_published`，不得再次写入。

缺失任一条件时必须返回稳定 `reasonCode`，页面将其翻译为可操作文案；不得直接把内部异常或英文技术信息作为主提示。

#### P5.2 互斥数量与任务组状态

任务组总览继续使用四个互斥主分类：

```ts
type TaskProductionSummary = {
  total: number;
  actionRequired: number;
  pendingConfirmation: number;
  confirmedAwaitingPublication: number;
  published: number;
  aggregateState: 'empty' | 'in_progress' | 'ready' | 'partial' | 'published';
};
```

强制满足：

```text
actionRequired
+ pendingConfirmation
+ confirmedAwaitingPublication
+ published
= total
```

其中：

1. `publishing` 和 `publication_failed` 均归入 `confirmedAwaitingPublication`，避免同一任务被重复计数；
2. 只有全部任务都已发布时，任务组才是 `published`；
3. 至少一项已发布且仍有未发布任务时，任务组为 `partial`；
4. `partial` 必须由单任务状态实时派生，不新增可漂移的持久化布尔字段；
5. 顶部只显示任务组总览，具体状态、查看和重试动作落在对应任务卡上。

#### P5.3 单项发布 Command

单任务发布必须复用已有正式发布链，不新增绕过审核的写入入口：

```ts
type PublishConfirmedTaskCommand = {
  trainingTaskId: string;
  questionLineageId: string;
  draftId: string;
  confirmedRevisionId: string;
  expectedDraftRevision: number;
  reviewDecisionId: string;
  idempotencyKey: string;
};
```

正式命令名称冻结为：

```text
publishConfirmedTask
retryTaskPublication
```

执行规则：

1. Command 内部必须再次校验发布资格，不能信任前端按钮状态；
2. 发布单位是一个已确认的 `QuestionRevision`，不是整个任务组；
3. 同一任务、同一 Revision 和同一发布意图必须复用同一幂等目标；
4. 双击、刷新后重试或网络重放不得生成重复 Freeze、Formal Version 或 Registry Entry；
5. 已发布任务产生新活动 Revision 时，旧正式版本继续保留，新 Revision 按正常检查、确认和发布链处理；
6. 单项失败只影响当前训练任务，不回滚其他已发布任务。

#### P5.4 批量发布编排

批量发布只是多个单项发布命令的编排器，不是跨任务大事务：

```ts
type PublishConfirmedTaskBatchCommand = {
  operationId: string;
  items: PublishConfirmedTaskCommand[];
};
```

约束如下：

1. 批量入口只收集 `eligible` 任务；待修改、待检查、待确认和已发布任务不得进入写入集合；
2. 每项保留独立 Revision 校验、幂等键、结果和审计记录；
3. 一项失败不得回滚其他成功项；
4. 重试时默认只重试失败且仍满足资格的任务；
5. 刷新恢复必须读取持久化发布记录，不依赖组件内存中的批次进度；
6. 批量主按钮文案为“发布已确认题目（N）”；`N = 0` 时不显示可点击的批量发布入口；
7. 单任务卡仍保留“发布正式题目”或“重试发布”，批量入口不得遮蔽具体任务的状态和恢复动作。

#### P5.5 逐项结果与失败恢复

每个任务必须返回结构化结果：

```ts
type TaskPublicationItemResult = {
  trainingTaskId: string;
  confirmedRevisionId: string;
  status: 'published' | 'already_published' | 'failed' | 'skipped';
  completedStages: Array<'eligibility' | 'freeze' | 'formal' | 'registry' | 'trace' | 'link'>;
  failedStage: 'eligibility' | 'freeze' | 'formal' | 'registry' | 'trace' | 'link' | null;
  formalResourceVersionId: string | null;
  registryEntryId: string | null;
  retryable: boolean;
  nextCommand: 'retryTaskPublication' | null;
  userMessage: string;
  technicalCode: string | null;
};
```

批量结果状态为：

```ts
type TaskPublicationBatchStatus =
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'no_eligible_tasks';
```

失败恢复规则：

1. 新发布仍遵守正式资源写入原子性；不得为了支持部分发布而允许不完整正式资源进入学习入口；
2. 对历史遗留的“Formal Version 已存在但 Registry 未完成”等部分状态，重试必须复用已有 Freeze 和 Formal Version，从失败阶段继续；
3. 发布失败不撤销已经形成的最终确认决定，任务进入 `publication_failed` 并显示“重试发布”；
4. 技术错误默认折叠，主提示必须说明当前完成到哪一步、是否可重试以及下一步动作；
5. 学习入口只能读取完整且可解析的正式资源，不得把批次成功误当成每项成功。

#### P5.6 任务卡与任务组交互

任务卡按统一状态展示唯一主动作：

| 任务状态 | 主状态文案 | 主操作 |
| --- | --- | --- |
| `confirmed` | 已确认，待发布 | 发布正式题目 |
| `publishing` | 正在发布 | Loading，不允许重复触发 |
| `publication_failed` | 发布未完成 | 重试发布 |
| `published` | 已发布 | 查看已发布题目 |

任务组区域只承担：

1. 互斥数量总览；
2. `partial` 等聚合状态说明；
3. “发布已确认题目（N）”批量动作；
4. 批量结果摘要。

不得在任务组顶部再次放置每项“查看”“继续修改”或“重试发布”入口，避免与任务卡重复。

#### P5.7 反馈、并发与可感知响应

1. 点击单项或批量发布后，触发按钮必须在同一渲染帧进入 Loading，不能只显示不可点击的普通禁用态；
2. 批量发布期间每张任务卡独立显示进度，完成一项即更新一项，不等待整批结束后统一刷新；
3. 成功可以使用短 Toast，但任务卡必须保留持久的“已发布”状态和“查看已发布题目”入口；
4. 失败提示必须靠近对应任务动作；位于页面顶部且用户当前不可见的全局提示不能作为唯一反馈；
5. 同一 `trainingTaskId + confirmedRevisionId` 同时只允许一个在途发布请求；完成、失败和抛错后都必须释放锁；
6. Revision 冲突只使当前任务失败并提示刷新，不得阻断同批其他任务；
7. 刷新后统一 Resolver 必须从正式记录恢复任务卡、数量总览和批量剩余集合。

#### P5.8 Debug 验收

P5 至少覆盖以下回归：

1. 三个已确认任务只发布一个后，任务组显示 `partial`，数量满足 `0 + 0 + 2 + 1 = 3`；
2. 批量发布两个符合条件的任务，一个成功、一个失败时返回 `partially_completed`，成功项保持已发布；
3. 点击重试只处理失败项，不重复创建成功项的 Formal Version；
4. 连续双击单项发布只形成一套正式记录；
5. 发布前 Revision 已变化时，仅当前任务返回冲突，其他任务继续；
6. 已发布任务再次进入批量集合时返回 `already_published`，不重复写入；
7. 历史部分完成记录重试时从失败阶段继续，不创建第二个 Formal Version；
8. 刷新页面后任务卡状态、`partial` 状态和剩余可发布数量保持一致；
9. 任意状态组合下四个互斥分类之和都等于任务总数；
10. 学习入口只读取 Registry、Trace 和 Material Link 完整的正式资源；
11. 已发布任务产生新 Revision 后，旧正式版本仍可查看，新 Revision 可独立再次发布；
12. 任务卡、批量按钮和 Command 对同一任务的发布资格结论一致；
13. P0-P4 状态、命令、最终确认、素材恢复和学习入口回归全部通过；
14. `git diff --check` 与生产构建通过。

#### P5.9 实施与验收记录

P5 已于 2026-08-03 按“唯一资格计算 -> 单项 Command -> 批量编排 -> 逐项恢复 -> 界面与端到端验收”的顺序完成工程落地：

1. `resolveTaskPublicationEligibility()` 成为任务发布资格的唯一读取投影；只有 `confirmed` 可首次发布，`publication_failed` 可重试，其他状态不进入批量集合；
2. 批量编排隔离在纯函数模块中，顺序调用已有单项发布 Command，不增加另一条正式资源写入链路；
3. 每项结果独立记录，单项失败不中断后续任务；重试集合只包含发布未完成项，已发布项不重复写入；
4. 任务卡在批量期间逐项显示“正在发布”或“等待发布”，批量结束后显示成功、部分完成或失败摘要；
5. 当前真实素材不存在 `confirmed` 或 `publication_failed` 任务时，页面不显示批量发布按钮；这是发布资格计算的正常结果，不是入口缺失；
6. 自动验收已覆盖资格分类、空集合、部分成功、失败隔离、仅重试失败项、回调异常隔离、命令运行时、发布恢复、工作台端到端、展示状态与生产构建；
7. 浏览器验收已确认素材工作台正常加载、任务卡与互斥数量分类正常，页面刷新后无新的运行时错误。

P5 完成不改变 Freeze、Formal Version、Registry 和学习入口的完整性约束，也不为任务组额外写入一个可与单项状态冲突的人工发布状态。

### P6：收口旧流程

P6 的目标不是继续增加功能，而是在 P0-P5 的统一对象、状态、命令、任务卡主链路和部分发布已经稳定后，关闭仍可能形成第二条写入路径的旧流程。

P6 必须同时完成“删除”和“保留”两件事：删除重复写入口、重复 Handler 和重复状态解释；保留历史详情、审计、兼容跳转、正式资源读取和失败恢复。不得把“清理旧页面”理解为删除底层领域命令或历史记录。

#### P6.1 唯一入口与页面职责

1. `MaterialResourceProductionWorkbench` 是训练任务生产的唯一可写主入口；任务卡负责展示当前状态、唯一下一步动作和已发布资源入口；
2. `QuestionResourceWorkbench` 不再作为与素材工作台并列的第二个生产平台；它只承担从任务卡进入的题目详情、检查、最终确认、发布准备，以及历史链接的只读兼容；
3. `mode=plan-review` 仅允许处理当前任务卡明确打开的活动 Draft，不得从页面自行创建另一项 TrainingTask、QuestionLineage 或活动 Draft；
4. `mode=task-detail` 默认只读，用于查看历史 Revision、检查记录、人工决定和正式版本；
5. 首页、内部入口和旧深链不得继续把 `/question-resource-workbench` 暴露为独立录入或审核入口；需要修改时必须返回素材工作台并恢复同一素材、计划、训练任务和 Draft；
6. 预览、审核记录、技术信息和已发布资源详情可以继续存在，但不得提供绕过任务卡状态和 Command Runtime 的写操作。

#### P6.2 旧能力处置分类

P6 开工前必须形成一份逐项处置清单。每个旧入口、组件、Handler、状态字段和测试只能归入以下三类之一：

| 分类 | 适用对象 | 处理规则 |
| --- | --- | --- |
| `delete` | 重复按钮、不可达 Handler、直接新增正式任务的方法、组件内重复状态判断、已失效测试 | 删除实现、调用和测试，不保留隐藏入口 |
| `read_only_adapter` | 历史审核详情、检查记录、预览、正式资源详情、旧提交链接 | 保留读取和展示，移除写操作；需要修改时跳回唯一主入口 |
| `compatibility` | 旧 URL、查询参数、历史身份字段、发布恢复和正式资源读取适配 | 只做身份解析、只读投影或安全跳转，不产生新 Draft、Revision、Review 或 Formal Version |

处置清单至少记录：

```ts
type LegacyFlowDisposition = {
  source: string;
  symbolOrRoute: string;
  disposition: 'delete' | 'read_only_adapter' | 'compatibility';
  replacement?: string;
  evidence: string;
};
```

不能证明用途的代码不得直接删除；确认无入口可达、无领域调用、无兼容职责后，才归入 `delete`。

#### P6.3 路由和深链兼容

| 进入条件 | 页面行为 | 禁止行为 |
| --- | --- | --- |
| 活动 Draft 且来源任务可定位 | 恢复同一素材、计划、训练任务和 Draft；允许执行 Resolver 给出的唯一动作 | 创建新 Draft、切换到同计划其他任务、绕过检查直接确认 |
| `pending_review`、`reviewed`、已发布或历史 Revision | 打开只读详情，并展示返回任务卡、查看记录或查看正式资源 | 静默编辑、覆盖已确认 Revision、重复形成 Review Decision |
| 已发布资源同时存在新活动 Revision | 正式版本只读；新 Revision 的生产状态仍由任务卡承担 | 用旧正式状态覆盖新 Revision 的主状态 |
| 身份缺失、对象已删除或关系无法解析 | 显示可操作的安全回退并返回素材工作台 | 自动创建占位 Draft、猜测绑定或写入修复数据 |
| 旧 `mode` 或历史查询参数 | 通过兼容适配解析到只读详情或唯一主入口 | 继续维护第二套页面状态机 |

兼容跳转必须保留 `materialVersionId`、`planId`、`trainingTaskId`、`draftId` 或可恢复等价身份；跳转丢失身份视为 P6 阻断缺陷。

#### P6.4 Handler 与 Command 收口

1. 页面动作必须继续映射到 `taskProductionCommandRuntime.ts` 中的独立 Command，不得为了页面合并而合并保存、检查、最终确认、人工决定和发布；
2. `createTaskQuestionDraft`、`saveTaskDraft`、`runTaskCheck`、`submitTaskForFinalConfirmation`、`recordTaskConfirmationDecision`、`returnTaskForRevision`、`publishConfirmedTask` 和 `retryTaskPublication` 仍是领域动作，不属于旧流程；
3. 多个按钮共用同一含糊 Handler 时，先拆出明确 Command 映射，再删除旧 Handler；
4. 无入口可达的旧 Handler 必须连同调用、局部状态、错误提示和测试一起删除，不能只隐藏按钮；
5. 任何兼容页如需触发动作，必须调用同一 Command Runtime，不能直接写 Store、Draft、Review、Freeze、Formal Version 或 Registry；
6. 删除前必须验证幂等键、Revision 冲突、部分成功恢复和 Loading 反馈仍由统一运行时承担。

#### P6.5 状态计算收口

1. 训练任务卡、任务组数量、主按钮和发布资格只能消费 `resolveTaskProductionState()`、`resolveTaskGroupSummary()` 与 `resolveTaskPublicationEligibility()`；
2. 题目详情的步骤、标题和主操作只能消费 `resolveQuestionWorkflowProjection()`；
3. 组件可以负责组装 Resolver 输入，但不得再次使用 `reviewStatus`、`publicationStatus`、Assessment 是否存在等字段拼装另一套生命周期；
4. 只读兼容页必须消费统一投影，不得维护一套“旧页面专用状态”；
5. 旧字段适配必须止于 Resolver 输入边界；适配结果不得回写并伪装成新契约数据；
6. P6 完成后，同一 TrainingTask 在素材工作台、题目详情、刷新恢复和学习入口中的身份与状态必须一致。

#### P6.6 必须保留的能力

P6 不得删除或弱化以下能力：

1. Draft Revision、Assessment、Human Review、Freeze、Formal Version、Registry 和 Trace 的历史记录；
2. 正式资源发布幂等、部分失败恢复、Revision 冲突和重复提交保护；
3. 已发布正式版本与新活动 Revision 并存的能力；
4. 学习入口只读取完整正式资源的约束；
5. 历史 URL、已保存书签和审核记录中的只读详情；
6. 学生预览、检查记录、审核记录、技术信息和来源追溯；
7. P0-P5 已验收的任务级部分发布、互斥计数和逐项重试能力。

#### P6.7 实施顺序

P6 必须按以下顺序执行，避免先删入口再发现兼容依赖：

1. **建立基线清单**：扫描路由、页面按钮、Handler、状态字段、Command 调用和测试，填入处置分类；
2. **补保护性回归**：先覆盖旧深链、历史只读、活动 Draft 返回、正式资源查看和学习入口；
3. **降级旧页面**：把历史审核入口和旧 URL 收敛为只读详情或带身份的安全跳转；
4. **移除重复入口**：删除首页、导航和页面中仍可形成第二条生产路径的按钮；
5. **移除旧 Handler 与状态**：删除不可达写方法、重复局部状态和组件级生命周期判断；
6. **合并重复测试**：保留领域 Command、Resolver 和端到端契约测试，删除只验证旧按钮或旧文案的测试；
7. **执行全链路 Debug**：验证任务卡主链、历史链接、发布恢复、学习入口和生产构建；
8. **更新契约地图与清单**：记录实际删除项、保留项、兼容项和遗留风险，再进入 P7。

#### P6.8 Debug 验收

P6 至少覆盖以下回归：

1. 素材工作台是唯一可写生产入口，导航中不存在独立的旧题目录入或重复审核入口；
2. 从任务卡进入检查、最终确认和发布时，始终定位同一 TrainingTask、QuestionLineage 与活动 Draft；
3. 旧活动 Draft 链接能够回到唯一主入口，且不会创建第二个 Draft 或 Revision；
4. `pending_review`、`reviewed`、已发布和历史 Revision 的旧链接只读，不出现编辑、再次提交或重复发布入口；
5. 历史详情仍能查看检查记录、人工决定、正式版本、来源与技术信息；
6. 已发布任务产生新 Revision 时，旧正式资源可查看，新 Revision 可独立继续生产；
7. 任务卡、题目详情、刷新恢复和数量总览对同一任务给出一致状态与可用动作；
8. 保存、检查、最终确认、人工决定和发布仍分别形成可追溯记录；
9. 旧 URL 身份缺失时只提供安全回退，不自动生成或猜测绑定；
10. 发布失败重试、Revision 冲突、部分发布和幂等回归通过；
11. 学习入口仍只读取 Registry、Trace 和 Material Link 完整的正式资源；
12. 源码扫描不再发现无入口可达的旧写 Handler、重复状态 Resolver 或已废弃按钮文案；
13. P0-P5 自动化与浏览器端到端回归全部通过；
14. `git diff --check` 与生产构建通过。

#### P6.9 完成定义

满足以下条件才可标记 P6 完成：

1. 旧流程处置清单中的每一项均有明确结论和验证证据；
2. 工程中只有一条可写生产路径，历史页和兼容路由不会形成第二条写链；
3. 页面不再自行解释生命周期，统一 Resolver 与 Command Runtime 成为唯一运行时入口；
4. 历史审计、正式资源、失败恢复和学习读取均未受清理影响；
5. 所有删除项已清除调用、局部状态、提示和重复测试，不留下不可达残片；
6. P6 Debug 验收通过并同步契约地图后，才进入 P7 最终端到端验收。

#### P6.10 工程落地与 Debug 记录（2026-08-03）

P6 已按“先识别入口 -> 再冻结访问模式 -> 降级旧地址 -> 收口导航 -> 保留有效深链 -> 自动化与浏览器验收”的顺序完成：

1. 新增 `questionWorkbenchAccess.ts` 作为题目工作台访问模式的唯一解析入口，统一区分 `unified_edit`、`task_detail` 与 `legacy_adapter`；
2. 只有同时具备 `mode=plan-review`、`planId` 和 `materialVersionId` 的任务卡深链可以进入聚焦生产流程；该模式继续使用现有 Resolver 与 Command Runtime，不新增第二套写入语义；
3. `mode=task-detail` 且身份完整时保留只读生产详情，用于查看题目内容、检查记录、生产状态和正式资源；
4. 缺少身份、未知模式和独立访问 `/question-resource-workbench` 时统一进入 `legacy_adapter`，只显示迁移说明和返回素材工作台入口，不载入工作区，也不创建 Draft、Revision、Review 或正式资源；
5. 首页与内部学习审查页已移除独立题目工作台入口，统一指向 `/material-resource-workbench`；
6. 素材工作台仍可携带完整身份打开 `plan-review` 和 `task-detail`，因此历史详情、任务级检查、最终确认与发布链没有被旧入口封口误伤；
7. 保存、检查、提交、人工决定、发布和失败恢复仍由原有独立 Command 承担，未因页面入口收口而合并生命周期动作。

自动化 Debug 结果：

- `debug:question-workbench-legacy-closure`：通过；覆盖无参数、仅 Draft、身份不完整、有效聚焦编辑、有效只读详情和未知模式；
- `debug:question-workbench-command-e2e`：`7 / 7 PASS`；
- `debug:material-resource-production-commands`：`7 / 7 PASS`；
- `debug:material-question-review-submission`：`6 / 6 PASS`；
- `debug:task-publication-orchestration`：通过；
- `debug:question-workflow-projection`、`debug:question-workbench-presentation-state`、`debug:task-production-state` 与 `debug:task-production-command-runtime`：通过；
- `pnpm run build`：通过；
- `git diff --check`：通过。

浏览器端到端验收结果：

1. 独立旧地址显示“题目生产入口已合并”，只提供返回素材资源录入的安全动作；
2. `/material-resource-workbench` 正常载入素材录入、已有素材和停用素材入口；
3. 有效 `plan-review` 深链正常恢复同一批题目及已发布状态；
4. 有效 `task-detail` 深链显示只读“题目生产详情”，并明确生产动作应回到对应训练任务；
5. 上述路径浏览器控制台均无错误日志。

P6 的完成结论仅表示旧并列入口和第二写链已经收口。P7 仍需执行完整生产链、部分发布、失败恢复、学习入口及历史数据兼容的最终端到端验收。

### P7：端到端验收与文档同步

P7 是统一资源生产工作台的最终放行审计，不是新的功能开发阶段。它必须证明 P0-P6 已冻结的对象关系、统一状态、独立命令、任务卡主链、按任务发布、学习读取和旧入口收口在同一条真实链路中同时成立。

P7 期间只允许修复验收发现的契约偏差、状态错位、反馈缺失、恢复失败和兼容缺陷；不得借验收新增另一条写入链、合并领域命令、改变发布单位或提前引入多人权限系统。

#### P7.1 验收权威来源与统一判定

1. 训练任务主状态只读取 `resolveTaskProductionState()`；
2. 任务组互斥数量只读取 `resolveTaskGroupSummary()`，并始终满足分类数量之和等于任务总数；
3. 发布资格只读取 `resolveTaskPublicationEligibility()`；
4. 题目详情步骤、标题、主提示和主操作只读取 `resolveQuestionWorkflowProjection()`；
5. 所有写操作只通过 `taskProductionCommandRuntime.ts` 中已经冻结的独立 Command；
6. 页面截图、Toast、按钮文案或局部组件状态不能替代 Store、Resolver、Review、Publication 和 Registry 记录作为验收事实；
7. 自动化、浏览器页面和持久化记录对同一对象给出不同结论时，以领域记录和统一 Resolver 为调查起点，P7 不得用页面特判掩盖差异。

#### P7.2 验收数据基线

P7 必须使用可复现、可清理且身份完整的专用验收数据，不直接改写需要长期保留的真实资源。

每轮验收至少记录：

```ts
type P7AcceptanceFixture = {
  runId: string;
  materialVersionId: string;
  planId: string;
  trainingTaskIds: string[];
  questionLineageIds: string[];
  draftIds: string[];
  baselineRevisionIds: string[];
  startedAt: string;
};
```

验收开始前必须保存对象数量和身份快照，结束后再次核对。失败重试不得通过重新创建素材、计划、TrainingTask、QuestionLineage 或活动 Draft 来伪装成功。

最小数据组应包含三项 TrainingTask，以便同时覆盖：

1. 一项完整发布；
2. 一项待最终确认或发布失败恢复；
3. 一项退回修改或仍在编辑；
4. 一个已发布任务产生新 Revision 的并存场景；
5. 一个旧 URL 或历史 Revision 的只读兼容场景。

#### P7.3 完整生产链回归

必须在唯一可写入口中连续完成以下真实链路：

```text
保存素材
-> AI 规划候选任务
-> 人工采用
-> 保存训练任务组
-> 创建或恢复题目草稿
-> 编辑并保存 Revision
-> 执行题目检查
-> 提交最终确认
-> 形成确认决定
-> 发布正式题目
-> Registry 建立活动关联
-> 学习入口读取正式资源
```

该链路必须同时满足：

1. 从头到尾保持同一 `materialVersionId`、`planId`、`trainingTaskId` 和 `questionLineageId`；
2. 同一 TrainingTask 同时最多只有一个活动 Draft；
3. 预览、检查、提交、确认和发布不会隐式创建额外 TrainingTask 或 QuestionLineage；
4. 保存只创建必要 Revision，重复点击、刷新恢复和再次进入不产生空 Revision；
5. Assessment、Human Review 和 Formal Version 均绑定触发它们的准确 Revision；
6. 发布完成后 Freeze、Formal Version、Registry、Trace 和 Material Link 身份闭合；
7. 学习入口读取到的题目内容和来源版本与刚发布的正式资源一致。

#### P7.4 退回修改与新 Revision 回归

必须完成一次：

```text
待最终确认
-> 退回修改
-> 返回同一 TrainingTask 与活动 Draft
-> 精确定位字段
-> 修改并保存新 Revision
-> 旧 Assessment 失效
-> 重新检查
-> 再次提交最终确认
```

验收要求：

1. 退回不创建第二个活动 Draft；
2. 原 Revision、Assessment、确认记录和退回原因保持只读可追溯；
3. 新检查只对新 Revision 生效；
4. 定位修改必须打开问题所指向的真实字段；
5. 刷新、离开再返回后仍恢复同一素材、任务和 Draft；
6. 退回链中不得覆盖已经发布的旧 Formal Version。

#### P7.5 部分发布与数量守恒回归

三项任务分别进入 `published`、`confirmed` 或 `publication_failed`、`revision_required` 等互斥状态时，必须验证：

1. 每项任务只进入一个主状态分类；
2. 所有主状态数量之和始终等于任务总数；
3. 任务组显示派生的 `partial`，但不保存一个会与单项状态冲突的人工组状态；
4. 发布已确认任务不会改变待修改任务；
5. 批量发布只处理当时符合资格的任务；
6. 单项查看、修改、继续确认和重试入口落在对应任务卡，不在总览区域形成重复动作；
7. 已发布任务产生新活动 Revision 后，任务卡主状态反映新工作，新旧正式版本仍可追溯。

#### P7.6 失败注入与恢复回归

P7 至少注入并恢复以下失败：

| 失败点 | 页面期望 | 数据期望 | 恢复动作 |
| --- | --- | --- | --- |
| 保存 Revision 冲突 | 当前任务显示明确冲突，不污染其他任务 | 不覆盖较新 Revision | 刷新同一 Draft 后重试 |
| Assessment 缺失、失效或失败 | 停留在题目检查并说明原因 | 不沿用旧 Assessment | 重新检查当前 Revision |
| 提交最终确认部分完成 | 显示已完成阶段和未完成阶段 | 不重复创建已成功记录 | 从未完成阶段继续 |
| 人工决定写入失败 | 保留 `pending_review` | 不伪装为已确认 | 重试同一决定 |
| Freeze 或 Formal Version 后续失败 | 显示“已确认，发布未完成” | 保留已成功阶段和幂等键 | 仅重试未完成发布阶段 |
| Registry 或 Material Link 失败 | 正式资源不进入学习可用集合 | 不创建第二个 Formal Version | 从现有 Formal Version 继续 |
| 页面刷新或请求超时 | 显示 Loading、成功或可恢复错误 | 在途锁最终释放 | 从统一 Resolver 恢复 |

所有失败都必须靠近触发操作反馈；按钮在同一渲染帧进入 Loading。位于页面顶部且当前不可见的提示不能作为唯一反馈。

#### P7.7 学习入口与正式资源完整性回归

1. `/learning` 只读取 Registry、Trace 和 Material Link 完整的正式资源；
2. 草稿、待确认、发布未完成和仅存在 Formal Version 但 Registry 不完整的题目不得进入学习入口；
3. 已发布资源可以被学习入口稳定读取，刷新和重新进入不误报资源耗尽；
4. 学习端读取失败必须给出可恢复状态，不得回写生产资源或生成占位题目；
5. 同一正式题目的能力、任务角色、材料版本和题干不得在生产端与学习端发生漂移；
6. 资源停用后不再进入新的学习匹配，但历史学习记录仍可追溯。

#### P7.8 旧入口、历史数据与第二写链审计

1. 独立访问旧题目工作台只进入安全适配页，不载入可写工作区；
2. 完整的任务卡深链可以恢复同一生产对象；
3. 历史 Revision、`pending_review`、已确认和已发布链接只读；
4. 身份缺失或关系断裂时只提供安全回退，不猜测绑定、不创建占位对象；
5. 首页、内部入口和历史导航中不存在独立旧录入或重复审核入口；
6. 源码扫描不得发现可达的第二写 Handler、组件级生命周期拼装或直接写 Store 的兼容逻辑；
7. P6 保留的兼容标记只有在历史链接、身份恢复和只读审计均有替代证据时才可删除。

#### P7.9 验收层次与缺陷门禁

P7 按以下顺序执行，上一层失败时不得用下一层成功抵消：

1. **静态检查**：类型、Lint（如项目启用）、`git diff --check`、旧入口和重复 Handler 扫描；
2. **纯函数与领域测试**：Resolver、数量守恒、资格判断、Command Runtime 和幂等；
3. **存储集成测试**：Revision、Assessment、Review、Publication、Registry 和恢复记录；
4. **浏览器端到端**：完整主链、退回、部分发布、失败重试、刷新恢复和历史深链；
5. **学习入口验收**：正式资源可见，非正式或不完整资源不可见；
6. **生产构建**：构建通过且无新增运行时错误。

缺陷分级固定为：

| 级别 | 定义 | P7 处理 |
| --- | --- | --- |
| P0 | 重复写入、身份错绑、覆盖正式版本、非正式资源进入学习入口、无法恢复的发布污染 | 阻断完成，必须修复并重跑全部受影响层 |
| P1 | 主状态或按钮错误、退回不能闭环、失败无法重试、数量不守恒、旧入口仍可写 | 阻断完成，必须修复并重跑对应链及完整主链 |
| P2 | Loading、就近反馈、恢复定位、文案或布局影响用户理解但不破坏数据 | 修复后重跑浏览器场景；未修复项必须明确记录且不得伪装完成 |
| P3 | 不影响流程和数据的低风险视觉问题 | 可形成后续清单，不影响 P7 技术放行 |

#### P7.10 结果记录与完成定义

P7 必须输出一份带日期的 Debug 验收记录，至少包含：

1. Git Commit、分支、运行环境和验收时间；
2. 验收 Fixture 的 `runId` 与对象身份清单；
3. 每个场景的操作、期望、实际结果和证据；
4. 自动化命令与通过数量；
5. 浏览器路径、刷新恢复结果和控制台错误检查；
6. 故障注入点、部分成功记录和恢复结果；
7. 数据前后快照、重复对象检查和数量守恒结果；
8. 未解决问题、严重度、责任边界和后续处理。

只有同时满足以下条件，才能把 P7 标记为完成：

1. P7.3 至 P7.8 的场景全部有可复核证据；
2. 无未解决 P0、P1 缺陷；
3. P0-P6 关键自动化、浏览器端到端、学习入口和生产构建全部通过；
4. 没有新增第二写链、重复 Draft、重复 Review、重复 Formal Version 或错误 Registry 关联；
5. 契约地图、阶段进度、Debug 记录和实际工程状态一致；
6. 临时兼容标记已逐项决定保留或删除，并记录证据；
7. 多人独立审核模式仅作为 P7 完成后的产品决策，不属于 P7 放行条件。

#### P7.11 工程落地与 Debug 验收记录（2026-08-03）

P7 已完成最终放行审计，详细证据见：

- [Phase 17 统一资源生产工作台 P7 Debug 验收记录](../education/phase/reports/phase17_unified_resource_production_p7_debug_acceptance_2026-08-03.md)

验收结论：

1. P7 聚合自动化 `13 / 13 PASS`；
2. 完整生产链、退回修改、部分发布、失败恢复、学习入口和旧入口收口均有自动化或浏览器证据；
3. 重复保存、检查、提交、确认和发布未产生重复 Draft、Review、Formal Version 或 Registry；
4. 任务组互斥状态数量守恒，单任务发布与失败重试不污染其他任务；
5. `git diff --check` 与生产构建通过；
6. 未发现未解决 P0、P1 或 P2 缺陷；现有 Bundle 体积和动态导入提示作为 P3 构建优化事项保留；
7. 多人独立审核模式继续作为 P7 完成后的产品决策，不影响本次放行。

P7 至此完成。后续功能或性能开发不得重新引入第二写链、组件级生命周期拼装或不可恢复的合并命令。

#### P7.12 P0-P7 最终串联验收（2026-08-03）

P0-P7 已在同一工作树完成最终串联验收，统一执行入口为：

```bash
pnpm run debug:unified-resource-production-final
```

验收结论：

1. `18 / 18` 个跨阶段自动化套件通过；
2. 生产构建与 `git diff --check` 通过；
3. 统一工作台、学习入口和旧只读深链均完成浏览器核对，未出现新增控制台错误；
4. 保存、检查、最终确认、人工决定、部分发布和失败恢复保持独立、幂等且可追溯；
5. 未发现重复 Draft、Review、Formal Version、错误 Registry 关联或非正式资源进入学习入口；
6. 未发现未解决 P0、P1 或 P2 缺陷。

完整证据见 [Phase 17 统一资源生产 P0-P7 最终串联验收报告](../education/phase/reports/phase17_unified_resource_production_p0_p7_final_integration_acceptance_2026-08-03.md)。

## 十五、P0 验收标准

P0 以契约冻结为主，同时允许落地不改变写入语义的纯读取护栏；不验收页面合并，也不迁移历史数据。

必须满足：

1. `TrainingTask`、`QuestionLineage`、Draft、Revision 和 Formal Version 的关系无歧义；
2. 一项任务最多一个活动草稿；
3. 已发布版本与新 Revision 可以并存且不会互相覆盖；
4. 发布单位明确为已确认的 `QuestionRevision`；
5. 保存、检查、确认和发布仍是独立命令；
6. 统一状态 Resolver 的输入、输出和禁止项明确；
7. 任务组主状态数量采用互斥分类并满足数量守恒；
8. 旧审核页的过渡职责明确；
9. P1 至 P7 的依赖顺序明确；
10. 现有工程在 P0 阶段不需要迁移数据或改变写入行为。

### P0 可执行护栏

为了避免后续页面继续各自解释状态，P0 同步冻结以下最小工程基线：

1. `resolveTaskProductionState()` 是训练任务生产主状态的唯一纯函数投影；
2. `resolveTaskGroupSummary()` 只对互斥主状态计数，且各分类之和必须等于任务总数；旧名 `summarizeTaskProductionViews()` 仅作过渡别名；
3. `TrainingTaskQuestionBinding` 明确 `trainingTaskId`、`questionLineageId`、活动 Draft、当前 Revision、已确认 Revision 与最新 Formal Version 的身份；
4. 正式版本来源草稿使用 `sourceDraftId`，当前返修草稿使用 `activeRepairDraftId`，两者不得继续复用同一个含糊字段；
5. 当旧正式版本与新活动草稿并存时，新草稿状态是任务卡主状态，“查看已发布题目”仅作为辅助动作；
6. 该护栏只统一读取结果，不修改保存、检查、最终确认、发布和失败重试命令。

## 十六、后续工程验收场景

后续阶段至少覆盖：

1. 首次生成任务后进入编辑，不出现“替换当前任务组”；
2. 修改一项任务只使该任务 Assessment 失效；
3. 保存后刷新仍定位同一素材和同一任务；
4. 检查通过后任务进入待最终确认；
5. 退回修改后定位同一 TrainingTask 和同一 Draft；
6. 修改后生成新 Revision，旧审核记录保持只读；
7. 已发布任务产生新 Revision 时，卡片显示当前工作状态并保留查看旧正式版本；
8. 三项任务分别处于已发布、待确认和需要修改时，任务组显示 `partial`；
9. 发布两个已确认任务时，未确认任务不受影响；
10. Registry 写入失败后重试不产生重复 Formal Version；
11. 所有总览互斥状态数量之和等于任务总数；
12. 从旧审核链接进入时可以查看历史，但不会形成重复写入入口。

## 十七、不在本阶段完成的内容

本文不要求 P0 立即完成：

1. 页面视觉重构；
2. Schema 全量迁移；
3. 旧数据批量回填；
4. 多角色权限系统；
5. 批量部分发布；
6. 删除旧审核页面；
7. 合并领域命令；
8. 自动覆盖正式版本。

## 十八、最终结论

统一资源生产工作台采用以下冻结原则：

```text
一项 TrainingTask
-> 一条 QuestionLineage
-> 一个活动草稿
-> 多个不可变 Revision
-> 零个或多个正式版本
```

用户在一个工作台中完成编辑、检查、最终确认与发布；系统继续保存独立的 Assessment、Human Review、Freeze、Formal Version 和 Registry 记录。

先完成对象与状态契约，再统一读取模型和命令边界，最后迁移页面与部分发布。不得从视觉合并开始反推领域模型。

## 十九、P0 工程落地记录（2026-07-31）

本轮已完成：

1. 新增 `src/pages/taskProductionState.ts`，集中计算单任务生产状态、可用动作和稳定题目谱系绑定；
2. 素材工作台任务卡改为消费统一投影，不再优先用旧正式版本覆盖新 Revision 的工作状态；
3. 任务组顶部统计改为消费互斥状态汇总，满足数量守恒；
4. 正式资源明细补充 `sourceDraftId` 与 `activeRepairDraftId`，消除来源版本和返修草稿的身份歧义；
5. 新增 `debug:task-production-state` 回归，覆盖首次草稿、检查、退回、最终确认、发布失败、已发布及“旧正式版本与新 Revision 并存”；
6. 现有素材工作台状态回归补充来源草稿断言。

本轮明确未做：

1. 未合并录入页与审核页；
2. 未改变任何写入 Command；
3. 未迁移 Schema 或批量回填历史数据；
4. 未实现部分发布；
5. 未删除旧审核入口和兼容页面。

验收命令：

```bash
npm run debug:task-production-state
npm run debug:material-resource-workbench-state
npm run debug:question-workflow-projection
npm run build
```

## 二十、P1 唯一读取模型补强（2026-07-31）

P1 不改变任何写入 Command，只把任务卡、数量总览和题目工作流的状态解释收口到同一份读取模型。

### 20.1 唯一事实入口

1. `resolveTaskProductionState()` 是单任务生产主状态的唯一入口；
2. 任务卡片必须直接消费 `state`、`presentation`、`availableActions` 和 `primaryAction`；
3. 组件内禁止根据 `draft.status`、`review.status`、`publication.status` 再次组装一套标签、颜色或主操作；
4. `presentation.stateLabel`、`presentation.tone` 和 `presentation.primaryActionLabel` 必须由中央映射产生；
5. 步骤条、主按钮、任务卡状态与页面标题不得对同一生命周期给出相互矛盾的含义。

### 20.2 页面局部精化边界

`questionWorkflowProjection` 可以在统一主状态上继续区分页面子状态，例如：

- `pending_confirmation + ready_to_submit`：已完成检查，尚未提交最终确认；
- `pending_confirmation + pending_review`：已提交，等待形成人工决定；
- `confirmed + approved`：已确认，等待发布；
- `publication_failed + publication_incomplete`：人工结论有效，仅需重试发布。

页面子状态只能增加当前交互所需的精度，不得改写或反转统一主状态。

### 20.3 任务组汇总规则

`resolveTaskGroupSummary()` 必须返回：

```ts
type TaskProductionSummary = {
  total: number;
  actionRequired: number;
  pendingConfirmation: number;
  confirmedAwaitingPublication: number;
  published: number;
  aggregateState: 'empty' | 'in_progress' | 'ready' | 'partial' | 'published';
};
```

强制约束：

1. `actionRequired + pendingConfirmation + confirmedAwaitingPublication + published === total`；
2. 单个任务只能进入一个互斥分类；
3. 只有所有未发布任务均为 `confirmed` 时，任务组才是 `ready`；
4. `publishing` 和 `publication_failed` 属于已确认未发布的数量分类，但任务组主状态仍是 `in_progress`；
5. 任意已发布任务与其他状态并存时，任务组为 `partial`。

### 20.4 主状态展示与主操作

| 主状态 | 统一展示 | 主操作 |
| --- | --- | --- |
| `draft_empty` | 未生成题目 | 创建题目 |
| `editing` | 编辑中 | 保存任务 |
| `check_required` | 待检查 | 检查题目 |
| `checking` | 检查中 | 无，显示 Loading |
| `revision_required` | 需要修改 | 继续修改 |
| `pending_confirmation` | 待最终确认 | 进入最终确认 |
| `confirmed` | 已确认，待发布 | 发布正式题目 |
| `publishing` | 正在发布 | 无，显示 Loading |
| `publication_failed` | 发布未完成 | 重试发布 |
| `published` | 已发布 | 查看已发布题目 |

### 20.5 已发布版本与新 Revision 并存

1. 当 `publication.sourceDraftId === activeDraft.draftId` 时，正式版本属于当前 Draft，主状态可为 `published`；
2. 当两者不同时，正式版本属于历史 Revision，当前新 Revision 的状态必须成为主状态；
3. 此时“查看已发布题目”仅作辅助操作，不得遮蔽新 Revision 的保存、检查或最终确认操作。

### 20.6 P1 验收标准

1. 上表每一种生命周期都有稳定的状态、色彩语义和主操作；
2. 素材工作台与题目工作流对同一底层状态返回同一主状态；
3. 已发布版本与新 Revision 并存时，新 Revision 是主状态，历史正式版本仅作辅助查看；
4. 任务组数量守恒，聚合状态不把发布中或发布失败误判为 `ready`；
5. 页面不再保留与统一投影重复的状态标签和主操作文案映射；
6. 通过单任务状态、任务组汇总、题目流程投影、素材工作台和生产构建回归。

### 20.7 P1 工程落地记录

本轮实现：

1. 统一产出 `presentation`，集中管理状态文案、语义颜色、Loading 标记和主操作文案；
2. 素材工作台任务卡与顶部互斥数量统计改为直接消费统一投影；
3. 题目流程投影增加 `productionState`，保留页面子状态但不再独立解释主生命周期；
4. 已发布版本与新 Revision 并存时，任务卡展示新 Revision 主操作，并额外提供“查看已发布题目”；
5. 扩展 Debug 用例，覆盖主状态、主操作、数量守恒、聚合状态与题目页投影一致性。

### 20.8 P1 Debug 验收记录（2026-07-31）

本轮使用工作区配置的新版 Node.js 运行时完成验收。系统自带 Node 18 不支持项目使用的 `--experimental-strip-types`，不作为代码失败依据。

自动回归结果：

1. `debug:task-production-state`：通过，覆盖单任务主状态、可用动作、主操作及旧正式版本与新 Revision 并存；
2. `debug:material-resource-workbench-state`：`12 / 12` 通过，覆盖当前计划隔离、数量守恒、发布未完成与正式版本来源；
3. `debug:question-workflow-projection`：通过，题目页子状态与统一生产主状态一致；
4. `debug:question-workbench-presentation-state`：`23 / 23` 通过；
5. `debug:question-workbench-command-e2e`：`7 / 7` 通过，重复保存、检查、提交、审核和发布均保持幂等，退回后沿用同一 Draft；
6. `debug:material-question-review-submission`：`6 / 6` 通过，阶段化失败可恢复且不会重复创建题目；
7. `debug:phase17-5c2`：`25 / 25` 通过，覆盖 Assessment 持久化、Revision 隔离、Human Review 绑定、Freeze 原子性、发布原子性与失败重试；
8. `debug:question-publication-recovery`：`3 / 3` 通过；
9. `debug:material-resource-production-commands`：`7 / 7` 通过；
10. `debug:authoring-field-contract`：通过；
11. `debug:training-task-group-planning:e2e`：通过，连续三轮生成并采用候选后仍只产生一个工作 Revision。

验收结论：

1. P1 唯一读取模型与现有写入命令边界兼容；
2. 单任务状态、任务组数量、题目工作流和素材工作台之间未发现状态漂移；
3. 重试、退回、发布失败恢复均未产生重复 Revision、重复审核决定或重复正式版本；
4. P1 可以进入 P2 页面任务卡改造；P2 仍不得绕过统一投影或合并底层领域命令。

### 20.9 P2 训练任务卡实施边界

P2 只调整录入端任务卡的读取与操作呈现，不改变 Draft、Revision、Human Review、Freeze 或 Publication 的写入语义。

任务卡首层固定为：

1. `来源`：仅说明 AI 生成、人工调整或人工创建；
2. `状态`：只展示 `resolveTaskProductionState()` 返回的单一主状态；
3. `下一步`：只外显当前推荐主操作；
4. 任务属性：继续展示训练方向、能力、难度、材料范围和任务用途；
5. 历史正式版本：当新修改与已发布版本并存时，仅提供“查看已发布题目”辅助操作。

禁止再次并列展示“训练计划状态”和“题目状态”，也禁止组件自行根据 `reviewStatus`、`publicationStatus` 或检查结果拼装第二套状态。

任务卡的检查记录当前性统一按以下规则计算：

1. 没有检查记录：`missing`；
2. 检查记录 Revision 与当前 Draft Revision 不同：`stale`；
3. 当前 Revision 检查未通过：`failed`；
4. 当前 Revision 检查通过：`current`。

P2 验收必须覆盖：

1. 未生成题目、编辑中、待检查、需要修改、待最终确认、已确认待发布、发布未完成和已发布；
2. 已发布任务发生新修改时，主状态切换为编辑或修改状态，旧正式版本仍可辅助查看；
3. 顶部四项数量互斥且总和等于训练任务总数；
4. 卡片只提供一个推荐主操作，不同时出现两个竞争性的主按钮；
5. 保存计划、定位问题和进入题目流程继续调用现有独立 Command，不在卡片中直接写领域数据。

## 二十一、正式发布到学习入口的读取契约

本节冻结正式题目发布完成后进入学习 Runtime 的唯一读取边界，避免资源已经发布、Registry 已更新，但学习入口仍被历史批次或 Demo 过滤器隔离。

### 21.1 唯一读取链

```text
PublicationResult.completed
-> FrozenQuestionResourceVersion
-> active RegistryEntry.currentFrozenVersionId
-> Formal Resource Runtime Snapshot
-> Learning Match
-> Concrete Learning Task
```

强制约束：

1. 发布完成必须同时产生可读取的 Frozen Version 和活动 Registry 当前版本指针；
2. 学习入口必须读取与发布端相同的共享正式资源 Repository；
3. 正式学习 Runtime 不得使用批次前缀、页面来源、历史 Demo 名称或测试 Fixture ID 过滤活动 Registry；
4. Batch、Demo 和验收专用过滤器只能保留在对应测试或兼容入口，不得成为 `/learning` 的正式资源边界；
5. Registry 指向的版本不存在、不是 `frozen` 或身份不一致时，必须报告读取异常，不得降级为“暂无新任务”。

### 21.2 统一读取结果

```ts
type LearningFormalResourceReadState =
  | 'available'
  | 'no_formal_resource'
  | 'no_eligible_match'
  | 'already_used'
  | 'read_failed'
  | 'invalid_registry'
  | 'mapping_failed';
```

页面语义：

1. `no_formal_resource`、`no_eligible_match`、`already_used` 是正常业务结果，可以显示当前没有新的正式任务；
2. `read_failed`、`invalid_registry`、`mapping_failed` 是系统异常，必须显示读取失败与重试入口；
3. 页面不得把所有未匹配结果合并成同一句“当前没有新的正式任务”；
4. 匹配失败的内部原因应保留在技术信息或审计记录中，学生界面只显示安全、可行动的说明。

### 21.3 匹配字段与身份

正式匹配只使用稳定字段：

1. `abilityMetadata.abilityId`；
2. `abilityMetadata.taskRole`；
3. Registry 当前 Frozen Version；
4. 当前学生已使用的 `resourceId`、`resourceVersionId` 与 `materialId`；
5. Runtime 要求的材料新颖度、提示策略、难度和能力约束。

展示名称、中文标签、批次名称和资源 ID 前缀不得作为能力或任务角色的等值判断依据。

### 21.4 读取兼容与历史批次

1. 旧 `Phase 17.3 Batch A` 匹配器可以继续用于 Batch A Debug 与历史回归；
2. 正式学习入口必须调用通用正式资源匹配器，默认消费所有活动 Registry 当前版本；
3. 如需限制资源集合，必须显式传入产品范围策略，且策略不得由资源 ID 前缀隐式推断；
4. 新发布资源不需要迁移到旧批次命名，也不得为了进入学习入口重写正式资源 ID。

### 21.5 验收标准

1. 发布一条 `analysis + training` 题目后，学习入口能从共享 Registry 读取并形成 Concrete Task；
2. 正式资源 ID 不使用 Batch A 前缀时仍可进入匹配；
3. 已使用资源被排除后，可继续匹配同能力、同任务角色的其他正式资源；
4. 确实没有合格资源时显示正常空状态；
5. Repository 读取失败、Registry 指针失效或版本映射失败时显示系统错误，不伪装为空状态；
6. Batch A 历史 Debug 继续保持原有隔离和结果；
7. 结束旧会话后开始新会话，旧会话材料不限制新首题，旧会话已经使用的具体 Frozen Version 仍不会被重复选择；
8. 同一活动会话进入下一 Round 时，当前材料语境继续生效。

### 21.6 入口与工作区可用性一致

学习入口的“可以开始”和学习工作区的任务准备必须消费同一份正式资源匹配结果，不允许入口仅以“Registry 非空”“未达到轮次上限”或“存在任意正式资源”推断任务可用。

强制约束：

1. 入口与工作区统一调用 `resolveCurrentLearningTaskAvailability()`，使用相同的学生身份、能力、任务角色、复测计划、当前 Round、已使用资源和材料去重条件；
2. `available` 才允许入口显示“任务已经准备好”并启用“开始学习”；
3. `no_eligible_match` 或 `already_used` 必须在入口直接显示真实空状态，不得先进入工作区再暴露无任务；
4. `read_failed`、`invalid_registry`、`mapping_failed` 必须在入口显示读取失败和重试动作；
5. 入口状态探测不得创建 Session、Round、学习记录或其他领域写入；
6. 从入口显示“可以开始”到点击进入工作区之间没有外部资源变化时，工作区必须成功形成同一条件下的 Concrete Learning Task。
7. 首轮或无明确 Next Strategy 的普通训练不得把能力固定为某个历史 Demo 默认值；必须从当前材料语境下尚未使用的正式 Training 版本中确定 `abilityId`；
8. 普通 Training 的 `same_context` 表示允许并要求复用当前材料语境，材料曾经使用过不能被判定为“资源耗尽”；只有具体 `resourceVersionId` 已使用才排除该版本；
9. Transfer 的 `new_context` 继续排除已使用材料，Retest 继续遵守受控相似材料关系，两者不得复用 Training 的耗尽算法；
10. 正常空状态应沿用统一可用性探测返回的具体说明，不得再次退化为固定的通用空文案。

### 21.7 学习会话历史边界

正式资源历史必须拆分为“跨会话版本去重”和“当前活动会话语境”两层，不得把全部历史记录直接投影成当前材料语境：

1. `recentResourceVersionIds` 可以跨学习会话累计，用于避免同一 Frozen Version 被重复形成正式学习任务；
2. `recentMaterialIds`、`recentTaskIds`、`recentResourceIds` 与 `recentExecutionSessionIds` 只允许来自当前活动 `learningSessionId` 对应的 Round；
3. `ended` 会话或不存在活动会话时，新的首轮匹配必须清空材料、任务、资源与执行会话上下文，但继续保留已使用 Frozen Version 的去重记录；
4. 普通 Training 的同材料连续性只在同一个活动会话内成立；开始新会话时可以从任意仍有未使用正式版本的合格材料重新建立语境；
5. Round 归属统一通过 `learningRoundId = ${learningSessionId}-round-*` 判定，入口探测、工作区首题和下一题匹配必须消费同一个历史作用域函数；
6. 页面不得因为已结束会话的 `materialId` 泄漏到新会话而显示“当前没有新的正式任务”。
7. 入口读取必须按学习记录、学习会话、操作进度、复测计划与正式任务分阶段设置时限；任一阶段失败时，页面只显示安全的阶段名称，不暴露数据库名、接口路径或技术堆栈。

该约束用于消除以下错误链路：

```text
入口发现任意正式资源 -> 显示可以开始
-> 工作区按真实能力、角色与去重条件重新匹配
-> 显示当前没有新的正式任务
```

正确链路为：

```text
统一可用性探测 -> 入口状态
                 -> 工作区任务准备
```

### 21.8 入口读取时限与失败边界

学习入口恢复属于一次完整读取事务，必须有统一时限，不允许页面无限停留在“正在恢复学习状态”：

1. `loadUnifiedLearningEntry()` 必须为整条读取链设置统一 Deadline，默认不超过 5 秒；
2. Deadline 覆盖学习记录、活动 Session、Operation Checkpoint、复测计划、正式资源 Registry 与 Frozen Version 匹配，不得由页面分别计时；
3. IndexedDB 打开或升级出现 `blocked` 时必须立即返回可识别的读取错误，不得等待浏览器自行解除；
4. 超时、数据库阻塞、Repository 异常统一归入 `read_failed`，页面结束 Loading，显示安全说明和“重新尝试”；
5. `no_formal_resource`、`no_eligible_match`、`already_used` 仍是成功完成读取后的正常业务空状态，不得因加入超时保护而改写为系统异常；
6. 入口按钮只允许处于可操作、Loading 或明确禁用三种状态；Loading 必须外显，读取完成后立即恢复；
7. 同一次入口恢复只允许有一个统一结果源，页面标题、空状态、主按钮与工作区可用性不得分别发起并解释不同读取结果。
8. 统一 Deadline 不是底层依赖无限等待的替代方案；共享正式资源服务探测和 IndexedDB 打开请求必须各自具备更短的失败边界；
9. 共享正式资源服务请求超时必须终止网络请求并返回可识别错误，不得继续占用入口事务；
10. IndexedDB 连接必须响应 `versionchange` 主动关闭，升级出现 `blocked` 时立即失败，避免其他页签长期持有旧连接。
11. 同一次学习入口解析窗口内，共享正式资源快照只允许请求和解析一次；仓储路由、列表、版本、校验、审核与运行准备必须复用该只读快照，不得逐方法重复拉取完整存储；
12. 正式资源写入前必须使共享读取缓存失效，写入成功后以返回的新 Revision 更新缓存；读取代码不得原地修改共享快照。

验收要求：

- 任一底层 Promise 永不返回时，入口在 Deadline 后退出 Loading 并提供重试；
- IndexedDB `blocked` 时不出现无限 Loading；
- 正式资源服务请求永不返回时，在入口统一 Deadline 之前返回读取超时；
- 一次入口恢复即使经过多个正式资源仓储方法，也只产生一次共享快照 GET 请求；
- 正式版本确已全部使用时，稳定显示 `already_used` 对应文案，不显示读取失败；
- 尚有合格且未使用的 Frozen Version 时，入口按钮可用且进入工作区能形成同一任务。

### 21.9 工程落地与 Debug 记录（2026-08-03）

本轮学习入口读取故障的根因不是正式资源缺失，而是同一次入口恢复中，Repository Router、列表读取、版本读取、资格判断与 Runtime 准备分别请求并解析同一份本机正式资源快照。约 660 KB 的健康数据因此被重复读取十余次，最终超过入口统一 Deadline，并被错误展示为 `read_failed`。

工程修复冻结如下：

1. 本机正式资源客户端按 `fetcher + endpoint` 复用同一个进行中请求，并提供 1 秒只读快照窗口；
2. 同一解析窗口内的并发读取合并为一次 GET 和一次 JSON 解析，Repository Router 必须复用同一个客户端实例；
3. 正式资源写入前使共享快照失效，写入成功后用服务端返回的新 Revision 更新缓存；
4. 正式资源服务请求和 IndexedDB 打开请求均设置短于入口统一 Deadline 的内部时限；IndexedDB 必须处理 `blocked` 与 `versionchange`，并在完成后关闭连接；
5. `/learning` 按学习记录、学习会话、操作进度、复测计划与正式任务分阶段返回安全错误；业务空状态与系统读取失败继续严格分离。

Debug 与界面验收结果：

- `pnpm debug:phase16-3-unified-entry`：`20 / 20 PASS`，共享快照用例确认一次入口恢复只产生 1 次正式资源请求；
- `pnpm debug:phase17-3-learning-entry`：`10 / 10 PASS`；
- `pnpm debug:learning-entry`：`PASS`；
- `pnpm debug:phase17-4a`：`12 / 12 PASS`；
- `pnpm build`：`PASS`；
- 浏览器真实入口 `/learning` 可稳定结束 Loading，并显示“本次学习已经结束”等正常业务状态，不再误报“暂时无法打开学习入口”。

本记录作为后续学习入口读取性能、空状态语义和共享正式资源一致性的回归基线。

### 21.10 单题检查可观察性、标题幂等与学习空状态

统一工作台不得把长耗时检查、标题展示和学习入口空结果留给页面自行解释。以下规则作为生产链与消费链的共同契约：

1. 单题检查必须按 `draft_saved -> structure_checked -> assessment_completed` 三个阶段执行；任务卡摘要区必须同步显示当前阶段，不能只在折叠详情内显示 Loading；
2. 完整质量检查未形成时，必须保留已经完成的保存与结构检查结果，并显示可重试的结构化失败说明；不得静默恢复为“检查题目”，也不得要求用户重复保存；
3. 页面不得仅凭七项结构检查图标推断完整质量检查已完成；只有当前 Draft Revision 的完整 Assessment 已成功写入，任务才可进入最终确认；
4. 素材标题展示必须通过同一幂等格式化函数。纯标题可补书名号，已经包含规范书名号的标题不得再次包裹；`谭嗣同《潼关》` 必须保持原样；
5. 学习入口必须把 `no_formal_resource`、`no_eligible_match`、`already_used` 等业务空状态传递到页面，不得只传一段不可追溯的通用文案；
6. 空状态属于读取成功结果。只有 Deadline、Repository 或数据解析失败才允许显示读取失败和重试动作；
7. 检查阶段、标题格式和学习空状态均必须有独立自动化回归，避免后续组件重构重新引入静默失败、重复书名号或错误归因。

本轮 Debug 基线：

- `pnpm debug:task-production-command-runtime`：`5 / 5 PASS`；
- `pnpm debug:material-title`：`7 / 7 PASS`；
- `pnpm debug:phase16-3-unified-entry`：`23 / 23 PASS`；
- 浏览器中单题检查可见“正在生成完整质量检查记录”；远端评估未形成时显示明确失败说明；
- 浏览器中 `谭嗣同《潼关》` 未被重复包裹；学习入口正常结束读取且无控制台错误。
