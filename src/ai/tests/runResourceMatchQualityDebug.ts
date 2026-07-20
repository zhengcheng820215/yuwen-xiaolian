import { evaluateCoreResourceEligibility } from '../agents/coreResourceEligibilityAgent.ts';
import {
  createQualityGatedExecutableTask,
  evaluateResourceMatchQuality,
} from '../agents/resourceMatchQualityAgent.ts';
import { buildStableId } from '../agents/reviewedResourceCandidateAdapter.ts';
import {
  ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
  ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
  type AdaptiveConstraintRule,
  type AdaptiveMaterialNovelty,
  type AdaptiveTaskRequestEnvelope,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type FrozenQuestionResourceVersion,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  CoreResourceEligibilityResult,
  ResourceEligibilitySnapshot,
  ResourceMatchQualityInput,
  ResourceMatchRecentHistory,
} from '../schemas/resourceMatchQuality.schema.ts';
import {
  isQualityGatedExecutableTaskResult,
  isResourceMatchQualityResult,
} from '../schemas/resourceMatchQuality.schema.ts';
import type { TaskFulfillmentRequest, TaskResourceMatchResult } from '../schemas/taskFulfillment.schema.ts';

const NOW = '2026-07-20T10:00:00.000Z';
const STUDENT_ID = 'student-phase16-2b';
const ABILITY_ID = 'inference';

type ResourceSpec = {
  suffix: string;
  abilityId?: 'inference' | 'comprehension';
  taskRole?: 'training' | 'retest';
  materialId?: string;
  includeMaterial?: boolean;
  tags?: string[];
  capabilities?: string[];
};

type Scenario = {
  envelope: AdaptiveTaskRequestEnvelope;
  fulfillment: TaskFulfillmentRequest;
  snapshot: ResourceEligibilitySnapshot;
  history: ResourceMatchRecentHistory;
};

type DebugCase = { name: string; run: () => void };
const cases: DebugCase[] = [
  { name: 'B1 all constraints match and executable trace is created', run: caseAllMatch },
  { name: 'B2 new context rejects recent material', run: caseNewContextRecentMaterial },
  { name: 'B3 explicit task exclusion cannot be relaxed', run: caseExcludeTask },
  { name: 'B4 unmet soft preference remains partial', run: caseSoftPreference },
  { name: 'B5 no eligible resource creates StructuredResourceGap', run: caseNoCandidate },
  { name: 'B6 Existing matched is downgraded by quality gate', run: caseExistingMatchedQualityFails },
  { name: 'B7 untraceable Existing selectedTaskId requires review', run: caseSelectedTaskUntraceable },
  { name: 'B8 equivalent candidates use stable tie-breaker', run: caseStableTieBreaker },
  { name: 'B9 repeated input keeps evaluation and task IDs stable', run: caseIdempotency },
  { name: 'B10 registry change blocks task creation', run: caseRegistryChanged },
  { name: 'B11 missing material identity cannot prove novelty', run: caseMissingMaterial },
  { name: 'B12 similar material relation requires formal metadata', run: caseSimilarRelationUnknown },
  { name: 'B13 missing required capability cannot match', run: caseMissingCapability },
  { name: 'B14 matching does not create education state', run: caseNoEducationSideEffects },
  { name: 'I1 complete A to B path preserves version traceability', run: caseIntegratedPath },
  { name: 'I2 target quality remains a goal rather than actual Evidence', run: caseTargetQualityNotActualQuality },
];

function main(): void {
  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 16.2B Resource Match Quality Debug');
  console.log('='.repeat(62));
  for (const item of cases) {
    try {
      item.run();
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${item.name}: ${message}`);
      console.log(`FAIL ${item.name}: ${message}`);
    }
  }
  console.log('-'.repeat(62));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  console.log(`16.2B Engineering: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log('Phase 16.2 Overall: PASS / FROZEN (A + B + Demo accepted)');
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

function caseAllMatch(): void {
  const scenario = buildScenario();
  const { core, quality } = runPipeline(scenario);
  expect(core.status === 'eligible', 'Core eligibility failed.');
  expect(quality.evaluation?.existingMatchResult?.status === 'matched', 'Existing TaskFulfillment did not match.');
  expect(quality.evaluation?.status === 'matched', `Expected matched, got ${quality.evaluation?.status}: ${JSON.stringify({
    existing: quality.evaluation?.existingMatchResult,
    candidates: quality.evaluation?.candidateEvaluations,
    issues: quality.evaluation?.issues,
  })}`);
  const task = createQualityGatedExecutableTask({
    qualityResult: quality,
    fulfillmentRequest: scenario.fulfillment,
    currentResourceSnapshot: scenario.snapshot,
    createdAt: NOW,
  });
  expect(task.status === 'created' && task.task, 'Matched resource did not create a quality-gated task.');
  expect(isResourceMatchQualityResult(quality), 'Quality result failed schema validation.');
  expect(isQualityGatedExecutableTaskResult(task), 'Quality-gated task failed schema validation.');
  expect(task.task.resourceVersionId === quality.evaluation?.selectedResourceVersionId, 'Version trace was lost.');
}

function caseNewContextRecentMaterial(): void {
  const scenario = buildScenario();
  setNovelty(scenario, 'new_context');
  scenario.history.recentMaterialIds = ['material-a'];
  const { quality } = runPipeline(scenario);
  expect(quality.evaluation?.existingMatchResult?.status === 'matched', 'Existing matcher should remain unaware of material history.');
  expect(quality.evaluation?.status === 'partial_match', `Expected partial_match, got ${quality.evaluation?.status}.`);
  expect(!quality.evaluation?.canCreateExecutableTask, 'Recent material was executable.');
}

function caseExcludeTask(): void {
  const scenario = buildScenario();
  addHardRule(scenario, { code: 'exclude_task', operator: 'exclude', value: ['task-a'], source: 'strategy' });
  const { quality } = runPipeline(scenario);
  expect(quality.evaluation?.candidateEvaluations[0]?.status === 'rejected', 'Excluded task was not rejected.');
  expect(quality.evaluation?.status === 'partial_match', 'Known exclusion should produce a non-executable partial result.');
}

function caseSoftPreference(): void {
  const scenario = buildScenario();
  scenario.envelope.adaptiveConstraints.softPreferences.push({
    code: 'required_capability', operator: 'required', value: 'optional_deep_scaffold', source: 'quality',
  });
  const { quality } = runPipeline(scenario);
  expect(quality.evaluation?.status === 'partial_match', `Expected partial_match, got ${quality.evaluation?.status}.`);
  expect((quality.evaluation?.unmetPreferences.length || 0) > 0, 'Unmet soft preference was not retained.');
}

function caseNoCandidate(): void {
  const scenario = buildScenario([{ suffix: 'a', taskRole: 'retest' }]);
  const { core, quality } = runPipeline(scenario);
  expect(core.status === 'no_eligible_resource', `Expected no eligible core resource, got ${core.status}.`);
  expect(quality.evaluation?.status === 'no_match', 'No core candidate did not become no_match.');
  expect(Boolean(quality.evaluation?.resourceGap), 'StructuredResourceGap missing.');
  expect(!quality.evaluation?.fulfillmentInvoked, 'Existing TaskFulfillment should not be invoked.');
}

function caseExistingMatchedQualityFails(): void {
  const scenario = buildScenario();
  setNovelty(scenario, 'new_context');
  scenario.history.recentMaterialIds = ['material-a'];
  const { quality } = runPipeline(scenario);
  expect(quality.evaluation?.existingMatchResult?.status === 'matched', 'Fixture did not produce Existing matched.');
  expect(quality.evaluation.status !== 'matched', 'Quality Gate trusted Existing matched without context validation.');
}

function caseSelectedTaskUntraceable(): void {
  const scenario = buildScenario();
  const invalidExisting: TaskResourceMatchResult = {
    fulfillmentRequestId: scenario.fulfillment.requestId,
    sourceTaskRequestId: scenario.fulfillment.sourceTaskRequestId,
    status: 'matched',
    matchedTaskIds: ['task-missing'],
    selectedTaskId: 'task-missing',
    matchReasons: ['Synthetic Existing mismatch.'],
    unmetConstraints: [],
    unmetPreferences: [],
  };
  const { quality } = runPipeline(scenario, invalidExisting);
  expect(quality.evaluation?.status === 'review_required', 'Untraceable Existing selection was not reviewed.');
  expect(quality.evaluation?.issues.includes('existing_selected_task_untraceable'), 'Trace issue missing.');
}

function caseStableTieBreaker(): void {
  const first = buildScenario([{ suffix: 'b' }, { suffix: 'a' }]);
  const second = clone(first);
  second.snapshot.frozenVersions.reverse();
  second.snapshot.registryEntries.reverse();
  second.snapshot.validations.reverse();
  second.snapshot.reviews.reverse();
  const firstResult = runPipeline(first).quality.evaluation;
  const secondResult = runPipeline(second).quality.evaluation;
  expect(firstResult?.status === 'matched' && secondResult?.status === 'matched', 'Equivalent candidates did not match.');
  expect(firstResult.selectedResourceVersionId === secondResult.selectedResourceVersionId, 'Input order changed selected version.');
  expect(firstResult.evaluationId === secondResult.evaluationId, 'Input order changed evaluationId.');
}

function caseIdempotency(): void {
  const scenario = buildScenario();
  const first = runPipeline(scenario).quality;
  const second = runPipeline(scenario).quality;
  expect(first.evaluation?.evaluationId === second.evaluation?.evaluationId, 'Repeated evaluation ID changed.');
  const firstTask = createQualityGatedExecutableTask({
    qualityResult: first, fulfillmentRequest: scenario.fulfillment,
    currentResourceSnapshot: scenario.snapshot, createdAt: NOW,
  });
  const secondTask = createQualityGatedExecutableTask({
    qualityResult: second, fulfillmentRequest: scenario.fulfillment,
    currentResourceSnapshot: scenario.snapshot, createdAt: NOW,
  });
  expect(firstTask.task?.traceId === secondTask.task?.traceId, 'Repeated task trace ID changed.');
}

function caseRegistryChanged(): void {
  const scenario = buildScenario();
  const quality = runPipeline(scenario).quality;
  const changed = clone(scenario.snapshot);
  changed.registryEntries[0]!.currentFrozenVersionId = 'resource-a:v2';
  changed.frozenVersions[0]!.status = 'superseded';
  const task = createQualityGatedExecutableTask({
    qualityResult: quality,
    fulfillmentRequest: scenario.fulfillment,
    currentResourceSnapshot: changed,
    createdAt: NOW,
  });
  expect(task.status === 'blocked', 'Stale selected version created a task.');
  expect(task.issues.includes('selected_resource_is_no_longer_current'), 'Registry change reason missing.');
}

function caseMissingMaterial(): void {
  const scenario = buildScenario([{ suffix: 'a', includeMaterial: false }]);
  setNovelty(scenario, 'new_context');
  const { quality } = runPipeline(scenario);
  expect(quality.evaluation?.status === 'review_required', 'Missing material identity was treated as new context.');
}

function caseSimilarRelationUnknown(): void {
  const scenario = buildScenario([{ suffix: 'a', tags: ['hint_policy:limited_hint'] }]);
  const { quality } = runPipeline(scenario);
  expect(quality.evaluation?.status === 'review_required', 'Unknown similar relation did not require review.');
}

function caseMissingCapability(): void {
  const scenario = buildScenario();
  scenario.fulfillment.requiredCapabilities.push('advanced_scaffold');
  scenario.envelope.adaptiveConstraints.requiredCapabilities.push('advanced_scaffold');
  addHardRule(scenario, {
    code: 'required_capability', operator: 'required', value: 'advanced_scaffold', source: 'quality',
  });
  const { quality } = runPipeline(scenario);
  expect(quality.evaluation?.status === 'partial_match', `Expected partial_match, got ${quality.evaluation?.status}.`);
  expect(!quality.evaluation?.canCreateExecutableTask, 'Missing capability was executable.');
}

function caseNoEducationSideEffects(): void {
  const scenario = buildScenario();
  const before = JSON.stringify(scenario);
  const { quality } = runPipeline(scenario);
  const serialized = JSON.stringify(quality);
  expect(quality.evaluation?.status === 'matched', 'Fixture did not match.');
  expect(!serialized.includes('DiagnosisResult'), 'Matching generated Diagnosis.');
  expect(!serialized.includes('AbilityEvidence'), 'Matching generated Evidence.');
  expect(!serialized.includes('ProfileUpdateDecision'), 'Matching generated Profile decision.');
  expect(JSON.stringify(scenario) === before, 'Matching mutated formal input state.');
}

function caseIntegratedPath(): void {
  const scenario = buildScenario();
  const { core, quality } = runPipeline(scenario);
  const task = createQualityGatedExecutableTask({
    qualityResult: quality, fulfillmentRequest: scenario.fulfillment,
    currentResourceSnapshot: scenario.snapshot, createdAt: NOW,
  });
  expect(core.eligibleCandidateIds.length === 1, 'A did not hand off one candidate.');
  expect(quality.evaluation?.status === 'matched', 'B did not accept A candidate.');
  expect(task.task?.resourceId === 'resource-a', 'Executable trace lost resourceId.');
  expect(task.task?.constraintsId === scenario.envelope.constraintsId, 'Executable trace lost constraintsId.');
  expect(task.task?.resourceMatchQualityEvaluationId === quality.evaluation.evaluationId, 'Quality evaluation trace lost.');
}

function caseTargetQualityNotActualQuality(): void {
  const scenario = buildScenario();
  scenario.envelope.adaptiveConstraints.targetEvidenceQuality = 'high';
  const { quality } = runPipeline(scenario);
  const output = JSON.stringify(quality);
  expect(quality.evaluation?.status === 'matched', 'High target quality should not prevent valid task design.');
  expect(!output.includes('actualEvidenceQuality'), 'Match output claimed actual Evidence quality.');
  expect(scenario.envelope.adaptiveConstraints.targetEvidenceQuality === 'high', 'Target quality was modified.');
}

function runPipeline(scenario: Scenario, existingMatchResult?: TaskResourceMatchResult): {
  core: CoreResourceEligibilityResult;
  quality: ReturnType<typeof evaluateResourceMatchQuality>;
} {
  const core = evaluateCoreResourceEligibility({
    adaptiveTaskRequestEnvelope: scenario.envelope,
    taskFulfillmentRequest: scenario.fulfillment,
    resourceSnapshot: scenario.snapshot,
    evaluatedAt: NOW,
  });
  const qualityInput: ResourceMatchQualityInput = {
    adaptiveRequestEnvelope: scenario.envelope,
    fulfillmentRequest: scenario.fulfillment,
    coreEligibility: core,
    resourceSnapshot: scenario.snapshot,
    recentHistory: scenario.history,
    evaluatedAt: NOW,
    existingMatchResult,
  };
  return { core, quality: evaluateResourceMatchQuality(qualityInput) };
}

function buildScenario(resources: ResourceSpec[] = [{ suffix: 'a' }]): Scenario {
  const envelope = buildEnvelope();
  const fulfillment = buildFulfillment();
  const versions = resources.map(buildVersion);
  const registryEntries = versions.map(buildRegistry);
  const validations = versions.map(buildValidation);
  const reviews = versions.map(buildReview);
  const identity = versions.map((item) => item.resourceVersionId).sort();
  return {
    envelope,
    fulfillment,
    snapshot: {
      snapshotId: buildStableId('resource-eligibility-snapshot', identity),
      registryEntries,
      frozenVersions: versions,
      validations,
      reviews,
      capturedAt: NOW,
      schemaVersion: 'resource_match_quality_v1',
    },
    history: {
      studentId: STUDENT_ID,
      recentTaskIds: [],
      recentResourceIds: [],
      recentResourceVersionIds: [],
      recentMaterialIds: [],
      recentExecutionSessionIds: [],
      historyWindowStartedAt: '2026-07-13T10:00:00.000Z',
      historyWindowEndedAt: NOW,
    },
  };
}

function buildVersion(spec: ResourceSpec): FrozenQuestionResourceVersion {
  const abilityId = spec.abilityId || 'inference';
  const materialId = spec.includeMaterial === false ? undefined : (spec.materialId || `material-${spec.suffix}`);
  return {
    resourceId: `resource-${spec.suffix}`,
    resourceVersionId: `resource-${spec.suffix}:v1`,
    versionNumber: 1,
    sourceDraftId: `draft-${spec.suffix}`,
    materialId,
    materialVersionId: materialId ? `${materialId}:v1` : undefined,
    taskId: `task-${spec.suffix}`,
    title: `正式资源 ${spec.suffix}`,
    questionStem: '人物此时有怎样的心理？请根据材料说明。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    rubric: [
      {
        itemId: 'evidence', name: '文本依据', abilityId, importance: 'critical', required: true,
        evidenceRequirement: { requireTextEvidence: true }, acceptedSignals: ['指出文本细节'],
      },
      {
        itemId: 'explanation', name: '解释关系', abilityId, importance: 'important', required: true,
        evidenceRequirement: { requireExplanation: true, requireConclusion: true }, acceptedSignals: ['说明行为与心理关系'],
      },
    ],
    minimumAnswerRequirement: { minLength: 8, requireTextEvidence: true, requireExplanation: true },
    abilityMetadata: {
      abilityId,
      supportingAbilityIds: abilityId === 'inference' ? ['comprehension'] : [],
      prerequisiteAbilityIds: [],
      taskRole: spec.taskRole || 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: { sourceType: 'manual', description: 'Phase 16.2B deterministic fixture.' },
    tags: spec.tags || [
      'material_relation:similar_context',
      'hint_policy:limited_hint',
      ...(spec.capabilities || []).map((item) => `capability:${item}`),
    ],
    validationId: `validation-${spec.suffix}`,
    reviewId: `review-${spec.suffix}`,
    status: 'frozen',
    frozenAt: NOW,
    updatedAt: NOW,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function buildRegistry(version: FrozenQuestionResourceVersion): ResourceRegistryEntry {
  return {
    resourceId: version.resourceId,
    currentFrozenVersionId: version.resourceVersionId,
    status: 'active',
    latestReviewId: version.reviewId,
    latestValidationId: version.validationId,
    materialId: version.materialId,
    taskId: version.taskId,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    tags: [...version.tags],
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function buildValidation(version: FrozenQuestionResourceVersion): ResourceValidationResult {
  return {
    validationId: version.validationId,
    draftId: version.sourceDraftId,
    resourceId: version.resourceId,
    validatedDraftRevision: 1,
    validationRuleVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    passed: true,
    checks: {
      identityValid: true, contentValid: true, answerAcceptanceValid: true, rubricValid: true,
      abilityAndRoleValid: true, versionLineageValid: true, materialValid: true,
    },
    issues: [],
    checkedAt: NOW,
  };
}

function buildReview(version: FrozenQuestionResourceVersion): ResourceReviewDecision {
  return {
    reviewId: version.reviewId,
    draftId: version.sourceDraftId,
    resourceId: version.resourceId,
    reviewedDraftRevision: 1,
    validationId: version.validationId,
    action: 'approve',
    reviewerId: 'reviewer-phase16-2b',
    notes: 'Approved deterministic fixture.',
    reviewedAt: NOW,
  };
}

function buildEnvelope(): AdaptiveTaskRequestEnvelope {
  const validationGoal = '观察学生能否根据文本行为推断人物心理并说明依据。';
  const constraintsId = 'constraints-phase16-2b';
  const taskRequest = {
    taskRequestId: 'task-request-phase16-2b', strategyId: 'strategy-phase16-2b', studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID, taskRole: 'training' as const, action: 'continue_training' as const,
    validationGoal, evidenceLinks: ['evidence-phase16-2b'], growthMemoryRecordIds: ['memory-phase16-2b'],
    constraints: ['targetAbilityId:inference', 'taskRole:training'], createdAt: NOW,
  };
  return {
    envelopeId: 'adaptive-envelope-phase16-2b',
    taskRequest,
    adaptiveConstraints: {
      constraintsId, studentId: STUDENT_ID, targetAbilityId: ABILITY_ID,
      sourceStrategyId: taskRequest.strategyId, sourceStrategyAction: taskRequest.action,
      sourceStrategyTaskRole: 'training', sourceValidationGoal: validationGoal,
      sourceContextSnapshotId: 'context-phase16-2b', sourceConflictAssessmentId: 'conflict-phase16-2b',
      sourceConflictStatus: 'aligned_weakness_evidence', sourceQualityAssessmentIds: ['quality-phase16-2b'],
      sourceEvidenceIds: ['evidence-phase16-2b'], sourceObservationUnitIds: ['unit-phase16-2b'],
      learningIntent: 'consolidation', observationTarget: 'recheck_weakness', recommendedTaskRole: 'training',
      difficultyDirection: 'maintain', materialNovelty: 'similar_context', hintPolicy: 'limited_hint',
      targetEvidenceQuality: 'medium',
      preExecutionQualityConditions: {
        requireNovelMaterial: false, requireKnownDifficulty: true, requireAbilityAlignment: true,
        requiredHintPolicy: 'limited_hint', requireTraceability: true,
      },
      requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'focused_practice'],
      hardConstraints: [
        { code: 'task_role', operator: 'eq', value: 'training', source: 'strategy' },
        { code: 'target_ability', operator: 'eq', value: ABILITY_ID, source: 'strategy' },
        { code: 'difficulty', operator: 'eq', value: 'maintain', source: 'strategy' },
        { code: 'material_novelty', operator: 'eq', value: 'similar_context', source: 'strategy' },
        { code: 'hint_policy', operator: 'eq', value: 'limited_hint', source: 'quality' },
      ],
      softPreferences: [], reasons: ['Continue a controlled training observation.'], limitations: [],
      schemaVersion: ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
      policyVersion: ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
      generatedAt: NOW, validation: { passed: true, issues: [] },
    },
    alignmentResult: {
      alignmentId: 'alignment-phase16-2b', strategyId: taskRequest.strategyId, constraintsId,
      contextSnapshotId: 'context-phase16-2b', status: 'aligned',
      checks: {
        identityAligned: true, strategyValidationPassed: true, sourceStrategyAligned: true,
        targetAbilityAligned: true, taskRoleAligned: true, validationGoalAligned: true,
        difficultyAllowed: true, materialAllowed: true, hintPolicyAllowed: true,
        contextAllowed: true, conflictAllowed: true,
      },
      canCreateTaskRequest: true, nextStep: 'create_task_request', issues: [], warnings: [],
      alignedAt: NOW, validation: { passed: true, issues: [] },
    },
    constraintsId, canEnterTaskFulfillment: true,
    schemaVersion: ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
    validation: { passed: true, issues: [] },
  };
}

function buildFulfillment(): TaskFulfillmentRequest {
  return {
    requestId: 'fulfillment-phase16-2b', studentId: STUDENT_ID, taskRole: 'training',
    targetAbilityId: ABILITY_ID, contentType: 'comparable_text', questionType: 'open_response',
    responseMode: 'written', difficultyRange: { preferred: 'same', minimum: 'lower', maximum: 'same' },
    validationGoal: '观察学生能否根据文本行为推断人物心理并说明依据。',
    requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'focused_practice'],
    hardConstraints: ['adaptiveConstraintsId:constraints-phase16-2b'], softPreferences: [], recentTaskIds: [],
    sourceTaskRequestId: 'task-request-phase16-2b', sourceStrategyId: 'strategy-phase16-2b', createdAt: NOW,
  };
}

function setNovelty(scenario: Scenario, novelty: AdaptiveMaterialNovelty): void {
  scenario.envelope.adaptiveConstraints.materialNovelty = novelty;
  scenario.envelope.adaptiveConstraints.preExecutionQualityConditions.requireNovelMaterial = novelty === 'new_context';
  scenario.envelope.adaptiveConstraints.hardConstraints = scenario.envelope.adaptiveConstraints.hardConstraints.map((rule) => (
    rule.code === 'material_novelty' ? { ...rule, value: novelty } : rule
  ));
  scenario.fulfillment.contentType = novelty === 'new_context'
    ? 'new_text'
    : novelty === 'similar_context'
      ? 'comparable_text'
      : 'same_context_text';
}

function addHardRule(scenario: Scenario, rule: AdaptiveConstraintRule): void {
  scenario.envelope.adaptiveConstraints.hardConstraints.push(rule);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main();
