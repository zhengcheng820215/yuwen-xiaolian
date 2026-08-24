import type { FrozenQuestionResourceVersion } from
  '../schemas/questionResourceAdmission.schema.ts';
import type { FormalTaskGroupProgressionArtifact } from
  '../schemas/formalTaskProgressionMetadata.schema.ts';
import { isFormalTaskGroupProgressionArtifact, isFormalTaskProgressionMetadata } from
  '../schemas/formalTaskProgressionMetadata.schema.ts';
import {
  createLearningProgressionContextSnapshot,
  transitionToSnapshotPredecessor,
  type LearningProgressionContextSnapshot,
} from '../schemas/learningProgressionContext.schema.ts';

export function resolveLearningProgressionContext(input: {
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  learningTaskAttemptId: string;
  resourceVersion: FrozenQuestionResourceVersion;
  activeResourceVersions?: FrozenQuestionResourceVersion[];
  progressionArtifact?: FormalTaskGroupProgressionArtifact | null;
  capturedAt?: string;
}): LearningProgressionContextSnapshot {
  const version = input.resourceVersion;
  const metadata = version.progressionMetadata;
  const artifact = input.progressionArtifact;
  const limitations: string[] = [];
  if (isFormalTaskProgressionMetadata(metadata)
    && isFormalTaskGroupProgressionArtifact(artifact)
    && metadata.taskGroupProgressionPlanHash === artifact.planHash
    && metadata.materialVersionId === artifact.materialVersionId) {
    const member = artifact.progressionPlan.orderedTasks.find(
      (item) => item.planningTaskKey === metadata.planningTaskKey,
    );
    if (member
      && member.sequenceRank === metadata.sequenceRank
      && member.taskLoadSemanticsHash === metadata.taskLoadSemanticsHash) {
      const predecessor = resolveNativePredecessor({
        current: version,
        activeVersions: input.activeResourceVersions || [],
        artifact,
      });
      if (metadata.sequenceRank > 1 && !predecessor) {
        limitations.push('native_predecessor_not_active_or_not_published');
      }
      const comparisonEligibility = metadata.sequenceRank === 1 || predecessor
        ? 'eligible' as const
        : 'not_comparable' as const;
      return createLearningProgressionContextSnapshot({
        studentId: input.studentId,
        learningSessionId: input.learningSessionId,
        learningRoundId: input.learningRoundId,
        learningTaskAttemptId: input.learningTaskAttemptId,
        resourceVersionId: version.resourceVersionId,
        materialVersionId: metadata.materialVersionId,
        authoritySource: 'native_authority',
        taskGroupProgressionPlanHash: metadata.taskGroupProgressionPlanHash,
        planningTaskKey: metadata.planningTaskKey,
        sequenceRank: metadata.sequenceRank,
        taskLoadSemantics: metadata.taskLoadSemantics,
        taskLoadSemanticsHash: metadata.taskLoadSemanticsHash,
        predecessor,
        comparisonEligibility,
        comparisonLimitations: limitations,
        capturedAt: input.capturedAt || new Date().toISOString(),
      });
    }
    limitations.push('native_metadata_artifact_member_mismatch');
  } else if (metadata || artifact) {
    limitations.push('native_metadata_or_artifact_incomplete');
  }

  const legacy = hasLegacySequenceIdentity(version);
  limitations.push(legacy ? 'legacy_projection_ordering_only' : 'progression_authority_unavailable');
  return createLearningProgressionContextSnapshot({
    studentId: input.studentId,
    learningSessionId: input.learningSessionId,
    learningRoundId: input.learningRoundId,
    learningTaskAttemptId: input.learningTaskAttemptId,
    resourceVersionId: version.resourceVersionId,
    materialVersionId: version.materialVersionId || version.materialId || 'unknown-material',
    authoritySource: legacy ? 'legacy_projection' : 'none',
    comparisonEligibility: legacy ? 'ordering_only' : 'not_comparable',
    comparisonLimitations: limitations,
    capturedAt: input.capturedAt || new Date().toISOString(),
  });
}

function resolveNativePredecessor(input: {
  current: FrozenQuestionResourceVersion;
  activeVersions: FrozenQuestionResourceVersion[];
  artifact: FormalTaskGroupProgressionArtifact;
}): LearningProgressionContextSnapshot['predecessor'] {
  const metadata = input.current.progressionMetadata!;
  if (metadata.sequenceRank <= 1) return undefined;
  const transition = input.artifact.progressionPlan.transitions.find(
    (item) => item.toPlanningTaskKey === metadata.planningTaskKey,
  );
  if (!transition) return undefined;
  const predecessor = input.activeVersions.find((version) => (
    version.status === 'frozen'
    && version.progressionMetadata?.taskGroupProgressionPlanHash === input.artifact.planHash
    && version.progressionMetadata?.planningTaskKey === transition.fromPlanningTaskKey
  ));
  if (!predecessor?.progressionMetadata) return undefined;
  return transitionToSnapshotPredecessor({
    predecessorResourceVersionId: predecessor.resourceVersionId,
    predecessorSequenceRank: predecessor.progressionMetadata.sequenceRank,
    transition,
  });
}

function hasLegacySequenceIdentity(version: FrozenQuestionResourceVersion): boolean {
  return version.tags.some((tag) => tag.startsWith('sequence-'));
}
