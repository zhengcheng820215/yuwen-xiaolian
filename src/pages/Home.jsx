import { Link } from 'react-router-dom';
import { ArrowRight, CircleAlert, CircleCheck, CheckCircle2, NotebookPen, ThumbsUp, TrendingUp } from 'lucide-react';
import Card from '../components/Card.jsx';
import { useStudy } from '../context/StudyContext.jsx';

const todayTasks = [
  { title: '知识练习', shortTitle: '知识', progress: '0/7', completeText: '已完成' },
  { title: '阅读理解', shortTitle: '阅读', progress: '0/1', completeText: '已完成' },
  { title: '作文训练', shortTitle: '作文', progress: '0/1', completeText: '已完成' },
];

const taskSummary = {
  isTodayComplete: false,
  minutes: 15,
  finishedQuestions: 9,
  accuracy: 89,
  reward: '+50 学习经验',
};

const ProgressBar = ({ value }) => (
  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600" style={{ width: `${value}%` }} />
  </div>
);

const StatIcon = ({ children, className = 'bg-slate-50 text-blue-600' }) => (
  <span className={`flex h-8 w-8 items-center justify-center rounded-md ${className}`}>
    {children}
  </span>
);

const CompletedTaskCard = () => (
  <Card className="border-blue-100 bg-white p-5 shadow-lg shadow-blue-100/70">
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <CheckCircle2 size={26} />
      </div>
      <h2 className="mt-3 text-xl font-semibold text-slate-950">今日学习完成！</h2>
    </div>
    <div className="mt-5 space-y-3">
      {todayTasks.map(({ title, completeText }) => (
        <div key={title} className="flex min-h-9 items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={15} />
          </span>
          <p className="flex-1 text-sm font-medium text-slate-700">{title}</p>
          <span className="text-sm font-semibold text-emerald-600">{completeText}</span>
        </div>
      ))}
    </div>
    <div className="mt-5 grid grid-cols-2 gap-3 text-center">
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-lg font-semibold text-slate-950">{taskSummary.minutes}分钟</p>
        <p className="mt-1 text-xs text-slate-500">今日学习</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-lg font-semibold text-slate-950">{taskSummary.finishedQuestions}题</p>
        <p className="mt-1 text-xs text-slate-500">完成</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-lg font-semibold text-slate-950">91%</p>
        <p className="mt-1 text-xs text-slate-500">正确率</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-lg font-semibold text-blue-700">{taskSummary.reward}</p>
        <p className="mt-1 text-xs text-slate-500">获得</p>
      </div>
    </div>
    <Link to="/practice" className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-blue-200">
      自由练习
      <ArrowRight size={18} />
    </Link>
  </Card>
);

const TodayTaskCard = () => (
  <Card className="border-blue-100 bg-white p-5 shadow-lg shadow-blue-100/70">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">今日学习</h2>
      </div>
    </div>
    <div className="mt-5 space-y-3">
      {todayTasks.map(({ title, progress, shortTitle }, index) => (
        <div key={title} className="grid min-h-10 grid-cols-[24px_1fr_52px] items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
            {index + 1}
          </span>
          <p className="text-base font-semibold text-slate-600">{shortTitle}</p>
          <span className="text-right text-lg font-semibold leading-none text-slate-950">{progress}</span>
        </div>
      ))}
    </div>
    <div className="mt-5 grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">预计用时</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{taskSummary.minutes} 分钟</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">完成奖励</p>
        <p className="mt-1 text-sm font-semibold text-blue-700">{taskSummary.reward}</p>
      </div>
    </div>
    <Link to="/quiz/all" className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-blue-200">
      开始今日学习
      <ArrowRight size={18} />
    </Link>
  </Card>
);

const ContinueCard = () => (
  <Card>
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">阅读理解</p>
          <p className="mt-1 text-sm text-slate-500">已做到第 3 题</p>
        </div>
        <Link to="/practice/ability" className="shrink-0 rounded-md bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600">
          继续学习
        </Link>
      </div>
      <div className="mt-4">
        <ProgressBar value={40} />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>已完成 40%</span>
          <span>预计剩余 5 分钟</span>
        </div>
      </div>
    </div>
  </Card>
);

export default function Home() {
  const { progress } = useStudy();
  const stats = [
    { label: '今天完成', value: `${progress.todayFinished}题`, icon: <NotebookPen size={18} /> },
    { label: '正确率', value: `${progress.accuracy}%`, icon: <CircleCheck size={18} /> },
    { label: '比昨天提高', value: '+3%', icon: <TrendingUp size={18} /> },
    { label: '累计完成', value: '128题', icon: <ThumbsUp size={18} /> },
  ];
  const mistakeStat = { label: '错题数量', value: '13题', icon: <CircleAlert size={18} /> };

  return (
    <div className="px-5 py-5">
      <header className="mb-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Lv.3 小秀才</span>
          <span className="rounded-md bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">距离 Lv.4 还差 35 XP</span>
        </div>
      </header>

      {taskSummary.isTodayComplete ? <CompletedTaskCard /> : <TodayTaskCard />}

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">AI 能力诊断</h2>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Diagnosis Demo</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">验证学生答案到能力诊断 JSON 的链路</p>
            </div>
            <Link to="/diagnosis-demo" className="shrink-0 rounded-md bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600">
              打开
            </Link>
          </div>
        </Card>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">学习反馈</h2>
        <Card>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ label, value, icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-white">
                <StatIcon>{icon}</StatIcon>
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-0.5 text-base font-semibold text-slate-950">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">继续昨天</h2>
        <ContinueCard />
      </section>

      <section className="mt-5">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-900">错题回顾</h2>
        </div>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-white">
              <StatIcon className="bg-red-50 text-red-500">{mistakeStat.icon}</StatIcon>
              <div>
                <p className="text-xs text-slate-500">{mistakeStat.label}</p>
                <p className="mt-0.5 text-base font-semibold text-slate-950">{mistakeStat.value}</p>
              </div>
            </div>
            <Link to="/mistakes" className="shrink-0 rounded-md bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600">
              查看
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
