import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CircleSlash2,
  Layers3,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { getPhase175C3ABatchQualitySummaryDemoData } from '../api/phase175C3ABatchQualitySummaryDemo.ts';

const demo = getPhase175C3ABatchQualitySummaryDemoData();

const statusConfig = {
  complete: ['完整', 'bg-emerald-50 text-emerald-700', ShieldCheck],
  incomplete: ['缺项', 'bg-amber-50 text-amber-800', TriangleAlert],
  mixed_versions: ['版本混杂', 'bg-blue-50 text-blue-700', Layers3],
  blocked: ['已阻断', 'bg-rose-50 text-rose-700', CircleSlash2],
};

const metricLabels = {
  contractValidationPassRate: 'Contract Validation 通过率',
  semanticCompletionRate: '语义评估完成率',
  currentAssessmentCoverage: '当前质量覆盖率',
  duplicateObservationRate: '重复 Observation 比例',
  humanRetentionRate: '人工保留率',
  humanModificationRate: '人工修改率',
  humanRejectionRate: '人工拒绝率',
  averageReviewDurationMs: '平均审核耗时',
};

export default function Phase175C3ABatchQualitySummaryDemo() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(demo.defaultCaseId);
  const selectedCase = useMemo(
    () => demo.cases.find((item) => item.id === selectedId) || demo.cases[0],
    [selectedId],
  );
  const summary = selectedCase.summary;

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
            <h1 className="text-lg font-semibold">批次题目质量汇总 Demo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Phase 17.5C3A · Batch Quality Summary
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 py-8 md:px-8">
        <section className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold text-emerald-700">人工验收目标</p>
          <h2 className="mt-2 max-w-[820px] text-xl font-semibold leading-8">
            验证批次汇总能够区分完整、缺项、版本混杂与冲突阻断，并在没有分母时保持“暂无数据”。
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm leading-6 text-slate-500">
            <span>{demo.debugSummary}</span>
            <span>{demo.runtimeBoundary}</span>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
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

          <article className="min-w-0 rounded-md border border-slate-200 bg-white">
            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-lg font-semibold">{selectedCase.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedCase.description}
                  </p>
                </div>
                <StatusBadge status={summary.status} />
              </div>
              <p className="mt-4 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                <span className="font-semibold">预期状态：</span>
                {selectedCase.expectedStatus}
              </p>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">批次事实</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Count label="材料" value={summary.counts.materialCount} />
                <Count label="Draft" value={summary.counts.draftCount} />
                <Count label="当前 Bundle" value={summary.counts.currentBundleCount} />
                <Count label="缺失评估" value={summary.counts.missingAssessmentCount} />
                <Count label="失效评估" value={summary.counts.staleAssessmentCount} />
                <Count label="已审核" value={summary.counts.reviewedCount} />
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">质量指标</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(summary.metrics).map(([key, metric]) => (
                  <Metric
                    key={key}
                    label={metricLabels[key] || key}
                    metric={metric}
                    duration={key === 'averageReviewDurationMs'}
                  />
                ))}
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <div className="grid gap-5 md:grid-cols-2">
                <Distribution title="Bundle 决定" values={summary.decisionDistribution} />
                <Distribution title="人工决定" values={summary.humanDecisionDistribution} />
                <Distribution title="Ability 分布" values={summary.abilityDistribution} />
                <Distribution title="Difficulty 分布" values={summary.difficultyDistribution} />
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h3 className="text-base font-semibold">发现的问题</h3>
              {summary.issues.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">当前没有批次身份或完整性问题。</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {summary.issues.map((issue) => (
                    <li key={issue} className="rounded bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
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
              <p className="mt-5 text-xs leading-5 text-slate-400">
                Summary ID：{summary.summaryId} · Rule：{summary.summaryRuleVersion}
              </p>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }) {
  const [label, className, Icon] = statusConfig[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-xs ${className}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}

function Count({ label, value }) {
  return (
    <div className="rounded bg-slate-50 px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Metric({ label, metric, duration }) {
  const displayValue = metric.value === null
    ? '暂无数据'
    : duration
      ? `${Math.round(metric.value / 1000)} 秒`
      : `${Math.round(metric.value * 100)}%`;
  return (
    <div className="rounded border border-slate-100 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-600">{label}</p>
        <p className="shrink-0 text-sm font-semibold text-slate-900">{displayValue}</p>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {metric.numerator} / {metric.denominator}
      </p>
    </div>
  );
}

function Distribution({ title, values }) {
  const entries = Object.entries(values);
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <span key={key} className="rounded bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
            {key}：<strong className="font-semibold text-slate-900">{value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
