import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  getPhase163UnifiedEntryDemoCases,
  runPhase163UnifiedEntryDemoCase,
} from '../api/phase163UnifiedEntryDemo.ts';

const cases = getPhase163UnifiedEntryDemoCases();

export default function Phase163UnifiedEntryDemo() {
  const navigate = useNavigate();
  const [caseId, setCaseId] = useState(cases[0].id);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(true);
  const [actionNotice, setActionNotice] = useState('');
  const currentCase = useMemo(() => cases.find((item) => item.id === caseId) || cases[0], [caseId]);

  useEffect(() => {
    runCase(caseId);
  }, [caseId]);

  async function runCase(nextCaseId = caseId) {
    setBusy(true);
    setActionNotice('');
    try {
      setResult(await runPhase163UnifiedEntryDemoCase(nextCaseId));
    } finally {
      setBusy(false);
    }
  }

  const allPassed = result?.checks.every((item) => item.passed);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center gap-4 px-5 lg:px-10">
          <button
            type="button"
            aria-label="返回首页"
            title="返回首页"
            onClick={() => navigate('/')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold">统一学习入口验收</h1>
              <span className="text-sm font-semibold text-blue-600">Phase 16.3B</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">开始、恢复、反馈、复测、阻断与结束状态</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10 lg:py-8">
        <section className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold text-blue-600">轻量人工验收</p>
          <h2 className="mt-2 text-lg font-semibold">确认学生始终从一个清楚、安全的入口进入学习</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            左侧是受控验收 Case，中间只展示学生可见信息，右侧集中显示验收结果。复测 Case 使用正式计划结构，但不调用真实 Provider。
          </p>
        </section>

        <section className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="入口验收 Case">
          {cases.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-case-id={item.id}
              onClick={() => setCaseId(item.id)}
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

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section data-testid="student-entry-preview" className="min-w-0 rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-5 lg:px-7">
              <p className="text-sm font-semibold text-slate-500">学生入口预览</p>
              <p className="mt-1 text-sm text-slate-500">此区域不得出现 Schema、内部 ID、Prompt 或模型原始输出。</p>
            </div>
            {busy || !result ? (
              <div className="flex min-h-[390px] items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={18} /> 正在生成入口状态
              </div>
            ) : (
              <StudentEntryPreview
                state={result.state}
                actionNotice={actionNotice}
                onPrimaryAction={() => setActionNotice(actionMessage(result.state.primaryAction))}
              />
            )}
          </section>

          <aside className="min-w-0 space-y-5">
            <section className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">当前 Case</p>
              <h2 className="mt-2 text-lg font-semibold">{currentCase.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{currentCase.description}</p>
              <div className="mt-4 border-l-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                <span className="font-semibold">预期：</span>{currentCase.expected}
              </div>
            </section>

            <section data-testid="entry-run-checks" className="rounded-md border border-slate-200 bg-white p-5" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">运行检查</h2>
                {allPassed ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} />PASS</span>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                {result?.checks.map((item) => (
                  <div key={item.label} className="flex gap-3 text-sm leading-6">
                    <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {item.passed ? <Check size={13} /> : '×'}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800">{item.label}</p>
                      <p className="text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StudentEntryPreview({ state, actionNotice, onPrimaryAction }) {
  const ready = ['continue_round', 'delayed_retest_available', 'feedback_available', 'start_new_round'].includes(state.status);
  return (
    <div className="grid min-h-[390px] gap-10 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12 lg:py-10">
      <div>
        <p className={`flex items-center gap-2 text-sm font-semibold ${ready ? 'text-emerald-700' : 'text-slate-600'}`}>
          {ready ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
          {statusLabel(state.status)}
        </p>
        <h2 className="mt-3 text-xl font-semibold leading-8">{state.title}</h2>
        <p className="mt-3 max-w-[640px] text-base leading-7 text-slate-600">{state.message}</p>
        {state.hasDraft ? <p className="mt-6 text-sm font-medium text-blue-700">上次输入的答案草稿已经保留</p> : null}
        {state.retest ? (
          <div className="mt-6 border-l-2 border-blue-500 pl-4">
            <p className="text-sm font-semibold">待完成复测</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{state.retest.whyNow}</p>
          </div>
        ) : null}
        <button
          type="button"
          disabled={!state.canEnterWorkspace}
          onClick={onPrimaryAction}
          className="mt-8 flex min-h-11 min-w-44 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <ArrowRight size={16} />{state.primaryActionText}
        </button>
        {actionNotice ? (
          <p className="mt-4 text-sm font-medium leading-6 text-emerald-700" role="status">{actionNotice}</p>
        ) : null}
      </div>
      <aside className="border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
        <p className="text-sm font-semibold">学习进度</p>
        <dl className="mt-4 space-y-4 text-sm">
          <Progress label="已完成" value={`${state.completedRoundCount} 轮`} />
          <Progress label="当前状态" value={statusLabel(state.status)} />
          {state.currentRoundNumber ? <Progress label="当前任务" value={`第 ${state.currentRoundNumber} 轮`} /> : null}
        </dl>
      </aside>
    </div>
  );
}

function Progress({ label, value }) {
  return <div className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-800">{value}</dd></div>;
}

function statusLabel(status) {
  const labels = {
    review_required: '等待确认', blocked: '暂时无法继续', recovering_submission: '正在恢复',
    continue_round: '可以继续', delayed_retest_available: '复测待完成', feedback_available: '反馈可查看',
    start_new_round: '可以开始', session_ended: '本次学习已结束', no_task: '暂无任务',
  };
  return labels[status] || '学习状态';
}

function actionMessage(action) {
  const messages = {
    start_learning: '入口动作有效：可以进入本次学习。',
    continue_learning: '入口动作有效：将恢复同一轮学习。',
    start_retest: '入口动作有效：将从正式复测计划开始任务。',
    view_feedback: '入口动作有效：可以查看已保存的本轮反馈。',
    resume_processing: '入口动作有效：将查询并恢复已提交结果。',
    start_new_session: '入口动作有效：可以开始新的学习 Session。',
  };
  return messages[action] || '当前状态不允许进入学习任务。';
}
