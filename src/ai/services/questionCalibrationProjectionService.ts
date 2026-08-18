import { buildStableId } from '../agents/reviewedResourceCandidateAdapter.ts';
import { buildQuestionCalibrationProjectionId } from '../agents/learningObservationIdentity.ts';
import type { QuestionCalibrationProjectionRepository } from '../repositories/questionCalibrationProjectionRepository.ts';
import type { OpenResponseRubricItem } from '../schemas/diagnosis.schema.ts';
import type { AnonymousQuestionCalibrationAttempt } from '../schemas/questionEmpiricalCalibration.schema.ts';
import {
  QUESTION_CALIBRATION_ITEM_SCORE_POLICY_VERSION,
  SINGLE_CHOICE_CALIBRATION_ITEM_SCORE_POLICY_VERSION,
  QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION,
  validateQuestionCalibrationProjectionRecord,
  type QuestionCalibrationProjectionRecord,
  type QuestionCalibrationProjectionStatus,
} from '../schemas/questionCalibrationProjection.schema.ts';

export type QuestionCalibrationProjectionInput = {
  attemptId: string;
  runtimeScope: 'product' | 'demo' | 'fixture' | 'debug';
  studentId: string;
  operationId: string;
  learningSessionId: string;
  learningRoundId: string;
  responseId: string;
  responseValidityStatus?: 'valid' | 'empty' | 'placeholder' | 'irrelevant' | 'insufficient';
  roundCompleted: boolean;
  completedAt?: string;
  formalDiagnosisId?: string;
  formalDiagnosisCommitted: boolean;
  rubricItems?: OpenResponseRubricItem[];
  responseFormat?: 'text' | 'single_choice';
  choiceOutcome?: {
    correct: boolean;
    selectedOptionIds: string[];
    optionSetVersion: number;
    displayedOptionOrder: string[];
    misconceptionCode?: string;
  };
  resourceVersionId: string;
  projectedAt: string;
  identityIssues?: string[];
};

export type QuestionCalibrationProjectionResult = {
  status: 'created' | 'updated' | 'unchanged' | 'conflict' | 'failed';
  record: QuestionCalibrationProjectionRecord;
  anonymousAttempt?: AnonymousQuestionCalibrationAttempt;
  issues: string[];
};

export class QuestionCalibrationProjectionService {
  private readonly repository: QuestionCalibrationProjectionRepository;

  constructor(repository: QuestionCalibrationProjectionRepository) {
    this.repository = repository;
  }

  async project(input: QuestionCalibrationProjectionInput): Promise<QuestionCalibrationProjectionResult> {
    const decision = decide(input);
    const record: QuestionCalibrationProjectionRecord = {
      schemaVersion: QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION,
      projectionId: buildQuestionCalibrationProjectionId({
        schemaVersion: QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION,
        attemptId: input.attemptId,
      }),
      attemptId: input.attemptId,
      status: decision.status,
      runtimeScope: input.runtimeScope,
      studentId: input.studentId,
      operationId: input.operationId,
      learningSessionId: input.learningSessionId,
      learningRoundId: input.learningRoundId,
      responseId: input.responseId,
      formalDiagnosisId: input.formalDiagnosisId,
      resourceVersionId: input.resourceVersionId,
      responseFormat: input.responseFormat,
      selectedOptionIds: input.choiceOutcome?.selectedOptionIds,
      optionSetVersion: input.choiceOutcome?.optionSetVersion,
      displayedOptionOrder: input.choiceOutcome?.displayedOptionOrder,
      misconceptionCode: input.choiceOutcome?.correct ? undefined : input.choiceOutcome?.misconceptionCode,
      itemScore: decision.itemScore,
      itemScorePolicyVersion: decision.itemScore === undefined
        ? undefined
        : input.responseFormat === 'single_choice'
          ? SINGLE_CHOICE_CALIBRATION_ITEM_SCORE_POLICY_VERSION
          : QUESTION_CALIBRATION_ITEM_SCORE_POLICY_VERSION,
      totalScoreStatus: 'unavailable_single_round',
      valid: input.responseValidityStatus === 'valid',
      completedAt: input.roundCompleted ? input.completedAt : undefined,
      projectedAt: input.projectedAt,
      issues: decision.issues,
    };
    const validation = validateQuestionCalibrationProjectionRecord(record);
    if (!validation.passed) {
      return { status: 'failed', record: { ...record, status: 'projection_failed', issues: validation.issues }, issues: validation.issues };
    }
    try {
      const written = await this.repository.save(record);
      return {
        status: written.status,
        record: written.record,
        anonymousAttempt: toAnonymousAttempt(written.record),
        issues: written.issues,
      };
    } catch (error) {
      return { status: 'failed', record, issues: [error instanceof Error ? error.message : String(error)] };
    }
  }
}

export function toAnonymousAttempt(
  record: QuestionCalibrationProjectionRecord,
): AnonymousQuestionCalibrationAttempt | undefined {
  if (
    record.status !== 'eligible'
    || record.itemScore === undefined
    || !record.completedAt
    || !record.itemScorePolicyVersion
  ) return undefined;
  return {
    attemptId: record.attemptId,
    subjectKey: buildStableId('learning-calibration-subject', [record.studentId]),
    resourceVersionId: record.resourceVersionId,
    itemScore: record.itemScore,
    itemScorePolicyVersion: record.itemScorePolicyVersion,
    responseFormat: record.responseFormat,
    selectedOptionIds: record.selectedOptionIds,
    optionSetVersion: record.optionSetVersion,
    displayedOptionOrder: record.displayedOptionOrder,
    misconceptionCode: record.misconceptionCode,
    totalScoreStatus: 'unavailable_single_round',
    valid: true,
    completedAt: record.completedAt,
  };
}

function decide(input: QuestionCalibrationProjectionInput): {
  status: QuestionCalibrationProjectionStatus;
  itemScore?: number;
  issues: string[];
} {
  if (input.runtimeScope !== 'product') return excluded('excluded_non_product_scope');
  if (input.responseValidityStatus !== 'valid') return excluded('excluded_invalid_response');
  if (!input.roundCompleted || !input.completedAt) return excluded('excluded_incomplete_round');
  if (!input.formalDiagnosisCommitted || !input.formalDiagnosisId) return excluded('excluded_missing_formal_diagnosis');
  if (input.responseFormat === 'single_choice') {
    if (!input.choiceOutcome) return excluded('excluded_unscorable');
    if (input.identityIssues?.length) return { status: 'projection_failed', issues: input.identityIssues };
    return { status: 'eligible', itemScore: input.choiceOutcome.correct ? 1 : 0, issues: [] };
  }
  const required = (input.rubricItems || []).filter((item) => item.required);
  if (required.length === 0) return excluded('excluded_unscorable');
  if (input.identityIssues?.length) return { status: 'projection_failed', issues: input.identityIssues };
  return {
    status: 'eligible',
    itemScore: required.filter((item) => item.matched).length / required.length,
    issues: [],
  };
}

function excluded(status: QuestionCalibrationProjectionStatus) {
  return { status, issues: [status] };
}
