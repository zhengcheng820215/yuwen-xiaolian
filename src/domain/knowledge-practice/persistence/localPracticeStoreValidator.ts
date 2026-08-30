import { validatePracticeAttempt } from '../response/practiceAttemptValidator.ts';
import { validatePracticeResult } from '../result/practiceResultValidator.ts';
import { buildPracticeCompletionRecord } from './buildPracticeCompletionRecord.ts';
import {
  PRACTICE_COMPLETED_SESSION_LIMIT,
  PRACTICE_MISTAKE_LIMIT,
  PRACTICE_STORE_MAX_BYTES,
  type LocalPracticeStoreV1,
  type PersistedKnowledgeMistake,
  type PracticeStoreIssue,
} from './localPracticeStoreTypes.ts';

const ROOT_KEYS = new Set(['schemaVersion', 'revision', 'activeAttempt', 'completedSessions', 'lastCompletion', 'mistakes', 'lastAbandonedSessionId', 'updatedAt', 'writerId']);
const validTime = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

export function validatePersistedMistake(value: unknown): value is PersistedKnowledgeMistake {
  if (!value || typeof value !== 'object') return false;
  const item = value as PersistedKnowledgeMistake;
  return item.schemaVersion === 1
    && typeof item.questionId === 'string' && item.questionId.length > 0
    && Number.isInteger(item.questionContentVersion) && item.questionContentVersion > 0
    && typeof item.category === 'string' && typeof item.knowledgePoint === 'string'
    && typeof item.stemSnapshot === 'string' && typeof item.wrongAnswer === 'string'
    && typeof item.correctAnswerText === 'string' && typeof item.explanationSnapshot === 'string'
    && typeof item.responseId === 'string' && item.responseId.length > 0
    && (item.status === 'active' || item.status === 'resolved')
    && validTime(item.firstWrongAt) && validTime(item.lastWrongAt);
}

export function validateLocalPracticeStore(value: unknown): { passed: boolean; issues: PracticeStoreIssue[] } {
  const issues: PracticeStoreIssue[] = [];
  const add = (code: string, path: string, message: string, severity: 'error' | 'warning' = 'error') => issues.push({ code, path, message, severity });
  if (!value || typeof value !== 'object') return { passed: false, issues: [{ severity: 'error', code: 'store.invalid', path: '', message: '存储根对象非法。' }] };
  const store = value as LocalPracticeStoreV1;
  if (store.schemaVersion !== 1) add('store.schema_version_invalid', 'schemaVersion', 'Store Schema版本必须为1。');
  if (!Number.isInteger(store.revision) || store.revision < 0) add('store.revision_invalid', 'revision', 'revision必须为非负整数。');
  if (!validTime(store.updatedAt)) add('store.updated_at_invalid', 'updatedAt', '更新时间非法。');
  if (typeof store.writerId !== 'string' || !store.writerId.trim()) add('store.writer_id_invalid', 'writerId', 'writerId不能为空。');
  for (const key of Object.keys(store)) if (!ROOT_KEYS.has(key)) add('store.unknown_root_field', key, 'Store包含未知顶层字段。');

  if (store.activeAttempt !== null) {
    const validation = validatePracticeAttempt(store.activeAttempt);
    for (const issue of validation.issues) add(`store.${issue.code}`, `activeAttempt.${issue.path}`, issue.message);
    if (store.activeAttempt?.session?.status !== 'active') add('store.active_attempt_status_invalid', 'activeAttempt.session.status', 'active Attempt的Session必须为active。');
  }

  if (!Array.isArray(store.completedSessions)) add('store.completed_sessions_invalid', 'completedSessions', '完成历史必须为数组。');
  else {
    if (store.completedSessions.length > PRACTICE_COMPLETED_SESSION_LIMIT) add('store.completed_sessions_limit', 'completedSessions', '完成历史超过10条。');
    const ids = new Set<string>();
    store.completedSessions.forEach((item, index) => {
      if (!item || typeof item.sessionId !== 'string' || !validTime(item.completedAt) || !Array.isArray(item.baseQuestionIds)) add('store.completed_session_invalid', `completedSessions.${index}`, '完成摘要非法。');
      if (ids.has(item?.sessionId)) add('store.completed_session_duplicate', `completedSessions.${index}.sessionId`, '完成摘要Session ID重复。');
      ids.add(item?.sessionId);
    });
  }

  if (store.lastCompletion !== null) {
    const record = store.lastCompletion;
    if (!record || ![1, 2].includes(record.schemaVersion) || record.sessionId !== record.completedAttempt?.session?.id || record.completedAt !== record.completedAttempt?.session?.completedAt) {
      add('store.completion_identity_invalid', 'lastCompletion', '完成记录身份非法。');
    } else {
      const attemptValidation = validatePracticeAttempt(record.completedAttempt);
      for (const issue of attemptValidation.issues) add(`store.completion_${issue.code}`, `lastCompletion.completedAttempt.${issue.path}`, issue.message);
      if (record.completedAttempt.session.status !== 'completed') add('store.completion_status_invalid', 'lastCompletion.completedAttempt.session.status', '完成记录必须包含completed Attempt。');
      try {
        const expected = buildPracticeCompletionRecord(record.completedAttempt);
        if (JSON.stringify(record.summary) !== JSON.stringify(expected.summary)) add('store.completion_summary_mismatch', 'lastCompletion.summary', '完成摘要与Attempt事实不一致。');
        if (record.schemaVersion === 2) {
          const resultValidation = validatePracticeResult(record.result, record.completedAttempt);
          for (const item of resultValidation.issues) add(`store.${item.code}`, `lastCompletion.result.${item.path}`, item.message);
          if (JSON.stringify(record.result) !== JSON.stringify(expected.result)) add('store.completion_result_mismatch', 'lastCompletion.result', '练习结果与Attempt事实不一致。');
        }
      } catch { add('store.completion_invalid', 'lastCompletion', '无法生成完成摘要。'); }
    }
  }
  if (store.activeAttempt?.session && store.lastCompletion?.sessionId === store.activeAttempt.session.id) add('store.active_completion_conflict', 'activeAttempt.session.id', 'active与最近完成记录不能是同一Session。');

  if (!Array.isArray(store.mistakes)) add('store.mistakes_invalid', 'mistakes', '错题必须为数组。');
  else {
    if (store.mistakes.length > PRACTICE_MISTAKE_LIMIT) add('store.mistakes_limit', 'mistakes', '错题超过200条。');
    const ids = new Set<string>();
    store.mistakes.forEach((item, index) => {
      if (!validatePersistedMistake(item)) add('store.mistake_invalid', `mistakes.${index}`, '错题记录非法。');
      if (ids.has(item?.questionId)) add('store.mistake_duplicate', `mistakes.${index}.questionId`, '错题Question ID重复。');
      ids.add(item?.questionId);
    });
  }
  try {
    if (new TextEncoder().encode(JSON.stringify(store)).length > PRACTICE_STORE_MAX_BYTES) add('store.size_limit', '', '练习数据超过本地存储软限制。');
  } catch { add('store.serialization_failed', '', '练习数据无法序列化。'); }
  return { passed: !issues.some((issue) => issue.severity === 'error'), issues };
}
