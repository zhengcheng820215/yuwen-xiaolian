import {
  activateTargetedMicroTrainingOverlay,
  settleTargetedMicroTrainingOverlay,
} from './targetedMicroTrainingSchedulingAgent.ts';
import type { TargetedMicroTrainingSchedulingRepository } from '../repositories/targetedMicroTrainingSchedulingRepository.ts';
import type { UnifiedLearningEntryRepository } from '../repositories/unifiedLearningEntryRepository.ts';
import { createTargetedMicroTrainingSessionOverlay } from '../schemas/targetedMicroTrainingScheduling.schema.ts';

export type TargetedMicroTrainingLearningTransition = {
  assignmentId: string;
  mode: 'pending' | 'in_progress';
  title: '针对性练习';
  message: string;
  primaryActionText: '开始练习' | '继续练习';
  secondaryActionText: '继续下一题' | '完成本次学习';
  returnToCoreTaskNumber: number;
  coreTaskCount: number;
};

export async function attachTargetedAssignmentToLearningSession(input: {
  studentId: string;
  assignmentId: string;
  schedulingRepository: TargetedMicroTrainingSchedulingRepository;
  activityRepository: UnifiedLearningEntryRepository;
  now: string;
}): Promise<TargetedMicroTrainingLearningTransition> {
  const [snapshot, context] = await Promise.all([
    input.schedulingRepository.load(),
    input.activityRepository.getByStudent(input.studentId),
  ]);
  if (!context || context.status !== 'active' || !context.taskQueue) {
    throw new Error('Targeted assignment requires an active fixed learning queue.');
  }
  const assignment = snapshot.assignments.find((item) => item.assignmentId === input.assignmentId);
  if (!assignment || !['pending', 'in_progress'].includes(assignment.status)) {
    throw new Error('Targeted assignment is not available for this learning session.');
  }
  const request = snapshot.requests.find((item) => item.requestId === assignment.requestId);
  if (!request || request.studentId !== input.studentId
    || request.learningSessionId !== context.learningSessionId) {
    throw new Error('Targeted assignment identity does not match the active learning session.');
  }
  const originalQueue = JSON.stringify(context.taskQueue);
  const overlay = context.targetedMicroTrainingOverlay
    || createTargetedMicroTrainingSessionOverlay({
      learningSessionId: context.learningSessionId,
      now: input.now,
    });
  const nextOverlay = activateTargetedMicroTrainingOverlay({ overlay, assignment, now: input.now });
  const write = await input.activityRepository.save({
    ...context,
    targetedMicroTrainingOverlay: nextOverlay,
    updatedAt: input.now,
  });
  if (write.status === 'conflict') throw new Error('Active learning session changed during scheduling.');
  if (JSON.stringify(write.context.taskQueue) !== originalQueue) {
    throw new Error('Targeted scheduling must not mutate the fixed core queue.');
  }
  return transition(assignment.assignmentId, assignment.status, assignment.returnToCoreTaskNumber, context.taskQueue.targetTaskCount);
}

export async function beginTargetedMicroTraining(input: {
  studentId: string;
  assignmentId: string;
  schedulingRepository: TargetedMicroTrainingSchedulingRepository;
  activityRepository: UnifiedLearningEntryRepository;
  now: string;
}): Promise<TargetedMicroTrainingLearningTransition> {
  const snapshot = await input.schedulingRepository.load();
  const assignment = snapshot.assignments.find((item) => item.assignmentId === input.assignmentId);
  if (!assignment) throw new Error('Targeted assignment was not found.');
  const updated = assignment.status === 'pending'
    ? await input.schedulingRepository.updateAssignmentStatus({
        assignmentId: assignment.assignmentId,
        expectedStatus: 'pending',
        nextStatus: 'in_progress',
        expectedRevision: snapshot.revision,
        updatedAt: input.now,
      })
    : { status: 'reused' as const, assignment, snapshot };
  if (updated.status === 'conflict' || !updated.assignment) {
    throw new Error('Targeted assignment presentation could not be persisted.');
  }
  const context = await input.activityRepository.getByStudent(input.studentId);
  if (!context?.taskQueue || context.targetedMicroTrainingOverlay?.activeAssignmentId !== input.assignmentId) {
    throw new Error('Targeted assignment is not attached to the active learning context.');
  }
  return transition(updated.assignment.assignmentId, 'in_progress', updated.assignment.returnToCoreTaskNumber, context.taskQueue.targetTaskCount);
}

export async function settleTargetedMicroTraining(input: {
  studentId: string;
  assignmentId: string;
  status: 'completed' | 'skipped' | 'unavailable';
  schedulingRepository: TargetedMicroTrainingSchedulingRepository;
  activityRepository: UnifiedLearningEntryRepository;
  now: string;
}): Promise<{ returnToCoreTaskNumber: number; sessionComplete: boolean }> {
  const [snapshot, context] = await Promise.all([
    input.schedulingRepository.load(),
    input.activityRepository.getByStudent(input.studentId),
  ]);
  if (!context?.taskQueue || !context.targetedMicroTrainingOverlay) {
    throw new Error('Targeted learning overlay is missing.');
  }
  const assignment = snapshot.assignments.find((item) => item.assignmentId === input.assignmentId);
  if (!assignment) throw new Error('Targeted assignment was not found.');
  const expectedStatus = input.status === 'completed' ? 'in_progress' : 'pending';
  const assignmentWrite = await input.schedulingRepository.updateAssignmentStatus({
    assignmentId: input.assignmentId,
    expectedStatus,
    nextStatus: input.status,
    expectedRevision: snapshot.revision,
    updatedAt: input.now,
  });
  if (assignmentWrite.status === 'conflict' || !assignmentWrite.assignment) {
    throw new Error('Targeted assignment could not enter its terminal state.');
  }
  const overlay = settleTargetedMicroTrainingOverlay({
    overlay: context.targetedMicroTrainingOverlay,
    assignment: assignmentWrite.assignment,
    terminalStatus: input.status,
    now: input.now,
  });
  const sessionComplete = assignment.returnToCoreTaskNumber > context.taskQueue.targetTaskCount;
  const nextRoundId = sessionComplete
    ? context.currentLearningRoundId
    : `${context.learningSessionId}-round-${assignment.returnToCoreTaskNumber}`;
  const write = await input.activityRepository.save({
    ...context,
    currentLearningRoundId: nextRoundId,
    targetedMicroTrainingOverlay: overlay,
    updatedAt: input.now,
  });
  if (write.status === 'conflict') throw new Error('Core queue cursor could not be restored.');
  return { returnToCoreTaskNumber: assignment.returnToCoreTaskNumber, sessionComplete };
}

export async function recoverTargetedMicroTrainingTransition(input: {
  studentId: string;
  schedulingRepository: TargetedMicroTrainingSchedulingRepository;
  activityRepository: UnifiedLearningEntryRepository;
}): Promise<TargetedMicroTrainingLearningTransition | null> {
  const context = await input.activityRepository.getByStudent(input.studentId);
  const assignmentId = context?.targetedMicroTrainingOverlay?.activeAssignmentId;
  if (!context?.taskQueue || context.targetedMicroTrainingOverlay?.mode !== 'targeted' || !assignmentId) {
    return null;
  }
  const snapshot = await input.schedulingRepository.load();
  const assignment = snapshot.assignments.find((item) => item.assignmentId === assignmentId);
  if (!assignment || !['pending', 'in_progress'].includes(assignment.status)) return null;
  return transition(assignment.assignmentId, assignment.status, assignment.returnToCoreTaskNumber, context.taskQueue.targetTaskCount);
}

function transition(
  assignmentId: string,
  status: 'pending' | 'in_progress',
  returnToCoreTaskNumber: number,
  coreTaskCount: number,
): TargetedMicroTrainingLearningTransition {
  return {
    assignmentId,
    mode: status,
    title: '针对性练习',
    message: '先用一小段文字练习如何把依据和判断连起来。',
    primaryActionText: status === 'pending' ? '开始练习' : '继续练习',
    secondaryActionText: returnToCoreTaskNumber > coreTaskCount ? '完成本次学习' : '继续下一题',
    returnToCoreTaskNumber,
    coreTaskCount,
  };
}
