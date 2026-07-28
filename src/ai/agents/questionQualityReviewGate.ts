import {
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
} from './questionResourceAdmissionAgent.ts';
import {
  assessAndSaveQuestionDraftQuality,
  buildQuestionQualityComparisonContextHash,
  isCurrentQuestionQualityAssessment,
  requireCurrentQuestionQualityAssessment,
} from './questionQualityAssessmentAgent.ts';
import type {
  QuestionQualityAssessmentRepository,
} from '../repositories/questionQualityAssessmentRepository.ts';
import type {
  QuestionResourceAdmissionRepository,
} from '../repositories/questionResourceAdmissionRepository.ts';
import {
  QUESTION_QUALITY_RULE_VERSION,
  type QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import { createStructuredRuntimeError } from '../errors/structuredRuntimeError.ts';
import type {
  ResourceFreezeResult,
  ResourceReviewAction,
  ResourceReviewDecision,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';

export async function getOrAssessCurrentQuestionDraftQuality(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityAssessmentRepository,
  draftId: string,
  assessedAt = new Date().toISOString(),
): Promise<QuestionQualityAssessment | null> {
  const draft = await resourceRepository.getDraft(draftId);
  if (!draft?.latestValidationId) return null;
  const validation = await resourceRepository.getValidation(draft.latestValidationId);
  if (
    !validation?.passed ||
    validation.validatedDraftRevision !== draft.revision
  ) {
    return null;
  }

  const [material, peerDrafts] = await Promise.all([
    draft.materialVersionId
      ? resourceRepository.getMaterial(draft.materialVersionId)
      : Promise.resolve(null),
    resourceRepository.listDrafts(),
  ]);
  const comparisonContextHash = buildQuestionQualityComparisonContextHash(
    draft,
    peerDrafts,
  );
  const existing = (
    await qualityRepository.listAssessmentsForDraft(draft.draftId)
  ).find(
    (assessment) =>
      assessment.assessedDraftRevision === draft.revision &&
      assessment.validationId === validation.validationId &&
      assessment.ruleVersion === QUESTION_QUALITY_RULE_VERSION &&
      assessment.comparisonContextHash === comparisonContextHash,
  );
  if (
    existing?.ruleVersion === QUESTION_QUALITY_RULE_VERSION &&
    isCurrentQuestionQualityAssessment(
      draft,
      validation,
      existing,
      comparisonContextHash,
    )
  ) {
    return existing;
  }

  return assessAndSaveQuestionDraftQuality(qualityRepository, {
    draft,
    validation,
    material,
    peerDrafts,
    assessedAt,
  });
}

export async function requireCurrentQuestionDraftQuality(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityAssessmentRepository,
  draftId: string,
): Promise<{
  draft: StructuredQuestionDraft;
  assessment: QuestionQualityAssessment;
}> {
  const draft = await resourceRepository.getDraft(draftId);
  if (!draft?.latestValidationId) {
    throw missingQualityAssessment(draftId);
  }
  const validation = await resourceRepository.getValidation(draft.latestValidationId);
  const peerDrafts = await resourceRepository.listDrafts();
  const comparisonContextHash = buildQuestionQualityComparisonContextHash(
    draft,
    peerDrafts,
  );
  const assessment = (
    await qualityRepository.listAssessmentsForDraft(draft.draftId)
  ).find(
    (candidate) =>
      candidate.assessedDraftRevision === draft.revision &&
      candidate.validationId === validation.validationId &&
      candidate.ruleVersion === QUESTION_QUALITY_RULE_VERSION &&
      candidate.comparisonContextHash === comparisonContextHash,
  );
  if (!validation || !assessment) {
    throw missingQualityAssessment(draftId);
  }
  if (!isCurrentQuestionQualityAssessment(
    draft,
    validation,
    assessment,
    comparisonContextHash,
  )) {
    throw missingQualityAssessment(draftId);
  }
  return {
    draft,
    assessment: requireCurrentQuestionQualityAssessment(
      draft,
      validation,
      assessment,
      comparisonContextHash,
    ),
  };
}

function missingQualityAssessment(draftId: string) {
  return createStructuredRuntimeError({
    code: 'QUALITY_ASSESSMENT_REQUIRED',
    message: '缺少当前修订版本的题目质量评估，不能继续审核或冻结。',
    operation: 'question_quality_review_gate.require_assessment',
    objectId: draftId,
    recoverability: 'user_action_required',
  });
}

export async function submitQuestionResourceForQualityReview(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityAssessmentRepository,
  draftId: string,
  now = new Date().toISOString(),
): Promise<StructuredQuestionDraft> {
  await requireCurrentQuestionDraftQuality(
    resourceRepository,
    qualityRepository,
    draftId,
  );
  return submitQuestionResourceForReview(resourceRepository, draftId, now);
}

export async function reviewQuestionResourceDraftWithQuality(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityAssessmentRepository,
  input: {
    draftId: string;
    action: ResourceReviewAction;
    reviewerId: string;
    notes: string;
    now?: string;
  },
): Promise<ResourceReviewDecision> {
  await requireCurrentQuestionDraftQuality(
    resourceRepository,
    qualityRepository,
    input.draftId,
  );
  return reviewQuestionResourceDraft(resourceRepository, input);
}

export async function freezeQuestionResourceDraftWithQuality(
  resourceRepository: QuestionResourceAdmissionRepository,
  qualityRepository: QuestionQualityAssessmentRepository,
  draftId: string,
  now = new Date().toISOString(),
): Promise<ResourceFreezeResult> {
  await requireCurrentQuestionDraftQuality(
    resourceRepository,
    qualityRepository,
    draftId,
  );
  return freezeQuestionResourceDraft(resourceRepository, draftId, now);
}
