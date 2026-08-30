import { validatePracticeSession } from '../practice/practiceSessionValidator.ts';
import type { PracticeAttempt } from './practiceResponseTypes.ts';

export type PracticeAttemptValidationIssue = { code: string; path: string; message: string };
export type PracticeAttemptValidationResult = { passed: boolean; issues: PracticeAttemptValidationIssue[] };

function validTime(value: string | undefined): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
export function validatePracticeAttempt(attempt: PracticeAttempt): PracticeAttemptValidationResult {
  const issues: PracticeAttemptValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (!attempt || attempt.schemaVersion !== 1) add('attempt.schema_version_invalid', 'schemaVersion', 'Attempt Schema版本必须为1。');
  if (!attempt?.session) return { passed: false, issues: [...issues, { code: 'attempt.session_required', path: 'session', message: 'Attempt必须包含Session。' }] };
  for (const issue of validatePracticeSession(attempt.session).issues) add(`attempt.${issue.code}`, `session.${issue.path}`, issue.message);
  if (!Array.isArray(attempt.responses)) add('attempt.responses_invalid', 'responses', 'Responses必须是数组。');
  if (!attempt.feedbackByResponseId || typeof attempt.feedbackByResponseId !== 'object') add('attempt.feedback_invalid', 'feedbackByResponseId', 'Feedback索引非法。');
  if (!validTime(attempt.currentQuestionPresentedAt) || !validTime(attempt.updatedAt)) add('attempt.timestamp_invalid', 'currentQuestionPresentedAt', 'Attempt时间非法。');
  if (issues.some((issue) => ['attempt.responses_invalid', 'attempt.feedback_invalid'].includes(issue.code))) return { passed: false, issues };

  const queueById = new Map(attempt.session.queue.map((item) => [item.id, item]));
  const responseKeys = new Set<string>();
  const responseIds = new Set<string>();
  for (const [index, response] of attempt.responses.entries()) {
    const path = `responses.${index}`;
    if (response.schemaVersion !== 1) add('attempt.response_schema_invalid', `${path}.schemaVersion`, 'Response Schema版本非法。');
    if (response.sessionId !== attempt.session.id) add('attempt.response_session_mismatch', `${path}.sessionId`, 'Response与Session不一致。');
    const queueItem = queueById.get(response.queueItemId);
    if (!queueItem) add('attempt.response_queue_missing', `${path}.queueItemId`, 'Response引用的Queue Item不存在。');
    if (queueItem && (queueItem.questionId !== response.questionId || queueItem.questionContentVersion !== response.questionContentVersion || queueItem.role !== response.role || queueItem.sourceQuestionId !== response.sourceQuestionId)) {
      add('attempt.response_queue_mismatch', path, 'Response与Queue Item身份不一致。');
    }
    if (responseKeys.has(response.responseKey)) add('attempt.response_key_duplicate', `${path}.responseKey`, 'Response Key重复。');
    responseKeys.add(response.responseKey);
    if (responseIds.has(response.id)) add('attempt.response_id_duplicate', `${path}.id`, 'Response ID重复。');
    responseIds.add(response.id);
    if (!Number.isInteger(response.durationMs) || response.durationMs < 0) add('attempt.response_duration_invalid', `${path}.durationMs`, 'Response作答时长非法。');
    if (!validTime(response.answeredAt)) add('attempt.response_time_invalid', `${path}.answeredAt`, 'Response提交时间非法。');
    const feedback = attempt.feedbackByResponseId[response.id];
    if (!feedback || feedback.responseId !== response.id) add('attempt.response_feedback_missing', `${path}.id`, 'Response缺少对应Feedback。');
  }
  for (const responseId of Object.keys(attempt.feedbackByResponseId)) {
    if (!responseIds.has(responseId)) add('attempt.feedback_response_missing', `feedbackByResponseId.${responseId}`, 'Feedback引用不存在的Response。');
  }
  for (const [index, item] of attempt.session.queue.entries()) {
    const responseCount = attempt.responses.filter((response) => response.queueItemId === item.id).length;
    if (item.status === 'answered' && responseCount !== 1) add('attempt.answered_response_mismatch', `session.queue.${index}`, 'answered Queue Item必须有且只有一条Response。');
    if (item.status === 'pending' && responseCount !== 0) add('attempt.pending_response_mismatch', `session.queue.${index}`, 'pending Queue Item不得存在Response。');
    if (index < attempt.session.currentIndex && item.status !== 'answered') add('attempt.previous_item_pending', `session.queue.${index}`, '当前索引之前的题必须已作答。');
    if (index > attempt.session.currentIndex && item.status !== 'pending') add('attempt.future_item_answered', `session.queue.${index}`, '当前索引之后的题必须待作答。');
  }
  return { passed: issues.length === 0, issues };
}
