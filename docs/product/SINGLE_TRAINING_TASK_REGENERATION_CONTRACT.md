# Phase 17 单训练任务重新生成契约

英文名称：Single Training Task Regeneration Contract

状态：HISTORICAL DOMAIN REFERENCE / STANDARD UI SUPERSEDED
契约版本：`single_training_task_regeneration_contract_v1`  
更新日期：2026-08-06

> 2026-08-13 现行交互说明：本文保留单个 `TrainingTaskCandidate` 的版本保护与历史实现证据，不再定义标准工作台交互。当前标准路径不提供 TrainingTask 编辑缓冲区、人工字段修改、删除任务或二次保存；用户只对完整 AI 任务方案执行“采用当前任务方案”或“重新生成任务方案”。现行规则以 [AI 训练任务、题目采用与真实作答校准契约](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md) 和 [训练任务组 AI 规划契约](./TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md) 为准。

## 一、用途

本文定义素材资源录入平台中“AI 重新生成”单个训练任务的产品语义、版本边界和工程约束。

该能力用于处理以下情况：

1. 当前训练任务的题目、学生任务、观察目标或评分设计质量较差；
2. 内容人员希望保留当前材料和训练设置，只重新获得一份任务表达；
3. 当前 Plan 中其他训练任务已经可用，不应被重新生成或重新审核；
4. 当前任务已经人工审核或已经产生正式题目，不能被新结果直接覆盖。

本契约不是“重新生成整批训练任务”的快捷入口，也不是直接发布操作。

> 对象边界：本文中的“候选”专指上游 Observation Plan 的 `TrainingTaskCandidate`。采用该候选只进入 Plan 编辑缓冲区，确认任务组后才形成 Plan Revision；它不是下游不可变 `QuestionCandidate`，也不会因采用而创建 Question Revision。正式题目候选以 [AI 资源生成与优化工作流契约](./AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md) 为准。

## 二、核心原则

### 2.1 单任务作用域

重新生成必须只作用于用户明确选择的一个 `ObservationTaskPlan`。

```text
当前 Material Observation Plan
├─ 训练任务一：保持不变
├─ 训练任务二：重新生成
└─ 训练任务三：保持不变
```

操作前后任务槽位数量不变，不得因为一次单任务重新生成新增第四个任务，也不得重新生成兄弟任务。

### 2.2 TrainingTaskCandidate 先行，采用进入 Plan 编辑区，确认后成版

点击“AI 重新生成”只创建临时候选，不立即创建 Plan Revision：

```text
点击 AI 重新生成
-> 基于当前已保存版本生成候选
-> 展示原内容与候选内容
-> 用户选择“采用候选”或“保留原内容”
-> 采用候选只更新当前页面的任务编辑缓冲区
-> 用户点击“保存任务组并重新检查”
-> 系统创建一个新的 Plan Revision
```

“采用候选”不是版本写入动作。只有编辑缓冲区存在有效业务差异，且用户明确点击“保存任务组并重新检查”时，系统才创建新的 Plan Revision。

放弃候选、关闭比较区、仅采用但尚未保存，或 AI 未生成有效差异时，均不写入 Revision，不改变已保存版本的审核状态。

### 2.3 历史版本不可覆盖

已保存、已审核或已产生正式题目的版本继续保留：

1. 新候选不得修改旧 Plan Revision；
2. 已发布 Question Resource 继续绑定原 Plan、Observation Task 和 Material Version；
3. 采用候选后仅标记当前编辑缓冲区已修改，保存后才形成新的待检查 Plan Revision；
4. 新 Revision 完成检查、人工审核和后续发布前，不替代当前正式版本。

### 2.4 质量判断必须失效

采用 AI 候选属于影响正式质量判断的编辑操作。采用后，当前编辑缓冲区不得沿用旧检查结果；保存为新 Plan Revision 后：

1. 新 Plan Revision 的旧 Validation 不得沿用；
2. 目标任务的旧人工审核结论不得代表新内容；
3. 依赖目标任务旧内容的 Question Quality Assessment 不得作为当前依据；
4. 目标任务必须重新保存、检查、人工审核并进入题目审核发布链路。

旧 Revision、旧 Validation、旧 Review 和旧 Assessment 继续保留用于追溯，不物理删除。

## 三、重新生成时保留与重写的内容

### 3.1 默认锁定的训练设置

单任务重新生成默认保留下列受控输入，不允许 AI 静默修改：

| 内容 | 当前来源 | 规则 |
| --- | --- | --- |
| Material | `materialId` / `materialVersionId` | 必须保持当前素材版本 |
| 任务槽位 | 当前目标任务引用 | 保持“这是同一个待优化任务”的逻辑身份 |
| 观测维度 | `primaryDimension` | 默认锁定 |
| 能力目标 | `abilityId` | 沿用当前 Plan |
| 任务用途 | `taskRole` | 沿用当前 Plan |
| 难度 | `difficulty` | 沿用当前 Plan |
| 材料范围 | `sourceAnchorIds` | 默认锁定，不扩大或缩小阅读范围 |

内容人员若要调整能力、任务用途、难度、观测维度或材料范围，应先进入“编辑训练设置”，保存新的 Plan Revision，再基于新设置重新生成。AI 重新生成按钮不得同时承担“修改训练计划”的职责。

### 3.2 允许 AI 重写的内容

AI 可以在锁定设置内重新生成：

1. 具体训练点；
2. 题目；
3. 学生任务；
4. 观察目标；
5. 设计依据；
6. 评分项与答案要点；
7. 最低作答要求与校准示例。

输出必须遵循 [Phase 17 录入字段契约](./AUTHORING_FIELD_CONTRACT.md)：

```text
题目
-> 学生回答什么

学生任务
-> 学生如何作答

观察目标
-> 系统或审核者检查什么表现

评分标准
-> 如何区分不同完成水平
```

AI 不得用近义改写制造“看似不同、职责仍重复”的候选。

## 四、用户交互

### 4.1 入口

任务卡片顶部操作区按以下顺序展示：

```text
[AI 重新生成] [编辑]
```

“AI 重新生成”使用次级绿色线框按钮，“编辑”沿用当前编辑操作样式。按钮仅在当前素材、当前 Plan 和目标任务均可定位时可用。

以下情况禁用重新生成：

1. 当前任务存在未保存修改；
2. 当前展示的不是最新可编辑 Plan Revision；
3. Material Version 已停用或不可用；
4. AI 服务不可用；
5. 当前已有一项重新生成请求正在执行。

存在未保存修改时提示：

> 请先保存或放弃当前修改，再重新生成该训练任务。

### 4.2 操作确认

点击后显示：

> 将根据当前素材和训练设置重新生成本任务。现有内容会继续保留，其他训练任务不受影响。采用候选只更新当前编辑内容；保存任务组并重新检查后，系统才会创建新的待审核版本。

操作：

- `继续生成`
- `取消`

### 4.3 候选比较

生成成功后必须展示：

1. 当前版本；
2. AI 候选；
3. 发生变化的字段；
4. 保持锁定的训练设置；
5. AI 自检结果与需要人工确认的提醒。

操作：

- `采用到编辑区`
- `保留当前版本`
- `再生成一次`

“再生成一次”代表新的人工发起尝试，使用新的 Attempt ID；网络重试或重复回调必须复用原 Attempt ID。

### 4.4 采用结果

采用成功后提示：

> 候选已替换训练任务二的编辑内容。训练任务一和训练任务三未发生变化；保存任务组并重新检查前，不会创建新版本。

页面随后定位到目标任务，并显示：

```text
状态：有未保存修改
来源：AI 重新生成
```

## 五、版本与身份

### 5.1 不可变 Plan Revision

采用候选先更新任务编辑缓冲区；用户点击“保存任务组并重新检查”后创建新的 `MaterialObservationPlan` Revision：

```text
Plan Revision N
-> Regeneration Candidate
-> 人工采用
-> 本地编辑缓冲区
-> 保存任务组并重新检查
-> Plan Revision N + 1
```

新 Plan Revision 必须：

1. 通过 `parentPlanId` 指向来源 Plan；
2. 保留相同 Material Version；
3. 保留任务顺序；
4. 对兄弟任务执行内容级无损复制；
5. 只把目标任务标记为本轮发生业务变化；
6. 将 Plan 状态恢复为 `draft`。

当前 Schema 会在构建 Plan Revision 时重新生成物理 `observationTaskPlanId`。工程实现不得仅用物理 Task ID 判断“是否为同一逻辑任务”，必须记录稳定的任务修订根或等价映射。

建议的最小身份对象：

```ts
type ObservationTaskRevisionIdentity = {
  taskRevisionRootId: string;
  sourcePlanId: string;
  sourcePlanRevision: number;
  sourceObservationTaskPlanId: string;
  targetPlanId: string;
  targetPlanRevision: number;
  targetObservationTaskPlanId: string;
};
```

`taskRevisionRootId` 在同一逻辑任务的后续重新生成与人工修订中保持稳定。正式持久化位置应在工程设计时确定；在此之前不得通过题号、数组下标或题干文本猜测身份。

### 5.2 兄弟任务不得产生新待审核题目

新 Plan Revision 进入题目审核交接时，必须比较任务修订根与业务内容签名：

1. 目标任务内容已变化：创建或恢复该任务对应的新 Question Draft；
2. 兄弟任务内容未变化：继续引用既有审核或正式结果；
3. 不得因为 Plan Revision 增加而为全部兄弟任务重新创建 Draft；
4. 不得把已发布兄弟任务重新计入“待审核题目”。

## 六、幂等与并发

### 6.1 请求对象

```ts
type SingleTaskRegenerationRequest = {
  requestId: string;
  attemptId: string;
  sourcePlanId: string;
  sourcePlanRevision: number;
  sourceObservationTaskPlanId: string;
  taskRevisionRootId: string;
  sourceBusinessSignature: string;
  lockedSettingsSignature: string;
  generatorContractVersion: string;
};
```

### 6.2 幂等规则

1. 同一 `attemptId` 的重复提交、网络重试和重复回调只能返回同一候选；
2. 同一候选只能进入当前编辑缓冲区一次；
3. 重复点击“采用候选”不得创建 Plan Revision；
4. 候选与当前业务内容签名相同，不标记编辑缓冲区为已修改，也不创建 Revision；
5. 来源 Plan 已被其他操作更新时返回 `409 stale_source_revision`，不得从旧版本分叉；
6. 用户明确点击“再生成一次”时创建新的 `attemptId`，但仍基于同一已保存来源版本；
7. 页面刷新后若存在尚未处理的候选，可以恢复候选比较；不得自动采用。

### 6.3 业务内容签名

签名只包含会影响训练任务语义和正式质量判断的字段，不包含：

1. 页面展开状态；
2. 焦点；
3. 提示条；
4. 请求耗时；
5. Provider 名称等界面信息。

## 七、AI 输入与输出

### 7.1 输入

AI 输入必须包含：

1. 当前 Material Version 与合法段落编号；
2. 当前任务完整内容；
3. 锁定的能力、任务用途、难度、维度和材料范围；
4. 同一 Plan 中其他任务的能力、题目、回答对象和评分要点；
5. 字段契约版本；
6. 当前 Generator Contract 与 Validator 规则版本；
7. 用户可选的重新生成原因。

同批其他任务只用于避免重复，不允许被 AI 修改。

### 7.2 输出

```ts
type SingleTaskRegenerationCandidate = {
  attemptId: string;
  sourceBusinessSignature: string;
  authoringContractVersion: string;
  generatorContractVersion: string;
  task: {
    specificTrainingPoint: string;
    questionStem: string;
    studentTask: string;
    observationTarget: string;
    designReason: string;
    resourceDraftSpecification: unknown;
    calibrationCases: unknown[];
  };
  preservedSettings: {
    abilityId: string;
    taskRole: string;
    difficulty: string;
    primaryDimension: string;
    sourceAnchorIds: string[];
  };
  changedFields: string[];
  selfCheck: {
    passed: boolean;
    issues: string[];
  };
};
```

候选不允许返回新的自由文本能力、任务用途或难度。候选自检不通过时不得显示为可直接采用，必须明确指出需要人工处理的字段。

## 八、失败与恢复

| 情况 | 产品行为 |
| --- | --- |
| AI 服务不可用 | 保留原内容，显示可重试提示 |
| AI 输出不符合字段契约 | 不允许采用，显示具体失败字段 |
| AI 与原内容无实质差异 | 不创建版本，建议保留原内容或明确调整训练设置 |
| 来源版本过期 | 提示刷新最新版本，不创建分叉 |
| 采用过程中保存失败 | 保留候选，允许幂等重试 |
| 页面中途关闭 | 原版本不变；可恢复未处理候选 |
| 目标任务已有进行中的候选 | 恢复现有候选，不并行创建多个候选 |

任何失败都不得清空当前任务，不得影响兄弟任务，也不得使既有正式资源失效。

## 九、审核与发布边界

采用候选后：

1. 新 Plan Revision 必须重新执行结构校验；
2. 人工审核只需重点核对发生变化的目标任务，但 Review Decision 仍绑定完整 Plan Revision；
3. 进入题目审核平台时只为发生变化的目标任务创建或恢复 Draft；
4. 已发布兄弟任务继续显示为“已发布”，不进入待审核计数；
5. 目标任务发布成功后才能替代该任务的当前正式版本；
6. 新版本发布前，旧正式版本继续可用。

“AI 重新生成”不得直接触发：

1. Human Review；
2. Freeze；
3. Registry 写入；
4. Resource Observation Link 替换；
5. Runtime 当前资源切换。

## 十、工程实施顺序

### P0：单任务边界与幂等

1. 定义请求、候选和任务修订身份；
2. 锁定 Material、能力、任务用途、难度、维度与材料范围；
3. 同一 Attempt 幂等；
4. 候选先行，采用只更新编辑缓冲区，保存任务组并重新检查后才创建 Plan Revision；
5. 采用后只标记目标任务发生变化；
6. 阻止重复采用、旧版本分叉和相同内容建版；
7. 补充 Repository 与服务层测试。

### P1：比较与恢复

1. 在任务卡增加“AI 重新生成”；
2. 增加确认、加载、比较、采用和保留状态；
3. 展示变化字段和锁定设置；
4. 支持页面刷新后恢复候选；
5. 失败时保留原任务并提供可理解的恢复动作。

### P2：审核交接

1. 新 Plan Revision 只为变化任务创建或恢复 Question Draft；
2. 兄弟任务复用既有审核与正式结果；
3. 目标任务旧 Assessment 失效；
4. 校准统计、题号、待审核明细和已发布明细；
5. 完成真实异常路径验收。

## 十一、验收标准

至少覆盖：

1. 重新生成任务二后，任务数量仍保持不变；
2. 任务一和任务三的业务内容签名不变；
3. 点击生成但不采用，不创建 Plan Revision；
4. 采用候选不创建 Plan Revision；
5. 采用候选后点击一次“保存任务组并重新检查”只创建一个新 Plan Revision；
6. 网络重试不产生第二个候选；
7. 候选与原内容相同时不创建 Revision；
8. 未保存修改存在时禁止重新生成；
9. 新候选不能修改锁定训练设置；
10. 新候选通过五字段职责自检；
11. 采用后当前编辑缓冲区不得显示旧检查为有效；保存后旧 Validation、Review 和相关 Assessment 不得作为新 Revision 的当前依据；
12. 已发布资源在新版本发布前继续有效；
13. 进入题目审核平台时只出现目标任务的新 Draft；
14. 兄弟任务不重新进入待审核计数；
15. 页面刷新后可以恢复未处理候选；
16. 两个浏览器同时采用同一候选时，只允许一个成功；
17. AI 失败、保存失败和版本冲突均不丢失原任务；
18. 真实素材中完成一次“生成候选 -> 放弃”和一次“生成候选 -> 采用 -> 检查 -> 审核 -> 发布”的完整验收。

## 十二、与现有契约的关系

本文服从以下既有规则：

1. [Phase 17 录入字段契约](./AUTHORING_FIELD_CONTRACT.md)：定义 AI 可重写字段的职责；
2. [System Map](../runtime/SYSTEM_MAP.md)：定义 Revision、Assessment 失效和正式发布边界；
3. [Phase 17.2](../education/phase/phase17_2.md)：定义 Material Observation Plan、题目审核交接和异常题目修订闭环。

若本文与正式 Schema 或 Repository 现状存在差异，工程实现必须先补充适配或迁移设计，不得通过页面状态、题号、数组下标或题干文本临时推断任务身份。

## 十三、工程实现状态

截至 2026-07-29，已完成以下工程闭环：

1. 训练任务卡片提供独立的 `AI 重新生成` 入口；
2. 生成结果先作为临时候选展示，不直接修改当前任务；
3. 候选区逐字段比较具体训练点、题目、学生任务、观察目标和评分标准；
4. 用户可以保留原内容、再次生成或采用候选；
5. 采用候选只更新当前编辑缓冲区，点击“保存任务组并重新检查”后才创建新的 Plan Revision；
6. 保存后目标任务获得新的物理任务 ID，同时保留稳定的 `taskRevisionRootId`；
7. 兄弟任务沿用原任务 ID 和业务内容，不因 Plan Revision 增加而重新建稿；
8. 相同 `attemptId` 的请求幂等复用；
9. 候选与原任务没有业务差异时不创建新 Revision；
10. 题目审核交接只为发生变化的目标任务创建 Draft，兄弟任务复用已有审核或发布结果。

当前实现采用页面会话内候选。刷新页面后恢复未处理候选、跨浏览器并发采用和真实发布全链路仍属于后续持久化与并发验收范围。

## 十四、Debug 与验收记录

自动化验收：

1. 单任务候选本地采用边界测试 `5/5 PASS`；
2. 素材资源生产回归测试 `15/15 PASS`；
3. 训练任务生成器回归测试 `39/39 PASS`；
4. Phase 17 录入字段契约测试通过；
5. Production Build 通过。

单任务候选采用测试已证明：

1. 采用中间任务候选后数量和顺序不变；
2. 两个兄弟任务保持原对象和内容；
3. 目标任务在编辑缓冲区保留稳定身份并标记为待保存；
4. 采用动作不调用 Repository，不创建 Revision；
5. 过期候选无法进入编辑缓冲区。

真实浏览器验收已完成：

1. 展开任一训练任务可见独立重新生成入口；
2. 真实 AI 请求返回候选期间明确提示原内容不会被修改；
3. 候选返回后能够查看旧内容与新内容的逐字段差异；
4. 点击 `保留原内容` 后候选被清除，原任务保持不变；
5. 页面未出现布局错位或阻断性运行错误。

真实版本写入仍必须通过“保存任务组并重新检查”完成。专用验收素材应补一次“生成候选 -> 采用到编辑区 -> 确认未建版 -> 保存任务组并重新检查 -> 确认仅新增一个 Revision”的完整真实链路。

## 十五、当前结论

单训练任务重新生成应被实现为：

```text
锁定当前已保存训练设置
-> 只生成当前任务候选
-> 人工比较
-> 采用到当前编辑缓冲区
-> 保存任务组并重新检查后创建新 Plan Revision
-> 只使目标任务相关检查失效
-> 只把目标任务重新送入审核发布
```

当前状态：

```text
Design: FROZEN
Engineering: IMPLEMENTED
Automated Regression: PASSED
Real-task Browser Candidate Acceptance: PASSED
Real-task Adoption And Publish Acceptance: PENDING
Product Acceptance: IN PROGRESS
```

当前能力已经超过“只增加一个前端按钮”：任务修订身份、Attempt 幂等、无差异不建版和兄弟任务审核复用均已落地。正式宣告完整产品验收前，仍需使用专用验收素材完成一次“采用候选 -> 检查 -> 人工审核 -> 发布”的真实链路。
