import { buildUnifiedLearningEntryState, createUnifiedLearningActivityContext } from '../agents/unifiedLearningEntryAgent.ts';
import { runPhase163RealLearningChain } from '../agents/phase163RealLearningChainAgent.ts';
import { InMemoryRealLearningOperationRepository } from '../repositories/inMemoryRealLearningOperationRepository.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';
import { getPhase163FormalResourcePoolData } from '../../api/phase161To162IntegrationDemo.ts';
import { createPhase163DemoEnvironment } from '../../api/phase163RealLearningChainDemo.ts';
import {
  PHASE163_DEMO_STUDENT_ID,
  PHASE163_PRODUCT_STUDENT_ID,
  isPhase163ProductRuntimeIdentity,
  resolvePhase163RuntimeScope,
} from '../../api/phase163LearningIdentity.ts';
import { resolveStudentRuntimePausePresentation } from '../content/studentRuntimeMessages.ts';

const NOW = '2026-07-21T16:00:00.000Z';
type Report = { name: string; passed: boolean; detail: string };
const reports: Report[] = [];

async function main(): Promise<void> {
  check('S1 正式产品与 Demo 学生身份不同',
    PHASE163_PRODUCT_STUDENT_ID !== PHASE163_DEMO_STUDENT_ID,
    `product=${PHASE163_PRODUCT_STUDENT_ID}, demo=${PHASE163_DEMO_STUDENT_ID}`);
  check('S2 正式身份解析为 product',
    resolvePhase163RuntimeScope({ studentId: PHASE163_PRODUCT_STUDENT_ID }) === 'product',
    resolvePhase163RuntimeScope({ studentId: PHASE163_PRODUCT_STUDENT_ID }));
  check('S3 Demo 身份解析为 demo',
    resolvePhase163RuntimeScope({ studentId: PHASE163_DEMO_STUDENT_ID }) === 'demo',
    resolvePhase163RuntimeScope({ studentId: PHASE163_DEMO_STUDENT_ID }));
  check('S4 正式 studentId 混入 Demo Operation 仍被拒绝',
    !isPhase163ProductRuntimeIdentity({
      studentId: PHASE163_PRODUCT_STUDENT_ID,
      operationId: 'phase16-3-demo-operation-diagnosis_review',
    }),
    'mixed identity rejected');

  const pool = await getPhase163FormalResourcePoolData(PHASE163_PRODUCT_STUDENT_ID);
  check('S5 正式资源进入本轮前绑定产品学生',
    pool.length > 0 && pool.every((item) => item.task.executableTask.studentId === PHASE163_PRODUCT_STUDENT_ID),
    `resources=${pool.length}, students=${[...new Set(pool.map((item) => item.task.executableTask.studentId))].join('|')}`);

  const repository = new InMemoryRealLearningOperationRepository();
  await repository.save(checkpoint(PHASE163_PRODUCT_STUDENT_ID, 'product'));
  await repository.save(checkpoint(PHASE163_DEMO_STUDENT_ID, 'demo'));
  await repository.clearByStudent(PHASE163_DEMO_STUDENT_ID);
  check('S6 清理 Demo Operation 不影响正式 Operation',
    Boolean(await repository.getByOperationId('operation-product')) &&
      !(await repository.getByOperationId('operation-demo')),
    'product=kept, demo=cleared');

  const productContext = createUnifiedLearningActivityContext({
    studentId: PHASE163_PRODUCT_STUDENT_ID,
    learningSessionId: 'learning-session-product',
    currentLearningRoundId: 'learning-session-product-round-1',
    createdAt: NOW,
  });
  const mixedState = buildUnifiedLearningEntryState({
    studentId: PHASE163_PRODUCT_STUDENT_ID,
    now: NOW,
    activeContexts: [productContext],
    operationCheckpoint: checkpoint(PHASE163_DEMO_STUDENT_ID, 'demo'),
    hasAvailableTask: true,
    completedRoundCount: 0,
  });
  check('S7 Demo Checkpoint 不能进入正式学生入口',
    mixedState.status === 'review_required' && !mixedState.validation.passed && !mixedState.canEnterWorkspace,
    `status=${mixedState.status}, validation=${mixedState.validation.passed}`);

  const reviewState = buildUnifiedLearningEntryState({
    studentId: PHASE163_PRODUCT_STUDENT_ID,
    now: NOW,
    activeContexts: [productContext],
    operationCheckpoint: checkpoint(PHASE163_PRODUCT_STUDENT_ID, 'product'),
    hasAvailableTask: true,
    completedRoundCount: 0,
  });
  const studentCopy = `${reviewState.title} ${reviewState.message} ${reviewState.primaryActionText}`;
  const forbidden = ['等待确认', '人工复核', 'Diagnosis', 'Evidence', 'operationId'];
  check('S8 真实复核状态说明结果不采用且不暗示无人承接的确认流程',
    reviewState.status === 'review_required' &&
      reviewState.primaryAction === 'retry_later' &&
      reviewState.primaryActionText === '结束本次学习' &&
      forbidden.every((term) => !studentCopy.includes(term)),
    studentCopy);

  const postRoundReview = resolveStudentRuntimePausePresentation({
    status: 'review_required',
    nextAction: 'human_review',
    hasFormalRoundResult: true,
  });
  check('S8.1 本轮已保存后的下一任务复核不误报本次结果未采用',
    postRoundReview.reason === 'next_task_review' &&
      postRoundReview.title === '本轮学习已经完成' &&
      postRoundReview.message.includes('本轮结果已经保存') &&
      !postRoundReview.message.includes('不会用它更新'),
    `${postRoundReview.title} ${postRoundReview.message}`);

  const diagnosisReview = resolveStudentRuntimePausePresentation({
    status: 'review_required',
    nextAction: 'human_review',
    hasFormalRoundResult: false,
  });
  check('S8.2 Diagnosis 未采用仍保留安全阻断说明',
    diagnosisReview.reason === 'diagnosis_not_adopted' &&
      diagnosisReview.title === '本次结果暂不采用' &&
      diagnosisReview.message.includes('不会用它更新你的学习记录'),
    `${diagnosisReview.title} ${diagnosisReview.message}`);

  const environment = await createPhase163DemoEnvironment(
    'complete_chain',
    '父亲捏着树叶站了很久，又小心地夹回原处，说明他想起过去，感到怀念和不舍。',
  );
  const productInput = {
    ...environment.input,
    operationId: 'phase16-3-product-operation-scope-debug',
    learningSessionId: 'learning-session-product-scope-debug',
    learningRoundId: 'learning-session-product-scope-debug-round-1',
    diagnosisRequestId: 'phase16-3-product-diagnosis-scope-debug',
    studentId: PHASE163_PRODUCT_STUDENT_ID,
    resourceVersion: pool[0].version,
    qualityGatedTask: pool[0].task,
    currentProfile: { ...environment.input.currentProfile, studentId: PHASE163_PRODUCT_STUDENT_ID },
    currentGrowthMemorySummary: {
      ...environment.input.currentGrowthMemorySummary,
      studentId: PHASE163_PRODUCT_STUDENT_ID,
    },
    currentLearningContext: {
      ...environment.input.currentLearningContext,
      studentId: PHASE163_PRODUCT_STUDENT_ID,
      contextId: 'phase16-3-product-context-scope-debug',
    },
  };
  const productResult = await runPhase163RealLearningChain(productInput, {
    ...environment.dependencies,
    resolveNextTask: async ({ taskRequest }) => ({
      status: 'matched' as const,
      taskRequestId: taskRequest.taskRequestId,
      resourceVersion: pool[1].version,
      qualityGatedTask: pool[1].task,
      issues: [],
    }),
  });
  const productPersistence = await environment.dependencies.learningPersistenceRepository
    .loadLatest(PHASE163_PRODUCT_STUDENT_ID);
  check('S9 产品身份贯穿 Task、Response、Evidence 与持久化主链',
    productResult.status === 'completed' &&
      productResult.checkpoint.concreteTask?.studentId === PHASE163_PRODUCT_STUDENT_ID &&
      productResult.checkpoint.taskExecutionResult?.studentId === PHASE163_PRODUCT_STUDENT_ID &&
      productResult.checkpoint.taskEvidenceReturnResult?.abilityEvidence.every(
        (item) => item.studentId === PHASE163_PRODUCT_STUDENT_ID,
      ) === true &&
      productPersistence?.studentId === PHASE163_PRODUCT_STUDENT_ID,
    `status=${productResult.status}, task=${productResult.checkpoint.concreteTask?.studentId}, persistence=${productPersistence?.studentId || 'missing'}`);

  console.log('\nPhase 16.3 Product / Demo Scope Isolation Debug');
  console.log('='.repeat(78));
  reports.forEach((report) => {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail}`);
  });
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  console.log('Provider mode: scripted deterministic for S9 only (no network)');
  console.log('Data policy: product and demo identities remain isolated; no legacy data deletion.');
  if (passed !== reports.length) throw new Error('Phase 16.3 product scope isolation Debug failed.');
}

function checkpoint(studentId: string, suffix: string): RealLearningOperationCheckpoint {
  return {
    schemaVersion: 'real_learning_operation_v1',
    operationId: `operation-${suffix}`,
    learningSessionId: `session-${suffix}`,
    learningRoundId: `round-${suffix}`,
    studentId,
    stage: 'diagnosis_committed',
    status: 'review_required',
    nextAction: 'human_review',
    sourceResourceId: `resource-${suffix}`,
    sourceResourceVersionId: `resource-version-${suffix}`,
    sourceTaskId: `task-${suffix}`,
    diagnosisRequestId: `diagnosis-${suffix}`,
    issues: ['diagnosis_quality_questionable'],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function check(name: string, passed: boolean, detail: string): void {
  reports.push({ name, passed, detail });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
