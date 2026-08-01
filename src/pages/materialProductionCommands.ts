import {
  approveProductionObservationPlan,
  completeProductionQuestionDraftQualityChecks,
  createPhase17BatchADraftsForReview,
  createProductionObservationPlan,
  createProductionQuestionDraft,
  createProductionQuestionDrafts,
  isPhase17BatchAMaterial,
  submitProductionObservationPlan,
} from '../api/materialResourceProductionWorkbench.ts';
import {
  executeQuestionReviewSubmission,
  type QuestionReviewSubmissionResult,
} from './materialQuestionReviewSubmission.ts';
import {
  buildTaskProductionCommandKey,
  executeTaskProductionOnce,
} from './taskProductionCommandRuntime.ts';

export function executeSavePlanRevisionCommand(
  input: Parameters<typeof createProductionObservationPlan>[0],
) {
  const targetId = input.sourcePlanId || input.materialVersionId;
  return executeTaskProductionOnce(
    buildTaskProductionCommandKey({ command: 'saveTaskDraft', targetId }),
    () => createProductionObservationPlan(input),
  );
}

export function executeCreateTaskQuestionCommand(input: {
  planId: string;
  observationTaskPlanId: string;
}) {
  return executeTaskProductionOnce(
    buildTaskProductionCommandKey({
      command: 'createTaskQuestionDraft',
      targetId: input.observationTaskPlanId,
    }),
    () => createProductionQuestionDraft(input.planId, input.observationTaskPlanId),
  );
}

export function executeMaterialFinalConfirmationSubmissionCommand(input: {
  planId: string;
  materialVersionId: string;
  initialPlanStatus: string;
  existingDraftCount: number;
  taskPlanCount: number;
}): Promise<QuestionReviewSubmissionResult> {
  const idempotencyKey = buildTaskProductionCommandKey({
    command: 'submitTaskForFinalConfirmation',
    targetId: input.planId,
  });
  return executeTaskProductionOnce(idempotencyKey, () => executeQuestionReviewSubmission({
    initialPlanStatus: input.initialPlanStatus,
    existingDraftCount: input.existingDraftCount,
    taskPlanCount: input.taskPlanCount,
    submitPlan: () => submitProductionObservationPlan(input.planId),
    approvePlan: () => approveProductionObservationPlan(input.planId),
    createDrafts: () => (isPhase17BatchAMaterial(input.materialVersionId)
      ? createPhase17BatchADraftsForReview(input.materialVersionId)
      : createProductionQuestionDrafts(input.planId)),
    completeDraftChecks: () => completeProductionQuestionDraftQualityChecks(input.planId),
  }));
}
