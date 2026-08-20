import {
  activateTargetedMicroTrainingOverlay,
  createTargetedMicroTrainingAssignment,
  createTargetedMicroTrainingRequestFromDecision,
  evaluateTargetedMicroTrainingTrigger,
  matchTargetedMicroTrainingResource,
  settleTargetedMicroTrainingOverlay,
  type TargetedMicroTrainingTriggerInput,
} from '../agents/targetedMicroTrainingSchedulingAgent.ts';
import { scheduleTargetedMicroTraining } from '../agents/targetedMicroTrainingSchedulingService.ts';
import {
  attachTargetedAssignmentToLearningSession,
  beginTargetedMicroTraining,
  recoverTargetedMicroTrainingTransition,
  settleTargetedMicroTraining,
} from '../agents/targetedMicroTrainingLearningOrchestrator.ts';
import { InMemoryTargetedMicroTrainingSchedulingRepository } from '../repositories/inMemoryTargetedMicroTrainingSchedulingRepository.ts';
import { InMemoryUnifiedLearningEntryRepository } from '../repositories/inMemoryUnifiedLearningEntryRepository.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  ResourceRegistryEntry,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  buildMaterialContentHash,
  CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION,
} from '../schemas/targetedMicroTraining.schema.ts';
import {
  createTargetedMicroTrainingSessionOverlay,
  isTargetedMicroTrainingSessionOverlay,
} from '../schemas/targetedMicroTrainingScheduling.schema.ts';

const now = '2026-08-20T08:00:00.000Z';
let passed = 0;

function check(condition: unknown, name: string): void {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${name}`);
}

function trigger(overrides: Partial<TargetedMicroTrainingTriggerInput> = {}): TargetedMicroTrainingTriggerInput {
  return {
    enabled: true,
    studentId: 'student-stage3',
    learningSessionId: 'session-stage3',
    sourceLearningRoundId: 'session-stage3-round-2',
    sourceAttemptId: 'attempt-core-2',
    sourceResourceVersionId: 'core-version-2',
    sourceMaterialId: 'core-material',
    sourceCoreTaskNumber: 2,
    sourceTaskRole: 'training',
    sourceIsCurrentCoreQueueTask: true,
    persistenceCompleted: true,
    identitiesAligned: true,
    primaryAbilityId: 'comprehension',
    primaryGapRequirementIds: ['requirement-1'],
    requirementGapReasonCodes: { 'requirement-1': 'missing_reasoning_relation' },
    revisionAvailable: false,
    alreadyTerminatedForAttempt: false,
    completedAssignmentCount: 0,
    hasPendingOrInProgressAssignment: false,
    evaluatedAt: now,
    ...overrides,
  };
}

function material(input: {
  materialVersionId?: string;
  parentMaterialId?: string;
  paragraphStart?: number;
  abilityId?: string;
  gap?: 'missing_text_evidence' | 'missing_reasoning_relation' | 'conclusion_inconsistent' | 'incomplete_task_requirement';
  status?: 'active' | 'retired';
} = {}): QuestionMaterialVersion {
  const content = '小段文字提供一个不同证据情境，要求学生连接依据和判断。';
  const materialVersionId = input.materialVersionId || 'target-material-v1';
  return {
    materialId: materialVersionId.replace('-v1', ''),
    materialVersionId,
    versionNumber: 1,
    status: input.status || 'active',
    title: '短片段',
    content,
    usageType: 'targeted_excerpt',
    contentHash: buildMaterialContentHash(content),
    contentNormalizationPolicyVersion: CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION,
    targetedExcerptMetadata: {
      targetAbilityIds: [input.abilityId || 'comprehension'],
      supportedGapReasonCodes: [input.gap || 'missing_reasoning_relation'],
      sourceRelation: input.parentMaterialId ? 'same_material_excerpt' : 'controlled_original',
      ...(input.parentMaterialId ? {
        parentMaterialId: input.parentMaterialId,
        sourceAnchor: {
          paragraphStart: input.paragraphStart || 5,
          paragraphEnd: input.paragraphStart || 5,
          contentHash: `anchor-${input.paragraphStart || 5}`,
        },
      } : {}),
      intendedTaskCount: 1,
    },
    source: { sourceType: 'teacher_authored' },
    createdAt: now,
    updatedAt: now,
    schemaVersion: 'question_resource_admission_v1',
  } as QuestionMaterialVersion;
}

function version(input: {
  resourceVersionId?: string;
  materialVersionId?: string;
  abilityId?: string;
  gap?: 'missing_text_evidence' | 'missing_reasoning_relation' | 'conclusion_inconsistent' | 'incomplete_task_requirement';
  taskRole?: 'training' | 'retest' | 'transfer';
  status?: 'frozen' | 'retired' | 'superseded';
} = {}): FrozenQuestionResourceVersion {
  const resourceVersionId = input.resourceVersionId || 'target-resource-version-1';
  const materialVersionId = input.materialVersionId || 'target-material-v1';
  const taskRole = input.taskRole || 'training';
  return {
    resourceId: resourceVersionId.replace('-version-1', ''),
    resourceVersionId,
    versionNumber: 1,
    sourceDraftId: 'draft-target',
    materialId: materialVersionId.replace('-v1', ''),
    materialVersionId,
    taskId: 'target-task',
    title: '针对性练习',
    questionStem: '依据片段说明判断与证据的联系。',
    questionType: 'reading_comprehension',
    responseFormat: 'short_text',
    assessmentMode: 'rubric',
    rubric: [],
    minimumAnswerRequirement: { minLength: 10, requireTextEvidence: true, requireExplanation: true },
    abilityMetadata: {
      abilityId: input.abilityId || 'comprehension',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole,
      difficulty: 'basic',
      targetedTrainingMetadata: {
        primaryGapReasonCode: input.gap || 'missing_reasoning_relation',
        targetedMaterialVersionId: materialVersionId,
      },
    },
    source: { sourceType: 'teacher_authored' },
    tags: [], validationId: 'validation', reviewId: 'review',
    status: input.status || 'frozen', frozenAt: now, updatedAt: now,
    version: 'question_resource_v1', schemaVersion: 'question_resource_admission_v1',
  } as FrozenQuestionResourceVersion;
}

function registry(input: {
  resourceVersionId?: string;
  materialVersionId?: string;
  abilityId?: string;
  gap?: 'missing_text_evidence' | 'missing_reasoning_relation' | 'conclusion_inconsistent' | 'incomplete_task_requirement';
  taskRole?: 'training' | 'retest' | 'transfer';
  status?: 'active' | 'retired' | 'no_frozen_version';
} = {}): ResourceRegistryEntry {
  const resourceVersionId = input.resourceVersionId || 'target-resource-version-1';
  return {
    resourceId: resourceVersionId.replace('-version-1', ''),
    currentFrozenVersionId: resourceVersionId,
    status: input.status || 'active', taskId: 'target-task',
    abilityId: input.abilityId || 'comprehension',
    taskRole: input.taskRole || 'training', difficulty: 'basic',
    targetedTrainingMetadata: {
      primaryGapReasonCode: input.gap || 'missing_reasoning_relation',
      targetedMaterialVersionId: input.materialVersionId || 'target-material-v1',
    },
    tags: [], createdAt: now, updatedAt: now,
    schemaVersion: 'question_resource_admission_v1',
  } as ResourceRegistryEntry;
}

function facts(overrides: {
  sourceResourceVersionId?: string;
  materials?: QuestionMaterialVersion[];
  versions?: FrozenQuestionResourceVersion[];
  entries?: ResourceRegistryEntry[];
  sourceAnchors?: Array<{ materialId: string; paragraphStart: number; paragraphEnd: number; contentHash: string }>;
} = {}) {
  return {
    sourceMaterialId: 'core-material',
    sourceResourceVersionId: overrides.sourceResourceVersionId || 'core-version-2',
    sourceAnchors: overrides.sourceAnchors || [],
    currentFrozenVersions: overrides.versions || [version()],
    activeRegistryEntries: overrides.entries || [registry()],
    activeMaterials: overrides.materials || [material()],
  };
}

async function main(): Promise<void> {
  check(evaluateTargetedMicroTrainingTrigger(trigger()).outcome === 'eligible', '合法核心缺口可触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ enabled: false })).reasonCode === 'feature_disabled', '开关关闭零触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ persistenceCompleted: false })).reasonCode === 'persistence_incomplete', '半提交不触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ identitiesAligned: false })).reasonCode === 'identity_not_aligned', '身份错位不触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ sourceTaskRole: 'revision' })).reasonCode === 'source_not_core_training', '修订来源不触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ sourceTaskRole: 'targeted_training' })).reasonCode === 'source_not_core_training', '微训练来源不自触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ sourceIsCurrentCoreQueueTask: false })).reasonCode === 'source_not_core_training', '非核心队列不触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ revisionAvailable: true })).outcome === 'intervention_conflict', '修订入口优先');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ alreadyTerminatedForAttempt: true })).reasonCode === 'attempt_already_evaluated', '来源 Attempt 只判定一次');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ completedAssignmentCount: 2 })).outcome === 'limit_reached', '单 Session 最多两次');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ hasPendingOrInProgressAssignment: true })).reasonCode === 'assignment_already_active', '一次只允许一个活动 Assignment');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ primaryGapRequirementIds: [] })).reasonCode === 'primary_gap_not_unique', '缺少主 Gap 不触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ primaryGapRequirementIds: ['a', 'b'] })).reasonCode === 'primary_gap_not_unique', '多个主 Gap 不触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ requirementGapReasonCodes: { 'requirement-1': 'insufficient_to_judge' } })).reasonCode === 'answer_not_judgeable', '不可判断不触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ requirementGapReasonCodes: { 'requirement-1': 'theme_understanding_weak' } })).reasonCode === 'gap_not_supported', '宏观弱项不触发');
  check(evaluateTargetedMicroTrainingTrigger(trigger({ primaryAbilityId: undefined })).reasonCode === 'ability_not_resolved', '无法唯一解析 Ability 不触发');

  const decision = evaluateTargetedMicroTrainingTrigger(trigger());
  const request = createTargetedMicroTrainingRequestFromDecision({ decision });
  check(request.taskRole === 'training' && request.maxTaskCount === 1, 'Request 冻结为一题 training');
  const matched = matchTargetedMicroTrainingResource({ request, ...facts() });
  check(matched.status === 'matched', 'Ability + Gap + Role 精确匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({ versions: [version({ abilityId: 'analysis' })] }) }).status === 'no_match', '近似 Ability 不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({ versions: [version({ gap: 'missing_text_evidence' })] }) }).status === 'no_match', '其他 Gap 不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({ versions: [version({ taskRole: 'retest' })], entries: [registry({ taskRole: 'retest' })] }) }).status === 'no_match', 'Retest 资源不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({ entries: [registry({ status: 'retired' })] }) }).status === 'no_match', 'Inactive Registry 不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({ versions: [version({ status: 'superseded' })] }) }).status === 'no_match', '非 Frozen 历史版本不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({
    sourceResourceVersionId: 'target-resource-version-1',
  }) }).status === 'no_match', '来源题资源不能匹配为自身微训练');
  check(matchTargetedMicroTrainingResource({ request: { ...request, excludedResourceVersionIds: ['target-resource-version-1'] }, ...facts() }).status === 'no_match', '排除资源不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({ materials: [material({ status: 'retired' })] }) }).status === 'no_match', '停用 Material 不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({ materials: [material({ materialVersionId: 'other-v1' })] }) }).status === 'no_match', 'Material Version 身份错位不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({
    materials: [material({ parentMaterialId: 'core-material', paragraphStart: 2 })],
    sourceAnchors: [{ materialId: 'core-material', paragraphStart: 2, paragraphEnd: 2, contentHash: 'anchor-2' }],
  }) }).status === 'no_match', '同篇 Anchor 重叠不匹配');
  check(matchTargetedMicroTrainingResource({ request, ...facts({
    materials: [material({ parentMaterialId: 'core-material', paragraphStart: 8 })],
  }) }).status === 'no_match', '来源 Anchor 不可验证时拒绝同篇匹配');

  const externalVersion = version({ resourceVersionId: 'aaa-version-1', materialVersionId: 'external-v1' });
  const sameVersion = version({ resourceVersionId: 'bbb-version-1', materialVersionId: 'same-v1' });
  const preference = matchTargetedMicroTrainingResource({ request, ...facts({
    versions: [sameVersion, externalVersion],
    entries: [
      registry({ resourceVersionId: 'bbb-version-1', materialVersionId: 'same-v1' }),
      registry({ resourceVersionId: 'aaa-version-1', materialVersionId: 'external-v1' }),
    ],
    materials: [
      material({ materialVersionId: 'same-v1', parentMaterialId: 'core-material', paragraphStart: 8 }),
      material({ materialVersionId: 'external-v1' }),
    ],
  }) });
  check(preference.status === 'matched' && preference.resourceVersionId === 'aaa-version-1', '不同材料优先同篇合法 Anchor');
  check(JSON.stringify(preference) === JSON.stringify(matchTargetedMicroTrainingResource({ request, ...facts({
    versions: [externalVersion, sameVersion],
    entries: [
      registry({ resourceVersionId: 'aaa-version-1', materialVersionId: 'external-v1' }),
      registry({ resourceVersionId: 'bbb-version-1', materialVersionId: 'same-v1' }),
    ],
    materials: [material({ materialVersionId: 'external-v1' }), material({ materialVersionId: 'same-v1', parentMaterialId: 'core-material', paragraphStart: 8 })],
  }) })), '候选输入顺序不影响匹配结果');

  const assignment = createTargetedMicroTrainingAssignment({ request, match: matched, sourceCoreTaskNumber: 2 });
  check(assignment.returnToCoreTaskNumber === 3, '核心第 2 题返回第 3 题');
  const lastAssignment = createTargetedMicroTrainingAssignment({ request, match: matched, sourceCoreTaskNumber: 5 });
  check(lastAssignment.returnToCoreTaskNumber === 6, '末题使用完成哨兵');
  const overlay0 = createTargetedMicroTrainingSessionOverlay({ learningSessionId: request.learningSessionId, now });
  const overlay1 = activateTargetedMicroTrainingOverlay({ overlay: overlay0, assignment, now });
  check(overlay1.mode === 'targeted' && overlay1.activeAssignmentId === assignment.assignmentId, 'Overlay 激活不修改核心队列');
  const overlay2 = settleTargetedMicroTrainingOverlay({ overlay: overlay1, assignment, terminalStatus: 'completed', now });
  check(overlay2.mode === 'core' && overlay2.consumedCount === 1 && overlay2.returnToCoreTaskNumber === 3, '完成后恢复核心游标');
  check(isTargetedMicroTrainingSessionOverlay(overlay2), '完成 Overlay 通过 Schema 校验');
  const skipped = settleTargetedMicroTrainingOverlay({ overlay: overlay1, assignment, terminalStatus: 'skipped', now });
  check(skipped.skippedAssignmentIds.includes(assignment.assignmentId) && skipped.consumedCount === 0, '跳过不计入完成限额');
  const unavailable = settleTargetedMicroTrainingOverlay({ overlay: overlay1, assignment, terminalStatus: 'unavailable', now });
  check(unavailable.unavailableAssignmentIds.includes(assignment.assignmentId), '资源失效后可安全返回');

  const repository = new InMemoryTargetedMicroTrainingSchedulingRepository(now);
  const scheduled = await scheduleTargetedMicroTraining({ trigger: trigger(), matchFacts: facts(), repository });
  check(scheduled.status === 'scheduled' && Boolean(scheduled.assignment), '原子创建 Request + Assignment');
  const reused = await scheduleTargetedMicroTraining({ trigger: trigger(), matchFacts: facts(), repository });
  check(reused.status === 'reused' && reused.assignment?.assignmentId === scheduled.assignment?.assignmentId, '重复提交复用逻辑 Assignment');
  const snapshot = await repository.load();
  check(snapshot.requests.length === 1 && snapshot.assignments.length === 1, 'Repository 无重复记录');
  const inProgress = await repository.updateAssignmentStatus({ assignmentId: assignment.assignmentId, expectedStatus: 'pending', nextStatus: 'in_progress', expectedRevision: snapshot.revision, updatedAt: now });
  check(inProgress.status === 'committed' && inProgress.assignment?.status === 'in_progress', 'Presentation 后进入 in_progress');
  const invalid = await repository.updateAssignmentStatus({ assignmentId: assignment.assignmentId, expectedStatus: 'in_progress', nextStatus: 'skipped', expectedRevision: inProgress.snapshot.revision, updatedAt: now });
  check(invalid.status === 'conflict', 'in_progress 不允许静默跳过');
  const completed = await repository.updateAssignmentStatus({ assignmentId: assignment.assignmentId, expectedStatus: 'in_progress', nextStatus: 'completed', expectedRevision: inProgress.snapshot.revision, updatedAt: now });
  check(completed.status === 'committed' && completed.assignment?.status === 'completed', '证据完成后 Assignment 完成');
  const stale = await repository.updateAssignmentStatus({ assignmentId: assignment.assignmentId, expectedStatus: 'completed', nextStatus: 'completed', expectedRevision: 0, updatedAt: now });
  check(stale.status === 'conflict', 'CAS 阻断过期 revision');

  const noMatchRepo = new InMemoryTargetedMicroTrainingSchedulingRepository(now);
  const noMatch = await scheduleTargetedMicroTraining({ trigger: trigger(), matchFacts: facts({ entries: [] }), repository: noMatchRepo });
  const noMatchSnapshot = await noMatchRepo.load();
  check(noMatch.status === 'no_match' && noMatchSnapshot.requests.length === 0 && noMatchSnapshot.assignments.length === 0, 'no_match 只记录 Decision');
  check(noMatchSnapshot.decisions[0]?.outcome === 'no_match', 'no_match 是正常终止结果');
  check((await scheduleTargetedMicroTraining({ trigger: trigger(), matchFacts: facts({ entries: [] }), repository: noMatchRepo })).status === 'no_match', 'no_match 刷新后保持终止');

  const disabledRepo = new InMemoryTargetedMicroTrainingSchedulingRepository(now);
  const disabled = await scheduleTargetedMicroTraining({ trigger: trigger({ enabled: false }), matchFacts: facts(), repository: disabledRepo });
  check(disabled.status === 'disabled' && (await disabledRepo.load()).assignments.length === 0, '功能开关关闭不生成 Assignment');

  const orchestrationRepository = new InMemoryTargetedMicroTrainingSchedulingRepository(now);
  const orchestrationSchedule = await scheduleTargetedMicroTraining({
    trigger: trigger(), matchFacts: facts(), repository: orchestrationRepository,
  });
  const learningRepository = new InMemoryUnifiedLearningEntryRepository();
  await learningRepository.save({
    schemaVersion: 'unified_learning_entry_v1', studentId: 'student-stage3',
    learningSessionId: 'session-stage3', currentLearningRoundId: 'session-stage3-round-2',
    taskQueue: {
      queueVersion: 'learning_session_task_queue_v1', materialId: 'core-material',
      resourceVersionIds: ['core-1', 'core-2', 'core-3', 'core-4', 'core-5'],
      targetTaskCount: 5, createdAt: now,
    },
    status: 'active', createdAt: now, updatedAt: now,
  });
  const beforeQueue = JSON.stringify((await learningRepository.getByStudent('student-stage3'))?.taskQueue);
  const attached = await attachTargetedAssignmentToLearningSession({
    studentId: 'student-stage3', assignmentId: orchestrationSchedule.assignment!.assignmentId,
    schedulingRepository: orchestrationRepository, activityRepository: learningRepository, now,
  });
  check(attached.mode === 'pending' && attached.assignmentId === orchestrationSchedule.assignment!.assignmentId, 'Learning 过渡层挂接 pending Assignment');
  check(JSON.stringify((await learningRepository.getByStudent('student-stage3'))?.taskQueue) === beforeQueue, '挂接过程不修改核心 Queue');
  check((await recoverTargetedMicroTrainingTransition({ studentId: 'student-stage3', schedulingRepository: orchestrationRepository, activityRepository: learningRepository }))?.mode === 'pending', '刷新可恢复 pending 过渡页');
  const begun = await beginTargetedMicroTraining({
    studentId: 'student-stage3', assignmentId: orchestrationSchedule.assignment!.assignmentId,
    schedulingRepository: orchestrationRepository, activityRepository: learningRepository, now,
  });
  check(begun.mode === 'in_progress', 'Question Presentation 后进入练习');
  check((await recoverTargetedMicroTrainingTransition({ studentId: 'student-stage3', schedulingRepository: orchestrationRepository, activityRepository: learningRepository }))?.mode === 'in_progress', '刷新可恢复 in_progress Assignment');
  const resumed = await settleTargetedMicroTraining({
    studentId: 'student-stage3', assignmentId: orchestrationSchedule.assignment!.assignmentId, status: 'completed',
    schedulingRepository: orchestrationRepository, activityRepository: learningRepository, now,
  });
  check(resumed.returnToCoreTaskNumber === 3 && !resumed.sessionComplete, '微训练完成返回第 3 道核心题');
  const resumedContext = await learningRepository.getByStudent('student-stage3');
  check(resumedContext?.currentLearningRoundId === 'session-stage3-round-3'
    && resumedContext.targetedMicroTrainingOverlay?.mode === 'core', '核心游标与 Overlay 原子恢复');
  check(JSON.stringify(resumedContext?.taskQueue) === beforeQueue, '完成微训练后核心 Queue 仍保持不变');

  const expectedCases = 57;
  if (passed !== expectedCases) throw new Error(`FAIL: Stage 3 matrix is incomplete (${passed}/${expectedCases})`);
  console.log(`\nTargeted micro-training Stage 3 Debug: ${passed}/${expectedCases} PASS`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
