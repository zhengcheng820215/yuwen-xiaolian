import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import {
  clearQuestionResourceWorkbench,
  createQuestionResourceWorkbenchNextVersion,
  createQuestionResourceWorkbenchRejectedRevision,
  createWorkbenchMaterial,
  decideQuestionResourceWorkbenchReview,
  freezeQuestionResourceWorkbenchDraft,
  getQuestionResourceWorkbenchContext,
  getQuestionResourceWorkbenchSnapshot,
  saveQuestionResourceWorkbenchDraft,
  submitQuestionResourceWorkbenchReview,
  validateQuestionResourceWorkbenchDraft,
} from '../api/questionResourceWorkbench';

const abilityOptions = [
  ['extraction', '信息提取'],
  ['comprehension', '理解'],
  ['summarization', '概括'],
  ['analysis', '分析'],
  ['inference', '推理'],
  ['expression', '表达'],
];

const taskRoleOptions = [
  ['training', '训练'],
  ['retest', '复测'],
  ['transfer', '迁移'],
  ['diagnosis', '诊断'],
  ['observation', '观察'],
];

const questionTypeOptions = [
  ['multiple_choice', '选择题'],
  ['true_false', '判断题'],
  ['fill_blank', '填空题'],
  ['open_short_answer', '开放简答题'],
  ['reading_comprehension', '阅读理解题'],
];

const responseFormatOptions = [
  ['single_choice', '单选'],
  ['boolean', '判断'],
  ['short_text', '短文本'],
  ['long_text', '长文本'],
];

const difficultyOptions = [
  ['basic', '基础'],
  ['intermediate', '中等'],
  ['advanced', '进阶'],
];

const assessmentModeOptions = [
  ['exact_match', '严格答案匹配'],
  ['key_points', '关键点'],
  ['reasoning_chain', '推理链'],
  ['expression_quality', '表达质量'],
  ['process_operation', '过程操作'],
];

const rubricImportanceOptions = [
  ['critical', '关键'],
  ['important', '重要'],
  ['supporting', '辅助'],
];

const sourceTypeOptions = [
  ['manual', '人工'],
  ['imported', '导入'],
  ['ai_assisted', 'AI 辅助'],
  ['ocr_assisted', 'OCR 辅助'],
];

const statusLabels = {
  drafted: '草稿',
  validation_failed: '结构检查未通过',
  pending_review: '待审核',
  revision_required: '退回修改',
  reviewed: '审核通过',
  rejected: '不采用',
  published: '已发布',
};

const initialMaterialForm = {
  title: '',
  content: '',
  sourceType: 'manual',
  description: '人工录入材料',
  copyrightNote: '',
  externalReference: '',
};

export default function QuestionResourceWorkbench() {
  const location = useLocation();
  const routeContext = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      mode: params.get('mode'),
      planId: params.get('planId'),
      materialVersionId: params.get('materialVersionId'),
    };
  }, [location.search]);
  const planReviewMode = routeContext.mode === 'plan-review' && Boolean(routeContext.planId);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [context, setContext] = useState(null);
  const [form, setForm] = useState(createBlankForm);
  const [materialForm, setMaterialForm] = useState(initialMaterialForm);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [activePanel, setActivePanel] = useState('workflow');
  const [reviewNotes, setReviewNotes] = useState('内容与元数据已人工核对。');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const editable = !context || ['drafted', 'validation_failed', 'revision_required'].includes(context.draft.status);
  const selectedMaterial = useMemo(
    () => snapshot.materials.find((item) => item.materialVersionId === form.materialVersionId) || null,
    [snapshot.materials, form.materialVersionId],
  );
  const previewResource = context?.frozenVersion || form;

  useEffect(() => {
    refreshWorkspace().catch((error) => setNotice(errorNotice(error)));
  }, [routeContext.planId]);

  async function refreshWorkspace(preferredDraftId = selectedDraftId) {
    const nextSnapshot = await getQuestionResourceWorkbenchSnapshot({
      observationPlanId: planReviewMode ? routeContext.planId : undefined,
    });
    setSnapshot(nextSnapshot);
    const targetId = preferredDraftId && nextSnapshot.drafts.some((item) => item.draftId === preferredDraftId)
      ? preferredDraftId
      : nextSnapshot.drafts[0]?.draftId;
    if (targetId) {
      await selectDraft(targetId, nextSnapshot);
    } else {
      setSelectedDraftId(null);
      setContext(null);
    }
  }

  async function selectDraft(draftId, currentSnapshot = snapshot) {
    const nextContext = await getQuestionResourceWorkbenchContext(draftId);
    setSelectedDraftId(draftId);
    setContext(nextContext);
    setForm(toForm(nextContext.draft));
    setNotice(null);
    if (!currentSnapshot.materials.length && nextContext.material) {
      setSnapshot((value) => ({ ...value, materials: [nextContext.material] }));
    }
  }

  function startNewDraft() {
    setSelectedDraftId(null);
    setContext(null);
    setForm(createBlankForm());
    setNotice(null);
    setActivePanel('workflow');
  }

  async function run(action, successMessage, preferredDraftId) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      const draftId = preferredDraftId?.(result) || selectedDraftId || result?.draftId;
      await refreshWorkspace(draftId);
      setNotice({ type: 'success', message: typeof successMessage === 'function' ? successMessage(result) : successMessage });
      return result;
    } catch (error) {
      setNotice(errorNotice(error));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    const result = await run(
      () => saveQuestionResourceWorkbenchDraft({
        draftId: selectedDraftId || undefined,
        resourceId: context?.draft.resourceId,
        taskId: context?.draft.taskId,
        draft: toDraftInput(form),
      }),
      selectedDraftId ? '草稿已保存，请重新执行结构检查。' : '题目草稿已创建。',
      (draft) => draft.draftId,
    );
    if (result) setSelectedDraftId(result.draftId);
  }

  async function createMaterial() {
    const material = await run(
      () => createWorkbenchMaterial(materialForm),
      'Material 已创建并可供题目引用。',
    );
    if (material) {
      setForm((value) => ({ ...value, materialVersionId: material.materialVersionId }));
      setMaterialForm(initialMaterialForm);
    }
  }

  async function validateDraft() {
    const result = await run(
      async () => {
        const savedDraft = await saveQuestionResourceWorkbenchDraft({
          draftId: selectedDraftId || undefined,
          resourceId: context?.draft.resourceId,
          taskId: context?.draft.taskId,
          draft: toDraftInput(form),
        });
        await validateQuestionResourceWorkbenchDraft(savedDraft.draftId);
        return savedDraft;
      },
      '题目结构检查已完成。',
      (draft) => draft.draftId,
    );
    if (result) setSelectedDraftId(result.draftId);
    setActivePanel('workflow');
  }

  async function submitReview() {
    await run(
      () => submitQuestionResourceWorkbenchReview(selectedDraftId),
      '题目已提交人工审核。',
    );
  }

  async function review(action) {
    const labels = {
      approve: '题目审核通过，可以进入正式发布。',
      revision_required: '题目已退回修改。修改后可重新检查并提交，现有正式版本不受影响。',
      reject: '该题目已标记为不采用，不会进入正式学习系统。',
    };
    await run(
      () => decideQuestionResourceWorkbenchReview({
        draftId: selectedDraftId,
        action,
        reviewerId: 'local-reviewer',
        notes: reviewNotes,
      }),
      labels[action],
    );
  }

  async function freezeDraft() {
    await run(
      () => freezeQuestionResourceWorkbenchDraft(selectedDraftId),
      (result) => result.observationLinkIssues?.length
        ? '正式资源已冻结并更新 Registry；材料观测关联仍需在资源生产页处理。'
        : result.observationLink
          ? '正式资源已冻结，Registry 与材料观测关联均已更新。'
          : '正式资源已冻结，ResourceRegistry 已更新。',
    );
  }

  async function createNextVersion(resourceId) {
    await run(
      () => createQuestionResourceWorkbenchNextVersion(resourceId),
      '新版本草稿已创建，现有正式版本继续生效。',
      (draft) => draft.draftId,
    );
  }

  async function createRejectedRevision() {
    await run(
      () => createQuestionResourceWorkbenchRejectedRevision(selectedDraftId),
      '修订稿已创建，原有“不采用”记录继续保留。',
      (draft) => draft.draftId,
    );
  }

  async function clearWorkspace() {
    if (!window.confirm('确认清除本浏览器中的 Phase 16.1 工作台数据？')) return;
    setBusy(true);
    try {
      await clearQuestionResourceWorkbench();
      setSnapshot(emptySnapshot);
      startNewDraft();
      setNotice({ type: 'success', message: '工作台本地数据已清除。' });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setBusy(false);
    }
  }

  const selectedQuestionIndex = selectedDraftId
    ? snapshot.drafts.findIndex((draft) => draft.draftId === selectedDraftId)
    : -1;
  const resourceNavigator = (
    <ResourceNavigator
      snapshot={snapshot}
      selectedDraftId={selectedDraftId}
      busy={busy}
      onNew={startNewDraft}
      onSelect={selectDraft}
      onNextVersion={createNextVersion}
      onClear={clearWorkspace}
      focusedReview={planReviewMode}
    />
  );
  const questionEditor = (
    <QuestionEditor
      form={form}
      setForm={setForm}
      editable={editable}
      busy={busy}
      context={context}
      materials={snapshot.materials}
      materialForm={materialForm}
      setMaterialForm={setMaterialForm}
      onCreateMaterial={createMaterial}
      onSave={saveDraft}
      focusedReview={planReviewMode}
      selectedQuestionNumber={selectedQuestionIndex >= 0 ? toChineseNumber(selectedQuestionIndex + 1) : null}
    />
  );
  const workflowPanel = (
    <WorkflowPanel
      activePanel={activePanel}
      setActivePanel={setActivePanel}
      context={context}
      form={form}
      material={selectedMaterial || context?.material}
      previewResource={previewResource}
      reviewNotes={reviewNotes}
      setReviewNotes={setReviewNotes}
      busy={busy}
      onValidate={validateDraft}
      onSubmitReview={submitReview}
      onReview={review}
      onFreeze={freezeDraft}
      onCreateRejectedRevision={createRejectedRevision}
      focusedReview={planReviewMode}
    />
  );

  return (
    <div className={`min-h-screen ${planReviewMode ? 'bg-[#f6f8fb] text-slate-950' : 'bg-[#f5f7fb]'}`}>
      {planReviewMode ? (
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
          <div className="mx-auto flex min-h-16 max-w-[1360px] items-center justify-between px-5 md:px-8">
            <div className="flex items-center gap-3">
              <Link
                to="/material-resource-workbench"
                aria-label="返回素材资源录入平台"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg font-semibold">题目审核与发布平台</h1>
                <p className="text-sm text-slate-500">Phase 17.2 · 逐题审核与正式发布</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshWorkspace()}
              disabled={busy}
              title="刷新审核数据"
              aria-label="刷新审核数据"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={17} className={busy ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>
      ) : (
        <PageHeader
          title="题目录入工作台"
          subtitle="Phase 16.1B · Structured Question Intake and Review"
          back
        />
      )}

      <main className={planReviewMode
        ? 'mx-auto w-full max-w-[1360px] px-5 py-7 md:px-8 md:py-9'
        : 'mx-auto max-w-[1600px] px-4 pb-10 sm:px-6'}
      >
        <section className={planReviewMode
          ? 'grid gap-3 pb-4 sm:grid-cols-4'
          : 'mb-4 grid gap-3 border-y border-slate-200 bg-white px-4 py-4 sm:grid-cols-4'}
        >
          <SummaryItem label={planReviewMode ? '本批题目' : 'Draft'} value={snapshot.drafts.length} aligned={planReviewMode} />
          <SummaryItem
            label={planReviewMode ? '待处理' : 'Material'}
            value={planReviewMode
              ? snapshot.drafts.filter((draft) => !['reviewed', 'rejected', 'published'].includes(draftDisplayStatus(snapshot, draft))).length
              : snapshot.materials.length}
            tone={planReviewMode ? 'warning' : undefined}
            aligned={planReviewMode}
          />
          <SummaryItem
            label={planReviewMode ? '审核通过' : 'Frozen Version'}
            value={planReviewMode
              ? snapshot.drafts.filter((draft) => draftDisplayStatus(snapshot, draft) === 'reviewed').length
              : snapshot.versions.length}
            tone={planReviewMode ? 'info' : undefined}
            aligned={planReviewMode}
          />
          <SummaryItem
            label={planReviewMode ? '已发布' : 'Registry'}
            value={planReviewMode
              ? new Set(snapshot.versions.map((version) => version.resourceId)).size
              : snapshot.registryConsistency.passed ? '一致' : '需检查'}
            tone={planReviewMode || snapshot.registryConsistency.passed ? 'success' : 'warning'}
            aligned={planReviewMode}
          />
        </section>

        {notice ? <Notice notice={notice} /> : null}

        {planReviewMode ? (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-5">
              {questionEditor}
              {workflowPanel}
            </div>
            {resourceNavigator}
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(560px,1fr)_380px]">
            {resourceNavigator}
            {questionEditor}
            {workflowPanel}
          </div>
        )}
      </main>
    </div>
  );
}

function ResourceNavigator({ snapshot, selectedDraftId, busy, onNew, onSelect, onNextVersion, onClear, focusedReview }) {
  return (
    <aside className={`overflow-hidden rounded-md bg-white ${focusedReview ? 'lg:sticky lg:top-24' : 'border border-slate-200 xl:sticky xl:top-24'}`}>
      {!focusedReview ? <div className="border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-normal text-white hover:bg-blue-700"
        >
          <FilePlus2 size={16} /> 新建题目 Draft
        </button>
      </div> : null}

      <div className={`${focusedReview ? 'max-h-[560px]' : 'max-h-[380px]'} overflow-auto p-2`}>
        <p className={focusedReview
          ? 'mb-1 border-b border-slate-200 px-2 pb-3 pt-2 text-sm font-semibold text-slate-950'
          : 'px-2 py-2 text-xs font-semibold text-slate-500'}
        >
          {focusedReview ? '本批待审核题目' : 'DRAFT / REVIEW'}
        </p>
        {snapshot.drafts.length ? snapshot.drafts.map((draft, index) => (
          <button
            key={draft.draftId}
            type="button"
            onClick={() => onSelect(draft.draftId)}
            className={`relative mb-1 w-full rounded-md px-3 py-3 text-left transition-colors ${selectedDraftId === draft.draftId ? (focusedReview ? 'bg-emerald-50 text-emerald-800 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r before:bg-emerald-600' : 'bg-blue-50 text-blue-800') : 'hover:bg-slate-50'}`}
          >
            {focusedReview ? (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-950">题目{toChineseNumber(index + 1)}</span>
                  <StatusBadge status={draftDisplayStatus(snapshot, draft)} />
                </span>
                <span
                  className="mt-1 block overflow-hidden text-xs leading-5 text-slate-600"
                  style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}
                >
                  {draft.questionStem || '尚未填写题目内容'}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{optionLabel(abilityOptions, draft.abilityMetadata.abilityId)}</span>
                </span>
              </>
            ) : (
              <>
                <span className="block truncate text-sm text-slate-950">{draft.title || '未命名题目'}</span>
                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>v{draft.proposedVersionNumber} · r{draft.revision}</span>
                  <StatusText status={draft.status} />
                </span>
              </>
            )}
          </button>
        )) : <EmptyText>尚无 Draft</EmptyText>}
      </div>

      {!focusedReview ? <div className="border-t border-slate-200 p-2">
        <p className="px-2 py-2 text-xs font-semibold text-slate-500">FORMAL RESOURCE</p>
        {snapshot.registryEntries.length ? snapshot.registryEntries.map((entry) => (
          <div key={entry.resourceId} className="mb-1 rounded-md bg-slate-50 p-3">
            <p className="truncate text-sm text-slate-900">{entry.resourceId}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{entry.currentFrozenVersionId}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => onNextVersion(entry.resourceId)}
              className="mt-2 flex items-center gap-1 text-xs text-blue-700 disabled:text-slate-400"
            >
              创建新版本 <ChevronRight size={14} />
            </button>
          </div>
        )) : <EmptyText>尚无 Frozen Resource</EmptyText>}
      </div> : null}

      {!focusedReview ? <div className="border-t border-slate-200 p-3">
        <button
          type="button"
          disabled={busy}
          onClick={onClear}
          className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md text-sm font-normal text-slate-500 hover:bg-slate-50 hover:text-rose-700"
        >
          <Trash2 size={15} /> 清除本地 Demo 数据
        </button>
      </div> : null}
    </aside>
  );
}

function QuestionEditor({ form, setForm, editable, busy, context, materials, materialForm, setMaterialForm, onCreateMaterial, onSave, focusedReview, selectedQuestionNumber }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const objectiveQuestion = ['multiple_choice', 'true_false', 'fill_blank'].includes(form.questionType);
  const readingQuestion = form.questionType === 'reading_comprehension';
  const updateRubric = (index, key, value) => setForm((current) => ({
    ...current,
    rubric: current.rubric.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }));

  return (
    <section className={`rounded-md bg-white ${focusedReview ? '[&_input:focus]:border-emerald-500 [&_select:focus]:border-emerald-500 [&_textarea:focus]:border-emerald-500' : 'border border-slate-200'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {focusedReview
              ? selectedQuestionNumber
                ? `题目${selectedQuestionNumber} · 内容与评分标准`
                : '题目内容与评分标准'
              : 'Question Editor'}
          </h2>
          {!focusedReview ? (
            <p className="mt-1 text-xs text-slate-500">
              {context ? `${context.draft.draftId} · ${statusLabels[context.draft.status]}` : '新建未保存 Draft'}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy || !editable}
          onClick={onSave}
          className={`flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400 ${focusedReview ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-950'}`}
        >
          <Save size={16} /> {focusedReview ? '保存修改' : '保存 Draft'}
        </button>
      </div>

      <fieldset disabled={!editable || busy} className="space-y-6 p-4 disabled:opacity-70 sm:p-5">
        {focusedReview ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
            “保存修改”只保存当前草稿，不会自动提交或发布；如已有正式版本，系统会保留原版本，不会直接覆盖。
          </p>
        ) : null}
        <p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-rose-600">*</span> 带 * 的内容为必填项。编辑过程中可以先保存，提交审核前请补充完整。</p>
        <EditorGroup title="基础内容">
          <Field label="资源标题" required>
            <input value={form.title} onChange={(event) => update('title', event.target.value)} className={inputClass} placeholder="例如：人物心理推断练习" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="题型" required>
              <SelectInput
                value={form.questionType}
                onChange={(value) => handleQuestionType(value, setForm)}
                options={questionTypeOptions}
                aligned={focusedReview}
              />
            </Field>
            <Field label="作答格式" required>
              <SelectInput
                value={form.responseFormat}
                onChange={(value) => update('responseFormat', value)}
                options={responseFormatOptions}
                aligned={focusedReview}
              />
            </Field>
          </div>
          <Field label="题干" required>
            <AutoGrowTextarea value={form.questionStem} onChange={(event) => update('questionStem', event.target.value)} rows={4} placeholder="输入学生实际看到的题目要求" />
          </Field>
          {form.questionType === 'multiple_choice' ? (
            <Field label="选项（每行一项）" required requirement="当前题型必填">
              <AutoGrowTextarea value={form.optionsText} onChange={(event) => update('optionsText', event.target.value)} rows={4} />
            </Field>
          ) : null}
        </EditorGroup>

        <EditorGroup title="学习材料">
          <Field label="引用已有材料" required={readingQuestion} requirement={readingQuestion ? '当前题型必填' : undefined}>
            <SelectInput
              disabled={focusedReview}
              value={form.materialVersionId}
              onChange={(value) => update('materialVersionId', value)}
              options={[
                ['', '不引用学习材料'],
                ...materials.map((material) => [material.materialVersionId, `${material.title} · v${material.versionNumber}`]),
              ]}
              aligned={focusedReview}
            />
          </Field>
          {!focusedReview ? <details className="rounded-md bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm text-slate-700">新建学习材料</summary>
            <div className="mt-3 space-y-3">
              <Field label="材料标题" required><input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} className={inputClass} /></Field>
              <Field label="阅读材料正文" required><AutoGrowTextarea value={materialForm.content} onChange={(event) => setMaterialForm({ ...materialForm, content: event.target.value })} rows={5} /></Field>
              <Field label="来源说明" required><input value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} className={inputClass} /></Field>
              <Field label="版权或使用说明" requirement="可选"><input value={materialForm.copyrightNote} onChange={(event) => setMaterialForm({ ...materialForm, copyrightNote: event.target.value })} className={inputClass} /></Field>
              <button type="button" onClick={onCreateMaterial} className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-700">创建学习材料</button>
            </div>
          </details> : null}
        </EditorGroup>

        <EditorGroup title="训练设置">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="主要能力" required>
              <SelectInput value={form.abilityId} onChange={(value) => updateAbility(value, setForm)} options={abilityOptions} aligned={focusedReview} />
            </Field>
            <Field label="任务角色" required>
              <SelectInput value={form.taskRole} onChange={(value) => update('taskRole', value)} options={taskRoleOptions} aligned={focusedReview} />
            </Field>
            <Field label="难度" required>
              <SelectInput value={form.difficulty} onChange={(value) => update('difficulty', value)} options={difficultyOptions} aligned={focusedReview} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="辅助训练能力（逗号分隔）">
              <input value={form.supportingAbilityIdsText} onChange={(event) => update('supportingAbilityIdsText', event.target.value)} className={inputClass} />
            </Field>
            <Field label="前置训练能力（逗号分隔）">
              <input value={form.prerequisiteAbilityIdsText} onChange={(event) => update('prerequisiteAbilityIdsText', event.target.value)} className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="适用年级">
              <input value={form.gradeRange} onChange={(event) => update('gradeRange', event.target.value)} className={inputClass} />
            </Field>
            <Field label="标签（逗号分隔）">
              <input value={form.tagsText} onChange={(event) => update('tagsText', event.target.value)} className={inputClass} />
            </Field>
          </div>
        </EditorGroup>

        <EditorGroup title="作答判定">
          <Field label="评价模式" required>
            <SelectInput value={form.assessmentMode} onChange={(value) => update('assessmentMode', value)} options={assessmentModeOptions} aligned={focusedReview} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="可接受答案（每行一项）" required={objectiveQuestion} requirement={objectiveQuestion ? '当前题型必填' : undefined}>
              <AutoGrowTextarea value={form.acceptedAnswersText} onChange={(event) => update('acceptedAnswersText', event.target.value)} rows={3} />
            </Field>
            <Field label="可接受关键词（每行一项）">
              <AutoGrowTextarea value={form.acceptedKeywordsText} onChange={(event) => update('acceptedKeywordsText', event.target.value)} rows={3} />
            </Field>
          </div>
          <Checkbox label="允许语义等价表达" checked={form.semanticEquivalentAllowed} onChange={(value) => update('semanticEquivalentAllowed', value)} />
        </EditorGroup>

        <EditorGroup title="评分标准">
          <div className="space-y-3">
            {form.rubric.map((item, index) => (
              <div key={item.localId} className="rounded-md border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={`观察项 ${index + 1}`} required><input value={item.name} onChange={(event) => updateRubric(index, 'name', event.target.value)} className={inputClass} /></Field>
                  <Field label="能力" required><SelectInput value={item.abilityId} onChange={(value) => updateRubric(index, 'abilityId', value)} options={abilityOptions} aligned={focusedReview} /></Field>
                  <Field label="重要程度" required><SelectInput value={item.importance} onChange={(value) => updateRubric(index, 'importance', value)} options={rubricImportanceOptions} aligned={focusedReview} /></Field>
                  <Field label="可接受信号（逗号分隔）"><AutoGrowTextarea value={item.acceptedSignalsText} onChange={(event) => updateRubric(index, 'acceptedSignalsText', event.target.value)} rows={2} /></Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Checkbox label="必需项" checked={item.required} onChange={(value) => updateRubric(index, 'required', value)} />
                  <Checkbox label="需要文本依据" checked={item.requireTextEvidence} onChange={(value) => updateRubric(index, 'requireTextEvidence', value)} />
                  <Checkbox label="需要解释" checked={item.requireExplanation} onChange={(value) => updateRubric(index, 'requireExplanation', value)} />
                  {form.rubric.length > 1 ? <button type="button" onClick={() => setForm((current) => ({ ...current, rubric: current.rubric.filter((_, itemIndex) => itemIndex !== index) }))} className="ml-auto text-sm text-rose-700">删除</button> : null}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, rubric: [...current.rubric, createRubricItem(current.abilityId)] }))}
            className="flex min-h-10 w-full items-center justify-center rounded-md border border-emerald-600 bg-white px-4 text-sm font-normal text-emerald-700 hover:bg-emerald-50"
          >
            添加评分项
          </button>
        </EditorGroup>

        <EditorGroup title="最低作答与来源">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="最低字数" required><input type="number" min="1" value={form.minLength} onChange={(event) => update('minLength', event.target.value)} className={inputClass} /></Field>
            <Field label="来源类型" required><SelectInput value={form.sourceType} onChange={(value) => update('sourceType', value)} options={sourceTypeOptions} aligned={focusedReview} /></Field>
            <Field label="来源说明" required><input value={form.sourceDescription} onChange={(event) => update('sourceDescription', event.target.value)} className={inputClass} /></Field>
          </div>
          <div className="flex flex-wrap gap-4"><Checkbox label="最低要求包含文本依据" checked={form.requireTextEvidence} onChange={(value) => update('requireTextEvidence', value)} /><Checkbox label="最低要求包含解释" checked={form.requireExplanation} onChange={(value) => update('requireExplanation', value)} /></div>
          <Field label="版权或使用说明" requirement="建议填写"><input value={form.copyrightNote} onChange={(event) => update('copyrightNote', event.target.value)} className={inputClass} /></Field>
        </EditorGroup>
      </fieldset>
    </section>
  );
}

function WorkflowPanel(props) {
  const { activePanel, setActivePanel, context, form, material, previewResource, reviewNotes, setReviewNotes, busy, onValidate, onSubmitReview, onReview, onFreeze, onCreateRejectedRevision, focusedReview } = props;
  return (
    <aside className={`overflow-hidden rounded-md bg-white ${focusedReview ? '' : 'border border-slate-200 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-24'}`}>
      <div className="grid grid-cols-3 border-b border-slate-200 p-1">
        {[['workflow', '校验 / 审核'], ['student', '学生预览'], ['review', '审核预览']].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setActivePanel(value)} className={`min-h-10 rounded text-sm font-normal ${activePanel === value ? (focusedReview ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white') : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>

      <div className={focusedReview ? 'p-5' : 'max-h-[calc(100vh-155px)] overflow-auto p-4'}>
        {activePanel === 'workflow' ? (
          <WorkflowActions
            context={context}
            reviewNotes={reviewNotes}
            setReviewNotes={setReviewNotes}
            busy={busy}
            onValidate={onValidate}
            onSubmitReview={onSubmitReview}
            onReview={onReview}
            onFreeze={onFreeze}
            onCreateRejectedRevision={onCreateRejectedRevision}
          />
        ) : null}
        {activePanel === 'student' ? <StudentPreview resource={previewResource} material={material} isFrozen={Boolean(context?.frozenVersion)} /> : null}
        {activePanel === 'review' ? <ReviewPreview context={context} form={form} material={material} /> : null}
      </div>
    </aside>
  );
}

function WorkflowActions({ context, reviewNotes, setReviewNotes, busy, onValidate, onSubmitReview, onReview, onFreeze, onCreateRejectedRevision }) {
  if (!context) return <EmptyText>先保存 Draft，再执行正式校验与审核。</EmptyText>;
  const { draft, validation, versionHistory } = context;
  const isFrozen = versionHistory.some((version) => version.sourceDraftId === draft.draftId);
  const hasCurrentPassedValidation = Boolean(
    validation?.passed &&
    validation.validatedDraftRevision === draft.revision &&
    draft.status !== 'revision_required',
  );
  const completedStep = isFrozen
    ? 4
    : draft.status === 'reviewed'
      ? 3
      : ['pending_review', 'rejected'].includes(draft.status)
        ? 2
        : draft.status === 'drafted' && hasCurrentPassedValidation
          ? 1
          : 0;
  const currentStep = isFrozen || draft.status === 'rejected'
    ? null
    : draft.status === 'reviewed'
      ? 4
      : draft.status === 'pending_review'
        ? 3
        : draft.status === 'drafted' && hasCurrentPassedValidation
          ? 2
          : 1;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-950">当前状态：</span>
        {isFrozen ? (
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm font-normal text-emerald-700">
            已发布
          </span>
        ) : draft.status === 'drafted' && hasCurrentPassedValidation ? (
          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-sm font-normal text-blue-700">
            结构检查通过，待提交人工审核
          </span>
        ) : draft.status === 'drafted' ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-sm font-normal text-amber-700">
            草稿
          </span>
        ) : <StatusBadge status={draft.status} />}
      </div>

      {completedStep >= 1 ? <CompletedActionStep index="1" title="自动结构检查" /> : null}
      {completedStep >= 2 ? <CompletedActionStep index="2" title="提交人工审核" /> : null}
      {completedStep >= 3 ? <CompletedActionStep index="3" title="逐题人工审核" /> : null}
      {completedStep >= 4 ? <CompletedActionStep index="4" title="正式发布" /> : null}

      {draft.status === 'rejected' ? (
        <div className="rounded-md bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">当前题目不采用</p>
          <p className="mt-1 text-xs leading-5 text-rose-700">本次审核记录会保留，题目不会发布。如需继续使用，可基于现有内容创建修订稿并重新提交审核。</p>
          <button type="button" disabled={busy} onClick={onCreateRejectedRevision} className="mt-3 flex min-h-10 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">基于此题创建修订稿</button>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <ActionStep index="1" title="自动结构检查">
          <button type="button" disabled={busy || !['drafted', 'validation_failed', 'revision_required'].includes(draft.status)} onClick={onValidate} className={activeWorkflowButtonClass}>保存并执行结构检查</button>
          {validation ? <ValidationResult validation={validation} stale={draft.status === 'revision_required'} /> : <p className="mt-2 text-sm text-slate-500">当前修改尚未执行结构检查，请保存后检查。</p>}
        </ActionStep>
      ) : null}

      {currentStep === 2 ? (
        <ActionStep index="2" title="提交人工审核">
          <button type="button" disabled={busy} onClick={onSubmitReview} className={activeWorkflowButtonClass}>提交人工审核</button>
        </ActionStep>
      ) : null}

      {currentStep === 3 ? (
        <ActionStep index="3" title="逐题人工审核">
          <AutoGrowTextarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} placeholder="填写审核说明" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button type="button" disabled={busy} onClick={() => onReview('approve')} className="min-h-10 rounded-md bg-emerald-600 px-2 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">通过</button>
            <button type="button" disabled={busy} onClick={() => onReview('revision_required')} className="min-h-10 rounded-md bg-amber-500 px-2 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">退回修改</button>
            <button type="button" disabled={busy} onClick={() => onReview('reject')} className="min-h-10 rounded-md bg-rose-600 px-2 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">不采用</button>
          </div>
        </ActionStep>
      ) : null}

      {currentStep === 4 ? (
        <ActionStep index="4" title="正式发布">
          <button type="button" disabled={busy} onClick={onFreeze} className="flex min-h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">发布为正式题目</button>
        </ActionStep>
      ) : null}

      {versionHistory.length > 1 ? (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-900">版本历史</p>
          <div className="mt-2 space-y-2">{versionHistory.map((version) => <div key={version.resourceVersionId} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm"><span>第 {version.versionNumber} 版</span><span className="text-xs text-slate-500">{version.status === 'frozen' ? '已发布' : version.status}</span></div>)}</div>
        </div>
      ) : null}
    </div>
  );
}

function ValidationResult({ validation, stale = false }) {
  if (stale) {
    return (
      <div className="mt-3 rounded-md bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-800">上次结构检查已通过</p>
        <p className="mt-1 text-xs leading-5 text-amber-700">题目已退回修改，请保存并重新执行结构检查后再提交人工审核。</p>
      </div>
    );
  }
  return (
    <div className={`mt-3 rounded-md p-3 ${validation.passed ? 'bg-emerald-50' : 'bg-rose-50'}`}>
      <p className={`flex items-center gap-2 text-sm font-semibold ${validation.passed ? 'text-emerald-800' : 'text-rose-800'}`}>
        {validation.passed ? <CheckCircle2 size={16} /> : null}{validation.passed ? '结构检查通过' : '结构检查未通过'}
      </p>
      {validation.issues.length ? <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">{validation.issues.map((issue) => <li key={`${issue.code}-${issue.field}`}><span className={issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}>{issue.severity === 'error' ? '阻断' : '提醒'}</span> · {validationMessage(issue)} <span className="text-slate-400">({issue.field})</span></li>)}</ul> : <p className="mt-2 text-xs text-emerald-800">没有阻断项。</p>}
    </div>
  );
}

function validationMessage(issue) {
  const messages = {
    'content.title': '资源标题不能为空。',
    'content.question_stem': '题干不能为空。',
    'rubric.required': '至少需要一个评分项。',
    'rubric.name': '评分项名称不能为空。',
    'answer_acceptance.open_exact_match': '开放题不能只使用一个严格答案作为接受边界；请允许语义等价，或改用关键点 / 推理链评价。',
    'source.copyright_note_missing': '尚未记录版权或使用说明。',
  };
  return messages[issue.code] || issue.message;
}

function StudentPreview({ resource, material, isFrozen }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold text-slate-950">学生端任务</h3><span className={`rounded px-2 py-1 text-xs ${isFrozen ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{isFrozen ? 'Frozen' : 'Draft Preview'}</span></div>
      {material?.content ? <div className="mt-4 rounded-md bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">阅读材料</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{material.content}</p></div> : null}
      <div className="mt-4"><p className="text-xs font-semibold text-slate-500">题目</p><p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-950">{resource.questionStem || '尚未录入题干'}</p></div>
      {resource.options?.length ? <div className="mt-4 space-y-2">{resource.options.map((option, index) => <div key={`${option}-${index}`} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">{String.fromCharCode(65 + index)}. {option}</div>)}</div> : null}
      <textarea disabled rows={5} className="mt-4 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" placeholder="学生将在这里作答" />
    </div>
  );
}

function ReviewPreview({ context, form, material }) {
  const draft = context?.draft;
  return (
    <div className="space-y-5">
      <div><h3 className="text-base font-semibold text-slate-950">审核视图</h3><p className="mt-1 text-xs leading-5 text-slate-500">显示审核者需要确认的完整结构，不生成教育结论。</p></div>
      <ReviewBlock title="Identity" rows={[
        ['draftId', draft?.draftId || '未保存'],
        ['resourceId', draft?.resourceId || '保存后生成'],
        ['taskId', draft?.taskId || '保存后生成'],
        ['version', draft ? String(draft.proposedVersionNumber) : '1'],
      ]} />
      <ReviewBlock title="Metadata" rows={[
        ['abilityId', form.abilityId], ['taskRole', form.taskRole], ['difficulty', form.difficulty], ['questionType', form.questionType], ['assessmentMode', form.assessmentMode],
      ]} />
      <ReviewBlock title="Material / Source" rows={[
        ['material', material?.title || '无'], ['sourceType', form.sourceType], ['source', form.sourceDescription || '未填写'],
      ]} />
      <div><p className="text-sm font-semibold text-slate-900">AnswerAcceptance</p><pre className={preClass}>{JSON.stringify(toAnswerAcceptance(form), null, 2)}</pre></div>
      <div><p className="text-sm font-semibold text-slate-900">Rubric</p><pre className={preClass}>{JSON.stringify(toRubric(form), null, 2)}</pre></div>
      {context?.validation ? <div><p className="text-sm font-semibold text-slate-900">Validation</p><p className="mt-2 text-sm text-slate-600">{context.validation.validationId} · {context.validation.passed ? 'PASS' : 'FAILED'}</p></div> : null}
      {context?.review ? <div><p className="text-sm font-semibold text-slate-900">Review</p><p className="mt-2 text-sm text-slate-600">{context.review.reviewId} · {context.review.action}</p></div> : null}
    </div>
  );
}

function ReviewBlock({ title, rows }) {
  return <div><p className="text-sm font-semibold text-slate-900">{title}</p><dl className="mt-2 divide-y divide-slate-100 rounded-md bg-slate-50 px-3">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 py-2 text-xs"><dt className="text-slate-500">{label}</dt><dd className="break-all text-slate-800">{value}</dd></div>)}</dl></div>;
}

function EditorGroup({ title, children }) {
  return <section className="space-y-4 border-b border-slate-100 pb-6 last:border-0 last:pb-0"><h3 className="text-sm font-semibold text-slate-950">{title}</h3>{children}</section>;
}

function AutoGrowTextarea({ value, onChange, rows = 3, placeholder }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const borderHeight = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className={`${textareaClass} resize-none overflow-hidden`}
    />
  );
}

function SelectInput({ value, onChange, options, aligned = false, disabled = false }) {
  if (!aligned) {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={inputClass}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    );
  }

  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] || value || '请选择';
  return (
    <span className={`relative flex min-h-11 w-full items-center rounded-md border border-slate-300 bg-white px-3 pr-10 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 ${disabled ? 'bg-slate-50' : ''}`}>
      <span className="pointer-events-none inline-flex max-w-full items-center truncate rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-sm font-normal text-emerald-700">
        {selectedLabel}
      </span>
      <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-3 text-slate-500" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </span>
  );
}

function Field({ label, children, required = false, requirement }) {
  return <label className="block"><span className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600"><span>{label}{required ? <span className="ml-0.5 text-rose-600" aria-label="必填">*</span> : null}</span>{requirement ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">{requirement}</span> : null}</span>{children}</label>;
}

function Checkbox({ label, checked, onChange }) {
  return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-blue-600" />{label}</label>;
}

function ActionStep({ index, title, children }) {
  return <section><div className="mb-2 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-50 text-xs font-semibold text-emerald-700">{index}</span><h3 className="text-sm font-semibold text-emerald-800">{title}</h3></div>{children}</section>;
}

function CompletedActionStep({ index, title }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2">
      <span className="text-sm text-emerald-800">{index}. {title}</span>
      <span className="rounded bg-white px-2 py-1 text-xs text-emerald-700">已完成</span>
    </div>
  );
}

function SummaryItem({ label, value, tone, aligned = false }) {
  if (aligned) {
    return <div><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-lg font-semibold ${tone === 'success' ? 'text-emerald-700' : tone === 'info' ? 'text-blue-700' : tone === 'warning' ? 'text-amber-700' : 'text-slate-950'}`}>{value}</p></div>;
  }
  return <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 text-lg font-semibold ${tone === 'success' ? 'text-emerald-700' : tone === 'info' ? 'text-blue-700' : tone === 'warning' ? 'text-amber-700' : 'text-slate-950'}`}>{value}</p></div>;
}

function StatusText({ status, large = false }) {
  const tones = { validation_failed: 'text-rose-700', pending_review: 'text-blue-700', revision_required: 'text-amber-700', reviewed: 'text-blue-700', rejected: 'text-rose-700', drafted: 'text-slate-600', published: 'text-emerald-700' };
  return <span className={`${large ? 'text-sm font-semibold' : ''} ${tones[status] || 'text-slate-600'}`}>{statusLabels[status] || status}</span>;
}

function StatusBadge({ status }) {
  const tones = {
    validation_failed: 'bg-rose-50 text-rose-700',
    pending_review: 'bg-amber-50 text-amber-700',
    revision_required: 'bg-amber-50 text-amber-700',
    reviewed: 'bg-blue-50 text-blue-700',
    rejected: 'bg-rose-50 text-rose-700',
    drafted: 'bg-transparent font-semibold text-slate-600',
    published: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return <span className={`shrink-0 rounded px-2 py-1 text-sm ${tones[status] || 'bg-slate-100 text-slate-600'}`}>{statusLabels[status] || status}</span>;
}

function toChineseNumber(value) {
  const values = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return values[value] || String(value);
}

function draftDisplayStatus(snapshot, draft) {
  return snapshot.versions.some((version) => version.sourceDraftId === draft.draftId) ? 'published' : draft.status;
}

function optionLabel(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] || value;
}

function Notice({ notice }) {
  return <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{notice.message}</div>;
}

function EmptyText({ children }) {
  return <p className="px-3 py-4 text-sm text-slate-500">{children}</p>;
}

function createBlankForm() {
  return {
    title: '', questionStem: '', questionType: 'reading_comprehension', responseFormat: 'long_text', optionsText: '', materialVersionId: '',
    assessmentMode: 'reasoning_chain', acceptedAnswersText: '', acceptedKeywordsText: '', semanticEquivalentAllowed: true,
    abilityId: 'inference', supportingAbilityIdsText: 'extraction, comprehension', prerequisiteAbilityIdsText: '', taskRole: 'training', difficulty: 'intermediate', gradeRange: '七至九年级', tagsText: '阅读, 推理',
    rubric: [createRubricItem('inference')], minLength: '20', requireTextEvidence: true, requireExplanation: true,
    sourceType: 'manual', sourceDescription: '人工录入题目', copyrightNote: '', externalReference: '',
  };
}

function createRubricItem(abilityId) {
  return { localId: `${Date.now()}-${Math.random()}`, name: abilityId === 'inference' ? '依据与结论关系' : '核心观察项', abilityId, importance: 'critical', required: true, acceptedSignalsText: '', requireTextEvidence: true, requireExplanation: true };
}

function toForm(draft) {
  return {
    title: draft.title,
    questionStem: draft.questionStem,
    questionType: draft.questionType,
    responseFormat: draft.responseFormat,
    optionsText: (draft.options || []).join('\n'),
    materialVersionId: draft.materialVersionId || '',
    assessmentMode: draft.assessmentMode,
    acceptedAnswersText: (draft.answerAcceptance?.acceptedAnswers || []).join('\n'),
    acceptedKeywordsText: (draft.answerAcceptance?.acceptedKeywords || []).join('\n'),
    semanticEquivalentAllowed: Boolean(draft.answerAcceptance?.semanticEquivalentAllowed),
    abilityId: draft.abilityMetadata.abilityId,
    supportingAbilityIdsText: draft.abilityMetadata.supportingAbilityIds.join(', '),
    prerequisiteAbilityIdsText: draft.abilityMetadata.prerequisiteAbilityIds.join(', '),
    taskRole: draft.abilityMetadata.taskRole,
    difficulty: draft.abilityMetadata.difficulty,
    gradeRange: draft.abilityMetadata.gradeRange || '',
    tagsText: draft.tags.join(', '),
    rubric: draft.rubric.map((item) => ({
      localId: item.itemId,
      name: item.name,
      abilityId: item.abilityId,
      importance: item.importance,
      required: item.required,
      acceptedSignalsText: item.acceptedSignals.join(', '),
      requireTextEvidence: Boolean(item.evidenceRequirement?.requireTextEvidence),
      requireExplanation: Boolean(item.evidenceRequirement?.requireExplanation),
    })),
    minLength: String(draft.minimumAnswerRequirement.minLength),
    requireTextEvidence: draft.minimumAnswerRequirement.requireTextEvidence,
    requireExplanation: draft.minimumAnswerRequirement.requireExplanation,
    sourceType: draft.source.sourceType,
    sourceDescription: localizeLegacySourceText(draft.source.description),
    copyrightNote: localizeLegacySourceText(draft.source.copyrightNote || ''),
    externalReference: draft.source.externalReference || '',
  };
}

function localizeLegacySourceText(value) {
  const legacySentences = {
    '由人工审核后的 AI-assisted Material Observation Plan 生成。': '由人工审核通过的材料观测计划生成。',
    '由已审核 Material Observation Plan 生成的人工资源 Draft。': '由已审核的材料观测计划生成。',
    '沿用关联 Material 的来源与版权审核结果。': '沿用关联学习材料的来源与版权审核结果。',
    '沿用关联 Material 的项目原创版权声明；正式对外使用前需完成内容负责人复核。': '沿用关联学习材料的项目原创版权声明；正式对外使用前需完成内容负责人复核。',
  };
  if (legacySentences[value]) return legacySentences[value];
  return value
    .replaceAll('AI-assisted Material Observation Plan', '材料观测计划')
    .replaceAll('Material Observation Plan', '材料观测计划')
    .replaceAll('Material', '学习材料')
    .replaceAll('资源 Draft', '资源草稿');
}

function toDraftInput(form) {
  return {
    materialVersionId: form.materialVersionId || undefined,
    title: form.title,
    questionStem: form.questionStem,
    questionType: form.questionType,
    responseFormat: form.responseFormat,
    options: lines(form.optionsText),
    assessmentMode: form.assessmentMode,
    answerAcceptance: toAnswerAcceptance(form),
    rubric: toRubric(form),
    minimumAnswerRequirement: { minLength: Number(form.minLength), requireTextEvidence: form.requireTextEvidence, requireExplanation: form.requireExplanation },
    abilityMetadata: { abilityId: form.abilityId, supportingAbilityIds: commaValues(form.supportingAbilityIdsText), prerequisiteAbilityIds: commaValues(form.prerequisiteAbilityIdsText), taskRole: form.taskRole, difficulty: form.difficulty, gradeRange: form.gradeRange || undefined },
    source: { sourceType: form.sourceType, description: form.sourceDescription, copyrightNote: form.copyrightNote || undefined, externalReference: form.externalReference || undefined },
    tags: commaValues(form.tagsText),
  };
}

function toAnswerAcceptance(form) {
  return { acceptedAnswers: lines(form.acceptedAnswersText), acceptedKeywords: lines(form.acceptedKeywordsText), semanticEquivalentAllowed: form.semanticEquivalentAllowed, normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'] };
}

function toRubric(form) {
  return form.rubric.map((item, index) => ({ itemId: `rubric-${index + 1}`, name: item.name, abilityId: item.abilityId, importance: item.importance, required: item.required, acceptedSignals: commaValues(item.acceptedSignalsText), evidenceRequirement: { requireTextEvidence: item.requireTextEvidence, requireExplanation: item.requireExplanation, requireConclusion: false } }));
}

function handleQuestionType(questionType, setForm) {
  const formats = { multiple_choice: ['single_choice', 'exact_match'], true_false: ['boolean', 'exact_match'], fill_blank: ['short_text', 'exact_match'], open_short_answer: ['short_text', 'key_points'], reading_comprehension: ['long_text', 'reasoning_chain'] };
  setForm((current) => ({ ...current, questionType, responseFormat: formats[questionType][0], assessmentMode: formats[questionType][1], optionsText: questionType === 'multiple_choice' ? current.optionsText : '' }));
}

function updateAbility(abilityId, setForm) {
  setForm((current) => ({ ...current, abilityId, rubric: current.rubric.map((item, index) => index === 0 ? { ...item, abilityId } : item) }));
}

function lines(value) { return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
function commaValues(value) { return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean); }
function errorNotice(error) { return { type: 'error', message: error instanceof Error ? error.message : String(error) }; }

const emptySnapshot = { drafts: [], materials: [], registryEntries: [], versions: [], registryConsistency: { passed: true, issues: [] } };
const inputClass = 'min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-500 disabled:bg-slate-50';
const textareaClass = 'w-full rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-950 outline-none focus:border-blue-500 disabled:bg-slate-50';
const activeWorkflowButtonClass = 'flex min-h-10 w-full items-center justify-center rounded-md border border-emerald-600 bg-emerald-600 px-4 text-sm font-normal text-white hover:bg-emerald-700 disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-400';
const preClass = 'mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100';
