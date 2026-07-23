import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, Pencil, RefreshCw, Save, ThumbsUp } from 'lucide-react';
import {
  advancePhase163LiveRound,
  loadPhase163LiveWorkspace,
  savePhase163LiveDraft,
  submitPhase163LiveAnswer,
} from '../api/phase163LiveLearning.ts';
import {
  getPhase163DiagnosisBoundaryStatus,
  isPhase163DiagnosisBoundaryUnavailable,
} from '../api/phase163DiagnosisBoundary.ts';
import { requestStudentWritingCorrections } from '../api/studentWritingCorrections.ts';
import WorkspaceToast from '../components/continuous-learning/WorkspaceToast.jsx';
import {
  shouldRenderThinkingReview,
  shouldStageFeedbackPresentation,
  synchronizeFeedbackPresentationStep,
} from '../ui/feedbackPresentationPolicy.ts';

const RUNTIME_UNAVAILABLE_MESSAGE = '分析服务尚未就绪。你可以继续编辑或保存回答，服务准备好后再提交。';
const FEEDBACK_PRESENTATION_KEY_PREFIX = 'qingzhou:feedback-presentation:';

export default function Phase163LiveLearningWorkspace({ onReturnToEntry, autoRetryResource = false }) {
  const [state, setState] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(true);
  const [toast, setToast] = useState(null);
  const [analysisRetry, setAnalysisRetry] = useState(false);
  const [runtimeAvailability, setRuntimeAvailability] = useState('checking');
  const [writingCorrections, setWritingCorrections] = useState([]);
  const [writingCorrectionStatus, setWritingCorrectionStatus] = useState('idle');
  const answerInputRef = useRef(null);
  const saveRequest = useRef(0);
  const toastSequence = useRef(0);
  const autoResourceRetryStarted = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadPhase163LiveWorkspace(),
      getPhase163DiagnosisBoundaryStatus(),
    ])
      .then(([next, runtime]) => {
        if (!active) return;
        applyState(next);
        setRuntimeAvailability(runtime.status);
        if (runtime.status === 'unavailable' && (next.status === 'ready' || next.status === 'retry_required')) {
          showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
        }
      })
      .catch((error) => active && showMessage(toMessage(error), 'error'))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!autoRetryResource || autoResourceRetryStarted.current || busy || state?.primaryAction !== 'retry_resource') return;
    autoResourceRetryStarted.current = true;
    void resumeProcessing();
  }, [autoRetryResource, busy, state?.primaryAction]);

  useEffect(() => {
    if (!state?.feedback || !answer.trim()) {
      setWritingCorrections([]);
      setWritingCorrectionStatus('idle');
      return undefined;
    }
    let active = true;
    setWritingCorrections([]);
    setWritingCorrectionStatus('loading');
    requestStudentWritingCorrections({
      requestId: `writing-correction-${state.roundId}-${answerFingerprint(answer)}`,
      answerText: answer,
      readingText: state.task.readingText,
      questionText: state.task.questionText,
    })
      .then((suggestions) => {
        if (!active) return;
        setWritingCorrections(suggestions);
        setWritingCorrectionStatus('resolved');
      })
      .catch(() => {
        if (!active) return;
        setWritingCorrections([]);
        setWritingCorrectionStatus('resolved');
      });
    return () => { active = false; };
  }, [state?.feedback, state?.roundId, answer, state?.task.readingText, state?.task.questionText]);

  useEffect(() => {
    const input = answerInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(Math.max(input.scrollHeight, 240), 400);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > 400 ? 'auto' : 'hidden';
  }, [answer, state?.roundId]);

  function applyState(next) {
    setState(next);
    setAnswer(next.answerDraft || '');
    setToast(null);
    setAnalysisRetry(false);
  }

  function showMessage(value, tone = 'operation') {
    if (!value) {
      setToast(null);
      return;
    }
    const duration = tone === 'error' ? 6000 : tone === 'success' ? 2000 : 3000;
    setToast({ id: ++toastSequence.current, message: value, tone, duration });
  }

  async function saveDraft() {
    if (!answer.trim() || busy) {
      showMessage('当前没有可保存的内容。');
      return;
    }
    const requestId = ++saveRequest.current;
    setBusy(true);
    try {
      await savePhase163LiveDraft(answer);
      if (requestId === saveRequest.current) showMessage('草稿已保存。', 'success');
    } catch (error) {
      if (requestId === saveRequest.current) showMessage(toMessage(error), 'error');
    } finally {
      if (requestId === saveRequest.current) setBusy(false);
    }
  }

  async function submitAnswer() {
    if (busy) return;
    if (!answer.trim()) {
      showMessage('请先输入回答再提交。');
      return;
    }
    if (runtimeAvailability !== 'ready') {
      showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      return;
    }
    saveRequest.current += 1;
    setBusy(true);
    setAnalysisRetry(false);
    showMessage('正在分析本次回答，请稍候。');
    try {
      const nextState = await submitPhase163LiveAnswer(answer);
      applyState(nextState);
      if (
        nextState.status === 'retry_required' &&
        nextState.primaryAction === 'submit_answer' &&
        nextState.studentMessage
      ) {
        showMessage(nextState.studentMessage);
      }
    } catch (error) {
      if (isPhase163DiagnosisBoundaryUnavailable(error)) {
        setRuntimeAvailability('unavailable');
        setAnalysisRetry(false);
        showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      } else {
        setAnalysisRetry(true);
        showMessage(toMessage(error), 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function resumeProcessing() {
    if (busy || !answer.trim()) return;
    const resourceOnlyRetry = state?.primaryAction === 'retry_resource';
    if (!resourceOnlyRetry && runtimeAvailability !== 'ready') {
      showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      return;
    }
    setBusy(true);
    showMessage(resourceOnlyRetry ? '正在检查符合要求的下一任务。' : '正在恢复已经提交的结果，请稍候。');
    try {
      applyState(await submitPhase163LiveAnswer(answer));
    } catch (error) {
      if (isPhase163DiagnosisBoundaryUnavailable(error)) {
        setRuntimeAvailability('unavailable');
        showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      } else {
        showMessage(toMessage(error), 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function enterNextRound() {
    if (!state?.canAdvance || busy) return;
    setBusy(true);
    try {
      await advancePhase163LiveRound();
      applyState(await loadPhase163LiveWorkspace());
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!state && busy) return <LoadingWorkspace />;
  if (!state) return <WorkspaceFailure message={toast?.message} onBack={onReturnToEntry} />;

  const completed = state.status === 'completed';
  const paused = state.status === 'blocked' || state.status === 'review_required';
  const recovering = state.status === 'retry_required' && state.primaryAction === 'resume_processing';
  return (
    <div className={`min-h-screen text-slate-950 ${completed || paused || recovering ? 'bg-[#f7f9fc]' : 'learning-workspace-split-background bg-[#f7f9fc]'}`}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-5 md:px-8">
          <button
            type="button"
            onClick={onReturnToEntry}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="返回学习入口"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {state.isRetest ? <span className="font-medium text-blue-700">延迟复测</span> : null}
            <span>第 {state.roundNumber} 轮</span>
          </div>
        </div>
      </header>

      {completed ? (
        <CompletedFeedback state={state} writingCorrections={writingCorrections} writingCorrectionStatus={writingCorrectionStatus} busy={busy} onContinue={enterNextRound} onReturn={onReturnToEntry} />
      ) : paused ? (
        <PausedWorkspace state={state} writingCorrections={writingCorrections} busy={busy} onReturn={onReturnToEntry} />
      ) : recovering ? (
        <RecoveringWorkspace
          state={state}
          busy={busy}
          runtimeAvailability={runtimeAvailability}
          onResume={resumeProcessing}
          onReturn={onReturnToEntry}
        />
      ) : (
        <main className="mx-auto grid min-h-[calc(100vh-65px)] w-full max-w-[1400px] lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className="border-b border-slate-200 bg-[#f7f9fc] px-6 py-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10 xl:px-14">
            <div className="mx-auto max-w-[640px]">
              <h1 className="flex items-center gap-3 text-lg font-semibold">
                <BookOpen size={20} className="text-slate-500" />
                阅读材料
              </h1>
              <div className="mt-6 border-t border-slate-200 pt-7 text-base leading-8 text-slate-800">
                {state.task.readingText || '本题不需要额外阅读材料。'}
              </div>
            </div>
          </section>

          <section className="px-6 py-8 lg:px-10 lg:py-10 xl:px-14">
            <div className="mx-auto max-w-[640px]">
              <p className="text-sm text-slate-500">本题考查：{state.task.focus}</p>
              {state.learningPresentation?.taskReason ? (
                <div className="mt-5 border-l-2 border-blue-500 pl-4">
                  <p className="text-sm font-semibold text-slate-800">为什么练这题</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{state.learningPresentation.taskReason}</p>
                </div>
              ) : null}
              <h1 className="mt-7 text-lg font-semibold">题目</h1>
              <p className="mt-3 text-base leading-8 text-slate-800">{state.task.questionText}</p>

              <textarea
                ref={answerInputRef}
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (toast) showMessage('');
                }}
                disabled={busy || analysisRetry}
                aria-label="输入你的回答"
                placeholder="请在这里输入你的回答。"
                className="mt-7 min-h-[240px] max-h-[400px] w-full resize-none rounded-md border border-slate-300 bg-[#f8fafc] px-4 py-4 text-base leading-7 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-70"
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={analysisRetry ? () => {
                    setAnalysisRetry(false);
                    showMessage('可以修改回答，完成后重新提交。');
                  } : saveDraft}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  {analysisRetry ? <Pencil size={16} /> : <Save size={16} />}
                  {analysisRetry ? '返回修改' : '保存草稿'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={submitAnswer}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {busy || analysisRetry || runtimeAvailability === 'checking' ? <RefreshCw size={16} className={busy || runtimeAvailability === 'checking' ? 'animate-spin' : ''} /> : <ArrowRight size={16} />}
                  {analysisRetry ? '重新分析' : '提交本轮回答'}
                </button>
              </div>
            </div>
          </section>
        </main>
      )}
      {toast ? (
        <WorkspaceToast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          duration={toast.duration}
          onDismiss={() => setToast((current) => current?.id === toast.id ? null : current)}
        />
      ) : null}
    </div>
  );
}

function CompletedFeedback({ state, writingCorrections, writingCorrectionStatus, busy, onContinue, onReturn }) {
  const positive = state.feedback?.whatYouDidWell?.slice(0, 1) || [];
  const thinkingReview = state.feedback?.thinkingReview;
  const guidance = state.feedback?.guidance;
  const attention = guidance ? [] : state.feedback?.whatNeedsAttention?.slice(0, 1) || [];
  const hasLearningNarrative = hasOutcomeNarrative(state.learningPresentation);
  const hasReview = Boolean(thinkingReview || positive.length);
  const shouldStageFeedback = shouldStageFeedbackPresentation({
    correctionStatus: writingCorrectionStatus,
    correctionCount: writingCorrections.length,
    hasReview,
    hasGuidance: Boolean(guidance),
    prefersReducedMotion: prefersReducedMotion(),
    hasPresented: hasPresentedFeedback(state.roundId),
  });
  const [presentationStep, setPresentationStep] = useState(() => shouldStageFeedback ? 0 : 3);

  const revealAll = () => {
    setPresentationStep(3);
    markFeedbackPresented(state.roundId);
  };

  useEffect(() => {
    if (!shouldStageFeedback) {
      setPresentationStep((step) => synchronizeFeedbackPresentationStep(step, false));
      return undefined;
    }
    const reviewTimer = window.setTimeout(() => setPresentationStep((step) => Math.max(step, 1)), 180);
    const guidanceTimer = window.setTimeout(() => setPresentationStep((step) => Math.max(step, 2)), 520);
    const actionTimer = window.setTimeout(() => {
      setPresentationStep(3);
      markFeedbackPresented(state.roundId);
    }, 1050);
    const revealFromKeyboard = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      revealAll();
    };
    window.addEventListener('keydown', revealFromKeyboard);
    return () => {
      window.clearTimeout(reviewTimer);
      window.clearTimeout(guidanceTimer);
      window.clearTimeout(actionTimer);
      window.removeEventListener('keydown', revealFromKeyboard);
    };
  }, [shouldStageFeedback, state.roundId]);

  const handleRevealClick = () => {
    if (presentationStep >= 3 || window.getSelection()?.toString()) return;
    revealAll();
  };

  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center px-6 py-12" onClick={handleRevealClick}>
      <div className="mx-auto w-full max-w-[720px]">
        <section className="rounded-md bg-white px-7 py-[60px] shadow-[0_10px_36px_rgba(15,23,42,0.08)] [&>section:first-child]:mt-0 md:px-10">
          {writingCorrections.length ? <WritingCorrections items={writingCorrections} /> : null}
          {hasLearningNarrative ? (
            <StudentLearningNarrativeOutcome
              presentation={state.learningPresentation}
              reviewVisible={presentationStep >= 1}
              actionVisible={presentationStep >= 2}
            />
          ) : (
            <>
              {thinkingReview ? <ThinkingReview review={thinkingReview} contentVisible={presentationStep >= 1} /> : positive.length ? <FeedbackList title="已经完成的思考" items={positive} tone="positive" contentVisible={presentationStep >= 1} /> : null}
              <div className={feedbackRevealClass(presentationStep >= 2)}>
                {guidance ? <StudentFeedbackGuidance guidance={guidance} compact={Boolean(thinkingReview)} /> : null}
              </div>
              {attention.length ? <FeedbackList title="需要留意" items={attention} tone="attention" /> : null}
            </>
          )}
          {state.learningPresentation?.outcome?.progressMeaning ? (
            <NarrativeNote title="这次学习说明了什么" text={state.learningPresentation.outcome.progressMeaning} />
          ) : null}
          {state.canAdvance && state.learningPresentation?.continuationReason ? (
            <NarrativeNote title="为什么继续下一项任务" text={state.learningPresentation.continuationReason} />
          ) : null}
        </section>
        <div className={`mt-8 flex min-h-11 justify-center ${feedbackRevealClass(presentationStep >= 3)}`}>
          {state.canAdvance ? (
            <button
              type="button"
              disabled={busy}
              onClick={onContinue}
              className="flex min-h-11 min-w-52 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              进入下一轮任务
            </button>
          ) : (
            <button type="button" onClick={onReturn} className="min-h-11 rounded-md bg-slate-900 px-5 text-sm text-white hover:bg-slate-800">
              返回学习入口
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function PausedWorkspace({ state, writingCorrections, busy, onReturn }) {
  const positive = state.feedback?.whatYouDidWell?.slice(0, 1) || [];
  const thinkingReview = state.feedback?.thinkingReview;
  const guidance = state.feedback?.guidance;
  const attention = guidance ? [] : state.feedback?.whatNeedsAttention?.slice(0, 1) || [];
  const hasLearningNarrative = hasOutcomeNarrative(state.learningPresentation);
  const showPauseMessage = !state.feedback || !['resource_unavailable', 'next_task_review'].includes(state.pauseReason);
  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center px-6 py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <section className="rounded-md bg-white px-7 py-7 shadow-[0_10px_36px_rgba(15,23,42,0.08)] [&>section:first-child]:mt-0 md:px-10">
          {state.feedback ? (
            <>
              {writingCorrections.length ? <WritingCorrections items={writingCorrections} /> : null}
              {hasLearningNarrative ? (
                <StudentLearningNarrativeOutcome presentation={state.learningPresentation} />
              ) : (
                <>
                  {thinkingReview ? <ThinkingReview review={thinkingReview} /> : positive.length ? <FeedbackList title="已经完成的思考" items={positive} tone="positive" /> : null}
                  {guidance ? <StudentFeedbackGuidance guidance={guidance} compact={Boolean(thinkingReview)} /> : null}
                  {attention.length ? <FeedbackList title="需要留意" items={attention} tone="attention" /> : null}
                </>
              )}
            </>
          ) : null}
          {showPauseMessage ? (
            <div className={state.feedback ? 'mt-9 border-t border-slate-200 pt-7' : ''} aria-live="polite">
              <h2 className="text-base font-semibold">{state.studentTitle || '暂时无法继续'}</h2>
              <p className="mt-2 text-base leading-7 text-slate-600">{state.studentMessage}</p>
            </div>
          ) : null}
        </section>
        <div className="mt-8 flex justify-center">
          <button type="button" disabled={busy} onClick={onReturn} className="min-h-11 rounded-md bg-slate-900 px-5 text-sm text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">返回学习入口</button>
        </div>
      </div>
    </main>
  );
}

function RecoveringWorkspace({ state, busy, runtimeAvailability, onResume, onReturn }) {
  const unavailable = runtimeAvailability === 'unavailable';
  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[720px] flex-col justify-center px-6 py-12">
      <RefreshCw size={24} className={busy ? 'animate-spin text-blue-600' : 'text-slate-500'} />
      <h1 className="mt-4 text-lg font-semibold">{unavailable ? '分析服务尚未就绪' : '恢复本次提交'}</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{unavailable ? RUNTIME_UNAVAILABLE_MESSAGE : state.studentMessage}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" disabled={busy || runtimeAvailability !== 'ready'} onClick={onResume} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">
          {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {unavailable ? '分析服务尚未就绪' : '继续处理'}
        </button>
        <button type="button" disabled={busy} onClick={onReturn} className="min-h-11 rounded-md border border-slate-300 bg-white px-5 text-sm text-slate-700 hover:bg-slate-50 disabled:text-slate-300">稍后继续</button>
      </div>
    </main>
  );
}

function FeedbackList({ title, items, tone, contentVisible = true }) {
  return (
    <section className="mt-7">
      {tone === 'positive' ? (
        <FeedbackSectionTitle icon="positive">{title}</FeedbackSectionTitle>
      ) : (
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      )}
      <ol className={`mt-3 space-y-3 text-base leading-7 text-slate-700 ${tone === 'positive' ? 'pl-[26px]' : ''} ${feedbackRevealClass(contentVisible)}`}>
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className={tone === 'attention' ? 'flex items-start gap-3' : ''}>
            {tone === 'attention' ? (
              <span className="w-5 shrink-0 text-right font-medium text-slate-500">{index + 1}.</span>
            ) : null}
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FeedbackSectionTitle({ icon, children }) {
  const Icon = icon === 'positive' ? ThumbsUp : icon === 'gap' ? Lightbulb : Pencil;
  const colorClass = icon === 'positive'
    ? 'text-emerald-600'
    : icon === 'gap'
      ? 'text-amber-500'
      : 'text-slate-900';
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
      <Icon size={18} aria-hidden="true" className={`shrink-0 ${colorClass}`} />
      <span>{children}</span>
    </h2>
  );
}

function NarrativeNote({ title, text }) {
  return (
    <section className="mt-7 border-t border-slate-200 pt-6">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-base leading-7 text-slate-700">{text}</p>
    </section>
  );
}

function StudentLearningNarrativeOutcome({ presentation, reviewVisible = true, actionVisible = true }) {
  const outcome = presentation?.outcome || {};
  const hasReview = Boolean(outcome.achieved || outcome.primaryGap);
  const actions = splitNarrativeActions(presentation?.nextAction);
  return (
    <>
      {hasReview ? (
        <section className="mt-7">
          <div className={feedbackRevealClass(reviewVisible)}>
            {outcome.achieved ? (
              <div>
                <FeedbackSectionTitle icon="positive">已经完成的思考</FeedbackSectionTitle>
                <p className="mt-2 pl-[26px] text-base leading-7 text-slate-700">{outcome.achieved}</p>
              </div>
            ) : null}
            {outcome.primaryGap ? (
              <div className={outcome.achieved ? 'mt-5' : ''}>
                <FeedbackSectionTitle icon="gap">
                  {narrativeGapTitle(outcome.primaryGapMode, outcome.primaryGapReasonCode)}
                </FeedbackSectionTitle>
                <p className="mt-2 pl-[26px] text-base leading-7 text-slate-700">{outcome.primaryGap}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {actions.length > 0 ? (
        <section className={`mt-7 ${feedbackRevealClass(actionVisible)}`}>
          <FeedbackSectionTitle icon="action">下一步训练</FeedbackSectionTitle>
          <ol className="mt-3 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
            {actions.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}

function hasOutcomeNarrative(presentation) {
  return Boolean(
    presentation?.outcome?.responseAnchor ||
    presentation?.outcome?.achieved ||
    presentation?.outcome?.primaryGap ||
    presentation?.nextAction,
  );
}

function splitNarrativeActions(value) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function narrativeGapTitle() {
  return '思考缺口';
}

function ThinkingReview({ review, contentVisible = true }) {
  const missingPoints = review.primaryGap ? [review.primaryGap] : review.missingPoints.slice(0, 1);
  const primaryGapCoverage = review.requirementCoverage?.find((item) =>
    item.requirementId === review.primaryGapRequirementId);
  if (!shouldRenderThinkingReview(review)) return null;
  const gapTitle = narrativeGapTitle();
  return (
    <section className="mt-7">
      <div className={feedbackRevealClass(contentVisible)}>
        {review.coveredPoints.length > 0 ? (
          <div>
            <FeedbackSectionTitle icon="positive">已经完成的思考</FeedbackSectionTitle>
            <ol className="mt-2 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
              {review.coveredPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {missingPoints.length > 0 ? (
          <div className={review.coveredPoints.length > 0 ? 'mt-5' : ''}>
            <FeedbackSectionTitle icon="gap">{gapTitle}</FeedbackSectionTitle>
            <ol className="mt-2 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
              {missingPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function feedbackRevealClass(visible) {
  return visible
    ? 'visible translate-y-0 opacity-100 transition-[opacity,transform] duration-200 motion-reduce:transition-none'
    : 'invisible translate-y-1 opacity-0 transition-[opacity,transform] duration-200 motion-reduce:transition-none';
}

function feedbackPresentationKey(roundId) {
  return `${FEEDBACK_PRESENTATION_KEY_PREFIX}${roundId}`;
}

function hasPresentedFeedback(roundId) {
  try {
    return window.localStorage.getItem(feedbackPresentationKey(roundId)) === 'presented';
  } catch {
    return false;
  }
}

function markFeedbackPresented(roundId) {
  try {
    window.localStorage.setItem(feedbackPresentationKey(roundId), 'presented');
  } catch {
    // Presentation persistence must never block the learning flow.
  }
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function StudentFeedbackGuidance({ guidance, compact = false }) {
  const hasContent = compact
    ? guidance.revisionActions.length > 0
    : guidance.understandingNotice ||
      guidance.detailsToReview.length > 0 ||
      guidance.revisionActions.length > 0;
  if (!hasContent) return null;
  if (compact) {
    return (
      <section className="mt-7">
        <FeedbackSectionTitle icon="action">下一步训练</FeedbackSectionTitle>
        <ol className="mt-3 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
          {guidance.revisionActions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold">需要留意</h2>
      {guidance.understandingNotice ? (
        <p className="mt-3 text-base leading-7 text-slate-700">{guidance.understandingNotice}</p>
      ) : null}
      {guidance.detailsToReview.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-800">重新看看</h3>
          <ul className="mt-2 space-y-2 text-base leading-7 text-slate-700">
            {guidance.detailsToReview.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {guidance.revisionActions.length > 0 ? (
        <div className="mt-5">
          <FeedbackSectionTitle icon="action">下一步训练</FeedbackSectionTitle>
          <ol className="mt-2 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
            {guidance.revisionActions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function WritingCorrections({ items }) {
  return (
    <section className="mt-7">
      <h2 className="text-sm font-semibold text-slate-800">发现错别字</h2>
      <ol className="mt-3 space-y-3 text-base leading-7 text-slate-700">
        {items.map((item, index) => (
          <li key={item.correctionId} className="flex items-start gap-3">
            <span className="w-5 shrink-0 text-right font-medium text-slate-500">{index + 1}.</span>
            <span className="min-w-0">“{item.originalText}”可能是“{item.suggestedText}”，请检查。</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function answerFingerprint(value) {
  let hash = 0;
  for (const character of value) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  return `${value.length}-${hash.toString(36)}`;
}

function LoadingWorkspace() {
  return <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-600"><RefreshCw size={17} className="animate-spin" />正在恢复学习任务</div>;
}

function WorkspaceFailure({ message, onBack }) {
  const presentation = resolveWorkspaceFailurePresentation(message);
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16">
      <h1 className="text-xl font-semibold">{presentation.title}</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{presentation.message}</p>
      <button type="button" onClick={onBack} className="mt-7 min-h-11 rounded-md bg-slate-900 px-5 text-sm text-white">返回学习入口</button>
    </main>
  );
}

function resolveWorkspaceFailurePresentation(message) {
  if (/暂无符合复测要求的正式任务/.test(message || '')) {
    return {
      title: '复测任务还需要准备',
      message: '本次复测要求已经保留，但当前没有符合能力、材料和复测条件的正式任务。系统不会用普通训练题代替复测。',
    };
  }
  if (/暂无符合当前能力和任务要求的正式任务/.test(message || '')) {
    return {
      title: '当前没有新的正式任务',
      message: '上一轮结果已经保存。当前没有同时符合能力、任务角色且未重复使用的正式资源；系统不会用错位题目凑匹配。',
    };
  }
  if (/当前正式任务尚未准备完成/.test(message || '')) {
    return {
      title: '当前任务需要检查',
      message: '任务来源已经找到，但正式执行条件尚未全部满足。已有学习记录不会丢失。',
    };
  }
  return {
    title: '暂时无法打开当前任务',
    message: message || '请稍后重新尝试。',
  };
}

function toMessage(error) {
  const value = error instanceof Error ? error.message : String(error);
  if (/api|provider|diagnosis|prompt|schema/i.test(value)) {
    return '本次分析尚未完成，回答已经保留。请点击“重新分析”继续，无需刷新或重新作答。';
  }
  return value;
}
