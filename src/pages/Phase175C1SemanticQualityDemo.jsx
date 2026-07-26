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
import { getPhase175C1SemanticQualityDemoData } from '../api/phase175C1SemanticQualityDemo.ts';

const demo = getPhase175C1SemanticQualityDemoData();

const checkLabels = {
  materialGrounding: '材料依据',
  observationClarity: '观察目标',
  observationDistinctness: '观察独立性',
  discriminativePower: '表现区分度',
  difficultyCoherence: '难度一致性',
  rubricAlignment: 'Rubric 对齐',
  scopeClarity: '题目范围',
};

const actionLabels = {
  approve: '审核通过',
  revisionRequired: '退回修改',
  reject: '拒绝',
  freeze: 'Freeze',
};

export default function Phase175C1SemanticQualityDemo() {
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
            <h1 className="text-lg font-semibold">题目语义质量评估 Demo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Phase 17.5C1 · Independent Semantic Quality Assessment
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
                语义判断补充审核依据，失败时不污染正式质量结论
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                页面使用正式 C1 合并与门控函数生成结果。它不调用真实 Provider、
                不写 Shared Store，也不模拟 C2 持久化能力。
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
                <BundleBadge decision={selectedCase.bundle.decision} />
              </div>
              <div className="mt-4 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                <span className="font-semibold">预期：</span>{selectedCase.expected}
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold">Semantic Assessment</h3>
                <StatusBadge status={selectedCase.semantic.status} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoCell label="Finding 数量" value={`${selectedCase.semantic.findings.length} / 7`} />
                <InfoCell label="限制说明" value={selectedCase.semantic.limitations[0]} />
              </div>
              {selectedCase.semantic.findings.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {selectedCase.semantic.findings.map((finding) => (
                    <div key={finding.check} className="rounded bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-800">
                          {checkLabels[finding.check]}
                        </span>
                        <FindingStatus status={finding.status} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{finding.reason}</p>
                      <p className="mt-1 break-all text-xs leading-5 text-slate-400">
                        {finding.evidenceRefs.join(' / ')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-3 rounded bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
                  Provider 未完成语义评估，因此不生成或猜测 Finding。
                </div>
              )}
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">合并结论与安全门控</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(selectedCase.actions).map(([key, allowed]) => (
                  <GateState
                    key={key}
                    label={actionLabels[key]}
                    allowed={allowed}
                  />
                ))}
              </div>
              {selectedCase.bundle.warningCodes.length > 0 && (
                <div className="mt-4 rounded bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900">合并后保留的提醒</p>
                  <p className="mt-1 break-all text-xs leading-5 text-amber-800">
                    {selectedCase.bundle.warningCodes.join(' / ')}
                  </p>
                </div>
              )}
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">身份追溯</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoCell label="Deterministic Assessment" value={selectedCase.bundle.deterministicAssessmentId} />
                <InfoCell label="Semantic Assessment" value={selectedCase.bundle.semanticAssessmentId} />
                <InfoCell label="Draft Revision" value={`r${selectedCase.bundle.assessedDraftRevision}`} />
                <InfoCell label="Merge Rule" value={selectedCase.bundle.mergeRuleVersion} />
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

function BundleBadge({ decision }) {
  const config = {
    ready_for_review: ['可进入审核', 'bg-emerald-50 text-emerald-700'],
    review_with_warnings: ['带提醒审核', 'bg-amber-50 text-amber-800'],
    revision_recommended: ['建议修改', 'bg-rose-50 text-rose-700'],
    semantic_unavailable: ['语义评估不可用', 'bg-rose-50 text-rose-700'],
  };
  const [label, className] = config[decision] || [decision, 'bg-slate-100 text-slate-700'];
  return <span className={`shrink-0 rounded px-2.5 py-1.5 text-xs ${className}`}>{label}</span>;
}

function StatusBadge({ status }) {
  const completed = status === 'completed';
  return (
    <span className={[
      'rounded px-2.5 py-1.5 text-xs',
      completed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
    ].join(' ')}
    >
      {completed ? '已完成' : status}
    </span>
  );
}

function FindingStatus({ status }) {
  const config = {
    pass: ['通过', 'text-emerald-700'],
    warning: ['提醒', 'text-amber-700'],
    strong_warning: ['强提醒', 'text-rose-700'],
  };
  const [label, className] = config[status] || [status, 'text-slate-600'];
  return <span className={`text-xs ${className}`}>{label}</span>;
}

function GateState({ label, allowed }) {
  const Icon = allowed ? ShieldCheck : CircleSlash2;
  return (
    <div className="rounded bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon size={17} className={allowed ? 'text-emerald-600' : 'text-rose-600'} />
        {label}
      </div>
      <p className={`mt-2 text-sm font-semibold ${allowed ? 'text-emerald-700' : 'text-rose-700'}`}>
        {allowed ? '允许' : '已阻断'}
      </p>
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="rounded bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {label.includes('Assessment')
          ? <FileSearch size={16} />
          : <CheckCircle2 size={16} />}
        {label}
      </div>
      <p className="mt-2 break-all text-sm leading-6 text-slate-800">{value}</p>
    </div>
  );
}
