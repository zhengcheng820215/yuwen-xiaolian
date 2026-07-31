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

export type QuestionLifecycleBucketCounts = {
  pendingAction: number;
  pendingReview: number;
  approvedForPublication: number;
  published: number;
  total: number;
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

export function countQuestionLifecycleBuckets(
  statuses: QuestionWorkbenchDisplayStatus[],
): QuestionLifecycleBucketCounts {
  return statuses.reduce<QuestionLifecycleBucketCounts>((counts, status) => {
    counts.total += 1;
    if (status === 'published') {
      counts.published += 1;
    } else if (status === 'reviewed' || status === 'publication_incomplete') {
      counts.approvedForPublication += 1;
    } else if (status === 'pending_review') {
      counts.pendingReview += 1;
    } else {
      counts.pendingAction += 1;
    }
    return counts;
  }, {
    pendingAction: 0,
    pendingReview: 0,
    approvedForPublication: 0,
    published: 0,
    total: 0,
  });
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
  loading?: boolean;
}): QuestionWorkbenchPageIdentity {
  if (input.loading) {
    return {
      title: '正在载入题目',
      subtitle: '',
    };
  }

  if (!input.focusedReview) {
    return {
      title: '题目录入工作台',
      subtitle: '结构化题目录入与提交前检查',
    };
  }

  return {
    title: '题目资源工作台',
    subtitle: '',
  };
}

export function resolveQuestionLocalSectionTitle(input: {
  questionNumber?: number | null;
  status: QuestionWorkbenchDisplayStatus;
}): string {
  const prefix = input.questionNumber ? `题目${input.questionNumber}` : '当前题目';

  switch (input.status) {
    case 'pending_review':
      return `${prefix} · 人工审核`;
    case 'reviewed':
      return `${prefix} · 发布准备`;
    case 'publication_incomplete':
      return `${prefix} · 发布恢复`;
    case 'published':
      return `${prefix} · 已发布`;
    case 'rejected':
    case 'archived':
      return `${prefix} · 审核记录`;
    case 'drafted':
    case 'validation_failed':
    case 'revision_required':
    default:
      return `${prefix} · 修改与提交`;
  }
}
