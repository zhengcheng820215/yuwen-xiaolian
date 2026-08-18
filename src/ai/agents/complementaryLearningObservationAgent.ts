import type {
  ComplementaryObservationDecision,
  IndependentLearningObservation,
} from '../schemas/complementaryLearningObservation.schema.ts';

/**
 * Interprets, but never merges, one choice observation and one text observation.
 * Each Attempt / Diagnosis / Evidence remains independently traceable.
 */
export function interpretComplementaryLearningObservations(input: {
  choice: IndependentLearningObservation;
  text: IndependentLearningObservation;
}): ComplementaryObservationDecision {
  const issues = validateScope(input.choice, input.text);
  const refs = {
    sourceAttemptIds: [input.choice.attemptId, input.text.attemptId],
    sourceDiagnosisIds: [input.choice.diagnosisId, input.text.diagnosisId],
    sourceEvidenceIds: [input.choice.evidenceId, input.text.evidenceId],
  };
  if (issues.length > 0) {
    return {
      status: 'insufficient_scope',
      rootCauseStatus: 'unresolved',
      ...refs,
      issues,
    };
  }
  if (input.choice.performance === 'weak' && input.text.performance === 'weak') {
    return decision('prerequisite_gap_hypothesis', 'prerequisite_foundation', refs);
  }
  if (input.choice.performance === 'strong' && input.text.performance === 'weak') {
    return decision('constructed_response_gap_hypothesis', 'constructed_response_training', refs);
  }
  if (input.choice.performance === 'weak' && input.text.performance === 'strong') {
    return decision('evidence_conflict', 'diagnostic_verification', refs, 'unresolved');
  }
  return decision('multi_source_positive', 'retest_or_transfer', refs);
}

function validateScope(
  choice: IndependentLearningObservation,
  text: IndependentLearningObservation,
): string[] {
  const issues: string[] = [];
  if (choice.responseFormat !== 'single_choice') issues.push('choice_observation_format_invalid');
  if (text.responseFormat !== 'text') issues.push('text_observation_format_invalid');
  if (choice.studentId !== text.studentId) issues.push('student_identity_mismatch');
  if (choice.materialVersionId !== text.materialVersionId) issues.push('material_version_mismatch');
  if (!choice.abilityIds.some((abilityId) => text.abilityIds.includes(abilityId))) issues.push('ability_scope_not_comparable');
  if (choice.attemptId === text.attemptId) issues.push('attempts_must_remain_independent');
  if (choice.diagnosisId === text.diagnosisId) issues.push('diagnoses_must_remain_independent');
  if (choice.evidenceId === text.evidenceId) issues.push('evidence_must_remain_independent');
  return issues;
}

function decision(
  interpretation: NonNullable<ComplementaryObservationDecision['interpretation']>,
  trainingRoute: NonNullable<ComplementaryObservationDecision['trainingRoute']>,
  refs: Pick<ComplementaryObservationDecision, 'sourceAttemptIds' | 'sourceDiagnosisIds' | 'sourceEvidenceIds'>,
  rootCauseStatus: ComplementaryObservationDecision['rootCauseStatus'] = 'hypothesis',
): ComplementaryObservationDecision {
  return {
    status: 'interpreted',
    interpretation,
    trainingRoute,
    rootCauseStatus,
    ...refs,
    issues: [],
  };
}
