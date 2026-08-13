# AI 题目与素材优化阶段5收口计划

状态：`COMPLETED`

计划日期：`2026-08-13`

执行基线：`10` 篇活动材料、`34` 道当前正式题、Learning 可消费 `34 / 34`

## 一、收口目标

阶段5不扩大人工审查流程，也不批量重写当前正式题。它只处理阶段4完成后仍可确定的工程和数据问题：

1. 素材维护工具不得依赖固定材料数量；
2. 《走一步，再走一步》的确定性元数据与机械标点问题通过后继 Material Version 修复；
3. 来源核验继续作为后台治理信息，不阻断 AI 生成、采用发布或 Learning；
4. 能力、难度和长文本建议按材料或题组聚合，避免逐题重复制造“待处理”感；
5. 真实作答校准保持后台运行，在达到版本化试运行阈值前不制造质量结论。

## 二、工具修复契约

- 审计和优化命令必须读取当前 Shared Store 的活动材料，不得断言固定为 `9`、`10` 或其他常量；
- 允许通过显式参数声明一次执行的预期基线，未声明时以运行时活动材料集合为准；
- 默认模式必须为 dry-run；只有显式 `--apply` 才能写入；
- 新增、停用或换版材料后，重复执行不得制造重复 Material Version、Plan、Formal Version、Registry 或 Observation Link；
- 验收至少覆盖材料数量变化、重复 dry-run、重复 apply 和正式资源总数不变。

## 三、《走一步，再走一步》定向升级

允许自动处理的内容：

- 将中文语境中可以唯一确定的半角标点替换为对应全角标点；
- 补充可由当前材料和已知教学上下文确定的结构化元数据；
- 来源未经过独立证据核验时继续使用 `needs_verification`，不得自动标为 `verified`；
- 所有写入形成后继 Material Version，并记录 parent、revisionNote 和正文快照。

升级必须同时接续当前 `3` 道任务的 Plan、Formal Version、Registry、Observation Link 和 Frozen Quality Trace。切换完成前旧版本继续可消费；成功后旧版本退出新 Learning 分配，但历史 Session 仍可读取旧 Frozen Version。

## 四、质量提示降噪

质量结果继续区分：

- `blocker`：当前候选不可发布，唯一内容动作是重新生成；
- `strong_hint`：题目级强提示，但不自动转为人工审批；
- `advisory`：能力或难度分布等题组治理建议，按材料聚合展示，不在每张题卡重复；
- `information`：来源和版权状态，只进入素材治理摘要。

正式题只出现 advisory 不等于“待处理”，不得因此改变已发布状态。当前 `34` 道题的非阻断建议不触发批量重写。

## 五、真实作答校准边界

- 样本必须来自真实 Learning，并绑定具体 `resourceVersionId`；
- `0` 份返回 `awaiting_data`，`1–29` 份返回 `insufficient_sample`；
- `30` 份是当前可版本化的本地试运行治理阈值，不是永久统计标准；
- 达到阈值后只输出初步试运行指标；
- 校准结果不自动修改题目，只能触发新的完整候选，再由用户执行“采用并发布 / 重新生成题目”。

## 六、阶段5验收

- 素材审计和优化工具可处理当前 `10` 篇活动材料，并能适应未来增删；
- 《走一步，再走一步》机械标点问题归零，结构化元数据齐全且未虚标来源已核验；
- 当前活动材料仍为 `10` 篇，当前正式题仍为 `34` 道；
- Active Registry、Active Observation Link、Frozen Quality Trace、Learning 可消费均为 `34 / 34`；
- 已发布题不会因 advisory 显示为待处理；
- 工作台、发布恢复、Learning、质量策略和生产构建回归通过；
- 真实样本不足被明确记录为后续观察，不视为阶段5实现未完成。

## 七、执行结果

阶段5已于 `2026-08-13` 完成：

- 素材优化工具已移除固定 `9` 篇材料断言，按运行时活动材料和当前任务数验收；
- dry-run 只识别《走一步，再走一步》为本轮升级目标，没有重复换版其余九篇材料；
- Shared Store revision `915 → 916`，该材料形成 `material-5b84c528-837:v2`；
- 其3道题分别形成 `question-observation-task-plan-ps1i7v:v2`、`question-observation-task-plan-htzjba:v2`、`question-observation-task-plan-1nhlljh:v2`；
- 9处半角中文标点已完成确定性规范化，作者、体裁、七年级范围和标签已补齐；来源继续保持 `needs_verification`；
- 重复 `--apply` 返回 `apply-noop`，没有新增重复版本或关系；
- 素材维护审计为“可执行问题 `0`、治理信息 `10`”，来源待核验不再计为待处理；
- 题目质量审计将能力和难度分布建议聚合为材料级 guidance；逐题只保留 `12` 项 long-text 强提示，`22` 题直接 ready，阻断为 `0`；
- 最终为 `10` 篇活动材料、`34` 道当前正式题，Active Registry、Active Observation Link、Frozen Quality Trace 与 Learning 可消费均为 `34 / 34`；
- 工作台状态 `20 / 20`、素材选择恢复 `11 / 11`、Learning `14 / 14`、统一生产 P0–P7 `26 / 26`、质量策略 `8 / 8`、真实作答校准 `6 / 6`，生产构建通过。

后续只等待真实 Learning 样本。样本不足不触发人工补审、自动改题或阶段5回滚。
