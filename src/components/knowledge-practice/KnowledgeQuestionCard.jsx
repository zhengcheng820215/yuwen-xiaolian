import Card from '../Card.jsx';

const typeNames = { single_choice: '单选题', true_false: '判断题', fill_blank: '填空题' };
const difficultyNames = { 1: '基础', 2: '中等', 3: '较难' };

export function knowledgeQuestionTypeName(type) {
  return typeNames[type] || '知识题';
}

export default function KnowledgeQuestionCard({ question, role = 'base' }) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {question.category} · {difficultyNames[question.difficulty]}
        </span>
        {role === 'reinforcement' ? (
          <span className="inline-flex rounded-md bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            本轮巩固题
          </span>
        ) : null}
      </div>
      {role === 'reinforcement' ? <p className="mb-2 text-sm leading-6 text-slate-500">根据本轮一道错题安排，请独立判断。</p> : null}
      <h2 className="text-lg font-semibold leading-8 text-slate-950">{question.stem}</h2>
    </Card>
  );
}
