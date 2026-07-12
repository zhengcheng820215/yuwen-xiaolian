import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { getPhase84TaskFulfillmentDemoData } from '../api/phase84TaskFulfillment';

const {
  cases,
  defaultCaseId,
} = getPhase84TaskFulfillmentDemoData();

export default function Phase84TaskFulfillmentDemo() {
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId);
  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || cases[0],
    [selectedCaseId],
  );
  const {
    taskRequest,
    fulfillmentResult,
    matchResult,
    branchResult,
  } = selectedCase;
  const fulfillmentRequest = fulfillmentResult.request;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="Phase 8.4 任务请求落地 Demo"
        subtitle="TaskRequest → FulfillmentRequest → MatchResult → ExecutableTask / GenerationRequest"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">当前验收重点</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            任务请求可以安全落地为资源匹配或生成请求
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            本页展示 Phase 8.4 最小闭环：matched 才能生成可执行任务，partial_match 和 no_match 不会伪造可执行任务，invalid TaskRequest 会被阻断。
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">选择验收 Case</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedCaseId(item.id)}
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
          <div className="mt-3 rounded-md bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-500">当前 Case</div>
            <p className="mt-2 text-base leading-7 text-slate-950">{selectedCase.description}</p>
            <p className="mt-2 text-sm leading-6 text-blue-700">{selectedCase.expected}</p>
            <div className="mt-3">
              <InfoList title="本 Case 验收要点" values={selectedCase.acceptancePoints} />
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">1. TaskRequest 输入</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="taskRequestId" value={taskRequest.taskRequestId || '无效输入'} />
            <InfoLine label="strategyId" value={taskRequest.strategyId || '暂无'} />
            <InfoLine label="taskRole" value={formatRole(taskRequest.taskRole)} />
            <InfoLine label="targetAbilityId" value={taskRequest.targetAbilityId || '暂无'} />
            <InfoBlock title="validationGoal" value={taskRequest.validationGoal || '暂无'} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">2. TaskFulfillmentRequest</h2>
          {fulfillmentRequest ? (
            <div className="mt-3 grid gap-3">
              <InfoLine label="requestId" value={fulfillmentRequest.requestId} />
              <InfoLine label="taskRole" value={formatRole(fulfillmentRequest.taskRole)} />
              <InfoLine label="targetAbilityId" value={fulfillmentRequest.targetAbilityId} />
              <InfoLine label="difficultyRange" value={formatDifficultyRange(fulfillmentRequest.difficultyRange)} />
              <InfoLine label="sourceTaskRequestId" value={fulfillmentRequest.sourceTaskRequestId} />
              <InfoLine label="sourceStrategyId" value={fulfillmentRequest.sourceStrategyId || '暂无'} />
              <InfoList title="hardConstraints" values={fulfillmentRequest.hardConstraints} />
              <InfoList title="softPreferences" values={fulfillmentRequest.softPreferences} />
              <InfoList title="recentTaskIds" values={fulfillmentRequest.recentTaskIds || []} />
            </div>
          ) : (
            <BlockedBlock title="fulfillment blocked" reason={fulfillmentResult.blockedReason} />
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">3. TaskResourceMatchResult</h2>
          {matchResult ? (
            <div className="mt-3 grid gap-3">
              <InfoLine label="status" value={formatMatchStatus(matchResult.status)} />
              <InfoLine label="selectedTaskId" value={matchResult.selectedTaskId || '暂无'} />
              <InfoList title="matchedTaskIds" values={matchResult.matchedTaskIds} />
              <InfoList title="matchReasons" values={matchResult.matchReasons} />
              <InfoList title="unmetConstraints" values={matchResult.unmetConstraints} />
              <InfoList title="unmetPreferences" values={matchResult.unmetPreferences} />
            </div>
          ) : (
            <BlockedBlock title="未进入资源匹配" reason="TaskFulfillmentRequest 未生成。" />
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">4. 分流结果</h2>
          <div className="mt-3 grid gap-3">
            {branchResult.executableTask ? (
              <InfoBlock
                title="ExecutableLearningTask"
                value={`${branchResult.executableTask.executableTaskId}\ncontentRef: ${branchResult.executableTask.contentRef}`}
              />
            ) : (
              <InfoBlock title="ExecutableLearningTask" value="未生成" />
            )}

            {branchResult.generationRequest ? (
              <InfoBlock
                title="TaskGenerationRequest"
                value={`${branchResult.generationRequest.generationRequestId}\nvalidationGoal: ${branchResult.generationRequest.validationGoal}`}
              />
            ) : (
              <InfoBlock title="TaskGenerationRequest" value="未生成" />
            )}

            <InfoLine label="blockedReason" value={branchResult.blockedReason || '暂无'} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">验收结论</h2>
          <div className="mt-3 grid gap-3">
            <CheckLine text="matched 才能生成 ExecutableLearningTask。" />
            <CheckLine text="partial_match 不自动执行，不生成 ExecutableLearningTask。" />
            <CheckLine text="no_match 进入 TaskGenerationRequest。" />
            <CheckLine text="invalid TaskRequest 会被 blocked，不进入资源匹配。" />
            <CheckLine text="页面不生成真实题目，不执行学生作答，不更新 Profile。" />
            {selectedCase.acceptancePoints.map((point) => (
              <CheckLine key={point} text={point} />
            ))}
          </div>
        </section>

        <details className="rounded-md border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-base font-semibold text-slate-950">
            开发者调试信息
          </summary>
          <div className="mt-3 grid gap-3 text-sm">
            <JsonBlock title="TaskRequest" value={taskRequest} />
            <JsonBlock title="TaskFulfillmentRequest" value={fulfillmentRequest} />
            <JsonBlock title="TaskResourceMatchResult" value={matchResult} />
            <JsonBlock title="BranchResult" value={branchResult} />
            <JsonBlock title="MockResources" value={selectedCase.resources} />
          </div>
        </details>
      </main>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="ml-2 break-all text-base text-slate-950">{value || '暂无'}</span>
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-950">{value}</div>
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

function BlockedBlock({ title, reason }) {
  return (
    <div className="mt-3 rounded-md bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <p className="mt-2 text-base leading-7 text-slate-950">已阻断</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{reason || '未满足进入下一环节的条件。'}</p>
    </div>
  );
}

function CheckLine({ text }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-800">
      {text}
    </div>
  );
}

function JsonBlock({ title, value }) {
  return (
    <details className="rounded-md bg-slate-50 p-3">
      <summary className="cursor-pointer font-semibold text-slate-700">{title}</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function formatRole(value) {
  const labels = {
    training: '训练任务',
    retest: '复测任务',
    transfer: '迁移任务',
    diagnosis: '诊断任务',
    observation: '观察 / 复核',
  };

  return labels[value] || value || '暂无';
}

function formatMatchStatus(value) {
  const labels = {
    matched: '完全匹配',
    partial_match: '部分匹配',
    no_match: '没有匹配',
  };

  return labels[value] || value;
}

function formatDifficultyRange(value) {
  if (!value) return '暂无';
  return `preferred: ${value.preferred}, minimum: ${value.minimum || 'none'}, maximum: ${value.maximum || 'none'}`;
}
