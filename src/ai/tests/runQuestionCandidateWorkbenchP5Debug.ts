import assert from 'node:assert/strict';
import {
  QuestionCandidateCorrectionError,
  QuestionCandidateCorrectionService,
} from '../agents/questionCandidateCorrectionService.ts';
import { saveWorkingTaskContent } from '../agents/workingTaskContentService.ts';
import { createStructuredQuestionDraft } from '../agents/questionResourceAdmissionAgent.ts';
import { InMemoryQuestionCandidateRepository } from
  '../repositories/inMemoryQuestionCandidateRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import { InMemoryWorkingTaskContentRepository } from
  '../repositories/inMemoryWorkingTaskContentRepository.ts';
import {
  calculateQuestionEditableFieldsHash,
  extractQuestionEditableFields,
  type QuestionEditableFields,
  type TrainingTaskEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import {
  createQuestionCandidate,
  type CandidateRuntimeContext,
} from '../schemas/questionCandidate.schema.ts';
import { resolveCandidatePanelProjection } from
  '../../pages/questionCandidateWorkbenchState.ts';

const NOW = '2026-08-05T14:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 correction requires an authorized role', run: correctionRequiresPermission },
  { name: '02 correction creates immutable candidate and audit', run: correctionCreatesAudit },
  { name: '03 correction retry is idempotent', run: correctionRetryIsIdempotent },
  { name: '04 current working content migrates without changing draft', run: migrationCreatesCandidate },
  { name: '05 unchanged working content is cleared', run: unchangedMigrationClearsWorking },
  { name: '06 base revision conflict preserves working content', run: conflictPreservesWorking },
  { name: '07 task-level changes enter protected resolution', run: taskLevelChangesStayProtected },
  { name: '08 migration retry does not duplicate candidate', run: migrationRetryIsIdempotent },
  { name: '09 migration projection exposes loading state', run: migrationProjectionIsBusy },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Question Candidate Workbench P5 Debug');
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

async function correctionRequiresPermission(): Promise<void> {
  const fixture = await createFixture();
  await expectCorrectionError(
    () => fixture.service.createExceptionCorrectionCandidate({
      ...correctionInput(fixture),
      permissionRole: 'content_editor' as never,
    }),
    'CORRECTION_FORBIDDEN',
  );
  assert.equal((await fixture.candidates.listCandidates('task-1')).length, 1);
  assert.equal((await fixture.candidates.listCorrectionRecords()).length, 0);
}

async function correctionCreatesAudit(): Promise<void> {
  const fixture = await createFixture();
  const result = await fixture.service.createExceptionCorrectionCandidate(correctionInput(fixture));
  assert.equal(result.candidate.candidateType, 'exception_corrected');
  assert.equal(result.candidate.status, 'ready');
  assert.deepEqual(result.candidate.changedFields, ['questionStem']);
  assert.equal(result.correctionRecord.candidateId, result.candidate.candidateId);
  assert.equal(result.correctionRecord.reasonCode, 'typo');
  assert.equal((await fixture.candidates.listCorrectionRecords()).length, 1);
  assert.equal((await fixture.resources.listDrafts()).length, 1);
  assert.equal((await requireDraft(fixture)).revision, 1);
}

async function correctionRetryIsIdempotent(): Promise<void> {
  const fixture = await createFixture();
  const input = correctionInput(fixture);
  const first = await fixture.service.createExceptionCorrectionCandidate(input);
  const second = await fixture.service.createExceptionCorrectionCandidate(input);
  assert.deepEqual(second, first);
  assert.equal((await fixture.candidates.listCandidates('task-1')).length, 2);
  assert.equal((await fixture.candidates.listCorrectionRecords()).length, 1);
}

async function migrationCreatesCandidate(): Promise<void> {
  const fixture = await createFixture();
  await saveWorking(fixture, { questionStem: '请分析人物保持沉默的原因。' });
  const before = await requireDraft(fixture);
  const result = await fixture.service.migrateWorkingTaskContent(migrationInput(fixture));
  assert.equal(result.status, 'migrated');
  assert.equal(await fixture.working.get('task-1'), null);
  assert.equal((await requireDraft(fixture)).revision, before.revision);
  assert.equal((await fixture.candidates.listCorrectionRecords()).length, 1);
}

async function unchangedMigrationClearsWorking(): Promise<void> {
  const fixture = await createFixture();
  await saveWorking(fixture);
  const result = await fixture.service.migrateWorkingTaskContent(migrationInput(fixture));
  assert.equal(result.status, 'no_changes');
  assert.equal(await fixture.working.get('task-1'), null);
  assert.equal((await fixture.candidates.listCandidates('task-1')).length, 1);
}

async function conflictPreservesWorking(): Promise<void> {
  const fixture = await createFixture();
  await saveWorking(fixture, { questionStem: '旧工作区中的修改。' });
  const draft = await requireDraft(fixture);
  await fixture.resources.saveDraft({ ...draft, revision: 2, updatedAt: NOW });
  const result = await fixture.service.migrateWorkingTaskContent(migrationInput(fixture));
  assert.equal(result.status, 'base_revision_conflict');
  assert(await fixture.working.get('task-1'));
  assert.equal((await fixture.candidates.listCorrectionRecords()).length, 0);
}

async function taskLevelChangesStayProtected(): Promise<void> {
  const fixture = await createFixture();
  await saveWorking(
    fixture,
    { questionStem: '包含任务级修改的工作内容。' },
    taskContentFixture(),
  );
  const result = await fixture.service.migrateWorkingTaskContent(migrationInput(fixture));
  assert.equal(result.status, 'requires_protected_resolution');
  assert(await fixture.working.get('task-1'));
  assert.equal((await fixture.candidates.listCorrectionRecords()).length, 0);
}

async function migrationRetryIsIdempotent(): Promise<void> {
  const fixture = await createFixture();
  await saveWorking(fixture, { questionStem: '迁移重试测试。' });
  const input = migrationInput(fixture);
  const first = await fixture.service.migrateWorkingTaskContent(input);
  const second = await fixture.service.migrateWorkingTaskContent(input);
  assert.deepEqual(second, first);
  assert.equal((await fixture.candidates.listCorrectionRecords()).length, 1);
  assert.equal((await fixture.candidates.listCandidates('task-1')).length, 2);
}

async function migrationProjectionIsBusy(): Promise<void> {
  const fixture = await createFixture();
  const candidates = await fixture.candidates.listCandidates('task-1');
  const projection = resolveCandidatePanelProjection({
    candidates,
    context: fixture.context,
    operation: 'migrating',
    adoption: { enabled: true },
    workingStatus: 'saved',
  });
  assert.equal(projection.busy, true);
  assert.equal(projection.showsLegacyRecovery, true);
  assert.equal(projection.adoption.enabled, false);
}

async function createFixture() {
  const candidates = new InMemoryQuestionCandidateRepository();
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const working = new InMemoryWorkingTaskContentRepository();
  const draft = await createStructuredQuestionDraft(resources, {
    ...contentFixture(),
    draftId: 'draft-task-1',
    resourceId: 'question-task-1',
    taskId: 'task-1',
    now: NOW,
  });
  const context = contextForDraft(draft);
  const candidate = await candidates.saveCandidate(createQuestionCandidate({
    candidateId: 'candidate-1',
    generationCommandId: 'generate:candidate-1',
    generationCommandFingerprint: 'fingerprint:candidate-1',
    trainingTaskId: 'task-1',
    candidateType: 'initial',
    basedOnDraftId: draft.draftId,
    basedOnRevision: draft.revision,
    basedOnContentHash: context.activeDraftContentHash,
    content: contentFixture(),
    generationReason: 'P5 correction fixture',
    changedFields: ['questionStem'],
    allowedFields: ['questionStem'],
    lockedFields: ['abilityTarget', 'materialScope'],
    generationContext: {
      modelId: 'debug-model',
      promptVersion: 'p5-debug-v1',
      promptHash: 'p5-debug-hash',
      ruleVersion: 'p5-debug-rule-v1',
      materialVersionId: context.materialVersionId,
      observationPlanVersion: context.observationPlanVersion,
      trainingTaskVersion: context.trainingTaskVersion,
      generatedAt: NOW,
    },
    status: 'ready',
    createdAt: NOW,
  }));
  const service = new QuestionCandidateCorrectionService(candidates, resources, working, () => NOW);
  return { candidates, resources, working, draft, context, candidate, service };
}

function correctionInput(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return {
    trainingTaskId: 'task-1',
    targetType: 'candidate' as const,
    targetId: fixture.candidate.candidateId,
    correctedContent: {
      ...fixture.candidate.content,
      questionStem: '请分析人物保持沉默的原因。',
    },
    reasonCode: 'typo' as const,
    note: '修正题干用词。',
    correctedBy: 'reviewer-1',
    permissionRole: 'quality_reviewer' as const,
    expectedContext: fixture.context,
    idempotencyKey: 'candidate:correct:p5',
  };
}

function migrationInput(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return {
    trainingTaskId: 'task-1',
    correctedBy: 'reviewer-1',
    permissionRole: 'quality_reviewer' as const,
    expectedContext: fixture.context,
    idempotencyKey: 'candidate:migrate:p5',
  };
}

async function saveWorking(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  changes: Partial<QuestionEditableFields> = {},
  taskContent?: TrainingTaskEditableFields,
): Promise<void> {
  const draft = await requireDraft(fixture);
  await saveWorkingTaskContent(fixture.working, fixture.resources, {
    trainingTaskId: 'task-1',
    questionLineageId: draft.resourceId,
    baseDraftId: draft.draftId,
    baseRevision: draft.revision,
    content: { ...extractQuestionEditableFields(draft), ...changes },
    taskContent,
    savedAt: NOW,
  });
}

function contextForDraft(draft: Awaited<ReturnType<typeof createStructuredQuestionDraft>>): CandidateRuntimeContext {
  return {
    materialVersionId: 'material:v1',
    observationPlanVersion: 1,
    trainingTaskVersion: 1,
    activeDraftId: draft.draftId,
    activeDraftRevision: draft.revision,
    activeDraftContentHash: calculateQuestionEditableFieldsHash(extractQuestionEditableFields(draft)),
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
    source: { sourceType: 'ai_assisted', description: 'P5 fixture' },
    tags: ['material_scope:full_text', 'observation_task:task-1'],
  };
}

function taskContentFixture(): TrainingTaskEditableFields {
  return {
    primaryDimension: '人物',
    abilityId: 'analysis',
    focusDisplayName: '人物心理',
    focusDefinition: '分析人物行为背后的心理原因。',
    questionStem: '请分析人物选择沉默的原因。',
    expectedStudentAction: '结合材料解释原因。',
    designReason: '训练人物心理分析。',
    taskRole: 'training',
    difficulty: 'intermediate',
    anchorType: 'full_text',
    supportingAbilityIdsText: 'comprehension',
    comparisonGroupId: '',
    assessmentMode: 'reasoning_chain',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    acceptedKeywordsText: '处境，压力',
    semanticEquivalentAllowed: true,
    minLength: 30,
    rubric: [],
    calibrationCases: [],
  };
}

async function requireDraft(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const draft = await fixture.resources.getDraft(fixture.draft.draftId);
  assert(draft);
  return draft;
}

async function expectCorrectionError(run: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof QuestionCandidateCorrectionError);
    assert.equal(error.code, code);
    return;
  }
  throw new Error(`Expected correction error ${code}.`);
}

void main();
