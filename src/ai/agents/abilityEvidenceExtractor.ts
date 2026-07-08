import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  type AbilityEvidence,
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
