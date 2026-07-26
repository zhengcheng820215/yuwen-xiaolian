import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CircleSlash2,
  Database,
  History,
  RotateCcw,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { getPhase175C2QualityPersistenceDemoData } from '../api/phase175C2QualityPersistenceDemo.ts';

const demo = getPhase175C2QualityPersistenceDemoData();

const decisionConfig = {
  restored: ['恢复一致', 'bg-emerald-50 text-emerald-700', Database],
  blocked: ['安全阻断', 'bg-rose-50 text-rose-700', CircleSlash2],
  traced: ['追溯完整', 'bg-blue-50 text-blue-700', Waypoints],
  rolled_back: ['完整回滚', 'bg-amber-50 text-amber-800', RotateCcw],
};

export default function Phase175C2QualityPersistenceDemo() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(demo.defaultCaseId);
  const selectedCase = useMemo(
    () => demo.cases.find((item) => item.id === selectedId) || demo.cases[0],
    [selectedId],
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center gap-4 px-5 md:px-8">
          <button
            type="button"
            onClick={() => navigate('/internal/acceptance')}
            aria-label="返回验收中心"
            title="返回验收中心"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold">题目质量持久化与追溯 Demo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Phase 17.5C2 · Assessment Persistence and Frozen Traceability
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 py-8 md:px-8">
        <section className="border-b border-slate-200 pb-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-[760px]">
              <p className="text-sm font-semibold text-emerald-700">验收目标</p>
              <h2 className="mt-2 text-xl font-semibold leading-8">
                确认质量事实能恢复、能失效、能随正式资源追溯，失败时不污染正式状态
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                本页展示由 C2 正式契约冻结的受控验收结果，不重复判断题目语义质量，
                也不会写入真实题目录入工作台。
              </p>
            </div>
            <div className="text-sm leading-6 text-slate-500">
              <p>{demo.debugSummary}</p>
              <p>{demo.storageBoundary}</p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-sm font-semibold text-slate-500">验收 Case</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {demo.cases.map((item, index) => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={[
                      'flex min-h-[52px] items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition',
                      active
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    ].join(' ')}
                  >
                    <span className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm',
                      active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                    >
                      {index + 1}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 rounded-md border border-slate-200 bg-white">
            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-lg font-semibold">{selectedCase.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedCase.description}
                  </p>
                </div>
                <DecisionBadge decision={selectedCase.decision} />
              </div>
              <div className="mt-4 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                <span className="font-semibold">预期：</span>{selectedCase.expected}
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">持久化事实对比</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] table-fixed text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="w-[42%] pb-3 font-normal">对象</th>
                      <th className="w-[22%] pb-3 font-normal">执行前</th>
                      <th className="w-[22%] pb-3 font-normal">执行后</th>
                      <th className="w-[14%] pb-3 font-normal">结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCase.facts.map((fact) => (
                      <tr key={fact.label} className="border-t border-slate-100">
                        <td className="py-3 pr-3 font-medium text-slate-800">{fact.label}</td>
                        <td className="py-3 pr-3 text-slate-600">{fact.before}</td>
                        <td className="py-3 pr-3 text-slate-800">{fact.after}</td>
                        <td className="py-3 text-emerald-700">
                          <span className="inline-flex items-center gap-1">
                            <Check size={15} />符合
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <History size={18} className="text-emerald-600" />
                身份与追溯链
              </h3>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {selectedCase.traceChain.map((node, index) => (
                  <div key={`${node}-${index}`} className="contents">
                    <span className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">
                      {node}
                    </span>
                    {index < selectedCase.traceChain.length - 1 && (
                      <span className="text-slate-300">→</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">本 Case 验收</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {selectedCase.acceptancePoints.map((point) => (
                  <div key={point} className="flex gap-3 text-sm leading-6 text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-700">
                      <Check size={14} />
                    </span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function DecisionBadge({ decision }) {
  const [label, className, Icon] =
    decisionConfig[decision] || [decision, 'bg-slate-100 text-slate-700', ShieldCheck];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-xs ${className}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}
