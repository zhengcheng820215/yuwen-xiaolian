import type { DiagnosisResult } from './diagnosis.schema.ts';

export const DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION = 'diagnosis_run_record_v1' as const;
export const FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION = 'formal_diagnosis_commit_v1' as const;
export const DIAGNOSIS_REPAIR_POLICY_VERSION = 'diagnosis_repair_policy_v1' as const;

export type DiagnosisExecutionMode = 'live' | 'shadow';

export type DiagnosisRunStatus =
  | 'input_blocked'
  | 'provider_pending'
  | 'provider_failed'
  | 'retry_exhausted'
  | 'candidate_ready'
  | 'formal_result_committed'
  | 'shadow_result_ready'
  | 'review_required'
  | 'failed';

export type DiagnosisProviderErrorCategory =
  | 'timeout'
  | 'rate_limit'
  | 'authentication_failed'
  | 'insufficient_balance'
  | 'provider_unavailable'
  | 'network_error'
  | 'malformed_output'
  | 'schema_invalid'
  | 'identity_mismatch'
  | 'semantic_boundary_violation'
  | 'unsafe_output'
  | 'retry_exhausted'
  | 'unknown';

export type DiagnosisRepairOperation = {
  field: string;
  operation: string;
  semanticField: boolean;
};

export type DiagnosisProviderConfigSnapshot = {
  providerConfigId: string;
  provider: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxAttempts: number;
  promptVersion: string;
  diagnosisSchemaVersion: string;
  repairPolicyVersion: typeof DIAGNOSIS_REPAIR_POLICY_VERSION;
  createdAt: string;
};

export type DiagnosisTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type DiagnosisEstimatedCost = {
  amount: number;
  currency: string;
};

export type DiagnosisRunRecord = {
  schemaVersion: typeof DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION;
  runId: string;
  requestId: string;
  studentId: string;
  taskId: string;
  executionSessionId: string;
  responseId: string;
  executionMode: DiagnosisExecutionMode;
  status: DiagnosisRunStatus;
  providerConfigId: string;
  providerRequestIds: string[];
  attemptCount: number;
  repairOperations: DiagnosisRepairOperation[];
  promptVersion: string;
  diagnosisSchemaVersion: string;
  tokenUsage?: DiagnosisTokenUsage;
  latencyMs?: number;
  estimatedCost?: DiagnosisEstimatedCost;
  rawOutputRef?: string;
  errorCategory?: DiagnosisProviderErrorCategory;
  issues: string[];
  startedAt: string;
  completedAt?: string;
};

export type FormalDiagnosisCommitStatus =
  | 'candidate'
  | 'committed'
  | 'blocked'
  | 'review_required';

export type FormalDiagnosisCommit = {
  schemaVersion: typeof FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION;
  formalDiagnosisId: string;
  requestId: string;
  runId: string;
  status: FormalDiagnosisCommitStatus;
  diagnosisResult?: DiagnosisResult;
  committedAt?: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type RealLLMDiagnosisRuntimeStatus =
  | 'candidate_ready'
  | 'formal_result_committed'
  | 'shadow_result_ready'
  | 'blocked'
  | 'review_required'
  | 'failed';

export type RealLLMDiagnosisRuntimeResult = {
  requestId: string;
  runRecord: DiagnosisRunRecord;
  status: RealLLMDiagnosisRuntimeStatus;
  diagnosisCandidate?: DiagnosisResult;
  formalizationStatus: FormalDiagnosisCommitStatus;
  formalDiagnosisCommit?: FormalDiagnosisCommit;
  canEnterEvidenceReturn: boolean;
  validation: {
    passed: boolean;
    schemaValid: boolean;
    identityAligned: boolean;
    semanticBoundaryPassed: boolean;
    promptLeakagePassed: boolean;
    issues: string[];
  };
};

export function isDiagnosisProviderConfigSnapshot(
  value: unknown,
): value is DiagnosisProviderConfigSnapshot {
  if (!value || typeof value !== 'object') return false;
  const config = value as DiagnosisProviderConfigSnapshot;
  return (
    isNonEmptyString(config.providerConfigId) &&
    isNonEmptyString(config.provider) &&
    isNonEmptyString(config.model) &&
    isNumberInRange(config.temperature, 0, 2) &&
    Number.isInteger(config.maxOutputTokens) &&
    config.maxOutputTokens > 0 &&
    Number.isInteger(config.timeoutMs) &&
    config.timeoutMs > 0 &&
    Number.isInteger(config.maxAttempts) &&
    config.maxAttempts > 0 &&
    isNonEmptyString(config.promptVersion) &&
    isNonEmptyString(config.diagnosisSchemaVersion) &&
    config.repairPolicyVersion === DIAGNOSIS_REPAIR_POLICY_VERSION &&
    isIsoDate(config.createdAt)
  );
}

export function isDiagnosisRunRecord(value: unknown): value is DiagnosisRunRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as DiagnosisRunRecord;
  return (
    record.schemaVersion === DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION &&
    isNonEmptyString(record.runId) &&
    isNonEmptyString(record.requestId) &&
    isNonEmptyString(record.studentId) &&
    isNonEmptyString(record.taskId) &&
    isNonEmptyString(record.executionSessionId) &&
    isNonEmptyString(record.responseId) &&
    ['live', 'shadow'].includes(record.executionMode) &&
    [
      'input_blocked',
      'provider_pending',
      'provider_failed',
      'retry_exhausted',
      'candidate_ready',
      'formal_result_committed',
      'shadow_result_ready',
      'review_required',
      'failed',
    ].includes(record.status) &&
    isNonEmptyString(record.providerConfigId) &&
    Array.isArray(record.providerRequestIds) &&
    record.providerRequestIds.every(isNonEmptyString) &&
    Number.isInteger(record.attemptCount) &&
    record.attemptCount >= 0 &&
    Array.isArray(record.repairOperations) &&
    record.repairOperations.every(isDiagnosisRepairOperation) &&
    isNonEmptyString(record.promptVersion) &&
    isNonEmptyString(record.diagnosisSchemaVersion) &&
    Array.isArray(record.issues) &&
    record.issues.every(isNonEmptyString) &&
    isIsoDate(record.startedAt) &&
    (record.completedAt === undefined || isIsoDate(record.completedAt))
  );
}

export function isFormalDiagnosisCommit(value: unknown): value is FormalDiagnosisCommit {
  if (!value || typeof value !== 'object') return false;
  const commit = value as FormalDiagnosisCommit;
  return (
    commit.schemaVersion === FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION &&
    isNonEmptyString(commit.formalDiagnosisId) &&
    isNonEmptyString(commit.requestId) &&
    isNonEmptyString(commit.runId) &&
    ['candidate', 'committed', 'blocked', 'review_required'].includes(commit.status) &&
    typeof commit.validation?.passed === 'boolean' &&
    Array.isArray(commit.validation?.issues) &&
    commit.validation.issues.every(isNonEmptyString) &&
    (commit.committedAt === undefined || isIsoDate(commit.committedAt)) &&
    (commit.status !== 'committed' || (Boolean(commit.diagnosisResult) && isIsoDate(commit.committedAt)))
  );
}

export function isRealLLMDiagnosisRuntimeResult(
  value: unknown,
): value is RealLLMDiagnosisRuntimeResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as RealLLMDiagnosisRuntimeResult;
  return (
    isNonEmptyString(result.requestId) &&
    isDiagnosisRunRecord(result.runRecord) &&
    [
      'candidate_ready',
      'formal_result_committed',
      'shadow_result_ready',
      'blocked',
      'review_required',
      'failed',
    ].includes(result.status) &&
    ['candidate', 'committed', 'blocked', 'review_required'].includes(result.formalizationStatus) &&
    typeof result.canEnterEvidenceReturn === 'boolean' &&
    typeof result.validation?.passed === 'boolean' &&
    typeof result.validation?.schemaValid === 'boolean' &&
    typeof result.validation?.identityAligned === 'boolean' &&
    typeof result.validation?.semanticBoundaryPassed === 'boolean' &&
    typeof result.validation?.promptLeakagePassed === 'boolean' &&
    Array.isArray(result.validation?.issues) &&
    result.validation.issues.every(isNonEmptyString) &&
    (result.formalDiagnosisCommit === undefined || isFormalDiagnosisCommit(result.formalDiagnosisCommit))
  );
}

function isDiagnosisRepairOperation(value: unknown): value is DiagnosisRepairOperation {
  if (!value || typeof value !== 'object') return false;
  const operation = value as DiagnosisRepairOperation;
  return (
    isNonEmptyString(operation.field) &&
    isNonEmptyString(operation.operation) &&
    typeof operation.semanticField === 'boolean'
  );
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
