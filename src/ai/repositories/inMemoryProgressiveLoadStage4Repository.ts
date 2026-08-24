import {
  isProgressiveLoadCalibrationEvent,
  isProgressiveLoadCalibrationProjection,
  isProgressiveLoadCalibrationOutboxEntry,
  isProgressiveLoadCalibrationThresholdPolicy,
  isProgressiveLoadGovernanceContext,
  type ProgressiveLoadCalibrationEvent,
  type ProgressiveLoadCalibrationEventWriteResult,
  type ProgressiveLoadCalibrationProjection,
  type ProgressiveLoadCalibrationOutboxEntry,
  type ProgressiveLoadCalibrationThresholdPolicy,
  type ProgressiveLoadGovernanceContext,
} from '../schemas/progressiveLoadStage4.schema.ts';
import type { ProgressiveLoadStage4Repository } from './progressiveLoadStage4Repository.ts';

export class InMemoryProgressiveLoadStage4Repository implements ProgressiveLoadStage4Repository {
  private readonly contexts = new Map<string, ProgressiveLoadGovernanceContext>();
  private readonly events = new Map<string, ProgressiveLoadCalibrationEvent>();
  private readonly projections = new Map<string, ProgressiveLoadCalibrationProjection>();
  private readonly outbox = new Map<string, ProgressiveLoadCalibrationOutboxEntry>();
  private readonly policies = new Map<string, ProgressiveLoadCalibrationThresholdPolicy>();

  async saveGovernanceContext(value: ProgressiveLoadGovernanceContext) {
    if (!isProgressiveLoadGovernanceContext(value)) throw new Error('progressive_governance_context_invalid');
    const existing = this.contexts.get(value.governanceContextId);
    if (existing && !sameContextIdentity(existing, value)) {
      throw new Error('progressive_governance_context_identity_conflict');
    }
    this.contexts.set(value.governanceContextId, clone(value));
    return clone(value);
  }

  async getGovernanceContext(id: string) {
    const value = this.contexts.get(id);
    return value ? clone(value) : null;
  }

  async listGovernanceContexts() {
    return [...this.contexts.values()].sort((a, b) => a.priority - b.priority
      || a.createdAt.localeCompare(b.createdAt)).map(clone);
  }

  async saveEvent(value: ProgressiveLoadCalibrationEvent): Promise<ProgressiveLoadCalibrationEventWriteResult> {
    if (!isProgressiveLoadCalibrationEvent(value)) throw new Error('progressive_calibration_event_invalid');
    const existing = this.events.get(value.eventId);
    if (!existing) {
      this.events.set(value.eventId, clone(value));
      return { status: 'created', event: clone(value), issues: [] };
    }
    if (stable(existing) === stable(value)) {
      return { status: 'unchanged', event: clone(existing), issues: [] };
    }
    return { status: 'conflict', event: clone(existing), issues: ['progressive_event_identity_conflict'] };
  }

  async getEvent(id: string) {
    const value = this.events.get(id);
    return value ? clone(value) : null;
  }

  async listEvents() {
    return [...this.events.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map(clone);
  }

  async saveOutboxEntry(value: ProgressiveLoadCalibrationOutboxEntry) {
    if (!isProgressiveLoadCalibrationOutboxEntry(value)) throw new Error('progressive_calibration_outbox_invalid');
    this.outbox.set(value.outboxId, clone(value)); return clone(value);
  }
  async getOutboxEntry(id: string) { const value = this.outbox.get(id); return value ? clone(value) : null; }
  async listDueOutboxEntries(now: string) { return [...this.outbox.values()].filter((item) => item.status !== 'failed' && item.nextRetryAt <= now).map(clone); }
  async deleteOutboxEntry(id: string) { this.outbox.delete(id); }

  async saveProjection(value: ProgressiveLoadCalibrationProjection) {
    if (!isProgressiveLoadCalibrationProjection(value)) throw new Error('progressive_calibration_projection_invalid');
    this.projections.set(value.projectionId, clone(value));
    return clone(value);
  }

  async listProjections() {
    return [...this.projections.values()].sort((a, b) => a.resourceVersionId.localeCompare(b.resourceVersionId)).map(clone);
  }

  async saveThresholdPolicy(value: ProgressiveLoadCalibrationThresholdPolicy) {
    if (!isProgressiveLoadCalibrationThresholdPolicy(value)) throw new Error('progressive_threshold_policy_invalid');
    const existing = this.policies.get(value.policyVersion);
    if (existing && stable(existing) !== stable(value)) throw new Error('progressive_threshold_policy_immutable');
    this.policies.set(value.policyVersion, clone(value));
    return clone(value);
  }

  async listThresholdPolicies() {
    return [...this.policies.values()].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).map(clone);
  }

  async clear() {
    this.contexts.clear(); this.events.clear(); this.outbox.clear(); this.projections.clear(); this.policies.clear();
  }
}

function sameContextIdentity(a: ProgressiveLoadGovernanceContext, b: ProgressiveLoadGovernanceContext) {
  return a.governanceContextId === b.governanceContextId
    && a.sourceResourceVersionId === b.sourceResourceVersionId
    && a.auditDigest === b.auditDigest && a.sourceDigest === b.sourceDigest;
}

function stable(value: unknown) { return JSON.stringify(value); }
function clone<T>(value: T): T { return structuredClone(value); }
