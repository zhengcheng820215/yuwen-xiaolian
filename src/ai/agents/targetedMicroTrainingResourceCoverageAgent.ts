import {
  PRIMARY_ABILITY_IDS,
  type FrozenQuestionResourceVersion,
  type PrimaryAbilityId,
  type QuestionMaterialVersion,
  type ResourceRegistryEntry,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  TARGETED_GAP_REASON_CODES,
  projectTargetedMaterialUsage,
  validateTargetedMaterialUsage,
  validateTargetedTrainingResourceMetadata,
  type TargetedGapReasonCode,
} from '../schemas/targetedMicroTraining.schema.ts';

export type TargetedGapAbilityCoverageCell = {
  gapReasonCode: TargetedGapReasonCode;
  abilityId: PrimaryAbilityId;
  independentMaterialCount: number;
  executableResourceCount: number;
};

export type TargetedGapCoverage = {
  gapReasonCode: TargetedGapReasonCode;
  activeMaterialCount: number;
  executableResourceCount: number;
  activeRegistryLinkCount: number;
  passed: boolean;
  limitations: string[];
};

export type TargetedMicroTrainingResourceCoverageReport = {
  passed: boolean;
  totalActiveMaterialCount: number;
  totalExecutableResourceCount: number;
  gapCoverage: TargetedGapCoverage[];
  matrix: TargetedGapAbilityCoverageCell[];
  generatedAt: string;
};

export function assessTargetedMicroTrainingResourceCoverage(input: {
  materials: QuestionMaterialVersion[];
  versions: FrozenQuestionResourceVersion[];
  registryEntries: ResourceRegistryEntry[];
  generatedAt?: string;
}): TargetedMicroTrainingResourceCoverageReport {
  const activeMaterials = input.materials.filter((material) => (
    material.status !== 'retired'
    && projectTargetedMaterialUsage(material).usageType === 'targeted_excerpt'
    && validateTargetedMaterialUsage(material).passed
  ));
  const materialByVersionId = new Map(activeMaterials.map((material) => [
    material.materialVersionId,
    material,
  ]));
  const registryByResourceId = new Map(input.registryEntries.map((entry) => [
    entry.resourceId,
    entry,
  ]));
  const executableVersions = input.versions.filter((version) => {
    const registry = registryByResourceId.get(version.resourceId);
    const metadata = version.abilityMetadata.targetedTrainingMetadata;
    const material = version.materialVersionId
      ? materialByVersionId.get(version.materialVersionId)
      : undefined;
    return version.status === 'frozen'
      && registry?.status === 'active'
      && registry.currentFrozenVersionId === version.resourceVersionId
      && version.abilityMetadata.taskRole === 'training'
      && Boolean(material)
      && validateTargetedTrainingResourceMetadata(metadata, version.materialVersionId).passed
      && registry.targetedTrainingMetadata?.primaryGapReasonCode === metadata?.primaryGapReasonCode
      && registry.targetedTrainingMetadata?.targetedMaterialVersionId === metadata?.targetedMaterialVersionId;
  });

  const gapCoverage = TARGETED_GAP_REASON_CODES.map((gapReasonCode): TargetedGapCoverage => {
    const materialIds = new Set(activeMaterials
      .filter((material) => material.targetedExcerptMetadata?.supportedGapReasonCodes.includes(gapReasonCode))
      .map((material) => material.materialVersionId));
    const resources = executableVersions.filter(
      (version) => version.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode === gapReasonCode,
    );
    const registryLinks = resources.filter((version) => (
      registryByResourceId.get(version.resourceId)?.currentFrozenVersionId === version.resourceVersionId
    ));
    const independentResourceMaterials = new Set(resources.map((version) => version.materialVersionId));
    const limitations: string[] = [];
    if (materialIds.size < 3) limitations.push('fewer_than_three_active_materials');
    if (resources.length < 3) limitations.push('fewer_than_three_executable_resources');
    if (registryLinks.length < 3) limitations.push('fewer_than_three_active_registry_links');
    if (independentResourceMaterials.size < 3) limitations.push('fewer_than_three_independent_resource_contexts');
    return {
      gapReasonCode,
      activeMaterialCount: materialIds.size,
      executableResourceCount: resources.length,
      activeRegistryLinkCount: registryLinks.length,
      passed: limitations.length === 0,
      limitations,
    };
  });

  const matrix = TARGETED_GAP_REASON_CODES.flatMap((gapReasonCode) => (
    PRIMARY_ABILITY_IDS.map((abilityId): TargetedGapAbilityCoverageCell => {
      const resources = executableVersions.filter((version) => (
        version.abilityMetadata.abilityId === abilityId
        && version.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode === gapReasonCode
      ));
      return {
        gapReasonCode,
        abilityId,
        independentMaterialCount: new Set(resources.map((version) => version.materialVersionId)).size,
        executableResourceCount: resources.length,
      };
    })
  ));

  return {
    passed: gapCoverage.every((item) => item.passed),
    totalActiveMaterialCount: activeMaterials.length,
    totalExecutableResourceCount: executableVersions.length,
    gapCoverage,
    matrix,
    generatedAt: input.generatedAt || new Date().toISOString(),
  };
}
