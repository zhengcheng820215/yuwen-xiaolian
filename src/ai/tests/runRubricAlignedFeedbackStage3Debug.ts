import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  buildStudentLearningNarrativeProjectionSelection,
  type StudentLearningNarrativeInput,
} from '../agents/studentLearningNarrativeAgent.ts';
import {
  DEFAULT_RUBRIC_ALIGNED_FEEDBACK_SURFACE_MODE,
  RUBRIC_ALIGNED_NARRATIVE_INTEGRATION_VERSION,
  resolveRubricAlignedFeedbackSurfaceMode,
  type RubricAlignedNarrativeInput,
} from '../agents/rubricAlignedNarrativeAdapter.ts';
import {
  toStudentLearningPresentation,
} from '../schemas/studentLearningNarrative.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { StudentLearningFeedback } from '../schemas/studentLearningFeedback.schema.ts';
import type { StudentResponse } from '../schemas/taskExecution.schema.ts';

const checks: Array<{ id: string; name: string; passed: boolean }> = [];
const store = new SharedFormalResourceStore();
const storeBefore = await store.read();
if (!storeBefore.initialized) throw new Error('Shared formal resource store is not initialized.');
const storeBeforeSerialized = JSON.stringify(storeBefore.data);

check('RG3-01', 'default surface mode is shadow', () => {
  assert.equal(DEFAULT_RUBRIC_ALIGNED_FEEDBACK_SURFACE_MODE, 'shadow');
  assert.equal(resolveRubricAlignedFeedbackSurfaceMode(), 'shadow');
});
check('RG3-02', 'unknown surface mode fails closed to shadow', () => {
  assert.equal(resolveRubricAlignedFeedbackSurfaceMode('unknown'), 'shadow');
});
check('RG3-03', 'legacy mode preserves full legacy projection', () => {
  const output = select('legacy');
  assert.equal(output.selectedSource, 'legacy');
  assert.equal(output.shadowProjection, undefined);
});
check('RG3-04', 'shadow mode computes candidate but displays legacy atomically', () => {
  const output = select('shadow');
  assert.equal(output.selectedSource, 'legacy');
  assert(output.shadowProjection?.validation.passed);
  assert.notDeepEqual(output.projection, output.shadowProjection);
});
check('RG3-05', 'student visible mode selects complete rubric projection package', () => {
  const output = select('student_visible');
  assert.equal(output.selectedSource, 'rubric_projection');
  assert.equal(output.fallbackUsed, false);
});
check('RG3-06', 'achieved statement comes only from acknowledged action', () => {
  assert.equal(selectVisible().projection.achieved?.text, '你已经写出了人物的心理判断。');
});
check('RG3-07', 'primary gap comes only from missing answer part', () => {
  assert.equal(selectVisible().projection.currentGap?.text, '还需要补上一处支持判断的材料依据。');
});
check('RG3-08', 'next action uses only first authorized operation', () => {
  const input = variant((value) => {
    value.rubricAlignedFeedback!.actionPlan.nextOperations = ['定位一处人物动作。', '再写出完整答案。'];
  });
  assert.equal(visible(input).projection.nextAction?.text, '定位一处人物动作。');
});
check('RG3-09', 'rubric narrative never displays response anchor', () => {
  assert.equal(selectVisible().projection.responseAnchor, undefined);
});
check('RG3-10', 'presentation contains current facts without internal identifiers', () => {
  const presentation = toStudentLearningPresentation(selectVisible().projection);
  const serialized = JSON.stringify(presentation);
  assert(presentation?.outcome?.achieved);
  assert(!/(projection-stage3|response-stage3|task-stage3|Rubric|Diagnosis|acceptedSignals)/.test(serialized));
});
check('RG3-11', 'complete coverage does not invent a gap', () => {
  const output = visible(completeInput());
  assert.equal(output.projection.currentGap, undefined);
});
check('RG3-12', 'complete coverage does not invent a repair action', () => {
  const output = visible(completeInput());
  assert.equal(output.projection.nextAction, undefined);
});
check('RG3-13', 'missing acknowledgement omits achieved section', () => {
  const input = variant((value) => { value.rubricAlignedFeedback!.actionPlan.acknowledgedAction = undefined; });
  assert.equal(visible(input).projection.achieved, undefined);
});
check('RG3-14', 'missing operation falls back to authorized thinking prompt', () => {
  const input = variant((value) => { value.rubricAlignedFeedback!.actionPlan.nextOperations = []; });
  assert.equal(visible(input).projection.nextAction?.text, '想一想哪一处动作能支持这个判断。');
});
check('RG3-15', 'student identity mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.context.studentId = 'other'; }), 'student');
});
check('RG3-16', 'round identity mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.context.learningRoundId = 'other'; }), 'round');
});
check('RG3-17', 'task identity mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.context.taskId = 'other'; }), 'task');
});
check('RG3-18', 'response identity mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.context.responseId = 'other'; }), 'response');
});
check('RG3-19', 'execution session mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.context.executionSessionId = 'other'; }), 'execution_session');
});
check('RG3-20', 'question version mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.context.questionVersionId = 'other'; }), 'question_version');
});
check('RG3-21', 'task role mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.taskRole = 'diagnosis'; }), 'task_role');
});
check('RG3-22', 'action-plan role mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.actionPlan.taskRole = 'diagnosis'; }), 'action_plan_role');
});
check('RG3-23', 'projection identity mismatch triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.grounding.sourceProjectionId = 'other'; }), 'projection_identity');
});
check('RG3-24', 'missing projection evidence link triggers whole-package fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.actionPlan.evidenceLinks = ['response-stage3']; }), 'projection_source');
});
check('RG3-25', 'invalid grounding schema triggers fallback', () => {
  expectFallback(variant((value) => {
    value.rubricAlignedFeedback!.grounding.feedbackDepth = 'scaffold';
    value.rubricAlignedFeedback!.grounding.sourceProjectionId = '';
  }), 'grounding_invalid');
});
check('RG3-26', 'failed action plan triggers fallback', () => {
  expectFallback(variant((value) => { value.rubricAlignedFeedback!.actionPlan.validation.passed = false; }), 'action_plan_invalid');
});
check('RG3-27', 'single choice always remains on independent legacy feedback path', () => {
  const input = variant((value) => { value.currentTask!.responseFormat = 'single_choice'; });
  expectFallback(input, 'single_choice');
});
check('RG3-28', 'valid retest exposes result only without repair gap or action', () => {
  const output = visible(independentInput('retest'));
  assert(output.projection.achieved);
  assert.equal(output.projection.currentGap, undefined);
  assert.equal(output.projection.nextAction, undefined);
});
check('RG3-29', 'valid transfer exposes result only without repair gap or action', () => {
  const output = visible(independentInput('transfer'));
  assert(output.projection.achieved);
  assert.equal(output.projection.currentGap, undefined);
  assert.equal(output.projection.nextAction, undefined);
});
check('RG3-30', 'retest with repair operation is rejected', () => {
  const input = independentInput('retest');
  input.rubricAlignedFeedback!.actionPlan.nextOperations = ['修改答案。'];
  expectFallback(input, 'independent_validation');
});
check('RG3-31', 'forbidden rubric disclosure field is rejected', () => {
  const input = variant((value) => {
    (value.rubricAlignedFeedback as RubricAlignedNarrativeInput & { acceptedSignals: string[] }).acceptedSignals = ['标准答案'];
  });
  expectFallback(input, 'forbidden_disclosure');
});
check('RG3-32', 'semantic answer composition is rejected atomically', () => {
  const input = variant((value) => {
    value.rubricAlignedFeedback!.actionPlan.acknowledgedAction = '答案是人物不舍。';
    value.rubricAlignedFeedback!.actionPlan.missingAnswerPart = '依据是人物停下脚步。';
    value.rubricAlignedFeedback!.actionPlan.nextOperations = ['这说明人物非常珍惜。'];
  });
  const output = visible(input);
  assert.equal(output.selectedSource, 'legacy');
  assert(output.issues.includes('rubric_narrative_answer_composition_disclosure_blocked'));
});
check('RG3-33', 'same input and mode produce deterministic selection', () => {
  assert.deepEqual(select('student_visible'), select('student_visible'));
});

const narrativeSource = await readFile(new URL('../agents/studentLearningNarrativeAgent.ts', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../../api/phase163LiveLearning.ts', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../../pages/Phase163LiveLearningWorkspace.jsx', import.meta.url), 'utf8');
check('RG3-34', 'new narrative path has no repository or durable write dependency', () => {
  assert(!/SharedFormalResourceStore|Repository|saveEvidence|saveProfile|GrowthMemoryRepository/.test(narrativeSource));
});
check('RG3-35', 'runtime selects one complete projection before presentation conversion', () => {
  assert(/buildStudentLearningNarrativeProjectionSelection/.test(apiSource));
  assert(/toStudentLearningPresentation\(narrativeSelection\.projection/.test(apiSource));
  assert(!/toStudentLearningPresentation\(narrativeSelection\.shadowProjection/.test(apiSource));
});
const storeAfter = await store.read();
check('RG3-36', 'student page consumes one presentation object and debug leaves resources unchanged', () => {
  assert(/state\.learningPresentation/.test(pageSource));
  assert.equal(storeAfter.revision, storeBefore.revision);
  assert.equal(JSON.stringify(storeAfter.data), storeBeforeSerialized);
});

console.log(JSON.stringify({
  stage: 'rubric-aligned-feedback-stage3',
  mode: 'narrative-and-student-surface-projection',
  surfaceDefault: DEFAULT_RUBRIC_ALIGNED_FEEDBACK_SURFACE_MODE,
  storeRevision: storeBefore.revision,
  checks,
  result: `${checks.filter((entry) => entry.passed).length}/${checks.length} PASS`,
}, null, 2));

function baseInput(): StudentLearningNarrativeInput {
  return {
    studentId: 'student-stage3',
    currentTask: task('training'),
    studentResponse: response(),
    feedback: feedback(),
    currentQuestionVersionId: 'question-version-stage3',
    rubricAlignedFeedback: integration(),
    rubricAlignedSurfaceMode: 'student_visible',
  };
}

function integration(): RubricAlignedNarrativeInput {
  return {
    integrationVersion: RUBRIC_ALIGNED_NARRATIVE_INTEGRATION_VERSION,
    sourceMode: 'rubric_projection',
    context: {
      studentId: 'student-stage3',
      learningRoundId: 'round-stage3',
      taskId: 'task-stage3',
      executionSessionId: 'execution-stage3',
      responseId: 'response-stage3',
      questionVersionId: 'question-version-stage3',
    },
    responseFormat: 'short_text',
    taskRole: 'training',
    projectionId: 'projection-stage3',
    grounding: {
      groundingVersion: 'student_visible_feedback_grounding_v1',
      acknowledgedStudentAction: '你已经写出了人物的心理判断。',
      primaryObservedGap: 'conclusion_without_evidence',
      safeClueLocator: '人物停下脚步这一处',
      nextThinkingAction: '定位一处能够支持当前判断的文本依据。',
      feedbackDepth: 'thinking_prompt',
      sourceProjectionId: 'projection-stage3',
    },
    actionPlan: {
      schemaVersion: 'student_feedback_action_plan_v1',
      studentId: 'student-stage3',
      learningRoundId: 'round-stage3',
      taskRole: 'training',
      feedbackDepth: 2,
      hintLevel: 'location',
      acknowledgedAction: '你已经写出了人物的心理判断。',
      missingAnswerPart: '还需要补上一处支持判断的材料依据。',
      thinkingPrompt: '想一想哪一处动作能支持这个判断。',
      nextOperations: ['回到人物停下脚步这一处，定位支持判断的动作。'],
      evidenceLinks: ['round-stage3', 'response-stage3', 'projection-stage3'],
      limitations: ['不形成长期能力结论。'],
      validation: {
        passed: true,
        actionGrounded: true,
        gapSpecific: true,
        operationsExecutable: true,
        disclosureAllowed: true,
        issues: [],
      },
    },
  };
}

function task(role: ConcreteLearningTask['taskRole']): ConcreteLearningTask {
  return {
    taskId: 'task-stage3',
    studentId: 'student-stage3',
    sourceType: 'matched_resource',
    targetAbilityId: 'reading.inference',
    targetAbilityName: '推理',
    taskRole: role,
    validationGoal: '观察依据与判断的关系',
    responseFormat: 'text',
    question: '人物为什么停下脚步？',
    answerRequirements: ['写出判断并引用依据'],
    scoringPoints: [],
    rubric: [],
    questionMetadata: {} as ConcreteLearningTask['questionMetadata'],
    expectedDiagnosisFocus: ['text_evidence'],
    createdAt: '2026-08-28T00:00:00.000Z',
  };
}

function response(): StudentResponse {
  return {
    responseId: 'response-stage3',
    executionSessionId: 'execution-stage3',
    studentId: 'student-stage3',
    taskId: 'task-stage3',
    answerText: '人物很不舍。',
    submittedAt: '2026-08-28T00:00:00.000Z',
    usedHint: false,
    hintCount: 0,
  };
}

function feedback(): StudentLearningFeedback {
  return {
    learningRoundId: 'round-stage3',
    studentId: 'student-stage3',
    stage: 'result',
    resultStatus: 'completed',
    headline: '反馈',
    summary: '已形成反馈。',
    whatYouDidWell: ['写出了人物心理。'],
    whatNeedsAttention: ['还需要补充材料依据。'],
    nextActionText: '补充一处材料依据。',
    guidance: { detailsToReview: [], revisionActions: ['补充一处材料依据。'] },
    thinkingReview: {
      requirementCoverage: [{
        requirementId: 'req-evidence',
        requirementType: 'text_evidence',
        requirementText: '引用材料依据',
        required: true,
        status: 'partially_covered',
        studentEvidence: ['人物很不舍'],
        taskEvidence: ['人物停下脚步'],
        source: 'formal_diagnosis',
        gapMessage: '还需要补充材料依据。',
        gapReasonCode: 'missing_text_evidence',
      }],
      coveredPoints: ['写出了人物心理。'],
      primaryGapRequirementId: 'req-evidence',
      primaryGap: '还需要补充材料依据。',
      missingPoints: ['还需要补充材料依据。'],
    },
    canRetry: false,
    canFinishRound: true,
    source: 'learning_round',
  };
}

function completeInput(): StudentLearningNarrativeInput {
  return variant((value) => {
    const aligned = value.rubricAlignedFeedback!;
    aligned.grounding = {
      groundingVersion: 'student_visible_feedback_grounding_v1',
      acknowledgedStudentAction: '你已经写出了判断并引用了材料依据。',
      feedbackDepth: 'result_only',
      sourceProjectionId: aligned.projectionId,
    };
    aligned.actionPlan.acknowledgedAction = '你已经写出了判断并引用了材料依据。';
    aligned.actionPlan.missingAnswerPart = undefined;
    aligned.actionPlan.thinkingPrompt = undefined;
    aligned.actionPlan.nextOperations = [];
    aligned.actionPlan.feedbackDepth = 1;
    aligned.actionPlan.hintLevel = 'none';
  });
}

function independentInput(role: 'retest' | 'transfer'): StudentLearningNarrativeInput {
  return variant((value) => {
    value.currentTask!.taskRole = role;
    const aligned = value.rubricAlignedFeedback!;
    aligned.taskRole = role;
    aligned.actionPlan.taskRole = role;
    aligned.grounding.feedbackDepth = 'result_only';
    aligned.grounding.safeClueLocator = undefined;
    aligned.grounding.nextThinkingAction = undefined;
    aligned.actionPlan.feedbackDepth = 1;
    aligned.actionPlan.hintLevel = 'none';
    aligned.actionPlan.thinkingPrompt = undefined;
    aligned.actionPlan.nextOperations = [];
  });
}

function variant(mutate: (input: StudentLearningNarrativeInput) => void): StudentLearningNarrativeInput {
  const input = structuredClone(baseInput());
  mutate(input);
  return input;
}

function select(mode: 'legacy' | 'shadow' | 'student_visible') {
  const input = baseInput();
  input.rubricAlignedSurfaceMode = mode;
  return buildStudentLearningNarrativeProjectionSelection(input);
}

function selectVisible() {
  return select('student_visible');
}

function visible(input: StudentLearningNarrativeInput) {
  input.rubricAlignedSurfaceMode = 'student_visible';
  return buildStudentLearningNarrativeProjectionSelection(input);
}

function expectFallback(input: StudentLearningNarrativeInput, issueFragment: string): void {
  const output = visible(input);
  assert.equal(output.selectedSource, 'legacy');
  assert.equal(output.fallbackUsed, true);
  assert(output.issues.some((issue) => issue.includes(issueFragment)), output.issues.join('|'));
}

function check(id: string, name: string, run: () => void): void {
  run();
  checks.push({ id, name, passed: true });
}
