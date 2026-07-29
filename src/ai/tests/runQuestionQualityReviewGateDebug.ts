import {
  assessAndSaveQuestionDraftQuality,
} from '../agents/questionQualityAssessmentAgent.ts';
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
import { InMemoryQuestionQualityAssessmentRepository } from '../repositories/inMemoryQuestionQualityAssessmentRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type {
  QuestionResourceRubricItem,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  QUESTION_QUALITY_RULE_VERSION,
} from '../schemas/questionQualityAssessment.schema.ts';

type ResourceRepository = InMemoryQuestionResourceAdmissionRepository;
type QualityRepository = InMemoryQuestionQualityAssessmentRepository;

const NOW = '2026-07-25T11:00:00.000Z';
const LATER = '2026-07-25T12:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 current validated draft receives quality assessment', run: caseAssessmentCreated },
  { name: '02 unvalidated draft does not receive assessment', run: caseUnvalidatedDraft },
  { name: '03 submit review requires current assessment', run: caseSubmitRequiresAssessment },
  { name: '04 warning assessment remains advisory for human review', run: caseWarningRemainsAdvisory },
  { name: '05 draft edit invalidates assessment and blocks submit', run: caseEditInvalidatesAssessment },
  { name: '06 human decision requires current assessment', run: caseReviewRequiresAssessment },
  { name: '07 freeze requires current assessment', run: caseFreezeRequiresAssessment },
  { name: '08 full quality-aware review and freeze chain succeeds', run: caseFullChain },
  { name: '09 old rule assessment is replaced before consumption', run: caseRuleVersionRefresh },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log('Phase 17.5B Question Quality Review Gate Debug');
  for (const testCase of cases) {
    try {
      await testCase.run();
      passed += 1;
      console.log(`PASS ${testCase.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${testCase.name}: ${message}`);
      console.error(`FAIL ${testCase.name}: ${message}`);
    }
  }

  console.log(`\nResult: ${passed}/${cases.length} passed`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseAssessmentCreated(): Promise<void> {
  const fixture = await validatedFixture('assessment');
  const assessment = await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );

  assert(assessment, 'Current validated draft did not receive an assessment.');
  assert(assessment.assessedDraftRevision === fixture.draft.revision, 'Assessment revision mismatch.');
}

async function caseUnvalidatedDraft(): Promise<void> {
  const resources = await repositoryWithMaterial();
  const quality = new InMemoryQuestionQualityAssessmentRepository();
  const draft = await createDraft(resources, 'unvalidated');
  const assessment = await getOrAssessCurrentQuestionDraftQuality(
    resources,
    quality,
    draft.draftId,
    NOW,
  );

  assert(assessment === null, 'Unvalidated draft unexpectedly received an assessment.');
}

async function caseSubmitRequiresAssessment(): Promise<void> {
  const fixture = await validatedFixture('submit-blocked');
  await assertRejectsCode(
    () => submitQuestionResourceForQualityReview(
      fixture.resources,
      fixture.quality,
      fixture.draft.draftId,
      NOW,
    ),
    'QUALITY_ASSESSMENT_REQUIRED',
  );
}

async function caseWarningRemainsAdvisory(): Promise<void> {
  const fixture = await validatedFixture('advisory', {
    questionStem: '请谈谈你对亲情的理解。',
    rubric: validRubric(false),
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: false,
      requireExplanation: true,
    },
  });
  const assessment = await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  assert(
    assessment?.decision === 'revision_recommended',
    'Expected revision recommendation is missing.',
  );

  const submitted = await submitQuestionResourceForQualityReview(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  assert(submitted.status === 'pending_review', 'Advisory warning incorrectly blocked human review.');
}

async function caseEditInvalidatesAssessment(): Promise<void> {
  const fixture = await validatedFixture('stale');
  await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  const updated = await updateStructuredQuestionDraft(
    fixture.resources,
    fixture.draft.draftId,
    { questionStem: `${fixture.draft.questionStem} 请补充具体材料依据。` },
    LATER,
  );
  assert(
    !updated.latestValidationId && !updated.latestReviewId,
    'Editing a core authoring field must invalidate prior validation and review.',
  );

  await assertRejectsCode(
    () => submitQuestionResourceForQualityReview(
      fixture.resources,
      fixture.quality,
      updated.draftId,
      LATER,
    ),
    'QUALITY_ASSESSMENT_REQUIRED',
  );
}

async function caseReviewRequiresAssessment(): Promise<void> {
  const fixture = await validatedFixture('review-blocked');
  await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  await submitQuestionResourceForQualityReview(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  await fixture.quality.clear();

  await assertRejectsCode(
    () => reviewQuestionResourceDraftWithQuality(
      fixture.resources,
      fixture.quality,
      {
        draftId: fixture.draft.draftId,
        action: 'approve',
        reviewerId: 'reviewer-1',
        notes: '人工确认题目可进入发布。',
        now: NOW,
      },
    ),
    'QUALITY_ASSESSMENT_REQUIRED',
  );
}

async function caseFreezeRequiresAssessment(): Promise<void> {
  const fixture = await reviewedFixture('freeze-blocked');
  await fixture.quality.clear();

  await assertRejectsCode(
    () => freezeQuestionResourceDraftWithQuality(
      fixture.resources,
      fixture.quality,
      fixture.draft.draftId,
      NOW,
    ),
    'QUALITY_ASSESSMENT_REQUIRED',
  );
}

async function caseFullChain(): Promise<void> {
  const fixture = await reviewedFixture('full-chain');
  const result = await freezeQuestionResourceDraftWithQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );

  assert(result.inserted, 'Quality-aware freeze did not insert the version.');
  assert(
    result.registryEntry.currentFrozenVersionId === result.version.resourceVersionId,
    'Quality-aware freeze did not update Registry.',
  );
}

async function caseRuleVersionRefresh(): Promise<void> {
  const fixture = await validatedFixture('rule-refresh');
  const material = await fixture.resources.getMaterial('material-leaf:v1');
  assert(material, 'Fixture material is missing.');
  const validation = await fixture.resources.getValidation(
    fixture.draft.latestValidationId || '',
  );
  assert(validation, 'Fixture validation is missing.');
  await assessAndSaveQuestionDraftQuality(fixture.quality, {
    draft: fixture.draft,
    validation,
    material,
    assessedAt: NOW,
    ruleVersion: 'legacy_quality_rules',
  });

  const current = await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    LATER,
  );
  assert(current?.ruleVersion === QUESTION_QUALITY_RULE_VERSION, 'Old rule assessment was not refreshed.');
  assert(
    (await fixture.quality.listAssessmentsForDraft(fixture.draft.draftId)).length === 2,
    'Rule refresh did not preserve the previous assessment for traceability.',
  );
}

async function reviewedFixture(suffix: string): Promise<{
  resources: ResourceRepository;
  quality: QualityRepository;
  draft: StructuredQuestionDraft;
}> {
  const fixture = await validatedFixture(suffix);
  await getOrAssessCurrentQuestionDraftQuality(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  await submitQuestionResourceForQualityReview(
    fixture.resources,
    fixture.quality,
    fixture.draft.draftId,
    NOW,
  );
  await reviewQuestionResourceDraftWithQuality(
    fixture.resources,
    fixture.quality,
    {
      draftId: fixture.draft.draftId,
      action: 'approve',
      reviewerId: 'reviewer-1',
      notes: '人工确认质量警告与题目内容。',
      now: NOW,
    },
  );
  return fixture;
}

async function validatedFixture(
  suffix: string,
  overrides: Record<string, unknown> = {},
): Promise<{
  resources: ResourceRepository;
  quality: QualityRepository;
  draft: StructuredQuestionDraft;
}> {
  const resources = await repositoryWithMaterial();
  const quality = new InMemoryQuestionQualityAssessmentRepository();
  const created = await createDraft(resources, suffix, overrides);
  const validation = await validateStructuredQuestionDraft(
    resources,
    created.draftId,
    NOW,
  );
  assert(
    validation.passed,
    `Fixture validation failed: ${validation.issues.map((issue) => issue.code).join(', ')}`,
  );
  const draft = await resources.getDraft(created.draftId);
  assert(draft, 'Validated fixture draft is missing.');
  return { resources, quality, draft };
}

async function repositoryWithMaterial(): Promise<ResourceRepository> {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  await createQuestionMaterial(resources, {
    materialId: 'material-leaf',
    materialVersionId: 'material-leaf:v1',
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲整理书柜时，从一本旧书里发现一片已经褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: {
      sourceType: 'manual',
      description: 'Internal review gate material.',
      copyrightNote: 'Synthetic text for product validation.',
    },
    createdAt: NOW,
  });
  return resources;
}

async function createDraft(
  resources: ResourceRepository,
  suffix: string,
  overrides: Record<string, unknown> = {},
): Promise<StructuredQuestionDraft> {
  return createStructuredQuestionDraft(resources, {
    draftId: `quality-review-${suffix}`,
    resourceId: `quality-review-resource-${suffix}`,
    taskId: `quality-review-task-${suffix}`,
    materialVersionId: 'material-leaf:v1',
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
    rubric: validRubric(true),
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
      description: 'Internal quality review fixture.',
      copyrightNote: 'Synthetic content for internal validation.',
    },
    tags: ['阅读理解', '人物心理', '文本依据'],
    now: NOW,
    ...overrides,
  } as Parameters<typeof createStructuredQuestionDraft>[1]);
}

function validRubric(requireEvidence: boolean): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence',
      name: '动作依据',
      description: '指出与判断相关的文本动作。',
      abilityId: 'inference',
      importance: 'critical',
      required: true,
      evidenceRequirement: {
        requireTextEvidence: requireEvidence,
        requireExplanation: requireEvidence,
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
        requireExplanation: requireEvidence,
        requireConclusion: true,
      },
      acceptedSignals: ['动作说明珍惜', '舍不得丢弃回忆'],
    },
  ];
}

async function assertRejects(
  action: () => Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(expectedMessage),
      `Expected error containing "${expectedMessage}", got "${message}".`,
    );
    return;
  }
  throw new Error(`Expected rejection containing: ${expectedMessage}`);
}

async function assertRejectsCode(
  action: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
    assert(code === expectedCode, `Expected error code "${expectedCode}", got "${code}".`);
    return;
  }
  throw new Error(`Expected rejection with code: ${expectedCode}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
