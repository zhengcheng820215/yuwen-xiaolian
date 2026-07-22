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
