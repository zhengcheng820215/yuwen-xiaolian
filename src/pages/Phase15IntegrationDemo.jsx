import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { getPhase15IntegrationDemoData } from '../api/phase15IntegrationDemo';

const { cases, defaultCaseId, liveConnection } = getPhase15IntegrationDemoData();

export default function Phase15IntegrationDemo() {
  const [mode, setMode] = useState('integration');
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId);
  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || cases[0],
    [selectedCaseId],
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="Phase 15 真实 AI 整链 Demo"
        subtitle="Formal Diagnosis → Evidence → Evaluation → Quality → Controlled Feedback"
        back
      />

      <main className="mx-auto max-w-[1180px] space-y-4 px-4 pb-10 sm:px-6">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4 sm:p-5">
          <p className="text-sm font-semibold text-blue-700">当前验收重点</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">真实 Provider 已接入，正式产品链保持受控</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
            确定性模式用于稳定验收完整对象链；真实接入模式展示已冻结的 Live Smoke 结果与安全边界。浏览器不保存 API Key，也不展示 Raw Output 或完整 Prompt。
          </p>
        </section>

        <div className="inline-grid grid-cols-2 rounded-md border border-slate-200 bg-white p-1" aria-label="演示模式">
          <ModeButton active={mode === 'integration'} onClick={() => setMode('integration')}>确定性整链验收</ModeButton>
          <ModeButton active={mode === 'live'} onClick={() => setMode('live')}>真实 LLM 接入</ModeButton>
        </div>

        {mode === 'integration' ? (
          <IntegrationView
            selectedCase={selectedCase}
            selectedCaseId={selectedCaseId}
            onSelectCase={setSelectedCaseId}
          />
        ) : (
          <LiveConnectionView record={liveConnection} />
        )}
      </main>
    </div>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-h-10 rounded px-4 text-sm font-normal transition-colors',
        active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function IntegrationView({ selectedCase, selectedCaseId, onSelectCase }) {
  return (
    <>
      <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-base font-semibold text-slate-950">选择验收 Case</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">本页数据来自已通过的 `debug:phase15-integration` 确定性契约样例。</p>
          </div>
          <span className="text-sm text-slate-500">11 / 11 Debug checks PASS</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {cases.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectCase(item.id)}
              className={[
                'min-h-12 rounded-md border px-3 py-3 text-left text-sm font-normal transition-colors',
                selectedCaseId === item.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-sm font-semibold text-slate-500">当前 Case</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{selectedCase.title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">{selectedCase.description}</p>
          <div className="mt-4 rounded-md bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-500">预期结果</p>
            <p className="mt-2 text-sm leading-6 text-slate-800">{selectedCase.expected}</p>
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-500">验收要点</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
              {selectedCase.acceptancePoints.map((point) => <li key={point}>- {point}</li>)}
            </ul>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-950">正式对象链</h2>
          <div className="mt-4 grid gap-2">
            {selectedCase.stages.map((stage, index) => (
              <StageRow key={`${selectedCase.id}-${stage.name}`} stage={stage} index={index + 1} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function LiveConnectionView({ record }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <div className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">真实 Provider 接入记录</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{record.provider}</h2>
          </div>
          <StatusBadge status="passed" text={record.adapterStatus} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoLine label="模型" value={record.model} />
          <InfoLine label="Live Smoke" value={record.liveSmoke} />
          <InfoLine label="运行模式" value={record.supportedModes.join(' / ')} />
          <InfoLine label="Formal Commit" value={record.formalCommit} />
          <InfoLine label="Prompt" value={record.promptPolicy} />
          <InfoLine label="Raw Output" value={record.rawOutputPolicy} />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-950">当前安全边界</h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <p>{record.browserSecretPolicy}。</p>
          <p>{record.currentBoundary}</p>
          <p>当前页面展示冻结验收记录，不会从浏览器直接发起带密钥的真实模型请求。</p>
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          真实外部 Provider 贯穿完整产品链的在线试跑，需要由本地 Node Runtime 或服务端安全执行。
        </div>
      </div>
    </section>
  );
}

function StageRow({ stage, index }) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 rounded-md bg-slate-50 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded bg-white text-sm text-slate-500">{index}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{stage.name}</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{stage.result}</p>
        {stage.objectId && <p className="mt-1 break-all text-xs leading-5 text-slate-500">{stage.objectId}</p>}
      </div>
      <StatusBadge status={stage.status} text={statusLabel(stage.status, stage.name)} />
    </div>
  );
}

function StatusBadge({ status, text }) {
  const styles = {
    passed: 'bg-emerald-50 text-emerald-700',
    blocked: 'bg-rose-50 text-rose-700',
    review: 'bg-amber-50 text-amber-800',
    fallback: 'bg-amber-50 text-amber-800',
    not_created: 'bg-slate-200 text-slate-600',
  };
  return <span className={`shrink-0 rounded px-2 py-1 text-xs ${styles[status] || styles.not_created}`}>{text}</span>;
}

function InfoLine({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function statusLabel(status, stageName) {
  if (status === 'not_created' && stageName === 'LLM Provider') return '未调用';

  const labels = {
    passed: '通过',
    blocked: '已阻断',
    review: '待复核',
    fallback: '已回退',
    not_created: '未生成',
  };
  return labels[status] || status;
}
