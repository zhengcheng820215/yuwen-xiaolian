import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, RefreshCw, Save } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import {
  clearContinuousLearningDemo,
  continueContinuousLearningDemo,
  loadContinuousLearningDemo,
  saveContinuousLearningDraft,
  submitContinuousLearningAnswer,
} from '../api/continuousLearningDemo';

export default function ContinuousLearningDemo() {
  const [state, setState] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [simulatePersistenceFailure, setSimulatePersistenceFailure] = useState(false);

  useEffect(() => {
    let active = true;
    loadContinuousLearningDemo()
      .then((nextState) => {
        if (active) applyState(nextState);
      })
      .catch((loadError) => {
        if (active) setError(toMessage(loadError));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function applyState(nextState) {
    setState(nextState);
    setAnswer(nextState.answerDraft || '');
    setError('');
  }

  async function saveDraft(currentAnswer = answer) {
    if (!state || state.mode !== 'task') return;
    try {
      applyState(await saveContinuousLearningDraft(currentAnswer));
    } catch (saveError) {
      setError(`草稿保存失败：${toMessage(saveError)}`);
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      applyState(await submitContinuousLearningAnswer({
        answerText: answer,
        simulatePersistenceFailure,
      }));
      setSimulatePersistenceFailure(false);
    } catch (submitError) {
      setError(`本轮提交失败：${toMessage(submitError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function continueLearning() {
    if (!state?.canContinue || busy) return;
    setBusy(true);
    try {
      applyState(await continueContinuousLearningDemo());
    } catch (continueError) {
      setError(`下一轮启动失败：${toMessage(continueError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function resetDemo() {
    setBusy(true);
    try {
      applyState(await clearContinuousLearningDemo());
    } catch (resetError) {
      setError(`重置失败：${toMessage(resetError)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader title="连续多轮学习" subtitle="Phase 12.3 轻量 Demo" back />

      <main className="space-y-4 px-4 pb-10">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">三轮最小连续学习</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">上一轮保存完成，才能进入下一轮</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            每轮使用不同阅读材料。刷新页面后会恢复当前任务、答案草稿或已完成反馈，不会重新生成同一轮结果。
          </p>
        </section>

        <RoundProgress
          current={state?.roundIndex || 1}
          completed={state?.completedRoundCount || 0}
          total={state?.maxRounds || 3}
        />

        {busy && !state ? <LoadingPanel /> : null}
        {error ? <Notice tone="error" title="暂时无法继续" text={error} /> : null}

        {state?.mode === 'task' ? (
          <TaskPanel
            state={state}
            answer={answer}
            busy={busy}
            onAnswerChange={(value) => {
              setAnswer(value);
              setState((current) => current ? { ...current, feedback: undefined } : current);
            }}
            onAnswerBlur={saveDraft}
            onSaveDraft={() => saveDraft(answer)}
            onSubmit={submitAnswer}
          />
        ) : null}

        {state?.mode === 'feedback' ? (
          <CompletedRoundPanel state={state} busy={busy} onContinue={continueLearning} />
        ) : null}

        {state?.mode === 'finished' ? (
          <FinishedPanel state={state} busy={busy} onReset={resetDemo} />
        ) : null}

        {state?.mode === 'error' ? (
          <ErrorRoundPanel state={state} busy={busy} onRetry={submitAnswer} onReset={resetDemo} />
        ) : null}

        {state ? (
          <DeveloperPanel
            state={state}
            simulatePersistenceFailure={simulatePersistenceFailure}
            onSimulationChange={setSimulatePersistenceFailure}
            onReset={resetDemo}
            busy={busy}
          />
        ) : null}
      </main>
    </div>
  );
}

function RoundProgress({ current, completed, total }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">学习进度</h2>
        <span className="text-sm font-medium text-slate-500">已完成 {completed} / {total}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2" aria-label={`当前第 ${current} 轮`}>
        {Array.from({ length: total }, (_, index) => {
          const round = index + 1;
          const isCompleted = round <= completed;
          const isCurrent = round === current && !isCompleted;
          return (
            <div
              key={round}
              className={`flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold ${
                isCompleted
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : isCurrent
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              {isCompleted ? <CheckCircle2 size={17} /> : <Circle size={17} />}
              第 {round} 轮
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TaskPanel({ state, answer, busy, onAnswerChange, onAnswerBlur, onSaveDraft, onSubmit }) {
  const entry = state.entryState;
  return (
    <>
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-blue-700">本轮关注</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          {entry?.studentRoundFocus?.title || '推理能力'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {entry?.studentRoundFocus?.description || '根据文本行为，说明人物心理。'}
        </p>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-950">阅读材料</h2>
        <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-slate-800">{entry?.readingText}</p>
        <div className="my-4 border-t border-slate-200" />
        <h3 className="text-base font-semibold text-slate-950">题目</h3>
        <p className="mt-2 text-base leading-7 text-slate-800">{entry?.questionText}</p>
        <h3 className="mt-4 text-sm font-semibold text-slate-700">作答要求</h3>
        <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
          {(entry?.answerRequirements || []).map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <label htmlFor="continuous-learning-answer" className="text-base font-semibold text-slate-950">你的回答</label>
        <textarea
          id="continuous-learning-answer"
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          onBlur={(event) => onAnswerBlur(event.currentTarget.value)}
          rows={7}
          placeholder="先写出人物心理，再引用文本行为说明理由。"
          className="mt-3 w-full rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">刷新前可先保存当前答案</p>
          <button
            type="button"
            disabled={busy}
            onClick={onSaveDraft}
            className="flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:text-slate-400"
          >
            <Save size={16} />
            保存草稿
          </button>
        </div>
        <button
          type="button"
          disabled={!answer.trim() || busy}
          onClick={onSubmit}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-base font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? <RefreshCw className="animate-spin" size={19} /> : <ArrowRight size={19} />}
          {busy ? '正在分析并保存' : '提交本轮回答'}
        </button>
      </section>

      {state.feedback ? <FeedbackPanel feedback={state.feedback} /> : null}
      <Notice tone="info" title="当前状态" text={state.message} />
    </>
  );
}

function CompletedRoundPanel({ state, busy, onContinue }) {
  return (
    <>
      <Notice tone="success" title="本轮已保存" text={state.message} />
      <FeedbackPanel feedback={state.feedback} />
      {state.roundSummary ? (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">本轮小结</h2>
          <p className="mt-3 text-base leading-7 text-slate-700">{state.roundSummary.studentReadableResult}</p>
          <p className="mt-3 text-sm leading-6 text-slate-500">{state.roundSummary.nextActionText}</p>
        </section>
      ) : null}
      <button
        type="button"
        disabled={!state.canContinue || busy}
        onClick={onContinue}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-base font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {busy ? <RefreshCw className="animate-spin" size={19} /> : <ArrowRight size={19} />}
        进入下一轮
      </button>
    </>
  );
}

function FinishedPanel({ state, busy, onReset }) {
  return (
    <>
      <section className="rounded-md border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={34} />
        <h2 className="mt-3 text-xl font-semibold text-slate-950">三轮学习已完成</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{state.message}</p>
      </section>
      <FeedbackPanel feedback={state.feedback} />
      <button
        type="button"
        disabled={busy}
        onClick={onReset}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        <RefreshCw size={19} />
        重新验收三轮流程
      </button>
    </>
  );
}

function ErrorRoundPanel({ state, busy, onRetry, onReset }) {
  return (
    <>
      <Notice tone="error" title="本轮暂未保存" text={state.message} />
      {state.feedback ? <FeedbackPanel feedback={state.feedback} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy || !state.answerDraft?.trim()}
          onClick={onRetry}
          className="min-h-12 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          重试本轮
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          className="min-h-12 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          重置 Demo
        </button>
      </div>
    </>
  );
}

function FeedbackPanel({ feedback }) {
  if (!feedback) return null;
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-blue-700">本轮反馈</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">{feedback.headline}</h2>
      <p className="mt-3 text-base leading-7 text-slate-700">{feedback.summary}</p>
      {feedback.whatYouDidWell?.length ? <FeedbackList title="已经做到" items={feedback.whatYouDidWell} tone="positive" /> : null}
      {feedback.whatNeedsAttention?.length ? <FeedbackList title="继续关注" items={feedback.whatNeedsAttention} tone="attention" /> : null}
      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="text-sm font-semibold text-slate-700">下一步</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{feedback.nextActionText}</p>
      </div>
    </section>
  );
}

function FeedbackList({ title, items, tone }) {
  const dotClass = tone === 'positive' ? 'bg-emerald-500' : 'bg-amber-500';
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ tone, title, text }) {
  const toneClass = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }[tone];
  return (
    <section className={`rounded-md border p-4 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{text}</p>
    </section>
  );
}

function LoadingPanel() {
  return (
    <section className="flex min-h-32 items-center justify-center rounded-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <RefreshCw className="animate-spin" size={18} />
        正在恢复学习进度
      </div>
    </section>
  );
}

function DeveloperPanel({ state, simulatePersistenceFailure, onSimulationChange, onReset, busy }) {
  return (
    <details className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-800">开发者验收信息</summary>
      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulatePersistenceFailure}
            onChange={(event) => onSimulationChange(event.target.checked)}
          />
          模拟下一次正式结果保存失败
        </label>
        <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">
          <dt>页面模式</dt><dd>{state.mode}</dd>
          <dt>存储记录数</dt><dd>{state.debug.recordCount}</dd>
          <dt>已完成回合</dt><dd>{state.debug.completedRoundIds.length}</dd>
          <dt>当前回合</dt><dd className="break-all">{state.debug.currentRoundId || '-'}</dd>
          <dt>策略追溯</dt><dd className="break-all">{state.debug.latestStrategyId || '-'}</dd>
          <dt>任务追溯</dt><dd className="break-all">{state.debug.latestTaskRequestId || '-'}</dd>
          <dt>成长记忆</dt><dd className="break-all">{state.debug.latestGrowthMemoryRecordId || '-'}</dd>
          <dt>问题</dt><dd>{state.debug.issues.join('；') || '无'}</dd>
        </dl>
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:text-slate-400"
        >
          <RefreshCw size={16} />
          重置三轮 Demo
        </button>
      </div>
    </details>
  );
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
