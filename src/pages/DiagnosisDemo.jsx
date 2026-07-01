import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { diagnosis } from '../api/diagnosis';

const initialForm = {
  question: '请概括这段文字的主要内容，并结合文本说明理由。',
  referenceAnswer: '本文主要写作者通过回忆父亲送别时的细节，表现了父亲深沉含蓄的爱，以及作者对父爱的理解和感念。',
  studentAnswer: '这篇文章写了父亲送作者，表现父亲很爱孩子。',
};

export default function DiagnosisDemo() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleDiagnose = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const diagnosisResult = await diagnosis(form);
      setResult(diagnosisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '诊断失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader title="Diagnosis Demo" subtitle="验证前端到 Diagnosis Agent 的结构化 JSON 链路" />

      <div className="space-y-4 px-4 pb-8">
        <InputBlock
          label="题目"
          value={form.question}
          onChange={(value) => updateField('question', value)}
        />
        <InputBlock
          label="参考答案"
          value={form.referenceAnswer}
          onChange={(value) => updateField('referenceAnswer', value)}
        />
        <InputBlock
          label="学生答案"
          value={form.studentAnswer}
          onChange={(value) => updateField('studentAnswer', value)}
        />

        <button
          type="button"
          onClick={handleDiagnose}
          disabled={loading}
          className="min-h-12 w-full rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition disabled:bg-slate-300"
        >
          {loading ? '诊断中...' : '开始诊断'}
        </button>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && <DiagnosisResult result={result} />}
      </div>
    </div>
  );
}

function InputBlock({ label, value, onChange }) {
  return (
    <label className="block rounded-md border border-slate-200 bg-white p-3">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
      />
    </label>
  );
}

function DiagnosisResult({ result }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">结构化诊断结果</h2>
        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
          confidence {Math.round(result.confidence * 100)}%
        </span>
      </div>

      <div className="space-y-3 text-sm">
        <ResultRow label="mainAbility" value={result.mainAbility} />
        <ResultRow label="rootCause" value={result.rootCause} />
        <ResultList label="abilityEvidence" items={result.abilityEvidence} />
        <ResultRow label="diagnosisSummary" value={result.diagnosisSummary} />
        <ResultRow label="nextTraining" value={result.nextTraining} />
      </div>

      <pre className="mt-4 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-50">
        {JSON.stringify(result, null, 2)}
      </pre>
    </section>
  );
}

function ResultRow({ label, value }) {
  return (
    <div>
      <div className="font-semibold text-slate-500">{label}</div>
      <div className="mt-1 leading-6 text-slate-800">{value}</div>
    </div>
  );
}

function ResultList({ label, items }) {
  return (
    <div>
      <div className="font-semibold text-slate-500">{label}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 leading-6 text-slate-800">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
