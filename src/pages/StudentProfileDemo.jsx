import PageHeader from '../components/PageHeader.jsx';
import { getStudentProfileDemoData } from '../api/studentProfile';

const { profile, evidenceSummary, topWeakness } = getStudentProfileDemoData();

const statusLabels = {
  weak: '仍薄弱',
  improving: '有改善',
  stable_positive: '相对稳定',
  insufficient_evidence: '证据不足',
};

export default function StudentProfileDemo() {
  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="学生画像 Demo"
        subtitle="Phase 4.1：基于累计证据生成当前能力状态"
        back
      />

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">当前最需要训练</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            {profile.current_weakness.primary}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            次级观察：{profile.current_weakness.secondary.join('、') || '暂无'}
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">能力状态</h2>
          <div className="mt-3 grid gap-3">
            {profile.ability_status.map((item) => (
              <AbilityStatusCard key={item.ability} item={item} />
            ))}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">改善信号</h2>
          <div className="mt-3 space-y-3">
            {profile.improvement_signals.map((signal, index) => (
              <div key={`${signal.ability}-${signal.from}-${index}`} className="rounded-md bg-slate-50 p-3 text-sm">
                <div className="font-semibold text-slate-900">
                  {signal.ability} / {signal.from} / confidence {formatPercent(signal.confidence)}
                </div>
                <p className="mt-2 leading-6 text-slate-600">{signal.signal}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">下一步建议</h2>
          <InfoBlock title="继续训练重点" value={profile.continue_training_focus} />
          <InfoBlock title="next_step_recommendation" value={profile.next_step_recommendation} />
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">证据关系</h2>
          <div className="mt-3 grid gap-3">
            <SummaryBlock title="Evidence Summary" summaries={evidenceSummary} />
            <TopWeaknessBlock items={topWeakness} />
            <EvidenceLinks links={profile.evidence_links} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Stable JSON</h2>
          <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-50">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}

function AbilityStatusCard({ item }) {
  return (
    <article className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-950">{item.ability}</h3>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700">
          {statusLabels[item.status] || item.status}
        </span>
      </div>
      <p className="mt-2 leading-6 text-slate-600">{item.summary}</p>
      <p className="mt-2 leading-6 text-slate-500">
        weakness {item.weakness_count}，positive {item.positive_count}，growth {item.growth_count}，insufficient {item.insufficient_count}
      </p>
    </article>
  );
}

function SummaryBlock({ title, summaries }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-900">{title}</p>
      <div className="mt-2 space-y-1 leading-6 text-slate-600">
        {summaries.map((summary) => (
          <div key={summary.ability}>
            {summary.ability}: weakness {summary.weaknessCount}, positive {summary.positiveCount}, growth {summary.growthCount}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopWeaknessBlock({ items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-900">Top Weakness</p>
      <div className="mt-2 space-y-1 leading-6 text-slate-600">
        {items.map((item, index) => (
          <div key={item.ability}>
            {index + 1}. {item.ability} / priority {item.priority}
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceLinks({ links }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-900">Evidence Links</p>
      <div className="mt-2 space-y-2 leading-6 text-slate-600">
        {links.map((link) => (
          <div key={link.evidenceId}>
            {link.ability} / {link.source} / {link.evidenceType} / confidence {formatPercent(link.confidence)}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div className="mt-3 text-sm">
      <div className="font-semibold text-slate-500">{title}</div>
      <p className="mt-1 leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}
