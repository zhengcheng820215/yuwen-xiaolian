# 反馈观察对象投射收口工程 Debug 验收报告

日期：2026-08-25  
状态：`DEBUG ACCEPTED / NARROW BROWSER SMOKE ACCEPTED`  
正式资源处理模式：`READ ONLY`

## 一、完成范围

本轮完成：

- 新增 `feedback_observation_target_projection_v1` Schema；
- 建立唯一的结构化 Feedback Observation Target Adapter；
- 旧 `describeStudentFeedbackTaskTarget` 保留为 `displayLabel` 兼容投影，不再维护第二套规则；
- Learning Thinking Review 接入 Concrete Task 的题干、题型、答题要求、Rubric 与 Task Role；
- 全部正式题批量审计接入 `targetCode / confidence / evidenceSignals / fallbackReason`；
- 新增 Target Code 与材料维度聚合；
- 完成 FT-01—FT-16 自动化验收。

未修改 Material、Plan、TrainingTask、Candidate、Frozen Resource、Registry Head、Attempt、Diagnosis、Evidence 或 Revision 身份。

## 二、治理前后对比

| 项目 | 治理前 | 治理后 |
| --- | ---: | ---: |
| Current Head | 81 | 81 |
| Pass | 42 | 81 |
| Advisory | 39 | 0 |
| Blocked | 0 | 0 |
| `feedback_target_ambiguous` | 39 | 0 |
| 可展示结构化提示 | 55 | 55 |
| 安全隐藏提示 | 26 | 26 |
| Store Revision | 1962 | 1962 |

Advisory 的下降来自真实对象识别规则，不是删除 Finding 或给题目强制分配能力标签。无法形成可靠提示的 `26` 道题仍保持隐藏，提示质量边界没有因反馈治理而放宽。

## 三、对象分布复审

治理后 `81` 道正式题的观察对象分布：

| Target Code | 数量 |
| --- | ---: |
| `character_psychology` | 8 |
| `character_trait` | 2 |
| `scene_or_object_state` | 2 |
| `fact_or_evidence` | 15 |
| `event_process_or_change` | 2 |
| `event_cause` | 16 |
| `relationship_or_comparison` | 5 |
| `main_content` | 5 |
| `expression_effect` | 2 |
| `structure_relation` | 3 |
| `theme_or_meaning` | 7 |
| `requirement_completion` | 14 |
| `generic_content` | 0 |

分布覆盖事实定位、原因、关系、过程、人物、景物、表达、结构、主题与复合要求，没有退化成单一分类。`5` 条 `feedback_target_medium_confidence` 为 info，表示对象由必要 Rubric 或兼容信号辅助投射；它们不阻断 Learning，也不形成学生能力结论。

## 四、误报修复说明

首次接入曾出现 `11 blocked`，复核后确认均为审计规则误报：

1. Rubric 中的证据或关系属于支撑动作，不能因为与题干主要对象不同就认定冲突；
2. “指出修辞并分析效果”等复合任务可以投射为 `requirement_completion`，不能强制要求唯一标签为 `expression_effect`。

最终规则只在人物对象与景物 / 事物对象发生真实域冲突时触发硬阻断；复合任务通过结构化 `evidenceSignals` 保留其组成，不再误报。

## 五、自动化验收

| 验收项 | 结果 |
| --- | --- |
| Feedback Observation Target FT-01—FT-16 | `16 / 16 PASS` |
| 全部正式题提示与反馈批量审计 | `81 / 81 PASS`、`0 advisory`、`0 blocked` |
| Controlled Feedback Expression | `63 / 63 PASS` |
| Student Feedback Grounding | `6 / 6 PASS` |
| Student Feedback Action Plan | `8 / 8 PASS` |
| Pre-answer Learning Guidance | `14 / 14 PASS` |
| Learning Feedback Revision Stage 4 | `19 / 19 PASS` |
| Targeted Micro-training Stage 4 | `51 / 51 PASS` |
| Reading Single Choice Stage 4 | `13 / 13 PASS` |
| Learning Session Task Queue | `21 / 21 PASS` |
| Retest Task | `PASS` |
| Retest Execution | `PASS` |
| Production Build | `PASS` |

生产构建仍可能显示既有 Chunk 体积与静态 / 动态混合引用提示；该提示与本轮反馈观察对象投射无关，不影响本轮验收。

## 六、窄范围真实浏览器冒烟

2026-08-25 在真实应用内浏览器完成反馈投射窄范围冒烟：

- 通过隔离页面执行 `B3-01—B3-18`，结果为 `18 / 18 PASS`；
- 覆盖正确单选、错误单选、开放题完全满足、开放题部分满足、多个正式缺口、Revision、历史反馈回退、下一题与题组完成等学生端投射；
- 正式资源、Student Attempt、Evidence、Student Profile 与真实校准分母写入均为 `0`；
- 浏览器控制台 `warning = 0`、`error = 0`；
- 人物心理、事实 / 依据、复合任务三类对象分别由 `FT-01`、`FT-04`、`FT-12` 的确定性 Adapter 断言通过，并与上述真实浏览器投射面共同验收；
- 浏览器页面未展示内部 `targetCode`、`confidence` 或 `fallbackReason`。

本次冒烟证明结构化观察对象可以安全进入既有学生反馈投射面，但不制造真实学生样本，也不构成教育效果验证。

## 七、最终判断

结构化 Adapter 已成为反馈观察对象的唯一识别来源，全部 `81` 道 Current Head 均能投射到可解释对象，原 `39` 条泛化反馈 advisory 已集中消除。

本轮没有改写正式题，也没有扩张人工步骤。后续如出现新题型或仍无法识别的题目，应先增加统一 Target Code 规则与回归样例；只有题干与 required Rubric 本身无法形成一致对象时，才创建 successor Candidate。
