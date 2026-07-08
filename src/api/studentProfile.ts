import { getTrainingEvidenceDemoData } from './trainingEvidence';
import { generateStudentAbilityProfile } from '../ai/agents/studentAbilityProfileAgent.ts';
import {
  rankWeaknesses,
  summarizeAbilityEvidence,
} from '../ai/agents/weaknessRankingAgent.ts';

const studentId = 'demo-student';
const generatedAt = '2026-07-08T12:00:00.000Z';

export function getStudentProfileDemoData() {
  const trainingEvidenceData = getTrainingEvidenceDemoData();
  const evidence = trainingEvidenceData.result.updatedEvidence;
  const evidenceSummary = summarizeAbilityEvidence(evidence);
  const topWeakness = rankWeaknesses(evidence, 3);
  const trainingEvidence = trainingEvidenceData.result.generatedEvidence.find((item) => item.source === 'training');
  const retestEvidence = trainingEvidenceData.result.generatedEvidence.find((item) => item.source === 'retest');
  const profile = generateStudentAbilityProfile({
    studentId,
    evidenceSummary,
    topWeakness,
    evidence,
    trainingEvidence,
    retestEvidence,
    generatedAt,
  });

  return {
    profile,
    evidenceSummary,
    topWeakness,
    trainingEvidenceData,
  };
}
