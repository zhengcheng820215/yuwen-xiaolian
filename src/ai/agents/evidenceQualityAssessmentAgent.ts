import { isAbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import { isConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import {
  EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_QUALITY_POLICY_VERSION,
  isEvidenceQualityAssessment,
  type EvidenceEvaluationEligibility,
  type EvidenceHintDependency,
  type EvidenceQualityAssessment,
  type EvidenceQualityAssessmentInput,
  type EvidenceQualityFacts,
  type EvidenceQualityLevel,
  type EvidenceTaskNovelty,
  type EvidenceTimingType,
} from '../schemas/evidenceQualityAssessment.schema.ts';
import { isTaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';
import { isTaskExecutionResult } from '../schemas/taskExecution.schema.ts';

const FALLBACK_TIME = '1970-01-01T00:00:00.000Z';

export function assessEvidenceQuality(
  input: EvidenceQualityAssessmentInput,
): EvidenceQualityAssessment {
  const evidence = input.abilityEvidence;
  const task = input.concreteLearningTask;
  const execution = input.taskExecutionResult;
  const taskReturn = input.taskEvidenceReturnResult;
  const responseId = execution?.studentResponse?.responseId || taskReturn?.responseId || 'unknown-response';
  const diagnosisResultId = taskReturn?.diagnosisResultId || 'unknown-diagnosis';
  const taskId = task?.taskId || evidence?.taskId || 'unknown-task';
  const executionSessionId = execution?.executionSessionId || 'unknown-execution';
  const observationUnitId = buildStableId('observation-unit', [
    input.studentId || 'unknown-student',
    taskId,
    executionSessionId,
    responseId,
  ]);
  const facts = deriveFacts(input);
  const inputIssues = validateInputShape(input);
  const identityIssues = validateIdentityAndTrace(input, facts);
  const hardIssues = uniqueStrings([
    ...inputIssues,
    ...identityIssues,
    ...deriveHardIssues(input, facts),
  ]);
  const reviewIssues = hardIssues.length === 0
    ? deriveReviewIssues(input, facts)
    : [];
  const contextFingerprint = buildContextFingerprint(input, facts);
  const quality = deriveQuality(facts, hardIssues, reviewIssues);
  const supersedesAssessmentId = deriveSupersedesAssessmentId(input, contextFingerprint);
  const validationIssues = uniqueStrings([...hardIssues, ...reviewIssues]);
  const assessmentId = buildStableId('evidence-quality', [
    evidence?.id || 'unknown-evidence',
    contextFingerprint,
    EVIDENCE_QUALITY_POLICY_VERSION,
  ]);
  const result: EvidenceQualityAssessment = {
    assessmentId,
    evidenceId: evidence?.id || 'unknown-evidence',
    studentId: input.studentId || evidence?.studentId || 'unknown-student',
    abilityId: input.targetAbilityId || evidence?.ability || 'unknown-ability',
    observationUnitId,
    contextFingerprint,
    policyVersion: EVIDENCE_QUALITY_POLICY_VERSION,
    supersedesAssessmentId,
    evidenceType: evidence?.evidenceType || 'insufficient',
    qualityLevel: quality.level,
    evaluationEligibility: quality.eligibility,
    facts,
    qualityReasons: buildQualityReasons(facts, quality.level, quality.eligibility),
    limitations: buildLimitations(facts, hardIssues, reviewIssues),
    sourceLinks: {
      taskId,
      executionSessionId,
      responseId,
      diagnosisResultId,
      taskEvidenceReturnId: taskReturn?.returnId || 'unknown-return',
      delayedRetestPlanId: input.retentionContext?.delayedRetestPlanId,
    },
    schemaVersion: EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION,
    assessedAt: isTimestamp(input.assessedAt) ? input.assessedAt : FALLBACK_TIME,
    validation: {
      passed: validationIssues.length === 0,
      issues: validationIssues,
    },
  };

  if (isEvidenceQualityAssessment(result)) return result;

  return {
    ...result,
    qualityLevel: 'insufficient',
    evaluationEligibility: 'blocked',
    qualityReasons: ['EvidenceQualityAssessment 未通过 Schema 校验。'],
    validation: {
      passed: false,
      issues: uniqueStrings([
        ...result.validation.issues,
        'EvidenceQualityAssessment schema validation failed.',
      ]),
    },
  };
}

function deriveFacts(input: EvidenceQualityAssessmentInput): EvidenceQualityFacts {
  const execution = input.taskExecutionResult;
  const taskReturn = input.taskEvidenceReturnResult;
  const evidence = input.abilityEvidence;
  const task = input.concreteLearningTask;
  const responseValid = Boolean(
    execution?.status === 'submitted_valid' &&
    execution?.canEnterDiagnosisRuntime &&
    execution?.responseValidity?.status === 'valid' &&
    execution?.responseValidity?.canDiagnose,
  );
  const taskAbilityAligned = Boolean(
    task?.targetAbilityId === input.targetAbilityId &&
    evidence?.ability === input.targetAbilityId &&
    (!task?.questionMetadata?.mainAbility || task.questionMetadata.mainAbility === input.targetAbilityId),
  );
  const diagnosisAligned = Boolean(
    taskReturn?.validation?.taskDiagnosisAligned &&
    taskReturn?.diagnosisResult?.mainAbility === input.targetAbilityId,
  );
  const traceabilityComplete = deriveTraceability(input);
  const usedHint = Boolean(execution?.usedHint);
  const hintCount = Number.isInteger(execution?.hintCount) && execution.hintCount >= 0
    ? execution.hintCount
    : 0;
  const hintFactsAligned = Boolean(
    execution?.usedHint === taskReturn?.supportContext?.usedHint &&
    execution?.hintCount === taskReturn?.supportContext?.hintCount &&
    execution?.studentResponse?.usedHint === execution?.usedHint &&
    execution?.studentResponse?.hintCount === execution?.hintCount,
  );
  const hintDependency = deriveHintDependency(usedHint, hintCount, hintFactsAligned);
  const taskNovelty = deriveTaskNovelty(input);
  const timingType = deriveTimingType(input);
  const diagnosisReliable = Boolean(
    taskReturn?.status === 'evidence_returned' &&
    taskReturn?.validation?.passed &&
    taskReturn?.validation?.diagnosisSchemaValid &&
    diagnosisAligned &&
    isDiagnosisResultLike(taskReturn?.diagnosisResult),
  );

  return {
    responseValid,
    taskAbilityAligned,
    diagnosisAligned,
    traceabilityComplete,
    independentPerformance: responseValid && hintDependency === 'none',
    usedHint,
    hintCount,
    hintDependency,
    taskNovelty,
    timingType,
    taskRole: task?.taskRole || 'observation',
    difficultyRelation: input.retentionContext?.difficultyRelation || 'unknown',
    diagnosisReliable,
  };
}

function validateInputShape(input: EvidenceQualityAssessmentInput): string[] {
  const issues: string[] = [];
  if (!isNonEmptyString(input.studentId)) issues.push('studentId is required.');
  if (!isNonEmptyString(input.targetAbilityId)) issues.push('targetAbilityId is required.');
  if (!isAbilityEvidence(input.abilityEvidence)) issues.push('AbilityEvidence schema validation failed.');
  if (!isConcreteLearningTask(input.concreteLearningTask)) issues.push('ConcreteLearningTask schema validation failed.');
  if (!isTaskExecutionResult(input.taskExecutionResult)) issues.push('TaskExecutionResult schema validation failed.');
  if (!isTaskEvidenceReturnResult(input.taskEvidenceReturnResult)) {
    issues.push('TaskEvidenceReturnResult schema validation failed.');
  }
  if (!isTimestamp(input.assessedAt)) issues.push('assessedAt must be a valid timestamp.');
  if (!isNonEmptyString(input.timezone)) issues.push('timezone is required.');
  if (input.retentionContext && !input.retentionContext.validationPassed) {
    issues.push('Retention context validation did not pass.');
  }
  return uniqueStrings(issues);
}

function validateIdentityAndTrace(
  input: EvidenceQualityAssessmentInput,
  facts: EvidenceQualityFacts,
): string[] {
  const issues: string[] = [];
  const evidence = input.abilityEvidence;
  const task = input.concreteLearningTask;
  const execution = input.taskExecutionResult;
  const taskReturn = input.taskEvidenceReturnResult;
  const response = execution?.studentResponse;

  if (evidence.studentId !== input.studentId) issues.push('AbilityEvidence studentId mismatch.');
  if (task.studentId !== input.studentId) issues.push('ConcreteLearningTask studentId mismatch.');
  if (execution.studentId !== input.studentId) issues.push('TaskExecutionResult studentId mismatch.');
  if (taskReturn.studentId !== input.studentId) issues.push('TaskEvidenceReturnResult studentId mismatch.');
  if (response && response.studentId !== input.studentId) issues.push('StudentResponse studentId mismatch.');
  if (!facts.taskAbilityAligned) issues.push('Target ability alignment failed.');
  if (evidence.taskId !== task.taskId) issues.push('AbilityEvidence taskId mismatch.');
  if (execution.taskId !== task.taskId) issues.push('TaskExecutionResult taskId mismatch.');
  if (taskReturn.taskId !== task.taskId) issues.push('TaskEvidenceReturnResult taskId mismatch.');
  if (taskReturn.concreteTask.taskId !== task.taskId) issues.push('Nested ConcreteLearningTask taskId mismatch.');
  if (response && response.taskId !== task.taskId) issues.push('StudentResponse taskId mismatch.');
  if (taskReturn.executionSessionId !== execution.executionSessionId) {
    issues.push('TaskEvidenceReturnResult executionSessionId mismatch.');
  }
  if (taskReturn.taskExecutionResult.executionSessionId !== execution.executionSessionId) {
    issues.push('Nested TaskExecutionResult executionSessionId mismatch.');
  }
  if (response && taskReturn.responseId !== response.responseId) issues.push('StudentResponse responseId mismatch.');
  if (evidence.diagnosisId !== taskReturn.diagnosisResultId) issues.push('AbilityEvidence diagnosisId mismatch.');
  if (!taskReturn.abilityEvidence.some((item) => item.id === evidence.id)) {
    issues.push('AbilityEvidence is not included in TaskEvidenceReturnResult.');
  }
  if (!facts.traceabilityComplete) issues.push('Evidence traceability is incomplete.');

  return uniqueStrings(issues);
}

function deriveHardIssues(
  input: EvidenceQualityAssessmentInput,
  facts: EvidenceQualityFacts,
): string[] {
  const issues: string[] = [];
  if (!facts.responseValid) issues.push('Response is not valid for diagnosis.');
  if (!facts.diagnosisAligned) issues.push('Diagnosis ability alignment failed.');
  if (!facts.diagnosisReliable) issues.push('Diagnosis is not reliable enough for quality assessment.');
  if (!facts.traceabilityComplete) issues.push('Formal traceability chain is incomplete.');
  if (input.abilityEvidence?.evidenceType === 'insufficient') {
    issues.push('Insufficient Evidence cannot enter directional quality coordination.');
  }
  return uniqueStrings(issues);
}

function deriveReviewIssues(
  input: EvidenceQualityAssessmentInput,
  facts: EvidenceQualityFacts,
): string[] {
  const issues: string[] = [];
  const execution = input.taskExecutionResult;
  const taskReturn = input.taskEvidenceReturnResult;
  if (
    execution.usedHint !== taskReturn.supportContext.usedHint ||
    execution.hintCount !== taskReturn.supportContext.hintCount ||
    execution.studentResponse?.usedHint !== execution.usedHint ||
    execution.studentResponse?.hintCount !== execution.hintCount
  ) {
    issues.push('Hint support context is inconsistent.');
  }
  if (input.concreteLearningTask.taskRole === 'transfer' && facts.taskNovelty !== 'transfer') {
    issues.push('Transfer task role is not supported by confirmed new-material context.');
  }
  if (input.retentionContext?.delayedRetestPlanId && facts.timingType !== 'delayed') {
    issues.push('Delayed retest context does not establish a valid delayed timing relation.');
  }
  return uniqueStrings(issues);
}

function deriveQuality(
  facts: EvidenceQualityFacts,
  hardIssues: string[],
  reviewIssues: string[],
): { level: EvidenceQualityLevel; eligibility: EvidenceEvaluationEligibility } {
  if (hardIssues.length > 0) return { level: 'insufficient', eligibility: 'blocked' };
  if (reviewIssues.length > 0) return { level: 'insufficient', eligibility: 'review_required' };

  const hasStrongObservationContext = (
    facts.taskNovelty === 'transfer' || facts.timingType === 'delayed'
  );
  const difficultyKnown = facts.difficultyRelation !== 'unknown';
  if (
    facts.independentPerformance &&
    hasStrongObservationContext &&
    difficultyKnown &&
    facts.diagnosisReliable &&
    facts.traceabilityComplete
  ) {
    return { level: 'high', eligibility: 'eligible' };
  }

  if (
    facts.hintDependency === 'high' ||
    facts.hintDependency === 'medium' ||
    facts.difficultyRelation === 'lower' ||
    (facts.taskNovelty === 'same' && facts.timingType === 'immediate')
  ) {
    return { level: 'low', eligibility: 'limited' };
  }

  if (facts.hintDependency === 'low') {
    return { level: 'medium', eligibility: 'limited' };
  }

  if (facts.taskNovelty === 'unknown' && facts.difficultyRelation === 'unknown') {
    return { level: 'low', eligibility: 'limited' };
  }

  return { level: 'medium', eligibility: 'eligible' };
}

function deriveTraceability(input: EvidenceQualityAssessmentInput): boolean {
  const evidence = input.abilityEvidence;
  const execution = input.taskExecutionResult;
  const taskReturn = input.taskEvidenceReturnResult;
  const response = execution?.studentResponse;
  if (!response || !taskReturn?.diagnosisResultId) return false;

  const hasEvidence = taskReturn.abilityEvidence?.some((item) => item.id === evidence?.id);
  const hasTraceLink = taskReturn.evidenceTraceLinks?.some((link) => (
    link.taskId === input.concreteLearningTask?.taskId &&
    link.executionSessionId === execution?.executionSessionId &&
    link.responseId === response.responseId &&
    link.diagnosisResultId === taskReturn.diagnosisResultId
  ));
  return Boolean(
    taskReturn.validation?.traceabilityComplete &&
    hasEvidence &&
    hasTraceLink &&
    taskReturn.responseId === response.responseId &&
    taskReturn.executionSessionId === execution.executionSessionId &&
    taskReturn.taskExecutionResult.executionSessionId === execution.executionSessionId &&
    evidence?.taskId === input.concreteLearningTask?.taskId &&
    evidence?.diagnosisId === taskReturn.diagnosisResultId,
  );
}

function deriveHintDependency(
  usedHint: boolean,
  hintCount: number,
  factsAligned: boolean,
): EvidenceHintDependency {
  if (!factsAligned) return 'unknown';
  if (!usedHint && hintCount === 0) return 'none';
  if (usedHint && hintCount === 1) return 'low';
  if (usedHint && hintCount === 2) return 'medium';
  if (usedHint && hintCount >= 3) return 'high';
  return 'unknown';
}

function deriveTaskNovelty(input: EvidenceQualityAssessmentInput): EvidenceTaskNovelty {
  const relation = input.retentionContext?.materialRelation;
  if (relation === 'same_material') return 'same';
  if (relation === 'similar_material') return 'similar';
  if (relation === 'new_material') return 'transfer';
  return 'unknown';
}

function deriveTimingType(input: EvidenceQualityAssessmentInput): EvidenceTimingType {
  const context = input.retentionContext;
  if (context?.delayedRetestPlanId && isTimestamp(context.baselineEvidenceAt)) {
    return Date.parse(input.abilityEvidence.createdAt) > Date.parse(context.baselineEvidenceAt)
      ? 'delayed'
      : 'unknown';
  }
  if (isTimestamp(context?.baselineEvidenceAt)) {
    const elapsed = Date.parse(input.abilityEvidence.createdAt) - Date.parse(context.baselineEvidenceAt);
    if (elapsed >= 24 * 60 * 60 * 1000) return 'delayed';
    if (elapsed >= 0) return 'immediate';
    return 'unknown';
  }
  if (['training', 'diagnosis', 'observation'].includes(input.concreteLearningTask?.taskRole)) {
    return 'immediate';
  }
  return 'unknown';
}

function buildContextFingerprint(
  input: EvidenceQualityAssessmentInput,
  facts: EvidenceQualityFacts,
): string {
  return buildStableId('evidence-quality-context', [
    input.abilityEvidence?.id || 'unknown-evidence',
    input.concreteLearningTask?.taskId || 'unknown-task',
    input.taskExecutionResult?.executionSessionId || 'unknown-execution',
    input.taskExecutionResult?.studentResponse?.responseId || 'unknown-response',
    input.taskEvidenceReturnResult?.diagnosisResultId || 'unknown-diagnosis',
    input.taskEvidenceReturnResult?.returnId || 'unknown-return',
    input.retentionContext?.delayedRetestPlanId || 'no-plan',
    input.retentionContext?.baselineTaskId || 'no-baseline-task',
    input.retentionContext?.baselineEvidenceAt || 'no-baseline-time',
    input.retentionContext?.materialRelation || 'unknown-material',
    input.retentionContext?.difficultyRelation || 'unknown-difficulty',
    String(facts.usedHint),
    String(facts.hintCount),
    facts.taskNovelty,
    facts.timingType,
    facts.difficultyRelation,
  ]);
}

function deriveSupersedesAssessmentId(
  input: EvidenceQualityAssessmentInput,
  contextFingerprint: string,
): string | undefined {
  const previous = input.supersedesAssessment;
  if (!previous || !isEvidenceQualityAssessment(previous)) return undefined;
  if (previous.evidenceId !== input.abilityEvidence.id) return undefined;
  if (previous.contextFingerprint === contextFingerprint && previous.policyVersion === EVIDENCE_QUALITY_POLICY_VERSION) {
    return undefined;
  }
  return previous.assessmentId;
}

function buildQualityReasons(
  facts: EvidenceQualityFacts,
  level: EvidenceQualityLevel,
  eligibility: EvidenceEvaluationEligibility,
): string[] {
  const reasons = [
    `质量等级=${level}，Evaluation Eligibility=${eligibility}。`,
    facts.responseValid ? '学生作答有效，可观察本次表现。' : '学生作答无效，不能形成正式质量判断。',
    facts.taskAbilityAligned ? '任务、Diagnosis 目标与 Evidence 能力对齐。' : '目标能力未完成对齐。',
    facts.independentPerformance ? '本次为无提示独立表现。' : `本次独立性受限，提示依赖=${facts.hintDependency}。`,
    `任务新颖性=${facts.taskNovelty}，时间类型=${facts.timingType}，难度关系=${facts.difficultyRelation}。`,
  ];
  return uniqueStrings(reasons);
}

function buildLimitations(
  facts: EvidenceQualityFacts,
  hardIssues: string[],
  reviewIssues: string[],
): string[] {
  const limitations = [...hardIssues, ...reviewIssues];
  if (facts.hintDependency !== 'none') limitations.push(`提示依赖为 ${facts.hintDependency}，不能解释为完全独立表现。`);
  if (facts.taskNovelty === 'same') limitations.push('本次使用相同材料或原题，区分度有限。');
  if (facts.taskNovelty === 'unknown') limitations.push('任务新颖性缺少正式比较事实。');
  if (facts.timingType === 'immediate') limitations.push('本次为即时观察，不能替代延迟保持验证。');
  if (facts.timingType === 'unknown') limitations.push('即时或延迟关系无法确认。');
  if (facts.difficultyRelation === 'lower') limitations.push('任务难度较低，判断范围受限。');
  if (facts.difficultyRelation === 'unknown') limitations.push('任务难度关系未知。');
  limitations.push('Evidence 质量只表示观察条件，不表示学生能力高低。');
  return uniqueStrings(limitations);
}

function isDiagnosisResultLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return (
    ['exact_match', 'open_response', 'process_task'].includes(String(result.taskType)) &&
    isNonEmptyString(result.mainAbility) &&
    isNonEmptyString(result.rootCause) &&
    typeof result.confidence === 'number' &&
    !Number.isNaN(result.confidence) &&
    result.confidence >= 0 &&
    result.confidence <= 1
  );
}

function buildStableId(prefix: string, parts: string[]): string {
  const text = parts.join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
