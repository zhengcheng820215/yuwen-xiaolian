import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import LearningTaskWorkspace from '../components/continuous-learning/LearningTaskWorkspace.jsx';
import LearningWorkspaceHeader from '../components/continuous-learning/LearningWorkspaceHeader.jsx';
import { StudentFeedbackPanel, WorkspaceNotice } from '../components/continuous-learning/StudentFeedbackPanel.jsx';
import {
  clearContinuousLearningDemo,
  continueContinuousLearningDemo,
  loadContinuousLearningDemo,
  saveContinuousLearningDraft,
  submitContinuousLearningAnswer,
} from '../api/continuousLearningDemo';

export default function ContinuousLearningDemo() {
  const [state, setState] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [simulatePersistenceFailure, setSimulatePersistenceFailure] = useState(false);

  useEffect(() => {
    let active = true;
    loadContinuousLearningDemo()
      .then((nextState) => {
        if (active) applyState(nextState);
      })
      .catch((loadError) => {
        if (active) setError(toMessage(loadError));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function applyState(nextState) {
    setState(nextState);
    setAnswer(nextState.answerDraft || '');
    setError('');
  }

  async function saveDraft(currentAnswer = answer) {
    if (!state || state.mode !== 'task') return;
    try {
      applyState(await saveContinuousLearningDraft(currentAnswer));
    } catch (saveError) {
      setError(`草稿保存失败：${toMessage(saveError)}`);
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      applyState(await submitContinuousLearningAnswer({
        answerText: answer,
        simulatePersistenceFailure,
      }));
      setSimulatePersistenceFailure(false);
    } catch (submitError) {
      setError(`本轮提交失败：${toMessage(submitError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function continueLearning() {
    if (!state?.canContinue || busy) return;
    setBusy(true);
    try {
      applyState(await continueContinuousLearningDemo());
    } catch (continueError) {
      setError(`下一轮启动失败：${toMessage(continueError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function resetDemo() {
    setBusy(true);
    try {
      applyState(await clearContinuousLearningDemo());
    } catch (resetError) {
      setError(`重置失败：${toMessage(resetError)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`min-h-screen bg-white ${state?.mode === 'task' ? '' : 'shadow-[0_0_0_100vmax_#fff]'}`}
    >
      <LearningWorkspaceHeader
        currentRound={state?.roundIndex || 1}
        completedRounds={state?.completedRoundCount || 0}
        totalRounds={state?.maxRounds || 3}
      />

      <main>
        {error ? (
          <div className="mx-auto max-w-[1208px] px-4 pt-4 md:px-6">
            <WorkspaceNotice tone="error" title="暂时无法继续" text={error} />
          </div>
        ) : null}

        {busy && !state ? <LoadingPanel /> : null}

        {state?.mode === 'task' ? (
          <LearningTaskWorkspace
            state={state}
            answer={answer}
            busy={busy}
            onAnswerChange={(value) => {
              setAnswer(value);
              setState((current) => current ? { ...current, feedback: undefined } : current);
            }}
            onAnswerBlur={saveDraft}
            onSaveDraft={() => saveDraft(answer)}
            onSubmit={submitAnswer}
          />
        ) : null}

        {state?.mode === 'feedback' ? (
          <CompletedRoundPanel state={state} busy={busy} onContinue={continueLearning} />
        ) : null}

        {state?.mode === 'finished' ? (
          <FinishedPanel state={state} busy={busy} onReset={resetDemo} />
        ) : null}

        {state?.mode === 'error' ? (
          <ErrorRoundPanel state={state} busy={busy} onRetry={submitAnswer} onReset={resetDemo} />
        ) : null}

        {state ? (
          <DeveloperPanel
            state={state}
            simulatePersistenceFailure={simulatePersistenceFailure}
            onSimulationChange={setSimulatePersistenceFailure}
            onReset={resetDemo}
            busy={busy}
          />
        ) : null}
      </main>
    </div>
  );
}

function CompletedRoundPanel({ state, busy, onContinue }) {
  const positiveFeedback = state.feedback?.whatYouDidWell?.slice(0, 1) || [];
  const attentionFeedback = state.feedback?.whatNeedsAttention?.slice(0, 1) || [];

  return (
    <div className="mx-auto min-h-[calc(100vh-64px)] max-w-[720px] px-4 py-10 md:px-6 md:py-14">
      <section aria-live="polite">
        <h1 className="text-lg font-semibold leading-7 text-slate-950">反馈</h1>

        <div className="mt-7 space-y-6">
          <RoundFeedbackList title="做得好的地方" items={positiveFeedback} tone="positive" />
          <RoundFeedbackList title="可以改进的地方" items={attentionFeedback} tone="attention" />
        </div>
      </section>

      <div className="mt-12 flex justify-center">
        <button
          type="button"
          disabled={!state.canContinue || busy}
          onClick={onContinue}
          className="flex min-h-11 min-w-48 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />}
          进入下一轮任务
        </button>
      </div>
    </div>
  );
}

function RoundFeedbackList({ title, items, tone }) {
  if (!items.length) return null;
  const dotClass = tone === 'positive' ? 'bg-emerald-500' : 'bg-amber-500';

  return (
    <div>
      <h2 className="text-base font-semibold leading-6 text-slate-800">{title}</h2>
      <ul className="mt-2 space-y-2 text-base leading-7 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className={`mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FinishedPanel({ state, busy, onReset }) {
  return (
    <div className="mx-auto max-w-[820px] space-y-5 px-4 py-6 md:px-6 md:py-8">
      <section className="rounded-md border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={32} />
        <h2 className="mt-3 text-lg font-semibold leading-7 text-slate-950">三轮学习已完成</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{state.message}</p>
      </section>
      <StudentFeedbackPanel feedback={state.feedback} />
      <div className="flex justify-end border-t border-slate-200 pt-5">
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          className="flex min-h-11 min-w-48 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <RefreshCw size={16} />
          重新验收三轮流程
        </button>
      </div>
    </div>
  );
}

function ErrorRoundPanel({ state, busy, onRetry, onReset }) {
  return (
    <div className="mx-auto max-w-[820px] space-y-5 px-4 py-6 md:px-6 md:py-8">
      <WorkspaceNotice tone="error" title="本轮暂未保存" text={state.message} />
      <StudentFeedbackPanel feedback={state.feedback} />
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          className="min-h-11 min-w-40 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          重置 Demo
        </button>
        <button
          type="button"
          disabled={busy || !state.answerDraft?.trim()}
          onClick={onRetry}
          className="min-h-11 min-w-40 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          重试本轮
        </button>
      </div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <section className="flex min-h-[calc(100vh-81px)] items-center justify-center bg-white">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <RefreshCw className="animate-spin" size={18} />
        正在恢复学习进度
      </div>
    </section>
  );
}

function DeveloperPanel({ state, simulatePersistenceFailure, onSimulationChange, onReset, busy }) {
  return (
    <details className="mx-auto mb-8 mt-6 max-w-[820px] rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-800">开发者调试信息</summary>
      <div className="mt-4 space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulatePersistenceFailure}
            onChange={(event) => onSimulationChange(event.target.checked)}
          />
          模拟下一次正式结果保存失败
        </label>
        <dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[120px_1fr]">
          <dt>页面模式</dt><dd>{state.mode}</dd>
          <dt>存储记录数</dt><dd>{state.debug.recordCount}</dd>
          <dt>已完成回合</dt><dd>{state.debug.completedRoundIds.length}</dd>
          <dt>当前回合</dt><dd className="break-all">{state.debug.currentRoundId || '-'}</dd>
          <dt>策略追溯</dt><dd className="break-all">{state.debug.latestStrategyId || '-'}</dd>
          <dt>任务追溯</dt><dd className="break-all">{state.debug.latestTaskRequestId || '-'}</dd>
          <dt>成长记忆</dt><dd className="break-all">{state.debug.latestGrowthMemoryRecordId || '-'}</dd>
          <dt>问题</dt><dd>{state.debug.issues.join('；') || '无'}</dd>
        </dl>
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          className="flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw size={16} />
          重置三轮 Demo
        </button>
      </div>
    </details>
  );
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
