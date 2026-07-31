# Phase 17.5C2 Assessment Persistence and Frozen Traceability 工程 Debug 验收记录

日期：2026-07-26

状态：ENGINEERING + AUTOMATED DEBUG PASS

## 一、完成范围

Phase 17.5C2 已完成：

- Shared Store Schema 从 `17.4A-v1` 增量升级到 `17.5C-v1`；
- 新增正式 `questionQuality` 集合；
- 确定性 Assessment、语义 Assessment 与 Bundle 的 Shared Store Repository；
- 相同身份相同内容幂等写入；
- 相同身份不同内容冲突阻断；
- Draft Revision 与规则身份隔离；
- 当前持久化 Bundle 的审核消费边界；
- Resource Version、Registry Head 与 Frozen Quality Trace 的原子提交；
- 写入失败时整个 Freeze 事务回滚；
- 历史 Frozen Resource 不反向伪造 Quality Trace；
- 重启后的 Assessment、Bundle 与 Trace 恢复。

## 二、专项 Debug

执行：

`pnpm run debug:phase17-5c2`

结果：

`17 / 17 PASS`

覆盖：

1. 17.4A Shared Store 增量迁移；
2. Deterministic Assessment 重启恢复；
3. Semantic Assessment 与 Bundle 重启恢复；
4. 相同内容幂等写入；
5. Identity Content Conflict 阻断；
6. 多 Draft Revision 保留与隔离；
7. Bundle 未保存时阻断批准；
8. Semantic Unavailable 阻断批准；
9. Revision Recommended 批准必须保留 Notes；
10. Version、Registry 与 Trace 原子 Freeze；
11. Frozen Trace 重启恢复；
12. 重复 Freeze 幂等；
13. 提交失败完整回滚；
14. Draft 修改后旧 Bundle 阻断；
15. 历史 Frozen Resource 不伪造 Trace；
16. Shared Store 乐观 Revision 冲突阻断。
17. 旧版质量规则结果不能授权当前审核。

## 三、回归结果

- Phase 17.4A Shared Formal Resource Persistence：`9 / 9 PASS`；
- Phase 17.5A Deterministic Quality Assessment：`12 / 12 PASS`；
- Phase 17.5B Review Consumption：`9 / 9 PASS`；
- Phase 17.5C1 Independent Semantic Assessment：`18 / 18 PASS`；
- Production Build：PASS。

构建仍存在既有非阻断警告：

- package 未声明 `type: module`；
- 一个动态导入同时被静态导入；
- 主 Chunk 超过 500 kB。

这些警告不是本次 C2 引入的功能失败。

## 四、准确能力声明

系统现在可以宣称：

> 当前 Draft Revision 的确定性质量评估、独立语义质量评估和组合 Bundle 能够作为正式质量事实写入 Shared Store，并可在服务重启后恢复。审核通过后的资源版本、Registry Current Head 与 Frozen Quality Trace 能够在同一原子提交中形成；冲突、旧 Revision、来源缺失或写入失败不会静默放行 Approve 或 Freeze。

系统仍不能宣称：

- 已完成批次质量摘要；
- 已完成固定十篇材料校准；
- 已证明生成题目的教学有效性；
- Phase 17.5C 已整体完成。

下一工程阶段为：

> Phase 17.5C3：Batch Quality Summary and Ten-material Calibration

## 五、2026-07-31 当前完整检查上下文一致性补充验收

### 问题

同一 Draft Revision 下可能同时存在：

- 一条较早的完整检查链；
- 一条较新的孤立确定性重试记录。

页面能够恢复完整链，但提交最终确认曾只读取最新确定性记录，继而错误报告
`Current semantic assessment result is required.`。这属于消费端选择规则分叉，不是内容污染。

### 修复

1. 持久化服务统一扫描当前 Revision 的全部确定性检查、语义检查和 Bundle；
2. 页面读取与提交最终确认共用首选完整链选择规则；
3. 新孤立记录不得遮蔽旧完整链；
4. 已进入审核生命周期的重复提交保持幂等；
5. Command 成功与后续页面刷新失败分开反馈；
6. 页面增加同步执行锁，防止快速重复触发。

### 自动化结果

- `debug:phase17-5c2`：`25 / 25 PASS`；
- 新增用例：`current quality context skips incomplete retry records`；
- `debug:question-workbench-command-e2e`：`7 / 7 PASS`；
- Production Build：PASS；
- `git diff --check`：PASS。

### 冻结结论

> 当前完整检查事实不再由“最新一条确定性记录”单独决定。页面、提交最终确认和后续发布门禁必须
> 消费同一条完整持久化检查链；孤立重试记录不得造成页面显示通过而 Command 报缺少语义结果。
