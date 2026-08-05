export type TaskCardDisclosureKey =
  | 'task_attributes'
  | 'scoring'
  | 'design_rationale'
  | 'formal_resource';

export type TaskCardDisclosureState = Record<
  string,
  Partial<Record<TaskCardDisclosureKey, boolean>>
>;

const CLOSED_DISCLOSURES: Record<TaskCardDisclosureKey, boolean> = {
  task_attributes: false,
  scoring: false,
  design_rationale: false,
  formal_resource: false,
};

export function isTaskCardDisclosureOpen(
  state: TaskCardDisclosureState,
  taskId: string,
  key: TaskCardDisclosureKey,
) {
  return state[taskId]?.[key] === true;
}

export function setTaskCardDisclosureOpen(
  state: TaskCardDisclosureState,
  taskId: string,
  key: TaskCardDisclosureKey,
  open: boolean,
): TaskCardDisclosureState {
  return {
    ...state,
    [taskId]: {
      ...CLOSED_DISCLOSURES,
      ...state[taskId],
      [key]: open,
    },
  };
}
