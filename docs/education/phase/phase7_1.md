# Phase 7.1：Student Learning Entry 最小闭环

## 一句话定义

让学生从一个真实入口开始一次学习 Session，并完成第一道题的作答与诊断，生成本次 Session 的初始能力状态和学生可读反馈。

## 阶段背景

Phase 1-6 已经完成多个 Runtime 最小闭环：

```text
Question Metadata
-> Diagnosis
-> Ability Evidence
-> Student Ability Profile
-> Personalized Next Task
-> Task Execution
-> Learning Session Memory
-> Retest
-> Ability Change Evaluation
```

这些闭环已经证明各个 Runtime 节点可以独立运行、独立 Debug、独立验收。

但目前系统仍主要停留在 Debug / Demo Runtime。

Phase 7 开始进入 Beta Learning Flow，即让真实学生能够从一个入口开始使用系统。

Phase 7.1 是 Beta Flow 的入口层，不做完整学习闭环，只验证：

> 一个学生能不能从统一入口开始一次学习，并完成第一道题诊断？

## 阶段目标

建立 Student Learning Entry 最小闭环：

```text
Start Learning
-> Create Learning Session
-> Input / Select Question
-> Student Answer
-> Diagnosis Runtime
-> Ability Evidence
-> Student Ability Profile
-> Initial Session State
```

本阶段要证明：

- 系统可以从一个真实学习入口创建一次学习 Session。
- 学生可以完成一道题。
- 学生答案可以进入 Diagnosis Runtime。
- Diagnosis Result 可以生成 Ability Evidence。
- Ability Evidence 可以更新 Student Ability Profile。
- 系统可以生成本次 Session 的初始状态。
- 页面可以用学生可读语言说明当前表现和下一步。

## 核心问题

Phase 7.1 只回答一个问题：

> 一个学生能不能从统一入口开始一次学习，并完成第一道题诊断？

它不是完整 Beta Flow。

它不处理个性化训练、复测、能力变化判断或长期成长报告。

## 最小闭环

Phase 7.1 的最小链路为：

```text
Start Learning
-> Create session_id
-> Read question
-> Read studentAnswer
-> Run Diagnosis Runtime
-> Generate newAbilityEvidence
-> Merge updatedEvidence
-> Generate StudentAbilityProfile
-> Generate LearningEntryResult
-> Generate student-facing feedback
-> Debug / Demo Validation
```

## 输入

Phase 7.1 输入包括：

- `studentId`
- `question`
- `referenceAnswer`
- `studentAnswer`

可选输入：

- `questionMetadata`
- `previousEvidence`

说明：

- `question` 可以先使用 mock 真实阅读题；
- `studentAnswer` 由页面输入；
- `previousEvidence` 可以先使用 mock 或空数组；
- `referenceAnswer` 用于 Diagnosis Runtime，不应直接展示给学生。

## 输出

Phase 7.1 输出 `LearningEntryResult`。

它的作用是记录一次学习 Session 的起点。

建议结构：

```ts
export type LearningEntryStudentFeedback = {
  title: string;
  summary: string;
  next_step: string;
};

export type LearningEntryResult = {
  session_id: string;

  student_id: string;

  question: string;

  student_answer: string;

  diagnosis_result: DiagnosisResult;

  new_ability_evidence: AbilityEvidence;

  updated_evidence: AbilityEvidence[];

  student_ability_profile: StudentAbilityProfile;

  initial_target_ability: string;

  next_step_hint: string;

  student_feedback: LearningEntryStudentFeedback;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

## 字段说明

| 字段 | 含义 |
| --- | --- |
| `session_id` | 本次学习 Session ID |
| `student_id` | 学生 ID |
| `question` | 本次入口题目 |
| `student_answer` | 学生本次作答 |
| `diagnosis_result` | 第一题诊断结果 |
| `new_ability_evidence` | 本次诊断生成的新能力证据 |
| `updated_evidence` | 合并历史证据后的能力证据池 |
| `student_ability_profile` | 基于 updatedEvidence 生成的学生能力画像 |
| `initial_target_ability` | 本次 Session 初始关注能力 |
| `next_step_hint` | 下一步动作提示 |
| `student_feedback` | 面向学生的可读反馈 |
| `validation` | Runtime 结构校验结果 |

## Student-facing Feedback 规则

Phase 7.1 开始必须输出学生可读反馈。

内部结构可以包含：

```text
answerStatus = partially_meets
evidenceType = weakness
confidence = 0.72
```

但学生可见反馈不应直接展示这些字段。

学生应看到类似：

```text
本题主要训练：推理能力

你已经能说出大致意思，但答案里缺少文本依据。

下一步建议：
先练习“从文本中找到依据，再推出结论”。
```

`student_feedback` 至少包含：

- `title`
- `summary`
- `next_step`

要求：

1. `title` 应说明本题主要训练什么能力。
2. `summary` 应用学生能理解的语言解释当前表现。
3. `next_step` 应说明下一步该怎么做。
4. 不向学生直接展示 `evidenceType / source / confidence / raw JSON`。
5. 开发者调试信息可以放入折叠区域。
6. `student_feedback` 不应照搬 `DiagnosisResult` 字段名，而应转换为自然语言。
7. `student_feedback` 应能脱离 JSON 独立被学生理解。

## 学生主体验与开发者调试边界

Phase 7.1 的页面需要区分两类信息：

### 学生主体验区

学生主体验区只展示学生能理解、能行动的信息。

允许展示：

- 本题主要考察能力；
- 学生当前表现；
- 主要问题；
- 下一步建议；
- 简短鼓励或提示。

不应展示：

- `evidenceType`
- `source`
- `confidence`
- `raw JSON`
- `DiagnosisResult` 原始字段名
- `AbilityEvidence` 原始字段名

### 开发者调试区

开发者调试区可以折叠展示 Runtime 结构数据。

允许展示：

- `diagnosisResult`
- `abilityEvidence`
- `studentAbilityProfile`
- `LearningEntryResult`

开发者调试区用于验收和排查，不作为学生主体验的一部分。

## 页面最小体验

建议新增页面：

```text
src/pages/BetaLearningEntryDemo.jsx
```

建议路由：

```text
/#/beta-learning-entry-demo
```

首页入口：

```text
开始学习 Beta
```

页面最小结构：

### 学习入口区

- 当前学习目标 / 简短说明
- 开始一次学习

### 题目区域

- 阅读文本 / 题目
- 参考答案默认不展示给学生
- `referenceAnswer` 只作为 Diagnosis Runtime 输入

### 学生作答区

- 输入答案
- 提交按钮

### 诊断反馈区

- 本题主要考察能力
- 你的当前表现
- 主要问题
- 下一步建议

诊断反馈区必须使用 `student_feedback` 或由其派生的学生可读文案。

页面不应要求学生阅读 JSON 才能理解结果。

### 系统状态区

可折叠展示：

- `diagnosisResult`
- `abilityEvidence`
- `studentAbilityProfile`
- `LearningEntryResult`

系统状态区用于开发验收，不作为学生主体验。

## 建议新增文件

```text
src/ai/schemas/learningEntry.schema.ts
src/ai/agents/learningEntryAgent.ts
src/ai/tests/runLearningEntryDebug.ts
src/pages/BetaLearningEntryDemo.jsx
```

新增脚本：

```text
debug:learning-entry
```

## 建议落地顺序

Phase 7.1 建议按以下顺序落地：

1. 新增 `learningEntry.schema.ts`。
2. 新增 `learningEntryAgent.ts`。
3. 新增 `runLearningEntryDebug.ts`。
4. 新增 `debug:learning-entry` 脚本。
5. 新增 `BetaLearningEntryDemo.jsx` 页面。
6. 增加 `/#/beta-learning-entry-demo` 路由。
7. 首页增加 `开始学习 Beta` 入口。
8. 跑通 Debug。
9. 跑通 build。

该顺序确保 Runtime 先成立，再接入页面演示。

## Learning Entry 生成规则

1. 必须创建 `session_id`。
2. 必须保留 `student_id`。
3. 必须记录 `question` 和 `student_answer`。
4. 必须调用 Diagnosis Runtime 或 mock Diagnosis Runtime。
5. 必须生成 `diagnosis_result`。
6. 必须生成 `new_ability_evidence`。
7. `new_ability_evidence.ability` 必须非空。
8. `new_ability_evidence.source` 必须合法。
9. 必须合并生成 `updated_evidence`。
10. 必须生成 `student_ability_profile`。
11. `initial_target_ability` 默认来自 `new_ability_evidence.ability` 或 `student_ability_profile.current_weakness.primary`。
12. 必须生成 `next_step_hint`。
13. 必须生成 `student_feedback`。
14. `student_feedback` 必须可被学生理解。
15. `referenceAnswer` 不得作为学生主体验内容展示。
16. 如果 Diagnosis Runtime 返回低层字段，Learning Entry 层必须转换为学生可读反馈。
17. 如果缺少 `student_feedback.title / summary / next_step`，则 `validation.passed = false`。

## Debug 最小流程

Debug 脚本应执行：

1. 创建 mock `studentId`。
2. 创建 mock `question / referenceAnswer`。
3. 创建 mock `studentAnswer`。
4. 调用 `LearningEntryAgent`。
5. 进入 Diagnosis Runtime。
6. 生成 `newAbilityEvidence`。
7. 合并 `updatedEvidence`。
8. 生成 `StudentAbilityProfile`。
9. 输出 `LearningEntryResult`。
10. 输出 PASS / FAIL。

## Debug Report 要求

Debug Report 至少展示：

```text
Learning Entry Debug Report

Input:
- studentId
- question
- studentAnswer

Diagnosis:
- mainAbility
- answerStatus
- rootCause

Ability Evidence:
- ability
- evidenceType
- source
- confidence

Student Ability Profile:
- currentWeakness
- abilityStatus
- nextStepRecommendation

Student Feedback:
- title
- summary
- next_step

Learning Entry Result:
- session_id
- initial_target_ability
- next_step_hint

PASS / FAIL
```

## 验收标准

Phase 7.1 通过条件：

1. 能从统一入口创建 `session_id`。
2. 能读取 `question`。
3. 能接收 `studentAnswer`。
4. 能调用 Diagnosis Runtime 或 mock Diagnosis Runtime。
5. 能生成 `diagnosis_result`。
6. 能生成 `new_ability_evidence`。
7. `new_ability_evidence.ability` 非空。
8. `new_ability_evidence.source` 合法。
9. `updated_evidence.length > 0`。
10. 能生成 `student_ability_profile`。
11. 能识别 `initial_target_ability`。
12. 能生成 `next_step_hint`。
13. 能生成 `student_feedback`。
14. 页面能从入口完成“题目作答 -> 诊断反馈”。
15. 页面能展示学生可读反馈。
16. 页面不依赖 JSON 才能理解结果。
17. Debug 输出 PASS。
18. `pnpm run build` 通过。

## 本阶段不做

Phase 7.1 不做：

- 不生成 Personalized Next Task；
- 不执行训练任务；
- 不生成 Learning Session Memory；
- 不生成 Retest Task；
- 不处理复测答案；
- 不生成 Ability Change Evaluation；
- 不做长期报告；
- 不做数据库；
- 不做账号系统；
- 不做正式 UI；
- 不做家长端。

Phase 7.1 只做：

```text
真实学习入口
+
第一题诊断
+
初始 Session 状态
```

## 与 Phase 7.2 的关系

Phase 7.1 输出：

- `LearningEntryResult`
- `StudentAbilityProfile`
- `updatedEvidence`
- `initialTargetAbility`

Phase 7.2 接着做：

```text
LearningEntryResult
+ StudentAbilityProfile
+ TopWeakness
-> PersonalizedNextTask
-> Task Execution
```

也就是说：

- Phase 7.1：开始学习，并完成第一题诊断；
- Phase 7.2：基于诊断结果进入个性化任务；
- Phase 7.3：完成训练、复测和本轮反馈。

## Definition of Done

Phase 7.1 完成时，应能通过一个入口证明：

```text
Start Learning
-> Student Answer
-> Diagnosis Runtime
-> Ability Evidence
-> Student Ability Profile
-> Initial Session State
```

这一条 Beta Learning Flow 的入口闭环已经跑通。

## 演示验收记录

验收结论：PASS

通过类型：Student Learning Entry 最小闭环演示验收通过。

本阶段已完成：

- `learningEntry.schema.ts`
- `learningEntryAgent.ts`
- `runLearningEntryDebug.ts`
- `debug:learning-entry`
- `BetaLearningEntryDemo.jsx`
- `/#/beta-learning-entry-demo` 路由
- 首页 `开始学习 Beta` 入口

本阶段已验证以下链路：

```text
Start Learning
-> Create session_id
-> Read question
-> Student Answer
-> Diagnosis Runtime / Phase 7.1 mock Diagnosis
-> Diagnosis Result
-> Ability Evidence
-> Student Ability Profile
-> LearningEntryResult
-> Student-facing Feedback
```

Demo 验收结果：

- 学生可以从统一入口进入学习；
- 页面可以展示题目并接收学生答案；
- 提交后可以生成诊断结果；
- 诊断结果可以生成 `new_ability_evidence`；
- `new_ability_evidence` 可以合并为 `updated_evidence`；
- `updated_evidence` 可以生成 `student_ability_profile`；
- 页面可以展示学生可读反馈；
- 页面不依赖 JSON 才能理解结果；
- 四种不同作答样例可以触发四种不同反馈：
  - 完整答案：基本达到要求；
  - 部分答案：抓住部分意思，但理由不完整；
  - 薄弱答案：未回应关键要求；
  - 空答案：证据不足，暂不能稳定判断。

Debug / Build 验收结果：

- `debug:learning-entry` 可重复运行；
- Debug 输出 PASS；
- `pnpm run build` 通过。

## 冻结边界

Phase 7.1 冻结后不继续扩展：

- 不在本阶段生成 Personalized Next Task；
- 不在本阶段执行训练任务；
- 不在本阶段生成 Learning Session Memory；
- 不在本阶段生成 Retest Task；
- 不在本阶段处理复测答案；
- 不在本阶段生成 Ability Change Evaluation；
- 不在本阶段接入数据库；
- 不在本阶段建设账号系统；
- 不在本阶段建设正式 UI。

本阶段的四类反馈用于演示和验收入口体验，不等同于真实 AI 诊断质量验收。

真实 AI 诊断质量仍由 Phase 4.3 的 Live AI Evaluation 负责。

## 阶段结论

Phase 7.1 已完成从 `Start Learning` 到第一题诊断反馈的入口闭环。

系统已经能够让学生从一个真实入口开始学习，完成第一道题作答，并得到学生可读的初始诊断反馈。

因此，Phase 7.1 可以冻结，并允许进入 Phase 7.2。

## 最终目标

Phase 7.1 的最终目标不是证明完整学习效果，而是让系统第一次具备真实学生可以进入的学习入口。

它标志着系统从：

```text
Debug / Demo Runtime
```

开始走向：

```text
Beta 可试用 Runtime
```
