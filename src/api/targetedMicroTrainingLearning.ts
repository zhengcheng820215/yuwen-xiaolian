import {
  attachTargetedAssignmentToLearningSession,
  beginTargetedMicroTraining,
  recoverTargetedMicroTrainingTransition,
  settleTargetedMicroTraining,
  type TargetedMicroTrainingLearningTransition,
} from '../ai/agents/targetedMicroTrainingLearningOrchestrator.ts';
export type { TargetedMicroTrainingLearningTransition } from '../ai/agents/targetedMicroTrainingLearningOrchestrator.ts';
import {
  isTargetedMicroTrainingSchedulingEnabled,
  scheduleTargetedMicroTraining,
} from '../ai/agents/targetedMicroTrainingSchedulingService.ts';
import { createBrowserQuestionResourceAdmissionRepository } from '../ai/repositories/formalResourceRepositoryRouter.ts';
import { IndexedDBTargetedMicroTrainingSchedulingRepository } from '../ai/repositories/indexedDBTargetedMicroTrainingSchedulingRepository.ts';
import { LocalStorageUnifiedLearningEntryRepository } from '../ai/repositories/localStorageUnifiedLearningEntryRepository.ts';
import type { FrozenQuestionResourceVersion } from '../ai/schemas/questionResourceAdmission.schema.ts';
import type { StudentLearningFeedback } from '../ai/schemas/studentLearningFeedback.schema.ts';
import type { TargetedMicroTrainingRuntimeEventName } from '../ai/schemas/targetedMicroTrainingScheduling.schema.ts';
import {
  getTargetedMicroTrainingStage4Service,
  recordTargetedMicroTrainingLifecycleEvent,
} from './targetedMicroTrainingStage4.ts';

const schedulingRepository = new IndexedDBTargetedMicroTrainingSchedulingRepository();
const activityRepository = new LocalStorageUnifiedLearningEntryRepository();
const formalResourceRepository = createBrowserQuestionResourceAdmissionRepository();

export async function scheduleTargetedTrainingAfterCoreResult(input: {
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  sourceAttemptId: string;
  sourceCoreTaskNumber: number;
  sourceVersion: FrozenQuestionResourceVersion;
  feedback?: StudentLearningFeedback;
  persistenceCompleted: boolean;
  revisionAvailable: boolean;
  now: string;
}): Promise<TargetedMicroTrainingLearningTransition | null> {
  const isolatedVerify = stage4IsolatedVerifyRequested();
  const stage4Enabled = await getTargetedMicroTrainingStage4Service()
    .canSchedule(input.studentId, isolatedVerify);
  if ((!isTargetedMicroTrainingSchedulingEnabled() && !stage4Enabled)
    || !input.feedback?.thinkingReview) return null;
  const review = input.feedback.thinkingReview;
  const requirementIds = review.primaryGapRequirementId ? [review.primaryGapRequirementId] : [];
  const gapMap = Object.fromEntries(
    (review.requirementCoverage || []).map((item) => [item.requirementId, item.gapReasonCode]),
  );
  const [snapshot, activityContext] = await Promise.all([
    schedulingRepository.load(),
    activityRepository.getByStudent(input.studentId),
  ]);
  const activeAssignments = snapshot.assignments.filter((assignment) => {
    if (!['pending', 'in_progress'].includes(assignment.status)) return false;
    const request = snapshot.requests.find((item) => item.requestId === assignment.requestId);
    return request?.studentId === input.studentId
      && request.learningSessionId === input.learningSessionId;
  });
  const completedCount = snapshot.assignments.filter((assignment) => {
    if (assignment.status !== 'completed') return false;
    const request = snapshot.requests.find((item) => item.requestId === assignment.requestId);
    return request?.studentId === input.studentId && request.learningSessionId === input.learningSessionId;
  }).length;
  const [versions, entries, materials] = await Promise.all([
    formalResourceRepository.listVersions(),
    formalResourceRepository.listRegistryEntries(),
    formalResourceRepository.listMaterials(),
  ]);
  const frozenVersions = versions.filter((version) => version.status === 'frozen');
  const verificationVersions = isolatedVerify && stage4SingleChoiceVerifyRequested()
    ? frozenVersions.filter((version) => version.responseFormat === 'single_choice')
    : frozenVersions;
  const excludedResourceVersionIds = snapshot.assignments.flatMap((assignment) => {
    const request = snapshot.requests.find((item) => item.requestId === assignment.requestId);
    return request?.studentId === input.studentId ? [assignment.resourceVersionId] : [];
  });
  const scheduled = await scheduleTargetedMicroTraining({
    trigger: {
      enabled: true,
      studentId: input.studentId,
      learningSessionId: input.learningSessionId,
      sourceLearningRoundId: input.learningRoundId,
      sourceAttemptId: input.sourceAttemptId,
      sourceResourceVersionId: input.sourceVersion.resourceVersionId,
      sourceMaterialId: input.sourceVersion.materialId || input.sourceVersion.materialVersionId || 'unknown-material',
      sourceCoreTaskNumber: input.sourceCoreTaskNumber,
      sourceTaskRole: input.sourceVersion.abilityMetadata.taskRole,
      sourceIsCurrentCoreQueueTask: activityContext?.learningSessionId === input.learningSessionId
        && activityContext.taskQueue?.resourceVersionIds[input.sourceCoreTaskNumber - 1]
          === input.sourceVersion.resourceVersionId,
      persistenceCompleted: input.persistenceCompleted,
      identitiesAligned: input.feedback.learningRoundId === input.learningRoundId
        && input.feedback.studentId === input.studentId,
      primaryAbilityId: input.sourceVersion.abilityMetadata.abilityId,
      primaryGapRequirementIds: requirementIds,
      requirementGapReasonCodes: gapMap,
      revisionAvailable: input.revisionAvailable,
      alreadyTerminatedForAttempt: snapshot.decisions.some((item) => item.sourceAttemptId === input.sourceAttemptId),
      completedAssignmentCount: completedCount,
      hasPendingOrInProgressAssignment: activeAssignments.length > 0,
      evaluatedAt: input.now,
    },
    matchFacts: {
      sourceMaterialId: input.sourceVersion.materialId || input.sourceVersion.materialVersionId || 'unknown-material',
      sourceResourceVersionId: input.sourceVersion.resourceVersionId,
      sourceAnchors: [],
      // 仅用于 Stage 4 隔离浏览器验收：把候选集合收窄到单选正式版本，
      // 以确定性验证 B4-15。真实学习调度仍使用完整 Frozen 候选集合。
      currentFrozenVersions: verificationVersions,
      activeRegistryEntries: entries,
      activeMaterials: materials,
    },
    repository: schedulingRepository,
  });
  const evaluatedOutcome = scheduled.decision.outcome === 'no_match'
    ? `eligible:${scheduled.decision.gapReasonCode || 'unknown'}`
    : `${scheduled.decision.outcome}:${scheduled.decision.gapReasonCode || 'unknown'}`;
  await recordTargetedMicroTrainingLifecycleEvent({
    eventName: 'targeted_trigger_evaluated',
    studentId: input.studentId,
    learningSessionId: input.learningSessionId,
    sourceLearningRoundId: input.learningRoundId,
    sourceAttemptId: input.sourceAttemptId,
    decisionId: scheduled.decision.decisionId,
    sourceResourceVersionId: input.sourceVersion.resourceVersionId,
    abilityId: input.sourceVersion.abilityMetadata.abilityId,
    gapReasonCode: scheduled.decision.gapReasonCode,
    responseFormat: input.sourceVersion.responseFormat,
    taskRole: input.sourceVersion.abilityMetadata.taskRole,
    outcome: evaluatedOutcome,
    occurredAt: input.now,
  });
  if (scheduled.status === 'no_match') {
    await recordTargetedMicroTrainingLifecycleEvent({
      eventName: 'targeted_no_match',
      studentId: input.studentId,
      learningSessionId: input.learningSessionId,
      sourceLearningRoundId: input.learningRoundId,
      sourceAttemptId: input.sourceAttemptId,
      decisionId: scheduled.decision.decisionId,
      sourceResourceVersionId: input.sourceVersion.resourceVersionId,
      abilityId: input.sourceVersion.abilityMetadata.abilityId,
      gapReasonCode: scheduled.decision.gapReasonCode,
      outcome: scheduled.match?.status === 'no_match' ? scheduled.match.reasonCode : 'no_match',
      occurredAt: input.now,
    });
  }
  if (scheduled.assignment && scheduled.request) {
    const targetedVersion = versions.find(
      (version) => version.resourceVersionId === scheduled.assignment?.resourceVersionId,
    );
    await recordTargetedMicroTrainingLifecycleEvent({
      eventName: 'targeted_assignment_created',
      studentId: input.studentId,
      learningSessionId: input.learningSessionId,
      sourceLearningRoundId: input.learningRoundId,
      sourceAttemptId: input.sourceAttemptId,
      decisionId: scheduled.decision.decisionId,
      requestId: scheduled.request.requestId,
      assignmentId: scheduled.assignment.assignmentId,
      sourceResourceVersionId: input.sourceVersion.resourceVersionId,
      targetedResourceVersionId: scheduled.assignment.resourceVersionId,
      abilityId: targetedVersion?.abilityMetadata.abilityId,
      gapReasonCode: targetedVersion?.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode,
      responseFormat: targetedVersion?.responseFormat,
      taskRole: targetedVersion?.abilityMetadata.taskRole,
      outcome: 'created',
      occurredAt: input.now,
    });
  }
  if (!scheduled.assignment || !['pending', 'in_progress'].includes(scheduled.assignment.status)) return null;
  return attachTargetedAssignmentToLearningSession({
    studentId: input.studentId,
    assignmentId: scheduled.assignment.assignmentId,
    schedulingRepository,
    activityRepository,
    now: input.now,
  });
}

function stage4SingleChoiceVerifyRequested(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('stage4choice') === '1';
}

export async function loadTargetedTrainingTransition(
  studentId: string,
): Promise<TargetedMicroTrainingLearningTransition | null> {
  const stage4Enabled = await getTargetedMicroTrainingStage4Service()
    .canSchedule(studentId, stage4IsolatedVerifyRequested());
  if (!isTargetedMicroTrainingSchedulingEnabled() && !stage4Enabled) return null;
  return recoverTargetedMicroTrainingTransition({ studentId, schedulingRepository, activityRepository });
}

export async function startTargetedTraining(
  studentId: string,
  assignmentId: string,
): Promise<TargetedMicroTrainingLearningTransition> {
  const transition = await beginTargetedMicroTraining({
    studentId, assignmentId, schedulingRepository, activityRepository,
    now: new Date().toISOString(),
  });
  await recordAssignmentEvent('targeted_assignment_presented', studentId, assignmentId, 'in_progress');
  return transition;
}

export async function skipTargetedTraining(
  studentId: string,
  assignmentId: string,
): Promise<{ returnToCoreTaskNumber: number; sessionComplete: boolean }> {
  const result = await settleTargetedMicroTraining({
    studentId, assignmentId, status: 'skipped', schedulingRepository, activityRepository,
    now: new Date().toISOString(),
  });
  await recordAssignmentEvent('targeted_assignment_skipped', studentId, assignmentId, 'skipped');
  await recordCoreReturn(studentId, assignmentId, result.sessionComplete);
  return result;
}

export async function completeTargetedTraining(
  studentId: string,
  assignmentId: string,
): Promise<{ returnToCoreTaskNumber: number; sessionComplete: boolean }> {
  const result = await settleTargetedMicroTraining({
    studentId, assignmentId, status: 'completed', schedulingRepository, activityRepository,
    now: new Date().toISOString(),
  });
  await recordAssignmentEvent('targeted_assignment_completed', studentId, assignmentId, 'completed');
  await recordCoreReturn(studentId, assignmentId, result.sessionComplete);
  return result;
}

export async function markTargetedTrainingUnavailable(
  studentId: string,
  assignmentId: string,
): Promise<{ returnToCoreTaskNumber: number; sessionComplete: boolean }> {
  const result = await settleTargetedMicroTraining({
    studentId, assignmentId, status: 'unavailable', schedulingRepository, activityRepository,
    now: new Date().toISOString(),
  });
  await recordAssignmentEvent('targeted_assignment_unavailable', studentId, assignmentId, 'unavailable');
  await recordCoreReturn(studentId, assignmentId, result.sessionComplete);
  return result;
}

export async function getTargetedTrainingResourceVersion(
  assignmentId: string,
): Promise<FrozenQuestionResourceVersion | null> {
  const snapshot = await schedulingRepository.load();
  const assignment = snapshot.assignments.find((item) => item.assignmentId === assignmentId);
  return assignment ? formalResourceRepository.getVersion(assignment.resourceVersionId) : null;
}

export function targetedTrainingRuntimeEventName(
  status: 'created' | 'presented' | 'completed' | 'skipped' | 'unavailable',
): TargetedMicroTrainingRuntimeEventName {
  return ({
    created: 'targeted_assignment_created', presented: 'targeted_assignment_presented',
    completed: 'targeted_assignment_completed', skipped: 'targeted_assignment_skipped',
    unavailable: 'targeted_assignment_unavailable',
  } as const)[status];
}

async function recordAssignmentEvent(
  eventName: 'targeted_assignment_presented'
    | 'targeted_assignment_completed'
    | 'targeted_assignment_skipped'
    | 'targeted_assignment_unavailable',
  studentId: string,
  assignmentId: string,
  outcome: string,
): Promise<void> {
  const snapshot = await schedulingRepository.load();
  const assignment = snapshot.assignments.find((item) => item.assignmentId === assignmentId);
  const request = assignment && snapshot.requests.find((item) => item.requestId === assignment.requestId);
  const decision = request && snapshot.decisions.find(
    (item) => item.sourceAttemptId === request.sourceAttemptId,
  );
  if (!assignment || !request || !decision) return;
  const version = await formalResourceRepository.getVersion(assignment.resourceVersionId);
  await recordTargetedMicroTrainingLifecycleEvent({
    eventName,
    studentId,
    learningSessionId: request.learningSessionId,
    sourceLearningRoundId: request.sourceLearningRoundId,
    sourceAttemptId: request.sourceAttemptId,
    decisionId: decision.decisionId,
    requestId: request.requestId,
    assignmentId,
    sourceResourceVersionId: decision.sourceResourceVersionId,
    targetedResourceVersionId: assignment.resourceVersionId,
    abilityId: version?.abilityMetadata.abilityId,
    gapReasonCode: version?.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode,
    responseFormat: version?.responseFormat,
    taskRole: version?.abilityMetadata.taskRole,
    outcome,
  });
}

async function recordCoreReturn(
  studentId: string,
  assignmentId: string,
  sessionComplete: boolean,
): Promise<void> {
  const snapshot = await schedulingRepository.load();
  const assignment = snapshot.assignments.find((item) => item.assignmentId === assignmentId);
  const request = assignment && snapshot.requests.find((item) => item.requestId === assignment.requestId);
  const decision = request && snapshot.decisions.find(
    (item) => item.sourceAttemptId === request.sourceAttemptId,
  );
  if (!assignment || !request || !decision) return;
  const version = await formalResourceRepository.getVersion(assignment.resourceVersionId);
  await recordTargetedMicroTrainingLifecycleEvent({
    eventName: 'targeted_core_queue_resumed',
    studentId,
    learningSessionId: request.learningSessionId,
    sourceLearningRoundId: request.sourceLearningRoundId,
    sourceAttemptId: request.sourceAttemptId,
    decisionId: decision.decisionId,
    requestId: request.requestId,
    assignmentId,
    sourceResourceVersionId: decision.sourceResourceVersionId,
    targetedResourceVersionId: assignment.resourceVersionId,
    abilityId: version?.abilityMetadata.abilityId,
    gapReasonCode: version?.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode,
    responseFormat: version?.responseFormat,
    taskRole: version?.abilityMetadata.taskRole,
    outcome: sessionComplete ? 'session_completed' : 'resumed',
  });
}

function stage4IsolatedVerifyRequested(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('stage4verify') === '1';
}
