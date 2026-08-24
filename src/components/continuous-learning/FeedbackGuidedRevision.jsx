import { ArrowRight, BookOpen, RefreshCw, Save } from 'lucide-react';
import AnswerLengthIndicator from './AnswerLengthIndicator.jsx';
import ReadingMaterialText from './ReadingMaterialText.jsx';
import { formatLearningMaterialHeading } from '../../ui/learningMaterialHeading.ts';
import { presentLearningFeedbackRevision } from '../../ui/learningFeedbackRevisionPresentation.ts';
import {
  resolveConvergenceStage3PresentationFlag,
  toConvergenceFeedbackStudentView,
} from '../../ui/productComplexityConvergenceStage3Presentation.ts';

export function FeedbackRevisionGoal({ revision, className = '' }) {
  if (!revision?.revisionGoal) return null;
  return (
    <section className={`mt-7 border-t border-slate-200 pt-6 ${className}`} aria-label="本次修订目标">
      <h2 className="text-sm font-semibold text-slate-800">这次重点修改</h2>
      <p className="mt-2 text-base leading-7 text-slate-700">{revision.revisionGoal.instruction}</p>
    </section>
  );
}

export function FeedbackRevisionWorkspace({
  task,
  revision,
  draftAnswer,
  busy,
  onDraftChange,
  onSave,
  onSubmit,
  onContinue,
  continueLabel = '暂不提交，继续下一项',
  inputRef,
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-65px)] w-full max-w-[1680px] min-[1060px]:h-[calc(100vh-65px)] min-[1060px]:min-h-0 min-[1060px]:grid-cols-[clamp(460px,55%,760px)_minmax(480px,1fr)] min-[1060px]:overflow-hidden">
      <section className="border-b border-slate-200 bg-[#f7f9fc] px-6 py-8 lg:px-10 lg:py-10 min-[1060px]:min-h-0 min-[1060px]:overflow-y-auto min-[1060px]:border-b-0 min-[1060px]:border-r">
        <div className="mx-auto w-full max-w-[760px]">
          <h1 className="flex items-center gap-3 text-lg font-semibold">
            <BookOpen size={20} className="text-slate-500" />
            {formatLearningMaterialHeading(task.materialTitle, task.materialAuthor)}
          </h1>
          <ReadingMaterialText className="mt-6 border-t border-slate-200 pt-7 text-base leading-8 text-slate-800">
            {task.readingText || '本题不需要额外阅读材料。'}
          </ReadingMaterialText>
        </div>
      </section>

      <section className="bg-white px-6 py-8 lg:px-10 lg:py-10 xl:px-14 min-[1060px]:min-h-0 min-[1060px]:overflow-y-auto">
        <div className="mx-auto max-w-[640px]">
          <p className="text-sm font-medium text-emerald-700">根据反馈修订</p>
          <h1 className="mt-3 text-lg font-semibold">完善这次回答</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">首次回答已经保留，不会被覆盖。</p>

          <section className="mt-7">
            <h2 className="text-sm font-semibold text-slate-800">题目</h2>
            <p className="mt-2 text-base leading-7 text-slate-800">{task.questionText}</p>
          </section>

          <section className="mt-7 rounded-md bg-slate-50 px-4 py-4">
            <h2 className="text-sm font-semibold text-slate-700">首次回答</h2>
            <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{revision.initialAnswer}</p>
          </section>

          <FeedbackRevisionGoal revision={revision} />

          <textarea
            ref={inputRef}
            value={draftAnswer}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={busy}
            aria-label="修改后的回答"
            placeholder="请根据上面的重点完善回答。"
            className="mt-7 min-h-[220px] max-h-[400px] w-full resize-none rounded-md border border-slate-300 bg-[#f8fafc] px-4 py-4 text-base leading-7 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-70"
          />
          <AnswerLengthIndicator answer={draftAnswer} minimumLength={task.minimumAnswerLength} />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy || !draftAnswer.trim()}
              onClick={onSave}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-600 bg-white px-4 text-sm text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              保存修订草稿
            </button>
            <button
              type="button"
              disabled={busy || !draftAnswer.trim() || draftAnswer.trim() === revision.initialAnswer.trim()}
              onClick={onSubmit}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              提交修订
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onContinue}
            className="mt-4 min-h-10 w-full text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40"
          >
            {continueLabel}
          </button>
        </div>
      </section>
    </main>
  );
}

export function FeedbackRevisionSubmitted({ revision, busy, canAdvance, continueLabel, onContinue }) {
  const pending = revision?.status === 'evaluation_pending_retry';
  const evaluating = revision?.status === 'submitted' || revision?.status === 'evaluating';
  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center px-6 py-12">
      <div className="mx-auto w-full max-w-[680px] rounded-md bg-white px-8 py-12 shadow-[0_10px_36px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-medium text-emerald-700">修订已保存</p>
        <h1 className="mt-3 text-xl font-semibold">
          {pending ? '评价稍后自动补充' : evaluating ? '正在评价这次修改' : '这次修改已经保留'}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          {pending
            ? '首次回答和修订回答都已保留。评价服务恢复后，系统会自动继续，不需要重新作答。'
            : '首次回答仍然保持原样，系统正在确认这次修改。'}
        </p>
        <FeedbackRevisionGoal revision={revision} />
        <button
          type="button"
          disabled={busy}
          onClick={onContinue}
          className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {continueLabel || (canAdvance ? '进入下一题' : '返回学习入口')}
        </button>
      </div>
    </main>
  );
}

export function FeedbackRevisionEvaluated({ revision, busy, canAdvance, continueLabel, onContinue }) {
  const evaluation = revision?.evaluation;
  if (!evaluation) return null;
  const presentation = presentLearningFeedbackRevision(evaluation);
  const convergenceView = resolveConvergenceStage3PresentationFlag() === 'convergence_v1'
    ? toConvergenceFeedbackStudentView(revision.convergencePresentation)
    : undefined;
  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center px-6 py-12">
      <div className="mx-auto w-full max-w-[720px] rounded-md bg-white px-8 py-12 shadow-[0_10px_36px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-medium text-emerald-700">{convergenceView?.eyebrow || presentation.eyebrow}</p>
        {convergenceView ? (
          <ConvergenceRevisionOutcome view={convergenceView} />
        ) : (
          <>
            <h1 className="mt-3 text-xl font-semibold">{presentation.title}</h1>
            <p className="mt-3 text-base leading-7 text-slate-700">{presentation.summary}</p>
          </>
        )}

        {!convergenceView && presentation.remainingFocus ? (
          <section className="mt-7 rounded-md bg-amber-50 px-5 py-4" aria-label="还可以再完善">
            <h2 className="text-sm font-semibold text-amber-900">还可以再完善</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">{presentation.remainingFocus}</p>
          </section>
        ) : null}

        {!convergenceView ? <section className="mt-7 border-t border-slate-200 pt-6" aria-label="记住这个方法">
          <h2 className="text-sm font-semibold text-slate-800">记住这个方法</h2>
          <p className="mt-2 text-base leading-7 text-slate-700">{presentation.methodReminder}</p>
        </section> : null}

        <button
          type="button"
          disabled={busy}
          onClick={onContinue}
          className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {continueLabel || (canAdvance ? '进入下一题' : '返回学习入口')}
        </button>
      </div>
    </main>
  );
}

function ConvergenceRevisionOutcome({ view }) {
  return (
    <section aria-label="修订反馈投射">
      {view.blocks.map((block) => (
        <div key={block.kind} className="mt-6" data-feedback-block={block.kind}>
          <h2 className="text-sm font-semibold text-slate-800">{block.title}</h2>
          <p className="mt-2 text-base leading-7 text-slate-700">{block.text}</p>
        </div>
      ))}
    </section>
  );
}
