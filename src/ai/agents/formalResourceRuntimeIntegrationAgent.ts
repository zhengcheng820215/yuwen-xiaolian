import type { MaterialObservationRepository } from '../repositories/materialObservationRepository.ts';
import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type {
  MaterialObservationPlan,
  ObservationDimension,
  ObservationTaskPlan,
  ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import type { QualityGatedExecutableTask } from '../schemas/resourceMatchQuality.schema.ts';
import type { TaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';
import {
  createMaterialSourceAnchor,
  deriveMaterialStructureSnapshot,
} from './materialObservationAgent.ts';
import {
  prepareConcreteLearningTaskFromFrozenResource,
  type FrozenQuestionResourceTaskPreparationResult,
} from './frozenQuestionResourceTaskAdapter.ts';

export type FormalResourceRuntimeSourceContext = {
  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  materialId: string;
  materialVersionId: string;
  materialContentHash: string;
  abilityId: string;
  taskRole: FrozenQuestionResourceVersion['abilityMetadata']['taskRole'];
  difficulty: FrozenQuestionResourceVersion['abilityMetadata']['difficulty'];
  validationId: string;
  reviewId: string;
  resourceObservationLinkId: string;
  materialObservationPlanId: string;
  observationTaskPlanId: string;
  primaryDimension: ObservationDimension;
  sourceAnchorIds: string[];
  observationGoal: string;
  expectedStudentAction: string;
  designReason: string;
};

export type FormalResourceRuntimeSourceResolution = {
  status: 'ready' | 'review_required' | 'blocked';
  resourceVersion?: FrozenQuestionResourceVersion;
  link?: ResourceObservationLink;
  plan?: MaterialObservationPlan;
  observationTask?: ObservationTaskPlan;
  sourceContext?: FormalResourceRuntimeSourceContext;
  checks: {
    resourceExists: boolean;
    frozenCurrentVersion: boolean;
    registryIdentityAligned: boolean;
    materialExists: boolean;
    materialVersionAligned: boolean;
    frozenMaterialSnapshotAligned: boolean;
    activeObservationLinkUnique: boolean;
    observationLinkIdentityAligned: boolean;
    reviewedObservationPlan: boolean;
    materialStructureAligned: boolean;
    observationTaskIdentityAligned: boolean;
    sourceAnchorsTraceable: boolean;
  };
  issues: string[];
};

export type FormalResourceRuntimeTaskPreparation = {
  status: 'prepared' | 'review_required' | 'blocked';
  sourceResolution: FormalResourceRuntimeSourceResolution;
  taskPreparation?: FrozenQuestionResourceTaskPreparationResult;
  issues: string[];
};

export type FormalResourceLearningTraceValidation = {
  passed: boolean;
  checks: {
    concreteTaskIdentityPreserved: boolean;
    diagnosisAbilityPreserved: boolean;
    evidenceAbilityPreserved: boolean;
    evidenceTaskPreserved: boolean;
    responseAndDiagnosisTraceComplete: boolean;
  };
  trace: {
    resourceId: string;
    resourceVersionId: string;
    materialId: string;
    materialVersionId: string;
    materialContentHash: string;
    resourceObservationLinkId: string;
    observationTaskPlanId: string;
    evidenceIds: string[];
    responseIds: string[];
    diagnosisIds: string[];
  };
  issues: string[];
};

export async function resolveFormalResourceRuntimeSource(input: {
  resourceVersionId: string;
  resourceRepository: QuestionResourceAdmissionRepository;
  observationRepository: MaterialObservationRepository;
}): Promise<FormalResourceRuntimeSourceResolution> {
  const version = await input.resourceRepository.getVersion(input.resourceVersionId);
  if (!version) return blockedResolution('formal_resource_version_missing');

  const [registry, material, links] = await Promise.all([
    input.resourceRepository.getRegistryEntry(version.resourceId),
    version.materialVersionId
      ? input.resourceRepository.getMaterial(version.materialVersionId)
      : Promise.resolve(null),
    input.observationRepository.listLinks(version.resourceId),
  ]);
  const activeLinks = links.filter((link) => (
    link.status === 'active' &&
    link.resourceVersionId === version.resourceVersionId
  ));
  const link = activeLinks.length === 1 ? activeLinks[0] : undefined;
  const plan = link
    ? await input.observationRepository.getPlan(link.materialObservationPlanId)
    : null;
  const observationTask = plan && link
    ? plan.taskPlans.find((task) => task.observationTaskPlanId === link.observationTaskPlanId)
    : undefined;
  const structure = plan
    ? await input.observationRepository.getStructure(plan.materialStructureSnapshotId)
    : null;
  const anchors = observationTask
    ? await Promise.all(observationTask.sourceAnchorIds.map((anchorId) => (
      input.observationRepository.getAnchor(anchorId)
    )))
    : [];

  const checks = {
    resourceExists: true,
    frozenCurrentVersion: version.status === 'frozen' &&
      registry?.status === 'active' &&
      registry.currentFrozenVersionId === version.resourceVersionId,
    registryIdentityAligned: Boolean(
      registry &&
      registry.resourceId === version.resourceId &&
      registry.taskId === version.taskId &&
      registry.abilityId === version.abilityMetadata.abilityId &&
      registry.taskRole === version.abilityMetadata.taskRole &&
      registry.difficulty === version.abilityMetadata.difficulty
    ),
    materialExists: Boolean(material),
    materialActive: Boolean(material && material.status !== 'retired'),
    materialVersionAligned: Boolean(
      material &&
      version.materialId &&
      material.materialId === version.materialId &&
      material.materialVersionId === version.materialVersionId
    ),
    frozenMaterialSnapshotAligned: Boolean(
      material &&
      version.materialSnapshot &&
      materialIdentityAndContentEqual(material, version.materialSnapshot) &&
      version.materialSnapshot.materialId === version.materialId &&
      version.materialSnapshot.materialVersionId === version.materialVersionId
    ),
    activeObservationLinkUnique: activeLinks.length === 1,
    observationLinkIdentityAligned: Boolean(
      link &&
      link.resourceId === version.resourceId &&
      link.resourceVersionId === version.resourceVersionId &&
      link.materialId === version.materialId &&
      link.materialVersionId === version.materialVersionId &&
      link.abilityId === version.abilityMetadata.abilityId &&
      link.taskRole === version.abilityMetadata.taskRole &&
      link.difficulty === version.abilityMetadata.difficulty
    ),
    reviewedObservationPlan: plan?.status === 'reviewed',
    materialStructureAligned: Boolean(
      material &&
      plan &&
      structure &&
      plan.materialId === version.materialId &&
      plan.materialVersionId === version.materialVersionId &&
      structure.materialStructureSnapshotId === plan.materialStructureSnapshotId &&
      structure.materialId === version.materialId &&
      structure.materialVersionId === version.materialVersionId &&
      deriveMaterialStructureSnapshot(material, structure.createdAt).contentHash === structure.contentHash
    ),
    observationTaskIdentityAligned: Boolean(
      observationTask &&
      link &&
      observationTask.materialId === version.materialId &&
      observationTask.materialVersionId === version.materialVersionId &&
      observationTask.primaryDimension === link.primaryDimension &&
      observationTask.abilityId === version.abilityMetadata.abilityId &&
      observationTask.taskRole === version.abilityMetadata.taskRole &&
      observationTask.difficulty === version.abilityMetadata.difficulty &&
      observationTask.status !== 'cancelled' &&
      (
        !observationTask.linkedResourceId ||
        observationTask.linkedResourceId === version.resourceId
      )
    ),
    sourceAnchorsTraceable: Boolean(
      observationTask &&
      material &&
      structure &&
      observationTask.sourceAnchorIds.length > 0 &&
      anchors.length === observationTask.sourceAnchorIds.length &&
      anchors.every((anchor) => isAnchorValidForMaterial(
        anchor,
        material,
        structure,
        version.materialId,
        version.materialVersionId,
      ))
    ),
  };
  const issues = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `formal_resource_source_check_failed:${check}`);
  const hardBlockingFailure = !checks.materialExists ||
    !checks.materialActive ||
    !checks.materialVersionAligned ||
    !checks.frozenMaterialSnapshotAligned ||
    !checks.materialStructureAligned ||
    !checks.sourceAnchorsTraceable;
  const traceFailure = !checks.frozenCurrentVersion ||
    !checks.registryIdentityAligned ||
    !checks.activeObservationLinkUnique ||
    !checks.observationLinkIdentityAligned ||
    !checks.reviewedObservationPlan ||
    !checks.observationTaskIdentityAligned;
  const status = issues.length === 0
    ? 'ready'
    : hardBlockingFailure
      ? 'blocked'
      : traceFailure
      ? 'review_required'
      : 'blocked';
  const sourceContext = status === 'ready' &&
    link &&
    plan &&
    observationTask &&
    structure &&
    version.materialId &&
    version.materialVersionId
    ? {
      resourceId: version.resourceId,
      resourceVersionId: version.resourceVersionId,
      taskId: version.taskId,
      materialId: version.materialId,
      materialVersionId: version.materialVersionId,
      materialContentHash: structure.contentHash,
      abilityId: version.abilityMetadata.abilityId,
      taskRole: version.abilityMetadata.taskRole,
      difficulty: version.abilityMetadata.difficulty,
      validationId: version.validationId,
      reviewId: version.reviewId,
      resourceObservationLinkId: link.resourceObservationLinkId,
      materialObservationPlanId: plan.materialObservationPlanId,
      observationTaskPlanId: observationTask.observationTaskPlanId,
      primaryDimension: observationTask.primaryDimension,
      sourceAnchorIds: [...observationTask.sourceAnchorIds],
      observationGoal: observationTask.observationGoal,
      expectedStudentAction: observationTask.expectedStudentAction,
      designReason: observationTask.designReason,
    }
    : undefined;

  return {
    status,
    resourceVersion: version,
    link,
    plan: plan || undefined,
    observationTask,
    sourceContext,
    checks,
    issues,
  };
}

export async function prepareFormalResourceRuntimeTask(input: {
  resourceVersionId: string;
  qualityGatedTask: QualityGatedExecutableTask;
  resourceRepository: QuestionResourceAdmissionRepository;
  observationRepository: MaterialObservationRepository;
  createdAt?: string;
}): Promise<FormalResourceRuntimeTaskPreparation> {
  const sourceResolution = await resolveFormalResourceRuntimeSource(input);
  if (sourceResolution.status !== 'ready' || !sourceResolution.resourceVersion) {
    return {
      status: sourceResolution.status,
      sourceResolution,
      issues: sourceResolution.issues,
    };
  }
  const taskPreparation = prepareConcreteLearningTaskFromFrozenResource({
    resourceVersion: sourceResolution.resourceVersion,
    qualityGatedTask: input.qualityGatedTask,
    learningIntent: sourceResolution.sourceContext
      ? {
        sourceObservationTaskPlanId: sourceResolution.sourceContext.observationTaskPlanId,
        observationGoal: sourceResolution.sourceContext.observationGoal,
        expectedStudentAction: sourceResolution.sourceContext.expectedStudentAction,
        designReason: sourceResolution.sourceContext.designReason,
        isFoundationEntry: sourceResolution.resourceVersion.tags.includes('sequence-prelude:true'),
      }
      : undefined,
    createdAt: input.createdAt,
  });
  return {
    status: taskPreparation.status === 'prepared' ? 'prepared' : 'blocked',
    sourceResolution,
    taskPreparation,
    issues: unique([...sourceResolution.issues, ...taskPreparation.issues]),
  };
}

export function validateFormalResourceLearningTrace(input: {
  sourceContext: FormalResourceRuntimeSourceContext;
  concreteTask: ConcreteLearningTask;
  diagnosisResult?: DiagnosisResult;
  evidenceReturnResult?: TaskEvidenceReturnResult;
}): FormalResourceLearningTraceValidation {
  const evidence = input.evidenceReturnResult?.abilityEvidence || [];
  const traceLinks = input.evidenceReturnResult?.evidenceTraceLinks || [];
  const checks = {
    concreteTaskIdentityPreserved: input.concreteTask.targetAbilityId === input.sourceContext.abilityId &&
      input.concreteTask.taskRole === input.sourceContext.taskRole &&
      input.concreteTask.questionMetadata.questionId === input.sourceContext.resourceVersionId,
    diagnosisAbilityPreserved: !input.diagnosisResult ||
      input.diagnosisResult.mainAbility === input.sourceContext.abilityId,
    evidenceAbilityPreserved: !input.evidenceReturnResult ||
      evidence.every((item) => item.ability === input.sourceContext.abilityId),
    evidenceTaskPreserved: !input.evidenceReturnResult ||
      (
        input.evidenceReturnResult.taskId === input.concreteTask.taskId &&
        evidence.every((item) => item.taskId === input.concreteTask.taskId)
      ),
    responseAndDiagnosisTraceComplete: !input.evidenceReturnResult ||
      (
        input.evidenceReturnResult.status === 'evidence_returned' &&
        traceLinks.length > 0 &&
        traceLinks.every((item) => (
          item.taskId === input.concreteTask.taskId &&
          item.responseId.trim().length > 0 &&
          item.diagnosisResultId.trim().length > 0
        ))
      ),
  };
  const issues = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `formal_learning_trace_check_failed:${check}`);

  return {
    passed: issues.length === 0,
    checks,
    trace: {
      resourceId: input.sourceContext.resourceId,
      resourceVersionId: input.sourceContext.resourceVersionId,
      materialId: input.sourceContext.materialId,
      materialVersionId: input.sourceContext.materialVersionId,
      materialContentHash: input.sourceContext.materialContentHash,
      resourceObservationLinkId: input.sourceContext.resourceObservationLinkId,
      observationTaskPlanId: input.sourceContext.observationTaskPlanId,
      evidenceIds: evidence.map((item) => item.id),
      responseIds: unique(traceLinks.map((item) => item.responseId)),
      diagnosisIds: unique(traceLinks.map((item) => item.diagnosisResultId)),
    },
    issues,
  };
}

function blockedResolution(issue: string): FormalResourceRuntimeSourceResolution {
  return {
    status: 'blocked',
    checks: {
      resourceExists: false,
      frozenCurrentVersion: false,
      registryIdentityAligned: false,
      materialExists: false,
      materialVersionAligned: false,
      frozenMaterialSnapshotAligned: false,
      activeObservationLinkUnique: false,
      observationLinkIdentityAligned: false,
      reviewedObservationPlan: false,
      materialStructureAligned: false,
      observationTaskIdentityAligned: false,
      sourceAnchorsTraceable: false,
    },
    issues: [issue],
  };
}

function materialIdentityAndContentEqual(
  left: NonNullable<FrozenQuestionResourceVersion['materialSnapshot']>,
  right: NonNullable<FrozenQuestionResourceVersion['materialSnapshot']>,
): boolean {
  return left.materialId === right.materialId &&
    left.materialVersionId === right.materialVersionId &&
    left.versionNumber === right.versionNumber &&
    left.title === right.title &&
    left.content === right.content &&
    left.source.sourceType === right.source.sourceType &&
    left.source.description === right.source.description &&
    left.source.copyrightNote === right.source.copyrightNote &&
    left.source.externalReference === right.source.externalReference;
}

function isAnchorValidForMaterial(
  anchor: Awaited<ReturnType<MaterialObservationRepository['getAnchor']>>,
  material: NonNullable<FrozenQuestionResourceVersion['materialSnapshot']>,
  structure: NonNullable<Awaited<ReturnType<MaterialObservationRepository['getStructure']>>>,
  materialId: string | undefined,
  materialVersionId: string | undefined,
): boolean {
  if (
    !anchor ||
    anchor.materialId !== materialId ||
    anchor.materialVersionId !== materialVersionId ||
    anchor.contentHash !== structure.contentHash
  ) {
    return false;
  }
  try {
    const expected = createMaterialSourceAnchor({
      material,
      structure,
      anchorType: anchor.anchorType,
      startParagraph: anchor.startParagraph,
      endParagraph: anchor.endParagraph,
    });
    return expected.sourceAnchorId === anchor.sourceAnchorId &&
      expected.contentHash === anchor.contentHash &&
      expected.excerpt === anchor.excerpt;
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
