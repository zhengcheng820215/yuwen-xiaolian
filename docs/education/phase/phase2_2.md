# Phase 2.2：Question Metadata 验收与冻结记录

## 一、阶段定位

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

## 二、阶段目标

验证 Question Metadata Pattern Library 能够稳定生成诊断所需的结构化题目元数据。

核心关注点：

- 能识别常见阅读题型。
- 能生成稳定的 `questionType`。
- 能生成稳定的 `assessmentMode`。
- 能生成稳定的 `mainAbility`。
- 能生成可供 Diagnosis 使用的 `rubric`。
- 能通过 validator。
- 能进入 Diagnosis 链路。

## 三、输入与输出

### 输入

- 真实阅读题题干
- 参考答案
- 学生答案
- Question Metadata benchmark samples

### 输出

- Question Metadata
- Validation Result
- Matched Pattern
- Debug Benchmark Report

## 四、涉及能力

- `src/ai/patterns/questionMetadataPatterns.ts`
- `src/ai/agents/questionMetadataAgent.ts`
- `src/ai/schemas/questionMetadata.schema.ts`
- `src/ai/tests/questionMetadata.samples.ts`
- `src/ai/tests/runQuestionMetadataDebug.ts`
- npm script: `debug:question-metadata`

## 五、验收方式

运行：

```bash
pnpm run debug:question-metadata
pnpm run build
```

## 六、验收标准

通过条件：

1. Overall PASS Rate >= 90%。
2. Each Type PASS Rate >= 85%。
3. Validator Fail = 0。
4. Crash Count = 0。
5. Metadata Missing Fields = 0。
6. Diagnosis Unreachable = 0。

## 七、当前验收结果

- 验收日期：2026-07-08
- 验收结果：PASS / Frozen

### 当前通过依据

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

## 八、本次验收前修正

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

## 九、冻结版本

- 冻结日期：2026-07-08
- 冻结状态：PASS / Frozen
- Benchmark 样本数：41
- Pattern Library 版本：v1
- Metadata Contract 状态：Stable
- 下游消费方：Diagnosis Agent / Phase 3.1 Ability Evidence

冻结版本说明：

```text
Question
-> Question Metadata Pattern Library v1
-> Metadata Validator
-> Diagnosis Agent
-> Ability Evidence
```

Phase 2.2 冻结的是当前 Question Metadata Pattern Library v1 的底层能力，而不是所有真实题目的最终覆盖能力。

## 十、冻结说明

Phase 2.2 暂时冻结。

冻结含义：

- 不继续扩展更多题型。
- 不继续追求 Question Metadata 百分百覆盖。
- 不接入数据库。
- 不做完整题库系统。
- 不把 Phase 2 作为当前产品主线。

后续只在 Phase 3 主线需要时，对 Question Metadata 做最小维护。

## 十一、冻结后允许维护条件

Phase 2.2 冻结后，只有以下情况允许修改 Question Metadata 能力：

1. Phase 3 发现某类真实题无法进入 Diagnosis。
2. Metadata 缺字段或字段不稳定，影响 Ability Evidence 生成。
3. 某个 Pattern 明显误匹配，导致 Diagnosis 方向错误。
4. 新增 Benchmark 回归导致 Acceptance Gate 失败。
5. Phase 3 明确需要新增一个稳定字段，并确认该字段属于 Metadata Contract，而不是临时题目需求。

维护原则：

- 必须优先补 Benchmark，再调整 Pattern。
- 必须确认修改不会破坏已冻结的 41 条 Benchmark。
- 必须保持 Metadata Schema 稳定，除非新增字段已经被确认为长期 Metadata Contract。
- 修改应服务 Phase 3 主线，而不是重新开启 Phase 2 的题型扩张。

## 十二、冻结后禁止事项

冻结后不允许：

1. 为单道题硬编码 Pattern。
2. 为提高单个样例通过率随意扩展 Metadata 字段。
3. 在 Diagnosis Agent 中重新解释 Question。
4. 让 Training Agent 依赖原始题目文本来弥补 Metadata 缺陷。
5. 在没有新增 Benchmark 的情况下修改 Pattern 匹配逻辑。

特别说明：

```text
Diagnosis Agent 不重新解释 Question。
```

如果 Metadata 错误，应回到 Phase 2.1 / Phase 2.2 修复 Pattern Library，而不是让下游 Agent 绕过 Metadata 重新判断题目意图。

## 十三、与 Phase 3 的关系

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

Phase 3 只消费 Metadata，不重新解释 Question。

Phase 3 如发现 Metadata 不能支撑 Diagnosis，应将问题反馈到 Phase 2 的 Pattern Library 维护流程。

## 十四、本阶段不包含

- 不证明学生能力提升。
- 不生成阶段训练计划。
- 不产生 Ability Evidence。
- 不做 Training Evidence / Retest Evidence。
- 不做长期成长曲线。

这些能力由 Phase 3.1、Phase 3.2、Phase 3.3 承担。

## 十五、已知限制

Phase 2.2 当前只证明 Question Metadata Pattern Library v1 在 41 条 Benchmark 样本上通过验收。

当前不证明：

1. 能覆盖全部真实语文阅读题。
2. 能处理复杂组合题。
3. 能稳定处理多问合一题目。
4. 能处理跨学科题目。
5. 能处理学生自由上传的低质量题干。
6. Metadata 百分百准确。

这些限制不影响 Phase 2.2 冻结结论。

本阶段冻结含义是：

```text
Question Metadata Pattern Library v1
已经足够支撑 Phase 3 继续推进。
```

而不是：

```text
Question Metadata 已经覆盖所有真实题目。
```

## 十六、冻结结论

Phase 2.2 可以冻结。

冻结结论：

```text
PASS / Frozen
```

当前 Question Metadata Pattern Library v1 已经具备作为 Phase 3 底层输入能力的条件。

后续产品主线应继续推进 Phase 3 / Phase 4 / Phase 5 的能力成长 Runtime，而不是继续在 Phase 2 追求题型覆盖的无限扩张。
