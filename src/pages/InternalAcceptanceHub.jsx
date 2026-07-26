import { ArrowLeft, ArrowRight, FlaskConical, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const acceptanceItems = [
  {
    to: '/phase17-5c1-semantic-quality-demo',
    title: '题目语义质量评估验收',
    description: '验证七项语义 Finding、语义警告保留、Provider 失败阻断与安全退出分支。',
    provider: 'Scripted Provider 结果',
    data: '不写 Shared Store',
  },
  {
    to: '/phase17-5-question-quality-demo',
    title: '题目质量审核验收',
    description: '验证质量通过、带提醒通过、建议修改与 Revision 失效四类审核边界。',
    provider: '不调用 Provider',
    data: '正式评估规则生成',
  },
  {
    to: '/student-learning-narrative-calibration-demo',
    title: '学生理解感校准',
    description: '并排复核回应锚点、已完成点、主要缺口和当前答案修改动作。',
    provider: '不调用 Provider',
    data: '4 组冻结样例',
  },
  {
    to: '/resource-coverage-dashboard-demo',
    title: '资源覆盖仪表盘验收',
    description: '验证 Coverage Report 的五种状态、材料追溯与缺口动作。',
    provider: '不调用 Provider',
    data: '受控只读快照',
  },
  {
    to: '/phase16-3-unified-entry-demo',
    title: '统一学习入口验收',
    description: '验证开始、恢复、反馈、复测、阻断与 Session 结束状态。',
    provider: '不调用真实 Provider',
    data: '受控数据',
  },
  {
    to: '/phase16-3-real-chain-demo',
    title: '真实学习主链联调',
    description: '验证正式资源、作答、Diagnosis、Evidence 与下一任务交接。',
    provider: 'Scripted Provider',
    data: '不写自然日记录',
  },
  {
    to: '/phase16-3-multiday-operation-demo',
    title: '多日连续学习验收',
    description: '验证多 Session、恢复、延迟复测和异常阻断。',
    provider: '不调用真实 Provider',
    data: '工程模拟',
  },
  {
    to: '/resource-matching-quality-demo',
    title: '正式资源匹配验收',
    description: '验证能力错位、任务角色错位和质量约束不会被放宽。',
    provider: '不调用 Provider',
    data: '受控资源',
  },
  {
    to: '/phase15-integration-demo',
    title: '真实 AI 整链验收',
    description: '检查 Formal Diagnosis、Evidence 与受控反馈的安全边界。',
    provider: '按页面标记执行',
    data: '验收数据',
  },
];

export default function InternalAcceptanceHub() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8">
          <Link to="/internal" aria-label="返回内部入口" title="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3"><FlaskConical size={20} className="text-blue-600" /><h1 className="text-lg font-semibold">Debug 与人工验收</h1></div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1208px] px-5 py-8 md:px-8 md:py-12">
        <section className="max-w-[780px]">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><ShieldCheck size={16} />与学生体验隔离</div>
          <h2 className="mt-2 text-xl font-semibold leading-8">选择本次需要验证的正式边界</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">每个入口都标明 Provider 与数据影响范围。这里的工程模拟不计入 Phase 16.3C 自然日验收。</p>
        </section>

        <section className="mt-8 divide-y divide-slate-200 border-y border-slate-200" aria-label="验收入口列表">
          {acceptanceItems.map((item) => (
            <Link key={item.to} to={item.to} className="group grid gap-4 bg-white px-5 py-5 transition hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_260px_20px] md:items-center">
              <span>
                <span className="block text-base font-semibold text-slate-900">{item.title}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">{item.description}</span>
              </span>
              <span className="flex flex-wrap gap-2 text-xs text-slate-600 md:justify-end">
                <span className="rounded bg-slate-100 px-2 py-1">{item.provider}</span>
                <span className="rounded bg-slate-100 px-2 py-1">{item.data}</span>
              </span>
              <ArrowRight size={17} className="hidden text-slate-400 transition group-hover:text-slate-700 md:block" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
