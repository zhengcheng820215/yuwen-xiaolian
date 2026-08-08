import {
  resolveTaskCandidateState,
  type CandidateRuntimeContext,
  type QuestionCandidate,
  type TaskCandidateProjection,
} from '../ai/schemas/questionCandidate.schema.ts';
import type { CandidateOptimizationGoal } from '../ai/schemas/questionCandidateOptimization.schema.ts';

export const QUESTION_CANDIDATE_WORKFLOW_STORAGE_KEY =
  'yuwen-xiaolian:question-candidate-workflow';

export type CandidateWorkflowMode = 'enabled' | 'legacy';

export const CANDIDATE_OPTIMIZATION_GOALS: Array<{
  value: CandidateOptimizationGoal;
  label: string;
}> = [
  { value: 'reduce_ambiguity', label: '减少歧义' },
  { value: 'strengthen_material_evidence', label: '强化文本依据' },
  { value: 'narrow_answer_scope', label: '收紧答案范围' },
  { value: 'lower_difficulty', label: '降低难度' },
  { value: 'increase_challenge', label: '提升挑战' },
  { value: 'optimize_rubric', label: '优化评分标准' },
];

export type CandidatePanelOperation =
  | 'idle'
  | 'loading_candidates'
  | 'regenerating'
  | 'optimizing'
  | 'correcting'
  | 'migrating'
  | 'adopting'
  | 'discarding'
  | 'failed';

export type CandidateAdoptionCapability = {
  enabled: boolean;
  reason?: string;
};

export type CandidatePanelProjection = {
  candidateState: TaskCandidateProjection;
  readyCandidates: QuestionCandidate[];
  selectedCandidateId: string | null;
  comparisonCandidateIds: string[];
  operation: CandidatePanelOperation;
  busy: boolean;
  canOptimize: boolean;
  canRegenerate: boolean;
  adoption: CandidateAdoptionCapability;
  showsLegacyRecovery: boolean;
};

export function resolveQuestionCandidateWorkflowMode(input: {
  routeValue?: string | null;
  storedValue?: string | null;
  environmentValue?: string | boolean | null;
  developmentDefault?: boolean;
}): CandidateWorkflowMode {
  const route = parseMode(input.routeValue);
  if (route) return route;
  const stored = parseMode(input.storedValue);
  if (stored) return stored;
  const environment = parseMode(input.environmentValue);
  if (environment) return environment;
  return input.developmentDefault ? 'enabled' : 'legacy';
}

export function resolveCandidatePanelProjection(input: {
  candidates: QuestionCandidate[];
  context: CandidateRuntimeContext;
  operation?: CandidatePanelOperation;
  selectedCandidateId?: string | null;
  comparisonCandidateIds?: string[];
  adoption?: CandidateAdoptionCapability;
  workingStatus?: string;
}): CandidatePanelProjection {
  const operation = input.operation || 'idle';
  const candidateOperation = operation === 'optimizing'
    ? 'optimizing'
    : operation === 'regenerating'
      ? 'regenerating'
      : undefined;
  const candidateState = resolveTaskCandidateState({
    candidates: input.candidates,
    context: input.context,
    operation: candidateOperation,
    failed: operation === 'failed',
  });
  const readyIds = new Set(candidateState.readyCandidateIds);
  const allReadyCandidates = input.candidates.filter((candidate) => readyIds.has(candidate.candidateId));
  const requestedCandidate = allReadyCandidates.find(
    (candidate) => candidate.candidateId === input.selectedCandidateId,
  );
  const latestCandidate = [...allReadyCandidates].sort(compareCandidateRecency)[0];
  const activeGenerationCommandId = (
    requestedCandidate || latestCandidate
  )?.generationCommandId;
  const readyCandidates = activeGenerationCommandId
    ? allReadyCandidates.filter(
        (candidate) => candidate.generationCommandId === activeGenerationCommandId,
      ).slice(0, 3)
    : [];
  const selectedCandidateId = readyCandidates.some(
    (candidate) => candidate.candidateId === input.selectedCandidateId,
  )
    ? input.selectedCandidateId || null
    : readyCandidates[0]?.candidateId || null;
  const comparisonCandidateIds = selectedCandidateId ? [selectedCandidateId] : [];
  const busy = [
    'loading_candidates',
    'regenerating',
    'optimizing',
    'correcting',
    'migrating',
    'adopting',
    'discarding',
  ].includes(operation);
  const requestedAdoption = input.adoption || {
    enabled: false,
    reason: '当前可预览和优化候选，正式采用将在版本接入完成后开放。',
  };
  return {
    candidateState,
    readyCandidates,
    selectedCandidateId,
    comparisonCandidateIds,
    operation,
    busy,
    canOptimize: !busy && Boolean(selectedCandidateId),
    canRegenerate: !busy && Boolean(selectedCandidateId),
    adoption: {
      enabled: requestedAdoption.enabled && !busy && Boolean(selectedCandidateId),
      reason: requestedAdoption.enabled && !selectedCandidateId
        ? '请先选择一个候选方案。'
        : requestedAdoption.reason,
    },
    showsLegacyRecovery: [
      'dirty',
      'saved',
      'save_failed',
      'migration_required',
      'base_revision_conflict',
    ].includes(input.workingStatus || ''),
  };
}

function parseMode(value: unknown): CandidateWorkflowMode | null {
  if (value === true || value === 'true' || value === 'enabled') return 'enabled';
  if (value === false || value === 'false' || value === 'legacy') return 'legacy';
  return null;
}

function compareCandidateRecency(left: QuestionCandidate, right: QuestionCandidate): number {
  const createdAtDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (Number.isFinite(createdAtDifference) && createdAtDifference !== 0) {
    return createdAtDifference;
  }
  return right.candidateId.localeCompare(left.candidateId);
}
