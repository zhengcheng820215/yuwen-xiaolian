import type { CompletedPracticeSessionSummary, PracticeSession } from '../practice/practiceSessionTypes.ts';
import type { KnowledgeQuestionCategory } from '../questions/knowledgeQuestionTypes.ts';
import type { PracticeAttempt } from '../response/practiceResponseTypes.ts';
import type { PracticeResult } from '../result/practiceResultTypes.ts';

export const PRACTICE_STORE_SCHEMA_VERSION = 1 as const;
export const PRACTICE_STORE_MAX_BYTES = 512 * 1024;
export const PRACTICE_COMPLETED_SESSION_LIMIT = 10;
export const PRACTICE_MISTAKE_LIMIT = 200;

export type PracticeCompletionSummary = {
  schemaVersion: 1;
  sessionId: string;
  mode: PracticeSession['mode'];
  category?: string;
  baseQuestionCount: number;
  firstAttemptCorrectCount: number;
  firstAttemptAccuracy: number;
  durationMs: number;
  mistakeCount: number;
  reinforcementQuestionCount?: number;
  reinforcementCorrectCount?: number;
  reinforcementDurationMs?: number;
  completedAt: string;
};

export type PracticeCompletionRecordV1 = {
  schemaVersion: 1;
  sessionId: string;
  completedAttempt: PracticeAttempt;
  summary: PracticeCompletionSummary;
  completedAt: string;
};

export type PracticeCompletionRecordV2 = {
  schemaVersion: 2;
  sessionId: string;
  completedAttempt: PracticeAttempt;
  summary: PracticeCompletionSummary;
  result: PracticeResult;
  completedAt: string;
};

export type PracticeCompletionRecord = PracticeCompletionRecordV1 | PracticeCompletionRecordV2;

export type PersistedKnowledgeMistake = {
  schemaVersion: 1;
  questionId: string;
  questionContentVersion: number;
  category: KnowledgeQuestionCategory;
  knowledgePoint: string;
  stemSnapshot: string;
  wrongAnswer: string;
  correctAnswerText: string;
  explanationSnapshot: string;
  responseId: string;
  status: 'active' | 'resolved';
  firstWrongAt: string;
  lastWrongAt: string;
};

export type LocalPracticeStoreV1 = {
  schemaVersion: 1;
  revision: number;
  activeAttempt: PracticeAttempt | null;
  completedSessions: CompletedPracticeSessionSummary[];
  lastCompletion: PracticeCompletionRecord | null;
  mistakes: PersistedKnowledgeMistake[];
  lastAbandonedSessionId?: string;
  updatedAt: string;
  writerId: string;
};

export type LocalPracticeStoreV0 = {
  activeAttempt?: PracticeAttempt;
  completedSessions?: CompletedPracticeSessionSummary[];
  lastResult?: unknown;
  mistakes?: PersistedKnowledgeMistake[];
};

export type PracticeStoreIssue = {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
};

export interface PracticeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type PracticeStoreLoadResult = {
  status: 'empty' | 'loaded' | 'migrated' | 'recovered_from_backup' | 'damaged' | 'unavailable' | 'future_version';
  store: LocalPracticeStoreV1;
  issues?: PracticeStoreIssue[];
  fromVersion?: number;
};

export type PracticeStoreWriteResult =
  | { status: 'saved' | 'reused'; store: LocalPracticeStoreV1 }
  | { status: 'conflict'; latest: LocalPracticeStoreV1; issues: PracticeStoreIssue[] }
  | { status: 'unavailable' | 'failed'; store: LocalPracticeStoreV1; issues: PracticeStoreIssue[] };

export function createEmptyPracticeStore(now: string, writerId: string): LocalPracticeStoreV1 {
  return {
    schemaVersion: 1,
    revision: 0,
    activeAttempt: null,
    completedSessions: [],
    lastCompletion: null,
    mistakes: [],
    updatedAt: now,
    writerId,
  };
}
