import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import { useStudy } from '../context/StudyContext.jsx';

export default function Mistakes() {
  const { mistakes, activeMistakes, markMastered } = useStudy();
  const categories = useMemo(() => ['全部', ...new Set(mistakes.map((item) => item.category))], [mistakes]);
  const [active, setActive] = useState('全部');
  const list = (active === '全部' ? activeMistakes : activeMistakes.filter((item) => item.category === active));

  return (
    <>
      <PageHeader title="错题本" subtitle="按知识点复习薄弱项" />
      <div className="px-5">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActive(category)}
              className={`shrink-0 rounded-md px-3 py-2 text-sm ${active === category ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
            >
              {category}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <Card className="text-center">
            <CheckCircle2 className="mx-auto text-emerald-500" size={38} />
            <p className="mt-3 font-semibold text-slate-900">当前分类没有待复习错题</p>
            <p className="mt-2 text-sm text-slate-500">继续练习，系统会自动收集答错题目。</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {list.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600">{item.category}</span>
                    <h2 className="mt-3 text-base font-semibold leading-7 text-slate-900">{item.question}</h2>
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <p><span className="font-medium text-slate-900">错误答案：</span>{item.wrongAnswer}</p>
                  <p><span className="font-medium text-slate-900">正确答案：</span>{item.answer}</p>
                  <p><span className="font-medium text-slate-900">知识点：</span>{item.knowledgePoint}</p>
                  <p><span className="font-medium text-slate-900">解析：</span>{item.explanation}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Link to={`/quiz/${encodeURIComponent(item.category)}`} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-semibold text-white">
                    <RotateCcw size={16} />
                    重新练习
                  </Link>
                  <button onClick={() => markMastered(item.id)} className="min-h-11 rounded-md bg-emerald-50 text-sm font-semibold text-emerald-700">
                    标记已掌握
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
