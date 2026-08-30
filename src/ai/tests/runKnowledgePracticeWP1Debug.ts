import assert from 'node:assert/strict';
import legacyQuestions from '../../data/questions.json' with { type: 'json' };
import { normalizeKnowledgeAnswer } from '../../domain/knowledge-practice/questions/knowledgeQuestionNormalization.ts';
import {
  migrateLegacyKnowledgeQuestion,
  migrateLegacyKnowledgeQuestions,
} from '../../domain/knowledge-practice/questions/legacyKnowledgeQuestionMigration.ts';
import {
  KNOWLEDGE_QUESTION_DATASET,
  KNOWLEDGE_QUESTION_MIGRATION_BASELINE,
  knowledgeQuestionRepository,
} from '../../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import type {
  KnowledgeQuestion,
  KnowledgeQuestionDataset,
  LegacyKnowledgeQuestion,
} from '../../domain/knowledge-practice/questions/knowledgeQuestionTypes.ts';
import {
  validateKnowledgeQuestion,
  validateKnowledgeQuestionDataset,
} from '../../domain/knowledge-practice/questions/knowledgeQuestionValidator.ts';

type Check = { id: string; name: string; run: () => void };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectIssue(question: KnowledgeQuestion, code: string): void {
  const result = validateKnowledgeQuestion(question);
  assert(result.issues.some((issue) => issue.code === code), `Expected ${code}, got ${result.issues.map((issue) => issue.code).join(', ')}`);
}

function approved(id = 'q-cy-1'): KnowledgeQuestion {
  const question = knowledgeQuestionRepository.getApprovedById(id);
  assert(question, `Missing approved fixture ${id}`);
  return question;
}

const legacy = legacyQuestions as LegacyKnowledgeQuestion[];
const checks: Check[] = [
  { id: 'WP1-B01', name: 'legacy baseline contains 27 questions', run: () => assert.equal(legacy.length, 27) },
  { id: 'WP1-B02', name: 'legacy ids are unique', run: () => assert.equal(new Set(legacy.map((item) => item.id)).size, 27) },
  { id: 'WP1-B03', name: 'grade 7 semester 1 candidate count is 12', run: () => assert.equal(KNOWLEDGE_QUESTION_MIGRATION_BASELINE.grade7Semester1CandidateCount, 12) },
  { id: 'WP1-B04', name: 'out-of-scope count is 15', run: () => assert.equal(KNOWLEDGE_QUESTION_MIGRATION_BASELINE.outOfScopeCount, 15) },
  { id: 'WP1-B05', name: 'migration never silently drops source questions', run: () => assert.equal(KNOWLEDGE_QUESTION_MIGRATION_BASELINE.migratedCount + KNOWLEDGE_QUESTION_MIGRATION_BASELINE.failedCount, 27) },
  { id: 'WP1-B06', name: 'student set only contains grade 7 semester 1', run: () => assert(knowledgeQuestionRepository.listApproved().every((item) => item.grade === '七年级' && item.semester === '上')) },
  { id: 'WP1-B07', name: 'reviewed baseline plus WP5 supplement are approved', run: () => assert.equal(knowledgeQuestionRepository.listApproved().length, 19) },

  { id: 'WP1-T01', name: 'single choice type migrates', run: () => assert.equal(migrateLegacyKnowledgeQuestion(legacy.find((item) => item.type === '单选题')!).type, 'single_choice') },
  { id: 'WP1-T02', name: 'true false type migrates', run: () => assert.equal(migrateLegacyKnowledgeQuestion(legacy.find((item) => item.type === '判断题')!).type, 'true_false') },
  { id: 'WP1-T03', name: 'fill blank type migrates', run: () => assert.equal(migrateLegacyKnowledgeQuestion(legacy.find((item) => item.type === '填空题')!).type, 'fill_blank') },
  { id: 'WP1-T04', name: 'unknown type fails migration', run: () => assert.throws(() => migrateLegacyKnowledgeQuestion({ ...legacy[0], type: '未知题型' })) },
  { id: 'WP1-T05', name: 'difficulty values migrate', run: () => {
    assert.equal(migrateLegacyKnowledgeQuestion({ ...legacy[0], difficulty: '基础' }).difficulty, 1);
    assert.equal(migrateLegacyKnowledgeQuestion({ ...legacy[0], difficulty: '中等' }).difficulty, 2);
    assert.equal(migrateLegacyKnowledgeQuestion({ ...legacy[0], difficulty: '较难' }).difficulty, 3);
  } },
  { id: 'WP1-T06', name: 'unknown difficulty fails migration', run: () => assert.throws(() => migrateLegacyKnowledgeQuestion({ ...legacy[0], difficulty: '未知' })) },
  { id: 'WP1-T07', name: 'legacy option prefixes become stable ids', run: () => assert.deepEqual(migrateLegacyKnowledgeQuestion(legacy[0]).options?.[0], { id: 'opt-a', text: '酝酿 niang  倔强 qiang' }) },
  { id: 'WP1-T08', name: 'legacy answer maps to option id', run: () => assert.equal(migrateLegacyKnowledgeQuestion(legacy[0]).correctAnswer, 'opt-b') },
  { id: 'WP1-T09', name: 'fill answer enters accepted answers', run: () => {
    const migrated = migrateLegacyKnowledgeQuestion(legacy.find((item) => item.type === '填空题')!);
    assert.deepEqual(migrated.acceptedAnswers, [migrated.correctAnswer]);
  } },
  { id: 'WP1-T10', name: 'migration defaults every question to draft', run: () => assert(migrateLegacyKnowledgeQuestions(legacy).questions.every((item) => item.contentStatus === 'draft')) },

  { id: 'WP1-V01', name: 'dataset schema version is enforced', run: () => {
    const dataset = clone(KNOWLEDGE_QUESTION_DATASET) as KnowledgeQuestionDataset & { schemaVersion: number };
    dataset.schemaVersion = 2;
    assert(validateKnowledgeQuestionDataset(dataset as KnowledgeQuestionDataset).issues.some((issue) => issue.code === 'dataset.schema_version_invalid'));
  } },
  { id: 'WP1-V02', name: 'duplicate question id is rejected', run: () => {
    const dataset = clone(KNOWLEDGE_QUESTION_DATASET);
    dataset.questions.push(clone(dataset.questions[0]));
    assert(validateKnowledgeQuestionDataset(dataset).issues.some((issue) => issue.code === 'dataset.question_id_duplicate'));
  } },
  { id: 'WP1-V03', name: 'invalid id is rejected', run: () => { const item = approved(); item.id = 'Bad ID'; expectIssue(item, 'question.id_invalid'); } },
  { id: 'WP1-V04', name: 'zero content version is rejected', run: () => { const item = approved(); item.contentVersion = 0; expectIssue(item, 'question.version_invalid'); } },
  { id: 'WP1-V06', name: 'empty knowledge point is rejected', run: () => { const item = approved(); item.knowledgePoint = ''; expectIssue(item, 'question.knowledge_point_required'); } },
  { id: 'WP1-V07', name: 'invalid difficulty is rejected', run: () => { const item = approved(); item.difficulty = 4 as 1; expectIssue(item, 'question.difficulty_invalid'); } },
  { id: 'WP1-V08', name: 'approved question requires review time', run: () => { const item = approved(); delete item.reviewedAt; expectIssue(item, 'question.review_required'); } },
  { id: 'WP1-V09', name: 'approved question requires solution steps', run: () => { const item = approved(); item.solutionSteps = []; expectIssue(item, 'question.solution_steps_invalid'); } },

  { id: 'WP1-C01', name: 'choice requires options', run: () => { const item = approved(); delete item.options; expectIssue(item, 'choice.options_required'); } },
  { id: 'WP1-C02', name: 'single choice requires 3 to 5 options', run: () => { const item = approved(); item.options = item.options?.slice(0, 2); expectIssue(item, 'choice.option_count_invalid'); } },
  { id: 'WP1-C03', name: 'duplicate option id is rejected', run: () => { const item = approved(); item.options![1].id = item.options![0].id; expectIssue(item, 'choice.option_id_duplicate'); } },
  { id: 'WP1-C04', name: 'correct answer must reference an option', run: () => { const item = approved(); item.correctAnswer = 'missing'; expectIssue(item, 'choice.correct_answer_invalid'); } },
  { id: 'WP1-C05', name: 'display prefix is rejected in option text', run: () => { const item = approved(); item.options![0].text = `A. ${item.options![0].text}`; expectIssue(item, 'choice.display_prefix_forbidden'); } },
  { id: 'WP1-C06', name: 'approved choice requires complete analysis', run: () => { const item = approved(); delete item.answerAnalysis![item.options![0].id]; expectIssue(item, 'choice.answer_analysis_incomplete'); } },
  { id: 'WP1-C07', name: 'correct choice cannot have misconception', run: () => { const item = approved(); item.misconceptionByAnswer = { ...item.misconceptionByAnswer, [item.correctAnswer]: { code: 'bad-code', studentMessage: 'bad' } }; expectIssue(item, 'choice.correct_misconception_forbidden'); } },
  { id: 'WP1-C08', name: 'true false ids are fixed', run: () => { const item = approved('q-zy-3'); item.options![0].id = 'yes'; expectIssue(item, 'choice.true_false_identity_invalid'); } },

  { id: 'WP1-F01', name: 'fill question forbids options', run: () => { const item = approved('q-gs-1'); item.options = [{ id: 'opt-a', text: 'x' }]; expectIssue(item, 'fill.options_forbidden'); } },
  { id: 'WP1-F02', name: 'fill question requires accepted answers', run: () => { const item = approved('q-gs-1'); item.acceptedAnswers = []; expectIssue(item, 'fill.accepted_answers_required'); } },
  { id: 'WP1-F03', name: 'correct answer must be accepted', run: () => { const item = approved('q-gs-1'); item.acceptedAnswers = ['其他']; expectIssue(item, 'fill.correct_answer_not_accepted'); } },
  { id: 'WP1-F04', name: 'normalized duplicate answers are rejected', run: () => { const item = approved('q-gs-1'); item.acceptedAnswers = ['江春入旧年', ' 江春入旧年。']; expectIssue(item, 'fill.accepted_answer_duplicate'); } },
  { id: 'WP1-F06', name: 'trim normalization is deterministic', run: () => assert.equal(normalizeKnowledgeAnswer('  江春入旧年  ', ['trim']), '江春入旧年') },
  { id: 'WP1-F07', name: 'terminal punctuation can be ignored', run: () => assert.equal(normalizeKnowledgeAnswer('江春入旧年。', ['ignore_terminal_punctuation']), '江春入旧年') },
  { id: 'WP1-F08', name: 'internal typo remains different', run: () => assert.notEqual(normalizeKnowledgeAnswer('江春人旧年', ['trim']), normalizeKnowledgeAnswer('江春入旧年', ['trim'])) },

  { id: 'WP1-R01', name: 'approved query defaults to first scope', run: () => assert(knowledgeQuestionRepository.listApproved().every((item) => item.contentStatus === 'approved' && item.grade === '七年级' && item.semester === '上')) },
  { id: 'WP1-R02', name: 'student query excludes draft', run: () => assert(!knowledgeQuestionRepository.listApproved().some((item) => item.contentStatus === 'draft')) },
  { id: 'WP1-R03', name: 'student query excludes retired', run: () => assert(!knowledgeQuestionRepository.listApproved().some((item) => item.contentStatus === 'retired')) },
  { id: 'WP1-R04', name: 'approved lookup hides draft', run: () => assert.equal(knowledgeQuestionRepository.getApprovedById('q-bj-1'), undefined) },
  { id: 'WP1-R05', name: 'content review lookup sees draft', run: () => assert.equal(knowledgeQuestionRepository.getByIdForContentReview('q-bj-1')?.contentStatus, 'draft') },
  { id: 'WP1-R06', name: 'repository returns defensive copies', run: () => {
    const first = knowledgeQuestionRepository.getApprovedById('q-cy-1')!;
    first.stem = 'mutated';
    assert.notEqual(knowledgeQuestionRepository.getApprovedById('q-cy-1')!.stem, 'mutated');
  } },
  { id: 'WP1-R07', name: 'category filter is exact', run: () => assert(knowledgeQuestionRepository.listApproved({ category: '字音字形' }).every((item) => item.category === '字音字形')) },
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

const validation = validateKnowledgeQuestionDataset(KNOWLEDGE_QUESTION_DATASET);
const errors = validation.issues.filter((issue) => issue.severity === 'error');
const warnings = validation.issues.filter((issue) => issue.severity === 'warning');
console.log(`WP1_RESULT ${passed}/${checks.length} PASS`);
console.log(`DATASET source=${KNOWLEDGE_QUESTION_MIGRATION_BASELINE.sourceCount} migrated=${KNOWLEDGE_QUESTION_MIGRATION_BASELINE.migratedCount} failed=${KNOWLEDGE_QUESTION_MIGRATION_BASELINE.failedCount} approved=${knowledgeQuestionRepository.listApproved().length} draft=${knowledgeQuestionRepository.listForContentReview({ status: 'draft' }).length}`);
console.log(`VALIDATION errors=${errors.length} warnings=${warnings.length}`);
if (process.argv.includes('--validate-data') && (!validation.passed || KNOWLEDGE_QUESTION_MIGRATION_BASELINE.failedCount > 0)) process.exitCode = 1;
