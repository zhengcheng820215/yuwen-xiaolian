import {
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  isTextResponseFormat,
  type TextResponseLoadFindingCode,
  type TextResponseLoadProfile,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import {
  READING_OPEN_RESPONSE_LOAD_GATE_VERSION,
  type ReadingOpenResponseLoadAdvisoryCode,
  type ReadingOpenResponseLoadBlockerCode,
  type ReadingOpenResponseLoadGateAssessment,
} from '../schemas/readingOpenResponseLoadGate.schema.ts';
import {
  isTextResponseCandidateGenerationTrace,
  type TextResponseCandidateGenerationTrace,
} from '../schemas/readingOpenResponseGenerationPlanning.schema.ts';
import type { TextMinimumAnswerRequirement } from
  '../schemas/questionResourceAdmission.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import { analyzeReadingOpenResponseInputLoad } from
  './readingOpenResponseInputLoadAnalyzer.ts';

export type ReadingOpenResponseLoadGateInput = {
  subject: {
    kind: 'candidate' | 'draft_revision';
    subjectId: string;
    revision?: number;
  };
  trainingTaskId: string;
  content: QuestionEditableFields;
  generationTrace?: TextResponseCandidateGenerationTrace;
  requireGenerationTrace?: boolean;
  sourceAnchorIds?: string[];
  sourceEvidenceCharacterCount?: number;
  assessedAt?: string;
};

const FINDING_TO_BLOCKER: Partial<Record<
  TextResponseLoadFindingCode,
  ReadingOpenResponseLoadBlockerCode
>> = {
  composite_core_actions: 'composite_core_actions',
  hidden_rubric_requirement: 'required_rubric_not_in_stem',
  evidence_scope_insufficient: 'material_evidence_insufficient',
  response_format_load_mismatch: 'response_format_load_mismatch',
  minimum_length_overweighted: 'minimum_requirement_overweighted',
};

export function assessReadingOpenResponseLoadGate(
  input: ReadingOpenResponseLoadGateInput,
): ReadingOpenResponseLoadGateAssessment | null {
  if (!isTextResponseFormat(input.content.responseFormat)) return null;

  const contentHash = calculateQuestionEditableFieldsHash(input.content);
  const anchors = uniqueStrings(input.sourceAnchorIds || readSourceAnchorIds(input.content.tags));
  const traceValid = isTextResponseCandidateGenerationTrace(input.generationTrace)
    && input.generationTrace.outcome === 'candidate_created';
  const trace = traceValid ? input.generationTrace : undefined;
  const audit = analyzeReadingOpenResponseInputLoad({
    questionVersionId: input.subject.subjectId,
    materialVersionId: input.content.materialVersionId,
    title: input.content.title,
    questionStem: input.content.questionStem,
    responseFormat: input.content.responseFormat,
    rubric: input.content.rubric,
    minimumAnswerRequirement: input.content.minimumAnswerRequirement as TextMinimumAnswerRequirement,
    abilityMetadata: input.content.abilityMetadata,
    expectedStudentAction: trace?.planningIntent.responseObject,
    sourceAnchorIds: anchors,
    sourceEvidenceCharacterCount: input.sourceEvidenceCharacterCount,
    tags: input.content.tags,
  });
  if (!audit?.profile) {
    throw new Error('Reading open-response load gate requires a complete text load profile.');
  }

  const blockers = new Set<ReadingOpenResponseLoadBlockerCode>();
  const advisories = new Set<ReadingOpenResponseLoadAdvisoryCode>();
  const evidencePaths = new Set<string>();

  if (input.requireGenerationTrace && !trace) {
    blockers.add('planning_trace_missing_or_stale');
    evidencePaths.add('generationTrace');
  }
  audit.findings.forEach((finding) => {
    const blocker = FINDING_TO_BLOCKER[finding.code];
    if (blocker) blockers.add(blocker);
    finding.evidencePaths.forEach((path) => evidencePaths.add(path));
  });

  if (trace && !loadIdentityMatches(trace, audit.profile, input)) {
    blockers.add('load_identity_mismatch');
    evidencePaths.add('generationTrace.planningIntent');
    evidencePaths.add('recomputedLoadProfile');
  }

  if (hasHintCreatedTask(input.content)) {
    blockers.add('hint_creates_hidden_task');
    evidencePaths.add('tags.pre_answer_hint');
  }

  const max = audit.profile.expectedAnswerLengthBand.recommendedMax;
  const min = audit.profile.expectedAnswerLengthBand.recommendedMin;
  const requiredMin = Number(input.content.minimumAnswerRequirement.minLength || 0);
  if (requiredMin > 0 && (requiredMin === min || requiredMin === max)) {
    advisories.add('length_band_boundary');
  }
  if (
    audit.profile.supportingAction
    && audit.profile.requiredRelationCount !== 0
    && blockers.size === 0
  ) {
    advisories.add('related_actions_near_boundary');
  }
  if (
    input.content.answerAcceptance?.semanticEquivalentAllowed
    && (input.content.answerAcceptance.acceptedKeywords?.length || 0) >= 4
  ) {
    advisories.add('answer_acceptance_needs_calibration');
  }

  const blockerCodes = [...blockers].sort();
  const advisoryCodes = [...advisories].sort();
  const assessedAt = input.assessedAt || new Date().toISOString();
  return {
    assessmentId: `load-gate:${stableHash({
      subject: input.subject,
      trainingTaskId: input.trainingTaskId,
      contentHash,
      gateRuleVersion: READING_OPEN_RESPONSE_LOAD_GATE_VERSION,
    })}`,
    subject: {
      ...input.subject,
      contentHash,
    },
    materialVersionId: input.content.materialVersionId,
    trainingTaskId: input.trainingTaskId,
    responseFormat: input.content.responseFormat,
    ...(trace ? { generationPlanningVersion: trace.planningIntent.plannerVersion } : {}),
    inputLoadRuleVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
    gateRuleVersion: READING_OPEN_RESPONSE_LOAD_GATE_VERSION,
    recomputedLoadProfile: audit.profile,
    decision: blockerCodes.length > 0
      ? 'blocked'
      : advisoryCodes.length > 0 ? 'pass_with_advisory' : 'pass',
    blockerCodes,
    advisoryCodes,
    evidencePaths: [...evidencePaths].sort(),
    assessedAt,
  };
}

export function isReadingOpenResponseLoadGateCurrent(input: {
  assessment?: ReadingOpenResponseLoadGateAssessment;
  content: QuestionEditableFields;
  trainingTaskId: string;
}): boolean {
  const assessment = input.assessment;
  return Boolean(
    assessment
    && assessment.gateRuleVersion === READING_OPEN_RESPONSE_LOAD_GATE_VERSION
    && assessment.trainingTaskId === input.trainingTaskId
    && assessment.materialVersionId === input.content.materialVersionId
    && assessment.subject.contentHash === calculateQuestionEditableFieldsHash(input.content),
  );
}

function loadIdentityMatches(
  trace: TextResponseCandidateGenerationTrace,
  profile: TextResponseLoadProfile,
  input: ReadingOpenResponseLoadGateInput,
): boolean {
  const intent = trace.planningIntent;
  const finalProfile = trace.finalProfile;
  return intent.sourceIdentity.materialVersionId === input.content.materialVersionId
    && (!intent.sourceIdentity.trainingTaskId
      || intent.sourceIdentity.trainingTaskId === input.trainingTaskId)
    && intent.preferredResponseFormat === input.content.responseFormat
    && intent.primaryAction === profile.primaryAction
    && intent.targetLoadLevel === profile.loadLevel
    && (!finalProfile || (
      finalProfile.loadLevel === profile.loadLevel
      && finalProfile.primaryAction === profile.primaryAction
      && finalProfile.requiredEvidenceUnitCount === profile.requiredEvidenceUnitCount
      && finalProfile.requiredRelationCount === profile.requiredRelationCount
      && finalProfile.requiredObjectCount === profile.requiredObjectCount
    ));
}

function readSourceAnchorIds(tags: string[]): string[] {
  return tags.filter((tag) => (
    tag.startsWith('source_anchor:')
    || tag.startsWith('paragraph:')
    || tag.startsWith('material_scope:')
  ));
}

function hasHintCreatedTask(content: QuestionEditableFields): boolean {
  const hintTag = content.tags.find((tag) => tag.startsWith('pre_answer_hint:'));
  if (!hintTag) return false;
  const hint = hintTag.slice('pre_answer_hint:'.length);
  const stem = content.questionStem;
  const actionWords = ['比较', '概括', '分析', '推断', '说明原因', '找出证据'];
  return actionWords.some((word) => hint.includes(word) && !stem.includes(word));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort();
}

export function stableHash(value: unknown): string {
  const serialized = JSON.stringify(normalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, normalize(child)]));
}
