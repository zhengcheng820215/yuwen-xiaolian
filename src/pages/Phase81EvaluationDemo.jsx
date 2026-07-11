import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { getPhase81EvaluationDemoData } from '../api/phase81Evaluation';

const {
  cases,
  defaultCaseId,
} = getPhase81EvaluationDemoData();

export default function Phase81EvaluationDemo() {
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId);
  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || cases[0],
    [selectedCaseId],
  );
  const {
    evidence,
    currentProfile,
    evaluationResult,
    profileUpdateDecision,
    executionResult,
    updatedProfile,
  } = selectedCase;
  const beforeStatus = currentProfile.ability_status.find((item) => item.ability === evaluationResult.abilityId);
  const afterStatus = updatedProfile.ability_status.find((item) => item.ability === evaluationResult.abilityId);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="Phase 8.1 评估决策 Demo"
        subtitle="Evidence → EvaluationResult → ProfileUpdateDecision → StudentAbilityProfile"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">当前验收重点</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Evidence 不直接改变 Profile
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            选择不同 Evidence Case，页面会重新走 Phase 8.1 最小链路：能力证据先生成评估结果，再生成画像更新决策，最后由 Profile Runtime 执行决策。
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
          <h2 className="text-base font-semibold text-slate-950">1. Ability Evidence 输入</h2>
          <div className="mt-3 grid gap-3">
            {evidence.map((item) => (
              <EvidenceCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">2. EvaluationResult</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="目标能力" value={evaluationResult.abilityLabel || evaluationResult.abilityId} />
            <InfoLine label="证据充分性" value={formatSufficiency(evaluationResult.evidenceSufficiency)} />
            <InfoLine label="成长层级" value={formatGrowthLevel(evaluationResult.growthLevel)} />
            <InfoLine label="冲突状态" value={formatConflict(evaluationResult.conflictStatus)} />
            <InfoLine label="下一步动作" value={formatNextAction(evaluationResult.nextAction)} />
            <InfoLine label="置信度" value={formatPercent(evaluationResult.confidence)} />
            <InfoBlock title="评估摘要" value={evaluationResult.summary} />
            <InfoList title="限制说明" values={evaluationResult.limitations} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">3. ProfileUpdateDecision</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="决策动作" value={formatDecisionAction(profileUpdateDecision.action)} />
            <InfoLine label="原状态" value={profileUpdateDecision.fromStatus || '暂无'} />
            <InfoLine label="目标状态" value={profileUpdateDecision.toStatus || '不直接更新状态'} />
            <InfoBlock title="决策理由" value={profileUpdateDecision.reason} />
            <InfoList title="待验证事项" values={profileUpdateDecision.pendingVerification || []} />
            <InfoList title="风险提醒" values={profileUpdateDecision.warnings} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">4. StudentAbilityProfile 执行结果</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="执行动作" value={formatDecisionAction(executionResult.action)} />
            <InfoLine label="更新前状态" value={formatProfileStatus(beforeStatus?.status)} />
            <InfoLine label="更新后状态" value={formatProfileStatus(afterStatus?.status)} />
            <InfoBlock title="更新后说明" value={afterStatus?.summary || '暂无'} />
            <InfoList title="实际变更字段" values={executionResult.changedFields} />
            <InfoBlock title="下一步建议" value={updatedProfile.next_step_recommendation} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">验收结论</h2>
          <div className="mt-3 grid gap-3">
            <CheckLine text="AbilityEvidence 已先生成 EvaluationResult。" />
            <CheckLine text="EvaluationResult 已生成 ProfileUpdateDecision。" />
            <CheckLine text="Profile 只按 Decision 执行更新。" />
            <CheckLine text={`当前 Case 决策动作为：${formatDecisionAction(profileUpdateDecision.action)}。`} />
            <CheckLine text={selectedCase.expected} />
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
            <JsonBlock title="EvaluationResult" value={evaluationResult} />
            <JsonBlock title="ProfileUpdateDecision" value={profileUpdateDecision} />
            <JsonBlock title="ProfileExecutionResult" value={executionResult} />
            <JsonBlock title="UpdatedStudentAbilityProfile" value={updatedProfile} />
          </div>
        </details>
      </main>
    </div>
  );
}

function EvidenceCard({ item }) {
  return (
    <article className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-950">{item.id}</h3>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700">
          {item.source} / {item.evidenceType}
        </span>
      </div>
      <p className="mt-2 leading-6 text-slate-700">{item.observation}</p>
      <p className="mt-2 text-slate-500">confidence {formatPercent(item.confidence)}</p>
    </article>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="ml-2 text-base text-slate-950">{value}</span>
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

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatSufficiency(value) {
  const labels = {
    insufficient: '证据不足',
    limited: '证据有限',
    sufficient: '证据可用于本轮评估',
  };

  return labels[value] || value;
}

function formatGrowthLevel(value) {
  const labels = {
    unconfirmed: '尚未确认',
    early_signal: '早期改善迹象',
    improving: '正在改善',
    stable: '稳定表现',
    fluctuating: '表现波动',
  };

  return labels[value] || value;
}

function formatConflict(value) {
  const labels = {
    none: '无明显冲突',
    minor: '轻微冲突，需继续验证',
    significant: '明显冲突，需复核',
  };

  return labels[value] || value;
}

function formatNextAction(value) {
  const labels = {
    collect_more_evidence: '继续收集证据',
    continue_training: '继续训练',
    independent_retest: '独立复测',
    transfer_test: '迁移验证',
    maintenance: '保持性练习',
    human_review: '人工复核',
  };

  return labels[value] || value;
}

function formatDecisionAction(value) {
  const labels = {
    no_change: '保持不变',
    append_evidence_only: '只追加证据',
    update_confidence: '更新置信度',
    update_status: '更新状态',
    mark_fluctuating: '标记波动',
    request_retest: '请求复测',
    human_review: '人工复核',
  };

  return labels[value] || value;
}

function formatProfileStatus(value) {
  const labels = {
    weak: '仍薄弱',
    improving: '有改善',
    stable_positive: '相对稳定',
    insufficient_evidence: '证据不足',
  };

  return labels[value] || value || '暂无';
}
