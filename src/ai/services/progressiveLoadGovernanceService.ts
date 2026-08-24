import type { ReadingOpenResponseExistingQuestionGovernanceAgent } from
  '../agents/readingOpenResponseExistingQuestionGovernanceAgent.ts';
import type { ProgressiveLoadStage4Repository } from
  '../repositories/progressiveLoadStage4Repository.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  type TextResponseLoadDisposition,
  type TextResponseLoadFindingCode,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import {
  PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION,
  stableProgressiveLoadId,
  type ProgressiveLoadGovernanceContext,
  type ProgressiveLoadGovernanceTarget,
} from '../schemas/progressiveLoadStage4.schema.ts';
import {
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
  type ProgressionAuditFindingCode,
  type ReadingTrainingProgressionStage0Report,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import type { SharedFormalResourceSnapshot } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';

const ELIGIBLE_FINDINGS = new Set<ProgressionAuditFindingCode>([
  'projection_incomplete',
  'missing_accessible_entry',
  'unexplained_responsibility_jump',
  'duplicate_observation_scope',
  'task_overload_attribution_risk',
]);

export class ProgressiveLoadGovernanceService {
  private readonly repository: ProgressiveLoadStage4Repository;
  private readonly existingGovernanceAgent?: ReadingOpenResponseExistingQuestionGovernanceAgent;
  private readonly now: () => string;

  constructor(
    repository: ProgressiveLoadStage4Repository,
    existingGovernanceAgent?: ReadingOpenResponseExistingQuestionGovernanceAgent,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.existingGovernanceAgent = existingGovernanceAgent;
    this.now = now;
  }

  async selectCases(input: {
    report: ReadingTrainingProgressionStage0Report;
    snapshot: SharedFormalResourceSnapshot;
    maximumSize?: number;
  }): Promise<ProgressiveLoadGovernanceContext[]> {
    const maximumSize = input.maximumSize ?? 5;
    if (!Number.isInteger(maximumSize) || maximumSize < 1 || maximumSize > 5) {
      throw new Error('progressive_governance_batch_size_invalid');
    }
    const versions = new Map(input.snapshot.data.questionResources.versions.map((item) => (
      [item.resourceVersionId, item]
    )));
    const candidates = input.report.groups.flatMap((group) => group.findings
      .filter((finding) => ELIGIBLE_FINDINGS.has(finding.code))
      .flatMap((finding) => finding.questionVersionIds.map((resourceVersionId) => ({
        group, finding, version: versions.get(resourceVersionId),
      }))))
      .filter((item) => item.version && ['short_text', 'long_text'].includes(item.version.responseFormat))
      .sort((a, b) => priorityFor(a.finding.code, a.finding.severity)
        - priorityFor(b.finding.code, b.finding.severity)
        || a.version!.resourceVersionId.localeCompare(b.version!.resourceVersionId));

    const grouped = new Map<string, typeof candidates>();
    candidates.forEach((item) => grouped.set(item.version!.resourceVersionId, [
      ...(grouped.get(item.version!.resourceVersionId) || []), item,
    ]));
    const selected: ProgressiveLoadGovernanceContext[] = [];
    for (const [, items] of grouped) {
      if (selected.length >= maximumSize) break;
      const first = items[0]!;
      const version = first.version!;
      const projection = first.group.projections.find((item) => (
        item.questionVersionId === version.resourceVersionId
      ));
      const findingCodes = [...new Set(items.map((item) => item.finding.code))].sort();
      const now = this.now();
      const identity = [version.resourceId, version.resourceVersionId,
        input.report.schemaVersion, input.report.sourceDigest, input.report.auditDigest];
      const context: ProgressiveLoadGovernanceContext = {
        schemaVersion: PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION,
        policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
        governanceContextId: stableProgressiveLoadId('progressive-governance', identity),
        baselineAuditVersion: input.report.schemaVersion,
        sourceDigest: input.report.sourceDigest,
        auditDigest: input.report.auditDigest,
        questionLineageId: version.resourceId,
        sourceResourceVersionId: version.resourceVersionId,
        materialVersionId: version.materialVersionId || first.group.materialVersionId,
        observationTaskPlanId: projection?.observationTaskPlanId
          || version.progressionMetadata?.planningTaskKey
          || version.taskId,
        sourceProgressionPlanHash: version.progressionMetadata?.taskGroupProgressionPlanHash,
        sourceTaskLoadSemanticsHash: version.progressionMetadata?.taskLoadSemanticsHash,
        findingCodes,
        targetOutcome: targetFor(findingCodes),
        priority: Math.min(...items.map((item) => (
          priorityFor(item.finding.code, item.finding.severity)
        ))) as 1 | 2 | 3,
        status: 'selected',
        createdAt: now,
        updatedAt: now,
      };
      selected.push(await this.repository.saveGovernanceContext(context));
    }
    return selected;
  }

  async linkToExistingGovernance(contextId: string): Promise<ProgressiveLoadGovernanceContext> {
    if (!this.existingGovernanceAgent) throw new Error('existing_governance_agent_unavailable');
    const context = await this.repository.getGovernanceContext(contextId);
    if (!context) throw new Error('progressive_governance_context_not_found');
    if (context.existingGovernanceCaseId) return context;
    const existing = await this.existingGovernanceAgent.createCase({
      questionLineageId: context.questionLineageId,
      sourceResourceVersionId: context.sourceResourceVersionId,
      materialVersionId: context.materialVersionId,
      observationTaskPlanId: context.observationTaskPlanId,
      baselineAuditVersion: READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
      sourceDigest: context.sourceDigest,
      auditDigest: context.auditDigest,
      disposition: dispositionFor(context.targetOutcome),
      findingCodes: findingsFor(context.findingCodes),
    });
    return this.repository.saveGovernanceContext({
      ...context,
      existingGovernanceCaseId: existing.governanceCaseId,
      status: 'linked',
      updatedAt: this.now(),
    });
  }

  async markStaleWhenRegistryHeadChanges(input: {
    questionLineageId: string;
    activeResourceVersionId: string;
  }): Promise<ProgressiveLoadGovernanceContext[]> {
    const changed: ProgressiveLoadGovernanceContext[] = [];
    for (const context of await this.repository.listGovernanceContexts()) {
      if (context.questionLineageId !== input.questionLineageId
        || context.sourceResourceVersionId === input.activeResourceVersionId
        || ['stale', 'resolved'].includes(context.status)) continue;
      changed.push(await this.repository.saveGovernanceContext({
        ...context, status: 'stale', updatedAt: this.now(),
      }));
    }
    return changed;
  }
}

function priorityFor(code: ProgressionAuditFindingCode, severity: string): 1 | 2 | 3 {
  if (code === 'projection_incomplete') return 1;
  if (severity === 'high_risk' || code === 'missing_accessible_entry'
    || code === 'unexplained_responsibility_jump') return 2;
  return 3;
}

function targetFor(codes: ProgressionAuditFindingCode[]): ProgressiveLoadGovernanceTarget {
  if (codes.includes('projection_incomplete')) return 'repair_identity_consistency';
  if (codes.includes('missing_accessible_entry')) return 'restore_accessible_entry';
  if (codes.includes('unexplained_responsibility_jump')) return 'remove_unexplained_jump';
  if (codes.includes('duplicate_observation_scope')) return 'remove_duplicate_observation';
  return 'reduce_composite_responsibility';
}

function dispositionFor(target: ProgressiveLoadGovernanceTarget): TextResponseLoadDisposition {
  return target === 'repair_identity_consistency' ? 'regenerate' : 'decompose_or_refocus';
}

function findingsFor(codes: ProgressionAuditFindingCode[]): TextResponseLoadFindingCode[] {
  const mapped = codes.map((code): TextResponseLoadFindingCode => {
    if (code === 'projection_incomplete') return 'response_format_load_mismatch';
    if (code === 'duplicate_observation_scope') return 'object_scope_overloaded';
    if (code === 'unexplained_responsibility_jump') return 'relation_load_overloaded';
    if (code === 'missing_accessible_entry') return 'composite_core_actions';
    return 'composite_core_actions';
  });
  return [...new Set(mapped)].sort();
}
