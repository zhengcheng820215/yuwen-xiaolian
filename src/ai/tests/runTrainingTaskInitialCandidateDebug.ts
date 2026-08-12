import assert from 'node:assert/strict';
import {
  TrainingTaskInitialCandidateService,
  type TrainingTaskInitialCandidateSource,
} from '../agents/trainingTaskInitialCandidateService.ts';
import { InMemoryQuestionCandidateRepository } from
  '../repositories/inMemoryQuestionCandidateRepository.ts';
import type { CandidateRuntimeContext } from '../schemas/questionCandidate.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';

const NOW = '2026-08-06T10:00:00.000Z';

async function main(): Promise<void> {
  await completeTaskCreatesOneDeterministicCandidate();
  await emptyQuestionRequiresGeneration();
  await visibleQuestionWithIncompleteInternalFieldsCreatesCandidate();
  await changedTaskExpiresOnlyTheOldReadyCompatibilityCandidate();
  await changedPlanContextCreatesCurrentCompatibilityCandidate();
  await returningToAnExpiredCurrentContextReactivatesItsCandidate();
  await expectedVersionAndHashProtectTheAdapterBoundary();
  await activeDraftIdentityIsBoundToTheCurrentScheme();
  console.log('Training Task Initial Candidate Debug: 8 / 8 PASS');
}

async function completeTaskCreatesOneDeterministicCandidate(): Promise<void> {
  const fixture = createFixture(contentFixture(), 1);
  const input = ensureInput(fixture.source);
  const first = await fixture.service.ensureInitialCandidateFromTrainingTask(input);
  const second = await fixture.service.ensureInitialCandidateFromTrainingTask(input);

  assert.equal(first.status, 'created');
  assert.equal(second.status, 'existing');
  assert.equal(first.candidate.candidateId, second.candidate.candidateId);
  assert.equal(first.candidate.candidateOrigin, 'training_task_compatibility_wrap');
  assert.equal(first.candidate.generationContext.source, 'training_task_compatibility_wrap');
  assert.equal(first.candidate.generationContext.modelId, 'training-task-compatibility-adapter');
  assert.equal((await fixture.repository.listCandidates('task-1')).length, 1);
}

async function emptyQuestionRequiresGeneration(): Promise<void> {
  const incomplete = { ...contentFixture(), questionStem: '   ' };
  const fixture = createFixture(incomplete, 1);
  const result = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );

  assert.equal(result.status, 'question_generation_required');
  assert(result.completeness.missingFields.includes('questionStem'));
  assert.equal((await fixture.repository.listCandidates('task-1')).length, 0);
}

async function visibleQuestionWithIncompleteInternalFieldsCreatesCandidate(): Promise<void> {
  const incomplete = { ...contentFixture(), rubric: [] };
  const fixture = createFixture(incomplete, 1);
  const result = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );

  assert.equal(result.status, 'created');
  assert.equal(result.completeness.complete, false);
  assert(result.completeness.missingFields.includes('rubric'));
  assert.equal(result.candidate.content.questionStem, incomplete.questionStem);
  assert.equal((await fixture.repository.listCandidates('task-1')).length, 1);
}

async function changedTaskExpiresOnlyTheOldReadyCompatibilityCandidate(): Promise<void> {
  const fixture = createFixture(contentFixture(), 1);
  const first = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );
  assert.notEqual(first.status, 'question_generation_required');
  await fixture.repository.updateCandidateStatus({
    candidateId: first.candidate.candidateId,
    expectedStatus: 'ready',
    status: 'adopted',
    occurredAt: NOW,
  });

  fixture.source.trainingTaskVersion = 2;
  fixture.source.context.trainingTaskVersion = 2;
  fixture.source.content = {
    ...fixture.source.content,
    questionStem: '请结合文本分析人物保持沉默的两个原因。',
  };
  fixture.source.contentHash = calculateQuestionEditableFieldsHash(fixture.source.content);
  const next = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );

  assert.equal(next.status, 'created');
  assert.equal((await fixture.repository.getCandidate(first.candidate.candidateId))?.status, 'adopted');
  assert.equal((await fixture.repository.listCandidates('task-1')).length, 2);
}

async function expectedVersionAndHashProtectTheAdapterBoundary(): Promise<void> {
  const fixture = createFixture(contentFixture(), 3);
  await assert.rejects(
    fixture.service.ensureInitialCandidateFromTrainingTask({
      ...ensureInput(fixture.source),
      expectedTrainingTaskVersion: 2,
    }),
    /TRAINING_TASK_VERSION_CONFLICT/,
  );
  await assert.rejects(
    fixture.service.ensureInitialCandidateFromTrainingTask({
      ...ensureInput(fixture.source),
      expectedContentHash: 'stale-content-hash',
    }),
    /TRAINING_TASK_CONTENT_CONFLICT/,
  );
  assert.equal((await fixture.repository.listCandidates('task-1')).length, 0);
}

async function changedPlanContextCreatesCurrentCompatibilityCandidate(): Promise<void> {
  const fixture = createFixture(contentFixture(), 1);
  const first = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );
  assert.notEqual(first.status, 'question_generation_required');

  fixture.source.context.observationPlanVersion = 2;
  const next = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );

  assert.equal(next.status, 'created');
  assert.notEqual(next.candidate.candidateId, first.candidate.candidateId);
  assert.equal(next.candidate.status, 'ready');
  assert.equal(
    (await fixture.repository.getCandidate(first.candidate.candidateId))?.status,
    'expired',
  );
}

async function returningToAnExpiredCurrentContextReactivatesItsCandidate(): Promise<void> {
  const fixture = createFixture(contentFixture(), 1);
  const original = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );
  assert.notEqual(original.status, 'question_generation_required');

  fixture.source.context.observationPlanVersion = 2;
  await fixture.service.ensureInitialCandidateFromTrainingTask(ensureInput(fixture.source));
  assert.equal(
    (await fixture.repository.getCandidate(original.candidate.candidateId))?.status,
    'expired',
  );

  fixture.source.context.observationPlanVersion = 1;
  const restored = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );
  assert.notEqual(restored.status, 'question_generation_required');
  assert.equal(restored.status, 'existing');
  assert.equal(restored.candidate.candidateId, original.candidate.candidateId);
  assert.equal(restored.candidate.status, 'ready');
}

async function activeDraftIdentityIsBoundToTheCurrentScheme(): Promise<void> {
  const fixture = createFixture(contentFixture(), 4);
  fixture.source.context.activeDraftId = 'draft-4';
  fixture.source.context.activeDraftRevision = 4;
  fixture.source.context.activeDraftContentHash = fixture.source.contentHash;
  const result = await fixture.service.ensureInitialCandidateFromTrainingTask(
    ensureInput(fixture.source),
  );
  assert.notEqual(result.status, 'question_generation_required');
  assert.equal(result.candidate.basedOnDraftId, 'draft-4');
  assert.equal(result.candidate.basedOnRevision, 4);
  assert.equal(result.candidate.basedOnContentHash, fixture.source.contentHash);
}

function createFixture(content: QuestionEditableFields, trainingTaskVersion: number) {
  const repository = new InMemoryQuestionCandidateRepository();
  const context: CandidateRuntimeContext = {
    materialVersionId: content.materialVersionId,
    observationPlanVersion: 1,
    trainingTaskVersion,
  };
  const source: TrainingTaskInitialCandidateSource = {
    trainingTaskVersion,
    contentHash: calculateQuestionEditableFieldsHash(content),
    content,
    context,
  };
  return {
    repository,
    source,
    service: new TrainingTaskInitialCandidateService(
      repository,
      { getInitialCandidateSource: async () => source },
      () => NOW,
    ),
  };
}

function ensureInput(source: TrainingTaskInitialCandidateSource) {
  return {
    trainingTaskId: 'task-1',
    expectedTrainingTaskVersion: source.trainingTaskVersion,
    expectedContentHash: source.contentHash,
    idempotencyKey: `task-1:${source.trainingTaskVersion}:${source.contentHash}`,
  };
}

function contentFixture(): QuestionEditableFields {
  return {
    materialVersionId: 'material:v1',
    title: '人物心理分析',
    questionStem: '请分析人物选择沉默的原因。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    options: [],
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['处境', '压力'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: [{
      itemId: 'rubric-1',
      name: '结合文本分析原因',
      description: '指出人物处境并解释沉默原因。',
      abilityId: 'analysis',
      importance: 'critical',
      required: true,
      evidenceRequirement: { requireTextEvidence: true, requireExplanation: true },
      acceptedSignals: ['处境', '压力'],
    }],
    minimumAnswerRequirement: {
      minLength: 30,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'analysis',
      supportingAbilityIds: ['comprehension'],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: {
      sourceType: 'ai_assisted',
      description: 'training task compatibility fixture',
    },
    tags: ['material_scope:full_text', 'observation_task:task-1'],
  };
}

void main();
