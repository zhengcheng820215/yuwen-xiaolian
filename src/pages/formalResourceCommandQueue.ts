export type FormalResourceCommandQueueSnapshot = {
  activeKey: string | null;
  queuedKeys: string[];
};

type QueueListener = (snapshot: FormalResourceCommandQueueSnapshot) => void;

export class FormalResourceCommandQueue {
  private activeKey: string | null = null;
  private queuedKeys: string[] = [];
  private pendingCommands = new Map<string, Promise<unknown>>();
  private listeners = new Set<QueueListener>();
  private tail: Promise<void> = Promise.resolve();

  getSnapshot(): FormalResourceCommandQueueSnapshot {
    return {
      activeKey: this.activeKey,
      queuedKeys: [...this.queuedKeys],
    };
  }

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enqueue<Result>(commandKey: string, command: () => Promise<Result>): Promise<Result> {
    const existing = this.pendingCommands.get(commandKey);
    if (existing) return existing as Promise<Result>;

    this.queuedKeys.push(commandKey);
    this.emit();

    const execution = this.tail.then(async () => {
      this.queuedKeys = this.queuedKeys.filter((key) => key !== commandKey);
      this.activeKey = commandKey;
      this.emit();
      return command();
    });

    const tracked = execution.finally(() => {
      if (this.activeKey === commandKey) this.activeKey = null;
      if (this.pendingCommands.get(commandKey) === tracked) {
        this.pendingCommands.delete(commandKey);
      }
      this.emit();
    });

    this.pendingCommands.set(commandKey, tracked);
    this.tail = tracked.then(() => undefined, () => undefined);
    return tracked;
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
