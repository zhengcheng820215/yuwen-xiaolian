# Phase 17.5C3B Ten-material Calibration Runtime 工程 Debug 验收记录

日期：2026-07-26

结论：`ENGINEERING RUNTIME + AUTOMATED DEBUG PASS`

真实校准状态：`REAL TEN-MATERIAL CALIBRATION PENDING`

真实材料准备度：`3 / 10`

## 完成范围

- 新增 `TenMaterialCalibrationManifest`，固定校准集、十个 Material Version 和 Provider / Model / Prompt / Rule 基线；
- 新增 `TenMaterialCalibrationReport`，记录系统硬检查、质量快照、人工观察、决定、调整对象与签署身份；
- 实现八项系统硬检查；
- 任一硬检查失败时，只允许形成 `fail`；
- `conditional_pass` 与 `fail` 必须指出 Adjustment Target；
- Calibration Manifest 与 Report 接入 Shared Store 和 Repository；
- Manifest、Summary、Report 支持幂等保存与重启恢复；
- 相同身份、不同内容明确阻断；
- 校准过程不修改既有 Summary、Review 或 Freeze 事实。

## 专项 Debug

命令：

```text
pnpm run debug:phase17-5c3b
```

结果：`16 / 16 PASS`

覆盖：

1. 恰好十篇且版本唯一的 Manifest 可建立；
2. 九篇材料明确阻断；
3. 重复 Material Version 明确阻断；
4. 八项系统硬检查可全部成立；
5. 缺失材料时强制 `fail`；
6. Semantic Provider 混用时强制 `fail`；
7. Frozen Trace 缺失时强制 `fail`；
8. 重复 Summary 统计漂移时强制 `fail`；
9. 人工签署身份必填；
10. `fail` 必须声明 Adjustment Target；
11. `conditional_pass` 必须声明 Adjustment Target；
12. `conditional_pass` 必须保留限制或复核说明；
13. 相同输入形成稳定 Report Identity；
14. 同一 Manifest Identity 的版本内容替换被阻断；
15. Manifest、Summary、Report 可持久化并在服务重启后恢复；
16. 校准不修改来源 Summary 与 Frozen Trace。

## 回归

- Phase 17.5C3A：`13 / 13 PASS`
- Phase 17.5C2：`17 / 17 PASS`
- Phase 17.5C1：`18 / 18 PASS`
- Phase 17.5B：`9 / 9 PASS`
- Phase 17.5A：`12 / 12 PASS`
- Phase 17.4A Shared Store：`9 / 9 PASS`
- Production Build：`PASS`

构建保留既有非阻断提示：一个动态导入不能拆分 Chunk，以及主 Chunk 大于 500 kB。

## 边界

本次没有：

- 选择或虚构正式十篇材料；
- 调用真实 Provider 完成十篇材料校准；
- 记录真实人工保留率、修改率、拒绝率或审核时长；
- 形成正式校准签署；
- 自动修改、删除、审核或 Freeze 题目；
- 宣布 Phase 17.5C 整体完成。

## 当前材料基线

2026-07-26 检查 Shared Store：

- 可暂计入真实校准候选：3 份；
- AI 辅助项目原创材料：2 份，不计入本次真实十篇口径；
- 已停用重复材料：1 份，不计入；
- 尚需补充、复核并冻结：7 份真实材料。

正式运行前仍需冻结唯一的十篇材料 Manifest；在此之前不得开始计算正式校准结论。

准确状态：

> Phase 17.5C3B 的 Manifest、Report、系统检查与持久化 Runtime 已通过自动化 Debug；下一步仍需使用固定真实十篇材料执行校准，并由人工签署 `pass`、带限制的 `conditional_pass` 或 `fail`。
