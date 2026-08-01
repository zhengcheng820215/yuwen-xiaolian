import {
  decideQuestionResourceWorkbenchReview,
  freezeQuestionResourceWorkbenchDraft,
  retryQuestionResourceWorkbenchPublication,
  saveQuestionResourceWorkbenchDraft,
  submitQuestionResourceWorkbenchReview,
  validateQuestionResourceWorkbenchDraft,
  withdrawQuestionResourceWorkbenchReview,
} from '../api/questionResourceWorkbench';
import {
  executeTaskProductionCommand,
  type TaskProductionCommandStage,
  type TaskProductionCommandResult,
} from './taskProductionCommandRuntime';

type SavedDraft = Awaited<ReturnType<typeof saveQuestionResourceWorkbenchDraft>>;
type SaveDraftInput = Parameters<typeof saveQuestionResourceWorkbenchDraft>[0];

export function executeSaveTaskDraftCommand(
  input: SaveDraftInput,
): Promise<TaskProductionCommandResult<SavedDraft>> {
  let savedDraft: SavedDraft | undefined;
  return executeTaskProductionCommand({
    command: 'saveTaskDraft',
    targetId: input.draftId || input.taskId || 'new-question-draft',
    expectedRevision: input.expectedDraftRevision,
    stages: [{
      stage: 'draft_saved',
      execute: async () => {
        savedDraft = await saveQuestionResourceWorkbenchDraft(input);
        return savedDraft;
      },
    }],
    resolveValue: () => savedDraft,
  });
}

export function executeQuestionCheckCommand(input: {
  currentDraft?: SavedDraft;
  draftToSave?: SaveDraftInput;
}): Promise<TaskProductionCommandResult<SavedDraft>> {
  let activeDraft = input.currentDraft;
  const stages: TaskProductionCommandStage[] = [];
  if (input.draftToSave) {
    stages.push({
      stage: 'draft_saved',
      execute: async () => {
        activeDraft = await saveQuestionResourceWorkbenchDraft(input.draftToSave!);
        return activeDraft;
      },
    });
  }
  stages.push({
    stage: 'assessment_completed',
    execute: () => {
      if (!activeDraft) {
        throw new Error('没有可检查的题目草稿。');
      }
      return validateQuestionResourceWorkbenchDraft(
        activeDraft.draftId,
        activeDraft.revision,
      );
    },
  });

  return executeTaskProductionCommand({
    command: 'runTaskCheck',
    targetId: input.draftToSave?.draftId || input.currentDraft?.draftId || 'new-question-draft',
    expectedRevision: input.draftToSave?.expectedDraftRevision ?? input.currentDraft?.revision,
    stages,
    nextCommandOnFailure: 'runTaskCheck',
    failureMessage: (failedStage, completedStages) => (
      failedStage === 'assessment_completed' && completedStages.includes('draft_saved')
        ? '题目修改已保存，但完整检查未完成。可直接继续检查，不需要重复保存。'
        : '题目检查未完成，请重试。'
    ),
    resolveValue: () => activeDraft,
  });
}

export function executeSubmitFinalConfirmationCommand(input: {
  draftId: string;
  expectedDraftRevision?: number;
  warningAcknowledgements: Parameters<typeof submitQuestionResourceWorkbenchReview>[2];
}) {
  let submittedDraft: Awaited<ReturnType<typeof submitQuestionResourceWorkbenchReview>> | undefined;
  return executeTaskProductionCommand({
    command: 'submitTaskForFinalConfirmation',
    targetId: input.draftId,
    expectedRevision: input.expectedDraftRevision,
    stages: [{
      stage: 'final_confirmation_submitted',
      execute: async () => {
        submittedDraft = await submitQuestionResourceWorkbenchReview(
          input.draftId,
          input.expectedDraftRevision,
          input.warningAcknowledgements,
        );
        return submittedDraft;
      },
    }],
    resolveValue: () => submittedDraft,
  });
}

export function executeWithdrawFinalConfirmationCommand(input: {
  draftId: string;
  expectedDraftRevision?: number;
}) {
  let withdrawnDraft: Awaited<ReturnType<typeof withdrawQuestionResourceWorkbenchReview>> | undefined;
  return executeTaskProductionCommand({
    command: 'returnTaskForRevision',
    targetId: input.draftId,
    expectedRevision: input.expectedDraftRevision,
    stages: [{
      stage: 'confirmation_withdrawn',
      execute: async () => {
        withdrawnDraft = await withdrawQuestionResourceWorkbenchReview(
          input.draftId,
          input.expectedDraftRevision,
        );
        return withdrawnDraft;
      },
    }],
    resolveValue: () => withdrawnDraft,
  });
}

export function executeRecordFinalConfirmationCommand(
  input: Parameters<typeof decideQuestionResourceWorkbenchReview>[0],
) {
  let decision: Awaited<ReturnType<typeof decideQuestionResourceWorkbenchReview>> | undefined;
  return executeTaskProductionCommand({
    command: input.action === 'revision_required'
      ? 'returnTaskForRevision'
      : 'recordTaskConfirmationDecision',
    targetId: input.draftId,
    expectedRevision: input.expectedDraftRevision,
    stages: [{
      stage: input.action === 'revision_required'
        ? 'revision_requested'
        : 'confirmation_decision_recorded',
      execute: async () => {
        decision = await decideQuestionResourceWorkbenchReview(input);
        return decision;
      },
    }],
    resolveValue: () => decision,
  });
}

export function executePublishConfirmedTaskCommand(input: {
  draftId: string;
  expectedDraftRevision?: number;
  retryExistingPublication: boolean;
}) {
  let publication:
    | Awaited<ReturnType<typeof freezeQuestionResourceWorkbenchDraft>>
    | Awaited<ReturnType<typeof retryQuestionResourceWorkbenchPublication>>
    | undefined;
  return executeTaskProductionCommand({
    command: input.retryExistingPublication
      ? 'retryTaskPublication'
      : 'publishConfirmedTask',
    targetId: input.draftId,
    expectedRevision: input.expectedDraftRevision,
    stages: [{
      stage: 'publication_completed',
      execute: async () => {
        publication = input.retryExistingPublication
          ? await retryQuestionResourceWorkbenchPublication(
            input.draftId,
            input.expectedDraftRevision,
          )
          : await freezeQuestionResourceWorkbenchDraft(
            input.draftId,
            input.expectedDraftRevision,
          );
        return publication;
      },
    }],
    nextCommandOnFailure: 'retryTaskPublication',
    failureMessage: () => input.retryExistingPublication
      ? '正式题目发布恢复未完成，可继续重试；已成功的发布对象不会重复创建。'
      : '题目已经确认，但正式发布未完成，可直接重试发布。',
    resolveValue: () => publication,
    reused: input.retryExistingPublication,
  });
}
