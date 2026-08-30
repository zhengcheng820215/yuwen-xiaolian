import type { PracticeAttempt } from '../response/practiceResponseTypes.ts';
import type { PracticeResult } from './practiceResultTypes.ts';

export type PracticeResultValidationIssue = { code: string; path: string; message: string };

export function validatePracticeResult(result: PracticeResult, attempt?: PracticeAttempt): { passed: boolean; issues: PracticeResultValidationIssue[] } {
  const issues: PracticeResultValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const base = result?.basePerformance;
  const reinforcement = result?.reinforcementPerformance;
  const timing = result?.timing;
  if (!result || result.schemaVersion !== 1) add('result.schema_invalid', 'schemaVersion', 'Result Schema版本必须为1。');
  if (result?.statementBoundary !== 'current_round_only') add('result.boundary_invalid', 'statementBoundary', 'Result必须限定为本轮事实。');
  if (!result?.sourceSessionId || result.resultId !== `practice-result-${result.sourceSessionId}`) add('result.identity_invalid', 'resultId', 'Result身份非法。');
  if (!result?.completedAt || Number.isNaN(Date.parse(result.completedAt))) add('result.completed_at_invalid', 'completedAt', '完成时间非法。');
  if (!base || ![base.questionCount, base.answeredCount, base.correctCount, base.incorrectCount, base.firstAttemptAccuracy].every(Number.isInteger)) add('result.base_invalid', 'basePerformance', '基础题统计非法。');
  else {
    if (base.correctCount + base.incorrectCount !== base.answeredCount || base.answeredCount !== base.questionCount) add('result.base_count_mismatch', 'basePerformance', '基础题计数不一致。');
    const accuracy = base.questionCount === 0 ? 0 : Math.round((base.correctCount / base.questionCount) * 100);
    if (base.firstAttemptAccuracy !== accuracy) add('result.accuracy_mismatch', 'basePerformance.firstAttemptAccuracy', '首次正确率不一致。');
  }
  if (!reinforcement || ![reinforcement.scheduledCount, reinforcement.answeredCount, reinforcement.correctCount, reinforcement.incorrectCount].every(Number.isInteger)) add('result.reinforcement_invalid', 'reinforcementPerformance', '巩固统计非法。');
  else if (reinforcement.correctCount + reinforcement.incorrectCount !== reinforcement.answeredCount || reinforcement.answeredCount !== reinforcement.scheduledCount) add('result.reinforcement_count_mismatch', 'reinforcementPerformance', '巩固题计数不一致。');
  if (!timing || ![timing.perResponseCapMs, timing.rawDurationMs, timing.effectiveDurationMs, timing.baseEffectiveDurationMs, timing.reinforcementEffectiveDurationMs, timing.cappedResponseCount].every((value) => Number.isInteger(value) && value >= 0)) add('result.timing_invalid', 'timing', '用时统计非法。');
  else {
    if (timing.effectiveDurationMs > timing.rawDurationMs) add('result.timing_exceeds_raw', 'timing.effectiveDurationMs', '有效用时不得超过原始用时。');
    if (timing.effectiveDurationMs !== timing.baseEffectiveDurationMs + timing.reinforcementEffectiveDurationMs) add('result.timing_sum_mismatch', 'timing', '分项用时与总用时不一致。');
  }
  if (!Array.isArray(result?.knowledgePoints) || result.knowledgePoints.reduce((sum, item) => sum + item.baseQuestionCount, 0) !== base?.questionCount) add('result.knowledge_count_mismatch', 'knowledgePoints', '知识点聚合与基础题数不一致。');
  if (!Array.isArray(result?.wrongItems) || result.wrongItems.length !== base?.incorrectCount) add('result.wrong_count_mismatch', 'wrongItems', '错题摘要与基础错误数不一致。');
  if (!Array.isArray(result?.misconceptions)) add('result.misconceptions_invalid', 'misconceptions', '错因摘要非法。');
  if (!result?.recommendation || !['retry_wrong_items', 'start_category_practice', 'start_mixed_practice', 'return_to_learning'].includes(result.recommendation.type)) add('result.recommendation_invalid', 'recommendation', '推荐动作非法。');
  if (attempt) {
    if (result.sourceSessionId !== attempt.session.id || result.completedAt !== attempt.session.completedAt || result.mode !== attempt.session.mode) add('result.source_mismatch', 'sourceSessionId', 'Result与来源Attempt不一致。');
    if (base?.questionCount !== attempt.session.actualBaseQuestionCount) add('result.source_base_count_mismatch', 'basePerformance.questionCount', 'Result与来源基础题数不一致。');
    if (reinforcement?.scheduledCount !== attempt.session.queue.filter((item) => item.role === 'reinforcement').length) add('result.source_reinforcement_mismatch', 'reinforcementPerformance.scheduledCount', 'Result与来源巩固题数不一致。');
  }
  const serialized = JSON.stringify(result || {});
  if (/mastery|AbilityEvidence|StudentAbilityProfile|\"evidence\"/i.test(serialized)) add('result.formal_boundary_violation', '', 'Result不得包含正式能力证据字段。');
  return { passed: issues.length === 0, issues };
}
