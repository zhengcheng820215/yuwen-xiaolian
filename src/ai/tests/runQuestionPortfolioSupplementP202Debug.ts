import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  generateQuestionPortfolioSupplementCandidates,
} from '../agents/questionPortfolioSupplementCandidateAgent.ts';
import { inspectInitialCandidateCompleteness } from '../schemas/questionCandidate.schema.ts';

const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const report = await generateQuestionPortfolioSupplementCandidates(before);
assert([42, 46].includes(report.baselineQuestionCount));
assert.equal(report.candidateCount + report.alreadyPublishedCount, 4);
assert.equal(report.formalWriteCount, 0);
assert.deepEqual(report.issues, []);
assert(report.candidateCount === 0 || report.candidateCount === 4);
if (report.candidateCount === 4) assert.deepEqual(report.candidates.map((item) => item.materialTitle), [
  '《皇帝的新装》',
  '《秋天的怀念》',
  '《散步》',
  '《狼》',
]);
assert(report.candidates.every((item) => item.candidate.inventoryRelation.disposition
  === 'new_observation_candidate'));
assert(report.candidates.every((item) => item.candidate.safetyBoundary.requiresHumanReview));
assert(report.candidates.every((item) => item.candidate.difficultySuggestion === 'basic'));
assert(report.candidates.every((item) => ['comprehension', 'summarization'].includes(
  item.candidate.primaryAbilityId,
)));
assert(report.candidates.every((item) => item.qualityStatus === 'ready'));
assert(report.candidates.every((item) => inspectInitialCandidateCompleteness(
  item.completeContent,
).complete));
assert(report.candidates.every((item) => item.candidate.calibrationAnswers.length >= 5));

const after = await store.read();
assert.equal(after.revision, before.revision);
assert.deepEqual(after.data, before.data, 'P2-02 candidate generation must not mutate formal data.');

console.log(JSON.stringify({ storeRevision: before.revision, ...report }, null, 2));
console.log('P2-02 question portfolio supplement candidate debug passed (read-only).');
