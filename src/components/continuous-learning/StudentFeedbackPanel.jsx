export function StudentFeedbackPanel({ feedback, className = '' }) {
  if (!feedback) return null;

  return (
    <section className={`border-t border-slate-200 pt-5 ${className}`} aria-live="polite">
      <p className="text-sm font-semibold leading-5 text-blue-700">本轮反馈</p>
      <h2 className="mt-1 text-lg font-semibold leading-7 text-slate-950">{feedback.headline}</h2>
      <p className="mt-3 text-base leading-7 text-slate-700">{feedback.summary}</p>

      {feedback.whatYouDidWell?.length ? (
        <FeedbackList title="已经做到" items={feedback.whatYouDidWell} tone="positive" />
      ) : null}
      {feedback.whatNeedsAttention?.length ? (
        <FeedbackList title="继续关注" items={feedback.whatNeedsAttention} tone="attention" />
      ) : null}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="text-sm font-semibold leading-5 text-slate-700">下一步</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{feedback.nextActionText}</p>
      </div>
    </section>
  );
}

export function WorkspaceNotice({ tone = 'info', title, text, className = '' }) {
  const toneClass = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }[tone];

  return (
    <section className={`rounded-md border px-4 py-3 ${toneClass} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <p className="text-sm font-semibold leading-5">{title}</p>
      <p className="mt-1 text-sm leading-6">{text}</p>
    </section>
  );
}

function FeedbackList({ title, items, tone }) {
  const dotClass = tone === 'positive' ? 'bg-emerald-500' : 'bg-amber-500';

  return (
    <div className="mt-4">
      <p className="text-sm font-semibold leading-5 text-slate-700">{title}</p>
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
