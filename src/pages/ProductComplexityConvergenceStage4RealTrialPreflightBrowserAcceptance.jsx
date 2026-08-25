import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { runProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance } from
  '../api/productComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance.ts';

export default function ProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    runProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance()
      .then((value) => active && setReport(value))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { active = false; };
  }, []);
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8"><Link to="/internal/acceptance" aria-label="返回验收入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"><ArrowLeft size={18} /></Link><div><h1 className="text-lg font-semibold">真实 Trial 启动前浏览器验收</h1><p className="text-sm text-slate-500">PF-B01—PF-B20 · 隔离内存 · 正式写入为 0</p></div></div></header>
      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><FlaskConical size={16} />确定性预检矩阵</div>
          <h2 className="mt-3 text-xl font-semibold">{report ? `${report.passed} / ${report.total} PASS` : '正在执行检查'}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">该页面不调用正式保存或发布接口，不生成真实 Owner Fact，也不能激活 real_trial。</p>
          {error ? <p role="alert" className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        </section>
        <section className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white" aria-live="polite">
          {report?.checks.map((check) => <article key={check.id} className="flex items-start gap-3 p-5">{check.passed ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={19} className="mt-0.5 shrink-0 text-red-600" />}<div><p className="text-sm font-semibold">{check.id} · {check.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{check.evidence}</p></div></article>)}
        </section>
      </main>
    </div>
  );
}
