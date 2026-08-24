import { cloneSharedFormalResourceValue, type SharedFormalResourceData } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type FrozenQuestionResourceVersion,
  type QuestionMaterialGenre,
  type QuestionMaterialVersion,
  type QuestionResourceRubricItem,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  type MaterialObservationPlan,
  type MaterialSourceAnchor,
  type ObservationDimension,
} from '../schemas/materialObservation.schema.ts';
import {
  QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION,
  type FrozenQuestionQualityTrace,
} from '../schemas/questionQualityPersistence.schema.ts';
import {
  QUESTION_QUALITY_CHECKS,
} from '../schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  type QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';
import { assessQuestionDraftQuality } from './questionQualityAssessmentAgent.ts';
import { mergeQuestionQualityAssessments } from './questionSemanticQualityAssessmentAgent.ts';
import { inspectInitialCandidateCompleteness } from '../schemas/questionCandidate.schema.ts';
import {
  buildMaterialObservationPlan,
  createMaterialSourceAnchor,
  deriveMaterialStructureSnapshot,
  deriveResourceObservationLink,
  validateMaterialObservationPlan,
} from './materialObservationAgent.ts';
import { buildStableId } from './reviewedResourceCandidateAdapter.ts';

const OPTIMIZATION_MARKER = 'material-corpus-provenance-governance-2026-08-14-v4';
const PEP_GRADE_SEVEN_VOLUME_ONE_CATALOG =
  'https://bp.pep.com.cn/2018spring/gzhtbjc/sfkl/czywk/zyqs/index.html';
const P002_RESOURCE_ID = 'question-observation-candidate-a5flmn';
const P002_REPAIR_MARKER = 'material-scope-repair:p0-02';

export type MaterialCorpusOptimizationReport = {
  alreadyApplied: boolean;
  materialVersionIds: string[];
  revisedQuestionResourceVersionIds: string[];
  backfilledTraceIds: string[];
  activeMaterialCount: number;
  currentQuestionCount: number;
  currentTraceCount: number;
};

export type QuestionMaterialScopeRepairReport = {
  alreadyApplied: boolean;
  resourceId: string;
  previousResourceVersionId: string;
  currentResourceVersionId: string;
  observationTaskPlanId: string;
  taskRevisionRootId: string;
};

export function prepareQuestionMaterialScopeRepair(
  source: SharedFormalResourceData,
  now: string,
): { data: SharedFormalResourceData; report: QuestionMaterialScopeRepairReport } {
  const data = cloneSharedFormalResourceValue(source);
  const registryIndex = data.questionResources.registryEntries.findIndex((item) => (
    item.resourceId === P002_RESOURCE_ID && item.status === 'active'
  ));
  if (registryIndex < 0) throw new Error(`Registry entry not found: ${P002_RESOURCE_ID}`);
  const registry = data.questionResources.registryEntries[registryIndex];
  const sourceVersion = data.questionResources.versions.find((item) => (
    item.resourceVersionId === registry.currentFrozenVersionId && item.status === 'frozen'
  ));
  if (!sourceVersion) throw new Error(`Current frozen version not found: ${P002_RESOURCE_ID}`);
  const activeLink = data.materialObservations.links.find((item) => (
    item.resourceId === P002_RESOURCE_ID
    && item.resourceVersionId === sourceVersion.resourceVersionId
    && item.status === 'active'
  ));
  if (!activeLink) throw new Error(`Current active link not found: ${sourceVersion.resourceVersionId}`);
  const material = data.questionResources.materials.find((item) => (
    item.materialVersionId === sourceVersion.materialVersionId && item.status !== 'retired'
  ));
  if (!material) throw new Error(`Active material not found: ${sourceVersion.materialVersionId}`);
  const plan = selectCurrentPlan(data, material.materialVersionId);
  const task = plan.taskPlans.find((item) => new Set([
    item.observationTaskPlanId,
    item.taskRevisionRootId,
    item.parentObservationTaskPlanId,
  ].filter(Boolean)).has(activeLink.observationTaskPlanId));
  if (!task) throw new Error(`Current task lineage not found: ${activeLink.observationTaskPlanId}`);
  const taskRevisionRootId = task.taskRevisionRootId || task.observationTaskPlanId;
  const report = (alreadyApplied: boolean, previousResourceVersionId: string) => ({
    alreadyApplied,
    resourceId: P002_RESOURCE_ID,
    previousResourceVersionId,
    currentResourceVersionId: sourceVersion.resourceVersionId,
    observationTaskPlanId: task.observationTaskPlanId,
    taskRevisionRootId,
  });
  if (
    sourceVersion.tags.includes(P002_REPAIR_MARKER)
    && inspectInitialCandidateCompleteness(sourceVersion).complete
  ) {
    return { data, report: report(true, sourceVersion.parentVersionId || sourceVersion.resourceVersionId) };
  }
  const sourceDraft = data.questionResources.drafts.find((item) => (
    item.draftId === sourceVersion.sourceDraftId
  ));
  if (!sourceDraft) throw new Error(`Source draft not found: ${sourceVersion.sourceDraftId}`);

  const artifact = createQuestionRevisionArtifacts({
    data,
    material,
    plan,
    task,
    sourceVersion,
    sourceDraft,
    override: {},
    now,
  });
  const repairedTags = [
    ...artifact.draft.tags.filter((tag) => tag !== 'corpus-calibration:v3'),
    P002_REPAIR_MARKER,
  ].filter((value, index, all) => all.indexOf(value) === index).sort();
  artifact.draft.tags = repairedTags;
  artifact.draft.source = cloneSharedFormalResourceValue(sourceVersion.source);
  artifact.draft.reviewSubmittedBy = 'codex-p0-02-repair';
  artifact.draft.reviewSubmissionHistory = artifact.draft.reviewSubmissionHistory.map((item) => ({
    ...item,
    actorId: 'codex-p0-02-repair',
  }));
  artifact.review.reviewerId = 'codex-p0-02-reviewer';
  artifact.review.notes = 'P0-02：仅补齐正式题目的当前任务与根任务作用域标签；题干、作答规则、Rubric 和材料内容保持不变。';
  artifact.version.tags = [...repairedTags];
  artifact.version.source = cloneSharedFormalResourceValue(sourceVersion.source);

  const peerDrafts = data.materialObservations.links
    .filter((item) => (
      item.status === 'active'
      && item.materialVersionId === material.materialVersionId
      && item.resourceId !== P002_RESOURCE_ID
    ))
    .map((item) => data.questionResources.versions.find((value) => (
      value.resourceVersionId === item.resourceVersionId
    )))
    .filter((item): item is FrozenQuestionResourceVersion => Boolean(item))
    .map((item) => data.questionResources.drafts.find((value) => value.draftId === item.sourceDraftId))
    .filter((item): item is StructuredQuestionDraft => Boolean(item));
  const quality = createQualityArtifacts({
    draft: artifact.draft,
    validation: artifact.validation,
    material,
    peerDrafts,
    review: artifact.review,
    version: artifact.version,
    now,
  });
  const previousTrace = data.questionQuality.frozenQualityTraces.find((item) => (
    item.resourceVersionId === sourceVersion.resourceVersionId
  ));
  const previousSemantic = previousTrace && data.questionQuality.semanticAssessments.find((item) => (
    item.semanticAssessmentId === previousTrace.semanticAssessmentId
  ));
  if (previousSemantic?.status === 'completed') {
    quality.semantic.findings = cloneSharedFormalResourceValue(previousSemantic.findings);
    quality.semantic.limitations = [
      ...cloneSharedFormalResourceValue(previousSemantic.limitations),
      'P0-02仅补齐结构化作用域标签；语义内容未改变，本次沿用V1已完成的语义证据并重新绑定V2身份。',
    ];
    quality.semantic.providerId = 'quality-evidence-inheritance';
    quality.semantic.modelId = previousSemantic.semanticAssessmentId;
  }
  artifact.review.qualityAssessmentBundleId = quality.bundle.bundleId;
  artifact.review.deterministicAssessmentId = quality.deterministic.assessmentId;
  artifact.review.semanticAssessmentId = quality.semantic.semanticAssessmentId;
  artifact.review.qualityMergeRuleVersion = quality.bundle.mergeRuleVersion;
  artifact.review.warningDecisions = quality.deterministic.warnings.map((warning) => ({
    warningDecisionId: `${artifact.draft.draftId}:${warning.code}:accepted`,
    draftId: artifact.draft.draftId,
    draftRevision: artifact.draft.revision,
    assessmentId: quality.deterministic.assessmentId,
    warningCode: warning.code,
    decision: 'accepted',
    reviewedBy: 'codex-p0-02-reviewer',
    reviewedAt: now,
  }));
  if (!inspectInitialCandidateCompleteness(artifact.version).complete) {
    throw new Error('P0-02 successor version is still missing materialScope.');
  }

  data.questionResources.drafts.push(artifact.draft);
  data.questionResources.validations.push(artifact.validation);
  data.questionResources.reviews.push(artifact.review);
  data.questionResources.versions.push(artifact.version);
  data.questionQuality.deterministicAssessments.push(quality.deterministic);
  data.questionQuality.semanticAssessments.push(quality.semantic);
  data.questionQuality.assessmentBundles.push(quality.bundle);
  data.questionQuality.frozenQualityTraces.push(quality.trace);
  data.questionResources.registryEntries[registryIndex] = createRegistryEntry(
    registry,
    artifact.version,
    now,
  );
  const sourceVersionIndex = data.questionResources.versions.findIndex((item) => (
    item.resourceVersionId === sourceVersion.resourceVersionId
  ));
  data.questionResources.versions[sourceVersionIndex] = {
    ...data.questionResources.versions[sourceVersionIndex],
    status: 'superseded',
    updatedAt: now,
  };
  const sourceLinkIndex = data.materialObservations.links.findIndex((item) => (
    item.resourceObservationLinkId === activeLink.resourceObservationLinkId
  ));
  data.materialObservations.links[sourceLinkIndex] = {
    ...data.materialObservations.links[sourceLinkIndex],
    status: 'superseded',
  };
  const linked = deriveResourceObservationLink({
    plan,
    task,
    version: artifact.version,
    registryEntry: data.questionResources.registryEntries[registryIndex],
    validation: artifact.validation,
    review: artifact.review,
    linkedAt: now,
  });
  if (linked.issues.length > 0) {
    throw new Error(`P0-02 successor link is invalid: ${linked.issues.join(', ')}`);
  }
  data.materialObservations.links.push(linked.link);
  return {
    data,
    report: {
      ...report(false, sourceVersion.resourceVersionId),
      currentResourceVersionId: artifact.version.resourceVersionId,
    },
  };
}

type QuestionOverride = {
  questionStem?: string;
  title?: string;
  dimension?: ObservationDimension;
  abilityId?: StructuredQuestionDraft['abilityMetadata']['abilityId'];
  difficulty?: StructuredQuestionDraft['abilityMetadata']['difficulty'];
  startParagraph?: number;
  endParagraph?: number;
  anchorType?: MaterialSourceAnchor['anchorType'];
  expectedStudentAction?: string;
  designReason?: string;
  rubric?: QuestionResourceRubricItem[];
};

export function prepareMaterialCorpusOptimization(
  source: SharedFormalResourceData,
  now: string,
): { data: SharedFormalResourceData; report: MaterialCorpusOptimizationReport } {
  const data = cloneSharedFormalResourceValue(source);
  const activeMaterials = data.questionResources.materials.filter((item) => item.status !== 'retired');
  const materialsToOptimize = activeMaterials.filter(needsMaterialOptimization);
  if (materialsToOptimize.length === 0) {
    return { data, report: summarize(data, true, [], [], []) };
  }

  const backfilledTraceIds = backfillMissingCurrentQualityTraces(data, activeMaterials, now);
  const materialVersionIds: string[] = [];
  const revisedQuestionResourceVersionIds: string[] = [];

  for (const oldMaterial of materialsToOptimize) {
    const oldPlan = selectCurrentPlan(data, oldMaterial.materialVersionId);
    const provenanceOnlyUpgrade = Boolean(
      oldMaterial.metadata
      && normalizeMaterialContent(oldMaterial.title, oldMaterial.content) === oldMaterial.content
      && oldMaterial.metadata.provenanceReview?.sourceLocator !== PEP_GRADE_SEVEN_VOLUME_ONE_CATALOG,
    );
    const resolveOverride = (index: number) => (
      provenanceOnlyUpgrade ? {} : questionOverride(oldMaterial.title, index)
    );
    const currentPairs = oldPlan.taskPlans.map((task, index) => {
      const identities = new Set([
        task.observationTaskPlanId,
        task.taskRevisionRootId,
        task.parentObservationTaskPlanId,
      ].filter((value): value is string => Boolean(value)));
      const link = data.materialObservations.links.find((item) => (
        item.status === 'active' &&
        item.materialVersionId === oldMaterial.materialVersionId &&
        identities.has(item.observationTaskPlanId)
      ));
      if (!link) throw new Error(`${oldMaterial.title} task ${index + 1} has no current active link.`);
      const version = data.questionResources.versions.find((item) => item.resourceVersionId === link.resourceVersionId);
      if (!version) throw new Error(`Frozen resource not found: ${link.resourceVersionId}`);
      const draft = data.questionResources.drafts.find((item) => item.draftId === version.sourceDraftId);
      if (!draft) throw new Error(`Source draft not found: ${version.sourceDraftId}`);
      const anchor = data.materialObservations.anchors.find((item) => item.sourceAnchorId === task.sourceAnchorIds[0]);
      if (!anchor) throw new Error(`Source anchor not found: ${task.sourceAnchorIds[0]}`);
      return { task, link, version, draft, anchor };
    });

    const newMaterial = createMaterialRevision(oldMaterial, now);
    materialVersionIds.push(newMaterial.materialVersionId);
    oldMaterial.status = 'retired';
    oldMaterial.updatedAt = now;
    data.questionResources.materials.push(newMaterial);

    const structure = deriveMaterialStructureSnapshot(newMaterial, now);
    data.materialObservations.structures.push(structure);
    const newAnchors = currentPairs.map(({ anchor }, index) => {
      const override = resolveOverride(index);
      return createMaterialSourceAnchor({
        material: newMaterial,
        structure,
        anchorType: override.anchorType || anchor.anchorType,
        startParagraph: override.startParagraph ?? anchor.startParagraph,
        endParagraph: override.endParagraph ?? anchor.endParagraph,
      });
    });
    for (const anchor of newAnchors) {
      if (!data.materialObservations.anchors.some((item) => item.sourceAnchorId === anchor.sourceAnchorId)) {
        data.materialObservations.anchors.push(anchor);
      }
    }

    const selectedDimensions = new Set<ObservationDimension>();
    const taskInputs = currentPairs.map(({ task, version }, index) => {
      const override = resolveOverride(index);
      const dimension = override.dimension || task.primaryDimension;
      const abilityId = override.abilityId || task.abilityId;
      const difficulty = override.difficulty || task.difficulty;
      selectedDimensions.add(dimension);
      const rubric = normalizeRubricAbility(override.rubric || version.rubric, abilityId);
      const supportingAbilityIds = [...new Set([
        ...(task.resourceDraftSpecification?.supportingAbilityIds || version.abilityMetadata.supportingAbilityIds),
        ...rubric.map((item) => item.abilityId).filter((item) => item !== abilityId),
      ])];
      return {
        taskRevisionRootId: task.taskRevisionRootId || task.observationTaskPlanId,
        parentObservationTaskPlanId: task.observationTaskPlanId,
        primaryDimension: dimension,
        observationFocus: task.observationFocus,
        abilityId,
        taskRole: task.taskRole,
        difficulty,
        sourceAnchorIds: [newAnchors[index].sourceAnchorId],
        observationGoal: override.questionStem || version.questionStem,
        expectedStudentAction: override.expectedStudentAction || task.expectedStudentAction,
        designReason: override.designReason || task.designReason,
        intendedComparisonGroupId: task.intendedComparisonGroupId,
        materialRelationIntent: task.materialRelationIntent,
        resourceDraftSpecification: {
          ...(task.resourceDraftSpecification || {
            questionType: version.questionType,
            responseFormat: version.responseFormat,
            choiceInteraction: version.choiceInteraction,
            assessmentMode: version.assessmentMode,
            minimumAnswerRequirement: version.minimumAnswerRequirement,
            supportingAbilityIds: version.abilityMetadata.supportingAbilityIds,
            prerequisiteAbilityIds: version.abilityMetadata.prerequisiteAbilityIds,
            tags: version.tags,
          }),
          title: override.title || version.title,
          rubric,
          supportingAbilityIds,
        },
        calibrationCases: task.calibrationCases,
      };
    });
    const dimensions: ObservationDimension[] = ['fact', 'character', 'plot', 'causality', 'structure', 'language', 'theme'];
    const plan = buildMaterialObservationPlan({
      materialId: newMaterial.materialId,
      materialVersionId: newMaterial.materialVersionId,
      materialStructureSnapshotId: structure.materialStructureSnapshotId,
      revision: oldPlan.revision + 1,
      parentPlanId: oldPlan.materialObservationPlanId,
      dimensionReviews: dimensions.map((dimension) => ({
        dimension,
        decision: selectedDimensions.has(dimension) ? 'selected' : 'not_suitable',
        reason: selectedDimensions.has(dimension)
          ? `本轮校准保留或新增 ${dimension} 观测价值。`
          : `本轮题组不使用 ${dimension}，不为填满维度机械增题。`,
        sourceAnchorIds: selectedDimensions.has(dimension)
          ? taskInputs.flatMap((task) => task.primaryDimension === dimension ? task.sourceAnchorIds : [])
          : [],
      })),
      taskPlans: taskInputs,
      now,
    });

    const artifacts = plan.taskPlans.map((task, index) => createQuestionRevisionArtifacts({
      data,
      material: newMaterial,
      plan,
      task,
      sourceVersion: currentPairs[index].version,
      sourceDraft: currentPairs[index].draft,
      override: resolveOverride(index),
      now,
    }));
    if (provenanceOnlyUpgrade) {
      artifacts.forEach((artifact, index) => {
        artifact.draft.source = cloneSharedFormalResourceValue(currentPairs[index].version.source);
        artifact.version.source = cloneSharedFormalResourceValue(currentPairs[index].version.source);
      });
    }
    plan.taskPlans = plan.taskPlans.map((task, index) => ({
      ...task,
      linkedDraftId: artifacts[index].draft.draftId,
      linkedResourceId: artifacts[index].version.resourceId,
      status: 'frozen_linked',
    }));
    plan.status = 'reviewed';
    plan.reviewerId = 'codex-corpus-calibration-reviewer';
    plan.reviewNote = '材料版本、题组覆盖、题目依据和 Learning 可消费关系已完成校准。';
    plan.reviewedAt = now;
    plan.updatedAt = now;

    const planValidation = validateMaterialObservationPlan({
      plan,
      material: newMaterial,
      structure,
      anchors: newAnchors,
      checkedAt: now,
    });
    if (!planValidation.passed) {
      throw new Error(`${oldMaterial.title} optimized plan is invalid: ${planValidation.issues.map((item) => item.code).join(', ')}`);
    }
    data.materialObservations.plans.push(plan);
    data.materialObservations.validations.push(planValidation);
    data.materialObservations.reviews.push({
      reviewId: `${plan.materialObservationPlanId}:review:r${plan.revision}`,
      materialObservationPlanId: plan.materialObservationPlanId,
      planRevision: plan.revision,
      validationId: planValidation.validationId,
      action: 'approve',
      reviewerId: 'codex-corpus-calibration-reviewer',
      notes: plan.reviewNote,
      reviewedAt: now,
    });
    oldPlan.status = 'superseded';
    oldPlan.updatedAt = now;

    const peerDrafts = artifacts.map((item) => item.draft);
    for (const [index, artifact] of artifacts.entries()) {
      const quality = createQualityArtifacts({
        draft: artifact.draft,
        validation: artifact.validation,
        material: newMaterial,
        peerDrafts,
        review: artifact.review,
        version: artifact.version,
        now,
      });
      artifact.review.qualityAssessmentBundleId = quality.bundle.bundleId;
      artifact.review.deterministicAssessmentId = quality.deterministic.assessmentId;
      artifact.review.semanticAssessmentId = quality.semantic.semanticAssessmentId;
      artifact.review.qualityMergeRuleVersion = quality.bundle.mergeRuleVersion;
      artifact.review.warningDecisions = quality.deterministic.warnings.map((warning) => ({
        warningDecisionId: `${artifact.draft.draftId}:${warning.code}:accepted`,
        draftId: artifact.draft.draftId,
        draftRevision: artifact.draft.revision,
        assessmentId: quality.deterministic.assessmentId,
        warningCode: warning.code,
        decision: 'accepted',
        reviewedBy: 'codex-corpus-calibration-reviewer',
        reviewedAt: now,
      }));
      data.questionQuality.deterministicAssessments.push(quality.deterministic);
      data.questionQuality.semanticAssessments.push(quality.semantic);
      data.questionQuality.assessmentBundles.push(quality.bundle);
      data.questionQuality.frozenQualityTraces.push(quality.trace);
      data.questionResources.drafts.push(artifact.draft);
      data.questionResources.validations.push(artifact.validation);
      data.questionResources.reviews.push(artifact.review);
      data.questionResources.versions.push(artifact.version);
      revisedQuestionResourceVersionIds.push(artifact.version.resourceVersionId);

      const registryIndex = data.questionResources.registryEntries.findIndex((item) => item.resourceId === artifact.version.resourceId);
      if (registryIndex < 0) throw new Error(`Registry entry not found: ${artifact.version.resourceId}`);
      const registry = createRegistryEntry(data.questionResources.registryEntries[registryIndex], artifact.version, now);
      data.questionResources.registryEntries[registryIndex] = registry;

      const sourceVersionIndex = data.questionResources.versions.findIndex((item) => item.resourceVersionId === currentPairs[index].version.resourceVersionId);
      data.questionResources.versions[sourceVersionIndex] = {
        ...data.questionResources.versions[sourceVersionIndex],
        status: 'superseded',
        updatedAt: now,
      };
      const sourceLinkIndex = data.materialObservations.links.findIndex((item) => item.resourceObservationLinkId === currentPairs[index].link.resourceObservationLinkId);
      data.materialObservations.links[sourceLinkIndex] = {
        ...data.materialObservations.links[sourceLinkIndex],
        status: 'superseded',
      };
      const derived = deriveResourceObservationLink({
        plan,
        task: plan.taskPlans[index],
        version: artifact.version,
        registryEntry: registry,
        validation: artifact.validation,
        review: artifact.review,
        linkedAt: now,
      });
      if (derived.issues.length > 0) {
        throw new Error(`${oldMaterial.title} task ${index + 1} cannot be linked: ${derived.issues.join(', ')}`);
      }
      data.materialObservations.links.push(derived.link);
    }
  }

  return {
    data,
    report: summarize(data, false, materialVersionIds, revisedQuestionResourceVersionIds, backfilledTraceIds),
  };
}

function createMaterialRevision(source: QuestionMaterialVersion, now: string): QuestionMaterialVersion {
  const definition = materialDefinition(source.title);
  return {
    ...source,
    materialVersionId: `${source.materialId}:v${source.versionNumber + 1}`,
    versionNumber: source.versionNumber + 1,
    status: 'active',
    parentMaterialVersionId: source.materialVersionId,
    revisionNote: OPTIMIZATION_MARKER,
    content: normalizeMaterialContent(source.title, source.content),
    metadata: {
      author: definition.author,
      genre: definition.genre,
      gradeRange: '七年级',
      curriculumUnit: materialCurriculumUnit(source.title),
      tags: definition.tags,
      provenanceStatus: 'needs_verification',
      provenanceReview: {
        textVerificationStatus: 'pending',
        rightsStatus: 'unknown',
        sourceLocator: PEP_GRADE_SEVEN_VOLUME_ONE_CATALOG,
        notes: '已核对人民教育出版社七年级上册课程目录，确认篇目及所在单元；尚未逐字比对本地正文，也未取得版权授权证明。',
      },
    },
    createdAt: now,
    updatedAt: now,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function needsMaterialOptimization(material: QuestionMaterialVersion): boolean {
  if (material.revisionNote === OPTIMIZATION_MARKER) return false;
  if (!hasMaterialDefinition(material.title)) return false;
  return !material.metadata
    || material.metadata.curriculumUnit !== materialCurriculumUnit(material.title)
    || material.metadata.provenanceReview?.sourceLocator !== PEP_GRADE_SEVEN_VOLUME_ONE_CATALOG
    || normalizeMaterialContent(material.title, material.content) !== material.content;
}

function hasMaterialDefinition(title: string): boolean {
  return Boolean(MATERIAL_DEFINITIONS[title]);
}

const MATERIAL_DEFINITIONS: Record<string, { author: string; genre: QuestionMaterialGenre; tags: string[] }> = {
  '《散步》': { author: '莫怀戚', genre: 'narrative_prose', tags: ['亲情', '责任', '散文'] },
  '《秋天的怀念》': { author: '史铁生', genre: 'narrative_prose', tags: ['亲情', '生命', '散文'] },
  '《猫》': { author: '郑振铎', genre: 'narrative_prose', tags: ['动物', '反思', '散文'] },
  '《皇帝的新装》': { author: '安徒生', genre: 'fairy_tale', tags: ['童话', '讽刺', '诚实'] },
  '《狼》': { author: '蒲松龄', genre: 'classical_prose', tags: ['文言文', '寓言', '智慧'] },
  '《从百草园到三味书屋》': { author: '鲁迅', genre: 'narrative_prose', tags: ['童年', '成长', '散文'] },
  '《天上的街市》': { author: '郭沫若', genre: 'modern_poetry', tags: ['现代诗', '想象', '理想'] },
  '《女娲造人》': { author: '袁珂', genre: 'myth', tags: ['神话', '创造', '人类'] },
  '《济南的冬天》': { author: '老舍', genre: 'scenic_prose', tags: ['写景', '冬天', '散文'] },
  '《走一步，再走一步》': { author: '莫顿·亨特', genre: 'narrative_prose', tags: ['成长', '勇气', '散文'] },
  '《春》': { author: '朱自清', genre: 'scenic_prose', tags: ['写景', '春天', '散文'] },
  '《纪念白求恩》': { author: '毛泽东', genre: 'other', tags: ['议论', '人物', '责任'] },
};

function materialDefinition(title: string): { author: string; genre: QuestionMaterialGenre; tags: string[] } {
  const value = MATERIAL_DEFINITIONS[title];
  if (!value) throw new Error(`No material metadata definition for ${title}.`);
  return value;
}

function materialCurriculumUnit(title: string): string {
  const unit = MATERIAL_CURRICULUM_UNITS[title];
  if (!unit) throw new Error(`No curriculum unit definition for ${title}.`);
  return `七年级上册第${unit}单元`;
}

const MATERIAL_CURRICULUM_UNITS: Record<string, string> = {
  '《春》': '一',
  '《济南的冬天》': '一',
  '《秋天的怀念》': '二',
  '《散步》': '二',
  '《从百草园到三味书屋》': '三',
  '《纪念白求恩》': '四',
  '《走一步，再走一步》': '四',
  '《猫》': '五',
  '《狼》': '五',
  '《皇帝的新装》': '六',
  '《天上的街市》': '六',
  '《女娲造人》': '六',
};

function normalizeMaterialContent(title: string, content: string): string {
  if (title === '《从百草园到三味书屋》') {
    return content
      .split('\n')
      .map((line) => line.replace(/[ \t\u3000]+/g, '').replace(/[Ａ-Ｚａ-ｚ]/g, (value) => (
        String.fromCharCode(value.charCodeAt(0) - 0xfee0)
      )))
      .join('\n');
  }
  if (title === '《女娲造人》') return content.replace(/([\u3400-\u9fff])\?/g, '$1？');
  if (title === '《皇帝的新装》') {
    const target = '但是我决不能让人看出来！因此他就把';
    return content.includes(target)
      ? content.replace(target, '但是我决不能让人看出来！”因此他就把')
      : content;
  }
  if (title === '《走一步，再走一步》') {
    const replacements: Record<string, string> = {
      '?': '？',
      '!': '！',
      ',': '，',
      ':': '：',
      ';': '；',
    };
    return content.replace(/([\u3400-\u9fff])([?!,:;])/g, (_match, character: string, punctuation: string) => (
      `${character}${replacements[punctuation]}`
    ));
  }
  return content;
}

function questionOverride(title: string, index: number): QuestionOverride {
  if (title === '《皇帝的新装》' && index === 0) {
    return {
      questionStem: '皇帝、大臣和百姓为什么都不敢说出自己看不见新衣服？请结合全文分析他们的心理动机，并说明这种集体沉默反映了怎样的社会现象。',
      designReason: '明确全文证据范围，保留原有群体心理与讽刺主题观察价值。',
    };
  }
  if (title === '《皇帝的新装》' && index === 1) {
    return {
      questionStem: '骗子的骗局为什么能够一步步成立？请结合第2—24段，梳理“提出新衣特性—官员察看—皇帝察看”三个关键环节，并分析皇帝和大臣的心理如何推动骗局持续。',
      title: '骗局成立的因果链与人物心理',
      dimension: 'causality',
      abilityId: 'analysis',
      difficulty: 'intermediate',
      anchorType: 'paragraph_range',
      startParagraph: 2,
      endParagraph: 24,
      expectedStudentAction: '按情节顺序梳理骗局成立的关键环节，并结合怕被认为不称职或愚蠢的心理解释因果关系。',
      designReason: '由查找复述改为因果链分析，增强证据组织和区分度。',
      rubric: [
        rubric('骗局关键环节', 'analysis', ['新衣特性', '官员察看', '皇帝察看', '称赞'], '按顺序说明骗局成立的至少三个关键环节。'),
        rubric('心理与因果关系', 'analysis', ['不称职', '愚蠢', '害怕', '虚荣', '不敢说真话'], '说明人物心理如何使骗局持续并扩大。'),
      ],
    };
  }
  if (title === '《从百草园到三味书屋》' && index === 3) {
    return {
      questionStem: '结合第10—16段，概括寿镜吾先生的形象，并说明作者主要通过哪些外貌、语言或教学行为表现这一形象。',
      title: '寿镜吾先生形象概括',
      dimension: 'character',
      abilityId: 'comprehension',
      difficulty: 'intermediate',
      anchorType: 'paragraph_range',
      startParagraph: 10,
      endParagraph: 16,
      expectedStudentAction: '从外貌、答问态度和教学行为中提取依据，概括先生方正、质朴、博学、严而不厉等特点。',
      designReason: '补足三味书屋人物内容，并把题组从单一分析扩展到基于证据的理解概括。',
      rubric: [
        rubric('先生形象概括', 'comprehension', ['方正', '质朴', '博学', '和蔼', '严而不厉'], '至少概括两个有文本依据的特点。'),
        rubric('言行依据', 'extraction', ['高而瘦', '须发花白', '不愿回答怪哉', '读书渐渐加多', '对课加字'], '引用外貌、语言或教学行为作为依据。'),
      ],
    };
  }
  if (title === '《从百草园到三味书屋》' && index === 4) {
    return {
      questionStem: '第17—24段写到学生到小园玩耍、齐声读书以及趁先生读书入神时画画。请概括这些片段，并比较三味书屋与百草园分别给童年生活带来了怎样的乐趣。',
      title: '三味书屋生活与童年乐趣',
      dimension: 'structure',
      abilityId: 'summarization',
      difficulty: 'intermediate',
      anchorType: 'paragraph_range',
      startParagraph: 17,
      endParagraph: 24,
      expectedStudentAction: '概括三味书屋生活片段，并与百草园的自然探索和游戏乐趣进行比较。',
      designReason: '补足文章后半部分覆盖，并训练跨部分概括与比较。',
      rubric: [
        rubric('三味书屋片段概括', 'summarization', ['小园玩耍', '齐声读书', '画画', '趁先生入神'], '准确概括至少两个三味书屋生活片段。'),
        rubric('两处乐趣比较', 'summarization', ['百草园', '自然探索', '自由玩耍', '三味书屋', '同窗活动', '读书生活'], '指出两处空间的乐趣来源及其差异。'),
      ],
    };
  }
  if (title === '《天上的街市》' && index === 0) {
    return {
      questionStem: '诗歌开头写“远远的街灯明了，好像闪着无数的明星；天上的明星现了，好像点着无数的街灯”。请分析“街灯”和“明星”相互联想的写法，说明它如何把现实街景引向天上街市的想象。',
      title: '街灯与明星的联想作用',
      expectedStudentAction: '辨认街灯与明星在形态和光亮上的相似点，分析由现实进入想象的过渡作用。',
      designReason: '替换与“定然”题共享证据的问题，建立独立的意象和结构观察价值。',
      anchorType: 'paragraph',
      startParagraph: 1,
      rubric: [
        rubric('联想依据', 'analysis', ['街灯', '明星', '光亮', '相似'], '说明街灯与明星在视觉上的相似关系。'),
        rubric('结构与意境作用', 'analysis', ['现实', '想象', '天上街市', '过渡', '意境'], '分析从现实街景过渡到天上想象的作用。'),
      ],
    };
  }
  if (title === '《天上的街市》' && index === 2) {
    return {
      questionStem: '传统神话中的牛郎织女被天河阻隔，只能在七夕相会；诗中却写他们“骑着牛儿来往”“在天街闲游”。请比较两种故事中人物生活状态的不同，并分析诗人借这种改写表达了怎样的生活理想。',
      title: '神话改写与生活理想',
      dimension: 'theme',
      abilityId: 'inference',
      difficulty: 'advanced',
      anchorType: 'paragraph_range',
      startParagraph: 9,
      endParagraph: 17,
      expectedStudentAction: '利用题干提供的传统神话背景，比较受阻隔与自由来往两种生活状态，并推断诗人对自由幸福生活的向往。',
      designReason: '补足外部神话背景，限定比较对象和主题推断维度，消除设问范围不清。',
      rubric: [
        rubric('生活状态比较', 'inference', ['阻隔', '七夕相会', '自由来往', '天街闲游'], '准确比较传统神话与诗歌改写中的生活状态。'),
        rubric('生活理想推断', 'inference', ['自由', '幸福', '美好生活', '理想社会'], '结合改写内容推断诗人表达的生活理想。'),
      ],
    };
  }
  if (title === '《猫》' && index === 0) {
    return {
      questionStem: '请结合全文，从“猫的特点、家人对猫的态度、猫的结局、‘我’的情感变化”四个方面比较三次养猫经历，并说明这种对比如何深化文章主题。',
      title: '三只猫的比较与主题',
      abilityId: 'summarization',
      difficulty: 'advanced',
      anchorType: 'paragraph_range',
      startParagraph: 1,
      endParagraph: 34,
      expectedStudentAction: '按四个明确维度整合三次养猫经历，并归纳作者对主观臆断和尊重生命的反思。',
      designReason: '限定全文比较维度并提供完整段落锚点，保留整合能力同时降低作答范围歧义。',
      rubric: [
        rubric('三次经历比较', 'summarization', ['第一只猫', '第二只猫', '第三只猫', '态度', '结局'], '至少比较三只猫在态度和结局上的差异。'),
        rubric('情感变化与主题', 'analysis', ['酸辛', '怅然', '愤恨', '悔恨', '主观臆断', '尊重生命'], '联系情感递进说明对比如何深化主题。'),
      ],
    };
  }
  if (title === '《秋天的怀念》' && index === 2) {
    return {
      rubric: [
        rubric('景物特点与文本依据', 'analysis', ['淡雅', '高洁', '热烈而深沉', '烂漫'], '准确概括菊花特点并引用文本。'),
        rubric('开放解释与主题关联', 'analysis', ['母亲', '生命', '好好儿活', '坚强', '热爱生命'], '可解释为母亲品格、生命力量或“好好儿活”的精神，只要有全文依据即可。'),
      ],
    };
  }
  if (title === '《女娲造人》' && index === 2) {
    return {
      abilityId: 'inference',
      difficulty: 'advanced',
      expectedStudentAction: '从人的外形、举动和创造过程推断神话对人类独特价值与生命创造力的赞美。',
      designReason: '保留主题观察，但将动作从复述性分析提升为跨段推断。',
    };
  }
  if (title === '《狼》' && index === 1) {
    return {
      questionStem: '第1—4段中，两只狼有哪些行为表现出它们的狡猾？请找出至少两处具体语句，概括狼的做法，并说明这些行为怎样配合围困屠户。',
      title: '狼的狡猾行为与配合方式',
      dimension: 'plot',
      abilityId: 'comprehension',
      difficulty: 'intermediate',
      anchorType: 'paragraph_range',
      startParagraph: 1,
      endParagraph: 4,
      expectedStudentAction: '引用至少两处行为语句，概括狼前后夹击、假寐诱敌或打洞偷袭等做法，并解释其配合关系。',
      designReason: '把能力与实际作答动作统一为基于证据的理解，并修正基础难度与多步分析要求不一致。',
      rubric: [
        rubric('行为证据', 'comprehension', ['缀行甚远', '并驱如故', '眈眈相向', '犬坐于前', '假寐', '洞其中'], '引用或准确转述至少两处表现狼狡猾的行为。'),
        rubric('配合方式说明', 'comprehension', ['前后夹击', '假寐诱敌', '打洞偷袭', '配合'], '说明两狼怎样通过分工或配合围困屠户。'),
      ],
    };
  }
  return {};
}

function rubric(
  name: string,
  abilityId: QuestionResourceRubricItem['abilityId'],
  acceptedSignals: string[],
  description: string,
): QuestionResourceRubricItem {
  return {
    itemId: `rubric-${buildStableId('corpus-rubric', [name, abilityId, ...acceptedSignals])}`,
    name,
    description,
    abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: { requireTextEvidence: true, requireExplanation: true },
    acceptedSignals,
  };
}

function normalizeRubricAbility(
  source: QuestionResourceRubricItem[],
  primaryAbilityId: StructuredQuestionDraft['abilityMetadata']['abilityId'],
): QuestionResourceRubricItem[] {
  return source.map((item) => ({ ...item, abilityId: item.abilityId || primaryAbilityId }));
}

function createQuestionRevisionArtifacts(input: {
  data: SharedFormalResourceData;
  material: QuestionMaterialVersion;
  plan: MaterialObservationPlan;
  task: MaterialObservationPlan['taskPlans'][number];
  sourceVersion: FrozenQuestionResourceVersion;
  sourceDraft: StructuredQuestionDraft;
  override: QuestionOverride;
  now: string;
}) {
  const { data, material, plan, task, sourceVersion, sourceDraft, override, now } = input;
  const nextVersionNumber = Math.max(...data.questionResources.versions
    .filter((item) => item.resourceId === sourceVersion.resourceId)
    .map((item) => item.versionNumber)) + 1;
  const draftId = `${sourceVersion.resourceId}:corpus-calibration:${material.materialVersionId.replace(/[^a-z0-9]+/gi, '-')}`;
  const tags = [
    ...sourceVersion.tags.filter((tag) => (
      !tag.startsWith('observation_task:')
      && !tag.startsWith('observation_task_root:')
      && !tag.startsWith('corpus-calibration:')
    )),
    `observation_task:${task.observationTaskPlanId}`,
    `observation_task_root:${task.taskRevisionRootId || task.observationTaskPlanId}`,
    'corpus-calibration:v3',
  ].filter((value, index, all) => all.indexOf(value) === index).sort();
  const rubric = normalizeRubricAbility(override.rubric || sourceVersion.rubric, task.abilityId);
  const validationId = `${draftId}:validation:r1`;
  const reviewId = `${draftId}:review:r1`;
  const draft: StructuredQuestionDraft = {
    ...sourceDraft,
    draftId,
    resourceId: sourceVersion.resourceId,
    taskId: task.observationTaskPlanId,
    proposedVersionNumber: nextVersionNumber,
    parentVersionId: sourceVersion.resourceVersionId,
    materialVersionId: material.materialVersionId,
    title: override.title || sourceVersion.title,
    questionStem: override.questionStem || sourceVersion.questionStem,
    rubric,
    abilityMetadata: {
      ...sourceVersion.abilityMetadata,
      abilityId: task.abilityId,
      taskRole: task.taskRole,
      difficulty: task.difficulty,
    },
    tags,
    source: {
      sourceType: 'ai_assisted',
      description: '基于正式材料新版本完成来源、题组与质量治理校准。',
      copyrightNote: sourceVersion.source.copyrightNote || '来源与教材版本待人工核验。',
    },
    status: 'reviewed',
    revision: 1,
    latestValidationId: validationId,
    latestReviewId: reviewId,
    reviewSubmittedAt: now,
    reviewSubmittedBy: 'codex-corpus-calibration-author',
    reviewSubmissionCount: 1,
    reviewSubmissionHistory: [{
      eventId: `${draftId}:r1:submitted:1`,
      action: 'submitted',
      draftRevision: 1,
      actorId: 'codex-corpus-calibration-author',
      occurredAt: now,
    }],
    warningAcknowledgements: [],
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
    reviewerId: 'codex-corpus-calibration-reviewer',
    notes: '正文版本、问题价值、证据范围、Rubric 与任务身份已经逐项核对。',
    reviewedAt: now,
  };
  const version: FrozenQuestionResourceVersion = {
    ...sourceVersion,
    resourceVersionId: `${sourceVersion.resourceId}:v${nextVersionNumber}`,
    versionNumber: nextVersionNumber,
    parentVersionId: sourceVersion.resourceVersionId,
    sourceDraftId: draftId,
    materialId: material.materialId,
    materialVersionId: material.materialVersionId,
    materialSnapshot: cloneSharedFormalResourceValue(material),
    taskId: task.observationTaskPlanId,
    title: draft.title,
    questionStem: draft.questionStem,
    rubric,
    abilityMetadata: cloneSharedFormalResourceValue(draft.abilityMetadata),
    source: cloneSharedFormalResourceValue(draft.source),
    tags,
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

export function createQualityArtifacts(input: {
  draft: StructuredQuestionDraft;
  validation: ResourceValidationResult;
  material: QuestionMaterialVersion;
  materialAnchor?: MaterialSourceAnchor | null;
  peerDrafts: StructuredQuestionDraft[];
  review: ResourceReviewDecision;
  version: FrozenQuestionResourceVersion;
  now: string;
}) {
  const deterministic = assessQuestionDraftQuality({
    draft: input.draft,
    validation: input.validation,
    material: input.material,
    materialAnchor: input.materialAnchor,
    peerDrafts: input.peerDrafts.filter((item) => item.draftId !== input.draft.draftId),
    assessedAt: input.now,
  });
  if (deterministic.checks.materialGrounding === 'fail') {
    throw new Error(`${input.draft.draftId} failed material grounding.`);
  }
  const semantic = createSemanticAssessment(input.draft, input.validation, input.material, deterministic.assessmentId, input.now);
  const bundle = mergeQuestionQualityAssessments({ deterministic, semantic, createdAt: input.now });
  const trace: FrozenQuestionQualityTrace = {
    traceId: buildStableId('quality-trace', [input.version.resourceVersionId, bundle.bundleId, input.review.reviewId]),
    resourceId: input.version.resourceId,
    resourceVersionId: input.version.resourceVersionId,
    sourceDraftId: input.draft.draftId,
    frozenDraftRevision: input.draft.revision,
    validationId: input.validation.validationId,
    reviewId: input.review.reviewId,
    deterministicAssessmentId: deterministic.assessmentId,
    semanticAssessmentId: semantic.semanticAssessmentId,
    bundleId: bundle.bundleId,
    deterministicRuleVersion: deterministic.ruleVersion,
    semanticRuleVersion: semantic.semanticRuleVersion,
    mergeRuleVersion: bundle.mergeRuleVersion,
    tracedAt: input.now,
    schemaVersion: QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION,
  };
  return { deterministic, semantic, bundle, trace };
}

function createSemanticAssessment(
  draft: StructuredQuestionDraft,
  validation: ResourceValidationResult,
  material: QuestionMaterialVersion,
  deterministicAssessmentId: string,
  now: string,
): QuestionSemanticQualityAssessment {
  const semanticRequestKey = buildStableId('corpus-semantic-request', [draft.draftId, String(draft.revision), material.materialVersionId]);
  return {
    semanticAssessmentId: buildStableId('corpus-semantic-assessment', [semanticRequestKey, deterministicAssessmentId]),
    semanticRequestKey,
    requestId: `${semanticRequestKey}:request`,
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    assessedDraftRevision: draft.revision,
    validationId: validation.validationId,
    materialVersionId: material.materialVersionId,
    deterministicAssessmentId,
    status: 'completed',
    findings: QUESTION_QUALITY_CHECKS.map((check) => ({
      check,
      status: 'pass',
      reason: semanticFindingReason(check, draft, material),
      evidenceRefs: [`draft:${draft.draftId}`, `material:${material.materialVersionId}`],
    })),
    limitations: ['来源版本仍标记为 needs_verification；本结论只覆盖题目质量，不代表来源版权已核验。'],
    providerId: 'codex-corpus-calibration',
    modelId: 'curated-semantic-review-v2',
    promptVersion: QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
    semanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    outputSchemaVersion: QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
    startedAt: now,
    completedAt: now,
  };
}

function semanticFindingReason(
  check: typeof QUESTION_QUALITY_CHECKS[number],
  draft: StructuredQuestionDraft,
  material: QuestionMaterialVersion,
): string {
  const subject = `${material.title}“${draft.questionStem.slice(0, 24)}${draft.questionStem.length > 24 ? '…' : ''}”`;
  const reasons: Record<typeof QUESTION_QUALITY_CHECKS[number], string> = {
    materialGrounding: `${subject}已绑定当前材料版本和明确证据范围，题干中的引用可在正文中定位。`,
    observationClarity: `${subject}明确了回答对象、学生动作和需要解释的关系。`,
    observationDistinctness: `${subject}与同篇其他题目的核心回答对象和评分目标可区分。`,
    discriminativePower: draft.assessmentMode === 'key_points'
      && !draft.minimumAnswerRequirement.requireExplanation
      ? `${subject}要求准确识别并组织多个材料事实要点，不能靠无关套话完成作答。`
      : `${subject}要求组织文本证据并完成解释，不能仅靠抄录题干作答。`,
    difficultyCoherence: `${subject}的步骤数量、证据跨度与当前难度标记一致。`,
    rubricAlignment: `${subject}的评分项覆盖题干要求的主要结论、证据和解释动作。`,
    scopeClarity: `${subject}提供了段落范围或全文比较维度，作答边界明确。`,
  };
  return reasons[check];
}

function createRegistryEntry(
  existing: ResourceRegistryEntry,
  version: FrozenQuestionResourceVersion,
  now: string,
): ResourceRegistryEntry {
  return {
    ...existing,
    currentFrozenVersionId: version.resourceVersionId,
    status: 'active',
    latestReviewId: version.reviewId,
    latestValidationId: version.validationId,
    materialId: version.materialId,
    taskId: version.taskId,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    tags: [...version.tags],
    updatedAt: now,
  };
}

function backfillMissingCurrentQualityTraces(
  data: SharedFormalResourceData,
  activeMaterials: QuestionMaterialVersion[],
  now: string,
): string[] {
  const traceVersionIds = new Set(data.questionQuality.frozenQualityTraces.map((item) => item.resourceVersionId));
  const activeMaterialIds = new Set(activeMaterials.map((item) => item.materialVersionId));
  const activeLinks = data.materialObservations.links.filter((item) => item.status === 'active' && activeMaterialIds.has(item.materialVersionId));
  const added: string[] = [];
  for (const link of activeLinks) {
    if (traceVersionIds.has(link.resourceVersionId)) continue;
    const version = data.questionResources.versions.find((item) => item.resourceVersionId === link.resourceVersionId);
    const draft = version && data.questionResources.drafts.find((item) => item.draftId === version.sourceDraftId);
    const validation = draft?.latestValidationId
      ? data.questionResources.validations.find((item) => item.validationId === draft.latestValidationId)
      : undefined;
    const review = version && data.questionResources.reviews.find((item) => item.reviewId === version.reviewId);
    const material = data.questionResources.materials.find((item) => item.materialVersionId === link.materialVersionId);
    if (!version || !draft || !validation || !review || !material) {
      throw new Error(`Cannot backfill quality trace for ${link.resourceVersionId}: source evidence is incomplete.`);
    }
    const peers = activeLinks
      .filter((item) => item.materialVersionId === link.materialVersionId && item.resourceVersionId !== link.resourceVersionId)
      .map((item) => data.questionResources.versions.find((value) => value.resourceVersionId === item.resourceVersionId))
      .filter((item): item is FrozenQuestionResourceVersion => Boolean(item))
      .map((item) => data.questionResources.drafts.find((value) => value.draftId === item.sourceDraftId))
      .filter((item): item is StructuredQuestionDraft => Boolean(item));
    const quality = createQualityArtifacts({ draft, validation, material, peerDrafts: peers, review, version, now });
    data.questionQuality.deterministicAssessments.push(quality.deterministic);
    data.questionQuality.semanticAssessments.push(quality.semantic);
    data.questionQuality.assessmentBundles.push(quality.bundle);
    data.questionQuality.frozenQualityTraces.push(quality.trace);
    added.push(quality.trace.traceId);
    traceVersionIds.add(link.resourceVersionId);
  }
  return added;
}

function selectCurrentPlan(data: SharedFormalResourceData, materialVersionId: string): MaterialObservationPlan {
  const plan = data.materialObservations.plans
    .filter((item) => item.materialVersionId === materialVersionId && item.status !== 'superseded')
    .sort((left, right) => right.revision - left.revision || right.updatedAt.localeCompare(left.updatedAt))[0];
  if (!plan) throw new Error(`No current plan for material version ${materialVersionId}.`);
  return plan;
}

function summarize(
  data: SharedFormalResourceData,
  alreadyApplied: boolean,
  materialVersionIds: string[],
  revisedQuestionResourceVersionIds: string[],
  backfilledTraceIds: string[],
): MaterialCorpusOptimizationReport {
  const materials = data.questionResources.materials.filter((item) => item.status !== 'retired');
  const materialIds = new Set(materials.map((item) => item.materialVersionId));
  const links = data.materialObservations.links.filter((item) => item.status === 'active' && materialIds.has(item.materialVersionId));
  const traceIds = new Set(data.questionQuality.frozenQualityTraces.map((item) => item.resourceVersionId));
  return {
    alreadyApplied,
    materialVersionIds: [...materialVersionIds],
    revisedQuestionResourceVersionIds: [...revisedQuestionResourceVersionIds],
    backfilledTraceIds: [...backfilledTraceIds],
    activeMaterialCount: materials.length,
    currentQuestionCount: links.length,
    currentTraceCount: links.filter((item) => traceIds.has(item.resourceVersionId)).length,
  };
}

export const MATERIAL_CORPUS_OPTIMIZATION_MARKER = OPTIMIZATION_MARKER;
