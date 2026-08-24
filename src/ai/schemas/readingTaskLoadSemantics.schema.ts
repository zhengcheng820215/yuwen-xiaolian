import type { QuestionResponseFormat } from './questionResourceAdmission.schema.ts';
import {
  isCanonicalTextResponseAction,
  isTextResponseLoadProfile,
  type CanonicalTextResponseAction,
  type TextResponseLoadProfile,
} from './readingOpenResponseInputLoad.schema.ts';
import {
  READING_LOAD_RESPONSIBILITIES,
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
  TASK_LOAD_SEQUENCE_ROLES,
  type ReadingLoadResponsibility,
  type TaskLoadProjectionConfidence,
  type TaskLoadSequenceRole,
} from './readingTrainingProgressionAudit.schema.ts';

export const TASK_LOAD_SEMANTICS_SCHEMA_VERSION =
  'reading_task_load_semantics_v1' as const;
export const TASK_LOAD_SEMANTICS_VERIFICATION_VERSION =
  'reading_task_load_semantics_verification_v1' as const;

export type TaskLoadSemanticsDerivationSource =
  | 'planned'
  | 'recomputed'
  | 'legacy_projection';

/**
 * Native Stage 1 load semantics shared by Plan, TrainingTask and Candidate.
 * This is content/governance metadata. It is not a student ability label.
 */
export type TaskLoadSemantics = {
  schemaVersion: typeof TASK_LOAD_SEMANTICS_SCHEMA_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  observationThreadId: string;
  sequenceRole: TaskLoadSequenceRole;
  primaryAction: CanonicalTextResponseAction;
  supportingAction?: CanonicalTextResponseAction;
  responsibilities: ReadingLoadResponsibility[];
  textResponseLoadProfile?: TextResponseLoadProfile;
  derivationSource: TaskLoadSemanticsDerivationSource;
  confidence: TaskLoadProjectionConfidence;
};

export type RecomputedTaskLoadContentProjection = {
  primaryAction: CanonicalTextResponseAction;
  supportingAction?: CanonicalTextResponseAction;
  responsibilities: ReadingLoadResponsibility[];
  textResponseLoadProfile?: TextResponseLoadProfile;
  confidence: TaskLoadProjectionConfidence;
};

export const TASK_LOAD_SEMANTICS_VERIFICATION_FINDING_CODES = [
  'semantics_missing',
  'semantics_hash_mismatch',
  'response_format_incompatible',
  'primary_action_drift',
  'supporting_action_overflow',
  'text_load_exceeds_plan',
  'observation_thread_mismatch',
  'legacy_projection_only',
] as const;

export type TaskLoadSemanticsVerificationFindingCode =
  typeof TASK_LOAD_SEMANTICS_VERIFICATION_FINDING_CODES[number];

export type TaskLoadSemanticsVerification = {
  schemaVersion: typeof TASK_LOAD_SEMANTICS_VERIFICATION_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  trainingTaskId: string;
  candidateId?: string;
  plannedSemanticsHash: string;
  recomputedContentProjection?: RecomputedTaskLoadContentProjection;
  status: 'matched' | 'advisory' | 'mismatched' | 'insufficient_input';
  findings: Array<{
    code: TaskLoadSemanticsVerificationFindingCode;
    severity: 'info' | 'warning' | 'error';
    evidencePaths: string[];
    explanation: string;
  }>;
};

export function isTaskLoadSemantics(
  value: unknown,
  responseFormat?: QuestionResponseFormat,
): value is TaskLoadSemantics {
  if (!value || typeof value !== 'object') return false;
  const semantics = value as TaskLoadSemantics;
  const actionsAreDistinct = semantics.supportingAction === undefined
    || semantics.supportingAction !== semantics.primaryAction;
  const responsibilitiesAreValid = Array.isArray(semantics.responsibilities)
    && semantics.responsibilities.length > 0
    && semantics.responsibilities.every((item) => (
      (READING_LOAD_RESPONSIBILITIES as readonly string[]).includes(item)
    ))
    && new Set(semantics.responsibilities).size === semantics.responsibilities.length;
  const textProfileIsValid = semantics.textResponseLoadProfile === undefined
    || isTextResponseLoadProfile(semantics.textResponseLoadProfile);
  const responseFormatIsCompatible = responseFormat === undefined
    || (responseFormat === 'single_choice'
      ? semantics.textResponseLoadProfile === undefined
      : semantics.textResponseLoadProfile !== undefined);

  return semantics.schemaVersion === TASK_LOAD_SEMANTICS_SCHEMA_VERSION
    && semantics.policyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && Boolean(semantics.observationThreadId?.trim())
    && (TASK_LOAD_SEQUENCE_ROLES as readonly string[]).includes(semantics.sequenceRole)
    && isCanonicalTextResponseAction(semantics.primaryAction)
    && (semantics.supportingAction === undefined
      || isCanonicalTextResponseAction(semantics.supportingAction))
    && actionsAreDistinct
    && responsibilitiesAreValid
    && textProfileIsValid
    && responseFormatIsCompatible
    && ['planned', 'recomputed', 'legacy_projection'].includes(semantics.derivationSource)
    && ['high', 'medium', 'low'].includes(semantics.confidence);
}

export function normalizeTaskLoadSemantics(
  semantics: TaskLoadSemantics,
): TaskLoadSemantics {
  return {
    ...semantics,
    observationThreadId: semantics.observationThreadId.trim(),
    responsibilities: READING_LOAD_RESPONSIBILITIES.filter((responsibility) => (
      semantics.responsibilities.includes(responsibility)
    )),
    textResponseLoadProfile: semantics.textResponseLoadProfile
      ? structuredCloneSafe(semantics.textResponseLoadProfile)
      : undefined,
  };
}

export function cloneTaskLoadSemantics(
  semantics: TaskLoadSemantics | undefined,
): TaskLoadSemantics | undefined {
  return semantics ? normalizeTaskLoadSemantics(structuredCloneSafe(semantics)) : undefined;
}

/** Confidence is deliberately excluded: changing confidence must not change identity. */
export function calculateTaskLoadSemanticsHash(semantics: TaskLoadSemantics): string {
  const normalized = normalizeTaskLoadSemantics(semantics);
  return `task-load-${fnv1a(stableStringify({
    schemaVersion: normalized.schemaVersion,
    policyVersion: normalized.policyVersion,
    observationThreadId: normalized.observationThreadId,
    sequenceRole: normalized.sequenceRole,
    primaryAction: normalized.primaryAction,
    supportingAction: normalized.supportingAction,
    responsibilities: normalized.responsibilities,
    textResponseLoadProfile: normalized.textResponseLoadProfile,
    derivationSource: normalized.derivationSource,
  }))}`;
}

export function isTaskLoadSemanticsVerification(
  value: unknown,
): value is TaskLoadSemanticsVerification {
  if (!value || typeof value !== 'object') return false;
  const verification = value as TaskLoadSemanticsVerification;
  return verification.schemaVersion === TASK_LOAD_SEMANTICS_VERIFICATION_VERSION
    && verification.policyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && Boolean(verification.trainingTaskId?.trim())
    && ['matched', 'advisory', 'mismatched', 'insufficient_input'].includes(verification.status)
    && Boolean(verification.plannedSemanticsHash?.trim())
    && Array.isArray(verification.findings)
    && verification.findings.every((finding) => (
      (TASK_LOAD_SEMANTICS_VERIFICATION_FINDING_CODES as readonly string[])
        .includes(finding.code)
      && ['info', 'warning', 'error'].includes(finding.severity)
      && Array.isArray(finding.evidencePaths)
      && Boolean(finding.explanation?.trim())
    ));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
