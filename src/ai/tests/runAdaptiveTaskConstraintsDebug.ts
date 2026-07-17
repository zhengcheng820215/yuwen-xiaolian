import { buildAdaptiveTaskContextSnapshot } from '../agents/adaptiveTaskContextAdapter.ts';
import { deriveAdaptiveTaskConstraints } from '../agents/adaptiveTaskConstraintsAgent.ts';
import { createAdaptiveTaskRequestEnvelope } from '../agents/adaptiveTaskRequestEnvelopeAgent.ts';
import { validateStrategyConstraintAlignment } from '../agents/strategyConstraintAlignmentAgent.ts';
import {
  createAdaptiveTaskFulfillmentRequest,
} from '../agents/taskFulfillmentRequestAgent.ts';
import { createTaskRequest } from '../agents/taskRequestAgent.ts';
import { matchTaskResources } from '../agents/taskResourceMatchingAgent.ts';
import { validateNextLearningStrategy } from '../agents/strategyValidationAgent.ts';
import type {
  AdaptiveTaskConstraints,
  AdaptiveTaskConstraintsInput,
  AdaptiveTaskContextSnapshot,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import {
  isAdaptiveTaskConstraints,
  isAdaptiveTaskRequestEnvelope,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import type {
  EvidenceConflictAssessment,
  EvidenceConflictStatus,
} from '../schemas/evidenceConflictAssessment.schema.ts';
import {
  EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_CONFLICT_POLICY_VERSION,
} from '../schemas/evidenceConflictAssessment.schema.ts';
import type { EvidenceQualityAssessment } from '../schemas/evidenceQualityAssessment.schema.ts';
import {
  EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_QUALITY_POLICY_VERSION,
} from '../schemas/evidenceQualityAssessment.schema.ts';
import type {
  CurrentLearningContext,
  NextLearningAction,
  NextLearningStrategy,
  RecommendedTaskRole,
} from '../schemas/nextLearningStrategy.schema.ts';
import { isTaskFulfillmentRequest } from '../schemas/taskFulfillment.schema.ts';

const STUDENT_ID = 'student-phase14-3';
const ABILITY_ID = '推理';
const RUN_AT = '2026-07-17T12:00:00.000Z';

type DebugCaseResult = { name: string; passed: boolean; detail: string };
type Pipeline = ReturnType<typeof runPipeline>;
const results: DebugCaseResult[] = [];

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

function buildInput(options: {
  action?: NextLearningAction;
  taskRole?: RecommendedTaskRole;
  conflictStatus?: EvidenceConflictStatus;
  evidenceTypes?: ('weakness' | 'positive' | 'growth' | 'insufficient')[];
  hintDependency?: EvidenceQualityAssessment['facts']['hintDependency'];
  allowTraining?: boolean;
  allowRetest?: boolean;
  allowTransfer?: boolean;
} = {}): AdaptiveTaskConstraintsInput {
  const action = options.action || 'continue_training';
  const taskRole = options.taskRole || roleForAction(action);
  const evidenceTypes = options.evidenceTypes || ['weakness', 'weakness'];
  const context = buildContext({
    allowTraining: options.allowTraining ?? true,
    allowRetest: options.allowRetest ?? true,
    allowTransfer: options.allowTransfer ?? true,
  });
  const strategy = buildStrategy(action, taskRole);
  const strategyValidationResult = validateNextLearningStrategy({
    strategy,
    currentLearningContext: context,
    validatedAt: RUN_AT,
  });
  const adaptiveTaskContext = buildAdaptiveTaskContextSnapshot({
    currentLearningContext: context,
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    currentDifficultyLevel: 'same',
    recentTaskIds: ['task-recent-1'],
    recentMaterialIds: ['material-recent-1'],
    activeSessionId: 'session-phase14-3',
    timezone: 'Asia/Shanghai',
  });
  const qualityAssessments = evidenceTypes.map((type, index) => buildQualityAssessment(
    `evidence-${index + 1}`,
    type,
    options.hintDependency || 'none',
  ));
  const conflictAssessment = buildConflictAssessment(
    options.conflictStatus || inferConflictStatus(evidenceTypes),
    qualityAssessments,
  );

  return {
    strategy,
    strategyValidationResult,
    currentLearningContext: context,
    adaptiveTaskContext,
    qualityAssessments,
    conflictAssessment,
    generatedAt: RUN_AT,
    timezone: 'Asia/Shanghai',
  };
}

function runPipeline(input: AdaptiveTaskConstraintsInput) {
  const derivation = deriveAdaptiveTaskConstraints(input);
  if (!derivation.constraints) {
    return { derivation, alignment: null, taskRequest: null, envelope: null, fulfillment: null };
  }
  const alignment = validateStrategyConstraintAlignment({
    strategy: input.strategy,
    strategyValidationResult: input.strategyValidationResult,
    adaptiveTaskContext: input.adaptiveTaskContext,
    constraints: derivation.constraints,
    alignedAt: RUN_AT,
  });
  if (!alignment.canCreateTaskRequest) {
    return { derivation, alignment, taskRequest: null, envelope: null, fulfillment: null };
  }
  const conversion = createTaskRequest({
    strategy: input.strategy,
    validationResult: input.strategyValidationResult,
    createdAt: RUN_AT,
  });
  const taskRequest = conversion.taskRequest;
  if (!taskRequest) return { derivation, alignment, taskRequest: null, envelope: null, fulfillment: null };
  const envelopeResult = createAdaptiveTaskRequestEnvelope({
    taskRequest,
    adaptiveConstraints: derivation.constraints,
    alignmentResult: alignment,
  });
  const envelope = envelopeResult.envelope;
  const fulfillment = envelope
    ? createAdaptiveTaskFulfillmentRequest({ adaptiveTaskRequestEnvelope: envelope, createdAt: RUN_AT })
    : null;
  return { derivation, alignment, taskRequest, envelope, fulfillment };
}

function requireSuccess(pipeline: Pipeline): asserts pipeline is Pipeline & {
  derivation: Pipeline['derivation'] & { constraints: AdaptiveTaskConstraints };
  alignment: NonNullable<Pipeline['alignment']>;
  taskRequest: NonNullable<Pipeline['taskRequest']>;
  envelope: NonNullable<Pipeline['envelope']>;
  fulfillment: NonNullable<Pipeline['fulfillment']>;
} {
  expect(pipeline.derivation.status === 'generated', `Expected generated, got ${pipeline.derivation.status}.`);
  expect(pipeline.derivation.constraints, 'Expected AdaptiveTaskConstraints.');
  expect(isAdaptiveTaskConstraints(pipeline.derivation.constraints), 'Constraints failed schema validation.');
  expect(pipeline.alignment?.status === 'aligned', `Expected aligned, got ${pipeline.alignment?.status}.`);
  expect(pipeline.taskRequest, 'Expected TaskRequest.');
  expect(pipeline.envelope && isAdaptiveTaskRequestEnvelope(pipeline.envelope), 'Expected valid Envelope.');
  expect(pipeline.fulfillment?.request && isTaskFulfillmentRequest(pipeline.fulfillment.request), 'Expected valid Fulfillment Request.');
}

runCase('Case 1: high-quality weakness continues training', () => {
  const pipeline = runPipeline(buildInput());
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.learningIntent === 'consolidation', 'Expected consolidation.');
  expect(pipeline.derivation.constraints.difficultyDirection === 'maintain', 'Expected maintain difficulty.');
});

runCase('Case 2: lower difficulty Strategy stays lower', () => {
  const pipeline = runPipeline(buildInput({ action: 'lower_difficulty_training' }));
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.difficultyDirection === 'decrease', 'Expected decrease.');
  expect(pipeline.fulfillment.request?.difficultyRange.preferred === 'lower', 'Expected lower fulfillment difficulty.');
});

runCase('Case 3: hinted positive independent retest requires no hint', () => {
  const pipeline = runPipeline(buildInput({
    action: 'independent_retest',
    evidenceTypes: ['positive', 'growth'],
    hintDependency: 'high',
  }));
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.hintPolicy === 'no_hint', 'Expected no_hint.');
  expect(pipeline.derivation.constraints.targetEvidenceQuality === 'high', 'Expected high target quality.');
});

runCase('Case 4: transfer Strategy requires new context', () => {
  const pipeline = runPipeline(buildInput({ action: 'transfer_test', evidenceTypes: ['positive', 'growth'] }));
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.materialNovelty === 'new_context', 'Expected new context.');
  expect(pipeline.fulfillment.request?.contentType === 'new_text', 'Expected new_text fulfillment.');
});

runCase('Case 5: maintenance validation remains delayed observation', () => {
  const pipeline = runPipeline(buildInput({ action: 'maintenance_validation', taskRole: 'retest' }));
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.learningIntent === 'delayed_validation', 'Expected delayed validation.');
  expect(pipeline.derivation.constraints.observationTarget === 'verify_retention', 'Expected retention observation.');
});

runCase('Case 6: unresolved conflict creates discriminating observation', () => {
  const pipeline = runPipeline(buildInput({
    action: 'collect_more_evidence',
    conflictStatus: 'unresolved_conflict',
    evidenceTypes: ['positive', 'weakness'],
  }));
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.learningIntent === 'discriminating_observation', 'Expected discriminating observation.');
});

runCase('Case 7: unresolved conflict cannot enter transfer Strategy', () => {
  const pipeline = runPipeline(buildInput({
    action: 'transfer_test',
    conflictStatus: 'unresolved_conflict',
    evidenceTypes: ['positive', 'weakness'],
  }));
  expect(pipeline.derivation.status === 'regenerate_strategy', 'Expected regenerate_strategy.');
  expect(pipeline.derivation.constraints === null, 'Must not generate Constraints.');
});

runCase('Case 8: hint-related mixed Evidence reduces support', () => {
  const input = buildInput({ conflictStatus: 'explainable_mixed_evidence', evidenceTypes: ['positive', 'weakness'] });
  input.conflictAssessment.differenceFactors = [differenceFactor('hint', 'strong')];
  const pipeline = runPipeline(input);
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.hintPolicy === 'limited_hint', 'Expected limited hint.');
});

runCase('Case 9: material-related mixed Evidence stays within Strategy', () => {
  const input = buildInput({ conflictStatus: 'explainable_mixed_evidence', evidenceTypes: ['positive', 'weakness'] });
  input.conflictAssessment.differenceFactors = [differenceFactor('material', 'strong')];
  const pipeline = runPipeline(input);
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.recommendedTaskRole === input.strategy.recommendedTaskRole, 'Task role changed.');
});

runCase('Case 10: insufficient Evidence requires observation Strategy', () => {
  const pipeline = runPipeline(buildInput({
    action: 'collect_more_evidence',
    conflictStatus: 'insufficient_comparable_evidence',
    evidenceTypes: ['insufficient', 'insufficient'],
  }));
  requireSuccess(pipeline);
  expect(pipeline.derivation.constraints.observationTarget === 'collect_comparable_evidence', 'Expected comparable evidence target.');
});

runCase('Case 11: review-required conflict blocks handoff', () => {
  const pipeline = runPipeline(buildInput({ conflictStatus: 'review_required' }));
  expect(pipeline.derivation.status === 'review_required', 'Expected review_required.');
  expect(pipeline.envelope === null, 'Review case must not create Envelope.');
});

runCase('Case 12: incompatible action and role are not repaired', () => {
  const pipeline = runPipeline(buildInput({ action: 'transfer_test', taskRole: 'training' }));
  expect(pipeline.derivation.status === 'regenerate_strategy', 'Expected regenerate_strategy.');
});

runCase('Case 13: identity mismatch blocks', () => {
  const input = buildInput();
  input.conflictAssessment.studentId = 'other-student';
  const pipeline = runPipeline(input);
  expect(pipeline.derivation.status === 'blocked', `Expected blocked, got ${pipeline.derivation.status}.`);
});

runCase('Case 14: forked Quality Assessment requires review', () => {
  const input = buildInput();
  input.qualityAssessments.push({
    ...input.qualityAssessments[0],
    assessmentId: 'qa-evidence-1-fork',
  });
  const pipeline = runPipeline(input);
  expect(pipeline.derivation.status === 'review_required', 'Expected review_required.');
});

runCase('Case 15: Conflict referencing old Assessment requires review', () => {
  const input = buildInput();
  const old = input.qualityAssessments[0];
  input.qualityAssessments.push({
    ...old,
    assessmentId: 'qa-evidence-1-new',
    supersedesAssessmentId: old.assessmentId,
  });
  const pipeline = runPipeline(input);
  expect(pipeline.derivation.status === 'review_required', 'Expected review_required.');
});

runCase('Case 16: unlinked Strategy and Conflict are blocked', () => {
  const input = buildInput();
  input.strategy = { ...input.strategy, evidenceLinks: ['unlinked-evidence'] };
  input.strategyValidationResult = validateNextLearningStrategy({
    strategy: input.strategy,
    currentLearningContext: input.currentLearningContext,
    validatedAt: RUN_AT,
  });
  const pipeline = runPipeline(input);
  expect(pipeline.derivation.status === 'blocked', `Expected blocked, got ${pipeline.derivation.status}.`);
});

runCase('Case 17: increase difficulty mutation is rejected', () => {
  const input = buildInput();
  const derivation = deriveAdaptiveTaskConstraints(input);
  expect(derivation.constraints, 'Expected base Constraints.');
  const mutated = { ...derivation.constraints, difficultyDirection: 'increase' as const };
  const alignment = validateStrategyConstraintAlignment({
    strategy: input.strategy,
    strategyValidationResult: input.strategyValidationResult,
    adaptiveTaskContext: input.adaptiveTaskContext,
    constraints: mutated,
    alignedAt: RUN_AT,
  });
  expect(alignment.status === 'strategy_mismatch', 'Expected strategy mismatch.');
});

runCase('Case 18: transfer without new context is rejected', () => {
  const input = buildInput({ action: 'transfer_test' });
  const derivation = deriveAdaptiveTaskConstraints(input);
  expect(derivation.constraints, 'Expected base Constraints.');
  const mutated = { ...derivation.constraints, materialNovelty: 'similar_context' as const };
  const alignment = validateStrategyConstraintAlignment({
    strategy: input.strategy,
    strategyValidationResult: input.strategyValidationResult,
    adaptiveTaskContext: input.adaptiveTaskContext,
    constraints: mutated,
    alignedAt: RUN_AT,
  });
  expect(!alignment.checks.materialAllowed, 'Material check should fail.');
});

runCase('Case 19: independent retest with guidance is rejected', () => {
  const input = buildInput({ action: 'independent_retest' });
  const derivation = deriveAdaptiveTaskConstraints(input);
  expect(derivation.constraints, 'Expected base Constraints.');
  const mutated = {
    ...derivation.constraints,
    hintPolicy: 'allow_guidance' as const,
    preExecutionQualityConditions: {
      ...derivation.constraints.preExecutionQualityConditions,
      requiredHintPolicy: 'allow_guidance' as const,
    },
  };
  const alignment = validateStrategyConstraintAlignment({
    strategy: input.strategy,
    strategyValidationResult: input.strategyValidationResult,
    adaptiveTaskContext: input.adaptiveTaskContext,
    constraints: mutated,
    alignedAt: RUN_AT,
  });
  expect(!alignment.checks.hintPolicyAllowed, 'Hint check should fail.');
});

runCase('Case 20: TaskRequest preserves formal Strategy fields', () => {
  const input = buildInput();
  const pipeline = runPipeline(input);
  requireSuccess(pipeline);
  expect(pipeline.taskRequest.strategyId === input.strategy.strategyId, 'strategyId changed.');
  expect(pipeline.taskRequest.taskRole === input.strategy.recommendedTaskRole, 'taskRole changed.');
  expect(pipeline.taskRequest.validationGoal === input.strategy.validationGoal, 'validationGoal changed.');
});

runCase('Case 21: Fulfillment consumes structured rules through Envelope', () => {
  const pipeline = runPipeline(buildInput({ action: 'independent_retest' }));
  requireSuccess(pipeline);
  expect(pipeline.fulfillment.request?.hardConstraints.some((item) => item.startsWith('hint_policy:eq:no_hint')), 'Structured hint rule missing.');
  expect(pipeline.fulfillment.request?.hardConstraints.some((item) => item.startsWith('adaptiveConstraintsId:')), 'Constraints trace missing.');
});

runCase('Case 22: resource that misses hard capabilities is not selected', () => {
  const pipeline = runPipeline(buildInput({ action: 'independent_retest' }));
  requireSuccess(pipeline);
  const match = matchTaskResources({
    fulfillmentRequest: pipeline.fulfillment.request,
    availableTaskResources: [{
      taskId: 'resource-without-capabilities',
      taskRole: 'retest',
      targetAbilityIds: [ABILITY_ID],
      difficulty: 'same',
      contentType: 'comparable_text',
      questionType: 'open_response',
      responseMode: 'written',
      capabilities: ['open_response'],
      validationTags: ['independent_retest'],
      source: 'mock',
      title: 'Insufficient resource',
      contentRef: 'mock://insufficient',
    }],
  });
  expect(match.status === 'no_match', `Expected no_match, got ${match.status}.`);
});

runCase('Case 23: repeated input keeps stable IDs', () => {
  const input = buildInput();
  const first = runPipeline(input);
  const second = runPipeline(input);
  requireSuccess(first);
  requireSuccess(second);
  expect(first.derivation.constraints.constraintsId === second.derivation.constraints.constraintsId, 'constraintsId changed.');
  expect(first.alignment.alignmentId === second.alignment.alignmentId, 'alignmentId changed.');
});

runCase('Case 24: input array order does not change Constraints', () => {
  const input = buildInput();
  const first = runPipeline(input);
  const reordered: AdaptiveTaskConstraintsInput = {
    ...input,
    qualityAssessments: [...input.qualityAssessments].reverse(),
    conflictAssessment: {
      ...input.conflictAssessment,
      currentQualityAssessmentIds: [...input.conflictAssessment.currentQualityAssessmentIds].reverse(),
      evidenceLinks: [...input.conflictAssessment.evidenceLinks].reverse(),
      observationUnits: [...input.conflictAssessment.observationUnits].reverse(),
    },
  };
  const second = runPipeline(reordered);
  requireSuccess(first);
  requireSuccess(second);
  expect(first.derivation.constraints.constraintsId === second.derivation.constraints.constraintsId, 'Order changed constraintsId.');
});

runCase('Case 25: human review does not create a normal task', () => {
  const pipeline = runPipeline(buildInput({ action: 'human_review', taskRole: 'observation' }));
  expect(pipeline.derivation.status === 'review_required', `Expected review_required, got ${pipeline.derivation.status}.`);
  expect(pipeline.taskRequest === null, 'Human review must not create TaskRequest.');
});

runCase('Case 26: Context conflict blocks without changing Strategy', () => {
  const input = buildInput({ action: 'transfer_test' });
  input.adaptiveTaskContext = {
    ...input.adaptiveTaskContext,
    allowedTaskRoles: input.adaptiveTaskContext.allowedTaskRoles.filter((role) => role !== 'transfer'),
  } as AdaptiveTaskContextSnapshot;
  const pipeline = runPipeline(input);
  expect(pipeline.derivation.status === 'regenerate_strategy', `Expected regenerate_strategy, got ${pipeline.derivation.status}.`);
  expect(input.strategy.recommendedTaskRole === 'transfer', 'Strategy role was mutated.');
  expect(pipeline.envelope === null, 'Context conflict must not create Envelope.');
});

printReport(results);

function buildContext(overrides: Partial<CurrentLearningContext> = {}): CurrentLearningContext {
  return {
    contextId: 'learning-context-phase14-3',
    studentId: STUDENT_ID,
    currentPhase: 'training',
    targetAbilityId: ABILITY_ID,
    allowTraining: true,
    allowRetest: true,
    allowTransfer: true,
    cognitiveLoad: 'medium',
    reviewRequired: false,
    notes: [],
    ...overrides,
  };
}

function buildStrategy(action: NextLearningAction, taskRole: RecommendedTaskRole): NextLearningStrategy {
  return {
    strategyId: `strategy-${action}-${taskRole}`,
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    action,
    reason: 'Formal GrowthMemory requires the next controlled observation.',
    evidenceLinks: ['evidence-1', 'evidence-2'],
    growthMemoryRecordIds: ['growth-memory-1'],
    validationGoal: `验证${ABILITY_ID}能力在受控条件下的表现。`,
    recommendedTaskRole: taskRole,
    limitations: [],
    strategySource: 'growth_memory',
    createdAt: RUN_AT,
  };
}

function buildQualityAssessment(
  evidenceId: string,
  evidenceType: EvidenceQualityAssessment['evidenceType'],
  hintDependency: EvidenceQualityAssessment['facts']['hintDependency'],
): EvidenceQualityAssessment {
  const index = evidenceId.split('-').at(-1) || '1';
  return {
    assessmentId: `qa-${evidenceId}`,
    evidenceId,
    studentId: STUDENT_ID,
    abilityId: ABILITY_ID,
    observationUnitId: `unit-${index}`,
    contextFingerprint: `context-fingerprint-${index}`,
    policyVersion: EVIDENCE_QUALITY_POLICY_VERSION,
    evidenceType,
    qualityLevel: evidenceType === 'insufficient' ? 'insufficient' : 'high',
    evaluationEligibility: evidenceType === 'insufficient' ? 'blocked' : 'eligible',
    facts: {
      responseValid: evidenceType !== 'insufficient',
      taskAbilityAligned: true,
      diagnosisAligned: true,
      traceabilityComplete: true,
      independentPerformance: hintDependency === 'none',
      usedHint: hintDependency !== 'none',
      hintCount: hintDependency === 'none' ? 0 : 2,
      hintDependency,
      taskNovelty: 'similar',
      timingType: 'delayed',
      taskRole: 'retest',
      difficultyRelation: 'comparable',
      diagnosisReliable: true,
    },
    qualityReasons: ['Formal quality facts are available.'],
    limitations: hintDependency === 'none' ? [] : ['Performance used hints.'],
    sourceLinks: {
      taskId: `task-${index}`,
      executionSessionId: `execution-${index}`,
      responseId: `response-${index}`,
      diagnosisResultId: `diagnosis-${index}`,
      taskEvidenceReturnId: `return-${index}`,
    },
    schemaVersion: EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION,
    assessedAt: RUN_AT,
    validation: { passed: true, issues: [] },
  };
}

function buildConflictAssessment(
  status: EvidenceConflictStatus,
  assessments: EvidenceQualityAssessment[],
): EvidenceConflictAssessment {
  const positiveCount = assessments.filter((item) => ['positive', 'growth'].includes(item.evidenceType)).length;
  const weaknessCount = assessments.filter((item) => item.evidenceType === 'weakness').length;
  const insufficientCount = assessments.filter((item) => item.evidenceType === 'insufficient').length;
  return {
    conflictAssessmentId: `conflict-${status}`,
    studentId: STUDENT_ID,
    abilityId: ABILITY_ID,
    status,
    recommendation: recommendationForStatus(status),
    observationUnits: assessments.map((item, index) => ({
      observationUnitId: item.observationUnitId,
      studentId: STUDENT_ID,
      abilityId: ABILITY_ID,
      direction: item.evidenceType === 'weakness'
        ? 'weakness_signal'
        : item.evidenceType === 'insufficient'
          ? 'insufficient_signal'
          : 'positive_signal',
      evidenceIds: [item.evidenceId],
      qualityAssessmentIds: [item.assessmentId],
      effectiveQualityLevel: item.qualityLevel,
      effectiveEligibility: item.evaluationEligibility,
      taskIds: [item.sourceLinks.taskId],
      responseIds: [item.sourceLinks.responseId],
      taskRoles: [item.facts.taskRole],
      comparisonContextIds: [`comparison-${index + 1}`],
      comparisonClusterId: `cluster-${index + 1}`,
      limitations: item.limitations,
    })),
    observationUnitCount: assessments.length,
    comparableObservationUnitCount: assessments.filter((item) => item.evaluationEligibility === 'eligible').length,
    independentContextCount: assessments.filter((item) => item.evaluationEligibility === 'eligible').length,
    directionSummary: {
      positiveUnitCount: positiveCount,
      weaknessUnitCount: weaknessCount,
      mixedUnitCount: 0,
      insufficientUnitCount: insufficientCount,
    },
    eligibleEvidenceIds: assessments.filter((item) => item.evaluationEligibility === 'eligible').map((item) => item.evidenceId),
    limitedEvidenceIds: [],
    blockedEvidenceIds: assessments.filter((item) => item.evaluationEligibility === 'blocked').map((item) => item.evidenceId),
    reviewRequiredEvidenceIds: [],
    currentQualityAssessmentIds: assessments.map((item) => item.assessmentId),
    supersededQualityAssessmentIds: [],
    comparisonFacts: ['Formal Evidence comparison facts are available.'],
    differenceFactors: [],
    conflictFactors: status === 'unresolved_conflict' ? ['Opposite directions remain comparable.'] : [],
    limitations: [],
    evidenceLinks: assessments.map((item) => item.evidenceId),
    schemaVersion: EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION,
    policyVersion: EVIDENCE_CONFLICT_POLICY_VERSION,
    coordinatedAt: RUN_AT,
    validation: { passed: true, issues: [] },
  };
}

function differenceFactor(
  factor: 'hint' | 'difficulty' | 'material' | 'timing' | 'task_role' | 'independence',
  explanatoryStrength: 'strong' | 'plausible' | 'insufficient',
) {
  return {
    factor,
    observedDifference: true,
    explanatoryStrength,
    relatedObservationUnitIds: ['unit-1', 'unit-2'],
    reason: `${factor} conditions differ.`,
  } as const;
}

function inferConflictStatus(types: string[]): EvidenceConflictStatus {
  if (types.every((type) => ['positive', 'growth'].includes(type))) return 'aligned_positive_evidence';
  if (types.every((type) => type === 'weakness')) return 'aligned_weakness_evidence';
  if (types.every((type) => type === 'insufficient')) return 'insufficient_comparable_evidence';
  return 'unresolved_conflict';
}

function recommendationForStatus(status: EvidenceConflictStatus): EvidenceConflictAssessment['recommendation'] {
  if (status === 'aligned_positive_evidence' || status === 'aligned_weakness_evidence') return 'proceed_to_evaluation';
  if (status === 'explainable_mixed_evidence') return 'proceed_with_limitations';
  if (status === 'unresolved_conflict') return 'request_discriminating_observation';
  if (status === 'insufficient_comparable_evidence') return 'collect_more_evidence';
  return 'human_review';
}

function roleForAction(action: NextLearningAction): RecommendedTaskRole {
  const roles: Record<NextLearningAction, RecommendedTaskRole> = {
    continue_training: 'training',
    lower_difficulty_training: 'training',
    independent_retest: 'retest',
    transfer_test: 'transfer',
    diagnostic_verification: 'diagnosis',
    collect_more_evidence: 'observation',
    maintenance_validation: 'retest',
    switch_ability: 'training',
    human_review: 'observation',
  };
  return roles[action];
}

function printReport(caseResults: DebugCaseResult[]): void {
  console.log('\nPhase 14.3 Adaptive Task Constraints Debug Report');
  console.log('=================================================');
  for (const result of caseResults) {
    console.log(`${result.passed ? '[PASS]' : '[FAIL]'} ${result.name}${result.passed ? '' : `: ${result.detail}`}`);
  }
  const passed = caseResults.filter((result) => result.passed).length;
  console.log('\nAcceptance');
  console.log('----------');
  console.log(`Cases: ${passed} / ${caseResults.length} PASS`);
  if (passed !== caseResults.length || caseResults.length < 26) {
    throw new Error('Phase 14.3 adaptive task constraints debug failed.');
  }
  console.log('[PASS] Constraints, alignment, Envelope, Fulfillment mapping, blocking, and stable IDs passed.');
}
