import {
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
} from './questionResourceAdmissionAgent.ts';
import {
  assessAndSaveQuestionDraftQuality,
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

  const existing = (
    await qualityRepository.listAssessmentsForDraft(draft.draftId)
  ).find(
    (assessment) =>
      assessment.assessedDraftRevision === draft.revision &&
      assessment.validationId === validation.validationId &&
      assessment.ruleVersion === QUESTION_QUALITY_RULE_VERSION,
  );
  if (
    existing?.ruleVersion === QUESTION_QUALITY_RULE_VERSION &&
    isCurrentQuestionQualityAssessment(draft, validation, existing)
  ) {
    return existing;
  }

  const [material, peerDrafts] = await Promise.all([
    draft.materialVersionId
      ? resourceRepository.getMaterial(draft.materialVersionId)
      : Promise.resolve(null),
    resourceRepository.listDrafts(),
  ]);
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
    throw new Error('Current Question Quality Assessment is required.');
  }
  const validation = await resourceRepository.getValidation(draft.latestValidationId);
  const assessment = (
    await qualityRepository.listAssessmentsForDraft(draft.draftId)
  ).find(
    (candidate) =>
      candidate.assessedDraftRevision === draft.revision &&
      candidate.validationId === validation.validationId &&
      candidate.ruleVersion === QUESTION_QUALITY_RULE_VERSION,
  );
  if (!validation || !assessment) {
    throw new Error('Current Question Quality Assessment is required.');
  }
  if (!isCurrentQuestionQualityAssessment(draft, validation, assessment)) {
    throw new Error('Current Question Quality Assessment is required.');
  }
  return {
    draft,
    assessment: requireCurrentQuestionQualityAssessment(draft, validation, assessment),
  };
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
