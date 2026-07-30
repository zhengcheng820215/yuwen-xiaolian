import { RefreshCw } from 'lucide-react';

export default function RefreshIconButton({
  onClick,
  busy = false,
  disabled = false,
  label = '刷新',
  busyLabel = '正在刷新',
}) {
  const accessibleLabel = busy ? busyLabel : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw size={17} className={busy ? 'animate-spin' : ''} aria-hidden="true" />
    </button>
  );
}
