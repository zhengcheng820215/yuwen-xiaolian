import mockEvidence from '../data/studentAbilityEvidence.mock.json';
import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../ai/schemas/abilityEvidence.schema.ts';
import {
  rankWeaknesses,
  summarizeAbilityEvidence,
} from '../ai/agents/weaknessRankingAgent.ts';
import { generateTrainingPlan } from '../ai/agents/trainingPlanAgent.ts';

const studentId = 'demo-student';
const generatedAt = '2026-07-08T10:00:00.000Z';

const phase32DemoEvidence: Partial<AbilityEvidence>[] = [
  {
    id: 'phase321-diagnosis-inference-001',
    studentId,
    ability: '推理',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生有结论，但没有写出文本线索到结论的推理链。',
    rootCause: '缺少文本依据，推理链不完整。',
    confidence: 0.74,
    createdAt: '2026-07-08T09:00:00.000Z',
    taskId: 'task-inference-001',
    diagnosisId: 'diagnosis-inference-001',
  },
  {
    id: 'phase321-diagnosis-inference-002',
    studentId,
    ability: '推理',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生用主观判断替代文本依据。',
    rootCause: '尚未建立从文本线索到结论的推理链。',
    confidence: 0.69,
    createdAt: '2026-07-08T09:05:00.000Z',
    taskId: 'task-inference-002',
    diagnosisId: 'diagnosis-inference-002',
  },
  {
    id: 'phase321-diagnosis-expression-001',
    studentId,
    ability: '表达',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生能表达观点，但缺少依据和说明。',
    rootCause: '答案组织不完整，尚未形成观点、依据、说明的表达结构。',
    confidence: 0.67,
    createdAt: '2026-07-08T09:10:00.000Z',
    taskId: 'task-expression-001',
    diagnosisId: 'diagnosis-expression-001',
  },
  {
    id: 'phase321-diagnosis-extraction-001',
    studentId,
    ability: '信息提取',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生找到部分信息，但遗漏题干限定条件。',
    rootCause: '关键文本定位不稳定，容易遗漏题干限定条件。',
    confidence: 0.71,
    createdAt: '2026-07-08T09:15:00.000Z',
    taskId: 'task-extraction-001',
    diagnosisId: 'diagnosis-extraction-001',
  },
  {
    id: 'phase321-diagnosis-summary-001',
    studentId,
    ability: '概括',
    evidenceType: 'positive',
    source: 'diagnosis',
    observation: '学生能够提取核心事件并概括主要内容。',
    rootCause: '本次概括任务已达到要求。',
    confidence: 0.81,
    createdAt: '2026-07-08T09:20:00.000Z',
    taskId: 'task-summary-001',
    diagnosisId: 'diagnosis-summary-001',
  },
];

export function getTrainingPlanDemoData() {
  const evidence = [
    ...(mockEvidence as Partial<AbilityEvidence>[]),
    ...phase32DemoEvidence,
  ].map((item) => normalizeAbilityEvidence(item));
  const evidenceSummary = summarizeAbilityEvidence(evidence);
  const topWeakness = rankWeaknesses(evidence, 3);
  const trainingPlan = generateTrainingPlan({
    studentId,
    weaknessRanking: topWeakness,
    evidenceSummary,
    generatedAt,
  });

  return {
    evidence,
    evidenceSummary,
    topWeakness,
    trainingPlan,
  };
}
