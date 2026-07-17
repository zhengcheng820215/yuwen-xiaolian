import type {
  ActionableSuggestion,
  FeedbackAdmissionDecision,
  StructuredFeedbackFact,
  StructuredFeedbackFacts,
} from '../schemas/controlledFeedbackExpression.schema.ts';
import type { ControlledFeedbackExpressionInput } from '../schemas/controlledFeedbackExpression.schema.ts';

const UNSAFE_LONG_TERM_PATTERN = /已经掌握|长期掌握|稳定提升|能力很差|能力退化|永久|天生/;
const PROMPT_INJECTION_PATTERN = /忽略(?:之前|前面|以上).*规则|打印.*(?:prompt|提示词)|修改.*mainAbility|判定.*掌握/i;

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

  for (const evidence of request.taskEvidenceReturnResult.abilityEvidence) {
    const sourceLinks = [`evidence:${evidence.id}`];
    if (evidence.diagnosisId) sourceLinks.push(`diagnosis:${evidence.diagnosisId}`);
    if (evidence.evidenceType === 'positive' || evidence.evidenceType === 'growth') {
      const safeText = buildObservedExpression(
        evidence.observation || evidence.detail,
        'strength',
        request.taskEvidenceReturnResult.supportContext.usedHint,
      );
      if (!safeText || UNSAFE_LONG_TERM_PATTERN.test(safeText)) continue;
      observedStrengths.push({
        factId: `feedback-fact-strength-${sanitizeId(evidence.id)}`,
        factType: 'observed_strength',
        text: evidence.observation || evidence.detail,
        safeExpressions: [safeText],
        sourceType: 'evidence_confirmed_fact',
        sourceLinks,
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
      safeExpressions: [`本次回答还可以进一步完善：${finishSentence(diagnosis.rootCause)}`],
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
    const prefix = usedHint ? '在使用提示的情况下，本次回答中，' : '本次回答中，';
    return `${prefix}${finishSentence(stripSubjectPrefix(text))}`;
  }
  return `本次回答还可以进一步完善：${finishSentence(stripSubjectPrefix(text))}`;
}

function stripSubjectPrefix(value: string): string {
  return value.replace(/^(学生|该生|本次回答|回答中)[：，,\s]*/u, '');
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
