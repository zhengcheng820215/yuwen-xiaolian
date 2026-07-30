import {
  ensureRegistryEntryForFrozenVersion,
  prepareQuestionResourceFreezeCommit,
  reviewQuestionResourceDraft,
} from './questionResourceAdmissionAgent.ts';
import type {
  QuestionQualityPersistenceRepository,
  QualityTracedFreezeCommit,
  QualityTracedFreezeResult,
} from '../repositories/questionQualityPersistenceRepository.ts';
import type {
  QuestionResourceAdmissionRepository,
} from '../repositories/questionResourceAdmissionRepository.ts';
import {
  QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION,
  type FrozenQuestionQualityTrace,
} from '../schemas/questionQualityPersistence.schema.ts';
import {
  QUESTION_QUALITY_RULE_VERSION,
  isQuestionQualityAssessment,
  type QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import {
  canApplyQualityReviewAction,
  canFreezeWithQualityBundle,
} from './questionSemanticQualityAssessmentAgent.ts';
import {
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  isQuestionQualityAssessmentBundle,
  isQuestionSemanticQualityAssessment,
  type QuestionQualityAssessmentBundle,
  type QuestionQualityReviewAction,
  type QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';
import type {
  ResourceReviewDecision,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';

export type PersistQuestionQualityBundleInput = {
  deterministic: QuestionQualityAssessment;
  semantic: QuestionSemanticQualityAssessment;
  bundle: QuestionQualityAssessmentBundle;
};

export type CurrentPersistedQualityContext = PersistQuestionQualityBundleInput & {
  draft: StructuredQuestionDraft;
};

export async function persistQuestionQualityBundle(
  repository: QuestionQualityPersistenceRepository,
  input: PersistQuestionQualityBundleInput,
): Promise<PersistQuestionQualityBundleInput> {
  assertPersistenceInput(input);
  const deterministic = await repository.saveDeterministicAssessment(
    input.deterministic,
  );
  const semantic = await repository.saveSemanticAssessment(input.semantic);
  const bundle = await repository.saveBundle(input.bundle);
  return { deterministic, semantic, bundle };
}

export async function requireCurrentPersistedQualityContext(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityPersistenceRepository,
  draftId: string,
): Promise<CurrentPersistedQualityContext> {
  const draft = await resourceRepository.getDraft(draftId);
  if (!draft?.latestValidationId) {
    throw new Error('Current persisted quality bundle is required.');
  }
  const validation = await resourceRepository.getValidation(
    draft.latestValidationId,
  );
  if (
    !validation?.passed ||
    validation.validatedDraftRevision !== draft.revision
  ) {
    throw new Error('Current persisted quality bundle is required.');
  }

  const deterministicCandidates =
    await qualityRepository.listDeterministicForDraft(draft.draftId);
  const deterministic = deterministicCandidates.find((item) => (
    item.assessedDraftRevision === draft.revision &&
    item.validationId === validation.validationId &&
    item.ruleVersion === QUESTION_QUALITY_RULE_VERSION
  ));
  if (!deterministic) {
    throw new Error('Current persisted deterministic assessment is required.');
  }

  const semanticCandidates =
    await qualityRepository.listSemanticForDraft(draft.draftId);
  const semantic = semanticCandidates.find((item) => (
    item.assessedDraftRevision === draft.revision &&
    item.validationId === validation.validationId &&
    item.deterministicAssessmentId === deterministic.assessmentId &&
    item.promptVersion === QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION &&
    item.semanticRuleVersion === QUESTION_SEMANTIC_QUALITY_RULE_VERSION &&
    item.outputSchemaVersion === QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION
  ));
  if (!semantic) {
    throw new Error('Current semantic assessment result is required.');
  }

  const bundles = await Promise.all(
    semanticCandidates
      .filter((item) => item.semanticAssessmentId === semantic.semanticAssessmentId)
      .map(() => qualityRepository.getCurrentBundle({
        draftId: draft.draftId,
        draftRevision: draft.revision,
        validationId: validation.validationId,
        deterministicAssessmentId: deterministic.assessmentId,
        semanticAssessmentId: semantic.semanticAssessmentId,
        mergeRuleVersion: QUESTION_QUALITY_MERGE_RULE_VERSION,
      })),
  );
  const bundle = bundles.find(
    (candidate): candidate is QuestionQualityAssessmentBundle => Boolean(candidate),
  );
  if (!bundle) {
    throw new Error('Current persisted quality bundle is required.');
  }
  return { draft, deterministic, semantic, bundle };
}

export async function reviewQuestionResourceDraftWithPersistedQuality(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityPersistenceRepository,
  input: {
    draftId: string;
    action: QuestionQualityReviewAction;
    reviewerId: string;
    notes: string;
    acceptedWarningCodes?: string[];
    now?: string;
  },
): Promise<ResourceReviewDecision> {
  const context = await requireCurrentPersistedQualityContext(
    resourceRepository,
    qualityRepository,
    input.draftId,
  );
  if (!canApplyQualityReviewAction(context.bundle, input.action)) {
    throw new Error('Current quality bundle blocks approval.');
  }
  if (
    input.action === 'approve' &&
    context.bundle.decision === 'revision_recommended' &&
    !input.notes.trim()
  ) {
    throw new Error('Approval with revision recommendation requires review notes.');
  }
  const acceptedWarningCodes = new Set(input.acceptedWarningCodes || []);
  if (
    input.action === 'approve' &&
    context.deterministic.warnings.some(
      (warning) => !acceptedWarningCodes.has(warning.code),
    )
  ) {
    throw new Error('Current quality warnings require an explicit Human Review decision.');
  }
  const reviewedAt = input.now || new Date().toISOString();
  return reviewQuestionResourceDraft(resourceRepository, {
    ...input,
    now: reviewedAt,
    qualityAssessmentBundleId: context.bundle.bundleId,
    deterministicAssessmentId: context.deterministic.assessmentId,
    semanticAssessmentId: context.semantic.semanticAssessmentId,
    qualityMergeRuleVersion: context.bundle.mergeRuleVersion,
    warningDecisions: context.deterministic.warnings.map((warning) => ({
      warningDecisionId: `${context.draft.draftId}:r${context.draft.revision}:${context.deterministic.assessmentId}:${warning.code}`,
      draftId: context.draft.draftId,
      draftRevision: context.draft.revision,
      assessmentId: context.deterministic.assessmentId,
      warningCode: warning.code,
      decision: acceptedWarningCodes.has(warning.code) ? 'accepted' : 'rejected',
      reviewedBy: input.reviewerId,
      reviewedAt,
    })),
  });
}

export async function freezeQuestionResourceDraftWithPersistedQuality(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityPersistenceRepository,
  draftId: string,
  now = new Date().toISOString(),
): Promise<QualityTracedFreezeResult> {
  const existing = await resourceRepository.getVersionByDraftId(draftId);
  if (existing) {
    const [registryEntry, trace] = await Promise.all([
      ensureRegistryEntryForFrozenVersion(resourceRepository, existing, now),
      qualityRepository.getTraceForResourceVersion(existing.resourceVersionId),
    ]);
    if (!trace) {
      throw new Error('legacy_quality_trace_absent');
    }
    return { version: existing, registryEntry, trace, inserted: false };
  }

  const commit = await prepareQuestionResourceFreezeWithPersistedQuality(
    resourceRepository,
    qualityRepository,
    draftId,
    now,
  );
  return qualityRepository.commitFreezeWithQualityTrace(commit);
}

export async function prepareQuestionResourceFreezeWithPersistedQuality(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityPersistenceRepository,
  draftId: string,
  now = new Date().toISOString(),
): Promise<QualityTracedFreezeCommit> {
  const context = await requireCurrentPersistedQualityContext(
    resourceRepository,
    qualityRepository,
    draftId,
  );
  if (!canFreezeWithQualityBundle(context.bundle)) {
    throw new Error('Current quality bundle blocks Freeze.');
  }
  const review = context.draft.latestReviewId
    ? await resourceRepository.getReview(context.draft.latestReviewId)
    : null;
  if (
    !review ||
    review.reviewedDraftRevision !== context.draft.revision ||
    review.validationId !== context.bundle.validationId ||
    review.qualityAssessmentBundleId !== context.bundle.bundleId ||
    review.deterministicAssessmentId !== context.deterministic.assessmentId ||
    review.semanticAssessmentId !== context.semantic.semanticAssessmentId ||
    review.qualityMergeRuleVersion !== context.bundle.mergeRuleVersion
  ) {
    throw new Error('Current Human Review is not bound to the quality bundle.');
  }
  const resourceCommit = await prepareQuestionResourceFreezeCommit(
    resourceRepository,
    draftId,
    now,
  );
  const trace = buildFrozenQuestionQualityTrace(
    resourceCommit.version.resourceVersionId,
    context,
    review.reviewId,
    now,
  );
  return {
    resourceCommit,
    trace,
  };
}

function buildFrozenQuestionQualityTrace(
  resourceVersionId: string,
  context: CurrentPersistedQualityContext,
  reviewId: string,
  tracedAt: string,
): FrozenQuestionQualityTrace {
  return {
    traceId: `quality-trace-${fingerprint([
      resourceVersionId,
      context.bundle.bundleId,
      reviewId,
    ].join('|'))}`,
    resourceId: context.draft.resourceId,
    resourceVersionId,
    sourceDraftId: context.draft.draftId,
    frozenDraftRevision: context.draft.revision,
    validationId: context.bundle.validationId,
    reviewId,
    deterministicAssessmentId: context.deterministic.assessmentId,
    semanticAssessmentId: context.semantic.semanticAssessmentId,
    bundleId: context.bundle.bundleId,
    deterministicRuleVersion: context.deterministic.ruleVersion,
    semanticRuleVersion: context.semantic.semanticRuleVersion,
    mergeRuleVersion: context.bundle.mergeRuleVersion,
    tracedAt,
    schemaVersion: QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION,
  };
}

function assertPersistenceInput(input: PersistQuestionQualityBundleInput): void {
  if (
    !isQuestionQualityAssessment(input.deterministic) ||
    !isQuestionSemanticQualityAssessment(input.semantic) ||
    !isQuestionQualityAssessmentBundle(input.bundle)
  ) {
    throw new Error('Question quality persistence input is invalid.');
  }
  if (
    input.deterministic.draftId !== input.semantic.draftId ||
    input.deterministic.resourceId !== input.semantic.resourceId ||
    input.deterministic.assessedDraftRevision !==
      input.semantic.assessedDraftRevision ||
    input.deterministic.validationId !== input.semantic.validationId ||
    input.deterministic.assessmentId !==
      input.semantic.deterministicAssessmentId ||
    input.bundle.deterministicAssessmentId !==
      input.deterministic.assessmentId ||
    input.bundle.semanticAssessmentId !== input.semantic.semanticAssessmentId
  ) {
    throw new Error('Question quality persistence identity is not aligned.');
  }
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
