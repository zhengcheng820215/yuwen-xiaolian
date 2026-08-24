import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { QuestionResponseFormat } from
  '../schemas/questionResourceAdmission.schema.ts';
import {
  READING_OPEN_RESPONSE_LOAD_GATE_VERSION,
  type ReadingOpenResponseLoadGateAssessment,
  type ReadingTaskGroupLoadAdvisoryCode,
  type ReadingTaskGroupLoadBlockerCode,
  type ReadingTaskGroupLoadGateAssessment,
} from '../schemas/readingOpenResponseLoadGate.schema.ts';
import {
  TRAINING_TASK_SEQUENCE_PLANNING_VERSION,
  type TrainingTaskSequenceReason,
  type TrainingTaskSequenceStrategy,
} from '../schemas/trainingTaskSequencePlanning.schema.ts';
import type { TextResponseLoadLevel } from
  '../schemas/readingOpenResponseInputLoad.schema.ts';
import { stableHash } from './readingOpenResponseLoadQualityGate.ts';

export type ReadingTaskGroupLoadGateItem = {
  trainingTaskId: string;
  subjectId: string;
  subjectRevision?: number;
  responseFormat: QuestionResponseFormat;
  taskRole: RecommendedTaskRole;
  sequenceRank?: number;
  sourceAnchorIds: string[];
  observationObject?: string;
  scoringTargetIds?: string[];
  higherOrderObservationId?: string;
  singleGateAssessment?: ReadingOpenResponseLoadGateAssessment;
};

export type ReadingTaskGroupLoadGateInput = {
  materialVersionId: string;
  observationPlanRevisionId: string;
  items: ReadingTaskGroupLoadGateItem[];
  sequenceStrategy: TrainingTaskSequenceStrategy;
  sequenceReasonCode: TrainingTaskSequenceReason;
  expectedOrderedTrainingTaskIds?: string[];
  requiredHigherOrderObservationIds?: string[];
  targetedExcerpt?: boolean;
  /** False only for pre-Stage-3 groups that have no complete frozen sequence identity. */
  enforceSequence?: boolean;
  assessedAt?: string;
};

const LEVEL_RANK: Record<TextResponseLoadLevel | 'single_choice', number> = {
  single_choice: 0,
  entry_short: 1,
  focused_short: 2,
  developing: 3,
  integrated: 4,
};

const VALID_EXCEPTION_PAIRS = new Set([
  'holistic_first:holistic_judgment_required',
  'holistic_first:independent_expression_baseline',
  'role_driven:retest_after_training',
  'role_driven:transfer_in_new_context',
]);

export function assessReadingTaskGroupLoadGate(
  input: ReadingTaskGroupLoadGateInput,
): ReadingTaskGroupLoadGateAssessment {
  const ordered = stableOrder(input.items);
  const blockers = new Set<ReadingTaskGroupLoadBlockerCode>();
  const advisories = new Set<ReadingTaskGroupLoadAdvisoryCode>();
  const exceptionValid = VALID_EXCEPTION_PAIRS.has(
    `${input.sequenceStrategy}:${input.sequenceReasonCode}`,
  ) && exceptionRoleMatches(input.sequenceReasonCode, ordered);
  const enforceSequence = input.enforceSequence !== false;
  const effectiveSequence = ordered.map(resolveEffectiveLoad).filter(
    (value): value is TextResponseLoadLevel | 'single_choice' => Boolean(value),
  );

  if (
    input.expectedOrderedTrainingTaskIds
    && input.expectedOrderedTrainingTaskIds.join('|')
      !== ordered.map((item) => item.trainingTaskId).join('|')
  ) {
    blockers.add('sequence_identity_mismatch');
  }

  if (enforceSequence && !input.targetedExcerpt && effectiveSequence.length > 0 && !exceptionValid) {
    const first = effectiveSequence[0]!;
    if (first === 'integrated') blockers.add('missing_accessible_entry');
    for (let index = 1; index < effectiveSequence.length; index += 1) {
      const previous = effectiveSequence[index - 1]!;
      const current = effectiveSequence[index]!;
      if (
        current === 'integrated'
        && (previous === 'single_choice' || previous === 'entry_short')
      ) {
        blockers.add('unexplained_entry_to_integrated_jump');
      } else if (previous === 'focused_short' && current === 'integrated') {
        advisories.add('focused_to_integrated_jump');
      }
    }
  }

  const startsAtHighLoad = effectiveSequence[0] === 'integrated';
  const roleDriven = input.sequenceStrategy === 'role_driven';
  if (
    enforceSequence
    && ((startsAtHighLoad && !input.targetedExcerpt) || roleDriven)
    && !exceptionValid
  ) {
    blockers.add('sequence_exception_missing_or_invalid');
  }

  if (hasDuplicateObservationValue(ordered)) {
    blockers.add('duplicate_observation_value');
  }

  const retainedHigherOrderObservationIds = [...new Set(ordered
    .filter((item) => item.singleGateAssessment?.recomputedLoadProfile.loadLevel === 'integrated')
    .map((item) => item.higherOrderObservationId)
    .filter((value): value is string => Boolean(value?.trim())))].sort();
  const requiredHigherOrder = input.requiredHigherOrderObservationIds || [];
  if (requiredHigherOrder.some((required) => !retainedHigherOrderObservationIds.includes(required))) {
    blockers.add('required_higher_order_observation_missing');
  } else if (requiredHigherOrder.length > 0 && retainedHigherOrderObservationIds.length === 1) {
    advisories.add('higher_order_coverage_thin');
  }

  if (
    effectiveSequence[0] === 'developing'
    && ordered[0]?.singleGateAssessment?.recomputedLoadProfile
    && ordered.some((item) => item.responseFormat === 'single_choice')
  ) {
    advisories.add('developing_entry_with_foundation');
  }

  const blockerCodes = [...blockers].sort();
  const advisoryCodes = [...advisories].sort();
  const groupSnapshotHash = stableHash({
    materialVersionId: input.materialVersionId,
    observationPlanRevisionId: input.observationPlanRevisionId,
    sequenceStrategy: input.sequenceStrategy,
    sequenceReasonCode: input.sequenceReasonCode,
    items: ordered.map((item) => ({
      trainingTaskId: item.trainingTaskId,
      subjectId: item.subjectId,
      subjectRevision: item.subjectRevision,
      responseFormat: item.responseFormat,
      taskRole: item.taskRole,
      sourceAnchorIds: [...item.sourceAnchorIds].sort(),
      observationObject: item.observationObject,
      scoringTargetIds: [...(item.scoringTargetIds || [])].sort(),
      contentHash: item.singleGateAssessment?.subject.contentHash,
      loadLevel: item.singleGateAssessment?.recomputedLoadProfile.loadLevel,
    })),
  });
  const assessedAt = input.assessedAt || new Date().toISOString();
  return {
    assessmentId: `load-group-gate:${groupSnapshotHash}`,
    materialVersionId: input.materialVersionId,
    observationPlanRevisionId: input.observationPlanRevisionId,
    orderedSubjectIdentities: ordered.map((item) => ({
      trainingTaskId: item.trainingTaskId,
      subjectId: item.subjectId,
      ...(item.subjectRevision === undefined ? {} : { subjectRevision: item.subjectRevision }),
      responseFormat: item.responseFormat,
      ...(item.singleGateAssessment?.recomputedLoadProfile.loadLevel
        ? { loadLevel: item.singleGateAssessment.recomputedLoadProfile.loadLevel }
        : {}),
      taskRole: normalizeTaskRole(item.taskRole),
    })),
    groupSnapshotHash,
    sequencePlanningVersion: TRAINING_TASK_SEQUENCE_PLANNING_VERSION,
    sequenceStrategy: input.sequenceStrategy,
    sequenceReasonCode: input.sequenceReasonCode,
    decision: blockerCodes.length > 0
      ? 'blocked'
      : advisoryCodes.length > 0 ? 'pass_with_advisory' : 'pass',
    blockerCodes,
    advisoryCodes,
    effectiveLoadSequence: effectiveSequence,
    retainedHigherOrderObservationIds,
    assessedAt,
    gateRuleVersion: READING_OPEN_RESPONSE_LOAD_GATE_VERSION,
  };
}

function stableOrder(items: ReadingTaskGroupLoadGateItem[]): ReadingTaskGroupLoadGateItem[] {
  return items.map((item, index) => ({ item, index }))
    .sort((left, right) => (
      (left.item.sequenceRank ?? Number.MAX_SAFE_INTEGER)
      - (right.item.sequenceRank ?? Number.MAX_SAFE_INTEGER)
      || left.index - right.index
      || left.item.trainingTaskId.localeCompare(right.item.trainingTaskId)
    ))
    .map(({ item }) => item);
}

function resolveEffectiveLoad(
  item: ReadingTaskGroupLoadGateItem,
): TextResponseLoadLevel | 'single_choice' | undefined {
  if (item.responseFormat === 'single_choice') return 'single_choice';
  return item.singleGateAssessment?.recomputedLoadProfile.loadLevel;
}

function exceptionRoleMatches(
  reason: TrainingTaskSequenceReason,
  items: ReadingTaskGroupLoadGateItem[],
): boolean {
  if (reason === 'retest_after_training') return items.some((item) => item.taskRole === 'retest');
  if (reason === 'transfer_in_new_context') return items.some((item) => item.taskRole === 'transfer');
  return items.some((item) => item.taskRole === 'training');
}

function hasDuplicateObservationValue(items: ReadingTaskGroupLoadGateItem[]): boolean {
  const signatures = new Set<string>();
  for (const item of items) {
    if (!item.observationObject?.trim()) continue;
    const signature = stableHash({
      observationObject: item.observationObject.trim(),
      sourceAnchorIds: [...item.sourceAnchorIds].sort(),
      scoringTargetIds: [...(item.scoringTargetIds || [])].sort(),
    });
    if (signatures.has(signature)) return true;
    signatures.add(signature);
  }
  return false;
}

function normalizeTaskRole(role: RecommendedTaskRole): 'training' | 'retest' | 'transfer' {
  if (role === 'retest' || role === 'transfer') return role;
  return 'training';
}
