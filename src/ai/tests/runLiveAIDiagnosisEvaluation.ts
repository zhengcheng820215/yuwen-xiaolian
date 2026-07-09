import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runRealAIDiagnosisLoop, type RealAIDiagnosisInput } from '../agents/realAIDiagnosisAgent.ts';
import { isAbilityEvidence, type AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { DiagnosisResult, OpenResponseAnswerStatus } from '../schemas/diagnosis.schema.ts';
import {
  liveAIDiagnosisEvaluationSamples,
  type LiveAIDiagnosisEvaluationSample,
} from './liveAIDiagnosis.samples.ts';

const execFileAsync = promisify(execFile);

type ReviewResult = 'PASS' | 'REVIEW' | 'FAIL';

type MainAbilityMissAnalysis = {
  expectedMainAbility: string;
  actualMainAbility?: string;
  adjacentAbilityAcceptable: boolean;
  needsPromptAdjustment: boolean;
  needsSampleExpectationAdjustment: boolean;
  reason: string;
};

type RootCauseIssueAnalysis = {
  rootCause?: string;
  unacceptableReason: string;
  missingEvidence: boolean;
  overGeneralized: boolean;
  notTrainable: boolean;
};

type LiveAIEvaluationItem = {
  sampleId: string;
  question: string;
  studentAnswer: string;
  rawLLMOutput: string;
  normalizedDiagnosis?: DiagnosisResult;
  abilityEvidence?: AbilityEvidence;
  expectedMainAbility: string;
  expectedRootCauseDirection: string;
  expectedAnswerStatus: OpenResponseAnswerStatus;
  actualMainAbility?: string;
  actualRootCause?: string;
  actualAnswerStatus?: string;
  jsonParsed: boolean;
  schemaPassed: boolean;
  mainAbilityHit: boolean;
  rootCauseAcceptable: boolean;
  answerStatusHit: boolean;
  trainingFocusActionable: boolean;
  noUnsupportedJudgement: boolean;
  noLongTermConclusion: boolean;
  reviewResult: ReviewResult;
  reviewReason: string;
  mainAbilityMissAnalysis?: MainAbilityMissAnalysis;
  rootCauseIssueAnalysis?: RootCauseIssueAnalysis;
  reviewNotes: string[];
};

type LiveAIEvaluationReport = {
  generatedAt: string;
  mode: 'live_ai' | 'dry_run_structural_check';
  provider: string;
  total: number;
  jsonParseRate: number;
  schemaPassRate: number;
  mainAbilityHitRate: number;
  rootCauseAcceptableRate: number;
  passCount: number;
  reviewCount: number;
  failCount: number;
  majorIssues: string[];
  allowNextPhase: boolean;
  items: LiveAIEvaluationItem[];
};

async function runLiveAIDiagnosisEvaluation(): Promise<void> {
  const mode = getEvaluationMode();
  const items: LiveAIEvaluationItem[] = [];

  console.log('\nPhase 4.3 Live AI Diagnosis Quality Evaluation');
  console.log('==============================================');
  console.log(`mode: ${mode}`);
  console.log(`provider: ${getAIProvider()}`);
  console.log(`samples: ${liveAIDiagnosisEvaluationSamples.length}`);

  if (mode === 'live_ai') {
    assertLiveAIConfig();
  } else {
    console.log('\n[WARN] 当前为 dry-run 结构检查，不代表真实 AI 诊断质量。');
    console.log('       真实验收请设置 REAL_AI_DIAGNOSIS_LIVE=true 和 OPENAI_API_KEY。');
  }

  for (const sample of liveAIDiagnosisEvaluationSamples) {
    const item = await evaluateSample(sample, mode);
    items.push(item);
    printItem(item);
  }

  const report = buildReport(items, mode);
  printSummary(report);

  if (mode === 'live_ai' && report.failCount > 0) {
    throw new Error('Live AI evaluation contains FAIL items.');
  }
}

async function evaluateSample(
  sample: LiveAIDiagnosisEvaluationSample,
  mode: LiveAIEvaluationReport['mode'],
): Promise<LiveAIEvaluationItem> {
  let rawLLMOutput = '';

  try {
    const input: RealAIDiagnosisInput = {
      studentId: 'phase43-evaluation-student',
      taskId: sample.id,
      diagnosisId: `phase43-${sample.id}`,
      createdAt: '2026-07-09T12:00:00.000Z',
      question: sample.question,
      referenceAnswer: sample.referenceAnswer,
      studentAnswer: sample.studentAnswer,
      previousEvidence: [],
    };

    const result = mode === 'live_ai'
      ? await runRealAIDiagnosisLoop(input, buildLiveLLMCaller((raw) => {
        rawLLMOutput = raw;
      }))
      : await runRealAIDiagnosisLoop(input);

    rawLLMOutput = rawLLMOutput || result.rawLLMOutput;

    return reviewSuccessfulResult(sample, rawLLMOutput, result.diagnosisResult, result.newAbilityEvidence);
  } catch (error) {
    return {
      sampleId: sample.id,
      question: sample.question,
      studentAnswer: sample.studentAnswer,
      rawLLMOutput,
      expectedMainAbility: sample.expectedMainAbility,
      expectedRootCauseDirection: sample.expectedRootCauseDirection,
      expectedAnswerStatus: sample.expectedAnswerStatus,
      jsonParsed: false,
      schemaPassed: false,
      mainAbilityHit: false,
      rootCauseAcceptable: false,
      answerStatusHit: false,
      trainingFocusActionable: false,
      noUnsupportedJudgement: false,
      noLongTermConclusion: false,
      reviewResult: 'FAIL',
      reviewReason: '样例执行失败，无法完成真实 AI 质量评估。',
      mainAbilityMissAnalysis: {
        expectedMainAbility: sample.expectedMainAbility,
        adjacentAbilityAcceptable: false,
        needsPromptAdjustment: false,
        needsSampleExpectationAdjustment: false,
        reason: '执行失败，未获得 actualMainAbility。',
      },
      rootCauseIssueAnalysis: {
        unacceptableReason: '执行失败，未获得 rootCause。',
        missingEvidence: true,
        overGeneralized: false,
        notTrainable: true,
      },
      reviewNotes: [
        `样例执行失败：${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function reviewSuccessfulResult(
  sample: LiveAIDiagnosisEvaluationSample,
  rawLLMOutput: string,
  normalizedDiagnosis: DiagnosisResult,
  abilityEvidence: AbilityEvidence,
): LiveAIEvaluationItem {
  const reviewNotes: string[] = [];
  const schemaPassed = validateDiagnosisSchema(normalizedDiagnosis, abilityEvidence, reviewNotes);
  const mainAbilityHit = normalizedDiagnosis.mainAbility === sample.expectedMainAbility;
  const rootCauseAcceptable = matchesRootCauseDirection(normalizedDiagnosis.rootCause, sample.expectedRootCauseKeywords);
  const answerStatusHit = normalizedDiagnosis.answerStatus === sample.expectedAnswerStatus;
  const trainingFocusActionable = isTrainingFocusActionable(normalizedDiagnosis.nextTraining);
  const noUnsupportedJudgement = hasNoUnsupportedJudgement(normalizedDiagnosis);
  const noLongTermConclusion = hasNoLongTermConclusion(normalizedDiagnosis);
  const mainAbilityMissAnalysis = mainAbilityHit
    ? undefined
    : analyzeMainAbilityMiss(sample.expectedMainAbility, normalizedDiagnosis.mainAbility);
  const rootCauseIssueAnalysis = rootCauseAcceptable
    ? undefined
    : analyzeRootCauseIssue(normalizedDiagnosis, abilityEvidence, sample.expectedRootCauseDirection);

  if (!mainAbilityHit) {
    reviewNotes.push(`mainAbility 不匹配：expected=${sample.expectedMainAbility}, actual=${normalizedDiagnosis.mainAbility}`);
  }
  if (!rootCauseAcceptable) {
    reviewNotes.push(`rootCause 需要人工复核：expected direction=${sample.expectedRootCauseDirection}, actual=${normalizedDiagnosis.rootCause}`);
  }
  if (!answerStatusHit) {
    reviewNotes.push(`answerStatus 不匹配：expected=${sample.expectedAnswerStatus}, actual=${normalizedDiagnosis.answerStatus || 'unknown'}`);
  }
  if (!trainingFocusActionable) {
    reviewNotes.push('nextTraining 不够具体，可能无法进入后续训练计划。');
  }
  if (!noUnsupportedJudgement) {
    reviewNotes.push('可能存在缺少学生答案依据的判断，需要人工复核。');
  }
  if (!noLongTermConclusion) {
    reviewNotes.push('出现长期能力结论倾向，违反 Phase 4.3 评估边界。');
  }

  const reviewResult = decideReviewResult({
    schemaPassed,
    mainAbilityHit,
    rootCauseAcceptable,
    answerStatusHit,
    trainingFocusActionable,
    noUnsupportedJudgement,
    noLongTermConclusion,
  });
  const reviewReason = buildReviewReason(reviewResult, {
    schemaPassed,
    mainAbilityHit,
    rootCauseAcceptable,
    answerStatusHit,
    trainingFocusActionable,
    noUnsupportedJudgement,
    noLongTermConclusion,
  });

  if (reviewResult === 'PASS' && reviewNotes.length === 0) {
    reviewNotes.push('自动检查通过，仍建议抽样人工复核 rootCause 与 abilityEvidence。');
  }

  return {
    sampleId: sample.id,
    question: sample.question,
    studentAnswer: sample.studentAnswer,
    rawLLMOutput,
    normalizedDiagnosis,
    abilityEvidence,
    expectedMainAbility: sample.expectedMainAbility,
    expectedRootCauseDirection: sample.expectedRootCauseDirection,
    expectedAnswerStatus: sample.expectedAnswerStatus,
    actualMainAbility: normalizedDiagnosis.mainAbility,
    actualRootCause: normalizedDiagnosis.rootCause,
    actualAnswerStatus: normalizedDiagnosis.answerStatus,
    jsonParsed: true,
    schemaPassed,
    mainAbilityHit,
    rootCauseAcceptable,
    answerStatusHit,
    trainingFocusActionable,
    noUnsupportedJudgement,
    noLongTermConclusion,
    reviewResult,
    reviewReason,
    mainAbilityMissAnalysis,
    rootCauseIssueAnalysis,
    reviewNotes,
  };
}

function validateDiagnosisSchema(
  diagnosis: DiagnosisResult,
  abilityEvidence: AbilityEvidence,
  reviewNotes: string[],
): boolean {
  const checks = [
    Boolean(diagnosis.taskType),
    typeof diagnosis.correct === 'boolean' || diagnosis.correct === null,
    Boolean(diagnosis.strategyUsed),
    Boolean(diagnosis.answerStatus),
    Boolean(diagnosis.scoreBand),
    Boolean(diagnosis.mainAbility),
    Array.isArray(diagnosis.relatedAbilities),
    Boolean(diagnosis.surfaceError),
    Boolean(diagnosis.rootCause),
    Boolean(diagnosis.errorType),
    Array.isArray(diagnosis.abilityEvidence) && diagnosis.abilityEvidence.length > 0,
    Boolean(diagnosis.diagnosisSummary),
    Boolean(diagnosis.nextTraining),
    typeof diagnosis.confidence === 'number' && diagnosis.confidence >= 0 && diagnosis.confidence <= 1,
    isAbilityEvidence(abilityEvidence),
  ];

  if (checks.every(Boolean)) return true;

  reviewNotes.push('DiagnosisResult 或 AbilityEvidence 结构不完整。');
  return false;
}

function matchesRootCauseDirection(rootCause: string, expectedKeywords: string[]): boolean {
  return expectedKeywords.some((keyword) => rootCause.includes(keyword));
}

function isTrainingFocusActionable(nextTraining: string): boolean {
  if (!nextTraining || nextTraining.length < 8) return false;
  return !/继续观察|继续收集|证据不足/.test(nextTraining);
}

function hasNoUnsupportedJudgement(diagnosis: DiagnosisResult): boolean {
  const evidenceText = diagnosis.abilityEvidence.join('\n');
  if (!evidenceText.trim()) return false;
  return !/没有依据地|凭空|猜测学生|长期以来|一贯/.test(evidenceText);
}

function hasNoLongTermConclusion(diagnosis: DiagnosisResult): boolean {
  const text = [
    diagnosis.rootCause,
    diagnosis.diagnosisSummary,
    diagnosis.abilityEvidence.join('\n'),
  ].join('\n');

  return !/长期能力|能力已经|能力完全|永久|一直不会|稳定掌握|彻底/.test(text);
}

function decideReviewResult(input: {
  schemaPassed: boolean;
  mainAbilityHit: boolean;
  rootCauseAcceptable: boolean;
  answerStatusHit: boolean;
  trainingFocusActionable: boolean;
  noUnsupportedJudgement: boolean;
  noLongTermConclusion: boolean;
}): ReviewResult {
  if (!input.schemaPassed || !input.noUnsupportedJudgement || !input.noLongTermConclusion) return 'FAIL';
  if (input.mainAbilityHit && input.rootCauseAcceptable && input.answerStatusHit && input.trainingFocusActionable) return 'PASS';
  return 'REVIEW';
}

function buildReviewReason(
  reviewResult: ReviewResult,
  input: {
    schemaPassed: boolean;
    mainAbilityHit: boolean;
    rootCauseAcceptable: boolean;
    answerStatusHit: boolean;
    trainingFocusActionable: boolean;
    noUnsupportedJudgement: boolean;
    noLongTermConclusion: boolean;
  },
): string {
  if (reviewResult === 'PASS') {
    return '结构、能力、错因方向和训练建议均通过自动检查。';
  }

  const reasons: string[] = [];

  if (!input.schemaPassed) reasons.push('结构不完整或 Schema 不通过');
  if (!input.mainAbilityHit) reasons.push('mainAbility 未命中预期');
  if (!input.rootCauseAcceptable) reasons.push('rootCause 未命中预期方向');
  if (!input.answerStatusHit) reasons.push('answerStatus 与预期不一致');
  if (!input.trainingFocusActionable) reasons.push('nextTraining 不足以进入训练计划');
  if (!input.noUnsupportedJudgement) reasons.push('可能存在凭空判断');
  if (!input.noLongTermConclusion) reasons.push('可能存在长期能力结论');

  if (reviewResult === 'FAIL') {
    return `存在阻断性问题：${reasons.join('；')}。`;
  }

  return `需要人工复核：${reasons.join('；')}。`;
}

function analyzeMainAbilityMiss(
  expectedMainAbility: string,
  actualMainAbility?: string,
): MainAbilityMissAnalysis {
  const adjacentAbilityAcceptable = isAdjacentAbility(expectedMainAbility, actualMainAbility);

  return {
    expectedMainAbility,
    actualMainAbility,
    adjacentAbilityAcceptable,
    needsPromptAdjustment: !adjacentAbilityAcceptable,
    needsSampleExpectationAdjustment: adjacentAbilityAcceptable,
    reason: adjacentAbilityAcceptable
      ? 'actualMainAbility 属于相邻能力，需人工判断题目预期是否过窄。'
      : 'actualMainAbility 与预期能力距离较远，优先检查 Prompt 对 mainAbility 的约束是否不足。',
  };
}

function analyzeRootCauseIssue(
  diagnosis: DiagnosisResult,
  abilityEvidence: AbilityEvidence,
  expectedRootCauseDirection: string,
): RootCauseIssueAnalysis {
  const evidenceText = [
    diagnosis.rootCause,
    diagnosis.surfaceError,
    diagnosis.diagnosisSummary,
    diagnosis.abilityEvidence.join('\n'),
    abilityEvidence.observation,
  ].join('\n');
  const missingEvidence = !hasStudentAnswerEvidence(evidenceText);
  const overGeneralized = /能力不足|基础薄弱|不稳定|长期|一直|完全/.test(diagnosis.rootCause);
  const notTrainable = !isTrainingFocusActionable(diagnosis.nextTraining);
  const reasons: string[] = [];

  if (missingEvidence) reasons.push('rootCause 或 evidence 未明确引用学生答案表现');
  if (overGeneralized) reasons.push('rootCause 表述可能过度泛化');
  if (notTrainable) reasons.push('rootCause / nextTraining 难以转化为训练任务');
  if (reasons.length === 0) {
    reasons.push(`rootCause 未命中预期方向：${expectedRootCauseDirection}`);
  }

  return {
    rootCause: diagnosis.rootCause,
    unacceptableReason: reasons.join('；'),
    missingEvidence,
    overGeneralized,
    notTrainable,
  };
}

function isAdjacentAbility(expectedMainAbility: string, actualMainAbility?: string): boolean {
  if (!actualMainAbility) return false;

  const adjacentAbilityMap: Record<string, string[]> = {
    理解: ['分析', '推理'],
    概括: ['信息提取', '理解', '表达'],
    推理: ['理解', '分析'],
    表达: ['概括', '分析'],
  };

  return adjacentAbilityMap[expectedMainAbility]?.includes(actualMainAbility) || false;
}

function hasStudentAnswerEvidence(text: string): boolean {
  return /学生答案|作答|回答|只写|提到|没有|缺少|遗漏|停留|未/.test(text);
}

function buildReport(
  items: LiveAIEvaluationItem[],
  mode: LiveAIEvaluationReport['mode'],
): LiveAIEvaluationReport {
  const total = items.length;
  const passCount = items.filter((item) => item.reviewResult === 'PASS').length;
  const reviewCount = items.filter((item) => item.reviewResult === 'REVIEW').length;
  const failCount = items.filter((item) => item.reviewResult === 'FAIL').length;
  const jsonParseRate = ratio(items.filter((item) => item.jsonParsed).length, total);
  const schemaPassRate = ratio(items.filter((item) => item.schemaPassed).length, total);
  const mainAbilityHitRate = ratio(items.filter((item) => item.mainAbilityHit).length, total);
  const rootCauseAcceptableRate = ratio(items.filter((item) => item.rootCauseAcceptable).length, total);
  const majorIssues = collectMajorIssues(items, {
    jsonParseRate,
    schemaPassRate,
    mainAbilityHitRate,
    rootCauseAcceptableRate,
    failCount,
  });
  const allowNextPhase = (
    mode === 'live_ai' &&
    jsonParseRate === 1 &&
    schemaPassRate === 1 &&
    mainAbilityHitRate >= 0.8 &&
    rootCauseAcceptableRate >= 0.7 &&
    failCount === 0 &&
    majorIssues.length === 0
  );

  return {
    generatedAt: new Date().toISOString(),
    mode,
    provider: getAIProvider(),
    total,
    jsonParseRate,
    schemaPassRate,
    mainAbilityHitRate,
    rootCauseAcceptableRate,
    passCount,
    reviewCount,
    failCount,
    majorIssues,
    allowNextPhase,
    items,
  };
}

function collectMajorIssues(
  items: LiveAIEvaluationItem[],
  metrics: {
    jsonParseRate: number;
    schemaPassRate: number;
    mainAbilityHitRate: number;
    rootCauseAcceptableRate: number;
    failCount: number;
  },
): string[] {
  const issues: string[] = [];
  const unsupportedJudgements = items.filter((item) => !item.noUnsupportedJudgement);
  const longTermConclusions = items.filter((item) => !item.noLongTermConclusion);

  if (metrics.jsonParseRate < 1) issues.push('JSON parse rate 未达到 100%。');
  if (metrics.schemaPassRate < 1) issues.push('Schema pass rate 未达到 100%。');
  if (metrics.mainAbilityHitRate < 0.8) issues.push('mainAbility hit rate 低于 80% 验收门槛。');
  if (metrics.rootCauseAcceptableRate < 0.7) issues.push('rootCause acceptable rate 低于 70% 验收门槛。');
  if (metrics.failCount > 0) issues.push(`存在 FAIL 样例 ${metrics.failCount} 条。`);
  if (unsupportedJudgements.length > 0) issues.push(`存在疑似凭空判断 ${unsupportedJudgements.length} 条。`);
  if (longTermConclusions.length > 0) issues.push(`存在长期能力结论倾向 ${longTermConclusions.length} 条。`);

  return issues;
}

function printItem(item: LiveAIEvaluationItem): void {
  console.log(`\n[${item.reviewResult}] ${item.sampleId}`);
  console.log(`question: ${item.question}`);
  console.log(`studentAnswer: ${item.studentAnswer}`);
  console.log(`expectedMainAbility: ${item.expectedMainAbility}`);
  console.log(`actualMainAbility: ${item.actualMainAbility || 'unknown'}`);
  console.log(`expectedAnswerStatus: ${item.expectedAnswerStatus}`);
  console.log(`actualAnswerStatus: ${item.actualAnswerStatus || 'unknown'}`);
  console.log(`actualRootCause: ${item.actualRootCause || 'unknown'}`);
  console.log(`abilityEvidence: ${item.abilityEvidence?.observation || 'unknown'}`);
  console.log(`reviewReason: ${item.reviewReason}`);
  if (item.mainAbilityMissAnalysis) {
    console.log(`mainAbilityMissAnalysis: ${JSON.stringify(item.mainAbilityMissAnalysis)}`);
  }
  if (item.rootCauseIssueAnalysis) {
    console.log(`rootCauseIssueAnalysis: ${JSON.stringify(item.rootCauseIssueAnalysis)}`);
  }
  console.log(`reviewNotes: ${item.reviewNotes.join(' | ')}`);
}

function printSummary(report: LiveAIEvaluationReport): void {
  console.log('\nPhase 4.3 Evaluation Report');
  console.log('===========================');
  console.log(`total: ${report.total}`);
  console.log(`JSON parse rate: ${formatPercent(report.jsonParseRate)}`);
  console.log(`Schema pass rate: ${formatPercent(report.schemaPassRate)}`);
  console.log(`mainAbility hit rate: ${formatPercent(report.mainAbilityHitRate)}`);
  console.log(`rootCause acceptable rate: ${formatPercent(report.rootCauseAcceptableRate)}`);
  console.log(`PASS / REVIEW / FAIL: ${report.passCount} / ${report.reviewCount} / ${report.failCount}`);
  console.log(`allowNextPhase: ${report.allowNextPhase}`);
  console.log(`majorIssues: ${report.majorIssues.length}`);
  if (report.majorIssues.length > 0) {
    for (const issue of report.majorIssues) {
      console.log(`- ${issue}`);
    }
  }

  console.log('\nStructured Evaluation Report JSON');
  console.log('---------------------------------');
  console.log(JSON.stringify(report, null, 2));
}

function buildLiveLLMCaller(setRawOutput: (raw: string) => void) {
  return async (prompt: string): Promise<string> => {
    const provider = getAIProvider();

    if (provider === 'deepseek') {
      return callDeepSeekForDiagnosis(prompt, setRawOutput);
    }

    return callOpenAIForDiagnosis(prompt, setRawOutput);
  };
}

async function callOpenAIForDiagnosis(
  prompt: string,
  setRawOutput: (raw: string) => void,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for Live AI evaluation.');
  }

  const payload = await callOpenAIResponsesWithCurl({
    apiKey,
    model,
    prompt,
  });

  const raw = payload.output_text || payload.output?.flatMap((item) => item.content || [])
    .map((content) => content.text || '')
    .join('\n') || '';

  setRawOutput(raw);
  return raw;
}

async function callDeepSeekForDiagnosis(
  prompt: string,
  setRawOutput: (raw: string) => void,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required when AI_PROVIDER=deepseek.');
  }

  const payload = await callDeepSeekChatCompletionsWithCurl({
    apiKey,
    model,
    prompt,
  });

  const raw = payload.choices?.[0]?.message?.content || '';
  setRawOutput(raw);
  return raw;
}

async function callOpenAIResponsesWithCurl(input: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<{
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}> {
  const body = JSON.stringify({
    model: input.model,
    input: input.prompt,
    temperature: 0.2,
  });
  const { stdout, stderr } = await execFileAsync('curl', [
    '-sS',
    'https://api.openai.com/v1/responses',
    '-H',
    `Authorization: Bearer ${input.apiKey}`,
    '-H',
    'Content-Type: application/json',
    '-d',
    body,
  ], {
    maxBuffer: 1024 * 1024 * 10,
    env: process.env,
  });

  if (stderr.trim()) {
    throw new Error(`OpenAI Responses API curl failed: ${stderr.trim()}`);
  }

  const payload = JSON.parse(stdout) as {
    error?: { message?: string };
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (payload.error) {
    throw new Error(`OpenAI Responses API request failed: ${payload.error.message || 'unknown error'}`);
  }

  return payload;
}

async function callDeepSeekChatCompletionsWithCurl(input: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<{
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string } }>;
}> {
  const body = JSON.stringify({
    model: input.model,
    messages: [
      {
        role: 'user',
        content: input.prompt,
      },
    ],
    stream: false,
    temperature: 0.2,
  });
  const { stdout, stderr } = await execFileAsync('curl', [
    '-sS',
    'https://api.deepseek.com/chat/completions',
    '-H',
    `Authorization: Bearer ${input.apiKey}`,
    '-H',
    'Content-Type: application/json',
    '-d',
    body,
  ], {
    maxBuffer: 1024 * 1024 * 10,
    env: process.env,
  });

  if (stderr.trim()) {
    throw new Error(`DeepSeek Chat Completions curl failed: ${stderr.trim()}`);
  }

  const payload = JSON.parse(stdout) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (payload.error) {
    throw new Error(`DeepSeek Chat Completions request failed: ${payload.error.message || 'unknown error'}`);
  }

  return payload;
}

function getEvaluationMode(): LiveAIEvaluationReport['mode'] {
  if (process.env.LIVE_AI_EVALUATION_DRY_RUN === 'true') return 'dry_run_structural_check';
  return 'live_ai';
}

function getAIProvider(): string {
  return (process.env.AI_PROVIDER || 'openai').toLowerCase();
}

function assertLiveAIConfig(): void {
  if (process.env.REAL_AI_DIAGNOSIS_LIVE !== 'true') {
    throw new Error('Phase 4.3 Live AI evaluation requires REAL_AI_DIAGNOSIS_LIVE=true.');
  }

  if (getAIProvider() === 'deepseek') {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('Phase 4.3 DeepSeek evaluation requires DEEPSEEK_API_KEY.');
    }
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Phase 4.3 Live AI evaluation requires OPENAI_API_KEY.');
  }
}

function ratio(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 10000) / 10000;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

runLiveAIDiagnosisEvaluation().catch((error: unknown) => {
  console.error('\n[FAIL] Phase 4.3 Live AI evaluation failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
