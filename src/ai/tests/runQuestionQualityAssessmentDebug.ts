import {
  assessAndSaveQuestionDraftQuality,
  assessQuestionDraftQuality,
  isCurrentQuestionQualityAssessment,
  requireCurrentQuestionQualityAssessment,
} from '../agents/questionQualityAssessmentAgent.ts';
import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
} from '../agents/questionResourceAdmissionAgent.ts';
import { InMemoryQuestionQualityAssessmentRepository } from '../repositories/inMemoryQuestionQualityAssessmentRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  isQuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import type {
  QuestionResourceRubricItem,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';

type AdmissionRepository = InMemoryQuestionResourceAdmissionRepository;

const NOW = '2026-07-25T09:00:00.000Z';
const LATER = '2026-07-25T10:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 valid draft receives pass assessment', run: caseValidAssessment },
  { name: '02 failed contract validation blocks quality assessment', run: caseFailedValidationBlocked },
  { name: '03 stale contract validation blocks quality assessment', run: caseStaleValidationBlocked },
  { name: '04 missing material grounding recommends revision', run: caseMissingMaterialGrounding },
  { name: '05 broad observation produces quality warning', run: caseBroadObservation },
  { name: '06 duplicate observation is detected', run: caseDuplicateObservation },
  { name: '07 weak discriminative power is detected', run: caseWeakDiscriminativePower },
  { name: '08 incoherent difficulty is detected', run: caseDifficultyIncoherence },
  { name: '09 rubric mismatch recommends revision', run: caseRubricMismatch },
  { name: '10 draft revision invalidates previous assessment', run: caseRevisionInvalidation },
  { name: '11 repository save is idempotent and immutable', run: caseRepositoryGuarantees },
  { name: '12 schema guard rejects malformed assessment', run: caseSchemaGuard },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log('Phase 17.5A Question Generation Quality Assessment Debug');
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

async function caseValidAssessment(): Promise<void> {
  const fixture = await validFixture('valid');
  const assessment = assessQuestionDraftQuality({
    ...fixture,
    assessedAt: NOW,
  });

  assert(assessment.decision === 'pass', `Expected pass, got ${assessment.decision}.`);
  assert(assessment.warnings.length === 0, 'Valid draft unexpectedly produced warnings.');
  assert(isCurrentQuestionQualityAssessment(
    fixture.draft,
    fixture.validation,
    assessment,
  ), 'Fresh assessment was not recognized as current.');
  assert(
    requireCurrentQuestionQualityAssessment(
      fixture.draft,
      fixture.validation,
      assessment,
    ).assessmentId === assessment.assessmentId,
    'Current-assessment guard returned the wrong assessment.',
  );
}

async function caseFailedValidationBlocked(): Promise<void> {
  const repository = await repositoryWithMaterial();
  const draft = await createDraft(repository, 'invalid', { questionStem: '' });
  const validation = await validateStructuredQuestionDraft(
    repository,
    draft.draftId,
    NOW,
  );
  const currentDraft = await requiredDraft(repository, draft.draftId);

  assert(!validation.passed, 'Invalid fixture unexpectedly passed contract validation.');
  await assertRejects(
    () => Promise.resolve(assessQuestionDraftQuality({
      draft: currentDraft,
      validation,
      material: null,
    })),
    'requires passed contract validation',
  );
}

async function caseStaleValidationBlocked(): Promise<void> {
  const fixture = await validFixture('stale');
  const updated = await updateStructuredQuestionDraft(
    fixture.repository,
    fixture.draft.draftId,
    { title: '更新后的题目标题' },
    LATER,
  );

  await assertRejects(
    () => Promise.resolve(assessQuestionDraftQuality({
      draft: updated,
      validation: fixture.validation,
      material: fixture.material,
    })),
    'requires current draft validation',
  );
}

async function caseMissingMaterialGrounding(): Promise<void> {
  const fixture = await validFixture('ungrounded', {
    questionStem: '请谈谈你对亲情的理解。',
    rubric: validRubric('inference', false),
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: false,
      requireExplanation: true,
    },
  });
  const assessment = assessQuestionDraftQuality(fixture);

  assert(
    assessment.checks.materialGrounding === 'fail',
    'Material semantic mismatch was not marked fail.',
  );
  assert(
    assessment.decision === 'revision_recommended',
    'Missing grounding did not recommend revision.',
  );
  assert(hasWarning(assessment, 'quality.material.semantic_mismatch'), 'Expected material warning is missing.');
}

async function caseBroadObservation(): Promise<void> {
  const fixture = await validFixture('broad', {
    questionStem: '请谈谈你的看法。',
    rubric: validRubric('inference', false),
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: false,
      requireExplanation: true,
    },
  });
  const assessment = assessQuestionDraftQuality(fixture);

  assert(assessment.checks.scopeClarity === 'warning', 'Broad scope was not detected.');
  assert(hasWarning(assessment, 'quality.scope.too_broad'), 'Broad-scope warning is missing.');
}

async function caseDuplicateObservation(): Promise<void> {
  const fixture = await validFixture('duplicate');
  const peer = await createDraft(fixture.repository, 'duplicate-peer', {
    questionStem: fixture.draft.questionStem,
  });
  const assessment = assessQuestionDraftQuality({
    ...fixture,
    peerDrafts: [peer],
  });

  assert(
    assessment.checks.observationDistinctness === 'warning',
    'Duplicate observation was not detected.',
  );
  assert(hasWarning(assessment, 'quality.observation.duplicate'), 'Duplicate warning is missing.');
}

async function caseWeakDiscriminativePower(): Promise<void> {
  const fixture = await validFixture('weak-discrimination', {
    rubric: [validRubric('inference')[0]],
  });
  const assessment = assessQuestionDraftQuality(fixture);

  assert(
    assessment.checks.discriminativePower === 'warning',
    'Weak discrimination was not detected.',
  );
  assert(hasWarning(assessment, 'quality.discrimination.weak'), 'Discrimination warning is missing.');
}

async function caseDifficultyIncoherence(): Promise<void> {
  const fixture = await validFixture('difficulty', {
    abilityMetadata: {
      ...validAbilityMetadata(),
      difficulty: 'advanced',
    },
    questionStem: '写出父亲做了什么。',
    rubric: [validRubric('inference', false)[0]],
    minimumAnswerRequirement: {
      minLength: 8,
      requireTextEvidence: false,
      requireExplanation: false,
    },
  });
  const assessment = assessQuestionDraftQuality(fixture);

  assert(
    assessment.checks.difficultyCoherence === 'warning',
    'Difficulty incoherence was not detected.',
  );
  assert(hasWarning(assessment, 'quality.difficulty.incoherent'), 'Difficulty warning is missing.');
}

async function caseRubricMismatch(): Promise<void> {
  const fixture = await validFixture('rubric-mismatch', {
    rubric: validRubric('inference', false),
  });
  const assessment = assessQuestionDraftQuality(fixture);

  assert(assessment.checks.rubricAlignment === 'warning', 'Rubric mismatch was not detected.');
  assert(
    assessment.decision === 'revision_recommended',
    'Strong rubric mismatch did not recommend revision.',
  );
  assert(hasWarning(assessment, 'quality.rubric.semantic_mismatch'), 'Rubric warning is missing.');
}

async function caseRevisionInvalidation(): Promise<void> {
  const fixture = await validFixture('revision');
  const previous = assessQuestionDraftQuality(fixture);
  const updated = await updateStructuredQuestionDraft(
    fixture.repository,
    fixture.draft.draftId,
    { questionStem: `${fixture.draft.questionStem} 请写出完整推理过程。` },
    LATER,
  );
  const validation = await validateStructuredQuestionDraft(
    fixture.repository,
    updated.draftId,
    LATER,
  );
  const currentDraft = await requiredDraft(fixture.repository, updated.draftId);
  const current = assessQuestionDraftQuality({
    draft: currentDraft,
    validation,
    material: fixture.material,
    assessedAt: LATER,
  });

  assert(
    !isCurrentQuestionQualityAssessment(currentDraft, validation, previous),
    'Previous revision assessment remained current.',
  );
  assert(current.assessedDraftRevision === 2, 'New assessment did not bind revision 2.');
  assert(
    isCurrentQuestionQualityAssessment(currentDraft, validation, current),
    'Revision 2 assessment was not recognized as current.',
  );
}

async function caseRepositoryGuarantees(): Promise<void> {
  const fixture = await validFixture('repository');
  const repository = new InMemoryQuestionQualityAssessmentRepository();
  const saved = await assessAndSaveQuestionDraftQuality(repository, {
    ...fixture,
    assessedAt: NOW,
  });
  const duplicate = await assessAndSaveQuestionDraftQuality(repository, {
    ...fixture,
    assessedAt: LATER,
  });

  assert(saved.assessmentId === duplicate.assessmentId, 'Idempotent save changed assessment identity.');
  assert(duplicate.assessedAt === NOW, 'Duplicate save replaced the original assessment timestamp.');
  assert(
    (await repository.listAssessmentsForDraft(fixture.draft.draftId)).length === 1,
    'Duplicate save created another record.',
  );

  saved.warnings.push({
    code: 'mutated',
    check: 'scopeClarity',
    severity: 'warning',
    message: 'Mutation attempt.',
    evidenceRefs: ['test'],
  });
  const stored = await repository.getAssessment(saved.assessmentId);
  assert(stored?.warnings.length === 0, 'Repository record was mutated through returned value.');
  await assertRejectsCode(
    () => repository.saveAssessment(saved),
    'FORMAL_RESOURCE_IMMUTABLE_CONFLICT',
  );
}

async function caseSchemaGuard(): Promise<void> {
  const fixture = await validFixture('schema');
  const assessment = assessQuestionDraftQuality(fixture);

  assert(isQuestionQualityAssessment(assessment), 'Valid assessment failed schema guard.');
  assert(
    !isQuestionQualityAssessment({
      ...assessment,
      assessedDraftRevision: 0,
    }),
    'Malformed assessment passed schema guard.',
  );
}

async function validFixture(
  suffix: string,
  overrides: Partial<CreateStructuredQuestionDraftInput> = {},
): Promise<{
  repository: AdmissionRepository;
  draft: StructuredQuestionDraft;
  validation: ResourceValidationResult;
  material: Awaited<ReturnType<AdmissionRepository['getMaterial']>>;
}> {
  const repository = await repositoryWithMaterial();
  const created = await createDraft(repository, suffix, overrides);
  const validation = await validateStructuredQuestionDraft(
    repository,
    created.draftId,
    NOW,
  );
  assert(
    validation.passed,
    `Fixture validation failed: ${validation.issues.map((issue) => issue.code).join(', ')}`,
  );
  const draft = await requiredDraft(repository, created.draftId);
  const material = await repository.getMaterial('material-leaf:v1');
  assert(material, 'Fixture material is missing.');
  return { repository, draft, validation, material };
}

async function repositoryWithMaterial(): Promise<AdmissionRepository> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  await createQuestionMaterial(repository, {
    materialId: 'material-leaf',
    materialVersionId: 'material-leaf:v1',
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲整理书柜时，从一本旧书里发现一片已经褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: {
      sourceType: 'manual',
      description: 'Internal question quality material.',
      copyrightNote: 'Synthetic text for product validation.',
    },
    createdAt: NOW,
  });
  return repository;
}

async function createDraft(
  repository: AdmissionRepository,
  suffix: string,
  overrides: Partial<CreateStructuredQuestionDraftInput> = {},
): Promise<StructuredQuestionDraft> {
  const base: CreateStructuredQuestionDraftInput = {
    draftId: `quality-draft-${suffix}`,
    resourceId: `quality-resource-${suffix}`,
    taskId: `quality-task-${suffix}`,
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
    rubric: validRubric('inference'),
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: validAbilityMetadata(),
    source: {
      sourceType: 'manual',
      description: 'Manually entered internal question quality fixture.',
      copyrightNote: 'Synthetic content for internal validation.',
    },
    tags: ['阅读理解', '人物心理', '文本依据'],
    now: NOW,
  };
  return createStructuredQuestionDraft(repository, { ...base, ...overrides });
}

function validAbilityMetadata() {
  return {
    abilityId: 'inference' as const,
    supportingAbilityIds: ['extraction' as const, 'comprehension' as const],
    prerequisiteAbilityIds: ['comprehension' as const],
    taskRole: 'training' as const,
    difficulty: 'intermediate' as const,
    gradeRange: '初中',
  };
}

function validRubric(
  abilityId: 'inference',
  requireEvidence = true,
): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence',
      name: '动作依据',
      description: '指出与判断相关的文本动作。',
      abilityId,
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
      abilityId,
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

async function requiredDraft(
  repository: AdmissionRepository,
  draftId: string,
): Promise<StructuredQuestionDraft> {
  const draft = await repository.getDraft(draftId);
  assert(draft, `Draft ${draftId} is missing.`);
  return draft;
}

function hasWarning(
  assessment: ReturnType<typeof assessQuestionDraftQuality>,
  code: string,
): boolean {
  return assessment.warnings.some((warning) => warning.code === code);
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
