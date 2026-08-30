import assert from 'node:assert/strict';
import { selectPracticeQuestions } from '../../domain/knowledge-practice/practice/selectPracticeQuestions.ts';
import type { CompletedPracticeSessionSummary } from '../../domain/knowledge-practice/practice/practiceSessionTypes.ts';
import {
  countReadyKnowledgeCategories,
  isKnowledgeCategoryReady,
  MIN_READY_CATEGORY_QUESTION_COUNT,
} from '../../domain/knowledge-practice/questions/knowledgeCategoryReadiness.ts';
import { knowledgeQuestionRepository } from '../../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import type { KnowledgeQuestionCategory } from '../../domain/knowledge-practice/questions/knowledgeQuestionTypes.ts';

type Check = { id: string; name: string; run: () => void };
type RoundMetric = {
  round: number;
  selectedCount: number;
  categoryCount: number;
  withinSessionDuplicateRate: number;
  adjacentRepeatRate: number;
  theoreticalAdjacentFloor: number;
  excessAdjacentRepeatRate: number;
  fillRate: number;
};

const approved = knowledgeQuestionRepository.listApproved();
const categoryCounts = new Map<KnowledgeQuestionCategory, number>();
for (const question of approved) categoryCounts.set(question.category, (categoryCounts.get(question.category) || 0) + 1);

function runSequence(input: {
  name: string;
  mode: 'mixed' | 'category';
  category?: KnowledgeQuestionCategory;
  rounds: number;
  targetCount: number;
}): RoundMetric[] {
  const history: CompletedPracticeSessionSummary[] = [];
  let previousIds: string[] = [];
  const eligiblePoolSize = input.category
    ? approved.filter((question) => question.category === input.category).length
    : approved.length;
  const metrics: RoundMetric[] = [];

  for (let round = 1; round <= input.rounds; round += 1) {
    const result = selectPracticeQuestions({
      mode: input.mode,
      category: input.category,
      targetCount: input.targetCount,
      seed: `wp7b-${input.name}-${round}`,
      candidates: approved,
      recentCompletedSessions: history,
    });
    const ids = result.questions.map((question) => question.id);
    const duplicateCount = ids.length - new Set(ids).size;
    const adjacentRepeatCount = ids.filter((id) => previousIds.includes(id)).length;
    const adjacentRepeatRate = previousIds.length > 0 ? adjacentRepeatCount / ids.length : 0;
    const theoreticalAdjacentFloor = previousIds.length > 0
      ? Math.max(0, ids.length + previousIds.length - eligiblePoolSize) / ids.length
      : 0;
    metrics.push({
      round,
      selectedCount: ids.length,
      categoryCount: new Set(result.questions.map((question) => question.category)).size,
      withinSessionDuplicateRate: ids.length > 0 ? duplicateCount / ids.length : 0,
      adjacentRepeatRate,
      theoreticalAdjacentFloor,
      excessAdjacentRepeatRate: Math.max(0, adjacentRepeatRate - theoreticalAdjacentFloor),
      fillRate: ids.length / input.targetCount,
    });
    history.unshift({
      sessionId: `${input.name}-${round}`,
      completedAt: new Date(Date.UTC(2026, 7, 30, 0, round)).toISOString(),
      baseQuestionIds: ids,
    });
    previousIds = ids;
  }
  return metrics;
}

const mixed = runSequence({ name: 'mixed', mode: 'mixed', rounds: 10, targetCount: 10 });
const pronunciation = runSequence({ name: 'pronunciation', mode: 'category', category: '字音字形', rounds: 5, targetCount: 5 });
const classical = runSequence({ name: 'classical', mode: 'category', category: '文言实词虚词', rounds: 5, targetCount: 5 });
const underThreeCategories = [...categoryCounts.entries()].filter(([, count]) => !isKnowledgeCategoryReady(count));

function all(metrics: RoundMetric[], predicate: (metric: RoundMetric) => boolean): boolean {
  return metrics.every(predicate);
}

const checks: Check[] = [
  { id: 'WP7B-C01', name: 'approved inventory remains nineteen', run: () => assert.equal(approved.length, 19) },
  { id: 'WP7B-C02', name: 'approved inventory covers six categories', run: () => assert.equal(categoryCounts.size, 6) },
  { id: 'WP7B-C03', name: 'three categories meet standalone readiness minimum', run: () => assert.equal(countReadyKnowledgeCategories(approved), 3) },
  { id: 'WP7B-C04', name: 'standalone readiness minimum is three', run: () => assert.equal(MIN_READY_CATEGORY_QUESTION_COUNT, 3) },
  { id: 'WP7B-C05', name: 'under-three categories are identified deterministically', run: () => assert.deepEqual(underThreeCategories.map(([category]) => category).sort(), ['古诗文默写与理解', '文学文化常识', '标点符号'].sort()) },
  { id: 'WP7B-C06', name: 'mixed sequence creates ten rounds', run: () => assert.equal(mixed.length, 10) },
  { id: 'WP7B-C07', name: 'mixed rounds fill ten questions', run: () => assert(all(mixed, (metric) => metric.selectedCount === 10 && metric.fillRate === 1)) },
  { id: 'WP7B-C08', name: 'mixed rounds have no within-session duplicates', run: () => assert(all(mixed, (metric) => metric.withinSessionDuplicateRate === 0)) },
  { id: 'WP7B-C09', name: 'mixed rounds cover at least three categories', run: () => assert(all(mixed, (metric) => metric.categoryCount >= 3)) },
  { id: 'WP7B-C10', name: 'mixed excess repeat is isolated to the round-two variant-group constraint', run: () => {
    assert.equal(mixed[1].excessAdjacentRepeatRate, 0.1);
    assert([...mixed.slice(0, 1), ...mixed.slice(2)].every((metric) => metric.excessAdjacentRepeatRate === 0));
  } },
  { id: 'WP7B-C11', name: 'mixed adjacent repeat returns to the ten-percent inventory floor from round three', run: () => assert(mixed.slice(2).every((metric) => metric.adjacentRepeatRate === 0.1 && metric.theoreticalAdjacentFloor === 0.1)) },
  { id: 'WP7B-C12', name: 'pronunciation sequence creates five full rounds', run: () => assert(pronunciation.length === 5 && all(pronunciation, (metric) => metric.fillRate === 1)) },
  { id: 'WP7B-C13', name: 'pronunciation sequence has no within-session duplicate', run: () => assert(all(pronunciation, (metric) => metric.withinSessionDuplicateRate === 0)) },
  { id: 'WP7B-C14', name: 'pronunciation adjacent repeat stays at theoretical floor', run: () => assert(pronunciation.slice(1).every((metric) => metric.adjacentRepeatRate === 0.8 && metric.excessAdjacentRepeatRate === 0)) },
  { id: 'WP7B-C15', name: 'classical sequence creates five full rounds', run: () => assert(classical.length === 5 && all(classical, (metric) => metric.fillRate === 1)) },
  { id: 'WP7B-C16', name: 'classical sequence has no within-session duplicate', run: () => assert(all(classical, (metric) => metric.withinSessionDuplicateRate === 0)) },
  { id: 'WP7B-C17', name: 'classical adjacent repeat stays at theoretical floor', run: () => assert(classical.slice(1).every((metric) => metric.adjacentRepeatRate === 1 && metric.excessAdjacentRepeatRate === 0)) },
  { id: 'WP7B-C18', name: 'under-three categories return actual quantities without duplicate padding', run: () => {
    for (const [category, count] of underThreeCategories) {
      const result = selectPracticeQuestions({ mode: 'category', category, targetCount: 5, seed: `wp7b-short-${category}`, candidates: approved });
      assert.equal(result.questions.length, count);
      assert.equal(new Set(result.questions.map((question) => question.id)).size, count);
      assert(result.summary.relaxationCodes.includes('candidate_shortage'));
    }
  } },
  { id: 'WP7B-C19', name: 'all capacity candidates are approved', run: () => assert(approved.every((question) => question.contentStatus === 'approved')) },
  { id: 'WP7B-C20', name: 'same sequence seed and history are reproducible', run: () => assert.deepEqual(
    runSequence({ name: 'repeatable', mode: 'mixed', rounds: 3, targetCount: 10 }),
    runSequence({ name: 'repeatable', mode: 'mixed', rounds: 3, targetCount: 10 }),
  ) },
];

let passed = 0;
for (const check of checks) {
  try {
    check.run();
    passed += 1;
    console.log(`PASS ${check.id} ${check.name}`);
  } catch (error) {
    console.error(`FAIL ${check.id} ${check.name}`);
    throw error;
  }
}

console.log(`WP7B_RESULT ${passed}/${checks.length} PASS`);
console.log(`CAPACITY mixed_rounds=10 mixed_round2_adjacent=20% mixed_round2_inventory_floor=10% mixed_round2_variant_constraint=10% mixed_round3_to_10_adjacent=10% mixed_unexplained_excess=0% pronunciation_adjacent=80% pronunciation_excess=0% classical_adjacent=100% classical_excess=0%`);
console.log(`READINESS approved=19 represented_categories=6 standalone_ready_categories=3 under_three=${underThreeCategories.map(([category, count]) => `${category}:${count}`).join(',')}`);
