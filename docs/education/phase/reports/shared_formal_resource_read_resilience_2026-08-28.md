# WP-C7 共享正式资源读取韧性工程与 Debug 验收记录

日期：2026-08-28

状态：ENGINEERING IMPLEMENTED / DEBUG ACCEPTED

## 一、问题与根因

Learning 正常作答期间偶发提示“共享资源服务读取超时，请重新尝试”。运行健康检查显示 Runtime、正式资源库与 Learning 均可读，正式数据没有丢失；真实接口随后连续返回 `200`。

根因是读取契约与当前快照规模不匹配：正式资源文件约 10.9MB，HTTP 紧凑响应约 7.9MB，而普通读取和正式写入共用 3 秒单次硬超时。冷启动、HMR、并发读取或浏览器主线程繁忙时，单次普通读取可能越过该边界并直接中断学习界面。

## 二、工程边界

本次只调整普通只读链路：

1. 普通读取总预算调整为 8 秒，最多分为 2 次各 4 秒尝试；
2. 仅明确读取超时自动重试 1 次；
3. 同一运行实例存在最近有效快照时，两次均超时可短时回退该快照；
4. 并发读取继续合并，不制造请求风暴；
5. 权威无缓存读取、Mutation、POST 与发布后置检查继续使用 3 秒严格边界；
6. 缓存回退不得证明最新 Revision，不得触发任何正式写入或成功投影；
7. 不改 Material → Plan → Task → Candidate → Publish → Learning 主链，不迁移或覆盖 Frozen Resource。
8. Learning Entry 仅将“正式任务”阶段放宽到 9 秒、入口总预算放宽到 10 秒；其他本地状态读取仍保持 4 秒，避免无关故障拖长等待。

## 三、Debug 验收矩阵

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| C7-01 | 第一次普通读取超时，第二次成功 | 透明返回第二次结果，请求数为 2 |
| C7-02 | 两次普通读取均超时，无缓存 | 有界返回读取超时 |
| C7-03 | 两次普通读取均超时，有过期有效缓存 | 返回缓存快照，不抛页面错误 |
| C7-04 | 三个调用方并发普通读取 | 共享同一 Pending / Retry 序列 |
| C7-05 | `bypassCache=true` 权威读取超时 | 单次失败，不重试、不回退 |
| C7-06 | POST / Atomic Command 超时 | 维持 3 秒严格失败边界 |
| C7-07 | 服务不可用或结构错误 | 不伪装成超时重试 |
| C7-08 | 真实大快照连续读取 | HTTP 200，数据 Revision 与健康状态一致 |
| C7-09 | Learning Entry 与写入并发回归 | 全部通过，零领域写入副作用 |
| C7-10 | 生产构建 | PASS |

## 四、完成定义

只有代码、契约、自动化测试和真实接口计时均满足上述边界，才能关闭该问题。若后续快照持续增长导致 P95 接近 8 秒，应优先建设按消费者裁剪的只读投影接口，而不是继续无限提高超时。

## 五、验收结果

- Unified Learning Entry Debug：`31/31 PASS`；
- Shared Formal Resource Mutation Queue Debug：`10/10 PASS`；
- Structured Runtime Error Contract Debug：`11/11 PASS`；
- 生产构建：`PASS`；
- Runtime Health：Formal Resource Store `ready`，Learning `ready`，正式资源 Revision `1963`；
- 真实正式资源接口：并发 3 次均返回 `HTTP 200`，单次响应 `7,928,338` bytes，耗时分别约 `0.133s / 0.134s / 0.130s`；
- `git diff --check`：`PASS`。

结论：本次问题按“普通读取韧性增强、权威读取与写入严格边界不变”完成收口。Runtime 整体仍显示 `degraded` 的原因是 Trial Runtime Identity 尚未重新准入，与本次正式资源读取超时无关；正式资源与 Learning 可用性均已验证正常。
