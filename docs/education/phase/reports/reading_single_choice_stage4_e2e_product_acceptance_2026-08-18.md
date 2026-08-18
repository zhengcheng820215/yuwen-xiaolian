# 阅读单选阶段 4 端到端与产品验收报告

日期：2026-08-18

结论：`PASS`

```text
Engineering Verification = PASS
E2E Integration = PASS
Product Acceptance = PASS（受控 PC / Tablet）
Capability Gate = OPEN
Live Education Effect = AWAITING REAL STUDENT DATA
```

## 一、验收范围与边界

本次验收确认 `single_choice` 能沿既有正式链从真实 Material Version 进入 Learning，并继续形成结构化 Response、确定性 Diagnosis、独立 Evidence 与可追溯的互补训练分流。

验收使用正式语料库的当前材料版本，但在隔离的内存 Repository 中创建验收专用 Plan、Draft、Frozen Version 与 Link，不修改 Shared Store，不制造正式学生 Attempt，也不把测试结果计入真实校准。

受控产品验收通过只说明产品交互和工程闭环可进入真实试用，不证明教育效果、题目区分度或长期能力判断已经成立。

## 二、真实材料登记

| 材料 | 正式材料身份 | 文体 | 验收任务顺序 | 单选资源身份 | optionSetVersion | 正确 optionId | 主要干扰偏差 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 《狼》 | `material-b38614ee-a55:v3` | classical_prose | single_choice → long_text | `stage4-wolf-choice-resource:v1` / `stage4-wolf-choice-task` | 1 | `wolf-correct` | surface_reading / causal_reversal / over_inference |
| 《天上的街市》 | `material-c90bbd38-7fe:v3` | modern_poetry | long_text → single_choice | `stage4-street-choice-resource:v1` / `stage4-street-choice-task` | 2 | `street-correct` | surface_reading / entity_confusion / scope_shift |

两篇材料在文体、观察对象、任务顺序和干扰偏差上均存在真实差异。《狼》验证“基础理解入口在前”，《天上的街市》验证“Training Task Role 和 Observation Plan 决定实际顺序，单选不固定排第一”。

正确答案与干扰项内部依据只存在于验收记录和正式资源内部；学生投影、页面快照和反馈均不包含正确 optionId 或答案键。

## 三、阶段 4 自动化结果

命令：`pnpm run debug:reading-single-choice-stage4`

结果：`10 / 10 PASS`

覆盖：

1. 两篇当前真实材料身份与差异；
2. 两种任务顺序；
3. 重复发布幂等、唯一 Frozen Version、Registry Head 与 Active Link；
4. Capability Gate 关闭时阻断、v2 门禁开启后正式计入 Coverage；
5. 正式来源解析与 Learning Task Preparation；
6. 典型错误干扰项 Diagnosis、答案保护与完整 Trace；
7. 正确选择的保守表达，不宣称掌握；
8. Option Set Version 错位在 Diagnosis 前阻断；
9. 单选与文本保持独立 Attempt / Diagnosis / Evidence 并形成互补分流；
10. 四类互补观察路线全部保持可用。

阶段 4 联调发现并修复了一项真实门禁问题：旧 Coverage 完整性检查把所有响应格式都要求为 `minLength > 0`，会误阻断结构合法且 `minLength = 0 / minSelections = 1 / maxSelections = 1` 的单选资源。现已改为按 `responseFormat` 校验，不绕过 Rubric、答案键、唯一选择和版本检查。

## 四、产品点击验收

验收入口：`#/internal/acceptance/reading-single-choice`

该入口复用正式 Learning 的 `SingleChoiceResponseInput`，不写 Shared Store。

### PC

- 初始未选择时“保存选择”“提交选择”均禁用；
- 学生投影不包含 `correctOptionIds`、`distractorRationales`、misconceptionCode 或内部 optionId 文案；
- 选择后保存和提交均可用；
- 保存后显示“当前选择已保存”；
- 提交期间只显示“正在提交并分析本次回答…”，保存与提交按钮均不同时存在；
- 错误反馈命中“只看到表面动作”的具体偏差，不透露正确选项；
- 浏览器控制台无 error / warning。

### Tablet

视口：`768 × 1024`

- 4 个选项、保存与提交按钮均完整可见；
- `scrollWidth = clientWidth = 768`，无横向溢出；
- 正确选择反馈只表述“本次基础判断成立”，并指向后续文本解释；
- 未出现“已经掌握”等越界结论。

## 五、Capability Gate 变更

变更前：

```text
capabilityVersion = phase17_1_product_capability_v1
multiple_choice = resource_only
single_choice = resource_only
```

变更后：

```text
capabilityVersion = phase17_1_product_capability_v2
multiple_choice = accepted
single_choice = accepted
```

默认 Coverage Policy 同步允许 `multiple_choice`，但正式执行仍要求：当前 Frozen Version、通过 Validation、采用决定、Material Snapshot、Registry Head、Reviewed Observation Plan 与唯一 Active Link 全部身份一致。Capability Snapshot 仍可显式把该能力切回 `resource_only` 或 `blocked`。

## 六、关键回归

| 范围 | 结果 |
| --- | --- |
| Reading Single Choice Stage 1 | 21 / 21 PASS |
| Reading Single Choice Stage 2 | 14 / 14 PASS |
| Reading Single Choice Stage 3 | 18 / 18 PASS |
| Reading Single Choice Stage 4 | 10 / 10 PASS |
| Resource Coverage | 22 / 22 PASS |
| Text Task Execution | 16 / 16 PASS |
| Learning Persistence | 13 / 13 PASS |
| Feedback Revision Stage 4 | 19 / 19 PASS |
| Phase 16 Resource Integration | 5 / 5 PASS |
| Phase 1–16.2 Single-object E2E | 6 / 6 PASS |
| Question Publication Recovery | 3 / 3 PASS |
| Question Empirical Calibration | 6 / 6 PASS |
| Phase 16.3 Real Learning Chain | 16 / 16 PASS |
| Material Observation | 29 / 29 PASS |
| Formal Resource Command Queue | 5 / 5 PASS |
| Shared Formal Resource Atomic Command | 12 / 12 PASS |
| 合计 | 215 / 215 PASS |
| Production Build | PASS |

### 6.1 最终浏览器冒烟补充验收

阶段 4 完成后的真实浏览器冒烟发现并修复了一项草稿恢复缺陷：未提交草稿虽然已经保存 `ConcreteLearningTask`，但恢复时只从尚未产生的 Operation Checkpoint 读取 `sourceResourceVersionId`，导致点击“继续学习”后重新选题，并可能错误进入“当前没有新的正式任务”。

窄范围修复后：

- Operation Checkpoint 已存在时继续以其资源版本为准；
- 尚未提交、只有草稿时，从 `ConcreteLearningTask.questionMetadata.questionId` 恢复原 Frozen Version；
- 正式版本不可用时明确阻断，不静默换题；
- 匹配器可通过 `requiredResourceVersionId` 将候选范围严格收敛到原版本；
- 文本题与单选题草稿均验证能解析出原资源版本身份。

补充自动化结果：

| 范围 | 结果 |
| --- | --- |
| Reading Single Choice Stage 3（含两类草稿身份） | 20 / 20 PASS |
| Phase 17.3 Learning Entry（含锁定与失效阻断） | 16 / 16 PASS |
| Learning Persistence | 13 / 13 PASS |
| Unified Learning Entry | 24 / 24 PASS |
| Phase 16.3 Real Learning Chain | 16 / 16 PASS |
| Reading Single Choice Stage 4 | 10 / 10 PASS |
| Production Build | PASS |

真实浏览器复验路径：开始新会话 → 进入《济南的冬天》正式任务 → 输入并保存 75 字草稿 → 刷新 → 点击“继续学习”。复验结果为原题一致、草稿逐字一致、浏览器控制台无 error / warning；验收会话随后正常结束。

## 七、最终决定

`single_choice` Capability Gate 从 `CLOSED` 变更为 `OPEN`。

允许范围：新的、完整通过既有采用发布链的 `multiple_choice + single_choice` 正式资源可以进入 Learning 匹配与消费。

不变边界：

- 不做多选、部分得分、选择后追问或反馈后立即改选；
- 不固定每篇材料包含单选，也不固定单选排第一；
- 单选与文本继续保存独立 Attempt、Diagnosis 和 Evidence；
- 单选正确不直接确认能力掌握；
- 真实教育效果、干扰项有效性和后续训练价值必须由真实数据继续校准；
- 若发生严重回归，关闭版本化 Capability Gate，不删除或覆盖历史事实。
