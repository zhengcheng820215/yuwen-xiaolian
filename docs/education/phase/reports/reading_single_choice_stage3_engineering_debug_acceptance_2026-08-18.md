# 阅读单选阶段 3 工程与 Debug 验收

日期：`2026-08-18`

结论：`ENGINEERING + DEBUG PASS / STAGE 4 PRODUCT ACCEPTANCE PENDING`

## 已完成

- Learning 结构化单选投影、选择、保存、提交和恢复；
- 选项集合版本绑定与稳定提交身份；
- 确定性正确判断和干扰项定向 Diagnosis；
- 正确答案、干扰项依据与学生投影隔离；
- 单选独立 Evidence 与 Trace Link；
- Option ID、版本、展示顺序、正确性和偏差信号的 Calibration Projection；
- 单选/文本四格互补观察与 Training Route 数据边界；
- 单选不开放反馈后立即改选；
- `single_choice` 正式可执行能力继续阻断。

## 验收结果

| 验收项 | 结果 |
| --- | --- |
| 阶段 3 专项 Debug | `18 / 18 PASS` |
| 阶段 1 专项回归 | `21 / 21 PASS` |
| 阶段 2 专项回归 | `14 / 14 PASS` |
| Resource Coverage 门禁 | `22 / 22 PASS` |
| Text Task Execution | `16 / 16 PASS` |
| Learning Persistence | `13 / 13 PASS` |
| Learning Minimum Collection WP3 | `9 / 9 PASS` |
| Question Empirical Calibration | `6 / 6 PASS` |
| Phase 16.3 Real Learning Chain | `16 / 16 PASS` |
| Production Build | `PASS` |

## 关键断言

1. 选择结果不写入 `answerText`；
2. 未下发、空选和版本错位不能进入 Diagnosis；
3. 单选 Diagnosis 不依赖外部 Provider；
4. 错误选择命中对应可解释偏差，学生反馈不泄漏正确 optionId；
5. 单次选对置信度保持保守，并明确需要文本或 Retest / Transfer 补证；
6. 单选与文本 Evidence 独立保存，联合解释没有 mergedScore；
7. 旧文本作答和 Phase 16.3 正式链无回归；
8. 阶段 4 前不解除产品执行门禁。

## 执行命令

```text
pnpm run debug:reading-single-choice-stage3
pnpm run debug:reading-single-choice-stage1
pnpm run debug:reading-single-choice-stage2
pnpm run debug:resource-coverage
pnpm run debug:task-execution
pnpm run debug:learning-persistence
pnpm run debug:learning-minimum-collection-wp3
pnpm run debug:question-empirical-calibration
pnpm run debug:phase16-3-real-chain
pnpm run build
```

## 未完成

- 两篇真实材料的端到端联调；
- 学生端真实点击、刷新、中断和反馈可用性验收；
- 正式资源覆盖能力集合解除阻断；
- 小规模真实试用数据观察。

以上内容属于阶段 4，不在本阶段提前宣称通过。

## 阶段 4 后补充回归

最终真实浏览器冒烟发现未提交草稿恢复时可能重新选题。窄范围修复增加了文本题与单选题草稿的原正式资源版本身份解析，并由正式匹配器通过 `requiredResourceVersionId` 锁定原 Frozen Version；原版本不可用时明确阻断，不静默换题。

阶段 3 专项 Debug 因此扩展为 `20 / 20 PASS`。阶段 3 当时的 `18 / 18` 验收事实保持不变，新增两项用于覆盖阶段 4 最终恢复边界。
