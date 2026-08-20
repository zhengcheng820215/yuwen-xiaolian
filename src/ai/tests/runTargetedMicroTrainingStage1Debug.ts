import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  type QuestionMaterialVersion,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  buildMaterialContentHash,
  buildTargetedMicroTrainingAssignmentId,
  buildTargetedMicroTrainingRequestId,
  isTargetedMicroTrainingAssignment,
  isTargetedMicroTrainingRequest,
  projectTargetedMaterialUsage,
  validateTargetedMaterialUsage,
  validateTargetedMicroTrainingAssignment,
  validateTargetedMicroTrainingRequest,
  type TargetedGapReasonCode,
  type TargetedMicroTrainingAssignment,
  type TargetedMicroTrainingRequest,
} from '../schemas/targetedMicroTraining.schema.ts';

const NOW = '2026-08-20T10:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> | void }> = [
  { name: '01 historical Material defaults to core_reading without mutation', run: historicalMaterialProjection },
  { name: '02 historical Material persists unchanged', run: historicalMaterialPersistence },
  { name: '03 explicit core material remains valid', run: explicitCoreMaterial },
  { name: '04 controlled-original targeted excerpt is valid', run: controlledOriginalExcerpt },
  { name: '05 same-material excerpt requires parent and anchor', run: sameMaterialBoundary },
  { name: '06 targeted excerpt requires independent content hash', run: targetedContentHashBoundary },
  { name: '07 unsupported and duplicate gaps are rejected', run: targetedGapBoundary },
  { name: '08 core material cannot carry targeted metadata', run: coreMetadataBoundary },
  { name: '09 valid request passes deterministic structure validation', run: validRequest },
  { name: '10 request identity is stable and gap-sensitive', run: requestIdentity },
  { name: '11 insufficient_to_judge cannot create a request', run: unsupportedRequestGap },
  { name: '12 request remains one training task', run: requestTaskBoundary },
  { name: '13 duplicate excluded anchors are rejected', run: duplicateAnchorBoundary },
  { name: '14 valid assignment preserves the core return cursor', run: validAssignment },
  { name: '15 assignment identity and cursor are enforced', run: assignmentBoundary },
  { name: '16 repository blocks malformed targeted material', run: repositoryValidationBoundary },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Targeted Micro-training Stage 1 Debug');
  console.log('='.repeat(52));
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
  console.log('-'.repeat(52));
  console.log(`Result: ${passed}/${cases.length} passed`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
  }
}

function historicalMaterialProjection(): void {
  const historical = baseMaterial();
  const before = JSON.stringify(historical);
  const projection = projectTargetedMaterialUsage(historical);
  assert(projection.usageType === 'core_reading', 'Historical Material was not projected as core_reading.');
  assert(JSON.stringify(historical) === before, 'Compatibility projection rewrote historical Material.');
  assert(!Object.prototype.hasOwnProperty.call(historical, 'usageType'), 'Historical Material received a persisted usageType.');
  assert(validateTargetedMaterialUsage(historical).passed, 'Historical Material failed compatibility validation.');
}

async function historicalMaterialPersistence(): Promise<void> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  const historical = baseMaterial();
  await repository.saveMaterial(historical);
  const restored = await repository.getMaterial(historical.materialVersionId);
  assert(restored !== null, 'Historical Material was not restored.');
  assert(!Object.prototype.hasOwnProperty.call(restored, 'usageType'), 'Persistence rewrote historical usageType.');
  assert(projectTargetedMaterialUsage(restored).usageType === 'core_reading', 'Restored Material lost compatibility projection.');
}

function explicitCoreMaterial(): void {
  const validation = validateTargetedMaterialUsage({ ...baseMaterial(), usageType: 'core_reading' });
  assert(validation.passed, codes(validation));
}

function controlledOriginalExcerpt(): void {
  const validation = validateTargetedMaterialUsage(targetedMaterial());
  assert(validation.passed, codes(validation));
}

function sameMaterialBoundary(): void {
  const invalid = targetedMaterial({
    targetedExcerptMetadata: {
      targetAbilityIds: ['comprehension'],
      supportedGapReasonCodes: ['missing_reasoning_relation'],
      sourceRelation: 'same_material_excerpt',
      intendedTaskCount: 1,
    },
  });
  const invalidResult = validateTargetedMaterialUsage(invalid);
  assert(has(invalidResult, 'material.parent_material'), 'Missing parent Material was accepted.');
  assert(has(invalidResult, 'source_anchor.required'), 'Missing same-material Source Anchor was accepted.');

  const valid = targetedMaterial({
    targetedExcerptMetadata: {
      targetAbilityIds: ['comprehension'],
      supportedGapReasonCodes: ['missing_reasoning_relation'],
      sourceRelation: 'same_material_excerpt',
      parentMaterialId: 'material-core-1',
      sourceAnchor: { paragraphStart: 2, paragraphEnd: 3, contentHash: 'anchor-hash-2-3' },
      intendedTaskCount: 1,
    },
  });
  assert(validateTargetedMaterialUsage(valid).passed, 'Valid same-material excerpt was rejected.');
}

function targetedContentHashBoundary(): void {
  const validation = validateTargetedMaterialUsage({ ...targetedMaterial(), contentHash: undefined });
  assert(has(validation, 'material.targeted_content_hash'), 'Targeted excerpt without content hash was accepted.');
}

function targetedGapBoundary(): void {
  const duplicate = targetedMaterial();
  duplicate.targetedExcerptMetadata!.supportedGapReasonCodes = [
    'missing_text_evidence',
    'missing_text_evidence',
  ];
  assert(
    has(validateTargetedMaterialUsage(duplicate), 'material.duplicate_gap'),
    'Duplicate supported gaps were accepted.',
  );
  const unsupported = targetedMaterial() as QuestionMaterialVersion & {
    targetedExcerptMetadata: { supportedGapReasonCodes: string[] };
  };
  unsupported.targetedExcerptMetadata.supportedGapReasonCodes = ['theme_understanding_weak'];
  assert(
    has(validateTargetedMaterialUsage(unsupported as never), 'material.unsupported_gap'),
    'Macro ability gap was accepted.',
  );
}

function coreMetadataBoundary(): void {
  const material = targetedMaterial();
  material.usageType = 'core_reading';
  const validation = validateTargetedMaterialUsage(material);
  assert(has(validation, 'material.core_has_targeted_metadata'), 'Core Material accepted targeted metadata.');
}

function validRequest(): void {
  const request = requestFixture();
  assert(isTargetedMicroTrainingRequest(request), codes(validateTargetedMicroTrainingRequest(request)));
}

function requestIdentity(): void {
  const first = buildTargetedMicroTrainingRequestId({
    studentId: 'student-1',
    sourceAttemptId: 'attempt-1',
    gapReasonCode: 'missing_text_evidence',
  });
  const retry = buildTargetedMicroTrainingRequestId({
    studentId: 'student-1',
    sourceAttemptId: 'attempt-1',
    gapReasonCode: 'missing_text_evidence',
  });
  const otherGap = buildTargetedMicroTrainingRequestId({
    studentId: 'student-1',
    sourceAttemptId: 'attempt-1',
    gapReasonCode: 'missing_reasoning_relation',
  });
  assert(first === retry, 'Same formal result produced a different request identity.');
  assert(first !== otherGap, 'Different gap reused the same request identity.');
}

function unsupportedRequestGap(): void {
  const request = requestFixture() as TargetedMicroTrainingRequest & { gapReasonCode: string };
  request.gapReasonCode = 'insufficient_to_judge';
  const validation = validateTargetedMicroTrainingRequest(request);
  assert(has(validation, 'request.gap_reason'), 'insufficient_to_judge created a micro-training request.');
}

function requestTaskBoundary(): void {
  const request = { ...requestFixture(), taskRole: 'retest', maxTaskCount: 2 };
  const validation = validateTargetedMicroTrainingRequest(request);
  assert(has(validation, 'request.task_role'), 'Retest role was accepted as micro-training.');
  assert(has(validation, 'request.max_task_count'), 'Multi-task request was accepted.');
}

function duplicateAnchorBoundary(): void {
  const request = requestFixture();
  request.excludedSourceAnchors.push({ ...request.excludedSourceAnchors[0] });
  const validation = validateTargetedMicroTrainingRequest(request);
  assert(has(validation, 'request.source_anchor_duplicate'), 'Duplicate source anchors were accepted.');
}

function validAssignment(): void {
  const assignment = assignmentFixture();
  assert(isTargetedMicroTrainingAssignment(assignment), codes(validateTargetedMicroTrainingAssignment(assignment)));
  assert(assignment.returnToCoreTaskNumber === 4, 'Core return cursor changed.');
}

function assignmentBoundary(): void {
  const invalid = { ...assignmentFixture(), assignmentId: 'manual-id', returnToCoreTaskNumber: 0 };
  const validation = validateTargetedMicroTrainingAssignment(invalid);
  assert(has(validation, 'assignment.identity_mismatch'), 'Manual assignment identity was accepted.');
  assert(has(validation, 'assignment.return_to_core_task'), 'Invalid core return cursor was accepted.');
}

async function repositoryValidationBoundary(): Promise<void> {
  const repository = new InMemoryQuestionResourceAdmissionRepository();
  await assertRejects(
    () => repository.saveMaterial({ ...targetedMaterial(), contentHash: undefined }),
    'Material usage is invalid',
  );
}

function baseMaterial(): QuestionMaterialVersion {
  return {
    materialId: 'material-core-1',
    materialVersionId: 'material-core-1:v1',
    versionNumber: 1,
    title: '历史核心材料',
    content: '这是历史材料正文。',
    source: { sourceType: 'manual', description: '历史人工录入' },
    metadata: { tags: [], provenanceStatus: 'verified' },
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function targetedMaterial(
  overrides: Partial<QuestionMaterialVersion> = {},
): QuestionMaterialVersion {
  return {
    ...baseMaterial(),
    materialId: 'targeted-excerpt-1',
    materialVersionId: 'targeted-excerpt-1:v1',
    title: '证据定位微训练片段',
    content: '一段具有完整证据情境的受控原创训练材料。',
    usageType: 'targeted_excerpt',
    contentHash: buildMaterialContentHash('一段具有完整证据情境的受控原创训练材料。'),
    contentNormalizationPolicyVersion: 'material_content_normalization_v1',
    targetedExcerptMetadata: {
      targetAbilityIds: ['extraction'],
      supportedGapReasonCodes: ['missing_text_evidence'],
      sourceRelation: 'controlled_original',
      intendedTaskCount: 1,
    },
    source: { sourceType: 'manual', description: '受控原创训练材料' },
    ...overrides,
  };
}

function requestFixture(
  gapReasonCode: TargetedGapReasonCode = 'missing_text_evidence',
): TargetedMicroTrainingRequest {
  const identity = {
    studentId: 'student-1',
    sourceAttemptId: 'attempt-1',
    gapReasonCode,
  };
  return {
    requestId: buildTargetedMicroTrainingRequestId(identity),
    ...identity,
    learningSessionId: 'session-1',
    sourceLearningRoundId: 'round-3',
    abilityId: 'extraction',
    taskRole: 'training',
    materialRelationPolicy: 'prefer_new_context',
    excludedSourceAnchors: [{
      materialId: 'material-core-1',
      paragraphStart: 2,
      paragraphEnd: 2,
      contentHash: 'source-anchor-hash',
    }],
    excludedResourceVersionIds: ['resource-core-1:v1'],
    maxTaskCount: 1,
    createdAt: NOW,
  };
}

function assignmentFixture(): TargetedMicroTrainingAssignment {
  const input = {
    requestId: requestFixture().requestId,
    resourceVersionId: 'targeted-resource-1:v1',
  };
  return {
    assignmentId: buildTargetedMicroTrainingAssignmentId(input),
    ...input,
    sourceLearningRoundId: 'round-3',
    status: 'pending',
    returnToCoreTaskNumber: 4,
  };
}

function has(
  validation: { issues: Array<{ code: string }> },
  code: string,
): boolean {
  return validation.issues.some((issue) => issue.code === code);
}

function codes(validation: { issues: Array<{ code: string }> }): string {
  return validation.issues.map((issue) => issue.code).join(', ');
}

async function assertRejects(action: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expected), `Unexpected rejection: ${message}`);
    return;
  }
  throw new Error(`Expected rejection containing: ${expected}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

await main();
