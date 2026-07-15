import { ArrowRight, BookOpen, RefreshCw, Save } from 'lucide-react';
import { StudentFeedbackPanel } from './StudentFeedbackPanel.jsx';

export default function LearningTaskWorkspace({
  state,
  answer,
  busy,
  onAnswerChange,
  onAnswerBlur,
  onSaveDraft,
  onSubmit,
}) {
  const entry = state.entryState;

  return (
    <div className="grid border-b border-slate-200 bg-white lg:h-[calc(100vh-64px)] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_minmax(400px,1fr)]">
      <section className="bg-[#f7f9fc] px-4 py-5 md:px-6 lg:overflow-y-auto lg:border-r lg:border-slate-200 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[640px]">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <BookOpen size={18} className="text-slate-500" />
            <h2 className="text-lg font-semibold leading-7 text-slate-950">阅读材料</h2>
          </div>
          <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-slate-800">{entry?.readingText}</p>
        </div>
      </section>

      <section className="px-4 py-5 md:px-6 lg:overflow-y-auto lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[560px] space-y-6">
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
              onBlur={(event) => onAnswerBlur(event.currentTarget.value)}
              rows={8}
              placeholder="请在这里输入你的回答。"
              className="min-h-52 w-full resize-y rounded-md border border-slate-300 bg-[#f7f9fc] p-4 text-base leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-3 flex flex-col-reverse gap-3 sm:grid sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={onSaveDraft}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Save size={16} />
                保存草稿
              </button>
              <button
                type="button"
                disabled={!answer.trim() || busy}
                onClick={onSubmit}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
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
