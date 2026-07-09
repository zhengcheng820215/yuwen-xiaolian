import { runQuestionMetadataAgent } from './questionMetadataAgent.ts';
import { extractAbilityEvidenceFromDiagnosis } from './abilityEvidenceExtractor.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
  type AbilityEvidenceSummary,
  type WeaknessRankingItem,
} from './weaknessRankingAgent.ts';
import { generateStudentAbilityProfile } from './studentAbilityProfileAgent.ts';
import { buildRealAIDiagnosisPrompt } from '../prompts/buildRealAIDiagnosisPrompt.ts';
import {
  normalizeDiagnosisResult,
  type DiagnosisInput,
  type DiagnosisResult,
  type QuestionMetadata,
} from '../schemas/diagnosis.schema.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';

export type RealAIDiagnosisInput = DiagnosisInput & {
  studentId: string;
  previousEvidence?: AbilityEvidence[];
  taskId?: string;
  diagnosisId?: string;
  createdAt?: string;
};

export type RealAIDiagnosisResult = {
  prompt: string;
  questionMetadata?: QuestionMetadata;
  diagnosisResult: DiagnosisResult;
  newAbilityEvidence: AbilityEvidence;
  abilityEvidence: AbilityEvidence;
  updatedEvidence: AbilityEvidence[];
  evidenceSummary: AbilityEvidenceSummary[];
  topWeakness: WeaknessRankingItem[];
  studentAbilityProfile: StudentAbilityProfile;
  usedLiveAI: boolean;
  rawLLMOutput: string;
};

type RealAILLMCaller = (prompt: string, input: RealAIDiagnosisInput) => Promise<string>;

export async function runRealAIDiagnosisLoop(
  input: RealAIDiagnosisInput,
  callLLM: RealAILLMCaller = resolveDefaultLLMCaller(),
): Promise<RealAIDiagnosisResult> {
  const questionMetadata = input.questionMetadata || await generateQuestionMetadata(input);
  const diagnosisInput: DiagnosisInput = {
    question: input.question,
    referenceAnswer: input.referenceAnswer,
    studentAnswer: input.studentAnswer,
    questionMetadata,
  };
  const prompt = buildRealAIDiagnosisPrompt(diagnosisInput);
  const rawLLMOutput = await callLLM(prompt, {
    ...input,
    questionMetadata,
  });
  const diagnosisResult = normalizeDiagnosisResult(parseDiagnosisJSON(rawLLMOutput));
  const createdAt = input.createdAt || new Date().toISOString();
  const diagnosisId = input.diagnosisId || `real-ai-diagnosis-${createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17)}`;
  const abilityEvidence = extractAbilityEvidenceFromDiagnosis(diagnosisResult, {
    studentId: input.studentId,
    taskId: input.taskId,
    diagnosisId,
    createdAt,
  });
  const updatedEvidence = mergeEvidenceById(input.previousEvidence || [], abilityEvidence);
  const evidenceSummary = summarizeAbilityEvidence(updatedEvidence);
  const topWeakness = rankWeaknessSummaries(evidenceSummary, 3);
  const studentAbilityProfile = generateStudentAbilityProfile({
    studentId: input.studentId,
    evidenceSummary,
    topWeakness,
    evidence: updatedEvidence,
    generatedAt: createdAt,
  });

  return {
    prompt,
    questionMetadata,
    diagnosisResult,
    newAbilityEvidence: abilityEvidence,
    abilityEvidence,
    updatedEvidence,
    evidenceSummary,
    topWeakness,
    studentAbilityProfile,
    usedLiveAI: callLLM === callLiveOpenAI,
    rawLLMOutput,
  };
}

function mergeEvidenceById(
  previousEvidence: AbilityEvidence[],
  newAbilityEvidence: AbilityEvidence,
): AbilityEvidence[] {
  const evidenceById = new Map<string, AbilityEvidence>();

  for (const evidence of previousEvidence) {
    evidenceById.set(evidence.id, evidence);
  }

  evidenceById.set(newAbilityEvidence.id, newAbilityEvidence);

  return [...evidenceById.values()];
}

async function generateQuestionMetadata(input: DiagnosisInput): Promise<QuestionMetadata> {
  const result = await runQuestionMetadataAgent({
    question: input.question,
    referenceAnswer: input.referenceAnswer,
  });

  return result.metadata;
}

function resolveDefaultLLMCaller(): RealAILLMCaller {
  if (getRuntimeEnv('REAL_AI_DIAGNOSIS_LIVE') === 'true') return callLiveOpenAI;
  return mockRealAIDiagnosisLLM;
}

async function callLiveOpenAI(prompt: string): Promise<string> {
  const apiKey = getRuntimeEnv('OPENAI_API_KEY');
  const model = getRuntimeEnv('OPENAI_MODEL') || 'gpt-4.1-mini';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when REAL_AI_DIAGNOSIS_LIVE=true.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Responses API request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  return payload.output_text || payload.output?.flatMap((item) => item.content || [])
    .map((content) => content.text || '')
    .join('\n') || '';
}

function getRuntimeEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return process.env?.[key];
}

async function mockRealAIDiagnosisLLM(_prompt: string, input: RealAIDiagnosisInput): Promise<string> {
  const mainAbility = input.questionMetadata?.mainAbility || '理解';
  const questionType = input.questionMetadata?.questionType || '';

  if (mainAbility === '推理') {
    return JSON.stringify({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'phase4_2_dry_run_metadata_based',
      answerStatus: 'does_not_meet',
      scoreBand: 'low',
      mainAbility: '推理',
      relatedAbilities: ['信息提取', '理解', '推理', '表达'],
      surfaceError: '学生答案停留在表面行为描述，没有从文本线索推断人物心理。',
      rootCause: '学生尚未建立“文本行为线索 -> 人物心理 -> 结论表达”的推理链。',
      errorType: '推理错误',
      abilityEvidence: [
        `题目被识别为「${questionType || '推理'}」任务，主要观察推理能力。`,
        '学生答案只写出“喜欢整理东西”这类表层行为判断，未结合“反复整理旧书”推断不舍、珍惜回忆或牵挂。',
      ],
      diagnosisSummary: '本次 dry-run 诊断表明，学生能够注意到人物行为，但未能把行为转化为心理推断。',
      nextTraining: '进入基于文本依据的推理链训练，重点练习“行为线索 -> 心理判断 -> 文本依据说明”。',
      confidence: 0.7,
    });
  }

  if (mainAbility === '概括') {
    return JSON.stringify({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'phase4_2_dry_run_metadata_based',
      answerStatus: 'partially_meets',
      scoreBand: 'medium',
      mainAbility: '概括',
      relatedAbilities: ['信息提取', '要点筛选', '概括', '表达'],
      surfaceError: '学生答案抓住了情感结论，但没有概括核心事件和发展过程。',
      rootCause: '学生尚未稳定完成“人物 + 事件 + 结果 / 主题”的主要内容概括。',
      errorType: '概括错误',
      abilityEvidence: [
        `题目被识别为「${questionType || '概括'}」任务，主要观察概括能力。`,
        '学生答案表达了“父亲爱我、我感动”的主题，但遗漏了接送、等待等关键事件。',
      ],
      diagnosisSummary: '本次 dry-run 诊断表明，学生有主题感知，但主要内容概括不完整。',
      nextTraining: '进入核心事件提取与主要内容概括训练。',
      confidence: 0.7,
    });
  }

  return JSON.stringify({
    taskType: 'open_response',
    correct: false,
    strategyUsed: 'phase4_2_dry_run_metadata_based',
    answerStatus: 'partially_meets',
    scoreBand: 'medium',
    mainAbility: '理解',
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: '学生答案能够触及情感主题，但没有解释关键词的深层含义。',
    rootCause: '学生理解到人物情感，但尚未完成从字面意思到语境深层含义的转换。',
    errorType: '理解错误',
    abilityEvidence: [
      '学生答案提到父亲的爱和自己的感动，说明已经捕捉到部分情感主题。',
      '学生答案没有解释“照亮”不是实际灯光，而是象征父亲长期的关爱与牵挂。',
    ],
    diagnosisSummary: '本次真实 AI 诊断 dry-run 表明，学生在句子含义理解上部分满足要求，但深层含义转换不稳定。',
    nextTraining: '进入关键词深层含义理解训练，重点练习“字面含义 -> 语境含义 -> 情感主题”的表达链。',
    confidence: 0.72,
  });
}

function parseDiagnosisJSON(rawLLMOutput: string): Partial<DiagnosisResult> {
  const trimmed = rawLLMOutput.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence) as Partial<DiagnosisResult>;
  } catch {
    const jsonStart = withoutFence.indexOf('{');
    const jsonEnd = withoutFence.lastIndexOf('}');

    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(withoutFence.slice(jsonStart, jsonEnd + 1)) as Partial<DiagnosisResult>;
    }

    throw new Error('Real AI diagnosis output is not valid JSON.');
  }
}
