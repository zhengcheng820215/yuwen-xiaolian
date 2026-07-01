export type DiagnosisErrorType =
  | '审题错误'
  | '定位错误'
  | '理解错误'
  | '概括错误'
  | '分析错误'
  | '推理错误'
  | '表达错误'
  | '迁移失败'
  | '待验证';

export type DiagnosisResult = {
  mainAbility: string;
  relatedAbilities: string[];
  surfaceError: string;
  rootCause: string;
  errorType: DiagnosisErrorType;
  abilityEvidence: string[];
  diagnosisSummary: string;
  nextTraining: string;
  confidence: number;
};

export type DiagnosisInput = {
  question: string;
  referenceAnswer: string;
  studentAnswer: string;
};

export const DIAGNOSIS_ERROR_TYPES: DiagnosisErrorType[] = [
  '审题错误',
  '定位错误',
  '理解错误',
  '概括错误',
  '分析错误',
  '推理错误',
  '表达错误',
  '迁移失败',
  '待验证',
];

export const DIAGNOSIS_RESULT_FIELDS: Array<keyof DiagnosisResult> = [
  'mainAbility',
  'relatedAbilities',
  'surfaceError',
  'rootCause',
  'errorType',
  'abilityEvidence',
  'diagnosisSummary',
  'nextTraining',
  'confidence',
];

export function normalizeDiagnosisResult(value: Partial<DiagnosisResult>): DiagnosisResult {
  const confidence = typeof value.confidence === 'number'
    ? Math.min(1, Math.max(0, value.confidence))
    : 0.5;

  return {
    mainAbility: value.mainAbility || '待诊断',
    relatedAbilities: Array.isArray(value.relatedAbilities) ? value.relatedAbilities : [],
    surfaceError: value.surfaceError || '暂未发现明确表面错误',
    rootCause: value.rootCause || '需要更多作答证据判断真实能力短板',
    errorType: DIAGNOSIS_ERROR_TYPES.includes(value.errorType as DiagnosisErrorType)
      ? value.errorType as DiagnosisErrorType
      : '待验证',
    abilityEvidence: Array.isArray(value.abilityEvidence) ? value.abilityEvidence : [],
    diagnosisSummary: value.diagnosisSummary || '本次诊断证据不足，需要继续观察。',
    nextTraining: value.nextTraining || '继续收集能力证据后再安排针对训练。',
    confidence,
  };
}

export function isDiagnosisInput(value: unknown): value is DiagnosisInput {
  if (!value || typeof value !== 'object') return false;

  const input = value as DiagnosisInput;
  return (
    typeof input.question === 'string' &&
    typeof input.referenceAnswer === 'string' &&
    typeof input.studentAnswer === 'string'
  );
}
