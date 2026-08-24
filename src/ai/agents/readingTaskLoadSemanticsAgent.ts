import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type {
  MaterialObservationPlanningCandidate,
} from '../schemas/materialObservationDraftGenerator.schema.ts';
import type { QuestionResponseFormat } from '../schemas/questionResourceAdmission.schema.ts';
import type { TrainingTaskSequencePlanningResult } from
  '../schemas/trainingTaskSequencePlanning.schema.ts';
import type { TextResponseLoadPlanningIntent } from
  '../schemas/readingOpenResponseGenerationPlanning.schema.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  type CanonicalTextResponseAction,
  type TextResponseLoadLevel,
  type TextResponseLoadProfile,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import {
  READING_LOAD_RESPONSIBILITIES,
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
  type ReadingLoadResponsibility,
  type TaskLoadSequenceRole,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import {
  TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
  TASK_LOAD_SEMANTICS_VERIFICATION_VERSION,
  calculateTaskLoadSemanticsHash,
  isTaskLoadSemantics,
  type TaskLoadSemantics,
  type TaskLoadSemanticsVerification,
  type TaskLoadSemanticsVerificationFindingCode,
  type RecomputedTaskLoadContentProjection,
} from '../schemas/readingTaskLoadSemantics.schema.ts';

const LOAD_LEVEL_RANK: Record<TextResponseLoadLevel, number> = {
  entry_short: 0,
  focused_short: 1,
  developing: 2,
  integrated: 3,
};

export function buildPlannedTaskLoadSemantics(input: {
  candidate: MaterialObservationPlanningCandidate;
  materialVersionId: string;
  sequencePlanningResult: TrainingTaskSequencePlanningResult;
  taskRole?: RecommendedTaskRole;
}): TaskLoadSemantics {
  const { candidate } = input;
  const responseFormat = candidate.questionDraft.responseFormat;
  const taskRole = input.taskRole || 'training';
  const loadPlanning = candidate.textResponseLoadPlanning;
  const textProfile = responseFormat === 'single_choice'
    ? undefined
    : loadPlanning?.trace.finalProfile || profileFromPlanningIntent(loadPlanning?.intent);
  const primaryAction = textProfile?.primaryAction
    || loadPlanning?.intent.primaryAction
    || actionForAbility(candidate.primaryAbilityId);
  const supportingAction = textProfile?.supportingAction
    || loadPlanning?.intent.supportingAction;
  const sequenceRole = resolveSequenceRole({
    candidate,
    taskRole,
    sequencePlanningResult: input.sequencePlanningResult,
    textLoadLevel: textProfile?.loadLevel,
  });
  const semantics: TaskLoadSemantics = {
    schemaVersion: TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    observationThreadId: buildObservationThreadId({
      materialVersionId: input.materialVersionId,
      abilityId: candidate.primaryAbilityId,
      dimension: candidate.observationDimension,
      focus: candidate.observationFocus.displayName,
      startParagraph: candidate.materialAnchor.startParagraph,
      endParagraph: candidate.materialAnchor.endParagraph,
    }),
    sequenceRole,
    primaryAction,
    supportingAction: supportingAction === primaryAction ? undefined : supportingAction,
    responsibilities: responsibilitiesFor(sequenceRole),
    textResponseLoadProfile: textProfile,
    derivationSource: 'planned',
    confidence: textProfile || responseFormat === 'single_choice' ? 'high' : 'medium',
  };
  if (!isTaskLoadSemantics(semantics, responseFormat)) {
    throw new Error(`task_load_semantics_planning_failed:${candidate.candidateId}`);
  }
  return semantics;
}

/**
 * Historical tasks receive an isolated projection for Candidate verification only.
 * The isolated thread prevents accidental comparison with native Stage 1 threads.
 */
export function buildLegacyTaskLoadSemantics(input: {
  trainingTaskId: string;
  responseFormat: QuestionResponseFormat;
  primaryAction: CanonicalTextResponseAction;
  textResponseLoadProfile?: TextResponseLoadProfile;
}): TaskLoadSemantics {
  const sequenceRole = input.responseFormat === 'single_choice'
    ? 'foundation_entry'
    : sequenceRoleForLoadLevel(input.textResponseLoadProfile?.loadLevel);
  return {
    schemaVersion: TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    observationThreadId: `thread:legacy-isolated:${stableHash(input.trainingTaskId)}`,
    sequenceRole,
    primaryAction: input.textResponseLoadProfile?.primaryAction || input.primaryAction,
    supportingAction: input.textResponseLoadProfile?.supportingAction,
    responsibilities: responsibilitiesFor(sequenceRole),
    textResponseLoadProfile: input.responseFormat === 'single_choice'
      ? undefined
      : input.textResponseLoadProfile,
    derivationSource: 'legacy_projection',
    confidence: input.textResponseLoadProfile ? 'medium' : 'low',
  };
}

export function verifyTaskLoadSemantics(input: {
  trainingTaskId: string;
  candidateId?: string;
  plannedSemantics?: TaskLoadSemantics;
  plannedSemanticsHash?: string;
  candidateSemantics?: TaskLoadSemantics;
  responseFormat: QuestionResponseFormat;
  recomputedTextResponseLoadProfile?: TextResponseLoadProfile;
}): TaskLoadSemanticsVerification {
  const findingCodes: TaskLoadSemanticsVerificationFindingCode[] = [];
  const planned = input.plannedSemantics;
  const candidate = input.candidateSemantics || planned;
  if (!planned) findingCodes.push('semantics_missing');
  else if (!isTaskLoadSemantics(planned, input.responseFormat)) {
    findingCodes.push('response_format_incompatible');
  }
  const actualPlannedHash = planned ? calculateTaskLoadSemanticsHash(planned) : '';
  if (planned && input.plannedSemanticsHash
    && input.plannedSemanticsHash !== actualPlannedHash) {
    findingCodes.push('semantics_hash_mismatch');
  }
  if (candidate && !isTaskLoadSemantics(candidate, input.responseFormat)) {
    findingCodes.push('response_format_incompatible');
  }
  if (planned && candidate
    && planned.observationThreadId !== candidate.observationThreadId) {
    findingCodes.push('observation_thread_mismatch');
  }
  const recomputed = input.recomputedTextResponseLoadProfile;
  if (candidate && recomputed) {
    if (candidate.primaryAction !== recomputed.primaryAction) {
      findingCodes.push('primary_action_drift');
    }
    if (recomputed.supportingAction
      && candidate.supportingAction
      && recomputed.supportingAction !== candidate.supportingAction) {
      findingCodes.push('supporting_action_overflow');
    }
    const plannedLevel = candidate.textResponseLoadProfile?.loadLevel;
    if (plannedLevel && LOAD_LEVEL_RANK[recomputed.loadLevel] > LOAD_LEVEL_RANK[plannedLevel]) {
      findingCodes.push('text_load_exceeds_plan');
    }
  }
  if (candidate?.derivationSource === 'legacy_projection') {
    findingCodes.push('legacy_projection_only');
  }
  const uniqueFindingCodes = [...new Set(findingCodes)];
  const failed = uniqueFindingCodes.some((finding) => [
    'semantics_hash_mismatch',
    'response_format_incompatible',
    'primary_action_drift',
    'text_load_exceeds_plan',
    'observation_thread_mismatch',
  ].includes(finding));
  const insufficient = uniqueFindingCodes.includes('semantics_missing');
  const projection: RecomputedTaskLoadContentProjection | undefined = candidate
    ? {
      primaryAction: recomputed?.primaryAction || candidate.primaryAction,
      supportingAction: recomputed?.supportingAction || candidate.supportingAction,
      responsibilities: [...candidate.responsibilities],
      textResponseLoadProfile: recomputed,
      confidence: recomputed ? 'high' : candidate.confidence,
    }
    : undefined;
  return {
    schemaVersion: TASK_LOAD_SEMANTICS_VERIFICATION_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    trainingTaskId: input.trainingTaskId,
    candidateId: input.candidateId,
    plannedSemanticsHash: input.plannedSemanticsHash || actualPlannedHash || 'missing',
    recomputedContentProjection: projection,
    status: insufficient
      ? 'insufficient_input'
      : failed ? 'mismatched' : uniqueFindingCodes.length > 0 ? 'advisory' : 'matched',
    findings: uniqueFindingCodes.map(findingDetail),
  };
}

function findingDetail(code: TaskLoadSemanticsVerificationFindingCode) {
  const details: Record<TaskLoadSemanticsVerificationFindingCode, {
    severity: 'info' | 'warning' | 'error';
    evidencePaths: string[];
    explanation: string;
  }> = {
    semantics_missing: { severity: 'warning', evidencePaths: ['taskLoadSemantics'], explanation: '上游任务未提供可校验的负担语义。' },
    semantics_hash_mismatch: { severity: 'error', evidencePaths: ['taskLoadSemanticsHash'], explanation: '候选继承的负担语义哈希与任务权威值不一致。' },
    response_format_incompatible: { severity: 'error', evidencePaths: ['content.responseFormat', 'taskLoadSemantics.textResponseLoadProfile'], explanation: '作答形式与负担语义结构不兼容。' },
    primary_action_drift: { severity: 'error', evidencePaths: ['content.questionStem', 'taskLoadSemantics.primaryAction'], explanation: '候选题面表现出的主要动作偏离任务规划。' },
    supporting_action_overflow: { severity: 'warning', evidencePaths: ['content.questionStem', 'taskLoadSemantics.supportingAction'], explanation: '候选题面出现了规划之外的支撑动作。' },
    text_load_exceeds_plan: { severity: 'error', evidencePaths: ['content', 'taskLoadSemantics.textResponseLoadProfile.loadLevel'], explanation: '候选文本作答负担高于任务规划。' },
    observation_thread_mismatch: { severity: 'error', evidencePaths: ['taskLoadSemantics.observationThreadId'], explanation: '候选与任务不属于同一观察线程。' },
    legacy_projection_only: { severity: 'info', evidencePaths: ['taskLoadSemantics.derivationSource'], explanation: '当前语义来自历史兼容投影，不作为原生相邻层级证据。' },
  };
  return { code, ...details[code] };
}

function resolveSequenceRole(input: {
  candidate: MaterialObservationPlanningCandidate;
  taskRole: RecommendedTaskRole;
  sequencePlanningResult: TrainingTaskSequencePlanningResult;
  textLoadLevel?: TextResponseLoadLevel;
}): TaskLoadSequenceRole {
  if (input.taskRole === 'retest' || input.taskRole === 'transfer') {
    return 'independent_validation';
  }
  if (input.candidate.questionDraft.responseFormat === 'single_choice') {
    return input.sequencePlanningResult.preludeCandidateIds.includes(input.candidate.candidateId)
      ? 'foundation_entry'
      : 'bridge';
  }
  return sequenceRoleForLoadLevel(input.textLoadLevel);
}

function sequenceRoleForLoadLevel(level?: TextResponseLoadLevel): TaskLoadSequenceRole {
  if (level === 'entry_short') return 'foundation_entry';
  if (level === 'focused_short') return 'bridge';
  if (level === 'developing') return 'development';
  return 'integration';
}

function responsibilitiesFor(role: TaskLoadSequenceRole): ReadingLoadResponsibility[] {
  if (role === 'foundation_entry') return ['basic_understanding'];
  if (role === 'bridge') return ['basic_understanding', 'text_evidence'];
  if (role === 'development') {
    return ['basic_understanding', 'text_evidence', 'relation_explanation'];
  }
  if (role === 'integration') return [...READING_LOAD_RESPONSIBILITIES];
  return ['basic_understanding', 'text_evidence', 'relation_explanation'];
}

function actionForAbility(abilityId: string): CanonicalTextResponseAction {
  if (abilityId === 'extraction') return 'locate_information';
  if (abilityId === 'summarization') return 'summarize_content';
  if (abilityId === 'analysis') return 'identify_relation';
  if (abilityId === 'inference') return 'infer_from_evidence';
  if (abilityId === 'expression') return 'evaluate_expression';
  return 'explain_local_meaning';
}

function profileFromPlanningIntent(
  intent: TextResponseLoadPlanningIntent | undefined,
): TextResponseLoadProfile | undefined {
  if (!intent) return undefined;
  return {
    policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
    loadLevel: intent.targetLoadLevel,
    primaryAction: intent.primaryAction,
    supportingAction: intent.supportingAction,
    requiredEvidenceUnitCount: intent.evidenceScope.requiredEvidenceUnitCount,
    requiredRelationCount: intent.requiredRelationCount,
    requiredObjectCount: intent.requiredObjectCount,
    expectedAnswerLengthBand: { ...intent.expectedAnswerLengthBand },
    compositeLoadReasons: [],
  };
}

function buildObservationThreadId(input: {
  materialVersionId: string;
  abilityId: string;
  dimension: string;
  focus: string;
  startParagraph?: number;
  endParagraph?: number;
}): string {
  return `thread:${stableHash([
    input.materialVersionId,
    input.abilityId,
    input.dimension,
    input.focus.trim(),
    String(input.startParagraph || ''),
    String(input.endParagraph || ''),
  ].join('|'))}`;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
