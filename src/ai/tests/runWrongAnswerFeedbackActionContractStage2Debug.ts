import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  buildRubricFeedbackProjection,
  type RubricFeedbackProjectionBuildInput,
} from '../agents/rubricFeedbackProjectionAgent.ts';
import {
  buildStudentVisibleFeedbackGroundingFromProjection,
} from '../agents/rubricFeedbackGroundingAdapter.ts';
import {
  DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
  FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
} from '../schemas/diagnosisRunRecord.schema.ts';
import {
  RUBRIC_FEEDBACK_ACTION_CODES,
  RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
  isRubricFeedbackActionContract,
  type RubricFeedbackActionCode,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  containsForbiddenStudentVisibleKey,
} from '../schemas/rubricFeedbackProjection.schema.ts';
import type { TaskRequirementCoverage } from '../schemas/studentLearningFeedback.schema.ts';

const checks: Array<{ id: string; name: string; passed: true }> = [];
const targetSlice = JSON.parse(await readFile(
  new URL('./fixtures/wrong-answer-stage2-action-contract.fixture.json', import.meta.url),
  'utf8',
)) as {
  fixtureVersion: string;
  sourceFindingId: string;
  samples: Array<{
    sampleId: string;
    requirementId: string;
    actionCode: RubricFeedbackActionCode;
    safeClueLocator: string;
    expectedAction: string;
  }>;
};
const store = new SharedFormalResourceStore();
const storeBefore = await store.read();
const storeBeforeSerialized = JSON.stringify(storeBefore.data);

check('S2-D01', 'five action codes are closed and the frozen contract validates', () => {
  assert.deepEqual(RUBRIC_FEEDBACK_ACTION_CODES, [
    'verify_scope',
    'compare_elements',
    'reclassify_by_cue',
    'identify_object_action',
    'add_required_dimension',
  ]);
  assert(isRubricFeedbackActionContract({
    schemaVersion: RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
    actionCode: 'verify_scope',
    disclosurePolicy: 'operation_only',
  }));
  assert.equal(isRubricFeedbackActionContract({
    schemaVersion: RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
    actionCode: 'verify_scope',
    disclosurePolicy: 'operation_only',
    answerHint: 'not allowed',
  }), false);
});

check('S2-D02', 'unknown action code preserves the exact legacy action', () => {
  const input = withAction(baseInput(), 'verify_scope');
  (input.rubricRequirementBindings![0] as { feedbackActionCode?: string }).feedbackActionCode = 'unknown';
  const output = project(input);
  assert.equal(primaryAction(output), legacyAction());
  assert(issueCodes(output).includes('feedback_action_contract_invalid'));
});

check('S2-D03', 'formal-diagnosis binding cannot authorize a frozen action code', () => {
  const input = withAction(baseInput(), 'verify_scope');
  input.rubricRequirementBindings![0].bindingSource = 'formal_diagnosis';
  const output = project(input);
  assert.equal(primaryAction(output), legacyAction());
  assert(issueCodes(output).includes('feedback_action_contract_invalid'));
});

check('S2-D04', 'action code without explicit requirement binding is not consumed', () => {
  const input = withAction(baseInput(), 'verify_scope');
  input.rubricRequirementBindings = [];
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'not_assessable');
  assert.equal(output.projection?.primaryItemId, undefined);
});

check('S2-D05', 'conflicting action codes fail closed to the legacy action', () => {
  const input = withAction(baseInput(), 'verify_scope');
  input.rubricRequirementBindings!.push({
    rubricItemId: 'rubric-main',
    requirementId: 'req-main',
    bindingSource: 'frozen_contract',
    feedbackActionCode: 'compare_elements',
  });
  const output = project(input);
  assert.equal(primaryAction(output), legacyAction());
  assert(issueCodes(output).includes('feedback_action_contract_conflict'));
});

check('S2-D06', 'action code on a non-primary achieved item cannot change the primary action', () => {
  const input = baseInput();
  input.rubric.push(rubric('rubric-achieved', '已完成项'));
  input.requirementCoverage.push(requirement('req-achieved', 'conclusion', 'covered'));
  input.verifiedStudentEvidenceRefs['req-achieved'] = ['evidence-achieved'];
  input.rubricRequirementBindings!.push({
    rubricItemId: 'rubric-achieved',
    requirementId: 'req-achieved',
    bindingSource: 'frozen_contract',
    feedbackActionCode: 'verify_scope',
  });
  assert.equal(primaryAction(project(input)), legacyAction());
});

check('S2-D07', 'conclusion-without-evidence action remains unchanged', () => {
  const input = evidenceGapInput('missing_text_evidence');
  input.rubricRequirementBindings![0].feedbackActionCode = 'verify_scope';
  assert.equal(primaryAction(project(input)), '定位一条能够支持当前判断的文本依据。');
});

check('S2-D08', 'evidence-without-explanation action remains unchanged', () => {
  const input = evidenceGapInput('missing_reasoning_relation');
  input.rubricRequirementBindings![0].feedbackActionCode = 'compare_elements';
  assert.equal(primaryAction(project(input)), '说明已找到的依据与当前判断之间的关系。');
});

const expectedActions: Record<RubricFeedbackActionCode, string> = {
  verify_scope: '核对这一处是否符合题干限定的语境和对象。',
  compare_elements: '比较两个对象及其关键差异。',
  reclassify_by_cue: '根据触发词重新核对分类。',
  identify_object_action: '指出这一处被写成人的对象及其动作。',
  add_required_dimension: '选择一个尚未完成的要求维度补充说明。',
};

RUBRIC_FEEDBACK_ACTION_CODES.forEach((code, index) => {
  check(`S2-D${String(index + 9).padStart(2, '0')}`, `${code} maps to one fixed thinking action`, () => {
    assert.equal(primaryAction(project(withAction(baseInput(), code))), expectedActions[code]);
  });
});

check('S2-D14', 'a contracted action remains useful without a safe clue locator', () => {
  const output = grounded(withAction(baseInput(), 'compare_elements'));
  assert.equal(output.safeClueLocator, undefined);
  assert.equal(output.nextThinkingAction, expectedActions.compare_elements);
});

check('S2-D15', 'unsafe or overlong clue text is omitted without changing the contracted action', () => {
  for (const clue of [
    '答案是人物不舍，这说明关系成立。',
    '这是一条超过四十八个字符且不应进入学生可见反馈的定位文本，因为它已经超出了最小线索边界并可能形成额外提示通道',
  ]) {
    const output = grounded(withAction(baseInput(), 'verify_scope'), clue);
    assert.equal(output.safeClueLocator, undefined);
    assert.equal(output.nextThinkingAction, expectedActions.verify_scope);
  }
});

check('S2-D16', 'student-visible grounding contains neither action code nor rubric answer signals', () => {
  const output = grounded(withAction(baseInput(), 'identify_object_action'), '第③段的对象和动作');
  const serialized = JSON.stringify(output);
  assert(!serialized.includes('identify_object_action'));
  assert(!serialized.includes('acceptedSignals'));
  assert(!serialized.includes('标准答案模板'));
  assert.equal(containsForbiddenStudentVisibleKey(output), false);
});

check('S2-D17', 'single choice remains on its independent feedback contract', () => {
  const input = withAction(baseInput(), 'reclassify_by_cue');
  input.responseFormat = 'single_choice';
  assert.equal(buildRubricFeedbackProjection(input).outcome, 'single_choice_passthrough');
});

check('S2-D18', 'blank or insufficient evidence remains not assessable', () => {
  const input = withAction(baseInput(), 'verify_scope');
  input.requirementCoverage[0].status = 'insufficient_to_judge';
  input.requirementCoverage[0].studentEvidence = [];
  input.requirementCoverage[0].gapReasonCode = 'insufficient_to_judge';
  input.verifiedStudentEvidenceRefs['req-main'] = [];
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'not_assessable');
  assert.equal(output.projection?.primaryItemId, undefined);
});

check('S2-D19', 'limited projection cannot force a student-visible action', () => {
  const input = withAction(baseInput(), 'verify_scope');
  input.rubric.push(rubric('rubric-unbound', '未绑定评分项'));
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'limited');
  assert(issueCodes(output).includes('rubric_requirement_binding_missing'));
  const adapted = buildStudentVisibleFeedbackGroundingFromProjection({
    projection: output.projection!,
    context: {
      studentId: 'student-stage2-action',
      learningRoundId: input.projectionContext.learningRoundId,
      taskId: input.projectionContext.taskId,
      executionSessionId: input.projectionContext.executionSessionId,
      responseId: input.projectionContext.responseId,
      questionVersionId: input.projectionContext.questionVersionId,
    },
    responseFormat: input.responseFormat,
    taskRole: input.taskRole,
    verifiedStudentEvidenceByRef: { 'evidence-main': '学生已完成一个维度' },
    feedbackDepth: 'thinking_prompt',
  });
  assert.equal(adapted.outcome, 'fallback');
  assert.equal(adapted.grounding, undefined);
});

check('S2-D20', 'retest and transfer keep result-only grounding', () => {
  for (const role of ['retest', 'transfer'] as const) {
    const input = withAction(baseInput(), 'add_required_dimension');
    input.taskRole = role;
    assert.equal(grounded(input).feedbackDepth, 'result_only');
  }
});

check('S2-D21', 'projection and grounding are deterministic for the same input', () => {
  const input = withAction(baseInput(), 'identify_object_action');
  assert.deepEqual(project(input), project(structuredClone(input)));
  assert.deepEqual(grounded(input), grounded(structuredClone(input)));
});

check('S2-D22', 'five strict shadow findings receive five specific intents and zero generic actions', () => {
  assert.equal(targetSlice.fixtureVersion, 'wrong_answer_stage2_action_contract_fixture_v1');
  assert.equal(targetSlice.sourceFindingId, 'WA-S1-F01');
  assert.equal(targetSlice.samples.length, 5);
  const actions = targetSlice.samples.map((sample) => {
    const input = withAction(baseInput(), sample.actionCode);
    input.requirementCoverage[0].requirementId = sample.requirementId;
    input.primaryGapRequirementId = sample.requirementId;
    input.verifiedStudentEvidenceRefs = { [sample.requirementId]: ['evidence-main'] };
    input.rubricRequirementBindings![0].requirementId = sample.requirementId;
    const output = grounded(input, sample.safeClueLocator);
    assert.equal(output.safeClueLocator, sample.safeClueLocator);
    assert.equal(output.nextThinkingAction, sample.expectedAction);
    return output.nextThinkingAction!;
  });
  assert.equal(actions.filter((action) => action !== legacyAction()).length, 5);
  assert.equal(actions.filter((action) => action === legacyAction()).length, 0);
  assert.equal(actions.filter((action) => /答案是|依据是|这说明/.test(action)).length, 0);
});

check('S2-D23', 'resource without the optional contract preserves legacy projection behavior', () => {
  const output = project(baseInput());
  assert.equal(primaryAction(output), legacyAction());
  assert(!issueCodes(output).some((code) => code.startsWith('feedback_action_contract_')));
});

const storeAfter = await store.read();
check('S2-D24', 'full Stage 2 debug leaves frozen resources and store revision unchanged', () => {
  assert.equal(storeAfter.revision, storeBefore.revision);
  assert.equal(JSON.stringify(storeAfter.data), storeBeforeSerialized);
});

console.log(JSON.stringify({
  stage: 'wrong-answer-feedback-action-contract-stage2',
  mode: 'isolated-read-only-debug',
  storeRevision: storeBefore.revision,
  checks,
  result: `${checks.length}/${checks.length} PASS`,
}, null, 2));

function baseInput(): RubricFeedbackProjectionBuildInput {
  return {
    projectionContext: {
      questionVersionId: 'question-stage2-action',
      rubricVersion: 'rubric-stage2-action-v1',
      taskId: 'task-stage2-action',
      learningRoundId: 'round-stage2-action',
      executionSessionId: 'execution-stage2-action',
      responseId: 'response-stage2-action',
      formalDiagnosisId: 'diagnosis-stage2-action',
    },
    responseFormat: 'short_text',
    taskRole: 'training',
    rubric: [rubric('rubric-main', '完成题干要求')],
    formalDiagnosisCommit: {
      schemaVersion: FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
      formalDiagnosisId: 'diagnosis-stage2-action',
      requestId: 'request-stage2-action',
      runId: 'run-stage2-action',
      status: 'committed',
      committedAt: '2026-09-10T02:00:00.000Z',
      diagnosisResult: {
        taskType: 'open_response',
        correct: null,
        strategyUsed: 'partial_requirement',
        answerStatus: 'partially_meets',
        scoreBand: 'medium',
        mainAbility: '分析',
        relatedAbilities: ['理解'],
        surfaceError: '只完成部分要求',
        rootCause: '一个必要维度尚未完成',
        errorType: '分析错误',
        abilityEvidence: ['已经完成一个要求维度'],
        diagnosisSummary: '部分完成题干要求',
        nextTraining: '完成剩余要求维度',
        confidence: 0.9,
      },
      validation: { passed: true, issues: [] },
    },
    diagnosisRunRecord: {
      schemaVersion: DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
      runId: 'run-stage2-action',
      requestId: 'request-stage2-action',
      studentId: 'student-stage2-action',
      taskId: 'task-stage2-action',
      executionSessionId: 'execution-stage2-action',
      responseId: 'response-stage2-action',
      executionMode: 'live',
      status: 'formal_result_committed',
      providerConfigId: 'provider-stage2-action',
      providerRequestIds: ['provider-request-stage2-action'],
      attemptCount: 1,
      repairOperations: [],
      promptVersion: 'prompt-stage2-action',
      diagnosisSchemaVersion: 'diagnosis-result-v1',
      issues: [],
      startedAt: '2026-09-10T01:59:00.000Z',
      completedAt: '2026-09-10T02:00:00.000Z',
    },
    requirementCoverage: [
      requirement('req-main', 'conclusion', 'partially_covered', 'incomplete_task_requirement'),
    ],
    primaryGapRequirementId: 'req-main',
    verifiedStudentEvidenceRefs: { 'req-main': ['evidence-main'] },
    rubricRequirementBindings: [{
      rubricItemId: 'rubric-main',
      requirementId: 'req-main',
      bindingSource: 'frozen_contract',
    }],
  };
}

function evidenceGapInput(
  gap: 'missing_text_evidence' | 'missing_reasoning_relation',
): RubricFeedbackProjectionBuildInput {
  const input = baseInput();
  if (gap === 'missing_text_evidence') {
    input.requirementCoverage = [
      requirement('req-covered', 'conclusion', 'covered'),
      requirement('req-main', 'text_evidence', 'partially_covered', gap),
    ];
    input.verifiedStudentEvidenceRefs['req-covered'] = ['evidence-covered'];
  } else {
    input.requirementCoverage = [
      requirement('req-covered', 'text_evidence', 'covered'),
      requirement('req-main', 'reasoning_relation', 'partially_covered', gap),
    ];
    input.verifiedStudentEvidenceRefs['req-covered'] = ['evidence-covered'];
  }
  return input;
}

function withAction(
  input: RubricFeedbackProjectionBuildInput,
  actionCode: RubricFeedbackActionCode,
): RubricFeedbackProjectionBuildInput {
  const value = structuredClone(input);
  value.rubric[0].feedbackActionContract = {
    schemaVersion: RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
    actionCode,
    disclosurePolicy: 'operation_only',
  };
  value.rubricRequirementBindings![0].feedbackActionCode = actionCode;
  return value;
}

function project(input: RubricFeedbackProjectionBuildInput) {
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'projected');
  assert(output.projection);
  return output;
}

function grounded(input: RubricFeedbackProjectionBuildInput, clue?: string) {
  const output = project(input);
  const result = buildStudentVisibleFeedbackGroundingFromProjection({
    projection: output.projection!,
    context: {
      studentId: 'student-stage2-action',
      learningRoundId: input.projectionContext.learningRoundId,
      taskId: input.projectionContext.taskId,
      executionSessionId: input.projectionContext.executionSessionId,
      responseId: input.projectionContext.responseId,
      questionVersionId: input.projectionContext.questionVersionId,
    },
    responseFormat: input.responseFormat,
    taskRole: input.taskRole,
    verifiedStudentEvidenceByRef: {
      'evidence-main': '学生已经完成了一个要求维度',
      'evidence-covered': '学生已写出相关判断',
      'evidence-secondary': '学生也完成了另一项要求',
      'evidence-achieved': '学生完成了非主要项',
    },
    safeClueLocatorByRequirementId: clue && input.primaryGapRequirementId
      ? { [input.primaryGapRequirementId]: clue }
      : undefined,
    feedbackDepth: 'thinking_prompt',
  });
  assert.equal(result.outcome, 'grounded');
  assert(result.grounding);
  return result.grounding;
}

function rubric(itemId: string, name: string) {
  return {
    itemId,
    name,
    description: `${name}与当前题目要求的关系`,
    abilityId: 'analysis' as const,
    importance: 'critical' as const,
    required: true,
    acceptedSignals: ['标准答案模板不得进入学生可见反馈'],
  };
}

function requirement(
  requirementId: string,
  requirementType: TaskRequirementCoverage['requirementType'],
  status: TaskRequirementCoverage['status'],
  gapReasonCode?: TaskRequirementCoverage['gapReasonCode'],
): TaskRequirementCoverage {
  return {
    requirementId,
    requirementType,
    requirementText: `${requirementType} requirement`,
    required: true,
    status,
    studentEvidence: status === 'missing' ? [] : [`student evidence ${requirementId}`],
    taskEvidence: [`task evidence ${requirementId}`],
    source: 'formal_diagnosis',
    gapReasonCode,
    gapMessage: gapReasonCode ? `${gapReasonCode} message` : undefined,
  };
}

function primaryAction(output: ReturnType<typeof buildRubricFeedbackProjection>): string {
  const primary = output.projection?.items.find((item) => (
    item.rubricItemId === output.projection?.primaryItemId
  ));
  assert(primary?.nextThinkingAction);
  return primary.nextThinkingAction;
}

function legacyAction(): string {
  return '补齐同一任务要求中尚未完成的一个必要方面。';
}

function issueCodes(output: ReturnType<typeof buildRubricFeedbackProjection>): string[] {
  return output.issues.map((entry) => entry.code);
}

function check(id: string, name: string, run: () => void): void {
  run();
  checks.push({ id, name, passed: true });
}
