# Rubric 反馈语义角色对齐工程与 Debug 验收文档

文档状态：ENGINEERING READY / NARROW SCOPE  
策略版本：`rubric_feedback_semantic_role_alignment_v1`  
适用范围：阅读开放题的正式反馈投射、思考回顾与修订动作  
不适用范围：单项选择反馈、正式 Diagnosis 重算、Evidence 重建、Frozen Resource 改写

## 1. 问题与目标

当前 Rubric 已能表达观察对象、文本依据、关系与结论，但学生端投射仍可能把局部证据词误当成最终观察结论。例如学生写出“山朗润、水涨”时，系统可能把“山朗润”投射成已经完成的“整体状态”，再要求解释“水涨为什么体现山朗润”。这不是 Rubric 缺失，而是语义角色在投射链中发生了错位。

本次修复只解决以下问题：

1. 局部证据不得因命中 `acceptedKeywords` 而自动升级为观察目标或结论；
2. 不同证据不得被错误解释为彼此的目标；
3. “先补这一点”说明未完成的断点，“下一步这样做”提供一个可执行动作，两者不得同义复述；
4. 无法稳定识别观察对象时，允许使用克制表达，但不得回退为“自己的答案、具体内容、想一想有什么关系”等连续通用模板。

## 2. 语义角色

反馈投射必须区分四类角色：

| 角色 | 含义 | 学生端责任 |
| --- | --- | --- |
| `observationTarget` | 题目真正要求观察、判断或概括的对象 | 可用于说明“还缺哪一层” |
| `evidenceSignals` | 材料中的局部动作、语句、景物或变化 | 可用于确认学生找到了什么 |
| `relationTarget` | 证据与观察目标之间需要解释的联系 | 可用于生成一个思考动作 |
| `expectedConclusion` | Rubric 内部可接受结论方向 | 只供校验，不直接向学生展开答案 |

`Projection` 可以知道完整 Rubric；学生反馈只显示完成当前修订所需的最少信息。

## 3. 来源优先级

语义角色按以下顺序确定：

1. Frozen Task 的题干限定对象、作答要求与结构化观察目标；
2. Rubric Requirement Coverage 与正式 Diagnosis；
3. 题目元数据中的可接受信号；
4. 兼容旧题时的确定性文本推断。

`acceptedKeywords` 只表示可接受信号，不天然表示结论。若某个词同时出现在材料局部描写、评分依据或可核验证据中，默认先归入 `evidenceSignals`；只有题干、Rubric 与正式 Diagnosis 共同支持时，才允许将其作为 `expectedConclusion`。

## 4. 学生端表达边界

### 4.1 已经做到

只陈述已经由 Requirement Coverage 确认的完成项。找到局部证据但尚未概括共同状态时，应写成“你找到了……这些具体变化”，不得写成“你已经指出了整体状态”。

### 4.2 先补这一点

只说明当前最值得处理、且一次行动能够改善的主要断点。它描述“缺什么”，不重复给操作步骤。

### 4.3 下一步这样做

只给一个具体的思考动作，必须包含可定位线索或比较动作，并与上一段语义不同。禁止连续使用以下兜底组合：

- “找出具体内容，再说明与你的想法有什么关系”；
- “保留自己的答案，再找一处具体内容”；
- “想一想表现了什么”。

不得把完整 Rubric、标准答案或预期结论拆成答案步骤直接告诉学生。

## 5. 一致性门禁

投射结果命中以下任一问题时，必须改用安全重写，不得直接展示：

- `local_evidence_promoted_to_observation_target`：局部证据被提升为最终观察目标；
- `cross_evidence_target_mismatch`：要求证据 A 解释证据 B，而题目实际要求二者共同指向更高层目标；
- `gap_action_semantic_duplicate`：主要断点与下一步动作同义重复；
- `generic_action_without_clue`：动作只有“具体内容/自己的答案”等泛化对象；
- `student_answer_leakage`：反馈泄露完整预期答案。

单项选择继续沿用 `selectedOption → distractorRationale → 典型误读 → 核对动作`，不接入本次文本 Rubric 修复。

## 6. 兼容与写入边界

- 不重建 `Material → Plan → Task → Candidate → Publish → Learning` 主链；
- 不修改 Frozen Resource、正式 Diagnosis、Evidence、Revision 或 Learning 历史记录；
- 新语义只在读取与反馈投射时生效；
- 旧题字段不足时允许确定性兼容推断；低置信度必须降级为克制反馈；
- 本次工程不得新增第二套 Diagnosis Agent，也不得自行重判 `partially_achieved`。

## 7. 典型验收案例

题目要求学生结合“山朗润、水涨、太阳脸红”等描写，说明景物如何共同表现“刚睡醒”的特点。学生只写“山朗润、水涨”。

正确投射应满足：

- 确认学生找到了两个景物变化；
- 不确认学生已经概括了“整体状态”；
- 不生成“水涨为什么体现山朗润”一类跨证据错配；
- 主要断点指向“还没有概括这些变化共同表现的整体状态”；
- 下一步动作可以要求“比较山、水、太阳的变化，概括它们共同呈现的状态”，但不得直接给出标准结论。

## 8. Debug 验收

至少覆盖以下用例：

1. 局部证据命中但结论缺失；
2. 局部证据与结论均完成；
3. 结论完成但文本依据缺失；
4. 依据完成但关系缺失；
5. 景物状态题不得投射为人物特点；
6. 两个平行证据不得互相充当观察目标；
7. Gap 与 Action 不得同义重复；
8. 低置信度旧题不泄露答案；
9. 单项选择反馈零回归；
10. Revision、Targeted Micro-training、Retest / Transfer 零回归；
11. Frozen Resource 零写入；
12. 正式构建通过。

每项验收必须证明旧主链零回归，并且新语义只在本文件允许的反馈投射边界内生效。

## 9. 完成定义

同时满足以下条件才算完成：

- 已消除局部证据被误投射为整体结论的问题；
- 已消除跨证据目标错配；
- 下一步动作具备题目相关线索且不重复主要断点；
- 单选分流、正式身份链、Rubric Coverage 和 Frozen Resource 保持不变；
- 专项 Debug、既有反馈回归与构建全部通过。

## 10. 实施与验收记录（2026-08-28）

本轮已完成：

- 在 `studentThinkingReviewAgent` 中先区分结论信号与局部证据信号，再建立 Requirement Coverage；
- 历史资源即使把“山朗润、水涨”等局部证据混入 `acceptedKeywords`，也不再自动确认整体结论；
- 补齐“结合景物变化 / 具体描写”的文本依据要求识别；
- 在 `structuredFeedbackFactsAgent` 中增加景物状态题的确定性任务焦点，将下一步动作收口为“比较变化并概括共同状态”；
- 新增历史混合关键词兼容用例，验证局部证据、整体结论与关系责任不会错位；
- 未修改 Frozen Resource、正式 Diagnosis、Evidence、Revision 或学生历史记录。

验收结果：

- Controlled Feedback Expression：`64/64 PASS`；
- Feedback Observation Target Projection：`16/16 PASS`；
- Rubric Aligned Feedback Stage 1：`30/30 PASS`；
- Rubric Aligned Feedback Stage 2：`30/30 PASS`；
- Rubric Aligned Feedback Stage 3：`36/36 PASS`；
- Rubric Aligned Feedback Stage 4：`24/24 PASS`；
- 正式构建：PASS。
