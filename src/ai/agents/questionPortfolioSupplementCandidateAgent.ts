import { ScriptedDiagnosisProviderAdapter } from
  '../providers/diagnosisProviderAdapter.ts';
import type { MaterialObservationPlanningCandidate } from
  '../schemas/materialObservationDraftGenerator.schema.ts';
import type { SharedFormalResourceSnapshot } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { QuestionEditableFields } from
  '../schemas/workingTaskContent.schema.ts';
import {
  createMaterialObservationDraftGeneratorConfig,
  generateMaterialObservationDraftCandidates,
} from './materialObservationDraftGeneratorAgent.ts';
import {
  evaluateQuestionGenerationQuality,
} from './questionGenerationQualityPolicyAgent.ts';
import {
  buildQuestionPortfolioSupplementPlan,
  type QuestionPortfolioSupplementTarget,
} from './questionPortfolioSupplementPlanningAgent.ts';

export const QUESTION_PORTFOLIO_SUPPLEMENT_CANDIDATE_VERSION =
  'question-portfolio-supplement-p2-02-v1';

export type QuestionPortfolioSupplementCandidateResult = {
  materialTitle: string;
  materialVersionId: string;
  candidate: MaterialObservationPlanningCandidate;
  completeContent: QuestionEditableFields;
  qualityStatus: 'blocked' | 'ready_with_guidance' | 'ready';
  qualityFindingCodes: string[];
};

export type QuestionPortfolioSupplementCandidateReport = {
  version: typeof QUESTION_PORTFOLIO_SUPPLEMENT_CANDIDATE_VERSION;
  baselineDigest: string;
  baselineQuestionCount: number;
  candidateCount: number;
  alreadyPublishedCount: number;
  formalWriteCount: 0;
  candidates: QuestionPortfolioSupplementCandidateResult[];
  issues: string[];
};

export async function generateQuestionPortfolioSupplementCandidates(
  snapshot: SharedFormalResourceSnapshot,
): Promise<QuestionPortfolioSupplementCandidateReport> {
  const plan = buildQuestionPortfolioSupplementPlan(snapshot);
  const issues = [...plan.issues];
  const candidates: QuestionPortfolioSupplementCandidateResult[] = [];
  for (const target of plan.targets) {
    const generated = await generateOne(snapshot, target);
    if (generated.issue) issues.push(generated.issue);
    if (generated.result) candidates.push(generated.result);
  }
  if (candidates.length !== plan.targets.length) {
    issues.push(`p2_02_candidate_count_mismatch:${candidates.length}/${plan.targets.length}`);
  }
  if (candidates.some((item) => item.qualityStatus === 'blocked')) {
    issues.push('p2_02_blocked_candidate_present');
  }
  return {
    version: QUESTION_PORTFOLIO_SUPPLEMENT_CANDIDATE_VERSION,
    baselineDigest: plan.baselineDigest,
    baselineQuestionCount: plan.baselineQuestionCount,
    candidateCount: candidates.length,
    alreadyPublishedCount: plan.satisfiedMaterialTitles.length,
    formalWriteCount: 0,
    candidates,
    issues,
  };
}

async function generateOne(
  snapshot: SharedFormalResourceSnapshot,
  target: QuestionPortfolioSupplementTarget,
): Promise<{ result?: QuestionPortfolioSupplementCandidateResult; issue?: string }> {
  const material = snapshot.data.questionResources.materials.find((item) => (
    item.materialVersionId === target.materialVersionId && item.status !== 'retired'
  ));
  const plan = snapshot.data.materialObservations.plans.find((item) => (
    item.materialVersionId === target.materialVersionId && item.status === 'reviewed'
  ));
  if (!material || !plan) return { issue: `p2_02_context_missing:${target.materialTitle}` };
  const activeLinks = snapshot.data.materialObservations.links.filter((item) => (
    item.materialVersionId === target.materialVersionId && item.status === 'active'
  ));
  const versionIds = new Set(activeLinks.map((item) => item.resourceVersionId));
  const peerVersions = snapshot.data.questionResources.versions.filter((item) => (
    versionIds.has(item.resourceVersionId)
  ));
  const payload = { candidates: [candidatePayload(target)], materialLimitations: [] };
  const provider = new ScriptedDiagnosisProviderAdapter([{
    type: 'response',
    rawOutput: JSON.stringify(payload),
    latencyMs: 0,
  }]);
  const result = await generateMaterialObservationDraftCandidates({
    requestId: `p2-02:${target.materialId}`,
    generationMode: 'discover_new_observation',
    material: {
      materialVersionId: material.materialVersionId,
      title: material.title,
      content: material.content,
      sourceDescription: material.source.description,
      copyrightNote: material.source.copyrightNote,
    },
    preferences: {
      gradeRange: material.metadata?.gradeRange,
      preferredAbilityIds: [target.targetAbilityId],
      candidateCount: 1,
      planningIntent: 'supplement',
      requestedFocus: target.observationFocus,
    },
    existingInventory: {
      observations: plan.taskPlans.filter((task) => task.status !== 'cancelled').map((task) => ({
        observationId: task.observationTaskPlanId,
        primaryAbilityId: task.abilityId,
        observationDimension: task.primaryDimension,
        focusDisplayName: task.observationFocus?.displayName || task.observationGoal,
        focusDefinition: task.observationFocus?.definition || task.designReason,
        expectedStudentAction: task.expectedStudentAction,
      })),
      questions: peerVersions.map((version) => ({
        questionId: version.resourceVersionId,
        questionStem: version.questionStem,
        primaryAbilityId: version.abilityMetadata.abilityId,
        observationDimension: plan.taskPlans.find((task) => (
          task.linkedResourceId === version.resourceId || task.linkedDraftId === version.sourceDraftId
        ))?.primaryDimension || 'fact',
      })),
    },
  }, {
    provider,
    config: createMaterialObservationDraftGeneratorConfig({
      providerName: provider.providerName,
      model: 'controlled-p2-02-candidate-set',
      maxAttempts: 1,
    }),
  });
  if (result.status !== 'candidates_ready' || result.candidates.length !== 1) {
    return { issue: `p2_02_generation_rejected:${target.materialTitle}:${result.validation.issues.join(',')}` };
  }
  const candidate = result.candidates[0];
  const completeContent = toCompleteContent(material.source, target, candidate);
  const quality = evaluateQuestionGenerationQuality({
    candidate: completeContent,
    peerQuestions: peerVersions,
    includePortfolioGuidance: false,
  });
  return {
    result: {
      materialTitle: target.materialTitle,
      materialVersionId: target.materialVersionId,
      candidate,
      completeContent,
      qualityStatus: quality.status,
      qualityFindingCodes: quality.findings.map((finding) => finding.code),
    },
  };
}

function toCompleteContent(
  source: QuestionEditableFields['source'],
  target: QuestionPortfolioSupplementTarget,
  candidate: MaterialObservationPlanningCandidate,
): QuestionEditableFields {
  return {
    materialVersionId: target.materialVersionId,
    title: `${target.materialTitle}基础能力补充题`,
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
      itemId: `p2-02:${target.materialId}:rubric:${index + 1}`,
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
      gradeRange: '七年级',
    },
    source: {
      sourceType: 'ai_assisted',
      description: `${QUESTION_PORTFOLIO_SUPPLEMENT_CANDIDATE_VERSION} controlled candidate`,
      copyrightNote: source.copyrightNote,
      externalReference: source.externalReference,
    },
    tags: [
      `observation_task:p2-02:${target.materialId}`,
      `observation_focus:${candidate.observationDimension}`,
      'candidate_only:not_published',
    ],
  };
}

function candidatePayload(target: QuestionPortfolioSupplementTarget): Record<string, unknown> {
  const definition = CANDIDATE_DEFINITIONS[target.materialTitle];
  if (!definition) throw new Error(`P2-02 candidate definition missing: ${target.materialTitle}`);
  const rubricName = `${target.observationFocus}观察项`;
  return {
    questionStem: definition.questionStem,
    questionDraft: { questionType: 'reading_comprehension', responseFormat: 'short_text' },
    primaryAbilityId: target.targetAbilityId,
    supportingAbilityIds: [],
    observationDimension: definition.observationDimension,
    observationFocus: {
      displayName: target.observationFocus,
      definition: target.evidenceBoundary,
    },
    materialAnchor: { anchorType: 'full_text' },
    expectedStudentAction: definition.expectedStudentAction,
    designRationale: target.planningReason,
    difficultySuggestion: target.targetDifficulty,
    assessmentMode: 'key_points',
    rubricDraft: [{
      name: rubricName,
      description: definition.rubricDescription,
      abilityId: target.targetAbilityId,
      acceptedSignals: definition.acceptedKeywords,
    }],
    answerAcceptanceDraft: {
      acceptedKeywords: definition.acceptedKeywords,
      semanticEquivalentAllowed: true,
    },
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: false,
      requireExplanation: false,
    },
    calibrationAnswers: calibrationAnswers(rubricName, definition),
    evidencePotential: 'moderate',
    evidenceBoundary: {
      canObserve: target.observationFocus,
      cannotConclude: '不能根据单题宣布学生已经稳定掌握该能力，也不用于推断长期能力水平。',
    },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
  };
}

type CandidateDefinition = {
  questionStem: string;
  expectedStudentAction: string;
  observationDimension: 'fact' | 'plot' | 'character';
  rubricDescription: string;
  acceptedKeywords: string[];
  fullyMeets: string;
  partiallyMeets: string;
  typicalError: string;
  reasonableAlternative: string;
};

const CANDIDATE_DEFINITIONS: Record<string, CandidateDefinition> = {
  '《皇帝的新装》': {
    questionStem: '小孩子说出真相以前，皇帝、大臣和百姓是怎样对待这件“新衣服”的？请根据全文写出其中两类人物的具体表现。',
    expectedStudentAction: '从原文中确认两类人物的言行，用简洁语言分别概括。',
    observationDimension: 'fact',
    rubricDescription: '准确写出至少两类人物在真相揭露前的具体表现。',
    acceptedKeywords: ['皇帝穿上新衣游行', '大臣假装看见并称赞', '百姓称赞新衣'],
    fullyMeets: '皇帝穿上并不存在的新衣去游行，大臣和百姓明明看不见却仍然称赞。',
    partiallyMeets: '大臣和百姓都称赞新衣。',
    typicalError: '所有人一开始就说皇帝没有穿衣服。',
    reasonableAlternative: '皇帝照常参加游行，臣民则附和说衣服很漂亮。',
  },
  '《秋天的怀念》': {
    questionStem: '母亲为了照顾并鼓励“我”重新面对生活，做了哪些具体事情？请根据全文概括其中两件。',
    expectedStudentAction: '从全文提取母亲的具体行动，概括其中两件。',
    observationDimension: 'character',
    rubricDescription: '准确概括母亲照顾或鼓励“我”的至少两项具体行动。',
    acceptedKeywords: ['挡在窗前', '央求看花', '忍住病痛照顾', '安慰鼓励'],
    fullyMeets: '母亲挡住窗外的落叶，避免刺激“我”；她还多次央求陪“我”去北海看花。',
    partiallyMeets: '母亲央求“我”去看花。',
    typicalError: '母亲责怪“我”不愿意出门。',
    reasonableAlternative: '她忍着自己的病痛照顾“我”，并想用看花鼓励“我”重新生活。',
  },
  '《散步》': {
    questionStem: '请根据全文说明：一家人在田野散步时遇到了什么分歧？“我”最初怎样决定，最后一家人怎样解决？',
    expectedStudentAction: '按情节写出分歧、最初决定和最终解决结果。',
    observationDimension: 'plot',
    rubricDescription: '准确说明走大路或小路的分歧，以及决定和最终解决结果。',
    acceptedKeywords: ['母亲走大路', '儿子走小路', '决定走大路', '母亲改走小路', '背起母亲和儿子'],
    fullyMeets: '母亲想走大路，儿子想走小路；“我”先决定顺从母亲走大路，母亲又改主意走小路，难走处夫妻分别背起母亲和儿子。',
    partiallyMeets: '母亲想走大路，儿子想走小路，后来一家人走了小路。',
    typicalError: '“我”一开始决定让儿子独自走小路。',
    reasonableAlternative: '分歧在于选大路还是小路；“我”先迁就母亲，母亲又迁就孙子，最后全家走小路。',
  },
  '《狼》': {
    questionStem: '请根据全文，按事情发展概括屠户面对两只狼时采取的三个关键行动。',
    expectedStudentAction: '按先后顺序概括屠户退让、防守和反击的关键行动。',
    observationDimension: 'plot',
    rubricDescription: '按顺序准确概括屠户应对狼的三个关键行动阶段。',
    acceptedKeywords: ['投骨', '靠积薪持刀', '暴起杀狼', '转后杀另一狼'],
    fullyMeets: '屠户先投骨退让，接着靠着积薪持刀防守，最后突然反击杀死面前的狼，又转到后面杀死另一只狼。',
    partiallyMeets: '屠户先投骨，最后拿刀杀死了狼。',
    typicalError: '屠户一直逃跑，狼后来自行离开。',
    reasonableAlternative: '他先用骨头拖延，再借柴堆保护自己，随后抓住机会先后杀死两只狼。',
  },
};

function calibrationAnswers(rubricName: string, definition: CandidateDefinition) {
  const coverage = (status: 'completed' | 'partial' | 'missing') => ([{
    rubricName,
    status,
  }]);
  return [
    {
      category: 'fully_meets',
      answerText: definition.fullyMeets,
      expectedAnswerStatus: 'fully_meets',
      expectedRubricCoverage: coverage('completed'),
      expectedDiagnosisBoundary: '仅说明本题中的事实理解或概括表现。',
      expectedEvidenceEligibility: 'eligible',
    },
    {
      category: 'partially_meets',
      answerText: definition.partiallyMeets,
      expectedAnswerStatus: 'partially_meets',
      expectedRubricCoverage: coverage('partial'),
      expectedDiagnosisBoundary: '只记录要点不完整，不外推长期能力。',
      expectedEvidenceEligibility: 'eligible_but_weak',
    },
    {
      category: 'typical_error',
      answerText: definition.typicalError,
      expectedAnswerStatus: 'does_not_meet',
      expectedRubricCoverage: coverage('missing'),
      expectedDiagnosisBoundary: '只记录本题事实错误。',
      expectedEvidenceEligibility: 'eligible_but_weak',
    },
    {
      category: 'reasonable_alternative',
      answerText: definition.reasonableAlternative,
      expectedAnswerStatus: 'fully_meets',
      expectedRubricCoverage: coverage('completed'),
      expectedDiagnosisBoundary: '接受与参考答案语义等价的表达。',
      expectedEvidenceEligibility: 'eligible',
    },
    {
      category: 'irrelevant',
      answerText: '我不知道。',
      expectedAnswerStatus: 'insufficient_evidence',
      expectedRubricCoverage: coverage('missing'),
      expectedDiagnosisBoundary: '无有效作答时不形成能力结论。',
      expectedEvidenceEligibility: 'ineligible',
    },
  ];
}
