import type { LearningProgressionRepository } from
  '../repositories/learningProgressionRepository.ts';
import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import type { TaskEvidenceReturnResult } from
  '../schemas/taskEvidenceReturn.schema.ts';

/**
 * Persists Stage-3 sidecar objects in dependency order. The existing
 * Diagnosis/Evidence chain remains authoritative for task completion; a
 * sidecar failure can be retried without recreating or overwriting Evidence.
 */
export class LearningProgressionRuntimeService {
  private readonly repository: LearningProgressionRepository;

  constructor(repository: LearningProgressionRepository) {
    this.repository = repository;
  }

  async freezeAttemptContext(
    snapshot: LearningProgressionContextSnapshot,
  ): Promise<LearningProgressionContextSnapshot> {
    const existing = await this.repository.getContextByAttemptId(
      snapshot.learningTaskAttemptId,
    );
    return existing || this.repository.saveContext(snapshot);
  }

  async persistEvidenceSidecar(result: TaskEvidenceReturnResult): Promise<void> {
    if (result.progressionContextSnapshot) {
      await this.freezeAttemptContext(result.progressionContextSnapshot);
    }
    if (result.progressionObservation) {
      await this.repository.saveObservation(result.progressionObservation);
    }
    if (result.progressionInstabilityAssessment) {
      await this.repository.saveAssessment(result.progressionInstabilityAssessment);
    }
    if (result.progressionEvidenceContext) {
      await this.repository.saveEvidenceContext(result.progressionEvidenceContext);
    }
    if (result.progressionEvidenceAdmissionDecision) {
      await this.repository.saveAdmission(result.progressionEvidenceAdmissionDecision);
    }
  }
}
