# 产品复杂度收口阶段 3 工程、Debug 与浏览器验收报告

日期：2026-08-24

契约版本：`product_complexity_convergence_stage3_feedback_profile_projection_v1`

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`

## 一、交付结论

阶段 3 已完成反馈与 Profile 的只读投射收口：

- 从既有正式 Feedback、Diagnosis 与 Requirement Coverage 选择单一学习焦点，不重算正式诊断；
- 一次反馈至多呈现一个真实完成点、一个正式主要缺口和一个可执行动作，不机械输出固定三段；
- 正确回答不制造缺口，多缺口不可安全排序时回退既有正式反馈；
- Revision 只说明一次修订的真实变化，不开放第三次修改，也不把支持下改善写成独立掌握；
- `CoreAbilitySummary` 只读映射现有 `StudentAbilityProfile`，不根据单题反馈生成长期能力结论；
- 历史自由文本反馈不反推新 Gap，历史 Profile 无充分证据时隐藏或显示不确定；
- 新投射失败时回退 Legacy，不阻断 Learning、Revision 或后续任务；
- 普通 Learning 页面复用现有运行命令，没有新增展示专用状态机或正式写入者。

阶段 3 没有修改 Material、Plan、Task、Candidate、Frozen Resource、Registry、Attempt、Diagnosis、Evidence、Profile、Calibration、Revision、Targeted、Retest 或 Transfer 的事实权威与生命周期。

## 二、工程交付范围

| 工程包 | 结果 |
| --- | --- |
| Feedback / Profile Projection Schema 与 Validator | 完成 |
| 反馈单焦点投射 Agent | 完成 |
| Revision 评价投射 | 完成 |
| CoreAbilitySummary 只读适配 | 完成 |
| Learning 页面与 Legacy 回退接入 | 完成 |
| C3 自动化 Debug Runner | 完成 |
| B3 浏览器验收 API、页面与入口 | 完成 |

核心实现：

- `productComplexityConvergenceFeedbackProjection.schema.ts`；
- `productComplexityConvergenceFeedbackProjectionAgent.ts`；
- `productComplexityConvergenceProfileProjectionAgent.ts`；
- `productComplexityConvergenceStage3Presentation.ts`；
- `phase163LiveLearning.ts` 与 Learning / Revision 页面投射接入；
- `runProductComplexityConvergenceStage3Debug.ts`；
- 阶段 3 浏览器验收 API、页面和 Internal Acceptance 入口。

## 三、自动化 Debug

执行：

```bash
PATH=/usr/local/bin:$PATH npm run debug:product-complexity-convergence-stage3
```

结果：`C3-01—C3-48`，`48 / 48 PASS`。

覆盖 Schema、稳定身份与 Hash、正式事实零变化、单焦点选择、学生安全表达、三块上限、操作一致性、恢复回退、Revision 边界、Profile 粗粒度映射、历史兼容和投射可删除性。

## 四、真实浏览器验收

验收入口：

```text
#/internal/acceptance/product-complexity-convergence-stage3
```

结果：`B3-01—B3-18`，`18 / 18 PASS`。

浏览器附加检查：

- 实际 `/learning` 入口正常恢复当前题组，无页面错误提示；
- `?stage3Feedback=legacy#/learning` 可安全回退旧投射；
- 浏览器矩阵共形成 13 份隔离只读投射；
- 18 个检查项均为 PASS，无 FAIL；
- Formal Resource / Attempt / Evidence / Profile / 真实校准分母写入为 `0 / 0 / 0 / 0 / 0`。

浏览器验收使用隔离 Fixture，只验证工程边界和可见行为，不计入真实使用或教育效果分母。

## 五、旧主链回归

共执行 `405` 项相关专项断言，全部通过：

| 回归集合 | 结果 |
| --- | ---: |
| Product Complexity Convergence Stage 0—2 | 92/92 |
| Student Learning Feedback / Narrative | 32/32 |
| Learning Feedback Revision Stage 4 | 19/19 |
| Targeted Micro-training Stage 4 | 51/51 |
| Reading Single Choice Stage 4 | 13/13 |
| Reading Open Response Input Load Stage 4 | 56/56 |
| Reading Training Progressive Load Stage 4 | 64/64 |
| Phase 16.3 Real Chain / Unified Entry / Day 0 / Diagnosis Boundary | 62/62 |
| Material Resource Production | 16/16 |

Production Build：`PASS`。构建仅保留既有动态导入和 bundle size 提示，不构成本阶段回归。

## 六、运行与兼容边界

- 默认投射版本为 `convergence_v1`，可通过 `stage3Feedback=legacy` 回退；
- 回退只改变展示，不修改正式反馈、诊断、作答、证据或画像；
- Structured Facts 身份错位、多缺口无法安全排序、历史自由文本或投射异常时使用 Legacy；
- `CoreAbilitySummary` 只接收有效且具有证据的正式 Profile；旧静态“我的”页面不是正式 Profile 来源，因此不会被推断性改写；
- V1 不展示小数置信度、内部计数、Evidence ID、Gap Code 或 Profile Pipeline；
- 投射对象可以删除或重建，不影响正式 Profile 和历史事实。

## 七、后续边界

阶段 3 完成只表示工程实现、浏览器体验与零回归边界通过。阶段 4 才允许通过 2—4 周真实封闭试用观察反馈理解率、Revision 完成率、后续独立改善和维护成本，并据此决定能力保留、默认关闭或退役；不得用本报告宣称教育效果已经得到验证。
