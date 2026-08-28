# Rubric 对齐反馈阶段 4 工程与 Debug 验收报告

日期：2026-08-28  
结论：`ENGINEERING ACCEPTED / REAL TRIAL NOT ACTIVATED`

## 一、完成范围

本轮完成 Rubric 对齐反馈阶段 4 的工程控制面，不改变既有 `Material → Plan → Task → Candidate → Publish → Learning` 主链：

- 冻结并实现 Trial Activation、Observation、Decision 与 Rollback Schema；
- 实现 Stage 3 Acceptance、Runtime Identity、Formal Revision、学生与轮次 scope 的 Preflight；
- 将“保存准入草稿”和“显式激活”分离；
- 运行时仅在全部身份与时间条件对齐时选择 `student_visible`，其余情况原子回落 `shadow`；
- 记录不含学生答案正文和 Provider Raw Output 的结构化 Observation；
- 实现暂停、到期、身份失效与回滚边界；
- 建立 RF4 自动化矩阵与隔离真实浏览器验收入口。

真实 Trial 未在本轮自动激活，默认模式继续为 `shadow`。

## 二、自动化验收

| 验收组 | 结果 |
| --- | --- |
| 阶段 2 Grounding / Action Plan 回归 | `30 / 30 PASS` |
| 阶段 3 Narrative / 学生页面投射回归 | `36 / 36 PASS` |
| 阶段 4 RF4-A01—RF4-A24 | `24 / 24 PASS` |
| 生产构建 | `PASS` |

阶段 4 自动化覆盖：Stage 3 签署、Runtime / Formal Revision 身份、学生与轮次 scope、过期失效、文本与单选分流、Revision、Retest / Transfer、固定题组连续性、恢复、fallback、真实分母隔离与零保护写入。

## 三、真实浏览器隔离验收

入口：`#/internal/acceptance/rubric-aligned-feedback-stage4`

`RF4-B01—RF4-B16` 执行结果：`16 / 16 PASS`。

关键事实：

- 默认无激活事实时保持 `shadow`；
- 只有 scope、Runtime Identity、正式资源 Revision 与时间窗口同时对齐时，隔离 Fixture 才选择新反馈来源；
- 单选继续使用独立反馈合同，不套用开放文本 Rubric；
- 固定题组前序任务均给出下一题，末题才允许完成；
- Revision、Retest / Transfer 与恢复边界保持不变；
- 新路径失败、暂停、到期与身份错位均原子回落；
- Fixture 不进入真实校准分母，重复 Observation 幂等。

## 四、零写入证明

隔离浏览器矩阵执行前后：

- Formal Revision：`1963 → 1963`；
- Material 写入：`0`；
- Registry 写入：`0`；
- Evidence 写入：`0`；
- Profile 写入：`0`；
- Session 写入：`0`。

阶段 4 控制面没有修改 Frozen Resource、正式 Rubric、历史 Diagnosis / Evidence / Profile 或正式学习进度。

## 五、构建说明

生产构建通过。构建仍报告既有的动态导入与大包体警告；二者不属于本阶段功能错误，也未阻断产物生成。

## 六、验收边界

本报告只签署“阶段 4 工程已具备限定 Trial 准入能力”，不签署真实教育效果，也不等同于 `TRIAL CALIBRATION ACCEPTED`。

进入真实 Trial 前仍必须：

1. 使用当前 Runtime Identity 与 Formal Revision 重新执行 Preflight；
2. 明确学生、轮次、正式资源与时间窗口 scope；
3. 由独立操作显式激活；
4. 保留暂停、回滚与到期自动失效能力；
5. 真实观察不足时标记样本不足，不以 Fixture 补足真实分母。

最终状态：

```text
STAGE 4 ENGINEERING = ACCEPTED
AUTOMATED DEBUG = 24 / 24 PASS
ISOLATED BROWSER ACCEPTANCE = 16 / 16 PASS
OLD CHAIN REGRESSION = PASS
PROTECTED WRITES = 0
REAL TRIAL = NOT ACTIVATED
DEFAULT FEEDBACK MODE = SHADOW
```
