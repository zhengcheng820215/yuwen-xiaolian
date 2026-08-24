import type { FormalTaskGroupProgressionArtifact } from
  '../schemas/formalTaskProgressionMetadata.schema.ts';
import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import type { ProgressionEvidenceAdmissionDecision, ProgressionEvidenceContext } from
  '../schemas/progressionEvidenceAdmission.schema.ts';
import type { ProgressionInstabilityAssessment } from
  '../schemas/progressionInstabilityAssessment.schema.ts';
import type { ProgressionPerformanceObservation } from
  '../schemas/progressionPerformanceObservation.schema.ts';

export type LearningProgressionRepository = {
  saveArtifact(artifact: FormalTaskGroupProgressionArtifact): Promise<FormalTaskGroupProgressionArtifact>;
  getArtifact(planHash: string): Promise<FormalTaskGroupProgressionArtifact | null>;
  saveContext(snapshot: LearningProgressionContextSnapshot): Promise<LearningProgressionContextSnapshot>;
  getContextByAttemptId(attemptId: string): Promise<LearningProgressionContextSnapshot | null>;
  saveObservation(observation: ProgressionPerformanceObservation): Promise<ProgressionPerformanceObservation>;
  listObservations(studentId: string, observationThreadId?: string): Promise<ProgressionPerformanceObservation[]>;
  saveAssessment(assessment: ProgressionInstabilityAssessment): Promise<ProgressionInstabilityAssessment>;
  getAssessment(assessmentId: string): Promise<ProgressionInstabilityAssessment | null>;
  saveEvidenceContext(context: ProgressionEvidenceContext): Promise<ProgressionEvidenceContext>;
  saveAdmission(decision: ProgressionEvidenceAdmissionDecision): Promise<ProgressionEvidenceAdmissionDecision>;
  getAdmissionByEvidenceId(evidenceId: string): Promise<ProgressionEvidenceAdmissionDecision | null>;
  clear(): Promise<void>;
};
