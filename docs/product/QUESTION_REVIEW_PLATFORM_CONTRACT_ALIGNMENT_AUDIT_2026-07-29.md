# 题目审核平台契约对齐检查报告

日期：2026-07-29  
状态：P0 BATCH 2 IMPLEMENTED / P1-P2 PENDING  
范围：题目编辑、保存、检查、提交人工审核、人工决定、冻结发布与失败恢复

## 一、检查目标

本报告依据以下冻结契约，对题目审核平台的页面、API、领域 Agent、Repository 与专项 Debug 进行对齐检查：

1. `AUTHORING_FIELD_CONTRACT.md`；
2. `AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md`；
3. `QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md`；
4. `FORMAL_RESOURCE_PRODUCTION_CONTRACT_MAP.md`。

本次检查不新增业务规则，只回答：

> 当前审核平台是否真实遵守“编辑缓冲、单次 Revision、当前 Assessment、独立人工审核、幂等发布和可恢复正式化”的契约。

## 二、总体结论

当前审核平台约 **90% 对齐**。

| 检查链路 | 当前判断 |
|---|---|
| 编辑与保存 | PARTIAL |
| 保存与检查 | ALIGNED |
| Assessment 时效 | ALIGNED |
| 提交人工审核 | ALIGNED |
| 人工审核与发布职责拆分 | ALIGNED |
| 发布幂等与部分失败 | MOSTLY ALIGNED |

已经确认的能力：

- 页面具有独立编辑缓冲区、dirty 判断和离开保护；
- 正式字段修改会使页面中的旧质量结论立即进入 stale；
- Validation、QuestionQualityAssessment 和人工关注决定均具备 Revision 身份；
- 提交人工审核、记录人工决定和冻结发布已经拆成独立领域命令；
- `pending_review` 后内容进入只读审核；
- 基础 Freeze、Registry 切换、重复 Freeze 和共享存储冲突保护已经具备专项 Debug。

当前不能宣告“审核平台契约完全对齐”，剩余原因已经收敛为：

1. Observation Link 仍是 Freeze 后置写入，尚未进入同一原子提交；
2. 正式页面仍需补双标签页快速修改与重复命令的端到端回归；
3. P1 页面信息层级与 P2 旧路径清理尚未全部关闭。

## 三、P0 问题

### P0-1 正式审核平台未接入持久化 Quality Repository

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

### P0-2 保存与检查没有绑定显式 Revision

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

### P0-3 保存缺少领域层 no-op、幂等与乐观并发

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

### P0-4 Human Review 主身份未直接绑定 Assessment

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

## 四、P1 问题

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

### P1-3 共享存储冲突错误码回归失败

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

## 五、P2 清理项

1. 正式平台接入 persisted-quality 主链后，清理内存 Quality Repository 的生产入口；
2. 合并旧 `freezeQuestionResourceDraftWithQuality` 与 persisted-quality Freeze 的重复入口；
3. 删除页面、API 和 Agent 中已经不再消费的旧布尔状态与旧 Handler；
4. 增加审核平台级集成测试，避免继续用模块级 PASS 代替平台接入 PASS。

## 六、六条链路详细判断

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

## 七、Debug 证据

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

## 八、推荐修复顺序

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

当前准确状态应记录为：

> 题目审核平台的页面职责和基础生命周期已经大体对齐，但正式 Revision、Assessment 与 Publication 身份仍未完全汇合。P0 修复完成前，不应宣告审核平台契约完全落地。

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
