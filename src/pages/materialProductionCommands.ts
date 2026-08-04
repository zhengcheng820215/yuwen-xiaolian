import {
  approveProductionObservationPlan,
  completeProductionQuestionDraftQualityChecks,
  createPhase17BatchADraftsForReview,
  createProductionObservationPlan,
  createProductionQuestionDraft,
  createProductionQuestionDrafts,
  isPhase17BatchAMaterial,
  submitProductionObservationPlan,
  synchronizeProductionQuestionDrafts,
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
    async () => {
      const result = await createProductionObservationPlan(input);
      const synchronizedDrafts = await synchronizeProductionQuestionDrafts(
        result.plan.materialObservationPlanId,
      );
      return { ...result, synchronizedDrafts };
    },
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

export function executeConfirmTrainingPlanForTaskProductionCommand(input: {
  planId: string;
  currentStatus: string;
}) {
  return executeTaskProductionOnce(
    buildTaskProductionCommandKey({
      command: 'confirmTrainingPlanForTaskProduction',
      targetId: input.planId,
    }),
    () => confirmTrainingPlanForTaskProduction(input, {
      submitPlan: submitProductionObservationPlan,
      approvePlan: approveProductionObservationPlan,
    }),
  );
}

export async function confirmTrainingPlanForTaskProduction(
  input: {
    planId: string;
    currentStatus: string;
  },
  dependencies: {
    submitPlan: (planId: string) => Promise<{ status?: string }>;
    approvePlan: (planId: string) => Promise<unknown>;
  },
) {
  let status = input.currentStatus;
  if (['draft', 'revision_required'].includes(status)) {
    const submittedPlan = await dependencies.submitPlan(input.planId);
    if (!submittedPlan?.status) {
      throw new Error('训练计划提交成功，但未返回有效状态。');
    }
    status = submittedPlan.status;
  }
  if (status === 'pending_review') {
    await dependencies.approvePlan(input.planId);
    status = 'reviewed';
  }
  return { planId: input.planId, status };
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
