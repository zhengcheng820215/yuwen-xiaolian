export default function KnowledgeQuizActions({ answered, canSubmit, isSubmitting, isLast, onSubmit, onNext }) {
  return (
    <footer className="sticky bottom-0 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
      {!answered ? (
        <button
          type="button"
          onClick={onSubmit}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onSubmit();
          }}
          disabled={!canSubmit || isSubmitting}
          className="min-h-12 w-full rounded-lg bg-blue-600 font-semibold text-white disabled:bg-slate-300"
        >
          {isSubmitting ? '正在提交' : '提交答案'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onNext();
          }}
          className="min-h-12 w-full rounded-lg bg-blue-600 font-semibold text-white"
        >
          {isLast ? '查看结果' : '下一题'}
        </button>
      )}
    </footer>
  );
}
