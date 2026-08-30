import type { PracticeSession } from './practiceSessionTypes.ts';

export type PracticeSessionValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type PracticeSessionValidationResult = {
  passed: boolean;
  issues: PracticeSessionValidationIssue[];
};

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function validatePracticeSession(session: PracticeSession): PracticeSessionValidationResult {
  const issues: PracticeSessionValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (session.schemaVersion !== 1) add('session.schema_version_invalid', 'schemaVersion', 'Session Schema版本必须为1。');
  if (!session.id || !ID_PATTERN.test(session.id)) add('session.id_invalid', 'id', 'Session ID非法。');
  if (!['category', 'mixed', 'mistake_review'].includes(session.mode)) add('session.mode_invalid', 'mode', 'Session模式非法。');
  if (session.mode === 'category' && !session.category) add('session.category_required', 'category', '专项模式必须指定分类。');
  if (session.mode === 'mixed' && session.category) add('session.category_forbidden', 'category', '综合模式不得指定单一分类。');
  if (session.mode === 'mistake_review' && session.category) add('session.mistake_category_forbidden', 'category', '错题重做模式不得指定单一分类。');
  if (!session.seed) add('session.seed_required', 'seed', 'Session seed不能为空。');
  if (!Number.isInteger(session.targetBaseQuestionCount) || session.targetBaseQuestionCount < 1 || session.targetBaseQuestionCount > 20) {
    add('session.target_count_invalid', 'targetBaseQuestionCount', '目标题数必须为1—20的整数。');
  }
  if (session.actualBaseQuestionCount !== session.baseQuestionIds.length) add('session.actual_count_mismatch', 'actualBaseQuestionCount', '实际题数与基础题ID数量不一致。');
  if (new Set(session.baseQuestionIds).size !== session.baseQuestionIds.length) add('session.base_question_duplicate', 'baseQuestionIds', '基础题ID重复。');
  if (new Set(session.queue.map((item) => item.id)).size !== session.queue.length) add('session.queue_item_duplicate', 'queue', 'Queue Item ID重复。');
  if (new Set(session.queue.map((item) => item.questionId)).size !== session.queue.length) add('session.queue_question_duplicate', 'queue', 'Queue Question ID重复。');
  const queueBaseIds = session.queue.filter((item) => item.role === 'base').map((item) => item.questionId);
  if (JSON.stringify(queueBaseIds) !== JSON.stringify(session.baseQuestionIds)) add('session.queue_question_mismatch', 'queue', 'Queue与基础题ID顺序不一致。');
  const reinforcementItems = session.queue.filter((item) => item.role === 'reinforcement');
  if (session.queue.some((item) => !['base', 'reinforcement'].includes(item.role))) add('session.queue_role_invalid', 'queue', 'Queue Item角色非法。');
  if (session.queue.some((item) => item.role === 'base' && item.sourceQuestionId)) add('session.base_source_forbidden', 'queue', '基础题不得设置来源题。');
  if (reinforcementItems.some((item) => !item.sourceQuestionId)) add('session.reinforcement_source_required', 'queue', '巩固题必须设置来源题。');
  if (reinforcementItems.length > 3) add('session.reinforcement_limit', 'queue', '每个Session最多3道巩固题。');
  if (session.queue.length !== session.actualBaseQuestionCount + reinforcementItems.length) add('session.queue_count_mismatch', 'queue', 'Queue总数与基础题和巩固题数量不一致。');
  const reinforcementSources = reinforcementItems.map((item) => item.sourceQuestionId!);
  if (new Set(reinforcementSources).size !== reinforcementSources.length) add('session.reinforcement_source_duplicate', 'queue', '同一来源题最多安排一道巩固题。');
  for (const [index, item] of session.queue.entries()) {
    if (item.role !== 'reinforcement') continue;
    const sourceIndex = session.queue.findIndex((candidate) => candidate.role === 'base' && candidate.questionId === item.sourceQuestionId);
    if (sourceIndex < 0) add('session.reinforcement_source_missing', `queue.${index}.sourceQuestionId`, '巩固题来源不在基础题集合中。');
    else if (sourceIndex >= index) add('session.reinforcement_order_invalid', `queue.${index}`, '巩固题必须位于来源题之后。');
  }
  if (session.queue.some((item) => !Number.isInteger(item.questionContentVersion) || item.questionContentVersion < 1)) {
    add('session.question_version_invalid', 'queue', 'Queue题目内容版本非法。');
  }
  if (session.queue.length === 0 || !Number.isInteger(session.currentIndex) || session.currentIndex < 0 || session.currentIndex >= session.queue.length) {
    add('session.current_index_invalid', 'currentIndex', '当前题索引越界。');
  }
  if (!['active', 'completed', 'abandoned'].includes(session.status)) add('session.status_invalid', 'status', 'Session状态非法。');
  if (!validTime(session.startedAt) || !validTime(session.updatedAt)) add('session.timestamp_invalid', 'startedAt', 'Session时间非法。');
  if (session.status === 'completed') {
    if (!validTime(session.completedAt) || session.queue.some((item) => item.status !== 'answered')) {
      add('session.completed_state_inconsistent', 'completedAt', '完成态必须有完成时间且所有题已作答。');
    }
  }
  if (session.status === 'abandoned' && !validTime(session.abandonedAt)) add('session.abandoned_state_inconsistent', 'abandonedAt', '放弃态必须有放弃时间。');
  return { passed: issues.length === 0, issues };
}

function validTime(value: string | undefined): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
