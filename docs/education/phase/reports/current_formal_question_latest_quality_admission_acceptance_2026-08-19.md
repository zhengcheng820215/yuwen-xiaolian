# 当前正式题最新质量重新准入验收报告

> 2026-08-20 更新：本文保留 46 道纯文本基线的历史验收证据。当前 12 篇材料、61 道正式题（含 15 道单选）的最新结论见[正式题质量与发布链收口验收报告](./formal_question_quality_and_publication_closeout_acceptance_2026-08-20.md)。

日期：2026-08-19
范围：共享 Formal Resource Current Head、最新生成质量策略、Learning 新旧会话边界、题组容量

## 结论

当前 `46` 道正式题通过最新内容质量重新准入后，`0` 道阻断、`16` 道带非阻断强提示、`30` 道直接通过。先前扫描出现的 `22` 道阻断主要来自门禁误把 Rubric 中的正确答案细节当作题干没有说明的新作答任务；策略校准后仍保留真实隐藏 Rubric 维度的阻断能力。

## 工程收口

1. 新增 Current Head 最新质量准入解析器，按当前内容和当前策略计算，不复用历史旧结论；
2. 新 Learning Session 只消费 `ready / ready_with_guidance`；
3. 已有活动会话继续使用队列中冻结的确切版本；
4. 入口探测、匹配和工作区使用同一准入集合；
5. Learning 连续题组容量与最新规划契约统一为最多 `6` 道；
6. 审计增加作答格式分布与单选默认目标缺口。

## 当前数据差距

权威 Current Head 的作答格式仍为：

- `long_text`：34；
- `short_text`：12；
- `single_choice`：0。

这不是现有文本题的发布阻断，但说明历史正式题组尚未兑现最新的基础单选进入层。后续必须由生产工作台生成完整单选 Candidate，并由用户执行“采用并发布”；不得通过维护脚本绕过人只负责采用 / 不采用的产品原则。

## 验收命令

- `debug:question-generation-quality-policy`：13 / 13；
- `audit:current-question-generation-quality`：46 道，0 blocker；
- `debug:formal-resource-latest-quality-admission`：8 / 8；
- `debug:learning-session-task-queue`：19 / 19。
