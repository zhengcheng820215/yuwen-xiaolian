import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { diagnosis } from '../api/diagnosis';
import { generateQuestionMetadata } from '../api/questionMetadata';
import { training } from '../api/training';
import {
  getQuestionConfigById,
  questionConfigs,
  toQuestionMetadata,
} from '../data/questionConfigs';

const initialConfig = questionConfigs[0];
const initialForm = buildFormFromConfig(initialConfig);
const initialCustomForm = {
  question: '请分析“照亮了父亲对我的牵挂”的含义。',
  referenceAnswer: '“照亮”不是指灯光真正照亮，而是指作者通过这盏灯感受到父亲一直以来的关爱和牵挂，表达了作者对父亲爱的理解和感动。',
  studentAnswer: '父亲用灯给我照亮回家的路。',
};

export default function DiagnosisDemo() {
  const [mode, setMode] = useState('preset');
  const [selectedConfigId, setSelectedConfigId] = useState(initialConfig.id);
  const [form, setForm] = useState(initialForm);
  const [customForm, setCustomForm] = useState(initialCustomForm);
  const [metadataResult, setMetadataResult] = useState(null);
  const [result, setResult] = useState(null);
  const [trainingResult, setTrainingResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateCustomField = (field, value) => {
    setCustomForm((current) => ({ ...current, [field]: value }));
    setMetadataResult(null);
    setResult(null);
    setTrainingResult(null);
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setResult(null);
    setTrainingResult(null);
    setError('');
  };

  const handleConfigChange = (configId) => {
    const config = getQuestionConfigById(configId);
    setSelectedConfigId(config.id);
    setForm(buildFormFromConfig(config));
    setResult(null);
    setTrainingResult(null);
    setError('');
  };

  const handleGenerateMetadata = async () => {
    setMetadataLoading(true);
    setError('');
    setMetadataResult(null);
    setResult(null);
    setTrainingResult(null);

    try {
      const generated = await generateQuestionMetadata({
        question: customForm.question,
        referenceAnswer: customForm.referenceAnswer,
      });
      setMetadataResult(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Metadata 生成失败，请稍后重试。');
    } finally {
      setMetadataLoading(false);
    }
  };

  const handleDiagnose = async () => {
    const selectedConfig = getQuestionConfigById(selectedConfigId);

    setLoading(true);
    setError('');
    setResult(null);
    setTrainingResult(null);

    try {
      const payload = mode === 'preset'
        ? buildDiagnosisPayload(form, selectedConfig)
        : buildCustomDiagnosisPayload(customForm, metadataResult);
      console.log('[DiagnosisDemo] mode', mode);
      console.log('[DiagnosisDemo] selected questionConfig', mode === 'preset' ? selectedConfig : null);
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
    const currentQuestion = mode === 'preset' ? selectedConfig.questionText : customForm.question;
    const currentStudentAnswer = mode === 'preset' ? form.studentAnswer : customForm.studentAnswer;

    setTrainingLoading(true);
    setError('');
    setTrainingResult(null);

    try {
      const plan = await training({
        diagnosisResult: result,
        question: currentQuestion,
        studentAnswer: currentStudentAnswer,
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
  const customMetadataPreview = metadataResult
    ? JSON.stringify(metadataResult.metadata, null, 2)
    : '';

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader title="Diagnosis Demo" subtitle="验证前端到 Diagnosis Agent 的结构化 JSON 链路" />

      <div className="space-y-4 px-4 pb-8">
        <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-white p-2">
          <ModeButton active={mode === 'preset'} onClick={() => handleModeChange('preset')}>
            内置题目
          </ModeButton>
          <ModeButton active={mode === 'custom'} onClick={() => handleModeChange('custom')}>
            自定义题目
          </ModeButton>
        </div>

        {mode === 'preset' ? (
          <>
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

            <InputBlock label="题目" value={form.question} readOnly />
            <InputBlock label="参考答案" value={form.referenceAnswer} readOnly />
            <InputBlock
              label="学生答案"
              value={form.studentAnswer}
              onChange={(value) => updateField('studentAnswer', value)}
            />
            <InputBlock label="Question Metadata" value={metadataPreview} readOnly rows={10} />
          </>
        ) : (
          <>
            <InputBlock
              label="题目"
              value={customForm.question}
              onChange={(value) => updateCustomField('question', value)}
            />
            <InputBlock
              label="参考答案"
              value={customForm.referenceAnswer}
              onChange={(value) => updateCustomField('referenceAnswer', value)}
            />
            <InputBlock
              label="学生答案"
              value={customForm.studentAnswer}
              onChange={(value) => updateCustomField('studentAnswer', value)}
            />

            <button
              type="button"
              onClick={handleGenerateMetadata}
              disabled={metadataLoading}
              className="min-h-12 w-full rounded-md bg-slate-800 px-4 text-sm font-semibold text-white transition disabled:bg-slate-300"
            >
              {metadataLoading ? '生成中...' : '生成 Metadata'}
            </button>

            {metadataResult && <MetadataResult result={metadataResult} />}
            <InputBlock
              label="Generated Question Metadata"
              value={customMetadataPreview}
              readOnly
              rows={10}
            />
          </>
        )}

        <button
          type="button"
          onClick={handleDiagnose}
          disabled={loading || (mode === 'custom' && !metadataResult?.validation?.valid)}
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

function buildCustomDiagnosisPayload(form, metadataResult) {
  if (!metadataResult?.validation?.valid) {
    throw new Error('请先生成并通过校验 Question Metadata。');
  }

  return {
    question: form.question,
    referenceAnswer: form.referenceAnswer,
    studentAnswer: form.studentAnswer,
    questionMetadata: metadataResult.metadata,
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

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-md px-3 text-sm font-semibold transition ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
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

function MetadataResult({ result }) {
  const { validation, confidence } = result;
  const stateClass = validation.valid
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-red-200 bg-red-50 text-red-800';

  return (
    <section className={`rounded-md border p-3 text-sm ${stateClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">
          Metadata 校验：{validation.valid ? 'valid' : 'invalid'}
        </div>
        <div className="rounded-md bg-white/70 px-2 py-1 text-xs font-semibold">
          confidence {Math.round(confidence * 100)}%
        </div>
      </div>
      {validation.errors.length > 0 && (
        <ResultList label="errors" items={validation.errors} />
      )}
      {validation.warnings.length > 0 && (
        <ResultList label="warnings" items={validation.warnings} />
      )}
      {validation.errors.length === 0 && validation.warnings.length === 0 && (
        <div className="mt-2 leading-6">Metadata 已通过校验，可以进入诊断。</div>
      )}
    </section>
  );
}

function DiagnosisResult({ result }) {
  const feedback = getDiagnosisFeedback(result);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">结构化诊断结果</h2>
        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
          confidence {Math.round(result.confidence * 100)}%
        </span>
      </div>

      <div className="space-y-3 text-sm">
        <div className={`rounded-md border p-3 ${feedback.className}`}>
          <div className="text-xs font-semibold">反馈类型</div>
          <div className="mt-1 text-base font-semibold">{feedback.label}</div>
          <div className="mt-1 leading-6">{feedback.description}</div>
        </div>
        <ResultRow label="answerStatus" value={result.answerStatus || feedback.statusFallback} />
        <ResultRow label="scoreBand" value={result.scoreBand || feedback.scoreFallback} />
        <ResultRow label="correct" value={formatCorrect(result.correct)} />
        <ResultRow label="mainAbility" value={result.mainAbility} />
        <ResultRow label="surfaceError" value={result.surfaceError} />
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

function getDiagnosisFeedback(result) {
  if (result.answerStatus === 'insufficient_evidence' || result.scoreBand === 'invalid') {
    return {
      label: '答案无效 / 无法评估',
      description: '学生答案缺少有效作答内容，本轮不判断具体能力缺口。',
      className: 'border-slate-200 bg-slate-50 text-slate-700',
      statusFallback: 'insufficient_evidence',
      scoreFallback: 'invalid',
    };
  }

  if (result.answerStatus === 'fully_meets' || result.correct === true) {
    return {
      label: '答案匹配 / 基本满足',
      description: '学生答案覆盖主要要求，可作为正向能力证据。',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      statusFallback: 'fully_meets',
      scoreFallback: 'high',
    };
  }

  if (result.answerStatus === 'partially_meets') {
    return {
      label: '部分匹配 / 部分满足',
      description: '学生答案有相关内容，但仍缺少关键能力要点。',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
      statusFallback: 'partially_meets',
      scoreFallback: 'medium',
    };
  }

  return {
    label: '答案不匹配 / 未满足',
    description: '学生答案有作答内容，但尚未满足本题主要要求。',
    className: 'border-red-200 bg-red-50 text-red-800',
    statusFallback: result.correct === false ? 'does_not_meet' : '待验证',
    scoreFallback: 'low',
  };
}

function formatCorrect(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return 'null';
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
