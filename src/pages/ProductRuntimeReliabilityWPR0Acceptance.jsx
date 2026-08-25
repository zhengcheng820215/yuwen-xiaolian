import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FlaskConical, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { runProductRuntimeReliabilityWPR0BrowserAcceptance } from '../api/productRuntimeReliabilityWPR0BrowserAcceptance.ts';

export default function ProductRuntimeReliabilityWPR0Acceptance() {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  async function runMatrix() {
    if (running) return;
    setRunning(true); setError('');
    try { setReport(await runProductRuntimeReliabilityWPR0BrowserAcceptance()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setRunning(false); }
  }

  const completed = Boolean(report && report.passed === report.total);
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8">
        <Link to="/internal/acceptance" aria-label="返回验收入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"><ArrowLeft size={18} /></Link>
        <div><h1 className="text-lg font-semibold">运行可靠性 WP-R0</h1><p className="text-sm text-slate-500">R0-B01—R0-B12 · 运行基线与零写入只读验收</p></div>
      </div></header>
      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8" data-testid="product-runtime-wp-r0-acceptance">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div><div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><ShieldCheck size={16} />Internal Acceptance · Read-only</div><h2 className="mt-3 text-xl font-semibold">当前 Runtime、正式资源与 Trial 身份基线</h2><p className="mt-2 max-w-[760px] text-sm leading-6 text-slate-600">本页只读取现有正式资源边界，不启动服务、不提交答案、不修改 Trial，也不写正式数据。</p></div>
            <button type="button" onClick={runMatrix} disabled={running} data-testid="run-product-runtime-wp-r0-browser-matrix" className="flex min-h-11 min-w-[220px] items-center justify-center gap-2 rounded-md bg-violet-600 px-5 text-sm font-medium text-white disabled:opacity-60">{running ? <><LoaderCircle size={17} className="animate-spin" />正在检查…</> : <><FlaskConical size={17} />执行 R0-B01—R0-B12</>}</button>
          </div>
          {error ? <div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {report ? <div role="status" data-testid="product-runtime-wp-r0-summary" className={`mt-6 flex items-center gap-3 rounded-md p-4 ${completed ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{completed ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}<div><p className="font-semibold">{report.passed}/{report.total} {completed ? '全部通过' : '存在未通过项'}</p><p className="mt-1 text-xs">Formal / Attempt / Evidence / Profile / Calibration / Trial 写入：{report.formalResourceWriteCount} / {report.studentAttemptWriteCount} / {report.evidenceWriteCount} / {report.profileWriteCount} / {report.realCalibrationDenominatorWriteCount} / {report.trialStateWriteCount}</p></div></div> : null}
        </section>
        <section className="mt-6" aria-label="WP-R0 浏览器验收结果">
          <h2 className="text-lg font-semibold">R0-B01—R0-B12</h2>
          {!report ? <p className="mt-4 rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">尚未执行矩阵。</p> : <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white" data-testid="product-runtime-wp-r0-check-list">{report.checks.map((item) => <article key={item.id} data-check-id={item.id} className="grid gap-3 p-5 md:grid-cols-[88px_220px_minmax(0,1fr)_70px] md:items-center"><code className="text-sm font-semibold text-slate-500">{item.id}</code><h3 className="text-sm font-semibold">{item.title}</h3><p className="text-sm leading-6 text-slate-600">{item.evidence}</p><span className={`justify-self-start rounded-full px-3 py-1 text-xs font-semibold md:justify-self-end ${item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{item.passed ? 'PASS' : 'FAIL'}</span></article>)}</div>}
        </section>
      </main>
    </div>
  );
}
