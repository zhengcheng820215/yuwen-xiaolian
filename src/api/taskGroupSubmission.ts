import {
  commitTaskGroupChanges,
  type TaskDraftSnapshot,
} from '../ai/agents/taskGroupSubmissionService.ts';
import {
  createEditableSuccessorQuestionResourceDraft,
  updateStructuredQuestionDraft,
} from '../ai/agents/questionResourceAdmissionAgent.ts';
import {
  getWorkingTaskContentState,
  resolveTrainingTaskId,
} from '../ai/agents/workingTaskContentService.ts';
import {
  createBrowserMaterialObservationRepository,
  createBrowserQuestionResourceAdmissionRepository,
} from '../ai/repositories/formalResourceRepositoryRouter.ts';
import { IndexedDBTaskGroupSubmissionRepository } from '../ai/repositories/indexedDBTaskGroupSubmissionRepository.ts';
import { IndexedDBWorkingTaskContentRepository } from '../ai/repositories/indexedDBWorkingTaskContentRepository.ts';
import type {
  MaterialObservationPlan,
  MaterialSourceAnchor,
  ObservationTaskPlan,
} from '../ai/schemas/materialObservation.schema.ts';
import type { TaskRevisionBinding } from '../ai/schemas/taskGroupSubmission.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  extractQuestionEditableFields,
  type TrainingTaskEditableFields,
  type WorkingTaskContent,
} from '../ai/schemas/workingTaskContent.schema.ts';
import type { MaterialProductionTaskInput } from '../ai/agents/materialObservationApplicationService.ts';
import { createProductionObservationPlan } from './materialResourceProductionWorkbench.ts';
import { completeQuestionResourceWorkbenchQualityCheck } from './questionResourceWorkbench.ts';

const submissionRepository = new IndexedDBTaskGroupSubmissionRepository();
const workingRepository = new IndexedDBWorkingTaskContentRepository();
const questionRepository = createBrowserQuestionResourceAdmissionRepository();
const observationRepository = createBrowserMaterialObservationRepository();

export async function commitQuestionTaskWorkingChanges(input: {
  planId: string;
  materialVersionId: string;
  requestedTaskIds: string[];
  idempotencyKey: string;
}) {
  const sourcePlan = await observationRepository.getPlan(input.planId);
  if (!sourcePlan) throw new Error(`Material Observation Plan not found: ${input.planId}`);
  const scopedTaskIds = sourcePlan.taskPlans.map(taskIdentity);

  return commitTaskGroupChanges({
    submissionRepository,
    getWorkingState: (trainingTaskId) => getWorkingTaskContentState(
      workingRepository,
      questionRepository,
      trainingTaskId,
    ),
    listTaskDrafts: () => listTaskDrafts(scopedTaskIds),
    commitWorkingChanges: async (submission) => {
      const workingByTask = new Map<string, WorkingTaskContent>();
      const currentDraftByTask = new Map(
        (await listTaskDrafts(scopedTaskIds)).map((draft) => [draft.trainingTaskId, draft]),
      );
      const pendingTaskIds = submission.requestedTaskIds.filter((trainingTaskId) => {
        const existingResult = submission.taskResults.find(
          (result) => result.trainingTaskId === trainingTaskId,
        );
        if (existingResult?.revisionCreated) return false;
        const binding = submission.taskRevisionBindings.find(
          (item) => item.trainingTaskId === trainingTaskId,
        );
        const current = currentDraftByTask.get(trainingTaskId);
        return !binding || !current || (
          current.draftId === (binding.fromDraftId || binding.draftId)
          && current.revision === binding.fromRevision
          && current.contentHash === binding.contentHash
        );
      });
      for (const trainingTaskId of pendingTaskIds) {
        const state = await getWorkingTaskContentState(
          workingRepository,
          questionRepository,
          trainingTaskId,
        );
        if (state.status !== 'current') {
          throw new Error(`Saved Working Content is not current: ${trainingTaskId}`);
        }
        workingByTask.set(trainingTaskId, state.workingContent);
      }

      const committedPlan = submission.committedPlanId
        ? await observationRepository.getPlan(submission.committedPlanId)
        : null;
      let resultPlan = committedPlan;
      if (!resultPlan) {
        const anchors = await observationRepository.listAnchors(input.materialVersionId);
        const tasks = sourcePlan.taskPlans.map((task) => {
          const working = workingByTask.get(taskIdentity(task));
          return working?.taskContent
            ? workingTaskToProductionInput(task, working.taskContent)
            : observationTaskToProductionInput(task, anchors);
        });
        const result = await createProductionObservationPlan({
          materialVersionId: input.materialVersionId,
          sourcePlanId: input.planId,
          tasks,
        });
        if (!result.validation.passed) {
          throw new Error('Task group coverage check failed before question revisions were created.');
        }
        resultPlan = result.plan;
      }

      const committedTaskByRoot = new Map(
        resultPlan.taskPlans.map((task) => [taskIdentity(task), task]),
      );
      const beforeDraftByTask = new Map(
        (await listTaskDrafts(scopedTaskIds)).map((draft) => [draft.trainingTaskId, draft]),
      );
      const failedTaskIds: string[] = [];
      for (const [trainingTaskId, working] of workingByTask) {
        const before = beforeDraftByTask.get(trainingTaskId);
        const committedTask = committedTaskByRoot.get(trainingTaskId);
        if (!before || !committedTask) {
          failedTaskIds.push(trainingTaskId);
          continue;
        }
        try {
          const editableDraft = await createEditableSuccessorQuestionResourceDraft(
            questionRepository,
            {
              sourceDraftId: before.draftId,
              draftId: createSuccessorDraftId(before.draftId),
            },
          );
          const content = alignQuestionContentToCommittedTask(
            working,
            resultPlan,
            committedTask,
          );
          await updateStructuredQuestionDraft(
            questionRepository,
            editableDraft.draftId,
            content,
            new Date().toISOString(),
            { expectedRevision: editableDraft.revision },
          );
        } catch {
          failedTaskIds.push(trainingTaskId);
        }
      }
      return {
        committedPlanId: resultPlan.materialObservationPlanId,
        failedTaskIds,
      };
    },
    completeTaskAssessment: async (draftId, revision) => {
      await completeQuestionResourceWorkbenchQualityCheck(draftId, revision);
    },
    completeGroupAssessment: async (bindings, submission) => {
      await assertStableTaskRevisionBindings(bindings, scopedTaskIds);
      const validationPlanId = submission.committedPlanId || submission.planId;
      const validations = await observationRepository.listValidations(validationPlanId);
      const latest = validations.sort((left, right) => (
        right.checkedAt.localeCompare(left.checkedAt)
      ))[0];
      if (!latest?.passed) throw new Error('Task group coverage check is missing or failed.');
    },
    discardWorkingContent: (trainingTaskId) => workingRepository.delete(trainingTaskId),
  }, {
    planId: input.planId,
    requestedTaskIds: input.requestedTaskIds,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function listQuestionTaskGroupSubmissions(planId?: string) {
  return submissionRepository.list(planId);
}

async function listTaskDrafts(taskIds: string[]): Promise<TaskDraftSnapshot[]> {
  const requested = new Set(taskIds);
  const drafts = await questionRepository.listDrafts();
  const activeByTask = new Map<string, typeof drafts[number]>();
  for (const draft of drafts) {
    if (['archived', 'rejected'].includes(draft.status)) continue;
    const trainingTaskId = resolveTrainingTaskId(draft);
    if (!requested.has(trainingTaskId)) continue;
    const current = activeByTask.get(trainingTaskId);
    if (
      !current
      || draft.updatedAt > current.updatedAt
      || (draft.updatedAt === current.updatedAt && draft.revision > current.revision)
    ) {
      activeByTask.set(trainingTaskId, draft);
    }
  }
  return [...activeByTask.entries()].map(([trainingTaskId, draft]) => ({
    trainingTaskId,
    draftId: draft.draftId,
    revision: draft.revision,
    contentHash: calculateQuestionEditableFieldsHash(extractQuestionEditableFields(draft)),
  }));
}

async function assertStableTaskRevisionBindings(
  bindings: TaskRevisionBinding[],
  taskIds: string[],
): Promise<void> {
  const currentByTask = new Map(
    (await listTaskDrafts(taskIds)).map((item) => [item.trainingTaskId, item]),
  );
  const changed = bindings.filter((binding) => {
    const current = currentByTask.get(binding.trainingTaskId);
    return !current
      || current.draftId !== binding.draftId
      || current.revision !== binding.toRevision
      || current.contentHash !== binding.contentHash;
  });
  if (changed.length > 0) {
    throw new Error('Task group assessment snapshot changed while checking.');
  }
}

function alignQuestionContentToCommittedTask(
  working: WorkingTaskContent,
  plan: MaterialObservationPlan,
  task: ObservationTaskPlan,
) {
  const removablePrefixes = [
    'observation_plan:',
    'observation_task:',
    'observation_task_root:',
    'observation_task_parent:',
    'observation_dimension:',
    'observation_focus:',
    'comparison_group:',
  ];
  const tags = working.content.tags.filter(
    (tag) => !removablePrefixes.some((prefix) => tag.startsWith(prefix)),
  );
  tags.push(
    `observation_plan:${plan.materialObservationPlanId}`,
    `observation_task:${task.observationTaskPlanId}`,
    `observation_task_root:${taskIdentity(task)}`,
    `observation_dimension:${task.primaryDimension}`,
  );
  if (task.parentObservationTaskPlanId) {
    tags.push(`observation_task_parent:${task.parentObservationTaskPlanId}`);
  }
  if (task.observationFocus?.focusCode) {
    tags.push(`observation_focus:${task.observationFocus.focusCode}`);
  }
  if (task.intendedComparisonGroupId) {
    tags.push(`comparison_group:${task.intendedComparisonGroupId}`);
  }
  return {
    ...working.content,
    materialVersionId: plan.materialVersionId,
    abilityMetadata: {
      ...working.content.abilityMetadata,
      primaryAbilityId: task.abilityId,
      taskRole: task.taskRole,
      difficulty: task.difficulty,
    },
    tags: [...new Set(tags)].sort((left, right) => left.localeCompare(right)),
  };
}

function observationTaskToProductionInput(
  task: ObservationTaskPlan,
  anchors: MaterialSourceAnchor[],
): MaterialProductionTaskInput {
  const anchor = anchors.find((item) => task.sourceAnchorIds.includes(item.sourceAnchorId));
  return {
    observationTaskPlanId: task.observationTaskPlanId,
    taskRevisionRootId: taskIdentity(task),
    parentObservationTaskPlanId: task.parentObservationTaskPlanId,
    primaryDimension: task.primaryDimension,
    observationFocus: task.observationFocus,
    abilityId: task.abilityId,
    taskRole: task.taskRole,
    difficulty: task.difficulty,
    anchorType: anchor?.anchorType || 'full_text',
    startParagraph: anchor?.startParagraph,
    endParagraph: anchor?.endParagraph,
    questionStem: task.observationGoal,
    expectedStudentAction: task.expectedStudentAction,
    designReason: task.designReason,
    intendedComparisonGroupId: task.intendedComparisonGroupId,
    materialRelationIntent: task.materialRelationIntent,
    resourceDraftSpecification: task.resourceDraftSpecification,
    calibrationCases: task.calibrationCases,
  };
}

function workingTaskToProductionInput(
  sourceTask: ObservationTaskPlan,
  content: TrainingTaskEditableFields,
): MaterialProductionTaskInput {
  const supportingAbilityIds = commaValues(content.supportingAbilityIdsText)
    .filter((abilityId) => abilityId !== content.abilityId);
  return {
    observationTaskPlanId: sourceTask.observationTaskPlanId,
    taskRevisionRootId: taskIdentity(sourceTask),
    parentObservationTaskPlanId: sourceTask.parentObservationTaskPlanId,
    primaryDimension: content.primaryDimension as MaterialProductionTaskInput['primaryDimension'],
    observationFocus: {
      focusCode: `${content.primaryDimension}-${content.abilityId}-${content.focusDisplayName.trim()}`,
      displayName: content.focusDisplayName.trim(),
      definition: content.focusDefinition.trim(),
      scope: 'plan_local',
    },
    abilityId: content.abilityId as MaterialProductionTaskInput['abilityId'],
    taskRole: content.taskRole as MaterialProductionTaskInput['taskRole'],
    difficulty: content.difficulty as MaterialProductionTaskInput['difficulty'],
    anchorType: content.anchorType as MaterialProductionTaskInput['anchorType'],
    startParagraph: content.anchorType === 'full_text' ? undefined : content.startParagraph,
    endParagraph: content.anchorType === 'paragraph_range' ? content.endParagraph : undefined,
    questionStem: content.questionStem,
    expectedStudentAction: content.expectedStudentAction,
    designReason: content.designReason,
    intendedComparisonGroupId: ['retest', 'transfer'].includes(content.taskRole)
      ? content.comparisonGroupId.trim()
      : undefined,
    materialRelationIntent: content.taskRole === 'transfer'
      ? 'new_context'
      : content.taskRole === 'retest'
        ? 'similar_context'
        : 'same_context',
    resourceDraftSpecification: {
      title: `${content.abilityId} · ${content.focusDisplayName.trim()}`,
      questionType: content.questionType as NonNullable<MaterialProductionTaskInput['resourceDraftSpecification']>['questionType'],
      responseFormat: content.responseFormat as NonNullable<MaterialProductionTaskInput['resourceDraftSpecification']>['responseFormat'],
      assessmentMode: content.assessmentMode as NonNullable<MaterialProductionTaskInput['resourceDraftSpecification']>['assessmentMode'],
      answerAcceptance: {
        acceptedKeywords: lineValues(content.acceptedKeywordsText),
        semanticEquivalentAllowed: content.semanticEquivalentAllowed,
        normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
      },
      rubric: content.rubric.map((item, index) => ({
        itemId: `rubric-${index + 1}`,
        name: item.name.trim(),
        description: item.description.trim(),
        abilityId: item.abilityId as MaterialProductionTaskInput['abilityId'],
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
        minLength: content.minLength,
        requireTextEvidence: true,
        requireExplanation: content.abilityId !== 'extraction',
      },
      supportingAbilityIds: supportingAbilityIds as NonNullable<MaterialProductionTaskInput['resourceDraftSpecification']>['supportingAbilityIds'],
      prerequisiteAbilityIds: [],
      gradeRange: '七至九年级',
      tags: sourceTask.resourceDraftSpecification?.tags || [],
    },
    calibrationCases: content.calibrationCases
      .filter((item) => item.answerText.trim())
      .map((item, index) => ({
        calibrationCaseId: `${content.primaryDimension}-${content.abilityId}-${index + 1}-${item.category}`,
        category: item.category as NonNullable<MaterialProductionTaskInput['calibrationCases']>[number]['category'],
        answerText: item.answerText.trim(),
        expectedAnswerStatus: item.category === 'fully_meets'
          ? 'fully_meets'
          : item.category === 'partially_meets'
            ? 'partially_meets'
            : 'does_not_meet',
        reviewNote: item.category === 'fully_meets'
          ? '答案完整覆盖任务目标。'
          : item.category === 'partially_meets'
            ? '答案部分覆盖任务目标。'
            : '答案存在典型偏差。',
      })),
  };
}

function taskIdentity(task: ObservationTaskPlan): string {
  return task.taskRevisionRootId || task.observationTaskPlanId;
}

function createSuccessorDraftId(baseDraftId: string): string {
  const suffix = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${baseDraftId}-working-${suffix}`;
}

function commaValues(value: string): string[] {
  return [...new Set(value.split(/[,，]/).map((item) => item.trim()).filter(Boolean))];
}

function lineValues(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}
