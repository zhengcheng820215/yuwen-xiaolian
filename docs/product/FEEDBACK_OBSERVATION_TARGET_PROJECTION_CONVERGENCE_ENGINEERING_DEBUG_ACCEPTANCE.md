# 反馈观察对象投射收口工程与 Debug 验收文档

状态：`DEBUG ACCEPTED / NARROW BROWSER SMOKE ACCEPTED`  
日期：2026-08-25  
适用范围：Current Formal Question → Learning Diagnosis / Evidence → Student Feedback

## 一、背景与问题定义

“全部正式题提示与反馈批量审计”已覆盖 Shared Formal Resource Store Revision `1962` 的 `81` 道 Current Head：

- `0 blocked`；
- `42 pass`；
- `39 advisory`；
- `39` 条 advisory 均为 `feedback_target_ambiguous`。

这些题当前只能投射为“理解 / 分析 / 推理 / 信息提取的关键内容”。该表达不会制造错误结论，但无法稳定告诉学生：本题真正需要观察的是人物心理、具体事实、事件原因、前后关系、变化过程还是主题含义。

本轮目标不是逐题润色反馈，也不是扩充新的人工审核步骤，而是收口统一 Feedback Target Adapter，使同一类题稳定获得同一类观察对象。

## 二、核心原则

1. 反馈观察对象描述“学生本题需要建立什么”，不得退化为能力名称。
2. 对象投射必须来自题干、题型和必要 Rubric 的共同证据，不得根据学生答案猜测题目目标。
3. Rubric 不得把题干未要求的隐藏维度投射为学生缺口。
4. 无法可靠识别时继续使用克制的通用投射，不得为消除 advisory 强行猜测。
5. Adapter 优化不修改 Frozen Resource，不改变 Registry Head，不创建 Candidate。
6. 只有题干或 Rubric 本身无法表达稳定对象时，才进入 successor Candidate 治理。
7. 新语义只影响反馈观察对象投射；Material → Plan → Task → Candidate → Publish → Learning 主链保持不变。
8. 每个工程步骤都必须证明旧主链零回归，并且新语义只在本阶段允许的边界内生效。

## 三、结构化投射契约

统一 Adapter 应返回结构化对象，展示文案只作为派生结果：

```ts
type FeedbackObservationTargetCode =
  | 'character_psychology'
  | 'character_trait'
  | 'scene_or_object_state'
  | 'fact_or_evidence'
  | 'event_process_or_change'
  | 'event_cause'
  | 'relationship_or_comparison'
  | 'main_content'
  | 'expression_effect'
  | 'structure_relation'
  | 'theme_or_meaning'
  | 'requirement_completion'
  | 'generic_content';

type FeedbackObservationTargetProjection = {
  schemaVersion: 'feedback_observation_target_projection_v1';
  targetCode: FeedbackObservationTargetCode;
  subject?: string;
  displayLabel: string;
  confidence: 'high' | 'medium' | 'low';
  evidenceSignals: string[];
  fallbackReason?:
    | 'insufficient_question_signal'
    | 'question_rubric_mismatch'
    | 'unsupported_target_pattern';
};
```

冻结规则：

- 统计、审计和策略判断使用 `targetCode`，不得依赖自由文本 `displayLabel`；
- `subject` 仅在题干能够稳定定位人物、事物或段落对象时填写；
- `evidenceSignals` 记录命中的题干、题型或 Rubric 信号，用于 Debug，不直接展示给学生；
- `low` confidence 必须使用 `generic_content` 并填写 `fallbackReason`；
- 旧调用方暂时需要字符串时，由兼容函数返回 `displayLabel`，不得维护第二套判断规则。

## 四、观察对象分类边界

| Target Code | 适用问题 | 学生可见方向示例 |
| --- | --- | --- |
| `character_psychology` | 心理、心情、情感、想法 | 人物的心理 |
| `character_trait` | 人物特点、品质、形象 | 人物的特点 |
| `scene_or_object_state` | 景物、事物或整体状态及变化 | 景物或事物的状态 |
| `fact_or_evidence` | 找出、指出、信息定位、直接依据 | 文中的具体事实或依据 |
| `event_process_or_change` | 经过、步骤、先后、变化过程 | 事情的发展或变化过程 |
| `event_cause` | 原因、为什么、因果判断 | 事情发生的原因 |
| `relationship_or_comparison` | 联系、区别、共同点、对应关系 | 两项内容之间的关系 |
| `main_content` | 概括主要内容、事件或表现 | 主要内容 |
| `expression_effect` | 修辞、词句作用、表达效果 | 词句的表达效果 |
| `structure_relation` | 总分、照应、承接、过渡、铺垫 | 句段的结构关系 |
| `theme_or_meaning` | 主旨、主题、深层含义、启示 | 内容所表达的主题或含义 |
| `requirement_completion` | 明确要求完成若干规定动作 | 题目要求的各项内容 |
| `generic_content` | 证据不足时的安全降级 | 本题需要说明的内容 |

分类描述的是观察对象，不等同于 Ability：

- `analysis` 可以观察人物心理、表达效果或关系；
- `comprehension` 可以观察事实、原因或主题含义；
- `inference` 可以观察原因、关系或人物心理；
- 不得再由 Ability 直接拼接“分析的关键内容”。

## 五、识别优先级与冲突处理

识别顺序冻结为：

1. 题干明确要求的对象与动作；
2. `questionType` 的稳定语义；
3. 与题干一致的 required Rubric / Minimum Answer Requirement；
4. Ability 仅作为消歧信息，不作为具体对象来源；
5. 仍无法确定时进入 `generic_content` 安全降级。

冲突规则：

- 题干与 required Rubric 指向不同对象时，不允许 Rubric 静默覆盖题干；投射为 low confidence，并由批量审计记录 `question_rubric_mismatch`；
- 同时包含多个动作时，选择题干的主要交付对象；其他动作仍由 Requirement Coverage 负责，不把多个对象机械拼成反馈标题；
- “为什么”若服务于表达作用或人物心理解释，应优先投射真实对象，不得一律归为 `event_cause`；
- 出现“特点”但主语是景物、事物或整体状态时，不得投射为人物特点；
- Retest / Transfer 继续使用同一对象语义，不因 Task Role 不同而自动改变目标。

## 六、工程改造范围

### 6.1 必须修改

- 将 `describeStudentFeedbackTaskTarget` 的内部实现升级为结构化 Adapter；
- 保留旧字符串接口作为兼容投影，所有判断集中到一个实现；
- 批量审计服务读取 `targetCode / confidence / fallbackReason`；
- 为 `39` 条 advisory 建立按 Target Code 聚合的回归样例；
- Learning 的 Requirement Coverage、已完成反馈、思考缺口和下一步训练统一消费同一 `displayLabel`。

### 6.2 可以保持不变

- Material、Material Version 与 Registry；
- Observation Plan、TrainingTask、QuestionCandidate；
- Frozen Resource Version 与 Frozen Quality Trace；
- Adoption、Validation、Assessment、Publication；
- Attempt、Diagnosis、Evidence、Revision 数据身份；
- Single Choice 判定逻辑；
- Targeted Micro-training、Retest、Transfer 调度链。

### 6.3 明确不做

- 不批量覆盖 `81` 道 Current Head；
- 不为了 advisory 数量归零新增题型或改写题干；
- 不根据学生一次错误答案反推题目观察对象；
- 不把 Adapter confidence 写入学生能力画像；
- 不新增学生端“观察对象分类”标签或人工确认入口。

## 七、兼容与迁移策略

本轮采用运行时派生，不进行正式资源数据迁移：

1. 结构化投射由现有 Frozen Version 字段即时计算；
2. 旧函数继续返回字符串，避免一次性修改所有调用方；
3. 新批量审计优先消费结构化结果；
4. 如未来需要持久化，只能新增版本化 projection snapshot，不得改变旧 Frozen Version；
5. 已开始的 Learning Session 保持其 Resource Version 身份，Adapter 升级仅改变通用反馈表述，不改变判分与 Evidence 归属。

## 八、Finding 与放行规则

新增或收口以下 Finding：

| Finding | 严重度 | 说明 |
| --- | --- | --- |
| `feedback_scenery_misclassified_as_character_trait` | blocked | 景物或事物状态误投人物特点 |
| `feedback_expression_target_mismatch` | blocked | 表达效果题投射错位 |
| `feedback_structure_target_mismatch` | blocked | 结构关系题投射错位 |
| `feedback_question_rubric_target_mismatch` | blocked | 题干与必要 Rubric 的对象冲突 |
| `feedback_target_ambiguous` | advisory | 只能安全降级为通用对象 |
| `feedback_target_medium_confidence` | info | 对象明确但主体或范围需要真实 Trial 校准 |

放行原则：

- `blocked = 0` 才能通过工程验收；
- advisory 不阻断 Learning，也不产生新的人工步骤；
- 不设“advisory 必须为 0”的机械指标；
- 每个剩余 advisory 必须具有明确 `fallbackReason`，不能无解释地回退。

## 九、Debug 验收矩阵

### A. Adapter 单元验收

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| FT-01 | 人物心理题 | `character_psychology` |
| FT-02 | 人物形象题 | `character_trait` |
| FT-03 | 景物“特点”题 | `scene_or_object_state`，不得为人物特点 |
| FT-04 | 信息定位题 | `fact_or_evidence` |
| FT-05 | 先后变化题 | `event_process_or_change` |
| FT-06 | 直接原因题 | `event_cause` |
| FT-07 | 比较、联系与共同点 | `relationship_or_comparison` |
| FT-08 | 概括题 | `main_content` |
| FT-09 | 修辞与表达作用题 | `expression_effect` |
| FT-10 | 照应、总分与过渡题 | `structure_relation` |
| FT-11 | 主旨与深层含义题 | `theme_or_meaning` |
| FT-12 | 多项规定动作题 | `requirement_completion` |
| FT-13 | 证据不足题 | `generic_content + low confidence + fallbackReason` |
| FT-14 | “为什么”服务于表达效果 | 不得误归普通事件原因 |
| FT-15 | 题干与 Rubric 冲突 | blocked finding，不静默覆盖 |
| FT-16 | Retest / Transfer | 目标语义保持一致 |

### B. 全部正式题批量验收

- 审计数量继续为 Current Head 动态基线，本轮基线为 `81`；
- 每道题恰好产生一个结构化投射；
- `blocked = 0`；
- 原 `39` 条 advisory 按新分类重新计算并输出差异；
- advisory 应因真实对象识别而下降，不能通过删除 Finding 或强制分配类别下降；
- 剩余 low-confidence 项全部具有 `fallbackReason`；
- 运行前后 Shared Store revision 与数据完全一致。

### C. Learning 零回归

- 回答到位、思考缺口、下一步训练仍引用同一真实观察对象；
- 景物状态题不再出现人物特点文案；
- 完成项不因新对象投射被重新判为缺失；
- 缺少依据不被解释为结论错误；
- 单选题仍只评价选择，不要求学生补写文本解释；
- Revision、Targeted Micro-training、Retest / Transfer 仍绑定原正式资源身份；
- 学生界面不展示内部 Target Code、confidence 或 fallbackReason。

### D. 工程回归

至少执行：

```bash
npm run audit:formal-question-hint-feedback
npm run debug:controlled-feedback-expression
npm run debug:student-feedback-grounding
npm run debug:student-feedback-action-plan
npm run build
```

所有命令必须退出码为 `0`。生产构建既有 Chunk 体积提示不属于本轮阻断项，但不得新增编译错误或运行时错误。

## 十、完成定义

满足以下条件后，本轮状态可从 `ENGINEERING READY` 更新为 `DEBUG ACCEPTED`：

1. 结构化 Adapter 成为唯一对象识别来源；
2. 旧字符串接口通过兼容投影工作，不存在第二套规则；
3. FT-01—FT-16 全部通过；
4. `81` 道 Current Head 重新审计且 `0 blocked`；
5. 剩余 advisory 均有可解释降级原因；
6. Shared Store 保持只读；
7. Learning 反馈、Revision、微训练、Retest / Transfer 与生产构建零回归；
8. 输出工程 Debug 报告，记录治理前后 Finding 差异和未解决边界。

## 十一、后续治理入口

工程完成后，剩余问题按两类处理：

- Adapter 可以识别但规则未覆盖：补充统一规则与回归样例；
- 题干 / required Rubric 本身无法形成一致目标：创建 successor Candidate，由人执行采用或不采用。

不得回到“学生遇到一题、人工修改一题”的治理方式。

## 十二、工程执行结果

工程已完成，详细证据见：

- `docs/education/phase/reports/feedback_observation_target_projection_convergence_engineering_debug_acceptance_2026-08-25.md`

治理结果：

- `feedback_target_ambiguous`：`39 → 0`；
- Current Head：`81 / 81 pass`；
- `advisory = 0`、`blocked = 0`；
- Store Revision 保持 `1962`，正式资源零写入；
- FT-01—FT-16、Learning Feedback、Revision、Targeted Micro-training、Single Choice、Task Queue 与 Retest 全部通过。
- 真实应用内浏览器 `B3-01—B3-18` 为 `18 / 18 PASS`，控制台 `warning = 0`、`error = 0`；验收使用隔离投射，正式资源、Attempt、Evidence、Profile 与真实校准分母写入均为 `0`。
