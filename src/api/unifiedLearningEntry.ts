import { buildUnifiedLearningEntryState, createUnifiedLearningActivityContext } from '../ai/agents/unifiedLearningEntryAgent.ts';
import {
  closeLearningSessionRecord,
  createLearningSessionRecord,
  saveLearningSessionRecord,
} from '../ai/agents/learningSessionHistoryAgent.ts';
import { IndexedDBLearningPersistenceRepository } from '../ai/repositories/indexedDBLearningPersistenceRepository.ts';
import { IndexedDBLearningSessionRepository } from '../ai/repositories/indexedDBLearningSessionRepository.ts';
import { IndexedDBRealLearningOperationRepository } from '../ai/repositories/indexedDBRealLearningOperationRepository.ts';
import { LocalStorageUnifiedLearningEntryRepository } from '../ai/repositories/localStorageUnifiedLearningEntryRepository.ts';
import type { UnifiedLearningActivityContext, UnifiedLearningEntryState } from '../ai/schemas/unifiedLearningEntry.schema.ts';
import type { ContinuousLearningDemoState } from './continuousLearningDemo.ts';
import {
  loadPhase163DueRetestPlans,
  resolveCurrentLearningTaskAvailability,
} from './phase163LiveLearning.ts';
import {
  assertPhase163ProductRuntimeIdentity,
  PHASE163_LEARNING_TIMEZONE,
  resolvePhase163LearningStudentId,
} from './phase163LearningIdentity.ts';

export const UNIFIED_ENTRY_STUDENT_ID = resolvePhase163LearningStudentId();
export const UNIFIED_LEARNING_ENTRY_READ_TIMEOUT_MS = 5_000;
export const UNIFIED_LEARNING_ENTRY_STAGE_TIMEOUT_MS = 4_000;

const MAX_ROUNDS = 5;
const persistenceRepository = new IndexedDBLearningPersistenceRepository();
const activityRepository = new LocalStorageUnifiedLearningEntryRepository();
const operationRepository = new IndexedDBRealLearningOperationRepository();
const sessionRepository = new IndexedDBLearningSessionRepository();

export async function loadUnifiedLearningEntry(): Promise<UnifiedLearningEntryState> {
  return withUnifiedLearningEntryReadDeadline(loadUnifiedLearningEntryData());
}

async function loadUnifiedLearningEntryData(): Promise<UnifiedLearningEntryState> {
  const [records, context] = await Promise.all([
    readUnifiedLearningEntryStage(
      '学习记录',
      persistenceRepository.listByStudent(UNIFIED_ENTRY_STUDENT_ID),
    ),
    readUnifiedLearningEntryStage(
      '学习活动',
      activityRepository.getByStudent(UNIFIED_ENTRY_STUDENT_ID),
    ),
  ]);
  const activeContext = context?.status !== 'ended' ? context : undefined;
  const activeLearningRoundId = activeContext?.targetedMicroTrainingOverlay?.mode === 'targeted'
    && activeContext.targetedMicroTrainingOverlay.activeAssignmentId
    ? `${activeContext.learningSessionId}-targeted-${activeContext.targetedMicroTrainingOverlay.activeAssignmentId}`
    : activeContext?.currentLearningRoundId;
  const [currentRecord, session, operationCheckpoint, delayedRetestPlans, taskAvailability] = await Promise.all([
    activeLearningRoundId
      ? readUnifiedLearningEntryStage(
          '当前学习进度',
          persistenceRepository.loadByRound(UNIFIED_ENTRY_STUDENT_ID, activeLearningRoundId),
        )
      : Promise.resolve(undefined),
    context
      ? readUnifiedLearningEntryStage(
          '学习会话',
          sessionRepository.getById(UNIFIED_ENTRY_STUDENT_ID, context.learningSessionId),
        )
      : Promise.resolve(null),
    activeLearningRoundId
      ? readUnifiedLearningEntryStage(
          '学习操作进度',
          operationRepository.getByOperationId(`phase16-3-live-operation-${activeLearningRoundId}`),
        )
      : Promise.resolve(undefined),
    readUnifiedLearningEntryStage('复测计划', loadPhase163DueRetestPlans()),
    readUnifiedLearningEntryStage('正式任务', resolveCurrentLearningTaskAvailability()),
  ]);
  const latestRecord = activeContext?.currentLearningRoundId
    ? currentRecord
    : records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const completedRoundCount = session?.completedRoundCount || 0;
  const groupCompleted = completedRoundCount >= MAX_ROUNDS;
  if (context) assertPhase163ProductRuntimeIdentity(context);
  if (latestRecord) {
    assertPhase163ProductRuntimeIdentity({
      studentId: latestRecord.studentId,
      learningRoundId: latestRecord.learningRoundId,
    });
  }
  if (operationCheckpoint) assertPhase163ProductRuntimeIdentity(operationCheckpoint);
  if (taskAvailability.state === 'read_failed') {
    throw new Error(taskAvailability.message);
  }

  return buildUnifiedLearningEntryState({
    studentId: UNIFIED_ENTRY_STUDENT_ID,
    now: new Date().toISOString(),
    activeContexts: context ? [context] : [],
    latestPersistenceRecord: latestRecord,
    delayedRetestPlans,
    operationCheckpoint: operationCheckpoint || undefined,
    hasAvailableTask: !groupCompleted && taskAvailability.available,
    taskAvailabilityState: groupCompleted ? 'already_used' : taskAvailability.state,
    taskAvailabilityMessage: groupCompleted
      ? '本轮学习已结束，暂时没有新的任务。'
      : taskAvailability.message,
    completedRoundCount,
  });
}

export function readUnifiedLearningEntryStage<T>(
  label: string,
  task: Promise<T>,
  timeoutMs = UNIFIED_LEARNING_ENTRY_STAGE_TIMEOUT_MS,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error(`学习入口“${label}”读取时限配置无效。`));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`学习入口暂时无法读取“${label}”，请重新尝试。`));
    }, timeoutMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function withUnifiedLearningEntryReadDeadline<T>(
  task: Promise<T>,
  timeoutMs = UNIFIED_LEARNING_ENTRY_READ_TIMEOUT_MS,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error('学习入口读取时限配置无效。'));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('学习状态读取超时，请重新尝试。'));
    }, timeoutMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function startOrResumeUnifiedLearning(): Promise<UnifiedLearningEntryState> {
  const existing = await activityRepository.getByStudent(UNIFIED_ENTRY_STUDENT_ID);
  const now = new Date().toISOString();
  const context = existing?.status !== 'ended'
    ? existing
    : createUnifiedLearningActivityContext({
        studentId: UNIFIED_ENTRY_STUDENT_ID,
        learningSessionId: createSessionId(now),
        currentLearningRoundId: `${createSessionId(now)}-round-1`,
        status: 'active',
        createdAt: now,
      });
  const nextContext = context || createUnifiedLearningActivityContext({
    studentId: UNIFIED_ENTRY_STUDENT_ID,
    learningSessionId: createSessionId(now),
    currentLearningRoundId: `${createSessionId(now)}-round-1`,
    status: 'active',
    createdAt: now,
  });
  const write = await activityRepository.save(nextContext);
  if (write.status === 'conflict') throw new Error('当前已有学习正在进行，请从已有进度继续。');
  const session = await sessionRepository.getById(UNIFIED_ENTRY_STUDENT_ID, nextContext.learningSessionId);
  if (!session) {
    await saveLearningSessionRecord(sessionRepository, createLearningSessionRecord({
      sessionId: nextContext.learningSessionId,
      studentId: UNIFIED_ENTRY_STUDENT_ID,
      startedAt: nextContext.createdAt,
      timezone: PHASE163_LEARNING_TIMEZONE,
    }));
  }
  return loadUnifiedLearningEntry();
}

export async function syncUnifiedLearningWorkspace(
  workspaceState: ContinuousLearningDemoState,
): Promise<void> {
  const existing = await activityRepository.getByStudent(UNIFIED_ENTRY_STUDENT_ID);
  if (!existing || existing.status === 'ended') return;
  const now = new Date().toISOString();
  const currentLearningRoundId = workspaceState.debug.currentRoundId;
  await activityRepository.save({
    ...existing,
    currentLearningRoundId,
    status: workspaceState.mode === 'error' ? 'blocked' : 'active',
    updatedAt: now,
  });
}

export async function endUnifiedLearningSession(): Promise<UnifiedLearningEntryState> {
  const existing = await activityRepository.getByStudent(UNIFIED_ENTRY_STUDENT_ID);
  if (existing) {
    const now = new Date().toISOString();
    const session = await sessionRepository.getById(UNIFIED_ENTRY_STUDENT_ID, existing.learningSessionId);
    if (session?.status === 'in_progress') {
      const canComplete = session.roundCount > 0 &&
        session.completedRoundCount === session.roundCount &&
        !session.unfinishedRoundId;
      await saveLearningSessionRecord(sessionRepository, closeLearningSessionRecord(session, {
        status: canComplete ? 'completed' : 'interrupted',
        endReason: canComplete ? 'student_finished' : 'student_stopped',
        endedAt: now,
      }));
    }
    await activityRepository.save({
      ...existing,
      status: 'ended',
      updatedAt: now,
    });
  }
  return loadUnifiedLearningEntry();
}

function createSessionId(now: string): string {
  return `learning-session-${now.replace(/[^0-9]/g, '')}`;
}

export type { UnifiedLearningActivityContext };
