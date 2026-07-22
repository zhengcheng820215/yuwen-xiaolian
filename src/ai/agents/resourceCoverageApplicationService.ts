import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type {
  ProductExecutableCapabilitySnapshot,
  ResourceCoverageGenerationResult,
  ResourceCoveragePolicy,
} from '../schemas/resourceCoverage.schema.ts';
import {
  createPhase17ProductCapabilitySnapshot,
  createPhase17ResourceCoveragePolicy,
  generateResourceCoverage,
} from './resourceCoverageAgent.ts';

export type GenerateCurrentResourceCoverageInput = {
  repository: QuestionResourceAdmissionRepository;
  policy?: ResourceCoveragePolicy;
  capabilitySnapshot?: ProductExecutableCapabilitySnapshot;
  generatedAt?: string;
};

export async function generateCurrentResourceCoverage(
  input: GenerateCurrentResourceCoverageInput,
): Promise<ResourceCoverageGenerationResult> {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const policy = input.policy || createPhase17ResourceCoveragePolicy({ createdAt: generatedAt });
  const capabilitySnapshot = input.capabilitySnapshot || createPhase17ProductCapabilitySnapshot({
    createdAt: generatedAt,
  });

  try {
    const [registryEntries, frozenVersions, materials] = await Promise.all([
      input.repository.listRegistryEntries(),
      input.repository.listVersions(),
      input.repository.listMaterials(),
    ]);
    const validationIds = uniqueSorted(frozenVersions.map((item) => item.validationId));
    const reviewIds = uniqueSorted(frozenVersions.map((item) => item.reviewId));
    const [validationValues, reviewValues] = await Promise.all([
      Promise.all(validationIds.map((id) => input.repository.getValidation(id))),
      Promise.all(reviewIds.map((id) => input.repository.getReview(id))),
    ]);

    return generateResourceCoverage({
      source: {
        registryEntries,
        frozenVersions,
        validations: validationValues.filter((item): item is NonNullable<typeof item> => item !== null),
        reviews: reviewValues.filter((item): item is NonNullable<typeof item> => item !== null),
        materials,
      },
      policy,
      capabilitySnapshot,
      generatedAt,
    });
  } catch (error) {
    return {
      status: 'blocked',
      issues: [
        `coverage_source_load_failed:${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
