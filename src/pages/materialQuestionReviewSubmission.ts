export type QuestionReviewSubmissionStage =
  | 'plan_submitted'
  | 'plan_approved'
  | 'drafts_created';

export type QuestionReviewSubmissionFailedStage =
  | 'submit_plan'
  | 'approve_plan'
  | 'create_drafts';

export type QuestionReviewSubmissionResult = {
  status: 'completed';
  completedStages: QuestionReviewSubmissionStage[];
};

export type QuestionReviewSubmissionInput = {
  initialPlanStatus: string;
  existingDraftCount: number;
  taskPlanCount: number;
  submitPlan: () => Promise<unknown>;
  approvePlan: () => Promise<unknown>;
  createDrafts: () => Promise<unknown>;
};

export class QuestionReviewSubmissionStageError extends Error {
  readonly failedStage: QuestionReviewSubmissionFailedStage;
  readonly completedStages: QuestionReviewSubmissionStage[];
  readonly originalError: unknown;

  constructor(input: {
    message: string;
    failedStage: QuestionReviewSubmissionFailedStage;
    completedStages: QuestionReviewSubmissionStage[];
    originalError: unknown;
  }) {
    super(input.message);
    this.name = 'QuestionReviewSubmissionStageError';
    this.failedStage = input.failedStage;
    this.completedStages = [...input.completedStages];
    this.originalError = input.originalError;
  }
}

export async function executeQuestionReviewSubmission(
  input: QuestionReviewSubmissionInput,
): Promise<QuestionReviewSubmissionResult> {
  const completedStages = completedStagesForStatus(input.initialPlanStatus);
  let status = input.initialPlanStatus;

  if (['draft', 'revision_required'].includes(status)) {
    await runStage({
      action: input.submitPlan,
      completedStages,
      completedStage: 'plan_submitted',
      failedStage: 'submit_plan',
      failureMessage: '训练计划提交失败，尚未进入训练计划审核，可重试。',
    });
    status = 'pending_review';
  }

  if (status === 'pending_review') {
    await runStage({
      action: input.approvePlan,
      completedStages,
      completedStage: 'plan_approved',
      failedStage: 'approve_plan',
      failureMessage: '训练计划已提交，但训练计划确认失败，可重试。',
    });
    status = 'reviewed';
  }

  if (status !== 'reviewed') {
    throw new QuestionReviewSubmissionStageError({
      message: `当前训练计划状态为“${status}”，不能创建待审核题目。请刷新后重试。`,
      failedStage: 'create_drafts',
      completedStages,
      originalError: new Error(`Unsupported plan status: ${status}`),
    });
  }

  if (input.existingDraftCount < input.taskPlanCount) {
    await runStage({
      action: input.createDrafts,
      completedStages,
      completedStage: 'drafts_created',
      failedStage: 'create_drafts',
      failureMessage: '训练计划已确认，但待审核题目创建失败，可重试。',
    });
  } else {
    pushUnique(completedStages, 'drafts_created');
  }

  return { status: 'completed', completedStages };
}

function completedStagesForStatus(status: string): QuestionReviewSubmissionStage[] {
  if (status === 'reviewed') return ['plan_submitted', 'plan_approved'];
  if (status === 'pending_review') return ['plan_submitted'];
  return [];
}

async function runStage(input: {
  action: () => Promise<unknown>;
  completedStages: QuestionReviewSubmissionStage[];
  completedStage: QuestionReviewSubmissionStage;
  failedStage: QuestionReviewSubmissionFailedStage;
  failureMessage: string;
}): Promise<void> {
  try {
    await input.action();
    pushUnique(input.completedStages, input.completedStage);
  } catch (error) {
    throw new QuestionReviewSubmissionStageError({
      message: input.failureMessage,
      failedStage: input.failedStage,
      completedStages: input.completedStages,
      originalError: error,
    });
  }
}

function pushUnique(
  stages: QuestionReviewSubmissionStage[],
  stage: QuestionReviewSubmissionStage,
): void {
  if (!stages.includes(stage)) stages.push(stage);
}
