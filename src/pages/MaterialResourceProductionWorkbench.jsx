import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FilePlus2,
  Link2,
  LoaderCircle,
  PackagePlus,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  approveProductionObservationPlan,
  createProductionMaterial,
  createProductionObservationPlan,
  createProductionQuestionDrafts,
  createPhase17BatchADraftsForReview,
  getMaterialResourceProductionSnapshot,
  isPhase17BatchAMaterial,
  loadPhase17BatchAPlansForReview,
  loadTongguanCalibrationPlanForReview,
  submitProductionObservationPlan,
  synchronizeProductionObservationLinks,
} from '../api/materialResourceProductionWorkbench.ts';
import {
  getMaterialObservationDraftGeneratorStatus,
  requestMaterialObservationDraftCandidates,
} from '../api/materialObservationDraftGenerator.ts';
import WorkspaceToast from '../components/continuous-learning/WorkspaceToast.jsx';
import {
  activeLinksForPlan,
  isPlanFullyPublished,
  selectCurrentPlanDrafts,
  summarizeMaterialResourceWorkbench,
} from './materialResourceWorkbenchState.ts';

const dimensionOptions = [
  ['fact', '事实'], ['character', '人物'], ['plot', '情节'], ['causality', '因果'],
  ['structure', '结构'], ['language', '语言'], ['theme', '主题'],
];
const abilityOptions = [
  ['extraction', '信息提取'], ['comprehension', '理解'], ['summarization', '概括'],
  ['analysis', '分析'], ['inference', '推理'], ['expression', '表达'],
];
const trainingDirectionOptions = [
  ['fact_details', '事实信息'],
  ['character_psychology', '人物与心理'],
  ['plot_development', '情节发展'],
  ['causal_relation', '原因与结果'],
  ['text_structure', '文章结构'],
  ['language_expression', '语言表达'],
  ['theme_emotion', '主题与情感'],
];
const roleOptions = [
  ['training', '训练'], ['retest', '复测'], ['transfer', '迁移'],
  ['diagnosis', '诊断'], ['observation', '观察'],
];
const difficultyOptions = [['basic', '基础'], ['intermediate', '标准'], ['advanced', '进阶']];
const anchorOptions = [['paragraph', '单段'], ['paragraph_range', '段落范围'], ['full_text', '全文']];
const assessmentModeOptions = [
  ['key_points', '关键点'],
  ['reasoning_chain', '推理链'],
  ['expression_quality', '表达质量'],
];
const questionTypeOptions = [
  ['open_short_answer', '开放简答'],
  ['reading_comprehension', '阅读理解'],
  ['fill_blank', '填空'],
  ['multiple_choice', '单项选择'],
  ['true_false', '判断'],
];
const responseFormatOptions = [
  ['short_text', '短文本'],
  ['long_text', '长文本'],
  ['single_choice', '单项选择'],
  ['boolean', '判断'],
];
const statusLabels = {
  draft: '未提交审核', pending_review: '等待审核', revision_required: '需要修订',
  reviewed: '计划已审核', rejected: '已拒绝', superseded: '已被新版本替代',
};
const statusBadgeClasses = {
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  pending_review: 'border-blue-200 bg-blue-50 text-blue-700',
  revision_required: 'border-amber-200 bg-amber-50 text-amber-700',
  reviewed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  superseded: 'border-slate-200 bg-slate-50 text-slate-500',
};
const draftStatusLabels = {
  drafted: '待校验', validation_failed: '校验未通过', pending_review: '等待逐题审核',
  revision_required: '需要修订', reviewed: '审核通过', rejected: '已拒绝',
};
const abilityLabels = Object.fromEntries(abilityOptions);
const dimensionLabels = Object.fromEntries(dimensionOptions);
const trainingDirectionLabels = Object.fromEntries(trainingDirectionOptions);
const roleLabels = Object.fromEntries(roleOptions);
const difficultyLabels = Object.fromEntries(difficultyOptions);

export default function MaterialResourceProductionWorkbench() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [materialMode, setMaterialMode] = useState('existing');
  const [activeLoadPreset, setActiveLoadPreset] = useState(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [tasks, setTasks] = useState(createInitialTasks);
  const [taskEditorDirty, setTaskEditorDirty] = useState(false);
  const [generatorStatus, setGeneratorStatus] = useState(null);
  const [generatorResult, setGeneratorResult] = useState(null);
  const [generatorBusy, setGeneratorBusy] = useState(false);
  const [generatorPreferences, setGeneratorPreferences] = useState({
    gradeRange: '初中',
    candidateCount: 3,
    preferredAbilityIds: [],
    requestedFocusIds: [],
  });
  const [materialForm, setMaterialForm] = useState({ title: '', content: '', description: '人工录入素材', copyrightNote: '' });
  const [notice, setNotice] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const pendingDiscardActionRef = useRef(null);

  useEffect(() => {
    refresh().catch((error) => setNotice(errorNotice(error)));
    getMaterialObservationDraftGeneratorStatus().then(setGeneratorStatus);
  }, []);

  const selectedMaterial = useMemo(
    () => snapshot.materials.find((item) => item.materialVersionId === selectedMaterialId) || null,
    [snapshot.materials, selectedMaterialId],
  );
  const paragraphs = useMemo(() => splitParagraphs(selectedMaterial?.content || ''), [selectedMaterial]);
  const materialPlans = useMemo(
    () => snapshot.plans.filter((plan) => plan.materialVersionId === selectedMaterialId),
    [snapshot.plans, selectedMaterialId],
  );
  const selectedPlan = snapshot.plans.find((plan) => plan.materialObservationPlanId === selectedPlanId)
    || materialPlans[0]
    || null;
  const selectedValidation = selectedPlan
    ? snapshot.validations.find((value) => value.materialObservationPlanId === selectedPlan.materialObservationPlanId && value.planRevision === selectedPlan.revision)
    : null;
  const planDrafts = useMemo(
    () => selectCurrentPlanDrafts(selectedPlan, snapshot.drafts),
    [selectedPlan, snapshot.drafts],
  );
  const planLinks = useMemo(
    () => activeLinksForPlan(selectedPlan, snapshot.links),
    [selectedPlan, snapshot.links],
  );
  const planDraftReadiness = planDrafts.map((draft) => ({
    draft,
    readiness: snapshot.draftReadiness.find((item) => item.draftId === draft.draftId) || null,
  }));
  const planFullyPublished = isPlanFullyPublished({
    plan: selectedPlan,
    currentDrafts: planDrafts,
    draftReadiness: snapshot.draftReadiness,
  });
  const workbenchSummary = useMemo(
    () => summarizeMaterialResourceWorkbench(snapshot),
    [snapshot],
  );
  const selectedPlanUsesAssistedDraft = Boolean(selectedPlan?.taskPlans.some(
    (task) => task.resourceDraftSpecification?.tags?.includes('ai-assisted'),
  ));
  const assistedDraftStage = planFullyPublished
    ? 'frozen'
    : selectedPlanUsesAssistedDraft && planDrafts.length > 0
      ? 'question_review'
      : selectedPlanUsesAssistedDraft
        ? 'observation_plan'
        : taskEditorDirty && tasks.some((task) => task.sourceType === 'ai_assisted')
          ? 'imported'
          : generatorResult?.status === 'candidates_ready'
            ? 'candidate'
            : 'material';
  const generatorInventory = useMemo(
    () => buildGeneratorInventory({
      materialVersionId: selectedMaterialId,
      plans: materialPlans,
      drafts: snapshot.drafts,
      tasks,
      includeEditableTasks: taskEditorDirty,
      previousCandidates: generatorResult?.candidates || [],
    }),
    [selectedMaterialId, materialPlans, snapshot.drafts, tasks, taskEditorDirty, generatorResult],
  );

  useEffect(() => {
    setTasks(selectedPlan
      ? selectedPlan.taskPlans.map((task, index) => planTaskToEditableTask(task, index, snapshot.anchors))
      : createInitialTasks());
    setTaskEditorDirty(false);
  }, [selectedMaterialId, selectedPlan?.materialObservationPlanId]);

  useEffect(() => {
    setGeneratorResult(null);
  }, [selectedMaterialId]);

  async function refresh(preferred = {}) {
    const next = await getMaterialResourceProductionSnapshot();
    setSnapshot(next);
    if (next.materials.length === 0) setMaterialMode('new');
    if (preferred.materialVersionId) setMaterialMode('existing');
    const materialId = preferred.materialVersionId
      || (selectedMaterialId && next.materials.some((item) => item.materialVersionId === selectedMaterialId) ? selectedMaterialId : next.materials[0]?.materialVersionId)
      || '';
    setSelectedMaterialId(materialId);
    const plans = next.plans.filter((plan) => plan.materialVersionId === materialId);
    const planId = preferred.planId
      || (selectedPlanId && plans.some((plan) => plan.materialObservationPlanId === selectedPlanId) ? selectedPlanId : plans[0]?.materialObservationPlanId)
      || '';
    setSelectedPlanId(planId);
  }

  async function run(action, success, preferred) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      await refresh(typeof preferred === 'function' ? preferred(result) : preferred || {});
      setNotice({ type: 'success', message: success(result) });
      return result;
    } catch (error) {
      setNotice(errorNotice(error));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function addMaterial() {
    const material = await run(
      () => createProductionMaterial(materialForm),
      () => '素材已保存，可以开始设计 3–6 个能力观测任务。',
      (result) => ({ materialVersionId: result.materialVersionId }),
    );
    if (material) {
      setMaterialMode('existing');
      setMaterialForm({ title: '', content: '', description: '人工录入素材', copyrightNote: '' });
    }
  }

  async function refreshWorkbench() {
    setBusy(true);
    setNotice(null);
    try {
      await refresh();
      setToast({ id: Date.now(), message: '工作台数据已刷新。' });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setBusy(false);
    }
  }

  function withUnsavedChangesGuard(action) {
    if (!taskEditorDirty) {
      action();
      return;
    }
    pendingDiscardActionRef.current = action;
    setDiscardDialogOpen(true);
  }

  function cancelDiscardChanges() {
    pendingDiscardActionRef.current = null;
    setDiscardDialogOpen(false);
  }

  function confirmDiscardChanges() {
    const action = pendingDiscardActionRef.current;
    pendingDiscardActionRef.current = null;
    setDiscardDialogOpen(false);
    setTaskEditorDirty(false);
    action?.();
  }

  function showExistingMaterials() {
    if (materialMode === 'existing') return;
    withUnsavedChangesGuard(() => {
      const materialId = snapshot.materials.some((item) => item.materialVersionId === selectedMaterialId)
        ? selectedMaterialId
        : snapshot.materials[0]?.materialVersionId || '';
      setMaterialMode(snapshot.materials.length > 0 ? 'existing' : 'new');
      setSelectedMaterialId(materialId);
      setSelectedPlanId('');
    });
  }

  function showNewMaterialForm() {
    if (materialMode === 'new') return;
    withUnsavedChangesGuard(() => {
      setMaterialMode('new');
      setSelectedMaterialId('');
      setSelectedPlanId('');
    });
  }

  function selectExistingMaterial(materialId) {
    if (materialId === selectedMaterialId) return;
    withUnsavedChangesGuard(() => {
      setSelectedMaterialId(materialId);
      setSelectedPlanId('');
      setActiveLoadPreset(null);
    });
  }

  function requestLoadBatchA() {
    withUnsavedChangesGuard(() => {
      loadBatchA();
    });
  }

  function requestLoadTongguanCalibration() {
    withUnsavedChangesGuard(() => {
      loadTongguanCalibration();
    });
  }

  async function loadBatchA() {
    const result = await run(
      () => loadPhase17BatchAPlansForReview(),
      (result) => `Batch A 已载入 ${result.materialVersionIds.length} 篇素材和 ${result.materialObservationPlanIds.length} 份待审核观测计划。`,
      (result) => ({ materialVersionId: result.materialVersionIds[0] }),
    );
    if (result) setActiveLoadPreset('batch_a');
  }

  async function loadTongguanCalibration() {
    const result = await run(
      () => loadTongguanCalibrationPlanForReview(),
      (result) => result.reused
        ? '《潼关》校准案例已存在，六项真实观测任务已显示在当前工作区。'
        : '《潼关》校准案例已载入，六项真实观测任务已显示并等待人工审核。',
      (result) => ({ materialVersionId: result.materialVersionId, planId: result.materialObservationPlanId }),
    );
    if (result) setActiveLoadPreset('tongguan');
  }

  async function createPlan() {
    await run(
      () => createProductionObservationPlan({ materialVersionId: selectedMaterialId, tasks: tasks.map(toTaskInput) }),
      (result) => result.validation.passed ? '训练任务已保存并通过结构校验。' : '训练任务已保存，但需要先修复校验问题。',
      (result) => ({ materialVersionId: selectedMaterialId, planId: result.plan.materialObservationPlanId }),
    );
  }

  async function generateObservationCandidates() {
    if (!selectedMaterial) return;
    setGeneratorBusy(true);
    setGeneratorResult(null);
    setNotice(null);
    try {
      const result = await requestMaterialObservationDraftCandidates({
        requestId: createGeneratorRequestId(selectedMaterial.materialVersionId),
        generationMode: 'discover_new_observation',
        material: {
          materialVersionId: selectedMaterial.materialVersionId,
          title: selectedMaterial.title,
          content: selectedMaterial.content,
          sourceDescription: selectedMaterial.source?.description,
          copyrightNote: selectedMaterial.source?.copyrightNote,
        },
        preferences: {
          gradeRange: generatorPreferences.gradeRange,
          candidateCount: generatorPreferences.candidateCount,
          preferredAbilityIds: generatorPreferences.preferredAbilityIds,
          requestedFocus: generatorPreferences.requestedFocusIds
            .map((focusId) => trainingDirectionLabels[focusId])
            .join('；') || undefined,
        },
        existingInventory: generatorInventory,
      });
      setGeneratorResult(result);
      setNotice(result.status === 'candidates_ready'
        ? { type: 'success', message: `AI 找到 ${result.coveragePreview.newObservationCount} 个尚未覆盖的 Observation；替代题与疑似重复项不会导入。` }
        : result.status === 'provider_failed'
          ? { type: 'error', message: 'AI 服务本次调用未完成，没有生成候选，也没有写入任何正式记录。请查看具体原因后重试。' }
          : { type: 'error', message: '本次候选不足或存在结构问题，未导入也未写入任何正式记录。' });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setGeneratorBusy(false);
    }
  }

  function importGeneratedCandidates() {
    if (generatorResult?.status !== 'candidates_ready') return;
    setTasks(generatorResult.candidates.map(generatorCandidateToEditableTask));
    setTaskEditorDirty(true);
    setNotice({
      type: 'success',
      message: `已将 ${generatorResult.candidates.length} 个候选导入本地编辑区。它们尚未保存为 Plan，仍需人工检查后手动生成。`,
    });
  }

  function togglePreferredAbility(abilityId) {
    setGeneratorPreferences((current) => {
      const selected = current.preferredAbilityIds.includes(abilityId);
      if (!selected && current.preferredAbilityIds.length >= 2) return current;
      return {
        ...current,
        preferredAbilityIds: selected
          ? current.preferredAbilityIds.filter((item) => item !== abilityId)
          : [...current.preferredAbilityIds, abilityId],
      };
    });
  }

  function toggleRequestedFocus(focusId) {
    setGeneratorPreferences((current) => {
      const selected = current.requestedFocusIds.includes(focusId);
      if (!selected && current.requestedFocusIds.length >= 2) return current;
      return {
        ...current,
        requestedFocusIds: selected
          ? current.requestedFocusIds.filter((item) => item !== focusId)
          : [...current.requestedFocusIds, focusId],
      };
    });
  }

  function toggleSupportingAbility(taskIndex, abilityId) {
    const currentTask = tasks[taskIndex];
    const selectedIds = commaValues(currentTask.supportingAbilityIdsText);
    const nextIds = selectedIds.includes(abilityId)
      ? selectedIds.filter((item) => item !== abilityId)
      : [...selectedIds, abilityId];
    updateTask(taskIndex, { supportingAbilityIdsText: nextIds.join(', ') });
  }

  async function submitPlan() {
    await run(
      () => submitProductionObservationPlan(selectedPlan.materialObservationPlanId),
      () => '训练任务已提交人工审核。',
      { materialVersionId: selectedMaterialId, planId: selectedPlan.materialObservationPlanId },
    );
  }

  async function approvePlan() {
    await run(
      () => approveProductionObservationPlan(selectedPlan.materialObservationPlanId),
      () => '训练任务已确认，可以生成待审核题目。',
      { materialVersionId: selectedMaterialId, planId: selectedPlan.materialObservationPlanId },
    );
  }

  async function createDrafts() {
    await run(
      () => isPhase17BatchAMaterial(selectedPlan.materialVersionId)
        ? createPhase17BatchADraftsForReview(selectedPlan.materialVersionId)
        : createProductionQuestionDrafts(selectedPlan.materialObservationPlanId),
      (results) => {
        if (!Array.isArray(results)) {
          return `Batch A 已生成 ${results.draftIds.length} 道题，并进入逐题审核。`;
        }
        const failed = results.filter((item) => item.status === 'failed').length;
        return failed === 0
          ? `已准备 ${results.length} 道待审核题目，并完成内容检查。`
          : `${results.length - failed} 道题已准备，${failed} 道需要单独处理。`;
      },
      { materialVersionId: selectedMaterialId, planId: selectedPlan.materialObservationPlanId },
    );
  }

  async function syncLinks() {
    await run(
      () => synchronizeProductionObservationLinks(selectedPlan.materialObservationPlanId),
      (results) => {
        const linked = results.filter((item) => item.status === 'linked').length;
        return linked === results.length
          ? `${linked} 道训练任务已完成发布关联。`
          : `已确认 ${linked} 道；其余任务需先完成逐题审核与发布。`;
      },
      { materialVersionId: selectedMaterialId, planId: selectedPlan.materialObservationPlanId },
    );
  }

  function updateTask(index, patch) {
    setTaskEditorDirty(true);
    setTasks((current) => current.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task));
  }

  function removeTask(index) {
    setTaskEditorDirty(true);
    setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index));
  }

  function addTask() {
    setTaskEditorDirty(true);
    setTasks((current) => [...current, createTask(current.length)]);
  }

  return (
    <div className="material-resource-workbench min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1120px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <Link to="/internal" aria-label="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"><ArrowLeft size={18} /></Link>
            <div>
              <h1 className="text-lg font-semibold">素材资源生产</h1>
              <p className="text-sm text-slate-500">Phase 17.2 · 最小生产工具</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={requestLoadTongguanCalibration} disabled={busy} className={`hidden min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold disabled:opacity-50 md:flex ${activeLoadPreset === 'tongguan' ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <BookOpen size={16} />使用《潼关》校准案例
            </button>
            <button type="button" onClick={requestLoadBatchA} disabled={busy} className={`hidden min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold disabled:opacity-50 sm:flex ${activeLoadPreset === 'batch_a' ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <PackagePlus size={16} />使用 Batch A 资源包
            </button>
            <button type="button" onClick={refreshWorkbench} disabled={busy} title="刷新工作台数据" aria-label="刷新工作台数据" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={17} className={busy ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-5 py-7 md:px-8 md:py-9">
        <section className="grid gap-3 border-b border-slate-200 pb-7 sm:grid-cols-4" aria-label="生产状态">
          <Metric label="学习材料" value={workbenchSummary.materialCount} />
          <Metric label="学习任务" value={workbenchSummary.learningTaskCount} />
          <Metric label="待审核题目" value={workbenchSummary.pendingReviewCount} />
          <Metric label="已发布练习" value={workbenchSummary.publishedResourceCount} />
        </section>

        {notice && <div role="status" className={`mt-5 border-l-4 px-4 py-3 text-sm leading-6 ${notice.type === 'error' ? 'border-red-500 bg-red-50 text-red-800' : 'border-emerald-500 bg-emerald-50 text-emerald-800'}`}>{notice.message}</div>}

        <div className="mt-8 space-y-10">
          <section>
            <div className="flex justify-center">
              <div className="inline-flex rounded-md border border-slate-300 bg-white p-1" aria-label="素材录入方式">
                <button type="button" onClick={showExistingMaterials} disabled={snapshot.materials.length === 0} className={`min-h-8 rounded px-3 text-sm ${materialMode === 'existing' ? 'bg-emerald-600 text-white' : 'text-slate-600'} disabled:opacity-40`}>选择已有素材</button>
                <button type="button" onClick={showNewMaterialForm} className={`min-h-8 rounded px-3 text-sm ${materialMode === 'new' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}>录入新素材</button>
              </div>
            </div>

            {materialMode === 'existing' && snapshot.materials.length > 0 && (
              <label className="mt-5 block text-sm font-semibold">
                已有素材
                <select value={selectedMaterialId} onChange={(event) => selectExistingMaterial(event.target.value)} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal">
                  {snapshot.materials.map((material) => <option key={material.materialVersionId} value={material.materialVersionId}>{material.title}</option>)}
                </select>
              </label>
            )}

            {materialMode === 'new' && (
              <div className="mt-5">
                <label className="block text-sm font-semibold">素材标题<input value={materialForm.title} onChange={(event) => setMaterialForm((value) => ({ ...value, title: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                <label className="mt-4 block text-sm font-semibold">素材正文<textarea value={materialForm.content} onChange={(event) => setMaterialForm((value) => ({ ...value, content: event.target.value }))} rows={10} className="mt-2 w-full rounded-md border border-slate-300 bg-white p-3 font-normal leading-7" placeholder="每个自然段换行。" /></label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">来源说明<input value={materialForm.description} onChange={(event) => setMaterialForm((value) => ({ ...value, description: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                  <label className="block text-sm font-semibold">版权备注<input value={materialForm.copyrightNote} onChange={(event) => setMaterialForm((value) => ({ ...value, copyrightNote: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                </div>
                <button type="button" onClick={addMaterial} disabled={busy || !materialForm.title.trim() || !materialForm.content.trim()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"><FilePlus2 size={16} />保存素材</button>
              </div>
            )}

            {materialMode === 'existing' && selectedMaterial && (
              <div className="mt-5">
                <div className="flex items-center gap-2 text-sm text-slate-500"><BookOpen size={16} /><span>{paragraphs.length} 个自然段</span></div>
                <div className="mt-4 max-h-[660px] space-y-5 overflow-y-auto border-t border-slate-200 py-5 pr-3">
                  {paragraphs.map((paragraph, index) => (
                    <div key={`${index}-${paragraph.slice(0, 10)}`} className="grid grid-cols-[28px_1fr] gap-3">
                      <span className="pt-1 text-sm font-semibold text-slate-400">{index + 1}</span>
                      <p className="text-base leading-8 text-slate-800">{paragraph}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="border-t border-slate-200 pt-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">训练任务（<span className="text-emerald-600">{tasks.length}</span>/6）</h2>
              </div>
            </div>
            {selectedPlan && (
              <div className="mt-4 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                当前正在查看第 {selectedPlan.revision} 版训练任务（{statusLabels[selectedPlan.status]}）。浏览不会改变内容；修改后点击“保存任务修改”，系统才会创建新版本。
              </div>
            )}
            <section className="mt-4 rounded-md bg-white px-4 py-5 sm:px-5" aria-labelledby="ai-observation-generator-title" aria-busy={generatorBusy}>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 id="ai-observation-generator-title" className="text-base font-semibold">AI 生成训练任务</h3>
                  <span className={`text-xs font-semibold ${generatorStatus?.status === 'ready' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {generatorStatus?.status === 'ready' ? `DeepSeek 已就绪 · ${generatorStatus.model}` : 'AI 服务未配置'}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">AI 根据学习材料生成可编辑的训练任务和评分标准。生成内容需人工确认后才能保存、送审或发布。</p>
              </div>
              <AssistedDraftWorkflow stage={assistedDraftStage} />
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium">适用学段（生成参考）</p>
                  <div className="mt-1 flex min-h-10 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-normal text-slate-700">初中</div>
                  <p className="mt-1 text-xs font-normal leading-5 text-slate-500">仅用于 AI 生成参考，不代表正式年级或能力难度判断。</p>
                </div>
                <div>
                  <p className="text-sm font-medium">生成任务数量</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {[3, 4, 5, 6].map((count) => (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={generatorPreferences.candidateCount === count}
                        disabled={generatorBusy}
                        onClick={() => setGeneratorPreferences((current) => ({ ...current, candidateCount: count }))}
                        className={`min-h-10 w-14 rounded-md border text-sm font-normal transition disabled:cursor-not-allowed disabled:opacity-40 ${generatorPreferences.candidateCount === count ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-600'}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">AI 将尝试生成该数量的待确认训练任务，实际任务数量可能更少。</span>
                </div>
                <div>
                  <p className="text-sm font-medium">训练方向（可选）</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {trainingDirectionOptions.map(([focusId, label]) => {
                      const selected = generatorPreferences.requestedFocusIds.includes(focusId);
                      const selectionLimitReached = generatorPreferences.requestedFocusIds.length >= 2;
                      return (
                        <button
                          key={focusId}
                          type="button"
                          aria-pressed={selected}
                          disabled={generatorBusy || (!selected && selectionLimitReached)}
                          onClick={() => toggleRequestedFocus(focusId)}
                          className={`min-h-9 rounded-md border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-600'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">最多能选择 2 项；当不选择时由 AI 根据材料判断。</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium">训练能力（可选）</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {abilityOptions.map(([abilityId, label]) => {
                    const selected = generatorPreferences.preferredAbilityIds.includes(abilityId);
                    const selectionLimitReached = generatorPreferences.preferredAbilityIds.length >= 2;
                    return <button key={abilityId} type="button" aria-pressed={selected} disabled={generatorBusy || (!selected && selectionLimitReached)} onClick={() => togglePreferredAbility(abilityId)} className={`min-h-9 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-600'}`}>{label}</button>;
                  })}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">最多能选择 2 项；当不选择时由 AI 根据材料判断。</p>
              </div>
              <div className="mt-4 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                {!selectedMaterial
                  ? '请先选择或保存素材。生成训练任务后，系统会自动过滤重复内容。'
                  : generatorInventory.observations.length === 0 && generatorInventory.questions.length === 0
                    ? '当前素材尚未保存训练任务。再次生成时，系统会自动过滤重复内容，只保留新的训练方向。'
                    : `当前素材已保存：训练方向（${generatorInventory.observations.length}）· 训练任务（${generatorInventory.questions.length}）。再次生成时，系统会自动过滤重复内容。`}
              </div>
              <button type="button" onClick={generateObservationCandidates} disabled={generatorBusy || generatorStatus?.status !== 'ready' || !selectedMaterial} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
                {generatorBusy
                  ? <><LoaderCircle aria-hidden="true" size={18} className="animate-spin" /><span aria-live="polite">正在分析素材并生成训练任务…</span></>
                  : generatorResult
                    ? '再次生成训练任务'
                    : 'AI根据素材生成训练任务'}
              </button>
              {generatorResult && <GeneratorCandidatePreview result={generatorResult} onImport={importGeneratedCandidates} />}
            </section>
            <div className="mt-5 rounded-md bg-white p-4 sm:p-5" aria-label="当前训练任务覆盖">
              <p className="text-base font-semibold text-slate-700">当前训练任务覆盖</p>
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">已包含的能力</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {abilityOptions
                      .filter(([abilityId]) => tasks.some((task) => task.abilityId === abilityId))
                      .map(([abilityId, label]) => (
                        <span key={abilityId} className="rounded bg-emerald-50 px-2 py-1 text-xs font-normal text-emerald-800">{label}</span>
                      ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">已包含的训练方向</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dimensionOptions
                      .filter(([dimensionId]) => tasks.some((task) => task.primaryDimension === dimensionId))
                      .map(([dimensionId, label]) => (
                        <span key={dimensionId} className="rounded bg-blue-50 px-2 py-1 text-xs font-normal text-blue-800">{label}</span>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {tasks.map((task, index) => (
                <div key={task.localId} className="rounded-md bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">{taskEditorTitle(index)}</h3>
                    <button type="button" aria-label={`删除${taskEditorTitle(index)}`} disabled={tasks.length <= 3} onClick={() => removeTask(index)} className="min-h-8 px-2 text-sm font-normal text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-red-200">删除</button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Select label="训练内容" value={task.primaryDimension} options={dimensionOptions} onChange={(value) => updateTask(index, { primaryDimension: value })} />
                    <Select label="训练能力" value={task.abilityId} options={abilityOptions} onChange={(value) => updateTask(index, {
                      abilityId: value,
                      expectedStudentAction: actionForAbility(value),
                      rubric: task.rubric.map((item, rubricIndex) => rubricIndex === 0 ? { ...item, abilityId: value } : item),
                    })} />
                    <Select label="任务用途" value={task.taskRole} options={roleOptions} onChange={(value) => updateTask(index, { taskRole: value })} />
                    <Select label="难度" value={task.difficulty} options={difficultyOptions} onChange={(value) => updateTask(index, { difficulty: value })} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Select label="阅读范围" value={task.anchorType} options={anchorOptions} onChange={(value) => updateTask(index, { anchorType: value })} />
                    {task.anchorType !== 'full_text' && <label className="block text-sm font-medium">开始段落<input type="number" min="1" max={Math.max(paragraphs.length, 1)} value={task.startParagraph} onChange={(event) => updateTask(index, { startParagraph: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>}
                    {task.anchorType === 'paragraph_range' && <label className="block text-sm font-medium">结束段落<input type="number" min={task.startParagraph} max={Math.max(paragraphs.length, 1)} value={task.endParagraph} onChange={(event) => updateTask(index, { endParagraph: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>}
                  </div>
                  <label className="mt-3 block text-sm font-medium">题目<AutoGrowingTextarea value={task.questionStem} onChange={(value) => updateTask(index, { questionStem: value })} placeholder="写出学生实际看到的题目" /></label>
                  <label className="mt-3 block text-sm font-medium">学生需要完成什么<AutoGrowingTextarea value={task.expectedStudentAction} onChange={(value) => updateTask(index, { expectedStudentAction: value })} placeholder="例如：找出人物的一个具体动作，并说明它表现了怎样的心理。" /></label>
                  <label className="mt-3 block text-sm font-medium">为什么设计这道题<AutoGrowingTextarea value={task.designReason} onChange={(value) => updateTask(index, { designReason: value })} placeholder="例如：检查学生能否建立“人物动作—心理判断”的关系。" /></label>
                  <details className="mt-4 pt-1">
                    <summary className="cursor-pointer text-sm font-normal text-blue-700">评分标准与答案示例</summary>
                    <div className="mt-4 space-y-4 px-4 sm:px-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium">具体训练点<input value={task.focusDisplayName} onChange={(event) => updateTask(index, { focusDisplayName: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" placeholder="例如：从动作推断人物心理" /></label>
                        <div>
                          <p className="text-sm font-medium">相关能力（可选）</p>
                          <div className="mt-1 flex min-h-10 flex-wrap gap-2">
                            {abilityOptions
                              .filter(([abilityId]) => abilityId !== task.abilityId)
                              .map(([abilityId, label]) => {
                                const selected = commaValues(task.supportingAbilityIdsText).includes(abilityId);
                                return (
                                  <button
                                    key={abilityId}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => toggleSupportingAbility(index, abilityId)}
                                    className={`min-h-9 rounded-md border px-3 text-xs font-normal transition ${selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-600'}`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                      <label className="block text-sm font-medium">训练点说明<textarea value={task.focusDefinition} onChange={(event) => updateTask(index, { focusDefinition: event.target.value })} rows={2} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-3 font-normal leading-6" placeholder="例如：学生能够引用具体动作，并说明动作与人物心理之间的关系。" /></label>
                      {['retest', 'transfer'].includes(task.taskRole) && <label className="block text-sm font-medium">关联训练组 ID<input value={task.comparisonGroupId} onChange={(event) => updateTask(index, { comparisonGroupId: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" placeholder="同一能力 Training / Retest / Transfer 共用" /></label>}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select label="评分方式" value={task.assessmentMode} options={assessmentModeOptions} onChange={(value) => updateTask(index, { assessmentMode: value })} />
                        <label className="block text-sm font-medium">最低字数<input type="number" min="1" value={task.minLength} onChange={(event) => updateTask(index, { minLength: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                        <Select label="题目类型" value={task.questionType} options={questionTypeOptions} onChange={(value) => updateTask(index, { questionType: value })} />
                        <Select label="作答形式" value={task.responseFormat} options={responseFormatOptions} onChange={(value) => updateTask(index, { responseFormat: value })} />
                      </div>
                      <label className="block text-sm font-medium">可接受要点（每行一项）<textarea value={task.acceptedKeywordsText} onChange={(event) => updateTask(index, { acceptedKeywordsText: event.target.value })} rows={3} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-3 font-normal leading-6" placeholder={'例如：\n母亲把伞推向孩子\n自己的肩膀被淋湿'} /></label>
                      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={task.semanticEquivalentAllowed} onChange={(event) => updateTask(index, { semanticEquivalentAllowed: event.target.checked })} />允许语义等价表达</label>
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">评分要点</p>
                          <button type="button" onClick={() => updateTask(index, { rubric: [...task.rubric, createRubricItem(task.abilityId, task.rubric.length)] })} className="text-sm font-semibold text-blue-700">增加评分项</button>
                        </div>
                        <div className="mt-2 space-y-3">
                          {task.rubric.map((item, rubricIndex) => (
                            <div key={item.localId} className="border-l-2 border-slate-200 pl-3">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input aria-label={`Rubric ${rubricIndex + 1} 名称`} value={item.name} onChange={(event) => updateTask(index, { rubric: updateArrayItem(task.rubric, rubricIndex, { name: event.target.value }) })} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" placeholder="例如：写出人物心理" />
                                <select aria-label={`Rubric ${rubricIndex + 1} 能力`} value={item.abilityId} onChange={(event) => updateTask(index, { rubric: updateArrayItem(task.rubric, rubricIndex, { abilityId: event.target.value }) })} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">{abilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                              </div>
                              <textarea aria-label={`Rubric ${rubricIndex + 1} 描述`} value={item.description} onChange={(event) => updateTask(index, { rubric: updateArrayItem(task.rubric, rubricIndex, { description: event.target.value }) })} rows={2} className="mt-2 w-full rounded-md border border-slate-300 bg-white p-3 text-sm leading-6" placeholder="学生需要完成什么" />
                              <input aria-label={`Rubric ${rubricIndex + 1} 可接受信号`} value={item.acceptedSignalsText} onChange={(event) => updateTask(index, { rubric: updateArrayItem(task.rubric, rubricIndex, { acceptedSignalsText: event.target.value }) })} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" placeholder="例如：担心、不舍、焦急（用逗号分隔）" />
                              {task.rubric.length > 1 && <button type="button" onClick={() => updateTask(index, { rubric: task.rubric.filter((_, itemIndex) => itemIndex !== rubricIndex) })} className="mt-2 text-xs font-semibold text-red-700">删除此项</button>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">答案示例（仅供审核，不影响学生记录）</p>
                        <div className="mt-2 space-y-3">
                          {task.calibrationCases.map((item, caseIndex) => (
                            <div key={item.localId} className="grid gap-2 sm:grid-cols-[140px_1fr]">
                              <select value={item.category} onChange={(event) => updateTask(index, { calibrationCases: updateArrayItem(task.calibrationCases, caseIndex, { category: event.target.value }) })} className="min-h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
                                <option value="fully_meets">完整有效</option>
                                <option value="partially_meets">部分完成</option>
                                <option value="typical_error">典型错误</option>
                                <option value="reasonable_alternative">合理异表述</option>
                                <option value="concise_valid">简短有效</option>
                                <option value="irrelevant">无关回答</option>
                              </select>
                              <textarea value={item.answerText} onChange={(event) => updateTask(index, { calibrationCases: updateArrayItem(task.calibrationCases, caseIndex, { answerText: event.target.value }) })} rows={2} className="rounded-md border border-slate-300 bg-white p-3 text-sm leading-6" placeholder="例如：父亲很担心孩子，因为他反复向门外张望。" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <button type="button" disabled={tasks.length >= 6} onClick={addTask} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40"><Plus size={16} />增加训练任务</button>
              <button type="button" disabled={busy || !selectedMaterial || Boolean(selectedPlan && !taskEditorDirty) || tasks.some((task) => !isTaskReady(task))} onClick={createPlan} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40"><ClipboardCheck size={16} />{selectedPlan ? '保存任务修改' : '保存训练任务'}</button>
            </div>
          </section>
        </div>

        <section className="mt-10 rounded-md bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {selectedPlan ? (
                <p className="flex flex-wrap items-center gap-2 text-sm font-normal text-slate-500">
                  <span>当前版本：第 {selectedPlan.revision} 版</span>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-normal ${statusBadgeClasses[selectedPlan.status] || statusBadgeClasses.superseded}`}>
                    {statusLabels[selectedPlan.status]}
                  </span>
                </p>
              ) : (
                <p className="text-sm font-normal text-slate-500">审核与发布</p>
              )}
              <h2 className="mt-3 text-lg font-semibold">确认训练任务并发布</h2>
              <p className="mt-2 max-w-[720px] text-sm leading-6 text-slate-600">保存训练任务后，可在这里检查题目和评分标准。审核通过的任务才能发布到正式学习系统。</p>
            </div>
            {materialPlans.length > 1 && (
              <select value={selectedPlan?.materialObservationPlanId || ''} onChange={(event) => setSelectedPlanId(event.target.value)} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                {materialPlans.map((plan) => <option key={plan.materialObservationPlanId} value={plan.materialObservationPlanId}>第 {plan.revision} 版 · {statusLabels[plan.status]}</option>)}
              </select>
            )}
          </div>

          {!selectedPlan ? (
            <p className="mt-5 text-sm text-slate-500">请先在上方保存训练任务。</p>
          ) : (
            <>
              <div className={`mt-5 grid gap-6 ${
                selectedPlan.status === 'pending_review'
                || (selectedPlan.status === 'reviewed' && planDrafts.length < selectedPlan.taskPlans.length)
                || planDrafts.length > 0
                  ? 'lg:grid-cols-[1fr_360px]'
                  : ''
              }`}>
                <div>
                  <div>
                    {taskEditorDirty && (
                      <p className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                        上方编辑区存在未保存修改，可能与这里的已保存版本不同。
                      </p>
                    )}
                    <div className={`${taskEditorDirty ? 'mt-4' : ''} divide-y divide-slate-200 border-y border-slate-200`}>
                      {selectedPlan.taskPlans.map((task, index) => (
                        <details key={task.observationTaskPlanId} className="group py-4">
                          <summary className="flex cursor-pointer list-none items-start gap-3">
                            <span className="min-w-0 flex-1 text-sm font-normal leading-6 text-slate-900">
                              {savedQuestionTitle(index)}：{task.observationGoal}
                            </span>
                            <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-normal text-emerald-700">
                                {abilityLabels[task.abilityId]}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-normal text-slate-600">
                                {roleLabels[task.taskRole]}
                              </span>
                            </span>
                            <ChevronDown size={17} className="mt-1 shrink-0 text-slate-400 transition group-open:rotate-180" />
                          </summary>
                          <div className="mt-4 border-l-2 border-slate-200 pl-4">
                            <p className="text-sm leading-6 text-slate-600">训练内容：{dimensionLabels[task.primaryDimension]} · {task.observationFocus?.displayName || '未命名训练点'} · 难度：{difficultyLabels[task.difficulty]}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">题目依据：{formatTaskAnchor(task, snapshot.anchors)}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">作答要求：{task.expectedStudentAction}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">设计说明：{task.designReason}</p>
                            {task.intendedComparisonGroupId && <p className="mt-1 text-sm leading-6 text-slate-500">关联训练组：{task.intendedComparisonGroupId}</p>}
                            {task.resourceDraftSpecification && (
                              <details className="mt-3">
                                <summary className="cursor-pointer text-sm font-normal text-blue-700">查看评分标准、作答范围与答案示例</summary>
                                <div className="mt-3 grid gap-4 border-l-2 border-slate-200 pl-4 text-sm leading-6 md:grid-cols-2">
                                  <PreviewField label="评分标准" value={task.resourceDraftSpecification.rubric.map((item) => `${item.name}：${item.description || item.acceptedSignals.join('、')}`).join('\n')} />
                                  <PreviewField label="可接受的作答范围" value={formatAnswerAcceptance(task.resourceDraftSpecification.answerAcceptance)} />
                                  <PreviewField label="相关能力" value={task.resourceDraftSpecification.supportingAbilityIds.map((ability) => abilityLabels[ability]).join('、') || '无'} />
                                  <PreviewField label="答案示例" value={(task.calibrationCases || []).map((item) => `${calibrationCategoryLabel(item.category)}：${item.answerText}`).join('\n') || '未配置'} />
                                </div>
                              </details>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
                {(selectedPlan.status === 'pending_review'
                  || (selectedPlan.status === 'reviewed' && planDrafts.length < selectedPlan.taskPlans.length)
                  || planDrafts.length > 0) && (
                  <div className="space-y-3">
                    {selectedPlan.status === 'pending_review' && <ActionButton onClick={approvePlan} disabled={busy} icon={ShieldCheck}>确认训练任务</ActionButton>}
                    {selectedPlan.status === 'reviewed' && planDrafts.length < selectedPlan.taskPlans.length && <ActionButton onClick={createDrafts} disabled={busy} icon={FilePlus2}>生成待审核题目</ActionButton>}
                    {planDrafts.length > 0 && <Link to="/question-resource-workbench" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"><ClipboardCheck size={16} />进入逐题审核与发布</Link>}
                    {planDrafts.length > 0 && <ActionButton onClick={syncLinks} disabled={busy} icon={Link2}>检查发布状态</ActionButton>}
                  </div>
                )}
              </div>
              {['draft', 'revision_required'].includes(selectedPlan.status) && (
                <>
                  {selectedValidation && !selectedValidation.passed && (
                    <IssueList title="提交前需要修复" issues={selectedValidation.issues} />
                  )}
                  <button
                    type="button"
                    onClick={submitPlan}
                    disabled={busy || !selectedValidation?.passed}
                    className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40"
                  >
                    <ArrowRight size={16} />
                    提交审核
                  </button>
                </>
              )}
              {planDraftReadiness.length > 0 && <DraftProductionChecklist items={planDraftReadiness} />}
            </>
          )}
        </section>
      </main>
      {toast && (
        <WorkspaceToast
          key={toast.id}
          message={toast.message}
          duration={3000}
          onDismiss={() => setToast((current) => current?.id === toast.id ? null : current)}
        />
      )}
      {discardDialogOpen && (
        <DiscardChangesDialog
          onCancel={cancelDiscardChanges}
          onConfirm={confirmDiscardChanges}
        />
      )}
    </div>
  );
}

function DiscardChangesDialog({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-task-edits-title"
        className="w-full max-w-md rounded-md bg-white p-6 shadow-xl"
      >
        <h2 id="discard-task-edits-title" className="text-lg font-semibold">放弃未保存的任务修改？</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          当前编辑区包含尚未生成计划的修改。切换素材后，这些本地修改将不会保留。
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">继续编辑</button>
          <button type="button" onClick={onConfirm} className="min-h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">放弃修改并切换</button>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function Select({ label, value, options, onChange }) {
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] || value;
  return (
    <label className="block text-sm font-medium">
      {label}
      <span className="relative mt-1 flex min-h-10 w-full items-center rounded-md border border-slate-300 bg-white px-2 pr-10 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
        <span className="pointer-events-none inline-flex max-w-full items-center rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-sm font-normal text-emerald-700">
          {selectedLabel}
        </span>
        <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-3 text-slate-500" />
        <select value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
          {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        </select>
      </span>
    </label>
  );
}

function AutoGrowingTextarea({ value, onChange, placeholder }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 min-h-10 w-full resize-none overflow-hidden rounded-md border border-slate-300 bg-white px-3 py-2 font-normal leading-6"
      placeholder={placeholder}
    />
  );
}

function ActionButton({ icon: Icon, children, ...props }) {
  return <button type="button" {...props} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"><Icon size={16} />{children}</button>;
}

function AssistedDraftWorkflow({ stage }) {
  const stages = [
    ['candidate', 'AI 生成训练任务', '已生成'],
    ['imported', '保存训练任务', '已保存'],
    ['observation_plan', '提交审核', '已提交'],
    ['question_review', '审核题目', '已审核'],
    ['frozen', '发布任务', '已发布'],
  ];
  if (stage === 'material') return null;
  const currentIndex = stages.findIndex(([value]) => value === stage);
  return (
    <div className="mt-4" aria-label="训练任务发布进度">
      <p className="text-xs font-semibold text-slate-500">发布进度</p>
      <ol className="mt-2 grid grid-cols-5 gap-1">
        {stages.map(([value, actionLabel, completedLabel], index) => {
          const reached = currentIndex >= 0 && index <= currentIndex;
          const current = value === stage;
          const completed = index < currentIndex || (current && value === 'frozen');
          const label = completed ? completedLabel : actionLabel;
          return (
            <li key={value} className={`min-w-0 border-t-2 pt-2 text-center text-xs font-semibold leading-4 ${reached ? 'border-emerald-600 text-emerald-800' : 'border-slate-200 text-slate-400'} ${current ? 'bg-emerald-50' : ''}`}>
              {index + 1}. {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function GeneratorCandidatePreview({ result, onImport }) {
  const providerFailed = result.status === 'provider_failed';
  const admittedCandidateCount = result.candidates.length + result.withheldCandidates.length;
  const totalCandidateCount = admittedCandidateCount + result.rejectedCandidates.length;
  const visibleLimitations = result.limitations.filter(
    (limitation) => !/^\d+ candidate\(s\) were rejected before import\.$/.test(limitation),
  );
  return (
    <div className="mt-5 border-l-4 border-slate-300 pl-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold">
          {result.status === 'candidates_ready'
            ? '已生成可导入的新训练任务'
            : providerFailed
              ? 'AI 服务调用未完成'
              : result.withheldCandidates.length > 0
                ? '本轮没有发现新的训练方向'
                : '候选暂不可导入'}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600" aria-label="本次生成统计">
          {[
            ['生成', result.coveragePreview.surfaceCandidateCount],
            ['可导入', result.coveragePreview.newObservationCount],
            ['替代题', result.coveragePreview.alternateQuestionCount],
            ['疑似重复', result.coveragePreview.likelyDuplicateCount],
            ['素材不支持', result.coveragePreview.unsupportedByMaterialCount],
          ].map(([label, value]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span>{label}</span>
              <span className={`inline-flex min-w-7 items-center justify-center rounded px-2 py-0.5 text-sm font-normal ${value > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {value}
              </span>
            </span>
          ))}
        </div>
      </div>
      {(result.validation.issues.length > 0 || result.rejectedCandidates.length > 0 || visibleLimitations.length > 0) && (
        <section className="mt-3 space-y-3" aria-label="生成校验结果">
          {!result.validation.passed && result.validation.issues.length > 0 && (
            <div className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
              <p className="font-semibold">{providerFailed ? '调用失败原因' : '整批校验结果'}</p>
              {providerFailed && (
                <p className="mt-1">
                  系统已自动尝试 {result.provider.attemptCount} 次，本次仍未获得训练任务。
                </p>
              )}
              <ul className="mt-1 space-y-1">
                {result.validation.issues.map((issue) => (
                  <li key={issue}>
                    - {issue === 'fewer_than_3_valid_independent_candidates'
                      ? `至少需要 3 个通过校验且彼此独立的新任务。本次共生成 ${totalCandidateCount} 个：${admittedCandidateCount} 个通过结构校验，其中 ${result.coveragePreview.independentObservationCount} 个属于独立新任务；${result.rejectedCandidates.length} 个被拒绝，因此暂不可导入。`
                      : generatorIssueLabel(issue)}
                  </li>
                ))}
              </ul>
              <p className="mt-2"><strong>下一步：</strong>{providerFailed ? providerFailureNextStep(result.validation.issues) : '系统已隔离不合格任务。请在下方查看具体原因，再点击上方“再次生成训练任务”。'}</p>
            </div>
          )}
          {result.rejectedCandidates.length > 0 && (
            <details className="border-l-2 border-amber-300 pl-3">
              <summary className="cursor-pointer text-xs font-semibold text-amber-800">查看 {result.rejectedCandidates.length} 道未通过任务</summary>
              <p className="mt-2 text-xs leading-5 text-amber-900">AI 生成的是待确认内容，可能出现段落或字段偏差。系统已在导入前隔离这些任务，不会写入正式资源。</p>
              <ol className="mt-2 space-y-2 text-xs leading-5 text-amber-950">
                {result.rejectedCandidates.map((candidate) => (
                  <li key={`${candidate.candidateIndex}-${candidate.issues.join('|')}`} className="border-l-2 border-amber-300 pl-3">
                    <strong>任务 {candidate.candidateIndex + 1}</strong>
                    <ul className="mt-1 space-y-2">
                      {candidate.issues.map((issue) => (
                        <li key={issue}>
                          <p>{generatorIssueLabel(issue)}</p>
                          {generatorIssueDetail(issue, candidate.diagnosticContext)}
                          <p className="mt-1 text-amber-900"><strong>操作：</strong>{generatorIssueAction(issue)}</p>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {visibleLimitations.length > 0 && (
            <details className="border-l-2 border-slate-300 pl-3 text-xs leading-5 text-slate-500">
              <summary className="cursor-pointer font-semibold text-slate-700">{providerFailed ? '查看安全处理结果' : '查看生成说明'}</summary>
              <ul className="mt-2 space-y-1">
                {visibleLimitations.map((limitation, index) => <li key={`${index}-${limitation}`}>- {generatorLimitationLabel(limitation)}</li>)}
              </ul>
            </details>
          )}
        </section>
      )}
      {(result.provider.repair?.attempted || result.coveragePreview.possibleDuplicatePairs.length > 0) && (
        <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
          {result.provider.repair?.attempted && (
            <p className={result.provider.repair.recoveredCandidateCount > 0 ? 'text-emerald-700' : 'text-amber-700'}>
              <strong>自动修复：</strong>
              已针对 {result.provider.repair.requestedCandidateCount} 个结构偏差候选修复一次，
              恢复（{result.provider.repair.recoveredCandidateCount}） · 仍未通过（{result.provider.repair.unresolvedCandidateCount}）
            </p>
          )}
          {result.coveragePreview.possibleDuplicatePairs.length > 0 && <p className="text-amber-700"><strong>重复检查：</strong>发现 {result.coveragePreview.possibleDuplicatePairs.length} 组疑似重复，已隔离且不会增加覆盖。</p>}
        </div>
      )}
      {result.candidates.length > 0 && (
        <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
          {result.candidates.map((candidate, index) => (
            <article key={candidate.candidateId} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="inline-flex rounded bg-emerald-50 px-2 py-1 text-xs font-normal text-emerald-700">待确认训练任务 {index + 1}</p>
                  <p className="text-sm font-normal text-slate-600">{candidate.observationFocus.displayName}</p>
                </div>
                <span className="text-xs font-normal text-slate-600">{abilityLabels[candidate.primaryAbilityId]} · {dimensionLabels[candidate.observationDimension]}</span>
              </div>
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-slate-500">生成的题目</p>
                  <p className="text-xs font-normal text-slate-500">题目依据：{formatCandidateAnchor(candidate.materialAnchor)}</p>
                </div>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-900">{candidate.questionStem}</p>
              </div>
              <div className="px-4">
                <p className="mt-1 text-sm leading-6 text-slate-600">作答要求：{formatExpectedStudentAction(candidate.expectedStudentAction)}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-normal text-blue-700">查看评分标准、可观察范围与答案示例</summary>
                  <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3 text-xs leading-5 text-slate-600">
                    <p><strong className="text-slate-800">训练点说明：</strong>{candidate.observationFocus.definition}</p>
                    <p><strong className="text-slate-800">评分标准：</strong>{candidate.rubricDraft.map((item) => `${item.name}：${item.description}`).join('；')}</p>
                    <p><strong className="text-slate-800">能够观察：</strong>{candidate.evidenceBoundary.canObserve}</p>
                    <p><strong className="text-slate-800">不能推断：</strong>{candidate.evidenceBoundary.cannotConclude}</p>
                    <p><strong className="text-slate-800">预计观察信息：</strong>{evidencePotentialLabel(candidate.evidencePotential)}，仅供审核参考</p>
                    <p><strong className="text-slate-800">答案示例：</strong>{candidate.calibrationAnswers.length} 类</p>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}
      {result.withheldCandidates.length > 0 && (
        <details className="mt-3 border-l-2 border-slate-300 pl-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">查看 {result.withheldCandidates.length} 个重复或替代任务</summary>
          <div className="mt-2 divide-y divide-slate-200 text-xs leading-5 text-slate-600">
            {result.withheldCandidates.map((candidate) => (
              <article key={candidate.candidateId} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-slate-800">{candidate.observationFocus.displayName}</strong>
                  <span className="font-semibold text-amber-700">{candidateDispositionLabel(candidate.inventoryRelation.disposition)}</span>
                </div>
                <p className="mt-1">{candidate.questionStem}</p>
                <p className="mt-1 text-slate-500">{candidate.inventoryRelation.reason}</p>
              </article>
            ))}
          </div>
        </details>
      )}
      <button type="button" onClick={onImport} disabled={result.status !== 'candidates_ready' || result.candidates.length === 0} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40"><ArrowRight size={16} />导入 {result.candidates.length} 条训练任务到编辑区</button>
    </div>
  );
}

function DraftProductionChecklist({ items }) {
  return (
    <section className="mt-8 border-t border-slate-200 pt-6" aria-labelledby="draft-production-title">
      <h3 id="draft-production-title" className="text-base font-semibold">题目生产检查</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">逐题确认内容、校验与正式化状态。这里不代替人工审核，也不会自动 Freeze。</p>
      <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
        {items.map(({ draft, readiness }, index) => {
          const validation = readiness?.validation;
          const review = readiness?.review;
          const frozen = readiness?.frozenVersion;
          const linked = readiness?.observationLink?.status === 'active';
          return (
            <article key={draft.draftId} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{index + 1}. {draft.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{abilityLabels[draft.abilityMetadata.abilityId]} · {roleLabels[draft.abilityMetadata.taskRole]} · {difficultyLabels[draft.abilityMetadata.difficulty]}</p>
                </div>
                <p className={`text-sm font-semibold ${linked ? 'text-emerald-700' : validation?.passed ? 'text-blue-700' : 'text-amber-700'}`}>
                  {linked
                    ? '已 Freeze 并关联'
                    : frozen
                      ? '已 Freeze，待关联'
                      : review?.action === 'approve'
                        ? '审核通过，待 Freeze'
                        : review?.action === 'revision_required'
                          ? '审核要求修订'
                          : draft.status === 'pending_review'
                            ? '等待逐题审核'
                            : validation?.passed
                              ? '校验通过，待逐题审核'
                              : draftStatusLabels[draft.status] || '需要修复'}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-800">{draft.questionStem}</p>
              {!validation && <p className="mt-3 text-sm text-amber-700">尚未找到结构校验结果，请重新生成或进入逐题审核工作台检查。</p>}
              {validation && !validation.passed && <IssueList title="需要修复的字段" issues={validation.issues} compact />}
              {validation?.passed && !frozen && <p className="mt-3 text-sm text-slate-600">结构校验已通过；Rubric、可接受答案和题目质量仍需逐题人工确认。</p>}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-blue-700">预览题目、Rubric 与可接受答案</summary>
                <div className="mt-3 grid gap-4 border-l-2 border-slate-200 pl-4 text-sm leading-6 md:grid-cols-2">
                  <PreviewField label="Rubric" value={draft.rubric.map((item) => `${item.name}：${item.description || item.acceptedSignals.join('、')}`).join('\n')} />
                  <PreviewField label="Answer Acceptance" value={formatAnswerAcceptance(draft.answerAcceptance)} />
                  <PreviewField label="最低作答要求" value={`不少于 ${draft.minimumAnswerRequirement.minLength} 字；${draft.minimumAnswerRequirement.requireTextEvidence ? '需要素材依据' : '不强制素材依据'}；${draft.minimumAnswerRequirement.requireExplanation ? '需要解释' : '不强制解释'}`} />
                  <PreviewField label="正式化状态" value={frozen ? `已生成正式版本 ${frozen.versionNumber}` : '尚未 Freeze；请在逐题审核工作台完成确认'} />
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function IssueList({ title, issues, compact = false }) {
  return (
    <div className={`${compact ? 'mt-3' : 'mt-4'} border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950`}>
      <p className="font-semibold">{title}</p>
      <ol className="mt-2 space-y-1">
        {issues.map((issue, index) => (
          <li key={`${issue.code || issue.field || 'issue'}-${index}`}>{index + 1}. {issue.field ? `${issue.field}：` : ''}{issue.message || issue.code || String(issue)}</li>
        ))}
      </ol>
    </div>
  );
}

function PreviewField({ label, value }) {
  return <div><p className="font-semibold text-slate-800">{label}</p><p className="mt-1 whitespace-pre-line text-slate-600">{value}</p></div>;
}

function formatAnswerAcceptance(value) {
  if (!value) return '尚未设置；必须在逐题审核中补充。';
  const parts = [];
  if (value.acceptedAnswers?.length) parts.push(`可接受答案：${value.acceptedAnswers.join('；')}`);
  if (value.acceptedKeywords?.length) parts.push(`可接受要点：${value.acceptedKeywords.join('、')}`);
  if (value.semanticEquivalentAllowed) parts.push('允许语义等价表达');
  return parts.length ? parts.join('\n') : '已创建结构，但仍需人工确认具体接受边界。';
}

function createInitialTasks() { return [createTask(0), createTask(1), createTask(2)]; }
function createTask(index) {
  const presets = [
    { primaryDimension: 'fact', abilityId: 'extraction', focusDisplayName: '关键信息提取', focusDefinition: '准确找到与题目直接相关的显性事实。', questionStem: '', expectedStudentAction: '从素材中提取与题目直接相关的事实。' },
    { primaryDimension: 'character', abilityId: 'inference', focusDisplayName: '人物心理推断', focusDefinition: '依据人物动作或语言形成克制的心理推断。', questionStem: '', expectedStudentAction: '根据人物动作或语言推断其心理，并说明依据。' },
    { primaryDimension: 'theme', abilityId: 'comprehension', focusDisplayName: '情感与态度理解', focusDefinition: '结合全文内容理解作者表达的情感或态度。', questionStem: '', expectedStudentAction: '结合全文内容理解作者表达的情感或态度。' },
  ];
  const preset = presets[index] || presets[0];
  return {
    localId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    ...preset,
    taskRole: 'training', difficulty: 'intermediate', anchorType: 'paragraph', startParagraph: 1, endParagraph: 1,
    sourceType: 'manual',
    supportingAbilityIdsText: '',
    comparisonGroupId: '',
    assessmentMode: preset.abilityId === 'extraction' ? 'key_points' : 'reasoning_chain',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    acceptedKeywordsText: '',
    semanticEquivalentAllowed: true,
    minLength: preset.abilityId === 'extraction' ? 6 : 12,
    rubric: [createRubricItem(preset.abilityId, 0)],
    calibrationCases: createCalibrationCases(),
    designReason: '该任务用于观察学生能否完成对应的素材处理动作。',
  };
}

function createRubricItem(abilityId, index) {
  return {
    localId: `rubric-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name: index === 0 ? '主要能力动作' : '',
    abilityId,
    description: actionForAbility(abilityId),
    acceptedSignalsText: '',
  };
}

function createCalibrationCases() {
  return [
    { localId: `calibration-${Date.now()}-full`, category: 'fully_meets', answerText: '' },
    { localId: `calibration-${Date.now()}-partial`, category: 'partially_meets', answerText: '' },
    { localId: `calibration-${Date.now()}-error`, category: 'typical_error', answerText: '' },
  ];
}

function planTaskToEditableTask(task, index, anchors) {
  const specification = task.resourceDraftSpecification;
  const anchor = anchors.find((item) => task.sourceAnchorIds.includes(item.sourceAnchorId));
  const rubric = specification?.rubric?.length
    ? specification.rubric.map((item, rubricIndex) => ({
      localId: `${task.observationTaskPlanId}-${item.itemId || rubricIndex}`,
      name: item.name,
      abilityId: item.abilityId,
      description: item.description || '',
      acceptedSignalsText: (item.acceptedSignals || []).join('，'),
    }))
    : [createRubricItem(task.abilityId, 0)];
  const calibrationCases = task.calibrationCases?.length
    ? task.calibrationCases.map((item) => ({
      localId: item.calibrationCaseId,
      category: item.category,
      answerText: item.answerText,
    }))
    : createCalibrationCases();
  const acceptedKeywords = [
    ...(specification?.answerAcceptance?.acceptedKeywords || []),
    ...(specification?.answerAcceptance?.acceptedAnswers || []),
  ];
  return {
    localId: task.observationTaskPlanId || `plan-task-${index}`,
    sourceType: specification?.tags?.includes('ai-assisted') ? 'ai_assisted' : 'manual',
    primaryDimension: task.primaryDimension,
    abilityId: task.abilityId,
    focusDisplayName: task.observationFocus?.displayName || `${dimensionLabels[task.primaryDimension]}观测`,
    focusDefinition: task.observationFocus?.definition || task.observationGoal,
    questionStem: task.observationGoal,
    expectedStudentAction: task.expectedStudentAction,
    designReason: task.designReason,
    taskRole: task.taskRole,
    difficulty: task.difficulty,
    anchorType: anchor?.anchorType || 'paragraph',
    startParagraph: anchor?.startParagraph || 1,
    endParagraph: anchor?.endParagraph || anchor?.startParagraph || 1,
    supportingAbilityIdsText: (specification?.supportingAbilityIds || []).join(', '),
    comparisonGroupId: task.intendedComparisonGroupId || '',
    assessmentMode: specification?.assessmentMode || (task.abilityId === 'extraction' ? 'key_points' : 'reasoning_chain'),
    questionType: specification?.questionType || 'reading_comprehension',
    responseFormat: specification?.responseFormat || 'long_text',
    acceptedKeywordsText: acceptedKeywords.join('\n'),
    semanticEquivalentAllowed: specification?.answerAcceptance?.semanticEquivalentAllowed !== false,
    minLength: specification?.minimumAnswerRequirement?.minLength || (task.abilityId === 'extraction' ? 6 : 12),
    rubric,
    calibrationCases,
  };
}

function generatorCandidateToEditableTask(candidate, index) {
  return {
    localId: candidate.candidateId,
    sourceType: 'ai_assisted',
    primaryDimension: candidate.observationDimension,
    abilityId: candidate.primaryAbilityId,
    focusDisplayName: candidate.observationFocus.displayName,
    focusDefinition: candidate.observationFocus.definition,
    questionStem: candidate.questionStem,
    expectedStudentAction: candidate.expectedStudentAction,
    designReason: candidate.designRationale,
    taskRole: 'training',
    difficulty: candidate.difficultySuggestion,
    anchorType: candidate.materialAnchor.anchorType,
    startParagraph: candidate.materialAnchor.startParagraph || 1,
    endParagraph: candidate.materialAnchor.endParagraph || candidate.materialAnchor.startParagraph || 1,
    supportingAbilityIdsText: candidate.supportingAbilityIds.join(', '),
    comparisonGroupId: '',
    assessmentMode: candidate.assessmentMode,
    questionType: candidate.questionDraft.questionType,
    responseFormat: candidate.questionDraft.responseFormat,
    acceptedKeywordsText: candidate.answerAcceptanceDraft.acceptedKeywords.join('\n'),
    semanticEquivalentAllowed: candidate.answerAcceptanceDraft.semanticEquivalentAllowed,
    minLength: candidate.minimumAnswerRequirement.minLength,
    rubric: candidate.rubricDraft.map((item, rubricIndex) => ({
      localId: `${candidate.candidateId}-rubric-${rubricIndex}`,
      name: item.name,
      abilityId: item.abilityId,
      description: item.description,
      acceptedSignalsText: item.acceptedSignals.join('，'),
    })),
    calibrationCases: candidate.calibrationAnswers.map((item, caseIndex) => ({
      localId: `${candidate.candidateId}-calibration-${caseIndex}`,
      category: item.category,
      answerText: item.answerText,
    })),
  };
}

function buildGeneratorInventory({
  materialVersionId,
  plans,
  drafts,
  tasks,
  includeEditableTasks,
  previousCandidates,
}) {
  if (!materialVersionId) return { observations: [], questions: [] };

  const observations = [];
  const questions = [];
  const taskById = new Map();

  plans.forEach((plan) => {
    plan.taskPlans.forEach((task) => {
      taskById.set(task.observationTaskPlanId, task);
      observations.push({
        observationId: task.observationTaskPlanId,
        primaryAbilityId: task.abilityId,
        observationDimension: task.primaryDimension,
        focusDisplayName: task.observationFocus?.displayName || task.observationGoal,
        focusDefinition: task.observationFocus?.definition || task.designReason,
        expectedStudentAction: task.expectedStudentAction,
      });
      questions.push({
        questionId: `${task.observationTaskPlanId}:question`,
        questionStem: task.observationGoal,
        observationId: task.observationTaskPlanId,
        primaryAbilityId: task.abilityId,
        observationDimension: task.primaryDimension,
      });
    });
  });

  drafts
    .filter((draft) => draft.materialVersionId === materialVersionId)
    .forEach((draft) => {
      const taskId = draft.tags.find((tag) => tag.startsWith('observation_task:'))?.slice('observation_task:'.length);
      const task = taskId ? taskById.get(taskId) : null;
      if (!task) return;
      questions.push({
        questionId: draft.draftId,
        questionStem: draft.questionStem,
        observationId: task.observationTaskPlanId,
        primaryAbilityId: task.abilityId,
        observationDimension: task.primaryDimension,
      });
    });

  if (includeEditableTasks) {
    tasks.forEach((task, index) => {
      const observationId = `editable:${task.localId || index}`;
      observations.push({
        observationId,
        primaryAbilityId: task.abilityId,
        observationDimension: task.primaryDimension,
        focusDisplayName: task.focusDisplayName,
        focusDefinition: task.focusDefinition,
        expectedStudentAction: task.expectedStudentAction,
      });
      questions.push({
        questionId: `${observationId}:question`,
        questionStem: task.questionStem,
        observationId,
        primaryAbilityId: task.abilityId,
        observationDimension: task.primaryDimension,
      });
    });
  }

  previousCandidates.forEach((candidate) => {
    observations.push({
      observationId: candidate.candidateId,
      primaryAbilityId: candidate.primaryAbilityId,
      observationDimension: candidate.observationDimension,
      focusDisplayName: candidate.observationFocus.displayName,
      focusDefinition: candidate.observationFocus.definition,
      expectedStudentAction: candidate.expectedStudentAction,
    });
    questions.push({
      questionId: `${candidate.candidateId}:question`,
      questionStem: candidate.questionStem,
      observationId: candidate.candidateId,
      primaryAbilityId: candidate.primaryAbilityId,
      observationDimension: candidate.observationDimension,
    });
  });

  return {
    observations: dedupeInventory(observations, (item) => (
      `${item.primaryAbilityId}|${item.observationDimension}|${normalizeInventoryText(item.focusDisplayName)}|${normalizeInventoryText(item.focusDefinition)}`
    )).slice(0, 40),
    questions: dedupeInventory(questions, (item) => (
      `${item.primaryAbilityId}|${item.observationDimension}|${normalizeInventoryText(item.questionStem)}`
    )).slice(0, 60),
  };
}

function dedupeInventory(values, keyFor) {
  const seen = new Set();
  return values.filter((item) => {
    const key = keyFor(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeInventoryText(value) {
  return String(value || '').toLowerCase().replace(/[\s，。；：、“”‘’！？,.!?;:'"()[\]{}<>《》·—-]/g, '');
}

function candidateDispositionLabel(disposition) {
  return ({
    new_observation_candidate: '新 Observation',
    alternate_question_for_existing_observation: '既有 Observation 的替代问法',
    likely_duplicate: '疑似重复',
    unsupported_by_material: '素材不支持',
  })[disposition] || disposition;
}

function actionForAbility(abilityId) {
  return ({
    extraction: '从素材中提取与题目直接相关的事实。', comprehension: '结合语境说明素材内容的含义。',
    summarization: '整合素材信息并形成简洁概括。', analysis: '建立素材依据与分析结论之间的关系。',
    inference: '根据素材线索形成合理推断并说明依据。', expression: '组织观点、素材依据和清楚表达。',
  })[abilityId];
}
function toTaskInput(task) {
  const supportingAbilityIds = commaValues(task.supportingAbilityIdsText)
    .filter((abilityId) => abilityId !== task.abilityId && abilityOptions.some(([value]) => value === abilityId));
  const calibrationCases = task.calibrationCases
    .filter((item) => item.answerText.trim())
    .map((item, index) => ({
      calibrationCaseId: `${task.primaryDimension}-${task.abilityId}-${index + 1}-${item.category}`,
      category: item.category,
      answerText: item.answerText.trim(),
      expectedAnswerStatus: expectedStatusForCalibration(item.category),
      reviewNote: calibrationReviewNote(item.category),
    }));
  return {
    primaryDimension: task.primaryDimension,
    observationFocus: {
      focusCode: `${task.primaryDimension}-${task.abilityId}-${task.focusDisplayName.trim()}`,
      displayName: task.focusDisplayName.trim(),
      definition: task.focusDefinition.trim(),
      scope: 'plan_local',
    },
    abilityId: task.abilityId,
    taskRole: task.taskRole,
    difficulty: task.difficulty,
    anchorType: task.anchorType,
    startParagraph: task.anchorType === 'full_text' ? undefined : task.startParagraph,
    endParagraph: task.anchorType === 'paragraph_range' ? task.endParagraph : undefined,
    questionStem: task.questionStem,
    expectedStudentAction: task.expectedStudentAction, designReason: task.designReason,
    intendedComparisonGroupId: ['retest', 'transfer'].includes(task.taskRole) ? task.comparisonGroupId.trim() : undefined,
    materialRelationIntent: task.taskRole === 'transfer' ? 'new_context' : task.taskRole === 'retest' ? 'similar_context' : 'same_context',
    resourceDraftSpecification: {
      title: `${abilityLabels[task.abilityId]} · ${task.focusDisplayName.trim()}`,
      questionType: task.questionType,
      responseFormat: task.responseFormat,
      assessmentMode: task.assessmentMode,
      answerAcceptance: {
        acceptedKeywords: lineValues(task.acceptedKeywordsText),
        semanticEquivalentAllowed: task.semanticEquivalentAllowed,
        normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
      },
      rubric: task.rubric.map((item, index) => ({
        itemId: `rubric-${index + 1}`,
        name: item.name.trim(),
        description: item.description.trim(),
        abilityId: item.abilityId,
        importance: 'critical',
        required: true,
        evidenceRequirement: {
          requireTextEvidence: true,
          requireExplanation: item.abilityId !== 'extraction',
          requireConclusion: item.abilityId !== 'extraction',
        },
        acceptedSignals: commaValues(item.acceptedSignalsText).length
          ? commaValues(item.acceptedSignalsText)
          : [item.description.trim()],
      })),
      minimumAnswerRequirement: {
        minLength: task.minLength,
        requireTextEvidence: true,
        requireExplanation: task.abilityId !== 'extraction',
      },
      supportingAbilityIds,
      prerequisiteAbilityIds: [],
      gradeRange: '七至九年级',
      tags: ['phase17.2', task.sourceType === 'ai_assisted' ? 'ai-assisted' : 'manual-production', task.abilityId],
    },
    calibrationCases,
  };
}

function isTaskReady(task) {
  const baseReady = task.questionStem.trim()
    && task.expectedStudentAction.trim()
    && task.designReason.trim()
    && task.focusDisplayName.trim()
    && task.focusDefinition.trim()
    && task.rubric.length > 0
    && task.rubric.every((item) => item.name.trim() && item.description.trim());
  const anchorReady = task.anchorType === 'full_text'
    || (task.anchorType === 'paragraph' && task.startParagraph >= 1)
    || (task.anchorType === 'paragraph_range' && task.startParagraph >= 1 && task.endParagraph >= task.startParagraph);
  const chainReady = !['retest', 'transfer'].includes(task.taskRole) || task.comparisonGroupId.trim();
  return Boolean(baseReady && anchorReady && chainReady);
}

function updateArrayItem(values, index, patch) {
  return values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
}

function commaValues(value) {
  return [...new Set(value.split(/[,，]/).map((item) => item.trim()).filter(Boolean))];
}

function lineValues(value) {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}

function expectedStatusForCalibration(category) {
  if (['fully_meets', 'reasonable_alternative', 'concise_valid'].includes(category)) return 'fully_meets';
  if (category === 'partially_meets') return 'partially_meets';
  if (category === 'irrelevant') return 'insufficient_evidence';
  return 'does_not_meet';
}

function calibrationReviewNote(category) {
  return ({
    fully_meets: '应满足主要 Rubric。',
    partially_meets: '应保留已完成部分并指出唯一主要缺口。',
    typical_error: '应识别本次作答中的可观察错误。',
    reasonable_alternative: '不得因未命中参考措辞而降级。',
    concise_valid: '不得仅因答案简短而降级。',
    irrelevant: '不得形成能力结论。',
  })[category];
}

function calibrationCategoryLabel(category) {
  return ({
    fully_meets: '完整有效',
    partially_meets: '部分完成',
    typical_error: '典型错误',
    reasonable_alternative: '合理异表述',
    concise_valid: '简短有效',
    irrelevant: '无关回答',
  })[category] || category;
}

function formatTaskAnchor(task, anchors) {
  const anchor = anchors.find((item) => task.sourceAnchorIds.includes(item.sourceAnchorId));
  if (!anchor) return '未找到正式素材锚点';
  if (anchor.anchorType === 'full_text') return '全文';
  if (anchor.anchorType === 'paragraph_range') return `第 ${anchor.startParagraph}–${anchor.endParagraph} 段`;
  return `第 ${anchor.startParagraph} 段`;
}
function formatCandidateAnchor(anchor) {
  if (anchor.anchorType === 'full_text') return '全文';
  if (anchor.anchorType === 'paragraph_range') return `第 ${anchor.startParagraph}–${anchor.endParagraph} 段`;
  return `第 ${anchor.startParagraph} 段`;
}
function evidencePotentialLabel(value) {
  return ({ weak: '弱', moderate: '中', strong: '强' })[value] || value;
}
function generatorIssueDetail(issue, context) {
  if (issue === 'material_anchor_out_of_range') {
    const paragraphCount = context?.materialParagraphCount;
    const actual = formatRejectedAnchor(context?.materialAnchor);
    const allowed = paragraphCount > 0
      ? `第 1–${paragraphCount} 段、其中任一单段，或全文`
      : '当前素材中的有效段落或全文';
    return (
      <p className="mt-1 text-amber-800">
        实际填写：{actual}。允许范围：{allowed}。
      </p>
    );
  }
  if (issue === 'material_anchor_type_invalid') {
    return (
      <p className="mt-1 text-amber-800">
        实际填写：{context?.materialAnchor?.anchorType || '未提供'}。允许范围：单段、段落范围、全文。
      </p>
    );
  }
  if (issue === 'question_type_invalid') {
    return (
      <p className="mt-1 text-amber-800">
        实际填写：{questionTypeDisplay(context?.questionType)}。允许范围：{questionTypeOptions.map(([, label]) => label).join('、')}。
      </p>
    );
  }
  if (issue === 'response_format_invalid') {
    return (
      <p className="mt-1 text-amber-800">
        实际填写：{responseFormatDisplay(context?.responseFormat)}。允许范围：{responseFormatOptions.map(([, label]) => label).join('、')}。
      </p>
    );
  }
  return null;
}
function generatorIssueAction(issue) {
  if (issue === 'material_anchor_out_of_range') {
    return '先检查素材是否按自然段正确分段；确认后点击上方“再次生成训练任务”。该候选不会被导入。';
  }
  if (issue === 'material_anchor_type_invalid') {
    return '点击上方“再次生成训练任务”，系统会重新按单段、段落范围或全文生成。';
  }
  if (issue === 'question_type_invalid' || issue === 'response_format_invalid') {
    return '点击上方“再次生成训练任务”，系统会重新按当前支持的题型和作答形式生成。';
  }
  return '点击上方“再次生成训练任务”；若连续失败，可将任务数量调整为 3，并选择更明确的训练方向后重试。';
}
function formatRejectedAnchor(anchor) {
  if (!anchor) return '未提供';
  if (anchor.anchorType === 'full_text') return '全文';
  if (anchor.anchorType === 'paragraph') {
    return anchor.startParagraph ? `第 ${anchor.startParagraph} 段` : '单段，但未提供有效段落号';
  }
  if (anchor.anchorType === 'paragraph_range') {
    const start = anchor.startParagraph ?? '未提供';
    const end = anchor.endParagraph ?? '未提供';
    return `第 ${start}–${end} 段`;
  }
  return anchor.anchorType || '未提供';
}
function formatExpectedStudentAction(value) {
  return String(value || '').replace(/^(学生需要|学生应当|学生应|学生须)\s*/, '');
}
function questionTypeDisplay(value) {
  return questionTypeOptions.find(([id]) => id === value)?.[1] || value || '未提供';
}
function responseFormatDisplay(value) {
  return responseFormatOptions.find(([id]) => id === value)?.[1] || value || '未提供';
}
function generatorIssueLabel(issue) {
  const exact = {
    provider_timeout: '模型在规定时间内没有完成生成。可以直接重试；若持续出现，可将候选数量改为 3。',
    provider_network_error: '连接模型服务时发生网络错误，请稍后重试。',
    provider_rate_limit: '模型服务当前请求较多，请稍后重试。',
    provider_insufficient_balance: 'AI 服务账户余额不足，本次请求未执行。',
    provider_authentication_failed: '模型服务凭据未通过验证，需要检查服务配置。',
    provider_authentication_error: '模型服务凭据未通过验证，需要检查服务配置。',
    provider_provider_unavailable: '模型服务暂时不可用，请稍后重试。',
    provider_malformed_output: '模型没有返回可用内容，请重试。',
    provider_unknown: '模型服务拒绝了本次请求，需要检查服务配置或模型名称。',
    provider_failed: '模型服务本次调用失败，尚未产生任何候选。',
    provider_output_not_valid_json: '模型输出不是完整的结构化 JSON，无法进入候选校验。',
    candidate_count_must_be_3_to_6: '模型没有返回 3–6 个表面候选。',
    fewer_than_3_valid_independent_candidates: '通过校验且彼此独立的候选不足 3 个。',
    no_new_observation_candidate: '本轮候选均与已有 Observation 重合，没有发现可增加覆盖的新观测。',
    candidate_not_object: '候选不是合法结构',
    question_stem_missing: '缺少题目入口',
    question_draft_missing: '缺少题型或作答形式',
    question_type_invalid: '题目类型不在允许范围',
    response_format_invalid: '作答形式不在允许范围',
    primary_ability_invalid: 'Primary Ability 缺失或不合法',
    observation_dimension_invalid: 'Material Dimension 缺失或不合法',
    difficulty_invalid: '难度建议不合法',
    assessment_mode_invalid: '评价模式不合法',
    expected_student_action_missing: '缺少预期学生动作',
    design_rationale_missing: '缺少设计理由',
    observation_focus_missing: '缺少 Observation Focus',
    observation_focus_name_missing: '缺少 Observation Focus 名称',
    observation_focus_definition_missing: '缺少 Observation Focus 定义',
    material_anchor_missing: '缺少素材范围',
    material_anchor_type_invalid: '素材范围类型不合法',
    material_anchor_out_of_range: '引用的素材段落超出当前素材范围',
    supporting_ability_duplicates_primary: '辅助能力与 Primary Ability 重复',
    rubric_missing: '缺少 Rubric',
    answer_acceptance_missing: '缺少 Answer Acceptance',
    answer_acceptance_keywords_missing: 'Answer Acceptance 缺少可接受语义要点',
    semantic_equivalent_must_be_allowed: '未允许合理异表述',
    minimum_answer_requirement_missing: '缺少最低作答要求',
    minimum_answer_length_invalid: '最低字数不合法',
    minimum_answer_flags_invalid: '最低作答条件不完整',
    calibration_answers_missing: '缺少校准答案',
    evidence_potential_invalid: 'Evidence Potential 不合法',
    evidence_boundary_missing: '缺少 Evidence Boundary',
    evidence_boundary_can_observe_missing: '缺少“能够观察什么”',
    evidence_boundary_cannot_conclude_missing: '缺少“不能据此得出什么结论”',
    evidence_boundary_cannot_conclude_not_explicit: '证据边界没有明确禁止过度推断',
    safety_boundary_invalid: '候选越过 Training Candidate 或人工审核边界',
    observation_candidate_duplicate: '与另一候选观察同一认知动作，已作为重复项隔离',
  };
  if (exact[issue]) return exact[issue];
  if (issue.startsWith('prohibited_formal_fields:')) return '候选包含不应由 AI 直接生成的正式发布信息，已被阻断。';
  if (issue.startsWith('calibration_category_missing:')) return `缺少校准答案类型：${calibrationCategoryLabel(issue.split(':')[1])}`;
  if (/^rubric_\d+_ability_undeclared$/.test(issue)) return '评分标准使用了当前任务未声明的训练能力，暂不能导入。';
  if (/^rubric_\d+_/.test(issue)) return '评分标准存在缺失或不一致，暂不能导入。';
  if (/^calibration_\d+_/.test(issue)) return '答案示例存在缺失或不一致，暂不能导入。';
  return '候选内容未通过导入校验，已被安全阻断。';
}
function providerFailureNextStep(issues) {
  if (issues.includes('provider_insufficient_balance')) {
    return '请先检查并补充 AI 服务账户余额，确认账户可用后再点击“再次生成训练任务”。';
  }
  if (issues.includes('provider_authentication_failed') || issues.includes('provider_authentication_error')) {
    return '请检查 AI 服务凭据配置，确认凭据有效后再生成。';
  }
  if (issues.includes('provider_unknown')) {
    return '请检查当前模型名称和 AI 服务配置；确认无误后再生成。';
  }
  return '请稍后点击“再次生成训练任务”；若持续失败，再检查 AI 服务状态。';
}
function generatorLimitationLabel(limitation) {
  const translated = {
    'Candidates are AI-assisted drafts and require human educational review.': '候选为 AI 辅助首稿，必须经过人工教育审核。',
    'Evidence potential is not actual Evidence quality.': '预计观察信息仅供审核参考，不代表学生实际作答产生的证据质量。',
    'Provider output could not be converted into isolated candidates.': 'Provider 输出无法转换为可隔离校验的候选。',
    'Provider failed before any candidate was admitted.': '模型服务在产生候选前调用失败；本次没有候选进入校验或正式数据。',
    'Provider retry budget was exhausted.': '模型服务已达到本次受控重试上限；没有写入任何正式数据。',
    'Provider identity does not match the configured generator.': '模型服务身份与当前生成器配置不一致。',
    'Only new observation candidates are importable in discover_new_observation mode.': '当前只执行“发现新 Observation”；替代问法和疑似重复项不会导入。',
    'Candidate repair output was invalid JSON; previously admitted candidates were preserved.': '自动修复结果格式无效；第一轮已通过的候选仍被保留。',
    'Candidate repair call failed; previously admitted candidates were preserved.': '自动修复调用未完成；第一轮已通过的候选仍被保留。',
  };
  const rejectedMatch = limitation.match(/^(\d+) candidate\(s\) were rejected before import\.$/);
  if (rejectedMatch) return `${rejectedMatch[1]} 个候选在导入前被结构校验拒绝。`;
  const withheldMatch = limitation.match(/^(\d+) candidate\(s\) matched existing or same-batch observations and were withheld from import\.$/);
  if (withheldMatch) return `${withheldMatch[1]} 个候选与已有或本批次 Observation 重合，已保留供查看但不会导入。`;
  const repairedMatch = limitation.match(/^Candidate-level repair recovered (\d+) of (\d+) structurally rejected candidate\(s\)\.$/);
  if (repairedMatch) return `系统已自动修复 ${repairedMatch[2]} 个结构偏差候选中的 ${repairedMatch[1]} 个。`;
  return translated[limitation] || limitation;
}
function createGeneratorRequestId(materialVersionId) {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 12)
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `material-observation-generator-${materialVersionId}-${suffix}`;
}
function taskEditorTitle(index) {
  const labels = ['一', '二', '三', '四', '五', '六'];
  return `训练任务${labels[index] || index + 1} · 编辑区`;
}
function savedQuestionTitle(index) {
  const labels = ['一', '二', '三', '四', '五', '六'];
  return `题目${labels[index] || index + 1}`;
}
function splitParagraphs(content) { return content.replace(/\r\n/g, '\n').trim().split(/\n\s*\n|\n/).map((value) => value.trim()).filter(Boolean); }
function errorNotice(error) { return { type: 'error', message: error instanceof Error ? error.message : String(error) }; }
const emptySnapshot = { materials: [], anchors: [], plans: [], validations: [], drafts: [], frozenVersions: [], links: [], draftReadiness: [] };
