import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { getPhase83NextStrategyDemoData } from '../api/phase83NextStrategy';

const {
  cases,
  defaultCaseId,
} = getPhase83NextStrategyDemoData();

export default function Phase83NextStrategyDemo() {
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId);
  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || cases[0],
    [selectedCaseId],
  );
  const {
    growthMemorySummary,
    currentLearningContext,
    strategy,
    validationResult,
    taskRequest,
    blockedReason,
  } = selectedCase;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="Phase 8.3 下一步学习策略 Demo"
        subtitle="GrowthMemorySummary → NextLearningStrategy → Validation → TaskRequest"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">当前验收重点</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            成长记忆可以转化为经过校验的下一步学习策略
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            本页展示 Phase 8.3 最小闭环：系统先生成策略，再校验策略，只有合法策略才会生成 TaskRequest。页面不生成具体题目，也不修改学生画像。
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
          <h2 className="text-base font-semibold text-slate-950">1. GrowthMemorySummary 输入</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="ability" value={growthMemorySummary.abilityLabel || growthMemorySummary.abilityId} />
            <InfoLine label="recentTrend" value={formatTrend(growthMemorySummary.recentTrend)} />
            <InfoLine label="recordCount" value={String(growthMemorySummary.recordCount)} />
            <InfoLine label="latestRecordId" value={growthMemorySummary.latestRecordId || '暂无'} />
            <InfoLine label="evidenceLinks" value={`${growthMemorySummary.evidenceLinks.length} 条`} />
            <InfoBlock title="summary" value={growthMemorySummary.summary} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">2. CurrentLearningContext</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="currentPhase" value={formatPhase(currentLearningContext.currentPhase)} />
            <InfoLine label="targetAbilityId" value={currentLearningContext.targetAbilityId || '暂无'} />
            <InfoLine label="allowTraining" value={formatBoolean(currentLearningContext.allowTraining)} />
            <InfoLine label="allowRetest" value={formatBoolean(currentLearningContext.allowRetest)} />
            <InfoLine label="allowTransfer" value={formatBoolean(currentLearningContext.allowTransfer)} />
            <InfoLine label="recentFailureCount" value={String(currentLearningContext.recentFailureCount || 0)} />
            <InfoLine label="cognitiveLoad" value={formatLoad(currentLearningContext.cognitiveLoad)} />
            <InfoLine label="reviewRequired" value={formatBoolean(Boolean(currentLearningContext.reviewRequired))} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">3. NextLearningStrategy</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="strategyId" value={strategy.strategyId} />
            <InfoLine label="action" value={formatAction(strategy.action)} />
            <InfoLine label="recommendedTaskRole" value={formatRole(strategy.recommendedTaskRole)} />
            <InfoLine label="growthMemoryRecordIds" value={`${strategy.growthMemoryRecordIds.length} 条`} />
            <InfoLine label="evidenceLinks" value={`${strategy.evidenceLinks.length} 条`} />
            <InfoBlock title="reason" value={strategy.reason} />
            <InfoBlock title="validationGoal" value={strategy.validationGoal} />
            <InfoList title="limitations" values={strategy.limitations} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">4. StrategyValidationResult</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="isValid" value={validationResult.isValid ? 'true' : 'false'} />
            <InfoLine label="nextStep" value={formatNextStep(validationResult.nextStep)} />
            <InfoLine label="blockedReason" value={validationResult.blockedReason || '暂无'} />
            <InfoList title="validationErrors" values={validationResult.validationErrors} />
            <InfoList title="warnings" values={validationResult.warnings} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">5. TaskRequest 输出</h2>
          {taskRequest ? (
            <div className="mt-3 grid gap-3">
              <InfoLine label="taskRequestId" value={taskRequest.taskRequestId} />
              <InfoLine label="taskRole" value={formatRole(taskRequest.taskRole)} />
              <InfoLine label="action" value={formatAction(taskRequest.action)} />
              <InfoLine label="targetAbilityId" value={taskRequest.targetAbilityId} />
              <InfoBlock title="validationGoal" value={taskRequest.validationGoal} />
              <InfoList title="constraints" values={taskRequest.constraints} />
            </div>
          ) : (
            <div className="mt-3 rounded-md bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-500">TaskRequest</div>
              <p className="mt-2 text-base leading-7 text-slate-950">未生成</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {blockedReason || '策略未通过校验，已阻断任务请求。'}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">验收结论</h2>
          <div className="mt-3 grid gap-3">
            <CheckLine text="系统能够根据 GrowthMemorySummary 生成 NextLearningStrategy。" />
            <CheckLine text="StrategyValidationResult 会决定是否允许创建 TaskRequest。" />
            <CheckLine text="valid 策略可以生成 TaskRequest。" />
            <CheckLine text="invalid / human_review 策略不会生成 TaskRequest。" />
            <CheckLine text="本页不生成具体题目，不修改 Profile，不重新执行 Evaluation。" />
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
            <JsonBlock title="GrowthMemorySummary" value={growthMemorySummary} />
            <JsonBlock title="CurrentLearningContext" value={currentLearningContext} />
            <JsonBlock title="NextLearningStrategy" value={strategy} />
            <JsonBlock title="StrategyValidationResult" value={validationResult} />
            <JsonBlock title="TaskRequest" value={taskRequest} />
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

function formatTrend(value) {
  const labels = {
    insufficient_evidence: '证据不足',
    continued_observation: '持续观察',
    retest_pending: '待复测',
    fluctuating: '表现波动',
    confidence_increasing: '置信度增加',
    status_improving: '状态出现改善记录',
    mixed: '混合轨迹',
  };

  return labels[value] || value;
}

function formatAction(value) {
  const labels = {
    continue_training: '继续训练',
    independent_retest: '独立复测',
    transfer_test: '迁移验证',
    diagnostic_verification: '诊断性验证',
    collect_more_evidence: '收集更多证据',
    lower_difficulty_training: '降低难度训练',
    maintenance_validation: '保持性验证',
    switch_ability: '切换能力',
    human_review: '人工复核',
  };

  return labels[value] || value;
}

function formatRole(value) {
  const labels = {
    training: '训练任务',
    retest: '复测任务',
    transfer: '迁移任务',
    diagnosis: '诊断任务',
    observation: '观察 / 复核',
  };

  return labels[value] || value;
}

function formatNextStep(value) {
  const labels = {
    create_task_request: '创建 TaskRequest',
    review_required: '进入人工复核',
    regenerate_strategy: '重新生成策略',
    blocked: '阻断',
  };

  return labels[value] || value;
}

function formatPhase(value) {
  const labels = {
    diagnosis: '诊断',
    training: '训练',
    retest: '复测',
    transfer: '迁移',
    observation: '观察',
  };

  return labels[value] || value;
}

function formatLoad(value) {
  const labels = {
    low: '低',
    medium: '中',
    high: '高',
  };

  return labels[value] || value || '暂无';
}

function formatBoolean(value) {
  return value ? '是' : '否';
}
