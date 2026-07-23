import type { MaterialObservationRepository } from '../repositories/materialObservationRepository.ts';
import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import {
  createNextQuestionResourceVersionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateResourceRegistryConsistency,
  validateStructuredQuestionDraft,
} from './questionResourceAdmissionAgent.ts';
import { linkFrozenResourceToObservationTask } from './materialObservationApplicationService.ts';
import { batchAResourceDefinitions } from './phase17BatchAProductionService.ts';

const SAMPLE_RESOURCE_KEYS = [
  'station-analysis-training',
  'riverbank-inference-retest',
  'riverbank-analysis-transfer',
] as const;

export type Phase173BatchAPreflightSample = {
  resourceKey: string;
  resourceId: string;
  resourceVersionId: string;
  abilityId: string;
  taskRole: string;
  hintPolicy: string;
  materialRelation: string;
  observationLinkId: string;
};

export type Phase173BatchAPreflightResult = {
  status: 'ready' | 'updated' | 'blocked';
  activeRegistryCount: number;
  activeObservationLinkCount: number;
  declarationReadyCount: number;
  upgradedResourceIds: string[];
  sampleSet: Phase173BatchAPreflightSample[];
  issues: string[];
};

export async function preparePhase173BatchAPreflight(input: {
  resourceRepository: QuestionResourceAdmissionRepository;
  observationRepository: MaterialObservationRepository;
  reviewerId: string;
  reviewNote: string;
  now?: string;
}): Promise<Phase173BatchAPreflightResult> {
  if (!input.reviewerId.trim() || !input.reviewNote.trim()) {
    throw new Error('Phase 17.3 preflight requires an explicit reviewer and review note.');
  }

  const definitions = batchAResourceDefinitions();
  const now = input.now || new Date().toISOString();
  const upgradedResourceIds: string[] = [];
  const issues: string[] = [];

  for (const definition of definitions) {
    const resourceId = toResourceId(definition.resourceKey);
    const registry = await input.resourceRepository.getRegistryEntry(resourceId);
    if (!registry?.currentFrozenVersionId || registry.status !== 'active') {
      issues.push(`${definition.resourceKey}:active_registry_head_missing`);
      continue;
    }
    const current = await input.resourceRepository.getVersion(registry.currentFrozenVersionId);
    if (!current || current.status !== 'frozen') {
      issues.push(`${definition.resourceKey}:current_frozen_version_missing`);
      continue;
    }

    const requiredTags = requiredRuntimeTags(definition.taskRole, definition.materialRelationIntent);
    const resourceLinks = await input.observationRepository.listLinks(resourceId);
    const currentActiveLink = resourceLinks
      .find((link) => link.status === 'active' && link.resourceVersionId === current.resourceVersionId);
    const sourceLink = currentActiveLink || resourceLinks
      .sort((left, right) => right.linkedAt.localeCompare(left.linkedAt))[0];
    const declarationsReady = requiredTags.every((tag) => current.tags.includes(tag));
    if (declarationsReady && currentActiveLink) continue;
    if (!sourceLink) {
      issues.push(`${definition.resourceKey}:observation_link_source_missing`);
      continue;
    }

    const upgradedVersion = declarationsReady
      ? current
      : await formalizeDeclarationUpgrade({
        repository: input.resourceRepository,
        resourceId,
        resourceKey: definition.resourceKey,
        current,
        requiredTags,
        reviewerId: input.reviewerId,
        reviewNote: input.reviewNote,
        now,
      });
    if (!upgradedVersion) {
      issues.push(`${definition.resourceKey}:declaration_upgrade_failed`);
      continue;
    }
    const linked = await linkFrozenResourceToObservationTask(
      input.resourceRepository,
      input.observationRepository,
      {
        planId: sourceLink.materialObservationPlanId,
        observationTaskPlanId: sourceLink.observationTaskPlanId,
        resourceVersionId: upgradedVersion.resourceVersionId,
        linkedAt: now,
      },
    );
    if (linked.link.status !== 'active' || linked.issues.length > 0) {
      issues.push(...linked.issues.map((issue) => `${definition.resourceKey}:${issue}`));
      if (linked.link.status !== 'active') issues.push(`${definition.resourceKey}:new_observation_link_not_active`);
      continue;
    }
    if (!declarationsReady) upgradedResourceIds.push(resourceId);
  }

  const inspected = await inspectCurrentState(input.resourceRepository, input.observationRepository);
  const consistency = await validateResourceRegistryConsistency(input.resourceRepository);
  issues.push(...consistency.issues.map((issue) => `registry:${issue}`), ...inspected.issues);

  return {
    status: issues.length > 0
      ? 'blocked'
      : upgradedResourceIds.length > 0
        ? 'updated'
        : 'ready',
    activeRegistryCount: inspected.activeRegistryCount,
    activeObservationLinkCount: inspected.activeObservationLinkCount,
    declarationReadyCount: inspected.declarationReadyCount,
    upgradedResourceIds,
    sampleSet: inspected.sampleSet,
    issues: unique(issues),
  };
}

async function formalizeDeclarationUpgrade(input: {
  repository: QuestionResourceAdmissionRepository;
  resourceId: string;
  resourceKey: string;
  current: FrozenQuestionResourceVersion;
  requiredTags: string[];
  reviewerId: string;
  reviewNote: string;
  now: string;
}): Promise<FrozenQuestionResourceVersion | null> {
  const draftId = `phase17-3-preflight-${input.resourceKey}-v${input.current.versionNumber + 1}`;
  let draft = await input.repository.getDraft(draftId);
  if (!draft) {
    draft = await createNextQuestionResourceVersionDraft(input.repository, {
      resourceId: input.resourceId,
      draftId,
      now: input.now,
    });
  }
  if (draft.resourceId !== input.resourceId || draft.parentVersionId !== input.current.resourceVersionId) {
    throw new Error(`Phase 17.3 preflight draft identity conflict: ${draftId}`);
  }
  if (['drafted', 'validation_failed', 'revision_required'].includes(draft.status)) {
    if (input.requiredTags.some((tag) => !draft!.tags.includes(tag))) {
      draft = await updateStructuredQuestionDraft(input.repository, draftId, {
        tags: unique([...draft.tags, ...input.requiredTags]),
      }, input.now);
    }
    const validation = await validateStructuredQuestionDraft(input.repository, draftId, input.now);
    if (!validation.passed) return null;
    draft = (await input.repository.getDraft(draftId)) || draft;
  }
  if (draft.status === 'drafted') {
    draft = await submitQuestionResourceForReview(input.repository, draftId, input.now);
  }
  if (draft.status === 'pending_review') {
    await reviewQuestionResourceDraft(input.repository, {
      draftId,
      action: 'approve',
      reviewerId: input.reviewerId,
      notes: input.reviewNote,
      now: input.now,
    });
    draft = (await input.repository.getDraft(draftId)) || draft;
  }
  if (draft.status !== 'reviewed') return null;
  return (await freezeQuestionResourceDraft(input.repository, draftId, input.now)).version;
}

async function inspectCurrentState(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
) {
  const definitions = batchAResourceDefinitions();
  const registryEntries = await resourceRepository.listRegistryEntries();
  const links = await observationRepository.listLinks();
  const definitionByResourceId = new Map(
    definitions.map((definition) => [toResourceId(definition.resourceKey), definition]),
  );
  const batchRegistry = registryEntries.filter((entry) => (
    entry.status === 'active' && definitionByResourceId.has(entry.resourceId)
  ));
  const currentVersions = (
    await Promise.all(batchRegistry.map((entry) => (
      entry.currentFrozenVersionId
        ? resourceRepository.getVersion(entry.currentFrozenVersionId)
        : Promise.resolve(null)
    )))
  ).filter((version): version is FrozenQuestionResourceVersion => Boolean(version));
  const currentVersionIds = new Set(currentVersions.map((version) => version.resourceVersionId));
  const activeLinks = links.filter((link) => (
    link.status === 'active' &&
    definitionByResourceId.has(link.resourceId) &&
    currentVersionIds.has(link.resourceVersionId)
  ));
  const issues: string[] = [];
  let declarationReadyCount = 0;

  for (const version of currentVersions) {
    const definition = definitionByResourceId.get(version.resourceId);
    if (!definition) continue;
    const missing = requiredRuntimeTags(definition.taskRole, definition.materialRelationIntent)
      .filter((tag) => !version.tags.includes(tag));
    if (missing.length === 0) declarationReadyCount += 1;
    else issues.push(`${definition.resourceKey}:missing_${missing.join(',')}`);
  }

  if (batchRegistry.length !== definitions.length) issues.push('batch_a:active_registry_count_mismatch');
  if (activeLinks.length !== definitions.length) issues.push('batch_a:active_observation_link_count_mismatch');
  if (currentVersions.length !== definitions.length) issues.push('batch_a:current_version_count_mismatch');

  const sampleSet: Phase173BatchAPreflightSample[] = [];
  for (const resourceKey of SAMPLE_RESOURCE_KEYS) {
    const resourceId = toResourceId(resourceKey);
    const version = currentVersions.find((item) => item.resourceId === resourceId);
    const link = activeLinks.find((item) => item.resourceId === resourceId);
    if (!version || !link) {
      issues.push(`${resourceKey}:live_sample_not_ready`);
      continue;
    }
    sampleSet.push({
      resourceKey,
      resourceId,
      resourceVersionId: version.resourceVersionId,
      abilityId: version.abilityMetadata.abilityId,
      taskRole: version.abilityMetadata.taskRole,
      hintPolicy: version.tags.find((tag) => tag.startsWith('hint_policy:')) || '',
      materialRelation: version.tags.find((tag) => tag.startsWith('material_relation:')) || '',
      observationLinkId: link.resourceObservationLinkId,
    });
  }

  return {
    activeRegistryCount: batchRegistry.length,
    activeObservationLinkCount: activeLinks.length,
    declarationReadyCount,
    sampleSet,
    issues,
  };
}

function requiredRuntimeTags(
  taskRole: string,
  materialRelationIntent?: 'same_context' | 'similar_context' | 'new_context',
): string[] {
  return [
    taskRole === 'retest' ? 'hint_policy:no_hint' : 'hint_policy:limited_hint',
    `material_relation:${materialRelationIntent || 'same_context'}`,
  ];
}

function toResourceId(resourceKey: string): string {
  return `phase17-batch-a-resource-${resourceKey}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
