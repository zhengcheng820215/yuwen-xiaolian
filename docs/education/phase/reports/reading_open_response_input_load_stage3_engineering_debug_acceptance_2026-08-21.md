# 阅读开放文本题输入负担阶段 3 工程与 Debug 验收报告

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED`

验收日期：`2026-08-21`

## 一、交付结果

阶段 3 已在既有 `QuestionCandidate → Adopt → Revision → Publish` 主链上完成组合式质量门禁，没有增加人工审核步骤：

- 新增单题、题组和发布就绪 Schema，冻结 blocker、advisory、规则版本与内容/题组指纹；
- 新增确定性单题负担门禁，覆盖复合动作、隐藏 Rubric、证据不足、作答形式错配、最低要求过重和提示新增隐藏任务；
- 新增题组顺序门禁，覆盖基础入口、无理由负担跳跃、正式顺序例外、跨题型重复观察和高阶观察保留；
- 阶段 2 的 Planner intent 与 generation trace 已进入 `QuestionCandidate`，不再在工作台适配层丢失；
- 新规则 Candidate 缺少或使用过期的单题/题组 Assessment 时，不进入 ready 列表，也不能被采用；
- 单选不伪造文本负担 Assessment，但仍服从题组顺序、重复观察和高阶覆盖门禁；
- 采用前重新读取同组既有题并校验 group snapshot；生成与采用使用同一题组上下文，避免“显示可发布、点击后误报过期”；
- 采用后的 Draft Revision 保存同规则门禁结果；旧规则 Candidate 保持向后兼容，不被追溯增加新字段；
- blocker 与 stale 映射为可理解的卡片附近错误；advisory 不新增“需要确认”、审核人或忽略风险入口。

## 二、运行时与专项 Debug

验收运行时：

```text
/Users/chengzheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
Node v24.19.0
```

专项结果：

| 验收项 | 结果 |
| --- | --- |
| Reading Open-response Load Stage 3 | P3-01—P3-48，48 / 48 PASS |
| Reading Open-response Load Stage 1 | 28 / 28 PASS，只读 |
| Reading Open-response Load Stage 2 | 40 / 40 PASS |
| Question Candidate Workflow | 12 / 12 PASS |
| Question Workbench Command E2E | 7 / 7 PASS |
| Question Candidate Workbench P4 | 16 / 16 PASS |
| Formal Resource Optimization / Upgrade | 4 / 4、6 / 6 PASS |
| Reading Single-choice Stage 1—4 | 85 / 85 PASS |
| Targeted Micro-training Stage 1—4 | 156 / 156 PASS |
| Learning Session Task Queue | 21 / 21 PASS |
| Learning Session History | 15 / 15 PASS |
| Task Publication Orchestration | PASS |
| Vite production build | PASS |

生产构建使用工作区 Node 成功；系统 Node 18 不支持当前 Vite 依赖使用的 `node:util styleText`，属于运行时版本差异，不是本次代码失败。构建仍有既有动态导入与大 chunk 提示。

## 三、真实数据零写入证据

阶段 1 的真实只读审计继续报告：

- 活动材料 24；
- 活动正式题 79；
- 开放文本题 62；
- 单项选择题 17；
- 所有 62 道开放文本题均完成确定性分析；
- Frozen Resource、Registry、Observation Link、Learning Session、Attempt 和 Student Ability Profile 未被阶段 3 Debug 修改。

专项 Debug 使用隔离内存对象和固定 fixture；没有调用线上 Provider，也没有替换任何正式题。

## 四、浏览器冒烟

已在 `http://localhost:5174/?stage4verify=1#/material-resource-workbench` 完成正式数据只读冒烟：

- 页面正常加载“素材与题目生产工作台”；
- 24 篇材料、79 道题的发布统计可读取；
- 当前《散步》6 道任务均以“已发布”投影，旧 Candidate 操作和质量错误未残留；
- 页面刷新后仍可恢复当前材料与已发布任务；
- 当前生产构建通过，页面没有现行致命渲染错误。

随后曾在仅限开发环境的临时隔离状态面板中完成真实浏览器转换验收：

| 状态 | 验收结果 |
| --- | --- |
| ready | 显示“可以发布”和唯一“采用并发布”主操作 |
| advisory | 保持可发布，显示非阻断提醒，不出现人工确认入口 |
| blocked | 显示“需要重新优化”，卡片内错误可见，不显示发布操作 |
| stale | 显示“需要重新检查”，卡片内错误可见并提供恢复入口 |
| publishing | 只显示不可重复触发的“正在发布”，不同时显示旧按钮 |
| published | 原位显示“已发布”，旧操作和错误均清除 |

隔离面板不调用保存或发布 API，不写入 Candidate、Revision、Frozen Version、Registry、Learning Session、Attempt 或 Student Ability Profile；页面运行日志无 error。本次浏览器验收没有为了测试改动正式数据。

验收完成后，该临时面板已经从“素材与题目生产工作台”移除。正式工作台不再接受 `stage3LoadGateVerify=1` 来展示模拟状态或模拟发布按钮；旧参数进入页面时会被清理。后续相同状态由专项 Debug、B4 隔离浏览器矩阵和真实 Candidate 主链回归覆盖，避免测试功能与产品功能混在同一页面。

## 五、工程收口修复

扩展运行 `debug:learning-session-history` 时发现一条历史完成态夹具仍使用旧材料答案，导致当前题目评分生成 `incomplete` Round，随后被完成会话契约正确拒绝。收口时已把夹具答案更新为与当前题目身份和材料证据一致的文本，并在完成态夹具构造器中增加显式状态断言，避免未来题目漂移被误报为 History 契约故障。

修复没有放宽 Learning Session、Round 或 Evidence 身份约束。`debug:learning-session-history` 现为 `15 / 15 PASS`。

## 六、恢复与回滚点

- 新规则只约束 `reading_open_response_load_gated_candidate_rule_v1` Candidate；旧 Candidate 和 Frozen Resource 不追溯阻断；
- 规则升级通过 `READING_OPEN_RESPONSE_LOAD_GATE_VERSION` 显式管理，旧 Assessment 不会被静默解释；
- Candidate 内容、题组顺序或同组正式题变化时返回 stale，不改写正式资源；
- 发布运行时失败仍沿既有幂等恢复链处理，不回写为负担质量失败；
- 如需回滚，只需停用新 ruleVersion 的生成接入和 readiness 投影；正式版本、Registry 和 Learning 数据无需回滚。

## 七、结论

阶段 3 工程代码、自动化 Debug、关键主链回归、生产构建和隔离真实浏览器状态矩阵均已完成。确定性 blocker 能阻止不合格或过期 Candidate 进入可采用链，advisory 不增加人工决策，单选与文本题共享题组门禁，生成与采用阶段使用同一组快照语义。

阶段 3 现可标记为 `ENGINEERING COMPLETE / DEBUG ACCEPTED`。该结论证明工程链路和状态投影完整，不代表输入负担阈值已经通过真实学生数据完成教育效果校准。
