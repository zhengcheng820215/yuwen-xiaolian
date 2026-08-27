# Rubric 对齐反馈阶段 2 工程与 Debug 验收报告

状态：`ENGINEERING ACCEPTED`

阶段版本：`rubric_aligned_feedback_stage2_v1`

验收日期：2026-08-27

## 验收结论

阶段 2 已完成 Projection 到最小学生安全 Grounding 的只读适配，并以可选字段接入现有 `StudentFeedbackActionPlan`。本阶段没有切换 Learning 学生可见反馈，没有修改 Revision 资格、Diagnosis、Evidence、Profile 或正式资源。

结论冻结为：

> ready Projection 可以在身份一致、证据可解析和披露门禁通过时形成一个最小 Grounding；Action Plan 仅在显式收到合法 Grounding 时优先消费，否则保持旧输出不变。

## 工程实现

- 新增 `rubricFeedbackGroundingAdapter.ts`：完成题型分流、身份校验、Primary Item 裁剪、安全线索与语义泄露门禁。
- 扩展 `StudentFeedbackActionPlanInput`：仅增加可选 `projectionGrounding`，输出 Schema 不变。
- 扩展 Projection Source Links：增加 `taskId / learningRoundId / executionSessionId`，用于阶段 2 同链身份校验。
- 新增 `runRubricAlignedFeedbackStage2Debug.ts` 与 npm Debug 入口。
- 未修改 `src/pages/**`、Learning 路由、Revision Eligibility、Evidence/Profile 写入或正式发布逻辑。

## 专项验收

`RG2-01—RG2-30`：`30/30 PASS`

覆盖：

- ready / limited / not_assessable 分流；
- Question、Response、Task、Round、Session 身份错位阻断；
- 学生证据引用缺失时禁止虚构肯定；
- 全部达成、部分达成、Primary Gap 和多 Rubric Item 最小裁剪；
- acceptedSignals 与完整答案组合泄露门禁；
- 单选独立链；
- Retest / Transfer result-only；
- Action Plan 非法可选输入精确回退旧路径；
- Frozen Resource / Registry 零写入。

Shared Formal Resource Store 在验收前后均为 revision `1963`，数据序列化结果一致。

## 旧主链回归

| 验收项 | 结果 |
| --- | --- |
| Rubric Stage 0 | 8/8 PASS |
| Rubric Stage 1 | 30/30 PASS |
| Student Feedback Grounding | 6/6 PASS |
| Student Feedback Action Plan | 8/8 PASS |
| Student Learning Narrative | 33/33 PASS |
| Learning Feedback Presentation | 10/10 PASS |
| Controlled Feedback Expression | 63/63 PASS |
| Revision Stage 1 | 26/26 PASS |
| Revision Stage 2 | 29/29 PASS |
| Revision Stage 3 | 18/18 PASS |
| Revision Stage 4 | 19/19 PASS |
| Production Build | PASS |

构建仍有既有的大 chunk 与动态/静态重复导入警告，不属于本阶段新增回归。

## 零回归与阶段边界

- 旧 Grounding / Action Plan 默认行为保持不变；
- 新语义只在显式、合法 `projectionGrounding` 输入下生效；
- 单选不进入文本 Rubric Adapter；
- 首次反馈请求 scaffold 会降级为 thinking prompt；
- 新路径不写入任何正式教育事实；
- Learning 页面与 Narrative Runtime 尚未消费新 Grounding。

## 后续准入

阶段 2 已满足阶段 3 文档设计准入条件。进入阶段 3 前必须另行冻结：Narrative 最小输入、学生可见字段、开关与回退策略、页面状态边界和真实浏览器验收矩阵。不得直接把完整 Projection 或 Rubric 传给 Narrative。
