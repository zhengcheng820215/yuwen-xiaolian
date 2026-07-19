# Phase 16.1：结构化题目录入与审核（Structured Question Intake and Review）

设计状态：ACCEPTED

工程状态：IN PROGRESS（16.1A PASS；16.1B IMPLEMENTED / AWAITING HUMAN DEMO ACCEPTANCE）

## 一、阶段目标

Phase 16.1 只解决一个核心问题：

> 如何让真实题目通过结构化 Draft、正式校验和人工审核进入系统，并形成不可静默修改、可版本追溯的 Frozen Question Resource？

本阶段不仅需要完成资源 Schema、Validator、Review、Freeze 与 Version Runtime，还必须提供一个无需修改工程代码即可使用的最小题目录入入口。

Phase 16.1 不以录入大量题目为目标。它首先建立正式资源准入规则，并验证人可以通过工作台安全地执行这些规则。

## 二、与 Phase 16 总纲的关系

Phase 16 总纲定义：

```text
16.1 正式资源如何进入系统
16.2 系统如何证明资源匹配合理
16.3 正式资源能否支持真实跨日学习
```

Phase 16.1 是后续阶段的输入基础：

```text
Raw Question Input
-> Structured Question Draft
-> Validation
-> Human Review
-> Frozen Question Resource
-> Phase 16.2 Resource Matching Quality
-> Phase 16.3 Real Multi-day Learning Operation
```

未通过 Phase 16.1 正式准入的资源，不得被 Phase 16.2 匹配，也不得进入 Phase 16.3 的正式学习运行。

## 三、与核心模型和现有工程的关系

### Question Model

Phase 16.1 继承以下原则：

- 题目是能力观察机会，不是长期能力结论；
- 每个 Task 必须具有一个主要观察目标；
- 同一 Material 可以支持多个独立 Task；
- 诊断题、训练题、复测题和迁移题的运行角色必须明确；
- 题目产生的 Evidence 价值取决于任务角色、提示、独立性、材料新颖度和可比较性。

### Question Metadata Model

具体 AssessmentMode、AnswerAcceptance、Rubric 和 Metadata 字段语义以 `QUESTION_METADATA_MODEL.md` 为准。

Phase 16.1 不创建第二套 Question Metadata Model。新资源 Contract 必须兼容现有 Diagnosis、ConcreteLearningTask 和 TaskFulfillment 的消费需求。

### Existing Runtime

当前工程已经存在 QuestionMetadata、ConcreteLearningTask 和 AvailableTaskResource 等早期结构。Phase 16.1 可以通过 Adapter 保留兼容，但必须明确：

- 早期 mock 或手写配置不自动等于 Frozen Question Resource；
- `mainAbility` 等兼容字段应逐步映射到稳定 `abilityId`；
- `trainingDirection` 等 Legacy 字段不能直接成为正式训练决策；
- 新资源准入不得修改冻结的 DiagnosisResult、AbilityEvidence 或 TaskRequest 核心语义。

## 四、两个内部工作包

Phase 16.1 内部拆分为两个工程工作包，但不升级为新的 Phase 编号。

### 16.1A：资源准入 Runtime

负责：

```text
Raw Input
-> Draft
-> Validation
-> Review
-> Freeze
-> Version
```

重点是：

- 数据结构；
- 稳定身份；
- 状态机；
- Validator；
- Review Decision；
- Frozen 不可变；
- 新版本关系；
- ResourceRegistry 当前正式目录；
- 幂等与重复操作保护；
- 本地持久化。

### 16.1B：最小录入工作台

负责：

```text
Human Input
-> Draft Editing
-> Validation Feedback
-> Review Action
-> Frozen Resource Preview
```

工作台是 16.1A 的人工操作入口，不拥有独立业务判断权。

工作台必须调用 16.1A 的正式 Validator、Review、Freeze 和 Version Runtime，不得复制、绕过或放宽另一套页面规则。

## 五、核心对象职责

本节定义 Phase 16.1 需要表达的对象职责。具体 TypeScript 字段在工程实现前冻结，字段命名应优先兼容现有 Contract。

### 1. QuestionSource

记录资源来源，例如：

- 人工录入；
- 合法导入；
- AI 辅助 Draft；
- OCR 辅助 Draft。

至少保留来源类型、来源说明、创建时间和必要的版权备注。

QuestionSource 只说明内容从哪里来，不代表内容已通过审核。

### 2. Material

保存阅读材料或任务共同依赖的内容载体。

同一 Material 可以关联多道独立任务，但 Material 与 Task 必须具有不同身份。

### 3. StructuredQuestionDraft

保存尚未成为正式资源的可编辑草稿，包括：

- Material 引用或内嵌 Draft；
- QuestionStem；
- questionType；
- ResponseFormat；
- 选项（仅适用于需要选项的题型）；
- AnswerAcceptance；
- Rubric；
- 最低作答要求；
- AbilityMetadata；
- taskRole；
- difficulty；
- 来源与版本起点；
- 最近一次 Validation 引用。

Draft 可以编辑、保存和恢复，但不能被正式学习 Runtime 消费。

### 4. AnswerAcceptance

只负责定义哪些答案形式可以被接受，例如：

- 标准化后的候选答案；
- 关键词覆盖；
- 受控语义等价；
- 标点、空白和大小写规范化。

AnswerAcceptance 不负责：

- 判断长期能力状态；
- 生成 Root Cause；
- 生成 Ability Evidence；
- 替代开放题 Rubric；
- 把匹配失败直接解释成能力薄弱。

开放题可以没有唯一参考答案，但必须具有明确 Rubric、最低作答要求和诊断边界。

### 5. Rubric

Rubric 定义本题如何观察学生表现。

每个 Rubric Item 应能够表达：

- 稳定 itemId；
- 观察目标；
- abilityId；
- 是否为关键项；
- 是否要求文本依据、解释或结论；
- 可接受的观察信号；
- 必要的说明。

Rubric 不得预写：

- “学生推理能力薄弱”；
- “学生一定缺少文本依据”；
- 固定 Root Cause；
- 长期 Profile 状态。

### 6. AbilityMetadata

至少表达：

- 稳定 `abilityId`；
- supportingAbilityIds（如适用）；
- prerequisiteAbilityIds（如适用）；
- taskRole；
- difficulty；
- 适用年级或范围（如当前需要）。

`abilityId`、`taskRole` 和受控难度值必须来自冻结 Registry 或枚举，工作台不得允许自由创建同义字符串。

### 7. ResourceValidationResult

保存一次完整校验结果，至少区分：

- errors：阻止提交审核；
- warnings：允许继续，但必须在审核时可见；
- passed；
- validatedDraftVersion；
- validationRuleVersion；
- checkedAt。

Validation Result 是校验事实，不是人工审核结论。

### 8. ResourceReviewDecision

保存明确的人工决策：

- approve；
- revision_required；
- reject。

至少记录审核对象版本、审核时间、审核意见和操作者标识。

单学生本地阶段允许录入者和审核者是同一人，但“编辑”和“审核决定”必须保持为两个明确动作和两条记录。

### 9. FrozenQuestionResource

表示已经通过校验和审核，可以被后续正式 Runtime 消费的不可变资源版本。

Frozen Resource 必须保留：

- resourceId；
- resourceVersionId；
- materialId；
- taskId；
- source；
- 正式内容快照；
- Metadata 与 Rubric 快照；
- Validation 与 Review 引用；
- frozenAt；
- 前后版本关系。

### 10. ResourceVersion

记录资源版本关系。

修改 Frozen Resource 时必须创建新 Draft 和新版本，不能覆盖旧版本。

旧版本只有在新版本正式冻结后，才可以被标记为 `superseded`；新 Draft 尚未冻结时，旧 Frozen Version 仍是当前可用正式版本。

### 11. ResourceRegistry

ResourceRegistry 是正式资源目录，不是新的事实数据库。

它为每个 `resourceId` 保存当前可消费资源的轻量索引，例如：

- currentFrozenVersionId；
- resource status；
- latestReviewId；
- latestValidationId；
- materialId；
- taskId；
- abilityId；
- taskRole；
- difficulty；
- tags；
- createdAt；
- updatedAt。

它的关系类似：

```text
Resource = Git Branch
ResourceVersion = Commit
currentFrozenVersionId = Branch Head
```

职责边界：

- Registry 只提供当前正式资源的查询入口；
- Registry 不创建资源事实；
- Registry 不重新执行 Validation 或 Review；
- Registry 不保存可编辑题目正文；
- Registry 只引用完整 Validation、Review 和 Frozen Version 记录；
- Version History 是正式历史事实，Registry 是可重建的查询投影；
- Phase 16.2 应从 Registry 查询当前资源，不必遍历所有历史 Version；
- 历史 Evidence 继续引用其产生时使用的原 `resourceVersionId`，不跟随 Registry Head 变化。

版本切换必须保持原子语义：

```text
Freeze v2 成功
-> v2 Frozen Snapshot 持久化成功
-> Registry Head 切换为 v2
-> v1 标记 superseded
```

如果 v2 Freeze 或 Registry Head 更新失败：

```text
Registry Head 仍为 v1
v1 继续作为唯一 Current Frozen Version
v2 不得被正式 TaskFulfillment 消费
```

Registry 至少需要：

- 同一 resourceId 最多一个 current Head；
- 重复更新保持幂等；
- Registry 与 Version History 一致性校验；
- 根据 Frozen Version History 重建 Registry；
- Head 切换失败时保持旧正式版本可用。

## 六、身份关系

Phase 16.1 必须稳定区分：

| 身份 | 含义 |
| --- | --- |
| `materialId` | 一份共同材料或内容载体 |
| `taskId` | 学生实际完成的一道独立任务 |
| `resourceId` | 资源跨版本的长期身份 |
| `resourceVersionId` | 某次冻结的具体版本 |
| `draftId` | 一份可编辑 Draft |
| `validationId` | 一次结构化校验 |
| `reviewId` | 一次人工审核决定 |
| `registryEntry` | 一个资源当前正式版本的轻量目录项 |

关系原则：

```text
一个 Material
-> 可以关联多个 Task

一个 Resource
-> 可以具有多个 Resource Version

一个 ResourceRegistry Entry
-> 只能指向一个 Current Frozen Version

一个 Frozen Resource Version
-> 只对应一个已审核内容快照
```

每道 Task 必须独立保存：

- taskId；
- target abilityId；
- taskRole；
- Rubric；
- AnswerAcceptance（如适用）；
- difficulty；
- QuestionStem；
- ResponseFormat。

同一材料不等于同一任务，同一资源的新版本也不能替换历史 Evidence 中保存的旧版本引用。

## 七、资源状态机

建议状态：

```text
drafted
validation_failed
pending_review
revision_required
reviewed
rejected
frozen
superseded
retired
```

合法主路径：

```text
drafted
-> validate
├─ failed
│  -> validation_failed
│  -> edit
│  -> drafted
└─ passed
   -> submit_review
   -> pending_review
   ├─ revision_required
   │  -> edit
   │  -> drafted
   ├─ rejected
   └─ reviewed
      -> freeze
      -> frozen
```

版本演进：

```text
frozen v1
-> create_new_version
-> drafted v2
-> validation / review
-> frozen v2
-> v1 superseded
```

Registry Head 只在 v2 完整 Freeze 成功后切换。v2 处于 drafted、validation_failed、pending_review、revision_required 或 reviewed 时，v1 仍是 Current Frozen Version。

退役路径：

```text
frozen / superseded
-> explicit retire decision
-> retired
```

非法状态转换必须阻断，例如：

- `drafted -> frozen`；
- `validation_failed -> pending_review`；
- `pending_review -> frozen`；
- `rejected -> frozen`；
- 直接编辑 `frozen`；
- 对同一 Draft 重复冻结并创建多个正式版本；
- 用过期 Validation 冻结已被修改的 Draft。

## 八、结构化校验规则

Validator 至少覆盖以下维度。

### 1. Identity Validation

- Draft、Material、Task 和 Resource 身份完整；
- 同一对象内身份一致；
- 新版本正确引用前一版本；
- 不允许重复正式身份。

### 2. Content Validation

- 题干非空；
- Material 要求与实际引用一致；
- 选择类任务具有合法选项；
- 非选择类任务不被迫提供无意义选项；
- ResponseFormat 与 questionType 一致；
- 最低作答要求可执行。

### 3. AnswerAcceptance Validation

- 需要明确接受边界的题目具有可执行规则；
- 规范化规则来自受控集合；
- 候选答案不能为空或互相冲突；
- 开放题不被误配置为单字符串严格匹配；
- AnswerAcceptance 不包含能力诊断结论。

### 4. Rubric Validation

- 至少存在一个有效观察项；
- Rubric Item 具有稳定身份；
- 关键项与评价目标一致；
- Rubric abilityId 与主要观察能力不冲突；
- Rubric 不包含固定学生结论；
- 开放题 Rubric 足以支持当前 AssessmentMode。

### 5. Ability and Role Validation

- abilityId 来自正式 Registry；
- taskRole 来自正式枚举；
- taskRole 与提示、评价目标及材料使用方式不冲突；
- difficulty 使用受控值；
- supporting / prerequisite 能力不替代 main ability。

### 6. Version and Review Eligibility

- 当前 Draft 内容版本与 Validation 版本一致；
- 所有 error 已解决后才能提交审核；
- reviewed 决策必须引用最近一次通过的 Validation；
- Freeze 必须消费同一 Draft Version 的 Validation 和 Review；
- Frozen Snapshot 与审核对象完全一致。

## 九、最小录入工作台要求

Phase 16.1B 必须提供一个无需修改工程代码即可使用的入口。

至少支持：

- 新建 Structured Question Draft；
- 保存和恢复 Draft；
- 新建 Material 或选择已有 Material；
- 录入题干、题型、选项与作答格式；
- 配置 AnswerAcceptance；
- 选择稳定 abilityId、taskRole 与 difficulty；
- 配置 Rubric 与最低作答要求；
- 查看 errors、warnings 和结构化校验结果；
- 提交人工审核；
- 执行通过、退回修改或拒绝；
- 将 reviewed Draft 冻结为正式资源；
- 基于已有 Frozen Resource 创建新版本；
- 查看版本历史和审核记录；
- 预览最终学生端题目形态；
- 预览审核者需要检查的完整资源结构。

建议工作区：

```text
Draft / Resource List
-> Question Editor
-> Validation Panel
-> Review Panel
-> Student Preview
-> Review Preview / Version History
```

第一版可以是内部 Demo 页面，不要求完整内容运营后台。

### 工作台交互底线

1. 校验失败时，提交审核动作必须阻断并显示明确 errors；
2. warnings 不静默隐藏，审核时必须可见；
3. 未 reviewed 的 Draft 不显示可执行 Freeze；
4. Frozen Resource 只能查看，编辑动作必须创建新版本；
5. 页面刷新后 Draft 可以恢复；
6. 重复点击审核或冻结保持幂等；
7. 输入变化后旧 Validation 自动失效；
8. 条件字段按题型显示，例如选项只在需要时出现；
9. Student Preview 尽量复用正式学生任务展示 Adapter；
10. 页面不得允许自由输入未注册 abilityId 或 taskRole；
11. 页面错误不能通过前端默认值伪造合法 Frozen Resource；
12. 工作台不展示或允许编辑固定 Diagnosis、Ability Evidence 或 Student Profile 结论；
13. Review Preview 必须展示 Rubric、AnswerAcceptance、AbilityMetadata、taskRole、difficulty、来源、Validation、Review 和 Version；
14. Student Preview 与 Review Preview 消费同一 Resource Version，不能出现内容或身份漂移。

### Student Preview

面向真实学习形态，只展示学生执行任务所需内容：

- Material；
- QuestionStem；
- Options（如适用）；
- ResponseFormat；
- 学生作答界面。

Student Preview 不展示：

- Rubric；
- AnswerAcceptance 内部规则；
- AbilityMetadata；
- Review Notes；
- Diagnosis 候选；
- 内部版本和 Runtime 字段。

### Review Preview

面向录入和审核过程，展示：

- Student Preview 的最终形态；
- Rubric；
- AnswerAcceptance；
- AbilityMetadata；
- taskRole；
- difficulty；
- QuestionSource；
- Validation Result；
- Review Decision；
- 当前 Resource Version 与历史版本关系；
- ResourceRegistry 当前 Head。

当前阶段使用 `Review Preview` 名称更准确，因为系统尚未建立正式教师角色和权限。未来增加教师角色后，可以在不改变底层结构的前提下使用 `Teacher Preview` 作为产品展示名称。

## 十、本地持久化边界

Phase 16.1 第一版不接正式数据库。

最小 Store 至少支持：

- 保存和读取 Draft；
- 保存 Material；
- 保存 Validation Result；
- 保存 Review Decision；
- 保存 Frozen Resource Version；
- 保存和查询 ResourceRegistry Entry；
- 按 resourceId 查询版本历史；
- 按 Registry 查询当前 Frozen Version；
- 防止重复 ID 和重复 Freeze；
- 校验或重建 Registry；
- 页面刷新后恢复。

Store 只负责保存和查询，不负责重新校验、自动审核或修改 Frozen Snapshot。

本阶段可以使用浏览器本地持久化或项目既有本地 Store 方式。正式数据库、账号权限和跨设备同步不属于 Phase 16.1。

## 十一、失败与防御分支

至少覆盖：

| 场景 | 预期处理 |
| --- | --- |
| 必填内容缺失 | validation_failed，不可提交审核 |
| abilityId 未注册 | validation_failed |
| Rubric 与主能力冲突 | validation_failed 或 review_required |
| AnswerAcceptance 与开放题模式冲突 | validation_failed |
| 选择题缺少选项 | validation_failed |
| Draft 修改后使用旧 Validation | 阻断提交审核或 Freeze |
| 审核退回后直接 Freeze | 阻断 |
| Frozen Resource 直接编辑 | 阻断并要求创建新版本 |
| 重复 Freeze | 返回同一结果或明确幂等结果，不创建第二版本 |
| 新版本审核未完成 | 旧 Frozen Version 继续有效 |
| v2 Freeze 或 Registry 更新失败 | Registry Head 保持 v1，v2 不进入正式消费 |
| Registry 与 Version History 不一致 | 阻断正式查询，执行一致性检查或受控重建 |
| Material 被修改 | 通过新 Material Version 或新 Resource Version 处理，不覆盖历史 |
| 页面刷新 | 恢复未完成 Draft 与正式记录 |
| 本地存储失败 | 明确错误，不伪造保存或 Freeze 成功 |
| AI Draft 字段完整 | 仍必须进入人工审核，不能自动 Frozen |

## 十二、16.1A Debug 验收

建议新增独立命令：

```text
pnpm run debug:question-resource-intake
```

具体脚本名称在工程实现时冻结，但必须可独立运行。

至少验证：

1. 合法 Draft 通过 Validation；
2. 缺失必填字段被阻断；
3. 非法 abilityId 和 taskRole 被阻断；
4. 选择题缺少选项被阻断；
5. 开放题误用严格单答案规则被阻断；
6. Rubric 与目标能力冲突被识别；
7. Validation error 阻止提交审核；
8. Review approve、revision_required 和 reject 三个分支成立；
9. 只有 reviewed Draft 可以 Freeze；
10. Frozen Snapshot 与被审核 Draft Version 一致；
11. Frozen Resource 不可修改；
12. 新版本不会覆盖旧版本；
13. 新版本冻结后旧版本进入 superseded；
14. 新版本未冻结时旧正式版本仍有效；
15. 重复 Freeze 保持幂等；
16. 过期 Validation 不可用于 Freeze；
17. 同一 Material 可以建立多个独立 Task；
18. 不同 Task 的 Rubric、AnswerAcceptance 和 difficulty 不会串联；
19. Draft、Review 和 Frozen Version 可从 Store 恢复；
20. AI-assisted Draft 不会自动进入 Frozen；
21. 完整版本切换期间始终保持唯一 Current Frozen Version：

```text
Create Draft v1
-> Review Approved
-> Freeze v1
-> Registry Head = v1
-> Create Draft v2
-> Revision Required
-> Registry Head 仍为 v1
-> Revise / Approve v2
-> Freeze v2
-> Registry Head 原子切换为 v2
-> v1 Superseded
```

Debug 21 必须同时断言：

- v2 未冻结前，正式资源查询只能返回 v1；
- v1 的历史引用始终有效；
- 任意时刻最多一个 Current Frozen Version；
- v2 Freeze 或 Head 切换失败时，v1 继续有效；
- 重复 Freeze v2 不创建额外 Version 或第二个 Head；
- Registry 可以从 Frozen Version History 重建并得到相同 Head。

## 十三、16.1B 工作台人工验收

工作台 Demo 至少使用以下真实录入 Case：

- 选择题；
- 判断题；
- 填空题；
- 开放简答题；
- 阅读理解题；
- 同一阅读 Material 下的两道不同能力或不同 taskRole 任务；
- 一道需要退回修改后再次审核的题目；
- 一道 Frozen 后创建新版本的题目。

人工验收通过条件：

1. 无需修改代码即可新建并保存 Draft；
2. 页面刷新后 Draft 仍存在；
3. 能够新建或复用 Material；
4. 不同题型只显示适用字段；
5. abilityId、taskRole 和 difficulty 只能从受控选项选择；
6. 能够配置 AnswerAcceptance、Rubric 和最低作答要求；
7. 校验错误和警告清晰可见；
8. 校验失败不能提交审核；
9. 能够执行通过、退回修改和拒绝；
10. 未审核 Draft 不能 Freeze；
11. reviewed Draft 可以形成唯一 Frozen Resource；
12. Frozen Resource 不可直接编辑；
13. 可以基于 Frozen Resource 创建新版本；
14. 新版本不会破坏旧版本和历史引用；
15. 能够查看来源、Validation、Review 和 Version 关系；
16. Student Preview 与正式任务展示结构一致；
17. Review Preview 能查看 Rubric、AnswerAcceptance、Metadata、来源、审核和版本；
18. 两种 Preview 引用同一 Resource Version；
19. 新版本审核期间，工作台明确显示旧版本仍是 Current Frozen Version；
20. 页面不能绕过 Runtime 制造非法正式资源；
21. Production Build 通过。

## 十四、验收数据规模

Phase 16.1 不以题量作为主要验收指标。

第一批建议至少形成：

- 5 种题型各 1 道审核 Case；
- 至少 1 份 Material 关联 2 道独立 Task；
- 至少 1 个 revision_required 流程；
- 至少 1 个 rejected 流程；
- 至少 1 个 Frozen 新版本流程；
- 至少 1 个 AI 或辅助生成 Draft，但仍经人工审核的流程。

所有 Case 应使用脱敏、来源清楚且允许用于当前产品验证的内容。

## 十五、阶段验收标准

Phase 16.1 PASS 必须同时满足：

### 16.1A Runtime PASS

- Schema、身份、状态机和版本关系稳定；
- Validation、Review、Freeze 与 Version 分工明确；
- ResourceRegistry 始终提供唯一 Current Frozen Version；
- Registry 可由 Version History 校验和重建；
- 非法状态转换被阻断；
- Frozen 不可变；
- 重复 Freeze 保持幂等；
- Store 可以保存和恢复正式记录；
- Debug Case 全部通过。

### 16.1B Workbench PASS

- 无需修改工程代码即可完成真实题目录入；
- 可以完成 Draft、Validation、Review、Freeze 和 Version 全流程；
- 页面规则与正式 Runtime 一致；
- Draft 可恢复；
- Frozen 可预览但不可直接编辑；
- Student Preview 与 Review Preview 均可使用且引用同一版本；
- 人工 Demo Case 全部通过；
- Production Build 通过。

只完成 Runtime 而没有可用录入入口，Phase 16.1 不通过。

只完成表单页面而没有正式状态机、校验、审核和冻结 Runtime，Phase 16.1 也不通过。

## 十六、本阶段不做

Phase 16.1 不做：

- 不建设大型题库；
- 不建设完整内容运营后台；
- 不做多人账号、角色和权限系统；
- 不做复杂审批流；
- 不做批量 OCR 工作流；
- 不让 AI 自动审核或冻结题目；
- 不做题目难度自动学习；
- 不做资源匹配质量评价；
- 不执行多日真实学习；
- 不生成 Student Profile 或长期成长结论；
- 不修改冻结的 Diagnosis、Evidence、Evaluation 和 Profile Contract。

## 十七、建议工程顺序

```text
冻结 Phase 16.1 文档
-> Resource Identity / Schema
-> Draft Store
-> Validator
-> Review Decision Runtime
-> Freeze / Version Runtime
-> 16.1A Debug
-> Minimum Intake Workbench
-> Student Preview Adapter
-> 16.1B Human Demo Acceptance
-> Regression / Production Build
-> Acceptance Record / Freeze
```

## 十八、阶段完成后的准确能力

Phase 16.1 完成后，系统可以宣称：

> 使用者无需修改工程代码，即可把真实题目录入为结构化 Draft，经过正式校验和人工审核，冻结为身份稳定、不可静默修改且可版本追溯的正式题目资源；ResourceRegistry 始终提供唯一当前正式版本，工作台同时支持 Student Preview 与 Review Preview。

系统仍不能宣称：

- 这些资源已经被证明适合每个学生；
- 资源匹配质量已经稳定；
- 题目难度已经经过真实数据校准；
- 题目已经证明教学有效；
- 已具备大规模题库运营能力。

下一阶段进入 Phase 16.2：Resource Metadata and Matching Quality。

## 十九、16.1A 工程结果（2026-07-17）

Phase 16.1A 已完成以下最小工程能力：

- 建立 Structured Question Draft、Validation、Review、Frozen Version 与 ResourceRegistry Schema；
- 建立资源准入 Agent，支持 Draft 创建与修订、结构化校验、人工审核、冻结和新版本创建；
- 建立内存 Repository，用于确定性 Debug；
- 建立 IndexedDB Repository，用于后续工作台的本地保存和恢复；
- ResourceRegistry 只在冻结提交成功后原子切换 Current Frozen Version；
- 新版本审核或冻结失败时，旧 Frozen Version 继续有效；
- 重复 Freeze 保持幂等，Frozen Snapshot 不允许静默修改；
- Registry 可根据 Frozen Version History 校验并重建。

验收命令：

```bash
pnpm run debug:question-resource-intake
```

验收结果：

```text
22 / 22 PASS
```

相关回归结果：

- `debug:task-resource-preparation`：PASS；
- `debug:phase8-4`：PASS；
- `debug:learning-persistence`：PASS；
- `debug:delayed-retest-scheduling`：13 / 13 PASS；
- `debug:phase14-integration`：16 / 16 PASS；
- `debug:phase15-integration`：11 / 11 PASS；
- Production Build：PASS。

当前结论：

> Phase 16.1A 资源准入 Runtime 已通过 Debug 验收，但 Phase 16.1 尚未完成。只有 16.1B 最小录入工作台完成并通过人工 Demo 验收后，才能将整个 Phase 16.1 标记为 PASS。

## 二十、16.1B 工程结果（2026-07-18）

Phase 16.1B 已完成最小题目录入工作台工程实现：

- 新增 `/question-resource-workbench` 内部工作台入口；
- 支持新建、保存和刷新恢复 Structured Question Draft；
- 支持创建 Material，并在题目 Draft 中引用已有 Material；
- 支持题干、题型、作答格式、AnswerAcceptance、稳定 abilityId、taskRole、difficulty、Rubric、最低作答要求和来源信息配置；
- 支持查看结构化 Validation errors / warnings；
- 支持提交人工审核，以及 approve、revision_required、reject 三个正式审核分支；
- rejected Draft 保持不可改写，并可基于原内容创建新的可编辑修订 Draft；原 Validation 与 Review 不会被继承；
- 支持 reviewed Draft Freeze，并保持 Frozen Snapshot 不可直接编辑；
- 支持从 Current Frozen Version 创建下一版本 Draft；
- 支持查看 ResourceRegistry 当前正式版本与版本历史；
- 支持 Student Preview 和 Review Preview；
- 工作台直接调用 Phase 16.1A Agent 与 Repository，不在页面中重建准入规则；
- 使用 IndexedDB 保存 Material、Draft、Validation、Review、Frozen Version 和 ResourceRegistry。

自动浏览器检查已经验证：

1. Material 可创建并被 Draft 引用；
2. Draft 可保存并形成稳定身份；
3. 合法 Draft 可通过 Validation；
4. Draft 可提交审核并执行 approve；
5. reviewed Draft 可 Freeze 为正式资源；
6. Student Preview 引用 Frozen Version 与 Material Snapshot；
7. 页面刷新后正式对象和未完成 Draft 均可恢复；
8. 创建 v2 Draft 时，Registry Head 仍保持 v1；
9. Review Preview 可查看 Identity、Metadata、AnswerAcceptance、Rubric、Validation 和 Review；
10. 1440px 桌面三栏与 1024px 平板双栏布局均无横向溢出。
11. rejected Draft 可创建修订 Draft，原拒绝记录保持不变，新 Draft 可重新进入校验和审核流程。

工程校验：

- `pnpm run debug:question-resource-intake`：22 / 22 PASS；
- Production Build：PASS；
- 现有非阻断提示：Vite 单一主包超过 500 kB，后续产品化阶段再进行路由级代码拆分。

当前结论：

> Phase 16.1B 工程实现已经完成，但仍需由使用者按照“十三、16.1B 工作台人工验收”完成真实录入与审核评审。人工 Demo 通过前，Phase 16.1 保持 IN PROGRESS，不提前标记为 PASS。
