import {
  READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION,
  READING_OPEN_RESPONSE_LOAD_GATE_VERSION,
  type ReadingOpenResponseLoadGateAssessment,
  type ReadingOpenResponsePublicationReadiness,
  type ReadingTaskGroupLoadGateAssessment,
} from '../schemas/readingOpenResponseLoadGate.schema.ts';
import type { QuestionCandidate } from '../schemas/questionCandidate.schema.ts';
import {
  READING_TASK_GROUP_PROGRESSION_GATE_VERSION,
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
} from '../schemas/readingTaskGroupProgression.schema.ts';
import { calculateQuestionEditableFieldsHash } from
  '../schemas/workingTaskContent.schema.ts';

export function resolveReadingOpenResponsePublicationReadiness(input: {
  candidate: QuestionCandidate;
  groupAssessment: ReadingTaskGroupLoadGateAssessment;
  expectedGroupSnapshotFingerprint?: string;
}): ReadingOpenResponsePublicationReadiness {
  const { candidate, groupAssessment } = input;
  const assessment = candidate.loadGateAssessment;
  const requiresGate = candidate.generationContext.ruleVersion
    === READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION;
  const contentFingerprint = calculateQuestionEditableFieldsHash(candidate.content);
  const singleCurrent = !requiresGate || candidate.content.responseFormat === 'single_choice' || (
    Boolean(assessment)
    && assessment!.gateRuleVersion === READING_OPEN_RESPONSE_LOAD_GATE_VERSION
    && assessment!.subject.contentHash === contentFingerprint
    && assessment!.subject.subjectId === candidate.candidateId
    && assessment!.trainingTaskId === candidate.trainingTaskId
  );
  const groupCurrent = groupAssessment.gateRuleVersion
    === READING_OPEN_RESPONSE_LOAD_GATE_VERSION
    && (!input.expectedGroupSnapshotFingerprint
      || input.expectedGroupSnapshotFingerprint === groupAssessment.groupSnapshotHash);
  const blockerCodes = unique([
    ...(singleCurrent ? assessment?.blockerCodes || [] : ['planning_trace_missing_or_stale']),
    ...groupAssessment.blockerCodes,
  ]);
  const advisoryCodes = unique([
    ...(assessment?.advisoryCodes || []),
    ...groupAssessment.advisoryCodes,
  ]);
  const stale = !singleCurrent || !groupCurrent;
  const blocked = blockerCodes.length > 0
    || assessment?.decision === 'blocked'
    || groupAssessment.decision === 'blocked';
  const status = stale ? 'stale' : blocked ? 'blocked' : 'ready';
  return {
    subjectIdentity: candidate.candidateId,
    contentFingerprint,
    groupSnapshotFingerprint: groupAssessment.groupSnapshotHash,
    ...(assessment ? { singleGateAssessmentId: assessment.assessmentId } : {}),
    groupGateAssessmentId: groupAssessment.assessmentId,
    status,
    canPublish: status === 'ready',
    blockerCodes,
    advisoryCodes,
  };
}

export function isCandidateLoadGateAdoptable(candidate: QuestionCandidate): boolean {
  if (
    candidate.generationContext.progressionStageRuleVersion
    === READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION
  ) {
    return Boolean(
      candidate.planningTaskKey?.trim()
      && candidate.taskGroupProgressionPlanHash?.trim()
      && candidate.generationContext.planningTaskKey === candidate.planningTaskKey
      && candidate.generationContext.taskGroupProgressionPlanHash
        === candidate.taskGroupProgressionPlanHash
      && candidate.taskGroupProgressionGateAssessment
      && candidate.taskGroupProgressionGateAssessment.schemaVersion
        === READING_TASK_GROUP_PROGRESSION_GATE_VERSION
      && ['pass', 'pass_with_advisory'].includes(
        candidate.taskGroupProgressionGateAssessment.decision,
      )
      && candidate.taskGroupProgressionGateAssessment.taskGroupProgressionPlanHash
        === candidate.taskGroupProgressionPlanHash,
    );
  }
  if (
    candidate.generationContext.ruleVersion
    !== READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION
  ) {
    return true;
  }
  const singleAssessmentAllowsAdoption = candidate.content.responseFormat === 'single_choice'
    || isCurrentPassingAssessment(candidate.loadGateAssessment, candidate);
  return singleAssessmentAllowsAdoption
    && Boolean(
      candidate.groupLoadGateAssessment
      && candidate.groupLoadGateAssessment.gateRuleVersion
        === READING_OPEN_RESPONSE_LOAD_GATE_VERSION
      && candidate.groupLoadGateAssessment.decision !== 'blocked',
    );
}

function isCurrentPassingAssessment(
  assessment: ReadingOpenResponseLoadGateAssessment | undefined,
  candidate: QuestionCandidate,
): boolean {
  return Boolean(
    assessment
    && assessment.gateRuleVersion === READING_OPEN_RESPONSE_LOAD_GATE_VERSION
    && assessment.decision !== 'blocked'
    && assessment.subject.subjectId === candidate.candidateId
    && assessment.subject.contentHash === candidate.contentHash
    && candidate.contentHash === calculateQuestionEditableFieldsHash(candidate.content)
    && assessment.trainingTaskId === candidate.trainingTaskId,
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
