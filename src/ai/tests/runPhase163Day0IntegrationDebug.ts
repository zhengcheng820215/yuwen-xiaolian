import {
  buildUnifiedLearningEntryState,
  createUnifiedLearningActivityContext,
} from '../agents/unifiedLearningEntryAgent.ts';
import { runPhase163RealLearningChain } from '../agents/phase163RealLearningChainAgent.ts';
import { ScriptedDiagnosisProviderAdapter } from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryLearningPersistenceRepository } from '../repositories/inMemoryLearningPersistenceRepository.ts';
import { InMemoryRealLearningOperationRepository } from '../repositories/inMemoryRealLearningOperationRepository.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { Phase163RealLearningChainResult } from '../schemas/realLearningOperation.schema.ts';
import type { UnifiedLearningEntryState } from '../schemas/unifiedLearningEntry.schema.ts';
import { createPhase163DemoEnvironment } from '../../api/phase163RealLearningChainDemo.ts';
import { resolvePhase163LiveStudentFeedback } from '../../api/phase163LiveLearning.ts';

const VALID_ANSWER = '父亲捏着褪色的树叶站了很久，又小心地夹回原处，说明他想起过去，因此感到怀念和不舍。';
const NOW = '2026-07-21T10:05:00.000Z';

type Check = {
  id: string;
  passed: boolean;
  detail: string;
};

const checks: Check[] = [];

async function main(): Promise<void> {
  await checkInitialEntry();
  const successful = await checkFormalChainAndEntry();
  await checkDuplicateAndRecovery(successful);
  await checkInvalidAnswer();
  await checkProviderFailure();
  await checkDiagnosisReview();
  await checkNextResourceMismatch();
  await checkRecoveredFeedbackUsesCurrentThinkingGap();
  checkStudentSurface(successful.entry);

  console.log('\nPhase 16.3 Day 0 Unified Entry → Formal Runtime Integration Debug');
  console.log('='.repeat(82));
  for (const item of checks) {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.id}`);
    console.log(`       ${item.detail}`);
  }
  const passed = checks.filter((item) => item.passed).length;
  console.log('-'.repeat(82));
  console.log(`Result: ${passed} / ${checks.length} PASS`);
  console.log('Provider mode: deterministic scripted adapter (no network)');
  console.log('Browser boundary: not exercised; no API key or raw output enters student state.');
  if (passed !== checks.length) {
    throw new Error('Phase 16.3 Day 0 integration Debug failed.');
  }
}

async function checkInitialEntry(): Promise<void> {
  const environment = await createPhase163DemoEnvironment('complete_chain', VALID_ANSWER);
  const entry = buildUnifiedLearningEntryState({
    studentId: environment.input.studentId,
    now: NOW,
    activeContexts: [],
    hasAvailableTask: true,
    completedRoundCount: 0,
  });
  record('D0-1 统一入口可启动正式任务',
    entry.status === 'start_new_round' && entry.canEnterWorkspace,
    `status=${entry.status}, action=${entry.primaryAction}`);
}

async function checkFormalChainAndEntry(): Promise<{
  environment: Awaited<ReturnType<typeof createPhase163DemoEnvironment>>;
  result: Phase163RealLearningChainResult;
  entry: UnifiedLearningEntryState;
}> {
  const environment = await createPhase163DemoEnvironment('complete_chain', VALID_ANSWER);
  const result = await runPhase163RealLearningChain(environment.input, environment.dependencies);
  const recordValue = await environment.dependencies.learningPersistenceRepository.loadLatest(environment.input.studentId);
  const entry = buildEntry(environment, result, recordValue || undefined);

  record('D0-2 正式作答完成 Diagnosis、Evidence、Profile 与 GrowthMemory 回流',
    result.status === 'completed' &&
      result.checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.status === 'committed' &&
      result.checkpoint.taskEvidenceReturnResult?.abilityEvidence.length === 1 &&
      Boolean(result.checkpoint.updatedStudentAbilityProfile) &&
      Boolean(result.checkpoint.updatedGrowthMemorySummary),
    `status=${result.status}, evidence=${result.checkpoint.taskEvidenceReturnResult?.abilityEvidence.length || 0}`);
  record('D0-3 下一任务由正式结果驱动并使用另一条 Frozen Resource',
    result.checkpoint.nextTaskResolution?.status === 'matched' &&
      result.checkpoint.nextTaskResolution.taskReadiness?.canExecute === true &&
      result.checkpoint.nextTaskResolution.resourceVersion?.resourceId !== environment.input.resourceVersion.resourceId,
    `next=${result.checkpoint.nextTaskResolution?.status}, resource=${result.checkpoint.nextTaskResolution?.resourceVersion?.resourceId || 'none'}`);
  record('D0-4 正式完成结果回到统一入口的反馈状态',
    entry.status === 'feedback_available' && entry.hasUnviewedFeedback,
    `status=${entry.status}, feedback=${entry.hasUnviewedFeedback}`);
  return { environment, result, entry };
}

async function checkDuplicateAndRecovery(success: {
  environment: Awaited<ReturnType<typeof createPhase163DemoEnvironment>>;
  result: Phase163RealLearningChainResult;
}): Promise<void> {
  const firstReturnId = success.result.checkpoint.taskEvidenceReturnResult?.returnId;
  const repeated = await runPhase163RealLearningChain(success.environment.input, success.environment.dependencies);
  record('D0-5 重复提交复用正式结果且不重复调用 Diagnosis',
    repeated.status === 'completed' &&
      success.environment.provider.callCount === 1 &&
      repeated.checkpoint.taskEvidenceReturnResult?.returnId === firstReturnId &&
      success.environment.learningStore.size === 1,
    `providerCalls=${success.environment.provider.callCount}, records=${success.environment.learningStore.size}`);

  const restoredDependencies = {
    ...success.environment.dependencies,
    operationRepository: new InMemoryRealLearningOperationRepository(success.environment.operationStore),
    learningPersistenceRepository: new InMemoryLearningPersistenceRepository(success.environment.learningStore),
  };
  const restored = await runPhase163RealLearningChain(success.environment.input, restoredDependencies);
  record('D0-6 Repository 重建后从 Checkpoint 恢复且保持幂等',
    restored.status === 'completed' &&
      restored.acceptanceReport.persistence.recoveredFromCheckpoint &&
      !restored.acceptanceReport.persistence.diagnosisReexecutedDuringRecovery &&
      success.environment.provider.callCount === 1 &&
      restored.checkpoint.taskEvidenceReturnResult?.returnId === firstReturnId,
    `recovered=${restored.acceptanceReport.persistence.recoveredFromCheckpoint}, providerCalls=${success.environment.provider.callCount}`);
}

async function checkInvalidAnswer(): Promise<void> {
  const environment = await createPhase163DemoEnvironment('invalid_answer', '不知道');
  const result = await runPhase163RealLearningChain(environment.input, environment.dependencies);
  const entry = buildEntry(environment, result);
  record('D0-7 无效答案在 Provider 前阻断并返回原题修改',
    result.status === 'retry_required' &&
      environment.provider.callCount === 0 &&
      !result.checkpoint.taskEvidenceReturnResult &&
      entry.status === 'continue_round',
    `status=${result.status}, providerCalls=${environment.provider.callCount}, entry=${entry.status}`);
}

async function checkProviderFailure(): Promise<void> {
  const environment = await createPhase163DemoEnvironment('complete_chain', VALID_ANSWER);
  const failingProvider = new ScriptedDiagnosisProviderAdapter([
    { type: 'error', category: 'provider_unavailable', retryable: false },
  ]);
  const result = await runPhase163RealLearningChain(environment.input, {
    ...environment.dependencies,
    provider: failingProvider,
  });
  const entry = buildEntry(environment, result);
  record('D0-8 Provider 失败安全停止，不生成 Mock Diagnosis 或 Evidence',
    result.status === 'retry_required' &&
      !result.checkpoint.taskEvidenceReturnResult &&
      !result.checkpoint.updatedStudentAbilityProfile &&
      entry.status === 'recovering_submission',
    `status=${result.status}, action=${result.checkpoint.nextAction}, entry=${entry.status}`);
}

async function checkDiagnosisReview(): Promise<void> {
  const environment = await createPhase163DemoEnvironment('diagnosis_review', VALID_ANSWER);
  const result = await runPhase163RealLearningChain(environment.input, environment.dependencies);
  const entry = buildEntry(environment, result);
  record('D0-9 questionable Diagnosis 进入复核且不污染正式数据',
    result.status === 'review_required' &&
      !result.checkpoint.taskEvidenceReturnResult &&
      entry.status === 'review_required',
    `status=${result.status}, evidence=${Boolean(result.checkpoint.taskEvidenceReturnResult)}, entry=${entry.status}`);
}

async function checkNextResourceMismatch(): Promise<void> {
  const environment = await createPhase163DemoEnvironment('resource_mismatch', VALID_ANSWER);
  const result = await runPhase163RealLearningChain(environment.input, environment.dependencies);
  const recordValue = await environment.dependencies.learningPersistenceRepository.loadLatest(environment.input.studentId);
  const entry = buildEntry(environment, result, recordValue || undefined);
  record('D0-10 能力错位资源不用于凑匹配，已完成结果仍保持保存',
    result.status === 'blocked' &&
      result.checkpoint.nextTaskResolution?.status === 'no_match' &&
      Boolean(result.checkpoint.learningPersistenceRecordId) &&
      entry.status === 'blocked',
    `status=${result.status}, next=${result.checkpoint.nextTaskResolution?.status}, entry=${entry.status}`);
}

async function checkRecoveredFeedbackUsesCurrentThinkingGap(): Promise<void> {
  const answer = '父亲很生气，因为他捏着树叶站了很久。';
  const environment = await createPhase163DemoEnvironment('complete_chain', answer);
  const provider = new ScriptedDiagnosisProviderAdapter([{
    type: 'response',
    rawOutput: JSON.stringify({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'controlled_phase16_3_recovery_regression',
      answerStatus: 'does_not_meet',
      scoreBand: 'low',
      mainAbility: 'inference',
      relatedAbilities: ['comprehension'],
      surfaceError: '学生对父亲心理的理解与人物动作不一致。',
      rootCause: '学生注意到了父亲捏着树叶站了很久，但把这一动作理解为生气。',
      errorType: '待验证',
      abilityEvidence: ['学生写出父亲很生气，并引用捏着树叶站了很久作为理由。'],
      diagnosisSummary: '本次回答找到了人物动作，但人物心理判断需要重新考虑。',
      nextTraining: '重新判断人物心理，并说明动作与心理之间的关系。',
      confidence: 0.86,
    }),
    latencyMs: 2,
  }]);
  const result = await runPhase163RealLearningChain(environment.input, {
    ...environment.dependencies,
    provider,
  });
  const feedback = resolvePhase163LiveStudentFeedback(result.checkpoint);
  const primaryGap = feedback?.thinkingReview?.primaryGap;
  const missingPoint = feedback?.thinkingReview?.missingPoints[0] || '';
  const actions = feedback?.guidance?.revisionActions || [];
  record('D0-11 恢复后的点评与建议使用同一主要缺口',
    result.status === 'completed' &&
      missingPoint.includes('心理') &&
      actions[1]?.includes('重新想一想') === true &&
      actions[1]?.includes('心理') === true &&
      actions[2] === '说明这个动作为什么能表现出父亲当时的这种心理。',
    `runtime=${result.status}/${result.checkpoint.nextAction}, issues=${result.checkpoint.issues.join('|') || 'none'}, feedback=${result.checkpoint.controlledFeedbackResult?.status || 'none'}, scope=${result.checkpoint.controlledFeedbackResult?.admissionDecision.expressionScope || 'none'}, gap=${primaryGap?.requirement || missingPoint || 'none'}, actions=${actions.join(' / ') || 'none'}`);
}

function checkStudentSurface(entry: UnifiedLearningEntryState): void {
  const serialized = JSON.stringify(entry);
  const forbidden = [
    'operationId', 'learningSessionId', 'learningRoundId', 'evidenceIds',
    'rawOutput', 'promptVersion', 'providerConfig', 'confidence', 'apiKey',
  ];
  record('D0-12 学生入口不暴露 Runtime、Prompt、Provider 或追溯 ID',
    forbidden.every((key) => !serialized.includes(key)),
    `forbidden=${forbidden.filter((key) => serialized.includes(key)).join('|') || 'none'}`);
}

function buildEntry(
  environment: Awaited<ReturnType<typeof createPhase163DemoEnvironment>>,
  result: Phase163RealLearningChainResult,
  latestPersistenceRecord?: LearningPersistenceRecord,
): UnifiedLearningEntryState {
  const context = createUnifiedLearningActivityContext({
    studentId: environment.input.studentId,
    learningSessionId: environment.input.learningSessionId,
    currentLearningRoundId: environment.input.learningRoundId,
    createdAt: environment.input.startedAt,
    updatedAt: environment.input.submittedAt,
  });
  return buildUnifiedLearningEntryState({
    studentId: environment.input.studentId,
    now: NOW,
    activeContexts: [context],
    latestPersistenceRecord,
    operationCheckpoint: result.checkpoint,
    hasAvailableTask: result.checkpoint.nextTaskResolution?.status === 'matched',
    completedRoundCount: result.checkpoint.learningRoundResult?.status === 'completed' ? 1 : 0,
  });
}

function record(id: string, passed: boolean, detail: string): void {
  checks.push({ id, passed, detail });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
