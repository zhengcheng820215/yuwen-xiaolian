import PageHeader from '../components/PageHeader.jsx';
import { getTrainingEvidenceDemoData } from '../api/trainingEvidence';

const {
  previousEvidence,
  previousSummary,
  result,
  updatedSummary,
} = getTrainingEvidenceDemoData();

export default function TrainingEvidenceDemo() {
  const trainingEvidence = result.generatedEvidence.find((item) => item.source === 'training');
  const retestEvidence = result.generatedEvidence.find((item) => item.source === 'retest');

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="训练证据 Demo"
        subtitle="Phase 3.3：训练执行、复测验证与 evidence 回流"
        back
      />

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">原始薄弱点</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">{result.ability}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{result.originalWeakness}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">训练方向：{result.trainingFocus}</p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">训练任务</h2>
          <InfoBlock title="Day 1 Task" value={result.trainingEvaluation.trainingTask} />
          <InfoBlock title="学生训练回答" value={result.trainingEvaluation.studentAnswer} />
          <InfoBlock title="训练状态" value={result.trainingEvaluation.status} />
          <ListBlock title="训练过程发现" items={result.trainingEvaluation.processFindings} />
        </section>

        {trainingEvidence && (
          <EvidenceCard
            title="Training Evidence"
            evidence={trainingEvidence}
            extra={result.trainingEvaluation.observation}
          />
        )}

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">复测</h2>
          <InfoBlock title="复测题" value={result.retestEvaluation.retestQuestion} />
          <InfoBlock title="学生复测回答" value={result.retestEvaluation.studentAnswer} />
          <InfoBlock title="训练前后对比" value={result.retestEvaluation.comparison} />
          <InfoBlock title="abilityChange" value={result.retestEvaluation.abilityChange} />
        </section>

        {retestEvidence && (
          <EvidenceCard
            title="Retest Evidence"
            evidence={retestEvidence}
            extra={result.retestEvaluation.observation}
          />
        )}

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Evidence 更新</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <CountBlock label="原 evidence" value={previousEvidence.length} />
            <CountBlock label="新增 evidence" value={result.generatedEvidence.length} />
            <CountBlock label="更新后" value={result.updatedEvidence.length} />
          </div>
          <div className="mt-4 grid gap-3">
            <SummaryBlock title="更新前" summaries={previousSummary} />
            <SummaryBlock title="更新后" summaries={updatedSummary} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Stable JSON</h2>
          <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-50">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}

function EvidenceCard({ title, evidence, extra }) {
  return (
    <section className="rounded-md border border-blue-100 bg-blue-50 p-4">
      <h2 className="text-base font-semibold text-blue-950">{title}</h2>
      <div className="mt-3 space-y-3 text-sm">
        <InfoBlock title="source" value={evidence.source} />
        <InfoBlock title="evidenceType" value={evidence.evidenceType} />
        <InfoBlock title="observation" value={evidence.observation} />
        <InfoBlock title="rootCause" value={evidence.rootCause || '无'} />
        <InfoBlock title="confidence" value={formatPercent(evidence.confidence)} />
        {extra && <InfoBlock title="evaluation" value={extra} />}
      </div>
    </section>
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

function CountBlock({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div className="mt-3">
      <div className="font-semibold text-slate-500">{title}</div>
      <p className="mt-1 leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }) {
  return (
    <div className="mt-3">
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
