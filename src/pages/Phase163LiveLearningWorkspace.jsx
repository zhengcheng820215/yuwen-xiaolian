import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, RefreshCw, Save } from 'lucide-react';
import {
  advancePhase163LiveRound,
  loadPhase163LiveWorkspace,
  savePhase163LiveDraft,
  submitPhase163LiveAnswer,
} from '../api/phase163LiveLearning.ts';

export default function Phase163LiveLearningWorkspace({ onReturnToEntry }) {
  const [state, setState] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('neutral');
  const saveRequest = useRef(0);

  useEffect(() => {
    let active = true;
    loadPhase163LiveWorkspace()
      .then((next) => active && applyState(next))
      .catch((error) => active && showMessage(toMessage(error), 'error'))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  function applyState(next) {
    setState(next);
    setAnswer(next.answerDraft || '');
    setMessage(next.studentMessage || '');
    setMessageTone(next.studentMessage ? 'error' : 'neutral');
  }

  function showMessage(value, tone = 'neutral') {
    setMessage(value);
    setMessageTone(tone);
  }

  async function saveDraft() {
    if (!answer.trim() || busy) {
      showMessage('当前没有可保存的内容。', 'error');
      return;
    }
    const requestId = ++saveRequest.current;
    setBusy(true);
    try {
      await savePhase163LiveDraft(answer);
      if (requestId === saveRequest.current) showMessage('草稿已保存。', 'success');
    } catch (error) {
      if (requestId === saveRequest.current) showMessage(toMessage(error), 'error');
    } finally {
      if (requestId === saveRequest.current) setBusy(false);
    }
  }

  async function submitAnswer() {
    if (busy) return;
    if (!answer.trim()) {
      showMessage('请先输入回答再提交。', 'error');
      return;
    }
    saveRequest.current += 1;
    setBusy(true);
    showMessage('正在分析本次回答，请稍候。');
    try {
      applyState(await submitPhase163LiveAnswer(answer));
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function enterNextRound() {
    if (!state?.canAdvance || busy) return;
    setBusy(true);
    try {
      await advancePhase163LiveRound();
      applyState(await loadPhase163LiveWorkspace());
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!state && busy) return <LoadingWorkspace />;
  if (!state) return <WorkspaceFailure message={message} onBack={onReturnToEntry} />;

  const completed = state.status === 'completed';
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-5 md:px-8">
          <button
            type="button"
            onClick={onReturnToEntry}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="返回学习入口"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {state.isRetest ? <span className="font-medium text-blue-700">延迟复测</span> : null}
            <span>第 {state.roundNumber} 轮</span>
          </div>
        </div>
      </header>

      {completed ? (
        <CompletedFeedback state={state} busy={busy} onContinue={enterNextRound} />
      ) : (
        <main className="mx-auto grid min-h-[calc(100vh-65px)] w-full max-w-[1440px] lg:grid-cols-2">
          <section className="border-b border-slate-200 bg-[#f7f9fc] px-6 py-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10 xl:px-14">
            <div className="mx-auto max-w-[640px]">
              <h1 className="flex items-center gap-3 text-lg font-semibold">
                <BookOpen size={20} className="text-slate-500" />
                阅读材料
              </h1>
              <div className="mt-6 border-t border-slate-200 pt-7 text-base leading-8 text-slate-800">
                {state.task.readingText || '本题不需要额外阅读材料。'}
              </div>
            </div>
          </section>

          <section className="px-6 py-8 lg:px-10 lg:py-10 xl:px-14">
            <div className="mx-auto max-w-[640px]">
              <p className="text-sm text-slate-500">本题考查：{state.task.focus}</p>
              <h1 className="mt-7 text-lg font-semibold">题目</h1>
              <p className="mt-3 text-base leading-8 text-slate-800">{state.task.questionText}</p>

              <textarea
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (messageTone !== 'neutral') showMessage('');
                }}
                disabled={busy}
                aria-label="输入你的回答"
                placeholder="请在这里输入你的回答。"
                className="mt-7 min-h-[300px] w-full resize-y rounded-md border border-slate-300 bg-[#f8fafc] px-4 py-4 text-base leading-7 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-70"
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busy || !answer.trim()}
                  onClick={saveDraft}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <Save size={16} />保存草稿
                </button>
                <button
                  type="button"
                  disabled={busy || !answer.trim()}
                  onClick={submitAnswer}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  提交本轮回答
                </button>
              </div>

              {message ? (
                <p className={`mt-5 text-sm leading-6 ${messageTone === 'error' ? 'text-red-700' : messageTone === 'success' ? 'text-emerald-700' : 'text-slate-600'}`} aria-live="polite">
                  {message}
                </p>
              ) : null}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

function CompletedFeedback({ state, busy, onContinue }) {
  const positive = state.feedback?.whatYouDidWell?.slice(0, 1) || [];
  const attention = state.feedback?.whatNeedsAttention?.slice(0, 1) || [];
  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[800px] flex-col justify-center px-6 py-12">
      <CheckCircle2 size={26} className="text-emerald-600" />
      <h1 className="mt-4 text-lg font-semibold">反馈</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{state.feedback?.summary || '本轮结果已经保存。'}</p>
      {positive.length ? <FeedbackList title="做得好的地方" items={positive} tone="positive" /> : null}
      {attention.length ? <FeedbackList title="可以改进的地方" items={attention} tone="attention" /> : null}
      <div className="mt-10 flex justify-center">
        <button
          type="button"
          disabled={!state.canAdvance || busy}
          onClick={onContinue}
          className="flex min-h-11 min-w-52 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          进入下一轮任务
        </button>
      </div>
    </main>
  );
}

function FeedbackList({ title, items, tone }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold">{title}</h2>
      <ul className="mt-2 space-y-2 text-base leading-7 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className={`mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'positive' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LoadingWorkspace() {
  return <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-600"><RefreshCw size={17} className="animate-spin" />正在恢复学习任务</div>;
}

function WorkspaceFailure({ message, onBack }) {
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16">
      <h1 className="text-xl font-semibold">暂时无法打开当前任务</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{message || '请稍后重新尝试。'}</p>
      <button type="button" onClick={onBack} className="mt-7 min-h-11 rounded-md bg-slate-900 px-5 text-sm text-white">返回学习入口</button>
    </main>
  );
}

function toMessage(error) {
  const value = error instanceof Error ? error.message : String(error);
  if (/api|provider|diagnosis|prompt|schema/i.test(value)) {
    return '本次分析暂时没有完成，已有回答已经保留，请稍后再试。';
  }
  return value;
}
