import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  summarizeQuestionGenerationBatchQuality,
  type QuestionGenerationBatchQualitySummaryInput,
} from '../agents/questionQualityBatchSummaryAgent.ts';
import { LocalApiFormalResourceClient } from '../repositories/localApiFormalResourceClient.ts';
import { LocalApiQuestionQualityPersistenceRepository } from '../repositories/localApiQuestionQualityPersistenceRepository.ts';
import {
  QUESTION_QUALITY_ASSESSMENT_VERSION,
  QUESTION_QUALITY_RULE_VERSION,
  type QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_QUALITY_BATCH_MANIFEST_VERSION,
  type QuestionGenerationQualityBatchManifest,
} from '../schemas/questionQualityBatchSummary.schema.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  type QuestionQualityAssessmentBundle,
  type QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';
import { createEmptySharedFormalResourceData } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import { createSharedFormalResourceBoundary } from '../../server/sharedFormalResourceBoundary.ts';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';

const NOW = '2026-07-26T15:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 complete manifest forms complete summary', run: caseComplete },
  { name: '02 missing assessment forms incomplete summary', run: caseMissing },
  { name: '03 mixed draft revision is detected', run: caseMixedRevision },
  { name: '04 mixed quality rule is detected', run: caseMixedRule },
  { name: '05 duplicate draft ref is counted once', run: caseDuplicateRef },
  { name: '06 zero denominator produces null metric', run: caseNullMetric },
  { name: '07 bundle decision distribution is correct', run: caseDecisionDistribution },
  { name: '08 warning distribution is correct', run: caseWarningDistribution },
  { name: '09 human decision and pending distributions are correct', run: caseHumanDistribution },
  { name: '10 summary identity ignores input order', run: caseOrderIndependentIdentity },
  { name: '11 changed review creates a new summary identity', run: caseChangedReviewIdentity },
  { name: '12 duplicate current bundle blocks summary', run: caseDuplicateCurrentBundle },
  { name: '13 manifest and summary persist and recover after restart', run: casePersistenceRestart },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.5C3A Batch Quality Summary Debug');
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

async function caseComplete(): Promise<void> {
  const summary = summarizeQuestionGenerationBatchQuality(fixture());
  assert(summary.status === 'complete', `Expected complete, got ${summary.status}.`);
  assert(summary.counts.currentBundleCount === 2, 'Current bundles were not counted.');
  assert(summary.metrics.currentAssessmentCoverage.value === 1, 'Coverage should be 100%.');
}

async function caseMissing(): Promise<void> {
  const input = fixture();
  input.bundles = input.bundles.slice(0, 1);
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.status === 'incomplete', 'Missing bundle did not form incomplete summary.');
  assert(summary.counts.missingAssessmentCount === 1, 'Missing bundle count is wrong.');
}

async function caseMixedRevision(): Promise<void> {
  const input = fixture();
  input.drafts[0] = { ...input.drafts[0], revision: 2 };
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.status === 'mixed_versions', 'Mixed draft revision was not detected.');
  assert(summary.counts.staleAssessmentCount > 0, 'Stale count was not recorded.');
}

async function caseMixedRule(): Promise<void> {
  const input = fixture();
  input.deterministicAssessments[0] = {
    ...input.deterministicAssessments[0],
    ruleVersion: 'legacy-rules',
  };
  input.bundles[0] = {
    ...input.bundles[0],
    deterministicRuleVersion: 'legacy-rules',
  };
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.status === 'mixed_versions', 'Old deterministic rule was not detected.');
}

async function caseDuplicateRef(): Promise<void> {
  const input = fixture();
  input.manifest.draftRefs.push({ ...input.manifest.draftRefs[0] });
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.counts.draftCount === 2, 'Duplicate Draft Ref was counted twice.');
  assert(summary.issues.some((issue) => issue.startsWith('duplicate_draft_ref:')), 'Duplicate issue missing.');
}

async function caseNullMetric(): Promise<void> {
  const input = fixture();
  input.manifest.generatedCandidateCount = 0;
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.metrics.contractValidationPassRate.value === null, 'Zero denominator should be null.');
}

async function caseDecisionDistribution(): Promise<void> {
  const input = fixture();
  input.bundles[1] = {
    ...input.bundles[1],
    decision: 'review_with_warnings',
    warningCodes: ['scope_too_broad'],
  };
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.decisionDistribution.ready_for_review === 1, 'Ready count is wrong.');
  assert(summary.decisionDistribution.review_with_warnings === 1, 'Warning count is wrong.');
}

async function caseWarningDistribution(): Promise<void> {
  const input = fixture();
  input.bundles = input.bundles.map((bundle) => ({
    ...bundle,
    warningCodes: ['duplicate_observation', 'scope_too_broad'],
  }));
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.warningDistribution.duplicate_observation === 2, 'Duplicate warning count is wrong.');
  assert(summary.metrics.duplicateObservationRate.value === 1, 'Duplicate rate is wrong.');
}

async function caseHumanDistribution(): Promise<void> {
  const input = fixture();
  input.reviews = [reviewFor(input.drafts[0], 'revision_required', 'review-1')];
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.humanDecisionDistribution.revisionRequired === 1, 'Revision count is wrong.');
  assert(summary.humanDecisionDistribution.pending === 1, 'Pending count is wrong.');
  assert(summary.metrics.humanModificationRate.value === 1, 'Modification rate is wrong.');
}

async function caseOrderIndependentIdentity(): Promise<void> {
  const first = fixture();
  const second = fixture();
  second.manifest.draftRefs.reverse();
  second.manifest.materialVersionIds.reverse();
  second.bundles.reverse();
  second.reviews.reverse();
  assert(
    summarizeQuestionGenerationBatchQuality(first).summaryId ===
      summarizeQuestionGenerationBatchQuality(second).summaryId,
    'Summary identity depends on input order.',
  );
}

async function caseChangedReviewIdentity(): Promise<void> {
  const first = fixture();
  const second = fixture();
  second.reviews[0] = reviewFor(second.drafts[0], 'reject', 'review-replacement');
  assert(
    summarizeQuestionGenerationBatchQuality(first).summaryId !==
      summarizeQuestionGenerationBatchQuality(second).summaryId,
    'Changed Review did not create a new Summary identity.',
  );
}

async function caseDuplicateCurrentBundle(): Promise<void> {
  const input = fixture();
  input.bundles.push({ ...input.bundles[0], bundleId: 'duplicate-current-bundle' });
  const summary = summarizeQuestionGenerationBatchQuality(input);
  assert(summary.status === 'blocked', 'Duplicate current Bundle did not block Summary.');
}

async function casePersistenceRestart(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase17-5c3a-'));
  const store = new SharedFormalResourceStore({
    storePath: join(directory, 'formal-resource-store.json'),
    now: () => NOW,
  });
  const { server, endpoint } = await startRuntime(store);
  try {
    const client = new LocalApiFormalResourceClient(endpoint);
    await client.initialize(createEmptySharedFormalResourceData(), 'phase17-5c3a-debug');
    const repository = new LocalApiQuestionQualityPersistenceRepository(client);
    const input = fixture();
    const summary = summarizeQuestionGenerationBatchQuality(input);
    await repository.saveBatchManifest(input.manifest);
    await repository.saveBatchSummary(summary);
    const restarted = new LocalApiQuestionQualityPersistenceRepository(
      new LocalApiFormalResourceClient(endpoint),
    );
    assert(
      (await restarted.getBatchManifest(input.manifest.manifestId))?.manifestId ===
        input.manifest.manifestId,
      'Manifest was not restored.',
    );
    assert(
      (await restarted.getBatchSummary(summary.summaryId))?.summaryId === summary.summaryId,
      'Summary was not restored.',
    );
    await repository.saveBatchSummary(summary);
    const state = (await client.read()).snapshot.data.questionQuality;
    assert(state.batchSummaries.length === 1, 'Idempotent Summary was duplicated.');
  } finally {
    await stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }
}

function fixture(): QuestionGenerationBatchQualitySummaryInput {
  const drafts = [draft('a', 'analysis', 'intermediate'), draft('b', 'inference', 'advanced')];
  const validations = drafts.map(validationFor);
  const deterministicAssessments = drafts.map((item, index) => deterministicFor(
    item,
    validations[index],
  ));
  const semanticAssessments = drafts.map((item, index) => semanticFor(
    item,
    deterministicAssessments[index],
  ));
  const bundles = drafts.map((item, index) => bundleFor(
    item,
    deterministicAssessments[index],
    semanticAssessments[index],
  ));
  const reviews = drafts.map((item, index) => reviewFor(item, 'approve', `review-${index + 1}`));
  const manifest: QuestionGenerationQualityBatchManifest = {
    manifestId: 'manifest-batch-a-v1',
    batchId: 'batch-a',
    batchVersion: 'v1',
    materialVersionIds: ['material-a:v1', 'material-b:v1'],
    generationRequestIds: ['request-a', 'request-b'],
    generatedCandidateCount: 2,
    draftRefs: drafts.map((item, index) => ({
      draftId: item.draftId,
      resourceId: item.resourceId,
      draftRevision: item.revision,
      validationId: validations[index].validationId,
    })),
    createdAt: NOW,
    frozenAt: NOW,
    version: QUESTION_QUALITY_BATCH_MANIFEST_VERSION,
  };
  return {
    manifest,
    drafts,
    validations,
    deterministicAssessments,
    semanticAssessments,
    bundles,
    reviews,
    reviewStartedAtByReviewId: {
      'review-1': '2026-07-26T14:58:00.000Z',
      'review-2': '2026-07-26T14:59:00.000Z',
    },
    generatedAt: NOW,
  };
}

function draft(
  suffix: string,
  abilityId: 'analysis' | 'inference',
  difficulty: 'intermediate' | 'advanced',
): StructuredQuestionDraft {
  return {
    draftId: `draft-${suffix}`,
    resourceId: `resource-${suffix}`,
    taskId: `task-${suffix}`,
    proposedVersionNumber: 1,
    materialVersionId: `material-${suffix}:v1`,
    title: `Question ${suffix}`,
    questionStem: '结合材料说明人物行为体现的心理。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'structured',
    rubric: [{
      itemId: `rubric-${suffix}`,
      name: 'Evidence reasoning',
      abilityId,
      importance: 'critical',
      required: true,
      acceptedSignals: ['evidence', 'explanation'],
    }],
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId,
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty,
    },
    source: { sourceType: 'ai_assisted', description: 'C3A debug.' },
    tags: [],
    status: 'reviewed',
    revision: 1,
    latestValidationId: `validation-${suffix}`,
    latestReviewId: `review-${suffix === 'a' ? '1' : '2'}`,
    createdAt: NOW,
    updatedAt: NOW,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function validationFor(item: StructuredQuestionDraft): ResourceValidationResult {
  return {
    validationId: item.latestValidationId || '',
    draftId: item.draftId,
    resourceId: item.resourceId,
    validatedDraftRevision: item.revision,
    validationRuleVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    passed: true,
    checks: {
      identityValid: true,
      contentValid: true,
      answerAcceptanceValid: true,
      rubricValid: true,
      abilityAndRoleValid: true,
      versionLineageValid: true,
      materialValid: true,
    },
    issues: [],
    checkedAt: NOW,
  };
}

function deterministicFor(
  item: StructuredQuestionDraft,
  validation: ResourceValidationResult,
): QuestionQualityAssessment {
  return {
    assessmentId: `deterministic-${item.draftId}`,
    draftId: item.draftId,
    resourceId: item.resourceId,
    assessedDraftRevision: item.revision,
    validationId: validation.validationId,
    checks: {
      materialGrounding: 'pass',
      observationClarity: 'pass',
      observationDistinctness: 'pass',
      discriminativePower: 'pass',
      difficultyCoherence: 'pass',
      rubricAlignment: 'pass',
      scopeClarity: 'pass',
    },
    decision: 'pass',
    warnings: [],
    assessedAt: NOW,
    ruleVersion: QUESTION_QUALITY_RULE_VERSION,
    version: QUESTION_QUALITY_ASSESSMENT_VERSION,
  };
}

function semanticFor(
  item: StructuredQuestionDraft,
  deterministic: QuestionQualityAssessment,
): QuestionSemanticQualityAssessment {
  return {
    semanticAssessmentId: `semantic-${item.draftId}`,
    semanticRequestKey: `semantic-request-${item.draftId}`,
    requestId: `request-${item.draftId}`,
    draftId: item.draftId,
    resourceId: item.resourceId,
    assessedDraftRevision: item.revision,
    validationId: deterministic.validationId,
    materialVersionId: item.materialVersionId || '',
    deterministicAssessmentId: deterministic.assessmentId,
    status: 'completed',
    findings: [
      'materialGrounding',
      'observationClarity',
      'observationDistinctness',
      'discriminativePower',
      'difficultyCoherence',
      'rubricAlignment',
      'scopeClarity',
    ].map((check) => ({
      check: check as QuestionSemanticQualityAssessment['findings'][number]['check'],
      status: 'pass',
      reason: `${check} passed.`,
      evidenceRefs: ['draft.questionStem'],
    })),
    limitations: [],
    providerId: 'debug-provider',
    modelId: 'debug-model',
    promptVersion: QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
    semanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    outputSchemaVersion: QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
    startedAt: NOW,
    completedAt: NOW,
  };
}

function bundleFor(
  item: StructuredQuestionDraft,
  deterministic: QuestionQualityAssessment,
  semantic: QuestionSemanticQualityAssessment,
): QuestionQualityAssessmentBundle {
  return {
    bundleId: `bundle-${item.draftId}`,
    draftId: item.draftId,
    resourceId: item.resourceId,
    assessedDraftRevision: item.revision,
    validationId: deterministic.validationId,
    deterministicAssessmentId: deterministic.assessmentId,
    semanticAssessmentId: semantic.semanticAssessmentId,
    effectiveChecks: { ...deterministic.checks },
    decision: 'ready_for_review',
    warningCodes: [],
    deterministicRuleVersion: deterministic.ruleVersion,
    semanticRuleVersion: semantic.semanticRuleVersion,
    mergeRuleVersion: QUESTION_QUALITY_MERGE_RULE_VERSION,
    createdAt: NOW,
  };
}

function reviewFor(
  item: StructuredQuestionDraft,
  action: ResourceReviewDecision['action'],
  reviewId: string,
): ResourceReviewDecision {
  return {
    reviewId,
    draftId: item.draftId,
    resourceId: item.resourceId,
    reviewedDraftRevision: item.revision,
    validationId: item.latestValidationId || '',
    action,
    reviewerId: 'human-reviewer',
    notes: 'Reviewed manually.',
    reviewedAt: NOW,
  };
}

async function startRuntime(
  store: SharedFormalResourceStore,
): Promise<{ server: Server; endpoint: string }> {
  const boundary = createSharedFormalResourceBoundary(store);
  const server = createServer((request, response) => {
    void boundary(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Debug server address missing.');
  return { server, endpoint: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main();
