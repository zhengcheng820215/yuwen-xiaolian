import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert, Database, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { closeLegacyProductComplexityConvergenceTrialForReentry,
  loadProductComplexityConvergencePreflightStatus } from
  '../api/productComplexityConvergenceStage4Preflight.ts';
import { confirmAndActivateRealTrialReentry, prepareRealTrialReentry,
  saveRealTrialReentryBundle } from '../api/productRuntimeTrialReentryOperator.ts';

export default function ProductComplexityConvergenceStage4Preflight() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const [prepared, setPrepared] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [running, setRunning] = useState(false);
  const [confirmActivation, setConfirmActivation] = useState(false);
  const [activationResult, setActivationResult] = useState(null);
  useEffect(() => {
    let active = true;
    loadProductComplexityConvergencePreflightStatus()
      .then((value) => active && setStatus(value))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { active = false; };
  }, []);
  const ready = Boolean(status?.registryReady);
  const trialStarted = Boolean(status?.realTrialStarted);
  const reentryActive = trialStarted
    && status?.activationStateVersion === 'product_complexity_convergence_stage4_activation_state_v2';
  const needsLegacyCleanup = !reentryActive
    && (trialStarted || status?.latestWindow?.status === 'active');
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
  async function runPreflight() {
    setRunning(true); setError(''); setPrepared(null); setBundle(null); setActivationResult(null);
    try {
      setPrepared(await prepareRealTrialReentry({
        participatingStudentIds: ['student-local-primary-v1'],
        timezone: 'Asia/Shanghai',
        plannedDays: 14,
      }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setRunning(false); }
  }
  async function saveBundle() {
    if (!prepared) return;
    setRunning(true); setError('');
    try { setBundle(await saveRealTrialReentryBundle(prepared)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setRunning(false); }
  }
  async function activateTrial() {
    if (!prepared || !bundle || !confirmActivation) return;
    setRunning(true); setError('');
    try {
      const result = await confirmAndActivateRealTrialReentry(prepared);
      setActivationResult(result);
      setStatus(await loadProductComplexityConvergencePreflightStatus());
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setRunning(false); }
  }
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8"><Link to="/internal" aria-label="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"><ArrowLeft size={18} /></Link><div><h1 className="text-lg font-semibold">{trialStarted ? '真实 Trial 运行状态' : '真实 Trial 启动前预检'}</h1><p className="text-sm text-slate-500">Internal 操作边界 · R4 v2 准入与显式激活</p></div></div></header>
      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><ShieldCheck size={16} />启动控制面</div>
          <h2 className="mt-3 text-xl font-semibold">{trialStarted ? 'Observation 已在限定范围内运行' : 'Observation 默认保持关闭'}</h2>
          <p className="mt-3 max-w-[820px] text-sm leading-6 text-slate-600">{trialStarted
            ? '当前只观察已签署学生在真实 Learning 中产生的结构化 Owner Fact；观察失败不会阻断学习，也不会自动改变产品能力。'
            : '先执行 24 项只读检查，再原子保存准入包；只有操作者显式确认后才会激活。任何门禁失败都保持关闭，Learning 始终沿用旧主链。'}</p>
          {needsLegacyCleanup ? <div className="mt-5"><button type="button" disabled={closing}
            onClick={closeLegacyTrial}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 disabled:cursor-wait disabled:opacity-60">
            {closing ? '正在安全关闭…' : '关闭旧 Trial，准备重新准入'}
          </button><p className="mt-2 text-xs leading-5 text-slate-500">使当前观察控制状态回落关闭，并将旧活动 Window 标记为已失效；历史 Window、审计和 Observation 均保留，不会删除。</p></div> : null}
          {error ? <p role="alert" className="mt-5 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        </section>
        {!trialStarted && !needsLegacyCleanup ? <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 md:p-8" data-testid="real-trial-reentry-operator">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">R4 真实准入</h2><p className="mt-1 text-sm text-slate-500">签署学生：student-local-primary-v1 · 计划 14 天 · Asia/Shanghai</p></div>
            <button type="button" disabled={running || Boolean(bundle)} onClick={runPreflight}
              className="rounded-md border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50">{running && !prepared ? '正在检查…' : '执行 R4-P01—P24'}</button></div>
          {prepared ? <div className={`mt-5 rounded-md p-4 ${prepared.report.eligibleForActivation ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <p className="font-semibold">{prepared.report.checkResults.filter((item) => item.status === 'passed').length} / 24 PASS</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{prepared.report.checkResults.map((item) => <div key={item.checkId} className="text-xs"><span className="font-semibold">{item.checkId}</span> · {item.status}</div>)}</div>
            {prepared.report.issueCodes.length ? <p className="mt-3 text-sm text-amber-800">{prepared.report.issueCodes.join(' · ')}</p> : null}
          </div> : null}
          {prepared?.report.eligibleForActivation && !bundle ? <button type="button" disabled={running} onClick={saveBundle}
            className="mt-5 rounded-md bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">保存准入包</button> : null}
          {bundle ? <div className="mt-5 rounded-md border border-slate-200 p-4"><p className="font-semibold">准入包已{bundle.status === 'duplicate' ? '确认' : '保存'}，Trial 仍为 off</p><p className="mt-2 break-all text-xs text-slate-500">Window {bundle.trialWindowId}<br/>Launch {bundle.launchRecordId}<br/>Binding {bundle.runtimeIdentityBindingId}</p>
            <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmActivation} onChange={(event) => setConfirmActivation(event.target.checked)} className="mt-1"/><span>我确认激活当前准入包；激活不会创建 Session、Attempt、Diagnosis、Evidence 或 Observation。</span></label>
            <button type="button" disabled={running || !confirmActivation} onClick={activateTrial}
              className="mt-4 rounded-md bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">显式激活真实 Trial</button>
          </div> : null}
          {activationResult ? <p className={`mt-5 rounded-md p-4 text-sm ${activationResult.effectiveMode === 'real_trial' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{activationResult.status} · {activationResult.effectiveMode} · {activationResult.reasonCodes.join(' · ')}</p> : null}
        </section> : null}
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
