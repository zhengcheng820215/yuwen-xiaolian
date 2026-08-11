import { ArrowRight, BookOpen, RefreshCw, Save } from 'lucide-react';
import { StudentFeedbackPanel } from './StudentFeedbackPanel.jsx';
import ReadingMaterialText from './ReadingMaterialText.jsx';
import AnswerLengthIndicator, { readMinimumAnswerLength } from './AnswerLengthIndicator.jsx';

export default function LearningTaskWorkspace({
  state,
  answer,
  busy,
  draftStatus,
  onAnswerChange,
  onSaveDraft,
  onSubmit,
}) {
  const entry = state.entryState;

  return (
    <div className="learning-workspace-split-background relative bg-[#f7f9fc] min-[1060px]:h-[calc(100vh-64px)] min-[1060px]:min-h-[620px]">
      <div className="relative mx-auto grid w-full max-w-[1680px] border-b border-slate-200 min-[1060px]:h-full min-[1060px]:grid-cols-[clamp(460px,55%,760px)_minmax(480px,1fr)]">
        <section className="border-b border-slate-200 bg-[#f7f9fc] px-4 py-5 md:px-6 lg:px-8 lg:py-7 min-[1060px]:overflow-y-auto min-[1060px]:border-b-0 min-[1060px]:border-r">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <BookOpen size={18} className="text-slate-500" />
            <h2 className="text-lg font-semibold leading-7 text-slate-950">阅读材料</h2>
          </div>
          <ReadingMaterialText className="mt-5 text-base leading-7 text-slate-800">
            {entry?.readingText}
          </ReadingMaterialText>
        </div>
        </section>

        <section className="bg-white px-4 py-5 md:px-6 lg:px-8 lg:py-7 min-[1060px]:overflow-y-auto">
        <div className="mx-auto w-full max-w-[640px] space-y-6">
          <div>
            <h2 className="text-lg font-semibold leading-7 text-slate-950">
              本轮重点：{toStudentFocusTitle(entry?.studentRoundFocus?.title)}
            </h2>
            <p className="mt-2 max-w-[520px] text-sm leading-6 text-slate-500">
              {toStudentFocusDescription(entry?.studentRoundFocus?.description)}
            </p>
          </div>

          <section>
            <h2 className="text-lg font-semibold leading-7 text-slate-950">题目</h2>
            <p className="mt-2 text-base leading-7 text-slate-800">{entry?.questionText}</p>
          </section>

          <section>
            <textarea
              id="continuous-learning-answer"
              aria-label="我的回答"
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              rows={8}
              placeholder="请在这里输入你的回答。"
              className="min-h-52 w-full resize-y rounded-md border border-slate-300 bg-[#f7f9fc] p-4 text-base leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <AnswerLengthIndicator
              answer={answer}
              minimumLength={readMinimumAnswerLength(entry?.answerRequirements)}
            />
            <div className="mt-3 flex flex-col-reverse gap-3 sm:grid sm:grid-cols-2">
              <button
                type="button"
                disabled={busy || draftStatus === 'saving'}
                onClick={onSaveDraft}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-600 bg-white px-4 text-sm font-normal text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {draftStatus === 'saving' ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                {draftStatus === 'saving' ? '保存中…' : '保存草稿'}
              </button>
              <button
                type="button"
                disabled={busy || draftStatus === 'saving'}
                onClick={onSubmit}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-normal text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {busy ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                {busy ? '正在分析并保存' : '提交本轮回答'}
              </button>
            </div>
          </section>

          {state.feedback ? <StudentFeedbackPanel feedback={state.feedback} /> : null}
        </div>
        </section>
      </div>
    </div>
  );
}

function toStudentFocusDescription(description) {
  if (!description || description.includes('有效作答证据')) {
    return '本题考查根据人物动作和细节推断人物心理的能力。';
  }
  return description;
}

function toStudentFocusTitle(title) {
  const normalizedTitle = title?.replace(/^本轮(?:关注|重点)[：:]\s*/, '').trim();
  return normalizedTitle || '推理';
}
