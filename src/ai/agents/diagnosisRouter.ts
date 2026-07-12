import type { DiagnosisInput, TaskType } from '../schemas/diagnosis.schema.ts';

export type DiagnosisRoute = {
  taskType: TaskType;
  strategyUsed: string;
  reason: string;
};

export function routeDiagnosisTask(input: DiagnosisInput): DiagnosisRoute {
  const metadataRoute = routeByQuestionMetadata(input);

  if (metadataRoute) return metadataRoute;

  const question = normalizeText(input.question);
  const referenceAnswer = normalizeText(input.referenceAnswer);

  if (isProcessTask(question)) {
    return {
      taskType: 'process_task',
      strategyUsed: 'process_task_mock_strategy',
      reason: '题目要求学生执行标注、修改、补全或过程化操作。',
    };
  }

  if (isExactMatchTask(question, referenceAnswer)) {
    return {
      taskType: 'exact_match',
      strategyUsed: 'exact_match_candidate_strategy',
      reason: '题目更适合通过参考答案候选项进行命中判断。',
    };
  }

  return {
    taskType: 'open_response',
    strategyUsed: 'open_response_ability_diagnosis',
    reason: '题目需要开放表达、文本理解、分析、概括或推理能力诊断。',
  };
}

function routeByQuestionMetadata(input: DiagnosisInput): DiagnosisRoute | null {
  const assessmentMode = input.questionMetadata?.assessmentMode;
  const answerAcceptance = input.questionMetadata?.answerAcceptance;

  if (answerAcceptance && hasAnswerAcceptanceBoundary(answerAcceptance)) {
    return {
      taskType: 'exact_match',
      strategyUsed: 'metadata_answer_acceptance_strategy',
      reason: '题目元数据提供 answerAcceptance，优先按答案接受边界判断。',
    };
  }

  if (!assessmentMode) return null;

  if (assessmentMode === 'exact_match') {
    return {
      taskType: 'exact_match',
      strategyUsed: 'metadata_exact_match_strategy',
      reason: '题目元数据指定 assessmentMode=exact_match。',
    };
  }

  if (assessmentMode === 'process_operation') {
    return {
      taskType: 'process_task',
      strategyUsed: 'metadata_process_task_strategy',
      reason: '题目元数据指定 assessmentMode=process_operation。',
    };
  }

  return {
    taskType: 'open_response',
    strategyUsed: `metadata_${assessmentMode}_rubric_strategy`,
    reason: `题目元数据指定 assessmentMode=${assessmentMode}，按开放题 rubric 诊断。`,
  };
}

function isExactMatchTask(question: string, referenceAnswer: string): boolean {
  // These are typical bounded-answer signals only. Metadata answerAcceptance
  // should be preferred whenever it is available.
  const exactTaskSignal = /反义词|近义词|填空|默写|选择|选出|下列|词语解释|解释词语|拼音|字音|字形|写出/.test(question);
  const answerLooksLikeCandidates = splitAnswerCandidates(referenceAnswer).length > 1;
  const shortAnswer = referenceAnswer.length > 0 && referenceAnswer.length <= 24;

  return exactTaskSignal || (answerLooksLikeCandidates && shortAnswer);
}

function hasAnswerAcceptanceBoundary(
  answerAcceptance: NonNullable<DiagnosisInput['questionMetadata']>['answerAcceptance'],
): boolean {
  if (!answerAcceptance) return false;

  return (
    (Array.isArray(answerAcceptance.acceptedAnswers) && answerAcceptance.acceptedAnswers.length > 0) ||
    (Array.isArray(answerAcceptance.acceptedKeywords) && answerAcceptance.acceptedKeywords.length > 0) ||
    answerAcceptance.semanticEquivalentAllowed === true
  );
}

function isProcessTask(question: string): boolean {
  return /找依据|找出.*依据|标.*关键词|标出|圈出|划出|画出|修改答案|修改下列答案|补全推理链|补全.*过程|补充依据/.test(question);
}

export function splitAnswerCandidates(referenceAnswer: string): string[] {
  return normalizeText(referenceAnswer)
    .split(/[/|｜、，,；;或]/)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').trim();
}
