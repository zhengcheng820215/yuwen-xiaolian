import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Database,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  getPhase163MultiDayDemoCases,
  runPhase163MultiDayOperationDemo,
} from '../api/phase163MultiDayOperationDemo.ts';

const cases = getPhase163MultiDayDemoCases();

export default function Phase163MultiDayOperationDemo() {
  const navigate = useNavigate();
  const [caseId, setCaseId] = useState(cases[0].id);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const selectedCase = useMemo(() => cases.find((item) => item.id === caseId) || cases[0], [caseId]);
  const caseResult = result?.cases[caseId];

  useEffect(() => {
    let active = true;
    runPhase163MultiDayOperationDemo()
      .then((value) => active && setResult(value))
      .catch((runError) => active && setError(runError instanceof Error ? runError.message : String(runError)))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center gap-4 px-5 lg:px-10">
          <button
            type="button"
            aria-label="返回首页"
            title="返回首页"
            onClick={() => navigate('/')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold">多日连续学习验收</h1>
              <span className="text-sm font-semibold text-blue-600">Phase 16.3C</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">多 Session、恢复、延迟复测与异常阻断</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10 lg:py-8">
        <section className="border-b border-slate-200 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-blue-600">轻量人工验收</p>
            <span className="rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">受控模拟，不计入自然日</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold">确认多日运行可以连续、恢复，并在异常时安全停止</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            本页运行正式 Frozen Resource、16.3A Orchestrator、Session History、Delayed Retest 与 16.3C Acceptance Agent；使用 Scripted Provider 和内存 Repository，不调用 DeepSeek，也不写入正式自然日记录。
          </p>
        </section>

        <section className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="多日验收 Case">
          {cases.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-case-id={item.id}
              onClick={() => setCaseId(item.id)}
              className={[
                'flex min-h-[64px] items-center gap-3 rounded-md border px-3 py-3 text-left transition',
                item.id === caseId
                  ? 'border-blue-500 bg-blue-50 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              <span className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                item.id === caseId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500',
              ].join(' ')}>{index + 1}</span>
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </section>

        {busy ? (
          <div className="mt-6 flex min-h-[420px] items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm text-slate-500">
            <Loader2 className="animate-spin" size={18} /> 正在运行受控多日链路
          </div>
        ) : error ? (
          <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800" role="alert">
            <p className="font-semibold">Demo 运行失败</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="多日运行摘要">
              <Metric icon={Clock3} label="模拟日期" value={`${result.counts.simulatedDays} 天`} />
              <Metric icon={Database} label="学习 Session" value={`${result.counts.sessions} 个`} />
              <Metric icon={RotateCcw} label="正式轮次" value={`${result.counts.rounds} 轮`} />
              <Metric icon={CheckCircle2} label="Evidence" value={`${result.counts.evidence} 条`} />
              <Metric icon={ShieldCheck} label="自然日进度" value={`${result.counts.naturalDays} / 5`} muted />
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
              <section className="min-w-0 rounded-md border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-5 lg:px-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">当前 Case</p>
                      <h2 className="mt-2 text-lg font-semibold">{selectedCase.label}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedCase.description}</p>
                    </div>
                    {caseResult?.status === 'blocked_as_expected' ? (
                      <span className="flex items-center gap-1 text-sm font-semibold text-amber-700"><AlertTriangle size={16} />按预期阻断</span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} />PASS</span>
                    )}
                  </div>
                  <div className="mt-4 border-l-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                    <span className="font-semibold">预期：</span>{selectedCase.expected}
                  </div>
                </div>

                <div className="px-5 py-6 lg:px-7">
                  <h3 className="text-base font-semibold">{caseResult?.headline}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{caseResult?.summary}</p>
                  <div data-testid="phase163c-case-checks" className="mt-6 space-y-4">
                    {caseResult?.checks.map((item) => (
                      <div key={item.label} className="flex gap-3">
                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {item.passed ? <Check size={14} /> : '×'}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="min-w-0 rounded-md border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">五日工程预演</p>
                    <h2 className="mt-1 text-base font-semibold">运行时间线</h2>
                  </div>
                  {result.engineeringReady ? <span className="text-sm font-semibold text-emerald-700">ENGINEERING READY</span> : null}
                </div>
                <ol className="mt-6 space-y-5">
                  {result.timeline.map((item, index) => (
                    <li key={item.day} className="relative flex gap-3">
                      {index < result.timeline.length - 1 ? <span className="absolute left-[11px] top-6 h-[calc(100%+4px)] w-px bg-slate-200" /> : null}
                      <span className={`relative mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white ${timelineTone(item.tone)}`} />
                      <div>
                        <p className="text-xs font-semibold text-slate-500">{item.day}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>

            <section className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
              <p className="font-semibold">验收边界</p>
              <p className="mt-1">本页可以验收 16.3C 的工程可达性、恢复幂等、复测和异常安全；不能据此宣称 5—7 个自然日真实运行已经完成。</p>
            </section>

            <details className="mt-6 rounded-md border border-slate-200 bg-white px-5 py-4 text-sm">
              <summary className="cursor-pointer font-semibold text-slate-700">开发者调试摘要</summary>
              <dl className="mt-4 grid gap-3 text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
                <DebugValue label="恢复轮 Provider 调用" value={result.debug.providerCallsForRecoveredRound} />
                <DebugValue label="异常状态" value={result.debug.providerFailureStatus} />
                <DebugValue label="重复正式写入" value={result.debug.duplicateFormalWriteCount} />
                <DebugValue label="Session History" value={result.debug.sessionHistoryValid ? 'valid' : 'invalid'} />
                <DebugValue label="复测计划" value={result.debug.retestPlanCreated ? 'created' : 'missing'} />
              </dl>
            </details>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value, muted = false }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className={`flex items-center gap-2 text-sm font-semibold ${muted ? 'text-slate-500' : 'text-slate-700'}`}><Icon size={16} />{label}</div>
      <p className={`mt-3 text-lg font-semibold ${muted ? 'text-slate-500' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function DebugValue({ label, value }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>;
}

function timelineTone(tone) {
  if (tone === 'success') return 'bg-emerald-500';
  if (tone === 'warning') return 'bg-amber-500';
  return 'bg-blue-500';
}
