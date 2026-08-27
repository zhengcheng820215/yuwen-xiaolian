# Rubric 对齐学生反馈阶段 0：契约与只读审计报告

状态：`ENGINEERING ACCEPTED`

日期：2026-08-27

## 一、执行范围

本阶段只完成以下工作：

1. 冻结 `RubricFeedbackProjection v1`；
2. 冻结 `StudentVisibleFeedbackGrounding v1` 及最小必要信息边界；
3. 将正式题提示与反馈批量审计升级为 `formal_question_hint_feedback_batch_audit_v2`；
4. 对 Registry 当前 Head 的正式题执行 Rubric 反馈静态准备度审计；
5. 验证审计过程不写入 Shared Formal Resource Store。

本阶段未接入运行时 Projection，未修改学生可见反馈，未创建 Candidate，未改写 Frozen Resource，也未写入 Attempt、Diagnosis、Evidence、Revision 或长期学生状态。

## 二、冻结契约

### 2.1 Projection 合法来源

- `partially_achieved` 和 `missing` 必须绑定正式 `diagnosisId`；
- `achieved` 必须具有可追溯的学生回答片段；
- Primary Item 只能指向已由正式诊断确认的 `partially_achieved / missing` 项；
- Projection 不得自行重新判断学生是否部分完成。

### 2.2 学生可见最小信息

学生可见 Grounding 只允许携带：已核验的学生动作、主要断点、安全线索定位、一个下一步思考动作、反馈深度和 Projection 身份。

以下内容禁止进入学生可见 Grounding：完整 Rubric、`acceptedSignals`、Rubric 权重、标准答案、正确选项身份和可直接拼装答案的完整拆解。

### 2.3 题型分流

文本题后续可以消费 Rubric Projection；单选题继续围绕 `selectedOption → distractor rationale → 典型误读 → 重新核对动作` 形成反馈，不套用文本题补全依据或解释关系的逻辑。

## 三、只读审计基线

| 指标 | 结果 |
| --- | ---: |
| Shared Store revision | 1963 |
| 当前正式题 | 81 |
| Rubric feedback ready | 81 |
| Rubric feedback limited | 0 |
| Rubric feedback blocked | 0 |
| 中等置信度反馈对象 advisory | 5 |
| 无可靠具体线索而安全隐藏提示 | 25 |
| Stage 0 Debug | 8/8 PASS |

`ready 81` 仅表示题目身份、Rubric 与作答契约具备静态投射条件，不表示 81 道题已经产生学生反馈，也不表示任何学生已经完成 Rubric Item。

5 条反馈对象中等置信度和 25 条提示安全隐藏属于既有审计观察项；阶段 0 不自动治理、不修改正式资源。

## 四、Debug 与零写入验收

已通过：

- 合法的 diagnosis-grounded partial coverage；
- 缺少正式 Diagnosis 时拒绝 partial coverage；
- Primary Item 不能指向 achieved 项；
- 最小必要学生可见 Grounding 通过校验；
- `acceptedSignals` 等完整答案材料泄漏被拒绝；
- 每道正式题恰好形成一个 Rubric 反馈准备度结果；
- 静态审计不生成 coverage 或 Primary Item；
- 审计前后 Shared Store revision 与序列化数据完全一致。

执行命令：

```bash
npm run debug:rubric-aligned-feedback-stage0
npm run audit:rubric-aligned-feedback-stage0
```

## 五、结论与下一阶段边界

阶段 0 已达到验收条件，可以进入阶段 1 的确定性 Projection 开发。

阶段 1 只允许从正式 Diagnosis、Requirement Coverage、Rubric 与 Student Response 派生只读 Projection；不得改变学生可见 Narrative，不得修改 Diagnosis / Evidence 结果，不得写入或覆盖历史 Frozen Resource。旧 Publish、Learning、Diagnosis、Evidence 与 Revision 主链必须保持零回归。
