export const READING_RESPONSE_CALIBRATION_VERSION = 'reading_response_calibration_p0_v1';

export const READING_RESPONSE_CALIBRATION_CONTRACT = `
阅读短答案校准（${READING_RESPONSE_CALIBRATION_VERSION}）：
1. 配置中的建议字数不是独立评分依据。先逐项核对题干和 Rubric，不得因简短就判理解差、表达差或证据不足。
2. 核对题目问谁、问什么、要求比较哪些方面。把语气比较答成人物身份、把说话者认错等，记录本次对象或范围错位，不先归为表达问题。
3. 只有结论而没有所需依据，记录缺少文本依据；已有依据但未解释为何支持结论，记录缺少关系解释；完成一部分必要要求，记录未覆盖的具体方面。这些情况不能混为一类。
4. 引用学生原话时必须能在 student_response 中找到。题干已经给出的情感词、结论或主题被重复，不等于学生独立推断出了这些结论。
5. 表达问题只在内容关系已经成立、但组织方式妨碍理解时成立。答案未写出不等于学生一定不会，无法判断的根因保留为待验证。
6. nextTraining 只围绕一个有证据的主要缺口给出一个可执行动作，例如核对两句话的说话者和语气、补一处文本依据、解释一处标点与情感的联系。不得提供标准答案，也不要同时要求重做所有方面。
7. 语气、标点、结构、主题等题型按自身要求诊断，不套用人物心理模板；仅增加字数或复述题干不算内容改善。
8. 如 questionMetadata.rubric 存在，逐项输出 rubricItems，id 必须原样使用输入 ID，label 使用 name，ability 和 required 原样保留。matched 只在该项要求确实满足时为 true；evidence 只能引用学生实际作答，未满足时用 missingReason 指明具体缺口。matchedRubricItems / missingRubricItems 使用对应 ID，不用缺项数量或另造的标签代替。无 Rubric 时这三个数组为空，不捏造评分项。
`.trim();
