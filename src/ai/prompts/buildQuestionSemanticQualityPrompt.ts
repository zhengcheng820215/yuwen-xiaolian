import type {
  QuestionMaterialVersion,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  QUESTION_QUALITY_CHECKS,
} from '../schemas/questionQualityAssessment.schema.ts';

export function buildQuestionSemanticQualityPrompt(input: {
  draft: StructuredQuestionDraft;
  material: QuestionMaterialVersion;
  promptVersion: string;
  outputSchemaVersion: string;
}): string {
  const payload = {
    material: {
      materialVersionId: input.material.materialVersionId,
      title: input.material.title,
      content: input.material.content,
    },
    question: {
      questionStem: input.draft.questionStem,
      questionType: input.draft.questionType,
      responseFormat: input.draft.responseFormat,
      options: input.draft.options,
      answerAcceptance: input.draft.answerAcceptance,
      rubric: input.draft.rubric,
      minimumAnswerRequirement: input.draft.minimumAnswerRequirement,
      abilityMetadata: input.draft.abilityMetadata,
    },
  };

  return [
    `Prompt Version: ${input.promptVersion}`,
    `Output Schema Version: ${input.outputSchemaVersion}`,
    '你是独立的题目语义质量评估器。',
    '只判断候选题目的材料依据、观察清晰度、观察差异、区分力、难度一致性、Rubric 对齐和范围清晰度。',
    '不要判断具体学生能力，不要形成审核决定，不要改写题目，不要要求自动发布或 Freeze。',
    '你不会获得确定性质量评估结论；请仅依据下面的材料与题目快照独立判断。',
    `必须对以下七项各输出一次：${QUESTION_QUALITY_CHECKS.join(', ')}。`,
    'status 只能是 pass、warning、strong_warning。',
    '每项必须提供具体 reason 和至少一个 evidenceRefs。',
    'evidenceRefs 只能引用：material.title、material.content、draft.questionStem、draft.questionType、draft.responseFormat、draft.options、draft.answerAcceptance、draft.rubric、draft.minimumAnswerRequirement、draft.abilityMetadata。',
    '可以使用“字段:简短摘录”形式，不得编造字段。',
    'suggestedReviewQuestion 只能帮助人工复核，不能包含自动通过、自动发布、冻结、删除或强制改题指令。',
    '只输出合法 JSON，不要 Markdown，不要解释性前后缀。',
    '{"findings":[{"check":"materialGrounding","status":"pass","reason":"...","evidenceRefs":["material.content:..."],"suggestedReviewQuestion":"..."}],"limitations":[]}',
    '输入快照：',
    JSON.stringify(payload),
  ].join('\n');
}

export function buildQuestionSemanticQualityRepairPrompt(input: {
  originalPrompt: string;
  invalidOutput: string;
  outputSchemaVersion: string;
}): string {
  return [
    input.originalPrompt,
    '',
    '上一次输出无法通过结构校验。请仅修复 JSON 结构，不改变原有语义判断。',
    `目标 Schema Version: ${input.outputSchemaVersion}`,
    '仍须包含七项且每项 check 唯一。只输出 JSON。',
    `上一次输出（仅供结构修复）：${input.invalidOutput.slice(0, 4000)}`,
  ].join('\n');
}
