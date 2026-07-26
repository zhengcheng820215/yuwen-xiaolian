import type {
  ResourceFreezeCommit,
  ResourceFreezeResult,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import type {
  FrozenQuestionQualityTrace,
} from '../schemas/questionQualityPersistence.schema.ts';
import type {
  QuestionQualityAssessmentBundle,
  QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';

export type SemanticAssessmentCurrentIdentity = {
  draftId: string;
  draftRevision: number;
  validationId: string;
  deterministicAssessmentId: string;
  providerId: string;
  modelId: string;
  promptVersion: string;
  semanticRuleVersion: string;
  outputSchemaVersion: string;
};

export type QualityBundleCurrentIdentity = {
  draftId: string;
  draftRevision: number;
  validationId: string;
  deterministicAssessmentId: string;
  semanticAssessmentId: string;
  mergeRuleVersion: string;
};

export type QualityTracedFreezeCommit = {
  resourceCommit: ResourceFreezeCommit;
  trace: FrozenQuestionQualityTrace;
};

export type QualityTracedFreezeResult = ResourceFreezeResult & {
  trace: FrozenQuestionQualityTrace;
};

export type QuestionQualityPersistenceRepository = {
  saveDeterministicAssessment(
    value: QuestionQualityAssessment,
  ): Promise<QuestionQualityAssessment>;
  getDeterministicAssessment(
    assessmentId: string,
  ): Promise<QuestionQualityAssessment | null>;
  listDeterministicForDraft(
    draftId: string,
  ): Promise<QuestionQualityAssessment[]>;
  getCurrentDeterministic(
    draftId: string,
    revision: number,
    validationId: string,
    ruleVersion: string,
  ): Promise<QuestionQualityAssessment | null>;

  saveSemanticAssessment(
    value: QuestionSemanticQualityAssessment,
  ): Promise<QuestionSemanticQualityAssessment>;
  getSemanticAssessment(
    semanticAssessmentId: string,
  ): Promise<QuestionSemanticQualityAssessment | null>;
  listSemanticForDraft(
    draftId: string,
  ): Promise<QuestionSemanticQualityAssessment[]>;
  getCurrentCompletedSemantic(
    identity: SemanticAssessmentCurrentIdentity,
  ): Promise<QuestionSemanticQualityAssessment | null>;

  saveBundle(
    value: QuestionQualityAssessmentBundle,
  ): Promise<QuestionQualityAssessmentBundle>;
  getBundle(bundleId: string): Promise<QuestionQualityAssessmentBundle | null>;
  getCurrentBundle(
    identity: QualityBundleCurrentIdentity,
  ): Promise<QuestionQualityAssessmentBundle | null>;

  getTrace(traceId: string): Promise<FrozenQuestionQualityTrace | null>;
  getTraceForResourceVersion(
    resourceVersionId: string,
  ): Promise<FrozenQuestionQualityTrace | null>;
  commitFreezeWithQualityTrace(
    commit: QualityTracedFreezeCommit,
  ): Promise<QualityTracedFreezeResult>;
};
