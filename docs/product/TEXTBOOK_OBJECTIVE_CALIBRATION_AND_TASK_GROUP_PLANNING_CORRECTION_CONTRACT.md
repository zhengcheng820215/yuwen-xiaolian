# 教材目标校准与题组规划校正契约

英文名称：Textbook Objective Calibration and Task Group Planning Correction Contract

文档类型：`NORMATIVE_CONTRACT`

状态：DESIGN FROZEN / ENGINEERING IMPLEMENTED / DEBUG ACCEPTED

状态轴：`Design = PASS / Engineering = PASS / Product Acceptance = NOT_CLAIMED / Live = NOT_CLAIMED`

版本：`textbook_objective_calibration_v1`

日期：2026-09-03

当前状态来源：[当前产品状态](./CURRENT_PRODUCT_STATE.md)

上位契约：[阅读训练递进负担模型契约](./READING_TRAINING_PROGRESSIVE_LOAD_MODEL_CONTRACT.md)

关联契约：[AI 题目生成质量与定向优化契约](./AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md)、[正式资源不可变契约](./FORMAL_RESOURCE_IMMUTABILITY_CONTRACT.md)

---

## 一、目标与结论

本契约把教材中的单元预习、思考探究与知识提示转化为现有阅读训练系统可消费的**训练目标校准信号**，用于校正 Observation Plan 与 Task Group Progression，不建立第二套题目模型。

教材活动不等于正式题目。系统只吸收其中可形成稳定阅读观察的目标，不直接复制教材问法，也不要求把朗读、背诵、字词积累全部改造成在线正式题。

本次校准属于现有 Training Model 的题组规划补强：

- 保持 `Material → Plan → Task → Candidate → Publish → Learning` 主链不变；
- 保持 Single Choice、Revision、Targeted Micro-training、Retest、Transfer 的既有职责不变；
- 不覆盖任何 Frozen Resource；
- 历史正式题先只读审计，需调整时生成 successor Candidate；
- 每个阶段必须证明旧主链零回归，新语义只在本契约允许的边界内生效。

## 二、教材信号的分类

### 2.1 纳入核心阅读题组规划

教材目标可归入以下结构化角色：

| 角色 | 观察目标 | 典型学生动作 |
| --- | --- | --- |
| `whole_text_orientation` | 全文对象、场景、结构或发展脉络 | 辨认全文写了什么、由哪些部分组成 |
| `local_close_reading` | 局部词句、描写或修辞 | 定位具体内容并解释表达效果 |
| `relation_explanation` | 内容之间、依据与结论之间的关系 | 说明为什么、如何共同体现或如何推动 |
| `integrated_understanding` | 多处证据、结构递进、主题或整体表达 | 综合材料形成有依据的判断 |
| `optional_transfer` | 在新表达情境中使用已理解的方法 | 仿写、迁移或独立应用 |

### 2.2 当前不纳入正式阅读诊断链

以下教材活动可以保留为教学参考，但默认不生成正式诊断题：

- 朗读重音、停连与语音表现；
- 背诵；
- 单纯字音、字形和词语抄写；
- 不产生稳定阅读证据的自由交流活动。

它们不得为了“覆盖教材”而挤压核心阅读观察。

## 三、整体理解入口规则

### 3.1 触发条件

核心阅读材料出现下列任一情形时，Planner 应建立 `requiresWholeTextOrientation` 校准上下文：

- 多个场景或画面共同构成全文；
- 多个人物或对象关系需要先辨认；
- 情节包含多个阶段或明显发展过程；
- 后续局部题依赖全文结构、组织顺序或整体情感方向。

### 3.2 规划要求

在 `entry_first` 策略下，若 `requiresWholeTextOrientation=true`：

1. 题组必须至少有一个 `whole_text_orientation` 任务；
2. 该任务应位于第一个 `local_close_reading`、`relation_explanation` 或 `integrated_understanding` 任务之前；
3. 作答形式由训练动作决定，可以是高质量单选、短文本或低负担结构化判断；
4. 不要求每个题组出现全部角色，也不要求固定题型配额；
5. 梯度只要求不出现无理由的观察跨度，不允许为排列漂亮而机械凑题。

`holistic_first`、Retest 或 Transfer 可按既有例外理由调整顺序，但必须保留可解释的策略身份。

### 3.3 发布门禁

新规划的核心题组采用两级治理：

- `advisory`：推断式教材校准或历史只读审计；缺少整体入口时给出治理建议，不阻断历史正式资源；
- `enforced`：已冻结教材目标、并由新 Planner 生成的 successor 题组；缺少整体入口或局部任务早于整体入口时阻断发布。

不得因单题本身质量合格而跳过题组级校验。

## 四、《春》教材校准基线

### 4.1 教材目标提取

根据本次提供的教材页，《春》的有效核心阅读目标包括：

1. 辨认课文描绘的主要春日图景，形成全文地图；
2. 感受语言的童趣、诗意与活泼节奏；
3. 理解结尾“娃娃—小姑娘—青年”三个比喻及其递进；
4. 品味具体词语、拟人、比喻的表达效果；
5. 通过局部描写与全文组织理解春天的生机。

朗读、背诵、字词积累与修辞知识卡不直接转成当前正式题。

### 4.2 当前正式题组只读审计

当前《春》共 6 道有效正式题：5 道文本题、1 道单选。已覆盖结尾比喻递进、春雨上下文、第二段景物、词语表达效果、花色比喻和“春回大地”基础理解。

主要缺口不是单题质量，而是**缺少一项明确的全文图景定向任务**。现有单选只观察第二段局部状态，不能替代全文场景地图；随后直接进入局部语言和关系分析，题组入口与教材整体感知目标之间存在断点。

### 4.3 successor 规划建议

推荐 successor 题组采用以下非机械顺序：

1. `whole_text_orientation`：辨认课文依次描绘的主要春日图景，可使用低负担单选或短文本；
2. `local_close_reading`：第二段“刚睡醒”或春草词语品味；
3. `relation_explanation`：具体景物如何共同体现春回大地；
4. `local_close_reading`：花色比喻或春雨语言；
5. `relation_explanation`：局部描写与全文生机之间的关系；
6. `integrated_understanding`：结尾三个比喻的顺序与递进意义。

若保持 6 道总量，优先将窄范围且与其他局部语言观察价值接近的任务降为候补，不通过追加题目无限扩大题组。

## 五、Schema 与工程边界

### 5.1 新增结构化字段

`ReadingTaskPlanningSeed` 可增加：

```ts
curriculumCalibrationRole?:
  | 'whole_text_orientation'
  | 'local_close_reading'
  | 'relation_explanation'
  | 'integrated_understanding'
  | 'optional_transfer'
```

题组规划输入可增加：

```ts
curriculumCalibration?: {
  policyVersion: 'textbook_objective_calibration_v1'
  requiresWholeTextOrientation: boolean
  enforcementMode: 'advisory' | 'enforced'
  basisCodes: Array<
    | 'multi_scene_structure'
    | 'multi_character_relation'
    | 'multi_stage_plot'
    | 'whole_text_organization'
  >
  deferredActivityCodes?: Array<'oral_reading' | 'recitation' | 'vocabulary_accumulation'>
}
```

字段用于规划、审计和 Gate，不投射到学生页面，不进入学生能力画像。

### 5.2 兼容策略

- 历史 Plan 不含新字段时继续按原 `v1` 语义读取，哈希保持稳定；
- 无校准上下文时 Planner 与 Gate 行为必须与升级前一致；
- 新上下文进入 Plan Hash 和 Gate Snapshot，避免新旧规划身份静默混用；
- 只读审计不得写 Formal Store、Launch Record、Trial Binding 或 Learning 数据。

## 六、Prompt 与 Planner 规则

Pass A 必须先规划观察角色，再决定题干。Prompt 应明确：

- 多场景、多阶段核心材料优先建立全文定向观察；
- 不得把某一局部段落题标记为全文入口；
- `whole_text_orientation` 的 Anchor 通常为 `full_text`；
- 局部词句题不得冒充整体理解；
- 教材目标用于校准观察覆盖，不是要求复制教材题干；
- 不生成朗读、背诵、抄写题来满足覆盖；
- 已有正式题只读，校正通过 successor 完成。

Planner 在 `entry_first` 下按“整体定向优先于局部细读”排序；该排序只在相同训练时序边界内生效，不覆盖 `holistic_first`、Retest 或 Transfer 的合法角色顺序。

## 七、Debug 验收矩阵

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| TC-01 | 合法 Curriculum Calibration Context | Schema Guard 通过 |
| TC-02 | 非法 role / basis code | Schema Guard 拒绝 |
| TC-03 | 无校准上下文 | 原 Planner 顺序与 Plan Hash 不变 |
| TC-04 | 多场景 + enforced + 有全文入口 | Gate 通过 |
| TC-05 | 多场景 + enforced + 缺全文入口 | Gate 阻断 |
| TC-06 | advisory + 缺全文入口 | 仅提醒，不阻断 |
| TC-07 | 局部题位于全文入口前 | 按模式提醒或阻断 |
| TC-08 | holistic_first 合法例外 | 不被强制改成 entry_first |
| TC-09 | Retest / Transfer | 继续服从 role-driven |
| TC-10 | 不机械补齐全部校准角色 | 允许通过 |
| TC-11 | targeted_excerpt | 不强制全文入口 |
| TC-12 | 校准字段进入新 Plan Hash | 新旧身份可区分 |
| TC-13 | 历史 Plan Guard | 继续兼容 |
| TC-14 | Pass A Prompt | 包含角色与整体入口规则 |
| TC-15 | 《春》当前题组只读审计 | 识别 `whole_text_orientation_missing` |
| TC-16 | 《春》successor 模拟题组 | 顺序为整体入口后局部与综合 |
| TC-17 | 正式资源不可变 | 校准不写 Formal Store |
| TC-18 | 旧主链专项回归 | 全部通过 |
| TC-19 | TypeScript / build | 通过 |
| TC-20 | 学生页面 | 不展示内部 role 与 Gate code |

## 八、完成定义

本轮完成必须同时满足：

1. 文档、Schema、Planner、Prompt、Group Gate 语义一致；
2. 《春》当前正式题组形成只读审计证据和 successor 校正建议；
3. 新生成的适用题组可以阻止“缺少整体入口却直接进入局部高负担题”；
4. 历史正式资源零覆盖、Formal Store 零写入；
5. 旧主链与无校准上下文行为零回归。

## 九、实施与验收记录

2026-09-03 已完成 Schema、Pass A / Pass B 字段传递、Planner 顺序、Prompt 约束、题组 Gate 和工作台生成入口接入。

自动结构推断采用 `advisory`；只有正式冻结、具备明确依据的教材校准上下文才可使用 `enforced`，避免以段落数量机械决定题组结构。

验收结果：

- `debug:textbook-objective-calibration`：TC-01—TC-20，20/20 PASS；
- `debug:reading-training-progression-stage2`：S2-01—S2-48，48/48 PASS；
- `debug:material-observation-draft-generator`：C01—C45，45/45 PASS，Formal Repository writes = 0；
- `npm run build`：PASS；
- 《春》只读校正报告：[《春》教材目标校准与题组规划校正报告](../education/phase/reports/spring_textbook_task_group_planning_correction_2026-09-03.md)。
