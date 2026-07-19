import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  createRevisionFromRejectedQuestionResourceDraft,
  createNextQuestionResourceVersionDraft,
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  rebuildResourceRegistry,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateResourceRegistryConsistency,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
} from '../agents/questionResourceAdmissionAgent.ts';
import type {
  PrimaryAbilityId,
  QuestionResourceRubricItem,
} from '../schemas/questionResourceAdmission.schema.ts';

type Repository = InMemoryQuestionResourceAdmissionRepository;

const NOW = '2026-07-17T10:00:00.000Z';
const LATER = '2026-07-17T11:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 valid draft passes validation', run: caseValidDraft },
  { name: '02 missing required field is blocked', run: caseMissingField },
  { name: '03 invalid ability and task role are blocked', run: caseInvalidRegistryValues },
  { name: '04 multiple choice without options is blocked', run: caseMissingOptions },
  { name: '05 open response strict single answer is blocked', run: caseOpenExactMatch },
  { name: '06 rubric ability conflict is detected', run: caseRubricConflict },
  { name: '07 validation errors prevent review submission', run: caseValidationBlocksReview },
  { name: '08 three review branches are stable', run: caseReviewBranches },
  { name: '09 only reviewed draft can freeze', run: caseOnlyReviewedFreezes },
  { name: '10 frozen snapshot matches reviewed revision', run: caseFrozenSnapshot },
  { name: '11 frozen resource is immutable', run: caseFrozenImmutable },
  { name: '12 new version does not overwrite old version', run: caseVersionDoesNotOverwrite },
  { name: '13 new frozen version supersedes previous version', run: casePreviousSuperseded },
  { name: '14 unfinished new version keeps old head active', run: caseOldHeadStaysActive },
  { name: '15 duplicate freeze is idempotent', run: caseDuplicateFreeze },
  { name: '16 stale validation cannot freeze edited draft', run: caseStaleValidation },
  { name: '17 one material supports independent tasks', run: caseSharedMaterialIndependentTasks },
  { name: '18 independent task metadata does not leak', run: caseTaskMetadataIsolation },
  { name: '19 store restores draft review and frozen version', run: caseStoreRecovery },
  { name: '20 AI-assisted draft never auto-freezes', run: caseAiDraftRequiresReview },
  { name: '21 version switch always keeps one formal head', run: caseVersionSwitchInvariant },
  { name: '22 rejected draft can create an auditable revision draft', run: caseRejectedRevisionDraft },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log('Phase 16.1A Question Resource Admission Debug');
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
    console.log('\nFailures:');
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseValidDraft(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createDraft(repo, 'valid');
  const result = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  assert(result.passed, 'Expected valid draft to pass.');
  assert(result.issues.every((issue) => issue.severity !== 'error'), 'Expected no validation errors.');
}

async function caseRejectedRevisionDraft(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const source = await createDraft(repo, 'rejected-revision');
  await validateStructuredQuestionDraft(repo, source.draftId, NOW);
  await submitQuestionResourceForReview(repo, source.draftId, NOW);
  await reviewQuestionResourceDraft(repo, {
    draftId: source.draftId,
    action: 'reject',
    reviewerId: 'reviewer-1',
    notes: 'Needs a new audited draft instead of rewriting the rejected record.',
    now: NOW,
  });

  const revision = await createRevisionFromRejectedQuestionResourceDraft(repo, {
    sourceDraftId: source.draftId,
    draftId: 'draft-rejected-revision-copy',
    now: LATER,
  });
  const rejected = await repo.getDraft(source.draftId);

  assert(rejected?.status === 'rejected', 'Original rejected draft must remain rejected.');
  assert(revision.status === 'drafted', 'Revision copy must be editable.');
  assert(revision.draftId !== source.draftId, 'Revision copy must have a new draftId.');
  assert(revision.resourceId === source.resourceId, 'Revision copy must retain resource identity.');
  assert(revision.taskId === source.taskId, 'Revision copy must retain task identity.');
  assert(revision.proposedVersionNumber === source.proposedVersionNumber, 'Revision copy must target the same proposed version.');
  assert(revision.questionStem === source.questionStem, 'Revision copy must retain question content.');
  assert(!revision.latestValidationId && !revision.latestReviewId, 'Revision copy must not inherit validation or review decisions.');
}

async function caseMissingField(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createDraft(repo, 'missing', { questionStem: '  ' });
  const result = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  assert(!result.passed, 'Missing question stem must fail.');
  assert(hasCode(result, 'content.question_stem'), 'Expected question stem error.');
}

async function caseInvalidRegistryValues(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createDraft(repo, 'invalid-registry', {
    abilityMetadata: {
      ...validAbilityMetadata(),
      abilityId: '推理' as PrimaryAbilityId,
      taskRole: 'practice' as never,
    },
  });
  const result = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  assert(!result.passed, 'Unregistered ability and task role must fail.');
  assert(hasCode(result, 'ability.main'), 'Expected ability registry error.');
  assert(hasCode(result, 'ability.task_role'), 'Expected task role registry error.');
}

async function caseMissingOptions(): Promise<void> {
  const repo = new InMemoryQuestionResourceAdmissionRepository();
  const draft = await createDraft(repo, 'missing-options', {
    materialVersionId: undefined,
    questionType: 'multiple_choice',
    responseFormat: 'single_choice',
    options: [],
    assessmentMode: 'exact_match',
    answerAcceptance: { acceptedAnswers: ['B'], normalizationRules: ['trim'] },
  });
  const result = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  assert(!result.passed && hasCode(result, 'content.options_required'), 'Missing options must fail.');
}

async function caseOpenExactMatch(): Promise<void> {
  const repo = new InMemoryQuestionResourceAdmissionRepository();
  const draft = await createDraft(repo, 'open-exact', {
    materialVersionId: undefined,
    questionType: 'open_short_answer',
    responseFormat: 'short_text',
    assessmentMode: 'exact_match',
    answerAcceptance: { acceptedAnswers: ['因为父亲怀念过去。'], semanticEquivalentAllowed: false },
  });
  const result = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  assert(!result.passed && hasCode(result, 'answer_acceptance.open_exact_match'), 'Strict open answer must fail.');
}

async function caseRubricConflict(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createDraft(repo, 'rubric-conflict', {
    rubric: validRubric('expression'),
  });
  const result = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  assert(!result.passed && hasCode(result, 'rubric.main_ability_missing'), 'Rubric conflict must fail.');
}

async function caseValidationBlocksReview(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createDraft(repo, 'review-blocked', { title: '' });
  await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  await assertRejects(
    () => submitQuestionResourceForReview(repo, draft.draftId, NOW),
    'Draft validation has not passed',
  );
}

async function caseReviewBranches(): Promise<void> {
  const repo = await repositoryWithMaterial();
  for (const action of ['approve', 'revision_required', 'reject'] as const) {
    const draft = await createDraft(repo, `review-${action}`);
    await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
    await submitQuestionResourceForReview(repo, draft.draftId, NOW);
    const review = await reviewQuestionResourceDraft(repo, {
      draftId: draft.draftId,
      action,
      reviewerId: 'reviewer-1',
      notes: `Review decision: ${action}`,
      now: NOW,
    });
    const stored = await repo.getDraft(draft.draftId);
    const expectedStatus = action === 'approve'
      ? 'reviewed'
      : action === 'reject'
        ? 'rejected'
        : 'revision_required';
    assert(review.action === action && stored?.status === expectedStatus, `Review branch failed: ${action}`);
  }
}

async function caseOnlyReviewedFreezes(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createDraft(repo, 'freeze-blocked');
  await assertRejects(
    () => freezeQuestionResourceDraft(repo, draft.draftId, NOW),
    'Only reviewed drafts can be frozen',
  );
}

async function caseFrozenSnapshot(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createReadyDraft(repo, 'snapshot');
  const result = await freezeQuestionResourceDraft(repo, draft.draftId, NOW);
  assert(result.version.questionStem === draft.questionStem, 'Frozen question stem drifted.');
  assert(result.version.validationId === draft.latestValidationId, 'Frozen validation identity drifted.');
  assert(result.version.reviewId === draft.latestReviewId, 'Frozen review identity drifted.');
}

async function caseFrozenImmutable(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createReadyDraft(repo, 'immutable');
  await freezeQuestionResourceDraft(repo, draft.draftId, NOW);
  await assertRejects(
    () => updateStructuredQuestionDraft(repo, draft.draftId, { title: 'Changed' }, LATER),
    'cannot be edited',
  );
}

async function caseVersionDoesNotOverwrite(): Promise<void> {
  const { repo, v1, v2 } = await freezeSecondVersion('no-overwrite');
  const storedV1 = await repo.getVersion(v1.resourceVersionId);
  const storedV2 = await repo.getVersion(v2.resourceVersionId);
  assert(storedV1?.questionStem !== storedV2?.questionStem, 'v2 overwrote v1 content.');
  assert(storedV1?.resourceVersionId !== storedV2?.resourceVersionId, 'Version identity was reused.');
}

async function casePreviousSuperseded(): Promise<void> {
  const { repo, v1, v2 } = await freezeSecondVersion('superseded');
  const storedV1 = await repo.getVersion(v1.resourceVersionId);
  const registry = await repo.getRegistryEntry(v2.resourceId);
  assert(storedV1?.status === 'superseded', 'v1 was not superseded.');
  assert(registry?.currentFrozenVersionId === v2.resourceVersionId, 'Registry head did not move to v2.');
}

async function caseOldHeadStaysActive(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const v1 = await createFrozenV1(repo, 'old-head');
  const v2Draft = await createNextQuestionResourceVersionDraft(repo, {
    resourceId: v1.resourceId,
    draftId: 'old-head-v2-draft',
    now: LATER,
  });
  await validateStructuredQuestionDraft(repo, v2Draft.draftId, LATER);
  await submitQuestionResourceForReview(repo, v2Draft.draftId, LATER);
  await reviewQuestionResourceDraft(repo, {
    draftId: v2Draft.draftId,
    action: 'revision_required',
    reviewerId: 'reviewer-1',
    notes: 'Please revise the explanation requirement.',
    now: LATER,
  });
  const registry = await repo.getRegistryEntry(v1.resourceId);
  assert(registry?.currentFrozenVersionId === v1.resourceVersionId, 'Unfinished v2 replaced v1 head.');
}

async function caseDuplicateFreeze(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createReadyDraft(repo, 'idempotent');
  const first = await freezeQuestionResourceDraft(repo, draft.draftId, NOW);
  const second = await freezeQuestionResourceDraft(repo, draft.draftId, LATER);
  assert(first.inserted && !second.inserted, 'Duplicate freeze did not return idempotent result.');
  assert(first.version.resourceVersionId === second.version.resourceVersionId, 'Duplicate freeze changed identity.');
  assert((await repo.listVersions(first.version.resourceId)).length === 1, 'Duplicate freeze created another version.');
}

async function caseStaleValidation(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createDraft(repo, 'stale');
  await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  await updateStructuredQuestionDraft(repo, draft.draftId, { questionStem: 'Changed after validation.' }, LATER);
  await assertRejects(
    () => submitQuestionResourceForReview(repo, draft.draftId, LATER),
    'has not been validated',
  );
}

async function caseSharedMaterialIndependentTasks(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const first = await createDraft(repo, 'shared-a', { taskId: 'task-shared-a' });
  const second = await createDraft(repo, 'shared-b', {
    taskId: 'task-shared-b',
    resourceId: 'resource-shared-b',
    abilityMetadata: validAbilityMetadata('summarization'),
    rubric: validRubric('summarization'),
  });
  assert(first.materialVersionId === second.materialVersionId, 'Tasks did not share Material Version.');
  assert(first.taskId !== second.taskId && first.resourceId !== second.resourceId, 'Task identities were merged.');
}

async function caseTaskMetadataIsolation(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const first = await createDraft(repo, 'isolation-a');
  const second = await createDraft(repo, 'isolation-b', {
    resourceId: 'resource-isolation-b',
    taskId: 'task-isolation-b',
    abilityMetadata: validAbilityMetadata('expression'),
    rubric: validRubric('expression'),
    assessmentMode: 'expression_quality',
  });
  second.rubric[0].name = 'Changed clone';
  const storedFirst = await repo.getDraft(first.draftId);
  assert(storedFirst?.abilityMetadata.abilityId === 'inference', 'Ability metadata leaked across tasks.');
  assert(storedFirst?.rubric[0].name !== 'Changed clone', 'Rubric data leaked across tasks.');
}

async function caseStoreRecovery(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createReadyDraft(repo, 'restore');
  const frozen = await freezeQuestionResourceDraft(repo, draft.draftId, NOW);
  const restoredDraft = await repo.getDraft(draft.draftId);
  const restoredValidation = await repo.getValidation(draft.latestValidationId!);
  const restoredReview = await repo.getReview(draft.latestReviewId!);
  const restoredVersion = await repo.getVersion(frozen.version.resourceVersionId);
  assert(Boolean(restoredDraft && restoredValidation && restoredReview && restoredVersion), 'Stored records were not recoverable.');
}

async function caseAiDraftRequiresReview(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const draft = await createDraft(repo, 'ai-draft', {
    source: {
      sourceType: 'ai_assisted',
      description: 'AI-assisted structured draft.',
      copyrightNote: 'Synthetic material for internal validation.',
    },
  });
  const validation = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  assert(validation.passed, 'AI-assisted draft should be structurally valid.');
  assert((await repo.listVersions(draft.resourceId)).length === 0, 'AI-assisted draft auto-froze.');
  await assertRejects(
    () => freezeQuestionResourceDraft(repo, draft.draftId, NOW),
    'Only reviewed drafts can be frozen',
  );
}

async function caseVersionSwitchInvariant(): Promise<void> {
  const repo = await repositoryWithMaterial();
  const v1 = await createFrozenV1(repo, 'switch');
  const v2Draft = await createNextQuestionResourceVersionDraft(repo, {
    resourceId: v1.resourceId,
    draftId: 'switch-v2-draft',
    now: LATER,
  });
  await validateStructuredQuestionDraft(repo, v2Draft.draftId, LATER);
  await submitQuestionResourceForReview(repo, v2Draft.draftId, LATER);
  await reviewQuestionResourceDraft(repo, {
    draftId: v2Draft.draftId,
    action: 'revision_required',
    reviewerId: 'reviewer-1',
    notes: 'Add a clearer evidence requirement.',
    now: LATER,
  });
  assert((await repo.getRegistryEntry(v1.resourceId))?.currentFrozenVersionId === v1.resourceVersionId, 'v1 head changed during revision.');

  const revised = await updateStructuredQuestionDraft(repo, v2Draft.draftId, {
    questionStem: '请结合新的文本依据说明父亲为什么珍藏树叶。',
  }, '2026-07-17T12:00:00.000Z');
  await validateStructuredQuestionDraft(repo, revised.draftId, '2026-07-17T12:01:00.000Z');
  await submitQuestionResourceForReview(repo, revised.draftId, '2026-07-17T12:02:00.000Z');
  await reviewQuestionResourceDraft(repo, {
    draftId: revised.draftId,
    action: 'approve',
    reviewerId: 'reviewer-1',
    notes: 'Revision is ready to freeze.',
    now: '2026-07-17T12:03:00.000Z',
  });

  repo.simulateNextFreezeCommitFailure();
  await assertRejects(
    () => freezeQuestionResourceDraft(repo, revised.draftId, '2026-07-17T12:04:00.000Z'),
    'Simulated atomic freeze commit failure',
  );
  assert((await repo.getRegistryEntry(v1.resourceId))?.currentFrozenVersionId === v1.resourceVersionId, 'Failed v2 freeze changed registry head.');
  assert((await repo.listVersions(v1.resourceId)).length === 1, 'Failed v2 freeze persisted a partial version.');

  const v2 = await freezeQuestionResourceDraft(repo, revised.draftId, '2026-07-17T12:05:00.000Z');
  assert(v2.version.versionNumber === 2, 'Expected v2 to freeze.');
  assert((await repo.getRegistryEntry(v1.resourceId))?.currentFrozenVersionId === v2.version.resourceVersionId, 'Registry head did not switch to v2.');
  assert((await repo.getVersion(v1.resourceVersionId))?.status === 'superseded', 'v1 was not superseded.');
  assert((await validateResourceRegistryConsistency(repo)).passed, 'Registry consistency failed after v2 freeze.');

  const duplicate = await freezeQuestionResourceDraft(repo, revised.draftId, '2026-07-17T12:06:00.000Z');
  assert(!duplicate.inserted && (await repo.listVersions(v1.resourceId)).length === 2, 'Duplicate v2 freeze created another version.');

  await repo.replaceRegistry([]);
  assert(!(await validateResourceRegistryConsistency(repo)).passed, 'Missing registry was not detected.');
  const rebuilt = await rebuildResourceRegistry(repo, '2026-07-17T12:07:00.000Z');
  assert(rebuilt[0]?.currentFrozenVersionId === v2.version.resourceVersionId, 'Registry rebuild selected the wrong head.');
  assert((await validateResourceRegistryConsistency(repo)).passed, 'Rebuilt registry is inconsistent.');
}

async function repositoryWithMaterial(): Promise<Repository> {
  const repo = new InMemoryQuestionResourceAdmissionRepository();
  await createQuestionMaterial(repo, {
    materialId: 'material-leaf',
    materialVersionId: 'material-leaf:v1',
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲整理书柜时，从一本旧书里发现一片已经褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: {
      sourceType: 'manual',
      description: 'Internal validation material.',
      copyrightNote: 'Synthetic text for product validation.',
    },
    createdAt: NOW,
  });
  return repo;
}

async function createDraft(
  repo: Repository,
  suffix: string,
  overrides: Partial<CreateStructuredQuestionDraftInput> = {},
) {
  const base: CreateStructuredQuestionDraftInput = {
    draftId: `draft-${suffix}`,
    resourceId: `resource-${suffix}`,
    taskId: `task-${suffix}`,
    materialVersionId: 'material-leaf:v1',
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
    abilityMetadata: validAbilityMetadata('inference'),
    source: {
      sourceType: 'manual',
      description: 'Manually entered internal validation question.',
      copyrightNote: 'Synthetic content for internal validation.',
    },
    tags: ['阅读理解', '人物心理', '文本依据'],
    now: NOW,
  };

  return createStructuredQuestionDraft(repo, { ...base, ...overrides });
}

async function createReadyDraft(repo: Repository, suffix: string) {
  const draft = await createDraft(repo, suffix);
  const validation = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
  assert(validation.passed, `Fixture validation failed: ${validation.issues.map((item) => item.code).join(', ')}`);
  await submitQuestionResourceForReview(repo, draft.draftId, NOW);
  await reviewQuestionResourceDraft(repo, {
    draftId: draft.draftId,
    action: 'approve',
    reviewerId: 'reviewer-1',
    notes: 'Resource is ready to freeze.',
    now: NOW,
  });
  return (await repo.getDraft(draft.draftId))!;
}

async function createFrozenV1(repo: Repository, suffix: string) {
  const draft = await createReadyDraft(repo, suffix);
  return (await freezeQuestionResourceDraft(repo, draft.draftId, NOW)).version;
}

async function freezeSecondVersion(suffix: string) {
  const repo = await repositoryWithMaterial();
  const v1 = await createFrozenV1(repo, suffix);
  const draft = await createNextQuestionResourceVersionDraft(repo, {
    resourceId: v1.resourceId,
    draftId: `${suffix}-v2-draft`,
    now: LATER,
  });
  const updated = await updateStructuredQuestionDraft(repo, draft.draftId, {
    questionStem: `${draft.questionStem} 请补充因果关系。`,
  }, LATER);
  await validateStructuredQuestionDraft(repo, updated.draftId, LATER);
  await submitQuestionResourceForReview(repo, updated.draftId, LATER);
  await reviewQuestionResourceDraft(repo, {
    draftId: updated.draftId,
    action: 'approve',
    reviewerId: 'reviewer-1',
    notes: 'Version 2 is approved.',
    now: LATER,
  });
  const v2 = (await freezeQuestionResourceDraft(repo, updated.draftId, LATER)).version;
  return { repo, v1, v2 };
}

function validAbilityMetadata(abilityId: PrimaryAbilityId = 'inference') {
  return {
    abilityId,
    supportingAbilityIds: abilityId === 'inference' ? ['extraction' as const, 'comprehension' as const] : [],
    prerequisiteAbilityIds: abilityId === 'inference' ? ['comprehension' as const] : [],
    taskRole: 'diagnosis' as const,
    difficulty: 'intermediate' as const,
    gradeRange: '初中',
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
      acceptedSignals: ['引用动作', '指出细节'],
    },
    {
      itemId: 'explanation',
      name: '解释关系',
      description: '说明文本依据与结论之间的关系。',
      abilityId,
      importance: 'important',
      required: true,
      evidenceRequirement: { requireExplanation: true, requireConclusion: true },
      acceptedSignals: ['因果说明', '依据连接结论'],
    },
  ];
}

function hasCode(result: { issues: Array<{ code: string }> }, code: string): boolean {
  return result.issues.some((issue) => issue.code === code);
}

async function assertRejects(action: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expectedMessage), `Expected error containing "${expectedMessage}", got "${message}".`);
    return;
  }
  throw new Error(`Expected rejection containing: ${expectedMessage}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
