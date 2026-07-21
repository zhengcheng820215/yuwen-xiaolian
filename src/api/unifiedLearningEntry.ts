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
import { loadPhase163DueRetestPlans } from './phase163LiveLearning.ts';
import {
  PHASE163_LEARNING_STUDENT_ID,
  PHASE163_LEARNING_TIMEZONE,
} from './phase163LearningIdentity.ts';

export const UNIFIED_ENTRY_STUDENT_ID = PHASE163_LEARNING_STUDENT_ID;

const MAX_ROUNDS = 3;
const persistenceRepository = new IndexedDBLearningPersistenceRepository();
const activityRepository = new LocalStorageUnifiedLearningEntryRepository();
const operationRepository = new IndexedDBRealLearningOperationRepository();
const sessionRepository = new IndexedDBLearningSessionRepository();

export async function loadUnifiedLearningEntry(): Promise<UnifiedLearningEntryState> {
  const records = await persistenceRepository.listByStudent(UNIFIED_ENTRY_STUDENT_ID);
  const context = await activityRepository.getByStudent(UNIFIED_ENTRY_STUDENT_ID);
  const activeContext = context?.status !== 'ended' ? context : undefined;
  const currentRecord = activeContext?.currentLearningRoundId
    ? await persistenceRepository.loadByRound(UNIFIED_ENTRY_STUDENT_ID, activeContext.currentLearningRoundId)
    : undefined;
  const latestRecord = activeContext?.currentLearningRoundId
    ? currentRecord
    : records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const session = context
    ? await sessionRepository.getById(UNIFIED_ENTRY_STUDENT_ID, context.learningSessionId)
    : null;
  const completedRoundCount = session?.completedRoundCount || 0;
  const operationCheckpoint = activeContext?.currentLearningRoundId
    ? await operationRepository.getByOperationId(`phase16-3-live-operation-${activeContext.currentLearningRoundId}`)
    : undefined;
  const delayedRetestPlans = await loadPhase163DueRetestPlans();

  return buildUnifiedLearningEntryState({
    studentId: UNIFIED_ENTRY_STUDENT_ID,
    now: new Date().toISOString(),
    activeContexts: context ? [context] : [],
    latestPersistenceRecord: latestRecord,
    delayedRetestPlans,
    operationCheckpoint: operationCheckpoint || undefined,
    hasAvailableTask: !context || context.status === 'ended' || completedRoundCount < MAX_ROUNDS,
    completedRoundCount,
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
