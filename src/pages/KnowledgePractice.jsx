import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import questions from '../data/questions.json';

const categoryOrder = ['字音字形', '成语运用', '病句修改', '标点符号', '文学常识', '古诗文默写', '文言实词虚词', '古文作者背景'];

const categories = categoryOrder
  .map((category) => ({
    name: category,
    count: questions.filter((question) => question.category === category).length,
  }))
  .filter((category) => category.count > 0);

export default function KnowledgePractice() {
  return (
    <>
      <PageHeader title="知识练习" subtitle="碎片化刷题，答完立即看解析" back />
      <div className="px-5">
        <Link to="/quiz/all" className="mb-4 flex min-h-14 items-center justify-center rounded-lg bg-blue-600 font-semibold text-white shadow-sm">
          开始综合小练
        </Link>
        <div className="grid gap-3">
          {categories.map((category) => (
            <Link key={category.name} to={`/quiz/${encodeURIComponent(category.name)}`} className="flex min-h-16 items-center justify-between rounded-lg bg-white px-4 shadow-sm">
              <div>
                <p className="font-medium text-slate-900">{category.name}</p>
                <p className="mt-1 text-xs text-slate-500">{category.count} 道题 · 单选 / 判断 / 填空</p>
              </div>
              <ChevronRight className="text-slate-400" size={20} />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
