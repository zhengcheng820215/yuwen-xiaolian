import type {
  DiagnosisEstimatedCost,
  DiagnosisProviderErrorCategory,
  DiagnosisTokenUsage,
} from '../schemas/diagnosisRunRecord.schema.ts';

export type DiagnosisProviderRequest = {
  requestId: string;
  attempt: number;
  prompt: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
};

export type DiagnosisProviderResponse = {
  providerRequestId: string;
  rawOutput: string;
  tokenUsage?: DiagnosisTokenUsage;
  latencyMs: number;
  estimatedCost?: DiagnosisEstimatedCost;
};

export type DiagnosisProviderAdapter = {
  readonly providerName: string;
  diagnose(request: DiagnosisProviderRequest): Promise<DiagnosisProviderResponse>;
};

export class DiagnosisProviderError extends Error {
  readonly category: DiagnosisProviderErrorCategory;
  readonly retryable: boolean;
  readonly providerRequestId?: string;

  constructor(input: {
    message: string;
    category: DiagnosisProviderErrorCategory;
    retryable: boolean;
    providerRequestId?: string;
  }) {
    super(input.message);
    this.name = 'DiagnosisProviderError';
    this.category = input.category;
    this.retryable = input.retryable;
    this.providerRequestId = input.providerRequestId;
  }
}

export type ScriptedDiagnosisProviderStep =
  | {
      type: 'response';
      rawOutput: string;
      providerRequestId?: string;
      tokenUsage?: DiagnosisTokenUsage;
      latencyMs?: number;
    }
  | {
      type: 'error';
      category: DiagnosisProviderErrorCategory;
      retryable: boolean;
      message?: string;
      providerRequestId?: string;
    };

export class ScriptedDiagnosisProviderAdapter implements DiagnosisProviderAdapter {
  readonly providerName: string;
  private callCount = 0;
  private readonly requests: DiagnosisProviderRequest[] = [];
  private readonly steps: ScriptedDiagnosisProviderStep[];

  constructor(
    steps: ScriptedDiagnosisProviderStep[],
    providerName = 'scripted_test_provider',
  ) {
    this.steps = steps;
    this.providerName = providerName;
  }

  async diagnose(request: DiagnosisProviderRequest): Promise<DiagnosisProviderResponse> {
    this.requests.push(request);
    const stepIndex = this.callCount;
    this.callCount += 1;
    const step = this.steps[Math.min(stepIndex, this.steps.length - 1)];

    if (!step) {
      throw new DiagnosisProviderError({
        message: 'Scripted provider has no configured response.',
        category: 'provider_unavailable',
        retryable: false,
      });
    }

    if (step.type === 'error') {
      throw new DiagnosisProviderError({
        message: step.message || `Scripted provider error: ${step.category}`,
        category: step.category,
        retryable: step.retryable,
        providerRequestId: step.providerRequestId,
      });
    }

    return {
      providerRequestId: step.providerRequestId || `scripted-request-${stepIndex + 1}`,
      rawOutput: step.rawOutput,
      tokenUsage: step.tokenUsage,
      latencyMs: step.latencyMs ?? 1,
    };
  }

  getCallCount(): number {
    return this.callCount;
  }

  getRequests(): DiagnosisProviderRequest[] {
    return [...this.requests];
  }
}

export type OpenAIResponsesDiagnosisProviderOptions = {
  apiKey: string;
  endpoint?: string;
  providerName?: string;
  costPerMillionInputTokens?: number;
  costPerMillionOutputTokens?: number;
};

export class OpenAIResponsesDiagnosisProvider implements DiagnosisProviderAdapter {
  readonly providerName: string;
  private readonly endpoint: string;
  private readonly options: OpenAIResponsesDiagnosisProviderOptions;

  constructor(options: OpenAIResponsesDiagnosisProviderOptions) {
    if (!options.apiKey.trim()) throw new Error('OpenAI diagnosis provider requires an API key.');
    this.options = options;
    this.providerName = options.providerName || 'openai_responses';
    this.endpoint = options.endpoint || 'https://api.openai.com/v1/responses';
  }

  async diagnose(request: DiagnosisProviderRequest): Promise<DiagnosisProviderResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          input: request.prompt,
          temperature: request.temperature,
          max_output_tokens: request.maxOutputTokens,
          store: false,
        }),
        signal: controller.signal,
      });

      const providerRequestId = response.headers.get('x-request-id') || `openai-${request.requestId}-${request.attempt}`;

      if (!response.ok) {
        throw mapHttpError(response.status, providerRequestId);
      }

      const payload = await response.json() as OpenAIResponsesPayload;
      const rawOutput = extractOpenAIOutput(payload);
      if (!rawOutput.trim()) {
        throw new DiagnosisProviderError({
          message: 'Provider returned an empty diagnosis output.',
          category: 'malformed_output',
          retryable: true,
          providerRequestId,
        });
      }

      const tokenUsage = mapTokenUsage(payload.usage);
      return {
        providerRequestId: payload.id || providerRequestId,
        rawOutput,
        tokenUsage,
        latencyMs: Date.now() - startedAt,
        estimatedCost: estimateCost(tokenUsage, this.options),
      };
    } catch (error) {
      if (error instanceof DiagnosisProviderError) throw error;
      if (isAbortError(error)) {
        throw new DiagnosisProviderError({
          message: 'Diagnosis provider request timed out.',
          category: 'timeout',
          retryable: true,
        });
      }
      throw new DiagnosisProviderError({
        message: 'Diagnosis provider network request failed.',
        category: 'network_error',
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type DeepSeekChatDiagnosisProviderOptions = {
  apiKey: string;
  endpoint?: string;
  providerName?: string;
  costPerMillionInputTokens?: number;
  costPerMillionOutputTokens?: number;
};

export class DeepSeekChatDiagnosisProvider implements DiagnosisProviderAdapter {
  readonly providerName: string;
  private readonly endpoint: string;
  private readonly options: DeepSeekChatDiagnosisProviderOptions;

  constructor(options: DeepSeekChatDiagnosisProviderOptions) {
    if (!options.apiKey.trim()) throw new Error('DeepSeek diagnosis provider requires an API key.');
    this.options = options;
    this.providerName = options.providerName || 'deepseek_chat';
    this.endpoint = options.endpoint || 'https://api.deepseek.com/chat/completions';
  }

  async diagnose(request: DiagnosisProviderRequest): Promise<DiagnosisProviderResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: 'user', content: request.prompt }],
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          stream: false,
          thinking: { type: 'disabled' },
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      const providerRequestId = response.headers.get('x-request-id') ||
        `deepseek-${request.requestId}-${request.attempt}`;

      if (!response.ok) {
        throw mapHttpError(response.status, providerRequestId);
      }

      const payload = await response.json() as DeepSeekChatCompletionPayload;
      const rawOutput = payload.choices?.[0]?.message?.content || '';
      if (!rawOutput.trim()) {
        throw new DiagnosisProviderError({
          message: 'Provider returned an empty diagnosis output.',
          category: 'malformed_output',
          retryable: true,
          providerRequestId,
        });
      }

      const tokenUsage = mapDeepSeekTokenUsage(payload.usage);
      return {
        providerRequestId: payload.id || providerRequestId,
        rawOutput,
        tokenUsage,
        latencyMs: Date.now() - startedAt,
        estimatedCost: estimateCost(tokenUsage, this.options),
      };
    } catch (error) {
      if (error instanceof DiagnosisProviderError) throw error;
      if (isAbortError(error)) {
        throw new DiagnosisProviderError({
          message: 'Diagnosis provider request timed out.',
          category: 'timeout',
          retryable: true,
        });
      }
      throw new DiagnosisProviderError({
        message: 'Diagnosis provider network request failed.',
        category: 'network_error',
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

type OpenAIResponsesPayload = {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

type DeepSeekChatCompletionPayload = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function mapHttpError(status: number, providerRequestId: string): DiagnosisProviderError {
  if (status === 401 || status === 403) {
    return new DiagnosisProviderError({
      message: 'Diagnosis provider authentication failed.',
      category: 'authentication_failed',
      retryable: false,
      providerRequestId,
    });
  }
  if (status === 402) {
    return new DiagnosisProviderError({
      message: 'Diagnosis provider account has insufficient balance.',
      category: 'provider_unavailable',
      retryable: false,
      providerRequestId,
    });
  }
  if (status === 429) {
    return new DiagnosisProviderError({
      message: 'Diagnosis provider rate limit exceeded.',
      category: 'rate_limit',
      retryable: true,
      providerRequestId,
    });
  }
  if (status >= 500) {
    return new DiagnosisProviderError({
      message: 'Diagnosis provider is temporarily unavailable.',
      category: 'provider_unavailable',
      retryable: true,
      providerRequestId,
    });
  }
  return new DiagnosisProviderError({
    message: `Diagnosis provider rejected the request with status ${status}.`,
    category: 'unknown',
    retryable: false,
    providerRequestId,
  });
}

function extractOpenAIOutput(payload: OpenAIResponsesPayload): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || '')
    .filter(Boolean)
    .join('\n');
}

function mapTokenUsage(usage: OpenAIResponsesPayload['usage']): DiagnosisTokenUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
  };
}

function mapDeepSeekTokenUsage(
  usage: DeepSeekChatCompletionPayload['usage'],
): DiagnosisTokenUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
  };
}

function estimateCost(
  usage: DiagnosisTokenUsage | undefined,
  options: OpenAIResponsesDiagnosisProviderOptions | DeepSeekChatDiagnosisProviderOptions,
): DiagnosisEstimatedCost | undefined {
  if (!usage) return undefined;
  if (options.costPerMillionInputTokens === undefined || options.costPerMillionOutputTokens === undefined) {
    return undefined;
  }
  return {
    amount: (
      usage.inputTokens * options.costPerMillionInputTokens +
      usage.outputTokens * options.costPerMillionOutputTokens
    ) / 1_000_000,
    currency: 'USD',
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
