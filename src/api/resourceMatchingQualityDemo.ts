import { evaluateCoreResourceEligibility } from '../ai/agents/coreResourceEligibilityAgent.ts';
import {
  createQualityGatedExecutableTask,
  evaluateResourceMatchQuality,
} from '../ai/agents/resourceMatchQualityAgent.ts';
import { buildStableId } from '../ai/agents/reviewedResourceCandidateAdapter.ts';
import {
  ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
  ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
  type AdaptiveConstraintRule,
  type AdaptiveTaskRequestEnvelope,
} from '../ai/schemas/adaptiveTaskConstraints.schema.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type FrozenQuestionResourceVersion,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import type {
  ResourceEligibilitySnapshot,
  ResourceMatchRecentHistory,
} from '../ai/schemas/resourceMatchQuality.schema.ts';
import type { TaskFulfillmentRequest } from '../ai/schemas/taskFulfillment.schema.ts';

const NOW = '2026-07-20T12:00:00.000Z';
const STUDENT_ID = 'student-phase16-2-demo';
const ABILITY_ID = 'inference';

type DemoScenario = {
  envelope: AdaptiveTaskRequestEnvelope;
  fulfillment: TaskFulfillmentRequest;
  snapshot: ResourceEligibilitySnapshot;
  history: ResourceMatchRecentHistory;
};

type DemoDefinition = {
  id: string;
  label: string;
  description: string;
  expected: string;
  acceptancePoints: string[];
  mutate?: (scenario: DemoScenario) => void;
  mutateBeforeCreate?: (snapshot: ResourceEligibilitySnapshot) => void;
  expectedQualityStatus: 'matched' | 'partial_match' | 'no_match' | 'review_required';
  expectedTaskStatus: 'created' | 'blocked';
  expectedTaskIssue?: string;
};

const definitions: DemoDefinition[] = [
  {
    id: 'matched',
    label: '正式资源匹配',
    description: '能力、任务角色、难度、Rubric、材料关系、提示策略和 Registry 状态全部符合请求。',
    expected: '应选择正式 Frozen Version，并生成带完整追溯信息的可执行任务。',
    acceptancePoints: [
      '16.2A 核心资格为 eligible。',
      '16.2B 输出 matched。',
      '仅该分支可以生成 ExecutableLearningTask。',
    ],
    expectedQualityStatus: 'matched',
    expectedTaskStatus: 'created',
  },
  {
    id: 'recent-duplicate',
    label: '近期任务重复',
    description: '候选资源本身合格，但同一 taskId 已出现在近期学习记录中。',
    expected: '应降级为 partial_match，不得为了完成匹配而忽略近期重复。',
    acceptancePoints: [
      '核心资格仍可通过。',
      '上下文质量 Gate 识别近期重复。',
      '不生成可执行任务。',
    ],
    mutate: (scenario) => {
      scenario.history.recentTaskIds = ['task-demo'];
    },
    expectedQualityStatus: 'partial_match',
    expectedTaskStatus: 'blocked',
  },
  {
    id: 'ability-mismatch',
    label: '目标能力错位',
    description: '请求训练推理能力，但资源的 primary ability 是理解。',
    expected: '应在核心资格 Gate 被拒绝并输出 no_match，supporting ability 不能替代 primary ability。',
    acceptancePoints: [
      'primary ability 必须与请求一致。',
      '错误资源不会进入 Existing TaskFulfillment。',
      'Resource Gap 保留缺口原因。',
    ],
    mutate: (scenario) => {
      scenario.snapshot.frozenVersions[0]!.abilityMetadata.abilityId = 'comprehension';
      scenario.snapshot.frozenVersions[0]!.abilityMetadata.supportingAbilityIds = ['inference'];
      scenario.snapshot.registryEntries[0]!.abilityId = 'comprehension';
      scenario.snapshot.frozenVersions[0]!.rubric = scenario.snapshot.frozenVersions[0]!.rubric.map((item) => ({
        ...item,
        abilityId: 'comprehension',
      }));
    },
    expectedQualityStatus: 'no_match',
    expectedTaskStatus: 'blocked',
  },
  {
    id: 'role-mismatch',
    label: '任务角色错位',
    description: '请求训练任务，但正式资源被审核为 retest。',
    expected: '不得将复测资源当作普通训练任务使用。',
    acceptancePoints: [
      'taskRole 不一致时核心资格失败。',
      '不静默改写 Strategy 或资源角色。',
      '不生成可执行任务。',
    ],
    mutate: (scenario) => {
      scenario.snapshot.frozenVersions[0]!.abilityMetadata.taskRole = 'retest';
      scenario.snapshot.registryEntries[0]!.taskRole = 'retest';
    },
    expectedQualityStatus: 'no_match',
    expectedTaskStatus: 'blocked',
  },
  {
    id: 'missing-capability',
    label: '缺少必要能力',
    description: '请求额外要求 advanced_scaffold，但正式资源没有声明该能力。',
    expected: '应输出 partial_match，不能从题目内容中猜测资源具备未声明能力。',
    acceptancePoints: [
      'required capability 使用结构化字段校验。',
      '缺失条件进入 Resource Gap。',
      '不放宽硬约束。',
    ],
    mutate: (scenario) => {
      scenario.envelope.adaptiveConstraints.requiredCapabilities.push('advanced_scaffold');
      scenario.fulfillment.requiredCapabilities.push('advanced_scaffold');
      scenario.envelope.adaptiveConstraints.hardConstraints.push({
        code: 'required_capability',
        operator: 'required',
        value: 'advanced_scaffold',
        source: 'quality',
      });
    },
    expectedQualityStatus: 'partial_match',
    expectedTaskStatus: 'blocked',
  },
  {
    id: 'registry-review',
    label: 'Registry 指向异常',
    description: 'Registry 当前版本指向一个不存在的 Frozen Version。',
    expected: '身份与版本链无法闭合，应进入 review_required，而不是猜测使用现有版本。',
    acceptancePoints: [
      'Registry 是当前正式版本的权威入口。',
      '异常数据进入人工复核。',
      '不创建正式任务。',
    ],
    mutate: (scenario) => {
      scenario.snapshot.registryEntries[0]!.currentFrozenVersionId = 'resource-demo:v99';
    },
    expectedQualityStatus: 'review_required',
    expectedTaskStatus: 'blocked',
  },
  {
    id: 'retired-resource',
    label: '资源已经退役',
    description: '资源和 Registry 均已标记为 retired。',
    expected: '退役资源必须从候选池隔离，结果为 no_match。',
    acceptancePoints: [
      'retired 资源不能重新进入匹配。',
      '历史正式版本仍可追溯，但不可执行。',
      '不生成可执行任务。',
    ],
    mutate: (scenario) => {
      scenario.snapshot.registryEntries[0]!.status = 'retired';
      scenario.snapshot.frozenVersions[0]!.status = 'retired';
    },
    expectedQualityStatus: 'no_match',
    expectedTaskStatus: 'blocked',
  },
  {
    id: 'registry-changed-before-create',
    label: '创建前版本变化',
    description: '资源通过匹配后、正式任务创建前，Registry 已切换到新版本。',
    expected: '原匹配结果不能继续执行，创建动作必须再次检查 Registry 并阻断。',
    acceptancePoints: [
      '质量评估阶段可以先得到 matched。',
      '创建前二次状态检查发现版本变化。',
      '不得使用过期匹配结果生成任务。',
    ],
    mutateBeforeCreate: (snapshot) => {
      snapshot.registryEntries[0]!.currentFrozenVersionId = 'resource-demo:v2';
      snapshot.frozenVersions[0]!.status = 'superseded';
    },
    expectedQualityStatus: 'matched',
    expectedTaskStatus: 'blocked',
    expectedTaskIssue: 'selected_resource_is_no_longer_current',
  },
];

export function getResourceMatchingQualityDemoData() {
  const cases = definitions.map(runDemoCase);
  return {
    defaultCaseId: 'matched',
    cases,
    summary: {
      total: cases.length,
      passed: cases.filter((item) => item.passed).length,
      statuses: [...new Set(cases.map((item) => item.qualityStatus))],
    },
  };
}

function runDemoCase(definition: DemoDefinition) {
  const scenario = buildScenario();
  definition.mutate?.(scenario);
  const coreEligibility = evaluateCoreResourceEligibility({
    adaptiveTaskRequestEnvelope: scenario.envelope,
    taskFulfillmentRequest: scenario.fulfillment,
    resourceSnapshot: scenario.snapshot,
    evaluatedAt: NOW,
  });
  const qualityResult = evaluateResourceMatchQuality({
    adaptiveRequestEnvelope: scenario.envelope,
    fulfillmentRequest: scenario.fulfillment,
    coreEligibility,
    resourceSnapshot: scenario.snapshot,
    recentHistory: scenario.history,
    evaluatedAt: NOW,
  });
  const currentSnapshot = clone(scenario.snapshot);
  definition.mutateBeforeCreate?.(currentSnapshot);
  const taskResult = createQualityGatedExecutableTask({
    qualityResult,
    fulfillmentRequest: scenario.fulfillment,
    currentResourceSnapshot: currentSnapshot,
    createdAt: NOW,
  });
  const qualityStatus = qualityResult.evaluation?.status || 'review_required';
  const passed = qualityStatus === definition.expectedQualityStatus &&
    taskResult.status === definition.expectedTaskStatus &&
    (!definition.expectedTaskIssue || taskResult.issues.includes(definition.expectedTaskIssue));

  return {
    ...definition,
    scenario,
    coreEligibility,
    qualityResult,
    taskResult,
    qualityStatus,
    passed,
  };
}

function buildScenario(): DemoScenario {
  const version = buildVersion();
  const envelope = buildEnvelope();
  return {
    envelope,
    fulfillment: buildFulfillment(),
    snapshot: {
      snapshotId: buildStableId('resource-eligibility-snapshot', [version.resourceVersionId]),
      registryEntries: [buildRegistry(version)],
      frozenVersions: [version],
      validations: [buildValidation(version)],
      reviews: [buildReview(version)],
      capturedAt: NOW,
      schemaVersion: 'resource_match_quality_v1',
    },
    history: {
      studentId: STUDENT_ID,
      recentTaskIds: [],
      recentResourceIds: [],
      recentResourceVersionIds: [],
      recentMaterialIds: [],
      recentExecutionSessionIds: [],
      historyWindowStartedAt: '2026-07-13T12:00:00.000Z',
      historyWindowEndedAt: NOW,
    },
  };
}

function buildVersion(): FrozenQuestionResourceVersion {
  return {
    resourceId: 'resource-demo',
    resourceVersionId: 'resource-demo:v1',
    versionNumber: 1,
    sourceDraftId: 'draft-demo',
    materialId: 'material-demo',
    materialVersionId: 'material-demo:v1',
    taskId: 'task-demo',
    title: '人物心理推断训练',
    questionStem: '父亲当时有怎样的心理？请根据材料中的动作说明理由。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    rubric: [
      {
        itemId: 'evidence',
        name: '文本依据',
        abilityId: ABILITY_ID,
        importance: 'critical',
        required: true,
        evidenceRequirement: { requireTextEvidence: true },
        acceptedSignals: ['指出父亲站了很久或小心夹回树叶'],
      },
      {
        itemId: 'explanation',
        name: '解释关系',
        abilityId: ABILITY_ID,
        importance: 'important',
        required: true,
        evidenceRequirement: { requireExplanation: true, requireConclusion: true },
        acceptedSignals: ['说明动作与怀念、不舍之间的联系'],
      },
    ],
    minimumAnswerRequirement: {
      minLength: 8,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: ABILITY_ID,
      supportingAbilityIds: ['comprehension'],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: { sourceType: 'manual', description: 'Phase 16.2 lightweight Demo fixture.' },
    tags: ['material_relation:similar_context', 'hint_policy:limited_hint', '人物心理', '文本依据'],
    validationId: 'validation-demo',
    reviewId: 'review-demo',
    status: 'frozen',
    frozenAt: NOW,
    updatedAt: NOW,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function buildRegistry(version: FrozenQuestionResourceVersion): ResourceRegistryEntry {
  return {
    resourceId: version.resourceId,
    currentFrozenVersionId: version.resourceVersionId,
    status: 'active',
    latestReviewId: version.reviewId,
    latestValidationId: version.validationId,
    materialId: version.materialId,
    taskId: version.taskId,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    tags: [...version.tags],
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function buildValidation(version: FrozenQuestionResourceVersion): ResourceValidationResult {
  return {
    validationId: version.validationId,
    draftId: version.sourceDraftId,
    resourceId: version.resourceId,
    validatedDraftRevision: 1,
    validationRuleVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    passed: true,
    checks: {
      identityValid: true,
      contentValid: true,
      answerAcceptanceValid: true,
      rubricValid: true,
      abilityAndRoleValid: true,
      versionLineageValid: true,
      materialValid: true,
    },
    issues: [],
    checkedAt: NOW,
  };
}

function buildReview(version: FrozenQuestionResourceVersion): ResourceReviewDecision {
  return {
    reviewId: version.reviewId,
    draftId: version.sourceDraftId,
    resourceId: version.resourceId,
    reviewedDraftRevision: 1,
    validationId: version.validationId,
    action: 'approve',
    reviewerId: 'reviewer-demo',
    notes: 'Approved for Phase 16.2 lightweight Demo.',
    reviewedAt: NOW,
  };
}

function buildEnvelope(): AdaptiveTaskRequestEnvelope {
  const validationGoal = '观察学生能否根据文本行为推断人物心理并说明依据。';
  const constraintsId = 'constraints-demo';
  const taskRequest = {
    taskRequestId: 'task-request-demo',
    strategyId: 'strategy-demo',
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    taskRole: 'training' as const,
    action: 'continue_training' as const,
    validationGoal,
    evidenceLinks: ['evidence-demo'],
    growthMemoryRecordIds: ['memory-demo'],
    constraints: ['targetAbilityId:inference', 'taskRole:training'],
    createdAt: NOW,
  };
  const hardConstraints: AdaptiveConstraintRule[] = [
    { code: 'task_role', operator: 'eq', value: 'training', source: 'strategy' },
    { code: 'target_ability', operator: 'eq', value: ABILITY_ID, source: 'strategy' },
    { code: 'difficulty', operator: 'eq', value: 'maintain', source: 'strategy' },
    { code: 'material_novelty', operator: 'eq', value: 'similar_context', source: 'strategy' },
    { code: 'hint_policy', operator: 'eq', value: 'limited_hint', source: 'quality' },
  ];

  return {
    envelopeId: 'adaptive-envelope-demo',
    taskRequest,
    adaptiveConstraints: {
      constraintsId,
      studentId: STUDENT_ID,
      targetAbilityId: ABILITY_ID,
      sourceStrategyId: taskRequest.strategyId,
      sourceStrategyAction: taskRequest.action,
      sourceStrategyTaskRole: 'training',
      sourceValidationGoal: validationGoal,
      sourceContextSnapshotId: 'context-demo',
      sourceConflictAssessmentId: 'conflict-demo',
      sourceConflictStatus: 'aligned_weakness_evidence',
      sourceQualityAssessmentIds: ['quality-demo'],
      sourceEvidenceIds: ['evidence-demo'],
      sourceObservationUnitIds: ['unit-demo'],
      learningIntent: 'consolidation',
      observationTarget: 'recheck_weakness',
      recommendedTaskRole: 'training',
      difficultyDirection: 'maintain',
      materialNovelty: 'similar_context',
      hintPolicy: 'limited_hint',
      targetEvidenceQuality: 'medium',
      preExecutionQualityConditions: {
        requireNovelMaterial: false,
        requireKnownDifficulty: true,
        requireAbilityAlignment: true,
        requiredHintPolicy: 'limited_hint',
        requireTraceability: true,
      },
      requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'focused_practice'],
      hardConstraints,
      softPreferences: [],
      reasons: ['继续一次受控的推理训练观察。'],
      limitations: [],
      schemaVersion: ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
      policyVersion: ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
      generatedAt: NOW,
      validation: { passed: true, issues: [] },
    },
    alignmentResult: {
      alignmentId: 'alignment-demo',
      strategyId: taskRequest.strategyId,
      constraintsId,
      contextSnapshotId: 'context-demo',
      status: 'aligned',
      checks: {
        identityAligned: true,
        strategyValidationPassed: true,
        sourceStrategyAligned: true,
        targetAbilityAligned: true,
        taskRoleAligned: true,
        validationGoalAligned: true,
        difficultyAllowed: true,
        materialAllowed: true,
        hintPolicyAllowed: true,
        contextAllowed: true,
        conflictAllowed: true,
      },
      canCreateTaskRequest: true,
      nextStep: 'create_task_request',
      issues: [],
      warnings: [],
      alignedAt: NOW,
      validation: { passed: true, issues: [] },
    },
    constraintsId,
    canEnterTaskFulfillment: true,
    schemaVersion: ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
    validation: { passed: true, issues: [] },
  };
}

function buildFulfillment(): TaskFulfillmentRequest {
  return {
    requestId: 'fulfillment-demo',
    studentId: STUDENT_ID,
    taskRole: 'training',
    targetAbilityId: ABILITY_ID,
    contentType: 'comparable_text',
    questionType: 'open_response',
    responseMode: 'written',
    difficultyRange: { preferred: 'same', minimum: 'lower', maximum: 'same' },
    validationGoal: '观察学生能否根据文本行为推断人物心理并说明依据。',
    requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'focused_practice'],
    hardConstraints: ['adaptiveConstraintsId:constraints-demo'],
    softPreferences: [],
    recentTaskIds: [],
    sourceTaskRequestId: 'task-request-demo',
    sourceStrategyId: 'strategy-demo',
    createdAt: NOW,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
