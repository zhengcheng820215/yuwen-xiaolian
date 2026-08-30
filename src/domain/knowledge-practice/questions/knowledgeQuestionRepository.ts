import legacyQuestions from '../../../data/questions.json' with { type: 'json' };
import { KNOWLEDGE_QUESTION_APPROVED_OVERRIDES } from '../../../data/knowledgeQuestionApprovedOverrides.ts';
import { KNOWLEDGE_QUESTION_REVIEWED_SUPPLEMENT } from '../../../data/knowledgeQuestionReviewedSupplement.ts';
import { migrateLegacyKnowledgeQuestions } from './legacyKnowledgeQuestionMigration.ts';
import type {
  KnowledgeQuestion,
  KnowledgeQuestionDataset,
  KnowledgeQuestionQuery,
  KnowledgeQuestionRepository,
  LegacyKnowledgeQuestion,
} from './knowledgeQuestionTypes.ts';
import { validateKnowledgeQuestionDataset } from './knowledgeQuestionValidator.ts';

const migration = migrateLegacyKnowledgeQuestions(legacyQuestions as LegacyKnowledgeQuestion[]);

export const KNOWLEDGE_QUESTION_DATASET: KnowledgeQuestionDataset = {
  schemaVersion: 1,
  datasetId: 'knowledge-practice-grade7-semester1',
  grade: '七年级',
  semester: '上',
  updatedAt: '2026-08-28T00:00:00.000Z',
  questions: [
    ...migration.questions.map((question) => ({
      ...question,
      ...(KNOWLEDGE_QUESTION_APPROVED_OVERRIDES[question.id] || {}),
    })),
    ...KNOWLEDGE_QUESTION_REVIEWED_SUPPLEMENT,
  ],
};

export const KNOWLEDGE_QUESTION_MIGRATION_BASELINE = {
  sourceCount: migration.sourceCount,
  migratedCount: migration.questions.length,
  failedCount: migration.failures.length,
  grade7Semester1CandidateCount: migration.grade7Semester1CandidateCount,
  outOfScopeCount: migration.outOfScopeCount,
  failures: migration.failures,
};

function clone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

function matches(question: KnowledgeQuestion, query: KnowledgeQuestionQuery = {}): boolean {
  if (query.grade && question.grade !== query.grade) return false;
  if (query.semester && question.semester !== query.semester) return false;
  if (query.category && question.category !== query.category) return false;
  if (query.type && question.type !== query.type) return false;
  if (query.status && question.contentStatus !== query.status) return false;
  if (query.ids && !query.ids.includes(question.id)) return false;
  return true;
}

class StaticKnowledgeQuestionRepository implements KnowledgeQuestionRepository {
  private readonly dataset: KnowledgeQuestionDataset;

  constructor(dataset: KnowledgeQuestionDataset) {
    this.dataset = dataset;
    const validation = validateKnowledgeQuestionDataset(dataset);
    if (!validation.passed) {
      const errors = validation.issues.filter((issue) => issue.severity === 'error');
      throw new Error(`Knowledge question dataset is invalid: ${errors.map((issue) => `${issue.code}:${issue.questionId || issue.path}`).join(', ')}`);
    }
  }

  listApproved(query: Omit<KnowledgeQuestionQuery, 'status'> = {}): KnowledgeQuestion[] {
    return clone(this.dataset.questions.filter((question) => (
      question.contentStatus === 'approved' &&
      question.grade === '七年级' &&
      question.semester === '上' &&
      matches(question, query)
    )));
  }

  listForContentReview(query: KnowledgeQuestionQuery = {}): KnowledgeQuestion[] {
    return clone(this.dataset.questions.filter((question) => matches(question, query)));
  }

  getApprovedById(id: string): KnowledgeQuestion | undefined {
    return this.listApproved({ ids: [id] })[0];
  }

  getByIdForContentReview(id: string): KnowledgeQuestion | undefined {
    return this.listForContentReview({ ids: [id] })[0];
  }
}

export const knowledgeQuestionRepository: KnowledgeQuestionRepository = new StaticKnowledgeQuestionRepository(
  KNOWLEDGE_QUESTION_DATASET,
);

export function getKnowledgeQuestionDisplayAnswer(question: KnowledgeQuestion): string {
  if (question.type === 'fill_blank') return question.correctAnswer;
  return question.options?.find((option) => option.id === question.correctAnswer)?.text || question.correctAnswer;
}
