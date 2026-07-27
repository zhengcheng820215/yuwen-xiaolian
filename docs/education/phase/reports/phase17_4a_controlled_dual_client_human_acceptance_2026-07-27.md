# Phase 17.4A 双端与独立浏览器人工验收记录

日期：2026-07-27

验收对象：Local Shared Formal Resource Persistence

结论：`INDEPENDENT BROWSER-KERNEL CONSISTENCY PASS`

## 一、验收边界

本轮在同一内置浏览器内使用两个独立页面，并增加一个独立 HTTP 客户端作为并发写入端，验证 Shared Store 的跨页面可见性、Revision 冲突、服务重启持久化和清理能力。

受控双端检查之后，补充使用 Codex 内置浏览器与独立 Google Chrome 用户目录完成最终一致性确认。两个客户端不共享浏览器内核、页面进程、Cookie 或会话状态，只共享本机 Shared Store。

## 二、验收结果

| Case | 结果 |
| --- | --- |
| 全新基线初始化并补齐完整 `questionQuality` | PASS |
| A 端写入后，B 端刷新读取同一数据 | PASS |
| B 端发布后，A 端刷新读取发布结果 | PASS |
| 使用旧 Revision 写入时返回 HTTP `409` | PASS |
| 重启本机开发服务后共享数据仍保留 | PASS |
| 删除验收临时素材并恢复正式数据 | PASS |
| 内置浏览器写入，独立 Chrome 刷新可见 | PASS |
| 独立 Chrome 写入，内置浏览器刷新并选择最新版本可见 | PASS |
| 恢复验收前完整数据后，两端临时标记均为 0 | PASS |

验收结束时共享正式数据为：

- Shared Store Revision：`46`
- 学习材料：`2`
- 学习任务：`8`
- 待审核题目：`3`
- 已发布题目：`1`

独立浏览器确认过程：

- 验收前 Shared Store Revision：`46`；
- 内置浏览器保存临时版本后，独立 Chrome 刷新读取到标记，Shared Store Revision 为 `52`；
- 独立 Chrome 保存反向临时版本后，Shared Store Revision 为 `58`；
- 内置浏览器刷新并选择最新版本后读取到 Chrome 写入标记；
- 使用验收前完整快照恢复正式数据后，Shared Store Revision 为 `59`；
- 两端最终均显示学习材料 `2`、学习任务 `8`、待审核题目 `3`、已发布练习 `1`，且不存在验收临时标记。

## 三、发现的问题

1. 页面展示的 Revision 在其他客户端写入后不会自动变化，需要刷新后更新；
2. 重复材料被拒绝时，页面仍可能暴露 `RUNTIME_OPERATION_FAILED` 等内部错误标识。

上述问题不影响 Shared Store 的数据一致性结论，但属于后续交互文案与实时状态提示优化项。

## 四、阶段判断

本轮证明了：

```text
Client A Write
-> Shared Store
-> Client B Read
-> Revision Conflict Protection
-> Service Restart Persistence
```

因此 Phase 17.4A 可记录为：

> 工程实现、自动化 Debug、正式基线切换、全新基线初始化、受控双端检查与独立浏览器内核一致性确认均已通过。

Phase 17.4A 的独立浏览器人工验收门已关闭。Shared Store 仍属于本机封闭 Beta 基础设施，不等同于多设备云同步，也不替代 Phase 17.4B 的迁移与恢复加固。
