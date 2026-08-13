# WP-C4 共享正式资源原子命令验收报告

验收日期：2026-08-13
结论：PASS
实现阶段：原子集合命令迁移层

## 一、实现结果

共享正式资源服务新增 capability：

```text
atomicCollectionPatch: 1.0
```

客户端每次执行既有领域 Mutation 后，只计算并提交发生变化的领域集合，不再向支持新能力的服务发送完整正式资源快照。服务端在自身 FIFO 写队列中完成：

```text
读取最新快照
→ 校验 expected Revision
→ 校验 command identity
→ 应用集合 Patch
→ 执行全库结构与唯一性校验
→ 单次原子提交
→ 返回 command receipt
```

命令回执持久化在正式快照中，最多保留最近 500 条；同一 command ID 与相同内容在服务重启后仍复用原提交，同一 ID 不同内容被阻断。

## 二、兼容与退出策略

- 服务明确声明 `atomicCollectionPatch` 时，客户端必须使用原子命令；命令失败不得静默改走整库 Replace；
- 旧服务未声明 capability 时，客户端继续使用 WP-C0～C3 保护下的 Replace 兼容路径；
- `initialize`、备份恢复以及旧版本兼容仍保留整库边界；
- 当前迁移层已经退出高频领域 Mutation 的整库传输，但不是最终细粒度业务 endpoint；后续可以在相同 capability 协商机制上继续拆分 `save-plan`、`save-draft`、`commit-publication` 等命令。

## 三、验收结果

`pnpm run debug:shared-formal-resource-atomic-command-wp-c4`：12/12 通过。

覆盖：

- 原子集合提交；
- 多集合统一校验与一次提交；
- 相同命令幂等；
- 服务重启后回执仍有效；
- command ID 内容冲突阻断；
- 非法集合命令原子回滚；
- capability 协商；
- 已声明能力时禁止静默回退；
- 旧服务 Replace 兼容；
- command receipt 身份校验；
- Revision 冲突继续由 WP-C1 有界恢复。

共享真实服务回归 14/14、WP-C3 并发矩阵 12/12、生产构建均通过。

## 四、产品边界

WP-C4 完成的是本地共享正式资源服务的原子命令迁移层与高频整库 Replace 退出。它不代表多人权限、远程数据库事务、跨设备分布式锁或云端审计系统已经建立。
