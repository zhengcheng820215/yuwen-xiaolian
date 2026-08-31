# P4 产品验收证据收口与 Debug 验收文档

英文名称：Product Documentation P4 Product Acceptance Evidence Closure Engineering and Debug Plan

文档类型：`IMPLEMENTATION_PLAN`

状态：`ACTIVE / DESIGN FROZEN / ENGINEERING READY`

日期：2026-08-31

当前状态来源：[当前产品状态](./CURRENT_PRODUCT_STATE.md)

上游契约：[产品主张与证据可追溯契约](./PRODUCT_CLAIM_EVIDENCE_TRACEABILITY_CONTRACT.md)

机器注册表：[`product-claim-evidence-registry.json`](./product-claim-evidence-registry.json)

## 一、阶段目标

P4 不继续扩展产品能力，而是对 P3 注册表中仍为 `productAcceptance.status = PENDING` 的主张补齐真实、限定范围、可复核的产品验收证据。

P4 建立以下闭环：

```text
待验收产品主张
→ 验收范围与前置身份冻结
→ 真实产品路径执行
→ 成功、失败与恢复证据
→ 独立签署
→ 注册表状态更新
```

P4 只回答“目标用户能否在约定范围内正确、连续、可理解地使用该能力”。它不以工程测试替代产品验收，不声明当前 Runtime 永久可用，也不从一次产品验收推断教育效果。

## 二、必须保持的边界

1. 不重建 `Material → Plan → Task → Candidate → Publish → Learning` 主链；
2. 不修改已经冻结的领域对象语义；
3. 不把历史工程 PASS、Fixture、Demo 或开发者自测升级为产品验收；
4. 不为了提高通过率批量覆盖 Frozen Resource；
5. 不把产品验收数据直接计入教育效果；
6. 不因一个场景 PASS 自动放行其他场景、设备或角色；
7. 不在静态文档中写死当前 LIVE，运行事实继续转交 `CURRENT_PRODUCT_STATE.md`；
8. 每个阶段都必须证明旧主链零回归，新语义只在 P4 允许的边界内生效。

## 三、证据层级与状态升级

### 3.1 可接受的产品验收证据

产品验收证据必须同时具备：

- 明确 `claimId`；
- 明确用户角色、设备、入口、正式资源和验收范围；
- 使用非 Fixture 的真实产品页面和真实交互；
- 记录当前 Commit、Runtime Identity、Formal Store Identity 与时间；
- 能复核操作步骤、观察结果和最终结论；
- 对涉及异步调用的链路记录超时、重试和失败恢复结果；
- 不在文档中暴露学生原始答案、Provider 凭证或完整模型输出。

真实学生并非所有产品验收的必要条件。面向学生体验、反馈理解、修订行动或负担感受的主张必须由目标年龄学生完成；面向内容生产操作者的主张应由对应操作者完成。开发者只能提供工程证据，不能代替目标角色签署体验结论。

### 3.2 不足以升级状态的证据

以下证据只能维持工程 PASS，不能把 `PENDING` 改为 `PASS`：

- 单元测试、集成测试或 Production Build；
- 隔离浏览器、受控答案或硬编码样例；
- 仅证明页面能打开，没有完成核心操作；
- 仅验证成功路径，没有验证失败恢复；
- 使用历史 Runtime、旧 Trial Binding 或身份不一致的 Session；
- 只有截图，没有范围、身份和结论；
- 一次自然作答被直接解释为能力提升。

### 3.3 状态更新规则

只有验收范围完全匹配时，才允许将注册表中的产品验收更新为：

```text
status = PASS
scope = 实际完成的限定范围
evidence = 独立验收报告
```

若只完成部分范围，应继续保持 `PENDING`，并在报告中记录已完成子范围。失败时不得删除历史工程证据；应建立 Finding，按“数据问题 / 内容问题 / 交互问题 / Runtime 问题 / 身份问题”归类。

## 四、P4 待验收主张与优先级

P3 注册表共有 9 项产品验收待收口。P4 按用户主链风险分为三组。

### 4.1 P0：学生核心连续学习链

| claimId | 当前范围 | P4 最小验收目标 |
| --- | --- | --- |
| `student_learning_interface` | 真实学生连续 5—6 题与恢复体验 | 从 `/learning` 开始，连续完成题组；正确进入下一题；中断后只恢复未完成位置；题组结束后正确收口 |
| `progressive_load_training` | 真实学生题组难度与连续完成体验 | 无无理由负担跳跃；学生能从较低负担任务进入文本任务；顺序例外有 TrainingTask Role 依据 |
| `open_response_input_load` | 真实学生开放文本作答负担 | 输入框、提示和题目责任匹配；不向学生展示内部长度带；不会因表达负担误判基础理解 |
| `real_learning_collection` | 真实学生自然作答采集完整性 | 一轮内事件链完整、顺序正确、身份一致；恢复、修订和结束事件不重复或丢失 |

这四项是 P4 首轮的准入核心。任一项存在阻断性问题时，不进入扩大 Trial。

### 4.2 P1：反馈、修订与针对训练链

| claimId | 当前范围 | P4 最小验收目标 |
| --- | --- | --- |
| `rubric_aligned_student_feedback` | 真实学生反馈理解与行动有效性 | 反馈基于正式 Diagnosis / Requirement Coverage；指出一个主要断点；不泄露标准答案；学生知道下一步做什么 |
| `feedback_guided_revision` | 真实学生理解反馈并完成一次修订 | 原回答保留；一次反馈对应一次修订；修订后评价不覆盖首次独立表现；可继续题组 |
| `targeted_micro_training` | 真实学生微训练匹配、完成与返回核心题组 | 仅对已确认的原子缺口触发；资源匹配；完成后回到原学习上下文；无资源时不死循环 |

### 4.3 P2：补充产品路径

| claimId | 当前范围 | P4 最小验收目标 |
| --- | --- | --- |
| `knowledge_practice_single_entry` | 真实学生统一入口与完整会话 | 核心阅读仍优先；知识练习角色清楚；进入、完成、返回和恢复不与正式阅读 Session 混淆 |
| `formal_resource_production` | 真实内容生产连续操作 | 操作者可在同一材料上下文生成、采用并发布；状态反馈一致；正式资源不被候选或失败操作静默覆盖 |

P2 组不阻断核心阅读小范围 Trial，但未通过前不得对外宣称对应能力已完成产品验收。

## 五、验收批次与执行顺序

### 5.1 Batch A：身份与入口预检

- `P4-A01` 当前 Commit 与工作树状态可记录；
- `P4-A02` Runtime Health 与 Runtime Identity 可读取；
- `P4-A03` Provider Health 满足反馈链要求；
- `P4-A04` Formal Store、Registry 与 Learning Consumer 身份一致；
- `P4-A05` 旧 Session 只在正式资源身份匹配时恢复；
- `P4-A06` Trial / Launch Binding 与当前 Runtime 对应。

Batch A 只证明本轮验收可开始，不等于产品主张通过。

### 5.2 Batch B：学生核心题组

- `P4-B01` `/learning` 展示可开始的核心材料；
- `P4-B02` 第一题负担与题组顺序符合规划；
- `P4-B03` 单选与文本作答分别使用正确交互和反馈责任；
- `P4-B04` 文本题不展示内部字数带或内部负担标签；
- `P4-B05` 提交后反馈内容可理解且与题目观察对象一致；
- `P4-B06` 下一题位置与“共 N 题”语义正确；
- `P4-B07` 连续完成 5—6 题不提前返回入口；
- `P4-B08` 题组完成后只出现正确结束动作；
- `P4-B09` 刷新或中断后恢复到唯一未完成位置；
- `P4-B10` 已完成题不重复写入或形成死循环。

### 5.3 Batch C：反馈、修订与微训练

- `P4-C01` 达标回答只反馈本次已经做到的具体内容；
- `P4-C02` 部分达标只选择一个当前最值得处理且可行动的主要断点；
- `P4-C03` “先补这一点”提供具体缺失项，不使用空泛兜底文案；
- `P4-C04` “下一步这样做”给思考动作，不给完整答案模板；
- `P4-C05` 学生可以基于反馈完成一次修订；
- `P4-C06` 修订完成后继续原题组，不跳回入口或重复原题；
- `P4-C07` 明确原子缺口时能够匹配 targeted excerpt；
- `P4-C08` 无匹配资源时安全回退到原题组，不阻断、不循环；
- `P4-C09` 微训练完成后保留来源关系并回到核心学习；
- `P4-C10` Retest / Transfer 不因任务角色不同而绕过重复价值判断。

### 5.4 Batch D：数据与恢复

- `P4-D01` `question_presented` 只在题目真正呈现时记录；
- `P4-D02` `answer_submitted` 与当前 Question Revision 身份一致；
- `P4-D03` `diagnosis_completed`、`feedback_presented` 顺序正确；
- `P4-D04` Initial Response 与 Revised Response 分离；
- `P4-D05` Session 恢复不复制 Attempt、Diagnosis 或 Evidence；
- `P4-D06` `learning_round_completed` 只在题组真正结束时记录；
- `P4-D07` 超时、Provider 失败或共享资源失败时保留可恢复状态；
- `P4-D08` 文档证据只保存脱敏身份和结论，不保存学生原文。

### 5.5 Batch E：补充路径

- `P4-E01` 知识练习不抢占核心阅读默认入口；
- `P4-E02` 知识练习完整 Session 与阅读 Session 身份隔离；
- `P4-E03` 工作台 Candidate 采用失败时现有任务不变；
- `P4-E04` 单题发布只改变目标题状态；
- `P4-E05` 已发布 Frozen Resource 不被重新生成静默覆盖；
- `P4-E06` 发布结果可以被 Learning Consumer 复读。

## 六、设备与角色矩阵

| 维度 | 首轮要求 |
| --- | --- |
| 学生设备 | PC 必测；Tablet 至少覆盖单选、文本输入、反馈、修订和下一题 |
| 操作者设备 | PC 必测 |
| 学生角色 | 目标年龄学生；不使用开发者代替反馈理解和负担体验签署 |
| 操作者角色 | 实际内容生产操作者或产品负责人 |
| 数据身份 | 内部测试与真实学生轮次分层；不得混写 |
| 网络 | 正常链路必测；反馈相关能力至少验证一次可恢复失败 |

若本轮缺少 Tablet 或目标学生，只能签署已经完成的子范围；不得把 PC 开发者结果扩写为完整产品验收。

## 七、Finding 与修复边界

P4 Finding 使用以下分类：

```text
IDENTITY_MISMATCH
RUNTIME_UNAVAILABLE
RESOURCE_NOT_CONSUMABLE
SESSION_CONTINUITY_BROKEN
INTERACTION_SEMANTICS_WRONG
FEEDBACK_ACTION_MISMATCH
CONTENT_QUALITY_GAP
EVENT_CHAIN_INCOMPLETE
RECOVERY_FAILED
```

处理优先级：

1. 身份、数据一致性、死循环、静默覆盖和无法恢复问题为 P0；
2. 错误反馈责任、错误下一步、题组提前结束和负担跳跃为 P1；
3. 文案、间距和非阻断展示问题为 P2。

发现问题后只允许窄范围修复。若修复改变长期产品语义，必须先回到对应 NORMATIVE 契约；不得在 P4 验收报告中临时创造新规则。

## 八、数据写入与隐私边界

P4 不以“绝对零 Learning 写入”为目标，因为真实产品验收必须执行真实产品动作。写入边界冻结为：

- 允许：经授权的测试 Session、Attempt、Diagnosis、Feedback、Revision、Evidence 和恢复记录；
- 条件允许：目标学生的限定真实 Trial 记录，必须具备 Trial Binding 与脱敏身份；
- 默认禁止：修改或替换 Frozen Resource、Formal Registry、Material Version 和已发布 Question Revision；
- 默认禁止：为通过测试人工改写 Attempt、Diagnosis、Evidence 或 Profile；
- 禁止：在文档、终端输出或截图中暴露 Provider Key、完整 Prompt、Raw Output 或学生原始答案。

内容生产验收若确需形成新正式资源，必须作为单独授权动作执行，并在验收报告中记录写入范围；不能与学生体验批次混在同一次操作中。

## 九、产品验收报告要求

每个通过的 `claimId` 必须拥有独立或明确分节的验收记录，至少包含：

```text
claimId
acceptanceScope
role / device
commit / runtimeIdentity / formalStoreIdentity
resourceIds / sessionIdDigest
executedCases
observedResult
findings
recoveryResult
productAcceptanceDecision
signedAt
```

允许一个真实场景为多个主张提供证据，但报告必须逐项说明该场景证明了什么，不能用“一轮学习顺利完成”替代全部主张的独立判断。

## 十、状态更新与回归

P4 完成某项主张后，按顺序执行：

1. 输出产品验收报告；
2. 更新 `product-claim-evidence-registry.json` 的 `status / scope / evidence`；
3. 执行 `npm run audit:product-doc-governance`；
4. 执行 `npm run audit:product-doc-semantics`；
5. 执行 `npm run audit:product-claim-evidence`；
6. 执行相关产品测试与 Production Build；
7. 更新 `CURRENT_PRODUCT_STATE.md` 时必须重新采样 Runtime，而不是复制验收结论。

产品验收 PASS 后，`live.status` 仍保持 `DEFER_TO_CURRENT_STATE`；教育效果仍保持 `PENDING_REAL_DATA` 或原状态。

## 十一、P4 完成定义

P4 总体完成不要求 9 项主张全部 PASS，但必须满足：

1. 9 项待验收主张全部获得明确决策：`PASS / 保持 PENDING / 降低默认暴露 / 退出本轮范围`；
2. 所有 PASS 都有匹配角色、范围和身份的产品验收证据；
3. P0 学生核心连续学习链不存在阻断性 Finding；
4. 失败和恢复路径已经实际执行；
5. 注册表、验收报告和当前状态没有跨层冲突；
6. 没有把产品验收解释为当前 LIVE 或教育效果；
7. P1、P2、P3 审计、相关测试和 Production Build 通过；
8. 未经授权的 Frozen Resource 与正式数据写入为 0；
9. 旧主链零回归，新验收状态只在证据支持的限定范围内生效。

完成后才能评估是否进入扩大真实 Trial；若 P0 核心链仍有阻断项，应继续窄范围修复，而不是扩大样本或继续增加功能。
