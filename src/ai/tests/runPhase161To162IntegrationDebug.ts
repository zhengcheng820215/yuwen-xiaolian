import {
  createNextQuestionResourceVersionDraft,
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import { evaluateCoreResourceEligibility } from '../agents/coreResourceEligibilityAgent.ts';
import {
  createQualityGatedExecutableTask,
  evaluateResourceMatchQuality,
} from '../agents/resourceMatchQualityAgent.ts';
import { loadResourceEligibilitySnapshot } from '../agents/reviewedResourceCandidateAdapter.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
  ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
  type AdaptiveTaskRequestEnvelope,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import {
  type FrozenQuestionResourceVersion,
  type PrimaryAbilityId,
  type QuestionResourceRubricItem,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  CoreResourceEligibilityResult,
  ResourceEligibilitySnapshot,
  ResourceMatchQualityResult,
  ResourceMatchRecentHistory,
} from '../schemas/resourceMatchQuality.schema.ts';
import type { TaskFulfillmentRequest } from '../schemas/taskFulfillment.schema.ts';

const NOW = '2026-07-20T13:00:00.000Z';
const LATER = '2026-07-20T14:00:00.000Z';
const STUDENT_ID = 'student-phase16-integration';

type Repository = InMemoryQuestionResourceAdmissionRepository;
type PipelineResult = {
  snapshot: ResourceEligibilitySnapshot;
  core: CoreResourceEligibilityResult;
  quality: ResourceMatchQualityResult;
  fulfillment: TaskFulfillmentRequest;
};

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'I1 frozen repository resource becomes an executable matched task', run: caseNormalRepositoryHandoff },
  { name: 'I2 new frozen version supersedes v1 and becomes the only selectable head', run: caseVersionSwitch },
  { name: 'I3 registry change after matching blocks stale task creation', run: caseStaleMatchBlocked },
  { name: 'I4 formal resource mismatch creates a resource gap without a task', run: caseFormalMismatch },
  { name: 'I5 repeated freeze and snapshot evaluation remain idempotent', run: caseRepositoryAndRuntimeIdempotency },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log('Phase 16.1 -> 16.2 Integration Debug');
  console.log('='.repeat(68));
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
  console.log('-'.repeat(68));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  console.log(`Phase 16.1 -> 16.2 Integration Smoke: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log('Education side effects: none');

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseNormalRepositoryHandoff(): Promise<void> {
  const { repository, version } = await createFrozenRepositoryResource('normal');
  const result = await runPipeline(repository);
  const task = createQualityGatedExecutableTask({
    qualityResult: result.quality,
    fulfillmentRequest: result.fulfillment,
    currentResourceSnapshot: result.snapshot,
    createdAt: NOW,
  });

  expect(result.core.status === 'eligible', `Expected eligible, got ${result.core.status}.`);
  expect(result.quality.evaluation?.status === 'matched', `Expected matched, got ${result.quality.evaluation?.status}.`);
  expect(task.status === 'created' && task.task, 'Repository resource did not create an executable task.');
  expect(task.task.resourceId === version.resourceId, 'Resource identity was lost during handoff.');
  expect(task.task.resourceVersionId === version.resourceVersionId, 'Version identity was lost during handoff.');
  expect(task.task.taskId === version.taskId, 'Task identity was lost during handoff.');
  expect(task.task.constraintsId === result.quality.evaluation?.constraintsId, 'Constraints identity was lost during handoff.');
}

async function caseVersionSwitch(): Promise<void> {
  const { repository, version: v1 } = await createFrozenRepositoryResource('version-switch');
  const v2 = await freezeNextVersion(repository, v1, 'version-switch-v2');
  const result = await runPipeline(repository);
  const task = createQualityGatedExecutableTask({
    qualityResult: result.quality,
    fulfillmentRequest: result.fulfillment,
    currentResourceSnapshot: result.snapshot,
    createdAt: LATER,
  });
  const storedV1 = await repository.getVersion(v1.resourceVersionId);
  const registry = await repository.getRegistryEntry(v1.resourceId);
  const oldCandidate = result.core.candidateEvaluations.find((item) => item.resourceVersionId === v1.resourceVersionId);

  expect(storedV1?.status === 'superseded', 'Old version was not superseded by the repository commit.');
  expect(registry?.currentFrozenVersionId === v2.resourceVersionId, 'Registry did not move to v2.');
  expect(
    oldCandidate?.status === 'rejected',
    `Superseded v1 was not rejected: ${JSON.stringify({ oldCandidate, candidates: result.core.candidateEvaluations })}`,
  );
  expect(result.quality.evaluation?.selectedResourceVersionId === v2.resourceVersionId, 'Matcher did not select Registry head v2.');
  expect(task.task?.resourceVersionId === v2.resourceVersionId, 'Executable task did not preserve v2 identity.');
}

async function caseStaleMatchBlocked(): Promise<void> {
  const { repository, version: v1 } = await createFrozenRepositoryResource('stale-match');
  const matched = await runPipeline(repository);
  expect(matched.quality.evaluation?.status === 'matched', 'Fixture did not produce an initial match.');

  await freezeNextVersion(repository, v1, 'stale-match-v2');
  const currentSnapshot = await loadResourceEligibilitySnapshot(repository, LATER);
  const task = createQualityGatedExecutableTask({
    qualityResult: matched.quality,
    fulfillmentRequest: matched.fulfillment,
    currentResourceSnapshot: currentSnapshot,
    createdAt: LATER,
  });

  expect(task.status === 'blocked', 'Stale match created a task after Registry changed.');
  expect(task.issues.includes('selected_resource_is_no_longer_current'), 'Registry change issue was not preserved.');
}

async function caseFormalMismatch(): Promise<void> {
  const { repository } = await createFrozenRepositoryResource('mismatch');
  const result = await runPipeline(repository, 'comprehension');

  expect(result.core.status === 'no_eligible_resource', `Expected no_eligible_resource, got ${result.core.status}.`);
  expect(result.quality.evaluation?.status === 'no_match', `Expected no_match, got ${result.quality.evaluation?.status}.`);
  expect(Boolean(result.quality.evaluation?.resourceGap), 'Resource Gap was not generated.');
  expect(!result.quality.evaluation?.canCreateExecutableTask, 'Mismatched resource became executable.');
}

async function caseRepositoryAndRuntimeIdempotency(): Promise<void> {
  const { repository, draftId, version } = await createFrozenRepositoryResource('idempotency');
  const duplicate = await freezeQuestionResourceDraft(repository, draftId, LATER);
  const first = await runPipeline(repository);
  const second = await runPipeline(repository);

  expect(!duplicate.inserted, 'Repeated freeze inserted another formal version.');
  expect(duplicate.version.resourceVersionId === version.resourceVersionId, 'Repeated freeze changed version identity.');
  expect((await repository.listVersions(version.resourceId)).length === 1, 'Repeated freeze duplicated repository data.');
  expect(first.snapshot.snapshotId === second.snapshot.snapshotId, 'Repeated snapshot changed identity.');
  expect(first.core.eligibilityResultId === second.core.eligibilityResultId, 'Repeated eligibility changed identity.');
  expect(first.quality.evaluation?.evaluationId === second.quality.evaluation?.evaluationId, 'Repeated match changed identity.');
}

async function runPipeline(
  repository: Repository,
  targetAbilityId: PrimaryAbilityId = 'inference',
): Promise<PipelineResult> {
  const envelope = buildEnvelope(targetAbilityId);
  const fulfillment = buildFulfillment(targetAbilityId);
  const snapshot = await loadResourceEligibilitySnapshot(repository, NOW);
  const core = evaluateCoreResourceEligibility({
    adaptiveTaskRequestEnvelope: envelope,
    taskFulfillmentRequest: fulfillment,
    resourceSnapshot: snapshot,
    evaluatedAt: NOW,
  });
  const quality = evaluateResourceMatchQuality({
    adaptiveRequestEnvelope: envelope,
    fulfillmentRequest: fulfillment,
    coreEligibility: core,
    resourceSnapshot: snapshot,
    recentHistory: buildHistory(),
    evaluatedAt: NOW,
  });
  return { snapshot, core, quality, fulfillment };
}

async function createFrozenRepositoryResource(suffix: string): Promise<{
  repository: Repository;
  draftId: string;
  version: FrozenQuestionResourceVersion;
}> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  const materialId = `material-integration-${suffix}`;
  const materialVersionId = `${materialId}:v1`;
  const resourceId = `resource-integration-${suffix}`;
  const draftId = `draft-integration-${suffix}`;

  await createQuestionMaterial(repository, {
    materialId,
    materialVersionId,
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲从旧书中发现一片褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: { sourceType: 'manual', description: 'Phase 16.1 -> 16.2 integration fixture.' },
    createdAt: NOW,
  });
  const draft = await createStructuredQuestionDraft(repository, {
    draftId,
    resourceId,
    taskId: `task-integration-${suffix}`,
    materialVersionId,
    title: '人物心理推断训练',
    questionStem: '父亲当时有怎样的心理？请根据材料中的动作说明理由。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['怀念', '不舍', '珍惜'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: validRubric('inference'),
    minimumAnswerRequirement: {
      minLength: 8,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'inference',
      supportingAbilityIds: ['comprehension'],
      prerequisiteAbilityIds: ['comprehension'],
      taskRole: 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: { sourceType: 'manual', description: 'Phase 16.1 -> 16.2 integration fixture.' },
    tags: ['material_relation:similar_context', 'hint_policy:limited_hint', '人物心理'],
    now: NOW,
  });
  const validation = await validateStructuredQuestionDraft(repository, draft.draftId, NOW);
  expect(validation.passed, `Resource validation failed: ${validation.issues.map((item) => item.code).join(', ')}`);
  await submitQuestionResourceForReview(repository, draft.draftId, NOW);
  await reviewQuestionResourceDraft(repository, {
    draftId: draft.draftId,
    action: 'approve',
    reviewerId: 'reviewer-integration',
    notes: 'Approved for Phase 16.1 -> 16.2 integration.',
    now: NOW,
  });
  const version = (await freezeQuestionResourceDraft(repository, draft.draftId, NOW)).version;
  return { repository, draftId, version };
}

async function freezeNextVersion(
  repository: Repository,
  current: FrozenQuestionResourceVersion,
  draftId: string,
): Promise<FrozenQuestionResourceVersion> {
  const draft = await createNextQuestionResourceVersionDraft(repository, {
    resourceId: current.resourceId,
    draftId,
    now: LATER,
  });
  const updated = await updateStructuredQuestionDraft(repository, draft.draftId, {
    questionStem: `${draft.questionStem} 请把动作和心理之间的关系说清楚。`,
  }, LATER);
  const validation = await validateStructuredQuestionDraft(repository, updated.draftId, LATER);
  expect(validation.passed, 'Version 2 validation failed.');
  await submitQuestionResourceForReview(repository, updated.draftId, LATER);
  await reviewQuestionResourceDraft(repository, {
    draftId: updated.draftId,
    action: 'approve',
    reviewerId: 'reviewer-integration',
    notes: 'Approved version 2 for integration.',
    now: LATER,
  });
  return (await freezeQuestionResourceDraft(repository, updated.draftId, LATER)).version;
}

function buildEnvelope(targetAbilityId: PrimaryAbilityId): AdaptiveTaskRequestEnvelope {
  const validationGoal = '观察学生能否根据文本行为推断人物心理并说明依据。';
  const constraintsId = `constraints-integration-${targetAbilityId}`;
  const taskRequest = {
    taskRequestId: `task-request-integration-${targetAbilityId}`,
    strategyId: `strategy-integration-${targetAbilityId}`,
    studentId: STUDENT_ID,
    targetAbilityId,
    taskRole: 'training' as const,
    action: 'continue_training' as const,
    validationGoal,
    evidenceLinks: ['evidence-integration'],
    growthMemoryRecordIds: ['memory-integration'],
    constraints: [`targetAbilityId:${targetAbilityId}`, 'taskRole:training'],
    createdAt: NOW,
  };
  return {
    envelopeId: `adaptive-envelope-integration-${targetAbilityId}`,
    taskRequest,
    adaptiveConstraints: {
      constraintsId,
      studentId: STUDENT_ID,
      targetAbilityId,
      sourceStrategyId: taskRequest.strategyId,
      sourceStrategyAction: taskRequest.action,
      sourceStrategyTaskRole: 'training',
      sourceValidationGoal: validationGoal,
      sourceContextSnapshotId: 'context-integration',
      sourceConflictAssessmentId: 'conflict-integration',
      sourceConflictStatus: 'aligned_weakness_evidence',
      sourceQualityAssessmentIds: ['quality-integration'],
      sourceEvidenceIds: ['evidence-integration'],
      sourceObservationUnitIds: ['unit-integration'],
      learningIntent: 'consolidation',
      observationTarget: 'recheck_weakness',
      recommendedTaskRole: 'training',
      difficultyDirection: 'maintain',
      materialNovelty: 'similar_context',
      hintPolicy: 'limited_hint',
      targetEvidenceQuality: 'medium',
      preExecutionQualityConditions: {
        requireNovelMaterial: false,
        requireKnownDifficulty: true,
        requireAbilityAlignment: true,
        requiredHintPolicy: 'limited_hint',
        requireTraceability: true,
      },
      requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'focused_practice'],
      hardConstraints: [
        { code: 'task_role', operator: 'eq', value: 'training', source: 'strategy' },
        { code: 'target_ability', operator: 'eq', value: targetAbilityId, source: 'strategy' },
        { code: 'difficulty', operator: 'eq', value: 'maintain', source: 'strategy' },
        { code: 'material_novelty', operator: 'eq', value: 'similar_context', source: 'strategy' },
        { code: 'hint_policy', operator: 'eq', value: 'limited_hint', source: 'quality' },
      ],
      softPreferences: [],
      reasons: ['Validate the formal repository handoff.'],
      limitations: [],
      schemaVersion: ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
      policyVersion: ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
      generatedAt: NOW,
      validation: { passed: true, issues: [] },
    },
    alignmentResult: {
      alignmentId: `alignment-integration-${targetAbilityId}`,
      strategyId: taskRequest.strategyId,
      constraintsId,
      contextSnapshotId: 'context-integration',
      status: 'aligned',
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
      nextStep: 'create_task_request',
      issues: [],
      warnings: [],
      alignedAt: NOW,
      validation: { passed: true, issues: [] },
    },
    constraintsId,
    canEnterTaskFulfillment: true,
    schemaVersion: ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
    validation: { passed: true, issues: [] },
  };
}

function buildFulfillment(targetAbilityId: PrimaryAbilityId): TaskFulfillmentRequest {
  return {
    requestId: `fulfillment-integration-${targetAbilityId}`,
    studentId: STUDENT_ID,
    taskRole: 'training',
    targetAbilityId,
    contentType: 'comparable_text',
    questionType: 'open_response',
    responseMode: 'written',
    difficultyRange: { preferred: 'same', minimum: 'lower', maximum: 'same' },
    validationGoal: '观察学生能否根据文本行为推断人物心理并说明依据。',
    requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'focused_practice'],
    hardConstraints: [`adaptiveConstraintsId:constraints-integration-${targetAbilityId}`],
    softPreferences: [],
    recentTaskIds: [],
    sourceTaskRequestId: `task-request-integration-${targetAbilityId}`,
    sourceStrategyId: `strategy-integration-${targetAbilityId}`,
    createdAt: NOW,
  };
}

function buildHistory(): ResourceMatchRecentHistory {
  return {
    studentId: STUDENT_ID,
    recentTaskIds: [],
    recentResourceIds: [],
    recentResourceVersionIds: [],
    recentMaterialIds: [],
    recentExecutionSessionIds: [],
    historyWindowStartedAt: '2026-07-13T13:00:00.000Z',
    historyWindowEndedAt: NOW,
  };
}

function validRubric(abilityId: PrimaryAbilityId): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence',
      name: '文本依据',
      description: '指出与判断相关的文本动作或细节。',
      abilityId,
      importance: 'critical',
      required: true,
      evidenceRequirement: { requireTextEvidence: true },
      acceptedSignals: ['指出父亲站了很久或小心夹回树叶'],
    },
    {
      itemId: 'explanation',
      name: '解释关系',
      description: '说明人物行为与心理判断之间的关系。',
      abilityId,
      importance: 'important',
      required: true,
      evidenceRequirement: { requireExplanation: true, requireConclusion: true },
      acceptedSignals: ['说明动作与怀念、不舍之间的联系'],
    },
  ];
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
