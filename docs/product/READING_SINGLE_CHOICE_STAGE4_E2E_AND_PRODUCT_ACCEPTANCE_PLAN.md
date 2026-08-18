# 阅读单选阶段 4 端到端联调与产品验收清单

状态：`EXECUTION PASS / CAPABILITY GATE OPEN`

文档版本：`reading_single_choice_stage4_acceptance_v1.0`

生效日期：`2026-08-18`

执行结论（2026-08-18）：

```text
Engineering Verification = PASS
E2E Integration = PASS
Product Acceptance = PASS（受控 PC / Tablet 产品验收）
Final Browser Resume Smoke = PASS（同一 Frozen Version / 同题 / 同草稿）
Capability Gate = OPEN
Live Education Effect = AWAITING REAL STUDENT DATA
```

正式执行证据见[阅读单选阶段 4 端到端与产品验收报告](../education/phase/reports/reading_single_choice_stage4_e2e_product_acceptance_2026-08-18.md)。最终浏览器冒烟已补验“保存草稿 → 刷新 → 继续学习”，恢复链严格绑定原正式资源版本且不静默换题。受控产品验收通过不等于真实学生效果已经验证；真实正确率、干扰项分布、完成率和互补观察价值仍需进入试用后采集。

上位契约：[阅读训练单项选择作答契约](./READING_SINGLE_CHOICE_RESPONSE_FORMAT_CONTRACT.md)

## 一、目的

阶段 4 负责验证单项选择从真实材料生产到 Learning 消费的完整产品闭环，并决定是否解除 `single_choice` 正式资源可执行门禁。

本阶段不是继续扩展题型，也不重新设计前三阶段能力。核心任务是确认已实现能力在真实数据、真实页面、刷新恢复和异常场景中能够一致运行：

```text
Material Version
→ Observation Plan
→ Training Task
→ QuestionCandidate(single_choice)
→ Adopt
→ Revision / Assessment / Publish
→ Frozen Resource / Registry / Active Link
→ Learning Delivery
→ Structured Response
→ Diagnosis
→ Evidence / Calibration Projection
→ Next Training Route
```

## 二、阶段状态口径

阶段 4 必须分别记录以下状态，禁止使用一个笼统的 `PASS`：

| 状态 | 含义 |
| --- | --- |
| Engineering Verification | 自动化、构建、恢复和数据完整性是否通过 |
| E2E Integration | 真实 Material → Learning 全链是否通过 |
| Product Acceptance | 学生和内容生产者是否能正确理解并完成操作 |
| Capability Gate | `single_choice` 是否允许进入正式可执行资源集合 |

允许出现：

```text
Engineering Verification = PASS
E2E Integration = PASS
Product Acceptance = PENDING
Capability Gate = CLOSED
```

只有前三项全部通过，Capability Gate 才允许从 `CLOSED` 变更为 `OPEN`。

## 三、前置条件

进入阶段 4 前必须满足：

1. 阶段 1 Schema 与领域校验通过；
2. 阶段 2 AI 生成与生产工作台通过；
3. 阶段 3 Learning、Diagnosis、Evidence 与数据链通过；
4. 旧文本任务、Revision、真实采集和 Phase 16.3 主链回归通过；
5. Resource Coverage 仍明确阻断 `single_choice`；
6. 没有使用 Demo、Fixture 或历史遗留状态冒充正式资源。

任何前置条件失败时，不得通过修改 Capability Gate 绕过问题。

## 四、真实验收样本

### 4.1 最低材料数量

至少使用两篇真实材料，每篇至少包含：

- 一道独立 `single_choice` 任务；
- 一道可比较但保持独立的 `short_text` 或 `long_text` 任务；
- 完整 Material Version、Observation Plan、Training Task、Rubric、Answer Acceptance 和 Frozen Resource；
- 可解释且互不重复的干扰项依据。

### 4.2 样本差异

两篇材料不得只是题干或人名替换，至少在以下两个维度上存在真实差异：

- 文体或材料结构；
- 目标能力；
- 观察对象；
- 难度；
- 干扰项偏差类型；
- 任务顺序。

至少一篇按以下梯度组织：

```text
基础辨认 / 理解 → 局部解释 → 综合分析
```

至少一篇允许直接进入文本任务或将单选置于后续辨析位置，用于证明“单选不固定排第一”。

### 4.3 验收样本登记

每篇材料必须登记：

- `materialId / materialVersionId`；
- `resourceId / resourceVersionId / taskId`；
- `responseFormat / optionSetVersion`；
- 目标能力、任务角色和难度；
- 正确 optionId；
- 每个干扰项的 misconceptionCode；
- 对应文本任务及可比较范围；
- 验收人、验收时间和产品版本。

正确答案和干扰项依据只进入内部验收记录，不得出现在学生截图或学生端状态中。

## 五、端到端验收矩阵

### 5.1 生产与发布

| 编号 | 场景 | 预期结果 |
| --- | --- | --- |
| P1 | AI 生成完整单选 Candidate | 题干、选项、唯一答案、逐项干扰依据、Rubric 和 Acceptance 同时存在 |
| P2 | Candidate 不合格 | 只允许重新优化，不修改正式资源 |
| P3 | 采用 Candidate | 进入既有 Revision / Assessment / Publish 链，不创建单选专用旁路 |
| P4 | 重复点击采用并发布 | 复用同一命令身份，不产生重复 Revision、Version 或 Registry Link |
| P5 | 发布中断后恢复 | 从最后成功阶段继续，不重新覆盖已完成事实 |
| P6 | 发布成功 | Frozen Version、Registry Head 和 Active Link 身份一致 |
| P7 | 题目或答案键冲突 | 阻断发布，不向 Learning 暴露不完整资源 |

### 5.2 Learning 与恢复

| 编号 | 场景 | 预期结果 |
| --- | --- | --- |
| L1 | 首次打开单选任务 | 只显示题干和选项，不显示答案键、干扰依据或内部状态 |
| L2 | 未选择 | 提交不可用，并明确提示选择一个答案 |
| L3 | 选择后保存 | 保存稳定 optionId、Option Set Version 和展示顺序 |
| L4 | 提交前刷新 | 恢复当前选择草稿，不改变选项版本 |
| L5 | 正常提交 | 只出现一个提交运行态，不能继续重复点击 |
| L6 | 提交中断后刷新 | 恢复同一 Initial Response，不生成重复 Attempt |
| L7 | 分析中断后重试 | 复用同一 Response 和提交身份 |
| L8 | 已提交后返回 | 恢复正式反馈，不重跑 Diagnosis 或 Evidence |
| L9 | Option Set Version 错位 | 阻断当前作答并进入资源治理，不静默迁移答案 |
| L10 | 反馈完成 | 第一版不提供立即改选入口 |

### 5.3 Diagnosis 与反馈

至少覆盖：

- 正确选项；
- `surface_reading`；
- `entity_confusion`；
- `evidence_omission`、`over_inference`、`causal_reversal` 或 `scope_shift` 中至少一种；
- 未知选项或版本错位。

验收要求：

1. 正确选择只表达本次基础判断成立，不宣称能力已经掌握；
2. 错误选择反馈必须命中该干扰项对应偏差；
3. 反馈不直接透露正确选项或正确 optionId；
4. 单个错误选项只形成待验证假设，不写入 confirmedRootCause；
5. 下一步建议能够回到具体材料边界或进入对应文本任务；
6. 单选确定性判断不依赖外部 LLM 可用性。

### 5.4 Evidence、互补观察与训练分流

| 单选表现 | 文本表现 | 阶段 4 预期路线 |
| --- | --- | --- |
| 弱 | 弱 | `prerequisite_foundation` |
| 强 | 弱 | `constructed_response_training` |
| 弱 | 强 | `diagnostic_verification` |
| 强 | 强 | `retest_or_transfer` |

每组互补观察必须验证：

- 两道题保持独立 Attempt；
- 两道题保持独立 Diagnosis；
- 两道题保持独立 Evidence；
- 联合解释保留全部来源 ID；
- 不生成 mergedScore；
- Training / Retest / Transfer 角色不同不会自动放行不可比较证据。

### 5.5 真实数据

每个有效单选 Attempt 至少验证：

- `responseFormat = single_choice`；
- `resourceVersionId / taskId / optionSetVersion`；
- `selectedOptionIds / displayedOptionOrder`；
- 正确性和命中的 misconceptionCode；
- Response、Diagnosis、Evidence 和 Calibration Projection 身份一致；
- 重试不会重复写入；
- 文本和单选使用各自的评分策略版本；
- 不同 Resource Version 或 Option Set Version 不合并统计。

## 六、产品可用性验收

### 6.1 学生端

真实点击验收至少确认：

1. 学生能理解这是当前完整题目，而不是文本题中的附加小题；
2. 选中状态、提交状态和正式反馈状态清楚；
3. 提交中不会同时出现可点击提交按钮和运行提示；
4. 错误反馈能指向具体理解偏差，而不是模板化“答错了”；
5. 学生知道下一步是核对材料、进入解释任务或继续下一轮；
6. 页面刷新不会让学生误以为需要重新作答；
7. PC 与 Tablet 布局均能完成选择、提交和反馈阅读。

### 6.2 生产端

内容生产者只需要：

```text
采用并发布
或
重新生成题目
```

不得因单选增加答案键编辑、干扰项逐条审批、填写审核意见或手工修题步骤。内部质量问题由 AI 重新生成完整 Candidate 解决。

## 七、回归范围

阶段 4 必须同时验证：

- `short_text / long_text` 任务生成、发布和 Learning 不变；
- 文本反馈后单次 Revision 不变；
- 单选不错误进入文本 Revision；
- Phase 16.3 断点恢复和 Provider 幂等不变；
- Learning 五事件和 Outbox 恢复不变；
- Question Calibration 的文本评分策略不变；
- 既有 Registry、Frozen Version 和 Link 不被测试数据覆盖；
- Demo / Fixture / Product Scope 继续隔离。

## 八、Capability Gate 开启条件

只有同时满足以下条件，才允许把 `single_choice` 加入正式可执行响应格式集合：

1. 两篇真实材料全部完成生产与发布验收；
2. P1–P7、L1–L10 全部通过；
3. 正确与规定的典型错误反馈全部通过；
4. 四类互补观察分流通过；
5. 数据身份、幂等和版本隔离通过；
6. 文本任务与 Revision 回归通过；
7. Production Build 通过；
8. PC / Tablet 可观察产品验收通过；
9. 阶段 4 验收报告明确记录 Capability Gate 变更前后状态。

不得因为“阶段 1–3 工程已完成”或“页面可以显示选项”提前开启门禁。

## 九、失败与回滚

任一关键场景失败时：

1. Capability Gate 保持或恢复为 `CLOSED`；
2. 已生成的单选资源保留追溯，但不进入正式 Learning 匹配；
3. 不删除历史 Version、Attempt、Diagnosis 或 Evidence；
4. 不把失败单选静默转换为文本题；
5. 修复后使用新 Resource Version 或明确的工程版本重新验收；
6. 学习端继续只消费原有可执行文本资源。

若门禁开启后发现严重问题，应优先关闭能力集合中的 `single_choice`，而不是修改或删除已产生的历史事实。

## 十、执行产物

阶段 4 完成时必须输出：

1. 两篇真实材料验收登记；
2. 自动化 Debug 汇总；
3. 真实端到端场景结果；
4. PC / Tablet 产品验收截图或记录；
5. 文本任务回归结果；
6. Capability Gate 开启或保持关闭的决定；
7. 阶段 4 完成后生成 `reading_single_choice_stage4_e2e_product_acceptance_2026-08-18.md` 验收报告；
8. 主契约和产品控制表的最终状态同步。

## 十一、最终退出标准

阶段 4 只有两种合法结论：

```text
PASS
Engineering Verification = PASS
E2E Integration = PASS
Product Acceptance = PASS
Capability Gate = OPEN
```

或：

```text
NOT READY
Capability Gate = CLOSED
明确记录失败场景、影响范围和下一次验收条件
```

禁止使用“基本通过”“大部分可用”解除正式能力门禁。
