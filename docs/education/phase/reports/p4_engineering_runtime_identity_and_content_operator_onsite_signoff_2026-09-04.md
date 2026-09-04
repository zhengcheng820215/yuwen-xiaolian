# P4 工程、运行身份与内容生产操作者范围现场签署记录

日期：2026-09-04

时区：`Asia/Shanghai`

执行类型：本地正式构建、真实产品页面、限定范围现场签署

文档状态：`ENGINEERING PASS / RUNTIME IDENTITY PASS / CONTENT OPERATOR SCOPE PASS`

## 1. 签署结论

本次完成以下三个可独立签署的范围：

1. **工程范围**：正式资源生产、候选采用、单题发布、失败恢复、Learning 消费及运行可靠性回归通过；
2. **运行身份范围**：从干净提交生成 Runtime Identity，运行实例能够返回同一身份，Formal Store 与 Learning Consumer 数量一致；
3. **内容生产操作者范围**：工作台真实页面可读取 24 篇正式材料与 81 道正式题，已发布资源保持只读冻结，Learning 真实页面可复读 81 道正式题。

本次签署不包含目标年龄学生体验、教育效果、Provider 外部真实调用或真实 Trial 激活。以上范围继续保持独立门禁，不从本次通过结论外推。

## 2. 身份与数据快照

| 字段 | 现场值 |
| --- | --- |
| 基础治理提交 | `c709b67a782798c4aee6ad11b07cca9580b7c4ec` |
| 工程回归修正提交 | `a87de30b38d4e535a9949987c34485fda97c1ecf` |
| Runtime Identity | `sha256:557a19d6047b0753647cd304906b880d30cea8bd5466b483071bd0a4ce3eb7e4` |
| Runtime Identity 工作树 | `clean` |
| Formal Store Revision | `1964` |
| Formal Store Baseline | `fnv1a-03f85858` |
| Active Material | `24` |
| Current Formal Question | `81` |
| Learning Consumable Question | `81` |
| Trial requested / effective | `off / off` |

本记录提交后必须从新的干净 `HEAD` 重新生成并复核 Runtime Identity；若产品源码、正式资源或构建输入未变化，内容摘要应保持一致。

## 3. 工程证据

以下自动化回归均通过：

| 验收域 | 结果 |
| --- | --- |
| WP-R3 Runtime Reliability | `40 / 40 PASS` |
| WP-R3 Browser Matrix | `16 / 16 PASS` |
| Task Production Command Runtime | `5 / 5 PASS` |
| Unified Resource Production P7 | `13 / 13 PASS` |
| Formal Resource Latest Quality Admission | `11 / 11 PASS`；81 道当前正式题，0 blocked |
| Formal Resource History Audit | 无 critical 历史一致性问题 |
| Question Candidate Workflow | `12 / 12 PASS` |
| Question Workbench Command E2E | `7 / 7 PASS` |
| Question Publication Recovery | `3 / 3 PASS` |
| Task Publication Orchestration | `PASS` |
| Learning Entry | `17 / 17 PASS`；隔离内存、0 次外部调用 |
| Question Candidate Workbench P4 | `16 / 16 PASS` |
| Material Resource Production | `16 / 16 PASS` |
| Material Resource Production Commands | `16 / 16 PASS` |
| Question Candidate Workbench P6 | `PASS` |
| Production Build | `PASS` |

P6 原断言要求页面显示内部错误码，与现行“只投射可恢复操作、不暴露内部错误码”的产品契约冲突。本次只修正过期测试断言，没有放宽生产门禁，也没有改变公开交互语义。

## 4. 内容生产操作者现场签署

### 4.1 P4-E03：采用失败不改变现有任务

结论：`PASS`

- Candidate 工作流与工作台 P4/P6 回归覆盖采用失败、校验失败和恢复提示；
- 失败路径保留当前正式任务与已完成阶段结果；
- 页面不把内部错误码投射为操作者步骤。

### 4.2 P4-E04：单题发布只改变目标题

结论：`PASS`

- Command E2E、Publication Recovery 与 Task Publication Orchestration 均通过；
- 发布状态按 Question Revision 身份更新，不把同组其他题批量改为已发布；
- Workbench 当前 81 道正式题与 Formal Store 当前版本一致。

### 4.3 P4-E05：Frozen Resource 不被静默覆盖

结论：`PASS`

- 重新生成只创建 Candidate，不直接改写已发布 Revision；
- 已发布题在工作台以冻结、只读状态呈现；
- 正式资源历史审计未发现 critical 静默覆盖或身份漂移。

### 4.4 P4-E06：发布结果可被 Learning Consumer 复读

结论：`PASS`

- Workbench 实际页面显示 24 篇正式材料、81 道已发布正式题；
- Learning 实际页面显示“正式阅读题库当前有 81 道发布题目”；
- Runtime Health 的 `currentQuestionCount` 与 `learningConsumableQuestionCount` 均为 81；
- 三处数据一致，没有把 targeted excerpt 或轻量知识项目混入正式阅读题统计。

## 5. 现场页面证据

- 内容生产工作台：`http://127.0.0.1:5174/#/material-resource-workbench`
- Learning 入口：`http://127.0.0.1:5174/#/learning`

工作台现场检查：

- 24 篇材料全部可选；
- 12 篇核心材料与 12 篇 targeted excerpt 边界可辨认；
- 81 道正式题全部已发布；
- 《春》题组显示 6 道题、待发布 0、已发布 6，并包含单项选择；
- 正式题只读展开，不出现候选内容覆盖正式资源的投射。

Learning 现场检查：

- 正式阅读题库数量为 81；
- 核心阅读与 19 项轻量知识练习分别统计；
- 可恢复 Session 显示唯一恢复位置；
- 本次为零学生写入现场复核，没有点击“继续学习”，未制造 `question_presented`、Attempt、Diagnosis 或 Evidence。

## 6. 零写入与隐私边界

本次现场签署：

- 未修改 Material Version、Frozen Question Revision 或 Formal Registry；
- 未创建学生自然作答、Diagnosis、Evidence 或 Profile；
- 未执行 Provider 外部真实调用；
- 未输出 API Key、完整 Prompt、学生原文或模型 Raw Output；
- 所有工程验收中的写入使用隔离内存或测试存储，不计入真实 Trial。

## 7. 尚未签署的独立门禁

| 范围 | 当前状态 | 原因 |
| --- | --- | --- |
| Provider 真实可用性 | `PENDING` | 当前仅完成配置检查；真实调用涉及向外部 Provider 发送受控题目与答案内容，需独立授权 |
| Trial Identity Binding | `PENDING` | 当前 Trial 为 `off`，历史绑定为 `legacy_unverifiable` |
| 目标学生体验 | `PENDING` | 必须由目标年龄学生完成自然作答与体验签署 |
| 教育效果 | `NOT CLAIMED` | 需要跨轮次真实数据，不由工程或操作者验收代替 |

Provider 或 Trial 未通过不会否定本次三个限定范围，但不得据此宣称“真实 Trial 已激活”或“教育效果已验证”。

## 8. 最终签署

| 签署范围 | 结论 | 责任边界 |
| --- | --- | --- |
| Engineering | `PASS` | 代码、自动化回归、Production Build |
| Runtime Identity | `PASS` | 干净提交、身份生成、运行实例与 Formal Store 一致性 |
| Content Production Operator | `PASS` | 工作台生成/采用/发布边界及 Learning 可消费性 |

现场执行：Codex 工程代理

授权依据：产品负责人于当前任务明确要求完成工程、运行身份和内容生产操作者范围现场签署。

签署原则：只签已经取得直接证据的限定范围；未完成范围保持显式 `PENDING`，不使用工程证据冒充真实学生或教育效果证据。
