import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleSlash2,
  FileSearch,
  ShieldCheck,
} from 'lucide-react';
import { getPhase175QuestionQualityDemoData } from '../api/phase175QuestionQualityDemo.ts';

const demo = getPhase175QuestionQualityDemoData();

const checkLabels = {
  materialGrounding: '材料依据',
  observationClarity: '观察目标',
  observationDistinctness: '观察独立性',
  discriminativePower: '表现区分度',
  difficultyCoherence: '难度一致性',
  rubricAlignment: 'Rubric 对齐',
  scopeClarity: '题目范围',
};

export default function Phase175QuestionQualityDemo() {
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
            <h1 className="text-lg font-semibold">题目质量审核 Demo</h1>
            <p className="mt-1 text-sm text-slate-500">Phase 17.5B · Quality Assessment → Human Review Gate</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 py-8 md:px-8">
        <section className="border-b border-slate-200 pb-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-[760px]">
              <p className="text-sm font-semibold text-emerald-700">验收目标</p>
              <h2 className="mt-2 text-xl font-semibold leading-8">
                质量评估提供审核依据，但不替代人工决定
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                所有 Case 均直接运行正式 17.5B 评估逻辑。切换 Case，检查质量结论、具体提醒、Revision 身份和审核门控是否符合预期。
              </p>
            </div>
            <span className="text-sm text-slate-500">{demo.debugSummary}</span>
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
                    ].join(' ')}>
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
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedCase.description}</p>
                </div>
                <DecisionBadge
                  decision={selectedCase.assessment.decision}
                  isCurrent={selectedCase.isCurrent}
                />
              </div>
              <div className="mt-4 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                <span className="font-semibold">预期：</span>{selectedCase.expected}
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">七项质量检查</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries(selectedCase.assessment.checks).map(([key, value]) => (
                  <div key={key} className="flex min-h-11 items-center justify-between gap-3 rounded bg-slate-50 px-3">
                    <span className="text-sm text-slate-700">{checkLabels[key] || key}</span>
                    <CheckStatus status={value} />
                  </div>
                ))}
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">质量提醒</h3>
                <span className="text-sm text-slate-500">{selectedCase.assessment.warnings.length} 条</span>
              </div>
              {selectedCase.assessment.warnings.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {selectedCase.assessment.warnings.map((warning) => (
                    <div key={warning.code} className="rounded bg-amber-50 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
                        <div className="min-w-0">
                          <p className="text-sm leading-6 text-amber-950">{warning.message}</p>
                          <p className="mt-1 break-all text-xs leading-5 text-amber-800">
                            {warning.code} · {warning.evidenceRefs.join(' / ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <CheckCircle2 size={17} />
                  当前规则未发现质量提醒。
                </div>
              )}
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">审核门控</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <GateState
                  icon={FileSearch}
                  label="Assessment 身份"
                  value={selectedCase.isCurrent ? '当前版本有效' : '旧版本已失效'}
                  positive={selectedCase.isCurrent}
                />
                <GateState
                  icon={ShieldCheck}
                  label="提交人工审核"
                  value={selectedCase.humanReviewAllowed ? '允许进入' : '已阻断，需重新评估'}
                  positive={selectedCase.humanReviewAllowed}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                `pass`、`pass_with_warnings` 和 `revision_recommended` 都只是审核依据；只有缺少当前版本 Assessment 时，门控才会阻断提交。
              </p>
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

function DecisionBadge({ decision, isCurrent }) {
  const config = {
    pass: ['通过', 'bg-emerald-50 text-emerald-700'],
    pass_with_warnings: ['带提醒通过', 'bg-amber-50 text-amber-800'],
    revision_recommended: ['建议修改', 'bg-rose-50 text-rose-700'],
  };
  const [label, className] = config[decision] || [decision, 'bg-slate-100 text-slate-700'];
  if (!isCurrent) {
    return (
      <span className="shrink-0 rounded bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
        旧评估结论：{label}
      </span>
    );
  }
  return <span className={`shrink-0 rounded px-2.5 py-1.5 text-xs ${className}`}>{label}</span>;
}

function CheckStatus({ status }) {
  const config = {
    pass: ['通过', 'text-emerald-700'],
    warning: ['提醒', 'text-amber-700'],
    fail: ['不通过', 'text-rose-700'],
  };
  const [label, className] = config[status] || [status, 'text-slate-600'];
  return <span className={`text-xs ${className}`}>{label}</span>;
}

function GateState({ icon: Icon, label, value, positive }) {
  return (
    <div className="rounded bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {positive ? <Icon size={17} className="text-emerald-600" /> : <CircleSlash2 size={17} className="text-rose-600" />}
        {label}
      </div>
      <p className={`mt-2 text-sm font-semibold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>{value}</p>
    </div>
  );
}
