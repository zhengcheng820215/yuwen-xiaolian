import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  runReadingOpenResponseStage4BrowserAcceptance,
} from '../api/readingOpenResponseStage4BrowserAcceptance.ts';

const STORAGE_KEY = 'reading-open-response-stage4-browser-acceptance:v1';

export default function ReadingOpenResponseStage4BrowserAcceptance() {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) setReport(JSON.parse(saved));
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  async function runMatrix() {
    if (running) return;
    setRunning(true);
    setError('');
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      const next = await runReadingOpenResponseStage4BrowserAcceptance();
      setReport(next);
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRunning(false);
    }
  }

  const completed = Boolean(report && report.passed === report.total);
  const preview = report?.preview || {
    originalQuestion: '请结合全文，从两个角度分析人物作出这一选择的原因，并说明其作用。',
    issueSummary: '题目同时要求多个独立核心动作，输入负担超过当前训练目标。',
    candidateQuestion: '请结合人物当时的处境，说明他作出这一选择的主要原因。',
    candidateResponseFormat: 'short_text',
    candidateHint: '先找人物面临的处境，再判断这个处境怎样促成了他的选择。',
    predecessorResourceVersionId: 'acceptance-resource-v1',
    successorResourceVersionId: 'acceptance-resource-v2',
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8">
          <Link to="/internal/acceptance" aria-label="返回验收入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">开放文本题阶段 4 浏览器验收</h1>
            <p className="text-sm text-slate-500">B4-01—B4-16 · 隔离运行，不进入真实校准分母</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8" data-testid="reading-open-response-stage4-acceptance">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><ShieldCheck size={16} />内部隔离验收</div>
              <h2 className="mt-3 text-xl font-semibold">治理、发布、Learning 冻结与真实校准边界</h2>
              <p className="mt-2 max-w-[760px] text-sm leading-6 text-slate-600">运行器调用正式治理 Agent、版本解析、过程事实与校准投影逻辑；页面状态只保存在当前标签页，用于验证刷新恢复。</p>
            </div>
            <button
              type="button"
              onClick={runMatrix}
              disabled={running}
              data-testid="run-stage4-browser-matrix"
              className="flex min-h-11 min-w-[220px] items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {running ? <><LoaderCircle size={17} className="animate-spin" />正在发布并联调…</> : <><FlaskConical size={17} />执行 B4-01—B4-16</>}
            </button>
          </div>

          {error ? (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert" data-testid="stage4-local-error">
              {error}
            </div>
          ) : null}

          {report ? (
            <div className={`mt-6 flex items-center gap-3 rounded-md p-4 ${completed ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`} role="status" data-testid="stage4-browser-summary">
              {completed ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
              <div><p className="font-semibold">{report.passed}/{report.total} {completed ? '全部通过' : '存在未通过项'}</p><p className="mt-1 text-xs">运行范围：{report.runtimeScope} · 结果不会计入真实校准。</p></div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 md:p-8" aria-label="治理候选预览">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">治理 Case · regenerate</p>
              <h2 className="mt-2 text-lg font-semibold">后继题目方案</h2>
            </div>
            <span className={`rounded px-3 py-1 text-xs font-medium ${completed ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>{completed ? '已发布新版本' : '可以发布'}</span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md bg-slate-50 p-5"><p className="text-xs font-semibold text-slate-500">当前正式题</p><p className="mt-2 text-sm leading-6 text-slate-800">{preview.originalQuestion}</p><p className="mt-4 text-xs leading-5 text-amber-800">{preview.issueSummary}</p></div>
            <div className="rounded-md border border-violet-200 bg-violet-50/50 p-5"><p className="text-xs font-semibold text-violet-700">AI 后继 Candidate · 简短文本</p><p className="mt-2 text-sm leading-6 text-slate-900">{preview.candidateQuestion}</p><p className="mt-4 text-xs leading-5 text-slate-600">提示：{preview.candidateHint}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-500">{preview.predecessorResourceVersionId}{completed ? ` → ${preview.successorResourceVersionId}` : ' · predecessor 保持可追溯'}</p>
            {running ? (
              <button type="button" disabled className="min-h-11 min-w-[220px] rounded-md bg-violet-600 px-5 text-sm font-medium text-white opacity-70" data-testid="unique-publishing-action">正在发布…</button>
            ) : completed ? (
              <span className="text-sm font-medium text-emerald-700">新版本已在原位生效</span>
            ) : (
              <div className="flex gap-3"><button type="button" className="min-h-11 rounded-md border border-violet-600 px-5 text-sm text-violet-700">重新优化</button><button type="button" onClick={runMatrix} className="min-h-11 rounded-md bg-violet-600 px-5 text-sm text-white">采用并发布</button></div>
            )}
          </div>
          {report?.checks.find((item) => item.id === 'B4-13') ? (
            <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800" data-testid="stage4-inline-recovery">身份冲突会在本卡片就近提示，并保留重新读取入口。</p>
          ) : null}
        </section>

        <section className="mt-6" aria-label="B4 浏览器联调结果">
          <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">B4-01—B4-16 结果</h2>{report ? <button type="button" onClick={runMatrix} disabled={running} className="flex items-center gap-2 text-sm text-blue-700"><RefreshCw size={15} />重新执行</button> : null}</div>
          {!report ? <p className="mt-4 rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">尚未执行矩阵。</p> : (
            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white" data-testid="stage4-browser-check-list">
              {report.checks.map((item) => (
                <article key={item.id} data-check-id={item.id} className="grid gap-3 p-5 md:grid-cols-[88px_210px_minmax(0,1fr)_70px] md:items-center">
                  <code className="text-sm font-semibold text-slate-500">{item.id}</code>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="text-sm leading-6 text-slate-600">{item.evidence}</p>
                  <span className={`justify-self-start rounded-full px-3 py-1 text-xs font-semibold md:justify-self-end ${item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{item.passed ? 'PASS' : 'FAIL'}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
