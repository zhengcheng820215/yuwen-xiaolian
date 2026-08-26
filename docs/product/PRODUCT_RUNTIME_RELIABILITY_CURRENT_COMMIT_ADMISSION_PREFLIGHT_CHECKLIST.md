# 当前 Commit 真实 Trial 准入前执行清单

英文名称：Current Commit Real Trial Admission Preflight Checklist

对应契约：`product_runtime_reliability_and_real_trial_reentry_v1`

清单版本：`current_commit_admission_preflight_checklist_v1`

状态：`READY FOR EXECUTION / NOT YET RUN / REAL TRIAL OFF`

日期：2026-08-26

评估基线 Commit：`244bca2b347b618fa84a8b9fda71f5819279620f`

最终准入 Commit：`TBD_AFTER_DOCUMENT_CLOSEOUT_COMMIT`

关联文档：

- [产品运行可靠性与真实 Trial 重新准入契约](./PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md)
- [WP-R4 Trial 重新准入工程与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R4_TRIAL_REENTRY_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R5 真实学习烟测工程与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R5_REAL_LEARNING_SMOKE_ENGINEERING_AND_DEBUG_PLAN.md)
- [真实 Trial 准入激活执行规程](./PRODUCT_RUNTIME_RELIABILITY_REAL_TRIAL_ADMISSION_ACTIVATION_RUNBOOK.md)

## 一、使用说明

本清单将 `244bca2` 作为本轮文档评估基线。由于本文件和 RH-L17 收口本身会产生新的 Git Commit，`244bca2` 不得被直接写入最终 Launch Record。完成文档提交后，必须重新读取新的 clean HEAD，并以该 HEAD 的 Production Artifact 生成 Runtime Identity。

任何一项硬门禁失败时，准确终态都是：

```text
ADMISSION BLOCKED
REAL TRIAL OFF
LEARNING OWNER FACT UNCHANGED
```

不得跳过失败项，不得使用 Fixture、旧 Digest、旧 Window、旧 Launch、旧 Binding 或手工环境标记代替真实证据。

## 二、当前现场基线

| 检查项 | 2026-08-26 现场结果 | 结论 |
| --- | --- | --- |
| Git HEAD | `244bca2` | 文档评估基线；不是最终准入 Commit |
| Worktree | 拉取后为 clean；本轮文档修改后将变为 dirty | 必须提交后重新确认 |
| Node 版本 | `.nvmrc = 24.16.0` | 执行环境必须对齐 |
| Runtime 5174 | 未运行，Health 与 Identity 均不可连接 | 当前不得执行准入 |
| WP-R3 | 工程与隔离验收完成 | 具备身份和自动失效能力 |
| WP-R4 | 工程与隔离验收完成 | 具备准入控制面；尚未真实激活 |
| WP-R5 | RH-L01—RH-L17 已冻结 | 尚未执行真实烟测 |
| Provider live verification | 当前没有现场成功证据 | 硬阻断，必须真实验证 |
| Trial | 文档与历史报告均为 off；当前 Runtime 未运行，尚不能现场复读 | 启动后必须确认 off / off |

## 三、Gate 0：文档提交与最终 Commit 冻结

- [ ] G0-01 RH-L01—RH-L17 在主契约、WP-R5、执行清单中一致；
- [ ] G0-02 主契约状态统一为 `WP-R5 DESIGN FROZEN AND AUTHORIZED`；
- [ ] G0-03 旧 `4d016c6` 被明确标记为历史问题证据；
- [ ] G0-04 本轮文档修改完成 `git diff --check`；
- [ ] G0-05 提交并推送文档收口；
- [ ] G0-06 重新拉取远端并确认无分叉；
- [ ] G0-07 记录最终准入 Commit：`________________`；
- [ ] G0-08 `git status --porcelain` 为空。

若 G0-08 不通过，允许继续文档或工程调试，但禁止生成合格 Runtime Identity、保存准入包或激活 Trial。

## 四、Gate 1：环境与依赖

- [ ] G1-01 Node.js 为 `v24.16.0`；
- [ ] G1-02 `package-lock.json` 与 `package.json` 一致；
- [ ] G1-03 依赖来自当前 Lockfile，没有临时替换包；
- [ ] G1-04 5174 没有未知进程占用；
- [ ] G1-05 Runtime 仅计划绑定 `127.0.0.1:5174`；
- [ ] G1-06 Provider 凭证只在启动进程环境中注入，未写入仓库、日志或截图；
- [ ] G1-07 当前浏览器没有仍为 active / real_trial 的旧 Window；若存在，先使用单向失效流程关闭并保留历史。

建议只读命令：

```powershell
node --version
git status --porcelain
git rev-parse HEAD
npm run runtime:check
```

## 五、Gate 2：自动化与旧主链回归

以下命令必须全部退出码为 `0`，并把实际数量写入执行报告，不得复制历史报告的预期数字：

```powershell
npm run debug:product-runtime-reliability-wp-r0
npm run debug:product-runtime-reliability-wp-r1
npm run debug:product-runtime-reliability-wp-r1-launcher
npm run debug:product-runtime-reliability-wp-r2
npm run debug:product-runtime-reliability-wp-r3
npm run debug:product-runtime-reliability-wp-r4
npm run debug:product-runtime-trial-control
npm run debug:product-complexity-convergence-stage4-real-trial-preflight
npm run debug:learning-session-task-queue
npm run debug:phase16-3-unified-entry
npm run debug:phase16-3-real-chain
npm run debug:phase16-3-day0-integration
npm run debug:learning-feedback-presentation
npm run debug:reading-single-choice-stage4
npm run debug:material-resource-workbench-state
npm run debug:material-resource-workbench-selection
```

- [ ] G2-01 WP-R0—R4 全部通过；
- [ ] G2-02 Trial Control 与旧 Stage 4 Preflight 通过；
- [ ] G2-03 固定题组 Frozen Version、历史 Session 恢复和下一题直接消费回归通过；
- [ ] G2-04 Terminal Exit 后不再恢复同一 Session；
- [ ] G2-05 单选学生反馈没有内部审核口吻或文本修订要求；
- [ ] G2-06 Workbench 与正式资源链零回归；
- [ ] G2-07 回归期间没有真实 Trial、Observation 或学生事实写入。

## 六、Gate 3：Production Build 与 Runtime Identity

严格按以下顺序执行：

```powershell
npm run build
npm run build:product-runtime-identity
```

- [ ] G3-01 Production Build 成功；
- [ ] G3-02 只保留已知且已披露的非阻断构建提示；
- [ ] G3-03 `dist/.runtime/product-runtime-identity.json` 已生成；
- [ ] G3-04 Identity Schema 为 `product_runtime_identity_v1`；
- [ ] G3-05 Identity evidence 的 Git Commit 等于 G0-07；
- [ ] G3-06 `worktreeState = clean`；
- [ ] G3-07 Runtime Identity 可复算且 Digest 一致；
- [ ] G3-08 Source、Lockfile、Build Config、Artifact、Formal Resource、Executable Policy、Trial Policy、Provider Boundary 八项摘要齐全；
- [ ] G3-09 Identity 与报告不含绝对用户路径、凭证、答案或正文。

生成 Identity 后禁止继续修改源码、策略、正式资源或准入文档。任何变化都必须回到 Gate 0，并废弃本次尚未激活的准入准备结果。

## 七、Gate 4：Provider 真实可用性验证

`PRODUCT_AI_PROVIDER_AVAILABILITY_VERIFIED=true` 是受控真实探测成功后的输入证据，不是验证动作本身。

- [ ] G4-01 Provider Key 已配置但未输出内容或长度；
- [ ] G4-02 使用当前 Provider Boundary 发起一次受控、最小、非学生作答的真实请求；
- [ ] G4-03 验证响应来自期望 Provider / Model，格式有效且在允许超时内完成；
- [ ] G4-04 只记录 `live_verified / checkedAt / providerBoundaryDigest`，不记录原始敏感响应；
- [ ] G4-05 只有 G4-02—G4-04 全部成功后，才允许把成功证据注入同一 Runtime 启动环境；
- [ ] G4-06 启动后 Health 显示 `verificationLevel=live_verified`、`availabilityVerified=true`、`trialEligible=true`。

当前工程已经消费上述证据，但若没有能够生成并绑定该证据的受控探测流程，状态必须停在：

```text
ADMISSION BLOCKED / AI PROVIDER NOT LIVE VERIFIED / REAL TRIAL OFF
```

禁止直接手工设置成功标记以通过 G4-05。

## 八、Gate 5：Runtime 启动与只读健康复读

- [ ] G5-01 `npm run runtime:check` 返回允许启动的终态；
- [ ] G5-02 `npm run runtime:start` 在 `127.0.0.1:5174` 启动；
- [ ] G5-03 `GET /__runtime/health` 返回合法 Health Schema；
- [ ] G5-04 Instance、Formal Store、Learning 核心域为 ready；
- [ ] G5-05 Health 的 Build Identity 等于 G3 Runtime Identity Digest；
- [ ] G5-06 `GET /__runtime/identity` 返回同一有效 Identity；
- [ ] G5-07 Trial 为 `requestedMode=off / effectiveMode=off`；
- [ ] G5-08 除预期 `audit_evidence_incomplete / trial_reentry_required` 外没有降级或阻断原因；
- [ ] G5-09 Learning 与 Workbench 可打开，普通页面不显示 Trial 工程术语。

## 九、Gate 6：R4-P01—R4-P24 真实 Preflight

只允许从 Internal R4 v2 操作边界执行：

```text
http://localhost:5174/#/internal/product-complexity-convergence-stage4-preflight
```

- [ ] G6-01 记录 Preflight 前受保护写入基线；
- [ ] G6-02 页面读取的是当前 Health、Identity、Formal Snapshot 和 Registry，不是全通过 Fixture；
- [ ] G6-03 执行 R4-P01—R4-P24；
- [ ] G6-04 `24 / 24 PASS`；
- [ ] G6-05 `issueCodes = []`；
- [ ] G6-06 Preflight 未过期；
- [ ] G6-07 Formal、Session、Round、Attempt、Diagnosis、Feedback、Evidence、Profile、真实分母、Observation 写入均为 `0`；
- [ ] G6-08 任一失败时不显示保存或激活动作，Trial 保持 off。

## 十、Gate 7：准入包保存与显式激活

本阶段包含有限 Trial 控制面写入，必须由操作者显式执行。

- [ ] G7-01 创建新的 draft Trial Window，不复用旧 Window；
- [ ] G7-02 原子保存 Window / Preflight / Launch / Runtime Identity Binding；
- [ ] G7-03 四项身份一一对应，Runtime Identity Digest 完全一致；
- [ ] G7-04 保存后 Trial 仍为 off；
- [ ] G7-05 复读当前 Identity、Provider、Registry、策略、时间和保护写入基线均未变化；
- [ ] G7-06 操作者勾选确认；
- [ ] G7-07 显式激活；
- [ ] G7-08 Window=active、State=real_trial、Activation Audit 存在；
- [ ] G7-09 Runtime Identity alignment=aligned；
- [ ] G7-10 激活阶段学生 Owner Fact、Observation 与真实分母仍为 `0`。

若激活提交、复读或身份校验失败，立即执行失效服务回落 off；不得删除已经形成的审计事实。

## 十一、Gate 8：WP-R5 提交前边界

- [ ] G8-01 打开统一 Learning Entry；
- [ ] G8-02 RH-L01 Unified Entry 通过；
- [ ] G8-03 RH-L02 Formal Match 通过；
- [ ] G8-04 RH-L03 只创建或恢复一个活动 Session；
- [ ] G8-05 RH-L04 固定队列身份与顺序可追溯；
- [ ] G8-06 RH-L05 `question_presented` 只形成一次；
- [ ] G8-07 记录真实提交前的 Attempt、Evidence、Profile、Observation 和真实分母基线；
- [ ] G8-08 状态更新为 `AWAITING_REAL_STUDENT_ACTION`；
- [ ] G8-09 工程人员停止操作，不输入或提交答案。

## 十二、真实学生提交后的 RH-L06—RH-L17

只有真实学生自然提交后才执行：

- [ ] RH-L06 Valid Answer；
- [ ] RH-L07 Invalid Answer 的自动化既有证据仍有效，不要求学生故意触发；
- [ ] RH-L08 Attempt Idempotency；
- [ ] RH-L09 Diagnosis；
- [ ] RH-L10 Feedback；
- [ ] RH-L11 Next Task 准入；
- [ ] RH-L12 Round Complete；
- [ ] RH-L13 Refresh Recovery；
- [ ] RH-L14 Observation Fail-open；
- [ ] RH-L15 五项 Event Chain 身份、顺序与孤儿检查；
- [ ] RH-L16 Forbidden Writes；
- [ ] RH-L17 Terminal Exit：终止阻断态返回入口后，同一 Session 不再恢复到旧反馈页。

完成后输出只读执行报告；单次烟测只能证明链路成立，不能宣称教育效果、题目区分度、能力提升或 Trial 收益成立。

## 十三、立即停止条件

出现以下任一情况立即停止并保持或回落 Trial off：

- Worktree dirty、Identity missing / invalid / mismatch；
- Provider 未配置、未真实验证、超时或身份不符；
- Runtime、Formal Store 或 Learning 核心域非 ready；
- 存在旧 active Window；
- R4-P01—R4-P24 任一失败或 Preflight 过期；
- 出现第二个活动 Session、重复 Attempt 或孤儿事件；
- 下一题仅因队列位置存在就被错误投射为可进入；
- 终止阻断态返回后重新进入同一反馈页；
- Observation 反向阻断 Learning；
- 出现未授权 Formal、Evidence、Profile、Observation 或真实分母写入；
- 凭证、学生答案、材料正文、题目正文或绝对用户路径进入日志和报告。

## 十四、最终签署

```text
Final Commit: ________________________________
Runtime Identity Digest: sha256:_______________________________
Provider Live Verification: PASS / FAIL
Runtime Health: READY / DEGRADED / BLOCKED
R4-P01—R4-P24: ____ / 24 PASS
Approval Bundle: SAVED / NOT SAVED
Trial Effective Mode: OFF / REAL_TRIAL
WP-R5 State: NOT STARTED / AWAITING_REAL_STUDENT_ACTION / ACCEPTED
RH-L01—RH-L17: ____ / 17 PASS
Protected Unauthorized Writes: 0 / NONZERO
Operator: ____________________
Executed At: __________________
```
