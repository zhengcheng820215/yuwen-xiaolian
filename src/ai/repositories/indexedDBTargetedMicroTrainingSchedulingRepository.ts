import type { TargetedMicroTrainingAssignment } from '../schemas/targetedMicroTraining.schema.ts';
import {
  createEmptyTargetedMicroTrainingSchedulingSnapshot,
  isTargetedMicroTrainingSchedulingSnapshot,
  type TargetedMicroTrainingSchedulingSnapshot,
} from '../schemas/targetedMicroTrainingScheduling.schema.ts';
import { applyCommit, validTransition, validateCommand } from './inMemoryTargetedMicroTrainingSchedulingRepository.ts';
import type {
  TargetedMicroTrainingSchedulingCommit,
  TargetedMicroTrainingSchedulingCommitResult,
  TargetedMicroTrainingSchedulingRepository,
} from './targetedMicroTrainingSchedulingRepository.ts';

const DB_NAME = 'yuwen_xiaolian_targeted_micro_training';
const DB_VERSION = 1;
const STORE_NAME = 'scheduling_snapshot';
const SNAPSHOT_KEY = 'current';
const TIMEOUT_MS = 3_000;

export class IndexedDBTargetedMicroTrainingSchedulingRepository
implements TargetedMicroTrainingSchedulingRepository {
  async load(): Promise<TargetedMicroTrainingSchedulingSnapshot> {
    const db = await openDatabase();
    try {
      const value = await requestToPromise<unknown>(
        db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(SNAPSHOT_KEY),
      );
      return isTargetedMicroTrainingSchedulingSnapshot(value)
        ? value
        : createEmptyTargetedMicroTrainingSchedulingSnapshot(new Date().toISOString());
    } finally {
      db.close();
    }
  }

  async commit(
    command: TargetedMicroTrainingSchedulingCommit,
  ): Promise<TargetedMicroTrainingSchedulingCommitResult> {
    validateCommand(command);
    return this.transact((snapshot) => {
      const decision = snapshot.decisions.find((item) => item.decisionId === command.decision.decisionId);
      const request = command.request && snapshot.requests.find((item) => item.requestId === command.request!.requestId);
      const assignment = command.assignment && snapshot.assignments.find(
        (item) => item.assignmentId === command.assignment!.assignmentId,
      );
      if (decision && (!command.request || request) && (!command.assignment || assignment)) {
        return { status: 'reused', snapshot, request, assignment };
      }
      if (snapshot.revision !== command.expectedRevision) return { status: 'conflict', snapshot };
      const next = applyCommit(snapshot, command);
      return { status: 'committed', snapshot: next, request: command.request, assignment: command.assignment };
    });
  }

  async updateAssignmentStatus(input: {
    assignmentId: string;
    expectedStatus: TargetedMicroTrainingAssignment['status'];
    nextStatus: TargetedMicroTrainingAssignment['status'];
    expectedRevision: number;
    updatedAt: string;
  }): Promise<TargetedMicroTrainingSchedulingCommitResult> {
    return this.transact((snapshot) => {
      const index = snapshot.assignments.findIndex((item) => item.assignmentId === input.assignmentId);
      if (index < 0 || snapshot.revision !== input.expectedRevision) return { status: 'conflict', snapshot };
      const current = snapshot.assignments[index];
      if (current.status === input.nextStatus) {
        return { status: 'reused', snapshot, assignment: current };
      }
      if (current.status !== input.expectedStatus || !validTransition(current.status, input.nextStatus)) {
        return { status: 'conflict', snapshot };
      }
      const assignment = { ...current, status: input.nextStatus };
      const assignments = [...snapshot.assignments];
      assignments[index] = assignment;
      return {
        status: 'committed',
        assignment,
        snapshot: {
          ...snapshot,
          assignments,
          revision: snapshot.revision + 1,
          updatedAt: input.updatedAt,
        },
      };
    });
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    try {
      await requestToPromise(
        db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(SNAPSHOT_KEY),
      );
    } finally {
      db.close();
    }
  }

  private async transact(
    updater: (snapshot: TargetedMicroTrainingSchedulingSnapshot) => TargetedMicroTrainingSchedulingCommitResult,
  ): Promise<TargetedMicroTrainingSchedulingCommitResult> {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const completion = transactionToPromise(transaction);
      const store = transaction.objectStore(STORE_NAME);
      const raw = await requestToPromise<unknown>(store.get(SNAPSHOT_KEY));
      const current = isTargetedMicroTrainingSchedulingSnapshot(raw)
        ? raw
        : createEmptyTargetedMicroTrainingSchedulingSnapshot(new Date().toISOString());
      const result = updater(current);
      if (result.status === 'committed') await requestToPromise(store.put(result.snapshot, SNAPSHOT_KEY));
      await completion;
      return result;
    } finally {
      db.close();
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    const timer = setTimeout(() => reject(new Error('Targeted scheduling database timed out.')), TIMEOUT_MS);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => { clearTimeout(timer); resolve(request.result); };
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    request.onblocked = () => { clearTimeout(timer); reject(new Error('Targeted scheduling database is blocked.')); };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted.'));
  });
}
