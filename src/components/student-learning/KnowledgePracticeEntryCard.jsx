import { ArrowRight, BookOpenCheck, Clock3 } from 'lucide-react';

export default function KnowledgePracticeEntryCard({ projection, primary = false, onOpen }) {
  const disabled = ['loading', 'content_insufficient'].includes(projection.status);
  const active = projection.status === 'active_session';
  const buttonText = active
    ? '继续基础知识巩固'
    : projection.status === 'ready_to_start'
      ? '选择基础知识练习'
      : projection.status === 'loading'
        ? '正在恢复进度'
        : projection.status === 'content_insufficient'
          ? '暂无可用知识题'
          : '查看本机练习状态';

  return (
    <section className={`rounded-xl border bg-white p-5 ${primary ? 'border-blue-300 shadow-sm' : 'border-slate-200'}`} aria-labelledby="knowledge-practice-entry-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <BookOpenCheck size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-blue-700">辅助训练</p>
          <h2 id="knowledge-practice-entry-title" className="mt-1 text-base font-semibold text-slate-950">基础知识巩固</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{projection.studentMessage}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <span>{projection.approvedQuestionCount} 道已审核轻量题</span>
        <span>{projection.availableCategoryCount} 个可用分类</span>
        {active ? <span className="flex items-center gap-1"><Clock3 size={13} />进度保存在当前浏览器</span> : null}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">只记录本轮知识巩固，不直接形成长期能力结论。</p>

      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className={`mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${primary ? 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500' : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-500'}`}
      >
        {buttonText}
        {!disabled ? <ArrowRight size={16} /> : null}
      </button>
    </section>
  );
}
