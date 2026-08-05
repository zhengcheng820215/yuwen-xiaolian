import type {
  AdoptTaskCandidateInput,
  QuestionCandidateService,
} from './questionCandidateService.ts';
import type { CandidateAdoptionResult } from '../schemas/questionCandidate.schema.ts';

export type CandidateAdoptionWorkflowResult = {
  adoption: CandidateAdoptionResult;
  validation: {
    status: 'completed' | 'failed';
    passed?: boolean;
    message?: string;
  };
  assessment: {
    status: 'completed' | 'failed' | 'blocked';
    message?: string;
  };
  nextAction: 'resolve_validation' | 'retry_assessment' | 'ready_for_confirmation';
};

export async function adoptQuestionCandidateAndRunChecks(
  input: AdoptTaskCandidateInput,
  dependencies: {
    service: QuestionCandidateService;
    validate(draftId: string, revision: number): Promise<{ passed: boolean }>;
    assess(draftId: string, revision: number): Promise<unknown>;
  },
): Promise<CandidateAdoptionWorkflowResult> {
  const adoption = await dependencies.service.adoptTaskCandidate(input);
  let validation: { passed: boolean };
  try {
    validation = await dependencies.validate(adoption.draftId, adoption.revision);
  } catch (error) {
    return {
      adoption,
      validation: { status: 'failed', message: errorMessage(error) },
      assessment: { status: 'blocked', message: '结构检查尚未完成。' },
      nextAction: 'resolve_validation',
    };
  }
  if (!validation.passed) {
    return {
      adoption,
      validation: { status: 'completed', passed: false },
      assessment: { status: 'blocked', message: '请先处理结构检查问题。' },
      nextAction: 'resolve_validation',
    };
  }
  try {
    await dependencies.assess(adoption.draftId, adoption.revision);
    return {
      adoption,
      validation: { status: 'completed', passed: true },
      assessment: { status: 'completed' },
      nextAction: 'ready_for_confirmation',
    };
  } catch (error) {
    return {
      adoption,
      validation: { status: 'completed', passed: true },
      assessment: { status: 'failed', message: errorMessage(error) },
      nextAction: 'retry_assessment',
    };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
