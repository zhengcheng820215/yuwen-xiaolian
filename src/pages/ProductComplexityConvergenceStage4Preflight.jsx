import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert, Database, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { closeLegacyProductComplexityConvergenceTrialForReentry,
  loadProductComplexityConvergencePreflightStatus } from
  '../api/productComplexityConvergenceStage4Preflight.ts';

export default function ProductComplexityConvergenceStage4Preflight() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    let active = true;
    loadProductComplexityConvergencePreflightStatus()
      .then((value) => active && setStatus(value))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { active = false; };
  }, []);
  const ready = Boolean(status?.registryReady);
  const trialStarted = Boolean(status?.realTrialStarted);
  const needsLegacyCleanup = trialStarted || status?.latestWindow?.status === 'active';
  async function closeLegacyTrial() {
    setClosing(true);
    setError('');
    try {
      await closeLegacyProductComplexityConvergenceTrialForReentry(
        'wp_r4_reentry_legacy_identity_replaced',
      );
      setStatus(await loadProductComplexityConvergencePreflightStatus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setClosing(false);
    }
  }
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8"><Link to="/internal" aria-label="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"><ArrowLeft size={18} /></Link><div><h1 className="text-lg font-semibold">{trialStarted ? '真实 Trial 运行状态' : '真实 Trial 启动前预检'}</h1><p className="text-sm text-slate-500">内部状态 · 不提供激活操作</p></div></div></header>
      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><ShieldCheck size={16} />启动控制面</div>
          <h2 className="mt-3 text-xl font-semibold">{trialStarted ? 'Observation 已在限定范围内运行' : 'Observation 默认保持关闭'}</h2>
          <p className="mt-3 max-w-[820px] text-sm leading-6 text-slate-600">{trialStarted
            ? '当前只观察已签署学生在真实 Learning 中产生的结构化 Owner Fact；观察失败不会阻断学习，也不会自动改变产品能力。'
            : '此页只读取 Registry、预检、Launch 与激活审计，不创建正式事实，也不提供 real_trial 激活操作。完整预检签署前，Learning 始终沿用旧主链。'}</p>
          {needsLegacyCleanup ? <div className="mt-5"><button type="button" disabled={closing}
            onClick={closeLegacyTrial}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 disabled:cursor-wait disabled:opacity-60">
            {closing ? '正在安全关闭…' : '关闭旧 Trial，准备重新准入'}
          </button><p className="mt-2 text-xs leading-5 text-slate-500">使当前观察控制状态回落关闭，并将旧活动 Window 标记为已失效；历史 Window、审计和 Observation 均保留，不会删除。</p></div> : null}
          {error ? <p role="alert" className="mt-5 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-4" aria-live="polite">
          <StatusCard label="请求模式" value={status?.requestedMode || '读取中'} />
          <StatusCard label="生效模式" value={status?.effectiveMode || '读取中'} />
          <StatusCard label="正式 Adapter" value={status ? `${status.realTrialEnabledCapabilityCount} / 8` : '读取中'} />
          <StatusCard label="真实 Trial" value={status?.realTrialStarted ? '已启动' : '尚未启动'} />
        </section>
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-3">
            {ready ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={20} /> : <CircleAlert className="mt-0.5 text-amber-600" size={20} />}
            <div><h2 className="font-semibold">Source Registry</h2><p className="mt-2 text-sm leading-6 text-slate-600">{ready
              ? trialStarted
                ? `已登记并启用 ${status.realTrialEnabledCapabilityCount} 项正式来源，全部保持 observe_only。`
                : `已登记 ${status.registeredCapabilityCount} 项正式来源；仅表示接线契约完整，不等于允许启动。`
              : `当前存在阻断：${status?.registryIssues?.join('、') || '正在读取'}`}</p></div>
          </div>
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <StatusCard label="Preflight Report" value={status?.latestReport ? (status.latestReport.eligibleForActivation ? '检查通过' : '未通过') : '尚未生成'} />
          <StatusCard label="Launch Record" value={status?.latestLaunch?.status || '尚未生成'} />
          <StatusCard label="Activation Audit" value={status ? `${status.activationAuditCount} 条` : '读取中'} icon />
          <StatusCard label="Observation Event" value={status ? `${status.observationEventCount} 条` : '读取中'} />
        </section>
      </main>
    </div>
  );
}

function StatusCard({ label, value, icon = false }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-5">{icon ? <Database size={17} className="text-slate-500" /> : null}<p className={`${icon ? 'mt-3 ' : ''}text-xs font-semibold text-slate-500`}>{label}</p><p className="mt-1 break-words text-base font-semibold text-slate-900">{value}</p></article>;
}
