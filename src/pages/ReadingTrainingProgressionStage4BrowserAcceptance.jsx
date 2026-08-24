import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FlaskConical, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { runReadingTrainingProgressionStage4BrowserAcceptance } from '../api/readingTrainingProgressionStage4BrowserAcceptance.ts';

export default function ReadingTrainingProgressionStage4BrowserAcceptance() {
  const [report, setReport] = useState(null); const [running, setRunning] = useState(false); const [error, setError] = useState(''); const [publishingProbe, setPublishingProbe] = useState(false);
  async function run() { if (running) return; setRunning(true); setPublishingProbe(false); setError(''); try { setReport(await runReadingTrainingProgressionStage4BrowserAcceptance()); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setRunning(false); } }
  const completed = report?.passed === report?.total;
  return <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8"><Link to="/internal/acceptance" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200"><ArrowLeft size={18}/></Link><div><h1 className="text-lg font-semibold">递进负担阶段 4 浏览器联调</h1><p className="text-sm text-slate-500">B4-01—B4-16 · 全隔离，不进入真实校准分母</p></div></div></header>
    <main className="mx-auto max-w-[1208px] px-5 py-10 md:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8" data-testid="reading-training-progression-stage4-acceptance"><div className="flex flex-wrap items-start justify-between gap-5"><div><h2 className="text-xl font-semibold">Successor 治理、版本消费、事件与校准投影</h2><p className="mt-2 text-sm leading-6 text-slate-600">调用正式 Schema、治理 Agent、Session 版本解析、事件仓库和投影服务。</p></div><button onClick={run} disabled={running} data-testid="run-progression-stage4-browser-matrix" className="flex min-h-11 min-w-[220px] items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-medium text-white disabled:opacity-60">{running ? <><LoaderCircle className="animate-spin" size={17}/>执行中…</> : <><FlaskConical size={17}/>执行 B4-01—B4-16</>}</button></div>
        {error ? <div role="alert" className="mt-6 rounded-md bg-red-50 p-4 text-red-700">{error}</div> : null}
        {report ? <div role="status" data-testid="progression-stage4-browser-summary" className={`mt-6 flex items-center gap-3 rounded-md p-4 ${completed ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{completed ? <CheckCircle2/> : <AlertTriangle/>}<div><p className="font-semibold">{report.passed}/{report.total} {completed ? '全部通过' : '存在未通过项'}</p><p className="mt-1 text-xs">正式资源 / Attempt / Profile / 真实分母写入：{report.formalResourceWriteCount} / {report.studentAttemptWriteCount} / {report.studentProfileWriteCount} / {report.realCalibrationDenominatorWriteCount}</p></div></div> : null}
      </section>
      {report ? <section className="mt-6 grid gap-5 md:grid-cols-2" data-testid="progression-stage4-interaction-probes">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold">blocked / stale 原位说明</h2>
          <div className="mt-4 space-y-3">
            {report.governanceStateProbes.map((probe) => <article key={probe.status} data-governance-status={probe.status} className="rounded-md border border-slate-200 p-4"><div className="flex items-center gap-2"><code className="text-xs text-slate-500">{probe.status}</code><strong className="text-sm">{probe.label}</strong></div><p className="mt-2 text-sm leading-6 text-slate-600">{probe.explanation}</p></article>)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5" data-testid="stage4-publication-probe-card">
          <h2 className="text-base font-semibold">发布中唯一动作</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">点击后应只保留一个不可重复点击的进行中按钮。</p>
          <button type="button" data-testid="stage4-publication-probe" disabled={publishingProbe} onClick={() => setPublishingProbe(true)} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-70">
            {publishingProbe ? <><LoaderCircle className="animate-spin" size={17}/>正在发布…</> : '采用并发布'}
          </button>
        </div>
      </section> : null}
      {report ? <section className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white" data-testid="progression-stage4-browser-check-list">{report.checks.map((item) => <article key={item.id} data-check-id={item.id} className="grid gap-3 p-5 md:grid-cols-[88px_220px_minmax(0,1fr)_70px] md:items-center"><code className="text-sm font-semibold text-slate-500">{item.id}</code><h3 className="text-sm font-semibold">{item.title}</h3><p className="text-sm leading-6 text-slate-600">{item.evidence}</p><span className={`rounded-full px-3 py-1 text-center text-xs font-semibold ${item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{item.passed ? 'PASS' : 'FAIL'}</span></article>)}</section> : null}
    </main>
  </div>;
}
