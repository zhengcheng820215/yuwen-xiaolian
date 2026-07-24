# Phase 17.4A Shared Store Engineering Debug 验收记录

日期：2026-07-24

结论：`ENGINEERING + AUTOMATED DEBUG + STANDARD-BROWSER BASELINE CUTOVER PASS / DUAL-BROWSER HUMAN CHECK PENDING`

## 一、实现范围

本次实现建立了：

- 本机共享正式资源 Store；
- Local Resource API；
- Question Resource 与 Material Observation Repository Adapter；
- revision 冲突阻断、原子写入、基本备份和失败回滚；
- 浏览器旧 IndexedDB 完整快照导出；
- 人工确认后的唯一共享基线初始化；
- Shared Store 未初始化时的兼容读取；
- API 不可用时的正式写入阻断。

本次没有自动选择权威数据，也没有合并内置浏览器与标准浏览器的旧资源。

## 二、Debug 结果

Phase 17.4A 专项：

```text
9 / 9 PASS
```

相关资源链回归：

```text
22 / 22 PASS  Question Resource Admission
26 / 26 PASS  Material Observation
13 / 13 PASS  Material Resource Production
 5 / 5 PASS   Material Resource Workbench State
17 / 17 PASS  Phase 17.3 Batch A Integration
 5 / 5 PASS   Phase 17.3 /learning Entry
```

生产构建：`PASS`

构建仅保留既有的大 Chunk 与动态导入提示，不影响本次验收。

Vite Local Resource API 隔离冒烟：`PASS`

```text
GET /__runtime/phase17-4/formal-resources
-> schemaVersion: 17.4A-v1
-> initialized: false
-> revision: 0
```

冒烟测试使用临时 Store Path，未读取或改写真实浏览器旧数据。

新增回归项：

```text
A9 split UTF-8 request chunks preserve Chinese content  PASS
```

该用例覆盖中文字符跨网络数据块边界时的请求体解码，确保共享存储不会写入 Unicode 替换字符。

## 三、真实基线切换

已完成：

1. 指定标准浏览器 `http://127.0.0.1:5174` 为正式基线来源；
2. 导出标准浏览器完整快照；
3. 完成 Stable ID 与结构完整性校验；
4. 初始化 Shared Store 并建立 `.bak` 基本备份；
5. 修复并回归验证 UTF-8 网络分块解码；
6. 恢复受影响字段，同时保留基线切换后新增的正式版本与关联；
7. 确认共享正式资源中 Unicode 替换字符数量为 `0`。

当前共享资源：

```text
学习材料              6
训练计划              6
训练任务             23
题目 Draft            9
Frozen Version        9
Registry Entry        9
Observation Link      9
```

## 四、剩余人工验收

在恢复规模化录题前仍需：

1. 在内置浏览器导出并保留旧资源快照；
2. 验证两个浏览器刷新后读取同一数量、Stable ID 与 Registry Head；
3. 验证一端新增后另一端刷新可见；
4. 重启真实开发服务并确认正式资源保持。

## 五、准确声明

当前可以声明：

> 本机共享正式资源持久化的工程基础、自动化可靠性验证与标准浏览器基线切换已经通过。

当前不能声明：

> 双浏览器真实人工一致性验收已经全部完成，或 Phase 17.4A 已最终冻结。
