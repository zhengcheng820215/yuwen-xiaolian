export type TaskProductionCommand =
  | 'createTaskQuestionDraft'
  | 'confirmTrainingPlanForTaskProduction'
  | 'editTaskQuestion'
  | 'saveTaskDraft'
  | 'runTaskCheck'
  | 'submitTaskForFinalConfirmation'
  | 'recordTaskConfirmationDecision'
  | 'returnTaskForRevision'
  | 'publishConfirmedTask'
  | 'retryTaskPublication'
  | 'viewFormalQuestion';

export type TaskProductionCommandStatus =
  | 'completed'
  | 'reused';

export type TaskProductionCommandStage<TValue = unknown> = {
  stage: string;
  execute: () => Promise<TValue>;
};

export type TaskProductionCommandResult<TValue = unknown> = {
  command: TaskProductionCommand;
  commandId: string;
  idempotencyKey: string;
  targetId: string;
  expectedRevision?: number;
  status: TaskProductionCommandStatus;
  completedStages: string[];
  value?: TValue;
};

export class TaskProductionCommandStageError<TValue = unknown> extends Error {
  readonly status = 'partially_completed' as const;
  readonly command: TaskProductionCommand;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly targetId: string;
  readonly expectedRevision?: number;
  readonly failedStage: string;
  readonly completedStages: string[];
  readonly nextCommand?: TaskProductionCommand;
  readonly partialValue?: TValue;
  readonly originalError: unknown;

  constructor(input: {
    message: string;
    command: TaskProductionCommand;
    commandId: string;
    idempotencyKey: string;
    targetId: string;
    expectedRevision?: number;
    failedStage: string;
    completedStages: string[];
    nextCommand?: TaskProductionCommand;
    partialValue?: TValue;
    originalError: unknown;
  }) {
    super(input.message);
    this.name = 'TaskProductionCommandStageError';
    this.command = input.command;
    this.commandId = input.commandId;
    this.idempotencyKey = input.idempotencyKey;
    this.targetId = input.targetId;
    this.expectedRevision = input.expectedRevision;
    this.failedStage = input.failedStage;
    this.completedStages = [...input.completedStages];
    this.nextCommand = input.nextCommand;
    this.partialValue = input.partialValue;
    this.originalError = input.originalError;
  }
}

const inFlightCommands = new Map<string, Promise<unknown>>();
let commandSequence = 0;

export function buildTaskProductionCommandKey(input: {
  command: TaskProductionCommand;
  targetId: string;
  expectedRevision?: number;
}): string {
  return `${input.command}:${input.targetId}:r${input.expectedRevision ?? 'none'}`;
}

export function executeTaskProductionOnce<TValue>(
  idempotencyKey: string,
  action: () => Promise<TValue>,
): Promise<TValue> {
  const existing = inFlightCommands.get(idempotencyKey);
  if (existing) return existing as Promise<TValue>;

  let execution: Promise<TValue>;
  execution = action().finally(() => {
    if (inFlightCommands.get(idempotencyKey) === execution) {
      inFlightCommands.delete(idempotencyKey);
    }
  });
  inFlightCommands.set(idempotencyKey, execution);
  return execution;
}

export function executeTaskProductionCommand<TValue>(input: {
  command: TaskProductionCommand;
  targetId: string;
  expectedRevision?: number;
  stages: TaskProductionCommandStage[];
  nextCommandOnFailure?: TaskProductionCommand;
  failureMessage?: (failedStage: string, completedStages: string[]) => string;
  onStageStart?: (stage: string, completedStages: string[]) => void;
  onStageComplete?: (stage: string, completedStages: string[]) => void;
  resolveValue: () => TValue | undefined;
  reused?: boolean;
}): Promise<TaskProductionCommandResult<TValue>> {
  const idempotencyKey = buildTaskProductionCommandKey(input);
  return executeTaskProductionOnce(idempotencyKey, async () => {
    const commandId = `${idempotencyKey}:${++commandSequence}`;
    const completedStages: string[] = [];

    for (const stage of input.stages) {
      try {
        input.onStageStart?.(stage.stage, [...completedStages]);
        await stage.execute();
        completedStages.push(stage.stage);
        input.onStageComplete?.(stage.stage, [...completedStages]);
      } catch (error) {
        const message = input.failureMessage?.(stage.stage, completedStages)
          || (error instanceof Error ? error.message : '操作未完成，请重试。');
        throw new TaskProductionCommandStageError<TValue>({
          message,
          command: input.command,
          commandId,
          idempotencyKey,
          targetId: input.targetId,
          expectedRevision: input.expectedRevision,
          failedStage: stage.stage,
          completedStages,
          nextCommand: input.nextCommandOnFailure,
          partialValue: input.resolveValue(),
          originalError: error,
        });
      }
    }

    return {
      command: input.command,
      commandId,
      idempotencyKey,
      targetId: input.targetId,
      expectedRevision: input.expectedRevision,
      status: input.reused ? 'reused' : 'completed',
      completedStages,
      value: input.resolveValue(),
    };
  });
}
