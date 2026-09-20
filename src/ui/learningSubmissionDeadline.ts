export class LearningSubmissionDeadlineError extends Error {
  constructor() {
    super('本次处理等待时间较长，当前输入仍在页面中。请检查恢复状态后再继续。');
    this.name = 'LearningSubmissionDeadlineError';
  }
}

export async function waitForLearningSubmission<T>(task: Promise<T>, timeoutMs = 85_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new LearningSubmissionDeadlineError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
