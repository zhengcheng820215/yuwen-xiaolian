import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildProductRuntimeReliabilityWPR3BrowserReport } from '../api/productRuntimeReliabilityWPR3BrowserAcceptance.ts';

export default function ProductRuntimeReliabilityWPR3Acceptance() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/__runtime/health', { method: 'GET', cache: 'no-store' })
      .then(async (response) => buildProductRuntimeReliabilityWPR3BrowserReport({ health: await response.json() }))
      .then(setReport).catch(() => setError('Runtime Identity 只读验收暂时无法执行。'));
  }, []);
  return <div className="min-h-screen bg-[#f7f9fc] text-slate-950" data-testid="product-runtime-wp-r3-acceptance">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1100px] items-center gap-4 px-5 md:px-8"><Link to="/internal/acceptance" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200" aria-label="返回验收入口"><ArrowLeft size={18}/></Link><div><h1 className="text-lg font-semibold">运行可靠性 WP-R3</h1><p className="text-sm text-slate-500">Runtime Identity 与 Trial 自动失效只读验收</p></div></div></header>
    <main className="mx-auto max-w-[1100px] px-5 py-8 md:px-8"><section className="rounded-lg border border-slate-200 bg-white p-6"><div className="flex items-center gap-2 text-violet-700"><ShieldAlert size={20}/><p className="font-semibold">隔离验收 · 不写正式数据 · 不激活 Trial</p></div>
      {!report && !error ? <p className="mt-5 flex items-center gap-2 text-slate-500"><LoaderCircle className="animate-spin" size={18}/>正在执行 R3-B01—R3-B16…</p> : null}
      {error ? <p role="alert" className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{error}</p> : null}
      {report ? <><div className={`mt-5 flex items-center gap-3 rounded-md p-4 ${report.passed === report.total ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}><CheckCircle2 size={22}/><p className="font-semibold">{report.passed}/{report.total} {report.passed === report.total ? '全部通过' : '存在未通过项'}</p></div><div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">{report.checks.map((check) => <article key={check.id} className="grid gap-2 py-4 md:grid-cols-[100px_180px_1fr_70px]"><span className="font-mono text-xs text-slate-500">{check.id}</span><span className="font-medium">{check.name}</span><span className="text-sm text-slate-600">{check.expected}</span><span className={check.passed ? 'text-emerald-700' : 'text-red-700'}>{check.passed ? 'PASS' : 'FAIL'}</span></article>)}</div></> : null}
    </section></main>
  </div>;
}
