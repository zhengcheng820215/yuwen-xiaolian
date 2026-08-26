import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, RefreshCw, RotateCcw } from 'lucide-react';
import Phase163LiveLearningWorkspace from './Phase163LiveLearningWorkspace.jsx';
import {
  endUnifiedLearningSession,
  loadUnifiedLearningEntry,
  startOrResumeUnifiedLearning,
} from '../api/unifiedLearningEntry.ts';
import { studentEntryStatusLabel } from '../ui/productComplexityConvergencePresentation.ts';
import { readProductRuntimeHealth, healthReadReasonCodes } from '../api/productRuntimeHealthClient.ts';
import { projectProductRuntimeRecovery } from '../ai/services/productRuntimeRecoveryProjectionService.ts';
import { toProductRuntimeRecoveryNoticeView } from '../ui/productRuntimeRecoveryPresentation.ts';
import ProductRuntimeRecoveryNotice from '../components/runtime/ProductRuntimeRecoveryNotice.jsx';

export default function UnifiedLearningEntry() {
  const [entry, setEntry] = useState(null);
  const [view, setView] = useState('entry');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [runtimeProjection, setRuntimeProjection] = useState(null);

  useEffect(() => {
    refreshEntry();
  }, []);

  async function refreshEntry() {
    setBusy(true);
    setError('');
    try {
      const healthResult = await readProductRuntimeHealth();
      if (healthResult.state !== 'available') {
        setRuntimeProjection(projectProductRuntimeRecovery({
          surface: 'learning_entry', operation: 'load_entry', healthReadState: healthResult.state,
          reasonCodes: healthReadReasonCodes(healthResult), ownerFacts: unknownOwnerFacts(),
        }));
        setEntry(null);
        setView('entry');
        return;
      }
      if (healthResult.health.formalResourceStore.status === 'blocked') {
        setRuntimeProjection(projectProductRuntimeRecovery({
          surface: 'learning_entry', operation: 'load_entry', healthReadState: 'available',
          health: healthResult.health, ownerFacts: unknownOwnerFacts(),
        }));
        setEntry(null);
        setView('entry');
        return;
      }
      const nextEntry = await loadUnifiedLearningEntry();
      setEntry(nextEntry);
      setRuntimeProjection(projectProductRuntimeRecovery({
        surface: 'learning_entry',
        operation: ['start_learning', 'start_new_session'].includes(nextEntry.primaryAction) ? 'start_learning' : 'load_entry',
        healthReadState: 'available', health: healthResult.health,
        ownerFacts: {
          // A stored Session is only projected as "continue learning" when
          // the entry contract has proved that its frozen task can be opened.
          hasActiveSession: nextEntry.hasActiveSession && nextEntry.canEnterWorkspace,
          hasDraft: nextEntry.hasDraft,
          attemptCommitted: nextEntry.status === 'recovering_submission',
          checkpointPhase: nextEntry.status === 'recovering_submission' ? 'submitted' : undefined,
          publishedResourceCommitted: false,
          currentWorkbenchObjectPresent: false,
        },
        taskAvailability: nextEntry.taskAvailabilityState,
      }));
      setView('entry');
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setRuntimeProjection(projectProductRuntimeRecovery({
        surface: 'learning_entry', operation: 'load_entry', healthReadState: 'available',
        reasonCodes: /共享资源服务|正式任务/.test(message) ? ['formal_resource_boundary_unavailable'] : ['audit_evidence_incomplete'],
        ownerFacts: unknownOwnerFacts(),
      }));
      setEntry(null);
    } finally {
      setBusy(false);
    }
  }

  async function enterWorkspace() {
    if (!entry?.canEnterWorkspace || busy) return;
    setBusy(true);
    setError('');
    try {
      const nextEntry = await startOrResumeUnifiedLearning();
      setEntry(nextEntry);
      if (nextEntry.canEnterWorkspace) {
        setView('workspace');
      } else {
        setView('entry');
      }
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

  async function completeSessionFromWorkspace() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setEntry(await endUnifiedLearningSession());
      setView('entry');
    } catch (endError) {
      setError(toMessage(endError));
    } finally {
      setBusy(false);
    }
  }

  const canFinishReviewedSession = entry?.status === 'review_required' &&
    entry?.hasActiveSession &&
    entry?.validation?.passed;
  if (view === 'workspace') {
    return (
      <Phase163LiveLearningWorkspace
        onReturnToEntry={refreshEntry}
        onCompleteSession={completeSessionFromWorkspace}
        autoRetryResource={entry?.primaryAction === 'retry_resource'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1360px] items-center px-5 md:px-8">
          <BookOpen size={20} className="text-emerald-600" />
          <span className="ml-3 text-lg font-semibold">学习</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-8 md:py-14">
        {busy && !entry ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={refreshEntry} /> : null}
        {!busy && runtimeProjection && runtimeProjection.state !== 'ready' ? (
          <ProductRuntimeRecoveryNotice
            view={toProductRuntimeRecoveryNoticeView(runtimeProjection)}
            busy={busy}
            onPrimaryAction={runtimeProjection.primaryAction.actionId === 'continue_learning' ? enterWorkspace : refreshEntry}
          />
        ) : null}
        {entry && !error && (!runtimeProjection || runtimeProjection.state === 'ready') ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-16">
            <section aria-live="polite">
              <StatusEyebrow status={entry.status} title={entry.title} />
              <h1 className="mt-3 max-w-[680px] text-xl font-semibold leading-8 text-slate-950">
                {entry.title}
              </h1>
              <p className="mt-3 max-w-[680px] text-base leading-7 text-slate-600">
                {entry.message}
              </p>

              {entry.hasDraft ? (
                <p className="mt-6 flex items-center gap-2 text-sm leading-6 text-emerald-700">
                  <RotateCcw size={16} />
                  上次输入的答案草稿已经保留
                </p>
              ) : null}

              {entry.retest ? (
                <div className="mt-7 border-l-2 border-emerald-500 pl-4">
                  <p className="text-sm font-semibold text-slate-900">有一项练习待完成</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">完成这项练习后，可以继续本次学习。</p>
                </div>
              ) : null}

              <div className="mt-9 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={(!entry.canEnterWorkspace && !canFinishReviewedSession) || busy}
                  onClick={canFinishReviewedSession ? endSession : enterWorkspace}
                  className="flex min-h-11 min-w-44 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-normal text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {entry.primaryActionText}
                </button>
                {entry.hasActiveSession && !canFinishReviewedSession ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={endSession}
                    className="min-h-11 rounded-md border border-emerald-600 bg-white px-5 text-sm font-normal text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    结束本次学习
                  </button>
                ) : null}
              </div>
            </section>

            <aside className="border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <h2 className="text-sm font-semibold text-slate-900">学习进度</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <ProgressRow label="已完成" value={`${entry.completedRoundCount} 题`} />
                <ProgressRow label="当前状态" value={studentEntryStatusLabel(entry.status, entry.title)} />
                {entry.currentRoundNumber ? <ProgressRow label="当前任务" value={`第 ${entry.currentRoundNumber} 题`} /> : null}
              </dl>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatusEyebrow({ status, title }) {
  const isComplete = ['feedback_available', 'session_ended'].includes(status);
  const isActionable = ['continue_round', 'start_new_round', 'delayed_retest_available'].includes(status);
  const tone = isComplete || isActionable ? 'text-emerald-700' : ['blocked', 'review_required'].includes(status) ? 'text-amber-700' : 'text-slate-600';
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
      {isComplete ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
      {studentEntryStatusLabel(status, title)}
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
      <button type="button" onClick={onRetry} className="mt-6 min-h-11 rounded-md bg-emerald-600 px-5 text-sm text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">重新尝试</button>
    </section>
  );
}

function toMessage(error) {
  const value = error instanceof Error ? error.message : String(error);
  if (import.meta.env.DEV) console.error(error);
  if (/当前已有学习正在进行/.test(value)) return value;
  if (/^学习入口暂时无法读取“.+”，请重新尝试。$/.test(value)) return value;
  if (/共享资源服务(读取超时|不可用)/.test(value)) return '正式任务暂时无法读取，请重新尝试。';
  return '学习状态暂时无法读取，已有记录不会丢失，请重新尝试。';
}

function unknownOwnerFacts() {
  return {
    hasActiveSession: 'unknown', hasDraft: 'unknown', attemptCommitted: 'unknown',
    publishedResourceCommitted: false, currentWorkbenchObjectPresent: false,
  };
}
