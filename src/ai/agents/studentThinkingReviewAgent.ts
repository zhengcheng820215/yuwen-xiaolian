import type { ControlledFeedbackExpressionInput } from '../schemas/controlledFeedbackExpression.schema.ts';
import type {
  StudentThinkingReview,
  TaskRequirementCoverage,
  TaskRequirementCoverageStatus,
} from '../schemas/studentLearningFeedback.schema.ts';

const EVIDENCE_REQUIREMENT_PATTERN = /文本依据|结合(?:材料|原文|文章|文中)|结合.{0,8}(?:动作|语言|神态|细节|内容)|具体(?:动作|语句|细节)|引用/;
const RELATION_REQUIREMENT_PATTERN = /说明.*(?:理由|关系)|依据.*结论|为什么|体现|表现|看出/;
const RELATION_MARKER_PATTERN = /因为|所以|说明|体现|表现|看出|可见|表明|由此|这说明/;
const FORMAL_RELATION_CONFIRMED_PATTERN = /动作.{0,8}(?:心理|情感).{0,8}(?:关系|联系)|说明.{0,12}(?:体现|表现)|推理关系(?:成立|完整)/;
const FORMAL_RELATION_MISSING_PATTERN = /没有.{0,12}说明|未.{0,12}说明|关系.{0,8}(?:不完整|缺少)|缺少.{0,8}(?:关系|联系)/;
const CONCLUSION_INCONSISTENCY_PATTERN = /(?:结论|判断|理解|心理|特点|概括|原因).{0,20}(?:与.{0,20})?(?:不一致|冲突|错误|不准确|偏差|不成立|误判|偏离)|(?:不一致|冲突).{0,16}(?:结论|判断|理解|心理|材料|事实)|(?:把|将).{1,24}(?:理解|判断)为/;
const CONCLUSION_SUPPORTED_PATTERN = /(?:结论|判断|理解|心理|方向).{0,16}(?:成立|正确|合理|相符|一致)|(?:方向|结论).{0,8}基本(?:成立|正确)/;
const INTERNAL_LANGUAGE_PATTERN = /evidence|diagnosis|root\s*cause|能力证据|置信度|inference|comprehension/i;
const PROMPT_INJECTION_PATTERN = /忽略(?:之前|前面|以上).*规则|打印.*(?:prompt|提示词)|修改.*mainAbility|判定.*掌握/i;
const NON_EVIDENCE_FRAGMENT_PATTERN = /^(?:自己|本人|此时|当时|这样|这个|那个|这里|那里|文中|文章中|材料中|父亲|母亲|孩子|人物|动作|细节|内容|语句)$/u;
const EVIDENCE_PREDICATE_PATTERN = /把|被|向|朝|给|推|撑|淋|打湿|挥|放下|站|停|看|望|捏|夹|拿|握|走|跑|追|哭|笑|说|问|喊|点头|摇头|低头|抬头|转身|离开|回来|等待|沉默|保护|照顾|帮助|拒绝|收起|打开|关上|蹲|扶|抱/u;

type BuildStudentThinkingReviewOptions = {
  safeStrengths?: string[];
};

export function buildStudentThinkingReview(
  input: ControlledFeedbackExpressionInput,
  options: BuildStudentThinkingReviewOptions = {},
): StudentThinkingReview | undefined {
  const task = input.taskEvidenceReturnResult.concreteTask;
  const diagnosis = input.realDiagnosisRuntimeResult.formalDiagnosisCommit?.diagnosisResult;
  const answer = input.studentResponseText.trim();
  if (!task || !diagnosis || !answer || PROMPT_INJECTION_PATTERN.test(answer)) return undefined;

  const requirementsText = [
    task.question,
    ...task.answerRequirements,
    ...task.scoringPoints,
    ...task.rubric.flatMap((item) => [item.name, item.description || '']),
  ].join('\n');
  const target = describeTaskTarget(task.question, task.targetAbilityName);
  const targetSubject = describeTaskSubject(task.question);
  const relationTarget = target === '人物的心理' ? '人物心理' : target;
  const acceptedKeywords = uniqueStrings(task.questionMetadata.answerAcceptance?.acceptedKeywords || []);
  const matchedKeywords = acceptedKeywords.filter((keyword) => answer.includes(keyword));
  const expectedDetails = extractExpectedMaterialDetails(task.scoringPoints, task.readingText || '', task.question);
  const matchedDetails = matchStudentEvidenceSpans(answer, expectedDetails);
  const formalText = [
    diagnosis.surfaceError,
    diagnosis.rootCause,
    diagnosis.diagnosisSummary,
    ...diagnosis.abilityEvidence,
    ...input.taskEvidenceReturnResult.abilityEvidence.flatMap((item) => [item.detail, item.observation]),
  ].filter(Boolean).join('\n');
  const hasPositiveEvidence = input.taskEvidenceReturnResult.abilityEvidence.some((item) =>
    item.evidenceType === 'positive' || item.evidenceType === 'growth');
  const hasRelationMarker = RELATION_MARKER_PATTERN.test(answer);
  const safeStrength = options.safeStrengths
    ?.map((item) => item.trim())
    .find((item) => item && !INTERNAL_LANGUAGE_PATTERN.test(item));

  const coverage: TaskRequirementCoverage[] = [];
  coverage.push(buildConclusionCoverage({
    taskId: task.taskId,
    target,
    answer,
    answerStatus: diagnosis.answerStatus,
    matchedKeywords,
    targetSubject,
    hasMaterialDetail: matchedDetails.length > 0,
    hasPositiveEvidence,
    safeStrength,
    formalText,
  }));

  const requiresEvidence = EVIDENCE_REQUIREMENT_PATTERN.test(requirementsText);
  const requiresRelation = RELATION_REQUIREMENT_PATTERN.test(requirementsText);
  if (requiresEvidence) {
    coverage.push(buildEvidenceCoverage({
      taskId: task.taskId,
      target,
      conclusion: matchedKeywords[0],
      requiresRelation,
      matchedDetails,
      expectedDetails,
      formalText,
      answerStatus: diagnosis.answerStatus,
      matchedRubricItems: diagnosis.matchedRubricItems || [],
      missingRubricItems: diagnosis.missingRubricItems || [],
    }));
  }

  if (requiresRelation) {
    coverage.push(buildRelationCoverage({
      taskId: task.taskId,
      relationTarget,
      conclusion: matchedKeywords[0],
      hasRelationMarker,
      hasMaterialDetail: matchedDetails.length > 0,
      formalText,
      answerStatus: diagnosis.answerStatus,
      matchedRubricItems: diagnosis.matchedRubricItems || [],
      missingRubricItems: diagnosis.missingRubricItems || [],
    }));
  }

  const coveredPoints = coverage
    .filter((item) => item.status === 'covered' || item.status === 'partially_covered')
    .map((item) => item.studentMessage)
    .filter(isString)
    .slice(0, 2);
  const primaryGapCoverage = selectPrimaryGap(coverage);
  const primaryGap = diagnosis.answerStatus === 'insufficient_evidence'
    ? buildInsufficientAnswerGap({
        target,
        matchedKeywords,
        requiresEvidence,
        requiresRelation,
      })
    : primaryGapCoverage?.gapMessage;

  if (coveredPoints.length === 0 && !primaryGap) return undefined;
  return {
    requirementCoverage: coverage,
    coveredPoints: uniqueStrings(coveredPoints),
    primaryGapRequirementId: primaryGapCoverage?.requirementId,
    primaryGap,
    missingPoints: primaryGap ? [primaryGap] : [],
  };
}

function buildInsufficientAnswerGap(input: {
  target: string;
  matchedKeywords: string[];
  requiresEvidence: boolean;
  requiresRelation: boolean;
}): string {
  const matchedConclusion = input.matchedKeywords[0];
  if (matchedConclusion && input.requiresEvidence && input.requiresRelation) {
    return `你已经写出了“${matchedConclusion}”这一${input.target}，但还没有结合文中的具体动作或语句，说明为什么能得出这个判断。`;
  }
  if (matchedConclusion && input.requiresEvidence) {
    return `你已经写出了“${matchedConclusion}”这一${input.target}，但还没有写出支撑这个判断的具体动作或语句。`;
  }
  if (matchedConclusion && input.requiresRelation) {
    return `你已经写出了“${matchedConclusion}”这一${input.target}，但还没有说明为什么能得出这个判断。`;
  }
  if (input.requiresEvidence && input.requiresRelation) {
    return `这次回答还没有明确写出${input.target}；还需要结合文中的具体动作或语句，说明为什么能得出这个判断。`;
  }
  if (input.requiresEvidence) {
    return `这次回答还没有明确写出${input.target}，也没有写出支撑判断的具体动作或语句。`;
  }
  if (input.requiresRelation) {
    return `这次回答还没有明确写出${input.target}，也没有说明理由。`;
  }
  return `这次回答还没有明确写出${input.target}。`;
}

function buildConclusionCoverage(input: {
  taskId: string;
  target: string;
  answer: string;
  answerStatus?: string;
  matchedKeywords: string[];
  targetSubject?: string;
  hasMaterialDetail: boolean;
  hasPositiveEvidence: boolean;
  safeStrength?: string;
  formalText: string;
}): TaskRequirementCoverage {
  if (input.answerStatus === 'insufficient_evidence') {
    return coverageItem(input.taskId, 'conclusion', `写出${input.target}`, 'insufficient_to_judge', {
      taskEvidence: [`题目要求写出${input.target}`],
      source: 'formal_diagnosis',
      gapMessage: `目前的回答信息还不足以判断是否已经写清${input.target}。`,
      gapReasonCode: 'insufficient_to_judge',
    });
  }
  if (CONCLUSION_INCONSISTENCY_PATTERN.test(input.formalText)) {
    const understandingTarget = describeUnderstandingTarget(input.target, input.targetSubject);
    return coverageItem(input.taskId, 'conclusion', `写出${input.target}`, 'missing', {
      taskEvidence: [`题目要求写出${input.target}`],
      source: 'formal_diagnosis',
      gapMessage: input.hasMaterialDetail
        ? `你已经找到了文中的具体内容，但你写出的${understandingTarget}与这些内容表现出的意思不一致。`
        : `你写出的${understandingTarget}与材料表现出的意思不一致。`,
      gapReasonCode: 'conclusion_inconsistent',
    });
  }
  if (input.matchedKeywords.length > 0) {
    return coverageItem(input.taskId, 'conclusion', `写出${input.target}`, 'covered', {
      studentEvidence: input.matchedKeywords.slice(0, 2),
      taskEvidence: ['正式任务的可接受方向'],
      source: 'task_requirement',
      studentMessage: buildCoveredConclusion(input.target, input.matchedKeywords.slice(0, 2)),
    });
  }
  if (CONCLUSION_SUPPORTED_PATTERN.test(input.formalText)) {
    return coverageItem(input.taskId, 'conclusion', `写出${input.target}`, 'covered', {
      studentEvidence: [input.answer],
      taskEvidence: ['正式 Diagnosis 已确认该回答方向成立'],
      source: 'formal_diagnosis',
      studentMessage: input.safeStrength || `你已经写出了对${describeUnderstandingTarget(input.target, input.targetSubject)}的理解。`,
    });
  }
  if (input.hasPositiveEvidence && input.answerStatus === 'fully_meets') {
    return coverageItem(input.taskId, 'conclusion', `写出${input.target}`, 'covered', {
      studentEvidence: [input.answer],
      taskEvidence: ['正式 Diagnosis 与 Positive / Growth Evidence 已确认该回答方向'],
      source: 'ability_evidence',
      studentMessage: input.safeStrength || `你已经回答了${input.target}这一关键问题。`,
    });
  }
  if (input.hasPositiveEvidence && input.answerStatus === 'partially_meets') {
    return coverageItem(input.taskId, 'conclusion', `写出${input.target}`, 'partially_covered', {
      studentEvidence: [input.answer],
      taskEvidence: ['正式 Diagnosis 与 Positive / Growth Evidence 已确认部分成立'],
      source: 'ability_evidence',
      studentMessage: input.safeStrength || `你对${input.target}已经有了基本方向。`,
      gapMessage: `${input.target}已经有了基本方向，但表达还不够明确。`,
      gapReasonCode: 'incomplete_task_requirement',
    });
  }
  if (input.answerStatus === 'does_not_meet') {
    const understandingTarget = describeUnderstandingTarget(input.target, input.targetSubject);
    return coverageItem(input.taskId, 'conclusion', `写出${input.target}`, 'insufficient_to_judge', {
      studentEvidence: [input.answer],
      taskEvidence: [`题目要求写出${input.target}`],
      source: 'formal_diagnosis',
      gapMessage: `你已经写出了对${understandingTarget}的理解，但目前还不能确认这个理解是否充分。`,
      gapReasonCode: 'insufficient_to_judge',
    });
  }
  return coverageItem(input.taskId, 'conclusion', `写出${input.target}`, 'insufficient_to_judge', {
    taskEvidence: [`题目要求写出${input.target}`],
    source: 'formal_diagnosis',
    gapMessage: `目前的信息还不足以判断是否已经写清${input.target}。`,
    gapReasonCode: 'insufficient_to_judge',
  });
}

function buildEvidenceCoverage(input: {
  taskId: string;
  target: string;
  conclusion?: string;
  requiresRelation: boolean;
  matchedDetails: string[];
  expectedDetails: string[];
  formalText: string;
  answerStatus?: string;
  matchedRubricItems: string[];
  missingRubricItems: string[];
}): TaskRequirementCoverage {
  const rubricMatched = hasRubricSignal(input.matchedRubricItems, /text|evidence|clue|detail|动作|细节|依据/i);
  const rubricMissing = hasRubricSignal(input.missingRubricItems, /text|evidence|clue|detail|动作|细节|依据/i);
  const formalMissing = rubricMissing || /(?:没有|未|缺少).{0,12}(?:文本依据|动作|细节|引用)/.test(input.formalText);

  if (input.matchedDetails.length > 0) {
    const status: TaskRequirementCoverageStatus =
      input.expectedDetails.length > 1 && input.matchedDetails.length < input.expectedDetails.length
        ? 'partially_covered'
        : 'covered';
    return coverageItem(input.taskId, 'text_evidence', '使用文中的具体内容作为依据', status, {
      studentEvidence: input.matchedDetails,
      taskEvidence: input.expectedDetails,
      source: 'task_requirement',
      studentMessage: buildCoveredEvidenceMessage(input.matchedDetails.slice(0, 2)),
      gapMessage: status === 'partially_covered'
        ? '你已经用到了一处具体内容，但题目要求的文本依据还没有完整体现。'
        : undefined,
      gapReasonCode: status === 'partially_covered' ? 'missing_text_evidence' : undefined,
    });
  }
  if (input.answerStatus === 'fully_meets' && rubricMatched && !formalMissing) {
    return coverageItem(input.taskId, 'text_evidence', '使用文中的具体内容作为依据', 'insufficient_to_judge', {
      taskEvidence: input.expectedDetails,
      source: 'formal_diagnosis',
    });
  }
  if (input.answerStatus === 'insufficient_evidence') {
    return coverageItem(input.taskId, 'text_evidence', '使用文中的具体内容作为依据', 'insufficient_to_judge', {
      taskEvidence: input.expectedDetails,
      source: 'formal_diagnosis',
      gapMessage: '目前的回答信息还不足以判断是否使用了合适的文本依据。',
      gapReasonCode: 'insufficient_to_judge',
    });
  }
  return coverageItem(input.taskId, 'text_evidence', '使用文中的具体内容作为依据', 'missing', {
    taskEvidence: input.expectedDetails,
    source: formalMissing || rubricMatched ? 'formal_diagnosis' : 'task_requirement',
    gapMessage: buildMissingEvidenceGap({
      target: input.target,
      conclusion: input.conclusion,
      requiresRelation: input.requiresRelation,
    }),
    gapReasonCode: 'missing_text_evidence',
  });
}

function buildMissingEvidenceGap(input: {
  target: string;
  conclusion?: string;
  requiresRelation: boolean;
}): string {
  const evidenceKind = describeEvidenceKind(input.target);
  if (input.conclusion && input.requiresRelation) {
    return `还需要从文中找出${evidenceKind}，并说明这个具体内容为什么能体现“${input.conclusion}”。`;
  }
  if (input.conclusion) {
    return `还需要从文中找出能够支持“${input.conclusion}”这一理解的${evidenceKind}。`;
  }
  if (input.requiresRelation) {
    return `还需要从文中找出${evidenceKind}，并说明它和你的理解有什么关系。`;
  }
  return `还需要从文中找出${evidenceKind}，用来支持你的理解。`;
}

function buildRelationCoverage(input: {
  taskId: string;
  relationTarget: string;
  conclusion?: string;
  hasRelationMarker: boolean;
  hasMaterialDetail: boolean;
  formalText: string;
  answerStatus?: string;
  matchedRubricItems: string[];
  missingRubricItems: string[];
}): TaskRequirementCoverage {
  const rubricMatched = hasRubricSignal(input.matchedRubricItems, /relation|inference|reason|解释|关系|推理/i);
  const rubricMissing = hasRubricSignal(input.missingRubricItems, /relation|inference|reason|解释|关系|推理/i);
  const formalMissing = rubricMissing || FORMAL_RELATION_MISSING_PATTERN.test(input.formalText);
  const formalCovered = !formalMissing && (
    rubricMatched || (
      input.answerStatus === 'fully_meets' &&
      FORMAL_RELATION_CONFIRMED_PATTERN.test(input.formalText)
    )
  );

  if (
    input.answerStatus !== 'does_not_meet' &&
    !formalMissing &&
    input.hasRelationMarker &&
    input.hasMaterialDetail
  ) {
    return coverageItem(input.taskId, 'reasoning_relation', `说明具体内容和${input.relationTarget}之间的联系`, 'covered', {
      taskEvidence: [`题目要求说明具体内容和${input.relationTarget}之间的联系`],
      source: formalCovered ? (rubricMatched ? 'rubric' : 'ability_evidence') : 'task_requirement',
      studentMessage: `你说明了具体内容和${input.relationTarget}之间的联系。`,
    });
  }
  if (formalCovered && (!input.hasRelationMarker || !input.hasMaterialDetail)) {
    return coverageItem(input.taskId, 'reasoning_relation', `说明具体内容和${input.relationTarget}之间的联系`, 'insufficient_to_judge', {
      taskEvidence: [`题目要求说明具体内容和${input.relationTarget}之间的联系`],
      source: 'formal_diagnosis',
    });
  }
  if (input.answerStatus === 'insufficient_evidence') {
    return coverageItem(input.taskId, 'reasoning_relation', `说明具体内容和${input.relationTarget}之间的联系`, 'insufficient_to_judge', {
      taskEvidence: [`题目要求说明具体内容和${input.relationTarget}之间的联系`],
      source: 'formal_diagnosis',
      gapMessage: '目前的回答信息还不足以判断是否说明了理由。',
      gapReasonCode: 'insufficient_to_judge',
    });
  }
  return coverageItem(input.taskId, 'reasoning_relation', `说明具体内容和${input.relationTarget}之间的联系`, 'missing', {
    taskEvidence: [`题目要求说明具体内容和${input.relationTarget}之间的联系`],
    source: formalMissing ? 'formal_diagnosis' : 'task_requirement',
    gapMessage: input.conclusion
      ? `文中的具体内容为什么能表现出“${input.conclusion}”，这一点还没有说明清楚。`
      : `文中的具体内容和${input.relationTarget}之间的联系还没有说明清楚。`,
    gapReasonCode: 'missing_reasoning_relation',
  });
}

function coverageItem(
  taskId: string,
  requirementType: TaskRequirementCoverage['requirementType'],
  requirementText: string,
  status: TaskRequirementCoverageStatus,
  details: Pick<TaskRequirementCoverage, 'taskEvidence' | 'source'> &
    Partial<Pick<TaskRequirementCoverage, 'studentEvidence' | 'studentMessage' | 'gapMessage' | 'gapReasonCode'>>,
): TaskRequirementCoverage {
  return {
    requirementId: `${taskId}:${requirementType}`,
    requirementType,
    requirementText,
    required: true,
    status,
    studentEvidence: uniqueStrings(details.studentEvidence || []),
    taskEvidence: uniqueStrings(details.taskEvidence),
    source: details.source,
    studentMessage: details.studentMessage,
    gapMessage: details.gapMessage,
    gapReasonCode: details.gapReasonCode,
  };
}

function selectPrimaryGap(coverage: TaskRequirementCoverage[]): TaskRequirementCoverage | undefined {
  const typeOrder: TaskRequirementCoverage['requirementType'][] = [
    'conclusion',
    'text_evidence',
    'reasoning_relation',
    'expression',
  ];
  for (const status of ['missing', 'partially_covered', 'insufficient_to_judge'] as const) {
    for (const type of typeOrder) {
      const item = coverage.find((candidate) => candidate.requirementType === type && candidate.status === status);
      if (item?.gapMessage) return item;
    }
  }
  return undefined;
}

function buildCoveredConclusion(target: string, keywords: string[]): string {
  const content = `“${keywords.join('、')}”`;
  if (target === '人物的心理') return `你写出了${content}这一人物心理。`;
  if (target === '人物的特点') return `你写出了${content}这一人物特点。`;
  if (target === '事情的原因') return `你写出了${content}这一关键原因。`;
  return `你写出了${target}中的${content}这一关键意思。`;
}

function buildCoveredEvidenceMessage(details: string[]): string {
  if (details.length === 1) {
    return `你注意到了文中的“${details[0]}”这一具体内容，并用它支持自己的理解。`;
  }
  return `你注意到了文中的“${details.join('”和“')}”这些具体内容，并用它们支持自己的理解。`;
}

function extractExpectedMaterialDetails(
  scoringPoints: string[],
  readingText: string,
  questionText: string,
): string[] {
  if (!readingText) return [];
  const details: string[] = [];
  for (const point of scoringPoints) {
    const segments = point
      .split(/[、，；。]|(?:以及)|(?:并且)|(?:并)/u)
      .map((item) => item.replace(/^(?:指出|引用|结合|说明|写出|找到|根据)/u, '').trim())
      .filter(Boolean);
    for (const segment of segments) {
      if (RELATION_REQUIREMENT_PATTERN.test(segment) || !isMeaningfulEvidencePhrase(segment)) continue;
      const match = longestSharedMaterialPhrase(segment, readingText, questionText);
      if (match || isSemanticallyRelatedToTask(segment, readingText, questionText)) {
        details.push(segment);
      }
    }
  }
  return uniqueStrings(details).slice(0, 3);
}

function matchStudentEvidenceSpans(answer: string, expectedDetails: string[]): string[] {
  const spans: string[] = [];
  const clauses = answer
    .split(/[，。；！？\n]/u)
    .map((item) => item.trim())
    .filter((item) => isMeaningfulEvidencePhrase(item));

  for (const detail of expectedDetails) {
    if (answer.includes(detail)) {
      spans.push(detail);
      continue;
    }
    const equivalent = clauses.find((clause) => semanticEvidenceEquivalent(clause, detail));
    if (equivalent) spans.push(equivalent);
  }
  return uniqueStrings(spans).slice(0, 3);
}

function longestSharedMaterialPhrase(signal: string, readingText: string, questionText: string): string {
  const compactSignal = signal.replace(/[\s“”"'：:（）()]/gu, '');
  const compactReading = readingText.replace(/\s/gu, '');
  const compactQuestion = questionText.replace(/\s/gu, '');
  for (let length = Math.min(10, compactSignal.length); length >= 2; length -= 1) {
    for (let start = 0; start + length <= compactSignal.length; start += 1) {
      const phrase = compactSignal.slice(start, start + length);
      if (
        /^(?:人物|心理|动作|细节|文本|材料|父亲|母亲|孩子|学生)$/u.test(phrase) ||
        (!compactReading.includes(phrase) && !compactQuestion.includes(phrase)) ||
        !isMeaningfulEvidencePhrase(phrase)
      ) continue;
      return phrase;
    }
  }
  return '';
}

function isMeaningfulEvidencePhrase(value: string): boolean {
  const phrase = value.replace(/[\s，。；、！？“”"'：:（）()]/gu, '');
  if (phrase.length < 2 || NON_EVIDENCE_FRAGMENT_PATTERN.test(phrase)) return false;
  if (/^(?:自己|本人|此时|当时|这样|这个|那个|这里|那里)(?:的|地|得)?$/u.test(phrase)) return false;
  return EVIDENCE_PREDICATE_PATTERN.test(phrase);
}

function isSemanticallyRelatedToTask(signal: string, readingText: string, questionText: string): boolean {
  const taskClauses = `${readingText}\n${questionText}`
    .split(/[，。；！？\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);
  return taskClauses.some((clause) => semanticEvidenceEquivalent(signal, clause));
}

function semanticEvidenceEquivalent(left: string, right: string): boolean {
  const normalizedLeft = normalizeEvidenceSemantics(left);
  const normalizedRight = normalizeEvidenceSemantics(right);
  if (normalizedLeft.length < 2 || normalizedRight.length < 2) return false;

  const sharedPredicates = evidencePredicates(normalizedLeft)
    .filter((predicate) => evidencePredicates(normalizedRight).includes(predicate));
  if (sharedPredicates.length === 0) return false;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const leftContext = evidenceContextCharacters(normalizedLeft, sharedPredicates);
  const rightContext = evidenceContextCharacters(normalizedRight, sharedPredicates);
  const commonContext = [...leftContext].filter((character) => rightContext.has(character));
  const contextBase = Math.min(leftContext.size, rightContext.size);
  if (contextBase > 0 && commonContext.length >= 2 && commonContext.length / contextBase >= 0.5) return true;

  return sharedPredicates.some((predicate) => predicate.length >= 2) &&
    (leftContext.size === 0 || rightContext.size === 0);
}

function normalizeEvidenceSemantics(value: string): string {
  return value
    .replace(/雨伞/gu, '伞')
    .replace(/摆手/gu, '挥手')
    .replace(/垂下/gu, '放下')
    .replace(/(?:小心地?|轻轻地?)(?:夹回|放回)/gu, '放回')
    .replace(/夹回/gu, '放回')
    .replace(/(?:往|朝)([^，。；！？]{1,10}?)(?:那边|一边|方向)?推(?:了推)?/gu, '推$1')
    .replace(/推向|推给/gu, '推')
    .replace(/(?:被)?(?:雨水?|雨)?(?:淋湿|打湿)|淋雨/gu, '湿')
    .replace(/不停地?|一直|久久|很久/gu, '持续')
    .replace(/胳膊/gu, '手臂')
    .replace(/(?:父亲|母亲|人物|学生|自己|本人|他|她|它)/gu, '')
    .replace(/(?:这个|那个|这样|那里|这里|此时|当时|文中|文章中|材料中)/gu, '')
    .replace(/(?:因为|所以|说明|体现|表现|看出|可见|表明|由此)/gu, '')
    .replace(/[\s，。；、！？“”"'：:（）()的地得了着又再才却将把被往向朝]/gu, '');
}

function evidencePredicates(value: string): string[] {
  const predicates = [
    '挥手', '放下', '放回', '淋湿', '推', '撑', '湿', '站', '停', '看', '望', '捏', '拿', '握',
    '走', '跑', '追', '哭', '笑', '说', '问', '喊', '点头', '摇头', '低头', '抬头', '转身', '离开',
    '回来', '等待', '沉默', '保护', '照顾', '帮助', '拒绝', '收起', '打开', '关上', '蹲', '扶', '抱',
  ];
  return predicates.filter((predicate) => value.includes(predicate));
}

function evidenceContextCharacters(value: string, predicates: string[]): Set<string> {
  let context = value;
  predicates.forEach((predicate) => { context = context.replaceAll(predicate, ''); });
  return new Set([...context].filter((character) => !/[持续慢快半边]/u.test(character)));
}

function describeTaskTarget(question: string, abilityName: string): string {
  if (/心理|心情|情感/.test(question)) return '人物的心理';
  if (/特点|品质|形象/.test(question)) return '人物的特点';
  if (/原因|为什么/.test(question)) return '事情的原因';
  return `${abilityName || '本题'}的关键内容`;
}

function describeTaskSubject(question: string): string | undefined {
  const patterns = [
    /^([^，。；！？\n\s]{1,8}?)(?:把|将|的(?:动作|语言|神态|细节|表现))/u,
    /(?:结合|根据|从)(?:文中)?([^，。；！？\n]{1,8}?)(?:的)?(?:动作|语言|神态|细节|表现)/u,
    /([^，。；！？\n\s]{1,8}?)(?:此时|当时)(?:有|是|表现出|怀着)?(?:怎样|什么|何种)?(?:的)?(?:心理|心情|情感|想法)/u,
  ];
  for (const pattern of patterns) {
    const value = question.match(pattern)?.[1]
      ?.replace(/^(?:请|结合|根据|从|文中|文章中|材料中)+/u, '')
      .replace(/的$/u, '')
      .trim();
    if (value && !isGenericTaskSubject(value) && value.length <= 8) return value;
  }
  return undefined;
}

function isGenericTaskSubject(value: string): boolean {
  return /^(?:人物|他|她|它|他们|她们|它们)$/u.test(value);
}

function describeUnderstandingTarget(target: string, subject?: string): string {
  if (subject && target === '人物的心理') return `${subject}心理`;
  if (subject && target === '人物的特点') return `${subject}特点`;
  if (target === '人物的心理') return '人物心理';
  if (target === '人物的特点') return '人物特点';
  if (target === '事情的原因') return '事情原因';
  return target;
}

function describeEvidenceKind(target: string): string {
  if (target === '人物的心理' || target === '人物的特点') return '人物的具体动作或语句';
  return '文中的具体内容';
}

function hasRubricSignal(items: string[], pattern: RegExp): boolean {
  return items.some((item) => pattern.test(item));
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}
