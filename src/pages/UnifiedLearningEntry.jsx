import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, RefreshCw, RotateCcw } from 'lucide-react';
import Phase163LiveLearningWorkspace from './Phase163LiveLearningWorkspace.jsx';
import {
  endUnifiedLearningSession,
  loadUnifiedLearningEntry,
  startOrResumeUnifiedLearning,
} from '../api/unifiedLearningEntry.ts';

export default function UnifiedLearningEntry() {
  const [entry, setEntry] = useState(null);
  const [view, setView] = useState('entry');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    refreshEntry();
  }, []);

  async function refreshEntry() {
    setBusy(true);
    setError('');
    try {
      setEntry(await loadUnifiedLearningEntry());
      setView('entry');
    } catch (loadError) {
      setError(toMessage(loadError));
    } finally {
      setBusy(false);
    }
  }

  async function enterWorkspace() {
    if (!entry?.canEnterWorkspace || busy) return;
    setBusy(true);
    setError('');
    try {
      await startOrResumeUnifiedLearning();
      setView('workspace');
    } catch (startError) {
      setError(toMessage(startError));
    } finally {
      setBusy(false);
    }
  }

  async function endSession() {
    if (busy) return;
    setBusy(true);
    try {
      setEntry(await endUnifiedLearningSession());
    } catch (endError) {
      setError(toMessage(endError));
    } finally {
      setBusy(false);
    }
  }

  if (view === 'workspace') {
    return (
      <Phase163LiveLearningWorkspace
        onReturnToEntry={refreshEntry}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1120px] items-center px-5 md:px-8">
          <BookOpen size={20} className="text-blue-600" />
          <span className="ml-3 text-lg font-semibold">学习</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-5 py-10 md:px-8 md:py-14">
        {busy && !entry ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={refreshEntry} /> : null}
        {entry && !error ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
            <section aria-live="polite">
              <StatusEyebrow status={entry.status} />
              <h1 className="mt-3 max-w-[680px] text-xl font-semibold leading-8 text-slate-950">
                {entry.title}
              </h1>
              <p className="mt-3 max-w-[680px] text-base leading-7 text-slate-600">
                {entry.message}
              </p>

              {entry.hasDraft ? (
                <p className="mt-6 flex items-center gap-2 text-sm leading-6 text-blue-700">
                  <RotateCcw size={16} />
                  上次输入的答案草稿已经保留
                </p>
              ) : null}

              {entry.retest ? (
                <div className="mt-7 border-l-2 border-blue-500 pl-4">
                  <p className="text-sm font-semibold text-slate-900">待完成复测</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{entry.retest.whyNow}</p>
                </div>
              ) : null}

              <div className="mt-9 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!entry.canEnterWorkspace || busy}
                  onClick={enterWorkspace}
                  className="flex min-h-11 min-w-44 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-normal text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {entry.primaryActionText}
                </button>
                {entry.hasActiveSession ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={endSession}
                    className="min-h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-normal text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    结束本次学习
                  </button>
                ) : null}
              </div>
            </section>

            <aside className="border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <h2 className="text-sm font-semibold text-slate-900">学习进度</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <ProgressRow label="已完成" value={`${entry.completedRoundCount} 轮`} />
                <ProgressRow label="当前状态" value={statusLabel(entry.status)} />
                {entry.currentRoundNumber ? <ProgressRow label="当前任务" value={`第 ${entry.currentRoundNumber} 轮`} /> : null}
                {entry.focusText ? <ProgressRow label="本轮重点" value={entry.focusText} /> : null}
              </dl>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatusEyebrow({ status }) {
  const isReady = ['continue_round', 'feedback_available', 'start_new_round', 'delayed_retest_available'].includes(status);
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold ${isReady ? 'text-emerald-700' : 'text-slate-600'}`}>
      {isReady ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
      {statusLabel(status)}
    </div>
  );
}

function ProgressRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function LoadingState() {
  return <div className="flex items-center gap-2 text-sm text-slate-600"><RefreshCw size={17} className="animate-spin" />正在恢复学习状态</div>;
}

function ErrorState({ message, onRetry }) {
  return (
    <section className="max-w-[680px]">
      <h1 className="text-xl font-semibold">暂时无法打开学习入口</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{message}</p>
      <button type="button" onClick={onRetry} className="mt-6 min-h-11 rounded-md bg-slate-900 px-5 text-sm text-white">重新尝试</button>
    </section>
  );
}

function statusLabel(status) {
  const labels = {
    review_required: '等待确认', blocked: '暂时无法继续', recovering_submission: '正在恢复',
    continue_round: '可以继续', delayed_retest_available: '复测待完成', feedback_available: '反馈可查看',
    start_new_round: '可以开始', session_ended: '本次学习已结束', no_task: '暂无任务',
  };
  return labels[status] || '学习状态';
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
