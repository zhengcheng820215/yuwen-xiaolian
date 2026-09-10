import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  buildRubricFeedbackProjection,
  type RubricFeedbackProjectionBuildInput,
} from '../agents/rubricFeedbackProjectionAgent.ts';
import { buildStudentVisibleFeedbackGroundingFromProjection } from
  '../agents/rubricFeedbackGroundingAdapter.ts';
import { evaluateCurrentFormalResourceQualityAdmission } from
  '../agents/phase173FormalResourceMatchingService.ts';
import {
  WRONG_ANSWER_STAGE3_WAVE_B_COMMAND_ID,
  WRONG_ANSWER_STAGE3_WAVE_B_SPECS,
  prepareWrongAnswerFeedbackStage3WaveB,
} from '../services/wrongAnswerFeedbackStage3WaveBService.ts';
import {
  DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
  FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
} from '../schemas/diagnosisRunRecord.schema.ts';
import type {
  QuestionResourceRubricItem,
  RubricFeedbackActionCode,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { SharedFormalResourceData } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { TaskRequirementCoverage } from '../schemas/studentLearningFeedback.schema.ts';

const apply = process.argv.includes('--apply');
const now = new Date().toISOString();
const checks: Array<{ id: string; name: string; passed: true }> = [];
const pending: Promise<void>[] = [];
const EXPECTED_ACTIONS: Record<RubricFeedbackActionCode, string> = {
  verify_scope: '核对这一处是否符合题干限定的语境和对象。',
  compare_elements: '比较两个对象及其关键差异。',
  reclassify_by_cue: '根据触发词重新核对分类。',
  identify_object_action: '指出这一处被写成人的对象及其动作。',
  add_required_dimension: '选择一个尚未完成的要求维度补充说明。',
};
const GENERIC_ACTION = '补齐同一任务要求中尚未完成的一个必要方面。';
const store = new SharedFormalResourceStore();
const before = await store.readOnly();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');
const beforeData = structuredClone(before.data);
const prepared = await prepareWrongAnswerFeedbackStage3WaveB(before.data, now);
const afterData = prepared.data;
const reports = prepared.report.resources;
const trialArtifactPath = process.env.PRODUCT_RUNTIME_TRIAL_CONTROL_PATH;
const trialArtifactBefore = trialArtifactPath ? await readOptional(trialArtifactPath) : undefined;

check('C3-B01', 'Formal Store baseline is initialized and revision is captured', () => {
  assert(before.revision >= 1965);
  assert.equal(reports.length, 4);
});
check('C3-B02', 'Wave B creates exactly four controlled-original materials', () => {
  for (const report of reports) {
    const material = requireMaterial(afterData, report.materialVersionId);
    assert.equal(material.usageType, 'targeted_excerpt');
    assert.equal(material.targetedExcerptMetadata?.sourceRelation, 'controlled_original');
  }
});
check('C3-B03', 'all material provenance and rights evidence are verified', () => {
  for (const report of reports) {
    const material = requireMaterial(afterData, report.materialVersionId);
    assert.equal(material.metadata?.provenanceStatus, 'verified');
    assert.equal(material.metadata?.provenanceReview?.textVerificationStatus, 'verified');
    assert.equal(material.metadata?.provenanceReview?.rightsStatus, 'cleared');
  }
});
check('C3-B04', 'each targeted material authorizes exactly one task', () => {
  for (const report of reports) {
    assert.equal(requireMaterial(afterData, report.materialVersionId)
      .targetedExcerptMetadata?.intendedTaskCount, 1);
  }
});
check('C3-B05', 'all materials explicitly support incomplete_task_requirement', () => {
  for (const report of reports) {
    assert(requireMaterial(afterData, report.materialVersionId)
      .targetedExcerptMetadata?.supportedGapReasonCodes.includes('incomplete_task_requirement'));
  }
});
check('C3-B06', 'each reviewed Observation Plan contains one atomic task', () => {
  for (const report of reports) {
    const plan = afterData.materialObservations.plans.find((item) => (
      item.materialObservationPlanId === report.materialObservationPlanId
    ));
    assert.equal(plan?.status, 'reviewed');
    assert.equal(plan?.taskPlans.length, 1);
  }
});
check('C3-B07', 'all student responses use the specified admitted text format', () => {
  for (const report of reports) {
    const version = requireVersion(afterData, report.resourceVersionId);
    const spec = WRONG_ANSWER_STAGE3_WAVE_B_SPECS.find((item) => item.actionCode === report.actionCode);
    assert.equal(version.responseFormat, spec?.responseFormat);
    assert.equal(version.questionType, 'reading_comprehension');
  }
});
check('C3-B08', 'one exact operation-only Action Contract is bound per resource', () => {
  for (const report of reports) {
    const version = requireVersion(afterData, report.resourceVersionId);
    const contracted = version.rubric.filter((item) => item.feedbackActionContract);
    assert.equal(contracted.length, 1);
    assert.equal(contracted[0]?.feedbackActionContract?.actionCode, report.actionCode);
    assert.equal(contracted[0]?.feedbackActionContract?.disclosurePolicy, 'operation_only');
  }
});
check('C3-B09', 'scope, comparison, cue classification and object-action designs remain distinct', () => {
  const stems = reports.map((report) => requireVersion(afterData, report.resourceVersionId).questionStem);
  assert(stems.some((stem) => stem.includes('只根据') && stem.includes('阅览室')));
  assert(stems.some((stem) => stem.includes('比较') && stem.includes('两个方面')));
  assert(stems.some((stem) => stem.includes('听觉') && stem.includes('触觉')));
  assert(stems.some((stem) => stem.includes('对象') && stem.includes('动作')));
  assert.equal(new Set(stems).size, 4);
});
check('C3-B10', 'exam photos and student answers remain offline evidence only', () => {
  const serialized = JSON.stringify(reports.map((report) => ({
    material: requireMaterial(afterData, report.materialVersionId),
    version: requireVersion(afterData, report.resourceVersionId),
  })));
  assert(!/WA-0[2679]|7801789005302|7791789005302|7781789005301|试卷照片|学生原答/.test(serialized));
});
check('C3-B11', 'all four Question validations pass without errors', () => {
  for (const report of reports) {
    const validation = afterData.questionResources.validations.find((item) => (
      item.validationId === report.validationId
    ));
    assert(validation?.passed);
    assert.equal(validation?.issues.filter((item) => item.severity === 'error').length, 0);
  }
});
check('C3-B12', 'human/operator review approves semantics and visibility boundary', () => {
  for (const report of reports) {
    const review = afterData.questionResources.reviews.find((item) => item.reviewId === report.reviewId);
    assert.equal(review?.action, 'approve');
    assert.equal(review?.reviewerId, 'product-owner-authorized-stage3-wave-b');
    assert(review?.notes.includes('operation-only'));
    assert(review?.notes.includes('不构成完整答案模板'));
  }
});
check('C3-B13', 'each resource is frozen behind one active Registry head', () => {
  for (const report of reports) {
    const version = requireVersion(afterData, report.resourceVersionId);
    const entries = afterData.questionResources.registryEntries.filter((item) => (
      item.resourceId === version.resourceId && item.status === 'active'
    ));
    assert.equal(version.status, 'frozen');
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.currentFrozenVersionId, version.resourceVersionId);
  }
});
check('C3-B14', 'Observation validation, review and active resource link are traceable', () => {
  for (const report of reports) {
    assert(afterData.materialObservations.validations.some((item) => (
      item.validationId === report.materialObservationValidationId && item.passed
    )));
    assert(afterData.materialObservations.reviews.some((item) => (
      item.reviewId === report.materialObservationReviewId && item.action === 'approve'
    )));
    assert(afterData.materialObservations.links.some((item) => (
      item.resourceObservationLinkId === report.resourceObservationLinkId
      && item.resourceVersionId === report.resourceVersionId
      && item.status === 'active'
    )));
  }
});
check('C3-B15', 'each frozen version has one current quality trace', () => {
  for (const report of reports) {
    const traces = afterData.questionQuality.frozenQualityTraces.filter((item) => (
      item.resourceVersionId === report.resourceVersionId
    ));
    assert.equal(traces.length, 1);
    assert.equal(traces[0]?.traceId, report.qualityTraceId);
  }
  const versions = reports.map((report) => requireVersion(afterData, report.resourceVersionId));
  assert.equal(evaluateCurrentFormalResourceQualityAdmission(versions)
    .filter((item) => item.status === 'blocked').length, 0);
});
check('C3-B16', 'Rubric descriptions and accepted signals do not form answer templates', () => {
  for (const report of reports) {
    const version = requireVersion(afterData, report.resourceVersionId);
    for (const item of version.rubric) {
      assert(!/正确答案|答案是|这说明|因此可以看出/.test(item.description || ''));
      assert(item.acceptedSignals.every((signal) => signal.length <= 10));
      assert(item.acceptedSignals.every((signal) => !/[。！？；]/.test(signal)));
    }
  }
});
check('C3-B17', 'four resources project four exact deterministic action intents', () => {
  for (const report of reports) {
    const version = requireVersion(afterData, report.resourceVersionId);
    assert.equal(actionFor(version.rubric, report.actionCode), EXPECTED_ACTIONS[report.actionCode]);
  }
});
check('C3-B18', 'Wave B action projection has zero generic fallback', () => {
  const actions = reports.map((report) => actionFor(
    requireVersion(afterData, report.resourceVersionId).rubric,
    report.actionCode,
  ));
  assert.equal(actions.filter((action) => action === GENERIC_ACTION).length, 0);
});
check('C3-B19', 'student-visible grounding leaks no Rubric internals or answer chain', () => {
  for (const report of reports) {
    const grounding = groundingFor(
      requireVersion(afterData, report.resourceVersionId).rubric,
      report.actionCode,
    );
    const serialized = JSON.stringify(grounding);
    assert(!/acceptedSignals|feedbackActionCode|feedbackActionContract|rubricItemId|正确答案|答案是|这说明/.test(serialized));
  }
});
check('C3-B20', 'non-target gaps preserve the legacy deterministic mapping', () => {
  for (const report of reports) {
    const rubric = requireVersion(afterData, report.resourceVersionId).rubric;
    assert.equal(actionFor(rubric, report.actionCode, 'missing_text_evidence'),
      '定位一条能够支持当前判断的文本依据。');
    assert.equal(actionFor(rubric, report.actionCode, 'missing_reasoning_relation'),
      '说明已找到的依据与当前判断之间的关系。');
  }
});
check('C3-B21', 'formal mutation delta contains only four authorized resource chains', () => {
  const newMaterials = reports.filter((report) => !beforeData.questionResources.materials
    .some((item) => item.materialVersionId === report.materialVersionId)).length;
  const newVersions = reports.filter((report) => !beforeData.questionResources.versions
    .some((item) => item.resourceVersionId === report.resourceVersionId)).length;
  const newRegistry = reports.filter((report) => {
    const version = requireVersion(afterData, report.resourceVersionId);
    return !beforeData.questionResources.registryEntries.some((item) => item.resourceId === version.resourceId);
  }).length;
  const newPlans = reports.filter((report) => !beforeData.materialObservations.plans
    .some((item) => item.materialObservationPlanId === report.materialObservationPlanId)).length;
  const newLinks = reports.filter((report) => !beforeData.materialObservations.links
    .some((item) => item.resourceObservationLinkId === report.resourceObservationLinkId)).length;
  assertDelta(afterData.questionResources.materials, beforeData.questionResources.materials, newMaterials);
  assertDelta(afterData.questionResources.drafts, beforeData.questionResources.drafts, newVersions);
  assertDelta(afterData.questionResources.validations, beforeData.questionResources.validations, newVersions);
  assertDelta(afterData.questionResources.reviews, beforeData.questionResources.reviews, newVersions);
  assertDelta(afterData.questionResources.versions, beforeData.questionResources.versions, newVersions);
  assertDelta(afterData.questionResources.registryEntries, beforeData.questionResources.registryEntries, newRegistry);
  assertDelta(afterData.materialObservations.structures, beforeData.materialObservations.structures, newPlans);
  assertDelta(afterData.materialObservations.anchors, beforeData.materialObservations.anchors, newPlans);
  assertDelta(afterData.materialObservations.plans, beforeData.materialObservations.plans, newPlans);
  assertDelta(afterData.materialObservations.validations, beforeData.materialObservations.validations, newPlans);
  assertDelta(afterData.materialObservations.reviews, beforeData.materialObservations.reviews, newPlans);
  assertDelta(afterData.materialObservations.links, beforeData.materialObservations.links, newLinks);
  assertDelta(afterData.questionQuality.frozenQualityTraces, beforeData.questionQuality.frozenQualityTraces, newVersions);
});
check('C3-B22', 'Wave B has no Attempt, Profile or Trial Observation write scope', () => {
  assert.deepEqual(Object.keys(afterData).sort(), ['materialObservations', 'questionQuality', 'questionResources']);
});
check('C3-B23', 'Wave B leaves Trial activation artifact unchanged', async () => {
  const trialArtifactAfter = trialArtifactPath ? await readOptional(trialArtifactPath) : undefined;
  assert.equal(trialArtifactAfter, trialArtifactBefore);
});
check('C3-B24', 'production build gate is explicit for apply and idempotent replay', () => {
  assert.equal(process.env.STAGE3_WAVE_B_BUILD_RESULT || 'pending', apply ? 'pass' : 'pending');
});

await Promise.all(pending);

let committedRevision = before.revision;
if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: WRONG_ANSWER_STAGE3_WAVE_B_COMMAND_ID,
    patches: [
      { scope: 'questionResources', collection: 'materials', values: afterData.questionResources.materials },
      { scope: 'questionResources', collection: 'drafts', values: afterData.questionResources.drafts },
      { scope: 'questionResources', collection: 'validations', values: afterData.questionResources.validations },
      { scope: 'questionResources', collection: 'reviews', values: afterData.questionResources.reviews },
      { scope: 'questionResources', collection: 'versions', values: afterData.questionResources.versions },
      { scope: 'questionResources', collection: 'registryEntries', values: afterData.questionResources.registryEntries },
      { scope: 'materialObservations', collection: 'structures', values: afterData.materialObservations.structures },
      { scope: 'materialObservations', collection: 'anchors', values: afterData.materialObservations.anchors },
      { scope: 'materialObservations', collection: 'plans', values: afterData.materialObservations.plans },
      { scope: 'materialObservations', collection: 'validations', values: afterData.materialObservations.validations },
      { scope: 'materialObservations', collection: 'reviews', values: afterData.materialObservations.reviews },
      { scope: 'materialObservations', collection: 'links', values: afterData.materialObservations.links },
      { scope: 'questionQuality', collection: 'deterministicAssessments', values: afterData.questionQuality.deterministicAssessments },
      { scope: 'questionQuality', collection: 'semanticAssessments', values: afterData.questionQuality.semanticAssessments },
      { scope: 'questionQuality', collection: 'assessmentBundles', values: afterData.questionQuality.assessmentBundles },
      { scope: 'questionQuality', collection: 'frozenQualityTraces', values: afterData.questionQuality.frozenQualityTraces },
    ],
  });
  committedRevision = committed.revision;
  const replay = await prepareWrongAnswerFeedbackStage3WaveB(committed.data, now);
  assert.equal(replay.report.alreadyApplied, true);
  assert.deepEqual(replay.data, committed.data);
} else {
  const unchanged = await store.readOnly();
  assert.equal(unchanged.revision, before.revision);
  assert.deepEqual(unchanged.data, before.data);
}

console.log(JSON.stringify({
  stage: 'wrong-answer-feedback-stage3-wave-b',
  mode: apply ? (prepared.report.alreadyApplied ? 'apply-noop' : 'apply') : 'dry-run',
  beforeRevision: before.revision,
  afterRevision: committedRevision,
  report: prepared.report,
  checks,
  result: `${checks.length}/${checks.length} PASS`,
  trialStatus: 'not_activated_by_stage3_wave_b',
}, null, 2));

function check(id: string, name: string, run: () => void | Promise<void>): void {
  const result = run();
  if (result instanceof Promise) {
    pending.push(result.then(() => checks.push({ id, name, passed: true })));
    return;
  }
  checks.push({ id, name, passed: true });
}

function actionFor(
  rubric: QuestionResourceRubricItem[],
  actionCode: RubricFeedbackActionCode,
  gap: TaskRequirementCoverage['gapReasonCode'] = 'incomplete_task_requirement',
): string {
  const output = buildRubricFeedbackProjection(projectionInput(rubric, actionCode, gap));
  assert(output.projection);
  const primary = output.projection.items.find((item) => item.rubricItemId === output.projection?.primaryItemId);
  assert(primary?.nextThinkingAction);
  return primary.nextThinkingAction;
}

function groundingFor(
  rubric: QuestionResourceRubricItem[],
  actionCode: RubricFeedbackActionCode,
) {
  const input = projectionInput(rubric, actionCode, 'incomplete_task_requirement');
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'projected');
  assert(output.projection);
  const adapted = buildStudentVisibleFeedbackGroundingFromProjection({
    projection: output.projection,
    context: {
      studentId: 'student-stage3-wave-b',
      learningRoundId: input.projectionContext.learningRoundId,
      taskId: input.projectionContext.taskId,
      executionSessionId: input.projectionContext.executionSessionId,
      responseId: input.projectionContext.responseId,
      questionVersionId: input.projectionContext.questionVersionId,
    },
    responseFormat: 'short_text',
    taskRole: 'training',
    verifiedStudentEvidenceByRef: { 'evidence-main': '学生已完成部分要求' },
    feedbackDepth: 'thinking_prompt',
  });
  assert.equal(adapted.outcome, 'grounded');
  assert(adapted.grounding);
  return adapted.grounding;
}

function projectionInput(
  rubric: QuestionResourceRubricItem[],
  actionCode: RubricFeedbackActionCode,
  gap: TaskRequirementCoverage['gapReasonCode'],
): RubricFeedbackProjectionBuildInput {
  const requirementType = gap === 'missing_text_evidence'
    ? 'text_evidence'
    : gap === 'missing_reasoning_relation'
      ? 'reasoning_relation'
      : 'conclusion';
  const primaryRubric = rubric.find((item) => item.feedbackActionContract?.actionCode === actionCode);
  assert(primaryRubric);
  const mainCoverage: TaskRequirementCoverage = {
    requirementId: 'requirement-main',
    requirementType,
    requirementText: '完成题干限定的动作',
    required: true,
    status: 'partially_covered',
    studentEvidence: ['学生已完成部分要求'],
    taskEvidence: ['题干包含明确动作边界'],
    source: 'formal_diagnosis',
    gapReasonCode: gap,
    gapMessage: '尚有一个动作断点',
  };
  const prerequisiteCoverage: TaskRequirementCoverage[] = gap === 'missing_text_evidence'
    ? [coveredRequirement('requirement-covered', 'conclusion')]
    : gap === 'missing_reasoning_relation'
      ? [coveredRequirement('requirement-covered', 'text_evidence')]
      : [];
  return {
    projectionContext: {
      questionVersionId: `question-stage3-wave-b-${actionCode}`,
      rubricVersion: 'rubric-stage3-wave-b-v1',
      taskId: `task-stage3-wave-b-${actionCode}`,
      learningRoundId: 'round-stage3-wave-b',
      executionSessionId: 'execution-stage3-wave-b',
      responseId: 'response-stage3-wave-b',
      formalDiagnosisId: 'diagnosis-stage3-wave-b',
    },
    responseFormat: 'short_text',
    taskRole: 'training',
    rubric,
    formalDiagnosisCommit: {
      schemaVersion: FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
      formalDiagnosisId: 'diagnosis-stage3-wave-b',
      requestId: 'request-stage3-wave-b',
      runId: 'run-stage3-wave-b',
      status: 'committed',
      committedAt: now,
      diagnosisResult: {
        taskType: 'open_response', correct: null, strategyUsed: 'partial_requirement',
        answerStatus: 'partially_meets', scoreBand: 'medium', mainAbility: '分析',
        relatedAbilities: ['理解'], surfaceError: '只完成部分要求', rootCause: '尚缺必要动作',
        errorType: '分析错误', abilityEvidence: ['已完成一部分'], diagnosisSummary: '部分完成',
        nextTraining: '重新执行动作', confidence: 0.9,
      },
      validation: { passed: true, issues: [] },
    },
    diagnosisRunRecord: {
      schemaVersion: DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
      runId: 'run-stage3-wave-b', requestId: 'request-stage3-wave-b',
      studentId: 'student-stage3-wave-b', taskId: `task-stage3-wave-b-${actionCode}`,
      executionSessionId: 'execution-stage3-wave-b', responseId: 'response-stage3-wave-b',
      executionMode: 'live', status: 'formal_result_committed', providerConfigId: 'provider-stage3-wave-b',
      providerRequestIds: ['provider-request-stage3-wave-b'], attemptCount: 1, repairOperations: [],
      promptVersion: 'prompt-stage3-wave-b', diagnosisSchemaVersion: 'diagnosis-result-v1', issues: [],
      startedAt: now, completedAt: now,
    },
    requirementCoverage: [...prerequisiteCoverage, mainCoverage],
    primaryGapRequirementId: 'requirement-main',
    verifiedStudentEvidenceRefs: {
      'requirement-main': ['evidence-main'],
      'requirement-covered': ['evidence-covered'],
    },
    rubricRequirementBindings: [{
      rubricItemId: primaryRubric.itemId,
      requirementId: 'requirement-main',
      bindingSource: 'frozen_contract',
      feedbackActionCode: actionCode,
    }],
  };
}

function coveredRequirement(
  requirementId: string,
  requirementType: TaskRequirementCoverage['requirementType'],
): TaskRequirementCoverage {
  return {
    requirementId,
    requirementType,
    requirementText: '已完成的前置要求',
    required: true,
    status: 'covered',
    studentEvidence: ['学生已完成前置要求'],
    taskEvidence: ['题干包含前置要求'],
    source: 'formal_diagnosis',
  };
}

function requireMaterial(data: SharedFormalResourceData, materialVersionId: string) {
  const value = data.questionResources.materials.find((item) => item.materialVersionId === materialVersionId);
  if (!value) throw new Error(`Material missing: ${materialVersionId}`);
  return value;
}

function requireVersion(data: SharedFormalResourceData, resourceVersionId: string) {
  const value = data.questionResources.versions.find((item) => item.resourceVersionId === resourceVersionId);
  if (!value) throw new Error(`Version missing: ${resourceVersionId}`);
  return value;
}

function assertDelta(after: unknown[], beforeValue: unknown[], expected: number): void {
  assert.equal(after.length, beforeValue.length + expected);
}

async function readOptional(path: string): Promise<string | undefined> {
  try { return await readFile(path, 'utf8'); } catch { return undefined; }
}
