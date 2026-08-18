export type WritingCorrectionStatus = 'idle' | 'loading' | 'resolved';

export function shouldStageFeedbackPresentation(input: {
  correctionStatus: WritingCorrectionStatus;
  correctionCount: number;
  hasReview: boolean;
  hasGuidance: boolean;
  prefersReducedMotion: boolean;
  hasPresented: boolean;
}): boolean {
  const hasResolvedCorrections = input.correctionStatus === 'resolved' && input.correctionCount > 0;
  return !hasResolvedCorrections &&
    input.hasReview &&
    input.hasGuidance &&
    !input.prefersReducedMotion &&
    !input.hasPresented;
}

export function synchronizeFeedbackPresentationStep(
  currentStep: number,
  shouldStage: boolean,
): number {
  return shouldStage ? currentStep : 3;
}

export function shouldRenderThinkingReview(review: {
  coveredPoints?: string[];
  primaryGap?: string;
  missingPoints?: string[];
}): boolean {
  return Boolean(
    review.coveredPoints?.length ||
    review.primaryGap ||
    review.missingPoints?.length,
  );
}

export type CompletedFeedbackFallback = {
  title: string;
  summary: string;
  nextAction?: string;
};

export function resolveCompletedFeedbackFallback(input: {
  hasOutcomeNarrative: boolean;
  hasThinkingReview: boolean;
  positiveCount: number;
  hasGuidance: boolean;
  attentionCount: number;
  responseFormat?: 'text' | 'single_choice';
  feedback?: {
    headline?: string;
    summary?: string;
    nextActionText?: string;
  };
}): CompletedFeedbackFallback | undefined {
  const hasPrimaryFeedback = input.hasOutcomeNarrative ||
    input.hasThinkingReview ||
    input.positiveCount > 0 ||
    input.hasGuidance ||
    input.attentionCount > 0;
  if (hasPrimaryFeedback) return undefined;

  const title = input.feedback?.headline?.trim() || '本轮结果已保存';
  const summary = input.feedback?.summary?.trim() || (
    input.responseFormat === 'single_choice'
      ? '本轮选择已经记录，可以返回学习入口继续。'
      : '本轮回答已经记录，可以返回学习入口继续。'
  );
  const candidateNextAction = input.feedback?.nextActionText?.trim();
  return {
    title,
    summary,
    nextAction: candidateNextAction && candidateNextAction !== summary
      ? candidateNextAction
      : undefined,
  };
}
