import type { KnowledgeQuestion, KnowledgeQuestionCategory } from '../questions/knowledgeQuestionTypes.ts';
import { seededShuffle } from './practiceSeed.ts';
import type {
  CompletedPracticeSessionSummary,
  PracticeSelectionRelaxationCode,
  PracticeSelectionSummary,
} from './practiceSessionTypes.ts';

export type SelectPracticeQuestionsInput = {
  mode: 'category' | 'mixed';
  category?: KnowledgeQuestionCategory;
  targetCount?: number;
  seed: string;
  candidates: KnowledgeQuestion[];
  recentCompletedSessions?: CompletedPracticeSessionSummary[];
};

export type SelectPracticeQuestionsResult = {
  questions: KnowledgeQuestion[];
  summary: PracticeSelectionSummary;
};

type RankedQuestion = {
  question: KnowledgeQuestion;
  recentRank: 0 | 1 | 2;
  randomRank: number;
};

const DEFAULT_CATEGORY_COUNT = 5;
const DEFAULT_MIXED_COUNT = 10;

function difficultyTargets(targetCount: number): Record<1 | 2 | 3, number> {
  const ratios = [0.4, 0.4, 0.2];
  const floors = ratios.map((ratio) => Math.floor(targetCount * ratio));
  let remaining = targetCount - floors.reduce((sum, count) => sum + count, 0);
  for (let index = 0; remaining > 0; index = (index + 1) % 3) {
    floors[index] += 1;
    remaining -= 1;
  }
  return { 1: floors[0], 2: floors[1], 3: floors[2] };
}

function uniqueCandidates(candidates: KnowledgeQuestion[], category?: KnowledgeQuestionCategory): KnowledgeQuestion[] {
  const byId = new Map<string, KnowledgeQuestion>();
  for (const question of candidates) {
    if (question.contentStatus !== 'approved' || question.grade !== '七年级' || question.semester !== '上') continue;
    if (category && question.category !== category) continue;
    if (!byId.has(question.id)) byId.set(question.id, question);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function recentMaps(sessions: CompletedPracticeSessionSummary[] = []): {
  recentRankById: Map<string, 1 | 2>;
  recentQuestionCount: number;
} {
  const recent = [...sessions]
    .filter((session) => session.completedAt && Array.isArray(session.baseQuestionIds))
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, 2);
  const map = new Map<string, 1 | 2>();
  recent.forEach((session, index) => {
    const rank = (index === 0 ? 2 : 1) as 1 | 2;
    for (const id of session.baseQuestionIds) {
      if (!map.has(id)) map.set(id, rank);
    }
  });
  return { recentRankById: map, recentQuestionCount: map.size };
}

function rankCandidates(
  candidates: KnowledgeQuestion[],
  seed: string,
  recentRankById: Map<string, 1 | 2>,
): RankedQuestion[] {
  const shuffled = seededShuffle(candidates, `${seed}:questions`);
  return shuffled.map((question, randomRank) => ({
    question,
    recentRank: recentRankById.get(question.id) || 0,
    randomRank,
  }));
}

function canUseVariant(question: KnowledgeQuestion, usedGroups: Set<string>): boolean {
  return !question.variantGroupId || !usedGroups.has(question.variantGroupId);
}

function addQuestion(
  ranked: RankedQuestion,
  selected: RankedQuestion[],
  selectedIds: Set<string>,
  usedGroups: Set<string>,
): void {
  selected.push(ranked);
  selectedIds.add(ranked.question.id);
  if (ranked.question.variantGroupId) usedGroups.add(ranked.question.variantGroupId);
}

function difficultyNeed(
  difficulty: 1 | 2 | 3,
  selected: RankedQuestion[],
  targets: Record<1 | 2 | 3, number>,
): number {
  return targets[difficulty] - selected.filter((item) => item.question.difficulty === difficulty).length;
}

function sortForNeed(
  pool: RankedQuestion[],
  selected: RankedQuestion[],
  targets: Record<1 | 2 | 3, number>,
): RankedQuestion[] {
  return [...pool].sort((left, right) => {
    const needDifference = difficultyNeed(right.question.difficulty, selected, targets) - difficultyNeed(left.question.difficulty, selected, targets);
    if (needDifference !== 0) return needDifference;
    if (left.recentRank !== right.recentRank) return left.recentRank - right.recentRank;
    if (left.randomRank !== right.randomRank) return left.randomRank - right.randomRank;
    return left.question.id.localeCompare(right.question.id);
  });
}

function pickUntil(
  ranked: RankedQuestion[],
  selected: RankedQuestion[],
  targetCount: number,
  usedGroups: Set<string>,
  allowedRecentRank: 0 | 1 | 2,
  targets: Record<1 | 2 | 3, number>,
  categoryCap?: number,
): void {
  const selectedIds = new Set(selected.map((item) => item.question.id));
  let progress = true;
  while (selected.length < targetCount && progress) {
    progress = false;
    const candidates = sortForNeed(
      ranked.filter((item) => !selectedIds.has(item.question.id) && item.recentRank <= allowedRecentRank),
      selected,
      targets,
    );
    for (const item of candidates) {
      if (!canUseVariant(item.question, usedGroups)) continue;
      if (categoryCap !== undefined) {
        const categoryCount = selected.filter((chosen) => chosen.question.category === item.question.category).length;
        if (categoryCount >= categoryCap) continue;
      }
      addQuestion(item, selected, selectedIds, usedGroups);
      progress = true;
      break;
    }
  }
}

function addCoverageQuestions(
  ranked: RankedQuestion[],
  selected: RankedQuestion[],
  targetCount: number,
  usedGroups: Set<string>,
  seed: string,
): void {
  const categories = seededShuffle(
    [...new Set(ranked.map((item) => item.question.category))].sort(),
    `${seed}:categories`,
  );
  const selectedIds = new Set<string>();
  for (const category of categories) {
    if (selected.length >= targetCount) break;
    const candidate = ranked
      .filter((item) => item.question.category === category && canUseVariant(item.question, usedGroups))
      .sort((left, right) => left.recentRank - right.recentRank || left.randomRank - right.randomRank)[0];
    if (!candidate) continue;
    addQuestion(candidate, selected, selectedIds, usedGroups);
  }
}

function summarize(
  selected: RankedQuestion[],
  candidateCount: number,
  targetCount: number,
  recentQuestionCount: number,
  difficultyTarget: Record<1 | 2 | 3, number>,
  extraRelaxations: PracticeSelectionRelaxationCode[],
): PracticeSelectionSummary {
  const categoryCounts: Record<string, number> = {};
  const difficultyCounts: Record<'1' | '2' | '3', number> = { 1: 0, 2: 0, 3: 0 };
  for (const item of selected) {
    categoryCounts[item.question.category] = (categoryCounts[item.question.category] || 0) + 1;
    difficultyCounts[String(item.question.difficulty) as '1' | '2' | '3'] += 1;
  }
  const relaxations = new Set<PracticeSelectionRelaxationCode>(extraRelaxations);
  if (selected.length < targetCount) relaxations.add('candidate_shortage');
  if (selected.some((item) => item.recentRank === 1)) relaxations.add('recent_second_session_reused');
  if (selected.some((item) => item.recentRank === 2)) relaxations.add('recent_latest_session_reused');
  if ([1, 2, 3].some((difficulty) => difficultyCounts[String(difficulty) as '1' | '2' | '3'] !== difficultyTarget[difficulty as 1 | 2 | 3])) {
    relaxations.add('difficulty_quota_relaxed');
  }
  return {
    candidateCount,
    selectedCount: selected.length,
    targetCount,
    categoryCounts,
    difficultyCounts,
    recentQuestionCount,
    reusedRecentQuestionCount: selected.filter((item) => item.recentRank > 0).length,
    relaxationCodes: [...relaxations],
  };
}

export function selectPracticeQuestions(input: SelectPracticeQuestionsInput): SelectPracticeQuestionsResult {
  const targetCount = input.targetCount ?? (input.mode === 'category' ? DEFAULT_CATEGORY_COUNT : DEFAULT_MIXED_COUNT);
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 20) {
    throw new RangeError('targetCount must be an integer between 1 and 20.');
  }
  const clean = uniqueCandidates(input.candidates, input.mode === 'category' ? input.category : undefined);
  const recent = recentMaps(input.recentCompletedSessions);
  const ranked = rankCandidates(clean, input.seed, recent.recentRankById);
  const selected: RankedQuestion[] = [];
  const usedGroups = new Set<string>();
  const targets = difficultyTargets(targetCount);
  const relaxations: PracticeSelectionRelaxationCode[] = [];

  if (input.mode === 'mixed') addCoverageQuestions(ranked, selected, targetCount, usedGroups, input.seed);

  const cap = Math.max(1, Math.floor(targetCount * 0.4));
  pickUntil(ranked, selected, targetCount, usedGroups, 0, targets, input.mode === 'mixed' ? cap : undefined);
  pickUntil(ranked, selected, targetCount, usedGroups, 1, targets, input.mode === 'mixed' ? cap : undefined);
  pickUntil(ranked, selected, targetCount, usedGroups, 2, targets, input.mode === 'mixed' ? cap : undefined);

  if (selected.length < Math.min(targetCount, clean.length) && input.mode === 'mixed') {
    relaxations.push('category_cap_relaxed');
    pickUntil(ranked, selected, targetCount, usedGroups, 2, targets);
  }

  if (input.mode === 'mixed' && new Set(selected.map((item) => item.question.category)).size < Math.min(3, targetCount)) {
    relaxations.push('category_coverage_relaxed');
  }

  const selectedIds = new Set(selected.map((item) => item.question.id));
  if (selected.length < Math.min(targetCount, clean.length)) {
    relaxations.push('variant_group_relaxed');
    const remainder = ranked
      .filter((item) => !selectedIds.has(item.question.id))
      .sort((left, right) => left.recentRank - right.recentRank || left.randomRank - right.randomRank);
    for (const item of remainder) {
      if (selected.length >= targetCount) break;
      selected.push(item);
      selectedIds.add(item.question.id);
    }
  }

  const finalQuestions = seededShuffle(selected.map((item) => item.question), `${input.seed}:final`);
  const selectedById = new Map(selected.map((item) => [item.question.id, item]));
  const finalRanked = finalQuestions.map((question) => selectedById.get(question.id)!);
  return {
    questions: finalQuestions,
    summary: summarize(finalRanked, clean.length, targetCount, recent.recentQuestionCount, targets, relaxations),
  };
}
