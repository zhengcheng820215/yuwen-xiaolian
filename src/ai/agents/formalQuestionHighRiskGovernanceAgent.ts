import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type FrozenQuestionResourceVersion,
  type QuestionResourceRubricItem,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  cloneSharedFormalResourceValue,
  type SharedFormalResourceData,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';
import type {
  MaterialObservationPlan,
  ObservationTaskPlan,
} from '../schemas/materialObservation.schema.ts';
import {
  buildMaterialObservationPlan,
  createMaterialSourceAnchor,
  deriveResourceObservationLink,
  validateMaterialObservationPlan,
} from './materialObservationAgent.ts';
import { createQualityArtifacts } from './materialCorpusOptimizationAgent.ts';

export const FORMAL_QUESTION_HIGH_RISK_GOVERNANCE_MARKER =
  'formal-question-high-risk-governance:2026-08-21-batch-1-v1' as const;
export const FORMAL_QUESTION_FOCUSED_GOVERNANCE_BATCH2_MARKER =
  'formal-question-focused-governance:2026-08-21-batch-2-v1' as const;

export type GovernanceSpecification = {
  materialTitle: string;
  resourceId: string;
  expectedSourceVersionId: string;
  anchor: { startParagraph: number; endParagraph: number };
  title: string;
  questionStem: string;
  questionType?: FrozenQuestionResourceVersion['questionType'];
  responseFormat: 'short_text' | 'long_text' | 'single_choice';
  choiceInteraction?: FrozenQuestionResourceVersion['choiceInteraction'];
  assessmentMode?: FrozenQuestionResourceVersion['assessmentMode'];
  expectedStudentAction: string;
  designReason: string;
  answerAcceptance: FrozenQuestionResourceVersion['answerAcceptance'];
  rubric: QuestionResourceRubricItem[];
  minimumAnswerRequirement: FrozenQuestionResourceVersion['minimumAnswerRequirement'];
  calibrationCases: ObservationTaskPlan['calibrationCases'];
};

export type FormalQuestionHighRiskGovernanceReport = {
  alreadyApplied: boolean;
  materialTitles: string[];
  previousResourceVersionIds: string[];
  successorResourceVersionIds: string[];
  observationPlanIds: string[];
  currentQuestionCount: number;
  currentTraceCount: number;
};

const GOVERNANCE_SPECS: GovernanceSpecification[] = [
  {
    materialTitle: '《狼》',
    resourceId: 'question-observation-task-plan-1dkgzj1',
    expectedSourceVersionId: 'question-observation-task-plan-1dkgzj1:v5',
    anchor: { startParagraph: 4, endParagraph: 5 },
    title: '分析 · 结尾态度理解',
    questionStem: '文章结尾说“狼亦黠矣，而顷刻两毙……止增笑耳”。结合第4段两狼的结局，说明作者对狼的“变诈”持怎样的态度。',
    responseFormat: 'short_text',
    expectedStudentAction: '先概括作者对狼狡诈行为的态度，再用第4段两狼被屠户杀死的结局说明判断依据。',
    designReason: '保留主旨理解目标，但收敛为一个态度判断；结局证据只作为从属支撑，不再并列要求分析屠户、狼和全文主旨。',
    answerAcceptance: acceptance(['讽刺', '嘲笑', '狡诈', '失败', '两狼被杀']),
    rubric: [rubric(
      '结局与作者态度联系',
      'analysis',
      '说明作者讽刺、嘲笑狼自以为狡猾却迅速失败，并用两狼被杀的结局支撑判断。',
      ['讽刺狼的狡诈', '狡诈终归失败', '两狼被杀', '止增笑耳'],
    )],
    minimumAnswerRequirement: minimum(25),
    calibrationCases: calibrationCases(
      '结局与作者态度联系',
      '作者用嘲讽的态度写狼的“变诈”：两狼虽然设法夹击、偷袭，最终都被屠户杀死，只能成为笑料。',
      '作者在嘲笑狼。',
      '作者认为狼很聪明，值得赞扬。',
      '两狼都被杀，说明作者讽刺它们再狡猾也逃不过失败。',
    ),
  },
  {
    materialTitle: '《猫》',
    resourceId: 'resource-observation-task-plan-10at8sx',
    expectedSourceVersionId: 'resource-observation-task-plan-10at8sx:v4',
    anchor: { startParagraph: 32, endParagraph: 32 },
    title: '推理 · “永无”原因',
    questionStem: '第三只猫死后，作者为什么说自己“永无改正过失的机会”？',
    responseFormat: 'short_text',
    expectedStudentAction: '说明第三只猫已经死亡，作者因此无法再向它道歉或补救过失。',
    designReason: '保留因果推断目标，只观察“猫的结局—无法补救”的关系，不再同时要求完成主题分析。',
    answerAcceptance: acceptance(['猫死了', '无法道歉', '无法补救', '无法弥补']),
    rubric: [rubric(
      '结局与无法补救的关系',
      'inference',
      '根据第三只猫已经死亡且不能再接受道歉，说明作者失去了补救过失的机会。',
      ['猫已经死了', '不能向猫道歉', '无法补救', '无法弥补'],
    )],
    minimumAnswerRequirement: minimum(20),
    calibrationCases: calibrationCases(
      '结局与无法补救的关系',
      '第三只猫已经死去，作者再也不能向它说明误会或弥补伤害，所以说“永无”改正过失的机会。',
      '因为第三只猫死了。',
      '因为作者以后不想再养猫。',
      '猫死后无法再接受作者的道歉和补救，因此这个过失无法挽回。',
    ),
  },
  {
    materialTitle: '《秋天的怀念》',
    resourceId: 'resource-observation-task-plan-1i0snrc',
    expectedSourceVersionId: 'resource-observation-task-plan-1i0snrc:v4',
    anchor: { startParagraph: 1, endParagraph: 2 },
    title: '分析 · 病情补写的作用',
    questionStem: '第2段补写母亲严重的病情。联系第1段母亲照顾“我”的表现，这一补写让你进一步看出母亲怎样的特点？',
    responseFormat: 'short_text',
    expectedStudentAction: '联系母亲自己病重却仍忍痛照顾“我”，概括她隐忍、无私或深爱孩子的特点。',
    designReason: '把结构和情感两个并列要求收敛为一个人物特点判断，用第1、2段的反差关系作为从属依据。',
    answerAcceptance: acceptance(['病重', '忍痛', '照顾', '隐忍', '无私', '爱孩子']),
    rubric: [rubric(
      '病情与照顾行为的反差',
      'analysis',
      '联系母亲病重与仍然照顾“我”的反差，说明她隐忍、无私并深爱孩子。',
      ['自己病重', '忍受病痛', '仍照顾我', '隐忍', '无私', '爱孩子'],
    )],
    minimumAnswerRequirement: minimum(20),
    calibrationCases: calibrationCases(
      '病情与照顾行为的反差',
      '母亲自己病得很重，却一直忍着疼痛照顾“我”，说明她隐忍、无私，把对孩子的爱放在自己之前。',
      '说明母亲很爱“我”。',
      '说明母亲的病很严重。',
      '她在重病中仍关心和安慰孩子，表现出深沉而无私的母爱。',
    ),
  },
];

const FOCUSED_GOVERNANCE_BATCH2_SPECS: GovernanceSpecification[] = [
  {
    materialTitle: '《皇帝的新装》',
    resourceId: 'question-observation-task-plan-12ktvxo',
    expectedSourceVersionId: 'question-observation-task-plan-12ktvxo:v4',
    anchor: { startParagraph: 34, endParagraph: 37 },
    title: '分析 · 真相传播的转折',
    questionStem: '小孩子说出“可是他什么衣服也没有穿呀”后，老百姓也开始说出真相。这句话怎样推动骗局被揭穿？',
    responseFormat: 'short_text',
    expectedStudentAction: '说明孩子说真话打破了此前的集体沉默，使真相在人群中传播并推动骗局被揭穿。',
    designReason: '保留关键情节的结构功能，只观察“孩子说真话—真相传播—骗局被揭穿”这一条因果链，不再并列要求完成主题分析。',
    answerAcceptance: acceptance(['说出真相', '打破沉默', '传播', '揭穿骗局', '转折']),
    rubric: [rubric(
      '真相传播的转折',
      'analysis',
      '说明孩子说真话打破集体沉默，使老百姓开始传播真相并推动骗局被揭穿。',
      ['打破沉默', '真相传播', '老百姓说出真相', '骗局被揭穿'],
    )],
    minimumAnswerRequirement: minimum(25),
    calibrationCases: calibrationCases(
      '真相传播的转折',
      '孩子直接说出真相，打破了大家不敢说实话的沉默；这句话被人们传开，老百姓也说皇帝没有穿衣服，骗局因此被揭穿。',
      '孩子说出了真相，让大家知道皇帝没有穿衣服。',
      '孩子的话让皇帝继续完成游行。',
      '孩子的真话使人们不再附和，真相从私下传播到公开说出，推动骗局暴露。',
    ),
  },
  {
    materialTitle: '《猫》',
    resourceId: 'resource-observation-task-plan-10up8i5',
    expectedSourceVersionId: 'resource-observation-task-plan-10up8i5:v4',
    anchor: { startParagraph: 1, endParagraph: 34 },
    title: '概括 · 三次亡失的情感递进',
    questionStem: '三次养猫经历中，“我”面对猫的亡失时，情感有什么变化？请按三次经历概括。',
    responseFormat: 'long_text',
    expectedStudentAction: '依次概括“我”面对第一只猫死亡、第二只猫丢失和第三只猫被冤枉后死亡时的情感，呈现由酸辛、怅然愤恨到痛苦悔恨的递进。',
    designReason: '保留全文整合与概括能力，只观察“我”的情感递进这一条变化轴，不再并列比较猫的特点、家人态度、结局并归纳主题。',
    answerAcceptance: acceptance(['酸辛', '怅然', '愤恨', '难过', '悔恨', '自责', '递进']),
    rubric: [{
      ...rubric(
        '三次亡失的情感递进',
        'summarization',
        '按三次经历概括“我”的情感由酸辛、怅然愤恨逐步发展为痛苦、悔恨和自责。',
        ['第一只猫酸辛', '第二只猫怅然愤恨', '第三只猫痛苦悔恨', '情感逐步加深'],
      ),
      evidenceRequirement: {
        requireTextEvidence: true,
        requireExplanation: false,
        requireConclusion: false,
      },
    }],
    minimumAnswerRequirement: {
      minLength: 30,
      requireTextEvidence: true,
      requireExplanation: false,
    },
    calibrationCases: calibrationCases(
      '三次亡失的情感递进',
      '第一只猫死后，“我”感到一缕酸辛；第二只猫丢失后，“我”怅然并愤恨夺猫的人；第三只猫被冤枉后死亡，“我”最为难过，充满悔恨和自责。情感一次比一次沉重。',
      '前两只猫亡失时“我”很难过，第三只猫死后“我”更后悔。',
      '三只猫亡失后，“我”的感受完全相同。',
      '“我”从第一次的酸辛、第二次对外人的愤恨，发展到第三次因自己过失产生的深切自责，情感逐步加深。',
    ),
  },
  {
    materialTitle: '《天上的街市》',
    resourceId: 'question-observation-task-plan-r3zmn4',
    expectedSourceVersionId: 'question-observation-task-plan-r3zmn4:v4',
    anchor: { startParagraph: 9, endParagraph: 17 },
    title: '推理 · 神话改写的意图',
    questionStem: '传统故事中的牛郎织女被天河阻隔，诗中却写他们可以“骑着牛儿来往”、在天街闲游。诗人为什么要这样改写？',
    responseFormat: 'short_text',
    expectedStudentAction: '根据诗中牛郎织女自由来往、悠闲生活的状态，推断诗人借改写表达对自由、幸福和美好生活的向往。',
    designReason: '保留神话改写的推理目标，把传统故事差异作为从属证据，只观察“改写内容—生活愿望”这一条关系。',
    answerAcceptance: acceptance(['自由', '幸福', '美好生活', '向往', '理想']),
    rubric: [rubric(
      '改写与生活愿望',
      'inference',
      '联系牛郎织女自由来往、天街闲游的改写，说明诗人向往自由、幸福和美好的生活。',
      ['自由来往', '天街闲游', '幸福生活', '美好生活', '向往'],
    )],
    minimumAnswerRequirement: minimum(25),
    calibrationCases: calibrationCases(
      '改写与生活愿望',
      '诗人把被阻隔的牛郎织女写成能够自由来往、在天街闲游，是为了表现自己对自由、幸福和美好生活的向往。',
      '因为诗人希望牛郎织女生活得自由幸福。',
      '因为诗人不了解传统故事。',
      '这种改写让牛郎织女摆脱阻隔、过上悠闲生活，寄托了诗人对理想生活的向往。',
    ),
  },
];

export function prepareFormalQuestionHighRiskGovernance(
  source: SharedFormalResourceData,
  now: string,
): { data: SharedFormalResourceData; report: FormalQuestionHighRiskGovernanceReport } {
  return prepareFormalQuestionGovernanceBatch(
    source,
    now,
    FORMAL_QUESTION_HIGH_RISK_GOVERNANCE_MARKER,
    GOVERNANCE_SPECS,
    'formal-high-risk-governance',
  );
}

export function prepareFormalQuestionFocusedGovernanceBatch2(
  source: SharedFormalResourceData,
  now: string,
): { data: SharedFormalResourceData; report: FormalQuestionHighRiskGovernanceReport } {
  return prepareFormalQuestionGovernanceBatch(
    source,
    now,
    FORMAL_QUESTION_FOCUSED_GOVERNANCE_BATCH2_MARKER,
    FOCUSED_GOVERNANCE_BATCH2_SPECS,
    'formal-focused-governance-batch2',
  );
}

export function prepareFormalQuestionGovernanceBatch(
  source: SharedFormalResourceData,
  now: string,
  marker: string,
  specs: GovernanceSpecification[],
  actorSlug: string,
): { data: SharedFormalResourceData; report: FormalQuestionHighRiskGovernanceReport } {
  const data = cloneSharedFormalResourceValue(source);
  const currentMarked = listCurrentVersions(data).filter((version) => (
    version.tags.includes(marker)
  ));
  if (currentMarked.length === specs.length) {
    return { data, report: summarize(data, true, currentMarked, [], [], specs) };
  }
  if (currentMarked.length > 0) {
    throw new Error(`Formal governance partial state: ${currentMarked.length}/${specs.length}.`);
  }

  const previousResourceVersionIds: string[] = [];
  const successorResourceVersionIds: string[] = [];
  const observationPlanIds: string[] = [];
  for (const spec of specs) {
    const result = prepareSuccessor(data, spec, now, marker, actorSlug);
    previousResourceVersionIds.push(result.previousResourceVersionId);
    successorResourceVersionIds.push(result.successorResourceVersionId);
    observationPlanIds.push(result.observationPlanId);
  }
  const successors = listCurrentVersions(data).filter((version) => (
    version.tags.includes(marker)
  ));
  return {
    data,
    report: summarize(
      data,
      false,
      successors,
      previousResourceVersionIds,
      observationPlanIds,
      specs,
    ),
  };
}

function prepareSuccessor(
  data: SharedFormalResourceData,
  spec: GovernanceSpecification,
  now: string,
  marker: string,
  actorSlug: string,
): {
  previousResourceVersionId: string;
  successorResourceVersionId: string;
  observationPlanId: string;
} {
  const registryIndex = data.questionResources.registryEntries.findIndex((entry) => (
    entry.status === 'active' && entry.resourceId === spec.resourceId
  ));
  if (registryIndex < 0) throw new Error(`Governance Registry missing: ${spec.resourceId}`);
  const previousRegistry = data.questionResources.registryEntries[registryIndex]!;
  if (previousRegistry.currentFrozenVersionId !== spec.expectedSourceVersionId) {
    throw new Error(`Governance source is stale: ${spec.resourceId}`);
  }
  const sourceVersion = requireVersion(data, spec.expectedSourceVersionId);
  const sourceDraft = data.questionResources.drafts.find((draft) => (
    draft.draftId === sourceVersion.sourceDraftId
  ));
  if (!sourceDraft) throw new Error(`Governance source draft missing: ${sourceVersion.sourceDraftId}`);
  const material = data.questionResources.materials.find((item) => (
    item.status !== 'retired' && item.materialVersionId === sourceVersion.materialVersionId
  ));
  if (!material || material.title !== spec.materialTitle) {
    throw new Error(`Governance material mismatch: ${spec.materialTitle}`);
  }
  const oldPlan = selectCurrentPlan(
    data,
    material.materialVersionId,
    sourceVersion.taskId,
  );
  const materialActiveLinks = data.materialObservations.links.filter((link) => (
    link.status === 'active' && link.materialVersionId === material.materialVersionId
  ));
  const activeLinkByTaskId = new Map(materialActiveLinks.map((link) => (
    [link.observationTaskPlanId, link]
  )));
  const structure = data.materialObservations.structures.find((item) => (
    item.materialStructureSnapshotId === oldPlan.materialStructureSnapshotId
  ));
  if (!structure) throw new Error(`Governance structure missing: ${material.materialVersionId}`);
  const targetTaskIndex = oldPlan.taskPlans.findIndex((task) => (
    [task.observationTaskPlanId, task.taskRevisionRootId, task.parentObservationTaskPlanId]
      .filter(Boolean).includes(sourceVersion.taskId)
  ));
  if (targetTaskIndex < 0) throw new Error(`Governance task missing: ${sourceVersion.taskId}`);
  const anchor = createMaterialSourceAnchor({
    material,
    structure,
    anchorType: 'paragraph_range',
    startParagraph: spec.anchor.startParagraph,
    endParagraph: spec.anchor.endParagraph,
  });
  if (!data.materialObservations.anchors.some((item) => item.sourceAnchorId === anchor.sourceAnchorId)) {
    data.materialObservations.anchors.push(anchor);
  }

  const taskInputs = oldPlan.taskPlans.map((task, index) => ({
    observationTaskPlanId: task.observationTaskPlanId,
    taskRevisionRootId: task.taskRevisionRootId,
    parentObservationTaskPlanId: task.parentObservationTaskPlanId,
    regenerationAttemptId: task.regenerationAttemptId,
    primaryDimension: task.primaryDimension,
    observationFocus: cloneSharedFormalResourceValue(task.observationFocus),
    abilityId: task.abilityId,
    taskRole: task.taskRole,
    difficulty: task.difficulty,
    sourceAnchorIds: index === targetTaskIndex ? [anchor.sourceAnchorId] : [...task.sourceAnchorIds],
    observationGoal: index === targetTaskIndex ? spec.questionStem : task.observationGoal,
    expectedStudentAction: index === targetTaskIndex
      ? spec.expectedStudentAction
      : task.expectedStudentAction,
    designReason: index === targetTaskIndex ? spec.designReason : task.designReason,
    intendedComparisonGroupId: task.intendedComparisonGroupId,
    materialRelationIntent: task.materialRelationIntent,
    resourceDraftSpecification: index === targetTaskIndex
      ? {
        ...cloneSharedFormalResourceValue(task.resourceDraftSpecification),
        title: spec.title,
        questionType: spec.questionType ?? (spec.responseFormat === 'single_choice'
          ? 'multiple_choice' as const
          : 'reading_comprehension' as const),
        responseFormat: spec.responseFormat,
        choiceInteraction: spec.choiceInteraction
          ? cloneSharedFormalResourceValue(spec.choiceInteraction)
          : undefined,
        assessmentMode: spec.assessmentMode ?? (spec.responseFormat === 'single_choice'
          ? 'exact_match' as const
          : 'reasoning_chain' as const),
        answerAcceptance: cloneSharedFormalResourceValue(spec.answerAcceptance),
        rubric: cloneSharedFormalResourceValue(spec.rubric),
        minimumAnswerRequirement: cloneSharedFormalResourceValue(spec.minimumAnswerRequirement),
      }
      : cloneSharedFormalResourceValue(task.resourceDraftSpecification),
    calibrationCases: index === targetTaskIndex
      ? cloneSharedFormalResourceValue(spec.calibrationCases)
      : cloneSharedFormalResourceValue(task.calibrationCases),
    targetedTrainingMetadata: task.targetedTrainingMetadata,
  }));
  const plan = buildMaterialObservationPlan({
    materialId: material.materialId,
    materialVersionId: material.materialVersionId,
    materialStructureSnapshotId: structure.materialStructureSnapshotId,
    revision: oldPlan.revision + 1,
    parentPlanId: oldPlan.materialObservationPlanId,
    dimensionReviews: oldPlan.dimensionReviews.map((review) => ({
      ...cloneSharedFormalResourceValue(review),
      sourceAnchorIds: review.dimension === oldPlan.taskPlans[targetTaskIndex]!.primaryDimension
        ? [...new Set([...review.sourceAnchorIds, anchor.sourceAnchorId])]
        : [...review.sourceAnchorIds],
    })),
    taskPlans: taskInputs,
    now,
  });
  const targetTask = plan.taskPlans[targetTaskIndex]!;
  const artifacts = createSuccessorArtifacts({
    data,
    sourceVersion,
    sourceDraft,
    task: targetTask,
    plan,
    spec,
    now,
    marker,
    actorSlug,
  });
  plan.taskPlans = plan.taskPlans.map((task, index) => index === targetTaskIndex
    ? {
      ...task,
      linkedDraftId: artifacts.draft.draftId,
      linkedResourceId: artifacts.version.resourceId,
      status: 'frozen_linked',
    }
    : linkExistingTask(data, task, activeLinkByTaskId));
  plan.status = 'reviewed';
  plan.reviewerId = `codex-${actorSlug}-reviewer`;
  plan.reviewNote = `正式题高风险治理：${spec.materialTitle}保持原观察目标，只收敛并列动作并补齐证据范围。`;
  plan.reviewedAt = now;
  plan.updatedAt = now;
  const planValidation = validateMaterialObservationPlan({
    plan,
    material,
    structure,
    anchors: data.materialObservations.anchors.filter((item) => (
      item.materialVersionId === material.materialVersionId
    )),
    checkedAt: now,
  });
  if (!planValidation.passed) {
    throw new Error(`${spec.materialTitle} governance Plan invalid: ${planValidation.issues.map((issue) => issue.code).join(',')}`);
  }

  const peerDrafts = currentMaterialVersions(data, material.materialVersionId)
    .filter((version) => version.resourceId !== sourceVersion.resourceId)
    .map((version) => data.questionResources.drafts.find((draft) => (
      draft.draftId === version.sourceDraftId
    )))
    .filter((draft): draft is StructuredQuestionDraft => Boolean(draft));
  const quality = createQualityArtifacts({
    draft: artifacts.draft,
    validation: artifacts.validation,
    material,
    materialAnchor: anchor,
    peerDrafts,
    review: artifacts.review,
    version: artifacts.version,
    now,
  });
  artifacts.review.qualityAssessmentBundleId = quality.bundle.bundleId;
  artifacts.review.deterministicAssessmentId = quality.deterministic.assessmentId;
  artifacts.review.semanticAssessmentId = quality.semantic.semanticAssessmentId;
  artifacts.review.qualityMergeRuleVersion = quality.bundle.mergeRuleVersion;
  artifacts.review.warningDecisions = quality.deterministic.warnings.map((warning) => ({
    warningDecisionId: `${artifacts.draft.draftId}:${warning.code}:accepted`,
    draftId: artifacts.draft.draftId,
    draftRevision: 1,
    assessmentId: quality.deterministic.assessmentId,
    warningCode: warning.code,
    decision: 'accepted',
    reviewedBy: `codex-${actorSlug}-reviewer`,
    reviewedAt: now,
  }));

  const registry = createRegistryEntry(previousRegistry, artifacts.version, now);
  data.questionResources.drafts.push(artifacts.draft);
  data.questionResources.validations.push(artifacts.validation);
  data.questionResources.reviews.push(artifacts.review);
  data.questionResources.versions.push(artifacts.version);
  data.questionQuality.deterministicAssessments.push(quality.deterministic);
  data.questionQuality.semanticAssessments.push(quality.semantic);
  data.questionQuality.assessmentBundles.push(quality.bundle);
  data.questionQuality.frozenQualityTraces.push(quality.trace);
  data.questionResources.registryEntries[registryIndex] = registry;
  const sourceVersionIndex = data.questionResources.versions.findIndex((item) => (
    item.resourceVersionId === sourceVersion.resourceVersionId
  ));
  data.questionResources.versions[sourceVersionIndex] = {
    ...data.questionResources.versions[sourceVersionIndex]!,
    status: 'superseded',
    updatedAt: now,
  };

  const oldPlanIndex = data.materialObservations.plans.findIndex((item) => (
    item.materialObservationPlanId === oldPlan.materialObservationPlanId
  ));
  data.materialObservations.plans[oldPlanIndex] = {
    ...data.materialObservations.plans[oldPlanIndex]!,
    status: 'superseded',
    updatedAt: now,
  };
  data.materialObservations.plans.push(plan);
  data.materialObservations.validations.push(planValidation);
  data.materialObservations.reviews.push({
    reviewId: `${plan.materialObservationPlanId}:review:r${plan.revision}`,
    materialObservationPlanId: plan.materialObservationPlanId,
    planRevision: plan.revision,
    validationId: planValidation.validationId,
    action: 'approve',
    reviewerId: `codex-${actorSlug}-reviewer`,
    notes: plan.reviewNote,
    reviewedAt: now,
  });

  const previousActiveLinks = materialActiveLinks;
  const previousLinksByResourceId = new Map(previousActiveLinks.map((link) => (
    [link.resourceId, link]
  )));
  data.materialObservations.links = data.materialObservations.links.map((link) => (
    previousActiveLinks.some((active) => active.resourceObservationLinkId === link.resourceObservationLinkId)
      ? { ...link, status: 'superseded' as const }
      : link
  ));
  for (const task of plan.taskPlans) {
    const resourceId = task.linkedResourceId;
    if (!resourceId) throw new Error(`${spec.materialTitle} task resource missing: ${task.observationTaskPlanId}`);
    const taskRegistry = data.questionResources.registryEntries.find((entry) => (
      entry.status === 'active' && entry.resourceId === resourceId
    ));
    if (!taskRegistry?.currentFrozenVersionId) {
      throw new Error(`${spec.materialTitle} task Registry missing: ${resourceId}`);
    }
    const version = requireVersion(data, taskRegistry.currentFrozenVersionId);
    const validation = data.questionResources.validations.find((item) => (
      item.validationId === version.validationId
    ));
    const review = data.questionResources.reviews.find((item) => item.reviewId === version.reviewId);
    const derived = deriveResourceObservationLink({
      plan,
      task,
      version,
      registryEntry: taskRegistry,
      validation,
      review,
      linkedAt: now,
    });
    if (derived.issues.length > 0) {
      throw new Error(`${spec.materialTitle} successor link invalid: ${derived.issues.join(',')}`);
    }
    if (!previousLinksByResourceId.has(resourceId)) {
      throw new Error(`${spec.materialTitle} previous link missing: ${resourceId}`);
    }
    data.materialObservations.links.push(derived.link);
  }

  return {
    previousResourceVersionId: sourceVersion.resourceVersionId,
    successorResourceVersionId: artifacts.version.resourceVersionId,
    observationPlanId: plan.materialObservationPlanId,
  };
}

function createSuccessorArtifacts(input: {
  data: SharedFormalResourceData;
  sourceVersion: FrozenQuestionResourceVersion;
  sourceDraft: StructuredQuestionDraft;
  task: ObservationTaskPlan;
  plan: MaterialObservationPlan;
  spec: GovernanceSpecification;
  now: string;
  marker: string;
  actorSlug: string;
}) {
  const { data, sourceVersion, sourceDraft, task, plan, spec, now, marker, actorSlug } = input;
  const nextVersionNumber = Math.max(...data.questionResources.versions
    .filter((version) => version.resourceId === sourceVersion.resourceId)
    .map((version) => version.versionNumber)) + 1;
  const draftId = `${sourceVersion.resourceId}:${actorSlug}:v${nextVersionNumber}:draft`;
  const validationId = `${draftId}:validation:r1`;
  const reviewId = `${draftId}:review:r1`;
  const tags = [...new Set([
    ...sourceVersion.tags.filter((tag) => (
      !tag.startsWith('observation_plan:')
      && !tag.startsWith('observation_task:')
    )),
    `observation_plan:${plan.materialObservationPlanId}`,
    `observation_task:${task.observationTaskPlanId}`,
    marker,
  ])].sort();
  const content = {
    title: spec.title,
    questionStem: spec.questionStem,
    questionType: spec.questionType ?? (spec.responseFormat === 'single_choice'
      ? 'multiple_choice' as const
      : 'reading_comprehension' as const),
    responseFormat: spec.responseFormat,
    options: [] as string[],
    choiceInteraction: spec.choiceInteraction
      ? cloneSharedFormalResourceValue(spec.choiceInteraction)
      : undefined,
    assessmentMode: spec.assessmentMode ?? (spec.responseFormat === 'single_choice'
      ? 'exact_match' as const
      : 'reasoning_chain' as const),
    answerAcceptance: cloneSharedFormalResourceValue(spec.answerAcceptance),
    rubric: cloneSharedFormalResourceValue(spec.rubric),
    minimumAnswerRequirement: cloneSharedFormalResourceValue(spec.minimumAnswerRequirement),
  };
  const draft: StructuredQuestionDraft = {
    ...cloneSharedFormalResourceValue(sourceDraft),
    ...content,
    draftId,
    taskId: task.observationTaskPlanId,
    proposedVersionNumber: nextVersionNumber,
    parentVersionId: sourceVersion.resourceVersionId,
    tags,
    source: {
      ...cloneSharedFormalResourceValue(sourceVersion.source),
      sourceType: 'ai_assisted',
      description: '正式题输入负担治理的受控后继版本。',
    },
    status: 'reviewed',
    revision: 1,
    latestValidationId: validationId,
    latestReviewId: reviewId,
    qualityRevisionProgress: undefined,
    reviewSubmittedAt: now,
    reviewSubmittedBy: `codex-${actorSlug}-author`,
    reviewSubmissionCount: 1,
    reviewSubmissionHistory: [{
      eventId: `${draftId}:submitted:1`,
      action: 'submitted',
      draftRevision: 1,
      actorId: `codex-${actorSlug}-author`,
      occurredAt: now,
    }],
    warningAcknowledgements: [],
    revisionRequestedAt: undefined,
    revisionRequestCount: undefined,
    createdAt: now,
    updatedAt: now,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
  const validation: ResourceValidationResult = {
    validationId,
    draftId,
    resourceId: draft.resourceId,
    validatedDraftRevision: 1,
    validationRuleVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    passed: true,
    checks: {
      identityValid: true,
      contentValid: true,
      answerAcceptanceValid: true,
      rubricValid: true,
      abilityAndRoleValid: true,
      versionLineageValid: true,
      materialValid: true,
    },
    issues: [],
    checkedAt: now,
  };
  const review: ResourceReviewDecision = {
    reviewId,
    draftId,
    resourceId: draft.resourceId,
    reviewedDraftRevision: 1,
    validationId,
    action: 'approve',
    reviewerId: `codex-${actorSlug}-reviewer`,
    notes: '题干已收敛为一个主要观察动作，证据范围、Rubric、答案接受范围和输入负担已经重新核对。',
    reviewedAt: now,
  };
  const version: FrozenQuestionResourceVersion = {
    ...cloneSharedFormalResourceValue(sourceVersion),
    ...content,
    resourceVersionId: `${sourceVersion.resourceId}:v${nextVersionNumber}`,
    versionNumber: nextVersionNumber,
    parentVersionId: sourceVersion.resourceVersionId,
    sourceDraftId: draftId,
    taskId: task.observationTaskPlanId,
    tags,
    source: cloneSharedFormalResourceValue(draft.source),
    validationId,
    reviewId,
    status: 'frozen',
    frozenAt: now,
    updatedAt: now,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
  return { draft, validation, review, version };
}

function acceptance(keywords: string[]): FrozenQuestionResourceVersion['answerAcceptance'] {
  return {
    acceptedKeywords: keywords,
    semanticEquivalentAllowed: true,
    normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
  };
}

function rubric(
  name: string,
  abilityId: QuestionResourceRubricItem['abilityId'],
  description: string,
  acceptedSignals: string[],
): QuestionResourceRubricItem {
  return {
    itemId: `formal-high-risk:${name}`,
    name,
    description,
    abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: true,
      requireExplanation: true,
      requireConclusion: false,
    },
    acceptedSignals,
  };
}

function minimum(minLength: number): FrozenQuestionResourceVersion['minimumAnswerRequirement'] {
  return { minLength, requireTextEvidence: true, requireExplanation: true };
}

function calibrationCases(
  rubricName: string,
  full: string,
  partial: string,
  error: string,
  alternative: string,
): ObservationTaskPlan['calibrationCases'] {
  return [
    calibration('fully_meets', full, 'fully_meets', rubricName),
    calibration('partially_meets', partial, 'partially_meets', rubricName),
    calibration('typical_error', error, 'does_not_meet', rubricName),
    calibration('reasonable_alternative', alternative, 'fully_meets', rubricName),
    calibration('irrelevant', '未回答题目要求。', 'insufficient_evidence', rubricName),
  ];
}

function calibration(
  category: NonNullable<ObservationTaskPlan['calibrationCases']>[number]['category'],
  answerText: string,
  expectedAnswerStatus: NonNullable<ObservationTaskPlan['calibrationCases']>[number]['expectedAnswerStatus'],
  rubricName: string,
): NonNullable<ObservationTaskPlan['calibrationCases']>[number] {
  return {
    calibrationCaseId: `formal-high-risk:${rubricName}:${category}`,
    category,
    answerText,
    expectedAnswerStatus,
    expectedRubricCoverage: [{
      rubricName,
      status: expectedAnswerStatus === 'fully_meets'
        ? 'completed'
        : expectedAnswerStatus === 'partially_meets'
          ? 'partial'
          : 'missing',
    }],
    expectedDiagnosisBoundary: '只评价本题规定的主要动作，不外推稳定能力结论。',
    expectedEvidenceEligibility: expectedAnswerStatus === 'insufficient_evidence'
      ? 'ineligible'
      : expectedAnswerStatus === 'partially_meets'
        ? 'eligible_but_weak'
        : 'eligible',
    reviewNote: `用于校准“${rubricName}”评分边界，不作为学生界面示例。`,
  };
}

function createRegistryEntry(
  existing: ResourceRegistryEntry,
  version: FrozenQuestionResourceVersion,
  now: string,
): ResourceRegistryEntry {
  return {
    ...existing,
    currentFrozenVersionId: version.resourceVersionId,
    latestReviewId: version.reviewId,
    latestValidationId: version.validationId,
    materialId: version.materialId,
    taskId: version.taskId,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    tags: [...version.tags],
    status: 'active',
    updatedAt: now,
  };
}

function requireVersion(
  data: SharedFormalResourceData,
  resourceVersionId: string,
): FrozenQuestionResourceVersion {
  const version = data.questionResources.versions.find((item) => (
    item.resourceVersionId === resourceVersionId
  ));
  if (!version) throw new Error(`Governance Version missing: ${resourceVersionId}`);
  return version;
}

function selectCurrentPlan(
  data: SharedFormalResourceData,
  materialVersionId: string,
  taskId: string,
): MaterialObservationPlan {
  const plan = data.materialObservations.plans
    .filter((item) => (
      item.status === 'reviewed'
      && item.materialVersionId === materialVersionId
      && item.taskPlans.some((task) => (
        [task.observationTaskPlanId, task.taskRevisionRootId, task.parentObservationTaskPlanId]
          .filter(Boolean)
          .includes(taskId)
      ))
    ))
    .sort((left, right) => right.revision - left.revision
      || right.updatedAt.localeCompare(left.updatedAt))[0];
  if (!plan) throw new Error(`Governance current Plan missing: ${materialVersionId}`);
  return plan;
}

function linkExistingTask(
  data: SharedFormalResourceData,
  task: ObservationTaskPlan,
  activeLinkByTaskId: Map<string, SharedFormalResourceData['materialObservations']['links'][number]>,
): ObservationTaskPlan {
  const link = activeLinkByTaskId.get(task.observationTaskPlanId);
  if (!link) throw new Error(`Governance active task link missing: ${task.observationTaskPlanId}`);
  const version = requireVersion(data, link.resourceVersionId);
  return {
    ...task,
    linkedDraftId: version.sourceDraftId,
    linkedResourceId: version.resourceId,
    status: 'frozen_linked',
  };
}

function listCurrentVersions(data: SharedFormalResourceData): FrozenQuestionResourceVersion[] {
  const currentIds = new Set(data.questionResources.registryEntries
    .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
    .map((entry) => entry.currentFrozenVersionId!));
  return data.questionResources.versions.filter((version) => (
    version.status === 'frozen' && currentIds.has(version.resourceVersionId)
  ));
}

function currentMaterialVersions(
  data: SharedFormalResourceData,
  materialVersionId: string,
): FrozenQuestionResourceVersion[] {
  return listCurrentVersions(data).filter((version) => (
    version.materialVersionId === materialVersionId
  ));
}

function summarize(
  data: SharedFormalResourceData,
  alreadyApplied: boolean,
  currentMarked: FrozenQuestionResourceVersion[],
  previousResourceVersionIds: string[],
  observationPlanIds: string[],
  specs: GovernanceSpecification[],
): FormalQuestionHighRiskGovernanceReport {
  const currentVersions = listCurrentVersions(data);
  const traceVersionIds = new Set(data.questionQuality.frozenQualityTraces.map((trace) => (
    trace.resourceVersionId
  )));
  return {
    alreadyApplied,
    materialTitles: specs.map((item) => item.materialTitle),
    previousResourceVersionIds,
    successorResourceVersionIds: currentMarked.map((version) => version.resourceVersionId).sort(),
    observationPlanIds,
    currentQuestionCount: currentVersions.length,
    currentTraceCount: currentVersions.filter((version) => (
      traceVersionIds.has(version.resourceVersionId)
    )).length,
  };
}
