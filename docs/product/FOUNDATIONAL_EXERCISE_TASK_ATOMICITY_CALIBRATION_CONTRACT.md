# 基础练习样本与低负担任务原子性校准契约

英文名称：Foundational Exercise Sample and Low-load Task Atomicity Calibration Contract

文档类型：`NORMATIVE_CONTRACT`

文档状态：`DESIGN FROZEN / ENGINEERING DEBUG ACCEPTED`

状态轴：`Design = PASS / Engineering = PASS / Product Acceptance = NOT_CLAIMED / Live = NOT_CLAIMED`

版本：`foundational_exercise_task_atomicity_calibration_v1`

更新时间：2026-09-04

当前状态来源：[当前产品状态](./CURRENT_PRODUCT_STATE.md)

## 一、目的

本契约规定如何使用教材配套练习、校内练习册和阶段性试卷中的基础题，对阅读训练的入口负担、题干清晰度和动作原子性进行校准。

这些外部样本的价值是帮助系统识别“学生一次究竟要做什么”，不是把现有产品改造成字词、默写或应试题库，也不是用外部题面替代本产品的 Observation Plan、Rubric、Diagnosis 与 Evidence。

## 二、允许吸收的校准信号

只吸收以下结构性信号：

1. 题干使用简短、直接的“动作 + 对象”表达；
2. 基础题一次只承担一个主要观察动作；
3. 支撑动作只有在与主要动作共享对象、证据且不能独立计分时才可保留；
4. 低负担入口先确认信息、对象、局部含义或简单关系，再逐步增加证据、关系、推理和表达责任；
5. 题目必须使学生在作答前就能知道要定位、辨认、概括还是解释什么。

## 三、明确排除的范围

本轮不得据此新增或扩大以下能力：

- 拼音、字形、词语听写；
- 背诵、默写；
- 文学常识填空；
- 朗读、停连、重音等课堂口语活动；
- 机械复制练习册题目或答案；
- 用练习册分值替代题目负担、证据价值或能力判断。

外部样本不具有高阶阅读训练的最终权威性。人物、主题、结构、表达效果、多证据推理和反馈质量仍以产品正式契约为准。

## 四、低负担任务原子性规则

### 4.1 原子任务

`single_choice`、`entry_short`、`focused_short` 的设计目标是让学生完成一个清晰的主要动作。

允许：

- 找出一个明确对象；
- 判断一项局部事实或关系；
- 用一句话概括一个局部变化；
- 依据同一处内容作一个直接解释；
- “找出依据并说明其支持什么”这一不可分割的证据—结论链。

不允许：

- 找出多处内容、概括变化、解释原因并分析作用同时出现；
- 以“并、再、同时、还要、分别”等连接词串联多个可独立评分动作；
- 题干只写一个动作，Required Rubric 暗中增加另一个动作；
- 通过最低字数、提示或答案接受范围补入新的任务责任。

### 4.2 支撑动作边界

一个主要动作最多带一个支撑动作。支撑动作必须同时满足：

1. 与主要动作共享同一观察对象；
2. 使用同一证据范围；
3. 不能脱离主要动作单独形成评分项；
4. 不会把计划中的 `entry_short` / `focused_short` 实现成 `developing` / `integrated`。

否则必须拆题、收窄或重新规划，不得以题干润色掩盖负担升级。

## 五、Planner、Prompt 与 Gate 责任

### 5.1 Planner

Pass A 仍先确定 Observation、主要动作、可选支撑动作与负担等级。它不因外部样本存在而复制题目，也不机械补齐题型或负担层级。

### 5.2 Question Prompt

Pass B 必须优先生成简洁的“动作 + 对象”题干。对于低负担任务：

- 一个句子应能说明主要作答责任；
- 不使用连续动作链制造表面简短、实际复合的题目；
- 不把完整 Rubric 或答案拆解写给学生；
- 不直接复制外部样本措辞。

### 5.3 Quality Assessment / Admission Gate

Gate 必须重新计算实际负担。若计划声明 `entry_short` / `focused_short`，而题干、Required Rubric、最低要求或提示使实际负担达到 `developing` / `integrated`，必须以 `low_load_atomicity_violation` 阻断当前 Candidate。

该阻断只作用于 Candidate / Draft Revision 的当前准入，不修改历史 Frozen Resource，不写入 Student Ability Profile，也不把题目负担错误解释为学生能力不足。

## 六、历史兼容与迁移

1. 历史 Frozen Resource 只读，不批量覆盖；
2. 既有正式题先做只读审计；
3. 需要治理时通过 successor Candidate 处理；
4. 既有 Trial、Attempt、Diagnosis 与 Evidence 保留原 Question Version 身份；
5. 新规则不得重建 Material → Plan → Task → Candidate → Publish → Learning 主链。

## 七、Debug 验收矩阵

统一专项入口：

```bash
npm run debug:foundational-exercise-task-atomicity
```

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| FA-01 | 基础题只包含一个主要动作 | 通过 |
| FA-02 | 同一证据上的“找出 + 直接说明” | 可作为依赖支撑动作通过 |
| FA-03 | 计划为 focused_short，实际生成两个独立责任并升为 developing | `low_load_atomicity_violation` 阻断 |
| FA-04 | developing / integrated 合理包含多个责任 | 不因本规则单独阻断 |
| FA-05 | Required Rubric 暗增任务 | 继续由既有隐藏 Rubric 门禁阻断 |
| FA-06 | Prompt 含低负担原子性与禁止动作链约束 | 通过 |
| FA-07 | 外部样本中的字词、默写、文学常识 | 不进入生成能力范围 |
| FA-08 | 运行审计与 Debug | Formal Store 零写入 |

2026-09-04 工程验收结果：`FA-01—FA-08 8 / 8 PASS`。连同开放文本负担阶段、递进负担题组、教材目标校准、材料观察草稿生成与单选回归，共执行 `326 / 326 PASS`；生产构建通过。Formal Store 前后 SHA-256 均为 `a9015721abf2f588b2d2fd3d049906f5e8650d34132beb4ef30cf8e9ab7c`，正式数据写入为 `0`，Live Provider 调用为 `0`。

详细证据见[基础练习样本与低负担任务原子性校准工程与 Debug 验收报告](../education/phase/reports/foundational_exercise_task_atomicity_calibration_engineering_debug_acceptance_2026-09-04.md)。该结果仅关闭 Engineering 验收门，不声明 Product Acceptance 或 Live 已完成。

## 八、完成定义

满足以下条件方可宣称本轮完成：

1. 本契约已进入正式生产契约索引；
2. Pass A / Pass B Prompt 已包含原子性约束；
3. Gate 能区分低负担实现偏移与一般身份不一致；
4. 专项 Debug、既有负担阶段回归和生产构建通过；
5. Formal Store 前后哈希一致；
6. 未新增字词、默写或文学常识模块，未修改历史 Frozen Resource。

## 九、正式内容窄范围治理批次

2026-09-04 的只读正式题审计在《皇帝的新装》当前题组中确定性命中两道 `composite_core_actions`。本批次只治理以下当前正式版本，不扩展到其他材料或题目：

| 资源 | 原版本 | successor 目标 | 保留的单一主要观察 |
| --- | --- | --- | --- |
| `question-observation-task-plan-19178y4` | `v4` | `v5` | 联系共同附和、隐瞒真相的反应，分析其反映的社会风气 |
| `question-observation-task-plan-z8hqcb` | `v5` | `v6` | 说明“看不见即愚蠢或不称职”的话术怎样促使隐瞒和附和，使骗局持续 |

治理必须满足：

1. 只创建上述两个 successor Candidate / Frozen Resource，不原位修改原 Frozen Resource；
2. 原版本转为 `superseded`，既有 Attempt、Diagnosis、Evidence 与历史 Session 继续引用原版本；
3. Registry、Observation Plan、Anchor、Link 与 Frozen Quality Trace 在同一 Shared Store Revision 中原子切换；
4. Current Frozen Resource、Active Registry 和 Learning 可消费题目总数均保持 `81`；
5. 两道 successor 不再命中 `composite_core_actions`、`hidden_rubric_requirement`、`object_scope_overloaded`、`relation_load_overloaded` 或 `response_format_load_mismatch`；
6. 《皇帝的新装》题组不得新增 `unexplained_load_jump` 或 `duplicate_load_observation`；
7. 正式资源身份变化后，旧 Runtime Identity、Launch Record 与 Trial Binding 必须按既有规则失效；本治理不得静默重新激活 Trial。

统一预演与写入命令：

```bash
npm run audit:formal-question-foundational-atomicity-governance
npm run govern:formal-question-foundational-atomicity-governance
```

写入前必须先通过只读预演。写入后必须再次运行写入命令证明幂等，并执行正式资源一致性、Learning 消费和生产构建回归。
