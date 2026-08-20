import {
  createBrowserMaterialObservationRepository,
  createBrowserQuestionResourceAdmissionRepository,
} from
  '../ai/repositories/formalResourceRepositoryRouter.ts';
import { IndexedDBTargetedMicroTrainingSchedulingRepository } from
  '../ai/repositories/indexedDBTargetedMicroTrainingSchedulingRepository.ts';
import { IndexedDBTargetedMicroTrainingStage4Repository } from
  '../ai/repositories/indexedDBTargetedMicroTrainingStage4Repository.ts';
import {
  TARGETED_MICRO_TRAINING_STAGE4_PACK_VERSION,
  TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
  buildTargetedMicroTrainingStage4Id,
  type TargetedMicroTrainingEnablementMode,
  type TargetedMicroTrainingStage4EventName,
  type TargetedMicroTrainingStage4RuntimeEvent,
} from '../ai/schemas/targetedMicroTrainingStage4.schema.ts';
import type { TargetedGapReasonCode } from '../ai/schemas/targetedMicroTraining.schema.ts';
import {
  auditTargetedMicroTrainingControlledPack,
  buildTargetedMicroTrainingControlledPack,
  importTargetedMicroTrainingControlledPack,
  pauseTargetedMicroTrainingControlledPack,
  rollbackTargetedMicroTrainingControlledPack,
  type TargetedMicroTrainingControlledPackBundle,
} from '../ai/services/targetedMicroTrainingControlledPackService.ts';
import { TargetedMicroTrainingStage4Service } from
  '../ai/services/targetedMicroTrainingStage4Service.ts';

const stage4Repository = new IndexedDBTargetedMicroTrainingStage4Repository();
const stage4Service = new TargetedMicroTrainingStage4Service(stage4Repository);
const formalRepository = createBrowserQuestionResourceAdmissionRepository();
const observationRepository = createBrowserMaterialObservationRepository();
const schedulingRepository = new IndexedDBTargetedMicroTrainingSchedulingRepository();
let controlledBundle: TargetedMicroTrainingControlledPackBundle | undefined;

export function getTargetedMicroTrainingStage4Service(): TargetedMicroTrainingStage4Service {
  return stage4Service;
}

export async function prepareTargetedMicroTrainingControlledPack(
  actorId = 'product-owner',
) {
  controlledBundle = await ensureBundle();
  const manifest = await stage4Service.prepareManifest(
    controlledBundle.manifest,
    actorId,
    'prepare_controlled_pack',
  );
  return { manifest, counts: bundleCounts(controlledBundle) };
}

export async function importTargetedMicroTrainingPack(actorId = 'product-owner') {
  const bundle = await ensureBundle();
  const result = await importTargetedMicroTrainingControlledPack({
    bundle,
    formalRepository,
    observationRepository,
    governance: stage4Service,
    actorId,
    reason: 'import_controlled_pack',
  });
  return { ...result, manifest: (await stage4Repository.load()).manifests.find(
    (item) => item.packId === bundle.manifest.packId,
  ) };
}

export async function setTargetedMicroTrainingStage4Mode(input: {
  mode: TargetedMicroTrainingEnablementMode;
  actorId?: string;
  reason?: string;
  controlledStudentId?: string;
}) {
  const bundle = ['isolated_verify', 'controlled_single_learner'].includes(input.mode)
    ? await ensureBundle()
    : undefined;
  return stage4Service.setEnablement({
    mode: input.mode,
    actorId: input.actorId || 'product-owner',
    reason: input.reason || `set_${input.mode}`,
    packId: bundle?.manifest.packId,
    controlledStudentId: input.controlledStudentId,
  });
}

export async function pauseTargetedMicroTrainingStage4(
  actorId = 'product-owner',
  reason = 'manual_pause',
) {
  const bundle = await ensureBundle();
  await pauseTargetedMicroTrainingControlledPack({
    packId: bundle.manifest.packId,
    governance: stage4Service,
    actorId,
    reason,
  });
  return stage4Repository.load();
}

export async function rollbackTargetedMicroTrainingStage4(
  actorId = 'product-owner',
  reason = 'manual_rollback',
) {
  const bundle = await ensureBundle();
  await rollbackTargetedMicroTrainingControlledPack({
    bundle,
    formalRepository,
    governance: stage4Service,
    schedulingRepository,
    actorId,
    reason,
  });
  return stage4Repository.load();
}

export async function loadTargetedMicroTrainingStage4ControlView() {
  const bundle = await ensureBundle();
  const [snapshot, projection, packAudit] = await Promise.all([
    stage4Repository.load(),
    stage4Service.project(),
    auditTargetedMicroTrainingControlledPack({ bundle, formalRepository, observationRepository }),
  ]);
  return {
    snapshot,
    projection,
    packAudit,
    activeManifest: snapshot.enablement.packId
      ? snapshot.manifests.find((item) => item.packId === snapshot.enablement.packId)
      : snapshot.manifests.at(-1),
  };
}

export async function exportTargetedMicroTrainingStage4CalibrationSnapshot() {
  const { snapshot, projection, packAudit } = await loadTargetedMicroTrainingStage4ControlView();
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: snapshot.schemaVersion,
    revision: snapshot.revision,
    enablement: {
      mode: snapshot.enablement.mode,
      policyVersion: snapshot.enablement.policyVersion,
      packId: snapshot.enablement.packId,
      packVersion: snapshot.enablement.packVersion,
      changedAt: snapshot.enablement.changedAt,
    },
    manifests: snapshot.manifests,
    projection,
    packAudit,
    events: snapshot.events.map((event) => ({
      eventId: event.eventId,
      eventName: event.eventName,
      learningSessionId: pseudonym(event.learningSessionId),
      sourceLearningRoundId: event.sourceLearningRoundId,
      sourceAttemptId: event.sourceAttemptId,
      decisionId: event.decisionId,
      requestId: event.requestId,
      assignmentId: event.assignmentId,
      targetedAttemptId: event.targetedAttemptId,
      sourceResourceVersionId: event.sourceResourceVersionId,
      targetedResourceVersionId: event.targetedResourceVersionId,
      abilityId: event.abilityId,
      gapReasonCode: event.gapReasonCode,
      responseFormat: event.responseFormat,
      taskRole: event.taskRole,
      policyVersion: event.policyVersion,
      packId: event.packId,
      packVersion: event.packVersion,
      outcome: event.outcome,
      occurredAt: event.occurredAt,
    })),
    followUps: snapshot.followUps,
    decisions: snapshot.decisions,
    excludedFields: ['studentId', 'answer', 'responseText', 'materialContent'],
  };
}

export async function recordTargetedMicroTrainingLifecycleEvent(input: {
  eventName: TargetedMicroTrainingStage4EventName;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId?: string;
  sourceAttemptId?: string;
  decisionId?: string;
  requestId?: string;
  assignmentId?: string;
  targetedAttemptId?: string;
  sourceResourceVersionId?: string;
  targetedResourceVersionId?: string;
  abilityId?: string;
  gapReasonCode?: TargetedGapReasonCode;
  responseFormat?: string;
  taskRole?: string;
  outcome?: string;
  occurredAt?: string;
}): Promise<'recorded' | 'queued' | 'ignored'> {
  const state = (await stage4Repository.load()).enablement;
  if (!state.packId || !state.packVersion || ['disabled', 'paused'].includes(state.mode)) return 'ignored';
  const occurredAt = input.occurredAt || new Date().toISOString();
  const event: TargetedMicroTrainingStage4RuntimeEvent = {
    ...input,
    eventId: buildTargetedMicroTrainingStage4Id('targeted-runtime-event', [
      input.eventName,
      input.learningSessionId,
      input.sourceAttemptId || input.decisionId || input.sourceLearningRoundId,
      input.assignmentId,
    ]),
    policyVersion: TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
    packId: state.packId,
    packVersion: state.packVersion,
    occurredAt,
  };
  return stage4Service.recordEventNonBlocking(event);
}

export async function retryTargetedMicroTrainingStage4Outbox() {
  return stage4Service.retryOutbox();
}

export async function clearTargetedMicroTrainingStage4DebugState(): Promise<void> {
  await Promise.all([stage4Repository.clear(), schedulingRepository.clear()]);
  controlledBundle = undefined;
}

async function ensureBundle(): Promise<TargetedMicroTrainingControlledPackBundle> {
  if (controlledBundle) return controlledBundle;
  const [registryEntries, stage4Snapshot] = await Promise.all([
    formalRepository.listRegistryEntries(),
    stage4Repository.load(),
  ]);
  const existing = stage4Snapshot.manifests.find(
    (item) => item.packVersion === TARGETED_MICRO_TRAINING_STAGE4_PACK_VERSION,
  );
  controlledBundle = await buildTargetedMicroTrainingControlledPack({
    sourceSnapshotRevision: existing?.sourceSnapshotRevision ?? registryEntries.length,
    reviewedAt: existing?.reviewedAt,
  });
  return controlledBundle;
}

function bundleCounts(bundle: TargetedMicroTrainingControlledPackBundle) {
  return {
    materials: bundle.materials.length,
    resources: bundle.versions.length,
    registryEntries: bundle.registryEntries.length,
  };
}

function pseudonym(value: string): string {
  return buildTargetedMicroTrainingStage4Id('session', [value]).slice(0, 24);
}
