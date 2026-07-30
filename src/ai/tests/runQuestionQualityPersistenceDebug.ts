import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  freezeQuestionResourceDraft,
  createQuestionMaterial,
  createStructuredQuestionDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import {
  assessQuestionDraftQuality,
} from '../agents/questionQualityAssessmentAgent.ts';
import {
  mergeQuestionQualityAssessments,
} from '../agents/questionSemanticQualityAssessmentAgent.ts';
import {
  freezeQuestionResourceDraftWithPersistedQuality,
  persistQuestionQualityBundle,
  prepareQuestionResourceFreezeWithPersistedQuality,
  requireCurrentPersistedQualityContext,
  reviewQuestionResourceDraftWithPersistedQuality,
} from '../agents/questionQualityPersistenceService.ts';
import { LocalApiFormalResourceClient } from '../repositories/localApiFormalResourceClient.ts';
import { LocalApiQuestionQualityPersistenceRepository } from '../repositories/localApiQuestionQualityPersistenceRepository.ts';
import { LocalApiQuestionResourceAdmissionRepository } from '../repositories/localApiQuestionResourceAdmissionRepository.ts';
import {
  LEGACY_SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
  SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
  createEmptySharedFormalResourceData,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';
import {
  QUESTION_QUALITY_CHECKS,
  type QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  type QuestionQualityAssessmentBundle,
  type QuestionSemanticQualityAssessment,
  type SemanticCheckStatus,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';
import type {
  QuestionResourceRubricItem,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  RESOURCE_OBSERVATION_LINK_SCHEMA_VERSION,
  type ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';
import { createSharedFormalResourceBoundary } from '../../server/sharedFormalResourceBoundary.ts';
import {
  SharedFormalResourceConflictError,
  SharedFormalResourceStore,
} from '../../server/sharedFormalResourceStore.ts';

const NOW = '2026-07-26T13:00:00.000Z';
const LATER = '2026-07-26T14:00:00.000Z';

type Runtime = {
  directory: string;
  storePath: string;
  store: SharedFormalResourceStore;
  server: Server;
  client: LocalApiFormalResourceClient;
  resources: LocalApiQuestionResourceAdmissionRepository;
  quality: LocalApiQuestionQualityPersistenceRepository;
};

type QualityFixture = {
  draft: StructuredQuestionDraft;
  deterministic: QuestionQualityAssessment;
  semantic: QuestionSemanticQualityAssessment;
  bundle: QuestionQualityAssessmentBundle;
};

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 legacy 17.4A store migrates additively', run: caseLegacyMigration },
  { name: '02 deterministic assessment survives restart', run: caseDeterministicRestart },
  { name: '03 semantic assessment and bundle survive restart', run: caseBundleRestart },
  { name: '04 identical persistence is idempotent', run: caseIdempotentSave },
  { name: '05 same identity with changed content is blocked', run: caseIdentityConflict },
  { name: '06 multiple draft revisions are preserved and isolated', run: caseRevisionIsolation },
  { name: '07 missing persisted bundle blocks approval', run: caseMissingBundleBlocksApproval },
  { name: '08 unavailable semantic result blocks approval', run: caseUnavailableBlocksApproval },
  { name: '09 revision recommendation approval requires notes', run: caseRevisionNotesRequired },
  { name: '10 freeze atomically writes version registry and trace', run: caseAtomicFreeze },
  { name: '11 frozen trace survives runtime restart', run: caseTraceRestart },
  { name: '12 repeated freeze is idempotent with the same trace', run: caseFreezeIdempotency },
  { name: '13 failed atomic commit rolls back version registry and trace', run: caseFreezeRollback },
  { name: '14 stale assessment bundle is blocked after draft edit', run: caseStaleBundleBlocked },
  { name: '15 legacy frozen resource is not assigned a fabricated trace', run: caseLegacyTraceAbsent },
  { name: '16 stale shared-store revision is rejected', run: caseStoreRevisionConflict },
  { name: '17 legacy quality rules cannot authorize current review', run: caseLegacyRuleBlocked },
  { name: '18 review workbench quality interface uses the shared store', run: caseWorkbenchQualityInterfacePersists },
  { name: '19 Human Review binds the current quality bundle', run: caseReviewBindsCurrentBundle },
  { name: '20 unbound Human Review blocks traced Freeze', run: caseUnboundReviewBlocksFreeze },
  { name: '21 identical Human Review retry is idempotent', run: caseReviewRetryIdempotent },
  { name: '22 conflicting Human Review retry is blocked', run: caseReviewRetryConflict },
  { name: '23 publication atomically writes version registry trace and link', run: caseAtomicPublication },
  { name: '24 failed publication leaves no partial records and retry is idempotent', run: casePublicationRollbackAndRetry },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.5C2 Assessment Persistence and Frozen Traceability Debug');

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

async function caseLegacyMigration(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase17-5c2-migration-'));
  const storePath = join(directory, 'formal-resource-store.json');
  const current = createEmptySharedFormalResourceData();
  const { questionQuality: _quality, ...legacyData } = current;
  await writeFile(storePath, JSON.stringify({
    schemaVersion: LEGACY_SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
    initialized: true,
    revision: 4,
    baselineSource: 'legacy-debug',
    createdAt: NOW,
    updatedAt: NOW,
    data: legacyData,
  }), 'utf8');
  try {
    const store = new SharedFormalResourceStore({ storePath, now: () => LATER });
    const migrated = await store.read();
    assert(
      migrated.schemaVersion === SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
      'Legacy store schema was not upgraded.',
    );
    assert(migrated.revision === 5, 'Migration did not advance store revision.');
    assert(
      migrated.data.questionQuality.assessmentBundles.length === 0,
      'Migration did not create empty quality collections.',
    );
    await readFile(`${storePath}.bak`, 'utf8');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function caseDeterministicRestart(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'deterministic-restart');
    await runtime.quality.saveDeterministicAssessment(fixture.deterministic);
    const second = qualityRepository(runtime.client);
    const restored = await second.getDeterministicAssessment(
      fixture.deterministic.assessmentId,
    );
    assert(restored?.assessmentId === fixture.deterministic.assessmentId, 'Assessment was not restored.');
  });
}

async function caseBundleRestart(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'bundle-restart');
    await persistQuestionQualityBundle(runtime.quality, fixture);
    const second = qualityRepository(runtime.client);
    assert(
      (await second.getSemanticAssessment(fixture.semantic.semanticAssessmentId))?.status === 'completed',
      'Semantic assessment was not restored.',
    );
    assert(
      (await second.getBundle(fixture.bundle.bundleId))?.bundleId === fixture.bundle.bundleId,
      'Bundle was not restored.',
    );
  });
}

async function caseIdempotentSave(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'idempotent');
    await persistQuestionQualityBundle(runtime.quality, fixture);
    await persistQuestionQualityBundle(runtime.quality, fixture);
    const state = (await runtime.client.read()).snapshot.data.questionQuality;
    assert(state.deterministicAssessments.length === 1, 'Deterministic assessment duplicated.');
    assert(state.semanticAssessments.length === 1, 'Semantic assessment duplicated.');
    assert(state.assessmentBundles.length === 1, 'Bundle duplicated.');
  });
}

async function caseIdentityConflict(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'identity-conflict');
    await runtime.quality.saveDeterministicAssessment(fixture.deterministic);
    await assertRejects(
      () => runtime.quality.saveDeterministicAssessment({
        ...fixture.deterministic,
        assessedAt: LATER,
      }),
      'identity_content_conflict',
    );
  });
}

async function caseRevisionIsolation(): Promise<void> {
  await withRuntime(async (runtime) => {
    const first = await createQualityFixture(runtime, 'revision-isolation');
    await persistQuestionQualityBundle(runtime.quality, first);
    const updated = await updateStructuredQuestionDraft(
      runtime.resources,
      first.draft.draftId,
      { title: 'Revision 2 title' },
      LATER,
    );
    await validateStructuredQuestionDraft(runtime.resources, updated.draftId, LATER);
    const second = await qualityFixtureForExistingDraft(runtime, updated.draftId, 'revision-2');
    await persistQuestionQualityBundle(runtime.quality, second);
    const all = await runtime.quality.listDeterministicForDraft(updated.draftId);
    assert(all.length === 2, 'Previous revision assessment was not preserved.');
    assert(all[0]?.assessedDraftRevision === 2, 'Current revision was not returned first.');
  });
}

async function caseMissingBundleBlocksApproval(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'missing-bundle');
    await runtime.quality.saveDeterministicAssessment(fixture.deterministic);
    await runtime.quality.saveSemanticAssessment(fixture.semantic);
    await submitQuestionResourceForReview(runtime.resources, fixture.draft.draftId, NOW);
    await assertRejects(
      () => reviewQuestionResourceDraftWithPersistedQuality(
        runtime.resources,
        runtime.quality,
        {
          draftId: fixture.draft.draftId,
          action: 'approve',
          reviewerId: 'reviewer',
          notes: 'Checked.',
          now: NOW,
        },
      ),
      'persisted quality bundle',
    );
  });
}

async function caseUnavailableBlocksApproval(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'unavailable', 'provider_failed');
    await persistQuestionQualityBundle(runtime.quality, fixture);
    await submitQuestionResourceForReview(runtime.resources, fixture.draft.draftId, NOW);
    await assertRejects(
      () => reviewQuestionResourceDraftWithPersistedQuality(
        runtime.resources,
        runtime.quality,
        {
          draftId: fixture.draft.draftId,
          action: 'approve',
          reviewerId: 'reviewer',
          notes: 'Should remain blocked.',
          now: NOW,
        },
      ),
      'blocks approval',
    );
    const revisionDecision = await reviewQuestionResourceDraftWithPersistedQuality(
      runtime.resources,
      runtime.quality,
      {
        draftId: fixture.draft.draftId,
        action: 'revision_required',
        reviewerId: 'reviewer',
        notes: '语义服务不可用，退回后重新检查。',
        now: NOW,
      },
    );
    assert(
      revisionDecision.action === 'revision_required' &&
      revisionDecision.qualityAssessmentBundleId === fixture.bundle.bundleId,
      'Unavailable semantic result did not preserve a revision decision trace.',
    );
  });
}

async function caseRevisionNotesRequired(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'revision-notes', 'completed', 'strong_warning');
    await persistQuestionQualityBundle(runtime.quality, fixture);
    await submitQuestionResourceForReview(runtime.resources, fixture.draft.draftId, NOW);
    await assertRejects(
      () => reviewQuestionResourceDraftWithPersistedQuality(
        runtime.resources,
        runtime.quality,
        {
          draftId: fixture.draft.draftId,
          action: 'approve',
          reviewerId: 'reviewer',
          notes: '',
          now: NOW,
        },
      ),
      'requires review notes',
    );
  });
}

async function caseAtomicFreeze(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'atomic-freeze');
    const before = (await runtime.client.read()).snapshot.revision;
    const result = await freezeQuestionResourceDraftWithPersistedQuality(
      runtime.resources,
      runtime.quality,
      fixture.draft.draftId,
      NOW,
    );
    const after = await runtime.client.read();
    assert(result.inserted, 'Quality traced Freeze was not inserted.');
    assert(after.snapshot.revision === before + 1, 'Freeze was not one Store revision.');
    assert(after.snapshot.data.questionResources.versions.length === 1, 'Version is missing.');
    assert(after.snapshot.data.questionResources.registryEntries.length === 1, 'Registry is missing.');
    assert(after.snapshot.data.questionQuality.frozenQualityTraces.length === 1, 'Trace is missing.');
  });
}

async function caseTraceRestart(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'trace-restart');
    const result = await freezeQuestionResourceDraftWithPersistedQuality(
      runtime.resources,
      runtime.quality,
      fixture.draft.draftId,
      NOW,
    );
    const second = qualityRepository(runtime.client);
    const restored = await second.getTraceForResourceVersion(
      result.version.resourceVersionId,
    );
    assert(restored?.bundleId === fixture.bundle.bundleId, 'Frozen trace was not restored.');
  });
}

async function caseFreezeIdempotency(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'freeze-idempotency');
    const first = await freezeQuestionResourceDraftWithPersistedQuality(
      runtime.resources,
      runtime.quality,
      fixture.draft.draftId,
      NOW,
    );
    const second = await freezeQuestionResourceDraftWithPersistedQuality(
      runtime.resources,
      runtime.quality,
      fixture.draft.draftId,
      NOW,
    );
    assert(!second.inserted, 'Repeated Freeze inserted duplicate records.');
    assert(first.trace.traceId === second.trace.traceId, 'Repeated Freeze returned another trace.');
  });
}

async function caseFreezeRollback(): Promise<void> {
  let failCommit = false;
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'freeze-rollback');
    failCommit = true;
    await assertRejects(
      () => freezeQuestionResourceDraftWithPersistedQuality(
        runtime.resources,
        runtime.quality,
        fixture.draft.draftId,
        NOW,
      ),
      'Simulated shared resource commit failure',
    );
    failCommit = false;
    const state = (await runtime.client.read()).snapshot.data;
    assert(state.questionResources.versions.length === 0, 'Failed Freeze left a version.');
    assert(state.questionResources.registryEntries.length === 0, 'Failed Freeze changed Registry.');
    assert(state.questionQuality.frozenQualityTraces.length === 0, 'Failed Freeze left a trace.');
  }, () => failCommit);
}

async function caseAtomicPublication(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'atomic-publication');
    const commit = await prepareQuestionResourceFreezeWithPersistedQuality(
      runtime.resources,
      runtime.quality,
      fixture.draft.draftId,
      NOW,
    );
    const before = (await runtime.client.read()).snapshot.revision;
    const result = await runtime.quality.commitPublicationWithObservationLink({
      ...commit,
      observationLink: observationLinkFixture(commit.resourceCommit.version),
    });
    const after = await runtime.client.read();

    assert(result.inserted, 'Atomic publication was not inserted.');
    assert(after.snapshot.revision === before + 1, 'Publication used more than one Store revision.');
    assert(after.snapshot.data.questionResources.versions.length === 1, 'Version is missing.');
    assert(after.snapshot.data.questionResources.registryEntries.length === 1, 'Registry is missing.');
    assert(after.snapshot.data.questionQuality.frozenQualityTraces.length === 1, 'Trace is missing.');
    assert(after.snapshot.data.materialObservations.links.length === 1, 'Observation Link is missing.');
  });
}

async function casePublicationRollbackAndRetry(): Promise<void> {
  let failCommit = false;
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'publication-rollback');
    const commit = await prepareQuestionResourceFreezeWithPersistedQuality(
      runtime.resources,
      runtime.quality,
      fixture.draft.draftId,
      NOW,
    );
    const publication = {
      ...commit,
      observationLink: observationLinkFixture(commit.resourceCommit.version),
    };

    failCommit = true;
    await assertRejects(
      () => runtime.quality.commitPublicationWithObservationLink(publication),
      'Simulated shared resource commit failure',
    );
    failCommit = false;
    const failedState = (await runtime.client.read()).snapshot.data;
    assert(failedState.questionResources.versions.length === 0, 'Failed publication left a version.');
    assert(failedState.questionResources.registryEntries.length === 0, 'Failed publication changed Registry.');
    assert(failedState.questionQuality.frozenQualityTraces.length === 0, 'Failed publication left a trace.');
    assert(failedState.materialObservations.links.length === 0, 'Failed publication left an Observation Link.');

    const first = await runtime.quality.commitPublicationWithObservationLink(publication);
    const revisionAfterFirst = (await runtime.client.read()).snapshot.revision;
    const repeated = await runtime.quality.commitPublicationWithObservationLink(publication);
    const final = await runtime.client.read();
    assert(first.inserted, 'Retry did not insert the publication.');
    assert(!repeated.inserted, 'Repeated publication did not report reuse.');
    assert(final.snapshot.revision === revisionAfterFirst, 'Idempotent retry wrote another Store revision.');
    assert(final.snapshot.data.questionResources.versions.length === 1, 'Retry duplicated versions.');
    assert(final.snapshot.data.questionResources.registryEntries.length === 1, 'Retry duplicated Registry entries.');
    assert(final.snapshot.data.questionQuality.frozenQualityTraces.length === 1, 'Retry duplicated traces.');
    assert(final.snapshot.data.materialObservations.links.length === 1, 'Retry duplicated Observation Links.');
  }, () => failCommit);
}

async function caseStaleBundleBlocked(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'stale-bundle');
    await persistQuestionQualityBundle(runtime.quality, fixture);
    await updateStructuredQuestionDraft(
      runtime.resources,
      fixture.draft.draftId,
      { title: 'Changed after assessment' },
      LATER,
    );
    await assertRejects(
      () => requireCurrentPersistedQualityContext(
        runtime.resources,
        runtime.quality,
        fixture.draft.draftId,
      ),
      'persisted quality bundle',
    );
  });
}

async function caseLegacyTraceAbsent(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'legacy-trace');
    await submitQuestionResourceForReview(runtime.resources, fixture.draft.draftId, NOW);
    await reviewQuestionResourceDraftWithPersistedQualityFallback(
      runtime,
      fixture.draft.draftId,
    );
    await freezeQuestionResourceDraft(runtime.resources, fixture.draft.draftId, NOW);
    await persistQuestionQualityBundle(runtime.quality, fixture);
    await assertRejects(
      () => freezeQuestionResourceDraftWithPersistedQuality(
        runtime.resources,
        runtime.quality,
        fixture.draft.draftId,
        NOW,
      ),
      'legacy_quality_trace_absent',
    );
  });
}

async function caseStoreRevisionConflict(): Promise<void> {
  await withRuntime(async (runtime) => {
    const first = await runtime.store.read();
    await runtime.store.replace(first.revision, first.data);
    try {
      await runtime.store.replace(first.revision, first.data);
    } catch (error) {
      assert(error instanceof SharedFormalResourceConflictError, 'Unexpected conflict error type.');
      return;
    }
    throw new Error('Stale Store revision was accepted.');
  });
}

async function caseLegacyRuleBlocked(): Promise<void> {
  await withRuntime(async (runtime) => {
    const created = await createDraft(runtime.resources, 'legacy-rule');
    await validateStructuredQuestionDraft(runtime.resources, created.draftId, NOW);
    const fixture = await qualityFixtureForExistingDraft(
      runtime,
      created.draftId,
      'legacy-rule',
      'completed',
      'pass',
      'question_quality_rules_legacy',
    );
    await persistQuestionQualityBundle(runtime.quality, fixture);
    await assertRejects(
      () => requireCurrentPersistedQualityContext(
        runtime.resources,
        runtime.quality,
        created.draftId,
      ),
      'current persisted deterministic assessment',
    );
  });
}

async function caseWorkbenchQualityInterfacePersists(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'workbench-interface');
    await runtime.quality.saveAssessment(fixture.deterministic);

    const restarted = qualityRepository(runtime.client);
    const restored = await restarted.getAssessmentForRevision(
      fixture.draft.draftId,
      fixture.draft.revision,
    );
    const listed = await restarted.listAssessmentsForDraft(fixture.draft.draftId);

    assert(
      restored?.assessmentId === fixture.deterministic.assessmentId,
      'Workbench assessment was not restored from the shared store.',
    );
    assert(
      listed.length === 1 && listed[0]?.assessmentId === restored.assessmentId,
      'Workbench assessment listing did not use the shared store.',
    );
  });
}

async function caseReviewBindsCurrentBundle(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'review-bundle-binding');
    const review = fixture.draft.latestReviewId
      ? await runtime.resources.getReview(fixture.draft.latestReviewId)
      : null;
    assert(review, 'Human Review Decision is missing.');
    assert(
      review.qualityAssessmentBundleId === fixture.bundle.bundleId &&
      review.deterministicAssessmentId === fixture.deterministic.assessmentId &&
      review.semanticAssessmentId === fixture.semantic.semanticAssessmentId &&
      review.qualityMergeRuleVersion === fixture.bundle.mergeRuleVersion,
      'Human Review Decision is not bound to the current quality bundle.',
    );
  });
}

async function caseUnboundReviewBlocksFreeze(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await createQualityFixture(runtime, 'unbound-review');
    await persistQuestionQualityBundle(runtime.quality, fixture);
    await submitQuestionResourceForReview(runtime.resources, fixture.draft.draftId, NOW);
    await reviewQuestionResourceDraftWithPersistedQualityFallback(
      runtime,
      fixture.draft.draftId,
    );
    await assertRejects(
      () => freezeQuestionResourceDraftWithPersistedQuality(
        runtime.resources,
        runtime.quality,
        fixture.draft.draftId,
        NOW,
      ),
      'not bound to the quality bundle',
    );
  });
}

async function caseReviewRetryIdempotent(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'review-retry-idempotent');
    const existing = fixture.draft.latestReviewId
      ? await runtime.resources.getReview(fixture.draft.latestReviewId)
      : null;
    assert(existing, 'Existing Human Review is missing.');
    const retry = await reviewQuestionResourceDraftWithPersistedQuality(
      runtime.resources,
      runtime.quality,
      {
        draftId: fixture.draft.draftId,
        action: 'approve',
        reviewerId: 'reviewer',
        notes: existing.notes,
        acceptedWarningCodes: fixture.deterministic.warnings.map(
          (warning) => warning.code,
        ),
        now: LATER,
      },
    );
    assert(
      retry.reviewId === fixture.draft.latestReviewId,
      'Identical Human Review retry created another decision.',
    );
  });
}

async function caseReviewRetryConflict(): Promise<void> {
  await withRuntime(async (runtime) => {
    const fixture = await reviewedFixture(runtime, 'review-retry-conflict');
    await assertRejects(
      () => reviewQuestionResourceDraftWithPersistedQuality(
        runtime.resources,
        runtime.quality,
        {
          draftId: fixture.draft.draftId,
          action: 'reject',
          reviewerId: 'another-reviewer',
          notes: 'Conflicting decision.',
          now: LATER,
        },
      ),
      '不能静默覆盖',
    );
  });
}

async function reviewedFixture(
  runtime: Runtime,
  suffix: string,
): Promise<QualityFixture> {
  const fixture = await createQualityFixture(runtime, suffix);
  await persistQuestionQualityBundle(runtime.quality, fixture);
  await submitQuestionResourceForReview(runtime.resources, fixture.draft.draftId, NOW);
  await reviewQuestionResourceDraftWithPersistedQuality(
    runtime.resources,
    runtime.quality,
    {
      draftId: fixture.draft.draftId,
      action: 'approve',
      reviewerId: 'reviewer',
      acceptedWarningCodes: fixture.deterministic.warnings.map(
        (warning) => warning.code,
      ),
      notes: '人工确认质量评估与题目内容。',
      now: NOW,
    },
  );
  const reviewed = await runtime.resources.getDraft(fixture.draft.draftId);
  assert(reviewed, 'Reviewed draft is missing.');
  return { ...fixture, draft: reviewed };
}

async function createQualityFixture(
  runtime: Runtime,
  suffix: string,
  semanticStatus: QuestionSemanticQualityAssessment['status'] = 'completed',
  findingStatus: SemanticCheckStatus = 'pass',
  deterministicRuleVersion?: string,
): Promise<QualityFixture> {
  const created = await createDraft(runtime.resources, suffix);
  await validateStructuredQuestionDraft(runtime.resources, created.draftId, NOW);
  return qualityFixtureForExistingDraft(
    runtime,
    created.draftId,
    suffix,
    semanticStatus,
    findingStatus,
    deterministicRuleVersion,
  );
}

async function qualityFixtureForExistingDraft(
  runtime: Runtime,
  draftId: string,
  suffix: string,
  semanticStatus: QuestionSemanticQualityAssessment['status'] = 'completed',
  findingStatus: SemanticCheckStatus = 'pass',
  deterministicRuleVersion?: string,
): Promise<QualityFixture> {
  const draft = await runtime.resources.getDraft(draftId);
  assert(draft?.latestValidationId, 'Validated draft is missing.');
  const validation = await runtime.resources.getValidation(draft.latestValidationId);
  assert(validation?.passed, 'Passed validation is missing.');
  const material = await runtime.resources.getMaterial(draft.materialVersionId || '');
  assert(material, 'Material is missing.');
  const deterministic = assessQuestionDraftQuality({
    draft,
    validation,
    material,
    assessedAt: semanticStatus === 'completed' ? NOW : LATER,
    ruleVersion: deterministicRuleVersion,
  });
  const semantic: QuestionSemanticQualityAssessment = {
    semanticAssessmentId: `semantic-${suffix}-${draft.revision}`,
    semanticRequestKey: `semantic-request-${suffix}-${draft.revision}`,
    requestId: `request-${suffix}`,
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    assessedDraftRevision: draft.revision,
    validationId: validation.validationId,
    materialVersionId: material.materialVersionId,
    deterministicAssessmentId: deterministic.assessmentId,
    status: semanticStatus,
    findings: semanticStatus === 'completed'
      ? QUESTION_QUALITY_CHECKS.map((check) => ({
        check,
        status: findingStatus,
        reason: `${check} semantic reason.`,
        evidenceRefs: ['draft.questionStem'],
      }))
      : [],
    limitations: semanticStatus === 'completed' ? [] : ['Provider unavailable.'],
    providerId: 'semantic-debug-provider',
    modelId: 'semantic-debug-model',
    promptVersion: QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
    semanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    outputSchemaVersion: QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
    startedAt: NOW,
    completedAt: LATER,
  };
  const bundle = mergeQuestionQualityAssessments({
    deterministic,
    semantic,
    createdAt: LATER,
  });
  return { draft, deterministic, semantic, bundle };
}

async function createDraft(
  repository: LocalApiQuestionResourceAdmissionRepository,
  suffix: string,
): Promise<StructuredQuestionDraft> {
  return createStructuredQuestionDraft(repository, {
    draftId: `c2-draft-${suffix}`,
    resourceId: `c2-resource-${suffix}`,
    taskId: `c2-task-${suffix}`,
    materialVersionId: 'c2-material:v1',
    title: '人物心理推断',
    questionStem: '结合父亲捏着树叶站了很久的动作，分析这一细节表现出的心理。',
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
      description: 'Phase 17.5C2 debug question.',
      copyrightNote: 'Synthetic content.',
    },
    tags: ['阅读理解', '人物心理'],
    now: NOW,
  });
}

function validRubric(): QuestionResourceRubricItem[] {
  return [{
    itemId: 'evidence',
    name: '文本依据与解释',
    description: '指出动作并解释动作与人物心理之间的关系。',
    abilityId: 'inference',
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: true,
      requireExplanation: true,
      requireConclusion: true,
    },
    acceptedSignals: ['捏着树叶站了很久', '说明珍惜回忆'],
  }];
}

function observationLinkFixture(
  version: Awaited<ReturnType<typeof prepareQuestionResourceFreezeWithPersistedQuality>>['resourceCommit']['version'],
): ResourceObservationLink {
  return {
    resourceObservationLinkId: `link-${version.resourceVersionId}`,
    materialObservationPlanId: 'plan-atomic-publication',
    observationTaskPlanId: version.taskId,
    resourceId: version.resourceId,
    resourceVersionId: version.resourceVersionId,
    materialId: version.materialId || 'c2-material',
    materialVersionId: version.materialVersionId || 'c2-material:v1',
    primaryDimension: 'character',
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    status: 'active',
    linkedAt: NOW,
    schemaVersion: RESOURCE_OBSERVATION_LINK_SCHEMA_VERSION,
  };
}

async function withRuntime(
  action: (runtime: Runtime) => Promise<void>,
  failBeforeCommit: () => boolean = () => false,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase17-5c2-'));
  const storePath = join(directory, 'formal-resource-store.json');
  const store = new SharedFormalResourceStore({
    storePath,
    now: () => NOW,
    failBeforeCommit,
  });
  const { server, endpoint } = await startRuntime(store);
  const client = new LocalApiFormalResourceClient(endpoint);
  const runtime: Runtime = {
    directory,
    storePath,
    store,
    server,
    client,
    resources: new LocalApiQuestionResourceAdmissionRepository(client),
    quality: qualityRepository(client),
  };
  try {
    await client.initialize(createEmptySharedFormalResourceData(), 'phase17-5c2-debug');
    await createQuestionMaterial(runtime.resources, {
      materialId: 'c2-material',
      materialVersionId: 'c2-material:v1',
      versionNumber: 1,
      title: '旧书中的树叶',
      content: '父亲整理书柜时发现一片旧树叶。他捏着树叶站了很久，最后小心地夹回原处。',
      source: {
        sourceType: 'manual',
        description: 'Phase 17.5C2 debug material.',
        copyrightNote: 'Synthetic content.',
      },
      createdAt: NOW,
    });
    await action(runtime);
  } finally {
    await stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }
}

function qualityRepository(
  client: LocalApiFormalResourceClient,
): LocalApiQuestionQualityPersistenceRepository {
  return new LocalApiQuestionQualityPersistenceRepository(client);
}

async function reviewQuestionResourceDraftWithPersistedQualityFallback(
  runtime: Runtime,
  draftId: string,
): Promise<void> {
  const draft = await runtime.resources.getDraft(draftId);
  assert(draft?.latestValidationId, 'Draft validation is missing.');
  const validation = await runtime.resources.getValidation(draft.latestValidationId);
  assert(validation, 'Validation is missing.');
  const reviewId = `review-${draft.draftId}-${draft.revision}-approve`;
  await runtime.resources.saveReview({
    reviewId,
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    reviewedDraftRevision: draft.revision,
    validationId: validation.validationId,
    action: 'approve',
    reviewerId: 'legacy-reviewer',
    notes: 'Legacy pre-C2 review.',
    reviewedAt: NOW,
  });
  await runtime.resources.saveDraft({
    ...draft,
    status: 'reviewed',
    latestReviewId: reviewId,
    updatedAt: NOW,
  });
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
  if (!address || typeof address === 'string') {
    throw new Error('Debug server did not expose a port.');
  }
  return {
    server,
    endpoint: `http://127.0.0.1:${address.port}/__runtime/phase17-4/formal-resources`,
  };
}

async function stopServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
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
      message.toLowerCase().includes(expectedMessage.toLowerCase()),
      `Expected "${expectedMessage}", got "${message}".`,
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
