import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  approveProductionObservationPlan,
  createProductionMaterial,
  createProductionObservationPlan,
  createProductionQuestionDrafts,
  getMaterialResourceProductionSnapshot,
  submitProductionObservationPlan,
  synchronizeProductionObservationLinks,
} from '../api/materialResourceProductionWorkbench.ts';

const dimensionOptions = [
  ['fact', '事实'], ['character', '人物'], ['plot', '情节'], ['causality', '因果'],
  ['structure', '结构'], ['language', '语言'], ['theme', '主题'],
];
const abilityOptions = [
  ['extraction', '信息提取'], ['comprehension', '理解'], ['summarization', '概括'],
  ['analysis', '分析'], ['inference', '推理'], ['expression', '表达'],
];
const roleOptions = [
  ['training', '训练'], ['retest', '复测'], ['transfer', '迁移'],
  ['diagnosis', '诊断'], ['observation', '观察'],
];
const difficultyOptions = [['basic', '基础'], ['intermediate', '标准'], ['advanced', '进阶']];
const statusLabels = {
  draft: '计划草稿', pending_review: '等待审核', revision_required: '需要修订',
  reviewed: '计划已审核', rejected: '已拒绝', superseded: '已被新版本替代',
};

export default function MaterialResourceProductionWorkbench() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [tasks, setTasks] = useState(createInitialTasks);
  const [materialForm, setMaterialForm] = useState({ title: '', content: '', description: '人工录入材料', copyrightNote: '' });
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { refresh().catch((error) => setNotice(errorNotice(error))); }, []);

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
  const planDrafts = selectedPlan
    ? snapshot.drafts.filter((draft) => draft.tags.includes(`observation_plan:${selectedPlan.materialObservationPlanId}`))
    : [];
  const planLinks = selectedPlan
    ? snapshot.links.filter((link) => link.materialObservationPlanId === selectedPlan.materialObservationPlanId && link.status === 'active')
    : [];

  async function refresh(preferred = {}) {
    const next = await getMaterialResourceProductionSnapshot();
    setSnapshot(next);
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
      () => '材料已保存，可以开始设计 3–6 个能力观测任务。',
      (result) => ({ materialVersionId: result.materialVersionId }),
    );
    if (material) setMaterialForm({ title: '', content: '', description: '人工录入材料', copyrightNote: '' });
  }

  async function createPlan() {
    await run(
      () => createProductionObservationPlan({ materialVersionId: selectedMaterialId, tasks: tasks.map(toTaskInput) }),
      (result) => result.validation.passed ? '观测计划已创建并通过结构校验。' : '观测计划已保存，但需要先修复校验问题。',
      (result) => ({ materialVersionId: selectedMaterialId, planId: result.plan.materialObservationPlanId }),
    );
  }

  async function submitPlan() {
    await run(
      () => submitProductionObservationPlan(selectedPlan.materialObservationPlanId),
      () => '计划已提交人工审核。',
      { materialVersionId: selectedMaterialId, planId: selectedPlan.materialObservationPlanId },
    );
  }

  async function approvePlan() {
    await run(
      () => approveProductionObservationPlan(selectedPlan.materialObservationPlanId),
      () => '计划已人工确认，可以批量生成结构化题目 Draft。',
      { materialVersionId: selectedMaterialId, planId: selectedPlan.materialObservationPlanId },
    );
  }

  async function createDrafts() {
    await run(
      () => createProductionQuestionDrafts(selectedPlan.materialObservationPlanId),
      (results) => {
        const failed = results.filter((item) => item.status === 'failed').length;
        return failed === 0
          ? `已生成或复用 ${results.length} 个 Draft，并完成结构校验。`
          : `${results.length - failed} 个 Draft 已准备，${failed} 个需要单独处理。`;
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
          ? `${linked} 个正式资源已完成观测关联。`
          : `已关联 ${linked} 个；其余资源需先在审核工作台完成 Freeze。`;
      },
      { materialVersionId: selectedMaterialId, planId: selectedPlan.materialObservationPlanId },
    );
  }

  function updateTask(index, patch) {
    setTasks((current) => current.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task));
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <Link to="/internal" aria-label="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"><ArrowLeft size={18} /></Link>
            <div>
              <h1 className="text-lg font-semibold">材料资源生产</h1>
              <p className="text-sm text-slate-500">Phase 17.2 · 最小生产工具</p>
            </div>
          </div>
          <button type="button" onClick={() => refresh()} disabled={busy} title="刷新数据" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={17} className={busy ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-5 py-7 md:px-8 md:py-9">
        <section className="grid gap-3 border-b border-slate-200 pb-7 sm:grid-cols-4" aria-label="生产状态">
          <Metric label="材料" value={snapshot.materials.length} />
          <Metric label="观测计划" value={snapshot.plans.length} />
          <Metric label="题目 Draft" value={snapshot.drafts.filter((draft) => draft.tags.includes('phase17.2')).length} />
          <Metric label="正式关联" value={snapshot.links.filter((link) => link.status === 'active').length} />
        </section>

        {notice && <div role="status" className={`mt-5 border-l-4 px-4 py-3 text-sm leading-6 ${notice.type === 'error' ? 'border-red-500 bg-red-50 text-red-800' : 'border-emerald-500 bg-emerald-50 text-emerald-800'}`}>{notice.message}</div>}

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_480px]">
          <section>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-700">1. 材料</p>
                <h2 className="mt-1 text-lg font-semibold">先确定共同语境</h2>
              </div>
              <select value={selectedMaterialId} onChange={(event) => { setSelectedMaterialId(event.target.value); setSelectedPlanId(''); }} className="min-h-10 max-w-[280px] rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">选择已有材料</option>
                {snapshot.materials.map((material) => <option key={material.materialVersionId} value={material.materialVersionId}>{material.title}</option>)}
              </select>
            </div>

            {!selectedMaterial && (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <label className="block text-sm font-semibold">材料标题<input value={materialForm.title} onChange={(event) => setMaterialForm((value) => ({ ...value, title: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                <label className="mt-4 block text-sm font-semibold">材料正文<textarea value={materialForm.content} onChange={(event) => setMaterialForm((value) => ({ ...value, content: event.target.value }))} rows={10} className="mt-2 w-full rounded-md border border-slate-300 bg-white p-3 font-normal leading-7" placeholder="每个自然段换行。" /></label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">来源说明<input value={materialForm.description} onChange={(event) => setMaterialForm((value) => ({ ...value, description: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                  <label className="block text-sm font-semibold">版权备注<input value={materialForm.copyrightNote} onChange={(event) => setMaterialForm((value) => ({ ...value, copyrightNote: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                </div>
                <button type="button" onClick={addMaterial} disabled={busy || !materialForm.title.trim() || !materialForm.content.trim()} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40"><FilePlus2 size={16} />保存材料</button>
              </div>
            )}

            {selectedMaterial && (
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

          <section className="border-l-0 border-slate-200 lg:border-l lg:pl-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-700">2. 观测任务</p>
                <h2 className="mt-1 text-lg font-semibold">设计 3–6 个题目入口</h2>
              </div>
              <span className="text-sm text-slate-500">{tasks.length} / 6</span>
            </div>

            <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
              {tasks.map((task, index) => (
                <div key={task.localId} className="py-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">任务 {index + 1}</h3>
                    <button type="button" title="删除任务" aria-label={`删除任务 ${index + 1}`} disabled={tasks.length <= 3} onClick={() => setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index))} className="flex h-8 w-8 items-center justify-center text-slate-400 hover:text-red-600 disabled:opacity-25"><Trash2 size={16} /></button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Select label="观察什么" value={task.primaryDimension} options={dimensionOptions} onChange={(value) => updateTask(index, { primaryDimension: value })} />
                    <Select label="能力动作" value={task.abilityId} options={abilityOptions} onChange={(value) => updateTask(index, { abilityId: value, expectedStudentAction: actionForAbility(value) })} />
                    <Select label="任务角色" value={task.taskRole} options={roleOptions} onChange={(value) => updateTask(index, { taskRole: value })} />
                    <Select label="难度" value={task.difficulty} options={difficultyOptions} onChange={(value) => updateTask(index, { difficulty: value })} />
                  </div>
                  <label className="mt-3 block text-sm font-medium">对应段落<input type="number" min="1" max={Math.max(paragraphs.length, 1)} value={task.startParagraph} onChange={(event) => updateTask(index, { startParagraph: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                  <label className="mt-3 block text-sm font-medium">题目<input value={task.questionStem} onChange={(event) => updateTask(index, { questionStem: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" placeholder="写出学生实际看到的题目" /></label>
                  <label className="mt-3 block text-sm font-medium">预期能力动作<input value={task.expectedStudentAction} onChange={(event) => updateTask(index, { expectedStudentAction: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                  <label className="mt-3 block text-sm font-medium">设计理由<input value={task.designReason} onChange={(event) => updateTask(index, { designReason: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <button type="button" disabled={tasks.length >= 6} onClick={() => setTasks((current) => [...current, createTask(current.length)])} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-40"><Plus size={16} />增加任务</button>
              <button type="button" disabled={busy || !selectedMaterial || tasks.some((task) => !task.questionStem.trim() || !task.expectedStudentAction.trim() || !task.designReason.trim())} onClick={createPlan} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40"><ClipboardCheck size={16} />生成观测计划</button>
            </div>
          </section>
        </div>

        <section className="mt-10 border-t border-slate-200 pt-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700">3. 审核与正式化</p>
              <h2 className="mt-1 text-lg font-semibold">复用现有校验、审核与 Freeze 链</h2>
              <p className="mt-2 max-w-[720px] text-sm leading-6 text-slate-600">生产工具只生成并校验 Draft；正式资源仍需逐题审核，不能自动进入 Registry。</p>
            </div>
            {materialPlans.length > 0 && (
              <select value={selectedPlan?.materialObservationPlanId || ''} onChange={(event) => setSelectedPlanId(event.target.value)} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                {materialPlans.map((plan) => <option key={plan.materialObservationPlanId} value={plan.materialObservationPlanId}>第 {plan.revision} 版 · {statusLabels[plan.status]}</option>)}
              </select>
            )}
          </div>

          {!selectedPlan ? (
            <p className="mt-5 text-sm text-slate-500">选择材料并生成观测计划后，审核流程会显示在这里。</p>
          ) : (
            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                <WorkflowRow title="观测计划" value={statusLabels[selectedPlan.status]} done={['pending_review', 'reviewed'].includes(selectedPlan.status)} />
                <WorkflowRow title="结构校验" value={selectedValidation?.passed ? '通过' : '未通过'} done={Boolean(selectedValidation?.passed)} />
                <WorkflowRow title="题目 Draft" value={`${planDrafts.length} / ${selectedPlan.taskPlans.length}`} done={planDrafts.length === selectedPlan.taskPlans.length} />
                <WorkflowRow title="正式关联" value={`${planLinks.length} / ${selectedPlan.taskPlans.length}`} done={planLinks.length === selectedPlan.taskPlans.length} />
              </div>
              <div className="space-y-3">
                {['draft', 'revision_required'].includes(selectedPlan.status) && <ActionButton onClick={submitPlan} disabled={busy || !selectedValidation?.passed} icon={ArrowRight}>提交计划审核</ActionButton>}
                {selectedPlan.status === 'pending_review' && <ActionButton onClick={approvePlan} disabled={busy} icon={ShieldCheck}>确认观测设计</ActionButton>}
                {selectedPlan.status === 'reviewed' && planDrafts.length < selectedPlan.taskPlans.length && <ActionButton onClick={createDrafts} disabled={busy} icon={FilePlus2}>生成并校验题目 Draft</ActionButton>}
                {planDrafts.length > 0 && <Link to="/question-resource-workbench" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"><ClipboardCheck size={16} />进入逐题审核与 Freeze</Link>}
                {planDrafts.length > 0 && <ActionButton onClick={syncLinks} disabled={busy} icon={Link2}>检查正式关联</ActionButton>}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function Select({ label, value, options, onChange }) {
  return <label className="block text-sm font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-2 font-normal">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function WorkflowRow({ title, value, done }) {
  return <div className="flex min-h-14 items-center justify-between gap-4 py-3"><span className="flex items-center gap-2 text-sm font-semibold">{done ? <CheckCircle2 size={17} className="text-emerald-600" /> : <span className="h-4 w-4 rounded-full border border-slate-300" />}{title}</span><span className="text-sm text-slate-600">{value}</span></div>;
}

function ActionButton({ icon: Icon, children, ...props }) {
  return <button type="button" {...props} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"><Icon size={16} />{children}</button>;
}

function createInitialTasks() { return [createTask(0), createTask(1), createTask(2)]; }
function createTask(index) {
  const presets = [
    { primaryDimension: 'fact', abilityId: 'extraction', questionStem: '', expectedStudentAction: '从材料中提取与题目直接相关的事实。' },
    { primaryDimension: 'character', abilityId: 'inference', questionStem: '', expectedStudentAction: '根据人物动作或语言推断其心理，并说明依据。' },
    { primaryDimension: 'theme', abilityId: 'comprehension', questionStem: '', expectedStudentAction: '结合全文内容理解作者表达的情感或态度。' },
  ];
  return {
    localId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    ...(presets[index] || presets[0]),
    taskRole: 'training', difficulty: 'intermediate', startParagraph: 1,
    designReason: '该任务用于观察学生能否完成对应的材料处理动作。',
  };
}
function actionForAbility(abilityId) {
  return ({
    extraction: '从材料中提取与题目直接相关的事实。', comprehension: '结合语境说明材料内容的含义。',
    summarization: '整合材料信息并形成简洁概括。', analysis: '建立材料依据与分析结论之间的关系。',
    inference: '根据材料线索形成合理推断并说明依据。', expression: '组织观点、材料依据和清楚表达。',
  })[abilityId];
}
function toTaskInput(task) {
  return {
    primaryDimension: task.primaryDimension, abilityId: task.abilityId, taskRole: task.taskRole,
    difficulty: task.difficulty, startParagraph: task.startParagraph, questionStem: task.questionStem,
    expectedStudentAction: task.expectedStudentAction, designReason: task.designReason,
    materialRelationIntent: task.taskRole === 'transfer' ? 'new_context' : task.taskRole === 'retest' ? 'similar_context' : 'same_context',
  };
}
function splitParagraphs(content) { return content.replace(/\r\n/g, '\n').trim().split(/\n\s*\n|\n/).map((value) => value.trim()).filter(Boolean); }
function errorNotice(error) { return { type: 'error', message: error instanceof Error ? error.message : String(error) }; }
const emptySnapshot = { materials: [], plans: [], validations: [], drafts: [], frozenVersions: [], links: [] };
