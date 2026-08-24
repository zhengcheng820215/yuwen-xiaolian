import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FlaskConical, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { runProductComplexityConvergenceStage2BrowserAcceptance } from '../api/productComplexityConvergenceStage2BrowserAcceptance.ts';

const STORAGE_KEY = 'product-complexity-convergence-stage2-browser-acceptance:v1';

export default function ProductComplexityConvergenceStage2BrowserAcceptance() {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try { const saved = window.sessionStorage.getItem(STORAGE_KEY); if (saved) setReport(JSON.parse(saved)); }
    catch { window.sessionStorage.removeItem(STORAGE_KEY); }
  }, []);
  async function runMatrix() {
    if (running) return;
    setRunning(true); setError('');
    try {
      const next = await runProductComplexityConvergenceStage2BrowserAcceptance();
      setReport(next); window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setRunning(false); }
  }
  const completed = Boolean(report && report.passed === report.total);
  return <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8"><Link to="/internal/acceptance" aria-label="返回验收入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"><ArrowLeft size={18} /></Link><div><h1 className="text-lg font-semibold">产品复杂度收口阶段 2</h1><p className="text-sm text-slate-500">B2-01—B2-18 · 条件能力策略收口</p></div></div></header>
    <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
      <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8" data-testid="product-complexity-stage2-acceptance"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><ShieldCheck size={16} />Internal Acceptance · 隔离审计仓</div><h2 className="mt-3 text-xl font-semibold">Revision / Targeted / Retest / Transfer 条件策略验收</h2><p className="mt-2 max-w-[760px] text-sm leading-6 text-slate-600">验证 Legacy、Shadow、单项 Enforced、Session 冻结、幂等和核心链回退；不写正式资源、作答、证据、画像或真实校准分母。</p></div><button type="button" onClick={runMatrix} disabled={running} data-testid="run-product-complexity-stage2-browser-matrix" className="flex min-h-11 min-w-[220px] items-center justify-center gap-2 rounded-md bg-violet-600 px-5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60">{running ? <><LoaderCircle size={17} className="animate-spin" />正在执行…</> : <><FlaskConical size={17} />执行 B2-01—B2-18</>}</button></div>
        {error ? <div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {report ? <div role="status" aria-live="polite" data-testid="product-complexity-stage2-browser-summary" className={`mt-6 flex items-center gap-3 rounded-md p-4 ${completed ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{completed ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}<div><p className="font-semibold">{report.passed}/{report.total} {completed ? '全部通过' : '存在未通过项'}</p><p className="mt-1 text-xs">隔离审计投影 {report.auditProjectionCount} 条；正式资源 / Attempt / Evidence / Profile / 真实分母写入：{report.formalResourceWriteCount} / {report.studentAttemptWriteCount} / {report.evidenceWriteCount} / {report.studentProfileWriteCount} / {report.realCalibrationDenominatorWriteCount}</p></div></div> : null}
      </section>
      <section className="mt-6" aria-label="B2 浏览器联调结果"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">B2-01—B2-18 结果</h2>{report ? <button type="button" onClick={runMatrix} disabled={running} className="flex items-center gap-2 text-sm text-violet-700"><RefreshCw size={15} />重新执行</button> : null}</div>{!report ? <p className="mt-4 rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">尚未执行矩阵。</p> : <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white" data-testid="product-complexity-stage2-browser-check-list">{report.checks.map((item) => <article key={item.id} data-check-id={item.id} className="grid gap-3 p-5 md:grid-cols-[88px_220px_minmax(0,1fr)_70px] md:items-center"><code className="text-sm font-semibold text-slate-500">{item.id}</code><h3 className="text-sm font-semibold">{item.title}</h3><p className="text-sm leading-6 text-slate-600">{item.evidence}</p><span className={`justify-self-start rounded-full px-3 py-1 text-xs font-semibold md:justify-self-end ${item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{item.passed ? 'PASS' : 'FAIL'}</span></article>)}</div>}</section>
    </main>
  </div>;
}
