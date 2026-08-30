import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildPracticeSession } from '../domain/knowledge-practice/practice/buildPracticeSession.ts';
import { buildCompletedSessionSummary, buildPracticeCompletionRecord } from '../domain/knowledge-practice/persistence/buildPracticeCompletionRecord.ts';
import { createEmptyPracticeStore } from '../domain/knowledge-practice/persistence/localPracticeStoreTypes.ts';
import { buildPersistedKnowledgeMistake, upsertPersistedMistake } from '../domain/knowledge-practice/persistence/persistedKnowledgeMistake.ts';
import { knowledgeQuestionRepository } from '../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import { listApprovedReinforcementLinks } from '../domain/knowledge-practice/reinforcement/reinforcementLinks.ts';
import { abandonPracticeAttempt, advancePracticeAttempt } from '../domain/knowledge-practice/response/practiceAttemptState.ts';
import { createPracticeAttempt } from '../domain/knowledge-practice/response/submitPracticeAnswer.ts';
import { submitPracticeAnswerWithReinforcement } from '../domain/knowledge-practice/response/submitPracticeAnswerWithReinforcement.ts';
import { createBrowserPracticeRepository, PRACTICE_STORE_PRIMARY_KEY } from '../repositories/knowledge-practice/localStoragePracticeRepository.ts';

const PracticeSessionContext = createContext(null);

function makeWriterId() {
  try { return crypto.randomUUID(); } catch { return `writer-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function noticeFor(status, issues) {
  if (['saved', 'reused', 'loaded', 'empty'].includes(status)) return null;
  if (status === 'recovered_from_backup') return '已从本地备份恢复上次练习。';
  if (status === 'migrated') return '旧版练习记录已完成升级。';
  if (status === 'damaged') return '本地练习记录损坏，已安全隔离并从空状态继续。';
  if (status === 'future_version') return '检测到较新版本记录，当前页面不会覆盖它。';
  if (status === 'conflict') return '练习已在另一个页面更新，请重新载入最新进度。';
  return issues?.[0]?.message || '本次进度暂未保存，但可以继续当前练习。';
}

export function PracticeSessionProvider({ children }) {
  const writerIdRef = useRef(makeWriterId());
  const repositoryRef = useRef(createBrowserPracticeRepository(writerIdRef.current));
  const initialNowRef = useRef(new Date().toISOString());
  const [store, setStore] = useState(() => createEmptyPracticeStore(initialNowRef.current, writerIdRef.current));
  const storeRef = useRef(store);
  const [hydrationStatus, setHydrationStatus] = useState('loading');
  const [persistenceStatus, setPersistenceStatus] = useState('idle');
  const [persistenceNotice, setPersistenceNotice] = useState(null);
  const [lastBuildError, setLastBuildError] = useState(null);
  const [lastSubmitError, setLastSubmitError] = useState(null);
  const hydratedRef = useRef(false);

  const commitStore = useCallback((next) => {
    storeRef.current = next;
    setStore(next);
  }, []);

  const consumeWrite = useCallback((result, fallbackStore) => {
    commitStore(result.status === 'conflict' ? (fallbackStore || storeRef.current) : result.store);
    setPersistenceStatus(result.status);
    setPersistenceNotice(noticeFor(result.status, result.issues));
    return result;
  }, [commitStore]);

  const hydrate = useCallback(() => {
    const now = new Date().toISOString();
    const result = repositoryRef.current.load(now);
    let next = result.store;
    const item = next.activeAttempt?.session.queue[next.activeAttempt.session.currentIndex];
    if (next.activeAttempt && item?.status === 'pending') {
      const resumed = { ...next.activeAttempt, currentQuestionPresentedAt: now, updatedAt: now };
      const saved = repositoryRef.current.saveActiveAttempt({ store: next, expectedRevision: next.revision, now, attempt: resumed });
      if (saved.status !== 'conflict') next = saved.store;
    }
    commitStore(next);
    setHydrationStatus(result.status === 'future_version' ? 'read_only' : 'ready');
    setPersistenceStatus(result.status);
    setPersistenceNotice(noticeFor(result.status, result.issues));
  }, [commitStore]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== PRACTICE_STORE_PRIMARY_KEY || !event.newValue) return;
      try {
        const incoming = JSON.parse(event.newValue);
        if (incoming.writerId !== writerIdRef.current && incoming.revision > storeRef.current.revision) {
          setPersistenceStatus('conflict');
          setPersistenceNotice('练习已在另一个页面更新，请重新载入最新进度。');
        }
      } catch { /* repository performs recovery on reload */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const startPractice = useCallback((input) => {
    const currentStore = storeRef.current;
    if (hydrationStatus === 'loading') return { ok: false, error: { code: 'hydration_pending', studentMessage: '正在恢复本地进度，请稍候。' } };
    if (hydrationStatus === 'read_only') return { ok: false, error: { code: 'future_store_read_only', studentMessage: '检测到较新版本练习记录，当前版本不会覆盖它。' } };
    if (currentStore.activeAttempt?.session.status === 'active') return { ok: false, error: { code: 'active_attempt_conflict', studentMessage: '已有一组练习进行中，请先继续或确认放弃。' } };
    const result = buildPracticeSession({ ...input, recentCompletedSessions: currentStore.completedSessions });
    if (!result.ok) { setLastBuildError(result.error); return result; }
    const attempt = createPracticeAttempt(result.session);
    const fallback = { ...currentStore, activeAttempt: attempt, updatedAt: result.session.startedAt };
    const write = repositoryRef.current.saveActiveAttempt({ store: currentStore, expectedRevision: currentStore.revision, now: result.session.startedAt, attempt });
    consumeWrite(write, fallback);
    setLastBuildError(null);
    setLastSubmitError(null);
    return { ...result, persistenceStatus: write.status };
  }, [consumeWrite, hydrationStatus]);

  const submitCurrentAnswer = useCallback(({ question, value, submittedAt = new Date().toISOString(), durationMs }) => {
    const currentStore = storeRef.current;
    const current = currentStore.activeAttempt;
    if (!current) return null;
    const currentItem = current.session.queue[current.session.currentIndex];
    const result = submitPracticeAnswerWithReinforcement({
      attempt: current,
      queueItemId: currentItem?.id || '',
      question,
      answer: { value, submittedAt, durationMs },
      approvedQuestions: knowledgeQuestionRepository.listApproved(),
      approvedLinks: listApprovedReinforcementLinks(),
    });
    if (!result.ok) { setLastSubmitError(result.error); return result; }
    setLastSubmitError(null);
    const mistakes = result.outcome === 'created' && result.response.role === 'base' && !result.response.isCorrect
      ? upsertPersistedMistake(currentStore.mistakes, buildPersistedKnowledgeMistake(question, result.response))
      : currentStore.mistakes;
    const fallback = { ...currentStore, activeAttempt: result.attempt, mistakes, updatedAt: submittedAt };
    const write = repositoryRef.current.saveActiveAttempt({ store: currentStore, expectedRevision: currentStore.revision, now: submittedAt, attempt: result.attempt, mistakes });
    consumeWrite(write, fallback);
    return { ...result, persistenceStatus: write.status };
  }, [consumeWrite]);

  const advanceSession = useCallback((now = new Date().toISOString()) => {
    const currentStore = storeRef.current;
    if (!currentStore.activeAttempt) return null;
    const next = advancePracticeAttempt(currentStore.activeAttempt, now);
    let write;
    let fallback;
    if (next.session.status === 'completed') {
      const completion = buildPracticeCompletionRecord(next);
      const summary = buildCompletedSessionSummary(next);
      fallback = { ...currentStore, activeAttempt: null, lastCompletion: completion, completedSessions: [summary, ...currentStore.completedSessions.filter((item) => item.sessionId !== summary.sessionId)].slice(0, 10), updatedAt: now };
      write = repositoryRef.current.completeAttempt({ store: currentStore, expectedRevision: currentStore.revision, now, attempt: next });
    } else {
      fallback = { ...currentStore, activeAttempt: next, updatedAt: now };
      write = repositoryRef.current.saveActiveAttempt({ store: currentStore, expectedRevision: currentStore.revision, now, attempt: next });
    }
    consumeWrite(write, fallback);
    setLastSubmitError(null);
    return { attempt: next, persistenceStatus: write.status };
  }, [consumeWrite]);

  const abandonSession = useCallback((now = new Date().toISOString()) => {
    const currentStore = storeRef.current;
    if (!currentStore.activeAttempt) return { ok: true, persistenceStatus: 'reused' };
    const abandoned = abandonPracticeAttempt(currentStore.activeAttempt, now);
    const fallback = { ...currentStore, activeAttempt: null, lastAbandonedSessionId: abandoned.session.id, updatedAt: now };
    const write = repositoryRef.current.abandonAttempt({ store: currentStore, expectedRevision: currentStore.revision, now, attempt: abandoned });
    consumeWrite(write, fallback);
    return { ok: write.status === 'saved' || write.status === 'reused', persistenceStatus: write.status };
  }, [consumeWrite]);

  const abandonAndStart = useCallback((input) => {
    const abandoned = abandonSession();
    if (!abandoned.ok) return { ok: false, error: { code: 'abandon_save_failed', studentMessage: '旧练习尚未安全保存为已放弃，请稍后重试。' } };
    return startPractice(input);
  }, [abandonSession, startPractice]);

  const resolveMistake = useCallback((questionId) => {
    const currentStore = storeRef.current;
    const now = new Date().toISOString();
    const mistakes = currentStore.mistakes.map((item) => item.questionId === questionId ? { ...item, status: 'resolved' } : item);
    const fallback = { ...currentStore, mistakes, updatedAt: now };
    const write = repositoryRef.current.resolveMistake({ store: currentStore, expectedRevision: currentStore.revision, now, questionId });
    consumeWrite(write, fallback);
    return write;
  }, [consumeWrite]);

  const startResultRecommendation = useCallback((recommendation) => {
    const current = storeRef.current.activeAttempt?.session;
    if (current?.status === 'active') {
      const path = current.mode === 'mixed'
        ? '/learning/knowledge/quiz/all'
        : current.mode === 'mistake_review'
          ? '/learning/knowledge/quiz/retry'
          : `/learning/knowledge/quiz/${encodeURIComponent(current.category)}`;
      return { ok: true, outcome: 'continue_active', path };
    }
    if (recommendation.type === 'return_to_learning') return { ok: true, outcome: 'navigate', path: '/learning' };
    const input = recommendation.type === 'start_mixed_practice'
      ? { mode: 'mixed', targetCount: 10 }
      : recommendation.type === 'start_category_practice'
        ? { mode: 'category', category: recommendation.category, targetCount: recommendation.targetCount || 5 }
        : { mode: 'mistake_review', questionIds: recommendation.sourceQuestionIds || [], targetCount: recommendation.targetCount };
    const result = startPractice(input);
    return result.ok ? { ...result, outcome: 'created', path: recommendation.targetPath } : result;
  }, [startPractice]);

  const activeAttempt = store.activeAttempt;
  const activeSession = activeAttempt?.session || null;
  const currentItem = activeSession?.queue[activeSession.currentIndex];
  const currentQuestion = currentItem ? knowledgeQuestionRepository.getApprovedById(currentItem.questionId) : null;
  const recoveryError = currentItem?.status === 'pending' && (!currentQuestion || currentQuestion.contentVersion !== currentItem.questionContentVersion)
    ? { code: 'unrecoverable_question_version', studentMessage: '本组未答题内容已经更新，已有答案已保留，请放弃后重新开始。' }
    : null;

  const value = useMemo(() => ({
    activeAttempt,
    activeSession,
    completedSessions: store.completedSessions,
    lastCompletion: store.lastCompletion,
    lastResult: store.lastCompletion?.schemaVersion === 2 ? store.lastCompletion.result : null,
    mistakes: store.mistakes,
    activeMistakes: store.mistakes.filter((item) => item.status === 'active'),
    hydrationStatus,
    persistenceStatus,
    persistenceNotice,
    recoveryError,
    lastBuildError,
    lastSubmitError,
    startPractice,
    submitCurrentAnswer,
    advanceSession,
    abandonSession,
    abandonAndStart,
    resolveMistake,
    startResultRecommendation,
    reloadPersistedState: hydrate,
  }), [activeAttempt, activeSession, store, hydrationStatus, persistenceStatus, persistenceNotice, recoveryError, lastBuildError, lastSubmitError, startPractice, submitCurrentAnswer, advanceSession, abandonSession, abandonAndStart, resolveMistake, startResultRecommendation, hydrate]);

  return <PracticeSessionContext.Provider value={value}>{children}</PracticeSessionContext.Provider>;
}

export function usePracticeSession() {
  const value = useContext(PracticeSessionContext);
  if (!value) throw new Error('usePracticeSession must be used inside PracticeSessionProvider.');
  return value;
}
