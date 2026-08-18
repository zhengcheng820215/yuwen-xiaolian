import {
  LEARNING_PERSISTENCE_SCHEMA_VERSION,
  LEARNING_PERSISTENCE_VERSION,
  type LearningPersistenceInput,
  type LearningPersistenceRecord,
  type LearningResumeMode,
  type RestoredLearningState,
  isLearningPersistenceRecord,
} from '../schemas/learningPersistence.schema.ts';
import type { LearningPersistenceRepository } from '../repositories/learningPersistenceRepository.ts';

export function createLearningPersistenceRecord(
  input: LearningPersistenceInput,
): LearningPersistenceRecord {
  const savedAt = input.savedAt || new Date().toISOString();
  const updatedAt = input.updatedAt || savedAt;
  const record: LearningPersistenceRecord = {
    recordId: buildRecordId(input.studentId, input.learningRoundId),
    studentId: input.studentId,
    learningRoundId: input.learningRoundId,
    savedAt,
    updatedAt,
    version: LEARNING_PERSISTENCE_VERSION,
    schemaVersion: LEARNING_PERSISTENCE_SCHEMA_VERSION,
    sourceVersion: input.sourceVersion,
    learningRoundResult: input.learningRoundResult,
    concreteTask: input.concreteTask,
    answerDraft: input.answerDraft,
    singleChoiceDraft: input.singleChoiceDraft,
    studentResponse: input.studentResponse,
    studentLearningFeedback: input.studentLearningFeedback,
    studentRoundSummary: input.studentRoundSummary,
    growthMemoryRecord: input.growthMemoryRecord,
    growthMemorySummary: input.growthMemorySummary,
    studentAbilityProfile: input.studentAbilityProfile,
    status: 'saved',
    issues: [],
  };
  const issues = validatePersistenceRecord(record);

  return {
    ...record,
    status: issues.length > 0 ? 'invalid' : 'saved',
    issues,
  };
}

export async function saveLearningPersistenceRecord(
  repository: LearningPersistenceRepository,
  input: LearningPersistenceInput,
): Promise<LearningPersistenceRecord> {
  const record = createLearningPersistenceRecord(input);
  return repository.save(record);
}

export async function restoreLatestLearningState(
  repository: LearningPersistenceRepository,
  studentId: string,
): Promise<RestoredLearningState> {
  const record = await repository.loadLatest(studentId);

  return restoreLearningState(record, studentId);
}

export function restoreLearningState(
  record: LearningPersistenceRecord | null,
  expectedStudentId: string,
): RestoredLearningState {
  if (!record) {
    return buildCannotRestoreState({
      studentId: expectedStudentId,
      learningRoundId: 'unknown',
      issues: ['No persistence record found.'],
    });
  }

  const issues = validateRestoreRecord(record, expectedStudentId);
  const resumeMode = issues.length > 0 ? 'cannot_restore' : determineResumeMode(record);

  if (resumeMode === 'cannot_restore') {
    return buildCannotRestoreState({
      studentId: expectedStudentId,
      learningRoundId: record.learningRoundId,
      record,
      issues: issues.length > 0 ? issues : ['Record cannot be restored.'],
    });
  }

  return {
    studentId: record.studentId,
    learningRoundId: record.learningRoundId,
    canResume: true,
    resumeMode,
    restoredRecord: {
      ...record,
      status: 'restore_ready',
      issues: [],
    },
    studentVisibleState: buildStudentVisibleState(resumeMode),
    validation: {
      passed: true,
      issues: [],
    },
  };
}

export function validatePersistenceRecord(record: LearningPersistenceRecord): string[] {
  const issues: string[] = [];

  if (!isLearningPersistenceRecord(record)) {
    issues.push('LearningPersistenceRecord schema validation failed.');
  }
  issues.push(...validateInternalIdentity(record));

  if (record.learningRoundResult?.status === 'completed' && !record.studentRoundSummary) {
    issues.push('Completed learning round is missing StudentRoundSummary.');
  }
  if (!record.learningRoundResult && !record.concreteTask && !record.answerDraft && !record.singleChoiceDraft) {
    issues.push('Record has no restorable learning state.');
  }

  return uniqueStrings(issues);
}

export function validateRestoreRecord(
  record: LearningPersistenceRecord,
  expectedStudentId: string,
): string[] {
  const issues = validatePersistenceRecord(record);

  if (record.studentId !== expectedStudentId) {
    issues.push('studentId mismatch.');
  }
  if (record.version !== LEARNING_PERSISTENCE_VERSION) {
    issues.push('Unsupported persistence version.');
  }
  if (record.schemaVersion !== LEARNING_PERSISTENCE_SCHEMA_VERSION) {
    issues.push('Unsupported schemaVersion.');
  }

  return uniqueStrings(issues);
}

export function resolveRestoredFormalResourceVersionId(input: {
  checkpointSourceResourceVersionId?: string;
  persistenceRecord?: LearningPersistenceRecord | null;
}): string | undefined {
  const checkpointVersionId = input.checkpointSourceResourceVersionId?.trim();
  if (checkpointVersionId) return checkpointVersionId;

  const task = input.persistenceRecord?.concreteTask;
  if (task?.sourceType !== 'matched_resource') return undefined;
  const persistedVersionId = task.questionMetadata?.questionId?.trim();
  return persistedVersionId || undefined;
}

function determineResumeMode(record: LearningPersistenceRecord): LearningResumeMode {
  if (record.learningRoundResult?.status === 'completed') {
    return record.growthMemorySummary ? 'start_next_round' : 'view_completed_round';
  }
  if (record.learningRoundResult && record.studentRoundSummary) {
    return 'view_completed_round';
  }
  if (record.concreteTask || typeof record.answerDraft === 'string' || record.singleChoiceDraft) {
    return 'continue_unfinished_round';
  }

  return 'cannot_restore';
}

function validateInternalIdentity(record: LearningPersistenceRecord): string[] {
  const issues: string[] = [];
  const { studentId, learningRoundId } = record;

  if (record.learningRoundResult) {
    if (record.learningRoundResult.studentId !== studentId) {
      issues.push('LearningRoundResult.studentId does not match record.studentId.');
    }
    if (record.learningRoundResult.learningRoundId !== learningRoundId) {
      issues.push('LearningRoundResult.learningRoundId does not match record.learningRoundId.');
    }
  }
  if (record.studentLearningFeedback) {
    if (record.studentLearningFeedback.studentId !== studentId) {
      issues.push('StudentLearningFeedback.studentId does not match record.studentId.');
    }
    if (record.studentLearningFeedback.learningRoundId !== learningRoundId) {
      issues.push('StudentLearningFeedback.learningRoundId does not match record.learningRoundId.');
    }
  }
  if (record.studentRoundSummary) {
    if (record.studentRoundSummary.studentId !== studentId) {
      issues.push('StudentRoundSummary.studentId does not match record.studentId.');
    }
    if (record.studentRoundSummary.learningRoundId !== learningRoundId) {
      issues.push('StudentRoundSummary.learningRoundId does not match record.learningRoundId.');
    }
  }
  if (record.studentResponse) {
    if (record.studentResponse.studentId !== studentId) {
      issues.push('StudentResponse.studentId does not match record.studentId.');
    }
    if (record.concreteTask && record.studentResponse.taskId !== record.concreteTask.taskId) {
      issues.push('StudentResponse.taskId does not match ConcreteLearningTask.taskId.');
    }
  }
  if (record.growthMemorySummary && record.growthMemorySummary.studentId !== studentId) {
    issues.push('GrowthMemorySummary.studentId does not match record.studentId.');
  }
  if (record.growthMemoryRecord && record.growthMemoryRecord.studentId !== studentId) {
    issues.push('GrowthMemoryRecord.studentId does not match record.studentId.');
  }
  if (record.studentAbilityProfile && record.studentAbilityProfile.studentId !== studentId) {
    issues.push('StudentAbilityProfile.studentId does not match record.studentId.');
  }

  return issues;
}

function buildCannotRestoreState(input: {
  studentId: string;
  learningRoundId: string;
  record?: LearningPersistenceRecord;
  issues: string[];
}): RestoredLearningState {
  return {
    studentId: input.studentId,
    learningRoundId: input.learningRoundId,
    canResume: false,
    resumeMode: 'cannot_restore',
    restoredRecord: input.record
      ? {
        ...input.record,
        status: 'restore_failed',
        issues: input.issues,
      }
      : undefined,
    studentVisibleState: {
      title: '暂时无法恢复学习',
      message: '保存的学习状态不完整或版本不兼容，请重新开始。',
      primaryActionText: '重新开始',
    },
    validation: {
      passed: false,
      issues: input.issues,
    },
  };
}

function buildStudentVisibleState(resumeMode: LearningResumeMode): RestoredLearningState['studentVisibleState'] {
  if (resumeMode === 'continue_unfinished_round') {
    return {
      title: '继续上次学习',
      message: '已恢复未完成的任务和答案草稿，可以继续作答。',
      primaryActionText: '继续作答',
    };
  }
  if (resumeMode === 'view_completed_round') {
    return {
      title: '查看上次学习结果',
      message: '已恢复本轮结束页，可以继续查看反馈。',
      primaryActionText: '查看结果',
    };
  }
  if (resumeMode === 'start_next_round') {
    return {
      title: '可以开始下一轮',
      message: '上次学习结果已恢复，可以作为下一轮学习的基础。',
      primaryActionText: '开始下一轮',
    };
  }

  return {
    title: '暂时无法恢复学习',
    message: '保存的学习状态不完整或版本不兼容，请重新开始。',
    primaryActionText: '重新开始',
  };
}

function buildRecordId(studentId: string, learningRoundId: string): string {
  return `${studentId}::${learningRoundId}`;
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}
