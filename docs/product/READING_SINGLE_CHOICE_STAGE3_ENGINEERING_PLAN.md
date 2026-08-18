# 阅读单选阶段 3 工程实施与验收清单

状态：`ENGINEERING + DEBUG PASS / PRODUCT EXECUTION BLOCKED UNTIL STAGE 4`

日期：`2026-08-18`

## 1. 目标

阶段 3 负责把阶段 1/2 已形成的完整单选 Frozen Resource 接入 Learning、Diagnosis、Evidence 和真实数据链。工程实现必须保持文本任务兼容，不提前改变正式资源覆盖能力集合。

## 2. 工程边界

### 2.1 Learning

- `responseFormat` 决定文本输入或单选交互；
- 学生投影只包含题干、稳定 optionId、选项内容、展示顺序和选项集合版本；
- 正确答案和干扰项内部依据不进入工作区状态；
- 未选择不能提交；提交和恢复始终使用结构化 `SingleChoiceStudentAnswerValue`；
- 草稿保存、刷新恢复和重复提交保持同一 Option Set 与提交身份；
- 第一版不提供反馈后改选入口。

### 2.2 Diagnosis 与 Evidence

- 单选在正式资源已包含答案键与干扰项语义时使用确定性判断，不调用外部 LLM；
- 正确选择只形成当前基础判断证据，并提示继续用文本任务观察解释与证据组织；
- 错误选择按对应 `misconceptionCode / diagnosisMeaning / evidenceBoundary` 形成具体但保守的 Diagnosis；
- 不向学生泄漏正确 optionId；
- 每次单选仍产生独立 Response、Diagnosis、Evidence 和 Trace Link。

### 2.3 真实数据

- Attempt 身份由 Response、Option Set Version、selectedOptionIds 与 displayedOptionOrder 共同稳定确定；
- Calibration Projection 保存 responseFormat、Option IDs、版本、展示顺序、正确性与命中偏差；
- 单选得分策略版本为 `single_choice_correctness_v1`；
- 不同 Resource Version / Option Set Version 不静默合并。

### 2.4 跨格式互补观察

- 单选和文本观察保持独立 Attempt / Diagnosis / Evidence；
- 仅在 Student、Material Version 与 Ability Scope 可比较时形成联合解释；
- 四格分流分别为前置能力训练、文本组织训练、诊断复核、复测或迁移；
- 联合解释不输出合并总分，Root Cause 只能是 `hypothesis` 或 `unresolved`。

## 3. 验收门槛

1. 学生投影不包含答案键和干扰项依据；
2. 空选、未知选项和 Option Set 错位在 Diagnosis 前阻断；
3. 正确与错误选项均形成合法 Formal Diagnosis；
4. 错误反馈命中相应干扰项语义且不泄漏答案；
5. Draft、Attempt 与提交重试保持结构化和幂等；
6. 单选 Calibration Projection 可按版本统计选项分布；
7. 四类跨格式结果都有明确 Training Route，且不合并证据；
8. 文本执行、持久化、真实数据和正式学习主链无回归；
9. Resource Coverage 继续阻断 `single_choice`，等待阶段 4。

## 4. 阶段 4 交接

阶段 4 需要使用至少两篇真实材料完成 Candidate → Publish → Learning 全链联调，覆盖正确、典型错误、刷新、重复提交和中断恢复，并进行可观察的学生端验收。只有阶段 4 通过后，才允许解除正式可执行门禁。
