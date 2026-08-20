import type { TargetedMicroTrainingStage4Repository } from
  '../repositories/targetedMicroTrainingStage4Repository.ts';
import {
  TARGETED_MICRO_TRAINING_STAGE4_EVENT_NAMES,
  TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
  buildTargetedMicroTrainingManifestHash,
  buildTargetedMicroTrainingStage4Id,
  isTargetedMicroTrainingControlledPackManifest,
  isTargetedMicroTrainingEnablementState,
  isTargetedMicroTrainingStage4RuntimeEvent,
  type TargetedMicroTrainingCalibrationDecision,
  type TargetedMicroTrainingControlledPackManifest,
  type TargetedMicroTrainingEnablementMode,
  type TargetedMicroTrainingFollowUpObservation,
  type TargetedMicroTrainingMetric,
  type TargetedMicroTrainingPackAuditRecord,
  type TargetedMicroTrainingStage4IntegrityIssue,
  type TargetedMicroTrainingStage4Projection,
  type TargetedMicroTrainingStage4RuntimeEvent,
  type TargetedMicroTrainingStage4Snapshot,
} from '../schemas/targetedMicroTrainingStage4.schema.ts';
import type { TargetedGapReasonCode } from '../schemas/targetedMicroTraining.schema.ts';

export class TargetedMicroTrainingStage4Service {
  private readonly repository: TargetedMicroTrainingStage4Repository;
  private readonly now: () => string;

  constructor(
    repository: TargetedMicroTrainingStage4Repository,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.now = now;
  }

  async prepareManifest(
    manifest: TargetedMicroTrainingControlledPackManifest,
    actorId: string,
    reason: string,
  ): Promise<TargetedMicroTrainingControlledPackManifest> {
    assertManifest(manifest);
    const expectedHash = buildTargetedMicroTrainingManifestHash(manifest);
    if (manifest.manifestHash !== expectedHash) {
      throw new Error('Targeted controlled pack Manifest hash does not match its contents.');
    }
    const snapshot = await this.mutate((current) => {
      const existing = current.manifests.find((item) => item.packId === manifest.packId);
      if (existing && (
        existing.packVersion !== manifest.packVersion
        || existing.manifestHash !== manifest.manifestHash
      )) throw new Error(`Targeted controlled pack identity conflict: ${manifest.packId}`);
      if (existing) return current;
      const occurredAt = this.now();
      return {
        ...current,
        manifests: [...current.manifests, clone(manifest)],
        audits: appendAudit(current.audits, audit({
          action: 'prepared', packId: manifest.packId, packVersion: manifest.packVersion,
          actorId, reason, occurredAt,
        })),
        updatedAt: occurredAt,
      };
    });
    return clone(snapshot.manifests.find((item) => item.packId === manifest.packId)!);
  }

  async markManifestImported(
    packId: string,
    actorId: string,
    reason: string,
  ): Promise<TargetedMicroTrainingControlledPackManifest> {
    return this.transitionManifest(packId, 'imported', actorId, reason);
  }

  async markManifestPaused(
    packId: string,
    actorId: string,
    reason: string,
  ): Promise<TargetedMicroTrainingControlledPackManifest> {
    return this.transitionManifest(packId, 'paused', actorId, reason);
  }

  async markManifestRolledBack(
    packId: string,
    actorId: string,
    reason: string,
  ): Promise<TargetedMicroTrainingControlledPackManifest> {
    return this.transitionManifest(packId, 'rolled_back', actorId, reason);
  }

  async setEnablement(input: {
    mode: TargetedMicroTrainingEnablementMode;
    actorId: string;
    reason: string;
    packId?: string;
    controlledStudentId?: string;
  }): Promise<TargetedMicroTrainingStage4Snapshot['enablement']> {
    const snapshot = await this.mutate((current) => {
      const manifest = input.packId
        ? current.manifests.find((item) => item.packId === input.packId)
        : undefined;
      if (['isolated_verify', 'controlled_single_learner'].includes(input.mode)) {
        if (!manifest || manifest.status !== 'imported') {
          throw new Error('An imported controlled pack is required before enabling targeted training.');
        }
      }
      if (input.mode === 'controlled_single_learner' && !nonEmpty(input.controlledStudentId)) {
        throw new Error('Controlled single-learner mode requires a fixed student identity.');
      }
      const occurredAt = this.now();
      const next = {
        mode: input.mode,
        policyVersion: TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
        ...(manifest ? { packId: manifest.packId, packVersion: manifest.packVersion } : {}),
        ...(input.mode === 'controlled_single_learner'
          ? { controlledStudentId: input.controlledStudentId }
          : {}),
        changedBy: input.actorId,
        reason: input.reason,
        changedAt: occurredAt,
      } as TargetedMicroTrainingStage4Snapshot['enablement'];
      if (!isTargetedMicroTrainingEnablementState(next)) {
        throw new Error('Targeted micro-training enablement transition is invalid.');
      }
      if (stableStringify(current.enablement) === stableStringify(next)) return current;
      return {
        ...current,
        enablement: next,
        audits: appendAudit(current.audits, audit({
          action: 'enablement_changed',
          packId: manifest?.packId,
          packVersion: manifest?.packVersion,
          previousMode: current.enablement.mode,
          nextMode: input.mode,
          actorId: input.actorId,
          reason: input.reason,
          occurredAt,
        })),
        updatedAt: occurredAt,
      };
    });
    return clone(snapshot.enablement);
  }

  async canSchedule(studentId: string, isolatedVerify = false): Promise<boolean> {
    const state = (await this.repository.load()).enablement;
    if (state.mode === 'isolated_verify') return isolatedVerify;
    return state.mode === 'controlled_single_learner'
      && state.controlledStudentId === studentId;
  }

  async recordEvent(
    event: TargetedMicroTrainingStage4RuntimeEvent,
  ): Promise<'created' | 'unchanged' | 'conflict'> {
    if (!isTargetedMicroTrainingStage4RuntimeEvent(event)) {
      throw new Error('Targeted Stage 4 runtime event is invalid or contains disallowed payload text.');
    }
    let outcome: 'created' | 'unchanged' | 'conflict' = 'created';
    await this.mutate((current) => {
      const existing = current.events.find((item) => item.eventId === event.eventId);
      if (existing) {
        outcome = stableStringify(existing) === stableStringify(event) ? 'unchanged' : 'conflict';
        if (outcome === 'conflict') throw new Error(`Runtime Event identity conflict: ${event.eventId}`);
        return current;
      }
      const occurredAt = this.now();
      const events = [...current.events, clone(event)];
      return {
        ...current,
        events,
        episodes: projectEpisodes(events),
        updatedAt: occurredAt,
      };
    });
    return outcome;
  }

  async recordEventNonBlocking(
    event: TargetedMicroTrainingStage4RuntimeEvent,
    eventWriter: (event: TargetedMicroTrainingStage4RuntimeEvent) => Promise<void> = async (value) => {
      await this.recordEvent(value);
    },
  ): Promise<'recorded' | 'queued'> {
    try {
      await eventWriter(event);
      return 'recorded';
    } catch (error) {
      await this.queueEvent(event, error);
      return 'queued';
    }
  }

  async queueEvent(event: TargetedMicroTrainingStage4RuntimeEvent, error: unknown): Promise<void> {
    if (!isTargetedMicroTrainingStage4RuntimeEvent(event)) return;
    await this.mutate((current) => {
      const outboxId = buildTargetedMicroTrainingStage4Id('targeted-outbox', [event.eventId]);
      const existing = current.outbox.find((item) => item.outboxId === outboxId);
      if (existing && existing.eventId !== event.eventId) {
        throw new Error(`Targeted Outbox identity conflict: ${outboxId}`);
      }
      const now = this.now();
      if (existing) return current;
      return {
        ...current,
        outbox: [...current.outbox, {
          outboxId,
          eventId: event.eventId,
          event: clone(event),
          status: 'pending',
          retryCount: 0,
          lastError: errorText(error),
          nextRetryAt: now,
          createdAt: now,
          updatedAt: now,
        }],
        updatedAt: now,
      };
    });
  }

  async retryOutbox(limit = 50): Promise<{
    processed: number; succeeded: number; failed: number;
  }> {
    const current = await this.repository.load();
    const due = current.outbox
      .filter((item) => item.status !== 'failed' && item.nextRetryAt <= this.now())
      .slice(0, limit);
    let succeeded = 0;
    let failed = 0;
    for (const entry of due) {
      try {
        await this.recordEvent(entry.event);
        await this.mutate((snapshot) => ({
          ...snapshot,
          outbox: snapshot.outbox.filter((item) => item.outboxId !== entry.outboxId),
          updatedAt: this.now(),
        }));
        succeeded += 1;
      } catch (error) {
        await this.mutate((snapshot) => ({
          ...snapshot,
          outbox: snapshot.outbox.map((item) => item.outboxId === entry.outboxId
            ? {
                ...item,
                status: item.retryCount + 1 >= 5 ? 'failed' as const : 'pending' as const,
                retryCount: item.retryCount + 1,
                lastError: errorText(error),
                nextRetryAt: this.now(),
                updatedAt: this.now(),
              }
            : item),
          updatedAt: this.now(),
        }));
        failed += 1;
      }
    }
    return { processed: due.length, succeeded, failed };
  }

  async saveFollowUp(
    observation: TargetedMicroTrainingFollowUpObservation,
  ): Promise<TargetedMicroTrainingFollowUpObservation> {
    assertFollowUp(observation);
    const snapshot = await this.mutate((current) => {
      const existing = current.followUps.find((item) => item.observationId === observation.observationId);
      if (existing && stableStringify(existing) !== stableStringify(observation)) {
        throw new Error(`Follow-up identity conflict: ${observation.observationId}`);
      }
      if (existing) return current;
      return {
        ...current,
        followUps: [...current.followUps, clone(observation)],
        updatedAt: this.now(),
      };
    });
    return clone(snapshot.followUps.find((item) => item.observationId === observation.observationId)!);
  }

  async saveCalibrationDecision(
    decision: TargetedMicroTrainingCalibrationDecision,
  ): Promise<TargetedMicroTrainingCalibrationDecision> {
    const snapshot = await this.mutate((current) => {
      const existing = current.decisions.find((item) => item.decisionId === decision.decisionId);
      if (existing && stableStringify(existing) !== stableStringify(decision)) {
        throw new Error(`Calibration Decision identity conflict: ${decision.decisionId}`);
      }
      if (existing) return current;
      return {
        ...current,
        decisions: [...current.decisions, clone(decision)],
        updatedAt: this.now(),
      };
    });
    return clone(snapshot.decisions.find((item) => item.decisionId === decision.decisionId)!);
  }

  async project(): Promise<TargetedMicroTrainingStage4Projection> {
    return projectTargetedMicroTrainingStage4(await this.repository.load(), this.now());
  }

  private async transitionManifest(
    packId: string,
    status: TargetedMicroTrainingControlledPackManifest['status'],
    actorId: string,
    reason: string,
  ): Promise<TargetedMicroTrainingControlledPackManifest> {
    const snapshot = await this.mutate((current) => {
      const manifest = current.manifests.find((item) => item.packId === packId);
      if (!manifest) throw new Error(`Targeted controlled pack not found: ${packId}`);
      if (manifest.status === status) return current;
      if (!validManifestTransition(manifest.status, status)) {
        throw new Error(`Invalid controlled pack transition: ${manifest.status} -> ${status}`);
      }
      const occurredAt = this.now();
      const updated: TargetedMicroTrainingControlledPackManifest = {
        ...manifest,
        status,
        ...(status === 'imported' ? { importedAt: manifest.importedAt || occurredAt } : {}),
        ...(status === 'rolled_back' ? { rolledBackAt: occurredAt } : {}),
      };
      const action = status === 'imported' ? 'imported'
        : status === 'paused' ? 'paused' : 'rolled_back';
      return {
        ...current,
        manifests: current.manifests.map((item) => item.packId === packId ? updated : item),
        audits: appendAudit(current.audits, audit({
          action, packId: manifest.packId, packVersion: manifest.packVersion,
          actorId, reason, occurredAt,
        })),
        updatedAt: occurredAt,
      };
    });
    return clone(snapshot.manifests.find((item) => item.packId === packId)!);
  }

  private async mutate(
    mutate: (snapshot: TargetedMicroTrainingStage4Snapshot) => TargetedMicroTrainingStage4Snapshot,
  ): Promise<TargetedMicroTrainingStage4Snapshot> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await this.repository.load();
      const next = mutate(clone(current));
      const result = await this.repository.save(next, current.revision);
      if (result.status !== 'conflict') return result.snapshot;
    }
    throw new Error('Targeted Stage 4 state changed concurrently.');
  }
}

export function projectTargetedMicroTrainingStage4(
  snapshot: TargetedMicroTrainingStage4Snapshot,
  generatedAt: string,
): TargetedMicroTrainingStage4Projection {
  const events = snapshot.events;
  const evaluated = events.filter((event) => event.eventName === 'targeted_trigger_evaluated');
  const eligible = evaluated.filter((event) => event.outcome?.startsWith('eligible'));
  const created = events.filter((event) => event.eventName === 'targeted_assignment_created');
  const presented = events.filter((event) => event.eventName === 'targeted_assignment_presented');
  const completed = events.filter((event) => event.eventName === 'targeted_assignment_completed');
  const skipped = events.filter((event) => event.eventName === 'targeted_assignment_skipped');
  const unavailable = events.filter((event) => event.eventName === 'targeted_assignment_unavailable');
  const returned = events.filter((event) => event.eventName === 'targeted_core_queue_resumed');
  const resolved = completed.filter((event) => event.outcome === 'resolved');
  const qualifiedFollowUps = snapshot.followUps.filter((item) => item.independence === 'qualified');
  const judgedFollowUps = qualifiedFollowUps.filter((item) => item.result !== 'insufficient_to_judge');
  const recurred = judgedFollowUps.filter((item) => item.result === 'gap_recurred');
  const completedEpisodes = snapshot.episodes.filter((item) => item.assignmentOutcome === 'completed');
  const exited = snapshot.episodes.filter((item) => (
    item.assignmentId
    && presented.some((event) => event.assignmentId === item.assignmentId)
    && !item.coreReturnOutcome
  ));
  const issues = auditIntegrity(snapshot);
  const integrityStatus = snapshot.events.length === 0
    ? 'awaiting_data'
    : issues.some((item) => item.severity === 'fail')
      ? 'fail'
      : issues.length > 0 ? 'warning' : 'pass';
  return {
    generatedAt,
    mode: snapshot.enablement.mode,
    packId: snapshot.enablement.packId,
    packVersion: snapshot.enablement.packVersion,
    metrics: {
      triggerRate: metric(eligible.length, evaluated.length),
      matchRate: metric(created.length, eligible.length),
      startRate: metric(presented.length, created.length),
      completionRate: metric(completed.length, presented.length),
      skipRate: metric(skipped.length, created.length),
      unavailableRate: metric(unavailable.length, created.length),
      coreReturnRate: metric(returned.length, completed.length + skipped.length + unavailable.length),
      immediateResolutionRate: metric(resolved.length, completed.length),
      followUpCoverageRate: metric(
        new Set(qualifiedFollowUps.map((item) => item.episodeId)).size,
        completedEpisodes.length,
      ),
      sameGapRecurrenceRate: metric(recurred.length, judgedFollowUps.length),
      sessionExitRate: metric(exited.length, presented.length),
    },
    totals: {
      events: events.length,
      episodes: snapshot.episodes.length,
      followUps: snapshot.followUps.length,
      qualifiedFollowUps: qualifiedFollowUps.length,
      outboxPending: snapshot.outbox.filter((item) => item.status !== 'failed').length,
      outboxFailed: snapshot.outbox.filter((item) => item.status === 'failed').length,
    },
    integrityStatus,
    issues,
    breakdowns: buildBreakdowns(snapshot),
  };
}

export function buildTargetedMicroTrainingFollowUp(input: {
  episodeId: string;
  followUpAttemptId: string;
  sourceResourceVersionId: string;
  targetedResourceVersionId?: string;
  followUpResourceVersionId: string;
  followUpRole: 'core_training' | 'retest' | 'transfer';
  abilityId: string;
  gapReasonCode: TargetedGapReasonCode;
  sourceAbilityId?: string;
  sourceGapReasonCode?: TargetedGapReasonCode;
  sameAnchor?: boolean;
  reusedAnswerOrHint?: boolean;
  responseValid: boolean;
  formalDiagnosisPersisted: boolean;
  gapObserved?: boolean;
  observedAt: string;
}): TargetedMicroTrainingFollowUpObservation {
  let independence: TargetedMicroTrainingFollowUpObservation['independence'] = 'qualified';
  let result: TargetedMicroTrainingFollowUpObservation['result'] = input.gapObserved
    ? 'gap_recurred' : 'gap_not_observed';
  if (!input.responseValid || !input.formalDiagnosisPersisted
    || input.sourceAbilityId !== input.abilityId
    || input.sourceGapReasonCode !== input.gapReasonCode) {
    independence = 'insufficient_to_judge';
    result = 'insufficient_to_judge';
  } else if (
    input.followUpResourceVersionId === input.sourceResourceVersionId
    || input.followUpResourceVersionId === input.targetedResourceVersionId
    || input.sameAnchor
    || input.reusedAnswerOrHint
  ) {
    independence = 'not_independent';
    result = 'insufficient_to_judge';
  }
  return {
    observationId: buildTargetedMicroTrainingStage4Id('targeted-follow-up', [
      input.episodeId, input.followUpAttemptId, input.followUpResourceVersionId,
    ]),
    episodeId: input.episodeId,
    followUpAttemptId: input.followUpAttemptId,
    followUpResourceVersionId: input.followUpResourceVersionId,
    followUpRole: input.followUpRole,
    abilityId: input.abilityId,
    gapReasonCode: input.gapReasonCode,
    independence,
    result,
    observedAt: input.observedAt,
  };
}

export function buildTargetedMicroTrainingCalibrationDecision(input: {
  projection: TargetedMicroTrainingStage4Projection;
  policyVersion: string;
  packVersion: string;
  observationWindow: { startedAt: string; endedAt: string };
  sessionCount: number;
  decidedAt: string;
}): TargetedMicroTrainingCalibrationDecision {
  const runtimeEnough = input.projection.metrics.startRate.denominator >= 5
    && input.sessionCount >= 3;
  const educationEnough = input.projection.totals.episodes >= 8
    && input.projection.totals.qualifiedFollowUps >= 6;
  const runtimeSafety = input.projection.integrityStatus === 'fail'
    ? 'fail'
    : runtimeEnough ? 'pass' : 'insufficient_data';
  const recurrence = input.projection.metrics.sameGapRecurrenceRate;
  const educationalSignal = !educationEnough || recurrence.status !== 'available'
    ? 'insufficient_data'
    : recurrence.rate! <= 0.35 ? 'favorable'
      : recurrence.rate! >= 0.7 ? 'adverse' : 'neutral';
  const decision = runtimeSafety === 'fail' || educationalSignal === 'adverse'
    ? 'pause'
    : runtimeSafety === 'insufficient_data' || educationalSignal === 'insufficient_data'
      ? 'continue_controlled'
      : educationalSignal === 'favorable' ? 'continue_controlled' : 'adjust_resources';
  const reasons = [
    `runtime:${runtimeSafety}`,
    `educational:${educationalSignal}`,
    `presented:${input.projection.metrics.startRate.denominator}`,
    `qualified_follow_ups:${input.projection.totals.qualifiedFollowUps}`,
  ];
  return {
    decisionId: buildTargetedMicroTrainingStage4Id('targeted-calibration-decision', [
      input.policyVersion,
      input.packVersion,
      input.observationWindow.startedAt,
      input.observationWindow.endedAt,
    ]),
    policyVersion: input.policyVersion,
    packVersion: input.packVersion,
    observationWindow: input.observationWindow,
    sampleSummary: {
      sessions: input.sessionCount,
      presented: input.projection.metrics.startRate.denominator,
      completed: input.projection.metrics.completionRate.numerator,
      qualifiedFollowUps: input.projection.totals.qualifiedFollowUps,
    },
    runtimeSafety,
    educationalSignal,
    decision,
    reasons,
    decidedAt: input.decidedAt,
  };
}

function projectEpisodes(events: TargetedMicroTrainingStage4RuntimeEvent[]) {
  const byKey = new Map<string, TargetedMicroTrainingStage4RuntimeEvent[]>();
  events.forEach((event) => {
    const key = event.sourceAttemptId || event.decisionId || event.assignmentId;
    if (!key) return;
    byKey.set(key, [...(byKey.get(key) || []), event]);
  });
  return [...byKey.entries()].flatMap(([key, values]) => {
    const evaluated = values.find((event) => event.eventName === 'targeted_trigger_evaluated');
    if (!evaluated?.decisionId || !evaluated.sourceAttemptId || !evaluated.sourceResourceVersionId
      || !evaluated.outcome?.startsWith('eligible')) return [];
    const created = values.find((event) => event.eventName === 'targeted_assignment_created');
    const completed = values.find((event) => event.eventName === 'targeted_assignment_completed');
    const skipped = values.find((event) => event.eventName === 'targeted_assignment_skipped');
    const unavailable = values.find((event) => event.eventName === 'targeted_assignment_unavailable');
    const returned = values.find((event) => event.eventName === 'targeted_core_queue_resumed');
    const closed = completed || skipped || unavailable;
    return [{
      episodeId: buildTargetedMicroTrainingStage4Id('targeted-episode', [
        evaluated.policyVersion, evaluated.packVersion, evaluated.studentId, key,
      ]),
      policyVersion: evaluated.policyVersion,
      packId: evaluated.packId,
      packVersion: evaluated.packVersion,
      studentId: evaluated.studentId,
      learningSessionId: evaluated.learningSessionId,
      sourceLearningRoundId: evaluated.sourceLearningRoundId || 'unknown-round',
      sourceAttemptId: evaluated.sourceAttemptId,
      decisionId: evaluated.decisionId,
      requestId: created?.requestId,
      assignmentId: created?.assignmentId,
      targetedAttemptId: completed?.targetedAttemptId,
      sourceResourceVersionId: evaluated.sourceResourceVersionId,
      targetedResourceVersionId: created?.targetedResourceVersionId,
      abilityId: evaluated.abilityId,
      gapReasonCode: evaluated.gapReasonCode || asGap(evaluated.outcome?.split(':')[1]),
      triggerOutcome: evaluated.outcome || 'unknown',
      assignmentOutcome: completed ? 'completed' as const
        : skipped ? 'skipped' as const : unavailable ? 'unavailable' as const : undefined,
      coreReturnOutcome: returned?.outcome === 'session_completed'
        ? 'session_completed' as const
        : returned ? 'resumed' as const : undefined,
      openedAt: evaluated.occurredAt,
      closedAt: returned?.occurredAt || closed?.occurredAt,
    }];
  });
}

function auditIntegrity(
  snapshot: TargetedMicroTrainingStage4Snapshot,
): TargetedMicroTrainingStage4IntegrityIssue[] {
  const issues: TargetedMicroTrainingStage4IntegrityIssue[] = [];
  snapshot.episodes.forEach((episode) => {
    const events = snapshot.events.filter((event) => (
      event.decisionId === episode.decisionId || event.assignmentId === episode.assignmentId
    ));
    const terminal = events.filter((event) => [
      'targeted_assignment_completed', 'targeted_assignment_skipped', 'targeted_assignment_unavailable',
    ].includes(event.eventName));
    const returns = events.filter((event) => event.eventName === 'targeted_core_queue_resumed');
    const createdEvents = events.filter((event) => event.eventName === 'targeted_assignment_created');
    const presentedEvents = events.filter((event) => event.eventName === 'targeted_assignment_presented');
    if (createdEvents.length > 1) issues.push(issue('episode_multiple_assignment', 'fail', '同一来源表现创建了多个微训练 Assignment。', episode.episodeId));
    if (presentedEvents.length > 1) issues.push(issue('episode_multiple_presented', 'fail', '同一微训练被重复呈现。', episode.episodeId));
    if (terminal.length > 1) issues.push(issue('episode_multiple_terminal', 'fail', '同一微训练出现多个终态。', episode.episodeId));
    if (terminal.length === 1 && returns.length !== 1) issues.push(issue('episode_return_not_closed', 'fail', '微训练终态没有且仅有一个核心返回结果。', episode.episodeId));
    if (episode.sourceAttemptId && episode.sourceAttemptId === episode.targetedAttemptId) {
      issues.push(issue('attempt_identity_reused', 'fail', '核心首次表现与微训练复用了同一 Attempt。', episode.episodeId));
    }
    const createdEvent = createdEvents[0];
    const presented = presentedEvents[0];
    if (createdEvent && presented && (
      createdEvent.assignmentId !== presented.assignmentId
      || createdEvent.targetedResourceVersionId !== presented.targetedResourceVersionId
    )) issues.push(issue('assignment_presented_identity_mismatch', 'fail', '微训练创建与呈现身份不一致。', episode.episodeId));
    terminal.forEach((event) => {
      if (event.targetedAttemptId && event.targetedAttemptId === episode.sourceAttemptId) {
        issues.push(issue('attempt_identity_reused', 'fail', '核心首次表现与微训练复用了同一 Attempt。', episode.episodeId));
      }
      if (createdEvent?.targetedResourceVersionId && event.targetedResourceVersionId
        && createdEvent.targetedResourceVersionId !== event.targetedResourceVersionId) {
        issues.push(issue('assignment_resource_version_mismatch', 'fail', '微训练终态的资源版本与 Assignment 不一致。', episode.episodeId));
      }
      if (event.eventName === 'targeted_assignment_completed' && !presented) {
        issues.push(issue('completed_without_presented', 'fail', '微训练未进入作答态却记录为完成。', episode.episodeId));
      }
      if (event.eventName === 'targeted_assignment_skipped' && presented) {
        issues.push(issue('skipped_after_presented', 'fail', '已开始的微训练不能再按 Pending 跳过。', episode.episodeId));
      }
    });
    const noMatch = events.some((event) => event.eventName === 'targeted_no_match');
    const created = events.some((event) => event.eventName === 'targeted_assignment_created');
    if (noMatch && created) issues.push(issue('no_match_created_assignment', 'fail', '无匹配 Episode 仍创建了 Assignment。', episode.episodeId));
  });
  snapshot.outbox.filter((item) => item.status === 'failed').forEach((entry) => {
    issues.push(issue('outbox_failed', 'warning', '运行事件 Outbox 已达到重试上限。', entry.eventId));
  });
  return issues;
}

function buildBreakdowns(snapshot: TargetedMicroTrainingStage4Snapshot) {
  const dimensions = [
    ['gap', 'gapReasonCode'],
    ['ability', 'abilityId'],
    ['response_format', 'responseFormat'],
    ['task_role', 'taskRole'],
  ] as const;
  return dimensions.flatMap(([dimension, key]) => {
    const values = new Set(snapshot.events.map((event) => event[key]).filter(nonEmpty));
    return [...values].sort().map((value) => {
      const events = snapshot.events.filter((event) => event[key] === value);
      const episodeIds = new Set(snapshot.episodes.filter((episode) => (
        events.some((event) => event.assignmentId === episode.assignmentId)
      )).map((episode) => episode.episodeId));
      const followUps = snapshot.followUps.filter((item) => (
        episodeIds.has(item.episodeId) && item.independence === 'qualified'
      ));
      return {
        dimension,
        value,
        presented: events.filter((event) => event.eventName === 'targeted_assignment_presented').length,
        completed: events.filter((event) => event.eventName === 'targeted_assignment_completed').length,
        qualifiedFollowUps: followUps.length,
        sameGapRecurrences: followUps.filter((item) => item.result === 'gap_recurred').length,
      };
    });
  });
}

function metric(numerator: number, denominator: number): TargetedMicroTrainingMetric {
  return denominator > 0
    ? { numerator, denominator, rate: numerator / denominator, status: 'available' }
    : { numerator, denominator, status: 'insufficient_data' };
}

function issue(code: string, severity: 'warning' | 'fail', message: string, identity?: string) {
  return { code, severity, message, identity };
}

function assertManifest(manifest: TargetedMicroTrainingControlledPackManifest): void {
  if (!isTargetedMicroTrainingControlledPackManifest(manifest)) {
    throw new Error('Targeted controlled pack Manifest is invalid.');
  }
  if (manifest.status !== 'prepared') {
    throw new Error('A new controlled pack Manifest must start as prepared.');
  }
  if (Object.values(manifest.gapCoverage).some((count) => count < 3)) {
    throw new Error('Controlled pack must keep at least three executable resources for each supported Gap.');
  }
}

function assertFollowUp(observation: TargetedMicroTrainingFollowUpObservation): void {
  if (![observation.observationId, observation.episodeId, observation.followUpAttemptId,
    observation.followUpResourceVersionId, observation.abilityId].every(nonEmpty)) {
    throw new Error('Targeted Follow-up identity is incomplete.');
  }
  if (!['core_training', 'retest', 'transfer'].includes(observation.followUpRole)
    || !['qualified', 'not_independent', 'insufficient_to_judge'].includes(observation.independence)
    || !['gap_recurred', 'gap_not_observed', 'insufficient_to_judge'].includes(observation.result)) {
    throw new Error('Targeted Follow-up classification is invalid.');
  }
  if (observation.independence !== 'qualified' && observation.result !== 'insufficient_to_judge') {
    throw new Error('Non-independent Follow-up cannot produce an improvement result.');
  }
}

function validManifestTransition(
  current: TargetedMicroTrainingControlledPackManifest['status'],
  next: TargetedMicroTrainingControlledPackManifest['status'],
): boolean {
  return (current === 'prepared' && next === 'imported')
    || (current === 'imported' && ['paused', 'rolled_back'].includes(next))
    || (current === 'paused' && ['imported', 'rolled_back'].includes(next))
    // 回滚只撤销活动资源，不销毁同一不可变资源包的治理身份。
    // 完整性重新通过后，允许重新导入同一 packId / packVersion，支持重复联调与故障恢复。
    || (current === 'rolled_back' && next === 'imported');
}

function audit(input: Omit<TargetedMicroTrainingPackAuditRecord, 'auditId'>): TargetedMicroTrainingPackAuditRecord {
  return {
    ...input,
    auditId: buildTargetedMicroTrainingStage4Id('targeted-pack-audit', [
      input.action, input.packId, input.packVersion, input.previousMode,
      input.nextMode, input.actorId, input.occurredAt,
    ]),
  };
}

function appendAudit(
  audits: TargetedMicroTrainingPackAuditRecord[],
  record: TargetedMicroTrainingPackAuditRecord,
) {
  return audits.some((item) => item.auditId === record.auditId) ? audits : [...audits, record];
}

function asGap(value: unknown): TargetedGapReasonCode | undefined {
  return typeof value === 'string' && [
    'missing_text_evidence', 'missing_reasoning_relation',
    'conclusion_inconsistent', 'incomplete_task_requirement',
  ].includes(value) ? value as TargetedGapReasonCode : undefined;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortValue(item)]));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
