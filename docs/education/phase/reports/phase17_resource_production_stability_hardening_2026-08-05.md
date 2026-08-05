# Phase 17 资源生产稳定性加固记录（2026-08-05）

状态：COMPLETED

## 目标

本轮不新增产品能力，只收口统一资源生产工作台在两次架构调整后的稳定性门禁：

- Candidate 生成、优化、采用与冲突处理；
- 单题命令并发、重复点击、失败恢复与刷新恢复；
- 批量提交的幂等、部分失败和阶段续跑；
- Human Review、Freeze、Formal Version、Registry 与学习入口串联；
- 历史正式资源的一致性与本地读取性能基线；
- 旧人工编辑、旧审核入口和重复状态计算的不可达性。

## 统一回归门禁

`debug:unified-resource-production-final` 增补以下高风险套件：

- Question Candidate Workflow；
- Candidate Optimization Agent；
- Candidate Workbench P3-P6；
- Task Group Submission；
- Question Workbench Loading Recovery。

上述能力不再仅由分散脚本覆盖，而是进入 P0-P7 最终串联门禁。

## 历史资源只读审计

新增 `audit:formal-resource-history`，默认读取：

`.local-data/formal-resource-store.json`

阻断项：

- 重复 Formal Resource Version 身份；
- 重复 Registry Resource 身份；
- active Registry 缺少当前版本；
- Registry 当前版本不存在、资源身份不一致或不是 frozen；
- Formal Version 引用的 Validation / Human Review 不存在。

兼容提醒：

- 历史 frozen 资源缺少 `hint_policy:*` 时，仅记录 `legacy_hint_policy_defaulted`；
- Runtime 继续使用已冻结的兼容默认策略，不修改历史正式资源。

## 性能基线

历史审计记录存储文件读取与 JSON 解析/索引耗时。当前 2000 ms 仅作为防止意外退化为二次扫描的回归警戒线，不作为生产 SLO。

## 验收结果

### 统一串联

- `debug:unified-resource-production-final`：26 / 26 套件通过；
- 覆盖 Candidate 生成/优化/采用、并发命令、批量提交、检查恢复、最终确认、发布恢复、学习入口与旧流程关闭；
- 重复点击、Revision 冲突、阶段失败和幂等重试均由现有专项套件进入统一门禁。

### 历史资源

- 本地存储大小：1,269,545 bytes；
- Formal Version：28；
- Registry Entry：26，active 26；
- 重复身份：0；
- active Registry 缺少当前版本：0；
- Registry 当前版本缺失或非 frozen：0；
- Formal Version 引用的 Validation / Human Review 缺失：0；
- 历史 `hint_policy` 兼容提醒：25，不影响当前 Runtime 消费，不回写历史资源。

### 本地读取

- 文件读取：4.82 ms；
- JSON 解析与索引：3.17 ms；
- 合计显著低于 2000 ms 回归警戒线。

以上耗时仅代表本次本机数据规模的工程基线，不替代服务端生产监控。

### Learning 材料自然段呈现修复

问题表现：正式资源进入 `/learning` 后，阅读材料显示为一个连续文本块，学生无法识别源材料中的自然段。

根因确认：`.local-data/formal-resource-store.json` 中的正式材料仍完整保留 `\n\n` 段落边界；问题位于展示层，普通块级元素按 HTML 默认规则折叠了换行，不属于正式资源污染或读取丢失。

工程处理：

- 新增共享 `ReadingMaterialText` 组件，在展示边界统一换行格式、切分非空自然段并使用独立 `<p>` 节点渲染；
- 每个自然段使用两字符首行缩进和稳定段间距；
- `Phase163LiveLearningWorkspace`、`LearningTaskWorkspace` 与 `StudentLearningEntryDemo` 统一接入该组件；
- 不修改、不迁移、不回写正式材料数据。

验收结果：

- `debug:phase17-3-learning-entry`：11 / 11 通过；
- `npm run build`：通过；
- 浏览器检查确认多段材料形成多个段落节点，段落间距与首行缩进生效；
- 刷新后段落结构保持不变，浏览器控制台无新增 warning 或 error。

## 冻结原则

1. 审计脚本只读，不修订、不迁移、不补写历史正式资源。
2. 兼容性缺省与数据断链必须分级，不能将旧字段缺省误判为资源污染。
3. 最终回归必须覆盖生成、采用、检查、确认、发布、学习消费和失败恢复。
4. 新功能测试未进入统一门禁，视为尚未完成工程收口。
5. Learning 展示层必须保留正式材料的自然段边界；段落渲染缺陷不得通过改写正式资源数据修复。
