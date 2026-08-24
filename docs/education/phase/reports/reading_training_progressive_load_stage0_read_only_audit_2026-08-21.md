# 阅读训练递进负担模型阶段 0 真实题库只读审计报告

状态：`READ-ONLY / ENGINEERING COMPLETE / DEBUG 24/24 PASSED`

Store Revision：`1961`

Source Digest：`fnv1a-b50b12b7`

Audit Digest：`fnv1a-92a5cbee`

审计日期：2026-08-21

## 一、覆盖口径

- 活动材料：24
  - 核心阅读材料：12
  - Targeted Excerpt：12
- 活动正式题：81
- 已生成只读负担投影：81
- 完整 / 部分 / 不足投影：80 / 1 / 0
- 核心题组 / Targeted Excerpt 组：12 / 12

覆盖率为 `81 / 81`。本报告中的投影全部为 `legacy_projection`，没有写回正式对象。

## 二、结构可解释性

- 核心题组可追踪：10
- 核心题组部分可追踪：2
- 当前不可评估：12，全部是按单次具体动作使用的 Targeted Excerpt，不应被当作完整核心题组缺陷。

“可追踪”仅表示题组结构具备未来比较相邻负担表现的基础，不代表已经获得学生能力结论。真实失稳位置仍必须由首次独立作答、修订、Retest / Transfer 和身份一致的 Evidence 共同确认。

## 三、Finding 汇总

| Finding | 数量 | 解释 |
| --- | ---: | --- |
| `projection_incomplete` | 1 | 一道历史题只能形成部分投影，需要后续原生语义替代 |
| `projection_low_confidence` | 0 | 没有低置信度投影 |
| `missing_accessible_entry` | 0 | 12 个核心题组都存在基础入口 |
| `unexplained_responsibility_jump` | 10 | 相邻题从基础入口直接进入 development；这是治理候选，不等于 10 个发布错误 |
| `duplicate_observation_scope` | 1 | 一组任务可能重复观察同一动作、能力和证据范围 |
| `cross_thread_comparison_invalid` | 1 | 题组覆盖多个能力线程，但缺少可比较的相邻层级 |
| `breakpoint_not_inferable` | 2 | 当前结构只能部分观察，不能精确定位失稳点 |
| `task_overload_attribution_risk` | 0 | 没有核心题组以 integrated 任务无理由开场 |
| `legacy_sequence_reason_missing` | 0 | 当前核心题组均可读取顺序理由 |

`unexplained_responsibility_jump` 是阶段 0 的只读提示：历史数据没有结构化记录为什么可以跨过 bridge。它不机械要求补齐每个负担等级，也不自动阻断现有正式题。阶段 1—2 应让 Planner 明确过渡理由；只有无理由且质量评估确认风险时，才进入 successor Candidate 治理。

## 四、核心题组审计

| 材料 | 题数 | Learning 实际负担顺序 | 可解释性 | 主要 Finding |
| --- | ---: | --- | --- | --- |
| 《春》 | 6 | foundation_entry → development → development → development → integration → integration | traceable | 部分投影、跳跃、重复范围 |
| 《从百草园到三味书屋》 | 6 | foundation_entry → development → development → integration → integration → integration | traceable | 跳跃 |
| 《皇帝的新装》 | 5 | foundation_entry → bridge → development → integration → integration | traceable | 无 |
| 《纪念白求恩》 | 5 | foundation_entry → foundation_entry → development → integration → integration | traceable | 跳跃 |
| 《济南的冬天》 | 6 | foundation_entry → development → integration → integration → integration → integration | traceable | 跳跃 |
| 《狼》 | 6 | foundation_entry → foundation_entry → development → development → integration → integration | traceable | 跳跃 |
| 《猫》 | 5 | foundation_entry → foundation_entry → bridge → development → development | partial | 跨线程、失稳点不可推断 |
| 《女娲造人》 | 5 | foundation_entry → development → integration → integration → integration | traceable | 跳跃 |
| 《秋天的怀念》 | 5 | foundation_entry → bridge → foundation_entry → development → integration | traceable | 跳跃 |
| 《散步》 | 6 | foundation_entry → foundation_entry → bridge → development → development → integration | traceable | 无 |
| 《天上的街市》 | 4 | foundation_entry → development → development → development | partial | 跳跃、失稳点不可推断 |
| 《走一步，再走一步》 | 4 | foundation_entry → development → development → integration | traceable | 跳跃 |

## 五、阶段 0 架构结论

1. 当前数据模型可以较完整地派生历史题负担，81 道题中 80 道为完整投影；因此不需要重建主链。
2. 现有 `TextResponseLoadProfile` 足以支撑开放文本题内容层分析，但不足以作为跨层 Training Model 的唯一语义来源。
3. 单选入口、文本负担和 Learning 实际排序已经可以联合审计；12 个核心题组都没有“高负担首题”问题。
4. 10 个题组仍缺少结构化的跨级理由。这证明下一阶段重点应是 Observation Plan / TrainingTask / Candidate 的同源负担语义，而不是继续仅调整 Prompt。
5. 《猫》和《天上的街市》目前只能部分支持失稳点解释，不能据此把题目表现直接归因到学生能力。
6. Targeted Excerpt 的职责是针对一个已确认 Gap 增加一次练习，不要求自身形成完整坡度。

## 六、只读与不可变性验收

`S0-01—S0-24` 全部通过，验证：

- Formal Version、Registry Entry、Observation Link 未变化；
- Store Revision 保持 `1961`；
- 没有新增命令回执；
- Learning Session、Attempt、Diagnosis、Revision、Evidence 和 Student Profile 未被读取后写回；
- 相同输入重复运行得到相同 Source Digest 与 Audit Digest；
- 未调用保存、采用或发布接口。

### 6.1 贯穿性双重验收证据

阶段 0 已按“旧主链零回归 + 新语义不越界”完成追认式证据归档：

- 阶段 0 专项 Debug：`24 / 24`；
- 阅读开放文本题输入负担阶段 1 回归：`28 / 28`；
- Training Task Sequence Planning 回归：`20 / 20`；
- 生产构建：通过；
- 授权生效面：只读 `legacy_projection`、题组审计结果和报告；
- 禁止生效面：正式资源、Registry、Observation Link、Candidate 工作流、发布门禁、Learning、Diagnosis、Evidence 与 Student Profile；
- 关键状态：Store Revision 保持 `1961`，正式集合和 Learning 模拟对象无写入差异。

因此阶段 0 的审计语义没有提前进入阶段 1—4 的运行边界，旧主链也未因审计接入发生回归。

## 七、进入阶段 1 的建议

阶段 0 已达到工程完成标准，可以进入阶段 1，但阶段 1 应先只覆盖新 Planning / Candidate：

1. Observation Plan 原生声明主要动作、支撑动作和观察线程；
2. TrainingTask 持有统一、版本化的 `TaskLoadSemantics`；
3. Candidate 继承并校验规划语义，不自行重算后漂移；
4. 历史 Frozen Resource 继续使用只读投影，不批量回填；
5. 对 10 个跳跃题组先记录治理优先级，不立即批量生成 successor Candidate；
6. 在阶段 2 题组级 Gate 落地前，不把阶段 0 Finding 投射为发布阻断。
