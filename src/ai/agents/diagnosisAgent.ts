import { buildDiagnosisPrompt } from '../prompts/buildDiagnosisPrompt';
import {
  type DiagnosisInput,
  type DiagnosisResult,
  normalizeDiagnosisResult,
} from '../schemas/diagnosis.schema';

type LLMCaller = (prompt: string, input: DiagnosisInput) => Promise<string>;

const abilityPath = ['信息提取', '理解', '概括', '分析', '推理', '表达'];

export async function runDiagnosisAgent(
  input: DiagnosisInput,
  callLLM: LLMCaller = mockCallLLM,
): Promise<DiagnosisResult> {
  const prompt = buildDiagnosisPrompt(input);
  const rawResult = await callLLM(prompt, input);

  try {
    return normalizeDiagnosisResult(JSON.parse(rawResult));
  } catch {
    return normalizeDiagnosisResult({
      mainAbility: inferMainAbility(input.question),
      relatedAbilities: inferRelatedAbilities(input.question),
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
  const mainAbility = inferMainAbility(input.question);
  const relatedAbilities = inferRelatedAbilities(input.question);
  const overlap = keywordOverlap(input.referenceAnswer, input.studentAnswer);
  const isEmpty = input.studentAnswer.trim().length === 0;
  const hasEvidenceSignal = /原文|文中|依据|因为|从.*看出|第.*段/.test(input.studentAnswer);

  const surfaceError = isEmpty
    ? '学生未提交有效答案'
    : overlap < 0.2
      ? '学生答案与参考答案关键点匹配不足'
      : hasEvidenceSignal
        ? '学生答案基本相关，但仍需验证能力稳定性'
        : '学生答案有一定相关性，但文本依据呈现不足';

  const errorType = inferErrorType(mainAbility, isEmpty, hasEvidenceSignal, overlap);
  const rootCause = inferRootCause(mainAbility, errorType, overlap, hasEvidenceSignal);
  const abilityEvidence = buildAbilityEvidence(input, mainAbility, overlap, hasEvidenceSignal);
  const confidence = isEmpty ? 0.35 : overlap > 0.55 && hasEvidenceSignal ? 0.72 : 0.58;

  const result: DiagnosisResult = {
    mainAbility,
    relatedAbilities,
    surfaceError,
    rootCause,
    errorType,
    abilityEvidence,
    diagnosisSummary: `本次诊断主要观察到「${mainAbility}」相关表现。结论基于学生答案与参考答案的关键点关系、文本依据呈现情况和题目能力路径生成，不能仅凭单题作为最终能力结论。`,
    nextTraining: inferNextTraining(mainAbility, errorType),
    confidence,
  };

  return JSON.stringify(result);
}

function inferMainAbility(question: string): string {
  if (/概括|主旨|大意|主要内容|中心/.test(question)) return '概括';
  if (/赏析|分析|作用|手法|人物形象|结构|情感变化/.test(question)) return '分析';
  if (/推断|推测|为什么|原因|说明了什么|看出什么|体现/.test(question)) return '推理';
  if (/含义|理解|意思|如何理解/.test(question)) return '理解';
  if (/找出|哪些|哪几|根据原文|文中/.test(question)) return '信息提取';
  if (/表达|仿写|改写|扩写|缩写|写一段/.test(question)) return '表达';
  return '理解';
}

function inferRelatedAbilities(question: string): string[] {
  const mainAbility = inferMainAbility(question);
  const mainIndex = abilityPath.indexOf(mainAbility);
  const path = mainIndex >= 0 ? abilityPath.slice(0, mainIndex + 1) : ['信息提取', '理解'];

  if (!path.includes('表达')) path.push('表达');
  return [...new Set(path)];
}

function inferErrorType(
  mainAbility: string,
  isEmpty: boolean,
  hasEvidenceSignal: boolean,
  overlap: number,
): DiagnosisResult['errorType'] {
  if (isEmpty) return '表达错误';
  if (overlap < 0.15) return mainAbility === '信息提取' ? '定位错误' : abilityToErrorType(mainAbility);
  if (!hasEvidenceSignal && ['分析', '推理', '理解'].includes(mainAbility)) return '表达错误';
  return abilityToErrorType(mainAbility);
}

function abilityToErrorType(mainAbility: string): DiagnosisResult['errorType'] {
  const map: Record<string, DiagnosisResult['errorType']> = {
    信息提取: '定位错误',
    理解: '理解错误',
    概括: '概括错误',
    分析: '分析错误',
    推理: '推理错误',
    表达: '表达错误',
  };

  return map[mainAbility] || '待验证';
}

function inferRootCause(
  mainAbility: string,
  errorType: DiagnosisResult['errorType'],
  overlap: number,
  hasEvidenceSignal: boolean,
): string {
  if (overlap < 0.15) {
    return '学生可能尚未定位到关键文本信息，真实短板优先追溯为信息提取或题意理解不稳定。';
  }

  if (!hasEvidenceSignal && ['分析', '推理'].includes(mainAbility)) {
    return '学生能够给出部分判断，但缺少文本依据支撑，真实短板可能是依据提取与表达组织不足。';
  }

  if (errorType === '概括错误') {
    return '学生可能尚未稳定区分主要信息与次要信息，核心信息筛选能力需要继续验证。';
  }

  return `学生在「${mainAbility}」能力路径上已有部分表现，但仍需要通过更多任务验证其独立性、稳定性和迁移性。`;
}

function buildAbilityEvidence(
  input: DiagnosisInput,
  mainAbility: string,
  overlap: number,
  hasEvidenceSignal: boolean,
): string[] {
  const evidence = [
    `题目主要映射到「${mainAbility}」能力，并关联「${inferRelatedAbilities(input.question).join('、')}」能力路径。`,
    `学生答案与参考答案的关键点重合度约为 ${Math.round(overlap * 100)}%，只能作为单次诊断线索。`,
  ];

  evidence.push(
    hasEvidenceSignal
      ? '学生答案中出现文本依据表达信号，可作为正向能力证据继续观察。'
      : '学生答案中缺少明显文本依据表达，需继续观察其依据提取与表达能力。',
  );

  return evidence;
}

function inferNextTraining(mainAbility: string, errorType: DiagnosisResult['errorType']): string {
  if (errorType === '定位错误') return '进入关键词定位与文本依据提取训练。';
  if (errorType === '表达错误') return '进入“依据 + 分析 + 结论”的表达组织训练。';
  if (mainAbility === '概括') return '进入核心信息筛选与段意概括训练。';
  if (mainAbility === '推理') return '进入基于文本依据的推理链训练。';
  if (mainAbility === '分析') return '进入分析对象、文本依据和表达作用的拆解训练。';
  if (mainAbility === '信息提取') return '进入题干限定条件标注和关键句定位训练。';
  return '进入题意理解、文本依据定位和答案修正训练。';
}

function keywordOverlap(referenceAnswer: string, studentAnswer: string): number {
  const referenceTokens = tokenize(referenceAnswer);
  const studentTokens = new Set(tokenize(studentAnswer));

  if (referenceTokens.length === 0 || studentTokens.size === 0) return 0;

  const matched = referenceTokens.filter((token) => studentTokens.has(token)).length;
  return matched / referenceTokens.length;
}

function tokenize(value: string): string[] {
  return value
    .replace(/[，。！？；：“”‘’、,.!?;:"'()\[\]{}]/g, ' ')
    .split(/\s+/)
    .flatMap((part) => part.length > 2 ? part.match(/[\u4e00-\u9fa5]{2}|[a-zA-Z0-9]+/g) || [] : [part])
    .filter(Boolean);
}
