import { buildStableId } from './reviewedResourceCandidateAdapter.ts';
import {
  PRIMARY_ABILITY_IDS,
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_DIFFICULTIES,
  QUESTION_RESOURCE_TASK_ROLES,
  QUESTION_RESPONSE_FORMATS,
  STRUCTURED_QUESTION_TYPES,
  isPrimaryAbilityId,
  isQuestionResourceDifficulty,
  isQuestionResourceTaskRole,
  type FrozenQuestionResourceVersion,
  type PrimaryAbilityId,
  type QuestionMaterialVersion,
  type QuestionResourceDifficulty,
  type QuestionResponseFormat,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionType,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import {
  PRODUCT_EXECUTABLE_CAPABILITY_VERSION,
  RESOURCE_COVERAGE_POLICY_VERSION,
  RESOURCE_COVERAGE_SCHEMA_VERSION,
  isProductExecutableCapabilitySnapshot,
  isResourceCoveragePolicy,
  type CoveragePolicyTarget,
  type MaterialClusterCoverageView,
  type ProductExecutableCapabilitySnapshot,
  type ProductExecutableCapabilityStatus,
  type RejectedCoverageRecord,
  type ResourceCoverageCell,
  type ResourceCoverageCellKey,
  type ResourceCoverageGap,
  type ResourceCoverageGapCode,
  type ResourceCoverageGenerationInput,
  type ResourceCoverageGenerationResult,
  type ResourceCoveragePolicy,
  type ResourceCoverageRecommendedActionCode,
  type ResourceCoverageReport,
  type ResourceRegistrySnapshot,
} from '../schemas/resourceCoverage.schema.ts';

type PolicyFactoryInput = {
  createdAt?: string;
  targetOverrides?: Partial<CoveragePolicyTarget>[];
};

type CapabilityFactoryInput = {
  createdAt?: string;
  questionTypes?: Partial<Record<StructuredQuestionType, ProductExecutableCapabilityStatus>>;
  responseFormats?: Partial<Record<QuestionResponseFormat, ProductExecutableCapabilityStatus>>;
};

type CandidateAssessment = {
  entry: ResourceRegistryEntry;
  version?: FrozenQuestionResourceVersion;
  cellKey?: ResourceCoverageCellKey;
  issueCodes: ResourceCoverageGapCode[];
  executable: boolean;
};

export function createPhase17ResourceCoveragePolicy(
  input: PolicyFactoryInput = {},
): ResourceCoveragePolicy {
  const createdAt = input.createdAt || new Date().toISOString();
  const overrides = input.targetOverrides || [];
  const targets = PRIMARY_ABILITY_IDS.flatMap((abilityId) => (
    QUESTION_RESOURCE_TASK_ROLES.map((taskRole) => {
      const base = defaultTarget(abilityId, taskRole);
      const override = overrides.find((item) => (
        item.abilityId === abilityId && item.taskRole === taskRole
      ));
      return normalizeTarget({ ...base, ...override, abilityId, taskRole });
    })
  ));
  const policyId = buildStableId('resource-coverage-policy', [
    RESOURCE_COVERAGE_POLICY_VERSION,
    stableStringify(targets),
  ]);
  return {
    policyId,
    policyVersion: RESOURCE_COVERAGE_POLICY_VERSION,
    schemaVersion: RESOURCE_COVERAGE_SCHEMA_VERSION,
    targets,
    createdAt,
  };
}

export function createPhase17ProductCapabilitySnapshot(
  input: CapabilityFactoryInput = {},
): ProductExecutableCapabilitySnapshot {
  const createdAt = input.createdAt || new Date().toISOString();
  const questionTypes = mapRecord(
    STRUCTURED_QUESTION_TYPES,
    (questionType) => input.questionTypes?.[questionType] || (
      ['multiple_choice', 'open_short_answer', 'reading_comprehension'].includes(questionType)
        ? 'accepted'
        : 'resource_only'
    ),
  );
  const responseFormats = mapRecord(
    QUESTION_RESPONSE_FORMATS,
    (format) => input.responseFormats?.[format] || (
      ['single_choice', 'short_text', 'long_text'].includes(format) ? 'accepted' : 'resource_only'
    ),
  );
  const capabilitySnapshotId = buildStableId('product-executable-capability', [
    PRODUCT_EXECUTABLE_CAPABILITY_VERSION,
    stableStringify(questionTypes),
    stableStringify(responseFormats),
  ]);
  return {
    capabilitySnapshotId,
    capabilityVersion: PRODUCT_EXECUTABLE_CAPABILITY_VERSION,
    schemaVersion: RESOURCE_COVERAGE_SCHEMA_VERSION,
    questionTypes,
    responseFormats,
    createdAt,
  };
}

export function generateResourceCoverage(
  input: ResourceCoverageGenerationInput,
): ResourceCoverageGenerationResult {
  const inputIssues = validateInput(input);
  if (inputIssues.length > 0) return { status: 'blocked', issues: inputIssues };

  const source = normalizeSource(input.source);
  const snapshot = buildRegistrySnapshot(input, source);
  const assessments = assessRegistry(source, input.capabilitySnapshot);
  const rejectedRecords = buildRejectedRecords(assessments, input.generatedAt);
  const cellsAndGaps = input.policy.targets
    .map((target) => buildCell(target, assessments))
    .sort((left, right) => cellKey(left.cell.key).localeCompare(cellKey(right.cell.key)));
  const cells = cellsAndGaps.map((item) => item.cell);
  const gaps = cellsAndGaps.flatMap((item) => item.gaps)
    .sort((left, right) => left.gapId.localeCompare(right.gapId));
  const executableAssessments = assessments.filter((item) => item.executable && item.version);
  const materialClusters = buildMaterialClusters(executableAssessments);
  const summary = buildSummary(cells, materialClusters);
  const reportId = buildStableId('resource-coverage-report', [
    snapshot.contentHash,
    input.policy.policyId,
    input.capabilitySnapshot.capabilitySnapshotId,
    stableStringify(cells),
    stableStringify(gaps.map(withoutTimestamps)),
    stableStringify(rejectedRecords.map(withoutTimestamps)),
  ]);
  const report: ResourceCoverageReport = {
    reportId,
    reportVersion: RESOURCE_COVERAGE_POLICY_VERSION,
    schemaVersion: RESOURCE_COVERAGE_SCHEMA_VERSION,
    registrySnapshot: snapshot,
    policyId: input.policy.policyId,
    capabilitySnapshotId: input.capabilitySnapshot.capabilitySnapshotId,
    materialClusters,
    cells,
    gaps,
    rejectedRecords,
    summary,
    generatedAt: input.generatedAt,
  };
  const consistencyIssues = validateReportConsistency(report);
  return consistencyIssues.length > 0
    ? { status: 'blocked', issues: consistencyIssues }
    : { status: 'complete', report, issues: [] };
}

function defaultTarget(
  abilityId: PrimaryAbilityId,
  taskRole: RecommendedTaskRole,
): CoveragePolicyTarget {
  if (taskRole === 'training') {
    return {
      abilityId,
      taskRole,
      planned: true,
      minimumExecutableResourceCount: 2,
      minimumMaterialClusterCount: 2,
      minimumIndependentContextCount: 2,
      requiredDifficulties: ['basic', 'intermediate'],
      allowedQuestionTypes: ['multiple_choice', 'open_short_answer', 'reading_comprehension'],
    };
  }
  if (taskRole === 'retest' || taskRole === 'transfer') {
    return {
      abilityId,
      taskRole,
      planned: true,
      minimumExecutableResourceCount: 1,
      minimumMaterialClusterCount: 1,
      minimumIndependentContextCount: 1,
      requiredDifficulties: ['intermediate'],
      allowedQuestionTypes: ['multiple_choice', 'open_short_answer', 'reading_comprehension'],
    };
  }
  return {
    abilityId,
    taskRole,
    planned: false,
    minimumExecutableResourceCount: 0,
    minimumMaterialClusterCount: 0,
    minimumIndependentContextCount: 0,
    requiredDifficulties: [],
    allowedQuestionTypes: ['multiple_choice', 'open_short_answer', 'reading_comprehension'],
  };
}

function normalizeTarget(target: CoveragePolicyTarget): CoveragePolicyTarget {
  return {
    ...target,
    requiredDifficulties: uniqueSorted(target.requiredDifficulties),
    allowedQuestionTypes: uniqueSorted(target.allowedQuestionTypes),
  };
}

function validateInput(input: ResourceCoverageGenerationInput): string[] {
  const issues: string[] = [];
  if (!input || typeof input !== 'object') return ['input.invalid'];
  if (!isResourceCoveragePolicy(input.policy)) issues.push('policy.invalid');
  if (!isProductExecutableCapabilitySnapshot(input.capabilitySnapshot)) {
    issues.push('capability_snapshot.invalid');
  }
  if (!isTimestamp(input.generatedAt)) issues.push('generated_at.invalid');
  if (!input.source || typeof input.source !== 'object') issues.push('source.invalid');
  else {
    if (!Array.isArray(input.source.registryEntries)) issues.push('source.registry_entries_invalid');
    if (!Array.isArray(input.source.frozenVersions)) issues.push('source.frozen_versions_invalid');
    if (!Array.isArray(input.source.validations)) issues.push('source.validations_invalid');
    if (!Array.isArray(input.source.reviews)) issues.push('source.reviews_invalid');
    if (!Array.isArray(input.source.materials)) issues.push('source.materials_invalid');
  }
  if (issues.length > 0) return uniqueSorted(issues);

  const targetKeys = input.policy.targets.map((target) => cellKey(target));
  if (new Set(targetKeys).size !== targetKeys.length) issues.push('policy.duplicate_target');
  const expectedKeys = PRIMARY_ABILITY_IDS.flatMap((abilityId) => (
    QUESTION_RESOURCE_TASK_ROLES.map((taskRole) => cellKey({ abilityId, taskRole }))
  ));
  if (expectedKeys.some((key) => !targetKeys.includes(key)) || targetKeys.length !== expectedKeys.length) {
    issues.push('policy.target_matrix_incomplete');
  }
  for (const target of input.policy.targets) {
    if (!isPrimaryAbilityId(target.abilityId)) issues.push('policy.ability_unsupported');
    if (!isQuestionResourceTaskRole(target.taskRole)) issues.push('policy.task_role_unsupported');
    if (target.requiredDifficulties.some((value) => !isQuestionResourceDifficulty(value))) {
      issues.push('policy.difficulty_unsupported');
    }
    if (target.allowedQuestionTypes.some((value) => !STRUCTURED_QUESTION_TYPES.includes(value))) {
      issues.push('policy.question_type_unsupported');
    }
  }
  if (!recordHasExactKeys(input.capabilitySnapshot.questionTypes, STRUCTURED_QUESTION_TYPES)) {
    issues.push('capability_snapshot.question_types_incomplete');
  }
  if (!recordHasExactKeys(input.capabilitySnapshot.responseFormats, QUESTION_RESPONSE_FORMATS)) {
    issues.push('capability_snapshot.response_formats_incomplete');
  }
  return uniqueSorted(issues);
}

function normalizeSource(source: ResourceCoverageGenerationInput['source']) {
  return {
    registryEntries: sortBy(source.registryEntries, (item) => item.resourceId),
    frozenVersions: sortBy(source.frozenVersions, (item) => item.resourceVersionId),
    validations: sortBy(source.validations, (item) => item.validationId),
    reviews: sortBy(source.reviews, (item) => item.reviewId),
    materials: sortBy(source.materials, (item) => item.materialVersionId),
  };
}

function buildRegistrySnapshot(
  input: ResourceCoverageGenerationInput,
  source: ReturnType<typeof normalizeSource>,
): ResourceRegistrySnapshot {
  const currentVersionIds = uniqueSorted(source.registryEntries
    .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
    .map((entry) => entry.currentFrozenVersionId!));
  const currentVersions = source.frozenVersions.filter((version) => (
    currentVersionIds.includes(version.resourceVersionId)
  ));
  const materialVersionIds = uniqueSorted(currentVersions
    .map((version) => version.materialVersionId)
    .filter((value): value is string => Boolean(value)));
  const semanticContent = {
    registryEntries: source.registryEntries,
    currentVersions,
    validations: source.validations.filter((item) => (
      currentVersions.some((version) => version.validationId === item.validationId)
    )),
    reviews: source.reviews.filter((item) => (
      currentVersions.some((version) => version.reviewId === item.reviewId)
    )),
    materials: source.materials.filter((item) => materialVersionIds.includes(item.materialVersionId)),
    policy: { ...input.policy, createdAt: undefined },
    capability: { ...input.capabilitySnapshot, createdAt: undefined },
  };
  const contentHash = buildStableId('resource-registry-content', [stableStringify(semanticContent)]);
  return {
    registrySnapshotId: buildStableId('resource-registry-snapshot', [contentHash]),
    registrySchemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    policyId: input.policy.policyId,
    capabilitySnapshotId: input.capabilitySnapshot.capabilitySnapshotId,
    registryEntryIds: source.registryEntries.map((item) => item.resourceId),
    currentResourceVersionIds: currentVersionIds,
    materialVersionIds,
    contentHash,
    capturedAt: input.generatedAt,
  };
}

function assessRegistry(
  source: ReturnType<typeof normalizeSource>,
  capability: ProductExecutableCapabilitySnapshot,
): CandidateAssessment[] {
  const versionsById = uniqueMap(source.frozenVersions, (item) => item.resourceVersionId);
  const validationsById = uniqueMap(source.validations, (item) => item.validationId);
  const reviewsById = uniqueMap(source.reviews, (item) => item.reviewId);
  const materialsById = uniqueMap(source.materials, (item) => item.materialVersionId);
  const duplicateResourceIds = duplicateValues(source.registryEntries.map((entry) => entry.resourceId));
  const duplicateVersionIds = duplicateValues(source.frozenVersions.map((version) => version.resourceVersionId));

  return source.registryEntries
    .filter((entry) => entry.status === 'active')
    .map((entry) => {
      const version = entry.currentFrozenVersionId
        ? versionsById.get(entry.currentFrozenVersionId)
        : undefined;
      const cellKeyValue = validCellKey(entry);
      const issueCodes: ResourceCoverageGapCode[] = [];
      if (duplicateResourceIds.has(entry.resourceId)) issueCodes.push('registry_consistency_failed');
      if (!isPrimaryAbilityId(entry.abilityId)) issueCodes.push('unsupported_ability');
      if (!isQuestionResourceTaskRole(entry.taskRole)) issueCodes.push('unsupported_task_role');
      if (!isQuestionResourceDifficulty(entry.difficulty)) issueCodes.push('unsupported_difficulty');
      if (!entry.currentFrozenVersionId || !version) issueCodes.push('registry_current_version_missing');
      if (version && duplicateVersionIds.has(version.resourceVersionId)) {
        issueCodes.push('registry_consistency_failed');
      }
      if (version && source.frozenVersions.filter((item) => (
        item.resourceId === version.resourceId && item.status === 'frozen'
      )).length > 1) issueCodes.push('registry_consistency_failed');
      if (version && !identityAligned(entry, version)) {
        issueCodes.push('registry_version_identity_mismatch');
      }
      if (version && version.status !== 'frozen') issueCodes.push('resource_not_frozen_active');
      if (version && !reviewTraceable(
        entry,
        version,
        validationsById.get(version.validationId),
        reviewsById.get(version.reviewId),
      )) issueCodes.push('review_or_validation_untraceable');
      if (version && !rubricAndAnswerRequirementComplete(version)) {
        issueCodes.push('missing_rubric_or_answer_requirement');
      }
      if (version && !materialTraceable(version, materialsById.get(version.materialVersionId || ''))) {
        issueCodes.push('missing_material_identity');
      }
      if (version && capability.questionTypes[version.questionType] !== 'accepted') {
        issueCodes.push('question_type_not_product_executable');
      }
      if (version && capability.responseFormats[version.responseFormat] !== 'accepted') {
        issueCodes.push('response_format_not_product_executable');
      }
      const normalizedIssues = uniqueSorted(issueCodes);
      return {
        entry,
        version,
        cellKey: cellKeyValue,
        issueCodes: normalizedIssues,
        executable: Boolean(version && cellKeyValue && normalizedIssues.length === 0),
      };
    });
}

function buildCell(
  target: CoveragePolicyTarget,
  assessments: CandidateAssessment[],
): { cell: ResourceCoverageCell; gaps: ResourceCoverageGap[] } {
  const candidates = assessments.filter((item) => (
    item.cellKey && cellKey(item.cellKey) === cellKey(target)
  ));
  const policyAllowed = candidates.map((candidate) => {
    if (
      candidate.executable &&
      candidate.version &&
      !target.allowedQuestionTypes.includes(candidate.version.questionType)
    ) {
      return {
        ...candidate,
        executable: false,
        issueCodes: uniqueSorted([
          ...candidate.issueCodes,
          'question_type_not_allowed_by_policy' as ResourceCoverageGapCode,
        ]),
      };
    }
    return candidate;
  });
  const executable = policyAllowed.filter((item) => item.executable && item.version) as Array<
    CandidateAssessment & { version: FrozenQuestionResourceVersion }
  >;
  const materialClusterIds = uniqueSorted(executable.map((item) => item.version.materialId!));
  const gaps: ResourceCoverageGap[] = [];
  const addGap = (code: ResourceCoverageGapCode, affected: CandidateAssessment[] = policyAllowed) => {
    gaps.push(buildGap(target, code, affected));
  };
  let status: ResourceCoverageCell['status'];

  if (!target.planned) {
    status = 'not_planned';
  } else if (executable.length === 0) {
    const blockedCodes = uniqueSorted(policyAllowed.flatMap((item) => item.issueCodes));
    if (blockedCodes.length > 0) {
      status = 'blocked';
      blockedCodes.forEach((code) => addGap(code));
    } else {
      status = 'gap';
      addGap('no_current_frozen_resource', []);
    }
  } else {
    if (executable.length < target.minimumExecutableResourceCount) {
      addGap('insufficient_executable_resources');
    }
    if (materialClusterIds.length < target.minimumMaterialClusterCount) {
      addGap('insufficient_material_clusters');
    }
    if (materialClusterIds.length < target.minimumIndependentContextCount) {
      addGap('insufficient_independent_contexts');
    }
    const difficultySet = new Set(executable.map((item) => item.version.abilityMetadata.difficulty));
    if (target.requiredDifficulties.some((difficulty) => !difficultySet.has(difficulty))) {
      addGap('missing_required_difficulty');
    }
    status = gaps.length > 0 ? 'thin' : 'covered';
  }

  const difficultyBreakdown = zeroRecord(QUESTION_RESOURCE_DIFFICULTIES);
  const questionTypeBreakdown = zeroRecord(STRUCTURED_QUESTION_TYPES);
  const responseFormatBreakdown = zeroRecord(QUESTION_RESPONSE_FORMATS);
  for (const item of executable) {
    difficultyBreakdown[item.version.abilityMetadata.difficulty] += 1;
    questionTypeBreakdown[item.version.questionType] += 1;
    responseFormatBreakdown[item.version.responseFormat] += 1;
  }
  const limitations = uniqueSorted(gaps.map((gap) => gap.code));
  const cell: ResourceCoverageCell = {
    key: { abilityId: target.abilityId, taskRole: target.taskRole },
    status,
    currentExecutableResourceIds: uniqueSorted(executable.map((item) => item.entry.resourceId)),
    resourceVersionIds: uniqueSorted(executable.map((item) => item.version.resourceVersionId)),
    materialClusterIds,
    executableResourceCount: executable.length,
    materialClusterCount: materialClusterIds.length,
    independentContextCount: materialClusterIds.length,
    difficultyBreakdown,
    questionTypeBreakdown,
    responseFormatBreakdown,
    limitations,
    gapIds: gaps.map((gap) => gap.gapId).sort(),
  };
  return { cell, gaps };
}

function buildGap(
  target: CoveragePolicyTarget,
  code: ResourceCoverageGapCode,
  affected: CandidateAssessment[],
): ResourceCoverageGap {
  const affectedResourceIds = uniqueSorted(affected.map((item) => item.entry.resourceId));
  const materialClusterIds = uniqueSorted(affected
    .map((item) => item.version?.materialId)
    .filter((value): value is string => Boolean(value)));
  return {
    gapId: buildStableId('resource-coverage-gap', [
      cellKey(target),
      code,
      ...affectedResourceIds,
      ...materialClusterIds,
    ]),
    cellKey: { abilityId: target.abilityId, taskRole: target.taskRole },
    code,
    severity: gapSeverity(code),
    affectedResourceIds,
    materialClusterIds,
    reason: gapReason(code),
    recommendedActionCode: gapAction(code),
  };
}

function buildRejectedRecords(
  assessments: CandidateAssessment[],
  rejectedAt: string,
): RejectedCoverageRecord[] {
  return assessments
    .filter((item) => item.issueCodes.length > 0)
    .map((item) => ({
      rejectedRecordId: buildStableId('rejected-coverage-record', [
        item.entry.resourceId,
        item.version?.resourceVersionId || 'missing-version',
        ...item.issueCodes,
      ]),
      resourceId: item.entry.resourceId,
      resourceVersionId: item.version?.resourceVersionId,
      registryEntryId: item.entry.resourceId,
      issueCodes: item.issueCodes,
      rejectedAt,
    }))
    .sort((left, right) => left.rejectedRecordId.localeCompare(right.rejectedRecordId));
}

function buildMaterialClusters(
  assessments: Array<CandidateAssessment & { version?: FrozenQuestionResourceVersion }>,
): MaterialClusterCoverageView[] {
  const groups = new Map<string, Array<CandidateAssessment & { version: FrozenQuestionResourceVersion }>>();
  assessments.forEach((assessment) => {
    if (!assessment.version?.materialId) return;
    const group = groups.get(assessment.version.materialId) || [];
    group.push(assessment as CandidateAssessment & { version: FrozenQuestionResourceVersion });
    groups.set(assessment.version.materialId, group);
  });
  return [...groups.entries()]
    .map(([materialId, items]) => ({
      materialClusterId: materialId,
      materialId,
      currentMaterialVersionIds: uniqueSorted(items.map((item) => item.version.materialVersionId!)),
      currentExecutableResourceIds: uniqueSorted(items.map((item) => item.entry.resourceId)),
      abilityIds: uniqueSorted(items.map((item) => item.version.abilityMetadata.abilityId)),
      taskRoles: uniqueSorted(items.map((item) => item.version.abilityMetadata.taskRole)),
      limitations: [],
    }))
    .sort((left, right) => left.materialClusterId.localeCompare(right.materialClusterId));
}

function buildSummary(
  cells: ResourceCoverageCell[],
  materialClusters: MaterialClusterCoverageView[],
): ResourceCoverageReport['summary'] {
  const resourceIds = uniqueSorted(cells.flatMap((cell) => cell.currentExecutableResourceIds));
  return {
    coveredCellCount: cells.filter((cell) => cell.status === 'covered').length,
    thinCellCount: cells.filter((cell) => cell.status === 'thin').length,
    gapCellCount: cells.filter((cell) => cell.status === 'gap').length,
    blockedCellCount: cells.filter((cell) => cell.status === 'blocked').length,
    notPlannedCellCount: cells.filter((cell) => cell.status === 'not_planned').length,
    executableResourceCount: resourceIds.length,
    materialClusterCount: materialClusters.length,
    independentContextCount: materialClusters.length,
  };
}

function validateReportConsistency(report: ResourceCoverageReport): string[] {
  const issues: string[] = [];
  if (report.cells.length !== report.summary.coveredCellCount + report.summary.thinCellCount +
    report.summary.gapCellCount + report.summary.blockedCellCount + report.summary.notPlannedCellCount) {
    issues.push('report.summary_cell_count_mismatch');
  }
  const gapIds = new Set(report.gaps.map((gap) => gap.gapId));
  if (report.cells.some((cell) => cell.gapIds.some((gapId) => !gapIds.has(gapId)))) {
    issues.push('report.cell_gap_reference_missing');
  }
  if (new Set(report.materialClusters.map((item) => item.materialClusterId)).size !== report.materialClusters.length) {
    issues.push('report.material_cluster_duplicate');
  }
  return issues;
}

function identityAligned(
  entry: ResourceRegistryEntry,
  version: FrozenQuestionResourceVersion,
): boolean {
  return (
    entry.resourceId === version.resourceId &&
    entry.currentFrozenVersionId === version.resourceVersionId &&
    entry.taskId === version.taskId &&
    entry.abilityId === version.abilityMetadata.abilityId &&
    entry.taskRole === version.abilityMetadata.taskRole &&
    entry.difficulty === version.abilityMetadata.difficulty
  );
}

function reviewTraceable(
  entry: ResourceRegistryEntry,
  version: FrozenQuestionResourceVersion,
  validation?: ResourceValidationResult,
  review?: ResourceReviewDecision,
): boolean {
  return Boolean(
    validation?.passed &&
    validation.validationId === version.validationId &&
    validation.resourceId === version.resourceId &&
    validation.draftId === version.sourceDraftId &&
    review?.action === 'approve' &&
    review.reviewId === version.reviewId &&
    review.resourceId === version.resourceId &&
    review.draftId === version.sourceDraftId &&
    review.validationId === version.validationId &&
    entry.latestValidationId === version.validationId &&
    entry.latestReviewId === version.reviewId
  );
}

function rubricAndAnswerRequirementComplete(version: FrozenQuestionResourceVersion): boolean {
  const primaryItems = version.rubric.filter((item) => (
    item.abilityId === version.abilityMetadata.abilityId &&
    item.required &&
      item.acceptedSignals.some((signal) => signal.trim().length > 0)
  ));
  if (version.responseFormat === 'single_choice') {
    const minimum = version.minimumAnswerRequirement;
    return (
      primaryItems.length > 0 &&
      minimum.responseFormat === 'single_choice' &&
      minimum.minLength === 0 &&
      minimum.minSelections === 1 &&
      minimum.maxSelections === 1 &&
      minimum.requireTextEvidence === false &&
      minimum.requireExplanation === false
    );
  }
  return (
    primaryItems.length > 0 &&
    Number.isInteger(version.minimumAnswerRequirement.minLength) &&
    version.minimumAnswerRequirement.minLength > 0 &&
    typeof version.minimumAnswerRequirement.requireTextEvidence === 'boolean' &&
    typeof version.minimumAnswerRequirement.requireExplanation === 'boolean'
  );
}

function materialTraceable(
  version: FrozenQuestionResourceVersion,
  material?: QuestionMaterialVersion,
): boolean {
  return Boolean(
    version.materialId &&
    version.materialVersionId &&
    material &&
    material.materialId === version.materialId &&
    material.materialVersionId === version.materialVersionId &&
    version.materialSnapshot?.materialId === material.materialId &&
    version.materialSnapshot?.materialVersionId === material.materialVersionId
  );
}

function validCellKey(entry: ResourceRegistryEntry): ResourceCoverageCellKey | undefined {
  if (!isPrimaryAbilityId(entry.abilityId) || !isQuestionResourceTaskRole(entry.taskRole)) return undefined;
  return { abilityId: entry.abilityId, taskRole: entry.taskRole };
}

function gapSeverity(code: ResourceCoverageGapCode): ResourceCoverageGap['severity'] {
  if (['policy_target_not_configured'].includes(code)) return 'info';
  if ([
    'insufficient_executable_resources',
    'insufficient_material_clusters',
    'insufficient_independent_contexts',
    'missing_required_difficulty',
  ].includes(code)) return 'warning';
  return 'blocking';
}

function gapAction(code: ResourceCoverageGapCode): ResourceCoverageRecommendedActionCode {
  if (['insufficient_material_clusters', 'insufficient_independent_contexts'].includes(code)) {
    return 'add_material_cluster';
  }
  if (['no_current_frozen_resource', 'insufficient_executable_resources', 'missing_required_difficulty'].includes(code)) {
    return 'add_resource';
  }
  if (['question_type_not_product_executable', 'response_format_not_product_executable'].includes(code)) {
    return 'enable_product_capability';
  }
  if (['review_or_validation_untraceable', 'resource_not_frozen_active'].includes(code)) {
    return 'complete_review_or_freeze';
  }
  if ([
    'registry_current_version_missing',
    'registry_version_identity_mismatch',
    'registry_consistency_failed',
  ].includes(code)) return 'repair_registry';
  if (code === 'policy_target_not_configured' || code === 'question_type_not_allowed_by_policy') {
    return 'review_policy';
  }
  return 'repair_resource_metadata';
}

function gapReason(code: ResourceCoverageGapCode): string {
  const reasons: Record<ResourceCoverageGapCode, string> = {
    no_current_frozen_resource: 'No current frozen resource is available for this coverage cell.',
    insufficient_executable_resources: 'Executable resource count is below the coverage policy threshold.',
    insufficient_material_clusters: 'Material cluster count is below the coverage policy threshold.',
    insufficient_independent_contexts: 'Independent context count is below the coverage policy threshold.',
    missing_required_difficulty: 'One or more policy-required difficulty levels are missing.',
    question_type_not_product_executable: 'The question type has not passed the product execution capability gate.',
    response_format_not_product_executable: 'The response format has not passed the product execution capability gate.',
    missing_material_identity: 'Material identity or version traceability is incomplete.',
    missing_rubric_or_answer_requirement: 'Rubric or minimum answer requirements are incomplete.',
    review_or_validation_untraceable: 'Validation or review cannot be traced to the current frozen version.',
    resource_not_frozen_active: 'The registry head does not reference an active frozen resource.',
    question_type_not_allowed_by_policy: 'The question type is not allowed by the current coverage policy target.',
    registry_current_version_missing: 'The registry current frozen version is missing.',
    registry_version_identity_mismatch: 'Registry metadata does not match the current frozen version.',
    registry_consistency_failed: 'Registry consistency validation failed.',
    unsupported_ability: 'The resource ability is not registered.',
    unsupported_task_role: 'The resource task role is not registered.',
    unsupported_difficulty: 'The resource difficulty is not registered.',
    policy_target_not_configured: 'The coverage policy target is not configured.',
  };
  return reasons[code];
}

function cellKey(value: Pick<ResourceCoverageCellKey, 'abilityId' | 'taskRole'>): string {
  return `${value.abilityId}:${value.taskRole}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortValue(item)]));
}

function withoutTimestamps<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  const clone = { ...(value as Record<string, unknown>) };
  delete clone.generatedAt;
  delete clone.rejectedAt;
  return clone as T;
}

function mapRecord<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, V>;
}

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return mapRecord(keys, () => 0);
}

function recordHasExactKeys<K extends string>(record: Record<K, unknown>, keys: readonly K[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return stableStringify(actual) === stableStringify(expected);
}

function uniqueMap<T>(values: T[], key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  values.forEach((item) => {
    const itemKey = key(item);
    if (!map.has(itemKey)) map.set(itemKey, item);
  });
  return map;
}

function duplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return duplicates;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

function sortBy<T>(values: T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right)));
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}
