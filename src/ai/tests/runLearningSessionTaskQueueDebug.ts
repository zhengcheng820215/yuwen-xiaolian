import assert from 'node:assert/strict';
import {
  canAdvanceLearningSessionTaskQueue,
  createRecoveredLearningSessionTaskQueue,
  createLearningSessionTaskQueue,
  LEARNING_SESSION_TASK_QUEUE_MAX_COUNT,
  resolveLearningSessionTaskQueueProgress,
} from '../agents/learningSessionTaskQueueAgent.ts';
import {
  isLearningSessionTaskQueue,
  LEARNING_SESSION_TASK_QUEUE_VERSION,
} from '../schemas/unifiedLearningEntry.schema.ts';
import type { FrozenQuestionResourceVersion } from
  '../schemas/questionResourceAdmission.schema.ts';
import {
  formatNextTaskAction,
  formatNextTaskContinuation,
  shouldSettleTerminalLearningSessionOnExit,
} from '../../ui/learningSessionProgressCopy.ts';
import {
  buildFixedQueueAdmissionFromFrozenResource,
  reusableFixedQueueAdmission,
  restoreFixedTaskQueueCheckpointFromPersistence,
  shouldRecoverFixedTaskQueueAdmission,
} from '../agents/fixedTaskQueueContinuationRecovery.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';

const NOW = '2026-08-19T09:00:00.000Z';
const choice1 = version('choice-1', 'single_choice', 1);
const choice2 = version('choice-2', 'single_choice', 2);
const text1 = version('text-1', 'long_text', 3);
const text2 = version('text-2', 'long_text', 4);
const text3 = version('text-3', 'long_text', 5);
const text4 = version('text-4', 'long_text', 6);
const overflow = version('overflow', 'long_text', 7);

const queue = createLearningSessionTaskQueue({
  firstResourceVersion: choice1,
  currentVersions: [text3, overflow, choice2, text1, choice1, text4, text2],
  createdAt: NOW,
});
assert.equal(queue.targetTaskCount, LEARNING_SESSION_TASK_QUEUE_MAX_COUNT);
assert.deepEqual(queue.resourceVersionIds, [
  'choice-1', 'choice-2', 'text-1', 'text-2', 'text-3', 'text-4',
]);
assert.ok(isLearningSessionTaskQueue(queue));

const first = resolveLearningSessionTaskQueueProgress(queue, 1);
assert.equal(first.currentResourceVersionId, 'choice-1');
assert.equal(first.nextResourceVersionId, 'choice-2');
assert.equal(first.hasNextTask, true);
assert.equal(first.isComplete, false);

const fourth = resolveLearningSessionTaskQueueProgress(queue, 4);
assert.equal(fourth.currentResourceVersionId, 'text-2');
assert.equal(fourth.nextResourceVersionId, 'text-3');
assert.equal(fourth.hasNextTask, true);

const fifth = resolveLearningSessionTaskQueueProgress(queue, 5);
assert.equal(fifth.currentResourceVersionId, 'text-3');
assert.equal(fifth.nextResourceVersionId, 'text-4');
assert.equal(fifth.hasNextTask, true);

const sixth = resolveLearningSessionTaskQueueProgress(queue, 6);
assert.equal(sixth.currentResourceVersionId, 'text-4');
assert.equal(sixth.hasNextTask, false);
assert.equal(sixth.isComplete, true);

const restoredAtThird = createLearningSessionTaskQueue({
  firstResourceVersion: text1,
  currentVersions: [text3, choice2, text1, choice1, text2],
  currentTaskNumber: 3,
  createdAt: NOW,
});
assert.equal(restoredAtThird.resourceVersionIds[2], 'text-1');
assert.equal(
  resolveLearningSessionTaskQueueProgress(restoredAtThird, 3).currentResourceVersionId,
  'text-1',
);

const retest = version('retest-1', 'long_text', 1, 'retest');
const retestQueue = createLearningSessionTaskQueue({
  firstResourceVersion: retest,
  currentVersions: [choice1, choice2, retest],
  createdAt: NOW,
});
assert.deepEqual(retestQueue.resourceVersionIds, ['retest-1']);

const previousFrozen = {
  ...version('text-1-v1', 'long_text', 1),
  status: 'superseded' as const,
};
const successorHead = {
  ...version('text-1-v2', 'long_text', 1),
  resourceId: previousFrozen.resourceId,
};
const recoveredLegacyQueue = createRecoveredLearningSessionTaskQueue({
  previousResourceVersion: previousFrozen,
  currentVersions: [successorHead, choice2, text2, text3],
  currentTaskNumber: 1,
  createdAt: NOW,
});
assert.equal(recoveredLegacyQueue.resourceVersionIds[0], previousFrozen.resourceVersionId);
assert.equal(recoveredLegacyQueue.resourceVersionIds.includes(successorHead.resourceVersionId), false);
assert.equal(recoveredLegacyQueue.resourceVersionIds[1], choice2.resourceVersionId);

assert.equal(isLearningSessionTaskQueue({
  queueVersion: LEARNING_SESSION_TASK_QUEUE_VERSION,
  materialId: 'material-1',
  resourceVersionIds: ['choice-1', 'choice-1'],
  targetTaskCount: 2,
  createdAt: NOW,
}), false);

assert.equal(formatNextTaskAction(2, 6), '进入第 2 题（共 6 题）');
assert.equal(
  formatNextTaskContinuation(2, 6),
  '本题结果已经保存，接下来进入第 2 题（共 6 题）。',
);
assert.equal(shouldSettleTerminalLearningSessionOnExit({
  canAdvance: false,
  sessionComplete: false,
}), true);
assert.equal(shouldSettleTerminalLearningSessionOnExit({
  canAdvance: false,
  sessionComplete: false,
  revision: { status: 'offered' },
}), false);
assert.equal(shouldSettleTerminalLearningSessionOnExit({
  canAdvance: true,
  sessionComplete: false,
}), false);

const executableNextTask = {
  status: 'matched',
  resourceVersion: { resourceVersionId: 'choice-2' },
  qualityGatedTask: { taskId: 'task-choice-2' },
  taskReadiness: { canExecute: true },
};
assert.equal(canAdvanceLearningSessionTaskQueue({
  hasFormalRoundResult: true,
  checkpointStatus: 'completed',
  queueProgress: first,
  nextTaskResolution: executableNextTask,
}), true);
assert.equal(canAdvanceLearningSessionTaskQueue({
  hasFormalRoundResult: false,
  checkpointStatus: 'completed',
  queueProgress: first,
  nextTaskResolution: executableNextTask,
}), false);
assert.equal(canAdvanceLearningSessionTaskQueue({
  hasFormalRoundResult: true,
  checkpointStatus: 'blocked',
  queueProgress: first,
  nextTaskResolution: executableNextTask,
}), false);
assert.equal(canAdvanceLearningSessionTaskQueue({
  hasFormalRoundResult: true,
  checkpointStatus: 'completed',
  queueProgress: first,
  nextTaskResolution: { ...executableNextTask, status: 'no_match' },
}), false);
assert.equal(canAdvanceLearningSessionTaskQueue({
  hasFormalRoundResult: true,
  checkpointStatus: 'completed',
  queueProgress: first,
  nextTaskResolution: { ...executableNextTask, taskReadiness: { canExecute: false } },
}), false);
assert.equal(canAdvanceLearningSessionTaskQueue({
  hasFormalRoundResult: true,
  checkpointStatus: 'completed',
  queueProgress: first,
  nextTaskResolution: {
    ...executableNextTask,
    resourceVersion: { resourceVersionId: 'different-frozen-version' },
  },
}), false);
assert.equal(canAdvanceLearningSessionTaskQueue({
  hasFormalRoundResult: true,
  checkpointStatus: 'completed',
  queueProgress: sixth,
  nextTaskResolution: executableNextTask,
}), false);

assert.equal(shouldRecoverFixedTaskQueueAdmission({
  hasFormalRoundResult: true,
  checkpointStatus: 'completed',
  checkpointNextAction: 'stop',
  queueProgress: first,
  canAdvance: false,
  queueBlocked: false,
}), true);
assert.equal(shouldRecoverFixedTaskQueueAdmission({
  hasFormalRoundResult: false,
  checkpointStatus: 'completed',
  checkpointNextAction: 'stop',
  queueProgress: first,
  canAdvance: false,
  queueBlocked: false,
}), false);
assert.equal(shouldRecoverFixedTaskQueueAdmission({
  hasFormalRoundResult: true,
  checkpointStatus: 'completed',
  checkpointNextAction: 'stop',
  queueProgress: sixth,
  canAdvance: false,
  queueBlocked: false,
}), false);

assert.equal(reusableFixedQueueAdmission({
  plannedResolution: executableNextTask as never,
  expectedResourceVersionId: 'choice-2',
})?.resourceVersion?.resourceVersionId, 'choice-2');
assert.equal(reusableFixedQueueAdmission({
  plannedResolution: executableNextTask as never,
  expectedResourceVersionId: 'different-frozen-version',
}), undefined);

const restoredLegacy = restoreFixedTaskQueueCheckpointFromPersistence({
  checkpoint: {
    status: 'completed',
    nextAction: 'stop',
  } as RealLearningOperationCheckpoint,
  persistence: {
    recordId: 'formal-round-record-1',
    learningRoundResult: {
      status: 'completed',
      executionResult: {
        taskExecutionResult: {
          studentResponse: {
            responseId: 'response-legacy-choice',
            executionSessionId: 'execution-legacy-choice',
            studentId: 'student-local-primary-v1',
            taskId: 'task-choice-1',
            answerText: '',
            responseFormat: 'single_choice',
            singleChoiceAnswer: {
              selectedOptionIds: ['option-2'],
              optionSetVersion: 'option-set-v1',
              displayedOptionOrder: ['option-1', 'option-2'],
            },
            submittedAt: NOW,
            usedHint: false,
            hintCount: 0,
          },
        },
      },
    },
  } as LearningPersistenceRecord,
});
assert.equal(restoredLegacy.changed, true);
assert.equal(restoredLegacy.checkpoint.learningPersistenceRecordId, 'formal-round-record-1');
assert.equal(restoredLegacy.studentResponse?.singleChoiceAnswer?.selectedOptionIds[0], 'option-2');

const resetIncompleteAdmission = restoreFixedTaskQueueCheckpointFromPersistence({
  checkpoint: {
    status: 'blocked',
    stage: 'persisted',
    nextAction: 'prepare_resource',
    nextTaskResolution: {
      status: 'matched',
      taskRequestId: 'legacy-next-request',
      resourceVersion: { resourceVersionId: 'choice-2' } as FrozenQuestionResourceVersion,
      issues: [],
    },
  } as RealLearningOperationCheckpoint,
  persistence: {
    recordId: 'formal-round-record-2',
    learningRoundResult: { status: 'completed' },
  } as LearningPersistenceRecord,
  expectedNextResourceVersionId: 'choice-2',
});
assert.equal(resetIncompleteAdmission.checkpoint.status, 'completed');
assert.equal(resetIncompleteAdmission.checkpoint.nextTaskResolution, undefined);

const normalizedLegacyReview = restoreFixedTaskQueueCheckpointFromPersistence({
  checkpoint: {
    status: 'review_required',
    stage: 'persisted',
    nextAction: 'human_review',
    nextTaskResolution: {
      status: 'matched',
      taskRequestId: 'ready-next-request',
      resourceVersion: { resourceVersionId: 'choice-2' } as FrozenQuestionResourceVersion,
      qualityGatedTask: { taskId: 'task-choice-2' },
      concreteTask: { taskId: 'concrete-choice-2' },
      taskReadiness: { canExecute: true },
      issues: [],
    },
  } as RealLearningOperationCheckpoint,
  persistence: {
    recordId: 'formal-round-record-3',
    learningRoundResult: { status: 'completed' },
  } as LearningPersistenceRecord,
  expectedNextResourceVersionId: 'choice-2',
});
assert.equal(normalizedLegacyReview.checkpoint.status, 'completed');
assert.equal(normalizedLegacyReview.checkpoint.nextAction, 'start_next_task');

const deterministicQueueAdmission = buildFixedQueueAdmissionFromFrozenResource({
  resourceVersion: text1,
  taskRequest: {
    taskRequestId: 'fixed-queue-text-1-request',
    strategyId: 'fixed-queue-text-1-strategy',
    studentId: 'student-local-primary-v1',
    targetAbilityId: text1.abilityMetadata.abilityId,
    taskRole: text1.abilityMetadata.taskRole,
    action: 'continue_training',
    validationGoal: '继续固定题组中的第 2 题。',
    evidenceLinks: ['fixed-queue-text-1-evidence'],
    growthMemoryRecordIds: ['fixed-queue-text-1-memory'],
    constraints: [],
    createdAt: NOW,
  },
  createdAt: NOW,
});
assert.equal(deterministicQueueAdmission.status, 'matched');
assert.equal(deterministicQueueAdmission.resourceVersion?.resourceVersionId, 'text-1');
assert.equal(deterministicQueueAdmission.taskReadiness?.canExecute, true);

console.log('Learning session task queue debug: 49/49 passed.');

function version(
  resourceVersionId: string,
  responseFormat: 'single_choice' | 'long_text',
  rank: number,
  taskRole: 'training' | 'retest' = 'training',
): FrozenQuestionResourceVersion {
  return {
    versionNumber: 1,
    sourceDraftId: `draft-${resourceVersionId}`,
    resourceVersionId,
    resourceId: `resource-${resourceVersionId}`,
    taskId: `task-${resourceVersionId}`,
    materialId: 'material-1',
    status: 'frozen',
    title: `题目 ${resourceVersionId}`,
    questionStem: '请结合材料说明这句话的作用。',
    questionType: responseFormat === 'single_choice' ? 'multiple_choice' : 'reading_comprehension',
    responseFormat,
    assessmentMode: 'training',
    rubric: [{
      itemId: `rubric-${resourceVersionId}`,
      name: '说明文本作用',
      description: '能够结合材料说明具体内容与表达作用。',
      abilityId: 'comprehension',
      importance: 'critical',
      required: true,
      acceptedSignals: ['指出具体内容', '说明表达作用'],
    }],
    minimumAnswerRequirement: responseFormat === 'single_choice'
      ? { responseFormat: 'single_choice', minSelectedOptions: 1, maxSelectedOptions: 1 }
      : { responseFormat, minLength: 10, requireTextEvidence: false, requireExplanation: false },
    tags: [
      'sequence-strategy:entry_first',
      `sequence-rank:${rank}`,
      `sequence-prelude:${responseFormat === 'single_choice' ? 'true' : 'false'}`,
      'sequence-prelude-count:2',
    ],
    abilityMetadata: {
      abilityId: 'comprehension',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole,
      difficulty: 'basic',
    },
    source: { sourceType: 'manual', description: 'debug fixture' },
    materialSnapshot: {
      materialId: 'material-1',
      materialVersionId: 'material-version-1',
      versionNumber: 1,
      title: '调试材料',
      content: '人物先观察周围的变化，随后根据具体线索作出判断。',
      source: { sourceType: 'manual', description: 'debug fixture' },
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 'question_resource_admission_v1',
    },
    validationId: `validation-${resourceVersionId}`,
    reviewId: `review-${resourceVersionId}`,
    frozenAt: NOW,
    updatedAt: NOW,
    version: 'phase16_1a_v1',
    schemaVersion: 'question_resource_admission_v1',
  } as FrozenQuestionResourceVersion;
}
