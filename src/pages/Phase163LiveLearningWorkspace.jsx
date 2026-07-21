import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Pencil, RefreshCw, Save } from 'lucide-react';
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

const RUNTIME_UNAVAILABLE_MESSAGE = '分析服务尚未就绪。你可以继续编辑或保存回答，服务准备好后再提交。';

export default function Phase163LiveLearningWorkspace({ onReturnToEntry, autoRetryResource = false }) {
  const [state, setState] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('neutral');
  const [analysisRetry, setAnalysisRetry] = useState(false);
  const [runtimeAvailability, setRuntimeAvailability] = useState('checking');
  const [writingCorrections, setWritingCorrections] = useState([]);
  const saveRequest = useRef(0);
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
      return undefined;
    }
    let active = true;
    requestStudentWritingCorrections({
      requestId: `writing-correction-${state.roundId}-${answerFingerprint(answer)}`,
      answerText: answer,
      readingText: state.task.readingText,
      questionText: state.task.questionText,
    })
      .then((suggestions) => active && setWritingCorrections(suggestions))
      .catch(() => active && setWritingCorrections([]));
    return () => { active = false; };
  }, [state?.feedback, state?.roundId, answer, state?.task.readingText, state?.task.questionText]);

  function applyState(next) {
    setState(next);
    setAnswer(next.answerDraft || '');
    setMessage(next.studentMessage || '');
    setMessageTone(next.studentMessage ? 'error' : 'neutral');
    setAnalysisRetry(false);
  }

  function showMessage(value, tone = 'neutral') {
    setMessage(value);
    setMessageTone(tone);
  }

  async function saveDraft() {
    if (!answer.trim() || busy) {
      showMessage('当前没有可保存的内容。', 'error');
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
    if (runtimeAvailability !== 'ready') {
      showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      return;
    }
    if (!answer.trim()) {
      showMessage('请先输入回答再提交。', 'error');
      return;
    }
    saveRequest.current += 1;
    setBusy(true);
    setAnalysisRetry(false);
    showMessage('正在分析本次回答，请稍候。');
    try {
      applyState(await submitPhase163LiveAnswer(answer));
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
  if (!state) return <WorkspaceFailure message={message} onBack={onReturnToEntry} />;

  const completed = state.status === 'completed';
  const paused = state.status === 'blocked' || state.status === 'review_required';
  const recovering = state.status === 'retry_required' && state.primaryAction === 'resume_processing';
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-5 md:px-8">
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
        <CompletedFeedback state={state} writingCorrections={writingCorrections} busy={busy} onContinue={enterNextRound} onReturn={onReturnToEntry} />
      ) : paused ? (
        <PausedWorkspace state={state} writingCorrections={writingCorrections} busy={busy} onRetryResource={resumeProcessing} onReturn={onReturnToEntry} />
      ) : recovering ? (
        <RecoveringWorkspace
          state={state}
          busy={busy}
          runtimeAvailability={runtimeAvailability}
          onResume={resumeProcessing}
          onReturn={onReturnToEntry}
        />
      ) : (
        <main className="mx-auto grid min-h-[calc(100vh-65px)] w-full max-w-[1440px] lg:grid-cols-2">
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
              <h1 className="mt-7 text-lg font-semibold">题目</h1>
              <p className="mt-3 text-base leading-8 text-slate-800">{state.task.questionText}</p>

              <textarea
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (messageTone !== 'neutral') showMessage('');
                }}
                disabled={busy || analysisRetry}
                aria-label="输入你的回答"
                placeholder="请在这里输入你的回答。"
                className="mt-7 min-h-[300px] w-full resize-y rounded-md border border-slate-300 bg-[#f8fafc] px-4 py-4 text-base leading-7 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-70"
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busy || (!analysisRetry && !answer.trim())}
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
                  disabled={busy || !answer.trim() || runtimeAvailability !== 'ready'}
                  onClick={submitAnswer}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {busy || analysisRetry || runtimeAvailability === 'checking' ? <RefreshCw size={16} className={busy || runtimeAvailability === 'checking' ? 'animate-spin' : ''} /> : <ArrowRight size={16} />}
                  {runtimeAvailability === 'checking'
                    ? '正在检查分析服务'
                    : runtimeAvailability === 'unavailable'
                      ? '分析服务尚未就绪'
                      : analysisRetry ? '重新分析' : '提交本轮回答'}
                </button>
              </div>

              {message ? (
                <p className={`mt-5 text-sm leading-6 ${messageTone === 'error' ? 'text-red-700' : messageTone === 'success' ? 'text-emerald-700' : 'text-slate-600'}`} aria-live="polite">
                  {message}
                </p>
              ) : null}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

function CompletedFeedback({ state, writingCorrections, busy, onContinue, onReturn }) {
  const positive = state.feedback?.whatYouDidWell?.slice(0, 1) || [];
  const thinkingReview = state.feedback?.thinkingReview;
  const guidance = state.feedback?.guidance;
  const attention = guidance ? [] : state.feedback?.whatNeedsAttention?.slice(0, 1) || [];
  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[800px] flex-col justify-center px-6 py-12">
      <CheckCircle2 size={26} className="text-emerald-600" />
      <h1 className="mt-4 text-lg font-semibold">反馈</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{state.feedback?.summary || '本轮结果已经保存。'}</p>
      {writingCorrections.length ? <WritingCorrections items={writingCorrections} /> : null}
      {thinkingReview ? <ThinkingReview review={thinkingReview} /> : positive.length ? <FeedbackList title="思路点评" items={positive} tone="positive" /> : null}
      {guidance ? <StudentFeedbackGuidance guidance={guidance} compact={Boolean(thinkingReview)} /> : null}
      {attention.length ? <FeedbackList title="需要留意" items={attention} tone="attention" /> : null}
      <div className="mt-10 flex justify-center">
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
          <button type="button" onClick={onReturn} className="min-h-11 rounded-md border border-slate-300 bg-white px-5 text-sm text-slate-700 hover:bg-slate-50">
            返回学习入口
          </button>
        )}
      </div>
    </main>
  );
}

function PausedWorkspace({ state, writingCorrections, busy, onRetryResource, onReturn }) {
  const positive = state.feedback?.whatYouDidWell?.slice(0, 1) || [];
  const thinkingReview = state.feedback?.thinkingReview;
  const guidance = state.feedback?.guidance;
  const attention = guidance ? [] : state.feedback?.whatNeedsAttention?.slice(0, 1) || [];
  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[800px] flex-col justify-center px-6 py-12">
      {state.feedback ? (
        <>
          <h1 className="text-lg font-semibold">反馈</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">{state.feedback.summary}</p>
          {writingCorrections.length ? <WritingCorrections items={writingCorrections} /> : null}
          {thinkingReview ? <ThinkingReview review={thinkingReview} /> : positive.length ? <FeedbackList title="思路点评" items={positive} tone="positive" /> : null}
          {guidance ? <StudentFeedbackGuidance guidance={guidance} compact={Boolean(thinkingReview)} /> : null}
          {attention.length ? <FeedbackList title="需要留意" items={attention} tone="attention" /> : null}
        </>
      ) : null}
      <section className={state.feedback ? 'mt-9 border-t border-slate-200 pt-7' : ''} aria-live="polite">
        <h2 className="text-base font-semibold">{state.studentTitle || '暂时无法继续'}</h2>
        <p className="mt-2 text-base leading-7 text-slate-600">{state.studentMessage}</p>
      </section>
      <div className="mt-8 flex flex-wrap gap-3">
        {state.primaryAction === 'retry_resource' ? (
          <button type="button" disabled={busy} onClick={onRetryResource} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">
            {busy ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            检查下一任务
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={onReturn} className={`${state.primaryAction === 'retry_resource' ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-800'} min-h-11 rounded-md px-5 text-sm disabled:text-slate-300`}>返回学习入口</button>
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

function FeedbackList({ title, items, tone }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold">{title}</h2>
      <ol className="mt-3 space-y-3 text-base leading-7 text-slate-700">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex items-start gap-3">
            {tone === 'attention' ? (
              <span className="w-5 shrink-0 text-right font-medium text-slate-500">{index + 1}.</span>
            ) : (
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            )}
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ThinkingReview({ review }) {
  const missingPoints = review.primaryGap ? [review.primaryGap] : review.missingPoints.slice(0, 1);
  const primaryGapCoverage = review.requirementCoverage?.find((item) =>
    item.requirementId === review.primaryGapRequirementId);
  const hasAssessableCoverage = !review.requirementCoverage?.length || review.requirementCoverage.some((item) =>
    item.status !== 'insufficient_to_judge');
  if (!hasAssessableCoverage && review.coveredPoints.length === 0) return null;
  const gapTitle = primaryGapCoverage?.requirementType === 'conclusion' &&
    primaryGapCoverage.status === 'missing'
    ? '还需调整'
    : '还需补充';
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold">思路点评</h2>
      {review.coveredPoints.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">回答到位</h3>
          <ol className="mt-2 space-y-2 text-base leading-7 text-slate-700">
            {review.coveredPoints.map((item, index) => (
              <li key={item} className="flex items-start gap-3">
                <span className="w-5 shrink-0 text-right font-medium text-emerald-600">{index + 1}.</span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {missingPoints.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-800">{gapTitle}</h3>
          <ol className="mt-2 space-y-2 text-base leading-7 text-slate-700">
            {missingPoints.map((item, index) => (
              <li key={item} className="flex items-start gap-3">
                <span className="w-5 shrink-0 text-right font-medium text-slate-500">{index + 1}.</span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
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
        <h2 className="text-base font-semibold">思路建议</h2>
        <ol className="mt-3 space-y-2 text-base leading-7 text-slate-700">
          {guidance.revisionActions.map((item, index) => (
            <li key={item} className="flex items-start gap-3">
              <span className="w-5 shrink-0 text-right font-medium text-slate-500">{index + 1}.</span>
              <span className="min-w-0">{item}</span>
            </li>
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
          <h3 className="text-sm font-semibold text-slate-800">思路建议</h3>
          <ol className="mt-2 space-y-2 text-base leading-7 text-slate-700">
            {guidance.revisionActions.map((item, index) => (
              <li key={item} className="flex items-start gap-3">
                <span className="w-5 shrink-0 text-right font-medium text-slate-500">{index + 1}.</span>
                <span className="min-w-0">{item}</span>
              </li>
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
      <h2 className="text-base font-semibold">先检查一个错别字</h2>
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
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16">
      <h1 className="text-xl font-semibold">暂时无法打开当前任务</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{message || '请稍后重新尝试。'}</p>
      <button type="button" onClick={onBack} className="mt-7 min-h-11 rounded-md bg-slate-900 px-5 text-sm text-white">返回学习入口</button>
    </main>
  );
}

function toMessage(error) {
  const value = error instanceof Error ? error.message : String(error);
  if (/api|provider|diagnosis|prompt|schema/i.test(value)) {
    return '本次分析尚未完成，回答已经保留。请点击“重新分析”继续，无需刷新或重新作答。';
  }
  return value;
}
