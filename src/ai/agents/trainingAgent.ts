import { buildTrainingPrompt } from '../prompts/buildTrainingPrompt.ts';
import {
  type TrainingInput,
  type TrainingResult,
  normalizeTrainingResult,
} from '../schemas/training.schema.ts';

type LLMCaller = (prompt: string, input: TrainingInput) => Promise<string>;

export async function runTrainingAgent(
  input: TrainingInput,
  callLLM: LLMCaller = mockCallLLM,
): Promise<TrainingResult> {
  const prompt = buildTrainingPrompt(input);
  const rawResult = await callLLM(prompt, input);

  try {
    return normalizeTrainingResult(JSON.parse(rawResult));
  } catch {
    return normalizeTrainingResult({
      targetAbility: input.diagnosisResult.mainAbility,
      rootCause: input.diagnosisResult.rootCause,
      trainingGoal: '训练结果解析失败，暂不形成正式训练方案',
      trainingStrategy: '待重新生成',
      trainingSteps: ['重新生成结构化训练方案'],
      practiceTasks: [],
      coachGuidance: ['先确认诊断结果，再重新生成训练计划'],
      completionCriteria: ['获得可解析的结构化训练 JSON'],
      nextEvaluation: '重新生成训练方案后再进入评估',
      confidence: 0.1,
    });
  }
}

async function mockCallLLM(_prompt: string, input: TrainingInput): Promise<string> {
  const { diagnosisResult } = input;
  const targetAbility = diagnosisResult.mainAbility;
  const rootCause = diagnosisResult.rootCause;
  const isPositiveEvidence = diagnosisResult.correct === true || diagnosisResult.answerStatus === 'fully_meets';
  const strategy = inferTrainingStrategy(targetAbility, diagnosisResult.errorType);

  const result: TrainingResult = {
    targetAbility,
    rootCause,
    trainingGoal: isPositiveEvidence
      ? `巩固「${targetAbility}」能力的正向表现，并通过新任务验证迁移稳定性。`
      : buildTrainingGoal(targetAbility),
    trainingStrategy: isPositiveEvidence ? '巩固训练 + 迁移验证' : strategy,
    trainingSteps: isPositiveEvidence
      ? buildPositiveTrainingSteps(targetAbility)
      : buildTrainingSteps(targetAbility, diagnosisResult.errorType),
    practiceTasks: isPositiveEvidence ? buildPositivePracticeTasks(targetAbility) : buildPracticeTasks(targetAbility),
    coachGuidance: isPositiveEvidence ? buildPositiveCoachGuidance(targetAbility) : buildCoachGuidance(targetAbility),
    completionCriteria: isPositiveEvidence ? buildPositiveCompletionCriteria(targetAbility) : buildCompletionCriteria(targetAbility),
    nextEvaluation: isPositiveEvidence
      ? `使用更高难度或不同文本任务验证「${targetAbility}」能力是否能够迁移应用。`
      : `完成训练后，使用同能力但不同文本的任务复测「${targetAbility}」是否能够独立、稳定、迁移应用。`,
    confidence: Math.min(0.85, Math.max(0.35, diagnosisResult.confidence + 0.08)),
  };

  return JSON.stringify(result);
}

function inferTrainingStrategy(targetAbility: string, errorType: string): string {
  if (errorType === '定位错误') return '针对训练 + 重复强化';
  if (errorType === '表达错误') return '结构化表达训练 + 渐进训练';
  if (targetAbility === '概括') return '核心信息筛选训练 + 变式训练';
  if (targetAbility === '推理') return '依据链训练 + 迁移训练';
  if (targetAbility === '分析') return '分析对象拆解训练 + 综合训练';
  return '针对训练 + 渐进训练';
}

function buildTrainingGoal(targetAbility: string): string {
  const goals: Record<string, string> = {
    信息提取: '帮助学生稳定定位文本依据，识别关键词和限定条件。',
    理解: '帮助学生准确理解题意、词句含义和文本语境。',
    概括: '帮助学生区分主要信息与次要细节，形成简洁准确的核心表达。',
    分析: '帮助学生围绕分析对象提取依据，并说明文本内容、手法或情感的作用。',
    推理: '帮助学生基于文本依据形成完整、合理的推理链。',
    表达: '帮助学生用“依据 + 分析 + 结论”的结构完整表达思考。',
  };

  return goals[targetAbility] || `帮助学生建立更稳定的「${targetAbility}」能力。`;
}

function buildTrainingSteps(targetAbility: string, errorType: string): string[] {
  return [
    `回顾诊断结果，确认本次训练只聚焦「${targetAbility}」能力。`,
    `让学生指出原答案中与「${errorType}」相关的具体表现。`,
    '引导学生回到题目和文本，补足缺失的能力步骤。',
    '让学生用自己的语言重新组织答案或思考过程。',
    '提供一题同能力小任务，观察学生是否能减少提示依赖。',
  ];
}

function buildPracticeTasks(targetAbility: string): string[] {
  const tasks: Record<string, string[]> = {
    信息提取: ['标出题干限定条件', '从文本中圈出关键词和关键句', '用一句话说明答案依据来自哪里'],
    理解: ['解释题干要求', '用自己的话改写关键句含义', '说明该句与上下文的关系'],
    概括: ['划掉无关细节', '提取对象、事件、结果', '用一句话概括核心意思'],
    分析: ['明确分析对象', '找出文本依据', '说明依据如何支持分析结论'],
    推理: ['列出文本线索', '写出依据到结论的推理链', '检查结论是否过度推断'],
    表达: ['补充文本依据', '按“依据 + 分析 + 结论”重写答案', '检查答案是否完整回应题干'],
  };

  return tasks[targetAbility] || ['回到诊断证据', '补足缺失步骤', '完成一次同能力变式练习'];
}

function buildCoachGuidance(targetAbility: string): string[] {
  return [
    '先提问，不直接给答案。',
    '如果学生停滞，先给轻提示，再给定位提示。',
    `反馈时明确指出学生在「${targetAbility}」能力上的稳定表现和缺口。`,
    '学生完成修正后，追问其文本依据或思考步骤。',
    '当学生能够独立完成时，减少提示并进入变式任务。',
  ];
}

function buildCompletionCriteria(targetAbility: string): string[] {
  return [
    `学生能够独立完成一次「${targetAbility}」能力任务。`,
    '学生能够说明自己的文本依据或思考步骤。',
    '学生能够根据反馈完成有效修正。',
    '学生能够在同能力变式任务中保持基本稳定。',
    '系统形成至少一条可进入能力画像的训练证据。',
  ];
}

function buildPositiveTrainingSteps(targetAbility: string): string[] {
  return [
    `确认本次「${targetAbility}」表现已达到任务要求。`,
    '让学生复述自己完成任务时使用的思考方法。',
    '提供一题同能力但不同文本的变式任务。',
    '减少提示，观察学生是否能独立迁移。',
  ];
}

function buildPositivePracticeTasks(targetAbility: string): string[] {
  return [
    `完成一题新的「${targetAbility}」变式任务。`,
    '说明本次答案中哪些要点支撑了自己的判断。',
    '尝试在更复杂文本中复用同一思考方法。',
  ];
}

function buildPositiveCoachGuidance(targetAbility: string): string[] {
  return [
    '先肯定学生已经达到本题要求的具体能力表现。',
    '追问学生使用了什么方法，而不是重复讲答案。',
    `引导学生把「${targetAbility}」方法迁移到新任务。`,
    '减少提示，优先观察独立完成情况。',
  ];
}

function buildPositiveCompletionCriteria(targetAbility: string): string[] {
  return [
    `学生能说明本次「${targetAbility}」任务的完成方法。`,
    '学生能在新文本或新题型中独立完成同能力任务。',
    '系统形成一条正向能力证据或迁移证据。',
  ];
}
