import { buildStudentLearningNarrativeProjection } from '../agents/studentLearningNarrativeAgent.ts';
import {
  toStudentLearningNarrative,
  toStudentLearningPresentation,
} from '../schemas/studentLearningNarrative.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { DelayedRetestPlan } from '../schemas/delayedRetestScheduling.schema.ts';
import type { EvidenceQualityAssessment } from '../schemas/evidenceQualityAssessment.schema.ts';
import type { GrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import type { NextLearningStrategy } from '../schemas/nextLearningStrategy.schema.ts';
import type { NextFormalTaskResolution } from '../schemas/realLearningOperation.schema.ts';
import type { StudentLearningFeedback } from '../schemas/studentLearningFeedback.schema.ts';
import type { StudentResponse } from '../schemas/taskExecution.schema.ts';
import { narrativeCalibrationSamples } from '../fixtures/narrativeCalibrationSamples.ts';

const STUDENT_ID = 'student-learning-narrative-debug';
type Report = { name: string; passed: boolean; detail: string };
const reports: Report[] = [];

function main(): void {
  check('N1 Training 解释当前练习目的且首轮不误写继续', {
    currentTask: task('training'),
  }, (result) => result.taskReason?.text.includes('这道题练习') === true &&
    !result.taskReason.text.includes('继续练习'));

  check('N2 Retest 解释间隔与独立完成', {
    currentTask: task('retest'),
  }, (result) => result.taskReason?.text.includes('间隔一段时间') === true && result.taskReason.text.includes('独立完成'));

  check('N3 Transfer 解释新材料迁移', {
    currentTask: task('transfer'),
  }, (result) => result.taskReason?.text.includes('换一份材料') === true && result.taskReason.text.includes('新内容'));

  check('N4 本轮反馈保留命中点、主要缺口与下一动作', {
    currentTask: task('training'),
    feedback: feedback(),
  }, (result) => Boolean(result.responseAnchor && result.achieved && result.currentGap && result.nextAction));

  check('N5 无可靠正向事实时不强造 achieved', {
    currentTask: task('training'),
    feedback: feedback({
      whatYouDidWell: [],
      thinkingReview: { coveredPoints: [], missingPoints: ['还缺少具体动作依据。'], primaryGap: '还缺少具体动作依据。' },
    }),
  }, (result) => result.achieved === undefined && result.currentGap?.text.includes('动作依据') === true);

  check('N6 正式匹配后才解释下一任务', {
    currentTask: task('training'),
    nextLearningStrategy: strategy('transfer'),
    nextTaskResolution: resolution('matched'),
  }, (result) => result.nextTaskReason?.text.includes('换一份材料') === true);

  check('N7 无匹配资源时不虚构下一任务原因', {
    currentTask: task('training'),
    nextLearningStrategy: strategy('training'),
    nextTaskResolution: resolution('no_match'),
  }, (result) => result.nextTaskReason === undefined);

  check('N8 没有正式可比事实时不生成进步结论', {
    currentTask: task('retest'),
    growthMemorySummary: growthMemory(),
  }, (result) => result.progressMeaning === undefined);

  check('N9 合法延迟独立观察只表达新增记录，不宣称掌握', {
    currentTask: task('retest'),
    evidenceQualityAssessment: qualityAssessment(),
    growthMemorySummary: growthMemory(),
    delayedRetestPlan: retestPlan(),
  }, (result) => result.progressMeaning?.text.includes('增加了一次可靠记录') === true &&
    !/掌握|已经提升|能力提高/.test(result.progressMeaning.text));

  const mismatch = buildStudentLearningNarrativeProjection({
    studentId: STUDENT_ID,
    currentTask: task('training'),
    feedback: feedback({ studentId: 'another-student' }),
  });
  reports.push({
    name: 'N10 身份错位阻断学生叙事投影',
    passed: !mismatch.validation.passed && !mismatch.validation.identityAligned && toStudentLearningNarrative(mismatch) === undefined,
    detail: mismatch.validation.issues.join('|'),
  });

  check('N11 学生视图不包含来源 ID 与内部枚举', {
    currentTask: task('training'),
    feedback: feedback(),
    nextLearningStrategy: strategy('training'),
    nextTaskResolution: resolution('matched'),
  }, (result) => {
    const view = toStudentLearningNarrative(result);
    const serialized = JSON.stringify(view);
    return Boolean(view) && !/strategy-|task-|requirement-|Evidence|Diagnosis|GrowthMemory|taskRole/.test(serialized);
  });

  check('N12 四问展示层按学习目的、结果、行动和继续原因组织', {
    currentTask: task('training'),
    feedback: feedback(),
    nextLearningStrategy: strategy('transfer'),
    nextTaskResolution: resolution('matched'),
  }, (result) => {
    const presentation = toStudentLearningPresentation(result);
    return Boolean(
      presentation?.taskReason &&
      presentation.outcome?.achieved &&
      presentation.outcome.primaryGap &&
      presentation.nextAction &&
      presentation.continuationReason,
    );
  });

  check('N13 没有正式结果时不生成发生了什么和怎么办', {
    currentTask: task('training'),
  }, (result) => {
    const presentation = toStudentLearningPresentation(result);
    return Boolean(presentation?.taskReason) && presentation?.outcome === undefined && presentation?.nextAction === undefined;
  });

  check('N14 未匹配下一资源时展示层不解释为什么继续', {
    currentTask: task('training'),
    feedback: feedback(),
    nextLearningStrategy: strategy('transfer'),
    nextTaskResolution: resolution('no_match'),
  }, (result) => toStudentLearningPresentation(result)?.continuationReason === undefined);

  check('N15 responseAnchor 只保留与覆盖要求相关的短表达', {
    currentTask: task('training'),
    feedback: feedback(),
  }, (result) => result.responseAnchor?.text === '你在回答中写出了“不舍”这一理解。' &&
    !result.responseAnchor.text.includes('整段'));

  check('N16 nextAction 优先说明如何修改当前答案', {
    currentTask: task('training'),
    feedback: feedback({
      nextActionText: '做人物心理题时要结合动作分析。',
      guidance: {
        detailsToReview: [],
        revisionActions: ['保留已经写出的心理判断，再补充一个具体动作。', '说明这个动作为什么能支持你的理解。'],
      },
    }),
  }, (result) => result.nextAction?.text.includes('保留已经写出的心理判断') === true &&
    !result.nextAction.text.includes('做人物心理题时'));

  check('N17 泛化鼓励不能成为 Narrative nextAction', {
    currentTask: task('training'),
    feedback: feedback({ nextActionText: '继续努力。', guidance: undefined }),
  }, (result) => result.nextAction === undefined);

  reports.push({
    name: 'N18 四组代表样例已冻结且 ID 唯一',
    passed: narrativeCalibrationSamples.length === 4 &&
      new Set(narrativeCalibrationSamples.map((item) => item.sampleId)).size === 4,
    detail: narrativeCalibrationSamples.map((item) => item.sampleId).join('|'),
  });

  reports.push({
    name: 'N19 理想样例不使用泛化建议或长期能力结论',
    passed: narrativeCalibrationSamples.every((item) => {
      const text = JSON.stringify(item.idealNarrative);
      return !/(继续努力|加强理解|深入思考|已经掌握|能力提高)/.test(text) &&
        (!item.idealNarrative.responseAnchor || item.idealNarrative.responseAnchor !== item.studentAnswer);
    }),
    detail: 'frozen_samples=4',
  });

  check('N20 错误答案也能生成中性 responseAnchor', {
    currentTask: task('training'),
    studentResponse: response('母亲不耐烦，因为她把伞推了过去。'),
    feedback: feedback({
      whatYouDidWell: [],
      thinkingReview: {
        requirementCoverage: [{
          requirementId: 'requirement-conclusion', requirementType: 'conclusion', requirementText: '判断人物心理',
          required: true, status: 'missing', studentEvidence: [], taskEvidence: [], source: 'formal_diagnosis',
          gapMessage: '对母亲心理的理解需要重新想一想。',
        }],
        coveredPoints: [], primaryGapRequirementId: 'requirement-conclusion',
        primaryGap: '对母亲心理的理解需要重新想一想。', missingPoints: ['对母亲心理的理解需要重新想一想。'],
      },
    }),
  }, (result) => result.responseAnchor?.text === '你在回答中写到“母亲不耐烦，因为她把伞推了过去”。' &&
    result.responseAnchor.sourceType === 'student_response' && result.achieved === undefined);

  check('N21 占位答案不生成 responseAnchor', {
    currentTask: task('diagnosis'),
    studentResponse: response('不知道。', { taskId: 'task-diagnosis' }),
    feedback: feedback({
      whatYouDidWell: [],
      thinkingReview: { coveredPoints: [], primaryGap: '这次回答的信息还不够。', missingPoints: ['这次回答的信息还不够。'] },
    }),
  }, (result) => result.responseAnchor === undefined);

  check('N22 结论错误保留 needs_adjustment 展示语义', {
    currentTask: task('training'),
    studentResponse: response('父亲很高兴。'),
    feedback: feedback({
      whatYouDidWell: [],
      thinkingReview: {
        requirementCoverage: [{
          requirementId: 'requirement-conclusion', requirementType: 'conclusion', requirementText: '判断人物心理',
          required: true, status: 'missing', studentEvidence: [], taskEvidence: [], source: 'formal_diagnosis',
          gapMessage: '对父亲心理的理解需要重新想一想。', gapReasonCode: 'conclusion_inconsistent',
        }],
        coveredPoints: [], primaryGapRequirementId: 'requirement-conclusion',
        primaryGap: '对父亲心理的理解需要重新想一想。', missingPoints: ['对父亲心理的理解需要重新想一想。'],
      },
    }),
  }, (result) => result.currentGapMode === 'needs_adjustment' &&
    result.currentGapReasonCode === 'conclusion_inconsistent' &&
    toStudentLearningPresentation(result)?.outcome?.primaryGapMode === 'needs_adjustment');

  const responseMismatch = buildStudentLearningNarrativeProjection({
    studentId: STUDENT_ID,
    currentTask: task('training'),
    studentResponse: response('父亲很高兴。', { studentId: 'another-student' }),
    feedback: feedback(),
  });
  reports.push({
    name: 'N23 StudentResponse 身份错位阻断 Narrative',
    passed: !responseMismatch.validation.passed && !responseMismatch.validation.identityAligned &&
      responseMismatch.validation.issues.includes('narrative_student_identity_mismatch'),
    detail: responseMismatch.validation.issues.join('|'),
  });

  const calibrated = buildFrozenCalibrationProjections();
  reports.push({
    name: 'N24 四组冻结样例通过正式 Narrative Builder',
    passed: calibrated[0].responseAnchor !== undefined && calibrated[0].achieved !== undefined &&
      calibrated[0].currentGap !== undefined && calibrated[0].nextAction !== undefined &&
      calibrated[1].responseAnchor?.text.includes('把伞推了过去') === true &&
      calibrated[1].achieved !== undefined && calibrated[1].currentGapMode === 'needs_adjustment' &&
      calibrated[2].responseAnchor !== undefined && calibrated[2].achieved !== undefined &&
      calibrated[2].currentGap === undefined && calibrated[2].nextAction === undefined &&
      calibrated[3].responseAnchor === undefined && calibrated[3].achieved === undefined &&
      calibrated[3].currentGapMode === 'insufficient_to_judge' && calibrated[3].nextAction !== undefined,
    detail: calibrated.map((item) => JSON.stringify({
      valid: item.validation.passed,
      anchor: Boolean(item.responseAnchor),
      achieved: Boolean(item.achieved),
      gap: Boolean(item.currentGap),
      gapMode: item.currentGapMode,
      action: Boolean(item.nextAction),
    })).join('|'),
  });

  check('N25 基础进入层单选使用具体动作且不误写继续练习', {
    currentTask: task('training', {
      targetAbilityId: 'comprehension',
      targetAbilityName: '理解',
      responseFormat: 'single_choice',
      learningIntent: learningIntent({
        expectedStudentAction: '学生需要阅读第1-2段，定位描述女娲孤独的句子，并选择最直接的原因。',
        isFoundationEntry: true,
      }),
    }),
  }, (result) => result.taskReason?.text ===
    '这道题先练习理解句段含义与内容关系，为后面的解释和分析打基础。' &&
    !result.taskReason.text.includes('继续练习'));

  check('N26 普通文本 Training 使用安全的高层阅读动作', {
    currentTask: task('training', {
      responseFormat: 'text',
      learningIntent: learningIntent({
        expectedStudentAction: '学生需要结合人物动作，解释动作与心理判断之间的关系。',
        isFoundationEntry: false,
      }),
    }),
  }, (result) => result.taskReason?.text ===
    '这道题练习结合文本依据进行合理推断。' &&
    !result.taskReason.text.includes('人物动作'));

  check('N27 Retest 保留间隔独立语义并使用具体动作', {
    currentTask: task('retest', {
      learningIntent: learningIntent({
        expectedStudentAction: '学生需要根据两处动作独立判断人物心理。',
        isFoundationEntry: false,
      }),
    }),
  }, (result) => result.taskReason?.text.includes('间隔一段时间后再次练习结合文本依据进行合理推断') === true &&
    result.taskReason.text.includes('独立完成'));

  check('N28 Transfer 保留新材料迁移语义并使用具体动作', {
    currentTask: task('transfer', {
      learningIntent: learningIntent({
        expectedStudentAction: '学生需要找出新材料中的动作依据并形成判断。',
        isFoundationEntry: false,
      }),
    }),
  }, (result) => result.taskReason?.text.includes('换一份材料练习结合文本依据进行合理推断') === true &&
    result.taskReason.text.includes('新内容'));

  check('N29 Diagnosis 使用具体任务了解当前处理方式', {
    currentTask: task('diagnosis', {
      learningIntent: learningIntent({
        expectedStudentAction: '学生需要找出与人物心理有关的动作。',
        isFoundationEntry: false,
      }),
    }),
  }, (result) => result.taskReason?.text.includes('先了解你目前怎样结合文本依据进行合理推断') === true);

  check('N30 疑似答案与内部字段不会进入说明并安全回退', {
    currentTask: task('training', {
      targetAbilityId: 'comprehension',
      targetAbilityName: '理解',
      responseFormat: 'single_choice',
      learningIntent: learningIntent({
        observationGoal: '正确答案是 option-1，因为天地间没有人类。',
        expectedStudentAction: '学生应选择选项 A，正确答案是因为天地间没有人类。',
        isFoundationEntry: true,
      }),
    }),
  }, (result) => result.taskReason?.text === '这道题先练习理解句段含义与内容关系，为后面的解释和分析打基础。' &&
    !/option-1|天地间没有人类|正确答案/.test(result.taskReason.text));

  console.log('\nStudent Learning Narrative Calibration Debug');
  console.log('='.repeat(76));
  for (const report of reports) {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail}`);
  }
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(76));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  console.log('Provider mode: none (read-only deterministic projection)');
  if (passed !== reports.length) throw new Error('Student Learning Narrative Debug failed.');
}

function check(
  name: string,
  input: Omit<Parameters<typeof buildStudentLearningNarrativeProjection>[0], 'studentId'>,
  predicate: (result: ReturnType<typeof buildStudentLearningNarrativeProjection>) => boolean,
): void {
  const result = buildStudentLearningNarrativeProjection({ studentId: STUDENT_ID, ...input });
  const passed = result.validation.passed && predicate(result);
  reports.push({
    name,
    passed,
    detail: `fields=${['taskReason', 'responseAnchor', 'achieved', 'currentGap', 'nextAction', 'progressMeaning', 'nextTaskReason']
      .filter((key) => Boolean(result[key as keyof typeof result])).join('|') || 'none'}, issues=${result.validation.issues.join('|') || 'none'}`,
  });
}

function task(
  taskRole: ConcreteLearningTask['taskRole'],
  overrides: Partial<ConcreteLearningTask> = {},
): ConcreteLearningTask {
  return {
    taskId: `task-${taskRole}`,
    targetAbilityId: 'inference',
    targetAbilityName: '推理',
    taskRole,
    ...overrides,
  } as ConcreteLearningTask;
}

function learningIntent(
  overrides: Partial<NonNullable<ConcreteLearningTask['learningIntent']>> = {},
): NonNullable<ConcreteLearningTask['learningIntent']> {
  return {
    sourceObservationTaskPlanId: 'observation-task-plan-narrative-debug',
    observationGoal: '根据人物动作判断人物心理。',
    expectedStudentAction: '学生需要根据人物动作判断人物心理。',
    designReason: '用于观察学生能否建立动作与心理之间的联系。',
    isFoundationEntry: false,
    ...overrides,
  };
}

function response(answerText: string, overrides: Partial<StudentResponse> = {}): StudentResponse {
  return {
    responseId: `response-${answerText.length}`,
    executionSessionId: 'execution-session-1',
    studentId: STUDENT_ID,
    taskId: 'task-training',
    answerText,
    submittedAt: '2026-07-22T08:00:00.000Z',
    usedHint: false,
    hintCount: 0,
    ...overrides,
  };
}

function buildFrozenCalibrationProjections() {
  const [first, second, third, fourth] = narrativeCalibrationSamples;
  return [
    buildStudentLearningNarrativeProjection({
      studentId: STUDENT_ID, currentTask: task('training'), studentResponse: response(first.studentAnswer), feedback: feedback(),
    }),
    buildStudentLearningNarrativeProjection({
      studentId: STUDENT_ID, currentTask: task('training'), studentResponse: response(second.studentAnswer),
      feedback: feedback({
        whatYouDidWell: ['你已经找到了一个与题目有关的具体动作。'],
        guidance: { detailsToReview: [], revisionActions: ['保留已经找到的动作。', '重新想一想这个动作表现了母亲怎样的心理。', '说明这个动作为什么能表现出母亲当时的这种心理。'] },
        thinkingReview: {
          requirementCoverage: [
            { requirementId: 'requirement-conclusion', requirementType: 'conclusion', requirementText: '判断人物心理', required: true, status: 'missing', studentEvidence: [], taskEvidence: [], source: 'formal_diagnosis', gapMessage: '这个动作表现的心理还需要重新判断。', gapReasonCode: 'conclusion_inconsistent' },
            { requirementId: 'requirement-evidence', requirementType: 'text_evidence', requirementText: '结合动作依据', required: true, status: 'partially_covered', studentEvidence: ['把伞推了过去'], taskEvidence: [], source: 'task_requirement', studentMessage: '你已经找到了一个与题目有关的具体动作。' },
          ],
          coveredPoints: ['你已经找到了一个与题目有关的具体动作。'], primaryGapRequirementId: 'requirement-conclusion',
          primaryGap: '这个动作表现的心理还需要重新判断。', missingPoints: ['这个动作表现的心理还需要重新判断。'],
        },
      }),
    }),
    buildStudentLearningNarrativeProjection({
      studentId: STUDENT_ID, currentTask: task('transfer'), studentResponse: response(third.studentAnswer, { taskId: 'task-transfer' }),
      feedback: feedback({
        whatYouDidWell: ['人物特点、具体动作和两者之间的关系都已经写清楚。'],
        whatNeedsAttention: [],
        nextActionText: '继续努力。', guidance: undefined,
        thinkingReview: {
          requirementCoverage: [{ requirementId: 'requirement-conclusion', requirementType: 'conclusion', requirementText: '概括人物特点', required: true, status: 'covered', studentEvidence: ['认真负责'], taskEvidence: [], source: 'rubric', studentMessage: '人物特点、具体动作和两者之间的关系都已经写清楚。' }],
          coveredPoints: ['人物特点、具体动作和两者之间的关系都已经写清楚。'], missingPoints: [],
        },
      }),
    }),
    buildStudentLearningNarrativeProjection({
      studentId: STUDENT_ID, currentTask: task('diagnosis'), studentResponse: response(fourth.studentAnswer, { taskId: 'task-diagnosis' }),
      feedback: feedback({
        whatYouDidWell: [], nextActionText: '先写出你认为父亲当时的心理，再从文中找一个具体动作说明理由。', guidance: undefined,
        thinkingReview: {
          requirementCoverage: [{ requirementId: 'requirement-conclusion', requirementType: 'conclusion', requirementText: '判断人物心理', required: true, status: 'insufficient_to_judge', studentEvidence: [], taskEvidence: [], source: 'formal_diagnosis', gapMessage: '这次回答还没有写出父亲的心理，也没有说明理由。', gapReasonCode: 'insufficient_to_judge' }],
          coveredPoints: [], primaryGapRequirementId: 'requirement-conclusion', primaryGap: '这次回答还没有写出父亲的心理，也没有说明理由。', missingPoints: ['这次回答还没有写出父亲的心理，也没有说明理由。'],
        },
      }),
    }),
  ];
}

function feedback(overrides: Partial<StudentLearningFeedback> = {}): StudentLearningFeedback {
  return {
    learningRoundId: 'round-1',
    studentId: STUDENT_ID,
    stage: 'result',
    resultStatus: 'completed',
    headline: '反馈',
    summary: '本轮反馈已经形成。',
    whatYouDidWell: ['你已经写出了人物不舍的心理。'],
    whatNeedsAttention: ['还缺少一个具体动作作为依据。'],
    nextActionText: '保留心理判断，再补充一个具体动作，并说明动作与心理的关系。',
    thinkingReview: {
      requirementCoverage: [
        {
          requirementId: 'requirement-conclusion',
          requirementType: 'conclusion',
          requirementText: '判断人物心理',
          required: true,
          status: 'covered',
          studentEvidence: ['不舍'],
          taskEvidence: [],
          source: 'rubric',
        },
        {
          requirementId: 'requirement-evidence',
          requirementType: 'text_evidence',
          requirementText: '结合动作依据',
          required: true,
          status: 'missing',
          studentEvidence: [],
          taskEvidence: [],
          source: 'rubric',
        },
      ],
      coveredPoints: ['你已经写出了人物不舍的心理。'],
      primaryGapRequirementId: 'requirement-evidence',
      primaryGap: '还缺少一个具体动作作为依据。',
      missingPoints: ['还缺少一个具体动作作为依据。'],
    },
    canRetry: false,
    canFinishRound: true,
    source: 'learning_round',
    ...overrides,
  };
}

function strategy(role: NextLearningStrategy['recommendedTaskRole']): NextLearningStrategy {
  return {
    strategyId: `strategy-${role}`,
    studentId: STUDENT_ID,
    targetAbilityId: 'inference',
    action: role === 'transfer' ? 'transfer_test' : 'continue_training',
    reason: 'formal strategy reason',
    evidenceLinks: ['evidence-1'],
    growthMemoryRecordIds: ['growth-2'],
    validationGoal: 'formal validation goal',
    recommendedTaskRole: role,
    limitations: [],
    strategySource: 'growth_memory',
    createdAt: '2026-07-22T08:00:00.000Z',
  };
}

function resolution(status: NextFormalTaskResolution['status']): NextFormalTaskResolution {
  return {
    status,
    taskRequestId: 'task-request-2',
    resourceVersion: status === 'matched' ? { resourceVersionId: 'resource-version-2' } as NextFormalTaskResolution['resourceVersion'] : undefined,
    issues: status === 'matched' ? [] : ['no_aligned_frozen_resource'],
  };
}

function qualityAssessment(): EvidenceQualityAssessment {
  return {
    assessmentId: 'quality-2',
    studentId: STUDENT_ID,
    abilityId: 'inference',
    qualityLevel: 'high',
    evaluationEligibility: 'eligible',
    facts: {
      responseValid: true,
      taskAbilityAligned: true,
      diagnosisAligned: true,
      traceabilityComplete: true,
      independentPerformance: true,
      timingType: 'delayed',
      taskNovelty: 'transfer',
    },
    validation: { passed: true, issues: [] },
  } as EvidenceQualityAssessment;
}

function growthMemory(): GrowthMemorySummary {
  return {
    studentId: STUDENT_ID,
    abilityId: 'inference',
    abilityLabel: '推理',
    recordCount: 2,
    latestRecordId: 'growth-2',
    recentActions: [],
    recentTrend: 'confidence_increasing',
    pendingActions: [],
    evidenceLinks: ['evidence-1', 'evidence-2'],
    limitations: [],
    summary: '正式记忆摘要。',
  };
}

function retestPlan(): DelayedRetestPlan {
  return {
    planId: 'retest-plan-2',
    studentId: STUDENT_ID,
    baselineEvidenceId: 'evidence-1',
    sourceEvidenceIds: ['evidence-1'],
  } as DelayedRetestPlan;
}

main();
