import type {
  ActionableSuggestion,
  FeedbackAdmissionDecision,
  StudentFeedbackTeachingItem,
  StudentFeedbackTeachingPlan,
  StructuredFeedbackFact,
  StructuredFeedbackFacts,
} from '../schemas/controlledFeedbackExpression.schema.ts';
import type { ControlledFeedbackExpressionInput } from '../schemas/controlledFeedbackExpression.schema.ts';
import type { OpenResponseAnswerStatus } from '../schemas/diagnosis.schema.ts';
import type {
  StudentThinkingReview,
  TaskRequirementCoverage,
} from '../schemas/studentLearningFeedback.schema.ts';

const UNSAFE_LONG_TERM_PATTERN = /已经掌握|长期掌握|稳定提升|能力很差|能力退化|永久|天生/;
const PROMPT_INJECTION_PATTERN = /忽略(?:之前|前面|以上).*规则|打印.*(?:prompt|提示词)|修改.*mainAbility|判定.*掌握/i;
const INTERNAL_DIAGNOSIS_LANGUAGE_PATTERN = /核心事实冲突|证据不足|能力不足|置信度|evidence|root\s*cause|evaluator|internal\s*reason|diagnosis/i;

type StudentFeedbackTaskFocus = {
  subject?: string;
  dimension?: string;
  evidenceKind?: string;
};

export function buildStructuredFeedbackFacts(input: {
  request: ControlledFeedbackExpressionInput;
  admissionDecision: FeedbackAdmissionDecision;
}): StructuredFeedbackFacts {
  const request = input.request;
  const commit = request.realDiagnosisRuntimeResult.formalDiagnosisCommit!;
  const diagnosis = commit.diagnosisResult!;
  const issues: string[] = [];
  const identityAligned = validateIdentity(request, commit.formalDiagnosisId, issues);
  const studentStatements = buildStudentStatements(request.studentResponseText, request.responseId);
  const observedStrengths: StructuredFeedbackFact[] = [];
  const observedAttentionPoints: StructuredFeedbackFact[] = [];
  const taskFocus = deriveTaskFocus(
    request.taskContext?.questionText || '',
    request.taskContext?.answerRequirements || [],
  );
  const positiveContentAllowed = diagnosis.answerStatus !== 'does_not_meet' &&
    diagnosis.answerStatus !== 'insufficient_evidence';

  for (const evidence of request.taskEvidenceReturnResult.abilityEvidence) {
    const sourceLinks = [`evidence:${evidence.id}`];
    if (evidence.diagnosisId) sourceLinks.push(`diagnosis:${evidence.diagnosisId}`);
    if (
      positiveContentAllowed &&
      (evidence.evidenceType === 'positive' || evidence.evidenceType === 'growth')
    ) {
      const responseCommentary = buildTraceableThinkingCommentary(
        request.studentResponseText,
        taskFocus,
        request.taskEvidenceReturnResult.supportContext.usedHint,
      );
      const safeText = responseCommentary?.text || '';
      if (!safeText || UNSAFE_LONG_TERM_PATTERN.test(safeText)) continue;
      observedStrengths.push({
        factId: `feedback-fact-strength-${sanitizeId(evidence.id)}`,
        factType: 'observed_strength',
        text: evidence.observation || evidence.detail,
        safeExpressions: [safeText],
        sourceType: 'evidence_confirmed_fact',
        sourceLinks: [...sourceLinks, `response:${request.responseId}`],
        exactQuote: responseCommentary?.exactQuote,
      });
    } else if (evidence.evidenceType === 'weakness') {
      const safeText = buildObservedExpression(evidence.detail || evidence.observation, 'attention');
      if (!safeText || UNSAFE_LONG_TERM_PATTERN.test(safeText)) continue;
      observedAttentionPoints.push({
        factId: `feedback-fact-attention-${sanitizeId(evidence.id)}`,
        factType: 'observed_attention_point',
        text: evidence.detail || evidence.observation,
        safeExpressions: [safeText],
        sourceType: 'evidence_confirmed_fact',
        sourceLinks,
      });
    }
  }

  if (
    input.admissionDecision.expressionScope === 'full' &&
    diagnosis.answerStatus !== 'fully_meets' &&
    !isNoClearDeficit(diagnosis.rootCause) &&
    !UNSAFE_LONG_TERM_PATTERN.test(diagnosis.rootCause) &&
    observedAttentionPoints.length === 0
  ) {
    observedAttentionPoints.push({
      factId: `feedback-fact-diagnosis-attention-${sanitizeId(commit.formalDiagnosisId)}`,
      factType: 'observed_attention_point',
      text: diagnosis.rootCause,
      safeExpressions: [buildSafeUnderstandingNotice(diagnosis.answerStatus, diagnosis.rootCause)],
      sourceType: 'diagnosis_confirmed_fact',
      sourceLinks: [`diagnosis:${commit.formalDiagnosisId}#rootCause`],
    });
  }

  const quoteSpansValid = studentStatements.every((fact) => {
    const quote = fact.exactQuote;
    return Boolean(
      quote &&
      request.studentResponseText.slice(quote.start, quote.end) === quote.text,
    );
  });
  if (!quoteSpansValid) issues.push('Student quote span validation failed.');

  const allFacts = [...studentStatements, ...observedStrengths, ...observedAttentionPoints];
  const sourceLinksComplete = allFacts.every((fact) => fact.sourceLinks.length > 0);
  if (!sourceLinksComplete) issues.push('Feedback fact source links are incomplete.');

  return {
    factsId: `feedback-facts-${sanitizeId(request.feedbackRequestId)}`,
    feedbackRequestId: request.feedbackRequestId,
    learningRoundId: request.learningRoundId,
    studentId: request.studentId,
    taskId: request.taskId,
    responseId: request.responseId,
    formalDiagnosisId: commit.formalDiagnosisId,
    studentStatements,
    observedStrengths: dedupeFacts(observedStrengths),
    observedAttentionPoints: dedupeFacts(observedAttentionPoints),
    validation: {
      passed: identityAligned && quoteSpansValid && sourceLinksComplete,
      identityAligned,
      quoteSpansValid,
      sourceLinksComplete,
      issues,
    },
  };
}

export function buildStudentFeedbackTeachingPlan(input: {
  request: ControlledFeedbackExpressionInput;
  facts: StructuredFeedbackFacts;
  thinkingReview?: StudentThinkingReview;
}): StudentFeedbackTeachingPlan {
  const diagnosis = input.request.realDiagnosisRuntimeResult.formalDiagnosisCommit!.diagnosisResult!;
  const attentionFacts = input.facts.observedAttentionPoints;
  const sourceFactIds = attentionFacts.map((fact) => fact.factId);
  const sourceLinks = attentionFacts.flatMap((fact) => fact.sourceLinks);
  const sourceText = attentionFacts.map((fact) => fact.text).join('\n');
  const readingText = input.request.taskContext?.readingText?.trim() || '';
  const questionText = input.request.taskContext?.questionText.trim() || '';
  const taskFocus = deriveTaskFocus(
    questionText,
    input.request.taskContext?.answerRequirements || [],
  );
  const primaryGap = resolvePrimaryGap(input.thinkingReview);
  const quotedDetails = extractVerifiedMaterialDetails(sourceText, readingText)
    .filter((detail) => input.request.studentResponseText.includes(detail));
  const issues: string[] = [];
  const understandingText = input.thinkingReview
    ? primaryGap?.gapMessage
    : attentionFacts.length > 0
      ? buildSafeUnderstandingNotice(diagnosis.answerStatus, sourceText, taskFocus)
      : undefined;
  const understandingNotice = understandingText
    ? teachingItem('understanding', understandingText, sourceFactIds, sourceLinks)
    : undefined;
  const detailsToReview = quotedDetails.length > 0
    ? [teachingItem(
      'detail',
      `请重新看看文中的${joinChineseQuotes(quotedDetails)}${quotedDetails.length > 1 ? '这些细节' : '这个细节'}。`,
      sourceFactIds,
      sourceLinks,
    )]
    : [];
  const shouldBuildRevisionActions = input.thinkingReview
    ? Boolean(primaryGap)
    : attentionFacts.length > 0;
  const revisionActions = shouldBuildRevisionActions
    ? buildRevisionActions({
      sourceText,
      questionText,
      taskFocus,
      hasVerifiedDetails: quotedDetails.length > 0,
      primaryGap,
      requirementCoverage: input.thinkingReview?.requirementCoverage || [],
      sourceFactIds,
      sourceLinks,
    })
    : [];
  const allItems = [
    ...(understandingNotice ? [understandingNotice] : []),
    ...detailsToReview,
    ...revisionActions,
  ];
  const sourceFactsExist = allItems.every((item) =>
    item.sourceFactIds.every((factId) => sourceFactIds.includes(factId)));
  const materialDetailsVerified = quotedDetails.every((detail) => readingText.includes(detail));
  const allText = allItems.map((item) => item.text).join('\n');
  const noInternalLanguage = !INTERNAL_DIAGNOSIS_LANGUAGE_PATTERN.test(allText);
  const noLongTermClaim = !UNSAFE_LONG_TERM_PATTERN.test(allText);
  if (!sourceFactsExist) issues.push('Teaching Plan references an unknown feedback fact.');
  if (!materialDetailsVerified) issues.push('Teaching Plan contains an unverified material detail.');
  if (!noInternalLanguage) issues.push('Teaching Plan exposes internal Diagnosis language.');
  if (!noLongTermClaim) issues.push('Teaching Plan contains a long-term ability claim.');

  return {
    planId: `feedback-teaching-plan-${sanitizeId(input.request.feedbackRequestId)}`,
    understandingNotice,
    detailsToReview,
    revisionActions,
    validation: {
      passed: sourceFactsExist && materialDetailsVerified && noInternalLanguage && noLongTermClaim,
      sourceFactsExist,
      materialDetailsVerified,
      noInternalLanguage,
      noLongTermClaim,
      issues,
    },
  };
}

export function buildActionableSuggestions(input: {
  request: ControlledFeedbackExpressionInput;
  admissionDecision: FeedbackAdmissionDecision;
}): ActionableSuggestion[] {
  if (input.admissionDecision.status !== 'content_allowed') return [];
  const commit = input.request.realDiagnosisRuntimeResult.formalDiagnosisCommit!;
  const nextTraining = commit.diagnosisResult?.nextTraining.trim();
  if (nextTraining && !UNSAFE_LONG_TERM_PATTERN.test(nextTraining)) {
    return [{
      suggestionId: `feedback-suggestion-diagnosis-${sanitizeId(commit.formalDiagnosisId)}`,
      text: finishSentence(nextTraining),
      sourceType: 'diagnosis_next_training',
      sourceLinks: [`diagnosis:${commit.formalDiagnosisId}#nextTraining`],
    }];
  }

  return [{
    suggestionId: `feedback-suggestion-default-${sanitizeId(input.request.feedbackRequestId)}`,
    text: '可以按本轮学习安排继续下一步。',
    sourceType: 'deterministic_feedback_rule',
    sourceLinks: ['rule:controlled-feedback-default-next-step'],
  }];
}

function buildStudentStatements(answer: string, responseId: string): StructuredFeedbackFact[] {
  const trimmed = answer.trim();
  if (!trimmed || PROMPT_INJECTION_PATTERN.test(trimmed)) return [];
  const start = answer.indexOf(trimmed);
  if (start < 0) return [];
  const sentenceEnd = trimmed.search(/[。！？!?\n]/);
  const desiredLength = sentenceEnd >= 0 ? sentenceEnd + 1 : Math.min(trimmed.length, 48);
  const quoteText = trimmed.slice(0, Math.min(desiredLength, 48)).trim();
  if (!quoteText) return [];
  const quoteStart = answer.indexOf(quoteText, start);
  const quoteEnd = quoteStart + quoteText.length;
  return [{
    factId: `feedback-fact-student-${sanitizeId(responseId)}`,
    factType: 'student_statement',
    text: quoteText,
    safeExpressions: [`你写出了“${quoteText}”。`],
    sourceType: 'student_exact_quote',
    sourceLinks: [`response:${responseId}`],
    exactQuote: { text: quoteText, start: quoteStart, end: quoteEnd },
  }];
}

function validateIdentity(
  request: ControlledFeedbackExpressionInput,
  formalDiagnosisId: string,
  issues: string[],
): boolean {
  const run = request.realDiagnosisRuntimeResult.runRecord;
  const evidenceReturn = request.taskEvidenceReturnResult;
  const checks = [
    [run.studentId, request.studentId, 'runRecord.studentId'],
    [run.taskId, request.taskId, 'runRecord.taskId'],
    [run.executionSessionId, request.executionSessionId, 'runRecord.executionSessionId'],
    [run.responseId, request.responseId, 'runRecord.responseId'],
    [evidenceReturn.studentId, request.studentId, 'taskEvidenceReturnResult.studentId'],
    [evidenceReturn.taskId, request.taskId, 'taskEvidenceReturnResult.taskId'],
    [evidenceReturn.executionSessionId, request.executionSessionId, 'taskEvidenceReturnResult.executionSessionId'],
    [evidenceReturn.responseId || '', request.responseId, 'taskEvidenceReturnResult.responseId'],
  ];
  for (const [actual, expected, label] of checks) {
    if (actual !== expected) issues.push(`${label} does not match the feedback request.`);
  }
  const diagnosisTrace = evidenceReturn.evidenceTraceLinks.some(
    (link) => link.diagnosisResultId === formalDiagnosisId && link.responseId === request.responseId,
  );
  if (!diagnosisTrace) issues.push('Formal Diagnosis is not present in Evidence trace links.');
  for (const evidence of evidenceReturn.abilityEvidence) {
    if (evidence.studentId !== request.studentId) issues.push(`AbilityEvidence ${evidence.id} studentId mismatch.`);
    if (evidence.taskId !== request.taskId) issues.push(`AbilityEvidence ${evidence.id} taskId mismatch.`);
    if (evidence.diagnosisId !== formalDiagnosisId) issues.push(`AbilityEvidence ${evidence.id} diagnosisId mismatch.`);
  }
  return issues.length === 0;
}

function buildObservedExpression(
  value: string,
  mode: 'strength' | 'attention',
  usedHint = false,
): string {
  const text = value.trim();
  if (!text) return '';
  if (mode === 'strength') {
    const prefix = usedHint ? '在使用提示的情况下，' : '';
    return `${prefix}这次回答中，你已经${finishSentence(stripSubjectPrefix(text))}`;
  }
  return buildSafeUnderstandingNotice(undefined, text);
}

function buildTraceableThinkingCommentary(
  answer: string,
  taskFocus: StudentFeedbackTaskFocus,
  usedHint = false,
): { text: string; exactQuote: { text: string; start: number; end: number } } | undefined {
  const trimmed = answer.trim();
  if (!trimmed || PROMPT_INJECTION_PATTERN.test(trimmed)) return undefined;

  const excerpt = selectAnswerExcerpt(trimmed);
  const start = answer.indexOf(excerpt);
  if (!excerpt || start < 0) return undefined;

  const target = describeThinkingCommentaryTarget(taskFocus);
  const prefix = usedHint ? '在使用提示的情况下，' : '';
  return {
    text: `${prefix}你在回答中写到“${excerpt}”，表达了你对${target}的理解。`,
    exactQuote: {
      text: excerpt,
      start,
      end: start + excerpt.length,
    },
  };
}

function describeThinkingCommentaryTarget(taskFocus: StudentFeedbackTaskFocus): string {
  if (!taskFocus.subject || !taskFocus.dimension) return '题目内容';
  if (taskFocus.dimension === '心理') return `${taskFocus.subject}当时心情`;
  if (taskFocus.dimension === '人物特点') return `${taskFocus.subject}特点`;
  if (taskFocus.dimension === '原因') return '事情原因';
  return `${taskFocus.subject}${taskFocus.dimension}`;
}

function selectAnswerExcerpt(answer: string): string {
  const firstSentence = answer.match(/^.{1,64}?[。！？!?](?:\s|$)/u)?.[0]?.trim();
  if (firstSentence) return firstSentence;
  return answer.slice(0, 64).trim();
}

function buildSafeUnderstandingNotice(
  answerStatus: OpenResponseAnswerStatus | undefined,
  sourceText: string,
  taskFocus?: StudentFeedbackTaskFocus,
): string {
  if (answerStatus === 'insufficient_evidence') {
    return '这次回答提供的信息还不够完整，暂时无法判断你的理解。';
  }
  if (answerStatus === 'does_not_meet' || indicatesConclusionMismatch(sourceText)) {
    if (taskFocus?.subject && taskFocus.dimension && taskFocus.evidenceKind) {
      return buildReflectiveUnderstandingNotice(taskFocus);
    }
    return '请再看看文中与题目直接相关的内容，再想一想自己的回答。';
  }
  if (indicatesMissingEvidence(sourceText)) {
    if (taskFocus?.subject && taskFocus.dimension && taskFocus.evidenceKind) {
      return `你已经写出了${describeAnswerTarget(taskFocus)}，还需要用文中${taskFocus.subject}的具体${taskFocus.evidenceKind}说明理由。`;
    }
    return '这次回答已经有了自己的想法，还需要用文中的具体内容说明理由。';
  }
  if (indicatesMissingRelation(sourceText)) {
    if (taskFocus?.subject && taskFocus.dimension && taskFocus.evidenceKind) {
      return `你已经写出了${describeAnswerTarget(taskFocus)}，还需要说明你为什么能从这些${taskFocus.evidenceKind}得出这样的理解。`;
    }
    return '这次回答已经有了自己的想法，还需要说明文中细节和这个想法有什么关系。';
  }
  return '这次回答还有一处需要补充，请对照题目要求，看看还缺少哪一部分。';
}

function buildRevisionActions(input: {
  sourceText: string;
  questionText: string;
  taskFocus: StudentFeedbackTaskFocus;
  hasVerifiedDetails: boolean;
  primaryGap?: TaskRequirementCoverage;
  requirementCoverage: TaskRequirementCoverage[];
  sourceFactIds: string[];
  sourceLinks: string[];
}): StudentFeedbackTeachingItem[] {
  if (input.primaryGap) {
    const actions = buildPrimaryGapActions({
      primaryGap: input.primaryGap,
      requirementCoverage: input.requirementCoverage,
      taskFocus: input.taskFocus,
    });
    return actions.map((text, index) => teachingItem(
      `revision-primary-gap-${index + 1}`,
      text,
      input.sourceFactIds,
      input.sourceLinks,
    ));
  }

  const actions: string[] = [];
  const asksPsychology = /心理|心情|情感|想法/.test(input.questionText);
  const subject = input.taskFocus.subject;
  const dimension = input.taskFocus.dimension;
  const evidenceKind = input.taskFocus.evidenceKind;
  if (indicatesConclusionMismatch(input.sourceText)) {
    if (subject && dimension && evidenceKind) {
      actions.push(input.hasVerifiedDetails
        ? `先根据这些${evidenceKind}，重新想一想${describeAnswerTarget(input.taskFocus)}。`
        : `先重新阅读${subject}的${evidenceKind}，再想一想${describeAnswerTarget(input.taskFocus)}。`);
    } else {
      actions.push(input.hasVerifiedDetails
        ? `先根据这些细节重新想一想${asksPsychology ? '人物当时的想法或情感' : '自己的答案'}。`
        : '先回到文章中与题目直接相关的内容，再想一想自己的回答。');
    }
  }
  if (indicatesMissingEvidence(input.sourceText) && !input.hasVerifiedDetails) {
    actions.push(buildConcreteEvidenceAction(input.taskFocus));
  }
  if (indicatesMissingEvidence(input.sourceText) || indicatesMissingRelation(input.sourceText)) {
    actions.push(buildEvidenceRelationAction(input.taskFocus));
  }
  if (actions.length === 0) {
    actions.push(
      buildConcreteEvidenceAction(input.taskFocus),
      buildEvidenceRelationAction(input.taskFocus),
    );
  }
  return [...new Set(actions)].map((text, index) =>
    teachingItem(`revision-${index + 1}`, text, input.sourceFactIds, input.sourceLinks));
}

function resolvePrimaryGap(review: StudentThinkingReview | undefined): TaskRequirementCoverage | undefined {
  if (!review?.requirementCoverage?.length) return undefined;
  if (review.primaryGapRequirementId) {
    const byId = review.requirementCoverage.find((item) =>
      item.requirementId === review.primaryGapRequirementId);
    if (byId) return byId;
  }
  if (!review.primaryGap) return undefined;
  return review.requirementCoverage.find((item) => item.gapMessage === review.primaryGap);
}

function buildPrimaryGapActions(input: {
  primaryGap: TaskRequirementCoverage;
  requirementCoverage: TaskRequirementCoverage[];
  taskFocus: StudentFeedbackTaskFocus;
}): string[] {
  const gap = input.primaryGap;
  const target = describeAnswerTarget(input.taskFocus);
  const evidenceKind = input.taskFocus.evidenceKind || '具体内容';
  const hasConclusion = hasCompletedRequirement(input.requirementCoverage, 'conclusion');
  const hasEvidence = hasCompletedRequirement(input.requirementCoverage, 'text_evidence');

  if (gap.status === 'insufficient_to_judge') {
    if (gap.requirementType === 'conclusion') {
      return [`先写出${target}，再结合文中的${evidenceKind}说明理由。`];
    }
    return [`先补充与题目直接相关的${evidenceKind}，再把自己的理解说明清楚。`];
  }

  switch (gap.requirementType) {
    case 'conclusion':
      return buildConclusionReconsiderationActions(input.taskFocus, hasEvidence);
    case 'text_evidence':
      if (gap.status === 'partially_covered') {
        return [`保留已经找到的${evidenceKind}，再补充一处与结论直接相关的${evidenceKind}。`];
      }
      return [hasConclusion
        ? `保留已经写出的${target}，再从文中找出一处能说明这种理解的${evidenceKind}。`
        : buildConcreteEvidenceAction(input.taskFocus)];
    case 'reasoning_relation':
      return [hasConclusion && hasEvidence
        ? `保留已经写出的结论和${evidenceKind}，再说明${describeEvidenceReference(input.taskFocus)}为什么能支持你对${describeUnderstandingTarget(input.taskFocus)}的理解。`
        : buildEvidenceRelationAction(input.taskFocus)];
    case 'expression':
      return ['按照题目要求重新整理答案，让结论、依据和说明之间的顺序更清楚。'];
  }
  return [];
}

function hasCompletedRequirement(
  coverage: TaskRequirementCoverage[],
  type: TaskRequirementCoverage['requirementType'],
): boolean {
  return coverage.some((item) =>
    item.requirementType === type &&
    (item.status === 'covered' || item.status === 'partially_covered'));
}

function buildConcreteEvidenceAction(taskFocus: StudentFeedbackTaskFocus): string {
  const subject = taskFocus.subject;
  switch (taskFocus.evidenceKind) {
    case '动作':
      return subject
        ? `从文中找出${subject}的一个具体动作，写清${subject}做了什么或怎样做。`
        : '从文中找出一个具体动作，写清人物做了什么或怎样做。';
    case '语言':
      return subject
        ? `从文中找出${subject}说的一句话，写清说了什么以及是在什么情况下说的。`
        : '从文中找出人物说的一句话，写清说了什么以及是在什么情况下说的。';
    case '神态':
      return subject
        ? `从文中找出${subject}的一处具体神态，写清表情或神态有什么变化。`
        : '从文中找出人物的一处具体神态，写清表情或神态有什么变化。';
    case '细节':
      return '从文中找出一个与题目直接相关的细节，写清原文中发生了什么。';
    default:
      return '从文中找出一个与题目直接相关的具体内容，写清原文中发生了什么。';
  }
}

function buildConclusionReconsiderationActions(
  taskFocus: StudentFeedbackTaskFocus,
  hasEvidence: boolean,
): string[] {
  const evidenceKind = taskFocus.evidenceKind || '具体内容';
  const target = describeAnswerTarget(taskFocus);
  const evidenceReference = describeEvidenceReference(taskFocus);
  const firstAction = hasEvidence
    ? `保留已经找到的${evidenceKind}。`
    : buildConcreteEvidenceAction(taskFocus);
  const reconsideration = taskFocus.subject && taskFocus.dimension === '心理'
    ? `重新想一想${evidenceReference}表现了${taskFocus.subject}怎样的心理。`
    : `结合${evidenceReference}重新想一想${target}。`;
  const relation = taskFocus.subject && taskFocus.dimension === '心理'
    ? `说明${evidenceReference}为什么能表现出${taskFocus.subject}当时的这种心理。`
    : `说明${evidenceReference}为什么能支持你重新整理后的答案。`;
  return [firstAction, reconsideration, relation];
}

function describeEvidenceReference(taskFocus: StudentFeedbackTaskFocus): string {
  if (taskFocus.evidenceKind === '语言') return '这句话';
  if (taskFocus.evidenceKind === '神态') return '这个神态';
  if (taskFocus.evidenceKind === '动作') return '这个动作';
  return '这个具体内容';
}

function describeUnderstandingTarget(taskFocus: StudentFeedbackTaskFocus): string {
  if (!taskFocus.subject || !taskFocus.dimension) return '题目内容';
  if (taskFocus.dimension === '心理') return `${taskFocus.subject}心理`;
  if (taskFocus.dimension === '人物特点') return `${taskFocus.subject}特点`;
  return describeAnswerTarget(taskFocus);
}

function buildEvidenceRelationAction(taskFocus: StudentFeedbackTaskFocus): string {
  const subject = taskFocus.subject;
  const evidenceReference = describeEvidenceReference(taskFocus);
  if (subject && taskFocus.dimension === '心理') {
    return `再说明${evidenceReference}为什么能支持你对${subject}心理的理解。`;
  }
  if (subject && taskFocus.dimension === '人物特点') {
    return `再说明${evidenceReference}表现了${subject}怎样的特点。`;
  }
  if (subject && taskFocus.dimension) {
    return `再说明${evidenceReference}与${describeAnswerTarget(taskFocus)}有什么关系。`;
  }
  return '再说明这个具体内容和你的想法有什么关系。';
}

function describeAnswerTarget(taskFocus: StudentFeedbackTaskFocus): string {
  if (!taskFocus.subject || !taskFocus.dimension) return '自己的答案';
  if (taskFocus.dimension === '心理') return `${taskFocus.subject}当时的心理`;
  if (taskFocus.dimension === '人物特点') return `${taskFocus.subject}的特点`;
  return `${taskFocus.subject}${taskFocus.dimension}`;
}

function buildReflectiveUnderstandingNotice(taskFocus: StudentFeedbackTaskFocus): string {
  const subject = taskFocus.subject!;
  const evidenceKind = taskFocus.evidenceKind!;
  switch (taskFocus.dimension) {
    case '心理':
      return `从文中${subject}的${evidenceKind}来看，你可以再想一想：${subject}当时可能有怎样的心理？`;
    case '人物特点':
      return `从文中${subject}的${evidenceKind}来看，你可以再想一想：这些${evidenceKind}表现了${subject}怎样的特点？`;
    case '原因':
      return `结合文中${subject}的${evidenceKind}，你可以再想一想：题目所问的原因是什么？`;
    case '含义':
      return `结合文中${subject}的${evidenceKind}，你可以再想一想：这些内容表达了什么意思？`;
    case '作用':
      return `结合文中${subject}的${evidenceKind}，你可以再想一想：这些内容在文中起到了什么作用？`;
    default:
      return `结合文中${subject}的${evidenceKind}，你可以再想一想题目所问的内容。`;
  }
}

function extractVerifiedMaterialDetails(sourceText: string, readingText: string): string[] {
  if (!readingText) return [];
  const details: string[] = [];
  const quotePatterns = [
    /“([^”]{2,40})”/gu,
    /‘([^’]{2,40})’/gu,
    /"([^"]{2,40})"/gu,
    /'([^']{2,40})'/gu,
  ];
  for (const quotePattern of quotePatterns) {
    for (const match of sourceText.matchAll(quotePattern)) {
      const detail = normalizeQuotedDetail(match[1] || '');
      if (detail && readingText.includes(detail) && !details.includes(detail)) details.push(detail);
    }
  }
  return details.slice(0, 3);
}

function deriveTaskFocus(
  questionText: string,
  answerRequirements: string[],
): StudentFeedbackTaskFocus {
  const taskText = [questionText, ...answerRequirements].filter(Boolean).join('\n');
  const subjectPatterns = [
    /^([^，。；！？\n\s]{1,8}?)(?:把|将|的(?:动作|语言|神态|细节|表现))/u,
    /结合(?:文中)?([^，。；！？\n]{1,8}?)(?:的)?(?:动作|语言|神态|细节|表现)/u,
    /([^，。；！？\n\s]{1,8}?)(?:的)?(?:动作|语言|神态|细节|表现)(?:表现|体现|说明|反映)/u,
    /([^，。；！？\n\s]{1,8}?)(?:此时|当时)(?:有|是|表现出|怀着)?(?:怎样|什么|何种)?(?:的)?(?:心理|心情|情感|想法)/u,
    /(?:分析|概括|推断|判断)(?:文中)?([^，。；！？\n]{1,8}?)(?:的)?(?:心理|心情|情感|想法|特点|形象|品质)/u,
  ];
  const subjectCandidates = subjectPatterns
    .map((pattern) => normalizeTaskSubject(taskText.match(pattern)?.[1]?.trim()))
    .filter((value): value is string => Boolean(value));
  const subject = subjectCandidates.find((value) => !isGenericOrPronounSubject(value)) || subjectCandidates[0];
  const dimension = /心理|心情|情感|想法/.test(taskText)
    ? '心理'
    : /人物特点|形象|品质|性格/.test(taskText)
      ? '人物特点'
      : /原因|为什么/.test(taskText)
        ? '原因'
        : /含义|意思/.test(taskText)
          ? '含义'
          : /作用|效果/.test(taskText)
            ? '作用'
            : undefined;
  const evidenceKind = /动作|行为/.test(taskText)
    ? '动作'
    : /语言|对话/.test(taskText)
      ? '语言'
      : /神态|表情/.test(taskText)
        ? '神态'
        : /细节/.test(taskText)
          ? '细节'
          : undefined;
  return {
    subject: subject || (dimension === '心理' && evidenceKind ? '人物' : undefined),
    dimension,
    evidenceKind,
  };
}

function isGenericOrPronounSubject(value: string): boolean {
  return /^(?:人物|他|她|它|他们|她们|它们)$/u.test(value);
}

function normalizeTaskSubject(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/^(?:请|根据|从|结合|判断|推断|分析|概括|文中|文章中|材料中)+/u, '')
    .replace(/(?:此时|当时)$/u, '')
    .replace(/的$/u, '')
    .trim();
  if (!normalized || normalized.length > 8) return undefined;
  return normalized;
}

function normalizeQuotedDetail(value: string): string {
  return value.trim().replace(/[，。；！？,.!?;]+$/u, '').trim();
}

function indicatesConclusionMismatch(value: string): boolean {
  return /核心(?:事实|结论).*冲突|事实冲突|结论错误|判断错误|不一致|未指向|答非所问/.test(value);
}

function indicatesMissingEvidence(value: string): boolean {
  return /未引用|没有引用|缺少(?:文本|原文|材料|具体).*依据|没有(?:文本|原文|材料|具体).*依据|未提供.*依据|依据不足/.test(value);
}

function indicatesMissingRelation(value: string): boolean {
  return /未(?:完整)?说明.*关系|没有(?:完整)?说明.*关系|没有.*说明.*关系|关系说明不完整|推理链.*不完整|缺少.*关系.*说明/.test(value);
}

function teachingItem(
  suffix: string,
  text: string,
  sourceFactIds: string[],
  sourceLinks: string[],
): StudentFeedbackTeachingItem {
  return {
    itemId: `feedback-teaching-${suffix}-${sanitizeId(sourceFactIds.join('-') || 'rule')}`,
    text,
    sourceFactIds: [...sourceFactIds],
    sourceLinks: sourceLinks.length > 0 ? [...new Set(sourceLinks)] : ['rule:student-feedback-safe-template'],
  };
}

function joinChineseQuotes(values: string[]): string {
  return values.map((value) => `“${value}”`).join(values.length > 2 ? '、' : '和');
}

function stripSubjectPrefix(value: string): string {
  return value.replace(/^(学生|该生|本次回答|回答)(?:中)?[：，,\s]*/u, '');
}

function finishSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /[。！？!?]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function isNoClearDeficit(value: string): boolean {
  return /未发现明确|未观察到明确|没有明显|符合题目要求|无需补充/.test(value);
}

function dedupeFacts(facts: StructuredFeedbackFact[]): StructuredFeedbackFact[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = fact.safeExpressions.join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 96);
}
