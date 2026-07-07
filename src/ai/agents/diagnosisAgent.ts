import { buildDiagnosisPrompt } from '../prompts/buildDiagnosisPrompt.ts';
import { routeDiagnosisTask, splitAnswerCandidates, type DiagnosisRoute } from './diagnosisRouter.ts';
import { evaluateOpenResponseRubric } from './openResponseRubricEvaluator.ts';
import {
  type DiagnosisInput,
  type DiagnosisResult,
  normalizeDiagnosisResult,
} from '../schemas/diagnosis.schema.ts';

type LLMCaller = (prompt: string, input: DiagnosisInput) => Promise<string>;

const abilityPath = ['信息提取', '理解', '概括', '分析', '推理', '表达'];

export async function runDiagnosisAgent(
  input: DiagnosisInput,
  callLLM: LLMCaller = mockCallLLM,
): Promise<DiagnosisResult> {
  console.log('[DiagnosisAgent] final input metadata', input.questionMetadata);
  const route = routeDiagnosisTask(input);

  if (route.taskType === 'exact_match') {
    return diagnoseExactMatch(input, route);
  }

  if (route.taskType === 'process_task') {
    return diagnoseProcessTask(input, route);
  }

  const prompt = buildDiagnosisPrompt(input);
  const rawResult = await callLLM(prompt, input);

  try {
    return normalizeDiagnosisResult(JSON.parse(rawResult));
  } catch {
    return normalizeDiagnosisResult({
      taskType: route.taskType,
      correct: null,
      strategyUsed: route.strategyUsed,
      mainAbility: resolveMainAbility(input),
      relatedAbilities: resolveRelatedAbilities(input),
      surfaceError: 'AI 返回结果无法解析为 JSON',
      rootCause: '当前诊断结果需要重新生成，暂不能形成稳定能力结论',
      errorType: '待验证',
      abilityEvidence: ['本次诊断未形成可解析结构化证据'],
      diagnosisSummary: '诊断失败，建议重新提交或切换真实 LLM 调用。',
      nextTraining: '暂不安排训练，先重新生成诊断结果。',
      confidence: 0.1,
    });
  }
}

async function mockCallLLM(_prompt: string, input: DiagnosisInput): Promise<string> {
  const route = routeDiagnosisTask(input);
  const mainAbility = resolveMainAbility(input);
  const relatedAbilities = resolveRelatedAbilities(input);
  const rubricEvaluation = evaluateOpenResponseRubric(input, mainAbility, relatedAbilities);

  const result: DiagnosisResult = {
    taskType: route.taskType,
    strategyUsed: route.strategyUsed,
    mainAbility,
    relatedAbilities,
    ...rubricEvaluation,
  };

  return JSON.stringify(result);
}

function diagnoseExactMatch(input: DiagnosisInput, route: DiagnosisRoute): DiagnosisResult {
  const candidates = splitAnswerCandidates(input.referenceAnswer);
  const normalizedStudentAnswer = normalizeAnswer(input.studentAnswer);
  const normalizedCandidates = candidates.length > 0
    ? candidates.map(normalizeAnswer)
    : [normalizeAnswer(input.referenceAnswer)];
  const correct = normalizedCandidates.some((candidate) => candidate === normalizedStudentAnswer);
  const mainAbility = input.questionMetadata?.mainAbility || inferExactMatchAbility(input.question);

  return normalizeDiagnosisResult({
    taskType: route.taskType,
    correct,
    strategyUsed: route.strategyUsed,
    mainAbility,
    relatedAbilities: input.questionMetadata?.relatedAbilities || [mainAbility],
    surfaceError: correct
      ? '学生答案命中参考答案候选项'
      : '学生答案未命中参考答案候选项',
    rootCause: correct
      ? '无补弱型 rootCause：学生答案命中参考答案候选项。'
      : '学生答案未命中参考答案候选项，需先确认基础记忆、词义理解或作答规范是否稳定。',
    errorType: correct ? '待验证' : '理解错误',
    abilityEvidence: [
      `任务类型被路由为 exact_match，使用候选答案命中策略。`,
      `参考答案候选项数量：${normalizedCandidates.length}。`,
      correct ? '学生答案与候选项完全匹配。' : '学生答案与候选项未形成完全匹配。',
    ],
    diagnosisSummary: correct
      ? '本题属于精确匹配任务，学生答案已命中参考答案候选项，本次不生成补弱型能力诊断。'
      : '本题属于精确匹配任务，学生答案未命中参考答案候选项，需要围绕基础理解或记忆准确性继续巩固。',
    nextTraining: correct
      ? '进入下一题 / 提高难度 / 巩固训练'
      : '进行候选答案复认、词义辨析或基础记忆巩固训练。',
    confidence: correct ? 0.88 : 0.72,
  });
}

function diagnoseProcessTask(input: DiagnosisInput, route: DiagnosisRoute): DiagnosisResult {
  const mainAbility = resolveMainAbility(input);

  return normalizeDiagnosisResult({
    taskType: route.taskType,
    correct: null,
    strategyUsed: route.strategyUsed,
    mainAbility,
    relatedAbilities: resolveRelatedAbilities(input),
    surfaceError: '过程型任务暂使用 mock 诊断，尚未细分操作步骤完成度。',
    rootCause: '当前任务需要观察学生的过程操作，如找依据、标关键词、修改答案或补全推理链。',
    errorType: '待验证',
    abilityEvidence: [
      '任务类型被路由为 process_task。',
      '当前版本仅保留过程任务诊断结构，后续可接入步骤级证据。',
      `学生答案长度：${input.studentAnswer.trim().length}。`,
    ],
    diagnosisSummary: '本题属于过程型任务，当前返回 mock 诊断结果，用于保持 Runtime 结构稳定。',
    nextTraining: '进入过程步骤检查：确认依据、关键词、修正点或推理链是否完整。',
    confidence: 0.42,
  });
}

function resolveMainAbility(input: DiagnosisInput): string {
  return input.questionMetadata?.mainAbility || inferMainAbility(input.question);
}

function resolveRelatedAbilities(input: DiagnosisInput): string[] {
  const metadataAbilities = [
    ...(input.questionMetadata?.abilityPath || []),
    ...(input.questionMetadata?.relatedAbilities || []),
  ].filter(Boolean);

  if (metadataAbilities.length > 0) {
    const mainAbility = resolveMainAbility(input);
    return [...new Set([...metadataAbilities, mainAbility, '表达'])];
  }

  return inferRelatedAbilities(input.question);
}

function inferMainAbility(question: string): string {
  if (/概括|主旨|大意|主要内容|中心/.test(question)) return '概括';
  if (/赏析|分析|作用|手法|人物形象|结构|情感变化/.test(question)) return '分析';
  if (/推断|推测|可以推断/.test(question)) return '推理';
  if (/含义|理解|意思|如何理解/.test(question)) return '理解';
  if (/找出|哪些|哪几|根据原文|文中/.test(question)) return '信息提取';
  if (/为什么|原因|说明了什么|看出什么|体现/.test(question)) return '推理';
  if (/表达|仿写|改写|扩写|缩写|写一段/.test(question)) return '表达';
  return '理解';
}

function inferExactMatchAbility(question: string): string {
  if (/反义词|近义词|词语解释|解释词语/.test(question)) return '理解';
  if (/默写|填空|拼音|字音|字形/.test(question)) return '表达';
  if (/选择|选出|下列/.test(question)) return '理解';
  return '理解';
}

function inferRelatedAbilities(question: string): string[] {
  const mainAbility = inferMainAbility(question);
  const mainIndex = abilityPath.indexOf(mainAbility);
  const path = mainIndex >= 0 ? abilityPath.slice(0, mainIndex + 1) : ['信息提取', '理解'];

  if (!path.includes('表达')) path.push('表达');
  return [...new Set(path)];
}

function normalizeAnswer(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[，。！？；：“”‘’、,.!?;:"'()\[\]{}]/g, '')
    .trim();
}
