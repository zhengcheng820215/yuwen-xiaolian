import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createTenMaterialCalibrationReport,
  evaluateTenMaterialCalibrationSystemChecks,
  type TenMaterialCalibrationInput,
} from '../agents/tenMaterialCalibrationAgent.ts';
import { LocalApiFormalResourceClient } from '../repositories/localApiFormalResourceClient.ts';
import { LocalApiQuestionQualityPersistenceRepository } from '../repositories/localApiQuestionQualityPersistenceRepository.ts';
import { QUESTION_QUALITY_RULE_VERSION } from '../schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_QUALITY_BATCH_SUMMARY_RULE_VERSION,
  QUESTION_QUALITY_BATCH_SUMMARY_VERSION,
  createQuestionQualityMetric,
  type QuestionGenerationBatchQualitySummary,
} from '../schemas/questionQualityBatchSummary.schema.ts';
import {
  createTenMaterialCalibrationManifest,
  type TenMaterialCalibrationManifest,
} from '../schemas/questionQualityCalibration.schema.ts';
import {
  QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION,
  type FrozenQuestionQualityTrace,
} from '../schemas/questionQualityPersistence.schema.ts';
import {
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  type QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';
import { createEmptySharedFormalResourceData } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import { createSharedFormalResourceBoundary } from '../../server/sharedFormalResourceBoundary.ts';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';

const NOW = '2026-07-26T16:30:00.000Z';

const cases: Array<{ name: string; run: () => void | Promise<void> }> = [
  { name: '01 manifest accepts exactly ten unique materials', run: caseValidManifest },
  { name: '02 manifest with nine materials is blocked', run: caseNineMaterialsBlocked },
  { name: '03 duplicate material version is blocked', run: caseDuplicateMaterialBlocked },
  { name: '04 all eight system checks can pass', run: caseAllChecksPass },
  { name: '05 missing material forces fail decision', run: caseMissingMaterialForcesFail },
  { name: '06 mixed semantic provider forces fail decision', run: caseMixedProviderForcesFail },
  { name: '07 missing frozen trace forces fail decision', run: caseMissingTraceForcesFail },
  { name: '08 repeated summary drift forces fail decision', run: caseUnstableSummaryForcesFail },
  { name: '09 human approver identity is required', run: caseApproverRequired },
  { name: '10 fail decision requires adjustment target', run: caseFailTargetRequired },
  { name: '11 conditional pass requires adjustment target', run: caseConditionalTargetRequired },
  { name: '12 conditional pass requires reviewer notes', run: caseConditionalNotesRequired },
  { name: '13 identical input creates stable report identity', run: caseStableReportIdentity },
  { name: '14 manifest version replacement is blocked by immutable identity', run: caseManifestReplacementBlocked },
  { name: '15 manifest report and summary survive restart', run: casePersistenceRestart },
  { name: '16 calibration does not mutate source facts', run: caseFactsRemainUnchanged },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.5C3B Ten-material Calibration Runtime Debug');
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

function caseValidManifest(): void {
  assert(fixture().manifest.materials.length === 10, 'Manifest did not keep ten materials.');
}

function caseNineMaterialsBlocked(): void {
  expectThrow(() => createTenMaterialCalibrationManifest({
    ...manifestInput(),
    materials: manifestInput().materials.slice(0, 9),
  }), 'exactly 10');
}

function caseDuplicateMaterialBlocked(): void {
  const input = manifestInput();
  input.materials[9] = {
    ...input.materials[9],
    materialVersionId: input.materials[0].materialVersionId,
  };
  expectThrow(() => createTenMaterialCalibrationManifest(input), 'unique');
}

function caseAllChecksPass(): void {
  const input = fixture();
  const checks = evaluateTenMaterialCalibrationSystemChecks(input);
  assert(Object.values(checks).every(Boolean), 'Not all calibration system checks passed.');
  assert(createTenMaterialCalibrationReport(input).decision === 'pass', 'Pass report was not created.');
}

function caseMissingMaterialForcesFail(): void {
  const input = fixture();
  input.summary = {
    ...input.summary,
    materialVersionIds: input.summary.materialVersionIds.slice(0, 9),
  };
  input.repeatedSummary = clone(input.summary);
  expectThrow(() => createTenMaterialCalibrationReport(input), 'must be fail');
  const report = createTenMaterialCalibrationReport({
    ...input,
    decision: 'fail',
    adjustmentTarget: 'material_manifest',
  });
  assert(!report.systemChecks.allMaterialsProcessed, 'Missing material was not recorded.');
}

function caseMixedProviderForcesFail(): void {
  const input = fixture();
  input.semanticAssessments[0] = {
    ...input.semanticAssessments[0],
    providerId: 'unexpected-provider',
  };
  expectThrow(() => createTenMaterialCalibrationReport(input), 'must be fail');
}

function caseMissingTraceForcesFail(): void {
  const input = fixture();
  input.frozenQualityTraces = input.frozenQualityTraces.slice(0, 9);
  expectThrow(() => createTenMaterialCalibrationReport(input), 'must be fail');
}

function caseUnstableSummaryForcesFail(): void {
  const input = fixture();
  input.repeatedSummary = {
    ...input.repeatedSummary,
    warningDistribution: { changed_warning: 1 },
  };
  expectThrow(() => createTenMaterialCalibrationReport(input), 'must be fail');
}

function caseApproverRequired(): void {
  expectThrow(
    () => createTenMaterialCalibrationReport({ ...fixture(), approvedBy: ' ' }),
    'approvedBy',
  );
}

function caseFailTargetRequired(): void {
  expectThrow(() => createTenMaterialCalibrationReport({
    ...fixture(),
    decision: 'fail',
    adjustmentTarget: 'none',
  }), 'adjustment target');
}

function caseConditionalTargetRequired(): void {
  expectThrow(() => createTenMaterialCalibrationReport({
    ...fixture(),
    decision: 'conditional_pass',
    adjustmentTarget: 'none',
    reviewerNotes: ['Observe the next batch.'],
  }), 'adjustment target');
}

function caseConditionalNotesRequired(): void {
  expectThrow(() => createTenMaterialCalibrationReport({
    ...fixture(),
    decision: 'conditional_pass',
    adjustmentTarget: 'prompt',
    reviewerNotes: [],
  }), 'requires reviewer');
}

function caseStableReportIdentity(): void {
  const input = fixture();
  const first = createTenMaterialCalibrationReport(input);
  const second = createTenMaterialCalibrationReport(clone(input));
  assert(first.reportId === second.reportId, 'Report identity is not deterministic.');
  assert(JSON.stringify(first) === JSON.stringify(second), 'Repeated report content drifted.');
}

async function caseManifestReplacementBlocked(): Promise<void> {
  await withRuntime(async ({ repository }) => {
    const manifest = fixture().manifest;
    await repository.saveCalibrationManifest(manifest);
    const changed: TenMaterialCalibrationManifest = {
      ...manifest,
      materials: manifest.materials.map((item, index) => (
        index === 0 ? { ...item, title: 'Changed title' } : item
      )),
    };
    await expectReject(
      repository.saveCalibrationManifest(changed),
      'identity_content_conflict',
    );
  });
}

async function casePersistenceRestart(): Promise<void> {
  await withRuntime(async ({ client, repository }) => {
    const input = fixture();
    const report = createTenMaterialCalibrationReport(input);
    await repository.saveCalibrationManifest(input.manifest);
    await repository.saveBatchSummary(input.summary);
    await repository.saveCalibrationReport(report);
    const restarted = new LocalApiQuestionQualityPersistenceRepository(client);
    assert(
      (await restarted.getCalibrationManifest(input.manifest.manifestId))?.manifestId ===
        input.manifest.manifestId,
      'Calibration manifest did not survive restart.',
    );
    assert(
      (await restarted.getBatchSummary(input.summary.summaryId))?.summaryId === input.summary.summaryId,
      'Batch summary did not survive restart.',
    );
    assert(
      (await restarted.getCalibrationReport(report.reportId))?.reportId === report.reportId,
      'Calibration report did not survive restart.',
    );
  });
}

function caseFactsRemainUnchanged(): void {
  const input = fixture();
  const beforeSummary = JSON.stringify(input.summary);
  const beforeTraces = JSON.stringify(input.frozenQualityTraces);
  createTenMaterialCalibrationReport(input);
  assert(JSON.stringify(input.summary) === beforeSummary, 'Summary fact was mutated.');
  assert(JSON.stringify(input.frozenQualityTraces) === beforeTraces, 'Freeze trace was mutated.');
}

function fixture(): TenMaterialCalibrationInput {
  const manifest = createTenMaterialCalibrationManifest(manifestInput());
  const summary = summaryFixture(manifest);
  return {
    manifest,
    summary,
    repeatedSummary: clone(summary),
    semanticAssessments: semanticFixtures(manifest),
    expectedFrozenResourceVersionIds: manifest.materials.map(
      (_, index) => `frozen-resource-v${index + 1}`,
    ),
    frozenQualityTraces: traceFixtures(manifest),
    qualityObservations: ['The fixed fixture meets the current engineering baseline.'],
    reviewerNotes: [],
    decision: 'pass',
    adjustmentTarget: 'none',
    decisionReason: 'All hard checks passed in the isolated engineering fixture.',
    approvedBy: 'calibration-reviewer',
    approvedAt: NOW,
  };
}

function manifestInput(): Omit<TenMaterialCalibrationManifest, 'manifestId' | 'version'> {
  return {
    calibrationSetId: 'phase17-5c3b-debug-set',
    calibrationSetVersion: 'v1',
    materials: Array.from({ length: 10 }, (_, index) => ({
      materialId: `material-${index + 1}`,
      materialVersionId: `material-${index + 1}:v1`,
      title: `Calibration material ${index + 1}`,
      expectedCoverageNotes: [`Coverage note ${index + 1}`],
    })),
    requiredProviderId: 'deepseek',
    requiredModelId: 'deepseek-v4-flash',
    requiredPromptVersion: QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
    requiredSemanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    requiredMergeRuleVersion: QUESTION_QUALITY_MERGE_RULE_VERSION,
    frozenAt: NOW,
  };
}

function summaryFixture(
  manifest: TenMaterialCalibrationManifest,
): QuestionGenerationBatchQualitySummary {
  return {
    summaryId: 'batch-summary:phase17-5c3b-debug:v1',
    batchId: 'phase17-5c3b-debug',
    batchVersion: 'v1',
    manifestId: 'batch-manifest:phase17-5c3b-debug:v1',
    reviewIds: manifest.materials.map((_, index) => `review-${index + 1}`),
    materialVersionIds: manifest.materials.map((item) => item.materialVersionId),
    bundleIds: manifest.materials.map((_, index) => `bundle-${index + 1}`),
    status: 'complete',
    counts: {
      materialCount: 10,
      draftCount: 10,
      currentBundleCount: 10,
      missingAssessmentCount: 0,
      staleAssessmentCount: 0,
      reviewedCount: 10,
    },
    decisionDistribution: {
      ready_for_review: 10,
      review_with_warnings: 0,
      revision_recommended: 0,
      semantic_unavailable: 0,
    },
    warningDistribution: {},
    abilityDistribution: { analysis: 5, inference: 5 },
    difficultyDistribution: { intermediate: 6, advanced: 4 },
    humanDecisionDistribution: {
      approve: 8,
      revisionRequired: 2,
      reject: 0,
      pending: 0,
    },
    metrics: {
      contractValidationPassRate: createQuestionQualityMetric(10, 10),
      semanticCompletionRate: createQuestionQualityMetric(10, 10),
      currentAssessmentCoverage: createQuestionQualityMetric(10, 10),
      duplicateObservationRate: createQuestionQualityMetric(0, 10),
      humanRetentionRate: createQuestionQualityMetric(8, 10),
      humanModificationRate: createQuestionQualityMetric(2, 10),
      humanRejectionRate: createQuestionQualityMetric(0, 10),
      averageReviewDurationMs: createQuestionQualityMetric(600000, 10),
    },
    issues: [],
    deterministicRuleVersions: [QUESTION_QUALITY_RULE_VERSION],
    semanticRuleVersions: [QUESTION_SEMANTIC_QUALITY_RULE_VERSION],
    promptVersions: [QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION],
    mergeRuleVersions: [QUESTION_QUALITY_MERGE_RULE_VERSION],
    summaryRuleVersion: QUESTION_QUALITY_BATCH_SUMMARY_RULE_VERSION,
    generatedAt: NOW,
    version: QUESTION_QUALITY_BATCH_SUMMARY_VERSION,
  };
}

function semanticFixtures(
  manifest: TenMaterialCalibrationManifest,
): QuestionSemanticQualityAssessment[] {
  const checks = [
    'materialGrounding',
    'observationClarity',
    'observationDistinctness',
    'discriminativePower',
    'difficultyCoherence',
    'rubricAlignment',
    'scopeClarity',
  ] as const;
  return manifest.materials.map((material, index) => ({
    semanticAssessmentId: `semantic-${index + 1}`,
    semanticRequestKey: `semantic-request-key-${index + 1}`,
    requestId: `semantic-request-${index + 1}`,
    draftId: `draft-${index + 1}`,
    resourceId: `resource-${index + 1}`,
    assessedDraftRevision: 1,
    validationId: `validation-${index + 1}`,
    materialVersionId: material.materialVersionId,
    deterministicAssessmentId: `deterministic-${index + 1}`,
    status: 'completed',
    findings: checks.map((check) => ({
      check,
      status: 'pass',
      reason: `${check} passed.`,
      evidenceRefs: [`draft-${index + 1}:${check}`],
    })),
    limitations: [],
    providerId: manifest.requiredProviderId,
    modelId: manifest.requiredModelId,
    promptVersion: manifest.requiredPromptVersion,
    semanticRuleVersion: manifest.requiredSemanticRuleVersion,
    outputSchemaVersion: QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
    startedAt: NOW,
    completedAt: NOW,
  }));
}

function traceFixtures(
  manifest: TenMaterialCalibrationManifest,
): FrozenQuestionQualityTrace[] {
  return manifest.materials.map((_, index) => ({
    traceId: `trace-${index + 1}`,
    resourceId: `resource-${index + 1}`,
    resourceVersionId: `frozen-resource-v${index + 1}`,
    sourceDraftId: `draft-${index + 1}`,
    frozenDraftRevision: 1,
    validationId: `validation-${index + 1}`,
    reviewId: `review-${index + 1}`,
    deterministicAssessmentId: `deterministic-${index + 1}`,
    semanticAssessmentId: `semantic-${index + 1}`,
    bundleId: `bundle-${index + 1}`,
    deterministicRuleVersion: QUESTION_QUALITY_RULE_VERSION,
    semanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    mergeRuleVersion: QUESTION_QUALITY_MERGE_RULE_VERSION,
    tracedAt: NOW,
    schemaVersion: QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION,
  }));
}

async function withRuntime(
  run: (runtime: {
    client: LocalApiFormalResourceClient;
    repository: LocalApiQuestionQualityPersistenceRepository;
  }) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase17-5c3b-'));
  const store = new SharedFormalResourceStore({
    storePath: join(directory, 'formal-resource-store.json'),
    now: () => NOW,
  });
  const boundary = createSharedFormalResourceBoundary(store);
  const server = createServer((request, response) => {
    void boundary(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  try {
    await listen(server);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Debug server address missing.');
    const client = new LocalApiFormalResourceClient(
      `http://127.0.0.1:${address.port}`,
      fetch,
    );
    await client.initialize(createEmptySharedFormalResourceData(), 'phase17-5c3b-debug');
    await run({
      client,
      repository: new LocalApiQuestionQualityPersistenceRepository(client),
    });
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function expectThrow(operation: () => unknown, fragment: string): void {
  try {
    operation();
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes(fragment),
      `Expected error containing "${fragment}".`,
    );
    return;
  }
  throw new Error(`Expected error containing "${fragment}".`);
}

async function expectReject(operation: Promise<unknown>, fragment: string): Promise<void> {
  try {
    await operation;
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes(fragment),
      `Expected rejection containing "${fragment}".`,
    );
    return;
  }
  throw new Error(`Expected rejection containing "${fragment}".`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main();
