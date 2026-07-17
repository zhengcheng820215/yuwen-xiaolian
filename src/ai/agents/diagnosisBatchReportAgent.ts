import { buildDiagnosisQualityMetrics } from './diagnosisQualityEvaluationAgent.ts';
import {
  DIAGNOSIS_BATCH_REPORT_SCHEMA_VERSION,
  type DiagnosisBatchReport,
  type DiagnosisBatchRunSummary,
  type DiagnosisEvaluationDataset,
  type DiagnosisMetricDetail,
  type DiagnosisQualityEvaluation,
  type DiagnosisSampleStabilityResult,
} from '../schemas/diagnosisQualityEvaluation.schema.ts';

export type DiagnosisBatchReportConfig = DiagnosisBatchReport['configuration'];

export function validateDiagnosisBatchPlan(input: {
  plannedProviderCalls: number;
  maxProviderCalls: number;
}): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(input.plannedProviderCalls) || input.plannedProviderCalls < 0) {
    issues.push('plannedProviderCalls must be a non-negative integer.');
  }
  if (!Number.isInteger(input.maxProviderCalls) || input.maxProviderCalls <= 0) {
    issues.push('maxProviderCalls must be a positive integer.');
  }
  if (input.plannedProviderCalls > input.maxProviderCalls) {
    issues.push(`Planned Provider calls ${input.plannedProviderCalls} exceed budget ${input.maxProviderCalls}.`);
  }
  return issues;
}

export function getDiagnosisBatchBudgetExceededReason(input: {
  totalTokens: number;
  maxTotalTokens: number;
  providerFailedRuns: number;
  maxProviderFailedRuns: number;
}): string | undefined {
  if (input.totalTokens > input.maxTotalTokens) {
    return `Token budget exceeded: ${input.totalTokens} > ${input.maxTotalTokens}.`;
  }
  if (input.providerFailedRuns >= input.maxProviderFailedRuns) {
    return `Provider failed-run budget reached: ${input.providerFailedRuns}.`;
  }
  return undefined;
}

export function buildDiagnosisBatchReport(input: {
  reportId: string;
  createdAt: string;
  dataset: DiagnosisEvaluationDataset;
  configuration: DiagnosisBatchReportConfig;
  runs: DiagnosisBatchRunSummary[];
  evaluations: DiagnosisQualityEvaluation[];
  stabilityResults: DiagnosisSampleStabilityResult[];
  abortedReason?: string;
}): DiagnosisBatchReport {
  const { dataset, configuration, runs, evaluations, stabilityResults } = input;
  const plannedLogicalRuns = configuration.sampleLimit * configuration.repetitions;
  const selectedIdSet = configuration.selectedSampleIds
    ? new Set(configuration.selectedSampleIds)
    : undefined;
  const selectedSamples = selectedIdSet
    ? dataset.samples.filter((sample) => selectedIdSet.has(sample.sampleId))
    : dataset.samples.slice(0, configuration.sampleLimit);
  const providerEligibleSamples = selectedSamples.filter((sample) =>
    sample.validityExpectation !== 'should_be_blocked_by_validity_gate'
  );
  const plannedProviderCalls = providerEligibleSamples.length * configuration.repetitions;
  const completedProviderRuns = runs.filter((run) => run.outcome === 'provider_completed');
  const failedProviderRuns = runs.filter((run) => run.outcome === 'provider_failed');
  const validityBlockedRuns = runs.filter((run) => run.outcome === 'validity_blocked');
  const providerOutputs = evaluations.filter((item) => item.dimensions.providerOutputReceived);
  const formalCandidates = evaluations.filter((item) => item.dimensions.formalCandidateSchemaValid);
  const invalidEvaluations = evaluations.filter((item) => !item.requestId);
  const providerEligibleSampleIds = new Set(providerEligibleSamples.map((sample) => sample.sampleId));
  const providerStabilityResults = stabilityResults.filter((item) =>
    providerEligibleSampleIds.has(item.sampleId)
  );
  const stableEvaluable = providerStabilityResults.filter((item) => item.status !== 'insufficient_runs');

  const qualityMetrics = buildDiagnosisQualityMetrics({
    evaluations,
    stabilityResults: providerStabilityResults,
    datasetVersion: dataset.datasetVersion,
    promptVersion: configuration.promptVersion,
    provider: configuration.provider,
    model: configuration.model,
  });
  const metricDetails: Record<string, DiagnosisMetricDetail> = {
    providerAvailability: metric(
      completedProviderRuns.length,
      plannedProviderCalls,
      plannedLogicalRuns - plannedProviderCalls,
      plannedLogicalRuns === plannedProviderCalls ? {} : { validity_gate_blocked: plannedLogicalRuns - plannedProviderCalls },
    ),
    rawSchemaValidity: metric(
      providerOutputs.filter((item) => item.dimensions.rawSchemaValid).length,
      providerOutputs.length,
      plannedProviderCalls - providerOutputs.length,
      exclusionReasonsForProviderOutput(plannedProviderCalls, providerOutputs.length),
    ),
    postRepairSchemaValidity: metric(
      providerOutputs.filter((item) => item.dimensions.postRepairSchemaValid).length,
      providerOutputs.length,
      plannedProviderCalls - providerOutputs.length,
      exclusionReasonsForProviderOutput(plannedProviderCalls, providerOutputs.length),
    ),
    formalCandidateSchemaValidity: metric(
      formalCandidates.length,
      providerOutputs.length,
      plannedProviderCalls - providerOutputs.length,
      exclusionReasonsForProviderOutput(plannedProviderCalls, providerOutputs.length),
    ),
    mainAbilityAccuracy: candidateMetric(formalCandidates, (item) => item.dimensions.mainAbilityAccepted, providerOutputs.length),
    answerStatusAccuracy: candidateMetric(formalCandidates, (item) => item.dimensions.answerStatusAccepted, providerOutputs.length),
    rootCauseAcceptability: candidateMetric(formalCandidates, (item) => item.dimensions.rootCauseAcceptable, providerOutputs.length),
    studentQuoteFidelity: candidateMetric(formalCandidates, (item) => item.dimensions.studentQuoteFaithful, providerOutputs.length),
    textEvidenceFidelity: candidateMetric(formalCandidates, (item) => item.dimensions.textEvidenceFaithful, providerOutputs.length),
    invalidResponseSafety: metric(
      invalidEvaluations.filter((item) => item.dimensions.invalidResponseHandledSafely).length,
      invalidEvaluations.length,
      0,
      {},
    ),
    semanticStability: metric(
      stableEvaluable.filter((item) => ['stable_accepted', 'stable_questionable'].includes(item.status)).length,
      stableEvaluable.length,
      stabilityResults.length - stableEvaluable.length,
      stabilityExclusionReasons(stabilityResults, providerStabilityResults, stableEvaluable),
    ),
    samplesAcceptedAtLeastTwoOfThree: metric(
      stableEvaluable.filter((item) => item.acceptedRunCount >= 2).length,
      stableEvaluable.length,
      stabilityResults.length - stableEvaluable.length,
      stabilityExclusionReasons(stabilityResults, providerStabilityResults, stableEvaluable),
    ),
    samplesStableThreeOfThree: metric(
      stableEvaluable.filter((item) => item.status === 'stable_accepted').length,
      stableEvaluable.length,
      stabilityResults.length - stableEvaluable.length,
      stabilityExclusionReasons(stabilityResults, providerStabilityResults, stableEvaluable),
    ),
  };

  const categoryDistribution = countBy(selectedSamples.map((sample) => sample.category));
  const abilityDistribution = countBy(selectedSamples.map((sample) => sample.targetAbilityId));
  const stabilityDistribution = countBy(stabilityResults.map((item) => item.status));
  const errorCategoryCounts = countBy(
    failedProviderRuns.map((run) => run.providerErrorCategory || 'unknown'),
  );
  const manualReviewSampleIds = selectManualReviewSamples(runs, stabilityResults);
  const acceptedAuditSampleIds = selectAcceptedAuditSamples(
    { ...dataset, samples: selectedSamples },
    runs,
    8,
  );
  const totalInputTokens = sum(runs.map((run) => run.inputTokens));
  const totalOutputTokens = sum(runs.map((run) => run.outputTokens));
  const totalTokens = sum(runs.map((run) => run.totalTokens));
  const totalLatencyMs = sum(runs.map((run) => run.latencyMs));
  const totalAttempts = sum(runs.map((run) => run.attemptCount));
  const criticalCount = runs.filter((run) => run.qualityLevel === 'critical_violation').length;
  const hardThresholdsMet = qualityMetrics.formalCandidateSchemaValidRate === 1 &&
    qualityMetrics.mainAbilityAccuracy >= 0.9 &&
    qualityMetrics.answerStatusAccuracy >= 0.85 &&
    qualityMetrics.rootCauseAcceptability >= 0.8 &&
    qualityMetrics.studentQuoteFidelity === 1 &&
    qualityMetrics.textEvidenceFidelity === 1 &&
    qualityMetrics.semanticStabilityRate >= 0.85 &&
    qualityMetrics.boundaryOverreachCount === 0 &&
    qualityMetrics.invalidResponseWeaknessCount === 0 &&
    failedProviderRuns.length === 0;

  return {
    schemaVersion: DIAGNOSIS_BATCH_REPORT_SCHEMA_VERSION,
    reportId: input.reportId,
    createdAt: input.createdAt,
    configuration,
    runSummary: {
      plannedLogicalRuns,
      plannedProviderCalls,
      completedLogicalRuns: runs.length,
      completedProviderCalls: completedProviderRuns.length,
      validityBlockedRuns: validityBlockedRuns.length,
      providerFailedRuns: failedProviderRuns.length,
      qualityAcceptedRuns: runs.filter((run) => run.qualityLevel === 'accepted').length,
      qualityQuestionableRuns: runs.filter((run) => run.qualityLevel === 'questionable').length,
      qualityUnacceptableRuns: runs.filter((run) => run.qualityLevel === 'unacceptable').length,
      qualityCriticalRuns: criticalCount,
      abortedReason: input.abortedReason,
    },
    providerSummary: {
      availability: metricDetails.providerAvailability,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalLatencyMs,
      averageLatencyMs: completedProviderRuns.length === 0 ? 0 : totalLatencyMs / completedProviderRuns.length,
      totalAttempts,
      retryCount: Math.max(0, totalAttempts - runs.filter((run) => run.providerCallPlanned).length),
      errorCategoryCounts,
    },
    qualityMetrics,
    metricDetails,
    categoryDistribution,
    abilityDistribution,
    stabilityDistribution,
    failedRunIds: failedProviderRuns.map((run) => `${run.sampleId}#${run.runIndex}`),
    manualReviewSampleIds,
    acceptedAuditSampleIds,
    runs,
    safety: {
      executionMode: 'shadow',
      evidenceCreated: false,
      profileUpdated: false,
      secretLogged: false,
      fullPromptLogged: false,
      rawOutputLogged: false,
    },
    baselineDecision: criticalCount > 0
      ? 'blocked_by_critical_violation'
      : hardThresholdsMet
        ? 'meets_automatic_thresholds'
        : 'requires_human_review',
  };
}

function metric(
  numerator: number,
  denominator: number,
  excludedCount: number,
  exclusionReasons: Record<string, number>,
): DiagnosisMetricDetail {
  return {
    numerator,
    denominator,
    excludedCount,
    exclusionReasons,
    rate: denominator === 0 ? 0 : numerator / denominator,
  };
}

function candidateMetric(
  candidates: DiagnosisQualityEvaluation[],
  predicate: (item: DiagnosisQualityEvaluation) => boolean,
  providerOutputCount: number,
): DiagnosisMetricDetail {
  const excludedCount = Math.max(0, providerOutputCount - candidates.length);
  return metric(
    candidates.filter(predicate).length,
    candidates.length,
    excludedCount,
    excludedCount === 0 ? {} : { no_formal_candidate: excludedCount },
  );
}

function exclusionReasonsForProviderOutput(planned: number, actual: number): Record<string, number> {
  const missing = Math.max(0, planned - actual);
  return missing === 0 ? {} : { provider_failed_or_no_output: missing };
}

function stabilityExclusionReasons(
  allResults: DiagnosisSampleStabilityResult[],
  providerResults: DiagnosisSampleStabilityResult[],
  evaluableResults: DiagnosisSampleStabilityResult[],
): Record<string, number> {
  const validityGateBlocked = allResults.length - providerResults.length;
  const insufficientRuns = providerResults.length - evaluableResults.length;
  return {
    ...(validityGateBlocked > 0 ? { validity_gate_blocked: validityGateBlocked } : {}),
    ...(insufficientRuns > 0 ? { insufficient_runs: insufficientRuns } : {}),
  };
}

function selectManualReviewSamples(
  runs: DiagnosisBatchRunSummary[],
  stability: DiagnosisSampleStabilityResult[],
): string[] {
  const ids = new Set<string>();
  for (const run of runs) {
    if (run.outcome === 'provider_failed' || run.qualityLevel !== 'accepted' || run.repairCount > 0) {
      ids.add(run.sampleId);
    }
  }
  for (const item of stability) {
    if (item.status !== 'stable_accepted') ids.add(item.sampleId);
  }
  return [...ids].sort();
}

function selectAcceptedAuditSamples(
  dataset: DiagnosisEvaluationDataset,
  runs: DiagnosisBatchRunSummary[],
  limit: number,
): string[] {
  const acceptedProviderSampleIds = new Set(
    runs
      .filter((item) => item.outcome === 'provider_completed' && item.qualityLevel === 'accepted')
      .map((item) => item.sampleId),
  );
  const selected: string[] = [];
  const seenAbilities = new Set<string>();
  const seenCategories = new Set<string>();
  for (const sample of dataset.samples) {
    if (!acceptedProviderSampleIds.has(sample.sampleId)) continue;
    if (!seenAbilities.has(sample.targetAbilityId) || !seenCategories.has(sample.category)) {
      selected.push(sample.sampleId);
      seenAbilities.add(sample.targetAbilityId);
      seenCategories.add(sample.category);
    }
    if (selected.length >= limit) break;
  }
  return selected;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
