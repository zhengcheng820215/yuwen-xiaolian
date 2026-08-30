import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Card from '../components/Card.jsx';
import KnowledgeAnswerFeedback from '../components/knowledge-practice/KnowledgeAnswerFeedback.jsx';
import KnowledgeAnswerInput from '../components/knowledge-practice/KnowledgeAnswerInput.jsx';
import KnowledgeQuestionCard, { knowledgeQuestionTypeName } from '../components/knowledge-practice/KnowledgeQuestionCard.jsx';
import KnowledgeQuizActions from '../components/knowledge-practice/KnowledgeQuizActions.jsx';
import { usePracticeSession } from '../context/PracticeSessionContext.jsx';
import { knowledgeQuestionRepository } from '../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import { hasPotentialPracticeAnswer } from '../domain/knowledge-practice/response/validateSubmittedAnswer.ts';

function sessionMatchesRoute(session, decoded) {
  if (!session || session.status !== 'active') return false;
  if (decoded === 'all') return session.mode === 'mixed';
  if (decoded === 'retry') return session.mode === 'mistake_review';
  return session.mode === 'category' && session.category === decoded;
}
export default function Quiz() {
  const { category } = useParams();
  const navigate = useNavigate();
  const {
    activeAttempt,
    activeSession,
    lastBuildError,
    lastSubmitError,
    startPractice,
    submitCurrentAnswer,
    advanceSession,
    hydrationStatus,
    persistenceNotice,
    persistenceStatus,
    reloadPersistedState,
    recoveryError,
  } = usePracticeSession();
  const decoded = decodeURIComponent(category || 'all');
  const initializedRoute = useRef('');
  const submittingRef = useRef(false);
  const feedbackRef = useRef(null);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hydrationStatus === 'loading') return;
    if (sessionMatchesRoute(activeSession, decoded)) {
      initializedRoute.current = decoded;
      return;
    }
    if (initializedRoute.current === decoded) return;
    initializedRoute.current = decoded;
    if (activeSession?.status === 'active') return;
    if (decoded === 'retry') return;
    startPractice(decoded === 'all'
      ? { mode: 'mixed', targetCount: 10 }
      : { mode: 'category', category: decoded, targetCount: 5 });
  }, [activeSession, decoded, hydrationStatus, startPractice]);

  const session = sessionMatchesRoute(activeSession, decoded) ? activeSession : null;
  const currentItem = session?.queue[session.currentIndex];
  const current = currentItem ? knowledgeQuestionRepository.getApprovedById(currentItem.questionId) : null;
  const currentResponse = currentItem
    ? activeAttempt?.responses.find((response) => response.queueItemId === currentItem.id)
    : null;
  const currentFeedback = currentResponse
    ? activeAttempt?.feedbackByResponseId[currentResponse.id]
    : null;
  const baseAnsweredCount = activeAttempt?.responses.filter((response) => response.role === 'base').length || 0;
  const pendingReinforcementCount = session?.queue.filter((item) => item.role === 'reinforcement' && item.status === 'pending').length || 0;
  const reinforcementScheduledFromCurrent = Boolean(
    currentItem?.role === 'base' && currentResponse && !currentResponse.isCorrect
    && session?.queue.some((item) => item.role === 'reinforcement' && item.sourceQuestionId === currentItem.questionId),
  );

  useEffect(() => {
    setDraftAnswer('');
    setIsSubmitting(false);
    submittingRef.current = false;
  }, [currentItem?.id]);

  useEffect(() => {
    if (currentFeedback) feedbackRef.current?.focus();
  }, [currentFeedback]);

  if (recoveryError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5">
        <Card className="w-full text-center">
          <p className="font-semibold text-slate-900">这组练习暂时无法继续</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{recoveryError.studentMessage}</p>
          <button onClick={() => navigate('/learning/knowledge')} className="mt-4 min-h-11 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white">返回基础知识巩固</button>
        </Card>
      </div>
    );
  }

  if (!session || !activeAttempt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5">
        <Card className="w-full text-center">
          <p className="font-semibold text-slate-900">{lastBuildError || activeSession || decoded === 'retry' ? '无法打开这组练习' : '正在准备本组题目'}</p>
          <p className="mt-2 text-sm text-slate-500">{lastBuildError?.studentMessage || (activeSession ? '另一组练习正在进行，请从知识练习入口继续。' : decoded === 'retry' ? '请从最近一次结果页发起本轮错题重做。' : '请稍候。')}</p>
          {lastBuildError || activeSession || decoded === 'retry' ? <button onClick={() => navigate('/learning/knowledge')} className="mt-4 min-h-11 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white">返回基础知识巩固</button> : null}
        </Card>
      </div>
    );
  }

  if (!current || !currentItem) {
    return <div className="p-5 text-sm text-red-600">当前题目无法读取，请返回知识练习重新开始。</div>;
  }

  const submit = () => {
    if (!draftAnswer.trim() || submittingRef.current || currentResponse) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const submittedAt = new Date().toISOString();
    const presentedAt = Date.parse(activeAttempt.currentQuestionPresentedAt);
    const durationMs = Math.max(0, Date.parse(submittedAt) - presentedAt);
    const result = submitCurrentAnswer({ question: current, value: draftAnswer, submittedAt, durationMs });
    submittingRef.current = false;
    setIsSubmitting(false);
  };

  const next = () => {
    if (!currentResponse) return;
    if (session.currentIndex < session.queue.length - 1) {
      advanceSession();
      return;
    }
    advanceSession();
    navigate('/learning/knowledge/result');
  };

  const answerValue = currentResponse?.submittedAnswer || draftAnswer;
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fb]">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#f5f7fb]/95 px-5 py-4 backdrop-blur">
        <button onClick={() => navigate('/learning/knowledge')} aria-label="返回基础知识巩固" className="flex h-10 w-10 items-center justify-center rounded-md bg-white shadow-sm">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1">
          <p className="text-sm text-slate-500">
            基础题 {Math.min(baseAnsweredCount + (currentItem?.role === 'base' && !currentResponse ? 1 : 0), session.actualBaseQuestionCount)} / {session.actualBaseQuestionCount}
            {pendingReinforcementCount > 0 ? ` · 另有 ${pendingReinforcementCount} 道巩固题待完成` : ''}
          </p>
          <h1 className="text-lg font-semibold text-slate-900">{knowledgeQuestionTypeName(current.type)}</h1>
        </div>
      </header>

      <main className="flex-1 px-5 pb-8">
        {persistenceNotice ? (
          <div role="status" className="mb-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>{persistenceNotice}</p>
            {persistenceStatus === 'conflict' ? <button onClick={reloadPersistedState} className="mt-2 min-h-10 rounded-md bg-white px-3 font-semibold text-amber-900">重新载入最新进度</button> : null}
          </div>
        ) : null}
        <KnowledgeQuestionCard question={current} role={currentItem.role} />
        <div className="mt-4 space-y-3">
          <KnowledgeAnswerInput
            question={current}
            value={answerValue}
            onChange={setDraftAnswer}
            locked={Boolean(currentResponse)}
          />
        </div>
        {lastSubmitError && !currentResponse ? (
          <p role="alert" className="mt-3 text-sm text-red-600">{lastSubmitError.studentMessage}</p>
        ) : null}
        {currentFeedback ? <KnowledgeAnswerFeedback ref={feedbackRef} feedback={currentFeedback} /> : null}
        {reinforcementScheduledFromCurrent ? (
          <p role="status" className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            已安排 1 道相关巩固题，将在稍后出现。
          </p>
        ) : null}
      </main>

      <KnowledgeQuizActions
        answered={Boolean(currentResponse)}
        canSubmit={hasPotentialPracticeAnswer(current, draftAnswer)}
        isSubmitting={isSubmitting}
        isLast={session.currentIndex === session.queue.length - 1}
        onSubmit={submit}
        onNext={next}
      />
    </div>
  );
}
