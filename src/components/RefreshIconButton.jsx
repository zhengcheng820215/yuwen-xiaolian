import { useState } from 'react';
import { RefreshCcw } from 'lucide-react';

export default function RefreshIconButton({
  onClick,
  busy = false,
  disabled = false,
  label = '刷新',
  busyLabel = '正在刷新',
}) {
  const [rotationCycle, setRotationCycle] = useState(0);
  const accessibleLabel = busy ? busyLabel : label;

  function handleClick(event) {
    setRotationCycle((current) => current + 1);
    onClick?.(event);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCcw
        key={rotationCycle}
        size={17}
        className={rotationCycle > 0 ? 'refresh-icon-rotate-once' : ''}
        aria-hidden="true"
      />
    </button>
  );
}
