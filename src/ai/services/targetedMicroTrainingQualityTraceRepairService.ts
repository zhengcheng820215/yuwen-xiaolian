import { createQualityArtifacts } from '../agents/materialCorpusOptimizationAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { cloneSharedFormalResourceValue, type SharedFormalResourceSnapshot } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { QuestionQualityAssessment } from
  '../schemas/questionQualityAssessment.schema.ts';
import type { FrozenQuestionQualityTrace } from
  '../schemas/questionQualityPersistence.schema.ts';
import type {
  QuestionQualityAssessmentBundle,
  QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';
import type { SharedFormalResourceAtomicCommand } from
  '../../server/sharedFormalResourceStore.ts';

export const TARGETED_QUALITY_TRACE_REPAIR_POLICY_VERSION =
  'targeted_quality_trace_repair_v1' as const;

export type TargetedQualityTraceRepairReport = {
  policyVersion: typeof TARGETED_QUALITY_TRACE_REPAIR_POLICY_VERSION;
  sourceRevision: number;
  targetResourceVersionIds: string[];
  repairedTraceIds: string[];
  before: {
    currentTasks: number;
    frozenQualityTraces: number;
    learningConsumableQuestions: number;
    missingTraceIssues: number;
    identityMismatchIssues: number;
  };
  after: {
    currentTasks: number;
    frozenQualityTraces: number;
    learningConsumableQuestions: number;
    missingTraceIssues: number;
    identityMismatchIssues: number;
  };
  nonQualityDigestBefore: string;
  nonQualityDigestAfter: string;
  changed: boolean;
};

export type PreparedTargetedQualityTraceRepair = {
  report: TargetedQualityTraceRepairReport;
  command?: SharedFormalResourceAtomicCommand;
};

export function prepareTargetedMicroTrainingQualityTraceRepair(
  snapshot: SharedFormalResourceSnapshot,
  repairedAt: string,
): PreparedTargetedQualityTraceRepair {
  if (!snapshot.initialized) throw new Error('Shared formal resource store is not initialized.');
  const beforeBaseline = buildQuestionOptimizationBaseline(snapshot);
  const data = cloneSharedFormalResourceValue(snapshot.data);
  const materialByVersionId = new Map(data.questionResources.materials.map((material) => (
    [material.materialVersionId, material]
  )));
  const versionById = new Map(data.questionResources.versions.map((version) => (
    [version.resourceVersionId, version]
  )));
  const draftById = new Map(data.questionResources.drafts.map((draft) => [draft.draftId, draft]));
  const validationById = new Map(data.questionResources.validations.map((validation) => (
    [validation.validationId, validation]
  )));
  const reviewById = new Map(data.questionResources.reviews.map((review) => (
    [review.reviewId, review]
  )));
  const taskById = new Map(data.materialObservations.plans.flatMap((plan) => (
    plan.taskPlans.map((task) => [task.observationTaskPlanId, task] as const)
  )));
  const anchorById = new Map(data.materialObservations.anchors.map((anchor) => (
    [anchor.sourceAnchorId, anchor]
  )));
  const targetItems = beforeBaseline.items.filter((item) => (
    !item.qualityTraceId
    && materialByVersionId.get(item.materialVersionId)?.usageType === 'targeted_excerpt'
  ));
  const targetIds = targetItems.map((item) => item.resourceVersionId).sort();
  const unexpectedIdentityIssues = beforeBaseline.issues.filter((issue) => (
    issue.startsWith('learning_identity_mismatch:')
  ));
  if (unexpectedIdentityIssues.length > 0) {
    throw new Error(`Targeted quality trace repair found structural identity issues: ${unexpectedIdentityIssues.join(', ')}`);
  }

  const traces: FrozenQuestionQualityTrace[] = [];
  for (const item of targetItems) {
    const version = versionById.get(item.resourceVersionId);
    const material = materialByVersionId.get(item.materialVersionId);
    const draft = version && draftById.get(version.sourceDraftId);
    const validation = version && validationById.get(version.validationId);
    const review = version && reviewById.get(version.reviewId);
    const task = taskById.get(item.observationTaskPlanId);
    const materialAnchor = task?.sourceAnchorIds.length === 1
      ? anchorById.get(task.sourceAnchorIds[0])
      : undefined;
    if (!version || version.status !== 'frozen' || !material || material.status === 'retired'
      || !draft || !validation || !review || !task || !materialAnchor) {
      throw new Error(`Cannot repair quality trace for ${item.resourceVersionId}: source evidence is incomplete.`);
    }
    if (draft.latestValidationId !== validation.validationId
      || validation.draftId !== draft.draftId
      || validation.passed !== true
      || review.draftId !== draft.draftId
      || review.validationId !== validation.validationId
      || review.action !== 'approve'
      || version.resourceId !== draft.resourceId
      || version.materialVersionId !== material.materialVersionId
      || task.materialVersionId !== material.materialVersionId
      || materialAnchor.materialId !== material.materialId
      || materialAnchor.materialVersionId !== material.materialVersionId) {
      throw new Error(`Cannot repair quality trace for ${item.resourceVersionId}: source identity is inconsistent.`);
    }
    const peers = targetItems
      .filter((peer) => peer.materialVersionId === item.materialVersionId
        && peer.resourceVersionId !== item.resourceVersionId)
      .map((peer) => versionById.get(peer.resourceVersionId))
      .map((peerVersion) => peerVersion && draftById.get(peerVersion.sourceDraftId))
      .filter((peer): peer is NonNullable<typeof peer> => Boolean(peer));
    const quality = createQualityArtifacts({
      draft,
      validation,
      material,
      materialAnchor,
      peerDrafts: peers,
      review,
      version,
      now: repairedAt,
    });
    const deterministic = reuseOrAppend(
      data.questionQuality.deterministicAssessments,
      'assessmentId',
      quality.deterministic,
      assertDeterministicIdentity,
    );
    const semantic = reuseOrAppend(
      data.questionQuality.semanticAssessments,
      'semanticAssessmentId',
      { ...quality.semantic, deterministicAssessmentId: deterministic.assessmentId },
      assertSemanticIdentity,
    );
    const bundle = reuseOrAppend(
      data.questionQuality.assessmentBundles,
      'bundleId',
      {
        ...quality.bundle,
        deterministicAssessmentId: deterministic.assessmentId,
        semanticAssessmentId: semantic.semanticAssessmentId,
      },
      assertBundleIdentity,
    );
    const trace: FrozenQuestionQualityTrace = {
      ...quality.trace,
      deterministicAssessmentId: deterministic.assessmentId,
      semanticAssessmentId: semantic.semanticAssessmentId,
      bundleId: bundle.bundleId,
    };
    const existingTrace = data.questionQuality.frozenQualityTraces.find((candidate) => (
      candidate.resourceVersionId === version.resourceVersionId
    ));
    if (existingTrace) {
      throw new Error(`Cannot repair quality trace for ${item.resourceVersionId}: a trace appeared during preparation.`);
    }
    data.questionQuality.frozenQualityTraces.push(trace);
    traces.push(trace);
  }

  const afterSnapshot: SharedFormalResourceSnapshot = {
    ...snapshot,
    data,
  };
  const afterBaseline = buildQuestionOptimizationBaseline(afterSnapshot);
  const nonQualityDigestBefore = digestNonQuality(snapshot);
  const nonQualityDigestAfter = digestNonQuality(afterSnapshot);
  if (nonQualityDigestBefore !== nonQualityDigestAfter) {
    throw new Error('Targeted quality trace repair changed non-quality formal resource data.');
  }
  if (targetIds.length > 0 && (
    afterBaseline.counts.currentTasks !== afterBaseline.counts.frozenQualityTraces
    || afterBaseline.counts.currentTasks !== afterBaseline.counts.learningConsumableQuestions
    || afterBaseline.issues.length > 0
  )) {
    throw new Error(`Targeted quality trace repair did not close the baseline: ${afterBaseline.issues.join(', ')}`);
  }

  const report: TargetedQualityTraceRepairReport = {
    policyVersion: TARGETED_QUALITY_TRACE_REPAIR_POLICY_VERSION,
    sourceRevision: snapshot.revision,
    targetResourceVersionIds: targetIds,
    repairedTraceIds: traces.map((trace) => trace.traceId).sort(),
    before: baselineSummary(beforeBaseline),
    after: baselineSummary(afterBaseline),
    nonQualityDigestBefore,
    nonQualityDigestAfter,
    changed: targetIds.length > 0,
  };
  if (!report.changed) return { report };
  return {
    report,
    command: {
      commandType: 'apply_collection_patch',
      commandId: `${TARGETED_QUALITY_TRACE_REPAIR_POLICY_VERSION}:${hashValue(targetIds)}`,
      patches: [
        {
          scope: 'questionQuality',
          collection: 'deterministicAssessments',
          values: data.questionQuality.deterministicAssessments,
        },
        {
          scope: 'questionQuality',
          collection: 'semanticAssessments',
          values: data.questionQuality.semanticAssessments,
        },
        {
          scope: 'questionQuality',
          collection: 'assessmentBundles',
          values: data.questionQuality.assessmentBundles,
        },
        {
          scope: 'questionQuality',
          collection: 'frozenQualityTraces',
          values: data.questionQuality.frozenQualityTraces,
        },
      ],
    },
  };
}

function baselineSummary(baseline: ReturnType<typeof buildQuestionOptimizationBaseline>) {
  return {
    currentTasks: baseline.counts.currentTasks,
    frozenQualityTraces: baseline.counts.frozenQualityTraces,
    learningConsumableQuestions: baseline.counts.learningConsumableQuestions,
    missingTraceIssues: baseline.issues.filter((issue) => (
      issue.startsWith('frozen_quality_trace_missing:')
    )).length,
    identityMismatchIssues: baseline.issues.filter((issue) => (
      issue.startsWith('learning_identity_mismatch:')
    )).length,
  };
}

function reuseOrAppend<T extends object, K extends keyof T>(
  collection: T[],
  key: K,
  value: T,
  assertIdentity: (left: T, right: T) => void,
): T {
  const existing = collection.find((candidate) => candidate[key] === value[key]);
  if (existing) {
    assertIdentity(existing, value);
    return existing;
  }
  collection.push(value);
  return value;
}

function assertDeterministicIdentity(
  left: QuestionQualityAssessment,
  right: QuestionQualityAssessment,
): void {
  assertFieldsEqual(left, right, [
    'assessmentId', 'draftId', 'resourceId', 'assessedDraftRevision',
    'validationId', 'comparisonContextHash', 'ruleVersion',
  ]);
}

function assertSemanticIdentity(
  left: QuestionSemanticQualityAssessment,
  right: QuestionSemanticQualityAssessment,
): void {
  assertFieldsEqual(left, right, [
    'semanticAssessmentId', 'semanticRequestKey', 'draftId', 'resourceId',
    'assessedDraftRevision', 'validationId', 'materialVersionId',
    'deterministicAssessmentId', 'semanticRuleVersion',
  ]);
}

function assertBundleIdentity(
  left: QuestionQualityAssessmentBundle,
  right: QuestionQualityAssessmentBundle,
): void {
  assertFieldsEqual(left, right, [
    'bundleId', 'draftId', 'resourceId', 'assessedDraftRevision', 'validationId',
    'deterministicAssessmentId', 'semanticAssessmentId', 'mergeRuleVersion',
  ]);
}

function assertFieldsEqual<T extends object>(
  left: T,
  right: T,
  fields: Array<keyof T>,
): void {
  const mismatch = fields.find((field) => left[field] !== right[field]);
  if (mismatch) {
    throw new Error(`Quality artifact identity conflict: ${String(mismatch)}.`);
  }
}

function digestNonQuality(snapshot: SharedFormalResourceSnapshot): string {
  return hashValue({
    questionResources: snapshot.data.questionResources,
    materialObservations: snapshot.data.materialObservations,
  });
}

function hashValue(value: unknown): string {
  const serialized = JSON.stringify(normalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, normalize(child)]));
}
