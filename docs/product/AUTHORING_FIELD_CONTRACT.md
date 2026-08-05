# Phase 17 录入字段契约

英文名称：Authoring Field Contract

状态：DESIGN FROZEN / P0-P2 ENGINEERING COMPLETE / SINGLE-PAGE ALIGNMENT COMPLETE / PRODUCT CALIBRATION PENDING
契约版本：`authoring_field_contract_v1.2`
更新日期：2026-08-04

## 一、用途与权威边界

本文冻结 Phase 17 统一资源生产工作台从素材录入、训练任务校准到正式发布所使用的核心字段职责，并作为以下能力的共同解释来源：

1. 页面标签、说明、编辑入口与保存行为；
2. Material Observation Plan 与 Question Draft 的字段适配；
3. AI 生成、局部优化与职责自检；
4. 结构校验、质量评估、问题提示与“定位修改”；
5. 旧数据适配、新 Revision 保存与 Assessment 失效。

本文不新增一条产品流程，也不要求立即迁移既有 Schema。它先冻结语义和映射，再校准现有 Phase 17 录入链路，避免页面、保存、校验、AI 和问题定位分别解释同一个字段。

## 二、五个核心字段

| 字段 | 唯一职责 | 当前正式来源 | 不负责 |
| --- | --- | --- | --- |
| 能力目标 | 定义本题训练的上层能力 | Plan：`taskPlans[].abilityId`；Question Draft：`abilityMetadata.abilityId` | 不描述具体材料情境，不代替题干、任务或评分标准 |
| 具体训练点 | 定义能力在当前材料和题目中的具体落点 | Plan：`taskPlans[].observationFocus.displayName` | 不得只重复能力名称，不承担完整观察标准 |
| 题目 | 向学生说明“问什么” | Plan 现状：`taskPlans[].observationGoal`；Question Draft：`questionStem` | 不展开完整评分等级，不承载后台审核说明 |
| 学生任务 | 说明学生“怎么答” | Plan：`taskPlans[].expectedStudentAction`；Question Draft 当前主要进入 Rubric 设计上下文 | 不增加题目未告知学生的隐性作答义务 |
| 观察目标 | 说明系统或审核者“看什么表现” | Plan 现状：`taskPlans[].observationFocus.definition` | 不复述题干，不定义完整、部分和不足的评分阈值 |

### 2.1 题目

题目只负责向学生提出问题。它可以包含完成作答所必需、且学生必须提前知道的材料范围、数量、顺序或输出约束，但不应展开完整评分要求。

示例：

> 结合全文，概括骗子获得皇帝信任的主要步骤。

### 2.2 学生任务

学生任务是题目的结构化执行说明，至少应明确：

1. 认知动作；
2. 处理对象；
3. 必要时的输出形式。

示例：

> 提取骗子取得信任的关键事件，并按照发生顺序组织答案。

学生任务可以规范化题目已经表达的要求，但不得新增题目中不可见的强制要求。若“必须引用原文”“必须写三点”等条件会影响作答，必须同时让学生在题目中看到。

### 2.3 观察目标

观察目标定义系统或审核者准备观察的表现，不定义评分等级。

示例：

> 观察学生是否覆盖主要事件、顺序完整且事件关系准确。

评分标准负责把观察目标进一步拆成可独立判断的评分项，并定义完整、部分与不足回答之间的边界。

### 2.4 三个视角的硬边界

围绕同一训练目标时，三个字段仍必须保持不同视角：

```text
题目
-> 学生收到的问题

学生任务
-> 学生执行的动作

观察目标
-> 系统或审核者检查的表现
```

共享必要关键词不等于重复。只有文本高度相似，同时字段职责特征也不成立时，才提示需要重写。

## 三、具体训练点的数据规则

具体训练点值得保留，但不得成为新的任意自由文本负担：

1. 优先来自受控选项；
2. AI 根据能力目标、材料和题目推荐；
3. 人工可以选择或进行短文本调整；
4. 不允许与能力目标完全相同；
5. 修改后必须重新检查依赖该字段的 Assessment。

合格示例：

```text
能力目标：概括
具体训练点：按事件发展顺序概括主要过程
```

不合格示例：

```text
能力目标：概括
具体训练点：概括
```

## 四、当前映射与迁移方向

当前 Schema 已经能够承载大部分信息，但命名与页面语义仍有历史错位。工程实现必须区分“当前路径”和“冻结语义”：

| 契约字段 | 当前 Plan 路径 | 当前 Question Draft 路径或去向 | 校准要求 |
| --- | --- | --- | --- |
| 能力目标 | `taskPlans[].abilityId` | `abilityMetadata.abilityId` | 两端必须沿用同一 Plan 值，不建立第二套可漂移设置 |
| 具体训练点 | `taskPlans[].observationFocus.displayName` | 当前通过 Observation Link / Tag 保留关联 | 页面、AI 与检查均按“具体训练点”解释 |
| 题目 | `taskPlans[].observationGoal` | `questionStem` | 兼容现状映射；页面和提示统一称“题目/题干” |
| 学生任务 | `taskPlans[].expectedStudentAction` | 当前主要用于默认 Rubric 与 accepted signals | 不得与题干混为同一字段，也不得静默新增作答义务 |
| 观察目标 | `taskPlans[].observationFocus.definition` | 当前无独立 Question Draft 字段 | 先由适配层保留语义；后续是否新增正式字段需单独 Schema 决策 |

`observationGoal` 当前实际承载面向学生的题干，名称容易误导。v1 不直接重命名 Schema，先通过统一字段契约和适配层约束其页面、AI、校验及错误定位语义。

### 4.1 Plan 管理的受控字段

能力目标、任务用途和难度已经具备稳定的 Plan 与 Question Draft 路径。发布前必须以 Material Observation Plan 为唯一来源，任务卡与发布编排只沿用和核对，不允许建立平行值：

| 受控字段 | Material Observation Plan | Question Draft | 规则 |
| --- | --- | --- | --- |
| 能力目标 | `taskPlans[].abilityId` | `abilityMetadata.abilityId` | 必须沿用 Plan 的合法 `PrimaryAbilityId` |
| 任务用途 | `taskPlans[].taskRole` | `abilityMetadata.taskRole` | 必须沿用 Plan 的合法 `RecommendedTaskRole` |
| 难度 | `taskPlans[].difficulty` | `abilityMetadata.difficulty` | 必须沿用 Plan 的合法 `QuestionResourceDifficulty` |

统一工作台可以展示三项受控字段，但不得在不同页面、卡片或兼容入口分别维护两套值。发现冲突时，应先按 Observation Task 重新同步当前 Plan 值；只有无法由适配规则解释或同步失败时才阻断发布。

旧字段语义不确定时不得静默宣称映射正确。适配结果应记录来源：

```ts
type LegacyAuthoringFieldMapping = {
  value: string;
  mappedTo: AuthoringFieldKey;
  mappingSource: 'legacy_adapter';
  confidence: 'high' | 'medium' | 'low';
  needsHumanReview: boolean;
};
```

只有存在真实歧义时才设置 `needsHumanReview: true`。旧数据确认后保存为新 Revision，不覆盖历史版本。

## 五、单一字段映射

页面、保存、AI、校验与错误定位必须引用同一份字段注册表，不允许分别硬编码路径。

```ts
type AuthoringFieldKey =
  | 'abilityTarget'
  | 'specificTrainingPoint'
  | 'questionStem'
  | 'studentTask'
  | 'observationTarget';

type AuthoringFieldContract = {
  key: AuthoringFieldKey;
  label: string;
  uiField: string;
  planPath: string;
  draftPath?: string;
  aiOutputPath: string;
  editorTarget: string;
  validate: (value: unknown, context: unknown) => AuthoringFieldIssue[];
  legacyPaths?: string[];
};
```

字段注册表必须同时驱动：

1. 页面读取与编辑；
2. 保存序列化与恢复反序列化；
3. AI 输出落点；
4. Validator 和 Quality Assessment；
5. 问题提示中的字段名称；
6. “定位修改”的编辑目标。

禁止出现以下错位：

```text
页面显示 A
-> 保存写入 B
-> 校验读取 C
-> 问题定位到 D
```

## 六、AI 输出契约

AI 必须分别生成五项内容，不得先输出一段混合描述再由页面猜测字段归属。

```json
{
  "authoringContractVersion": "authoring_field_contract_v1",
  "abilityId": "summarization",
  "specificTrainingPoint": "按事件发展顺序概括主要过程",
  "questionStem": "结合全文，概括骗子获得皇帝信任的主要步骤。",
  "studentTask": "提取骗子取得信任的关键事件，并按照发生顺序组织答案。",
  "observationTarget": "观察学生是否覆盖主要事件、顺序完整且事件关系准确。"
}
```

`abilityId` 必须来自正式 `PRIMARY_ABILITY_IDS` 注册表。AI 不直接保存“概括”等自由文本标签，显示名称由能力注册表根据合法 ID 生成。AI 的能力建议只有通过注册表解析与校验后才能写入 Plan。

生成后必须执行职责自检：

1. `questionStem` 是否是面向学生的完整题干；
2. `studentTask` 是否包含动作、对象和必要的输出形式；
3. `studentTask` 是否引入题目未外显的强制要求；
4. `observationTarget` 是否描述可判断表现；
5. 三个字段是否只是换词重复；
6. `specificTrainingPoint` 是否比能力目标更具体。

自检失败时只局部重写对应字段，不整题重生成。AI 局部重写只能修改本次操作明确授权的字段，不得修改其他字段。AI 仍无法可靠拆分时，必须返回明确的人工处理项和原因，不得伪装为已完成。

## 七、检查、提醒与发布

### 7.1 严重程度

| 级别 | 行为 |
| --- | --- |
| 阻断错误 | 必填字段缺失、Schema 非法、题目绑定的能力、任务用途、材料范围等受控字段与当前 Plan 冲突且无法由适配规则解释、Assessment 已失效等；不得发布 |
| 黄色提醒 | 高重复、职责边界不清、旧字段映射存疑、AI 无法可靠优化等；允许人工确认后提交 |
| 信息提示 | 说明来源、版本或建议，不改变保存与提交权限 |

题干措辞、观察点或训练重点存在轻微语义偏差时，不得仅凭差异直接阻断，应作为黄色提醒交由人工判断。

文本相似度不得单独成为阻断条件。重复判断应同时考虑：

1. 文本相似度；
2. 题目、学生任务和观察目标的句式特征；
3. 回答对象、材料范围与评分要点是否实际相同。

### 7.2 修改提醒结构

每条提醒固定展示：

1. 问题字段；
2. 为什么有问题；
3. 当前内容；
4. 建议修改方向；
5. 可操作的参考写法；
6. “定位修改”；
7. “接受当前设计”，仅用于非阻断提醒。

“定位修改”必须展开对应模块、滚动、聚焦并高亮真实可编辑字段。目标不存在时显示可见错误，不得静默失败。

### 7.3 接受提醒

接受非阻断提醒必须绑定：

```text
Draft ID
+ Draft Revision
+ Assessment ID
+ Rule Version
+ Operator
+ Reason
```

任一相关字段再次修改后，接受记录和旧 Assessment 同时失效。

`Reason` 是审计字段，不等同于必须向单人生产用户展示自由文本输入框。标准工作台可由明确的“接受提醒并发布”动作写入固定决策码和结构化审计说明；只有多人独立审核、异常纠错或政策明确要求补充依据时，才要求人工填写说明。

## 八、Assessment 失效原则

任何影响正式质量判断的编辑操作，都必须使相关 Assessment 和尚未完成正式化的 Human Review Decision 失效，并要求基于新 Revision 重新评估。

该规则适用于：

1. Question；
2. Rubric；
3. Answer Acceptance；
4. Difficulty；
5. Ability Mapping；
6. Material Observation。

页面必须明确显示：

```text
质量检查：已失效
原因：题目内容已修改
请保存并重新检查
```

发布门禁规则：

1. 存在阻断错误：不可发布；
2. Assessment 已失效：必须重新检查；
3. 仅存在黄色提醒：人工确认后可以发布；
4. 不得继续使用旧 Revision 的 Assessment。
5. 发布命令必须显式携带 `draftId`、`expectedRevisionId` 与当前 `assessmentBundleId`；
6. Revision 或 Assessment 身份不一致时必须返回冲突，不得隐式读取“最新版本”；
7. 已发布 Formal Resource 不因后续 Draft 修改而被覆盖。

## 九、页面信息层级

首层仅承担“这道任务训练什么、学生做什么、系统观察什么”的判断：

1. 能力目标与具体训练点；
2. 题目；
3. 学生任务；
4. 观察目标。

评分标准、答案示例、作答判定、任务属性、设计依据和来源说明继续折叠。首层不再增加新的自由文本字段。

统一资源生产工作台在同一训练任务卡中形成并校准训练计划、题目、评分标准与作答判定，质量检查结果在卡内展示，用户通过“发布任务”形成最终人工决定。旧题目工作台和历史记录只读展示既有字段与审计链，不得维护一套可独立漂移的能力、任务用途和难度。

## 十、验收标准

工程校准至少覆盖：

1. 页面编辑字段、保存字段、校验字段和错误定位字段完全一致；
2. 保存后重新读取，五个字段保持不丢失、不互换；
3. 具体训练点、题目、学生任务和观察目标之间出现职责性高重复时产生黄色提醒；
4. 修改任一核心字段后旧 Assessment 立即失效；
5. 非阻断提醒不会直接阻止保存或人工确认后的提交；
6. “定位修改”准确展开任务并聚焦对应字段；
7. AI 局部重写不会修改本次操作未明确授权的其他字段；
8. AI 无法可靠优化时返回具体人工处理项；
9. 同一 Observation Task 重复修订时复用稳定修订根，不生成平行草稿；
10. 旧数据适配后保存为新 Revision，不覆盖旧版本；
11. 发布前能力目标沿用 `taskPlans[].abilityId`，任务用途沿用 `taskPlans[].taskRole`，难度沿用 `taskPlans[].difficulty`，三者在 Question Draft 中分别落到 `abilityMetadata.abilityId`、`abilityMetadata.taskRole` 和 `abilityMetadata.difficulty`；
12. 真实十篇素材中，不同能力题型均能稳定生成职责分离的字段。
13. 修改字段后任务卡不得继续显示旧 Assessment 为当前通过；
14. “发布任务”必须绑定用户当前看到的 Revision 与 Assessment Bundle；
15. 发布部分失败时不得回滚或覆盖已成功写入的正式对象，重试不得生成重复正式版本。

## 十一、实施顺序

### P0：冻结共同解释源

1. 建立字段注册表；
2. 统一页面读取与编辑；
3. 统一保存序列化与恢复反序列化；
4. 统一 Validator、问题提示和定位修改；
5. 修正观察目标“显示 A、检查 B”的错位；
6. 修改核心字段后使旧 Assessment 失效；
7. 补充保存后读取与定位测试。

P0 不调整页面整体信息架构，不优化 Prompt，不新增字段级确认状态，也不提前迁移 Schema。

P0 必须使用一条真实训练任务完成以下最小闭环：

```text
页面显示题目
-> 修改题目
-> 保存
-> 刷新并重新读取同一值
-> Validator 读取同一值
-> 产生问题时定位回同一输入框
-> 再次修改后旧 Assessment 失效
```

只有这条闭环通过，P0 才能记录为 Engineering PASS。

### P1：校准质量反馈

1. 实施阻断、提醒和信息三级结果；
2. 固定修改提醒结构；
3. 修改后使旧 Assessment 与提醒接受记录失效；
4. 校准重复判断，不以简单文本相似度阻断。

### P2：校准 AI 与旧数据

1. AI 改为五字段结构化输出和职责自检；
2. 支持只重写问题字段；
3. 对语义不确定的旧字段显示人工确认提示；
4. 在真实十素材校准中验证跨题型稳定性。

## 十二、当前结论

`authoring_field_contract_v1.1` 已完成产品与字段语义冻结，并已按 v1 范围完成首轮工程校准：

1. 建立统一字段注册表，集中维护 UI 字段、Schema 路径、Validator 路径、AI 输出路径和编辑定位目标；
2. 页面读取、保存恢复、Plan 受控字段同步、质量检查和定位修改已改为引用同一份字段契约；
3. 具体训练点、题目、学生任务和观察目标之间的职责性重复按黄色提醒处理，不再仅凭文本相似度阻断；
4. 核心字段修改后，旧 Assessment 与人工审核结果按当前 Revision 失效；
5. AI 生成使用五字段结构化结果并校验稳定能力 ID；局部优化只能修改本次明确授权的字段；
6. 旧数据映射会记录来源，对语义不确定的数据标记为需要人工确认。
7. 单页发布对齐已冻结：字段继续由系统管理 Revision，用户不在生产主界面选择历史版本；点击“发布任务”必须消费当前 Revision 和 Assessment Bundle。

当前状态为：

```text
Design: FROZEN
P0 Implementation: COMPLETE
P0 Automated Regression: PASS
P1 Implementation: COMPLETE
P1 Automated Regression: PASS
P2 Implementation: COMPLETE
P2 Automated Regression: PASS
Single-page Publication Alignment: ENGINEERING COMPLETE / REGRESSION PASS
Legacy-draft Browser Load Smoke: PASS
Real-task Browser Acceptance: PENDING
Ten-material Calibration: PENDING
Product Acceptance: PENDING
```

自动化回归已覆盖字段映射、Plan 对齐、保存与校验路径、问题定位、职责性重复提醒、Assessment 失效、AI 输出校验和局部修改授权。

旧草稿浏览器加载冒烟已验证：字段缺失不会导致编辑页崩溃，页面可正常恢复并显示编辑表单。该结果只代表兼容加载通过，不替代以下真实任务闭环验收。

真实任务浏览器闭环仍须验证：

```text
页面显示题目
-> 修改题目
-> 保存
-> 刷新并重新读取同一值
-> Validator 读取同一值
-> 产生问题时定位回同一输入框
-> 再次修改后旧 Assessment 失效
```

真实十素材校准与双浏览器人工验收属于 Product Acceptance。在两项完成前，不得宣称本契约已经完成产品级验收。
