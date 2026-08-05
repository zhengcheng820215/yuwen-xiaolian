import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  ChevronDown,
  LoaderCircle,
  Save,
  Trash2,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import RefreshIconButton from '../components/RefreshIconButton.jsx';
import {
  createProductionMaterial,
  deleteUnusedProductionMaterial,
  getProductionMaterialDisposition,
  getMaterialResourceProductionSnapshot,
  loadPhase17BatchAPlansForReview,
  loadTongguanCalibrationPlanForReview,
  normalizeMaterialContent,
  reactivateProductionMaterial,
  retireProductionMaterial,
} from '../api/materialResourceProductionWorkbench.ts';
import {
  getMaterialObservationDraftGeneratorStatus,
  requestMaterialObservationDraftCandidates,
} from '../api/materialObservationDraftGenerator.ts';
import {
  downloadFormalResourceBaseline,
  exportCurrentBrowserFormalResourceBaseline,
  initializeSharedFormalResourceBaseline,
} from '../api/sharedFormalResourcePersistence.ts';
import WorkspaceToast from '../components/continuous-learning/WorkspaceToast.jsx';
import { createWorkbenchErrorNotice } from '../api/workbenchErrorNotice.ts';
import { formatMaterialTitle } from '../ui/materialTitle.ts';
import {
  buildMaterialResourceWorkbenchDetails,
  scopeMaterialResourceWorkbenchDetails,
  selectCurrentPlanDrafts,
} from './materialResourceWorkbenchState.ts';
import {
  clearMaterialWorkbenchSelection,
  readMaterialWorkbenchSelection,
  resolveMaterialWorkbenchSelection,
  shouldOpenExistingMaterialMode,
  writeMaterialWorkbenchSelection,
} from './materialResourceWorkbenchSelectionState.ts';
import {
  adoptTrainingTaskGroupCandidate,
  createTrainingTaskGroupCandidateSession,
  MAX_TRAINING_TASK_COUNT,
  resolveTrainingTaskGenerationRequest,
  summarizeTrainingTaskGroupCoverage,
  toggleSupplementCandidateSelection,
} from './trainingTaskGroupPlanningState.ts';
import { adoptSingleTrainingTaskCandidate } from './singleTrainingTaskRegenerationState.ts';
import {
  getMaterialProductionCommandAvailability,
  MATERIAL_PRODUCTION_COMMANDS,
} from './materialResourceProductionCommandState.ts';
import {
  executeConfirmTrainingPlanForTaskProductionCommand,
  executeCreateTaskQuestionCommand,
  executeSavePlanRevisionCommand,
} from './materialProductionCommands.ts';
import {
  executePublishConfirmedTaskCommand,
  executeQuestionCheckCommand,
  executeRecordFinalConfirmationCommand,
  executeSubmitFinalConfirmationCommand,
} from './questionProductionCommands.ts';
import { executePublishConfirmedTaskBatchCommand } from './taskPublicationBatch.ts';
import {
  canRemoveTrainingTask,
  MIN_TRAINING_TASK_COUNT,
  removeTrainingTaskAt,
  restoreRemovedTrainingTask,
} from './trainingTaskEditingState.ts';
import {
  resolveTaskAssessmentStatus,
  resolveTaskGroupSummary,
  resolveTaskProductionCardPresentation,
  resolveTaskPublicationEligibility,
  resolveTaskProductionState,
} from './taskProductionState.ts';
import {
  enterTaskCardCalibration,
  exitTaskCardCalibration,
  isTaskCardDisclosureOpen,
  setTaskCardDisclosureOpen,
} from './taskCardDisclosureState.ts';
import {
  discardQuestionTaskWorkingContent,
  getQuestionTaskWorkingContentState,
  rebaseQuestionTaskWorkingContent,
  saveQuestionTaskWorkingContent,
} from '../api/workingTaskContent.ts';
import { commitQuestionTaskWorkingChanges } from '../api/taskGroupSubmission.ts';
import { extractQuestionEditableFields } from '../ai/schemas/workingTaskContent.schema.ts';

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
const abilityLabels = Object.fromEntries(abilityOptions);
const dimensionLabels = Object.fromEntries(dimensionOptions);
const trainingDirectionLabels = Object.fromEntries(trainingDirectionOptions);
const roleLabels = Object.fromEntries(roleOptions);
const difficultyLabels = Object.fromEntries(difficultyOptions);

export default function MaterialResourceProductionWorkbench() {
  const location = useLocation();
  const routeSelection = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      materialVersionId: params.get('materialVersionId') || '',
      planId: params.get('planId') || '',
      editTasks: params.get('edit') === 'training-tasks',
    };
  }, [location.search]);
  const usesNonCanonicalLocalPort = import.meta.env.DEV
    && typeof window !== 'undefined'
    && window.location.port !== '5174';
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [materialMode, setMaterialMode] = useState(() => (
    routeSelection.materialVersionId ? 'existing' : 'new'
  ));
  const [activeLoadPreset, setActiveLoadPreset] = useState(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [taskEditorDirty, setTaskEditorDirty] = useState(false);
  const [editableTaskIds, setEditableTaskIds] = useState(() => new Set());
  const [taskCardDisclosures, setTaskCardDisclosures] = useState({});
  const [taskWorkingStates, setTaskWorkingStates] = useState({});
  const [taskCommitOperation, setTaskCommitOperation] = useState(null);
  const [generatorStatus, setGeneratorStatus] = useState(null);
  const [generatorResult, setGeneratorResult] = useState(null);
  const [generatorBusy, setGeneratorBusy] = useState(false);
  const [generatorOperation, setGeneratorOperation] = useState(null);
  const [groupCandidateSession, setGroupCandidateSession] = useState(null);
  const [taskRegeneration, setTaskRegeneration] = useState(null);
  const [taskWorkflowOperation, setTaskWorkflowOperation] = useState(null);
  const [taskBatchPublicationOperation, setTaskBatchPublicationOperation] = useState(null);
  const [taskBatchPublicationResult, setTaskBatchPublicationResult] = useState(null);
  const [taskWorkflowFeedback, setTaskWorkflowFeedback] = useState({});
  const [taskWarningRationales, setTaskWarningRationales] = useState({});
  const [taskReviewNotes, setTaskReviewNotes] = useState({});
  const [generatorPreferences, setGeneratorPreferences] = useState({
    gradeRange: '初中',
    preferredAbilityIds: [],
    requestedFocusIds: [],
  });
  const [materialForm, setMaterialForm] = useState(createEmptyMaterialForm);
  const [notice, setNotice] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardDialogSaving, setDiscardDialogSaving] = useState(false);
  const [taskRemovalCandidate, setTaskRemovalCandidate] = useState(null);
  const [removedTaskHistory, setRemovedTaskHistory] = useState([]);
  const [duplicateMaterial, setDuplicateMaterial] = useState(null);
  const [materialAction, setMaterialAction] = useState(null);
  const [sharedStoreStatus, setSharedStoreStatus] = useState(null);
  const [baselinePreview, setBaselinePreview] = useState(null);
  const [materialPreviewExpanded, setMaterialPreviewExpanded] = useState(false);
  const pendingDiscardActionRef = useRef(null);
  const initialSelectionResolutionRef = useRef(true);
  const taskWorkflowInFlightRef = useRef(new Set());
  const taskBatchPublicationInFlightRef = useRef(false);
  const taskCommitInFlightRef = useRef(false);
  const taskCommitIdempotencyKeysRef = useRef(new Map());
  const materialFormHasInput = Boolean(
    materialForm.title.trim()
    || materialForm.content.trim()
    || materialForm.copyrightNote.trim()
    || materialForm.description.trim() !== '人工录入素材',
  );

  useEffect(() => {
    refresh(routeSelection)
      .catch((error) => setNotice(errorNotice(error)))
      .finally(() => setSnapshotReady(true));
    getMaterialObservationDraftGeneratorStatus().then(setGeneratorStatus);
  }, [routeSelection.materialVersionId, routeSelection.planId]);

  useEffect(() => {
    if (!snapshotReady) return;
    if (!selectedMaterialId) {
      clearMaterialWorkbenchSelection();
      return;
    }
    writeMaterialWorkbenchSelection({
      materialVersionId: selectedMaterialId,
      planId: selectedPlanId,
    });
  }, [selectedMaterialId, selectedPlanId, snapshotReady]);

  const selectedMaterial = useMemo(
    () => snapshot.materials.find((item) => item.materialVersionId === selectedMaterialId) || null,
    [snapshot.materials, selectedMaterialId],
  );
  const activeMaterials = useMemo(
    () => snapshot.materials.filter((item) => item.status !== 'retired'),
    [snapshot.materials],
  );
  const retiredMaterials = useMemo(
    () => snapshot.materials.filter((item) => item.status === 'retired'),
    [snapshot.materials],
  );
  const paragraphs = useMemo(() => splitParagraphs(selectedMaterial?.content || ''), [selectedMaterial]);
  const materialPlans = useMemo(
    () => collapseWorkingDraftPlans(
      snapshot.plans.filter((plan) => plan.materialVersionId === selectedMaterialId),
    ),
    [snapshot.plans, selectedMaterialId],
  );
  const selectedPlan = snapshot.plans.find((plan) => plan.materialObservationPlanId === selectedPlanId)
    || materialPlans[0]
    || null;
  const selectedValidation = selectedPlan
    ? snapshot.validations.find((value) => value.materialObservationPlanId === selectedPlan.materialObservationPlanId && value.planRevision === selectedPlan.revision)
    : null;
  const submissionSummary = useMemo(() => {
    if (!selectedPlan) return null;
    const taskPlans = selectedPlan.taskPlans || [];
    const uniqueLabels = (values) => [...new Set(values.filter(Boolean))];
    const abilities = uniqueLabels(taskPlans.map((task) => abilityLabels[task.abilityId] || task.abilityId));
    const directions = uniqueLabels(taskPlans.map((task) => dimensionLabels[task.primaryDimension] || task.primaryDimension));
    const materialRanges = uniqueLabels(taskPlans.map((task) => formatTaskAnchor(task, snapshot.anchors)));
    const checks = [
      {
        label: '所有训练任务均包含能力目标',
        passed: taskPlans.length > 0 && taskPlans.every((task) => Boolean(task.abilityId && task.observationFocus?.displayName)),
      },
      {
        label: '所有训练任务均包含观察目标',
        passed: taskPlans.length > 0 && taskPlans.every((task) => Boolean(task.observationGoal?.trim() && task.expectedStudentAction?.trim())),
      },
      {
        label: '所有训练任务均包含评分标准与作答范围',
        passed: taskPlans.length > 0 && taskPlans.every((task) => (
          task.resourceDraftSpecification?.rubric?.length > 0
          && Boolean(task.resourceDraftSpecification?.answerAcceptance)
        )),
      },
      {
        label: '当前训练计划已通过结构校验',
        passed: Boolean(selectedValidation?.passed),
      },
    ];
    return {
      abilities,
      directions,
      materialRanges,
      checks,
      ready: checks.every((check) => check.passed),
    };
  }, [selectedPlan, selectedValidation, snapshot.anchors]);
  const editableTaskIssues = useMemo(
    () => tasks.flatMap((task, index) => collectEditableTaskIssues(task, index)),
    [tasks],
  );
  const commandContext = {
    hasMaterial: Boolean(selectedMaterial),
    hasPlan: Boolean(selectedPlan),
    aiServiceReady: generatorStatus?.status === 'ready',
    generatorBusy,
    commandBusy: busy,
    taskEditorDirty,
    taskCount: tasks.length,
    taskLimit: MAX_TRAINING_TASK_COUNT,
    editableIssueCount: editableTaskIssues.length,
    candidateReady: Boolean(groupCandidateSession && generatorResult?.status === 'candidates_ready'),
    validationPassed: Boolean(selectedValidation?.passed),
    submissionReady: Boolean(submissionSummary?.ready),
  };
  const commandAvailability = Object.fromEntries(
    Object.values(MATERIAL_PRODUCTION_COMMANDS).map((command) => [
      command,
      getMaterialProductionCommandAvailability(command, commandContext),
    ]),
  );
  const validationTaskIssues = useMemo(
    () => selectedValidation && !selectedValidation.passed && !taskEditorDirty
      ? selectedValidation.issues.map((issue) => attachValidationIssueTarget(issue, tasks))
      : [],
    [selectedValidation, taskEditorDirty, tasks],
  );
  const taskReviewIssues = useMemo(
    () => dedupeTaskIssues([...editableTaskIssues, ...validationTaskIssues]),
    [editableTaskIssues, validationTaskIssues],
  );
  const taskReviewGroups = useMemo(
    () => tasks.map((task, index) => ({
      task,
      index,
      issues: taskReviewIssues.filter((issue) => issue.taskId === task.localId),
    })),
    [tasks, taskReviewIssues],
  );
  const planDrafts = useMemo(
    () => selectCurrentPlanDrafts(selectedPlan, snapshot.drafts),
    [selectedPlan, snapshot.drafts],
  );
  const workbenchDetails = useMemo(
    () => buildMaterialResourceWorkbenchDetails(snapshot),
    [snapshot],
  );
  const selectedMaterialResourceDetails = useMemo(
    () => scopeMaterialResourceWorkbenchDetails(workbenchDetails, selectedMaterialId),
    [workbenchDetails, selectedMaterialId],
  );
  const taskQuestionLifecycleById = useMemo(
    () => new Map(taskReviewGroups.map(({ task, issues }) => [
      task.observationTaskPlanId || task.localId,
      resolveTaskQuestionLifecycle({
        task,
        issues,
        plan: selectedPlan,
        planDrafts,
        draftReadiness: snapshot.draftReadiness,
        details: selectedMaterialResourceDetails,
      }),
    ])),
    [taskReviewGroups, selectedPlan, planDrafts, snapshot.draftReadiness, selectedMaterialResourceDetails],
  );
  const taskQuestionLifecycleSummary = useMemo(() => {
    const lifecycles = [...taskQuestionLifecycleById.values()];
    const summary = resolveTaskGroupSummary(lifecycles.map((item) => item.productionView));
    return {
      actionRequired: summary.actionRequired,
      pendingReview: summary.pendingConfirmation,
      approvedPendingPublication: summary.confirmedAwaitingPublication,
      published: summary.published,
    };
  }, [taskQuestionLifecycleById]);
  const hasLocalUnsavedTaskChanges = useMemo(
    () => (
      tasks.some((task) => task.editorDirty || !task.observationTaskPlanId)
      || removedTaskHistory.length > 0
    ),
    [tasks, removedTaskHistory],
  );
  const taskWorkingRecoveryKey = tasks
    .map(taskWorkingIdentity)
    .join('|');
  const savedWorkingTaskIds = useMemo(
    () => tasks
      .map(taskWorkingIdentity)
      .filter((trainingTaskId) => taskWorkingStates[trainingTaskId]?.status === 'saved'),
    [tasks, taskWorkingStates],
  );
  const taskPublicationCandidates = useMemo(
    () => [...taskQuestionLifecycleById.entries()].flatMap(([trainingTaskId, lifecycle]) => {
      const eligibility = resolveTaskPublicationEligibility(lifecycle.productionView);
      if (!eligibility.eligible || !eligibility.action || !lifecycle.draft) return [];
      return [{
        trainingTaskId,
        draftId: lifecycle.draft.draftId,
        expectedDraftRevision: lifecycle.draft.revision,
        action: eligibility.action,
      }];
    }),
    [taskQuestionLifecycleById],
  );
  const protectedTaskIds = useMemo(() => {
    if (!selectedPlan) return [];
    const protectedIds = new Set(
      selectedMaterialResourceDetails.publishedResources
        .filter((resource) => resource.materialObservationPlanId === selectedPlan.materialObservationPlanId)
        .map((resource) => resource.observationTaskPlanId),
    );
    for (const draft of planDrafts) {
      if (draft.status !== 'reviewed') continue;
      const taskTag = draft.tags.find((tag) => tag.startsWith('observation_task:'));
      if (taskTag) protectedIds.add(taskTag.slice('observation_task:'.length));
    }
    return [...protectedIds];
  }, [planDrafts, selectedMaterialResourceDetails.publishedResources, selectedPlan]);
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
    const nextTasks = selectedPlan
      ? selectedPlan.taskPlans.map((task, index) => planTaskToEditableTask(task, index, snapshot.anchors))
      : [];
    setTasks(nextTasks);
    setEditableTaskIds(new Set(nextTasks
      .filter((task) => task.sourceType !== 'ai_assisted')
      .map((task) => task.localId)));
    setTaskCardDisclosures({});
    setTaskWorkingStates({});
    setTaskCommitOperation(null);
    setTaskEditorDirty(false);
    setTaskRegeneration(null);
    setGeneratorResult(null);
    setGroupCandidateSession(null);
    setTaskRemovalCandidate(null);
    setRemovedTaskHistory([]);
    setTaskWorkflowOperation(null);
    setTaskBatchPublicationOperation(null);
    setTaskBatchPublicationResult(null);
    setTaskWorkflowFeedback({});
    setTaskWarningRationales({});
    setTaskReviewNotes({});
  }, [selectedMaterialId, selectedPlan?.materialObservationPlanId]);

  useEffect(() => {
    if (!selectedPlan || tasks.length === 0 || planDrafts.length === 0) return undefined;
    let cancelled = false;
    void Promise.all(tasks.map(async (task) => {
      const trainingTaskId = taskWorkingIdentity(task);
      if (!trainingTaskId) return null;
      const state = await getQuestionTaskWorkingContentState(trainingTaskId);
      return { trainingTaskId, state };
    })).then((results) => {
      if (cancelled) return;
      const recovered = results.filter(Boolean);
      if (recovered.length === 0) return;
      const stateById = Object.fromEntries(recovered.map(({ trainingTaskId, state }) => [
        trainingTaskId,
        state.status === 'missing'
          ? { status: 'clean', workingContent: null }
          : {
            status: state.status === 'current' ? 'saved' : 'base_revision_conflict',
            workingContent: state.workingContent,
            conflictReason: state.status === 'base_revision_conflict' ? state.reason : null,
          },
      ]));
      setTaskWorkingStates(stateById);
      setTasks((current) => current.map((task) => {
        const recoveredState = stateById[taskWorkingIdentity(task)];
        return recoveredState?.workingContent
          ? mergeWorkingContentIntoEditableTask(task, recoveredState.workingContent)
          : task;
      }));
      if (recovered.some(({ state }) => state.status !== 'missing')) setTaskEditorDirty(true);
    }).catch((error) => {
      if (!cancelled) setNotice(errorNotice(error));
    });
    return () => { cancelled = true; };
  }, [selectedPlan?.materialObservationPlanId, planDrafts, taskWorkingRecoveryKey]);

  useEffect(() => {
    setGeneratorResult(null);
    setGroupCandidateSession(null);
    setTaskRegeneration(null);
    setMaterialPreviewExpanded(false);
  }, [selectedMaterialId]);

  useEffect(() => {
    if (
      !routeSelection.editTasks
      || !routeSelection.materialVersionId
      || routeSelection.materialVersionId !== selectedMaterialId
    ) return;
    window.requestAnimationFrame(() => {
      document.querySelector('#training-task-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [
    routeSelection.editTasks,
    routeSelection.materialVersionId,
    selectedMaterialId,
  ]);

  async function refresh(preferred = {}) {
    const isInitialSelectionResolution = initialSelectionResolutionRef.current;
    initialSelectionResolutionRef.current = false;
    const next = await getMaterialResourceProductionSnapshot();
    setSnapshot(next);
    setSharedStoreStatus(next.sharedStoreStatus);
    const availableMaterials = next.materials.filter((item) => item.status !== 'retired');
    const rememberedSelection = readMaterialWorkbenchSelection();
    const resolvedSelection = resolveMaterialWorkbenchSelection({
      materials: next.materials,
      plans: next.plans,
      preferred: {
        materialVersionId: preferred.materialVersionId || '',
        planId: preferred.planId || '',
      },
      current: {
        materialVersionId: selectedMaterialId,
        planId: selectedPlanId,
      },
      remembered: rememberedSelection,
    });
    const materialId = resolvedSelection.materialVersionId;
    if (
      rememberedSelection?.materialVersionId
      && !availableMaterials.some((item) => item.materialVersionId === rememberedSelection.materialVersionId)
    ) {
      clearMaterialWorkbenchSelection();
    }
    if (availableMaterials.length === 0) {
      setMaterialMode('new');
    } else if (shouldOpenExistingMaterialMode({
      isInitialResolution: isInitialSelectionResolution,
      preferredMaterialVersionId: preferred.materialVersionId,
      resolvedMaterialVersionId: materialId,
    })) {
      setMaterialMode('existing');
    }
    setSelectedMaterialId(materialId);
    const plans = collapseWorkingDraftPlans(
      next.plans.filter((plan) => plan.materialVersionId === materialId),
    );
    const planId = plans.some(
      (plan) => plan.materialObservationPlanId === resolvedSelection.planId,
    )
      ? resolvedSelection.planId
      : plans[0]?.materialObservationPlanId || '';
    setSelectedPlanId(planId);
    return next;
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
    const duplicate = snapshot.materials.find(
      (material) => normalizeMaterialContent(material.content) === normalizeMaterialContent(materialForm.content),
    );
    if (duplicate) {
      setDuplicateMaterial(duplicate);
      return;
    }
    const material = await run(
      () => createProductionMaterial(materialForm),
      () => '素材已保存，可以由 AI 根据材料推荐 2–3 个独立训练任务。',
      (result) => ({ materialVersionId: result.materialVersionId }),
    );
    if (material) {
      setMaterialMode('existing');
      setMaterialForm(createEmptyMaterialForm());
    }
  }

  function clearMaterialForm() {
    if (!materialFormHasInput) return;
    const confirmed = window.confirm('确定清空当前未保存的素材内容吗？此操作无法撤销。');
    if (!confirmed) return;
    setMaterialForm(createEmptyMaterialForm());
    setDuplicateMaterial(null);
    setNotice(null);
  }

  function useDuplicateMaterial() {
    const material = duplicateMaterial;
    setDuplicateMaterial(null);
    if (!material) return;
    if (material.status === 'retired') {
      setNotice({
        type: 'error',
        message: `${formatMaterialTitle(material.title)}已停用。请先核对历史记录，再决定是否录入修订版本。`,
      });
      return;
    }
    setMaterialMode('existing');
    setSelectedMaterialId(material.materialVersionId);
    setSelectedPlanId('');
    setMaterialForm(createEmptyMaterialForm());
    setNotice({ type: 'success', message: `已切换到已有学习材料${formatMaterialTitle(material.title)}。` });
  }

  async function requestMaterialRemoval() {
    if (!selectedMaterial) return;
    setBusy(true);
    setNotice(null);
    try {
      const disposition = await getProductionMaterialDisposition(selectedMaterial.materialVersionId);
      setMaterialAction({ material: selectedMaterial, ...disposition });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmMaterialRemoval() {
    if (!materialAction) return;
    const { material, action } = materialAction;
    setBusy(true);
    setNotice(null);
    try {
      if (action === 'delete') {
        await deleteUnusedProductionMaterial(material.materialVersionId);
      } else {
        await retireProductionMaterial(material.materialVersionId);
      }
      setMaterialAction(null);
      await refresh();
      setToast({
        id: Date.now(),
        message: action === 'delete'
          ? `未使用的学习材料${formatMaterialTitle(material.title)}已删除。`
          : `学习材料${formatMaterialTitle(material.title)}已停用，历史训练与题目记录保持不变。`,
      });
    } catch (error) {
      setMaterialAction(null);
      setNotice(errorNotice(error));
    } finally {
      setBusy(false);
    }
  }

  async function reactivateMaterial(material) {
    setBusy(true);
    setNotice(null);
    try {
      await reactivateProductionMaterial(material.materialVersionId);
      if (retiredMaterials.length === 1) {
        await refresh({ materialVersionId: material.materialVersionId });
      } else {
        await refresh();
        setMaterialMode('retired');
      }
      setToast({
        id: Date.now(),
        message: `学习材料${formatMaterialTitle(material.title)}已重新启用。`,
      });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setBusy(false);
    }
  }

  async function refreshWorkbench() {
    setBusy(true);
    setRefreshing(true);
    setNotice(null);
    try {
      await refresh();
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setRefreshing(false);
      setBusy(false);
    }
  }

  function withUnsavedChangesGuard(action) {
    if (!hasLocalUnsavedTaskChanges) {
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
    restoreUnsavedTaskEdits();
    action?.();
  }

  async function saveChangesBeforeSwitch() {
    const dirtyTasks = tasks
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => task.editorDirty && task.observationTaskPlanId);
    if (
      dirtyTasks.length === 0
      || tasks.some((task) => !task.observationTaskPlanId)
      || removedTaskHistory.length > 0
    ) return;

    setDiscardDialogSaving(true);
    setNotice(null);
    try {
      for (const { task, index } of dirtyTasks) {
        const saved = await saveCurrentTaskWorkingContent(task, index, { silent: true });
        if (!saved) return;
      }
      const action = pendingDiscardActionRef.current;
      pendingDiscardActionRef.current = null;
      setDiscardDialogOpen(false);
      setToast({ id: Date.now(), message: '工作进度已保存。' });
      action?.();
    } finally {
      setDiscardDialogSaving(false);
    }
  }

  function restoreUnsavedTaskEdits() {
    if (!selectedPlan) {
      setTasks([]);
      setTaskEditorDirty(false);
      return;
    }
    const restoredTasks = selectedPlan.taskPlans.map((planTask, index) => {
      const restored = planTaskToEditableTask(planTask, index, snapshot.anchors);
      const workingState = taskWorkingStates[taskWorkingIdentity(planTask)];
      return workingState?.workingContent
        ? mergeWorkingContentIntoEditableTask(restored, workingState.workingContent)
        : restored;
    });
    setTasks(restoredTasks);
    setRemovedTaskHistory([]);
    setTaskEditorDirty(
      Object.values(taskWorkingStates).some((state) => (
        state.status === 'saved' || state.status === 'base_revision_conflict'
      )),
    );
  }

  function showExistingMaterials() {
    if (materialMode === 'existing') return;
    withUnsavedChangesGuard(() => {
      if (!snapshotReady) {
        setMaterialMode('existing');
        return;
      }
      const materialId = activeMaterials.some((item) => item.materialVersionId === selectedMaterialId)
        ? selectedMaterialId
        : '';
      setMaterialMode(activeMaterials.length > 0 ? 'existing' : 'new');
      setSelectedMaterialId(materialId);
    });
  }

  function showNewMaterialForm() {
    if (materialMode === 'new') return;
    withUnsavedChangesGuard(() => {
      setMaterialMode('new');
    });
  }

  function showRetiredMaterials() {
    if (materialMode === 'retired') return;
    withUnsavedChangesGuard(() => {
      setMaterialMode('retired');
      setActiveLoadPreset(null);
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

  async function runTaskWorkflowAction(lifecycle) {
    if (!lifecycle) return;
    const initialActionKind = lifecycle.cardPresentation?.primaryAction?.kind;
    const observationTaskPlanId = lifecycle.task?.observationTaskPlanId
      || lifecycle.item?.observationTaskPlanId;
    const planId = lifecycle.item?.materialObservationPlanId
      || selectedPlan?.materialObservationPlanId;
    if (!observationTaskPlanId || !planId) return;
    if (initialActionKind === 'focus_issue') return;
    if (initialActionKind === 'view_formal_resource') return;

    const operationKey = `${observationTaskPlanId}:publish_task`;
    if (taskWorkflowInFlightRef.current.has(operationKey)) return;
    taskWorkflowInFlightRef.current.add(operationKey);
    setTaskWorkflowOperation(operationKey);
    setTaskWorkflowFeedback((current) => ({ ...current, [observationTaskPlanId]: null }));
    try {
      let currentLifecycle = lifecycle;
      let currentSnapshot = snapshot;

      if (currentLifecycle.cardPresentation?.primaryAction?.kind === 'save_plan') {
        setTaskWorkflowFeedback((current) => ({
          ...current,
          [observationTaskPlanId]: { type: 'info', message: '正在保存任务修改…' },
        }));
        const saved = await savePlanRevision();
        if (!saved) return;
        currentSnapshot = await refresh({ materialVersionId: selectedMaterialId, planId });
        currentLifecycle = resolveTaskLifecycleFromSnapshot(currentSnapshot, lifecycle, planId);
      }

      const currentPlan = currentSnapshot.plans.find(
        (plan) => plan.materialObservationPlanId === planId,
      );
      if (currentPlan && currentPlan.status !== 'reviewed') {
        setTaskWorkflowFeedback((current) => ({
          ...current,
          [observationTaskPlanId]: { type: 'info', message: '正在确认训练计划…' },
        }));
        await executeConfirmTrainingPlanForTaskProductionCommand({
          planId,
          currentStatus: currentPlan.status,
        });
        currentSnapshot = await refresh({ materialVersionId: selectedMaterialId, planId });
        currentLifecycle = resolveTaskLifecycleFromSnapshot(currentSnapshot, lifecycle, planId);
      }

      for (let stageCount = 0; stageCount < 7; stageCount += 1) {
        const { draft, readiness } = currentLifecycle;
        const actionKind = currentLifecycle.cardPresentation?.primaryAction?.kind;
        if (actionKind === 'view_formal_resource' || currentLifecycle.status === 'published') break;

        if (actionKind === 'open_repair') {
          setTaskWorkflowFeedback((current) => ({
            ...current,
            [observationTaskPlanId]: { type: 'info', message: '正在创建题目草稿…' },
          }));
          const created = await executeCreateTaskQuestionCommand({ planId, observationTaskPlanId });
          if (created.status === 'failed') {
            throw new Error(created.issues[0] || '题目草稿创建失败，请重试。');
          }
        } else if (actionKind === 'run_check' && draft) {
          await executeQuestionCheckCommand({
            currentDraft: draft,
            onStageStart: (stage) => {
              const message = {
                draft_saved: '正在保存题目内容…',
                structure_checked: '正在检查题目结构…',
                assessment_completed: '正在生成完整质量检查记录…',
              }[stage] || '正在检查题目…';
              setTaskWorkflowFeedback((current) => ({
                ...current,
                [observationTaskPlanId]: { type: 'info', message },
              }));
            },
          });
        } else if (actionKind === 'open_confirmation' && draft) {
          const warnings = readiness?.qualityAssessment?.warnings || [];
          const existingAcknowledgements = new Map(
            (draft.warningAcknowledgements || []).map((record) => [record.warningCode, record.rationale]),
          );
          const rationales = taskWarningRationales[draft.draftId] || {};
          const warningAcknowledgements = warnings.map((warning) => ({
            warningCode: warning.code,
            rationale: (rationales[warning.code] || existingAcknowledgements.get(warning.code) || '').trim(),
          }));
          if (warningAcknowledgements.some((record) => !record.rationale)) {
            setTaskWorkflowFeedback((current) => ({
              ...current,
              [observationTaskPlanId]: { type: 'warning', message: '请填写质量提醒的保留理由，再继续发布。' },
            }));
            window.requestAnimationFrame(() => {
              const taskCard = document.querySelector(`[data-task-editor="${lifecycle.task?.localId || ''}"]`);
              taskCard?.setAttribute('open', '');
              taskCard?.querySelector('[data-task-production-workflow]')?.scrollIntoView({ block: 'nearest' });
            });
            return;
          }
          await executeSubmitFinalConfirmationCommand({
            draftId: draft.draftId,
            expectedDraftRevision: draft.revision,
            warningAcknowledgements,
          });
        } else if (actionKind === 'confirm' && draft) {
          await executeRecordFinalConfirmationCommand({
            draftId: draft.draftId,
            expectedDraftRevision: draft.revision,
            action: 'approve',
            reviewerId: 'local-reviewer',
            notes: taskReviewNotes[draft.draftId] || '',
            acceptedWarningCodes: (draft.warningAcknowledgements || []).map((record) => record.warningCode),
          });
        } else if (['publish', 'retry_publication'].includes(actionKind) && draft) {
          setTaskWorkflowFeedback((current) => ({
            ...current,
            [observationTaskPlanId]: { type: 'info', message: '正在发布正式题目…' },
          }));
          await executePublishConfirmedTaskCommand({
            draftId: draft.draftId,
            expectedDraftRevision: draft.revision,
            retryExistingPublication: actionKind === 'retry_publication',
          });
        } else {
          throw new Error('当前任务状态无法继续发布，请刷新后重试。');
        }

        currentSnapshot = await refresh({ materialVersionId: selectedMaterialId, planId });
        currentLifecycle = resolveTaskLifecycleFromSnapshot(currentSnapshot, lifecycle, planId);
      }

      if (currentLifecycle.status !== 'published') {
        throw new Error('发布流程尚未完成，请根据当前任务提示继续处理。');
      }
      const successMessage = '题目已经发布成功！';
      setTaskWorkflowFeedback((current) => ({
        ...current,
        [observationTaskPlanId]: { type: 'success', message: successMessage },
      }));
      setToast({ id: Date.now(), message: successMessage });
    } catch (error) {
      const feedback = errorNotice(error);
      setTaskWorkflowFeedback((current) => ({ ...current, [observationTaskPlanId]: feedback }));
    } finally {
      taskWorkflowInFlightRef.current.delete(operationKey);
      setTaskWorkflowOperation((current) => (current === operationKey ? null : current));
    }
  }

  function revealTaskFormalResource(event, taskId) {
    event.preventDefault();
    event.stopPropagation();
    const taskCard = event.currentTarget.closest('details[data-task-editor]');
    taskCard?.setAttribute('open', '');
    setTaskCardDisclosures((current) => (
      setTaskCardDisclosureOpen(current, taskId, 'formal_resource', true)
    ));
    window.requestAnimationFrame(() => {
      const formalResource = taskCard?.querySelector('[data-formal-resource-summary]');
      formalResource?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  async function runTaskPublicationBatch(items = taskPublicationCandidates) {
    if (taskBatchPublicationInFlightRef.current || items.length === 0) return;
    taskBatchPublicationInFlightRef.current = true;
    setTaskBatchPublicationOperation({
      draftIds: items.map((item) => item.draftId),
      activeDraftId: null,
    });
    setTaskBatchPublicationResult(null);
    setTaskWorkflowFeedback((current) => {
      const next = { ...current };
      items.forEach((item) => { next[item.draftId] = null; });
      return next;
    });
    try {
      const result = await executePublishConfirmedTaskBatchCommand({
        items,
        publishItem: executePublishConfirmedTaskCommand,
        onItemStart: (item) => {
          setTaskBatchPublicationOperation((current) => current
            ? { ...current, activeDraftId: item.draftId }
            : current);
          setTaskWorkflowFeedback((current) => ({
            ...current,
            [item.draftId]: { type: 'info', message: '正在发布当前题目…' },
          }));
        },
        onItemComplete: (item) => {
          setTaskWorkflowFeedback((current) => ({
            ...current,
            [item.draftId]: item.status === 'failed'
              ? { type: 'error', message: item.message }
              : { type: 'success', message: item.message },
          }));
        },
      });
      setTaskBatchPublicationResult(result);
      await refresh({ materialVersionId: selectedMaterialId, planId: selectedPlanId });
      const message = result.status === 'completed'
        ? `已发布 ${result.completed} 道题目。`
        : result.status === 'partially_completed'
          ? `已发布 ${result.completed} 道，${result.failed} 道未完成，可单独重试。`
          : `${result.failed} 道题目发布未完成，可重试。`;
      setToast({ id: Date.now(), message });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      taskBatchPublicationInFlightRef.current = false;
      setTaskBatchPublicationOperation(null);
    }
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
        : '《潼关》校准案例已载入，六项真实观测任务已显示并等待最终确认。',
      (result) => ({ materialVersionId: result.materialVersionId, planId: result.materialObservationPlanId }),
    );
    if (result) setActiveLoadPreset('tongguan');
  }

  function requireAvailableCommand(command) {
    const availability = commandAvailability[command];
    if (availability.enabled) return true;
    setNotice({ type: 'error', message: availability.reason });
    return false;
  }

  async function savePlanRevision() {
    if (!requireAvailableCommand(MATERIAL_PRODUCTION_COMMANDS.savePlanRevision)) return null;
    const isWorkingDraftUpdate = Boolean(selectedPlan)
      && ['draft', 'revision_required'].includes(selectedPlan.status);
    const result = await run(
      () => executeSavePlanRevisionCommand({
        materialVersionId: selectedMaterialId,
        sourcePlanId: selectedPlan?.materialObservationPlanId,
        tasks: tasks.map(toTaskInput),
      }),
      (result) => result.validation.passed
        ? isWorkingDraftUpdate
          ? '工作草稿已更新，并通过内容检查。'
          : '训练任务已保存并通过内容检查。'
        : isWorkingDraftUpdate
          ? '工作草稿已更新，但仍有内容需要调整。'
          : '训练任务已保存，但仍有内容需要调整。',
      (result) => ({ materialVersionId: selectedMaterialId, planId: result.plan.materialObservationPlanId }),
    );
    if (result) {
      setRemovedTaskHistory([]);
      setTaskRemovalCandidate(null);
      setTaskEditorDirty(false);
    }
    return result;
  }

  function planSupplementCandidates() {
    if (!requireAvailableCommand(MATERIAL_PRODUCTION_COMMANDS.planSupplementCandidates)) return;
    return requestTaskGroupCandidates('supplement_group');
  }

  function planReplacementGroup() {
    if (!requireAvailableCommand(MATERIAL_PRODUCTION_COMMANDS.planReplacementGroup)) return;
    return requestTaskGroupCandidates('replace_group');
  }

  async function requestTaskGroupCandidates(operationType) {
    if (!selectedMaterial) return;
    const generationRequest = resolveTrainingTaskGenerationRequest(operationType, tasks.length);
    if (generationRequest.candidateCount === 0) {
      setNotice({ type: 'error', message: `当前任务组已达到 ${MAX_TRAINING_TASK_COUNT} 个任务，无需继续补充。` });
      return;
    }
    setGeneratorBusy(true);
    setGeneratorOperation(operationType);
    setGeneratorResult(null);
    setGroupCandidateSession(null);
    setNotice(null);
    try {
      const existingInventory = operationType === 'replace_group'
        ? buildGeneratorInventory({
          materialVersionId: selectedMaterialId,
          plans: materialPlans.filter((plan) => plan.materialObservationPlanId !== selectedPlan?.materialObservationPlanId),
          drafts: snapshot.drafts,
          tasks: [],
          includeEditableTasks: false,
          previousCandidates: [],
        })
        : generatorInventory;
      const requestedFocus = generatorPreferences.requestedFocusIds
        .map((focusId) => trainingDirectionLabels[focusId])
        .join('；');
      const currentCoverage = summarizeTrainingTaskGroupCoverage(tasks);
      const currentCoverageContext = operationType === 'supplement_group'
        ? `当前已覆盖能力：${currentCoverage.abilityIds.map((id) => abilityLabels[id] || id).join('、') || '无'}；当前已覆盖方向：${currentCoverage.dimensionIds.map((id) => dimensionLabels[id] || id).join('、') || '无'}`
        : '';
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
          candidateCount: generationRequest.candidateCount,
          planningIntent: generationRequest.planningIntent,
          preferredAbilityIds: generatorPreferences.preferredAbilityIds,
          requestedFocus: [
            operationType === 'replace_group'
              ? '重新规划完整候选任务组，覆盖方向应形成互补'
              : '补充当前任务组缺少的训练方向，不重复已有任务',
            currentCoverageContext,
            requestedFocus,
          ].filter(Boolean).join('；'),
        },
        existingInventory,
      });
      setGeneratorResult(result);
      if (result.status === 'candidates_ready') {
        const candidateTasks = result.candidates.map(generatorCandidateToEditableTask);
        setGroupCandidateSession(createTrainingTaskGroupCandidateSession({
          candidateGroupId: `task-group-${result.requestId || createGeneratorRequestId(selectedMaterial.materialVersionId)}`,
          operationType,
          basedOnPlanRevision: selectedPlan?.revision || 0,
          candidateTasks,
        }));
      }
      setNotice(result.status === 'candidates_ready'
        ? {
          type: 'success',
          message: operationType === 'replace_group'
            ? tasks.length === 0
              ? `已生成 ${result.candidates.length} 个首批候选训练任务，请确认后采用。`
              : `已生成包含 ${result.candidates.length} 个任务的替代候选组。当前任务组尚未改变。`
            : `已生成 ${result.candidates.length} 个补充候选。请选择需要加入当前任务组的任务。`,
        }
        : result.status === 'provider_failed'
          ? { type: 'error', message: 'AI 服务本次调用未完成，没有生成候选，也没有写入任何正式记录。请查看具体原因后重试。' }
          : { type: 'error', message: '本次候选不足或存在结构问题，未导入也未写入任何正式记录。' });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setGeneratorBusy(false);
      setGeneratorOperation(null);
    }
  }

  async function regenerateSingleTask(task, index) {
    if (!requireAvailableCommand(MATERIAL_PRODUCTION_COMMANDS.regenerateSingleTask)) return;
    const attemptId = createSingleTaskRegenerationAttemptId(task.observationTaskPlanId);
    setTaskRegeneration({
      status: 'generating',
      sourcePlanId: selectedPlan.materialObservationPlanId,
      sourceTaskId: task.observationTaskPlanId,
      sourceTask: task,
      taskIndex: index,
      attemptId,
    });
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
          gradeRange: '初中',
          candidateCount: 3,
          preferredAbilityIds: [task.abilityId],
          requestedFocus: singleTaskRegenerationFocus(task),
        },
        existingInventory: buildSingleTaskRegenerationInventory(selectedPlan, task),
      });
      const candidate = [...result.candidates, ...result.withheldCandidates]
        .find((item) => (
          item.primaryAbilityId === task.abilityId
          && item.observationDimension === task.primaryDimension
        ));
      if (!candidate) {
        setTaskRegeneration({
          status: 'error',
          sourcePlanId: selectedPlan.materialObservationPlanId,
          sourceTaskId: task.observationTaskPlanId,
          sourceTask: task,
          taskIndex: index,
          attemptId,
          message: '本轮没有生成符合当前能力与训练方向的候选。原任务未改变，请再次生成或保留原内容。',
        });
        return;
      }
      setTaskRegeneration({
        status: 'ready',
        sourcePlanId: selectedPlan.materialObservationPlanId,
        sourceTaskId: task.observationTaskPlanId,
        sourceTask: task,
        taskIndex: index,
        attemptId,
        candidateTask: createLockedRegenerationCandidate(candidate, task, index),
      });
    } catch (error) {
      setTaskRegeneration({
        status: 'error',
        sourcePlanId: selectedPlan.materialObservationPlanId,
        sourceTaskId: task.observationTaskPlanId,
        sourceTask: task,
        taskIndex: index,
        attemptId,
        message: createWorkbenchErrorNotice(error).message,
      });
    }
  }

  function adoptSingleTaskCandidate() {
    if (taskRegeneration?.status !== 'ready') return;
    const current = taskRegeneration;
    try {
      if (!selectedPlan || current.sourcePlanId !== selectedPlan.materialObservationPlanId) {
        throw new Error('single_task_candidate_stale');
      }
      const result = adoptSingleTrainingTaskCandidate({
        currentTasks: tasks,
        sourceTaskId: current.sourceTaskId,
        candidateTask: current.candidateTask,
      });
      setTasks(result.tasks);
      setEditableTaskIds((currentIds) => {
        const next = new Set(currentIds);
        if (result.adoptedTask.localId) next.add(result.adoptedTask.localId);
        return next;
      });
      setTaskEditorDirty(true);
      setTaskRegeneration(null);
      setNotice({
        type: 'success',
        message: result.changed
          ? '候选已替换当前任务的编辑内容。确认任务并保存前，不会创建新版本。'
          : '候选与当前任务没有实质差异，编辑内容未改变。',
      });
    } catch (error) {
      setTaskRegeneration({
        ...current,
        status: 'error',
        message: createWorkbenchErrorNotice(error).message,
      });
    }
  }

  function adoptCandidates() {
    if (!requireAvailableCommand(MATERIAL_PRODUCTION_COMMANDS.adoptCandidates)) return;
    if (generatorResult?.status !== 'candidates_ready' || !groupCandidateSession) return;
    try {
      const result = adoptTrainingTaskGroupCandidate({
        session: groupCandidateSession,
        currentTasks: tasks,
        currentPlanRevision: selectedPlan?.revision || 0,
        protectedTaskIds,
        maxTasks: MAX_TRAINING_TASK_COUNT,
      });
      if (!result.changed) {
        setNotice({
          type: 'error',
          message: groupCandidateSession.operationType === 'supplement_group'
            ? `所选候选与当前任务重复，或任务组已达到 ${MAX_TRAINING_TASK_COUNT} 个任务，未加入编辑区。`
            : '替代候选组与当前任务组没有实质差异。',
        });
        return;
      }
      setTasks(result.tasks);
      setEditableTaskIds(new Set());
      setTaskEditorDirty(true);
      setGeneratorResult(null);
      setGroupCandidateSession(null);
      setNotice({
        type: 'success',
        message: groupCandidateSession.operationType === 'replace_group'
          ? tasks.length === 0
            ? `已将 ${result.adoptedCandidateTaskIds.length} 个首批候选加入训练任务编辑区。保存前不会创建新版本。`
            : `已用 ${result.adoptedCandidateTaskIds.length} 个候选替换本地任务组。保存前不会创建新版本。`
          : `已将 ${result.adoptedCandidateTaskIds.length} 个候选加入本地任务组。保存前不会创建新版本。`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error && error.message === 'candidate_revision_stale'
          ? '当前训练任务版本已变化，这批候选已过期。请重新生成候选。'
          : '候选任务采用失败，请重新生成后再试。',
      });
    }
  }

  function discardCandidates() {
    const replacing = groupCandidateSession?.operationType === 'replace_group';
    const discardingInitialGroup = replacing && tasks.length === 0;
    setGeneratorResult(null);
    setGroupCandidateSession(null);
    setNotice({
      type: 'success',
      message: discardingInitialGroup
        ? '首批候选已放弃，当前尚未建立训练任务。'
        : replacing
          ? '已保留当前任务组，替代候选已放弃。'
          : '补充候选已放弃，当前任务组未改变。',
    });
  }

  function toggleGeneratedCandidate(candidateId) {
    setGroupCandidateSession((current) => current
      ? toggleSupplementCandidateSelection(current, candidateId)
      : current);
  }

  function selectGeneratedCandidatesWithinLimit(candidateId) {
    if (!groupCandidateSession || groupCandidateSession.operationType !== 'supplement_group') return;
    const selected = groupCandidateSession.selectedCandidateTaskIds.includes(candidateId);
    if (!selected && tasks.length + groupCandidateSession.selectedCandidateTaskIds.length >= MAX_TRAINING_TASK_COUNT) {
      setNotice({ type: 'error', message: `每个任务组最多保留 ${MAX_TRAINING_TASK_COUNT} 个任务。请先取消一个候选或删除已有任务。` });
      return;
    }
    toggleGeneratedCandidate(candidateId);
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

  async function exportBrowserBaseline() {
    setBusy(true);
    setNotice(null);
    try {
      const baseline = await exportCurrentBrowserFormalResourceBaseline();
      downloadFormalResourceBaseline(baseline);
      setBaselinePreview(baseline);
      setToast({
        id: Date.now(),
        message: `当前浏览器资源已导出：${baseline.counts.materials} 篇学习材料，${baseline.counts.drafts} 道待最终确认题目。`,
      });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setBusy(false);
    }
  }

  async function initializeSharedBaseline() {
    if (!baselinePreview) return;
    const confirmed = window.confirm(
      '将当前浏览器导出的资源设为唯一共享基线？请确认其他浏览器的数据也已单独导出备份。初始化后，所有浏览器将读取这套共享资源。',
    );
    if (!confirmed) return;
    setBusy(true);
    setNotice(null);
    try {
      const status = await initializeSharedFormalResourceBaseline(baselinePreview);
      setSharedStoreStatus(status);
      setBaselinePreview(null);
      await refresh();
      setToast({
        id: Date.now(),
        message: '共享正式资源库已建立，其他浏览器刷新后将读取同一套资源。',
      });
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setBusy(false);
    }
  }

  function updateTask(index, patch) {
    const targetTask = tasks[index];
    const trainingTaskId = targetTask?.observationTaskPlanId;
    setTaskEditorDirty(true);
    if (trainingTaskId) {
      setTaskWorkingStates((current) => ({
        ...current,
        [trainingTaskId]: {
          ...(current[trainingTaskId] || {}),
          status: 'dirty',
        },
      }));
    }
    setTasks((current) => current.map((task, taskIndex) => {
      if (taskIndex !== index) return task;
      const adjustedFields = Object.keys(patch).filter((field) => !['taskAttributeAdjusted', 'manuallyAdjustedFields', 'editorDirty'].includes(field));
      return {
        ...task,
        ...patch,
        taskAttributeAdjusted: task.sourceType === 'ai_assisted' || task.taskAttributeAdjusted,
        manuallyAdjustedFields: [...new Set([...(task.manuallyAdjustedFields || []), ...adjustedFields])],
        editorDirty: true,
      };
    }));
  }

  function requestTaskRemoval(task, index, taskEditable) {
    if (!canRemoveTrainingTask(tasks.length)) {
      setNotice({
        type: 'error',
        message: `每个训练任务组至少保留 ${MIN_TRAINING_TASK_COUNT} 个任务，当前不能继续删除。`,
      });
      return;
    }
    setTaskRemovalCandidate({
      index,
      task,
      title: taskEditorTitle(index),
      wasEditable: taskEditable,
    });
  }

  function confirmTaskRemoval() {
    if (!taskRemovalCandidate) return;
    const currentIndex = tasks.findIndex(
      (task) => task.localId === taskRemovalCandidate.task.localId,
    );
    if (currentIndex < 0) {
      setTaskRemovalCandidate(null);
      return;
    }

    const result = removeTrainingTaskAt(
      tasks,
      currentIndex,
      taskRemovalCandidate.wasEditable,
    );
    setTasks(result.tasks);
    setRemovedTaskHistory((current) => [
      ...current,
      {
        ...result.removed,
        title: taskRemovalCandidate.title,
      },
    ]);
    setTaskRemovalCandidate(null);
    setTaskEditorDirty(true);
    setEditableTaskIds((current) => {
      const next = new Set(current);
      next.delete(taskRemovalCandidate.task.localId);
      return next;
    });
  }

  function undoLastTaskRemoval() {
    const removed = removedTaskHistory.at(-1);
    if (!removed) return;
    setTasks((current) => restoreRemovedTrainingTask(current, removed));
    if (removed.wasEditable) {
      setEditableTaskIds((current) => new Set([...current, removed.task.localId]));
    }
    setRemovedTaskHistory((current) => current.slice(0, -1));
    setTaskEditorDirty(true);
    setToast({
      id: Date.now(),
      message: `${removed.title}已恢复，保存任务组前不会创建新版本。`,
    });
  }

  function enableTaskEditing(task) {
    setEditableTaskIds((current) => new Set([...current, task.localId]));
    setTaskCardDisclosures((current) => enterTaskCardCalibration(current, task.localId));
  }

  async function saveCurrentTaskWorkingContent(task, index, options = {}) {
    const trainingTaskId = taskWorkingIdentity(task);
    const lifecycle = task.observationTaskPlanId
      ? taskQuestionLifecycleById.get(task.observationTaskPlanId)
      : null;
    const draft = lifecycle?.draft;
    if (!trainingTaskId || !draft) {
      if (!options.silent) {
        setNotice({
          type: 'error',
          message: '当前任务尚未建立活动题目草稿，暂时不能单独保存工作进度。请先保存训练任务。',
        });
      }
      return false;
    }

    setTaskWorkingStates((current) => ({
      ...current,
      [trainingTaskId]: {
        ...(current[trainingTaskId] || {}),
        status: 'saving',
      },
    }));
    try {
      const workingContent = await saveQuestionTaskWorkingContent({
        trainingTaskId,
        questionLineageId: draft.resourceId,
        baseDraftId: draft.draftId,
        baseRevision: draft.revision,
        content: buildWorkingQuestionEditableFields(task, draft),
        taskContent: buildTrainingTaskEditableFields(task),
      });
      setTaskWorkingStates((current) => ({
        ...current,
        [trainingTaskId]: {
          status: 'saved',
          workingContent,
          conflictReason: null,
        },
      }));
      setTasks((current) => current.map((item, taskIndex) => (
        taskIndex === index ? { ...item, editorDirty: false } : item
      )));
      setTaskEditorDirty(true);
      if (!options.silent) {
        setToast({
          id: Date.now(),
          message: '工作进度已保存，尚未提交检查。',
        });
      }
      return true;
    } catch (error) {
      if (error?.code === 'WORKING_TASK_CONTENT_BASE_CONFLICT') {
        const conflictState = await getQuestionTaskWorkingContentState(trainingTaskId);
        setTaskWorkingStates((current) => ({
          ...current,
          [trainingTaskId]: {
            status: 'base_revision_conflict',
            workingContent: conflictState.workingContent || current[trainingTaskId]?.workingContent,
            conflictReason: conflictState.reason || 'revision_changed',
          },
        }));
      } else {
        setTaskWorkingStates((current) => ({
          ...current,
          [trainingTaskId]: {
            ...(current[trainingTaskId] || {}),
            status: 'save_failed',
          },
        }));
      }
      if (!options.silent) setNotice(errorNotice(error));
      return false;
    }
  }

  async function reapplyCurrentTaskWorkingContent(task, index) {
    const trainingTaskId = taskWorkingIdentity(task);
    const lifecycle = task.observationTaskPlanId
      ? taskQuestionLifecycleById.get(task.observationTaskPlanId)
      : null;
    const draft = lifecycle?.draft;
    if (!trainingTaskId || !draft) return;
    setTaskWorkingStates((current) => ({
      ...current,
      [trainingTaskId]: {
        ...(current[trainingTaskId] || {}),
        status: 'saving',
      },
    }));
    try {
      const workingContent = await rebaseQuestionTaskWorkingContent({
        trainingTaskId,
        questionLineageId: draft.resourceId,
        content: buildWorkingQuestionEditableFields(task, draft),
        taskContent: buildTrainingTaskEditableFields(task),
      });
      setTaskWorkingStates((current) => ({
        ...current,
        [trainingTaskId]: { status: 'saved', workingContent, conflictReason: null },
      }));
      setTasks((current) => current.map((item, taskIndex) => (
        taskIndex === index ? { ...item, editorDirty: false } : item
      )));
      setTaskEditorDirty(true);
      setToast({ id: Date.now(), message: '工作修改已基于当前正式内容重新保存。' });
    } catch (error) {
      setTaskWorkingStates((current) => ({
        ...current,
        [trainingTaskId]: { ...(current[trainingTaskId] || {}), status: 'save_failed' },
      }));
      setNotice(errorNotice(error));
    }
  }

  async function discardCurrentTaskWorkingContent(task, index) {
    const trainingTaskId = taskWorkingIdentity(task);
    if (!trainingTaskId) return;
    await discardQuestionTaskWorkingContent(trainingTaskId);
    const savedTask = selectedPlan?.taskPlans.find(
      (item) => taskWorkingIdentity(item) === trainingTaskId,
    );
    if (savedTask) {
      setTasks((current) => current.map((item, taskIndex) => (
        taskIndex === index
          ? planTaskToEditableTask(savedTask, index, snapshot.anchors)
          : item
      )));
    }
    setTaskWorkingStates((current) => ({
      ...current,
      [trainingTaskId]: { status: 'clean', workingContent: null },
    }));
    setToast({ id: Date.now(), message: '已放弃该任务的工作修改。' });
  }

  function exitTaskEditing(task, index) {
    const savedTask = selectedPlan?.taskPlans.find(
      (item) => item.observationTaskPlanId === task.observationTaskPlanId,
    );
    if (!savedTask) return;
    if (task.editorDirty && !window.confirm('退出人工校准将放弃当前任务尚未保存的修改，是否继续？')) return;

    setTasks((current) => {
      const workingState = taskWorkingStates[taskWorkingIdentity(task)];
      const restoredTask = workingState?.workingContent
        ? mergeWorkingContentIntoEditableTask(
          planTaskToEditableTask(savedTask, index, snapshot.anchors),
          workingState.workingContent,
        )
        : planTaskToEditableTask(savedTask, index, snapshot.anchors);
      const nextTasks = current.map((item, taskIndex) => (
        taskIndex === index ? restoredTask : item
      ));
      const savedTaskIds = new Set(
        (selectedPlan?.taskPlans || []).map((item) => item.observationTaskPlanId),
      );
      const hasStructuralChanges = nextTasks.length !== (selectedPlan?.taskPlans.length || 0)
        || nextTasks.some((item) => (
          !item.observationTaskPlanId || !savedTaskIds.has(item.observationTaskPlanId)
        ));
      setTaskEditorDirty(
        hasStructuralChanges || nextTasks.some((item) => item.editorDirty),
      );
      return nextTasks;
    });
    setEditableTaskIds((current) => {
      const next = new Set(current);
      next.delete(task.localId);
      return next;
    });
    setTaskCardDisclosures((current) => exitTaskCardCalibration(current, task.localId));
    setTaskRegeneration((current) => (
      current?.sourceTaskId === task.observationTaskPlanId ? null : current
    ));
  }

  async function submitWorkingTaskChanges(requestedTaskIds) {
    if (!selectedPlan || !selectedMaterialId || taskCommitInFlightRef.current) return;
    const currentTaskIds = [...new Set(requestedTaskIds)]
      .filter((trainingTaskId) => taskWorkingStates[trainingTaskId]?.status === 'saved');
    if (currentTaskIds.length === 0) {
      setNotice({ type: 'error', message: '当前没有已保存且等待提交检查的任务修改。' });
      return;
    }

    const signature = `${selectedMaterialId}:${[...currentTaskIds].sort().join('|')}`;
    const idempotencyKey = taskCommitIdempotencyKeysRef.current.get(signature)
      || createTaskCommitIdempotencyKey(signature);
    taskCommitIdempotencyKeysRef.current.set(signature, idempotencyKey);
    taskCommitInFlightRef.current = true;
    setTaskCommitOperation({ taskIds: currentTaskIds, signature });
    setNotice(null);
    try {
      const result = await commitQuestionTaskWorkingChanges({
        planId: selectedPlan.materialObservationPlanId,
        materialVersionId: selectedMaterialId,
        requestedTaskIds: currentTaskIds,
        idempotencyKey,
      });
      const failedTasks = result.taskResults.filter((item) => Boolean(item.failedStage));
      if (result.status === 'completed' || result.status === 'no_changes') {
        taskCommitIdempotencyKeysRef.current.delete(signature);
      }
      await refresh({
        materialVersionId: selectedMaterialId,
        planId: result.committedPlanId || selectedPlan.materialObservationPlanId,
      });
      if (failedTasks.length > 0 || result.groupAssessmentStatus === 'failed') {
        setNotice({
          type: 'error',
          message: failedTasks.length > 0
            ? `${failedTasks.length} 个任务尚未完成提交或检查，已完成阶段不会重复执行，可以直接重试。`
            : '单题修改已提交，但任务组覆盖检查未完成，可以直接重试检查。',
        });
      } else {
        setToast({
          id: Date.now(),
          message: currentTaskIds.length === 1
            ? '当前任务已提交并完成检查。'
            : `${currentTaskIds.length} 个任务已提交并完成检查。`,
        });
      }
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      taskCommitInFlightRef.current = false;
      setTaskCommitOperation(null);
    }
  }

  function focusTaskIssue(issue) {
    if (!issue.targetId) return;
    if (issue.taskId) {
      setEditableTaskIds((current) => new Set([...current, issue.taskId]));
    }
    const target = document.getElementById(issue.targetId);
    if (!target) return;
    let details = target.closest('details');
    while (details) {
      details.open = true;
      details = details.parentElement?.closest('details');
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
      }));
  }

  return (
    <div className="material-resource-workbench min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1360px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <Link to="/internal" aria-label="返回内部入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"><ArrowLeft size={18} /></Link>
            <div>
              <h1 className="text-lg font-semibold">素材资源录入</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={requestLoadTongguanCalibration} disabled={busy} className={`hidden h-10 items-center rounded-md border px-3 text-sm font-semibold disabled:opacity-50 md:flex ${activeLoadPreset === 'tongguan' ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              使用《潼关》校准案例
            </button>
            <button type="button" onClick={requestLoadBatchA} disabled={busy} className={`hidden h-10 items-center rounded-md border px-3 text-sm font-semibold disabled:opacity-50 sm:flex ${activeLoadPreset === 'batch_a' ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              使用 Batch A 资源包
            </button>
            <RefreshIconButton
              onClick={refreshWorkbench}
              busy={refreshing}
              disabled={busy}
              label="刷新工作台数据"
              busyLabel="正在刷新工作台数据"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-5 pb-7 pt-4 md:px-8 md:pb-9 md:pt-4">
        {usesNonCanonicalLocalPort && (
          <div role="alert" className="mb-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            当前端口不是固定入口 5174。浏览器会分别保存不同端口的数据，请停止录入并改用
            {' '}
            <strong>http://127.0.0.1:5174/#/material-resource-workbench</strong>
            。
          </div>
        )}
        {sharedStoreStatus && !sharedStoreStatus.initialized && (
          <section className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-5 py-4" aria-labelledby="shared-baseline-title">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 id="shared-baseline-title" className="text-base font-semibold text-amber-950">正式资源尚未迁移到共享存储</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-900">
                  请分别在内置浏览器和标准浏览器导出快照，再选择内容正确的一侧作为唯一共享基线。系统不会自动合并或覆盖两侧数据。
                </p>
                {baselinePreview && (
                  <p className="mt-2 text-sm font-medium text-amber-950">
                    当前快照：{baselinePreview.counts.materials} 篇学习材料、{baselinePreview.counts.plans} 个训练计划、{baselinePreview.counts.drafts} 道待最终确认题目。
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={exportBrowserBaseline}
                  disabled={busy}
                  className="h-10 rounded-md border border-emerald-600 bg-white px-4 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                >
                  导出当前浏览器快照
                </button>
                <button
                  type="button"
                  onClick={initializeSharedBaseline}
                  disabled={busy || !baselinePreview}
                  className="h-10 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  设为共享基线
                </button>
              </div>
            </div>
          </section>
        )}
        {notice && (
          <div role="status" className={`mt-5 border-l-4 px-4 py-3 text-sm leading-6 ${notice.type === 'error' ? 'border-red-500 bg-red-50 text-red-800' : 'border-emerald-500 bg-emerald-50 text-emerald-800'}`}>
            <p>{notice.message}</p>
            {notice.errorCode && (
              <p className="mt-1 text-xs opacity-80">
                错误码：{notice.errorCode}
                {notice.objectId ? ` · 对象：${notice.objectId}` : ''}
                {` · ${notice.recoveryMessage}`}
              </p>
            )}
          </div>
        )}

        <div className="mt-2 space-y-6">
          <section id="material-resource-editor" className="scroll-mt-28">
            <div className="flex justify-center">
              <div className="workbench-mode-switch inline-flex items-center p-1" aria-label="素材录入方式">
                <button type="button" onClick={showNewMaterialForm} className={`workbench-mode-button h-10 w-[120px] whitespace-nowrap rounded-md ${materialMode === 'new' ? 'is-active' : 'text-slate-600'}`}>素材录入</button>
                <button type="button" onClick={showExistingMaterials} disabled={snapshotReady && activeMaterials.length === 0} className={`workbench-mode-button h-10 w-[120px] whitespace-nowrap rounded-md ${materialMode === 'existing' ? 'is-active' : 'text-slate-600'} disabled:opacity-40`}>已有素材</button>
                <button type="button" onClick={showRetiredMaterials} disabled={!snapshotReady || retiredMaterials.length === 0} className={`workbench-mode-button h-10 w-[120px] whitespace-nowrap rounded-md ${materialMode === 'retired' ? 'is-active' : 'text-slate-600'} disabled:opacity-40`}>停用素材（{retiredMaterials.length}）</button>
              </div>
            </div>

            {materialMode === 'existing' && !snapshotReady && (
              <p className="mt-5 text-sm text-slate-500" role="status">正在载入已有素材…</p>
            )}
            {materialMode === 'existing' && activeMaterials.length > 0 && (
              <div className="mt-5">
                <label className="block text-sm font-semibold">
                  已有素材（{activeMaterials.length}）
                  <select value={selectedMaterialId} onChange={(event) => selectExistingMaterial(event.target.value)} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal">
                    <option value="">请选择一篇学习材料</option>
                    {activeMaterials.map((material) => <option key={material.materialVersionId} value={material.materialVersionId}>{material.title}</option>)}
                  </select>
                </label>
                {selectedMaterial && (
                  <section className="mt-6 bg-transparent" aria-labelledby="selected-material-summary-title">
                    <div
                      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:grid-rows-[1.25rem_auto] sm:gap-y-1"
                      aria-label={`${selectedMaterial.title}的素材信息`}
                    >
                      <p className="px-3 text-sm leading-5 text-slate-500 sm:col-start-1 sm:row-start-1 sm:px-4">当前素材</p>
                      <h2 id="selected-material-summary-title" className="flex min-h-10 flex-wrap items-center gap-x-2 px-3 text-base font-semibold leading-7 text-slate-950 sm:col-start-1 sm:row-start-2 sm:px-4">
                        <span>{selectedMaterial.title}</span>
                        <span className="text-sm font-normal leading-7 text-slate-500">· 共 {paragraphs.length} 个自然段</span>
                      </h2>
                      <div className="flex min-h-10 flex-wrap items-start gap-2 px-3 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-end sm:px-4">
                        <button
                          type="button"
                          onClick={requestMaterialRemoval}
                          disabled={busy}
                          className="inline-flex h-10 items-center gap-2 rounded-md border border-red-600 bg-transparent px-3 text-sm text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-40"
                        >
                          <Trash2 size={16} />
                          删除或停用该素材
                        </button>
                      </div>
                    </div>
                    <MaterialContentPreview
                      paragraphs={paragraphs}
                      expanded={materialPreviewExpanded}
                      onToggle={() => setMaterialPreviewExpanded((current) => !current)}
                    />
                  </section>
                )}
                {!selectedMaterial && (
                  <div className="mt-4 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                    请先选择一篇学习材料，查看并处理对应的待最终确认题目和已发布练习。
                  </div>
                )}
              </div>
            )}

            {materialMode === 'retired' && (
              <section className="mt-5" aria-labelledby="retired-materials-title">
                <h2 id="retired-materials-title" className="text-sm font-semibold text-slate-950">
                  已停用素材（{retiredMaterials.length}）
                </h2>
                <ul className="mt-2 space-y-1">
                  {retiredMaterials.map((material) => (
                    <li
                      key={material.materialVersionId}
                      className="flex min-h-9 items-center gap-3"
                    >
                      <span className="min-w-0 truncate text-sm text-slate-950">{material.title}</span>
                      <button
                        type="button"
                        onClick={() => reactivateMaterial(material)}
                        disabled={busy}
                        className="inline-flex h-10 shrink-0 items-center rounded px-1 text-sm font-medium text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        重新启用
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {materialMode === 'new' && (
              <div className="mt-5">
                <label className="block text-sm font-semibold">素材标题<input value={materialForm.title} onChange={(event) => setMaterialForm((value) => ({ ...value, title: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                <label className="mt-4 block text-sm font-semibold">素材正文<textarea value={materialForm.content} onChange={(event) => setMaterialForm((value) => ({ ...value, content: event.target.value }))} rows={10} className="mt-2 w-full rounded-md border border-slate-300 bg-white p-3 font-normal leading-7" placeholder="每个自然段换行。" /></label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">来源说明<input value={materialForm.description} onChange={(event) => setMaterialForm((value) => ({ ...value, description: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                  <label className="block text-sm font-semibold">版权备注<input value={materialForm.copyrightNote} onChange={(event) => setMaterialForm((value) => ({ ...value, copyrightNote: event.target.value }))} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={clearMaterialForm} disabled={busy || !materialFormHasInput} className="flex h-10 w-[240px] items-center justify-center gap-2 rounded-md border border-[#666666] bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
                    <Trash2 aria-hidden="true" size={18} />
                    清空内容
                  </button>
                  <button type="button" onClick={addMaterial} disabled={busy || !materialForm.title.trim() || !materialForm.content.trim()} className="flex h-10 w-[240px] items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
                    <Save aria-hidden="true" size={18} />
                    保存素材
                  </button>
                </div>
              </div>
            )}

          </section>

          {materialMode === 'existing' && selectedMaterial && (
            <section id="training-task-editor" className="scroll-mt-28 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedPlan ? '修改训练任务' : tasks.length > 0 ? '确认训练任务' : '规划训练任务'}
                  <span className="ml-2 font-normal text-slate-950">（<span className="text-blue-700">{tasks.length}</span>/6）</span>
                </h2>
              </div>
              <div
                className="grid w-full grid-cols-4 sm:w-auto"
                aria-label={`${selectedMaterial.title}的题目状态`}
              >
                <Metric
                  label="待处理"
                  value={taskQuestionLifecycleSummary.actionRequired}
                />
                <Metric
                  label="待最终确认"
                  value={taskQuestionLifecycleSummary.pendingReview}
                  tone="warning"
                />
                <Metric
                  label="已确认（待发布）"
                  value={taskQuestionLifecycleSummary.approvedPendingPublication}
                  tone="info"
                />
                <Metric
                  label="已发布"
                  value={taskQuestionLifecycleSummary.published}
                  tone="success"
                />
              </div>
            </div>
            {selectedPlan && taskEditorDirty && (
              <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                {['draft', 'revision_required'].includes(selectedPlan.status)
                  ? '正在修改工作草稿。保存会更新当前草稿并重新检查，不会新增版本。'
                  : `正在基于第 ${selectedPlan.revision} 版修改。首次保存会创建一份工作草稿。`}
              </div>
            )}
            {(taskPublicationCandidates.length > 0 || taskBatchPublicationResult) && (
              <section className="mt-4 border-t border-slate-200 pt-4" aria-labelledby="task-batch-publication-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 id="task-batch-publication-title" className="text-base font-semibold">正式发布</h3>
                  {taskBatchPublicationResult && (
                    <p
                      role="status"
                      className={`text-sm ${
                        taskBatchPublicationResult.failed === 0
                          ? 'text-emerald-700'
                          : taskBatchPublicationResult.completed > 0
                            ? 'text-amber-700'
                            : 'text-red-700'
                      }`}
                    >
                      已完成 {taskBatchPublicationResult.completed} 道
                      {taskBatchPublicationResult.failed > 0
                        ? `，${taskBatchPublicationResult.failed} 道未完成`
                        : ''}
                    </p>
                  )}
                </div>
                {taskPublicationCandidates.length > 0 && (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      aria-busy={Boolean(taskBatchPublicationOperation)}
                      disabled={Boolean(taskBatchPublicationOperation || taskWorkflowOperation || busy)}
                      onClick={() => void runTaskPublicationBatch()}
                      className="inline-flex h-10 w-[420px] max-w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      {taskBatchPublicationOperation && (
                        <LoaderCircle aria-hidden="true" size={18} className="animate-spin" />
                      )}
                      {taskBatchPublicationOperation
                        ? `正在发布 ${taskPublicationCandidates.length} 道题目…`
                        : taskPublicationCandidates.every((item) => item.action === 'retry_publication')
                          ? `重试未完成题目（${taskPublicationCandidates.length}）`
                          : `发布已确认题目（${taskPublicationCandidates.length}）`}
                    </button>
                  </div>
                )}
              </section>
            )}
            <section className="mt-4 rounded-md bg-white p-4 sm:p-5" aria-labelledby="ai-observation-generator-title" aria-busy={generatorBusy}>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 id="ai-observation-generator-title" className="text-base font-semibold">AI规划训练任务</h3>
                  <span className={`rounded px-2 py-1 text-sm ${generatorStatus?.status === 'ready' ? 'bg-[#f3eaff] text-[#6713EE]' : 'bg-amber-50 text-amber-700'}`}>
                    {generatorStatus?.status === 'ready' ? 'AI 服务可用' : 'AI 服务未配置'}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium">适用学段（生成参考）</p>
                  <div className="mt-1 flex min-h-10 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-normal text-slate-700">初中</div>
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    训练方向
                    <span className="ml-2 font-normal text-slate-500">（可选 2 项，默认由 AI 判断）</span>
                  </p>
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
                          className={`h-10 rounded-md border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-600'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold">
                  训练能力
                  <span className="ml-2 font-normal text-slate-500">（可选 2 项，默认由 AI 判断）</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {abilityOptions.map(([abilityId, label]) => {
                    const selected = generatorPreferences.preferredAbilityIds.includes(abilityId);
                    const selectionLimitReached = generatorPreferences.preferredAbilityIds.length >= 2;
                    return <button key={abilityId} type="button" aria-pressed={selected} disabled={generatorBusy || (!selected && selectionLimitReached)} onClick={() => togglePreferredAbility(abilityId)} className={`h-10 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-600'}`}>{label}</button>;
                  })}
                </div>
              </div>
              <div className="mt-4 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                {!selectedMaterial
                  ? '请先选择或保存素材，再生成训练任务。'
                  : generatorInventory.observations.length === 0 && generatorInventory.questions.length === 0
                    ? '当前素材尚无已保存的训练任务，可以开始生成。'
                    : '再次生成时，系统会参考当前素材已有的训练任务，优先生成不同的训练内容。'}
              </div>
              {!selectedPlan && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={planReplacementGroup}
                    disabled={!commandAvailability.planReplacementGroup.enabled}
                    title={commandAvailability.planReplacementGroup.reason}
                    className="ai-button-solid inline-flex h-10 w-[420px] max-w-full items-center justify-center rounded-md border px-4 text-sm font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatorBusy ? '正在分析素材并生成训练任务…' : 'AI根据素材生成训练任务'}
                  </button>
                </div>
              )}
              {taskEditorDirty && selectedPlan && (
                <p className="mt-2 text-xs leading-5 text-amber-700">请先保存当前任务组修改，再生成新的候选方案。</p>
              )}
              {generatorResult && (
                <GeneratorCandidatePreview
                  result={generatorResult}
                  session={groupCandidateSession}
                  currentTasks={tasks}
                  currentTaskCount={tasks.length}
                  protectedTaskIds={protectedTaskIds}
                  onToggleCandidate={selectGeneratedCandidatesWithinLimit}
                  onAdopt={adoptCandidates}
                  onDiscard={discardCandidates}
                />
              )}
            <div className="mt-6 space-y-3">
              {taskReviewGroups.map(({ task, index, issues }) => {
                const taskEditable = task.sourceType !== 'ai_assisted' || editableTaskIds.has(task.localId);
                const taskDisclosureOpen = (key) => (
                  isTaskCardDisclosureOpen(taskCardDisclosures, task.localId, key)
                );
                const updateTaskDisclosure = (key, open) => {
                  setTaskCardDisclosures((current) => (
                    setTaskCardDisclosureOpen(current, task.localId, key, open)
                  ));
                };
                const questionLifecycle = taskQuestionLifecycleById.get(
                  task.observationTaskPlanId || task.localId,
                );
                const taskCardPresentation = questionLifecycle?.cardPresentation;
                const taskProductionAction = taskCardPresentation?.primaryAction;
                const showTaskProductionAction = Boolean(
                  taskProductionAction?.label
                  && taskProductionAction.kind !== 'view_formal_resource',
                );
                const workflowTargetId = task.observationTaskPlanId || task.localId;
                const workingTaskId = taskWorkingIdentity(task);
                const workflowOperationKey = workflowTargetId
                  ? `${workflowTargetId}:publish_task`
                  : '';
                const batchWorkflowBusy = Boolean(
                  questionLifecycle?.draft
                  && taskBatchPublicationOperation?.draftIds.includes(questionLifecycle.draft.draftId),
                );
                const workflowBusy = taskWorkflowOperation === workflowOperationKey || batchWorkflowBusy;
                const workflowFeedback = workflowTargetId
                  ? taskWorkflowFeedback[workflowTargetId]
                    || (questionLifecycle?.draft
                      ? taskWorkflowFeedback[questionLifecycle.draft.draftId]
                      : null)
                  : null;
                const workingState = taskWorkingStates[workingTaskId] || {
                  status: task.editorDirty ? 'dirty' : 'clean',
                  workingContent: null,
                };
                const taskCommitBusy = Boolean(
                  taskCommitOperation?.taskIds.includes(workingTaskId),
                );
                const workingStatusLabel = ({
                  clean: '尚无工作修改',
                  dirty: '有未保存修改',
                  saving: '正在保存…',
                  saved: '工作进度已保存，尚未提交检查',
                  save_failed: '保存失败，可重新保存',
                  base_revision_conflict: '基础版本已变化，需要处理冲突',
                })[workingState.status] || '';
                return (
                <details
                  data-task-editor={task.localId}
                  data-task-production-state={questionLifecycle?.productionView?.state || 'unknown'}
                  data-task-production-action={taskProductionAction?.kind || 'none'}
                  key={task.localId}
                  open={issues.length > 0 || task.editorDirty ? true : undefined}
                  className="group rounded-md border border-slate-200 bg-white p-4 transition-colors open:border-blue-300 sm:p-5"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2" aria-label="训练任务标题、来源与状态">
                        <h3 className="mr-1 text-sm font-bold">{taskEditorTitle(index)}</h3>
                        <span className="text-xs text-slate-500">来源：</span>
                        <TaskSourceBadge task={task} />
                        <span className="text-xs text-slate-500">状态：</span>
                        <TaskQuestionLifecycleBadge presentation={taskCardPresentation} />
                      </div>
                      {(showTaskProductionAction
                        || taskCardPresentation?.auxiliaryActions?.length > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" aria-label="训练任务流程操作">
                          {showTaskProductionAction && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-slate-500">下一步：</span>
                            <button
                              type="button"
                              disabled={
                                workflowBusy ||
                                (taskProductionAction.kind === 'save_plan' && !commandAvailability.savePlanRevision.enabled)
                              }
                              title={taskProductionAction.kind === 'save_plan' ? commandAvailability.savePlanRevision.reason : ''}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (taskProductionAction.kind === 'view_formal_resource') {
                                  revealTaskFormalResource(event, task.localId);
                                  return;
                                }
                                if (taskProductionAction.kind === 'open_confirmation') {
                                  const taskCard = event.currentTarget.closest('details');
                                  taskCard?.setAttribute('open', '');
                                  window.requestAnimationFrame(() => {
                                    taskCard
                                      ?.querySelector('[data-task-production-workflow]')
                                      ?.scrollIntoView({ block: 'nearest' });
                                  });
                                }
                                if (taskProductionAction.kind === 'focus_issue') {
                                  if (issues[0]) focusTaskIssue(issues[0]);
                                  return;
                                }
                                void runTaskWorkflowAction(questionLifecycle);
                              }}
                              className="text-[12px] font-medium text-blue-700 hover:text-blue-800 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                            >
                              {batchWorkflowBusy
                                ? taskBatchPublicationOperation?.activeDraftId === questionLifecycle?.draft?.draftId
                                  ? '正在发布…'
                                  : '等待发布…'
                                : workflowBusy
                                  ? taskProductionAction.busyLabel || '正在处理任务…'
                                : taskProductionAction.label}
                            </button>
                          </span>
                          )}
                          {taskCardPresentation?.auxiliaryActions?.map((action) => (
                            <button
                              key={action.kind}
                              type="button"
                              onClick={(event) => revealTaskFormalResource(event, task.localId)}
                              className="text-[12px] font-medium text-blue-700 hover:text-blue-800 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                        )}
                      <div className="mt-2 flex flex-wrap gap-2" aria-label="训练任务属性摘要">
                        <TaskAttributeChip>{dimensionLabels[task.primaryDimension]}</TaskAttributeChip>
                        <TaskAttributeChip>{abilityLabels[task.abilityId]}</TaskAttributeChip>
                        <TaskAttributeChip>{difficultyLabels[task.difficulty]}</TaskAttributeChip>
                        <TaskAttributeChip>{formatAnchorSummary(task)}</TaskAttributeChip>
                        <TaskAttributeChip>{roleLabels[task.taskRole]}</TaskAttributeChip>
                      </div>
                      <p
                        className={`mt-2 line-clamp-2 text-sm leading-6 group-open:hidden ${
                          task.questionStem?.trim() ? 'text-slate-700' : 'text-slate-400'
                        }`}
                        title={task.questionStem?.trim() || undefined}
                      >
                        {task.questionStem?.trim() || '题目尚未生成'}
                      </p>
                      {workflowFeedback && (
                        <p
                          role={(workflowFeedback.type || workflowFeedback.tone) === 'error' ? 'alert' : 'status'}
                          className={`mt-2 text-xs leading-5 ${
                            (workflowFeedback.type || workflowFeedback.tone) === 'success'
                              ? 'text-emerald-700'
                              : (workflowFeedback.type || workflowFeedback.tone) === 'info'
                                ? 'text-blue-700'
                                : (workflowFeedback.type || workflowFeedback.tone) === 'warning'
                                  ? 'text-amber-700'
                                : 'text-red-700'
                          }`}
                        >
                          {workflowFeedback.message}
                        </p>
                      )}
                    </div>
                    <span className="mt-1 inline-flex shrink-0 items-center gap-2 text-[14px] font-normal text-blue-700">
                      <span className="group-open:hidden">展开详情</span>
                      <span className="hidden group-open:inline">收起详情</span>
                      <ChevronDown
                        aria-hidden="true"
                        size={18}
                        className="shrink-0 text-blue-600 transition group-open:rotate-180"
                      />
                    </span>
                  </summary>
                  {questionLifecycle?.draft && (
                    <TaskProductionWorkflowPanel
                      lifecycle={questionLifecycle}
                      rationales={taskWarningRationales[questionLifecycle.draft.draftId] || {}}
                      reviewNotes={taskReviewNotes[questionLifecycle.draft.draftId] || ''}
                      onRationaleChange={(warningCode, value) => setTaskWarningRationales((current) => ({
                        ...current,
                        [questionLifecycle.draft.draftId]: {
                          ...(current[questionLifecycle.draft.draftId] || {}),
                          [warningCode]: value,
                        },
                      }))}
                      onReviewNotesChange={(value) => setTaskReviewNotes((current) => ({
                        ...current,
                        [questionLifecycle.draft.draftId]: value,
                      }))}
                    />
                  )}
                  <div
                    aria-label="训练任务校准操作"
                    className="mt-4 grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-violet-50 px-4 py-3 text-sm text-violet-900"
                  >
                    <span>
                      {taskEditable ? workingStatusLabel : '当前为 AI 生成预览。'}
                    </span>
                    <div className="grid grid-cols-[12rem_9rem_11rem] items-center gap-2">
                      {taskEditable && task.observationTaskPlanId ? (
                        <button
                          type="button"
                          aria-busy={workingState.status === 'saving' || taskCommitBusy}
                          disabled={
                            workingState.status === 'saving'
                            || taskCommitBusy
                            || workingState.status === 'base_revision_conflict'
                            || !questionLifecycle?.draft
                          }
                          onClick={() => {
                            if (workingState.status === 'saved') {
                              void submitWorkingTaskChanges([workingTaskId]);
                              return;
                            }
                            void saveCurrentTaskWorkingContent(task, index);
                          }}
                          className="inline-flex h-10 w-48 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                        >
                          {workingState.status === 'saving' || taskCommitBusy ? (
                            <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
                          ) : (
                            <Save aria-hidden="true" size={16} />
                          )}
                          {taskCommitBusy
                            ? '正在提交并检查…'
                            : workingState.status === 'saving'
                            ? '正在保存…'
                            : workingState.status === 'save_failed'
                              ? '重新保存'
                              : workingState.status === 'saved'
                                ? '提交当前任务并检查'
                                : '保存当前任务'}
                        </button>
                      ) : <span aria-hidden="true" />}
                      {taskEditable ? (
                        task.sourceType === 'ai_assisted' ? (
                          <button
                            type="button"
                            onClick={() => exitTaskEditing(task, index)}
                            className="ai-button-outline inline-flex h-10 w-36 items-center justify-center rounded-md border px-5 text-sm font-semibold transition focus-visible:outline-none"
                          >
                            退出人工校准
                          </button>
                        ) : <span aria-hidden="true" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => enableTaskEditing(task)}
                          className="ai-button-outline inline-flex h-10 w-36 items-center justify-center rounded-md border px-5 text-sm font-semibold transition focus-visible:outline-none"
                        >
                          人工编辑校准
                        </button>
                      )}
                      {selectedPlan && task.observationTaskPlanId && (
                        <button
                          type="button"
                          disabled={!commandAvailability.regenerateSingleTask.enabled}
                          title={commandAvailability.regenerateSingleTask.reason}
                          onClick={() => regenerateSingleTask(task, index)}
                          className="ai-button-solid inline-flex h-10 w-44 items-center justify-center rounded-md border px-4 text-sm font-normal transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          重新生成此任务
                        </button>
                      )}
                    </div>
                  </div>
                  {workingState.status === 'base_revision_conflict' && (
                    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      <p className="font-semibold">当前正式内容已更新，工作修改不能直接覆盖。</p>
                      <p className="mt-1 leading-6">请重新应用工作修改，或放弃工作修改并恢复当前正式内容。</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void reapplyCurrentTaskWorkingContent(task, index)}
                          className="h-10 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
                        >
                          重新应用工作修改
                        </button>
                        <button
                          type="button"
                          onClick={() => void discardCurrentTaskWorkingContent(task, index)}
                          className="h-10 rounded-md border border-[#666666] bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          放弃工作修改
                        </button>
                      </div>
                    </div>
                  )}
                  {taskRegeneration
                    && task.observationTaskPlanId
                    && taskRegeneration.sourceTaskId === task.observationTaskPlanId && (
                    <SingleTaskRegenerationPreview
                      state={taskRegeneration}
                      onRetry={() => regenerateSingleTask(task, index)}
                      onDiscard={() => setTaskRegeneration(null)}
                      onApply={adoptSingleTaskCandidate}
                    />
                  )}
                  <fieldset disabled={!taskEditable} className="min-w-0 border-0 p-0">
                  <div className="mt-5 space-y-5">
                    <section>
                      <p className="text-sm font-semibold text-slate-900">能力目标</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{task.focusDisplayName || '尚未填写能力目标'}</p>
                    </section>
                    {taskEditable ? (
                      <>
                        <label className="block text-sm font-semibold">题目<AutoGrowingTextarea id={taskFieldId(task, 'questionStem')} value={task.questionStem} onChange={(value) => updateTask(index, { questionStem: value })} placeholder="写出学生实际看到的题目" /></label>
                        <label className="block text-sm font-semibold">学生任务<AutoGrowingTextarea id={taskFieldId(task, 'expectedStudentAction')} value={task.expectedStudentAction} onChange={(value) => updateTask(index, { expectedStudentAction: value })} placeholder="例如：找出人物的一个具体动作，并说明它表现了怎样的心理。" /></label>
                      </>
                    ) : (
                      <>
                        <section>
                          <p className="text-sm font-semibold text-slate-900">题目</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.questionStem}</p>
                        </section>
                        <section>
                          <p className="text-sm font-semibold text-slate-900">学生任务</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.expectedStudentAction}</p>
                        </section>
                      </>
                    )}
                    <section>
                      <p className="text-sm font-semibold text-slate-900">观察目标</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.focusDefinition || '尚未填写观察目标'}</p>
                    </section>
                  </div>
                  <details
                    open={taskDisclosureOpen('task_attributes')}
                    onToggle={(event) => updateTaskDisclosure('task_attributes', event.currentTarget.open)}
                    className="mt-2 rounded-md bg-slate-50 px-4 py-3"
                  >
                    <summary className="cursor-pointer text-sm font-medium text-blue-700">调整任务属性</summary>
                    <div className={`mt-3 grid gap-3 sm:grid-cols-2 ${
                      task.anchorType === 'paragraph_range'
                        ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1.15fr)_minmax(7rem,0.6fr)_minmax(7rem,0.6fr)]'
                        : task.anchorType === 'paragraph'
                          ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(8rem,0.7fr)]'
                          : 'lg:grid-cols-3'
                    }`}>
                      <Select id={taskFieldId(task, 'abilityId')} label="主要能力" value={task.abilityId} options={abilityOptions} onChange={(value) => updateTask(index, {
                        abilityId: value,
                        expectedStudentAction: actionForAbility(value),
                        rubric: task.rubric.map((item, rubricIndex) => rubricIndex === 0 ? { ...item, abilityId: value } : item),
                        taskAttributeAdjusted: true,
                      })} />
                      <Select id={taskFieldId(task, 'difficulty')} label="难度" value={task.difficulty} options={difficultyOptions} onChange={(value) => updateTask(index, { difficulty: value, taskAttributeAdjusted: true })} />
                      <Select id={taskFieldId(task, 'anchorType')} label="阅读范围" value={task.anchorType} options={anchorOptions} onChange={(value) => updateTask(index, { anchorType: value, taskAttributeAdjusted: true })} />
                      {task.anchorType !== 'full_text' && (
                        <label className="block text-sm font-medium">开始段落<input id={taskFieldId(task, 'startParagraph')} type="number" min="1" max={Math.max(paragraphs.length, 1)} value={task.startParagraph} onChange={(event) => updateTask(index, { startParagraph: Number(event.target.value), taskAttributeAdjusted: true })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>
                      )}
                      {task.anchorType === 'paragraph_range' && <label className="block text-sm font-medium">结束段落<input id={taskFieldId(task, 'endParagraph')} type="number" min={task.startParagraph} max={Math.max(paragraphs.length, 1)} value={task.endParagraph} onChange={(event) => updateTask(index, { endParagraph: Number(event.target.value), taskAttributeAdjusted: true })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label>}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Select id={taskFieldId(task, 'primaryDimension')} label="内容侧重" value={task.primaryDimension} options={dimensionOptions} onChange={(value) => updateTask(index, { primaryDimension: value, taskAttributeAdjusted: true })} />
                      <Select id={taskFieldId(task, 'taskRole')} label="任务角色" value={task.taskRole} options={roleOptions} onChange={(value) => updateTask(index, { taskRole: value, taskAttributeAdjusted: true })} />
                    </div>
                    <label className="mt-3 block text-sm font-medium">具体训练点<input id={taskFieldId(task, 'focusDisplayName')} value={task.focusDisplayName} onChange={(event) => updateTask(index, { focusDisplayName: event.target.value, taskAttributeAdjusted: true })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" placeholder="例如：从动作推断人物心理" /></label>
                    <label className="mt-3 block text-sm font-medium">训练点说明<textarea id={taskFieldId(task, 'focusDefinition')} value={task.focusDefinition} onChange={(event) => updateTask(index, { focusDefinition: event.target.value, taskAttributeAdjusted: true })} rows={2} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-3 font-normal leading-6" placeholder="例如：学生能够引用具体动作，并说明动作与人物心理之间的关系。" /></label>
                    {['retest', 'transfer'].includes(task.taskRole) && <label className="mt-3 block text-sm font-medium">关联训练组 ID<input id={taskFieldId(task, 'comparisonGroupId')} value={task.comparisonGroupId} onChange={(event) => updateTask(index, { comparisonGroupId: event.target.value, taskAttributeAdjusted: true })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" placeholder="同一能力 Training / Retest / Transfer 共用" /></label>}
                  </details>
                  <details
                    open={taskDisclosureOpen('scoring')}
                    onToggle={(event) => updateTaskDisclosure('scoring', event.currentTarget.open)}
                    className="mt-2 rounded-md bg-slate-50 px-4 py-3"
                  >
                    <summary className="cursor-pointer text-sm font-medium text-blue-700">评分标准与答案示例</summary>
                    <div className="mt-4 space-y-4 px-4 sm:px-5">
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
                                  className={`h-10 rounded-md border px-3 text-xs font-normal transition ${selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-600'}`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                        </div>
                      </div>
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
                          <button type="button" onClick={() => updateTask(index, { rubric: [...task.rubric, createRubricItem(task.abilityId, task.rubric.length)] })} className="inline-flex h-10 items-center text-sm font-semibold text-blue-700">增加评分项</button>
                        </div>
                        <div id={taskFieldId(task, 'rubric')} tabIndex={-1} className="mt-2 space-y-3 outline-none">
                          {task.rubric.map((item, rubricIndex) => (
                            <div key={item.localId} className="border-l-2 border-slate-200 pl-3">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input aria-label={`评分项 ${rubricIndex + 1} 名称`} value={item.name} onChange={(event) => updateTask(index, { rubric: updateArrayItem(task.rubric, rubricIndex, { name: event.target.value }) })} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" placeholder="例如：写出人物心理" />
                                <select aria-label={`评分项 ${rubricIndex + 1} 能力`} value={item.abilityId} onChange={(event) => updateTask(index, { rubric: updateArrayItem(task.rubric, rubricIndex, { abilityId: event.target.value }) })} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">{abilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                              </div>
                              <textarea aria-label={`评分项 ${rubricIndex + 1} 描述`} value={item.description} onChange={(event) => updateTask(index, { rubric: updateArrayItem(task.rubric, rubricIndex, { description: event.target.value }) })} rows={2} className="mt-2 w-full rounded-md border border-slate-300 bg-white p-3 text-sm leading-6" placeholder="学生需要完成什么" />
                              <input aria-label={`评分项 ${rubricIndex + 1} 可接受表达`} value={item.acceptedSignalsText} onChange={(event) => updateTask(index, { rubric: updateArrayItem(task.rubric, rubricIndex, { acceptedSignalsText: event.target.value }) })} className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" placeholder="例如：担心、不舍、焦急（用逗号分隔）" />
                              {task.rubric.length > 1 && <button type="button" onClick={() => updateTask(index, { rubric: task.rubric.filter((_, itemIndex) => itemIndex !== rubricIndex) })} className="mt-2 inline-flex h-10 items-center text-xs font-semibold text-red-600 hover:text-red-700">删除此项</button>}
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
                  <details
                    open={taskDisclosureOpen('design_rationale')}
                    onToggle={(event) => updateTaskDisclosure('design_rationale', event.currentTarget.open)}
                    className="mt-2 rounded-md bg-slate-50 px-4 py-3"
                  >
                    <summary className="cursor-pointer text-sm font-medium text-blue-700">设计依据</summary>
                    <div className="mt-3">
                      {taskEditable ? (
                        <AutoGrowingTextarea id={taskFieldId(task, 'designReason')} value={task.designReason} onChange={(value) => updateTask(index, { designReason: value })} placeholder="例如：检查学生能否建立“人物动作—心理判断”的关系。" />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.designReason}</p>
                      )}
                    </div>
                  </details>
                  </fieldset>
                  {questionLifecycle?.formalResource && (
                    <details
                      data-formal-resource-summary
                      open={taskDisclosureOpen('formal_resource')}
                      onToggle={(event) => updateTaskDisclosure('formal_resource', event.currentTarget.open)}
                      className="mt-2 rounded-md bg-slate-50 px-4 py-3"
                    >
                      <summary className="cursor-pointer text-sm font-medium text-blue-700">
                        正式资源
                      </summary>
                      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-slate-500">发布状态</dt>
                          <dd className="mt-1 font-medium text-emerald-700">已发布</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">正式版本</dt>
                          <dd className="mt-1 font-medium text-slate-800">
                            {questionLifecycle.formalResource.versionNumber
                              ? `第 ${questionLifecycle.formalResource.versionNumber} 版`
                              : '当前版本'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">使用状态</dt>
                          <dd className="mt-1 font-medium text-slate-800">可用于学习</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">来源素材</dt>
                          <dd className="mt-1 font-medium text-slate-800">
                            {formatMaterialTitle(
                              questionLifecycle.formalResource.materialTitle || selectedMaterial?.title || '',
                            ) || '当前素材'}
                          </dd>
                        </div>
                        {questionLifecycle.formalResource.frozenAt && (
                          <div>
                            <dt className="text-slate-500">发布时间</dt>
                            <dd className="mt-1 font-medium text-slate-800">
                              {formatPublishedAt(questionLifecycle.formalResource.frozenAt)}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </details>
                  )}
                  <div className="mt-4 flex items-center justify-end gap-3">
                    {!canRemoveTrainingTask(tasks.length) && (
                      <span className="text-xs text-slate-500">
                        至少保留 {MIN_TRAINING_TASK_COUNT} 个任务
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`删除${taskEditorTitle(index)}`}
                      disabled={!canRemoveTrainingTask(tasks.length)}
                      title={canRemoveTrainingTask(tasks.length)
                        ? `从当前编辑区删除${taskEditorTitle(index)}`
                        : `每个训练任务组至少保留 ${MIN_TRAINING_TASK_COUNT} 个任务`}
                      onClick={() => requestTaskRemoval(task, index, taskEditable)}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-red-600 bg-transparent px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-red-200 disabled:bg-transparent disabled:text-red-300"
                    >
                      <Trash2 size={16} />
                      删除任务
                    </button>
                  </div>
                </details>
                );
              })}
            </div>

            {removedTaskHistory.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>
                  已从编辑区删除 {removedTaskHistory.at(-1).title}。保存任务组后才会生成新版本。
                </span>
                <button
                  type="button"
                  onClick={undoLastTaskRemoval}
                  className="inline-flex h-10 items-center px-2 font-semibold text-blue-700 hover:text-blue-800"
                >
                  撤销删除
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {selectedPlan && (
                <>
                  <button
                    type="button"
                    onClick={planReplacementGroup}
                    disabled={!commandAvailability.planReplacementGroup.enabled}
                    title={commandAvailability.planReplacementGroup.reason}
                    className="ai-button-outline inline-flex h-10 items-center justify-center rounded-md border px-5 text-sm font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatorOperation === 'replace_group' ? '正在重新生成…' : '重新生成整组任务'}
                  </button>
                  <button
                    type="button"
                    onClick={planSupplementCandidates}
                    disabled={!commandAvailability.planSupplementCandidates.enabled}
                    title={commandAvailability.planSupplementCandidates.reason}
                    className="ai-button-solid inline-flex h-10 items-center justify-center rounded-md border px-5 text-sm font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatorOperation === 'supplement_group' ? '正在补充候选…' : '补充生成候选任务'}
                  </button>
                </>
              )}
              {selectedPlan && savedWorkingTaskIds.length > 0 && (
                <button
                  type="button"
                  aria-busy={Boolean(taskCommitOperation)}
                  disabled={Boolean(taskCommitOperation)}
                  onClick={() => void submitWorkingTaskChanges(savedWorkingTaskIds)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-700 bg-white px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                >
                  {taskCommitOperation && (
                    <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
                  )}
                  {taskCommitOperation
                    ? '正在提交并检查…'
                    : `提交全部已保存修改（${savedWorkingTaskIds.length}）`}
                </button>
              )}
              <button
                type="button"
                disabled={!commandAvailability.savePlanRevision.enabled}
                title={commandAvailability.savePlanRevision.reason}
                onClick={savePlanRevision}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white transition hover:border-blue-800 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
              >
                <Save aria-hidden="true" size={18} />
                {selectedPlan ? '确认任务并保存' : '保存训练任务'}
              </button>
            </div>
            </section>
            </section>
          )}
        </div>

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
          canSave={
            tasks.some((task) => task.editorDirty && task.observationTaskPlanId)
            && tasks.every((task) => task.observationTaskPlanId)
            && removedTaskHistory.length === 0
          }
          saving={discardDialogSaving}
          onCancel={cancelDiscardChanges}
          onSave={() => void saveChangesBeforeSwitch()}
          onConfirm={confirmDiscardChanges}
        />
      )}
      {taskRemovalCandidate && (
        <TaskRemovalDialog
          title={taskRemovalCandidate.title}
          onCancel={() => setTaskRemovalCandidate(null)}
          onConfirm={confirmTaskRemoval}
        />
      )}
      {duplicateMaterial && (
        <DuplicateMaterialDialog
          material={duplicateMaterial}
          onCancel={() => setDuplicateMaterial(null)}
          onUseExisting={useDuplicateMaterial}
        />
      )}
      {materialAction && (
        <MaterialRemovalDialog
          action={materialAction.action}
          dependencyCount={materialAction.dependencyCount}
          material={materialAction.material}
          busy={busy}
          onCancel={() => setMaterialAction(null)}
          onConfirm={confirmMaterialRemoval}
        />
      )}
    </div>
  );
}

function DuplicateMaterialDialog({ material, onCancel, onUseExisting }) {
  const retired = material.status === 'retired';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="duplicate-material-title" className="w-full max-w-md rounded-md bg-white p-6 shadow-xl">
        <h2 id="duplicate-material-title" className="text-lg font-semibold">发现相同的学习材料</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          当前正文与{formatMaterialTitle(material.title)}相同。系统不会重复保存同一份内容。
          {retired ? ' 这份素材目前已停用。' : ' 可以直接使用已有素材继续。'}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50">返回检查</button>
          {!retired && <button type="button" onClick={onUseExisting} className="h-10 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700">使用已有素材</button>}
        </div>
      </section>
    </div>
  );
}

function MaterialRemovalDialog({ action, dependencyCount, material, busy, onCancel, onConfirm }) {
  const willDelete = action === 'delete';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="material-removal-title" className="w-full max-w-md rounded-md bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          {willDelete ? <Trash2 size={20} className="text-red-600" /> : <Archive size={20} className="text-amber-600" />}
          <h2 id="material-removal-title" className="text-lg font-semibold">{willDelete ? '删除未使用素材？' : '停用这份素材？'}</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {willDelete
            ? `${formatMaterialTitle(material.title)}尚未进入训练任务或题目链，可以安全删除。`
            : `${formatMaterialTitle(material.title)}已有 ${dependencyCount} 项下游记录，不能直接删除。停用后将不再用于新任务，但历史训练、题目和审核记录仍可追溯。`}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="h-10 rounded-md border border-emerald-600 bg-white px-4 text-sm text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40">取消</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`h-10 rounded-md px-4 text-sm text-white disabled:opacity-40 ${willDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {busy ? '正在处理' : willDelete ? '确认删除' : '确认停用'}
          </button>
        </div>
      </section>
    </div>
  );
}

function DiscardChangesDialog({ canSave, saving, onCancel, onSave, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-task-edits-title"
        className="w-full max-w-md rounded-md bg-white p-6 shadow-xl"
      >
        <h2 id="discard-task-edits-title" className="text-lg font-semibold">当前任务有未保存修改</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          可以先保存工作进度后切换，也可以放弃浏览器内尚未保存的修改。
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button type="button" disabled={saving} onClick={onCancel} className="h-10 rounded-md border border-[#666666] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">取消</button>
          <button type="button" disabled={saving} onClick={onConfirm} className="h-10 rounded-md border border-red-600 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">放弃修改并切换</button>
          {canSave && (
            <button type="button" disabled={saving} onClick={onSave} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-40">
              {saving && <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />}
              {saving ? '正在保存…' : '保存后切换'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function TaskRemovalDialog({ title, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-training-task-title"
        className="w-full max-w-md rounded-md bg-white p-6 shadow-xl"
      >
        <h2 id="remove-training-task-title" className="text-lg font-semibold">删除任务？</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          将从当前编辑区删除{title}。保存任务组前可以撤销；已发布题目和历史版本不会被删除。
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">取消</button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">删除任务</button>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = 'default' }) {
  const valueTone = tone === 'warning' && value > 0
    ? 'text-amber-700'
    : tone === 'info'
      ? 'text-blue-700'
      : tone === 'success'
        ? 'text-emerald-700'
        : 'text-slate-950';
  return (
    <div className="flex min-h-[52px] min-w-0 flex-col items-start justify-center bg-transparent px-2 text-left sm:min-w-32 sm:px-4">
      <span className="block text-sm leading-5 text-slate-500">{label}</span>
      <span className={`mt-1 min-h-7 text-lg font-semibold leading-7 ${valueTone}`}>{value}</span>
    </div>
  );
}

function TaskQuestionLifecycleBadge({ presentation }) {
  const resolvedPresentation = presentation || {
    stateLabel: '未生成题目',
    tone: 'neutral',
  };
  const toneClassName = {
    neutral: 'bg-slate-100 text-slate-600',
    action: 'bg-blue-50 text-blue-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    success: 'bg-emerald-50 text-emerald-700',
  }[resolvedPresentation.tone];
  return (
    <span className={`rounded px-2 py-1 text-xs font-normal ${toneClassName}`}>
      {resolvedPresentation.stateLabel}
    </span>
  );
}

function resolveTaskQuestionLifecycle({
  task,
  issues = [],
  plan,
  planDrafts = [],
  draftReadiness = [],
  details = { publishedResources: [], incompletePublications: [] },
}) {
  const observationTaskPlanId = task.observationTaskPlanId;
  if (!observationTaskPlanId) {
    const productionView = resolveTaskProductionState({
      trainingTaskId: task.localId,
      draft: {
        draftId: `unsaved:${task.localId}`,
        revision: 0,
        status: issues.length > 0 ? 'validation_failed' : 'drafted',
        isDirty: issues.length === 0,
      },
    });
    const cardPresentation = resolveTaskProductionCardPresentation(productionView, {
      hasIssues: issues.length > 0,
    });
    return {
      status: productionView.state,
      item: null,
      task,
      issues,
      productionView,
      cardPresentation,
    };
  }

  const published = details.publishedResources.find(
    (item) => item.observationTaskPlanId === observationTaskPlanId,
  );
  const incomplete = details.incompletePublications.find(
    (item) => item.observationTaskPlanId === observationTaskPlanId,
  );
  const taskTag = `observation_task:${observationTaskPlanId}`;
  const draft = planDrafts.find((item) => item.tags.includes(taskTag));
  const readiness = draft
    ? draftReadiness.find((item) => item.draftId === draft.draftId)
    : null;
  const assessmentStatus = resolveTaskAssessmentStatus(
    draft?.revision,
    readiness?.validation,
    readiness?.qualityCheckState,
  );
  const taskEntryItem = {
    materialObservationPlanId: plan?.materialObservationPlanId || '',
    materialVersionId: plan?.materialVersionId || draft?.materialVersionId || '',
    observationTaskPlanId,
  };
  const draftItem = draft ? {
    draftId: draft.draftId,
    ...taskEntryItem,
  } : null;
  const publicationItem = incomplete || published || null;
  const hasLocalRevision = issues.length > 0 || task.editorDirty;
  const productionDraft = draft ? {
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    revision: draft.revision,
    status: issues.length > 0 ? 'validation_failed' : draft.status,
    isDirty: Boolean(task.editorDirty),
    assessmentStatus,
  } : hasLocalRevision ? {
    draftId: `task-plan:${observationTaskPlanId}`,
    revision: 0,
    status: issues.length > 0 ? 'validation_failed' : 'drafted',
    isDirty: Boolean(task.editorDirty),
    assessmentStatus: 'missing',
  } : undefined;
  const publishedSourceDraftId = hasLocalRevision
    ? `previous:${published?.sourceDraftId || observationTaskPlanId}`
    : published?.sourceDraftId;
  const incompleteSourceDraftId = hasLocalRevision
    ? `previous:${incomplete?.sourceDraftId || observationTaskPlanId}`
    : incomplete?.sourceDraftId;
  const productionView = resolveTaskProductionState({
    trainingTaskId: observationTaskPlanId,
    questionLineageId: draft?.resourceId || published?.resourceId || incomplete?.resourceId,
    draft: productionDraft,
    publication: incomplete ? {
      status: 'failed',
      sourceDraftId: incompleteSourceDraftId,
      formalVersionId: incomplete.resourceVersionId,
    } : published ? {
      status: 'published',
      sourceDraftId: publishedSourceDraftId,
      formalVersionId: published.resourceVersionId,
    } : { status: 'none' },
  });
  const cardPresentation = resolveTaskProductionCardPresentation(productionView, {
    hasIssues: issues.length > 0,
  });
  const cardAction = cardPresentation.primaryAction;
  const actionTargets = {
    focus_issue: draftItem || taskEntryItem,
    save_plan: draftItem || taskEntryItem,
    open_repair: draftItem || taskEntryItem,
    run_check: draftItem,
    open_confirmation: draftItem,
    confirm: draftItem,
    publish: draftItem,
    retry_publication: draftItem,
    view_formal_resource: published,
  };
  const item = cardAction.kind
    ? actionTargets[cardAction.kind]
    : null;
  return {
    status: productionView.state,
    item,
    task,
    issues,
    formalResource: published || null,
    draft,
    readiness,
    productionView,
    cardPresentation,
  };
}

function resolveTaskLifecycleFromSnapshot(nextSnapshot, sourceLifecycle, planId) {
  const plan = nextSnapshot.plans.find(
    (item) => item.materialObservationPlanId === planId,
  ) || null;
  const sourceTask = sourceLifecycle.task || {};
  const synchronizedTask = plan?.taskPlans.find(
    (item) => item.observationTaskPlanId === sourceTask.observationTaskPlanId,
  );
  const task = {
    ...sourceTask,
    ...(synchronizedTask || {}),
    editorDirty: false,
  };
  const details = scopeMaterialResourceWorkbenchDetails(
    buildMaterialResourceWorkbenchDetails(nextSnapshot),
    plan?.materialVersionId || sourceLifecycle.item?.materialVersionId || '',
  );
  return resolveTaskQuestionLifecycle({
    task,
    issues: [],
    plan,
    planDrafts: selectCurrentPlanDrafts(plan, nextSnapshot.drafts),
    draftReadiness: nextSnapshot.draftReadiness,
    details,
  });
}

function TaskProductionWorkflowPanel({
  lifecycle,
  rationales,
  reviewNotes,
  onRationaleChange,
  onReviewNotesChange,
}) {
  const { draft, readiness } = lifecycle;
  const actionKind = lifecycle.cardPresentation?.primaryAction?.kind;
  const warnings = readiness?.qualityAssessment?.warnings || [];
  if (!draft || !['open_confirmation', 'confirm'].includes(actionKind)) return null;
  return (
    <div data-task-production-workflow className="mt-4 border-t border-slate-200 pt-4">
      {actionKind === 'open_confirmation' && warnings.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">提交前请确认质量提醒</p>
          {warnings.map((warning) => {
            const existing = (draft.warningAcknowledgements || []).find(
              (record) => record.warningCode === warning.code,
            );
            return (
              <label key={warning.code} className="block text-sm text-slate-700">
                <span className="block font-medium text-amber-800">{warning.message}</span>
                <textarea
                  value={rationales[warning.code] ?? existing?.rationale ?? ''}
                  onChange={(event) => onRationaleChange(warning.code, event.target.value)}
                  placeholder="说明保留当前设置的理由"
                  rows={2}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-none focus:shadow-[0_0_0_2px_rgba(37,99,235,0.3)]"
                />
              </label>
            );
          })}
        </div>
      )}
      {actionKind === 'confirm' && (
        <label className="block text-sm text-slate-700">
          <span className="font-medium text-slate-800">确认说明（可选）</span>
          <textarea
            value={reviewNotes}
            onChange={(event) => onReviewNotesChange(event.target.value)}
            placeholder="记录本次最终确认的补充说明"
            rows={2}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-none focus:shadow-[0_0_0_2px_rgba(37,99,235,0.3)]"
          />
        </label>
      )}
    </div>
  );
}

function MaterialContentPreview({ paragraphs, expanded, onToggle }) {
  const previewLimit = 4;
  const visibleParagraphs = expanded ? paragraphs : paragraphs.slice(0, previewLimit);
  const canToggle = paragraphs.length > previewLimit;

  return (
    <section className="mt-6 px-4 pb-0 sm:px-5" aria-label="素材正文">
      {visibleParagraphs.length > 0 ? (
        <ol className="space-y-3">
          {visibleParagraphs.map((paragraph, index) => (
            <li key={`${index}-${paragraph.slice(0, 24)}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-[14px] leading-7 text-slate-700">
              <span className="text-right text-xs leading-7 text-slate-400">{index + 1}</span>
              <p className="whitespace-pre-wrap">{paragraph}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[14px] text-slate-500">当前素材暂无正文内容。</p>
      )}
      {canToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="mt-4 inline-flex h-10 items-center gap-1 rounded px-1 text-[14px] font-medium text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {expanded ? '收起全文' : '展开全文'}
        </button>
      )}
    </section>
  );
}

function Select({ id, label, value, options, onChange }) {
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] || value;
  return (
    <label className="block text-sm font-medium">
      {label}
      <span className="workbench-select-shell relative mt-1 flex min-h-10 w-full items-center rounded-md border border-slate-300 bg-white px-2 pr-10 transition">
        <span className="pointer-events-none inline-flex max-w-full items-center rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-sm font-normal text-blue-700">
          {selectedLabel}
        </span>
        <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-3 text-slate-500" />
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
          {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        </select>
      </span>
    </label>
  );
}

function TaskAttributeChip({ children }) {
  return (
    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-normal text-slate-600">
      {children}
    </span>
  );
}

function TaskSourceBadge({ task }) {
  const source = resolveTaskSource(task);
  const styles = {
    ai_generated: 'bg-violet-50 text-violet-700',
    human_adjusted: 'bg-blue-50 text-blue-700',
    human_created: 'bg-slate-100 text-slate-700',
  };
  const labels = {
    ai_generated: 'AI生成',
    human_adjusted: '人工调整',
    human_created: '人工创建',
  };
  const adjustedFields = (task.manuallyAdjustedFields || []).map(taskFieldLabel).filter(Boolean);
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-normal ${styles[source]}`}
      title={adjustedFields.length ? `人工调整字段：${adjustedFields.join('、')}` : undefined}
    >
      {labels[source]}
    </span>
  );
}

function AutoGrowingTextarea({ id, value, onChange, placeholder }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      id={id}
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 min-h-10 w-full resize-none overflow-hidden rounded-md border border-slate-300 bg-white px-3 py-2 font-normal leading-6"
      placeholder={placeholder}
    />
  );
}

function SingleTaskRegenerationPreview({ state, onRetry, onDiscard, onApply }) {
  if (state.status === 'generating') {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-md bg-slate-50 px-4 py-4 text-sm text-slate-700" role="status">
        <LoaderCircle size={18} className="animate-spin text-blue-600" />
        正在为当前训练任务生成候选，原内容不会被修改。
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="mt-4 rounded-md bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900" role="alert">
        <p>{state.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onRetry} className="ai-button-outline h-10 rounded-md border px-4 text-sm transition">再次生成</button>
          <button type="button" onClick={onDiscard} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">保留原内容</button>
        </div>
      </div>
    );
  }
  const candidate = state.candidateTask;
  if (!candidate) return null;
  const applying = state.status === 'applying';
  const rows = [
    ['具体训练点', state.sourceTask.focusDisplayName, candidate.focusDisplayName],
    ['题目', state.sourceTask.questionStem, candidate.questionStem],
    ['学生任务', state.sourceTask.expectedStudentAction, candidate.expectedStudentAction],
    ['观察目标', state.sourceTask.focusDefinition, candidate.focusDefinition],
    ['评分要点', rubricSummary(state.sourceTask), rubricSummary(candidate)],
  ];
  return (
    <section className="mt-4 rounded-md border border-blue-200 bg-blue-50/40 p-4" aria-label="单任务重新生成候选">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-950">重新生成候选</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">能力、难度、任务角色和材料范围保持不变。采用前不会创建新版本。</p>
        </div>
        <span className="rounded bg-blue-100 px-2 py-1 text-xs font-normal text-blue-800">待采用</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] border-y border-blue-200 text-sm">
          <div className="px-3 py-2 font-semibold text-slate-500">内容</div>
          <div className="border-l border-blue-100 px-3 py-2 font-semibold text-slate-700">原内容</div>
          <div className="border-l border-blue-100 px-3 py-2 font-semibold text-blue-800">新候选</div>
          {rows.map(([label, original, next]) => (
            <div key={label} className="contents">
              <div className="border-t border-blue-100 px-3 py-3 font-semibold text-slate-600">{label}</div>
              <div className="whitespace-pre-wrap border-l border-t border-blue-100 px-3 py-3 leading-6 text-slate-600">{original || '未填写'}</div>
              <div className="whitespace-pre-wrap border-l border-t border-blue-100 px-3 py-3 leading-6 text-slate-900">{next || '未填写'}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={applying} onClick={onDiscard} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">保留原内容</button>
        <button type="button" disabled={applying} onClick={onRetry} className="ai-button-outline h-10 rounded-md border px-4 text-sm transition disabled:opacity-40">再次生成</button>
        <button type="button" disabled={applying} onClick={onApply} className="ai-button-solid inline-flex h-10 items-center justify-center rounded-md border px-5 text-sm font-semibold transition disabled:opacity-50">
          {applying ? '正在采用' : '采用此候选'}
        </button>
      </div>
    </section>
  );
}

function GeneratorCandidatePreview({
  result,
  session,
  currentTasks,
  currentTaskCount,
  protectedTaskIds,
  onToggleCandidate,
  onAdopt,
  onDiscard,
}) {
  const providerFailed = result.status === 'provider_failed';
  const supplementMode = session?.operationType === 'supplement_group';
  const initialPlanningMode = session?.operationType === 'replace_group' && currentTasks.length === 0;
  const selectedCandidateIds = new Set(session?.selectedCandidateTaskIds || []);
  const selectedCount = selectedCandidateIds.size;
  const admittedCandidateCount = result.candidates.length + result.withheldCandidates.length;
  const totalCandidateCount = admittedCandidateCount + result.rejectedCandidates.length;
  const visibleLimitations = result.limitations.filter(
    (limitation) => !/^\d+ candidate\(s\) were rejected before import\.$/.test(limitation),
  );
  const currentCoverage = summarizeTrainingTaskGroupCoverage(currentTasks);
  const replacementTasks = session?.operationType === 'replace_group'
    ? adoptTrainingTaskGroupCandidate({
      session,
      currentTasks,
      currentPlanRevision: session.basedOnPlanRevision,
      protectedTaskIds,
      maxTasks: MAX_TRAINING_TASK_COUNT,
    }).tasks
    : currentTasks;
  const replacementCoverage = summarizeTrainingTaskGroupCoverage(replacementTasks);
  const protectedIds = new Set(protectedTaskIds);
  const protectedTaskCount = currentTasks.filter(
    (task) => protectedIds.has(task.observationTaskPlanId || task.localId),
  ).length;
  return (
    <div className="mt-5 border-l-4 border-slate-300 pl-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold">
          {result.status === 'candidates_ready'
            ? supplementMode
              ? '补充候选任务'
              : initialPlanningMode
                ? '首批候选训练任务'
                : '替代候选任务组'
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
      {result.status === 'candidates_ready' && !supplementMode && (
        <section className="mt-3 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950" aria-label="任务数量建议">
          <p className="font-semibold">推荐训练任务：{result.candidates.length} 个</p>
          <p>
            当前材料支持 {result.coveragePreview.independentObservationCount} 个独立观察点
            {result.coveragePreview.primaryAbilityIds.length > 0
              ? `，覆盖${result.coveragePreview.primaryAbilityIds.map((id) => abilityLabels[id] || id).join('、')}`
              : ''}
            。数量由材料可支持的观察价值决定。
          </p>
        </section>
      )}
      {result.status === 'candidates_ready' && session?.operationType === 'replace_group' && !initialPlanningMode && (
        <section className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 sm:grid-cols-2" aria-label="新旧任务组覆盖对比">
          <CoverageSummary title="当前任务组" coverage={currentCoverage} />
          <CoverageSummary title="替代方案" coverage={replacementCoverage} />
          {protectedTaskCount > 0 && (
            <p className="sm:col-span-2 text-xs leading-5 text-slate-600">
              已审核或已发布的 {protectedTaskCount} 个任务受保护；采用替代方案时仅替换其余任务。
            </p>
          )}
        </section>
      )}
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
                    - {issue === 'fewer_than_2_valid_independent_candidates'
                      ? `至少需要 2 个通过内容检查且训练方向不同的新任务。本次共生成 ${totalCandidateCount} 个：${admittedCandidateCount} 个通过内容检查，其中 ${result.coveragePreview.independentObservationCount} 个属于新的训练方向；${result.rejectedCandidates.length} 个未通过，因此暂不可导入。`
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
          {result.candidates.map((candidate, index) => {
            const selected = selectedCandidateIds.has(candidate.candidateId);
            const selectionLimitReached = supplementMode && !selected && currentTaskCount + selectedCount >= MAX_TRAINING_TASK_COUNT;
            return (
            <article key={candidate.candidateId} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {supplementMode && (
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={selectionLimitReached}
                      onChange={() => onToggleCandidate(candidate.candidateId)}
                      aria-label={`选择补充候选任务 ${index + 1}`}
                      className="h-4 w-4 accent-blue-600"
                    />
                  )}
                  <p className="inline-flex rounded bg-blue-50 px-2 py-1 text-xs font-normal text-blue-700">候选训练任务 {index + 1}</p>
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
          );})}
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
      {result.status === 'candidates_ready' && result.candidates.length > 0 && session && (
        <div className="mt-4 border-l-4 border-blue-500 bg-blue-50 px-4 py-3">
          <p className="text-sm leading-6 text-blue-950">
            {supplementMode
              ? `已选择 ${selectedCount} 个候选；采用后将加入当前编辑区。`
              : initialPlanningMode
                ? `采用后将把这 ${result.candidates.length} 个候选加入训练任务编辑区。`
                : `采用后将用这 ${result.candidates.length} 个候选替换当前编辑区中的任务组。`}
            保存前不会创建新版本，也不会进入正式资源。
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={onDiscard}
              className="h-10 rounded-md border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {supplementMode || initialPlanningMode ? '放弃候选' : '保留当前任务组'}
            </button>
            <button
              type="button"
              onClick={onAdopt}
              disabled={supplementMode && selectedCount === 0}
              className="ai-button-solid h-10 rounded-md border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {supplementMode
                ? `采用所选候选（${selectedCount}）`
                : initialPlanningMode
                  ? '采用这组候选'
                  : '用候选组替换当前任务组'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageSummary({ title, coverage }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{title} · {coverage.taskCount} 个任务</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        能力：{coverage.abilityIds.map((id) => abilityLabels[id] || id).join('、') || '未设置'}
      </p>
      <p className="text-xs leading-5 text-slate-600">
        训练方向：{coverage.dimensionIds.map((id) => dimensionLabels[id] || id).join('、') || '未设置'}
      </p>
    </div>
  );
}

function PreviewField({ label, value }) {
  return <div><p className="font-semibold text-slate-800">{label}</p><p className="mt-1 whitespace-pre-line text-slate-600">{value}</p></div>;
}

function formatPublishedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未记录';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatAnswerAcceptance(value) {
  if (!value) return '尚未设置；必须在逐题审核中补充。';
  const parts = [];
  if (value.acceptedAnswers?.length) parts.push(`可接受答案：${value.acceptedAnswers.join('；')}`);
  if (value.acceptedKeywords?.length) parts.push(`可接受要点：${value.acceptedKeywords.join('、')}`);
  if (value.semanticEquivalentAllowed) parts.push('允许语义等价表达');
  return parts.length ? parts.join('\n') : '已创建结构，但仍需人工确认具体接受边界。';
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

function taskWorkingIdentity(task) {
  return task?.taskRevisionRootId || task?.observationTaskPlanId || task?.localId || '';
}

function createTaskCommitIdempotencyKey(signature) {
  const suffix = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `task-working-commit:${signature}:${suffix}`;
}

function planTaskToEditableTask(task, index, anchors) {
  const specification = task.resourceDraftSpecification;
  const tags = specification?.tags || [];
  const manuallyAdjustedFields = readAdjustedFieldTags(tags);
  const sourceType = tags.includes('ai-assisted') ? 'ai_assisted' : 'manual';
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
    observationTaskPlanId: task.observationTaskPlanId,
    taskRevisionRootId: task.taskRevisionRootId || task.observationTaskPlanId,
    parentObservationTaskPlanId: task.parentObservationTaskPlanId,
    regenerationAttemptId: task.regenerationAttemptId,
    sourceType,
    contentOrigin: sourceType === 'ai_assisted' ? 'ai_generated' : 'human_created',
    manuallyAdjustedFields,
    taskAttributeAdjusted: manuallyAdjustedFields.length > 0,
    editorDirty: false,
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

function buildTrainingTaskEditableFields(task) {
  return {
    primaryDimension: task.primaryDimension,
    abilityId: task.abilityId,
    focusDisplayName: task.focusDisplayName,
    focusDefinition: task.focusDefinition,
    questionStem: task.questionStem,
    expectedStudentAction: task.expectedStudentAction,
    designReason: task.designReason,
    taskRole: task.taskRole,
    difficulty: task.difficulty,
    anchorType: task.anchorType,
    startParagraph: task.startParagraph,
    endParagraph: task.endParagraph,
    supportingAbilityIdsText: task.supportingAbilityIdsText,
    comparisonGroupId: task.comparisonGroupId,
    assessmentMode: task.assessmentMode,
    questionType: task.questionType,
    responseFormat: task.responseFormat,
    acceptedKeywordsText: task.acceptedKeywordsText,
    semanticEquivalentAllowed: task.semanticEquivalentAllowed,
    minLength: Number(task.minLength || 0),
    rubric: (task.rubric || []).map((item) => ({ ...item })),
    calibrationCases: (task.calibrationCases || []).map((item) => ({ ...item })),
  };
}

function buildWorkingQuestionEditableFields(task, draft) {
  const taskInput = toTaskInput(task);
  const specification = taskInput.resourceDraftSpecification;
  const baseContent = extractQuestionEditableFields(draft);
  return {
    ...baseContent,
    title: specification.title,
    questionStem: task.questionStem,
    questionType: specification.questionType,
    responseFormat: specification.responseFormat,
    assessmentMode: specification.assessmentMode,
    answerAcceptance: specification.answerAcceptance,
    rubric: specification.rubric,
    minimumAnswerRequirement: specification.minimumAnswerRequirement,
    abilityMetadata: {
      ...baseContent.abilityMetadata,
      abilityId: task.abilityId,
      supportingAbilityIds: specification.supportingAbilityIds,
      taskRole: task.taskRole,
      difficulty: task.difficulty,
      gradeRange: specification.gradeRange || baseContent.abilityMetadata.gradeRange,
    },
  };
}

function mergeWorkingContentIntoEditableTask(task, workingContent) {
  const taskContent = workingContent.taskContent;
  if (taskContent) {
    return {
      ...task,
      ...taskContent,
      rubric: taskContent.rubric.map((item) => ({ ...item })),
      calibrationCases: taskContent.calibrationCases.map((item) => ({ ...item })),
      editorDirty: false,
    };
  }

  return {
    ...task,
    questionStem: workingContent.content.questionStem,
    questionType: workingContent.content.questionType,
    responseFormat: workingContent.content.responseFormat,
    assessmentMode: workingContent.content.assessmentMode,
    semanticEquivalentAllowed:
      workingContent.content.answerAcceptance.semanticEquivalentAllowed,
    acceptedKeywordsText: [
      ...(workingContent.content.answerAcceptance.acceptedKeywords || []),
      ...(workingContent.content.answerAcceptance.acceptedAnswers || []),
    ].join('\n'),
    minLength: workingContent.content.minimumAnswerRequirement.minLength,
    editorDirty: false,
  };
}

function generatorCandidateToEditableTask(candidate, index) {
  return {
    localId: candidate.candidateId,
    sourceType: 'ai_assisted',
    contentOrigin: 'ai_generated',
    manuallyAdjustedFields: [],
    taskAttributeAdjusted: false,
    editorDirty: false,
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

function createLockedRegenerationCandidate(candidate, sourceTask, index) {
  const generated = generatorCandidateToEditableTask(candidate, index);
  return {
    ...generated,
    localId: `regeneration-candidate-${candidate.candidateId}`,
    observationTaskPlanId: sourceTask.observationTaskPlanId,
    taskRevisionRootId: sourceTask.taskRevisionRootId || sourceTask.observationTaskPlanId,
    parentObservationTaskPlanId: sourceTask.parentObservationTaskPlanId,
    regenerationAttemptId: sourceTask.regenerationAttemptId,
    primaryDimension: sourceTask.primaryDimension,
    abilityId: sourceTask.abilityId,
    taskRole: sourceTask.taskRole,
    difficulty: sourceTask.difficulty,
    anchorType: sourceTask.anchorType,
    startParagraph: sourceTask.startParagraph,
    endParagraph: sourceTask.endParagraph,
    comparisonGroupId: sourceTask.comparisonGroupId,
    rubric: generated.rubric.map((item) => ({
      ...item,
      abilityId: sourceTask.abilityId,
    })),
  };
}

function buildSingleTaskRegenerationInventory(plan, sourceTask) {
  if (!plan) return { observations: [], questions: [] };
  const siblingTasks = plan.taskPlans.filter(
    (task) => task.observationTaskPlanId !== sourceTask.observationTaskPlanId,
  );
  return {
    observations: siblingTasks.map((task) => ({
      observationId: task.observationTaskPlanId,
      primaryAbilityId: task.abilityId,
      observationDimension: task.primaryDimension,
      focusDisplayName: task.observationFocus?.displayName || task.observationGoal,
      focusDefinition: task.observationFocus?.definition || task.designReason,
      expectedStudentAction: task.expectedStudentAction,
    })),
    questions: siblingTasks.map((task) => ({
      questionId: `${task.observationTaskPlanId}:question`,
      questionStem: task.observationGoal,
      observationId: task.observationTaskPlanId,
      primaryAbilityId: task.abilityId,
      observationDimension: task.primaryDimension,
    })),
  };
}

function singleTaskRegenerationFocus(task) {
  const focus = [
    task.focusDisplayName,
    task.focusDefinition,
    `仅重写当前任务的题目、学生任务、观察目标和评分要点；保持${abilityLabels[task.abilityId] || task.abilityId}能力与原训练方向。`,
  ]
    .filter(Boolean)
    .join('；');
  return focus.slice(0, 160);
}

function rubricSummary(task) {
  const items = task?.rubric || [];
  if (items.length === 0) return '未填写';
  return items
    .map((item, index) => {
      const name = item.name?.trim() || `评分项${index + 1}`;
      const description = item.description?.trim();
      const signals = item.acceptedSignalsText?.trim();
      return [name, description, signals && `要点：${signals}`].filter(Boolean).join('；');
    })
    .join('\n');
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
    observationTaskPlanId: task.observationTaskPlanId,
    taskRevisionRootId: task.taskRevisionRootId,
    parentObservationTaskPlanId: task.parentObservationTaskPlanId,
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
      tags: [
        'phase17.2',
        task.sourceType === 'ai_assisted' ? 'ai-assisted' : 'manual-production',
        `content-origin:${task.contentOrigin || (task.sourceType === 'ai_assisted' ? 'ai_generated' : 'human_created')}`,
        ...(task.manuallyAdjustedFields || []).map((field) => `human-adjusted-field:${field}`),
        task.abilityId,
      ],
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
    fully_meets: '应满足主要评分标准。',
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

function collectEditableTaskIssues(task, taskIndex) {
  const prefix = `训练任务 ${taskIndex + 1}`;
  const issues = [];
  const add = (field, displayField, message) => issues.push({
    code: `editable_task_${field}_missing`,
    field,
    displayField: `${prefix} · ${displayField}`,
    message,
    taskId: task.localId,
    targetId: taskFieldId(task, field),
  });
  if (!task.questionStem.trim()) add('questionStem', '题目', '请补充学生实际看到的题目。');
  if (!task.expectedStudentAction.trim()) add('expectedStudentAction', '学生任务', '请写清学生需要完成的具体作答动作。');
  if (!task.designReason.trim()) add('designReason', '设计理由', '请说明该题用于观察什么。');
  if (!task.focusDisplayName.trim()) add('focusDisplayName', '具体训练点', '请为本任务填写明确的训练点名称。');
  if (!task.focusDefinition.trim()) add('focusDefinition', '训练点说明', '请说明这个训练点具体观察什么。');
  if (task.anchorType !== 'full_text' && (!Number.isInteger(task.startParagraph) || task.startParagraph < 1)) {
    add('startParagraph', '开始段落', '开始段落必须是有效的正整数。');
  }
  if (task.anchorType === 'paragraph_range' && (!Number.isInteger(task.endParagraph) || task.endParagraph < task.startParagraph)) {
    add('endParagraph', '结束段落', '结束段落不能早于开始段落。');
  }
  if (['retest', 'transfer'].includes(task.taskRole) && !task.comparisonGroupId.trim()) {
    add('comparisonGroupId', '关联训练组', '复测或迁移任务必须关联一个训练组。');
  }
  if (!task.rubric.length) {
    add('rubric', '评分标准', '至少需要一个评分项。');
  } else if (task.rubric.some((item) => !item.name.trim() || !item.description.trim())) {
    add('rubric', '评分标准', '每个评分项都需要名称和具体判断标准。');
  }
  return issues;
}

function taskFieldId(task, field) {
  return `training-task-${task.localId}-${field}`;
}

function attachValidationIssueTarget(issue, tasks) {
  const match = String(issue.field || '').match(/^taskPlans\.(\d+)(?:\.(.+))?$/);
  if (!match) return issue;
  const task = tasks[Number(match[1])];
  if (!task) return issue;
  const fieldPath = match[2] || '';
  const field = validationFieldTarget(fieldPath);
  return {
    ...issue,
    displayField: `${taskEditorTitle(Number(match[1]))} · ${taskFieldLabel(field) || '任务内容'}`,
    taskId: task.localId,
    targetId: taskFieldId(task, field),
  };
}

function validationFieldTarget(fieldPath) {
  if (fieldPath.includes('rubric')) return 'rubric';
  if (fieldPath.includes('minimumAnswerRequirement')) return 'rubric';
  if (fieldPath.includes('supportingAbilityIds')) return 'rubric';
  if (fieldPath.includes('primaryDimension')) return 'primaryDimension';
  if (fieldPath.includes('abilityId')) return 'abilityId';
  if (fieldPath.includes('taskRole')) return 'taskRole';
  if (fieldPath.includes('difficulty')) return 'difficulty';
  if (fieldPath.includes('sourceAnchorIds')) return 'anchorType';
  if (fieldPath.includes('observationFocus')) return 'focusDisplayName';
  if (fieldPath.includes('intendedComparisonGroupId')) return 'comparisonGroupId';
  return 'questionStem';
}

function resolveTaskSource(task) {
  if (task.sourceType !== 'ai_assisted') return 'human_created';
  return (task.manuallyAdjustedFields || []).length > 0 || task.taskAttributeAdjusted
    ? 'human_adjusted'
    : 'ai_generated';
}

function dedupeTaskIssues(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.taskId || 'general'}:${issue.targetId || issue.field || issue.code}:${issue.message || issue.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function taskFieldLabel(field) {
  return ({
    primaryDimension: '内容侧重',
    abilityId: '主要能力',
    taskRole: '任务角色',
    difficulty: '难度',
    anchorType: '阅读范围',
    startParagraph: '开始段落',
    endParagraph: '结束段落',
    focusDisplayName: '具体训练点',
    focusDefinition: '训练点说明',
    comparisonGroupId: '关联训练组',
    questionStem: '题目',
    expectedStudentAction: '作答要求',
    designReason: '设计理由',
    rubric: '评分标准',
    assessmentMode: '评分方式',
    minLength: '最低字数',
    questionType: '题目类型',
    responseFormat: '作答形式',
    acceptedKeywordsText: '可接受要点',
    semanticEquivalentAllowed: '语义等价设置',
    calibrationCases: '答案示例',
    supportingAbilityIdsText: '相关能力',
  })[field] || field;
}

function readAdjustedFieldTags(tags) {
  return [...new Set(tags
    .filter((tag) => tag.startsWith('human-adjusted-field:'))
    .map((tag) => tag.slice('human-adjusted-field:'.length))
    .filter(Boolean))];
}
function formatAnchorSummary(task) {
  if (task.anchorType === 'full_text') return '全文';
  if (task.anchorType === 'paragraph_range') return `第 ${task.startParagraph}–${task.endParagraph} 段`;
  return `第 ${task.startParagraph} 段`;
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
    candidate_count_outside_planning_range: '模型返回的候选数量超出本次规划范围。',
    fewer_than_2_valid_independent_candidates: '通过校验且彼此独立的候选不足 2 个。',
    candidate_count_must_be_3_to_6: '模型没有返回 3–6 个表面候选。',
    fewer_than_3_valid_independent_candidates: '通过校验且彼此独立的候选不足 3 个。',
    no_new_observation_candidate: '本轮候选均与已有 Observation 重合，没有发现可增加覆盖的新观测。',
    candidate_not_object: '候选不是合法结构',
    question_stem_missing: '缺少题目入口',
    question_draft_missing: '缺少题型或作答形式',
    question_type_invalid: '题目类型不在允许范围',
    response_format_invalid: '作答形式不在允许范围',
    primary_ability_invalid: '主要训练能力缺失或设置不合理',
    observation_dimension_invalid: 'Material Dimension 缺失或不合法',
    difficulty_invalid: '难度建议不合法',
    assessment_mode_invalid: '评价模式不合法',
    expected_student_action_missing: '缺少预期学生动作',
    design_rationale_missing: '缺少设计理由',
    observation_focus_missing: '缺少具体训练点',
    observation_focus_name_missing: '缺少训练点名称',
    observation_focus_definition_missing: '缺少训练点说明',
    material_anchor_missing: '缺少素材范围',
    material_anchor_type_invalid: '素材范围类型不合法',
    material_anchor_out_of_range: '引用的素材段落超出当前素材范围',
    supporting_ability_duplicates_primary: '相关能力与主要训练能力重复',
    rubric_missing: '缺少评分标准',
    answer_acceptance_missing: '缺少可接受的作答范围',
    answer_acceptance_keywords_missing: '可接受的作答范围中缺少关键要点',
    semantic_equivalent_must_be_allowed: '未允许合理异表述',
    minimum_answer_requirement_missing: '缺少最低作答要求',
    minimum_answer_length_invalid: '最低字数不合法',
    minimum_answer_flags_invalid: '最低作答条件不完整',
    calibration_answers_missing: '缺少校准答案',
    evidence_potential_invalid: '能力观察强度设置不合理',
    evidence_boundary_missing: '缺少能力判断边界',
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
    'Only new observation candidates are importable in discover_new_observation mode.': '当前只导入新的训练方向；替代问法和疑似重复内容不会导入。',
    'Candidate repair output was invalid JSON; previously admitted candidates were preserved.': '自动修复结果格式无效；第一轮已通过的候选仍被保留。',
    'Candidate repair call failed; previously admitted candidates were preserved.': '自动修复调用未完成；第一轮已通过的候选仍被保留。',
  };
  const rejectedMatch = limitation.match(/^(\d+) candidate\(s\) were rejected before import\.$/);
  if (rejectedMatch) return `${rejectedMatch[1]} 个候选未通过导入前的内容检查。`;
  const withheldMatch = limitation.match(/^(\d+) candidate\(s\) matched existing or same-batch observations and were withheld from import\.$/);
  if (withheldMatch) return `${withheldMatch[1]} 个候选与已有或本批次训练方向重复，已保留供查看但不会导入。`;
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
function createSingleTaskRegenerationAttemptId(observationTaskPlanId) {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `single-task-regeneration-${observationTaskPlanId}-${suffix}`;
}
function taskEditorTitle(index) {
  return `训练任务${index + 1}`;
}
function createEmptyMaterialForm() {
  return {
    title: '',
    content: '',
    description: '人工录入素材',
    copyrightNote: '',
  };
}
function collapseWorkingDraftPlans(plans) {
  let workingDraftIncluded = false;
  return [...plans]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .filter((plan) => {
      if (!['draft', 'revision_required'].includes(plan.status)) return true;
      if (workingDraftIncluded) return false;
      workingDraftIncluded = true;
      return true;
    });
}
function splitParagraphs(content) { return content.replace(/\r\n/g, '\n').trim().split(/\n\s*\n|\n/).map((value) => value.trim()).filter(Boolean); }
function errorNotice(error) { return createWorkbenchErrorNotice(error, { operation: 'material_workbench.operation' }); }
const emptySnapshot = { sharedStoreStatus: null, materials: [], anchors: [], plans: [], validations: [], drafts: [], frozenVersions: [], links: [], draftReadiness: [] };
