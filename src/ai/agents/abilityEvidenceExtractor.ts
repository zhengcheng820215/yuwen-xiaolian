import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  type AbilityEvidence,
  type AbilityEvidenceReason,
  type AbilityEvidenceType,
  normalizeAbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';

export type AbilityEvidenceExtractionContext = {
  studentId: string;
  taskId?: string;
  diagnosisId?: string;
  createdAt?: string;
};

export function extractAbilityEvidenceFromDiagnosis(
  diagnosisResult: DiagnosisResult,
  context: AbilityEvidenceExtractionContext,
): AbilityEvidence {
  const evidenceType = inferEvidenceType(diagnosisResult);

  return normalizeAbilityEvidence({
    id: buildDiagnosisEvidenceId(diagnosisResult, context, evidenceType),
    studentId: context.studentId,
    ability: diagnosisResult.mainAbility,
    evidenceType,
    reason: inferEvidenceReason(diagnosisResult, evidenceType),
    detail: buildDetail(diagnosisResult, evidenceType),
    source: 'diagnosis',
    observation: buildObservation(diagnosisResult, evidenceType),
    rootCause: evidenceType === 'positive' ? undefined : diagnosisResult.rootCause,
    confidence: diagnosisResult.confidence,
    createdAt: context.createdAt,
    taskId: context.taskId,
    diagnosisId: context.diagnosisId,
  });
}

function inferEvidenceType(diagnosisResult: DiagnosisResult): AbilityEvidenceType {
  if (diagnosisResult.answerStatus === 'insufficient_evidence') return 'insufficient';
  if (diagnosisResult.answerStatus === 'fully_meets' || diagnosisResult.correct === true) return 'positive';
  if (diagnosisResult.answerStatus === 'partially_meets') return 'weakness';
  if (diagnosisResult.answerStatus === 'does_not_meet' || diagnosisResult.correct === false) return 'weakness';

  return 'insufficient';
}

function inferEvidenceReason(
  diagnosisResult: DiagnosisResult,
  evidenceType: AbilityEvidenceType,
): AbilityEvidenceReason | undefined {
  if (evidenceType === 'positive' || evidenceType === 'growth' || evidenceType === 'insufficient') {
    return undefined;
  }

  const text = [
    diagnosisResult.mainAbility,
    diagnosisResult.errorType,
    diagnosisResult.surfaceError,
    diagnosisResult.rootCause,
    diagnosisResult.diagnosisSummary,
  ].filter(Boolean).join('\n');

  if (diagnosisResult.mainAbility === '信息提取') return 'missing_skill';
  if (diagnosisResult.mainAbility === '理解') return 'incomplete_understanding';
  if (diagnosisResult.mainAbility === '推理') return 'reasoning_error';
  if (diagnosisResult.mainAbility === '表达') return 'expression_issue';

  if (/修辞|说明方法|表现手法|写作手法|知识/.test(text)) return 'knowledge_gap';
  if (/表达|完整|观点|依据|说明|组织|结构/.test(text)) return 'expression_issue';
  if (/推理|推断|结论|推理链/.test(text)) return 'reasoning_error';
  if (/理解|含义|表层|深层|语境|情感|主题/.test(text)) return 'incomplete_understanding';
  if (/信息|提取|定位|关键词|限定|文本依据|线索/.test(text)) return 'missing_skill';
  if (/不稳定|波动|偶然|时好时坏/.test(text)) return 'unstable_performance';

  return 'unstable_performance';
}

function buildDetail(
  diagnosisResult: DiagnosisResult,
  evidenceType: AbilityEvidenceType,
): string {
  if (Array.isArray(diagnosisResult.abilityEvidence) && diagnosisResult.abilityEvidence.length > 0) {
    return diagnosisResult.abilityEvidence.join('；');
  }

  if (evidenceType === 'positive') {
    return diagnosisResult.diagnosisSummary || `学生在「${diagnosisResult.mainAbility}」任务中形成正向表现。`;
  }

  if (evidenceType === 'insufficient') {
    return diagnosisResult.surfaceError || diagnosisResult.diagnosisSummary || '本次作答证据不足，暂不能形成明确能力判断。';
  }

  return diagnosisResult.rootCause || diagnosisResult.surfaceError || diagnosisResult.diagnosisSummary || `学生在「${diagnosisResult.mainAbility}」任务中存在薄弱表现。`;
}

function buildObservation(
  diagnosisResult: DiagnosisResult,
  evidenceType: AbilityEvidenceType,
): string {
  if (evidenceType === 'positive') {
    return `学生在「${diagnosisResult.mainAbility}」任务中基本满足要求，可形成正向能力证据。`;
  }

  if (evidenceType === 'insufficient') {
    return `学生在「${diagnosisResult.mainAbility}」任务中未提供足够有效作答，暂不能判断具体能力缺口。`;
  }

  const surface = diagnosisResult.surfaceError || diagnosisResult.diagnosisSummary;
  if (surface) {
    return `学生在「${diagnosisResult.mainAbility}」任务中表现不稳定：${surface}`;
  }

  return `学生在「${diagnosisResult.mainAbility}」任务中存在关键能力要点缺失。`;
}

function buildDiagnosisEvidenceId(
  diagnosisResult: DiagnosisResult,
  context: AbilityEvidenceExtractionContext,
  evidenceType: AbilityEvidenceType,
): string {
  if (context.diagnosisId) return `evidence-${context.diagnosisId}`;

  const createdAt = context.createdAt || new Date().toISOString();
  const safeCreatedAt = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  const safeAbility = diagnosisResult.mainAbility.replace(/\s+/g, '');
  return `${context.studentId}-diagnosis-${safeAbility}-${evidenceType}-${safeCreatedAt}`;
}
