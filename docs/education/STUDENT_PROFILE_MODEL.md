# 学生能力画像模型（Student Ability Profile Model）

## 文档定位

本文档是 AI 语文能力诊断与成长系统的学生能力画像模型。

本模型负责定义：

- 学生能力画像记录什么
- 长期能力状态如何保存
- Evidence 如何被引用而不是重新解释
- 状态历史如何保留
- 下一步成长需求如何表达

本文档不是成绩单，不是考试统计，不是排行榜，不是页面设计，也不是数据库设计。

本文档是一份可被 AI 调用、可被程序实现、可长期扩展的学生能力画像模型。

未来以下模块必须引用本模型：

- Ability
- Diagnosis
- Training
- Evaluation
- Question
- AI Coach

学生能力画像记录的是能力成长，不是考试成绩。

### Profile 职责边界

建议职责链：

```text
Diagnosis Result
↓
Ability Evidence
↓
Evaluation Result
↓
Profile Update Decision
↓
Student Ability Profile
```

Student Ability Profile 不创造教育事实。

它只能保存由 Evidence 和 Evaluation Runtime 已经确认或建议更新的长期能力状态。

Profile 可以：

- 保存当前长期状态；
- 引用支撑当前状态的 Evidence；
- 保存历史状态变化；
- 标记当前置信度、冲突和待验证事项；
- 向 Coach、Training 和 Task Planner 提供学生上下文。

Profile 不得：

- 根据单次 Evidence 自动升级或降级；
- 把 Root Cause Hypothesis 当作长期错因；
- 因长期没有数据自动判定退化；
- 绕过 Evaluation 宣布能力提升；
- 直接决定具体下一题。

## 一、画像模型定义（Profile Definition）

学生能力画像是系统对学生语文能力状态、能力证据和成长趋势的持续记录。

能力画像不是静态档案，而是随着诊断、训练、复测和评估持续更新的成长模型。

能力画像应回答：

- 学生当前具备哪些能力？
- 哪些能力稳定？
- 哪些能力不稳定？
- 哪些能力正在成长？
- 哪些能力需要继续训练？
- 这些判断来自哪些证据？

## 二、画像设计原则（Profile Principles）

### 1. 能力优先

画像以能力为核心，而不是以题目、分数或考试为核心。

### 2. 证据驱动

所有画像结论必须有能力证据支撑。

没有证据，不能更新能力等级、能力状态或成长趋势。

### 3. 持续记录，条件更新

每次有效学习行为都应留下记录，但长期能力状态只有在满足 Evaluation 状态转换条件时才更新。

每次都可以：

- 追加 Evidence；
- 更新最后观察时间；
- 更新待验证事项；
- 保存 Session 记录。

不一定每次都：

- 改变能力等级；
- 改变长期状态；
- 改变成长趋势；
- 宣布提升或退化。

### 4. 可解释

画像中的每个能力判断都应能说明依据。

### 5. 支持下一步行动

画像不只是记录结果，还应支持下一步诊断、训练、复测和成长需求。

Profile 表达学生当前需要什么，不直接决定具体下一题。

## 三、画像核心结构（Profile Structure）

学生能力画像应至少包含以下内容：

| 模块 | 说明 |
| --- | --- |
| 基础能力状态 | 六项一级能力的当前长期状态摘要 |
| Evidence 索引 | 支撑每项能力判断的关键 evidence 引用 |
| Recurring Issues | 反复出现且被 evidence 支持的问题模式 |
| 状态历史 | 能力状态变化的历史记录 |
| Session 索引 | 最近相关 Learning Session |
| 当前置信度 | 当前画像判断的可靠程度 |
| 数据新鲜度 | 当前状态是否仍有足够近期 evidence 支撑 |
| 下一步成长需求 | 需要训练、复测、迁移验证、保持性观察或人工复核的方向 |

Profile 不应嵌入全部 Evidence 内容。

```text
Profile = 当前可用视图
Evidence Store = 完整事实历史
```

Profile 中应保留：

- supportingEvidenceIds；
- recentEvidenceIds；
- conflictingEvidenceIds；
- representativeEvidenceIds。

更稳的核心结构：

```ts
type StudentAbilityProfile = {
  studentId: string;
  profileVersion: string;
  updatedAt: string;

  abilities: AbilityProfileItem[];

  activeGrowthNeeds: {
    abilityId: string;
    needType: string;
    evidenceLinks: string[];
    priority: 'low' | 'medium' | 'high';
  }[];

  recentSessionIds: string[];
};
```

## 四、单项能力画像（Ability Profile Item）

每一项能力都应形成独立画像。

单项能力画像建议包含：

```ts
type AbilityProfileItem = {
  abilityId: string;

  currentLevel?: 1 | 2 | 3 | 4 | 5;

  developmentStage:
    | 'not_established'
    | 'developing'
    | 'basically_stable'
    | 'stable';

  independence:
    | 'high_support'
    | 'guided'
    | 'mostly_independent'
    | 'independent';

  transferStatus:
    | 'not_tested'
    | 'not_transferred'
    | 'near_transfer'
    | 'far_transfer';

  retentionStatus:
    | 'not_tested'
    | 'short_term'
    | 'delayed_confirmed'
    | 'long_term_maintained';

  trend:
    | 'improving'
    | 'stable'
    | 'fluctuating'
    | 'declining'
    | 'insufficient_evidence';

  confidence: 'low' | 'medium' | 'high';
  dataFreshness:
    | 'current'
    | 'aging'
    | 'stale'
    | 'not_enough_recent_evidence';

  supportingEvidenceIds: string[];
  recentEvidenceIds?: string[];
  conflictingEvidenceIds: string[];
  recurringIssueIds: string[];

  latestEvaluationResultId?: string;
  lastObservedAt?: string;
  lastStateChangedAt?: string;
};
```

`currentLevel` 可以保留，但它只是长期能力成熟度的摘要表达，不是画像中唯一或最底层的状态字段。

系统内部应同时保存提示依赖、稳定性、迁移性、保持性和复杂任务表现。

说明：

本节描述长期 Student Ability Profile 的完整状态模型。当前 Phase 4.1 最小实现暂使用更小的状态集合：

```text
weak / improving / stable_positive / insufficient_evidence
```

后续进入长期画像、成长曲线或稳定性验证阶段时，再逐步映射到“未建立、成长中、基本稳定、稳定掌握、可迁移、持续保持”等完整状态。

## 五、能力证据记录（Evidence Record）

能力证据是画像更新的基础。

Profile 不直接保存所有完整 evidence。

完整事实记录应由 Evidence Store 保存。

Student Ability Profile 保存当前摘要状态和关键 evidence 引用。

Evidence 可以来自：

- 作答表现
- 错因分析
- 修正过程
- 训练表现
- 迁移任务
- 复测结果
- 长期稳定性
- 提示依赖变化

Profile 中保留：

| 字段 | 说明 |
| --- | --- |
| supportingEvidenceIds | 支撑当前状态的关键 evidence |
| recentEvidenceIds | 最近相关 evidence |
| conflictingEvidenceIds | 与当前判断存在冲突的 evidence |
| representativeEvidenceIds | 用于摘要、报告或人工复核的代表性 evidence |

具体 Evidence 类型、字段、来源、提示依赖和聚合资格由 `ABILITY_EVIDENCE_CONTRACT.md` 定义。

## 六、Recurring Issues

“常见错因”不能简单累计 Diagnosis 的 `rootCause`。

Diagnosis 中很多 rootCause 只是候选假设。

Profile 应区分：

| 类型 | 说明 |
| --- | --- |
| Observed Pattern | 反复出现的可观察表现 |
| Supported Cause Pattern | 多次 evidence 支持的原因模式 |
| Unresolved Cause | 尚未确认的候选原因 |

只有满足以下条件，才能进入长期“常见问题”：

- 多次出现；
- 来自不同任务；
- 有明确 evidence 支撑；
- 不是无效作答；
- 不是单次 Root Cause Hypothesis；
- 最近仍有现实意义。

建议结构：

```ts
type RecurringIssue = {
  issueId: string;
  abilityId: string;
  observationPattern: string;
  evidenceLinks: string[];
  occurrenceCount: number;
  status: 'candidate' | 'supported' | 'resolved' | 'recurring';
  lastObservedAt: string;
};
```

## 七、画像更新机制（Profile Update）

画像更新应遵循以下职责链：

```text
Ability Evidence
↓
Evaluation Result
↓
Profile Update Decision
↓
Student Ability Profile
```

Profile Runtime 只执行合法的 Update Decision，而不是自由理解 Evaluation 文案。

建议结构：

```ts
type ProfileUpdateDecision = {
  studentId: string;
  abilityId: string;

  action:
    | 'append_evidence_only'
    | 'update_confidence'
    | 'update_dimensions'
    | 'update_level'
    | 'request_retest'
    | 'mark_fluctuating'
    | 'human_review';

  evidenceLinks: string[];
  evaluationResultId: string;
  reason: string;

  proposedChanges?: {
    level?: number;
    developmentStage?: string;
    independence?: string;
    transferStatus?: string;
    retentionStatus?: string;
    trend?: string;
  };
};
```

画像更新不是简单覆盖。

新 evidence 必须通过 Evaluation 与历史 evidence 共同判断，避免因为单次表现导致能力状态剧烈波动。

## 八、画像状态变化（Profile Evolution）

能力画像应支持状态变化。

Profile 应保留状态历史，而不只是最新状态。

建议结构：

```ts
type AbilityStateTransition = {
  transitionId: string;
  abilityId: string;
  fromState: string;
  toState: string;
  reason: string;
  evidenceLinks: string[];
  evaluationResultId: string;
  changedAt: string;
};
```

长期成长系统不仅要回答：

```text
现在是什么状态？
```

还要回答：

```text
它是怎样变成现在这样的？
```

状态变化可以包括：

```text
未建立 -> 成长中
成长中 -> 基本稳定
基本稳定 -> 稳定掌握
稳定掌握 -> 可迁移
可迁移 -> 持续保持
```

也可能出现回落：

```text
可迁移 -> 基本稳定
稳定掌握 -> 成长中
基本稳定 -> 待训练
```

状态回落不是惩罚，而是重新诊断和训练的依据。

长期没有新数据不等于能力退化。

正确处理应为：

```text
长期没有新 evidence
-> 当前判断可信度下降
-> 触发保持性复测
```

而不是：

```text
长期没有新 evidence
-> 自动降级
```

Profile 状态还应包含：

- profileVersion；
- evaluationRuleVersion；
- lastEvaluatedAt；
- confidence；
- dataFreshness。

## 九、下一步成长需求（Growth Need）

Profile 可以表达学生当前需要什么，但不应直接决定具体任务。

建议字段：

```ts
type GrowthNeed = {
  abilityId: string;
  needType:
    | 'continue_training'
    | 'diagnostic_verification'
    | 'independent_retest'
    | 'transfer_test'
    | 'delayed_retest'
    | 'maintenance'
    | 'human_review';
  evidenceLinks: string[];
  priority: 'low' | 'medium' | 'high';
};
```

职责边界：

```text
Student Profile
-> 提供成长需求

Personalized Next Task Agent
-> 结合题目资源和近期历史生成具体任务
```

因此，“下一步建议”应更准确地表达为“下一步成长需求”。

## 十、画像输出规范（Profile Output）

标准画像输出应包含：

| 输出项 | 说明 |
| --- | --- |
| 当前能力概览 | 学生六项核心能力的整体状态 |
| 重点成长能力 | 最近阶段明显提升的能力 |
| 重点薄弱能力 | 当前最需要训练或复测的能力 |
| 关键能力证据 | 支撑能力判断的代表性证据 |
| 常见错因 | 学生近期反复出现的错因 |
| 下一步成长需求 | 后续训练、复测、迁移验证、保持性观察或人工复核需求 |

画像输出应避免只展示分数或正确率。

Profile Output 与 Profile Model 应分离。

```text
Student Ability Profile
= 长期结构化状态

Profile Summary
= 供 AI Coach、家长端和学生端使用的阶段摘要

Growth Report
= 基于 Evaluation Result 形成的阶段性表达
```

“重点成长能力”不能由 Profile 自己根据最新几条 evidence 排序，应消费 Evaluation 的阶段结论。

## 十一、本模型与其他模型关系

ABILITY_MODEL 定义画像记录的能力标准和稳定 abilityId。

DIAGNOSIS_MODEL 生成 Diagnosis Result，但不直接更新 Profile。

ABILITY_EVIDENCE_CONTRACT 定义一次表现如何保存为 evidence。

EVALUATION_MODEL 读取多条 evidence，形成 Evaluation Result 和 Profile Update Decision。

TRAINING_MODEL 为画像提供训练阶段和训练结果引用。

QUESTION_MODEL / QUESTION_METADATA_MODEL 为画像提供可追踪的能力任务来源。

AI_COACH_MODEL 可读取 Profile Summary 决定反馈、提示和训练节奏，但不应直接修改 Profile。

Personalized Next Task Agent 根据 Growth Need、题目资源和近期历史决定具体下一任务。

学生能力画像是整个系统长期成长记录的核心载体。

最终分工：

```text
Evidence Store
保存全部事实记录

Evaluation
形成长期判断和更新决策

Student Ability Profile
保存当前状态、证据索引和历史变化

Task Planner
决定下一步具体任务

Report
把结构化结论表达给用户
```

Student Ability Profile 是：

> 学生能力长期状态快照 + Evidence 索引 + 成长历史。
