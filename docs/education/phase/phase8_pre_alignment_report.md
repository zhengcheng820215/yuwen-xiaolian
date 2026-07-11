# Phase 8 前系统对齐审查报告（Pre-Phase 8 System Alignment Report）

## 一、执行摘要

本次任务只完成 Phase 8 前对齐审查，不代表 `EvaluationResult` / `ProfileUpdateDecision` 已经实现，也不代表当前 Runtime 已经完成长期成长评估能力。

审查结论：

```text
Ready for Phase 8
```

理由：

- 12 份核心模型文档已经形成统一长期语义。
- Runtime 文档已明确当前组合实现与长期标准协议的区别。
- Phase 文档已补充历史最小实现与长期协议的关系。
- `src/ai` 当前存在早期组合 Runtime 和 Profile 直接重算路径，但这些属于 Legacy-compatible，不阻塞 Phase 8。
- Phase 8.1 的最小工程入口清晰：新增 `EvaluationResult` / `ProfileUpdateDecision`，让 Profile 更新前先经过 Evaluation 层。

本次修改范围仅限文档：

- `docs/education/README.md`
- `docs/education/phase/phase8_pre_alignment_report.md`

未修改 `src` 代码，未运行 Build。

## 二、审查范围

### 文档范围

已确认存在并作为当前语义基线：

- `docs/education/ABILITY_MODEL.md`
- `docs/education/QUESTION_MODEL.md`
- `docs/education/QUESTION_METADATA_MODEL.md`
- `docs/education/DIAGNOSIS_MODEL.md`
- `docs/education/ABILITY_EVIDENCE_CONTRACT.md`
- `docs/education/WEAKNESS_RANKING_MODEL.md`
- `docs/education/TRAINING_MODEL.md`
- `docs/education/AI_COACH_MODEL.md`
- `docs/education/LEARNING_FLOW.md`
- `docs/education/EVALUATION_MODEL.md`
- `docs/education/STUDENT_PROFILE_MODEL.md`
- `docs/education/EVALUATION_CASE_SET.md`

产品与 Runtime 文档实际路径为：

- `docs/product/PRODUCT.md`
- `docs/runtime/AGENT_PROTOCOL.md`
- `docs/runtime/OPEN_RESPONSE_DIAGNOSIS_RULES.md`
- `docs/runtime/LEARNING_RUNTIME_OVERVIEW.md`
- `docs/education/README.md`
- `docs/MINIMAL_LOOP_DEVELOPMENT.md`

说明：任务原文中的 `docs/education/product/` 与 `docs/education/runtime/` 不符合当前项目实际目录。本次按实际路径审查，未新建重复目录。

### src/ai 范围

已静态审查：

- `src/ai/schemas/*`
- `src/ai/agents/*`
- `src/ai/prompts/*`
- `src/ai/tests/*`

重点文件包括：

- `src/ai/schemas/diagnosis.schema.ts`
- `src/ai/schemas/abilityEvidence.schema.ts`
- `src/ai/schemas/studentAbilityProfile.schema.ts`
- `src/ai/schemas/abilityChangeEvaluation.schema.ts`
- `src/ai/schemas/learningSession.schema.ts`
- `src/ai/schemas/retestExecution.schema.ts`
- `src/ai/agents/realAIDiagnosisAgent.ts`
- `src/ai/agents/abilityEvidenceExtractor.ts`
- `src/ai/agents/studentAbilityProfileAgent.ts`
- `src/ai/agents/abilityChangeEvaluationAgent.ts`
- `src/ai/agents/retestExecutionAgent.ts`
- `src/ai/agents/personalizedTaskExecutionAgent.ts`
- `src/ai/agents/learningSessionAgent.ts`
- `src/ai/agents/betaLearningSessionResultAgent.ts`

## 三、最新长期标准链路

当前文档体系已经统一到以下长期标准链路：

```text
DiagnosisResult
-> AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
-> PersonalizedNextTask
```

长期规则已经在核心模型与 Runtime 文档中明确：

1. 单次作答只能形成一次表现或一次 Evidence。
2. 单次 Evidence 不能直接形成长期能力结论。
3. Diagnosis 不负责更新 Student Ability Profile。
4. Ability Evidence Extractor 不负责判断长期能力提升。
5. Training / Retest Runtime 只生成训练或复测 Evidence。
6. Evaluation 负责聚合多条 Evidence。
7. EvaluationResult 负责表达证据充分性、成长层级、冲突和限制。
8. ProfileUpdateDecision 决定画像是否以及如何更新。
9. StudentAbilityProfile 只执行合法更新，不自行创造教育事实。
10. Training completed 不等于 Ability growth confirmed。
11. Session 内改善不等于长期能力提升。
12. 无效答案只能生成 `insufficient_evidence`，不能生成 weakness 或具体 rootCause。
13. rootCause 可以是 unresolved、hypothesis 或 supported，不能强行确认。
14. Top Weakness 不等于最终训练优先级。
15. 所有长期判断必须有 evidenceLinks 或等价证据引用。

## 四、当前工程实际链路

当前 Phase 1-7 工程实现仍保留多条早期最小闭环链路：

```text
QuestionMetadata
-> DiagnosisResult
-> AbilityEvidence
-> EvidenceSummary / TopWeakness
-> StudentAbilityProfile
-> PersonalizedNextTask
-> PersonalizedTaskExecution
-> LearningSessionMemory
-> RetestExecution
-> AbilityChangeEvaluation
-> BetaLearningSessionResult
```

其中部分 Runtime 是组合实现：

- `RealAIDiagnosisRuntime` 同时串联 Diagnosis、Evidence、EvidenceSummary、TopWeakness 和 Profile。
- `PersonalizedTaskExecutionAgent` 同时执行任务、调用诊断链、生成新 Evidence，并重算 Profile。
- `RetestExecutionAgent` 同时执行复测、生成 Retest Evidence、汇总 Evidence，并重算 Profile。

这些属于早期最小闭环形成的一体化实现，当前仍可运行，但长期应由 EvaluationResult / ProfileUpdateDecision 进行隔离。

## 五、Compatible 项

### Answer Validity Gate 已具备基础保护

文件：

- `src/ai/agents/openResponseRubricEvaluator.ts`
- `src/ai/agents/retestExecutionAgent.ts`

当前行为：

- 空答案、纯数字、纯占位、敷衍内容会进入 `insufficient_evidence`。
- `哈哈`、纯数字、无中文有效内容在开放题或复测 mock 中不会直接生成 weakness。

协议符合度：

- 符合“无效答案不得生成具体能力缺口”的最新规则。

风险等级：

- Low

是否阻塞 Phase 8：

- 否。

### Weakness Ranking 排除 insufficient 主排序

文件：

- `src/ai/agents/weaknessRankingAgent.ts`

当前行为：

- `rankWeaknessSummaries` 只保留 `weaknessCount > 0` 的能力项。
- `insufficientCount` 只进入 reasons，不参与薄弱主排序。

协议符合度：

- 符合 Weakness Ranking 文档。

风险等级：

- Low

是否阻塞 Phase 8：

- 否。

### LearningSessionMemory 未直接写 Profile

文件：

- `src/ai/agents/learningSessionAgent.ts`
- `src/ai/schemas/learningSession.schema.ts`

当前行为：

- 汇总多次 PersonalizedTaskExecutionSummary。
- 输出 `session_outcome` 和 `next_recommendation`。
- 不直接更新 StudentAbilityProfile。

协议符合度：

- 基本符合“Session 内改善不等于长期能力提升”。

风险等级：

- Low

是否阻塞 Phase 8：

- 否。

## 六、Legacy-compatible 项

### DiagnosisResult 仍使用早期字段

文件：

- `src/ai/schemas/diagnosis.schema.ts`

当前行为：

- `mainAbility` 使用中文自然语言。
- `rootCause` 是 string。
- `nextTraining` 仍存在。
- `abilityEvidence` 是诊断摘要字符串数组，不是正式 AbilityEvidence。

与最新协议差异：

- 长期应使用稳定 `abilityId`。
- `rootCause` 长期应支持 unresolved / hypothesis / supported。
- `nextTraining` 长期语义应为 `nextActionCandidate`。
- Diagnosis 不应输出正式 AbilityEvidence。

分类：

- Legacy-compatible

风险等级：

- Medium

是否阻塞 Phase 8：

- 否。Phase 8.1 可以通过适配器读取旧字段。

推荐处理阶段：

- Phase 8.1 增加 Evaluation/Profile 适配层。
- Phase 8+ 再逐步引入稳定 `abilityId` 和结构化 rootCause。

是否需要立即修改：

- 否。

### AbilityEvidence 缺少 vNext 字段

文件：

- `src/ai/schemas/abilityEvidence.schema.ts`

当前行为：

- 使用 `ability: string`。
- source 只有 `diagnosis | training | retest`。
- 无 `evidenceLinks`。
- 无 `independenceLevel` / `hintLevel`。
- 无 `comparison` / baseline evidence。
- `rootCause` 是 string。

与最新协议差异：

- 长期聚合应依赖 `abilityId`。
- growth 应有比较基线。
- 长期判断应有 evidenceLinks。
- 提示依赖与独立性会影响证据质量。

分类：

- Legacy-compatible

风险等级：

- Medium

是否阻塞 Phase 8：

- 否。Phase 8.1 可以先以 `id` / `taskId` / `diagnosisId` 作为最小 evidence reference。

推荐处理阶段：

- Phase 8.1：EvaluationResult 使用现有 `AbilityEvidence.id` 作为 evidenceLinks。
- Phase 8+：扩展 Evidence vNext 字段。

是否需要立即修改：

- 否。

### RealAIDiagnosisRuntime 是组合 Runtime

文件：

- `src/ai/agents/realAIDiagnosisAgent.ts`

当前行为：

```text
DiagnosisResult
-> AbilityEvidence
-> updatedEvidence
-> EvidenceSummary
-> TopWeakness
-> StudentAbilityProfile
```

与最新协议差异：

- 长期 Diagnosis Runtime 不应直接负责 Profile 更新。
- 当前实现缺少 EvaluationResult / ProfileUpdateDecision。

分类：

- Legacy-compatible

风险等级：

- Medium

是否阻塞 Phase 8：

- 否。它可以继续作为 Legacy Combined Runtime 或 Orchestrator。

推荐处理阶段：

- Phase 8.1：新增 Evaluation/Profile decision 层后，让新 Runtime 在 Profile 前消费决策。

是否需要立即修改：

- 否。

### StudentAbilityProfileAgent 直接根据 EvidenceSummary 推状态

文件：

- `src/ai/agents/studentAbilityProfileAgent.ts`

当前行为：

- `weakness + growth -> improving`
- `weakness -> weak`
- `positive/growth -> stable_positive`
- 直接生成 `continue_training_focus` 和 `next_step_recommendation`

与最新协议差异：

- 长期应消费 EvaluationResult / ProfileUpdateDecision。
- 单条 positive/growth 可能被归入 `stable_positive`，语义偏强。
- 缺少“只追加证据、不更新状态”的 ProfileUpdateAction。

分类：

- Legacy-compatible

风险等级：

- High

是否阻塞 Phase 8：

- 不阻塞进入 Phase 8，但这是 Phase 8.1 的首要接入点。

推荐处理阶段：

- Phase 8.1 必须在它前面增加 `ProfileUpdateDecision`。

是否需要立即修改：

- 否，但 Phase 8.1 必须处理。

### AbilityChangeEvaluation 是早期 EvaluationResult

文件：

- `src/ai/schemas/abilityChangeEvaluation.schema.ts`
- `src/ai/agents/abilityChangeEvaluationAgent.ts`

当前行为：

- 消费 before / training / retest evidence。
- 输出 `change_status`、`confidence`、`next_decision`、`validation`。
- 具备 evidence sufficiency 的基础判断。
- 不直接修改 Profile。

与最新协议差异：

- 名称仍是 `AbilityChangeEvaluation`。
- `evidence_basis` 是字符串，不是结构化 evidenceLinks。
- 不输出 ProfileUpdateDecision。
- change_status 仍偏单轮能力变化判断，不是完整长期 EvaluationResult。

分类：

- Legacy-compatible

风险等级：

- Medium

是否阻塞 Phase 8：

- 否。可以作为 Phase 8.1 EvaluationResult 的适配来源。

推荐处理阶段：

- Phase 8.1 用 adapter 包装为 EvaluationResult。
- Phase 8+ 再考虑统一命名。

是否需要立即修改：

- 否。

## 七、Phase 8 blocker

本次审查未发现必须在 Phase 8 前立即修复的代码 blocker。

但 Phase 8.1 必须新增最小 Evaluation / Profile Decision 层，否则 Phase 8 的持久化会把早期 Profile 直接重算路径固化为长期架构。

必须在 Phase 8.1 处理的阻塞性缺口：

1. 缺少 `EvaluationResult` schema。
2. 缺少 `ProfileUpdateDecision` schema。
3. 缺少从 AbilityEvidence[] 生成 EvaluationResult 的最小 Runtime。
4. 缺少根据 EvaluationResult 生成 ProfileUpdateDecision 的最小 Runtime。
5. StudentAbilityProfile 更新前没有强制经过 ProfileUpdateDecision。

这些不是当前 Phase 1-7 的 blocker，但会阻塞 Phase 8 长期学习历史的正确建模。

## 八、Future refactor

以下事项长期应优化，但不阻塞 Phase 8：

1. `ability` 从中文自然语言迁移到稳定 `abilityId`。
2. `rootCause: string` 迁移到结构化 rootCause。
3. `nextTraining` 迁移到 `nextActionCandidate`。
4. AbilityEvidence 增加 `evidenceLinks`、`independenceLevel`、`hintLevel`、`comparison`。
5. RetestExecutionResult 去除直接 Profile 重算，改为输出 Evaluation 输入。
6. PersonalizedTaskExecutionAgent 由组合实现逐步拆成 Orchestrator + 单职责 Agent。
7. TrainingEvidenceLoop 中的 `abilityChange` 改为只表达训练/复测证据变化，不表达长期能力提升。
8. StudentAbilityProfile 增加 update history、待验证状态、confidence 和 append-only 决策能力。

## 九、AbilityChangeEvaluation 当前职责分析

当前 `AbilityChangeEvaluation` 实际承担：

- 证据分组：before / training / retest。
- 目标能力一致性过滤。
- 变化状态判断：`likely_improved`、`not_transferred`、`still_weak`、`needs_more_evidence`、`ready_to_switch_ability`。
- 下一步学习建议：continue / retest / switch / collect more evidence。
- 置信度估计。
- 基础 validation。

它没有承担：

- 正式长期 StudentAbilityProfile 更新。
- ProfileUpdateDecision。
- 长期多 Session 统计。
- 完整 evidenceLinks 结构。

判断：

```text
AbilityChangeEvaluation 可作为 Phase 8.1 的 EvaluationResult 兼容输入。
```

建议：

- 保留 `AbilityChangeEvaluation`。
- 不删除、不重命名。
- 新增 adapter：

```text
AbilityChangeEvaluation
-> EvaluationResult
-> ProfileUpdateDecision
```

## 十、Phase 8.1 最小接入建议

Phase 8.1 目标限定为：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

### 建议新增位置

1. `EvaluationResult` schema：

```text
src/ai/schemas/evaluationResult.schema.ts
```

2. `ProfileUpdateDecision` schema：

```text
src/ai/schemas/profileUpdateDecision.schema.ts
```

3. Evaluation Runtime 入口：

```text
src/ai/agents/evaluationAgent.ts
```

4. Profile Decision Runtime：

```text
src/ai/agents/profileUpdateDecisionAgent.ts
```

### 哪个现有 Runtime 应消费 ProfileUpdateDecision

最小接入点：

- `studentAbilityProfileAgent.ts`

建议不要马上重构所有调用方，而是新增一个 wrapper：

```text
generateStudentAbilityProfileWithDecision(...)
```

它消费：

- `AbilityEvidence[]`
- `EvaluationResult`
- `ProfileUpdateDecision`
- 现有 `generateStudentAbilityProfile(...)`

### 可继续保留的旧类型

- `AbilityChangeEvaluation`
- `DiagnosisResult`
- `AbilityEvidence`
- `EvidenceSummary`
- `TopWeakness`
- `StudentAbilityProfile`
- `LearningSessionMemory`
- `RetestExecutionResult`
- `BetaLearningSessionResult`

### 是否需要适配器

需要。

建议适配器：

```text
AbilityChangeEvaluationAdapter
LegacyProfileDecisionAdapter
EvidenceLinksAdapter
```

### Phase 8.1 最小代码改动范围

建议只新增：

- 2 个 schema
- 1 个 evaluation agent
- 1 个 profile update decision agent
- 1 个 debug runner
- 1 组 mock evidence
- 1 个 package script

暂不修改：

- 现有 Phase 1-7 debug runner
- 现有页面
- `AbilityChangeEvaluation`
- `RealAIDiagnosisRuntime`
- `RetestExecutionAgent`
- `PersonalizedTaskExecutionAgent`

### 建议新增测试 / Debug

新增：

```text
pnpm run debug:evaluation-profile-decision
```

必须保持通过的现有 Debug：

- `debug:ability-evidence`
- `debug:student-profile`
- `debug:real-ai-diagnosis`
- `debug:personalized-next-task`
- `debug:personalized-task-execution`
- `debug:learning-session`
- `debug:retest-execution`
- `debug:ability-change-evaluation`
- `debug:beta-learning-session-result`

## 十一、Phase 8 前验收门槛判断

### 文档层

状态：

```text
PASS
```

依据：

- 核心模型语义一致。
- Agent Protocol 已对齐。
- Open Response Diagnosis Rules 已对齐。
- Learning Runtime Overview 已区分当前实现与长期协议。
- README 已补充 Knowledge / Runtime / Phase 关系和长期链路说明。
- Phase 文档冲突已分类并补充长期协议关系。

### 工程层

状态：

```text
PASS WITH LEGACY-COMPATIBLE GAPS
```

依据：

- `src/ai` 风险已扫描。
- Diagnosis 无效输入风险已定位，当前已有基础保护。
- Profile 直接更新路径已定位。
- AbilityChangeEvaluation 使用范围已定位。
- Session / Retest 越权风险已定位。
- Phase 8.1 接入位置已明确。
- 当前代码没有被重构。
- 现有 Debug / Build 状态未被本次任务改变。

## 十二、最终结论

```text
Ready for Phase 8
```

但 Phase 8.1 必须首先完成最小 Evaluation / Profile Decision 接入：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

不要在 Phase 8.1 中提前做：

- 完整 Stage Report
- 多学生支持
- 数据库迁移
- 全面重命名
- 全部 Runtime 拆分
- 页面全面改版
- 复杂 LLM 评估
- 完整长期成长算法

## 十三、执行确认

本次任务只完成 Phase 8 前对齐审查。

本次任务不代表 `EvaluationResult` / `ProfileUpdateDecision` 已经实现。

本次任务不代表当前 Runtime 已经完成长期成长评估能力。

修改过的文件：

- `docs/education/README.md`
- `docs/education/phase/phase8_pre_alignment_report.md`

确认未修改：

- `src/**`
- Runtime 代码
- Schema 代码
- Debug 代码
- 页面代码
- 数据库

确认未运行：

- `pnpm run build`
- 完整测试套件

本次仅执行静态审查、grep 检查和文档补充。
