import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import {
  clearTaskResourcePreparationDemo,
  createTaskResourceDemo,
  getTaskResourcePreparationDemoInput,
  saveTaskResourceDraftDemo,
} from '../api/taskResourcePreparation';

const defaultInput = getTaskResourcePreparationDemoInput();

export default function TaskResourcePreparationDemo() {
  const [form, setForm] = useState(toForm(defaultInput));
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function saveDraft() {
    setBusy(true);
    try {
      const nextResult = await saveTaskResourceDraftDemo(toInput(form));
      setResult(nextResult);
      setStatus({
        type: 'success',
        title: '草稿已保存',
        message: '草稿可以不完整保存；是否能生成正式资源，需要看校验结果。',
      });
    } catch (error) {
      setStatus(toErrorStatus(error, '草稿保存失败'));
    } finally {
      setBusy(false);
    }
  }

  async function createResource() {
    setBusy(true);
    try {
      const nextResult = await createTaskResourceDemo(toInput(form));
      setResult(nextResult);
      setStatus(nextResult.resource
        ? {
          type: 'success',
          title: '已生成正式任务资源',
          message: '该资源已通过 TaskFulfillment 生成 ConcreteLearningTask。',
        }
        : {
          type: 'warning',
          title: '暂不能生成正式资源',
          message: '请根据校验结果补全题目资源。',
        });
    } catch (error) {
      setStatus(toErrorStatus(error, '正式资源生成失败'));
    } finally {
      setBusy(false);
    }
  }

  async function clearResources() {
    setBusy(true);
    try {
      await clearTaskResourcePreparationDemo();
      setResult(null);
      setStatus({
        type: 'success',
        title: '已清除 Demo 资源',
        message: '浏览器中的共享题目资源与草稿已清空。',
      });
    } catch (error) {
      setStatus(toErrorStatus(error, '清除失败'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="真实题目资源准备"
        subtitle="Phase 12.2 轻量 Demo"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">本阶段验收重点</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            把一道真实题目转换为可执行任务资源
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            本页是资源准备入口，不是学生作答页。它只验证题目能否保存为草稿、生成正式 TaskResource，并通过 TaskFulfillment 变成 ConcreteLearningTask。
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">题目内容</h2>
          <Field label="资源标题">
            <input
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-base text-slate-950 outline-none focus:border-blue-500"
            />
          </Field>
          <Field label="外部编号">
            <input
              value={form.externalResourceId}
              onChange={(event) => update('externalResourceId', event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-base text-slate-950 outline-none focus:border-blue-500"
            />
          </Field>
          <Field label="阅读材料">
            <textarea
              value={form.readingText}
              onChange={(event) => update('readingText', event.target.value)}
              rows={6}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
            />
          </Field>
          <Field label="题干">
            <textarea
              value={form.questionText}
              onChange={(event) => update('questionText', event.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
            />
          </Field>
          <Field label="作答要求（一行一条）">
            <textarea
              value={form.answerRequirements}
              onChange={(event) => update('answerRequirements', event.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
            />
          </Field>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">结构化信息</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="题型">
              <select
                value={form.questionType}
                onChange={(event) => update('questionType', event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white p-3 text-base text-slate-950 outline-none focus:border-blue-500"
              >
                <option value="reading_open_response">阅读开放题</option>
                <option value="sentence_interpretation">句子含义题</option>
                <option value="expression">表达题</option>
                <option value="micro_writing">微写作</option>
              </select>
            </Field>
            <Field label="目标能力">
              <select
                value={form.targetAbilityId}
                onChange={(event) => update('targetAbilityId', event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white p-3 text-base text-slate-950 outline-none focus:border-blue-500"
              >
                <option value="推理">推理</option>
                <option value="理解">理解</option>
                <option value="概括">概括</option>
                <option value="表达">表达</option>
              </select>
            </Field>
          </div>
          <Field label="参考答案">
            <textarea
              value={form.referenceAnswer}
              onChange={(event) => update('referenceAnswer', event.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
            />
          </Field>
          <Field label="评价依据（一行一条）">
            <textarea
              value={form.assessmentBasis}
              onChange={(event) => update('assessmentBasis', event.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
            />
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="来源类型">
              <select
                value={form.sourceType}
                onChange={(event) => update('sourceType', event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white p-3 text-base text-slate-950 outline-none focus:border-blue-500"
              >
                <option value="manual">人工录入</option>
                <option value="textbook">教材</option>
                <option value="exam">试卷</option>
              </select>
            </Field>
            <Field label="年级">
              <input
                value={form.sourceGrade}
                onChange={(event) => update('sourceGrade', event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white p-3 text-base text-slate-950 outline-none focus:border-blue-500"
              />
            </Field>
          </div>
          <Field label="来源说明">
            <input
              value={form.sourceDescription}
              onChange={(event) => update('sourceDescription', event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-base text-slate-950 outline-none focus:border-blue-500"
            />
          </Field>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">操作</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={saveDraft}
              className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 disabled:text-slate-400"
            >
              保存草稿
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={createResource}
              className="rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              生成正式资源
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={clearResources}
              className="rounded-md bg-slate-950 px-3 py-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              清除 Demo 资源
            </button>
          </div>
          {status ? <StatusPanel status={status} /> : null}
        </section>

        {result?.validation ? <ValidationPanel validation={result.validation} /> : null}
        {result?.resource ? <ResourcePanel resource={result.resource} /> : null}
        {result?.preparation ? <ConcreteTaskPanel preparation={result.preparation} /> : null}

        <details className="rounded-md border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-base font-semibold text-slate-950">
            开发者调试信息
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-700">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </main>
    </div>
  );

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setResult(null);
    setStatus(null);
  }
}

function ValidationPanel({ validation }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-950">Resource Validation</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Badge label="可保存草稿" active={validation.canSaveDraft} />
        <Badge label="可生成资源" active={validation.canCreateResource} />
        <Badge label="可进入 Runtime" active={validation.canEnterTaskFulfillment} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {Object.entries(validation.checks).map(([key, value]) => (
          <div key={key} className="rounded-md bg-slate-50 p-3 text-sm">
            <span className="font-semibold text-slate-500">{formatCheckLabel(key)}</span>
            <span className={value ? 'ml-2 text-emerald-700' : 'ml-2 text-red-600'}>
              {value ? '通过' : '未通过'}
            </span>
          </div>
        ))}
      </div>
      {validation.issues.length > 0 ? (
        <div className="mt-3 rounded-md bg-amber-50 p-3">
          <h3 className="text-sm font-semibold text-amber-800">需要处理</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-800">
            {validation.issues.map((issue) => (
              <li key={issue.code}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ResourcePanel({ resource }) {
  return (
    <section className="rounded-md border border-emerald-200 bg-white p-4">
      <p className="text-sm font-semibold text-emerald-700">正式 TaskResource</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">{resource.title}</h2>
      <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <p><strong>resourceId：</strong>{resource.resourceId}</p>
        <p><strong>目标能力：</strong>{resource.targetAbilityId}</p>
        <p><strong>题型：</strong>{formatQuestionType(resource.questionType)}</p>
        <p><strong>评价依据：</strong>{resource.assessmentBasis.length} 条</p>
      </div>
    </section>
  );
}

function ConcreteTaskPanel({ preparation }) {
  const task = preparation.concreteTaskResult.concreteTask;
  const readiness = preparation.concreteTaskResult.readiness;

  return (
    <section className="rounded-md border border-blue-200 bg-white p-4">
      <p className="text-sm font-semibold text-blue-700">ConcreteLearningTask</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">
        {readiness.canExecute ? '已生成可执行任务' : '任务尚不可执行'}
      </h2>
      <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm leading-6 text-slate-700">
        <p><strong>匹配状态：</strong>{preparation.matchResult.status}</p>
        <p><strong>任务 ID：</strong>{task?.taskId || '未生成'}</p>
        <p><strong>能否执行：</strong>{readiness.canExecute ? '可以' : '不可以'}</p>
      </div>
      {task ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-md bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-500">题目</h3>
            <p className="mt-1 text-base leading-7 text-slate-950">{task.question}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-500">作答要求</h3>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
              {task.answerRequirements.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatusPanel({ status }) {
  const style = status.type === 'success'
    ? 'border-emerald-200 bg-emerald-50'
    : status.type === 'warning'
      ? 'border-amber-200 bg-amber-50'
      : 'border-red-200 bg-red-50';
  return (
    <div className={`mt-3 rounded-md border p-3 ${style}`}>
      <h3 className="text-sm font-semibold text-slate-950">{status.title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">{status.message}</p>
    </div>
  );
}

function Badge({ label, active }) {
  return (
    <div className={active ? 'rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700' : 'rounded-md bg-red-50 p-3 text-sm font-semibold text-red-600'}>
      {label}：{active ? '是' : '否'}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="mt-3 block">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function toForm(input) {
  return {
    title: input.title || '',
    externalResourceId: input.externalResourceId || '',
    readingText: input.readingText || '',
    questionText: input.questionText || '',
    answerRequirements: input.answerRequirements.join('\n'),
    questionType: input.questionType,
    targetAbilityId: input.targetAbilityId,
    referenceAnswer: input.referenceAnswer || '',
    assessmentBasis: input.assessmentBasis.join('\n'),
    sourceType: input.source.type,
    sourceDescription: input.source.description || '',
    sourceGrade: input.source.grade || '',
  };
}

function toInput(form) {
  return {
    title: form.title,
    externalResourceId: form.externalResourceId,
    readingText: form.readingText,
    questionText: form.questionText,
    answerRequirements: splitLines(form.answerRequirements),
    questionType: form.questionType,
    targetAbilityId: form.targetAbilityId,
    referenceAnswer: form.referenceAnswer,
    assessmentBasis: splitLines(form.assessmentBasis),
    source: {
      type: form.sourceType,
      description: form.sourceDescription,
      grade: form.sourceGrade,
    },
  };
}

function splitLines(value) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toErrorStatus(error, title) {
  return {
    type: 'error',
    title,
    message: error instanceof Error ? error.message : '操作失败。',
  };
}

function formatQuestionType(value) {
  const labels = {
    reading_open_response: '阅读开放题',
    sentence_interpretation: '句子含义题',
    expression: '表达题',
    micro_writing: '微写作',
  };
  return labels[value] || value;
}

function formatCheckLabel(value) {
  const labels = {
    hasQuestionText: '题干',
    hasAnswerRequirements: '作答要求',
    hasAssessmentBasis: '评价依据',
    hasTargetAbility: '目标能力',
    hasSource: '来源',
    readingTextRequired: '需要阅读材料',
    readingTextProvided: '阅读材料',
    abilityAligned: '能力一致',
    metadataReady: '元数据可用',
    traceable: '可追溯',
    resourceIdUnique: '资源 ID 唯一',
  };
  return labels[value] || value;
}
