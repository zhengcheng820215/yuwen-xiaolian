import {
  QUESTION_QUALITY_RULE_VERSION,
  type QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_QUALITY_BATCH_SUMMARY_RULE_VERSION,
  QUESTION_QUALITY_BATCH_SUMMARY_VERSION,
  createQuestionQualityMetric,
  type QuestionGenerationBatchQualitySummary,
  type QuestionGenerationQualityBatchManifest,
} from '../schemas/questionQualityBatchSummary.schema.ts';
import type {
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  type QuestionQualityAssessmentBundle,
  type QuestionQualityBundleDecision,
  type QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';

export type QuestionGenerationBatchQualitySummaryInput = {
  manifest: QuestionGenerationQualityBatchManifest;
  drafts: StructuredQuestionDraft[];
  validations: ResourceValidationResult[];
  deterministicAssessments: QuestionQualityAssessment[];
  semanticAssessments: QuestionSemanticQualityAssessment[];
  bundles: QuestionQualityAssessmentBundle[];
  reviews: ResourceReviewDecision[];
  reviewStartedAtByReviewId?: Record<string, string>;
  generatedAt: string;
  requiredVersions?: {
    deterministicRuleVersion: string;
    semanticRuleVersion: string;
    promptVersion: string;
    mergeRuleVersion: string;
  };
};

export function summarizeQuestionGenerationBatchQuality(
  input: QuestionGenerationBatchQualitySummaryInput,
): QuestionGenerationBatchQualitySummary {
  const required = input.requiredVersions || {
    deterministicRuleVersion: QUESTION_QUALITY_RULE_VERSION,
    semanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    promptVersion: QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
    mergeRuleVersion: QUESTION_QUALITY_MERGE_RULE_VERSION,
  };
  const issues = new Set<string>();
  const uniqueRefs = new Map<string, QuestionGenerationQualityBatchManifest['draftRefs'][number]>();
  for (const ref of input.manifest.draftRefs) {
    const key = `${ref.draftId}@${ref.draftRevision}`;
    if (uniqueRefs.has(key)) issues.add(`duplicate_draft_ref:${key}`);
    else uniqueRefs.set(key, ref);
  }

  const decisionDistribution = emptyDecisions();
  const warningDistribution: Record<string, number> = {};
  const abilityDistribution: Record<string, number> = {};
  const difficultyDistribution: Record<string, number> = {};
  const human = { approve: 0, revisionRequired: 0, reject: 0, pending: 0 };
  const bundleIds: string[] = [];
  const reviewIds: string[] = [];
  const deterministicRules = new Set<string>();
  const semanticRules = new Set<string>();
  const promptVersions = new Set<string>();
  const mergeRules = new Set<string>();
  let missingAssessmentCount = 0;
  let staleAssessmentCount = 0;
  let validDraftCount = 0;
  let currentDeterministicCount = 0;
  let completedSemanticCount = 0;
  let duplicateObservationCount = 0;
  let reviewedCount = 0;
  let reviewDurationTotal = 0;
  let reviewDurationCount = 0;
  let blocked = false;
  let mixed = false;

  for (const ref of uniqueRefs.values()) {
    const draft = input.drafts.find((item) => item.draftId === ref.draftId);
    if (!draft || draft.resourceId !== ref.resourceId) {
      issues.add(`draft_identity_missing:${ref.draftId}`);
      blocked = true;
      continue;
    }
    if (draft.revision !== ref.draftRevision) {
      issues.add(`draft_revision_mismatch:${ref.draftId}`);
      staleAssessmentCount += 1;
      mixed = true;
    }
    if (
      draft.materialVersionId &&
      !input.manifest.materialVersionIds.includes(draft.materialVersionId)
    ) {
      issues.add(`material_version_mismatch:${ref.draftId}`);
      mixed = true;
    }
    abilityDistribution[draft.abilityMetadata.abilityId] =
      (abilityDistribution[draft.abilityMetadata.abilityId] || 0) + 1;
    difficultyDistribution[draft.abilityMetadata.difficulty] =
      (difficultyDistribution[draft.abilityMetadata.difficulty] || 0) + 1;

    const validation = input.validations.find(
      (item) => item.validationId === ref.validationId,
    );
    if (
      validation?.draftId === ref.draftId &&
      validation.validatedDraftRevision === ref.draftRevision &&
      validation.passed
    ) validDraftCount += 1;
    else {
      issues.add(`validation_mismatch:${ref.draftId}`);
      mixed = true;
    }

    const deterministicMatches = input.deterministicAssessments.filter((item) => (
      item.draftId === ref.draftId &&
      item.assessedDraftRevision === ref.draftRevision &&
      item.validationId === ref.validationId
    ));
    const currentDeterministic = deterministicMatches.find(
      (item) => item.ruleVersion === required.deterministicRuleVersion,
    );
    if (currentDeterministic) {
      currentDeterministicCount += 1;
      deterministicRules.add(currentDeterministic.ruleVersion);
    } else if (deterministicMatches.length > 0) {
      deterministicMatches.forEach((item) => deterministicRules.add(item.ruleVersion));
      issues.add(`deterministic_rule_mismatch:${ref.draftId}`);
      staleAssessmentCount += 1;
      mixed = true;
    }

    const semanticMatches = currentDeterministic
      ? input.semanticAssessments.filter((item) => (
        item.draftId === ref.draftId &&
        item.assessedDraftRevision === ref.draftRevision &&
        item.validationId === ref.validationId &&
        item.deterministicAssessmentId === currentDeterministic.assessmentId
      ))
      : [];
    const currentSemantic = semanticMatches.find((item) => (
      item.status === 'completed' &&
      item.semanticRuleVersion === required.semanticRuleVersion &&
      item.promptVersion === required.promptVersion &&
      input.manifest.materialVersionIds.includes(item.materialVersionId)
    ));
    if (currentSemantic) {
      completedSemanticCount += 1;
      semanticRules.add(currentSemantic.semanticRuleVersion);
      promptVersions.add(currentSemantic.promptVersion);
    } else if (semanticMatches.length > 0) {
      semanticMatches.forEach((item) => {
        semanticRules.add(item.semanticRuleVersion);
        promptVersions.add(item.promptVersion);
      });
      issues.add(`semantic_version_or_status_mismatch:${ref.draftId}`);
      staleAssessmentCount += 1;
      mixed = true;
    }

    const exactBundles = currentDeterministic && currentSemantic
      ? input.bundles.filter((item) => (
        item.draftId === ref.draftId &&
        item.assessedDraftRevision === ref.draftRevision &&
        item.validationId === ref.validationId &&
        item.deterministicAssessmentId === currentDeterministic.assessmentId &&
        item.semanticAssessmentId === currentSemantic.semanticAssessmentId
      ))
      : [];
    if (exactBundles.length > 1) {
      issues.add(`duplicate_current_bundle:${ref.draftId}`);
      blocked = true;
    }
    const bundle = exactBundles.find(
      (item) => item.mergeRuleVersion === required.mergeRuleVersion,
    );
    if (!bundle) {
      missingAssessmentCount += 1;
      if (exactBundles.length > 0) {
        exactBundles.forEach((item) => mergeRules.add(item.mergeRuleVersion));
        issues.add(`merge_rule_mismatch:${ref.draftId}`);
        staleAssessmentCount += 1;
        mixed = true;
      } else {
        issues.add(`current_bundle_missing:${ref.draftId}`);
      }
    } else {
      bundleIds.push(bundle.bundleId);
      mergeRules.add(bundle.mergeRuleVersion);
      decisionDistribution[bundle.decision] += 1;
      for (const warning of new Set(bundle.warningCodes)) {
        warningDistribution[warning] = (warningDistribution[warning] || 0) + 1;
      }
      if (bundle.warningCodes.some((code) => /duplicate.*observation/i.test(code))) {
        duplicateObservationCount += 1;
      }
    }

    const matchingReviews = input.reviews
      .filter((item) => (
        item.draftId === ref.draftId &&
        item.reviewedDraftRevision === ref.draftRevision &&
        item.validationId === ref.validationId
      ))
      .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt));
    const review = matchingReviews[0];
    if (!review) {
      human.pending += 1;
    } else {
      reviewedCount += 1;
      reviewIds.push(review.reviewId);
      if (review.action === 'approve') human.approve += 1;
      else if (review.action === 'revision_required') human.revisionRequired += 1;
      else human.reject += 1;
      const startedAt = input.reviewStartedAtByReviewId?.[review.reviewId];
      const duration = startedAt
        ? Date.parse(review.reviewedAt) - Date.parse(startedAt)
        : Number.NaN;
      if (Number.isFinite(duration) && duration >= 0) {
        reviewDurationTotal += duration;
        reviewDurationCount += 1;
      }
    }
  }

  const uniqueBundleIds = sortedUnique(bundleIds);
  const uniqueReviewIds = sortedUnique(reviewIds);
  const status = blocked
    ? 'blocked'
    : mixed
      ? 'mixed_versions'
      : missingAssessmentCount > 0
        ? 'incomplete'
        : 'complete';
  const summaryId = createSummaryId({
    batchId: input.manifest.batchId,
    batchVersion: input.manifest.batchVersion,
    manifestId: input.manifest.manifestId,
    bundleIds: uniqueBundleIds,
    reviewIds: uniqueReviewIds,
    summaryRuleVersion: QUESTION_QUALITY_BATCH_SUMMARY_RULE_VERSION,
  });

  return {
    summaryId,
    batchId: input.manifest.batchId,
    batchVersion: input.manifest.batchVersion,
    manifestId: input.manifest.manifestId,
    reviewIds: uniqueReviewIds,
    materialVersionIds: sortedUnique(input.manifest.materialVersionIds),
    bundleIds: uniqueBundleIds,
    status,
    counts: {
      materialCount: new Set(input.manifest.materialVersionIds).size,
      draftCount: uniqueRefs.size,
      currentBundleCount: uniqueBundleIds.length,
      missingAssessmentCount,
      staleAssessmentCount,
      reviewedCount,
    },
    decisionDistribution,
    warningDistribution: sortRecord(warningDistribution),
    abilityDistribution: sortRecord(abilityDistribution),
    difficultyDistribution: sortRecord(difficultyDistribution),
    humanDecisionDistribution: human,
    metrics: {
      contractValidationPassRate: createQuestionQualityMetric(
        validDraftCount,
        input.manifest.generatedCandidateCount,
      ),
      semanticCompletionRate: createQuestionQualityMetric(
        completedSemanticCount,
        currentDeterministicCount,
      ),
      currentAssessmentCoverage: createQuestionQualityMetric(
        uniqueBundleIds.length,
        uniqueRefs.size,
      ),
      duplicateObservationRate: createQuestionQualityMetric(
        duplicateObservationCount,
        uniqueBundleIds.length,
      ),
      humanRetentionRate: createQuestionQualityMetric(human.approve, reviewedCount),
      humanModificationRate: createQuestionQualityMetric(
        human.revisionRequired,
        reviewedCount,
      ),
      humanRejectionRate: createQuestionQualityMetric(human.reject, reviewedCount),
      averageReviewDurationMs: createQuestionQualityMetric(
        reviewDurationTotal,
        reviewDurationCount,
      ),
    },
    issues: sortedUnique([...issues]),
    deterministicRuleVersions: sortedUnique([...deterministicRules]),
    semanticRuleVersions: sortedUnique([...semanticRules]),
    promptVersions: sortedUnique([...promptVersions]),
    mergeRuleVersions: sortedUnique([...mergeRules]),
    summaryRuleVersion: QUESTION_QUALITY_BATCH_SUMMARY_RULE_VERSION,
    generatedAt: input.generatedAt,
    version: QUESTION_QUALITY_BATCH_SUMMARY_VERSION,
  };
}

function emptyDecisions(): Record<QuestionQualityBundleDecision, number> {
  return {
    ready_for_review: 0,
    review_with_warnings: 0,
    revision_recommended: 0,
    semantic_unavailable: 0,
  };
}

function createSummaryId(input: {
  batchId: string;
  batchVersion: string;
  manifestId: string;
  bundleIds: string[];
  reviewIds: string[];
  summaryRuleVersion: string;
}): string {
  const identity = [
    input.batchId,
    input.batchVersion,
    input.manifestId,
    input.bundleIds.join(','),
    input.reviewIds.join(','),
    input.summaryRuleVersion,
  ].join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `batch-quality-summary-${(hash >>> 0).toString(36)}`;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sortRecord<T extends Record<string, number>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  ) as T;
}
