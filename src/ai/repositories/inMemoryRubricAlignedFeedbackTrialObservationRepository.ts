import type { RubricAlignedFeedbackTrialObservationRepository } from
  './rubricAlignedFeedbackTrialObservationRepository.ts';
import {
  validateRubricAlignedFeedbackTrialObservation,
  type RubricAlignedFeedbackTrialObservation,
} from '../schemas/rubricAlignedFeedbackTrial.schema.ts';

export class InMemoryRubricAlignedFeedbackTrialObservationRepository
implements RubricAlignedFeedbackTrialObservationRepository {
  private readonly observations = new Map<string, RubricAlignedFeedbackTrialObservation>();

  async append(observation: RubricAlignedFeedbackTrialObservation): Promise<'inserted' | 'duplicate'> {
    const issues = validateRubricAlignedFeedbackTrialObservation(observation);
    if (issues.length) throw new Error(`rubric_feedback_trial_observation_invalid:${issues.join(',')}`);
    const existing = this.observations.get(observation.observationId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(observation)) {
        throw new Error('rubric_feedback_trial_observation_identity_conflict');
      }
      return 'duplicate';
    }
    this.observations.set(observation.observationId, clone(observation));
    return 'inserted';
  }

  async list(trialId?: string): Promise<RubricAlignedFeedbackTrialObservation[]> {
    return [...this.observations.values()]
      .filter((item) => !trialId || item.trialId === trialId)
      .map(clone);
  }

  async clear(): Promise<void> { this.observations.clear(); }
}

function clone<T>(value: T): T { return structuredClone(value); }
