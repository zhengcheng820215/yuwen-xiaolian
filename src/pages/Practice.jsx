import { Link } from 'react-router-dom';
import { BookOpenCheck, ChevronRight, Gamepad2, GraduationCap } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';

const modules = [
  { title: '知识练习', desc: '短题快练，立即反馈', to: '/practice/knowledge', icon: BookOpenCheck, color: 'bg-blue-600' },
  { title: '趣味挑战', desc: '成语、诗句、错字关卡', to: '/practice/fun', icon: Gamepad2, color: 'bg-violet-600' },
  { title: '能力训练', desc: '阅读理解与作文片段', to: '/practice/ability', icon: GraduationCap, color: 'bg-emerald-600' },
];

export default function Practice() {
  return (
    <>
      <PageHeader title="练习" subtitle="选择今天要提升的方向" />
      <div className="space-y-4 px-5">
        {modules.map(({ title, desc, to, icon: Icon, color }) => (
          <Link key={title} to={to} className="flex min-h-24 items-center gap-4 rounded-lg bg-white p-4 shadow-sm">
            <span className={`flex h-12 w-12 items-center justify-center rounded-md text-white ${color}`}>
              <Icon size={24} />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{desc}</p>
            </div>
            <ChevronRight className="text-slate-400" />
          </Link>
        ))}
      </div>
    </>
  );
}
