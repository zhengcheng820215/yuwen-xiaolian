import type { DiagnosisRunRecord, FormalDiagnosisCommit } from
  '../schemas/diagnosisRunRecord.schema.ts';
import type {
  QuestionResourceRubricItem,
  QuestionResponseFormat,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import {
  RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION,
  isRubricFeedbackProjection,
  type RubricFeedbackObservedGap,
  type RubricFeedbackProjection,
  type RubricFeedbackProjectionItem,
} from '../schemas/rubricFeedbackProjection.schema.ts';
import type { TaskRequirementCoverage } from
  '../schemas/studentLearningFeedback.schema.ts';

export const RUBRIC_ALIGNED_FEEDBACK_STAGE1_VERSION =
  'rubric_aligned_feedback_stage1_v1' as const;

export const RUBRIC_FEEDBACK_PROJECTION_ISSUE_CODES = [
  'single_choice_uses_independent_feedback_contract',
  'response_format_not_supported',
  'formal_diagnosis_not_committed',
  'question_identity_mismatch',
  'diagnosis_identity_mismatch',
  'runtime_identity_mismatch',
  'response_identity_missing',
  'rubric_identity_invalid',
  'rubric_requirement_binding_missing',
  'rubric_requirement_binding_invalid',
  'coverage_source_not_formal',
  'coverage_evidence_missing',
  'coverage_gap_not_structured',
  'primary_gap_not_actionable',
  'multiple_primary_candidates_ambiguous',
  'projection_validation_failed',
] as const;

export type RubricFeedbackProjectionIssueCode =
  typeof RUBRIC_FEEDBACK_PROJECTION_ISSUE_CODES[number];

export type RubricFeedbackProjectionIssue = {
  code: RubricFeedbackProjectionIssueCode;
  severity: 'info' | 'warning' | 'error';
  evidencePaths: string[];
};

export type RubricFeedbackProjectionBuildInput = {
  projectionContext: {
    questionVersionId: string;
    rubricVersion?: string;
    taskId: string;
    learningRoundId: string;
    executionSessionId: string;
    responseId: string;
    formalDiagnosisId: string;
  };
  responseFormat: QuestionResponseFormat;
  taskRole: RecommendedTaskRole;
  rubric: QuestionResourceRubricItem[];
  formalDiagnosisCommit: FormalDiagnosisCommit;
  diagnosisRunRecord: DiagnosisRunRecord;
  requirementCoverage: TaskRequirementCoverage[];
  primaryGapRequirementId?: string;
  verifiedStudentEvidenceRefs: Record<string, string[]>;
  rubricRequirementBindings?: Array<{
    rubricItemId: string;
    requirementId: string;
    bindingSource: 'frozen_contract' | 'formal_diagnosis';
  }>;
};

export type RubricFeedbackProjectionBuildResult = {
  stageVersion: typeof RUBRIC_ALIGNED_FEEDBACK_STAGE1_VERSION;
  outcome: 'projected' | 'limited' | 'not_assessable' | 'single_choice_passthrough';
  projection?: RubricFeedbackProjection;
  issues: RubricFeedbackProjectionIssue[];
};

type ProjectionCandidate = {
  item: RubricFeedbackProjectionItem;
  rubric: QuestionResourceRubricItem;
  decisiveRequirement?: TaskRequirementCoverage;
  earliestRequirementIndex: number;
  independentGapCount: number;
};

export function buildRubricFeedbackProjection(
  input: RubricFeedbackProjectionBuildInput,
): RubricFeedbackProjectionBuildResult {
  const issues: RubricFeedbackProjectionIssue[] = [];
  if (input.responseFormat === 'single_choice') {
    issues.push(issue(
      'single_choice_uses_independent_feedback_contract',
      'info',
      ['responseFormat'],
    ));
    return result('single_choice_passthrough', issues);
  }
  if (!['short_text', 'long_text'].includes(input.responseFormat)) {
    issues.push(issue('response_format_not_supported', 'warning', ['responseFormat']));
    return result('limited', issues);
  }

  if (!formalDiagnosisReady(input, issues)) return result('not_assessable', issues);
  if (!runtimeIdentityAligned(input, issues)) return result('not_assessable', issues);
  if (!rubricIdentityValid(input.rubric)) {
    issues.push(issue('rubric_identity_invalid', 'error', ['rubric']));
    return result('not_assessable', issues);
  }

  const coverageById = new Map(input.requirementCoverage.map((coverage) => (
    [coverage.requirementId, coverage]
  )));
  if (coverageById.size !== input.requirementCoverage.length) {
    issues.push(issue(
      'rubric_requirement_binding_invalid',
      'error',
      ['requirementCoverage'],
    ));
    return result('not_assessable', issues);
  }

  const bindings = validateBindings(input, coverageById, issues);
  const candidates = input.rubric.map((rubric, rubricIndex) => projectRubricItem({
    input,
    rubric,
    rubricIndex,
    requirementIds: bindings.get(rubric.itemId) || [],
    coverageById,
    issues,
  }));

  const assessedItems = candidates.filter((candidate) => (
    candidate.item.coverageStatus !== 'not_assessable'
  ));
  if (assessedItems.length === 0) {
    const projection = finalizeProjection(input, candidates, undefined, 'not_assessable');
    if (!isRubricFeedbackProjection(projection)) {
      issues.push(issue('projection_validation_failed', 'error', ['projection']));
      return result('not_assessable', issues);
    }
    return result('not_assessable', issues, projection);
  }

  const primary = selectPrimaryCandidate(input, candidates, issues);
  const hasActionableGap = candidates.some(isPrimaryEligible);
  const projectionStatus = candidates.some((candidate) => (
    candidate.item.coverageStatus === 'not_assessable'
  )) || (hasActionableGap && !primary)
    ? 'limited'
    : 'ready';
  const projection = finalizeProjection(
    input,
    candidates,
    primary?.item.rubricItemId,
    projectionStatus,
  );
  if (!isRubricFeedbackProjection(projection)) {
    issues.push(issue('projection_validation_failed', 'error', ['projection']));
    return result('not_assessable', issues);
  }
  return result(projectionStatus === 'ready' ? 'projected' : 'limited', issues, projection);
}

function formalDiagnosisReady(
  input: RubricFeedbackProjectionBuildInput,
  issues: RubricFeedbackProjectionIssue[],
): boolean {
  const commit = input.formalDiagnosisCommit;
  if (commit.status !== 'committed' || !commit.validation.passed || !commit.diagnosisResult) {
    issues.push(issue(
      'formal_diagnosis_not_committed',
      'error',
      ['formalDiagnosisCommit.status', 'formalDiagnosisCommit.validation'],
    ));
    return false;
  }
  if (commit.formalDiagnosisId !== input.projectionContext.formalDiagnosisId) {
    issues.push(issue(
      'diagnosis_identity_mismatch',
      'error',
      ['projectionContext.formalDiagnosisId', 'formalDiagnosisCommit.formalDiagnosisId'],
    ));
    return false;
  }
  return true;
}

function runtimeIdentityAligned(
  input: RubricFeedbackProjectionBuildInput,
  issues: RubricFeedbackProjectionIssue[],
): boolean {
  const context = input.projectionContext;
  const run = input.diagnosisRunRecord;
  const commit = input.formalDiagnosisCommit;
  if (!context.questionVersionId.trim()) {
    issues.push(issue('question_identity_mismatch', 'error', ['projectionContext.questionVersionId']));
    return false;
  }
  if (!context.responseId.trim()) {
    issues.push(issue('response_identity_missing', 'error', ['projectionContext.responseId']));
    return false;
  }
  const aligned = run.taskId === context.taskId
    && run.executionSessionId === context.executionSessionId
    && run.responseId === context.responseId
    && run.requestId === commit.requestId
    && run.runId === commit.runId;
  if (!aligned) {
    issues.push(issue(
      'runtime_identity_mismatch',
      'error',
      [
        'projectionContext.taskId',
        'projectionContext.executionSessionId',
        'projectionContext.responseId',
        'diagnosisRunRecord',
        'formalDiagnosisCommit',
      ],
    ));
  }
  return aligned;
}

function rubricIdentityValid(rubric: QuestionResourceRubricItem[]): boolean {
  if (rubric.length === 0) return false;
  const ids = rubric.map((item) => item.itemId.trim());
  return ids.every(Boolean) && new Set(ids).size === ids.length;
}

function validateBindings(
  input: RubricFeedbackProjectionBuildInput,
  coverageById: Map<string, TaskRequirementCoverage>,
  issues: RubricFeedbackProjectionIssue[],
): Map<string, string[]> {
  const rubricIds = new Set(input.rubric.map((item) => item.itemId));
  const result = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const binding of input.rubricRequirementBindings || []) {
    const identity = `${binding.rubricItemId}:${binding.requirementId}`;
    if (
      seen.has(identity)
      || !rubricIds.has(binding.rubricItemId)
      || !coverageById.has(binding.requirementId)
      || !['frozen_contract', 'formal_diagnosis'].includes(binding.bindingSource)
    ) {
      issues.push(issue(
        'rubric_requirement_binding_invalid',
        'error',
        ['rubricRequirementBindings'],
      ));
      continue;
    }
    seen.add(identity);
    result.set(binding.rubricItemId, [
      ...(result.get(binding.rubricItemId) || []),
      binding.requirementId,
    ]);
  }
  return result;
}

function projectRubricItem(input: {
  input: RubricFeedbackProjectionBuildInput;
  rubric: QuestionResourceRubricItem;
  rubricIndex: number;
  requirementIds: string[];
  coverageById: Map<string, TaskRequirementCoverage>;
  issues: RubricFeedbackProjectionIssue[];
}): ProjectionCandidate {
  const { rubric } = input;
  const sourceBase = {
    questionVersionId: input.input.projectionContext.questionVersionId,
    rubricVersion: input.input.projectionContext.rubricVersion,
    diagnosisId: input.input.projectionContext.formalDiagnosisId,
    responseId: input.input.projectionContext.responseId,
    taskId: input.input.projectionContext.taskId,
    learningRoundId: input.input.projectionContext.learningRoundId,
    executionSessionId: input.input.projectionContext.executionSessionId,
  };
  if (input.requirementIds.length === 0) {
    input.issues.push(issue(
      'rubric_requirement_binding_missing',
      'warning',
      [`rubric.${rubric.itemId}`],
    ));
    return candidate({
      rubric,
      item: {
        rubricItemId: rubric.itemId,
        importance: rubric.importance,
        coverageStatus: 'not_assessable',
        studentEvidenceRefs: [],
        taskRelation: rubric.description?.trim() || rubric.name,
        sourceLinks: sourceBase,
      },
    });
  }

  const boundCoverage = input.requirementIds
    .map((id) => input.coverageById.get(id))
    .filter((coverage): coverage is TaskRequirementCoverage => Boolean(coverage));
  const earliestRequirementIndex = Math.min(...boundCoverage.map((coverage) => (
    input.input.requirementCoverage.findIndex((item) => item.requirementId === coverage.requirementId)
  )));
  const statusProjection = projectCoverageStatus(input.input, boundCoverage, input.issues);
  const decisiveRequirement = selectDecisiveRequirement(boundCoverage);
  const observedGap = statusProjection === 'partially_achieved' || statusProjection === 'missing'
    ? mapObservedGap(input.input.requirementCoverage, decisiveRequirement)
    : undefined;
  const independentGapCount = unique(boundCoverage
    .map((coverage) => mapObservedGap(input.input.requirementCoverage, coverage))
    .filter((gap): gap is RubricFeedbackObservedGap => Boolean(gap))).length;
  const evidenceRefs = unique(boundCoverage.flatMap((coverage) => (
    input.input.verifiedStudentEvidenceRefs[coverage.requirementId] || []
  )));

  if (
    (statusProjection === 'achieved' || statusProjection === 'partially_achieved')
    && evidenceRefs.length === 0
  ) {
    input.issues.push(issue(
      'coverage_evidence_missing',
      'warning',
      [`requirementCoverage.${decisiveRequirement?.requirementId || rubric.itemId}`],
    ));
    return candidate({
      rubric,
      earliestRequirementIndex,
      decisiveRequirement,
      independentGapCount,
      item: {
        rubricItemId: rubric.itemId,
        requirementId: decisiveRequirement?.requirementId,
        importance: rubric.importance,
        coverageStatus: 'not_assessable',
        studentEvidenceRefs: [],
        taskRelation: rubric.description?.trim() || rubric.name,
        sourceLinks: {
          ...sourceBase,
          requirementId: decisiveRequirement?.requirementId,
        },
      },
    });
  }
  if (
    (statusProjection === 'partially_achieved' || statusProjection === 'missing')
    && !observedGap
  ) {
    input.issues.push(issue(
      'coverage_gap_not_structured',
      'warning',
      [`requirementCoverage.${decisiveRequirement?.requirementId || rubric.itemId}.gapReasonCode`],
    ));
    return candidate({
      rubric,
      earliestRequirementIndex,
      decisiveRequirement,
      independentGapCount,
      item: {
        rubricItemId: rubric.itemId,
        requirementId: decisiveRequirement?.requirementId,
        importance: rubric.importance,
        coverageStatus: 'not_assessable',
        studentEvidenceRefs: [],
        taskRelation: rubric.description?.trim() || rubric.name,
        sourceLinks: {
          ...sourceBase,
          requirementId: decisiveRequirement?.requirementId,
        },
      },
    });
  }

  return candidate({
    rubric,
    earliestRequirementIndex,
    decisiveRequirement,
    independentGapCount,
    item: {
      rubricItemId: rubric.itemId,
      requirementId: decisiveRequirement?.requirementId,
      importance: rubric.importance,
      coverageStatus: statusProjection,
      studentEvidenceRefs: evidenceRefs,
      taskRelation: rubric.description?.trim() || rubric.name,
      observedGap,
      nextThinkingAction: observedGap ? actionForGap(observedGap) : undefined,
      sourceLinks: {
        ...sourceBase,
        requirementId: decisiveRequirement?.requirementId,
      },
    },
  });
}

function projectCoverageStatus(
  input: RubricFeedbackProjectionBuildInput,
  coverage: TaskRequirementCoverage[],
  issues: RubricFeedbackProjectionIssue[],
): RubricFeedbackProjectionItem['coverageStatus'] {
  if (coverage.length === 0 || coverage.some((item) => item.status === 'insufficient_to_judge')) {
    return 'not_assessable';
  }
  const claimsGap = coverage.some((item) => (
    item.status === 'partially_covered' || item.status === 'missing'
  ));
  if (claimsGap && coverage.some((item) => item.source !== 'formal_diagnosis')) {
    issues.push(issue(
      'coverage_source_not_formal',
      'warning',
      coverage.map((item) => `requirementCoverage.${item.requirementId}.source`),
    ));
    return 'not_assessable';
  }
  if (coverage.every((item) => item.status === 'covered')) return 'achieved';
  if (coverage.every((item) => item.status === 'missing')) return 'missing';
  if (coverage.some((item) => item.status === 'partially_covered')) return 'partially_achieved';
  if (
    coverage.some((item) => item.status === 'covered')
    && coverage.some((item) => item.status === 'missing')
  ) return 'partially_achieved';
  return 'not_assessable';
}

function selectDecisiveRequirement(
  coverage: TaskRequirementCoverage[],
): TaskRequirementCoverage | undefined {
  return coverage.find((item) => item.status === 'partially_covered')
    || coverage.find((item) => item.status === 'missing')
    || coverage.find((item) => item.status === 'covered')
    || coverage[0];
}

function mapObservedGap(
  allCoverage: TaskRequirementCoverage[],
  decisive?: TaskRequirementCoverage,
): RubricFeedbackObservedGap | undefined {
  if (!decisive) return undefined;
  if (decisive.gapReasonCode === 'missing_text_evidence') {
    return hasCoveredRequirement(allCoverage, 'conclusion')
      ? 'conclusion_without_evidence'
      : undefined;
  }
  if (decisive.gapReasonCode === 'missing_reasoning_relation') {
    return hasCoveredRequirement(allCoverage, 'text_evidence')
      ? 'evidence_without_explanation'
      : undefined;
  }
  if (decisive.gapReasonCode === 'incomplete_task_requirement') {
    return decisive.requirementType === 'expression'
      ? 'expression_not_organized'
      : 'partial_required_aspects';
  }
  return undefined;
}

function hasCoveredRequirement(
  coverage: TaskRequirementCoverage[],
  type: TaskRequirementCoverage['requirementType'],
): boolean {
  return coverage.some((item) => (
    item.requirementType === type
    && ['covered', 'partially_covered'].includes(item.status)
  ));
}

function actionForGap(gap: RubricFeedbackObservedGap): string {
  switch (gap) {
    case 'conclusion_without_evidence':
      return '定位一条能够支持当前判断的文本依据。';
    case 'evidence_without_explanation':
      return '说明已找到的依据与当前判断之间的关系。';
    case 'partial_required_aspects':
      return '补齐同一任务要求中尚未完成的一个必要方面。';
    case 'scope_misaligned':
      return '重新核对题干限定的对象和范围。';
    case 'expression_not_organized':
      return '按照题目要求组织已有观点、依据和说明。';
  }
}

function selectPrimaryCandidate(
  input: RubricFeedbackProjectionBuildInput,
  candidates: ProjectionCandidate[],
  issues: RubricFeedbackProjectionIssue[],
): ProjectionCandidate | undefined {
  const eligible = candidates.filter(isPrimaryEligible);
  if (eligible.length === 0) {
    if (input.primaryGapRequirementId) {
      issues.push(issue(
        'primary_gap_not_actionable',
        'warning',
        ['primaryGapRequirementId'],
      ));
    }
    return undefined;
  }
  if (input.primaryGapRequirementId) {
    const explicit = eligible.find((candidate) => (
      candidate.decisiveRequirement?.requirementId === input.primaryGapRequirementId
    ));
    if (explicit) return explicit;
    issues.push(issue(
      'primary_gap_not_actionable',
      'warning',
      ['primaryGapRequirementId'],
    ));
  }
  const sorted = [...eligible].sort(comparePrimaryCandidates);
  const first = sorted[0];
  const second = sorted[1];
  if (second && primaryRank(first) === primaryRank(second)) {
    issues.push(issue(
      'multiple_primary_candidates_ambiguous',
      'warning',
      [
        `rubric.${first.item.rubricItemId}`,
        `rubric.${second.item.rubricItemId}`,
      ],
    ));
    return undefined;
  }
  return first;
}

function isPrimaryEligible(candidate: ProjectionCandidate): boolean {
  return ['partially_achieved', 'missing'].includes(candidate.item.coverageStatus)
    && Boolean(candidate.item.sourceLinks.diagnosisId)
    && Boolean(candidate.item.observedGap)
    && Boolean(candidate.item.nextThinkingAction)
    && candidate.independentGapCount <= 1
    && (candidate.rubric.required || candidate.rubric.importance === 'critical');
}

function comparePrimaryCandidates(left: ProjectionCandidate, right: ProjectionCandidate): number {
  return primaryRank(left).localeCompare(primaryRank(right));
}

function primaryRank(candidate: ProjectionCandidate): string {
  const order = Number.isFinite(candidate.earliestRequirementIndex)
    ? String(candidate.earliestRequirementIndex).padStart(6, '0')
    : '999999';
  const coverage = candidate.item.coverageStatus === 'partially_achieved' ? '0' : '1';
  const required = candidate.rubric.required ? '0' : '1';
  const importance = candidate.rubric.importance === 'critical'
    ? '0'
    : candidate.rubric.importance === 'important'
      ? '1'
      : '2';
  return `${order}:${coverage}:${required}:${importance}`;
}

function finalizeProjection(
  input: RubricFeedbackProjectionBuildInput,
  candidates: ProjectionCandidate[],
  primaryItemId: string | undefined,
  projectionStatus: RubricFeedbackProjection['projectionStatus'],
): RubricFeedbackProjection {
  const items = candidates.map((candidate) => candidate.item);
  const projectionId = `rubric-projection-${stableProjectionDigest(stableStringify({
      projectionVersion: RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION,
      questionVersionId: input.projectionContext.questionVersionId,
      rubricVersion: input.projectionContext.rubricVersion,
      formalDiagnosisId: input.projectionContext.formalDiagnosisId,
      responseId: input.projectionContext.responseId,
      items: items.map((item) => ({
        rubricItemId: item.rubricItemId,
        requirementId: item.requirementId,
        coverageStatus: item.coverageStatus,
        observedGap: item.observedGap,
        studentEvidenceRefs: item.studentEvidenceRefs,
      })),
      primaryItemId,
    }))}`;
  return {
    projectionVersion: RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION,
    projectionId,
    questionVersionId: input.projectionContext.questionVersionId,
    rubricVersion: input.projectionContext.rubricVersion,
    primaryItemId,
    items,
    projectionStatus,
  };
}

/**
 * Runtime-neutral deterministic digest for projection identity.
 *
 * This agent runs in both the Node debug harness and the browser Learning
 * surface, so it must not depend on `node:crypto`. Three independent FNV-1a
 * passes preserve the existing 24-character identity shape without exposing
 * asynchronous Web Crypto to the otherwise synchronous projection contract.
 */
function stableProjectionDigest(value: string): string {
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b];
  return seeds.map((seed) => {
    let hash = seed;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }).join('');
}

function candidate(input: {
  item: RubricFeedbackProjectionItem;
  rubric: QuestionResourceRubricItem;
  decisiveRequirement?: TaskRequirementCoverage;
  earliestRequirementIndex?: number;
  independentGapCount?: number;
}): ProjectionCandidate {
  return {
    item: input.item,
    rubric: input.rubric,
    decisiveRequirement: input.decisiveRequirement,
    earliestRequirementIndex: input.earliestRequirementIndex ?? Number.POSITIVE_INFINITY,
    independentGapCount: input.independentGapCount ?? 0,
  };
}

function issue(
  code: RubricFeedbackProjectionIssueCode,
  severity: RubricFeedbackProjectionIssue['severity'],
  evidencePaths: string[],
): RubricFeedbackProjectionIssue {
  return { code, severity, evidencePaths };
}

function result(
  outcome: RubricFeedbackProjectionBuildResult['outcome'],
  issues: RubricFeedbackProjectionIssue[],
  projection?: RubricFeedbackProjection,
): RubricFeedbackProjectionBuildResult {
  return {
    stageVersion: RUBRIC_ALIGNED_FEEDBACK_STAGE1_VERSION,
    outcome,
    projection,
    issues: uniqueIssues(issues),
  };
}

function uniqueIssues(issues: RubricFeedbackProjectionIssue[]): RubricFeedbackProjectionIssue[] {
  return issues.filter((item, index) => issues.findIndex((candidate) => (
    candidate.code === item.code
    && stableStringify(candidate.evidencePaths) === stableStringify(item.evidencePaths)
  )) === index);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(record[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}
