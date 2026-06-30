import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Flame, RotateCcw, Target, TrendingUp } from 'lucide-react';
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

const mistakeLabels = {
  病句修改: '病句',
  文言实词虚词: '文言文',
  成语运用: '成语',
  古文作者背景: '古文',
  字音字形: '字词',
  标点符号: '标点',
  古诗文默写: '默写',
  文学常识: '文学',
};

const ProgressBar = ({ value }) => (
  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600" style={{ width: `${value}%` }} />
  </div>
);

const StatIcon = ({ children }) => (
  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-50 text-blue-600">
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
        <h2 className="text-2xl font-semibold text-slate-950">今日任务</h2>
      </div>
    </div>
    <div className="mt-5 space-y-3">
      {todayTasks.map(({ title, progress, shortTitle }, index) => (
        <div key={title} className="grid min-h-10 grid-cols-[24px_1fr_64px] items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
            {index + 1}
          </span>
          <p className="text-sm font-medium text-slate-500">{shortTitle}</p>
          <span className="text-right text-xl font-semibold text-slate-950">{progress}</span>
        </div>
      ))}
    </div>
    <div className="mt-5 grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">预计用时</p>
        <p className="mt-1 text-base font-semibold text-slate-900">{taskSummary.minutes} 分钟</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">完成奖励</p>
        <p className="mt-1 text-base font-semibold text-blue-700">{taskSummary.reward}</p>
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
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-violet-50 text-violet-600">
        <BookOpen size={21} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">阅读理解</p>
            <p className="mt-1 text-sm text-slate-500">已做到第 3 题</p>
          </div>
          <Link to="/practice/ability" className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
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
    </div>
  </Card>
);

export default function Home() {
  const { progress, activeMistakes } = useStudy();
  const stats = [
    { label: '今天完成', value: `${progress.todayFinished}题`, icon: <Flame size={18} /> },
    { label: '正确率', value: `${progress.accuracy}%`, icon: <Target size={18} /> },
    { label: '比昨天提高', value: '+3%', icon: <TrendingUp size={18} /> },
    { label: '累计完成', value: '128题', icon: <BookOpen size={18} /> },
  ];

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
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">{mistakeLabels[item.category] || item.category}</span>
                    <p className="truncate text-xs text-slate-500">{item.knowledgePoint}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                    <span>连续错误 2 次</span>
                    <span>预计复习 2 分钟</span>
                  </div>
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
