import { extractAbilityEvidenceFromDiagnosis } from './abilityEvidenceExtractor.ts';
import { evaluateAbilityEvidence } from './evaluationAgent.ts';
import { createGrowthMemoryRecord } from './growthMemoryRecordAgent.ts';
import { decideProfileUpdate } from './profileUpdateDecisionAgent.ts';
import { applyProfileUpdateDecision } from './profileUpdateExecutor.ts';
import { generateStudentAbilityProfile } from './studentAbilityProfileAgent.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
} from './weaknessRankingAgent.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import {
  type DiagnosisResult,
  normalizeDiagnosisResult,
} from '../schemas/diagnosis.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { TaskExecutionResult } from '../schemas/taskExecution.schema.ts';
import type {
  TaskEvidenceReturnResult,
  TaskEvidenceReturnStatus,
  TaskEvidenceTraceLink,
} from '../schemas/taskEvidenceReturn.schema.ts';

const DEFAULT_RETURNED_AT = '2026-07-13T11:30:00.000Z';

export type TaskEvidenceReturnInput = {
  concreteTask: ConcreteLearningTask;
  taskExecutionResult: TaskExecutionResult;
  previousEvidence?: AbilityEvidence[];
  currentProfile?: StudentAbilityProfile;
  diagnosisResult?: Partial<DiagnosisResult> | null;
  diagnosisResultId?: string;
  diagnosisFailed?: boolean;
  returnedAt?: string;
};

export function runTaskEvidenceReturnAgent(
  input: TaskEvidenceReturnInput,
): TaskEvidenceReturnResult {
  const returnedAt = input.returnedAt || DEFAULT_RETURNED_AT;
  const responseId = input.taskExecutionResult.studentResponse?.responseId;
  const diagnosisResultId = input.diagnosisResultId || buildDiagnosisResultId(input, returnedAt);
  const supportContext = {
    usedHint: input.taskExecutionResult.usedHint,
    hintCount: input.taskExecutionResult.hintCount,
  };
  const base = buildBaseResult({
    input,
    returnedAt,
    responseId,
    diagnosisResultId,
    supportContext,
    status: 'blocked_invalid_execution',
  });

  const inputIssues = validateInputConsistency(input);
  if (!input.taskExecutionResult.canEnterDiagnosisRuntime) {
    return {
      ...base,
      status: 'blocked_invalid_execution',
      validation: {
        ...base.validation,
        passed: true,
        issues: [
          'TaskExecutionResult.canEnterDiagnosisRuntime=false，Phase 9.3 阻断回流。',
          ...inputIssues,
        ],
      },
    };
  }

  if (inputIssues.length > 0) {
    return {
      ...base,
      status: 'blocked_invalid_execution',
      validation: {
        ...base.validation,
        passed: false,
        studentIdConsistent: false,
        issues: inputIssues,
      },
    };
  }

  if (input.diagnosisFailed || !isDiagnosisResultLike(input.diagnosisResult)) {
    return {
      ...base,
      status: 'diagnosis_failed',
      validation: {
        ...base.validation,
        passed: true,
        diagnosisSchemaValid: false,
        issues: ['Diagnosis Runtime 失败或 DiagnosisResult Schema 非法，不生成正式 AbilityEvidence。'],
      },
    };
  }

  const diagnosisResult = normalizeDiagnosisResult(input.diagnosisResult);
  const taskDiagnosisAligned = isDiagnosisAligned(diagnosisResult, input.concreteTask);

  if (!taskDiagnosisAligned) {
    return {
      ...base,
      status: 'review_required',
      diagnosisResult,
      validation: {
        ...base.validation,
        passed: true,
        diagnosisSchemaValid: true,
        taskDiagnosisAligned: false,
        reviewRequired: true,
        issues: [
          `DiagnosisResult.mainAbility=${diagnosisResult.mainAbility} 与任务目标能力 ${input.concreteTask.targetAbilityId} 不一致，需复核。`,
        ],
      },
    };
  }

  const newEvidence = extractAbilityEvidenceFromDiagnosis(diagnosisResult, {
    studentId: input.taskExecutionResult.studentId,
    taskId: input.taskExecutionResult.taskId,
    diagnosisId: diagnosisResultId,
    createdAt: returnedAt,
  });
  const evidenceTraceLink: TaskEvidenceTraceLink = {
    taskId: input.taskExecutionResult.taskId,
    executionSessionId: input.taskExecutionResult.executionSessionId,
    responseId: responseId || 'missing-response-id',
    diagnosisResultId,
  };
  const updatedEvidence = dedupeEvidence([
    ...(input.previousEvidence || []),
    newEvidence,
  ]);
  const currentProfile = input.currentProfile || buildProfile({
    studentId: input.taskExecutionResult.studentId,
    evidence: input.previousEvidence?.length ? input.previousEvidence : [newEvidence],
    generatedAt: returnedAt,
  });
  const evaluationResult = evaluateAbilityEvidence({
    studentId: input.taskExecutionResult.studentId,
    targetAbility: input.concreteTask.targetAbilityId,
    evidence: updatedEvidence,
    evaluatedAt: returnedAt,
  });
  const profileUpdateDecision = decideProfileUpdate({
    evaluationResult,
    currentProfile,
    decidedAt: returnedAt,
  });
  const profileExecution = applyProfileUpdateDecision({
    currentProfile,
    decision: profileUpdateDecision,
    appliedAt: returnedAt,
  });
  const growthMemoryRecord = createGrowthMemoryRecord({
    evaluationResult,
    profileUpdateDecision,
    beforeProfile: currentProfile,
    afterProfile: profileExecution.afterProfile,
    createdAt: returnedAt,
    sourceRuntime: 'phase9_3_task_evidence_return',
    relatedSessionId: input.taskExecutionResult.executionSessionId,
  });
  const traceabilityComplete = isTraceabilityComplete(evidenceTraceLink);

  return {
    ...base,
    status: 'evidence_returned',
    diagnosisResult,
    diagnosisResultId,
    abilityEvidence: [newEvidence],
    evidenceTraceLinks: [evidenceTraceLink],
    evaluationResult,
    profileUpdateDecision,
    growthMemoryRecord,
    validation: {
      passed: traceabilityComplete,
      diagnosisSchemaValid: true,
      taskDiagnosisAligned: true,
      studentIdConsistent: true,
      traceabilityComplete,
      reviewRequired: false,
      issues: traceabilityComplete ? [] : ['AbilityEvidence traceability is incomplete.'],
    },
  };
}

function buildBaseResult(input: {
  input: TaskEvidenceReturnInput;
  returnedAt: string;
  responseId?: string;
  diagnosisResultId: string;
  supportContext: { usedHint: boolean; hintCount: number };
  status: TaskEvidenceReturnStatus;
}): TaskEvidenceReturnResult {
  return {
    returnId: `task-evidence-return-${input.input.taskExecutionResult.executionSessionId}-${input.returnedAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17)}`,
    status: input.status,
    studentId: input.input.taskExecutionResult.studentId,
    taskId: input.input.taskExecutionResult.taskId,
    executionSessionId: input.input.taskExecutionResult.executionSessionId,
    responseId: input.responseId,
    concreteTask: input.input.concreteTask,
    taskExecutionResult: input.input.taskExecutionResult,
    diagnosisResultId: input.diagnosisResultId,
    abilityEvidence: [],
    evidenceTraceLinks: [],
    supportContext: input.supportContext,
    validation: {
      passed: false,
      diagnosisSchemaValid: false,
      taskDiagnosisAligned: false,
      studentIdConsistent: true,
      traceabilityComplete: false,
      reviewRequired: false,
      issues: [],
    },
  };
}

function validateInputConsistency(input: TaskEvidenceReturnInput): string[] {
  const issues: string[] = [];
  const response = input.taskExecutionResult.studentResponse;

  if (input.taskExecutionResult.studentId !== input.concreteTask.studentId) {
    issues.push('TaskExecutionResult.studentId 与 ConcreteLearningTask.studentId 不一致。');
  }
  if (input.taskExecutionResult.taskId !== input.concreteTask.taskId) {
    issues.push('TaskExecutionResult.taskId 与 ConcreteLearningTask.taskId 不一致。');
  }
  if (response && response.taskId !== input.taskExecutionResult.taskId) {
    issues.push('StudentResponse.taskId 与 TaskExecutionResult.taskId 不一致。');
  }
  if (response && response.executionSessionId !== input.taskExecutionResult.executionSessionId) {
    issues.push('StudentResponse.executionSessionId 与 TaskExecutionResult.executionSessionId 不一致。');
  }

  return issues;
}

function isDiagnosisResultLike(value: unknown): value is Partial<DiagnosisResult> {
  if (!value || typeof value !== 'object') return false;

  const result = value as Partial<DiagnosisResult>;
  return (
    typeof result.taskType === 'string' &&
    typeof result.strategyUsed === 'string' &&
    typeof result.mainAbility === 'string' &&
    result.mainAbility.trim().length > 0 &&
    Array.isArray(result.relatedAbilities) &&
    typeof result.surfaceError === 'string' &&
    typeof result.rootCause === 'string' &&
    typeof result.errorType === 'string' &&
    Array.isArray(result.abilityEvidence) &&
    typeof result.diagnosisSummary === 'string' &&
    typeof result.nextTraining === 'string' &&
    typeof result.confidence === 'number' &&
    result.confidence >= 0 &&
    result.confidence <= 1
  );
}

function isDiagnosisAligned(
  diagnosisResult: DiagnosisResult,
  concreteTask: ConcreteLearningTask,
): boolean {
  const accepted = new Set([
    concreteTask.targetAbilityId,
    concreteTask.targetAbilityName,
    concreteTask.questionMetadata.mainAbility,
  ].filter(Boolean));

  return accepted.has(diagnosisResult.mainAbility);
}

function buildDiagnosisResultId(input: TaskEvidenceReturnInput, returnedAt: string): string {
  const timestamp = returnedAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `diagnosis-${input.taskExecutionResult.executionSessionId}-${timestamp}`;
}

function buildProfile(input: {
  studentId: string;
  evidence: AbilityEvidence[];
  generatedAt: string;
}): StudentAbilityProfile {
  const summary = summarizeAbilityEvidence(input.evidence);
  return generateStudentAbilityProfile({
    studentId: input.studentId,
    evidenceSummary: summary,
    topWeakness: rankWeaknessSummaries(summary),
    evidence: input.evidence,
    generatedAt: input.generatedAt,
  });
}

function dedupeEvidence(evidence: AbilityEvidence[]): AbilityEvidence[] {
  const seen = new Set<string>();
  const result: AbilityEvidence[] = [];

  for (const item of evidence) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function isTraceabilityComplete(link: TaskEvidenceTraceLink): boolean {
  return Boolean(
    link.taskId.trim() &&
    link.executionSessionId.trim() &&
    link.responseId.trim() &&
    link.diagnosisResultId.trim(),
  );
}
