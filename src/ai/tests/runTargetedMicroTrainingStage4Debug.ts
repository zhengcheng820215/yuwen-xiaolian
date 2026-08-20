import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryTargetedMicroTrainingStage4Repository } from '../repositories/inMemoryTargetedMicroTrainingStage4Repository.ts';
import {
  TARGETED_MICRO_TRAINING_STAGE4_PACK_VERSION,
  TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
  buildTargetedMicroTrainingManifestHash,
  isTargetedMicroTrainingControlledPackManifest,
  isTargetedMicroTrainingStage4RuntimeEvent,
  type TargetedMicroTrainingStage4RuntimeEvent,
} from '../schemas/targetedMicroTrainingStage4.schema.ts';
import {
  auditTargetedMicroTrainingControlledPack,
  buildTargetedMicroTrainingControlledPack,
  importTargetedMicroTrainingControlledPack,
  rollbackTargetedMicroTrainingControlledPack,
} from '../services/targetedMicroTrainingControlledPackService.ts';
import {
  TargetedMicroTrainingStage4Service,
  buildTargetedMicroTrainingCalibrationDecision,
  buildTargetedMicroTrainingFollowUp,
  projectTargetedMicroTrainingStage4,
} from '../services/targetedMicroTrainingStage4Service.ts';
import { matchCurrentFormalResource } from '../agents/phase173FormalResourceMatchingService.ts';

const now = '2026-08-20T14:00:00.000Z';
let passed = 0;
let eventSequence = 0;

function check(condition: unknown, name: string): void {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${name}`);
}

async function rejects(operation: () => Promise<unknown>, pattern?: RegExp): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch (error) {
    return !pattern || pattern.test(error instanceof Error ? error.message : String(error));
  }
}

function event(
  eventName: TargetedMicroTrainingStage4RuntimeEvent['eventName'],
  overrides: Partial<TargetedMicroTrainingStage4RuntimeEvent> = {},
): TargetedMicroTrainingStage4RuntimeEvent {
  eventSequence += 1;
  return {
    eventId: overrides.eventId || `stage4-event-${eventSequence}`,
    eventName,
    studentId: 'student-stage4',
    learningSessionId: 'session-stage4',
    sourceLearningRoundId: 'round-stage4',
    sourceAttemptId: 'source-attempt-stage4',
    decisionId: 'decision-stage4',
    sourceResourceVersionId: 'core-resource-v1',
    policyVersion: TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
    packId: 'targeted-micro-training-controlled-pack-3',
    packVersion: TARGETED_MICRO_TRAINING_STAGE4_PACK_VERSION,
    occurredAt: now,
    ...overrides,
  };
}

async function main(): Promise<void> {
  const bundle = await buildTargetedMicroTrainingControlledPack({ sourceSnapshotRevision: 61 });
  check(isTargetedMicroTrainingControlledPackManifest(bundle.manifest), 'S4-01 合法 Manifest 通过');
  check(bundle.manifest.manifestHash === buildTargetedMicroTrainingManifestHash(bundle.manifest), 'S4-02 Manifest Hash 可复算');
  check(
    bundle.materials.length === 12
      && bundle.versions.length === 18
      && bundle.observationStructures.length === 12
      && bundle.observationPlans.length === 12
      && bundle.observationLinks.length === 18
      && bundle.observationAnchors.length >= 12
      && bundle.versions.filter((version) => version.responseFormat === 'single_choice').length >= 2,
    'S4-03 受控包固定为 12 篇、18 道、完整观察链并包含至少 2 道单选微训练',
  );
  check(Object.values(bundle.manifest.gapCoverage).every((count) => count >= 3), 'S4-04 四类 Gap 均有足够资源');

  const governanceRepository = new InMemoryTargetedMicroTrainingStage4Repository(now);
  const governance = new TargetedMicroTrainingStage4Service(governanceRepository, () => now);
  const formalRepository = new InMemoryQuestionResourceAdmissionRepository();
  const observationRepository = new InMemoryMaterialObservationRepository();
  await governance.prepareManifest(bundle.manifest, 'tester', 'debug');
  const imported = await importTargetedMicroTrainingControlledPack({
    bundle, formalRepository, observationRepository, governance, actorId: 'tester', reason: 'debug_import',
  });
  check(imported.insertedVersions === 18, 'S4-05 首次导入写入全部 Frozen Version');
  const audit = await auditTargetedMicroTrainingControlledPack({ bundle, formalRepository, observationRepository });
  check(audit.passed && audit.activeRegistryCount === 18, 'S4-06 Material / Frozen / Registry 完整对齐');
  const pinnedTargetedVersion = bundle.versions.find((version) => (
    version.abilityMetadata.abilityId === 'comprehension'
      && version.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode === 'conclusion_inconsistent'
  ));
  if (!pinnedTargetedVersion) throw new Error('Pinned targeted runtime fixture is missing.');
  const pinnedTargetedMatch = await matchCurrentFormalResource({
    taskRequest: {
      taskRequestId: 'stage4-pinned-targeted-request',
      strategyId: 'stage4-pinned-targeted-strategy',
      studentId: 'student-stage4',
      targetAbilityId: pinnedTargetedVersion.abilityMetadata.abilityId,
      taskRole: 'training',
      action: 'continue_training',
      validationGoal: '恢复并执行已锁定的针对性微训练正式题目。',
      evidenceLinks: ['stage4-pinned-targeted-evidence'],
      growthMemoryRecordIds: ['stage4-pinned-targeted-memory'],
      constraints: [],
      createdAt: now,
    },
    studentId: 'student-stage4',
    resourceRepository: formalRepository,
    observationRepository,
    bootstrapMaterialId: pinnedTargetedVersion.materialId,
    requiredResourceVersionId: pinnedTargetedVersion.resourceVersionId,
    eligibleResourceVersionIds: bundle.versions.map((version) => version.resourceVersionId),
    evaluatedAt: now,
  });
  check(
    pinnedTargetedMatch.status === 'matched'
      && pinnedTargetedMatch.resourceVersion?.resourceVersionId === pinnedTargetedVersion.resourceVersionId,
    `S4-06A 已创建的专项 Assignment 可被正式 Learning 匹配器锁定执行 (${JSON.stringify(pinnedTargetedMatch)})`,
  );
  const reused = await importTargetedMicroTrainingControlledPack({
    bundle, formalRepository, observationRepository, governance, actorId: 'tester', reason: 'debug_reimport',
  });
  check(reused.reusedVersions === 18, 'S4-07 重复导入保持幂等');
  await governance.markManifestRolledBack(bundle.manifest.packId, 'tester', 'debug_transition_rollback');
  const reactivatedManifest = await governance.markManifestImported(
    bundle.manifest.packId,
    'tester',
    'debug_transition_reimport',
  );
  check(
    reactivatedManifest.status === 'imported',
    'S4-07A 同一不可变资源包回滚后可重新导入，支持重复联调与恢复',
  );

  const badHash = structuredClone(bundle.manifest);
  badHash.manifestHash = 'invalid-hash';
  const badHashService = new TargetedMicroTrainingStage4Service(new InMemoryTargetedMicroTrainingStage4Repository(now), () => now);
  check(await rejects(() => badHashService.prepareManifest(badHash, 'tester', 'bad'), /hash/i), 'S4-08 Manifest Hash 错位阻断');
  const lowCoverage = structuredClone(bundle.manifest);
  lowCoverage.gapCoverage.missing_text_evidence = 2;
  lowCoverage.manifestHash = buildTargetedMicroTrainingManifestHash(lowCoverage);
  check(await rejects(() => badHashService.prepareManifest(lowCoverage, 'tester', 'bad'), /three/i), 'S4-09 Gap 覆盖声明不足阻断');
  const badBundle = structuredClone(bundle);
  delete (badBundle.materials[0] as { targetedExcerptMetadata?: unknown }).targetedExcerptMetadata;
  check(await rejects(() => importTargetedMicroTrainingControlledPack({
    bundle: badBundle,
    formalRepository: new InMemoryQuestionResourceAdmissionRepository(),
    observationRepository: new InMemoryMaterialObservationRepository(),
    governance: badHashService, actorId: 'tester', reason: 'bad_metadata',
  }), /metadata/i), 'S4-10 Targeted Material 元数据不完整阻断');
  const brokenTraceBundle = structuredClone(bundle);
  brokenTraceBundle.observationAnchors = brokenTraceBundle.observationAnchors.slice(1);
  check(await rejects(() => importTargetedMicroTrainingControlledPack({
    bundle: brokenTraceBundle,
    formalRepository: new InMemoryQuestionResourceAdmissionRepository(),
    observationRepository: new InMemoryMaterialObservationRepository(),
    governance: badHashService,
    actorId: 'tester',
    reason: 'broken_observation_trace',
  }), /Observation Plan trace/i), 'S4-10A Observation Structure / Anchor / Plan 追溯不完整阻断');
  const headConflictRepository = new InMemoryQuestionResourceAdmissionRepository();
  await headConflictRepository.saveRegistryEntry({
    ...bundle.registryEntries[0], currentFrozenVersionId: 'other-frozen-head',
  });
  const conflictService = new TargetedMicroTrainingStage4Service(new InMemoryTargetedMicroTrainingStage4Repository(now), () => now);
  check(await rejects(() => importTargetedMicroTrainingControlledPack({
    bundle,
    formalRepository: headConflictRepository,
    observationRepository: new InMemoryMaterialObservationRepository(),
    governance: conflictService,
    actorId: 'tester', reason: 'head_conflict',
  }), /overwrite Registry head/i), 'S4-11 既有不同 Registry Head 不得覆盖');

  await governance.setEnablement({ mode: 'isolated_verify', packId: bundle.manifest.packId, actorId: 'tester', reason: 'verify' });
  check(await governance.canSchedule('isolated-student', true), 'S4-12 隔离参数可进入 isolated_verify');
  check(!(await governance.canSchedule('isolated-student', false)), 'S4-13 页面参数不能伪装正式模式');
  await governance.setEnablement({ mode: 'controlled_single_learner', packId: bundle.manifest.packId, controlledStudentId: 'fixed-student', actorId: 'tester', reason: 'window' });
  check(await governance.canSchedule('fixed-student') && !(await governance.canSchedule('other-student')), 'S4-14 单学生模式只允许固定身份');
  await governance.setEnablement({ mode: 'paused', packId: bundle.manifest.packId, actorId: 'tester', reason: 'pause' });
  check(!(await governance.canSchedule('fixed-student')), 'S4-15 暂停后不再调度');
  check((await governanceRepository.load()).audits.length >= 5, 'S4-16 模式切换具有审计记录');
  await governance.setEnablement({ mode: 'isolated_verify', packId: bundle.manifest.packId, actorId: 'tester', reason: 'resume_verify' });

  const evaluated = event('targeted_trigger_evaluated', {
    outcome: 'eligible:missing_reasoning_relation', abilityId: 'comprehension',
    gapReasonCode: 'missing_reasoning_relation', responseFormat: 'short_text', taskRole: 'training',
  });
  check(await governance.recordEvent(evaluated) === 'created', 'S4-17 Trigger evaluated 事件写入');
  check(await governance.recordEvent(evaluated) === 'unchanged', 'S4-18 Event 重试复用 eventId');
  check(await rejects(() => governance.recordEvent({ ...evaluated, outcome: 'eligible:missing_text_evidence' }), /conflict/i), 'S4-19 同 eventId 不同事实阻断');
  await governance.recordEvent(event('targeted_no_match', { outcome: 'no_exact_resource' }));
  let projection = await governance.project();
  check(projection.metrics.matchRate.numerator === 0 && projection.metrics.matchRate.denominator === 1, 'S4-20 no_match 不算学生失败且不虚构 Assignment');

  const identity = {
    sourceLearningRoundId: 'round-assignment', sourceAttemptId: 'source-attempt-assignment',
    decisionId: 'decision-assignment', requestId: 'request-assignment',
    assignmentId: 'assignment-stage4', sourceResourceVersionId: 'core-resource-v2',
    targetedResourceVersionId: bundle.versions[0].resourceVersionId,
    abilityId: bundle.versions[0].abilityMetadata.abilityId,
    gapReasonCode: bundle.versions[0].abilityMetadata.targetedTrainingMetadata!.primaryGapReasonCode,
    responseFormat: bundle.versions[0].responseFormat, taskRole: 'training',
  } as const;
  await governance.recordEvent(event('targeted_trigger_evaluated', { ...identity, requestId: undefined, assignmentId: undefined, targetedResourceVersionId: undefined, outcome: `eligible:${identity.gapReasonCode}` }));
  await governance.recordEvent(event('targeted_assignment_created', { ...identity, outcome: 'created' }));
  await governance.recordEvent(event('targeted_assignment_presented', { ...identity, outcome: 'in_progress' }));
  check((await governance.project()).metrics.startRate.numerator === 1, 'S4-21 created / presented 身份对齐');
  await governance.recordEvent(event('targeted_assignment_completed', { ...identity, targetedAttemptId: 'targeted-attempt-1', outcome: 'resolved' }));
  await governance.recordEvent(event('targeted_core_queue_resumed', { ...identity, outcome: 'resumed' }));
  projection = await governance.project();
  check(projection.metrics.completionRate.numerator === 1 && projection.metrics.completionRate.denominator === 1, 'S4-22 Completion 分母为已开始 Assignment');
  check(projection.metrics.coreReturnRate.numerator === 1, 'S4-23 终态恰好闭合一个核心返回');
  check(projection.metrics.immediateResolutionRate.numerator === 1, 'S4-24 即时缺口闭合使用明确 outcome');
  check(projection.breakdowns.some((item) => item.dimension === 'gap' && item.value === identity.gapReasonCode), 'S4-25 Gap 分层投影存在');
  check(projection.breakdowns.some((item) => item.dimension === 'response_format' && item.value === identity.responseFormat), 'S4-26 responseFormat 分层投影存在');
  check(!JSON.stringify((await governanceRepository.load()).events).includes('学生答案正文'), 'S4-27 Event 不包含答案正文');
  check(!isTargetedMicroTrainingStage4RuntimeEvent({ ...event('targeted_assignment_completed'), responseText: '学生答案正文' }), 'S4-28 带作答正文的 Event 被 Schema 拒绝');

  const outboxEvent = event('targeted_follow_up_observed', { sourceAttemptId: 'source-outbox', decisionId: 'decision-outbox', outcome: 'qualified' });
  const queued = await governance.recordEventNonBlocking(outboxEvent, async () => { throw new Error('temporary'); });
  check(queued === 'queued' && (await governanceRepository.load()).outbox.length === 1, 'S4-29 Event 写入失败进入 Outbox 且不阻断主链');
  const retried = await governance.retryOutbox();
  check(retried.succeeded === 1 && (await governanceRepository.load()).outbox.length === 0, 'S4-30 Outbox 补写成功且不重复');

  const followUpBase = {
    episodeId: (await governanceRepository.load()).episodes.find((item) => item.assignmentId === identity.assignmentId)!.episodeId,
    sourceResourceVersionId: identity.sourceResourceVersionId,
    targetedResourceVersionId: identity.targetedResourceVersionId,
    followUpResourceVersionId: 'follow-up-resource-v1', followUpRole: 'core_training' as const,
    abilityId: identity.abilityId, gapReasonCode: identity.gapReasonCode,
    sourceAbilityId: identity.abilityId, sourceGapReasonCode: identity.gapReasonCode,
    responseValid: true, formalDiagnosisPersisted: true, gapObserved: false, observedAt: now,
  };
  const qualified = buildTargetedMicroTrainingFollowUp({ ...followUpBase, followUpAttemptId: 'follow-up-attempt-1' });
  check(qualified.independence === 'qualified' && qualified.result === 'gap_not_observed', 'S4-31 不同资源后测可 qualified');
  check(buildTargetedMicroTrainingFollowUp({ ...followUpBase, followUpAttemptId: 'follow-up-attempt-2', followUpResourceVersionId: identity.targetedResourceVersionId }).independence === 'not_independent', 'S4-32 微训练自身重答不独立');
  check(buildTargetedMicroTrainingFollowUp({ ...followUpBase, followUpAttemptId: 'follow-up-attempt-3', sameAnchor: true }).independence === 'not_independent', 'S4-33 同 Anchor 不独立');
  check(buildTargetedMicroTrainingFollowUp({ ...followUpBase, followUpAttemptId: 'follow-up-attempt-4', responseValid: false }).result === 'insufficient_to_judge', 'S4-34 无效回答标记 insufficient');
  check(buildTargetedMicroTrainingFollowUp({ ...followUpBase, followUpAttemptId: 'follow-up-attempt-5', formalDiagnosisPersisted: false }).result === 'insufficient_to_judge', 'S4-35 未形成正式 Diagnosis 不判断改善');
  check(buildTargetedMicroTrainingFollowUp({ ...followUpBase, followUpAttemptId: 'follow-up-attempt-6', sourceAbilityId: 'other' }).result === 'insufficient_to_judge', 'S4-36 Ability 不可比较时不判断');
  check(buildTargetedMicroTrainingFollowUp({ ...followUpBase, followUpAttemptId: 'follow-up-attempt-7', followUpRole: 'retest' }).followUpRole === 'retest', 'S4-37 Retest 角色独立保留');
  check(buildTargetedMicroTrainingFollowUp({ ...followUpBase, followUpAttemptId: 'follow-up-attempt-8', followUpRole: 'transfer' }).followUpRole === 'transfer', 'S4-38 Transfer 角色独立保留');
  await governance.saveFollowUp(qualified);
  projection = await governance.project();
  check(projection.metrics.followUpCoverageRate.numerator === 1, 'S4-39 Follow-up Coverage 只统计 qualified');
  check(projection.metrics.sameGapRecurrenceRate.denominator === 1 && projection.metrics.sameGapRecurrenceRate.numerator === 0, 'S4-40 Same-gap Recurrence 排除 insufficient');

  const insufficientDecision = buildTargetedMicroTrainingCalibrationDecision({
    projection, policyVersion: TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
    packVersion: bundle.manifest.packVersion,
    observationWindow: { startedAt: now, endedAt: '2026-08-21T14:00:00.000Z' },
    sessionCount: 1, decidedAt: now,
  });
  check(insufficientDecision.runtimeSafety === 'insufficient_data' && insufficientDecision.educationalSignal === 'insufficient_data', 'S4-41 样本不足必须输出 insufficient_data');
  check(insufficientDecision.sampleSummary.sessions === 1, 'S4-42 单学生多 Episode 不包装成多人样本');

  const badSnapshot = await governanceRepository.load();
  badSnapshot.events.push(
    event('targeted_assignment_skipped', { ...identity, outcome: 'skipped' }),
  );
  badSnapshot.events.push(
    event('targeted_assignment_completed', { ...identity, targetedAttemptId: identity.sourceAttemptId, targetedResourceVersionId: 'wrong-resource-version', outcome: 'completed' }),
  );
  const badProjection = projectTargetedMicroTrainingStage4(badSnapshot, now);
  check(badProjection.integrityStatus === 'fail', 'S4-43 重复终态与身份错位触发硬故障');
  check(badProjection.issues.some((item) => item.code === 'attempt_identity_reused'), 'S4-44 source / targeted Attempt 复用被阻断');
  check(badProjection.issues.some((item) => item.code === 'assignment_resource_version_mismatch'), 'S4-45 Resource Version 与 Assignment 错位被阻断');
  const pauseDecision = buildTargetedMicroTrainingCalibrationDecision({
    projection: badProjection, policyVersion: TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
    packVersion: bundle.manifest.packVersion,
    observationWindow: { startedAt: now, endedAt: '2026-08-21T14:00:00.000Z' },
    sessionCount: 3, decidedAt: now,
  });
  check(pauseDecision.decision === 'pause', 'S4-46 硬故障只生成暂停决策，不自动放宽门禁');

  const eventsBeforeRollback = (await governanceRepository.load()).events.length;
  await rollbackTargetedMicroTrainingControlledPack({
    bundle, formalRepository, governance, actorId: 'tester', reason: 'debug_rollback', now,
  });
  const rollbackAudit = await auditTargetedMicroTrainingControlledPack({ bundle, formalRepository, observationRepository });
  check(!rollbackAudit.passed && rollbackAudit.activeRegistryCount === 0, 'S4-47 回滚撤销 Pack 活动 Link 并阻止后续匹配');
  const afterRollback = await governanceRepository.load();
  check(afterRollback.events.length === eventsBeforeRollback && afterRollback.enablement.mode === 'paused', 'S4-48 回滚保留历史事实且进入暂停模式');

  console.log(`\nTargeted micro-training Stage 4 Debug: ${passed}/51 PASS`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
