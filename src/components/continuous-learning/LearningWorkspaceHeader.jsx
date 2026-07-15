import { CheckCircle2, Circle } from 'lucide-react';

export default function LearningWorkspaceHeader({
  currentRound,
  completedRounds,
  totalRounds,
}) {
  return (
    <header
      className="sticky top-0 z-30 w-screen border-b border-slate-200 bg-white/95 backdrop-blur"
      style={{ marginLeft: 'calc(50% - 50vw)' }}
    >
      <div className="mx-auto flex min-h-16 max-w-[1208px] items-center justify-end px-4 py-2 md:px-6">
        <RoundSteps current={currentRound} completed={completedRounds} total={totalRounds} />
      </div>
    </header>
  );
}

function RoundSteps({ current, completed, total }) {
  return (
    <div className="flex shrink-0 items-center gap-2" aria-label={`当前第 ${current} 轮，已完成 ${completed} 轮`}>
      {Array.from({ length: total }, (_, index) => {
        const round = index + 1;
        const isCompleted = round <= completed;
        const isCurrent = round === current && !isCompleted;

        return (
          <div
            key={round}
            className={`flex min-h-10 min-w-24 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold leading-5 ${
              isCompleted
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : isCurrent
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}
          >
            {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            第 {round} 轮
          </div>
        );
      })}
    </div>
  );
}
