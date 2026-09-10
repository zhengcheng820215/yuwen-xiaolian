import { createHash } from 'node:crypto';
import {
  createQuestionMaterial,
  createNextQuestionResourceVersionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import {
  createAndValidateQuestionDraftForTask,
  createMaterialProductionPlan,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
} from '../agents/materialObservationApplicationService.ts';
import { createQualityArtifacts } from '../agents/materialCorpusOptimizationAgent.ts';
import { InMemoryMaterialObservationRepository } from
  '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
  type FrozenQuestionResourceVersion,
  type PrimaryAbilityId,
  type QuestionMaterialVersion,
  type QuestionResourceRubricItem,
  type RubricFeedbackActionCode,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { ObservationDimension } from '../schemas/materialObservation.schema.ts';
import {
  cloneSharedFormalResourceValue,
  type SharedFormalResourceData,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';

export const WRONG_ANSWER_STAGE3_WAVE_B_COMMAND_ID =
  'wrong-answer-feedback-stage3-wave-b-2026-09-10-v2' as const;

export const WRONG_ANSWER_STAGE3_WAVE_B_SPECS = [
  {
    key: 'verify-scope',
    actionCode: 'verify_scope',
    abilityId: 'comprehension',
    dimension: 'fact',
    title: '阅览室里的做法',
    content: '周六，学校组织参观社区图书馆。进入阅览室后，小林先把手机调成静音，再把借阅证放在桌边，轻声询问管理员如何查找历史类图书。离开阅览室后，他在大厅买了一瓶水，还在门口拍了合影。',
    questionStem: '只根据小林在阅览室里的行为，写出一项能体现他遵守阅读场所规则的做法。',
    rubricItemId: 'scope-boundary',
    rubricName: '限定范围内取材',
    rubricDescription: '所写内容必须来自题干限定的地点与对象。',
    acceptedSignals: ['阅览室内行为', '静音', '轻声询问'],
    expectedStudentAction: '在题干限定的地点与对象范围内选取一项行为。',
    responseFormat: 'short_text',
    minLength: 8,
  },
  {
    key: 'compare-elements',
    actionCode: 'compare_elements',
    abilityId: 'analysis',
    dimension: 'structure',
    title: '晨光里的芦苇',
    content: '清晨，河边的芦苇沾着露水，叶片低垂。太阳升起后，露水渐干，叶片重新舒展。桥下的石阶从始至终都静静浸在水边。',
    questionStem: '根据材料，比较清晨与太阳升起后芦苇状态的不同，从水分和叶片姿态两个方面作答。',
    rubricItemId: 'comparison-pair',
    rubricName: '形成对应比较',
    rubricDescription: '同时写出两个时段，并形成对应的差异比较。',
    acceptedSignals: ['两个时段', '露水变化', '叶片姿态变化'],
    expectedStudentAction: '围绕指定维度比较两个时段的对应状态。',
    responseFormat: 'long_text',
    minLength: 24,
  },
  {
    key: 'reclassify-by-cue',
    actionCode: 'reclassify_by_cue',
    abilityId: 'extraction',
    dimension: 'language',
    title: '旧车站的声音与凉意',
    content: '走进旧车站，广播里传来清脆的报站声，我听见行李箱的滚轮在地面上咔嗒作响。门一开，冷风贴上手背，我立刻感到一阵凉意。',
    questionStem: '把“报站声、滚轮咔嗒声、冷风贴上手背、凉意”分为“听觉”和“触觉”两类，按两类分别填写。',
    rubricItemId: 'cue-classification',
    rubricName: '依据触发词分类',
    rubricDescription: '依据感官触发词把信息放入题干给定的两个类别。',
    acceptedSignals: ['听见与声音', '手背与感到', '两类标签'],
    expectedStudentAction: '依据感官触发词完成两类信息的归类。',
    responseFormat: 'short_text',
    minLength: 16,
  },
  {
    key: 'identify-object-action',
    actionCode: 'identify_object_action',
    abilityId: 'analysis',
    dimension: 'language',
    title: '窗台上的晚霞',
    content: '傍晚，云层散开。最后一束阳光爬上窗台，轻轻敲了敲玻璃，教室顿时亮了起来。',
    questionStem: '“最后一束阳光爬上窗台，轻轻敲了敲玻璃”运用了拟人。指出被写成人的对象及人的动作。',
    rubricItemId: 'object-action-pair',
    rubricName: '指出对象与动作',
    rubricDescription: '同时指出拟人表达中的对象和人的动作。',
    acceptedSignals: ['阳光', '爬上', '敲玻璃'],
    expectedStudentAction: '指出被写成人的对象及其人的动作。',
    responseFormat: 'short_text',
    minLength: 10,
  },
] as const satisfies ReadonlyArray<{
  key: string;
  actionCode: RubricFeedbackActionCode;
  abilityId: PrimaryAbilityId;
  dimension: ObservationDimension;
  title: string;
  content: string;
  questionStem: string;
  rubricItemId: string;
  rubricName: string;
  rubricDescription: string;
  acceptedSignals: readonly string[];
  expectedStudentAction: string;
  responseFormat: 'short_text' | 'long_text';
  minLength: number;
}>;

export type WrongAnswerStage3WaveBResourceReport = {
  key: string;
  actionCode: RubricFeedbackActionCode;
  materialVersionId: string;
  resourceVersionId: string;
  draftId: string;
  validationId: string;
  reviewId: string;
  materialObservationPlanId: string;
  materialObservationValidationId: string;
  materialObservationReviewId: string;
  resourceObservationLinkId: string;
  qualityTraceId: string;
  contentDigest: string;
};

export type WrongAnswerStage3WaveBReport = {
  alreadyApplied: boolean;
  resources: WrongAnswerStage3WaveBResourceReport[];
};

export async function prepareWrongAnswerFeedbackStage3WaveB(
  source: SharedFormalResourceData,
  now: string,
): Promise<{ data: SharedFormalResourceData; report: WrongAnswerStage3WaveBReport }> {
  const data = cloneSharedFormalResourceValue(source);
  const applied = WRONG_ANSWER_STAGE3_WAVE_B_SPECS.map((spec) => findApplied(data, spec));
  if (applied.every(Boolean)) {
    return {
      data,
      report: {
        alreadyApplied: true,
        resources: applied.map((item) => item!),
      },
    };
  }
  const reports: WrongAnswerStage3WaveBResourceReport[] = [];
  for (const [index, spec] of WRONG_ANSWER_STAGE3_WAVE_B_SPECS.entries()) {
    if (applied[index]) {
      reports.push(applied[index]!);
      continue;
    }
    if (hasResourceIdentity(data, spec)) {
      reports.push(await createQualityClosureSuccessor(data, spec, now));
      continue;
    }
    if (hasPartialIdentityForSpec(data, spec)) {
      throw new Error(`Stage 3 Wave B has an incomplete identity chain: ${spec.key}`);
    }
    const questionRepository = new InMemoryQuestionResourceAdmissionRepository();
    const observationRepository = new InMemoryMaterialObservationRepository();
    const material = await createQuestionMaterial(questionRepository, materialInput(spec, now));
    const production = await createMaterialProductionPlan(
      questionRepository,
      observationRepository,
      {
        materialVersionId: material.materialVersionId,
        tasks: [taskInput(spec, material.materialVersionId)],
        now,
      },
    );
    if (!production.validation.passed) {
      throw new Error(`Stage 3 Wave B Observation Plan failed: ${spec.key}`);
    }
    await submitMaterialObservationPlanForReview(
      questionRepository,
      observationRepository,
      production.plan.materialObservationPlanId,
      now,
    );
    const observationReview = await reviewMaterialObservationPlan(observationRepository, {
      planId: production.plan.materialObservationPlanId,
      action: 'approve',
      reviewerId: 'product-owner-authorized-stage3-wave-b',
      notes: `批准 ${spec.actionCode} 受控原创原子任务；只允许 operation-only 学生投射。`,
      now,
    });
    const reviewedPlan = await observationRepository.getPlan(production.plan.materialObservationPlanId);
    if (!reviewedPlan || reviewedPlan.status !== 'reviewed') {
      throw new Error(`Stage 3 Wave B reviewed Observation Plan is missing: ${spec.key}`);
    }
    const task = reviewedPlan.taskPlans[0];
    if (!task) throw new Error(`Stage 3 Wave B Observation Task is missing: ${spec.key}`);
    const draftResult = await createAndValidateQuestionDraftForTask(
      questionRepository,
      observationRepository,
      {
        planId: reviewedPlan.materialObservationPlanId,
        observationTaskPlanId: task.observationTaskPlanId,
        sourceDescription: 'Stage 3 Wave B 人工编写并经内容操作者审核的受控原创任务。',
        now,
      },
    );
    if (!draftResult.validationPassed) {
      throw new Error(`Stage 3 Wave B Question validation failed: ${spec.key}:${draftResult.issues.join(',')}`);
    }
    await submitQuestionResourceForReview(
      questionRepository,
      draftResult.draftId,
      now,
      [],
      'stage3-wave-b-content-operator',
    );
    const review = await reviewQuestionResourceDraft(questionRepository, {
      draftId: draftResult.draftId,
      action: 'approve',
      reviewerId: 'product-owner-authorized-stage3-wave-b',
      notes: `批准 ${spec.actionCode} 原子 Rubric 与 operation-only 动作契约；acceptedSignals 仅保留评分信号片段，不构成完整答案模板。`,
      now,
    });
    const frozen = await freezeQuestionResourceDraft(questionRepository, draftResult.draftId, now);
    const linked = await linkFrozenResourceToObservationTask(
      questionRepository,
      observationRepository,
      {
        planId: reviewedPlan.materialObservationPlanId,
        observationTaskPlanId: task.observationTaskPlanId,
        resourceVersionId: frozen.version.resourceVersionId,
        linkedAt: now,
      },
    );
    if (linked.issues.length > 0 || linked.link.status !== 'active') {
      throw new Error(`Stage 3 Wave B Resource link failed: ${spec.key}:${linked.issues.join(',')}`);
    }

    const draft = await requireDraft(questionRepository, draftResult.draftId);
    const validation = await requireValidation(questionRepository, frozen.version.validationId);
    const anchor = (await observationRepository.listAnchors(material.materialVersionId))[0];
    const quality = createQualityArtifacts({
      draft,
      validation,
      material,
      materialAnchor: anchor,
      peerDrafts: [],
      review,
      version: frozen.version,
      now,
    });
    const finalReview = {
      ...review,
      qualityAssessmentBundleId: quality.bundle.bundleId,
      deterministicAssessmentId: quality.deterministic.assessmentId,
      semanticAssessmentId: quality.semantic.semanticAssessmentId,
      qualityMergeRuleVersion: quality.bundle.mergeRuleVersion,
      warningDecisions: quality.deterministic.warnings.map((warning) => ({
        warningDecisionId: `${draft.draftId}:${warning.code}:accepted`,
        draftId: draft.draftId,
        draftRevision: draft.revision,
        assessmentId: quality.deterministic.assessmentId,
        warningCode: warning.code,
        decision: 'accepted' as const,
        reviewedBy: 'product-owner-authorized-stage3-wave-b',
        reviewedAt: now,
      })),
    };

    appendUnique(data.questionResources.materials, material, 'materialVersionId');
    appendUnique(data.questionResources.drafts, draft, 'draftId');
    appendUnique(data.questionResources.validations, validation, 'validationId');
    appendUnique(data.questionResources.reviews, finalReview, 'reviewId');
    appendUnique(data.questionResources.versions, frozen.version, 'resourceVersionId');
    appendUnique(data.questionResources.registryEntries, frozen.registryEntry, 'resourceId');
    const structure = (await observationRepository.listStructures(material.materialVersionId))[0];
    const observationValidation = (await observationRepository.listValidations(reviewedPlan.materialObservationPlanId))[0];
    if (!structure || !anchor || !observationValidation) {
      throw new Error(`Stage 3 Wave B Observation evidence is incomplete: ${spec.key}`);
    }
    appendUnique(data.materialObservations.structures, structure, 'materialStructureSnapshotId');
    appendUnique(data.materialObservations.anchors, anchor, 'sourceAnchorId');
    appendUnique(data.materialObservations.plans, reviewedPlan, 'materialObservationPlanId');
    appendUnique(data.materialObservations.validations, observationValidation, 'validationId');
    appendUnique(data.materialObservations.reviews, observationReview, 'reviewId');
    appendUnique(data.materialObservations.links, linked.link, 'resourceObservationLinkId');
    appendUnique(data.questionQuality.deterministicAssessments, quality.deterministic, 'assessmentId');
    appendUnique(data.questionQuality.semanticAssessments, quality.semantic, 'semanticAssessmentId');
    appendUnique(data.questionQuality.assessmentBundles, quality.bundle, 'bundleId');
    appendUnique(data.questionQuality.frozenQualityTraces, quality.trace, 'traceId');

    reports.push(reportFor(
      spec.key,
      spec.actionCode,
      material,
      frozen.version,
      reviewedPlan.materialObservationPlanId,
      observationValidation.validationId,
      observationReview.reviewId,
      linked.link.resourceObservationLinkId,
      quality.trace.traceId,
    ));
  }

  return { data, report: { alreadyApplied: false, resources: reports } };
}

function materialInput(
  spec: typeof WRONG_ANSWER_STAGE3_WAVE_B_SPECS[number],
  now: string,
) {
  const materialId = `wrong-answer-stage3-wave-b-${spec.key}-material`;
  return {
    materialId,
    materialVersionId: `${materialId}:v1`,
    versionNumber: 1,
    status: 'active' as const,
    title: spec.title,
    content: spec.content,
    usageType: 'targeted_excerpt' as const,
    contentNormalizationPolicyVersion: 'material_content_normalization_v1' as const,
    targetedExcerptMetadata: {
      targetAbilityIds: [spec.abilityId],
      supportedGapReasonCodes: ['incomplete_task_requirement' as const],
      sourceRelation: 'controlled_original' as const,
      intendedTaskCount: 1 as const,
    },
    source: {
      sourceType: 'manual' as const,
      description: 'Stage 3 Wave B 受控原创短材料。',
      copyrightNote: '产品团队受控原创，仅用于阅读训练。',
    },
    metadata: {
      genre: 'other' as const,
      gradeRange: '七年级',
      tags: ['wrong-answer-feedback', 'stage3-wave-b', spec.actionCode],
      provenanceStatus: 'verified' as const,
      provenanceReview: {
        textVerificationStatus: 'verified' as const,
        rightsStatus: 'cleared' as const,
        sourceLocator: `controlled-original:${materialId}`,
        textSourceLocator: `controlled-original:${materialId}:v1`,
        rightsEvidenceLocator: 'product-owner-authorized-stage3-wave-b',
        verifiedBy: 'stage3-wave-b-content-operator',
        verifiedAt: now,
        notes: '不复制教材、试卷或学生答案；由产品团队为动作校准独立编写。',
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function taskInput(
  spec: typeof WRONG_ANSWER_STAGE3_WAVE_B_SPECS[number],
  materialVersionId: string,
) {
  const rubric: QuestionResourceRubricItem[] = [{
    itemId: spec.rubricItemId,
    name: spec.rubricName,
    description: spec.rubricDescription,
    abilityId: spec.abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: true,
      requireExplanation: spec.actionCode === 'compare_elements',
      requireConclusion: true,
    },
    feedbackActionContract: {
      schemaVersion: RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
      actionCode: spec.actionCode,
      disclosurePolicy: 'operation_only',
    },
    acceptedSignals: [...spec.acceptedSignals],
  }];
  return {
    observationTaskPlanId: `wrong-answer-stage3-wave-b-${spec.key}-task-plan-v1`,
    primaryDimension: spec.dimension,
    abilityId: spec.abilityId,
    taskRole: 'training' as const,
    difficulty: 'basic' as const,
    anchorType: 'full_text' as const,
    questionStem: spec.questionStem,
    expectedStudentAction: spec.expectedStudentAction,
    designReason: `针对 ${spec.actionCode} 的已确认局部缺口，在受控原创新语境中执行一次原子动作。`,
    materialRelationIntent: 'new_context' as const,
    targetedTrainingMetadata: {
      primaryGapReasonCode: 'incomplete_task_requirement' as const,
      targetedMaterialVersionId: materialVersionId,
    },
    resourceDraftSpecification: {
      title: `${spec.title} · 动作校准`,
      questionType: 'reading_comprehension' as const,
      responseFormat: spec.responseFormat,
      assessmentMode: 'key_points' as const,
      answerAcceptance: {
        semanticEquivalentAllowed: true,
        normalizationRules: ['trim' as const, 'ignore_punctuation' as const],
      },
      rubric,
      minimumAnswerRequirement: {
        responseFormat: spec.responseFormat,
        minLength: spec.minLength,
        requireTextEvidence: true,
        requireExplanation: spec.actionCode === 'compare_elements',
      },
      supportingAbilityIds: [],
      prerequisiteAbilityIds: ['comprehension' as const],
      gradeRange: '七年级',
      tags: ['wrong-answer-feedback', 'stage3-wave-b', spec.actionCode],
    },
  };
}

function findApplied(
  data: SharedFormalResourceData,
  spec: typeof WRONG_ANSWER_STAGE3_WAVE_B_SPECS[number],
): WrongAnswerStage3WaveBResourceReport | null {
  const resourceId = `resource-wrong-answer-stage3-wave-b-${spec.key}-task-plan-v1`;
  const entry = data.questionResources.registryEntries.find((item) => (
    item.resourceId === resourceId && item.status === 'active'
  ));
  if (!entry?.currentFrozenVersionId) return null;
  const version = data.questionResources.versions.find((item) => (
    item.resourceVersionId === entry.currentFrozenVersionId
  ));
  const materialVersionId = `wrong-answer-stage3-wave-b-${spec.key}-material:v1`;
  const material = data.questionResources.materials.find((item) => (
    item.materialVersionId === materialVersionId
  ));
  const rubric = version?.rubric.find((item) => item.itemId === spec.rubricItemId);
  const trace = data.questionQuality.frozenQualityTraces.find((item) => (
    item.resourceVersionId === version?.resourceVersionId
  ));
  const link = data.materialObservations.links.find((item) => (
    item.status === 'active' && item.resourceVersionId === version?.resourceVersionId
  ));
  const plan = data.materialObservations.plans.find((item) => (
    item.materialObservationPlanId === link?.materialObservationPlanId
  ));
  const observationValidation = data.materialObservations.validations.find((item) => (
    item.materialObservationPlanId === plan?.materialObservationPlanId && item.passed
  ));
  const observationReview = data.materialObservations.reviews.find((item) => (
    item.materialObservationPlanId === plan?.materialObservationPlanId && item.action === 'approve'
  ));
  if (
    !version || version.status !== 'frozen'
    || !material || material.status === 'retired'
    || material.metadata?.provenanceStatus !== 'verified'
    || material.metadata.provenanceReview?.rightsStatus !== 'cleared'
    || material.targetedExcerptMetadata?.sourceRelation !== 'controlled_original'
    || material.targetedExcerptMetadata.intendedTaskCount !== 1
    || rubric?.feedbackActionContract?.actionCode !== spec.actionCode
    || rubric.feedbackActionContract.disclosurePolicy !== 'operation_only'
    || !trace || !link || !plan || !observationValidation || !observationReview
  ) {
    throw new Error(`Stage 3 Wave B applied resource is invalid: ${spec.key}`);
  }
  if (
    version.questionStem !== spec.questionStem
    || version.responseFormat !== spec.responseFormat
    || version.minimumAnswerRequirement.responseFormat !== spec.responseFormat
    || !('minLength' in version.minimumAnswerRequirement)
    || version.minimumAnswerRequirement.minLength !== spec.minLength
  ) return null;
  return reportFor(
    spec.key,
    spec.actionCode,
    material,
    version,
    plan.materialObservationPlanId,
    observationValidation.validationId,
    observationReview.reviewId,
    link.resourceObservationLinkId,
    trace.traceId,
  );
}

function hasResourceIdentity(
  data: SharedFormalResourceData,
  spec: typeof WRONG_ANSWER_STAGE3_WAVE_B_SPECS[number],
): boolean {
  const resourceId = `resource-wrong-answer-stage3-wave-b-${spec.key}-task-plan-v1`;
  return data.questionResources.registryEntries.some((item) => (
    item.resourceId === resourceId && item.status === 'active' && item.currentFrozenVersionId
  ));
}

function hasPartialIdentityForSpec(
  data: SharedFormalResourceData,
  spec: typeof WRONG_ANSWER_STAGE3_WAVE_B_SPECS[number],
): boolean {
  const marker = `wrong-answer-stage3-wave-b-${spec.key}`;
  return data.questionResources.materials.some((item) => item.materialId.includes(marker))
    || data.questionResources.drafts.some((item) => item.draftId.includes(marker))
    || data.questionResources.versions.some((item) => item.resourceId.includes(marker))
    || data.questionResources.registryEntries.some((item) => item.resourceId.includes(marker));
}

async function createQualityClosureSuccessor(
  data: SharedFormalResourceData,
  spec: typeof WRONG_ANSWER_STAGE3_WAVE_B_SPECS[number],
  now: string,
): Promise<WrongAnswerStage3WaveBResourceReport> {
  const resourceId = `resource-wrong-answer-stage3-wave-b-${spec.key}-task-plan-v1`;
  const registryIndex = data.questionResources.registryEntries.findIndex((item) => (
    item.resourceId === resourceId && item.status === 'active'
  ));
  const registry = data.questionResources.registryEntries[registryIndex];
  if (!registry?.currentFrozenVersionId) {
    throw new Error(`Stage 3 Wave B current Registry head is missing: ${spec.key}`);
  }
  const current = data.questionResources.versions.find((item) => (
    item.resourceVersionId === registry.currentFrozenVersionId
  ));
  const material = data.questionResources.materials.find((item) => (
    item.materialVersionId === `wrong-answer-stage3-wave-b-${spec.key}-material:v1`
  ));
  const sourceDraft = current && data.questionResources.drafts.find((item) => (
    item.draftId === current.sourceDraftId
  ));
  const sourceValidation = current && data.questionResources.validations.find((item) => (
    item.validationId === current.validationId
  ));
  const sourceReview = current && data.questionResources.reviews.find((item) => (
    item.reviewId === current.reviewId
  ));
  const sourceLinkIndex = current ? data.materialObservations.links.findIndex((item) => (
    item.status === 'active' && item.resourceVersionId === current.resourceVersionId
  )) : -1;
  const sourceLink = data.materialObservations.links[sourceLinkIndex];
  const plan = sourceLink && data.materialObservations.plans.find((item) => (
    item.materialObservationPlanId === sourceLink.materialObservationPlanId
  ));
  const observationValidation = plan && data.materialObservations.validations.find((item) => (
    item.materialObservationPlanId === plan.materialObservationPlanId && item.passed
  ));
  const observationReview = plan && data.materialObservations.reviews.find((item) => (
    item.materialObservationPlanId === plan.materialObservationPlanId && item.action === 'approve'
  ));
  const structure = plan && data.materialObservations.structures.find((item) => (
    item.materialStructureSnapshotId === plan.materialStructureSnapshotId
  ));
  const anchors = plan
    ? data.materialObservations.anchors.filter((item) => item.materialVersionId === plan.materialVersionId)
    : [];
  if (
    !current || !material || !sourceDraft || !sourceValidation?.passed
    || sourceReview?.action !== 'approve' || !sourceLink || !plan
    || !observationValidation || !observationReview || !structure || anchors.length === 0
  ) {
    throw new Error(`Stage 3 Wave B successor source evidence is incomplete: ${spec.key}`);
  }

  const questionRepository = new InMemoryQuestionResourceAdmissionRepository();
  const observationRepository = new InMemoryMaterialObservationRepository();
  await questionRepository.saveMaterial(material);
  await questionRepository.saveDraft(sourceDraft);
  await questionRepository.saveValidation(sourceValidation);
  await questionRepository.saveReview(sourceReview);
  await questionRepository.commitFreeze({ version: current, registryEntry: registry });
  await observationRepository.saveStructure(structure);
  for (const anchor of anchors) await observationRepository.saveAnchor(anchor);
  await observationRepository.savePlan(plan);
  await observationRepository.saveValidation(observationValidation);
  await observationRepository.saveReview(observationReview);
  await observationRepository.saveLink(sourceLink);

  const draftId = `${resourceId}:stage3-wave-b-quality-closure:draft`;
  const generated = await createNextQuestionResourceVersionDraft(questionRepository, {
    resourceId,
    draftId,
    now,
  });
  const desired = taskInput(spec, material.materialVersionId).resourceDraftSpecification;
  const updated = await updateStructuredQuestionDraft(questionRepository, draftId, {
    questionStem: spec.questionStem,
    responseFormat: desired.responseFormat,
    assessmentMode: desired.assessmentMode,
    answerAcceptance: desired.answerAcceptance,
    rubric: desired.rubric,
    minimumAnswerRequirement: desired.minimumAnswerRequirement,
    tags: [...new Set([...generated.tags, 'stage3-wave-b-quality-closure'])].sort(),
  }, now);
  const validation = await validateStructuredQuestionDraft(
    questionRepository,
    draftId,
    now,
    updated.revision,
  );
  if (!validation.passed) {
    throw new Error(`Stage 3 Wave B successor validation failed: ${spec.key}:${validation.issues.map((item) => item.code).join(',')}`);
  }
  await submitQuestionResourceForReview(
    questionRepository,
    draftId,
    now,
    [],
    'stage3-wave-b-content-operator',
  );
  const review = await reviewQuestionResourceDraft(questionRepository, {
    draftId,
    action: 'approve',
    reviewerId: 'product-owner-authorized-stage3-wave-b',
    notes: `批准 ${spec.actionCode} 最新质量策略收口；题干显式呈现评分动作，响应格式与作答负荷一致；维持 operation-only，acceptedSignals 不构成完整答案模板。`,
    now,
  });
  const frozen = await freezeQuestionResourceDraft(questionRepository, draftId, now);
  const linked = await linkFrozenResourceToObservationTask(questionRepository, observationRepository, {
    planId: plan.materialObservationPlanId,
    observationTaskPlanId: sourceLink.observationTaskPlanId,
    resourceVersionId: frozen.version.resourceVersionId,
    linkedAt: now,
  });
  if (linked.issues.length > 0 || linked.link.status !== 'active') {
    throw new Error(`Stage 3 Wave B successor link failed: ${spec.key}:${linked.issues.join(',')}`);
  }
  const draft = await requireDraft(questionRepository, draftId);
  const quality = createQualityArtifacts({
    draft,
    validation,
    material,
    materialAnchor: anchors[0],
    peerDrafts: [],
    review,
    version: frozen.version,
    now,
  });
  const finalReview = {
    ...review,
    qualityAssessmentBundleId: quality.bundle.bundleId,
    deterministicAssessmentId: quality.deterministic.assessmentId,
    semanticAssessmentId: quality.semantic.semanticAssessmentId,
    qualityMergeRuleVersion: quality.bundle.mergeRuleVersion,
    warningDecisions: quality.deterministic.warnings.map((warning) => ({
      warningDecisionId: `${draft.draftId}:${warning.code}:accepted`,
      draftId: draft.draftId,
      draftRevision: draft.revision,
      assessmentId: quality.deterministic.assessmentId,
      warningCode: warning.code,
      decision: 'accepted' as const,
      reviewedBy: 'product-owner-authorized-stage3-wave-b',
      reviewedAt: now,
    })),
  };

  const currentVersionIndex = data.questionResources.versions.findIndex((item) => (
    item.resourceVersionId === current.resourceVersionId
  ));
  const superseded = await questionRepository.getVersion(current.resourceVersionId);
  if (!superseded || superseded.status !== 'superseded') {
    throw new Error(`Stage 3 Wave B predecessor was not superseded: ${spec.key}`);
  }
  data.questionResources.versions[currentVersionIndex] = superseded;
  data.questionResources.drafts.push(draft);
  data.questionResources.validations.push(validation);
  data.questionResources.reviews.push(finalReview);
  data.questionResources.versions.push(frozen.version);
  data.questionResources.registryEntries[registryIndex] = frozen.registryEntry;
  data.materialObservations.links[sourceLinkIndex] = { ...sourceLink, status: 'superseded' };
  data.materialObservations.links.push(linked.link);
  data.questionQuality.deterministicAssessments.push(quality.deterministic);
  data.questionQuality.semanticAssessments.push(quality.semantic);
  data.questionQuality.assessmentBundles.push(quality.bundle);
  data.questionQuality.frozenQualityTraces.push(quality.trace);

  return reportFor(
    spec.key,
    spec.actionCode,
    material,
    frozen.version,
    plan.materialObservationPlanId,
    observationValidation.validationId,
    observationReview.reviewId,
    linked.link.resourceObservationLinkId,
    quality.trace.traceId,
  );
}

function reportFor(
  key: string,
  actionCode: RubricFeedbackActionCode,
  material: QuestionMaterialVersion,
  version: FrozenQuestionResourceVersion,
  materialObservationPlanId: string,
  materialObservationValidationId: string,
  materialObservationReviewId: string,
  resourceObservationLinkId: string,
  qualityTraceId: string,
): WrongAnswerStage3WaveBResourceReport {
  return {
    key,
    actionCode,
    materialVersionId: material.materialVersionId,
    resourceVersionId: version.resourceVersionId,
    draftId: version.sourceDraftId,
    validationId: version.validationId,
    reviewId: version.reviewId,
    materialObservationPlanId,
    materialObservationValidationId,
    materialObservationReviewId,
    resourceObservationLinkId,
    qualityTraceId,
    contentDigest: digest({ material, version }),
  };
}

async function requireDraft(
  repository: InMemoryQuestionResourceAdmissionRepository,
  draftId: string,
): Promise<StructuredQuestionDraft> {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Stage 3 Wave B Draft is missing: ${draftId}`);
  return draft;
}

async function requireValidation(
  repository: InMemoryQuestionResourceAdmissionRepository,
  validationId: string,
) {
  const validation = await repository.getValidation(validationId);
  if (!validation) throw new Error(`Stage 3 Wave B validation is missing: ${validationId}`);
  return validation;
}

function appendUnique<T, K extends keyof T>(
  collection: T[],
  value: T,
  key: K,
): void {
  if (collection.some((item) => item[key] === value[key])) {
    throw new Error(`Stage 3 Wave B identity collision: ${String(value[key])}`);
  }
  collection.push(cloneSharedFormalResourceValue(value));
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
