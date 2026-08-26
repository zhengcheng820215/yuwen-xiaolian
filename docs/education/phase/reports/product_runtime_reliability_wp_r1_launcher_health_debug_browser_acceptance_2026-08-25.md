# 产品运行可靠性 WP-R1 启动器、Health、Debug 与浏览器验收记录

日期：2026-08-25

状态：`WP-R1 ENGINEERING COMPLETE / DEBUG ACCEPTED / RUNTIME LAUNCH ACCEPTED / HEALTH READ-ONLY VERIFIED / WP-R2 AND WP-R3 AUTHORIZED`

> 快照边界：本文只记录 2026-08-25 验收时事实。“验收结束时保持运行”不表示后续任意时刻 Runtime 仍在运行；当前状态必须以 `runtime:check` 和 `/__runtime/health` 为准。

## 一、完成结论

WP-R1 已完成统一启动器、启动前预检、5174 端口安全分类、`product_runtime_health_v1`、GET-only `/__runtime/health`、Internal Health 页面和三组验收矩阵。

本轮没有修改 Learning / Workbench 普通页面投射，没有调用 AI Provider，没有提交真实答案，没有修改 Trial requested / effective mode，也没有改写正式资源。

## 二、统一启动验收

| 场景 | 实际结果 |
| --- | --- |
| `runtime:check`，端口空闲、AI 未配置 | `CHECK_DEGRADED`，不 Spawn |
| `runtime:start`，端口空闲 | `READY`，只 Spawn 一个 Vite Runtime |
| Runtime 已健康运行时再次启动 | `ALREADY_RUNNING`，`ownsChildProcess=false` |
| 标准端口 | `5174 / strictPort` |
| 统一入口 | Learning、Workbench、Internal Health、Health API 四个地址 |
| 未知进程策略 | 测试证明只阻断、不终止、不换端口 |

本次真实 Runtime 由 WP-R1 启动器启动，并在该次验收结束时保持运行。

## 三、当前 Health 事实

| 分域 | 当前状态 | 证据 |
| --- | --- | --- |
| Overall | `degraded` | 准确汇总下列非全绿事实 |
| Runtime | `ready` | `chinese_ability_growth_system_local_runtime`，port 5174 |
| Build Identity | `insufficient` | 当前仍不是内容寻址身份 |
| Formal Store | `ready` | initialized，revision 1963 |
| AI Provider | `not_configured` | configuration_only，未读取或输出 Key |
| Learning | `degraded` | 可读正式题；当前进程不允许进入需要 AI 的真实开始和诊断提交 |
| Trial | `mismatch / off` | Observation fail-open，仍需重新准入 |

当前动态正式资源：

```text
active materials: 24
current questions: 81
learning consumable: 81
formal baseline digest: fnv1a-04905520
health fact digest: fnv1a-2016f5ea
```

Health Fact Digest 排除 `checkedAt`；连续两次 GET 得到相同 `fnv1a-2016f5ea`。

边界补齐说明（2026-08-26）：后续 Health 投射额外区分 `availabilityVerified` 与 `trialEligible`。仅配置凭证仍不是实时可达性证明，也不能单独满足真实 Trial 准入。

## 四、HTTP Boundary 验收

| 项目 | 结果 |
| --- | --- |
| GET degraded | HTTP 200 |
| POST | HTTP 405 |
| Cache-Control | `no-store` |
| X-Content-Type-Options | `nosniff` |
| 敏感信息扫描 | API Key、答案、正文、绝对用户路径均未发现 |
| blocked Fixture | HTTP 503 + 合法最小 Health Schema |

## 五、专项验收

| 矩阵 | 结果 |
| --- | --- |
| R1-C01—R1-C36 | `36 / 36 PASS` |
| R1-L01—R1-L14 | `14 / 14 PASS` |
| R1-B01—R1-B14 Fixture | `14 / 14 PASS` |
| R1-B01—R1-B14 真实浏览器 | `14 / 14 PASS` |

真实浏览器验收曾发现 R1-B06 初次为 `13 / 14`：Browser Adapter 错用 `resourceVersionId` 读取 Registry Current Head；实际字段为 `currentFrozenVersionId`。修复验收投影后重新执行为 `14 / 14`。正式 Store 与 Health 数量从始至终均为 `24 / 81 / 81`，未修改数据。

## 六、核心回归

| 回归 | 结果 |
| --- | --- |
| WP-R0 Debug | `32 / 32 PASS` |
| WP-R0 Browser Matrix | `12 / 12 PASS` |
| Shared Formal Resource Persistence | `14 / 14 PASS` |
| Structured Runtime Error | `11 / 11 PASS` |
| Formal Resource Latest Quality Admission | `8 / 8 PASS` |
| Resource Coverage | `22 / 22 PASS` |
| Material Resource Workbench State | `25 / 25 PASS` |
| Unified Learning Entry | `27 / 27 PASS` |
| Learning Session Task Queue | `21 / 21 PASS` |
| Phase 16.3 Day 0 Integration | `15 / 15 PASS` |
| Product Complexity Convergence Stage 4 | `64 / 64 PASS` |
| Real Trial Preflight | `56 / 56 PASS` |
| Production Build | PASS，2,232 modules，保留既有混合导入和大 Chunk 提示 |

Production Bundle：JS `2,546.66 kB / gzip 669.17 kB`；CSS `65.46 kB / gzip 12.50 kB`。

## 七、零写入证明

Health 与浏览器验收前后：

```text
Formal Revision: 1963 → 1963
Formal Digest: fnv1a-a01af0ba → fnv1a-a01af0ba
Attempt writes: 0
Evidence writes: 0
Profile writes: 0
Real Calibration Denominator writes: 0
Trial State writes: 0
```

Health 使用 `SharedFormalResourceStore.readOnly()`。该路径不会执行旧格式迁移、备份恢复、初始化、replace、command 或 repair。

## 八、当前遗留与路由

| 遗留 | 优先级 | 后续 |
| --- | --- | --- |
| 当前启动进程 AI 未配置 | P0（真实 AI Learning 前） | 在受控启动环境配置；WP-R2 投射准确用户提示 |
| 普通 Learning 仍可能把 Runtime 问题表达成任务读取失败 | P1 | WP-R2 |
| Build Identity 非内容寻址 | P1 | WP-R3 |
| Trial identity mismatch / effective off | P1 | WP-R3—WP-R4 |
| 历史固定材料数测试 | P2 | WP-R6 |
| 既有 Chunk 和混合导入提示 | P2 | WP-R6 |

## 九、后续授权

WP-R2 获准实现 Learning / Workbench 故障分类、内容保留说明和恢复动作投射。WP-R3 获准实现内容寻址 Product Runtime Identity 与代码变化后的 Trial 自动失效。

WP-R1 完成不授权 Trial 重新激活，也不表示当前实例已具备真实 AI 作答条件。真实 Trial 仍须经过 WP-R3、WP-R4 和后续完整学习烟测。
