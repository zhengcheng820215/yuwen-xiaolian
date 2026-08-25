# 正式题质量与发布链收口验收报告

> 历史快照说明：本报告记录 `2026-08-20` 当时的 `61` 道 Current Head，不代表当前权威基线。`2026-08-25` 的 `81` 道全量复审、阻断项与 successor 治理结果以[当前正式题最新标准审计与 successor 治理报告](./current_formal_question_latest_standard_audit_and_successor_governance_2026-08-25.md)为准；历史数字不得继续作为代码中的固定断言。

日期：2026-08-20  
范围：12 篇活动材料、61 道 Current Head、15 道单选、Candidate 质量策略、正式后继版本、发布恢复与 Learning 消费

## 一、结论

本轮收口完成后，当前正式语料保持：

- 活动材料：`12`；
- 当前 Observation Plan：`12`；
- 当前任务与 Active Observation Link：`61 / 61`；
- Active Registry 与 Current Frozen Version：`61 / 61`；
- Frozen Quality Trace：`61 / 61`；
- Learning 可消费题目：`61 / 61`；
- 作答格式：`long_text 34`、`short_text 12`、`single_choice 15`；
- 最新生成质量重新准入：`0 blocker`、`16 ready_with_guidance`、`45 ready`。

61 道题全部可以进入新 Learning Session。16 项 guidance 均为文本题 Rubric 密度强提示，不是发布错误，也没有单选题型错配提醒。

## 二、收口问题与修复

### 2.1 审计投影遗漏单选交互

正式题质量审计在把 Frozen Version 投影为 `QuestionEditableFields` 时漏传 `choiceInteraction`，导致 15 道合法单选被误判为内容不完整。现已补齐字段，并增加“所有 Current 单选都必须保留交互结构”的回归断言。

### 2.2 单选 Rubric 暗含开放作答

历史单选虽然 Learning 只收集一次结构化选择，但部分必答 Rubric 仍保留文本证据、解释或结论要求。现已在三层统一阻断：

1. Candidate 内容契约；
2. 生成质量策略 `question_generation_quality_v4`；
3. Formal Resource 准入校验。

单选不再执行开放文本专用的题干—Rubric 动作对齐检查；文本题原门禁保持不变。

### 2.3 正式资源后继版本迁移

15 道 Current 单选均创建了不可变 V2 后继版本：

- V1 未被删除或原地修改，转为 `superseded`；
- V2 保持原题干、选项、正确答案、干扰项依据、材料范围、能力、难度和任务身份；
- 仅把 Rubric 作答要求对齐为结构化选择；
- 每个 V2 都重新形成 Validation、Review、Quality Bundle、Frozen Quality Trace、Registry Head 与 Active Observation Link；
- Store Revision 从 `1569` 原子提交至 `1570`；
- 迁移命令再次执行为 `alreadyApplied = true`，不会重复创建版本。

### 2.4 回归基线去脆弱化

真实材料 Stage 4 E2E 不再把材料版本写死为 `v3`，而是验证稳定 Material Lineage 与当前版本格式，避免材料正常升级后产生伪失败。

## 三、质量评估

当前 61 道题没有发现：

- Candidate 内容缺失；
- 单选交互、答案键或干扰项结构错误；
- 最新质量策略阻断；
- Registry / Frozen Version / Active Link 不一致；
- Learning 不可消费；
- 发布恢复或连续学习回归失败。

当前仍有三类非阻断治理信号：

1. 16 道文本题包含三个或更多独立 Rubric 核心点，提示后续真实作答中观察学生负担；
2. 《春》当前没有单选，《皇帝的新装》《秋天的怀念》等部分材料低于默认数量目标；该目标是软约束，不得以低质量题补配额；
3. 历史来源核验和旧 hint-policy 兼容提示继续作为独立治理项，不影响本轮题目发布与 Learning 消费结论。

## 四、自动化证据

- Question generation quality policy：`15 / 15 PASS`；
- Reading single-choice Stage 1：`23 / 23 PASS`；
- Single-choice Rubric migration dry-run / apply / idempotency：PASS；
- Current formal-question quality audit：`61` 道，`0 blocker`；
- Formal-resource latest-quality admission：`61 / 61` eligible；
- Reading single-choice Stage 4 E2E：`13 / 13 PASS`；
- Single-choice quantity planning Stage 4：`7 / 7 PASS`；
- Material Resource Workbench State：`25 / 25 PASS`；
- Question Workflow Projection：PASS；
- Task Publication Orchestration：PASS；
- Task Production Command Runtime：`5 / 5 PASS`；
- Question Publication Recovery：`3 / 3 PASS`；
- Continuous Learning：`8 / 8 PASS`；
- Vite Production Build：PASS。

构建仍保留既有非阻断提示：一个 Demo 模块同时被静态与动态引用，主 JS Chunk 超过 500 kB。该提示与本轮题目质量、发布一致性和 Learning 消费无关，可作为后续独立性能治理项。

## 五、放行判断

当前 12 篇材料、61 道题已经完成本轮质量与发布链收口，可继续进入真实单学生使用和 Learning 数据校准。后续题量、难度和反馈策略调整应基于真实作答数据，不应继续通过无样本假设批量改写正式题。
