import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  Database,
  FileSearch,
  Layers3,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadPhase163MultiDayReview } from '../api/internalLearningReview.ts';

const tools = [
  {
    to: '/material-resource-workbench',
    icon: BookOpenCheck,
    title: '素材资源录入',
    description: '从素材观测设计批量生成题目 Draft，并进入既有审核与冻结流程。',
    meta: '内容维护',
  },
  {
    to: '/resource-matching-quality-demo',
    icon: FileSearch,
    title: '资源匹配复核',
    description: '检查能力、任务角色、难度与当前 Frozen Resource 是否一致。',
    meta: '资源质量',
  },
  {
    to: '/resource-coverage-dashboard-demo',
    icon: Layers3,
    title: '资源覆盖仪表盘',
    description: '按能力、任务角色和素材集检查正式资源覆盖与缺口。',
    meta: '覆盖规划',
  },
  {
    to: '/internal/learning-review',
    icon: Database,
    title: '正式运行复核',
    description: '查看 Diagnosis、Evidence、正式保存和下一任务的脱敏追溯状态。',
    meta: '运行复核',
  },
  {
    to: '/internal/acceptance',
    icon: ClipboardCheck,
    title: 'Debug 与人工验收',
    description: '集中进入仍有维护价值的 Smoke、Debug 和人工验收页面。',
    meta: '验收工具',
  },
];

export default function InternalHub() {
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    loadPhase163MultiDayReview()
      .then((value) => active && setSummary(value))
      .catch(() => active && setSummary(null))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-blue-600" />
            <h1 className="text-lg font-semibold">内部工作入口</h1>
          </div>
          <Link to="/learning" className="text-sm text-slate-600 hover:text-slate-950">返回学生入口</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="max-w-[760px]">
          <p className="text-sm font-semibold text-blue-700">内部工具</p>
          <h2 className="mt-2 text-xl font-semibold leading-8">内容准备、运行复核与验收</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            此入口仅聚合既有工作页面，不参与学生端状态决策，也不重新执行教育判断。
          </p>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-2" aria-label="内部工作入口列表">
          {tools.map(({ to, icon: Icon, title, description, meta }) => (
            <Link key={to} to={to} className="group flex min-h-[150px] items-start gap-4 rounded-md border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:bg-slate-50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700"><Icon size={19} /></span>
              <span className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-500">{meta}</span>
                <span className="mt-1 block text-base font-semibold text-slate-900">{title}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">{description}</span>
              </span>
              <ArrowRight size={17} className="mt-1 shrink-0 text-slate-400 transition group-hover:text-slate-700" />
            </Link>
          ))}
        </section>

        <section className="mt-10 border-t border-slate-200 pt-7" aria-live="polite">
          <div className="flex items-center gap-2">
            {busy ? <RefreshCw size={16} className="animate-spin text-slate-500" /> : <Database size={16} className="text-slate-500" />}
            <h2 className="text-base font-semibold">自然日运行状态</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {busy
              ? '正在读取正式运行记录。'
              : `当前记录 ${summary?.naturalDays || 0} / ${summary?.targetNaturalDays || 5} 个自然日。页面收敛后的稳定构建确认前，不开始正式计时。`}
          </p>
        </section>
      </main>
    </div>
  );
}
