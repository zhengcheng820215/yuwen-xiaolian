import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { getPhase82GrowthMemoryDemoData } from '../api/phase82GrowthMemory';

const {
  cases,
  defaultCaseId,
} = getPhase82GrowthMemoryDemoData();

export default function Phase82GrowthMemoryDemo() {
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId);
  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || cases[0],
    [selectedCaseId],
  );
  const {
    latestRecord,
    storeResult,
    summary,
  } = selectedCase;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="Phase 8.2 成长记忆 Demo"
        subtitle="EvaluationResult + ProfileUpdateDecision → GrowthMemoryRecord → Store → Summary"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">当前验收重点</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            评估与画像决策可以沉淀为 Growth Memory
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            本页展示 Phase 8.2 最小闭环：一次 Evaluation 和 ProfileUpdateDecision 被记录为 GrowthMemoryRecord，再由 Store 保存查询，最后形成不越界的历史轨迹摘要。
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
          <h2 className="text-base font-semibold text-slate-950">1. GrowthMemoryRecord</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="recordId" value={latestRecord.recordId} />
            <InfoLine label="action" value={formatAction(latestRecord.action)} />
            <InfoLine label="evaluationResultId" value={latestRecord.evaluationResultId} />
            <InfoLine label="profileUpdateDecisionId" value={latestRecord.profileUpdateDecisionId} />
            <InfoLine label="relatedSessionId" value={latestRecord.relatedSessionId || '暂无'} />
            <InfoLine label="evidenceLinks" value={`${latestRecord.evidenceLinks.length} 条`} />
            <InfoBlock title="reason" value={latestRecord.reason} />
            <InfoList title="limitations" values={latestRecord.limitations} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">2. Profile 前后摘要</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SnapshotCard title="beforeProfileSummary" snapshot={latestRecord.beforeProfileSummary} />
            <SnapshotCard title="afterProfileSummary" snapshot={latestRecord.afterProfileSummary} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">3. GrowthMemoryStore</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="总记录数" value={String(storeResult.totalRecords)} />
            <InfoLine label="按 studentId 查询" value={`${storeResult.studentRecordCount} 条`} />
            <InfoLine label="按 abilityId 查询" value={`${storeResult.abilityRecordCount} 条`} />
            <InfoLine label="按 studentId + abilityId 查询" value={`${storeResult.scopedRecordCount} 条`} />
            <InfoLine label="重复 recordId 写入" value={storeResult.duplicateInserted ? '错误：重复插入' : '已拒绝或幂等返回'} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">4. GrowthMemorySummary</h2>
          <div className="mt-3 grid gap-3">
            <InfoLine label="recordCount" value={String(summary.recordCount)} />
            <InfoLine label="latestAction" value={formatAction(summary.latestAction)} />
            <InfoLine label="recentTrend" value={formatTrend(summary.recentTrend)} />
            <InfoLine label="recentActions" value={summary.recentActions.map(formatAction).join(' / ')} />
            <InfoList title="pendingActions" values={summary.pendingActions} />
            <InfoList title="limitations" values={summary.limitations} />
            <InfoBlock title="summary" value={summary.summary} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">验收结论</h2>
          <div className="mt-3 grid gap-3">
            <CheckLine text="GrowthMemoryRecord 能追溯 EvaluationResult、ProfileUpdateDecision 和 evidenceLinks。" />
            <CheckLine text="Profile 前后摘要可见，便于回放画像变化。" />
            <CheckLine text="GrowthMemoryStore 能保存、查询并处理重复 recordId。" />
            <CheckLine text="GrowthMemorySummary 只描述历史轨迹，不生成新的能力评价结论。" />
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
            <JsonBlock title="GrowthMemoryRecord[]" value={selectedCase.records} />
            <JsonBlock title="GrowthMemoryStoreResult" value={storeResult} />
            <JsonBlock title="GrowthMemorySummary" value={summary} />
          </div>
        </details>
      </main>
    </div>
  );
}

function SnapshotCard({ title, snapshot }) {
  return (
    <article className="rounded-md bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
      <div className="mt-3 grid gap-2 text-sm">
        <InfoLine label="ability" value={snapshot.abilityLabel || snapshot.abilityId} />
        <InfoLine label="status" value={formatStatus(snapshot.abilityStatus)} />
        <InfoLine label="evidenceCount" value={String(snapshot.evidenceCount)} />
        <InfoBlock title="summary" value={snapshot.summary || '暂无'} />
      </div>
    </article>
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

function formatAction(value) {
  const labels = {
    no_change: '保持不变',
    append_evidence_only: '只追加证据',
    update_confidence: '更新置信度',
    update_status: '更新状态',
    mark_fluctuating: '标记波动',
    request_retest: '请求复测',
    human_review: '人工复核',
  };

  return labels[value] || value || '暂无';
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

function formatStatus(value) {
  const labels = {
    weak: '仍薄弱',
    improving: '有改善',
    stable_positive: '相对稳定',
    insufficient_evidence: '证据不足',
  };

  return labels[value] || value || '暂无';
}
