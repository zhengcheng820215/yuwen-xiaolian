import { buildResourceCoverageDashboardViewModel } from '../ai/agents/resourceCoverageDashboardAdapter.ts';
import {
  createPhase17ProductCapabilitySnapshot,
  createPhase17ResourceCoveragePolicy,
  generateResourceCoverage,
} from '../ai/agents/resourceCoverageAgent.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type FrozenQuestionResourceVersion,
  type PrimaryAbilityId,
  type QuestionMaterialVersion,
  type QuestionResourceDifficulty,
  type QuestionResponseFormat,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionType,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import type { RecommendedTaskRole } from '../ai/schemas/nextLearningStrategy.schema.ts';

const GENERATED_AT = '2026-07-22T08:00:00.000Z';

type DemoResourceSpec = {
  id: string;
  title: string;
  materialId: string;
  materialTitle: string;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;
  questionType?: StructuredQuestionType;
  responseFormat?: QuestionResponseFormat;
};

const specs: DemoResourceSpec[] = [
  resource('extract-rain-basic', '提取母亲撑伞的动作', 'rain-mother', '雨中的母亲', 'extraction', 'training', 'basic'),
  resource('extract-train-intermediate', '提取父亲离开前的行为', 'train-father', '远去的列车', 'extraction', 'training', 'intermediate'),
  resource('extract-retest', '提取人物变化的关键信息', 'growing-note', '抽屉里的便笺', 'extraction', 'retest', 'intermediate'),
  resource('understand-rain-basic', '理解母亲动作的含义', 'rain-mother', '雨中的母亲', 'comprehension', 'training', 'basic'),
  resource('understand-tree-intermediate', '理解树叶细节的含义', 'old-book-leaf', '旧书里的树叶', 'comprehension', 'training', 'intermediate'),
  resource('summary-note-basic', '概括便笺中的主要事件', 'growing-note', '抽屉里的便笺', 'summarization', 'training', 'basic'),
  resource('analysis-train-basic', '分析母亲的形象特点', 'rain-mother', '雨中的母亲', 'analysis', 'training', 'basic'),
  resource('analysis-train-intermediate', '分析父亲沉默背后的态度', 'station-silence', '站台上的沉默', 'analysis', 'training', 'intermediate'),
  resource('inference-train-basic', '根据动作推断人物心理', 'old-book-leaf', '旧书里的树叶', 'inference', 'training', 'basic'),
  resource('inference-train-intermediate', '根据前后情境推断原因', 'train-father', '远去的列车', 'inference', 'training', 'intermediate'),
  resource('inference-retest', '在相似材料中复测心理推断', 'station-silence', '站台上的沉默', 'inference', 'retest', 'intermediate'),
  resource('inference-transfer', '在新情境中迁移推断', 'night-light', '窗前的灯', 'inference', 'transfer', 'intermediate'),
  resource('expression-train', '说明对人物选择的看法', 'night-light', '窗前的灯', 'expression', 'training', 'intermediate', 'reading_comprehension', 'long_text'),
  resource('analysis-transfer-blocked', '迁移分析人物关系', 'street-umbrella', '街角的伞', 'analysis', 'transfer', 'intermediate', 'multiple_choice', 'single_choice'),
];

function resource(
  id: string,
  title: string,
  materialId: string,
  materialTitle: string,
  abilityId: PrimaryAbilityId,
  taskRole: RecommendedTaskRole,
  difficulty: QuestionResourceDifficulty,
  questionType: StructuredQuestionType = 'open_short_answer',
  responseFormat: QuestionResponseFormat = 'short_text',
): DemoResourceSpec {
  return { id, title, materialId, materialTitle, abilityId, taskRole, difficulty, questionType, responseFormat };
}

export function loadResourceCoverageDashboardDemo() {
  const materials = new Map<string, QuestionMaterialVersion>();
  const registryEntries: ResourceRegistryEntry[] = [];
  const frozenVersions: FrozenQuestionResourceVersion[] = [];
  const validations: ResourceValidationResult[] = [];
  const reviews: ResourceReviewDecision[] = [];

  for (const spec of specs) {
    const material = makeMaterial(spec.materialId, spec.materialTitle);
    materials.set(material.materialVersionId, material);
    const version = makeVersion(spec, material);
    frozenVersions.push(version);
    validations.push(makeValidation(version));
    reviews.push(makeReview(version));
    registryEntries.push(makeRegistryEntry(version));
  }

  const policy = createPhase17ResourceCoveragePolicy({ createdAt: GENERATED_AT });
  const capabilitySnapshot = createPhase17ProductCapabilitySnapshot({ createdAt: GENERATED_AT });
  const result = generateResourceCoverage({
    source: {
      registryEntries,
      frozenVersions,
      validations,
      reviews,
      materials: [...materials.values()],
    },
    policy,
    capabilitySnapshot,
    generatedAt: GENERATED_AT,
  });

  if (result.status !== 'complete') {
    throw new Error(`Phase 17.1 Demo coverage generation blocked: ${result.issues.join(', ')}`);
  }

  return {
    report: result.report,
    dashboard: buildResourceCoverageDashboardViewModel(result.report),
    resources: frozenVersions,
    materials: [...materials.values()],
    demoMode: 'controlled_snapshot' as const,
  };
}

function makeMaterial(materialId: string, title: string): QuestionMaterialVersion {
  return {
    materialId,
    materialVersionId: `${materialId}-v1`,
    versionNumber: 1,
    title,
    content: `${title}是一篇用于 Phase 17.1 资源覆盖验收的受控阅读材料。`,
    source: { sourceType: 'manual', description: 'Phase 17.1 controlled dashboard fixture' },
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function makeVersion(
  spec: DemoResourceSpec,
  material: QuestionMaterialVersion,
): FrozenQuestionResourceVersion {
  const resourceId = `resource-${spec.id}`;
  return {
    resourceId,
    resourceVersionId: `${resourceId}-v1`,
    versionNumber: 1,
    sourceDraftId: `draft-${spec.id}`,
    materialId: material.materialId,
    materialVersionId: material.materialVersionId,
    materialSnapshot: material,
    taskId: `task-${spec.id}`,
    title: spec.title,
    questionStem: '结合材料内容完成本题。',
    questionType: spec.questionType || 'open_short_answer',
    responseFormat: spec.responseFormat || 'short_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: { semanticEquivalentAllowed: true },
    rubric: [{
      itemId: `rubric-${spec.id}`,
      name: '完成目标能力动作',
      abilityId: spec.abilityId,
      importance: 'critical',
      required: true,
      evidenceRequirement: {
        requireTextEvidence: true,
        requireExplanation: true,
        requireConclusion: true,
      },
      acceptedSignals: ['能够结合材料形成可核验回答'],
    }],
    minimumAnswerRequirement: {
      minLength: 10,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: spec.abilityId,
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: spec.taskRole,
      difficulty: spec.difficulty,
    },
    source: { sourceType: 'manual', description: 'Phase 17.1 controlled dashboard fixture' },
    tags: ['phase17-demo'],
    validationId: `validation-${spec.id}`,
    reviewId: `review-${spec.id}`,
    status: 'frozen',
    frozenAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function makeValidation(version: FrozenQuestionResourceVersion): ResourceValidationResult {
  return {
    validationId: version.validationId,
    draftId: version.sourceDraftId,
    resourceId: version.resourceId,
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
    checkedAt: GENERATED_AT,
  };
}

function makeReview(version: FrozenQuestionResourceVersion): ResourceReviewDecision {
  return {
    reviewId: version.reviewId,
    draftId: version.sourceDraftId,
    resourceId: version.resourceId,
    reviewedDraftRevision: 1,
    validationId: version.validationId,
    action: 'approve',
    reviewerId: 'phase17-demo-reviewer',
    notes: 'Approved for controlled coverage demo.',
    reviewedAt: GENERATED_AT,
  };
}

function makeRegistryEntry(version: FrozenQuestionResourceVersion): ResourceRegistryEntry {
  return {
    resourceId: version.resourceId,
    currentFrozenVersionId: version.resourceVersionId,
    status: 'active',
    latestReviewId: version.reviewId,
    latestValidationId: version.validationId,
    materialId: version.materialId,
    taskId: version.taskId,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    tags: version.tags,
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}
