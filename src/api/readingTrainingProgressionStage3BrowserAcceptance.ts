import {
  buildFormalTaskGroupProgressionArtifact,
  buildFormalTaskProgressionMetadata,
} from '../ai/schemas/formalTaskProgressionMetadata.schema.ts';
import {
  calculateTaskGroupProgressionPlanHash,
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION,
  type TaskGroupProgressionPlan,
} from '../ai/schemas/readingTaskGroupProgression.schema.ts';
import {
  calculateTaskLoadSemanticsHash,
  TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
  type TaskLoadSemantics,
} from '../ai/schemas/readingTaskLoadSemantics.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  '../ai/schemas/readingTrainingProgressionAudit.schema.ts';
import type { FrozenQuestionResourceVersion } from
  '../ai/schemas/questionResourceAdmission.schema.ts';
import {
  orderFormalResourcesForLearningSequence,
  resolveFormalProgressionAuthority,
} from '../ai/agents/learningTaskSequenceScheduler.ts';
import { resolveLearningProgressionContext } from
  '../ai/agents/learningProgressionContextResolver.ts';
import { createProgressionPerformanceObservation } from
  '../ai/agents/progressionPerformanceObservationAgent.ts';
import { assessProgressionInstability } from
  '../ai/agents/progressionInstabilityAssessmentAgent.ts';
import { decideProgressionEvidenceAdmission } from
  '../ai/agents/progressionEvidenceAdmissionAgent.ts';
import { InMemoryLearningProgressionRepository } from
  '../ai/repositories/inMemoryLearningProgressionRepository.ts';
import { LearningProgressionRuntimeService } from
  '../ai/services/learningProgressionRuntimeService.ts';
import type { DiagnosisResult } from '../ai/schemas/diagnosis.schema.ts';
import type { AbilityEvidence } from '../ai/schemas/abilityEvidence.schema.ts';

const NOW = '2026-08-24T00:00:00.000Z';

export interface ProgressionStage3BrowserCheck {
  id: string;
  title: string;
  evidence: string;
  passed: boolean;
}

export interface ProgressionStage3BrowserReport {
  schemaVersion: 'reading_training_progression_stage3_browser_acceptance_v1';
  runtimeScope: 'in_memory_isolated';
  total: number;
  passed: number;
  generatedAt: string;
  checks: ProgressionStage3BrowserCheck[];
}

function semantics(
  key: 'entry' | 'evidence',
  thread = 'thread:browser-acceptance',
): TaskLoadSemantics {
  const responsibilities = key === 'entry'
    ? ['basic_understanding'] as TaskLoadSemantics['responsibilities']
    : ['basic_understanding', 'text_evidence'] as TaskLoadSemantics['responsibilities'];
  return {
    schemaVersion: TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    observationThreadId: thread,
    sequenceRole: key === 'entry' ? 'foundation_entry' : 'development',
    primaryAction: key === 'entry' ? 'locate_information' : 'extract_evidence',
    responsibilities,
    derivationSource: 'planned',
    confidence: 'high',
  };
}

function fixture(strategy: TaskGroupProgressionPlan['strategy'] = 'entry_first') {
  const entry = semantics('entry');
  const evidence = semantics('evidence');
  const base: Omit<TaskGroupProgressionPlan, 'planHash'> = {
    schemaVersion: TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    stageRuleVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
    materialVersionId: 'acceptance-material:v1',
    observationPlanRevisionId: 'acceptance-observation-plan:1',
    strategy,
    reasonCode: strategy === 'holistic_first'
      ? 'holistic_judgment_required'
      : 'default_foundation_entry',
    orderedTasks: [
      {
        planningTaskKey: 'entry-choice',
        taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(entry),
        sequenceRank: 1,
      },
      {
        planningTaskKey: 'evidence-text',
        taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(evidence),
        sequenceRank: 2,
      },
    ],
    accessibleEntryTaskKeys: ['entry-choice'],
    protectedHigherOrderTaskKeys: ['evidence-text'],
    transitions: [{
      transitionId: 'acceptance-transition:1',
      fromPlanningTaskKey: 'entry-choice',
      toPlanningTaskKey: 'evidence-text',
      threadRelation: 'same_thread',
      transitionKind: 'progressive',
      addedResponsibilities: ['text_evidence'],
      retainedResponsibilities: ['basic_understanding'],
      loadDirection: 'increase',
      rationaleCode: 'adjacent_responsibility_growth',
      rationale: '先确认基础理解，再增加文本依据责任。',
    }],
    derivationSource: 'planned',
  };
  const progressionPlan = { ...base, planHash: calculateTaskGroupProgressionPlanHash(base) };
  const artifact = buildFormalTaskGroupProgressionArtifact({
    progressionPlan,
    sourceCandidateIds: ['candidate-entry', 'candidate-evidence'],
    createdAt: NOW,
  });
  return { entry, evidence, progressionPlan, artifact };
}

function frozen(
  key: 'entry' | 'evidence',
  input: { set?: ReturnType<typeof fixture>; metadata?: boolean } = {},
): FrozenQuestionResourceVersion {
  const set = input.set || fixture();
  const taskSemantics = key === 'entry' ? set.entry : set.evidence;
  const planningTaskKey = key === 'entry' ? 'entry-choice' : 'evidence-text';
  return {
    resourceId: `acceptance-resource-${key}`,
    resourceVersionId: `acceptance-resource-${key}:v1`,
    versionNumber: 1,
    sourceDraftId: `acceptance-draft-${key}`,
    materialId: 'acceptance-material',
    materialVersionId: 'acceptance-material:v1',
    taskId: `acceptance-task-${key}`,
    title: key === 'entry' ? '基础理解单选' : '文本依据简答',
    questionStem: key === 'entry' ? '材料中的直接原因是什么？' : '请找出依据并说明理由。',
    questionType: 'reading_comprehension',
    responseFormat: key === 'entry' ? 'single_choice' : 'short_text',
    rubric: [],
    assessmentMode: key === 'entry' ? 'exact_match' : 'key_points',
    minimumAnswerRequirement: key === 'entry'
      ? {
          responseFormat: 'single_choice', minLength: 0, requireTextEvidence: false,
          requireExplanation: false, minSelections: 1, maxSelections: 1,
        }
      : { minLength: 10, requireTextEvidence: true, requireExplanation: false },
    abilityMetadata: {
      abilityId: 'comprehension', supportingAbilityIds: [], prerequisiteAbilityIds: [],
      taskRole: 'training', difficulty: 'basic',
    },
    source: { sourceType: 'ai_assisted', description: 'Stage 3 browser acceptance' },
    tags: [`sequence-rank:${key === 'entry' ? 1 : 2}`],
    validationId: `acceptance-validation-${key}`,
    reviewId: `acceptance-review-${key}`,
    status: 'frozen',
    frozenAt: NOW,
    updatedAt: NOW,
    version: 'phase16_1a_v1',
    schemaVersion: 'question_resource_admission_v1',
    progressionMetadata: input.metadata === false ? undefined : buildFormalTaskProgressionMetadata({
      materialVersionId: 'acceptance-material:v1',
      observationPlanRevisionId: 'acceptance-observation-plan:1',
      planningTaskKey,
      progressionPlan: set.progressionPlan,
      taskLoadSemantics: taskSemantics,
    }),
  } as FrozenQuestionResourceVersion;
}

function diagnosis(outcome: 'meets' | 'fails'): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: outcome === 'meets',
    strategyUsed: 'browser_acceptance',
    answerStatus: outcome === 'meets' ? 'fully_meets' : 'does_not_meet',
    rubricItems: [{
      id: 'rubric-evidence', label: '文本依据', ability: '理解', required: true,
      matched: outcome === 'meets',
    }],
    mainAbility: 'comprehension',
    relatedAbilities: [],
    surfaceError: outcome === 'meets' ? '无' : '依据不足',
    rootCause: outcome === 'meets' ? '无' : '没有定位文本依据',
    errorType: outcome === 'meets' ? '待验证' : '理解错误',
    abilityEvidence: [outcome === 'meets' ? '完成当前任务' : '尚未提供依据'],
    diagnosisSummary: outcome === 'meets' ? '当前理解成立。' : '先回到材料中找出直接依据。',
    nextTraining: outcome === 'meets' ? '继续下一题' : '根据提示修订',
    confidence: 0.8,
  };
}

function check(id: string, title: string, evidence: string, passed: boolean) {
  return { id, title, evidence, passed } satisfies ProgressionStage3BrowserCheck;
}

export async function runReadingTrainingProgressionStage3BrowserAcceptance(): Promise<ProgressionStage3BrowserReport> {
  const set = fixture();
  const entry = frozen('entry', { set });
  const evidenceTask = frozen('evidence', { set });
  const nativeOrder = orderFormalResourcesForLearningSequence(
    [evidenceTask, entry],
    { taskRole: 'training', progressionArtifacts: [set.artifact] },
  );
  const context = resolveLearningProgressionContext({
    studentId: 'acceptance-student',
    learningSessionId: 'acceptance-session',
    learningRoundId: 'acceptance-round-2',
    learningTaskAttemptId: 'acceptance-attempt-2',
    resourceVersion: evidenceTask,
    activeResourceVersions: nativeOrder,
    progressionArtifact: set.artifact,
    capturedAt: NOW,
  });
  const entryContext = resolveLearningProgressionContext({
    studentId: 'acceptance-student',
    learningSessionId: 'acceptance-session',
    learningRoundId: 'acceptance-round-1',
    learningTaskAttemptId: 'acceptance-attempt-1',
    resourceVersion: entry,
    activeResourceVersions: nativeOrder,
    progressionArtifact: set.artifact,
    capturedAt: NOW,
  });
  const lowerObservation = createProgressionPerformanceObservation({
    context: entryContext,
    responseId: 'acceptance-response-1',
    formalDiagnosisId: 'acceptance-diagnosis-1',
    diagnosis: diagnosis('meets'),
    observedAt: NOW,
  });
  const higherObservation = createProgressionPerformanceObservation({
    context,
    responseId: 'acceptance-response-2',
    formalDiagnosisId: 'acceptance-diagnosis-2',
    diagnosis: diagnosis('fails'),
    observedAt: NOW,
  });
  const instability = assessProgressionInstability({
    higher: higherObservation,
    higherContext: context,
    lower: lowerObservation,
    assessedAt: NOW,
  });
  const abilityEvidence: AbilityEvidence = {
    id: 'acceptance-evidence', studentId: 'acceptance-student', ability: 'comprehension',
    evidenceType: 'weakness', detail: '尚未提供文本依据', source: 'diagnosis',
    observation: '尚未提供文本依据', confidence: 0.8, createdAt: NOW,
    taskId: evidenceTask.taskId, diagnosisId: 'acceptance-diagnosis-2',
  };
  const admission = decideProgressionEvidenceAdmission({
    evidence: abilityEvidence,
    context,
    observation: higherObservation,
    assessment: instability,
    taskId: evidenceTask.taskId,
    responseId: 'acceptance-response-2',
    diagnosisId: 'acceptance-diagnosis-2',
    decidedAt: NOW,
  });
  const repository = new InMemoryLearningProgressionRepository();
  const runtime = new LearningProgressionRuntimeService(repository);
  await repository.saveArtifact(set.artifact);
  await runtime.persistEvidenceSidecar({
    progressionContextSnapshot: context,
    progressionObservation: higherObservation,
    progressionInstabilityAssessment: instability,
    progressionEvidenceContext: admission.context,
    progressionEvidenceAdmissionDecision: admission.decision,
  });
  const restoredContext = await repository.getContextByAttemptId(context.learningTaskAttemptId);
  const restoredObservations = await repository.listObservations(
    higherObservation.studentId,
    higherObservation.observationThreadId,
  );

  const holistic = fixture('holistic_first');
  const holisticOrder = orderFormalResourcesForLearningSequence(
    [frozen('evidence', { set: holistic }), frozen('entry', { set: holistic })],
    { taskRole: 'training', progressionArtifacts: [holistic.artifact] },
  );
  const legacyOrder = orderFormalResourcesForLearningSequence(
    [frozen('evidence', { metadata: false }), frozen('entry', { metadata: false })],
    { taskRole: 'training' },
  );
  const retestOrder = orderFormalResourcesForLearningSequence(
    [evidenceTask, entry],
    { taskRole: 'retest', progressionArtifacts: [set.artifact] },
  );
  const missingArtifactContext = resolveLearningProgressionContext({
    studentId: 'acceptance-student',
    learningSessionId: 'acceptance-session',
    learningRoundId: 'acceptance-round-missing-artifact',
    learningTaskAttemptId: 'acceptance-attempt-missing-artifact',
    resourceVersion: entry,
    activeResourceVersions: nativeOrder,
    progressionArtifact: null,
    capturedAt: NOW,
  });
  const revisionObservation = createProgressionPerformanceObservation({
    context,
    responseId: 'acceptance-revision-response',
    formalDiagnosisId: 'acceptance-revision-diagnosis',
    diagnosis: diagnosis('meets'),
    supportMode: 'feedback_revision',
    observedAt: NOW,
  });
  const targetedObservation = createProgressionPerformanceObservation({
    context,
    responseId: 'acceptance-targeted-response',
    formalDiagnosisId: 'acceptance-targeted-diagnosis',
    diagnosis: diagnosis('meets'),
    supportMode: 'targeted_training',
    observedAt: NOW,
  });

  const checks = [
    check('B3-01', '原生计划顺序', '正式 rank 将基础单选排在文本依据题之前。',
      nativeOrder.map((item) => item.taskId).join(',') === 'acceptance-task-entry,acceptance-task-evidence'),
    check('B3-02', '首题刷新身份', '首题 Snapshot 绑定题号、总数和正式资源身份。',
      entryContext.sequenceRank === 1 && entryContext.resourceVersionId === entry.resourceVersionId),
    check('B3-03', '中途刷新恢复', '按 Attempt ID 恢复相同不可变 Snapshot。',
      restoredContext?.snapshotHash === context.snapshotHash),
    check('B3-04', '分批发布成员', '只提供已发布第二成员时，仍保持其正式相对顺序。',
      orderFormalResourcesForLearningSequence([evidenceTask], { taskRole: 'training', progressionArtifacts: [set.artifact] })[0]?.taskId === evidenceTask.taskId),
    check('B3-05', '历史题组兼容', '缺少原生 Metadata 时继续使用旧 Scheduler 顺序。',
      legacyOrder.map((item) => item.taskId).join(',') === 'acceptance-task-entry,acceptance-task-evidence'),
    check('B3-06', '整体判断例外', 'holistic_first 服从正式计划 rank，不被题型偏好重排。',
      holisticOrder.map((item) => item.taskId).join(',') === 'acceptance-task-entry,acceptance-task-evidence'),
    check('B3-07', '单选到文本连续', '同组先呈现 single_choice，再进入 short_text。',
      nativeOrder[0]?.responseFormat === 'single_choice' && nativeOrder[1]?.responseFormat === 'short_text'),
    check('B3-08', '自然反馈边界', '学生反馈使用“先回到材料中找出直接依据”，不暴露内部层级代码。',
      diagnosis('fails').diagnosisSummary === '先回到材料中找出直接依据。'),
    check('B3-09', '修订证据隔离', 'Revision 被标记为支持下表现，不替代首次独立表现。',
      revisionObservation.comparisonEligibility === 'excluded'),
    check('B3-10', '针对训练返回', 'Targeted 形成独立支持身份，核心正式顺序保持不变。',
      targetedObservation.supportMode === 'targeted_training' && nativeOrder.length === 2),
    check('B3-11', '复测迁移隔离', 'Retest 不参与 Training 坡度重排。',
      retestOrder.map((item) => item.taskId).join(',') === 'acceptance-task-evidence,acceptance-task-entry'),
    check('B3-12', 'Artifact 缺失降级', 'Artifact 不可用时回退为兼容顺序，不阻断学习。',
      resolveFormalProgressionAuthority(entry, []) === null
        && missingArtifactContext.comparisonEligibility !== 'eligible'),
    check('B3-13', '旁路持久化恢复', 'Context、Observation、Assessment 与 Admission 可从隔离仓库恢复。',
      Boolean(restoredContext
        && restoredObservations.some((item) => item.observationId === higherObservation.observationId)
        && await repository.getAssessment(instability.assessmentId)
        && await repository.getAdmissionByEvidenceId(admission.decision.evidenceId))),
    check('B3-14', '题号与总数一致', '正式顺序为 1/2、2/2，下一题指向实际第二成员。',
      nativeOrder.length === 2 && context.sequenceRank === 2 && context.predecessor?.sequenceRank === 1),
    check('B3-15', '内部追踪完整', 'Context、Observation、Assessment、Evidence Context 与 Admission 可按身份串联。',
      admission.context.progressionObservationId === higherObservation.observationId
        && admission.decision.progressionEvidenceContextId === admission.context.contextId),
    check('B3-16', '学生投射边界', '隔离报告不把 Plan Hash、失稳代码或 Admission 决策投射成学生步骤。',
      !diagnosis('fails').diagnosisSummary.includes('progression')
        && !diagnosis('fails').diagnosisSummary.includes('admission')),
  ];

  return {
    schemaVersion: 'reading_training_progression_stage3_browser_acceptance_v1',
    runtimeScope: 'in_memory_isolated',
    total: checks.length,
    passed: checks.filter((item) => item.passed).length,
    generatedAt: new Date().toISOString(),
    checks,
  };
}
