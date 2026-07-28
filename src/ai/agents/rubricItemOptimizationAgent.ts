import {
  buildRubricItemOptimizationPrompt,
  buildRubricItemOptimizationRepairPrompt,
} from '../prompts/buildRubricItemOptimizationPrompt.ts';
import {
  DiagnosisProviderError,
  type DiagnosisProviderAdapter,
} from '../providers/diagnosisProviderAdapter.ts';
import {
  RUBRIC_ITEM_OPTIMIZATION_VERSION,
  type RubricItemImportance,
  type RubricItemOptimizationInput,
  type RubricItemOptimizationResult,
} from '../schemas/rubricItemOptimization.schema.ts';

const IMPORTANCE_VALUES: RubricItemImportance[] = [
  'critical',
  'important',
  'supporting',
];

export type RubricItemOptimizationConfig = {
  providerName: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxAttempts: number;
};

export function createRubricItemOptimizationConfig(input: {
  providerName: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}): RubricItemOptimizationConfig {
  return {
    providerName: input.providerName,
    model: input.model,
    temperature: input.temperature ?? 0.2,
    maxOutputTokens: input.maxOutputTokens ?? 900,
    timeoutMs: input.timeoutMs ?? 45_000,
    maxAttempts: input.maxAttempts ?? 2,
  };
}

export async function optimizeRubricItem(
  input: RubricItemOptimizationInput,
  dependencies: {
    provider: DiagnosisProviderAdapter;
    config: RubricItemOptimizationConfig;
  },
): Promise<RubricItemOptimizationResult> {
  validateInput(input);
  if (dependencies.provider.providerName !== dependencies.config.providerName) {
    throw new Error('评分项优化服务配置不一致。');
  }

  const originalPrompt = buildRubricItemOptimizationPrompt(input);
  let prompt = originalPrompt;
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
      const parsed = parseJsonObject(response.rawOutput);
      const validated = validateProviderResult(input, parsed);
      if (validated.result) return validated.result;
      lastIssues = validated.issues;
      if (attempt < dependencies.config.maxAttempts) {
        prompt = buildRubricItemOptimizationRepairPrompt({
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
      throw new Error('AI 评分项优化服务暂时不可用，请稍后重试。');
    }
  }

  throw new Error(lastIssues[0] || 'AI 返回的评分项建议无法使用。');
}

function validateInput(input: RubricItemOptimizationInput): void {
  if (!input.requestId?.trim()) throw new Error('评分项优化请求缺少标识。');
  if (!input.material?.materialVersionId?.trim() || !input.material.content?.trim()) {
    throw new Error('请先为题目关联学习材料。');
  }
  if (!input.question?.questionStem?.trim()) throw new Error('请先填写题干。');
  if (!input.rubricItem?.localId?.trim() || !input.rubricItem.name?.trim()) {
    throw new Error('请先填写当前评分项。');
  }
  if (!input.rubricItem.abilityId) throw new Error('请先选择评分项对应能力。');
}

function validateProviderResult(
  input: RubricItemOptimizationInput,
  value: Record<string, unknown> | null,
): { result: RubricItemOptimizationResult | null; issues: string[] } {
  if (!value) return { result: null, issues: ['输出不是合法 JSON。'] };
  const suggestion = objectValue(value.suggestedItem);
  if (!suggestion) return { result: null, issues: ['缺少 suggestedItem。'] };

  const name = stringValue(suggestion.name);
  const importance = stringValue(suggestion.importance) as RubricItemImportance;
  const acceptedSignals = stringArray(suggestion.acceptedSignals);
  const required = booleanValue(suggestion.required);
  const requireTextEvidence = booleanValue(suggestion.requireTextEvidence);
  const requireExplanation = booleanValue(suggestion.requireExplanation);
  const changes = stringArray(value.changes);
  const rationale = stringValue(value.rationale);
  const issues: string[] = [];

  if (name.length < 4 || name.length > 60) issues.push('评分内容应为 4 至 60 个字符。');
  if (!IMPORTANCE_VALUES.includes(importance)) issues.push('判定作用不在允许范围内。');
  if (acceptedSignals.length < 1 || acceptedSignals.length > 8) {
    issues.push('满足本项的答案要点应为 1 至 8 项。');
  }
  if ([required, requireTextEvidence, requireExplanation].some((item) => item === null)) {
    issues.push('评分项判断条件必须使用布尔值。');
  }
  if (!rationale) issues.push('缺少调整理由。');
  if (changes.length < 1 || changes.length > 5) issues.push('调整说明应为 1 至 5 项。');

  const normalizedSuggestion = normalize(JSON.stringify({
    name,
    importance,
    required,
    acceptedSignals,
    requireTextEvidence,
    requireExplanation,
  }));
  const normalizedOriginal = normalize(JSON.stringify({
    name: input.rubricItem.name,
    importance: input.rubricItem.importance,
    required: input.rubricItem.required,
    acceptedSignals: input.rubricItem.acceptedSignals,
    requireTextEvidence: input.rubricItem.requireTextEvidence,
    requireExplanation: input.rubricItem.requireExplanation,
  }));
  if (normalizedSuggestion === normalizedOriginal) {
    issues.push('AI 暂未生成更清晰的评分项，建议保留原内容或稍后重试。');
  }
  const duplicateSibling = (input.siblingRubricItems || []).find((sibling) =>
    isNearDuplicateRubricItem(
      { name, acceptedSignals },
      { name: sibling.name, acceptedSignals: sibling.acceptedSignals },
    ));
  if (duplicateSibling) {
    issues.push(
      `优化结果与其他评分项“${duplicateSibling.name}”判断内容重复，请改为该题尚未覆盖的独立评分维度。`,
    );
  }
  issues.push(...validateMaterialReferences(
    [name, ...acceptedSignals].join('\n'),
    input.material.content,
  ));
  if (issues.length > 0) return { result: null, issues: [...new Set(issues)] };

  return {
    result: {
      originalItem: input.rubricItem,
      suggestedItem: {
        name,
        importance,
        required: required as boolean,
        acceptedSignals,
        requireTextEvidence: requireTextEvidence as boolean,
        requireExplanation: requireExplanation as boolean,
      },
      changes,
      rationale,
      version: RUBRIC_ITEM_OPTIMIZATION_VERSION,
    },
    issues: [],
  };
}

function isNearDuplicateRubricItem(
  candidate: { name: string; acceptedSignals: string[] },
  sibling: { name: string; acceptedSignals: string[] },
): boolean {
  const nameSimilarity = diceSimilarity(candidate.name, sibling.name);
  const signalSimilarity = diceSimilarity(
    candidate.acceptedSignals.join(''),
    sibling.acceptedSignals.join(''),
  );
  return nameSimilarity >= 0.82 ||
    (nameSimilarity >= 0.62 && signalSimilarity >= 0.62) ||
    signalSimilarity >= 0.82;
}

function diceSimilarity(leftValue: string, rightValue: string): number {
  const left = normalizeForSimilarity(leftValue);
  const right = normalizeForSimilarity(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const leftPairs = characterPairs(left);
  const rightPairs = characterPairs(right);
  const rightCounts = new Map<string, number>();
  rightPairs.forEach((pair) => {
    rightCounts.set(pair, (rightCounts.get(pair) || 0) + 1);
  });
  let overlap = 0;
  leftPairs.forEach((pair) => {
    const count = rightCounts.get(pair) || 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(pair, count - 1);
    }
  });
  return (2 * overlap) / (leftPairs.length + rightPairs.length);
}

function normalizeForSimilarity(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s，。；、：:“”‘’"'（）()《》【】[\]!?！？·—_-]/g, '');
}

function characterPairs(value: string): string[] {
  return Array.from({ length: value.length - 1 }, (_, index) =>
    value.slice(index, index + 2));
}

function validateMaterialReferences(value: string, materialContent: string): string[] {
  const issues: string[] = [];
  const paragraphCount = materialContent
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .length;
  [...value.matchAll(/第\s*(\d+)\s*(?:[-—至到]\s*(\d+)\s*)?段/g)].forEach((match) => {
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > paragraphCount) {
      issues.push(`建议引用的段落超出材料范围（材料共 ${paragraphCount} 段）。`);
    }
  });
  [...value.matchAll(/[“‘]([^”’]{2,30})[”’]/g)]
    .map((match) => match[1].trim())
    .filter((quote) => !/[？?！!。；;]/.test(quote))
    .forEach((quote) => {
      if (!materialContent.includes(quote)) {
        issues.push(`建议引用了材料中不存在的文字“${quote}”。`);
      }
    });
  return issues;
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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').replace(/[，。！？；：、“”‘’]/g, '').toLowerCase();
}
