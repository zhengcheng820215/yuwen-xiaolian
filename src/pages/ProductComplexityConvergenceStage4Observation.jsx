import { useEffect, useState } from 'react';
import { ArrowLeft, Database, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadProductComplexityConvergenceStage4Observation } from '../api/productComplexityConvergenceStage4Observation.ts';

export default function ProductComplexityConvergenceStage4Observation() {
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadProductComplexityConvergenceStage4Observation()
      .then((value) => active && setView(value))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { active = false; };
  }, []);
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8"><Link to="/internal" aria-label="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"><ArrowLeft size={18} /></Link><div><h1 className="text-lg font-semibold">复杂能力稳定试用观察</h1><p className="text-sm text-slate-500">内部只读 · 不参与学习决策</p></div></div></header>
      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><ShieldCheck size={16} />Stage 4 Observation</div>
          <h2 className="mt-3 text-xl font-semibold">真实试用尚未自动启动</h2>
          <p className="mt-3 max-w-[780px] text-sm leading-6 text-slate-600">生产观察默认关闭。只有显式激活 14—28 日试用窗口后，准入的 real_learning 结构化事件才会进入真实分母；Debug 与浏览器验收始终排除。</p>
          {error ? <p role="alert" className="mt-5 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-3" aria-live="polite">
          <article className="rounded-lg border border-slate-200 bg-white p-5"><Database size={18} className="text-slate-500" /><p className="mt-3 text-xs font-semibold text-slate-500">观察模式</p><p className="mt-1 text-lg font-semibold">{view?.mode || '读取中'}</p></article>
          <article className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">当前窗口</p><p className="mt-1 text-lg font-semibold">{view?.latestWindow?.trialWindowId || '未启动'}</p><p className="mt-2 text-sm text-slate-600">{view?.latestWindow ? view.latestWindow.status : '没有真实试用窗口'}</p></article>
          <article className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">结构化观察</p><p className="mt-1 text-lg font-semibold">{view?.eventCount ?? 0}</p><p className="mt-2 text-sm text-slate-600">不保存学生回答、材料或题目正文</p></article>
        </section>
        {view?.latestSnapshot ? <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">最新聚合快照</h2><p className="mt-2 text-sm text-slate-600">真实准入 {view.latestSnapshot.admittedEventCount} 条 · 能力聚合 {view.latestSnapshot.aggregates.length} 组 · 提案 {view.proposals.length} 个</p></section> : null}
      </main>
    </div>
  );
}
