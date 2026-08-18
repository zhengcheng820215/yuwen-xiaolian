import {
  InMemoryQuestionSemanticQualityAssessmentSessionCache,
  canApplyQualityReviewAction,
  canFreezeWithQualityBundle,
  mergeQuestionQualityAssessments,
  runQuestionSemanticQualityAssessment,
} from '../agents/questionSemanticQualityAssessmentAgent.ts';
import {
  assessQuestionDraftQuality,
} from '../agents/questionQualityAssessmentAgent.ts';
import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
} from '../agents/questionResourceAdmissionAgent.ts';
import {
  ScriptedDiagnosisProviderAdapter,
  type ScriptedDiagnosisProviderStep,
} from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  QUESTION_QUALITY_CHECKS,
  type QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import {
  isQuestionQualityAssessmentBundle,
  isQuestionSemanticQualityAssessment,
  type SemanticCheckStatus,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';
import type {
  QuestionResourceRubricItem,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';

type AdmissionRepository = InMemoryQuestionResourceAdmissionRepository;

const NOW = '2026-07-26T09:00:00.000Z';
const LATER = '2026-07-26T10:00:00.000Z';
const PROVIDER_ID = 'semantic_test_provider';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 current draft produces completed semantic assessment', run: caseCompleted },
  { name: '02 stale draft revision blocks before provider call', run: caseStaleRevisionBlocked },
  { name: '03 stale validation id blocks before provider call', run: caseStaleValidationBlocked },
  { name: '04 material version mismatch blocks before provider call', run: caseMaterialMismatchBlocked },
  { name: '05 provider failure produces bounded failure object', run: caseProviderFailure },
  { name: '06 timeout does not trigger an implicit retry', run: caseTimeout },
  { name: '07 malformed output receives one structural repair', run: caseRepairSuccess },
  { name: '08 second malformed output becomes invalid_output', run: caseRepairFailure },
  { name: '09 illegal evidence reference is rejected', run: caseIllegalEvidenceRef },
  { name: '09a single-choice nested evidence reference is accepted', run: caseSingleChoiceNestedEvidenceRef },
  { name: '10 prompt version changes semantic request identity', run: casePromptIdentity },
  { name: '11 model version changes semantic request identity', run: caseModelIdentity },
  { name: '12 deterministic assessment changes semantic request identity', run: caseDeterministicIdentity },
  { name: '13 completed semantic result is session-idempotent', run: caseCompletedIdempotency },
  { name: '14 semantic failure never degrades to pass', run: caseFailureBundle },
  { name: '15 merge keeps the most conservative check', run: caseConservativeMerge },
  { name: '16 deterministic material fail cannot be offset', run: caseDeterministicFailDominates },
  { name: '17 semantic strong warning recommends revision', run: caseStrongWarning },
  { name: '18 semantic unavailable blocks approve and freeze', run: caseUnavailableBlocksFormalization },
  { name: '19 semantic unavailable still allows revision or reject', run: caseUnavailableAllowsNegativeActions },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.5C1 Independent Semantic Quality Assessment Debug');

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

async function caseCompleted(): Promise<void> {
  const fixture = await validFixture('completed');
  const { assessment, provider } = await execute(fixture, [
    response(validSemanticOutput()),
  ]);
  assert(assessment.status === 'completed', `Expected completed, got ${assessment.status}.`);
  assert(assessment.findings.length === 7, 'Completed assessment must contain seven findings.');
  assert(provider.getCallCount() === 1, 'Valid output should require one Provider call.');
  assert(isQuestionSemanticQualityAssessment(assessment), 'Completed assessment failed schema guard.');
}

async function caseStaleRevisionBlocked(): Promise<void> {
  const fixture = await validFixture('stale-revision');
  const updated = await updateStructuredQuestionDraft(
    fixture.repository,
    fixture.draft.draftId,
    { title: 'Revision 2' },
    LATER,
  );
  const provider = scripted([response(validSemanticOutput())]);
  await assertRejects(
    () => runQuestionSemanticQualityAssessment(
      { ...baseInput(fixture), draft: updated },
      { provider },
    ),
    'current passed validation',
  );
  assert(provider.getCallCount() === 0, 'Provider was called for stale revision.');
}

async function caseStaleValidationBlocked(): Promise<void> {
  const fixture = await validFixture('stale-validation');
  const provider = scripted([response(validSemanticOutput())]);
  await assertRejects(
    () => runQuestionSemanticQualityAssessment(
      {
        ...baseInput(fixture),
        validation: {
          ...fixture.validation,
          validationId: 'stale-validation-id',
        },
      },
      { provider },
    ),
    'current passed validation',
  );
  assert(provider.getCallCount() === 0, 'Provider was called for stale validation.');
}

async function caseMaterialMismatchBlocked(): Promise<void> {
  const fixture = await validFixture('material-mismatch');
  const provider = scripted([response(validSemanticOutput())]);
  await assertRejects(
    () => runQuestionSemanticQualityAssessment(
      {
        ...baseInput(fixture),
        material: {
          ...fixture.material,
          materialVersionId: 'material-other:v1',
        },
      },
      { provider },
    ),
    'current material version',
  );
  assert(provider.getCallCount() === 0, 'Provider was called for material mismatch.');
}

async function caseProviderFailure(): Promise<void> {
  const fixture = await validFixture('provider-failure');
  const { assessment, provider } = await execute(fixture, [{
    type: 'error',
    category: 'provider_unavailable',
    retryable: true,
  }]);
  assert(assessment.status === 'provider_failed', 'Provider failure status is incorrect.');
  assert(assessment.findings.length === 0, 'Failure object must not contain findings.');
  assert(assessment.limitations.length === 1, 'Failure limitation is missing.');
  assert(provider.getCallCount() === 1, 'Provider failure should not retry implicitly.');
  assert(isQuestionSemanticQualityAssessment(assessment), 'Failure assessment failed schema guard.');
}

async function caseTimeout(): Promise<void> {
  const fixture = await validFixture('timeout');
  const { assessment, provider } = await execute(fixture, [{
    type: 'error',
    category: 'timeout',
    retryable: true,
  }]);
  assert(assessment.status === 'timeout', 'Timeout status is incorrect.');
  assert(provider.getCallCount() === 1, 'Timeout triggered an implicit second submission.');
}

async function caseRepairSuccess(): Promise<void> {
  const fixture = await validFixture('repair-success');
  const { assessment, provider } = await execute(fixture, [
    response('not-json'),
    response(validSemanticOutput()),
  ]);
  assert(assessment.status === 'completed', 'Repair did not recover a valid assessment.');
  assert(provider.getCallCount() === 2, 'Structural repair did not use exactly two calls.');
  assert(
    provider.getRequests()[1]?.prompt.includes('修复 JSON 结构'),
    'Second request was not a structural repair prompt.',
  );
}

async function caseRepairFailure(): Promise<void> {
  const fixture = await validFixture('repair-failure');
  const { assessment, provider } = await execute(fixture, [
    response('not-json'),
    response('still-not-json'),
  ]);
  assert(assessment.status === 'invalid_output', 'Repeated invalid output was not blocked.');
  assert(provider.getCallCount() === 2, 'Invalid output exceeded one repair attempt.');
}

async function caseIllegalEvidenceRef(): Promise<void> {
  const fixture = await validFixture('illegal-evidence');
  const invalid = validSemanticOutput({
    check: 'materialGrounding',
    evidenceRefs: ['deterministic.decision'],
  });
  const { assessment } = await execute(fixture, [
    response(invalid),
    response(invalid),
  ]);
  assert(assessment.status === 'invalid_output', 'Illegal evidence ref was accepted.');
}

async function caseSingleChoiceNestedEvidenceRef(): Promise<void> {
  const fixture = await validFixture('single-choice-nested-evidence');
  const valid = validSemanticOutput({
    check: 'rubricAlignment',
    evidenceRefs: [
      'draft.choiceInteraction.correctOptionIds',
      'draft.options[0]:正确选项',
    ],
  });
  const { assessment, provider } = await execute(fixture, [response(valid)]);
  assert(assessment.status === 'completed', 'Legal single-choice field paths were rejected.');
  assert(provider.getCallCount() === 1, 'Legal single-choice evidence should not trigger repair.');
}

async function casePromptIdentity(): Promise<void> {
  const fixture = await validFixture('prompt-identity');
  const first = await execute(fixture, [response(validSemanticOutput())], {
    promptVersion: 'prompt-v1',
    requestId: 'request-prompt-v1',
  });
  const second = await execute(fixture, [response(validSemanticOutput())], {
    promptVersion: 'prompt-v2',
    requestId: 'request-prompt-v2',
  });
  assert(
    first.assessment.semanticRequestKey !== second.assessment.semanticRequestKey,
    'Prompt version did not change semantic request identity.',
  );
}

async function caseModelIdentity(): Promise<void> {
  const fixture = await validFixture('model-identity');
  const first = await execute(fixture, [response(validSemanticOutput())], {
    modelId: 'semantic-model-v1',
    requestId: 'request-model-v1',
  });
  const second = await execute(fixture, [response(validSemanticOutput())], {
    modelId: 'semantic-model-v2',
    requestId: 'request-model-v2',
  });
  assert(
    first.assessment.semanticRequestKey !== second.assessment.semanticRequestKey,
    'Model version did not change semantic request identity.',
  );
}

async function caseCompletedIdempotency(): Promise<void> {
  const fixture = await validFixture('idempotency');
  const cache = new InMemoryQuestionSemanticQualityAssessmentSessionCache();
  const provider = scripted([response(validSemanticOutput())]);
  const first = await runQuestionSemanticQualityAssessment(
    baseInput(fixture, { requestId: 'idempotency-first' }),
    { provider, cache },
  );
  const second = await runQuestionSemanticQualityAssessment(
    baseInput(fixture, { requestId: 'idempotency-second' }),
    { provider, cache },
  );
  assert(first.semanticAssessmentId === second.semanticAssessmentId, 'Completed result was not reused.');
  assert(provider.getCallCount() === 1, 'Idempotent call invoked Provider again.');
}

async function caseDeterministicIdentity(): Promise<void> {
  const fixture = await validFixture('deterministic-identity');
  const cache = new InMemoryQuestionSemanticQualityAssessmentSessionCache();
  const provider = scripted([
    response(validSemanticOutput()),
    response(validSemanticOutput()),
  ]);
  const first = await runQuestionSemanticQualityAssessment(
    baseInput(fixture, { requestId: 'deterministic-identity-first' }),
    { provider, cache },
  );
  const nextDeterministic = {
    ...fixture.deterministic,
    assessmentId: `${fixture.deterministic.assessmentId}:next`,
  };
  const second = await runQuestionSemanticQualityAssessment(
    {
      ...baseInput(fixture, { requestId: 'deterministic-identity-second' }),
      deterministicAssessment: nextDeterministic,
    },
    { provider, cache },
  );
  assert(
    first.semanticRequestKey !== second.semanticRequestKey,
    'Deterministic assessment did not change semantic request identity.',
  );
  assert(
    second.deterministicAssessmentId === nextDeterministic.assessmentId,
    'Semantic assessment reused a result bound to the previous deterministic assessment.',
  );
  assert(provider.getCallCount() === 2, 'Updated deterministic assessment reused the stale cache entry.');
}

async function caseFailureBundle(): Promise<void> {
  const fixture = await validFixture('failure-bundle');
  const { assessment } = await execute(fixture, [{
    type: 'error',
    category: 'provider_unavailable',
    retryable: true,
  }]);
  const bundle = mergeQuestionQualityAssessments({
    deterministic: fixture.deterministic,
    semantic: assessment,
    createdAt: NOW,
  });
  assert(bundle.decision === 'semantic_unavailable', 'Semantic failure silently became pass.');
  assert(isQuestionQualityAssessmentBundle(bundle), 'Failure bundle failed schema guard.');
}

async function caseConservativeMerge(): Promise<void> {
  const fixture = await validFixture('conservative');
  const { assessment } = await execute(fixture, [
    response(validSemanticOutput({
      check: 'scopeClarity',
      status: 'warning',
    })),
  ]);
  const bundle = mergeQuestionQualityAssessments({
    deterministic: fixture.deterministic,
    semantic: assessment,
    createdAt: NOW,
  });
  assert(bundle.effectiveChecks.scopeClarity === 'warning', 'Semantic warning was weakened.');
  assert(bundle.decision === 'review_with_warnings', 'Warning bundle decision is incorrect.');
}

async function caseDeterministicFailDominates(): Promise<void> {
  const fixture = await validFixture('deterministic-fail');
  const deterministic: QuestionQualityAssessment = {
    ...fixture.deterministic,
    checks: {
      ...fixture.deterministic.checks,
      materialGrounding: 'fail',
    },
    decision: 'revision_recommended',
  };
  const { assessment } = await execute(
    { ...fixture, deterministic },
    [response(validSemanticOutput())],
  );
  const bundle = mergeQuestionQualityAssessments({
    deterministic,
    semantic: assessment,
    createdAt: NOW,
  });
  assert(bundle.effectiveChecks.materialGrounding === 'fail', 'Semantic pass offset deterministic fail.');
  assert(bundle.decision === 'revision_recommended', 'Deterministic fail did not recommend revision.');
}

async function caseStrongWarning(): Promise<void> {
  const fixture = await validFixture('strong-warning');
  const { assessment } = await execute(fixture, [
    response(validSemanticOutput({
      check: 'rubricAlignment',
      status: 'strong_warning',
    })),
  ]);
  const bundle = mergeQuestionQualityAssessments({
    deterministic: fixture.deterministic,
    semantic: assessment,
    createdAt: NOW,
  });
  assert(bundle.decision === 'revision_recommended', 'Strong warning did not recommend revision.');
}

async function caseUnavailableBlocksFormalization(): Promise<void> {
  const fixture = await validFixture('unavailable-block');
  const { assessment } = await execute(fixture, [{
    type: 'error',
    category: 'provider_unavailable',
    retryable: true,
  }]);
  const bundle = mergeQuestionQualityAssessments({
    deterministic: fixture.deterministic,
    semantic: assessment,
    createdAt: NOW,
  });
  assert(!canApplyQualityReviewAction(bundle, 'approve'), 'Approve remained available.');
  assert(!canFreezeWithQualityBundle(bundle), 'Freeze remained available.');
}

async function caseUnavailableAllowsNegativeActions(): Promise<void> {
  const fixture = await validFixture('unavailable-negative');
  const { assessment } = await execute(fixture, [{
    type: 'error',
    category: 'provider_unavailable',
    retryable: true,
  }]);
  const bundle = mergeQuestionQualityAssessments({
    deterministic: fixture.deterministic,
    semantic: assessment,
    createdAt: NOW,
  });
  assert(
    canApplyQualityReviewAction(bundle, 'revision_required'),
    'Revision Required was incorrectly blocked.',
  );
  assert(canApplyQualityReviewAction(bundle, 'reject'), 'Reject was incorrectly blocked.');
}

async function execute(
  fixture: Fixture,
  steps: ScriptedDiagnosisProviderStep[],
  overrides: {
    promptVersion?: string;
    modelId?: string;
    requestId?: string;
  } = {},
): Promise<{
  assessment: Awaited<ReturnType<typeof runQuestionSemanticQualityAssessment>>;
  provider: ScriptedDiagnosisProviderAdapter;
}> {
  const provider = scripted(steps);
  const assessment = await runQuestionSemanticQualityAssessment(
    baseInput(fixture, overrides),
    { provider, now: () => NOW },
  );
  return { assessment, provider };
}

type Fixture = {
  repository: AdmissionRepository;
  draft: StructuredQuestionDraft;
  validation: ResourceValidationResult;
  material: NonNullable<Awaited<ReturnType<AdmissionRepository['getMaterial']>>>;
  deterministic: QuestionQualityAssessment;
};

async function validFixture(suffix: string): Promise<Fixture> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  await createQuestionMaterial(repository, {
    materialId: 'material-leaf',
    materialVersionId: 'material-leaf:v1',
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲整理书柜时，从一本旧书里发现一片已经褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: {
      sourceType: 'manual',
      description: 'Semantic quality fixture.',
      copyrightNote: 'Synthetic text.',
    },
    createdAt: NOW,
  });
  const draft = await createDraft(repository, suffix);
  const validation = await validateStructuredQuestionDraft(repository, draft.draftId, NOW);
  assert(validation.passed, 'Fixture validation failed.');
  const current = await requiredDraft(repository, draft.draftId);
  const material = await repository.getMaterial('material-leaf:v1');
  assert(material, 'Fixture material is missing.');
  const deterministic = assessQuestionDraftQuality({
    draft: current,
    validation,
    material,
    assessedAt: NOW,
  });
  assert(deterministic.decision === 'pass', 'Fixture deterministic assessment must pass.');
  return { repository, draft: current, validation, material, deterministic };
}

function baseInput(
  fixture: Fixture,
  overrides: {
    promptVersion?: string;
    modelId?: string;
    requestId?: string;
  } = {},
) {
  return {
    requestId: overrides.requestId || `semantic-request-${fixture.draft.draftId}`,
    draft: fixture.draft,
    validation: fixture.validation,
    material: fixture.material,
    deterministicAssessment: fixture.deterministic,
    provider: {
      providerId: PROVIDER_ID,
      modelId: overrides.modelId || 'semantic-model-v1',
      timeoutMs: 1000,
    },
    promptVersion: overrides.promptVersion,
    startedAt: NOW,
  };
}

async function createDraft(
  repository: AdmissionRepository,
  suffix: string,
): Promise<StructuredQuestionDraft> {
  const input: CreateStructuredQuestionDraftInput = {
    draftId: `semantic-draft-${suffix}`,
    resourceId: `semantic-resource-${suffix}`,
    taskId: `semantic-task-${suffix}`,
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
      description: 'Semantic quality fixture.',
      copyrightNote: 'Synthetic content.',
    },
    tags: ['阅读理解', '人物心理'],
    now: NOW,
  };
  return createStructuredQuestionDraft(repository, input);
}

function validRubric(): QuestionResourceRubricItem[] {
  return [
    {
      itemId: 'evidence',
      name: '动作依据',
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
      itemId: 'meaning',
      name: '心理解释',
      abilityId: 'inference',
      importance: 'important',
      required: true,
      evidenceRequirement: {
        requireExplanation: true,
        requireConclusion: true,
      },
      acceptedSignals: ['珍惜回忆', '舍不得丢弃'],
    },
  ];
}

function validSemanticOutput(
  override?: {
    check: typeof QUESTION_QUALITY_CHECKS[number];
    status?: SemanticCheckStatus;
    evidenceRefs?: string[];
  },
): string {
  return JSON.stringify({
    findings: QUESTION_QUALITY_CHECKS.map((check) => ({
      check,
      status: check === override?.check ? override.status || 'pass' : 'pass',
      reason: check === override?.check
        ? `人工应复核 ${check} 对应的语义风险。`
        : `${check} 具备可核对的材料与题目依据。`,
      evidenceRefs: check === override?.check && override.evidenceRefs
        ? override.evidenceRefs
        : defaultEvidenceRefs(check),
      suggestedReviewQuestion: `请复核 ${check} 是否支持当前观察目标。`,
    })),
    limitations: [],
  });
}

function defaultEvidenceRefs(
  check: typeof QUESTION_QUALITY_CHECKS[number],
): string[] {
  switch (check) {
    case 'materialGrounding':
      return ['material.content:捏着树叶站了很久'];
    case 'rubricAlignment':
    case 'discriminativePower':
      return ['draft.rubric'];
    case 'difficultyCoherence':
      return ['draft.abilityMetadata', 'draft.minimumAnswerRequirement'];
    default:
      return ['draft.questionStem'];
  }
}

function response(rawOutput: string): ScriptedDiagnosisProviderStep {
  return { type: 'response', rawOutput };
}

function scripted(
  steps: ScriptedDiagnosisProviderStep[],
): ScriptedDiagnosisProviderAdapter {
  return new ScriptedDiagnosisProviderAdapter(steps, PROVIDER_ID);
}

async function requiredDraft(
  repository: AdmissionRepository,
  draftId: string,
): Promise<StructuredQuestionDraft> {
  const draft = await repository.getDraft(draftId);
  assert(draft, `Draft ${draftId} is missing.`);
  return draft;
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
