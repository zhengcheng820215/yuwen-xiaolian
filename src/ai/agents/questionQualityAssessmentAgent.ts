import type {
  QuestionQualityAssessmentRepository,
} from '../repositories/questionQualityAssessmentRepository.ts';
import type {
  QuestionMaterialVersion,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  QUESTION_QUALITY_ASSESSMENT_VERSION,
  QUESTION_QUALITY_RULE_VERSION,
  cloneQuestionQualityValue,
  type QuestionQualityAssessment,
  type QuestionQualityWarning,
} from '../schemas/questionQualityAssessment.schema.ts';

export type AssessQuestionDraftQualityInput = {
  draft: StructuredQuestionDraft;
  validation: ResourceValidationResult;
  material: QuestionMaterialVersion | null;
  peerDrafts?: StructuredQuestionDraft[];
  assessedAt?: string;
  ruleVersion?: string;
};

export function assessQuestionDraftQuality(
  input: AssessQuestionDraftQualityInput,
): QuestionQualityAssessment {
  assertCurrentPassedValidation(input.draft, input.validation);

  const warnings: QuestionQualityWarning[] = [];
  const materialGrounding = checkMaterialGrounding(
    input.draft,
    input.material,
    warnings,
  );
  const observationClarity = checkObservationClarity(input.draft, warnings);
  const observationDistinctness = checkObservationDistinctness(
    input.draft,
    input.peerDrafts || [],
    warnings,
  );
  const discriminativePower = checkDiscriminativePower(input.draft, warnings);
  const difficultyCoherence = checkDifficultyCoherence(input.draft, warnings);
  const rubricAlignment = checkRubricAlignment(input.draft, warnings);
  const scopeClarity = checkScopeClarity(input.draft, warnings);
  const strongWarning = warnings.some(
    (warning) => warning.severity === 'strong_warning',
  );
  const decision = materialGrounding === 'fail' || strongWarning
    ? 'revision_recommended'
    : warnings.length > 0
      ? 'pass_with_warnings'
      : 'pass';
  const ruleVersion = input.ruleVersion || QUESTION_QUALITY_RULE_VERSION;

  return {
    assessmentId: `${input.draft.draftId}:quality:r${input.draft.revision}:${ruleVersion}`,
    draftId: input.draft.draftId,
    resourceId: input.draft.resourceId,
    assessedDraftRevision: input.draft.revision,
    validationId: input.validation.validationId,
    checks: {
      materialGrounding,
      observationClarity,
      observationDistinctness,
      discriminativePower,
      difficultyCoherence,
      rubricAlignment,
      scopeClarity,
    },
    decision,
    warnings,
    assessedAt: input.assessedAt || new Date().toISOString(),
    ruleVersion,
    version: QUESTION_QUALITY_ASSESSMENT_VERSION,
  };
}

export async function assessAndSaveQuestionDraftQuality(
  repository: QuestionQualityAssessmentRepository,
  input: AssessQuestionDraftQualityInput,
): Promise<QuestionQualityAssessment> {
  const assessment = assessQuestionDraftQuality(input);
  return repository.saveAssessment(assessment);
}

export function isCurrentQuestionQualityAssessment(
  draft: StructuredQuestionDraft,
  validation: ResourceValidationResult,
  assessment: QuestionQualityAssessment | null | undefined,
): assessment is QuestionQualityAssessment {
  return Boolean(
    assessment &&
    assessment.draftId === draft.draftId &&
    assessment.resourceId === draft.resourceId &&
    assessment.assessedDraftRevision === draft.revision &&
    assessment.validationId === validation.validationId &&
    assessment.ruleVersion === QUESTION_QUALITY_RULE_VERSION &&
    validation.draftId === draft.draftId &&
    validation.validatedDraftRevision === draft.revision &&
    validation.passed,
  );
}

export function requireCurrentQuestionQualityAssessment(
  draft: StructuredQuestionDraft,
  validation: ResourceValidationResult,
  assessment: QuestionQualityAssessment | null | undefined,
): QuestionQualityAssessment {
  if (!isCurrentQuestionQualityAssessment(draft, validation, assessment)) {
    throw new Error('Question quality assessment is missing or stale.');
  }
  return cloneQuestionQualityValue(assessment);
}

function checkMaterialGrounding(
  draft: StructuredQuestionDraft,
  material: QuestionMaterialVersion | null,
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' | 'fail' {
  if (!draft.materialVersionId) return 'pass';
  if (!material || material.materialVersionId !== draft.materialVersionId) {
    addWarning(
      warnings,
      'quality.material.missing',
      'materialGrounding',
      'strong_warning',
      '题目引用的材料版本不可用于当前质量评估。',
      ['materialVersionId'],
    );
    return 'fail';
  }

  const stem = normalizeText(draft.questionStem);
  const content = normalizeText(material.content);
  const quotedAnchors = extractQuotedPhrases(draft.questionStem)
    .filter((phrase) => phrase.length >= 3);
  const hasQuotedAnchor = quotedAnchors.some(
    (anchor) => content.includes(normalizeText(anchor)),
  );
  const paragraphCount = countMaterialParagraphs(material.content);
  const paragraphReferences = extractParagraphReferences(draft.questionStem);
  const hasInvalidParagraphReference = paragraphReferences.some(
    ({ start, end }) => start < 1 || end < start || end > paragraphCount,
  );
  if (hasInvalidParagraphReference) {
    addWarning(
      warnings,
      'quality.material.paragraph_out_of_range',
      'materialGrounding',
      'strong_warning',
      `题干引用的段落超出当前材料范围（材料共 ${paragraphCount} 段）。`,
      ['questionStem', 'materialVersionId'],
    );
    return 'fail';
  }
  const hasValidParagraphReference = paragraphReferences.length > 0;
  const refersToMaterial = /(结合(材料|全文|上下文)|根据(材料|全文|文中)|文中|文章|原文|这一(动作|细节|语句|段落))/.test(stem);
  const hasWholeTextBoundary = /(结合|根据|依据)(全文|全篇|整篇|通篇|文章整体)|通读全文/.test(stem);
  const hasOpenEvidenceBoundary = /(任选|选取|找出|列举|举出).{0,12}(一|二|两|三|\d+)?\s*(处|个|项|例).{0,12}(细节|语句|情节|证据|描写|内容)/.test(stem);
  const longestAnchorLength = longestCommonChineseRun(stem, content);

  if (
    hasValidParagraphReference ||
    hasQuotedAnchor ||
    longestAnchorLength >= 4 ||
    hasWholeTextBoundary ||
    hasOpenEvidenceBoundary
  ) return 'pass';
  if (refersToMaterial) {
    addWarning(
      warnings,
      'quality.material.anchor_weak',
      'materialGrounding',
      'warning',
      '题目提到了材料，但证据范围仍较笼统，学生可能不清楚应从局部内容还是全文组织依据。',
      ['questionStem', 'materialVersionId'],
    );
    return 'warning';
  }

  addWarning(
    warnings,
    'quality.material.semantic_mismatch',
    'materialGrounding',
    'strong_warning',
    '题目虽然引用了材料版本，但题干没有呈现明确的材料依据。',
    ['questionStem', 'materialVersionId'],
  );
  return 'fail';
}

function countMaterialParagraphs(content: string): number {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .length;
}

function extractParagraphReferences(
  text: string,
): Array<{ start: number; end: number }> {
  return [...text.matchAll(/第\s*(\d+)\s*(?:[-—–至到]\s*第?\s*(\d+)\s*)?段/g)]
    .map((match) => ({
      start: Number(match[1]),
      end: Number(match[2] || match[1]),
    }));
}

function checkObservationClarity(
  draft: StructuredQuestionDraft,
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' {
  const stem = normalizeText(draft.questionStem);
  const broadOnly = /^(分析|概括|理解|赏析|评价)(人物|文章|内容|主题|形象|作用)?[。？?]*$/.test(stem);
  const hasObservableAction = /(找出|写出|概括|说明|解释|分析|推断|比较|结合|根据|指出|补充|仿写|表达)/.test(stem);

  if (!hasObservableAction || broadOnly) {
    addWarning(
      warnings,
      'quality.observation.unclear',
      'observationClarity',
      'strong_warning',
      '题目没有清楚说明学生需要完成的可观察动作。',
      ['questionStem', 'abilityMetadata.abilityId'],
    );
    return 'warning';
  }
  return 'pass';
}

function checkObservationDistinctness(
  draft: StructuredQuestionDraft,
  peerDrafts: StructuredQuestionDraft[],
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' {
  const duplicate = peerDrafts.find((peer) => (
    peer.draftId !== draft.draftId &&
    peer.materialVersionId === draft.materialVersionId &&
    peer.abilityMetadata.abilityId === draft.abilityMetadata.abilityId &&
    (
      normalizedSimilarity(peer.questionStem, draft.questionStem) >= 0.72 ||
      criticalRubricFingerprint(peer) === criticalRubricFingerprint(draft)
    )
  ));

  if (!duplicate) return 'pass';
  addWarning(
    warnings,
    'quality.observation.duplicate',
    'observationDistinctness',
    'warning',
    '当前材料中已有题目观察相近的能力动作，请人工比较是否重复。',
    ['questionStem', `peerDraft:${duplicate.draftId}`],
  );
  return 'warning';
}

function checkDiscriminativePower(
  draft: StructuredQuestionDraft,
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' {
  const criticalItems = draft.rubric.filter(
    (item) => item.required && item.importance === 'critical',
  );
  const signals = criticalItems.flatMap((item) => item.acceptedSignals || []);
  const hasPerformanceLayers = draft.rubric.length >= 2;

  if (
    criticalItems.length === 0 ||
    signals.filter((signal) => signal.trim().length > 0).length === 0 ||
    !hasPerformanceLayers
  ) {
    addWarning(
      warnings,
      'quality.discrimination.weak',
      'discriminativePower',
      'warning',
      '当前评分标准还不能清楚区分完整回答、部分回答和未达到要求的回答。',
      ['rubric', 'minimumAnswerRequirement'],
    );
    return 'warning';
  }
  return 'pass';
}

function checkDifficultyCoherence(
  draft: StructuredQuestionDraft,
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' {
  const difficulty = draft.abilityMetadata.difficulty;
  const requirement = draft.minimumAnswerRequirement;
  const requiredRubricCount = draft.rubric.filter((item) => item.required).length;

  const advancedTooLight = difficulty === 'advanced' &&
    !requirement.requireExplanation &&
    !requirement.requireTextEvidence &&
    requiredRubricCount <= 1;
  const basicTooHeavy = difficulty === 'basic' && (
    requirement.minLength >= 120 ||
    requiredRubricCount >= 4 ||
    (requirement.requireExplanation && requirement.requireTextEvidence)
  );

  if (advancedTooLight || basicTooHeavy) {
    addWarning(
      warnings,
      'quality.difficulty.incoherent',
      'difficultyCoherence',
      'warning',
      '难度声明与当前作答要求或 Rubric 复杂度可能不一致。',
      ['abilityMetadata.difficulty', 'minimumAnswerRequirement', 'rubric'],
    );
    return 'warning';
  }
  return 'pass';
}

function checkRubricAlignment(
  draft: StructuredQuestionDraft,
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' {
  const stem = normalizeText(draft.questionStem);
  const asksEvidence = /(结合|根据|依据|从文中|具体(动作|语句|细节))/.test(stem);
  const asksExplanation = /(分析|说明理由|为什么|解释|作用|含义|推断)/.test(stem);
  const rubricRequiresEvidence = draft.rubric.some(
    (item) => item.required && item.evidenceRequirement?.requireTextEvidence,
  );
  const rubricRequiresExplanation = draft.rubric.some(
    (item) => item.required && item.evidenceRequirement?.requireExplanation,
  );

  if (
    (asksEvidence && !rubricRequiresEvidence) ||
    (asksExplanation && !rubricRequiresExplanation)
  ) {
    addWarning(
      warnings,
      'quality.rubric.semantic_mismatch',
      'rubricAlignment',
      'strong_warning',
      '题干要求的依据或解释没有被 Required Rubric 完整覆盖。',
      ['questionStem', 'rubric'],
    );
    return 'warning';
  }
  return 'pass';
}

function checkScopeClarity(
  draft: StructuredQuestionDraft,
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' {
  const stem = draft.questionStem.trim();
  const questionCount = (stem.match(/[？?]/g) || []).length;
  const actionCount = (stem.match(/(找出|写出|概括|说明|解释|分析|推断|比较|评价|赏析)/g) || []).length;
  const broadPrompt = /(谈谈你的理解|谈谈你的看法|结合实际|自由发挥|深入分析)/.test(stem);

  if (stem.length > 180 || questionCount >= 3 || actionCount >= 4 || broadPrompt) {
    addWarning(
      warnings,
      'quality.scope.too_broad',
      'scopeClarity',
      'warning',
      '题目范围可能过宽或包含过多子任务，难以形成单一清晰观察。',
      ['questionStem'],
    );
    return 'warning';
  }
  return 'pass';
}

function assertCurrentPassedValidation(
  draft: StructuredQuestionDraft,
  validation: ResourceValidationResult,
): void {
  if (!validation.passed) {
    throw new Error('Question quality assessment requires passed contract validation.');
  }
  if (
    validation.draftId !== draft.draftId ||
    validation.resourceId !== draft.resourceId ||
    validation.validatedDraftRevision !== draft.revision ||
    draft.latestValidationId !== validation.validationId
  ) {
    throw new Error('Question quality assessment requires current draft validation.');
  }
}

function addWarning(
  warnings: QuestionQualityWarning[],
  code: string,
  check: QuestionQualityWarning['check'],
  severity: QuestionQualityWarning['severity'],
  message: string,
  evidenceRefs: string[],
): void {
  warnings.push({ code, check, severity, message, evidenceRefs });
}

function extractQuotedPhrases(value: string): string[] {
  const phrases: string[] = [];
  for (const match of value.matchAll(/[“"《]([^”"》]+)[”"》]/g)) {
    if (match[1]) phrases.push(match[1].trim());
  }
  return phrases;
}

function longestCommonChineseRun(left: string, right: string): number {
  const leftText = [...left].filter((char) => /[\u4e00-\u9fff]/.test(char)).join('');
  const rightText = [...right].filter((char) => /[\u4e00-\u9fff]/.test(char)).join('');
  if (!leftText || !rightText) return 0;

  let longest = 0;
  let previous = new Array(rightText.length + 1).fill(0) as number[];
  for (let leftIndex = 1; leftIndex <= leftText.length; leftIndex += 1) {
    const current = new Array(rightText.length + 1).fill(0) as number[];
    for (let rightIndex = 1; rightIndex <= rightText.length; rightIndex += 1) {
      if (leftText[leftIndex - 1] === rightText[rightIndex - 1]) {
        current[rightIndex] = previous[rightIndex - 1] + 1;
        longest = Math.max(longest, current[rightIndex]);
      }
    }
    previous = current;
  }
  return longest;
}

function normalizedSimilarity(left: string, right: string): number {
  const leftTokens = new Set(toBigrams(normalizeText(left)));
  const rightTokens = new Set(toBigrams(normalizeText(right)));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return (2 * overlap) / (leftTokens.size + rightTokens.size);
}

function toBigrams(value: string): string[] {
  if (value.length < 2) return value ? [value] : [];
  const result: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    result.push(value.slice(index, index + 2));
  }
  return result;
}

function criticalRubricFingerprint(draft: StructuredQuestionDraft): string {
  return draft.rubric
    .filter((item) => item.required && item.importance === 'critical')
    .map((item) => `${item.abilityId}:${normalizeText(item.name)}`)
    .sort()
    .join('|');
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\s，。！？；：、“”‘’（）《》,.!?;:'"()[\]{}]/g, '');
}
