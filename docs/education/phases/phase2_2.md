# Phase 2.2：Question Metadata 验收与冻结记录

## 阶段定位

Phase 2.2 用于记录 Phase 2 底层能力的验收状态。

当前产品主线已经从 Phase 2 转向 Phase 3：

```text
Diagnosis
-> Ability Evidence
-> Top Weakness
-> Training Plan
-> Training Evidence
-> Retest Evidence
-> Ability Evidence Update
```

因此 Phase 2.2 的目标不是继续扩展题库或题型覆盖，而是确认 Question Metadata 能力已经可以作为 Phase 3 的底层输入能力暂时冻结。

## 阶段目标

验证 Question Metadata Pattern Library 能够稳定生成诊断所需的结构化题目元数据。

核心关注点：

- 能识别常见阅读题型。
- 能生成稳定的 `questionType`。
- 能生成稳定的 `assessmentMode`。
- 能生成稳定的 `mainAbility`。
- 能生成可供 Diagnosis 使用的 `rubric`。
- 能通过 validator。
- 能进入 Diagnosis 链路。

## 输入

- 真实阅读题题干
- 参考答案
- 学生答案
- Question Metadata benchmark samples

## 输出

- Question Metadata
- Validation Result
- Matched Pattern
- Debug Benchmark Report

## 涉及能力

- `src/ai/patterns/questionMetadataPatterns.ts`
- `src/ai/agents/questionMetadataAgent.ts`
- `src/ai/schemas/questionMetadata.schema.ts`
- `src/ai/tests/questionMetadata.samples.ts`
- `src/ai/tests/runQuestionMetadataDebug.ts`
- npm script: `debug:question-metadata`

## 验收方式

运行：

```bash
pnpm run debug:question-metadata
pnpm run build
```

## 验收标准

通过条件：

1. Overall PASS Rate >= 90%。
2. Each Type PASS Rate >= 85%。
3. Validator Fail = 0。
4. Crash Count = 0。
5. Metadata Missing Fields = 0。
6. Diagnosis Unreachable = 0。

## 当前验收结果

- 验收日期：2026-07-08
- 验收结果：PASS / Frozen

## 当前通过依据

`pnpm run debug:question-metadata` 结果：

```text
Total: 41
PASS: 41
FAIL: 0
PASS Rate: 100%
Low Confidence (< 75%): 0
Validator Fail: 0
QuestionType Errors: 0
AssessmentMode Errors: 0
MainAbility Errors: 0
Pattern Errors: 0
Diagnosis Unreachable: 0
Crash Count: 0
Metadata Missing Fields: 0
Gate Result: PASS
```

`pnpm run build` 通过。

## 本次验收前修正

验收前发现一个边界问法：

```text
说说你对某句话的理解
```

该题原本未命中 `sentence_meaning_v1`，而是进入默认阅读简答 Pattern，导致 `句子含义` 类型通过率为 83%，低于验收门槛 85%。

本次已对 `sentence_meaning_v1` 增补最小 matcher：

```text
对……这句/这句话/某句……理解
```

修正后 `句子含义` benchmark 6 / 6 通过。

## 冻结说明

Phase 2.2 暂时冻结。

冻结含义：

- 不继续扩展更多题型。
- 不继续追求 Question Metadata 百分百覆盖。
- 不接入数据库。
- 不做完整题库系统。
- 不把 Phase 2 作为当前产品主线。

后续只在 Phase 3 主线需要时，对 Question Metadata 做最小维护。

## 与 Phase 3 的关系

Phase 2.2 为 Phase 3 提供底层输入能力：

```text
Question
-> Question Metadata
-> Diagnosis
-> Ability Evidence
```

Phase 3 的核心不再是题目元数据本身，而是：

```text
发现薄弱点
-> 制定训练计划
-> 执行训练
-> 复测验证
-> 更新能力证据
```

## 本阶段不包含

- 不证明学生能力提升。
- 不生成阶段训练计划。
- 不产生 Ability Evidence。
- 不做 Training Evidence / Retest Evidence。
- 不做长期成长曲线。

这些能力由 Phase 3.1、Phase 3.2、Phase 3.3 承担。
