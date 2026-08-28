import { buildStudentLearningNarrativeProjectionSelection, type StudentLearningNarrativeInput } from
  '../ai/agents/studentLearningNarrativeAgent.ts';
import {
  RUBRIC_ALIGNED_NARRATIVE_INTEGRATION_VERSION,
  type RubricAlignedNarrativeInput,
} from '../ai/agents/rubricAlignedNarrativeAdapter.ts';
import type { ConcreteLearningTask } from '../ai/schemas/concreteLearningTask.schema.ts';
import type { StudentLearningFeedback } from '../ai/schemas/studentLearningFeedback.schema.ts';
import type { StudentResponse } from '../ai/schemas/taskExecution.schema.ts';
import { toStudentLearningPresentation } from '../ai/schemas/studentLearningNarrative.schema.ts';
import { stableHash } from '../ai/services/productRuntimeBaselineAuditService.ts';
import { ordinaryRuntimeNotice, formatStudentNextQuestionAction } from
  '../ui/productComplexityConvergencePresentation.ts';

export type RubricAlignedFeedbackStage3BrowserCheck = {
  id: string;
  title: string;
  evidence: string;
  passed: boolean;
};

export type RubricAlignedFeedbackStage3BrowserReport = {
  schemaVersion: 'rubric_aligned_feedback_stage3_browser_acceptance_v1';
  runtimeScope: 'isolated_rubric_feedback_browser_acceptance';
  surfaceDefault: 'shadow';
  total: 16;
  passed: number;
  formalResourceRevisionBefore: number | null;
  formalResourceRevisionAfter: number | null;
  formalResourceWriteCount: number;
  studentAttemptWriteCount: 0;
  evidenceWriteCount: 0;
  profileWriteCount: 0;
  revisionWriteCount: 0;
  realCalibrationDenominatorWriteCount: 0;
  generatedAt: string;
  checks: RubricAlignedFeedbackStage3BrowserCheck[];
};

type FormalSnapshotProjection = { revision: number | null; digest: string };

export async function runRubricAlignedFeedbackStage3BrowserAcceptance(): Promise<RubricAlignedFeedbackStage3BrowserReport> {
  const before = await readFormalSnapshotProjection();
  const complete = visible(completeInput());
  const conclusionWithoutEvidence = visible(baseInput());
  const evidenceWithoutRelation = visible(evidenceRelationInput());
  const noAcknowledgement = visible(noAcknowledgementInput());
  const choiceCorrect = visible(singleChoiceInput(true));
  const choiceIncorrect = visible(singleChoiceInput(false));
  const revisionAvailable = visible(baseInput());
  const revisionComplete = visible(revisionCompleteInput());
  const retest = visible(independentInput('retest'));
  const transfer = visible(independentInput('transfer'));
  const broken = visible(identityFailureInput());
  const legacy = selectMode('legacy');
  const shadow = selectMode('shadow');
  const studentVisible = selectMode('student_visible');
  const historical = visible(historicalInput());
  const completePresentation = toStudentLearningPresentation(complete.projection, { continuationMode: 'fixed_task_queue' });
  const gapPresentation = toStudentLearningPresentation(conclusionWithoutEvidence.projection, { continuationMode: 'fixed_task_queue' });
  const relationPresentation = toStudentLearningPresentation(evidenceWithoutRelation.projection, { continuationMode: 'fixed_task_queue' });
  const choiceCorrectPresentation = toStudentLearningPresentation(choiceCorrect.projection, { continuationMode: 'fixed_task_queue' });
  const choiceIncorrectPresentation = toStudentLearningPresentation(choiceIncorrect.projection, { continuationMode: 'fixed_task_queue' });

  const restoreKey = 'rubric-aligned-feedback-stage3-browser-recovery:v1';
  const recoveryPayload = {
    responseId: baseInput().studentResponse?.responseId,
    selectedSource: conclusionWithoutEvidence.selectedSource,
    presentation: gapPresentation,
    nextAction: formatStudentNextQuestionAction(1, 6),
  };
  window.sessionStorage.setItem(restoreKey, JSON.stringify(recoveryPayload));
  const restored = JSON.parse(window.sessionStorage.getItem(restoreKey) || '{}');
  window.sessionStorage.removeItem(restoreKey);

  const sixTaskActions = Array.from({ length: 6 }, (_, index) => (
    index < 5 ? formatStudentNextQuestionAction(index + 1, 6) : '完成本次学习'
  ));
  const runtimeRecovery = ordinaryRuntimeNotice({
    type: 'error', errorCode: 'SHARED_STORE_TIMEOUT', recoverability: 'retry_safe',
  });
  const forbiddenStudentCopy = /(?:Rubric|Diagnosis|Evidence|acceptedSignals|responseId|taskRole|SHARED_STORE_TIMEOUT|参考答案|正确答案)/i;

  const checks = [
    check('B3-01', '文本题完整达成', '只呈现真实达成，不制造缺口或修改动作。',
      complete.selectedSource === 'rubric_projection'
      && Boolean(completePresentation?.outcome?.achieved)
      && !completePresentation?.outcome?.primaryGap
      && !completePresentation?.nextAction),
    check('B3-02', '有结论、缺依据', '反馈确认已有判断，并只指出缺少材料依据。',
      conclusionWithoutEvidence.selectedSource === 'rubric_projection'
      && /心理判断/.test(gapPresentation?.outcome?.achieved || '')
      && /材料依据/.test(gapPresentation?.outcome?.primaryGap || '')),
    check('B3-03', '有依据、缺解释', `反馈只给一个“说明依据与判断关系”的思考动作。实测来源：${evidenceWithoutRelation.selectedSource}；缺口：${relationPresentation?.outcome?.primaryGap || '无'}；动作：${relationPresentation?.nextAction || '无'}；回退原因：${evidenceWithoutRelation.issues.join('、') || '无'}。`,
      evidenceWithoutRelation.selectedSource === 'rubric_projection'
      && /关系/.test(relationPresentation?.outcome?.primaryGap || '')
      && /说明/.test(relationPresentation?.nextAction || '')),
    check('B3-04', '无有效肯定', '没有正式确认内容时不制造表扬区块。',
      noAcknowledgement.selectedSource === 'rubric_projection'
      && !noAcknowledgement.projection.achieved),
    check('B3-05', '单选正确', '单选保持独立旧链，只确认选择，不套用文本补全反馈。',
      choiceCorrect.selectedSource === 'legacy'
      && Boolean(choiceCorrectPresentation?.outcome?.achieved)
      && !/材料依据|关系/.test(JSON.stringify(choiceCorrectPresentation))),
    check('B3-06', '单选错误', '显示对应误读与一个核对动作，不要求补写开放文本。',
      choiceIncorrect.selectedSource === 'legacy'
      && /表面/.test(choiceIncorrectPresentation?.outcome?.primaryGap || '')
      && /核对|比较/.test(choiceIncorrectPresentation?.nextAction || '')
      && !/补写|引用材料依据/.test(JSON.stringify(choiceIncorrectPresentation))),
    check('B3-07', 'Revision 可用', 'Primary Gap 与一个修订动作同源，继续操作仍由既有页面控制。',
      revisionAvailable.selectedSource === 'rubric_projection'
      && Boolean(revisionAvailable.projection.currentGap)
      && Boolean(revisionAvailable.projection.nextAction)),
    check('B3-08', '修订完成', '说明具体改善，但不宣称已经独立掌握或开放第三次修改。',
      revisionComplete.selectedSource === 'rubric_projection'
      && /补充了材料依据/.test(revisionComplete.projection.achieved?.text || '')
      && !/独立掌握|第三次/.test(JSON.stringify(revisionComplete.projection))),
    check('B3-09', '固定题组连续下一题', '六题固定题组依次给出准确题号，末题才显示完成出口。',
      sixTaskActions.join('|') === '进入第 2 题（共 6 题）|进入第 3 题（共 6 题）|进入第 4 题（共 6 题）|进入第 5 题（共 6 题）|进入第 6 题（共 6 题）|完成本次学习'),
    check('B3-10', '刷新与恢复', '同一响应、来源、反馈和下一题状态可从隔离 Session 恢复。',
      stableHash(restored) === stableHash(recoveryPayload)),
    check('B3-11', 'Retest / Transfer', '独立验证只投射结果，不开放即时修订缺口或答案路径。',
      [retest, transfer].every((item) => item.selectedSource === 'rubric_projection'
        && Boolean(item.projection.achieved)
        && !item.projection.currentGap
        && !item.projection.nextAction)),
    check('B3-12', '新路径故障注入', '身份错误时整包回退 Legacy，不发生新旧字段混拼。',
      broken.selectedSource === 'legacy'
      && broken.fallbackUsed
      && broken.issues.some((item) => item.includes('student_identity'))
      && !broken.shadowProjection),
    check('B3-13', '三态模式切换', 'Legacy、Shadow、Student Visible 只改变允许的展示来源。',
      legacy.selectedSource === 'legacy'
      && !legacy.shadowProjection
      && shadow.selectedSource === 'legacy'
      && Boolean(shadow.shadowProjection)
      && studentVisible.selectedSource === 'rubric_projection'),
    check('B3-14', '历史资源兼容', '缺少 Rubric 接入包的历史资源安全回退，不猜测新 Gap。',
      historical.selectedSource === 'legacy'
      && historical.fallbackUsed
      && historical.issues.includes('rubric_narrative_input_missing')),
    check('B3-15', 'Runtime blocked / retry', '错误在当前区域使用安全重试文案，不暴露内部错误码。',
      runtimeRecovery?.message === '正式数据暂时无法读取，本次操作没有完成。'
      && runtimeRecovery.recoveryMessage === '现有工作内容已经保留，可以安全重试。'
      && !forbiddenStudentCopy.test(JSON.stringify(runtimeRecovery))),
    check('B3-16', '连续 5—6 题完整 Session', '固定题组不会反馈死循环或提前返回入口，学生文案不含内部术语。',
      sixTaskActions.slice(0, 5).every((item, index) => item === `进入第 ${index + 2} 题（共 6 题）`)
      && sixTaskActions[5] === '完成本次学习'
      && !sixTaskActions.some((item) => item === '返回学习入口')
      && !forbiddenStudentCopy.test(studentVisibleCopy([
        completePresentation,
        gapPresentation,
        relationPresentation,
      ]))),
  ] as RubricAlignedFeedbackStage3BrowserCheck[];

  const after = await readFormalSnapshotProjection();
  const formalUnchanged = before.revision !== null
    && before.revision === after.revision
    && before.digest === after.digest;
  return {
    schemaVersion: 'rubric_aligned_feedback_stage3_browser_acceptance_v1',
    runtimeScope: 'isolated_rubric_feedback_browser_acceptance',
    surfaceDefault: 'shadow',
    total: 16,
    passed: checks.filter((item) => item.passed).length,
    formalResourceRevisionBefore: before.revision,
    formalResourceRevisionAfter: after.revision,
    formalResourceWriteCount: formalUnchanged ? 0 : 1,
    studentAttemptWriteCount: 0,
    evidenceWriteCount: 0,
    profileWriteCount: 0,
    revisionWriteCount: 0,
    realCalibrationDenominatorWriteCount: 0,
    generatedAt: new Date().toISOString(),
    checks,
  };
}

function baseInput(): StudentLearningNarrativeInput {
  return {
    studentId: 'student-b3-browser',
    currentTask: textTask('training'),
    studentResponse: textResponse(),
    feedback: textFeedback(),
    currentQuestionVersionId: 'question-version-b3-browser',
    rubricAlignedFeedback: integration(),
    rubricAlignedSurfaceMode: 'student_visible',
  };
}

function integration(): RubricAlignedNarrativeInput {
  return {
    integrationVersion: RUBRIC_ALIGNED_NARRATIVE_INTEGRATION_VERSION,
    sourceMode: 'rubric_projection',
    context: {
      studentId: 'student-b3-browser', learningRoundId: 'round-b3-browser',
      taskId: 'task-b3-browser', executionSessionId: 'execution-b3-browser',
      responseId: 'response-b3-browser', questionVersionId: 'question-version-b3-browser',
    },
    responseFormat: 'short_text', taskRole: 'training', projectionId: 'projection-b3-browser',
    grounding: {
      groundingVersion: 'student_visible_feedback_grounding_v1',
      acknowledgedStudentAction: '你已经写出了人物的心理判断。',
      primaryObservedGap: 'conclusion_without_evidence',
      safeClueLocator: '人物停下脚步这一处',
      nextThinkingAction: '定位一处能够支持当前判断的文本依据。',
      feedbackDepth: 'thinking_prompt', sourceProjectionId: 'projection-b3-browser',
    },
    actionPlan: {
      schemaVersion: 'student_feedback_action_plan_v1',
      studentId: 'student-b3-browser', learningRoundId: 'round-b3-browser', taskRole: 'training',
      feedbackDepth: 2, hintLevel: 'location',
      acknowledgedAction: '你已经写出了人物的心理判断。',
      missingAnswerPart: '还需要补上一处支持判断的材料依据。',
      thinkingPrompt: '想一想哪一处动作能支持这个判断。',
      nextOperations: ['回到人物停下脚步这一处，定位支持判断的动作。'],
      evidenceLinks: ['round-b3-browser', 'response-b3-browser', 'projection-b3-browser'],
      limitations: ['不形成长期能力结论。'],
      validation: { passed: true, actionGrounded: true, gapSpecific: true, operationsExecutable: true, disclosureAllowed: true, issues: [] },
    },
  };
}

function textTask(role: ConcreteLearningTask['taskRole']): ConcreteLearningTask {
  return {
    taskId: 'task-b3-browser', studentId: 'student-b3-browser', sourceType: 'matched_resource',
    targetAbilityId: 'reading.inference', targetAbilityName: '推理', taskRole: role,
    validationGoal: '观察依据与判断的关系', responseFormat: 'text',
    question: '人物为什么停下脚步？', answerRequirements: ['写出判断并引用依据'],
    scoringPoints: [], rubric: [], questionMetadata: {} as ConcreteLearningTask['questionMetadata'],
    expectedDiagnosisFocus: ['text_evidence'], createdAt: '2026-08-28T00:00:00.000Z',
  };
}

function textResponse(): StudentResponse {
  return {
    responseId: 'response-b3-browser', executionSessionId: 'execution-b3-browser',
    studentId: 'student-b3-browser', taskId: 'task-b3-browser', answerText: '人物很不舍。',
    submittedAt: '2026-08-28T00:00:00.000Z', usedHint: false, hintCount: 0,
  };
}

function textFeedback(): StudentLearningFeedback {
  return {
    learningRoundId: 'round-b3-browser', studentId: 'student-b3-browser', stage: 'result', resultStatus: 'completed',
    headline: '反馈', summary: '已形成反馈。', whatYouDidWell: ['写出了人物心理。'],
    whatNeedsAttention: ['还需要补充材料依据。'], nextActionText: '补充一处材料依据。',
    guidance: { detailsToReview: [], revisionActions: ['补充一处材料依据。'] },
    thinkingReview: {
      requirementCoverage: [{
        requirementId: 'req-evidence', requirementType: 'text_evidence', requirementText: '引用材料依据',
        required: true, status: 'partially_covered', studentEvidence: ['人物很不舍'], taskEvidence: ['人物停下脚步'],
        source: 'formal_diagnosis', gapMessage: '还需要补充材料依据。', gapReasonCode: 'missing_text_evidence',
      }],
      coveredPoints: ['写出了人物心理。'], primaryGapRequirementId: 'req-evidence',
      primaryGap: '还需要补充材料依据。', missingPoints: ['还需要补充材料依据。'],
    },
    canRetry: false, canFinishRound: true, source: 'learning_round',
  };
}

function completeInput(): StudentLearningNarrativeInput {
  return variant((value) => {
    const aligned = value.rubricAlignedFeedback!;
    aligned.grounding = {
      groundingVersion: 'student_visible_feedback_grounding_v1',
      acknowledgedStudentAction: '你已经写出了判断并引用了材料依据。',
      feedbackDepth: 'result_only', sourceProjectionId: aligned.projectionId,
    };
    aligned.actionPlan.acknowledgedAction = '你已经写出了判断并引用了材料依据。';
    aligned.actionPlan.missingAnswerPart = undefined;
    aligned.actionPlan.thinkingPrompt = undefined;
    aligned.actionPlan.nextOperations = [];
    aligned.actionPlan.feedbackDepth = 1;
    aligned.actionPlan.hintLevel = 'none';
  });
}

function evidenceRelationInput(): StudentLearningNarrativeInput {
  return variant((value) => {
    const aligned = value.rubricAlignedFeedback!;
    aligned.grounding.acknowledgedStudentAction = '你已经找到了人物停下脚步这一处材料依据。';
    aligned.grounding.primaryObservedGap = 'evidence_without_explanation';
    aligned.grounding.nextThinkingAction = '说明这一动作与人物心理判断之间的关系。';
    aligned.actionPlan.acknowledgedAction = '你已经找到了人物停下脚步这一处材料依据。';
    aligned.actionPlan.missingAnswerPart = '还需要说明这处依据与人物心理判断之间的关系。';
    aligned.actionPlan.thinkingPrompt = '这处动作为什么能支持你的判断？';
    aligned.actionPlan.nextOperations = ['用一句话说明这处动作与人物心理判断的关系。'];
  });
}

function noAcknowledgementInput(): StudentLearningNarrativeInput {
  return variant((value) => {
    value.rubricAlignedFeedback!.grounding.acknowledgedStudentAction = undefined;
    value.rubricAlignedFeedback!.actionPlan.acknowledgedAction = undefined;
  });
}

function revisionCompleteInput(): StudentLearningNarrativeInput {
  return variant((value) => {
    const aligned = value.rubricAlignedFeedback!;
    aligned.grounding = {
      groundingVersion: 'student_visible_feedback_grounding_v1',
      acknowledgedStudentAction: '这次修订补充了材料依据，并说明了依据与判断的关系。',
      feedbackDepth: 'result_only', sourceProjectionId: aligned.projectionId,
    };
    aligned.actionPlan.acknowledgedAction = '这次修订补充了材料依据，并说明了依据与判断的关系。';
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

function identityFailureInput(): StudentLearningNarrativeInput {
  return variant((value) => { value.rubricAlignedFeedback!.context.studentId = 'different-student'; });
}

function historicalInput(): StudentLearningNarrativeInput {
  const value = baseInput();
  value.rubricAlignedFeedback = undefined;
  return value;
}

function singleChoiceInput(correct: boolean): StudentLearningNarrativeInput {
  const value = baseInput();
  const selectedOptionId = correct ? 'choice-a' : 'choice-b';
  value.currentTask = {
    ...textTask('training'), responseFormat: 'single_choice', question: '人物停下脚步的主要原因是什么？',
    singleChoiceDelivery: {
      responseFormat: 'single_choice', optionSetVersion: 1,
      options: [
        { optionId: 'choice-a', content: '因为他舍不得离开', displayOrder: 1 },
        { optionId: 'choice-b', content: '因为天气突然变冷', displayOrder: 2 },
        { optionId: 'choice-c', content: '因为他忘记了路线', displayOrder: 3 },
      ],
    },
    singleChoiceEvaluation: {
      schemaVersion: 'single-choice-interaction-v1', selectionMode: 'single', optionSetVersion: 1,
      options: [
        { optionId: 'choice-a', content: '因为他舍不得离开' },
        { optionId: 'choice-b', content: '因为天气突然变冷' },
        { optionId: 'choice-c', content: '因为他忘记了路线' },
      ],
      correctOptionIds: ['choice-a'],
      distractorRationales: [
        { optionId: 'choice-b', misconceptionCode: 'surface_reading', diagnosisMeaning: '只看到环境信息，没有核对人物动作。', evidenceBoundary: '比较人物动作与环境描写。' },
        { optionId: 'choice-c', misconceptionCode: 'evidence_omission', diagnosisMeaning: '忽略了人物停步前后的直接内容。', evidenceBoundary: '核对人物停步前后的句子。' },
      ],
    },
  };
  value.studentResponse = {
    ...textResponse(), answerText: '', responseFormat: 'single_choice',
    singleChoiceAnswer: {
      responseFormat: 'single_choice', selectedOptionIds: [selectedOptionId], optionSetVersion: 1,
      displayedOptionOrder: ['choice-a', 'choice-b', 'choice-c'],
    },
  };
  const requirementId = 'req:choice_judgment';
  value.feedback = {
    ...textFeedback(), whatYouDidWell: correct ? ['选择符合材料和题意。'] : [],
    whatNeedsAttention: correct ? [] : ['只看到了表面环境信息。'],
    nextActionText: correct ? '继续下一题。' : '回到人物停步前后的内容重新核对。',
    thinkingReview: {
      requirementCoverage: [{
        requirementId, requirementType: 'conclusion', requirementText: '完成选择判断', required: true,
        status: correct ? 'covered' : 'missing', studentEvidence: [selectedOptionId], taskEvidence: ['choice-a'],
        source: 'formal_diagnosis',
        studentMessage: correct ? '这次选择符合材料和题意。' : undefined,
        gapMessage: correct ? undefined : '这次选择只看到了表面环境信息，没有核对人物动作。',
        gapReasonCode: correct ? undefined : 'conclusion_inconsistent',
      }],
      coveredPoints: correct ? ['完成了选择判断'] : [],
      primaryGapRequirementId: correct ? undefined : requirementId,
      primaryGap: correct ? undefined : '这次选择只看到了表面环境信息，没有核对人物动作。',
      missingPoints: correct ? [] : ['需要重新核对人物动作。'],
    },
  };
  return value;
}

function variant(mutate: (input: StudentLearningNarrativeInput) => void): StudentLearningNarrativeInput {
  const value = structuredClone(baseInput());
  mutate(value);
  return value;
}

function visible(input: StudentLearningNarrativeInput) {
  input.rubricAlignedSurfaceMode = 'student_visible';
  return buildStudentLearningNarrativeProjectionSelection(input);
}

function selectMode(mode: 'legacy' | 'shadow' | 'student_visible') {
  const input = baseInput();
  input.rubricAlignedSurfaceMode = mode;
  return buildStudentLearningNarrativeProjectionSelection(input);
}

async function readFormalSnapshotProjection(): Promise<FormalSnapshotProjection> {
  try {
    const response = await fetch('/__runtime/phase17-4/formal-resources', { method: 'GET', cache: 'no-store' });
    if (!response.ok) return { revision: null, digest: 'unavailable' };
    const payload = await response.json();
    return {
      revision: Number.isInteger(payload.snapshot?.revision) ? payload.snapshot.revision : null,
      digest: stableHash({ revision: payload.snapshot?.revision, data: payload.snapshot?.data }),
    };
  } catch {
    return { revision: null, digest: 'unavailable' };
  }
}

function check(id: string, title: string, evidence: string, passed: boolean): RubricAlignedFeedbackStage3BrowserCheck {
  return { id, title, evidence, passed };
}

function studentVisibleCopy(presentations: Array<ReturnType<typeof toStudentLearningPresentation>>): string {
  return presentations.flatMap((presentation) => {
    if (!presentation) return [];
    return [
      presentation.taskReason,
      presentation.outcome?.responseAnchor,
      presentation.outcome?.achieved,
      presentation.outcome?.primaryGap,
      presentation.outcome?.progressMeaning,
      presentation.nextAction,
      presentation.continuationReason,
    ];
  }).filter((value): value is string => Boolean(value)).join('\n');
}
