# 知识练习第一阶段 WP1 数据契约与迁移工程实施文档

状态：`ENGINEERING PLAN READY / IMPLEMENTATION PENDING`

版本：`knowledge_practice_phase1_wp1_data_contract_migration_v1.0`

日期：`2026-08-28`

上位方案：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)

执行清单：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

## 一、文档目的

本文是第一阶段 WP1 的唯一工程实施说明，负责把现有静态知识题升级为可校验、可版本化、可审核、可生成选项级反馈的轻量题目数据源。

WP1 只建立知识练习辅助入口的数据基础，不改造完整练习会话、持久化、即时巩固和结果页；这些能力分别属于 WP2—WP6。

WP1 完成后必须达到：

```text
旧 questions.json
→ 明确盘点与逐题处置
→ 确定性迁移
→ 新 Question v1 数据契约
→ 自动结构校验
→ 人工内容审核状态
→ KnowledgeQuestionRepository
→ 学生页面只消费 approved 七年级上册题
```

## 二、WP1 范围与非目标

### 2.1 本工作包范围

1. 完整盘点现有 27 道题；
2. 固定 Question v1 数据契约；
3. 固定三类题型的选项、答案和规范化规则；
4. 建立旧字段到新字段的迁移映射；
5. 为错误选项建立解释和预设错因结构；
6. 固定 `variantGroupId` 的建立条件；
7. 固定 `draft / approved / retired` 状态机；
8. 建立结构校验错误码和警告码；
9. 建立轻量 KnowledgeQuestionRepository 接口；
10. 定义迁移脚本、数据检查命令和自动化测试；
11. 输出首批七上题目缺口和 100 道内容建设起点。

### 2.2 本工作包非目标

WP1 不做：

- 不实现专项 5 题或综合 10 题选题；
- 不实现 seed 洗牌、近期降权或会话状态；
- 不实现作答持久化；
- 不实现动态插入巩固题；
- 不重做结果页；
- 不接入大模型判题；
- 不把轻量知识题写入正式 `/learning` Frozen Resource；
- 不复用正式 Diagnosis、Evidence 或 Profile 状态；
- 不因迁移成功自动把旧题标记为 `approved`；
- 不在 WP1 内完成全部 100 道新题生产。

## 三、现有数据基线

### 3.1 当前文件与消费方

当前轻量知识题位于：

`src/data/questions.json`

直接消费方至少包括：

- `src/pages/KnowledgePractice.jsx`；
- `src/pages/Quiz.jsx`；
- `src/context/StudyContext.jsx`。

当前页面直接导入 JSON，缺少统一读取、过滤、版本兼容和审核状态边界。

### 3.2 当前字段

```text
id
category
subCategory
type
question
options
answer
explanation
knowledgePoint
examPoint
sourceText
grade
term
difficulty
```

主要不足：

- `type`、`difficulty` 使用中文自由文本；
- `question` 与目标结构中的 `stem` 不一致；
- 选项是带 `A.` 前缀的字符串，没有稳定选项身份；
- `answer` 同时承担选项字母和填空文本两种语义；
- 没有明确等价答案；
- 没有选项级解析；
- 没有结构化预设错因；
- 没有可执行解题步骤；
- 没有变式组；
- 没有内容审核状态；
- 没有内容版本；
- 没有独立 Schema 版本；
- 没有学生可用范围过滤。

### 3.3 年级与学期分布

| 范围 | 数量 | WP1 首批处置 |
| --- | ---: | --- |
| 七年级上册 | 12 | 迁移为 v1 候选，逐题修订审核 |
| 七年级下册 | 6 | 迁移或归档为非首批 `draft`，不进入学生列表 |
| 八年级上册 | 4 | 迁移或归档为非首批 `draft`，不进入学生列表 |
| 八年级下册 | 3 | 迁移或归档为非首批 `draft`，不进入学生列表 |
| 九年级上册 | 2 | 迁移或归档为非首批 `draft`，不进入学生列表 |
| 合计 | 27 | 不删除原始内容，不批量批准 |

### 3.4 分类分布

| 分类 | 当前总量 | 七上候选 | 第一阶段目标 | 七上缺口起点 |
| --- | ---: | ---: | ---: | ---: |
| 字音字形 | 3 | 3 | 16 | 13 |
| 成语运用 | 3 | 1 | 14 | 13 |
| 病句修改 | 3 | 0 | 14 | 14 |
| 标点符号 | 3 | 1 | 10 | 9 |
| 文学常识 | 3 | 2 | 10 | 8 |
| 古诗文默写 | 3 | 2 | 14 | 12 |
| 文言实词虚词 | 3 | 3 | 14 | 11 |
| 古文作者背景 | 6 | 0 | 8 | 8 |
| 合计 | 27 | 12 | 100 | 88 |

说明：七上候选不等于审核通过。完成逐题修订后，实际 `approved` 起点可能低于 12，道数缺口应按最终批准数量重新计算。

## 四、逐题迁移处置表

### 4.1 七年级上册候选题

| ID | 分类 | 迁移结论 | 进入 approved 前必须处理 |
| --- | --- | --- | --- |
| `q-zy-1` | 字音字形 | 保留 ID，迁移为 `draft` | 拼音补充规范声调；题干所称“加点字”需与实际展示一致；逐项补充选项解析；确认所有词语属于首批范围 |
| `q-zy-2` | 字音字形 | 保留 ID，迁移为 `draft` | 为 A—D 建立独立解析；确认正确项解释不为空；核对“取决”等选项设计是否具有有效区分度 |
| `q-zy-3` | 字音字形 | 保留 ID，迁移为 `draft` | `zhuo` 改为规范标音 `zhuó`；判断题使用稳定 optionId；补充错误选项解释 |
| `q-cy-1` | 成语运用 | 保留 ID，迁移为 `draft` | A—D 分别标注词义、对象或感情色彩问题；通用解析拆成选项级解析；建立可执行解题步骤 |
| `q-bd-1` | 标点符号 | 保留 ID，迁移为 `draft` | 判断题使用稳定 optionId；分别解释正确与错误选择；核对嵌套标点展示 |
| `q-wx-2` | 文学文化常识 | 保留 ID，迁移为 `draft` | 补充各错误文体选项解释；知识点分类统一为“文学文化常识”；确认教材范围 |
| `q-wx-3` | 文学文化常识 | 保留 ID，迁移为 `draft` | 判断题使用稳定 optionId；补充错误选择解释；避免只用“是 / 否”重复题干 |
| `q-gs-1` | 古诗文默写与理解 | 保留 ID，迁移为 `draft` | 使用 `acceptedAnswers`；明确是否忽略句末标点；保持文字严格匹配；补充错字反馈边界 |
| `q-gs-2` | 古诗文默写与理解 | 保留 ID，迁移为 `draft` | 使用 `acceptedAnswers`；核对“随君 / 随风”教材版本边界；明确标点规范化 |
| `q-wy-1` | 文言实词虚词 | 保留 ID，迁移为 `draft` | 当前正确选项“表并列或承接”语义过宽，应改为唯一明确的“表承接”；重新核对其余选项和解析 |
| `q-wy-2` | 文言实词虚词 | 保留 ID，迁移为 `draft` | 逐项解释“因为 / 趁乘 / 于是 / 依靠”在当前句中为何成立或不成立；统一词义措辞 |
| `q-wy-3` | 文言实词虚词 | 保留 ID，迁移为 `draft` | 判断题使用稳定 optionId；补充错误选择解释；核对“朋”的教材注释表达，不扩大为唯一解释 |

原则：上述 12 道题只有在结构校验和人工内容审核均通过后才能改为 `approved`。

### 4.2 非首批题

| ID | 当前范围 | 处置 |
| --- | --- | --- |
| `q-cy-2` | 八上 | 保留内容，标记非首批 `draft` |
| `q-cy-3` | 八上 | 保留内容，标记非首批 `draft` |
| `q-bj-1` | 八上 | 保留内容，标记非首批 `draft` |
| `q-bj-2` | 八下 | 保留内容，标记非首批 `draft` |
| `q-bj-3` | 八下 | 保留内容，标记非首批 `draft` |
| `q-bd-2` | 七下 | 保留内容，标记非首批 `draft` |
| `q-bd-3` | 七下 | 保留内容，标记非首批 `draft` |
| `q-wx-1` | 八上 | 保留内容，标记非首批 `draft` |
| `q-gs-3` | 七下 | 保留内容，标记非首批 `draft` |
| `q-gwzz-1` | 八下 | 保留内容，标记非首批 `draft` |
| `q-gwzz-2` | 七下 | 保留内容，标记非首批 `draft` |
| `q-gwzz-3` | 七下 | 保留内容，标记非首批 `draft` |
| `q-gwzz-4` | 八下 | 保留内容，标记非首批 `draft` |
| `q-gwzz-5` | 九上 | 保留内容，标记非首批 `draft` |
| `q-gwzz-6` | 九上 | 保留内容，标记非首批 `draft` |

非首批题不得通过删除 `grade` 或修改为七年级上册的方式进入首批集合。后续对应年级内容阶段可以重新审核和批准。

## 五、Question v1 数据契约

### 5.1 根数据集

```ts
export type KnowledgeQuestionDataset = {
  schemaVersion: 1;
  datasetId: 'knowledge-practice-grade7-semester1';
  grade: '七年级';
  semester: '上';
  updatedAt: string;
  questions: KnowledgeQuestion[];
};
```

`updatedAt` 是内容集更新时间，不参与单题身份或答案判定。

### 5.2 基础枚举

```ts
export type KnowledgeQuestionType =
  | 'single_choice'
  | 'true_false'
  | 'fill_blank';

export type KnowledgeQuestionDifficulty = 1 | 2 | 3;

export type KnowledgeQuestionContentStatus =
  | 'draft'
  | 'approved'
  | 'retired';

export type KnowledgeQuestionCategory =
  | '字音字形'
  | '成语运用'
  | '病句辨析与修改'
  | '标点符号'
  | '文学文化常识'
  | '古诗文默写与理解'
  | '文言实词虚词'
  | '作家作品与课文背景';
```

分类枚举是第一阶段内容配额和入口统计的唯一口径。旧分类在迁移层映射，不由页面兼容多个名称。

### 5.3 选项与错因

```ts
export type KnowledgeQuestionOption = {
  id: string;
  text: string;
};

export type KnowledgeQuestionMisconception = {
  code: string;
  studentMessage: string;
};
```

规则：

- `option.id` 在单题内唯一；
- ID 是稳定身份，不是展示序号；
- 首批可以使用 `opt-a / opt-b / opt-c / opt-d`，发布后不随展示顺序变化；
- 页面可以按会话决定展示 A、B、C、D，但提交值必须是稳定 optionId；
- `studentMessage` 描述该选项通常反映的当前知识性偏差，不断言学生长期根因；
- `code` 采用小写 kebab-case，例如 `idiom-emotional-color-missed`。

### 5.4 完整题目类型

```ts
export type KnowledgeQuestion = {
  id: string;
  contentVersion: number;
  contentStatus: KnowledgeQuestionContentStatus;

  grade: '七年级';
  semester: '上';
  category: KnowledgeQuestionCategory;
  subCategory: string;
  knowledgePoint: string;
  examPoint: string;
  difficulty: KnowledgeQuestionDifficulty;

  type: KnowledgeQuestionType;
  stem: string;
  options?: KnowledgeQuestionOption[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  answerNormalization?: AnswerNormalizationRule[];

  explanation: string;
  answerAnalysis?: Record<string, string>;
  misconceptionByAnswer?: Record<string, KnowledgeQuestionMisconception>;
  solutionSteps: string[];

  sourceText: string;
  variantGroupId?: string;
  reviewedAt?: string;
  reviewNote?: string;
};
```

### 5.5 答案规范化规则

```ts
export type AnswerNormalizationRule =
  | 'trim'
  | 'collapse_whitespace'
  | 'normalize_fullwidth_space'
  | 'ignore_terminal_punctuation';
```

第一阶段禁止：

- `semantic_equivalent`；
- `fuzzy_match`；
- 编辑距离猜测；
- 大模型判定；
- 自动忽略错别字；
- 自动忽略诗句中的关键标点之外的文字差异。

## 六、题型结构契约

### 6.1 单选题

```json
{
  "id": "q-cy-1",
  "contentVersion": 1,
  "contentStatus": "approved",
  "grade": "七年级",
  "semester": "上",
  "category": "成语运用",
  "subCategory": "语境辨析",
  "knowledgePoint": "成语语境辨析",
  "examPoint": "结合语境判断词义、对象和感情色彩",
  "difficulty": 1,
  "type": "single_choice",
  "stem": "下列句子中成语使用恰当的一项是：",
  "options": [
    { "id": "opt-a", "text": "他做题时总是不求甚解，所以成绩稳步提高。" },
    { "id": "opt-b", "text": "这场辩论双方观点鲜明，真是骇人听闻。" },
    { "id": "opt-c", "text": "老师讲解后，同学们恍然大悟。" },
    { "id": "opt-d", "text": "这篇作文语言平淡，却美轮美奂。" }
  ],
  "correctAnswer": "opt-c",
  "explanation": "判断成语是否恰当，需要同时检查词义、使用对象和语境色彩。",
  "answerAnalysis": {
    "opt-a": "“不求甚解”指学习不深入，与成绩稳步提高的因果语境冲突。",
    "opt-b": "“骇人听闻”形容使人听了非常吃惊或害怕的严重事件，不适合形容观点鲜明。",
    "opt-c": "“恍然大悟”表示忽然明白，符合老师讲解后明白的语境。",
    "opt-d": "“美轮美奂”常用于形容建筑等高大华美，不能形容语言平淡的作文。"
  },
  "misconceptionByAnswer": {
    "opt-a": {
      "code": "idiom-context-logic-missed",
      "studentMessage": "这个选项通常是只看到了成语的大致意思，没有核对前后逻辑。"
    },
    "opt-b": {
      "code": "idiom-context-severity-missed",
      "studentMessage": "这个选项需要检查成语所适用的事件性质和严重程度。"
    },
    "opt-d": {
      "code": "idiom-object-mismatch",
      "studentMessage": "这个选项需要检查成语通常修饰的对象。"
    }
  },
  "solutionSteps": [
    "先确认成语的准确含义",
    "再检查成语通常修饰的对象",
    "最后核对句子前后语境"
  ],
  "sourceText": "七年级上册基础积累",
  "variantGroupId": "g7s1-idiom-context-01",
  "reviewedAt": "2026-08-28T00:00:00.000Z"
}
```

单选题强制规则：

- 3—5 个选项；
- 唯一正确答案；
- 正确答案必须引用有效 optionId；
- `answerAnalysis` 覆盖全部选项；
- `misconceptionByAnswer` 不得包含正确选项；
- 错误选项应尽量各自对应一个可解释偏差；
- 选项不得包含展示字母前缀。

### 6.2 判断题

```json
{
  "type": "true_false",
  "options": [
    { "id": "true", "text": "正确" },
    { "id": "false", "text": "错误" }
  ],
  "correctAnswer": "true",
  "answerAnalysis": {
    "true": "……",
    "false": "……"
  }
}
```

判断题强制规则：

- 选项固定为 `true / false`；
- `correctAnswer` 只能是 `true` 或 `false`；
- 两个选择都必须有解释；
- 题干必须是可明确判真的陈述句；
- 不能通过绝对化用词制造无意义陷阱。

### 6.3 填空题

```json
{
  "type": "fill_blank",
  "stem": "请补全诗句：海日生残夜，____。",
  "correctAnswer": "江春入旧年",
  "acceptedAnswers": ["江春入旧年"],
  "answerNormalization": [
    "trim",
    "collapse_whitespace",
    "normalize_fullwidth_space",
    "ignore_terminal_punctuation"
  ],
  "explanation": "出自王湾《次北固山下》。",
  "solutionSteps": ["先确定篇目和上下句", "再逐字检查关键字", "最后检查是否多字或漏字"]
}
```

填空题强制规则：

- 不包含 `options`；
- `correctAnswer` 非空；
- `acceptedAnswers` 至少包含规范正确答案；
- 规范化后 `acceptedAnswers` 不得重复；
- 只接纳内容审核明确列出的等价答案；
- 诗文默写中的错字、漏字、多字仍判错；
- 首批不做多空分别评分，一个 Question 只对应一个整体答案。

## 七、旧字段迁移映射

| 旧字段 | 新字段 | 迁移规则 |
| --- | --- | --- |
| 无 | `contentVersion` | 迁移首版设为 `1` |
| 无 | `contentStatus` | 全部先设为 `draft`，人工审核后单独批准 |
| `grade` | `grade` | 仅精确 `七年级` 可进入首批候选 |
| `term` | `semester` | `上` 原样映射；非 `上` 不进入首批 |
| `category` | `category` | 通过固定映射表转为首批分类枚举 |
| `subCategory` | `subCategory` | trim 后保留，空值阻断 approved |
| `knowledgePoint` | `knowledgePoint` | trim 后保留，人工核对 |
| `examPoint` | `examPoint` | trim 后保留，人工核对 |
| `difficulty` | `difficulty` | `基础 → 1`，`中等 → 2`，`较难 → 3`；其他值报错 |
| `type` | `type` | `单选题 → single_choice`，`判断题 → true_false`，`填空题 → fill_blank` |
| `question` | `stem` | trim 后保留，人工检查题干与页面展示一致 |
| `options` | `options` | 解析展示字母，生成稳定 optionId，正文移除 `A.` 等前缀 |
| `answer` | `correctAnswer` | 选择题从字母映射 optionId；填空题保留规范文本 |
| `answer` | `acceptedAnswers` | 填空题迁移为单元素数组，后续人工补充明确等价答案 |
| 无 | `answerNormalization` | 填空题使用固定允许规则，选择题为空 |
| `explanation` | `explanation` | 保留为通用解析，不能代替选项级解释 |
| 无 | `answerAnalysis` | 迁移不自动生成；由内容修订补充 |
| 无 | `misconceptionByAnswer` | 迁移不自动推断；由内容修订补充 |
| 无 | `solutionSteps` | 迁移不自动拼接；由内容修订补充 1—3 步 |
| `sourceText` | `sourceText` | trim 后保留，人工核对来源范围 |
| 无 | `variantGroupId` | 默认缺省，只有人工确认真实变式关系后添加 |
| 无 | `reviewedAt` | 批准时写入审核时间 |
| 无 | `reviewNote` | 可记录必要的内容审核说明 |

禁止迁移器根据通用 `explanation` 自动猜测 `answerAnalysis`、`misconceptionByAnswer` 或 `variantGroupId`。

## 八、稳定身份规则

### 8.1 Question ID

- 现有 27 道题保留原 ID；
- 新题 ID 建议使用 `kp-g7s1-{categoryCode}-{sequence}`；
- ID 只允许小写字母、数字和连字符；
- ID 发布后永不复用；
- 内容修订增加 `contentVersion`，不创建随意的新 ID；
- 训练目标实质改变、正确答案身份改变或题目不再是同一观察对象时，应创建新题 ID 并停用旧题。

### 8.2 Option ID

- 现有选择题迁移使用 `opt-a / opt-b / opt-c / opt-d`；
- 判断题固定使用 `true / false`；
- optionId 不等于页面展示序号；
- 只调整展示顺序不修改 optionId；
- 选项内容发生实质变化时增加题目 `contentVersion`；
- 删除或替换正确选项必须重新审核。

### 8.3 Content Version

- 正整数，从 1 开始；
- 任何影响题干、选项、答案、解析、错因、难度或范围的变化均加 1；
- 仅修正非语义性空白或排版可以不升级，但必须确保内容哈希策略一致；
- 已开始会话后续应保存题目内容版本；WP1 只提供版本字段，内容快照属于 WP2 / WP4 实现边界。

## 九、内容状态机

```text
draft
→ approved
→ retired

draft
→ retired
```

### 9.1 draft

- 可以结构不完整；
- 不进入学生 Repository 默认列表；
- 可以被迁移、修订和校验；
- 结构错误必须在内容缺口报告中可见。

### 9.2 approved

同时满足：

1. 结构校验无 error；
2. 属于七年级上册首批范围；
3. 题干、答案、选项和解析经过人工核对；
4. 选择题选项级解析完整；
5. 解题步骤完整；
6. `reviewedAt` 存在；
7. 没有未关闭的阻断级内容问题。

### 9.3 retired

- 不进入新会话；
- 保留历史身份和内容版本；
- 不删除已存在的作答关系；
- 如需恢复使用，不能直接改回 approved；应创建新内容版本并重新审核。

## 十、分类与范围映射

### 10.1 分类映射

| 旧分类 | 新分类 |
| --- | --- |
| 字音字形 | 字音字形 |
| 成语运用 | 成语运用 |
| 病句修改 | 病句辨析与修改 |
| 标点符号 | 标点符号 |
| 文学常识 | 文学文化常识 |
| 古诗文默写 | 古诗文默写与理解 |
| 文言实词虚词 | 文言实词虚词 |
| 古文作者背景 | 作家作品与课文背景 |

### 10.2 首批范围过滤

```ts
question.grade === '七年级' &&
question.semester === '上' &&
question.contentStatus === 'approved'
```

Repository 必须执行范围过滤，页面不得依赖“数据文件里恰好只有七上题”这一隐含条件。

## 十一、答案规范化

### 11.1 执行顺序

规范化严格按声明顺序执行：

```text
原始输入
→ normalize_fullwidth_space
→ trim
→ collapse_whitespace
→ ignore_terminal_punctuation
→ 与规范化 acceptedAnswers 精确比较
```

实现时应固定标准顺序，不因 JSON 中数组顺序产生不同结果；数据中的规则数组只声明启用集合。

### 11.2 允许转换

| 规则 | 转换 |
| --- | --- |
| `normalize_fullwidth_space` | 全角空格转普通空格 |
| `trim` | 移除首尾空白 |
| `collapse_whitespace` | 连续空白压缩为单个空格 |
| `ignore_terminal_punctuation` | 忽略末尾单个 `。！？；，,.!?;` |

### 11.3 明确禁止

- 不做简繁自动转换；
- 不做同音字容错；
- 不忽略诗句中间标点或文字；
- 不删除全部空格后比较；
- 不自动接受近义表达；
- 不对大小写或数字形式做未声明转换；
- 不把空答案规范化成有效答案。

## 十二、选项级解析与错因标注

### 12.1 answerAnalysis

每个选项的解释必须回答：

- 当前选项在本题中为什么成立或不成立；
- 依据是词义、语法、语境、教材事实还是篇目原文；
- 不只重复“此项错误”或正确答案。

### 12.2 misconceptionByAnswer

错因只对错误选项建立。每条包含：

- 稳定 code；
- 面向学生的中性提示；
- 与该错误选项直接相关；
- 不包含“粗心”“不用功”“能力差”等人格化判断；
- 不把一次选择解释为长期根因。

推荐 code 族：

```text
pronunciation-tone-missed
character-shape-confused
idiom-meaning-missed
idiom-object-mismatch
idiom-emotional-color-missed
sentence-component-missed
sentence-collocation-missed
sentence-order-missed
punctuation-context-missed
literature-fact-confused
poetry-line-recall-error
classical-word-meaning-confused
```

WP1 不要求一次冻结全部 code，但同一语义不得创建多个近义 code。

### 12.3 solutionSteps

- 1—3 步；
- 每步为可执行动作；
- 不重复“认真审题”；
- 能迁移到同知识点的下一题；
- 不泄露特定变式题答案。

## 十三、variantGroupId 契约

### 13.1 可以建立变式组

只有同时满足以下条件：

1. 同一 `knowledgePoint`；
2. 训练动作一致；
3. 难度相同或相邻；
4. 题面和答案能够独立作答；
5. 不是仅替换人名、数字或词序；
6. 一题错误后练另一题具有真实巩固价值；
7. 经过人工内容核对。

### 13.2 不得建立变式组

- 只因分类相同；
- 一个考词义、另一个考感情色彩；
- 一个依赖课内篇目事实、另一个是通用语言知识；
- 题干不同但答案线索完全相同；
- 两题共享大段文字导致答案可记忆复制；
- 只是为了让动态巩固功能有题可插。

### 13.3 命名

```text
g7s1-{category-code}-{knowledge-code}-{sequence}
```

例如：

```text
g7s1-idiom-context-01
g7s1-punctuation-direct-quote-01
```

`variantGroupId` 不承担版本身份；组内成员变化需要重新运行组级校验和人工核对。

## 十四、校验器契约

### 14.1 返回结构

```ts
export type KnowledgeQuestionValidationIssue = {
  severity: 'error' | 'warning';
  code: KnowledgeQuestionValidationCode;
  questionId?: string;
  path: string;
  message: string;
};

export type KnowledgeQuestionValidationResult = {
  passed: boolean;
  issues: KnowledgeQuestionValidationIssue[];
};
```

`passed` 仅在没有 `error` 时为 true。warning 不阻断结构校验，但 approved 发布门禁可以将指定 warning 升级为阻断。

### 14.2 数据集级错误码

| Code | 条件 |
| --- | --- |
| `dataset.schema_version_invalid` | schemaVersion 不是 1 |
| `dataset.identity_invalid` | datasetId、grade 或 semester 与首批契约不一致 |
| `dataset.questions_invalid` | questions 不是数组 |
| `dataset.question_id_duplicate` | 数据集内 Question ID 重复 |
| `dataset.empty_approved_set` | 学生可用集合为空 |

### 14.3 题目通用错误码

| Code | 条件 |
| --- | --- |
| `question.id_invalid` | ID 为空或格式非法 |
| `question.version_invalid` | contentVersion 不是正整数 |
| `question.status_invalid` | contentStatus 非法 |
| `question.scope_invalid` | grade / semester 非法 |
| `question.category_invalid` | category 不在枚举中 |
| `question.subcategory_required` | subCategory 为空 |
| `question.knowledge_point_required` | knowledgePoint 为空 |
| `question.exam_point_required` | examPoint 为空 |
| `question.difficulty_invalid` | difficulty 不是 1 / 2 / 3 |
| `question.type_invalid` | type 非法 |
| `question.stem_required` | stem 为空 |
| `question.explanation_required` | explanation 为空 |
| `question.solution_steps_invalid` | approved 题没有 1—3 个有效步骤 |
| `question.source_required` | approved 题 sourceText 为空 |
| `question.review_required` | approved 题 reviewedAt 缺失或非法 |

### 14.4 选择题错误码

| Code | 条件 |
| --- | --- |
| `choice.options_required` | options 缺失 |
| `choice.option_count_invalid` | 单选不是 3—5 项，判断不是 2 项 |
| `choice.option_id_invalid` | optionId 为空或格式非法 |
| `choice.option_id_duplicate` | 题内 optionId 重复 |
| `choice.option_text_required` | 选项正文为空 |
| `choice.display_prefix_forbidden` | 正文仍包含 `A.`、`B.` 等展示前缀 |
| `choice.correct_answer_invalid` | correctAnswer 不引用有效 optionId |
| `choice.answer_analysis_incomplete` | approved 题 answerAnalysis 未覆盖全部选项 |
| `choice.correct_misconception_forbidden` | 正确选项被标注 misconception |
| `choice.unknown_analysis_key` | answerAnalysis 包含不存在的 optionId |
| `choice.unknown_misconception_key` | misconceptionByAnswer 包含不存在的 optionId |
| `choice.true_false_identity_invalid` | 判断题不是固定 true / false |

### 14.5 填空题错误码

| Code | 条件 |
| --- | --- |
| `fill.options_forbidden` | 填空题包含 options |
| `fill.correct_answer_required` | correctAnswer 为空 |
| `fill.accepted_answers_required` | acceptedAnswers 为空 |
| `fill.correct_answer_not_accepted` | 规范正确答案不在 acceptedAnswers 中 |
| `fill.accepted_answer_duplicate` | 规范化后答案重复 |
| `fill.normalization_rule_invalid` | 存在未允许规则 |
| `fill.semantic_matching_forbidden` | 声明模糊或语义匹配 |

### 14.6 变式组错误与警告

| Code | 级别 | 条件 |
| --- | --- | --- |
| `variant.singleton_group` | warning | 组内只有一道题 |
| `variant.knowledge_point_mismatch` | error | 组内知识点不一致 |
| `variant.scope_mismatch` | error | 组内年级学期不一致 |
| `variant.status_mixed` | warning | 组内 approved / draft 混合 |
| `variant.duplicate_content` | error | 题干或规范化内容高度重复达到确定性阈值 |

首版重复检测只使用确定性规范化文本相等或明确哈希，不在 WP1 引入语义向量相似度。

## 十五、Repository 设计

### 15.1 接口

```ts
export type KnowledgeQuestionQuery = {
  grade?: '七年级';
  semester?: '上';
  category?: KnowledgeQuestionCategory;
  type?: KnowledgeQuestionType;
  status?: KnowledgeQuestionContentStatus;
  ids?: string[];
};

export interface KnowledgeQuestionRepository {
  listApproved(query?: Omit<KnowledgeQuestionQuery, 'status'>): KnowledgeQuestion[];
  listForContentReview(query?: KnowledgeQuestionQuery): KnowledgeQuestion[];
  getApprovedById(id: string): KnowledgeQuestion | undefined;
  getByIdForContentReview(id: string): KnowledgeQuestion | undefined;
}
```

### 15.2 学生侧边界

- 学生页面只注入只读 `listApproved / getApprovedById` 能力；
- 默认范围固定七年级上册；
- 返回副本或冻结对象，调用方不得修改源数据；
- Repository 不负责随机、抽题、判题或练习历史；
- 不提供页面可调用的 approve / retire 写操作。

### 15.3 内容侧边界

WP1 允许测试或脚本通过 `listForContentReview` 查看 draft，但该接口不得从学生页面导入。

### 15.4 建议文件

```text
src/domain/knowledge-practice/questions/
├── knowledgeQuestionTypes.ts
├── knowledgeQuestionNormalization.ts
├── knowledgeQuestionValidator.ts
├── legacyKnowledgeQuestionMigration.ts
└── knowledgeQuestionRepository.ts

src/data/
├── questions.json                         # 旧数据，WP1 迁移期间只读保留
└── knowledgeQuestions.grade7s1.v1.json   # 新数据集

src/ai/tests/
└── runKnowledgePracticeWP1Debug.ts

scripts/
└── validate-knowledge-questions.mjs       # 可选薄包装；核心校验仍在 TS 领域模块
```

如果现有构建环境对 JSON 类型导入造成不稳定，可使用 TS 数据模块，但不得因此丢失 Schema、校验和内容审核边界。

## 十六、迁移实施步骤

### M0：只读冻结基线

1. 记录现有 `questions.json` 的题数、ID、字段和内容哈希；
2. 确认工作区现有未提交修改，不覆盖用户改动；
3. 不移动、不删除、不原地重写旧文件；
4. 建立迁移基线测试，确认 27 道、ID 唯一和当前分布。

### M1：建立类型、规范化与校验器

1. 创建 v1 类型；
2. 创建纯函数答案规范化；
3. 创建单题与数据集校验；
4. 创建错误码；
5. 完成错误 Fixture 测试。

### M2：建立确定性迁移器

1. 映射题型、难度和分类；
2. 拆分选项前缀；
3. 映射正确选项 ID；
4. 填空答案迁移到 acceptedAnswers；
5. 全部迁移题默认 `draft`；
6. 输出迁移报告，不自动生成内容判断字段。

### M3：人工修订七上 12 道候选

1. 按逐题处置表修订；
2. 补齐 answerAnalysis；
3. 补齐 misconceptionByAnswer；
4. 补齐 solutionSteps；
5. 规范拼音、篇目、标点和教材表达；
6. 人工确认后逐题 approved；
7. 非七上题保持 draft。

### M4：建立 Repository 并切换消费方

1. Repository 加载新数据集；
2. 只暴露 approved 七上题；
3. `KnowledgePractice.jsx` 改为 Repository 统计；
4. `Quiz.jsx` 改为读取新题结构，但暂不实现 WP2 抽题；
5. `StudyContext.jsx` 的错题初始化兼容新题结构；
6. 删除页面对旧 JSON 的直接导入；
7. 旧文件继续保留到 WP1 Engineering PASS。

### M5：校验命令与收口

1. 增加 `debug:knowledge-practice-wp1`；
2. 增加 `validate:knowledge-questions`；
3. 执行 WP1 全量测试；
4. 执行应用构建；
5. 浏览器检查现有知识练习不白屏、能加载 approved 题；
6. 输出迁移结果与内容缺口报告；
7. 更新执行清单证据和状态。

## 十七、迁移报告契约

迁移命令必须输出机器可读或稳定文本报告，至少包括：

```ts
type KnowledgeQuestionMigrationReport = {
  sourceCount: number;
  migratedCount: number;
  failedCount: number;
  grade7Semester1CandidateCount: number;
  outOfScopeCount: number;
  approvedCount: number;
  draftCount: number;
  retiredCount: number;
  categorySummaries: Array<{
    category: KnowledgeQuestionCategory;
    candidateCount: number;
    approvedCount: number;
    targetCount: number;
    gapCount: number;
  }>;
  issues: KnowledgeQuestionValidationIssue[];
};
```

验收基线：

- `sourceCount = 27`；
- `migratedCount + failedCount = 27`；
- `grade7Semester1CandidateCount = 12`；
- `outOfScopeCount = 15`；
- 不允许静默丢题；
- approvedCount 以人工审核结果为准，不预设必须等于 12。

## 十八、回退与兼容策略

### 18.1 原则

- WP1 迁移不破坏旧文件；
- 切换消费方是单一、可定位的导入边界变化；
- 不通过 `git reset`、删除用户文件或覆盖未提交改动回退；
- 出现阻断时优先修复新 Repository 或恢复旧只读导入，不并行维护两套写入路径。

### 18.2 临时兼容期限

旧 `questions.json` 只在 WP1 迁移和对照期间保留。WP1 Engineering PASS 后：

- 页面不得继续直接消费；
- 是否删除或移入归档由后续独立清理任务决定；
- 不在本工作包自动删除，以保留审计和安全回退能力。

### 18.3 失败场景

| 失败 | 处理 |
| --- | --- |
| 迁移器无法解析选项前缀 | 该题迁移失败并报告 ID，不猜测答案 |
| 旧答案不对应选项 | 阻断该题，保持 draft |
| 七上候选内容有争议 | 保持 draft，不计入可用题数 |
| approved 集合为空 | Repository 初始化失败或学生入口显示受控空状态，不回退展示未审核题 |
| 构建不支持 JSON 类型 | 切换为 TS 数据模块，保留同一契约和校验 |

## 十九、自动化测试矩阵

### 19.1 类型与迁移

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP1-T01 | `单选题` | 映射为 `single_choice` |
| WP1-T02 | `判断题` | 映射为 `true_false` |
| WP1-T03 | `填空题` | 映射为 `fill_blank` |
| WP1-T04 | 未知题型 | 迁移失败并返回稳定错误 |
| WP1-T05 | `基础 / 中等 / 较难` | 映射为 `1 / 2 / 3` |
| WP1-T06 | 未知难度 | 迁移失败 |
| WP1-T07 | `A. 文本` | 生成 `opt-a + 文本` |
| WP1-T08 | 答案 `C` | 映射到 `opt-c` |
| WP1-T09 | 填空答案 | 写入 correctAnswer 和 acceptedAnswers |
| WP1-T10 | 所有旧题 | 默认迁移为 draft |

### 19.2 数据集和通用校验

| 编号 | 场景 | 预期 Code |
| --- | --- | --- |
| WP1-V01 | schemaVersion 非 1 | `dataset.schema_version_invalid` |
| WP1-V02 | Question ID 重复 | `dataset.question_id_duplicate` |
| WP1-V03 | 非法 ID | `question.id_invalid` |
| WP1-V04 | contentVersion 为 0 | `question.version_invalid` |
| WP1-V05 | 非法 contentStatus | `question.status_invalid` |
| WP1-V06 | 空知识点 | `question.knowledge_point_required` |
| WP1-V07 | 难度为 4 | `question.difficulty_invalid` |
| WP1-V08 | approved 缺 reviewedAt | `question.review_required` |
| WP1-V09 | approved 缺 solutionSteps | `question.solution_steps_invalid` |

### 19.3 选择题校验

| 编号 | 场景 | 预期 Code |
| --- | --- | --- |
| WP1-C01 | 单选没有 options | `choice.options_required` |
| WP1-C02 | 单选只有 2 项 | `choice.option_count_invalid` |
| WP1-C03 | optionId 重复 | `choice.option_id_duplicate` |
| WP1-C04 | 正确答案不存在 | `choice.correct_answer_invalid` |
| WP1-C05 | 正文仍以 `A.` 开头 | `choice.display_prefix_forbidden` |
| WP1-C06 | approved 选项解析不全 | `choice.answer_analysis_incomplete` |
| WP1-C07 | 正确项有 misconception | `choice.correct_misconception_forbidden` |
| WP1-C08 | 判断项不是 true / false | `choice.true_false_identity_invalid` |

### 19.4 填空与规范化

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP1-F01 | 填空包含 options | `fill.options_forbidden` |
| WP1-F02 | acceptedAnswers 为空 | `fill.accepted_answers_required` |
| WP1-F03 | 规范答案不在接受集合 | `fill.correct_answer_not_accepted` |
| WP1-F04 | 规范化后重复 | `fill.accepted_answer_duplicate` |
| WP1-F05 | 启用 fuzzy_match | `fill.normalization_rule_invalid` |
| WP1-F06 | 首尾空格 | trim 后精确相等 |
| WP1-F07 | 句末句号差异 | 声明规则后相等 |
| WP1-F08 | 诗句中间错字 | 仍不相等 |

### 19.5 Repository

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP1-R01 | listApproved 默认查询 | 只返回七上 approved |
| WP1-R02 | 数据包含 draft | 学生列表排除 |
| WP1-R03 | 数据包含 retired | 学生列表排除 |
| WP1-R04 | getApprovedById 查询 draft | 返回 undefined |
| WP1-R05 | 内容审核接口查询 draft | 可以返回 |
| WP1-R06 | 调用方修改返回对象 | 不修改 Repository 源数据 |
| WP1-R07 | 分类筛选 | 只返回指定分类 approved 题 |

### 19.6 基线验收

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP1-B01 | 读取旧题 | 27 道 |
| WP1-B02 | 检查旧 ID | 27 个唯一 ID |
| WP1-B03 | 七上候选计数 | 12 道 |
| WP1-B04 | 非首批计数 | 15 道 |
| WP1-B05 | 迁移总数 | migrated + failed = 27 |
| WP1-B06 | 新学生集合 | 没有非七上题 |
| WP1-B07 | 页面源码检查 | 不再直接导入 `questions.json` |

## 二十、建议调试命令

在 `package.json` 增加：

```json
{
  "scripts": {
    "debug:knowledge-practice-wp1": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runKnowledgePracticeWP1Debug.ts",
    "validate:knowledge-questions": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runKnowledgePracticeWP1Debug.ts --validate-data"
  }
}
```

WP1 收口至少执行：

```text
npm run debug:knowledge-practice-wp1
npm run validate:knowledge-questions
npm run build
```

如 `package.json` 已有更适合的统一测试入口，可追加而不重复创建脚本；命令名称变化必须同步更新执行清单证据。

## 二十一、浏览器人工验收

WP1 不验收完整新练习闭环，只验收数据切换未破坏现有可见能力：

1. 打开知识练习入口；
2. 页面只展示七年级上册首批 `approved` 分类与数量；
3. 不展示八年级、九年级或七年级下册题；
4. 进入一个有题分类；
5. 单选和判断题展示文本不包含重复 `A. A.` 前缀；
6. 选择题可以按稳定 optionId 正确判题；
7. 填空题可以按显式接受答案判题；
8. 刷题页没有因新字段迁移白屏；
9. 错题本初始化没有因旧 ID 映射崩溃；
10. 正式 `/learning` 入口不受影响。

## 二十二、WP1 完成门禁

必须同时满足：

### 22.1 数据

- [ ] 旧 27 道题全部有迁移结果，不静默丢失；
- [ ] 七上 12 道候选与非首批 15 道分离；
- [ ] 学生可用题全部属于七年级上册；
- [ ] 学生可用题全部是 `approved`；
- [ ] approved 题结构错误为 0；
- [ ] 每道 approved 选择题选项级解析完整；
- [ ] 每道 approved 题具有 1—3 个解题步骤；
- [ ] 变式关系均经过人工确认。

### 22.2 工程

- [ ] Question v1 类型、规范化、校验和 Repository 已实现；
- [ ] 页面不再直接导入旧 JSON；
- [ ] 页面不再依赖选项首字符判题；
- [ ] 数据校验命令可以独立运行；
- [ ] 校验失败能使命令返回非零退出码；
- [ ] WP1 自动化测试全部通过；
- [ ] 应用构建通过；
- [ ] 浏览器人工验收通过；
- [ ] 正式 `/learning` 回归通过。

### 22.3 文档与证据

- [ ] 输出迁移报告；
- [ ] 输出 approved 数量和 100 道内容缺口；
- [ ] 执行清单填写真实文件、测试命令和结果；
- [ ] 记录仍为 draft 的七上题及原因；
- [ ] 记录已知限制；
- [ ] 总进度将 WP1 更新为 `ENGINEERING PASS`，WP2 才可进入 `IN PROGRESS`。

## 二十三、WP1 工程产物清单

预期工程产物：

```text
src/domain/knowledge-practice/questions/knowledgeQuestionTypes.ts
src/domain/knowledge-practice/questions/knowledgeQuestionNormalization.ts
src/domain/knowledge-practice/questions/knowledgeQuestionValidator.ts
src/domain/knowledge-practice/questions/legacyKnowledgeQuestionMigration.ts
src/domain/knowledge-practice/questions/knowledgeQuestionRepository.ts
src/data/knowledgeQuestions.grade7s1.v1.json
src/ai/tests/runKnowledgePracticeWP1Debug.ts
```

预期文档证据：

```text
docs/product/KNOWLEDGE_PRACTICE_PHASE1_WP1_MIGRATION_REPORT.md
```

实际实现可以在不破坏本文责任边界的前提下调整文件名；调整后必须更新执行清单中的真实证据路径。

## 二十四、WP1 之后的交接

WP1 只交付可靠题目数据源。WP2 从 Repository 的 approved 集合开始工作，并负责：

- 专项 5 题和综合 10 题；
- seed 与稳定顺序；
- 近期降权；
- 会话基础题冻结；
- 会话内变式组排重。

WP2 不得绕过 Repository 读取 draft，不得重新解释 Question 字段，也不得在选题层修补内容质量问题。
