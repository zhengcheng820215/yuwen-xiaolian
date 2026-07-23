# Phase 17.2：《潼关》Material Cluster 校准记录

日期：2026-07-23

状态：ENGINEERING + BROWSER DISPLAY SMOKE PASS / CONTENT OWNER REVIEW + FREEZE PENDING

所属阶段：[Phase 17.2：材料观测设计与首批正式资源包](../phase17_2.md)

## 一、校准目标

以谭嗣同《潼关》为单一 Material Cluster，验证工作台能否先建立材料与观测设计，再围绕同一内容形成不同 Ability Action，而不是把若干题目当作彼此无关的记录。

校准对象使用公版诗歌正文与项目整理的背景说明，不复制教材图片、批注或版式。

## 二、已实现

1. 同一 Material 下建立 6 个 Observation Task，Primary Ability 分别为 extraction、comprehension、summarization、analysis、inference、expression。
2. Source Anchor 支持单段、段落范围和全文，不再要求用伪段落表达全文任务。
3. 每个 Task 可记录 plan-local Observation Focus、Primary / Supporting Ability、Rubric、Answer Acceptance、作答最低要求与校准答案。
4. 校准答案覆盖完整、部分、典型错误、合理异表述、简短有效和无关回答；它们只服务内容审核，不进入正式 Question Draft、Diagnosis 或 Evidence。
5. Retest / Transfer 必须具有正式比较组；Transfer 还必须声明新材料关系。同一材料内尚未形成比较关系的任务保持 Training，不能为凑覆盖改写 TaskRole。
6. 工作台提供六项 Ability 覆盖预览，并可展开查看锚点、Focus、Rubric、Acceptance、Supporting Ability 与校准答案。
7. Reviewed Plan 生成 Draft 时保留内容人员给出的题干、Rubric 和 Acceptance，不再被通用占位内容覆盖。

## 三、验收结果

```text
Phase 17 Tongguan Material Cluster Calibration: 12 / 12 PASS
Phase 17.2 Material Observation: 26 / 26 PASS
Phase 17.2 Minimal Production Workspace: 13 / 13 PASS
Phase 17 Batch A Controlled Formalization: 14 / 14 PASS
Phase 17.1 Resource Coverage: 22 / 22 PASS
Production Build: PASS
External Provider calls: 0
```

浏览器工作台已验证：

- 能载入《潼关》校准案例；
- 选择已有 Plan 后，顶部观测任务区直接回填该 Plan 的真实题目、能力动作、材料范围、设计理由、Rubric 与校准答案，不再展示容易误认成正式内容的通用空白模板；
- 已有 Plan 未发生修改时，“生成修订计划”保持禁用，避免只读查看产生重复版本；
- 能显示 6 个不同 Primary Ability；
- 能区分单段、段落范围与全文 Anchor；
- 能展开查看内容级 Rubric、Acceptance 和校准答案；
- 所有同材料校准任务均保持 Training；
- 页面无控制台错误或明显布局冲突。

## 四、尚未完成

- 内容负责人尚未逐题确认 Observation、Rubric 和 Answer Acceptance；
- 校准 Plan 当前为 `pending_review`，未批量生成或审核正式 Draft；
- 未执行 Freeze、Registry 写入或 active ResourceObservationLink 确认；
- 该案例暂不计入首批 24—28 道正式 Frozen Resource；
- 本记录不代表教材内容复刻、完整诗歌教学方案或 Phase 17.2 冻结完成。

## 五、准确结论

Phase 17.2 工作台已经能够表达“同一材料、不同观测侧面、不同能力动作”的案例模式，并能保存内容级 Rubric、Answer Acceptance 与审核校准答案。工程链路和浏览器展示通过；正式资源资格仍须经过内容负责人审核、Existing Phase 16.1 Review / Freeze、Registry 和 Observation Link 闭环。
