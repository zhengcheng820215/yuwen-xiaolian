import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, FileText, PenLine, RotateCcw } from 'lucide-react';
import Card from '../components/Card.jsx';
import { useStudy } from '../context/StudyContext.jsx';

const todayTasks = [
  { title: '知识练习', progress: '0/7 题', icon: CheckCircle2 },
  { title: '阅读理解', progress: '0/1 篇', icon: BookOpen },
  { title: '作文片段', progress: '0/1 篇', icon: PenLine },
];

export default function Home() {
  const { progress, activeMistakes } = useStudy();
  const stats = [
    ['今日完成', progress.todayFinished],
    ['正确率', `${progress.accuracy}%`],
    ['本周学习', `${progress.streakDays} 天`],
    ['累计完成', '128 题'],
  ];

  return (
    <div className="px-5 py-5">
      <header className="mb-4">
        <p className="text-sm font-medium text-blue-600">语文小练</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">今天也来练一点语文吧</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Lv.3 小秀才</span>
          <span className="rounded-md bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">已连续学习 {progress.streakDays} 天</span>
        </div>
      </header>

      <Card className="border-blue-100 bg-white p-5 shadow-lg shadow-blue-100/70">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">今日任务</h2>
            <p className="mt-1 text-sm text-slate-500">完成 3 个小目标，保持语文手感。</p>
          </div>
          <span className="rounded-md bg-gradient-to-r from-blue-50 to-violet-50 px-3 py-1 text-sm font-semibold text-blue-700">0%</span>
        </div>
        <div className="mt-5 space-y-3">
          {todayTasks.map(({ title, progress: taskProgress, icon: Icon }) => (
            <div key={title} className="flex min-h-12 items-center gap-3 rounded-lg bg-gradient-to-r from-blue-50 to-violet-50 px-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-blue-600 shadow-sm">
                <Icon size={17} />
              </span>
              <p className="flex-1 text-sm font-semibold text-slate-800">{title}</p>
              <span className="text-sm font-semibold text-blue-700">{taskProgress}</span>
            </div>
          ))}
        </div>
        <Link to="/quiz/all" className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-blue-200">
          开始今日学习
          <ArrowRight size={18} />
        </Link>
      </Card>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">学习统计</h2>
        <Card>
          <div className="grid grid-cols-4 gap-2 text-center">
            {stats.map(([label, value]) => (
              <div key={label}>
                <p className="text-lg font-semibold text-slate-950">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">继续昨天</h2>
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-violet-50 text-violet-600">
              <FileText size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">阅读理解</p>
              <p className="mt-1 text-sm text-slate-500">已做到第 3 题</p>
            </div>
            <Link to="/practice/ability" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              继续
            </Link>
          </div>
        </Card>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">最近错题</h2>
          <Link to="/mistakes" className="text-sm font-medium text-blue-600">查看</Link>
        </div>
        <div className="space-y-3">
          {activeMistakes.slice(0, 2).map((item) => (
            <Card key={item.id}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-500">
                  <RotateCcw size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-red-500">{item.knowledgePoint}</p>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-900">{item.question}</p>
                </div>
                <Link to={`/quiz/${encodeURIComponent(item.category)}`} className="shrink-0 rounded-md bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600">
                  重新练习
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
