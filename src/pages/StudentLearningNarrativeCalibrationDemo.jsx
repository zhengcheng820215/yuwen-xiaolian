import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Circle, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { narrativeCalibrationSamples } from '../ai/fixtures/narrativeCalibrationSamples.ts';

const roleLabels = {
  diagnosis: '诊断',
  training: '训练',
  retest: '复测',
  transfer: '迁移',
};

const gapLabels = {
  missing_response_anchor: '没有回应学生实际表达',
  achieved_not_specific: '已完成点不够具体',
  primary_gap_not_unique: '主要缺口不够集中',
  next_action_not_executable: '建议不能直接修改当前答案',
  continuation_not_grounded: '后续原因缺少正式来源',
  language_too_generic: '语言过于泛化',
  unsupported_inference: '包含无依据推断',
};

const acceptanceQuestions = [
  '系统注意到了我答案里的哪一点？',
  '我已经做对了什么？',
  '我现在只需要先改哪里？',
  '下一题为什么还练这个？',
];

export default function StudentLearningNarrativeCalibrationDemo() {
  const [selectedId, setSelectedId] = useState(narrativeCalibrationSamples[0].sampleId);
  const [checks, setChecks] = useState({});
  const sample = useMemo(
    () => narrativeCalibrationSamples.find((item) => item.sampleId === selectedId) || narrativeCalibrationSamples[0],
    [selectedId],
  );
  const sampleChecks = checks[selectedId] || [];
  const completedCount = narrativeCalibrationSamples.filter((item) =>
    (checks[item.sampleId] || []).length === acceptanceQuestions.length).length;

  const toggleCheck = (index) => {
    setChecks((current) => {
      const next = new Set(current[selectedId] || []);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...current, [selectedId]: [...next].sort() };
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/internal/acceptance" aria-label="返回验收入口" title="返回验收入口" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">学生理解感校准</h1>
              <p className="truncate text-sm text-slate-500">Learning Narrative · 人工目标基线，不是实时 Runtime 输出</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600"><ShieldCheck size={16} />只读 · 不调用 Provider</div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1440px] gap-7 px-5 py-7 md:px-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="self-start lg:sticky lg:top-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">冻结样例</h2>
            <span className="text-sm tabular-nums text-slate-500">{completedCount} / {narrativeCalibrationSamples.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {narrativeCalibrationSamples.map((item, index) => {
              const accepted = (checks[item.sampleId] || []).length === acceptanceQuestions.length;
              return (
                <button key={item.sampleId} type="button" onClick={() => setSelectedId(item.sampleId)} className={`flex w-full items-start gap-3 rounded-md border p-4 text-left transition ${selectedId === item.sampleId ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${accepted ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{accepted ? <Check size={14} /> : index + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-500">{roleLabels[item.taskRole]}</span>
                    <span className="mt-1 block text-sm font-semibold leading-5 text-slate-900">{item.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">
          <section className="border-b border-slate-200 pb-7">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><FileText size={16} />{sample.sampleId}<span>·</span><span>{roleLabels[sample.taskRole]}</span></div>
            <h2 className="mt-3 text-xl font-semibold">{sample.title}</h2>
            <dl className="mt-5 grid gap-5 text-sm leading-6 md:grid-cols-2">
              <SourceFact label="材料" value={sample.materialExcerpt} />
              <SourceFact label="题目" value={sample.question} />
              <SourceFact label="学生回答" value={sample.studentAnswer} />
              <SourceFact label="正式判断" value={sample.diagnosisSummary} />
            </dl>
          </section>

          <section className="grid border-b border-slate-200 md:grid-cols-2">
            <NarrativeColumn title="当前输出" narrative={sample.currentNarrative} tone="current" />
            <NarrativeColumn title="理想校准" narrative={sample.idealNarrative} tone="ideal" />
          </section>

          <section className="grid gap-7 border-b border-slate-200 py-7 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h3 className="text-base font-semibold">差异归因</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {sample.gapReasons.map((reason) => <span key={reason} className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm text-amber-900">{gapLabels[reason]}</span>)}
              </div>
              <h3 className="mt-7 text-base font-semibold">题目要求覆盖</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {sample.rubricCoverage.map((item) => <li key={item} className="flex gap-2"><span className="text-slate-400">·</span><span>{item}</span></li>)}
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold">学生复述验收</h3>
              <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
                {acceptanceQuestions.map((question, index) => {
                  const checked = sampleChecks.includes(index);
                  return (
                    <label key={question} className="flex cursor-pointer items-start gap-3 py-3 text-sm leading-6 text-slate-700">
                      <input type="checkbox" checked={checked} onChange={() => toggleCheck(index)} className="sr-only" />
                      {checked ? <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-400" />}
                      <span>{question}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SourceFact({ label, value }) {
  return <div><dt className="font-semibold text-slate-800">{label}</dt><dd className="mt-1 text-slate-600">{value}</dd></div>;
}

function NarrativeColumn({ title, narrative, tone }) {
  const fields = [
    ['回应学生', narrative.responseAnchor],
    ['已经完成', narrative.achieved],
    ['主要缺口', narrative.currentGap],
    ['修改动作', narrative.nextAction],
    ['学习含义', narrative.progressMeaning],
    ['后续原因', narrative.nextTaskReason],
  ].filter(([, value]) => value);
  return (
    <div className={`px-0 py-7 md:px-7 ${tone === 'ideal' ? 'md:border-l md:border-slate-200 md:bg-white' : ''}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      <dl className="mt-4 space-y-5">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="mt-1 text-base leading-7 text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
