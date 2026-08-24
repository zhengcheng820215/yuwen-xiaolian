import type { LearningProgressionRepository } from './learningProgressionRepository.ts';
import type { FormalTaskGroupProgressionArtifact } from
  '../schemas/formalTaskProgressionMetadata.schema.ts';
import { isFormalTaskGroupProgressionArtifact } from
  '../schemas/formalTaskProgressionMetadata.schema.ts';
import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import { isLearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import type { ProgressionEvidenceAdmissionDecision, ProgressionEvidenceContext } from
  '../schemas/progressionEvidenceAdmission.schema.ts';
import {
  isProgressionEvidenceAdmissionDecision,
  isProgressionEvidenceContext,
} from '../schemas/progressionEvidenceAdmission.schema.ts';
import type { ProgressionInstabilityAssessment } from
  '../schemas/progressionInstabilityAssessment.schema.ts';
import { isProgressionInstabilityAssessment } from
  '../schemas/progressionInstabilityAssessment.schema.ts';
import type { ProgressionPerformanceObservation } from
  '../schemas/progressionPerformanceObservation.schema.ts';
import { isProgressionPerformanceObservation } from
  '../schemas/progressionPerformanceObservation.schema.ts';

export class InMemoryLearningProgressionRepository
implements LearningProgressionRepository {
  private artifacts = new Map<string, FormalTaskGroupProgressionArtifact>();
  private contexts = new Map<string, LearningProgressionContextSnapshot>();
  private observations = new Map<string, ProgressionPerformanceObservation>();
  private assessments = new Map<string, ProgressionInstabilityAssessment>();
  private evidenceContexts = new Map<string, ProgressionEvidenceContext>();
  private admissions = new Map<string, ProgressionEvidenceAdmissionDecision>();

  async saveArtifact(value: FormalTaskGroupProgressionArtifact) {
    if (!isFormalTaskGroupProgressionArtifact(value)) throw new Error('progression_artifact_invalid');
    return this.saveImmutable(this.artifacts, value.planHash, value, 'progression_artifact_conflict');
  }

  async getArtifact(planHash: string) {
    return cloneOrNull(this.artifacts.get(planHash));
  }

  async saveContext(value: LearningProgressionContextSnapshot) {
    if (!isLearningProgressionContextSnapshot(value)) throw new Error('progression_context_invalid');
    return this.saveImmutable(this.contexts, value.learningTaskAttemptId, value, 'progression_context_conflict');
  }

  async getContextByAttemptId(attemptId: string) {
    return cloneOrNull(this.contexts.get(attemptId));
  }

  async saveObservation(value: ProgressionPerformanceObservation) {
    if (!isProgressionPerformanceObservation(value)) throw new Error('progression_observation_invalid');
    return this.saveImmutable(this.observations, value.observationId, value, 'progression_observation_conflict');
  }

  async listObservations(studentId: string, threadId?: string) {
    return [...this.observations.values()]
      .filter((item) => item.studentId === studentId
        && (!threadId || item.observationThreadId === threadId))
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt))
      .map(clone);
  }

  async saveAssessment(value: ProgressionInstabilityAssessment) {
    if (!isProgressionInstabilityAssessment(value)) throw new Error('progression_assessment_invalid');
    return this.saveImmutable(this.assessments, value.assessmentId, value, 'progression_assessment_conflict');
  }

  async getAssessment(assessmentId: string) {
    return cloneOrNull(this.assessments.get(assessmentId));
  }

  async saveEvidenceContext(value: ProgressionEvidenceContext) {
    if (!isProgressionEvidenceContext(value)) throw new Error('progression_evidence_context_invalid');
    return this.saveImmutable(this.evidenceContexts, value.evidenceId, value, 'progression_evidence_context_conflict');
  }

  async saveAdmission(value: ProgressionEvidenceAdmissionDecision) {
    if (!isProgressionEvidenceAdmissionDecision(value)) throw new Error('progression_admission_invalid');
    return this.saveImmutable(this.admissions, value.evidenceId, value, 'progression_admission_conflict');
  }

  async getAdmissionByEvidenceId(evidenceId: string) {
    return cloneOrNull(this.admissions.get(evidenceId));
  }

  async clear() {
    this.artifacts.clear();
    this.contexts.clear();
    this.observations.clear();
    this.assessments.clear();
    this.evidenceContexts.clear();
    this.admissions.clear();
  }

  private saveImmutable<T>(map: Map<string, T>, key: string, value: T, code: string): T {
    const existing = map.get(key);
    if (existing && stable(existing) !== stable(value)) throw new Error(code);
    if (!existing) map.set(key, clone(value));
    return clone(existing || value);
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneOrNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}
