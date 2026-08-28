import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FlaskConical, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { runRubricAlignedFeedbackStage4BrowserAcceptance } from
  '../api/rubricAlignedFeedbackStage4BrowserAcceptance.ts';

const STORAGE_KEY = 'rubric-aligned-feedback-stage4-browser-acceptance:v1';

export default function RubricAlignedFeedbackStage4BrowserAcceptance() {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setReport(JSON.parse(saved));
    } catch { sessionStorage.removeItem(STORAGE_KEY); }
  }, []);

  async function runMatrix() {
    if (running) return;
    setRunning(true); setError('');
    try {
      const next = await runRubricAlignedFeedbackStage4BrowserAcceptance();
      setReport(next); sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setRunning(false); }
  }

  const complete = Boolean(report && report.passed === 16
    && Object.values(report.protectedWriteCounts).every((count) => count === 0));
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8">
          <Link to="/internal/acceptance" aria-label="返回验收入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"><ArrowLeft size={18} /></Link>
          <div><h1 className="text-lg font-semibold">Rubric 对齐反馈阶段 4</h1><p className="text-sm text-slate-500">RF4-B01—RF4-B16 · 真实 Trial 隔离联调</p></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8" data-testid="rubric-aligned-feedback-stage4-acceptance">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><ShieldCheck size={16} />Internal Acceptance · 不激活真实 Trial</div>
              <h2 className="mt-3 text-xl font-semibold">限定激活、连续学习与观察边界验收</h2>
              <p className="mt-2 max-w-[780px] text-sm leading-6 text-slate-600">验证 scope、Runtime Identity、正式资源版本、单选分流、Revision、固定题组、恢复、熔断与真实分母隔离。所有作答均为内存 Fixture。</p>
            </div>
            <button type="button" onClick={runMatrix} disabled={running} data-testid="run-rubric-aligned-feedback-stage4-browser-matrix" className="flex min-h-11 min-w-[230px] items-center justify-center gap-2 rounded-md bg-violet-600 px-5 text-sm font-medium text-white disabled:opacity-60">
              {running ? <><LoaderCircle size={17} className="animate-spin" />正在执行…</> : <><FlaskConical size={17} />执行 RF4-B01—B16</>}
            </button>
          </div>
          {error ? <div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {report ? <div role="status" data-testid="rubric-aligned-feedback-stage4-browser-summary" className={`mt-6 flex items-center gap-3 rounded-md p-4 ${complete ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {complete ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            <div><p className="font-semibold">{report.passed}/{report.total} {complete ? '全部通过' : '存在未通过项'}</p><p className="mt-1 text-xs">默认 {report.surfaceDefault}；正式 Revision {report.formalResourceRevisionBefore ?? '不可读'} → {report.formalResourceRevisionAfter ?? '不可读'}；保护写入 {Object.values(report.protectedWriteCounts).join(' / ')}</p></div>
          </div> : null}
        </section>
        <section className="mt-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">浏览器联调结果</h2>{report ? <button type="button" onClick={runMatrix} disabled={running} className="flex items-center gap-2 text-sm text-violet-700"><RefreshCw size={15} />重新执行</button> : null}</div>
          {!report ? <p className="mt-4 rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">尚未执行矩阵。</p> : <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white" data-testid="rubric-aligned-feedback-stage4-browser-check-list">
            {report.checks.map((item) => <article key={item.id} data-check-id={item.id} className="grid gap-3 p-5 md:grid-cols-[92px_220px_minmax(0,1fr)_70px] md:items-center"><code className="text-sm font-semibold text-slate-500">{item.id}</code><h3 className="text-sm font-semibold">{item.title}</h3><p className="text-sm leading-6 text-slate-600">{item.evidence}</p><span className={`justify-self-start rounded-full px-3 py-1 text-xs font-semibold md:justify-self-end ${item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{item.passed ? 'PASS' : 'FAIL'}</span></article>)}
          </div>}
        </section>
      </main>
    </div>
  );
}
