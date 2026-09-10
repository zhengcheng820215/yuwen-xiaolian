# 错题反馈 Stage 3 Wave A 内容迁移与 Debug 验收报告

日期：2026-09-10

状态：`WAVE_A CONTENT MIGRATION PASS / WAVE_B NOT STARTED / REAL TRIAL NOT AUTHORIZED`

工程基线分支：`codex/stage2-feedback-action-contract`

上游工程基线 Commit：`b0d3fb2`

执行命令身份：`wrong-answer-feedback-stage3-wave-a-2026-09-10-v1`

## 一、执行结论

Stage 3 Wave A 已完成一个正式资源 successor 的生产、准入、操作者授权审核、冻结、Registry 切换、质量 Trace 补齐、资源—观测 Link 切换和回滚身份保留。

本轮只迁移：

- 源资源：`resource-observation-task-plan-1q9udud:v1`；
- successor：`resource-observation-task-plan-1q9udud:v2`；
- 材料：`targeted-v3-requirement-3:v1`《风筝落下以后》；
- Rubric Item：`primary-action`；
- Action Contract：`add_required_dimension / operation_only`。

除 `primary-action.feedbackActionContract` 外，v2 的材料身份、题干、题型、作答格式、答案接受边界、Rubric 内容、最低作答要求、能力元数据、来源和标签均与 v1 一致。v1 的教育内容快照未修改；正式版本服务只将其生命周期状态更新为 `superseded`，并保留原身份与全部审计记录。

## 二、正式写入结果

| 项目 | 执行结果 |
| --- | --- |
| Formal Store revision | `1964 → 1965` |
| Registry current head | `resource-observation-task-plan-1q9udud:v2` |
| v1 状态 | `superseded`，仍可按版本身份读取与回滚 |
| v2 状态 | `frozen` |
| v2 validation | `resource-observation-task-plan-1q9udud:stage3-wave-a:draft:validation:r2`，PASS |
| v2 review | `resource-observation-task-plan-1q9udud:stage3-wave-a:draft:review:r2`，approve |
| v2 quality trace | `quality-trace-s0wp0k` |
| v2 active link | `resource-observation-link-1glnei0` |
| Attempt / Profile / Trial Observation 写入 | `0` |
| 新 Runtime Identity / Launch Record / Trial Binding | `0` |

内容摘要：

- v1 教育内容 digest：`sha256:43b64f42369d71b9663bfb234c520c74cedf24399bf8d9f8dc8b32b6ea3d92f2`；
- v2 教育内容 digest：`sha256:b1c63535a3e641dc9be184d5d70068c7d0f29444a011c35c14418621ed548df4`；
- 两者差异只来自新增的 Action Contract。

## 三、验收证据

### 3.1 Stage 3 Wave A

- dry-run：C3-A01—C3-A24，`24 / 24 PASS`，正式数据零写入；
- apply：C3-A01—C3-A24，`24 / 24 PASS`；
- apply 后幂等复读：`apply-noop`，Formal Store revision 保持 `1965`；
- 五份脱敏错题离线 Shadow：意图一致 `5 / 5`、通用兜底 `0 / 5`、答案链泄露 `0 / 5`。

### 3.2 工程回归

| 验收集 | 结果 |
| --- | --- |
| Stage 2 Action Contract | `24 / 24 PASS` |
| Rubric Projection Stage 1 | `30 / 30 PASS` |
| Grounding / Action Plan Stage 2 | `30 / 30 PASS` |
| Narrative / Student Surface Stage 3 | `36 / 36 PASS` |
| Real Trial Control Stage 4 | `24 / 24 PASS` |
| Question Resource Admission | `29 / 29 PASS` |
| Formal-resource latest-quality admission | `11 / 11 PASS` |
| Question optimization baseline audit | `PASS`，issues `0` |
| Formal Resource Historical Audit | `PASS`，无 critical consistency issue |
| Production Build | `PASS` |

### 3.3 学生可见边界

学生可见输出只保留固定思考动作：

> 选择一个尚未完成的要求维度补充说明。

以下信息泄露均为 `0`：

- `feedbackActionCode`、Schema Version、disclosure policy；
- Rubric Item ID、完整 Rubric、`acceptedSignals`；
- “正确答案是—依据是—这说明”的答案组合链；
- 未选中的评分项或长期能力结论。

## 四、现场运行边界

Wave A 写入使 Formal Store revision 从 `1964` 变为 `1965`。因此，任何绑定 revision `1964` 的既有 Runtime Identity、Preflight、Launch Record 和 Trial Identity Binding 都已经过期，不能沿用。

执行后的只读 Runtime 检查结果为：

```text
CHECK_DEGRADED
reasonCodes = [ai_provider_not_configured]
```

所以本报告不授权真实 Trial，也不生成新的真实校准分母。即使历史 Trial 控制文件仍记录过一次 `real_trial` 请求，其身份已与当前 Formal Store 不一致，必须由运行时边界拒绝，不能作为当前激活证明。

## 五、回滚

需要回滚时，只允许：

1. 将 `resource-observation-task-plan-1q9udud` 的 Registry current head 指回 v1；
2. 恢复 v1 为 current frozen lifecycle 状态；
3. 将 v2 的活动资源—观测 Link 转回 v1 Link；
4. 保留 v2、validation、review、quality trace 和命令 receipt，不删除或覆盖历史证据。

## 六、后续任务

当前可继续二选一，但不能直接进入真实 Trial：

1. **Stage 3 Wave B 内容生产**：为其余四个 Action Code 各生产一个受控原创、原子化的候选资源，再分别准入；
2. **Wave A 限定 Trial 重准入**：先提交并冻结当前工程与报告，再配置 Provider，基于 Git Commit + Formal Store revision 1965 重建 Runtime Identity，重新执行 R4-P01—P24、Preflight、Launch Record 与 Trial Binding，限定 scope 只包含 Wave A v2 后显式激活。

在选择并完成其中一条路径前，产品状态保持：`WAVE_A CONTENT READY / REAL TRIAL OFF`。
