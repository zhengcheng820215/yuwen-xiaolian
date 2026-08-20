# 针对性短片段微训练阶段 3 工程与 Debug 验收（2026-08-20）

结论：`ENGINEERING + AUTOMATED DEBUG PASS / CONTROLLED TARGETED BROWSER FLOW + REAL EFFECT PENDING`

## 一、工程范围

阶段 3 已完成：

- 从正式核心题持久化结果、身份、唯一主要 Gap、Ability、Revision 资格与 Session 状态形成确定性 Trigger Decision；
- 仅在首批四类具体动作缺口成立时生成幂等 Request；
- 以 `Ability + Gap + training Role + Frozen Head + Active Registry + 来源边界` 精确匹配正式短片段；
- 无精确资源时记录 `no_match` 并继续核心学习，不展示空过渡页；
- 以原子 Snapshot Repository 保存 Decision / Request / Assignment，支持 Revision CAS、重试复用和跨标签一致性基础；
- 以 `TargetedMicroTrainingSessionOverlay` 接入 Unified Learning Entry，保持核心 Queue 内容、顺序和分母不变；
- 支持 pending、in-progress、completed、skipped、unavailable 以及刷新恢复；
- 微训练完成后返回冻结的下一核心题游标，末题使用 Session 完成哨兵；
- Learning 页面在存在真实 Assignment 时才显示“开始针对性练习 / 继续原题组”过渡，不把调度失败投射为学生错误；
- 功能默认关闭，只允许 `targetedMicroTraining=1`、`stage3verify=1` 或本地显式验证开关启用。

阶段 3 未做：

- 未把阶段 2 隔离资源包写入当前活动正式资源库；
- 未默认面向真实学生开启动态调度；
- 未根据工程指标自动调参；
- 未把一次微训练完成解释为能力提升；
- 未完成阶段 4 的真实 Trigger / Match / Completion / Return / Same-gap Recurrence 校准。

## 二、关键实现

| 模块 | 工程结果 |
| --- | --- |
| Trigger / Match | 纯函数资格判定、精确匹配、确定性排序、来源题与重叠 Anchor 排除 |
| Scheduling Repository | In-memory 与 IndexedDB Snapshot；原子提交、CAS、幂等复用、状态迁移 |
| Session Overlay | 微训练只覆盖当前呈现，不插入或重排 `resourceVersionIds` |
| Learning Orchestrator | Assignment 挂接、开始、完成、跳过、失效和恢复 |
| Phase 16.3 Adapter | 正式反馈完成后非阻断调度；针对性 Frozen Version 独立呈现与提交 |
| Student UI | 有 Assignment 才显示过渡；Revision 优先；失败安全返回核心题组 |
| Feature Flag | 默认关闭；验证参数或本地显式开关才启用 |

## 三、Stage 3 专项 Debug

`runTargetedMicroTrainingStage3Debug.ts`：`57 / 57 PASS`。

覆盖：

- 合法与非法 Trigger；
- Revision 互斥、微训练不自触发、一次一项、Session 两项上限；
- Ability / Gap / Role / Frozen / Registry / Material Version 精确匹配；
- 来源题自身、历史非 Frozen 版本、排除资源与同篇重叠 Anchor 阻断；
- 不同材料优先与输入顺序无关；
- Decision / Request / Assignment 原子性、幂等与 CAS；
- `no_match` 正常终止；
- pending / in-progress / completed / skipped / unavailable；
- 普通题与末题返回；
- Overlay 恢复与核心 Queue 不变。

## 四、关键回归与构建

| 验收项 | 结果 |
| --- | --- |
| Targeted Micro-training Stage 1 | `16 / 16 PASS` |
| Targeted Micro-training Stage 2 | `32 / 32 PASS` |
| Targeted Micro-training Stage 3 | `57 / 57 PASS` |
| Learning Session Task Queue | `19 / 19 PASS` |
| Learning Feedback Revision Stage 4 | `19 / 19 PASS` |
| Reading Single-choice Stage 4 E2E | `13 / 13 PASS` |
| Unified Learning Entry | `27 / 27 PASS` |
| Vite Production Build | `PASS` |
| `git diff --check` | `PASS` |

上述具名计数合计：`183 / 183 PASS`。

## 五、数据与上线边界

1. 阶段 2 的 12 份短片段、18 道题仍处于隔离资源包，没有自动导入当前 12 篇核心材料、61 道活动题目的正式快照。
2. 默认关闭时，现有 Learning 的选择题、文本题、反馈后修订、固定题组继续与 Session 完成行为保持不变。
3. 专用验证开关开启但无精确活动资源时，结果是 `no_match` 并继续核心题组，不是错误状态。
4. 只有后续受控导入已审查的短片段 Frozen Version 与 Active Registry Link 后，真实浏览器才会出现动态微训练。
5. 教育效果仍需阶段 4 使用真实学习数据验证，当前不得宣称缺口已经改善或能力已经提升。

## 六、真实浏览器安全冒烟

已在本地真实浏览器验证：

- 默认 URL `/learning` 不显示针对性训练过渡，既有“继续当前题组”入口正常；
- 使用 `?stage3verify=1#/learning` 开启验证开关但活动 Registry 中没有精确短片段时，不显示空过渡、不显示错误，继续保留原核心题组；
- 两条路径浏览器控制台均无 error / warning，仅有 Vite 与 React DevTools 开发信息。

尚未以真实浏览器执行完整 targeted Assignment 的开始、提交、刷新、失效、跳过与返回路径。原因是阶段 2 隔离资源包未写入当前活动正式库；为完成演示而污染 12 篇/61 题正式快照不符合本阶段边界。上述状态迁移已由 Stage 3 专项自动化覆盖，完整浏览器路径应在后续受控导入已审查资源后补验。

## 七、最终状态

阶段 3 已达到工程开发、自动化 Debug、生产构建与默认关闭安全冒烟标准。当前状态冻结为：

`ENGINEERING + AUTOMATED DEBUG PASS / CONTROLLED TARGETED BROWSER FLOW + REAL EFFECT PENDING`

下一步不是扩大自动触发范围，而是先在受控资源和显式开关下完成完整 targeted Assignment 浏览器联调；该路径通过后，阶段 3 才可标记 `STAGE 3 CONDITIONAL SCHEDULING PASS` 并进入阶段 4 的真实效果校准。
