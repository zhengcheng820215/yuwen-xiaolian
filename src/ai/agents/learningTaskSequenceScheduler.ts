import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';

export const LEARNING_TASK_SEQUENCE_SCHEDULER_VERSION =
  'learning_task_sequence_scheduler_v2' as const;

export function orderFormalResourcesForLearningSequence(
  versions: FrozenQuestionResourceVersion[],
  options: {
    taskRole: RecommendedTaskRole;
    recentResourceVersionIds?: string[];
  },
): FrozenQuestionResourceVersion[] {
  const recentIds = new Set(options.recentResourceVersionIds || []);
  const available = versions.filter((version) => !recentIds.has(version.resourceVersionId));
  if (options.taskRole !== 'training') return [...available];
  const preludeResourceIds = resolvePreludeResourceIds(available);

  return available
    .map((version, sourceIndex) => ({ version, sourceIndex }))
    .sort((left, right) => (
      sequencePriority(left.version, preludeResourceIds) -
        sequencePriority(right.version, preludeResourceIds) ||
      sequenceRank(left.version) - sequenceRank(right.version) ||
      left.sourceIndex - right.sourceIndex
    ))
    .map(({ version }) => version);
}

export function selectFormalResourceForLearningSequence(
  versions: FrozenQuestionResourceVersion[],
  options: {
    taskRole: RecommendedTaskRole;
    targetAbilityId?: string;
    recentResourceVersionIds?: string[];
    materialId?: string;
  },
): FrozenQuestionResourceVersion | undefined {
  const candidates = versions.filter((version) => (
    version.status === 'frozen' &&
    version.abilityMetadata.taskRole === options.taskRole &&
    (!options.targetAbilityId || version.abilityMetadata.abilityId === options.targetAbilityId) &&
    (!options.materialId || version.materialId === options.materialId)
  ));
  return orderFormalResourcesForLearningSequence(candidates, options)[0];
}

function sequencePriority(
  version: FrozenQuestionResourceVersion,
  preludeResourceIds: Set<string>,
): number {
  const strategy = tagValue(version.tags, 'sequence-strategy');
  if (strategy === 'holistic_first' || strategy === 'role_driven') return 0;
  if (strategy === 'entry_first') {
    return preludeResourceIds.has(version.resourceVersionId) ? 0 : 1;
  }
  if (preludeResourceIds.has(version.resourceVersionId)) return 0;
  return version.responseFormat === 'single_choice' ? 2 : 1;
}

function resolvePreludeResourceIds(
  versions: FrozenQuestionResourceVersion[],
): Set<string> {
  const result = new Set<string>();
  const legacyCountsByMaterial = new Map<string, number>();
  for (const version of versions) {
    const explicitPrelude = tagValue(version.tags, 'sequence-prelude');
    if (explicitPrelude === 'true') {
      result.add(version.resourceVersionId);
      continue;
    }
    if (explicitPrelude === 'false' || !isFoundationChoice(version)) continue;

    const strategy = tagValue(version.tags, 'sequence-strategy');
    if (strategy === 'holistic_first' || strategy === 'role_driven') continue;
    if (strategy === 'entry_first') {
      const preludeCount = numericTag(version.tags, 'sequence-prelude-count') ?? 2;
      if (sequenceRank(version) <= Math.min(2, preludeCount)) {
        result.add(version.resourceVersionId);
      }
      continue;
    }

    const currentCount = legacyCountsByMaterial.get(version.materialId) || 0;
    if (currentCount < 2) {
      result.add(version.resourceVersionId);
      legacyCountsByMaterial.set(version.materialId, currentCount + 1);
    }
  }
  return result;
}

function isFoundationChoice(version: FrozenQuestionResourceVersion): boolean {
  return version.responseFormat === 'single_choice' &&
    version.abilityMetadata.difficulty !== 'advanced';
}

function sequenceRank(version: FrozenQuestionResourceVersion): number {
  const value = numericTag(version.tags, 'sequence-rank');
  return Number.isInteger(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}

function numericTag(tags: string[], prefix: string): number | undefined {
  const rawValue = tagValue(tags, prefix);
  if (rawValue === undefined) return undefined;
  const value = Number(rawValue);
  return Number.isInteger(value) ? value : undefined;
}

function tagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1);
}
