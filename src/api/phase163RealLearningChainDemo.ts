import { runPhase163RealLearningChain } from '../ai/agents/phase163RealLearningChainAgent.ts';
import { summarizeGrowthMemory } from '../ai/agents/growthMemorySummaryAgent.ts';
import { createDiagnosisProviderConfigSnapshot } from '../ai/agents/realLLMRuntimeFoundationAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../ai/prompts/buildRealAIDiagnosisPromptV4.ts';
import {
  ScriptedDiagnosisProviderAdapter,
  type DiagnosisProviderAdapter,
  type DiagnosisProviderRequest,
  type DiagnosisProviderResponse,
} from '../ai/providers/diagnosisProviderAdapter.ts';
import { InMemoryControlledFeedbackRepository } from '../ai/repositories/inMemoryControlledFeedbackRepository.ts';
import { InMemoryFormalDiagnosisRepository } from '../ai/repositories/inMemoryFormalDiagnosisRepository.ts';
import {
  createInMemoryLearningPersistenceStore,
  InMemoryLearningPersistenceRepository,
} from '../ai/repositories/inMemoryLearningPersistenceRepository.ts';
import {
  createInMemoryRealLearningOperationStore,
  InMemoryRealLearningOperationRepository,
} from '../ai/repositories/inMemoryRealLearningOperationRepository.ts';
import type { DiagnosisResult } from '../ai/schemas/diagnosis.schema.ts';
import type { TaskRequest } from '../ai/schemas/nextLearningStrategy.schema.ts';
import type { FrozenQuestionResourceVersion } from '../ai/schemas/questionResourceAdmission.schema.ts';
import type {
  NextFormalTaskResolution,
  Phase163RealLearningChainResult,
} from '../ai/schemas/realLearningOperation.schema.ts';
import type { StudentAbilityProfile } from '../ai/schemas/studentAbilityProfile.schema.ts';
import { getPhase161To162IntegrationDemoData } from './phase161To162IntegrationDemo.ts';
import { PHASE163_DEMO_STUDENT_ID } from './phase163LearningIdentity.ts';

const STUDENT_ID = PHASE163_DEMO_STUDENT_ID;
const STARTED_AT = '2026-07-21T10:00:00.000Z';
const SUBMITTED_AT = '2026-07-21T10:05:00.000Z';
const VALID_ANSWER = '父亲捏着褪色的树叶站了很久，又小心地夹回原处，说明他想起过去，因此感到怀念和不舍。';

export type Phase163DemoCaseId =
  | 'complete_chain'
  | 'invalid_answer'
  | 'diagnosis_review'
  | 'resource_mismatch';

export type Phase163DemoCase = {
  id: Phase163DemoCaseId;
  label: string;
  description: string;
  expected: string;
  defaultAnswer: string;
};

export type Phase163DemoTask = {
  title: string;
  focus: string;
  readingText: string;
  questionText: string;
};

export type Phase163DemoResult = {
  caseId: Phase163DemoCaseId;
  status: 'completed' | 'retry_required' | 'review_required' | 'blocked';
  stage: string;
  headline: string;
  summary: string;
  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;
  nextTask?: Phase163DemoTask;
  providerCallCount: number;
  evidenceCount: number;
  replayed: boolean;
  checks: Array<{ label: string; passed: boolean }>;
  issues: string[];
};

const cases: Phase163DemoCase[] = [
  {
    id: 'complete_chain',
    label: '正常完整回流',
    description: '有效回答经过正式 Diagnosis、Evidence、GrowthMemory，再生成下一道正式任务。',
    expected: '完整链路通过，下一题来自另一条 Frozen Resource；重复提交不产生第二份 Evidence。',
    defaultAnswer: VALID_ANSWER,
  },
  {
    id: 'invalid_answer',
    label: '无效作答阻断',
    description: '占位回答应在调用 Diagnosis Provider 前停止。',
    expected: 'Provider 调用为 0，不生成 Evidence，也不更新 Profile。',
    defaultAnswer: '不知道',
  },
  {
    id: 'diagnosis_review',
    label: '诊断进入复核',
    description: '结构合法但质量准入为 questionable 的 Diagnosis 不得自动回流。',
    expected: '进入 review_required，不生成 Evidence，不展示未经确认的能力结论。',
    defaultAnswer: VALID_ANSWER,
  },
  {
    id: 'resource_mismatch',
    label: '下一资源错位',
    description: '本轮可以正式完成，但能力错位的候选资源不能用于凑匹配。',
    expected: '本轮 Evidence 已保存，下一任务 no_match，错误资源不进入学生题目区。',
    defaultAnswer: VALID_ANSWER,
  },
];

type DemoEnvironment = Awaited<ReturnType<typeof createPhase163DemoEnvironment>>;
const environments = new Map<Phase163DemoCaseId, DemoEnvironment>();

export function getPhase163DemoCases(): Phase163DemoCase[] {
  return cases;
}

export async function loadPhase163DemoTask(): Promise<Phase163DemoTask> {
  const fixtures = await getFormalFixtures();
  return toTask(fixtures.initialVersion);
}

export async function runPhase163DemoCase(
  caseId: Phase163DemoCaseId,
  answerText: string,
): Promise<Phase163DemoResult> {
  const normalizedAnswer = answerText.trim();
  let environment = environments.get(caseId);
  if (!environment || environment.input.answerText !== normalizedAnswer) {
    environment = await createPhase163DemoEnvironment(caseId, normalizedAnswer);
    environments.set(caseId, environment);
  }
  const replayed = environment.runCount > 0;
  const result = await runPhase163RealLearningChain(environment.input, environment.dependencies);
  environment.runCount += 1;
  return toResult(caseId, result, environment.provider.callCount, replayed);
}

export function resetPhase163DemoCase(caseId?: Phase163DemoCaseId): void {
  if (caseId) environments.delete(caseId);
  else environments.clear();
}

export async function createPhase163DemoEnvironment(
  caseId: Phase163DemoCaseId,
  answerText: string,
) {
  const fixtures = await getFormalFixtures();
  const provider = new CountingProvider(new ScriptedDiagnosisProviderAdapter([
    { type: 'response', rawOutput: JSON.stringify(validDiagnosis()), latencyMs: 2 },
  ]));
  const profile = buildProfile();
  const growthSummary = summarizeGrowthMemory({ studentId: STUDENT_ID, abilityId: 'inference', records: [] });
  const learningStore = createInMemoryLearningPersistenceStore();
  const operationStore = createInMemoryRealLearningOperationStore();
  const input = {
    operationId: `phase16-3-demo-operation-${caseId}`,
    learningSessionId: `phase16-3-demo-session-${caseId}`,
    learningRoundId: `phase16-3-demo-round-${caseId}`,
    diagnosisRequestId: `phase16-3-demo-diagnosis-${caseId}`,
    studentId: STUDENT_ID,
    resourceVersion: fixtures.initialVersion,
    qualityGatedTask: fixtures.initialTask,
    answerText,
    startedAt: STARTED_AT,
    submittedAt: SUBMITTED_AT,
    currentProfile: profile,
    currentGrowthMemorySummary: growthSummary,
    currentLearningContext: {
      contextId: `phase16-3-demo-context-${caseId}`,
      studentId: STUDENT_ID,
      currentPhase: 'observation' as const,
      targetAbilityId: 'inference',
      recentTaskRole: 'training' as const,
      allowTraining: true,
      allowRetest: true,
      allowTransfer: true,
      recentFailureCount: 0,
      cognitiveLoad: 'medium' as const,
      reviewRequired: false,
    },
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: provider.providerName,
      model: 'phase16-3-demo-scripted-model',
      providerConfigId: `phase16-3-demo-config-${caseId}`,
      promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
      maxAttempts: 1,
      timeoutMs: 1_000,
      createdAt: STARTED_AT,
    }),
    timezone: 'Asia/Shanghai',
  };
  const dependencies = {
    provider,
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    controlledFeedbackRepository: new InMemoryControlledFeedbackRepository(),
    learningPersistenceRepository: new InMemoryLearningPersistenceRepository(learningStore),
    operationRepository: new InMemoryRealLearningOperationRepository(operationStore),
    resolveNextTask: async ({ taskRequest }: { taskRequest: TaskRequest }): Promise<NextFormalTaskResolution> => {
      if (caseId === 'resource_mismatch') {
        return {
          status: 'no_match',
          taskRequestId: taskRequest.taskRequestId,
          issues: ['next_resource_target_ability_mismatch'],
        };
      }
      const abilityAligned = fixtures.nextVersion.abilityMetadata.abilityId === taskRequest.targetAbilityId;
      if (!abilityAligned) {
        return {
          status: 'no_match',
          taskRequestId: taskRequest.taskRequestId,
          issues: ['next_resource_target_ability_mismatch'],
        };
      }
      return {
        status: 'matched',
        taskRequestId: taskRequest.taskRequestId,
        resourceVersion: fixtures.nextVersion,
        qualityGatedTask: fixtures.nextTask,
        issues: [],
      };
    },
    assessDiagnosisAdmission: caseId === 'diagnosis_review'
      ? () => ({
        status: 'questionable' as const,
        basis: 'quality_policy' as const,
        sourceIds: [`phase16-3-demo-diagnosis-${caseId}`],
        limitations: ['human_review_required'],
        issues: ['diagnosis_quality_questionable'],
      })
      : undefined,
    now: () => SUBMITTED_AT,
  };
  return { input, dependencies, provider, learningStore, operationStore, runCount: 0 };
}

async function getFormalFixtures() {
  const demo = await getPhase161To162IntegrationDemoData();
  const initial = demo.cases.find((item) => item.id === 'repository-handoff');
  const next = demo.cases.find((item) => item.id === 'version-switch');
  if (!initial?.selectedVersion || !initial.taskResult.task || !next?.selectedVersion || !next.taskResult.task) {
    throw new Error('Phase 16.3 Demo formal resource fixtures are unavailable.');
  }
  return {
    initialVersion: initial.selectedVersion,
    initialTask: initial.taskResult.task,
    nextVersion: next.selectedVersion,
    nextTask: next.taskResult.task,
  };
}

function toResult(
  caseId: Phase163DemoCaseId,
  result: Phase163RealLearningChainResult,
  providerCallCount: number,
  replayed: boolean,
): Phase163DemoResult {
  const checkpoint = result.checkpoint;
  const feedback = checkpoint.controlledFeedbackResult?.studentLearningFeedback;
  const evidenceCount = checkpoint.taskEvidenceReturnResult?.abilityEvidence.length || 0;
  const invalid = checkpoint.taskExecutionResult?.responseValidity.status !== 'valid';
  const review = result.status === 'review_required';
  const nextMismatch = caseId === 'resource_mismatch' && checkpoint.nextTaskResolution?.status === 'no_match';
  const headline = feedback?.headline || (invalid
    ? '这次回答的信息还不够'
    : review
      ? '本次结果需要进一步确认'
      : nextMismatch
        ? '本轮已完成，下一任务暂未匹配'
        : '本次运行已安全停止');
  const summary = feedback?.summary || (invalid
    ? '请写出自己的判断，并结合阅读材料说明理由。'
    : review
      ? '系统不会根据这次未经确认的诊断改变能力状态。'
      : nextMismatch
        ? '本轮正式结果已经保存，但能力错位的资源不会用于凑匹配。'
        : '当前分支没有产生可展示的正式学习结果。');
  const checks = Object.entries(result.acceptanceReport.checks).map(([key, passed]) => ({
    label: checkLabel(key),
    passed,
  }));
  return {
    caseId,
    status: result.status,
    stage: checkpoint.stage,
    headline,
    summary,
    whatYouDidWell: (feedback?.whatYouDidWell || []).map(studentizeText),
    whatNeedsAttention: (feedback?.whatNeedsAttention || []).map(studentizeText),
    nextActionText: studentizeText(feedback?.nextActionText || nextActionLabel(checkpoint.nextAction)),
    nextTask: checkpoint.nextTaskResolution?.resourceVersion
      ? toTask(checkpoint.nextTaskResolution.resourceVersion)
      : undefined,
    providerCallCount,
    evidenceCount,
    replayed,
    checks,
    issues: checkpoint.issues,
  };
}

function toTask(version: FrozenQuestionResourceVersion): Phase163DemoTask {
  return {
    title: version.title,
    focus: '根据人物动作推断心理',
    readingText: version.materialSnapshot?.content || '',
    questionText: version.questionStem,
  };
}

function validDiagnosis(): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'controlled_phase16_3_demo_diagnosis',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    mainAbility: 'inference',
    relatedAbilities: ['comprehension'],
    surfaceError: '本次回答能够回应题目要求。',
    rootCause: '学生能够使用人物动作支持本次心理判断。',
    errorType: '待验证',
    abilityEvidence: ['学生写出怀念、不舍，并引用站了很久和小心夹回原处作为依据。'],
    diagnosisSummary: '本次回答形成了人物动作到人物心理的推理关系。',
    nextTraining: '后续可在新材料中继续观察独立推理表现。',
    confidence: 0.82,
  };
}

function buildProfile(): StudentAbilityProfile {
  return {
    studentId: STUDENT_ID,
    generatedAt: STARTED_AT,
    current_weakness: { primary: 'inference', secondary: [] },
    ability_status: [{
      ability: 'inference',
      status: 'weak',
      summary: '推理能力仍需通过新的正式作答继续观察。',
      weakness_count: 1,
      positive_count: 0,
      growth_count: 0,
      insufficient_count: 0,
      evidence_links: [],
    }],
    improvement_signals: [],
    continue_training_focus: '继续练习根据人物动作推断心理。',
    evidence_links: [],
    next_step_recommendation: '继续完成一项正式推理任务。',
  };
}

class CountingProvider implements DiagnosisProviderAdapter {
  readonly providerName: string;
  callCount = 0;
  private readonly delegate: DiagnosisProviderAdapter;
  constructor(delegate: DiagnosisProviderAdapter) {
    this.delegate = delegate;
    this.providerName = delegate.providerName;
  }
  async diagnose(request: DiagnosisProviderRequest): Promise<DiagnosisProviderResponse> {
    this.callCount += 1;
    return this.delegate.diagnose(request);
  }
}

function nextActionLabel(action: string): string {
  return {
    submit_answer: '请修改回答后重新提交。',
    retry_provider: '请稍后重试分析。',
    retry_persistence: '请重试保存本轮结果。',
    human_review: '等待人工复核后再继续。',
    prepare_resource: '请准备符合当前能力目标的正式资源。',
    start_next_task: '可以进入下一道正式任务。',
    stop: '本次运行已经停止。',
  }[action] || '请根据当前状态继续。';
}

function checkLabel(key: string): string {
  return {
    sourceResourceFrozen: '起始资源已经冻结',
    taskIdentityAligned: '资源与任务身份一致',
    responseIdentityAligned: '作答身份一致',
    formalDiagnosisCommitted: '正式 Diagnosis 已提交',
    evidenceReturnedOnce: 'Evidence 仅回流一次',
    traceabilityComplete: '证据追溯链完整',
    formalResultSaved: '本轮正式结果已保存',
    nextTaskUsesFormalResource: '下一任务使用正式资源',
    nextConcreteTaskReady: '下一任务可以执行',
    nextTaskDerivedFromMemory: '下一任务由本轮记忆驱动',
  }[key] || key;
}

function studentizeText(value: string): string {
  return value
    .replaceAll('「inference」', '「推理」')
    .replaceAll('inference', '推理');
}
