import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, ExternalLink, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import RefreshIconButton from '../components/RefreshIconButton.jsx';
import {
  clearPhase163ControlledAcceptanceData,
  clearPhase173ProductLearningAcceptanceData,
  loadInternalLearningReviewQueue,
  loadPhase163MultiDayReview,
  loadPhase173ProductLearningAcceptanceTrace,
} from '../api/internalLearningReview.ts';

export default function InternalLearningReview() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [multiDay, setMultiDay] = useState(null);
  const [productTrace, setProductTrace] = useState(null);

  useEffect(() => { loadQueue(); }, []);

  async function loadQueue() {
    setBusy(true);
    setError('');
    try {
      const [queue, multiDayReview, learningTrace] = await Promise.all([
        loadInternalLearningReviewQueue(),
        loadPhase163MultiDayReview(),
        loadPhase173ProductLearningAcceptanceTrace(),
      ]);
      setItems(queue);
      setMultiDay(multiDayReview);
      setProductTrace(learningTrace);
      setSelectedId((current) => current || queue[0]?.caseId || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setBusy(false);
    }
  }

  async function clearControlledData() {
    setBusy(true);
    setError('');
    try {
      await clearPhase163ControlledAcceptanceData();
      await loadQueue();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
      setBusy(false);
    }
  }

  async function resetProductAcceptanceData() {
    setBusy(true);
    setError('');
    try {
      await clearPhase173ProductLearningAcceptanceData();
      await loadQueue();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
      setBusy(false);
    }
  }

  const selected = items.find((item) => item.caseId === selectedId);

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <Link to="/internal" aria-label="返回内部入口" title="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"><ArrowLeft size={18} /></Link>
            <ShieldCheck size={20} className="text-blue-600" /><h1 className="text-lg font-semibold">内部复核工作台</h1>
          </div>
          <div className="flex items-center gap-2">
            {import.meta.env.DEV ? (
              <>
                <button type="button" onClick={resetProductAcceptanceData} disabled={busy} title="仅重置当前本地学生的学习验收记录，不影响正式资源" className="flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm text-slate-600 hover:bg-slate-100 disabled:text-slate-300">
                  <RotateCcw size={16} />重置学习验收数据
                </button>
                <button type="button" onClick={clearControlledData} disabled={busy} title="仅清除旧 Demo 数据，不影响正式学习记录" className="flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm text-slate-600 hover:bg-slate-100 disabled:text-slate-300">
                  <RotateCcw size={16} />清除旧 Demo 数据
                </button>
              </>
            ) : null}
            <RefreshIconButton
              onClick={loadQueue}
              busy={busy}
              label="刷新复核队列"
              busyLabel="正在刷新复核队列"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1208px] gap-0 md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-5 md:min-h-[calc(100vh-64px)] md:border-b-0 md:border-r md:p-6">
          <p className="text-sm font-semibold text-slate-900">受控演示记录</p>
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <button key={item.caseId} type="button" onClick={() => setSelectedId(item.caseId)} className={`w-full rounded-md px-3 py-3 text-left text-sm transition ${selectedId === item.caseId ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                <span className="flex items-center gap-2 font-medium"><StatusIcon status={item.summary.status} />{item.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{reviewStatusLabel(item.summary.status)}</span>
              </button>
            ))}
          </div>
          <div className="mt-8 border-t border-slate-200 pt-5">
            <p className="text-xs font-semibold text-slate-500">资源工具</p>
            <Link to="/material-resource-workbench" className="mt-3 flex items-center gap-2 text-sm text-blue-700">素材与题目生产工作台 <ExternalLink size={14} /></Link>
            <Link to="/resource-matching-quality-demo" className="mt-3 flex items-center gap-2 text-sm text-blue-700">资源匹配复核 <ExternalLink size={14} /></Link>
          </div>
        </aside>

        <section className="p-5 md:p-8 lg:p-10">
          {error ? <p className="text-sm text-red-700">复核记录加载失败：{error}</p> : null}
          {busy && !selected ? <p className="flex items-center gap-2 text-sm text-slate-600"><RefreshCw size={16} className="animate-spin" />正在读取正式链路</p> : null}
          {multiDay ? <MultiDayReview summary={multiDay} /> : null}
          {productTrace ? <ProductLearningTrace trace={productTrace} /> : null}
          {selected ? <div className="mt-12 border-t border-slate-200 pt-10"><ReviewDetail item={selected} /></div> : null}
        </section>
      </main>
    </div>
  );
}

function ProductLearningTrace({ trace }) {
  return (
    <section className="mt-12 max-w-[760px] border-t border-slate-200 pt-10">
      <p className="text-sm font-semibold text-blue-700">Phase 17.3 正式学习验收</p>
      <h2 className="mt-2 text-xl font-semibold leading-8">当前 Batch A 运行追溯</h2>
      <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
        <TraceRow label="状态" value={trace.status} />
        <TraceRow label="Learning Session" value={trace.learningSessionId || '未开始'} />
        <TraceRow label="Learning Round" value={trace.learningRoundId || '未开始'} />
        <TraceRow label="资源版本" value={trace.sourceResourceVersionId || '未形成'} />
        <TraceRow label="Diagnosis Request" value={trace.diagnosisRequestId || '未形成'} />
        <TraceRow label="正式 Diagnosis" value={trace.formalDiagnosisId || '未形成'} />
        <TraceRow label="Answer Status" value={trace.answerStatus || '未形成'} />
        <TraceRow label="Runtime Status" value={trace.runtimeStatus || '未形成'} />
        <TraceRow label="Evidence 数量" value={String(trace.evidenceCount)} />
        <TraceRow label="评分信号" value={trace.scoringSignals?.join('；') || '未形成'} />
        <TraceRow label="命中 Rubric" value={trace.matchedRubricItems?.join('；') || '未形成'} />
        <TraceRow label="反馈覆盖" value={trace.feedbackCoverage?.join('；') || '未形成'} />
      </dl>
      {trace.issues.length ? <p className="mt-5 text-sm text-amber-700">{trace.issues.join('；')}</p> : null}
    </section>
  );
}

function MultiDayReview({ summary }) {
  return (
    <section className="max-w-[760px]">
      <p className="text-sm font-semibold text-blue-700">Phase 16.3C 自然日运行</p>
      <h2 className="mt-2 text-xl font-semibold leading-8">
        {summary.naturalRunComplete ? '多日验收事实已经齐备' : summary.status === 'not_started' ? '尚未开始自然日运行' : '自然日运行进行中'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        当前记录 {summary.naturalDays} / {summary.targetNaturalDays} 个自然日。工程预演与自然日验收分开统计。
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
        <Metric label="Session" value={summary.sessions} />
        <Metric label="Round" value={summary.rounds} />
        <Metric label="正式资源" value={summary.resources} />
        <Metric label="Evidence" value={summary.evidence} />
        <Metric label="延迟复测" value={summary.completedRetests} />
        <Metric label="恢复记录" value={summary.recoveries} />
        <Metric label="异常记录" value={summary.anomalies} />
        <Metric label="自然日" value={`${summary.naturalDays}/${summary.targetNaturalDays}`} />
      </dl>
      {summary.days.length ? (
        <div className="mt-7 space-y-2">
          {summary.days.map((day) => (
            <div key={day.dayKey} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-3 text-sm">
              <span className="font-medium text-slate-800">{day.dayKey}</span>
              <span className="text-slate-500">{day.roundCount} 轮 · {day.resourceCount} 资源 · {day.evidenceCount} Evidence</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-6 text-xs leading-5 text-slate-500">这里只显示计数和运行状态，不显示学生答案原文、完整 Prompt、Provider Raw Output 或 Secret。</p>
    </section>
  );
}

function Metric({ label, value }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 text-base font-semibold text-slate-900">{value}</dd></div>;
}

function ReviewDetail({ item }) {
  const { summary } = item;
  return (
    <div className="max-w-[760px]">
      <p className="text-sm font-semibold text-blue-700">{item.label}</p>
      <h2 className="mt-2 text-xl font-semibold leading-8">{summary.headline}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{summary.summary}</p>

      <h3 className="mt-8 text-base font-semibold">链路状态</h3>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.stages.map((stage) => (
          <li key={stage.key} className="flex items-center gap-2 border-b border-slate-200 pb-3 text-sm">
            <StatusIcon status={stage.status} />
            <span className="text-slate-700">{stage.label}</span>
          </li>
        ))}
      </ol>

      <h3 className="mt-8 text-base font-semibold">正式追溯</h3>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
        <TraceRow label="Operation" value={summary.trace.operationId} />
        <TraceRow label="Learning Session" value={summary.trace.learningSessionId} />
        <TraceRow label="Learning Round" value={summary.trace.learningRoundId} />
        <TraceRow label="资源版本" value={summary.trace.sourceResourceVersionId} />
        <TraceRow label="正式 Diagnosis" value={summary.trace.formalDiagnosisId || '未形成'} />
        <TraceRow label="Evidence" value={summary.trace.evidenceIds.join('，') || '未形成'} />
        <TraceRow label="持久化记录" value={summary.trace.persistenceRecordId || '未形成'} />
        <TraceRow label="下一资源版本" value={summary.trace.nextResourceVersionId || '未形成'} />
      </dl>

      {summary.issues.length ? (
        <div className="mt-8 border-l-2 border-amber-400 pl-4">
          <h3 className="text-sm font-semibold">需要处理</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">{summary.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div>
      ) : null}
      <p className="mt-8 text-xs leading-5 text-slate-500">此页面仅展示脱敏后的正式状态与追溯信息，不包含 API Key、完整 Prompt、学生敏感原文或 Provider Raw Output。</p>
    </div>
  );
}

function TraceRow({ label, value }) {
  return <><dt className="text-slate-500">{label}</dt><dd className="break-all font-mono text-xs leading-5 text-slate-800">{value}</dd></>;
}

function StatusIcon({ status }) {
  if (status === 'completed') return <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />;
  if (status === 'blocked' || status === 'review_required') return <AlertTriangle size={16} className="shrink-0 text-amber-600" />;
  return <Circle size={16} className="shrink-0 text-slate-400" />;
}

function reviewStatusLabel(status) {
  return { completed: '已完成', review_required: '需要人工复核', blocked: '已安全阻断', recovering: '等待恢复' }[status] || status;
}
