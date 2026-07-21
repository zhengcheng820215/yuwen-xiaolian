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
  {
    title: '真实诊断 Runtime',
    desc: '验证 Prompt Builder 到 Student Ability Profile 的 Phase 4.2 链路。',
    status: 'Phase 4.3 通过',
  },
  {
    title: '个性化下一步任务',
    desc: '基于学生画像和 Top Weakness 生成下一次训练任务，并回流画像。',
    status: 'Phase 5.1 Demo',
  },
  {
    title: '任务执行回流',
    desc: '验证个性化任务作答后，如何更新 evidence 并生成下一步决策。',
    status: 'Phase 5.2 Demo',
  },
  {
    title: '学习入口',
    desc: '让学生从统一入口完成第一题作答、诊断反馈和初始能力状态生成。',
    status: 'Phase 7.1 Demo',
  },
  {
    title: '个性化训练入口',
    desc: '基于第一题诊断结果生成个性化训练任务，并将训练表现回流为新证据。',
    status: 'Phase 7.2 Demo',
  },
  {
    title: '复测与本轮结果',
    desc: '基于个性化训练结果生成复测，并输出本轮能力变化判断。',
    status: 'Phase 7.3 Demo',
  },
  {
    title: '评估与画像决策',
    desc: '让 Evidence 先经过 EvaluationResult 和 ProfileUpdateDecision，再更新学生画像。',
    status: 'Phase 8.1 Demo',
  },
  {
    title: '成长记忆',
    desc: '把 EvaluationResult、ProfileUpdateDecision 和画像前后变化沉淀为可查询的 Growth Memory。',
    status: 'Phase 8.2 Demo',
  },
  {
    title: '下一步学习策略',
    desc: '基于成长记忆、学生画像和当前情境生成并校验下一步学习策略。',
    status: 'Phase 8.3 Demo',
  },
  {
    title: '任务请求落地',
    desc: '把 TaskRequest 转换为资源需求，并完成最小任务匹配或生成请求分流。',
    status: 'Phase 8.4 Demo',
  },
  {
    title: '学习回合编排',
    desc: '把策略、任务、学生作答、Evidence 回流和下一步动作串成一轮可验收学习回合。',
    status: 'Phase 10 Demo',
  },
  {
    title: '学生学习体验',
    desc: '从进入任务、提交反馈到本轮结束页，验证学生能独立理解一轮学习。',
    status: 'Phase 11.1-11.3 Demo',
  },
  {
    title: '真实题目资源',
    desc: '把人工录入的真实题目转换为可复用 TaskResource，并生成可执行任务。',
    status: 'Phase 12.2 Demo',
  },
  {
    title: '连续多轮学习',
    desc: '让上一轮正式结果保存后，成为下一轮策略与任务的真实输入。',
    status: 'Phase 12.3 Demo',
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
          to="/learning"
          title="统一学习入口"
          desc="从一个入口开始、继续或恢复学习，不需要访问多个 Demo 页面。"
          action="进入学习"
        />
        <PrimaryAction
          to="/internal/learning-review"
          title="内部复核工作台"
          desc="查看正式学习链路、复核状态与脱敏追溯信息。"
          action="进入复核"
        />
        <PrimaryAction
          to="/phase16-3-unified-entry-demo"
          title="统一学习入口验收"
          desc="验证开始、恢复、反馈、复测、异常阻断与 Session 结束等入口状态。"
          action="开始验收"
        />
        <PrimaryAction
          to="/beta-learning-entry-demo"
          title="开始学习 Beta"
          desc="从真实学习入口完成第一题作答，并获得学生可读诊断反馈。"
          action="开始学习"
        />
        <PrimaryAction
          to="/beta-personalized-training-demo"
          title="个性化训练 Beta"
          desc="承接学习入口结果，生成针对性训练任务，并回流能力证据。"
          action="训练体验"
        />
        <PrimaryAction
          to="/beta-session-result-demo"
          title="复测与本轮结果 Beta"
          desc="承接个性化训练结果，完成复测验证并生成本轮学习反馈。"
          action="进入复测"
        />
        <PrimaryAction
          to="/phase81-evaluation-demo"
          title="评估与画像决策 Demo"
          desc="查看 Evidence 如何经过 EvaluationResult 和 ProfileUpdateDecision 后再更新画像。"
          action="查看决策"
        />
        <PrimaryAction
          to="/phase82-growth-memory-demo"
          title="成长记忆 Demo"
          desc="查看评估结果和画像更新决策如何记录为 Growth Memory，并生成历史轨迹摘要。"
          action="查看记忆"
        />
        <PrimaryAction
          to="/phase83-next-strategy-demo"
          title="下一步学习策略 Demo"
          desc="查看成长记忆如何生成策略，校验后再转换为 TaskRequest。"
          action="查看策略"
        />
        <PrimaryAction
          to="/phase84-task-fulfillment-demo"
          title="任务请求落地 Demo"
          desc="查看 TaskRequest 如何匹配任务资源，或在失败时转为生成请求。"
          action="查看落地"
        />
        <PrimaryAction
          to="/phase10-learning-round-demo"
          title="Phase 10 学习回合 Demo"
          desc="把策略、任务、学生作答、Evidence 回流和下一步动作串成一轮可验收学习回合。"
          action="查看回合"
        />
        <PrimaryAction
          to="/student-learning-entry-demo"
          title="学生学习 Alpha"
          desc="从学习入口、提交反馈到本轮结束页，验收学生可读的一轮最小体验。"
          action="开始学习"
        />
        <PrimaryAction
          to="/task-resource-preparation-demo"
          title="真实题目资源准备"
          desc="录入真实阅读题，校验后生成 TaskResource 和 ConcreteLearningTask。"
          action="准备题目"
        />
        <PrimaryAction
          to="/question-resource-workbench"
          title="题目录入工作台"
          desc="录入 Material 和结构化题目，完成校验、人工审核、Freeze、版本管理与双预览。"
          action="录入题目"
        />
        <PrimaryAction
          to="/resource-matching-quality-demo"
          title="正式资源匹配验收"
          desc="查看正式 Frozen 资源如何经过核心资格与上下文质量 Gate，再决定放行、降级或复核。"
          action="验收匹配"
        />
        <PrimaryAction
          to="/continuous-learning-demo"
          title="连续多轮学习 Demo"
          desc="完成三轮不同任务，验证保存恢复、证据连续和上一轮结果驱动下一轮。"
          action="开始三轮"
        />
        <PrimaryAction
          to="/phase16-3-real-chain-demo"
          title="真实学习主链联调"
          desc="使用同一正式资源和学生作答，验收 Diagnosis、Evidence、成长记忆与下一正式任务的完整交接。"
          action="开始联调"
        />
        <PrimaryAction
          to="/phase15-integration-demo"
          title="真实 AI 整链 Demo"
          desc="查看真实 Provider 接入状态，以及 Formal Diagnosis 如何进入 Evidence、Evaluation 与受控反馈。"
          action="查看整链"
        />
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
        <PrimaryAction
          to="/real-ai-diagnosis-demo"
          title="真实 AI 诊断 Demo"
          desc="验收真实题目如何进入 Prompt、诊断、Evidence 和学生画像。"
          action="运行链路"
        />
        <PrimaryAction
          to="/personalized-next-task-demo"
          title="个性化下一步任务 Demo"
          desc="查看学生画像如何驱动下一题，并在作答后回流诊断与画像。"
          action="体验闭环"
        />
        <PrimaryAction
          to="/personalized-task-execution-demo"
          title="个性化任务执行回流 Demo"
          desc="查看个性化任务作答后，如何回流诊断、更新 evidence 和生成下一步决策。"
          action="执行回流"
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
