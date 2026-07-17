import type {
  AdaptiveConstraintRule,
  AdaptiveDifficultyDirection,
  AdaptiveHintPolicy,
  AdaptiveLearningIntent,
  AdaptiveMaterialNovelty,
  AdaptiveObservationTarget,
  AdaptiveTargetEvidenceQuality,
  AdaptiveTaskConstraints,
  AdaptiveTaskConstraintsInput,
  AdaptiveTaskConstraintsResult,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import {
  ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
  isAdaptiveTaskContextSnapshot,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import { isEvidenceConflictAssessment } from '../schemas/evidenceConflictAssessment.schema.ts';
import type { EvidenceQualityAssessment } from '../schemas/evidenceQualityAssessment.schema.ts';
import { resolveCurrentEvidenceQualityAssessment } from '../schemas/evidenceQualityAssessment.schema.ts';
import {
  isCurrentLearningContext,
  isNextLearningStrategy,
  isStrategyValidationResult,
} from '../schemas/nextLearningStrategy.schema.ts';

type DerivedConstraintShape = {
  learningIntent: AdaptiveLearningIntent;
  observationTarget: AdaptiveObservationTarget;
  difficultyDirection: AdaptiveDifficultyDirection;
  materialNovelty: AdaptiveMaterialNovelty;
  hintPolicy: AdaptiveHintPolicy;
  targetEvidenceQuality: AdaptiveTargetEvidenceQuality;
};

export function deriveAdaptiveTaskConstraints(
  input: AdaptiveTaskConstraintsInput,
): AdaptiveTaskConstraintsResult {
  const issues = validateInput(input);
  const status = inferBlockedStatus(input, issues);
  if (issues.length > 0) return { status, constraints: null, issues: uniqueSorted(issues) };

  const currentAssessments = resolveCurrentAssessments(input.qualityAssessments);
  const derived = deriveConstraintShape(input, currentAssessments);
  const requiredCapabilities = deriveRequiredCapabilities(input, derived);
  const hardConstraints = buildHardConstraints(input, derived, requiredCapabilities);
  const softPreferences = buildSoftPreferences(input, derived);
  const reasons = buildReasons(input, derived);
  const limitations = buildLimitations(input, currentAssessments);
  const sourceQualityAssessmentIds = uniqueSorted(currentAssessments.map((item) => item.assessmentId));
  const sourceEvidenceIds = uniqueSorted(input.conflictAssessment.evidenceLinks);
  const sourceObservationUnitIds = uniqueSorted(
    input.conflictAssessment.observationUnits.map((unit) => unit.observationUnitId),
  );
  const constraintsId = buildStableId('adaptive-constraints', [
    input.strategy.studentId,
    input.strategy.targetAbilityId,
    input.strategy.strategyId,
    input.adaptiveTaskContext.contextId,
    input.conflictAssessment.conflictAssessmentId,
    ...sourceQualityAssessmentIds,
    derived.learningIntent,
    derived.observationTarget,
    input.strategy.recommendedTaskRole,
    derived.difficultyDirection,
    derived.materialNovelty,
    derived.hintPolicy,
    ...serializeRules([...hardConstraints, ...softPreferences]),
    ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ]);

  const constraints: AdaptiveTaskConstraints = {
    constraintsId,
    studentId: input.strategy.studentId,
    targetAbilityId: input.strategy.targetAbilityId,
    sourceStrategyId: input.strategy.strategyId,
    sourceStrategyAction: input.strategy.action,
    sourceStrategyTaskRole: input.strategy.recommendedTaskRole,
    sourceValidationGoal: input.strategy.validationGoal,
    sourceContextSnapshotId: input.adaptiveTaskContext.contextId,
    sourceConflictAssessmentId: input.conflictAssessment.conflictAssessmentId,
    sourceConflictStatus: input.conflictAssessment.status,
    sourceQualityAssessmentIds,
    sourceEvidenceIds,
    sourceObservationUnitIds,
    ...derived,
    recommendedTaskRole: input.strategy.recommendedTaskRole,
    preExecutionQualityConditions: {
      requireNovelMaterial: derived.materialNovelty === 'new_context',
      requireKnownDifficulty: true,
      requireAbilityAlignment: true,
      requiredHintPolicy: derived.hintPolicy,
      requireTraceability: true,
    },
    requiredCapabilities,
    hardConstraints,
    softPreferences,
    reasons,
    limitations,
    schemaVersion: ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
    policyVersion: ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
    generatedAt: input.generatedAt,
    validation: { passed: true, issues: [] },
  };

  return { status: 'generated', constraints, issues: [] };
}

function validateInput(input: AdaptiveTaskConstraintsInput): string[] {
  const issues: string[] = [];
  const { strategy, strategyValidationResult, currentLearningContext, adaptiveTaskContext, conflictAssessment } = input;

  if (!isNextLearningStrategy(strategy)) issues.push('NextLearningStrategy failed schema validation.');
  if (!isStrategyValidationResult(strategyValidationResult)) issues.push('StrategyValidationResult failed schema validation.');
  if (!isCurrentLearningContext(currentLearningContext)) issues.push('CurrentLearningContext failed schema validation.');
  if (!isAdaptiveTaskContextSnapshot(adaptiveTaskContext) || !adaptiveTaskContext.validation.passed) {
    issues.push('AdaptiveTaskContextSnapshot failed validation.');
  }
  if (!isEvidenceConflictAssessment(conflictAssessment) || !conflictAssessment.validation.passed) {
    issues.push('EvidenceConflictAssessment failed validation.');
  }
  if (!strategyValidationResult.isValid || strategyValidationResult.nextStep !== 'create_task_request') {
    issues.push('StrategyValidationResult does not allow TaskRequest creation.');
  }
  if (strategyValidationResult.strategyId !== strategy.strategyId) issues.push('StrategyValidationResult strategyId mismatch.');
  if (currentLearningContext.contextId !== adaptiveTaskContext.sourceLearningContextId) {
    issues.push('AdaptiveTaskContextSnapshot is not traceable to CurrentLearningContext.');
  }
  if (strategy.studentId !== currentLearningContext.studentId || strategy.studentId !== adaptiveTaskContext.studentId) {
    issues.push('studentId mismatch across Strategy and Context.');
  }
  if (strategy.targetAbilityId !== adaptiveTaskContext.targetAbilityId) issues.push('targetAbilityId mismatch with Context Snapshot.');
  if (strategy.studentId !== conflictAssessment.studentId) issues.push('studentId mismatch with Conflict Assessment.');
  if (strategy.targetAbilityId !== conflictAssessment.abilityId) issues.push('targetAbilityId mismatch with Conflict Assessment.');
  if (!adaptiveTaskContext.allowedTaskRoles.includes(strategy.recommendedTaskRole)) {
    issues.push('Strategy task role is not allowed by AdaptiveTaskContextSnapshot.');
  }
  if (conflictAssessment.status === 'review_required') issues.push('Conflict Assessment requires review.');
  if (
    conflictAssessment.status === 'unresolved_conflict' &&
    !['collect_more_evidence', 'diagnostic_verification'].includes(strategy.action)
  ) issues.push('Unresolved conflict requires a discriminating observation Strategy.');
  if (
    conflictAssessment.status === 'insufficient_comparable_evidence' &&
    !['collect_more_evidence', 'diagnostic_verification'].includes(strategy.action)
  ) issues.push('Insufficient comparable Evidence requires an observation Strategy.');
  if (!intersects(strategy.evidenceLinks, conflictAssessment.evidenceLinks)) {
    issues.push('Strategy Evidence and Conflict Assessment Evidence are not traceable to the same facts.');
  }
  if (!input.generatedAt || Number.isNaN(Date.parse(input.generatedAt))) issues.push('generatedAt must be a valid timestamp.');
  if (!input.timezone?.trim() || input.timezone !== adaptiveTaskContext.timezone) issues.push('timezone mismatch or missing.');

  const resolutions = groupEvidenceIds(input.qualityAssessments).map((evidenceId) => (
    resolveCurrentEvidenceQualityAssessment(evidenceId, input.qualityAssessments)
  ));
  if (resolutions.some((resolution) => resolution.status !== 'resolved' || !resolution.assessment)) {
    issues.push('Current EvidenceQualityAssessment cannot be uniquely resolved.');
  }
  const resolvedIds = uniqueSorted(
    resolutions.flatMap((resolution) => resolution.assessment ? [resolution.assessment.assessmentId] : []),
  );
  const expectedIds = uniqueSorted(conflictAssessment.currentQualityAssessmentIds);
  if (!sameValues(resolvedIds, expectedIds)) issues.push('Conflict Assessment does not reference the current Quality Assessment set.');
  if (input.qualityAssessments.some((item) => item.studentId !== strategy.studentId || item.abilityId !== strategy.targetAbilityId)) {
    issues.push('Quality Assessment identity mismatch.');
  }

  return uniqueSorted(issues);
}

function inferBlockedStatus(
  input: AdaptiveTaskConstraintsInput,
  issues: string[],
): AdaptiveTaskConstraintsResult['status'] {
  if (input.strategy.action === 'human_review') return 'review_required';
  if (issues.some((issue) => issue.includes('not traceable') || issue.includes('identity mismatch') || issue.includes('studentId mismatch') || issue.includes('targetAbilityId mismatch'))) {
    return 'blocked';
  }
  if (issues.some((issue) => issue.includes('requires review') || issue.includes('uniquely resolved') || issue.includes('current Quality'))) {
    return 'review_required';
  }
  if (issues.some((issue) => issue.includes('Strategy') || issue.includes('task role') || issue.includes('observation Strategy'))) {
    return 'regenerate_strategy';
  }
  return 'blocked';
}

function resolveCurrentAssessments(assessments: EvidenceQualityAssessment[]): EvidenceQualityAssessment[] {
  return groupEvidenceIds(assessments)
    .map((evidenceId) => resolveCurrentEvidenceQualityAssessment(evidenceId, assessments).assessment)
    .filter((assessment): assessment is EvidenceQualityAssessment => Boolean(assessment))
    .sort((left, right) => left.assessmentId.localeCompare(right.assessmentId));
}

function deriveConstraintShape(
  input: AdaptiveTaskConstraintsInput,
  assessments: EvidenceQualityAssessment[],
): DerivedConstraintShape {
  const action = input.strategy.action;
  let learningIntent: AdaptiveLearningIntent = 'consolidation';
  let observationTarget: AdaptiveObservationTarget = 'recheck_weakness';
  let difficultyDirection: AdaptiveDifficultyDirection = 'maintain';
  let materialNovelty: AdaptiveMaterialNovelty = 'similar_context';
  let hintPolicy: AdaptiveHintPolicy = 'limited_hint';
  let targetEvidenceQuality: AdaptiveTargetEvidenceQuality = 'medium';

  if (action === 'lower_difficulty_training') {
    learningIntent = 'foundation';
    observationTarget = 'strengthen_foundation';
    difficultyDirection = 'decrease';
    hintPolicy = 'allow_guidance';
  } else if (action === 'independent_retest') {
    learningIntent = 'independent_validation';
    observationTarget = 'verify_independence';
    hintPolicy = 'no_hint';
    targetEvidenceQuality = 'high';
  } else if (action === 'transfer_test') {
    learningIntent = 'transfer_validation';
    observationTarget = 'verify_transfer';
    materialNovelty = 'new_context';
    hintPolicy = 'no_hint';
    targetEvidenceQuality = 'high';
  } else if (action === 'maintenance_validation') {
    learningIntent = 'delayed_validation';
    observationTarget = 'verify_retention';
    materialNovelty = input.strategy.recommendedTaskRole === 'transfer' ? 'new_context' : 'similar_context';
    hintPolicy = 'no_hint';
    targetEvidenceQuality = 'high';
  } else if (action === 'diagnostic_verification') {
    learningIntent = 'diagnostic_observation';
    observationTarget = 'recheck_weakness';
    hintPolicy = 'limited_hint';
  } else if (action === 'collect_more_evidence') {
    learningIntent = input.conflictAssessment.status === 'unresolved_conflict'
      ? 'discriminating_observation'
      : 'diagnostic_observation';
    observationTarget = input.conflictAssessment.status === 'unresolved_conflict'
      ? 'resolve_direction_conflict'
      : 'collect_comparable_evidence';
    hintPolicy = 'no_hint';
    targetEvidenceQuality = 'high';
  } else if (action === 'switch_ability') {
    learningIntent = 'foundation';
    observationTarget = 'strengthen_foundation';
    hintPolicy = 'allow_guidance';
  }

  const hintDifference = input.conflictAssessment.differenceFactors.find((factor) => (
    factor.factor === 'hint' && factor.observedDifference && factor.explanatoryStrength !== 'insufficient'
  ));
  if (hintDifference && action === 'continue_training') hintPolicy = 'limited_hint';

  const hasHintDependentPositive = assessments.some((assessment) => (
    ['positive', 'growth'].includes(assessment.evidenceType) && assessment.facts.hintDependency !== 'none'
  ));
  if (hasHintDependentPositive && action === 'continue_training') hintPolicy = 'limited_hint';

  return {
    learningIntent,
    observationTarget,
    difficultyDirection,
    materialNovelty,
    hintPolicy,
    targetEvidenceQuality,
  };
}

function deriveRequiredCapabilities(
  input: AdaptiveTaskConstraintsInput,
  derived: DerivedConstraintShape,
): string[] {
  const capabilities = ['open_response', 'ability_observation'];
  if (input.strategy.targetAbilityId.includes('推理') || input.strategy.validationGoal.includes('推理')) {
    capabilities.push('text_evidence', 'inference_chain');
  }
  if (input.strategy.recommendedTaskRole === 'training') capabilities.push('focused_practice');
  if (input.strategy.recommendedTaskRole === 'diagnosis') capabilities.push('root_cause_probe');
  if (derived.materialNovelty === 'new_context') capabilities.push('new_context_transfer');
  if (derived.hintPolicy === 'no_hint') capabilities.push('independent_answer');
  return uniqueSorted(capabilities);
}

function buildHardConstraints(
  input: AdaptiveTaskConstraintsInput,
  derived: DerivedConstraintShape,
  capabilities: string[],
): AdaptiveConstraintRule[] {
  const rules: AdaptiveConstraintRule[] = [
    { code: 'task_role', operator: 'eq', value: input.strategy.recommendedTaskRole, source: 'strategy' },
    { code: 'target_ability', operator: 'eq', value: input.strategy.targetAbilityId, source: 'strategy' },
    { code: 'difficulty', operator: 'eq', value: derived.difficultyDirection, source: 'strategy' },
    { code: 'material_novelty', operator: 'eq', value: derived.materialNovelty, source: 'quality' },
    { code: 'hint_policy', operator: 'eq', value: derived.hintPolicy, source: 'quality' },
    { code: 'required_capability', operator: 'required', value: capabilities, source: 'strategy' },
  ];
  if (derived.materialNovelty === 'new_context' && input.adaptiveTaskContext.recentMaterialIds.length > 0) {
    rules.push({
      code: 'exclude_material',
      operator: 'exclude',
      value: input.adaptiveTaskContext.recentMaterialIds,
      source: 'quality',
    });
  }
  return sortRules(rules);
}

function buildSoftPreferences(
  input: AdaptiveTaskConstraintsInput,
  derived: DerivedConstraintShape,
): AdaptiveConstraintRule[] {
  const rules: AdaptiveConstraintRule[] = [];
  if (input.adaptiveTaskContext.recentTaskIds.length > 0) {
    rules.push({
      code: 'exclude_task',
      operator: 'exclude',
      value: input.adaptiveTaskContext.recentTaskIds,
      source: 'quality',
    });
  }
  if (derived.targetEvidenceQuality === 'high') {
    rules.push({
      code: 'required_capability',
      operator: 'required',
      value: 'complete_traceability',
      source: 'conflict',
    });
  }
  return sortRules(rules);
}

function buildReasons(input: AdaptiveTaskConstraintsInput, derived: DerivedConstraintShape): string[] {
  return uniqueSorted([
    `Strategy keeps task role ${input.strategy.recommendedTaskRole} and action ${input.strategy.action}.`,
    `Observation target is ${derived.observationTarget}.`,
    `Conflict status is ${input.conflictAssessment.status}.`,
  ]);
}

function buildLimitations(
  input: AdaptiveTaskConstraintsInput,
  assessments: EvidenceQualityAssessment[],
): string[] {
  return uniqueSorted([
    ...input.strategy.limitations,
    ...input.conflictAssessment.limitations,
    ...assessments.flatMap((assessment) => assessment.limitations),
    'Target Evidence quality is an observation goal, not an execution result guarantee.',
  ]);
}

function groupEvidenceIds(assessments: EvidenceQualityAssessment[]): string[] {
  return uniqueSorted(assessments.map((assessment) => assessment.evidenceId));
}

function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sortRules(rules: AdaptiveConstraintRule[]): AdaptiveConstraintRule[] {
  return [...rules].sort((left, right) => serializeRule(left).localeCompare(serializeRule(right)));
}

function serializeRules(rules: AdaptiveConstraintRule[]): string[] {
  return sortRules(rules).map(serializeRule);
}

function serializeRule(rule: AdaptiveConstraintRule): string {
  const value = Array.isArray(rule.value) ? [...rule.value].sort().join(',') : String(rule.value);
  return `${rule.code}:${rule.operator}:${value}:${rule.source}`;
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))].sort();
}
