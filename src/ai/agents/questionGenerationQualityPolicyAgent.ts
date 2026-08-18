import { inspectInitialCandidateCompleteness } from '../schemas/questionCandidate.schema.ts';
import {
  QUESTION_GENERATION_QUALITY_POLICY_VERSION,
  type QuestionGenerationQualityEvaluation,
  type QuestionGenerationQualityFinding,
  type QuestionObservationSignature,
  type QuestionObservationValueComparison,
  type QuestionPortfolioGradient,
  type QuestionResponseLoadAnalysis,
} from '../schemas/questionGenerationQuality.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import {
  evaluateGeneratedSingleChoiceOptions,
  evaluateSingleChoiceTrainingFit,
} from './singleChoiceGenerationPolicy.ts';

const ACTION_PATTERNS: Array<[string, RegExp]> = [
  ['extract', /找出|写出|指出|摘录|识别/u],
  ['summarize', /概括|归纳|梳理/u],
  ['explain', /说明|解释|含义|原因/u],
  ['analyze', /分析|赏析|作用|表达效果/u],
  ['infer', /推断|推测|理解|主旨|情感/u],
  ['compare', /比较|对比|异同|不同/u],
  ['evaluate', /评价|判断|看法|启示/u],
];

const OBJECT_STOP_WORDS = new Set([
  '文章', '全文', '文中', '作者', '请', '结合', '根据', '找出', '写出', '指出', '说明',
  '解释', '分析', '推断', '比较', '概括', '归纳', '梳理', '作用', '表达', '为什么',
  '如何', '什么', '怎样', '内容', '进行', '并', '从', '中', '的', '了', '是',
]);

export class QuestionCandidateGenerationQualityError extends Error {
  readonly code = 'CANDIDATE_GENERATION_QUALITY_BLOCKED';
  readonly evaluation: QuestionGenerationQualityEvaluation;

  constructor(evaluation: QuestionGenerationQualityEvaluation) {
    super(evaluation.findings
      .filter((finding) => finding.severity === 'blocker')
      .map((finding) => finding.message)
      .join('；') || '生成候选未通过质量门槛。');
    this.name = 'QuestionCandidateGenerationQualityError';
    this.evaluation = evaluation;
  }
}

export function analyzeQuestionResponseLoad(
  content: QuestionEditableFields,
): QuestionResponseLoadAnalysis {
  const text = `${content.questionStem} ${content.title}`;
  const actionKinds = detectActionKinds(text);
  const requiredRubric = content.rubric.filter((item) => item.required);
  const independentCoreRubricCount = new Set(requiredRubric.map((item) => (
    normalizeText(`${item.name} ${item.description || ''}`)
  )).filter(Boolean)).size;
  const asksComparison = /比较|对比|异同|不同/u.test(text);
  const asksWholeText = /全文|整篇|结合文章|结合上下文|联系全文/u.test(text);
  const asksEvidence = content.minimumAnswerRequirement.requireTextEvidence
    || requiredRubric.some((item) => item.evidenceRequirement?.requireTextEvidence)
    || /依据|证据|原文|结合.{0,8}(语句|内容)/u.test(text);
  const asksExplanation = content.minimumAnswerRequirement.requireExplanation
    || requiredRubric.some((item) => item.evidenceRequirement?.requireExplanation)
    || /说明|解释|分析|原因|作用|效果/u.test(text);
  const asksOpenInterpretation = /评价|看法|启示|理解|主旨|情感|深层/u.test(text);
  const multiPerspective = /从.{0,24}(方面|角度)/u.test(text)
    || /心理.{0,20}处境|内容.{0,20}结构|方式.{0,20}效果/u.test(text);
  const heavySignals = [
    asksComparison,
    asksWholeText && asksExplanation,
    actionKinds.length >= 3,
    multiPerspective,
    independentCoreRubricCount >= 3 && (asksEvidence || asksExplanation),
    content.minimumAnswerRequirement.minLength >= 80,
  ].filter(Boolean).length;
  const moderateSignals = [
    actionKinds.length >= 2,
    asksEvidence && asksExplanation,
    independentCoreRubricCount >= 2,
    content.minimumAnswerRequirement.minLength >= 40,
  ].filter(Boolean).length;
  const estimatedLoad = heavySignals >= 2
    ? 'heavy'
    : moderateSignals >= 2 ? 'moderate' : 'light';
  return {
    actionCount: actionKinds.length,
    evidenceScopeCount: extractEvidenceScopes(content).length,
    requiredRubricCount: requiredRubric.length,
    independentCoreRubricCount,
    asksComparison,
    asksWholeText,
    asksEvidence,
    asksExplanation,
    asksOpenInterpretation,
    estimatedLoad,
    recommendedFormat: estimatedLoad === 'heavy' ? 'long_text' : 'short_text',
  };
}

export function buildQuestionObservationSignature(
  content: QuestionEditableFields,
): QuestionObservationSignature {
  const rubricText = content.rubric.map((item) => (
    `${item.name} ${item.description || ''} ${item.acceptedSignals.join(' ')}`
  )).join(' ');
  return {
    answerObjectTokens: meaningfulTokens(`${content.title} ${content.questionStem}`),
    actionKinds: detectActionKinds(content.questionStem),
    evidenceScopes: extractEvidenceScopes(content),
    rubricTargetTokens: meaningfulTokens(rubricText),
    abilityId: content.abilityMetadata.abilityId,
    taskRole: content.abilityMetadata.taskRole,
  };
}

export function compareQuestionObservationValue(
  left: QuestionEditableFields,
  right: QuestionEditableFields,
): QuestionObservationValueComparison {
  const leftSignature = buildQuestionObservationSignature(left);
  const rightSignature = buildQuestionObservationSignature(right);
  const answerObjectSimilarity = similarity(leftSignature.answerObjectTokens, rightSignature.answerObjectTokens);
  const actionSimilarity = similarity(leftSignature.actionKinds, rightSignature.actionKinds);
  const evidenceScopeSimilarity = compareEvidenceScopes(
    leftSignature.evidenceScopes,
    rightSignature.evidenceScopes,
  );
  const rubricTargetSimilarity = similarity(
    leftSignature.rubricTargetTokens,
    rightSignature.rubricTargetTokens,
  );
  return {
    answerObjectSimilarity,
    actionSimilarity,
    evidenceScopeSimilarity,
    rubricTargetSimilarity,
    // taskRole is deliberately excluded: training/retest/transfer never grants an exemption.
    substantiveDuplicate: answerObjectSimilarity >= 0.62
      && actionSimilarity >= 0.66
      && evidenceScopeSimilarity >= 0.7
      && rubricTargetSimilarity >= 0.58,
  };
}

export function analyzeQuestionPortfolioGradient(
  contents: QuestionEditableFields[],
): QuestionPortfolioGradient {
  const abilityBreakdown = countBy(contents.map((item) => item.abilityMetadata.abilityId));
  const difficultyBreakdown = countBy(contents.map((item) => item.abilityMetadata.difficulty));
  const findings: QuestionGenerationQualityFinding[] = [];
  const total = contents.length;
  const dominantAbility = maxEntry(abilityBreakdown);
  const dominantDifficulty = maxEntry(difficultyBreakdown);
  if (total >= 3 && dominantAbility && dominantAbility[1] / total > 0.5) {
    findings.push({
      code: 'ability_concentration',
      severity: 'advisory',
      message: `当前题组能力分布偏向“${dominantAbility[0]}”，建议结合素材观察价值校准。`,
      details: { abilityBreakdown },
    });
  }
  if (total >= 3 && dominantDifficulty && dominantDifficulty[1] / total > 0.67) {
    findings.push({
      code: 'difficulty_concentration',
      severity: 'advisory',
      message: `当前题组难度分布偏向“${dominantDifficulty[0]}”，建议检查梯度但不要机械配额。`,
      details: { difficultyBreakdown },
    });
  }
  if (total >= 3 && !difficultyBreakdown.basic) {
    findings.push({
      code: 'foundational_gap',
      severity: 'advisory',
      message: '当前题组没有基础难度题；请结合素材和学习目标判断是否需要补充。',
      details: { difficultyBreakdown },
    });
  }
  return { questionCount: total, abilityBreakdown, difficultyBreakdown, findings };
}

export function evaluateQuestionGenerationQuality(input: {
  candidate: QuestionEditableFields;
  peerQuestions?: QuestionEditableFields[];
  portfolioQuestions?: QuestionEditableFields[];
  baseContentHash?: string;
  includePortfolioGuidance?: boolean;
}): QuestionGenerationQualityEvaluation {
  const responseLoad = analyzeQuestionResponseLoad(input.candidate);
  const observationSignature = buildQuestionObservationSignature(input.candidate);
  const findings: QuestionGenerationQualityFinding[] = [];
  const completeness = inspectInitialCandidateCompleteness(input.candidate);
  if (!completeness.complete) {
    findings.push({
      code: 'candidate_incomplete',
      severity: 'blocker',
      message: `候选内容不完整：${completeness.missingFields.join('、')}。`,
      details: { missingFields: completeness.missingFields },
    });
  }
  if (input.candidate.responseFormat === 'single_choice') {
    const optionQuality = evaluateGeneratedSingleChoiceOptions(
      input.candidate.choiceInteraction,
    );
    if (!optionQuality.passed) {
      findings.push({
        code: 'choice_option_quality_invalid',
        severity: 'blocker',
        message: '单选候选的选项、答案键或干扰项依据未达到生成质量要求。',
        details: { issueCodes: optionQuality.issues.map((issue) => issue.code) },
      });
    }
    const trainingFit = evaluateSingleChoiceTrainingFit({
      primaryAbilityId: input.candidate.abilityMetadata.abilityId,
      observationDimension: readObservationDimension(input.candidate.tags),
      questionStem: input.candidate.questionStem,
      expectedStudentAction: input.candidate.rubric
        .map((item) => `${item.name} ${item.description || ''}`)
        .join(' '),
      requiredRubricCount: input.candidate.rubric.filter((item) => item.required).length,
    });
    if (!trainingFit.passed) {
      findings.push({
        code: 'choice_training_action_mismatch',
        severity: 'blocker',
        message: '当前训练动作需要学生组织文本答案，不适合生成单项选择。',
        details: { issueCodes: trainingFit.issues.map((issue) => issue.code) },
      });
    }
  }
  if (input.baseContentHash
    && calculateQuestionEditableFieldsHash(input.candidate) === input.baseContentHash) {
    findings.push({
      code: 'candidate_unchanged',
      severity: 'blocker',
      message: '候选与当前正式内容完全相同，没有形成可采用的新方案。',
    });
  }
  if (input.candidate.responseFormat === 'short_text' && responseLoad.estimatedLoad === 'heavy') {
    findings.push({
      code: 'response_format_underloaded',
      severity: 'blocker',
      message: '题目要求包含多步或多角度作答，但当前答案格式仍为短文本。',
      details: { responseLoad },
    });
  }
  if (input.candidate.responseFormat === 'long_text' && responseLoad.estimatedLoad === 'light') {
    findings.push({
      code: 'response_format_overprovisioned',
      severity: 'advisory',
      message: '当前作答负荷较轻，长文本可能增加不必要的学生负担。',
      details: { responseLoad },
    });
  }
  if (responseLoad.independentCoreRubricCount >= 3) {
    findings.push({
      code: 'rubric_density_long_text_hint',
      severity: 'strong_hint',
      message: '评分标准包含三个或更多独立核心观察点，优先检查是否需要长文本；这不是绝对规则。',
      details: { responseLoad },
    });
  }
  for (const [index, peer] of (input.peerQuestions || []).entries()) {
    const comparison = compareQuestionObservationValue(input.candidate, peer);
    if (!comparison.substantiveDuplicate) continue;
    findings.push({
      code: 'substantive_duplicate',
      severity: 'blocker',
      message: '候选题与同篇已有题在回答对象、材料依据、作答动作和评分目标上实质重复。',
      relatedQuestionIndex: index,
      details: {
        comparison,
        candidateTaskRole: input.candidate.abilityMetadata.taskRole,
        peerTaskRole: peer.abilityMetadata.taskRole,
      },
    });
  }
  if (input.includePortfolioGuidance !== false) {
    findings.push(...analyzeQuestionPortfolioGradient(
      input.portfolioQuestions || [...(input.peerQuestions || []), input.candidate],
    ).findings);
  }
  const blockerCodes = [...new Set(findings
    .filter((finding) => finding.severity === 'blocker')
    .map((finding) => finding.code))];
  return {
    policyVersion: QUESTION_GENERATION_QUALITY_POLICY_VERSION,
    status: blockerCodes.length > 0
      ? 'blocked'
      : findings.length > 0 ? 'ready_with_guidance' : 'ready',
    responseLoad,
    observationSignature,
    findings,
    blockerCodes,
  };
}

function detectActionKinds(text: string): string[] {
  return ACTION_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind);
}

function extractEvidenceScopes(content: QuestionEditableFields): string[] {
  const scopes = content.tags.filter((tag) => (
    tag.startsWith('source_anchor:')
    || tag.startsWith('paragraph:')
    || tag.startsWith('paragraph_range:')
    || tag.startsWith('observation_focus:')
  ));
  const paragraphMatches = [...content.questionStem.matchAll(/第\s*(\d+)(?:\s*[—至到-]\s*(\d+))?\s*段/gu)]
    .map((match) => `paragraph:${match[1]}-${match[2] || match[1]}`);
  if (scopes.length || paragraphMatches.length) return [...new Set([...scopes, ...paragraphMatches])];
  return /全文|整篇|结合文章|结合上下文|联系全文/u.test(content.questionStem)
    ? ['full_text']
    : [];
}

function readObservationDimension(tags: string[]): string {
  return tags.find((tag) => tag.startsWith('observation_dimension:'))
    ?.slice('observation_dimension:'.length) || '';
}

function meaningfulTokens(text: string): string[] {
  const words = normalizeText(text).match(/[\p{Script=Han}]{2,}|[a-z0-9]+/gu) || [];
  const tokens = words.filter((word) => !OBJECT_STOP_WORDS.has(word));
  const bigrams = tokens.flatMap((word) => word.length > 2
    ? [...word].slice(0, -1).map((character, index) => `${character}${[...word][index + 1]}`)
    : [word]);
  return [...new Set(bigrams)];
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();
}

function similarity(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  return intersection / new Set([...leftSet, ...rightSet]).size;
}

function compareEvidenceScopes(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  return similarity(left, right);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function maxEntry(record: Record<string, number>): [string, number] | null {
  return Object.entries(record).sort((left, right) => right[1] - left[1])[0] || null;
}
