# 阅读开放文本题正式题第二批聚焦治理实施与 Debug 验收计划

状态：`BATCH 2 APPLIED / DEBUG ACCEPTED / REAL CALIBRATION PENDING`

文档版本：`reading_open_response_formal_question_focused_governance_batch2_v1`

输出日期：`2026-08-21`

上位契约：[阅读开放文本题难度梯度与输入负担优化契约](./READING_OPEN_RESPONSE_DIFFICULTY_AND_INPUT_LOAD_OPTIMIZATION_CONTRACT.md)

阶段边界：[阶段 4 既有题治理与真实校准工程实施及 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE4_EXISTING_QUESTION_GOVERNANCE_AND_REAL_CALIBRATION_ENGINEERING_PLAN.md)

前批结果：[阅读开放文本题高风险正式题治理第一批报告](../education/phase/reports/reading_open_response_formal_question_high_risk_governance_batch1_2026-08-21.md)

本批结果：[阅读开放文本题正式题第二批聚焦治理报告](../education/phase/reports/reading_open_response_formal_question_focused_governance_batch2_2026-08-21.md)

## 一、目标

第二批只处理 3 道 `decompose_or_refocus` 中确定性最高、且来自不同材料的 `composite_core_actions` 正式题：

| 材料 | 当前版本 | 当前主要问题 |
| --- | --- | --- |
| 《皇帝的新装》 | `question-observation-task-plan-12ktvxo:v4` | 同时要求情节作用与主题表达，且存在关系负担和 responseFormat 错配 |
| 《猫》 | `resource-observation-task-plan-10up8i5:v4` | 同时比较三次养猫的多个维度，再要求归纳主题，观察动作过载 |
| 《天上的街市》 | `question-observation-task-plan-r3zmn4:v4` | 同时承担神话比较、人物状态分析与生活理想推断 |

本批目标是把每题收敛为一个主要认知动作，必要证据作为从属支撑；不降低主要能力，不把高阶理解机械改成单选，也不增加或删除题目。

## 二、逐题治理意图

### 2.1 《皇帝的新装》

保留“孩子说出真相如何使骗局被揭穿”的情节观察。此前众人的称赞只作为理解转折的证据，不再并列要求学生同时完成完整主题分析。

禁止：

- 把题目改成只复述孩子说了什么；
- 再要求独立概括社会主题；
- 与题组中“人物为何沉默”“骗子如何利用心理”形成同一观察目标。

### 2.2 《猫》

治理前必须先与题组当前正式题做语义去重。如果新的比较任务会重复“第三只猫死亡后无法补救”或“针刺良心”的观察，不得生成 Candidate。

允许的聚焦方向是：保留三次养猫经历的整体比较，但只观察一个稳定变化轴，例如“我对猫亡失的情感为何逐次加深”；猫的遭遇与责任变化仅作为这条主线的证据。

禁止：

- 再同时列出猫的特点、家人态度、结局、情感变化四个独立维度；
- 把比较结果继续扩展成完整主题分析；
- 与现有第三只猫局部因果题重复。

### 2.3 《天上的街市》

保留“诗人改写牛郎织女故事所表达的生活愿望”这一主要解释动作。传统神话与诗中人物生活状态的差异只作为解释改写意图的证据。

禁止：

- 将“比较两种故事”和“分析生活理想”写成两个互不依赖的并列任务；
- 引入材料之外的神话知识考查；
- 与题组其他联想、词语表达效果题重复。

## 三、版本和正式资源边界

- 每道题只允许生成一个活动继任 Candidate；
- 必须保持原 `resourceId`、question lineage、主要 Ability、Training Task Role 与 Material Version；
- 采用后形成新的 Frozen Question Version，旧版本只转为 `superseded`，不得原地修改或删除；
- 新 reviewed Observation Plan 必须继承材料当前完整题组，包括后续补充题；
- Registry 与活动 Observation Link 必须原子更新；
- 已打开 Learning Session 继续使用启动时冻结版本，新 Session 才消费继任版本；
- Governance Finding 与负担等级不得写入 Student Ability Profile。

## 四、只读演练门禁

正式写入前必须同时满足：

1. 三个继任版本均不再属于 `regenerate` 或 `decompose_or_refocus`；
2. 每题 `requiredRelationCount <= 1`；
3. 不出现 `composite_core_actions`、`hidden_rubric_requirement`、`object_scope_overloaded`、`relation_load_overloaded`、`response_format_load_mismatch`；
4. 题组不新增 `unexplained_load_jump` 或实质重复观察；
5. 活动正式题、Registry、Observation Link、Learning 可消费题和当前质量轨迹仍各为 `81`；
6. 正式资源基线问题为 `0`；
7. 重复执行治理命令必须返回 `apply-noop`。

如果《猫》的聚焦版本与已有题发生重复，则本批允许只发布其余两题，并将《猫》返回 Observation Plan；但不得用降低质量的替代题凑满批次数量。

## 五、Debug 验收矩阵

| 编号 | 验收内容 | 预期 |
| --- | --- | --- |
| B2-01 | 三个源版本身份与 Registry 一致 | PASS |
| B2-02 | 治理 dry-run 不修改正式存储 revision | PASS |
| B2-03 | 每题只保留一个主要动作 | PASS |
| B2-04 | Required Rubric 完全由题干显式覆盖 | PASS |
| B2-05 | 《猫》与题组现有任务不重复 | PASS |
| B2-06 | 三个 Candidate 单题门禁通过 | PASS |
| B2-07 | 三个题组顺序门禁通过 | PASS |
| B2-08 | 发布后题量、Link、Registry 与质量轨迹均为 81 | PASS |
| B2-09 | predecessor 保留且 successor 可追溯 | PASS |
| B2-10 | 旧 Session 冻结、新 Session 消费 Registry 当前版本 | PASS |
| B2-11 | 重复执行返回 apply-noop | PASS |
| B2-12 | 阶段 1—4、顺序规划和浏览器矩阵回归 | PASS |
| B2-13 | Vite 生产构建 | PASS |

## 六、停止条件

出现以下任一条件立即停止目标题治理：

- 主要 Ability 或任务角色必须改变才能通过门禁；
- 新题与当前题组实质重复；
- 合法证据范围不足；
- 新计划不能继承完整活动题组；
- Registry、Link、Frozen Quality Trace 或 Learning 身份出现不一致；
- 连续两次受控生成仍不能通过确定性门禁。

完成本批仍只能表述：

```text
ENGINEERING GOVERNANCE ACCEPTED
REAL CALIBRATION PENDING
EDUCATIONAL EFFECT NOT PROVEN
```

## 七、完成记录

- 正式存储 revision：`1960 -> 1961`；
- 三个后继版本均通过单题与题组门禁并进入 Registry；
- 活动正式题、活动 Observation Link、Registry、Learning 可消费题和冻结质量轨迹均保持 `81`；
- 重复执行治理命令返回 `apply-noop`，revision 保持 `1961`；
- 阶段 1—4、题组顺序、Learning 历史身份、B4 浏览器矩阵与生产构建全部通过；
- 真实学生校准尚未开始，本批不得宣称教育效果已被证明。
