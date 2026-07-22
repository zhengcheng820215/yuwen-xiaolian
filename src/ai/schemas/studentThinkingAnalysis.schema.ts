export const STUDENT_THINKING_ANALYSIS_SCHEMA_VERSION = 'student_thinking_analysis_v1' as const;

export type StudentThinkingAnalysisStatus =
  | 'analyzed'
  | 'cannot_assess'
  | 'no_gap';

export type StudentThinkingStep = {
  stepId: string;
  action: string;
  whyItMatters: string;
  evidenceLinks: string[];
  verificationStatus: 'observed' | 'supported';
};

export type StudentThinkingTransition = {
  fromStep: string;
  toStep: string;
  observedProblem: string;
  evidenceLinks: string[];
  certainty: 'observed' | 'supported' | 'needs_verification';
};

export type StudentThinkingAnalysis = {
  schemaVersion: typeof STUDENT_THINKING_ANALYSIS_SCHEMA_VERSION;
  studentId: string;
  learningRoundId: string;
  status: StudentThinkingAnalysisStatus;
  completedSteps: StudentThinkingStep[];
  interruptedTransition?: StudentThinkingTransition;
  unresolvedQuestions: string[];
  limitations: string[];
  validation: {
    passed: boolean;
    completedStepsGrounded: boolean;
    transitionGrounded: boolean;
    noAbilityLabel: boolean;
    issues: string[];
  };
};

export function isStudentThinkingAnalysis(value: unknown): value is StudentThinkingAnalysis {
  if (!value || typeof value !== 'object') return false;
  const analysis = value as StudentThinkingAnalysis;
  return analysis.schemaVersion === STUDENT_THINKING_ANALYSIS_SCHEMA_VERSION &&
    nonEmpty(analysis.studentId) &&
    nonEmpty(analysis.learningRoundId) &&
    ['analyzed', 'cannot_assess', 'no_gap'].includes(analysis.status) &&
    Array.isArray(analysis.completedSteps) && analysis.completedSteps.every(isThinkingStep) &&
    (analysis.interruptedTransition === undefined || isThinkingTransition(analysis.interruptedTransition)) &&
    Array.isArray(analysis.unresolvedQuestions) && analysis.unresolvedQuestions.every(nonEmpty) &&
    Array.isArray(analysis.limitations) && analysis.limitations.every(nonEmpty) &&
    typeof analysis.validation?.passed === 'boolean' &&
    typeof analysis.validation?.completedStepsGrounded === 'boolean' &&
    typeof analysis.validation?.transitionGrounded === 'boolean' &&
    typeof analysis.validation?.noAbilityLabel === 'boolean' &&
    Array.isArray(analysis.validation?.issues);
}

function isThinkingStep(value: unknown): value is StudentThinkingStep {
  if (!value || typeof value !== 'object') return false;
  const step = value as StudentThinkingStep;
  return nonEmpty(step.stepId) &&
    nonEmpty(step.action) &&
    nonEmpty(step.whyItMatters) &&
    linksValid(step.evidenceLinks) &&
    ['observed', 'supported'].includes(step.verificationStatus);
}

function isThinkingTransition(value: unknown): value is StudentThinkingTransition {
  if (!value || typeof value !== 'object') return false;
  const transition = value as StudentThinkingTransition;
  return nonEmpty(transition.fromStep) &&
    nonEmpty(transition.toStep) &&
    nonEmpty(transition.observedProblem) &&
    linksValid(transition.evidenceLinks) &&
    ['observed', 'supported', 'needs_verification'].includes(transition.certainty);
}

function linksValid(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmpty);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
