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
    warningCodes?: string[];
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
  return runChecksForAdoption(adoption, dependencies);
}

async function runChecksForAdoption(
  adoption: CandidateAdoptionResult,
  dependencies: {
    validate(draftId: string, revision: number): Promise<{ passed: boolean }>;
    assess(draftId: string, revision: number): Promise<unknown>;
  },
): Promise<CandidateAdoptionWorkflowResult> {
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
    const assessment = await dependencies.assess(adoption.draftId, adoption.revision);
    return {
      adoption,
      validation: { status: 'completed', passed: true },
      assessment: {
        status: 'completed',
        warningCodes: readWarningCodes(assessment),
      },
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

export type CandidateAdoptionPublicationWorkflowResult = Omit<
  CandidateAdoptionWorkflowResult,
  'nextAction'
> & {
  review: {
    status: 'not_started' | 'submitted' | 'completed' | 'failed';
    message?: string;
  };
  publication: {
    status: 'not_started' | 'completed' | 'failed';
    message?: string;
  };
  completedStages: Array<
    'adopt' | 'validation' | 'assessment' | 'review' | 'publication'
  >;
  visibleState: 'published' | 'action_required';
  nextAction:
    | 'resolve_validation'
    | 'retry_assessment'
    | 'resolve_warnings'
    | 'retry_review'
    | 'retry_publication'
    | 'published';
};

export async function adoptQuestionCandidateAndPublish(
  input: AdoptTaskCandidateInput,
  dependencies: {
    service: QuestionCandidateService;
    validate(draftId: string, revision: number): Promise<{ passed: boolean }>;
    assess(draftId: string, revision: number): Promise<unknown>;
    submitReview(draftId: string, revision: number): Promise<unknown>;
    approveReview(draftId: string, revision: number): Promise<unknown>;
    publish(
      draftId: string,
      revision: number,
    ): Promise<{ publicationStatus?: 'completed' | 'partially_completed' }>;
    isPublished?(draftId: string, revision: number): Promise<boolean>;
  },
): Promise<CandidateAdoptionPublicationWorkflowResult> {
  const adoption = await dependencies.service.adoptTaskCandidate(input);
  if (dependencies.isPublished && await dependencies.isPublished(
    adoption.draftId,
    adoption.revision,
  )) {
    return recoveredPublishedResult(adoption);
  }
  const checked = await runChecksForAdoption(adoption, dependencies);
  const completedStages: CandidateAdoptionPublicationWorkflowResult['completedStages'] = [
    'adopt',
  ];
  if (checked.validation.status === 'completed' && checked.validation.passed) {
    completedStages.push('validation');
  }
  if (checked.assessment.status === 'completed') completedStages.push('assessment');

  if (checked.nextAction !== 'ready_for_confirmation') {
    return {
      ...checked,
      review: { status: 'not_started' },
      publication: { status: 'not_started' },
      completedStages,
      visibleState: 'action_required',
      nextAction: checked.nextAction,
    };
  }

  if ((checked.assessment.warningCodes || []).length > 0) {
    return {
      ...checked,
      review: { status: 'not_started' },
      publication: { status: 'not_started' },
      completedStages,
      visibleState: 'action_required',
      nextAction: 'resolve_warnings',
    };
  }

  try {
    await dependencies.submitReview(checked.adoption.draftId, checked.adoption.revision);
  } catch (error) {
    return {
      ...checked,
      review: { status: 'failed', message: errorMessage(error) },
      publication: { status: 'not_started' },
      completedStages,
      visibleState: 'action_required',
      nextAction: 'retry_review',
    };
  }

  try {
    await dependencies.approveReview(checked.adoption.draftId, checked.adoption.revision);
    completedStages.push('review');
  } catch (error) {
    return {
      ...checked,
      review: { status: 'submitted', message: errorMessage(error) },
      publication: { status: 'not_started' },
      completedStages,
      visibleState: 'action_required',
      nextAction: 'retry_review',
    };
  }

  try {
    const publication = await dependencies.publish(
      checked.adoption.draftId,
      checked.adoption.revision,
    );
    if (publication.publicationStatus === 'partially_completed') {
      return {
        ...checked,
        review: { status: 'completed' },
        publication: {
          status: 'failed',
          message: '审核已通过，发布尚未完整完成。',
        },
        completedStages,
        visibleState: 'action_required',
        nextAction: 'retry_publication',
      };
    }
    completedStages.push('publication');
    return {
      ...checked,
      review: { status: 'completed' },
      publication: { status: 'completed' },
      completedStages,
      visibleState: 'published',
      nextAction: 'published',
    };
  } catch (error) {
    return {
      ...checked,
      review: { status: 'completed' },
      publication: { status: 'failed', message: errorMessage(error) },
      completedStages,
      visibleState: 'action_required',
      nextAction: 'retry_publication',
    };
  }
}

function recoveredPublishedResult(
  adoption: CandidateAdoptionResult,
): CandidateAdoptionPublicationWorkflowResult {
  return {
    adoption,
    validation: { status: 'completed', passed: true },
    assessment: { status: 'completed', warningCodes: [] },
    review: { status: 'completed' },
    publication: { status: 'completed' },
    completedStages: ['adopt', 'validation', 'assessment', 'review', 'publication'],
    visibleState: 'published',
    nextAction: 'published',
  };
}

function readWarningCodes(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const warningCodes = (value as { warningCodes?: unknown }).warningCodes;
  if (!Array.isArray(warningCodes)) return [];
  return warningCodes.filter(
    (warningCode): warningCode is string => typeof warningCode === 'string' && warningCode.length > 0,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
