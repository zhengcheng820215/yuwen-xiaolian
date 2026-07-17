import { isAbilityEvidence, type AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import {
  EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_CONFLICT_POLICY_VERSION,
  isEvidenceComparisonContext,
  isEvidenceConflictAssessment,
  type EvidenceComparisonContext,
  type EvidenceConflictAssessment,
  type EvidenceConflictCoordinationInput,
  type EvidenceConflictStatus,
  type EvidenceCoordinationRecommendation,
  type EvidenceDifferenceFactor,
  type EvidenceObservationDirection,
  type EvidenceObservationUnitSummary,
} from '../schemas/evidenceConflictAssessment.schema.ts';
import {
  isEvidenceQualityAssessment,
  resolveCurrentEvidenceQualityAssessment,
  type EvidenceEvaluationEligibility,
  type EvidenceQualityAssessment,
  type EvidenceQualityLevel,
} from '../schemas/evidenceQualityAssessment.schema.ts';

type ResolvedEvidence = {
  evidence: AbilityEvidence;
  assessment: EvidenceQualityAssessment;
  context: EvidenceComparisonContext | null;
  effectiveEligibility: EvidenceEvaluationEligibility;
};

type UnitWithContext = {
  unit: EvidenceObservationUnitSummary;
  context: EvidenceComparisonContext | null;
};

const ELIGIBILITY_RANK: Record<EvidenceEvaluationEligibility, number> = {
  eligible: 0,
  limited: 1,
  blocked: 2,
  review_required: 3,
};

const QUALITY_RANK: Record<EvidenceQualityLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
  insufficient: 0,
};

export function coordinateEvidenceConflicts(
  input: EvidenceConflictCoordinationInput,
): EvidenceConflictAssessment {
  const evidence = dedupeEvidence(input.abilityEvidence);
  const inputIssues = validateInput(input, evidence);
  const contextByObservation = groupContexts(input.comparisonContexts);
  const currentAssessmentIds: string[] = [];
  const supersededAssessmentIds: string[] = [];
  const eligibleEvidenceIds: string[] = [];
  const limitedEvidenceIds: string[] = [];
  const blockedEvidenceIds: string[] = [];
  const reviewRequiredEvidenceIds: string[] = [];
  const resolutionIssues: string[] = [];
  const resolvedEvidence: ResolvedEvidence[] = [];

  for (const item of evidence) {
    const matchingAssessments = input.qualityAssessments.filter((assessment) => (
      assessment && assessment.evidenceId === item.id
    ));
    const resolution = resolveCurrentEvidenceQualityAssessment(item.id, matchingAssessments);
    if (resolution.status === 'missing' || !resolution.assessment) {
      if (resolution.status === 'review_required') {
        reviewRequiredEvidenceIds.push(item.id);
        resolutionIssues.push(...resolution.issues.map((issue) => `${item.id}: ${issue}`));
      } else {
        blockedEvidenceIds.push(item.id);
      }
      continue;
    }

    const assessment = resolution.assessment;
    currentAssessmentIds.push(assessment.assessmentId);
    supersededAssessmentIds.push(...matchingAssessments
      .filter((candidate) => candidate.assessmentId !== assessment.assessmentId)
      .map((candidate) => candidate.assessmentId));
    const identityIssues = validateEvidenceAssessmentIdentity(input, item, assessment);
    const contexts = contextByObservation.get(assessment.observationUnitId) || [];
    const contextIssues = validateContextsForAssessment(input, assessment, contexts);

    if (identityIssues.length > 0 || contextIssues.some((issue) => issue.severity === 'review')) {
      reviewRequiredEvidenceIds.push(item.id);
      resolutionIssues.push(...identityIssues.map((issue) => `${item.id}: ${issue}`));
      resolutionIssues.push(...contextIssues
        .filter((issue) => issue.severity === 'review')
        .map((issue) => `${item.id}: ${issue.message}`));
      continue;
    }

    const context = contexts.length === 1 ? contexts[0] : null;
    const effectiveEligibility = context
      ? assessment.evaluationEligibility
      : downgradeEligibilityWithoutContext(assessment.evaluationEligibility);
    if (!context) {
      resolutionIssues.push(`${item.id}: Formal Comparison Context is missing; eligibility was limited.`);
    }

    classifyEvidenceId(item.id, effectiveEligibility, {
      eligibleEvidenceIds,
      limitedEvidenceIds,
      blockedEvidenceIds,
      reviewRequiredEvidenceIds,
    });
    resolvedEvidence.push({ evidence: item, assessment, context, effectiveEligibility });
  }

  const unitsWithContext = buildObservationUnits(input, resolvedEvidence);
  const observationUnits = unitsWithContext.map((item) => item.unit);
  const comparableUnits = unitsWithContext.filter((item) => (
    item.unit.effectiveEligibility === 'eligible' &&
    item.context?.validation.passed &&
    ['positive_signal', 'weakness_signal'].includes(item.unit.direction)
  ));
  const independentContextCount = new Set(
    comparableUnits.map((item) => item.unit.comparisonClusterId),
  ).size;
  const differenceFactors = deriveDifferenceFactors(unitsWithContext);
  const status = deriveStatus({
    units: unitsWithContext,
    independentContextCount,
    differenceFactors,
    hasReviewIssues: inputIssues.length > 0 || reviewRequiredEvidenceIds.length > 0,
  });
  const recommendation = deriveRecommendation(status);
  const validationIssues = uniqueStrings([
    ...inputIssues,
    ...(status === 'review_required' ? resolutionIssues : []),
  ]);
  const limitations = buildLimitations({
    status,
    units: unitsWithContext,
    independentContextCount,
    resolutionIssues,
    blockedEvidenceIds,
    limitedEvidenceIds,
  });
  const conflictFactors = buildConflictFactors(status, unitsWithContext, differenceFactors);
  const comparisonFacts = buildComparisonFacts({
    units: unitsWithContext,
    independentContextCount,
    eligibleEvidenceIds,
    limitedEvidenceIds,
  });
  const sortedCurrentIds = uniqueSorted(currentAssessmentIds);
  const sortedContextIds = uniqueSorted(unitsWithContext.flatMap((item) => (
    item.unit.comparisonContextIds
  )));
  const conflictAssessmentId = buildStableId('evidence-conflict', [
    input.studentId || 'unknown-student',
    input.targetAbilityId || 'unknown-ability',
    ...sortedCurrentIds,
    ...uniqueSorted(observationUnits.map((unit) => unit.observationUnitId)),
    ...sortedContextIds,
    ...differenceFactors.map(serializeDifferenceFactor).sort(),
    EVIDENCE_CONFLICT_POLICY_VERSION,
  ]);
  const directionSummary = {
    positiveUnitCount: observationUnits.filter((unit) => unit.direction === 'positive_signal').length,
    weaknessUnitCount: observationUnits.filter((unit) => unit.direction === 'weakness_signal').length,
    mixedUnitCount: observationUnits.filter((unit) => unit.direction === 'mixed_signal').length,
    insufficientUnitCount: observationUnits.filter((unit) => unit.direction === 'insufficient_signal').length,
  };

  const result: EvidenceConflictAssessment = {
    conflictAssessmentId,
    studentId: input.studentId || 'unknown-student',
    abilityId: input.targetAbilityId || 'unknown-ability',
    status,
    recommendation,
    observationUnits,
    observationUnitCount: observationUnits.length,
    comparableObservationUnitCount: comparableUnits.length,
    independentContextCount,
    directionSummary,
    eligibleEvidenceIds: uniqueSorted(eligibleEvidenceIds),
    limitedEvidenceIds: uniqueSorted(limitedEvidenceIds),
    blockedEvidenceIds: uniqueSorted(blockedEvidenceIds),
    reviewRequiredEvidenceIds: uniqueSorted(reviewRequiredEvidenceIds),
    currentQualityAssessmentIds: sortedCurrentIds,
    supersededQualityAssessmentIds: uniqueSorted(supersededAssessmentIds),
    comparisonFacts,
    differenceFactors,
    conflictFactors,
    limitations,
    evidenceLinks: uniqueSorted(evidence.map((item) => item.id)),
    schemaVersion: EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION,
    policyVersion: EVIDENCE_CONFLICT_POLICY_VERSION,
    coordinatedAt: isTimestamp(input.coordinatedAt)
      ? input.coordinatedAt
      : '1970-01-01T00:00:00.000Z',
    validation: {
      passed: status !== 'review_required' && validationIssues.length === 0,
      issues: validationIssues,
    },
  };

  if (isEvidenceConflictAssessment(result)) return result;

  return {
    ...result,
    status: 'review_required',
    recommendation: 'human_review',
    validation: {
      passed: false,
      issues: uniqueStrings([...validationIssues, 'EvidenceConflictAssessment schema validation failed.']),
    },
  };
}

function validateInput(
  input: EvidenceConflictCoordinationInput,
  evidence: AbilityEvidence[],
): string[] {
  const issues: string[] = [];
  if (!isNonEmptyString(input.studentId)) issues.push('studentId is required.');
  if (!isNonEmptyString(input.targetAbilityId)) issues.push('targetAbilityId is required.');
  if (!Array.isArray(input.abilityEvidence) || input.abilityEvidence.length === 0) {
    issues.push('At least one AbilityEvidence is required.');
  }
  if (!input.abilityEvidence.every(isAbilityEvidence)) issues.push('AbilityEvidence schema validation failed.');
  if (!input.qualityAssessments.every(isEvidenceQualityAssessment)) {
    issues.push('EvidenceQualityAssessment schema validation failed.');
  }
  if (!input.comparisonContexts.every(isEvidenceComparisonContext)) {
    issues.push('EvidenceComparisonContext schema validation failed.');
  }
  if (!isTimestamp(input.coordinatedAt)) issues.push('coordinatedAt must be a valid timestamp.');
  if (!isNonEmptyString(input.timezone)) issues.push('timezone is required.');
  if (evidence.some((item) => item.studentId !== input.studentId)) {
    issues.push('AbilityEvidence studentId mismatch.');
  }
  if (evidence.some((item) => item.ability !== input.targetAbilityId)) {
    issues.push('AbilityEvidence ability mismatch.');
  }
  return uniqueStrings(issues);
}

function validateEvidenceAssessmentIdentity(
  input: EvidenceConflictCoordinationInput,
  evidence: AbilityEvidence,
  assessment: EvidenceQualityAssessment,
): string[] {
  const issues: string[] = [];
  if (assessment.studentId !== input.studentId) issues.push('Quality Assessment studentId mismatch.');
  if (assessment.abilityId !== input.targetAbilityId) issues.push('Quality Assessment abilityId mismatch.');
  if (assessment.evidenceId !== evidence.id) issues.push('Quality Assessment evidenceId mismatch.');
  if (assessment.evidenceType !== evidence.evidenceType) issues.push('Quality Assessment evidenceType mismatch.');
  if (!assessment.validation.passed && assessment.evaluationEligibility === 'eligible') {
    issues.push('Invalid Quality Assessment cannot be eligible.');
  }
  return issues;
}

function validateContextsForAssessment(
  input: EvidenceConflictCoordinationInput,
  assessment: EvidenceQualityAssessment,
  contexts: EvidenceComparisonContext[],
): Array<{ severity: 'review' | 'limited'; message: string }> {
  if (contexts.length === 0) {
    return [{ severity: 'limited', message: 'Comparison Context is missing.' }];
  }
  if (contexts.length > 1) {
    return [{ severity: 'review', message: 'Multiple Comparison Contexts target one observationUnitId.' }];
  }
  const context = contexts[0];
  const issues: Array<{ severity: 'review' | 'limited'; message: string }> = [];
  if (!context.validation.passed) issues.push({ severity: 'review', message: 'Comparison Context validation failed.' });
  if (context.studentId !== input.studentId) issues.push({ severity: 'review', message: 'Comparison Context studentId mismatch.' });
  if (context.abilityId !== input.targetAbilityId) issues.push({ severity: 'review', message: 'Comparison Context abilityId mismatch.' });
  if (context.taskId !== assessment.sourceLinks.taskId) issues.push({ severity: 'review', message: 'Comparison Context taskId mismatch.' });
  if (context.executionSessionId !== assessment.sourceLinks.executionSessionId) {
    issues.push({ severity: 'review', message: 'Comparison Context executionSessionId mismatch.' });
  }
  if (context.responseId !== assessment.sourceLinks.responseId) {
    issues.push({ severity: 'review', message: 'Comparison Context responseId mismatch.' });
  }
  return issues;
}

function buildObservationUnits(
  input: EvidenceConflictCoordinationInput,
  resolved: ResolvedEvidence[],
): UnitWithContext[] {
  const grouped = new Map<string, ResolvedEvidence[]>();
  for (const item of resolved) {
    const current = grouped.get(item.assessment.observationUnitId) || [];
    current.push(item);
    grouped.set(item.assessment.observationUnitId, current);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([observationUnitId, items]) => {
      const sorted = [...items].sort((left, right) => left.evidence.id.localeCompare(right.evidence.id));
      const contexts = uniqueContexts(sorted.map((item) => item.context).filter(Boolean) as EvidenceComparisonContext[]);
      const context = contexts.length === 1 ? contexts[0] : null;
      const direction = deriveUnitDirection(sorted.map((item) => item.evidence));
      const effectiveEligibility = mostRestrictiveEligibility(sorted.map((item) => item.effectiveEligibility));
      const effectiveQualityLevel = mostConservativeQuality(sorted.map((item) => item.assessment.qualityLevel));
      const comparisonClusterId = context
        ? buildComparisonClusterId(input.targetAbilityId, context, input.comparisonContexts)
        : buildStableId('comparison-cluster', [input.targetAbilityId, observationUnitId, 'unknown-context']);
      const limitations = uniqueStrings([
        ...sorted.flatMap((item) => item.assessment.limitations),
        ...(context ? context.validation.issues : ['Formal Comparison Context is missing.']),
        ...(sorted.length > 1 ? ['Multiple Evidence records share one observation unit and count once.'] : []),
      ]);
      const unit: EvidenceObservationUnitSummary = {
        observationUnitId,
        studentId: input.studentId,
        abilityId: input.targetAbilityId,
        direction,
        evidenceIds: uniqueSorted(sorted.map((item) => item.evidence.id)),
        qualityAssessmentIds: uniqueSorted(sorted.map((item) => item.assessment.assessmentId)),
        effectiveQualityLevel,
        effectiveEligibility,
        taskIds: uniqueSorted(sorted.map((item) => item.assessment.sourceLinks.taskId)),
        responseIds: uniqueSorted(sorted.map((item) => item.assessment.sourceLinks.responseId)),
        taskRoles: uniqueSorted(sorted.map((item) => item.assessment.facts.taskRole)),
        comparisonContextIds: context ? [context.comparisonContextId] : ['missing-comparison-context'],
        comparisonClusterId,
        limitations,
      };
      return { unit, context };
    });
}

function buildComparisonClusterId(
  abilityId: string,
  context: EvidenceComparisonContext,
  allContexts: EvidenceComparisonContext[],
): string {
  const root = resolveRepeatedContextRoot(context, allContexts);
  return buildStableId('comparison-cluster', [
    abilityId,
    root.materialIdentity || 'unknown-material',
    root.taskRole,
    root.taskNovelty,
    root.timingType,
    root.difficultyRelation,
    root.hintDependency,
    root.observationWindowId,
  ]);
}

function resolveRepeatedContextRoot(
  context: EvidenceComparisonContext,
  allContexts: EvidenceComparisonContext[],
): EvidenceComparisonContext {
  const byId = new Map(allContexts.map((item) => [item.comparisonContextId, item]));
  const visited = new Set<string>();
  let current = context;
  while (current.repeatedExecutionOf && byId.has(current.repeatedExecutionOf)) {
    if (visited.has(current.comparisonContextId)) break;
    visited.add(current.comparisonContextId);
    current = byId.get(current.repeatedExecutionOf) as EvidenceComparisonContext;
  }
  return current;
}

function deriveUnitDirection(evidence: AbilityEvidence[]): EvidenceObservationDirection {
  const hasPositive = evidence.some((item) => ['positive', 'growth'].includes(item.evidenceType));
  const hasWeakness = evidence.some((item) => item.evidenceType === 'weakness');
  if (hasPositive && hasWeakness) return 'mixed_signal';
  if (hasPositive) return 'positive_signal';
  if (hasWeakness) return 'weakness_signal';
  return 'insufficient_signal';
}

function deriveDifferenceFactors(units: UnitWithContext[]): EvidenceDifferenceFactor[] {
  const positive = selectBestDirectionalUnit(units, 'positive_signal');
  const weakness = selectBestDirectionalUnit(units, 'weakness_signal');
  if (!positive?.context || !weakness?.context) return [];

  const related = [positive.unit.observationUnitId, weakness.unit.observationUnitId].sort();
  const factors: EvidenceDifferenceFactor[] = [];
  const positiveContext = positive.context;
  const weaknessContext = weakness.context;

  pushRankedFactor(factors, {
    factor: 'hint',
    positiveValue: hintRank(positiveContext.hintDependency),
    weaknessValue: hintRank(weaknessContext.hintDependency),
    expectedDirection: 'positive_more_support',
    related,
    otherFactsKnown: knownDifficulty(positiveContext, weaknessContext) + knownMaterial(positiveContext, weaknessContext),
    description: `hint ${positiveContext.hintDependency} vs ${weaknessContext.hintDependency}`,
  });
  pushRankedFactor(factors, {
    factor: 'difficulty',
    positiveValue: difficultyRank(positiveContext.difficultyRelation),
    weaknessValue: difficultyRank(weaknessContext.difficultyRelation),
    expectedDirection: 'positive_lower_requirement',
    related,
    otherFactsKnown: knownHint(positiveContext, weaknessContext) + knownMaterial(positiveContext, weaknessContext),
    description: `difficulty ${positiveContext.difficultyRelation} vs ${weaknessContext.difficultyRelation}`,
  });
  pushRankedFactor(factors, {
    factor: 'material',
    positiveValue: noveltyRank(positiveContext.taskNovelty),
    weaknessValue: noveltyRank(weaknessContext.taskNovelty),
    expectedDirection: 'positive_lower_requirement',
    related,
    otherFactsKnown: knownHint(positiveContext, weaknessContext) + knownDifficulty(positiveContext, weaknessContext),
    description: `material ${positiveContext.taskNovelty} vs ${weaknessContext.taskNovelty}`,
  });
  pushRankedFactor(factors, {
    factor: 'timing',
    positiveValue: timingRank(positiveContext.timingType),
    weaknessValue: timingRank(weaknessContext.timingType),
    expectedDirection: 'positive_lower_requirement',
    related,
    otherFactsKnown: knownHint(positiveContext, weaknessContext) + knownDifficulty(positiveContext, weaknessContext) + knownMaterial(positiveContext, weaknessContext),
    description: `timing ${positiveContext.timingType} vs ${weaknessContext.timingType}`,
  });

  if (positiveContext.taskRole !== weaknessContext.taskRole) {
    const expected = positiveContext.taskRole === 'training' && ['retest', 'transfer'].includes(weaknessContext.taskRole);
    factors.push({
      factor: 'task_role',
      observedDifference: true,
      explanatoryStrength: expected ? 'plausible' : 'insufficient',
      relatedObservationUnitIds: related,
      reason: `Task roles differ: ${positiveContext.taskRole} vs ${weaknessContext.taskRole}.`,
    });
  }

  const positiveIndependent = positive.unit.effectiveEligibility === 'eligible' && positiveContext.hintDependency === 'none';
  const weaknessIndependent = weakness.unit.effectiveEligibility === 'eligible' && weaknessContext.hintDependency === 'none';
  if (positiveIndependent !== weaknessIndependent) {
    factors.push({
      factor: 'independence',
      observedDifference: true,
      explanatoryStrength: !positiveIndependent && weaknessIndependent ? 'plausible' : 'insufficient',
      relatedObservationUnitIds: related,
      reason: `Independent performance differs: positive=${positiveIndependent}, weakness=${weaknessIndependent}.`,
    });
  }

  return factors.sort((left, right) => left.factor.localeCompare(right.factor));
}

function pushRankedFactor(
  factors: EvidenceDifferenceFactor[],
  input: {
    factor: EvidenceDifferenceFactor['factor'];
    positiveValue: number | null;
    weaknessValue: number | null;
    expectedDirection: 'positive_lower_requirement' | 'positive_more_support';
    related: string[];
    otherFactsKnown: number;
    description: string;
  },
): void {
  if (input.positiveValue === null || input.weaknessValue === null) return;
  if (input.positiveValue === input.weaknessValue) return;
  const expected = input.expectedDirection === 'positive_more_support'
    ? input.positiveValue > input.weaknessValue
    : input.positiveValue < input.weaknessValue;
  const strength = expected
    ? input.otherFactsKnown >= 2 ? 'strong' : 'plausible'
    : 'insufficient';
  factors.push({
    factor: input.factor,
    observedDifference: true,
    explanatoryStrength: strength,
    relatedObservationUnitIds: input.related,
    reason: `${input.description}; coordination strength=${strength}.`,
  });
}

function deriveStatus(input: {
  units: UnitWithContext[];
  independentContextCount: number;
  differenceFactors: EvidenceDifferenceFactor[];
  hasReviewIssues: boolean;
}): EvidenceConflictStatus {
  if (input.hasReviewIssues) return 'review_required';

  const directional = input.units.filter((item) => (
    ['eligible', 'limited'].includes(item.unit.effectiveEligibility) &&
    ['positive_signal', 'weakness_signal'].includes(item.unit.direction)
  ));
  const allPositive = directional.some((item) => item.unit.direction === 'positive_signal');
  const allWeakness = directional.some((item) => item.unit.direction === 'weakness_signal');
  const eligiblePositive = directional.some((item) => (
    item.unit.direction === 'positive_signal' && item.unit.effectiveEligibility === 'eligible'
  ));
  const eligibleWeakness = directional.some((item) => (
    item.unit.direction === 'weakness_signal' && item.unit.effectiveEligibility === 'eligible'
  ));
  const strongFactors = input.differenceFactors.filter((factor) => factor.explanatoryStrength === 'strong').length;
  const plausibleFactors = input.differenceFactors.filter((factor) => factor.explanatoryStrength === 'plausible').length;
  const differencesExplainComparison = strongFactors >= 1 || plausibleFactors >= 2;

  if (allPositive && allWeakness && differencesExplainComparison) {
    return 'explainable_mixed_evidence';
  }
  if (eligiblePositive && eligibleWeakness) {
    return input.independentContextCount >= 2 && hasSufficientConflictComparability(input.units)
      ? 'unresolved_conflict'
      : 'insufficient_comparable_evidence';
  }
  if (eligiblePositive && input.independentContextCount >= 2) return 'aligned_positive_evidence';
  if (eligibleWeakness && input.independentContextCount >= 2) return 'aligned_weakness_evidence';
  return 'insufficient_comparable_evidence';
}

function hasSufficientConflictComparability(units: UnitWithContext[]): boolean {
  const positive = selectBestDirectionalUnit(units, 'positive_signal');
  const weakness = selectBestDirectionalUnit(units, 'weakness_signal');
  if (!positive?.context || !weakness?.context) return false;

  return [positive.context, weakness.context].every((context) => (
    isNonEmptyString(context.materialIdentity) &&
    context.hintDependency !== 'unknown' &&
    context.difficultyRelation !== 'unknown' &&
    context.taskNovelty !== 'unknown' &&
    context.timingType !== 'unknown'
  ));
}

function deriveRecommendation(status: EvidenceConflictStatus): EvidenceCoordinationRecommendation {
  if (['aligned_positive_evidence', 'aligned_weakness_evidence'].includes(status)) {
    return 'proceed_to_evaluation';
  }
  if (status === 'explainable_mixed_evidence') return 'proceed_with_limitations';
  if (status === 'unresolved_conflict') return 'request_discriminating_observation';
  if (status === 'review_required') return 'human_review';
  return 'collect_more_evidence';
}

function buildComparisonFacts(input: {
  units: UnitWithContext[];
  independentContextCount: number;
  eligibleEvidenceIds: string[];
  limitedEvidenceIds: string[];
}): string[] {
  return [
    `Observation units=${input.units.length}.`,
    `Independent contexts=${input.independentContextCount}.`,
    `Eligible Evidence=${uniqueSorted(input.eligibleEvidenceIds).length}.`,
    `Limited Evidence=${uniqueSorted(input.limitedEvidenceIds).length}.`,
    `Comparison clusters=${new Set(input.units.map((item) => item.unit.comparisonClusterId)).size}.`,
  ];
}

function buildConflictFactors(
  status: EvidenceConflictStatus,
  units: UnitWithContext[],
  factors: EvidenceDifferenceFactor[],
): string[] {
  if (status !== 'unresolved_conflict') return [];
  const directions = units
    .filter((item) => item.unit.effectiveEligibility === 'eligible')
    .map((item) => `${item.unit.observationUnitId}:${item.unit.direction}`);
  const insufficient = factors
    .filter((factor) => factor.explanatoryStrength === 'insufficient')
    .map((factor) => `${factor.factor} difference is insufficient to coordinate the directions.`);
  return uniqueStrings([...directions, ...insufficient]);
}

function buildLimitations(input: {
  status: EvidenceConflictStatus;
  units: UnitWithContext[];
  independentContextCount: number;
  resolutionIssues: string[];
  blockedEvidenceIds: string[];
  limitedEvidenceIds: string[];
}): string[] {
  const limitations: string[] = [];
  if (input.independentContextCount < 2) limitations.push('Fewer than two independently verified comparison contexts are available.');
  if (input.limitedEvidenceIds.length > 0) limitations.push('Limited Evidence is retained as context and does not independently satisfy sufficiency.');
  if (input.blockedEvidenceIds.length > 0) limitations.push('Blocked Evidence is retained for traceability and excluded from directional coordination.');
  if (input.units.some((item) => !item.context)) limitations.push('One or more observation units lack a formal Comparison Context.');
  if (new Set(input.units.map((item) => item.unit.comparisonClusterId)).size < input.units.length) {
    limitations.push('Homogeneous observation units do not increase independent context count.');
  }
  if (input.status === 'unresolved_conflict') limitations.push('Comparable evidence directions remain unresolved.');
  if (input.status === 'explainable_mixed_evidence') limitations.push('Condition differences limit direct comparison and do not prove causality.');
  limitations.push(...input.resolutionIssues);
  limitations.push('Conflict status describes Evidence relationships, not the student profile status.');
  return uniqueStrings(limitations);
}

function selectBestDirectionalUnit(
  units: UnitWithContext[],
  direction: 'positive_signal' | 'weakness_signal',
): UnitWithContext | null {
  const candidates = units.filter((item) => (
    item.unit.direction === direction &&
    ['eligible', 'limited'].includes(item.unit.effectiveEligibility)
  ));
  return candidates.sort((left, right) => {
    const eligibility = ELIGIBILITY_RANK[left.unit.effectiveEligibility] - ELIGIBILITY_RANK[right.unit.effectiveEligibility];
    if (eligibility !== 0) return eligibility;
    const quality = QUALITY_RANK[right.unit.effectiveQualityLevel] - QUALITY_RANK[left.unit.effectiveQualityLevel];
    if (quality !== 0) return quality;
    return left.unit.observationUnitId.localeCompare(right.unit.observationUnitId);
  })[0] || null;
}

function groupContexts(contexts: EvidenceComparisonContext[]): Map<string, EvidenceComparisonContext[]> {
  const grouped = new Map<string, EvidenceComparisonContext[]>();
  for (const context of contexts) {
    if (!context || !isNonEmptyString(context.observationUnitId)) continue;
    const current = grouped.get(context.observationUnitId) || [];
    if (!current.some((item) => item.comparisonContextId === context.comparisonContextId)) {
      current.push(context);
    }
    grouped.set(context.observationUnitId, current);
  }
  return grouped;
}

function classifyEvidenceId(
  evidenceId: string,
  eligibility: EvidenceEvaluationEligibility,
  buckets: {
    eligibleEvidenceIds: string[];
    limitedEvidenceIds: string[];
    blockedEvidenceIds: string[];
    reviewRequiredEvidenceIds: string[];
  },
): void {
  if (eligibility === 'eligible') buckets.eligibleEvidenceIds.push(evidenceId);
  else if (eligibility === 'limited') buckets.limitedEvidenceIds.push(evidenceId);
  else if (eligibility === 'blocked') buckets.blockedEvidenceIds.push(evidenceId);
  else buckets.reviewRequiredEvidenceIds.push(evidenceId);
}

function downgradeEligibilityWithoutContext(
  eligibility: EvidenceEvaluationEligibility,
): EvidenceEvaluationEligibility {
  if (eligibility === 'eligible') return 'limited';
  return eligibility;
}

function mostRestrictiveEligibility(values: EvidenceEvaluationEligibility[]): EvidenceEvaluationEligibility {
  return [...values].sort((left, right) => ELIGIBILITY_RANK[right] - ELIGIBILITY_RANK[left])[0] || 'blocked';
}

function mostConservativeQuality(values: EvidenceQualityLevel[]): EvidenceQualityLevel {
  return [...values].sort((left, right) => QUALITY_RANK[left] - QUALITY_RANK[right])[0] || 'insufficient';
}

function uniqueContexts(contexts: EvidenceComparisonContext[]): EvidenceComparisonContext[] {
  const byId = new Map(contexts.map((context) => [context.comparisonContextId, context]));
  return [...byId.values()].sort((left, right) => left.comparisonContextId.localeCompare(right.comparisonContextId));
}

function dedupeEvidence(evidence: AbilityEvidence[]): AbilityEvidence[] {
  const byId = new Map<string, AbilityEvidence>();
  for (const item of evidence || []) {
    if (item && !byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function serializeDifferenceFactor(factor: EvidenceDifferenceFactor): string {
  return [
    factor.factor,
    String(factor.observedDifference),
    factor.explanatoryStrength,
    ...factor.relatedObservationUnitIds,
    factor.reason,
  ].join(':');
}

function hintRank(value: string): number | null {
  return ({ none: 0, low: 1, medium: 2, high: 3 } as Record<string, number>)[value] ?? null;
}

function difficultyRank(value: string): number | null {
  return ({ lower: 0, comparable: 1, higher: 2 } as Record<string, number>)[value] ?? null;
}

function noveltyRank(value: string): number | null {
  return ({ same: 0, similar: 1, transfer: 2 } as Record<string, number>)[value] ?? null;
}

function timingRank(value: string): number | null {
  return ({ immediate: 0, delayed: 1 } as Record<string, number>)[value] ?? null;
}

function knownHint(left: EvidenceComparisonContext, right: EvidenceComparisonContext): number {
  return hintRank(left.hintDependency) !== null && hintRank(right.hintDependency) !== null ? 1 : 0;
}

function knownDifficulty(left: EvidenceComparisonContext, right: EvidenceComparisonContext): number {
  return difficultyRank(left.difficultyRelation) !== null && difficultyRank(right.difficultyRelation) !== null ? 1 : 0;
}

function knownMaterial(left: EvidenceComparisonContext, right: EvidenceComparisonContext): number {
  return left.materialIdentity && right.materialIdentity &&
    noveltyRank(left.taskNovelty) !== null && noveltyRank(right.taskNovelty) !== null ? 1 : 0;
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => isNonEmptyString(value)))].sort();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
