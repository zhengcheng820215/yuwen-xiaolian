import type { QuestionCandidate } from '../schemas/questionCandidate.schema.ts';
import {
  resolveCandidateOptimizationFieldPolicy,
  type CandidateOptimizationGoal,
} from '../schemas/questionCandidateOptimization.schema.ts';
import {
  QuestionCandidateService,
  type OptimizeTaskCandidateInput,
} from './questionCandidateService.ts';

export type StructuredOptimizeTaskCandidateInput = Omit<
  OptimizeTaskCandidateInput,
  'goals' | 'allowedFields' | 'lockedFields'
> & {
  goals: CandidateOptimizationGoal[];
};

export class StructuredQuestionCandidateOptimizationService {
  private readonly candidateService: QuestionCandidateService;

  constructor(candidateService: QuestionCandidateService) {
    this.candidateService = candidateService;
  }

  async optimizeTaskCandidate(
    input: StructuredOptimizeTaskCandidateInput,
  ): Promise<QuestionCandidate[]> {
    const policy = resolveCandidateOptimizationFieldPolicy(input.goals);
    return this.candidateService.optimizeTaskCandidate({
      ...input,
      goals: policy.goals,
      allowedFields: policy.allowedFields,
      lockedFields: policy.lockedFields,
    });
  }
}
