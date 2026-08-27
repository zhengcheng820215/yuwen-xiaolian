import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadLearningCollectionIntegrityView } from '../api/learningCollectionIntegrity.ts';

const eventNames = {
  question_presented: '题目展示', answer_submitted: '答案提交', diagnosis_completed: '诊断完成',
  feedback_presented: '反馈展示', learning_round_completed: '轮次完成',
  revision_started: '开始修订', revision_submitted: '提交修订', revision_evaluation_completed: '修订评估完成',
};

export default function LearningCollectionIntegrity() {
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [scope, setScope] = useState('current_collection');
  const load = (nextScope) => {
    setBusy(true); setError('');
    loadLearningCollectionIntegrityView(nextScope).then(setView).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setBusy(false));
  };
  useEffect(() => { load(scope); }, [scope]);
  const report = view?.report;
  const awaitingData = report?.scopeTotals.includedRounds === 0;
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3"><Link to="/internal" aria-label="返回内部入口"><ArrowLeft size={19} /></Link><h1 className="text-lg font-semibold">学习采集完整性</h1></div>
          <button type="button" onClick={() => load(scope)} disabled={busy} className="flex items-center gap-2 text-sm text-emerald-700"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} />刷新报告</button>
        </div>
      </header>
      <main className="mx-auto max-w-[1208px] px-5 py-8 md:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-1" role="group" aria-label="完整性报告范围">
            <ScopeButton active={scope === 'current_collection'} disabled={busy} onClick={() => setScope('current_collection')}>当前采集链</ScopeButton>
            <ScopeButton active={scope === 'all_history'} disabled={busy} onClick={() => setScope('all_history')}>全部历史</ScopeButton>
          </div>
          <p className="text-xs text-slate-500">切换范围只读取报告，不修改学习与采集数据。</p>
        </div>
        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {!report ? <p className="text-sm text-slate-600">正在读取只读采集报告。</p> : (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">{statusIcon(report.status, awaitingData)}<div><p className="text-xs font-semibold uppercase text-slate-500">{report.scope === 'current_collection' ? '当前采集链' : '全部历史'} · Integrity {awaitingData ? 'AWAITING DATA' : report.status}</p><h2 className="text-xl font-semibold">{statusText(report.status, awaitingData, report.scope)}</h2></div></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
                {Object.entries({ 轮次: report.totals.roundsWithFormalQuestion, 已完成: report.totals.completedRounds, 提交: report.totals.submittedAttempts, 有效样本: report.totals.eligibleCalibrationAttempts, 排除样本: report.totals.excludedCalibrationAttempts, 投影失败: report.totals.projectionFailedAttempts, 独立使用者: report.totals.independentSubjects }).map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}
              </div>
              <p className="mt-5 text-sm text-slate-600">Trial Window 共 {report.scopeTotals.currentCollectionRounds} 个轮次：真实学生 {report.scopeTotals.realLearningRounds} 个，内部验收 {report.scopeTotals.internalAcceptanceRounds} 个；旧历史 {report.scopeTotals.legacyRounds} 个。{report.scope === 'current_collection' ? '当前健康结论只评价真实学生轮次。' : '此范围保留全部历史与内部验收记录供追溯。'}</p>
              <p className="mt-2 text-xs text-slate-500">本页只读取和核对现有事实，不自动补写或修改正式数据，也不表示题目已经完成群体校准。</p>
            </section>
            <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold">问题</h2>
              {awaitingData ? <p className="mt-3 text-sm text-slate-600">{report.scope === 'current_collection' ? '当前采集代际尚无真实轮次，完成新一轮学习后再判断链路健康度。' : '全部历史范围尚无正式学习轮次。'}</p> : report.issues.length === 0 ? <p className="mt-3 text-sm text-slate-600">当前范围未发现完整性问题。</p> : <div className="mt-4 space-y-3">{report.issues.map((issue, index) => <div key={`${issue.code}-${index}`} className="rounded-md border border-slate-200 p-4"><div className="flex gap-2"><span className={issue.severity === 'fail' ? 'text-red-600' : 'text-amber-600'}>{issue.severity === 'fail' ? '失败' : '警告'}</span><code className="text-xs text-slate-500">{issue.code}</code></div><p className="mt-2 text-sm text-slate-700">{issue.message}</p></div>)}</div>}
            </section>
            {report.scope === 'current_collection' && view.internalAcceptanceRounds?.length ? <section className="mt-6 rounded-md border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold">内部验收记录</h2><p className="mt-2 text-sm text-slate-600">以下轮次只用于工程验收追溯，不计入真实学生轮次、完整性结论或真实样本分母。</p><details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-slate-700">查看 {view.internalAcceptanceRounds.length} 个内部验收轮次</summary><div className="mt-3 space-y-2">{view.internalAcceptanceRounds.map((round) => <p key={round.learningRoundId} className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">{round.learningRoundId} · {round.status}</p>)}</div></details></section> : null}
            <RevisionObservation report={view.revisionObservation} />
            <ReadingOpenResponseObservation view={view.readingOpenResponse} />
            <section className="mt-6 space-y-3"><h2 className="text-base font-semibold">按轮次查看</h2>{view.rounds.length === 0 ? <p className="text-sm text-slate-600">{scope === 'current_collection' ? '尚无当前采集代际的正式学习轮次。' : '尚无正式学习轮次。'}</p> : view.rounds.map((round) => <details key={round.learningRoundId} className="rounded-md border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">{round.learningRoundId} · {round.status}</summary><p className="mt-3 text-xs text-slate-500">题目版本：{round.resourceVersionId}</p><div className="mt-4 flex flex-wrap gap-2">{round.events.map((event, index) => <span key={`${event.eventType}-${index}`} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">{eventNames[event.eventType]}</span>)}</div><div className="mt-4 text-sm text-slate-700">Attempt：{round.projections.length ? round.projections.map((item) => `${item.attemptId} · ${item.status}${item.itemScore === undefined ? '' : ` · ${item.itemScore}`}`).join('；') : '无 Projection'}</div></details>)}</section>
          </>
        )}
      </main>
    </div>
  );
}

function ReadingOpenResponseObservation({ view }) {
  if (!view) return null;
  const { integrity, governance, reports } = view;
  const engineering = governance.engineering;
  return (
    <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">开放文本题负担治理与校准</h2>
          <p className="mt-1 text-xs text-slate-500">工程状态、真实样本状态与教育效果结论分开显示；本页不修改题目或学生画像。</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${integrity.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {integrity.passed ? '过程事实完整' : '存在完整性问题'}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="治理 Case" value={engineering.caseCount} />
        <Metric label="活动批次" value={engineering.activeBatchCount} />
        <Metric label="暂停批次" value={engineering.pausedBatchCount} />
        <Metric label="产品过程事实" value={integrity.productFactCount} />
      </div>
      <p className="mt-4 text-xs text-slate-500">教育效果：尚不从工程完成或样本状态推断。当前 30 份门槛仅为版本化产品治理试运行阈值。</p>
      {reports.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">尚无开放文本题过程事实；完成真实 Learning 后开始形成版本级记录。</p>
      ) : (
        <div className="mt-4 space-y-2">
          {reports.map((item) => (
            <details key={item.resourceVersionId} className="rounded-md border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                {item.resourceVersionId} · {calibrationStatusText(item.status)}
              </summary>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                <p>展示 {item.presentedCount}</p>
                <p>有效样本 {item.eligibleSampleCount}</p>
                <p>独立使用者 {item.independentSubjectCount}</p>
                <p>完成 {item.completedCount}</p>
                <p>无效输入 {item.invalidResponseCount}</p>
                <p>打开提示 {item.hintOpenedCount}</p>
              </div>
              <p className="mt-3 text-xs text-slate-500">{item.limitations.join('；')}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-md bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function calibrationStatusText(status) {
  if (status === 'calibrated') return '达到当前试运行计算门槛';
  if (status === 'insufficient_sample') return '样本不足';
  return '等待真实数据';
}

function RevisionObservation({ report }) {
  if (!report) return null;
  const { audit, metrics } = report;
  const metricItems = [
    ['开始修订率', metrics.startRate],
    ['修订提交率', metrics.completionRate],
    ['评估完成率', metrics.evaluationCompletionRate],
    ['反馈响应率', metrics.feedbackResponseRate],
    ['主要问题改善率', metrics.issueResolutionRate],
    ['新问题率', metrics.newIssueRate],
  ];
  return (
    <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold">反馈后修订观测</h2><p className="mt-1 text-xs text-slate-500">只读核对修订链路，不修改学生作答或能力结论。</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${audit.status === 'pass' ? 'bg-emerald-50 text-emerald-700' : audit.status === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{audit.status === 'pass' ? '链路完整' : audit.status === 'warning' ? '有待补数据' : '存在完整性问题'}</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metricItems.map(([label, metric]) => <div key={label} className="rounded-md bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{metric.status === 'available' ? `${Math.round(metric.rate * 100)}%` : '暂不可用'}</p><p className="mt-1 text-xs text-slate-500">{metric.numerator}/{metric.denominator}</p></div>)}</div>
      <p className="mt-4 text-xs text-slate-500">已核对 {audit.attemptCount} 个首次作答，其中 {audit.revisionCount} 个进入修订；完整性问题 {audit.issueCount} 项。分母不完整或为 0 时不估算比率。</p>
      {audit.issues.length > 0 ? <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-slate-700">查看修订链问题</summary><div className="mt-3 space-y-2">{audit.issues.map((item, index) => <p key={`${item.code}-${item.learningTaskAttemptId}-${index}`} className={`rounded-md p-3 text-sm ${item.severity === 'fail' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{item.message}</p>)}</div></details> : null}
    </section>
  );
}

function ScopeButton({ active, disabled, onClick, children }) {
  return <button type="button" disabled={disabled} onClick={onClick} aria-pressed={active} className={`rounded px-4 py-2 text-sm font-medium ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{children}</button>;
}
function statusIcon(status, awaitingData) {
  if (awaitingData) return <AlertTriangle size={28} className="text-slate-400" />;
  if (status === 'pass') return <CheckCircle2 size={28} className="text-emerald-600" />;
  if (status === 'warning') return <AlertTriangle size={28} className="text-amber-500" />;
  return <XCircle size={28} className="text-red-600" />;
}
function statusText(status, awaitingData, scope) { return awaitingData ? scope === 'current_collection' ? '尚无当前采集轮次' : '尚无历史学习轮次' : status === 'pass' ? '采集链完整' : status === 'warning' ? '存在需要留意的问题' : '存在阻断性完整性问题'; }
