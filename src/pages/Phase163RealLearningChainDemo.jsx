import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CircleAlert,
  CircleX,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  getPhase163DemoCases,
  loadPhase163DemoTask,
  resetPhase163DemoCase,
  runPhase163DemoCase,
} from '../api/phase163RealLearningChainDemo.ts';

const cases = getPhase163DemoCases();

export default function Phase163RealLearningChainDemo() {
  const navigate = useNavigate();
  const [caseId, setCaseId] = useState(cases[0].id);
  const selectedCase = useMemo(() => cases.find((item) => item.id === caseId) || cases[0], [caseId]);
  const [task, setTask] = useState(null);
  const [answer, setAnswer] = useState(selectedCase.defaultAnswer);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadPhase163DemoTask()
      .then((value) => active && setTask(value))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  function selectCase(nextId) {
    const nextCase = cases.find((item) => item.id === nextId) || cases[0];
    setCaseId(nextId);
    setAnswer(nextCase.defaultAnswer);
    setResult(null);
    setError('');
    resetPhase163DemoCase(nextId);
  }

  async function submit() {
    if (busy || !answer.trim()) return;
    setBusy(true);
    setError('');
    try {
      setResult(await runPhase163DemoCase(caseId, answer));
    } catch (runError) {
      setError(toMessage(runError));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    resetPhase163DemoCase(caseId);
    setAnswer(selectedCase.defaultAnswer);
    setResult(null);
    setError('');
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center gap-4 px-5 lg:px-10">
          <button
            type="button"
            aria-label="返回验收入口"
            title="返回验收入口"
            onClick={() => navigate('/internal/acceptance')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold">真实学习主链联调</h1>
              <span className="text-sm font-semibold text-blue-600">Phase 16.3A</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">正式资源 → 作答 → Diagnosis → Evidence → Memory → 下一正式任务</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10 lg:py-8">
        <section className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold text-blue-600">轻量人工联调</p>
          <h2 className="mt-2 text-lg font-semibold">确认正常链能走通，异常链能停在正确位置</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            本页调用正式 16.3A Orchestrator 和 Scripted Provider。学生题目区不展示内部 ID，运行检查集中在右侧验收区。
          </p>
        </section>

        <section className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="联调 Case">
          {cases.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectCase(item.id)}
              className={[
                'flex min-h-[64px] items-center gap-3 rounded-md border px-3 py-3 text-left transition',
                item.id === caseId
                  ? 'border-blue-500 bg-blue-50 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              <span className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                item.id === caseId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500',
              ].join(' ')}>{index + 1}</span>
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <section className="min-w-0 rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-5 lg:px-7">
              <p className="text-sm font-semibold text-slate-500">学生任务预览</p>
              <h2 className="mt-2 text-lg font-semibold">{task?.title || '正在准备正式任务'}</h2>
              <p className="mt-2 text-sm text-slate-600">本题考查：{task?.focus || '推理'}</p>
            </div>

            {busy && !task ? (
              <div className="flex min-h-[360px] items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={18} /> 正在读取 Frozen Resource
              </div>
            ) : (
              <div className="space-y-6 px-5 py-5 lg:px-7">
                <div>
                  <h3 className="text-base font-semibold">阅读材料</h3>
                  <p className="mt-3 text-base leading-8 text-slate-800">{task?.readingText}</p>
                </div>
                <div>
                  <h3 className="text-base font-semibold">题目</h3>
                  <p className="mt-3 text-base leading-7 text-slate-800">{task?.questionText}</p>
                </div>
                <div>
                  <textarea
                    value={answer}
                    onChange={(event) => {
                      setAnswer(event.target.value);
                      setResult(null);
                      setError('');
                    }}
                    aria-label="学生回答"
                    placeholder="请在这里输入你的回答。"
                    className="min-h-[180px] w-full resize-y rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-base leading-7 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="mt-3 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={reset}
                      disabled={busy}
                      className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RotateCcw size={16} /> 重置 Case
                    </button>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={busy || !answer.trim()}
                      className="flex min-h-11 min-w-40 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {busy ? <Loader2 className="animate-spin" size={16} /> : result ? <RefreshCw size={16} /> : <ArrowRight size={16} />}
                      {result ? '重复提交同一答案' : '提交本轮回答'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="min-w-0 space-y-5">
            <section className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">当前 Case</p>
              <h2 className="mt-2 text-lg font-semibold">{selectedCase.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedCase.description}</p>
              <div className="mt-4 border-l-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                <span className="font-semibold">预期：</span>{selectedCase.expected}
              </div>
            </section>

            {error ? (
              <section className="rounded-md border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800">
                {error}
              </section>
            ) : null}

            {result ? <ResultPanel result={result} /> : (
              <section className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-sm leading-6 text-slate-500">
                提交后，这里会显示学生可读结果和独立的运行验收信息。
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function ResultPanel({ result }) {
  const tone = result.status === 'completed'
    ? 'success'
    : result.status === 'review_required'
      ? 'review'
      : 'blocked';
  return (
    <>
      <section className="rounded-md border border-slate-200 bg-white p-5" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">学生可读结果</p>
            <h2 className="mt-2 text-lg font-semibold">{result.headline}</h2>
          </div>
          <StatusBadge tone={tone} text={statusLabel(result.status)} />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">{result.summary}</p>
        {result.whatYouDidWell.length > 0 ? <FeedbackList title="做得好的地方" items={result.whatYouDidWell} /> : null}
        {result.whatNeedsAttention.length > 0 ? <FeedbackList title="需要留意" items={result.whatNeedsAttention} attention /> : null}
        <p className="mt-4 text-sm font-semibold leading-6 text-slate-800">{result.nextActionText}</p>
      </section>

      {result.nextTask ? (
        <section className="rounded-md border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-700">下一道正式任务已准备</p>
          <h2 className="mt-2 text-base font-semibold">{result.nextTask.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{result.nextTask.questionText}</p>
        </section>
      ) : null}

      {result.replayed ? (
        <section
          className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"
          role="status"
        >
          <ShieldCheck className="mt-0.5 shrink-0 text-blue-600" size={18} />
          <div>
            <p className="font-semibold">幂等检查通过：已复用正式结果</p>
            <p className="mt-1">没有重复调用 Diagnosis Provider，也没有重复生成 Evidence。</p>
          </div>
        </section>
      ) : null}

      <details className="rounded-md border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">开发者验收信息</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label="当前阶段" value={result.stage} />
          <Metric label="Provider 调用" value={`${result.providerCallCount} 次`} />
          <Metric label="Evidence 数量" value={`${result.evidenceCount} 条`} />
          <Metric label="重复执行" value={result.replayed ? '已复用正式结果' : '首次执行'} />
        </div>
        <div className="mt-4 space-y-2">
          {result.checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2 text-sm text-slate-700">
              {check.passed ? <Check size={16} className="text-emerald-600" /> : <CircleX size={16} className="text-slate-300" />}
              <span>{check.label}</span>
            </div>
          ))}
        </div>
        {result.issues.length > 0 ? (
          <div className="mt-4 flex gap-2 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            <CircleAlert className="mt-1 shrink-0" size={16} />
            <span>{result.issues.join('；')}</span>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
            <ShieldCheck size={17} /> 当前分支没有未处理问题
          </div>
        )}
      </details>
    </>
  );
}

function FeedbackList({ title, items, attention = false }) {
  return (
    <div className="mt-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${attention ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm text-slate-800">{value}</p>
    </div>
  );
}

function StatusBadge({ tone, text }) {
  const className = {
    success: 'bg-emerald-50 text-emerald-700',
    review: 'bg-amber-50 text-amber-800',
    blocked: 'bg-rose-50 text-rose-700',
  }[tone];
  return <span className={`rounded px-2.5 py-1 text-xs font-semibold ${className}`}>{text}</span>;
}

function statusLabel(status) {
  return {
    completed: '完整通过',
    retry_required: '需要补充',
    review_required: '等待复核',
    blocked: '安全阻断',
  }[status] || status;
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
