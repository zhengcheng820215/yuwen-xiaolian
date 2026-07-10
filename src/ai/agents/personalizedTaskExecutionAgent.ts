import { runRealAIDiagnosisLoop, type RealAIDiagnosisResult } from './realAIDiagnosisAgent.ts';
import { generateStudentAbilityProfile } from './studentAbilityProfileAgent.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
  type AbilityEvidenceSummary,
} from './weaknessRankingAgent.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { QuestionMetadata } from '../schemas/diagnosis.schema.ts';
import type { PersonalizedNextTask } from '../schemas/personalizedNextTask.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import {
  type PersonalizedTaskExecutionSummary,
  type PersonalizedTaskNextDecision,
} from '../schemas/personalizedTaskExecution.schema.ts';

export type PersonalizedTaskExecutionInput = {
  studentId: string;
  studentAbilityProfile: StudentAbilityProfile;
  evidenceSummary: AbilityEvidenceSummary[];
  updatedEvidence: AbilityEvidence[];
  personalizedNextTask: PersonalizedNextTask;
  studentAnswer: string;
  createdAt?: string;
};

export type PersonalizedTaskExecutionResult = {
  diagnosisResult: RealAIDiagnosisResult['diagnosisResult'];
  newAbilityEvidence: AbilityEvidence;
  updatedEvidence: AbilityEvidence[];
  updatedStudentAbilityProfile: StudentAbilityProfile;
  taskExecutionSummary: PersonalizedTaskExecutionSummary;
  next_decision: PersonalizedTaskNextDecision;
  diagnosisFocusMatch: boolean;
  diagnosisLoopResult: RealAIDiagnosisResult;
};

export async function runPersonalizedTaskExecutionAgent(
  input: PersonalizedTaskExecutionInput,
): Promise<PersonalizedTaskExecutionResult> {
  const targetAbility = input.personalizedNextTask.target_ability;
  const createdAt = input.createdAt || new Date().toISOString();
  const beforeSummary = findAbilitySummary(input.evidenceSummary, targetAbility);
  const diagnosisLoopResult = await runRealAIDiagnosisLoop({
    studentId: input.studentId,
    question: input.personalizedNextTask.question,
    referenceAnswer: buildReferenceAnswer(input.personalizedNextTask),
    studentAnswer: input.studentAnswer,
    questionMetadata: buildQuestionMetadata(input.personalizedNextTask),
    previousEvidence: input.updatedEvidence,
    taskId: input.personalizedNextTask.task_id,
    diagnosisId: `phase52-diagnosis-${input.personalizedNextTask.task_id}`,
    createdAt,
  });
  const diagnosisFocusMatch = isDiagnosisFocusMatch({
    targetAbility,
    diagnosisMainAbility: diagnosisLoopResult.diagnosisResult.mainAbility,
    newEvidenceAbility: diagnosisLoopResult.newAbilityEvidence.ability,
  });
  const acceptedUpdatedEvidence = diagnosisFocusMatch
    ? diagnosisLoopResult.updatedEvidence
    : input.updatedEvidence;
  const afterEvidenceSummary = summarizeAbilityEvidence(acceptedUpdatedEvidence);
  const afterTopWeakness = rankWeaknessSummaries(afterEvidenceSummary, 3);
  const updatedStudentAbilityProfile = generateStudentAbilityProfile({
    studentId: input.studentId,
    evidenceSummary: afterEvidenceSummary,
    topWeakness: afterTopWeakness,
    evidence: acceptedUpdatedEvidence,
    generatedAt: createdAt,
  });
  const afterSummary = findAbilitySummary(afterEvidenceSummary, targetAbility);
  const taskExecutionSummary = buildTaskExecutionSummary({
    targetAbility,
    beforeSummary,
    afterSummary,
    personalizedNextTask: input.personalizedNextTask,
    studentAnswer: input.studentAnswer,
    diagnosisLoopResult,
    evidenceUpdated: diagnosisFocusMatch,
    diagnosisFocusMatch,
  });

  return {
    diagnosisResult: diagnosisLoopResult.diagnosisResult,
    newAbilityEvidence: diagnosisLoopResult.newAbilityEvidence,
    updatedEvidence: acceptedUpdatedEvidence,
    updatedStudentAbilityProfile,
    taskExecutionSummary,
    next_decision: taskExecutionSummary.next_decision,
    diagnosisFocusMatch,
    diagnosisLoopResult,
  };
}

function buildReferenceAnswer(task: PersonalizedNextTask): string {
  return [
    task.reference_answer,
    `评分要点：${task.scoring_points.join('；')}`,
    `成功标准：${task.success_criteria.join('；')}`,
    `下一轮诊断重点：${task.expected_diagnosis_focus.join('；')}`,
  ].join('\n');
}

function buildQuestionMetadata(task: PersonalizedNextTask): QuestionMetadata {
  return {
    questionId: task.task_id,
    subject: '语文',
    questionType: task.target_ability,
    assessmentMode: inferAssessmentMode(task.target_ability),
    mainAbility: task.target_ability,
    relatedAbilities: inferRelatedAbilities(task.target_ability),
    abilityPath: inferAbilityPath(task.target_ability),
    rubric: task.scoring_points.map((point, index) => ({
      id: `task-rubric-${index + 1}`,
      name: point,
      description: point,
      ability: task.target_ability,
      required: true,
      weight: Math.round(100 / Math.max(task.scoring_points.length, 1)),
    })),
    trainingDirection: task.expected_diagnosis_focus,
  };
}

function inferAssessmentMode(ability: string): QuestionMetadata['assessmentMode'] {
  if (ability === '表达') return 'expression_quality';
  if (ability === '信息提取') return 'process_operation';
  if (ability === '概括') return 'key_points';
  if (ability === '推理') return 'reasoning_chain';
  if (ability === '理解') return 'reasoning_chain';
  return 'key_points';
}

function inferRelatedAbilities(ability: string): string[] {
  const map: Record<string, string[]> = {
    推理: ['信息提取', '理解', '推理', '表达'],
    表达: ['理解', '表达', '文本依据组织'],
    概括: ['信息提取', '要点筛选', '概括', '表达'],
    理解: ['信息提取', '语境理解', '理解', '表达'],
    信息提取: ['信息提取', '定位', '限定条件识别'],
    分析: ['信息提取', '理解', '分析', '表达'],
  };

  return map[ability] || [ability];
}

function inferAbilityPath(ability: string): string[] {
  const map: Record<string, string[]> = {
    推理: ['文本线索提取', '人物心理判断', '推理链表达'],
    表达: ['观点形成', '文本依据组织', '解释说明'],
    概括: ['信息提取', '要点筛选', '主题提炼'],
    理解: ['字面含义理解', '语境分析', '深层含义理解'],
    信息提取: ['定位信息', '提取关键词', '识别限定条件'],
    分析: ['提取依据', '解释作用', '联系主题'],
  };

  return map[ability] || [ability];
}

function isDiagnosisFocusMatch(input: {
  targetAbility: string;
  diagnosisMainAbility: string;
  newEvidenceAbility: string;
}): boolean {
  return (
    input.diagnosisMainAbility === input.targetAbility &&
    input.newEvidenceAbility === input.targetAbility
  );
}

function buildTaskExecutionSummary(input: {
  targetAbility: string;
  beforeSummary?: AbilityEvidenceSummary;
  afterSummary?: AbilityEvidenceSummary;
  personalizedNextTask: PersonalizedNextTask;
  studentAnswer: string;
  diagnosisLoopResult: RealAIDiagnosisResult;
  evidenceUpdated: boolean;
  diagnosisFocusMatch: boolean;
}): PersonalizedTaskExecutionSummary {
  const beforeWeaknessCount = input.beforeSummary?.weaknessCount || 0;
  const beforeGrowthCount = input.beforeSummary?.growthCount || 0;
  const afterWeaknessCount = input.afterSummary?.weaknessCount || 0;
  const afterGrowthCount = input.afterSummary?.growthCount || 0;
  const afterPositiveCount = input.afterSummary?.positiveCount || 0;
  const decision = decideNextStep({
    diagnosisFocusMatch: input.diagnosisFocusMatch,
    newEvidenceType: input.diagnosisLoopResult.newAbilityEvidence.evidenceType,
    beforeWeaknessCount,
    afterWeaknessCount,
    afterGrowthCount,
    afterPositiveCount,
  });

  return {
    before: {
      target_ability: input.targetAbility,
      weakness_evidence_count: beforeWeaknessCount,
      growth_evidence_count: beforeGrowthCount,
      status: buildBeforeStatus(input.beforeSummary),
      reason: buildBeforeReason(input.beforeSummary, input.targetAbility),
    },
    execution: {
      task_id: input.personalizedNextTask.task_id,
      target_ability: input.targetAbility,
      student_answer: input.studentAnswer,
      diagnosis_answer_status: input.diagnosisLoopResult.diagnosisResult.answerStatus || 'unknown',
      diagnosis_main_ability: input.diagnosisLoopResult.diagnosisResult.mainAbility,
      diagnosis_focus_match: input.diagnosisFocusMatch,
      new_evidence_type: input.diagnosisLoopResult.newAbilityEvidence.evidenceType,
    },
    after: {
      target_ability: input.targetAbility,
      evidence_updated: input.evidenceUpdated,
      weakness_evidence_count: afterWeaknessCount,
      growth_evidence_count: afterGrowthCount,
      status: buildAfterStatus({
        diagnosisFocusMatch: input.diagnosisFocusMatch,
        newEvidenceType: input.diagnosisLoopResult.newAbilityEvidence.evidenceType,
        afterWeaknessCount,
        afterGrowthCount,
        afterPositiveCount,
      }),
    },
    review_status: input.diagnosisFocusMatch ? 'PASS' : 'REVIEW',
    review_reason: input.diagnosisFocusMatch
      ? 'DiagnosisResult.mainAbility 与 PersonalizedNextTask.target_ability 一致，本次证据可进入目标能力更新。'
      : 'DiagnosisResult.mainAbility 与 PersonalizedNextTask.target_ability 不一致，本次结果仅保留为执行摘要，不直接更新目标能力判断。',
    next_decision: decision.nextDecision,
    decision_reason: decision.reason,
  };
}

function decideNextStep(input: {
  diagnosisFocusMatch: boolean;
  newEvidenceType: string;
  beforeWeaknessCount: number;
  afterWeaknessCount: number;
  afterGrowthCount: number;
  afterPositiveCount: number;
}): { nextDecision: PersonalizedTaskNextDecision; reason: string } {
  if (!input.diagnosisFocusMatch) {
    return {
      nextDecision: 'continue_reinforcement',
      reason: '诊断焦点与任务目标能力不一致，不能据此提高难度或切换能力，需继续围绕原目标能力训练或复核诊断。',
    };
  }

  if (input.newEvidenceType === 'weakness') {
    return {
      nextDecision: 'continue_reinforcement',
      reason: '本次任务仍生成 weakness evidence，说明目标能力缺口仍存在，需要继续强化。',
    };
  }

  if (input.newEvidenceType === 'growth' && input.afterWeaknessCount > 0) {
    return {
      nextDecision: 'continue_reinforcement',
      reason: '本次出现 growth evidence，但同能力历史 weakness 仍存在，先继续巩固而非直接切换能力。',
    };
  }

  if (input.newEvidenceType === 'growth') {
    return {
      nextDecision: 'increase_difficulty',
      reason: '本次出现 growth evidence，且目标能力薄弱压力下降，可以提高同能力任务难度。',
    };
  }

  if (input.newEvidenceType === 'positive' && input.afterWeaknessCount > 0) {
    return {
      nextDecision: 'retest',
      reason: '本次表现达到要求，但历史 weakness 仍存在，需要通过同能力迁移复测确认稳定性。',
    };
  }

  if (input.newEvidenceType === 'positive' && input.afterPositiveCount > 0) {
    return {
      nextDecision: 'switch_ability',
      reason: '目标能力出现 positive evidence，当前可降低该能力优先级，观察是否存在更突出的次级薄弱能力。',
    };
  }

  return {
    nextDecision: 'continue_reinforcement',
    reason: '本次 evidence 不足以支持提高难度或切换能力，继续收集同能力作答证据。',
  };
}

function findAbilitySummary(
  evidenceSummary: AbilityEvidenceSummary[],
  targetAbility: string,
): AbilityEvidenceSummary | undefined {
  return evidenceSummary.find((item) => item.ability === targetAbility);
}

function buildBeforeStatus(summary: AbilityEvidenceSummary | undefined): string {
  if (!summary) return 'insufficient_evidence';
  if (summary.weaknessCount > 0 && summary.growthCount > 0) return 'improving';
  if (summary.weaknessCount > 0) return 'weak';
  if (summary.positiveCount > 0 || summary.growthCount > 0) return 'stable_positive';
  return 'insufficient_evidence';
}

function buildBeforeReason(summary: AbilityEvidenceSummary | undefined, targetAbility: string): string {
  if (!summary) return `训练前缺少「${targetAbility}」的有效 evidence，需要通过本次任务补充观察。`;

  const rootCause = summary.rootCauses[0] || summary.observations[0] || '存在历史薄弱证据。';
  return `训练前「${targetAbility}」包含 ${summary.weaknessCount} 条 weakness evidence；主要依据：${rootCause}`;
}

function buildAfterStatus(input: {
  diagnosisFocusMatch: boolean;
  newEvidenceType: string;
  afterWeaknessCount: number;
  afterGrowthCount: number;
  afterPositiveCount: number;
}): string {
  if (!input.diagnosisFocusMatch) return 'review_required';
  if (input.afterWeaknessCount > 0 && input.afterGrowthCount > 0) return 'improving';
  if (input.afterWeaknessCount > 0) return 'weak';
  if (input.afterPositiveCount > 0 || input.afterGrowthCount > 0) return 'stable_positive';
  if (input.newEvidenceType === 'insufficient') return 'insufficient_evidence';
  return 'insufficient_evidence';
}
