import PageHeader from '../components/PageHeader.jsx';
import { getTrainingPlanDemoData } from '../api/trainingPlan';

const { evidenceSummary, topWeakness, trainingPlan } = getTrainingPlanDemoData();

export default function TrainingPlanDemo() {
  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="训练计划 Demo"
        subtitle="Phase 3.2.1：基于能力证据生成 3 天阶段训练计划"
        back
      />

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">当前优先训练能力</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            {trainingPlan.primary_target_ability}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{trainingPlan.summary}</p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Phase 3.1 Top Weakness</h2>
          <div className="mt-3 space-y-2">
            {topWeakness.map((item, index) => (
              <div key={item.ability} className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">
                    {index + 1}. {item.ability}
                  </div>
                  <div className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                    confidence {formatPercent(item.averageConfidence)}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  weakness {item.weaknessCount} 条；{item.suggestedTrainingFocus}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          {trainingPlan.days.map((day) => (
            <TrainingDayCard key={day.day} day={day} />
          ))}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Evidence Summary</h2>
          <div className="mt-3 grid gap-2">
            {evidenceSummary.map((summary) => (
              <div key={summary.ability} className="grid grid-cols-[72px_1fr] gap-3 rounded-md bg-slate-50 p-3 text-sm">
                <div className="font-semibold text-slate-900">{summary.ability}</div>
                <div className="leading-6 text-slate-600">
                  weakness {summary.weaknessCount}，positive {summary.positiveCount}，
                  insufficient {summary.insufficientCount}，avg {formatPercent(summary.averageConfidence)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Stable JSON</h2>
          <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-50">
            {JSON.stringify(trainingPlan, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}

function TrainingDayCard({ day }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-blue-700">Day {day.day}</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{day.target_ability}</h2>
        </div>
        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
          {day.practice_type}
        </span>
      </div>

      <div className="mt-4 space-y-4 text-sm">
        <InfoBlock title="目标技能" value={day.targetSkill} />
        <InfoBlock title="训练策略" value={day.strategy} />
        <InfoBlock title="训练目标" value={day.training_goal} />
        <InfoBlock title="为什么练" value={day.reason_from_evidence} />
        <ListBlock title="重点技能" items={day.focus_skills} />
        <ListBlock title="每天练什么" items={day.tasks} />
        <ListBlock title="如何判断有效" items={day.success_criteria} />

        <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
          <div className="mb-2 font-semibold text-blue-900">
            Evidence 关联
          </div>
          {day.evidence_links.map((link) => (
            <div key={link.ability} className="leading-6 text-blue-900">
              {link.ability}：{link.weaknessCount} 条 weakness evidence，平均置信度 {formatPercent(link.averageConfidence)}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div>
      <div className="font-semibold text-slate-500">{title}</div>
      <p className="mt-1 leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }) {
  return (
    <div>
      <div className="font-semibold text-slate-500">{title}</div>
      <ul className="mt-2 list-disc space-y-2 pl-5 leading-6 text-slate-800">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}
