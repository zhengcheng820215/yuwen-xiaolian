# 知识练习第一阶段 WP3 判题、响应与逐题反馈工程实施文档

状态：`ENGINEERING PASS`

版本：`knowledge_practice_phase1_wp3_response_feedback_v1.0`

日期：`2026-08-29`

上位方案：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)

WP2验收：[`KNOWLEDGE_PRACTICE_PHASE1_WP2_ENGINEERING_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP2_ENGINEERING_ACCEPTANCE_REPORT.md)

执行清单：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

## 一、文档目的

本文定义第一阶段 WP3 的工程实施边界、领域契约、判题规则、幂等提交、反馈构建、页面拆分、自动化测试和浏览器验收标准。

WP3完成后，知识练习主链应从：

```text
页面临时判断答案
→ 页面本地数组记录结果
→ 展示通用正确答案与解析
```

升级为：

```text
选择或填写答案
→ 显式提交
→ 校验当前Session与Queue Item
→ 生成唯一PracticeResponse
→ 使用冻结内容版本精确判题
→ 原子锁定当前Queue Item
→ 针对本次答案生成结构化反馈
→ 学生主动阅读后进入下一题
```

WP3只处理知识练习的作答、判题和逐题反馈。刷新恢复属于WP4，变式巩固属于WP5，结果摘要与推荐属于WP6，81道正式阅读题与知识练习的统一入口属于WP7资源整合。

## 二、前置条件与当前基线

### 2.1 WP1已交付

- 七年级上册知识题统一领域契约；
- 稳定Question ID、Option ID和内容版本；
- `correctAnswer`、`acceptedAnswers`和规范化规则；
- `answerAnalysis`、`misconceptionByAnswer`和`solutionSteps`；
- 学生页面只消费`approved`题；
- Repository返回防御性副本。

### 2.2 WP2已交付

- PracticeSession v1与Queue Item；
- Session ID、seed和稳定题目顺序；
- 当前Queue Item身份及内容版本；
- answered、advance和abandon状态变化；
- Quiz只从Session queue取得当前题目；
- WP2自动化`47 / 47 PASS`。

### 2.3 当前实现缺口

当前`Quiz.jsx`仍存在以下WP3缺口：

1. `answerIsCorrect`仍定义在页面内部；
2. `answered`和`records`是页面临时状态；
3. 选择题点击选项立即提交，学生无法确认或修改选择；
4. Response没有稳定ID、Queue Item ID、内容版本和作答时长；
5. Response与Queue Item answered不是同一原子状态变化；
6. 重复点击主要依靠组件布尔值，不是领域幂等；
7. 答错反馈没有使用当前错误选项的`answerAnalysis`和`misconceptionByAnswer`；
8. 页面直接拼接反馈，无法独立测试；
9. `StudyContext.addMistake`仍由页面直接调用；
10. 结果页记录仍由Quiz临时数组计算，WP6前只能保持兼容。

## 三、WP3范围

### 3.1 本工作包必须完成

- 建立`PracticeResponse`、`PracticeAttempt`和结构化反馈契约；
- 建立单选、判断、填空的纯判题函数；
- 建立无效答案校验；
- 建立每个Queue Item最多一个Response的幂等规则；
- 建立Response与Queue锁定的原子提交函数；
- 建立针对当前选项的反馈构建纯函数；
- 支持内容不足时的明确降级；
- 测量并记录每题实际作答时长；
- 将Quiz拆为题卡、答案输入、反馈卡和底部动作组件；
- 保持错题页和既有结果页在WP6前可继续工作；
- 完成WP1、WP2回归、生产构建和浏览器验收。

### 3.2 本工作包明确不做

- 不把Session或Response写入localStorage；
- 不实现刷新、关闭页面后的恢复；
- 不插入变式巩固题；
- 不生成最终不可变PracticeResult；
- 不重构最终结果页指标与推荐；
- 不做语义相似度、大模型判题或开放回答评分；
- 不把81道正式阅读题迁入轻量知识题Repository；
- 不修改WP2已经冻结的基础题集合和顺序；
- 不建立长期能力、掌握度或人格判断。

## 四、核心架构决策

### 4.1 保持PracticeSession v1不变

WP2的PracticeSession继续只负责：

- 练习身份；
- 基础题集合和顺序；
- Queue状态；
- 当前索引和终态。

WP3不直接向Session v1追加`responses`字段，避免已经验收的Session契约在没有迁移规则时被原位修改。

### 4.2 新增PracticeAttempt聚合体

```ts
export type PracticeAttempt = {
  schemaVersion: 1;
  session: PracticeSession;
  responses: PracticeResponse[];
  feedbackByResponseId: Record<string, AnswerFeedback>;
  currentQuestionPresentedAt: string;
  updatedAt: string;
};
```

PracticeAttempt是WP3运行时原子边界，也是WP4后续持久化根对象的输入。页面不能分别调用“添加Response”和“标记Queue answered”两个互不关联的setter。

### 4.3 原子提交

```text
读取当前Attempt
→ 校验Session active
→ 校验Queue Item是当前pending项
→ 检查是否已有Response
→ 校验Question ID和内容版本
→ 校验提交答案
→ 精确判题
→ 创建Response
→ 构建Feedback
→ 标记Queue Item answered
→ 一次返回新Attempt
```

任何一步失败都不得留下“有Response但Queue仍pending”或“Queue已answered但没有Response”的半完成状态。

## 五、PracticeResponse契约

### 5.1 类型

```ts
export type PracticeResponse = {
  schemaVersion: 1;
  id: string;
  responseKey: string;
  sessionId: string;
  queueItemId: string;
  questionId: string;
  questionContentVersion: number;
  role: 'base' | 'reinforcement';
  sourceQuestionId?: string;
  submittedAnswer: string;
  normalizedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  knowledgePoint: string;
  misconceptionCode?: string;
  durationMs: number;
  answeredAt: string;
};
```

### 5.2 字段规则

| 字段 | 规则 |
| --- | --- |
| `id` | 确定性生成；同一Session和Queue Item始终得到同一ID |
| `responseKey` | `${sessionId}::${queueItemId}`，用于幂等索引 |
| `queueItemId` | 必填；不能只用Question ID，因为WP5可能出现同题不同角色 |
| `questionContentVersion` | 必须等于Queue冻结版本 |
| `submittedAnswer` | 保留学生提交值；填空仅trim外层，不存页面装饰字符 |
| `normalizedAnswer` | 使用题目声明的规范化规则生成 |
| `correctAnswer` | 保存提交时的正确Option ID或规范化标准答案 |
| `misconceptionCode` | 仅来自已审核`misconceptionByAnswer`，不得运行时猜测 |
| `durationMs` | 从本题呈现到首次有效提交的实际时长，非题量估算 |
| `answeredAt` | 首次有效提交时间；重复提交不得覆盖 |

### 5.3 唯一性

唯一约束：

```text
sessionId + queueItemId → 最多一个PracticeResponse
```

同一题在不同Session可各有一条Response；同一Question未来作为基础题和巩固题出现时，以Queue Item区分。

## 六、PracticeAttempt不变量

校验器至少保证：

1. `attempt.session.id`与每条Response的`sessionId`一致；
2. 每条Response的`queueItemId`存在于Session queue；
3. Response的Question ID、role、sourceQuestionId与Queue Item一致；
4. Response的内容版本与Queue Item冻结版本一致；
5. `responseKey`唯一；
6. Queue Item为answered时必须存在且只存在一条Response；
7. Queue Item为pending时不得存在Response；
8. 当前索引之前的Queue Item均为answered；
9. 当前题可为pending或answered，后续题必须pending；
10. `feedbackByResponseId`只能引用已有Response；
11. 每条Response必须存在一条Feedback；
12. 时间戳合法，`durationMs`为非负有限整数；
13. completed Session的所有Queue Item均有Response；
14. Attempt可以JSON序列化再校验通过。

## 七、答案输入契约

### 7.1 输入类型

```ts
export type SubmittedPracticeAnswer = {
  value: string;
  submittedAt: string;
  durationMs: number;
};
```

页面只提交字符串值：

- 单选、判断：Option ID；
- 填空：学生输入原文。

### 7.2 通用无效输入

以下输入拒绝提交且不生成Response：

- 空字符串；
- 仅空白；
- 非字符串；
- 非法或不可解析的提交时间；
- 非有限、负数或超出安全上限的duration；
- Session不是active；
- Queue Item不是当前项；
- 当前题内容不可读取或内容版本不一致。

### 7.3 填空无效输入

填空还必须拒绝：

- 仅中文或英文标点；
- 规范化后为空；
- 超过200个Unicode字符；
- 包含不可见控制字符。

第一阶段不因为答案“看起来相似”而判对，也不自动纠正错别字。

### 7.4 选择题无效输入

- Option ID必须精确存在于当前题`options`；
- 不接受`A.`、`B、`或选项文本替代Option ID；
- 判断题也按固定Option ID提交，不按布尔值或显示文字判题。

## 八、判题纯函数

### 8.1 接口

```ts
export type AnswerEvaluation = {
  submittedAnswer: string;
  normalizedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  misconceptionCode?: string;
};

export type EvaluateAnswerResult =
  | { ok: true; evaluation: AnswerEvaluation }
  | { ok: false; error: PracticeAnswerError };

export function evaluateKnowledgeAnswer(
  question: KnowledgeQuestion,
  submitted: SubmittedPracticeAnswer,
): EvaluateAnswerResult;
```

该函数必须无时间读取、无随机、无Repository访问、无React状态、无写入副作用。

### 8.2 单选与判断

```text
submittedOptionId === question.correctAnswer
```

不允许：

- 截取选项首字符；
- 比较显示文字；
- 大小写猜测；
- 根据解析文案反推答案。

答错时仅在`misconceptionByAnswer[submittedOptionId]`存在时保存对应code。

### 8.3 填空

规范化严格使用题目声明的规则：

1. `trim`；
2. `normalize_fullwidth_space`；
3. `collapse_whitespace`；
4. `ignore_terminal_punctuation`；
5. 按声明顺序稳定执行；
6. 学生答案与`acceptedAnswers`逐一规范化比较；
7. 未声明的规则不得自动启用。

`acceptedAnswers`缺失时只使用`correctAnswer`。语义近似、同义改写、错别字和未声明缩写均判为错误。

## 九、错误契约

```ts
export type PracticeAnswerErrorCode =
  | 'attempt_invalid'
  | 'session_not_active'
  | 'queue_item_not_current'
  | 'question_unavailable'
  | 'question_version_mismatch'
  | 'answer_empty'
  | 'answer_punctuation_only'
  | 'answer_too_long'
  | 'answer_control_character'
  | 'option_invalid'
  | 'duration_invalid'
  | 'submitted_at_invalid'
  | 'response_identity_failed';
```

错误对象：

```ts
export type PracticeAnswerError = {
  code: PracticeAnswerErrorCode;
  studentMessage: string;
  details?: Record<string, unknown>;
};
```

学生界面只展示稳定中文文案，不暴露Schema路径、内部ID、堆栈或Repository状态。

## 十、幂等与原子提交

### 10.1 提交接口

```ts
export type SubmitPracticeAnswerInput = {
  attempt: PracticeAttempt;
  queueItemId: string;
  question: KnowledgeQuestion;
  answer: SubmittedPracticeAnswer;
};

export type SubmitPracticeAnswerResult =
  | {
      ok: true;
      outcome: 'created' | 'already_submitted';
      attempt: PracticeAttempt;
      response: PracticeResponse;
      feedback: AnswerFeedback;
    }
  | { ok: false; error: PracticeAnswerError };
```

### 10.2 首次有效提交

- 校验Question与当前Queue Item严格一致；
- 生成Response和Feedback；
- 调用WP2不可变状态函数标记当前Queue Item answered；
- 返回新的Attempt；
- 输入Attempt不得被原地修改。

### 10.3 重复提交

若`responseKey`已存在：

- 返回原Response和原Feedback；
- `outcome = 'already_submitted'`；
- 不重新判题；
- 不覆盖submittedAnswer、durationMs或answeredAt；
- 不新增错题；
- 不重复触发后续WP5巩固。

如果重复请求携带不同答案，仍返回首次Response；可在开发日志记录冲突，但不能改变学生历史事实。

### 10.4 Context提交边界

PracticeSessionContext在WP3升级为PracticeAttempt装配层，暴露：

```ts
submitCurrentAnswer(input): SubmitPracticeAnswerResult
advanceSession(now): void
```

页面不得再直接调用`markCurrentAnswered`。只有`submitCurrentAnswer`成功创建或确认已有Response后，当前题才处于answered状态。

## 十一、逐题反馈契约

### 11.1 类型

```ts
export type AnswerFeedback = {
  schemaVersion: 1;
  responseId: string;
  result: 'correct' | 'incorrect';
  headline: string;
  submittedAnswerText: string;
  correctAnswerText: string;
  currentChoiceExplanation?: string;
  keyEvidence: string;
  knowledgePoint: string;
  misconception?: {
    code: string;
    studentMessage: string;
  };
  solutionSteps: string[];
  contentFallbacks: AnswerFeedbackFallbackCode[];
};

export type AnswerFeedbackFallbackCode =
  | 'choice_analysis_missing'
  | 'misconception_missing'
  | 'key_evidence_from_general_explanation';
```

### 11.2 构建接口

```ts
export function buildAnswerFeedback(
  question: KnowledgeQuestion,
  response: PracticeResponse,
): AnswerFeedback;
```

该函数必须是确定性纯函数，不调用AI，不访问网络，不读学生长期数据。

### 11.3 答对反馈

答对反馈保持简洁：

1. 明确“回答正确”；
2. 使用正确选项的`answerAnalysis`作为关键依据；
3. 若缺少选项解析，降级使用`explanation`；
4. 展示具体知识点；
5. solutionSteps默认折叠或简洁展示，不制造额外负担；
6. 禁止“你已掌握”“能力提升”等长期结论。

### 11.4 答错反馈

答错反馈必须回答三个问题：

```text
我为什么错？
→ 当前选择对应的answerAnalysis

正确依据是什么？
→ 正确选项answerAnalysis或通用explanation

下次怎么做？
→ 题目中已审核的1—3条solutionSteps
```

如存在`misconceptionByAnswer[submittedAnswer]`，可以展示其`studentMessage`，但必须表述为“这道题需要注意……”，不得上升为长期根因。

### 11.5 内容降级

缺少当前错误选项独立解析时：

- 不临时编造具体错因；
- 展示“这个选项不符合本题要求，请对照正确依据重新核查”；
- 继续展示正确答案、通用解析和步骤；
- 在`contentFallbacks`记录`choice_analysis_missing`；
- 学生主链不中断；
- 后续内容工作台可按code统计缺口。

### 11.6 禁止文案

反馈不得出现：

- “你很粗心”“你的基础差”；
- “你已经掌握”“能力显著提升”；
- “系统判断你的根因是……”；
- 内部error code、字段名、审核状态；
- 与本题无关的泛化鼓励长文；
- 无依据的大模型生成解释。

## 十二、作答时长

### 12.1 计时起点

每次当前题变为可交互状态时记录`currentQuestionPresentedAt`。推进到下一题时重置。

### 12.2 计时终点

首次有效提交时计算：

```text
durationMs = submittedAt - currentQuestionPresentedAt
```

无效提交不停止计时；重复提交不覆盖首次时长。

### 12.3 安全边界

- 小于0或非有限值拒绝；
- WP3记录原始有效时长；
- 建议单题输入上限30分钟，超过时按30分钟保存并记录运行降级；
- WP6负责结果聚合时的最大有效计时口径，不在WP3估算总用时。

## 十三、错题兼容边界

WP3保留现有错题页兼容，但错题写入必须由新Response驱动：

```text
submitCurrentAnswer outcome=created
且response.isCorrect=false
→ 调用MistakeAdapter记录一次
```

要求：

- `already_submitted`不得再次写入；
- wrongAnswer从Response解析，不从页面临时选择读取；
- 错题展示答案仍通过Repository显示工具获得；
- WP3不实现错题持久化和巩固调度；
- WP5可替换该兼容Adapter，但不得改变已存在Response。

## 十四、页面与组件拆分

建议结构：

```text
src/domain/knowledge-practice/response/
├── practiceResponseTypes.ts
├── practiceAttemptValidator.ts
├── validateSubmittedAnswer.ts
├── evaluateKnowledgeAnswer.ts
├── buildAnswerFeedback.ts
├── submitPracticeAnswer.ts
└── practiceResponseIdentity.ts

src/components/knowledge-practice/
├── KnowledgeQuestionCard.jsx
├── KnowledgeAnswerInput.jsx
├── KnowledgeAnswerFeedback.jsx
└── KnowledgeQuizActions.jsx

src/ai/tests/
└── runKnowledgePracticeWP3Debug.ts
```

### 14.1 Quiz职责

Quiz只负责：

- 取得当前Attempt、Queue Item和Question；
- 管理提交前输入草稿；
- 调用`submitCurrentAnswer`；
- 展示领域返回的Response和Feedback；
- 调用advance；
- 在WP6前维持旧结果页装配兼容。

Quiz不得：

- 自行判题；
- 自行规范化答案；
- 自行拼反馈；
- 自行构造Response ID；
- 用页面布尔值实现幂等；
- 直接标记Queue Item answered；
- 根据长期进度推导能力结论。

### 14.2 答案交互

三种题型统一采用显式提交：

- 单选、判断：先选择，再点击“提交答案”；提交前允许更改；
- 填空：输入后点击“提交答案”；
- 提交中按钮禁用并显示稳定状态；
- 提交成功后输入锁定；
- 反馈完整展示后由学生点击“下一题”；
- 最后一题显示“查看结果”。

### 14.3 无障碍与表达

- 结果同时用文字和颜色表达；
- 选项锁定后保留选中、正确和错误的文字语义；
- 按钮具备可识别名称；
- 键盘可选择、提交和推进；
- 焦点在提交后移动到反馈标题或使用可感知的状态区域；
- 手机和PC下反馈不被底部操作栏遮挡。

## 十五、与81道正式题的边界

当前系统已有81道正式Learning可消费题，但其主要绑定24篇阅读材料和正式学习任务，不属于WP3轻量知识题的判题契约。

WP3本轮只消费`KnowledgeQuestionRepository`中的知识题，原因是：

- 三类题型和答案边界已经冻结；
- 反馈来自WP1人工审核字段；
- 正式阅读题可能包含开放回答、Rubric和证据链；
- 将两类题强行共用一个Response会破坏正式Learning契约。

WP7可以统一学生入口、错题导航和推荐，但不得在WP3把81道正式题静默转换为知识题。

## 十六、领域自动化验收矩阵

### 16.1 输入校验与判题

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP3-E01 | 单选提交正确Option ID | 正确 |
| WP3-E02 | 单选提交错误Option ID | 错误 |
| WP3-E03 | 判断题正确与错误 | 均准确 |
| WP3-E04 | 提交不存在的Option ID | `option_invalid` |
| WP3-E05 | 提交显示文字代替Option ID | 拒绝 |
| WP3-E06 | 填空首尾空白 | 按声明trim |
| WP3-E07 | 连续空白 | 按声明collapse |
| WP3-E08 | 全角空格 | 按声明规范化 |
| WP3-E09 | 末尾标点 | 仅声明时忽略 |
| WP3-E10 | 显式acceptedAnswers | 匹配正确 |
| WP3-E11 | 未声明同义表达 | 判错 |
| WP3-E12 | 错别字或语义近似 | 判错 |
| WP3-E13 | 空白答案 | `answer_empty` |
| WP3-E14 | 纯标点答案 | `answer_punctuation_only` |
| WP3-E15 | 超长或控制字符 | 拒绝 |

### 16.2 Response与幂等

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP3-R01 | 首次有效提交 | 创建一条Response |
| WP3-R02 | Response字段 | Session、Queue、Question、版本严格对应 |
| WP3-R03 | 同请求重复提交 | 返回原Response |
| WP3-R04 | 重复请求携带不同答案 | 仍返回首次事实 |
| WP3-R05 | 重复提交 | 不覆盖首次duration和answeredAt |
| WP3-R06 | 非当前Queue Item提交 | 拒绝 |
| WP3-R07 | completed或abandoned提交 | 拒绝 |
| WP3-R08 | 内容版本不一致 | 拒绝且Queue保持pending |
| WP3-R09 | 创建Response | Queue同步变answered |
| WP3-R10 | 提交失败 | Attempt完全不变 |
| WP3-R11 | 输入Attempt | 不被原地修改 |
| WP3-R12 | JSON序列化再解析 | Attempt校验通过 |

### 16.3 反馈

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP3-F01 | 答对选择题 | 使用正确选项依据 |
| WP3-F02 | 答错选择题 | 使用学生所选选项解析 |
| WP3-F03 | 有misconception标注 | 使用对应code和studentMessage |
| WP3-F04 | 无misconception标注 | 不推测根因 |
| WP3-F05 | 当前选项解析缺失 | 明确通用降级并记录code |
| WP3-F06 | 正确选项解析缺失 | 使用通用explanation |
| WP3-F07 | 填空答错 | 展示提交值、正确答案和依据 |
| WP3-F08 | solutionSteps | 只展示已审核1—3步 |
| WP3-F09 | 同Question与Response | 输出完全确定 |
| WP3-F10 | 所有反馈 | 不出现长期掌握或人格判断 |

### 16.4 Attempt校验

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP3-A01 | answered但无Response | 校验失败 |
| WP3-A02 | pending却有Response | 校验失败 |
| WP3-A03 | responseKey重复 | 校验失败 |
| WP3-A04 | queueItemId不存在 | 校验失败 |
| WP3-A05 | Question或版本错位 | 校验失败 |
| WP3-A06 | Feedback引用不存在Response | 校验失败 |
| WP3-A07 | Response缺Feedback | 校验失败 |
| WP3-A08 | 非法duration或时间 | 校验失败 |

## 十七、浏览器人工验收

### 17.1 单选题

1. 进入一轮包含单选题的练习；
2. 未选择时“提交答案”不可用；
3. 选择A后可以改选B；
4. 点击提交后选项锁定；
5. 正确或错误同时用文字表达；
6. 答错时反馈明确对应学生所选项；
7. 反馈展示正确依据和1—3步方法；
8. 不自动跳到下一题；
9. 点击下一题后进度只增加1。

### 17.2 判断题

1. 正确和错误均按固定Option ID提交；
2. 选择后仍需显式提交；
3. 提交后不能修改；
4. 反馈内容与提交选项一致。

### 17.3 填空题

1. 空白和纯标点不能提交；
2. 有效答案可提交；
3. 首尾空白按题目规则处理；
4. 显式等价答案判对；
5. 未声明的近似答案判错；
6. 提交后输入框锁定；
7. 反馈展示学生答案和标准答案。

### 17.4 幂等与兼容

- 快速双击提交只生成一条Response；
- 重渲染不重复写Response或错题；
- 返回反馈状态时不重新判题；
- 错题页记录与当前错误答案一致；
- 最后一题仍能进入既有结果页；
- 专项3题、单题和综合10题Session继续正常；
- 正式`/learning`烟测无新增错误；
- 控制台无未处理error或warning。

### 17.5 响应式与无障碍

- 手机宽度下题干、选项、反馈和底部按钮完整可读；
- PC宽度下内容不出现不可读的超长行；
- 键盘完成选择、提交和下一题；
- 红绿之外存在明确结果文字；
- 提交中与已提交状态可辨识。

## 十八、实施步骤

### WP3-M0：冻结基线与Fixture

1. 冻结WP1三类approved题Fixture；
2. 建立非法选项、纯标点、显式等价答案Fixture；
3. 建立缺少选项解析的降级Fixture；
4. 固定响应ID和反馈输出测试向量。

### WP3-M1：类型与校验

1. 建立Response、Attempt、Feedback和Error类型；
2. 建立Response确定性身份；
3. 建立Attempt校验器；
4. 建立输入校验器。

### WP3-M2：判题与反馈纯函数

1. 实现选择题Option ID精确判题；
2. 实现填空声明式规范化；
3. 实现misconception映射；
4. 实现反馈构建；
5. 实现内容降级code。

### WP3-M3：原子提交

1. 实现`submitPracticeAnswer`；
2. 保证Response和Queue answered一致；
3. 实现重复提交返回首次事实；
4. 实现时长记录；
5. 将PracticeSessionContext升级为Attempt装配。

### WP3-M4：页面拆分

1. 拆分题卡；
2. 拆分答案输入；
3. 拆分反馈卡；
4. 拆分底部动作；
5. Quiz移除判题、反馈拼接和records临时数组；
6. 接入错题兼容Adapter；
7. 保持旧结果页兼容。

### WP3-M5：验收与收口

1. 运行WP3自动化；
2. 运行WP2和WP1回归；
3. 运行题库数据门禁；
4. 运行生产构建；
5. 完成三类题型浏览器验收；
6. 完成快速重复提交与无障碍验收；
7. 输出WP3 Engineering Acceptance Report；
8. 更新执行清单为WP3 ENGINEERING PASS。

## 十九、建议命令

新增：

```json
{
  "scripts": {
    "debug:knowledge-practice-wp3": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runKnowledgePracticeWP3Debug.ts"
  }
}
```

收口执行：

```text
npm run debug:knowledge-practice-wp1
npm run validate:knowledge-questions
npm run debug:knowledge-practice-wp2
npm run debug:knowledge-practice-wp3
npm run build
```

没有全局npm时使用工作区Node执行等价命令，验收报告记录真实命令。

## 二十、完成门禁

### 20.1 领域逻辑

- [x] Response、Attempt、Feedback和Error契约完成；
- [x] 三类题型判题为独立纯函数；
- [x] 无效输入全部受控拒绝；
- [x] 每个Queue Item最多一条Response；
- [x] Response与Queue answered原子一致；
- [x] 重复提交返回首次事实；
- [x] 内容版本错位不会静默判题；
- [x] 反馈对应学生本次答案；
- [x] 缺少内容时明确降级且不编造；
- [x] Attempt可序列化并通过校验。

### 20.2 页面

- [x] 三种题型统一显式提交；
- [x] 提交前可以修改答案；
- [x] 提交后输入锁定；
- [x] 提交中不能重复操作；
- [x] 反馈不自动跳过；
- [x] 反馈回答“为什么错、正确依据、下次怎么做”；
- [x] Quiz不再实现判题和反馈算法；
- [x] 错题页和旧结果页兼容；
- [x] 手机、PC和键盘主链可用。

### 20.3 验证

- [x] WP3自动化全部通过；
- [x] WP2 `47 / 47`回归通过；
- [x] WP1 `47 / 47`回归通过；
- [x] 数据门禁`0 error / 0 warning`；
- [x] 生产构建通过；
- [x] 单选、判断、填空浏览器主链通过；
- [x] 幂等、错题兼容和结果跳转通过；
- [x] 控制台无新增未处理错误；
- [x] 输出WP3工程验收报告；
- [x] 执行清单更新为WP3 ENGINEERING PASS。

工程验收证据：[`KNOWLEDGE_PRACTICE_PHASE1_WP3_ENGINEERING_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP3_ENGINEERING_ACCEPTANCE_REPORT.md)

## 二十一、风险与预案

| 风险 | 影响 | 预案 |
| --- | --- | --- |
| 页面与领域各存一份answered状态 | 状态错位、重复提交 | 以PracticeAttempt为唯一事实，移除页面answered布尔值 |
| Response与Queue分两次setState | 产生半完成状态 | 使用纯函数一次返回新Attempt并单次提交 |
| 内容版本变化 | 历史题被新答案重判 | 强制核对Queue冻结版本；WP4再增加内容快照 |
| 缺少选项级解析 | 反馈空泛或临时编造 | 固定fallback文案和可观察code |
| 选择即提交 | 误触后无法修改 | 统一改为选择后显式提交 |
| 快速双击 | 重复Response、错题或巩固 | responseKey唯一，重复返回首次事实 |
| 时长受后台停留影响 | 结果用时失真 | WP3记录原始/封顶时长，WP6冻结聚合口径 |
| StudyContext继续承担领域逻辑 | 后续持久化边界混乱 | 仅保留Mistake兼容Adapter，Response归Attempt |
| 将81道正式题强行接入 | 破坏Rubric和Evidence契约 | WP3保持题库隔离，WP7只做入口和推荐整合 |

## 二十二、WP3之后的交接

WP3向WP4交付：

- 可序列化PracticeAttempt；
- 稳定Response ID和responseKey；
- Response、Queue和Feedback一致性校验器；
- 当前题呈现时间和首次有效作答时间；
- 可安全写入本地存储的原子状态。

WP4负责：

- 持久化Attempt；
- schema迁移和损坏隔离；
- 刷新、关闭和重新进入后的恢复；
- active Session冲突处理。

WP5只根据已存在且首次错误的Response调度巩固，不得重判或覆盖Response。WP6只从不可变Response集合生成结果，不得从页面临时状态重新计算。

## 二十三、关键决策确认

进入代码开发前确认以下决策：

| 编号 | 决策 | 推荐结论 | 影响 |
| --- | --- | --- | --- |
| D1 | Response唯一键 | `sessionId + queueItemId` | 支持未来基础题与巩固题区分 |
| D2 | Session契约 | 保持WP2 Session v1不变，新增Attempt v1聚合 | 避免原位修改已验收契约 |
| D3 | 提交原子性 | Response、Feedback和Queue answered一次提交 | 消除半完成状态 |
| D4 | 选择题交互 | 先选择、后显式提交 | 降低误触并统一三类题型 |
| D5 | 重复提交 | 返回首次Response，不接受覆盖 | 保证幂等和首次正确率真实性 |
| D6 | 填空判题 | 仅严格答案、acceptedAnswers和声明式规范化 | 不使用模糊或AI判题 |
| D7 | 错因来源 | 只使用审核字段；缺失时明确降级 | 不编造学生根因 |
| D8 | 作答时长 | 记录题目呈现到首次有效提交，单题最多30分钟 | 为WP6真实用时提供基础 |
| D9 | 错题兼容 | 仅在新错误Response创建后写一次Adapter | 保持现有错题页可用 |
| D10 | 81道正式题 | WP3不接入，WP7统一入口与推荐 | 避免破坏正式Learning契约 |
| D11 | WP3完成状态 | 自动化、构建、浏览器验收和报告齐全后才标记PASS | 不以代码存在代替工程验收 |

推荐以上D1—D11全部作为WP3冻结基线。若无调整，下一步按本实施文档生成WP3执行清单并进入代码开发。
