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
import type { SingleChoiceInteraction } from './singleChoiceInteraction.schema.ts';
import type {
  TrainingTaskSequencePlanningPreference,
  TrainingTaskSequencePlanningResult,
} from './trainingTaskSequencePlanning.schema.ts';
import type {
  TextResponseCandidateGenerationTrace,
  TextResponseLoadPlanningIntent,
} from './readingOpenResponseGenerationPlanning.schema.ts';
import type {
  MaterialContentNormalizationPolicyVersion,
  MaterialUsageType,
  TargetedExcerptMetadata,
  TargetedTrainingResourceMetadata,
} from './targetedMicroTraining.schema.ts';
import type { TaskLoadSemantics } from './readingTaskLoadSemantics.schema.ts';
import type {
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  TaskGroupProgressionPlan,
} from './readingTaskGroupProgression.schema.ts';
import type { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  './readingTrainingProgressionAudit.schema.ts';

export const MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION = 'material_observation_draft_generator_v1_11' as const;

export const SINGLE_CHOICE_TARGET_SHORTFALL_REASONS = [
  'insufficient_task_capacity',
  'insufficient_supplement_scope',
  'no_independent_observation',
  'duplicate_with_existing_task',
  'distractor_quality_insufficient',
  'would_displace_text_observation',
] as const;

export type SingleChoiceTargetShortfallReason =
  typeof SINGLE_CHOICE_TARGET_SHORTFALL_REASONS[number];

export type MaterialObservationGenerationMode =
  | 'discover_new_observation'
  | 'optimize_existing_observation';

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
  planningIntent?: 'initial' | 'replacement' | 'supplement';
  requestedFocus?: string;
  targetObservationId?: string;
  targetQuestionContext?: {
    questionStem: string;
    expectedStudentAction: string;
    observationFocus: {
      displayName: string;
      definition: string;
    };
    hiddenRequiredDimensions: string[];
    rubric: Array<{
      name: string;
      description: string;
    }>;
  };
  singleChoiceCandidateTarget?: number;
  singleChoicePlanning?: {
    currentEffectiveTaskCount: number;
    currentSingleChoiceCount: number;
    intendedSupplementTaskCount: number;
    targetEffectiveTaskCount: number;
    defaultSingleChoiceTarget: number;
    maximumSingleChoiceCount: number;
    targetSingleChoiceCount: number;
    availableTaskCapacity: number;
    requestedSupplementSingleChoiceCount: number;
  };
  sequencePlanning?: TrainingTaskSequencePlanningPreference;
  /** Stable Plan revision identity used by the Stage 2 group progression plan. */
  observationPlanRevisionId?: string;
  targetedTrainingPlanning?: TargetedTrainingResourceMetadata;
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
    usageType?: MaterialUsageType;
    contentHash?: string;
    contentNormalizationPolicyVersion?: MaterialContentNormalizationPolicyVersion;
    targetedExcerptMetadata?: TargetedExcerptMetadata;
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
  /** Stable identity across Seed, Task, Candidate and the group progression plan. */
  planningTaskKey?: string;
  /** Receipt proving this realized Candidate consumed the authoritative group plan. */
  taskGroupProgressionPlanHash?: string;
  questionStem: string;
  questionDraft: {
    questionType: StructuredQuestionType;
    responseFormat: QuestionResponseFormat;
  };
  choiceInteraction?: SingleChoiceInteraction;
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
    acceptedOptionIds?: string[];
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
  /** Internal generation governance; never projected into student-facing resources. */
  textResponseLoadPlanning?: {
    intent: TextResponseLoadPlanningIntent;
    trace: TextResponseCandidateGenerationTrace;
  };
  /** Stage 1 native semantics; inherited by Task and QuestionCandidate unchanged. */
  taskLoadSemantics?: TaskLoadSemantics;
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
  diagnosticContext?: {
    questionType?: string;
    responseFormat?: string;
    materialAnchor?: {
      anchorType?: string;
      startParagraph?: number;
      endParagraph?: number;
    };
    materialParagraphCount: number;
  };
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
  singleChoicePlanningResult?: {
    status: 'not_applicable' | 'met' | 'underfilled';
    targetCount: number;
    actualCount: number;
    currentCount: number;
    requestedSupplementCount: number;
    generatedCount: number;
    projectedTotalCount: number;
    shortfallCount: number;
    reasons: SingleChoiceTargetShortfallReason[];
  };
  sequencePlanningResult: TrainingTaskSequencePlanningResult;
  progressionStageRuleVersion?: typeof READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION;
  taskGroupProgressionPlan?: TaskGroupProgressionPlan;
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
    failureIssueCounts: Record<string, number>;
  };
  provider: {
    providerName: string;
    model: string;
    attemptCount: number;
    latencyMs: number;
    repair?: {
      attempted: boolean;
      requestedCandidateCount: number;
      recoveredCandidateCount: number;
      unresolvedCandidateCount: number;
      issueCounts: Record<string, number>;
    };
    tokenUsage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
  };
  limitations: string[];
  trainingModelPolicyVersion?: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  version: typeof MATERIAL_OBSERVATION_DRAFT_GENERATOR_VERSION;
};
