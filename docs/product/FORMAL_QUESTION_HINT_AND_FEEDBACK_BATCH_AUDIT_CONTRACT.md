# 全部正式题提示与反馈批量审计契约

状态：`ENGINEERING ACCEPTED`

## 一、目标

本审计用于一次性扫描 Registry 当前 Head 指向的全部正式题，识别提示生成和学生反馈投射中的同类风险，避免依靠学生逐题试用后才发现问题。

审计只读取 Shared Formal Resource Store，不创建 Candidate、不修改 Frozen Resource、不改变 Registry Head，也不写入 Attempt、Diagnosis、Evidence 或历史反馈。

## 二、审计对象

每道当前正式题形成一个审计项，至少记录：

- Material、Resource 与 Resource Version 身份；
- 题干、题型、作答形式、主要能力和 Task Role；
- 提示投射状态、结构化 `clue`、`thinkingAction` 和学生可见文案；
- 反馈观察对象投射；
- 提示与反馈 Finding、最高严重度和处置状态。

历史 superseded / retired 版本不进入默认审计范围；如需历史追溯，应使用独立历史审计命令。

## 三、提示审计

提示审计必须调用 Learning 当前正式生成器与同一质量校验器，不维护旁路模板。

### 3.1 合格条件

- 同时具有可定位的 `clue` 与可执行的 `thinkingAction`；
- `hint` 明确投射上述两项；
- 只提供一个思考入口；
- 不出现通用兜底、完整解题流程或答案泄露；
- Retest / no-hint 策略不得生成提示。

### 3.2 允许隐藏

题干未公开可靠引文、范围或明确对象时，提示可以被质量门禁隐藏。隐藏是安全降级，不等于题目质量失败；审计将其记录为可观察状态，供后续真实 Trial 判断是否需要 successor，而不自动修改正式题。

## 四、反馈审计

批量静态审计不模拟学生答案，也不生成虚构的 Diagnosis 或 Evidence。它检查的是“反馈投射准备度”：

- 题目的真实观察对象能否稳定映射为人物心理、人物特点、景物或事物状态、表达效果、结构关系、原因或主要内容；
- 景物、事物或整体状态题不得误投为人物特点；
- 表达效果与结构关系题不得落入无指向的能力名称；
- 单选题不得携带文本依据或解释要求；
- 必要 Rubric、文本依据要求和解释关系要求之间不得矛盾；
- 无法可靠确定对象时只能标记 advisory，运行时必须使用克制反馈，不得猜测。

学生实际回答是否覆盖 Requirement，仍由正式 Diagnosis、Evidence 和 Feedback Adapter 在运行时判断；静态审计不得提前声称学生已完成或未完成。

## 五、Finding 与严重度

- `blocked`：会造成错误提示、错误反馈对象或作答契约矛盾；需要 successor 治理，不能原地改写正式资源。
- `advisory`：当前可以安全隐藏或克制投射，但需要在真实 Trial 中观察。
- `info`：预期状态，例如质量门禁主动隐藏无可靠线索的提示。

审计结果必须按 Finding Code、材料和严重度聚合，并保留逐题明细。不得只输出“通过 / 不通过”的总数。

## 六、运行与验收

标准命令：

```bash
npm run audit:formal-question-hint-feedback
```

命令必须满足：

1. 扫描数量与当前正式题基线一致；
2. 运行前后 Shared Store revision 与数据完全一致；
3. 每道题恰好产生一个审计项；
4. 所有生成提示均通过统一结构化质量门禁；
5. 通用兜底文案与景物状态误投人物特点均能被自动识别；
6. 报告可重复运行，结果由相同 Store Snapshot 确定性产生；
7. 审计 Finding 不自动触发发布、治理或题目改写。

首轮执行基线与结论记录在：

- `docs/education/phase/reports/formal_question_hint_feedback_batch_audit_2026-08-25.md`

反馈观察对象 advisory 的下一阶段工程边界记录在：

- `docs/product/FEEDBACK_OBSERVATION_TARGET_PROJECTION_CONVERGENCE_ENGINEERING_DEBUG_ACCEPTANCE.md`

工程执行与治理后复审记录在：

- `docs/education/phase/reports/feedback_observation_target_projection_convergence_engineering_debug_acceptance_2026-08-25.md`

## 七、处置原则

发现问题后的流程统一为：

> 单题 Finding → 聚合同类根因 → 更新契约与统一门禁 → 生成 successor Candidate → 人工采用或不采用 → 发布后重新审计

严禁逐题直接修改 Frozen Resource，也不得因为静态 advisory 批量重新生成全部题目。
