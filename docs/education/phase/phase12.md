# Phase 12：单学生可持续学习基础（Single-Student Usable Learning Foundation）

## 一、阶段定位

Phase 12 的目标是让 Phase 11 已经成立的学生端一轮最小体验，具备持续使用的基础。

Phase 11 已经证明：

```text
学生可以进入任务
-> 看懂题目
-> 作答提交
-> 获得反馈
-> 看懂本轮结果
-> 知道下一步方向
```

但 Phase 11 仍主要依赖 Demo Runtime 和临时数据。

Phase 12 不新增新的教育智能。

Phase 12 解决的是：

```text
学生能否不依赖 Debug 和临时数据，
使用真实题目连续完成多轮学习，
并在退出或刷新后保留学习结果。
```

## 二、一句话定义

Phase 12 是单学生可持续学习基础。

它验证：

```text
学习结果能保存；
真实题目能进入 Runtime；
上一轮结果能驱动下一轮学习。
```

## 三、核心问题

Phase 12 只回答三个核心问题：

1. 学习过程能不能保存和恢复？
2. 真实题目能不能结构化进入现有 Runtime？
3. 学生能不能连续完成多轮学习？

这三个问题共同决定系统是否从：

```text
Student Experience Alpha
```

进入：

```text
Single-Student Usable Foundation
```

## 四、阶段目标链路

Phase 12 的目标链路：

```text
真实题目
↓
TaskResource / ConcreteLearningTask
↓
LearningRound
↓
StudentResponse
↓
StudentLearningFeedback
↓
StudentRoundSummary
↓
GrowthMemory
↓
保存
↓
恢复
↓
下一轮 LearningRound
```

Phase 12 的核心不是把页面做复杂。

Phase 12 的核心是：

```text
每一轮学习结果都能成为下一轮学习的真实输入。
```

## 五、与 Phase 8 / 9 / 10 / 11 的关系

### Phase 8

Phase 8 负责：

```text
Evaluation
ProfileUpdateDecision
GrowthMemory
NextLearningStrategy
TaskRequest
TaskFulfillment
```

Phase 12 不重新实现 Phase 8。

Phase 12 需要保存和恢复 Phase 8 产生的正式结果。

### Phase 9

Phase 9 负责：

```text
真实任务执行
StudentResponse
TaskExecutionResult
AbilityEvidence 回流
```

Phase 12 不重新实现 Phase 9。

Phase 12 需要让 Phase 9 的执行结果可以长期保留。

### Phase 10

Phase 10 负责：

```text
LearningRound 编排
```

Phase 12 不重新实现 Phase 10。

Phase 12 需要让 LearningRound 可以被保存、恢复，并继续进入下一轮。

### Phase 11

Phase 11 负责：

```text
学生端一轮最小体验
```

Phase 12 不重做 Phase 11。

Phase 12 让 Phase 11 的体验从单次 Demo 变成可持续使用基础。

## 六、Phase 12 拆分

Phase 12 拆为三个最小闭环。

### Phase 12.1：学习回合持久化与恢复

核心问题：

```text
学生完成的一轮学习，刷新或重新进入后还能不能恢复？
```

最小链路：

```text
LearningRound
StudentResponse
StudentLearningFeedback
StudentRoundSummary
GrowthMemory
↓
保存
↓
重新进入
↓
恢复当前学习状态
```

Phase 12.1 证明：

```text
学习结果不再只存在于当前页面生命周期中。
```

### Phase 12.2：真实题目输入与任务准备

核心问题：

```text
真实题目能否以完整、可追溯、可执行的结构进入 Runtime？
```

最小链路：

```text
Raw Question Input
↓
TaskResourceDraft
↓
Resource Validation
↓
TaskResource
↓
Phase 8 TaskFulfillment
↓
ConcreteLearningTask
```

真实录入的是可复用资源，不是一次性页面题目对象。

第一版可以录入：

```text
阅读材料
↓
题干
↓
作答要求
↓
参考答案 / 评分依据 / Rubric
↓
目标能力
↓
题型
↓
来源信息
```

Phase 12.2 不做大型题库。

它只证明真实题目能够进入现有 Runtime。

Phase 12.2 不得绕过 `TaskFulfillment` 直接生成不可复用的页面题目。

### Phase 12.3：连续多轮学习运行

核心问题：

```text
上一轮学习结果能否影响下一轮学习？
```

最小链路：

```text
Round 1
↓
Evidence 回流
↓
GrowthMemory 更新
↓
NextLearningStrategy
↓
Round 2
↓
再次回流
↓
Round 3 或正常结束
```

Phase 12.3 证明：

```text
系统不只是能完成一轮，
而是能持续运行多轮。
```

Phase 12.3 必须避免“伪连续多轮”。

连续做多道题不等于连续学习系统成立。

Phase 12.3 必须证明：

```text
Round 1 的正式结果
↓
保存后的 GrowthMemory / Profile
↓
Round 2 的 NextLearningStrategy / TaskRequest
```

存在可追溯关系。

即使 Round 2 继续选择相同能力，也必须能说明：

```text
这是基于上一轮状态继续训练，
而不是重新使用固定 Mock。
```

Phase 12.3 的详细数据契约、轮次交接规则、持久化幂等要求和验收标准见：

```text
docs/education/phase/phase12_3.md
```

Phase 12.3 进一步明确：

- 多轮运行的 `completed` 只表示计划内 Runtime 正常结束，不代表能力目标已经完成；
- 结束原因必须通过 `endReason` 单独记录；
- 轮次交接类型必须来自正式 Strategy / TaskRequest，不由 Orchestrator 猜测；
- 回合完成后若持久化失败，只允许重试保存，不得重新运行 Diagnosis 或 Evidence 回流。

Phase 12.3 当前工程状态（2026-07-14）：

```text
Docs   READY
Debug  PASS（8 / 8）
Build  PASS
Demo   PASS
Phase  PASS
```

Phase 12.3 轻量 Demo 已证明三轮固定样例可以完成真实作答、草稿恢复、正式结果保存、跨轮状态消费和正常结束。三轮属于同一目标能力下的不同情境；重新开始会重复相同三题，因此本次通过不代表题库轮换或自动出题能力。

至此 Phase 12.1、12.2、12.3 的最小闭环均已完成验收，Phase 12 已具备总体验收与冻结条件。正式冻结仍应由独立的 Phase 12 Acceptance Summary 记录。

## 七、数据保存原则

Phase 12 必须区分：

```text
Runtime 正式数据
!=
页面展示状态
```

可以保存：

- studentId；
- LearningRound；
- ConcreteLearningTask；
- StudentResponse；
- ResponseValidityResult；
- TaskExecutionResult；
- TaskEvidenceReturnResult；
- StudentLearningFeedback；
- StudentRoundSummary；
- GrowthMemoryRecord；
- GrowthMemorySummary；
- StudentAbilityProfile；
- 本地恢复所需的最小视图状态。

不应直接保存：

- 整个 React state；
- 临时组件状态；
- 未清洗的模型原始输出；
- Prompt 全文；
- 开发者调试 JSON 作为正式学习记录；
- 无效作答生成的能力结论。

正式持久化对象必须包含最小元数据：

```ts
type PersistedRecordMeta = {
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
  sourceVersion?: string;
};
```

Phase 12 不要求建设复杂迁移系统。

但必须做到：

- 读取旧数据时能识别版本；
- 版本不兼容时明确阻断；
- 不能静默误读旧字段。

## 八、Phase 12 最小技术边界

Phase 12 第一版可以使用本地持久化。

允许：

- localStorage 作为少量入口和恢复指针；
- IndexedDB 作为正式结构化学习数据仓库；
- 轻量本地存储封装；
- 单学生本地数据；
- mock studentId。

暂不要求：

- 云端数据库；
- 登录账号；
- 多设备同步；
- 家长端；
- 权限系统；
- 加密同步；
- 服务端 API。

但即使使用本地持久化，也必须保持结构化数据边界。

### localStorage 与 IndexedDB 分工

`localStorage` 仅适合保存：

- currentStudentId；
- currentLearningRoundId；
- 是否存在未完成回合；
- 最近恢复指针；
- 少量 UI 偏好。

`localStorage` 不适合保存：

- 多轮完整对象；
- 阅读材料；
- 学生长答案；
- Evidence；
- GrowthMemory；
- StudentAbilityProfile 历史；
- TaskResource。

正式学习记录应优先使用：

```text
IndexedDB
或
统一持久化 Repository
```

### Repository 边界

页面不应直接调用：

```text
localStorage.setItem(...)
indexedDB.open(...)
```

Phase 12 应引入统一持久化边界：

```text
Runtime / Application Service
↓
Repository Interface
↓
IndexedDB Adapter
```

第一版可以只有一个：

```text
LearningPersistenceRepository
```

后续可拆分为：

```text
LearningRoundRepository
StudentProfileRepository
GrowthMemoryRepository
TaskResourceRepository
```

Repository 的目标不是增加复杂度，而是避免页面和 Runtime 被具体存储实现绑死。

## 九、体验优化边界

Phase 12 可以伴随必要体验优化。

允许修复：

- 刷新后丢失结果；
- 未完成回合无法恢复；
- 下一步入口不明确；
- 真实题目录入后无法追溯；
- 多轮之间状态不清楚；
- 学生不知道当前是第几轮。

不建议在 Phase 12 做：

- 商业级 UI 打磨；
- 完整课程导航；
- 复杂奖励系统；
- 家长报告；
- 长期成长曲线；
- 多学生管理。

体验优化必须依附真实 Runtime 问题。

## 十、Phase 12 总体验收标准

Phase 12 完成时，应能证明：

1. 学生完成的一轮学习可以被保存；
2. 刷新或重新进入后可以恢复学习状态；
3. 至少一个真实题目可以结构化进入 Runtime；
4. 真实题目可以生成可执行任务；
5. 学生可以完成至少两轮连续学习；
6. 第一轮结果可以影响第二轮策略或任务；
7. 多轮结果可以继续沉淀为 GrowthMemory；
8. Round 2 的策略或任务可以追溯到 Round 1 的正式结果；
9. 不因恢复造成重复 Evidence、重复 Profile 更新或重复 GrowthMemory 写入；
10. 学生端不会暴露 Runtime 原始字段；
11. Debug 可重复运行；
12. Build 通过。

## 十一、本阶段不做

Phase 12 不做：

- 不做正式账号系统；
- 不做云端同步；
- 不做多学生管理；
- 不做家长端；
- 不做大型题库；
- 不做自动无限出题；
- 不做截图识别；
- 不做教材批量导入；
- 不做长期成长报告；
- 不做商业化 UI。

## 十二、阶段完成定义

Phase 12 完成时，系统应从：

```text
Student Experience Alpha
```

进入：

```text
Single-Student Usable Learning Foundation
```

也就是：

```text
一个学生可以使用真实题目，
完成多轮学习，
学习结果能够保存、恢复和继续驱动下一轮。
```

这仍然不是正式 Beta。

正式 Beta 需要在 Phase 12 之后继续验证：

- 真实题目覆盖；
- 诊断质量稳定性；
- 多天使用体验；
- 数据安全；
- 账号与同步；
- 长期效果观察。
