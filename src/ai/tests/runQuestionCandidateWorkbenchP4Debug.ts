import assert from 'node:assert/strict';
import { QuestionResourceCandidateAdoptionGateway } from
  '../agents/questionCandidateAdoptionGateway.ts';
import {
  adoptQuestionCandidateAndPublish,
  adoptQuestionCandidateAndRunChecks,
} from
  '../agents/questionCandidateAdoptionWorkflow.ts';
import {
  QuestionCandidateConflictError,
  QuestionCandidateService,
  type QuestionCandidateContextGateway,
} from '../agents/questionCandidateService.ts';
import { InMemoryQuestionCandidateRepository } from
  '../repositories/inMemoryQuestionCandidateRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  createQuestionCandidate,
  type CandidateRuntimeContext,
  type QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  extractQuestionEditableFields,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import { createStructuredQuestionDraft } from
  '../agents/questionResourceAdmissionAgent.ts';
import { resolveCandidatePanelProjection } from
  '../../pages/questionCandidateWorkbenchState.ts';

const NOW = '2026-08-05T12:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 first adoption creates revision one', run: firstAdoptionCreatesRevisionOne },
  { name: '02 editable adoption advances exactly one revision', run: editableAdoptionAdvancesOneRevision },
  { name: '03 adoption retry is idempotent', run: adoptionRetryIsIdempotent },
  { name: '04 interrupted receipt write recovers the existing revision', run: interruptedAdoptionRecovers },
  { name: '05 validation failure retains the adopted revision', run: validationFailureRetainsRevision },
  { name: '06 assessment retry does not create another revision', run: assessmentRetryDoesNotAdvanceRevision },
  { name: '07 reviewed draft remains unchanged and creates a successor', run: reviewedDraftCreatesSuccessor },
  { name: '08 unchanged and stale candidates cannot create revisions', run: conflictsDoNotCreateRevision },
  { name: '09 adopting projection exposes loading feedback', run: adoptingProjectionIsBusy },
  { name: '10 candidate runtime hint policy is normalized', run: candidateHintPolicyIsNormalized },
  { name: '11 conflicting candidate hint policy is rejected', run: conflictingHintPolicyIsRejected },
  { name: '12 clean adoption completes publication', run: cleanAdoptionCompletesPublication },
  { name: '13 warnings interrupt before review', run: warningsInterruptBeforeReview },
  { name: '14 publication failure retains completed review', run: publicationFailureRetainsReview },
  { name: '15 compatibility candidate reuses matching revision', run: compatibilityCandidateReusesMatchingRevision },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Question Candidate Workbench P4 Debug');
  console.log('='.repeat(72));
  for (const item of cases) {
    try {
      await item.run();
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      failures.push(`${item.name}: ${message}`);
      console.log(`FAIL ${item.name}: ${message}`);
    }
  }
  console.log('-'.repeat(72));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function firstAdoptionCreatesRevisionOne(): Promise<void> {
  const fixture = await createFixture();
  const result = await fixture.service.adoptTaskCandidate(adoptInput(fixture.candidate, fixture.context.current));
  assert.equal(result.revision, 1);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
  assert.equal((await fixture.candidates.getCandidate(fixture.candidate.candidateId))?.status, 'adopted');
}

async function editableAdoptionAdvancesOneRevision(): Promise<void> {
  const fixture = await createFixture();
  const first = await fixture.service.adoptTaskCandidate(adoptInput(fixture.candidate, fixture.context.current));
  const base = await requireDraft(fixture.resources, first.draftId);
  fixture.context.current = contextForDraft(base);
  const nextCandidate = await saveCandidate(
    fixture.candidates,
    'candidate-2',
    { ...contentFixture(), questionStem: '请结合材料分析人物沉默的两个原因。' },
    fixture.context.current,
  );
  const next = await fixture.service.adoptTaskCandidate(adoptInput(
    nextCandidate,
    fixture.context.current,
    'candidate:adopt:2',
  ));
  assert.equal(next.draftId, first.draftId);
  assert.equal(next.revision, 2);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
}

async function adoptionRetryIsIdempotent(): Promise<void> {
  const fixture = await createFixture();
  const input = adoptInput(fixture.candidate, fixture.context.current);
  const first = await fixture.service.adoptTaskCandidate(input);
  const second = await fixture.service.adoptTaskCandidate(input);
  assert.deepEqual(second, first);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
  assert.equal((await fixture.candidates.listDecisionEvents(fixture.candidate.candidateId)).length, 1);
}

async function interruptedAdoptionRecovers(): Promise<void> {
  const fixture = await createFixture();
  const gateway = new QuestionResourceCandidateAdoptionGateway(fixture.resources);
  const persisted = await gateway.adoptCandidate({
    candidate: fixture.candidate,
    expectedContext: fixture.context.current,
    idempotencyKey: 'candidate:adopt:1',
    adoptedAt: NOW,
  });
  assert.equal((await fixture.candidates.getCandidate(fixture.candidate.candidateId))?.status, 'ready');
  const recovered = await fixture.service.adoptTaskCandidate(adoptInput(fixture.candidate, fixture.context.current));
  assert.deepEqual(recovered, persisted);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
  assert.equal((await fixture.candidates.getCandidate(fixture.candidate.candidateId))?.status, 'adopted');
}

async function validationFailureRetainsRevision(): Promise<void> {
  const fixture = await createFixture();
  let assessmentCalls = 0;
  const result = await adoptQuestionCandidateAndRunChecks(
    adoptInput(fixture.candidate, fixture.context.current),
    {
      service: fixture.service,
      async validate() { return { passed: false }; },
      async assess() { assessmentCalls += 1; },
    },
  );
  assert.equal(result.validation.status, 'completed');
  assert.equal(result.validation.passed, false);
  assert.equal(result.assessment.status, 'blocked');
  assert.equal(result.nextAction, 'resolve_validation');
  assert.equal(assessmentCalls, 0);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
}

async function assessmentRetryDoesNotAdvanceRevision(): Promise<void> {
  const fixture = await createFixture();
  const input = adoptInput(fixture.candidate, fixture.context.current);
  const failed = await adoptQuestionCandidateAndRunChecks(input, {
    service: fixture.service,
    async validate() { return { passed: true }; },
    async assess() { throw new Error('semantic provider unavailable'); },
  });
  assert.equal(failed.nextAction, 'retry_assessment');
  const retried = await adoptQuestionCandidateAndRunChecks(input, {
    service: fixture.service,
    async validate() { return { passed: true }; },
    async assess() { return { status: 'completed' }; },
  });
  assert.equal(retried.nextAction, 'ready_for_confirmation');
  assert.equal(retried.adoption.revision, failed.adoption.revision);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
}

async function reviewedDraftCreatesSuccessor(): Promise<void> {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const source = await createStructuredQuestionDraft(resources, {
    ...contentFixture(),
    draftId: 'reviewed-draft',
    resourceId: 'question-task-1',
    taskId: 'task-1',
    now: NOW,
  });
  await resources.saveDraft({ ...source, status: 'reviewed' });
  const context = contextForDraft({ ...source, status: 'reviewed' });
  const candidates = new InMemoryQuestionCandidateRepository();
  const candidate = await saveCandidate(
    candidates,
    'candidate-successor',
    { ...contentFixture(), questionStem: '请比较人物前后行为并解释变化原因。' },
    context,
  );
  const service = createService(candidates, resources, new MutableContext(context));
  const adopted = await service.adoptTaskCandidate(adoptInput(candidate, context, 'candidate:adopt:successor'));
  const original = await requireDraft(resources, source.draftId);
  assert.equal(original.status, 'reviewed');
  assert.equal(original.revision, 1);
  assert.notEqual(adopted.draftId, source.draftId);
  assert.equal((await resources.listDrafts()).length, 2);
}

async function conflictsDoNotCreateRevision(): Promise<void> {
  const fixture = await createFixture();
  const first = await fixture.service.adoptTaskCandidate(adoptInput(fixture.candidate, fixture.context.current));
  const base = await requireDraft(fixture.resources, first.draftId);
  fixture.context.current = contextForDraft(base);
  const unchanged = await saveCandidate(
    fixture.candidates,
    'candidate-unchanged',
    extractQuestionEditableFields(base),
    fixture.context.current,
  );
  await expectConflict(
    () => fixture.service.adoptTaskCandidate(adoptInput(
      unchanged,
      fixture.context.current,
      'candidate:adopt:unchanged',
    )),
    'CANDIDATE_NO_CHANGES',
  );
  assert.equal((await requireDraft(fixture.resources, base.draftId)).revision, 1);

  const changed = await saveCandidate(
    fixture.candidates,
    'candidate-stale',
    { ...contentFixture(), questionStem: '这是一个基于旧版本的候选。' },
    fixture.context.current,
  );
  fixture.context.current = { ...fixture.context.current, activeDraftRevision: 2 };
  await expectConflict(
    () => fixture.service.adoptTaskCandidate(adoptInput(
      changed,
      contextForDraft(base),
      'candidate:adopt:stale',
    )),
    'CANDIDATE_CONTEXT_CONFLICT',
  );
  assert.equal((await requireDraft(fixture.resources, base.draftId)).revision, 1);
}

async function compatibilityCandidateReusesMatchingRevision(): Promise<void> {
  const fixture = await createFixture();
  const first = await fixture.service.adoptTaskCandidate(
    adoptInput(fixture.candidate, fixture.context.current),
  );
  const base = await requireDraft(fixture.resources, first.draftId);
  fixture.context.current = contextForDraft(base);
  const compatibilityCandidate = await saveCandidate(
    fixture.candidates,
    'candidate-compatibility-wrap',
    extractQuestionEditableFields(base),
    fixture.context.current,
    'training_task_compatibility_wrap',
  );

  const adopted = await fixture.service.adoptTaskCandidate(adoptInput(
    compatibilityCandidate,
    fixture.context.current,
    'candidate:adopt:compatibility-wrap',
  ));

  assert.equal(adopted.draftId, first.draftId);
  assert.equal(adopted.revision, 1);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
  assert.equal(
    (await fixture.candidates.getCandidate(compatibilityCandidate.candidateId))?.status,
    'adopted',
  );
}

async function adoptingProjectionIsBusy(): Promise<void> {
  const fixture = await createFixture();
  const projection = resolveCandidatePanelProjection({
    candidates: [fixture.candidate],
    context: fixture.context.current,
    operation: 'adopting',
    adoptionEnabled: true,
  });
  assert.equal(projection.busy, true);
  assert.equal(projection.adoption.enabled, false);
  assert.equal(projection.selectedCandidateId, fixture.candidate.candidateId);
}

async function candidateHintPolicyIsNormalized(): Promise<void> {
  const fixture = await createFixture();
  assert(fixture.candidate.content.tags.includes('hint_policy:limited_hint'));
  const adopted = await fixture.service.adoptTaskCandidate(
    adoptInput(fixture.candidate, fixture.context.current),
  );
  const draft = await requireDraft(fixture.resources, adopted.draftId);
  assert(draft.tags.includes('hint_policy:limited_hint'));
}

async function conflictingHintPolicyIsRejected(): Promise<void> {
  assert.throws(
    () => createQuestionCandidate({
      candidateId: 'candidate-conflicting-policy',
      generationCommandId: 'generate:candidate-conflicting-policy',
      generationCommandFingerprint: 'fingerprint:candidate-conflicting-policy',
      trainingTaskId: 'task-1',
      candidateType: 'initial',
      content: {
        ...contentFixture(),
        tags: [...contentFixture().tags, 'hint_policy:no_hint'],
      },
      generationReason: 'Conflicting runtime policy fixture',
      changedFields: ['questionStem'],
      allowedFields: ['questionStem'],
      lockedFields: ['abilityTarget', 'materialScope'],
      generationContext: {
        modelId: 'debug-model',
        promptVersion: 'p4-debug-v1',
        promptHash: 'p4-debug-hash',
        ruleVersion: 'p4-debug-rule-v1',
        materialVersionId: 'material:v1',
        observationPlanVersion: 1,
        trainingTaskVersion: 1,
        generatedAt: NOW,
      },
      status: 'ready',
      createdAt: NOW,
    }),
    /hint policy conflicts with task role training/,
  );
}

async function cleanAdoptionCompletesPublication(): Promise<void> {
  const fixture = await createFixture();
  const calls: string[] = [];
  const result = await adoptQuestionCandidateAndPublish(
    adoptInput(fixture.candidate, fixture.context.current),
    {
      service: fixture.service,
      async validate() { calls.push('validation'); return { passed: true }; },
      async assess() { calls.push('assessment'); return { warningCodes: [] }; },
      async submitReview() { calls.push('submit_review'); },
      async approveReview() { calls.push('approve_review'); },
      async publish() { calls.push('publication'); return { publicationStatus: 'completed' }; },
    },
  );
  assert.deepEqual(calls, [
    'validation',
    'assessment',
    'submit_review',
    'approve_review',
    'publication',
  ]);
  assert.deepEqual(result.completedStages, [
    'adopt',
    'validation',
    'assessment',
    'review',
    'publication',
  ]);
  assert.equal(result.visibleState, 'published');
  assert.equal(result.nextAction, 'published');
  assert.equal(result.review.status, 'completed');
  assert.equal(result.publication.status, 'completed');
}

async function warningsInterruptBeforeReview(): Promise<void> {
  const fixture = await createFixture();
  let reviewCalls = 0;
  let publicationCalls = 0;
  const result = await adoptQuestionCandidateAndPublish(
    adoptInput(fixture.candidate, fixture.context.current),
    {
      service: fixture.service,
      async validate() { return { passed: true }; },
      async assess() { return { warningCodes: ['difficulty_alignment_warning'] }; },
      async submitReview() { reviewCalls += 1; },
      async approveReview() { reviewCalls += 1; },
      async publish() { publicationCalls += 1; return { publicationStatus: 'completed' }; },
    },
  );
  assert.equal(result.visibleState, 'action_required');
  assert.equal(result.nextAction, 'resolve_warnings');
  assert.deepEqual(result.assessment.warningCodes, ['difficulty_alignment_warning']);
  assert.equal(result.review.status, 'not_started');
  assert.equal(result.publication.status, 'not_started');
  assert.equal(reviewCalls, 0);
  assert.equal(publicationCalls, 0);
}

async function publicationFailureRetainsReview(): Promise<void> {
  const fixture = await createFixture();
  const result = await adoptQuestionCandidateAndPublish(
    adoptInput(fixture.candidate, fixture.context.current),
    {
      service: fixture.service,
      async validate() { return { passed: true }; },
      async assess() { return { warningCodes: [] }; },
      async submitReview() {},
      async approveReview() {},
      async publish() { throw new Error('registry unavailable'); },
    },
  );
  assert.equal(result.visibleState, 'action_required');
  assert.equal(result.nextAction, 'retry_publication');
  assert.equal(result.review.status, 'completed');
  assert.equal(result.publication.status, 'failed');
  assert.match(result.publication.message || '', /registry unavailable/);
  assert.deepEqual(result.completedStages, [
    'adopt',
    'validation',
    'assessment',
    'review',
  ]);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
}

async function createFixture() {
  const candidates = new InMemoryQuestionCandidateRepository();
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const context = new MutableContext(defaultContext());
  const candidate = await saveCandidate(
    candidates,
    'candidate-1',
    contentFixture(),
    context.current,
  );
  const service = createService(candidates, resources, context);
  return { candidates, resources, context, candidate, service };
}

function createService(
  candidates: InMemoryQuestionCandidateRepository,
  resources: InMemoryQuestionResourceAdmissionRepository,
  context: MutableContext,
): QuestionCandidateService {
  return new QuestionCandidateService(
    candidates,
    { async generate() { throw new Error('Generator is not used by P4 adoption tests.'); } },
    context,
    new QuestionResourceCandidateAdoptionGateway(resources),
    () => NOW,
  );
}

class MutableContext implements QuestionCandidateContextGateway {
  current: CandidateRuntimeContext;

  constructor(current: CandidateRuntimeContext) {
    this.current = current;
  }

  async getCurrentContext(): Promise<CandidateRuntimeContext> {
    return structuredClone(this.current);
  }
}

async function saveCandidate(
  repository: InMemoryQuestionCandidateRepository,
  candidateId: string,
  content: QuestionEditableFields,
  context: CandidateRuntimeContext,
  candidateOrigin: QuestionCandidate['candidateOrigin'] = 'ai_generated',
): Promise<QuestionCandidate> {
  return repository.saveCandidate(createQuestionCandidate({
    candidateId,
    generationCommandId: `generate:${candidateId}`,
    generationCommandFingerprint: `fingerprint:${candidateId}`,
    trainingTaskId: 'task-1',
    candidateType: 'initial',
    candidateOrigin,
    basedOnDraftId: context.activeDraftId,
    basedOnRevision: context.activeDraftRevision,
    basedOnContentHash: context.activeDraftContentHash,
    content,
    generationReason: 'P4 adoption debug fixture',
    changedFields: ['questionStem'],
    allowedFields: ['questionStem'],
    lockedFields: ['abilityTarget', 'materialScope'],
    generationContext: {
      modelId: 'debug-model',
      promptVersion: 'p4-debug-v1',
      promptHash: 'p4-debug-hash',
      ruleVersion: 'p4-debug-rule-v1',
      materialVersionId: context.materialVersionId,
      observationPlanVersion: context.observationPlanVersion,
      trainingTaskVersion: context.trainingTaskVersion,
      source: candidateOrigin,
      generatedAt: NOW,
    },
    status: 'ready',
    createdAt: NOW,
  }));
}

function adoptInput(
  candidate: QuestionCandidate,
  expectedContext: CandidateRuntimeContext,
  idempotencyKey = 'candidate:adopt:1',
) {
  return {
    trainingTaskId: candidate.trainingTaskId,
    candidateId: candidate.candidateId,
    expectedContentHash: candidate.contentHash,
    expectedContext,
    idempotencyKey,
    adoptedBy: 'teacher-1',
  };
}

function defaultContext(): CandidateRuntimeContext {
  return {
    materialVersionId: 'material:v1',
    observationPlanVersion: 1,
    trainingTaskVersion: 1,
  };
}

function contextForDraft(draft: Awaited<ReturnType<InMemoryQuestionResourceAdmissionRepository['getDraft']>> & {}): CandidateRuntimeContext {
  assert(draft);
  return {
    ...defaultContext(),
    activeDraftId: draft.draftId,
    activeDraftRevision: draft.revision,
    activeDraftContentHash: calculateQuestionEditableFieldsHash(
      extractQuestionEditableFields(draft),
    ),
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
      description: 'P4 candidate adoption fixture',
    },
    tags: ['material_scope:full_text', 'observation_task:task-1'],
  };
}

async function requireDraft(
  repository: InMemoryQuestionResourceAdmissionRepository,
  draftId: string,
) {
  const draft = await repository.getDraft(draftId);
  assert(draft, `Draft ${draftId} should exist.`);
  return draft;
}

async function expectConflict(run: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof QuestionCandidateConflictError);
    assert.equal(error.code, code);
    return;
  }
  throw new Error(`Expected conflict ${code}.`);
}

void main();
