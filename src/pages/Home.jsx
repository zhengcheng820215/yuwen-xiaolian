import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';

const phaseSteps = [
  {
    title: '诊断',
    desc: '从一次作答生成结构化能力诊断。',
    status: '已接入 Demo',
  },
  {
    title: '证据',
    desc: '把诊断结果沉淀为可累计的 Ability Evidence。',
    status: 'Phase 3.1 通过',
  },
  {
    title: '训练计划',
    desc: '基于 Top Weakness 生成 3 天阶段训练计划。',
    status: 'Phase 3.2.1 通过',
  },
  {
    title: '训练验证',
    desc: '训练回答和复测回答重新沉淀为能力证据。',
    status: 'Phase 3.3.1 通过',
  },
  {
    title: '学生画像',
    desc: '基于累计证据生成当前能力状态和下一步建议。',
    status: 'Phase 4.1 通过',
  },
];

const frozenItems = [
  '练习：暂时不扩展，后续改造为训练任务入口。',
  '错题本：暂时不扩展，后续改造为 Evidence Review。',
  '我的：暂时不扩展，后续改造为 Student Ability Profile。',
];

export default function Home() {
  return (
    <div className="px-5 py-5">
      <header>
        <h1 className="text-2xl font-semibold leading-tight text-slate-950">
          能力成长计划
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          根据近期作答证据，找到最需要提升的能力，并生成阶段训练安排。
        </p>
      </header>

      <section className="mt-5 grid gap-3">
        <PrimaryAction
          to="/diagnosis-demo"
          title="能力诊断 Demo"
          desc="测试学生答案如何转成能力诊断和 evidence 输入。"
          action="进入诊断"
        />
        <PrimaryAction
          to="/training-plan-demo"
          title="训练计划 Demo"
          desc="查看 Top Weakness 如何生成 3 天阶段训练计划。"
          action="查看计划"
        />
        <PrimaryAction
          to="/training-evidence-demo"
          title="训练证据 Demo"
          desc="查看训练回答和复测回答如何生成新的 Ability Evidence。"
          action="查看证据"
        />
        <PrimaryAction
          to="/student-profile-demo"
          title="学生画像 Demo"
          desc="查看累计证据如何生成当前能力状态和下一步建议。"
          action="查看画像"
        />
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">当前闭环状态</h2>
        <Card>
          <div className="space-y-3">
            {phaseSteps.map((step, index) => (
              <div key={step.title} className="grid grid-cols-[28px_1fr] gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">
                  {index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{step.title}</p>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">暂时冻结的旧模块</h2>
        <Card className="border-slate-200 bg-slate-50 shadow-none">
          <div className="mb-3 text-sm font-semibold text-slate-700">
            不删除，只是不作为当前开发重点
          </div>
          <ul className="space-y-2 text-sm leading-6 text-slate-600">
            {frozenItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}

function PrimaryAction({ to, title, desc, action }) {
  return (
    <Link
      to={to}
      className="block rounded-md border border-slate-200 bg-white p-4 text-slate-950 transition"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p>
        </div>
        <span className="shrink-0 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
          {action}
        </span>
      </div>
    </Link>
  );
}
