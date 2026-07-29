# Phase 17 题目审核与发布工作流契约

英文名称：Question Review and Publication Workflow Contract

状态：DESIGN FROZEN / ENGINEERING CALIBRATION PENDING  
契约版本：`question_review_publication_workflow_v1.1`  
更新日期：2026-07-29

## 一、用途与权威边界

本文冻结 Phase 17 题目审核与发布平台的工作流、信息层级、操作语义、质量问题分级和页面区域职责。

题目审核与发布平台的唯一主任务是：

```text
确认题目内容
→ 处理质量问题
→ 提交人工审核
→ 形成审核决定
→ 完成正式发布
```

平台不要求用户一次性理解所有 Schema、来源、版本和内部质量字段，也不承担训练任务规划或 Material Observation Plan 的重新设计。

本文不替代：

1. [Phase 17 录入字段契约](./AUTHORING_FIELD_CONTRACT.md)；
2. [Phase 17 录入、审核与发布职责边界契约](./AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md)；
3. [Phase 17 单训练任务重新生成契约](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md)；
4. [Phase 17 训练任务组 AI 规划契约](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md)；
5. Question Draft、Revision、Validation、QuestionQualityAssessment、Human Review、Freeze 与 Formal Resource 的既有数据和运行规则。

本文只负责把上述业务契约翻译为稳定、清晰、低负担的审核工作流。字段、保存、检查、审核、发布和问题定位不得在页面中形成第二套解释。

本文描述的是完整平台工作流，不要求同一用户完成所有阶段。内容编辑者、审核者和发布者可以是同一用户，也可以由后续权限模型分离；无论角色如何分配，各阶段的数据、Revision 和状态边界不得改变。

录入端、审核端与发布过程的职责划分以“录入、审核与发布职责边界契约”为准。本文中涉及内容修改、质量问题处理和“定位修改”的规则，默认属于提交人工审核前的录入阶段；进入 `pending_review` 后，审核端只读并只负责接受或退回，不再直接修改正式内容。

## 二、平台主任务与非目标

### 2.1 用户进入平台需要完成什么

审核者进入平台后，只需要依次回答五个问题：

1. 当前正在处理哪一道题；
2. 题目、学生任务和评分规则是否正确；
3. 系统发现了哪些必须处理或需要关注的问题；
4. 当前内容是否已经保存并基于最新 Revision 完成检查；
5. 当前题目是否可以提交人工审核或发布。

### 2.2 平台不负责什么

题目审核与发布平台不负责：

1. 从零规划整组训练任务；
2. 重新选择 Material Observation Plan 的能力覆盖方向；
3. 在预览页面编辑正式内容；
4. 通过页面展示推断或拼装另一套正式状态；
5. 使用系统检查结果替代人工审核决定；
6. 在点击发布后才首次暴露已知阻断问题。

若问题来源于 Plan 管理的受控字段，平台应准确说明冲突，并引导返回任务调整或执行已有受控同步能力，不得诱导用户反复改写无关题干。

## 三、信息层级

页面信息固定为四层：

| 层级 | 用户问题 | 内容 | 默认状态 |
| --- | --- | --- | --- |
| 一级 | 我现在处于什么状态，下一步做什么 | 当前题目、当前状态、未保存状态、检查时效、下一步动作、发布准备状态 | 始终显示 |
| 二级 | 这道题到底要求学生做什么 | 题目、学生任务、观察目标、能力目标、具体训练点、材料范围 | 默认展开 |
| 三级 | 系统如何判定回答是否满足要求 | 评分项、答案接受范围、最低作答要求、参考答案或答案示例 | 默认展开；长内容可在模块内折叠 |
| 四级 | 这道题从哪里来，如何追溯 | 高级设置、来源说明、版权说明、内部版本、规则版本、历史 Revision | 默认折叠 |

### 3.1 当前状态与下一步

一级信息必须同时表达：

1. 当前生命周期状态；
2. 是否存在未保存修改；
3. 当前 Assessment 是否仍然有效；
4. 是否存在阻断问题；
5. 唯一推荐的下一步动作。

禁止只显示“草稿”“检查通过”或“发布未完成”等孤立状态，让用户自行推断下一步。

推荐表达：

```text
当前状态：内容已修改，等待保存并重新检查
下一步：保存当前修改并重新检查题目
```

### 3.2 质量问题区

存在未解决问题时，质量问题区自动展开，并按严重程度排序：

```text
阻断问题
→ 人工关注
→ 优化建议
```

全部问题已解决时，质量问题区收起为摘要：

```text
系统检查通过
7 项通过，0 项阻断，0 项人工关注
```

系统检查通过不等于人工审核通过，也不等于已经发布。

### 3.3 右侧题目列表

右侧列表只承担批次导航，不承担编辑：

1. 使用稳定题号，不因筛选状态重新编号；
2. 展示题目摘要、生命周期状态和未处理问题数量；
3. 选中题目使用明确选中样式；
4. 点击后切换主编辑区；
5. 不在列表内复制完整评分、检查和发布操作。

题目内容应完整可读，空间不足时可以通过展开或主编辑区查看，不得以不可交互的省略号隐藏关键内容。

## 四、页面区域职责

| 页面区域 | 唯一职责 | 禁止行为 |
| --- | --- | --- |
| 批次题目列表 | 题目导航、状态扫描、问题数量扫描 | 不直接编辑，不触发发布 |
| 主编辑区 | 修改当前题目的正式内容 | 不展示历史检查为当前结论 |
| 质量检查区 | 解释问题、定位字段、显示解决状态 | 不替代人工审核 |
| 底部操作区 | 保存、重新检查、提交审核 | 不混入字段编辑 |
| 学生预览 | 验证学生实际看到的题目与材料 | 不提供编辑 |
| 审核预览 | 验证审核者将要确认的内容与依据 | 不产生隐式修改 |
| 来源与追溯区 | 查看来源、Revision、规则版本和历史记录 | 不占用首层主要空间 |

### 4.1 编辑与预览边界

预览页始终只读。需要修改时必须返回主编辑区，并保持当前题目、问题和字段定位上下文。

从预览返回不得：

1. 跳回批次第一题；
2. 丢失当前 Material、Plan 或 Draft；
3. 新建重复 Draft；
4. 把预览操作误记为内容修改。

## 五、内容与生命周期状态

页面需要区分内容状态和流程状态，不能把它们混成一个标签。

### 5.1 内容状态

```text
clean
→ 当前页面内容与已保存 Draft Revision 一致

dirty
→ 页面存在尚未保存的质量相关修改
```

### 5.2 检查状态

```text
not_checked
→ 当前 Revision 尚无正式检查

current
→ Validation 与 Assessment 均绑定当前 Revision 和当前规则版本

stale
→ 内容或规则已变化，旧检查只能用于历史追溯
```

### 5.3 审核与发布状态

```text
draft
→ pending_review
→ approved
→ frozen
→ published
```

系统检查、人工审核和正式发布是三个不同判断：

```text
Validation / QuestionQualityAssessment
→ 系统检查

Human Review Decision
→ 人工审核

Freeze / Formal Resource Publication
→ 正式发布
```

### 5.4 当前有效 Assessment 的唯一计算

页面、提交审核和发布不得各自拼装 Assessment 是否有效的判断。系统必须提供一个领域层唯一状态解析器，并由所有入口共同消费。

```ts
type CurrentAssessmentState =
  | { kind: 'missing' }
  | { kind: 'current' }
  | { kind: 'stale_by_revision' }
  | { kind: 'stale_by_validation' }
  | { kind: 'stale_by_rule_version' }
  | { kind: 'stale_by_context' }
  | {
      kind: 'failed';
      stage: 'semantic';
      status: 'provider_failed' | 'timeout' | 'invalid_output';
    };
```

判定当前有效至少必须同时满足：

1. `assessment.draftId === draft.draftId`；
2. `assessment.resourceId === draft.resourceId`；
3. `assessment.assessedDraftRevision === draft.revision`；
4. `assessment.validationId === validation.validationId`；
5. `assessment.ruleVersion === currentRuleVersion`；
6. 需要批次比较时，`comparisonContextHash` 与当前比较上下文一致；
7. Validation 绑定当前 Draft Revision 且已经通过；
8. 语义质量检查属于正式流程时，其执行状态为 `completed`。

现有 `isCurrentQuestionQualityAssessment` 与 `requireCurrentQuestionQualityAssessment` 是领域判断基础。工程实现应在此基础上提供可解释的状态解析结果，不得在页面新增另一套布尔判断。

`stale` 是旧 Assessment 相对于当前编辑上下文的计算结果，不是对历史 Assessment 记录的状态改写。旧记录必须保持不可变并继续用于追溯。

### 5.5 审核中的编辑权限

进入 `pending_review` 后：

1. 题目、学生任务、观察目标、评分标准和其他正式内容字段默认只读；
2. 审核意见与审核决定仍可操作；
3. 如需修改正式内容，必须先执行“退回修改”；
4. 返回 `draft` 后才允许编辑并产生新 Revision；
5. 禁止在审核中静默修改内容，否则 Human Review 与页面内容将不再指向同一 Revision。

`approved`、`frozen` 和 `published` 状态下的正式内容同样不可原地修改。后续调整必须通过受控的新 Draft Revision 完成。

`reviewed` / `approved` 状态下如在发布前发现内容问题，必须先撤销当前发布流程并退回修改。修改后创建新 Draft Revision，旧 Human Review Decision 继续绑定原 Revision，仅用于追溯；禁止修改已审核 Revision 后继续沿用原审核结论。

## 六、操作语义

### 6.1 唯一动作表

| 页面动作 | 内容副作用 | Revision 行为 | Assessment 行为 | 生命周期行为 |
| --- | --- | --- | --- | --- |
| 保存草稿 | 保存当前正式字段 | 仅在内容发生变化时创建新的 Draft Revision | 旧 Assessment 保留为历史，但对新 Revision 失效 | 保持 `draft` |
| 重新检查 | 不修改内容 | 不创建 Revision | 基于当前 Revision 和当前规则版本生成或幂等复用 Validation 与 Assessment | 不改变人工审核状态 |
| 保存并重新检查 | 依次执行“保存草稿”和“重新检查” | 有内容变化时最多创建一个新 Revision | 检查新 Revision | 保持 `draft` |
| 提交人工审核 | 不修改内容 | 不创建 Revision | 只读取当前有效结果 | `draft` → `pending_review` |
| 审核通过 | 不修改内容 | 不创建 Revision | 不替代 Assessment | 为当前 Revision 记录通过的 Human Review Decision |
| 退回修改 | 不修改题目内容 | 不创建 Revision | 当前结论保留追溯；后续修改将使其失效 | `pending_review` → `draft` |
| 拒绝采用 | 不修改题目内容 | 不创建 Revision | 保留追溯 | 为当前 Revision 记录拒绝决定 |
| 发布正式题目 | 不修改 Draft 内容 | 不创建新的 Draft Revision | 只消费当前有效检查 | 对审核通过的当前 Revision Freeze，并幂等创建正式版本 |

### 6.2 保存规则

保存草稿必须满足：

1. 无内容变化时不创建空 Revision；
2. 重复点击同一内容只产生一个等价保存结果；
3. 保存后的 Revision 必须能够刷新恢复；
4. 旧 Revision、旧 Assessment 和旧 Review 保留用于审计；
5. 新 Revision 不继承旧 Assessment 的“当前有效”身份。

### 6.3 重新检查规则

重新检查：

1. 不创建内容 Revision；
2. 只检查已经保存的当前 Revision；
3. 同一 Revision、同一规则版本、同一输入的重复检查幂等复用；
4. 页面存在未保存内容时，不得对旧保存内容执行检查并将结果伪装成当前结论；
5. 可以在界面中提供“保存并重新检查”的组合动作，但底层必须保持两个独立 Command。

### 6.4 提交审核规则

提交人工审核的前置条件：

1. 当前内容已保存；
2. Validation 绑定当前 Revision；
3. QuestionQualityAssessment 绑定当前 Revision 和当前规则版本；
4. 没有未解决阻断问题；
5. 非阻断人工关注已处理或显式接受；
6. 当前 Plan、Material 和 Draft 身份一致。

### 6.5 审核通过规则

人工审核决定必须绑定：

```ts
type HumanReviewBinding = {
  draftId: string;
  draftRevision: number;
  validationId: string;
  assessmentId: string;
  reviewedBy: string;
  reviewedAt: string;
};
```

系统检查通过不得自动创建人工审核通过决定。

录入人员对非阻断提醒的保留确认与审核人员的接受决定必须分别持久化。审核人员的决定至少绑定：

```ts
type ReviewWarningDecision = {
  warningDecisionId: string;
  draftId: string;
  draftRevision: number;
  assessmentId: string;
  warningCode: string;
  decision: 'accepted' | 'rejected';
  reviewedBy: string;
  reviewedAt: string;
};
```

P0 以 `assessmentId + warningCode` 绑定当前 Warning；独立
`warningAcknowledgementId` 在录入端确认理由持久化完成后作为附加追溯关系接入。
所有必须确认事项必须逐项形成决定。存在未决事项时不得审核通过；任一事项被拒绝时，当前提交整体进入 `revision_required`，不得建立部分审核通过状态。

### 6.6 发布规则

发布前必须在页面上提前展示发布准备状态。禁止用户点击发布后才首次看到系统已经知道的阻断项。

发布前检查至少包括：

1. 当前内容已保存；
2. 当前结构与质量检查有效；
3. 当前 Revision 已人工审核通过；
4. Plan 管理的受控设置一致；
5. Material、来源、Observation Link 和正式资源身份完整；
6. 当前 Revision 尚未以同一正式身份重复发布。

发布是幂等操作。重复点击不得生成多个 `FrozenQuestionResourceVersion`、Formal Resource Version 或重复 Registry Entry。

### 6.7 发布部分失败与恢复

正式发布可能跨越：

```text
Freeze 当前审核通过的 Revision
→ 写入 FrozenQuestionResourceVersion
→ 更新 ResourceRegistryEntry
```

在支持事务的 Repository 中，上述写入应通过既有 `ResourceFreezeCommit` 原子提交。对于无法保证跨存储事务的适配器，必须记录可恢复进度：

```ts
type PublicationProgress = {
  draftId: string;
  resourceId: string;
  resourceVersionId?: string;
  registryWritten: boolean;
  status:
    | 'not_started'
    | 'formal_version_created'
    | 'completed'
    | 'partially_completed';
  failedStep?: 'formal_version' | 'registry';
};
```

恢复规则：

1. 若 `FrozenQuestionResourceVersion` 已创建、Registry 写入失败，重试必须复用原 `resourceVersionId`；
2. 重试只补齐缺失的 Registry 写入，不得再次 Freeze 或提高版本号；
3. 同一 `draftId` 和同一审核通过 Revision 必须得到同一个正式版本；
4. 页面应明确显示“发布未完成，可继续完成发布”，不得把部分成功伪装成完全失败；
5. 发布完成前不得让 Runtime 把缺少有效 Registry 指向的版本视为可用正式资源；
6. 历史正式版本不得因重试或补写 Registry 被覆盖。
7. Human Review 已成功但 Publication 失败时，页面显示“审核已通过，发布未完成”并提供“重试发布”；
8. 发布失败不得把审核状态回滚为待审核，也不得重复创建 Human Review Decision。

## 七、质量问题分级

### 7.1 阻断问题

阻断问题必须修复后才能提交审核或发布。

典型情况：

1. 必填正式字段缺失；
2. 题目绑定的能力、任务用途、材料范围等受控字段与当前 Plan 冲突，且无法由适配规则解释或同步；
3. Validation 或 Assessment 已失效；
4. Rubric、Answer Acceptance 或材料来源缺少正式运行所需的最低结构；
5. 当前 Revision 尚未完成要求的人工审核；
6. 发布身份冲突或来源链断裂。

内容措辞与 Plan 观察点存在轻微偏差，不得仅凭文本差异直接升级为阻断。

### 7.2 人工关注

人工关注表示系统发现风险，但不能独立作出最终判断。

典型情况：

1. 题目与同批其他题目可能考查相同内容；
2. 题目、学生任务和观察目标可能职责性重复；
3. 评分项区分度可能不足；
4. 材料依据表达可以更明确；
5. 难度和作答要求可能存在偏差，但尚未形成受控字段冲突。

人工关注允许：

```text
定位修改
或
接受当前设计
```

接受当前设计必须绑定当前 Revision，并记录操作人、时间和理由。内容再次修改后，原接受记录不得自动适用于新 Revision。

### 7.3 优化建议

优化建议不阻止保存、提交审核或发布，用于改善：

1. 文案清晰度；
2. 页面可读性；
3. 非关键表达；
4. 不影响质量判断的可选元数据。

优化建议不得使用阻断色彩或阻断按钮。

## 八、问题对象与统一提示结构

每个质量问题至少使用以下结构：

```ts
type ReviewIssueSeverity =
  | 'blocking'
  | 'attention'
  | 'suggestion';

type ReviewIssueStatus =
  | 'open'
  | 'needs_recheck'
  | 'resolved'
  | 'accepted';

type ReviewIssue = {
  issueId: string;
  draftId: string;
  draftRevision: number;
  assessmentId: string;
  severity: ReviewIssueSeverity;
  fieldKey: AuthoringFieldKey;
  message: string;
  currentValueSummary?: string;
  recommendation?: string;
  status: ReviewIssueStatus;
};
```

页面提示固定展示：

1. 问题字段；
2. 为什么有问题；
3. 当前内容摘要；
4. 建议修改方向；
5. 定位修改；
6. 接受当前设计，仅限非阻断项。

禁止只显示“可能不一致”“缺少依据”或“需要修改”等无法执行的结论。

## 九、问题处理闭环

正式闭环为：

```text
发现问题
→ 定位修改
→ 展开目标模块
→ 聚焦并高亮目标字段
→ 用户修改
→ 标记当前内容未保存
→ 旧 Assessment 失效
→ 保存新 Revision
→ 重新检查
→ 新 Assessment 判断问题是否关闭
```

### 9.1 定位修改

定位修改必须：

1. 切换到问题所属题目；
2. 展开目标模块；
3. 滚动到目标字段；
4. 将输入焦点放入准确控件；
5. 使用短暂高亮帮助确认位置；
6. 不创建 Revision，不修改字段值。

若字段由 Plan 管理，定位动作必须进入对应任务调整入口或执行已定义的受控同步，不得错误定位到题干。

### 9.2 修改后的问题状态

用户修改相关字段后，原问题不得立即显示“已解决”。

正确状态是：

```text
needs_recheck
```

推荐文案：

```text
内容已修改，等待保存并重新检查
```

只有绑定新 Revision 的正式 Assessment 确认问题不再成立时，问题才能进入：

```text
resolved
```

### 9.3 未保存保护

当前题目存在未保存修改时：

1. 切换其他题目必须提供明确三选项：

```text
当前题目有未保存修改

[保存后切换]
[放弃修改并切换]
[取消]
```

2. 进入预览必须明确预览的是当前页面内容还是已保存内容；
3. 提交审核保持不可用；
4. 不能显示旧检查为当前结论；
5. 刷新或返回时不得静默丢失修改。

“保存后切换”只执行保存和导航，不自动重新检查、不提交审核。保存失败时必须停留在当前题目。“放弃修改并切换”必须恢复当前已保存 Revision 后再导航。题目列表切换、浏览器返回、刷新和进入预览应复用同一离开保护规则。

## 十、发布准备前置

发布准备区必须在发布动作可见前完成计算。

推荐结构：

```text
发布准备
3 / 4 项完成

✓ 当前内容已保存
✓ 结构与质量检查对应当前版本
✓ 已完成人工审核
△ 题目设置与训练计划一致
```

存在未完成项时，页面直接提供：

1. 具体差异；
2. 应修改的对象；
3. 修改位置；
4. 解决动作；
5. 处理后需要重新执行的检查。

禁止把已知问题延迟到“发布正式题目”点击之后。

## 十一、Command 与数据边界

页面操作应映射到独立 Command：

```ts
saveQuestionDraft
runQuestionValidation
runQuestionQualityAssessment
resolveCurrentAssessmentState
submitQuestionForHumanReview
recordHumanReviewDecision
returnQuestionForRevision
freezeAndPublishQuestion
resumeQuestionPublication
locateReviewIssue
acceptReviewAttention
```

允许界面把保存和检查组合为一个按钮，但禁止多个业务动作共享无法辨认副作用的模糊 Handler。

数据写入边界：

```text
字段编辑
→ 仅更新页面编辑缓冲区

保存草稿
→ 有变化时创建新 Draft Revision

重新检查
→ 写入或幂等复用当前 Revision 的 Validation / Assessment

提交审核
→ 改变审核生命周期，不修改内容

人工审核决定
→ 写入绑定当前 Revision 的 Review Decision

发布
→ Freeze 当前已审核 Revision，并创建或复用正式资源版本
```

### 11.1 角色与动作边界

| 角色 | 允许的正式动作 | 不得产生的隐式副作用 |
| --- | --- | --- |
| 内容编辑者 | 编辑、保存、重新检查、提交人工审核 | 不自动形成审核决定或正式发布 |
| 审核者 | 审核通过、退回修改、拒绝采用 | 不在 `pending_review` 中静默修改正式内容 |
| 发布者 | 检查发布准备、完成或恢复正式发布 | 不创建新的内容 Revision |

同一用户可以承担多个角色，但每个动作仍必须遵守对应 Command 和数据写入边界。

## 十二、颜色与状态表达

颜色遵循 [产品颜色语义](./PRODUCT_COLOR_SEMANTICS.md)：

| 颜色 | 工作流含义 |
| --- | --- |
| 绿色 | 通过、成功、已完成 |
| 红色 | 失败、阻断、不可继续 |
| 黄色 | 提醒、人工关注、需要注意 |
| 蓝色 | 选中、定位、动作、执行、当前步骤 |
| 紫色 | AI 生成、AI 建议、智能处理 |

颜色不能作为唯一信息来源。状态必须同时具有清晰中文文案。

## 十三、工程验收标准

### 13.1 动作与版本

1. 修改正式字段后页面立即进入未保存状态；
2. 保存有变化的内容只创建一个新 Draft Revision；
3. 无变化重复保存不创建空 Revision；
4. 重新检查不创建内容 Revision；
5. 同一 Revision 的重复检查、提交和发布满足幂等规则；
6. 发布后正式版本不可被后续 Draft 修改覆盖。

### 13.2 Assessment 时效

1. 修改任一质量相关字段后旧 Assessment 立即失效；
2. 旧结果只作为历史记录，不继续显示为当前结论；
3. 保存并重新检查后，新结果绑定新 Revision；
4. 提交审核只消费当前有效结果；
5. 规则版本变化后旧 Assessment 不再作为当前审核依据；
6. 页面、提交审核和发布对同一输入得到相同的 `CurrentAssessmentState`；
7. Validation、比较上下文或语义检查状态变化时能够返回准确的失效或失败原因；
8. 状态解析不得改写历史 Assessment。

### 13.3 问题闭环

1. 阻断、人工关注和优化建议具有不同提交行为；
2. 点击定位修改准确切换题目、展开模块并聚焦字段；
3. 编辑问题字段后状态变为等待重新检查，而不是直接解决；
4. 新 Assessment 通过后问题才关闭；
5. 接受当前设计只适用于非阻断项，并绑定当前 Revision；
6. Plan 受控字段问题不会错误定位到题干。

### 13.4 页面职责

1. 右侧列表只承担批次导航和状态扫描；
2. 主编辑区是唯一正式内容编辑位置；
3. 学生预览和审核预览均为只读；
4. 一级状态始终可见；
5. 高级设置和追溯信息默认折叠；
6. 发布阻断在发布按钮可用前已经显示。

### 13.5 审核中只读与切换保护

1. `pending_review` 下正式内容字段只读；
2. 点击“退回修改”后返回 `draft`，才允许编辑；
3. 未保存时切换题目显示“保存后切换、放弃修改并切换、取消”；
4. 保存失败不得切换；
5. “保存后切换”不自动检查或提交审核；
6. 浏览器返回、刷新和进入预览复用同一保护规则。

### 13.6 端到端回归

至少覆盖：

```text
选择题目
→ 定位一个质量问题
→ 修改对应字段
→ 旧 Assessment 失效
→ 保存形成一个新 Revision
→ 重新检查
→ 问题关闭
→ 提交人工审核
→ 审核通过
→ 发布
→ 重复发布不产生重复正式版本
```

同时覆盖：

1. 切换题目时的未保存保护；
2. 从预览返回后保持当前题目和字段上下文；
3. 退回修改后只修订当前题目，不批量生成兄弟 Draft；
4. 发布前 Plan 差异能够前置显示并准确定位；
5. 刷新恢复后当前 Revision、Assessment 和 Review 身份一致。

发布恢复至少覆盖：

```text
创建 FrozenQuestionResourceVersion 成功
→ Registry 写入失败
→ 页面显示发布未完成
→ 重试发布
→ 复用原 resourceVersionId
→ 只补齐 Registry
→ 不产生新的正式版本
```

## 十四、实施顺序

### P0：工作流状态与问题闭环

1. 建立领域层唯一 Assessment 状态解析器；
2. 让页面、提交审核和发布共同消费该解析结果；
3. 冻结 `pending_review` 正式内容只读规则；
4. 统一保存、检查、审核、退回修改和发布的 Command；
5. 落地阻断、人工关注和优化建议；
6. 修复 Assessment 失效与问题关闭条件；
7. 完成题目切换、返回、刷新和预览的未保存保护；
8. 将发布阻断前置到发布准备区；
9. 补齐发布部分失败后的幂等恢复；
10. 保证定位修改准确命中字段。

### P1：信息层级与页面职责

1. 落地四层信息结构；
2. 固定默认展开和折叠规则；
3. 收敛右侧列表、主编辑区、检查区和底部操作区；
4. 统一学生预览、审核预览的只读边界；
5. 完成未保存保护和返回上下文恢复。

### P2：批次效率与可观察性

1. 提供批次问题数量和状态扫描；
2. 记录问题定位、修改、重新检查和关闭耗时；
3. 统计阻断率、人工接受率和重复修改次数；
4. 用真实十篇素材验证问题分级与工作流负担；
5. 不在 P0 / P1 未稳定前继续堆叠新的审核入口。

## 十五、当前结论

题目审核与发布平台不是字段全集浏览器，而是一条受控决策链：

```text
当前题目
→ 当前问题
→ 准确修改
→ 保存当前 Revision
→ 重新检查
→ 人工审核
→ 正式发布
```

页面优化必须优先降低三类风险：

1. 不知道改哪里；
2. 不知道怎么改；
3. 修改后仍沿用旧检查或在发布末端才暴露问题。

本契约冻结工作流和交互语义，不新增教育判断，不降低 Validation、Assessment、Human Review 或 Freeze 标准。

## 十六、工程落地状态

截至 2026-07-29，P0 关键链路已经完成工程对齐：

1. Assessment 当前性由领域层唯一解析器统一计算；
2. 页面、提交审核和发布不再维护互相独立的 Assessment 时效判断；
3. `pending_review` 正式字段保持只读，修改必须先退回 Draft；
4. 题目切换、新建、刷新和返回统一使用三选项未保存保护；
5. “保存后继续”只保存当前 Draft，不触发提交或发布；
6. Registry 写入缺失时，发布重试复用既有 Frozen Version 并完成恢复。

对应自动化回归覆盖：

- 五种 `CurrentAssessmentState` 的唯一解析；
- Draft Revision 和规则版本变化后的 Assessment 失效；
- Frozen Version 已存在、Registry 缺失时的幂等恢复；
- 恢复过程中不创建重复正式版本。

对应浏览器验收覆盖：

```text
编辑草稿
→ 切换其他题目
→ 显示“保存后继续 / 放弃修改并继续 / 取消”
→ 取消后停留在当前题目
→ 放弃后切换成功
→ 未保存内容不写入草稿
```

P1 信息层级和页面职责已有既有实现基础，后续继续收敛时不得绕开本契约重新引入页面私有状态判断。P2 批次可观察性与真实十素材校准仍待后续产品验收。
