import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import { evaluateCoreResourceEligibility } from '../agents/coreResourceEligibilityAgent.ts';
import { loadResourceEligibilitySnapshot } from '../agents/reviewedResourceCandidateAdapter.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
  ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
  type AdaptiveTaskRequestEnvelope,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  type FrozenQuestionResourceVersion,
  type PrimaryAbilityId,
  type QuestionResourceRubricItem,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  isCoreResourceEligibilityResult,
  type CoreResourceEligibilityInput,
  type ResourceEligibilitySnapshot,
} from '../schemas/resourceMatchQuality.schema.ts';
import type { TaskFulfillmentRequest } from '../schemas/taskFulfillment.schema.ts';

const NOW = '2026-07-20T09:00:00.000Z';
const STUDENT_ID = 'student-phase16-2a';
const ABILITY_ID = 'inference';
const ROLE = 'training' as const;

type Repository = InMemoryQuestionResourceAdmissionRepository;
type Fixture = {
  repository: Repository;
  snapshot: ResourceEligibilitySnapshot;
  envelope: AdaptiveTaskRequestEnvelope;
  fulfillmentRequest: TaskFulfillmentRequest;
  version?: FrozenQuestionResourceVersion;
};

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'A1 valid current frozen resource is eligible', run: caseValidCurrentFrozen },
  { name: 'A2 mismatched task role is rejected', run: caseTaskRoleMismatch },
  { name: 'A3 supporting ability does not qualify as primary', run: caseSupportingAbilityOnly },
  { name: 'A4 disallowed difficulty is rejected', run: caseDifficultyMismatch },
  { name: 'A5 non-observable rubric is rejected', run: caseRubricNotObservable },
  { name: 'A6 draft is isolated from formal candidates', run: caseDraftIsolation },
  { name: 'A7 superseded version is isolated', run: caseSupersededVersion },
  { name: 'A8 retired resource is isolated', run: caseRetiredResource },
  { name: 'A9 missing registry head requires review', run: caseMissingRegistryVersion },
  { name: 'A10 multiple current frozen versions require review', run: caseMultipleFrozenHeads },
  { name: 'A11 review or validation identity mismatch requires review', run: caseTraceabilityMismatch },
  { name: 'A12 adaptive envelope identity mismatch is blocked', run: caseEnvelopeMismatch },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log('Phase 16.2A Core Resource Eligibility Debug');
  console.log('='.repeat(62));

  for (const item of cases) {
    try {
      await item.run();
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
  console.log(`Checkpoint: ${failures.length === 0 ? 'PASS / NOT FROZEN' : 'FAIL'}`);
  console.log('Phase 16.2 Overall: PASS / FROZEN (recorded after unified A + B + Demo acceptance)');

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseValidCurrentFrozen(): Promise<void> {
  const fixture = await buildFixture();
  const first = run(fixture);
  const second = run(fixture);
  expect(first.status === 'eligible', `Expected eligible, got ${first.status}.`);
  expect(first.canEnterExistingTaskFulfillment, 'Eligible pool did not enter Existing TaskFulfillment.');
  expect(first.eligibleResources.length === 1, 'Expected one eligible AvailableTaskResource view.');
  expect(first.eligibleResources[0]?.targetAbilityIds.join(',') === ABILITY_ID, 'Supporting ability leaked into target ability view.');
  expect(first.eligibilityResultId === second.eligibilityResultId, 'Repeated input changed eligibilityResultId.');
  expect(isCoreResourceEligibilityResult(first), 'Result failed schema validation.');
}

async function caseTaskRoleMismatch(): Promise<void> {
  const fixture = await buildFixture({ taskRole: 'retest' });
  const result = run(fixture);
  expect(result.status === 'no_eligible_resource', `Expected no_eligible_resource, got ${result.status}.`);
  expect(result.candidateEvaluations[0]?.issues.includes('candidate.task_role_mismatch'), 'Task role mismatch not reported.');
  expect(!result.canEnterExistingTaskFulfillment, 'Rejected role entered TaskFulfillment.');
}

async function caseSupportingAbilityOnly(): Promise<void> {
  const fixture = await buildFixture({
    primaryAbilityId: 'comprehension',
    supportingAbilityIds: ['inference'],
  });
  const result = run(fixture);
  expect(result.status === 'no_eligible_resource', `Expected no_eligible_resource, got ${result.status}.`);
  expect(result.candidateEvaluations[0]?.issues.includes('candidate.primary_ability_mismatch'), 'Primary ability mismatch not reported.');
}

async function caseDifficultyMismatch(): Promise<void> {
  const fixture = await buildFixture({ difficulty: 'advanced' });
  const result = run(fixture);
  expect(result.status === 'no_eligible_resource', `Expected no_eligible_resource, got ${result.status}.`);
  expect(result.candidateEvaluations[0]?.issues.includes('candidate.difficulty_not_allowed'), 'Difficulty mismatch not reported.');
}

async function caseRubricNotObservable(): Promise<void> {
  const fixture = await buildFixture();
  fixture.snapshot.frozenVersions[0] = {
    ...fixture.snapshot.frozenVersions[0],
    rubric: fixture.snapshot.frozenVersions[0]!.rubric.map((item) => ({
      ...item,
      required: false,
      importance: 'supporting' as const,
      acceptedSignals: [],
    })),
  };
  const result = run(fixture);
  expect(result.status === 'no_eligible_resource', `Expected no_eligible_resource, got ${result.status}.`);
  expect(result.candidateEvaluations[0]?.issues.includes('candidate.rubric_not_observable'), 'Rubric gate did not fail.');
}

async function caseDraftIsolation(): Promise<void> {
  const fixture = await buildFixture({ freeze: false });
  expect((await fixture.repository.listDrafts()).length === 1, 'Draft fixture missing.');
  expect(fixture.snapshot.frozenVersions.length === 0, 'Draft entered frozen snapshot.');
  const result = run(fixture);
  expect(result.status === 'no_eligible_resource', `Expected no_eligible_resource, got ${result.status}.`);
  expect(result.candidates.length === 0, 'Draft was adapted as formal candidate.');
}

async function caseSupersededVersion(): Promise<void> {
  const fixture = await buildFixture();
  const current = fixture.snapshot.frozenVersions[0]!;
  const superseded: FrozenQuestionResourceVersion = {
    ...clone(current),
    resourceVersionId: `${current.resourceId}:v0`,
    versionNumber: 1,
    status: 'superseded',
  };
  fixture.snapshot.frozenVersions.push(superseded);
  const result = run(fixture);
  expect(result.status === 'eligible', `Current version should remain eligible, got ${result.status}.`);
  expect(result.eligibleCandidateIds.length === 1, 'Superseded version entered eligible pool.');
  const oldEvaluation = result.candidateEvaluations.find((item) => item.resourceVersionId === superseded.resourceVersionId);
  expect(oldEvaluation?.status === 'rejected', 'Superseded version was not rejected.');
}

async function caseRetiredResource(): Promise<void> {
  const fixture = await buildFixture();
  fixture.snapshot.registryEntries[0] = { ...fixture.snapshot.registryEntries[0]!, status: 'retired' };
  fixture.snapshot.frozenVersions[0] = { ...fixture.snapshot.frozenVersions[0]!, status: 'retired' };
  const result = run(fixture);
  expect(result.status === 'no_eligible_resource', `Expected no_eligible_resource, got ${result.status}.`);
  expect(result.eligibleResources.length === 0, 'Retired resource entered eligible view.');
}

async function caseMissingRegistryVersion(): Promise<void> {
  const fixture = await buildFixture();
  fixture.snapshot.registryEntries[0] = {
    ...fixture.snapshot.registryEntries[0]!,
    currentFrozenVersionId: 'resource-missing:v99',
  };
  const result = run(fixture);
  expect(result.status === 'review_required', `Expected review_required, got ${result.status}.`);
  expect(result.issues.some((item) => item.startsWith('registry.current_version_missing')), 'Missing registry target not reported.');
  expect(!result.canEnterExistingTaskFulfillment, 'Inconsistent registry entered TaskFulfillment.');
}

async function caseMultipleFrozenHeads(): Promise<void> {
  const fixture = await buildFixture();
  const current = fixture.snapshot.frozenVersions[0]!;
  fixture.snapshot.frozenVersions.push({
    ...clone(current),
    resourceVersionId: `${current.resourceId}:v2-conflict`,
    versionNumber: 2,
    status: 'frozen',
  });
  const result = run(fixture);
  expect(result.status === 'review_required', `Expected review_required, got ${result.status}.`);
  expect(result.issues.some((item) => item.startsWith('version.multiple_current')), 'Multiple frozen heads not reported.');
}

async function caseTraceabilityMismatch(): Promise<void> {
  const fixture = await buildFixture();
  fixture.snapshot.reviews[0] = {
    ...fixture.snapshot.reviews[0]!,
    resourceId: 'resource-other',
  };
  const result = run(fixture);
  expect(result.status === 'review_required', `Expected review_required, got ${result.status}.`);
  expect(result.candidateEvaluations[0]?.issues.includes('candidate.review_validation_untraceable'), 'Trace mismatch not reported.');
}

async function caseEnvelopeMismatch(): Promise<void> {
  const fixture = await buildFixture();
  fixture.envelope = {
    ...fixture.envelope,
    taskRequest: { ...fixture.envelope.taskRequest, studentId: 'student-wrong' },
  };
  const result = run(fixture);
  expect(result.status === 'blocked', `Expected blocked, got ${result.status}.`);
  expect(result.candidates.length === 0, 'Blocked input generated candidates.');
  expect(result.issues.includes('input.adaptive_envelope_invalid'), 'Envelope failure not reported.');
}

function run(fixture: Fixture) {
  const input: CoreResourceEligibilityInput = {
    adaptiveTaskRequestEnvelope: fixture.envelope,
    taskFulfillmentRequest: fixture.fulfillmentRequest,
    resourceSnapshot: fixture.snapshot,
    evaluatedAt: NOW,
  };
  return evaluateCoreResourceEligibility(input);
}

async function buildFixture(options: {
  freeze?: boolean;
  primaryAbilityId?: PrimaryAbilityId;
  supportingAbilityIds?: PrimaryAbilityId[];
  taskRole?: 'training' | 'retest' | 'transfer' | 'diagnosis' | 'observation';
  difficulty?: 'basic' | 'intermediate' | 'advanced';
} = {}): Promise<Fixture> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  await createQuestionMaterial(repository, {
    materialId: 'material-phase16-2a',
    materialVersionId: 'material-phase16-2a:v1',
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲从旧书中发现一片褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: { sourceType: 'manual', description: 'Phase 16.2A deterministic fixture.' },
    createdAt: NOW,
  });
  const abilityId = options.primaryAbilityId || 'inference';
  const taskRole = options.taskRole || ROLE;
  const draft = await createStructuredQuestionDraft(repository, {
    draftId: 'draft-phase16-2a',
    resourceId: 'resource-phase16-2a',
    taskId: 'task-phase16-2a',
    materialVersionId: 'material-phase16-2a:v1',
    title: '人物心理推断',
    questionStem: '父亲当时有怎样的心理？请结合材料说明。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['不舍', '怀念', '珍惜'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: validRubric(abilityId),
    minimumAnswerRequirement: {
      minLength: 10,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId,
      supportingAbilityIds: options.supportingAbilityIds || (abilityId === 'inference' ? ['comprehension'] : []),
      prerequisiteAbilityIds: [],
      taskRole,
      difficulty: options.difficulty || 'intermediate',
      gradeRange: '初中',
    },
    source: { sourceType: 'manual', description: 'Phase 16.2A deterministic fixture.' },
    tags: ['人物心理', '文本依据'],
    now: NOW,
  });

  let version: FrozenQuestionResourceVersion | undefined;
  if (options.freeze !== false) {
    const validation = await validateStructuredQuestionDraft(repository, draft.draftId, NOW);
    expect(validation.passed, `Fixture validation failed: ${validation.issues.map((item) => item.code).join(',')}`);
    await submitQuestionResourceForReview(repository, draft.draftId, NOW);
    await reviewQuestionResourceDraft(repository, {
      draftId: draft.draftId,
      action: 'approve',
      reviewerId: 'reviewer-phase16',
      notes: 'Approved for 16.2A deterministic validation.',
      now: NOW,
    });
    version = (await freezeQuestionResourceDraft(repository, draft.draftId, NOW)).version;
  }

  return {
    repository,
    snapshot: await loadResourceEligibilitySnapshot(repository, NOW),
    envelope: buildEnvelope(),
    fulfillmentRequest: buildFulfillmentRequest(),
    version,
  };
}

function buildEnvelope(): AdaptiveTaskRequestEnvelope {
  const taskRequest = {
    taskRequestId: 'task-request-phase16-2a',
    strategyId: 'strategy-phase16-2a',
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    taskRole: ROLE,
    action: 'continue_training' as const,
    validationGoal: '观察学生能否根据文本行为推断人物心理并说明依据。',
    evidenceLinks: ['evidence-phase16-2a'],
    growthMemoryRecordIds: ['growth-memory-phase16-2a'],
    constraints: ['targetAbilityId:inference', 'taskRole:training'],
    createdAt: NOW,
  };
  const constraintsId = 'constraints-phase16-2a';
  const adaptiveConstraints = {
    constraintsId,
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    sourceStrategyId: taskRequest.strategyId,
    sourceStrategyAction: taskRequest.action,
    sourceStrategyTaskRole: ROLE,
    sourceValidationGoal: taskRequest.validationGoal,
    sourceContextSnapshotId: 'context-phase16-2a',
    sourceConflictAssessmentId: 'conflict-phase16-2a',
    sourceConflictStatus: 'aligned_weakness_evidence' as const,
    sourceQualityAssessmentIds: ['quality-phase16-2a'],
    sourceEvidenceIds: taskRequest.evidenceLinks,
    sourceObservationUnitIds: ['observation-phase16-2a'],
    learningIntent: 'consolidation' as const,
    observationTarget: 'recheck_weakness' as const,
    recommendedTaskRole: ROLE,
    difficultyDirection: 'maintain' as const,
    materialNovelty: 'similar_context' as const,
    hintPolicy: 'limited_hint' as const,
    targetEvidenceQuality: 'medium' as const,
    preExecutionQualityConditions: {
      requireNovelMaterial: false,
      requireKnownDifficulty: true,
      requireAbilityAlignment: true,
      requiredHintPolicy: 'limited_hint' as const,
      requireTraceability: true,
    },
    requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'focused_practice'],
    hardConstraints: [
      { code: 'task_role' as const, operator: 'eq' as const, value: ROLE, source: 'strategy' as const },
      { code: 'target_ability' as const, operator: 'eq' as const, value: ABILITY_ID, source: 'strategy' as const },
      { code: 'difficulty' as const, operator: 'eq' as const, value: 'maintain', source: 'strategy' as const },
    ],
    softPreferences: [],
    reasons: ['Continue a controlled observation of the target ability.'],
    limitations: [],
    schemaVersion: ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
    policyVersion: ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
    generatedAt: NOW,
    validation: { passed: true, issues: [] },
  };
  const alignmentResult = {
    alignmentId: 'alignment-phase16-2a',
    strategyId: taskRequest.strategyId,
    constraintsId,
    contextSnapshotId: 'context-phase16-2a',
    status: 'aligned' as const,
    checks: {
      identityAligned: true,
      strategyValidationPassed: true,
      sourceStrategyAligned: true,
      targetAbilityAligned: true,
      taskRoleAligned: true,
      validationGoalAligned: true,
      difficultyAllowed: true,
      materialAllowed: true,
      hintPolicyAllowed: true,
      contextAllowed: true,
      conflictAllowed: true,
    },
    canCreateTaskRequest: true,
    nextStep: 'create_task_request' as const,
    issues: [],
    warnings: [],
    alignedAt: NOW,
    validation: { passed: true, issues: [] },
  };
  return {
    envelopeId: 'adaptive-envelope-phase16-2a',
    taskRequest,
    adaptiveConstraints,
    alignmentResult,
    constraintsId,
    canEnterTaskFulfillment: true,
    schemaVersion: ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
    validation: { passed: true, issues: [] },
  };
}

function buildFulfillmentRequest(): TaskFulfillmentRequest {
  return {
    requestId: 'fulfillment-phase16-2a',
    studentId: STUDENT_ID,
    taskRole: ROLE,
    targetAbilityId: ABILITY_ID,
    contentType: 'similar_text',
    questionType: 'open_response',
    responseMode: 'written',
    difficultyRange: { preferred: 'same' },
    validationGoal: '观察学生能否根据文本行为推断人物心理并说明依据。',
    requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'focused_practice'],
    hardConstraints: [
      'adaptiveConstraintsId:constraints-phase16-2a',
      'task_role:eq:training',
      'target_ability:eq:inference',
    ],
    softPreferences: [],
    recentTaskIds: [],
    sourceTaskRequestId: 'task-request-phase16-2a',
    sourceStrategyId: 'strategy-phase16-2a',
    createdAt: NOW,
  };
}

function validRubric(abilityId: PrimaryAbilityId): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence',
      name: '文本依据',
      abilityId,
      importance: 'critical',
      required: true,
      evidenceRequirement: { requireTextEvidence: true },
      acceptedSignals: ['引用动作', '指出细节'],
    },
    {
      itemId: 'explanation',
      name: '解释关系',
      abilityId,
      importance: 'important',
      required: true,
      evidenceRequirement: { requireExplanation: true, requireConclusion: true },
      acceptedSignals: ['连接行为与心理'],
    },
  ];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
