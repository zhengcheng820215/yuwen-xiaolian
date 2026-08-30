import {
  knowledgeQuestionRepository,
} from '../questions/knowledgeQuestionRepository.ts';
import type {
  KnowledgeQuestionCategory,
  KnowledgeQuestionRepository,
} from '../questions/knowledgeQuestionTypes.ts';
import { createPracticeSeed, createPracticeSessionId } from './practiceSeed.ts';
import { selectPracticeQuestions } from './selectPracticeQuestions.ts';
import type {
  CompletedPracticeSessionSummary,
  PracticeSession,
  PracticeSessionBuildError,
} from './practiceSessionTypes.ts';
import { validatePracticeSession } from './practiceSessionValidator.ts';

export type BuildPracticeSessionInput = {
  mode: 'category' | 'mixed' | 'mistake_review';
  category?: KnowledgeQuestionCategory;
  questionIds?: string[];
  targetCount?: number;
  recentCompletedSessions?: CompletedPracticeSessionSummary[];
  now?: string;
  idFactory?: () => string;
  repository?: KnowledgeQuestionRepository;
};

export type BuildPracticeSessionResult =
  | { ok: true; session: PracticeSession }
  | { ok: false; error: PracticeSessionBuildError };

const errorMessages: Record<PracticeSessionBuildError['code'], string> = {
  invalid_mode: '当前练习模式不可用。',
  category_required: '请选择一个练习分类。',
  category_not_allowed_for_mixed: '综合练习不需要指定单一分类。',
  target_count_invalid: '当前练习题数设置不正确。',
  no_approved_questions: '当前题库正在准备中，暂时无法开始练习。',
  no_questions_for_category: '当前分类还没有可用题目，可以先选择其他练习。',
  no_questions_for_mistake_review: '本轮错题当前不可重做，可以先选择其他练习。',
  session_identity_failed: '暂时无法创建练习，请稍后重试。',
};

function fail(code: PracticeSessionBuildError['code'], details?: Record<string, unknown>): BuildPracticeSessionResult {
  return { ok: false, error: { code, studentMessage: errorMessages[code], details } };
}

export function buildPracticeSession(input: BuildPracticeSessionInput): BuildPracticeSessionResult {
  if (!['category', 'mixed', 'mistake_review'].includes(input.mode)) return fail('invalid_mode');
  if (input.mode === 'category' && !input.category) return fail('category_required');
  if (input.mode === 'mixed' && input.category) return fail('category_not_allowed_for_mixed');
  if (input.mode === 'mistake_review' && input.category) return fail('category_not_allowed_for_mixed');
  const requestedMistakeIds = [...new Set(input.questionIds || [])].slice(0, 10);
  const targetCount = input.targetCount ?? (input.mode === 'category' ? 5 : input.mode === 'mixed' ? 10 : requestedMistakeIds.length);
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 20) return fail('target_count_invalid');

  const repository = input.repository || knowledgeQuestionRepository;
  const candidates = repository.listApproved(input.mode === 'category' ? { category: input.category } : input.mode === 'mistake_review' ? { ids: requestedMistakeIds } : {});
  if (candidates.length === 0) return fail(input.mode === 'category' ? 'no_questions_for_category' : input.mode === 'mistake_review' ? 'no_questions_for_mistake_review' : 'no_approved_questions');

  const now = input.now || new Date().toISOString();
  let sessionId: string;
  try {
    sessionId = input.idFactory?.() || createPracticeSessionId(now, () => crypto.randomUUID());
  } catch {
    return fail('session_identity_failed');
  }
  const seed = createPracticeSeed(sessionId, input.mode, input.category);
  const selection = input.mode === 'mistake_review'
    ? (() => {
        const byId = new Map(candidates.map((question) => [question.id, question]));
        const questions = requestedMistakeIds.map((id) => byId.get(id)).filter((question): question is NonNullable<typeof question> => Boolean(question)).slice(0, targetCount);
        const categoryCounts: Record<string, number> = {};
        const difficultyCounts: Record<'1' | '2' | '3', number> = { 1: 0, 2: 0, 3: 0 };
        questions.forEach((question) => { categoryCounts[question.category] = (categoryCounts[question.category] || 0) + 1; difficultyCounts[String(question.difficulty) as '1' | '2' | '3'] += 1; });
        return { questions, summary: { candidateCount: candidates.length, selectedCount: questions.length, targetCount, categoryCounts, difficultyCounts, recentQuestionCount: 0, reusedRecentQuestionCount: 0, relaxationCodes: questions.length < targetCount ? ['candidate_shortage' as const] : [] } };
      })()
    : selectPracticeQuestions({
        mode: input.mode,
        category: input.category,
        targetCount,
        seed,
        candidates,
        recentCompletedSessions: input.recentCompletedSessions,
      });
  if (selection.questions.length === 0) return fail(input.mode === 'category' ? 'no_questions_for_category' : input.mode === 'mistake_review' ? 'no_questions_for_mistake_review' : 'no_approved_questions');

  const session: PracticeSession = {
    schemaVersion: 1,
    id: sessionId,
    mode: input.mode,
    ...(input.mode === 'category' ? { category: input.category } : {}),
    seed,
    targetBaseQuestionCount: targetCount,
    actualBaseQuestionCount: selection.questions.length,
    baseQuestionIds: selection.questions.map((question) => question.id),
    queue: selection.questions.map((question, index) => ({
      id: `${sessionId}-base-${index + 1}`,
      questionId: question.id,
      questionContentVersion: question.contentVersion,
      role: 'base',
      status: 'pending',
    })),
    currentIndex: 0,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    selectionSummary: selection.summary,
  };
  const validation = validatePracticeSession(session);
  if (!validation.passed) return fail('session_identity_failed', { issues: validation.issues });
  return { ok: true, session };
}
