import {
  buildQuestionCandidateOptimizationPrompt,
  QUESTION_CANDIDATE_OPTIMIZATION_PROMPT_VERSION,
} from '../prompts/buildQuestionCandidateOptimizationPrompt.ts';
import {
  DiagnosisProviderError,
  type DiagnosisProviderAdapter,
} from '../providers/diagnosisProviderAdapter.ts';
import {
  candidateFieldChanged,
  type CandidateFieldKey,
} from '../schemas/questionCandidate.schema.ts';
import {
  parseQuestionCandidateOptimizationOutput,
  QuestionCandidateOptimizationError,
  resolveCandidateOptimizationFieldPolicy,
  type CandidateOptimizationGoal,
} from '../schemas/questionCandidateOptimization.schema.ts';
import type {
  GeneratedQuestionCandidate,
  QuestionCandidateGenerator,
} from './questionCandidateService.ts';

export type QuestionCandidateOptimizationAgentConfig = {
  providerName: string;
  model: string;
  ruleVersion: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
};

export function createQuestionCandidateOptimizationAgentConfig(input: {
  providerName: string;
  model: string;
  ruleVersion: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): QuestionCandidateOptimizationAgentConfig {
  return {
    providerName: input.providerName,
    model: input.model,
    ruleVersion: input.ruleVersion,
    temperature: input.temperature ?? 0.2,
    maxOutputTokens: input.maxOutputTokens ?? 4_000,
    timeoutMs: input.timeoutMs ?? 45_000,
  };
}

export class QuestionCandidateOptimizationAgent implements QuestionCandidateGenerator {
  private readonly provider: DiagnosisProviderAdapter;
  private readonly config: QuestionCandidateOptimizationAgentConfig;
  private readonly now: () => string;

  constructor(
    provider: DiagnosisProviderAdapter,
    config: QuestionCandidateOptimizationAgentConfig,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.provider = provider;
    this.config = config;
    this.now = now;
  }

  async generate(input: Parameters<QuestionCandidateGenerator['generate']>[0]): Promise<GeneratedQuestionCandidate[]> {
    if (input.operation !== 'optimize' || !input.baseCandidate || input.count !== 1) {
      throw new QuestionCandidateOptimizationError(
        'CANDIDATE_AGENT_INVALID_OPERATION',
        'QuestionCandidateOptimizationAgent only supports one optimization candidate.',
      );
    }
    if (this.provider.providerName !== this.config.providerName) {
      throw new QuestionCandidateOptimizationError(
        'CANDIDATE_AGENT_FAILED',
        'Optimization Agent provider configuration does not match the active provider.',
      );
    }
    const policy = resolveCandidateOptimizationFieldPolicy(
      input.goals as CandidateOptimizationGoal[],
    );
    assertSameFields(policy.allowedFields, input.allowedFields, 'allowedFields');
    assertSameFields(policy.lockedFields, input.lockedFields, 'lockedFields');
    const prompt = buildQuestionCandidateOptimizationPrompt({
      baseCandidate: input.baseCandidate,
      policy,
      reasonCodes: input.reasonCodes,
    });

    try {
      const response = await this.provider.diagnose({
        requestId: `candidate-optimize:${input.idempotencyKey}`,
        attempt: 1,
        prompt,
        model: this.config.model,
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxOutputTokens,
        timeoutMs: this.config.timeoutMs,
      });
      const output = parseQuestionCandidateOptimizationOutput(
        response.rawOutput,
        input.baseCandidate.content,
      );
      validateDeclaredDiff(
        input.baseCandidate.content,
        output.content,
        output.changedFields,
        output.changeSummary,
      );
      return [{
        content: output.content,
        generationReason: formatGenerationReason(output.reason, output.changeSummary),
        changedFields: output.changedFields,
        generationContext: {
          modelId: this.config.model,
          promptVersion: QUESTION_CANDIDATE_OPTIMIZATION_PROMPT_VERSION,
          promptHash: hashText(prompt),
          ruleVersion: this.config.ruleVersion,
          materialVersionId: input.context.materialVersionId,
          observationPlanVersion: input.context.observationPlanVersion,
          trainingTaskVersion: input.context.trainingTaskVersion,
          generatedAt: this.now(),
        },
      }];
    } catch (error) {
      if (error instanceof QuestionCandidateOptimizationError) throw error;
      if (error instanceof DiagnosisProviderError) {
        if (error.category === 'timeout') {
          throw new QuestionCandidateOptimizationError(
            'CANDIDATE_AGENT_TIMEOUT',
            'Optimization Agent request timed out.',
            true,
          );
        }
        if (error.category === 'malformed_output' || error.category === 'schema_invalid') {
          throw new QuestionCandidateOptimizationError(
            'CANDIDATE_AGENT_INVALID_OUTPUT',
            error.message,
            error.retryable,
          );
        }
        throw new QuestionCandidateOptimizationError(
          'CANDIDATE_AGENT_FAILED',
          error.message,
          error.retryable,
        );
      }
      throw new QuestionCandidateOptimizationError(
        'CANDIDATE_AGENT_FAILED',
        error instanceof Error ? error.message : 'Optimization Agent failed.',
        true,
      );
    }
  }
}

function validateDeclaredDiff(
  base: Parameters<typeof candidateFieldChanged>[0],
  content: Parameters<typeof candidateFieldChanged>[1],
  changedFields: CandidateFieldKey[],
  summaries: Array<{ field: CandidateFieldKey; summary: string }>,
): void {
  const actual = allFields().filter((field) => candidateFieldChanged(base, content, field));
  const summaryFields = [...new Set(summaries.map((item) => item.field))];
  if (
    JSON.stringify([...new Set(changedFields)].sort()) !== JSON.stringify(actual.sort()) ||
    JSON.stringify(summaryFields.sort()) !== JSON.stringify(actual.sort())
  ) {
    throw new QuestionCandidateOptimizationError(
      'CANDIDATE_AGENT_INVALID_OUTPUT',
      'Optimization Agent changedFields or changeSummary does not match the actual diff.',
      true,
    );
  }
}

function allFields(): CandidateFieldKey[] {
  return [
    'abilityTarget', 'specificTrainingPoint', 'questionStem', 'studentTask',
    'observationTarget', 'answerAcceptance', 'rubric', 'materialScope',
  ];
}

function assertSameFields(
  expected: CandidateFieldKey[],
  actual: CandidateFieldKey[],
  field: string,
): void {
  if (JSON.stringify([...expected].sort()) !== JSON.stringify([...new Set(actual)].sort())) {
    throw new QuestionCandidateOptimizationError(
      'CANDIDATE_FIELD_POLICY_CONFLICT',
      `${field} does not match the optimization goal policy.`,
    );
  }
}

function formatGenerationReason(
  reason: string,
  summaries: Array<{ field: CandidateFieldKey; summary: string }>,
): string {
  return `${reason}\n${summaries.map((item) => `${item.field}: ${item.summary}`).join('\n')}`;
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
