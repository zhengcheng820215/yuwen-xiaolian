import type {
  ObservationCalibrationCaseCategory,
  ObservationDimension,
} from './materialObservation.schema.ts';
import type {
  MinimumAnswerRequirement,
  PrimaryAbilityId,
  QuestionResponseFormat,
  QuestionResourceDifficulty,
  StructuredQuestionType,
} from './questionResourceAdmission.schema.ts';
import type {
  AssessmentMode,
  OpenResponseAnswerStatus,
} from './diagnosis.schema.ts';

export const MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION = 'material_observation_draft_generator_v1_1' as const;

export type MaterialObservationGenerationMode = 'discover_new_observation';

export type MaterialObservationCandidateDisposition =
  | 'new_observation_candidate'
  | 'alternate_question_for_existing_observation'
  | 'likely_duplicate'
  | 'unsupported_by_material';

export type ExistingObservationInventoryItem = {
  observationId: string;
  primaryAbilityId: PrimaryAbilityId;
  observationDimension: ObservationDimension;
  focusDisplayName: string;
  focusDefinition: string;
  expectedStudentAction: string;
};

export type ExistingQuestionInventoryItem = {
  questionId: string;
  questionStem: string;
  observationId?: string;
  primaryAbilityId: PrimaryAbilityId;
  observationDimension: ObservationDimension;
};

export type MaterialObservationDraftGeneratorPreferences = {
  gradeRange?: string;
  preferredAbilityIds?: PrimaryAbilityId[];
  candidateCount?: number;
  requestedFocus?: string;
};

export type MaterialObservationDraftGeneratorInput = {
  requestId: string;
  generationMode?: MaterialObservationGenerationMode;
  material: {
    materialVersionId: string;
    title: string;
    content: string;
    sourceDescription?: string;
    copyrightNote?: string;
  };
  preferences?: MaterialObservationDraftGeneratorPreferences;
  existingInventory?: {
    observations: ExistingObservationInventoryItem[];
    questions: ExistingQuestionInventoryItem[];
  };
};

export type MaterialObservationDraftRubricItem = {
  name: string;
  description: string;
  abilityId: PrimaryAbilityId;
  acceptedSignals: string[];
};

export type MaterialObservationDraftCalibrationAnswer = {
  category: ObservationCalibrationCaseCategory;
  answerText: string;
  expectedAnswerStatus: OpenResponseAnswerStatus;
  expectedRubricCoverage: Array<{
    rubricName: string;
    status: 'completed' | 'partial' | 'missing';
  }>;
  expectedDiagnosisBoundary: string;
  expectedEvidenceEligibility: 'eligible' | 'eligible_but_weak' | 'ineligible';
};

export type MaterialObservationPlanningCandidate = {
  candidateId: string;
  questionStem: string;
  questionDraft: {
    questionType: StructuredQuestionType;
    responseFormat: QuestionResponseFormat;
  };
  primaryAbilityId: PrimaryAbilityId;
  supportingAbilityIds: PrimaryAbilityId[];
  observationDimension: ObservationDimension;
  observationFocus: {
    displayName: string;
    definition: string;
  };
  materialAnchor: {
    anchorType: 'paragraph' | 'paragraph_range' | 'full_text';
    startParagraph?: number;
    endParagraph?: number;
  };
  expectedStudentAction: string;
  designRationale: string;
  difficultySuggestion: QuestionResourceDifficulty;
  assessmentMode: AssessmentMode;
  rubricDraft: MaterialObservationDraftRubricItem[];
  answerAcceptanceDraft: {
    acceptedKeywords: string[];
    semanticEquivalentAllowed: boolean;
  };
  minimumAnswerRequirement: MinimumAnswerRequirement;
  calibrationAnswers: MaterialObservationDraftCalibrationAnswer[];
  evidencePotential: 'weak' | 'moderate' | 'strong';
  evidenceBoundary: {
    canObserve: string;
    cannotConclude: string;
  };
  safetyBoundary: {
    taskRole: 'training_candidate';
    requiresHumanReview: true;
  };
  inventoryRelation: {
    disposition: Exclude<MaterialObservationCandidateDisposition, 'unsupported_by_material'>;
    matchedObservationId?: string;
    matchedQuestionId?: string;
    reason: string;
  };
};

export type RejectedMaterialObservationCandidate = {
  candidateIndex: number;
  issues: string[];
  disposition?: Extract<MaterialObservationCandidateDisposition, 'unsupported_by_material'>;
};

export type MaterialObservationDraftGeneratorResult = {
  requestId: string;
  status:
    | 'candidates_ready'
    | 'insufficient_material_for_observation_planning'
    | 'review_required'
    | 'provider_failed';
  candidates: MaterialObservationPlanningCandidate[];
  withheldCandidates: MaterialObservationPlanningCandidate[];
  rejectedCandidates: RejectedMaterialObservationCandidate[];
  coveragePreview: {
    surfaceCandidateCount: number;
    independentObservationCount: number;
    newObservationCount: number;
    alternateQuestionCount: number;
    likelyDuplicateCount: number;
    unsupportedByMaterialCount: number;
    existingObservationCount: number;
    existingQuestionCount: number;
    primaryAbilityIds: PrimaryAbilityId[];
    observationDimensions: ObservationDimension[];
    possibleDuplicatePairs: string[];
  };
  validation: {
    passed: boolean;
    issues: string[];
  };
  provider: {
    providerName: string;
    model: string;
    attemptCount: number;
    latencyMs: number;
    tokenUsage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
  };
  limitations: string[];
  version: typeof MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION;
};
