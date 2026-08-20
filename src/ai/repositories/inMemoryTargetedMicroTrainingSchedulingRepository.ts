import {
  isTargetedMicroTrainingAssignment,
  isTargetedMicroTrainingRequest,
} from '../schemas/targetedMicroTraining.schema.ts';
import {
  createEmptyTargetedMicroTrainingSchedulingSnapshot,
  type TargetedMicroTrainingSchedulingSnapshot,
} from '../schemas/targetedMicroTrainingScheduling.schema.ts';
import type {
  TargetedMicroTrainingSchedulingCommit,
  TargetedMicroTrainingSchedulingCommitResult,
  TargetedMicroTrainingSchedulingRepository,
} from './targetedMicroTrainingSchedulingRepository.ts';

export class InMemoryTargetedMicroTrainingSchedulingRepository
implements TargetedMicroTrainingSchedulingRepository {
  private snapshot: TargetedMicroTrainingSchedulingSnapshot;

  constructor(now = new Date().toISOString()) {
    this.snapshot = createEmptyTargetedMicroTrainingSchedulingSnapshot(now);
  }

  async load(): Promise<TargetedMicroTrainingSchedulingSnapshot> {
    return clone(this.snapshot);
  }

  async commit(
    command: TargetedMicroTrainingSchedulingCommit,
  ): Promise<TargetedMicroTrainingSchedulingCommitResult> {
    const existingDecision = this.snapshot.decisions.find(
      (decision) => decision.decisionId === command.decision.decisionId,
    );
    const existingRequest = command.request && this.snapshot.requests.find(
      (request) => request.requestId === command.request!.requestId,
    );
    const existingAssignment = command.assignment && this.snapshot.assignments.find(
      (assignment) => assignment.assignmentId === command.assignment!.assignmentId,
    );
    if (existingDecision && (!command.request || existingRequest) && (!command.assignment || existingAssignment)) {
      return {
        status: 'reused',
        snapshot: clone(this.snapshot),
        ...(existingRequest ? { request: clone(existingRequest) } : {}),
        ...(existingAssignment ? { assignment: clone(existingAssignment) } : {}),
      };
    }
    if (command.expectedRevision !== this.snapshot.revision) {
      return { status: 'conflict', snapshot: clone(this.snapshot) };
    }
    validateCommand(command);
    this.snapshot = applyCommit(this.snapshot, command);
    return {
      status: 'committed',
      snapshot: clone(this.snapshot),
      ...(command.request ? { request: clone(command.request) } : {}),
      ...(command.assignment ? { assignment: clone(command.assignment) } : {}),
    };
  }

  async updateAssignmentStatus(input: {
    assignmentId: string;
    expectedStatus: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'unavailable';
    nextStatus: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'unavailable';
    expectedRevision: number;
    updatedAt: string;
  }): Promise<TargetedMicroTrainingSchedulingCommitResult> {
    const index = this.snapshot.assignments.findIndex(
      (assignment) => assignment.assignmentId === input.assignmentId,
    );
    if (index < 0 || input.expectedRevision !== this.snapshot.revision) {
      return { status: 'conflict', snapshot: clone(this.snapshot) };
    }
    const current = this.snapshot.assignments[index];
    if (current.status === input.nextStatus) {
      return { status: 'reused', snapshot: clone(this.snapshot), assignment: clone(current) };
    }
    if (current.status !== input.expectedStatus || !validTransition(current.status, input.nextStatus)) {
      return { status: 'conflict', snapshot: clone(this.snapshot) };
    }
    const assignment = { ...current, status: input.nextStatus };
    const assignments = [...this.snapshot.assignments];
    assignments[index] = assignment;
    this.snapshot = {
      ...this.snapshot,
      assignments,
      revision: this.snapshot.revision + 1,
      updatedAt: input.updatedAt,
    };
    return { status: 'committed', snapshot: clone(this.snapshot), assignment: clone(assignment) };
  }

  async clear(): Promise<void> {
    this.snapshot = createEmptyTargetedMicroTrainingSchedulingSnapshot(new Date().toISOString());
  }
}

export function applyCommit(
  snapshot: TargetedMicroTrainingSchedulingSnapshot,
  command: TargetedMicroTrainingSchedulingCommit,
): TargetedMicroTrainingSchedulingSnapshot {
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    decisions: appendUnique(snapshot.decisions, command.decision, 'decisionId'),
    requests: command.request
      ? appendUnique(snapshot.requests, command.request, 'requestId')
      : snapshot.requests,
    assignments: command.assignment
      ? appendUnique(snapshot.assignments, command.assignment, 'assignmentId')
      : snapshot.assignments,
    updatedAt: command.committedAt,
  };
}

export function validateCommand(command: TargetedMicroTrainingSchedulingCommit): void {
  if (command.request && !isTargetedMicroTrainingRequest(command.request)) {
    throw new Error('Targeted micro-training request is invalid.');
  }
  if (command.assignment && !isTargetedMicroTrainingAssignment(command.assignment)) {
    throw new Error('Targeted micro-training assignment is invalid.');
  }
  if (Boolean(command.request) !== Boolean(command.assignment)) {
    throw new Error('Request and Assignment must be committed atomically.');
  }
  if (command.assignment?.requestId !== command.request?.requestId) {
    throw new Error('Assignment does not belong to the committed Request.');
  }
}

export function validTransition(from: string, to: string): boolean {
  return (from === 'pending' && ['in_progress', 'skipped', 'unavailable'].includes(to))
    || (from === 'in_progress' && ['completed', 'unavailable'].includes(to));
}

function appendUnique<T extends Record<K, string>, K extends keyof T>(
  values: T[],
  value: T,
  key: K,
): T[] {
  return values.some((candidate) => candidate[key] === value[key]) ? values : [...values, value];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
