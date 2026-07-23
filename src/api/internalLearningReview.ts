import { buildInternalLearningReviewSummary } from '../ai/agents/unifiedLearningEntryAgent.ts';
import type { InternalLearningReviewSummary } from '../ai/schemas/unifiedLearningEntry.schema.ts';
import {
  createPhase163DemoEnvironment,
  type Phase163DemoCaseId,
} from './phase163RealLearningChainDemo.ts';
import { runPhase163RealLearningChain } from '../ai/agents/phase163RealLearningChainAgent.ts';
import { buildPhase163MultiDayAcceptance } from '../ai/agents/phase163MultiDayOperationAgent.ts';
import { queryLearningSessionHistory } from '../ai/agents/learningSessionHistoryAgent.ts';
import { IndexedDBLearningSessionRepository } from '../ai/repositories/indexedDBLearningSessionRepository.ts';
import { IndexedDBLearningPersistenceRepository } from '../ai/repositories/indexedDBLearningPersistenceRepository.ts';
import { IndexedDBPhase163MultiDayRunRepository } from '../ai/repositories/indexedDBPhase163MultiDayRunRepository.ts';
import { IndexedDBRealLearningOperationRepository } from '../ai/repositories/indexedDBRealLearningOperationRepository.ts';
import { LocalStorageUnifiedLearningEntryRepository } from '../ai/repositories/localStorageUnifiedLearningEntryRepository.ts';
import {
  PHASE163_DEMO_STUDENT_ID,
  PHASE163_LEARNING_STUDENT_ID,
} from './phase163LearningIdentity.ts';
import { resolvePhase163LiveStudentFeedback } from './phase163LiveLearning.ts';

const DEFAULT_ANSWER = '父亲捏着褪色的树叶站了很久，又小心地夹回原处，说明他想起过去，因此感到怀念和不舍。';

export type InternalReviewQueueItem = {
  caseId: Phase163DemoCaseId;
  label: string;
  summary: InternalLearningReviewSummary;
};

export type Phase163MultiDayReview = {
  status: 'not_started' | 'in_progress' | 'acceptance_ready' | 'blocked';
  naturalDays: number;
  targetNaturalDays: number;
  sessions: number;
  rounds: number;
  resources: number;
  evidence: number;
  completedRetests: number;
  recoveries: number;
  anomalies: number;
  engineeringReady: boolean;
  naturalRunComplete: boolean;
  days: Array<{
    dayKey: string;
    status: string;
    sessionCount: number;
    roundCount: number;
    resourceCount: number;
    evidenceCount: number;
    hasRetest: boolean;
    hasRecovery: boolean;
    hasAnomaly: boolean;
  }>;
  issues: string[];
};

export type Phase173ProductLearningAcceptanceTrace = {
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  learningSessionId?: string;
  learningRoundId?: string;
  sourceResourceVersionId?: string;
  diagnosisRequestId?: string;
  formalDiagnosisId?: string;
  answerStatus?: string;
  runtimeStatus?: string;
  evidenceCount: number;
  scoringSignals: string[];
  matchedRubricItems: string[];
  feedbackCoverage: string[];
  issues: string[];
};

export async function loadPhase173ProductLearningAcceptanceTrace(): Promise<Phase173ProductLearningAcceptanceTrace> {
  const context = await new LocalStorageUnifiedLearningEntryRepository()
    .getByStudent(PHASE163_LEARNING_STUDENT_ID);
  if (!context) {
    return {
      status: 'not_started',
      evidenceCount: 0,
      scoringSignals: [],
      matchedRubricItems: [],
      feedbackCoverage: [],
      issues: [],
    };
  }
  const checkpoint = context.currentLearningRoundId
    ? await new IndexedDBRealLearningOperationRepository()
      .getByOperationId(`phase16-3-live-operation-${context.currentLearningRoundId}`)
    : null;
  if (!checkpoint) {
    return {
      status: context.status === 'ended' ? 'completed' : 'in_progress',
      learningSessionId: context.learningSessionId,
      learningRoundId: context.currentLearningRoundId,
      evidenceCount: 0,
      scoringSignals: [],
      matchedRubricItems: [],
      feedbackCoverage: [],
      issues: [],
    };
  }
  const feedback = resolvePhase163LiveStudentFeedback(checkpoint);
  return {
    status: checkpoint.status === 'completed'
      ? 'completed'
      : checkpoint.status === 'blocked' || checkpoint.status === 'review_required'
        ? 'blocked'
        : 'in_progress',
    learningSessionId: checkpoint.learningSessionId,
    learningRoundId: checkpoint.learningRoundId,
    sourceResourceVersionId: checkpoint.sourceResourceVersionId,
    diagnosisRequestId: checkpoint.realDiagnosisRuntimeResult?.requestId || checkpoint.diagnosisRequestId,
    formalDiagnosisId: checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.formalDiagnosisId,
    answerStatus: checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.diagnosisResult?.answerStatus,
    runtimeStatus: checkpoint.realDiagnosisRuntimeResult?.status,
    evidenceCount: checkpoint.taskEvidenceReturnResult?.abilityEvidence.length || 0,
    scoringSignals: checkpoint.concreteTask?.scoringPoints || [],
    matchedRubricItems:
      checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.diagnosisResult?.matchedRubricItems || [],
    feedbackCoverage: (feedback?.thinkingReview?.requirementCoverage || []).map((item) => {
      const evidence = item.studentEvidence[0];
      return `${item.requirementType}:${item.status}${evidence ? `:${evidence}` : ''}`;
    }),
    issues: checkpoint.issues,
  };
}

export async function loadPhase163MultiDayReview(): Promise<Phase163MultiDayReview> {
  const repository = new IndexedDBPhase163MultiDayRunRepository();
  const state = await repository.getByStudent(PHASE163_LEARNING_STUDENT_ID);
  const history = await queryLearningSessionHistory(
    new IndexedDBLearningSessionRepository(),
    { studentId: PHASE163_LEARNING_STUDENT_ID },
  );
  if (!state) {
    return {
      status: 'not_started', naturalDays: 0, targetNaturalDays: 5,
      sessions: history.total, rounds: history.sessions.reduce((sum, item) => sum + item.roundCount, 0),
      resources: 0, evidence: new Set(history.sessions.flatMap((item) => item.evidenceIds)).size,
      completedRetests: 0, recoveries: 0, anomalies: 0,
      engineeringReady: false, naturalRunComplete: false, days: [], issues: [],
    };
  }
  const acceptance = buildPhase163MultiDayAcceptance(state);
  const grouped = new Map();
  for (const item of state.days.filter((day) => day.timeSource === 'natural')) {
    const current = grouped.get(item.dayKey) || [];
    current.push(item);
    grouped.set(item.dayKey, current);
  }
  return {
    status: state.status === 'blocked' ? 'blocked' : acceptance.naturalRunComplete ? 'acceptance_ready' : 'in_progress',
    naturalDays: acceptance.counts.naturalDays,
    targetNaturalDays: state.targetNaturalDayCount,
    sessions: acceptance.counts.sessions,
    rounds: acceptance.counts.rounds,
    resources: acceptance.counts.resources,
    evidence: acceptance.counts.evidence,
    completedRetests: acceptance.counts.completedRetests,
    recoveries: acceptance.counts.recoveries,
    anomalies: acceptance.counts.anomalyExercises,
    engineeringReady: acceptance.engineeringReady,
    naturalRunComplete: acceptance.naturalRunComplete,
    days: [...grouped.entries()].map(([dayKey, records]) => ({
      dayKey,
      status: records.some((item) => item.status !== 'completed') ? 'needs_attention' : 'completed',
      sessionCount: new Set(records.map((item) => item.learningSessionId)).size,
      roundCount: new Set(records.map((item) => item.learningRoundId)).size,
      resourceCount: new Set(records.map((item) => item.resourceVersionId)).size,
      evidenceCount: new Set(records.flatMap((item) => item.evidenceIds)).size,
      hasRetest: records.some((item) => item.retestCompleted),
      hasRecovery: records.some((item) => item.recoveredFromCheckpoint),
      hasAnomaly: records.some((item) => item.anomalyCodes.length > 0),
    })),
    issues: [...new Set([...acceptance.issues, ...history.validation.issues])],
  };
}

export async function clearPhase163ControlledAcceptanceData(): Promise<void> {
  await Promise.all([
    new IndexedDBLearningPersistenceRepository().clear(PHASE163_DEMO_STUDENT_ID),
    new IndexedDBLearningSessionRepository().clear(PHASE163_DEMO_STUDENT_ID),
    new IndexedDBPhase163MultiDayRunRepository().clear(PHASE163_DEMO_STUDENT_ID),
    new IndexedDBRealLearningOperationRepository().clearByStudent(PHASE163_DEMO_STUDENT_ID),
    new LocalStorageUnifiedLearningEntryRepository().clear(PHASE163_DEMO_STUDENT_ID),
  ]);
}

export async function clearPhase173ProductLearningAcceptanceData(): Promise<void> {
  if (!import.meta.env.DEV) {
    throw new Error('Formal learning acceptance reset is only available in development.');
  }
  await Promise.all([
    new IndexedDBLearningPersistenceRepository().clear(PHASE163_LEARNING_STUDENT_ID),
    new IndexedDBLearningSessionRepository().clear(PHASE163_LEARNING_STUDENT_ID),
    new IndexedDBPhase163MultiDayRunRepository().clear(PHASE163_LEARNING_STUDENT_ID),
    new IndexedDBRealLearningOperationRepository().clearByStudent(PHASE163_LEARNING_STUDENT_ID),
    new LocalStorageUnifiedLearningEntryRepository().clear(PHASE163_LEARNING_STUDENT_ID),
  ]);
}

export async function loadInternalLearningReviewQueue(): Promise<InternalReviewQueueItem[]> {
  const cases: Array<{ caseId: Phase163DemoCaseId; label: string; answer: string }> = [
    { caseId: 'complete_chain', label: '完整正式链路', answer: DEFAULT_ANSWER },
    { caseId: 'diagnosis_review', label: 'Diagnosis 质量复核', answer: DEFAULT_ANSWER },
    { caseId: 'resource_mismatch', label: '下一资源匹配缺口', answer: DEFAULT_ANSWER },
    { caseId: 'invalid_answer', label: '无效作答阻断', answer: '不知道' },
  ];
  return Promise.all(cases.map(async ({ caseId, label, answer }) => {
    const environment = await createPhase163DemoEnvironment(caseId, answer);
    const result = await runPhase163RealLearningChain(environment.input, environment.dependencies);
    return { caseId, label, summary: buildInternalLearningReviewSummary(result.checkpoint) };
  }));
}
