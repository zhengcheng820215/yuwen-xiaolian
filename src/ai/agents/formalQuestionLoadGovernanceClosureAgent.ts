import type { MaterialObservationPlanningCandidate } from
  '../schemas/materialObservationDraftGenerator.schema.ts';
import type { SharedFormalResourceSnapshot } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { QuestionEditableFields } from
  '../schemas/workingTaskContent.schema.ts';
import { SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION } from
  '../schemas/singleChoiceInteraction.schema.ts';
import {
  QUESTION_PORTFOLIO_SUPPLEMENT_CANDIDATE_VERSION,
  type QuestionPortfolioSupplementCandidateReport,
  type QuestionPortfolioSupplementCandidateResult,
} from './questionPortfolioSupplementCandidateAgent.ts';

export const FORMAL_QUESTION_LOAD_GOVERNANCE_CLOSURE_MARKER =
  'formal-question-load-governance-closure:2026-08-21-v1' as const;

const TARGET_TITLES = ['《春》', '《女娲造人》'] as const;

export function buildFormalQuestionLoadGovernanceClosureCandidates(
  snapshot: SharedFormalResourceSnapshot,
): QuestionPortfolioSupplementCandidateReport {
  const candidates = TARGET_TITLES.map((title) => buildCandidate(snapshot, title));
  return {
    version: QUESTION_PORTFOLIO_SUPPLEMENT_CANDIDATE_VERSION,
    baselineDigest: `formal-load-closure:r${snapshot.revision}`,
    baselineQuestionCount: snapshot.data.questionResources.registryEntries.filter((entry) => (
      entry.status === 'active'
    )).length,
    candidateCount: candidates.length,
    alreadyPublishedCount: currentPublishedCount(snapshot),
    formalWriteCount: 0,
    candidates,
    issues: [],
  };
}

function buildCandidate(
  snapshot: SharedFormalResourceSnapshot,
  title: typeof TARGET_TITLES[number],
): QuestionPortfolioSupplementCandidateResult {
  const material = snapshot.data.questionResources.materials.find((item) => (
    item.title === title && item.status !== 'retired'
  ));
  if (!material) throw new Error(`Formal load closure material missing: ${title}`);
  const candidate = title === '《春》'
    ? springChoiceCandidate(material.materialId)
    : nuwaFocusedTextCandidate(material.materialId);
  return {
    materialTitle: title,
    materialVersionId: material.materialVersionId,
    candidate,
    completeContent: toCompleteContent(material, candidate),
    qualityStatus: 'ready',
    qualityFindingCodes: [],
  };
}

function springChoiceCandidate(materialId: string): MaterialObservationPlanningCandidate {
  const rubricName = '春回大地整体理解';
  return {
    candidateId: `formal-load-closure:${materialId}:spring-entry-choice`,
    questionStem: '第2段写“山朗润起来了，水涨起来了，太阳的脸红起来了”，这些描写共同表现了什么？',
    questionDraft: { questionType: 'multiple_choice', responseFormat: 'single_choice' },
    choiceInteraction: {
      schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
      selectionMode: 'single',
      options: [
        { optionId: 'spring-method', content: '作者按由远到近的顺序介绍了三种景物' },
        { optionId: 'spring-cause', content: '太阳变热直接造成了山色明亮和水位上涨' },
        { optionId: 'spring-correct', content: '春回大地，山水和阳光都显出新的生机' },
        { optionId: 'spring-season', content: '三种景物分别代表春、夏、秋三个季节' },
      ],
      correctOptionIds: ['spring-correct'],
      distractorRationales: [
        {
          optionId: 'spring-method',
          misconceptionCode: 'surface_reading',
          diagnosisMeaning: '把景物共同表现的内容误判为写景顺序。',
          evidenceBoundary: '第2段并未建立由远到近的空间顺序。',
        },
        {
          optionId: 'spring-cause',
          misconceptionCode: 'over_inference',
          diagnosisMeaning: '把并列的春日变化误读成直接因果。',
          evidenceBoundary: '原文并列描写山、水、太阳的变化，没有说明太阳导致其余变化。',
        },
        {
          optionId: 'spring-season',
          misconceptionCode: 'scope_shift',
          diagnosisMeaning: '忽略全文春景语境，把同段景物拆成不同季节。',
          evidenceBoundary: '题目和第2段都限定在春回大地的语境中。',
        },
      ],
      optionSetVersion: 1,
    },
    primaryAbilityId: 'comprehension',
    supportingAbilityIds: [],
    observationDimension: 'fact',
    observationFocus: {
      displayName: '并列景物共同含义判断',
      definition: '观察学生能否把同段并列景物归纳为春回大地、万物苏醒的共同含义。',
    },
    materialAnchor: { anchorType: 'paragraph', startParagraph: 2, endParagraph: 2 },
    expectedStudentAction: '比较三处景物变化，选择能够概括其共同含义的一项。',
    designRationale: '以低输入负担建立《春》的基础理解入口，再进入局部解释和综合分析。',
    difficultySuggestion: 'basic',
    assessmentMode: 'exact_match',
    rubricDraft: [{
      name: rubricName,
      description: '识别三处并列描写共同表现了春回大地、万物苏醒的生机。',
      abilityId: 'comprehension',
      acceptedSignals: ['spring-correct'],
    }],
    answerAcceptanceDraft: {
      acceptedKeywords: [],
      semanticEquivalentAllowed: false,
      acceptedOptionIds: ['spring-correct'],
    },
    minimumAnswerRequirement: {
      responseFormat: 'single_choice',
      minLength: 0,
      requireTextEvidence: false,
      requireExplanation: false,
      minSelections: 1,
      maxSelections: 1,
    },
    calibrationAnswers: calibrationAnswers(rubricName, {
      full: 'spring-correct',
      partial: 'spring-method',
      error: 'spring-season',
      alternative: 'spring-correct',
    }),
    evidencePotential: 'moderate',
    evidenceBoundary: {
      canObserve: '能否理解第2段并列景物描写的共同含义。',
      cannotConclude: '不能据此宣布学生已掌握全文写景层次或综合赏析能力。',
    },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
    inventoryRelation: {
      disposition: 'new_observation_candidate',
      reason: '当前正式题组没有单选或短文本入口，本题新增低输入的基础理解观察。',
    },
  };
}

function nuwaFocusedTextCandidate(materialId: string): MaterialObservationPlanningCandidate {
  const rubricName = '人物反应与创造结果联系';
  return {
    candidateId: `formal-load-closure:${materialId}:nuwa-focused-text`,
    questionStem: '第11段中，女娲听到小人叫她“妈妈”后“满心欢喜，眉开眼笑”。这一反应说明了什么？请结合小人的表现简要说明。',
    questionDraft: { questionType: 'reading_comprehension', responseFormat: 'short_text' },
    primaryAbilityId: 'comprehension',
    supportingAbilityIds: ['inference'],
    observationDimension: 'character',
    observationFocus: {
      displayName: '人物反应与创造结果联系',
      definition: '观察学生能否根据小人的称呼和活动，解释女娲喜悦所对应的创造结果。',
    },
    materialAnchor: { anchorType: 'paragraph', startParagraph: 11, endParagraph: 11 },
    expectedStudentAction: '定位小人的称呼和活动，用一句因果说明女娲喜悦的原因。',
    designRationale: '在基础单选之后提供单证据、单关系的局部解释，再进入跨段综合分析。',
    difficultySuggestion: 'basic',
    assessmentMode: 'key_points',
    rubricDraft: [{
      name: rubricName,
      description: '说明小人有生命、会叫“妈妈”，表明女娲成功创造了人并获得情感回应。',
      abilityId: 'comprehension',
      acceptedSignals: ['小人有了生命', '叫女娲妈妈', '创造成功', '获得情感回应'],
    }],
    answerAcceptanceDraft: {
      acceptedKeywords: ['小人有了生命', '叫女娲妈妈', '创造成功', '获得情感回应'],
      semanticEquivalentAllowed: true,
    },
    minimumAnswerRequirement: {
      minLength: 15,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    calibrationAnswers: calibrationAnswers(rubricName, {
      full: '小人会活动，还叫她“妈妈”，说明她成功创造了有生命的人并得到回应，所以十分喜悦。',
      partial: '因为小人叫她妈妈。',
      error: '因为女娲终于可以休息了。',
      alternative: '这些小人有生命并把女娲当作母亲，她的创造成功了。',
    }),
    evidencePotential: 'strong',
    evidenceBoundary: {
      canObserve: '能否用局部证据解释女娲的直接情绪反应。',
      cannotConclude: '不能据此宣布学生已经掌握全文人物形象或神话主题分析。',
    },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
    inventoryRelation: {
      disposition: 'new_observation_candidate',
      reason: '现有题组从基础单选直接进入综合分析，本题补充独立的局部解释动作。',
    },
  };
}

function toCompleteContent(
  material: SharedFormalResourceSnapshot['data']['questionResources']['materials'][number],
  candidate: MaterialObservationPlanningCandidate,
): QuestionEditableFields {
  const sequenceTags = candidate.questionDraft.responseFormat === 'single_choice'
    ? [
      'sequence-prelude-count:1',
      'sequence-prelude:true',
      'sequence-rank:1',
      'sequence-reason:default_foundation_entry',
      'sequence-strategy:entry_first',
    ]
    : [
      'sequence-rank:2',
      'sequence-reason:default_foundation_entry',
      'sequence-strategy:entry_first',
    ];
  return {
    materialVersionId: material.materialVersionId,
    title: `${material.title}输入负担治理补充题`,
    questionStem: candidate.questionStem,
    questionType: candidate.questionDraft.questionType,
    responseFormat: candidate.questionDraft.responseFormat,
    choiceInteraction: candidate.choiceInteraction,
    assessmentMode: candidate.assessmentMode,
    answerAcceptance: {
      ...candidate.answerAcceptanceDraft,
      normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
    },
    rubric: candidate.rubricDraft.map((item, index) => ({
      itemId: `${candidate.candidateId}:rubric:${index + 1}`,
      name: item.name,
      description: item.description,
      abilityId: item.abilityId,
      importance: 'critical',
      required: true,
      acceptedSignals: item.acceptedSignals,
    })),
    minimumAnswerRequirement: candidate.minimumAnswerRequirement,
    abilityMetadata: {
      abilityId: candidate.primaryAbilityId,
      supportingAbilityIds: candidate.supportingAbilityIds,
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: candidate.difficultySuggestion,
      gradeRange: material.metadata?.gradeRange || '七年级',
    },
    source: {
      sourceType: 'ai_assisted',
      description: '正式题输入负担治理的受控候选，经质量门禁后采用并发布。',
      copyrightNote: material.source.copyrightNote,
      externalReference: material.source.externalReference,
    },
    tags: [
      FORMAL_QUESTION_LOAD_GOVERNANCE_CLOSURE_MARKER,
      `observation_focus:${candidate.observationDimension}`,
      ...sequenceTags,
    ],
  };
}

function calibrationAnswers(
  rubricName: string,
  examples: { full: string; partial: string; error: string; alternative: string },
): MaterialObservationPlanningCandidate['calibrationAnswers'] {
  return [
    calibration('fully_meets', examples.full, 'fully_meets', 'completed', 'eligible', rubricName),
    calibration('partially_meets', examples.partial, 'partially_meets', 'partial', 'eligible_but_weak', rubricName),
    calibration('typical_error', examples.error, 'does_not_meet', 'missing', 'eligible', rubricName),
    calibration('reasonable_alternative', examples.alternative, 'fully_meets', 'completed', 'eligible', rubricName),
    calibration('irrelevant', '未作答', 'insufficient_evidence', 'missing', 'ineligible', rubricName),
  ];
}

function calibration(
  category: MaterialObservationPlanningCandidate['calibrationAnswers'][number]['category'],
  answerText: string,
  expectedAnswerStatus: MaterialObservationPlanningCandidate['calibrationAnswers'][number]['expectedAnswerStatus'],
  status: 'completed' | 'partial' | 'missing',
  eligibility: 'eligible' | 'eligible_but_weak' | 'ineligible',
  rubricName: string,
): MaterialObservationPlanningCandidate['calibrationAnswers'][number] {
  return {
    category,
    answerText,
    expectedAnswerStatus,
    expectedRubricCoverage: [{ rubricName, status }],
    expectedDiagnosisBoundary: '只校准本题观察动作，不外推稳定能力结论。',
    expectedEvidenceEligibility: eligibility,
  };
}

function currentPublishedCount(snapshot: SharedFormalResourceSnapshot): number {
  const activeIds = new Set(snapshot.data.questionResources.registryEntries.filter((entry) => (
    entry.status === 'active'
  )).map((entry) => entry.currentFrozenVersionId));
  return snapshot.data.questionResources.versions.filter((version) => (
    activeIds.has(version.resourceVersionId)
    && version.tags.includes(FORMAL_QUESTION_LOAD_GOVERNANCE_CLOSURE_MARKER)
  )).length;
}
