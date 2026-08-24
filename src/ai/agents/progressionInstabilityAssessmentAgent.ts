import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import {
  PROGRESSION_INSTABILITY_ASSESSMENT_SCHEMA_VERSION,
  type ProgressionInstabilityAssessment,
  type ReadingInstabilityLayer,
} from '../schemas/progressionInstabilityAssessment.schema.ts';
import type { ProgressionPerformanceObservation } from
  '../schemas/progressionPerformanceObservation.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  '../schemas/readingTrainingProgressionAudit.schema.ts';
import type { ReadingLoadResponsibility } from
  '../schemas/readingTrainingProgressionAudit.schema.ts';

export function assessProgressionInstability(input: {
  higher: ProgressionPerformanceObservation;
  higherContext: LearningProgressionContextSnapshot;
  lower?: ProgressionPerformanceObservation;
  taskLoadRisk?: boolean;
  corroboratingObservations?: ProgressionPerformanceObservation[];
  assessedAt?: string;
}): ProgressionInstabilityAssessment {
  const observations = [input.lower, input.higher].filter(Boolean) as
    ProgressionPerformanceObservation[];
  const base = {
    schemaVersion: PROGRESSION_INSTABILITY_ASSESSMENT_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    assessmentId: stableAssessmentId(observations, input.higherContext),
    studentId: input.higher.studentId,
    observationThreadId: input.higher.observationThreadId,
    taskGroupProgressionPlanHash: input.higher.taskGroupProgressionPlanHash,
    comparedObservationIds: observations.map((item) => item.observationId),
    assessedAt: input.assessedAt || new Date().toISOString(),
  };
  if (input.taskLoadRisk) {
    return {
      ...base,
      status: 'task_load_risk',
      attribution: 'task_load_risk_only',
      confidence: 'high',
      basis: [],
      limitations: ['task_load_or_quality_risk_unresolved'],
    };
  }
  const limitations = comparabilityLimitations(input);
  if (limitations.length > 0) {
    return {
      ...base,
      status: 'not_assessable',
      attribution: 'insufficient_comparable_evidence',
      confidence: 'low',
      basis: [],
      limitations,
    };
  }
  const lower = input.lower!;
  const added = input.higherContext.predecessor?.addedResponsibilities || [];
  const retained = lower.responsibilities.filter((item) =>
    input.higher.responsibilities.includes(item));
  const basis = [{
    lowerObservationId: lower.observationId,
    higherObservationId: input.higher.observationId,
    retainedResponsibilities: retained,
    addedResponsibilities: added,
    interpretation: input.higher.outcome === 'meets'
      ? '较高负担任务仍稳定完成，未观察到新的失稳边界。'
      : '较低负担任务已建立，较高负担任务在新增责任处出现缺口。',
  }];
  if (input.higher.outcome === 'meets') {
    return {
      ...base,
      status: 'no_instability_observed',
      attribution: 'no_negative_attribution',
      confidence: 'medium',
      basis,
      limitations: [],
    };
  }
  const corroborated = (input.corroboratingObservations || []).some((item) => (
    item.studentId === input.higher.studentId
    && item.observationThreadId === input.higher.observationThreadId
    && item.taskGroupProgressionPlanHash === input.higher.taskGroupProgressionPlanHash
    && item.observationId !== input.higher.observationId
    && ['retest_independent', 'transfer_independent', 'independent_initial']
      .includes(item.supportMode)
    && item.outcome === 'does_not_meet'
    && added.every((responsibility) => item.responsibilities.includes(responsibility))
  ));
  return {
    ...base,
    status: corroborated ? 'corroborated_boundary' : 'provisional_boundary',
    instabilityLayer: layerFor(added),
    attribution: 'student_performance_hypothesis',
    confidence: corroborated ? 'high' : 'medium',
    basis,
    limitations: corroborated ? [] : ['single_adjacent_comparison_is_provisional'],
  };
}

function comparabilityLimitations(input: {
  higher: ProgressionPerformanceObservation;
  higherContext: LearningProgressionContextSnapshot;
  lower?: ProgressionPerformanceObservation;
}): string[] {
  const { higher, lower, higherContext } = input;
  const limitations: string[] = [];
  if (!lower) limitations.push('missing_lower_load_reference');
  if (higherContext.authoritySource !== 'native_authority') limitations.push('legacy_or_missing_authority');
  if (higherContext.comparisonEligibility !== 'eligible') limitations.push('context_not_comparable');
  if (!higherContext.predecessor) limitations.push('transition_missing');
  if (higherContext.predecessor?.threadRelation !== 'same_thread') limitations.push('cross_thread_not_comparable');
  if (!['increase', 'same'].includes(higherContext.predecessor?.loadDirection || 'independent')) {
    limitations.push('transition_direction_not_comparable');
  }
  if (lower && lower.studentId !== higher.studentId) limitations.push('student_identity_mismatch');
  if (lower && lower.learningSessionId !== higher.learningSessionId) {
    limitations.push('learning_session_identity_mismatch');
  }
  if (lower && lower.learningRoundId === higher.learningRoundId
    && lower.learningTaskAttemptId === higher.learningTaskAttemptId) {
    limitations.push('learning_attempt_identity_collision');
  }
  if (lower && higherContext.predecessor
    && lower.resourceVersionId !== higherContext.predecessor.resourceVersionId) {
    limitations.push('predecessor_resource_identity_mismatch');
  }
  if (lower && lower.observationThreadId !== higher.observationThreadId) limitations.push('observation_thread_mismatch');
  if (lower && lower.taskGroupProgressionPlanHash !== higher.taskGroupProgressionPlanHash) {
    limitations.push('progression_plan_mismatch');
  }
  if (lower && !['meets', 'partially_meets'].includes(lower.outcome)) {
    limitations.push('lower_load_not_established');
  }
  if (lower && lower.comparisonEligibility !== 'eligible') limitations.push('lower_observation_ineligible');
  if (higher.comparisonEligibility !== 'eligible') limitations.push('higher_observation_ineligible');
  return [...new Set(limitations)];
}

function layerFor(added: ReadingLoadResponsibility[]): ReadingInstabilityLayer {
  const last = added[added.length - 1] || 'basic_understanding';
  const mapping: Record<ReadingLoadResponsibility, ReadingInstabilityLayer> = {
    basic_understanding: 'basic_understanding_not_established',
    text_evidence: 'text_evidence_not_established',
    relation_explanation: 'relation_explanation_not_established',
    inference_integration: 'inference_integration_not_established',
    expression_organization: 'expression_organization_not_established',
  };
  return mapping[last];
}

function stableAssessmentId(
  observations: ProgressionPerformanceObservation[],
  context: LearningProgressionContextSnapshot,
): string {
  const raw = [context.studentId, context.taskGroupProgressionPlanHash || 'none',
    ...observations.map((item) => item.observationId).sort()].join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `progression-assessment-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
