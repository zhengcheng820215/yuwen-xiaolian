# 题目审核平台契约对齐检查报告

首次审计日期：2026-07-29

当前快照：P0 CLOSED / P1 CLOSED / P2 OBSERVABILITY AND ATOMIC PUBLICATION CLOSED / REAL-MATERIAL CALIBRATION OPEN

范围：题目编辑、保存、检查、提交人工审核、人工决定、冻结发布与失败恢复

## 一、检查目标

本报告依据以下冻结契约，对题目审核平台的页面、API、领域 Agent、Repository 与专项 Debug 进行对齐检查：

1. `AUTHORING_FIELD_CONTRACT.md`；
2. `AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md`；
3. `QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md`；
4. `FORMAL_RESOURCE_PRODUCTION_CONTRACT_MAP.md`。

本次检查不新增业务规则，只回答：

> 当前审核平台是否真实遵守“编辑缓冲、单次 Revision、当前 Assessment、独立人工审核、幂等发布和可恢复正式化”的契约。

### 1.1 阅读约定

本文按时间分为三层：

1. “当前快照”只描述最新有效结论和仍未关闭事项；
2. “原始审计基线”保留首次检查时发现的问题、链路判断与修复顺序，用于追溯，不代表当前实现；
3. “修复记录”按批次记录已经落地的工程变化和验证证据。

判断当前状态时，应优先阅读“当前快照”和最后一批修复记录。原始基线与修复记录冲突时，以更新日期更晚的修复记录为准。

## 二、当前快照

当前审核平台的正式身份、命令、批次可观察性和原子发布主链已经对齐，整体处于 `REAL-MATERIAL CALIBRATION PENDING`。

| 当前链路 | 最新判断 |
|---|---|
| 编辑、保存与显式 Revision | ALIGNED |
| 保存与检查 | ALIGNED |
| Assessment 持久化与时效 | ALIGNED |
| 提交人工审核 | ALIGNED |
| Human Review 与完整 Quality Bundle 绑定 | ALIGNED |
| Frozen Version、Registry 与 Quality Trace | ALIGNED |
| Observation Link 原子性与发布恢复 | ALIGNED |
| 重复命令与双标签并发回归 | ALIGNED |
| 审核页信息层级 | ALIGNED |
| 正式页面视觉回归与旧路径清理 | ALIGNED |

已经确认的能力：

- 页面具有独立编辑缓冲区、dirty 判断和离开保护；
- 正式字段修改会使页面中的旧质量结论立即进入 stale；
- Validation、完整 Quality Bundle、Human Review 和 Frozen Trace 均具备明确 Revision 与规则身份；
- 提交人工审核、记录人工决定和冻结发布已经拆成独立领域命令；
- `pending_review` 后内容进入只读审核；
- 重复 Freeze、Registry 切换、共享存储冲突和 Human Review 不可变冲突已经具备专项 Debug。
- 提交审核与冻结发布共享 Plan / Task / Material 预检，不一致时在正式化前返回结构化中文错误；
- 新发布在同一共享存储事务中原子写入 Frozen Version、Registry、Quality Trace 与 Observation Link；
- 历史部分成功状态仍可通过恢复命令补齐关联，并复用既有 Frozen Version 与 Registry。
- 相同内容的保存重试会复用已提交 Revision，双标签页中的过期修改会返回 Revision Conflict；
- 重复检查、提交人工审核、记录人工决定和正式发布均复用当前有效结果；
- 审核页只突出当前状态、录入检查摘要和下一步动作，不再默认暴露内部规则版本与质量包枚举。

当前不能宣告真实素材校准完成，剩余原因已经收敛为：

1. 真实十素材尚未完成跨题型校准；
2. 校准前不得以当前少量样本推断生成质量已经稳定。

本文不再使用缺少计算口径的百分比表达对齐程度。后续状态只按 `ALIGNED / PARTIAL / PENDING` 和完成定义逐项更新。

## 三、原始审计基线：P0 问题

> 本章记录首次审计时的 P0 问题，均已由第十章和第十一章记录的两批修复关闭。以下“当前实现”和风险描述属于 2026-07-29 修复前基线，不代表最新代码状态。

### P0-1 正式审核平台未接入持久化 Quality Repository（已关闭）

**契约要求**

Assessment 必须跨刷新、重启和正式发布保持可追溯；Freeze 必须引用实际消费的质量结论。

**当前实现**

`src/api/questionResourceWorkbench.ts:55` 仍创建：

```ts
new InMemoryQuestionQualityAssessmentRepository()
```

页面读取、重新检查、提交审核、人工决定和 Freeze 全部消费这一内存 Repository：

- `src/api/questionResourceWorkbench.ts:169`
- `src/api/questionResourceWorkbench.ts:262`
- `src/api/questionResourceWorkbench.ts:272`
- `src/api/questionResourceWorkbench.ts:286`
- `src/api/questionResourceWorkbench.ts:300`

与此同时，17.5C2 已经提供正式能力：

- `LocalApiQuestionQualityPersistenceRepository`
- `persistQuestionQualityBundle`
- `freezeQuestionResourceDraftWithPersistedQuality`
- `FrozenQuestionQualityTrace`

但这些能力目前只在专项 Debug 和 Demo 中使用，没有进入正式 Workbench API。

**风险**

- 服务重启后 Assessment 重新生成，人工审核无法证明消费的是哪一份结果；
- 正式资源主链无法可靠追溯 deterministic / semantic / merge Rule Version；
- 模块级 17.5C2 PASS 会被误认为平台级已经接入。

**推荐修复**

1. Workbench 改用 `LocalApiQuestionQualityPersistenceRepository`；
2. 重新检查后持久化 deterministic、semantic 与 bundle；
3. 提交审核、人工决定和发布统一消费持久化的 current bundle；
4. Freeze 改用 `freezeQuestionResourceDraftWithPersistedQuality`；
5. 页面展示实际 Assessment / Bundle / Rule Version 身份。

**验收用例**

- 重启服务后同一 Draft 仍读取同一 Assessment；
- Freeze 后可由 Formal Resource 反查 Quality Trace；
- 删除内存状态不影响已保存审核事实；
- 缺失持久化 Bundle 时审核和发布均被阻断。

### P0-2 保存与检查没有绑定显式 Revision（已关闭）

**契约要求**

```text
saveQuestionDraft
→ savedRevisionId
→ runQuestionValidation(savedRevisionId)
→ runQuestionQualityAssessment(savedRevisionId)
```

**当前实现**

页面保存后调用 `validateQuestionResourceWorkbenchDraft(savedDraft.draftId)`：

- `src/pages/QuestionResourceWorkbench.jsx:422`
- `src/pages/QuestionResourceWorkbench.jsx:431`
- `src/pages/QuestionResourceWorkbench.jsx:444`
- `src/pages/QuestionResourceWorkbench.jsx:451`

API 和 Agent 再根据 `draftId` 读取当前最新 Draft：

- `src/api/questionResourceWorkbench.ts:259`
- `src/ai/agents/questionResourceAdmissionAgent.ts:259`

**风险**

多标签页、快速重复操作或并发写入时，保存的是 Revision N，实际检查的可能是后来出现的 Revision N+1。页面无法证明“本次保存”和“本次检查”是同一对象。

**推荐修复**

- 保存结果返回并要求后续命令携带 `draftId + expectedDraftRevision`；
- Validation 在执行前验证当前 Revision 等于 expected Revision；
- Assessment 只消费刚返回的 `validationId + assessedDraftRevision`；
- Revision 冲突返回结构化错误，不静默改查最新版本。

**验收用例**

- 保存 Revision 4 后并发写入 Revision 5，Revision 4 的检查命令必须返回冲突；
- 页面不得把 Revision 5 的结果展示成 Revision 4 保存动作的结果；
- 重试同一检查命令应幂等复用同一结果。

### P0-3 保存缺少领域层 no-op、幂等与乐观并发（已关闭）

**契约要求**

- 无变化保存不创建空 Revision；
- 同一内容重复点击只产生一个等价保存结果；
- 旧页面不得覆盖更新后的 Draft。

**当前实现**

页面通过 `hasUnsavedChanges` 禁用普通 no-op 保存，这是有效的 UX 保护：

- `src/pages/QuestionResourceWorkbench.jsx:178`
- `src/pages/QuestionResourceWorkbench.jsx:1923`

但 API 每次接到已有 `draftId` 都调用更新：

- `src/api/questionResourceWorkbench.ts:227`
- `src/api/questionResourceWorkbench.ts:246`

领域更新无内容比较、无 expected revision、无 idempotency key，固定执行：

- `src/ai/agents/questionResourceAdmissionAgent.ts:247`
- `src/ai/agents/questionResourceAdmissionAgent.ts:248`
- `src/ai/agents/questionResourceAdmissionAgent.ts:249`

**风险**

- 双击、重试、脚本调用或多标签页可创建空 Revision；
- 旧页面保存可能覆盖新页面已经保存的字段；
- UI 防护被绕过时，正式审计历史出现无意义 Revision。

**推荐修复**

在领域命令中增加：

```ts
{
  draftId,
  expectedBaseRevision,
  contentHash,
  idempotencyKey,
  patch
}
```

完全相同内容返回已有 Revision；基础 Revision 不一致返回 `QUESTION_DRAFT_REVISION_CONFLICT`。

**验收用例**

- 同一 payload 连续保存两次，Revision 只增加一次；
- 两个页面从 Revision 3 编辑，第二个保存必须得到冲突；
- 网络超时后重试同一 idempotency key 不生成新 Revision。

### P0-4 Human Review 主身份未直接绑定 Assessment（已关闭）

**契约要求**

人工审核决定必须绑定：

```text
Draft Revision
+ Validation ID
+ Assessment ID / Bundle ID
+ Rule Version
```

**当前实现**

Warning Decision 已绑定 `draftRevision + assessmentId + warningCode`：

- `src/ai/schemas/questionResourceAdmission.schema.ts:211`
- `src/ai/agents/questionQualityReviewGate.ts:215`

但 `ResourceReviewDecision` 主对象只保存：

- `reviewedDraftRevision`
- `validationId`

见 `src/ai/schemas/questionResourceAdmission.schema.ts:222`。

Freeze 的基础 current review 检查也只比较 Revision 与 Validation：

- `src/ai/agents/questionResourceAdmissionAgent.ts:862`
- `src/ai/agents/questionResourceAdmissionAgent.ts:870`

另外 `reviewQuestionResourceDraft` 发现相同 `reviewId` 时直接返回旧结果，发生在生命周期状态和新命令内容检查之前：

- `src/ai/agents/questionResourceAdmissionAgent.ts:367`
- `src/ai/agents/questionResourceAdmissionAgent.ts:368`
- `src/ai/agents/questionResourceAdmissionAgent.ts:369`

**风险**

- 同一 Revision 在规则升级或重新 Assessment 后，旧 approve 可能继续被基础 Freeze 接受；
- 相同 Revision 的不同审核 action、reviewer 或 notes 会被静默折叠为第一次结果；
- 正式资源 Schema 只引用 validationId / reviewId，无法独立证明审核对应的 Assessment。

**推荐修复**

1. `ResourceReviewDecision` 增加 `assessmentId` 或 `bundleId` 及规则版本；
2. 审核命令的幂等身份包含 Assessment 身份；
3. 相同 reviewId 但内容不同必须返回 immutable conflict；
4. Frozen Version 或正式 Quality Trace 必须记录最终消费的 Review + Assessment 完整身份；
5. 正式平台统一走 17.5C2 persisted-quality Freeze。

**验收用例**

- 同 Revision 更换 Rule Version 后，旧 Review 不得授权发布；
- 相同审核身份重复提交相同内容幂等；
- 相同审核身份提交不同 action 必须冲突；
- Formal Resource 可追溯到唯一 Assessment Bundle。

## 四、原始审计基线：P1 问题

> 本章保留首次审计时的 P1 发现。部分问题已在后续修复中关闭；仍未关闭的当前事项仅以第二章“当前快照”和第十二章“当前待办”为准。

### P1-1 Plan / Material 身份一致性检查发生得过晚

提交人工审核当前只消费 Draft、Validation 和内存 Assessment：

- `src/api/questionResourceWorkbench.ts:271`

Plan preflight 到 Freeze 才执行：

- `src/api/questionResourceWorkbench.ts:293`
- `src/api/questionResourceWorkbench.ts:294`

建议在提交人工审核前完成 Draft、Plan、Material 身份预检。发布前仍需再次复核，但不应让已知错位进入人工审核后才暴露。

### P1-2 发布后的 Observation Link 是非原子尾部动作

Freeze 成功后才创建 Observation Link，失败被转换成 `observationLinkIssues`：

- `src/api/questionResourceWorkbench.ts:300`
- `src/api/questionResourceWorkbench.ts:309`
- `src/api/questionResourceWorkbench.ts:316`

这不会污染 Frozen / Registry，但会形成“正式版本已存在、观察链未完成”的部分成功状态。页面需要明确提供“发布未完成，重试关联”，并复用已有 Frozen Version，不能让用户误以为全部失败。

### P1-3 共享存储冲突错误码回归失败（已关闭）

`debug:phase17-4a` 的 A10 当前失败：

```text
Expected FORMAL_RESOURCE_REVISION_CONFLICT
Received FORMAL_RESOURCE_IMMUTABLE_CONFLICT
```

底层阻断仍然存在，但结构化错误分类不稳定，会影响页面恢复建议、监控聚合和契约化验收。

### P1-4 部分关键运行错误文案存在乱码

例如：

- `src/ai/repositories/localApiFormalResourceClient.ts:70`
- `src/api/questionResourceWorkbench.ts:297`
- `src/ai/agents/questionResourceAdmissionAgent.ts:834`

结构化错误码可以保留机器可追踪性，但学生或审核人员仍需要可读中文。应统一源文件编码并增加错误文案回归。

## 五、原始审计基线：P2 清理项

1. 正式平台接入 persisted-quality 主链后，清理内存 Quality Repository 的生产入口；
2. 合并旧 `freezeQuestionResourceDraftWithQuality` 与 persisted-quality Freeze 的重复入口；
3. 删除页面、API 和 Agent 中已经不再消费的旧布尔状态与旧 Handler；
4. 增加审核平台级集成测试，避免继续用模块级 PASS 代替平台接入 PASS。

## 六、原始审计基线：六条链路详细判断

> 本章表格是首次审计快照。表中的 `FAIL` 和 `PARTIAL` 不应脱离第十章、第十一章的修复记录单独引用。

### 6.1 编辑与保存链路

| 检查项 | 结果 | 依据 |
|---|---|---|
| 字段编辑只修改页面缓冲区 | PASS | `QuestionResourceWorkbench.jsx:325` |
| 修改后标记 dirty | PASS | `QuestionResourceWorkbench.jsx:178` |
| 修改后页面旧 Assessment stale | PASS | `QuestionResourceWorkbench.jsx:325` |
| 离开与切换有未保存保护 | PASS | `QuestionResourceWorkbench.jsx:187`, `:268` |
| 无变化保存不创建 Revision | PARTIAL | UI 禁用；领域层未保证 |
| 多次点击、重试和并发只创建一个 Revision | FAIL | 无 idempotency / expected revision |

### 6.2 保存与检查链路

| 检查项 | 结果 |
|---|---|
| 保存与检查是两个独立调用 | PASS |
| 组合按钮先保存再检查 | PASS |
| 检查绑定保存返回的显式 Revision | FAIL |
| Validation 记录实际校验 Revision | PASS |
| Assessment 绑定 Validation 与 Revision | PASS |

### 6.3 Assessment 时效链路

| 检查项 | 结果 |
|---|---|
| 修改后 Revision 变化并清除 latest Validation / Review | PASS |
| stale_by_revision 可识别 | PASS |
| stale_by_rule_version 可识别 | PASS |
| Warning 接受绑定 Revision 与 Assessment | PASS |
| Assessment 跨重启持久化 | FAIL（底层已具备，平台未接入） |
| Human Review 主身份绑定 Assessment | FAIL |
| Frozen Resource 可追溯 Assessment | FAIL（底层 Trace 已具备，平台未接入） |

### 6.4 提交人工审核链路

| 检查项 | 结果 |
|---|---|
| 提交不修改题目字段 | PASS |
| 提交不创建 Revision | PASS |
| 当前 Validation 必须通过 | PASS |
| 当前 Assessment 必须存在 | PASS |
| 人工关注必须处理或接受 | PASS |
| Plan / Material 身份在提交前复核 | PARTIAL |

### 6.5 人工审核与发布链路

| 检查项 | 结果 |
|---|---|
| 提交审核独立 | PASS |
| 人工决定独立 | PASS |
| Freeze / Publish 独立 | PASS |
| `pending_review` 只读 | PASS |
| Review 绑定当前 Revision 与 Validation | PASS |
| Frozen 内容不可原地修改 | PASS |

### 6.6 发布幂等与部分失败

| 检查项 | 结果 |
|---|---|
| 重复 Freeze 复用同一版本 | PASS |
| Version 与 Registry 原子提交 | PASS |
| Registry 缺失可恢复 | PASS |
| Version + Registry + Quality Trace 原子提交 | FAIL（平台未接入） |
| Observation Link 部分失败可识别 | PARTIAL |
| 共享存储冲突错误码稳定 | FAIL |

## 七、原始审计基线：Debug 证据

本次实际执行：

| Debug | 结果 |
|---|---|
| `debug:question-resource-intake` | 24 / 24 PASS |
| `debug:phase17-5b` | 11 / 11 PASS |
| `debug:question-quality-revision-progress` | 18 / 18 PASS |
| `debug:phase17-5c2` | 17 / 17 PASS |
| `debug:phase17-4a` | 10 / 10 PASS |

原始审计合计已由 **79 / 80 PASS** 修复为 **80 / 80 PASS**。

解释边界：

- 这些结果证明各底层模块大部分行为稳定；
- 它们不能证明正式 Workbench 已经接入 17.5C2；
- A10 的结构化错误码回归已修复，共享存储专项恢复全绿。

## 八、历史执行顺序

> 第一批和第二批 P0 已完成；第三批 P1 与第四批 P2 仍作为后续收口顺序。

### 第一批 P0：统一正式身份

```text
Workbench 接入持久化 Quality Repository
→ Review 绑定 Assessment Bundle
→ Freeze 写入正式 Quality Trace
```

### 第二批 P0：冻结 Revision Command

```text
保存返回显式 Revision
→ 检查消费 expected Revision
→ no-op / idempotency / optimistic concurrency
```

### 第三批 P1：收紧提交与恢复

```text
提交前 Plan / Material 预检
→ Observation Link 部分成功状态
→ 结构化错误码和中文文案校准
```

### 第四批 P2：清理旧路径

```text
移除生产环境内存 Quality Repository
→ 删除重复 Freeze / Handler
→ 增加 Workbench 端到端契约回归
```

## 九、完成定义

审核平台只有同时满足以下条件，才可改为 `CONTRACT ALIGNED`：

1. 保存、检查、审核和发布均消费显式 Revision 身份；
2. 无变化、重复点击和并发保存不会产生错误 Revision；
3. 当前 Assessment 持久化并与 Human Review 直接绑定；
4. Frozen Resource 可追溯实际消费的完整 Quality Bundle；
5. 发布重试复用同一 Version、Registry 与 Quality Trace；
6. Plan / Material 身份错位在提交审核前暴露；
7. 审核平台级专项 Debug 全部通过；
8. 共享存储 A10 错误码回归恢复 PASS。

首次审计时的结论是：

> 题目审核平台的页面职责和基础生命周期已经大体对齐，但正式 Revision、Assessment 与 Publication 身份仍未完全汇合。P0 修复完成前，不应宣告审核平台契约完全落地。

该结论已被第十章和第十一章的 P0 修复记录更新。当前结论以第二章“当前快照”为准。

## 十、P0 第一批修复记录

完成日期：2026-07-29

本批次完成：

1. 正式审核工作台移除 `InMemoryQuestionQualityAssessmentRepository`，改用 `LocalApiQuestionQualityPersistenceRepository`；
2. 确定性 `QuestionQualityAssessment` 通过 Shared Store 保存、读取和按 Draft Revision 查询；
3. Draft 保存支持 `expectedRevision`，过期页面写入返回 `QUESTION_DRAFT_REVISION_CONFLICT`；
4. 无字段变化的重复保存直接复用当前 Draft，不再创建空 Revision；
5. Validation 显式消费预期 Revision；
6. 页面保存、检查、提交审核、人工决定和冻结命令均传递当前 Draft Revision。

新增或更新的验证：

| Debug | 结果 |
|---|---|
| `debug:question-resource-intake` | 26 / 26 PASS |
| `debug:phase17-5b` | 11 / 11 PASS |
| `debug:phase17-5c2` | 18 / 18 PASS |
| Production Build | PASS |

本批次关闭：

- P0-1 中“Workbench 的确定性 Assessment 存在内存孤岛”；
- P0-2 中“保存、检查隐式读取最新 Revision”的主要页面入口；
- 重复保存产生空 Revision；
- 过期页面继续保存或检查而不报冲突。

仍未关闭：

1. Workbench 尚未把独立语义评估和 `QuestionQualityAssessmentBundle` 接入正式检查主链；
2. Human Review Decision 尚未直接引用完整 Assessment Bundle；
3. Freeze 尚未改用带 `FrozenQuestionQualityTrace` 的原子提交主链；
4. Observation Link 仍是 Freeze 后置写入；
5. 仍需增加双标签页和正式页面端到端契约回归。

因此本次修复完成后，准确状态是：

> 审核平台已经建立可持久化的确定性质量评估入口和显式 Revision 防护，但完整质量 Bundle、人工审核证据和 Frozen Trace 尚未汇合，不能标记为 `CONTRACT ALIGNED`。

## 十一、P0 第二批修复记录

完成日期：2026-07-29

本批次完成：

1. Workbench 正式检查主链接入独立语义评估，确定性 Assessment、语义 Assessment 与合并 Bundle 均写入 Shared Store；
2. 当前质量事实严格绑定 Draft Revision、Validation、Deterministic Rule、Semantic Prompt / Rule / Schema 与 Merge Rule；
3. Provider 失败形成可保存的 `semantic_unavailable` Bundle，不伪造通过；人工可以退回修改，但审核通过和 Freeze 被阻断；
4. Human Review Decision 直接记录 Bundle、确定性 Assessment、语义 Assessment 与 Merge Rule 身份；
5. Freeze 改用 Version、Registry 与 `FrozenQuestionQualityTrace` 的原子提交主链，并验证当前 Human Review 确实绑定当前 Bundle；
6. 相同 Human Review 命令幂等复用，身份相同但内容不同的重试以 `QUESTION_REVIEW_IMMUTABLE_CONFLICT` 阻断；
7. 审核页显示当前 Revision 的确定性检查、独立语义评估和质量包状态；缺少完整 Bundle 时不能提交审核。

验证结果：

| Debug | 结果 |
|---|---|
| `debug:phase17-5c1` | 18 / 18 PASS |
| `debug:phase17-5c2` | 22 / 22 PASS |
| `debug:phase17-5b` | 11 / 11 PASS |
| `debug:material-observation` | 27 / 27 PASS |
| `debug:question-resource-intake` | 26 / 26 PASS |
| `debug:structured-runtime-errors` | 8 / 8 PASS |
| Production Build | PASS |

本批次关闭：

- Workbench 完整质量 Bundle 的正式接入；
- Human Review 与 Assessment Bundle 的身份绑定；
- Frozen Resource 与质量证据的原子追溯；
- 语义服务失败时的受控降级边界；
- Human Review 重试的幂等与不可变冲突保护。

仍未关闭：

1. Observation Link 纳入 Freeze 原子提交；
2. 双标签页和正式页面端到端契约回归；
3. P1 信息层级收敛与 P2 旧 handler、旧状态和重复提示清理。

因此 P0 第二批完成后的准确状态是：

> 审核平台的 Revision、完整质量 Bundle、Human Review 与 Frozen Trace 已形成同一条可持久化、可追溯的正式主链；P0 核心身份污染风险已经关闭，但发布附属关系原子性和真实并发页面回归仍待后续加固。

## 十二、当前待办

本节是完成 P1 命令与信息层级批次后的唯一当前待办列表。

### 12.1 P1

1. 在无旧 Vite 缓存的浏览器会话中补正式页面视觉回归，确认状态、录入检查摘要和下一步动作无布局回退；
2. 评估是否把 Observation Link 纳入同一原子提交；在此之前继续使用已冻结的部分成功与幂等恢复语义。

### 12.2 P2

1. 已删除生产目录中的内存 Quality Repository，并将测试替身收口到测试支持目录；
2. 已删除正式题目工作台无契约依据的全局清空入口和 Handler；
3. 已完成正式调用链核对：低层 Freeze / Review / Submit 仍被材料生产、历史兼容与集成演示消费，不作为死代码删除；
4. 仍需结合正式页面浏览器证据继续校准重复提示；不得删除仍被保存、检查和问题定位共同消费的质量修复进度状态。

### 12.3 升级为 `CONTRACT ALIGNED` 的条件

只有第九章完成定义全部满足、上述 P1/P2 待办关闭，并形成正式页面端到端证据后，本文状态才可由 `P1-P2 OPEN` 更新为 `CONTRACT ALIGNED`。

## 十三、P1 第一批修复记录

完成日期：2026-07-30

本批次完成：

1. 提交题目审核、首次冻结发布和发布恢复统一消费同一份发布预检，不再由三个入口分别判断；
2. 发布预检显式确认训练计划存在且已审核、训练任务存在、题目绑定材料真实存在，并且 Plan、Task 与 Draft 的材料版本一致；
3. 能力目标、难度和任务用途继续以当前训练任务为唯一受控来源，存在差异时在提交人工审核前阻断；
4. 新增结构化错误码 `PUBLICATION_PREFLIGHT_FAILED` 与 `PUBLICATION_RECOVERY_REQUIRED`，并提供可执行的中文恢复说明；
5. Observation Link 后置写入失败时返回 `partially_completed`，保留已经生成的 Frozen Version 与 Registry；
6. 新增独立恢复命令，只补齐 Registry / Observation Link，不重新 Freeze，也不创建新的正式版本；
7. 审核页面在已存在 Frozen Version 时将发布动作切换为“重试补齐发布关联”，避免用户误以为会再次发布题目。

新增验证：

| Debug | 结果 |
|---|---|
| `debug:question-publication-recovery`：既有 Frozen Version 补齐关联 | PASS |
| `debug:question-publication-recovery`：关联写入失败形成部分成功 | PASS |
| `debug:question-publication-recovery`：连续重试不重复 Version / Registry / Link | PASS |
| `debug:structured-runtime-errors` | 8 / 8 PASS |
| `debug:phase17-4a` | 10 / 10 PASS |
| Production Build | PASS |
| `git diff --check` | PASS |

本批次关闭：

- 提交人工审核前缺少 Plan / Task / Material 身份复核；
- Observation Link 写入失败后页面无法区分“完全失败”与“正式版本已生成”；
- 发布恢复可能让用户误触发新正式版本；
- 发布预检与恢复错误缺少稳定错误码和可执行中文文案。

仍未关闭：

1. Observation Link 与 Frozen Version 尚未形成同一原子事务；
2. 双标签页、快速重复命令和真实页面恢复操作仍需端到端浏览器回归；
3. 审核页信息层级收敛与 P2 旧 Handler、旧状态清理。

因此 P1 第一批完成后的准确状态是：

> 发布前身份错位已经前置暴露，正式版本生成后的 Observation Link 失败也已可识别、可重试且不会产生重复版本。当前主链具备明确恢复语义，但在原子性和正式页面并发回归完成前，仍不能标记为 `CONTRACT ALIGNED`。

## 十四、P1 命令与信息层级批次修复记录

完成日期：2026-07-30

本批次完成：

1. 相同内容的保存重试在 Revision Conflict 判断前执行幂等匹配，网络重试不会再次创建 Revision；
2. 双标签页继续使用 `expectedRevision` 保护，过期标签的不同修改会被拒绝，不覆盖已经提交的内容；
3. 当前 Draft 已处于 `pending_review` 且检查仍有效时，重复提交人工审核直接复用现有状态；
4. 重复检查复用 Validation，重复人工决定复用 Review，重复发布复用 Frozen Version 与 Registry；
5. 非审核阶段页签统一为“提交前检查 / 学生预览 / 检查记录”；
6. 审核摘要隐藏内部规则版本和质量包枚举，只显示当前版本检查是否有效、语义复核状态；
7. 当前状态旁固定展示唯一下一步动作，减少用户在保存、检查、审核和发布之间猜测。

新增验证：

| Debug | 结果 |
|---|---|
| `debug:question-workbench-command-e2e`：重复保存只产生一个 Revision | PASS |
| `debug:question-workbench-command-e2e`：双标签过期修改被拒绝 | PASS |
| `debug:question-workbench-command-e2e`：重复检查复用一个 Validation | PASS |
| `debug:question-workbench-command-e2e`：重复提交不重复转换状态 | PASS |
| `debug:question-workbench-command-e2e`：重复审核复用一个决定 | PASS |
| `debug:question-workbench-command-e2e`：重复发布复用一个 Version / Registry | PASS |
| `debug:phase17-5b` | 11 / 11 PASS |
| `debug:question-publication-recovery` | 3 / 3 PASS |
| Production Build | PASS |
| `git diff --check` | PASS |

浏览器证据说明：

- 原 `5174` 会话仍缓存修复前的 Vite 页面，并出现 `__DEFINES__ is not defined`，页面根节点为空；
- 已使用项目要求的 Node 运行时重启开发服务，服务入口响应与生产构建均正常；
- 由于应用内浏览器会话没有成功丢弃旧页面缓存，本批次不把视觉浏览器验收标记为完成；
- 下一批浏览器验收应从新标签或清空旧页面缓存后进入正式工作台，补充状态摘要、页签和下一步动作的截图证据。

仍未关闭：

1. Observation Link 与 Frozen Version 尚未形成同一原子事务；
2. 正式页面视觉回归仍缺少无旧缓存会话的证据；
3. P2 旧 Handler、旧状态与重复提示清理。

因此本批次完成后的准确状态是：

> 重复命令、双标签并发保护和审核页信息层级已经形成可执行、可回归的统一语义。当前不会因网络重试或重复点击制造额外 Revision、Validation、Review 或 Frozen Version；原子 Observation Link、视觉浏览器证据和 P2 清理仍保持开放。

## 十五、P2 第一批旧路径清理记录

完成日期：2026-07-30

本批次完成：

1. `InMemoryQuestionQualityAssessmentRepository` 从生产 Repository 目录迁入 `src/ai/tests/support`，正式运行时只保留 `LocalApiQuestionQualityPersistenceRepository`；
2. 三条质量专项 Debug 改用测试目录中的内存替身，测试隔离能力不受影响；
3. 删除题目工作台“清除本地 Demo 数据”入口、页面 Handler 与 API Handler，避免绕过单题删除、归档和审计保留规则；
4. 对 Submit、Review、Freeze 的低层路径完成调用链审计：它们仍被材料生产服务、历史兼容链路和集成演示消费，当前保留；
5. 对 `qualityRevisionProgress` 完成消费审计：该状态仍同时服务保存、修改后失效、逐项修复和定位修改，不属于废弃布尔状态。

回归结果：

| Debug | 结果 |
|---|---|
| `debug:question-workbench-command-e2e` | 6 / 6 PASS |
| `debug:phase17-5b` | 11 / 11 PASS |
| `debug:phase17-5c2` | 22 / 22 PASS |
| `debug:question-publication-recovery` | 3 / 3 PASS |
| `debug:question-resource-intake` | 26 / 26 PASS |
| `debug:question-quality-revision-progress` | 18 / 18 PASS |
| `debug:structured-runtime-errors` | 8 / 8 PASS |
| `debug:material-observation` | 27 / 27 PASS |
| `debug:phase17-4a` | 10 / 10 PASS |
| Production Build | PASS |
| `git diff --check` | PASS |

边界说明：

- 本批次只删除“无正式入口且无契约职责”的路径；
- 不以文件名或历史命名为依据误删仍有生产调用方的兼容服务；
- 重复提示的进一步收敛必须以正式页面视觉回归为证据，不能只凭静态搜索删除。

仍未关闭：

1. Observation Link 与 Frozen Version 尚未形成同一原子事务；
2. 正式页面视觉回归仍缺少无旧缓存浏览器会话的截图证据；
3. 真实十素材校准仍待执行。

因此本批次完成后的准确状态是：

> 生产质量仓库与测试替身的边界已经清楚，正式页面也不再提供绕过审计规则的全局清空操作。P2 第一批旧路径清理完成，但原子 Observation Link、正式页面视觉证据和真实素材校准仍保持开放。

## 十六、P2 正式页面浏览器验收记录

完成日期：2026-07-30

本批次使用全新应用内浏览器标签，从素材资源录入平台载入 Batch A，并沿正式入口进入题目审核与发布平台。验收覆盖：

1. 素材页能展示当前素材、待审核资源、发布未完成和已发布练习，并展开待审核资源明细；
2. 点击待审核题目后能定位到对应 `draftId`，审核页右侧批次导航保持当前题目选中；
3. 内容审核页以只读方式展示题目、训练目标、作答要求、评分规则和关联材料；
4. 学生预览能展示学生实际读取的材料、题目和禁用作答区；
5. 审核记录能展示当前 Revision、状态、检查状态和人工审核决定；
6. 返回素材资源录入平台时保留 `materialVersionId` 与 `planId`，并准确恢复原素材上下文；
7. 浏览器控制台无运行时错误。

验收过程中发现并修复一处状态表达矛盾：

- 原页面在缺少当前 Revision 完整质量包时，同时显示“录入检查已完成”和“尚未形成当前修订版的完整质量包”；
- 现在只有当前 Revision 存在完整质量包时才显示“录入检查已完成”；
- 缺少完整质量包时显示“录入检查待补全”，且局部统计明确标记为“自动检查”，不再伪装成完整录入结论；
- 审核提交仍继续以完整质量包为门槛，页面文案和底层判定保持一致。

回归结果：

| 验收项 | 结果 |
|---|---|
| 素材页进入待审核题目 | PASS |
| 内容审核页布局与只读语义 | PASS |
| 学生预览页签 | PASS |
| 审核记录页签 | PASS |
| 返回素材上下文恢复 | PASS |
| 浏览器控制台 | PASS，无 error |
| `debug:phase17-5b` | 11 / 11 PASS |
| Production Build | PASS |

仍未关闭：

1. Observation Link 与 Frozen Version 尚未形成同一原子事务；
2. 批量审核效率和生产可观测性仍待专项验收；
3. 真实十素材校准仍待执行。

因此 P2 第一项完成后的准确状态是：

> 正式页面已获得无旧缓存浏览器会话的视觉与交互证据，内容审核、学生预览、审核记录及返回素材定位均可用；审核摘要不会再把局部检查误报为完整录入检查。P2 第一项关闭，后续进入批量效率、Observation Link 原子性与真实十素材校准。

## 十七、P2 第二项批次效率与可观察性记录

完成日期：2026-07-30

本批次不新增审核入口，只为既有审核链补齐统一统计口径和生产可观察性。

工程实现：

1. 新增批次可观察性领域汇总器，统一输出阻断、提醒、待复检、重复修改和各状态题目数量；
2. 质量问题进度记录 `firstSeenAt`、`lastModifiedAt`、`lastRecheckedAt` 和 `resolvedAt`；
3. 审核提交记录提交时间与次数，退回修改记录退回时间与次数；
4. 统一计算阻断率、提醒人工接受率、平均审核耗时、平均发布耗时和平均问题关闭耗时；
5. 审核页增加“批次处理概览”，页面不再自行拼装指标；
6. 缺少明确历史时间戳时返回 `null` 并显示“暂无数据”，不使用通用更新时间推断业务耗时。

指标口径：

| 指标 | 口径 |
|---|---|
| 阻断率 | 当前存在阻断问题的 Draft 数 / 批次 Draft 总数 |
| 提醒人工接受率 | 已接受提醒数 / 已形成决定的提醒总数 |
| 重复修改 | 问题重新检查次数累计 |
| 平均审核耗时 | `reviewSubmittedAt` 到 `review.reviewedAt` |
| 平均发布耗时 | `review.reviewedAt` 到 `frozenVersion.frozenAt` |
| 平均问题关闭耗时 | `firstSeenAt` 到 `resolvedAt` |

自动化回归：

| 验收项 | 结果 |
|---|---|
| `debug:question-review-batch-observability` | 11 / 11 PASS |
| `debug:question-quality-revision-progress` | 18 / 18 PASS |
| `debug:question-resource-intake` | 26 / 26 PASS |
| `debug:question-workbench-command-e2e` | 6 / 6 PASS |
| `debug:phase17-5b` | 11 / 11 PASS |
| Production Build | PASS |

浏览器验收：

1. 真实三题批次正确显示 `3` 个题目、`1` 个待处理、`2` 个已发布；
2. 批次处理概览正确展示四类问题计数和四项效率指标；
3. 旧记录缺少时间戳时显示“暂无数据”，已有发布时间差显示 `0 分钟`；
4. 桌面宽度和 `390px` 移动端均无横向溢出；
5. 重启有效开发服务后，页面没有新增运行时错误。

仍未关闭：

1. Observation Link 与 Frozen Version 尚未形成同一原子事务；
2. 真实十素材校准仍待执行。

因此 P2 第二项完成后的准确状态是：

> 批次审核已经具备统一的问题扫描、重复修改和时效指标，旧历史数据不会被伪造补齐；桌面与移动端均已形成真实页面证据。P2 批次效率与可观察性关闭，后续进入 Observation Link 原子性与真实十素材校准。

## 十八、P2 第三项原子发布记录

完成日期：2026-07-30

本批次将 Observation Link 从 Freeze 后置动作纳入正式发布原子边界。新发布现在按以下顺序先准备、后一次提交：

```text
校验当前 Draft / Plan / Task / Material / Assessment / Human Review
→ 准备 Frozen Version
→ 准备 Registry
→ 准备 Frozen Quality Trace
→ 准备 Observation Link
→ 通过共享存储 CAS 一次写入四个对象
```

工程规则：

1. 任一准备检查失败时，不写入任何正式对象；
2. CAS 持久化失败时，不留下 Version、Registry、Quality Trace 或 Observation Link；
3. 同一发布命令重试复用同一组正式身份；
4. 四个对象已经存在且一致时返回幂等成功，不增加共享存储 Revision；
5. 旧系统遗留的部分成功状态继续由发布恢复命令兼容，但新主链不再创建此类状态；
6. 生命周期时间戳和提交次数不再被误判为题目教育内容变化。

自动化证据：

| 验收项 | 结果 |
|---|---|
| `debug:phase17-5c2`：质量持久化、四对象原子提交与故障重试 | 24 / 24 PASS |
| `debug:question-publication-recovery`：历史部分状态恢复 | 3 / 3 PASS |
| `debug:question-workbench-command-e2e`：正式命令主链 | 6 / 6 PASS |
| Production Build | PASS |

故障注入确认：

1. 发布失败后四类正式对象数量均为 `0`；
2. 首次重试只生成一组 Version、Registry、Quality Trace 与 Observation Link；
3. 完成后再次重试不增加共享存储 Revision；
4. 既有历史恢复语义和 Workbench Command E2E 未回退。

P2 第三项完成后的准确状态是：

> 新发布不再存在“正式版本已生成但 Observation Link 尚未写入”的窗口；正式版本、注册指向、冻结质量证据和观察关系共享同一原子提交与幂等身份。P2 第三项关闭，下一步进入真实十素材校准。
