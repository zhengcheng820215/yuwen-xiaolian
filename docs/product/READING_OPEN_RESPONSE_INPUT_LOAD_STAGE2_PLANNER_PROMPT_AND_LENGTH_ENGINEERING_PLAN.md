# 阅读开放文本题输入负担阶段 2 Planner、Prompt 与长度策略工程实施及 Debug 验收清单

英文名称：Reading Open-response Input Load Stage 2 Planner, Prompt and Length Strategy Engineering and Debug Plan

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED`

文档版本：`reading_open_response_input_load_stage2_v1.1`

更新日期：`2026-08-21`

上位契约：[阅读开放文本题难度梯度与输入负担优化契约](./READING_OPEN_RESPONSE_DIFFICULTY_AND_INPUT_LOAD_OPTIMIZATION_CONTRACT.md)

上游工程：[阶段 1 工程实施与 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE1_ENGINEERING_AND_DEBUG_PLAN.md)

上游证据：[阶段 1 工程与 Debug 验收报告](../education/phase/reports/reading_open_response_input_load_stage1_engineering_debug_acceptance_2026-08-20.md)

本阶段证据：[阶段 2 工程与 Debug 验收报告](../education/phase/reports/reading_open_response_input_load_stage2_engineering_debug_acceptance_2026-08-21.md)

## 零、阶段结论

阶段 2 把阶段 1 已验收的只读负担画像，接入开放文本题的规划与候选生成链：

```text
Reviewed Material + Observation Goal
→ TextResponseLoadPlanningIntent
→ Prompt Contract
→ Generated Candidate Draft
→ 确定性负担复算
→ 必要时一次受控定向修复
→ QuestionCandidate
→ 用户采用或重新生成
```

本阶段只改变“候选如何被规划和生成”，不改变正式资源、发布门禁、题组正式顺序、Learning 调度和学生能力画像。

阶段 2 的完成标志不是“所有正式题已经完成治理”，而是：

```text
同一材料、观察目标与题组上下文
→ 形成稳定且可解释的规划意图
→ Prompt 不擅自增加训练动作
→ 题干、Rubric、证据范围、作答形式与内部长度策略一致
→ 不合格初稿最多执行一次受控修复
→ 只有生成契约完整的结果才创建 Candidate
→ 正式资源与 Learning 全程零写入
```

## 一、阶段目标与交付物

阶段 2 必须交付：

1. `TextResponseLoadPlanningIntent` Schema；
2. 确定性开放文本题负担规划器；
3. Planner 到生成 Prompt 的结构化输入契约；
4. `entry_short / focused_short / developing / integrated` 内部长度策略；
5. 生成结果解析与 Candidate 投影；
6. 阶段 1 分析器驱动的一次受控定向修复；
7. 规划、Prompt、长度、修复、写入隔离和回归 Debug；
8. 阶段 2 工程与 Debug 验收报告。

本阶段重点回答：

- 当前观察目标适合要求学生完成哪个主要认知动作？
- 是否确实需要一个紧密依赖的支撑动作？
- 当前题在题组中应承担怎样的输入与组织负担？
- 学生最短的完整有效回答大致需要怎样的内部长度带？
- AI 初稿偏离规划意图时，能否在不改变任务身份和训练目标的前提下修正一次？

## 二、阶段范围与明确非目标

### 2.1 纳入范围

仅纳入：

- 新生成、重新生成和补充生成中的 `short_text / long_text` Candidate；
- Reviewed Material、Observation Plan / TrainingTask 的既有观察目标；
- 当前材料内已存在正式题和候选题的去重上下文；
- 当前题组顺序上下文与单选基础入口是否已经成立；
- 题干、Rubric、答案接受条件、材料证据范围和内部长度策略；
- 一次受控定向修复；
- 生成失败时保留可解释诊断并允许用户重新生成。

### 2.2 不纳入范围

阶段 2 不做：

- 不修改任何 Frozen Question Version；
- 不切换 Formal Resource Registry；
- 不写 Observation Link、Learning Consumable 或 Session Assignment；
- 不把 Stage 1 Finding 接入“可以发布 / 需要确认”的正式门禁；
- 不实现题组发布顺序硬阻断或自动重排；
- 不批量治理历史正式题；
- 不修改 Learning 输入框、学生提示、反馈或队列；
- 不把 `loadLevel`、推荐长度带或生成失败写入 Student Ability Profile；
- 不要求每个题组凑齐四个负担等级；
- 不为满足题型或层级数量强制生成不适合的任务；
- 不自动采用、发布或覆盖 Candidate；
- 不执行第二次、第三次循环修复。

发布门禁与题组顺序硬校验属于阶段 3，既有题治理与真实数据校准属于阶段 4。

## 三、冻结架构与单一事实源

### 3.1 规划顺序

规划器必须按以下顺序决策：

```text
训练目标
→ 主要认知动作
→ 观察对象与证据范围
→ 是否需要紧密依赖的支撑动作
→ targetLoadLevel
→ responseFormat
→ 题组位置与顺序例外
→ 内部推荐长度带
```

禁止反向规划：

```text
“当前还缺 developing”
→ 强行制造 developing 题                    // 禁止

“希望回答 60 字”
→ 反推增加多个评分点                         // 禁止

“已有单选”
→ 取消所有基础文本观察                         // 禁止
```

梯度要求的是题组不存在无理由的负担跳跃，不要求每个负担等级都出现。

### 3.2 观察目标是唯一语义来源

`TextResponseLoadPlanningIntent` 是生成期派生意图，不是新的 Observation Plan：

- 主要训练目标来自既有 Observation Plan / TrainingTask；
- 不得另造第二套能力目标、任务角色或观察对象；
- Planner 可以收窄证据范围、降低表达负担或选择更匹配的作答形式；
- Planner 不得把局部理解任务擅自升级成人物、主题或表达综合分析；
- 若现有任务本身含三个以上独立核心动作，应返回 `requires_task_refocus`，不得靠 Prompt 静默删改训练目标。

### 3.3 声明意图与实际画像分离

模型只接收并执行 `planningIntent`，不得自行声明最终有效负担画像。

生成后必须由阶段 1 确定性分析器重新计算 `TextResponseLoadProfile`：

```text
declared planning intent
≠
effective generated load profile
```

只有二者满足兼容规则时，结果才可投影为 Candidate。这样可以避免模型同时充当出题者和自我验收者。

## 四、阶段 2 Schema

### 4.1 规划意图

```ts
export type TextResponseLoadPlanningIntent = {
  policyVersion: 'reading_open_response_input_load_policy_v1_1';
  plannerVersion: 'reading_open_response_load_planner_v1';
  sourceIdentity: {
    materialVersionId: string;
    observationPlanId?: string;
    trainingTaskId?: string;
    taskRole: 'training' | 'retest' | 'transfer';
  };
  primaryAction: CanonicalTextResponseAction;
  supportingAction?: CanonicalTextResponseAction;
  responseObject: string;
  evidenceScope: {
    sourceAnchorIds: string[];
    requiredEvidenceUnitCount: 0 | 1 | 2 | '3_or_more';
  };
  requiredRelationCount: 0 | 1 | '2_or_more';
  requiredObjectCount: 1 | 2 | '3_or_more';
  targetLoadLevel: TextResponseLoadLevel;
  preferredResponseFormat: 'short_text' | 'long_text';
  expectedAnswerLengthBand: {
    recommendedMin: number;
    recommendedMax: number;
  };
  sequenceContext: {
    position: number;
    singleChoiceFoundationSatisfied: boolean;
    previousLoadLevel?: TextResponseLoadLevel;
    sequencePreference:
      | 'foundation_first'
      | 'holistic_judgment_first'
      | 'role_driven';
    exceptionReason?:
      | 'holistic_judgment_required'
      | 'text_expression_required'
      | 'retest_role'
      | 'transfer_role';
  };
  preserveHigherOrderTextObservation: boolean;
  rationaleCodes: TextResponseLoadPlanningRationaleCode[];
};
```

### 4.2 规划结果

```ts
export type TextResponseLoadPlanningResult =
  | {
      status: 'planned';
      intent: TextResponseLoadPlanningIntent;
    }
  | {
      status: 'requires_task_refocus';
      reasonCodes: TextResponseLoadPlanningBlockCode[];
      evidencePaths: string[];
    }
  | {
      status: 'not_applicable';
      reason: 'non_text_response_format';
    };
```

`requires_task_refocus` 只阻止本次生成创建 Candidate，不改变既有任务、正式题或发布状态。

### 4.3 生成追踪

```ts
export type TextResponseCandidateGenerationTrace = {
  planningIntent: TextResponseLoadPlanningIntent;
  promptVersion: 'reading_open_response_candidate_prompt_v2';
  promptInputFingerprint: string;
  initialProfile?: TextResponseLoadProfile;
  initialFindingCodes: TextResponseLoadFindingCode[];
  repairAttemptCount: 0 | 1;
  repairReasonCodes: TextResponseLoadRepairReasonCode[];
  finalProfile?: TextResponseLoadProfile;
  outcome:
    | 'candidate_created'
    | 'requires_task_refocus'
    | 'generation_contract_failed'
    | 'repair_failed';
};
```

该 Trace 只服务生成期 Debug、恢复和后续质量治理，不投射给学生，不形成新的人工步骤。

## 五、Planner 规则

### 5.1 主要动作与支撑动作

每道文本 Candidate 必须满足：

- 恰好一个主要动作；
- 最多一个支撑动作；
- 支撑动作必须服务于主要动作；
- 两个动作共享观察对象与证据范围；
- Rubric 不得包含题干未要求的独立核心动作。

允许：

```text
找出相关动作描写
→ 解释动作反映的心理
```

不允许：

```text
概括情节
+ 分析人物
+ 联系主题
```

### 5.2 负担等级选择

Planner 应根据动作、证据、关系、对象和序列上下文选择 `targetLoadLevel`，不得按固定配额选择。

推荐序列可以是：

```text
single_choice
→ focused_short
→ developing
→ integrated
```

不要求机械插入 `entry_short`。当整体判断、文本表达或 `retest / transfer` 角色需要时，可以调整顺序，但必须记录 `exceptionReason`。

### 5.3 单选互补与重复防护

若当前题组已通过单选稳定观察某个事实或局部关系：

- 文本题不得只让学生换成文字重复同一结论；
- 文本题必须增加解释、证据组织、推理或表达观察；
- 若没有新增观察价值，应换观察对象、证据范围或认知动作；
- 仍须保留足够文本题观察高阶理解和表达，不能因已有单选而全部降为低负担题。

## 六、内部长度策略

### 6.1 推荐区间

第一版内部参考：

| loadLevel | recommendedMin | recommendedMax |
| --- | ---: | ---: |
| `entry_short` | 10 | 25 |
| `focused_short` | 20 | 40 |
| `developing` | 30 | 60 |
| `integrated` | 50 | 100 |

这些数值是生成与治理起点，不是固定模板。材料完整性、训练动作、必要证据和最短完整回答优先于机械字数。

### 6.2 推荐长度与最低作答要求分离

```text
expectedAnswerLengthBand
≠
minimumAnswerRequirement
```

`recommendedMin / recommendedMax` 只允许用于：

- Prompt 的内容压缩和展开约束；
- Rubric 与 Answer Acceptance 设计辅助；
- 后续输入框初始尺寸计算；
- 后台质量治理和真实数据校准。

默认不得显示为：

- “建议回答 30–60 字”；
- “至少写到 recommendedMin”；
- 题干、作答要求、提示、反馈或下一题说明中的字数提示。

若题目确实需要最低作答要求，必须独立判断内容有效性，且不得机械复制 `recommendedMin`。

### 6.3 计算权威

Planner 先给出目标长度带；生成后由阶段 1 分析器复算实际推荐带。最终接受条件是：

- 目标与实际负担等级相同，或处于契约允许的相邻兼容范围；
- 题干与 Rubric 能在实际推荐带内形成完整答案；
- 不以最低字数代替证据、关系和动作要求；
- 学生可见字段中不存在内部推荐带泄漏。

具体兼容表由阶段 2 代码常量冻结并通过 Debug 验证；不得让模型自行解释“差不多一致”。

## 七、Prompt 输入输出契约

### 7.1 输入

生成 Prompt 必须接收结构化输入：

- Reviewed Material 当前版本和段落锚点；
- Observation Plan / TrainingTask 的既有目标与角色；
- `TextResponseLoadPlanningIntent`；
- 当前题组已有正式题和候选题的去重摘要；
- 已有单选观察对象与证据范围；
- 后续必须保留的高阶文本观察目标；
- responseFormat 能力与字段约束。

### 7.2 输出

模型必须输出严格 JSON，不得混入说明性自然语言。输出至少包含：

- `questionStem`；
- `responseFormat`；
- `materialScope / sourceAnchorIds`；
- `answerAcceptance`；
- `rubric`；
- `minimumAnswerRequirement`（允许为空）；
- 生成字段与 `planningIntent` 的引用身份。

### 7.3 Prompt 硬规则

Prompt 必须明确要求：

1. 只生成一个主要动作；
2. 支撑动作最多一个且紧密依赖；
3. 写清观察对象、材料范围和必要证据数量；
4. Rubric 的 Required 项必须全部在题干中有可感知要求；
5. 以最短完整有效回答推导内容密度；
6. 三个以上独立动作必须收窄或返回无法生成；
7. 不把已被单选确认的事实换一种问法再次要求文本复述；
8. 不挤压后续解释、概括、推理、人物或主题分析；
9. 不在学生字段中输出 `loadLevel`、`recommendedMin / recommendedMax` 或内部策略名；
10. 不改变 Material、TrainingTask、任务角色和主要训练目标身份。

## 八、一次受控定向修复

### 8.1 可修复范围

只有以下生成期问题允许进入一次受控修复：

- `composite_core_actions`；
- `hidden_rubric_requirement`；
- `evidence_scope_insufficient`；
- `evidence_requirement_excessive`；
- `response_format_load_mismatch`；
- `minimum_length_overweighted`；
- `minimum_length_under_supports_rubric`；
- 首道文本题无理由进入过高复合负担；
- 提示复杂度高于题目本身。

### 8.2 锁定字段

修复时必须锁定：

- Material Version；
- Observation Plan / TrainingTask 身份；
- taskRole；
- primaryAction；
- responseObject；
- 核心材料锚点；
- 已确定的 responseFormat，除非 Finding 明确为格式错配；
- 已发布正式题和已有 Candidate。

如果修复需要改变主要训练目标、对象或角色，必须结束本轮并返回重新规划，不得以“修复”名义生成另一道题。

### 8.3 状态机

```text
initial_generation
→ deterministic_reanalysis
→ pass
  → create_candidate

→ eligible_findings
  → one_targeted_repair
  → deterministic_reanalysis
  → pass
    → create_candidate
  → fail
    → repair_failed

→ non_repairable_findings
  → generation_contract_failed
```

修复最多一次。失败结果不进入可采用 Candidate 列表，不影响当前任务组，页面应允许用户重新生成。该行为是生成契约完整性保护，不是阶段 3 发布门禁。

## 九、写入、幂等与失败恢复边界

### 9.1 允许写入

只有在以下条件同时成立时才允许沿既有仓储创建 Candidate：

- Planner 返回 `planned`；
- Prompt 输出 Schema 解析成功；
- 确定性复算通过，或一次修复后通过；
- Candidate 身份字段完整；
- 没有改变任何 Frozen Resource；
- 幂等键未命中已有同一次生成结果。

### 9.2 禁止写入

阶段 2 禁止写入：

- Frozen Question Version；
- Formal Resource Registry；
- Observation Link；
- Learning Consumable；
- Learning Session / Attempt；
- Student Ability Profile；
- 历史 Candidate 内容；
- 当前正式题的顺序或发布状态。

### 9.3 幂等键

建议使用：

```text
materialVersionId
+ trainingTaskId
+ plannerVersion
+ promptVersion
+ promptInputFingerprint
+ generationAttemptIdentity
```

同一次生成重试不得制造重复 Candidate；显式“重新生成”必须获得新的 attempt identity，但仍受相同身份和质量规则约束。

## 十、工程工作包

### WP2.1 Schema 与规划契约

建议文件：

- `src/ai/schemas/readingOpenResponseGenerationPlanning.schema.ts`；
- 复用 `src/ai/schemas/readingOpenResponseInputLoad.schema.ts` 的动作、等级与画像类型；
- 增加 Schema Debug 固定样例。

验收：类型无重复定义，版本号冻结，`loadLevel` 不能被投影进学生画像。

### WP2.2 确定性 Planner

建议文件：

- `src/ai/agents/readingOpenResponseLoadPlanningAgent.ts`；
- 复用既有 Observation Plan / TrainingTask 适配器；
- 不新增第二套任务目标仓储。

验收：同一输入重复运行得到同一 intent；无机械层级配额；三个独立动作返回 refocus。

### WP2.3 Prompt Builder 与严格输出解析

主要接入：

- `src/ai/prompts/materialObservationDraftPrompt.ts`；
- `src/ai/agents/materialObservationDraftGeneratorAgent.ts`；
- 新增负担意图 Prompt 片段和 JSON 解析校验。

验收：输入字段齐全，输出无学生可见内部术语，单选生成链不受影响。

### WP2.4 长度策略

建议增加纯函数策略服务：

- 根据 intent 推导目标推荐带；
- 生成后调用阶段 1 分析器复算；
- 校验最低作答要求不机械复制推荐下限；
- 输出内部诊断，不修改 Learning 文案。

### WP2.5 一次受控修复

建议文件：

- `src/ai/agents/readingOpenResponseCandidateRepairAgent.ts`；
- Repair Prompt 只接收锁定字段、原始草稿和确定性 Finding；
- 修复计数由应用服务控制，模型无权发起第二轮。

### WP2.6 Candidate 投影与失败恢复

- 复用现有 Candidate → Adopt → Revision → Publish 主链；
- 成功时创建新 Candidate；
- 失败时保留生成诊断，不修改当前题组；
- 重试和重新生成必须区分幂等身份。

### WP2.7 自动化 Debug 与报告

建议增加：

- `src/ai/tests/runReadingOpenResponseInputLoadStage2Debug.ts`；
- `debug:reading-open-response-load-stage2` package script；
- 阶段 2 工程与 Debug 验收报告。

## 十一、Debug 固定样例

至少覆盖：

| 编号 | 样例 | 预期 |
| --- | --- | --- |
| S2-01 | 单一信息定位 | `entry_short`，一个主要动作 |
| S2-02 | 局部含义解释 | `focused_short`，证据与解释一致 |
| S2-03 | 证据—结论连接 | `developing` |
| S2-04 | 多证据主题分析 | `integrated` |
| S2-05 | `single_choice` | 返回 `not_applicable`，原链不变 |
| S2-06 | 一个主要动作 + 紧密支撑动作 | 允许生成 |
| S2-07 | 三个独立动作 | `requires_task_refocus` |
| S2-08 | Rubric 暗含题干未要求动作 | 一次修复后对齐 |
| S2-09 | 材料证据不足 | 收窄证据或修复失败 |
| S2-10 | 最低字数机械复制推荐下限 | 修复或失败 |
| S2-11 | 学生字段泄漏长度带 | 不能创建 Candidate |
| S2-12 | 题组缺少某个负担等级 | 不得误判为 Coverage Gap |
| S2-13 | 整体判断优先 | 记录顺序例外 |
| S2-14 | `retest / transfer` | 按角色调整顺序 |
| S2-15 | 已有单选观察同一事实 | 文本题必须增加观察价值 |
| S2-16 | 高阶文本目标需保留 | 不被低负担题挤压 |
| S2-17 | 首稿修复后仍失败 | `repair_failed`，无 Candidate |
| S2-18 | 首稿多个可修复 Finding | 仍只允许一次修复 |
| S2-19 | 同一规划输入重复运行 | intent 与 fingerprint 稳定 |
| S2-20 | 显式重新生成 | 新 attempt，不覆盖旧 Candidate |

## 十二、Debug 验收矩阵

### A. Schema 与 Planner（P2-01—P2-10）

- [x] P2-01：Schema 接受完整 `TextResponseLoadPlanningIntent`；
- [x] P2-02：缺 Material / Task 身份时拒绝；
- [x] P2-03：每道题只有一个主要动作；
- [x] P2-04：支撑动作最多一个；
- [x] P2-05：支撑动作必须与主要动作共享对象和证据；
- [x] P2-06：三个独立动作返回 `requires_task_refocus`；
- [x] P2-07：同一输入规划结果确定；
- [x] P2-08：不为凑层级生成任务；
- [x] P2-09：整体判断、表达、Retest、Transfer 例外可解释；
- [x] P2-10：单选输入走既有链，不产生文本负担 intent。

### B. Prompt 与生成输出（P2-11—P2-20）

- [x] P2-11：Prompt 收到完整材料、锚点、任务和 intent；
- [x] P2-12：Prompt 版本和输入 fingerprint 稳定；
- [x] P2-13：严格 JSON 外的文本被拒绝；
- [x] P2-14：题干与 Required Rubric 动作一致；
- [x] P2-15：题干与材料锚点一致；
- [x] P2-16：responseFormat 与目标负担一致；
- [x] P2-17：已有单选事实不会被文本题直接复述；
- [x] P2-18：后续高阶文本观察不被挤压；
- [x] P2-19：内部 `loadLevel` 不进入学生字段；
- [x] P2-20：推荐长度带不进入题干、要求、提示或反馈。

### C. 长度与一次修复（P2-21—P2-30）

- [x] P2-21：四个等级产生契约范围内的内部推荐带；
- [x] P2-22：推荐带不是最低字数模板；
- [x] P2-23：简单题过高最低字数被识别；
- [x] P2-24：多证据 Rubric 过低作答要求被识别；
- [x] P2-25：生成后使用阶段 1 分析器复算；
- [x] P2-26：声明意图与实际画像不兼容时不直接创建 Candidate；
- [x] P2-27：符合白名单 Finding 时只修复一次；
- [x] P2-28：修复不改变锁定身份和主要目标；
- [x] P2-29：修复失败后无可采用 Candidate；
- [x] P2-30：非白名单 Finding 不进入循环修复。

### D. 写入隔离与回归（P2-31—P2-40）

- [x] P2-31：正常生成只新增 Candidate；
- [x] P2-32：Frozen Question Version 零写入；
- [x] P2-33：Registry / Observation Link 零写入；
- [x] P2-34：Learning Session / Attempt 零写入；
- [x] P2-35：Student Ability Profile 零写入；
- [x] P2-36：同一次重试不制造重复 Candidate；
- [x] P2-37：显式重新生成不覆盖旧 Candidate；
- [x] P2-38：Candidate 采用、Revision、发布既有回归通过；
- [x] P2-39：单选、Targeted Micro-training、Learning 队列既有回归通过；
- [x] P2-40：生产构建通过。

阶段 2 Debug 必须 `40 / 40` 通过，不能用人工截图替代核心状态与写入断言。

## 十三、回归命令基线

阶段 2 至少运行：

```bash
npm run debug:reading-open-response-load-stage1
npm run debug:reading-open-response-load-stage2
npm run debug:material-observation-draft-generator
npm run debug:question-candidate-workflow
npm run debug:reading-single-choice-stage1
npm run debug:reading-single-choice-stage2
npm run debug:reading-single-choice-stage3
npm run debug:reading-single-choice-stage4
npm run debug:targeted-micro-training-stage1
npm run debug:targeted-micro-training-stage2
npm run debug:targeted-micro-training-stage3
npm run debug:targeted-micro-training-stage4
npm run debug:learning-session-task-queue
npm run build
```

如果仓库使用工作区绑定 Node，验收报告必须记录实际 Node 路径、版本、命令和退出码。

## 十四、真实样例验收

自动化通过后，至少选择四类真实材料任务进行生成旁路验收：

1. 局部事实或含义题；
2. 证据—结论关系题；
3. 人物或主题综合题；
4. 已有单选基础入口的混合题组。

每类至少验证：

- Planner intent 是否符合原训练目标；
- 题干与 Rubric 是否只有一个主要动作；
- 推荐长度带是否合理且不对学生可见；
- 首稿偏差是否由一次修复收敛；
- 失败时当前正式题组是否保持不变；
- 用户是否仍只面对“采用 / 重新生成”的既有决策。

真实样例只创建测试 Candidate 或在隔离仓运行，不允许为了验收直接替换活动正式题。

## 十五、阶段完成条件

只有同时满足以下条件，阶段 2 才可标记 `ENGINEERING COMPLETE / DEBUG ACCEPTED`：

- [x] WP2.1—WP2.7 全部完成；
- [x] P2-01—P2-40 全部通过；
- [x] 阶段 1 `28 / 28` 继续通过；
- [x] 四类真实题型由当前正式题库只读基线和隔离生成样例完成旁路验收；
- [x] 只新增 Candidate，正式资源和 Learning 零写入；
- [x] 单选链、Candidate 链、Targeted 链和 Learning 队列回归通过；
- [x] 推荐长度带未出现在任何学生可见字段；
- [x] 一次受控修复无循环和静默目标漂移；
- [x] 生成失败可解释、可重试且不污染当前任务组；
- [x] 工程验收报告已记录代码范围、测试证据、残余风险和回滚点。

## 十六、阶段 3 进入门

进入阶段 3 前必须具备：

- 稳定的 Planner intent 与 Prompt 版本；
- 真实 Candidate 样例证明主要动作、Rubric、证据与长度一致；
- 一次修复的成功率与失败样例已记录；
- 生成失败不会创建可采用 Candidate；
- 未出现负担等级机械配额；
- 未出现推荐长度或内部术语学生端泄漏；
- 未写入 Student Ability Profile；
- 正式资源生产主链回归通过。

阶段 3 才允许把已经验证稳定的负担规则接入：

- 单题 Candidate 质量门禁；
- 题组顺序硬校验；
- 无理由负担跳跃阻断；
- 发布前负担完整性验收。

阶段 3 的正式工程边界、发布就绪同源不变量和 `P3-01—P3-48` Debug 验收矩阵已冻结在[阶段 3 质量门禁、题组顺序与发布一致性工程实施及 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE3_QUALITY_GATE_AND_SEQUENCE_ENGINEERING_PLAN.md)。该文件当前状态为 `DESIGN READY / ENGINEERING NOT STARTED`。

在阶段 3 契约和工程验收完成前，阶段 2 的生成追踪与复算结果不得投射成新的“需要确认”人工步骤，也不得改变“采用或重新生成”的产品原则。
