import {
  createNextQuestionResourceVersionDraft,
  createQuestionMaterial,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
} from '../agents/questionResourceAdmissionAgent.ts';
import {
  buildFirstFrozenResourcePackManifest,
  buildMaterialObservationPlan,
  buildObservationDiversityView,
  deriveMaterialStructureSnapshot,
  validateMaterialObservationPlan,
  type ObservationTaskPlanInput,
} from '../agents/materialObservationAgent.ts';
import {
  createMaterialAnchor,
  createMaterialStructure,
  createQuestionDraftFromObservationTask,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
  validateAndSaveMaterialObservationPlan,
} from '../agents/materialObservationApplicationService.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  OBSERVATION_DIMENSIONS,
  type DimensionReview,
  type MaterialObservationPlan,
  type ObservationDimension,
} from '../schemas/materialObservation.schema.ts';
import type { PrimaryAbilityId, QuestionResourceRubricItem } from '../schemas/questionResourceAdmission.schema.ts';

const NOW = '2026-07-22T08:00:00.000Z';
const LATER = '2026-07-22T09:00:00.000Z';

type Fixture = Awaited<ReturnType<typeof createFixture>>;
type DebugCase = { name: string; run: () => void | Promise<void> };

const cases: DebugCase[] = [
  { name: '01 valid Material Observation Plan passes', run: caseValidPlan },
  { name: '02 unregistered primary Dimension is blocked', run: caseInvalidDimension },
  { name: '03 missing Material Version is blocked', run: caseMissingMaterial },
  { name: '04 stale or mismatched Source Anchor is blocked', run: caseAnchorMismatch },
  { name: '05 selected Dimension requires source and design reason', run: caseSelectedNeedsEvidence },
  { name: '06 not_suitable Dimension may remain without tasks', run: caseNotSuitableMayBeEmpty },
  { name: '07 one Task cannot own multiple primary Dimensions', run: caseSinglePrimaryDimension },
  { name: '08 unregistered Ability is blocked', run: caseInvalidAbility },
  { name: '09 same Dimension with different Abilities requires distinct actions', run: caseDifferentAbilityDistinctness },
  { name: '10 same Ability across Dimensions remains distinct', run: caseSameAbilityDifferentDimensions },
  { name: '11 Plan does not require a Cartesian matrix', run: caseSparsePlanAllowed },
  { name: '12 duplicate review handoff is idempotent', run: caseReviewIdempotent },
  { name: '13 new Material Version requires new Anchor review', run: caseMaterialVersionRequiresReview },
  { name: '14 reviewed Plan is immutable', run: caseReviewedPlanImmutable },
  { name: '15 Observation Task creates Draft only', run: caseDraftOnly },
  { name: '16 Phase 16.1 still blocks Rubric and Ability mismatch', run: caseRubricMismatch },
  { name: '17 closed identity chain creates active Link', run: caseActiveLink },
  { name: '18 new Frozen version supersedes old observation Link', run: caseLinkSuperseded },
  { name: '19 non-current Resource is excluded from Manifest', run: caseNonCurrentExcluded },
  { name: '20 missing Link remains visible as diversity limitation', run: caseMissingLink },
  { name: '21 transfer design intent is not Runtime proof', run: caseTransferIntentBoundary },
  { name: '22 retest comparison intent is not comparability proof', run: caseRetestIntentBoundary },
  { name: '23 Pack scope and learning-chain gaps remain explicit', run: casePackQuota },
  { name: '24 one-Dimension Ability coverage is reported as biased', run: caseDimensionBias },
  { name: '25 planning and admission create no learner Evidence', run: caseNoLearnerEvidence },
  { name: '26 failed operations do not pollute formal resources', run: caseFailureNoPollution },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.2 Material-grounded Observation Resource Debug');
  console.log('='.repeat(72));
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
  console.log('-'.repeat(72));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  console.log(`Phase 17.2 Engineering: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  if (failures.length) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseValidPlan() {
  const fixture = await createFixture();
  const validation = await validateAndSaveMaterialObservationPlan(fixture.resources, fixture.observations, fixture.plan.materialObservationPlanId, NOW);
  expect(validation.passed, codes(validation));
}

async function caseInvalidDimension() {
  const fixture = await createFixture();
  const plan = clone(fixture.plan);
  plan.dimensionReviews[0].dimension = 'emotion' as never;
  const result = validatePlan(fixture, plan);
  expect(!result.passed && has(result, 'dimension.invalid'), 'Unregistered Dimension was accepted.');
}

async function caseMissingMaterial() {
  const fixture = await createFixture();
  const result = validateMaterialObservationPlan({ plan: fixture.plan, material: null, structure: fixture.structure, anchors: [fixture.anchor], checkedAt: NOW });
  expect(!result.passed && has(result, 'material.missing'), 'Missing Material was silently repaired.');
}

async function caseAnchorMismatch() {
  const fixture = await createFixture();
  const stale = { ...fixture.anchor, contentHash: 'stale-content' };
  const result = validateMaterialObservationPlan({ plan: fixture.plan, material: fixture.material, structure: fixture.structure, anchors: [stale], checkedAt: NOW });
  expect(!result.passed && has(result, 'anchor.identity_mismatch'), 'Stale Anchor passed validation.');
}

async function caseSelectedNeedsEvidence() {
  const fixture = await createFixture();
  const plan = clone(fixture.plan);
  const selected = plan.dimensionReviews.find((value) => value.dimension === 'character')!;
  selected.sourceAnchorIds = [];
  selected.reason = '';
  const result = validatePlan(fixture, plan);
  expect(!result.passed && has(result, 'dimension_anchor.missing') && has(result, 'dimension_reason.missing'), 'Selected Dimension omitted its formal basis.');
}

async function caseNotSuitableMayBeEmpty() {
  const fixture = await createFixture();
  const result = validatePlan(fixture, fixture.plan);
  const structure = fixture.plan.dimensionReviews.find((value) => value.dimension === 'structure');
  expect(result.passed && structure?.decision === 'not_suitable' && structure.sourceAnchorIds.length === 0, 'Explicit not_suitable was treated as missing coverage.');
}

async function caseSinglePrimaryDimension() {
  const fixture = await createFixture();
  const plan = clone(fixture.plan);
  plan.taskPlans[0].primaryDimension = ['character', 'theme'] as never;
  const result = validatePlan(fixture, plan);
  expect(!result.passed && has(result, 'task.dimension_invalid'), 'Multiple primary Dimensions were accepted.');
}

async function caseInvalidAbility() {
  const fixture = await createFixture();
  const plan = clone(fixture.plan);
  plan.taskPlans[0].abilityId = 'psychology_inference' as never;
  const result = validatePlan(fixture, plan);
  expect(!result.passed && has(result, 'task.ability_invalid'), 'Free-form Ability entered the Plan.');
}

async function caseDifferentAbilityDistinctness() {
  const fixture = await createFixture({ tasks: [task(), task({ abilityId: 'analysis' })] });
  const failed = validatePlan(fixture, fixture.plan);
  expect(!failed.passed && has(failed, 'task.cognitive_action_not_distinct'), 'Ability relabeling was accepted as a distinct task.');

  const valid = await createFixture({ tasks: [task(), task({ abilityId: 'analysis', observationGoal: '分析动作塑造的人物特点', expectedStudentAction: '建立动作与人物特点的关系' })] });
  expect(validatePlan(valid, valid.plan).passed, 'Truly distinct Ability actions were blocked.');
}

async function caseSameAbilityDifferentDimensions() {
  const fixture = await createFixture({
    selectedDimensions: ['character', 'causality'],
    tasks: [task(), task({ primaryDimension: 'causality', observationGoal: '解释行为发生的原因', expectedStudentAction: '连接事件前因与人物行为' })],
  });
  const result = validatePlan(fixture, fixture.plan);
  expect(result.passed && new Set(fixture.plan.taskPlans.map((value) => value.primaryDimension)).size === 2, 'Different Dimensions were collapsed.');
}

async function caseSparsePlanAllowed() {
  const fixture = await createFixture();
  expect(validatePlan(fixture, fixture.plan).passed && fixture.plan.taskPlans.length === 1, 'Sparse educational Plan was forced into a Cartesian matrix.');
}

async function caseReviewIdempotent() {
  const fixture = await reviewedFixture();
  const first = await reviewMaterialObservationPlan(fixture.observations, { planId: fixture.plan.materialObservationPlanId, action: 'approve', reviewerId: 'reviewer-17', notes: 'Approved observation design.', now: NOW });
  const second = await reviewMaterialObservationPlan(fixture.observations, { planId: fixture.plan.materialObservationPlanId, action: 'approve', reviewerId: 'another-reviewer', notes: 'Must not replace the committed review.', now: LATER });
  expect(first.reviewId === second.reviewId && first.reviewerId === second.reviewerId, 'Duplicate review replaced the formal result.');
}

async function caseMaterialVersionRequiresReview() {
  const fixture = await createFixture();
  await createQuestionMaterial(fixture.resources, {
    materialId: fixture.material.materialId,
    materialVersionId: 'material-rain:v2', versionNumber: 2, title: '雨中的母亲（修订）',
    content: `${fixture.material.content}\n孩子接过伞，回头看见母亲笑了。`, source: fixture.material.source, createdAt: LATER,
  });
  const v2 = await fixture.resources.getMaterial('material-rain:v2');
  const result = validateMaterialObservationPlan({ plan: fixture.plan, material: v2, structure: fixture.structure, anchors: [fixture.anchor], checkedAt: LATER });
  expect(!result.passed && has(result, 'material.identity_mismatch'), 'Old Plan silently migrated to a new Material Version.');
  expect(Boolean(await fixture.observations.getPlan(fixture.plan.materialObservationPlanId)), 'Old Plan lost traceability.');
}

async function caseReviewedPlanImmutable() {
  const fixture = await reviewedFixture();
  const reviewed = (await fixture.observations.getPlan(fixture.plan.materialObservationPlanId))!;
  await rejects(() => fixture.observations.savePlan({ ...reviewed, reviewNote: 'rewritten' }), 'immutable');
}

async function caseDraftOnly() {
  const fixture = await reviewedFixture();
  const draft = await createDraftForTask(fixture, 'draft-only');
  expect(draft.status === 'drafted', 'Adapter did not create an ordinary Draft.');
  expect((await fixture.resources.listVersions()).length === 0 && (await fixture.resources.listRegistryEntries()).length === 0, 'Adapter auto-froze or changed Registry.');
}

async function caseRubricMismatch() {
  const fixture = await reviewedFixture();
  const draft = await createDraftForTask(fixture, 'rubric-mismatch', 'analysis');
  const validation = await validateStructuredQuestionDraft(fixture.resources, draft.draftId, NOW);
  expect(!validation.passed && validation.issues.some((value) => value.code === 'rubric.main_ability_missing'), 'Phase 16.1 Rubric Gate was bypassed.');
}

async function caseActiveLink() {
  const fixture = await frozenFixture();
  const result = await linkFrozenResourceToObservationTask(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, observationTaskPlanId: fixture.plan.taskPlans[0].observationTaskPlanId, resourceVersionId: fixture.version.resourceVersionId, linkedAt: NOW });
  expect(result.link.status === 'active' && result.issues.length === 0, result.issues.join(','));
}

async function caseLinkSuperseded() {
  const fixture = await frozenFixture();
  const taskId = fixture.plan.taskPlans[0].observationTaskPlanId;
  const first = await linkFrozenResourceToObservationTask(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, observationTaskPlanId: taskId, resourceVersionId: fixture.version.resourceVersionId, linkedAt: NOW });
  const draft = await createNextQuestionResourceVersionDraft(fixture.resources, { resourceId: fixture.version.resourceId, draftId: 'draft-link-v2', now: LATER });
  await updateStructuredQuestionDraft(fixture.resources, draft.draftId, { questionStem: `${draft.questionStem} 请进一步说明。` }, LATER);
  await approveAndFreeze(fixture.resources, draft.draftId, LATER);
  const v2 = (await fixture.resources.listVersions(fixture.version.resourceId)).find((value) => value.versionNumber === 2)!;
  const second = await linkFrozenResourceToObservationTask(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, observationTaskPlanId: taskId, resourceVersionId: v2.resourceVersionId, linkedAt: LATER });
  expect(second.link.status === 'active' && (await fixture.observations.getLink(first.link.resourceObservationLinkId))?.status === 'superseded', 'Old Link was not superseded.');
  expect((await fixture.resources.getVersion(fixture.version.resourceVersionId))?.status === 'superseded', 'Historical Frozen Version did not remain traceable.');
}

async function caseNonCurrentExcluded() {
  const fixture = await frozenFixture();
  const active = await linkFrozenResourceToObservationTask(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, observationTaskPlanId: fixture.plan.taskPlans[0].observationTaskPlanId, resourceVersionId: fixture.version.resourceVersionId });
  await fixture.resources.saveRegistryEntry({ ...(await fixture.resources.getRegistryEntry(fixture.version.resourceId))!, currentFrozenVersionId: 'missing-new-head' });
  const manifest = buildFirstFrozenResourcePackManifest({ resourcePackVersion: 'v1', coverageReportIdBefore: 'before', coverageReportIdAfter: 'after', plans: [fixture.plan], links: [active.link], versions: [fixture.version], registryEntries: await fixture.resources.listRegistryEntries(), frozenAt: NOW });
  expect(manifest.resourceVersionIds.length === 0, 'Non-current Resource entered the Manifest.');
}

async function caseMissingLink() {
  const fixture = await frozenFixture();
  const manifest = buildFirstFrozenResourcePackManifest({ resourcePackVersion: 'v1', coverageReportIdBefore: 'before', coverageReportIdAfter: 'after', plans: [fixture.plan], links: [], versions: [fixture.version], registryEntries: await fixture.resources.listRegistryEntries(), frozenAt: NOW });
  const view = buildObservationDiversityView({ manifest, registrySnapshotId: 'registry-1', executableVersions: [fixture.version], registryEntries: await fixture.resources.listRegistryEntries(), links: [], generatedAt: NOW });
  const inference = view.abilities.find((value) => value.abilityId === 'inference')!;
  expect(inference.executableResourceCount === 1 && inference.linkedResourceCount === 0 && inference.limitations.includes('unlinked_executable_resources'), 'Missing Link was hidden from Diversity.');
}

async function caseTransferIntentBoundary() {
  const fixture = await createFixture({ tasks: [task({ taskRole: 'transfer', intendedComparisonGroupId: 'comparison-transfer-a', materialRelationIntent: 'new_context' })] });
  const planned = fixture.plan.taskPlans[0];
  expect(planned.materialRelationIntent === 'new_context' && !('materialRelation' in planned), 'Design intent was converted into observed Runtime fact.');
}

async function caseRetestIntentBoundary() {
  const fixture = await createFixture({ tasks: [task({ taskRole: 'retest', intendedComparisonGroupId: 'comparison-a' })] });
  const planned = fixture.plan.taskPlans[0] as unknown as Record<string, unknown>;
  expect(planned.intendedComparisonGroupId === 'comparison-a' && !('comparabilityStatus' in planned), 'Retest intent fabricated comparability.');
}

async function casePackQuota() {
  const fixture = await frozenFixture();
  const linked = await linkFrozenResourceToObservationTask(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, observationTaskPlanId: fixture.plan.taskPlans[0].observationTaskPlanId, resourceVersionId: fixture.version.resourceVersionId });
  const manifest = buildFirstFrozenResourcePackManifest({ resourcePackVersion: 'v1', coverageReportIdBefore: 'before', coverageReportIdAfter: 'after', plans: [fixture.plan], links: [linked.link], versions: [fixture.version], registryEntries: await fixture.resources.listRegistryEntries(), frozenAt: NOW });
  expect(
    manifest.limitations.includes('resource_pack_below_24') &&
    manifest.limitations.includes('ability_target_below_min:inference') &&
    manifest.limitations.includes('training_retest_chain_below_2') &&
    manifest.limitations.includes('training_transfer_chain_below_2') &&
    !manifest.limitations.some((item) => item.startsWith('retest_quota_missing:')),
    'Pack scope still requires per-ability role quotas or hides missing learning chains.',
  );
}

async function caseDimensionBias() {
  const fixture = await frozenFixture();
  const linked = await linkFrozenResourceToObservationTask(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, observationTaskPlanId: fixture.plan.taskPlans[0].observationTaskPlanId, resourceVersionId: fixture.version.resourceVersionId });
  const manifest = buildFirstFrozenResourcePackManifest({ resourcePackVersion: 'v1', coverageReportIdBefore: 'coverage-before', coverageReportIdAfter: 'coverage-after', plans: [fixture.plan], links: [linked.link], versions: [fixture.version], registryEntries: await fixture.resources.listRegistryEntries(), frozenAt: NOW });
  const view = buildObservationDiversityView({ manifest, registrySnapshotId: 'registry-1', executableVersions: [fixture.version], registryEntries: await fixture.resources.listRegistryEntries(), links: [linked.link], generatedAt: NOW });
  const inference = view.abilities.find((value) => value.abilityId === 'inference')!;
  expect(inference.diversityStatus === 'single_dimension' && manifest.coverageReportIdAfter === 'coverage-after', 'Dimension bias rewrote Primary Coverage semantics.');
}

async function caseNoLearnerEvidence() {
  const fixture = await frozenFixture();
  const serialized = JSON.stringify({ plans: await fixture.observations.listPlans(), drafts: await fixture.resources.listDrafts(), versions: await fixture.resources.listVersions() });
  expect(!serialized.includes('AbilityEvidence') && !serialized.includes('ProfileUpdateDecision') && !serialized.includes('GrowthMemory'), 'Resource design created learner facts.');
}

async function caseFailureNoPollution() {
  const fixture = await reviewedFixture();
  const before = { versions: (await fixture.resources.listVersions()).length, registry: (await fixture.resources.listRegistryEntries()).length, manifests: (await fixture.observations.listManifests()).length };
  await rejects(() => linkFrozenResourceToObservationTask(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, observationTaskPlanId: fixture.plan.taskPlans[0].observationTaskPlanId, resourceVersionId: 'missing-version' }), 'not found');
  const after = { versions: (await fixture.resources.listVersions()).length, registry: (await fixture.resources.listRegistryEntries()).length, manifests: (await fixture.observations.listManifests()).length };
  expect(JSON.stringify(before) === JSON.stringify(after), 'Failed Link operation polluted formal stores.');
}

async function createFixture(options: { selectedDimensions?: ObservationDimension[]; tasks?: ObservationTaskPlanInput[] } = {}) {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const observations = new InMemoryMaterialObservationRepository();
  const material = await createQuestionMaterial(resources, {
    materialId: 'material-rain', materialVersionId: 'material-rain:v1', versionNumber: 1, title: '雨中的母亲',
    content: '雨越下越大，母亲把伞更多地推向孩子。\n自己的肩膀很快被雨淋湿，她仍催孩子快些走。',
    source: { sourceType: 'manual', description: 'Phase 17.2 synthetic reviewed material.', copyrightNote: 'Synthetic validation content.' }, createdAt: NOW,
  });
  const structure = await createMaterialStructure(resources, observations, material.materialVersionId, NOW);
  const anchor = await createMaterialAnchor(resources, observations, { materialVersionId: material.materialVersionId, materialStructureSnapshotId: structure.materialStructureSnapshotId, anchorType: 'full_text' });
  const selected = options.selectedDimensions || ['character'];
  const reviews: DimensionReview[] = OBSERVATION_DIMENSIONS.map((dimension) => ({
    dimension,
    decision: selected.includes(dimension) ? 'selected' : 'not_suitable',
    reason: selected.includes(dimension) ? `${dimension} contains a reviewable observation.` : `${dimension} is not a priority in this material pack.`,
    sourceAnchorIds: selected.includes(dimension) ? [anchor.sourceAnchorId] : [],
  }));
  const tasks = (options.tasks || [task()]).map((value) => ({ ...value, sourceAnchorIds: [anchor.sourceAnchorId] }));
  const plan = buildMaterialObservationPlan({ materialId: material.materialId, materialVersionId: material.materialVersionId, materialStructureSnapshotId: structure.materialStructureSnapshotId, dimensionReviews: reviews, taskPlans: tasks, now: NOW });
  await observations.savePlan(plan);
  return { resources, observations, material, structure, anchor, plan };
}

async function reviewedFixture(options: Parameters<typeof createFixture>[0] = {}) {
  const fixture = await createFixture(options);
  await submitMaterialObservationPlanForReview(fixture.resources, fixture.observations, fixture.plan.materialObservationPlanId, NOW);
  await reviewMaterialObservationPlan(fixture.observations, { planId: fixture.plan.materialObservationPlanId, action: 'approve', reviewerId: 'reviewer-17', notes: 'Observation design is aligned with the material.', now: NOW });
  fixture.plan = (await fixture.observations.getPlan(fixture.plan.materialObservationPlanId))!;
  return fixture;
}

async function frozenFixture() {
  const fixture = await reviewedFixture();
  const draft = await createDraftForTask(fixture, 'frozen');
  const version = await approveAndFreeze(fixture.resources, draft.draftId, NOW);
  return { ...fixture, version };
}

async function createDraftForTask(fixture: Fixture, suffix: string, rubricAbility: PrimaryAbilityId = 'inference') {
  return createQuestionDraftFromObservationTask(fixture.resources, fixture.observations, {
    planId: fixture.plan.materialObservationPlanId,
    observationTaskPlanId: fixture.plan.taskPlans[0].observationTaskPlanId,
    content: draftContent(suffix, rubricAbility),
  });
}

async function approveAndFreeze(resources: InMemoryQuestionResourceAdmissionRepository, draftId: string, now: string) {
  const validation = await validateStructuredQuestionDraft(resources, draftId, now);
  expect(validation.passed, codes(validation));
  await submitQuestionResourceForReview(resources, draftId, now);
  await reviewQuestionResourceDraft(resources, { draftId, action: 'approve', reviewerId: 'resource-reviewer', notes: 'Resource content and Rubric are approved.', now });
  return (await freezeQuestionResourceDraft(resources, draftId, now)).version;
}

function task(overrides: Partial<ObservationTaskPlanInput> = {}): ObservationTaskPlanInput {
  return {
    primaryDimension: 'character', abilityId: 'inference', taskRole: 'training', difficulty: 'intermediate', sourceAnchorIds: [],
    observationGoal: '根据人物动作推断人物心理', expectedStudentAction: '引用动作并解释动作与心理的关系', designReason: '材料提供了明确动作与隐含心理。',
    ...overrides,
  };
}

function draftContent(suffix: string, rubricAbility: PrimaryAbilityId): Omit<CreateStructuredQuestionDraftInput, 'materialVersionId' | 'abilityMetadata' | 'tags'> & { tags?: string[] } {
  return {
    draftId: `observation-draft-${suffix}`, resourceId: `observation-resource-${suffix}`, taskId: `observation-question-${suffix}`,
    title: '人物心理推断', questionStem: '结合母亲撑伞时的动作，说明她当时的心理。', questionType: 'reading_comprehension', responseFormat: 'long_text', assessmentMode: 'reasoning_chain',
    answerAcceptance: { acceptedKeywords: ['母亲', '孩子', '伞'], semanticEquivalentAllowed: true, normalizationRules: ['trim'] },
    rubric: rubric(rubricAbility), minimumAnswerRequirement: { minLength: 10, requireTextEvidence: true, requireExplanation: true },
    source: { sourceType: 'manual', description: 'Human-authored Phase 17.2 debug resource.', copyrightNote: 'Synthetic validation content.' }, tags: ['人物', '推理'], now: NOW,
  };
}

function rubric(abilityId: PrimaryAbilityId): QuestionResourceRubricItem[] {
  return [{ itemId: 'relation', name: '动作与心理关系', abilityId, importance: 'critical', required: true, evidenceRequirement: { requireTextEvidence: true, requireExplanation: true, requireConclusion: true }, acceptedSignals: ['动作细节', '心理结论', '关系说明'] }];
}

function validatePlan(fixture: Fixture, plan: MaterialObservationPlan) {
  return validateMaterialObservationPlan({ plan, material: fixture.material, structure: fixture.structure, anchors: [fixture.anchor], checkedAt: NOW });
}
function has(result: { issues: Array<{ code: string }> }, code: string) { return result.issues.some((value) => value.code === code); }
function codes(result: { issues: Array<{ code: string }> }) { return result.issues.map((value) => value.code).join(', '); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function expect(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function rejects(action: () => Promise<unknown>, message: string) {
  try { await action(); } catch (error) { expect(String(error).toLowerCase().includes(message.toLowerCase()), `Expected error containing ${message}, got ${String(error)}`); return; }
  throw new Error(`Expected rejection containing ${message}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
