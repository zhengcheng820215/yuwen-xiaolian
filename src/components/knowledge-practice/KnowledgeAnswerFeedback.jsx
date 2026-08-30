import { forwardRef } from 'react';
import Card from '../Card.jsx';

const KnowledgeAnswerFeedback = forwardRef(function KnowledgeAnswerFeedback({ feedback }, ref) {
  const correct = feedback.result === 'correct';
  return (
    <section ref={ref} tabIndex={-1} aria-live="polite" className="outline-none">
      <Card className="mt-4">
        <h2 className={`text-base font-semibold ${correct ? 'text-emerald-700' : 'text-red-600'}`}>
          {feedback.headline}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
          {!correct ? (
            <>
              <p><span className="font-medium text-slate-900">你的答案：</span>{feedback.submittedAnswerText}</p>
              <p><span className="font-medium text-slate-900">为什么需要核查：</span>{feedback.currentChoiceExplanation}</p>
            </>
          ) : null}
          <p><span className="font-medium text-slate-900">正确答案：</span>{feedback.correctAnswerText}</p>
          <p><span className="font-medium text-slate-900">关键依据：</span>{feedback.keyEvidence}</p>
          <p><span className="font-medium text-slate-900">本题考查：</span>{feedback.knowledgePoint}</p>
          {feedback.misconception ? (
            <p><span className="font-medium text-slate-900">这道题需要注意：</span>{feedback.misconception.studentMessage}</p>
          ) : null}
          {feedback.solutionSteps.length ? (
            <div>
              <p className="font-medium text-slate-900">下次可以这样做：</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {feedback.solutionSteps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
});

export default KnowledgeAnswerFeedback;
