import {
  type AbilityEvidence,
  type AbilityEvidenceType,
  normalizeAbilityEvidence,
  isAbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import {
  normalizeDiagnosisResult,
  type DiagnosisResult,
} from '../schemas/diagnosis.schema.ts';
import type { RetestTask } from '../schemas/retestTask.schema.ts';
import {
  type RetestExecutionResult,
  type RetestExecutionValidation,
} from '../schemas/retestExecution.schema.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
} from './weaknessRankingAgent.ts';
import { generateStudentAbilityProfile } from './studentAbilityProfileAgent.ts';

export type RetestExecutionInput = {
  studentId: string;
  retestTask: RetestTask;
  studentRetestAnswer: string;
  previousEvidence: AbilityEvidence[];
  createdAt?: string;
};

type RetestDiagnosisRuntime = (
  input: RetestExecutionInput,
) => Promise<DiagnosisResult> | DiagnosisResult;

export async function runRetestExecution(
  input: RetestExecutionInput,
  diagnosisRuntime: RetestDiagnosisRuntime = mockRetestDiagnosisRuntime,
): Promise<RetestExecutionResult> {
  const createdAt = input.createdAt || new Date().toISOString();
  const diagnosisResult = normalizeDiagnosisResult(await diagnosisRuntime(input));
  const diagnosisFocusMatch = diagnosisResult.mainAbility === input.retestTask.target_ability;
  const reviewRequired = !diagnosisFocusMatch;
  const newRetestEvidence = buildRetestEvidence({
    input,
    diagnosisResult,
    createdAt,
  });
  const updatedEvidence = mergeEvidenceById(input.previousEvidence, newRetestEvidence);
  const evidenceSummary = summarizeAbilityEvidence(updatedEvidence);
  const topWeakness = rankWeaknessSummaries(evidenceSummary, 3);
  const updatedStudentAbilityProfile = generateStudentAbilityProfile({
    studentId: input.studentId,
    evidenceSummary,
    topWeakness,
    evidence: updatedEvidence,
    retestEvidence: newRetestEvidence,
    generatedAt: createdAt,
  });
  const validation = validateRetestExecution({
    input,
    diagnosisResult,
    newRetestEvidence,
    updatedEvidence,
    diagnosisFocusMatch,
    reviewRequired,
  });

  return {
    retest_task_id: input.retestTask.retest_task_id,
    target_ability: input.retestTask.target_ability,
    student_retest_answer: input.studentRetestAnswer,
    diagnosis_result: diagnosisResult,
    new_retest_evidence: newRetestEvidence,
    updated_evidence: updatedEvidence,
    evidence_summary: evidenceSummary,
    updated_student_ability_profile: updatedStudentAbilityProfile,
    validation,
  };
}

function buildRetestEvidence(input: {
  input: RetestExecutionInput;
  diagnosisResult: DiagnosisResult;
  createdAt: string;
}): AbilityEvidence {
  const evidenceType = inferRetestEvidenceType(input.diagnosisResult);

  return normalizeAbilityEvidence({
    id: `evidence-${input.input.retestTask.retest_task_id}`,
    studentId: input.input.studentId,
    ability: input.input.retestTask.target_ability,
    evidenceType,
    source: 'retest',
    detail: buildEvidenceDetail(input.diagnosisResult, evidenceType),
    observation: buildEvidenceObservation(input.diagnosisResult, evidenceType),
    rootCause: evidenceType === 'positive' ? undefined : input.diagnosisResult.rootCause,
    confidence: input.diagnosisResult.confidence,
    createdAt: input.createdAt,
    taskId: input.input.retestTask.retest_task_id,
    diagnosisId: `diagnosis-${input.input.retestTask.retest_task_id}`,
  });
}

function inferRetestEvidenceType(diagnosisResult: DiagnosisResult): AbilityEvidenceType {
  if (diagnosisResult.answerStatus === 'insufficient_evidence') return 'insufficient';
  if (diagnosisResult.answerStatus === 'fully_meets' || diagnosisResult.correct === true) return 'positive';
  if (diagnosisResult.answerStatus === 'partially_meets') return 'growth';
  if (diagnosisResult.answerStatus === 'does_not_meet' || diagnosisResult.correct === false) return 'weakness';

  return 'insufficient';
}

function buildEvidenceDetail(
  diagnosisResult: DiagnosisResult,
  evidenceType: AbilityEvidenceType,
): string {
  if (Array.isArray(diagnosisResult.abilityEvidence) && diagnosisResult.abilityEvidence.length > 0) {
    return diagnosisResult.abilityEvidence.join('；');
  }

  if (evidenceType === 'positive') return diagnosisResult.diagnosisSummary;
  if (evidenceType === 'growth') return `复测中出现改善迹象：${diagnosisResult.diagnosisSummary}`;
  if (evidenceType === 'insufficient') return '复测答案证据不足，暂不能形成有效迁移判断。';

  return diagnosisResult.rootCause || diagnosisResult.diagnosisSummary;
}

function buildEvidenceObservation(
  diagnosisResult: DiagnosisResult,
  evidenceType: AbilityEvidenceType,
): string {
  if (evidenceType === 'positive') {
    return `学生在复测中达到「${diagnosisResult.mainAbility}」任务要求。`;
  }

  if (evidenceType === 'growth') {
    return `学生在复测中出现「${diagnosisResult.mainAbility}」改善迹象，但仍需继续验证稳定性。`;
  }

  if (evidenceType === 'insufficient') {
    return `学生在复测中未提供足够有效作答，暂不能判断「${diagnosisResult.mainAbility}」迁移表现。`;
  }

  return `学生在复测中仍暴露「${diagnosisResult.mainAbility}」薄弱表现：${diagnosisResult.surfaceError}`;
}

function validateRetestExecution(input: {
  input: RetestExecutionInput;
  diagnosisResult: DiagnosisResult;
  newRetestEvidence: AbilityEvidence;
  updatedEvidence: AbilityEvidence[];
  diagnosisFocusMatch: boolean;
  reviewRequired: boolean;
}): RetestExecutionValidation {
  const issues: string[] = [];
  const blockingIssues: string[] = [];
  const { retestTask, studentRetestAnswer, previousEvidence } = input.input;

  if (!retestTask.retest_task_id) blockingIssues.push('RetestTask.retest_task_id is required.');
  if (!retestTask.target_ability) blockingIssues.push('RetestTask.target_ability is required.');
  if (!studentRetestAnswer.trim()) {
    issues.push('studentRetestAnswer is empty; generated insufficient evidence only.');
  }
  if (!isAbilityEvidence(input.newRetestEvidence)) {
    blockingIssues.push('newRetestEvidence should match AbilityEvidence schema.');
  }
  if (input.newRetestEvidence.source !== 'retest') {
    blockingIssues.push('newRetestEvidence.source should be retest.');
  }
  if (input.newRetestEvidence.ability !== retestTask.target_ability) {
    blockingIssues.push('newRetestEvidence.ability should equal RetestTask.target_ability.');
  }
  if (input.newRetestEvidence.taskId !== retestTask.retest_task_id) {
    blockingIssues.push('newRetestEvidence.taskId should equal RetestTask.retest_task_id.');
  }
  if (
    input.newRetestEvidence.confidence < 0 ||
    input.newRetestEvidence.confidence > 1
  ) {
    blockingIssues.push('newRetestEvidence.confidence should be between 0 and 1.');
  }
  if (!input.diagnosisFocusMatch) {
    issues.push(`REVIEW: diagnosis mainAbility=${input.diagnosisResult.mainAbility}, targetAbility=${retestTask.target_ability}.`);
  }

  const expectedCount = new Set([...previousEvidence.map((item) => item.id), input.newRetestEvidence.id]).size;
  if (input.updatedEvidence.length !== expectedCount) {
    blockingIssues.push('updatedEvidence should be deduped by evidence.id.');
  }

  return {
    passed: blockingIssues.length === 0,
    diagnosis_focus_match: input.diagnosisFocusMatch,
    review_required: input.reviewRequired,
    issues: [...blockingIssues, ...issues],
  };
}

function mergeEvidenceById(
  previousEvidence: AbilityEvidence[],
  newRetestEvidence: AbilityEvidence,
): AbilityEvidence[] {
  const evidenceById = new Map<string, AbilityEvidence>();

  for (const evidence of previousEvidence) {
    evidenceById.set(evidence.id, evidence);
  }

  evidenceById.set(newRetestEvidence.id, newRetestEvidence);

  return [...evidenceById.values()];
}

function mockRetestDiagnosisRuntime(input: RetestExecutionInput): DiagnosisResult {
  const answer = input.studentRetestAnswer.trim();
  const mainAbility = input.retestTask.target_ability;

  if (!hasEffectiveRetestAnswer(answer)) {
    return normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: null,
      strategyUsed: 'phase6_2_mock_retest_diagnosis',
      answerStatus: 'insufficient_evidence',
      scoreBand: 'invalid',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: answer ? '学生复测答案未提供有效语文分析内容。' : '学生未提交有效复测答案。',
      rootCause: '复测作答证据不足，暂不能判断能力迁移表现。',
      errorType: '待验证',
      abilityEvidence: [
        answer
          ? '复测答案缺少可用于判断的文本线索、心理推断或解释内容，无法形成有效迁移证据。'
          : '复测答案为空，无法形成有效迁移证据。',
      ],
      diagnosisSummary: '本次复测证据不足，需要重新作答或补充文本依据。',
      nextTraining: '重新完成复测题，至少写出文本依据和判断过程。',
      confidence: 0.45,
    });
  }

  const hasTextClue = /雨停|母亲|菜苗|袖口|竹竿|扶正|泥水/.test(answer);
  const hasMentalInference = /心疼|珍惜|牵挂|希望|细心|不舍|爱|照料/.test(answer);
  const hasReasoningMarker = /因为|说明|从.*看出|依据|所以|可见/.test(answer);

  if (hasTextClue && hasMentalInference && hasReasoningMarker) {
    return normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: true,
      strategyUsed: 'phase6_2_mock_retest_diagnosis',
      answerStatus: 'fully_meets',
      scoreBand: 'high',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: '暂未发现明确表面错误',
      rootCause: '本次复测中学生能够建立文本线索到人物心理的推理关系。',
      errorType: '待验证',
      abilityEvidence: [
        '学生引用或概括了“扶正菜苗、袖口沾泥水、用小竹竿固定”等文本线索。',
        '学生能从行为线索推断母亲心疼、珍惜或希望菜苗继续生长等心理。',
        '学生能够说明文本线索与心理判断之间的关系。',
      ],
      diagnosisSummary: '本次复测表现达到要求，学生能够在新文本中完成基本迁移推理。',
      nextTraining: '进入同能力更复杂文本的复测或降低该能力训练优先级。',
      confidence: 0.82,
    });
  }

  if (hasTextClue && hasMentalInference) {
    return normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'phase6_2_mock_retest_diagnosis',
      answerStatus: 'partially_meets',
      scoreBand: 'medium',
      mainAbility,
      relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
      surfaceError: '学生能提取线索并推断心理，但推理过程说明不够完整。',
      rootCause: '学生已经出现迁移改善迹象，但“文本线索 -> 人物心理 -> 结论表达”的推理链仍不够稳定。',
      errorType: '推理错误',
      abilityEvidence: [
        '学生能够提到母亲照料菜苗等文本线索。',
        '学生能够推断母亲心疼、珍惜等心理。',
        '学生尚未充分说明线索如何支持心理判断。',
      ],
      diagnosisSummary: '本次复测显示学生出现推理迁移改善迹象，但仍需继续验证稳定性。',
      nextTraining: '继续巩固文本线索到心理判断的推理链表达。',
      confidence: 0.74,
    });
  }

  return normalizeDiagnosisResult({
    taskType: 'open_response',
    correct: false,
    strategyUsed: 'phase6_2_mock_retest_diagnosis',
    answerStatus: 'does_not_meet',
    scoreBand: 'low',
    mainAbility,
    relatedAbilities: ['信息提取', '理解', mainAbility, '表达'],
    surfaceError: '学生答案没有充分提取文本线索，也没有完成稳定的人物心理推断。',
    rootCause: '学生在新文本中仍未建立“文本线索 -> 人物心理 -> 结论表达”的推理链。',
    errorType: '推理错误',
    abilityEvidence: [
      '学生答案缺少有效文本线索。',
      '学生答案没有形成可支撑的心理推断。',
    ],
    diagnosisSummary: '本次复测仍暴露目标能力薄弱表现。',
    nextTraining: '继续进行文本线索提取与推理链表达训练。',
    confidence: 0.7,
  });
}

function hasEffectiveRetestAnswer(answer: string): boolean {
  const normalized = answer.replace(/\s+/g, '');

  if (!normalized) return false;
  if (!/[\u4e00-\u9fff]/.test(normalized)) return false;
  if (/^(不知道|不会|不懂|没写|无|没有|随便|哈哈+|呵呵+|啊+|额+)$/u.test(normalized)) return false;

  const cjkCount = (normalized.match(/[\u4e00-\u9fff]/g) || []).length;

  if (cjkCount < 4) return false;

  const hasTaskRelevantContent = /雨停|母亲|菜苗|袖口|竹竿|扶正|泥水|心疼|珍惜|牵挂|希望|细心|不舍|爱|照料|因为|说明|依据|所以|可见|心理|推断/.test(normalized);

  return hasTaskRelevantContent;
}
