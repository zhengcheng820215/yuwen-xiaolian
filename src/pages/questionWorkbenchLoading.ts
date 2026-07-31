export type QuestionWorkbenchLoadRetryOptions = {
  retryDelaysMs?: number[];
  wait?: (delayMs: number) => Promise<void>;
};

export async function loadQuestionWorkbenchWithRetry<T>(
  load: () => Promise<T>,
  options: QuestionWorkbenchLoadRetryOptions = {},
): Promise<T> {
  const retryDelaysMs = options.retryDelaysMs ?? [120, 240];
  const wait = options.wait ?? delay;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      lastError = error;
      if (attempt === retryDelaysMs.length) break;
      await wait(retryDelaysMs[attempt]);
    }
  }

  throw lastError;
}

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}
