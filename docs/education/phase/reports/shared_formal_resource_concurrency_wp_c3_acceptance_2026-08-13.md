# WP-C3 共享正式资源并发可靠性验收报告

验收日期：2026-08-13
结论：PASS
适用范围：当前单人录入产品、同一浏览器多标签页、共享正式资源本地服务

## 一、自动化验收

统一入口：

```text
pnpm run accept:shared-formal-resource-concurrency-wp-c3
```

结果：9/9 测试套件通过，覆盖工程契约 12/12 自动化要求。

覆盖范围：

1. 页面正式写 FIFO；
2. 相同命令 Promise 合并；
3. 前 1–7 次 Revision Conflict 后恢复成功；
4. 第 8 次冲突结构化有界失败；
5. 冲突后无缓存重读并重新应用 Mutation；
6. 非 Revision Conflict 不重试；
7. 队首失败不阻塞后续写入；
8. 跨标签 Web Lock 串行与无锁降级；
9. BroadcastChannel 最小事件和缓存失效；
10. Candidate 采用、审核及发布中断后的幂等接续；
11. Frozen Version 孤立但 Link 缺失时只补 Registry/Link；
12. 发布后置条件失败时不投影成功、不计入已发布。

## 二、浏览器验收

浏览器原生能力 Smoke：4/4 通过。

- Web Locks 可用；
- 同名独占锁执行顺序正确；
- BroadcastChannel 可用；
- Revision 元数据事件可达。

双标签页协作验收：PASS。

- 标签 A 持有 `formal-resource-store-write-smoke-cross-tab`；
- 标签 B 后发请求进入等待，实测约 796ms 后取得锁；
- 标签 A 广播 Revision 965，标签 B 成功接收；
- 验收仅使用隔离 Smoke 锁名和 Channel，不修改现有正式资源数据。

## 三、回归与完整性

- WP-C0 页面队列：5/5；
- WP-C1 Mutation 队列：10/10；
- WP-C2 跨标签协调：12/12；
- 共享存储真实服务：14/14；
- Candidate 发布与中断恢复：16/16；
- Publication Recovery：3/3；
- 生产构建通过；
- `git diff --check` 通过。

未发现新增重复 Draft、Assessment、Review、Frozen Version 或 Observation Link。

## 四、产品结论与边界

WP-C0 至 WP-C3 已满足 P0 完成定义：同一页面、同一浏览器多标签页的正式资源写入具备串行协调、冲突自动恢复、缓存失效、幂等接续和明确有界失败能力。

本结论不等同于多人协作或跨设备分布式事务已成立。服务端原子业务命令与整库 Replace 退出仍属于 WP-C4（P1）。
