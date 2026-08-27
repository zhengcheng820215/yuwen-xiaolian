import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  buildRubricFeedbackProjection,
  type RubricFeedbackProjectionBuildInput,
} from '../agents/rubricFeedbackProjectionAgent.ts';
import {
  DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
  FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
} from '../schemas/diagnosisRunRecord.schema.ts';
import { isRubricFeedbackProjection } from '../schemas/rubricFeedbackProjection.schema.ts';
import type { TaskRequirementCoverage } from '../schemas/studentLearningFeedback.schema.ts';

const checks: Array<{ id: string; name: string; passed: boolean }> = [];
const store = new SharedFormalResourceStore();
const storeBefore = await store.read();
if (!storeBefore.initialized) throw new Error('Shared formal resource store is not initialized.');
const storeBeforeSerialized = JSON.stringify(storeBefore.data);

check('RP1-01', 'committed diagnosis and aligned identity can build projection', () => {
  const output = buildRubricFeedbackProjection(baseInput());
  assert.equal(output.outcome, 'projected');
  assert.equal(output.projection?.projectionStatus, 'ready');
});

check('RP1-02', 'uncommitted diagnosis is not assessable', () => {
  const input = variant((value) => { value.formalDiagnosisCommit.status = 'review_required'; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'not_assessable');
  assert(issueCodes(output).includes('formal_diagnosis_not_committed'));
});

check('RP1-03', 'question identity mismatch rejects ready projection', () => {
  const input = variant((value) => { value.projectionContext.questionVersionId = ''; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'not_assessable');
  assert(issueCodes(output).includes('question_identity_mismatch'));
});

check('RP1-04', 'missing response identity rejects ready projection', () => {
  const input = variant((value) => { value.projectionContext.responseId = ''; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'not_assessable');
  assert(issueCodes(output).includes('response_identity_missing'));
});

check('RP1-05', 'duplicate rubric identity rejects projection', () => {
  const input = variant((value) => { value.rubric[1].itemId = value.rubric[0].itemId; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'not_assessable');
  assert(issueCodes(output).includes('rubric_identity_invalid'));
});

check('RP1-06', 'missing explicit binding stays limited without fuzzy matching', () => {
  const input = variant((value) => {
    value.rubricRequirementBindings = value.rubricRequirementBindings?.filter((item) => (
      item.rubricItemId !== 'rubric-evidence'
    ));
  });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'limited');
  assert(issueCodes(output).includes('rubric_requirement_binding_missing'));
});

check('RP1-07', 'same input produces identical projection and projection id', () => {
  const input = baseInput();
  assert.deepEqual(
    buildRubricFeedbackProjection(input),
    buildRubricFeedbackProjection(structuredClone(input)),
  );
});

buildRubricFeedbackProjection(baseInput());
buildRubricFeedbackProjection(baseInput());
const storeAfterRepeatedProjection = await store.read();
check('RP1-08', 'repeated projection leaves shared store revision unchanged', () => {
  const after = storeAfterRepeatedProjection;
  assert.equal(after.revision, storeBefore.revision);
});

check('RP1-09', 'covered item with verified evidence becomes achieved', () => {
  const output = buildRubricFeedbackProjection(baseInput());
  assert.equal(item(output, 'rubric-conclusion')?.coverageStatus, 'achieved');
});

check('RP1-10', 'covered item without verified reference is not assessable', () => {
  const input = variant((value) => { value.verifiedStudentEvidenceRefs['req-conclusion'] = []; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(item(output, 'rubric-conclusion')?.coverageStatus, 'not_assessable');
  assert(issueCodes(output).includes('coverage_evidence_missing'));
});

check('RP1-11', 'formal partial coverage becomes partially achieved', () => {
  const output = buildRubricFeedbackProjection(baseInput());
  assert.equal(item(output, 'rubric-evidence')?.coverageStatus, 'partially_achieved');
});

check('RP1-12', 'partial coverage without formal source is rejected', () => {
  const input = variant((value) => { coverage(value, 'req-evidence').source = 'task_requirement'; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(item(output, 'rubric-evidence')?.coverageStatus, 'not_assessable');
  assert(issueCodes(output).includes('coverage_source_not_formal'));
});

check('RP1-13', 'formal missing coverage becomes missing', () => {
  const input = variant((value) => {
    coverage(value, 'req-evidence').status = 'missing';
    value.verifiedStudentEvidenceRefs['req-evidence'] = [];
  });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(item(output, 'rubric-evidence')?.coverageStatus, 'missing');
});

check('RP1-14', 'insufficient coverage stays not assessable without gap', () => {
  const input = variant((value) => {
    const target = coverage(value, 'req-evidence');
    target.status = 'insufficient_to_judge';
    target.gapReasonCode = 'insufficient_to_judge';
  });
  const projected = item(buildRubricFeedbackProjection(input), 'rubric-evidence');
  assert.equal(projected?.coverageStatus, 'not_assessable');
  assert.equal(projected?.observedGap, undefined);
});

check('RP1-15', 'projection trusts formal semantic acceptance instead of keywords', () => {
  const input = variant((value) => {
    value.rubric[0].acceptedSignals = ['标准词'];
    coverage(value, 'req-conclusion').studentEvidence = ['学生使用了非标准但已被正式诊断接受的同义表达'];
  });
  assert.equal(
    item(buildRubricFeedbackProjection(input), 'rubric-conclusion')?.coverageStatus,
    'achieved',
  );
});

check('RP1-16', 'free-text scope wording cannot create scope_misaligned', () => {
  const input = variant((value) => {
    const target = coverage(value, 'req-evidence');
    target.gapReasonCode = 'conclusion_inconsistent';
    target.gapMessage = '回答范围似乎偏离题目限定对象。';
  });
  const projected = item(buildRubricFeedbackProjection(input), 'rubric-evidence');
  assert.equal(projected?.coverageStatus, 'not_assessable');
  assert.notEqual(projected?.observedGap, 'scope_misaligned');
});

check('RP1-17', 'valid formal primary gap selects corresponding item', () => {
  const output = buildRubricFeedbackProjection(baseInput());
  assert.equal(output.projection?.primaryItemId, 'rubric-evidence');
});

check('RP1-18', 'non-actionable critical item does not beat actionable item', () => {
  const input = variant((value) => {
    value.rubric.push(rubricItem('rubric-critical-unsupported', '高权重但不可行动', 'critical'));
    value.requirementCoverage.push(requirement(
      'req-critical-unsupported',
      'reasoning_relation',
      'missing',
      'conclusion_inconsistent',
    ));
    value.rubricRequirementBindings?.push(binding(
      'rubric-critical-unsupported',
      'req-critical-unsupported',
    ));
    value.primaryGapRequirementId = undefined;
  });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.projection?.primaryItemId, 'rubric-evidence');
});

check('RP1-19', 'earlier actionable partial precedes later missing responsibility', () => {
  const input = withRelationRequirement(baseInput());
  input.primaryGapRequirementId = undefined;
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.projection?.primaryItemId, 'rubric-evidence');
});

check('RP1-20', 'ambiguous independent candidates stay limited', () => {
  const input = variant((value) => {
    value.primaryGapRequirementId = undefined;
    value.rubric.push(rubricItem('rubric-evidence-2', '补充第二项依据', 'important'));
    value.rubricRequirementBindings?.push(binding('rubric-evidence-2', 'req-evidence'));
  });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'limited');
  assert.equal(output.projection?.primaryItemId, undefined);
  assert(issueCodes(output).includes('multiple_primary_candidates_ambiguous'));
});

check('RP1-21', 'schema guard rejects achieved item as primary', () => {
  const projection = structuredClone(buildRubricFeedbackProjection(baseInput()).projection!);
  projection.primaryItemId = 'rubric-conclusion';
  assert.equal(isRubricFeedbackProjection(projection), false);
});

check('RP1-22', 'item requiring two independent repairs is not primary', () => {
  const input = variant((value) => {
    value.rubric = [rubricItem('rubric-combined', '依据与表达', 'critical')];
    value.requirementCoverage.push(requirement(
      'req-expression',
      'expression',
      'partially_covered',
      'incomplete_task_requirement',
    ));
    value.verifiedStudentEvidenceRefs['req-expression'] = ['response-fragment-expression'];
    value.rubricRequirementBindings = [
      binding('rubric-combined', 'req-evidence'),
      binding('rubric-combined', 'req-expression'),
    ];
    value.primaryGapRequirementId = 'req-evidence';
  });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.projection?.primaryItemId, undefined);
  assert(issueCodes(output).includes('primary_gap_not_actionable'));
});

check('RP1-23', 'single choice uses independent passthrough', () => {
  const input = variant((value) => { value.responseFormat = 'single_choice'; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'single_choice_passthrough');
  assert.equal(output.projection, undefined);
});

check('RP1-24', 'single choice with text rubric still stays passthrough', () => {
  const input = variant((value) => {
    value.responseFormat = 'single_choice';
    value.rubric[0].evidenceRequirement = {
      requireTextEvidence: true,
      requireExplanation: true,
    };
  });
  assert.equal(buildRubricFeedbackProjection(input).outcome, 'single_choice_passthrough');
});

check('RP1-25', 'retest projection remains internal and deterministic', () => {
  const input = variant((value) => { value.taskRole = 'retest'; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'projected');
  assert.equal(output.projection?.projectionStatus, 'ready');
});

check('RP1-26', 'initial and revised response identity cannot be mixed', () => {
  const input = variant((value) => { value.diagnosisRunRecord.responseId = 'response-revised'; });
  const output = buildRubricFeedbackProjection(input);
  assert.equal(output.outcome, 'not_assessable');
  assert(issueCodes(output).includes('runtime_identity_mismatch'));
});

check('RP1-27', 'failure returns structured outcome without throwing', () => {
  const input = variant((value) => { value.formalDiagnosisCommit.validation.passed = false; });
  assert.doesNotThrow(() => buildRubricFeedbackProjection(input));
  assert.equal(buildRubricFeedbackProjection(input).outcome, 'not_assessable');
});

const agentSource = await readFile(
  new URL('../agents/rubricFeedbackProjectionAgent.ts', import.meta.url),
  'utf8',
);
check('RP1-28', 'stage 1 agent does not consume grounding action plan or narrative', () => {
  assert(!/studentFeedbackGroundingAgent|studentFeedbackActionPlanAgent|studentLearningNarrativeAgent/.test(agentSource));
});

check('RP1-29', 'stage 1 agent does not write diagnosis evidence or profile repositories', () => {
  assert(!/Repository|abilityEvidence|StudentProfile|GrowthMemory/.test(agentSource));
});

const storeAfterFullDebug = await store.read();
check('RP1-30', 'full stage 1 debug leaves frozen resources and registry unchanged', () => {
  const after = storeAfterFullDebug;
  assert.equal(after.revision, storeBefore.revision);
  assert.equal(JSON.stringify(after.data), storeBeforeSerialized);
});

console.log(JSON.stringify({
  stage: 'rubric-aligned-feedback-stage1',
  mode: 'read-only-projection',
  storeRevision: storeBefore.revision,
  checks,
  result: `${checks.filter((item) => item.passed).length}/${checks.length} PASS`,
}, null, 2));

function baseInput(): RubricFeedbackProjectionBuildInput {
  return {
    projectionContext: {
      questionVersionId: 'question-version-stage1',
      rubricVersion: 'rubric-v1',
      taskId: 'task-stage1',
      learningRoundId: 'round-stage1',
      executionSessionId: 'execution-stage1',
      responseId: 'response-stage1',
      formalDiagnosisId: 'formal-diagnosis-stage1',
    },
    responseFormat: 'short_text',
    taskRole: 'training',
    rubric: [
      rubricItem('rubric-conclusion', '人物判断', 'critical'),
      rubricItem('rubric-evidence', '文本依据', 'important'),
    ],
    formalDiagnosisCommit: {
      schemaVersion: FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
      formalDiagnosisId: 'formal-diagnosis-stage1',
      requestId: 'request-stage1',
      runId: 'run-stage1',
      status: 'committed',
      committedAt: '2026-08-27T01:00:00.000Z',
      diagnosisResult: {
        taskType: 'open_response',
        correct: null,
        strategyUsed: 'text_evidence',
        answerStatus: 'partially_meets',
        scoreBand: 'medium',
        mainAbility: '分析',
        relatedAbilities: ['理解'],
        surfaceError: '缺少文本依据',
        rootCause: '当前回答没有写出支持判断的具体内容',
        errorType: '分析错误',
        abilityEvidence: ['已形成结论方向'],
        diagnosisSummary: '结论成立，文本依据不足',
        nextTraining: '补充文本依据',
        confidence: 0.9,
      },
      validation: { passed: true, issues: [] },
    },
    diagnosisRunRecord: {
      schemaVersion: DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
      runId: 'run-stage1',
      requestId: 'request-stage1',
      studentId: 'student-stage1',
      taskId: 'task-stage1',
      executionSessionId: 'execution-stage1',
      responseId: 'response-stage1',
      executionMode: 'live',
      status: 'formal_result_committed',
      providerConfigId: 'provider-config-stage1',
      providerRequestIds: ['provider-request-stage1'],
      attemptCount: 1,
      repairOperations: [],
      promptVersion: 'prompt-stage1',
      diagnosisSchemaVersion: 'diagnosis-result-v1',
      issues: [],
      startedAt: '2026-08-27T00:59:00.000Z',
      completedAt: '2026-08-27T01:00:00.000Z',
    },
    requirementCoverage: [
      requirement('req-conclusion', 'conclusion', 'covered'),
      requirement('req-evidence', 'text_evidence', 'partially_covered', 'missing_text_evidence'),
    ],
    primaryGapRequirementId: 'req-evidence',
    verifiedStudentEvidenceRefs: {
      'req-conclusion': ['response-fragment-conclusion'],
      'req-evidence': ['response-fragment-evidence'],
    },
    rubricRequirementBindings: [
      binding('rubric-conclusion', 'req-conclusion'),
      binding('rubric-evidence', 'req-evidence'),
    ],
  };
}

function withRelationRequirement(input: RubricFeedbackProjectionBuildInput): RubricFeedbackProjectionBuildInput {
  input.rubric.push(rubricItem('rubric-relation', '解释关系', 'important'));
  input.requirementCoverage.push(requirement(
    'req-relation',
    'reasoning_relation',
    'missing',
    'missing_reasoning_relation',
  ));
  input.verifiedStudentEvidenceRefs['req-relation'] = [];
  input.rubricRequirementBindings?.push(binding('rubric-relation', 'req-relation'));
  return input;
}

function rubricItem(
  itemId: string,
  name: string,
  importance: 'critical' | 'important' | 'supporting',
) {
  return {
    itemId,
    name,
    description: `${name}与当前题目要求的关系`,
    abilityId: 'analysis' as const,
    importance,
    required: true,
    acceptedSignals: [`${name}-accepted-signal`],
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
    studentEvidence: status === 'missing' ? [] : [`student evidence for ${requirementId}`],
    taskEvidence: [`task evidence for ${requirementId}`],
    source: 'formal_diagnosis',
    gapReasonCode,
    gapMessage: gapReasonCode ? `${gapReasonCode} message` : undefined,
  };
}

function binding(rubricItemId: string, requirementId: string) {
  return {
    rubricItemId,
    requirementId,
    bindingSource: 'formal_diagnosis' as const,
  };
}

function variant(
  mutate: (value: RubricFeedbackProjectionBuildInput) => void,
): RubricFeedbackProjectionBuildInput {
  const value = structuredClone(baseInput());
  mutate(value);
  return value;
}

function coverage(
  input: RubricFeedbackProjectionBuildInput,
  requirementId: string,
): TaskRequirementCoverage {
  const value = input.requirementCoverage.find((item) => item.requirementId === requirementId);
  if (!value) throw new Error(`Missing coverage ${requirementId}`);
  return value;
}

function item(
  output: ReturnType<typeof buildRubricFeedbackProjection>,
  rubricItemId: string,
) {
  return output.projection?.items.find((candidate) => candidate.rubricItemId === rubricItemId);
}

function issueCodes(output: ReturnType<typeof buildRubricFeedbackProjection>): string[] {
  return output.issues.map((entry) => entry.code);
}

function check(id: string, name: string, run: () => void): void {
  run();
  checks.push({ id, name, passed: true });
}
