# Phase 12：基础全链路集成验收记录

## 一、集成目标

本次验收不新增 Phase 12.4，也不新增教育判断能力。

目标是验证 Phase 12.2、12.3 与既有 Phase 8—10 Runtime 是否真正使用同一份正式数据：

```text
TaskResource 1
-> Round 1
-> StudentResponse
-> Diagnosis
-> AbilityEvidence
-> Evaluation
-> ProfileUpdateDecision
-> GrowthMemoryRecord
-> Persistence Save
-> Persistence Restore
-> GrowthMemorySummary
-> NextLearningStrategy
-> TaskRequest
-> TaskResourceRepository Query
-> TaskResource 2
-> TaskFulfillment
-> ConcreteLearningTask
-> Round 2
```

## 二、集成范围

本次只集成：

- Phase 12.2 正式资源准备与保存；
- 共享 `TaskResourceRepository`；
- Phase 12.3 连续学习资源查询；
- Round 1 保存与恢复；
- 恢复后的 GrowthMemory / Profile 驱动 Round 2；
- Phase 8 TaskFulfillment；
- Phase 9 执行与 Evidence 回流；
- Phase 10 LearningRound；
- 幂等、追溯和异常阻断。

## 三、共享 Repository

正式资源统一通过 `TaskResourceRepository` 访问。

实现包括：

- `InMemoryTaskResourceRepository`：Debug 使用；
- `IndexedDBTaskResourceRepository`：浏览器 Demo 使用。

统一能力包括：

- 保存 Draft；
- 保存正式 Resource；
- 按 ID 读取；
- 列出正式资源；
- 按目标能力、题型和排除 ID 查询；
- 阻止相同 `resourceId` 被静默覆盖。

页面不直接读写 IndexedDB。

## 四、真实资源

本次至少准备两道同能力、不同文本的正式阅读开放题：

| Resource | 目标能力 | 文本情境 | 来源 |
|---|---|---|---|
| `phase12-real-inference-v1-001` | 推理 | 父亲整理旧书与褪色树叶 | 人工整理、可追溯 |
| `phase12-real-inference-v1-002` | 推理 | 母亲清洗并保存旧杯子 | 人工整理、可追溯 |

两道资源均经过：

```text
TaskResourceInput
-> TaskResourceDraft
-> Resource Validation
-> TaskResource
-> Repository.saveResource
```

并保留 `assessmentBasis`、`rubric`、`source`、版本和时间字段。

## 五、正常双轮验收

正常链路必须同时满足：

1. Round 1 使用 Resource 1；
2. Round 1 生成一条正式 Evidence 和一条 GrowthMemoryRecord；
3. Round 1 结果保存并恢复；
4. 恢复过程不重新运行 Diagnosis；
5. Round 2 生成新的 Strategy、TaskRequest、LearningRound 和 ConcreteTask；
6. Repository 查询排除 Resource 1；
7. Round 2 通过 TaskFulfillment 使用 Resource 2；
8. Round 2 再次生成一条正式 Evidence 和一条 GrowthMemoryRecord；
9. Round 2 能追溯到 Round 1 的 persistence record 和 growth memory；
10. 两轮所有正式 ID 唯一。

## 六、异常与幂等 Case

集成 Debug 覆盖：

1. 正常双轮链路；
2. 重复保存同一完成结果；
3. 刷新后重复恢复；
4. 重复提交同一 `responseId`；
5. 空答案或占位回答；
6. 持久化失败与仅重试保存；
7. 没有可匹配资源；
8. `studentId` 不一致；
9. Diagnosis 能力错位。

无效作答、重复响应、身份错配、资源不足和能力错位均不得产生错误 Evidence 或启动下一轮。

## 七、关键计数

正常双轮相对运行前必须满足：

| 指标 | 增量 |
|---|---:|
| AbilityEvidence | 2 |
| GrowthMemoryRecord | 2 |
| ProfileUpdateDecision 应用 | 2 |
| LearningPersistenceRecord | 2 |
| completed round | 2 |

重复保存、重复恢复或重复提交不得增加以上正式计数。

## 八、追溯要求

Round 2 必须保留：

- Round 1 `learningRoundId`；
- Round 1 `persistenceRecordId`；
- 已恢复的 GrowthMemoryRecord ID；
- 新 `nextLearningStrategyId`；
- 新 `taskRequestId`；
- Resource 2 `resourceId`；
- 新 `concreteTaskId`；
- 可解释的 `transitionType`。

## 九、PASS / FAIL 条件

只有以下条件全部成立才能 PASS：

- Phase 12.2 与 12.3 使用同一 Repository 边界；
- Resource 1、2 均从 Repository 获得；
- Round 1 保存恢复后生成 Round 2 正式策略；
- Round 2 任务来自 Resource 2；
- Diagnosis、Evidence、Profile Update、GrowthMemory 不重复；
- 异常分支正确阻断；
- 学生体验区不泄露内部 Runtime 字段；
- `debug:phase12-integration` 通过；
- Build 通过。

## 十、当前验收结果

验收日期：2026-07-14

```text
Repository shared       PASS
Resource 1 / 2 formal   PASS
Normal double round     PASS
Browser lightweight Demo PASS
Save / restore          PASS
Idempotency             PASS
Traceability            PASS
Exceptional branches    PASS
Integration Debug       9 / 9 PASS
Phase 12.2 regression   10 / 10 PASS
Phase 12.3 regression   8 / 8 PASS
Build                    PASS
```

正常双轮关键增量：

```text
AbilityEvidence              +2
GrowthMemoryRecord           +2
ProfileUpdateDecision apply  +2
LearningPersistenceRecord    +2
Completed Round              +2
```

最终结论：`PASS`

Phase 12 已满足基础全链路集成验收条件。

### Phase 12 Integrated Acceptance

验收结论：`PASS`

Phase 12.1、Phase 12.2、Phase 12.3 及基础全链路集成验收均已通过。

系统已证明：

- 正式 `TaskResource` 可以通过共享 Repository 写入和查询；
- 浏览器端使用 `IndexedDBTaskResourceRepository`，Debug 使用 `InMemoryTaskResourceRepository`；
- 页面不直接操作存储；
- 真实资源可以进入既有 TaskFulfillment 并生成可执行任务；
- Round 1 正式结果可以保存、恢复并驱动 Round 2；
- 两轮 Evidence、Profile Update、GrowthMemory 与持久化记录的写入次数符合预期；
- 重复保存、恢复、重复提交及异常分支不会污染正式数据；
- 学生体验区不暴露 Runtime 内部字段；
- 集成 Debug、冻结回归与生产构建全部通过。

产品状态：

```text
Single-Student Usable Learning Foundation
```

当前限制：

- Debug 仍使用 mock Diagnosis；
- 本阶段不证明真实 AI 诊断质量；
- 本阶段不证明教学策略有效性；
- 本阶段不证明学生能力长期提升；
- 项目 Debug 与构建需要使用项目配置的 Node 24 Runtime。

浏览器轻量 Demo 已验证：第一轮展示 Resource 1，提交后完成反馈、保存和恢复；点击“进入下一轮”后展示来自共享 Repository 的 Resource 2。学生主体验区只出现轮次、材料、题目、要求、输入、反馈和下一步入口，内部 ID 与 Runtime 对象仅保留在折叠的开发者区域。

三轮体验补充验收：`PASS`。

验收中曾在 Round 2 完成后正确触发 `no matching TaskResource` 阻断。根因不是流程失效，而是第 3 份正式文本缺少下一步策略所需的角色能力标签。修正后：

- 三份不同阅读文本均通过 Phase 12.2 正式校验；
- 每份文本按 observation / training / retest / transfer / diagnosis 提供受控角色变体；
- TaskResource 的 `taskRole`、`contentType`、`capabilities` 和 `validationTags` 保持一致；
- Repository 按 `externalResourceId` 排除已使用文本，避免不同角色变体重复同一阅读材料；
- Demo 已依次完成旧书树叶、旧杯子、熄灯球场三轮，最终显示 `3 / 3`；
- 达到三轮只表示 `max_rounds_reached`，不表示能力已经掌握。

### 人工 Demo 验收记录

验收日期：2026-07-14

验收结论：`PASS`

人工体验已确认：

- 有效输入可以完成三轮连续学习；
- 空答案无法提交或进入下一步；
- 无效输入会被有效性闸门阻断，不进入正式 Diagnosis / Evidence 回流；
- 三轮分别使用不同阅读材料；
- 完成三轮后可以通过“重新验收三轮流程”回到第一轮；
- 重新验收仍从同一份第一轮资源开始，符合当前可重复验收设计。

当前资源轮换边界：

```text
重新验收
-> 清除当前 Demo 学习记录
-> 按固定正式资源顺序重新开始
-> Resource 1 / Resource 2 / Resource 3
```

因此，本次验收只证明单次三轮连续学习闭环成立。跨 Session 已做题历史、长期资源轮换、随机选题和永久排除已做题尚未实现。

## 十一、当前不做

本次不做：

- 新增教育策略；
- 重构 Phase 8—12；
- 自动 LLM 出题；
- 大型题库；
- 云端数据库；
- 多学生账号；
- 长期学习效果结论；
- 正式产品 UI；
- 将达到计划轮数表述为能力提升。

## 十二、Phase 12 冻结记录

冻结日期：2026-07-14

冻结状态：`PASS / Frozen`

冻结范围：

- Phase 12.1：学习回合持久化与恢复；
- Phase 12.2：真实题目输入与任务准备；
- Phase 12.3：连续多轮学习运行；
- Phase 12 基础全链路集成验收；
- 浏览器轻量 Demo 人工体验验收。

冻结时产品状态：

```text
Single-Student Usable Learning Foundation
```

冻结依据：

```text
Phase 12.2 Debug          10 / 10 PASS
Phase 12 Integration       9 / 9 PASS
Phase 12.3 Regression      8 / 8 PASS
Production Build                 PASS
Browser Demo                     PASS
```

冻结后只允许以下最小维护：

1. 冻结回归或基础全链路集成测试失败；
2. Repository 幂等、恢复、版本兼容或数据污染问题；
3. 正式 `TaskResource` Contract 阻断既有 TaskFulfillment；
4. 学生体验出现无法完成流程、状态误导或 Runtime 信息泄露；
5. 后续阶段消费 Phase 12 输出时发现明确的数据契约缺陷。

冻结后不允许：

1. 在 Phase 12 内继续扩展新的教育判断或策略能力；
2. 将 mock Diagnosis 验收解释为真实 AI 诊断质量通过；
3. 将达到最大轮数解释为能力已经提升或掌握；
4. 以修复单个样例为由绕开 Repository、TaskFulfillment 或既有 Runtime；
5. 在没有回归用例和契约依据时大范围调整冻结模块。

最终冻结结论：

Phase 12 已完成并冻结。后续阶段可以稳定消费其正式 `TaskResource`、持久化记录、连续学习运行结果和 GrowthMemory 回流结果；Phase 12 本身不再继续扩展功能。
