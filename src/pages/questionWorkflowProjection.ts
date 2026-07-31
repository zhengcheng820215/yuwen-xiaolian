import type { QuestionResourceDraftStatus } from '../ai/schemas/questionResourceAdmission.schema.ts';
import {
  resolveTaskProductionState,
  type TaskProductionState,
} from './taskProductionState.ts';

export type QuestionWorkflowVisibleStep =
  | 'question_check'
  | 'final_confirmation'
  | 'formal_publication'
  | 'published';

export type QuestionWorkflowSubstate =
  | 'dirty'
  | 'check_required'
  | 'warning_pending'
  | 'ready_to_submit'
  | 'pending_review'
  | 'approved'
  | 'publication_incomplete'
  | 'published';

export type QuestionWorkflowPrimaryAction =
  | 'save_and_recheck'
  | 'submit_final_confirmation'
  | 'record_review_decision'
  | 'publish'
  | 'resume_publication'
  | null;

export type QuestionWorkflowProjection = {
  visibleStep: QuestionWorkflowVisibleStep;
  substate: QuestionWorkflowSubstate;
  primaryAction: QuestionWorkflowPrimaryAction;
  message: string;
  productionState: TaskProductionState;
};

export type QuestionWorkflowProjectionInput = {
  draftStatus: string;
  isDirty: boolean;
  structureCheckPassed?: boolean;
  qualityCheckComplete: boolean;
  warningCount: number;
  warningsReady: boolean;
  publicationStatus: string | null;
  publicationBlocked?: boolean;
};

export function resolveQuestionWorkflowProjection(
  input: QuestionWorkflowProjectionInput,
): QuestionWorkflowProjection {
  const productionView = resolveTaskProductionState({
    trainingTaskId: 'question-workflow',
    draft: {
      draftId: 'question-workflow-draft',
      revision: 1,
      status: input.draftStatus as QuestionResourceDraftStatus,
      isDirty: input.isDirty,
      assessmentStatus: input.qualityCheckComplete ? 'current' : 'missing',
    },
    publication: input.publicationStatus === 'published'
      ? { status: 'published', sourceDraftId: 'question-workflow-draft' }
      : input.publicationStatus === 'publication_incomplete'
        ? { status: 'failed', sourceDraftId: 'question-workflow-draft' }
        : { status: 'none' },
  });
  const productionState = productionView.state;

  if (input.publicationStatus === 'published') {
    return {
      visibleStep: 'published',
      substate: 'published',
      primaryAction: null,
      message: '已发布',
      productionState,
    };
  }

  if (input.publicationStatus === 'publication_incomplete') {
    return {
      visibleStep: 'formal_publication',
      substate: 'publication_incomplete',
      primaryAction: 'resume_publication',
      message: '审核已通过，发布未完成',
      productionState,
    };
  }

  if (input.draftStatus === 'reviewed') {
    return {
      visibleStep: 'formal_publication',
      substate: 'approved',
      primaryAction: input.publicationBlocked ? null : 'publish',
      message: input.publicationBlocked ? '发布前设置待调整' : '已确认，待发布',
      productionState,
    };
  }

  if (input.draftStatus === 'pending_review') {
    return {
      visibleStep: 'final_confirmation',
      substate: 'pending_review',
      primaryAction: 'record_review_decision',
      message: '当前 Revision 正在最终确认',
      productionState,
    };
  }

  if (input.isDirty) {
    return {
      visibleStep: 'question_check',
      substate: 'dirty',
      primaryAction: 'save_and_recheck',
      message: '当前题目已修改，需要保存并重新检查',
      productionState,
    };
  }

  if (!input.qualityCheckComplete) {
    return {
      visibleStep: 'question_check',
      substate: 'check_required',
      primaryAction: 'save_and_recheck',
      message: input.structureCheckPassed
        ? '结构检查通过，完整检查未完成'
        : '当前题目需要完成检查',
      productionState,
    };
  }

  if (input.warningCount > 0 && !input.warningsReady) {
    return {
      visibleStep: 'question_check',
      substate: 'warning_pending',
      primaryAction: 'submit_final_confirmation',
      message: `${input.warningCount} 项提醒需要说明处理理由`,
      productionState,
    };
  }

  return {
    visibleStep: 'final_confirmation',
    substate: 'ready_to_submit',
    primaryAction: 'submit_final_confirmation',
    message: '当前题目已完成检查，等待最终确认',
    productionState,
  };
}

export function questionWorkflowStepIndex(
  projection: QuestionWorkflowProjection,
): 1 | 2 | 3 {
  if (projection.visibleStep === 'question_check') return 1;
  if (projection.visibleStep === 'final_confirmation') return 2;
  return 3;
}
