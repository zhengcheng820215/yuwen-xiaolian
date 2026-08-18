import type { DiagnosisErrorType, DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
  FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
  type RealLLMDiagnosisRuntimeResult,
} from '../schemas/diagnosisRunRecord.schema.ts';
import type { RealLLMRuntimeFoundationInput } from './realLLMRuntimeFoundationAgent.ts';
import type { SingleChoiceMisconceptionCode } from '../schemas/singleChoiceInteraction.schema.ts';

/**
 * Deterministic diagnosis for a validated single-choice response.
 * It deliberately does not call an LLM: the admitted option set already contains the
 * protected answer and one explainable misconception for every distractor.
 */
export function runSingleChoiceDiagnosis(
  input: RealLLMRuntimeFoundationInput,
): RealLLMDiagnosisRuntimeResult {
  const response = input.taskExecutionResult.studentResponse;
  const interaction = input.concreteTask.singleChoiceEvaluation;
  const answer = response?.singleChoiceAnswer;
  const requestId = input.requestId || `single-choice-${response?.responseId || input.concreteTask.taskId}`;
  const runId = `diagnosis-run-${sanitize(requestId)}`;
  const startedAt = input.startedAt || response?.submittedAt || new Date().toISOString();
  const completedAt = response?.submittedAt || startedAt;

  if (!response || !interaction || !answer) {
    return blocked(input, requestId, runId, startedAt, completedAt, 'single_choice_diagnosis_input_incomplete');
  }

  const selectedOptionId = answer.selectedOptionIds[0];
  const correct = interaction.correctOptionIds[0] === selectedOptionId;
  const rationale = interaction.distractorRationales.find((item) => item.optionId === selectedOptionId);
  const diagnosisResult = buildDiagnosisResult(input, correct, rationale?.misconceptionCode, rationale?.diagnosisMeaning, rationale?.evidenceBoundary);
  const formalDiagnosisId = `formal-diagnosis-${sanitize(requestId)}`;
  const commit = {
    schemaVersion: FORMAL_DIAGNOSIS_COMMIT_SCHEMA_VERSION,
    formalDiagnosisId,
    requestId,
    runId,
    status: 'committed' as const,
    diagnosisResult,
    committedAt: completedAt,
    validation: { passed: true, issues: [] },
  };
  return {
    requestId,
    runRecord: {
      schemaVersion: DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
      runId,
      requestId,
      studentId: response.studentId,
      taskId: response.taskId,
      executionSessionId: response.executionSessionId,
      responseId: response.responseId,
      executionMode: input.executionMode,
      status: 'formal_result_committed',
      providerConfigId: 'deterministic-single-choice-v1',
      providerRequestIds: [],
      attemptCount: 0,
      repairOperations: [],
      promptVersion: 'single_choice_deterministic_v1',
      diagnosisSchemaVersion: input.providerConfig.diagnosisSchemaVersion,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      latencyMs: 0,
      issues: ['Deterministic single-choice diagnosis; no external provider was called.'],
      startedAt,
      completedAt,
    },
    status: 'formal_result_committed',
    diagnosisCandidate: diagnosisResult,
    formalizationStatus: 'committed',
    formalDiagnosisCommit: commit,
    canEnterEvidenceReturn: !input.evidenceReturnAlreadyCompleted,
    validation: {
      passed: true,
      schemaValid: true,
      identityAligned: true,
      semanticBoundaryPassed: true,
      promptLeakagePassed: true,
      issues: [],
    },
  };
}

function buildDiagnosisResult(
  input: RealLLMRuntimeFoundationInput,
  correct: boolean,
  misconceptionCode?: SingleChoiceMisconceptionCode,
  diagnosisMeaning?: string,
  evidenceBoundary?: string,
): DiagnosisResult {
  const ability = input.concreteTask.targetAbilityId;
  if (correct) {
    return {
      taskType: 'exact_match',
      correct: true,
      strategyUsed: 'single_choice_option_match',
      answerStatus: 'fully_meets',
      scoreBand: 'high',
      mainAbility: ability,
      relatedAbilities: input.concreteTask.questionMetadata.relatedAbilities || [],
      surfaceError: '本次选择与题目要求一致。',
      rootCause: '本次低输入任务显示基础判断成立；仍需结合文本作答继续观察解释与证据组织。',
      errorType: '待验证',
      abilityEvidence: ['学生在本次单选任务中完成了正确的基础判断。'],
      diagnosisSummary: '这次基础判断正确，说明你抓住了题目要求的关键信息。',
      nextTraining: '继续用短文本或长文本说明依据，观察解释和证据组织是否同样成立。',
      confidence: 0.72,
    };
  }
  const meaning = diagnosisMeaning || '当前选择反映出一种需要继续核对的理解偏差。';
  return {
    taskType: 'exact_match',
    correct: false,
    strategyUsed: `single_choice_distractor_${misconceptionCode || 'other_explainable_bias'}`,
    answerStatus: 'does_not_meet',
    scoreBand: 'low',
    mainAbility: ability,
    relatedAbilities: input.concreteTask.questionMetadata.relatedAbilities || [],
    surfaceError: meaning,
    rootCause: `${meaning}${evidenceBoundary ? ` 需要回到材料核对：${evidenceBoundary}` : ' 这只是本次作答形成的待验证假设。'}`,
    errorType: mapErrorType(misconceptionCode),
    abilityEvidence: [`本次选择对应“${misconceptionLabel(misconceptionCode)}”偏差，尚不能单次确认为稳定能力问题。`],
    diagnosisSummary: `${meaning} 建议回到材料中的对象、范围或因果依据重新核对。`,
    nextTraining: evidenceBoundary
      ? `先按“${evidenceBoundary}”核对原文，再完成同一观察目标的文本解释。`
      : '先回到原文核对依据，再完成一道同目标的短文本解释。',
    confidence: 0.68,
  };
}

function mapErrorType(code?: SingleChoiceMisconceptionCode): DiagnosisErrorType {
  if (code === 'evidence_omission') return '定位错误';
  if (code === 'over_inference' || code === 'causal_reversal') return '推理错误';
  if (code === 'surface_reading' || code === 'entity_confusion' || code === 'scope_shift') return '理解错误';
  return '待验证';
}

function misconceptionLabel(code?: SingleChoiceMisconceptionCode): string {
  const labels: Partial<Record<SingleChoiceMisconceptionCode, string>> = {
    surface_reading: '只看到表面信息',
    entity_confusion: '混淆对象',
    evidence_omission: '遗漏关键证据',
    over_inference: '推理超过文本证据',
    causal_reversal: '倒置因果关系',
    scope_shift: '改变判断范围',
    other_explainable_bias: '可解释的理解偏差',
  };
  return labels[code || 'other_explainable_bias'] || '可解释的理解偏差';
}

function blocked(
  input: RealLLMRuntimeFoundationInput,
  requestId: string,
  runId: string,
  startedAt: string,
  completedAt: string,
  issue: string,
): RealLLMDiagnosisRuntimeResult {
  const response = input.taskExecutionResult.studentResponse;
  return {
    requestId,
    runRecord: {
      schemaVersion: DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
      runId,
      requestId,
      studentId: response?.studentId || input.concreteTask.studentId,
      taskId: response?.taskId || input.concreteTask.taskId,
      executionSessionId: response?.executionSessionId || 'missing-execution-session',
      responseId: response?.responseId || 'missing-response',
      executionMode: input.executionMode,
      status: 'input_blocked',
      providerConfigId: 'deterministic-single-choice-v1',
      providerRequestIds: [],
      attemptCount: 0,
      repairOperations: [],
      promptVersion: 'single_choice_deterministic_v1',
      diagnosisSchemaVersion: input.providerConfig.diagnosisSchemaVersion,
      issues: [issue],
      startedAt,
      completedAt,
    },
    status: 'blocked',
    formalizationStatus: 'blocked',
    canEnterEvidenceReturn: false,
    validation: {
      passed: false,
      schemaValid: false,
      identityAligned: true,
      semanticBoundaryPassed: false,
      promptLeakagePassed: true,
      issues: [issue],
    },
  };
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}
