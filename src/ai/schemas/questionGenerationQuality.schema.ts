import type { QuestionResponseFormat } from './questionResourceAdmission.schema.ts';

export const QUESTION_GENERATION_QUALITY_POLICY_VERSION =
  'question_generation_quality_v4' as const;

export type QuestionGenerationQualitySeverity = 'blocker' | 'strong_hint' | 'advisory';

export type QuestionGenerationQualityCode =
  | 'candidate_incomplete'
  | 'candidate_unchanged'
  | 'response_format_underloaded'
  | 'response_format_overprovisioned'
  | 'rubric_density_long_text_hint'
  | 'rubric_requirement_not_in_stem'
  | 'substantive_duplicate'
  | 'ability_concentration'
  | 'difficulty_concentration'
  | 'foundational_gap'
  | 'choice_structure_invalid'
  | 'choice_training_action_mismatch'
  | 'choice_option_quality_invalid'
  | 'choice_rubric_open_response_not_allowed';

export type QuestionResponseLoadAnalysis = {
  actionCount: number;
  evidenceScopeCount: number;
  requiredRubricCount: number;
  independentCoreRubricCount: number;
  asksComparison: boolean;
  asksWholeText: boolean;
  asksEvidence: boolean;
  asksExplanation: boolean;
  asksOpenInterpretation: boolean;
  estimatedLoad: 'light' | 'moderate' | 'heavy';
  recommendedFormat: Extract<QuestionResponseFormat, 'short_text' | 'long_text'>;
};

export type QuestionObservationSignature = {
  answerObjectTokens: string[];
  actionKinds: string[];
  evidenceScopes: string[];
  rubricTargetTokens: string[];
  abilityId: string;
  taskRole: string;
};

export type QuestionObservationValueComparison = {
  answerObjectSimilarity: number;
  actionSimilarity: number;
  evidenceScopeSimilarity: number;
  rubricTargetSimilarity: number;
  substantiveDuplicate: boolean;
};

export type QuestionGenerationQualityFinding = {
  code: QuestionGenerationQualityCode;
  severity: QuestionGenerationQualitySeverity;
  message: string;
  relatedQuestionIndex?: number;
  details?: Record<string, unknown>;
};

export type QuestionPortfolioGradient = {
  questionCount: number;
  abilityBreakdown: Record<string, number>;
  difficultyBreakdown: Record<string, number>;
  findings: QuestionGenerationQualityFinding[];
};

export type QuestionGenerationQualityEvaluation = {
  policyVersion: typeof QUESTION_GENERATION_QUALITY_POLICY_VERSION;
  status: 'blocked' | 'ready_with_guidance' | 'ready';
  responseLoad: QuestionResponseLoadAnalysis;
  observationSignature: QuestionObservationSignature;
  findings: QuestionGenerationQualityFinding[];
  blockerCodes: QuestionGenerationQualityCode[];
};
