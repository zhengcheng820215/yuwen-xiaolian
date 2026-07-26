import type {
  QuestionQualityAssessmentRepository,
} from './questionQualityAssessmentRepository.ts';
import {
  cloneQuestionQualityValue,
  type QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import { createStructuredRuntimeError } from '../errors/structuredRuntimeError.ts';

export class InMemoryQuestionQualityAssessmentRepository
implements QuestionQualityAssessmentRepository {
  private readonly assessments = new Map<string, QuestionQualityAssessment>();

  async saveAssessment(
    assessment: QuestionQualityAssessment,
  ): Promise<QuestionQualityAssessment> {
    const existing = this.assessments.get(assessment.assessmentId);
    if (existing) {
      if (!sameAssessment(existing, assessment)) {
        throw createStructuredRuntimeError({
          code: 'FORMAL_RESOURCE_IMMUTABLE_CONFLICT',
          message: '题目质量评估为不可变记录，不能覆盖已有评估。',
          operation: 'question_quality_assessment.save',
          objectId: assessment.assessmentId,
          recoverability: 'new_revision_required',
        });
      }
      return clone(existing);
    }
    this.assessments.set(assessment.assessmentId, clone(assessment));
    return clone(assessment);
  }

  async getAssessment(
    assessmentId: string,
  ): Promise<QuestionQualityAssessment | null> {
    return cloneNullable(this.assessments.get(assessmentId));
  }

  async listAssessmentsForDraft(
    draftId: string,
  ): Promise<QuestionQualityAssessment[]> {
    return [...this.assessments.values()]
      .filter((assessment) => assessment.draftId === draftId)
      .sort((left, right) => (
        right.assessedDraftRevision - left.assessedDraftRevision ||
        right.assessedAt.localeCompare(left.assessedAt)
      ))
      .map(clone);
  }

  async getAssessmentForRevision(
    draftId: string,
    draftRevision: number,
  ): Promise<QuestionQualityAssessment | null> {
    const matches = [...this.assessments.values()]
      .filter((assessment) => (
        assessment.draftId === draftId &&
        assessment.assessedDraftRevision === draftRevision
      ))
      .sort((left, right) => right.assessedAt.localeCompare(left.assessedAt));
    return cloneNullable(matches[0]);
  }

  async clear(): Promise<void> {
    this.assessments.clear();
  }
}

function clone<T>(value: T): T {
  return cloneQuestionQualityValue(value);
}

function cloneNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}

function sameAssessment(
  left: QuestionQualityAssessment,
  right: QuestionQualityAssessment,
): boolean {
  const { assessedAt: _leftAssessedAt, ...leftIdentity } = left;
  const { assessedAt: _rightAssessedAt, ...rightIdentity } = right;
  return JSON.stringify(leftIdentity) === JSON.stringify(rightIdentity);
}
