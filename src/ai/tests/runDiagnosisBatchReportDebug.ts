import {
  buildDiagnosisBatchReport,
  getDiagnosisBatchBudgetExceededReason,
  validateDiagnosisBatchPlan,
} from '../agents/diagnosisBatchReportAgent.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import {
  DIAGNOSIS_QUALITY_EVALUATION_SCHEMA_VERSION,
  DIAGNOSIS_QUALITY_POLICY_VERSION,
  DIAGNOSIS_STABILITY_POLICY_VERSION,
  type DiagnosisBatchRunSummary,
  type DiagnosisQualityEvaluation,
  type DiagnosisSampleStabilityResult,
} from '../schemas/diagnosisQualityEvaluation.schema.ts';

type Check = { label: string; passed: boolean; detail: string };

const runs: DiagnosisBatchRunSummary[] = [];
const evaluations: DiagnosisQualityEvaluation[] = [];
const stability: DiagnosisSampleStabilityResult[] = [];

for (const sample of PHASE15_2_DATASET_V1.samples) {
  const validityBlocked = sample.validityExpectation === 'should_be_blocked_by_validity_gate';
  for (let runIndex = 1; runIndex <= 3; runIndex += 1) {
    runs.push({
      sampleId: sample.sampleId,
      category: sample.category,
      targetAbilityId: sample.targetAbilityId,
      runIndex,
      providerCallPlanned: !validityBlocked,
      outcome: validityBlocked ? 'validity_blocked' : 'provider_completed',
      runtimeStatus: validityBlocked ? undefined : 'shadow_result_ready',
      qualityLevel: 'accepted',
      attemptCount: validityBlocked ? 0 : 1,
      repairCount: 0,
      inputTokens: validityBlocked ? 0 : 500,
      outputTokens: validityBlocked ? 0 : 200,
      totalTokens: validityBlocked ? 0 : 700,
      latencyMs: validityBlocked ? 0 : 900,
      failedDimensions: [],
      matchedFacts: [],
      missingFacts: [],
      violations: [],
      limitations: [],
      candidateSnapshot: validityBlocked
        ? undefined
        : {
          mainAbility: sample.targetAbilityId,
          answerStatus: 'fully_meets',
          rootCause: 'Controlled fixture root cause.',
          surfaceError: 'none',
          abilityEvidence: ['controlled fixture'],
          diagnosisSummary: 'controlled fixture',
        },
    });
    evaluations.push(buildEvaluation(sample.sampleId, runIndex, validityBlocked));
  }
  stability.push({
    sampleId: sample.sampleId,
    runCount: 3,
    status: 'stable_accepted',
    acceptedRunCount: 3,
    questionableRunCount: 0,
    unacceptableRunCount: 0,
    criticalRunCount: 0,
    mainAbilityStable: true,
    answerStatusStable: true,
    rootCauseWithinAcceptableBoundary: true,
    reasons: [],
    policyVersion: DIAGNOSIS_STABILITY_POLICY_VERSION,
  });
}

const configuration = {
  reportPurpose: 'baseline' as const,
  datasetId: PHASE15_2_DATASET_V1.datasetId,
  datasetVersion: PHASE15_2_DATASET_V1.datasetVersion,
  datasetFrozenAt: PHASE15_2_DATASET_V1.frozenAt,
  provider: 'deepseek_chat',
  model: 'deepseek-v4-flash',
  promptVersion: 'real_ai_diagnosis_prompt_v3',
  temperature: 0.2,
  maxOutputTokens: 1600,
  maxAttempts: 2,
  timeoutMs: 30_000,
  repairPolicyVersion: 'diagnosis_repair_policy_v1',
  executionMode: 'shadow' as const,
  repetitions: 3,
  sampleLimit: 36,
  maxProviderCalls: 100,
  maxTotalTokens: 500_000,
  maxProviderFailedRuns: 10,
};

const report = buildDiagnosisBatchReport({
  reportId: 'phase15-batch-report-debug',
  createdAt: '2026-07-17T12:00:00.000Z',
  dataset: PHASE15_2_DATASET_V1,
  configuration,
  runs,
  evaluations,
  stabilityResults: stability,
});

const checks: Check[] = [
  check('108 logical runs are planned and completed', report.runSummary.plannedLogicalRuns === 108 && report.runSummary.completedLogicalRuns === 108, `${report.runSummary.completedLogicalRuns}/${report.runSummary.plannedLogicalRuns}`),
  check('93 Provider calls exclude validity-blocked samples', report.runSummary.plannedProviderCalls === 93 && report.runSummary.completedProviderCalls === 93, `${report.runSummary.completedProviderCalls}/${report.runSummary.plannedProviderCalls}`),
  check('Provider availability exposes numerator and denominator', report.metricDetails.providerAvailability.numerator === 93 && report.metricDetails.providerAvailability.denominator === 93, JSON.stringify(report.metricDetails.providerAvailability)),
  check('invalid-response safety uses its own denominator', report.metricDetails.invalidResponseSafety.numerator === 15 && report.metricDetails.invalidResponseSafety.denominator === 15, JSON.stringify(report.metricDetails.invalidResponseSafety)),
  check('education metrics use Formal Candidate denominator', report.metricDetails.mainAbilityAccuracy.denominator === 93, JSON.stringify(report.metricDetails.mainAbilityAccuracy)),
  check('Diagnosis stability excludes validity-gate-only samples', report.metricDetails.semanticStability.denominator === 31 && report.metricDetails.semanticStability.exclusionReasons.validity_gate_blocked === 5, JSON.stringify(report.metricDetails.semanticStability)),
  check('token and latency totals are aggregated', report.providerSummary.totalTokens === 65_100 && report.providerSummary.averageLatencyMs === 900, `tokens=${report.providerSummary.totalTokens}, latency=${report.providerSummary.averageLatencyMs}`),
  check('accepted audit excludes validity-gate-only samples', report.acceptedAuditSampleIds.length > 0 && report.acceptedAuditSampleIds.every((id) => !['phase15-v1-30', 'phase15-v1-31', 'phase15-v1-32', 'phase15-v1-33', 'phase15-v1-34'].includes(id)), report.acceptedAuditSampleIds.join(',')),
  check('safe report cannot claim Evidence or Profile mutation', !report.safety.evidenceCreated && !report.safety.profileUpdated && report.safety.executionMode === 'shadow', JSON.stringify(report.safety)),
  check('planned call budget blocks oversized batch', validateDiagnosisBatchPlan({ plannedProviderCalls: 101, maxProviderCalls: 100 }).length === 1, '101 > 100'),
  check('runtime token budget stops further calls', Boolean(getDiagnosisBatchBudgetExceededReason({ totalTokens: 500_001, maxTotalTokens: 500_000, providerFailedRuns: 0, maxProviderFailedRuns: 10 })), 'token guard fired'),
  check('runtime Provider-failure budget stops further calls', Boolean(getDiagnosisBatchBudgetExceededReason({ totalTokens: 10, maxTotalTokens: 500_000, providerFailedRuns: 10, maxProviderFailedRuns: 10 })), 'failure guard fired'),
  check('all automatic thresholds are met in the controlled fixture', report.baselineDecision === 'meets_automatic_thresholds', report.baselineDecision),
];

console.log('\nPhase 15.2 Batch Report Debug');
console.log('='.repeat(72));
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.label} | ${item.detail}`);
const passed = checks.filter((item) => item.passed).length;
console.log('-'.repeat(72));
console.log(`Result: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exitCode = 1;

function buildEvaluation(
  sampleId: string,
  runIndex: number,
  validityBlocked: boolean,
): DiagnosisQualityEvaluation {
  return {
    schemaVersion: DIAGNOSIS_QUALITY_EVALUATION_SCHEMA_VERSION,
    evaluationId: `evaluation-${sampleId}-${runIndex}`,
    sampleId,
    requestId: validityBlocked ? undefined : `request-${sampleId}-${runIndex}`,
    datasetVersion: PHASE15_2_DATASET_V1.datasetVersion,
    promptVersion: validityBlocked ? undefined : 'real_ai_diagnosis_prompt_v3',
    provider: validityBlocked ? undefined : 'deepseek_chat',
    model: validityBlocked ? undefined : 'deepseek-v4-flash',
    qualityLevel: 'accepted',
    dimensions: {
      providerOutputReceived: !validityBlocked,
      rawSchemaValid: !validityBlocked,
      postRepairSchemaValid: !validityBlocked,
      formalCandidateSchemaValid: !validityBlocked,
      mainAbilityAccepted: true,
      answerStatusAccepted: true,
      rootCauseAcceptable: true,
      requiredFactsPresent: true,
      studentQuoteFaithful: true,
      textEvidenceFaithful: true,
      invalidResponseHandledSafely: true,
      noBoundaryOverreach: true,
      noCriticalHallucination: true,
      semanticRepairSafe: true,
    },
    matchedFacts: [],
    missingFacts: [],
    violations: [],
    limitations: [],
    offlineDecision: 'accepted_candidate',
    canBecomeFormalCandidate: !validityBlocked,
    evaluatedAt: '2026-07-17T12:00:00.000Z',
    policyVersion: DIAGNOSIS_QUALITY_POLICY_VERSION,
    validation: { passed: true, issues: [] },
  };
}

function check(label: string, passed: boolean, detail: string): Check {
  return { label, passed, detail };
}
