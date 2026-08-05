import {
  CANDIDATE_FIELD_KEYS,
  type CandidateFieldKey,
} from './questionCandidate.schema.ts';
import {
  normalizeQuestionEditableFields,
  type QuestionEditableFields,
} from './workingTaskContent.schema.ts';

export const QUESTION_CANDIDATE_OPTIMIZATION_SCHEMA_VERSION =
  'question-candidate-optimization-v1' as const;

export type CandidateOptimizationGoal =
  | 'reduce_ambiguity'
  | 'strengthen_material_evidence'
  | 'narrow_answer_scope'
  | 'lower_difficulty'
  | 'increase_challenge'
  | 'optimize_rubric';

export type CandidateOptimizationFieldPolicy = {
  goals: CandidateOptimizationGoal[];
  allowedFields: CandidateFieldKey[];
  lockedFields: CandidateFieldKey[];
};

export type CandidateOptimizationChangeSummary = {
  field: CandidateFieldKey;
  summary: string;
};

export type QuestionCandidateOptimizationOutput = {
  content: QuestionEditableFields;
  changedFields: CandidateFieldKey[];
  reason: string;
  changeSummary: CandidateOptimizationChangeSummary[];
};

const GOAL_POLICIES: Record<CandidateOptimizationGoal, {
  allowedFields: CandidateFieldKey[];
  lockedFields: CandidateFieldKey[];
}> = {
  reduce_ambiguity: {
    allowedFields: ['questionStem', 'answerAcceptance'],
    lockedFields: ['abilityTarget', 'observationTarget', 'materialScope'],
  },
  strengthen_material_evidence: {
    allowedFields: ['questionStem', 'studentTask', 'answerAcceptance'],
    lockedFields: ['abilityTarget', 'materialScope'],
  },
  narrow_answer_scope: {
    allowedFields: ['answerAcceptance', 'rubric'],
    lockedFields: ['abilityTarget', 'observationTarget', 'materialScope'],
  },
  lower_difficulty: {
    allowedFields: ['questionStem', 'studentTask', 'answerAcceptance', 'rubric'],
    lockedFields: ['abilityTarget', 'materialScope'],
  },
  increase_challenge: {
    allowedFields: ['questionStem', 'studentTask', 'answerAcceptance', 'rubric'],
    lockedFields: ['abilityTarget', 'materialScope'],
  },
  optimize_rubric: {
    allowedFields: ['rubric', 'answerAcceptance'],
    lockedFields: ['abilityTarget', 'observationTarget', 'materialScope'],
  },
};

export class QuestionCandidateOptimizationError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'QuestionCandidateOptimizationError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function resolveCandidateOptimizationFieldPolicy(
  goals: CandidateOptimizationGoal[],
): CandidateOptimizationFieldPolicy {
  const normalizedGoals = unique(goals);
  if (normalizedGoals.length === 0) {
    throw new QuestionCandidateOptimizationError(
      'CANDIDATE_OPTIMIZATION_GOAL_UNSUPPORTED',
      'At least one supported optimization goal is required.',
    );
  }
  for (const goal of normalizedGoals) {
    if (!Object.prototype.hasOwnProperty.call(GOAL_POLICIES, goal)) {
      throw new QuestionCandidateOptimizationError(
        'CANDIDATE_OPTIMIZATION_GOAL_UNSUPPORTED',
        `Unsupported candidate optimization goal: ${goal}.`,
      );
    }
  }
  const lockedFields = unique(normalizedGoals.flatMap((goal) => GOAL_POLICIES[goal].lockedFields));
  const allowedFields = unique(normalizedGoals
    .flatMap((goal) => GOAL_POLICIES[goal].allowedFields))
    .filter((field) => !lockedFields.includes(field));
  return { goals: normalizedGoals, allowedFields, lockedFields };
}

export function parseQuestionCandidateOptimizationOutput(
  rawOutput: string,
  baseContent: QuestionEditableFields,
): QuestionCandidateOptimizationOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(rawOutput));
  } catch {
    throw invalidOutput('Optimization Agent returned invalid JSON.');
  }
  if (!isRecord(parsed) || !isRecord(parsed.content)) {
    throw invalidOutput('Optimization Agent output must contain a complete content object.');
  }
  for (const key of Object.keys(baseContent)) {
    if (!Object.prototype.hasOwnProperty.call(parsed.content, key)) {
      throw invalidOutput(`Optimization Agent output omitted content.${key}.`);
    }
  }
  if (!Array.isArray(parsed.changedFields) || !parsed.changedFields.every(isCandidateFieldKey)) {
    throw invalidOutput('Optimization Agent changedFields contains an invalid field.');
  }
  if (typeof parsed.reason !== 'string' || !parsed.reason.trim()) {
    throw invalidOutput('Optimization Agent reason is required.');
  }
  if (!Array.isArray(parsed.changeSummary) || !parsed.changeSummary.every((item) => (
    isRecord(item) && isCandidateFieldKey(item.field) &&
    typeof item.summary === 'string' && item.summary.trim().length > 0
  ))) {
    throw invalidOutput('Optimization Agent changeSummary is invalid.');
  }
  return {
    content: normalizeQuestionEditableFields(parsed.content as QuestionEditableFields),
    changedFields: unique(parsed.changedFields),
    reason: parsed.reason.trim(),
    changeSummary: parsed.changeSummary.map((item) => ({
      field: item.field as CandidateFieldKey,
      summary: (item.summary as string).trim(),
    })),
  };
}

function invalidOutput(message: string): QuestionCandidateOptimizationError {
  return new QuestionCandidateOptimizationError(
    'CANDIDATE_AGENT_INVALID_OUTPUT',
    message,
    true,
  );
}

function isCandidateFieldKey(value: unknown): value is CandidateFieldKey {
  return typeof value === 'string' && CANDIDATE_FIELD_KEYS.includes(value as CandidateFieldKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() || trimmed;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
