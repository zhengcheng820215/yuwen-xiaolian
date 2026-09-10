import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  buildRubricFeedbackProjection,
  type RubricFeedbackProjectionBuildInput,
} from '../agents/rubricFeedbackProjectionAgent.ts';
import { buildStudentVisibleFeedbackGroundingFromProjection } from
  '../agents/rubricFeedbackGroundingAdapter.ts';
import {
  WRONG_ANSWER_STAGE3_WAVE_A_COMMAND_ID,
  WRONG_ANSWER_STAGE3_WAVE_A_MATERIAL_VERSION_ID,
  WRONG_ANSWER_STAGE3_WAVE_A_RESOURCE_ID,
  WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID,
  WRONG_ANSWER_STAGE3_WAVE_A_SOURCE_VERSION_ID,
  prepareWrongAnswerFeedbackStage3WaveA,
} from '../services/wrongAnswerFeedbackStage3WaveAService.ts';
import {
  DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
  FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
} from '../schemas/diagnosisRunRecord.schema.ts';
import {
  RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
  type QuestionResourceRubricItem,
  type RubricFeedbackActionCode,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { SharedFormalResourceData } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { TaskRequirementCoverage } from '../schemas/studentLearningFeedback.schema.ts';

const apply = process.argv.includes('--apply');
const now = new Date().toISOString();
const checks: Array<{ id: string; name: string; passed: true }> = [];
const pending: Promise<void>[] = [];
const store = new SharedFormalResourceStore();
const before = await store.readOnly();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');
const beforeData = structuredClone(before.data);
const prepared = await prepareWrongAnswerFeedbackStage3WaveA(before.data, now);
const afterData = prepared.data;
const successor = requireVersion(afterData, prepared.report.successorResourceVersionId);
const sourceBefore = requireVersion(beforeData, WRONG_ANSWER_STAGE3_WAVE_A_SOURCE_VERSION_ID);
const sourceAfter = requireVersion(afterData, WRONG_ANSWER_STAGE3_WAVE_A_SOURCE_VERSION_ID);
const targetRubric = successor.rubric.find((item) => item.itemId === WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID);
const trialArtifactPath = process.env.PRODUCT_RUNTIME_TRIAL_CONTROL_PATH;
const trialArtifactBefore = trialArtifactPath ? await readOptional(trialArtifactPath) : undefined;

check('C3-A01', 'Formal Store baseline is initialized and revision is captured before mutation', () => {
  assert(before.revision >= 1964);
});
check('C3-A02', 'deidentified wrong-answer fixtures remain offline evidence only', () => {
  assert(!JSON.stringify(afterData.questionResources).includes('WA-02'));
  assert(!JSON.stringify(afterData.questionResources).includes('7801789005302'));
});
check('C3-A03', 'non-controlled or unverified material is rejected from Wave A', async () => {
  const invalid = structuredClone(beforeData);
  const material = invalid.questionResources.materials.find((item) => (
    item.materialVersionId === WRONG_ANSWER_STAGE3_WAVE_A_MATERIAL_VERSION_ID
  ));
  assert(material?.targetedExcerptMetadata);
  material.targetedExcerptMetadata.sourceRelation = 'same_material';
  await assert.rejects(
    () => prepareWrongAnswerFeedbackStage3WaveA(invalid, now),
    /not controlled original/,
  );
});
check('C3-A04', 'Wave A material is active, verified, controlled original and gap-compatible', () => {
  const material = afterData.questionResources.materials.find((item) => (
    item.materialVersionId === WRONG_ANSWER_STAGE3_WAVE_A_MATERIAL_VERSION_ID
  ));
  assert(material && material.status !== 'retired');
  assert.equal(material.metadata?.provenanceStatus, 'verified');
  assert.equal(material.targetedExcerptMetadata?.sourceRelation, 'controlled_original');
  assert(material.targetedExcerptMetadata?.supportedGapReasonCodes.includes('incomplete_task_requirement'));
});
check('C3-A05', 'version service creates a traceable successor identity', () => {
  assert.equal(successor.parentVersionId, WRONG_ANSWER_STAGE3_WAVE_A_SOURCE_VERSION_ID);
  assert.equal(successor.versionNumber, sourceBefore.versionNumber + 1);
  assert.notEqual(successor.resourceVersionId, sourceBefore.resourceVersionId);
});
check('C3-A06', 'V1 educational snapshot remains byte-identical; only lifecycle metadata changes', () => {
  assert.deepEqual(educationalContent(sourceAfter), educationalContent(sourceBefore));
  assert.equal(sourceAfter.resourceVersionId, sourceBefore.resourceVersionId);
});
check('C3-A07', 'Action Contract schema, action and disclosure policy are exact', () => {
  assert.deepEqual(targetRubric?.feedbackActionContract, {
    schemaVersion: RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
    actionCode: 'add_required_dimension',
    disclosurePolicy: 'operation_only',
  });
});
check('C3-A08', 'only primary-action receives an Action Contract', () => {
  assert.equal(successor.rubric.filter((item) => item.feedbackActionContract).length, 1);
  assert(targetRubric?.feedbackActionContract);
});
check('C3-A09', 'all non-contract educational fields equal the source version', () => {
  const value = educationalContent(successor);
  const target = (value.rubric as QuestionResourceRubricItem[]).find((item) => (
    item.itemId === WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID
  ));
  delete target?.feedbackActionContract;
  assert.deepEqual(value, educationalContent(sourceBefore));
});
check('C3-A10', 'successor resource admission passes with no errors', () => {
  const validation = afterData.questionResources.validations.find((item) => (
    item.validationId === successor.validationId
  ));
  assert(validation?.passed);
  assert.equal(validation.issues.filter((item) => item.severity === 'error').length, 0);
});
check('C3-A11', 'operator-authorized review approves action semantics and visibility boundary', () => {
  const review = afterData.questionResources.reviews.find((item) => item.reviewId === successor.reviewId);
  assert.equal(review?.action, 'approve');
  assert.equal(review?.reviewerId, 'product-owner-authorized-stage3-wave-a');
  assert(review?.notes.includes('operation-only'));
});
check('C3-A12', 'successor is frozen and Registry has one current head', () => {
  assert.equal(successor.status, 'frozen');
  const entries = afterData.questionResources.registryEntries.filter((item) => (
    item.resourceId === WRONG_ANSWER_STAGE3_WAVE_A_RESOURCE_ID && item.status === 'active'
  ));
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.currentFrozenVersionId, successor.resourceVersionId);
});
check('C3-A13', 'V1 remains readable and rollback-addressable by immutable identity', () => {
  assert.equal(sourceAfter.status, 'superseded');
  assert.equal(successor.parentVersionId, sourceAfter.resourceVersionId);
});
check('C3-A14', 'partial_required_aspects consumes add_required_dimension', () => {
  assert.equal(actionFor(successor.rubric, 'incomplete_task_requirement'),
    '选择一个尚未完成的要求维度补充说明。');
});
check('C3-A15', 'other observed gaps preserve their legacy deterministic mapping', () => {
  assert.equal(actionFor(successor.rubric, 'missing_text_evidence'),
    '定位一条能够支持当前判断的文本依据。');
  assert.equal(actionFor(successor.rubric, 'missing_reasoning_relation'),
    '说明已找到的依据与当前判断之间的关系。');
});
check('C3-A16', 'invalid contract fails closed to the legacy action', () => {
  const invalid = structuredClone(successor.rubric);
  (invalid[0]!.feedbackActionContract as { actionCode: string }).actionCode = 'unknown';
  assert.equal(actionFor(invalid, 'incomplete_task_requirement', 'unknown'),
    '补齐同一任务要求中尚未完成的一个必要方面。');
});
check('C3-A17', 'missing safe clue never fabricates a clue and keeps the bounded action', () => {
  const grounding = groundingFor(successor.rubric, 'add_required_dimension');
  assert.equal(grounding.safeClueLocator, undefined);
  assert.equal(grounding.nextThinkingAction, '选择一个尚未完成的要求维度补充说明。');
});
check('C3-A18', 'student-visible grounding leaks no Rubric internals or answer chain', () => {
  const serialized = JSON.stringify(groundingFor(successor.rubric, 'add_required_dimension'));
  assert(!/acceptedSignals|feedbackActionCode|feedbackActionContract|primary-action|正确答案是|依据是|这说明/.test(serialized));
});
check('C3-A19', 'single choice and independent roles retain their previous branches', () => {
  const single = projectionInput(successor.rubric, 'incomplete_task_requirement', 'add_required_dimension');
  single.responseFormat = 'single_choice';
  assert.equal(buildRubricFeedbackProjection(single).outcome, 'single_choice_passthrough');
  for (const role of ['retest', 'transfer'] as const) {
    const input = projectionInput(successor.rubric, 'incomplete_task_requirement', 'add_required_dimension');
    input.taskRole = role;
    assert.equal(projectGrounding(input).feedbackDepth, 'result_only');
  }
});
check('C3-A20', 'five offline findings map 5/5 to specific intent with zero generic fallback or leakage', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('./fixtures/wrong-answer-stage2-action-contract.fixture.json', import.meta.url),
    'utf8',
  )) as { samples: Array<{ actionCode: RubricFeedbackActionCode; expectedAction: string }> };
  assert.equal(fixture.samples.length, 5);
  const actions = fixture.samples.map((sample) => {
    const rubric = contractedRubric(sample.actionCode);
    const action = actionFor(rubric, 'incomplete_task_requirement', sample.actionCode);
    assert.equal(action, sample.expectedAction);
    return action;
  });
  assert.equal(actions.filter((item) => item === '补齐同一任务要求中尚未完成的一个必要方面。').length, 0);
  assert.equal(actions.filter((item) => /答案是|依据是|这说明/.test(item)).length, 0);
});
check('C3-A21', 'production build is delegated to the post-migration acceptance command', () => {
  assert.equal(process.env.STAGE3_WAVE_A_BUILD_RESULT || 'pending', apply ? 'pass' : 'pending');
});
check('C3-A22', 'formal mutation delta is limited to authorized successor records and one link switch', () => {
  assert.equal(afterData.questionResources.materials.length, beforeData.questionResources.materials.length);
  assert.equal(afterData.questionResources.drafts.length, beforeData.questionResources.drafts.length + (prepared.report.alreadyApplied ? 0 : 1));
  assert.equal(afterData.questionResources.validations.length, beforeData.questionResources.validations.length + (prepared.report.alreadyApplied ? 0 : 1));
  assert.equal(afterData.questionResources.reviews.length, beforeData.questionResources.reviews.length + (prepared.report.alreadyApplied ? 0 : 1));
  assert.equal(afterData.questionResources.versions.length, beforeData.questionResources.versions.length + (prepared.report.alreadyApplied ? 0 : 1));
  assert.equal(afterData.questionResources.registryEntries.length, beforeData.questionResources.registryEntries.length);
  assert.equal(afterData.materialObservations.plans.length, beforeData.materialObservations.plans.length);
  assert.equal(afterData.materialObservations.links.length, beforeData.materialObservations.links.length + (prepared.report.alreadyApplied ? 0 : 1));
});
check('C3-A23', 'migration model has no Attempt, Profile or Trial Observation write scope', () => {
  assert.deepEqual(Object.keys(afterData).sort(), ['materialObservations', 'questionQuality', 'questionResources']);
});
check('C3-A24', 'no new Trial activation artifact is generated by Wave A', async () => {
  const trialArtifactAfter = trialArtifactPath ? await readOptional(trialArtifactPath) : undefined;
  assert.equal(trialArtifactAfter, trialArtifactBefore);
});

await Promise.all(pending);

let committedRevision = before.revision;
if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: WRONG_ANSWER_STAGE3_WAVE_A_COMMAND_ID,
    patches: [
      { scope: 'questionResources', collection: 'drafts', values: afterData.questionResources.drafts },
      { scope: 'questionResources', collection: 'validations', values: afterData.questionResources.validations },
      { scope: 'questionResources', collection: 'reviews', values: afterData.questionResources.reviews },
      { scope: 'questionResources', collection: 'versions', values: afterData.questionResources.versions },
      { scope: 'questionResources', collection: 'registryEntries', values: afterData.questionResources.registryEntries },
      { scope: 'materialObservations', collection: 'links', values: afterData.materialObservations.links },
      { scope: 'questionQuality', collection: 'deterministicAssessments', values: afterData.questionQuality.deterministicAssessments },
      { scope: 'questionQuality', collection: 'semanticAssessments', values: afterData.questionQuality.semanticAssessments },
      { scope: 'questionQuality', collection: 'assessmentBundles', values: afterData.questionQuality.assessmentBundles },
      { scope: 'questionQuality', collection: 'frozenQualityTraces', values: afterData.questionQuality.frozenQualityTraces },
    ],
  });
  committedRevision = committed.revision;
  const replay = await prepareWrongAnswerFeedbackStage3WaveA(committed.data, now);
  assert.equal(replay.report.alreadyApplied, true);
  assert.deepEqual(replay.data, committed.data);
} else {
  const unchanged = await store.readOnly();
  assert.equal(unchanged.revision, before.revision);
  assert.deepEqual(unchanged.data, before.data);
}

console.log(JSON.stringify({
  stage: 'wrong-answer-feedback-stage3-wave-a',
  mode: apply ? (prepared.report.alreadyApplied ? 'apply-noop' : 'apply') : 'dry-run',
  beforeRevision: before.revision,
  afterRevision: committedRevision,
  report: prepared.report,
  checks,
  result: `${checks.length}/${checks.length} PASS`,
  trialStatus: 'not_activated_by_stage3_wave_a',
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
  gap: TaskRequirementCoverage['gapReasonCode'],
  actionCode: string = 'add_required_dimension',
): string {
  const input = projectionInput(rubric, gap, actionCode);
  const output = buildRubricFeedbackProjection(input);
  assert(output.projection);
  const primary = output.projection.items.find((item) => item.rubricItemId === output.projection?.primaryItemId);
  assert(primary?.nextThinkingAction);
  return primary.nextThinkingAction;
}

function groundingFor(rubric: QuestionResourceRubricItem[], actionCode: RubricFeedbackActionCode) {
  return projectGrounding(projectionInput(rubric, 'incomplete_task_requirement', actionCode));
}

function projectGrounding(input: RubricFeedbackProjectionBuildInput) {
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'projected');
  assert(output.projection);
  const adapted = buildStudentVisibleFeedbackGroundingFromProjection({
    projection: output.projection,
    context: {
      studentId: 'student-stage3-wave-a',
      learningRoundId: input.projectionContext.learningRoundId,
      taskId: input.projectionContext.taskId,
      executionSessionId: input.projectionContext.executionSessionId,
      responseId: input.projectionContext.responseId,
      questionVersionId: input.projectionContext.questionVersionId,
    },
    responseFormat: input.responseFormat,
    taskRole: input.taskRole,
    verifiedStudentEvidenceByRef: { 'evidence-main': '学生已完成一个要求维度' },
    feedbackDepth: 'thinking_prompt',
  });
  assert.equal(adapted.outcome, 'grounded');
  assert(adapted.grounding);
  return adapted.grounding;
}

function projectionInput(
  rubric: QuestionResourceRubricItem[],
  gap: TaskRequirementCoverage['gapReasonCode'],
  actionCode: string,
): RubricFeedbackProjectionBuildInput {
  const requirementType = gap === 'missing_text_evidence'
    ? 'text_evidence'
    : gap === 'missing_reasoning_relation'
      ? 'reasoning_relation'
      : 'conclusion';
  const requirementCoverage: TaskRequirementCoverage[] = gap === 'missing_text_evidence'
    ? [coveredRequirement('requirement-covered', 'conclusion'), gapRequirement(requirementType, gap)]
    : gap === 'missing_reasoning_relation'
      ? [coveredRequirement('requirement-covered', 'text_evidence'), gapRequirement(requirementType, gap)]
      : [gapRequirement(requirementType, gap)];
  return {
    projectionContext: {
      questionVersionId: 'question-stage3-wave-a',
      rubricVersion: 'rubric-stage3-wave-a-v1',
      taskId: 'task-stage3-wave-a',
      learningRoundId: 'round-stage3-wave-a',
      executionSessionId: 'execution-stage3-wave-a',
      responseId: 'response-stage3-wave-a',
      formalDiagnosisId: 'diagnosis-stage3-wave-a',
    },
    responseFormat: 'short_text',
    taskRole: 'training',
    rubric,
    formalDiagnosisCommit: {
      schemaVersion: FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
      formalDiagnosisId: 'diagnosis-stage3-wave-a',
      requestId: 'request-stage3-wave-a',
      runId: 'run-stage3-wave-a',
      status: 'committed',
      committedAt: now,
      diagnosisResult: {
        taskType: 'open_response', correct: null, strategyUsed: 'partial_requirement',
        answerStatus: 'partially_meets', scoreBand: 'medium', mainAbility: '分析',
        relatedAbilities: ['理解'], surfaceError: '只完成部分要求', rootCause: '尚缺必要维度',
        errorType: '分析错误', abilityEvidence: ['已完成一部分'], diagnosisSummary: '部分完成',
        nextTraining: '补充剩余维度', confidence: 0.9,
      },
      validation: { passed: true, issues: [] },
    },
    diagnosisRunRecord: {
      schemaVersion: DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
      runId: 'run-stage3-wave-a', requestId: 'request-stage3-wave-a',
      studentId: 'student-stage3-wave-a', taskId: 'task-stage3-wave-a',
      executionSessionId: 'execution-stage3-wave-a', responseId: 'response-stage3-wave-a',
      executionMode: 'live', status: 'formal_result_committed', providerConfigId: 'provider-stage3-wave-a',
      providerRequestIds: ['provider-request-stage3-wave-a'], attemptCount: 1, repairOperations: [],
      promptVersion: 'prompt-stage3-wave-a', diagnosisSchemaVersion: 'diagnosis-result-v1', issues: [],
      startedAt: now, completedAt: now,
    },
    requirementCoverage,
    primaryGapRequirementId: 'requirement-main',
    verifiedStudentEvidenceRefs: {
      'requirement-main': ['evidence-main'],
      'requirement-covered': ['evidence-covered'],
    },
    rubricRequirementBindings: [{
      rubricItemId: WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID,
      requirementId: 'requirement-main',
      bindingSource: 'frozen_contract',
      feedbackActionCode: actionCode as RubricFeedbackActionCode,
    }],
  };
}

function gapRequirement(
  requirementType: TaskRequirementCoverage['requirementType'],
  gapReasonCode: TaskRequirementCoverage['gapReasonCode'],
): TaskRequirementCoverage {
  return {
    requirementId: 'requirement-main',
    requirementType,
    requirementText: '完成题干要求',
    required: true,
    status: 'partially_covered',
    studentEvidence: ['学生已完成一个维度'],
    taskEvidence: ['题干要求两个维度'],
    source: 'formal_diagnosis',
    gapReasonCode,
    gapMessage: '尚缺一个要求维度',
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

function contractedRubric(actionCode: RubricFeedbackActionCode): QuestionResourceRubricItem[] {
  return [{
    itemId: WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID,
    name: '完成主要阅读动作',
    description: '完成题干中尚未完成的要求。',
    abilityId: 'analysis',
    importance: 'critical',
    required: true,
    acceptedSignals: ['内部评分信号'],
    feedbackActionContract: {
      schemaVersion: RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
      actionCode,
      disclosurePolicy: 'operation_only',
    },
  }];
}

function educationalContent(value: ReturnType<typeof requireVersion>) {
  return structuredClone({
    materialVersionId: value.materialVersionId,
    progressionMetadata: value.progressionMetadata,
    taskId: value.taskId,
    title: value.title,
    questionStem: value.questionStem,
    questionType: value.questionType,
    responseFormat: value.responseFormat,
    options: value.options,
    choiceInteraction: value.choiceInteraction,
    assessmentMode: value.assessmentMode,
    answerAcceptance: value.answerAcceptance,
    rubric: value.rubric,
    minimumAnswerRequirement: value.minimumAnswerRequirement,
    abilityMetadata: value.abilityMetadata,
    source: value.source,
    tags: value.tags,
  });
}

function requireVersion(data: SharedFormalResourceData, resourceVersionId: string) {
  const value = data.questionResources.versions.find((item) => item.resourceVersionId === resourceVersionId);
  if (!value) throw new Error(`Version missing: ${resourceVersionId}`);
  return value;
}

async function readOptional(path: string): Promise<string | undefined> {
  try { return await readFile(path, 'utf8'); } catch { return undefined; }
}
