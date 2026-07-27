import {
  buildQuestionStemOptimizationPrompt,
  buildQuestionStemOptimizationRepairPrompt,
} from '../prompts/buildQuestionStemOptimizationPrompt.ts';
import {
  DiagnosisProviderError,
  type DiagnosisProviderAdapter,
} from '../providers/diagnosisProviderAdapter.ts';
import {
  QUESTION_STEM_OPTIMIZATION_VERSION,
  type QuestionStemOptimizationInput,
  type QuestionStemOptimizationResult,
} from '../schemas/questionStemOptimization.schema.ts';
import {
  QUESTION_QUALITY_CHECKS,
  type QuestionQualityCheck,
} from '../schemas/questionQualityAssessment.schema.ts';
import { reviewQuestionStemSuggestion } from './questionStemSuggestionReview.ts';

export type QuestionStemOptimizationConfig = {
  providerName: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxAttempts: number;
};

export function createQuestionStemOptimizationConfig(input: {
  providerName: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}): QuestionStemOptimizationConfig {
  return {
    providerName: input.providerName,
    model: input.model,
    temperature: input.temperature ?? 0.2,
    maxOutputTokens: input.maxOutputTokens ?? 900,
    timeoutMs: input.timeoutMs ?? 45_000,
    maxAttempts: input.maxAttempts ?? 2,
  };
}

export async function optimizeQuestionStem(
  input: QuestionStemOptimizationInput,
  dependencies: {
    provider: DiagnosisProviderAdapter;
    config: QuestionStemOptimizationConfig;
  },
): Promise<QuestionStemOptimizationResult> {
  validateInput(input);
  if (dependencies.provider.providerName !== dependencies.config.providerName) {
    throw new Error('题干优化服务配置不一致。');
  }

  const originalPrompt = buildQuestionStemOptimizationPrompt(input);
  let prompt = originalPrompt;
  let lastOutput = '';
  let lastIssues = ['AI 返回内容无法使用。'];

  for (let attempt = 1; attempt <= dependencies.config.maxAttempts; attempt += 1) {
    try {
      const response = await dependencies.provider.diagnose({
        requestId: input.requestId,
        attempt,
        prompt,
        model: dependencies.config.model,
        temperature: attempt === 1 ? dependencies.config.temperature : 0,
        maxOutputTokens: dependencies.config.maxOutputTokens,
        timeoutMs: dependencies.config.timeoutMs,
      });
      lastOutput = response.rawOutput;
      const parsed = parseJsonObject(response.rawOutput);
      const validated = validateProviderResult(input, parsed);
      if (validated.result) return validated.result;
      lastIssues = validated.issues;
      if (attempt < dependencies.config.maxAttempts) {
        prompt = buildQuestionStemOptimizationRepairPrompt({
          originalPrompt,
          invalidOutput: response.rawOutput,
          issues: validated.issues,
        });
      }
    } catch (error) {
      if (
        error instanceof DiagnosisProviderError &&
        error.retryable &&
        attempt < dependencies.config.maxAttempts
      ) {
        continue;
      }
      throw new Error('AI 题干优化服务暂时不可用，请稍后重试。');
    }
  }

  void lastOutput;
  throw new Error(lastIssues[0] || 'AI 返回的题干建议无法使用。');
}

function validateInput(input: QuestionStemOptimizationInput): void {
  if (!input.requestId?.trim()) throw new Error('题干优化请求缺少标识。');
  if (!input.material?.materialVersionId?.trim() || !input.material.content?.trim()) {
    throw new Error('请先为题目关联学习材料。');
  }
  if (!input.question?.questionStem?.trim()) throw new Error('请先填写题干。');
  if (!input.question.observationFocus?.trim()) throw new Error('请先填写训练重点。');
  if (!input.question.abilityId || !input.question.difficulty) {
    throw new Error('请先完善训练能力和难度。');
  }
}

function validateProviderResult(
  input: QuestionStemOptimizationInput,
  value: Record<string, unknown> | null,
): { result: QuestionStemOptimizationResult | null; issues: string[] } {
  const issues: string[] = [];
  if (!value) return { result: null, issues: ['输出不是合法 JSON。'] };

  const suggestedStem = stringValue(value.suggestedStem);
  const rationale = stringValue(value.rationale);
  const changes = stringArray(value.changes);
  const addressedChecks = stringArray(value.addressedChecks)
    .filter((check): check is QuestionQualityCheck => (
      QUESTION_QUALITY_CHECKS.includes(check as QuestionQualityCheck)
    ));

  if (suggestedStem.length < 8) issues.push('建议题干过短。');
  if (suggestedStem.length > 500) issues.push('建议题干过长。');
  if (normalize(suggestedStem) === normalize(input.question.questionStem)) {
    issues.push('AI 暂未生成更合适的表述，建议保留原题干或稍后重试。');
  }
  if (!rationale) issues.push('缺少调整理由。');
  if (changes.length === 0) issues.push('缺少调整说明。');
  if (changes.length > 5) issues.push('调整说明过多。');
  issues.push(...validateMaterialReferences(suggestedStem, input.material.content));
  if (issues.length > 0) return { result: null, issues };

  return {
    result: {
      originalStem: input.question.questionStem.trim(),
      suggestedStem,
      changes,
      rationale,
      addressedChecks,
      suggestionReview: reviewQuestionStemSuggestion(input, suggestedStem),
      version: QUESTION_STEM_OPTIMIZATION_VERSION,
    },
    issues: [],
  };
}

function validateMaterialReferences(stem: string, materialContent: string): string[] {
  const issues: string[] = [];
  const paragraphCount = materialContent
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .length;
  const paragraphRefs = [...stem.matchAll(/第\s*(\d+)\s*(?:[-—至到]\s*(\d+)\s*)?段/g)];
  paragraphRefs.forEach((match) => {
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > paragraphCount) {
      issues.push(`题干引用的段落超出材料范围（材料共 ${paragraphCount} 段）。`);
    }
  });

  const quotedAnchors = [...stem.matchAll(/[“‘]([^”’]{2,30})[”’]/g)]
    .map((match) => match[1].trim())
    .filter((quote) => !/[？?！!。；;]/.test(quote));
  quotedAnchors.forEach((quote) => {
    if (!materialContent.includes(quote)) {
      issues.push(`题干引用了材料中不存在的文字“${quote}”。`);
    }
  });
  return [...new Set(issues)];
}

function parseJsonObject(rawOutput: string): Record<string, unknown> | null {
  const withoutFence = rawOutput.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const candidates = [withoutFence];
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(withoutFence.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next isolated JSON candidate.
    }
  }
  return null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').replace(/[，。！？；：、“”‘’]/g, '').toLowerCase();
}
