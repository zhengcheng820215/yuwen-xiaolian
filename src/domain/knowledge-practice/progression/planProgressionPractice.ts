import type { KnowledgeQuestion, KnowledgeQuestionCategory } from '../questions/knowledgeQuestionTypes.ts';
import type { CompletedPracticeSessionSummary, PracticeSelectionSummary } from '../practice/practiceSessionTypes.ts';
import { selectPracticeQuestions } from '../practice/selectPracticeQuestions.ts';
import {
  selectDueProgressionQuestions,
  type DueProgressionAssignment,
  type DueProgressionBlock,
  type KnowledgePointProgress,
} from './knowledgePointProgression.ts';
import type { ProgressionContentReadiness } from './progressionContentReadiness.ts';

export type ProgressionPracticePlan = {
  questions: KnowledgeQuestion[];
  dueAssignments: DueProgressionAssignment[];
  blocked: DueProgressionBlock[];
  ordinarySummary?: PracticeSelectionSummary;
  targetCount: number;
};

/** A task-first, non-mutating plan. The caller must freeze role/task IDs in the session before using it live. */
export function planProgressionPractice(input: {
  mode: 'category' | 'mixed';
  category?: KnowledgeQuestionCategory;
  targetCount: number;
  seed: string;
  now: string;
  candidates: KnowledgeQuestion[];
  recentCompletedSessions?: CompletedPracticeSessionSummary[];
  progress: KnowledgePointProgress[];
  readiness: ProgressionContentReadiness[];
}): ProgressionPracticePlan {
  if (!Number.isInteger(input.targetCount) || input.targetCount < 1 || input.targetCount > 20) {
    throw new RangeError('targetCount must be an integer between 1 and 20.');
  }
  if (input.mode === 'category' && !input.category) throw new Error('Category mode requires a category.');
  if (!Number.isFinite(Date.parse(input.now))) throw new Error('Invalid planning time.');
  const approved = input.candidates.filter((question) => question.contentStatus === 'approved'
    && question.grade === '七年级' && question.semester === '上'
    && (input.mode !== 'category' || question.category === input.category));
  const bankById = new Map(approved.map((question) => [question.id, question]));
  const ready = input.readiness.filter((item) => item.ready && item.rules.contentApprovedForProgression);
  const due = selectDueProgressionQuestions({
    progress: input.progress,
    rules: input.readiness.map((item) => item.rules),
    questions: ready.flatMap((item) => item.eligibleQuestions)
      .filter((question) => bankById.get(question.id)?.contentVersion === question.contentVersion),
    now: input.now,
    capacity: input.targetCount,
    ...(input.mode === 'category' ? { category: input.category } : {}),
  });
  const assignedQuestions = due.assignments.map((assignment) => bankById.get(assignment.questionId)!)
    .filter(Boolean);
  const protectedIds = new Set(ready.flatMap((item) => item.protectedQuestionIds));
  const assignedGroups = new Set(assignedQuestions.map((question) => question.variantGroupId).filter((id): id is string => Boolean(id)));
  const ordinaryCandidates = approved.filter((question) => !protectedIds.has(question.id)
    && !assignedGroups.has(question.variantGroupId || ''));
  const remaining = input.targetCount - assignedQuestions.length;
  const ordinary = remaining > 0 && ordinaryCandidates.length > 0
    ? selectPracticeQuestions({
      mode: input.mode,
      category: input.category,
      targetCount: remaining,
      seed: `${input.seed}:ordinary`,
      candidates: ordinaryCandidates,
      recentCompletedSessions: input.recentCompletedSessions,
    })
    : undefined;
  return {
    questions: [...assignedQuestions, ...(ordinary?.questions || [])],
    dueAssignments: due.assignments,
    blocked: due.blocked,
    ordinarySummary: ordinary?.summary,
    targetCount: input.targetCount,
  };
}
