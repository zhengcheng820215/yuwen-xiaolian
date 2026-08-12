import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, CheckCircle2, Info, X } from 'lucide-react';

export default function WorkspaceToast({ message, tone = 'success', duration, onDismiss }) {
  const isError = tone === 'error';
  const isOperation = tone === 'operation';
  const [isLeaving, setIsLeaving] = useState(false);
  const dismissTimer = useRef(null);

  const beginDismiss = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    dismissTimer.current = setTimeout(() => onDismiss?.(), 180);
  }, [isLeaving, onDismiss]);

  useEffect(() => {
    if (!duration) return undefined;
    const timer = setTimeout(beginDismiss, duration);
    return () => clearTimeout(timer);
  }, [beginDismiss, duration]);

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  return (
    <div
      className="fixed bottom-5 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 md:bottom-6"
    >
      <div
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        aria-atomic="true"
        className={`flex min-w-56 max-w-full items-center gap-3 rounded-md bg-white px-4 py-3 text-sm leading-6 text-slate-950 shadow-[0_8px_30px_rgba(15,23,42,0.14)] ${
          isLeaving ? 'workspace-toast-exit' : 'workspace-toast-enter'
        }`}
      >
        {isError ? (
          <CircleAlert size={16} className="shrink-0 text-red-600" />
        ) : isOperation ? (
          <Info size={16} className="shrink-0 text-emerald-600" />
        ) : (
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
        )}
        <span className="min-w-0 flex-1">{message}</span>
        {onDismiss && (isError || isOperation) ? (
          <button
            type="button"
            onClick={beginDismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="关闭提示"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
