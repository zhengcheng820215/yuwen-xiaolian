import type {
  QuestionStemOptimizationInput,
  QuestionStemOptimizationSuggestionReview,
  QuestionStemOptimizationSuggestionReviewIssue,
} from '../schemas/questionStemOptimization.schema.ts';
import type {
  QuestionQualityCheck,
} from '../schemas/questionQualityAssessment.schema.ts';
import {
  assessMaterialEvidenceBoundary,
} from '../patterns/materialEvidenceBoundary.ts';

const STEM_REVIEWABLE_CHECKS: QuestionQualityCheck[] = [
  'materialGrounding',
  'observationClarity',
  'scopeClarity',
];

export function reviewQuestionStemSuggestion(
  input: QuestionStemOptimizationInput,
  suggestedStem: string,
): QuestionStemOptimizationSuggestionReview {
  const targetChecks = uniqueChecks(
    input.targetChecks?.length
      ? input.targetChecks
      : input.qualityIssues.length
        ? input.qualityIssues.map((issue) => issue.check)
        : STEM_REVIEWABLE_CHECKS,
  );
  const remainingIssues = targetChecks
    .map((check) => reviewCheck(check, suggestedStem, input))
    .filter((issue): issue is QuestionStemOptimizationSuggestionReviewIssue => Boolean(issue));
  const remainingChecks = new Set(remainingIssues.map((issue) => issue.check));

  return {
    status: remainingIssues.length === 0 ? 'improved' : 'needs_attention',
    checkedChecks: targetChecks,
    resolvedChecks: targetChecks.filter((check) => !remainingChecks.has(check)),
    remainingIssues,
  };
}

function reviewCheck(
  check: QuestionQualityCheck,
  stem: string,
  input: QuestionStemOptimizationInput,
): QuestionStemOptimizationSuggestionReviewIssue | null {
  if (check === 'materialGrounding') {
    return reviewMaterialGrounding(stem, input.material.content);
  }
  if (check === 'observationClarity') {
    return reviewObservationClarity(stem);
  }
  if (check === 'scopeClarity') {
    return reviewScopeClarity(stem);
  }

  const upstreamActions: Partial<Record<QuestionQualityCheck, string>> = {
    observationDistinctness: '请与系统列出的对照题比较回答对象、材料依据和评分目标；能力或问法相同不代表重复，只有三项都高度重合时才需要调整。',
    discriminativePower: '请在“评分标准”中补充不同完成水平的观察项与可接受信号。',
    difficultyCoherence: '请检查“难度”“最低作答要求”和“评分标准”的复杂度是否一致。',
    rubricAlignment: '请检查“评分标准”是否覆盖题干要求的材料依据、解释或推理动作。',
  };
  return {
    check,
    message: '这项提醒无法仅通过改写题干完成确认。',
    recommendedAction: upstreamActions[check] || '请人工检查相关字段后重新执行题目检查。',
  };
}

function reviewMaterialGrounding(
  stem: string,
  materialContent: string,
): QuestionStemOptimizationSuggestionReviewIssue | null {
  const boundary = assessMaterialEvidenceBoundary(stem, materialContent);
  if (['local', 'whole_text', 'open_evidence', 'mixed'].includes(boundary.kind)) {
    return null;
  }
  return {
    check: 'materialGrounding',
    message: boundary.kind === 'generic'
      ? '建议题干只写了“结合材料”，尚未说明应依据全文、局部内容还是自主选取证据。'
      : '建议题干仍未说明学生应依据材料的什么范围作答。',
    recommendedAction: '请按考查目标选择一种范围：全文题写明“结合全文”；局部题标明段落、场景、原句或关键词；开放取证题写明证据数量和类型。',
  };
}

function reviewObservationClarity(
  stem: string,
): QuestionStemOptimizationSuggestionReviewIssue | null {
  const normalizedStem = normalizeText(stem);
  const broadOnly = /^(分析|概括|理解|赏析|评价)(人物|文章|内容|主题|形象|作用)?$/.test(normalizedStem);
  const hasObservableAction = /(找出|写出|概括|说明|解释|分析|推断|比较|结合|根据|指出|补充|仿写|表达)/.test(normalizedStem);
  if (hasObservableAction && !broadOnly) return null;
  return {
    check: 'observationClarity',
    message: '建议题干仍未清楚说明学生需要完成什么动作。',
    recommendedAction: '请在“题干”中使用明确动作词，例如“概括”“分析”“说明理由”或“结合材料推断”。',
  };
}

function reviewScopeClarity(
  stem: string,
): QuestionStemOptimizationSuggestionReviewIssue | null {
  const questionCount = (stem.match(/[？?]/g) || []).length;
  const actionCount = (stem.match(/(找出|写出|概括|说明|解释|分析|推断|比较|评价|赏析)/g) || []).length;
  const broadPrompt = /(谈谈你的理解|谈谈你的看法|结合实际|自由发挥|深入分析)/.test(stem);
  if (stem.trim().length <= 180 && questionCount < 3 && actionCount < 4 && !broadPrompt) {
    return null;
  }
  return {
    check: 'scopeClarity',
    message: '建议题干仍包含较宽的作答范围或过多并列任务。',
    recommendedAction: '请在“题干”中缩小材料范围，并只保留一个主要作答动作；必要时将综合要求拆成不同题目。',
  };
}

function uniqueChecks(checks: QuestionQualityCheck[]): QuestionQualityCheck[] {
  return [...new Set(checks)];
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\s，。！？；：、“”‘’（）《》,.!?;:'"()[\]{}]/g, '');
}
