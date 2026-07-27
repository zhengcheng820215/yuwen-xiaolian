# Phase 17.4A 受控双端人工验收记录

日期：2026-07-27

验收对象：Local Shared Formal Resource Persistence

结论：`CONTROLLED DUAL-CLIENT HUMAN CHECK PASS`

## 一、验收边界

本轮在同一内置浏览器内使用两个独立页面，并增加一个独立 HTTP 客户端作为并发写入端，验证 Shared Store 的跨页面可见性、Revision 冲突、服务重启持久化和清理能力。

由于两个页面仍共享同一浏览器内核与会话，本轮不等同于“两个独立浏览器内核”的最终人工验收。严格的内置浏览器与 Chrome 或其他标准浏览器一致性确认仍为 `PENDING`。

## 二、验收结果

| Case | 结果 |
| --- | --- |
| 全新基线初始化并补齐完整 `questionQuality` | PASS |
| A 端写入后，B 端刷新读取同一数据 | PASS |
| B 端发布后，A 端刷新读取发布结果 | PASS |
| 使用旧 Revision 写入时返回 HTTP `409` | PASS |
| 重启本机开发服务后共享数据仍保留 | PASS |
| 删除验收临时素材并恢复正式数据 | PASS |

验收结束时共享正式数据为：

- Shared Store Revision：`46`
- 学习材料：`2`
- 学习任务：`8`
- 待审核题目：`3`
- 已发布题目：`1`

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

> 工程实现、自动化 Debug、正式基线切换、全新基线初始化和受控双端人工检查已通过；独立浏览器内核的最终一致性确认仍待完成。

在宣称 Phase 17.4A 最终完成或开始大规模正式资源生产前，仍需使用内置浏览器与一个独立标准浏览器完成一次简短的最终确认。
