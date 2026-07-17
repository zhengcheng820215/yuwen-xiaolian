import {
  DIAGNOSIS_QUALITY_POLICY_V2,
  DIAGNOSIS_QUALITY_POLICY_V21,
  DIAGNOSIS_QUALITY_V2_SCHEMA_VERSION,
  type DiagnosisAttributionEnvelope,
  type DiagnosisQualityEvaluationV2,
  type DiagnosisQualityPolicyV2Input,
  type DiagnosisReviewFinding,
  type DiagnosisStabilityEvaluationV2,
  type RootCauseBoundaryCategory,
  type TextAttribution,
  type TextAttributionSource,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';
import {
  acceptsRootCauseV21,
  classifyRootCauseV21,
} from '../evaluation/diagnosisQualityPolicyV21.ts';

const OVERREACH_PATTERNS = ['长期掌握', '已经掌握', '永久', '天生', '稳定提升', '能力很差', '能力退化'];

export function evaluateDiagnosisQualityV2(
  input: DiagnosisQualityPolicyV2Input,
): DiagnosisQualityEvaluationV2 {
  return evaluateDiagnosisQuality(input, 'v2_1');
}

export function evaluateDiagnosisQualityPolicyV2Legacy(
  input: DiagnosisQualityPolicyV2Input,
): DiagnosisQualityEvaluationV2 {
  return evaluateDiagnosisQuality(input, 'v2');
}

function evaluateDiagnosisQuality(
  input: DiagnosisQualityPolicyV2Input,
  policy: 'v2' | 'v2_1',
): DiagnosisQualityEvaluationV2 {
  const validationIssues = validateInput(input);
  const aggregate = candidateText(input.candidate);
  const mainAbilityAccepted = input.annotation.allowedMainAbilities.includes(input.candidate.mainAbility);
  const answerStatusAccepted = Boolean(input.candidate.answerStatus) &&
    input.annotation.allowedAnswerStatuses.some((status) => status === input.candidate.answerStatus);
  const rootCauseClassification = policy === 'v2_1'
    ? classifyRootCauseV21(input.candidate.rootCause)
    : undefined;
  const detectedRootCauseCategories = rootCauseClassification?.categories || classifyRootCause(input.candidate.rootCause);
  const rootCauseCategoryAccepted = rootCauseClassification
    ? acceptsRootCauseV21({
      classification: rootCauseClassification,
      annotation: input.annotation,
      answerStatus: input.candidate.answerStatus,
    }).accepted
    : detectedRootCauseCategories.some((category) => input.annotation.allowedRootCauseCategories.includes(category));
  const matchedFactIds = input.annotation.requiredFacts
    .filter((fact) => fact.acceptedExpressions.some((expression) => contains(aggregate, expression)))
    .map((fact) => fact.factId);
  const missingFactIds = input.annotation.requiredFacts
    .filter((fact) => fact.required && !matchedFactIds.includes(fact.factId))
    .map((fact) => fact.factId);
  const attributionEnvelope = buildAttributionEnvelope(input);
  const forbiddenClaims = input.annotation.forbiddenClaims.filter((claim) => contains(aggregate, claim));
  const overreachClaims = OVERREACH_PATTERNS.filter((claim) => aggregate.includes(claim));
  const quoteAttributionValid = attributionEnvelope.validation.passed;
  const noBoundaryOverreach = overreachClaims.length === 0;
  const noCriticalHallucination = quoteAttributionValid && forbiddenClaims.length === 0;
  const reviewFindings = buildReviewFindings({
    input,
    mainAbilityAccepted,
    answerStatusAccepted,
    rootCauseCategoryAccepted,
    detectedRootCauseCategories,
    missingFactIds,
    quoteAttributionValid,
  });
  const limitations: string[] = [];
  if (rootCauseClassification?.status === 'conflicting') {
    limitations.push('Root cause contains mutually exclusive categories and requires human review.');
  } else if (detectedRootCauseCategories.includes('unknown')) {
    limitations.push('Root cause category could not be determined safely and requires human review.');
  }
  if (input.annotation.reviewerAgreement !== 'agreed') {
    limitations.push(`Annotation reviewer agreement is ${input.annotation.reviewerAgreement}.`);
  }

  let qualityLevel: DiagnosisQualityEvaluationV2['qualityLevel'];
  if (validationIssues.length > 0 || !noCriticalHallucination || !noBoundaryOverreach) {
    qualityLevel = 'critical_violation';
  } else if (!mainAbilityAccepted || !answerStatusAccepted) {
    qualityLevel = 'unacceptable';
  } else if (!rootCauseCategoryAccepted || missingFactIds.length > 0 || input.annotation.reviewerAgreement !== 'agreed') {
    qualityLevel = 'questionable';
  } else {
    qualityLevel = 'accepted';
  }

  const offlineDecision = qualityLevel === 'accepted'
    ? 'accepted_candidate'
    : qualityLevel === 'questionable'
      ? 'human_review'
      : qualityLevel === 'critical_violation'
        ? 'critical_alert'
        : 'blocked';

  return {
    schemaVersion: DIAGNOSIS_QUALITY_V2_SCHEMA_VERSION,
    policyVersion: policy === 'v2_1' ? DIAGNOSIS_QUALITY_POLICY_V21 : DIAGNOSIS_QUALITY_POLICY_V2,
    annotationVersion: input.annotationVersion,
    datasetVersion: input.datasetVersion,
    evaluationId: `diagnosis-quality-${policy.replace('_', '-')}-${input.sampleId}-${input.runId}`,
    sampleId: input.sampleId,
    runId: input.runId,
    qualityLevel,
    dimensions: {
      mainAbilityAccepted,
      answerStatusAccepted,
      rootCauseCategoryAccepted,
      requiredFactsPresent: missingFactIds.length === 0,
      quoteAttributionValid,
      noBoundaryOverreach,
      noCriticalHallucination,
    },
    detectedRootCauseCategories,
    matchedFactIds,
    missingFactIds,
    attributionEnvelope,
    reviewFindings,
    limitations,
    offlineDecision,
    canBecomeFormalCandidate: qualityLevel === 'accepted',
    evaluatedAt: input.evaluatedAt,
    validation: {
      passed: validationIssues.length === 0,
      issues: validationIssues,
    },
  };
}

export function evaluateDiagnosisStabilityV2(
  evaluations: DiagnosisQualityEvaluationV2[],
): DiagnosisStabilityEvaluationV2 {
  const sampleId = evaluations[0]?.sampleId || 'unknown-sample';
  const sameSample = evaluations.every((item) => item.sampleId === sampleId);
  const enoughRuns = evaluations.length >= 3;
  const criticalRunCount = evaluations.filter((item) => item.qualityLevel === 'critical_violation').length;
  const mainAbilityWithinBoundary = evaluations.every((item) => item.dimensions.mainAbilityAccepted);
  const answerStatusWithinBoundary = evaluations.every((item) => item.dimensions.answerStatusAccepted);
  const qualityLevels = evaluations.map((item) => item.qualityLevel);
  let boundaryStability: DiagnosisStabilityEvaluationV2['boundaryStability'];
  let qualityStability: DiagnosisStabilityEvaluationV2['qualityStability'];

  if (!sameSample || !enoughRuns) {
    boundaryStability = 'insufficient_runs';
    qualityStability = 'insufficient_runs';
  } else if (criticalRunCount > 0) {
    boundaryStability = 'critical_violation';
    qualityStability = 'critical_violation';
  } else {
    boundaryStability = mainAbilityWithinBoundary && answerStatusWithinBoundary
      ? 'stable_within_boundary'
      : 'boundary_unstable';
    const uniqueLevels = new Set(qualityLevels);
    qualityStability = uniqueLevels.size > 1
      ? 'quality_unstable'
      : qualityLevels[0] === 'accepted'
        ? 'stable_accepted'
        : qualityLevels[0] === 'questionable'
          ? 'stable_questionable'
          : 'quality_unstable';
  }

  return {
    sampleId,
    runCount: evaluations.length,
    boundaryStability,
    qualityStability,
    qualityLevels,
    mainAbilityWithinBoundary,
    answerStatusWithinBoundary,
    criticalRunCount,
    reasons: sameSample ? [] : ['Evaluations belong to different samples.'],
  };
}

export function classifyRootCause(value: string): RootCauseBoundaryCategory[] {
  const categories: RootCauseBoundaryCategory[] = [];
  addCategory(categories, 'no_clear_deficit_in_current_response', value, [
    /未暴露明确能力缺口/,
    /未发现明确.*错误/,
    /没有明显.*问题/,
    /符合题目要求/,
    /推理链完整/,
  ]);
  addCategory(categories, 'missing_evidence', value, [
    /依据不足/,
    /缺少.*(?:依据|动作|线索)/,
    /缺乏.*(?:依据|文本|线索|推理过程)/,
    /未(?:提取|引用|结合).*(?:线索|动作|文本|依据)/,
    /推理链不完整/,
  ]);
  addCategory(categories, 'unsupported_inference', value, [
    /主观推断/,
    /主观臆断/,
    /原文未提及/,
    /材料.*不支持/,
    /无关信息/,
  ]);
  addCategory(categories, 'incorrect_causal_relation', value, [
    /关系.*错误/,
    /错误归因/,
    /因果.*不成立/,
    /理由.*不成立/,
    /心理.*错误/,
    /目的.*误判/,
  ]);
  addCategory(categories, 'incomplete_summary', value, [
    /概括不完整/,
    /遗漏.*(?:事件|情节|信息|要点)/,
    /未完整概括/,
    /信息提取不完整/,
    /概括.*偏离/,
  ]);
  addCategory(categories, 'misread_key_detail', value, [
    /误读/,
    /漏读/,
    /混淆/,
    /理解不够精准/,
    /偏离原文/,
  ]);
  addCategory(categories, 'expression_incomplete', value, [
    /表达.*不完整/,
    /理由.*(?:笼统|缺乏|不够)/,
    /缺乏.*(?:逻辑|论证|阐述)/,
    /展开.*不足/,
    /观点.*(?:不清|不够直接)/,
    /组织.*(?:不足|缺乏)/,
  ]);
  return categories.length > 0 ? categories : ['unknown'];
}

function buildAttributionEnvelope(input: DiagnosisQualityPolicyV2Input): DiagnosisAttributionEnvelope {
  const fields: Array<[string, string]> = [
    ['rootCause', input.candidate.rootCause],
    ['surfaceError', input.candidate.surfaceError],
    ['diagnosisSummary', input.candidate.diagnosisSummary],
    ...input.candidate.abilityEvidence.map((value, index) => [`abilityEvidence[${index}]`, value] as [string, string]),
  ];
  const attributions: TextAttribution[] = [];
  for (const [fieldPath, value] of fields) {
    for (const match of value.matchAll(/[“"]([^”"]{2,60})[”"]/g)) {
      const text = match[1].trim();
      const source = resolveAttributionSource(text, input);
      const prefix = value.slice(Math.max(0, (match.index || 0) - 48), match.index || 0);
      const presentedAsStudentQuote = isPresentedAsStudentQuote(prefix);
      const valid = !presentedAsStudentQuote || source === 'student_exact_quote';
      attributions.push({
        fieldPath,
        text,
        source,
        presentedAsStudentQuote,
        valid,
        reason: valid
          ? `Quote is attributable to ${source}.`
          : `Quote is presented as the student's wording but resolves to ${source}.`,
      });
    }
  }
  const issues = attributions
    .filter((item) => !item.valid)
    .map((item) => `${item.fieldPath}: ${item.reason}`);
  return {
    sampleId: input.sampleId,
    runId: input.runId,
    attributions,
    validation: { passed: issues.length === 0, issues },
  };
}

function resolveAttributionSource(
  text: string,
  input: DiagnosisQualityPolicyV2Input,
): TextAttributionSource {
  if (contains(input.studentAnswer, text)) return 'student_exact_quote';
  if (contains(`${input.readingText || ''}\n${input.question}`, text)) return 'task_material_quote';
  if (input.rubricTerms.some((term) => contains(term, text) || contains(text, term))) return 'rubric_term';
  if (input.referenceAnswer && contains(input.referenceAnswer, text)) return 'reference_answer_term';
  return 'system_paraphrase';
}

function isPresentedAsStudentQuote(prefix: string): boolean {
  const immediate = prefix.slice(-32);
  if (/(?:rubric|评分|标准|要求|维度)\s*(?:中|为|是)?\s*$/i.test(immediate)) return false;
  if (/(?:未(?:直接|明确|具体|逐字)?(?:提及|引用|包含|写出)|没有(?:直接|明确|具体|逐字)?(?:提及|引用|包含|写出)|遗漏了?|缺少|例如|比如|如)\s*$/.test(immediate)) return false;
  return /(?:写出了?|提到了?|引用了?|表示|包含了?|添加了?|保留了?|判断为|判断是|推断出|回答为|答案是)\s*$/.test(immediate);
}

function buildReviewFindings(input: {
  input: DiagnosisQualityPolicyV2Input;
  mainAbilityAccepted: boolean;
  answerStatusAccepted: boolean;
  rootCauseCategoryAccepted: boolean;
  detectedRootCauseCategories: RootCauseBoundaryCategory[];
  missingFactIds: string[];
  quoteAttributionValid: boolean;
}): DiagnosisReviewFinding[] {
  const findings: DiagnosisReviewFinding[] = [];
  if (!input.mainAbilityAccepted) {
    findings.push(modelFinding('main_ability', 'mainAbility is outside the accepted annotation boundary.'));
  }
  if (!input.answerStatusAccepted) {
    findings.push(modelFinding('answer_status', 'answerStatus is outside the accepted annotation boundary.'));
  }
  if (!input.rootCauseCategoryAccepted) {
    findings.push(input.detectedRootCauseCategories.includes('unknown')
      ? {
        dimension: 'root_cause',
        attribution: 'insufficient_evidence',
        recommendedAction: 'further_review',
        reason: 'Policy v2 cannot safely map the root cause to a structured category.',
      }
      : modelFinding('root_cause', 'Detected root-cause categories are outside the accepted annotation boundary.'));
  } else if (input.input.previousPolicyResult?.failedDimensions.includes('rootCauseAcceptable')) {
    findings.push(policyFinding('root_cause', 'Policy v1 lexical matching failed but Policy v2 structured category is accepted.'));
  }
  if (input.missingFactIds.length > 0) {
    findings.push(modelFinding('required_fact', `Missing required fact concepts: ${input.missingFactIds.join(', ')}.`));
  } else if (input.input.previousPolicyResult?.failedDimensions.includes('requiredFactsPresent')) {
    findings.push(policyFinding('required_fact', 'Policy v1 substring matching failed but Policy v2 accepted-expression matching succeeded.'));
  }
  if (!input.quoteAttributionValid) {
    findings.push(modelFinding('quote_attribution', 'A quote is presented as student wording without student-response provenance.'));
  } else if (input.input.previousPolicyResult?.failedDimensions.some((dimension) =>
    ['studentQuoteFaithful', 'textEvidenceFaithful', 'noCriticalHallucination'].includes(dimension)
  )) {
    findings.push(policyFinding('quote_attribution', 'Policy v1 global quote scan failed but Policy v2 source-aware attribution succeeded.'));
  }
  return findings;
}

function modelFinding(
  dimension: DiagnosisReviewFinding['dimension'],
  reason: string,
): DiagnosisReviewFinding {
  return {
    dimension,
    attribution: 'confirmed_model_issue',
    recommendedAction: 'prompt_change',
    reason,
  };
}

function policyFinding(
  dimension: DiagnosisReviewFinding['dimension'],
  reason: string,
): DiagnosisReviewFinding {
  return {
    dimension,
    attribution: 'evaluator_false_positive',
    recommendedAction: 'policy_change',
    reason,
  };
}

function validateInput(input: DiagnosisQualityPolicyV2Input): string[] {
  const issues: string[] = [];
  if (input.sampleId !== input.annotation.sampleId) issues.push('Annotation sampleId does not match input sampleId.');
  if (!input.runId) issues.push('runId is required.');
  if (!input.annotationVersion) issues.push('annotationVersion is required.');
  if (!input.datasetVersion) issues.push('datasetVersion is required.');
  if (input.annotation.allowedMainAbilities.length === 0) issues.push('allowedMainAbilities is empty.');
  if (input.annotation.allowedAnswerStatuses.length === 0) issues.push('allowedAnswerStatuses is empty.');
  if (input.annotation.allowedRootCauseCategories.length === 0) issues.push('allowedRootCauseCategories is empty.');
  return issues;
}

function candidateText(candidate: DiagnosisQualityPolicyV2Input['candidate']): string {
  return [
    candidate.rootCause,
    candidate.surfaceError,
    candidate.diagnosisSummary,
    ...candidate.abilityEvidence,
  ].join('\n');
}

function addCategory(
  categories: RootCauseBoundaryCategory[],
  category: RootCauseBoundaryCategory,
  value: string,
  patterns: RegExp[],
): void {
  if (patterns.some((pattern) => pattern.test(value))) categories.push(category);
}

function contains(container: string, value: string): boolean {
  const normalizedValue = normalize(value);
  return normalizedValue.length > 0 && normalize(container).includes(normalizedValue);
}

function normalize(value: string): string {
  return value.replace(/[\s，。！？；：“”‘’、,.!?;:'"-]/g, '').toLowerCase();
}
