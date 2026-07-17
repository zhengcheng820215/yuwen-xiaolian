import { isAbilityEvidence, type AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import {
  EVALUATION_CONTEXT_ENVELOPE_SCHEMA_VERSION,
  isEvaluationContextEnvelope,
  isEvaluationRuntimeContract,
  type EvaluationCapability,
  type EvaluationContextAdapterInput,
  type EvaluationContextEnvelope,
  type EvaluationRuntimeContract,
} from '../schemas/evidenceConflictAssessment.schema.ts';
import {
  isEvidenceQualityAssessment,
  type EvidenceQualityAssessment,
} from '../schemas/evidenceQualityAssessment.schema.ts';

export const LEGACY_PHASE8_EVALUATION_CONTRACT: EvaluationRuntimeContract = {
  runtimeId: 'existing-phase8-evaluation',
  runtimeVersion: 'legacy-v1',
  supportedCapabilities: [],
  source: 'registered_runtime_contract',
  validation: { passed: true, issues: [] },
};

export const QUALITY_AWARE_EVALUATION_CONTRACT: EvaluationRuntimeContract = {
  runtimeId: 'quality-aware-phase8-evaluation',
  runtimeVersion: 'phase14-compatible-v1',
  supportedCapabilities: [
    'quality_context',
    'conflict_context',
    'limited_evidence',
    'do_not_resolve_conflict_automatically',
  ],
  source: 'registered_runtime_contract',
  validation: { passed: true, issues: [] },
};

export function buildEvaluationContextEnvelope(
  input: EvaluationContextAdapterInput,
): EvaluationContextEnvelope {
  const rawEvidence = dedupeEvidence(input.rawEvidence);
  const conflict = input.conflictAssessment;
  const runtime = input.runtimeContract;
  const issues = validateInput(input, rawEvidence);
  const requiredCapabilities = deriveRequiredCapabilities(conflict?.status);
  const supportedCapabilities = isEvaluationRuntimeContract(runtime)
    ? uniqueCapabilities(runtime.supportedCapabilities)
    : [];
  const supportedByRuntime = (
    isEvaluationRuntimeContract(runtime) &&
    runtime.validation.passed &&
    requiredCapabilities.every((capability) => supportedCapabilities.includes(capability))
  );
  const currentAssessments = resolveCurrentAssessments(
    conflict?.currentQualityAssessmentIds || [],
    input.currentQualityAssessments,
  );
  const evidenceById = new Map(rawEvidence.map((item) => [item.id, item]));
  const primaryIds = supportedByRuntime
    ? selectPrimaryEvidenceIds(conflict?.observationUnits || [], evidenceById)
    : [];
  const primarySet = new Set(primaryIds);
  const blockedSet = new Set(conflict?.blockedEvidenceIds || []);
  const reviewSet = new Set(conflict?.reviewRequiredEvidenceIds || []);
  const primaryEvidence = primaryIds
    .map((id) => evidenceById.get(id))
    .filter(isAbilityEvidence);
  const supportingEvidence = rawEvidence.filter((item) => (
    !primarySet.has(item.id) && !blockedSet.has(item.id) && !reviewSet.has(item.id)
  ));
  const accountedIds = uniqueSorted([
    ...primaryEvidence.map((item) => item.id),
    ...supportingEvidence.map((item) => item.id),
    ...blockedSet,
    ...reviewSet,
  ]);
  const rawIds = uniqueSorted(rawEvidence.map((item) => item.id));
  if (accountedIds.join('|') !== rawIds.join('|')) {
    issues.push('Envelope Evidence classification does not account for every raw Evidence exactly once.');
  }

  const conflictAllowsHandoff = conflict?.validation?.passed && ![
    'review_required',
    'insufficient_comparable_evidence',
  ].includes(conflict.status);
  const canEnterExistingEvaluation = (
    issues.length === 0 &&
    conflictAllowsHandoff &&
    supportedByRuntime &&
    primaryEvidence.length > 0
  );
  const evaluationInputMode = canEnterExistingEvaluation
    ? 'quality_aware_primary_evidence'
    : 'legacy_full_evidence';
  const limitations = uniqueStrings([
    ...(conflict?.limitations || []),
    ...(!supportedByRuntime
      ? ['Current Evaluation Runtime does not support all required Phase 14 capabilities.']
      : []),
    ...(!canEnterExistingEvaluation
      ? ['Quality-aware handoff is blocked; legacy Evidence semantics were not silently replaced.']
      : []),
  ]);
  const adapterResultId = buildStableId('evaluation-context', [
    conflict?.conflictAssessmentId || 'unknown-conflict',
    runtime?.runtimeId || 'unknown-runtime',
    runtime?.runtimeVersion || 'unknown-version',
    evaluationInputMode,
    ...requiredCapabilities,
    ...rawIds,
  ]);

  const result: EvaluationContextEnvelope = {
    adapterResultId,
    studentId: conflict?.studentId || 'unknown-student',
    targetAbilityId: conflict?.abilityId || 'unknown-ability',
    rawEvidence,
    primaryEvaluationEvidence: primaryEvidence,
    supportingContextEvidence: supportingEvidence,
    observationUnits: conflict?.observationUnits || [],
    conflictAssessment: conflict,
    blockedEvidenceIds: uniqueSorted([...blockedSet]),
    reviewRequiredEvidenceIds: uniqueSorted([...reviewSet]),
    qualityAssessmentIds: uniqueSorted(currentAssessments.map((item) => item.assessmentId)),
    observationUnitIds: uniqueSorted((conflict?.observationUnits || []).map((unit) => unit.observationUnitId)),
    evaluationInputMode,
    requiredEvaluationCapabilities: requiredCapabilities,
    supportedEvaluationCapabilities: supportedCapabilities,
    supportedByCurrentEvaluationRuntime: supportedByRuntime,
    qualityProtectionApplied: canEnterExistingEvaluation,
    limitations,
    canEnterExistingEvaluation,
    schemaVersion: EVALUATION_CONTEXT_ENVELOPE_SCHEMA_VERSION,
    validation: {
      passed: issues.length === 0,
      issues: uniqueStrings(issues),
    },
  };

  if (isEvaluationContextEnvelope(result)) return result;

  return {
    ...result,
    canEnterExistingEvaluation: false,
    qualityProtectionApplied: false,
    evaluationInputMode: 'legacy_full_evidence',
    validation: {
      passed: false,
      issues: uniqueStrings([...issues, 'EvaluationContextEnvelope schema validation failed.']),
    },
  };
}

function validateInput(input: EvaluationContextAdapterInput, rawEvidence: AbilityEvidence[]): string[] {
  const issues: string[] = [];
  if (!Array.isArray(input.rawEvidence) || input.rawEvidence.length === 0) {
    issues.push('rawEvidence must contain at least one AbilityEvidence.');
  }
  if (!input.rawEvidence.every(isAbilityEvidence)) issues.push('rawEvidence schema validation failed.');
  if (!input.conflictAssessment?.validation?.passed) issues.push('EvidenceConflictAssessment validation did not pass.');
  if (!isEvaluationRuntimeContract(input.runtimeContract)) issues.push('Evaluation Runtime Contract is invalid.');
  if (!input.currentQualityAssessments.every(isEvidenceQualityAssessment)) {
    issues.push('EvidenceQualityAssessment schema validation failed.');
  }
  if (rawEvidence.some((item) => item.studentId !== input.conflictAssessment?.studentId)) {
    issues.push('rawEvidence studentId mismatch.');
  }
  if (rawEvidence.some((item) => item.ability !== input.conflictAssessment?.abilityId)) {
    issues.push('rawEvidence ability mismatch.');
  }
  const linked = new Set(input.conflictAssessment?.evidenceLinks || []);
  if (rawEvidence.some((item) => !linked.has(item.id))) {
    issues.push('rawEvidence contains Evidence not linked by EvidenceConflictAssessment.');
  }
  const currentIds = new Set(input.conflictAssessment?.currentQualityAssessmentIds || []);
  if ([...currentIds].some((id) => !input.currentQualityAssessments.some((item) => item.assessmentId === id))) {
    issues.push('Current EvidenceQualityAssessment is missing from Adapter input.');
  }
  return uniqueStrings(issues);
}

function deriveRequiredCapabilities(status: string | undefined): EvaluationCapability[] {
  if (status === 'explainable_mixed_evidence') {
    return ['quality_context', 'conflict_context', 'limited_evidence'];
  }
  if (status === 'unresolved_conflict') {
    return [
      'quality_context',
      'conflict_context',
      'do_not_resolve_conflict_automatically',
    ];
  }
  if (status === 'insufficient_comparable_evidence') {
    return ['quality_context', 'limited_evidence'];
  }
  if (['aligned_positive_evidence', 'aligned_weakness_evidence'].includes(status || '')) {
    return ['quality_context'];
  }
  return [];
}

function selectPrimaryEvidenceIds(
  units: EvaluationContextEnvelope['observationUnits'],
  evidenceById: Map<string, AbilityEvidence>,
): string[] {
  return uniqueSorted(units
    .filter((unit) => (
      unit.effectiveEligibility === 'eligible' &&
      ['positive_signal', 'weakness_signal'].includes(unit.direction)
    ))
    .map((unit) => {
      const candidates = unit.evidenceIds
        .map((id) => evidenceById.get(id))
        .filter(isAbilityEvidence)
        .sort((left, right) => {
          const leftRank = representativeRank(left);
          const rightRank = representativeRank(right);
          return leftRank - rightRank || left.id.localeCompare(right.id);
        });
      return candidates[0]?.id || '';
    })
    .filter(Boolean));
}

function representativeRank(evidence: AbilityEvidence): number {
  if (evidence.evidenceType === 'weakness') return 0;
  if (evidence.evidenceType === 'growth') return 1;
  if (evidence.evidenceType === 'positive') return 2;
  return 3;
}

function resolveCurrentAssessments(
  currentIds: string[],
  assessments: EvidenceQualityAssessment[],
): EvidenceQualityAssessment[] {
  const byId = new Map(assessments.map((assessment) => [assessment.assessmentId, assessment]));
  return uniqueSorted(currentIds)
    .map((id) => byId.get(id))
    .filter(isEvidenceQualityAssessment);
}

function dedupeEvidence(evidence: AbilityEvidence[]): AbilityEvidence[] {
  const byId = new Map<string, AbilityEvidence>();
  for (const item of evidence || []) {
    if (isAbilityEvidence(item) && !byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function uniqueCapabilities(values: EvaluationCapability[]): EvaluationCapability[] {
  return [...new Set(values)].sort();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function buildStableId(prefix: string, parts: string[]): string {
  const text = parts.join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}
