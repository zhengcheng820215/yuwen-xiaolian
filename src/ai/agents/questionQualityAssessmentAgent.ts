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
import {
  assessMaterialEvidenceBoundary,
} from '../patterns/materialEvidenceBoundary.ts';
import {
  validateSingleChoiceInteraction,
} from '../schemas/singleChoiceInteraction.schema.ts';

export type AssessQuestionDraftQualityInput = {
  draft: StructuredQuestionDraft;
  validation: ResourceValidationResult;
  material: QuestionMaterialVersion | null;
  peerDrafts?: StructuredQuestionDraft[];
  assessedAt?: string;
  ruleVersion?: string;
};

export type CurrentQuestionQualityAssessmentState =
  | 'missing'
  | 'current'
  | 'stale_by_revision'
  | 'stale_by_rule_version'
  | 'failed';

export type ResolveCurrentQuestionQualityAssessmentOptions = {
  comparisonContextHash?: string;
  executionStatus?: 'completed' | 'provider_failed' | 'timeout' | 'invalid_output';
};

export function selectComparableQuestionDrafts(
  draft: StructuredQuestionDraft,
  peerDrafts: StructuredQuestionDraft[],
): StructuredQuestionDraft[] {
  const observationPlanTag = draft.tags.find((tag) => tag.startsWith('observation_plan:'));
  const candidates = peerDrafts.filter((peer) => (
    peer.draftId !== draft.draftId &&
    peer.resourceId !== draft.resourceId &&
    peer.materialVersionId === draft.materialVersionId &&
    peer.status !== 'archived' &&
    peer.status !== 'rejected' &&
    (!observationPlanTag || peer.tags.includes(observationPlanTag))
  ));
  const latestByResource = new Map<string, StructuredQuestionDraft>();
  candidates.forEach((peer) => {
    const current = latestByResource.get(peer.resourceId);
    if (!current || compareDraftFreshness(peer, current) > 0) {
      latestByResource.set(peer.resourceId, peer);
    }
  });
  return [...latestByResource.values()].sort((left, right) =>
    left.resourceId.localeCompare(right.resourceId) ||
    left.draftId.localeCompare(right.draftId)
  );
}

export function buildQuestionQualityComparisonContextHash(
  draft: StructuredQuestionDraft,
  peerDrafts: StructuredQuestionDraft[],
): string {
  const context = selectComparableQuestionDrafts(draft, peerDrafts)
    .map((peer) => [
      peer.draftId,
      peer.resourceId,
      peer.revision,
      peer.status,
      peer.updatedAt,
    ].join(':'))
    .join('|');
  return `quality-peers-v1:${fnv1a(context)}`;
}

export function assessQuestionDraftQuality(
  input: AssessQuestionDraftQualityInput,
): QuestionQualityAssessment {
  assertCurrentPassedValidation(input.draft, input.validation);

  const comparablePeerDrafts = selectComparableQuestionDrafts(
    input.draft,
    input.peerDrafts || [],
  );
  const comparisonContextHash = buildQuestionQualityComparisonContextHash(
    input.draft,
    comparablePeerDrafts,
  );
  const warnings: QuestionQualityWarning[] = [];
  const materialGrounding = checkMaterialGrounding(
    input.draft,
    input.material,
    warnings,
  );
  const observationClarity = checkObservationClarity(input.draft, warnings);
  const observationDistinctness = checkObservationDistinctness(
    input.draft,
    comparablePeerDrafts,
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
    assessmentId: `${input.draft.draftId}:quality:r${input.draft.revision}:${ruleVersion}:${comparisonContextHash}`,
    draftId: input.draft.draftId,
    resourceId: input.draft.resourceId,
    assessedDraftRevision: input.draft.revision,
    validationId: input.validation.validationId,
    comparisonContextHash,
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
  comparisonContextHash?: string,
): assessment is QuestionQualityAssessment {
  return resolveCurrentQuestionQualityAssessmentState(
    draft,
    validation,
    assessment,
    { comparisonContextHash },
  ) === 'current';
}

export function resolveCurrentQuestionQualityAssessmentState(
  draft: StructuredQuestionDraft,
  validation: ResourceValidationResult,
  assessment: QuestionQualityAssessment | null | undefined,
  options: ResolveCurrentQuestionQualityAssessmentOptions = {},
): CurrentQuestionQualityAssessmentState {
  if (options.executionStatus && options.executionStatus !== 'completed') {
    return 'failed';
  }
  if (!assessment) return 'missing';
  if (assessment.ruleVersion !== QUESTION_QUALITY_RULE_VERSION) {
    return 'stale_by_rule_version';
  }
  const isCurrentRevision = (
    assessment.draftId === draft.draftId &&
    assessment.resourceId === draft.resourceId &&
    assessment.assessedDraftRevision === draft.revision &&
    assessment.validationId === validation.validationId &&
    validation.draftId === draft.draftId &&
    validation.validatedDraftRevision === draft.revision &&
    validation.passed &&
    (
      options.comparisonContextHash === undefined ||
      assessment.comparisonContextHash === options.comparisonContextHash
    )
  );
  return isCurrentRevision ? 'current' : 'stale_by_revision';
}

export function requireCurrentQuestionQualityAssessment(
  draft: StructuredQuestionDraft,
  validation: ResourceValidationResult,
  assessment: QuestionQualityAssessment | null | undefined,
  comparisonContextHash?: string,
): QuestionQualityAssessment {
  if (!isCurrentQuestionQualityAssessment(
    draft,
    validation,
    assessment,
    comparisonContextHash,
  )) {
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

  const boundary = assessMaterialEvidenceBoundary(
    draft.questionStem,
    material.content,
  );
  if (boundary.hasInvalidParagraphReference) {
    addWarning(
      warnings,
      'quality.material.paragraph_out_of_range',
      'materialGrounding',
      'strong_warning',
      `题干引用的段落超出当前材料范围（材料共 ${boundary.paragraphCount} 段）。`,
      ['questionStem', 'materialVersionId'],
    );
    return 'fail';
  }
  if (['local', 'whole_text', 'open_evidence', 'mixed'].includes(boundary.kind)) {
    return 'pass';
  }
  if (boundary.kind === 'generic') {
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

function checkObservationClarity(
  draft: StructuredQuestionDraft,
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' {
  const stem = normalizeText(draft.questionStem);
  if (draft.responseFormat === 'single_choice') {
    const hasSelectionAction = /(选择|选出|哪(?:一)?项|哪种|最(?:准确|恰当|合理|符合|能)|正确的是|不正确的是|不能说明|能够说明|符合文意)/.test(stem);
    const hasValidChoiceInteraction = validateSingleChoiceInteraction(
      draft.choiceInteraction,
    ).passed;
    if (hasSelectionAction && hasValidChoiceInteraction) return 'pass';
    addWarning(
      warnings,
      'quality.observation.unclear',
      'observationClarity',
      'strong_warning',
      '单选题干没有清楚说明学生需要从选项中完成什么判断。',
      ['questionStem', 'choiceInteraction'],
    );
    return 'warning';
  }
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
  const duplicate = peerDrafts
    .map((peer) => {
    const stemSimilarity = normalizedSimilarity(peer.questionStem, draft.questionStem);
    const evidenceSimilarity = normalizedSimilarity(
      rubricEvidenceFingerprint(peer),
      rubricEvidenceFingerprint(draft),
    );
    const sameCriticalRubric = criticalRubricFingerprint(peer) === criticalRubricFingerprint(draft);

      return {
        peer,
        stemSimilarity,
        evidenceSimilarity,
        isDuplicate: (
      (stemSimilarity >= 0.78 && evidenceSimilarity >= 0.55) ||
      (stemSimilarity >= 0.55 && evidenceSimilarity >= 0.78 && sameCriticalRubric)
        ),
      };
    })
    .filter((candidate) => candidate.isDuplicate)
    .sort((left, right) =>
      (right.stemSimilarity + right.evidenceSimilarity) -
      (left.stemSimilarity + left.evidenceSimilarity)
    )[0];

  if (!duplicate) return 'pass';
  addWarning(
    warnings,
    'quality.observation.duplicate',
    'observationDistinctness',
    'warning',
    '系统发现本题与另一道当前题目的题干或评分要点较为接近，请人工确认两题的回答对象、材料依据和评分目标是否确实重复。',
    ['questionStem', `peerDraft:${duplicate.peer.draftId}`],
    {
      peerDraftId: duplicate.peer.draftId,
      peerResourceId: duplicate.peer.resourceId,
      peerQuestionStem: duplicate.peer.questionStem,
      stemSimilarity: duplicate.stemSimilarity,
      rubricEvidenceSimilarity: duplicate.evidenceSimilarity,
    },
  );
  return 'warning';
}

function checkDiscriminativePower(
  draft: StructuredQuestionDraft,
  warnings: QuestionQualityWarning[],
): 'pass' | 'warning' {
  if (draft.responseFormat === 'single_choice') {
    const choiceValidation = validateSingleChoiceInteraction(draft.choiceInteraction);
    if (choiceValidation.passed) return 'pass';
    addWarning(
      warnings,
      'quality.discrimination.weak',
      'discriminativePower',
      'warning',
      '当前单选的答案、选项或干扰项依据还不能形成可靠区分。',
      ['choiceInteraction.options', 'choiceInteraction.correctOptionIds', 'choiceInteraction.distractorRationales'],
    );
    return 'warning';
  }
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
    const message = basicTooHeavy
      ? '当前设为基础难度，但作答要求较多或评分条件较复杂。'
      : '当前设为进阶难度，但作答要求和评分条件较少。';
    addWarning(
      warnings,
      'quality.difficulty.incoherent',
      'difficultyCoherence',
      'warning',
      message,
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
  comparison?: QuestionQualityWarning['comparison'],
): void {
  warnings.push({ code, check, severity, message, evidenceRefs, comparison });
}

function compareDraftFreshness(
  left: StructuredQuestionDraft,
  right: StructuredQuestionDraft,
): number {
  const updatedAtDifference = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
  if (updatedAtDifference !== 0) return updatedAtDifference;
  if (left.revision !== right.revision) return left.revision - right.revision;
  return left.draftId.localeCompare(right.draftId);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
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

function rubricEvidenceFingerprint(draft: StructuredQuestionDraft): string {
  return draft.rubric
    .filter((item) => item.required)
    .flatMap((item) => [item.name, ...(item.acceptedSignals || [])])
    .map(normalizeText)
    .filter(Boolean)
    .sort()
    .join('|');
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\s，。！？；：、“”‘’（）《》,.!?;:'"()[\]{}]/g, '');
}
