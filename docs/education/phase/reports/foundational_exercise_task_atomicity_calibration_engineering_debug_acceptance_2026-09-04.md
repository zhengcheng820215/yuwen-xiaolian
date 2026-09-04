# 基础练习样本与低负担任务原子性校准工程与 Debug 验收报告

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / PRODUCT ACCEPTANCE NOT CLAIMED / LIVE NOT CLAIMED`

验收日期：`2026-09-04`

当前已提交源码基线：`39518036429d02822f84733693791bfcacd18758`（验收时工作区包含本轮尚未提交实现与文档修改）

## 一、验收范围

本轮只验证基础练习样本校准与低负担任务原子性工程是否按契约生效：

- `single_choice`、`entry_short`、`focused_short` 保持一个主要动作；
- 仅允许共享观察对象和证据范围、且不能独立计分的支撑动作；
- 计划为低负担、实际形成独立动作链时，以 `low_load_atomicity_violation` 阻断 Candidate；
- 合法 `developing` / `integrated` 任务不被误伤；
- Required Rubric 暗增责任继续由既有隐藏 Rubric 门禁处理；
- Planner Pass A 与 Question Prompt Pass B 均携带原子性约束；
- 字词、默写、文学常识等外部练习不进入本轮生成能力范围。

本轮不修改历史 Frozen Resource，不启动真实 Trial，不创建真实学生作答，不升级 Product Acceptance 或 Live 状态。

## 二、实施结果

- 新增 `low_load_atomicity_violation` 结构化阻断原因；
- Quality Gate 能区分低负担原子性偏移与一般负担身份不一致；
- 材料观察 Pass A / Pass B Prompt 已加入低负担原子性和禁止独立动作链约束；
- 新增独立专项 Debug 入口，覆盖 `FA-01—FA-08`；
- 教材目标校准测试补充外部基础练习的允许吸收与明确排除边界。

## 三、专项与回归结果

| 验收入口 | 结果 |
| --- | ---: |
| 基础练习任务原子性 FA-01—FA-08 | `8 / 8 PASS` |
| 开放文本输入负担 Stage 1 | `28 / 28 PASS` |
| 开放文本输入负担 Stage 2 | `40 / 40 PASS` |
| 开放文本输入负担 Stage 3 | `50 / 50 PASS` |
| 开放文本输入负担 Stage 4 | `56 / 56 PASS` |
| 阅读训练递进负担 Stage 2 | `48 / 48 PASS` |
| 教材目标与题组规划校准 | `22 / 22 PASS` |
| 材料观察草稿生成器 | `45 / 45 PASS` |
| 单项选择 Stage 2 | `29 / 29 PASS` |
| 合计 | `326 / 326 PASS` |

生产构建通过。保留的主 bundle 大小与静态/动态重复引入警告为既有非阻断项，与本轮原子性校准无关。

## 四、数据与运行边界

- Formal Store 验收前 SHA-256：`a9015721abf2f588b2d2fd3d049906f5e8650d34132beb4ef30cf8e9ab7c`；
- Formal Store 验收后 SHA-256：`a9015721abf2f588b2d2fd3d049906f5e8650d34132beb4ef30cf8e9ab7c`；
- Formal Store 写入：`0`；
- Live Provider 调用：`0`；
- 历史 Frozen Resource 覆盖：`0`。

## 五、工程裁决

`FA-01—FA-08`、关联回归、生产构建和零写入边界均通过，本轮 Engineering 验收门关闭。

该裁决不构成新的冻结 Trial Build，也不替代 Runtime、Provider、Formal Store、Launch Record 与 Trial Identity Binding 的重新准入。后续若要进入真实使用，仍须先提交当前工作区并按正式运行准入流程重新绑定身份。

## 六、正式内容窄范围治理追加记录

在上述零写入工程验收完成后，按正式内容治理授权另行执行《皇帝的新装》两道复合任务的 successor 治理。该动作不改变第四节所记录的“工程验收阶段零写入”事实；以下为后续正式写入的独立证据：

| 项目 | 结果 |
| --- | --- |
| Formal Store Revision | `1963 → 1964` |
| `question-observation-task-plan-19178y4` | `v4 → v5`，收敛为“共同反应—社会风气” |
| `question-observation-task-plan-z8hqcb` | `v5 → v6`，收敛为“话术—害怕暴露—隐瞒附和—骗局持续” |
| Current Frozen Resource | `81 → 81` |
| Frozen Quality Trace | `81 → 81` |
| Learning 可消费题目 | `81 → 81` |
| 全量质量分布 | `blocked 0 / guided 15 / ready 66` |
| 重复执行 | `apply-noop`，Revision 保持 `1964` |
| 写入后 Formal Store SHA-256 | `088e4c1fb08a17b1e26681fc227a40dcbb2c1e26e6eb4fec260b2f5f3367d154` |

治理后两道 successor 均只保留一个主要观察关系，未新增 `unexplained_load_jump` 或 `duplicate_load_observation`。原版本保留为 `superseded`，Registry、Observation Plan、Anchor、Link 与 Frozen Quality Trace 在同一 Revision 中完成切换。

该正式资源变更要求旧 Runtime Identity、Launch Record 与 Trial Identity Binding 按既有身份规则失效；本记录不声明 Trial 已重新准入或激活。
