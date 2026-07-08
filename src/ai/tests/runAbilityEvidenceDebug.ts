import { readFileSync } from 'node:fs';
import { normalizeDiagnosisResult, type DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  type AbilityEvidence,
  isAbilityEvidence,
  normalizeAbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import { extractAbilityEvidenceFromDiagnosis } from '../agents/abilityEvidenceExtractor.ts';
import {
  rankWeaknesses,
  summarizeAbilityEvidence,
  type WeaknessRankingItem,
} from '../agents/weaknessRankingAgent.ts';

type MockDiagnosisCase = {
  id: string;
  taskId: string;
  title: string;
  diagnosisResult: DiagnosisResult;
};

const studentId = 'demo-student';
const debugCreatedAt = '2026-07-08T09:00:00.000Z';

const mockDiagnosisCases: MockDiagnosisCase[] = [
  {
    id: 'diagnosis-inference-001',
    taskId: 'task-inference-001',
    title: '推理题：缺少文本依据',
    diagnosisResult: normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'debug_mock',
      answerStatus: 'partially_meets',
      scoreBand: 'medium',
      mainAbility: '推理',
      relatedAbilities: ['信息提取', '理解', '表达'],
      surfaceError: '学生答案有结论，但缺少文本依据和推理过程。',
      rootCause: '缺少文本依据，推理链不完整。',
      errorType: '推理错误',
      abilityEvidence: ['学生能够给出判断，但没有说明判断来自哪些文本线索。'],
      diagnosisSummary: '推理任务部分满足要求。',
      nextTraining: '进入文本线索提取和推理链表达训练。',
      confidence: 0.74,
    }),
  },
  {
    id: 'diagnosis-inference-002',
    taskId: 'task-inference-002',
    title: '推理题：推理链跳跃',
    diagnosisResult: normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'debug_mock',
      answerStatus: 'does_not_meet',
      scoreBand: 'low',
      mainAbility: '推理',
      relatedAbilities: ['信息提取', '理解', '表达'],
      surfaceError: '学生用主观判断替代文本线索。',
      rootCause: '学生尚未建立从文本线索到结论的推理链。',
      errorType: '推理错误',
      abilityEvidence: ['学生答案未回到文本依据。'],
      diagnosisSummary: '推理任务未满足要求。',
      nextTraining: '进入基于文本依据的推理链训练。',
      confidence: 0.69,
    }),
  },
  {
    id: 'diagnosis-expression-001',
    taskId: 'task-expression-001',
    title: '表达题：要点不完整',
    diagnosisResult: normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'debug_mock',
      answerStatus: 'partially_meets',
      scoreBand: 'medium',
      mainAbility: '表达',
      relatedAbilities: ['信息提取', '理解'],
      surfaceError: '学生答案有观点，但缺少依据和说明。',
      rootCause: '答案组织不完整，尚未形成观点、依据、说明的表达结构。',
      errorType: '表达错误',
      abilityEvidence: ['学生能表达人物特点，但没有补充文本依据。'],
      diagnosisSummary: '表达任务部分满足要求。',
      nextTraining: '进入结构化表达训练。',
      confidence: 0.67,
    }),
  },
  {
    id: 'diagnosis-summary-001',
    taskId: 'task-summary-001',
    title: '概括题：完整满足',
    diagnosisResult: normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: true,
      strategyUsed: 'debug_mock',
      answerStatus: 'fully_meets',
      scoreBand: 'high',
      mainAbility: '概括',
      relatedAbilities: ['信息提取', '理解', '表达'],
      surfaceError: '学生答案完整覆盖核心事件和主题。',
      rootCause: '无补弱型 rootCause：学生答案已达到本题开放作答要求。',
      errorType: '待验证',
      abilityEvidence: ['学生能够提取核心事件并概括主题。'],
      diagnosisSummary: '概括任务完整满足要求。',
      nextTraining: '进入迁移验证或提高难度。',
      confidence: 0.81,
    }),
  },
  {
    id: 'diagnosis-invalid-001',
    taskId: 'task-invalid-001',
    title: '无效答案：无法评估',
    diagnosisResult: normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'debug_mock',
      answerStatus: 'insufficient_evidence',
      scoreBand: 'invalid',
      mainAbility: '理解',
      relatedAbilities: ['信息提取', '表达'],
      surfaceError: '学生答案未提供有效分析内容，暂不能形成稳定能力判断。',
      rootCause: '学生答案未提供有效分析内容，暂无法判断具体能力缺口。',
      errorType: '待验证',
      abilityEvidence: ['本轮仅判断为作答证据不足。'],
      diagnosisSummary: '理解任务证据不足。',
      nextTraining: '先补充有效作答，再进行能力诊断。',
      confidence: 0.35,
    }),
  },
  {
    id: 'diagnosis-extraction-001',
    taskId: 'task-extraction-001',
    title: '信息提取题：定位不稳',
    diagnosisResult: normalizeDiagnosisResult({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'debug_mock',
      answerStatus: 'partially_meets',
      scoreBand: 'medium',
      mainAbility: '信息提取',
      relatedAbilities: ['理解', '表达'],
      surfaceError: '学生找到部分信息，但遗漏限定条件。',
      rootCause: '关键文本定位不稳定，容易遗漏题干限定条件。',
      errorType: '定位错误',
      abilityEvidence: ['学生能找到相关段落，但遗漏数量或范围要求。'],
      diagnosisSummary: '信息提取任务部分满足要求。',
      nextTraining: '进入关键词定位与限定条件标注训练。',
      confidence: 0.71,
    }),
  },
];

function runAbilityEvidenceDebug(): void {
  const historicalEvidence = loadHistoricalEvidence();
  const generatedEvidence = mockDiagnosisCases.map((diagnosisCase, index) => (
    extractAbilityEvidenceFromDiagnosis(diagnosisCase.diagnosisResult, {
      studentId,
      taskId: diagnosisCase.taskId,
      diagnosisId: diagnosisCase.id,
      createdAt: addMinutes(debugCreatedAt, index),
    })
  ));
  const allEvidence = [...historicalEvidence, ...generatedEvidence];
  const summaries = summarizeAbilityEvidence(allEvidence);
  const ranking = rankWeaknesses(allEvidence, 3);
  const failures: string[] = [];

  validateGeneratedEvidence(generatedEvidence, failures);
  validateRanking(ranking, failures);
  validateInsufficientHandling(generatedEvidence, ranking, failures);

  printReport(historicalEvidence, generatedEvidence, summaries, ranking, failures);

  if (failures.length > 0) {
    throw new Error('Ability Evidence debug check failed.');
  }
}

function loadHistoricalEvidence(): AbilityEvidence[] {
  const evidenceUrl = new URL('../../data/studentAbilityEvidence.mock.json', import.meta.url);
  const raw = readFileSync(evidenceUrl, 'utf8');
  const parsed = JSON.parse(raw) as unknown[];

  return parsed.map((item) => normalizeAbilityEvidence(item as Partial<AbilityEvidence>));
}

function validateGeneratedEvidence(evidenceList: AbilityEvidence[], failures: string[]): void {
  if (evidenceList.length !== mockDiagnosisCases.length) {
    failures.push(`Expected ${mockDiagnosisCases.length} generated evidence records, got ${evidenceList.length}.`);
  }

  for (const evidence of evidenceList) {
    if (!isAbilityEvidence(evidence)) {
      failures.push(`Invalid AbilityEvidence: ${JSON.stringify(evidence)}`);
    }
  }

  const generatedTypes = new Set(evidenceList.map((item) => item.evidenceType));
  for (const requiredType of ['positive', 'weakness', 'insufficient']) {
    if (!generatedTypes.has(requiredType as AbilityEvidence['evidenceType'])) {
      failures.push(`Generated evidence should include evidenceType="${requiredType}".`);
    }
  }
}

function validateRanking(ranking: WeaknessRankingItem[], failures: string[]): void {
  if (ranking.length === 0) {
    failures.push('Weakness ranking should include at least one item.');
  }

  for (const item of ranking) {
    if (item.weaknessCount <= 0) {
      failures.push(`Ranking item "${item.ability}" has no weakness evidence.`);
    }
    if (item.reasons.length === 0) {
      failures.push(`Ranking item "${item.ability}" should include reasons.`);
    }
    if (!item.suggestedTrainingFocus) {
      failures.push(`Ranking item "${item.ability}" should include suggestedTrainingFocus.`);
    }
  }

  if (ranking[0]?.ability !== '推理') {
    failures.push(`Top weakness should be "推理", got "${ranking[0]?.ability}".`);
  }
}

function validateInsufficientHandling(
  generatedEvidence: AbilityEvidence[],
  ranking: WeaknessRankingItem[],
  failures: string[],
): void {
  const insufficientEvidence = generatedEvidence.find((item) => item.evidenceType === 'insufficient');

  if (!insufficientEvidence) {
    failures.push('Debug fixture should include insufficient evidence.');
    return;
  }

  if (insufficientEvidence.ability === ranking[0]?.ability) {
    failures.push('Insufficient evidence should not become the top weakness by itself.');
  }
}

function printReport(
  historicalEvidence: AbilityEvidence[],
  generatedEvidence: AbilityEvidence[],
  summaries: ReturnType<typeof summarizeAbilityEvidence>,
  ranking: WeaknessRankingItem[],
  failures: string[],
): void {
  console.log('\nAbility Evidence Debug Report');
  console.log('=============================');
  console.log(`Total Diagnosis Results: ${mockDiagnosisCases.length}`);
  console.log(`Generated Evidence: ${generatedEvidence.length}`);
  console.log(`Historical Mock Evidence: ${historicalEvidence.length}`);
  console.log(`Total Evidence: ${generatedEvidence.length + historicalEvidence.length}`);

  console.log('\nDiagnosis -> Evidence');
  console.log('--------------------');
  for (let index = 0; index < mockDiagnosisCases.length; index += 1) {
    const diagnosisCase = mockDiagnosisCases[index];
    const evidence = generatedEvidence[index];
    console.log(`[${index + 1}] ${diagnosisCase.title}`);
    console.log(`    diagnosis: ${diagnosisCase.diagnosisResult.mainAbility} / ${diagnosisCase.diagnosisResult.answerStatus} / confidence ${formatPercent(diagnosisCase.diagnosisResult.confidence)}`);
    console.log(`    evidence: ${evidence.ability} / ${evidence.evidenceType} / ${evidence.observation}`);
  }

  console.log('\nEvidence Summary');
  console.log('----------------');
  for (const summary of summaries) {
    console.log(`${summary.ability}: weakness ${summary.weaknessCount}, positive ${summary.positiveCount}, growth ${summary.growthCount}, insufficient ${summary.insufficientCount}, avgConfidence ${formatPercent(summary.averageConfidence)}`);
  }

  console.log('\nTop Weakness');
  console.log('------------');
  for (let index = 0; index < ranking.length; index += 1) {
    const item = ranking[index];
    console.log(`${index + 1}. ${item.ability}`);
    console.log(`   priority: ${item.priority}`);
    console.log(`   weaknessCount: ${item.weaknessCount}`);
    console.log(`   positiveCount: ${item.positiveCount}`);
    console.log(`   insufficientCount: ${item.insufficientCount}`);
    console.log(`   averageConfidence: ${formatPercent(item.averageConfidence)}`);
    console.log('   reasons:');
    for (const reason of item.reasons) {
      console.log(`   - ${reason}`);
    }
    console.log(`   suggestedTrainingFocus: ${item.suggestedTrainingFocus}`);
  }

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Ability Evidence debug demo meets Phase 3.1 minimum loop acceptance.');
  } else {
    console.log('[FAIL] Ability Evidence debug demo did not meet acceptance.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
}

function addMinutes(isoValue: string, minutes: number): string {
  const date = new Date(isoValue);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

runAbilityEvidenceDebug();
