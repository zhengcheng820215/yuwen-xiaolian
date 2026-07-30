import {
  freezeQuestionResourceDraftWithQuality,
  getOrAssessCurrentQuestionDraftQuality,
  reviewQuestionResourceDraftWithQuality,
  submitQuestionResourceForQualityReview,
} from '../agents/questionQualityReviewGate.ts';
import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import { InMemoryQuestionQualityAssessmentRepository } from './support/inMemoryQuestionQualityAssessmentRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type {
  QuestionResourceRubricItem,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  getReturnIssueEditorTargetIds,
} from '../../pages/questionWorkbenchPresentationState.ts';

const NOW = '2026-07-30T10:00:00.000Z';
const LATER = '2026-07-30T10:10:00.000Z';

const cases = [
  ['01 repeated save retry keeps one Revision', repeatedSaveIsIdempotent],
  ['02 two-tab conflicting edits preserve the first committed Revision', conflictingTabsAreRejected],
  ['03 repeated check reuses one Validation', repeatedValidationIsIdempotent],
  ['04 repeated submit keeps one pending review transition', repeatedSubmitIsIdempotent],
  ['05 repeated review keeps one immutable decision', repeatedReviewIsIdempotent],
  ['06 repeated publish keeps one Frozen Version and Registry entry', repeatedPublishIsIdempotent],
  ['07 returned Draft is located, revised, rechecked, and resubmitted in place', returnedDraftResubmitsInPlace],
] as const;

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log('Question Workbench Command E2E Debug');
  console.log('='.repeat(72));
  for (const [name, run] of cases) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${name}: ${message}`);
      console.log(`FAIL ${name}: ${message}`);
    }
  }
  console.log('-'.repeat(72));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function repeatedSaveIsIdempotent(): Promise<void> {
  const fixture = await createFixture('save');
  const patch = {
    questionStem: `${fixture.draft.questionStem} 请说明材料依据。`,
  };
  const first = await updateStructuredQuestionDraft(
    fixture.resources,
    fixture.draft.draftId,
    patch,
    LATER,
    { expectedRevision: fixture.draft.revision },
  );
  const retry = await updateStructuredQuestionDraft(
    fixture.resources,
    fixture.draft.draftId,
    patch,
    LATER,
    { expectedRevision: fixture.draft.revision },
  );

  expect(first.revision === fixture.draft.revision + 1, 'First save did not create one Revision.');
  expect(retry.revision === first.revision, 'Identical save retry created another Revision.');
  expect((await fixture.resources.getDraft(first.draftId))?.revision === first.revision, 'Stored Revision changed after retry.');
}

async function conflictingTabsAreRejected(): Promise<void> {
  const fixture = await createFixture('tabs');
  const first = await updateStructuredQuestionDraft(
    fixture.resources,
    fixture.draft.draftId,
    { questionStem: `${fixture.draft.questionStem} 请引用原句。` },
    LATER,
    { expectedRevision: fixture.draft.revision },
  );

  await expectCode(
    () => updateStructuredQuestionDraft(
      fixture.resources,
      fixture.draft.draftId,
      { questionStem: `${fixture.draft.questionStem} 请概括作答。` },
      LATER,
      { expectedRevision: fixture.draft.revision },
    ),
    'QUESTION_DRAFT_REVISION_CONFLICT',
  );
  const stored = await fixture.resources.getDraft(first.draftId);
  expect(stored?.questionStem === first.questionStem, 'Conflicting tab overwrote the committed content.');
  expect(stored?.revision === first.revision, 'Conflicting tab created an extra Revision.');
}

async function repeatedValidationIsIdempotent(): Promise<void> {
  const fixture = await createFixture('validation');
  const first = await validateStructuredQuestionDraft(
    fixture.resources,
    fixture.draft.draftId,
    NOW,
    fixture.draft.revision,
  );
  const retry = await validateStructuredQuestionDraft(
    fixture.resources,
    fixture.draft.draftId,
    LATER,
    fixture.draft.revision,
  );

  expect(first.validationId === retry.validationId, 'Repeated check created another Validation.');
  expect(
    (await fixture.resources.getDraft(fixture.draft.draftId))?.latestValidationId === first.validationId,
    'Draft does not point to the reused Validation.',
  );
}

async function repeatedSubmitIsIdempotent(): Promise<void> {
  const fixture = await validatedFixture('submit');
  await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  const first = await submitQuestionResourceForQualityReview(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  const retry = await submitQuestionResourceForQualityReview(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    LATER,
  );

  expect(first.status === 'pending_review', 'First submit did not enter pending review.');
  expect(retry.status === 'pending_review', 'Repeated submit changed review state.');
  expect(retry.revision === first.revision, 'Repeated submit created another Revision.');
}

async function repeatedReviewIsIdempotent(): Promise<void> {
  const fixture = await submittedFixture('review');
  const input = {
    draftId: fixture.draft.draftId,
    action: 'approve' as const,
    reviewerId: 'reviewer-p1',
    notes: '确认当前版本可以发布。',
    acceptedWarningCodes: fixture.warningCodes,
    now: NOW,
  };
  const first = await reviewQuestionResourceDraftWithQuality(
    fixture.resources,
    fixture.quality,
    input,
  );
  const retry = await reviewQuestionResourceDraftWithQuality(
    fixture.resources,
    fixture.quality,
    { ...input, now: LATER },
  );

  expect(first.reviewId === retry.reviewId, 'Repeated review created another decision.');
  expect(
    (await fixture.resources.getDraft(fixture.draft.draftId))?.latestReviewId === first.reviewId,
    'Draft does not point to the reused review decision.',
  );
}

async function repeatedPublishIsIdempotent(): Promise<void> {
  const fixture = await submittedFixture('publish');
  await reviewQuestionResourceDraftWithQuality(
    fixture.resources,
    fixture.quality,
    {
      draftId: fixture.draft.draftId,
      action: 'approve',
      reviewerId: 'reviewer-p1',
      notes: '确认当前版本可以发布。',
      acceptedWarningCodes: fixture.warningCodes,
      now: NOW,
    },
  );
  const first = await freezeQuestionResourceDraftWithQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  const retry = await freezeQuestionResourceDraftWithQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    LATER,
  );

  expect(first.version.resourceVersionId === retry.version.resourceVersionId, 'Repeated publish created another Frozen Version.');
  expect((await fixture.resources.listVersions()).length === 1, 'Version repository contains duplicates.');
  expect((await fixture.resources.listRegistryEntries()).length === 1, 'Registry contains duplicate entries.');
}

async function returnedDraftResubmitsInPlace(): Promise<void> {
  const fixture = await submittedFixture('returned');
  const submitted = await fixture.resources.getDraft(fixture.draft.draftId);
  expect(submitted?.status === 'pending_review', 'Fixture did not enter pending review.');
  const originalDraftId = submitted.draftId;
  const originalRevision = submitted.revision;
  const returnRequest = {
    issueType: 'question_expression' as const,
    problem: '题干没有明确要求引用材料依据。',
    requirement: '在题干中补充“结合材料中的具体动作”。',
  };

  const returnDecision = await reviewQuestionResourceDraftWithQuality(
    fixture.resources,
    fixture.quality,
    {
      draftId: originalDraftId,
      action: 'revision_required',
      reviewerId: 'reviewer-p1',
      notes: '退回录入端补充材料依据。',
      returnRequest,
      now: NOW,
    },
  );
  const returned = await fixture.resources.getDraft(originalDraftId);
  expect(returnDecision.returnRequest?.issueType === 'question_expression', 'Return reason was not preserved.');
  expect(returned?.status === 'revision_required', 'Returned Draft did not enter revision_required.');
  expect(returned?.draftId === originalDraftId, 'Return flow replaced the Draft identity.');

  const targetIds = getReturnIssueEditorTargetIds(returnRequest.issueType, {
    planReviewMode: true,
  });
  expect(
    targetIds[0] === 'question-stem-editor',
    'Return flow did not locate the question stem editor.',
  );

  const revised = await updateStructuredQuestionDraft(
    fixture.resources,
    originalDraftId,
    {
      questionStem: `${returned.questionStem} 请结合材料中的具体动作说明。`,
    },
    LATER,
    { expectedRevision: originalRevision },
  );
  expect(revised.draftId === originalDraftId, 'Revision created a different Draft.');
  expect(revised.revision === originalRevision + 1, 'Revision did not advance exactly once.');
  expect(revised.latestReviewId === undefined, 'Revised content retained the stale review decision.');

  const validation = await validateStructuredQuestionDraft(
    fixture.resources,
    originalDraftId,
    LATER,
    revised.revision,
  );
  expect(validation.passed, 'Revised Draft did not pass structural validation.');
  const assessment = await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    originalDraftId,
    LATER,
  );
  expect(
    assessment.assessedDraftRevision === revised.revision,
    'Quality assessment did not bind to the revised content.',
  );

  const resubmitted = await submitQuestionResourceForQualityReview(
    fixture.resources,
    fixture.quality,
    originalDraftId,
    LATER,
  );
  expect(resubmitted.status === 'pending_review', 'Revised Draft was not resubmitted.');
  expect(resubmitted.draftId === originalDraftId, 'Resubmit created a different Draft.');
  expect(resubmitted.revision === revised.revision, 'Resubmit created an extra content Revision.');
  expect((await fixture.resources.listDrafts()).length === 1, 'Return loop created duplicate Drafts.');
  expect((await fixture.resources.listReviews()).length === 1, 'Return loop duplicated the prior review decision.');
}

async function submittedFixture(suffix: string) {
  const fixture = await validatedFixture(suffix);
  const assessment = await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  expect(assessment, 'Quality assessment is missing.');
  await submitQuestionResourceForQualityReview(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  return {
    ...fixture,
    warningCodes: assessment.warnings.map((warning) => warning.code),
  };
}

async function validatedFixture(suffix: string) {
  const fixture = await createFixture(suffix);
  const validation = await validateStructuredQuestionDraft(
    fixture.resources,
    fixture.draft.draftId,
    NOW,
    fixture.draft.revision,
  );
  expect(validation.passed, `Fixture validation failed: ${validation.issues.map((issue) => issue.code).join(', ')}`);
  const draft = await fixture.resources.getDraft(fixture.draft.draftId);
  expect(draft, 'Validated Draft is missing.');
  return { ...fixture, draft };
}

async function createFixture(suffix: string): Promise<{
  resources: InMemoryQuestionResourceAdmissionRepository;
  quality: InMemoryQuestionQualityAssessmentRepository;
  draft: StructuredQuestionDraft;
}> {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const quality = new InMemoryQuestionQualityAssessmentRepository();
  await createQuestionMaterial(resources, {
    materialId: `material-${suffix}`,
    materialVersionId: `material-${suffix}:v1`,
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲整理书柜时发现一片褪色树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: {
      sourceType: 'manual',
      description: 'P1 command E2E fixture.',
      copyrightNote: 'Synthetic text for internal validation.',
    },
    createdAt: NOW,
  });
  const draft = await createStructuredQuestionDraft(resources, {
    draftId: `p1-command-${suffix}`,
    resourceId: `p1-resource-${suffix}`,
    taskId: `p1-task-${suffix}`,
    materialVersionId: `material-${suffix}:v1`,
    title: '人物心理推断',
    questionStem: '结合父亲“捏着树叶站了很久，又小心地夹回原处”的动作，分析这一细节表现出的心理。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['树叶', '珍惜', '回忆'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: validRubric(),
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'inference',
      supportingAbilityIds: ['extraction', 'comprehension'],
      prerequisiteAbilityIds: ['comprehension'],
      taskRole: 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: {
      sourceType: 'manual',
      description: 'P1 command E2E fixture.',
      copyrightNote: 'Synthetic content for internal validation.',
    },
    tags: ['阅读理解', '人物心理', '文本依据'],
    now: NOW,
  });
  return { resources, quality, draft };
}

function validRubric(): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence',
      name: '动作依据',
      description: '指出与判断相关的文本动作。',
      abilityId: 'inference',
      importance: 'critical',
      required: true,
      evidenceRequirement: {
        requireTextEvidence: true,
        requireExplanation: true,
      },
      acceptedSignals: ['捏着树叶站了很久', '小心地夹回原处'],
    },
    {
      itemId: 'explanation',
      name: '解释关系',
      description: '说明动作与人物心理之间的关系。',
      abilityId: 'inference',
      importance: 'important',
      required: true,
      evidenceRequirement: {
        requireExplanation: true,
        requireConclusion: true,
      },
      acceptedSignals: ['动作说明珍惜', '舍不得丢弃回忆'],
    },
  ];
}

async function expectCode(action: () => Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
    expect(code === expectedCode, `Expected ${expectedCode}, received ${code || 'no code'}.`);
    return;
  }
  throw new Error(`Expected command to fail with ${expectedCode}.`);
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
