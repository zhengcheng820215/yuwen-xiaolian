import {
  DEFAULT_REAL_AI_DIAGNOSIS_PROMPT_VERSION,
  buildVersionedRealAIDiagnosisPrompt,
  isSupportedRealAIDiagnosisPromptVersion,
} from '../prompts/realAIDiagnosisPromptRegistry.ts';
import type {
  FormalDiagnosisCommitWriteResult,
  FormalDiagnosisRepository,
} from '../repositories/formalDiagnosisRepository.ts';
import {
  DIAGNOSIS_ERROR_TYPES,
  DIAGNOSIS_RESULT_FIELDS,
  normalizeDiagnosisResult,
  type DiagnosisInput,
  type DiagnosisResult,
} from '../schemas/diagnosis.schema.ts';
import {
  DIAGNOSIS_REPAIR_POLICY_VERSION,
  DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
  FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
  isDiagnosisProviderConfigSnapshot,
  type DiagnosisEstimatedCost,
  type DiagnosisExecutionMode,
  type DiagnosisProviderConfigSnapshot,
  type DiagnosisProviderErrorCategory,
  type DiagnosisRepairOperation,
  type DiagnosisRunRecord,
  type DiagnosisTokenUsage,
  type FormalDiagnosisCommit,
  type RealLLMDiagnosisRuntimeResult,
} from '../schemas/diagnosisRunRecord.schema.ts';
import {
  isConcreteLearningTask,
  type ConcreteLearningTask,
} from '../schemas/concreteLearningTask.schema.ts';
import {
  isTaskExecutionResult,
  type TaskExecutionResult,
} from '../schemas/taskExecution.schema.ts';
import {
  DiagnosisProviderError,
  type DiagnosisProviderAdapter,
} from '../providers/diagnosisProviderAdapter.ts';

const DEFAULT_DIAGNOSIS_SCHEMA_VERSION = 'diagnosis_result_v1';

export type RealLLMRuntimeFoundationInput = {
  concreteTask: ConcreteLearningTask;
  taskExecutionResult: TaskExecutionResult;
  executionMode: DiagnosisExecutionMode;
  requestId?: string;
  providerConfig: DiagnosisProviderConfigSnapshot;
  commitOnSuccess?: boolean;
  evidenceReturnAlreadyCompleted?: boolean;
  startedAt?: string;
};

export type RealLLMRuntimeFoundationDependencies = {
  provider: DiagnosisProviderAdapter;
  formalDiagnosisRepository: FormalDiagnosisRepository;
  now?: () => string;
};

type CandidateProcessingResult = {
  candidate?: DiagnosisResult;
  repairOperations: DiagnosisRepairOperation[];
  schemaValid: boolean;
  identityAligned: boolean;
  semanticBoundaryPassed: boolean;
  promptLeakagePassed: boolean;
  errorCategory?: DiagnosisProviderErrorCategory;
  retryable: boolean;
  issues: string[];
};

export function createDiagnosisProviderConfigSnapshot(input: {
  provider: string;
  model: string;
  createdAt?: string;
  providerConfigId?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  promptVersion?: string;
  diagnosisSchemaVersion?: string;
}): DiagnosisProviderConfigSnapshot {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    providerConfigId: input.providerConfigId || `diagnosis-provider-${sanitizeId(input.provider)}-${sanitizeId(input.model)}`,
    provider: input.provider,
    model: input.model,
    temperature: input.temperature ?? 0.2,
    maxOutputTokens: input.maxOutputTokens ?? 1600,
    timeoutMs: input.timeoutMs ?? 20_000,
    maxAttempts: input.maxAttempts ?? 2,
    promptVersion: input.promptVersion || DEFAULT_REAL_AI_DIAGNOSIS_PROMPT_VERSION,
    diagnosisSchemaVersion: input.diagnosisSchemaVersion || DEFAULT_DIAGNOSIS_SCHEMA_VERSION,
    repairPolicyVersion: DIAGNOSIS_REPAIR_POLICY_VERSION,
    createdAt,
  };
}

export async function runRealLLMRuntimeFoundation(
  input: RealLLMRuntimeFoundationInput,
  dependencies: RealLLMRuntimeFoundationDependencies,
): Promise<RealLLMDiagnosisRuntimeResult> {
  const now = dependencies.now || (() => new Date().toISOString());
  const startedAt = input.startedAt || now();
  const requestId = input.requestId || buildRequestId(input.taskExecutionResult);
  const runId = `diagnosis-run-${sanitizeId(requestId)}`;
  const baseRecord = buildBaseRunRecord(input, requestId, runId, startedAt);
  const inputIssues = validateRuntimeInput(input, dependencies.provider);

  if (inputIssues.length > 0) {
    return buildBlockedResult({
      requestId,
      runRecord: {
        ...baseRecord,
        status: 'input_blocked',
        issues: inputIssues,
        completedAt: now(),
      },
      status: 'blocked',
      formalizationStatus: 'blocked',
      issues: inputIssues,
    });
  }

  const existingCommit = input.executionMode === 'live'
    ? await dependencies.formalDiagnosisRepository.getByRequestId(requestId)
    : null;
  if (existingCommit?.status === 'committed' && existingCommit.diagnosisResult) {
    const evidenceReturnIssue = input.evidenceReturnAlreadyCompleted
      ? ['This requestId has already completed Evidence Return.']
      : [];
    return {
      requestId,
      runRecord: {
        ...baseRecord,
        status: 'formal_result_committed',
        attemptCount: 0,
        issues: ['Existing Formal Diagnosis Commit was reused.', ...evidenceReturnIssue],
        completedAt: now(),
      },
      status: 'formal_result_committed',
      diagnosisCandidate: existingCommit.diagnosisResult,
      formalizationStatus: 'committed',
      formalDiagnosisCommit: existingCommit,
      canEnterEvidenceReturn: !input.evidenceReturnAlreadyCompleted,
      validation: {
        passed: true,
        schemaValid: true,
        identityAligned: true,
        semanticBoundaryPassed: true,
        promptLeakagePassed: true,
        issues: evidenceReturnIssue,
      },
    };
  }

  const response = input.taskExecutionResult.studentResponse!;
  const diagnosisInput: DiagnosisInput = {
    question: buildQuestion(input.concreteTask),
    referenceAnswer: buildAssessmentBasis(input.concreteTask),
    studentAnswer: response.answerText,
    questionMetadata: input.concreteTask.questionMetadata,
  };
  const prompt = buildVersionedRealAIDiagnosisPrompt(
    diagnosisInput,
    input.providerConfig.promptVersion as Parameters<typeof buildVersionedRealAIDiagnosisPrompt>[1],
  );
  const providerRequestIds: string[] = [];
  const repairOperations: DiagnosisRepairOperation[] = [];
  const usage = emptyUsage();
  let totalLatencyMs = 0;
  let totalCost: DiagnosisEstimatedCost | undefined;
  let lastRawOutputRef: string | undefined;
  let lastCategory: DiagnosisProviderErrorCategory | undefined;
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= input.providerConfig.maxAttempts; attempt += 1) {
    try {
      const providerResponse = await dependencies.provider.diagnose({
        requestId,
        attempt,
        prompt,
        model: input.providerConfig.model,
        temperature: input.providerConfig.temperature,
        maxOutputTokens: input.providerConfig.maxOutputTokens,
        timeoutMs: input.providerConfig.timeoutMs,
      });
      providerRequestIds.push(providerResponse.providerRequestId);
      mergeUsage(usage, providerResponse.tokenUsage);
      totalLatencyMs += providerResponse.latencyMs;
      totalCost = mergeCost(totalCost, providerResponse.estimatedCost);
      lastRawOutputRef = buildRawOutputRef(requestId, attempt, providerResponse.rawOutput);

      const processed = processDiagnosisCandidate(
        providerResponse.rawOutput,
        input.concreteTask.targetAbilityId,
      );
      repairOperations.push(...processed.repairOperations);
      lastCategory = processed.errorCategory;
      lastIssues = processed.issues;

      if (!processed.candidate) {
        if (processed.retryable && attempt < input.providerConfig.maxAttempts) continue;
        return buildProcessingFailureResult({
          input,
          requestId,
          runId,
          startedAt,
          completedAt: now(),
          attemptCount: attempt,
          providerRequestIds,
          repairOperations,
          usage,
          totalLatencyMs,
          totalCost,
          rawOutputRef: lastRawOutputRef,
          processed,
        });
      }

      if (
        !processed.schemaValid ||
        !processed.identityAligned ||
        !processed.semanticBoundaryPassed ||
        !processed.promptLeakagePassed
      ) {
        return buildProcessingFailureResult({
          input,
          requestId,
          runId,
          startedAt,
          completedAt: now(),
          attemptCount: attempt,
          providerRequestIds,
          repairOperations,
          usage,
          totalLatencyMs,
          totalCost,
          rawOutputRef: lastRawOutputRef,
          processed,
        });
      }

      const candidateRecord: DiagnosisRunRecord = {
        ...baseRecord,
        status: input.executionMode === 'shadow' ? 'shadow_result_ready' : 'candidate_ready',
        providerRequestIds,
        attemptCount: attempt,
        repairOperations,
        tokenUsage: hasUsage(usage) ? usage : undefined,
        latencyMs: totalLatencyMs,
        estimatedCost: totalCost,
        rawOutputRef: lastRawOutputRef,
        issues: processed.issues,
        completedAt: now(),
      };

      if (input.executionMode === 'shadow') {
        return {
          requestId,
          runRecord: candidateRecord,
          status: 'shadow_result_ready',
          diagnosisCandidate: processed.candidate,
          formalizationStatus: 'candidate',
          canEnterEvidenceReturn: false,
          validation: buildValidation(processed, true),
        };
      }

      if (input.commitOnSuccess === false) {
        return {
          requestId,
          runRecord: candidateRecord,
          status: 'candidate_ready',
          diagnosisCandidate: processed.candidate,
          formalizationStatus: 'candidate',
          canEnterEvidenceReturn: false,
          validation: buildValidation(processed, true),
        };
      }

      const commitResult = await commitFormalDiagnosis({
        requestId,
        runId,
        diagnosisCandidate: processed.candidate,
        committedAt: now(),
        repository: dependencies.formalDiagnosisRepository,
      });

      if (commitResult.status === 'conflict') {
        const conflictIssues = [...processed.issues, ...commitResult.issues];
        return {
          requestId,
          runRecord: {
            ...candidateRecord,
            status: 'review_required',
            issues: conflictIssues,
          },
          status: 'review_required',
          diagnosisCandidate: processed.candidate,
          formalizationStatus: 'review_required',
          formalDiagnosisCommit: commitResult.commit,
          canEnterEvidenceReturn: false,
          validation: {
            ...buildValidation(processed, false),
            issues: conflictIssues,
          },
        };
      }

      const canEnterEvidenceReturn = !input.evidenceReturnAlreadyCompleted;
      const commitIssues = input.evidenceReturnAlreadyCompleted
        ? ['This requestId has already completed Evidence Return.']
        : [];
      return {
        requestId,
        runRecord: {
          ...candidateRecord,
          status: 'formal_result_committed',
          issues: [...candidateRecord.issues, ...commitIssues],
        },
        status: 'formal_result_committed',
        diagnosisCandidate: commitResult.commit.diagnosisResult,
        formalizationStatus: 'committed',
        formalDiagnosisCommit: commitResult.commit,
        canEnterEvidenceReturn,
        validation: {
          ...buildValidation(processed, true),
          issues: [...processed.issues, ...commitIssues],
        },
      };
    } catch (error) {
      const providerError = normalizeProviderError(error);
      if (providerError.providerRequestId) providerRequestIds.push(providerError.providerRequestId);
      lastCategory = providerError.category;
      lastIssues = [providerError.message];
      if (providerError.retryable && attempt < input.providerConfig.maxAttempts) continue;

      const exhausted = providerError.retryable && attempt >= input.providerConfig.maxAttempts;
      const errorCategory = exhausted ? 'retry_exhausted' : providerError.category;
      return buildBlockedResult({
        requestId,
        runRecord: {
          ...baseRecord,
          status: exhausted ? 'retry_exhausted' : 'provider_failed',
          providerRequestIds,
          attemptCount: attempt,
          repairOperations,
          tokenUsage: hasUsage(usage) ? usage : undefined,
          latencyMs: totalLatencyMs || undefined,
          estimatedCost: totalCost,
          rawOutputRef: lastRawOutputRef,
          errorCategory,
          issues: lastIssues,
          completedAt: now(),
        },
        status: 'failed',
        formalizationStatus: 'blocked',
        issues: lastIssues,
      });
    }
  }

  return buildBlockedResult({
    requestId,
    runRecord: {
      ...baseRecord,
      status: 'retry_exhausted',
      providerRequestIds,
      attemptCount: input.providerConfig.maxAttempts,
      repairOperations,
      errorCategory: lastCategory || 'retry_exhausted',
      issues: lastIssues.length ? lastIssues : ['Diagnosis retry attempts were exhausted.'],
      completedAt: now(),
    },
    status: 'failed',
    formalizationStatus: 'blocked',
    issues: lastIssues,
  });
}

export async function commitFormalDiagnosis(input: {
  requestId: string;
  runId: string;
  diagnosisCandidate: DiagnosisResult;
  committedAt: string;
  repository: FormalDiagnosisRepository;
}): Promise<FormalDiagnosisCommitWriteResult> {
  const candidate: FormalDiagnosisCommit = {
    schemaVersion: FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
    formalDiagnosisId: `formal-diagnosis-${sanitizeId(input.requestId)}`,
    requestId: input.requestId,
    runId: input.runId,
    status: 'committed',
    diagnosisResult: input.diagnosisCandidate,
    committedAt: input.committedAt,
    validation: {
      passed: true,
      issues: [],
    },
  };
  return input.repository.commit(candidate);
}

function processDiagnosisCandidate(rawOutput: string, expectedAbility: string): CandidateProcessingResult {
  const parsed = parseDiagnosisOutput(rawOutput);
  if (!parsed.value) {
    return {
      repairOperations: parsed.repairOperations,
      schemaValid: false,
      identityAligned: false,
      semanticBoundaryPassed: false,
      promptLeakagePassed: true,
      errorCategory: 'malformed_output',
      retryable: true,
      issues: parsed.issues,
    };
  }

  const repaired = applyWhitelistedRepairs(parsed.value, parsed.repairOperations);
  const promptLeakageIssues = findPromptLeakageIssues(repaired.value);
  if (promptLeakageIssues.length > 0) {
    return {
      repairOperations: repaired.repairOperations,
      schemaValid: false,
      identityAligned: false,
      semanticBoundaryPassed: false,
      promptLeakagePassed: false,
      errorCategory: 'unsafe_output',
      retryable: false,
      issues: promptLeakageIssues,
    };
  }

  const schemaIssues = validateStrictDiagnosisResult(repaired.value);
  if (schemaIssues.length > 0) {
    return {
      repairOperations: repaired.repairOperations,
      schemaValid: false,
      identityAligned: false,
      semanticBoundaryPassed: false,
      promptLeakagePassed: true,
      errorCategory: 'schema_invalid',
      retryable: true,
      issues: schemaIssues,
    };
  }

  const candidate = normalizeDiagnosisResult(repaired.value as Partial<DiagnosisResult>);
  if (candidate.mainAbility !== expectedAbility) {
    return {
      candidate,
      repairOperations: repaired.repairOperations,
      schemaValid: true,
      identityAligned: false,
      semanticBoundaryPassed: false,
      promptLeakagePassed: true,
      errorCategory: 'identity_mismatch',
      retryable: false,
      issues: [`Diagnosis mainAbility=${candidate.mainAbility} does not match targetAbility=${expectedAbility}.`],
    };
  }

  const boundaryIssues = findSemanticBoundaryIssues(candidate);
  if (boundaryIssues.length > 0) {
    return {
      candidate,
      repairOperations: repaired.repairOperations,
      schemaValid: true,
      identityAligned: true,
      semanticBoundaryPassed: false,
      promptLeakagePassed: true,
      errorCategory: 'semantic_boundary_violation',
      retryable: false,
      issues: boundaryIssues,
    };
  }

  return {
    candidate,
    repairOperations: repaired.repairOperations,
    schemaValid: true,
    identityAligned: true,
    semanticBoundaryPassed: true,
    promptLeakagePassed: true,
    retryable: false,
    issues: [],
  };
}

function parseDiagnosisOutput(rawOutput: string): {
  value?: Record<string, unknown>;
  repairOperations: DiagnosisRepairOperation[];
  issues: string[];
} {
  const operations: DiagnosisRepairOperation[] = [];
  let source = rawOutput.trim();

  if (/^```(?:json)?\s*/i.test(source) && /```\s*$/.test(source)) {
    source = source.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    operations.push({ field: '$', operation: 'remove_markdown_code_fence', semanticField: false });
  }

  try {
    const value = JSON.parse(source) as unknown;
    return isRecord(value)
      ? { value, repairOperations: operations, issues: [] }
      : { repairOperations: operations, issues: ['Diagnosis output must be a JSON object.'] };
  } catch {
    const objects = extractTopLevelJsonObjects(source);
    if (objects.length !== 1) {
      return {
        repairOperations: operations,
        issues: [objects.length > 1
          ? 'Diagnosis output contains multiple JSON objects.'
          : 'Diagnosis output is not valid JSON.'],
      };
    }
    try {
      const value = JSON.parse(objects[0]) as unknown;
      if (!isRecord(value)) return { repairOperations: operations, issues: ['Diagnosis JSON must be an object.'] };
      operations.push({ field: '$', operation: 'extract_unique_json_object', semanticField: false });
      return { value, repairOperations: operations, issues: [] };
    } catch {
      return { repairOperations: operations, issues: ['Diagnosis output is not repairable JSON.'] };
    }
  }
}

function applyWhitelistedRepairs(
  original: Record<string, unknown>,
  existingOperations: DiagnosisRepairOperation[],
): { value: Record<string, unknown>; repairOperations: DiagnosisRepairOperation[] } {
  const value = { ...original };
  const repairOperations = [...existingOperations];
  const aliases: Record<string, Record<string, string>> = {
    taskType: {
      'open-response': 'open_response',
      openresponse: 'open_response',
      'exact-match': 'exact_match',
      exactmatch: 'exact_match',
      'process-task': 'process_task',
      processtask: 'process_task',
    },
    answerStatus: {
      fullymeets: 'fully_meets',
      partiallymeets: 'partially_meets',
      doesnotmeet: 'does_not_meet',
      insufficientevidence: 'insufficient_evidence',
    },
    scoreBand: {
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
      INVALID: 'invalid',
    },
  };

  for (const [field, fieldAliases] of Object.entries(aliases)) {
    const current = value[field];
    if (typeof current !== 'string') continue;
    const normalizedKey = field === 'scoreBand'
      ? current.toUpperCase()
      : current.replace(/[_\s-]/g, '').toLowerCase();
    const replacement = fieldAliases[normalizedKey] || fieldAliases[current];
    if (replacement && replacement !== current) {
      value[field] = replacement;
      repairOperations.push({ field, operation: `normalize_known_alias:${current}->${replacement}`, semanticField: false });
    }
  }

  if (typeof value.confidence === 'number' && Number.isFinite(value.confidence)) {
    const clamped = Math.max(0, Math.min(1, value.confidence));
    if (clamped !== value.confidence) {
      value.confidence = clamped;
      repairOperations.push({ field: 'confidence', operation: `clamp_to_unit_interval:${clamped}`, semanticField: false });
    }
  }

  return { value, repairOperations };
}

function validateStrictDiagnosisResult(value: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const allowedFields = new Set<string>(DIAGNOSIS_RESULT_FIELDS);
  const unknownFields = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) issues.push(`Diagnosis output contains unknown fields: ${unknownFields.join(', ')}.`);

  if (!['exact_match', 'open_response', 'process_task'].includes(String(value.taskType))) issues.push('taskType is invalid.');
  if (!(typeof value.correct === 'boolean' || value.correct === null)) issues.push('correct must be boolean or null.');
  if (!isNonEmptyString(value.strategyUsed)) issues.push('strategyUsed is required.');
  if (!['fully_meets', 'partially_meets', 'does_not_meet', 'insufficient_evidence'].includes(String(value.answerStatus))) {
    issues.push('answerStatus is invalid.');
  }
  if (!['high', 'medium', 'low', 'invalid'].includes(String(value.scoreBand))) issues.push('scoreBand is invalid.');
  if (!isNonEmptyString(value.mainAbility)) issues.push('mainAbility is required.');
  if (!isStringArray(value.relatedAbilities)) issues.push('relatedAbilities must be a string array.');
  if (!isNonEmptyString(value.surfaceError)) issues.push('surfaceError is required.');
  if (!isNonEmptyString(value.rootCause)) issues.push('rootCause is required.');
  if (!DIAGNOSIS_ERROR_TYPES.includes(value.errorType as DiagnosisResult['errorType'])) issues.push('errorType is invalid.');
  const allowsEmptyEvidence = value.answerStatus === 'insufficient_evidence' && value.scoreBand === 'invalid';
  if (!isStringArray(value.abilityEvidence)) {
    issues.push('abilityEvidence must be a string array.');
  } else if (value.abilityEvidence.length === 0 && !allowsEmptyEvidence) {
    issues.push('abilityEvidence must contain at least one item for a diagnosable response.');
  }
  if (!isNonEmptyString(value.diagnosisSummary)) issues.push('diagnosisSummary is required.');
  if (!isNonEmptyString(value.nextTraining)) issues.push('nextTraining is required.');
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    issues.push('confidence must be between 0 and 1.');
  }
  if (value.rubricItems !== undefined && !Array.isArray(value.rubricItems)) issues.push('rubricItems must be an array.');
  if (value.matchedRubricItems !== undefined && !isStringArray(value.matchedRubricItems)) issues.push('matchedRubricItems must be a string array.');
  if (value.missingRubricItems !== undefined && !isStringArray(value.missingRubricItems)) issues.push('missingRubricItems must be a string array.');
  return issues;
}

function findPromptLeakageIssues(value: Record<string, unknown>): string[] {
  const forbiddenKeys = Object.keys(value).filter((key) => /prompt|system|developer|secret|api.?key/i.test(key));
  if (forbiddenKeys.length > 0) return [`Diagnosis output contains forbidden prompt fields: ${forbiddenKeys.join(', ')}.`];

  const serialized = JSON.stringify(value);
  if (/system prompt\s*(?:is|:)|系统提示(?:词)?(?:是|如下)|developer message\s*(?:is|:)/i.test(serialized)) {
    return ['Diagnosis output appears to disclose hidden prompt instructions.'];
  }
  return [];
}

function findSemanticBoundaryIssues(candidate: DiagnosisResult): string[] {
  const text = [candidate.rootCause, candidate.diagnosisSummary, candidate.nextTraining, ...candidate.abilityEvidence].join(' ');
  const forbidden = ['已经长期掌握', '已长期掌握', '能力已经稳定提升', '能力已稳定提升', '永久掌握', '天生不擅长'];
  return forbidden.some((item) => text.includes(item))
    ? ['Diagnosis output contains an unsupported long-term ability conclusion.']
    : [];
}

function validateRuntimeInput(
  input: RealLLMRuntimeFoundationInput,
  provider: DiagnosisProviderAdapter,
): string[] {
  const issues: string[] = [];
  if (!isConcreteLearningTask(input.concreteTask)) issues.push('ConcreteLearningTask is invalid.');
  if (!isTaskExecutionResult(input.taskExecutionResult)) issues.push('TaskExecutionResult is invalid.');
  if (!isDiagnosisProviderConfigSnapshot(input.providerConfig)) issues.push('Diagnosis Provider Config is invalid.');
  if (!input.taskExecutionResult.canEnterDiagnosisRuntime) issues.push('TaskExecutionResult cannot enter Diagnosis Runtime.');
  if (input.taskExecutionResult.status !== 'submitted_valid') issues.push('TaskExecutionResult must be submitted_valid.');
  if (!input.taskExecutionResult.studentResponse) issues.push('StudentResponse is required.');
  if (input.concreteTask.studentId !== input.taskExecutionResult.studentId) issues.push('studentId mismatch.');
  if (input.concreteTask.taskId !== input.taskExecutionResult.taskId) issues.push('taskId mismatch.');
  const response = input.taskExecutionResult.studentResponse;
  if (response) {
    if (response.studentId !== input.taskExecutionResult.studentId) issues.push('StudentResponse.studentId mismatch.');
    if (response.taskId !== input.taskExecutionResult.taskId) issues.push('StudentResponse.taskId mismatch.');
    if (response.executionSessionId !== input.taskExecutionResult.executionSessionId) issues.push('StudentResponse.executionSessionId mismatch.');
    if (response.responseId !== input.taskExecutionResult.responseValidity.responseId) issues.push('ResponseValidityResult.responseId mismatch.');
  }
  if (input.concreteTask.questionMetadata.mainAbility !== input.concreteTask.targetAbilityId) {
    issues.push('QuestionMetadata.mainAbility does not match targetAbilityId.');
  }
  if (input.providerConfig.provider !== provider.providerName) issues.push('Provider Config does not match Provider Adapter.');
  if (!isSupportedRealAIDiagnosisPromptVersion(input.providerConfig.promptVersion)) {
    issues.push('Provider Config promptVersion is not supported by the Prompt Registry.');
  }
  if (!buildAssessmentBasis(input.concreteTask)) issues.push('Task has no assessment basis.');
  return issues;
}

function buildBaseRunRecord(
  input: RealLLMRuntimeFoundationInput,
  requestId: string,
  runId: string,
  startedAt: string,
): DiagnosisRunRecord {
  return {
    schemaVersion: DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
    runId,
    requestId,
    studentId: input.taskExecutionResult.studentId,
    taskId: input.taskExecutionResult.taskId,
    executionSessionId: input.taskExecutionResult.executionSessionId,
    responseId: input.taskExecutionResult.studentResponse?.responseId || input.taskExecutionResult.responseValidity.responseId,
    executionMode: input.executionMode,
    status: 'provider_pending',
    providerConfigId: input.providerConfig.providerConfigId,
    providerRequestIds: [],
    attemptCount: 0,
    repairOperations: [],
    promptVersion: input.providerConfig.promptVersion,
    diagnosisSchemaVersion: input.providerConfig.diagnosisSchemaVersion,
    issues: [],
    startedAt,
  };
}

function buildProcessingFailureResult(input: {
  input: RealLLMRuntimeFoundationInput;
  requestId: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  attemptCount: number;
  providerRequestIds: string[];
  repairOperations: DiagnosisRepairOperation[];
  usage: DiagnosisTokenUsage;
  totalLatencyMs: number;
  totalCost?: DiagnosisEstimatedCost;
  rawOutputRef?: string;
  processed: CandidateProcessingResult;
}): RealLLMDiagnosisRuntimeResult {
  const reviewRequired = ['identity_mismatch', 'semantic_boundary_violation', 'unsafe_output'].includes(
    input.processed.errorCategory || '',
  );
  const runRecord: DiagnosisRunRecord = {
    ...buildBaseRunRecord(input.input, input.requestId, input.runId, input.startedAt),
    status: reviewRequired ? 'review_required' : 'retry_exhausted',
    providerRequestIds: input.providerRequestIds,
    attemptCount: input.attemptCount,
    repairOperations: input.repairOperations,
    tokenUsage: hasUsage(input.usage) ? input.usage : undefined,
    latencyMs: input.totalLatencyMs,
    estimatedCost: input.totalCost,
    rawOutputRef: input.rawOutputRef,
    errorCategory: input.processed.retryable ? 'retry_exhausted' : input.processed.errorCategory,
    issues: input.processed.issues,
    completedAt: input.completedAt,
  };
  return {
    requestId: input.requestId,
    runRecord,
    status: reviewRequired ? 'review_required' : 'failed',
    diagnosisCandidate: input.processed.candidate,
    formalizationStatus: reviewRequired ? 'review_required' : 'blocked',
    canEnterEvidenceReturn: false,
    validation: buildValidation(input.processed, false),
  };
}

function buildBlockedResult(input: {
  requestId: string;
  runRecord: DiagnosisRunRecord;
  status: 'blocked' | 'failed';
  formalizationStatus: 'blocked' | 'review_required';
  issues: string[];
}): RealLLMDiagnosisRuntimeResult {
  return {
    requestId: input.requestId,
    runRecord: input.runRecord,
    status: input.status,
    formalizationStatus: input.formalizationStatus,
    canEnterEvidenceReturn: false,
    validation: {
      passed: false,
      schemaValid: false,
      identityAligned: false,
      semanticBoundaryPassed: false,
      promptLeakagePassed: true,
      issues: input.issues,
    },
  };
}

function buildValidation(processed: CandidateProcessingResult, passed: boolean) {
  return {
    passed,
    schemaValid: processed.schemaValid,
    identityAligned: processed.identityAligned,
    semanticBoundaryPassed: processed.semanticBoundaryPassed,
    promptLeakagePassed: processed.promptLeakagePassed,
    issues: processed.issues,
  };
}

function buildQuestion(task: ConcreteLearningTask): string {
  return [task.readingText ? `阅读材料：${task.readingText}` : '', task.question].filter(Boolean).join('\n\n');
}

function buildAssessmentBasis(task: ConcreteLearningTask): string {
  if (task.referenceAnswer?.trim()) return task.referenceAnswer.trim();
  const items = [...task.scoringPoints, ...task.rubric.map((item) => item.description || item.name)].filter(Boolean);
  return items.join('；');
}

function buildRequestId(result: TaskExecutionResult): string {
  const responseId = result.studentResponse?.responseId || result.responseValidity.responseId;
  return `real-llm-diagnosis-${sanitizeId(result.executionSessionId)}-${sanitizeId(responseId)}`;
}

function buildRawOutputRef(requestId: string, attempt: number, rawOutput: string): string {
  return `raw-diagnosis-${sanitizeId(requestId)}-${attempt}-${hashString(rawOutput)}`;
}

function extractTopLevelJsonObjects(source: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(source.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

function normalizeProviderError(error: unknown): DiagnosisProviderError {
  if (error instanceof DiagnosisProviderError) return error;
  return new DiagnosisProviderError({
    message: 'Diagnosis provider failed with an unknown error.',
    category: 'unknown',
    retryable: false,
  });
}

function emptyUsage(): DiagnosisTokenUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function mergeUsage(target: DiagnosisTokenUsage, source?: DiagnosisTokenUsage): void {
  if (!source) return;
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.totalTokens += source.totalTokens;
}

function hasUsage(usage: DiagnosisTokenUsage): boolean {
  return usage.totalTokens > 0 || usage.inputTokens > 0 || usage.outputTokens > 0;
}

function mergeCost(
  current: DiagnosisEstimatedCost | undefined,
  next: DiagnosisEstimatedCost | undefined,
): DiagnosisEstimatedCost | undefined {
  if (!next) return current;
  if (!current) return next;
  if (current.currency !== next.currency) return current;
  return { amount: current.amount + next.amount, currency: current.currency };
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 120);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
