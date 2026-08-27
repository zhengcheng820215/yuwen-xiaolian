import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  buildStudentVisibleFeedbackGroundingFromProjection,
  type RubricFeedbackGroundingAdapterInput,
} from '../agents/rubricFeedbackGroundingAdapter.ts';
import { buildStudentFeedbackActionPlan } from '../agents/studentFeedbackActionPlanAgent.ts';
import { buildStudentFeedbackGrounding } from '../agents/studentFeedbackGroundingAgent.ts';
import { buildStudentThinkingAnalysis } from '../agents/studentThinkingAnalysisAgent.ts';
import {
  RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION,
  containsForbiddenStudentVisibleKey,
  type RubricFeedbackProjection,
  type RubricFeedbackProjectionItem,
  type StudentVisibleFeedbackGrounding,
} from '../schemas/rubricFeedbackProjection.schema.ts';
import type {
  StudentLearningFeedback,
  TaskRequirementCoverage,
} from '../schemas/studentLearningFeedback.schema.ts';

const checks: Array<{ id: string; name: string; passed: boolean }> = [];
const store = new SharedFormalResourceStore();
const storeBefore = await store.read();
if (!storeBefore.initialized) throw new Error('Shared formal resource store is not initialized.');
const storeBeforeSerialized = JSON.stringify(storeBefore.data);

check('RG2-01', 'ready projection with aligned identity builds minimal grounding', () => {
  const output = adapt();
  assert.equal(output.outcome, 'grounded');
  assert.equal(output.grounding?.sourceProjectionId, 'projection-stage2');
});

check('RG2-02', 'limited projection stays on legacy path', () => {
  const input = adapterVariant((value) => { value.projection.projectionStatus = 'limited'; });
  const output = buildStudentVisibleFeedbackGroundingFromProjection(input);
  assert.equal(output.outcome, 'fallback');
  assert(issueCodes(output).includes('projection_not_ready'));
});

check('RG2-03', 'not assessable projection cannot create a concrete gap', () => {
  const input = adapterVariant((value) => { value.projection.projectionStatus = 'not_assessable'; });
  const output = buildStudentVisibleFeedbackGroundingFromProjection(input);
  assert.equal(output.outcome, 'fallback');
  assert.equal(output.grounding, undefined);
});

check('RG2-04', 'question version mismatch blocks projection path', () => {
  const input = adapterVariant((value) => { value.context.questionVersionId = 'question-wrong'; });
  const output = buildStudentVisibleFeedbackGroundingFromProjection(input);
  assert.equal(output.outcome, 'fallback');
  assert(issueCodes(output).includes('projection_context_identity_mismatch'));
});

check('RG2-05', 'response identity mismatch blocks projection path', () => {
  const input = adapterVariant((value) => { value.context.responseId = 'response-wrong'; });
  assert.equal(buildStudentVisibleFeedbackGroundingFromProjection(input).outcome, 'fallback');
});

check('RG2-06', 'session and round mismatch block projection path', () => {
  const session = adapterVariant((value) => { value.context.executionSessionId = 'session-wrong'; });
  const round = adapterVariant((value) => { value.context.learningRoundId = 'round-wrong'; });
  assert.equal(buildStudentVisibleFeedbackGroundingFromProjection(session).outcome, 'fallback');
  assert.equal(buildStudentVisibleFeedbackGroundingFromProjection(round).outcome, 'fallback');
});

check('RG2-07', 'unresolved verified evidence cannot create acknowledgement', () => {
  const input = adapterVariant((value) => { value.verifiedStudentEvidenceByRef = {}; });
  const output = buildStudentVisibleFeedbackGroundingFromProjection(input);
  assert.equal(output.outcome, 'fallback');
  assert.equal(output.grounding, undefined);
  assert(issueCodes(output).includes('verified_student_evidence_missing'));
});

check('RG2-08', 'same input is deterministic and does not change store revision', () => {
  const input = baseAdapterInput();
  assert.deepEqual(
    buildStudentVisibleFeedbackGroundingFromProjection(input),
    buildStudentVisibleFeedbackGroundingFromProjection(structuredClone(input)),
  );
  assert.equal(storeBefore.revision, storeBefore.revision);
});

check('RG2-09', 'fully achieved projection keeps one action and no repair gap', () => {
  const input = adapterVariant((value) => {
    value.projection.primaryItemId = undefined;
    value.projection.items = value.projection.items.map((item) => ({
      ...item,
      coverageStatus: 'achieved',
      observedGap: undefined,
      nextThinkingAction: undefined,
    }));
  });
  const output = buildStudentVisibleFeedbackGroundingFromProjection(input);
  assert.equal(output.outcome, 'grounded');
  assert(output.grounding?.acknowledgedStudentAction);
  assert.equal(output.grounding?.primaryObservedGap, undefined);
  assert.equal(output.grounding?.nextThinkingAction, undefined);
  assert.equal(output.grounding?.feedbackDepth, 'result_only');
});

check('RG2-10', 'conclusion without evidence yields one gap and one thinking action', () => {
  const grounding = requiredGrounding(adapt());
  assert.equal(grounding.primaryObservedGap, 'conclusion_without_evidence');
  assert.equal(grounding.nextThinkingAction, '定位一处能够支持当前判断的文本依据。');
});

check('RG2-11', 'evidence without explanation acknowledges evidence without giving relation answer', () => {
  const input = adapterVariant((value) => {
    const primary = projectionItem(value.projection, 'rubric-evidence');
    primary.observedGap = 'evidence_without_explanation';
    primary.nextThinkingAction = '说明这处依据为什么能支持当前判断。';
  });
  const grounding = requiredGrounding(buildStudentVisibleFeedbackGroundingFromProjection(input));
  assert(grounding.acknowledgedStudentAction?.includes('父亲站了很久'));
  assert(!JSON.stringify(grounding).includes('这说明父亲很珍惜树叶'));
});

check('RG2-12', 'multiple rubric items expose only the primary gap', () => {
  const input = adapterVariant((value) => {
    value.projection.items.push(item({
      rubricItemId: 'rubric-expression',
      requirementId: 'req-expression',
      coverageStatus: 'missing',
      observedGap: 'expression_not_organized',
      nextThinkingAction: '重新组织表达。',
    }));
  });
  const grounding = requiredGrounding(buildStudentVisibleFeedbackGroundingFromProjection(input));
  assert.equal(grounding.primaryObservedGap, 'conclusion_without_evidence');
  assert(!JSON.stringify(grounding).includes('expression_not_organized'));
});

check('RG2-13', 'accepted signals never enter student-visible grounding', () => {
  const input = baseAdapterInput() as RubricFeedbackGroundingAdapterInput & {
    projection: RubricFeedbackProjection & { acceptedSignals?: string[] };
  };
  input.projection.acceptedSignals = ['父亲珍惜树叶'];
  const grounding = requiredGrounding(buildStudentVisibleFeedbackGroundingFromProjection(input));
  assert.equal(containsForbiddenStudentVisibleKey(grounding), false);
  assert(!JSON.stringify(grounding).includes('acceptedSignals'));
});

check('RG2-14', 'semantic answer combination is blocked even through a legal field', () => {
  const input = adapterVariant((value) => {
    value.verifiedStudentEvidenceByRef['evidence-partial'] = '答案是A；依据是B；这说明C';
  });
  const output = buildStudentVisibleFeedbackGroundingFromProjection(input);
  assert.equal(output.outcome, 'fallback');
  assert(issueCodes(output).includes('student_visible_grounding_disclosure_blocked'));
});

check('RG2-15', 'missing safe clue does not trigger rubric inference', () => {
  const input = adapterVariant((value) => { value.safeClueLocatorByRequirementId = {}; });
  const grounding = requiredGrounding(buildStudentVisibleFeedbackGroundingFromProjection(input));
  assert.equal(grounding.safeClueLocator, undefined);
  assert.equal(grounding.nextThinkingAction, '定位一处能够支持当前判断的文本依据。');
});

check('RG2-16', 'first feedback scaffold request is downgraded', () => {
  const input = adapterVariant((value) => { value.feedbackDepth = 'scaffold'; });
  const output = buildStudentVisibleFeedbackGroundingFromProjection(input);
  assert.equal(output.grounding?.feedbackDepth, 'thinking_prompt');
  assert(issueCodes(output).includes('feedback_depth_downgraded'));
});

check('RG2-17', 'valid projection grounding has priority inside action plan', () => {
  const grounding = requiredGrounding(adapt());
  const output = actionPlan(grounding);
  assert.equal(output.acknowledgedAction, grounding.acknowledgedStudentAction);
  assert(output.evidenceLinks.includes(grounding.sourceProjectionId));
});

check('RG2-18', 'projection grounding without acknowledgement does not invent praise', () => {
  const projectionGrounding: StudentVisibleFeedbackGrounding = {
    groundingVersion: 'student_visible_feedback_grounding_v1',
    primaryObservedGap: 'scope_misaligned',
    nextThinkingAction: '核对题干限定的对象和范围。',
    feedbackDepth: 'thinking_prompt',
    sourceProjectionId: 'projection-no-ack',
  };
  const output = actionPlan(projectionGrounding, legacyFeedback());
  assert.equal(output.acknowledgedAction, undefined);
  assert.equal(output.whyItMatters, undefined);
});

check('RG2-19', 'projection grounding without gap creates no missing answer part', () => {
  const projectionGrounding: StudentVisibleFeedbackGrounding = {
    groundingVersion: 'student_visible_feedback_grounding_v1',
    acknowledgedStudentAction: '你已经写出了“父亲很珍惜树叶”。',
    feedbackDepth: 'result_only',
    sourceProjectionId: 'projection-complete',
  };
  const output = actionPlan(projectionGrounding);
  assert.equal(output.missingAnswerPart, undefined);
  assert.equal(output.nextOperations.length, 0);
});

check('RG2-20', 'one primary gap produces at most one next operation', () => {
  const output = actionPlan(requiredGrounding(adapt()));
  assert(output.nextOperations.length <= 1);
});

check('RG2-21', 'action plan cannot add a second projection gap', () => {
  const output = actionPlan(requiredGrounding(adapt()));
  assert.equal(output.nextOperations.length, 1);
  assert.equal((JSON.stringify(output).match(/primaryObservedGap/g) || []).length, 0);
  assert(!JSON.stringify(output).includes('expression_not_organized'));
});

check('RG2-22', 'invalid optional grounding preserves exact legacy action plan', () => {
  const legacy = actionPlan();
  const invalid = {
    groundingVersion: 'student_visible_feedback_grounding_v1',
    primaryObservedGap: 'unknown_gap',
    feedbackDepth: 'thinking_prompt',
    sourceProjectionId: 'projection-invalid',
  } as unknown as StudentVisibleFeedbackGrounding;
  assert.deepEqual(actionPlan(invalid), legacy);
});

check('RG2-23', 'correct single choice stays on independent feedback contract', () => {
  const input = adapterVariant((value) => { value.responseFormat = 'single_choice'; });
  assert.equal(buildStudentVisibleFeedbackGroundingFromProjection(input).outcome, 'single_choice_passthrough');
});

check('RG2-24', 'incorrect single choice also stays outside text rubric adapter', () => {
  const input = adapterVariant((value) => { value.responseFormat = 'single_choice'; });
  const output = buildStudentVisibleFeedbackGroundingFromProjection(input);
  assert.equal(output.grounding, undefined);
  assert(issueCodes(output).includes('single_choice_uses_independent_feedback_contract'));
});

check('RG2-25', 'retest grounding is result only without repair operation', () => {
  const input = adapterVariant((value) => { value.taskRole = 'retest'; });
  const grounding = requiredGrounding(buildStudentVisibleFeedbackGroundingFromProjection(input));
  assert.equal(grounding.feedbackDepth, 'result_only');
  assert.equal(actionPlan(grounding).nextOperations.length, 0);
});

check('RG2-26', 'transfer grounding is result only without answer clue', () => {
  const input = adapterVariant((value) => { value.taskRole = 'transfer'; });
  const grounding = requiredGrounding(buildStudentVisibleFeedbackGroundingFromProjection(input));
  assert.equal(grounding.feedbackDepth, 'result_only');
  assert.equal(grounding.safeClueLocator, undefined);
});

const actionPlanSource = await readFile(
  new URL('../agents/studentFeedbackActionPlanAgent.ts', import.meta.url),
  'utf8',
);
check('RG2-27', 'stage 2 does not modify revision eligibility', () => {
  assert(!/RevisionEligibility|buildRevisionEligibility|saveRevision/.test(actionPlanSource));
});

const narrativeSource = await readFile(
  new URL('../agents/studentLearningNarrativeAgent.ts', import.meta.url),
  'utf8',
);
check('RG2-28', 'student narrative and presentation remain disconnected in stage 2', () => {
  assert(!/projectionGrounding|RubricFeedbackProjection|StudentVisibleFeedbackGrounding/.test(narrativeSource));
});

const adapterSource = await readFile(
  new URL('../agents/rubricFeedbackGroundingAdapter.ts', import.meta.url),
  'utf8',
);
check('RG2-29', 'adapter has no diagnosis evidence or profile write dependency', () => {
  assert(!/Repository|SharedFormalResourceStore|saveEvidence|StudentProfile|GrowthMemory/.test(adapterSource));
});

const storeAfter = await store.read();
check('RG2-30', 'full stage 2 debug leaves frozen resources and registry unchanged', () => {
  assert.equal(storeAfter.revision, storeBefore.revision);
  assert.equal(JSON.stringify(storeAfter.data), storeBeforeSerialized);
});

console.log(JSON.stringify({
  stage: 'rubric-aligned-feedback-stage2',
  mode: 'minimal-grounding-action-plan-integration',
  storeRevision: storeBefore.revision,
  checks,
  result: `${checks.filter((entry) => entry.passed).length}/${checks.length} PASS`,
}, null, 2));

function baseAdapterInput(): RubricFeedbackGroundingAdapterInput {
  return {
    projection: {
      projectionVersion: RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION,
      projectionId: 'projection-stage2',
      questionVersionId: 'question-version-stage2',
      rubricVersion: 'rubric-v1',
      primaryItemId: 'rubric-evidence',
      projectionStatus: 'ready',
      items: [
        item({
          rubricItemId: 'rubric-conclusion',
          requirementId: 'req-conclusion',
          coverageStatus: 'achieved',
          studentEvidenceRefs: ['evidence-conclusion'],
        }),
        item({
          rubricItemId: 'rubric-evidence',
          requirementId: 'req-evidence',
          coverageStatus: 'partially_achieved',
          observedGap: 'conclusion_without_evidence',
          nextThinkingAction: '定位一处能够支持当前判断的文本依据。',
          studentEvidenceRefs: ['evidence-partial'],
        }),
      ],
    },
    context: {
      studentId: 'student-stage2',
      learningRoundId: 'round-stage2',
      taskId: 'task-stage2',
      executionSessionId: 'execution-stage2',
      responseId: 'response-stage2',
      questionVersionId: 'question-version-stage2',
    },
    responseFormat: 'short_text',
    taskRole: 'training',
    verifiedStudentEvidenceByRef: {
      'evidence-conclusion': '父亲很珍惜这片树叶',
      'evidence-partial': '父亲站了很久',
    },
    safeClueLocatorByRequirementId: {
      'req-evidence': '父亲捏着树叶站了很久',
    },
    feedbackDepth: 'thinking_prompt',
  };
}

function item(overrides: Partial<RubricFeedbackProjectionItem> & {
  rubricItemId: string;
  requirementId: string;
  coverageStatus: RubricFeedbackProjectionItem['coverageStatus'];
}): RubricFeedbackProjectionItem {
  return {
    rubricItemId: overrides.rubricItemId,
    requirementId: overrides.requirementId,
    importance: overrides.importance || 'important',
    coverageStatus: overrides.coverageStatus,
    studentEvidenceRefs: overrides.studentEvidenceRefs || [],
    taskRelation: overrides.taskRelation || '完成当前题目要求',
    observedGap: overrides.observedGap,
    nextThinkingAction: overrides.nextThinkingAction,
    sourceLinks: {
      questionVersionId: 'question-version-stage2',
      rubricVersion: 'rubric-v1',
      diagnosisId: overrides.coverageStatus === 'achieved' ? undefined : 'diagnosis-stage2',
      responseId: 'response-stage2',
      requirementId: overrides.requirementId,
      taskId: 'task-stage2',
      learningRoundId: 'round-stage2',
      executionSessionId: 'execution-stage2',
    },
  };
}

function adapterVariant(
  mutate: (input: RubricFeedbackGroundingAdapterInput) => void,
): RubricFeedbackGroundingAdapterInput {
  const input = structuredClone(baseAdapterInput());
  mutate(input);
  return input;
}

function projectionItem(
  projection: RubricFeedbackProjection,
  rubricItemId: string,
): RubricFeedbackProjectionItem {
  const value = projection.items.find((entry) => entry.rubricItemId === rubricItemId);
  if (!value) throw new Error(`Missing projection item ${rubricItemId}`);
  return value;
}

function adapt() {
  return buildStudentVisibleFeedbackGroundingFromProjection(baseAdapterInput());
}

function requiredGrounding(
  output: ReturnType<typeof buildStudentVisibleFeedbackGroundingFromProjection>,
): StudentVisibleFeedbackGrounding {
  assert.equal(output.outcome, 'grounded');
  assert(output.grounding);
  return output.grounding;
}

function actionPlan(
  projectionGrounding?: StudentVisibleFeedbackGrounding,
  feedback: StudentLearningFeedback = legacyFeedback(),
) {
  const grounding = buildStudentFeedbackGrounding(feedback);
  const studentResponse = {
    responseId: 'response-stage2',
    executionSessionId: 'execution-stage2',
    studentId: feedback.studentId,
    taskId: 'task-stage2',
    answerText: '父亲很珍惜这片树叶。',
    submittedAt: '2026-08-27T00:00:00.000Z',
    usedHint: false,
    hintCount: 0,
  };
  const thinkingAnalysis = buildStudentThinkingAnalysis(feedback, grounding, studentResponse);
  return buildStudentFeedbackActionPlan({
    feedback,
    grounding,
    thinkingAnalysis,
    studentResponse,
    taskRole: 'training',
    projectionGrounding,
  });
}

function legacyFeedback(): StudentLearningFeedback {
  return feedback([
    coverage('req-conclusion', 'conclusion', 'covered', ['父亲很珍惜这片树叶']),
    coverage('req-evidence', 'text_evidence', 'partially_covered', ['父亲站了很久'], {
      gapMessage: '还需要补充一处文本依据。',
      gapReasonCode: 'missing_text_evidence',
    }),
  ], 'req-evidence', '还需要补充一处文本依据。');
}

function feedback(
  requirementCoverage: TaskRequirementCoverage[],
  primaryGapRequirementId: string,
  primaryGap: string,
): StudentLearningFeedback {
  return {
    learningRoundId: 'round-stage2',
    studentId: 'student-stage2',
    stage: 'result',
    resultStatus: 'completed',
    headline: '反馈',
    summary: '反馈已形成。',
    whatYouDidWell: [],
    whatNeedsAttention: [primaryGap],
    nextActionText: '修改当前答案。',
    guidance: { detailsToReview: [], revisionActions: ['修改当前答案。'] },
    thinkingReview: {
      requirementCoverage,
      coveredPoints: [],
      primaryGapRequirementId,
      primaryGap,
      missingPoints: [primaryGap],
    },
    canRetry: false,
    canFinishRound: true,
    source: 'learning_round',
  };
}

function coverage(
  requirementId: string,
  requirementType: TaskRequirementCoverage['requirementType'],
  status: TaskRequirementCoverage['status'],
  studentEvidence: string[],
  overrides: Partial<TaskRequirementCoverage> = {},
): TaskRequirementCoverage {
  return {
    requirementId,
    requirementType,
    requirementText: `${requirementType} requirement`,
    required: true,
    status,
    studentEvidence,
    taskEvidence: ['父亲捏着树叶站了很久'],
    source: 'formal_diagnosis',
    ...overrides,
  };
}

function issueCodes(
  output: ReturnType<typeof buildStudentVisibleFeedbackGroundingFromProjection>,
): string[] {
  return output.issues.map((entry) => entry.code);
}

function check(id: string, name: string, run: () => void): void {
  run();
  checks.push({ id, name, passed: true });
}
