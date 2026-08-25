# 当前正式题最新标准审计与 successor 治理报告

日期：2026-08-25  
范围：24 篇活动材料、81 道 Current Head、当前质量策略、递进负担投影、正式资源身份与 Learning 消费

## 一、治理前结论

权威共享正式资源只读审计显示：

- 活动材料：`24`，其中核心阅读材料 `12`、targeted excerpt `12`；
- 当前正式题：`81`；
- Active Registry / Active Observation Link / Frozen Quality Trace / Learning 可消费：`81 / 81 / 81 / 81`；
- 作答形式：`long_text 31`、`short_text 32`、`single_choice 18`；
- 最新质量状态：`ready 63`、`ready_with_guidance 16`、`blocked 2`；
- 正式资源身份一致性问题：`0`。

因此，主链与资源身份完整，但不能宣称“所有题目均已符合最新标准”：仍有两道 Current Head 必须治理。

## 二、阻断项

### 2.1 《春》单选交互投影缺失

- Current Head：`question-observation-task-plan-10w5bsw:v1`；
- 问题：题目声明 `single_choice`，答案接受范围也指向选项身份，但 Frozen Version 未包含 `choiceInteraction`；
- 影响：无法可靠展示选项、判定正确答案或解释干扰项，最新质量策略返回 `choice_option_quality_invalid / candidate_incomplete`；
- 根因：补充候选已生成完整交互，但采用发布投影只复制了旧 `options` 字段，没有把结构化 `choiceInteraction` 写入 Draft 与 Frozen Version。

### 2.2 《女娲造人》题干与 Rubric 必答关系不一致

- Current Head：`question-observation-task-plan-bp4jxh:v1`；
- 问题：Rubric 要求解释“小人的表现—女娲喜悦”的因果关系，旧题干只要求“说明反应并结合表现”，没有明确要求完成该关系判断；
- 影响：学生可能按题干作答却因隐藏必答维度失分，最新质量策略返回 `rubric_requirement_not_in_stem`；
- 治理方向：显式要求说明两者关系，不新增主题分析、人物综合分析或跨段推理。

## 三、治理方式

两道题均使用原 `resourceId` 创建不可变后继版本：

1. 旧 Frozen Version 保留并转为 `superseded`；
2. 新 Candidate / Draft 重新完成 Validation、Review、Quality Assessment 与 Frozen Quality Trace；
3. Current Observation Plan、Active Link 与 Registry Head 原子切换；
4. 已开始 Session 继续绑定旧版本，新 Session 消费 successor；
5. Current Head 总数治理前后必须保持 `81`。

本轮同时修复补充候选发布器的字段投影，确保后续 `single_choice` 的 `choiceInteraction` 同时进入 Draft 与 Frozen Version。

## 四、递进负担处置边界

只读递进审计发现若干 `unexplained_responsibility_jump`。这些结果是题组级 advisory，不是本轮批量改题清单：

- 不要求每篇材料机械出现所有负担等级；
- 不因一个告警自动追加 entry 题或重排正式任务；
- 不把高负担题表现不佳直接归因为学生能力不足；
- 先在真实 Trial Window 观察学生从哪一层开始重复失稳；
- 仅在存在真实证据、能够增加独立观察价值时，通过 successor 治理。

该处置保持“无理由跳跃需要解释”与“不得机械模板化”两条原则同时成立。

## 五、工程验收目标

治理命令必须同时证明：

- 当前题量仍为 `81`；
- Current Registry、Link、Frozen Version、Quality Trace 和 Learning 消费继续一致；
- 《春》单选包含 4 个有效选项、唯一正确答案及 3 个可解释干扰项；
- 《女娲造人》题干与 Rubric 不再存在隐藏必答关系；
- 最新质量重新准入达到 `0 blocked`；
- 治理命令二次执行为幂等 no-op；
- 现有单选、递进负担、Learning 队列、统一 Learning 入口与生产构建零回归。

## 六、执行状态

状态：`GOVERNANCE APPLIED / DEBUG ACCEPTED / LATEST QUALITY 0 BLOCKED`

正式治理已完成：

- Shared Store Revision：`1961 → 1962`；
- 《春》：`question-observation-task-plan-10w5bsw:v1 → v2`；
- 《女娲造人》：`question-observation-task-plan-bp4jxh:v1 → v2`；
- Current Head / Frozen Quality Trace / Learning 可消费：`81 / 81 / 81`；
- 最新质量状态：`ready 65`、`ready_with_guidance 16`、`blocked 0`；
- 作答形式：`long_text 31`、`short_text 32`、`single_choice 18`；
- 治理命令二次执行：`alreadyApplied = true`，Store Revision 保持 `1962`。

发布器已补齐 `choiceInteraction` 到 Draft 与 Frozen Version 的双重投影；旧的单选 Rubric 收口脚本和题组补充发布脚本已取消 `61 / 15 / 46 / 12` 等历史固定断言，改为从执行前权威基线动态校验题量守恒。

递进负担只读复审在治理后达到：

- 正式题投影完整：`81 / 81`；
- 核心题组可追踪 / 部分可追踪：`10 / 2`；
- `unexplained_responsibility_jump`：`10`，均保留为 advisory；
- `projection_incomplete`、`duplicate_observation_scope`、`missing_accessible_entry`、`task_overload_attribution_risk`：`0`。

专项与跨链回归证据：

- 最新标准 successor 治理 dry-run / apply / idempotency：PASS；
- Current formal-question generation-quality audit：`81` 道，`0 blocked`；
- Formal-resource latest-quality admission：`81 / 81 eligible`；
- Single-choice Rubric contract：`18 / 18`；
- Reading Training Progressive Load Stage 0：`24 / 24`；
- Reading Training Progressive Load Stage 4：`64 / 64`；
- Reading Open Response Input Load Stage 4：`56 / 56`；
- Reading Single Choice Stage 4 E2E：`13 / 13`；
- Learning Session Task Queue：`21 / 21`；
- Unified Learning Entry：`27 / 27`；
- Question Generation Quality Policy：`15 / 15`；
- Resource Coverage：`22 / 22`；
- Material Resource Workbench State：`25 / 25`；
- Task Resource Preparation：`10 / 10`；
- Question Metadata：`41 / 41`；
- Question Workflow Projection、Task Publication Orchestration：PASS；
- Production Build：PASS。

生产构建仍有既有非阻断提示：主 JS Chunk 超过 `500 kB`，且一个 Demo 模块同时被静态与动态引用。该提示与本轮题目质量、发布身份和 Learning 消费无关，继续作为独立性能治理项，不影响本轮放行结论。

## 七、最终判断

当前 `81` 道 Current Head 均通过最新发布与 Learning 准入门禁，不再存在结构性质量阻断。`16` 项 guidance 与 `10` 项题组梯度 advisory 仍需在真实 Trial Window 中观察，但它们不是隐藏错误，也不授权系统批量改写正式题。下一步应以真实作答数据决定是否形成新的 successor Candidate，而不是继续凭静态告警扩张治理范围。
