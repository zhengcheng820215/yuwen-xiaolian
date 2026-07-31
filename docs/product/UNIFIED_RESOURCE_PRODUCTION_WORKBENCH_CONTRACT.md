# 统一资源生产工作台契约

英文名称：Unified Resource Production Workbench Contract

状态：DESIGN FROZEN / P0 CONTRACT
文档版本：`unified_resource_production_workbench_v1`
更新日期：2026-07-31

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
| `editTaskQuestion` | 活动草稿 | 不保存、不检查、不确认、不发布 |
| `saveTaskDraft` | 当前活动 Draft / Revision | 不自动检查、不自动确认 |
| `runTaskCheck` | 当前 Revision 的 Assessment | 不修改正式字段 |
| `submitTaskForFinalConfirmation` | 提交记录 | 不形成通过决定、不发布 |
| `recordTaskConfirmationDecision` | Human Review Decision | 不静默修改题目 |
| `returnTaskForRevision` | 退回记录与任务状态 | 不创建第二个 Draft |
| `publishConfirmedTask` | Freeze、Formal Version、Registry | 不重新审核、不覆盖旧正式版本 |
| `retryTaskPublication` | 从已有发布结果继续 | 不重复创建已成功对象 |
| `viewFormalQuestion` | 无 | 只读，不触发状态迁移 |

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

### P2：统一命令与写入边界

1. 盘点保存、检查、提交、确认、发布与重试 handler；
2. 建立独立 Command；
3. 清除按钮直接拼装领域写入的路径；
4. 返回阶段化结果；
5. 补齐 Loading、幂等和失败恢复。

### P3：改造录入端训练任务卡

1. 每张任务卡展示主状态和主操作；
2. 将来源与状态分层；
3. 将题目状态和查看入口下沉到任务卡；
4. 上部只保留互斥数据总览；
5. 保持现有编辑能力不变。

### P4：迁移检查与最终确认

1. 将题目检查嵌入任务卡；
2. 将最终确认嵌入任务卡；
3. 保留 Human Review 与 Revision 绑定；
4. 将旧审核页改为只读详情；
5. 验证退回后回到同一 Draft 和同一 TrainingTask。

### P5：实现部分发布

1. 计算可发布任务集合；
2. 支持单项发布；
3. 支持批量发布已确认任务；
4. 返回逐项结果并支持单项重试；
5. 验证任务组 `partial` 状态。

### P6：收口旧流程

1. 删除重复审核入口；
2. 删除无入口可达的旧 handler；
3. 删除组件级重复状态计算；
4. 删除旧按钮和重复测试；
5. 保留只读历史详情和必要兼容跳转。

### P7：端到端验收与文档同步

1. 完成完整生产链回归；
2. 完成部分发布和失败恢复回归；
3. 更新契约地图、进度记录和 Debug 验收；
4. 清理临时兼容标记；
5. 再决定是否启用多人独立审核模式。

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
