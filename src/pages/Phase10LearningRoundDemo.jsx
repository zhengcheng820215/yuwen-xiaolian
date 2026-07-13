import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import {
  getPhase10LearningRoundDemoData,
  runPhase10LearningRoundDemo,
} from '../api/phase10LearningRound';

const { cases, defaultCaseId } = getPhase10LearningRoundDemoData();

export default function Phase10LearningRoundDemo() {
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId);
  const selectedCase = cases.find((item) => item.id === selectedCaseId) || cases[0];
  const [answerText, setAnswerText] = useState(selectedCase.defaultAnswer);
  const result = useMemo(
    () => runPhase10LearningRoundDemo(selectedCaseId, answerText),
    [selectedCaseId, answerText],
  );
  const { display, startResult, executionResult, completionResult } = result;

  function selectCase(caseItem) {
    setSelectedCaseId(caseItem.id);
    setAnswerText(caseItem.defaultAnswer);
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="Phase 10 学习回合 Demo"
        subtitle="Learning Round Start -> Execution -> Evidence Return -> Next Step"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">当前验收重点</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            一轮学习可以从策略进入任务，并在有效作答后回流证据
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            本页只演示 Phase 10 的最小产品闭环：启动一轮学习、展示任务、提交答案、检查作答有效性、完成 Evidence 回流，并给出下一步动作。
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">选择验收 Case</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCase(item)}
                className={[
                  'rounded-md border px-3 py-3 text-left text-sm font-semibold',
                  selectedCaseId === item.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            {selectedCase.description}
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">1. 本轮任务</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="目标能力" value={display.targetAbility} />
            <InfoLine label="任务角色" value={display.taskRole} />
            <InfoBlock title="验证目标" value={display.validationGoal} />
            <InfoBlock title="题目" value={display.taskTitle} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">2. 学生答案</h2>
          <textarea
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            rows={5}
            className="mt-3 w-full rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
            placeholder="请输入学生答案"
          />
          <p className="mt-2 text-sm leading-6 text-slate-500">
            可以输入有效答案，也可以输入空答案、数字或“哈哈”来验证无效作答阻断。
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">3. 回合状态</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="本轮结果" value={display.roundStatus} strong />
            <InfoLine label="启动状态" value={display.startStatus} />
            <InfoLine label="执行状态" value={display.executionStatus} />
            <InfoLine label="答案有效性" value={display.responseValidity} />
            <InfoLine label="诊断结果" value={display.diagnosisStatus} />
            <InfoBlock title="仍需关注" value={display.diagnosisGap} />
            <InfoLine label="Evidence 回流" value={display.canEnterEvidenceReturn} />
            <InfoLine label="回流状态" value={display.evidenceReturnStatus} />
            <InfoLine label="下一步" value={display.nextStep} strong />
            <InfoBlock title="下一步原因" value={display.nextStepReason} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">4. Evidence 与记忆回流</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="AbilityEvidence 数量" value={String(display.evidenceCount)} />
            <InfoLine label="EvaluationResult" value={display.evaluationResultId} />
            <InfoLine label="ProfileUpdateDecision" value={display.profileUpdateDecisionId} />
            <InfoLine label="GrowthMemoryRecord" value={display.growthMemoryRecordId} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">验收结论</h2>
          <div className="mt-3 grid gap-3">
            {display.acceptance.map((item) => (
              <InfoBlock key={item} title="验收点" value={item} />
            ))}
            <InfoList title="阻断或复核信息" values={display.issues} />
          </div>
        </section>

        <details className="rounded-md border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-base font-semibold text-slate-950">
            开发者调试信息
          </summary>
          <div className="mt-3 grid gap-3">
            <JsonBlock title="LearningRoundStartResult" value={startResult} />
            <JsonBlock title="LearningRoundExecutionResult" value={executionResult} />
            <JsonBlock title="LearningRoundResult" value={completionResult} />
          </div>
        </details>
      </main>
    </div>
  );
}

function InfoLine({ label, value, strong = false }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className={[
        'ml-2 break-all text-base',
        strong ? 'font-semibold text-blue-700' : 'text-slate-950',
      ].join(' ')}
      >
        {value || '暂无'}
      </span>
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-950">{value || '暂无'}</div>
    </div>
  );
}

function InfoList({ title, values }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      {values.length > 0 ? (
        <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-800">
          {values.map((value) => (
            <li key={value} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span>{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">暂无</p>
      )}
    </div>
  );
}

function JsonBlock({ title, value }) {
  return (
    <details className="rounded-md bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">{title}</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
