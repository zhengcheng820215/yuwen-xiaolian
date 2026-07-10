# Phase 3.1：Ability Evidence Foundation

## 一、阶段背景

Phase 2 暂时冻结。

Phase 2 已完成的核心价值是建立基础链路：

```text
Question
↓
Question Metadata
↓
Diagnosis Agent
↓
Training Agent
```

这条链路已经可以支持单题诊断和单次训练方案生成。后续 Phase 2 只作为底层能力服务维护，不再以扩展题型数量、提高 Metadata Pattern 覆盖率为主线。

产品主线从 Phase 3 开始转向真实学生的长期能力成长：

```text
多次作答
↓
能力证据沉淀
↓
薄弱点排序
↓
针对训练目标
↓
复测验证
↓
能力画像更新
```

Phase 3.1 是 Phase 3 的第一步，目标不是做完整训练系统，而是先让系统能够把单次 Diagnosis Result 转换为可长期累计的 Ability Evidence，并能基于多条 Evidence 粗略发现当前最需要提升的能力。

## 二、Phase 3.1 总目标

Phase 3.1 的核心目标是：

> 建立 Ability Evidence Foundation，使单题诊断结果可以沉淀为学生长期能力成长证据。

本阶段需要回答：

1. 一条 Diagnosis Result 如何转成 Ability Evidence？
2. 多条 Ability Evidence 如何模拟一个学生连续做题后的能力表现？
3. 系统如何从 Evidence 中识别 Top 1-3 个薄弱能力？
4. 每个薄弱能力的判断是否有证据支撑？
5. 下一阶段 Training Plan 应该优先针对什么能力？

## 三、本阶段范围

### 允许开发

本阶段允许新增：

- `src/ai/schemas/abilityEvidence.schema.ts`
- `src/ai/agents/abilityEvidenceExtractor.ts`
- `src/data/studentAbilityEvidence.mock.json`
- `src/ai/tests/runAbilityEvidenceDebug.ts`
- `pnpm run debug:ability-evidence`

本阶段允许补充文档：

- `ABILITY_EVIDENCE_CONTRACT.md`
- `WEAKNESS_RANKING_MODEL.md`

### 暂不开发

本阶段不做：

- 数据库
- 完整 Student Profile UI
- 完整 Training Plan UI
- Growth Report 页面
- Evaluation Agent
- 复杂能力等级升级逻辑
- 长期真实用户数据存储

本阶段也不追求：

- 精确判断学生长期能力等级
- 完整覆盖所有题型
- 自动生成多日训练计划
- 证明能力已经真正提升

Phase 3.1 只做一件事：

> 把 Diagnosis Result 变成可累积 Evidence，并用 Evidence 发现当前薄弱点。

## 四、最小闭环

Phase 3.1 的最小闭环为：

```text
Diagnosis Result
↓
Ability Evidence Extractor
↓
Ability Evidence[]
↓
Evidence Summary
↓
Weakness Ranking
↓
Next Training Focus
```

### 输入

输入来自现有 Diagnosis Agent 的结构化结果，例如：

```ts
{
  mainAbility: '推理',
  answerStatus: 'partially_meets',
  scoreBand: 'medium',
  rootCause: '学生尚未提供充分文本依据，推理链不完整。',
  confidence: 0.68
}
```

### 输出

输出一条可长期累计的能力证据：

```ts
{
  studentId: 'demo-student',
  ability: '推理',
  evidenceType: 'weakness',
  reason: 'reasoning_error',
  detail: '学生能够给出判断，但没有说明判断来自哪些文本线索。',
  source: 'diagnosis',
  observation: '学生答案部分满足要求，但推理链或文本依据不足。',
  rootCause: '学生尚未提供充分文本依据，推理链不完整。',
  confidence: 0.68,
  createdAt: '2026-07-08T00:00:00.000Z'
}
```

多条 Evidence 聚合后，应能输出：

```text
Student Evidence Summary
------------------------
推理: weakness 3, positive 1
表达: weakness 2
概括: weakness 1

Top Weakness
------------
1. 推理 - 3 条薄弱证据
2. 表达 - 2 条薄弱证据
3. 概括 - 1 条薄弱证据
```

## 五、Evidence 类型规则

Phase 3.1 采用最小规则：

| Diagnosis 表现 | Evidence 类型 | 说明 |
| --- | --- | --- |
| `answerStatus='fully_meets'` 或 `correct=true` | `positive` | 本次作答形成正向能力证据 |
| `answerStatus='partially_meets'` | `weakness` | 学生有相关表现，但存在关键能力要点缺失 |
| `answerStatus='does_not_meet'` 或 `correct=false` | `weakness` | 本次作答暴露薄弱或不稳定表现 |
| `answerStatus='insufficient_evidence'` | `insufficient` | 答案无效或证据不足，不进入明确薄弱结论 |

注意：

- `insufficient` 不能被当作能力薄弱证据。
- 单条 `weakness` 不能直接证明长期能力薄弱。
- 多条同能力、相近 rootCause 的 `weakness` 才能提高薄弱点排序优先级。

## 六、Evidence Reason 规则

Evidence Type 描述本次能力表现状态。

Evidence Reason 描述导致该表现的主要原因。

二者需要分离：

- `evidenceType` 回答：本次表现属于正向、薄弱、成长，还是证据不足。
- `reason` 回答：为什么会形成这种表现。

最小结构：

```ts
type AbilityEvidence = {
  ability: string;

  evidenceType:
    | "positive"
    | "weakness"
    | "growth"
    | "insufficient";

  reason?:
    | "missing_skill"
    | "incomplete_understanding"
    | "reasoning_error"
    | "expression_issue"
    | "knowledge_gap"
    | "unstable_performance";

  detail: string;

  confidence: number;
};
```

Reason 类型：

| Reason | 说明 | 示例 |
| --- | --- | --- |
| `missing_skill` | 缺少完成任务需要的能力 | 不会提取关键信息 |
| `incomplete_understanding` | 理解停留表层 | 知道事件但无法理解意义 |
| `reasoning_error` | 推理链错误 | 依据正确但结论错误 |
| `expression_issue` | 表达不足 | 理解正确但答案不完整 |
| `knowledge_gap` | 知识缺失 | 不知道修辞作用 |
| `unstable_performance` | 能力表现不稳定 | 同类任务表现波动 |

使用原则：

- `reason` 不替代 `rootCause`，只提供可被程序消费的原因分类。
- `detail` 描述本次证据的具体依据，优先来自学生作答中的可观察表现。
- `rootCause` 仍保留具体自然语言解释，用于说明学生本次作答中真实发生的问题。
- `weakness` 类型证据应尽量包含 `reason`，否则后续训练目标会缺少明确依据。
- `positive` 类型证据可以不包含 `reason`，也可以在需要时标记稳定表现来源。
- `insufficient` 类型证据不应强行生成能力原因，避免把无效答案误判为能力短板。

Phase 3.1 对外最小 Evidence 结构可以理解为：

```ts
{
  ability,
  evidenceType,
  reason,
  detail,
  confidence
}
```

内部实现可以继续保留 `studentId`、`source`、`observation`、`rootCause`、`createdAt` 等字段，用于追踪、解释和兼容已有闭环。

## 七、Weakness Ranking 最小规则

Phase 3.1 的薄弱点排序只做粗粒度判断。

排序依据：

1. 同一能力的 `weakness` 数量
2. 平均置信度
3. 最近出现次数
4. 是否重复出现相近 rootCause
5. 是否缺少对应 `positive` 或 `growth` 证据

最小输出结构：

```ts
type WeaknessRankingItem = {
  ability: string;
  priority: number;
  weaknessCount: number;
  positiveCount: number;
  insufficientCount: number;
  averageConfidence: number;
  reasons: string[];
  suggestedTrainingFocus: string;
};
```

## 八、Debug 要求

新增脚本：

```bash
pnpm run debug:ability-evidence
```

Debug 输入：

- 至少 5 条模拟学生作答诊断结果
- 覆盖 `positive`、`weakness`、`insufficient`
- 至少包含 3 个能力维度

Debug 输出：

- 原始 Diagnosis Result 摘要
- 转换后的 Ability Evidence
- 按能力聚合统计
- Top 1-3 薄弱能力
- 每个薄弱能力的 evidenceCount、averageConfidence、reasons
- Suggested Next Training Focus

示例：

```text
Ability Evidence Debug Report
=============================
Total Diagnosis Results: 5
Total Evidence: 5

Evidence Summary
----------------
推理: weakness 3, positive 0, insufficient 0
表达: weakness 2, positive 1, insufficient 0
概括: weakness 1, positive 1, insufficient 1

Top Weakness
------------
1. 推理
   weaknessCount: 3
   averageConfidence: 0.72
   reason: 多次出现文本依据不足或推理链不完整。
   suggestedTrainingFocus: 文本依据提取 + 推理链表达训练
```

## 九、Phase 3.1 Definition of Done

Phase 3.1 完成标准：

- 定义 `AbilityEvidence` Schema。
- 能从一条 Diagnosis Result 生成一条 Ability Evidence。
- 能保留 `studentId`、`ability`、`evidenceType`、`source`、`observation`、`rootCause`、`confidence`、`createdAt`。
- 能生成对外最小 Evidence 字段：`ability`、`evidenceType`、`reason`、`detail`、`confidence`。
- 能用 mock evidence 模拟一个学生连续做题。
- 能按能力聚合 evidence。
- 能输出 Top 1-3 薄弱能力。
- 每个薄弱能力必须有 evidence 支撑和 reasons。
- `insufficient` 不进入薄弱排序主证据。
- Debug 脚本可重复运行。
- 不接数据库。
- 不做 UI。

## 九、与 Phase 3 后续阶段的关系

Phase 3.1 只解决：

```text
发现当前薄弱点
```

Phase 3.2 才进入：

```text
围绕薄弱点生成阶段训练计划
```

Phase 3.3 才进入：

```text
训练后复测验证和 evidence 回流
```

因此，Phase 3.1 的产物应尽量稳定、简单、可复用，为后续 Training Plan、Retest、Ability Evidence Update 和 Student Profile 提供证据基础。Growth Report 不属于 Phase 3.3 的当前范围。

## 十、最终原则

Phase 3.1 的最终原则是：

> 不急于证明学生能力已经提升，先让系统能够可靠记录“哪些能力反复暴露问题”。

只要系统能够把多次单题诊断沉淀为可解释 Evidence，并能粗略排出当前最需要训练的能力，Phase 3.1 就完成了它的阶段使命。

## 十一、当前验收记录

- 验收日期：2026-07-08
- 验收结果：PASS

## 验收方式

```bash
pnpm run debug:ability-evidence
pnpm run build
```

## 当前通过依据

`pnpm run debug:ability-evidence` 结果：

```text
Total Diagnosis Results: 6
Generated Evidence: 6
Historical Mock Evidence: 3
Total Evidence: 9
Acceptance: PASS
```

Debug 已验证：

1. 能从 Diagnosis Result 生成 Ability Evidence。
2. 能区分 `weakness`、`positive`、`insufficient`。
3. 能保留 `studentId`、`ability`、`evidenceType`、`source`、`observation`、`rootCause`、`confidence`、`createdAt`。
4. 能聚合 Ability Evidence Summary。
5. 能输出 Top Weakness。
6. 当前 Top Weakness 为：推理、表达、信息提取。
7. `insufficient` 不作为 weakness ranking 的主证据。

`pnpm run build` 通过。

## 验收边界

Phase 3.1 只验收“发现薄弱点”的最小证据闭环：

```text
Diagnosis
-> Ability Evidence
-> Evidence Summary
-> Top Weakness
```

本阶段不验收训练计划生成、训练执行、复测证据或真实长期提升。
