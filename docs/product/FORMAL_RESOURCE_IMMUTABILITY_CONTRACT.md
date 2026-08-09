# 正式资源不可变性契约

英文名称：Formal Resource Immutability Contract

状态：ACTIVE
文档版本：`formal_resource_immutability_contract_v1.0`
更新日期：2026-08-09

## 一、目标

本文冻结正式资源发布后的不可变边界、新版候选生成规则、活动版本切换规则和历史学习引用规则。

本文不重定义 Question Candidate、Draft Revision、Validation、Assessment、Human Review、Freeze、Registry 或 Learning Resource Provider 的既有契约；它只回答一个跨链路问题：正式资源发布后如何保持稳定，以及后续改进如何形成新版本。

## 二、核心不变量

```text
published = immutable
```

Formal Resource Version 一旦发布，以下正式内容永久不可原地修改：

1. 题干；
2. 学生任务；
3. 观察目标；
4. Rubric 与评分标准；
5. Answer Acceptance；
6. 能力、难度、材料依据和其他正式字段；
7. Frozen、Assessment、Human Review 和来源追溯身份。

禁止：

1. 在已发布卡片中直接编辑字段；
2. 保存修改并覆盖当前 Formal Resource Version；
3. 将已发布版本恢复成可变 Working Draft；
4. 修改正式版本后继续沿用原 Assessment 或 Human Review；
5. 以“重新发布”覆盖同一版本身份；
6. 因新版生成或发布失败而改写、撤销当前活动版本。

不可变性必须同时由 UI、应用服务、领域命令和 Repository 保证，不能只依赖隐藏按钮。

## 三、正式版本与活动 Registry

Formal Resource Version 保存不可变内容；Registry / Active Link 只负责指出当前供 Runtime 使用的正式版本。两者的可变性不同：

| 对象 | 是否可变 | 允许行为 |
| --- | --- | --- |
| Formal Resource Version | 否 | 只读、追溯、被历史 Session 引用 |
| Registry / Active Link | 受控可变 | 在新版本完整发布后原子切换活动版本 |
| Question Lineage | 稳定身份 | 关联同一题目的多个正式版本 |

Registry 切换不得修改旧 Formal Resource Version。V2 未完整写入 Formal Version、Quality Trace、Observation Link 和 Active Registry 前，V1 必须继续是活动资源。

## 四、新版候选主链

发现已发布题目需要调整时，不得编辑正式版本。唯一允许的正常入口是基于当前正式版本创建新的不可变 Question Candidate：

```text
Formal Resource V1
-> createOptimizationCandidateFromFormalVersion
-> Question Candidate（baseFormalVersionId = V1）
-> 人工判断
   -> 放弃或重新生成 Candidate
   -> 采用 Candidate
-> 新 Draft Revision
-> Validation / Assessment
-> Human Review Decision
-> Freeze
-> Formal Resource V2
-> Registry 原子切换至 V2
```

V2 与 V1 必须同时存在。发布 V2 是创建新正式版本，不是修改或重新发布 V1。

## 五、命令与身份

新版候选命令至少携带：

```ts
type CreateOptimizationCandidateFromFormalVersionRequest = {
  formalResourceId: string;
  baseFormalVersionId: string;
  generationCommandId: string;
};
```

返回 Candidate 至少包含：

```ts
type FormalResourceOptimizationCandidateIdentity = {
  candidateId: string;
  resourceLineageId: string;
  baseFormalVersionId: string;
  generationCommandId: string;
  createdAt: string;
};
```

该命令只创建 Candidate，不得：

1. 修改 V1；
2. 创建或覆盖 Formal Resource Version；
3. 切换 Registry；
4. 改变 Runtime 当前读取结果；
5. 创建 Human Review、Freeze 或发布成功事实。

同一 `generationCommandId + baseFormalVersionId` 的重复请求必须幂等复用同一候选结果，或返回可识别的既有命令结果。

## 六、采用与新版发布

采用新版 Candidate 后才允许在同一 Question Lineage 下创建新的 Draft Revision。该 Draft 属于 V2 生产链，不属于 V1，也不得让 V1 进入可编辑状态。

新版发布必须满足：

1. Candidate 明确绑定 `baseFormalVersionId`；
2. Adopt Decision 明确绑定 Candidate；
3. 新 Draft Revision 使用独立 `revisionId`；
4. Validation、Assessment 与 Human Review 全部绑定该 Revision；
5. Freeze 和 Formal Version 使用新的正式版本身份；
6. Registry 只在完整提交后切换；
7. 发布按钮和恢复文案使用“发布新版”，不使用“覆盖”“保存正式资源”或“重新发布”。

## 七、失败与恢复

新版生产任一阶段失败时：

1. V1 继续有效；
2. 已成功创建的 Candidate、Adopt Decision、Revision、Freeze 或 Formal Version 不回滚；
3. 重试从持久化 Checkpoint 继续，不重复创建正式身份；
4. Freeze 成功但 Registry 切换失败时，Runtime 仍读取 V1；
5. Registry 切换完成后才把 V2 显示为“已发布”；
6. 用户放弃新版 Candidate 不影响 V1。

## 八、学习与证据引用

学习 Session、作答、Diagnosis、Evidence、Rubric 结果和资源效果观察必须固定引用实际消费的 `formalVersionId`，不得只引用可变化的活动 Registry。

```text
Session A -> Formal Resource V1
Session B -> Formal Resource V2
```

V2 成为活动版本后，Session A 仍永久引用 V1。历史回放、诊断复核和资源效果比较不得把 V1 的学习事实迁移到 V2。

## 九、页面展示

已发布任务卡默认只读，首层只展示：

```text
状态：已发布
正式资源已冻结，当前学习使用此版本。

[查看正式资源] [生成新版方案]
```

其中“生成新版方案”为次要操作，不暗示当前正式版本无效。点击后进入独立 Candidate 判断区；V1 仍保持只读和活动状态。

已发布卡片不得显示：

1. 题目状态待确认；
2. 生成优化题目；
3. 修改字段或保存；
4. 替换当前版本；
5. 重新发布当前版本。

## 十、最低验收标准

1. 已发布卡片无法进入字段编辑态；
2. Repository 拒绝对既有 Formal Resource Version 的内容覆盖；
3. “生成新版方案”只新增绑定 V1 的 Candidate；
4. 放弃 Candidate 后 V1 与 Registry 均不变化；
5. 采用 Candidate 创建新 Revision，不改变 V1；
6. V2 发布失败时 Runtime 继续读取 V1；
7. V2 完整发布后 Registry 切换至 V2，V1 仍可追溯；
8. 历史 Session 继续引用其实际使用的正式版本；
9. 重复生成、采用或发布满足既有幂等规则；
10. 页面不再出现已发布与待确认同时成立的矛盾状态。

## 十一、不覆盖范围

本文不负责：

1. Candidate 内容生成 Prompt；
2. Draft 字段 Schema；
3. Assessment 具体规则；
4. Registry 的存储实现；
5. Runtime 选题策略；
6. 正式资源停用、归档和治理权限模型。

这些内容继续由各自既有契约负责，但不得违反本文的正式版本不可变原则。

## 十二、P2 工程落地与验收记录（2026-08-09）

1. `QuestionResourceCandidateAdoptionGateway` 已在采用新版候选前校验 `basedOnFormalResourceId`、`basedOnFormalVersionId` 与命令上下文一致。
2. 非幂等恢复请求必须确认候选绑定的 Formal Version 仍是 Active Registry Head；旧版本候选不得在 Registry 已切换后继续创建新版草稿。
3. 合法候选在同一 Question Lineage 下创建后继 Draft，版本号递增，`parentVersionId` 指向当前正式版本；采用本身不修改旧 Formal Version，也不切换 Registry。
4. 已完成 `runFormalResourceVersionUpgradeDebug.ts` 专项验收，共 `6 / 6 PASS`，覆盖当前版本采用、过期版本阻断、身份冲突、提交失败保留 V1、成功原子切换 V2 和重复采用幂等恢复。
5. 既有 Candidate Workbench P4 `14 / 14 PASS`、Candidate Workflow `11 / 11 PASS`、正式版本候选 P1 `4 / 4 PASS`、统一工作台 P7 `13 / 13 suites PASS`、颜色语义回归和 Production Build 均通过。

P2 完成后，当前工程满足：V2 完整提交前 V1 始终保持活动；V2 成功提交后 Registry 才切换，V1 作为可追溯历史版本保留。
