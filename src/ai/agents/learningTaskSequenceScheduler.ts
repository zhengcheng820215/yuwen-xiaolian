import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import { isTextResponseFormat } from '../schemas/readingOpenResponseInputLoad.schema.ts';
import { analyzeReadingOpenResponseInputLoad } from './readingOpenResponseInputLoadAnalyzer.ts';

export const LEARNING_TASK_SEQUENCE_SCHEDULER_VERSION =
  'learning_task_sequence_scheduler_v3' as const;

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
      sequenceTieBreak(left.version, right.version) ||
      left.sourceIndex - right.sourceIndex
    ))
    .map(({ version }) => version);
}

function sequenceTieBreak(
  left: FrozenQuestionResourceVersion,
  right: FrozenQuestionResourceVersion,
): number {
  const leftRank = explicitSequenceRank(left);
  const rightRank = explicitSequenceRank(right);
  const leftHasRank = leftRank !== undefined;
  const rightHasRank = rightRank !== undefined;
  if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
  if (leftHasRank !== rightHasRank) return leftHasRank ? -1 : 1;
  // Legacy formal text tasks often predate explicit sequence tags. Within the
  // same derived load band, place the task with fewer required rubric actions
  // first instead of preserving an accidental historical insertion order.
  return requiredRubricActionCount(left) - requiredRubricActionCount(right);
}

function requiredRubricActionCount(version: FrozenQuestionResourceVersion): number {
  if (!isTextResponseFormat(version.responseFormat)) return 0;
  return version.rubric.filter((item) => item.required !== false).length;
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
    if (preludeResourceIds.has(version.resourceVersionId)) return 0;
    return version.responseFormat === 'single_choice'
      ? 2.5
      : legacyTextLoadPriority(version);
  }
  if (preludeResourceIds.has(version.resourceVersionId)) return 0;
  if (version.responseFormat === 'single_choice') return 2.5;
  return legacyTextLoadPriority(version);
}

function legacyTextLoadPriority(version: FrozenQuestionResourceVersion): number {
  if (
    !isTextResponseFormat(version.responseFormat)
    || !version.questionStem?.trim()
    || !Array.isArray(version.rubric)
    || !version.minimumAnswerRequirement
  ) return 1;
  const audit = analyzeReadingOpenResponseInputLoad({
    questionVersionId: version.resourceVersionId,
    materialVersionId: version.materialVersionId,
    title: version.title,
    questionStem: version.questionStem,
    responseFormat: version.responseFormat,
    rubric: version.rubric,
    minimumAnswerRequirement: version.minimumAnswerRequirement,
    abilityMetadata: version.abilityMetadata,
    tags: version.tags,
  });
  const level = audit?.profile?.loadLevel;
  if (level === 'integrated') return 3;
  if (level === 'developing') return 2;
  return 1;
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
  return explicitSequenceRank(version) ?? Number.MAX_SAFE_INTEGER;
}

function explicitSequenceRank(
  version: FrozenQuestionResourceVersion,
): number | undefined {
  const value = numericTag(version.tags, 'sequence-rank');
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
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
