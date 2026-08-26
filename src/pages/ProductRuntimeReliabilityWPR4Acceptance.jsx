import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildProductRuntimeReliabilityWPR4BrowserReport } from '../api/productRuntimeReliabilityWPR4BrowserAcceptance.ts';

export default function ProductRuntimeReliabilityWPR4Acceptance() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/__runtime/health', { method: 'GET', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('runtime_health_unavailable');
        return buildProductRuntimeReliabilityWPR4BrowserReport({ health: await response.json() });
      }).then(setReport).catch(() => setError('WP-R4 只读验收暂时无法执行，Trial 保持关闭。'));
  }, []);
  return <div className="min-h-screen bg-[#f7f9fc] text-slate-950" data-testid="product-runtime-wp-r4-acceptance">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1100px] items-center gap-4 px-5 md:px-8"><Link to="/internal/acceptance" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200" aria-label="返回验收入口"><ArrowLeft size={18}/></Link><div><h1 className="text-lg font-semibold">运行可靠性 WP-R4</h1><p className="text-sm text-slate-500">Trial 重新准入、原子保存与显式激活边界验收</p></div></div></header>
    <main className="mx-auto max-w-[1100px] px-5 py-8 md:px-8"><section className="rounded-lg border border-slate-200 bg-white p-6"><div className="flex items-center gap-2 text-violet-700"><ShieldCheck size={20}/><p className="font-semibold">隔离验收 · 不写正式数据 · 不激活 Trial</p></div>
      <p className="mt-3 text-sm text-slate-600">本页只核对准入边界。即使所有检查通过，也不会保存准入包或执行真实激活。</p>
      {!report && !error ? <p className="mt-5 flex items-center gap-2 text-slate-500"><LoaderCircle className="animate-spin" size={18}/>正在执行 R4-B01—R4-B18…</p> : null}
      {error ? <p role="alert" className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{error}</p> : null}
      {report ? <><div className={`mt-5 flex items-center gap-3 rounded-md p-4 ${report.passed === report.total ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}><CheckCircle2 size={22}/><div><p className="font-semibold">{report.passed}/{report.total} {report.passed === report.total ? '全部通过' : '存在待满足条件'}</p><p className="mt-1 text-sm">当前 Trial：{report.currentEffectiveMode === 'off' ? '关闭' : report.currentEffectiveMode}</p></div></div><div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">{report.checks.map((check) => <article key={check.id} className="grid gap-2 py-4 md:grid-cols-[100px_180px_1fr_70px]"><span className="font-mono text-xs text-slate-500">{check.id}</span><span className="font-medium">{check.name}</span><span className="text-sm text-slate-600">{check.expected}</span><span className={check.passed ? 'text-emerald-700' : 'text-amber-700'}>{check.passed ? 'PASS' : 'WAIT'}</span></article>)}</div></> : null}
    </section></main>
  </div>;
}
