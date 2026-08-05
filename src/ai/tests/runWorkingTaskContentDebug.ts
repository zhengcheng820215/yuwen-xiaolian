import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
} from '../agents/questionResourceAdmissionAgent.ts';
import {
  WorkingTaskContentConflictError,
  createWorkingTaskContentInputFromDraft,
  getWorkingTaskContentConflictDetails,
  getWorkingTaskContentState,
  hasWorkingTaskContentChanges,
  rebaseWorkingTaskContent,
  saveWorkingTaskContent,
} from '../agents/workingTaskContentService.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import { InMemoryWorkingTaskContentRepository } from '../repositories/inMemoryWorkingTaskContentRepository.ts';
import {
  calculateQuestionEditableFieldsHash,
  extractQuestionEditableFields,
  migrateWorkingTaskContent,
  type QuestionEditableFields,
  type TrainingTaskEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import type {
  PrimaryAbilityId,
  QuestionResourceRubricItem,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';

const NOW = '2026-08-04T10:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 repeated saves overwrite one working record', run: caseRepeatedSave },
  { name: '02 working save never mutates formal resource state', run: caseFormalBoundary },
  { name: '03 independent tasks keep isolated working content', run: caseTaskIsolation },
  { name: '04 normalized equivalent content keeps one hash', run: caseStableHash },
  { name: '05 changed content is detected against base revision', run: caseChangedContent },
  { name: '06 refresh recovery returns a complete working record', run: caseRecovery },
  { name: '07 stale base revision becomes an explicit conflict', run: caseRevisionConflict },
  { name: '08 repository values are defensive clones', run: caseDefensiveClone },
  { name: '09 active draft replacement becomes an explicit conflict', run: caseActiveDraftConflict },
  { name: '10 conflict rebase preserves chosen working content', run: caseConflictRebase },
  { name: '11 legacy v1 records migrate without losing working content', run: caseLegacyMigration },
  { name: '12 production draft tags resolve the real training task identity', run: caseProductionIdentity },
  { name: '13 task-card fields participate in the working content hash', run: caseTaskCardContent },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log('Working Task Content P0 Debug');
  console.log('='.repeat(58));

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

  console.log('-'.repeat(58));
  console.log(`Result: ${passed} / ${cases.length} PASS`);

  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseRepeatedSave(): Promise<void> {
  const fixture = await createFixture('repeat');
  let content = extractQuestionEditableFields(fixture.draft);

  for (let index = 1; index <= 10; index += 1) {
    content = { ...content, questionStem: `第 ${index} 次修改后的题干。` };
    await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
      ...createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId),
      content,
      savedAt: `2026-08-04T10:00:${String(index).padStart(2, '0')}.000Z`,
    });
  }

  const records = await fixture.workingRepo.list();
  assert(records.length === 1, 'Repeated saves created duplicate working records.');
  assert(records[0]?.content.questionStem === '第 10 次修改后的题干。', 'Latest working content was not preserved.');
  assert((await fixture.questionRepo.getDraft(fixture.draft.draftId))?.revision === 1, 'Working save created a question revision.');
}

async function caseFormalBoundary(): Promise<void> {
  const fixture = await createFixture('boundary');
  const before = await formalSnapshot(fixture.questionRepo);
  const content = {
    ...extractQuestionEditableFields(fixture.draft),
    questionStem: '仅保存到工作区的新题干。',
  };

  await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
    ...createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId),
    content,
    savedAt: NOW,
  });

  const after = await formalSnapshot(fixture.questionRepo);
  assert(after === before, 'Working save mutated draft, review, formal version, or registry state.');
}

async function caseTaskIsolation(): Promise<void> {
  const questionRepo = new InMemoryQuestionResourceAdmissionRepository();
  const workingRepo = new InMemoryWorkingTaskContentRepository();
  await seedMaterial(questionRepo);
  const first = await createDraft(questionRepo, 'first');
  const second = await createDraft(questionRepo, 'second');

  await saveWorkingTaskContent(workingRepo, questionRepo, {
    ...createWorkingTaskContentInputFromDraft(first, first.resourceId),
    content: { ...extractQuestionEditableFields(first), questionStem: '任务一工作内容。' },
  });
  await saveWorkingTaskContent(workingRepo, questionRepo, {
    ...createWorkingTaskContentInputFromDraft(second, second.resourceId),
    content: { ...extractQuestionEditableFields(second), questionStem: '任务二工作内容。' },
  });

  assert((await workingRepo.list()).length === 2, 'Independent tasks did not create independent working records.');
  assert((await workingRepo.get(first.taskId))?.content.questionStem === '任务一工作内容。', 'Task one content leaked.');
  assert((await workingRepo.get(second.taskId))?.content.questionStem === '任务二工作内容。', 'Task two content leaked.');
}

async function caseStableHash(): Promise<void> {
  const fixture = await createFixture('hash');
  const content = extractQuestionEditableFields(fixture.draft);
  const equivalent: QuestionEditableFields = {
    ...content,
    questionStem: `  ${content.questionStem}\r\n   `,
    tags: [...content.tags].reverse().concat(content.tags[0]!),
  };

  assert(
    calculateQuestionEditableFieldsHash(content) === calculateQuestionEditableFieldsHash(equivalent),
    'Equivalent whitespace or tag order produced a different hash.',
  );
}

async function caseChangedContent(): Promise<void> {
  const fixture = await createFixture('changed');
  const base = extractQuestionEditableFields(fixture.draft);
  const working = await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
    ...createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId),
    content: { ...base, questionStem: `${base.questionStem} 请补充理由。` },
  });

  assert(hasWorkingTaskContentChanges(working, base), 'Changed working content was treated as unchanged.');
}

async function caseRecovery(): Promise<void> {
  const fixture = await createFixture('recovery');
  const saved = await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
    ...createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId),
    content: { ...extractQuestionEditableFields(fixture.draft), title: '刷新后恢复的标题' },
    savedAt: NOW,
  });
  const recovered = await getWorkingTaskContentState(
    fixture.workingRepo,
    fixture.questionRepo,
    fixture.draft.taskId,
  );

  assert(recovered.status === 'current', 'Saved working content was not recoverable.');
  assert(recovered.workingContent.workingContentHash === saved.workingContentHash, 'Recovered content hash changed.');
  assert(recovered.workingContent.baseContentHash.length > 0, 'Base content hash was not persisted.');
  assert(recovered.workingContent.content.title === '刷新后恢复的标题', 'Recovered content was incomplete.');
}

async function caseRevisionConflict(): Promise<void> {
  const fixture = await createFixture('conflict');
  const input = createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId);
  await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, input);
  await fixture.questionRepo.saveDraft({
    ...fixture.draft,
    revision: fixture.draft.revision + 1,
    updatedAt: '2026-08-04T11:00:00.000Z',
  });

  const state = await getWorkingTaskContentState(
    fixture.workingRepo,
    fixture.questionRepo,
    fixture.draft.taskId,
  );
  assert(
    state.status === 'base_revision_conflict' &&
    state.reason === 'revision_changed' &&
    state.activeRevision === 2,
    'Stale base revision was not projected as a conflict.',
  );

  try {
    await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, input);
  } catch (error) {
    assert(error instanceof WorkingTaskContentConflictError, 'Conflict used the wrong error type.');
    assert(error.actualRevision === 2, 'Conflict did not report the current revision.');
    return;
  }
  throw new Error('Expected stale working save to be rejected.');
}

async function caseDefensiveClone(): Promise<void> {
  const fixture = await createFixture('clone');
  const saved = await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
    ...createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId),
    content: extractQuestionEditableFields(fixture.draft),
  });
  saved.content.title = '外部篡改';

  assert((await fixture.workingRepo.get(fixture.draft.taskId))?.content.title !== '外部篡改', 'Repository leaked mutable state.');
}

async function caseActiveDraftConflict(): Promise<void> {
  const fixture = await createFixture('active-switch');
  await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
    ...createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId),
    content: { ...extractQuestionEditableFields(fixture.draft), title: '保留中的工作标题' },
  });
  await createStructuredQuestionDraft(fixture.questionRepo, {
    ...draftInput('active-switch-next'),
    resourceId: fixture.draft.resourceId,
    taskId: fixture.draft.taskId,
    now: '2026-08-04T12:00:00.000Z',
  });

  const details = await getWorkingTaskContentConflictDetails(
    fixture.workingRepo,
    fixture.questionRepo,
    fixture.draft.taskId,
  );
  assert(details?.state.reason === 'active_draft_changed', 'Active draft replacement was not detected.');
  assert(details?.activeContent?.title === '人物心理推断', 'Conflict details omitted active formal content.');
  assert(details?.state.workingContent.content.title === '保留中的工作标题', 'Conflict details lost working content.');
}

async function caseConflictRebase(): Promise<void> {
  const fixture = await createFixture('rebase');
  const workingTitle = '人工重新应用后的标题';
  await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
    ...createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId),
    content: { ...extractQuestionEditableFields(fixture.draft), title: workingTitle },
  });
  const active = await createStructuredQuestionDraft(fixture.questionRepo, {
    ...draftInput('rebase-next'),
    resourceId: fixture.draft.resourceId,
    taskId: fixture.draft.taskId,
    now: '2026-08-04T12:30:00.000Z',
  });
  const rebased = await rebaseWorkingTaskContent(
    fixture.workingRepo,
    fixture.questionRepo,
    {
      trainingTaskId: fixture.draft.taskId,
      questionLineageId: fixture.lineageId,
      content: { ...extractQuestionEditableFields(active), title: workingTitle },
    },
  );
  assert(rebased.baseDraftId === active.draftId, 'Rebase did not bind the active draft.');
  assert(rebased.content.title === workingTitle, 'Rebase did not preserve manually applied content.');
  assert((await getWorkingTaskContentState(
    fixture.workingRepo,
    fixture.questionRepo,
    fixture.draft.taskId,
  )).status === 'current', 'Rebased working content remained conflicted.');
}

async function caseLegacyMigration(): Promise<void> {
  const fixture = await createFixture('legacy');
  const content = extractQuestionEditableFields(fixture.draft);
  const contentHash = calculateQuestionEditableFieldsHash(content);
  const migrated = migrateWorkingTaskContent({
    trainingTaskId: fixture.draft.taskId,
    questionLineageId: fixture.lineageId,
    baseDraftId: fixture.draft.draftId,
    baseRevision: fixture.draft.revision,
    content,
    contentHash,
    savedAt: NOW,
    schemaVersion: 'working-task-content-v1',
  });
  assert(migrated.schemaVersion === 'working-task-content-v2', 'Legacy schema did not migrate to v2.');
  assert(migrated.workingContentHash === contentHash, 'Legacy working hash was lost.');
  assert(migrated.baseContentHash === contentHash, 'Legacy base hash fallback was not created.');
}

async function caseProductionIdentity(): Promise<void> {
  const fixture = await createFixture('production-identity');
  const trainingTaskId = 'material-observation-task-production-identity';
  const productionDraft = await createStructuredQuestionDraft(fixture.questionRepo, {
    ...draftInput('production-shape'),
    taskId: `question-${trainingTaskId}`,
    resourceId: `resource-${trainingTaskId}`,
    tags: ['阅读理解', `observation_task:${trainingTaskId}`],
    now: '2026-08-04T13:00:00.000Z',
  });
  const input = createWorkingTaskContentInputFromDraft(
    productionDraft,
    productionDraft.resourceId,
  );
  assert(input.trainingTaskId === trainingTaskId, 'Production tag did not resolve the training task identity.');
  await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
    ...input,
    content: { ...input.content, title: '真实生产形态工作内容' },
  });
  assert(
    (await getWorkingTaskContentState(
      fixture.workingRepo,
      fixture.questionRepo,
      trainingTaskId,
    )).status === 'current',
    'Production-shaped draft was rejected by the working content identity boundary.',
  );
}

async function caseTaskCardContent(): Promise<void> {
  const fixture = await createFixture('task-card');
  const questionContent = extractQuestionEditableFields(fixture.draft);
  const taskContent = taskEditableFields();
  const saved = await saveWorkingTaskContent(fixture.workingRepo, fixture.questionRepo, {
    ...createWorkingTaskContentInputFromDraft(fixture.draft, fixture.lineageId),
    content: questionContent,
    taskContent,
  });
  assert(
    hasWorkingTaskContentChanges(saved, questionContent),
    'Task-card changes were omitted from the working content hash.',
  );
  assert(
    !hasWorkingTaskContentChanges(saved, questionContent, taskContent),
    'Equivalent task-card content was treated as changed.',
  );
}

function taskEditableFields(): TrainingTaskEditableFields {
  return {
    primaryDimension: 'character',
    abilityId: 'inference',
    focusDisplayName: '人物心理推断',
    focusDefinition: '根据动作推断人物心理',
    questionStem: '父亲为什么把树叶夹回书中？',
    expectedStudentAction: '提取动作并说明心理。',
    designReason: '训练证据与推断之间的关系。',
    taskRole: 'diagnosis',
    difficulty: 'intermediate',
    anchorType: 'paragraph_range',
    startParagraph: 1,
    endParagraph: 1,
    supportingAbilityIdsText: 'extraction, comprehension',
    comparisonGroupId: '',
    assessmentMode: 'reasoning_chain',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    acceptedKeywordsText: '树叶, 回忆',
    semanticEquivalentAllowed: true,
    minLength: 12,
    rubric: [{
      localId: 'rubric-1',
      name: '文本依据',
      abilityId: 'inference',
      description: '指出动作与心理之间的关系。',
      acceptedSignalsText: '引用动作, 说明心理',
    }],
    calibrationCases: [{
      localId: 'case-1',
      category: 'qualified',
      answerText: '父亲珍惜与树叶有关的回忆。',
    }],
  };
}

async function createFixture(suffix: string) {
  const questionRepo = new InMemoryQuestionResourceAdmissionRepository();
  const workingRepo = new InMemoryWorkingTaskContentRepository();
  await seedMaterial(questionRepo);
  const draft = await createDraft(questionRepo, suffix);
  return {
    questionRepo,
    workingRepo,
    draft,
    lineageId: draft.resourceId,
  };
}

async function seedMaterial(repo: InMemoryQuestionResourceAdmissionRepository): Promise<void> {
  await createQuestionMaterial(repo, {
    materialId: 'material-working-content',
    materialVersionId: 'material-working-content:v1',
    versionNumber: 1,
    title: '工作区测试材料',
    content: '父亲整理书柜时，从旧书中发现一片树叶，又把它小心地夹回原处。',
    source: {
      sourceType: 'manual',
      description: 'Working content P0 fixture.',
      copyrightNote: 'Synthetic content for internal validation.',
    },
    createdAt: NOW,
  });
}

async function createDraft(
  repo: InMemoryQuestionResourceAdmissionRepository,
  suffix: string,
): Promise<StructuredQuestionDraft> {
  return createStructuredQuestionDraft(repo, draftInput(suffix));
}

function draftInput(suffix: string): CreateStructuredQuestionDraftInput {
  return {
    draftId: `draft-working-${suffix}`,
    resourceId: `resource-working-${suffix}`,
    taskId: `task-working-${suffix}`,
    materialVersionId: 'material-working-content:v1',
    title: '人物心理推断',
    questionStem: '父亲为什么把树叶小心地夹回原处？请结合文本说明。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['树叶', '回忆', '珍惜'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: validRubric('inference'),
    minimumAnswerRequirement: {
      minLength: 12,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'inference',
      supportingAbilityIds: ['extraction', 'comprehension'],
      prerequisiteAbilityIds: ['comprehension'],
      taskRole: 'diagnosis',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: {
      sourceType: 'manual',
      description: 'Working content P0 fixture.',
      copyrightNote: 'Synthetic content for internal validation.',
    },
    tags: ['阅读理解', '人物心理', '文本依据'],
    now: NOW,
  };
}

function validRubric(abilityId: PrimaryAbilityId): QuestionResourceRubricItem[] {
  return [{
    itemId: 'evidence',
    name: '文本依据',
    description: '指出与判断相关的文本动作或细节。',
    abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: { requireTextEvidence: true },
    acceptedSignals: ['引用动作', '指出细节'],
  }];
}

async function formalSnapshot(repo: InMemoryQuestionResourceAdmissionRepository): Promise<string> {
  return JSON.stringify({
    drafts: await repo.listDrafts(),
    reviews: await repo.listReviews(),
    versions: await repo.listVersions(),
    registry: await repo.listRegistryEntries(),
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
