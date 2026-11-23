export type ProgressionTaskKind = 'independent_retest' | 'error_recheck' | 'retention';
export type ProgressionBandStatus = 'training' | 'pending_independent_retest' | 'provisionally_stable' | 'needs_recheck';
export type ProgressionObservationRole = 'independent' | 'retest' | 'recheck' | 'retention' | 'probe' | 'training' | 'reinforcement';

export type ReviewedProgressionQuestion = {
  id: string;
  contentVersion: number;
  knowledgePointId: string;
  band: number;
  category: string;
  approved: boolean;
  independentEligible: boolean;
  retentionEligible?: boolean;
  probeEligible?: boolean;
  variantGroupId?: string;
};

export type ProgressionObservation = {
  responseId: string;
  sessionId: string;
  sessionCompleted: boolean;
  questionId: string;
  questionContentVersion: number;
  knowledgePointId: string;
  band: number;
  role: ProgressionObservationRole;
  taskId?: string;
  answeredAt: string;
  firstAttempt: boolean;
  hadHintOrFeedback: boolean;
  correct: boolean;
};

export type ProgressionTask = {
  id: string;
  kind: ProgressionTaskKind;
  band: number;
  dueAt: string;
  createdByResponseId: string;
};

export type IndependentCorrect = {
  responseId: string;
  sessionId: string;
  questionId: string;
  answeredAt: string;
};

export type ProgressionBand = {
  status: ProgressionBandStatus;
  consecutiveCorrect: IndependentCorrect[];
  recheckCorrect: IndependentCorrect[];
  bridgeRequired: boolean;
};

export type KnowledgePointProgress = {
  schemaVersion: 1;
  knowledgePointId: string;
  mappingVersion: string;
  ruleVersion: string;
  currentBand: number;
  bands: Record<string, ProgressionBand>;
  tasks: ProgressionTask[];
  exposedQuestionIds: string[];
  exposedVariantGroupIds: string[];
  processedResponseIds: string[];
  lastObservedAt?: string;
};

export type ProgressionRules = {
  knowledgePointId: string;
  category: string;
  availableBands: number[];
  contentApprovedForProgression: boolean;
  mappingVersion: string;
  ruleVersion: string;
};

export type ProgressionDecisionReason =
  | 'processed'
  | 'duplicate_response'
  | 'invalid_observation'
  | 'content_not_ready'
  | 'content_review_required'
  | 'not_independent'
  | 'task_not_due'
  | 'question_exposed'
  | 'question_not_eligible'
  | 'clock_rollback';

export type ProgressionDecision = {
  state: KnowledgePointProgress;
  reason: ProgressionDecisionReason;
  promoted: boolean;
  ruleVersion: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function nextDueAt(now: string, days: number): string {
  return new Date(Date.parse(now) + days * DAY_MS).toISOString();
}

function emptyBand(): ProgressionBand {
  return { status: 'training', consecutiveCorrect: [], recheckCorrect: [], bridgeRequired: false };
}

export function createKnowledgePointProgress(rules: ProgressionRules, initialBand: number): KnowledgePointProgress {
  if (!rules.knowledgePointId || !rules.mappingVersion || !rules.ruleVersion
    || !Number.isInteger(initialBand) || initialBand < 1 || !rules.availableBands.includes(initialBand)) {
    throw new Error('Invalid knowledge point or initial band');
  }
  return {
    schemaVersion: 1,
    knowledgePointId: rules.knowledgePointId,
    mappingVersion: rules.mappingVersion,
    ruleVersion: rules.ruleVersion,
    currentBand: initialBand,
    bands: { [initialBand]: emptyBand() },
    tasks: [],
    exposedQuestionIds: [],
    exposedVariantGroupIds: [],
    processedResponseIds: [],
  };
}

export type InitialPlacementResult =
  | { status: 'provisional'; state: KnowledgePointProgress; hasConflictingAnswers: boolean }
  | { status: 'needs_review'; reason: 'content_not_ready' | 'invalid_pair' };

export function placeInitialKnowledgePoint(input: {
  rules: ProgressionRules;
  lowerQuestion: ReviewedProgressionQuestion;
  higherQuestion: ReviewedProgressionQuestion;
  lowerObservation: ProgressionObservation;
  higherObservation: ProgressionObservation;
}): InitialPlacementResult {
  const { rules, lowerQuestion, higherQuestion, lowerObservation, higherObservation } = input;
  if (!rules.contentApprovedForProgression) return { status: 'needs_review', reason: 'content_not_ready' };
  if (higherQuestion.band !== lowerQuestion.band + 1
    || lowerQuestion.id === higherQuestion.id
    || !rules.availableBands.includes(lowerQuestion.band) || !rules.availableBands.includes(higherQuestion.band)
    || !lowerQuestion.approved || !lowerQuestion.independentEligible || !higherQuestion.approved || !higherQuestion.probeEligible
    || lowerQuestion.knowledgePointId !== rules.knowledgePointId || higherQuestion.knowledgePointId !== rules.knowledgePointId
    || lowerQuestion.category !== rules.category || higherQuestion.category !== rules.category
    || lowerObservation.questionId !== lowerQuestion.id || higherObservation.questionId !== higherQuestion.id
    || lowerObservation.questionContentVersion !== lowerQuestion.contentVersion
    || higherObservation.questionContentVersion !== higherQuestion.contentVersion
    || lowerObservation.knowledgePointId !== rules.knowledgePointId || higherObservation.knowledgePointId !== rules.knowledgePointId
    || lowerObservation.band !== lowerQuestion.band || higherObservation.band !== higherQuestion.band
    || lowerObservation.sessionId !== higherObservation.sessionId
    || !lowerObservation.sessionCompleted || !higherObservation.sessionCompleted
    || !lowerObservation.firstAttempt || !higherObservation.firstAttempt
    || lowerObservation.hadHintOrFeedback || higherObservation.hadHintOrFeedback
    || !Number.isFinite(Date.parse(lowerObservation.answeredAt)) || !Number.isFinite(Date.parse(higherObservation.answeredAt))
    || Date.parse(higherObservation.answeredAt) < Date.parse(lowerObservation.answeredAt)) {
    return { status: 'needs_review', reason: 'invalid_pair' };
  }
  const initial = createKnowledgePointProgress(rules, lowerQuestion.band);
  const lower = applyProgressionObservation(initial, { ...lowerObservation, role: 'independent' }, lowerQuestion, rules);
  const higher = applyProgressionObservation(lower.state, { ...higherObservation, role: 'probe' }, higherQuestion, rules);
  if (lower.reason !== 'processed' || (higher.reason !== 'not_independent' && higher.reason !== 'processed')) {
    return { status: 'needs_review', reason: 'invalid_pair' };
  }
  return {
    status: 'provisional',
    state: higher.state,
    hasConflictingAnswers: lowerObservation.correct !== higherObservation.correct,
  };
}

function rememberExposure(state: KnowledgePointProgress, question: ReviewedProgressionQuestion): void {
  if (!state.exposedQuestionIds.includes(question.id)) state.exposedQuestionIds.push(question.id);
  if (question.variantGroupId && !state.exposedVariantGroupIds.includes(question.variantGroupId)) {
    state.exposedVariantGroupIds.push(question.variantGroupId);
  }
}

function replaceTask(state: KnowledgePointProgress, band: number, kind: ProgressionTaskKind, responseId: string, answeredAt: string, days: number): void {
  state.tasks = state.tasks.filter((task) => task.band !== band);
  state.tasks.push({ id: `${responseId}:${kind}`, kind, band, dueAt: nextDueAt(answeredAt, days), createdByResponseId: responseId });
}

function preserveOrCreateTask(state: KnowledgePointProgress, band: number, kind: ProgressionTaskKind, responseId: string, answeredAt: string, days: number): void {
  if (state.tasks.some((task) => task.band === band)) return;
  replaceTask(state, band, kind, responseId, answeredAt, days);
}

function hasCrossSessionConfirmation(correct: IndependentCorrect[]): boolean {
  if (correct.length < 2) return false;
  const [previous, latest] = correct.slice(-2);
  return previous.sessionId !== latest.sessionId
    && previous.questionId !== latest.questionId
    && Date.parse(latest.answeredAt) - Date.parse(previous.answeredAt) >= DAY_MS;
}

export function applyProgressionObservation(
  current: KnowledgePointProgress,
  observation: ProgressionObservation,
  question: ReviewedProgressionQuestion,
  rules: ProgressionRules,
): ProgressionDecision {
  const result = (state: KnowledgePointProgress, reason: ProgressionDecisionReason, promoted = false): ProgressionDecision => ({
    state, reason, promoted, ruleVersion: rules.ruleVersion,
  });
  if (current.processedResponseIds.includes(observation.responseId)) return result(current, 'duplicate_response');
  const timestamp = Date.parse(observation.answeredAt);
  if (!observation.responseId || !observation.sessionId || !Number.isFinite(timestamp)
    || current.knowledgePointId !== rules.knowledgePointId
    || observation.knowledgePointId !== rules.knowledgePointId
    || question.knowledgePointId !== rules.knowledgePointId
    || observation.questionId !== question.id
    || observation.questionContentVersion !== question.contentVersion
    || observation.band !== question.band
    || !rules.availableBands.includes(observation.band)) return result(current, 'invalid_observation');
  if (current.lastObservedAt && timestamp < Date.parse(current.lastObservedAt)) return result(current, 'clock_rollback');

  const state: KnowledgePointProgress = structuredClone(current);
  const wasExposed = state.exposedQuestionIds.includes(question.id)
    || Boolean(question.variantGroupId && state.exposedVariantGroupIds.includes(question.variantGroupId));
  state.processedResponseIds.push(observation.responseId);
  state.lastObservedAt = observation.answeredAt;
  rememberExposure(state, question);

  if (state.mappingVersion !== rules.mappingVersion || state.ruleVersion !== rules.ruleVersion) return result(state, 'content_review_required');
  if (!rules.contentApprovedForProgression) return result(state, 'content_not_ready');
  if (observation.role === 'training' && state.bands[observation.band]?.bridgeRequired && observation.sessionCompleted && question.approved) {
    state.bands[observation.band].bridgeRequired = false;
    replaceTask(state, observation.band, 'error_recheck', observation.responseId, observation.answeredAt, 1);
    return result(state, 'processed');
  }
  if (!question.approved || (observation.role === 'retention' ? !question.retentionEligible
    : observation.role === 'probe' ? !question.probeEligible : !question.independentEligible)) return result(state, 'question_not_eligible');
  if (!observation.sessionCompleted || !observation.firstAttempt || observation.hadHintOrFeedback
    || observation.role === 'training' || observation.role === 'reinforcement' || observation.role === 'probe') return result(state, 'not_independent');
  if (wasExposed) return result(state, 'question_exposed');

  const band = state.bands[observation.band] ?? emptyBand();
  state.bands[observation.band] = band;
  if (band.status === 'provisionally_stable' && observation.role !== 'retention') return result(state, 'not_independent');
  if (band.bridgeRequired && observation.role === 'recheck') return result(state, 'task_not_due');

  const task = observation.taskId ? state.tasks.find((candidate) => candidate.id === observation.taskId) : undefined;
  if (observation.role !== 'independent' && (!task || task.band !== observation.band
    || task.kind !== (observation.role === 'retention' ? 'retention' : observation.role === 'recheck' ? 'error_recheck' : 'independent_retest')
    || timestamp < Date.parse(task.dueAt))) return result(state, 'task_not_due');
  if (observation.role === 'independent' && observation.taskId) return result(state, 'task_not_due');
  if (task) state.tasks = state.tasks.filter((candidate) => candidate.id !== task.id);
  const correct: IndependentCorrect = {
    responseId: observation.responseId,
    sessionId: observation.sessionId,
    questionId: question.id,
    answeredAt: observation.answeredAt,
  };

  if (observation.role === 'retention') {
    if (observation.correct) {
      band.status = 'provisionally_stable';
      band.bridgeRequired = false;
      replaceTask(state, observation.band, 'retention', observation.responseId, observation.answeredAt, 30);
    } else {
      band.status = 'needs_recheck';
      band.recheckCorrect = [];
      replaceTask(state, observation.band, 'error_recheck', observation.responseId, observation.answeredAt, 1);
    }
    return result(state, 'processed');
  }

  if (band.status === 'needs_recheck') {
    if (!observation.correct) {
      band.recheckCorrect = [];
      band.bridgeRequired = true;
      replaceTask(state, observation.band, 'error_recheck', observation.responseId, observation.answeredAt, 1);
    } else {
      band.recheckCorrect = [...band.recheckCorrect, correct].slice(-2);
      if (hasCrossSessionConfirmation(band.recheckCorrect)) {
        band.status = 'provisionally_stable';
        band.bridgeRequired = false;
        band.recheckCorrect = [];
        replaceTask(state, observation.band, 'retention', observation.responseId, observation.answeredAt, 7);
      } else replaceTask(state, observation.band, 'error_recheck', observation.responseId, observation.answeredAt, 1);
    }
    return result(state, 'processed');
  }

  if (!observation.correct) {
    band.status = 'training';
    band.consecutiveCorrect = [];
    band.bridgeRequired = false;
    replaceTask(state, observation.band, 'error_recheck', observation.responseId, observation.answeredAt, 1);
    return result(state, 'processed');
  }

  band.bridgeRequired = false;
  if (observation.role === 'recheck') band.consecutiveCorrect = [correct];
  else band.consecutiveCorrect = [...band.consecutiveCorrect, correct].slice(-2);
  if (observation.role === 'retest' && hasCrossSessionConfirmation(band.consecutiveCorrect)) {
    band.status = 'provisionally_stable';
    replaceTask(state, observation.band, 'retention', observation.responseId, observation.answeredAt, 7);
    const nextBand = state.currentBand + 1;
    if (observation.band === state.currentBand && rules.availableBands.includes(nextBand)) {
      state.currentBand = nextBand;
      state.bands[nextBand] ??= emptyBand();
      return result(state, 'processed', true);
    }
    return result(state, 'processed');
  }
  band.status = 'pending_independent_retest';
  preserveOrCreateTask(state, observation.band, 'independent_retest', observation.responseId, observation.answeredAt, 1);
  return result(state, 'processed');
}

export function isProgressionTaskDue(task: ProgressionTask, now: string): boolean {
  const timestamp = Date.parse(now);
  return Number.isFinite(timestamp) && timestamp >= Date.parse(task.dueAt);
}

export type DueProgressionAssignment = {
  knowledgePointId: string;
  taskId: string;
  taskKind: ProgressionTaskKind;
  questionId: string;
  questionContentVersion: number;
};

export type DueProgressionBlock = {
  knowledgePointId: string;
  taskId: string;
  reason: 'content_not_ready' | 'content_review_required' | 'clock_rollback' | 'bridge_required' | 'no_eligible_item';
};

export function selectDueProgressionQuestions(input: {
  progress: KnowledgePointProgress[];
  rules: ProgressionRules[];
  questions: ReviewedProgressionQuestion[];
  now: string;
  capacity: number;
  category?: string;
}): { assignments: DueProgressionAssignment[]; blocked: DueProgressionBlock[] } {
  if (!Number.isInteger(input.capacity) || input.capacity < 0) throw new Error('Invalid progression capacity');
  const rulesByPoint = new Map(input.rules.map((rule) => [rule.knowledgePointId, rule]));
  const priority: Record<ProgressionTaskKind, number> = { error_recheck: 0, independent_retest: 1, retention: 2 };
  const due = input.progress.flatMap((state) => state.tasks.map((task) => ({ state, task })))
    .filter(({ state, task }) => {
      const rule = rulesByPoint.get(state.knowledgePointId);
      return rule && (!input.category || rule.category === input.category) && isProgressionTaskDue(task, input.now);
    })
    .sort((a, b) => priority[a.task.kind] - priority[b.task.kind]
      || a.task.dueAt.localeCompare(b.task.dueAt)
      || a.state.knowledgePointId.localeCompare(b.state.knowledgePointId));
  const assignments: DueProgressionAssignment[] = [];
  const blocked: DueProgressionBlock[] = [];
  const reservedQuestionIds = new Set<string>();
  const reservedVariantGroups = new Set<string>();
  const assignedPoints = new Set<string>();

  for (const { state, task } of due) {
    if (assignments.length >= input.capacity) break;
    if (assignedPoints.has(state.knowledgePointId)) continue;
    const rules = rulesByPoint.get(state.knowledgePointId)!;
    let reason: DueProgressionBlock['reason'] | undefined;
    if (state.mappingVersion !== rules.mappingVersion || state.ruleVersion !== rules.ruleVersion) reason = 'content_review_required';
    else if (state.lastObservedAt && Date.parse(input.now) < Date.parse(state.lastObservedAt)) reason = 'clock_rollback';
    else if (!rules.contentApprovedForProgression || !rules.availableBands.includes(task.band)) reason = 'content_not_ready';
    else if (state.bands[task.band]?.bridgeRequired && task.kind === 'error_recheck') reason = 'bridge_required';
    if (reason) {
      blocked.push({ knowledgePointId: state.knowledgePointId, taskId: task.id, reason });
      continue;
    }
    const candidate = input.questions
      .filter((question) => question.approved
        && question.knowledgePointId === state.knowledgePointId
        && question.band === task.band
        && question.category === rules.category
        && (task.kind === 'retention' ? question.retentionEligible : question.independentEligible)
        && !state.exposedQuestionIds.includes(question.id)
        && !reservedQuestionIds.has(question.id)
        && (!question.variantGroupId || (!state.exposedVariantGroupIds.includes(question.variantGroupId)
          && !reservedVariantGroups.has(question.variantGroupId))))
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!candidate) {
      blocked.push({ knowledgePointId: state.knowledgePointId, taskId: task.id, reason: 'no_eligible_item' });
      continue;
    }
    assignments.push({
      knowledgePointId: state.knowledgePointId,
      taskId: task.id,
      taskKind: task.kind,
      questionId: candidate.id,
      questionContentVersion: candidate.contentVersion,
    });
    assignedPoints.add(state.knowledgePointId);
    reservedQuestionIds.add(candidate.id);
    if (candidate.variantGroupId) reservedVariantGroups.add(candidate.variantGroupId);
  }
  return { assignments, blocked };
}
