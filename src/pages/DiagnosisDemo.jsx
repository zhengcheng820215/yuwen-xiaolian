import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { diagnosis } from '../api/diagnosis';
import { training } from '../api/training';
import {
  getQuestionConfigById,
  questionConfigs,
  toQuestionMetadata,
} from '../data/questionConfigs';

const initialConfig = questionConfigs[0];
const initialForm = buildFormFromConfig(initialConfig);

export default function DiagnosisDemo() {
  const [selectedConfigId, setSelectedConfigId] = useState(initialConfig.id);
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [trainingResult, setTrainingResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleConfigChange = (configId) => {
    const config = getQuestionConfigById(configId);
    setSelectedConfigId(config.id);
    setForm(buildFormFromConfig(config));
    setResult(null);
    setTrainingResult(null);
    setError('');
  };

  const handleDiagnose = async () => {
    const selectedConfig = getQuestionConfigById(selectedConfigId);

    setLoading(true);
    setError('');
    setResult(null);
    setTrainingResult(null);

    try {
      const payload = buildDiagnosisPayload(form, selectedConfig);
      console.log('[DiagnosisDemo] selected questionConfig', selectedConfig);
      console.log('[DiagnosisDemo] diagnosis payload metadata', payload.questionMetadata);
      const diagnosisResult = await diagnosis(payload);
      setResult(diagnosisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '诊断失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTraining = async () => {
    if (!result) return;
    const selectedConfig = getQuestionConfigById(selectedConfigId);

    setTrainingLoading(true);
    setError('');
    setTrainingResult(null);

    try {
      const plan = await training({
        diagnosisResult: result,
        question: selectedConfig.questionText,
        studentAnswer: form.studentAnswer,
      });
      setTrainingResult(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : '训练方案生成失败，请稍后重试。');
    } finally {
      setTrainingLoading(false);
    }
  };

  const selectedConfig = getQuestionConfigById(selectedConfigId);
  const metadataPreview = JSON.stringify(toQuestionMetadata(selectedConfig), null, 2);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader title="Diagnosis Demo" subtitle="验证前端到 Diagnosis Agent 的结构化 JSON 链路" />

      <div className="space-y-4 px-4 pb-8">
        <label className="block rounded-md border border-slate-200 bg-white p-3">
          <span className="mb-2 block text-sm font-semibold text-slate-700">题目配置</span>
          <select
            value={selectedConfigId}
            onChange={(event) => handleConfigChange(event.target.value)}
            className="min-h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
          >
            {questionConfigs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.title} - {config.questionType} / {config.assessmentMode} / {config.mainAbility}
              </option>
            ))}
          </select>
        </label>

        <InputBlock
          label="题目"
          value={form.question}
          readOnly
        />
        <InputBlock
          label="参考答案"
          value={form.referenceAnswer}
          readOnly
        />
        <InputBlock
          label="学生答案"
          value={form.studentAnswer}
          onChange={(value) => updateField('studentAnswer', value)}
        />
        <InputBlock
          label="Question Metadata"
          value={metadataPreview}
          readOnly
          rows={10}
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

        {result && (
          <>
            <DiagnosisResult result={result} />
            <button
              type="button"
              onClick={handleGenerateTraining}
              disabled={trainingLoading}
              className="min-h-12 w-full rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition disabled:bg-slate-300"
            >
              {trainingLoading ? '生成中...' : '生成训练方案'}
            </button>
          </>
        )}

        {trainingResult && <TrainingResult result={trainingResult} />}
      </div>
    </div>
  );
}

function buildFormFromConfig(config) {
  return {
    question: config.questionText,
    referenceAnswer: config.referenceAnswer,
    studentAnswer: config.studentAnswer,
  };
}

function buildDiagnosisPayload(form, config) {
  const questionMetadata = toQuestionMetadata(config);
  validateQuestionMetadata(questionMetadata, config);

  return {
    question: config.questionText,
    referenceAnswer: config.referenceAnswer,
    studentAnswer: form.studentAnswer,
    questionMetadata,
  };
}

function validateQuestionMetadata(metadata, config) {
  if (!metadata.assessmentMode) throw new Error('缺少 assessmentMode');
  if (!metadata.mainAbility) throw new Error('缺少 mainAbility');
  if (!Array.isArray(metadata.rubric) || metadata.rubric.length === 0) throw new Error('缺少 rubric');
  if (metadata.questionId !== config.id) throw new Error('Question Metadata 与当前题目配置不一致');

  const expectedModeByType = {
    反义词: 'exact_match',
    概括: 'key_points',
    句子含义: 'reasoning_chain',
    推理: 'reasoning_chain',
    表达: 'expression_quality',
  };
  const expectedMode = expectedModeByType[metadata.questionType];

  if (expectedMode && metadata.assessmentMode !== expectedMode) {
    throw new Error(`${metadata.questionType} 应使用 ${expectedMode}`);
  }
}

function InputBlock({ label, value, onChange, rows = 4, readOnly = false }) {
  return (
    <label className="block rounded-md border border-slate-200 bg-white p-3">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        rows={rows}
        className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-blue-400 focus:bg-white read-only:bg-slate-100"
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

function TrainingResult({ result }) {
  return (
    <section className="rounded-md border border-emerald-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">结构化训练方案</h2>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
          confidence {Math.round(result.confidence * 100)}%
        </span>
      </div>

      <div className="space-y-3 text-sm">
        <ResultRow label="targetAbility" value={result.targetAbility} />
        <ResultRow label="rootCause" value={result.rootCause} />
        <ResultRow label="trainingGoal" value={result.trainingGoal} />
        <ResultRow label="trainingStrategy" value={result.trainingStrategy} />
        <ResultList label="trainingSteps" items={result.trainingSteps} />
        <ResultList label="practiceTasks" items={result.practiceTasks} />
        <ResultList label="coachGuidance" items={result.coachGuidance} />
        <ResultList label="completionCriteria" items={result.completionCriteria} />
        <ResultRow label="nextEvaluation" value={result.nextEvaluation} />
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
