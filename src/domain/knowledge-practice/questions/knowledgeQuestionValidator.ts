import { normalizedAcceptedAnswers } from './knowledgeQuestionNormalization.ts';
import {
  ANSWER_NORMALIZATION_RULES,
  KNOWLEDGE_QUESTION_CATEGORIES,
  KNOWLEDGE_QUESTION_STATUSES,
  KNOWLEDGE_QUESTION_TYPES,
  type KnowledgeQuestion,
  type KnowledgeQuestionDataset,
} from './knowledgeQuestionTypes.ts';

export type KnowledgeQuestionValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  questionId?: string;
  path: string;
  message: string;
};

export type KnowledgeQuestionValidationResult = {
  passed: boolean;
  issues: KnowledgeQuestionValidationIssue[];
};

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const OPTION_PREFIX_PATTERN = /^\s*[A-E]\s*[.．、]/u;
const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function add(
  issues: KnowledgeQuestionValidationIssue[],
  severity: 'error' | 'warning',
  code: string,
  path: string,
  message: string,
  questionId?: string,
): void {
  issues.push({ severity, code, path, message, questionId });
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateKnowledgeQuestion(question: KnowledgeQuestion): KnowledgeQuestionValidationResult {
  const issues: KnowledgeQuestionValidationIssue[] = [];
  const id = question?.id;
  const error = (code: string, path: string, message: string) => add(issues, 'error', code, path, message, id);
  const warning = (code: string, path: string, message: string) => add(issues, 'warning', code, path, message, id);

  if (!nonEmpty(id) || !ID_PATTERN.test(id)) error('question.id_invalid', 'id', '题目 ID 为空或格式非法。');
  if (!Number.isInteger(question.contentVersion) || question.contentVersion < 1) error('question.version_invalid', 'contentVersion', '内容版本必须是正整数。');
  if (!KNOWLEDGE_QUESTION_STATUSES.includes(question.contentStatus)) error('question.status_invalid', 'contentStatus', '内容状态非法。');
  if (!nonEmpty(question.grade) || !nonEmpty(question.semester)) error('question.scope_invalid', 'grade', '年级或学期为空。');
  if (!KNOWLEDGE_QUESTION_CATEGORIES.includes(question.category)) error('question.category_invalid', 'category', '分类不在固定枚举中。');
  if (!nonEmpty(question.subCategory)) error('question.subcategory_required', 'subCategory', '缺少子分类。');
  if (!nonEmpty(question.knowledgePoint)) error('question.knowledge_point_required', 'knowledgePoint', '缺少知识点。');
  if (!nonEmpty(question.examPoint)) error('question.exam_point_required', 'examPoint', '缺少考查点。');
  if (![1, 2, 3].includes(question.difficulty)) error('question.difficulty_invalid', 'difficulty', '难度必须是 1、2 或 3。');
  if (!KNOWLEDGE_QUESTION_TYPES.includes(question.type)) error('question.type_invalid', 'type', '题型非法。');
  if (!nonEmpty(question.stem)) error('question.stem_required', 'stem', '题干不能为空。');
  if (!nonEmpty(question.explanation)) error('question.explanation_required', 'explanation', '通用解析不能为空。');

  if (question.contentStatus === 'approved') {
    if (question.grade !== '七年级' || question.semester !== '上') error('question.scope_invalid', 'grade', '首批 approved 题必须属于七年级上册。');
    if (!Array.isArray(question.solutionSteps) || question.solutionSteps.length < 1 || question.solutionSteps.length > 3 || question.solutionSteps.some((step) => !nonEmpty(step))) {
      error('question.solution_steps_invalid', 'solutionSteps', 'approved 题必须提供 1—3 个有效解题步骤。');
    }
    if (!nonEmpty(question.sourceText)) error('question.source_required', 'sourceText', 'approved 题必须注明内容来源范围。');
    if (!nonEmpty(question.reviewedAt) || Number.isNaN(Date.parse(question.reviewedAt))) error('question.review_required', 'reviewedAt', 'approved 题必须有合法审核时间。');
  }

  if (question.type === 'fill_blank') validateFillQuestion(question, error);
  else validateChoiceQuestion(question, error);

  if (question.variantGroupId && !ID_PATTERN.test(question.variantGroupId)) warning('variant.id_invalid', 'variantGroupId', '变式组 ID 格式不规范。');
  return { passed: !issues.some((issue) => issue.severity === 'error'), issues };
}

function validateChoiceQuestion(
  question: KnowledgeQuestion,
  error: (code: string, path: string, message: string) => void,
): void {
  const options = question.options;
  if (!Array.isArray(options)) {
    error('choice.options_required', 'options', '选择题必须提供选项。');
    return;
  }

  const expectedCountValid = question.type === 'true_false'
    ? options.length === 2
    : options.length >= 3 && options.length <= 5;
  if (!expectedCountValid) error('choice.option_count_invalid', 'options', '选项数量不符合题型要求。');

  const ids = new Set<string>();
  for (const [index, option] of options.entries()) {
    if (!nonEmpty(option.id) || !ID_PATTERN.test(option.id)) error('choice.option_id_invalid', `options.${index}.id`, '选项 ID 非法。');
    if (ids.has(option.id)) error('choice.option_id_duplicate', `options.${index}.id`, '选项 ID 重复。');
    ids.add(option.id);
    if (!nonEmpty(option.text)) error('choice.option_text_required', `options.${index}.text`, '选项正文为空。');
    if (OPTION_PREFIX_PATTERN.test(option.text)) error('choice.display_prefix_forbidden', `options.${index}.text`, '选项正文不得包含展示字母前缀。');
  }

  if (!ids.has(question.correctAnswer)) error('choice.correct_answer_invalid', 'correctAnswer', '正确答案不引用有效选项。');
  if (question.type === 'true_false' && (options[0]?.id !== 'true' || options[1]?.id !== 'false')) {
    error('choice.true_false_identity_invalid', 'options', '判断题必须使用 true / false 稳定身份。');
  }

  if (question.contentStatus === 'approved') {
    const analysisKeys = Object.keys(question.answerAnalysis || {});
    if (options.some((option) => !nonEmpty(question.answerAnalysis?.[option.id]))) {
      error('choice.answer_analysis_incomplete', 'answerAnalysis', 'approved 选择题必须覆盖全部选项解析。');
    }
    if (analysisKeys.some((key) => !ids.has(key))) error('choice.unknown_analysis_key', 'answerAnalysis', '选项解析包含未知 optionId。');
  }

  const misconceptionKeys = Object.keys(question.misconceptionByAnswer || {});
  if (misconceptionKeys.includes(question.correctAnswer)) error('choice.correct_misconception_forbidden', 'misconceptionByAnswer', '正确选项不得标注错因。');
  if (misconceptionKeys.some((key) => !ids.has(key))) error('choice.unknown_misconception_key', 'misconceptionByAnswer', '错因映射包含未知 optionId。');
  for (const [key, misconception] of Object.entries(question.misconceptionByAnswer || {})) {
    if (!CODE_PATTERN.test(misconception.code) || !nonEmpty(misconception.studentMessage)) {
      error('choice.misconception_invalid', `misconceptionByAnswer.${key}`, '错因 code 或学生文案非法。');
    }
  }
}

function validateFillQuestion(
  question: KnowledgeQuestion,
  error: (code: string, path: string, message: string) => void,
): void {
  if (question.options !== undefined) error('fill.options_forbidden', 'options', '填空题不得包含选项。');
  if (!nonEmpty(question.correctAnswer)) error('fill.correct_answer_required', 'correctAnswer', '填空题必须有规范答案。');
  if (!Array.isArray(question.acceptedAnswers) || question.acceptedAnswers.length === 0) {
    error('fill.accepted_answers_required', 'acceptedAnswers', '填空题必须有可接受答案。');
    return;
  }
  if ((question.answerNormalization || []).some((rule) => !ANSWER_NORMALIZATION_RULES.includes(rule))) {
    error('fill.normalization_rule_invalid', 'answerNormalization', '包含未允许的答案规范化规则。');
  }
  const normalized = normalizedAcceptedAnswers(question.acceptedAnswers, question.answerNormalization);
  if (new Set(normalized).size !== normalized.length) error('fill.accepted_answer_duplicate', 'acceptedAnswers', '可接受答案规范化后重复。');
  const normalizedCorrect = normalizedAcceptedAnswers([question.correctAnswer], question.answerNormalization)[0];
  if (!normalized.includes(normalizedCorrect)) error('fill.correct_answer_not_accepted', 'acceptedAnswers', '规范正确答案不在可接受答案集合中。');
}

export function validateKnowledgeQuestionDataset(
  dataset: KnowledgeQuestionDataset,
): KnowledgeQuestionValidationResult {
  const issues: KnowledgeQuestionValidationIssue[] = [];
  if (dataset.schemaVersion !== 1) add(issues, 'error', 'dataset.schema_version_invalid', 'schemaVersion', '数据集 Schema 版本必须为 1。');
  if (dataset.datasetId !== 'knowledge-practice-grade7-semester1' || dataset.grade !== '七年级' || dataset.semester !== '上') {
    add(issues, 'error', 'dataset.identity_invalid', 'datasetId', '数据集身份与七年级上册首批契约不一致。');
  }
  if (!Array.isArray(dataset.questions)) {
    add(issues, 'error', 'dataset.questions_invalid', 'questions', 'questions 必须是数组。');
    return { passed: false, issues };
  }

  const seen = new Set<string>();
  for (const question of dataset.questions) {
    if (seen.has(question.id)) add(issues, 'error', 'dataset.question_id_duplicate', 'questions', `题目 ID 重复：${question.id}`, question.id);
    seen.add(question.id);
    issues.push(...validateKnowledgeQuestion(question).issues);
  }

  const approved = dataset.questions.filter((question) => question.contentStatus === 'approved');
  if (approved.length === 0) add(issues, 'error', 'dataset.empty_approved_set', 'questions', '学生可用 approved 集合为空。');
  validateVariantGroups(dataset.questions, issues);
  return { passed: !issues.some((issue) => issue.severity === 'error'), issues };
}

function validateVariantGroups(
  questions: KnowledgeQuestion[],
  issues: KnowledgeQuestionValidationIssue[],
): void {
  const groups = new Map<string, KnowledgeQuestion[]>();
  for (const question of questions) {
    if (!question.variantGroupId) continue;
    groups.set(question.variantGroupId, [...(groups.get(question.variantGroupId) || []), question]);
  }
  for (const [groupId, members] of groups) {
    if (members.length === 1) add(issues, 'warning', 'variant.singleton_group', `variantGroups.${groupId}`, '变式组当前只有一道题。');
    if (new Set(members.map((member) => member.knowledgePoint)).size > 1) add(issues, 'error', 'variant.knowledge_point_mismatch', `variantGroups.${groupId}`, '变式组知识点不一致。');
    if (new Set(members.map((member) => `${member.grade}:${member.semester}`)).size > 1) add(issues, 'error', 'variant.scope_mismatch', `variantGroups.${groupId}`, '变式组年级学期不一致。');
    if (new Set(members.map((member) => member.contentStatus)).size > 1) add(issues, 'warning', 'variant.status_mixed', `variantGroups.${groupId}`, '变式组内容状态混合。');
    const normalizedStems = members.map((member) => member.stem.replace(/\s+/gu, '').trim());
    if (new Set(normalizedStems).size !== normalizedStems.length) add(issues, 'error', 'variant.duplicate_content', `variantGroups.${groupId}`, '变式组存在完全重复题干。');
  }
}
