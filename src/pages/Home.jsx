import { Link } from 'react-router-dom';
import { ArrowRight, BookMarked, Brain, Flame, PenLine, Sparkles, Target } from 'lucide-react';
import Card from '../components/Card.jsx';
import { useStudy } from '../context/StudyContext.jsx';

const entries = [
  { title: '知识练习', desc: '字词、成语、病句快练', to: '/practice/knowledge', icon: BookMarked, color: 'bg-blue-50 text-blue-600' },
  { title: '趣味挑战', desc: '关卡挑战拿星星', to: '/practice/fun', icon: Sparkles, color: 'bg-violet-50 text-violet-600' },
  { title: '能力训练', desc: '阅读与作文专项', to: '/practice/ability', icon: Brain, color: 'bg-emerald-50 text-emerald-600' },
];

export default function Home() {
  const { progress, activeMistakes } = useStudy();

  return (
    <div className="px-5 py-5">
      <header className="mb-5">
        <p className="text-sm font-medium text-blue-600">语文小练</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">今天也来练一点语文吧</h1>
      </header>

      <Card className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-semibold">{progress.streakDays}</p>
            <p className="mt-1 text-xs text-blue-100">连续天数</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{progress.todayFinished}</p>
            <p className="mt-1 text-xs text-blue-100">今日完成</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{progress.accuracy}%</p>
            <p className="mt-1 text-xs text-blue-100">正确率</p>
          </div>
        </div>
      </Card>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">今日推荐</h2>
          <Flame className="text-orange-500" size={20} />
        </div>
        <div className="space-y-3">
          {[
            ['10 分钟知识小练', '7 道基础题', '/quiz/all'],
            ['1 篇阅读理解', '抓关键句与主旨', '/practice/ability'],
            ['1 个作文片段训练', '审题后写 100-200 字', '/practice/ability'],
          ].map(([title, desc, to]) => (
            <Link key={title} to={to} className="flex min-h-16 items-center justify-between rounded-lg bg-white px-4 shadow-sm">
              <div>
                <p className="font-medium text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-500">{desc}</p>
              </div>
              <ArrowRight size={18} className="text-slate-400" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-3">
        {entries.map(({ title, desc, to, icon: Icon, color }) => (
          <Link key={title} to={to} className="flex min-h-20 items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
            <span className={`flex h-11 w-11 items-center justify-center rounded-md ${color}`}>
              <Icon size={22} />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{desc}</p>
            </div>
            <ArrowRight size={18} className="text-slate-400" />
          </Link>
        ))}
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">最近错题提醒</h2>
          <Link to="/mistakes" className="text-sm font-medium text-blue-600">查看</Link>
        </div>
        <Card>
          <div className="space-y-3">
            {activeMistakes.slice(0, 3).map((item) => (
              <Link key={item.id} to="/mistakes" className="flex items-start gap-3">
                <Target size={18} className="mt-1 text-red-500" />
                <div>
                  <p className="line-clamp-1 text-sm font-medium text-slate-900">{item.question}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.knowledgePoint}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
