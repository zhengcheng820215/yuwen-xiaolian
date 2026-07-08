import mockEvidence from '../data/studentAbilityEvidence.mock.json';
import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../ai/schemas/abilityEvidence.schema.ts';
import { runTrainingEvidenceLoop } from '../ai/agents/trainingEvaluationAgent.ts';
import { summarizeAbilityEvidence } from '../ai/agents/weaknessRankingAgent.ts';

const studentId = 'demo-student';
const createdAt = '2026-07-08T11:00:00.000Z';

export function getTrainingEvidenceDemoData() {
  const previousEvidence = (mockEvidence as Partial<AbilityEvidence>[]).map((item) => (
    normalizeAbilityEvidence(item)
  ));
  const result = runTrainingEvidenceLoop({
    studentId,
    ability: '推理',
    weakness: '推理链不完整',
    trainingFocus: '文本依据 + 推理链训练',
    dayTask: '阅读短文，回答：作者为什么说“秋天的落叶像信件”？',
    studentTrainingAnswer: '因为落叶很多。',
    retestQuestion: '作者为什么说“落叶记录了季节变化”？',
    studentRetestAnswer: '因为落叶记录了季节变化，表达作者对时间流逝的感受。',
    previousEvidence,
    createdAt,
  });

  return {
    previousEvidence,
    previousSummary: summarizeAbilityEvidence(previousEvidence),
    result,
    updatedSummary: summarizeAbilityEvidence(result.updatedEvidence),
  };
}
