import type {
  AdaptiveTaskConstraints,
  AdaptiveTaskRequestEnvelope,
  StrategyConstraintAlignmentResult,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import {
  ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
  isAdaptiveTaskConstraints,
  isStrategyConstraintAlignmentResult,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import type { TaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import { isTaskRequest } from '../schemas/nextLearningStrategy.schema.ts';

export type AdaptiveTaskRequestEnvelopeInput = {
  taskRequest: TaskRequest;
  adaptiveConstraints: AdaptiveTaskConstraints;
  alignmentResult: StrategyConstraintAlignmentResult;
};

export type AdaptiveTaskRequestEnvelopeResult = {
  envelope: AdaptiveTaskRequestEnvelope | null;
  issues: string[];
};

export function createAdaptiveTaskRequestEnvelope(
  input: AdaptiveTaskRequestEnvelopeInput,
): AdaptiveTaskRequestEnvelopeResult {
  const issues: string[] = [];
  const { taskRequest, adaptiveConstraints, alignmentResult } = input;

  if (!isTaskRequest(taskRequest)) issues.push('TaskRequest failed schema validation.');
  if (!isAdaptiveTaskConstraints(adaptiveConstraints) || !adaptiveConstraints.validation.passed) {
    issues.push('AdaptiveTaskConstraints failed validation.');
  }
  if (!isStrategyConstraintAlignmentResult(alignmentResult) || !alignmentResult.validation.passed) {
    issues.push('StrategyConstraintAlignmentResult failed validation.');
  }
  if (alignmentResult.status !== 'aligned' || !alignmentResult.canCreateTaskRequest) {
    issues.push('Alignment Result does not allow TaskRequest handoff.');
  }
  if (taskRequest.strategyId !== adaptiveConstraints.sourceStrategyId) issues.push('TaskRequest strategyId mismatch.');
  if (taskRequest.strategyId !== alignmentResult.strategyId) issues.push('Alignment strategyId mismatch.');
  if (taskRequest.studentId !== adaptiveConstraints.studentId) issues.push('studentId mismatch.');
  if (taskRequest.targetAbilityId !== adaptiveConstraints.targetAbilityId) issues.push('targetAbilityId mismatch.');
  if (taskRequest.taskRole !== adaptiveConstraints.recommendedTaskRole) issues.push('taskRole mismatch.');
  if (taskRequest.action !== adaptiveConstraints.sourceStrategyAction) issues.push('action mismatch.');
  if (taskRequest.validationGoal !== adaptiveConstraints.sourceValidationGoal) issues.push('validationGoal mismatch.');
  if (adaptiveConstraints.constraintsId !== alignmentResult.constraintsId) issues.push('constraintsId mismatch.');

  if (issues.length > 0) return { envelope: null, issues: uniqueSorted(issues) };

  const envelope: AdaptiveTaskRequestEnvelope = {
    envelopeId: buildStableId('adaptive-task-request', [
      taskRequest.taskRequestId,
      adaptiveConstraints.constraintsId,
      alignmentResult.alignmentId,
    ]),
    taskRequest,
    adaptiveConstraints,
    alignmentResult,
    constraintsId: adaptiveConstraints.constraintsId,
    canEnterTaskFulfillment: true,
    schemaVersion: ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
    validation: { passed: true, issues: [] },
  };

  return { envelope, issues: [] };
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))].sort();
}
