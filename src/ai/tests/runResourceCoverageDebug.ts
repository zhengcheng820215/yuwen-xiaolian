import { buildResourceCoverageDashboardViewModel } from '../agents/resourceCoverageDashboardAdapter.ts';
import { generateCurrentResourceCoverage } from '../agents/resourceCoverageApplicationService.ts';
import {
  createPhase17ProductCapabilitySnapshot,
  createPhase17ResourceCoveragePolicy,
  generateResourceCoverage,
} from '../agents/resourceCoverageAgent.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type FrozenQuestionResourceVersion,
  type PrimaryAbilityId,
  type QuestionMaterialVersion,
  type QuestionResourceDifficulty,
  type QuestionResponseFormat,
  type ResourceFreezeCommit,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionType,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  isResourceCoverageDashboardViewModel,
  isResourceCoverageGenerationResult,
  isResourceCoverageReport,
  type ProductExecutableCapabilitySnapshot,
  type ResourceCoverageGenerationInput,
  type ResourceCoveragePolicy,
} from '../schemas/resourceCoverage.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';

const NOW = '2026-07-22T05:00:00.000Z';

type ResourceSpec = {
  id: string;
  abilityId?: PrimaryAbilityId;
  entryAbilityId?: PrimaryAbilityId;
  taskRole?: RecommendedTaskRole;
  difficulty?: QuestionResourceDifficulty;
  materialId?: string;
  materialVersionId?: string;
  includeMaterialIdentity?: boolean;
  includeMaterialRecord?: boolean;
  questionType?: StructuredQuestionType;
  responseFormat?: QuestionResponseFormat;
  includeReview?: boolean;
  validationPassed?: boolean;
  emptyRubric?: boolean;
  registryHeadId?: string;
  versionStatus?: FrozenQuestionResourceVersion['status'];
  addSupersededVersion?: boolean;
};

type DebugCase = { name: string; run: () => void | Promise<void> };

const cases: DebugCase[] = [
  { name: '01 only Registry current head is counted', run: caseCurrentHeadOnly },
  { name: '02 superseded version stays traceable without increasing coverage', run: caseSupersededExcluded },
  { name: '03 missing Registry current version is blocked', run: caseMissingCurrentVersion },
  { name: '04 Registry and Version identity mismatch is rejected', run: caseIdentityMismatch },
  { name: '05 missing review or Rubric cannot enter executable coverage', run: caseReviewOrRubricMissing },
  { name: '06 missing Material identity is not silently repaired', run: caseMissingMaterial },
  { name: '07 multiple questions on one Material keep one context', run: caseSameMaterialCount },
  { name: '08 multiple versions of one Material keep one cluster', run: caseSameMaterialVersions },
  { name: '09 different Materials increase independent contexts', run: caseDifferentMaterials },
  { name: '10 resource-only question type is not product executable', run: caseResourceOnlyQuestionType },
  { name: '11 accepted question type with blocked response format is not executable', run: caseBlockedResponseFormat },
  { name: '12 Primary Cells do not create a Cartesian product', run: casePrimaryCellMatrix },
  { name: '13 unplanned diagnosis Cell remains not_planned', run: caseNotPlanned },
  { name: '14 all candidates blocked produces blocked Cell', run: caseAllCandidatesBlocked },
  { name: '15 resource count below Policy threshold produces thin', run: caseThinResourceCount },
  { name: '16 enough resources on one Material remains thin', run: caseThinMaterialWidth },
  { name: '17 all Policy thresholds produce covered', run: caseCovered },
  { name: '18 input ordering does not change report identity', run: caseStableOrdering },
  { name: '19 Policy change creates a new report identity', run: casePolicyVersionedResult },
  { name: '20 Capability change creates a new report identity', run: caseCapabilityVersionedResult },
  { name: '21 Dashboard is a faithful read-only projection', run: caseDashboardProjection },
  { name: '22 blocked generation does not mutate Repository', run: caseNoRepositoryMutation },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.1 Resource Coverage Contract Debug');
  console.log('='.repeat(64));
  for (const item of cases) {
    try {
      await item.run();
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${item.name}: ${message}`);
      console.log(`FAIL ${item.name}: ${message}`);
    }
  }
  console.log('-'.repeat(64));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  console.log(`Phase 17.1 Engineering: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

function caseCurrentHeadOnly(): void {
  const result = run([{ id: 'head', materialId: 'material-a', addSupersededVersion: true }]);
  const cell = getCell(result, 'inference', 'training');
  expect(cell.executableResourceCount === 1, 'Current resource was not counted exactly once.');
  expect(cell.resourceVersionIds.length === 1 && cell.resourceVersionIds[0] === 'version-head-v1', 'Old version entered current coverage.');
}

function caseSupersededExcluded(): void {
  const input = buildInput([{ id: 'old', materialId: 'material-a', addSupersededVersion: true }]);
  const result = requireReport(generateResourceCoverage(input));
  expect(input.source.frozenVersions.length === 2, 'Fixture did not retain old version.');
  expect(result.summary.executableResourceCount === 1, 'Superseded version increased executable count.');
}

function caseMissingCurrentVersion(): void {
  const result = run([{ id: 'missing-head', registryHeadId: 'version-does-not-exist' }]);
  const cell = getCell(result, 'inference', 'training');
  expect(cell.status === 'blocked', `Expected blocked, got ${cell.status}.`);
  expect(hasGap(result, 'registry_current_version_missing'), 'Missing current version gap not recorded.');
}

function caseIdentityMismatch(): void {
  const result = run([{ id: 'identity', entryAbilityId: 'comprehension' }]);
  const cell = getCell(result, 'comprehension', 'training');
  expect(cell.status === 'blocked', 'Identity mismatch did not block the Registry cell.');
  expect(hasGap(result, 'registry_version_identity_mismatch'), 'Identity mismatch gap missing.');
}

function caseReviewOrRubricMissing(): void {
  const missingReview = run([{ id: 'review', includeReview: false }]);
  const emptyRubric = run([{ id: 'rubric', emptyRubric: true }]);
  expect(hasGap(missingReview, 'review_or_validation_untraceable'), 'Missing review was not isolated.');
  expect(hasGap(emptyRubric, 'missing_rubric_or_answer_requirement'), 'Empty Rubric was not isolated.');
  expect(missingReview.summary.executableResourceCount === 0, 'Missing review entered executable coverage.');
}

function caseMissingMaterial(): void {
  const result = run([{ id: 'material-missing', includeMaterialIdentity: false }]);
  expect(hasGap(result, 'missing_material_identity'), 'Missing Material identity gap missing.');
  expect(result.materialClusters.length === 0, 'Temporary Material Cluster was invented.');
}

function caseSameMaterialCount(): void {
  const result = run([
    { id: 'same-a', materialId: 'material-same', difficulty: 'basic' },
    { id: 'same-b', materialId: 'material-same', difficulty: 'intermediate' },
  ]);
  const cell = getCell(result, 'inference', 'training');
  expect(cell.executableResourceCount === 2, 'Question resources were not counted.');
  expect(cell.materialClusterCount === 1 && cell.independentContextCount === 1, 'One Material created multiple contexts.');
}

function caseSameMaterialVersions(): void {
  const result = run([
    { id: 'mv-a', materialId: 'material-versioned', materialVersionId: 'material-versioned-v1', difficulty: 'basic' },
    { id: 'mv-b', materialId: 'material-versioned', materialVersionId: 'material-versioned-v2', difficulty: 'intermediate' },
  ]);
  const cluster = result.materialClusters.find((item) => item.materialClusterId === 'material-versioned');
  expect(cluster?.currentMaterialVersionIds.length === 2, 'Material versions were not retained.');
  expect(result.materialClusters.length === 1, 'Material versions created multiple clusters.');
}

function caseDifferentMaterials(): void {
  const result = coveredTrainingReport();
  const cell = getCell(result, 'inference', 'training');
  expect(cell.materialClusterCount === 2 && cell.independentContextCount === 2, 'Independent Material contexts were not counted.');
}

function caseResourceOnlyQuestionType(): void {
  const result = run([{
    id: 'choice',
    questionType: 'multiple_choice',
    responseFormat: 'single_choice',
  }]);
  expect(hasGap(result, 'question_type_not_product_executable'), 'Resource-only question type entered coverage.');
  expect(result.summary.executableResourceCount === 0, 'Resource-only question became product executable.');
}

function caseBlockedResponseFormat(): void {
  const capability = createPhase17ProductCapabilitySnapshot({
    createdAt: NOW,
    questionTypes: { open_short_answer: 'accepted' },
    responseFormats: { single_choice: 'blocked' },
  });
  const result = run([{
    id: 'response-blocked',
    questionType: 'open_short_answer',
    responseFormat: 'single_choice',
  }], undefined, capability);
  expect(hasGap(result, 'response_format_not_product_executable'), 'Blocked response format entered coverage.');
}

function casePrimaryCellMatrix(): void {
  const result = run([]);
  expect(result.cells.length === 30, `Expected 30 Ability x TaskRole cells, got ${result.cells.length}.`);
  expect(result.cells.every((cell) => Object.keys(cell.difficultyBreakdown).length === 3), 'Difficulty Breakdown missing.');
  expect(result.cells.every((cell) => Object.keys(cell.questionTypeBreakdown).length === 5), 'QuestionType Breakdown missing.');
}

function caseNotPlanned(): void {
  const result = run([]);
  const cell = getCell(result, 'inference', 'diagnosis');
  expect(cell.status === 'not_planned', `Expected not_planned, got ${cell.status}.`);
  expect(cell.gapIds.length === 0, 'Unplanned Cell produced a resource gap.');
}

function caseAllCandidatesBlocked(): void {
  const result = run([{ id: 'blocked-choice', questionType: 'multiple_choice', responseFormat: 'single_choice' }]);
  expect(getCell(result, 'inference', 'training').status === 'blocked', 'All-blocked candidates did not produce blocked Cell.');
}

function caseThinResourceCount(): void {
  const result = run([{ id: 'thin-one', difficulty: 'basic', materialId: 'material-a' }]);
  const cell = getCell(result, 'inference', 'training');
  expect(cell.status === 'thin', `Expected thin, got ${cell.status}.`);
  expect(hasGap(result, 'insufficient_executable_resources'), 'Resource threshold gap missing.');
}

function caseThinMaterialWidth(): void {
  const result = run([
    { id: 'thin-material-a', difficulty: 'basic', materialId: 'material-a' },
    { id: 'thin-material-b', difficulty: 'intermediate', materialId: 'material-a' },
  ]);
  const cell = getCell(result, 'inference', 'training');
  expect(cell.status === 'thin', 'Single-Material Training was marked covered.');
  expect(hasGap(result, 'insufficient_material_clusters'), 'Material width gap missing.');
}

function caseCovered(): void {
  const result = coveredTrainingReport();
  const cell = getCell(result, 'inference', 'training');
  expect(cell.status === 'covered', `Expected covered, got ${cell.status}: ${cell.limitations.join(',')}`);
  expect(cell.difficultyBreakdown.basic === 1 && cell.difficultyBreakdown.intermediate === 1, 'Difficulty distribution is incorrect.');
  expect(isResourceCoverageReport(result), 'Coverage Report schema validation failed.');
}

function caseStableOrdering(): void {
  const input = buildInput([
    { id: 'stable-a', difficulty: 'basic', materialId: 'material-a' },
    { id: 'stable-b', difficulty: 'intermediate', materialId: 'material-b' },
  ]);
  const first = requireReport(generateResourceCoverage(input));
  const reversed = clone(input);
  reversed.source.registryEntries.reverse();
  reversed.source.frozenVersions.reverse();
  reversed.source.validations.reverse();
  reversed.source.reviews.reverse();
  reversed.source.materials.reverse();
  const second = requireReport(generateResourceCoverage(reversed));
  expect(first.reportId === second.reportId, 'Input order changed reportId.');
  expect(first.registrySnapshot.contentHash === second.registrySnapshot.contentHash, 'Input order changed contentHash.');
}

function casePolicyVersionedResult(): void {
  const input = buildInput([{ id: 'policy', materialId: 'material-a' }]);
  const first = requireReport(generateResourceCoverage(input));
  const changedPolicy = createPhase17ResourceCoveragePolicy({
    createdAt: NOW,
    targetOverrides: [{
      abilityId: 'inference',
      taskRole: 'training',
      minimumExecutableResourceCount: 3,
    }],
  });
  const second = requireReport(generateResourceCoverage({ ...input, policy: changedPolicy }));
  expect(first.policyId !== second.policyId && first.reportId !== second.reportId, 'Policy change did not create new report identity.');
}

function caseCapabilityVersionedResult(): void {
  const input = buildInput([{ id: 'capability', materialId: 'material-a' }]);
  const first = requireReport(generateResourceCoverage(input));
  const changed = createPhase17ProductCapabilitySnapshot({
    createdAt: NOW,
    questionTypes: { multiple_choice: 'accepted' },
    responseFormats: { single_choice: 'accepted' },
  });
  const second = requireReport(generateResourceCoverage({ ...input, capabilitySnapshot: changed }));
  expect(first.capabilitySnapshotId !== second.capabilitySnapshotId, 'Capability Snapshot identity did not change.');
  expect(first.reportId !== second.reportId, 'Capability change did not create new report identity.');
}

function caseDashboardProjection(): void {
  const report = coveredTrainingReport();
  const dashboard = buildResourceCoverageDashboardViewModel(report);
  expect(isResourceCoverageDashboardViewModel(dashboard), 'Dashboard View Model failed validation.');
  expect(dashboard.reportId === report.reportId, 'Dashboard lost report identity.');
  expect(JSON.stringify(dashboard.summary) === JSON.stringify(report.summary), 'Dashboard recalculated Summary.');
  expect(dashboard.cells.length === report.cells.length, 'Dashboard Cell count diverged.');
}

async function caseNoRepositoryMutation(): Promise<void> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  const input = buildInput([{ id: 'repo-safe', materialId: 'material-repo' }]);
  await seedRepository(repository, input);
  const before = await repositoryState(repository);
  const invalidPolicy = clone(input.policy) as ResourceCoveragePolicy;
  invalidPolicy.targets = invalidPolicy.targets.slice(1);
  const result = await generateCurrentResourceCoverage({
    repository,
    policy: invalidPolicy,
    capabilitySnapshot: input.capabilitySnapshot,
    generatedAt: NOW,
  });
  const after = await repositoryState(repository);
  expect(result.status === 'blocked', 'Invalid Policy did not block generation.');
  expect(JSON.stringify(before) === JSON.stringify(after), 'Coverage generation mutated the Repository.');
  expect(isResourceCoverageGenerationResult(result), 'Blocked result failed schema validation.');
}

function coveredTrainingReport() {
  return run([
    { id: 'covered-basic', difficulty: 'basic', materialId: 'material-a' },
    { id: 'covered-intermediate', difficulty: 'intermediate', materialId: 'material-b' },
  ]);
}

function run(
  specs: ResourceSpec[],
  policy?: ResourceCoveragePolicy,
  capabilitySnapshot?: ProductExecutableCapabilitySnapshot,
) {
  return requireReport(generateResourceCoverage(buildInput(specs, policy, capabilitySnapshot)));
}

function buildInput(
  specs: ResourceSpec[],
  policy = createPhase17ResourceCoveragePolicy({ createdAt: NOW }),
  capabilitySnapshot = createPhase17ProductCapabilitySnapshot({ createdAt: NOW }),
): ResourceCoverageGenerationInput {
  const registryEntries: ResourceRegistryEntry[] = [];
  const frozenVersions: FrozenQuestionResourceVersion[] = [];
  const validations: ResourceValidationResult[] = [];
  const reviews: ResourceReviewDecision[] = [];
  const materials = new Map<string, QuestionMaterialVersion>();

  specs.forEach((spec) => {
    const resourceId = `resource-${spec.id}`;
    const resourceVersionId = `version-${spec.id}-v1`;
    const materialId = spec.materialId || `material-${spec.id}`;
    const materialVersionId = spec.materialVersionId || `${materialId}-v1`;
    const includeMaterialIdentity = spec.includeMaterialIdentity !== false;
    const material = makeMaterial(materialId, materialVersionId);
    if (includeMaterialIdentity && spec.includeMaterialRecord !== false) {
      materials.set(materialVersionId, material);
    }
    const validationId = `validation-${spec.id}`;
    const reviewId = `review-${spec.id}`;
    const version = makeVersion({
      resourceId,
      resourceVersionId,
      material: includeMaterialIdentity ? material : undefined,
      validationId,
      reviewId,
      abilityId: spec.abilityId || 'inference',
      taskRole: spec.taskRole || 'training',
      difficulty: spec.difficulty || 'basic',
      questionType: spec.questionType || 'open_short_answer',
      responseFormat: spec.responseFormat || 'short_text',
      status: spec.versionStatus || 'frozen',
      emptyRubric: Boolean(spec.emptyRubric),
    });
    frozenVersions.push(version);
    if (spec.addSupersededVersion) {
      frozenVersions.push({
        ...clone(version),
        resourceVersionId: `${resourceVersionId}-old`,
        versionNumber: 0,
        status: 'superseded',
      });
    }
    const validation = makeValidation(version, spec.validationPassed !== false);
    validations.push(validation);
    if (spec.includeReview !== false) reviews.push(makeReview(version));
    registryEntries.push({
      resourceId,
      currentFrozenVersionId: spec.registryHeadId || resourceVersionId,
      status: 'active',
      latestReviewId: reviewId,
      latestValidationId: validationId,
      materialId: includeMaterialIdentity ? materialId : undefined,
      taskId: version.taskId,
      abilityId: spec.entryAbilityId || version.abilityMetadata.abilityId,
      taskRole: version.abilityMetadata.taskRole,
      difficulty: version.abilityMetadata.difficulty,
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    });
  });

  return {
    source: {
      registryEntries,
      frozenVersions,
      validations,
      reviews,
      materials: [...materials.values()],
    },
    policy,
    capabilitySnapshot,
    generatedAt: NOW,
  };
}

function makeVersion(input: {
  resourceId: string;
  resourceVersionId: string;
  material?: QuestionMaterialVersion;
  validationId: string;
  reviewId: string;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;
  questionType: StructuredQuestionType;
  responseFormat: QuestionResponseFormat;
  status: FrozenQuestionResourceVersion['status'];
  emptyRubric: boolean;
}): FrozenQuestionResourceVersion {
  return {
    resourceId: input.resourceId,
    resourceVersionId: input.resourceVersionId,
    versionNumber: 1,
    sourceDraftId: `draft-${input.resourceId}`,
    materialId: input.material?.materialId,
    materialVersionId: input.material?.materialVersionId,
    materialSnapshot: input.material ? clone(input.material) : undefined,
    taskId: `task-${input.resourceId}`,
    title: `Question ${input.resourceId}`,
    questionStem: '结合材料回答问题。',
    questionType: input.questionType,
    responseFormat: input.responseFormat,
    assessmentMode: 'reasoning_chain',
    answerAcceptance: { semanticEquivalentAllowed: true },
    rubric: input.emptyRubric ? [] : [{
      itemId: `rubric-${input.resourceId}`,
      name: '完成核心能力动作',
      abilityId: input.abilityId,
      importance: 'critical',
      required: true,
      evidenceRequirement: {
        requireTextEvidence: true,
        requireExplanation: true,
        requireConclusion: true,
      },
      acceptedSignals: ['能够结合材料形成完整回答'],
    }],
    minimumAnswerRequirement: {
      minLength: 10,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: input.abilityId,
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: input.taskRole,
      difficulty: input.difficulty,
    },
    source: { sourceType: 'manual', description: 'Phase 17.1 Debug Fixture' },
    tags: [],
    validationId: input.validationId,
    reviewId: input.reviewId,
    status: input.status,
    frozenAt: NOW,
    updatedAt: NOW,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function makeMaterial(materialId: string, materialVersionId: string): QuestionMaterialVersion {
  return {
    materialId,
    materialVersionId,
    versionNumber: Number(materialVersionId.match(/v(\d+)$/)?.[1] || 1),
    title: `Material ${materialId}`,
    content: '这是一段用于资源覆盖测试的正式阅读材料。',
    source: { sourceType: 'manual', description: 'Phase 17.1 Debug Fixture' },
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function makeValidation(
  version: FrozenQuestionResourceVersion,
  passed: boolean,
): ResourceValidationResult {
  return {
    validationId: version.validationId,
    draftId: version.sourceDraftId,
    resourceId: version.resourceId,
    validatedDraftRevision: 1,
    validationRuleVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    passed,
    checks: {
      identityValid: passed,
      contentValid: passed,
      answerAcceptanceValid: passed,
      rubricValid: passed,
      abilityAndRoleValid: passed,
      versionLineageValid: passed,
      materialValid: passed,
    },
    issues: [],
    checkedAt: NOW,
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
    reviewerId: 'reviewer-phase17-1',
    notes: 'Approved for deterministic coverage Debug.',
    reviewedAt: NOW,
  };
}

async function seedRepository(
  repository: InMemoryQuestionResourceAdmissionRepository,
  input: ResourceCoverageGenerationInput,
): Promise<void> {
  for (const material of input.source.materials) await repository.saveMaterial(material);
  for (const validation of input.source.validations) await repository.saveValidation(validation);
  for (const review of input.source.reviews) await repository.saveReview(review);
  for (const entry of input.source.registryEntries) {
    const version = input.source.frozenVersions.find((item) => (
      item.resourceVersionId === entry.currentFrozenVersionId
    ));
    if (!version) continue;
    const commit: ResourceFreezeCommit = { version, registryEntry: entry };
    await repository.commitFreeze(commit);
  }
}

async function repositoryState(repository: InMemoryQuestionResourceAdmissionRepository) {
  return {
    registry: await repository.listRegistryEntries(),
    versions: await repository.listVersions(),
    materials: await repository.listMaterials(),
  };
}

function requireReport(result: ReturnType<typeof generateResourceCoverage>) {
  expect(isResourceCoverageGenerationResult(result), 'Coverage generation result failed schema validation.');
  expect(result.status === 'complete', `Coverage generation blocked: ${JSON.stringify(result.issues)}`);
  return result.report;
}

function getCell(
  report: ReturnType<typeof requireReport>,
  abilityId: PrimaryAbilityId,
  taskRole: RecommendedTaskRole,
) {
  const cell = report.cells.find((item) => (
    item.key.abilityId === abilityId && item.key.taskRole === taskRole
  ));
  if (!cell) throw new Error(`Coverage Cell missing: ${abilityId}:${taskRole}`);
  return cell;
}

function hasGap(
  report: ReturnType<typeof requireReport>,
  code: typeof report.gaps[number]['code'],
): boolean {
  return report.gaps.some((gap) => gap.code === code);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main();
