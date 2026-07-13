# Phase 10 验收记录：学习回合 Demo

## 验收结论

PASS

Phase 10 轻量 Demo 已通过人工验收。

## 验收对象

- Demo 路由：`/#/phase10-learning-round-demo`
- 核心目标：验证 Learning Round 是否能够把策略、任务、学生作答、有效性判断、Evidence 回流和下一步动作串成一轮可验收学习回合。

## 已验收 Case

### Case 1：正常学习回合

通过条件：

- 能启动一轮学习。
- 能生成可执行任务。
- 学生提交有效答案后，能进入 Evidence 回流。
- 能生成 AbilityEvidence、EvaluationResult、ProfileUpdateDecision 和 GrowthMemoryRecord。
- 能输出下一步动作。

结果：PASS

### Case 2：无效作答阻断

通过条件：

- 空答案、纯数字、占位回答或过短关键词回答不能进入 Diagnosis。
- 无效作答不能进入 Evidence 回流。
- 无效作答不能生成长期能力结论。
- 系统应提示补充有效作答。

结果：PASS

### Case 3：启动阶段阻断

通过条件：

- 当 GrowthMemorySummary 或上游条件不足时，不生成可信策略。
- 不强行生成任务。
- 不进入任务执行。

结果：PASS

### Case 4：诊断失败复核

通过条件：

- 学生作答有效，但 Diagnosis Runtime 失败时，应进入人工复核。
- 不生成正式 AbilityEvidence。
- 不自动更新长期能力状态。

结果：PASS

## 状态语义验收

本次 Demo 同步确认以下语义边界：

```text
作答有效 != 答案正确
本轮流程完成 != 答案正确
Evidence 回流 != 能力提升
```

说明：

- `作答有效` 只表示答案具备最低可分析内容，可以进入 Diagnosis。
- `本轮流程完成` 只表示 Learning Round 已经走完运行链路。
- 答案不正确但可分析时，可以形成 weakness evidence。
- 长期能力结论仍必须由 Evaluation 基于多条 AbilityEvidence 判断。

## 验证命令

已通过：

```bash
pnpm run debug:phase10-1
pnpm run debug:phase10-2
pnpm run debug:phase10-3
pnpm run build
```

## 当前能力结论

Phase 10 已具备最小可验收能力：

```text
NextLearningStrategy
-> TaskRequest / Task Fulfillment
-> ConcreteLearningTask
-> StudentResponse
-> TaskExecutionResult
-> TaskEvidenceReturnResult
-> LearningRoundResult
```

该能力可以证明：

```text
系统已经能够编排一轮学习，并在回合结束后输出结构化结果和下一步动作。
```

## 本阶段仍不包含

- 不证明学生能力已经提升。
- 不证明训练策略长期有效。
- 不做正式学生产品页面。
- 不接数据库。
- 不做多轮自动学习系统。
- 不做家长报告或成长曲线。

## 后续方向

Phase 10 之后，下一步应从 Debug Runtime 收敛到可试用学习体验：

```text
LearningRound Runtime
-> 最小学生学习页面
-> 学生完成一轮真实学习
-> 本轮反馈与下一步动作展示
```
