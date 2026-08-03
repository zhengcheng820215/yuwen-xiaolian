export type TaskPublicationBatchItem = {
  trainingTaskId: string;
  draftId: string;
  expectedDraftRevision?: number;
  action: 'publish' | 'retry_publication';
};

export type TaskPublicationBatchItemResult = TaskPublicationBatchItem & {
  status: 'published' | 'failed';
  retryable: boolean;
  message: string;
};

export type TaskPublicationBatchResult = {
  status: 'completed' | 'partially_completed' | 'failed' | 'no_eligible_tasks';
  total: number;
  completed: number;
  failed: number;
  items: TaskPublicationBatchItemResult[];
};

type PublishConfirmedTaskExecutor = (input: {
  draftId: string;
  expectedDraftRevision?: number;
  retryExistingPublication: boolean;
}) => Promise<{ status: 'completed' | 'reused' }>;

export async function executePublishConfirmedTaskBatchCommand(input: {
  items: TaskPublicationBatchItem[];
  publishItem: PublishConfirmedTaskExecutor;
  onItemStart?: (item: TaskPublicationBatchItem) => void | Promise<void>;
  onItemComplete?: (item: TaskPublicationBatchItemResult) => void | Promise<void>;
}): Promise<TaskPublicationBatchResult> {
  if (input.items.length === 0) {
    return {
      status: 'no_eligible_tasks',
      total: 0,
      completed: 0,
      failed: 0,
      items: [],
    };
  }

  const items: TaskPublicationBatchItemResult[] = [];
  for (const item of input.items) {
    await notifyBatchObserver(() => input.onItemStart?.(item));
    try {
      const result = await input.publishItem({
        draftId: item.draftId,
        expectedDraftRevision: item.expectedDraftRevision,
        retryExistingPublication: item.action === 'retry_publication',
      });
      const completedItem: TaskPublicationBatchItemResult = {
        ...item,
        status: 'published',
        retryable: false,
        message: result.status === 'reused' ? '题目发布结果已恢复。' : '题目发布成功。',
      };
      items.push(completedItem);
      await notifyBatchObserver(() => input.onItemComplete?.(completedItem));
    } catch (error) {
      const failedItem: TaskPublicationBatchItemResult = {
        ...item,
        status: 'failed',
        retryable: true,
        message: error instanceof Error ? error.message : '题目发布未完成，可重试。',
      };
      items.push(failedItem);
      await notifyBatchObserver(() => input.onItemComplete?.(failedItem));
    }
  }

  const completed = items.filter((item) => item.status === 'published').length;
  const failed = items.length - completed;
  return {
    status: failed === 0
      ? 'completed'
      : completed === 0
        ? 'failed'
        : 'partially_completed',
    total: items.length,
    completed,
    failed,
    items,
  };
}

async function notifyBatchObserver(observer: () => void | Promise<void> | undefined): Promise<void> {
  try {
    await observer();
  } catch {
    // Progress observers must never change the publication result.
  }
}
