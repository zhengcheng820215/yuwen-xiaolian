import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import {
  type AbilityChangeSignal,
  normalizeTrainingEvidenceLoopResult,
  type RetestEvaluation,
  type TrainingEvidenceLoopInput,
  type TrainingEvidenceLoopResult,
  type TrainingImprovementStatus,
  type TrainingTaskEvaluation,
} from '../schemas/trainingEvaluation.schema.ts';

export function runTrainingEvidenceLoop(
  input: TrainingEvidenceLoopInput,
): TrainingEvidenceLoopResult {
  const trainingEvaluation = evaluateTrainingTask(input);
  const retestEvaluation = evaluateRetest(input, trainingEvaluation);
  const generatedEvidence = buildGeneratedEvidence(input, trainingEvaluation, retestEvaluation);
  const updatedEvidence = [...input.previousEvidence, ...generatedEvidence];
  const abilityChange = buildAbilityChangeSummary(input, updatedEvidence, retestEvaluation);

  return normalizeTrainingEvidenceLoopResult({
    studentId: input.studentId,
    ability: input.ability,
    originalWeakness: input.weakness,
    trainingFocus: input.trainingFocus,
    targetSkill: getTargetSkill(input),
    trainingEvaluation,
    retestEvaluation,
    abilityChange,
    generatedEvidence,
    updatedEvidence,
    summary: buildSummary(input, trainingEvaluation, retestEvaluation),
  });
}

function evaluateTrainingTask(input: TrainingEvidenceLoopInput): TrainingTaskEvaluation {
  const answer = input.studentTrainingAnswer.trim();
  const hasKeyword = /落叶|信件|秋天/.test(answer);
  const hasCausalExplanation = /因为|所以|表达|说明|记录|感受|时间|季节/.test(answer);
  const hasTextualReasoning = /记录|季节|时间|流逝|感受|变化|像/.test(answer);
  const processFindings: string[] = [];

  if (hasKeyword) {
    processFindings.push('能找到与任务相关的文本关键词。');
  } else {
    processFindings.push('尚未稳定定位任务中的关键文本信息。');
  }

  if (hasCausalExplanation && hasTextualReasoning) {
    processFindings.push('能够尝试说明文本信息与结论之间的关系。');
  } else {
    processFindings.push('仍缺少从文本依据到结论的因果解释。');
  }

  const status = inferTrainingStatus(hasKeyword, hasCausalExplanation, hasTextualReasoning);

  return {
    ability: input.ability,
    targetSkill: getTargetSkill(input),
    trainingTask: input.dayTask,
    studentAnswer: input.studentTrainingAnswer,
    status,
    processFindings,
    observation: buildTrainingObservation(status),
    confidence: status === 'improved' ? 0.78 : status === 'improving_not_stable' ? 0.68 : 0.56,
  };
}

function evaluateRetest(
  input: TrainingEvidenceLoopInput,
  trainingEvaluation: TrainingTaskEvaluation,
): RetestEvaluation {
  const answer = input.studentRetestAnswer.trim();
  const hasEvidence = /落叶|季节|变化|时间|流逝|文本|记录/.test(answer);
  const hasExplanation = /因为|表达|说明|感受|所以/.test(answer);
  const hasCompleteReasoning = hasEvidence && hasExplanation;
  const abilityChange = hasCompleteReasoning ? '+1' : trainingEvaluation.status === 'not_improved' ? '0' : '0';
  const transferLevel = hasCompleteReasoning ? 'successful' : hasEvidence || hasExplanation ? 'partial' : 'none';
  const abilityChangeSignal = inferAbilityChangeSignal(abilityChange, transferLevel);

  return {
    ability: input.ability,
    targetSkill: getTargetSkill(input),
    retestQuestion: input.retestQuestion,
    studentAnswer: input.studentRetestAnswer,
    abilityChange,
    abilityChangeSignal,
    transferLevel,
    comparison: abilityChange === '+1'
      ? `训练前主要问题是「${input.weakness}」；复测中已经能引用文本信息并完成解释。`
      : `训练后仍未稳定解决「${input.weakness}」，需要继续围绕 ${input.trainingFocus} 训练。`,
    observation: abilityChange === '+1'
      ? '复测答案能够结合文本信息完成较完整解释，可形成一次成长证据。'
      : '复测答案仍缺少稳定的文本依据或解释链，暂不判断为明显改善。',
    confidence: abilityChange === '+1' ? 0.82 : 0.62,
  };
}

function buildGeneratedEvidence(
  input: TrainingEvidenceLoopInput,
  trainingEvaluation: TrainingTaskEvaluation,
  retestEvaluation: RetestEvaluation,
): AbilityEvidence[] {
  const createdAt = input.createdAt || new Date().toISOString();

  const trainingEvidence = normalizeAbilityEvidence({
    id: `${input.studentId}-training-${input.ability}-${compactDate(createdAt)}`,
    studentId: input.studentId,
    ability: input.ability,
    evidenceType: trainingEvaluation.status === 'not_improved' ? 'weakness' : 'growth',
    reason: trainingEvaluation.status === 'not_improved' ? 'reasoning_error' : undefined,
    detail: trainingEvaluation.processFindings.join('；'),
    source: 'training',
    observation: trainingEvaluation.observation,
    rootCause: trainingEvaluation.status === 'not_improved'
      ? input.weakness
      : `训练中围绕「${input.trainingFocus}」出现改善迹象，但仍需复测确认。`,
    confidence: trainingEvaluation.confidence,
    createdAt,
    taskId: 'phase3-training-day-1',
  });
  const retestEvidence = normalizeAbilityEvidence({
    id: `${input.studentId}-retest-${input.ability}-${compactDate(createdAt)}`,
    studentId: input.studentId,
    ability: input.ability,
    evidenceType: retestEvaluation.abilityChange === '+1' ? 'growth' : 'weakness',
    reason: retestEvaluation.abilityChange === '+1' ? undefined : 'reasoning_error',
    detail: `transferLevel=${retestEvaluation.transferLevel}；${retestEvaluation.observation}`,
    source: 'retest',
    observation: retestEvaluation.observation,
    rootCause: retestEvaluation.abilityChange === '+1'
      ? `复测显示「${input.weakness}」已有改善迹象。`
      : input.weakness,
    confidence: retestEvaluation.confidence,
    createdAt: addMinutes(createdAt, 10),
    taskId: 'phase3-retest-1',
  });

  return [trainingEvidence, retestEvidence];
}

function buildAbilityChangeSummary(
  input: TrainingEvidenceLoopInput,
  updatedEvidence: AbilityEvidence[],
  retestEvaluation: RetestEvaluation,
) {
  const previousCounts = countEvidence(input.previousEvidence, input.ability);
  const afterCounts = countEvidence(updatedEvidence, input.ability);
  const change = retestEvaluation.abilityChangeSignal;

  return {
    ability: input.ability,
    before: previousCounts,
    after: afterCounts,
    change,
    reason: buildAbilityChangeReason(input, previousCounts, afterCounts, change, retestEvaluation),
  };
}

function countEvidence(evidenceList: AbilityEvidence[], ability: string) {
  const items = evidenceList.filter((item) => item.ability === ability);
  return {
    weaknessCount: items.filter((item) => item.evidenceType === 'weakness').length,
    positiveCount: items.filter((item) => item.evidenceType === 'positive').length,
    growthCount: items.filter((item) => item.evidenceType === 'growth').length,
  };
}

function buildAbilityChangeReason(
  input: TrainingEvidenceLoopInput,
  before: ReturnType<typeof countEvidence>,
  after: ReturnType<typeof countEvidence>,
  change: AbilityChangeSignal,
  retestEvaluation: RetestEvaluation,
): string {
  if (change === 'improved') {
    return `训练和复测均出现改善信号：${input.ability} 的 growth evidence 从 ${before.growthCount} 增至 ${after.growthCount}，且复测迁移水平为 ${retestEvaluation.transferLevel}。`;
  }

  if (change === 'unchanged') {
    return `训练任务中可能出现局部改善，但复测迁移水平为 ${retestEvaluation.transferLevel}，不足以证明稳定提升。`;
  }

  if (change === 'declined') {
    return `复测表现低于训练表现，需要重新检查训练目标和任务难度。`;
  }

  return `当前训练和复测证据不足，不能判断「${input.ability}」是否发生稳定变化。`;
}

function inferTrainingStatus(
  hasKeyword: boolean,
  hasCausalExplanation: boolean,
  hasTextualReasoning: boolean,
): TrainingImprovementStatus {
  if (hasKeyword && hasCausalExplanation && hasTextualReasoning) return 'improved';
  if (hasKeyword) return 'improving_not_stable';
  return 'not_improved';
}

function buildTrainingObservation(status: TrainingImprovementStatus): string {
  if (status === 'improved') {
    return '训练回答能够找到文本信息并尝试完成解释，推理链较训练前更完整。';
  }

  if (status === 'improving_not_stable') {
    return '训练回答能找到部分文本关键词，但仍缺少稳定的因果解释，属于有所改善但未稳定。';
  }

  return '训练回答仍未提供有效文本依据，原薄弱点暂未改善。';
}

function buildSummary(
  input: TrainingEvidenceLoopInput,
  trainingEvaluation: TrainingTaskEvaluation,
  retestEvaluation: RetestEvaluation,
): string {
  return `围绕「${input.ability} / ${getTargetSkill(input)}」完成一次训练与复测：训练状态为 ${trainingEvaluation.status}，复测变化为 ${retestEvaluation.abilityChangeSignal}，迁移水平为 ${retestEvaluation.transferLevel}。`;
}

function inferAbilityChangeSignal(
  abilityChange: RetestEvaluation['abilityChange'],
  transferLevel: RetestEvaluation['transferLevel'],
): AbilityChangeSignal {
  if (abilityChange === '+1' && transferLevel === 'successful') return 'improved';
  if (abilityChange === '-1') return 'declined';
  if (transferLevel === 'partial') return 'unchanged';
  return 'insufficient_data';
}

function getTargetSkill(input: TrainingEvidenceLoopInput): string {
  return input.targetSkill || input.trainingFocus || `${input.ability}目标技能`;
}

function compactDate(value: string): string {
  return value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
}

function addMinutes(isoValue: string, minutes: number): string {
  const date = new Date(isoValue);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}
