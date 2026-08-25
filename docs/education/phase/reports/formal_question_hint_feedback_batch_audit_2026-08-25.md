# 全部正式题提示与反馈批量审计报告

日期：2026-08-25  
模式：`READ ONLY`  
契约：`formal_question_hint_feedback_batch_audit_v1`

## 一、审计范围

本轮读取 Shared Formal Resource Store Revision `1962`，仅审计 Active Registry 当前 Head 指向的 Frozen Resource Version。

- 当前正式题：`81`；
- 每道 Current Head 恰好形成一个审计项；
- 历史 superseded / retired 版本未混入默认范围；
- 运行前后 Store revision 与序列化数据完全一致；
- 未创建 Candidate、未改写 Frozen Resource、未切换 Registry Head，也未写入学生 Attempt、Diagnosis 或 Evidence。

## 二、结果摘要

| 项目 | 数量 | 判断 |
| --- | ---: | --- |
| 通过 | 42 | 当前静态投射无需治理 |
| Advisory | 39 | 可安全运行，但反馈观察对象偏泛，需要真实作答校准 |
| Blocked | 0 | 未发现错误提示、错误对象投射或作答契约冲突 |
| 可展示结构化提示 | 55 | 同时具有具体线索与思考动作 |
| 被质量门禁隐藏的提示 | 26 | 无可靠具体线索时安全隐藏，不使用通用兜底文案 |
| 因 Task Role 抑制提示 | 0 | 当前 Current Head 未命中 Retest / no-hint 正式题 |

Finding 聚合：

- `feedback_target_ambiguous`：`39`；
- `hint_hidden_without_specific_clue`：`26`；
- 其他 blocked finding：`0`。

## 三、关键判断

### 3.1 提示问题不再需要逐题发现

正式题提示统一经过 Learning 当前生成器和同一结构化质量门禁。能够提供“具体线索 + 思考动作”的 `55` 道题才展示提示；其余 `26` 道题直接隐藏入口，不再回退到“留意具体描写、想一想表现了什么”一类空泛模板。

隐藏不代表题目错误。它表示仅凭题干无法在不泄露答案的前提下生成可靠提示，后续是否需要 successor 应由真实 Trial 数据决定。

### 3.2 反馈模板仍有一类可集中治理的问题

`39` 道题的反馈观察对象目前只能克制投射为“理解 / 分析 / 推理 / 信息提取的关键内容”。这不会生成错误结论，所以记为 advisory；但它可能使运行时反馈显得偏泛。

该问题应按观察对象识别规则集中治理，不应让学生逐题发现，也不能直接批量改写正式资源。推荐顺序为：

1. 收集这些 Resource Version 的真实作答与反馈文本；
2. 聚合人物心理、因果关系、主要内容、证据范围等可复用对象识别模式；
3. 先升级统一 Feedback Target Adapter 与回归样例；
4. 只有题干或 Rubric 本身无法支撑明确对象时，才创建 successor Candidate。

### 3.3 当前没有发布阻断

本轮未发现以下风险：

- 景物或事物状态被误投为人物特点；
- 表达效果题或结构关系题投射错位；
- 单选题携带文本依据或解释要求；
- 必要 Rubric 缺失；
- 学生可见提示未通过统一质量门禁。

因此，当前 `81` 道题可以继续进入真实 Learning；advisory 不应被投射成新的人工审核步骤。

## 四、复现与验收

标准命令：

```bash
npm run audit:formal-question-hint-feedback
```

命令会输出总数、Finding 聚合、逐题 blocked / advisory 明细与被隐藏提示清单，并断言：

- 审计数量与 Current Formal Version 基线一致；
- Resource Version 身份不重复；
- 所有可展示提示均包含 `clue`、`thinkingAction` 和组合文案；
- 通用兜底提示会被统一校验器拒绝；
- 审计前后 Store revision 与数据不变。

首轮 Debug 验收：`PASS`。

## 五、治理边界

后续流程固定为：

> 批量审计 → 聚合同类 Finding → 修改统一契约 / 生成器 / 门禁 → 回归 → 必要时创建 successor Candidate → 人工采用或不采用

禁止因静态 advisory 原地修改 Frozen Resource，也禁止一次性重新生成全部正式题。
