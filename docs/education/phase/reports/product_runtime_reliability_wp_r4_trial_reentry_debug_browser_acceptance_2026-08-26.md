# WP-R4 Trial 重新准入工程、Debug 与浏览器验收记录

日期：2026-08-26

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED / REAL TRIAL REMAINS OFF / WP-R5 AUTHORIZED`

对应工程文档：[产品运行可靠性 WP-R4：Trial 重新准入工程实施与 Debug 验收文档](../../../product/PRODUCT_RUNTIME_RELIABILITY_WP_R4_TRIAL_REENTRY_ENGINEERING_AND_DEBUG_PLAN.md)

## 一、验收结论

WP-R4 已完成 Trial 重新准入所需的 Preflight v2、Launch v2、Runtime Identity Binding、Approval Bundle 原子提交、显式原子激活、失败回退、历史隔离和只读验收能力。

本次验收只证明工程边界成立。验收没有保存真实准入包、没有激活 Trial、没有创建真实 Observation，也没有执行 WP-R5 真实学习烟测。

## 二、Runtime Identity 与 Trial 状态

| 项目 | 实际结果 |
| --- | --- |
| 工程基线 Commit | `7cc4a30` |
| 当前分支 | `main` |
| Debug Runtime | Node.js `v24.16.0` |
| 当前工作树 | `dirty`，包含本次 WP-R4 工程改动 |
| 合格 Runtime Identity Digest | 未生成；dirty 工作树按契约必须判为 `not eligible` |
| Re-entry Preflight ID | 未创建 |
| Trial Window ID | 未创建 |
| Launch Record ID | 未创建 |
| Identity Binding ID | 未创建 |
| Trial 状态 | `off / 关闭` |
| WP-R5 | 仅授权准备；尚未执行真实烟测 |

不得使用工程基线 Commit、测试夹具 Digest 或文档示例值冒充当前 clean Production Artifact 的 Runtime Identity。

## 三、自动化 Debug 结果

| 验收项 | 结果 |
| --- | --- |
| WP-R4 Debug R4-C01—R4-C48 | `48 / 48 PASS` |
| WP-R4 Browser Matrix R4-B01—R4-B18 | `18 / 18 PASS` |
| WP-R3 Debug | `40 / 40 PASS` |
| WP-R3 Browser Matrix | `16 / 16 PASS` |
| WP-R2 Debug | `40 / 40 PASS` |
| WP-R1 Debug | `36 / 36 PASS` |
| WP-R0 Debug | `32 / 32 PASS` |
| 原 Stage 4 Real Trial Preflight | `56 / 56 PASS` |
| Learning Entry | `PASS` |
| Workbench State | `25 / 25 PASS` |
| Workbench Selection | `11 / 11 PASS` |
| Formal Resource Latest Quality Admission | `8 / 8 PASS` |
| Production Build | `PASS` |
| `git diff --check` | `PASS` |

## 四、真实浏览器只读验收

真实浏览器访问：`#/internal/acceptance/product-runtime-reliability-wp-r4`。

页面实际执行冻结文档中的同名状态矩阵并显示：

- `18/18 全部通过`；
- `当前 Trial：关闭`；
- 页面明确标注“隔离验收 · 不写正式数据 · 不激活 Trial”；
- R4-B01—R4-B18 的 ID、场景名称与冻结矩阵逐项一致，均为 `PASS`；
- 普通 Learning 与 Workbench 未增加 Trial 工程控制步骤。

## 五、受保护写入计数

本次 Debug 与浏览器验收对以下真实数据域的写入均为 `0`：

1. Frozen Resource；
2. Learning Session；
3. Attempt；
4. Diagnosis；
5. Evidence；
6. Student Profile；
7. Observation；
8. 真实 Trial 分母。

测试用 In-memory 隔离夹具不构成正式 Owner Fact；IndexedDB Repository 通过 Production Build 与事务边界代码验收，真实准入时仍须复验当前浏览器持久化环境。

## 六、残余风险与后续边界

1. 当前工作树不是 clean Production Artifact，不能执行真实重新准入；
2. Browser Matrix 使用隔离状态矩阵验证页面投射，Repository 原子性由 R4-C01—R4-C48 验证；真实准入仍需在 clean 构建和当前浏览器持久化环境上复验；
3. Provider Readiness、当前 Registry 与策略 Digest 必须在正式 Preflight 时重新读取；
4. WP-R5 必须从新的、身份绑定的 Trial Window 开始，不得复用旧 Window、Launch、Binding 或 Observation；
5. 只有用户明确授权后，才可执行真实准入包保存、显式激活和 WP-R5 学习烟测。

## 七、签署结论

WP-R4 工程开发与隔离验收完成，旧主链零回归成立。真实 Trial 继续保持关闭；当前只允许进入提交、clean Artifact 重建和 WP-R5 启动前准备，不得宣称真实 Trial 或教育效果已经完成。
