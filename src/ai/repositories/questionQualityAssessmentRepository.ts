import type {
  QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';

export type QuestionQualityAssessmentRepository = {
  saveAssessment(
    assessment: QuestionQualityAssessment,
  ): Promise<QuestionQualityAssessment>;
  getAssessment(
    assessmentId: string,
  ): Promise<QuestionQualityAssessment | null>;
  listAssessmentsForDraft(
    draftId: string,
  ): Promise<QuestionQualityAssessment[]>;
  getAssessmentForRevision(
    draftId: string,
    draftRevision: number,
  ): Promise<QuestionQualityAssessment | null>;
  clear(): Promise<void>;
};
