import { coordinateEvidenceConflicts } from '../agents/evidenceConflictAssessmentAgent.ts';
import {
  buildEvaluationContextEnvelope,
  LEGACY_PHASE8_EVALUATION_CONTRACT,
  QUALITY_AWARE_EVALUATION_CONTRACT,
} from '../agents/evaluationContextAdapter.ts';
import type { AbilityEvidence, AbilityEvidenceType } from '../schemas/abilityEvidence.schema.ts';
import type {
  EvidenceComparisonContext,
  EvidenceConflictAssessment,
  EvidenceConflictCoordinationInput,
} from '../schemas/evidenceConflictAssessment.schema.ts';
import {
  EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_QUALITY_POLICY_VERSION,
  type EvidenceEvaluationEligibility,
  type EvidenceHintDependency,
  type EvidenceQualityAssessment,
  type EvidenceQualityLevel,
  type EvidenceTaskNovelty,
  type EvidenceTimingType,
} from '../schemas/evidenceQualityAssessment.schema.ts';
import type { RetentionDifficultyRelation } from '../schemas/retentionEvaluation.schema.ts';

const STUDENT_ID = 'student-phase14-2';
const ABILITY_ID = '推理';
const COORDINATED_AT = '2026-07-17T08:00:00.000Z';

type CaseResult = { name: string; passed: boolean; detail: string };
const results: CaseResult[] = [];

function runCase(name: string, test: () => void): void {
  try {
    test();
    results.push({ name, passed: true, detail: 'PASS' });
  } catch (error) {
    results.push({
      name,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function evidence(
  id: string,
  evidenceType: AbilityEvidenceType,
  createdAt = '2026-07-10T08:00:00.000Z',
  taskId = `task-${id}`,
): AbilityEvidence {
  return {
    id,
    studentId: STUDENT_ID,
    ability: ABILITY_ID,
    evidenceType,
    detail: `${id} detail`,
    source: 'retest',
    observation: `${id} observation`,
    confidence: 0.82,
    createdAt,
    taskId,
    diagnosisId: `diagnosis-${id}`,
  };
}

function assessment(
  item: AbilityEvidence,
  options: {
    assessmentId?: string;
    observationUnitId?: string;
    supersedesAssessmentId?: string;
    qualityLevel?: EvidenceQualityLevel;
    eligibility?: EvidenceEvaluationEligibility;
    studentId?: string;
    abilityId?: string;
    evidenceType?: AbilityEvidenceType;
    hintDependency?: EvidenceHintDependency;
    taskNovelty?: EvidenceTaskNovelty;
    timingType?: EvidenceTimingType;
    difficultyRelation?: RetentionDifficultyRelation;
    taskRole?: 'training' | 'retest' | 'transfer' | 'diagnosis' | 'observation';
    validationPassed?: boolean;
    assessedAt?: string;
  } = {},
): EvidenceQualityAssessment {
  const suffix = options.assessmentId || item.id;
  const hintDependency = options.hintDependency || 'none';
  return {
    assessmentId: options.assessmentId || `qa-${suffix}`,
    evidenceId: item.id,
    studentId: options.studentId || item.studentId,
    abilityId: options.abilityId || item.ability,
    observationUnitId: options.observationUnitId || `unit-${item.id}`,
    contextFingerprint: `fingerprint-${suffix}`,
    policyVersion: EVIDENCE_QUALITY_POLICY_VERSION,
    supersedesAssessmentId: options.supersedesAssessmentId,
    evidenceType: options.evidenceType || item.evidenceType,
    qualityLevel: options.qualityLevel || 'high',
    evaluationEligibility: options.eligibility || 'eligible',
    facts: {
      responseValid: true,
      taskAbilityAligned: true,
      diagnosisAligned: true,
      traceabilityComplete: true,
      independentPerformance: hintDependency === 'none',
      usedHint: hintDependency !== 'none',
      hintCount: hintDependency === 'none' ? 0 : hintDependency === 'low' ? 1 : 2,
      hintDependency,
      taskNovelty: options.taskNovelty || 'transfer',
      timingType: options.timingType || 'delayed',
      taskRole: options.taskRole || 'retest',
      difficultyRelation: options.difficultyRelation || 'comparable',
      diagnosisReliable: true,
    },
    qualityReasons: ['Formal observation facts were validated.'],
    limitations: options.eligibility === 'limited' ? ['Observation is limited.'] : [],
    sourceLinks: {
      taskId: item.taskId || `task-${item.id}`,
      executionSessionId: `execution-${item.id}`,
      responseId: `response-${item.id}`,
      diagnosisResultId: item.diagnosisId || `diagnosis-${item.id}`,
      taskEvidenceReturnId: `return-${item.id}`,
    },
    schemaVersion: EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION,
    assessedAt: options.assessedAt || '2026-07-17T07:00:00.000Z',
    validation: {
      passed: options.validationPassed ?? true,
      issues: options.validationPassed === false ? ['Mock invalid assessment.'] : [],
    },
  };
}

function context(
  qa: EvidenceQualityAssessment,
  options: {
    contextId?: string;
    materialIdentity?: string;
    observationWindowId?: string;
    taskRole?: string;
    hintDependency?: EvidenceHintDependency;
    taskNovelty?: EvidenceTaskNovelty;
    timingType?: EvidenceTimingType;
    difficultyRelation?: RetentionDifficultyRelation;
    repeatedExecutionOf?: string;
    studentId?: string;
    abilityId?: string;
    validationPassed?: boolean;
  } = {},
): EvidenceComparisonContext {
  const id = options.contextId || `context-${qa.assessmentId}`;
  return {
    comparisonContextId: id,
    observationUnitId: qa.observationUnitId,
    studentId: options.studentId || qa.studentId,
    abilityId: options.abilityId || qa.abilityId,
    taskId: qa.sourceLinks.taskId,
    executionSessionId: qa.sourceLinks.executionSessionId,
    responseId: qa.sourceLinks.responseId,
    materialIdentity: options.materialIdentity || `material-${id}`,
    taskRole: options.taskRole || qa.facts.taskRole,
    taskNovelty: options.taskNovelty || qa.facts.taskNovelty,
    timingType: options.timingType || qa.facts.timingType,
    difficultyRelation: options.difficultyRelation || qa.facts.difficultyRelation,
    hintDependency: options.hintDependency || qa.facts.hintDependency,
    observedAt: '2026-07-17T06:00:00.000Z',
    observationWindowId: options.observationWindowId || `window-${id}`,
    repeatedExecutionOf: options.repeatedExecutionOf,
    source: 'formal_runtime_adapter',
    validation: {
      passed: options.validationPassed ?? true,
      issues: options.validationPassed === false ? ['Mock invalid context.'] : [],
    },
  };
}

function coordinate(
  evidenceItems: AbilityEvidence[],
  assessments: EvidenceQualityAssessment[],
  contexts: EvidenceComparisonContext[],
): EvidenceConflictAssessment {
  const input: EvidenceConflictCoordinationInput = {
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    abilityEvidence: evidenceItems,
    qualityAssessments: assessments,
    comparisonContexts: contexts,
    coordinatedAt: COORDINATED_AT,
    timezone: 'Asia/Shanghai',
  };
  return coordinateEvidenceConflicts(input);
}

function pair(
  leftType: AbilityEvidenceType,
  rightType: AbilityEvidenceType,
  options: {
    left?: Parameters<typeof assessment>[1] & Parameters<typeof context>[1];
    right?: Parameters<typeof assessment>[1] & Parameters<typeof context>[1];
  } = {},
): {
  evidence: AbilityEvidence[];
  assessments: EvidenceQualityAssessment[];
  contexts: EvidenceComparisonContext[];
  result: EvidenceConflictAssessment;
} {
  const leftEvidence = evidence(`left-${leftType}`, leftType, '2026-07-10T08:00:00.000Z');
  const rightEvidence = evidence(`right-${rightType}`, rightType, '2026-07-17T08:00:00.000Z');
  const leftAssessment = assessment(leftEvidence, options.left);
  const rightAssessment = assessment(rightEvidence, options.right);
  const leftContext = context(leftAssessment, { materialIdentity: 'material-left', ...options.left });
  const rightContext = context(rightAssessment, { materialIdentity: 'material-right', ...options.right });
  const evidenceItems = [leftEvidence, rightEvidence];
  const assessments = [leftAssessment, rightAssessment];
  const contexts = [leftContext, rightContext];
  return {
    evidence: evidenceItems,
    assessments,
    contexts,
    result: coordinate(evidenceItems, assessments, contexts),
  };
}

runCase('Case 1: two independent positive observations align', () => {
  const data = pair('positive', 'growth');
  expect(data.result.status === 'aligned_positive_evidence', data.result.status);
  expect(data.result.independentContextCount === 2, 'Expected two independent contexts.');
});

runCase('Case 2: two independent weakness observations align', () => {
  const data = pair('weakness', 'weakness');
  expect(data.result.status === 'aligned_weakness_evidence', data.result.status);
});

runCase('Case 3: high-quality weakness and supported low positive are explainable mixed', () => {
  const data = pair('positive', 'weakness', {
    left: {
      qualityLevel: 'low', eligibility: 'limited', hintDependency: 'high',
      taskNovelty: 'same', timingType: 'immediate', taskRole: 'training',
    },
    right: {
      qualityLevel: 'high', hintDependency: 'none',
      taskNovelty: 'transfer', timingType: 'delayed', taskRole: 'retest',
    },
  });
  expect(data.result.status === 'explainable_mixed_evidence', data.result.status);
});

runCase('Case 4: immediate positive and delayed weakness retain timing explanation', () => {
  const data = pair('positive', 'weakness', {
    left: { timingType: 'immediate' },
    right: { timingType: 'delayed' },
  });
  expect(data.result.status === 'explainable_mixed_evidence', data.result.status);
  expect(data.result.differenceFactors.some((item) => item.factor === 'timing' && item.explanatoryStrength === 'strong'), 'Expected strong timing factor.');
});

runCase('Case 5: same-context positive and transfer weakness are explainable', () => {
  const data = pair('positive', 'weakness', {
    left: { taskNovelty: 'same' },
    right: { taskNovelty: 'transfer' },
  });
  expect(data.result.status === 'explainable_mixed_evidence', data.result.status);
});

runCase('Case 6: lower-difficulty positive and higher-difficulty weakness are explainable', () => {
  const data = pair('positive', 'weakness', {
    left: { difficultyRelation: 'lower' },
    right: { difficultyRelation: 'higher' },
  });
  expect(data.result.status === 'explainable_mixed_evidence', data.result.status);
});

runCase('Case 7: comparable high-quality opposite directions remain unresolved', () => {
  const data = pair('positive', 'weakness');
  expect(data.result.status === 'unresolved_conflict', data.result.status);
  expect(data.result.recommendation === 'request_discriminating_observation', data.result.recommendation);
});

runCase('Case 8: one eligible observation is insufficient', () => {
  const item = evidence('single-positive', 'positive');
  const qa = assessment(item);
  const result = coordinate([item], [qa], [context(qa)]);
  expect(result.status === 'insufficient_comparable_evidence', result.status);
});

runCase('Case 9: limited observations alone cannot satisfy sufficiency', () => {
  const data = pair('positive', 'positive', {
    left: { eligibility: 'limited', qualityLevel: 'low' },
    right: { eligibility: 'limited', qualityLevel: 'low' },
  });
  expect(data.result.status === 'insufficient_comparable_evidence', data.result.status);
});

runCase('Case 10: blocked and review-required Evidence do not drive direction', () => {
  const blocked = evidence('blocked', 'positive');
  const review = evidence('review', 'weakness');
  const blockedQa = assessment(blocked, { eligibility: 'blocked', qualityLevel: 'insufficient' });
  const reviewQa = assessment(review, { eligibility: 'review_required' });
  const result = coordinate([blocked, review], [blockedQa, reviewQa], [context(blockedQa), context(reviewQa)]);
  expect(result.status === 'review_required', result.status);
  expect(result.reviewRequiredEvidenceIds.includes(review.id), 'Review Evidence was not isolated.');
});

runCase('Case 11: insufficient direction is retained but ignored for alignment', () => {
  const positiveA = evidence('positive-a', 'positive');
  const positiveB = evidence('positive-b', 'growth');
  const insufficient = evidence('insufficient', 'insufficient');
  const qaA = assessment(positiveA);
  const qaB = assessment(positiveB);
  const qaI = assessment(insufficient, { eligibility: 'limited', qualityLevel: 'insufficient' });
  const result = coordinate(
    [positiveA, positiveB, insufficient],
    [qaA, qaB, qaI],
    [context(qaA), context(qaB), context(qaI)],
  );
  expect(result.status === 'aligned_positive_evidence', result.status);
  expect(result.directionSummary.insufficientUnitCount === 1, 'Insufficient unit was not retained.');
});

runCase('Case 12: duplicate Evidence IDs are idempotently deduplicated', () => {
  const data = pair('positive', 'growth');
  const result = coordinate([...data.evidence, data.evidence[0]], data.assessments, data.contexts);
  expect(result.evidenceLinks.length === 2, 'Duplicate Evidence changed evidenceLinks.');
  expect(result.conflictAssessmentId === data.result.conflictAssessmentId, 'Duplicate Evidence changed stable ID.');
});

runCase('Case 13: multiple Evidence from one response count as one observation', () => {
  const growth = evidence('unit-growth', 'growth', undefined, 'task-unit');
  const positive = evidence('unit-positive', 'positive', undefined, 'task-unit');
  const qaGrowth = assessment(growth, { observationUnitId: 'shared-unit' });
  const qaPositiveBase = assessment(positive, { observationUnitId: 'shared-unit' });
  const qaPositive = {
    ...qaPositiveBase,
    sourceLinks: { ...qaPositiveBase.sourceLinks, ...qaGrowth.sourceLinks },
  };
  const result = coordinate([growth, positive], [qaGrowth, qaPositive], [context(qaGrowth)]);
  expect(result.observationUnitCount === 1, `Expected one unit, got ${result.observationUnitCount}.`);
  expect(result.observationUnits[0].evidenceIds.length === 2, 'Both Evidence records were not retained.');
});

runCase('Case 14: superseded Quality Assessment is excluded from current version', () => {
  const item = evidence('versioned', 'positive');
  const oldQa = assessment(item, { assessmentId: 'qa-old', assessedAt: '2026-07-16T07:00:00.000Z' });
  const currentQa = assessment(item, { assessmentId: 'qa-current', supersedesAssessmentId: oldQa.assessmentId });
  const result = coordinate([item], [oldQa, currentQa], [context(currentQa)]);
  expect(result.currentQualityAssessmentIds.includes(currentQa.assessmentId), 'Current Assessment missing.');
  expect(result.supersededQualityAssessmentIds.includes(oldQa.assessmentId), 'Superseded Assessment missing.');
});

runCase('Case 15: branched current Assessments require review', () => {
  const item = evidence('branched', 'positive');
  const qaA = assessment(item, { assessmentId: 'qa-branch-a' });
  const qaB = assessment(item, { assessmentId: 'qa-branch-b' });
  const result = coordinate([item], [qaA, qaB], []);
  expect(result.status === 'review_required', result.status);
});

runCase('Case 16: identity mismatch requires review', () => {
  const item = evidence('identity', 'positive');
  const qa = assessment(item, { studentId: 'other-student' });
  const result = coordinate([item], [qa], [context(qa)]);
  expect(result.status === 'review_required', result.status);
});

runCase('Case 17: homogeneous repeated contexts do not increase independence', () => {
  const data = pair('positive', 'growth');
  const homogeneousContexts = data.contexts.map((item, index) => ({
    ...item,
    comparisonContextId: `homogeneous-${index}`,
    materialIdentity: 'same-material',
    observationWindowId: 'same-window',
  }));
  const result = coordinate(data.evidence, data.assessments, homogeneousContexts);
  expect(result.independentContextCount === 1, `Expected one context, got ${result.independentContextCount}.`);
  expect(result.status === 'insufficient_comparable_evidence', result.status);
});

runCase('Case 18: Assessment evidenceType mismatch requires review', () => {
  const item = evidence('direction-mismatch', 'positive');
  const qa = assessment(item, { evidenceType: 'weakness' });
  const result = coordinate([item], [qa], [context(qa)]);
  expect(result.status === 'review_required', result.status);
});

runCase('Case 19: input order does not change stable coordination result', () => {
  const data = pair('positive', 'weakness');
  const reversed = coordinate(
    [...data.evidence].reverse(),
    [...data.assessments].reverse(),
    [...data.contexts].reverse(),
  );
  expect(reversed.conflictAssessmentId === data.result.conflictAssessmentId, 'Order changed stable ID.');
  expect(reversed.status === data.result.status, 'Order changed conflict status.');
});

function makePositiveEnvelopeFixture(): ReturnType<typeof pair> & { extraEvidence: AbilityEvidence; extraAssessment: EvidenceQualityAssessment; extraContext: EvidenceComparisonContext } {
  const sharedGrowth = evidence('shared-growth', 'growth', undefined, 'task-shared');
  const sharedPositive = evidence('shared-positive', 'positive', undefined, 'task-shared');
  const extraEvidence = evidence('independent-positive', 'positive');
  const sharedGrowthQa = assessment(sharedGrowth, { observationUnitId: 'shared-unit' });
  const sharedPositiveBase = assessment(sharedPositive, { observationUnitId: 'shared-unit' });
  const sharedPositiveQa = {
    ...sharedPositiveBase,
    sourceLinks: { ...sharedPositiveBase.sourceLinks, ...sharedGrowthQa.sourceLinks },
  };
  const extraAssessment = assessment(extraEvidence);
  const contexts = [context(sharedGrowthQa), context(extraAssessment)];
  const evidenceItems = [sharedGrowth, sharedPositive, extraEvidence];
  const assessments = [sharedGrowthQa, sharedPositiveQa, extraAssessment];
  const result = coordinate(evidenceItems, assessments, contexts);
  return {
    evidence: evidenceItems,
    assessments,
    contexts,
    result,
    extraEvidence,
    extraAssessment,
    extraContext: contexts[1],
  };
}

runCase('Case 20: Envelope preserves raw, primary, and supporting Evidence', () => {
  const data = makePositiveEnvelopeFixture();
  const envelope = buildEvaluationContextEnvelope({
    rawEvidence: data.evidence,
    conflictAssessment: data.result,
    currentQualityAssessments: data.assessments,
    runtimeContract: QUALITY_AWARE_EVALUATION_CONTRACT,
  });
  expect(envelope.canEnterExistingEvaluation, envelope.validation.issues.join('; '));
  expect(envelope.rawEvidence.length === 3, 'Raw Evidence was not preserved.');
  expect(envelope.primaryEvaluationEvidence.length === 2, 'Expected one representative per eligible unit.');
  expect(envelope.supportingContextEvidence.length === 1, 'Expected non-representative supporting Evidence.');
});

runCase('Case 21: supported conflict-aware Runtime can receive unresolved conflict context', () => {
  const data = pair('positive', 'weakness');
  const envelope = buildEvaluationContextEnvelope({
    rawEvidence: data.evidence,
    conflictAssessment: data.result,
    currentQualityAssessments: data.assessments,
    runtimeContract: QUALITY_AWARE_EVALUATION_CONTRACT,
  });
  expect(data.result.status === 'unresolved_conflict', data.result.status);
  expect(envelope.canEnterExistingEvaluation, envelope.limitations.join('; '));
  expect(envelope.requiredEvaluationCapabilities.includes('do_not_resolve_conflict_automatically'), 'Missing conflict safety capability.');
});

runCase('Case 22: review-required conflict blocks Evaluation handoff', () => {
  const item = evidence('review-handoff', 'positive');
  const qaA = assessment(item, { assessmentId: 'review-a' });
  const qaB = assessment(item, { assessmentId: 'review-b' });
  const conflict = coordinate([item], [qaA, qaB], []);
  const envelope = buildEvaluationContextEnvelope({
    rawEvidence: [item],
    conflictAssessment: conflict,
    currentQualityAssessments: [qaA, qaB],
    runtimeContract: QUALITY_AWARE_EVALUATION_CONTRACT,
  });
  expect(!envelope.canEnterExistingEvaluation, 'Review result entered Evaluation.');
});

runCase('Case 23: timing difference alone with unknown conditions is insufficient', () => {
  const data = pair('positive', 'weakness', {
    left: { timingType: 'immediate', hintDependency: 'unknown', taskNovelty: 'unknown', difficultyRelation: 'unknown' },
    right: { timingType: 'delayed', hintDependency: 'unknown', taskNovelty: 'unknown', difficultyRelation: 'unknown' },
  });
  expect(data.result.status === 'insufficient_comparable_evidence', data.result.status);
  expect(!data.result.differenceFactors.some((item) => item.explanatoryStrength === 'strong'), 'Unknown facts produced a strong explanation.');
});

runCase('Case 24: legacy Phase 8 contract cannot consume unresolved conflict context', () => {
  const data = pair('positive', 'weakness');
  const envelope = buildEvaluationContextEnvelope({
    rawEvidence: data.evidence,
    conflictAssessment: data.result,
    currentQualityAssessments: data.assessments,
    runtimeContract: LEGACY_PHASE8_EVALUATION_CONTRACT,
  });
  expect(!envelope.canEnterExistingEvaluation, 'Legacy Runtime incorrectly accepted quality-aware conflict handoff.');
  expect(envelope.evaluationInputMode === 'legacy_full_evidence', envelope.evaluationInputMode);
  expect(!envelope.qualityProtectionApplied, 'Quality protection was falsely claimed.');
});

runCase('Case 25: growth and positive in one unit keep both original semantics', () => {
  const data = makePositiveEnvelopeFixture();
  const sharedUnit = data.result.observationUnits.find((unit) => unit.observationUnitId === 'shared-unit');
  expect(sharedUnit?.direction === 'positive_signal', sharedUnit?.direction || 'missing unit');
  expect(sharedUnit?.evidenceIds.length === 2, 'Original Evidence semantics were not preserved in unit.');
  const envelope = buildEvaluationContextEnvelope({
    rawEvidence: data.evidence,
    conflictAssessment: data.result,
    currentQualityAssessments: data.assessments,
    runtimeContract: QUALITY_AWARE_EVALUATION_CONTRACT,
  });
  expect(envelope.primaryEvaluationEvidence.some((item) => item.evidenceType === 'growth'), 'Growth was not selected as conservative representative.');
  expect(envelope.supportingContextEvidence.some((item) => item.evidenceType === 'positive'), 'Positive Evidence disappeared instead of remaining supporting context.');
});

const passedCount = results.filter((result) => result.passed).length;
const failed = results.filter((result) => !result.passed);

console.log('\nPhase 14.2 Evidence Conflict Coordination Debug Report');
console.log('='.repeat(72));
for (const result of results) {
  console.log(`${result.passed ? 'PASS' : 'FAIL'} | ${result.name}`);
  if (!result.passed) console.log(`       ${result.detail}`);
}
console.log('-'.repeat(72));
console.log(`Cases: ${passedCount}/${results.length} passed`);
console.log(`Result: ${failed.length === 0 && results.length === 25 ? 'PASS' : 'FAIL'}`);

if (failed.length > 0 || results.length !== 25) process.exitCode = 1;
