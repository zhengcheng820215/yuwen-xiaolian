import type { RubricAlignedFeedbackTrialObservation } from
  '../schemas/rubricAlignedFeedbackTrial.schema.ts';

export interface RubricAlignedFeedbackTrialObservationRepository {
  append(observation: RubricAlignedFeedbackTrialObservation): Promise<'inserted' | 'duplicate'>;
  list(trialId?: string): Promise<RubricAlignedFeedbackTrialObservation[]>;
  clear(): Promise<void>;
}
