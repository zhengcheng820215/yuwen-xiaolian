# 阅读开放文本题输入负担阶段 2 工程与 Debug 验收报告

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED`

验收日期：`2026-08-21`

## 一、交付范围

阶段 2 已将阶段 1 的只读负担分析接入 AI 候选生成链，并保持既有 `Candidate → Adopt → Revision → Publish` 主链不变：

- 新增 `TextResponseLoadPlanningIntent` 与生成追踪 Schema；
- 新增确定性开放文本题负担 Planner；
- Prompt 注入单一主要动作、证据范围、作答形式和内部长度策略；
- Provider 输出改为严格 JSON 解析；
- 生成后调用阶段 1 分析器复算实际负担；
- 复合动作、隐藏 Rubric 与证据范围偏差可进入最多一次候选级定向修复；
- 修复锁定材料任务身份、主要能力、观察对象与核心锚点；只有结构性非法锚点允许被纠正；
- 修复仍失败时不创建该 Candidate，其余合格候选继续保留；
- `loadLevel` 和推荐长度带只保存在内部规划追踪，不投射到学生界面或 Student Ability Profile。

## 二、专项 Debug

运行时：

```text
/Users/chengzheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
Node v24.19.0
```

专项命令：

```text
node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runReadingOpenResponseInputLoadStage2Debug.ts
```

结果：`P2-01—P2-40，40 / 40 PASS`。

覆盖：Schema、确定性规划、单一主要动作、受控顺序例外、严格 JSON、Prompt 内部字段隔离、四级长度策略、生成后复算、一次修复、修复身份锁定、失败隔离、幂等 fingerprint、正式资源零写入、Learning 零写入与版本冻结。

## 三、真实题库与回归证据

阶段 1 真实 Snapshot 继续通过 `28 / 28`：

- 活动材料：24；
- 活动正式题：79；
- 开放文本题：62；
- 单项选择题：17；
- 62 道开放文本题均完成确定性负担分析。

四类常见真实题型由当前正式题库只读基线与隔离生成样例共同覆盖：局部信息/含义、证据—结论、人物/主题综合、单选与文本混合题组。验收未调用线上 Provider，也未替换活动正式题。

| 回归项 | 结果 |
| --- | --- |
| Material Observation Draft Generator | 44 / 44 PASS |
| Question Candidate Workflow | 12 / 12 PASS |
| Reading Single-choice Stage 1—4 | 85 / 85 PASS |
| Targeted Micro-training Stage 1—4 | 156 / 156 PASS |
| Learning Session Task Queue | 21 / 21 PASS |
| Vite production build | PASS |

构建只保留既有动态导入与大 chunk 提示，没有新增构建失败。

## 四、写入与恢复边界

- 生成期只创建或隔离 Candidate，不修改 Frozen Question Version；
- Registry、Observation Link、Learning Session、Attempt 和 Student Ability Profile 保持零写入；
- 一次普通网络/解析重试与一次候选级修复共用既有两次调用预算，不产生循环修复；
- 已通过的候选不会因同批另一个候选修复失败而丢失；
- 修复不能更换主要能力、观察维度或观察对象；responseFormat 仅在明确格式错配时可调整；
- 结构性非法 Anchor 可以纠正，负担修复不得借机更换核心证据范围。

## 五、残余边界

1. 阶段 2 只治理新生成 Candidate，不修改 62 道既有开放文本正式题；
2. 阶段 1 基线中的高风险 Finding 仍需在阶段 4 通过后继 Candidate 逐题治理；
3. 阶段 2 不把负担 Finding 接入“可以发布 / 需要确认”的正式门禁；该职责属于阶段 3；
4. 阶段 2 不修改 Learning 输入框、提示、反馈或题组调度；
5. 推荐长度仍是内容设计提示，不能作为学生可见的硬字数要求。

## 六、验收结论

阶段 2 的 Planner、Prompt、内部长度策略、确定性复算、一次受控修复、Candidate 投影、写入隔离和相关主链回归均通过，可以作为阶段 3 质量门禁与题组顺序工程的稳定输入。

该结论不等于既有正式题已经自动优化，也不授权绕过用户“采用 / 重新生成”的决策或 `Candidate → Adopt → Revision → Publish` 主链。
