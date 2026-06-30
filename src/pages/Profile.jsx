import { Award, CalendarDays, Clock, Medal, TrendingUp } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import { useStudy } from '../context/StudyContext.jsx';

const records = [
  ['今天 19:30', '完成综合小练 7 题'],
  ['昨天 20:10', '复习成语运用错题'],
  ['周日 18:40', '完成作文片段训练'],
];

export default function Profile() {
  const { progress } = useStudy();
  const level = progress.totalQuestions > 150 ? '语文进阶生 Lv.4' : '语文练习生 Lv.2';
  const badges = [...progress.badges, '阅读进阶', '作文起步'];

  return (
    <>
      <PageHeader title="我的" subtitle="学习状态与成长记录" />
      <div className="space-y-4 px-5">
        <Card className="bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/12">
              <Medal size={28} />
            </div>
            <div>
              <p className="text-sm text-slate-300">学习等级</p>
              <h2 className="mt-1 text-xl font-semibold">{level}</h2>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          {[
            [CalendarDays, progress.streakDays, '连续天数'],
            [Clock, progress.totalQuestions, '累计完成'],
            [TrendingUp, `${progress.accuracy}%`, '平均正确率'],
          ].map(([Icon, value, label]) => (
            <Card key={label} className="p-3 text-center">
              <Icon className="mx-auto text-blue-600" size={20} />
              <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </Card>
          ))}
        </div>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Award size={20} className="text-amber-500" />
            <h2 className="font-semibold text-slate-900">已获得徽章</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span key={badge} className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                {badge}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">最近学习记录</h2>
          <div className="mt-3 space-y-3">
            {records.map(([time, content]) => (
              <div key={time} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm text-slate-700">{content}</p>
                <span className="shrink-0 text-xs text-slate-400">{time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
