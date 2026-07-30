import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { createWorkbenchErrorNotice } from '../api/workbenchErrorNotice.ts';
import { requestQuestionStemOptimization } from '../api/questionStemOptimization.ts';
import { requestRubricItemOptimization } from '../api/rubricItemOptimization.ts';
import { formatMaterialTitle } from '../ui/materialTitle.ts';
import {
  assessAuthoringFieldResponsibilities,
  getQualityCheckEditLocation,
  getQualityChecksForUiField,
  getQualityIssueEditorTargetIds,
} from '../ai/contracts/authoringFieldContract.ts';
import {
  buildQuestionQualityRepairQueue,
  markCurrentQuestionQualityIssueModified,
  parseQuestionQualityRevisionProgress,
  reconcileQuestionQualityRevisionProgress,
} from './questionQualityRevisionProgress.ts';
import {
  clearQuestionResourceWorkbench,
  createQuestionResourceWorkbenchNextVersion,
  createQuestionResourceWorkbenchPublicationRepair,
  createQuestionResourceWorkbenchRejectedRevision,
  createWorkbenchMaterial,
  decideQuestionResourceWorkbenchReview,
  discardQuestionResourceWorkbenchDraft,
  freezeQuestionResourceWorkbenchDraft,
  getQuestionResourceWorkbenchContext,
  getQuestionResourceWorkbenchSnapshot,
  saveQuestionResourceWorkbenchDraft,
  submitQuestionResourceWorkbenchReview,
  retryQuestionResourceWorkbenchPublication,
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
  ['critical', '核心要求'],
  ['important', '重要要求'],
  ['supporting', '补充要求'],
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
  pending_review: '待人工审核',
  revision_required: '退回修改',
  reviewed: '审核通过',
  rejected: '不采用',
  archived: '已归档',
  published: '已发布',
  publication_incomplete: '发布未完成',
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
  const navigate = useNavigate();
  const routeContext = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      mode: params.get('mode'),
      planId: params.get('planId'),
      materialVersionId: params.get('materialVersionId'),
      draftId: params.get('draftId'),
    };
  }, [location.search]);
  const planReviewMode = routeContext.mode === 'plan-review' && Boolean(routeContext.planId);
  const materialWorkbenchReturnPath = useMemo(() => {
    const params = new URLSearchParams();
    if (routeContext.materialVersionId) params.set('materialVersionId', routeContext.materialVersionId);
    if (routeContext.planId) params.set('planId', routeContext.planId);
    const query = params.toString();
    return `/material-resource-workbench${query ? `?${query}` : ''}`;
  }, [routeContext.materialVersionId, routeContext.planId]);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [context, setContext] = useState(null);
  const [form, setForm] = useState(createBlankForm);
  const [savedFormSignature, setSavedFormSignature] = useState(() => draftInputSignature(createBlankForm()));
  const [materialForm, setMaterialForm] = useState(initialMaterialForm);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [activePanel, setActivePanel] = useState('workflow');
  const [reviewNotes, setReviewNotes] = useState('内容与元数据已人工核对。');
  const [acceptedReviewWarningCodes, setAcceptedReviewWarningCodes] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stemOptimization, setStemOptimization] = useState(null);
  const [stemOptimizationError, setStemOptimizationError] = useState('');
  const [stemOptimizationBusy, setStemOptimizationBusy] = useState(false);
  const [stemOptimizationAttempts, setStemOptimizationAttempts] = useState(0);
  const [rubricOptimization, setRubricOptimization] = useState(null);
  const [rubricOptimizationAttempts, setRubricOptimizationAttempts] = useState({});
  const [qualityResultStale, setQualityResultStale] = useState(false);
  const [qualityRevisionProgress, setQualityRevisionProgress] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const stemOptimizationRequestRef = useRef(0);
  const rubricOptimizationRequestRef = useRef(0);
  const postNavigationNoticeRef = useRef(null);
  const qualityRepairEditCheckRef = useRef(null);

  const editable = !context || ['drafted', 'validation_failed', 'revision_required'].includes(context.draft.status);
  const selectedMaterial = useMemo(
    () => snapshot.materials.find((item) => item.materialVersionId === form.materialVersionId) || null,
    [snapshot.materials, form.materialVersionId],
  );
  const previewResource = context?.frozenVersion || form;
  const hasUnsavedChanges = useMemo(
    () => draftInputSignature(form) !== savedFormSignature,
    [form, savedFormSignature],
  );

  useEffect(() => {
    refreshWorkspace(routeContext.draftId).catch((error) => setNotice(errorNotice(error)));
  }, [routeContext.planId, routeContext.draftId]);

  useEffect(() => {
    const preventUnsavedExit = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnsavedExit);
    return () => window.removeEventListener('beforeunload', preventUnsavedExit);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    qualityRepairEditCheckRef.current = null;
    setAcceptedReviewWarningCodes(
      context?.review?.warningDecisions
        ?.filter((decision) => decision.decision === 'accepted')
        .map((decision) => decision.warningCode) || [],
    );
    if (!selectedDraftId) {
      setQualityRevisionProgress(null);
      return;
    }
    const stored = parseQuestionQualityRevisionProgress(
      context?.draft?.qualityRevisionProgress,
      selectedDraftId,
    );
    const next = reconcileQuestionQualityRevisionProgress(
      stored,
      context?.qualityAssessment,
    );
    setQualityRevisionProgress(next);
  }, [
    selectedDraftId,
    context?.draft?.qualityRevisionProgress,
    context?.qualityAssessment?.assessmentId,
    context?.review?.reviewId,
  ]);

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
    if (postNavigationNoticeRef.current) {
      setNotice(postNavigationNoticeRef.current);
      postNavigationNoticeRef.current = null;
    }
  }

  async function selectDraft(draftId, currentSnapshot = snapshot) {
    stemOptimizationRequestRef.current += 1;
    rubricOptimizationRequestRef.current += 1;
    const nextContext = await getQuestionResourceWorkbenchContext(draftId);
    setSelectedDraftId(draftId);
    setContext(nextContext);
    const nextForm = toForm(nextContext.draft, nextContext.authoringFields);
    setForm(nextForm);
    setSavedFormSignature(draftInputSignature(nextForm));
    setNotice(null);
    setStemOptimization(null);
    setStemOptimizationError('');
    setStemOptimizationBusy(false);
    setStemOptimizationAttempts(0);
    setRubricOptimization(null);
    setRubricOptimizationAttempts({});
    setQualityResultStale(false);
    setQualityRevisionProgress(null);
    qualityRepairEditCheckRef.current = null;
    if (!currentSnapshot.materials.length && nextContext.material) {
      setSnapshot((value) => ({ ...value, materials: [nextContext.material] }));
    }
  }

  function requestNavigation(action, destinationLabel) {
    if (!hasUnsavedChanges) {
      void action();
      return;
    }
    setPendingNavigation({ action, destinationLabel });
  }

  function selectDraftWithConfirmation(draftId) {
    if (draftId === selectedDraftId) return;
    requestNavigation(
      () => selectDraft(draftId),
      '切换到其他题目',
    );
  }

  function startNewDraft() {
    stemOptimizationRequestRef.current += 1;
    rubricOptimizationRequestRef.current += 1;
    setSelectedDraftId(null);
    setContext(null);
    const nextForm = createBlankForm();
    setForm(nextForm);
    setSavedFormSignature(draftInputSignature(nextForm));
    setNotice(null);
    setStemOptimization(null);
    setStemOptimizationError('');
    setStemOptimizationBusy(false);
    setStemOptimizationAttempts(0);
    setRubricOptimization(null);
    setRubricOptimizationAttempts({});
    setQualityResultStale(false);
    setQualityRevisionProgress(null);
    qualityRepairEditCheckRef.current = null;
    setActivePanel('workflow');
  }

  function startNewDraftWithConfirmation() {
    requestNavigation(startNewDraft, '新建题目');
  }

  function returnToMaterialWorkbench(event) {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    requestNavigation(
      () => navigate(materialWorkbenchReturnPath),
      '返回素材资源录入平台',
    );
  }

  function refreshWorkspaceWithConfirmation() {
    requestNavigation(
      () => refreshWorkspace().catch((error) => setNotice(errorNotice(error))),
      '刷新当前审核数据',
    );
  }

  function updateQualityRelevantForm(updater, affectedChecks = []) {
    stemOptimizationRequestRef.current += 1;
    rubricOptimizationRequestRef.current += 1;
    setStemOptimizationBusy(false);
    setForm(updater);
    setStemOptimization(null);
    setStemOptimizationError('');
    setStemOptimizationAttempts(0);
    setRubricOptimization(null);
    setRubricOptimizationAttempts({});
    if (context?.validation || context?.qualityAssessment) {
      setQualityResultStale(true);
      setQualityRevisionProgress((current) => buildModifiedQualityProgress(current, affectedChecks));
    }
  }

  function buildModifiedQualityProgress(current, affectedChecks) {
    const reconciled = reconcileQuestionQualityRevisionProgress(
      current,
      context?.qualityAssessment,
    );
    const queue = buildQuestionQualityRepairQueue(reconciled);
    const editCheck = qualityRepairEditCheckRef.current || queue.current?.check || null;
    if (editCheck && affectedChecks.includes(editCheck)) {
      qualityRepairEditCheckRef.current = editCheck;
    }
    return markCurrentQuestionQualityIssueModified(
      reconciled,
      context?.qualityAssessment,
      affectedChecks,
      editCheck,
    );
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
        expectedDraftRevision: context?.draft.revision,
        resourceId: context?.draft.resourceId,
        taskId: context?.draft.taskId,
        draft: toDraftInput(form),
        qualityRevisionProgress,
      }),
      selectedDraftId ? '修改已保存，请重新检查题目。' : '题目草稿已创建。',
      (draft) => draft.draftId,
    );
    if (result) setSelectedDraftId(result.draftId);
    return result;
  }

  async function saveAndContinueNavigation() {
    const pending = pendingNavigation;
    if (!pending) return;
    const result = await saveDraft();
    if (!result) return;
    setPendingNavigation(null);
    await pending.action();
  }

  async function discardAndContinueNavigation() {
    const pending = pendingNavigation;
    if (!pending) return;
    setPendingNavigation(null);
    await pending.action();
  }

  async function createMaterial() {
    const material = await run(
      () => createWorkbenchMaterial(materialForm),
      'Material 已创建并可供题目引用。',
    );
    if (material) {
      updateQualityRelevantForm((value) => ({ ...value, materialVersionId: material.materialVersionId }));
      setMaterialForm(initialMaterialForm);
    }
  }

  async function validateDraft() {
    const result = await run(
      async () => {
        const draftToValidate = hasUnsavedChanges || !selectedDraftId
          ? await saveQuestionResourceWorkbenchDraft({
            draftId: selectedDraftId || undefined,
            expectedDraftRevision: context?.draft.revision,
            resourceId: context?.draft.resourceId,
            taskId: context?.draft.taskId,
            draft: toDraftInput(form),
            qualityRevisionProgress,
          })
          : context.draft;
        await validateQuestionResourceWorkbenchDraft(
          draftToValidate.draftId,
          draftToValidate.revision,
        );
        return draftToValidate;
      },
      '题目结构检查已完成。',
      (draft) => draft.draftId,
    );
    if (result) setSelectedDraftId(result.draftId);
    setActivePanel('workflow');
  }

  async function saveAndRecheckDraft(nextForm, nextProgress, successMessage) {
    const result = await run(
      async () => {
        const savedDraft = await saveQuestionResourceWorkbenchDraft({
          draftId: selectedDraftId || undefined,
          expectedDraftRevision: context?.draft.revision,
          resourceId: context?.draft.resourceId,
          taskId: context?.draft.taskId,
          draft: toDraftInput(nextForm),
          qualityRevisionProgress: nextProgress,
        });
        await validateQuestionResourceWorkbenchDraft(
          savedDraft.draftId,
          savedDraft.revision,
        );
        return savedDraft;
      },
      successMessage,
      (draft) => draft.draftId,
    );
    if (result) {
      setSelectedDraftId(result.draftId);
      setActivePanel('workflow');
    }
    return result;
  }

  async function submitReview() {
    await run(
      () => submitQuestionResourceWorkbenchReview(
        selectedDraftId,
        context?.draft.revision,
      ),
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
        expectedDraftRevision: context?.draft.revision,
        action,
        reviewerId: 'local-reviewer',
        notes: reviewNotes,
        acceptedWarningCodes: acceptedReviewWarningCodes,
      }),
      labels[action],
    );
  }

  async function freezeDraft() {
    const retryExistingPublication = Boolean(context?.frozenVersion);
    await run(
      () => retryExistingPublication
        ? retryQuestionResourceWorkbenchPublication(
          selectedDraftId,
          context?.draft.revision,
        )
        : freezeQuestionResourceWorkbenchDraft(
          selectedDraftId,
          context?.draft.revision,
        ),
      (result) => result.observationLinkIssues?.length
        ? '正式题目版本已保留，但材料观测关联仍未完成，可稍后继续重试。'
        : result.observationLink
          ? retryExistingPublication
            ? '已沿用现有正式题目版本并补齐材料观测关联。'
            : '正式资源已冻结，Registry 与材料观测关联均已更新。'
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

  async function repairPublication() {
    const existingRepairDraft = findPublicationRepairDraft(snapshot, context?.draft);
    const result = await run(
      () => createQuestionResourceWorkbenchPublicationRepair(selectedDraftId),
      existingRepairDraft
        ? '已打开当前题已有的发布修订稿，不会重复创建待审核题目。'
        : '已为当前题创建一份发布修订稿，并按训练计划同步设置。请检查后重新提交审核。',
      (draft) => draft.draftId,
    );
    if (!result) return;
    const params = new URLSearchParams(location.search);
    params.set('draftId', result.draftId);
    navigate(
      { pathname: location.pathname, search: `?${params.toString()}` },
      { replace: true },
    );
  }

  async function createRejectedRevision() {
    const existingRevision = findRejectedRevisionDraft(snapshot, context?.draft);
    const result = await run(
      () => createQuestionResourceWorkbenchRejectedRevision(selectedDraftId),
      existingRevision
        ? '已打开当前题已有的修订稿，不会重复创建草稿。'
        : '修订稿已创建，原有“不采用”记录继续保留。',
      (draft) => draft.draftId,
    );
    if (!result) return;
    const params = new URLSearchParams(location.search);
    params.set('draftId', result.draftId);
    navigate(
      { pathname: location.pathname, search: `?${params.toString()}` },
      { replace: true },
    );
  }

  async function discardDraft(targetDraftId = selectedDraftId) {
    const targetDraft = snapshot.drafts.find((draft) => draft.draftId === targetDraftId);
    if (!targetDraftId || !targetDraft) return;
    const hasFrozenVersion = snapshot.versions.some((version) => version.sourceDraftId === targetDraftId);
    const requiresArchive = Boolean(
      hasFrozenVersion ||
      targetDraft.latestReviewId ||
      ['pending_review', 'revision_required', 'reviewed', 'rejected'].includes(targetDraft.status),
    );
    const actionLabel = targetDraft.status === 'revision_required'
      ? '放弃本次修改'
      : targetDraft.status === 'pending_review'
        ? '撤回并归档'
        : targetDraft.status === 'rejected'
          ? '归档题目'
          : '删除草稿';
    const consequence = requiresArchive
      ? '该题将从当前工作列表隐藏，已有审核及版本记录会继续保留。'
      : '该草稿及其临时检查记录将被删除，且无法恢复。';
    if (!window.confirm(`确认${actionLabel}？\n${consequence}`)) return;

    setBusy(true);
    setNotice(null);
    try {
      const result = await discardQuestionResourceWorkbenchDraft(targetDraftId);
      const nextParams = new URLSearchParams(location.search);
      const routePointsToTargetDraft = nextParams.get('draftId') === targetDraftId;
      const deletingSelectedDraft = selectedDraftId === targetDraftId;
      if (routePointsToTargetDraft) nextParams.delete('draftId');
      const successNotice = {
        type: 'success',
        message: result.action === 'archived'
          ? '该题已归档，审核与版本记录继续保留。'
          : '草稿及其临时检查记录已删除。',
      };
      if (deletingSelectedDraft) {
        setSelectedDraftId(null);
        setContext(null);
      }
      if (routePointsToTargetDraft) {
        postNavigationNoticeRef.current = successNotice;
        navigate(
          { pathname: location.pathname, search: nextParams.toString() ? `?${nextParams}` : '' },
          { replace: true },
        );
      } else {
        await refreshWorkspace(deletingSelectedDraft ? null : selectedDraftId);
        setNotice(successNotice);
      }
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setBusy(false);
    }
  }

  async function optimizeStem(targetChecks = []) {
    const material = selectedMaterial || context?.material;
    if (!material) {
      setStemOptimizationError('请先为题目关联学习材料。');
      return;
    }
    if (stemOptimizationAttempts >= 2) {
      setStemOptimizationError('已完成 2 次受控优化。请直接在“题干”中修改，或保留原题干。');
      return;
    }
    const previousSuggestion = stemOptimization;
    const assessmentWarnings = context?.qualityAssessment?.warnings || [];
    const qualityIssues = targetChecks.length
      ? targetChecks.map((check) => {
        const warning = assessmentWarnings.find((item) => item.check === check);
        const remainingIssue = previousSuggestion?.suggestionReview?.remainingIssues
          ?.find((item) => item.check === check);
        return {
          check,
          message: remainingIssue?.message || warning?.message || '请针对该项质量提醒继续优化。',
        };
      })
      : assessmentWarnings.map((warning) => ({
        check: warning.check,
        message: warning.message,
      }));
    const requestSequence = stemOptimizationRequestRef.current + 1;
    stemOptimizationRequestRef.current = requestSequence;
    setStemOptimizationBusy(true);
    setStemOptimization(null);
    setStemOptimizationError('');
    setStemOptimizationAttempts((value) => value + 1);
    try {
      const result = await requestQuestionStemOptimization({
        requestId: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `question-stem-${Date.now()}`,
        material: {
          materialVersionId: material.materialVersionId,
          title: material.title,
          content: material.content,
        },
        question: {
          questionStem: form.questionStem,
          observationFocus: form.title,
          abilityId: form.abilityId,
          difficulty: form.difficulty,
          rubricFocuses: form.rubric.map((item) => item.name).filter(Boolean),
        },
        qualityIssues,
        targetChecks,
      });
      if (stemOptimizationRequestRef.current === requestSequence) {
        setStemOptimization(result);
      }
    } catch (error) {
      if (stemOptimizationRequestRef.current === requestSequence) {
        setStemOptimizationError(error instanceof Error ? error.message : 'AI 题干优化失败，请稍后重试。');
      }
    } finally {
      if (stemOptimizationRequestRef.current === requestSequence) {
        setStemOptimizationBusy(false);
      }
    }
  }

  function updateQuestionStem(value) {
    updateQualityRelevantForm(
      (current) => ({ ...current, questionStem: value }),
      getQualityChecksForUiField('questionStem'),
    );
  }

  function locateQualityIssue(check) {
    qualityRepairEditCheckRef.current = check;
    const targetIds = getQualityIssueEditorTargetIds(check, {
      planReviewMode,
      rubricTargetId: rubricIssueTargetId(form, check),
    });
    window.dispatchEvent(new CustomEvent('question-quality-locate', { detail: { check } }));
    window.setTimeout(() => {
      const target = targetIds
        .filter(Boolean)
        .map((targetId) => document.getElementById(targetId))
        .find(Boolean);
      if (!target) {
        setNotice({ type: 'error', message: '暂未找到对应的修改位置，请刷新页面后重试。' });
        return;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
      window.setTimeout(() => {
        target.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2');
      }, 1800);
      if (typeof target.focus === 'function') {
        window.setTimeout(() => target.focus({ preventScroll: true }), 350);
      }
    }, check === 'difficultyCoherence' ? 80 : 0);
  }

  async function applyOptimizedStem() {
    if (!stemOptimization?.suggestedStem) return;
    const affectedChecks = [
      'materialGrounding',
      'observationClarity',
      'observationDistinctness',
      'rubricAlignment',
      'scopeClarity',
    ];
    const nextForm = {
      ...form,
      questionStem: stemOptimization.suggestedStem,
    };
    const nextProgress = buildModifiedQualityProgress(
      qualityRevisionProgress,
      affectedChecks,
    );
    setForm(nextForm);
    setQualityRevisionProgress(nextProgress);
    setQualityResultStale(true);
    setStemOptimization(null);
    await saveAndRecheckDraft(
      nextForm,
      nextProgress,
      'AI 题干建议已采用，并已基于修改后的内容重新检查。',
    );
  }

  async function optimizeRubricItem(itemIndex) {
    const material = selectedMaterial || context?.material;
    const rubricItem = form.rubric[itemIndex];
    const attemptCount = rubricOptimizationAttempts[rubricItem?.localId] || 0;
    if (attemptCount >= 2) {
      setRubricOptimization({
        itemId: rubricItem?.localId,
        result: null,
        error: '该评分项已完成 2 次受控优化。请按当前提示直接修改，避免继续生成相近内容。',
        busy: false,
      });
      return;
    }
    if (!material) {
      setRubricOptimization({
        itemId: rubricItem?.localId,
        result: null,
        error: '请先为题目关联学习材料。',
        busy: false,
      });
      return;
    }
    if (!rubricItem?.name?.trim()) {
      setRubricOptimization({
        itemId: rubricItem?.localId,
        result: null,
        error: '请先填写当前评分项的评分内容。',
        busy: false,
      });
      return;
    }

    const requestSequence = rubricOptimizationRequestRef.current + 1;
    rubricOptimizationRequestRef.current = requestSequence;
    setRubricOptimization({
      itemId: rubricItem.localId,
      result: null,
      error: '',
      busy: true,
    });
    setRubricOptimizationAttempts((current) => ({
      ...current,
      [rubricItem.localId]: (current[rubricItem.localId] || 0) + 1,
    }));
    try {
      const relevantWarnings = (context?.qualityAssessment?.warnings || [])
        .filter((warning) => ['discriminativePower', 'rubricAlignment'].includes(warning.check))
        .map((warning) => warning.message);
      const result = await requestRubricItemOptimization({
        requestId: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `rubric-item-${Date.now()}`,
        material: {
          materialVersionId: material.materialVersionId,
          title: material.title,
          content: material.content,
        },
        question: {
          questionStem: form.questionStem,
          observationFocus: form.title,
          abilityId: form.abilityId,
          difficulty: form.difficulty,
        },
        rubricItem: {
          localId: rubricItem.localId,
          name: rubricItem.name,
          abilityId: rubricItem.abilityId,
          importance: rubricItem.importance,
          required: rubricItem.required,
          acceptedSignals: commaValues(rubricItem.acceptedSignalsText),
          requireTextEvidence: rubricItem.requireTextEvidence,
          requireExplanation: rubricItem.requireExplanation,
        },
        siblingRubricItems: form.rubric
          .filter((_, index) => index !== itemIndex)
          .filter((item) => item.name?.trim())
          .map((item) => ({
            name: item.name,
            abilityId: item.abilityId,
            importance: item.importance,
            required: item.required,
            acceptedSignals: commaValues(item.acceptedSignalsText),
            requireTextEvidence: item.requireTextEvidence,
            requireExplanation: item.requireExplanation,
          })),
        qualityIssues: relevantWarnings,
      });
      if (rubricOptimizationRequestRef.current === requestSequence) {
        setRubricOptimization({
          itemId: rubricItem.localId,
          result,
          error: '',
          busy: false,
        });
      }
    } catch (error) {
      if (rubricOptimizationRequestRef.current === requestSequence) {
        const message = error instanceof Error ? error.message : 'AI 评分项优化失败，请稍后重试。';
        setRubricOptimization({
          itemId: rubricItem.localId,
          result: null,
          error: attemptCount + 1 >= 2
            ? `${message} 已完成 2 次受控优化，请直接人工修改本评分项。`
            : message,
          busy: false,
        });
      }
    }
  }

  async function applyOptimizedRubricItem(itemIndex) {
    const suggestion = rubricOptimization?.result?.suggestedItem;
    if (!suggestion) return;
    const affectedChecks = ['discriminativePower', 'rubricAlignment'];
    const nextForm = {
      ...form,
      rubric: form.rubric.map((item, index) => index === itemIndex
        ? {
          ...item,
          name: suggestion.name,
          importance: suggestion.importance,
          required: suggestion.required,
          acceptedSignalsText: suggestion.acceptedSignals.join('，'),
          requireTextEvidence: suggestion.requireTextEvidence,
          requireExplanation: suggestion.requireExplanation,
        }
        : item),
    };
    const nextProgress = buildModifiedQualityProgress(
      qualityRevisionProgress,
      affectedChecks,
    );
    setForm(nextForm);
    setQualityRevisionProgress(nextProgress);
    setQualityResultStale(true);
    setRubricOptimization(null);
    await saveAndRecheckDraft(
      nextForm,
      nextProgress,
      'AI 评分项建议已采用，并已基于修改后的内容重新检查。',
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
  const humanReviewStage = Boolean(
    planReviewMode &&
    context &&
    ['pending_review', 'reviewed'].includes(context.draft.status),
  );
  const resourceNavigator = (
    <ResourceNavigator
      snapshot={snapshot}
      selectedDraftId={selectedDraftId}
      busy={busy}
      onNew={startNewDraftWithConfirmation}
      onSelect={selectDraftWithConfirmation}
      onNextVersion={createNextVersion}
      onClear={clearWorkspace}
      onDiscardDraft={discardDraft}
      focusedReview={planReviewMode}
    />
  );
  const questionEditor = (
    <QuestionEditor
      form={form}
      setForm={updateQualityRelevantForm}
      editable={editable}
      busy={busy}
      context={context}
      materials={snapshot.materials}
      materialForm={materialForm}
      setMaterialForm={setMaterialForm}
      onCreateMaterial={createMaterial}
      onSave={saveDraft}
      onOptimizeStem={optimizeStem}
      onQuestionStemChange={updateQuestionStem}
      onApplyOptimizedStem={applyOptimizedStem}
      onDismissStemOptimization={() => {
        stemOptimizationRequestRef.current += 1;
        setStemOptimizationBusy(false);
        setStemOptimization(null);
        setStemOptimizationError('');
      }}
      stemOptimization={stemOptimization}
      stemOptimizationError={stemOptimizationError}
      stemOptimizationBusy={stemOptimizationBusy}
      stemOptimizationAttempts={stemOptimizationAttempts}
      rubricOptimization={rubricOptimization}
      rubricOptimizationAttempts={rubricOptimizationAttempts}
      onOptimizeRubricItem={optimizeRubricItem}
      onApplyOptimizedRubricItem={applyOptimizedRubricItem}
      onDismissRubricOptimization={() => {
        rubricOptimizationRequestRef.current += 1;
        setRubricOptimization(null);
      }}
      focusedReview={planReviewMode}
      selectedQuestionNumber={selectedQuestionIndex >= 0 ? String(selectedQuestionIndex + 1) : null}
      hasUnsavedChanges={hasUnsavedChanges}
      humanReviewStage={humanReviewStage}
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
      acceptedReviewWarningCodes={acceptedReviewWarningCodes}
      setAcceptedReviewWarningCodes={setAcceptedReviewWarningCodes}
      busy={busy}
      onValidate={validateDraft}
      onSubmitReview={submitReview}
      onReview={review}
      onFreeze={freezeDraft}
      onCreateRejectedRevision={createRejectedRevision}
      onRepairPublication={repairPublication}
      onLocateQualityIssue={locateQualityIssue}
      onOptimizeStem={optimizeStem}
      stemOptimizationBusy={stemOptimizationBusy}
      focusedReview={planReviewMode}
      qualityResultStale={qualityResultStale}
      qualityRevisionProgress={qualityRevisionProgress}
      hasUnsavedChanges={hasUnsavedChanges}
      publicationStatus={context ? draftDisplayStatus(snapshot, context.draft) : null}
      publicationMismatch={context ? getPublicationMismatch(snapshot, context.draft) : null}
      publicationPreflightMismatch={context ? getPublicationPreflightMismatch(context) : null}
      publicationRepairDraft={context ? findPublicationRepairDraft(snapshot, context.draft) : null}
      humanReviewStage={humanReviewStage}
    />
  );

  return (
    <div className={`question-resource-workbench min-h-screen ${planReviewMode ? 'bg-[#f6f8fb] text-slate-950' : 'bg-[#f5f7fb]'}`}>
      {pendingNavigation ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-navigation-title"
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 id="unsaved-navigation-title" className="text-lg font-semibold text-slate-950">
              当前题目有未保存修改
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              你将{pendingNavigation.destinationLabel}。请选择如何处理当前修改。
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNavigation(null)}
                disabled={busy}
                className="h-10 rounded-md border border-[#666666] px-4 text-sm font-medium text-slate-800 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={discardAndContinueNavigation}
                disabled={busy}
                className="h-10 rounded-md border border-[#666666] px-4 text-sm font-medium text-slate-800 disabled:opacity-50"
              >
                放弃修改并继续
              </button>
              <button
                type="button"
                onClick={saveAndContinueNavigation}
                disabled={busy}
                className="h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                保存后继续
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {planReviewMode ? (
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
          <div className="mx-auto flex min-h-16 max-w-[1360px] items-center justify-between px-5 md:px-8">
            <div className="flex items-center gap-3">
              <Link
                to={materialWorkbenchReturnPath}
                onClick={returnToMaterialWorkbench}
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
              onClick={refreshWorkspaceWithConfirmation}
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
        ? 'mx-auto w-full max-w-[1200px] px-5 py-7 md:px-8 md:py-9'
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
              ? new Set(snapshot.observationLinks
                .filter((link) => link.status === 'active')
                .map((link) => link.resourceVersionId)).size
              : snapshot.registryConsistency.passed ? '一致' : '需检查'}
            tone={planReviewMode || snapshot.registryConsistency.passed ? 'success' : 'warning'}
            aligned={planReviewMode}
          />
        </section>

        {notice ? <Notice notice={notice} /> : null}

        {planReviewMode ? (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
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

function ResourceNavigator({ snapshot, selectedDraftId, busy, onNew, onSelect, onNextVersion, onClear, onDiscardDraft, focusedReview }) {
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
          ? 'mb-1 border-b border-slate-200 px-2 pb-3 pt-2 text-base font-semibold text-slate-950'
          : 'px-2 py-2 text-xs font-semibold text-slate-500'}
        >
          {focusedReview ? '本批待审核题目' : 'DRAFT / REVIEW'}
        </p>
        {snapshot.drafts.length ? snapshot.drafts.map((draft, index) => {
          const hasFrozenVersion = snapshot.versions.some((version) => version.sourceDraftId === draft.draftId);
          const canDiscard = !hasFrozenVersion && ['drafted', 'validation_failed', 'pending_review', 'revision_required', 'rejected'].includes(draft.status);
          return (
          <div key={draft.draftId} className="relative mb-1">
            <button
              type="button"
              onClick={() => onSelect(draft.draftId)}
              className={`relative w-full rounded-md px-3 py-3 text-left transition-colors ${selectedDraftId === draft.draftId ? (focusedReview ? 'bg-emerald-50 text-emerald-800 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r before:bg-emerald-600' : 'bg-blue-50 text-blue-800') : 'hover:bg-slate-50'}`}
            >
            {focusedReview ? (
              <>
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0 text-sm font-semibold text-slate-950">题目{index + 1}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={draftDisplayStatus(snapshot, draft)} />
                    {canDiscard ? (
                      <span
                        role="button"
                        tabIndex={0}
                        title="删除这道草稿题目"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDiscardDraft(draft.draftId);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            onDiscardDraft(draft.draftId);
                          }
                        }}
                        className={`text-xs font-normal ${busy ? 'pointer-events-none text-slate-400' : 'text-red-600 hover:text-red-700'}`}
                      >
                        删除
                      </span>
                    ) : null}
                  </span>
                </span>
                <span
                  className={`mt-1 block text-xs leading-5 text-slate-600 ${selectedDraftId === draft.draftId ? '' : 'overflow-hidden'}`}
                  style={selectedDraftId === draft.draftId
                    ? undefined
                    : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}
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
          </div>
        )}) : <EmptyText>尚无 Draft</EmptyText>}
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
          className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md text-sm font-normal text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 size={15} /> 清除本地 Demo 数据
        </button>
      </div> : null}
    </aside>
  );
}

function SuggestionComparison({ label, content, details = [], tone = 'neutral' }) {
  const styles = {
    neutral: 'border-slate-200 bg-white',
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
  };
  return (
    <div className={`rounded-md border p-3 ${styles[tone] || styles.neutral}`}>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-900">{content}</p>
      {details.length ? (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <p className="text-xs text-slate-500">答案要点</p>
          <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-700">
            {details.map((detail) => <li key={detail}>• {detail}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function QuestionEditor({
  form,
  setForm,
  editable,
  busy,
  context,
  materials,
  materialForm,
  setMaterialForm,
  onCreateMaterial,
  onSave,
  onOptimizeStem,
  onQuestionStemChange,
  onApplyOptimizedStem,
  onDismissStemOptimization,
  stemOptimization,
  stemOptimizationError,
  stemOptimizationBusy,
  stemOptimizationAttempts,
  rubricOptimization,
  rubricOptimizationAttempts,
  onOptimizeRubricItem,
  onApplyOptimizedRubricItem,
  onDismissRubricOptimization,
  focusedReview,
  selectedQuestionNumber,
  hasUnsavedChanges,
  humanReviewStage,
}) {
  const update = (key, value) => setForm(
    (current) => ({ ...current, [key]: value }),
    getQualityChecksForUiField(key),
  );
  const objectiveQuestion = ['multiple_choice', 'true_false', 'fill_blank'].includes(form.questionType);
  const readingQuestion = form.questionType === 'reading_comprehension';
  const suggestionNeedsAttention = stemOptimization?.suggestionReview?.status === 'needs_attention';
  const remainingSuggestionIssues = stemOptimization?.suggestionReview?.remainingIssues || [];
  const resolvedSuggestionChecks = stemOptimization?.suggestionReview?.resolvedChecks || [];
  const canRetryStemOptimization = suggestionNeedsAttention && stemOptimizationAttempts < 2;
  const [showOptionalTrainingSettings, setShowOptionalTrainingSettings] = useState(false);
  const [showOptionalAnswerSettings, setShowOptionalAnswerSettings] = useState(false);
  const reviewMaterial = materials.find((material) => material.materialVersionId === form.materialVersionId) || null;
  const optionalTrainingSettingCount = [
    form.supportingAbilityIdsText,
    form.prerequisiteAbilityIdsText,
    form.gradeRange,
    form.tagsText,
  ].filter((value) => String(value || '').trim()).length;
  const optionalAnswerSettingCount = [
    !objectiveQuestion && form.acceptedAnswersText,
    form.acceptedKeywordsText,
    form.semanticEquivalentAllowed ? 'configured' : '',
  ].filter((value) => String(value || '').trim()).length;
  const authoringResponsibilityIssues = useMemo(
    () => assessAuthoringFieldResponsibilities({
      abilityTarget: form.abilityId,
      specificTrainingPoint: form.specificTrainingPoint,
      questionStem: form.questionStem,
      studentTask: form.studentTask,
      observationTarget: form.observationTarget,
    }),
    [
      form.abilityId,
      form.specificTrainingPoint,
      form.questionStem,
      form.studentTask,
      form.observationTarget,
    ],
  );
  const updateRubric = (index, key, value) => setForm(
    (current) => ({
      ...current,
      rubric: current.rubric.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }),
    ['discriminativePower', 'rubricAlignment'],
  );
  const focusQuestionStem = () => {
    document.getElementById('question-stem-editor')?.focus();
  };
  useEffect(() => {
    setShowOptionalTrainingSettings(false);
    setShowOptionalAnswerSettings(false);
  }, [context?.draft?.draftId]);

  if (humanReviewStage) {
    return (
      <QuestionReviewContent
        context={context}
        form={form}
        material={reviewMaterial}
        selectedQuestionNumber={selectedQuestionNumber}
      />
    );
  }

  return (
    <section className={`rounded-md bg-white ${focusedReview ? '[&_input:focus]:border-emerald-500 [&_select:focus]:border-emerald-500 [&_textarea:focus]:border-emerald-500' : 'border border-slate-200'}`}>
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
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
      </div>

      <fieldset disabled={!editable || busy} className="space-y-6 p-4 disabled:opacity-70 sm:p-5">
        {focusedReview ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
            “保存本次修改”只更新当前草稿，不会自动提交或发布；如已有正式版本，系统会保留原版本，不会直接覆盖。
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
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">
                题干<span className="ml-0.5 text-rose-600" aria-label="必填">*</span>
              </span>
              <button
                type="button"
                disabled={
                  busy ||
                  stemOptimizationBusy ||
                  !editable ||
                  !form.questionStem.trim() ||
                  !form.materialVersionId
                }
                onClick={() => onOptimizeStem()}
                className="ai-button-outline min-h-9 rounded-md border px-3 text-sm font-normal disabled:cursor-not-allowed"
              >
                {stemOptimizationBusy ? '正在优化题干…' : 'AI 优化题干'}
              </button>
            </div>
            <AutoGrowTextarea
              id="question-stem-editor"
              value={form.questionStem}
              onChange={(event) => onQuestionStemChange(event.target.value)}
              rows={4}
              placeholder="输入学生实际看到的题目要求"
              disabled={stemOptimizationBusy}
            />
            {!form.materialVersionId ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">关联学习材料后，AI 才能依据原文优化题干。</p>
            ) : null}
            {stemOptimizationError ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                {stemOptimizationError}
              </p>
            ) : null}
            {stemOptimization ? (
              <section className={`mt-3 rounded-md border p-4 ${
                suggestionNeedsAttention
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-emerald-200 bg-emerald-50/60'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950">AI 题干建议</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-normal ${
                    suggestionNeedsAttention
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {suggestionNeedsAttention ? '仍有问题未解决' : '针对性预检查通过'}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <SuggestionComparison
                    label="修改前"
                    content={stemOptimization.originalStem}
                    tone="neutral"
                  />
                  <SuggestionComparison
                    label="AI 建议"
                    content={stemOptimization.suggestedStem}
                    tone={suggestionNeedsAttention ? 'warning' : 'success'}
                  />
                </div>
                <div className="mt-3 text-xs leading-5 text-slate-600">
                  <p>{stemOptimization.rationale}</p>
                  {stemOptimization.changes.length ? (
                    <p className="mt-1">本次调整：{stemOptimization.changes.join('；')}</p>
                  ) : null}
                </div>
                {resolvedSuggestionChecks.length ? (
                  <div className="mt-3 rounded-md bg-emerald-100/70 px-3 py-2 text-xs leading-5 text-emerald-900">
                    <p className="font-semibold">本次建议已解决</p>
                    <p>{resolvedSuggestionChecks.map((check) => qualityCheckLabel(check, false)).join('；')}</p>
                  </div>
                ) : null}
                {remainingSuggestionIssues.length ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-900">仍需继续处理</p>
                    {remainingSuggestionIssues.map((issue) => (
                      <div key={issue.check} className="rounded-md bg-amber-100/70 px-3 py-2 text-xs leading-5 text-amber-900">
                        <p className="font-semibold">{qualityCheckLabel(issue.check, false)}</p>
                        <p>{issue.message}</p>
                        <p className="mt-1">修改位置与方法：{issue.recommendedAction}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className={`mt-3 rounded-md px-3 py-2 text-xs leading-5 ${
                  suggestionNeedsAttention
                    ? 'bg-white/70 text-amber-900'
                    : 'bg-emerald-100/70 text-emerald-900'
                }`}>
                  {suggestionNeedsAttention
                    ? stemOptimizationAttempts >= 2
                      ? '已完成 2 次受控优化。建议转到题干手动修改，或保留原题干；不要为了消除提醒而采用没有实质改善的建议。'
                      : '系统会针对剩余提醒再优化 1 次。局部预检查不代表整题通过。'
                    : '这只表示本次指定问题已解决，不代表整题通过。采用后系统会自动保存，并基于新内容重新检查整题。'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!suggestionNeedsAttention ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onApplyOptimizedStem}
                      className="min-h-9 rounded-md bg-emerald-600 px-4 text-sm font-normal text-white hover:bg-emerald-700 disabled:bg-slate-300"
                    >
                      {busy ? '正在保存并检查…' : '采用并重新检查'}
                    </button>
                  ) : null}
                  {canRetryStemOptimization ? (
                    <button
                      type="button"
                      onClick={() => onOptimizeStem(remainingSuggestionIssues.map((issue) => issue.check))}
                      className="min-h-9 rounded-md bg-emerald-600 px-4 text-sm font-normal text-white hover:bg-emerald-700"
                    >
                      针对提醒再次优化
                    </button>
                  ) : null}
                  {suggestionNeedsAttention ? (
                    <button
                      type="button"
                      onClick={focusQuestionStem}
                      className="min-h-9 rounded-md border border-emerald-600 bg-white px-4 text-sm font-normal text-emerald-700 hover:bg-emerald-50"
                    >
                      转到题干手动修改
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onDismissStemOptimization}
                    className="min-h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-600 hover:bg-slate-50"
                  >
                    保留原题干
                  </button>
                </div>
              </section>
            ) : null}
          </div>
          {form.questionType === 'multiple_choice' ? (
            <Field label="选项（每行一项）" required requirement="当前题型必填">
              <AutoGrowTextarea value={form.optionsText} onChange={(event) => update('optionsText', event.target.value)} rows={4} />
            </Field>
          ) : null}
        </EditorGroup>

        <EditorGroup title={focusedReview ? '关联材料' : '学习材料'}>
          {focusedReview ? (
            <div className="flex min-h-11 items-center rounded-md bg-slate-50 px-3 text-sm text-slate-700">
              {reviewMaterial
                ? <><span className="font-semibold text-slate-950">{reviewMaterial.title}</span><span className="ml-2 text-slate-500">版本 {reviewMaterial.versionNumber}</span></>
                : <span className="text-slate-500">未关联学习材料</span>}
            </div>
          ) : (
            <>
              <Field label="引用已有材料" required={readingQuestion} requirement={readingQuestion ? '当前题型必填' : undefined}>
                <SelectInput
                  value={form.materialVersionId}
                  onChange={(value) => update('materialVersionId', value)}
                  options={[
                    ['', '不引用学习材料'],
                    ...materials.map((material) => [material.materialVersionId, `${material.title} · v${material.versionNumber}`]),
                  ]}
                />
              </Field>
              <details className="rounded-md bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm text-slate-700">新建学习材料</summary>
                <div className="mt-3 space-y-3">
                  <Field label="材料标题" required><input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} className={inputClass} /></Field>
                  <Field label="阅读材料正文" required><AutoGrowTextarea value={materialForm.content} onChange={(event) => setMaterialForm({ ...materialForm, content: event.target.value })} rows={5} /></Field>
                  <Field label="来源说明" required><input value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} className={inputClass} /></Field>
                  <Field label="版权或使用说明" requirement="可选"><input value={materialForm.copyrightNote} onChange={(event) => setMaterialForm({ ...materialForm, copyrightNote: event.target.value })} className={inputClass} /></Field>
                  <button type="button" onClick={onCreateMaterial} className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-700">创建学习材料</button>
                </div>
              </details>
            </>
          )}
        </EditorGroup>

        <div id="question-training-targets" tabIndex="-1" className="scroll-mt-24 outline-none">
        <EditorGroup title={focusedReview ? '训练目标' : '训练设置'}>
          {focusedReview ? (
            <div>
              <div className="flex min-h-11 flex-wrap items-center gap-2" aria-label="由素材录入平台带入的训练目标">
                <span className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  {optionLabel(abilityOptions, form.abilityId)}
                </span>
                <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
                  {optionLabel(taskRoleOptions, form.taskRole)}
                </span>
                <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
                  {optionLabel(difficultyOptions, form.difficulty)}
                </span>
                <span className="text-sm text-slate-500">由素材录入平台带入</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                训练能力、任务用途和难度以素材录入平台中的训练计划为准，审核平台不会重复修改。
              </p>
              {authoringResponsibilityIssues.length ? (
                <div className="mt-3 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div>
                    <p className="font-semibold">字段职责需要人工确认</p>
                    <p className="mt-1 leading-6">
                      以下内容可能只是换词重复。该提醒不会阻止审核，但建议确认每个字段分别表达“训练落点、学生问题、作答动作和可观察表现”。
                    </p>
                  </div>
                  {authoringResponsibilityIssues.map((issue) => {
                    const questionStemTarget = issue.editorTargetIds.includes('question-stem-editor');
                    return (
                      <div key={issue.fields.join(':')} className="border-t border-amber-200 pt-3">
                        <p className="font-semibold">{issue.message}</p>
                        <p className="mt-1 leading-6">{issue.suggestion}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {questionStemTarget ? (
                            <button
                              type="button"
                              onClick={focusQuestionStem}
                              className="min-h-8 rounded-md border border-amber-500 bg-white px-3 text-sm font-normal text-amber-800 hover:bg-amber-100"
                            >
                              定位题干
                            </button>
                          ) : null}
                          <span className="text-xs leading-5 text-amber-800">
                            具体训练点、学生任务或观察目标需返回素材录入平台调整。
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {Object.values(context?.authoringFieldProvenance || {}).some(
                (item) => item.needsHumanReview,
              ) ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                  部分训练字段由旧数据自动适配，尚未找到对应训练计划，请在提交前返回素材录入平台确认。
                </p>
              ) : null}
            </div>
          ) : null}
          {!focusedReview ? (
            <div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="主要能力" required>
                  <SelectInput value={form.abilityId} onChange={(value) => updateAbility(value, setForm)} options={abilityOptions} />
                </Field>
                <Field label="任务角色" required>
                  <SelectInput value={form.taskRole} onChange={(value) => update('taskRole', value)} options={taskRoleOptions} />
                </Field>
                <div id="question-difficulty-editor" tabIndex="-1" className="scroll-mt-24 rounded-md outline-none">
                  <Field label="难度" required>
                    <SelectInput value={form.difficulty} onChange={(value) => update('difficulty', value)} options={difficultyOptions} />
                  </Field>
                </div>
              </div>
            </div>
          ) : null}
          <details open={showOptionalTrainingSettings}>
            <summary
              className="cursor-pointer text-sm font-normal text-slate-700"
              onClick={(event) => {
                event.preventDefault();
                setShowOptionalTrainingSettings((value) => !value);
              }}
            >
              更多训练设置（非必填）
              {optionalTrainingSettingCount ? (
                <span className="ml-2 text-slate-500">已填写 {optionalTrainingSettingCount} 项</span>
              ) : null}
            </summary>
            <div className="mt-4 space-y-4">
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
            </div>
          </details>
        </EditorGroup>
        </div>

        <EditorGroup title="作答判定">
          <Field label="评价模式" required>
            <SelectInput value={form.assessmentMode} onChange={(value) => update('assessmentMode', value)} options={assessmentModeOptions} aligned={focusedReview} />
          </Field>
          {objectiveQuestion ? (
            <Field label="可接受答案（每行一项）" required requirement="当前题型必填">
              <AutoGrowTextarea value={form.acceptedAnswersText} onChange={(event) => update('acceptedAnswersText', event.target.value)} rows={3} />
            </Field>
          ) : null}
          <details open={showOptionalAnswerSettings}>
            <summary
              className="cursor-pointer text-sm font-normal text-slate-700"
              onClick={(event) => {
                event.preventDefault();
                setShowOptionalAnswerSettings((value) => !value);
              }}
            >
              更多作答判定设置（非必填）
              {optionalAnswerSettingCount ? (
                <span className="ml-2 text-slate-500">已配置 {optionalAnswerSettingCount} 项</span>
              ) : null}
            </summary>
            <div className="mt-4 space-y-4">
              <div className={`grid gap-4 ${objectiveQuestion ? '' : 'sm:grid-cols-2'}`}>
                {!objectiveQuestion ? (
                  <Field label="可接受答案（每行一项）">
                    <AutoGrowTextarea value={form.acceptedAnswersText} onChange={(event) => update('acceptedAnswersText', event.target.value)} rows={3} />
                  </Field>
                ) : null}
                <Field label="可接受关键词（每行一项）">
                  <AutoGrowTextarea value={form.acceptedKeywordsText} onChange={(event) => update('acceptedKeywordsText', event.target.value)} rows={3} />
                </Field>
              </div>
              <Checkbox label="允许语义等价表达" checked={form.semanticEquivalentAllowed} onChange={(value) => update('semanticEquivalentAllowed', value)} />
            </div>
          </details>
        </EditorGroup>

        <div id="question-rubric-editor" tabIndex="-1" className="scroll-mt-24 outline-none">
        <EditorGroup title="评分标准">
          <div className="rounded-md bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            <p>把题目拆成 2 至 3 个可以分别判断的评分要求，每个评分项只判断一件事。</p>
            <p className="mt-1 text-slate-500">例如：关键内容是否完整、顺序是否正确、是否有材料依据。</p>
          </div>
          <div className="space-y-3">
            {form.rubric.map((item, index) => (
              <div
                key={item.localId}
                id={`question-rubric-item-${item.localId}`}
                tabIndex="-1"
                className="scroll-mt-24 rounded-md border border-slate-200 p-3 outline-none"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{`评分项${toChineseNumber(index + 1)}`}</p>
                    <p className="mt-1 text-xs text-slate-500">这一项只判断一个明确的作答要求。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(rubricOptimizationAttempts[item.localId] || 0) > 0 ? (
                      <span className="text-xs text-slate-500">
                        AI 尝试 {rubricOptimizationAttempts[item.localId]}/2
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={
                        busy ||
                        rubricOptimization?.busy ||
                        (rubricOptimizationAttempts[item.localId] || 0) >= 2
                      }
                      onClick={() => onOptimizeRubricItem(index)}
                      className="ai-button-outline min-h-9 rounded-md border px-4 text-sm font-normal disabled:cursor-not-allowed"
                    >
                      {rubricOptimization?.itemId === item.localId && rubricOptimization.busy
                        ? '正在优化本项…'
                        : (rubricOptimizationAttempts[item.localId] || 0) >= 2
                          ? '请人工修改'
                          : 'AI 优化本项'}
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="评分内容（这一项判断什么）" required>
                    <input
                      value={item.name}
                      onChange={(event) => updateRubric(index, 'name', event.target.value)}
                      className={inputClass}
                      placeholder="例如：关键步骤完整"
                    />
                  </Field>
                  <Field label="对应能力" required><SelectInput value={item.abilityId} onChange={(value) => updateRubric(index, 'abilityId', value)} options={abilityOptions} aligned={focusedReview} /></Field>
                  <Field label="判定作用" required>
                    <SelectInput value={item.importance} onChange={(value) => updateRubric(index, 'importance', value)} options={rubricImportanceOptions} aligned={focusedReview} />
                  </Field>
                  <Field label="满足本项的答案要点（逗号分隔）">
                    <AutoGrowTextarea
                      value={item.acceptedSignalsText}
                      onChange={(event) => updateRubric(index, 'acceptedSignalsText', event.target.value)}
                      rows={2}
                      placeholder="例如：先设骗局，再索要钱财，假装织布"
                    />
                  </Field>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-medium text-slate-900">本评分项的判定条件</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">勾选后，学生的完整回答必须满足对应条件。</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <Checkbox label="必须达到本评分项" checked={item.required} onChange={(value) => updateRubric(index, 'required', value)} />
                    <Checkbox label="必须引用材料内容" checked={item.requireTextEvidence} onChange={(value) => updateRubric(index, 'requireTextEvidence', value)} />
                    <Checkbox label="必须说明理由或过程" checked={item.requireExplanation} onChange={(value) => updateRubric(index, 'requireExplanation', value)} />
                    {form.rubric.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setForm(
                          (current) => ({
                            ...current,
                            rubric: current.rubric.filter((_, itemIndex) => itemIndex !== index),
                          }),
                          ['discriminativePower', 'rubricAlignment'],
                        )}
                        className="ml-auto text-sm text-red-600 hover:text-red-700"
                      >
                        删除
                      </button>
                    ) : null}
                  </div>
                </div>
                {rubricOptimization?.itemId === item.localId && rubricOptimization.error ? (
                  <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                    {rubricOptimization.error}
                  </p>
                ) : null}
                {rubricOptimization?.itemId === item.localId && rubricOptimization.result ? (
                  <section className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-emerald-900">AI 优化建议</p>
                      <span className="text-xs text-emerald-800">
                        {optionLabel(rubricImportanceOptions, rubricOptimization.result.suggestedItem.importance)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <SuggestionComparison
                        label="修改前"
                        content={rubricOptimization.result.originalItem.name}
                        details={rubricOptimization.result.originalItem.acceptedSignals}
                        tone="neutral"
                      />
                      <SuggestionComparison
                        label="AI 建议"
                        content={rubricOptimization.result.suggestedItem.name}
                        details={rubricOptimization.result.suggestedItem.acceptedSignals}
                        tone="success"
                      />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      判定条件：{[
                        rubricOptimization.result.suggestedItem.required && '完整作答必须达到本项',
                        rubricOptimization.result.suggestedItem.requireTextEvidence && '必须引用材料内容',
                        rubricOptimization.result.suggestedItem.requireExplanation && '必须说明理由或过程',
                      ].filter(Boolean).join('；') || '无额外要求'}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {rubricOptimization.result.rationale}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      本次调整：{rubricOptimization.result.changes.join('；')}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onApplyOptimizedRubricItem(index)}
                        className="min-h-9 rounded-md bg-emerald-600 px-4 text-sm font-normal text-white hover:bg-emerald-700 disabled:bg-slate-300"
                      >
                        {busy ? '正在保存并检查…' : '采用并重新检查'}
                      </button>
                      <button
                        type="button"
                        onClick={onDismissRubricOptimization}
                        className="min-h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-600 hover:bg-slate-50"
                      >
                        保留原评分项
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      采用后会保存当前题并重新执行系统检查，不会自动提交人工审核或发布。
                    </p>
                  </section>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm(
              (current) => ({
                ...current,
                rubric: [...current.rubric, createRubricItem(current.abilityId)],
              }),
              ['discriminativePower', 'rubricAlignment'],
            )}
            className="mx-auto flex h-10 w-[240px] items-center justify-center gap-2 rounded-md border border-emerald-600 bg-white px-4 text-sm font-normal text-emerald-700 hover:bg-slate-50"
          >
            <Plus size={18} aria-hidden="true" />
            添加评分项
          </button>
        </EditorGroup>
        </div>

        <EditorGroup title="最低作答与来源">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="最低字数" required><input type="number" min="1" value={form.minLength} onChange={(event) => update('minLength', event.target.value)} className={inputClass} /></Field>
            <Field label="来源类型" required><SelectInput value={form.sourceType} onChange={(value) => update('sourceType', value)} options={sourceTypeOptions} aligned={focusedReview} /></Field>
            <Field label="来源说明" required><input value={form.sourceDescription} onChange={(event) => update('sourceDescription', event.target.value)} className={inputClass} /></Field>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">最低作答条件</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">勾选后，未满足条件的回答将被视为未达到最低作答要求。</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <Checkbox label="回答必须有材料依据" checked={form.requireTextEvidence} onChange={(value) => update('requireTextEvidence', value)} />
              <Checkbox label="回答必须包含解释" checked={form.requireExplanation} onChange={(value) => update('requireExplanation', value)} />
            </div>
          </div>
          <Field label="版权或使用说明" requirement="建议填写"><input value={form.copyrightNote} onChange={(event) => update('copyrightNote', event.target.value)} className={inputClass} /></Field>
        </EditorGroup>

        <button
          type="button"
          disabled={busy || !editable || !hasUnsavedChanges}
          onClick={onSave}
          className={`mx-auto flex min-h-11 w-[240px] items-center justify-center rounded-md px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400 ${focusedReview ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-950 hover:bg-slate-800'}`}
        >
          {hasUnsavedChanges ? (focusedReview ? '保存本次修改' : '保存草稿') : '当前内容已保存'}
        </button>
      </fieldset>
    </section>
  );
}

function WorkflowPanel(props) {
  const { activePanel, setActivePanel, context, form, material, previewResource, reviewNotes, setReviewNotes, acceptedReviewWarningCodes, setAcceptedReviewWarningCodes, busy, onValidate, onSubmitReview, onReview, onFreeze, onCreateRejectedRevision, onRepairPublication, onLocateQualityIssue, onOptimizeStem, stemOptimizationBusy, focusedReview, qualityResultStale, qualityRevisionProgress, hasUnsavedChanges, publicationStatus, publicationMismatch, publicationPreflightMismatch, publicationRepairDraft, humanReviewStage } = props;
  const panelLabels = humanReviewStage
    ? [['workflow', '内容审核'], ['student', '学生预览'], ['review', '审核记录']]
    : [['workflow', '校验 / 审核'], ['student', '学生预览'], ['review', '审核预览']];
  return (
    <aside className={`overflow-hidden rounded-md bg-white ${focusedReview ? '' : 'border border-slate-200 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-24'}`}>
      <div className="grid grid-cols-3 gap-2 p-2">
        {panelLabels.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setActivePanel(value)} className={`min-h-10 rounded text-sm font-normal ${activePanel === value ? (focusedReview ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white') : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>

      <div className={focusedReview ? 'p-5' : 'max-h-[calc(100vh-155px)] overflow-auto p-4'}>
        {activePanel === 'workflow' ? (
          <WorkflowActions
            context={context}
            form={form}
            material={material}
            reviewNotes={reviewNotes}
            setReviewNotes={setReviewNotes}
            acceptedReviewWarningCodes={acceptedReviewWarningCodes}
            setAcceptedReviewWarningCodes={setAcceptedReviewWarningCodes}
            busy={busy}
            onValidate={onValidate}
            onSubmitReview={onSubmitReview}
            onReview={onReview}
            onFreeze={onFreeze}
            onCreateRejectedRevision={onCreateRejectedRevision}
            onRepairPublication={onRepairPublication}
            onLocateQualityIssue={onLocateQualityIssue}
            onOptimizeStem={onOptimizeStem}
            stemOptimizationBusy={stemOptimizationBusy}
            qualityResultStale={qualityResultStale}
            qualityRevisionProgress={qualityRevisionProgress}
            hasUnsavedChanges={hasUnsavedChanges}
            publicationStatus={publicationStatus}
            publicationMismatch={publicationMismatch}
            publicationPreflightMismatch={publicationPreflightMismatch}
            publicationRepairDraft={publicationRepairDraft}
            focusedReview={focusedReview}
            humanReviewStage={humanReviewStage}
          />
        ) : null}
        {activePanel === 'student' ? <StudentPreview resource={previewResource} material={material} isFrozen={Boolean(context?.frozenVersion)} /> : null}
        {activePanel === 'review' ? <ReviewPreview context={context} form={form} material={material} qualityResultStale={qualityResultStale} qualityRevisionProgress={qualityRevisionProgress} humanReviewStage={humanReviewStage} /> : null}
      </div>
    </aside>
  );
}

function QuestionReviewContent({ context, form, material, selectedQuestionNumber }) {
  const draft = context?.draft;
  return (
    <section className="rounded-md bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              题目{selectedQuestionNumber || ''} · 内容审核
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              第 {draft?.revision || 1} 版 · 正式字段只读
            </p>
          </div>
          <StatusBadge status={draft?.status || 'pending_review'} />
        </div>
      </div>
      <div className="space-y-6 p-5">
        <ReviewContentSection title="题目内容">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-900">
            {form.questionStem || '尚未填写题目'}
          </p>
        </ReviewContentSection>
        <div className="grid gap-5 md:grid-cols-2">
          <ReviewContentSection title="训练目标">
            <ReviewValue label="能力目标" value={optionLabel(abilityOptions, form.abilityId)} />
            <ReviewValue label="具体训练点" value={form.specificTrainingPoint || '未填写'} />
            <ReviewValue label="观察目标" value={form.observationTarget || '未填写'} />
          </ReviewContentSection>
          <ReviewContentSection title="作答要求">
            <ReviewValue label="学生任务" value={form.studentTask || '未填写'} />
            <ReviewValue label="难度" value={optionLabel(difficultyOptions, form.difficulty)} />
            <ReviewValue label="最低字数" value={`${form.minLength || 0} 字`} />
          </ReviewContentSection>
        </div>
        <ReviewContentSection title="评分规则">
          <div className="space-y-3">
            {form.rubric?.map((item, index) => (
              <div key={item.localId || `${item.name}-${index}`} className="rounded-md bg-slate-50 px-3 py-3">
                <p className="text-sm font-semibold text-slate-900">评分项{index + 1} · {item.name || '未命名'}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {item.acceptedSignalsText || '尚未填写答案要点'}
                </p>
              </div>
            ))}
          </div>
        </ReviewContentSection>
        {material ? (
          <ReviewContentSection title="关联材料">
            <p className="text-sm font-semibold text-slate-900">{formatMaterialTitle(material.title)}</p>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {material.content}
            </p>
          </ReviewContentSection>
        ) : null}
      </div>
    </section>
  );
}

function ReviewContentSection({ title, children }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ReviewValue({ label, value }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function ReviewSubmissionSummary({ context, acceptedWarningCodes, setAcceptedWarningCodes }) {
  const assessment = context?.qualityAssessment;
  const semanticAssessment = context?.semanticQualityAssessment;
  const qualityBundle = context?.qualityAssessmentBundle;
  const warnings = assessment?.warnings || [];
  const locked = context?.draft?.status === 'reviewed';
  const passedCount = assessment
    ? Object.values(assessment.checks).filter((status) => status === 'pass').length
    : 0;
  const toggleWarning = (warningCode) => {
    setAcceptedWarningCodes((current) => (
      current.includes(warningCode)
        ? current.filter((code) => code !== warningCode)
        : [...current, warningCode]
    ));
  };
  return (
    <section className="rounded-md bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">提交信息</p>
          <p className="mt-1 text-xs text-slate-500">
            第 {context?.draft?.revision || 1} 版 · 录入检查已完成
          </p>
        </div>
        <span className="text-xs text-slate-600">
          {passedCount} 项通过 · {warnings.length} 项提醒 · 0 项阻断
        </span>
      </div>
      {qualityBundle ? (
        <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-xs sm:grid-cols-3">
          <div>
            <p className="text-slate-500">确定性检查</p>
            <p className="mt-1 font-medium text-slate-800">
              {qualityBundle.deterministicRuleVersion}
            </p>
          </div>
          <div>
            <p className="text-slate-500">独立语义评估</p>
            <p className={`mt-1 font-medium ${
              semanticAssessment?.status === 'completed'
                ? 'text-emerald-700'
                : 'text-red-700'
            }`}>
              {semanticAssessment?.status === 'completed'
                ? '已完成'
                : '服务不可用，不能审核通过'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">质量包</p>
            <p className="mt-1 font-medium text-slate-800">
              {qualityBundle.decision}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 border-t border-slate-200 pt-4 text-xs text-amber-700">
          尚未形成当前修订版的完整质量包，请重新执行检查。
        </p>
      )}
      {warnings.length ? (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-950">待确认事项（{warnings.length}）</p>
          <div className="mt-3 space-y-3">
            {warnings.map((warning) => {
              const accepted = acceptedWarningCodes.includes(warning.code);
              return (
                <div key={`${warning.code}-${warning.check}`} className="rounded-md bg-white p-3">
                  <p className="text-sm font-semibold text-amber-800">
                    {qualityCheckLabel(warning.check, false)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    系统依据：{qualityWarningMessage(warning)}
                  </p>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => toggleWarning(warning.code)}
                    className={`mt-3 min-h-8 rounded-md px-3 text-xs font-normal ${
                      accepted
                        ? 'bg-blue-600 text-white'
                        : 'border border-[#666666] text-slate-800'
                    } disabled:cursor-default`}
                  >
                    {accepted ? '已接受该处理' : '接受该处理'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            所有待确认事项形成审核决定后，才可审核通过；如不接受，请退回修改。
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-emerald-700">录入检查没有需要审核人额外确认的提醒。</p>
      )}
    </section>
  );
}

function WorkflowActions({ context, form, material, reviewNotes, setReviewNotes, acceptedReviewWarningCodes, setAcceptedReviewWarningCodes, busy, onValidate, onSubmitReview, onReview, onFreeze, onCreateRejectedRevision, onRepairPublication, onLocateQualityIssue, onOptimizeStem, stemOptimizationBusy, qualityResultStale, qualityRevisionProgress, hasUnsavedChanges, publicationStatus, publicationMismatch, publicationPreflightMismatch, publicationRepairDraft, focusedReview, humanReviewStage }) {
  if (!context) return <EmptyText>先保存 Draft，再执行正式校验与审核。</EmptyText>;
  const {
    draft,
    validation,
    qualityAssessment,
    semanticQualityAssessment,
    qualityAssessmentBundle,
    versionHistory,
  } = context;
  const hasFrozenVersion = versionHistory.some((version) => version.sourceDraftId === draft.draftId);
  const isPublished = publicationStatus === 'published';
  const publicationIncomplete = publicationStatus === 'publication_incomplete';
  const publicationBlocked = (
    !hasFrozenVersion &&
    draft.status === 'reviewed' &&
    publicationPreflightMismatch &&
    !publicationPreflightMismatch.passed
  );
  const hasCurrentPassedValidation = Boolean(
    validation?.passed &&
    validation.validatedDraftRevision === draft.revision &&
    draft.status !== 'revision_required',
  );
  const completedStep = isPublished
    ? 4
    : draft.status === 'reviewed'
      ? 3
      : ['pending_review', 'rejected'].includes(draft.status)
        ? 2
        : draft.status === 'drafted' && hasCurrentPassedValidation
          ? 1
          : 0;
  const currentStep = hasFrozenVersion || draft.status === 'rejected'
    ? null
    : draft.status === 'reviewed'
      ? 4
      : draft.status === 'pending_review'
        ? 3
        : draft.status === 'drafted' && hasCurrentPassedValidation
          ? 2
          : 1;
  const validationActionLabel = hasUnsavedChanges
    ? '保存并检查题目'
    : validation
      ? '重新检查题目'
      : '检查当前题目';
  const awaitingIssueRecheck = Boolean(
    qualityResultStale ||
    (
      qualityRevisionProgress?.items.some((item) => item.status === 'modified_pending_recheck') &&
      qualityAssessment?.assessedDraftRevision !== draft.revision
    ),
  );
  const acceptedAllReviewWarnings = Boolean(
    qualityAssessment?.warnings.every(
      (warning) => acceptedReviewWarningCodes.includes(warning.code),
    ),
  );
  const semanticQualityUnavailable = Boolean(
    qualityAssessmentBundle?.decision === 'semantic_unavailable' ||
    (
      semanticQualityAssessment &&
      semanticQualityAssessment.status !== 'completed'
    ),
  );
  const recoverablePublicationFailure = Boolean(
    publicationIncomplete &&
    hasFrozenVersion &&
    !publicationMismatch?.differences.length,
  );
  const publicationReadiness = [
    { label: '当前内容已保存', passed: !hasUnsavedChanges },
    {
      label: '结构与质量检查对应当前版本',
      passed: hasCurrentPassedValidation && !awaitingIssueRecheck,
    },
    {
      label: '已完成人工审核',
      passed: ['reviewed', 'published'].includes(draft.status) || hasFrozenVersion,
    },
    {
      label: '题目设置与训练计划一致',
      passed: !publicationPreflightMismatch || publicationPreflightMismatch.passed,
    },
  ];
  const publicationReadyCount = publicationReadiness.filter((item) => item.passed).length;
  const canPublish = publicationReadiness.every((item) => item.passed);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-950">当前状态：</span>
          {isPublished ? (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm font-normal text-emerald-700">
              已发布
            </span>
          ) : publicationBlocked ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-sm font-normal text-amber-700">
              发布前设置待调整
            </span>
          ) : publicationIncomplete ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-sm font-normal text-amber-700">
              审核已通过，发布未完成
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
      </div>

      {!humanReviewStage && (hasCurrentPassedValidation || awaitingIssueRecheck) ? (
        <QuestionQualitySummary
          assessment={qualityAssessment}
          form={form}
          material={material}
          stale={awaitingIssueRecheck}
          revisionProgress={qualityRevisionProgress}
          onLocate={onLocateQualityIssue}
          onOptimizeStem={onOptimizeStem}
          optimizationBusy={stemOptimizationBusy}
        />
      ) : null}

      {humanReviewStage ? (
        <ReviewSubmissionSummary
          context={context}
          acceptedWarningCodes={acceptedReviewWarningCodes}
          setAcceptedWarningCodes={setAcceptedReviewWarningCodes}
        />
      ) : null}

      {(currentStep === 4 || publicationBlocked || publicationIncomplete) ? (
        <section className={`rounded-md px-4 py-3 ${
          canPublish ? 'bg-emerald-50' : 'bg-amber-50'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-950">发布准备</p>
            <span className={`text-xs font-semibold ${
              canPublish ? 'text-emerald-700' : 'text-amber-800'
            }`}>
              {publicationReadyCount}/{publicationReadiness.length} 项完成
            </span>
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {publicationReadiness.map((item) => (
              <li
                key={item.label}
                className={`flex items-center gap-2 text-xs ${
                  item.passed ? 'text-emerald-800' : 'font-semibold text-amber-900'
                }`}
              >
                {item.passed
                  ? <CheckCircle2 size={15} className="shrink-0" />
                  : <AlertTriangle size={15} className="shrink-0" />}
                {item.label}
              </li>
            ))}
          </ul>
          {!canPublish ? (
            <p className="mt-2 text-xs leading-5 text-amber-800">
              未完成项会阻止发布。请按本区域下方的解决方法处理，无需点击发布后再确认。
            </p>
          ) : null}
        </section>
      ) : null}

      {publicationIncomplete ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {recoverablePublicationFailure ? (
            <>
              <p className="font-semibold">审核已通过，发布未完成</p>
              <p className="mt-1">
                正式题目版本已经生成，但资源登记尚未全部完成。重试会沿用现有正式版本，不会重复审核或创建新版本。
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={onFreeze}
                className="mt-3 inline-flex min-h-9 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-normal text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
              >
                重试补齐发布关联
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold">该题尚未完成发布</p>
              <p className="mt-1">
                {publicationMismatch?.differences.length
                  ? '题目与当前训练计划存在以下设置差异，因此尚未进入已发布练习：'
                  : '题目与当前训练计划的设置不一致，因此尚未进入已发布练习。'}
              </p>
              {publicationMismatch?.differences.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {publicationMismatch.differences.map((difference) => (
                    <li key={difference.field}>
                      {difference.label}：题目为“{difference.questionValue}”，训练计划为“{difference.planValue}”
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 font-semibold">解决方法</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>
                  点击下方“{publicationRepairDraft ? '继续处理修订稿' : '创建修订稿并同步训练设置'}”。
                </li>
                <li>
                  {publicationMismatch?.differences.length
                    ? `系统会把${publicationMismatch.differences.map((difference) => `${difference.label}从“${difference.questionValue}”调整为“${difference.planValue}”`).join('；')}。`
                    : '系统会把当前题的相关设置调整为训练计划中的设置。'}
                </li>
                <li>在新修订稿中确认内容，完成检查和人工审核后，再发布当前题。</li>
              </ol>
              <p className="mt-2 text-amber-800">
                只处理当前题，不会重新生成其他题目；已有正式版本也会继续保留。
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={onRepairPublication}
                className="mt-3 inline-flex min-h-9 items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-normal text-white hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {publicationRepairDraft ? '继续处理修订稿' : '创建修订稿并同步训练设置'}
              </button>
            </>
          )}
        </div>
      ) : null}

      {publicationBlocked ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <p className="font-semibold">发布前需要先调整训练设置</p>
          {publicationPreflightMismatch.issue ? (
            <p className="mt-1">
              当前题目关联的训练计划信息不可用，请返回素材资源录入平台重新确认训练任务后再发布。
            </p>
          ) : (
            <>
              <p className="mt-1">系统已在正式发布前发现以下设置差异：</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {publicationPreflightMismatch.differences.map((difference) => (
                  <li key={difference.field}>
                    {difference.label}：题目为“{difference.questionValue}”，训练计划为“{difference.planValue}”
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                点击下方按钮后，系统只为当前题创建修订稿并同步上述设置，不会生成正式版本，也不会影响其他题目。
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={onRepairPublication}
                className="mt-3 inline-flex min-h-9 items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-normal text-white hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {publicationRepairDraft ? '继续处理修订稿' : '创建修订稿并同步训练设置'}
              </button>
            </>
          )}
        </div>
      ) : null}

      {!focusedReview && completedStep >= 1 ? <CompletedActionStep index="1" title="自动结构检查" /> : null}
      {!focusedReview && completedStep >= 2 ? <CompletedActionStep index="2" title="提交题目审核" /> : null}
      {!focusedReview && completedStep >= 3 ? <CompletedActionStep index="3" title="题目人工审核" /> : null}
      {!focusedReview && completedStep >= 4 ? <CompletedActionStep index="4" title="正式发布" /> : null}

      {draft.status === 'rejected' ? (
        <div className="rounded-md bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">当前题目不采用</p>
          <p className="mt-1 text-xs leading-5 text-rose-700">本次审核记录会保留，题目不会发布。如需继续使用，可基于现有内容创建修订稿并重新提交审核。</p>
          <button type="button" disabled={busy} onClick={onCreateRejectedRevision} className="mt-3 flex min-h-10 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">基于此题创建修订稿</button>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <ActionStep index="1" title="自动结构检查">
          <button type="button" disabled={busy || !['drafted', 'validation_failed', 'revision_required'].includes(draft.status)} onClick={onValidate} className={activeWorkflowButtonClass}>{validationActionLabel}</button>
          {validation ? <ValidationResult validation={validation} stale={draft.status === 'revision_required'} /> : <p className="mt-2 text-sm text-slate-500">当前修改尚未执行结构检查，请保存后检查。</p>}
        </ActionStep>
      ) : null}

      {currentStep === 2 ? (
        <ActionStep index="2" title="提交人工审核">
          {qualityAssessment?.decision === 'revision_recommended' ? (
            <p className="mb-3 text-sm leading-6 text-amber-800">
              质量检查建议先修改。你仍可提交人工审核，由审核者结合警告作最终决定。
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || !qualityAssessment || !qualityAssessmentBundle || qualityResultStale}
            onClick={onSubmitReview}
            className={activeWorkflowButtonClass}
          >
            {qualityAssessment?.decision === 'revision_recommended'
              ? '仍提交人工审核'
              : '提交人工审核'}
          </button>
          {!qualityAssessment || !qualityAssessmentBundle || qualityResultStale ? (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {qualityResultStale
                ? '题目内容已经修改，请先保存并重新检查题目。'
                : '当前题目尚无完整质量检查结果，请重新执行结构检查。'}
            </p>
          ) : null}
        </ActionStep>
      ) : null}

      {currentStep === 3 ? (
        <ActionStep index="3" title="题目人工审核">
          <AutoGrowTextarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} placeholder="填写审核说明" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => onReview('revision_required')} className="min-h-10 rounded-md border border-[#666666] px-2 text-sm font-normal text-slate-800 disabled:border-slate-200 disabled:text-slate-400">退回修改</button>
            <button
              type="button"
              disabled={busy || !acceptedAllReviewWarnings || semanticQualityUnavailable}
              onClick={() => onReview('approve')}
              className="min-h-10 rounded-md bg-slate-950 px-2 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              审核通过
            </button>
          </div>
          {semanticQualityUnavailable ? (
            <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
              独立语义评估服务不可用，当前题目不能审核通过；仍可退回修改。
            </p>
          ) : null}
        </ActionStep>
      ) : null}

      {currentStep === 4 ? (
        <ActionStep index="4" title="发布准备检查">
          {publicationBlocked ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
              请先完成上方训练设置调整，重新检查并通过人工审核后再发布。
            </p>
          ) : (
            <button type="button" disabled={busy || !canPublish} onClick={onFreeze} className="mx-auto flex min-h-10 w-[240px] items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-normal text-white disabled:bg-slate-200 disabled:text-slate-400">发布正式题目</button>
          )}
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

const qualityCheckLabels = {
  materialGrounding: {
    pass: '题目的材料证据边界清楚',
    warning: '题目的材料证据边界不够清楚',
  },
  observationClarity: {
    pass: '题目考查的能力目标明确',
    warning: '题目考查的能力目标不够明确',
  },
  observationDistinctness: {
    pass: '本题与其他题目的考查内容有明确区别',
    warning: '本题可能与另一道当前题目较为接近',
  },
  discriminativePower: {
    pass: '评分能区分不同完成水平',
    warning: '评分难以区分不同完成水平',
  },
  difficultyCoherence: {
    pass: '题目要求与设定难度一致',
    warning: '题目要求与设定难度可能不一致',
  },
  rubricAlignment: {
    pass: '评分标准与题目要求一致',
    warning: '评分标准与题目要求可能不一致',
  },
  scopeClarity: {
    pass: '题目的作答范围清楚',
    warning: '题目的作答范围不够清楚',
  },
};

const qualityCheckActions = {
  materialGrounding: [
    '让学生能够判断应从材料的什么范围寻找和组织依据，不要求套用固定句式。',
    '可按题目需要指向局部内容、明确结合全文，或允许学生自主选取指定数量和类型的证据。',
  ],
  observationClarity: [
    '确认本题只考查一个主要学生动作。',
    '在题干中使用“概括、分析、推断、说明依据”等明确动词，并写清最终需要输出什么。',
  ],
  observationDistinctness: [
    '先打开下方列出的对照题，比较两题的回答对象、材料依据和评分目标。',
    '训练能力或问法相同不等于重复。只要其中一项有明确区别，就可以保留；三项都高度重合时，再考虑合并、调整或不采用。',
  ],
  discriminativePower: [
    '在“评分标准”中增加至 2 至 3 个评分项，每个评分项只判断一件事。',
    '分别填写“评分内容”和“满足本项的答案要点”，再设置判定作用，并确认完整回答是否必须满足该项。',
  ],
  difficultyCoherence: [
    '先确认“训练设置 → 难度”是否符合预期。',
    '若题目偏难，缩小阅读范围、减少子任务或增加提示；若题目偏易，减少提示或增加解释要求。',
  ],
  rubricAlignment: [
    '逐句拆分题干要求，确认每一项要求都有对应评分项。',
    '补齐缺失的评分项，并删除题干没有要求学生完成的评价内容。',
  ],
  scopeClarity: [
    '只保留一个核心问题，或将多个问题拆成独立题目。',
    '在题干中写明阅读范围、回答对象和需要完成的动作。',
  ],
};

const qualityCheckAcceptance = {
  materialGrounding: '学生能从题干判断应依据全文、指定局部内容，还是自主选取明确数量和类型的证据。',
  observationClarity: '题干只有一个主要作答目标，并写清学生要完成的动作和最终输出。',
  observationDistinctness: '与对照题相比，回答对象、材料依据或评分目标至少有一项明确不同。',
  discriminativePower: '评分标准包含 2 至 3 个可独立判断的评分项，并能区分完整、部分和未达要求的回答。',
  difficultyCoherence: '题目的阅读范围、子任务数量、解释要求与所选难度相符。',
  rubricAlignment: '题干中的每一项作答要求都有对应评分项，评分项也不包含题干未要求的内容。',
  scopeClarity: '题干明确阅读范围、回答对象和主要动作，学生无需猜测回答边界。',
};

const stemReviewableChecks = new Set([
  'materialGrounding',
  'observationClarity',
  'scopeClarity',
]);

function qualityCheckLabel(check, passed = true) {
  const labels = qualityCheckLabels[check];
  if (!labels) return check;
  return passed ? labels.pass : labels.warning;
}

function qualityWarningMessage(warning) {
  if (warning.message === '当前 Rubric 较难区分完整、部分与不足回答。') {
    return '当前评分标准还不能清楚区分完整回答、部分回答和未达到要求的回答。';
  }
  if (warning.check === 'observationDistinctness') {
    const peerStem = warning.comparison?.peerQuestionStem?.trim();
    return peerStem
      ? `${warning.message} 对照题：“${peerStem}”`
      : warning.message;
  }
  return warning.message;
}

function qualityCheckExample(check, form, material) {
  const materialTitle = material?.title ? formatMaterialTitle(material.title) : '当前材料';
  const currentStem = form?.questionStem?.trim() || '';
  const rubricAbility = abilityOptions.find(([value]) => value === form?.abilityId)?.[1] || '目标能力';

  const examples = {
    materialGrounding: `局部依据可写明段落、场景、原句或关键词；全文依据可写为“结合${materialTitle}全文，${removeGenericMaterialLead(currentStem) || '回答原题要求'}”；开放取证可写为“从文中任选两处相关细节并说明依据”。请按实际考查目标选用，不必照搬句式。`,
    observationClarity: `可改为：“结合指定内容，先概括【关键信息】，再说明【需要解释的原因或作用】。”`,
    observationDistinctness: `系统只根据题干和评分要点的相似程度给出提醒，并未判定两题重复。两题可以使用相同问法或训练同一种能力；请以回答对象、材料依据和评分目标是否重合为准。`,
    discriminativePower: `可拆为：评分项一“关键内容完整”（核心要求，完整回答必须满足）；评分项二“顺序或逻辑正确”（重要要求）；评分项三“有材料依据”（重要要求）。在每项的“满足本项的答案要点”中填写可用于判断的具体内容。`,
    difficultyCoherence: `示例：将“结合全文分析两个原因并评价作用”改为“结合第 3 段，分析一个主要原因”，可降低任务难度。`,
    rubricAlignment: `示例：题干要求“概括并说明依据”，评分标准至少应包含“概括结果”和“材料依据”两个评分项。`,
    scopeClarity: `可改为：“结合第【填写段落】段，概括【一个明确对象】的主要变化，并用一句话说明依据。”`,
  };

  return examples[check]?.replace('目标能力', rubricAbility) || '';
}

function qualityCurrentProblem(warning, form) {
  const stem = form?.questionStem?.trim() || '尚未填写题干';
  const rubricNames = (form?.rubric || []).map((item) => item.name?.trim()).filter(Boolean);
  const ability = optionLabel(abilityOptions, form?.abilityId);
  const difficulty = optionLabel(difficultyOptions, form?.difficulty);
  const peerStem = warning.comparison?.peerQuestionStem?.trim();

  const problems = {
    materialGrounding: `当前题干：“${stem}”`,
    observationClarity: `当前主要能力为“${ability}”，题干为：“${stem}”`,
    observationDistinctness: peerStem
      ? `当前题干：“${stem}”；对照题：“${peerStem}”`
      : `当前题干：“${stem}”；系统检测到同批题目存在相近考查内容。`,
    discriminativePower: rubricNames.length
      ? `当前共有 ${rubricNames.length} 个评分项：${rubricNames.join('；')}`
      : '当前还没有可用于区分完成水平的评分项。',
    difficultyCoherence: `当前难度为“${difficulty}”，最低字数为 ${form?.minLength || '未设置'} 字。`,
    rubricAlignment: `题干要求：“${stem}”；当前评分项：${rubricNames.join('；') || '尚未填写'}。`,
    scopeClarity: `当前题干：“${stem}”`,
  };
  return problems[warning.check] || qualityWarningMessage(warning);
}

function removeGenericMaterialLead(stem) {
  return stem
    .replace(/^(请)?结合(全文|材料|文章|文本)[，,、：:\s]*/u, '')
    .replace(/^(请)?根据(全文|材料|文章|文本)[，,、：:\s]*/u, '')
    .replace(/[。！？!?；;]+$/u, '')
    .trim();
}

function QuestionQualitySummary({
  assessment,
  form,
  material,
  compact = false,
  stale = false,
  revisionProgress,
  onLocate,
  onOptimizeStem,
  optimizationBusy = false,
}) {
  const progressItems = revisionProgress?.items || [];
  const activeProgressItems = progressItems.filter((item) => item.status !== 'resolved');
  const progressByCheck = new Map(progressItems.map((item) => [item.check, item]));
  const repairQueue = buildQuestionQualityRepairQueue(revisionProgress);
  const handledCount = repairQueue.resolved.length + repairQueue.awaitingRecheck.length;

  if (stale) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-amber-900">本次修改待重新检查</p>
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-normal text-amber-800">
            {activeProgressItems.length
              ? `${activeProgressItems.length} 项待确认`
              : '待重新检查'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-amber-800">
          按顺序处理待修改项；全部修改完成后，只需统一保存并重新检查一次。
        </p>
        {repairQueue.total ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-slate-900">
                修复进度 {handledCount}/{repairQueue.total}
              </span>
              <span className="text-slate-600">
                待修改 {repairQueue.pending.length} 项 · 待复检 {repairQueue.awaitingRecheck.length} 项
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-amber-100">
              <div
                className="h-full bg-emerald-600 transition-[width]"
                style={{ width: `${Math.round((handledCount / repairQueue.total) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}
        {activeProgressItems.length ? (
          <ul className="mt-3 space-y-2">
            {[...repairQueue.pending, ...repairQueue.awaitingRecheck].map((item, index) => {
              const isCurrent = item.check === repairQueue.current?.check;
              return (
              <li
                key={item.check}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2 ${
                  isCurrent ? 'border border-emerald-300 bg-white' : 'bg-white/70'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded text-xs ${
                    isCurrent
                      ? 'bg-emerald-100 font-semibold text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="truncate text-sm text-slate-800">{qualityCheckLabel(item.check, false)}</span>
                  {isCurrent ? <span className="text-xs font-semibold text-emerald-700">当前处理</span> : null}
                  <QualityIssueStatusBadge status={item.status} />
                </div>
                {onLocate && item.status === 'pending' && isCurrent ? (
                  <button
                    type="button"
                    onClick={() => onLocate(item.check)}
                    className="text-xs font-normal text-emerald-700 hover:text-emerald-800"
                  >
                    开始修改
                  </button>
                ) : item.status === 'pending' ? (
                  <span className="text-xs text-slate-500">等待前项</span>
                ) : (
                  <span className="text-xs text-slate-500">等待统一复检</span>
                )}
              </li>
            )})}
          </ul>
        ) : null}
        {repairQueue.pending.length === 0 && repairQueue.awaitingRecheck.length > 0 ? (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            所有问题均已逐项修改。请点击页面下方“保存本次修改”，然后执行“保存并检查题目”。
          </p>
        ) : null}
      </div>
    );
  }
  if (!assessment) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm font-semibold text-rose-800">质量评估尚未形成</p>
        <p className="mt-1 text-xs leading-5 text-rose-700">
          当前 Revision 不能提交审核或发布，请重新执行结构检查。
        </p>
      </div>
    );
  }

  const needsRevision = assessment.decision === 'revision_recommended';
  const hasWarnings = assessment.warnings.length > 0;
  const resolvedThisRound = progressItems.filter(
    (item) => (
      item.status === 'resolved' &&
      item.resolvedAtAssessmentId === assessment.assessmentId
    ),
  );
  const currentCheck = repairQueue.current?.check || assessment.warnings[0]?.check;
  return (
    <section className={`rounded-md border p-4 ${needsRevision ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">题目质量检查</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-normal ${
          needsRevision
            ? 'bg-amber-100 text-amber-800'
            : hasWarnings
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-emerald-100 text-emerald-800'
        }`}>
          {needsRevision ? '系统建议修改' : hasWarnings ? '系统检查有提醒' : '系统检查通过'}
        </span>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
        {Object.entries(assessment.checks).map(([check, status]) => {
          const passed = status === 'pass';
          return (
            <div key={check} className="flex min-h-8 items-center gap-2 text-sm text-slate-700">
              {passed
                ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                : <AlertTriangle size={15} className="shrink-0 text-amber-600" />}
              <span>{qualityCheckLabel(check, passed)}</span>
            </div>
          );
        })}
      </div>

      {hasWarnings ? (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-900">需要人工关注</p>
            <p className="text-xs text-slate-600">建议按顺序修改，完成后统一保存并重新检查</p>
          </div>
          <ul className="mt-2 space-y-2">
            {assessment.warnings.map((warning, warningIndex) => {
              const isCurrent = warning.check === currentCheck;
              const recheckCount = progressByCheck.get(warning.check)?.recheckCount || 0;
              const shouldUseManualRepair = recheckCount >= 2;
              return (
              <li
                key={`${warning.code}-${warning.check}`}
                className={`rounded-md px-3 py-3 text-sm leading-6 text-slate-700 ${
                  isCurrent ? 'border border-emerald-300 bg-white' : 'bg-white/80'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p>
                      <span className={`mr-2 inline-flex size-5 items-center justify-center rounded text-xs ${
                        isCurrent
                          ? 'bg-emerald-100 font-semibold text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {warningIndex + 1}
                      </span>
                      <span className="font-semibold text-amber-800">
                      {qualityCheckLabel(warning.check, false)}
                      </span>
                      {' · '}{qualityWarningMessage(warning)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {isCurrent ? <span className="text-xs font-semibold text-emerald-700">当前优先处理</span> : null}
                      <QualityIssueStatusBadge status={progressByCheck.get(warning.check)?.status || 'pending'} />
                      {shouldUseManualRepair ? (
                        <span className="text-xs font-medium text-rose-700">
                          已连续复检 {recheckCount} 次仍存在
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onLocate && isCurrent && !shouldUseManualRepair ? (
                      <button
                        type="button"
                        onClick={() => onLocate(warning.check)}
                        className="min-h-8 rounded-md border border-emerald-600 bg-white px-3 text-xs font-normal text-emerald-700 hover:bg-emerald-50"
                      >
                        定位修改
                      </button>
                    ) : null}
                    {onOptimizeStem && isCurrent && stemReviewableChecks.has(warning.check) && !shouldUseManualRepair ? (
                      <button
                        type="button"
                        disabled={optimizationBusy}
                        onClick={() => {
                          onLocate?.(warning.check);
                          onOptimizeStem([warning.check]);
                        }}
                        className="min-h-8 rounded-md bg-emerald-600 px-3 text-xs font-normal text-white hover:bg-emerald-700 disabled:bg-slate-300"
                      >
                        {optimizationBusy ? '正在优化…' : 'AI 优化这一项'}
                      </button>
                    ) : null}
                    {onLocate && isCurrent && shouldUseManualRepair ? (
                      <button
                        type="button"
                        onClick={() => onLocate(warning.check)}
                        className="min-h-8 rounded-md bg-emerald-600 px-3 text-xs font-normal text-white hover:bg-emerald-700"
                      >
                        转为人工修改
                      </button>
                    ) : null}
                    {!isCurrent ? (
                      <span className="text-xs text-slate-500">完成当前项后再处理</span>
                    ) : null}
                  </div>
                </div>
                {isCurrent ? <>
                <p className="mt-2 rounded-md bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-slate-900">当前问题：</span>
                  {qualityCurrentProblem(warning, form)}
                </p>
                {getQualityCheckEditLocation(warning.check) ? (
                  <p className="mt-2">
                    <span className="font-semibold text-slate-900">修改位置：</span>
                    {getQualityCheckEditLocation(warning.check)}
                  </p>
                ) : null}
                {qualityCheckActions[warning.check] ? (
                  <div className="mt-2">
                    <p className="font-semibold text-slate-900">建议怎么改：</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-5 text-slate-600">
                      {qualityCheckActions[warning.check].map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {qualityCheckExample(warning.check, form, material) ? (
                  <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-slate-700">
                    <span className="font-semibold">参考写法（非固定格式）：</span>
                    {qualityCheckExample(warning.check, form, material)}
                  </p>
                ) : null}
                {qualityCheckAcceptance[warning.check] ? (
                  <p className="mt-2 border-t border-slate-200 pt-2 text-slate-700">
                    <span className="font-semibold text-slate-900">改到什么程度算完成：</span>
                    {qualityCheckAcceptance[warning.check]}
                  </p>
                ) : null}
                {shouldUseManualRepair ? (
                  <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-rose-800">
                    该问题连续 {recheckCount} 次复检仍未解决。系统已停止推荐重复生成，请按上方“当前问题、建议怎么改、完成标准”人工修改；如果题目确实无需满足此项，可在人工审核说明中写明保留理由。
                  </p>
                ) : null}
                </> : null}
              </li>
            )})}
          </ul>
          {resolvedThisRound.length ? (
            <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-800">
                本轮已解决 {resolvedThisRound.length} 项
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-700">
                {resolvedThisRound.map((item) => qualityCheckLabel(item.check, true)).join('、')}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 text-xs leading-5 text-emerald-800">
          <p>七项系统检查均通过；下一步仍需人工审核。</p>
          {resolvedThisRound.length ? (
            <p className="mt-1">本轮解决：{resolvedThisRound.map((item) => qualityCheckLabel(item.check, true)).join('、')}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function QualityIssueStatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    modified_pending_recheck: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700',
  };
  const labels = {
    pending: '待处理',
    modified_pending_recheck: '已修改待检查',
    resolved: '已解决',
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-normal ${styles[status] || styles.pending}`}>
      {labels[status] || labels.pending}
    </span>
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
      <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold text-slate-950">学生端任务</h3><span className={`rounded px-2 py-1 text-xs ${isFrozen ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{isFrozen ? '已发布' : '草稿预览'}</span></div>
      {material?.content ? <div className="mt-4 rounded-md bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">阅读材料</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{material.content}</p></div> : null}
      <div className="mt-4"><p className="text-xs font-semibold text-slate-500">题目</p><p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-950">{resource.questionStem || '尚未录入题干'}</p></div>
      {resource.options?.length ? <div className="mt-4 space-y-2">{resource.options.map((option, index) => <div key={`${option}-${index}`} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">{String.fromCharCode(65 + index)}. {option}</div>)}</div> : null}
      <textarea disabled rows={5} className="mt-4 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" placeholder="学生将在这里作答" />
    </div>
  );
}

function ReviewPreview({ context, form, material, qualityResultStale = false, qualityRevisionProgress = null, humanReviewStage = false }) {
  const draft = context?.draft;
  const awaitingIssueRecheck = Boolean(
    qualityResultStale ||
    (
      qualityRevisionProgress?.items?.some((item) => item.status === 'modified_pending_recheck') &&
      context?.qualityAssessment?.assessedDraftRevision !== draft?.revision
    ),
  );
  if (humanReviewStage) {
    const review = context?.review;
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-slate-950">审核记录</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            记录与当前 Revision 绑定；审核阶段不会直接修改正式字段。
          </p>
        </div>
        <ReviewBlock title="提交记录" rows={[
          ['题目版本', `第 ${draft?.revision || 1} 版`],
          ['当前状态', statusLabels[draft?.status] || draft?.status || '未知'],
          ['检查状态', context?.assessmentState === 'current' ? '当前有效' : '需要重新检查'],
        ]} />
        {review ? (
          <ReviewBlock title="人工审核决定" rows={[
            ['审核结果', review.action === 'approve' ? '审核通过' : review.action === 'revision_required' ? '退回修改' : '不采用'],
            ['审核说明', review.notes],
            ['审核时间', review.reviewedAt],
          ]} />
        ) : (
          <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
            当前题目尚未形成题目人工审核决定。
          </p>
        )}
      </div>
    );
  }
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
      {draft ? (
        <QuestionQualitySummary
          assessment={context?.qualityAssessment}
          form={form}
          material={material}
          compact
          stale={awaitingIssueRecheck}
          revisionProgress={qualityRevisionProgress}
        />
      ) : null}
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

function AutoGrowTextarea({ id, value, onChange, rows = 3, placeholder, disabled = false }) {
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
      id={id}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      className={`${textareaClass} resize-none overflow-hidden disabled:cursor-wait disabled:bg-slate-50 disabled:text-slate-500`}
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
    <span className={`relative flex min-h-11 w-full items-center rounded-md border border-slate-300 bg-white px-3 pr-10 transition focus-within:border-2 focus-within:border-blue-600 ${disabled ? 'bg-slate-50' : ''}`}>
      <span className="pointer-events-none inline-flex max-w-full items-center truncate rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-sm font-normal text-blue-700">
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
    publication_incomplete: 'border border-amber-200 bg-amber-50 text-amber-700',
  };
  return <span className={`shrink-0 rounded px-2 py-1 text-sm ${tones[status] || 'bg-slate-100 text-slate-600'}`}>{statusLabels[status] || status}</span>;
}

function toChineseNumber(value) {
  const values = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return values[value] || String(value);
}

function draftDisplayStatus(snapshot, draft) {
  const version = snapshot.versions.find((item) => item.sourceDraftId === draft.draftId);
  if (!version) return draft.status;
  return snapshot.observationLinks.some((link) => (
    link.resourceVersionId === version.resourceVersionId &&
    link.status === 'active'
  ))
    ? 'published'
    : 'publication_incomplete';
}

function getPublicationMismatch(snapshot, draft) {
  const version = snapshot.versions.find((item) => item.sourceDraftId === draft.draftId);
  if (!version) return null;
  const expectedSettings = snapshot.observationLinks.find((link) => (
    link.resourceVersionId === version.resourceVersionId &&
    link.status === 'invalid'
  ));
  if (!expectedSettings) return { differences: [] };

  const comparisons = [
    {
      field: 'abilityId',
      label: '训练能力',
      questionValue: optionLabel(abilityOptions, version.abilityMetadata.abilityId),
      planValue: optionLabel(abilityOptions, expectedSettings.abilityId),
      expectedValue: expectedSettings.abilityId,
    },
    {
      field: 'difficulty',
      label: '难度',
      questionValue: optionLabel(difficultyOptions, version.abilityMetadata.difficulty),
      planValue: optionLabel(difficultyOptions, expectedSettings.difficulty),
      expectedValue: expectedSettings.difficulty,
    },
    {
      field: 'taskRole',
      label: '任务用途',
      questionValue: optionLabel(taskRoleOptions, version.abilityMetadata.taskRole),
      planValue: optionLabel(taskRoleOptions, expectedSettings.taskRole),
      expectedValue: expectedSettings.taskRole,
    },
  ];

  return {
    differences: comparisons.filter((item) => item.questionValue !== item.planValue),
  };
}

function getPublicationPreflightMismatch(context) {
  const preflight = context.publicationPreflight;
  if (!preflight?.scoped) return { passed: true, differences: [] };
  if (preflight.issue) return { passed: false, issue: preflight.issue, differences: [] };

  const optionGroups = {
    abilityId: abilityOptions,
    difficulty: difficultyOptions,
    taskRole: taskRoleOptions,
  };
  const labels = {
    abilityId: '训练能力',
    difficulty: '难度',
    taskRole: '任务用途',
  };
  return {
    passed: preflight.passed,
    differences: preflight.differences.map((difference) => ({
      ...difference,
      label: labels[difference.field],
      questionValue: optionLabel(optionGroups[difference.field], difference.questionValue),
      planValue: optionLabel(optionGroups[difference.field], difference.planValue),
    })),
  };
}

function findPublicationRepairDraft(snapshot, draft) {
  if (!draft) return null;
  const version = snapshot.versions.find((item) => item.sourceDraftId === draft.draftId);
  if (!version) {
    const repairRootDraftId = readTagValue(draft.tags, 'publication_repair_source:') || draft.draftId;
    const repairSourceTag = `publication_repair_source:${repairRootDraftId}`;
    const observationTaskTag = draft.tags.find((tag) => tag.startsWith('observation_task:'));
    return snapshot.drafts
      .filter((item) => (
        item.tags.includes(repairSourceTag) &&
        (!observationTaskTag || item.tags.includes(observationTaskTag)) &&
        ['drafted', 'validation_failed', 'revision_required'].includes(item.status)
      ))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
  }
  return snapshot.drafts
    .filter((item) => (
      item.resourceId === version.resourceId &&
      item.parentVersionId === version.resourceVersionId &&
      !['rejected', 'archived'].includes(item.status)
    ))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

function findRejectedRevisionDraft(snapshot, draft) {
  if (!draft || draft.status !== 'rejected') return null;
  return snapshot.drafts
    .filter((candidate) => (
      candidate.draftId !== draft.draftId &&
      candidate.resourceId === draft.resourceId &&
      candidate.proposedVersionNumber === draft.proposedVersionNumber &&
      !['rejected', 'archived'].includes(candidate.status)
    ))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

function optionLabel(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] || value;
}

function readTagValue(tags, prefix) {
  return tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || null;
}

function Notice({ notice }) {
  return (
    <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
      <p>{notice.message}</p>
      {notice.errorCode && (
        <p className="mt-1 text-xs opacity-80">
          错误码：{notice.errorCode}
          {notice.objectId ? ` · 对象：${notice.objectId}` : ''}
          {` · ${notice.recoveryMessage}`}
        </p>
      )}
    </div>
  );
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

function toForm(draft, authoringFields) {
  return {
    title: draft.title,
    questionStem: authoringFields?.questionStem || draft.questionStem,
    questionType: draft.questionType,
    responseFormat: draft.responseFormat,
    optionsText: (draft.options || []).join('\n'),
    materialVersionId: draft.materialVersionId || '',
    assessmentMode: draft.assessmentMode,
    acceptedAnswersText: (draft.answerAcceptance?.acceptedAnswers || []).join('\n'),
    acceptedKeywordsText: (draft.answerAcceptance?.acceptedKeywords || []).join('\n'),
    semanticEquivalentAllowed: Boolean(draft.answerAcceptance?.semanticEquivalentAllowed),
    abilityId: authoringFields?.abilityTarget || draft.abilityMetadata.abilityId,
    specificTrainingPoint: authoringFields?.specificTrainingPoint || '',
    studentTask: authoringFields?.studentTask || '',
    observationTarget: authoringFields?.observationTarget || '',
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

function draftInputSignature(form) {
  return JSON.stringify(toDraftInput(form));
}

function toAnswerAcceptance(form) {
  return { acceptedAnswers: lines(form.acceptedAnswersText), acceptedKeywords: lines(form.acceptedKeywordsText), semanticEquivalentAllowed: form.semanticEquivalentAllowed, normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'] };
}

function toRubric(form) {
  return form.rubric.map((item, index) => ({ itemId: `rubric-${index + 1}`, name: item.name, abilityId: item.abilityId, importance: item.importance, required: item.required, acceptedSignals: commaValues(item.acceptedSignalsText), evidenceRequirement: { requireTextEvidence: item.requireTextEvidence, requireExplanation: item.requireExplanation, requireConclusion: false } }));
}

function handleQuestionType(questionType, setForm) {
  const formats = { multiple_choice: ['single_choice', 'exact_match'], true_false: ['boolean', 'exact_match'], fill_blank: ['short_text', 'exact_match'], open_short_answer: ['short_text', 'key_points'], reading_comprehension: ['long_text', 'reasoning_chain'] };
  setForm(
    (current) => ({ ...current, questionType, responseFormat: formats[questionType][0], assessmentMode: formats[questionType][1], optionsText: questionType === 'multiple_choice' ? current.optionsText : '' }),
    getQualityChecksForUiField('questionType'),
  );
}

function updateAbility(abilityId, setForm) {
  setForm(
    (current) => ({ ...current, abilityId, rubric: current.rubric.map((item, index) => index === 0 ? { ...item, abilityId } : item) }),
    getQualityChecksForUiField('abilityId'),
  );
}

function rubricIssueTargetId(form, check) {
  const rubric = form.rubric || [];
  if (!rubric.length) return 'question-rubric-editor';
  if (check !== 'discriminativePower' || rubric.length === 1) {
    return `question-rubric-item-${rubric[0].localId}`;
  }

  const signatures = new Map();
  for (const item of rubric) {
    const name = normalizeRubricComparisonText(item.name);
    const signals = commaValues(item.acceptedSignalsText)
      .map(normalizeRubricComparisonText)
      .filter(Boolean)
      .sort()
      .join('|');
    const signature = `${name}::${signals}`;
    if (signature !== '::' && signatures.has(signature)) {
      return `question-rubric-item-${item.localId}`;
    }
    signatures.set(signature, item.localId);
  }

  return `question-rubric-item-${rubric[1].localId}`;
}

function normalizeRubricComparisonText(value) {
  return String(value || '')
    .replace(/[，。！？、；：,.!?;:\s]/gu, '')
    .trim();
}

function lines(value) { return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
function commaValues(value) { return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean); }
function errorNotice(error) { return createWorkbenchErrorNotice(error, { operation: 'question_workbench.operation' }); }

const emptySnapshot = {
  drafts: [],
  materials: [],
  registryEntries: [],
  versions: [],
  observationLinks: [],
  registryConsistency: { passed: true, issues: [] },
};
const inputClass = 'min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-500 disabled:bg-slate-50';
const textareaClass = 'w-full rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-950 outline-none focus:border-blue-500 disabled:bg-slate-50';
const activeWorkflowButtonClass = 'flex min-h-10 w-full items-center justify-center rounded-md border border-emerald-600 bg-emerald-600 px-4 text-sm font-normal text-white hover:bg-emerald-700 disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-400';
const preClass = 'mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100';
