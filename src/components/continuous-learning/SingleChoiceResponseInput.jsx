export default function SingleChoiceResponseInput({
  options = [],
  selectedOptionId = '',
  onSelect,
  disabled = false,
  groupId = 'current-question',
}) {
  return (
    <fieldset className="mt-7 space-y-3" disabled={disabled} data-testid="single-choice-response">
      <legend className="sr-only">请选择一个答案</legend>
      {options.map((option) => {
        const selected = selectedOptionId === option.optionId;
        return (
          <label
            key={option.optionId}
            className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-4 text-base leading-7 transition ${selected ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-300 bg-white hover:border-slate-400'} ${disabled ? 'cursor-wait opacity-70' : ''}`}
          >
            <input
              type="radio"
              name={`single-choice-${groupId}`}
              value={option.optionId}
              checked={selected}
              onChange={() => onSelect?.(option.optionId)}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span>{option.content}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
