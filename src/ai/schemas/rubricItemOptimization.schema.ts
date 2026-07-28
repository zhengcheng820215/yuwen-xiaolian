import type {
  PrimaryAbilityId,
  QuestionResourceDifficulty,
} from './questionResourceAdmission.schema.ts';

export const RUBRIC_ITEM_OPTIMIZATION_VERSION = 'rubric_item_optimization_v1';

export type RubricItemImportance = 'critical' | 'important' | 'supporting';

export type RubricItemOptimizationInput = {
  requestId: string;
  material: {
    materialVersionId: string;
    title: string;
    content: string;
  };
  question: {
    questionStem: string;
    observationFocus: string;
    abilityId: PrimaryAbilityId;
    difficulty: QuestionResourceDifficulty;
  };
  rubricItem: {
    localId: string;
    name: string;
    abilityId: PrimaryAbilityId;
    importance: RubricItemImportance;
    required: boolean;
    acceptedSignals: string[];
    requireTextEvidence: boolean;
    requireExplanation: boolean;
  };
  siblingRubricItems: Array<{
    name: string;
    abilityId: PrimaryAbilityId;
    importance: RubricItemImportance;
    required: boolean;
    acceptedSignals: string[];
    requireTextEvidence: boolean;
    requireExplanation: boolean;
  }>;
  qualityIssues: string[];
};

export type RubricItemOptimizationResult = {
  originalItem: RubricItemOptimizationInput['rubricItem'];
  suggestedItem: {
    name: string;
    importance: RubricItemImportance;
    required: boolean;
    acceptedSignals: string[];
    requireTextEvidence: boolean;
    requireExplanation: boolean;
  };
  changes: string[];
  rationale: string;
  version: typeof RUBRIC_ITEM_OPTIMIZATION_VERSION;
};
