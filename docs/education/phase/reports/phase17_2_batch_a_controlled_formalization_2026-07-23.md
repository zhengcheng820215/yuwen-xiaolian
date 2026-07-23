# Phase 17.2 Batch A 受控正式化验收记录

日期：2026-07-23

状态：

```text
Content Package Implementation: PASS
Controlled Formalization Debug: 14 / 14 PASS
Browser Blueprint Import: PASS
Owner Content Review / Freeze: 8 / 8 PASS
Registry / Active Observation Link: 8 / 8 PASS
Phase 17.3 Minimum Entry Gate: OPEN
```

## 一、验收对象

Batch A 当前形成两篇项目原创教学材料：

1. 《站台上的蓝布包》
2. 《河堤边的三盏灯》

共 8 道正式资源定义：

| Material | Resource | Ability | TaskRole | Difficulty |
| --- | --- | --- | --- | --- |
| 站台上的蓝布包 | 父亲做了哪些准备 | extraction | training | basic |
| 站台上的蓝布包 | 理解纸条里的话 | comprehension | training | intermediate |
| 站台上的蓝布包 | 分析父亲的形象 | analysis | training | intermediate |
| 站台上的蓝布包 | 从动作推断父亲心理 | inference | training | intermediate |
| 河堤边的三盏灯 | 复测人物心理推理 | inference | retest | intermediate |
| 河堤边的三盏灯 | 迁移分析人物变化 | analysis | transfer | intermediate |
| 河堤边的三盏灯 | 提取小陈的三个动作 | extraction | training | basic |
| 河堤边的三盏灯 | 理解“修好”的含义 | comprehension | training | intermediate |

当前覆盖：

- 4 项 Ability：extraction、comprehension、analysis、inference；
- 6 道 Training；
- 1 道 Retest；
- 1 道 Transfer；
- 2 个独立 Material Cluster。

## 二、核心资源链

### Training -> Retest

```text
《站台上的蓝布包》
从动作推断父亲心理
inference / training
->
《河堤边的三盏灯》
复测人物心理推理
inference / retest
```

核心 Ability 保持为 inference，材料发生变化，不复用原题。

### Training -> Transfer

```text
《站台上的蓝布包》
分析父亲的形象
analysis / training
->
《河堤边的三盏灯》
迁移分析人物变化
analysis / transfer
```

核心 Ability 保持为 analysis，Transfer 使用独立 Material Cluster，并由静态人物分析转为人物变化分析。

规划链只用于内容设计与验收，不进入 Runtime 权威判断。

## 三、答案 Fixture

四道核心链资源已建立 16 组答案边界样例，覆盖：

- fully_meets；
- partially_meets；
- typical_error；
- reasonable_alternative；
- concise_valid；
- irrelevant / insufficient_evidence。

Fixture 用于验证 Rubric、Answer Acceptance、Diagnosis 与 Narrative 边界，不属于 Frozen Question Resource，不计入 8 道正式题量。

## 四、工程实现

新增：

- 版本化 Batch A 正式资源定义；
- 复用 Existing Phase 16.1 / 17.2 服务的 Batch A Production Service；
- 工作台“载入 Batch A”入口；
- 待审核 Observation Task 只读清单；
- Batch A 专项 Debug 命令。

浏览器入口只把 Batch A 载入为待审核计划，不自动批准、不自动 Freeze，也不绕过逐题审核。

## 五、自动化结果

```text
Phase 17 Batch A                  14 / 14 PASS
Phase 17.2 Production             13 / 13 PASS
Phase 17.2 Material Observation   26 / 26 PASS
Phase 17.1 Resource Coverage      22 / 22 PASS
Production Build                 PASS
```

Batch A `14 / 14` 已证明：

- 2 篇 Material 和 8 道资源身份稳定；
- 4 项 Ability 覆盖准确；
- Retest / Transfer 链不改变核心 Ability；
- Rubric 与 Answer Acceptance 完整；
- 受控审核后 8 道资源可全部 Freeze；
- 8 个 Registry Current Head 成立；
- 8 个 ResourceObservationLink active；
- Coverage Runtime 可读取 8 道正式资源；
- 重复生产保持幂等。

自动化未调用外部 Provider。

## 六、浏览器 Smoke

入口：

```text
#/material-resource-workbench
```

已验证：

1. “载入 Batch A”入口可见；
2. 点击后写入 2 篇 Material；
3. 生成 2 份 Material Observation Plan；
4. 两份 Plan 均通过结构校验并进入 pending review；
5. 页面展示每项 Observation Goal、Ability、TaskRole、Difficulty、Expected Action 与 Design Reason；
6. 当前不会自动生成 Draft、Freeze、Registry 或 Link。

蓝图载入时的浏览器状态保留为历史快照：

```text
Material: 2
Observation Plan: 2 pending review
Question Draft: 0
Active Observation Link: 0
```

负责人随后已按正式工作台流程完成人工审核和逐题 Freeze。最终浏览器状态：

```text
Batch A Question Draft: 8
Frozen Version: 8
Registry: consistent
Active Observation Link / Formal Association: 8
```

额外存在的未命名空 Draft 不属于 Batch A，不计入上述数量。

## 七、负责人验收

以下事项已由产品负责人完成，且没有由自动化 PASS 替代：

1. 阅读两篇 Material；
2. 逐项确认 8 道题的 Observation、Ability 与 TaskRole；
3. 确认项目原创来源与使用范围；
4. 批准两份 Material Observation Plan；
5. 生成并逐题审核 8 个内容完整 Draft；
6. Freeze 并确认 8 个 Registry Current Head；
7. 确认 8 个 active ResourceObservationLink；
8. 完成工作台人工验收记录。

```text
Batch A Owner Acceptance = PASS
Phase 17.3 Minimum Entry Gate = OPEN
```

## 八、准确结论

当前可以宣称：

> Batch A 的两篇真实材料、8 道内容完整资源、两条核心学习链和答案边界样例已经实现；完整 Review、Freeze、Registry、Observation Link 与 Runtime Query 链路已通过 14 / 14 确定性验收，负责人已在浏览器工作台完成 8 / 8 内容审核、Freeze、Registry 与正式关联确认。Phase 17.3 最小入口门已经开放。

当前不能宣称：

- Phase 17.3 已开始或通过；
- 真实 Provider 已在这些题目上完成 Diagnosis 校准。
- 完整 24—28 道首批资源包已完成。
