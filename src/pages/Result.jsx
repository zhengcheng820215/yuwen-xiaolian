import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpenCheck, Home, RotateCcw, XCircle } from 'lucide-react';
import Card from '../components/Card.jsx';
import { usePracticeSession } from '../context/PracticeSessionContext.jsx';

function formatDuration(durationMs) {
  if (durationMs < 1000) return '少于 1 秒';
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes} 分 ${remainder} 秒` : `${remainder} 秒`;
}

export default function Result() {
  const navigate = useNavigate();
  const { lastResult, activeSession, hydrationStatus, persistenceNotice, startResultRecommendation } = usePracticeSession();
  const [actionError, setActionError] = useState(null);

  if (hydrationStatus === 'loading') return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">正在恢复练习结果…</div>;
  if (!lastResult) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <Card className="w-full text-center">
          <p className="font-semibold text-slate-900">还没有可查看的完整练习结果</p>
          <p className="mt-2 text-sm text-slate-500">完成一组知识练习后，结果会保存在当前浏览器。</p>
          <Link to="/learning/knowledge" className="mt-4 flex min-h-11 items-center justify-center rounded-md bg-blue-600 font-semibold text-white">选择基础知识练习</Link>
        </Card>
      </div>
    );
  }

  const recommendation = activeSession?.status === 'active'
    ? { title: '继续当前练习', reason: '当前浏览器已有一组练习进行中，将优先继续，不会被本轮结果覆盖。' }
    : lastResult.recommendation;
  const category = lastResult.mode === 'mixed' ? '综合小练' : lastResult.mode === 'mistake_review' ? '错题重做' : lastResult.category;
  const act = () => {
    const result = startResultRecommendation(lastResult.recommendation);
    if (!result?.ok) {
      setActionError(result?.error?.studentMessage || '暂时无法开始推荐练习，请重新选择。');
      return;
    }
    navigate(result.path);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-5 py-8">
      <header className="text-center">
        <p className="text-sm font-medium text-blue-600">{category}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">本轮首次正确率 {lastResult.basePerformance.firstAttemptAccuracy}%</h1>
        <p className="mt-2 text-sm text-slate-500">这里只总结当前一组基础知识练习。</p>
      </header>

      {persistenceNotice ? <p role="status" className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{persistenceNotice}</p> : null}
      {actionError ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p> : null}

      <Card className="mt-6">
        <h2 className="font-semibold text-slate-900">基础题首次表现</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 text-center sm:grid-cols-3">
          <div><p className="text-2xl font-semibold text-slate-900">{lastResult.basePerformance.correctCount}/{lastResult.basePerformance.questionCount}</p><p className="mt-1 text-xs text-slate-500">首次答对</p></div>
          <div><p className="text-2xl font-semibold text-slate-900">{lastResult.basePerformance.firstAttemptAccuracy}%</p><p className="mt-1 text-xs text-slate-500">首次正确率</p></div>
          <div className="col-span-2 sm:col-span-1"><p className="text-2xl font-semibold text-slate-900">{formatDuration(lastResult.timing.effectiveDurationMs)}</p><p className="mt-1 text-xs text-slate-500">有效作答用时</p></div>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-slate-900">本轮巩固题</h2>
        {lastResult.reinforcementPerformance.scheduledCount > 0 ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">本轮安排 {lastResult.reinforcementPerformance.scheduledCount} 道巩固题，答对 {lastResult.reinforcementPerformance.correctCount} 道。巩固结果不会改写基础题首次正确率。</p>
        ) : <p className="mt-2 text-sm text-slate-600">本轮未安排额外巩固题。</p>}
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-slate-900">知识点小结</h2>
        <ul className="mt-3 space-y-3">
          {lastResult.knowledgePoints.map((item) => (
            <li key={item.knowledgePoint} className="rounded-lg bg-slate-50 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900">{item.knowledgePoint}</span><span className="text-blue-700">{item.studentMessage}</span></div>
              <p className="mt-1 text-xs text-slate-500">基础题 {item.correctCount}/{item.baseQuestionCount} 首次答对</p>
            </li>
          ))}
        </ul>
      </Card>

      {lastResult.misconceptions.length > 0 ? (
        <Card className="mt-4">
          <h2 className="font-semibold text-slate-900">本轮已审核错因</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            {lastResult.misconceptions.map((item) => <li key={item.code}>{item.studentMessage}（出现 {item.occurrenceCount} 次）</li>)}
          </ul>
        </Card>
      ) : lastResult.wrongItems.length > 0 ? (
        <Card className="mt-4">
          <h2 className="font-semibold text-slate-900">本轮这些题可以再看一次</h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-600">
            {lastResult.wrongItems.map((item) => <li key={item.questionId} className="rounded-lg bg-red-50 px-3 py-3"><p className="font-medium text-slate-900">{item.stemSnapshot}</p><p className="mt-1">正确答案：{item.correctAnswerText}</p><p className="mt-1">依据：{item.keyEvidence}</p></li>)}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-4">
        <div className="flex items-center gap-2"><BookOpenCheck size={20} className="text-blue-600"/><h2 className="font-semibold text-slate-900">本轮下一步</h2></div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation.reason}</p>
        <button onClick={act} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 font-semibold text-white"><RotateCcw size={18}/>{recommendation.title}</button>
        <p className="mt-3 text-xs leading-5 text-slate-500">本页只总结当前一组练习，不代表相关知识或能力已经长期掌握。</p>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link to="/learning/knowledge/mistakes" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-50 font-semibold text-red-600"><XCircle size={18}/>查看本机错题</Link>
        <Link to="/learning" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white font-semibold text-slate-700 shadow-sm"><Home size={18}/>返回学习入口</Link>
      </div>
    </div>
  );
}
