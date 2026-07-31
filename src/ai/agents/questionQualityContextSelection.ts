import type {
  QuestionQualityAssessmentBundle,
  QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';

export type PersistedQuestionQualityContextLike = {
  semantic: Pick<QuestionSemanticQualityAssessment, 'status'>;
  bundle: Pick<QuestionQualityAssessmentBundle, 'decision'>;
};

export type PersistedQuestionQualityCheckState =
  | 'missing'
  | 'incomplete'
  | 'complete';

export function isCompletedQuestionQualityContext(
  context: PersistedQuestionQualityContextLike | null | undefined,
): boolean {
  return Boolean(
    context &&
    context.semantic.status === 'completed' &&
    context.bundle.decision !== 'semantic_unavailable',
  );
}

export function resolvePersistedQuestionQualityCheckState(
  context: PersistedQuestionQualityContextLike | null | undefined,
): PersistedQuestionQualityCheckState {
  if (!context) return 'missing';
  return isCompletedQuestionQualityContext(context) ? 'complete' : 'incomplete';
}

export function selectPreferredPersistedQuestionQualityContext<
  T extends PersistedQuestionQualityContextLike,
>(contexts: T[]): T | null {
  return contexts.find(isCompletedQuestionQualityContext) || contexts[0] || null;
}
