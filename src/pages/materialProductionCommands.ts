import {
  approveProductionObservationPlan,
  completeProductionQuestionDraftQualityChecks,
  createPhase17BatchADraftsForReview,
  createProductionObservationPlan,
  createProductionQuestionDraft,
  createProductionQuestionDrafts,
  getCurrentProductionObservationPlan,
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
import { createStructuredRuntimeError } from '../ai/errors/structuredRuntimeError.ts';

export type TrainingPlanContinuationCode =
  | 'already_reviewed'
  | 'submitted_and_approved'
  | 'approved'
  | 'semantic_state_reloaded'
  | 'race_recovered';

export type TrainingPlanContinuationEvent = {
  type: 'authority_loaded' | 'plan_submitted' | 'plan_approved' | 'stage_skipped' | 'race_recovered';
  planId: string;
  fromStatus: string;
  toStatus: string;
  stage?: 'submit_plan' | 'approve_plan';
};

export type TrainingPlanContinuationResult = {
  planId: string;
  displayedStatus: string;
  authorityStatus: string;
  status: 'reviewed';
  continuationCode: TrainingPlanContinuationCode;
  completedStages: Array<'plan_submitted' | 'plan_approved'>;
  events: TrainingPlanContinuationEvent[];
};

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
      loadPlan: getCurrentProductionObservationPlan,
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
    loadPlan: (planId: string) => Promise<{ status?: string } | null>;
    submitPlan: (planId: string) => Promise<{ status?: string }>;
    approvePlan: (planId: string) => Promise<unknown>;
  },
): Promise<TrainingPlanContinuationResult> {
  const currentPlan = await dependencies.loadPlan(input.planId);
  if (!currentPlan?.status) {
    throw planContinuationError(
      input.planId,
      '当前训练计划已经更新或不存在，请刷新后重试。已有题目方案不会丢失。',
    );
  }
  const authorityStatus = currentPlan.status;
  let status = authorityStatus;
  let raceRecovered = false;
  const completedStages: TrainingPlanContinuationResult['completedStages'] = [];
  const events: TrainingPlanContinuationEvent[] = [{
    type: 'authority_loaded',
    planId: input.planId,
    fromStatus: input.currentStatus,
    toStatus: authorityStatus,
  }];
  if (['draft', 'revision_required'].includes(status)) {
    try {
      const submittedPlan = await dependencies.submitPlan(input.planId);
      if (!submittedPlan?.status) {
        throw new Error('训练计划提交成功，但未返回有效状态。');
      }
      events.push({
        type: 'plan_submitted',
        planId: input.planId,
        fromStatus: status,
        toStatus: submittedPlan.status,
        stage: 'submit_plan',
      });
      completedStages.push('plan_submitted');
      status = submittedPlan.status;
    } catch (error) {
      const reloadedPlan = await dependencies.loadPlan(input.planId);
      if (!reloadedPlan?.status || !['pending_review', 'reviewed'].includes(reloadedPlan.status)) {
        throw error;
      }
      raceRecovered = true;
      events.push({
        type: 'race_recovered',
        planId: input.planId,
        fromStatus: status,
        toStatus: reloadedPlan.status,
        stage: 'submit_plan',
      });
      status = reloadedPlan.status;
    }
  } else {
    events.push({
      type: 'stage_skipped',
      planId: input.planId,
      fromStatus: status,
      toStatus: status,
      stage: 'submit_plan',
    });
  }
  if (status === 'pending_review') {
    try {
      await dependencies.approvePlan(input.planId);
      events.push({
        type: 'plan_approved',
        planId: input.planId,
        fromStatus: status,
        toStatus: 'reviewed',
        stage: 'approve_plan',
      });
      completedStages.push('plan_approved');
      status = 'reviewed';
    } catch (error) {
      const reloadedPlan = await dependencies.loadPlan(input.planId);
      if (reloadedPlan?.status !== 'reviewed') throw error;
      raceRecovered = true;
      events.push({
        type: 'race_recovered',
        planId: input.planId,
        fromStatus: status,
        toStatus: reloadedPlan.status,
        stage: 'approve_plan',
      });
      status = reloadedPlan.status;
    }
  } else if (status === 'reviewed') {
    events.push({
      type: 'stage_skipped',
      planId: input.planId,
      fromStatus: status,
      toStatus: status,
      stage: 'approve_plan',
    });
  }
  if (status !== 'reviewed') {
    throw planContinuationError(
      input.planId,
      '当前训练计划状态已经变化，请刷新后重试。已有题目方案不会丢失。',
    );
  }
  const semanticStateReloaded = authorityStatus !== input.currentStatus;
  const continuationCode: TrainingPlanContinuationCode = raceRecovered
    ? 'race_recovered'
    : semanticStateReloaded
      ? 'semantic_state_reloaded'
      : completedStages.includes('plan_submitted')
        ? 'submitted_and_approved'
        : completedStages.includes('plan_approved')
          ? 'approved'
          : 'already_reviewed';
  return {
    planId: input.planId,
    displayedStatus: input.currentStatus,
    authorityStatus,
    status,
    continuationCode,
    completedStages,
    events,
  };
}

function planContinuationError(planId: string, message: string) {
  return createStructuredRuntimeError({
    code: 'MATERIAL_OBSERVATION_PLAN_STATE_CHANGED',
    message,
    operation: 'material_observation_plan.continue_for_task_publication',
    objectId: planId,
    recoverability: 'reload_required',
  });
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
