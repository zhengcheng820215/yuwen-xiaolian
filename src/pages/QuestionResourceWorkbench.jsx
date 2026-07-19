import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  FilePlus2,
  RefreshCw,
  Save,
  ShieldCheck,
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

const statusLabels = {
  drafted: '草稿',
  validation_failed: '校验失败',
  pending_review: '待审核',
  revision_required: '退回修改',
  reviewed: '审核通过',
  rejected: '已拒绝',
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
  }, []);

  async function refreshWorkspace(preferredDraftId = selectedDraftId) {
    const nextSnapshot = await getQuestionResourceWorkbenchSnapshot();
    setSnapshot(nextSnapshot);
    const targetId = preferredDraftId && nextSnapshot.drafts.some((item) => item.draftId === preferredDraftId)
      ? preferredDraftId
      : nextSnapshot.drafts[0]?.draftId;
    if (targetId) await selectDraft(targetId, nextSnapshot);
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
      setNotice({ type: 'success', message: successMessage });
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
      selectedDraftId ? 'Draft 已保存，新校验需重新执行。' : 'Structured Question Draft 已创建。',
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
      '结构化校验已完成。',
      (draft) => draft.draftId,
    );
    if (result) setSelectedDraftId(result.draftId);
    setActivePanel('workflow');
  }

  async function submitReview() {
    await run(
      () => submitQuestionResourceWorkbenchReview(selectedDraftId),
      'Draft 已提交人工审核。',
    );
  }

  async function review(action) {
    const labels = {
      approve: '审核已通过，可以执行 Freeze。',
      revision_required: 'Draft 已退回修改，当前正式版本不受影响。',
      reject: 'Draft 已拒绝，不会进入正式资源。',
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
      '正式资源已冻结，ResourceRegistry 已更新。',
    );
    setActivePanel('student');
  }

  async function createNextVersion(resourceId) {
    await run(
      () => createQuestionResourceWorkbenchNextVersion(resourceId),
      '新版本 Draft 已创建，旧 Frozen Version 继续生效。',
      (draft) => draft.draftId,
    );
  }

  async function createRejectedRevision() {
    await run(
      () => createQuestionResourceWorkbenchRejectedRevision(selectedDraftId),
      '修订 Draft 已创建；原拒绝记录保持不变。',
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

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="题目录入工作台"
        subtitle="Phase 16.1B · Structured Question Intake and Review"
        back
      />

      <main className="mx-auto max-w-[1600px] px-4 pb-10 sm:px-6">
        <section className="mb-4 grid gap-3 border-y border-slate-200 bg-white px-4 py-4 sm:grid-cols-4">
          <SummaryItem label="Draft" value={snapshot.drafts.length} />
          <SummaryItem label="Material" value={snapshot.materials.length} />
          <SummaryItem label="Frozen Version" value={snapshot.versions.length} />
          <SummaryItem
            label="Registry"
            value={snapshot.registryConsistency.passed ? '一致' : '需检查'}
            tone={snapshot.registryConsistency.passed ? 'success' : 'warning'}
          />
        </section>

        {notice ? <Notice notice={notice} /> : null}

        <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(560px,1fr)_380px]">
          <ResourceNavigator
            snapshot={snapshot}
            selectedDraftId={selectedDraftId}
            busy={busy}
            onNew={startNewDraft}
            onSelect={selectDraft}
            onNextVersion={createNextVersion}
            onClear={clearWorkspace}
          />

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
          />

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
          />
        </div>
      </main>
    </div>
  );
}

function ResourceNavigator({ snapshot, selectedDraftId, busy, onNew, onSelect, onNextVersion, onClear }) {
  return (
    <aside className="overflow-hidden rounded-md border border-slate-200 bg-white xl:sticky xl:top-24">
      <div className="border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-normal text-white hover:bg-blue-700"
        >
          <FilePlus2 size={16} /> 新建题目 Draft
        </button>
      </div>

      <div className="max-h-[380px] overflow-auto p-2">
        <p className="px-2 py-2 text-xs font-semibold text-slate-500">DRAFT / REVIEW</p>
        {snapshot.drafts.length ? snapshot.drafts.map((draft) => (
          <button
            key={draft.draftId}
            type="button"
            onClick={() => onSelect(draft.draftId)}
            className={`mb-1 w-full rounded-md px-3 py-3 text-left transition-colors ${selectedDraftId === draft.draftId ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50'}`}
          >
            <span className="block truncate text-sm text-slate-950">{draft.title || '未命名题目'}</span>
            <span className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>v{draft.proposedVersionNumber} · r{draft.revision}</span>
              <StatusText status={draft.status} />
            </span>
          </button>
        )) : <EmptyText>尚无 Draft</EmptyText>}
      </div>

      <div className="border-t border-slate-200 p-2">
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
      </div>

      <div className="border-t border-slate-200 p-3">
        <button
          type="button"
          disabled={busy}
          onClick={onClear}
          className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md text-sm font-normal text-slate-500 hover:bg-slate-50 hover:text-rose-700"
        >
          <Trash2 size={15} /> 清除本地 Demo 数据
        </button>
      </div>
    </aside>
  );
}

function QuestionEditor({ form, setForm, editable, busy, context, materials, materialForm, setMaterialForm, onCreateMaterial, onSave }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const objectiveQuestion = ['multiple_choice', 'true_false', 'fill_blank'].includes(form.questionType);
  const readingQuestion = form.questionType === 'reading_comprehension';
  const updateRubric = (index, key, value) => setForm((current) => ({
    ...current,
    rubric: current.rubric.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }));

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Question Editor</h2>
          <p className="mt-1 text-xs text-slate-500">
            {context ? `${context.draft.draftId} · ${statusLabels[context.draft.status]}` : '新建未保存 Draft'}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !editable}
          onClick={onSave}
          className="flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Save size={16} /> 保存 Draft
        </button>
      </div>

      <fieldset disabled={!editable || busy} className="space-y-6 p-4 disabled:opacity-70 sm:p-5">
        <p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-rose-600">*</span> 标记字段需要在执行校验前完成；保存 Draft 时允许暂时缺失。</p>
        <EditorGroup title="基础内容">
          <Field label="资源标题" required>
            <input value={form.title} onChange={(event) => update('title', event.target.value)} className={inputClass} placeholder="例如：人物心理推断练习" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="题型" required>
              <select value={form.questionType} onChange={(event) => handleQuestionType(event.target.value, setForm)} className={inputClass}>
                {questionTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="作答格式" required>
              <select value={form.responseFormat} onChange={(event) => update('responseFormat', event.target.value)} className={inputClass}>
                <option value="single_choice">单选</option>
                <option value="boolean">判断</option>
                <option value="short_text">短文本</option>
                <option value="long_text">长文本</option>
              </select>
            </Field>
          </div>
          <Field label="题干" required>
            <textarea value={form.questionStem} onChange={(event) => update('questionStem', event.target.value)} rows={4} className={textareaClass} placeholder="输入学生实际看到的题目要求" />
          </Field>
          {form.questionType === 'multiple_choice' ? (
            <Field label="选项（每行一项）" required requirement="当前题型必填">
              <textarea value={form.optionsText} onChange={(event) => update('optionsText', event.target.value)} rows={4} className={textareaClass} />
            </Field>
          ) : null}
        </EditorGroup>

        <EditorGroup title="Material">
          <Field label="引用已有材料" required={readingQuestion} requirement={readingQuestion ? '当前题型必填' : undefined}>
            <select value={form.materialVersionId} onChange={(event) => update('materialVersionId', event.target.value)} className={inputClass}>
              <option value="">不引用 Material</option>
              {materials.map((material) => (
                <option key={material.materialVersionId} value={material.materialVersionId}>{material.title} · v{material.versionNumber}</option>
              ))}
            </select>
          </Field>
          <details className="rounded-md bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm text-slate-700">新建 Material</summary>
            <div className="mt-3 space-y-3">
              <Field label="材料标题" required><input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} className={inputClass} /></Field>
              <Field label="阅读材料正文" required><textarea value={materialForm.content} onChange={(event) => setMaterialForm({ ...materialForm, content: event.target.value })} rows={5} className={textareaClass} /></Field>
              <Field label="来源说明" required><input value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} className={inputClass} /></Field>
              <Field label="版权或使用说明" requirement="可选"><input value={materialForm.copyrightNote} onChange={(event) => setMaterialForm({ ...materialForm, copyrightNote: event.target.value })} className={inputClass} /></Field>
              <button type="button" onClick={onCreateMaterial} className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-700">创建 Material</button>
            </div>
          </details>
        </EditorGroup>

        <EditorGroup title="能力与任务 Metadata">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="主要能力" required>
              <select value={form.abilityId} onChange={(event) => updateAbility(event.target.value, setForm)} className={inputClass}>
                {abilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="任务角色" required>
              <select value={form.taskRole} onChange={(event) => update('taskRole', event.target.value)} className={inputClass}>
                {taskRoleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="难度" required>
              <select value={form.difficulty} onChange={(event) => update('difficulty', event.target.value)} className={inputClass}>
                <option value="basic">基础</option>
                <option value="intermediate">中等</option>
                <option value="advanced">进阶</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="辅助能力 ID（逗号分隔）">
              <input value={form.supportingAbilityIdsText} onChange={(event) => update('supportingAbilityIdsText', event.target.value)} className={inputClass} />
            </Field>
            <Field label="前置能力 ID（逗号分隔）">
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

        <EditorGroup title="Answer Acceptance">
          <Field label="评价模式" required>
            <select value={form.assessmentMode} onChange={(event) => update('assessmentMode', event.target.value)} className={inputClass}>
                <option value="exact_match">严格答案匹配</option>
              <option value="key_points">关键点</option>
              <option value="reasoning_chain">推理链</option>
              <option value="expression_quality">表达质量</option>
              <option value="process_operation">过程操作</option>
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="可接受答案（每行一项）" required={objectiveQuestion} requirement={objectiveQuestion ? '当前题型必填' : undefined}>
              <textarea value={form.acceptedAnswersText} onChange={(event) => update('acceptedAnswersText', event.target.value)} rows={3} className={textareaClass} />
            </Field>
            <Field label="可接受关键词（每行一项）">
              <textarea value={form.acceptedKeywordsText} onChange={(event) => update('acceptedKeywordsText', event.target.value)} rows={3} className={textareaClass} />
            </Field>
          </div>
          <Checkbox label="允许语义等价表达" checked={form.semanticEquivalentAllowed} onChange={(value) => update('semanticEquivalentAllowed', value)} />
        </EditorGroup>

        <EditorGroup title="Rubric">
          <div className="space-y-3">
            {form.rubric.map((item, index) => (
              <div key={item.localId} className="rounded-md border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={`观察项 ${index + 1}`} required><input value={item.name} onChange={(event) => updateRubric(index, 'name', event.target.value)} className={inputClass} /></Field>
                  <Field label="能力" required><select value={item.abilityId} onChange={(event) => updateRubric(index, 'abilityId', event.target.value)} className={inputClass}>{abilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                  <Field label="重要程度" required><select value={item.importance} onChange={(event) => updateRubric(index, 'importance', event.target.value)} className={inputClass}><option value="critical">关键</option><option value="important">重要</option><option value="supporting">辅助</option></select></Field>
                  <Field label="可接受信号（逗号分隔）"><input value={item.acceptedSignalsText} onChange={(event) => updateRubric(index, 'acceptedSignalsText', event.target.value)} className={inputClass} /></Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Checkbox label="必需项" checked={item.required} onChange={(value) => updateRubric(index, 'required', value)} />
                  <Checkbox label="需要文本依据" checked={item.requireTextEvidence} onChange={(value) => updateRubric(index, 'requireTextEvidence', value)} />
                  <Checkbox label="需要解释" checked={item.requireExplanation} onChange={(value) => updateRubric(index, 'requireExplanation', value)} />
                  {form.rubric.length > 1 ? <button type="button" onClick={() => setForm((current) => ({ ...current, rubric: current.rubric.filter((_, itemIndex) => itemIndex !== index) }))} className="text-sm text-rose-700">删除</button> : null}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setForm((current) => ({ ...current, rubric: [...current.rubric, createRubricItem(current.abilityId)] }))} className="min-h-10 rounded-md border border-slate-300 px-4 text-sm font-normal text-slate-700">添加 Rubric Item</button>
        </EditorGroup>

        <EditorGroup title="最低作答与来源">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="最低字数" required><input type="number" min="1" value={form.minLength} onChange={(event) => update('minLength', event.target.value)} className={inputClass} /></Field>
            <Field label="来源类型" required><select value={form.sourceType} onChange={(event) => update('sourceType', event.target.value)} className={inputClass}><option value="manual">人工</option><option value="imported">导入</option><option value="ai_assisted">AI 辅助</option><option value="ocr_assisted">OCR 辅助</option></select></Field>
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
  const { activePanel, setActivePanel, context, form, material, previewResource, reviewNotes, setReviewNotes, busy, onValidate, onSubmitReview, onReview, onFreeze, onCreateRejectedRevision } = props;
  return (
    <aside className="overflow-hidden rounded-md border border-slate-200 bg-white lg:col-span-2 xl:col-span-1 xl:sticky xl:top-24">
      <div className="grid grid-cols-3 border-b border-slate-200 p-1">
        {[['workflow', '校验 / 审核'], ['student', '学生预览'], ['review', '审核预览']].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setActivePanel(value)} className={`min-h-10 rounded text-sm font-normal ${activePanel === value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>

      <div className="max-h-[calc(100vh-155px)] overflow-auto p-4">
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
  const { draft, validation, review, registryEntry, versionHistory } = context;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-slate-500">当前状态</p>
        <div className="mt-2 flex items-center justify-between rounded-md bg-slate-50 p-3">
          <StatusText status={draft.status} large />
          <span className="text-xs text-slate-500">revision {draft.revision}</span>
        </div>
      </div>

      {draft.status === 'rejected' ? (
        <div className="rounded-md bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">当前 Draft 已终止</p>
          <p className="mt-1 text-xs leading-5 text-rose-700">拒绝记录将被保留。创建修订 Draft 后，可基于现有内容继续编辑并重新提交审核。</p>
          <button type="button" disabled={busy} onClick={onCreateRejectedRevision} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400"><FilePlus2 size={15} />基于此题创建修订 Draft</button>
        </div>
      ) : null}

      <ActionStep index="1" title="结构化校验">
        <button type="button" disabled={busy || !['drafted', 'validation_failed', 'revision_required'].includes(draft.status)} onClick={onValidate} className={secondaryButtonClass}><RefreshCw size={15} />保存并执行校验</button>
        {validation ? <ValidationResult validation={validation} /> : <p className="mt-2 text-sm text-slate-500">尚未校验。</p>}
      </ActionStep>

      <ActionStep index="2" title="提交审核">
        <button type="button" disabled={busy || !validation?.passed || draft.status !== 'drafted'} onClick={onSubmitReview} className={secondaryButtonClass}><ChevronRight size={15} />提交人工审核</button>
      </ActionStep>

      <ActionStep index="3" title="人工审核决定">
        <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} className={textareaClass} placeholder="审核说明" />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" disabled={busy || draft.status !== 'pending_review'} onClick={() => onReview('approve')} className="min-h-10 rounded-md bg-emerald-600 px-2 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">通过</button>
          <button type="button" disabled={busy || draft.status !== 'pending_review'} onClick={() => onReview('revision_required')} className="min-h-10 rounded-md bg-amber-500 px-2 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">退回</button>
          <button type="button" disabled={busy || draft.status !== 'pending_review'} onClick={() => onReview('reject')} className="min-h-10 rounded-md bg-rose-600 px-2 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">拒绝</button>
        </div>
        {review ? <p className="mt-2 text-sm leading-6 text-slate-600">最近决定：{review.action} · {review.notes}</p> : null}
      </ActionStep>

      <ActionStep index="4" title="Freeze 正式资源">
        <button type="button" disabled={busy || draft.status !== 'reviewed' || versionHistory.some((version) => version.sourceDraftId === draft.draftId)} onClick={onFreeze} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400"><ShieldCheck size={16} />{versionHistory.some((version) => version.sourceDraftId === draft.draftId) ? '已冻结为正式版本' : '冻结为正式版本'}</button>
        {registryEntry ? <p className="mt-2 break-all text-xs leading-5 text-slate-500">Current: {registryEntry.currentFrozenVersionId}</p> : null}
      </ActionStep>

      {versionHistory.length ? (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-900">版本历史</p>
          <div className="mt-2 space-y-2">{versionHistory.map((version) => <div key={version.resourceVersionId} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm"><span>v{version.versionNumber}</span><span className="text-xs text-slate-500">{version.status}</span></div>)}</div>
        </div>
      ) : null}
    </div>
  );
}

function ValidationResult({ validation }) {
  return (
    <div className={`mt-3 rounded-md p-3 ${validation.passed ? 'bg-emerald-50' : 'bg-rose-50'}`}>
      <p className={`flex items-center gap-2 text-sm font-semibold ${validation.passed ? 'text-emerald-800' : 'text-rose-800'}`}>
        {validation.passed ? <CheckCircle2 size={16} /> : null}{validation.passed ? '校验通过' : '校验未通过'}
      </p>
      {validation.issues.length ? <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">{validation.issues.map((issue) => <li key={`${issue.code}-${issue.field}`}><span className={issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}>{issue.severity === 'error' ? '阻断' : '提醒'}</span> · {validationMessage(issue)} <span className="text-slate-400">({issue.field})</span></li>)}</ul> : <p className="mt-2 text-xs text-emerald-800">没有阻断项。</p>}
    </div>
  );
}

function validationMessage(issue) {
  const messages = {
    'content.title': '资源标题不能为空。',
    'content.question_stem': '题干不能为空。',
    'rubric.required': '至少需要一个 Rubric 观察项。',
    'rubric.name': 'Rubric 观察项名称不能为空。',
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

function Field({ label, children, required = false, requirement }) {
  return <label className="block"><span className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600"><span>{label}{required ? <span className="ml-0.5 text-rose-600" aria-label="必填">*</span> : null}</span>{requirement ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-500">{requirement}</span> : null}</span>{children}</label>;
}

function Checkbox({ label, checked, onChange }) {
  return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-blue-600" />{label}</label>;
}

function ActionStep({ index, title, children }) {
  return <section><div className="mb-2 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-xs text-slate-600">{index}</span><h3 className="text-sm font-semibold text-slate-900">{title}</h3></div>{children}</section>;
}

function SummaryItem({ label, value, tone }) {
  return <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 text-lg font-semibold ${tone === 'success' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-slate-950'}`}>{value}</p></div>;
}

function StatusText({ status, large = false }) {
  const tones = { validation_failed: 'text-rose-700', pending_review: 'text-blue-700', revision_required: 'text-amber-700', reviewed: 'text-emerald-700', rejected: 'text-rose-700', drafted: 'text-slate-600' };
  return <span className={`${large ? 'text-sm font-semibold' : ''} ${tones[status] || 'text-slate-600'}`}>{statusLabels[status] || status}</span>;
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
    sourceDescription: draft.source.description,
    copyrightNote: draft.source.copyrightNote || '',
    externalReference: draft.source.externalReference || '',
  };
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
const secondaryButtonClass = 'flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-700 disabled:bg-slate-50 disabled:text-slate-400';
const preClass = 'mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100';
