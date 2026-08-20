export const TARGETED_MICRO_TRAINING_SCHEMA_VERSION =
  'targeted_micro_training_v1' as const;

export const MATERIAL_USAGE_TYPES = [
  'core_reading',
  'targeted_excerpt',
] as const;

export type MaterialUsageType = typeof MATERIAL_USAGE_TYPES[number];

export const MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSIONS = [
  'material_content_normalization_v1',
] as const;

export type MaterialContentNormalizationPolicyVersion =
  typeof MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSIONS[number];

export const CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION =
  'material_content_normalization_v1' as const;

export const TARGETED_GAP_REASON_CODES = [
  'missing_text_evidence',
  'missing_reasoning_relation',
  'conclusion_inconsistent',
  'incomplete_task_requirement',
] as const;

export type TargetedGapReasonCode = typeof TARGETED_GAP_REASON_CODES[number];

export const TARGETED_EXCERPT_SOURCE_RELATIONS = [
  'same_material_excerpt',
  'authorized_external_excerpt',
  'controlled_original',
] as const;

export type TargetedExcerptSourceRelation =
  typeof TARGETED_EXCERPT_SOURCE_RELATIONS[number];

export type TargetedSourceAnchor = {
  materialId: string;
  paragraphStart?: number;
  paragraphEnd?: number;
  contentHash: string;
};

export type TargetedExcerptMetadata = {
  targetAbilityIds: string[];
  supportedGapReasonCodes: TargetedGapReasonCode[];
  sourceRelation: TargetedExcerptSourceRelation;
  parentMaterialId?: string;
  sourceAnchor?: Omit<TargetedSourceAnchor, 'materialId'>;
  intendedTaskCount: 1 | 2;
};

export type TargetedMaterialUsageInput = {
  usageType?: MaterialUsageType;
  content?: string;
  contentHash?: string;
  contentNormalizationPolicyVersion?: MaterialContentNormalizationPolicyVersion;
  targetedExcerptMetadata?: TargetedExcerptMetadata;
};

export type TargetedMaterialUsageProjection = {
  usageType: MaterialUsageType;
  contentHash?: string;
  contentNormalizationPolicyVersion?: MaterialContentNormalizationPolicyVersion;
  targetedExcerptMetadata?: TargetedExcerptMetadata;
};

export type TargetedTrainingResourceMetadata = {
  primaryGapReasonCode: TargetedGapReasonCode;
  targetedMaterialVersionId: string;
};

export type TargetedMicroTrainingRequest = {
  requestId: string;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId: string;
  sourceAttemptId: string;
  abilityId: string;
  gapReasonCode: TargetedGapReasonCode;
  taskRole: 'training';
  materialRelationPolicy:
    | 'prefer_new_context'
    | 'allow_same_material_distinct_anchor';
  excludedSourceAnchors: TargetedSourceAnchor[];
  excludedResourceVersionIds: string[];
  maxTaskCount: 1;
  createdAt: string;
};

export type TargetedMicroTrainingAssignmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'unavailable';

export type TargetedMicroTrainingAssignment = {
  assignmentId: string;
  requestId: string;
  sourceLearningRoundId: string;
  resourceVersionId: string;
  status: TargetedMicroTrainingAssignmentStatus;
  returnToCoreTaskNumber: number;
};

export type TargetedMicroTrainingValidationIssue = {
  code: string;
  field: string;
  message: string;
};

export type TargetedMicroTrainingValidationResult = {
  passed: boolean;
  issues: TargetedMicroTrainingValidationIssue[];
};

/**
 * Historical Material Versions intentionally remain untouched. Missing usageType
 * is interpreted as core_reading only at the compatibility boundary.
 */
export function projectTargetedMaterialUsage(
  value: TargetedMaterialUsageInput,
): TargetedMaterialUsageProjection {
  return clone({
    usageType: value.usageType || 'core_reading',
    ...(value.contentHash ? { contentHash: value.contentHash } : {}),
    ...(value.contentNormalizationPolicyVersion
      ? { contentNormalizationPolicyVersion: value.contentNormalizationPolicyVersion }
      : {}),
    ...(value.targetedExcerptMetadata
      ? { targetedExcerptMetadata: value.targetedExcerptMetadata }
      : {}),
  });
}

export function validateTargetedMaterialUsage(
  value: TargetedMaterialUsageInput,
): TargetedMicroTrainingValidationResult {
  const issues: TargetedMicroTrainingValidationIssue[] = [];
  const projection = projectTargetedMaterialUsage(value);
  if (!MATERIAL_USAGE_TYPES.includes(projection.usageType)) {
    add(issues, 'material.usage_type', 'usageType', 'Material usage type is not supported.');
    return result(issues);
  }

  if (projection.usageType === 'core_reading') {
    if (projection.targetedExcerptMetadata !== undefined) {
      add(
        issues,
        'material.core_has_targeted_metadata',
        'targetedExcerptMetadata',
        'Core reading material cannot carry targeted excerpt metadata.',
      );
    }
    return result(issues);
  }

  if (!nonEmpty(projection.contentHash)) {
    add(
      issues,
      'material.targeted_content_hash',
      'contentHash',
      'Targeted excerpt material requires an independent content hash.',
    );
  }
  if (!MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSIONS.includes(
    projection.contentNormalizationPolicyVersion as MaterialContentNormalizationPolicyVersion,
  )) {
    add(
      issues,
      'material.targeted_normalization_policy',
      'contentNormalizationPolicyVersion',
      'Targeted excerpt material requires a supported content normalization policy version.',
    );
  }
  if (
    nonEmpty(value.content)
    && nonEmpty(projection.contentHash)
    && MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSIONS.includes(
      projection.contentNormalizationPolicyVersion as MaterialContentNormalizationPolicyVersion,
    )
    && buildMaterialContentHash(
      value.content!,
      projection.contentNormalizationPolicyVersion as MaterialContentNormalizationPolicyVersion,
    ) !== projection.contentHash
  ) {
    add(
      issues,
      'material.targeted_content_hash_mismatch',
      'contentHash',
      'Targeted excerpt content hash does not match the normalized Material content.',
    );
  }
  validateTargetedExcerptMetadata(projection.targetedExcerptMetadata, issues);
  return result(issues);
}

/**
 * V1 preserves semantic punctuation while removing formatting-only differences.
 * The version is persisted beside the hash so later policy changes remain auditable.
 */
export function normalizeMaterialContentForIdentity(
  content: string,
  policyVersion: MaterialContentNormalizationPolicyVersion =
    CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION,
): string {
  if (policyVersion !== CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION) {
    throw new Error(`Unsupported material content normalization policy: ${policyVersion}`);
  }
  return content
    .replace(/^\uFEFF/, '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00A0]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildMaterialContentHash(
  content: string,
  policyVersion: MaterialContentNormalizationPolicyVersion =
    CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION,
): string {
  const normalized = normalizeMaterialContentForIdentity(content, policyVersion);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function validateTargetedTrainingResourceMetadata(
  value: TargetedTrainingResourceMetadata | undefined,
  materialVersionId?: string,
): TargetedMicroTrainingValidationResult {
  const issues: TargetedMicroTrainingValidationIssue[] = [];
  if (!value || typeof value !== 'object') {
    add(issues, 'resource.targeted_metadata', 'targetedTrainingMetadata', 'Targeted training resource metadata is required.');
    return result(issues);
  }
  if (!TARGETED_GAP_REASON_CODES.includes(value.primaryGapReasonCode)) {
    add(issues, 'resource.primary_gap', 'targetedTrainingMetadata.primaryGapReasonCode', 'Primary gap reason is not supported.');
  }
  if (!nonEmpty(value.targetedMaterialVersionId)) {
    add(issues, 'resource.targeted_material', 'targetedTrainingMetadata.targetedMaterialVersionId', 'Targeted Material Version identity is required.');
  } else if (materialVersionId && value.targetedMaterialVersionId !== materialVersionId) {
    add(issues, 'resource.targeted_material_mismatch', 'targetedTrainingMetadata.targetedMaterialVersionId', 'Targeted resource metadata must reference the Draft Material Version.');
  }
  return result(issues);
}

export function assertValidTargetedMaterialUsage(value: TargetedMaterialUsageInput): void {
  const validation = validateTargetedMaterialUsage(value);
  if (!validation.passed) {
    throw new Error(
      `Material usage is invalid: ${validation.issues.map((issue) => issue.code).join(', ')}`,
    );
  }
}

export function buildTargetedMicroTrainingRequestId(input: {
  studentId: string;
  sourceAttemptId: string;
  gapReasonCode: TargetedGapReasonCode;
}): string {
  return stableIdentity('targeted-micro-training-request', [
    input.studentId,
    input.sourceAttemptId,
    input.gapReasonCode,
  ]);
}

export function buildTargetedMicroTrainingAssignmentId(input: {
  requestId: string;
  resourceVersionId: string;
}): string {
  return stableIdentity('targeted-micro-training-assignment', [
    input.requestId,
    input.resourceVersionId,
  ]);
}

export function validateTargetedMicroTrainingRequest(
  value: unknown,
): TargetedMicroTrainingValidationResult {
  const issues: TargetedMicroTrainingValidationIssue[] = [];
  if (!value || typeof value !== 'object') {
    add(issues, 'request.required', 'request', 'Targeted micro-training request is required.');
    return result(issues);
  }
  const request = value as TargetedMicroTrainingRequest;
  [
    ['requestId', request.requestId],
    ['studentId', request.studentId],
    ['learningSessionId', request.learningSessionId],
    ['sourceLearningRoundId', request.sourceLearningRoundId],
    ['sourceAttemptId', request.sourceAttemptId],
    ['abilityId', request.abilityId],
  ].forEach(([field, fieldValue]) => {
    if (!nonEmpty(fieldValue)) add(issues, `request.${field}`, field, `${field} is required.`);
  });
  if (!TARGETED_GAP_REASON_CODES.includes(request.gapReasonCode)) {
    add(issues, 'request.gap_reason', 'gapReasonCode', 'Gap reason is not supported for targeted micro-training.');
  }
  if (request.taskRole !== 'training') {
    add(issues, 'request.task_role', 'taskRole', 'Targeted micro-training must use the training role.');
  }
  if (!['prefer_new_context', 'allow_same_material_distinct_anchor'].includes(request.materialRelationPolicy)) {
    add(issues, 'request.material_relation_policy', 'materialRelationPolicy', 'Material relation policy is not supported.');
  }
  validateSourceAnchors(request.excludedSourceAnchors, 'excludedSourceAnchors', issues);
  validateUniqueStrings(
    request.excludedResourceVersionIds,
    'excludedResourceVersionIds',
    'request.excluded_resource_versions',
    issues,
  );
  if (request.maxTaskCount !== 1) {
    add(issues, 'request.max_task_count', 'maxTaskCount', 'Stage 1 permits exactly one targeted task per request.');
  }
  if (!timestamp(request.createdAt)) {
    add(issues, 'request.created_at', 'createdAt', 'createdAt must be a valid timestamp.');
  }
  if (
    nonEmpty(request.studentId)
    && nonEmpty(request.sourceAttemptId)
    && TARGETED_GAP_REASON_CODES.includes(request.gapReasonCode)
    && request.requestId !== buildTargetedMicroTrainingRequestId(request)
  ) {
    add(
      issues,
      'request.identity_mismatch',
      'requestId',
      'Request identity must use studentId + sourceAttemptId + gapReasonCode.',
    );
  }
  return result(issues);
}

export function isTargetedMicroTrainingRequest(
  value: unknown,
): value is TargetedMicroTrainingRequest {
  return validateTargetedMicroTrainingRequest(value).passed;
}

export function validateTargetedMicroTrainingAssignment(
  value: unknown,
): TargetedMicroTrainingValidationResult {
  const issues: TargetedMicroTrainingValidationIssue[] = [];
  if (!value || typeof value !== 'object') {
    add(issues, 'assignment.required', 'assignment', 'Targeted micro-training assignment is required.');
    return result(issues);
  }
  const assignment = value as TargetedMicroTrainingAssignment;
  [
    ['assignmentId', assignment.assignmentId],
    ['requestId', assignment.requestId],
    ['sourceLearningRoundId', assignment.sourceLearningRoundId],
    ['resourceVersionId', assignment.resourceVersionId],
  ].forEach(([field, fieldValue]) => {
    if (!nonEmpty(fieldValue)) add(issues, `assignment.${field}`, field, `${field} is required.`);
  });
  if (!['pending', 'in_progress', 'completed', 'skipped', 'unavailable'].includes(assignment.status)) {
    add(issues, 'assignment.status', 'status', 'Assignment status is not supported.');
  }
  if (!positiveInteger(assignment.returnToCoreTaskNumber)) {
    add(
      issues,
      'assignment.return_to_core_task',
      'returnToCoreTaskNumber',
      'Return target must be a positive core task number.',
    );
  }
  if (
    nonEmpty(assignment.requestId)
    && nonEmpty(assignment.resourceVersionId)
    && assignment.assignmentId !== buildTargetedMicroTrainingAssignmentId(assignment)
  ) {
    add(
      issues,
      'assignment.identity_mismatch',
      'assignmentId',
      'Assignment identity must use requestId + resourceVersionId.',
    );
  }
  return result(issues);
}

export function isTargetedMicroTrainingAssignment(
  value: unknown,
): value is TargetedMicroTrainingAssignment {
  return validateTargetedMicroTrainingAssignment(value).passed;
}

function validateTargetedExcerptMetadata(
  value: TargetedExcerptMetadata | undefined,
  issues: TargetedMicroTrainingValidationIssue[],
): void {
  if (!value || typeof value !== 'object') {
    add(
      issues,
      'material.targeted_metadata',
      'targetedExcerptMetadata',
      'Targeted excerpt metadata is required.',
    );
    return;
  }
  validateUniqueStrings(
    value.targetAbilityIds,
    'targetedExcerptMetadata.targetAbilityIds',
    'material.target_abilities',
    issues,
    true,
  );
  if (!Array.isArray(value.supportedGapReasonCodes) || value.supportedGapReasonCodes.length === 0) {
    add(
      issues,
      'material.supported_gaps',
      'targetedExcerptMetadata.supportedGapReasonCodes',
      'At least one supported gap reason is required.',
    );
  } else {
    if (value.supportedGapReasonCodes.some((code) => !TARGETED_GAP_REASON_CODES.includes(code))) {
      add(
        issues,
        'material.unsupported_gap',
        'targetedExcerptMetadata.supportedGapReasonCodes',
        'Targeted excerpt contains an unsupported gap reason.',
      );
    }
    if (new Set(value.supportedGapReasonCodes).size !== value.supportedGapReasonCodes.length) {
      add(
        issues,
        'material.duplicate_gap',
        'targetedExcerptMetadata.supportedGapReasonCodes',
        'Supported gap reasons must be unique.',
      );
    }
  }
  if (!TARGETED_EXCERPT_SOURCE_RELATIONS.includes(value.sourceRelation)) {
    add(
      issues,
      'material.source_relation',
      'targetedExcerptMetadata.sourceRelation',
      'Targeted excerpt source relation is not supported.',
    );
  }
  if (![1, 2].includes(value.intendedTaskCount)) {
    add(
      issues,
      'material.intended_task_count',
      'targetedExcerptMetadata.intendedTaskCount',
      'Targeted excerpt must intend one or two tasks.',
    );
  }
  if (value.sourceRelation === 'same_material_excerpt') {
    if (!nonEmpty(value.parentMaterialId)) {
      add(
        issues,
        'material.parent_material',
        'targetedExcerptMetadata.parentMaterialId',
        'Same-material excerpt requires its parent material identity.',
      );
    }
    validateSourceAnchor(
      value.sourceAnchor && {
        ...value.sourceAnchor,
        materialId: value.parentMaterialId || '',
      },
      'targetedExcerptMetadata.sourceAnchor',
      issues,
    );
  } else if (value.sourceAnchor !== undefined) {
    validateSourceAnchor(
      { ...value.sourceAnchor, materialId: value.parentMaterialId || 'external-source' },
      'targetedExcerptMetadata.sourceAnchor',
      issues,
    );
  }
}

function validateSourceAnchors(
  value: unknown,
  field: string,
  issues: TargetedMicroTrainingValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    add(issues, 'request.source_anchors', field, 'Excluded source anchors must be an array.');
    return;
  }
  value.forEach((anchor, index) => validateSourceAnchor(anchor, `${field}.${index}`, issues));
  const identities = value
    .filter((anchor): anchor is TargetedSourceAnchor => Boolean(anchor && typeof anchor === 'object'))
    .map(sourceAnchorIdentity);
  if (new Set(identities).size !== identities.length) {
    add(issues, 'request.source_anchor_duplicate', field, 'Excluded source anchors must be unique.');
  }
}

function validateSourceAnchor(
  value: unknown,
  field: string,
  issues: TargetedMicroTrainingValidationIssue[],
): void {
  if (!value || typeof value !== 'object') {
    add(issues, 'source_anchor.required', field, 'Source anchor is required.');
    return;
  }
  const anchor = value as TargetedSourceAnchor;
  if (!nonEmpty(anchor.materialId)) {
    add(issues, 'source_anchor.material_id', `${field}.materialId`, 'Source anchor material identity is required.');
  }
  if (!nonEmpty(anchor.contentHash)) {
    add(issues, 'source_anchor.content_hash', `${field}.contentHash`, 'Source anchor content hash is required.');
  }
  if (anchor.paragraphStart !== undefined && !positiveInteger(anchor.paragraphStart)) {
    add(issues, 'source_anchor.paragraph_start', `${field}.paragraphStart`, 'Paragraph start must be positive.');
  }
  if (anchor.paragraphEnd !== undefined && !positiveInteger(anchor.paragraphEnd)) {
    add(issues, 'source_anchor.paragraph_end', `${field}.paragraphEnd`, 'Paragraph end must be positive.');
  }
  if (
    positiveInteger(anchor.paragraphStart)
    && positiveInteger(anchor.paragraphEnd)
    && anchor.paragraphStart > anchor.paragraphEnd
  ) {
    add(issues, 'source_anchor.range', field, 'Paragraph range is reversed.');
  }
}

function validateUniqueStrings(
  value: unknown,
  field: string,
  code: string,
  issues: TargetedMicroTrainingValidationIssue[],
  requireOne = false,
): void {
  if (!Array.isArray(value) || (requireOne && value.length === 0)) {
    add(issues, code, field, requireOne ? 'At least one value is required.' : 'Value must be an array.');
    return;
  }
  if (value.some((item) => !nonEmpty(item))) {
    add(issues, `${code}.empty`, field, 'Values must be non-empty strings.');
  }
  const normalized = value.filter(nonEmpty).map((item) => item.trim());
  if (new Set(normalized).size !== normalized.length) {
    add(issues, `${code}.duplicate`, field, 'Values must be unique.');
  }
}

function sourceAnchorIdentity(anchor: TargetedSourceAnchor): string {
  return [
    anchor.materialId,
    anchor.paragraphStart ?? '',
    anchor.paragraphEnd ?? '',
    anchor.contentHash,
  ].join('|');
}

function stableIdentity(prefix: string, parts: string[]): string {
  return `${prefix}:${parts.map((part) => encodeURIComponent(part.trim())).join(':')}`;
}

function result(
  issues: TargetedMicroTrainingValidationIssue[],
): TargetedMicroTrainingValidationResult {
  return { passed: issues.length === 0, issues };
}

function add(
  issues: TargetedMicroTrainingValidationIssue[],
  code: string,
  field: string,
  message: string,
): void {
  issues.push({ code, field, message });
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function timestamp(value: unknown): value is string {
  return nonEmpty(value) && !Number.isNaN(Date.parse(value));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
