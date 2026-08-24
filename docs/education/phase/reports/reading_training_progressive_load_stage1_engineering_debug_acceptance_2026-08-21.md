# 阅读训练递进负担模型阶段 1 工程与 Debug 验收报告

状态：`IMPLEMENTED / DEBUG ACCEPTED`

契约版本：`reading_training_progressive_load_policy_v2`

阶段版本：`reading_training_progressive_load_stage1_v1`

验收日期：2026-08-21

## 一、结论

阶段 1 已完成。新规划链现在能够在 PlanningCandidate、TrainingTask 和 QuestionCandidate 三层表达同源的原生负担语义，并以稳定 Hash 和 Verification 检查生成内容是否偏离任务规划。

本次没有重建 `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 主链，没有批量迁移历史正式资源，也没有提前启用阶段 2—3 的 Planner、Prompt、题组门禁或 Learning 归因能力。

## 二、已实现能力

1. 新增 `reading_task_load_semantics_v1`：记录观察线程、序列角色、主要动作、可选支撑动作、任务责任、作答形式和文本负担画像。
2. 新增稳定规范化与内容 Hash；`confidence` 和 Verification 不参与身份 Hash。
3. 新 PlanningCandidate 原生产生语义，采用后由 TrainingTask 深复制持有。
4. QuestionCandidate 继承 Task 语义，并保留规划侧与实际内容侧的双重身份依据。
5. 新增 `reading_task_load_semantics_verification_v1`，区分 `matched / advisory / mismatched / insufficient_input`。
6. responseFormat、主要动作或实际负担发生实质漂移时形成 mismatch，不允许静默覆盖为可发布。
7. regenerate、optimize、exception correction 和 Repository round-trip 保留观察线程与语义身份。
8. 历史 Task 不回填新字段；需要生成 Candidate 时使用明确的 `legacy_projection` 兼容语义。

## 三、专项 Debug

`npm run debug:reading-training-progression-stage1`

结果：`S1-01—S1-40 = 40 / 40 PASS`。

覆盖范围包括：Schema、Guard、作答形式兼容、稳定 Hash、规划生成、深复制、v2 Plan 必填、历史兼容、线程身份、Candidate 继承、regenerate / optimize / correction、漂移验证、幂等、Repository round-trip 与禁止写入面。

## 四、旧主链零回归清单

| 回归面 | 结果 | 结论 |
| --- | ---: | --- |
| Material Observation Draft Generator | `44 / 44 PASS` | 既有生成与隔离逻辑保持 |
| Question Candidate Workflow | `12 / 12 PASS` | Candidate、采用、重生成与冲突边界保持 |
| Training Task Sequence Planning | `20 / 20 PASS` | 既有顺序规划未被新策略替换 |
| Material Resource Production | `16 / 16 PASS` | 生产工作台主命令保持 |
| Reading Open-response Stage 1—4 | `28 + 40 + 48 + 56 PASS` | 开放文本生成、负担分析与 Learning 链保持 |
| Reading Single-choice Stage 1—4 | `23 + 29 + 20 + 13 PASS` | 单选生成、发布与消费保持 |
| Unified Resource Production P0—P7 | `26 / 26 SUITES PASS` | Material → Publish 全链无回归 |
| Phase 17.3 Learning Entry | `17 / 17 PASS` | 正式资源匹配、冻结版本与 Learning 消费保持 |
| Production Build | `PASS` | Vite 生产构建成功 |

全链回归未发现由阶段 1 引入的失败。构建仅保留既有的大包体与混合动态导入提示，不构成功能阻断。

## 五、阶段 1 生效边界清单

### 5.1 允许生效面

- MaterialObservationPlanningCandidate 的原生负担语义；
- 新 v2 Observation Plan 的 Policy Version；
- 新 TrainingTask 的 `taskLoadSemantics`；
- 新 QuestionCandidate 的语义、Hash、生成上下文和 Verification；
- Candidate 重生成、优化、修复和 Repository 投影中的语义继承；
- 历史 Task 生成 Candidate 时的只读 `legacy_projection`。

### 5.2 禁止生效面

- 不改变 Planner 的题组规划策略；
- 不改变 Question Prompt；
- 不启用题组级递进 Admission Gate；
- 不修改 Frozen Resource、Registry 或 Resource Observation Link；
- 不改变 Learning 选题、排序、Session 或 Attempt；
- 不把负担层级写入 Diagnosis、Evidence 或 Student Ability Profile；
- 不批量回填历史 Task、Question Revision 或 Formal Resource。

## 六、关键集合与不可变性证据

阶段 0 真实题库基线继续有效：

- Store Revision：`1961`；
- Source Digest：`fnv1a-b50b12b7`；
- Audit Digest：`fnv1a-92a5cbee`；
- 活动材料：24（核心 12、Targeted Excerpt 12）；
- 活动正式题：81。

阶段 1 Debug 使用隔离内存 Repository 或只读真实快照，没有调用正式保存、采用或发布接口；Frozen、Registry、Link、Learning、Diagnosis、Revision、Evidence 与 Student Profile 均未被写回。

## 七、阶段边界结论

阶段 1 同时满足：

1. 旧主链零回归；
2. 新语义只在阶段 1 授权对象内生效；
3. 历史正式数据零迁移、零覆盖；
4. 新语义描述任务负担，不形成学生能力结论。

因此阶段 1 可以关闭。**阶段 2 尚未启用**；后续只有在独立阶段 2 契约与验收边界下，才可让 Planner、Prompt 和题组级 Gate 消费该语义。
