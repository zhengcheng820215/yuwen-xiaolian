# 阅读训练单项选择阶段 2 工程实施与验收清单

状态：`ENGINEERING + DEBUG PASS`

版本：`reading_single_choice_stage2_engineering_plan_v1.1`

日期：`2026-08-18`

## 一、阶段目标

阶段 2 只完成“AI 生成完整单选 QuestionCandidate，并在资源生产工作台完成人工采用或重新优化”的生产端闭环：

```text
Training Task / Observation Plan
→ responseFormat 决策
→ 完整 single_choice Candidate
→ 结构与生成质量门禁
→ 工作台只读展示题干与选项
→ 采用并发布 / 不采用并重新优化
→ 既有 Revision → Validation → Assessment → Publish
```

本阶段不实现 Learning 单选控件、学生提交、Diagnosis、Attempt、真实数据 Projection 或即时改选。阶段 2 通过后，`single_choice` 仍不得进入正式 Learning 可执行能力集合。

## 二、responseFormat 决策边界

### 2.1 可以选择 single_choice

只有训练动作能够通过一次明确判断被观察时，AI 才可选择 `single_choice`：

- 信息定位；
- 基础理解；
- 局部对象或关系判断；
- 文本内有明确证据边界的简单因果；
- 语句作用或表达现象的初步辨认。

### 2.2 必须保持文本作答

以下训练动作不得为了降低输入成本或增加题型丰富度自动转换为单选：

- 概括和归纳；
- 多证据整合；
- 推理链；
- 人物、写法或主题分析；
- 开放评价、迁移表达；
- Rubric 要求学生组织多个独立核心观察点。

### 2.3 顺序与配额

- 不设置每篇材料必须包含单选题的配额；
- 不固定单选题必须排第一；
- 推荐低负荷到高负荷，但实际顺序由 Training Task Role、Observation Plan 和材料训练意图决定；
- 生成器不得为了凑题型改变既有训练动作或评分目标。

## 三、完整 Candidate 原子输出

AI 选择 `single_choice` 时必须在同一次生成中返回：

1. `questionType = multiple_choice`；
2. `responseFormat = single_choice`；
3. 题干；
4. 3–5 个带稳定 `optionId` 的完整选项；
5. 唯一 `correctOptionIds`；
6. 每个错误选项的 `misconceptionCode`、`diagnosisMeaning` 和必要的 `evidenceBoundary`；
7. `answerAcceptance.acceptedOptionIds`，且与唯一正确选项一致；
8. `assessmentMode = exact_match`；
9. 单选专用 `minimumAnswerRequirement`；
10. Rubric、能力、难度、材料范围和生成上下文。

禁止先生成题干，再通过前端模板补选项、正确答案或干扰依据。任何选项或答案键变化都必须形成新 Candidate 和新内容哈希。

## 四、干扰项质量门禁

阶段 2 在阶段 1 结构校验之上增加生成质量判断：

- 错误选项必须与题干、回答对象和材料范围相关；
- 每个错误选项对应一个独立、可解释的典型偏差；
- 不能只有一个明显合理选项和多个无关、荒诞或措辞失衡的选项；
- 错误选项不能依赖材料外知识才能排除；
- 正确项与错误项的长度、语气和抽象层级不能形成明显答案提示；
- 干扰依据必须说明“为什么学生可能这样选”和“文本证据边界在哪里”，不能只重复“该选项错误”；
- 正确答案、Accepted Option 与选项集合必须身份对齐。

门禁失败时 Candidate 状态为 blocked，不进入“可以发布”。生产端只表达“当前方案需要重新优化”，详细内部错误保留在质量记录和 Debug 中。

## 五、生产工作台交互

### 5.1 展示

单选 Candidate 卡片展示：

- Candidate 标签、状态和题干；
- 选项内容及稳定的当次显示序号；
- 能力、任务动作、难度和材料范围等既有只读标签；
- 必要的生成质量提醒。

默认不展示正确答案、干扰项内部依据、Schema 字段或 Provider 原始输出。内部详情可以用于 Debug，但不能变成人工填写步骤。

### 5.2 人工动作

人只执行两类决定：

- `采用并发布`：采用完整 Candidate，并进入现有正式化编排；
- `不采用并重新优化`：保留正式资源不变，生成新的完整 Candidate。

阶段 2 不增加“编辑选项”“指定正确答案”“填写审核意见”“保存草稿后再发布”等人为中间步骤。

### 5.3 运行态与恢复

- 生成中、重新优化中、采用发布中各只能显示一个运行态；
- 运行态不得同时保留可点击的同名主按钮；
- 幂等重试复用同一生成或采用命令，不重复创建 Candidate、Revision 或 Formal Version；
- 发布中断继续使用现有 adoption / validation / assessment / publication 阶段恢复结果；
- 未采用、blocked 或 superseded Candidate 不得修改正式资源。

## 六、采用发布边界

`single_choice` Candidate 采用后不得旁路现有主链：

```text
Candidate adopted
→ Question Draft Revision
→ Validation
→ Quality Assessment
→ Publication Decision
→ Frozen Version
→ Registry / Active Link
```

阶段 1 的 `choiceInteraction`、答案键、干扰依据和 `optionSetVersion` 必须完整进入 Revision 与 Frozen Version；学生投影仍不得在阶段 2 开放。

## 七、阶段 2 自动化验收矩阵

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| S2-01 | 基础理解训练动作生成单选 | 返回完整且可校验 Candidate |
| S2-02 | 高阶分析训练动作 | 保持 short_text / long_text，不机械转换 |
| S2-03 | 同篇无单选需求 | 允许题组没有单选题 |
| S2-04 | Plan 把单选排在非首位 | 顺序保持 Plan 决定 |
| S2-05 | 缺少错误项依据 | 质量门禁 blocked |
| S2-06 | 两个干扰项表达同一偏差 | 质量门禁 blocked |
| S2-07 | Accepted Option 与答案键不一致 | Candidate blocked |
| S2-08 | 工作台 Candidate 卡片 | 显示题干和全部选项，不显示答案键 |
| S2-09 | 不采用并重新优化 | 正式资源不变，新 Candidate 完整生成 |
| S2-10 | 采用并发布 | 进入既有 Revision / Validation / Publication 链 |
| S2-11 | 发布中断后重试 | 不重复 Candidate、Revision 或 Formal Version |
| S2-12 | 旧文本 Candidate | 生成、展示、优化和发布行为无回归 |
| S2-13 | 单选生成质量失败 | 前台只提示重新优化，不暴露内部英文错误 |
| S2-14 | 生成或发布运行态 | 不同时出现运行文案和可点击主按钮 |

## 八、阶段完成条件

只有同时满足以下条件，阶段 2 才可标记 `ENGINEERING + DEBUG PASS`：

1. 单选完整 Candidate 能由真实生产生成入口产出；
2. 训练动作决策不依赖题型配额；
3. 干扰项结构和生成质量门禁全部生效；
4. 生产工作台展示完整且不泄露答案键；
5. “采用并发布 / 不采用并重新优化”两条路径闭环；
6. 发布恢复和幂等保持既有语义；
7. 文本题、现有资源覆盖和正式发布回归通过；
8. Production Build 通过并形成阶段 2 验收记录。

完成阶段 2 后只允许进入阶段 3 开发，不得直接宣称单选题已经可供学生正式使用。

## 九、执行结果

阶段 2 已于 `2026-08-18` 完成工程开发与 Debug 验收：专项用例 `14 / 14 PASS`，阶段 1 及关键生成、Observation、Candidate、Admission、工作台、发布恢复和命令回归合计 `189 / 189 PASS`，Production Build PASS。

完整证据见[阅读训练单项选择阶段 2 工程与 Debug 验收](../education/phase/reports/reading_single_choice_stage2_engineering_debug_acceptance_2026-08-18.md)。产品能力仍保持 Learning blocked，阶段 3–4 未完成前不得标记为 executable。
