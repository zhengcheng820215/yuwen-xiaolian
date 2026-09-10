# 错题反馈 Stage 3 Wave B 受控原创内容生产与准入验收报告

日期：2026-09-10

状态：`WAVE_B CONTENT MIGRATION PASS / STAGE 3 CONTENT MIGRATION PASS / TRIAL NOT AUTHORIZED`

工程分支：`codex/stage3-wave-b-controlled-originals`

工程基线 Commit：`c87de8c`（`Merge remote-tracking branch 'origin/main'`）

正式资源存储：`/Users/chengzheng/Desktop/web/yuwen-xiaolian/System/.local-data/formal-resource-store.json`

最终 Formal Store revision：`1967`

## 一、执行结论

Stage 3 Wave B 已完成四类受控原创、原子化开放题的内容生产、人工审核、质量追踪、正式冻结与 Registry current head 准入：

| 动作码 | 材料 | 当前正式资源版本 | 准入结论 |
| --- | --- | --- | --- |
| `verify_scope` | `wrong-answer-stage3-wave-b-verify-scope-material:v1`《阅览室里的做法》 | `resource-wrong-answer-stage3-wave-b-verify-scope-task-plan-v1:v1` | PASS |
| `compare_elements` | `wrong-answer-stage3-wave-b-compare-elements-material:v1`《晨光里的芦苇》 | `resource-wrong-answer-stage3-wave-b-compare-elements-task-plan-v1:v2` | PASS |
| `reclassify_by_cue` | `wrong-answer-stage3-wave-b-reclassify-by-cue-material:v1`《旧车站的声音与凉意》 | `resource-wrong-answer-stage3-wave-b-reclassify-by-cue-task-plan-v1:v1` | PASS |
| `identify_object_action` | `wrong-answer-stage3-wave-b-identify-object-action-material:v1`《窗台上的晚霞》 | `resource-wrong-answer-stage3-wave-b-identify-object-action-task-plan-v1:v1` | PASS |

四份材料均为 `targeted_excerpt + controlled_original + verified + rights cleared`，每份材料只授权一个任务，且显式支持 `incomplete_task_requirement`。试卷照片与学生原答仅作为离线校准证据，没有复制进入正式资源。

## 二、质量门禁闭环

首次正式写入将 Formal Store 从 revision `1965` 更新到 `1966`，建立四条完整资源链。写后全局 latest-quality 检查发现 `compare_elements:v1` 存在：

- `response_format_underloaded`；
- `rubric_requirement_not_in_stem`。

本次没有覆盖或删除已冻结版本，而是建立不可变 successor `compare_elements:v2`：

- 题干显式补足“根据材料”与两个比较维度；
- 回答格式由负载不足的短文本调整为 `long_text`；
- 最低长度调整为 24 字；
- v1 保留为 superseded 历史版本，Registry 唯一 current head 指向 v2。

质量闭环写入将 Formal Store 从 revision `1966` 更新到 `1967`。再次执行准入为幂等 no-op，revision 保持 `1967`。

## 三、C3-B01—C3-B24 验收

结果：`24 / 24 PASS`

核心证据：

- 四个材料的来源、版权、状态、目标 Gap 与单任务边界全部合格；
- 四个 Question Resource 均通过 validation、人工 review、freeze 与 Registry 唯一 current head 检查；
- 每个资源仅有一个与 Rubric Item 精确绑定的 `operation_only` Action Contract；
- 四个动作意图投射一致率 `4 / 4`；
- 通用兜底 `0 / 4`；
- 学生可见 Rubric 内部字段、accepted signals 与完整答案链泄露 `0 / 4`；
- 非目标 Gap 保持既有确定性动作映射；
- Attempt、Profile、Trial Observation 写入均为 0；
- Trial 控制文件前后逐字不变。

## 四、回归结果

| 验收项 | 结果 |
| --- | --- |
| Stage 3 Wave B dry-run / apply / apply-noop | `24 / 24 PASS` |
| Stage 3 Wave A 回归 | `24 / 24 PASS` |
| Rubric Projection Stage 1 | `30 / 30 PASS` |
| Grounding / Action Plan Stage 2 | `30 / 30 PASS` |
| Narrative / 页面投射 Stage 3 | `36 / 36 PASS` |
| Trial 校准 Stage 4 | `24 / 24 PASS` |
| Wrong-answer Action Contract Stage 2 | `24 / 24 PASS` |
| Question Resource Admission | `29 / 29 PASS` |
| Resource Coverage | `22 / 22 PASS` |
| latest-quality admission | `11 / 11 PASS`，blocked `0` |
| Question optimization baseline | PASS，issues `0` |
| Formal Resource Historical Audit | PASS；仅既有 12 条 legacy compatibility warning |
| Production build | PASS |

构建仍报告既有 dynamic-import 与 chunk-size 警告，不构成本批内容准入阻断。

## 五、写入与身份边界

正式写入只包含获准的 Material、Observation、Question Resource、Quality Trace 和 Registry 记录。命令身份为：

- 初始内容链：`wrong-answer-feedback-stage3-wave-b-2026-09-10-v1`；
- 质量闭环 successor：`wrong-answer-feedback-stage3-wave-b-2026-09-10-v2`。

由于 Formal Store revision 已变为 `1967`，此前生成的 Runtime Identity、Preflight、Launch Record 与 Trial Identity Binding 均不得复用。本报告证明内容迁移通过，不等于真实 Trial 激活。

## 六、后续准入顺序

1. 提交并冻结本批工程代码与验收证据；
2. 合入目标分支并推送（需独立 Git 授权动作）；
3. 基于冻结 Commit 与 Formal Store revision `1967` 重新生成 Runtime Identity；
4. 重新执行 R4-P01—R4-P24，生成新的 Preflight、Launch Record 与 Trial Identity Binding；
5. 只把本报告列出的 current frozen versions 加入限定 Trial scope；
6. 完成 Provider 现场可用性确认后显式激活；
7. 首轮学生行为只计入新身份绑定后的真实观察，不回填此前离线样本。

在上述步骤完成前，状态保持 `TRIAL NOT AUTHORIZED`。
