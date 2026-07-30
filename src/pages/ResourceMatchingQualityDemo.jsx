import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleX,
  Database,
  FileCheck2,
  Loader2,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
} from 'lucide-react';
import { getResourceMatchingQualityDemoData } from '../api/resourceMatchingQualityDemo.ts';
import { getPhase161To162IntegrationDemoData } from '../api/phase161To162IntegrationDemo.ts';
import RefreshIconButton from '../components/RefreshIconButton.jsx';

const demoData = getResourceMatchingQualityDemoData();

export default function ResourceMatchingQualityDemo() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('quality');
  const [selectedCaseId, setSelectedCaseId] = useState(demoData.defaultCaseId);
  const selectedCase = useMemo(
    () => demoData.cases.find((item) => item.id === selectedCaseId) || demoData.cases[0],
    [selectedCaseId],
  );

  const evaluation = selectedCase.qualityResult.evaluation;
  const version = selectedCase.scenario.snapshot.frozenVersions[0];
  const qualityCandidate = evaluation?.candidateEvaluations[0];
  const coreCandidate = selectedCase.coreEligibility.candidateEvaluations[0];

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-6 px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              aria-label="返回内部入口"
              title="返回内部入口"
              onClick={() => navigate('/internal')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-lg font-semibold">资源匹配验收</h1>
                <span className="text-sm font-semibold text-blue-600">Phase 16.1 → 16.2</span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">
                {mode === 'quality'
                  ? '正式资源资格校验 → 上下文匹配 → 可执行任务放行'
                  : '资源录入与冻结 → Repository 交接 → 匹配与任务预览'}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {mode === 'quality' && (
              <StatusPill tone="success" text={`${demoData.summary.passed} / ${demoData.summary.total} Demo Case 通过`} />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6 lg:px-10 lg:py-8">
        <div className="mb-6 inline-flex rounded-md border border-slate-200 bg-white p-1" role="tablist" aria-label="验收模式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'quality'}
            onClick={() => setMode('quality')}
            className={modeButtonClass(mode === 'quality')}
          >
            16.2 匹配质量
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'integration'}
            onClick={() => setMode('integration')}
            className={modeButtonClass(mode === 'integration')}
          >
            16.1 → 16.2 联调
          </button>
        </div>

        {mode === 'quality' ? (
          <>
          <section className="border-b border-slate-200 pb-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-blue-600">人工验收目标</p>
              <h2 className="mt-2 text-lg font-semibold">
                系统能选对正式题目，也能解释为什么拒绝不合适的题目
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                切换左侧 Case，确认 16.2A 与 16.2B 的结果、资源缺口和任务创建状态符合预期。页面展示来自正式 Runtime，不在展示层重新判断资源质量。
              </p>
            </div>
            <div className="md:hidden">
              <StatusPill tone="success" text={`${demoData.summary.passed} / ${demoData.summary.total} Demo Case 通过`} />
            </div>
          </div>
        </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-[96px] lg:self-start">
            <h2 className="text-sm font-semibold text-slate-500">验收 Case</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {demoData.cases.map((item, index) => {
                const active = item.id === selectedCaseId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedCaseId(item.id)}
                    className={[
                      'flex min-h-[52px] items-center gap-3 rounded-md border px-3 py-2 text-left transition',
                      active
                        ? 'border-blue-400 bg-blue-50 text-blue-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    ].join(' ')}
                  >
                    <span className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                      active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500',
                    ].join(' ')}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{item.label}</span>
                    {item.passed ? (
                      <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-label="通过" />
                    ) : (
                      <CircleX size={18} className="shrink-0 text-red-600" aria-label="失败" />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 bg-white ring-1 ring-slate-200">
            <section className="border-b border-slate-200 px-5 py-5 lg:px-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{selectedCase.label}</h2>
                    <StatusPill
                      tone={selectedCase.passed ? 'success' : 'danger'}
                      text={selectedCase.passed ? '符合预期' : '结果异常'}
                    />
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedCase.description}</p>
                </div>
                <StatusPill tone={statusTone(selectedCase.qualityStatus)} text={formatQualityStatus(selectedCase.qualityStatus)} />
              </div>
              <div className="mt-4 border-l-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                <span className="font-semibold">预期：</span>{selectedCase.expected}
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 lg:px-7">
              <h3 className="text-base font-semibold">当前任务请求</h3>
              <div className="mt-4 grid gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="目标能力" value="推理" />
                <Metric label="任务角色" value="训练" />
                <Metric label="期望难度" value="保持当前难度" />
                <Metric label="材料关系" value="相似情境" />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                观察目标：{selectedCase.scenario.fulfillment.validationGoal}
              </p>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 lg:px-7">
              <h3 className="text-base font-semibold">运行结果</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                <FlowStep
                  icon={Database}
                  label="核心资格"
                  value={formatCoreStatus(selectedCase.coreEligibility.status)}
                  tone={coreTone(selectedCase.coreEligibility.status)}
                />
                <ArrowRight className="hidden self-center text-slate-300 md:block" size={20} aria-hidden="true" />
                <FlowStep
                  icon={SearchCheck}
                  label="匹配质量"
                  value={formatQualityStatus(selectedCase.qualityStatus)}
                  tone={statusTone(selectedCase.qualityStatus)}
                />
                <ArrowRight className="hidden self-center text-slate-300 md:block" size={20} aria-hidden="true" />
                <FlowStep
                  icon={FileCheck2}
                  label="任务创建"
                  value={selectedCase.taskResult.status === 'created' ? '已放行' : '已阻断'}
                  tone={selectedCase.taskResult.status === 'created' ? 'success' : 'neutral'}
                />
              </div>
            </section>

            <section className="border-b border-slate-200 px-5 py-5 lg:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold">候选资源检查</h3>
                <span className="text-sm text-slate-500">{version.resourceVersionId}</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-3 pr-4 font-semibold">正式资源</th>
                      <th className="pb-3 px-3 font-semibold">身份与版本</th>
                      <th className="pb-3 px-3 font-semibold">能力</th>
                      <th className="pb-3 px-3 font-semibold">角色</th>
                      <th className="pb-3 px-3 font-semibold">难度</th>
                      <th className="pb-3 px-3 font-semibold">Rubric</th>
                      <th className="pb-3 px-3 font-semibold">上下文</th>
                      <th className="pb-3 pl-3 font-semibold">结论</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      <td className="py-4 pr-4">
                        <div className="font-semibold">{version.title}</div>
                        <div className="mt-1 text-slate-500">{version.taskId}</div>
                      </td>
                      <CheckCell value={Boolean(coreCandidate?.checks.identityAligned && coreCandidate?.checks.registryCurrentVersion)} />
                      <CheckCell value={Boolean(coreCandidate?.checks.targetAbilityAligned)} />
                      <CheckCell value={Boolean(coreCandidate?.checks.taskRoleAligned)} />
                      <CheckCell value={Boolean(coreCandidate?.checks.difficultyAllowed)} />
                      <CheckCell value={Boolean(coreCandidate?.checks.rubricSupportsValidationGoal)} />
                      <CheckCell value={qualityCandidate ? Boolean(
                        qualityCandidate.checks.materialNoveltySatisfied &&
                        qualityCandidate.checks.recentDuplicationAvoided &&
                        qualityCandidate.checks.requiredCapabilitiesSatisfied &&
                        qualityCandidate.checks.hintPolicySupported
                      ) : false} empty={!qualityCandidate} />
                      <td className="py-4 pl-3">
                        <StatusPill
                          tone={candidateTone(qualityCandidate?.status || coreCandidate?.status)}
                          text={formatCandidateStatus(qualityCandidate?.status || coreCandidate?.status)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <DecisionExplanation selectedCase={selectedCase} />
            </section>

            <section className="px-5 py-5 lg:px-7">
              <h3 className="text-base font-semibold">本 Case 验收</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {selectedCase.acceptancePoints.map((point) => (
                  <div key={point} className="flex gap-3 text-sm leading-6 text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                      <Check size={14} aria-hidden="true" />
                    </span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </section>

            <details className="border-t border-slate-200 px-5 py-4 lg:px-7">
              <summary className="cursor-pointer text-sm font-semibold text-slate-600">
                开发者调试信息
              </summary>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <JsonBlock title="CoreResourceEligibilityResult" value={selectedCase.coreEligibility} />
                <JsonBlock title="ResourceMatchQualityResult" value={selectedCase.qualityResult} />
                <JsonBlock title="QualityGatedExecutableTaskResult" value={selectedCase.taskResult} />
                <JsonBlock title="ResourceEligibilitySnapshot" value={selectedCase.scenario.snapshot} />
              </div>
            </details>
          </div>
          </div>
          </>
        ) : (
          <ResourceIntegrationAcceptance />
        )}
      </main>
    </div>
  );
}

function ResourceIntegrationAcceptance() {
  const [data, setData] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    getPhase161To162IntegrationDemoData()
      .then((result) => {
        if (!active) return;
        setData(result);
        setSelectedCaseId(result.defaultCaseId);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  if (error) {
    return (
      <section className="border border-red-200 bg-white px-6 py-8">
        <h2 className="text-lg font-semibold text-red-700">联调数据加载失败</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Repository 流程没有返回完整结果，请重新运行本次联调。</p>
        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={17} aria-hidden="true" />
          重新运行
        </button>
        <details className="mt-6 border-t border-slate-200 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">开发者错误信息</summary>
          <pre className="mt-3 whitespace-pre-wrap break-all text-xs text-red-700">{error}</pre>
        </details>
      </section>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[360px] items-center justify-center border border-slate-200 bg-white">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin text-blue-600" size={28} aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-700">正在创建、审核并冻结联调资源</p>
          <p className="mt-1 text-sm text-slate-500">完成后将自动进入 Phase 16.2 匹配链路</p>
        </div>
      </div>
    );
  }

  const selectedCase = data.cases.find((item) => item.id === selectedCaseId) || data.cases[0];
  const evaluation = selectedCase.qualityResult.evaluation;
  const registry = selectedCase.repositoryState.registryEntries[0];
  const matchingRegistry = selectedCase.repositoryState.snapshot.registryEntries[0];
  const matchingVersion = selectedCase.repositoryState.snapshot.frozenVersions.find((item) => (
    item.resourceVersionId === matchingRegistry?.currentFrozenVersionId
  )) || selectedCase.repositoryState.snapshot.frozenVersions[0];
  const matchingCandidate = selectedCase.coreEligibility.candidateEvaluations.find((item) => (
    item.resourceVersionId === matchingVersion?.resourceVersionId
  ));

  return (
    <>
      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-blue-600">人工联调目标</p>
            <h2 className="mt-2 text-lg font-semibold">证明正式资源可以从 Repository 安全交接为学生可执行任务</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              四个 Case 均从 Phase 16.1 的真实录入、校验、审核和冻结流程开始。页面只负责展示结果，不构造替代 Snapshot，也不重新判断资源是否合格。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill tone={data.summary.passed === data.summary.total ? 'success' : 'danger'} text={`${data.summary.passed} / ${data.summary.total} 联调 Case 通过`} />
            <RefreshIconButton
              onClick={() => setReloadToken((value) => value + 1)}
              label="重新运行联调"
              busyLabel="正在重新运行联调"
            />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[96px] lg:self-start">
          <h2 className="text-sm font-semibold text-slate-500">联调 Case</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {data.cases.map((item, index) => {
              const active = item.id === selectedCase.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedCaseId(item.id)}
                  className={[
                    'flex min-h-[52px] items-center gap-3 rounded-md border px-3 py-2 text-left transition',
                    active
                      ? 'border-blue-400 bg-blue-50 text-blue-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                    active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500',
                  ].join(' ')}>{index + 1}</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">{item.label}</span>
                  {item.passed
                    ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-label="通过" />
                    : <CircleX size={18} className="shrink-0 text-red-600" aria-label="失败" />}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 bg-white ring-1 ring-slate-200">
          <section className="border-b border-slate-200 px-5 py-5 lg:px-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{selectedCase.label}</h2>
                  <StatusPill tone={selectedCase.passed ? 'success' : 'danger'} text={selectedCase.passed ? '符合预期' : '结果异常'} />
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedCase.description}</p>
              </div>
              <StatusPill tone={selectedCase.taskResult.status === 'created' ? 'success' : 'neutral'} text={selectedCase.taskResult.status === 'created' ? '任务已放行' : '任务已阻断'} />
            </div>
            <div className="mt-4 border-l-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
              <span className="font-semibold">预期：</span>{selectedCase.expected}
            </div>
          </section>

          <section className="border-b border-slate-200 px-5 py-5 lg:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">正式交接链路</h3>
              <span className="text-sm text-slate-500">当前正式版本：{registry?.currentFrozenVersionId || '无'}</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {selectedCase.stages.map((stage, index) => (
                <div key={stage.id} className="relative min-h-[112px] rounded-md border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-500">{index + 1}</span>
                    <StageIcon status={stage.status} />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-900">{stage.label}</div>
                  <div className="mt-1 text-sm leading-5 text-slate-500">{stage.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-b border-slate-200 px-5 py-5 lg:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">能力匹配检查</h3>
              <StatusPill
                tone={matchingCandidate?.checks.targetAbilityAligned ? 'success' : 'warning'}
                text={matchingCandidate?.checks.targetAbilityAligned ? '主要能力一致' : '主要能力不一致'}
              />
            </div>
            <div className="mt-4 grid overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">
              <InspectionMetric
                label="当前任务需要"
                value={formatAbilityLabel(evaluation?.targetAbilityId)}
              />
              <InspectionMetric
                label="候选资源能力"
                value={formatAbilityLabel(matchingVersion?.abilityMetadata.abilityId)}
              />
              <InspectionMetric
                label="核心校验结论"
                value={matchingCandidate?.checks.targetAbilityAligned ? '主要能力符合请求' : '主要能力错位'}
                tone={matchingCandidate?.checks.targetAbilityAligned ? 'success' : 'danger'}
              />
              <InspectionMetric
                label="候选资源处理"
                value={formatCoreCandidateAction(matchingCandidate?.status)}
                tone={matchingCandidate?.status === 'eligible' ? 'success' : 'danger'}
              />
              <InspectionMetric
                label="最终任务"
                value={selectedCase.taskResult.status === 'created' ? '已创建' : '未创建'}
                tone={selectedCase.taskResult.status === 'created' ? 'success' : 'neutral'}
              />
              <InspectionMetric
                label="下一步"
                value={formatIntegrationNextStep(evaluation?.nextStep)}
              />
            </div>
            {!matchingCandidate?.checks.targetAbilityAligned && (
              <div className="mt-3 flex gap-3 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={18} aria-hidden="true" />
                <p>
                  当前请求需要<strong>{formatAbilityLabel(evaluation?.targetAbilityId)}</strong>，但正式资源的主要能力是
                  <strong>{formatAbilityLabel(matchingVersion?.abilityMetadata.abilityId)}</strong>。系统已拒绝该候选资源，不会用能力错位的题目补足任务。
                </p>
              </div>
            )}
          </section>

          <section className="border-b border-slate-200 px-5 py-5 lg:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">学生最终看到的任务</h3>
              <span className="text-sm text-slate-500">仅成功放行后显示</span>
            </div>
            {selectedCase.studentPreview ? (
              <div className="mt-4 grid overflow-hidden border border-slate-200 lg:grid-cols-2">
                <div className="bg-slate-50 px-5 py-5 lg:px-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <BookOpen size={17} aria-hidden="true" />
                    阅读材料
                  </div>
                  <p className="mt-4 text-base leading-8 text-slate-800">{selectedCase.studentPreview.readingText}</p>
                </div>
                <div className="border-t border-slate-200 px-5 py-5 lg:border-l lg:border-t-0 lg:px-6">
                  <p className="text-sm font-semibold text-blue-600">本题考查：{selectedCase.studentPreview.abilityLabel}</p>
                  <h4 className="mt-4 text-base font-semibold">{selectedCase.studentPreview.title}</h4>
                  <p className="mt-3 text-base leading-7 text-slate-800">{selectedCase.studentPreview.questionText}</p>
                  <div className="mt-5 min-h-[96px] rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                    在这里输入你的回答。
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex gap-3 rounded-md bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={18} aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-900">当前 Case 不向学生展示任务</p>
                  <p className="mt-1">{integrationBlockReason(selectedCase)}</p>
                </div>
              </div>
            )}
          </section>

          <section className="px-5 py-5 lg:px-7">
            <h3 className="text-base font-semibold">本 Case 验收</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {selectedCase.acceptancePoints.map((point) => (
                <div key={point} className="flex gap-3 text-sm leading-6 text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <Check size={14} aria-hidden="true" />
                  </span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </section>

          <details className="border-t border-slate-200 px-5 py-4 lg:px-7">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600">开发者追溯信息</summary>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <JsonBlock title="Repository Registry / Versions" value={{
                registryEntries: selectedCase.repositoryState.registryEntries,
                versions: selectedCase.repositoryState.versions,
              }} />
              <JsonBlock title="ResourceEligibilitySnapshot" value={selectedCase.repositoryState.snapshot} />
              <JsonBlock title="CoreResourceEligibilityResult" value={selectedCase.coreEligibility} />
              <JsonBlock title="ResourceMatchQualityResult" value={selectedCase.qualityResult} />
              <JsonBlock title="QualityGatedExecutableTaskResult" value={selectedCase.taskResult} />
              {selectedCase.repositoryState.currentSnapshot.snapshotId !== selectedCase.repositoryState.snapshot.snapshotId && (
                <JsonBlock title="Current Snapshot Before Create" value={selectedCase.repositoryState.currentSnapshot} />
              )}
            </div>
          </details>
        </div>
      </div>
    </>
  );
}

function StageIcon({ status }) {
  if (status === 'passed') return <CheckCircle2 size={18} className="text-emerald-600" aria-label="通过" />;
  if (status === 'review') return <ShieldAlert size={18} className="text-amber-600" aria-label="需要复核" />;
  return <CircleX size={18} className="text-slate-400" aria-label="已阻断" />;
}

function InspectionMetric({ label, value, tone = 'default' }) {
  const valueClass = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    danger: 'text-red-700',
    neutral: 'text-slate-600',
  }[tone];
  return (
    <div className="min-h-[82px] bg-white px-4 py-3">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-2 text-base font-semibold ${valueClass}`}>{value || '未形成'}</div>
    </div>
  );
}

function modeButtonClass(active) {
  return [
    'min-h-9 rounded-md px-4 text-sm font-semibold transition',
    active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  ].join(' ');
}

function integrationBlockReason(selectedCase) {
  if (selectedCase.taskResult.issues.includes('selected_resource_is_no_longer_current')) {
    return 'Registry 已发生变化，原匹配结果已经失效。系统已阻断过期版本进入学生任务。';
  }
  if (selectedCase.qualityResult.evaluation?.resourceGap) {
    return '正式资源池没有满足当前目标能力与任务约束的题目，系统已生成资源缺口。';
  }
  return '正式资源未通过完整资格与匹配质量校验，因此保持阻断。';
}

function formatAbilityLabel(abilityId) {
  return {
    inference: '推理',
    comprehension: '理解',
    summarization: '概括',
    expression: '表达',
  }[abilityId] || abilityId || '未识别';
}

function formatCoreCandidateAction(status) {
  return {
    eligible: '已进入匹配候选',
    rejected: '已拒绝',
    review_required: '等待人工复核',
  }[status] || '未进入候选';
}

function formatIntegrationNextStep(nextStep) {
  return {
    create_executable_task: '创建可执行任务',
    prepare_resource: '准备符合要求的资源',
    human_review: '进入人工复核',
    regenerate_strategy: '重新生成策略',
    stop: '停止当前流程',
  }[nextStep] || '保持阻断';
}

function Metric({ label, value }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function FlowStep({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex min-h-[84px] items-center gap-3 rounded-md border border-slate-200 px-4 py-3">
      <span className={[
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
        toneClasses[tone].icon,
      ].join(' ')}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function CheckCell({ value, empty = false }) {
  if (empty) {
    return <td className="px-3 py-4 text-slate-400">未进入</td>;
  }
  return (
    <td className="px-3 py-4">
      <span className={value ? 'text-emerald-600' : 'text-red-600'}>
        {value ? <CheckCircle2 size={19} aria-label="通过" /> : <CircleX size={19} aria-label="未通过" />}
      </span>
    </td>
  );
}

function DecisionExplanation({ selectedCase }) {
  const evaluation = selectedCase.qualityResult.evaluation;
  const version = selectedCase.scenario.snapshot.frozenVersions[0];
  if (selectedCase.taskResult.status === 'created') {
    return (
      <div className="mt-3 flex gap-3 rounded-md bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} aria-hidden="true" />
        <p>
          已选择 <strong>{version.title}</strong>（{evaluation?.selectedResourceVersionId}）。正式版本、匹配约束和任务创建追溯链完整。
        </p>
      </div>
    );
  }

  const reasons = readableIssues(selectedCase);
  return (
    <div className="mt-3 flex gap-3 rounded-md bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
      <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={18} aria-hidden="true" />
      <div>
        <p className="font-semibold text-slate-900">本 Case 未创建可执行任务</p>
        <ul className="mt-1 space-y-1">
          {reasons.map((reason) => <li key={reason}>• {reason}</li>)}
        </ul>
      </div>
    </div>
  );
}

function JsonBlock({ title, value }) {
  return (
    <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">{title}</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-slate-600">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function StatusPill({ tone, text }) {
  return (
    <span className={[
      'inline-flex min-h-7 shrink-0 items-center rounded-md px-2.5 py-1 text-sm font-semibold',
      toneClasses[tone].pill,
    ].join(' ')}>
      {text}
    </span>
  );
}

const toneClasses = {
  success: { pill: 'bg-emerald-50 text-emerald-700', icon: 'bg-emerald-50 text-emerald-700' },
  warning: { pill: 'bg-amber-50 text-amber-800', icon: 'bg-amber-50 text-amber-700' },
  danger: { pill: 'bg-red-50 text-red-700', icon: 'bg-red-50 text-red-700' },
  neutral: { pill: 'bg-slate-100 text-slate-700', icon: 'bg-slate-100 text-slate-600' },
};

function statusTone(status) {
  if (status === 'matched') return 'success';
  if (status === 'review_required') return 'warning';
  return 'neutral';
}

function coreTone(status) {
  if (status === 'eligible') return 'success';
  if (status === 'review_required') return 'warning';
  return 'neutral';
}

function candidateTone(status) {
  if (status === 'eligible_match' || status === 'eligible') return 'success';
  if (status === 'review_required') return 'warning';
  return 'neutral';
}

function formatCoreStatus(status) {
  return {
    eligible: '核心资格通过',
    no_eligible_resource: '无合格资源',
    review_required: '需要人工复核',
    blocked: '输入已阻断',
  }[status] || status;
}

function formatQualityStatus(status) {
  return {
    matched: '完全匹配',
    partial_match: '部分匹配',
    no_match: '没有匹配',
    review_required: '需要人工复核',
  }[status] || status;
}

function formatCandidateStatus(status) {
  return {
    eligible: '核心合格',
    eligible_match: '可以选择',
    partial_match: '部分匹配',
    rejected: '已拒绝',
    review_required: '需要复核',
  }[status] || '未进入匹配';
}

function readableIssues(selectedCase) {
  if (selectedCase.taskResult.issues.includes('selected_resource_is_no_longer_current')) {
    return ['Registry 已切换正式版本，原匹配结果不能继续创建任务。'];
  }
  const coreIssues = selectedCase.coreEligibility.issues;
  const evaluation = selectedCase.qualityResult.evaluation;
  const allIssues = [
    ...coreIssues,
    ...(evaluation?.unmetConstraints || []),
    ...(evaluation?.issues || []),
  ];
  const mapped = allIssues.map((issue) => {
    if (issue.includes('primary_ability_mismatch')) return '资源的主要能力与当前目标能力不一致。';
    if (issue.includes('task_role_mismatch')) return '资源任务角色与当前学习请求不一致。';
    if (issue.includes('not_registry_current') || issue.includes('current_version_missing')) return 'Registry 无法确认该版本是当前正式版本。';
    if (issue.includes('recent_duplication')) return '该任务或资源已出现在近期学习记录中。';
    if (issue.includes('required_capability')) return '资源缺少当前任务要求的正式能力声明。';
    if (issue.includes('not_frozen_active')) return '资源不是可执行的当前 Frozen 状态。';
    return null;
  }).filter(Boolean);
  return [...new Set(mapped.length ? mapped : ['当前资源未满足完整放行条件，系统保持阻断。'])];
}
