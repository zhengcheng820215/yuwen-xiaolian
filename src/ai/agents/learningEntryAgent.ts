import { runRealAIDiagnosisLoop } from './realAIDiagnosisAgent.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { QuestionMetadata } from '../schemas/diagnosis.schema.ts';
import type {
  LearningEntryResult,
  LearningEntryStudentFeedback,
} from '../schemas/learningEntry.schema.ts';

export type LearningEntryInput = {
  studentId: string;
  question: string;
  referenceAnswer: string;
  studentAnswer: string;
  questionMetadata?: QuestionMetadata;
  previousEvidence?: AbilityEvidence[];
  sessionId?: string;
  createdAt?: string;
  diagnosisCaller?: (
    prompt: string,
    input: Parameters<typeof runRealAIDiagnosisLoop>[0],
  ) => Promise<string>;
};

export async function runLearningEntryAgent(
  input: LearningEntryInput,
): Promise<LearningEntryResult> {
  const createdAt = input.createdAt || new Date().toISOString();
  const sessionId = input.sessionId || buildSessionId(input.studentId, createdAt);
  const diagnosisLoopInput = {
    studentId: input.studentId,
    question: input.question,
    referenceAnswer: input.referenceAnswer,
    studentAnswer: input.studentAnswer,
    questionMetadata: input.questionMetadata,
    previousEvidence: input.previousEvidence || [],
    taskId: `${sessionId}-entry-question`,
    diagnosisId: `${sessionId}-entry-diagnosis`,
    createdAt,
  };
  const diagnosisResult = input.diagnosisCaller
    ? await runRealAIDiagnosisLoop(diagnosisLoopInput, input.diagnosisCaller)
    : await runRealAIDiagnosisLoop(diagnosisLoopInput);
  const initialTargetAbility = diagnosisResult.newAbilityEvidence.ability ||
    diagnosisResult.studentAbilityProfile.current_weakness.primary ||
    diagnosisResult.diagnosisResult.mainAbility;
  const nextStepHint = buildNextStepHint({
    targetAbility: initialTargetAbility,
    diagnosisNextTraining: diagnosisResult.diagnosisResult.nextTraining,
    profileRecommendation: diagnosisResult.studentAbilityProfile.next_step_recommendation,
  });
  const studentFeedback = buildStudentFeedback({
    targetAbility: initialTargetAbility,
    answerStatus: diagnosisResult.diagnosisResult.answerStatus,
    rootCause: diagnosisResult.diagnosisResult.rootCause,
    nextStepHint,
  });
  const validation = validateLearningEntryResult({
    sessionId,
    input,
    newAbilityEvidence: diagnosisResult.newAbilityEvidence,
    updatedEvidence: diagnosisResult.updatedEvidence,
    initialTargetAbility,
    nextStepHint,
    studentFeedback,
  });

  return {
    session_id: sessionId,
    student_id: input.studentId,
    question: input.question,
    student_answer: input.studentAnswer,
    diagnosis_result: diagnosisResult.diagnosisResult,
    new_ability_evidence: diagnosisResult.newAbilityEvidence,
    updated_evidence: diagnosisResult.updatedEvidence,
    student_ability_profile: diagnosisResult.studentAbilityProfile,
    initial_target_ability: initialTargetAbility,
    next_step_hint: nextStepHint,
    student_feedback: studentFeedback,
    validation,
  };
}

export async function learningEntryMockDiagnosisCaller(
  _prompt: string,
  input: Parameters<typeof runRealAIDiagnosisLoop>[0],
): Promise<string> {
  const answer = input.studentAnswer.trim();
  const mainAbility = input.questionMetadata?.mainAbility || '推理';
  const questionType = input.questionMetadata?.questionType || '推理';

  if (!answer) {
    return JSON.stringify({
      taskType: 'open_response',
      correct: null,
      strategyUsed: 'phase7_1_learning_entry_mock',
      answerStatus: 'insufficient_evidence',
      scoreBand: 'invalid',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: '学生暂未提交有效答案。',
      rootCause: '作答证据不足，暂不能判断当前能力表现。',
      errorType: '待验证',
      abilityEvidence: ['学生答案为空，无法形成有效能力证据。'],
      diagnosisSummary: '本次答案信息不足，需要先补充作答。',
      nextTraining: '请先写出你的判断，并补充至少一处文本依据。',
      confidence: 0.42,
    });
  }

  const hasTextClue = /旧书|树叶|停了很久|反复整理|翻到|文本|线索/.test(answer);
  const hasMentalInference = /不舍|怀念|牵挂|珍惜|回忆|想起|爱|关心|舍不得/.test(answer);
  const hasReasoningMarker = /因为|所以|说明|由此|可以看出|可见|理由|依据/.test(answer);

  if (hasTextClue && hasMentalInference && hasReasoningMarker) {
    return JSON.stringify({
      taskType: 'open_response',
      correct: true,
      strategyUsed: 'phase7_1_learning_entry_mock',
      answerStatus: 'fully_meets',
      scoreBand: 'high',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: '暂未发现明显表面错误。',
      rootCause: '学生能够根据文本线索推断人物心理，并说明理由。',
      errorType: '待验证',
      abilityEvidence: [
        `题目被识别为「${questionType}」任务，主要观察${mainAbility}能力。`,
        '学生答案能够提取“旧书、树叶、停了很久”等文本线索。',
        '学生能够推断父亲不舍、怀念或牵挂等心理，并用关系词说明理由。',
      ],
      diagnosisSummary: '本次作答基本达到要求，学生能从文本线索推出人物心理。',
      nextTraining: '可以继续挑战稍复杂的推理题，练习在更长文本中寻找依据。',
      confidence: 0.86,
    });
  }

  if (hasMentalInference || (hasTextClue && hasReasoningMarker)) {
    return JSON.stringify({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'phase7_1_learning_entry_mock',
      answerStatus: 'partially_meets',
      scoreBand: 'medium',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: '学生答案已经接近题意，但文本依据或推理说明不够完整。',
      rootCause: '学生能说出部分心理或线索，但还没有稳定形成“文本线索 -> 心理判断 -> 理由说明”的完整链条。',
      errorType: '推理错误',
      abilityEvidence: [
        `题目被识别为「${questionType}」任务，主要观察${mainAbility}能力。`,
        '学生答案包含部分心理判断或文本线索。',
        '学生答案仍缺少完整的依据说明或推理关系表达。',
      ],
      diagnosisSummary: '本次作答部分满足要求，已经抓住了一些意思，但理由还需要补完整。',
      nextTraining: '下一步练习把答案写成“文本线索 -> 心理判断 -> 理由说明”的结构。',
      confidence: 0.72,
    });
  }

  return JSON.stringify({
    taskType: 'open_response',
    correct: false,
    strategyUsed: 'phase7_1_learning_entry_mock',
    answerStatus: 'does_not_meet',
    scoreBand: 'low',
    mainAbility,
    relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
    surfaceError: '学生答案停留在表层行为或与题目要求关系较弱。',
    rootCause: '学生尚未从文本线索推断人物心理，也没有说明依据与结论的关系。',
    errorType: '推理错误',
    abilityEvidence: [
      `题目被识别为「${questionType}」任务，主要观察${mainAbility}能力。`,
      '学生答案没有有效提取关键文本线索。',
      '学生答案没有形成可支撑的人物心理推断。',
    ],
    diagnosisSummary: '本次作答还没有回应到题目的关键要求，需要先练习找线索。',
    nextTraining: '先从文本中圈出关键行为，再尝试写出人物心理和理由。',
    confidence: 0.68,
  });
}

function buildSessionId(studentId: string, createdAt: string): string {
  const safeStudentId = (studentId || 'demo-student').replace(/[^0-9a-zA-Z_-]/g, '');
  const timestamp = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `learning-entry-${safeStudentId}-${timestamp}`;
}

function buildNextStepHint(input: {
  targetAbility: string;
  diagnosisNextTraining: string;
  profileRecommendation: string;
}): string {
  if (input.diagnosisNextTraining) return input.diagnosisNextTraining;
  if (input.profileRecommendation) return input.profileRecommendation;

  return `下一步先围绕「${input.targetAbility}」完成一次针对练习。`;
}

function buildStudentFeedback(input: {
  targetAbility: string;
  answerStatus?: string;
  rootCause: string;
  nextStepHint: string;
}): LearningEntryStudentFeedback {
  return {
    title: `本题主要训练：${input.targetAbility}能力`,
    summary: buildStudentSummary(input.answerStatus, input.rootCause),
    next_step: toStudentNextStep(input.nextStepHint, input.targetAbility),
  };
}

function buildStudentSummary(
  answerStatus: string | undefined,
  rootCause: string,
): string {
  if (answerStatus === 'fully_meets') {
    return '这次作答基本达到了题目要求，可以继续挑战稍难一点的同类题。';
  }

  if (answerStatus === 'partially_meets') {
    return `你已经抓住了一部分意思，但还需要把理由说得更完整。主要需要改进的是：${rootCause}`;
  }

  if (answerStatus === 'does_not_meet') {
    return `这次答案还没有回应到题目的关键要求。我们先从一个小步骤练起：${rootCause}`;
  }

  return '这次答案提供的信息还不够，系统暂时不能稳定判断能力表现。请尝试补充文本依据和思考过程。';
}

function toStudentNextStep(nextStepHint: string, targetAbility: string): string {
  if (nextStepHint) return nextStepHint;

  return `先练习「${targetAbility}」的关键步骤，再完成下一题。`;
}

function validateLearningEntryResult(input: {
  sessionId: string;
  input: LearningEntryInput;
  newAbilityEvidence: AbilityEvidence;
  updatedEvidence: AbilityEvidence[];
  initialTargetAbility: string;
  nextStepHint: string;
  studentFeedback: LearningEntryStudentFeedback;
}): LearningEntryResult['validation'] {
  const issues: string[] = [];

  if (!input.sessionId.trim()) issues.push('session_id is required.');
  if (!input.input.studentId.trim()) issues.push('student_id is required.');
  if (!input.input.question.trim()) issues.push('question is required.');
  if (typeof input.input.studentAnswer !== 'string') issues.push('student_answer should be a string.');
  if (!input.newAbilityEvidence.ability.trim()) issues.push('new_ability_evidence.ability is required.');
  if (!['diagnosis', 'training', 'retest'].includes(input.newAbilityEvidence.source)) {
    issues.push('new_ability_evidence.source should be valid.');
  }
  if (input.updatedEvidence.length === 0) issues.push('updated_evidence should not be empty.');
  if (!input.initialTargetAbility.trim()) issues.push('initial_target_ability is required.');
  if (!input.nextStepHint.trim()) issues.push('next_step_hint is required.');
  if (!input.studentFeedback.title.trim()) issues.push('student_feedback.title is required.');
  if (!input.studentFeedback.summary.trim()) issues.push('student_feedback.summary is required.');
  if (!input.studentFeedback.next_step.trim()) issues.push('student_feedback.next_step is required.');

  return {
    passed: issues.length === 0,
    issues,
  };
}
