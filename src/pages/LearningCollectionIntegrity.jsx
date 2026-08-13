import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadLearningCollectionIntegrityView } from '../api/learningCollectionIntegrity.ts';

const eventNames = {
  question_presented: '题目展示', answer_submitted: '答案提交', diagnosis_completed: '诊断完成',
  feedback_presented: '反馈展示', learning_round_completed: '轮次完成',
};

export default function LearningCollectionIntegrity() {
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = () => {
    setBusy(true); setError('');
    loadLearningCollectionIntegrityView().then(setView).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setBusy(false));
  };
  useEffect(load, []);
  const report = view?.report;
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3"><Link to="/internal" aria-label="返回内部入口"><ArrowLeft size={19} /></Link><h1 className="text-lg font-semibold">学习采集完整性</h1></div>
          <button type="button" onClick={load} disabled={busy} className="flex items-center gap-2 text-sm text-emerald-700"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} />刷新报告</button>
        </div>
      </header>
      <main className="mx-auto max-w-[1208px] px-5 py-8 md:px-8">
        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {!report ? <p className="text-sm text-slate-600">正在读取只读采集报告。</p> : (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">{statusIcon(report.status)}<div><p className="text-xs font-semibold uppercase text-slate-500">Integrity {report.status}</p><h2 className="text-xl font-semibold">{statusText(report.status)}</h2></div></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {Object.entries({ 轮次: report.totals.roundsWithFormalQuestion, 已完成: report.totals.completedRounds, 提交: report.totals.submittedAttempts, 有效样本: report.totals.eligibleCalibrationAttempts, 排除样本: report.totals.excludedCalibrationAttempts, 独立使用者: report.totals.independentSubjects }).map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}
              </div>
              <p className="mt-5 text-xs text-slate-500">本页只读取和核对现有事实，不自动补写或修改正式数据，也不表示题目已经完成群体校准。</p>
            </section>
            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold">问题</h2>
              {report.issues.length === 0 ? <p className="mt-3 text-sm text-slate-600">当前未发现完整性问题。</p> : <div className="mt-4 space-y-3">{report.issues.map((issue, index) => <div key={`${issue.code}-${index}`} className="rounded-md border border-slate-200 p-4"><div className="flex gap-2"><span className={issue.severity === 'fail' ? 'text-red-600' : 'text-amber-600'}>{issue.severity === 'fail' ? '失败' : '警告'}</span><code className="text-xs text-slate-500">{issue.code}</code></div><p className="mt-2 text-sm text-slate-700">{issue.message}</p></div>)}</div>}
            </section>
            <section className="mt-6 space-y-3"><h2 className="text-base font-semibold">按轮次查看</h2>{view.rounds.length === 0 ? <p className="text-sm text-slate-600">尚无正式学习轮次。</p> : view.rounds.map((round) => <details key={round.learningRoundId} className="rounded-md border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">{round.learningRoundId} · {round.status}</summary><p className="mt-3 text-xs text-slate-500">题目版本：{round.resourceVersionId}</p><div className="mt-4 flex flex-wrap gap-2">{round.events.map((event, index) => <span key={`${event.eventType}-${index}`} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">{eventNames[event.eventType]}</span>)}</div><div className="mt-4 text-sm text-slate-700">Attempt：{round.projections.length ? round.projections.map((item) => `${item.status}${item.itemScore === undefined ? '' : ` · ${item.itemScore}`}`).join('；') : '无 Projection'}</div></details>)}</section>
          </>
        )}
      </main>
    </div>
  );
}

function statusIcon(status) {
  if (status === 'pass') return <CheckCircle2 size={28} className="text-emerald-600" />;
  if (status === 'warning') return <AlertTriangle size={28} className="text-amber-500" />;
  return <XCircle size={28} className="text-red-600" />;
}
function statusText(status) { return status === 'pass' ? '采集链完整' : status === 'warning' ? '存在需要留意的问题' : '存在阻断性完整性问题'; }
