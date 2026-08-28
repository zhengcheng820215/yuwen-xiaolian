# 常规新学习核心材料准入边界修复报告

状态：ENGINEERING PASS / READ-ONLY BROWSER PASS

日期：2026-08-28

## 1. 问题

正式资源库同时包含完整核心阅读材料与针对性短片段。两类资源都可能具有有效 Frozen Version、Registry Head 和质量轨迹，但常规新 Learning Session 的候选过滤此前只检查最新题目质量，没有检查 Material 用途。

因此，已经发布的 `targeted_excerpt` 可能被选为常规 Session 首题，并把同一短片段下的任务组成整轮学习。页面表现为“入口提供的都不是核心材料”，实际原因是启动准入边界遗漏，不是核心材料或题目缺失。

## 2. 冻结边界

常规新 Session：

```text
active formal resource
+ latest quality admission passed
+ material usage projects to core_reading
-> eligible new-session candidate
```

专项短片段：

```text
formal targeted_excerpt
+ valid gap
+ valid TargetedMicroTrainingAssignment
+ valid Session Overlay
-> temporary targeted micro-training
-> return frozen core cursor
```

以下内容保持不变：

- Material → Plan → Task → Candidate → Publish → Learning 主链；
- 现有 Frozen Resource、Registry Head 与正式题目；
- Retest / Transfer 角色调度；
- 已开始 Session 的冻结资源、固定队列与恢复检查点；
- Evidence、Diagnosis、Revision 与学生历史。

## 3. 工程范围

只修改常规新 Session 的正式资源候选过滤：

1. 在最新质量准入前投影 Material 用途；
2. 仅保留 `core_reading`；
3. 缺少 Material Snapshot 或 `usageType` 的历史版本按 `core_reading` 兼容；
4. 不修改通用精确资源匹配器，避免阻断显式微训练、Retest、Transfer 与冻结 Session 恢复；
5. 不执行数据回写、批量迁移、重新生成或重新发布。

## 4. Debug 验收

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| CR-01 | 当前核心材料且质量通过 | 保留在新 Session 候选集 |
| CR-02 | 历史 Material 缺少用途字段 | 按核心材料兼容保留 |
| CR-03 | 正式短片段且质量通过 | 从常规新 Session 候选集排除 |
| CR-04 | 正式短片段存在于原始正式集合 | 不删除、不修改，可供显式微训练匹配 |
| CR-05 | 最新质量阻断的核心题 | 继续排除 |
| CR-06 | 已冻结 Session 恢复 | 继续消费原资源，不应用新 Session 过滤 |
| CR-07 | Targeted Assignment / Overlay | 继续可消费精确短片段版本 |
| CR-08 | Retest / Transfer | 角色边界与顺序不回归 |
| CR-09 | 正式资源数据 | 零写入、零迁移、零重新发布 |
| CR-10 | Production build 与 Learning 入口 | 无运行时回归 |

## 5. 完成定义

- 文档与代码共同冻结常规新 Session 的核心材料准入边界；
- 定向 Debug、学习队列、微训练 Stage 3/4、Learning 入口集成与生产构建通过；
- 浏览器可访问 Learning 入口，且不通过人工写入学生记录来证明过滤逻辑；
- 每个阶段证明旧主链零回归，新语义只在“尚未创建的常规 Session 候选集”内生效。

## 6. 2026-08-28 验收结果

正式共享资源只读检查得到：

- Current Frozen Resource Version：`81`；
- 常规新 Session 可用核心版本：`63`；
- 从常规入口排除的 `targeted_excerpt`：`18`；
- 最新质量策略阻断：`0`。

自动化结果：

| 验收项 | 结果 |
| --- | --- |
| 最新质量 + 核心用途准入 | `11 / 11 PASS` |
| 固定学习题组队列 | `49 / 49 PASS` |
| Phase 17.3 Learning 入口集成 | `17 / 17 PASS` |
| Targeted Micro-training Stage 3 | `57 / 57 PASS` |
| Targeted Micro-training Stage 4 | `51 / 51 PASS` |
| Student Learning Entry | `4 / 4 PASS` |
| Continuous Learning | `8 / 8 PASS` |
| Learning Persistence | `13 / 13 PASS` |
| Retest Task / Execution | PASS |
| Production Build | PASS |

浏览器使用新的只读标签打开 `#/learning`，页面完成恢复并投射现有冻结 Session，未出现运行时错误。验收没有点击“继续学习”“结束本次学习”或提交答案，因此没有制造新的学生 Attempt、Diagnosis、Evidence 或 Session 状态。已有 Session 继续保留原冻结题组属于契约要求；核心材料准入隔离将在下一次真正创建常规 Session 时生效。
