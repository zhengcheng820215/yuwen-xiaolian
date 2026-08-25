export default function ProductRuntimeRecoveryNotice({ view, onPrimaryAction, onSecondaryAction, busy = false }) {
  if (!view) return null;
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-800',
    information: 'border-sky-200 bg-sky-50 text-sky-900',
    recoverable: 'border-amber-200 bg-amber-50 text-amber-900',
    blocked: 'border-red-200 bg-red-50 text-red-900',
  };
  return <section className={`rounded-md border p-5 ${tones[view.tone]}`} data-testid="product-runtime-recovery-notice">
    <h1 className="text-xl font-semibold">{view.title}</h1>
    <p className="mt-3 text-base leading-7">{view.situationText}</p>
    <p className="mt-2 text-sm leading-6 opacity-80">{view.preservationText}</p>
    {view.primaryActionLabel || view.secondaryActionLabel ? <div className="mt-6 flex flex-wrap gap-3">
      {view.primaryActionLabel ? <button type="button" disabled={busy} onClick={onPrimaryAction} className="min-h-11 rounded-md bg-emerald-600 px-5 text-sm text-white disabled:opacity-50">{view.primaryActionLabel}</button> : null}
      {view.secondaryActionLabel ? <button type="button" disabled={busy} onClick={onSecondaryAction} className="min-h-11 rounded-md border border-emerald-600 bg-white px-5 text-sm text-emerald-700 disabled:opacity-50">{view.secondaryActionLabel}</button> : null}
    </div> : null}
  </section>;
}
