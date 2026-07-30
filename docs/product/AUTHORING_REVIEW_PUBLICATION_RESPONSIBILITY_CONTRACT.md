# Phase 17 录入、审核与发布职责边界契约

英文名称：Authoring, Review and Publication Responsibility Contract

状态：DESIGN FROZEN / P0 ENGINEERING ALIGNED  
契约版本：`authoring_review_publication_responsibility_v2`  
更新日期：2026-07-29

## 一、目的

本文解决 Phase 17 资源生产链中的一个核心问题：

> 录入端已经完成检查和人工处理，为什么审核发布端还要再次展示同一套质量检查、修改建议和定位入口？

问题不在于系统存在多道质量保障，而在于不同阶段重复承担了“发现问题、指导修改和决定是否通过”三种职责，导致用户把提交前自检、人工审核和发布校验都理解为重复审核。

本文冻结三段职责：

```text
录入端负责改
→ 审核端负责判
→ 发布过程负责正式化
```

完整主链为：

```text
录入编辑
→ 提交前自检
→ 处理阻断与提醒
→ 提交人工审核
→ 人工审核裁决
→ 发布前一致性校验
→ Freeze / Formal Version / Registry
```

## 二、权威关系

本文不替代：

1. [Phase 17 录入字段契约](./AUTHORING_FIELD_CONTRACT.md)；
2. [Phase 17 题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md)；
3. [Phase 17 单训练任务重新生成契约](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md)；
4. [Phase 17 训练任务组 AI 规划契约](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md)；
5. Question Draft、Revision、Validation、QuestionQualityAssessment、Human Review、Freeze 与 Formal Resource 的既有领域规则。

本文只冻结录入、审核和发布之间的职责、权限、信息与状态交接。

若现有页面工作流说明与本文发生职责冲突，以本文为准：

1. 详细修改建议和“定位修改”属于录入端；
2. 审核端不得直接修改正式字段；
3. 发布过程不得重新发起内容编辑流程；
4. 系统检查不等于人工审核；
5. 发布一致性校验不等于第三次内容审核。

录入与审核可以暂时共用同一路由或页面组件，但必须由生命周期状态决定页面权限和信息层级，不得因为技术上共用页面而继续混合职责。

## 三、两次审核针对的对象

### 3.1 训练计划审核

素材录入阶段已有的人工审核主要针对 Material Observation Plan 或 Training Task Plan，判断：

1. 能力目标是否合理；
2. 训练方向是否覆盖；
3. 材料范围是否正确；
4. 任务用途和难度是否可接受；
5. 是否允许据此生成或编辑题目。

它回答：

> 这份训练计划能否进入题目生产？

### 3.2 最终题目审核

题目提交后的人工审核针对具体 Question Draft Revision，判断：

1. 学生最终看到的题目是否清楚；
2. 题目、学生任务和观察目标是否一致；
3. Rubric 与 Answer Acceptance 是否可执行；
4. 学生预览是否符合预期；
5. 当前 Revision 是否可以成为正式资源。

它回答：

> 这道最终题目能否正式发布？

两者审核对象不同，因此保留两道决策并不构成重复。需要消除的是：

```text
录入端详细检查并指导修改
→ 审核端再次展示同一份详细检查并指导修改
```

调整后应为：

```text
训练计划审核
→ 题目录入与提交前自检
→ 最终题目人工裁决
→ 发布一致性校验
```

页面与操作文案统一使用以下领域对象名称：

```text
训练计划审核
题目人工审核
发布准备检查
```

禁止使用缺少审核对象的“审核”“再次审核”或“发布审核”。三种判断分别面向训练计划、最终题目 Revision 和正式发布前置条件，不得在用户语言中混为同一动作。

## 四、三段职责边界

| 能力 | 录入端 | 审核端 | 发布过程 |
| --- | --- | --- | --- |
| 修改题目、Rubric、Acceptance | 是 | 否 | 否 |
| 修改能力、任务用途、难度 | 通过 Plan 受控入口 | 否 | 否 |
| 运行完整质量检查 | 是 | 后台验证当前性 | 只验证发布前置条件 |
| 查看检查记录 | 是 | 是 | 只读追溯 |
| 查看修改建议和参考写法 | 是 | 否 | 否 |
| 定位修改 | 是 | 否 | 否 |
| 处理系统提醒 | 修改或保留并说明 | 接受处理或退回 | 否 |
| 提交人工审核 | 是 | 否 | 否 |
| 直接编辑待审 Revision | 否 | 否 | 否 |
| 退回修改 | 否 | 是 | 否 |
| 形成审核决定 | 否 | 是 | 否 |
| Freeze / Formal Version / Registry | 否 | 触发 | 是 |

一句话冻结：

> 录入端拥有内容编辑权，审核端拥有质量裁决权，发布过程拥有正式化权。

## 五、录入端工作流

### 5.1 主任务

录入端负责：

```text
编辑内容
→ 运行提交前检查
→ 处理阻断问题
→ 修改或确认提醒
→ 保存当前 Revision
→ 重新检查
→ 提交人工审核
```

### 5.2 提交前检查

录入端应提供完整检查信息：

```text
提交前检查

自动检查结果
6 项通过
1 项提醒
0 项阻断
```

每个需要处理的问题可以包含：

1. 问题名称；
2. 问题原因；
3. 当前内容；
4. 修改位置；
5. 修改原则；
6. 参考写法；
7. 完成标准；
8. “定位修改”；
9. “保留当前设置”（仅非阻断项）。

底部动作固定为：

```text
[保存任务组并重新检查]
[提交题目审核]
```

存在以下任一情况时，不得提交：

1. 有未保存修改；
2. Validation 或 Assessment 不属于当前 Revision；
3. 存在阻断问题；
4. 提醒尚未处理或确认；
5. Plan 受控字段与当前题目无法解释地冲突。

### 5.3 保留提醒

非阻断提醒允许录入人员保留当前设计，但必须记录处理说明：

```ts
type WarningAcknowledgement = {
  draftId: string;
  draftRevision: number;
  assessmentId: string;
  warningCode: string;
  action: 'accepted_current_design';
  rationale: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
};
```

规则：

1. 确认必须绑定 Draft Revision 和 Assessment；
2. 修改任一相关字段后，旧确认随旧 Assessment 一起失效；
3. 确认不删除或改写原 Warning；
4. 审核端可以查看系统依据、处理方式和处理说明；
5. 阻断问题不允许使用该记录绕过。

`WarningAcknowledgement` 只表示录入人员决定保留当前设计并给出理由，不表示审核人员已经接受该处理。审核人员必须形成独立决定：

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

规则：

1. 审核决定必须绑定具体 Assessment Warning 与 Draft Revision；
2. `accepted` 表示审核人员接受录入人员对本项提醒的处理，不改变原 Warning；
3. `rejected` 表示本项处理不被接受，当前提交整体进入 `revision_required`；
4. 录入确认与审核决定是两层记录，不得共用同一个布尔字段或状态；
5. 新 Revision 产生后，旧 Review Warning Decision 仅保留追溯，不得继续作为当前决定。

P0 工程以 `assessmentId + warningCode` 作为 Warning 的稳定身份。后续落地独立
`WarningAcknowledgement` 持久化后，可以增加 `warningAcknowledgementId` 作为追溯关联，
但不得替代当前 Assessment 与 Revision 门禁。

## 六、审核端工作流

### 6.1 主任务

审核端负责：

```text
确认提交身份
→ 查看最终内容和学生效果
→ 查看录入端保留的提醒
→ 接受处理或退回修改
→ 形成 Human Review Decision
```

审核端不负责：

1. 再次指导如何修改；
2. 直接编辑题目或评分标准；
3. 重新规划训练任务；
4. 使用系统检查代替人工裁决；
5. 在当前 Revision 上静默修改后继续审核。

### 6.2 页面区域

审核页面固定为四个区域。

#### 提交信息

始终显示：

1. 审核状态；
2. 提交人；
3. 提交时间；
4. Draft Revision；
5. 录入端检查摘要；
6. 是否存在已确认提醒。

推荐表达：

```text
待人工审核
Revision 4 · 提交于 2026-07-29 18:30

录入检查
6 项通过 · 1 项提醒 · 0 项阻断
```

#### 审核预览

页签固定为：

```text
内容审核 | 学生预览 | 审核记录
```

`内容审核` 展示最终题目、能力目标、难度、材料范围、Rubric、Answer Acceptance 和作答要求。

`学生预览` 展示学生实际看到的题目、作答区域、提示及格式要求。

`审核记录` 展示录入检查摘要、提醒处理、历史 Revision 和上次退回原因。

所有页签只读。

#### 待确认事项

默认只显示：

1. 录入人员主动保留的提醒；
2. 审核者必须确认的高风险声明；
3. 当前提交与历史退回要求的对应情况。

不默认展示全部通过项，也不展示“怎么改”和“定位修改”。

单项结构：

```text
录入端保留提醒

难度设定可能偏低

系统依据：
当前难度为“基础”，题目包含两个分析任务。

录入人员处理：
保留当前设置

处理说明：
材料范围较小，评分仅要求一个主要原因。
```

审核者只能：

```text
[接受该处理]
[退回修改]
```

存在多个待确认事项时：

1. 每个必须确认事项都必须形成独立 Review Warning Decision；
2. 存在任一未决事项时，不允许审核通过；
3. 任一事项选择“退回修改”或记录 `rejected`，当前提交整体进入 `revision_required`；
4. 不建立“部分审核通过”状态；
5. 审核通过按钮的可用性必须由统一门禁计算，不得由页面局部状态自行推断。

```ts
type ReviewDecisionReadiness = {
  requiredDecisionCount: number;
  acceptedDecisionCount: number;
  rejectedDecisionCount: number;
  unresolvedDecisionCount: number;
  canApprove: boolean;
};
```

统一规则：

```text
canApprove =
  rejectedDecisionCount === 0
  && unresolvedDecisionCount === 0
  && 当前 Revision、Validation 与 Assessment 均有效
```

#### 审核决策

底部保留：

```text
[退回修改]
[审核通过]
```

审核通过后进入待发布状态，再提供：

```text
[发布正式资源]
```

单人轻量模式允许提供：

```text
[审核通过并发布]
```

但内部仍必须分别形成 Human Review Decision 和 Publication Result，不得合并为不可追溯的一次写入。

### 6.3 审核通过后的内容锁定

`reviewed`（用户语言“审核通过”）状态下，当前 Revision 的全部正式字段继续只读。

发布前发现内容问题时：

1. 必须撤销当前发布流程并执行“退回修改”；
2. 题目返回可编辑的 `draft` / `revision_required` 流程；
3. 内容修改后创建新的 Draft Revision；
4. 新 Revision 必须重新检查、重新提交并形成新的 Human Review Decision；
5. 原审核通过记录继续绑定原 Revision，仅用于追溯；
6. 禁止修改已审核 Revision 后继续沿用原审核结论。

以下行为必须被领域层拒绝：

```text
Revision 4 审核通过
→ 原地修改 Revision 4 的题干
→ 继续使用 Revision 4 的审核通过记录发布
```

## 七、退回修改闭环

退回修改必须填写结构化信息：

```ts
type ReviewChangeRequest = {
  draftId: string;
  reviewedRevision: number;
  issueType:
    | 'question_stem'
    | 'ability_target'
    | 'difficulty'
    | 'rubric'
    | 'answer_scope'
    | 'student_presentation'
    | 'other';
  description: string;
  requiredChange: string;
  requestedBy: string;
  requestedAt: string;
};
```

交互固定为：

```text
退回原因

问题类型
具体说明
修改要求

[取消]
[确认退回]
```

退回后：

1. 当前 Human Review Decision 绑定被审核 Revision；
2. 题目进入 `revision_required`；
3. 录入端直接显示退回原因和修改要求；
4. “定位修改”只在录入端出现；
5. 修改并保存后创建新 Draft Revision；
6. 旧 Revision、Assessment、Warning Acknowledgement 和 Review 保留；
7. 新 Revision 必须重新检查并重新提交。

审核端不得在被退回 Revision 上直接改字后继续使用原 Review。

## 八、发布过程

发布过程只执行正式化前置条件检查：

1. 当前 Draft Revision 与 Human Review Decision 一致；
2. Human Review Decision 为通过；
3. Validation 和 Assessment 仍属于当前 Revision 与规则版本；
4. 不存在阻断问题；
5. 所有必须确认的提醒已有有效处理和审核接受记录；
6. Freeze、Formal Version 和 Registry 写入满足幂等要求。

发布过程不重新执行：

1. 修改建议生成；
2. 参考写法生成；
3. 字段定位；
4. 训练计划重规划；
5. 内容人工审核。

发布出现部分成功时，重试必须复用既有 Freeze 和 Formal Version，只补齐缺失写入，不增加正式版本号。

当 Human Review 已成功而 Publication 失败时：

1. Human Review 不回滚为待审核；
2. 不重复生成 Human Review Decision；
3. 页面状态显示“审核已通过，发布未完成”；
4. 页面提供“重试发布”，不得要求再次审核；
5. 重试继续消费同一审核通过 Revision，并按既有发布进度补齐缺失写入。

## 九、状态映射

本契约不新增第二套底层生命周期。页面状态由现有领域状态与检查结果计算。

| 领域状态或条件 | 用户语言 |
| --- | --- |
| `drafted` | 录入中 |
| 当前 Validation 未执行 | 等待提交前检查 |
| 当前 Validation 未通过 | 检查未通过 |
| 当前 Assessment 存在未处理阻断 | 存在阻断问题 |
| `pending_review` | 待人工审核 |
| `revision_required` | 已退回修改 |
| `reviewed` 且未 Freeze | 审核通过，待发布 |
| `rejected` | 审核不通过 |
| 已存在 Frozen Version | 已发布 |

提醒使用附属数据表达：

```ts
type ReviewReadinessSummary = {
  passedCount: number;
  warningCount: number;
  blockingCount: number;
  unresolvedWarningCount: number;
};
```

提醒数量不单独改变生命周期。只有未解决阻断、无效 Assessment 或未处理提醒影响是否可以提交。

## 十、Revision 与检查时效

规则冻结为：

1. 录入端修改正式字段后，当前页面立即进入 dirty；
2. 保存实际内容变化时创建一个新 Draft Revision；
3. 同一轮未保存编辑不反复增加 Revision；
4. 新 Revision 使旧 Validation、Assessment、Warning Acknowledgement 和 Review 不再代表当前内容；
5. 重新检查不创建内容 Revision；
6. 提交审核只消费当前 Revision；
7. `pending_review` 正式字段只读；
8. `reviewed` 正式字段继续只读；
9. 退回后修改产生新 Revision；
10. 新 Revision 不继承旧 Human Review 或 Review Warning Decision；
11. 审核和发布不得自行拼装 Assessment 当前性。

## 十一、页面动作模型

### 录入端

```text
保存任务组并重新检查
提交题目审核
定位修改
保留当前设置
```

### 审核端

```text
查看检查记录
接受提醒处理
退回修改
审核通过
审核通过并发布（可选轻量模式）
```

### 发布过程

```text
发布正式资源
重试未完成发布
```

禁止重新出现：

1. 审核端“提交人工审核”；
2. 审核端可编辑正式字段；
3. 审核端详细修改教程；
4. 发布过程“定位修改”；
5. 同一按钮同时承担保存、检查、审核和发布。

审核通过后的发布区固定使用：

```text
审核已通过
当前 Revision 已锁定，等待发布

[发布正式资源]
```

发布失败后固定使用：

```text
审核已通过，发布未完成

[重试发布]
```

## 十二、最小工程改造

### P0：职责纠正

1. 录入端承接详细质量检查和问题处理；
2. 审核端将“校验 / 审核”改为“内容审核”；
3. 审核端删除修改建议、参考写法和定位修改；
4. 审核端删除“提交人工审核”；
5. 审核端只显示检查摘要和已保留提醒；
6. 增加只读审核预览、退回修改和审核通过；
7. 冻结 `pending_review` 只读与退回后新 Revision 规则。
8. 冻结 `reviewed` Revision 只读与审核结论绑定规则；
9. 建立多个待确认事项的审核通过统一门禁；
10. 区分 Warning Acknowledgement 与 Review Warning Decision；
11. 发布失败不得回滚或重复创建 Human Review Decision。

### P1：提醒处理与审核记录

1. 持久化 Warning Acknowledgement；
2. 增加结构化 Review Change Request；
3. 审核端展示录入处理说明；
4. 建立“接受处理 / 退回修改”闭环；
5. 审核记录展示历史 Revision 和退回原因。
6. 页面统一使用“训练计划审核”“题目人工审核”“发布准备检查”。

### P2：发布与可观察性

1. 审核通过后独立展示发布准备状态；
2. 支持可追溯的“审核通过并发布”编排；
3. 记录提交、退回、重新提交和发布耗时；
4. 使用真实十篇素材校准提醒接受率和退回率。

## 十三、验收标准

### 13.1 录入端

1. 详细问题仅在录入端提供修改指导；
2. 定位修改能够命中正确题目与字段；
3. 阻断未解决时不能提交；
4. 提醒必须修改或记录保留原因；
5. 提交只消费当前 Revision 的 Validation 与 Assessment。

### 13.2 审核端

1. `pending_review` 内容只读；
2. 审核端不显示详细修改教程；
3. 只显示检查摘要和需要确认的事项；
4. 能查看提醒依据、录入处理和处理说明；
5. 退回修改必须记录结构化原因；
6. 审核通过绑定当前 Revision。
7. 所有必须确认事项均有独立审核决定；
8. 存在未决或被拒绝事项时不能审核通过；
9. `reviewed` Revision 不可原地编辑。

### 13.3 发布过程

1. 发布只消费有效 Human Review Decision；
2. 发布前发现 Revision 或 Assessment 失效时阻断并返回录入流程；
3. 发布过程不允许修改内容；
4. 重试不产生重复 Freeze、Formal Version 或 Registry Entry；
5. “审核通过并发布”仍形成两个可追溯结果。
6. Human Review 成功但发布失败时显示“审核已通过，发布未完成”；
7. 重试发布不重复生成 Human Review Decision。

### 13.4 端到端

```text
录入修改
→ 保存并重新检查
→ 确认一项提醒并填写理由
→ 提交审核
→ 审核端只读查看
→ 退回修改
→ 录入端定位字段并创建新 Revision
→ 重新检查并提交
→ 审核通过
→ 发布正式资源
```

验收必须确认：

1. 没有重复的详细质量报告；
2. 没有审核端直接修改；
3. 没有旧 Assessment 或 Review 被新 Revision 继续消费；
4. 没有发布末端才首次暴露的已知阻断；
5. 没有因重试产生的重复正式版本。
6. 没有录入确认与审核接受共用同一状态字段；
7. 没有未决待确认事项时仍可审核通过；
8. 没有已审核 Revision 被原地修改后继续发布。

## 十四、最终结论

本契约不取消必要的质量保障，而是将三种不同判断归位：

```text
提交前自检
→ 负责发现和解决问题

人工审核
→ 负责接受或退回

发布一致性校验
→ 负责确认当前已审核 Revision 可以正式化
```

最终体验必须稳定为：

> 录入页发现问题并完成修改；审核页查看成品并作出裁决；发布过程确认版本未变化后冻结。

## 十五、2026-07-29 P0 工程落地记录

本轮已完成审核端职责对齐的 P0 闭环：

1. 新增统一 `CurrentAssessmentState`，页面、提交审核和发布共同消费
   `missing / current / stale_by_revision / stale_by_rule_version / failed`；
2. `pending_review` 进入只读“内容审核”，不再展示可编辑表单、AI 修改入口或详细修改教程；
3. 审核页固定为“内容审核 / 学生预览 / 审核记录”，右侧题目列表只承担批次导航；
4. Assessment Warning 必须逐项形成 `ReviewWarningDecision`，存在未决事项时禁用“审核通过”；
5. Review Warning Decision 绑定 `draftId + draftRevision + assessmentId + warningCode`；
6. 审核通过后继续锁定当前 Revision；发布失败显示“审核已通过，发布未完成”，重试复用既有审核与正式版本；
7. 修复只读审核页最低字数读取错位，审核页与编辑页统一读取 `minLength`。

自动化验收：

- Question Quality Review Gate：`11 / 11 PASS`；
- Question Resource Admission：`24 / 24 PASS`；
- Authoring Field Contract：`PASS`；
- Training Task Group Planning E2E：连续三轮候选采用后只保留一个 Revision，`PASS`；
- Production Build：`PASS`；
- `git diff --check`：`PASS`。

真实浏览器验收：

1. 待审核题目进入只读审核工作台；
2. 最低字数正确显示为 `20 字`；
3. 提醒未确认时“审核通过”不可用，确认后恢复可用；
4. 学生预览与审核记录均可访问；
5. 审核记录不外显内部 Draft ID；
6. 最终页面加载与交互未产生新的运行错误。

## 十六、2026-07-30 P0 提醒处理与退回闭环补强

本轮继续收口录入端与审核端的职责分离，完成以下 P0 工程项：

1. 新增独立 `AuthorWarningAcknowledgement`，记录录入人员保留当前设计的理由；
2. 审核端按“系统提醒 → 录入人员处理 → 处理说明 → 审核者决定”展示完整链条；
3. `ReviewWarningDecision` 继续独立记录审核者接受或拒绝，不复用录入处理状态；
4. 审核说明改为可选且默认空白，不再预填审核结论；
5. 未决提醒数量直接显示在审核决策区，存在未决事项时禁用“审核通过”；
6. 新增结构化 `ResourceReviewReturnRequest`，退回时分别记录问题类型、具体问题和修改要求；
7. 待人工审核题目不再提供直接删除入口，避免资源管理操作与审核裁决混用；
8. 正式工作台 API 强制结构化退回；底层旧调用保持兼容，避免破坏历史数据恢复。

自动化验收：

- Question Resource Admission：`27 / 27 PASS`；
- Question Quality Persistence：`24 / 24 PASS`；
- Question Workbench Command E2E：`6 / 6 PASS`；
- Production Build：`PASS`；
- `git diff --check`：`PASS`。

P1 仍保留更完整的历史审核记录、提交人身份与审核侧“撤回至录入端”等资源治理入口，
不得将本次 P0 通过解释为职责契约全部完成。

## 十七、2026-07-30 P1 审核审计与安全撤回

本轮 P1 不增加新的审核判断，只补齐审核流程的身份、时间和恢复能力：

1. 每次提交或撤回审核均写入 `reviewSubmissionHistory`，记录 Revision、操作者与时间；
2. 当前提交单独记录 `reviewSubmittedBy`，审核记录继续记录 `reviewerId`，两种身份不得混用；
3. 审核记录页按时间顺序展示提交、撤回、重新提交、审核通过和退回修改；
4. 审核决定可以按 `resourceId` 查询完整历史，不再只显示当前一条决定；
5. “撤回至录入端”只允许在 `pending_review` 执行，恢复为录入状态，但不创建内容 Revision；
6. 撤回后保留既有 Validation、Assessment 与完整审计记录；内容修改后仍按既有规则使旧检查失效；
7. 重新提交增加提交次数并追加审计事件，不覆盖之前的提交与撤回记录；
8. 审核内容页默认只显示关联材料标题和阅读范围，全文由审核者主动展开；
9. 审核工作台不外显内部 Draft ID、Review ID 等工程标识；
10. 已形成审核决定后不再允许通过撤回入口改写流程，必须使用既有退回或发布状态机。

统一语义：

```text
提交审核 / 撤回至录入端
→ 流程状态与审计事件变化
→ 不创建内容 Revision

修改题目 / 评分 / 训练设置
→ 内容发生变化
→ 保存时创建或更新受控 Revision
→ 旧 Assessment 按规则失效
```

自动化验收：

- Question Resource Admission：`28 / 28 PASS`；
- Question Quality Persistence：`24 / 24 PASS`；
- Question Workbench Command E2E：`6 / 6 PASS`；
- Production Build：`PASS`；
- `git diff --check`：`PASS`。

## 十八、2026-07-30 审核门禁与状态投影补强

本轮不增加新的生命周期状态，只冻结现有状态在录入端与审核端的唯一用户语言和操作门禁。

### 18.1 检查记录不完整时的硬门禁

审核端必须基于同一个 `checkRecordComplete` 结果控制页面：

```text
checkRecordComplete
= 当前 Revision 的 Validation 完整且通过
&& 当前 Revision 的 Assessment Bundle 完整
&& Assessment 规则版本仍为当前版本
```

当该结果为 `false` 时：

1. 不允许审核者接受任何待确认提醒；
2. 不允许审核通过；
3. 不得把历史提醒处理或旧 Assessment 投影为当前结论；
4. 页面必须明确提示“退回录入端重新检查”；
5. 审核者可执行的主流程动作仅保留“退回录入修改”；
6. 检查记录恢复完整后，待确认事项才重新开放。

### 18.2 状态文案的层级

状态必须按对象层级表达，不得把组级状态重复投影到每张任务卡：

| 对象 | 用户语言 |
| --- | --- |
| Material Observation Plan | `训练计划已确认` |
| 单个训练任务 | `自动检查通过`、`待调整`、`已纳入当前计划` |
| Question Draft | `待人工审核`、`已退回修改`、`审核通过` |
| Formal Resource | `已发布` |

训练任务检查汇总使用“`N 个训练任务已通过检查`”，不得使用缺少审核对象的“`N 个可进入审核`”。

### 18.3 退回与撤回

两个动作不能并列成相同层级：

| 动作 | 操作主体 | 语义 | Revision |
| --- | --- | --- | --- |
| `退回录入修改` | 审核者 | 对当前提交作出不通过裁决并给出结构化修改要求 | 不立即创建；录入修改保存后创建 |
| `撤回至录入端` | 提交者 | 在审核决定形成前主动撤销本次提交 | 不创建 |

`退回录入修改` 属于审核决策区主操作。`撤回至录入端` 属于低频资源治理，只能放入“更多操作”，不得与“审核通过”并列。

### 18.4 用户语言与工程标识

主工作区使用“第 N 版”“审核期间只读”等用户语言。`Revision N`、Draft ID、Assessment ID 与规则版本只允许出现在审核记录、来源追溯或工程调试视图中，不占据首层状态表达。

### 18.5 验收

1. 检查记录不完整时，“接受该处理”和“审核通过”均不可用；
2. 页面明确提供退回录入端重新检查的路径；
3. 训练计划的确认状态只在组级出现一次；
4. 单任务卡展示任务自身状态，不重复组级状态；
5. 撤回入口位于“更多操作”，文案为“撤回至录入端”；
6. 首层版本文案不外显 `Revision`。

## 十九、2026-07-30 退回后的恢复定位与重新提交

退回修改不是把用户送回素材列表重新寻找对象，而是恢复同一题目的受控修订工作。审核决定、录入恢复和重新提交必须围绕同一个资源根完成。

### 19.1 唯一恢复对象

退回决定至少绑定：

```text
materialVersionId
+ materialObservationPlanId
+ draftId
+ reviewedDraftRevision
+ ResourceReviewReturnRequest
```

其中 `draftId` 标识需要继续修订的题目，`reviewedDraftRevision` 标识被退回的提交快照。退回操作本身不创建新 Draft，也不得批量生成同素材的兄弟题目。

录入人员首次保存实际修改时，沿用该题目的资源根形成下一 Revision；历史审核决定继续只绑定被退回的旧 Revision。

### 19.2 自动恢复导航

审核者确认“退回录入修改”后，系统必须：

1. 打开被退回题目的录入状态，不落到通用素材选择页；
2. 保留当前 `materialVersionId`、`planId` 和 `draftId`；
3. 根据 `issueType` 展开并定位首要修改字段；
4. 在首屏显示具体问题和修改要求；
5. 找不到目标字段时停留在同一题目，并提供明确错误，不得静默跳到题目 1 或其他素材。

问题类型与默认定位：

| `issueType` | 首要修改位置 |
| --- | --- |
| `question_expression` | 题目 |
| `ability_target` | 训练目标 |
| `difficulty` | 难度；若难度由 Plan 控制则同时指向训练设置 |
| `rubric` | 评分标准 |
| `answer_scope` | 题目与作答要求 |
| `student_presentation` | 题目与学生预览相关字段 |
| `other` | 基础内容区，不自动猜测具体字段 |

### 19.3 修复进度

录入端必须把异常恢复表达成一条连续状态链：

```text
待修改
→ 修改待保存
→ 已保存，待重新检查
→ 检查未通过 / 可重新提交
→ 已重新提交
```

该进度是现有 Draft、Revision、Validation、Assessment 和 Submission 的页面投影，不增加新的业务生命周期状态。

### 19.4 重新提交门禁

同一题目只有同时满足以下条件才能重新提交：

1. 退回后的修改已经保存到当前 Revision；
2. 当前 Revision 的 Validation 与 Assessment 均为最新且完整；
3. 阻断问题为零；
4. 结构化退回要求已经由当前修改与检查覆盖；
5. 不存在未保存修改。

重新提交继续使用同一 `draftId` 和资源根，只追加提交审计事件。禁止通过重新进入发布流程创建另一份待审核题目。

### 19.5 检查记录不完整时的单一恢复动作

审核端发现检查记录不完整时，不再同时展示可接受提醒、修改教程和多个修复入口。首层只显示：

```text
当前提交缺少有效检查记录
→ 退回录入修改并重新检查
```

详细缺失项只进入折叠追溯区。该规则用于减少审核者误以为可以在审核端补检查或直接修改内容。

### 19.6 验收

1. 从题目 2 退回后仍打开题目 2，不默认落到题目 1；
2. 退回“评分标准”问题后自动定位评分标准；
3. 首屏同时显示具体问题、修改要求和当前修复阶段；
4. 修改但未保存时显示“修改待保存”；
5. 保存后显示“已保存，待重新检查”；
6. 当前检查通过后显示“可重新提交”；
7. 连续退回、修改和重新提交不增加兄弟 Draft；
8. 重新提交只为同一资源根追加一个新 Revision 和一条提交事件。

### 19.7 普通离开与返回的素材上下文

结构化“退回录入修改”必须使用 `materialVersionId + planId + draftId + issueType` 精确恢复题目和修改字段；普通页卡切换或离开页面后返回只恢复素材工作上下文，不伪造退回任务。

普通恢复优先级固定为：

```text
显式 URL materialVersionId / planId
→ 当前页面选择
→ 同一浏览器标签页的 sessionStorage 会话记忆
→ 无选择
```

会话记忆只允许保存 `materialVersionId` 与可选 `planId`。恢复前必须重新确认素材仍为 active、Plan 仍属于该素材；无效记录立即清除。素材正文、未保存表单、任务编辑缓冲、AI Candidate、Assessment、Review Decision 与 Publication 状态均不得写入该会话记忆。

该机制只减少用户返回后重复寻找素材的操作，不创建 Revision，不改变 Draft、Assessment、Review 或正式发布事实。

## 二十、2026-07-30 提交题目人工审核的阶段化结果

“提交题目人工审核”在用户侧是一个动作，在工程侧必须保留可恢复的阶段结果：

```text
训练计划已提交
→ 训练计划已确认
→ 待审核题目已创建
```

阶段标识统一为：

```ts
type MaterialQuestionReviewSubmissionStage =
  | 'plan_submitted'
  | 'plan_approved'
  | 'drafts_created';
```

执行与重试必须遵守：

1. 每个阶段成功后立即形成可识别结果；
2. 后续阶段失败时，错误必须返回已完成阶段和可重试提示；
3. 重试从持久化状态对应的下一阶段继续，不重复提交或确认训练计划；
4. 待审核题目创建失败时，不得把页面描述成“全部失败”；
5. 已创建待审核题目后再次执行同一命令，不得创建重复 Draft；
6. 页面只展示用户可理解的阶段结果，内部阶段码进入调试与审计信息。

验收至少覆盖：

1. 全链路一次成功；
2. 训练计划提交失败；
3. 训练计划已提交、确认失败；
4. 训练计划已确认、待审核题目创建失败；
5. 从 `pending_review` 与 `reviewed` 状态重试时跳过已完成阶段；
6. 连续重试不增加重复训练计划提交、确认或题目 Draft。
