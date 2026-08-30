export default function KnowledgeAnswerInput({ question, value, onChange, locked }) {
  if (question.type === 'fill_blank') {
    return (
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={locked}
        placeholder="请输入答案"
        aria-label="填写答案"
        className="h-13 w-full rounded-lg border border-slate-200 bg-white px-4 outline-none focus:border-blue-400 disabled:bg-slate-50"
      />
    );
  }

  return question.options.map((option, optionIndex) => {
    const chosen = value === option.id;
    const correct = locked && option.id === question.correctAnswer;
    const wrong = locked && chosen && !correct;
    return (
      <button
        key={option.id}
        type="button"
        disabled={locked}
        aria-pressed={chosen}
        onClick={() => onChange(option.id)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onChange(option.id);
        }}
        className={`min-h-14 w-full rounded-lg border px-4 text-left text-sm font-medium transition ${
          correct
            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
            : wrong
              ? 'border-red-400 bg-red-50 text-red-700'
              : chosen
                ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-100'
                : 'border-slate-200 bg-white text-slate-700'
        } disabled:cursor-default`}
      >
        {String.fromCharCode(65 + optionIndex)}. {option.text}
        {correct ? <span className="ml-2 text-xs font-semibold">正确答案</span> : null}
        {wrong ? <span className="ml-2 text-xs font-semibold">你的答案</span> : null}
        {!locked && chosen ? <span className="ml-2 text-xs font-semibold">已选择</span> : null}
      </button>
    );
  });
}
