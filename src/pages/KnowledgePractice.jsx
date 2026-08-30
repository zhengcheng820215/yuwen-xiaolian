import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { knowledgeQuestionRepository } from '../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import { usePracticeSession } from '../context/PracticeSessionContext.jsx';

const categoryOrder = ['字音字形', '成语运用', '病句辨析与修改', '标点符号', '文学文化常识', '古诗文默写与理解', '文言实词虚词', '作家作品与课文背景'];
const questions = knowledgeQuestionRepository.listApproved();

const categories = categoryOrder
  .map((category) => ({
    name: category,
    count: questions.filter((question) => question.category === category).length,
  }))
  .filter((category) => category.count > 0);

export default function KnowledgePractice() {
  const navigate = useNavigate();
  const [pendingStart, setPendingStart] = useState(null);
  const { activeSession, hydrationStatus, persistenceStatus, persistenceNotice, reloadPersistedState, startPractice, abandonAndStart, lastBuildError } = usePracticeSession();

  const routeFor = (input) => `/learning/knowledge/quiz/${input.mode === 'mixed' ? 'all' : input.mode === 'mistake_review' ? 'retry' : encodeURIComponent(input.category)}`;

  const begin = (category) => {
    const input = category
      ? { mode: 'category', category, targetCount: 5 }
      : { mode: 'mixed', targetCount: 10 };
    const result = startPractice(input);
    if (result.ok) navigate(routeFor(input));
    else if (result.error?.code === 'active_attempt_conflict') setPendingStart(input);
  };

  const confirmReplacement = () => {
    const input = pendingStart;
    if (!input) return;
    const result = abandonAndStart(input);
    if (result.ok) navigate(routeFor(input));
  };

  return (
    <>
      <PageHeader title="基础知识巩固" subtitle="每组目标清晰，答完立即查看本题反馈" back backTo="/learning" />
      <div className="px-5">
        <p className="mb-4 rounded-lg bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">本练习只记录本轮知识巩固，不代表长期能力结论。正式阅读训练和能力证据仍在学习主线中完成。</p>
        <p className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">练习进度保存在当前浏览器。清理浏览器数据或更换设备后无法恢复。</p>
        {persistenceNotice ? (
          <div role="status" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>{persistenceNotice}</p>
            {persistenceStatus === 'conflict' ? <button onClick={reloadPersistedState} className="mt-2 min-h-10 rounded-md bg-white px-3 font-semibold text-amber-900">重新载入最新进度</button> : null}
          </div>
        ) : null}
        {activeSession?.status === 'active' ? (
          <div className="mb-4 rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-900">上次练习还没有完成</p>
            <p className="mt-1 text-sm text-slate-500">已进行到第 {activeSession.currentIndex + 1} / {activeSession.queue.length} 题</p>
            <button onClick={() => navigate(routeFor(activeSession))} className="mt-3 min-h-11 w-full rounded-md bg-blue-600 font-semibold text-white">继续上次练习</button>
          </div>
        ) : null}
        {pendingStart ? (
          <div role="alertdialog" aria-label="放弃当前练习确认" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-slate-900">要放弃当前练习并开始新的一组吗？</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">已有答案会保留在历史事实中，但这组练习将不能继续。</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => setPendingStart(null)} className="min-h-11 rounded-md bg-white text-sm font-semibold text-slate-700">取消</button>
              <button onClick={confirmReplacement} className="min-h-11 rounded-md bg-amber-600 text-sm font-semibold text-white">确认放弃并开始</button>
            </div>
          </div>
        ) : null}
        <button disabled={hydrationStatus === 'loading'} onClick={() => begin()} className="mb-4 flex min-h-16 w-full flex-col items-center justify-center rounded-lg bg-blue-600 font-semibold text-white shadow-sm disabled:opacity-50">
          <span>开始综合小练 · 10 题</span>
          <span className="mt-1 text-xs font-normal text-blue-100">覆盖多个知识分类 · 约 20 分钟</span>
        </button>
        {lastBuildError ? <p className="mb-4 text-sm text-red-600">{lastBuildError.studentMessage}</p> : null}
        <div className="grid gap-3">
          {categories.map((category) => (
            <button disabled={hydrationStatus === 'loading'} key={category.name} onClick={() => begin(category.name)} className="flex min-h-16 items-center justify-between rounded-lg bg-white px-4 text-left shadow-sm disabled:opacity-50">
              <div>
                <p className="font-medium text-slate-900">{category.name}</p>
                <p className="mt-1 text-xs text-slate-500">七年级上册 · 本组 {Math.min(5, category.count)} 题 · 约 {Math.max(3, Math.min(5, category.count) * 2)} 分钟</p>
              </div>
              <ChevronRight className="text-slate-400" size={20} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
