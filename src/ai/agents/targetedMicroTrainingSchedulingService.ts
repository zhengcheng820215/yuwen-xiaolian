import type { TargetedMicroTrainingSchedulingRepository } from '../repositories/targetedMicroTrainingSchedulingRepository.ts';
import type {
  TargetedMicroTrainingAssignment,
  TargetedMicroTrainingRequest,
} from '../schemas/targetedMicroTraining.schema.ts';
import type {
  TargetedMicroTrainingMatchResult,
  TargetedMicroTrainingTriggerDecision,
} from '../schemas/targetedMicroTrainingScheduling.schema.ts';
import {
  createTargetedMicroTrainingAssignment,
  createTargetedMicroTrainingRequestFromDecision,
  evaluateTargetedMicroTrainingTrigger,
  matchTargetedMicroTrainingResource,
  type TargetedMicroTrainingMatchInput,
  type TargetedMicroTrainingTriggerInput,
} from './targetedMicroTrainingSchedulingAgent.ts';

export type TargetedMicroTrainingSchedulingResult = {
  status: 'disabled' | 'not_scheduled' | 'no_match' | 'scheduled' | 'reused' | 'conflict';
  decision: TargetedMicroTrainingTriggerDecision;
  match?: TargetedMicroTrainingMatchResult;
  request?: TargetedMicroTrainingRequest;
  assignment?: TargetedMicroTrainingAssignment;
};

export async function scheduleTargetedMicroTraining(input: {
  trigger: TargetedMicroTrainingTriggerInput;
  matchFacts: Omit<TargetedMicroTrainingMatchInput, 'request'>;
  repository: TargetedMicroTrainingSchedulingRepository;
}): Promise<TargetedMicroTrainingSchedulingResult> {
  const initialDecision = evaluateTargetedMicroTrainingTrigger(input.trigger);
  const before = await input.repository.load();
  const existing = before.decisions.find((item) => item.decisionId === initialDecision.decisionId);
  if (existing) {
    const request = before.requests.find((item) => item.sourceAttemptId === existing.sourceAttemptId);
    const assignment = request && before.assignments.find((item) => item.requestId === request.requestId);
    return {
      status: assignment ? 'reused' : existing.outcome === 'no_match' ? 'no_match' : 'not_scheduled',
      decision: existing,
      ...(request ? { request } : {}),
      ...(assignment ? { assignment } : {}),
    };
  }

  if (initialDecision.outcome !== 'eligible') {
    const commit = await input.repository.commit({
      expectedRevision: before.revision,
      decision: initialDecision,
      committedAt: input.trigger.evaluatedAt,
    });
    return {
      status: initialDecision.reasonCode === 'feature_disabled'
        ? 'disabled'
        : commit.status === 'conflict' ? 'conflict' : 'not_scheduled',
      decision: initialDecision,
    };
  }

  const request = createTargetedMicroTrainingRequestFromDecision({ decision: initialDecision });
  const match = matchTargetedMicroTrainingResource({ request, ...input.matchFacts });
  if (match.status === 'no_match') {
    const noMatchDecision: TargetedMicroTrainingTriggerDecision = {
      ...initialDecision,
      outcome: 'no_match',
      reasonCode: match.reasonCode,
    };
    const commit = await input.repository.commit({
      expectedRevision: before.revision,
      decision: noMatchDecision,
      committedAt: input.trigger.evaluatedAt,
    });
    return {
      status: commit.status === 'conflict' ? 'conflict' : 'no_match',
      decision: noMatchDecision,
      match,
    };
  }

  const assignment = createTargetedMicroTrainingAssignment({
    request,
    match,
    sourceCoreTaskNumber: initialDecision.sourceCoreTaskNumber,
  });
  const commit = await input.repository.commit({
    expectedRevision: before.revision,
    decision: initialDecision,
    request,
    assignment,
    committedAt: input.trigger.evaluatedAt,
  });
  if (commit.status === 'conflict') {
    const latest = await input.repository.load();
    const reusedRequest = latest.requests.find((item) => item.requestId === request.requestId);
    const reusedAssignment = latest.assignments.find((item) => item.assignmentId === assignment.assignmentId);
    if (reusedRequest && reusedAssignment) {
      return {
        status: 'reused',
        decision: latest.decisions.find((item) => item.decisionId === initialDecision.decisionId)
          || initialDecision,
        match,
        request: reusedRequest,
        assignment: reusedAssignment,
      };
    }
    return { status: 'conflict', decision: initialDecision, match };
  }
  return {
    status: commit.status === 'reused' ? 'reused' : 'scheduled',
    decision: initialDecision,
    match,
    request: commit.request || request,
    assignment: commit.assignment || assignment,
  };
}

export function isTargetedMicroTrainingSchedulingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('targetedMicroTraining') === '1' || params.get('stage3verify') === '1') return true;
  return window.localStorage?.getItem('yuwen_xiaolian_targeted_micro_training_enabled') === 'true';
}
