export type QuestionWorkbenchDisplayStatus =
  | 'drafted'
  | 'validation_failed'
  | 'pending_review'
  | 'revision_required'
  | 'reviewed'
  | 'rejected'
  | 'archived'
  | 'published'
  | 'publication_incomplete'
  | null;

export type QuestionWorkbenchPageIdentity = {
  title: string;
  subtitle: string;
};

export type QuestionReturnIssueType =
  | 'question_expression'
  | 'ability_target'
  | 'difficulty'
  | 'rubric'
  | 'answer_scope'
  | 'student_presentation'
  | 'other';

export function countPendingReviewDrafts(
  statuses: QuestionWorkbenchDisplayStatus[],
): number {
  return statuses.filter((status) => status === 'pending_review').length;
}

export function resolveQuestionBatchNavigationTitle(focusedReview: boolean): string {
  return focusedReview ? '本批题目' : 'DRAFT / REVIEW';
}

export function resolveReviewWarningSection(input: {
  status: QuestionWorkbenchDisplayStatus;
  warningCount: number;
  allWarningsDecided: boolean;
}): {
  title: string;
  pending: boolean;
} {
  const pending = input.status === 'pending_review' && !input.allWarningsDecided;
  return {
    title: `${pending ? '待确认事项' : '提醒处理记录'}（${input.warningCount}）`,
    pending,
  };
}

export function getReturnIssueEditorTargetIds(
  issueType: QuestionReturnIssueType | string | null | undefined,
  options: { planReviewMode: boolean },
): string[] {
  switch (issueType) {
    case 'question_expression':
      return ['question-stem-editor'];
    case 'ability_target':
      return ['question-training-targets'];
    case 'difficulty':
      return options.planReviewMode
        ? ['question-training-targets']
        : ['question-difficulty-editor'];
    case 'rubric':
      return ['question-rubric-editor'];
    case 'answer_scope':
      return ['question-answer-requirements'];
    case 'student_presentation':
      return ['question-response-settings', 'question-stem-editor'];
    default:
      return [];
  }
}

export function resolveQuestionWorkbenchPageIdentity(input: {
  focusedReview: boolean;
  status: QuestionWorkbenchDisplayStatus;
}): QuestionWorkbenchPageIdentity {
  if (!input.focusedReview) {
    return {
      title: '题目录入工作台',
      subtitle: '结构化题目录入与提交前检查',
    };
  }

  switch (input.status) {
    case 'pending_review':
      return {
        title: '题目人工审核平台',
        subtitle: '只读确认题目内容并作出审核决定',
      };
    case 'reviewed':
      return {
        title: '题目发布平台',
        subtitle: '完成发布准备检查并正式发布',
      };
    case 'publication_incomplete':
      return {
        title: '题目发布恢复平台',
        subtitle: '补齐未完成的发布关联',
      };
    case 'published':
      return {
        title: '已发布题目',
        subtitle: '查看正式题目与发布记录',
      };
    case 'rejected':
    case 'archived':
      return {
        title: '题目审核记录',
        subtitle: '查看审核决定与历史记录',
      };
    case 'drafted':
    case 'validation_failed':
    case 'revision_required':
    default:
      return {
        title: '题目修改与提交平台',
        subtitle: '',
      };
  }
}
