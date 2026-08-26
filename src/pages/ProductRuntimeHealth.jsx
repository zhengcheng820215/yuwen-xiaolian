import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProductRuntimeHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  async function refresh() {
    setError('');
    try {
      const response = await fetch('/__runtime/health', { method: 'GET', cache: 'no-store' });
      setHealth(await response.json());
    } catch { setError('Runtime Health 暂时不可读取。'); }
  }
  useEffect(() => { refresh(); }, []);
  const domains = health ? [
    ['Runtime', health.instance.runtimeStatus, health.instance.reasonCodes],
    ['Formal Store', health.formalResourceStore.status, health.formalResourceStore.reasonCodes],
    ['AI Provider', health.aiProvider.status, health.aiProvider.reasonCodes],
    ['Learning', health.learning.status, health.learning.reasonCodes],
    ['Trial', health.trial.identityStatus, health.trial.reasonCodes],
  ] : [];
  return <div className="min-h-screen bg-[#f7f9fc] text-slate-950" data-testid="product-runtime-health-page">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1100px] items-center gap-4 px-5 md:px-8"><Link to="/internal" aria-label="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200"><ArrowLeft size={18}/></Link><div><h1 className="text-lg font-semibold">Runtime Health</h1><p className="text-sm text-slate-500">只读运行状态，不提供修复或激活动作</p></div></div></header>
    <main className="mx-auto max-w-[1100px] px-5 py-8 md:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-2"><Activity className="text-emerald-600" size={20}/><h2 className="text-xl font-semibold">产品运行状态</h2></div><button type="button" onClick={refresh} className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700">只读刷新</button></div>
        {error ? <div role="alert" className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{error}</div> : null}
        {!health && !error ? <div className="mt-5 flex items-center gap-2 text-slate-500"><LoaderCircle className="animate-spin" size={18}/>正在读取…</div> : null}
        {health ? <><div data-testid="runtime-health-overall" className={`mt-5 flex items-center gap-3 rounded-md p-4 ${health.overallStatus === 'blocked' ? 'bg-red-50 text-red-800' : health.overallStatus === 'degraded' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{health.overallStatus === 'ready' ? <CheckCircle2 size={22}/> : <AlertTriangle size={22}/>}<div><p className="font-semibold">{health.overallStatus}</p><p className="text-xs">{health.summaryReasonCodes.join(' · ') || '核心依赖全部通过'}</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{domains.map(([name,status,reasons]) => <article key={name} className="rounded-md border border-slate-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</p><p className="mt-2 font-semibold">{status}</p><p className="mt-1 text-xs text-slate-500">{reasons.join(' · ') || '无 Reason Code'}</p></article>)}</div><div className="mt-5 rounded-md bg-slate-50 p-4 text-xs leading-6 text-slate-600"><p>Store Revision：{health.formalResourceStore.revision ?? '不可用'}</p><p>材料 / Current Question / 可消费：{health.formalResourceStore.activeMaterialCount ?? '-'} / {health.formalResourceStore.currentQuestionCount ?? '-'} / {health.formalResourceStore.learningConsumableQuestionCount ?? '-'}</p><p>AI 验证级别：{health.aiProvider.verificationLevel}</p><p>AI 可用性已验证：{health.aiProvider.availabilityVerified ? '是' : '否'}</p><p>真实 Trial 可进入：{health.aiProvider.trialEligible ? '是' : '否'}</p><p>Fact Digest：{health.factDigest}</p><p>Checked At：{health.checkedAt}</p></div></> : null}
      </section>
    </main>
  </div>;
}
