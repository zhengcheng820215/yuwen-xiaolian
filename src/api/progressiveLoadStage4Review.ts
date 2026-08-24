import { IndexedDBProgressiveLoadStage4Repository } from
  '../ai/repositories/indexedDBProgressiveLoadStage4Repository.ts';
import {
  createDefaultProgressiveLoadCalibrationThresholdPolicy,
} from '../ai/schemas/progressiveLoadStage4.schema.ts';
import { ProgressiveLoadCalibrationService } from
  '../ai/services/progressiveLoadCalibrationService.ts';

export type ProgressiveLoadStage4ReviewState = {
  generatedAt: string;
  governance: {
    total: number;
    selected: number;
    linked: number;
    stale: number;
    resolved: number;
    contexts: Array<{
      governanceContextId: string;
      sourceResourceVersionId: string;
      findingCodes: string[];
      targetOutcome: string;
      priority: number;
      status: string;
    }>;
  };
  calibration: {
    eventCount: number;
    projectionCount: number;
    statusCounts: Record<string, number>;
    projections: Array<{
      projectionId: string;
      resourceVersionId: string;
      status: string;
      validInitialAttemptCount: number;
      distinctLearnerCount: number;
      integrityRate: number;
      limitations: string[];
      policyVersion: string;
    }>;
  };
  educationConclusion: 'not_inferred_from_engineering_or_sample_status';
};

export async function loadProgressiveLoadStage4Review(): Promise<ProgressiveLoadStage4ReviewState> {
  const repository = new IndexedDBProgressiveLoadStage4Repository();
  const service = new ProgressiveLoadCalibrationService(repository);
  const policies = await repository.listThresholdPolicies();
  const policy = policies.at(-1)
    || createDefaultProgressiveLoadCalibrationThresholdPolicy(new Date().toISOString());
  const projections = await service.rebuildProjections(policy);
  const contexts = await repository.listGovernanceContexts();
  const events = await repository.listEvents();
  const statusCounts: Record<string, number> = {};
  projections.forEach((item) => {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
  });
  return {
    generatedAt: new Date().toISOString(),
    governance: {
      total: contexts.length,
      selected: contexts.filter((item) => item.status === 'selected').length,
      linked: contexts.filter((item) => item.status === 'linked').length,
      stale: contexts.filter((item) => item.status === 'stale').length,
      resolved: contexts.filter((item) => item.status === 'resolved').length,
      contexts: contexts.map((item) => ({
        governanceContextId: item.governanceContextId,
        sourceResourceVersionId: item.sourceResourceVersionId,
        findingCodes: item.findingCodes,
        targetOutcome: item.targetOutcome,
        priority: item.priority,
        status: item.status,
      })),
    },
    calibration: {
      eventCount: events.length,
      projectionCount: projections.length,
      statusCounts,
      projections: projections.map((item) => ({
        projectionId: item.projectionId,
        resourceVersionId: item.resourceVersionId,
        status: item.status,
        validInitialAttemptCount: item.validInitialAttemptCount,
        distinctLearnerCount: item.distinctLearnerCount,
        integrityRate: item.integrityRate,
        limitations: item.limitations,
        policyVersion: item.policyVersion,
      })),
    },
    educationConclusion: 'not_inferred_from_engineering_or_sample_status',
  };
}
