import {
  isAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import { isConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import { isDelayedRetestPlan } from '../schemas/delayedRetestScheduling.schema.ts';
import { isEvaluationResult } from '../schemas/evaluationResult.schema.ts';
import { isGrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import { isProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import {
  RETENTION_EVALUATION_SCHEMA_VERSION,
  isRetentionEvaluationResult,
  isRetentionTaskComparisonSource,
  type ExistingPhase8ResultLink,
  type RetentionComparabilityResult,
  type RetentionComparisonFacts,
  type RetentionEvaluationFollowUp,
  type RetentionEvaluationInput,
  type RetentionEvaluationResult,
  type RetentionEvaluationStatus,
} from '../schemas/retentionEvaluation.schema.ts';
import { isTaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';
import { isTaskExecutionResult } from '../schemas/taskExecution.schema.ts';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FALLBACK_TIME = '1970-01-01T00:00:00.000Z';

export function evaluateRetention(
  input: RetentionEvaluationInput,
): RetentionEvaluationResult {
  const inputIssues = validateInputShape(input);
  const baseline = findBaselineEvidence(input);
  const delayedEvidence = findDelayedEvidence(input);
  const identityIssues = validateIdentityAndTrace(input, baseline, delayedEvidence);
  const runtimeLinkIssues = shouldRequireRuntimeLink(delayedEvidence)
    ? validateExistingPhase8ResultLink(input, delayedEvidence)
    : [];
  const reviewIssues = uniqueStrings([
    ...inputIssues,
    ...identityIssues,
    ...runtimeLinkIssues,
  ]);
  const comparisonFacts = deriveComparisonFacts(input, baseline, delayedEvidence);
  const comparability = deriveComparability({
    input,
    facts: comparisonFacts,
    delayedEvidence,
    reviewIssues,
  });
  const validationIssues = uniqueStrings([
    ...reviewIssues,
    ...comparability.validation.issues,
  ]);
  const runtimeLink = buildExistingPhase8ResultLink(
    input,
    delayedEvidence,
    validationIssues,
  );
  const status = deriveStatus({
    comparability,
    delayedEvidence,
  });
  const followUp = deriveFollowUp(status);
  const baselineEvidenceIds = baseline ? [baseline.id] : [];
  const delayedEvidenceIds = uniqueStrings(delayedEvidence.map((evidence) => evidence.id)).sort();
  const limitations = uniqueStrings([
    ...comparability.limitations,
    '保持性观察只描述本次延迟复测，不证明长期稳定掌握或能力退化。',
  ]);
  const result: RetentionEvaluationResult = {
    retentionEvaluationId: buildStableId('retention-evaluation', [
      input.studentId || 'unknown-student',
      input.targetAbilityId || 'unknown-ability',
      input.delayedRetestPlan?.planId || 'unknown-plan',
      ...baselineEvidenceIds,
      ...delayedEvidenceIds,
      RETENTION_EVALUATION_SCHEMA_VERSION,
    ]),
    studentId: input.studentId || 'unknown-student',
    targetAbilityId: input.targetAbilityId || 'unknown-ability',
    planId: input.delayedRetestPlan?.planId || 'unknown-plan',
    baselineEvidenceIds,
    delayedEvidenceIds,
    comparisonFacts,
    comparability,
    status,
    observations: buildObservations(baseline, delayedEvidence, comparisonFacts),
    limitations,
    confidence: deriveConfidence(status, comparability.status),
    followUp,
    followUpReason: deriveFollowUpReason(status, comparisonFacts),
    existingPhase8ResultLink: runtimeLink,
    schemaVersion: RETENTION_EVALUATION_SCHEMA_VERSION,
    createdAt: isTimestamp(input.evaluatedAt) ? input.evaluatedAt : FALLBACK_TIME,
    validation: {
      passed: validationIssues.length === 0 && status !== 'review_required',
      issues: validationIssues,
    },
  };

  if (isRetentionEvaluationResult(result)) return result;

  return {
    ...result,
    status: 'review_required',
    followUp: 'human_review',
    followUpReason: 'RetentionEvaluationResult 未通过 Schema 校验，需要人工复核。',
    existingPhase8ResultLink: {
      ...result.existingPhase8ResultLink,
      mode: 'blocked',
      reason: 'RetentionEvaluationResult schema validation failed.',
    },
    validation: {
      passed: false,
      issues: uniqueStrings([
        ...result.validation.issues,
        'RetentionEvaluationResult schema validation failed.',
      ]),
    },
  };
}

function validateInputShape(input: RetentionEvaluationInput): string[] {
  const issues: string[] = [];
  if (!isNonEmptyString(input.studentId)) issues.push('studentId is required.');
  if (!isNonEmptyString(input.targetAbilityId)) issues.push('targetAbilityId is required.');
  if (!isDelayedRetestPlan(input.delayedRetestPlan)) {
    issues.push('DelayedRetestPlan schema validation failed.');
  }
  if (!['available', 'completed'].includes(input.delayedRetestPlan?.status)) {
    issues.push('DelayedRetestPlan status must be available or completed.');
  }
  if (!Array.isArray(input.baselineEvidence) || !input.baselineEvidence.every(isAbilityEvidence)) {
    issues.push('Baseline AbilityEvidence schema validation failed.');
  }
  if (!isConcreteLearningTask(input.baselineTask)) {
    issues.push('Baseline ConcreteLearningTask schema validation failed.');
  }
  if (!isConcreteLearningTask(input.delayedTask)) {
    issues.push('Delayed ConcreteLearningTask schema validation failed.');
  }
  if (!isTaskExecutionResult(input.delayedTaskExecutionResult)) {
    issues.push('TaskExecutionResult schema validation failed.');
  }
  if (!isTaskEvidenceReturnResult(input.delayedTaskEvidenceReturnResult)) {
    issues.push('TaskEvidenceReturnResult schema validation failed.');
  }
  if (!isRetentionTaskComparisonSource(input.taskComparisonSource)) {
    issues.push('Retention task comparison source validation failed.');
  }
  if (!isTimestamp(input.evaluatedAt)) issues.push('evaluatedAt must be a valid timestamp.');
  if (!isNonEmptyString(input.timezone)) issues.push('timezone is required.');
  return uniqueStrings(issues);
}

function findBaselineEvidence(input: RetentionEvaluationInput): AbilityEvidence | undefined {
  return input.baselineEvidence?.find((evidence) => (
    evidence.id === input.delayedRetestPlan?.baselineEvidenceId
  ));
}

function findDelayedEvidence(input: RetentionEvaluationInput): AbilityEvidence[] {
  const evidence = input.delayedTaskEvidenceReturnResult?.abilityEvidence;
  return Array.isArray(evidence) ? evidence.filter(isAbilityEvidence) : [];
}

function validateIdentityAndTrace(
  input: RetentionEvaluationInput,
  baseline: AbilityEvidence | undefined,
  delayedEvidence: AbilityEvidence[],
): string[] {
  const issues: string[] = [];
  const plan = input.delayedRetestPlan;
  const taskReturn = input.delayedTaskEvidenceReturnResult;
  const execution = input.delayedTaskExecutionResult;
  const response = execution?.studentResponse;

  if (plan.studentId !== input.studentId) issues.push('DelayedRetestPlan studentId mismatch.');
  if (plan.targetAbilityId !== input.targetAbilityId) issues.push('DelayedRetestPlan targetAbilityId mismatch.');
  if (!baseline) {
    issues.push('DelayedRetestPlan baselineEvidenceId was not found.');
  } else {
    if (!plan.sourceEvidenceIds.includes(baseline.id)) {
      issues.push('Baseline Evidence is not linked by DelayedRetestPlan.');
    }
    if (baseline.studentId !== input.studentId) issues.push('Baseline Evidence studentId mismatch.');
    if (baseline.ability !== input.targetAbilityId) issues.push('Baseline Evidence ability mismatch.');
    if (!['growth', 'positive'].includes(baseline.evidenceType)) {
      issues.push('Baseline Evidence must be growth or positive.');
    }
    if (baseline.taskId !== input.baselineTask.taskId) {
      issues.push('Baseline Evidence taskId mismatch.');
    }
  }

  if (input.baselineTask.studentId !== input.studentId) issues.push('Baseline task studentId mismatch.');
  if (input.baselineTask.targetAbilityId !== input.targetAbilityId) issues.push('Baseline task ability mismatch.');
  if (input.delayedTask.studentId !== input.studentId) issues.push('Delayed task studentId mismatch.');
  if (input.delayedTask.targetAbilityId !== input.targetAbilityId) issues.push('Delayed task ability mismatch.');
  if (!['retest', 'transfer'].includes(input.delayedTask.taskRole)) {
    issues.push('Delayed task role must be retest or transfer.');
  }

  if (taskReturn.status !== 'evidence_returned') issues.push('TaskEvidenceReturnResult status must be evidence_returned.');
  if (taskReturn.studentId !== input.studentId) issues.push('TaskEvidenceReturnResult studentId mismatch.');
  if (taskReturn.taskId !== input.delayedTask.taskId) issues.push('TaskEvidenceReturnResult taskId mismatch.');
  if (taskReturn.concreteTask.taskId !== input.delayedTask.taskId) {
    issues.push('Nested ConcreteLearningTask taskId mismatch.');
  }
  if (taskReturn.concreteTask.studentId !== input.studentId) {
    issues.push('Nested ConcreteLearningTask studentId mismatch.');
  }
  if (taskReturn.executionSessionId !== execution.executionSessionId) {
    issues.push('TaskEvidenceReturnResult executionSessionId mismatch.');
  }
  if (taskReturn.taskExecutionResult.executionSessionId !== execution.executionSessionId) {
    issues.push('Nested TaskExecutionResult executionSessionId mismatch.');
  }
  if (execution.studentId !== input.studentId) issues.push('TaskExecutionResult studentId mismatch.');
  if (execution.taskId !== input.delayedTask.taskId) issues.push('TaskExecutionResult taskId mismatch.');
  if (response && response.studentId !== input.studentId) issues.push('StudentResponse studentId mismatch.');
  if (response && response.taskId !== input.delayedTask.taskId) issues.push('StudentResponse taskId mismatch.');
  if (response && taskReturn.responseId !== response.responseId) issues.push('StudentResponse responseId mismatch.');

  const baselineIds = new Set(input.baselineEvidence.map((evidence) => evidence.id));
  for (const evidence of delayedEvidence) {
    if (baselineIds.has(evidence.id)) issues.push(`Delayed Evidence ${evidence.id} duplicates baseline Evidence.`);
    if (evidence.studentId !== input.studentId) issues.push(`Delayed Evidence ${evidence.id} studentId mismatch.`);
    if (evidence.ability !== input.targetAbilityId) issues.push(`Delayed Evidence ${evidence.id} ability mismatch.`);
    if (evidence.taskId !== input.delayedTask.taskId) issues.push(`Delayed Evidence ${evidence.id} taskId mismatch.`);
    if (evidence.diagnosisId !== taskReturn.diagnosisResultId) {
      issues.push(`Delayed Evidence ${evidence.id} diagnosisId mismatch.`);
    }
  }

  if (baseline && delayedEvidence.some((evidence) => Date.parse(evidence.createdAt) < Date.parse(baseline.createdAt))) {
    issues.push('Delayed Evidence occurs before baseline Evidence.');
  }
  if (input.taskComparisonSource.materialRelation === 'same_material' && plan.requireNewMaterial) {
    issues.push('Delayed task reused the same material despite requireNewMaterial=true.');
  }
  if (execution.usedHint !== taskReturn.supportContext.usedHint || execution.hintCount !== taskReturn.supportContext.hintCount) {
    issues.push('Hint support context mismatch.');
  }

  return uniqueStrings(issues);
}

function deriveComparisonFacts(
  input: RetentionEvaluationInput,
  baseline: AbilityEvidence | undefined,
  delayedEvidence: AbilityEvidence[],
): RetentionComparisonFacts {
  const execution = input.delayedTaskExecutionResult;
  const taskReturn = input.delayedTaskEvidenceReturnResult;
  const response = execution.studentResponse;
  const delayedAt = latestTimestamp(delayedEvidence.map((evidence) => evidence.createdAt))
    || input.evaluatedAt
    || FALLBACK_TIME;
  const baselineAt = baseline?.createdAt || input.delayedRetestPlan?.scheduledAt || FALLBACK_TIME;
  const elapsedDays = isTimestamp(baselineAt) && isTimestamp(delayedAt)
    ? Math.max(0, (Date.parse(delayedAt) - Date.parse(baselineAt)) / DAY_IN_MS)
    : 0;
  const taskRole = ['retest', 'transfer'].includes(input.delayedTask?.taskRole)
    ? input.delayedTask.taskRole as 'retest' | 'transfer'
    : 'retest';

  return {
    contextId: buildStableId('retention-comparison', [
      input.delayedRetestPlan?.planId || 'unknown-plan',
      baseline?.id || 'missing-baseline',
      ...delayedEvidence.map((evidence) => evidence.id).sort(),
    ]),
    planId: input.delayedRetestPlan?.planId || 'unknown-plan',
    studentId: input.studentId || 'unknown-student',
    targetAbilityId: input.targetAbilityId || 'unknown-ability',
    baselineTaskId: baseline?.taskId || input.baselineTask?.taskId || 'missing-baseline-task',
    delayedTaskId: input.delayedTask?.taskId || 'missing-delayed-task',
    delayedExecutionSessionId: execution?.executionSessionId || 'missing-execution-session',
    delayedResponseId: response?.responseId || taskReturn?.responseId || 'missing-response',
    delayedDiagnosisResultId: taskReturn?.diagnosisResultId || 'missing-diagnosis',
    delayedTaskRole: taskRole,
    materialRelation: input.taskComparisonSource?.materialRelation || 'unknown',
    difficultyRelation: input.taskComparisonSource?.difficultyRelation || 'unknown',
    responseValid: deriveResponseValidity(execution),
    diagnosisAligned: deriveDiagnosisAlignment(input, delayedEvidence),
    traceabilityComplete: deriveTraceability(input, delayedEvidence),
    usedHint: Boolean(execution?.usedHint || taskReturn?.supportContext?.usedHint),
    hintCount: Math.max(execution?.hintCount || 0, taskReturn?.supportContext?.hintCount || 0),
    baselineAt,
    delayedEvidenceAt: delayedAt,
    elapsedDays,
    comparedAt: isTimestamp(input.evaluatedAt) ? input.evaluatedAt : FALLBACK_TIME,
  };
}

function deriveResponseValidity(execution: RetentionEvaluationInput['delayedTaskExecutionResult']): boolean {
  return Boolean(
    execution &&
    execution.status === 'submitted_valid' &&
    execution.canEnterDiagnosisRuntime &&
    execution.responseValidity.status === 'valid' &&
    execution.responseValidity.canDiagnose &&
    execution.studentResponse,
  );
}

function deriveDiagnosisAlignment(
  input: RetentionEvaluationInput,
  delayedEvidence: AbilityEvidence[],
): boolean {
  const taskReturn = input.delayedTaskEvidenceReturnResult;
  const diagnosis = taskReturn?.diagnosisResult;
  const acceptedAbilities = new Set([
    input.targetAbilityId,
    input.delayedTask?.targetAbilityId,
    input.delayedTask?.targetAbilityName,
    input.delayedTask?.questionMetadata?.mainAbility,
  ].filter(isNonEmptyString));
  return Boolean(
    taskReturn?.validation?.diagnosisSchemaValid &&
    taskReturn?.validation?.taskDiagnosisAligned &&
    diagnosis &&
    acceptedAbilities.has(diagnosis.mainAbility) &&
    delayedEvidence.every((evidence) => evidence.ability === input.targetAbilityId),
  );
}

function deriveTraceability(
  input: RetentionEvaluationInput,
  delayedEvidence: AbilityEvidence[],
): boolean {
  const taskReturn = input.delayedTaskEvidenceReturnResult;
  const execution = input.delayedTaskExecutionResult;
  const responseId = execution?.studentResponse?.responseId;
  if (
    !taskReturn?.validation?.traceabilityComplete ||
    !responseId ||
    !taskReturn.diagnosisResultId ||
    taskReturn.taskId !== input.delayedTask?.taskId ||
    taskReturn.executionSessionId !== execution?.executionSessionId ||
    taskReturn.responseId !== responseId
  ) return false;

  return delayedEvidence.every((evidence) => taskReturn.evidenceTraceLinks.some((link) => (
    link.taskId === evidence.taskId &&
    link.executionSessionId === execution.executionSessionId &&
    link.responseId === responseId &&
    link.diagnosisResultId === evidence.diagnosisId
  )));
}

function deriveComparability(input: {
  input: RetentionEvaluationInput;
  facts: RetentionComparisonFacts;
  delayedEvidence: AbilityEvidence[];
  reviewIssues: string[];
}): RetentionComparabilityResult {
  if (input.reviewIssues.length > 0) {
    return {
      status: 'review_required',
      reasons: ['身份、追溯、时间或正式 Runtime 结果存在冲突。'],
      limitations: input.reviewIssues,
      validation: { passed: false, issues: input.reviewIssues },
    };
  }

  if (!input.facts.responseValid || !input.facts.diagnosisAligned || !input.facts.traceabilityComplete) {
    const issues = uniqueStrings([
      !input.facts.responseValid ? 'StudentResponse is not valid for diagnosis.' : '',
      !input.facts.diagnosisAligned ? 'Diagnosis is not aligned with target ability.' : '',
      !input.facts.traceabilityComplete ? 'Evidence traceability is incomplete.' : '',
    ].filter(Boolean));
    return {
      status: 'review_required',
      reasons: ['作答有效性、Diagnosis 对齐或追溯校验失败。'],
      limitations: issues,
      validation: { passed: false, issues },
    };
  }

  const delayedTypes = new Set(input.delayedEvidence.map((evidence) => evidence.evidenceType));
  const delayedBeforePlan = input.delayedEvidence.some((evidence) => (
    Date.parse(evidence.createdAt) < Date.parse(input.input.delayedRetestPlan.plannedRetestAt)
  ));
  if (
    input.delayedEvidence.length === 0 ||
    delayedTypes.size === 0 ||
    [...delayedTypes].every((type) => type === 'insufficient') ||
    input.facts.materialRelation === 'unknown' ||
    input.facts.difficultyRelation === 'unknown' ||
    delayedBeforePlan
  ) {
    const limitations = uniqueStrings([
      input.delayedEvidence.length === 0 ? '缺少新的延迟复测 Evidence。' : '',
      [...delayedTypes].every((type) => type === 'insufficient') ? '延迟 Evidence 只有 insufficient。' : '',
      input.facts.materialRelation === 'unknown' ? '材料关系未知。' : '',
      input.facts.difficultyRelation === 'unknown' ? '难度关系未知。' : '',
      delayedBeforePlan ? '延迟 Evidence 早于计划复测时间。' : '',
    ].filter(Boolean));
    return {
      status: 'not_comparable',
      reasons: ['当前事实不足以形成可靠保持性比较。'],
      limitations,
      validation: { passed: true, issues: [] },
    };
  }

  if (
    input.facts.usedHint ||
    input.facts.materialRelation === 'similar_material' ||
    input.facts.difficultyRelation === 'lower' ||
    input.facts.difficultyRelation === 'higher'
  ) {
    const limitations = uniqueStrings([
      input.facts.usedHint ? `使用提示 ${input.facts.hintCount} 次。` : '',
      input.facts.materialRelation === 'similar_material' ? '材料相似，独立性有限。' : '',
      input.facts.difficultyRelation === 'lower' ? '延迟任务难度低于基线。' : '',
      input.facts.difficultyRelation === 'higher' ? '延迟任务难度高于基线，较弱表现不能直接解释为下降。' : '',
    ].filter(Boolean));
    return {
      status: 'limited',
      reasons: ['结构合法，但存在降低比较强度的条件。'],
      limitations,
      validation: { passed: true, issues: [] },
    };
  }

  return {
    status: 'comparable',
    reasons: ['学生、能力、任务角色、材料、难度、作答、诊断和追溯均满足比较条件。'],
    limitations: [],
    validation: { passed: true, issues: [] },
  };
}

function deriveStatus(input: {
  comparability: RetentionComparabilityResult;
  delayedEvidence: AbilityEvidence[];
}): RetentionEvaluationStatus {
  if (input.comparability.status === 'review_required') return 'review_required';
  if (input.comparability.status === 'not_comparable') return 'insufficient_evidence';

  const types = new Set(input.delayedEvidence.map((evidence) => evidence.evidenceType));
  const hasPositiveDirection = types.has('positive') || types.has('growth');
  const hasWeakness = types.has('weakness');
  if (hasPositiveDirection && hasWeakness) return 'performance_fluctuated';
  if (hasWeakness) {
    return input.comparability.status === 'comparable'
      ? 'declined_observation'
      : 'insufficient_evidence';
  }
  if (hasPositiveDirection) {
    return input.comparability.status === 'comparable'
      ? 'retained'
      : 'partially_retained';
  }
  return 'insufficient_evidence';
}

function buildExistingPhase8ResultLink(
  input: RetentionEvaluationInput,
  delayedEvidence: AbilityEvidence[],
  blockingIssues: string[],
): ExistingPhase8ResultLink {
  const taskReturn = input.delayedTaskEvidenceReturnResult;
  const evidenceIds = uniqueStrings(delayedEvidence.map((evidence) => evidence.id)).sort();
  const idempotencyKey = buildStableId('retention-phase8-link', [
    input.studentId || 'unknown-student',
    input.targetAbilityId || 'unknown-ability',
    ...evidenceIds,
  ]);
  const issues = validateExistingPhase8ResultLink(input, delayedEvidence);
  const allIssues = uniqueStrings([...blockingIssues, ...issues]);
  if (allIssues.length > 0 || !shouldRequireRuntimeLink(delayedEvidence)) {
    return {
      mode: 'blocked',
      evidenceIds,
      idempotencyKey,
      reason: allIssues.length > 0
        ? allIssues.join(' ')
        : '当前没有可关联的正式 delayed Evidence。',
    };
  }
  return {
    mode: 'reuse_existing',
    evidenceIds,
    evaluationResultId: taskReturn.evaluationResult?.evaluationId,
    profileUpdateDecisionId: taskReturn.profileUpdateDecision?.decisionId,
    growthMemoryRecordId: taskReturn.growthMemoryRecord?.recordId,
    idempotencyKey,
    reason: '延迟 Evidence 已由 Phase 9.3 完成一次正式回流，Phase 13.3 只关联已有结果。',
  };
}

function validateExistingPhase8ResultLink(
  input: RetentionEvaluationInput,
  delayedEvidence: AbilityEvidence[],
): string[] {
  const issues: string[] = [];
  const taskReturn = input.delayedTaskEvidenceReturnResult;
  const evaluation = taskReturn?.evaluationResult;
  const decision = taskReturn?.profileUpdateDecision;
  const memory = taskReturn?.growthMemoryRecord;
  const evidenceIds = delayedEvidence.map((evidence) => evidence.id);

  if (!isEvaluationResult(evaluation)) issues.push('Existing EvaluationResult is missing or invalid.');
  if (!isProfileUpdateDecision(decision)) issues.push('Existing ProfileUpdateDecision is missing or invalid.');
  if (!isGrowthMemoryRecord(memory)) issues.push('Existing GrowthMemoryRecord is missing or invalid.');
  if (issues.length > 0 || !evaluation || !decision || !memory) return issues;

  if (evaluation.studentId !== input.studentId) issues.push('Existing EvaluationResult studentId mismatch.');
  if (evaluation.abilityId !== input.targetAbilityId) issues.push('Existing EvaluationResult abilityId mismatch.');
  if (!evidenceIds.every((id) => evaluation.evidenceLinks.includes(id))) {
    issues.push('Existing EvaluationResult does not link every delayed Evidence.');
  }
  if (decision.studentId !== input.studentId) issues.push('Existing ProfileUpdateDecision studentId mismatch.');
  if (decision.abilityId !== input.targetAbilityId) issues.push('Existing ProfileUpdateDecision abilityId mismatch.');
  if (decision.evidenceLinks.some((id) => !evaluation.evidenceLinks.includes(id))) {
    issues.push('Existing ProfileUpdateDecision evidenceLinks are not aligned with EvaluationResult.');
  }
  if (memory.studentId !== input.studentId) issues.push('Existing GrowthMemoryRecord studentId mismatch.');
  if (memory.abilityId !== input.targetAbilityId) issues.push('Existing GrowthMemoryRecord abilityId mismatch.');
  if (memory.evaluationResultId !== evaluation.evaluationId) {
    issues.push('Existing GrowthMemoryRecord evaluationResultId mismatch.');
  }
  if (memory.profileUpdateDecisionId !== decision.decisionId) {
    issues.push('Existing GrowthMemoryRecord profileUpdateDecisionId mismatch.');
  }
  return uniqueStrings(issues);
}

function shouldRequireRuntimeLink(delayedEvidence: AbilityEvidence[]): boolean {
  return delayedEvidence.some((evidence) => evidence.evidenceType !== 'insufficient');
}

function buildObservations(
  baseline: AbilityEvidence | undefined,
  delayedEvidence: AbilityEvidence[],
  facts: RetentionComparisonFacts,
): string[] {
  return uniqueStrings([
    baseline ? `基线 Evidence 为 ${baseline.evidenceType}。` : '未找到正式基线 Evidence。',
    delayedEvidence.length > 0
      ? `延迟 Evidence 类型为 ${uniqueStrings(delayedEvidence.map((evidence) => evidence.evidenceType)).join(' / ')}。`
      : '未产生新的延迟 Evidence。',
    `材料关系为 ${facts.materialRelation}，难度关系为 ${facts.difficultyRelation}。`,
    facts.usedHint ? `本次使用提示 ${facts.hintCount} 次。` : '本次未使用提示。',
  ]);
}

function deriveFollowUp(status: RetentionEvaluationStatus): RetentionEvaluationFollowUp {
  if (status === 'retained') return 'continue_observation';
  if (status === 'partially_retained') return 'independent_retest';
  if (status === 'performance_fluctuated') return 'collect_more_evidence';
  if (status === 'declined_observation') return 'continue_training';
  if (status === 'review_required') return 'human_review';
  return 'collect_more_evidence';
}

function deriveFollowUpReason(
  status: RetentionEvaluationStatus,
  facts: RetentionComparisonFacts,
): string {
  if (status === 'retained') return '本次可比延迟复测再次出现正向或改善表现，继续观察即可。';
  if (status === 'partially_retained') return facts.usedHint
    ? '本次在提示支持下完成，应安排无提示独立复测。'
    : '当前比较条件有限，应再次独立复测。';
  if (status === 'performance_fluctuated') return '延迟 Evidence 方向冲突，需要补充更多可比观察。';
  if (status === 'declined_observation') return '本次可比复测出现较弱表现，应继续训练并再次观察。';
  if (status === 'review_required') return '正式对象存在身份、追溯或执行冲突，需要人工复核。';
  return '当前证据不足以形成保持性判断，需要收集更多正式 Evidence。';
}

function deriveConfidence(
  status: RetentionEvaluationStatus,
  comparability: RetentionComparabilityResult['status'],
): number {
  if (status === 'review_required') return 0.2;
  if (status === 'insufficient_evidence') return 0.35;
  if (status === 'performance_fluctuated') return 0.55;
  if (status === 'partially_retained' || comparability === 'limited') return 0.62;
  if (status === 'declined_observation') return 0.68;
  return 0.78;
}

function latestTimestamp(values: string[]): string | undefined {
  const valid = values.filter(isTimestamp).sort((a, b) => Date.parse(b) - Date.parse(a));
  return valid[0];
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
