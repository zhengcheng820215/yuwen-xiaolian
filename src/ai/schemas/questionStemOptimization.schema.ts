import type {
  PrimaryAbilityId,
  QuestionResourceDifficulty,
} from './questionResourceAdmission.schema.ts';
import type { QuestionQualityCheck } from './questionQualityAssessment.schema.ts';

export const QUESTION_STEM_OPTIMIZATION_VERSION = 'question_stem_optimization_v1';

export type QuestionStemOptimizationQualityIssue = {
  check: QuestionQualityCheck;
  message: string;
};

export type QuestionStemOptimizationInput = {
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
    rubricFocuses: string[];
  };
  qualityIssues: QuestionStemOptimizationQualityIssue[];
};

export type QuestionStemOptimizationResult = {
  originalStem: string;
  suggestedStem: string;
  changes: string[];
  rationale: string;
  addressedChecks: QuestionQualityCheck[];
  version: typeof QUESTION_STEM_OPTIMIZATION_VERSION;
};
