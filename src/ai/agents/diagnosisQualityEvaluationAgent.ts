import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  DIAGNOSIS_PROMPT_REGRESSION_SCHEMA_VERSION,
  DIAGNOSIS_QUALITY_EVALUATION_SCHEMA_VERSION,
  DIAGNOSIS_QUALITY_POLICY_VERSION,
  DIAGNOSIS_STABILITY_POLICY_VERSION,
  type DiagnosisPromptRegressionReport,
  type DiagnosisQualityEvaluation,
  type DiagnosisQualityEvaluationInput,
  type DiagnosisQualityMetrics,
  type DiagnosisSampleStabilityResult,
} from '../schemas/diagnosisQualityEvaluation.schema.ts';

const OVERREACH_PATTERNS = ['长期掌握', '已经掌握', '永久', '天生', '稳定提升', '能力很差', '能力退化'];

export function evaluateDiagnosisQuality(
  input: DiagnosisQualityEvaluationInput,
): DiagnosisQualityEvaluation {
  const { sample, runtimeResult } = input;
  const candidate = runtimeResult?.diagnosisCandidate;
  const violations: string[] = [];
  const limitations: string[] = [];
  const validationIssues = validateInput(input);
  const isInvalidGateCase = sample.validityExpectation === 'should_be_blocked_by_validity_gate';
  const invalidHandledSafely = isInvalidGateCase
    ? !candidate && !runtimeResult?.canEnterEvidenceReturn
    : true;

  if (isInvalidGateCase && !invalidHandledSafely) {
    violations.push('Invalid response produced a formal Diagnosis candidate or Evidence Return handoff.');
  }

  const aggregate = candidate ? candidateText(candidate) : '';
  const mainAbilityAccepted = Boolean(candidate) &&
    sample.expectedBoundaries.allowedMainAbilities.includes(candidate!.mainAbility);
  const answerStatusAccepted = Boolean(candidate?.answerStatus) &&
    sample.expectedBoundaries.allowedAnswerStatuses.includes(candidate!.answerStatus!);
  const rootCauseAcceptable = Boolean(candidate) && matchesAnyPattern(
    candidate!.rootCause,
    sample.expectedBoundaries.acceptableRootCausePatterns,
  );
  const matchedFacts = sample.expectedBoundaries.requiredFacts.filter((fact) =>
    normalize(aggregate).includes(normalize(fact))
  );
  const missingFacts = sample.expectedBoundaries.requiredFacts.filter((fact) =>
    !matchedFacts.includes(fact)
  );
  const forbiddenClaims = [
    ...sample.expectedBoundaries.forbiddenClaims,
    ...sample.expectedBoundaries.forbiddenEvidenceClaims,
  ].filter((claim) => normalize(aggregate).includes(normalize(claim)));
  if (forbiddenClaims.length > 0) violations.push(...forbiddenClaims.map((claim) => `Forbidden claim: ${claim}`));

  const quotes = candidate ? extractQuotedPhrases(aggregate) : [];
  const studentAnswer = sample.taskExecutionResult.studentResponse?.answerText || '';
  const taskSource = [
    sample.concreteTask.readingText || '',
    sample.concreteTask.question,
    sample.concreteTask.referenceAnswer || '',
  ].join('\n');
  const inventedQuotes = quotes.filter((quote) =>
    !normalize(studentAnswer).includes(normalize(quote)) &&
    !normalize(taskSource).includes(normalize(quote))
  );
  if (inventedQuotes.length > 0) {
    violations.push(...inventedQuotes.map((quote) => `Invented quote: ${quote}`));
  }
  const studentQuoteFaithful = inventedQuotes.length === 0;
  const textEvidenceFaithful = forbiddenClaims.length === 0 && inventedQuotes.length === 0;
  const boundaryOverreach = OVERREACH_PATTERNS.filter((pattern) => aggregate.includes(pattern));
  if (boundaryOverreach.length > 0) {
    violations.push(...boundaryOverreach.map((pattern) => `Boundary overreach: ${pattern}`));
  }
  const semanticRepairSafe = !(runtimeResult?.runRecord.repairOperations || [])
    .some((operation) => operation.semanticField);
  if (!semanticRepairSafe) violations.push('Repair changed a core semantic field.');

  const formalCandidateSchemaValid = Boolean(candidate) && Boolean(runtimeResult?.validation.schemaValid);
  const providerOutputReceived = Boolean(runtimeResult?.runRecord.rawOutputRef);
  const noCriticalHallucination = inventedQuotes.length === 0 &&
    forbiddenClaims.length === 0 &&
    semanticRepairSafe;
  const dimensions = {
    providerOutputReceived,
    rawSchemaValid: input.rawSchemaValid,
    postRepairSchemaValid: input.postRepairSchemaValid,
    formalCandidateSchemaValid,
    mainAbilityAccepted: isInvalidGateCase ? true : mainAbilityAccepted,
    answerStatusAccepted: isInvalidGateCase ? true : answerStatusAccepted,
    rootCauseAcceptable: isInvalidGateCase ? true : rootCauseAcceptable,
    requiredFactsPresent: isInvalidGateCase ? true : missingFacts.length === 0,
    studentQuoteFaithful,
    textEvidenceFaithful,
    invalidResponseHandledSafely: invalidHandledSafely,
    noBoundaryOverreach: boundaryOverreach.length === 0,
    noCriticalHallucination,
    semanticRepairSafe,
  };

  let qualityLevel: DiagnosisQualityEvaluation['qualityLevel'];
  if (validationIssues.length > 0 || !noCriticalHallucination || !dimensions.noBoundaryOverreach || !invalidHandledSafely) {
    qualityLevel = 'critical_violation';
  } else if (isInvalidGateCase && invalidHandledSafely) {
    qualityLevel = 'accepted';
  } else if (!candidate || !input.postRepairSchemaValid || !formalCandidateSchemaValid || !mainAbilityAccepted || !answerStatusAccepted) {
    qualityLevel = 'unacceptable';
  } else if (!rootCauseAcceptable || missingFacts.length > 0 || !textEvidenceFaithful) {
    qualityLevel = 'questionable';
  } else {
    qualityLevel = 'accepted';
  }

  if (!input.rawSchemaValid && input.postRepairSchemaValid) limitations.push('Raw output required allowlisted structural repair.');
  if (qualityLevel === 'questionable') limitations.push('Candidate requires human review before any formal handoff.');
  const offlineDecision = qualityLevel === 'accepted'
    ? 'accepted_candidate'
    : qualityLevel === 'questionable'
      ? 'human_review'
      : qualityLevel === 'critical_violation'
        ? 'critical_alert'
        : 'blocked';

  return {
    schemaVersion: DIAGNOSIS_QUALITY_EVALUATION_SCHEMA_VERSION,
    evaluationId: `diagnosis-quality-${sample.sampleId}-${runtimeResult?.runRecord.runId || 'validity-gate'}`,
    sampleId: sample.sampleId,
    requestId: runtimeResult?.requestId,
    datasetVersion: input.datasetVersion,
    promptVersion: runtimeResult?.runRecord.promptVersion,
    provider: runtimeResult?.runRecord.providerConfigId,
    qualityLevel,
    dimensions,
    matchedFacts,
    missingFacts,
    violations,
    limitations,
    offlineDecision,
    canBecomeFormalCandidate: qualityLevel === 'accepted' && !isInvalidGateCase,
    evaluatedAt: input.evaluatedAt,
    policyVersion: DIAGNOSIS_QUALITY_POLICY_VERSION,
    validation: {
      passed: validationIssues.length === 0,
      issues: validationIssues,
    },
  };
}

export function evaluateDiagnosisSampleStability(
  evaluations: DiagnosisQualityEvaluation[],
): DiagnosisSampleStabilityResult {
  const sampleId = evaluations[0]?.sampleId || 'unknown-sample';
  const sameSample = evaluations.every((item) => item.sampleId === sampleId);
  const acceptedRunCount = count(evaluations, 'accepted');
  const questionableRunCount = count(evaluations, 'questionable');
  const unacceptableRunCount = count(evaluations, 'unacceptable');
  const criticalRunCount = count(evaluations, 'critical_violation');
  const candidateAbilities = evaluations.map((item) => item.dimensions.mainAbilityAccepted);
  const candidateStatuses = evaluations.map((item) => item.dimensions.answerStatusAccepted);
  const rootBoundaries = evaluations.map((item) => item.dimensions.rootCauseAcceptable);
  let status: DiagnosisSampleStabilityResult['status'];
  if (!sameSample || evaluations.length < 3) status = 'insufficient_runs';
  else if (criticalRunCount > 0) status = 'critical_violation';
  else if (unacceptableRunCount > 0) status = 'semantically_unstable';
  else if (acceptedRunCount === evaluations.length) status = 'stable_accepted';
  else status = 'stable_questionable';
  return {
    sampleId,
    runCount: evaluations.length,
    status,
    acceptedRunCount,
    questionableRunCount,
    unacceptableRunCount,
    criticalRunCount,
    mainAbilityStable: candidateAbilities.every(Boolean),
    answerStatusStable: candidateStatuses.every(Boolean),
    rootCauseWithinAcceptableBoundary: rootBoundaries.every(Boolean),
    reasons: sameSample ? [] : ['Evaluations belong to different samples.'],
    policyVersion: DIAGNOSIS_STABILITY_POLICY_VERSION,
  };
}

export function buildDiagnosisQualityMetrics(input: {
  evaluations: DiagnosisQualityEvaluation[];
  stabilityResults: DiagnosisSampleStabilityResult[];
  datasetVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
}): DiagnosisQualityMetrics {
  const diagnosable = input.evaluations.filter((item) => item.requestId);
  const providerOutputs = diagnosable.filter((item) => item.dimensions.providerOutputReceived);
  const formalCandidates = diagnosable.filter((item) => item.dimensions.formalCandidateSchemaValid);
  const denominator = Math.max(1, formalCandidates.length);
  const all = input.evaluations;
  const allDenominator = Math.max(1, all.length);
  const stableDenominator = Math.max(1, input.stabilityResults.length);
  return {
    datasetVersion: input.datasetVersion,
    promptVersion: input.promptVersion,
    provider: input.provider,
    model: input.model,
    runCount: all.length,
    sampleCount: new Set(all.map((item) => item.sampleId)).size,
    rawSchemaValidRate: rate(providerOutputs, (item) => item.dimensions.rawSchemaValid),
    postRepairSchemaValidRate: rate(providerOutputs, (item) => item.dimensions.postRepairSchemaValid),
    formalCandidateSchemaValidRate: rate(providerOutputs, (item) => item.dimensions.formalCandidateSchemaValid),
    mainAbilityAccuracy: formalCandidates.filter((item) => item.dimensions.mainAbilityAccepted).length / denominator,
    answerStatusAccuracy: formalCandidates.filter((item) => item.dimensions.answerStatusAccepted).length / denominator,
    rootCauseAcceptability: formalCandidates.filter((item) => item.dimensions.rootCauseAcceptable).length / denominator,
    studentQuoteFidelity: rate(formalCandidates, (item) => item.dimensions.studentQuoteFaithful),
    textEvidenceFidelity: rate(formalCandidates, (item) => item.dimensions.textEvidenceFaithful),
    semanticStabilityRate: input.stabilityResults.filter((item) => ['stable_accepted', 'stable_questionable'].includes(item.status)).length / stableDenominator,
    samplesAcceptedAtLeastTwoOfThreeRate: input.stabilityResults.filter((item) => item.acceptedRunCount >= 2).length / stableDenominator,
    samplesStableThreeOfThreeRate: input.stabilityResults.filter((item) => item.status === 'stable_accepted').length / stableDenominator,
    samplesEverUnacceptableRate: input.stabilityResults.filter((item) => item.unacceptableRunCount > 0 || item.criticalRunCount > 0).length / stableDenominator,
    criticalViolationCount: all.filter((item) => item.qualityLevel === 'critical_violation').length,
    boundaryOverreachCount: all.filter((item) => !item.dimensions.noBoundaryOverreach).length,
    invalidResponseWeaknessCount: all.filter((item) => !item.dimensions.invalidResponseHandledSafely).length,
  };
}

export function compareDiagnosisPromptMetrics(
  baseline: DiagnosisQualityMetrics,
  candidate: DiagnosisQualityMetrics,
): DiagnosisPromptRegressionReport {
  const issues: string[] = [];
  if (baseline.datasetVersion !== candidate.datasetVersion) issues.push('Dataset versions do not match.');
  if (baseline.provider !== candidate.provider || baseline.model !== candidate.model) {
    issues.push('Provider or model changed; prompt-only comparison is invalid.');
  }
  const regressions: string[] = [];
  const improvements: string[] = [];
  compareRate('mainAbilityAccuracy', baseline.mainAbilityAccuracy, candidate.mainAbilityAccuracy, regressions, improvements);
  compareRate('answerStatusAccuracy', baseline.answerStatusAccuracy, candidate.answerStatusAccuracy, regressions, improvements);
  compareRate('rootCauseAcceptability', baseline.rootCauseAcceptability, candidate.rootCauseAcceptability, regressions, improvements);
  compareRate('semanticStabilityRate', baseline.semanticStabilityRate, candidate.semanticStabilityRate, regressions, improvements);
  if (candidate.criticalViolationCount > baseline.criticalViolationCount) regressions.push('criticalViolationCount increased.');
  if (candidate.boundaryOverreachCount > 0) regressions.push('candidate contains boundary overreach.');
  if (candidate.invalidResponseWeaknessCount > 0) regressions.push('candidate mishandles invalid responses.');

  const hardThresholdsPassed = candidate.formalCandidateSchemaValidRate === 1 &&
    candidate.mainAbilityAccuracy >= 0.9 &&
    candidate.answerStatusAccuracy >= 0.85 &&
    candidate.rootCauseAcceptability >= 0.8 &&
    candidate.studentQuoteFidelity === 1 &&
    candidate.textEvidenceFidelity === 1 &&
    candidate.criticalViolationCount === 0 &&
    candidate.boundaryOverreachCount === 0 &&
    candidate.invalidResponseWeaknessCount === 0 &&
    candidate.semanticStabilityRate >= 0.85;
  const recommendation = issues.length > 0
    ? 'review_required'
    : !hardThresholdsPassed || regressions.length > 0
      ? 'keep_baseline'
      : 'accept_candidate';
  return {
    schemaVersion: DIAGNOSIS_PROMPT_REGRESSION_SCHEMA_VERSION,
    reportId: `prompt-regression-${baseline.promptVersion}-to-${candidate.promptVersion}`,
    baseline,
    candidate,
    recommendation,
    regressions,
    improvements,
    validation: { passed: issues.length === 0, issues },
  };
}

function validateInput(input: DiagnosisQualityEvaluationInput): string[] {
  const issues: string[] = [];
  if (!input.sample.sampleId) issues.push('sampleId is required.');
  if (!input.datasetVersion) issues.push('datasetVersion is required.');
  if (!input.evaluationRubricVersion) issues.push('evaluationRubricVersion is required.');
  if (input.sample.expectedBoundaries.allowedMainAbilities.length === 0) issues.push('allowedMainAbilities is empty.');
  if (input.sample.expectedBoundaries.allowedAnswerStatuses.length === 0) issues.push('allowedAnswerStatuses is empty.');
  const forbidden = new Set(input.sample.expectedBoundaries.forbiddenClaims.map(normalize));
  if (input.sample.expectedBoundaries.requiredFacts.some((fact) => forbidden.has(normalize(fact)))) {
    issues.push('Human annotation contains conflicting required and forbidden facts.');
  }
  const result = input.runtimeResult;
  if (result) {
    if (result.runRecord.studentId !== input.sample.concreteTask.studentId ||
        result.runRecord.taskId !== input.sample.concreteTask.taskId ||
        result.runRecord.executionSessionId !== input.sample.taskExecutionResult.executionSessionId) {
      issues.push('Runtime result identity does not match the evaluation sample.');
    }
  }
  return issues;
}

function candidateText(candidate: DiagnosisResult): string {
  return [
    candidate.surfaceError,
    candidate.rootCause,
    candidate.diagnosisSummary,
    candidate.nextTraining,
    ...candidate.abilityEvidence,
    ...(candidate.rubricItems || []).flatMap((item) => [item.evidence || '', item.missingReason || '']),
  ].join('\n');
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, 'i').test(value);
    } catch {
      return normalize(value).includes(normalize(pattern));
    }
  });
}

function extractQuotedPhrases(value: string): string[] {
  return [...value.matchAll(/[“\"]([^”\"]{2,40})[”\"]/g)].map((match) => match[1].trim());
}

function count(items: DiagnosisQualityEvaluation[], level: DiagnosisQualityEvaluation['qualityLevel']): number {
  return items.filter((item) => item.qualityLevel === level).length;
}

function rate(items: DiagnosisQualityEvaluation[], predicate: (item: DiagnosisQualityEvaluation) => boolean): number {
  return items.length === 0 ? 0 : items.filter(predicate).length / items.length;
}

function compareRate(
  name: string,
  baseline: number,
  candidate: number,
  regressions: string[],
  improvements: string[],
): void {
  if (candidate < baseline) regressions.push(`${name} decreased from ${baseline} to ${candidate}.`);
  if (candidate > baseline) improvements.push(`${name} increased from ${baseline} to ${candidate}.`);
}

function normalize(value: string): string {
  return value.replace(/[\s，。！？；：“”‘’、,.!?;:'"-]/g, '').toLowerCase();
}
