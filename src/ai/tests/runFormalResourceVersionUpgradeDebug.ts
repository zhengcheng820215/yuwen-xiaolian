import assert from 'node:assert/strict';
import { QuestionResourceCandidateAdoptionGateway } from
  '../agents/questionCandidateAdoptionGateway.ts';
import { QuestionCandidateConflictError } from '../agents/questionCandidateService.ts';
import { createStructuredQuestionDraft } from '../agents/questionResourceAdmissionAgent.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type FrozenQuestionResourceVersion,
  type ResourceRegistryEntry,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  QUESTION_CANDIDATE_SCHEMA_VERSION,
  type CandidateRuntimeContext,
  type QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  extractQuestionEditableFields,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';

const NOW = '2026-08-09T12:00:00.000Z';
const LATER = '2026-08-09T12:10:00.000Z';

async function main(): Promise<void> {
  await caseValidCandidateCreatesV2Successor();
  await caseStaleFormalBaseIsRejected();
  await caseMismatchedFormalIdentityIsRejected();
  await caseFailedV2CommitKeepsV1Active();
  await caseSuccessfulV2CommitSwitchesRegistry();
  await caseRepeatedAdoptionIsIdempotent();

  console.log('Formal Resource Version Upgrade P2 Debug');
  console.log('PASS 01 current V1 candidate creates a V2 successor draft');
  console.log('PASS 02 stale formal base is rejected before adoption');
  console.log('PASS 03 mismatched formal identity is rejected');
  console.log('PASS 04 failed V2 commit keeps V1 active');
  console.log('PASS 05 successful V2 commit switches Registry and preserves V1');
  console.log('PASS 06 repeated adoption reuses the same successor draft');
  console.log('Result: 6 / 6 PASS');
}

async function caseValidCandidateCreatesV2Successor(): Promise<void> {
  const fixture = await createFixture();
  const adoption = await fixture.gateway.adoptCandidate(adoptionInput(fixture));
  const successor = await fixture.repository.getDraft(adoption.draftId);
  assert.equal(successor?.resourceId, fixture.v1.resourceId);
  assert.equal(successor?.proposedVersionNumber, 2);
  assert.equal(successor?.parentVersionId, fixture.v1.resourceVersionId);
  assert.equal((await fixture.repository.getRegistryEntry(fixture.v1.resourceId))?.currentFrozenVersionId,
    fixture.v1.resourceVersionId);
  assert.equal((await fixture.repository.listVersions(fixture.v1.resourceId)).length, 1);
}

async function caseStaleFormalBaseIsRejected(): Promise<void> {
  const fixture = await createFixture();
  const externalV2 = frozenVersionFromDraft(
    await createStructuredQuestionDraft(fixture.repository, {
      ...contentFixture('external-v2'),
      draftId: 'external-v2-draft',
      resourceId: fixture.v1.resourceId,
      taskId: fixture.v1.taskId,
      proposedVersionNumber: 2,
      parentVersionId: fixture.v1.resourceVersionId,
      now: LATER,
    }),
    fixture.v1.resourceVersionId,
    LATER,
  );
  await fixture.repository.commitFreeze({
    version: externalV2,
    registryEntry: registryEntry(externalV2, LATER),
    previousVersionId: fixture.v1.resourceVersionId,
  });
  await assert.rejects(
    () => fixture.gateway.adoptCandidate(adoptionInput(fixture)),
    isConflict('FORMAL_RESOURCE_CANDIDATE_BASE_CONFLICT'),
  );
  assert.equal((await fixture.repository.listDrafts()).length, 2);
}

async function caseMismatchedFormalIdentityIsRejected(): Promise<void> {
  const fixture = await createFixture();
  await assert.rejects(
    () => fixture.gateway.adoptCandidate({
      ...adoptionInput(fixture),
      expectedContext: {
        ...fixture.context,
        baseFormalVersionId: `${fixture.v1.resourceId}:v2`,
      },
    }),
    isConflict('FORMAL_RESOURCE_CANDIDATE_BASE_CONFLICT'),
  );
  assert.equal((await fixture.repository.listDrafts()).length, 1);
}

async function caseFailedV2CommitKeepsV1Active(): Promise<void> {
  const fixture = await createFixture();
  const adoption = await fixture.gateway.adoptCandidate(adoptionInput(fixture));
  const successor = (await fixture.repository.getDraft(adoption.draftId))!;
  const v2 = frozenVersionFromDraft(successor, fixture.v1.resourceVersionId, LATER);
  fixture.repository.simulateNextFreezeCommitFailure();
  await assert.rejects(() => fixture.repository.commitFreeze({
    version: v2,
    registryEntry: registryEntry(v2, LATER),
    previousVersionId: fixture.v1.resourceVersionId,
  }));
  assert.equal((await fixture.repository.getRegistryEntry(fixture.v1.resourceId))?.currentFrozenVersionId,
    fixture.v1.resourceVersionId);
  assert.equal((await fixture.repository.getVersion(fixture.v1.resourceVersionId))?.status, 'frozen');
  assert.equal((await fixture.repository.listVersions(fixture.v1.resourceId)).length, 1);
}

async function caseSuccessfulV2CommitSwitchesRegistry(): Promise<void> {
  const fixture = await createFixture();
  const adoption = await fixture.gateway.adoptCandidate(adoptionInput(fixture));
  const successor = (await fixture.repository.getDraft(adoption.draftId))!;
  const v2 = frozenVersionFromDraft(successor, fixture.v1.resourceVersionId, LATER);
  await fixture.repository.commitFreeze({
    version: v2,
    registryEntry: registryEntry(v2, LATER),
    previousVersionId: fixture.v1.resourceVersionId,
  });
  assert.equal((await fixture.repository.getRegistryEntry(fixture.v1.resourceId))?.currentFrozenVersionId,
    v2.resourceVersionId);
  assert.equal((await fixture.repository.getVersion(fixture.v1.resourceVersionId))?.status, 'superseded');
  assert.equal((await fixture.repository.getVersion(v2.resourceVersionId))?.status, 'frozen');
  assert.equal((await fixture.repository.listVersions(fixture.v1.resourceId)).length, 2);
}

async function caseRepeatedAdoptionIsIdempotent(): Promise<void> {
  const fixture = await createFixture();
  const first = await fixture.gateway.adoptCandidate(adoptionInput(fixture));
  const repeated = await fixture.gateway.adoptCandidate(adoptionInput(fixture));
  assert.deepEqual(repeated, first);
  assert.equal((await fixture.repository.listDrafts()).length, 2);
}

async function createFixture() {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  const sourceDraft = await createStructuredQuestionDraft(repository, {
    ...contentFixture('v1'),
    draftId: 'formal-v1-draft',
    resourceId: 'question-task-wolf-1',
    taskId: 'task-wolf-1',
    now: NOW,
  });
  const v1 = frozenVersionFromDraft(sourceDraft, undefined, NOW);
  await repository.commitFreeze({
    version: v1,
    registryEntry: registryEntry(v1, NOW),
  });
  const context: CandidateRuntimeContext = {
    materialVersionId: 'material-wolf:v1',
    observationPlanVersion: 1,
    trainingTaskVersion: 1,
    baseFormalResourceId: v1.resourceId,
    baseFormalVersionId: v1.resourceVersionId,
    activeDraftId: sourceDraft.draftId,
    activeDraftRevision: sourceDraft.revision,
    activeDraftContentHash: calculateQuestionEditableFieldsHash(
      extractQuestionEditableFields(sourceDraft),
    ),
  };
  const candidate = candidateFixture(context);
  return {
    repository,
    gateway: new QuestionResourceCandidateAdoptionGateway(repository),
    sourceDraft,
    v1,
    context,
    candidate,
  };
}

function adoptionInput(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return {
    candidate: fixture.candidate,
    expectedContext: fixture.context,
    idempotencyKey: 'adopt-formal-v1-candidate',
    adoptedAt: LATER,
  };
}

function candidateFixture(context: CandidateRuntimeContext): QuestionCandidate {
  const content = contentFixture('candidate-v2');
  return {
    candidateId: 'formal-v1-candidate-1',
    generationCommandId: 'formal-v1-generation-1',
    generationCommandFingerprint: 'formal-v1-generation-fingerprint',
    trainingTaskId: 'task-wolf-1',
    candidateOrigin: 'ai_generated',
    candidateType: 'formal_version_optimization',
    basedOnDraftId: context.activeDraftId,
    basedOnRevision: context.activeDraftRevision,
    basedOnContentHash: context.activeDraftContentHash,
    basedOnFormalResourceId: context.baseFormalResourceId,
    basedOnFormalVersionId: context.baseFormalVersionId,
    content,
    contentHash: calculateQuestionEditableFieldsHash(content),
    generationReason: 'Create a successor candidate without mutating V1.',
    changedFields: ['questionStem'],
    allowedFields: ['questionStem', 'studentTask', 'rubric', 'answerAcceptance'],
    lockedFields: ['materialScope'],
    generationContext: {
      source: 'ai_generated',
      modelId: 'p2-debug-model',
      promptVersion: 'formal-version-upgrade-v1',
      promptHash: 'formal-version-upgrade-prompt',
      ruleVersion: 'formal-resource-immutability-v1',
      materialVersionId: context.materialVersionId,
      observationPlanVersion: context.observationPlanVersion,
      trainingTaskVersion: context.trainingTaskVersion,
      generatedAt: NOW,
    },
    status: 'ready',
    createdAt: NOW,
    schemaVersion: QUESTION_CANDIDATE_SCHEMA_VERSION,
  };
}

function frozenVersionFromDraft(
  draft: StructuredQuestionDraft,
  parentVersionId: string | undefined,
  frozenAt: string,
): FrozenQuestionResourceVersion {
  return {
    resourceId: draft.resourceId,
    resourceVersionId: `${draft.resourceId}:v${draft.proposedVersionNumber}`,
    versionNumber: draft.proposedVersionNumber,
    parentVersionId,
    sourceDraftId: draft.draftId,
    materialVersionId: draft.materialVersionId,
    taskId: draft.taskId,
    ...extractQuestionEditableFields(draft),
    validationId: `validation-${draft.draftId}`,
    reviewId: `review-${draft.draftId}`,
    status: 'frozen',
    frozenAt,
    updatedAt: frozenAt,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function registryEntry(
  version: FrozenQuestionResourceVersion,
  updatedAt: string,
): ResourceRegistryEntry {
  return {
    resourceId: version.resourceId,
    currentFrozenVersionId: version.resourceVersionId,
    status: 'active',
    latestReviewId: version.reviewId,
    latestValidationId: version.validationId,
    taskId: version.taskId,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    tags: [...version.tags],
    createdAt: NOW,
    updatedAt,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function contentFixture(suffix: string): QuestionEditableFields {
  return {
    materialVersionId: 'material-wolf:v1',
    title: `Wolf question ${suffix}`,
    questionStem: `Analyze the wolves' behavior using textual evidence (${suffix}).`,
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    options: [],
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['cunning', 'greedy'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: [{
      itemId: `rubric-${suffix}`,
      name: 'Analyze behavior',
      description: 'Use an action detail and explain the inferred trait.',
      abilityId: 'analysis',
      importance: 'critical',
      required: true,
      evidenceRequirement: { requireTextEvidence: true, requireExplanation: true },
      acceptedSignals: ['behavior', 'trait'],
    }],
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'analysis',
      supportingAbilityIds: ['comprehension'],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: 'intermediate',
      gradeRange: 'middle_school',
    },
    source: { sourceType: 'ai_assisted', description: 'P2 version upgrade debug.' },
    tags: ['material_scope:full_text', 'observation_task:task-wolf-1'],
  };
}

function isConflict(code: string) {
  return (error: unknown) => error instanceof QuestionCandidateConflictError
    && error.code === code;
}

void main();
