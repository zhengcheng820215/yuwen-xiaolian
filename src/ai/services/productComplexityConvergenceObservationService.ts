import {
  adaptConvergenceObservationFact,
  buildConvergenceAggregateSnapshot,
  proposeConvergenceCapabilityDecision,
  type ConvergenceObservationSourceFact,
} from '../agents/productComplexityConvergenceObservationAgent.ts';
import type { ProductComplexityConvergenceObservationRepository } from
  '../repositories/productComplexityConvergenceObservationRepository.ts';
import type {
  ComplexityConvergenceAggregateSnapshot,
  ComplexityConvergenceDecisionProposal,
  ComplexityConvergenceMaintenanceBand,
  ComplexityConvergenceStage4ObservationMode,
  ComplexityConvergenceTrialWindow,
} from '../schemas/productComplexityConvergenceObservation.schema.ts';

export const DEFAULT_PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_MODE:
ComplexityConvergenceStage4ObservationMode = 'off';

export type ConvergenceObservationRecordResult = {
  mode: ComplexityConvergenceStage4ObservationMode;
  learningAllowed: true;
  observed: boolean;
  admittedToRealDenominator: boolean;
  eventId?: string;
  runtimeIssue?: string;
};

export function resolveConvergenceStage4ObservationMode(value?: string | null):
ComplexityConvergenceStage4ObservationMode {
  if (value === 'isolated_acceptance' || value === 'real_trial') return value;
  return DEFAULT_PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_MODE;
}

export async function recordConvergenceObservation(input: {
  mode?: ComplexityConvergenceStage4ObservationMode;
  source: ConvergenceObservationSourceFact;
  trialWindow: ComplexityConvergenceTrialWindow;
  repository?: ProductComplexityConvergenceObservationRepository;
}): Promise<ConvergenceObservationRecordResult> {
  const mode = input.mode || DEFAULT_PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_MODE;
  if (mode === 'off') return {
    mode, learningAllowed: true, observed: false, admittedToRealDenominator: false,
  };
  try {
    const event = adaptConvergenceObservationFact({
      source: input.source,
      trialWindow: input.trialWindow,
      forceExcludeReason: mode === 'isolated_acceptance' ? 'isolated_acceptance_excluded' : undefined,
    });
    if (input.repository) await input.repository.appendEvent(event);
    return {
      mode,
      learningAllowed: true,
      observed: true,
      admittedToRealDenominator: event.validation.dataOriginAdmitted,
      eventId: event.eventId,
    };
  } catch (error) {
    return {
      mode,
      learningAllowed: true,
      observed: false,
      admittedToRealDenominator: false,
      runtimeIssue: `observation_write_failed:${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function rebuildConvergenceObservationSnapshot(input: {
  trialWindow: ComplexityConvergenceTrialWindow;
  generatedAt: string;
  repository: ProductComplexityConvergenceObservationRepository;
}): Promise<ComplexityConvergenceAggregateSnapshot> {
  const events = await input.repository.listEvents(input.trialWindow.trialWindowId);
  const snapshot = buildConvergenceAggregateSnapshot({
    trialWindow: input.trialWindow,
    events,
    generatedAt: input.generatedAt,
  });
  await input.repository.saveSnapshot(snapshot);
  return snapshot;
}

export async function generateConvergenceDecisionProposals(input: {
  snapshot: ComplexityConvergenceAggregateSnapshot;
  generatedAt: string;
  maintenanceBands?: Partial<Record<string, ComplexityConvergenceMaintenanceBand>>;
  repository?: ProductComplexityConvergenceObservationRepository;
}): Promise<ComplexityConvergenceDecisionProposal[]> {
  const proposals = input.snapshot.aggregates.map((aggregate) => proposeConvergenceCapabilityDecision({
    snapshot: input.snapshot,
    aggregate,
    maintenanceBand: input.maintenanceBands?.[aggregate.capability] || 'not_available',
    generatedAt: input.generatedAt,
  }));
  if (input.repository) {
    for (const proposal of proposals) await input.repository.saveProposal(proposal);
  }
  return proposals;
}
