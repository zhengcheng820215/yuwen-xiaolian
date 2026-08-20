import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  importTargetedMicroTrainingPack,
  exportTargetedMicroTrainingStage4CalibrationSnapshot,
  loadTargetedMicroTrainingStage4ControlView,
  pauseTargetedMicroTrainingStage4,
  prepareTargetedMicroTrainingControlledPack,
  retryTargetedMicroTrainingStage4Outbox,
  rollbackTargetedMicroTrainingStage4,
  setTargetedMicroTrainingStage4Mode,
} from '../api/targetedMicroTrainingStage4.ts';

const metricLabels = {
  triggerRate: '触发率', matchRate: '匹配率', startRate: '开始率', completionRate: '完成率',
  skipRate: '跳过率', unavailableRate: '资源失效率', coreReturnRate: '返回核心题组',
  immediateResolutionRate: '即时完成', followUpCoverageRate: '后续观察覆盖',
  sameGapRecurrenceRate: '同类缺口再现', sessionExitRate: '学习退出',
};

export default function TargetedMicroTrainingStage4Control() {
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [controlledStudentId, setControlledStudentId] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setView(await loadTargetedMicroTrainingStage4ControlView()); }
    catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (operation, success) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await operation(); setNotice(success); setView(await loadTargetedMicroTrainingStage4ControlView()); }
    catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  };

  const snapshot = view?.snapshot;
  const projection = view?.projection;
  const manifest = view?.activeManifest;
  const packAudit = view?.packAudit;
  const confirmRun = (prompt, operation, success) => {
    if (window.confirm(prompt)) run(operation, success);
  };
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <Link to="/internal" aria-label="返回内部入口"><ArrowLeft size={19} /></Link>
            <h1 className="text-lg font-semibold">针对性微训练控制与校准</h1>
          </div>
          <button type="button" onClick={load} disabled={busy} className="flex items-center gap-2 text-sm text-emerald-700">
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />刷新
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1208px] px-5 py-8 md:px-8">
        {error ? <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p> : null}

        <section className="rounded-md border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">当前启用状态</p>
              <h2 className="mt-1 text-xl font-semibold">{modeText(snapshot?.enablement.mode)}</h2>
              <p className="mt-2 text-sm text-slate-600">默认关闭；隔离验证不会进入真实效果样本。</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{manifest ? `${manifest.packVersion} · ${manifest.status}` : '尚未准备资源包'}</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Action disabled={busy} onClick={() => run(() => prepareTargetedMicroTrainingControlledPack(), '受控资源包已准备。')}>准备资源包</Action>
            <Action disabled={busy} onClick={() => confirmRun('将 12 篇受控短片段和 18 道冻结题目导入正式资源仓。确认继续吗？', () => importTargetedMicroTrainingPack(), '受控资源包已导入。')}>导入资源包</Action>
            <Action disabled={busy} onClick={() => confirmRun('隔离验证只对带验证参数的隔离身份生效，不进入真实效果样本。确认启用吗？', () => setTargetedMicroTrainingStage4Mode({ mode: 'isolated_verify' }), '已进入隔离验证模式。')}>启用隔离验证</Action>
            <Action disabled={busy} onClick={() => confirmRun('暂停后不会再创建新的微训练，当前学习记录仍保留。确认暂停吗？', () => pauseTargetedMicroTrainingStage4(), '已暂停新微训练调度。')}>暂停调度</Action>
            <Action disabled={busy} onClick={() => confirmRun('只会补写失败的脱敏运行事件，不会重复提交学生作答。确认重试吗？', () => retryTargetedMicroTrainingStage4Outbox(), '已重试事件补写。')}>重试事件补写</Action>
            <Action danger disabled={busy} onClick={() => {
              if (window.confirm('回滚将停止该资源包后续匹配，但会保留历史学习记录。确认继续吗？')) {
                run(() => rollbackTargetedMicroTrainingStage4(), '受控资源包已回滚，历史记录已保留。');
              }
            }}>回滚资源包</Action>
          </div>
          <div className="mt-5 max-w-xl rounded-md bg-slate-50 p-4">
            <label className="text-sm font-medium text-slate-800" htmlFor="controlled-student-id">固定观察学生标识</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input id="controlled-student-id" value={controlledStudentId} onChange={(event) => setControlledStudentId(event.target.value)} placeholder="输入已批准的固定学生标识" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
              <Action disabled={busy || !controlledStudentId.trim()} onClick={() => confirmRun(`仅学生“${controlledStudentId.trim()}”会进入受控观察，其他学生保持基线。确认开始吗？`, () => setTargetedMicroTrainingStage4Mode({ mode: 'controlled_single_learner', controlledStudentId: controlledStudentId.trim(), reason: 'start_controlled_single_learner_window' }), '已开始固定单学生受控观察。')}>开始单学生观察</Action>
            </div>
            <p className="mt-2 text-xs text-slate-500">该操作只改变调度范围，不会自动改题、改策略或形成效果结论。</p>
          </div>
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold">受控资源包完整性</h2>
          <p className={`mt-2 text-sm ${packAudit?.passed ? 'text-emerald-700' : 'text-amber-800'}`}>{packAudit?.passed ? 'Material、Frozen Version、Registry Head 与四类缺口覆盖一致。' : '资源包尚未完整导入或存在身份错位。'}</p>
          <p className="mt-2 text-xs text-slate-500">材料 {packAudit?.materialCount ?? 0}/12 · 冻结题目 {packAudit?.frozenResourceCount ?? 0}/18 · 活动 Registry {packAudit?.activeRegistryCount ?? 0}/18</p>
          {packAudit?.issues?.length ? <div className="mt-3 space-y-1">{packAudit.issues.map((issue) => <p key={issue} className="text-sm text-amber-800">{issue}</p>)}</div> : null}
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-700" /><h2 className="text-base font-semibold">运行完整性</h2></div>
          <p className="mt-2 text-sm text-slate-600">{integrityText(projection?.integrityStatus)}。所有指标同时展示分子和分母；暂无数据时不估算百分比。</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {projection ? Object.entries(projection.metrics).map(([key, metric]) => (
              <div key={key} className="rounded-md bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{metricLabels[key] || key}</p>
                <p className="mt-1 text-lg font-semibold">{metric.status === 'available' ? `${Math.round(metric.rate * 100)}%` : '暂不可用'}</p>
                <p className="mt-1 text-xs text-slate-500">{metric.numerator}/{metric.denominator}</p>
              </div>
            )) : null}
          </div>
          {projection?.breakdowns?.length ? <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="px-3 py-2">分层</th><th className="px-3 py-2">值</th><th className="px-3 py-2">呈现</th><th className="px-3 py-2">完成</th><th className="px-3 py-2">有效后测</th><th className="px-3 py-2">同类再现</th></tr></thead>
              <tbody>{projection.breakdowns.map((item) => <tr key={`${item.dimension}-${item.value}`} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-500">{item.dimension}</td><td className="px-3 py-2">{item.value}</td><td className="px-3 py-2">{item.presented}</td><td className="px-3 py-2">{item.completed}</td><td className="px-3 py-2">{item.qualifiedFollowUps}</td><td className="px-3 py-2">{item.sameGapRecurrences}</td></tr>)}</tbody>
            </table>
          </div> : null}
          {projection?.issues.length ? <div className="mt-5 space-y-2">{projection.issues.map((issue) => <p key={`${issue.code}-${issue.identity || ''}`} className={`rounded-md p-3 text-sm ${issue.severity === 'fail' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{issue.message}</p>)}</div> : null}
          <div className="mt-5">
            <Action disabled={busy} onClick={() => run(async () => {
              const exported = await exportTargetedMicroTrainingStage4CalibrationSnapshot();
              downloadJson(exported, `targeted-micro-training-calibration-${new Date().toISOString().slice(0, 10)}.json`);
            }, '脱敏校准快照已导出。')}>导出脱敏校准快照</Action>
          </div>
        </section>
      </main>
    </div>
  );
}

function Action({ children, disabled, onClick, danger = false }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 ${danger ? 'border-red-200 text-red-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{children}</button>;
}
function message(error) { return error instanceof Error ? error.message : String(error); }
function modeText(mode) { return ({ disabled: '已关闭', isolated_verify: '隔离验证', controlled_single_learner: '单学生受控观察', paused: '已暂停' })[mode] || '正在读取'; }
function integrityText(status) { return ({ pass: '链路完整', warning: '存在需要留意的问题', fail: '存在阻断性完整性问题', awaiting_data: '尚无运行数据' })[status] || '正在读取'; }
function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
