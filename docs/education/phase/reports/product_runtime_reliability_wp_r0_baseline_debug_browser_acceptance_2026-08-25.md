# 产品运行可靠性 WP-R0 基线、Debug 与浏览器只读验收记录

日期：2026-08-25

状态：`WP-R0 ENGINEERING COMPLETE / DEBUG ACCEPTED / READ-ONLY VERIFIED / WP-R1 AUTHORIZED`

对应契约：

- `product_runtime_reliability_and_real_trial_reentry_v1`
- `product_runtime_reliability_wp_r0_v1`
- `product_runtime_baseline_audit_v1`
- `product_runtime_reason_registry_v1`
- `dynamic_formal_resource_baseline_v1`

## 一、验收结论

WP-R0 已完成版本化运行基线 Schema、22 个冻结 Reason Code、Runtime Dependency Inventory、动态正式资源基线、运行身份输入审计、只读内部验收页以及零写入校验。

本轮结论仅为：

```text
WP-R0 ENGINEERING COMPLETE
DEBUG ACCEPTED
READ-ONLY VERIFIED
WP-R1 AUTHORIZED
```

本轮没有启动 5174、没有修复 Runtime、没有修改普通 Learning / Workbench 页面、没有写入真实学习事实，也没有重新激活 Trial。

## 二、Git、构建与运行身份

| 项目 | 观测值 | 结论 |
| --- | --- | --- |
| Git HEAD | `4d016c6c97edf7abd673f4c350c9d57b2ae06806` | 已读取 |
| Worktree | `dirty` | 如实披露本轮未提交工程改动 |
| 当前 Build Version | `product-complexity-convergence-preflight-build-v1` | 固定字符串，不能单独证明当前构建身份 |
| Trial Launch Commit | `119a019da59e7835bd01fbacf2604b5a9b687e34` | 与当前 HEAD 不一致 |
| Trial 身份 | `mismatch / reentry_required` | Learning 可继续，Trial effective mode 应保持 `off` |
| Production Build | `PASS` | 2,228 modules；保留既有混合导入与大 Chunk 提示 |

## 三、Runtime Dependency Inventory

| 依赖 | 状态 | 证据或 Reason Code |
| --- | --- | --- |
| Node Runtime | `ready` | Node `v24.19.0` |
| 项目依赖 | `ready` | dependencies present |
| Vite Runtime `:5174` | `not_running` | `runtime_unreachable` |
| Shared Formal Resource Store | `ready` | initialized，revision `1963` |
| Shared Formal Resource Boundary | `not_running` | `formal_resource_boundary_unavailable` |
| AI Provider | `not_configured` | 仅检查配置状态，未读取或输出密钥 |
| Browser Persistence | `not_checked` | CLI 不猜测浏览器持久化状态 |
| Trial Observation | `degraded` | `trial_reentry_required`，不阻断 Learning |

## 四、动态正式资源基线

基线由执行时 Shared Formal Resource Store 动态读取，未使用固定题量作为通过条件。

| 指标 | 观测值 |
| --- | ---: |
| Store Revision | 1963 |
| 活动材料 | 24 |
| 核心阅读材料 / Targeted Excerpt | 12 / 12 |
| Current Plan / Current Task | 24 / 81 |
| Registry / Version / Link / Trace / Consumable | 81 / 81 / 81 / 81 / 81 |
| 最新质量 | 65 ready / 16 guidance / 0 blocked |
| 作答形式 | 31 long_text / 18 single_choice / 32 short_text |
| 难度 | 42 basic / 30 intermediate / 9 advanced |
| 基线一致性问题 | 0 |

当前 Store 快照基线 Digest 为 `fnv1a-04905520`。该 Digest 排除审计时间，因此相同正式事实在不同执行时间得到相同结果；数量只作为本次观测证据，未来数据变化时审计应生成新动态基线。

## 五、自动化与浏览器验收

### 5.1 WP-R0 专项

| 矩阵 | 结果 |
| --- | --- |
| R0-C01—R0-C32 | `32 / 32 PASS` |
| R0-B01—R0-B12 | `12 / 12 PASS` |

浏览器只读走查记录：

- 当前 URL：`http://localhost:5174/learning#/learning`；
- 可见状态：`暂时无法打开学习入口`；
- 辅助文案：`正式任务暂时无法读取，请重新尝试。`；
- 未点击“重新尝试”，未新建重复页面，未提交、发布、恢复、删除或激活；
- 页面状态与只读 Boundary 探测均支持 `runtime_unreachable`；
- 旧页面仍可见不被解释为 Runtime ready。

### 5.2 旧主链回归

| 回归项 | 结果 |
| --- | --- |
| Question Optimization Baseline Audit | PASS，read-only |
| Current Question Generation Quality Audit | PASS，read-only |
| Formal Resource Latest Quality Admission | `8 / 8 PASS` |
| Material Corpus Maintenance | PASS，dry-run，No data was changed |
| Resource Coverage | `22 / 22 PASS` |
| Material Resource Workbench State | `25 / 25 PASS` |
| Unified Learning Entry | `27 / 27 PASS` |
| Learning Session Task Queue | `21 / 21 PASS` |
| Phase 16.3 Day 0 Integration | `15 / 15 PASS` |
| Product Complexity Convergence Stage 4 | `64 / 64 PASS` |
| Real Trial Preflight | `56 / 56 PASS` |
| Production Build | PASS |

历史 Provenance 测试中存在固定 `12` 条材料断言，审计登记为 `fixed_baseline_assertion`，未通过改写正式 Store 迎合旧断言。

## 六、零写入证明

审计前后正式资源 Revision 均为 `1963`，正式资源 Digest 均为 `fnv1a-a01af0ba`。零写入计数如下：

| 保护对象 | 写入数 |
| --- | ---: |
| Formal Resource | 0 |
| Attempt | 0 |
| Evidence | 0 |
| Profile | 0 |
| 真实校准分母 | 0 |
| Trial State | 0 |

结论：`zeroWriteComparison.verified = true`。

## 七、当前 Finding 与后续路由

| Finding | 优先级 | 后续工作包 |
| --- | --- | --- |
| `runtime_not_running` | P0 | WP-R1：统一启动器与 Runtime Health |
| `build_identity_not_content_addressed` | P1 | WP-R3：生成真实运行构建身份 |
| `trial_build_identity_stale` | P1 | WP-R3—WP-R4：身份校验与重新准入 |
| `dependency_status_unknown` | P2 | WP-R1：Health 与浏览器持久化只读证据 |
| `fixed_baseline_assertion` | P2 | WP-R6：移除历史固定数量断言 |

## 八、WP-R1 授权边界

WP-R1 仅获准实现：统一启动器、依赖预检、5174 端口与已运行实例判断、只读 `/__runtime/health`、ready / degraded / blocked 聚合、启动超时终态、AI 配置状态投射和 Internal Health 只读 API。

WP-R1 不得修改普通页面文案、生成最终 Product Runtime Identity、激活 Trial、提交真实答案、修复历史固定数量脚本或新增 Training Model 能力。

## 九、最终声明

WP-R0 已证明当前运行事实能够被稳定、可解释、只读地审计，且审计本身没有改变正式资源、学习事实、校准分母或 Trial 状态。

当前 Runtime 仍未运行，真实 Trial 仍需重新准入；两者不是 WP-R0 的已修复项。
