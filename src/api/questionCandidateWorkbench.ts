import {
  QuestionCandidateService,
  type GeneratedQuestionCandidate,
  type QuestionCandidateGenerator,
} from '../ai/agents/questionCandidateService.ts';
import { QuestionResourceCandidateAdoptionGateway } from
  '../ai/agents/questionCandidateAdoptionGateway.ts';
import {
  adoptQuestionCandidateAndRunChecks,
  type CandidateAdoptionWorkflowResult,
} from '../ai/agents/questionCandidateAdoptionWorkflow.ts';
import { StructuredQuestionCandidateOptimizationService } from
  '../ai/agents/structuredQuestionCandidateOptimizationService.ts';
import {
  QuestionCandidateCorrectionService,
  type CreateExceptionCorrectionCandidateInput,
} from '../ai/agents/questionCandidateCorrectionService.ts';
import { IndexedDBQuestionCandidateRepository } from
  '../ai/repositories/indexedDBQuestionCandidateRepository.ts';
import { IndexedDBWorkingTaskContentRepository } from
  '../ai/repositories/indexedDBWorkingTaskContentRepository.ts';
import { createBrowserQuestionResourceAdmissionRepository } from
  '../ai/repositories/formalResourceRepositoryRouter.ts';
import type {
  CandidateRuntimeContext,
  QuestionCandidate,
} from '../ai/schemas/questionCandidate.schema.ts';
import type {
  ExceptionCorrectionPermissionRole,
  ExceptionCorrectionRecord,
  WorkingContentMigrationResult,
} from '../ai/schemas/questionCandidateCorrection.schema.ts';
import type { CandidateOptimizationGoal } from
  '../ai/schemas/questionCandidateOptimization.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  extractQuestionEditableFields,
} from '../ai/schemas/workingTaskContent.schema.ts';
import {
  completeQuestionResourceWorkbenchQualityCheck,
  validateQuestionResourceWorkbenchStructure,
} from './questionResourceWorkbench.ts';

const repository = new IndexedDBQuestionCandidateRepository();
const questionRepository = createBrowserQuestionResourceAdmissionRepository();
const workingRepository = new IndexedDBWorkingTaskContentRepository();
const correctionService = new QuestionCandidateCorrectionService(
  repository,
  questionRepository,
  workingRepository,
);

export type CandidateWorkbenchCommandInput = {
  operation: 'generate' | 'regenerate' | 'optimize';
  trainingTaskId: string;
  baseCandidateId?: string;
  goals?: CandidateOptimizationGoal[];
  reasonCodes?: string[];
  expectedContext: CandidateRuntimeContext;
  generatedCandidates: GeneratedQuestionCandidate[];
  idempotencyKey: string;
};

export type AdoptQuestionTaskCandidateInput = {
  trainingTaskId: string;
  candidateId: string;
  expectedContentHash: string;
  expectedContext: CandidateRuntimeContext;
  idempotencyKey: string;
  adoptedBy: string;
};

export type CorrectQuestionTaskCandidateInput =
  CreateExceptionCorrectionCandidateInput;

export type MigrateQuestionTaskWorkingContentInput = {
  trainingTaskId: string;
  correctedBy: string;
  permissionRole: ExceptionCorrectionPermissionRole;
  expectedContext: CandidateRuntimeContext;
  idempotencyKey: string;
};

export async function listQuestionTaskCandidates(
  trainingTaskId: string,
): Promise<QuestionCandidate[]> {
  return repository.listCandidates(trainingTaskId);
}

export async function listQuestionCandidateCorrectionRecords(
  candidateId?: string,
): Promise<ExceptionCorrectionRecord[]> {
  return repository.listCorrectionRecords(candidateId);
}

export async function correctQuestionTaskCandidate(
  input: CorrectQuestionTaskCandidateInput,
) {
  return correctionService.createExceptionCorrectionCandidate(input);
}

export async function migrateQuestionTaskWorkingContent(
  input: MigrateQuestionTaskWorkingContentInput,
): Promise<WorkingContentMigrationResult> {
  return correctionService.migrateWorkingTaskContent(input);
}

export async function executeCandidateWorkbenchCommand(
  input: CandidateWorkbenchCommandInput,
): Promise<QuestionCandidate[]> {
  const generator: QuestionCandidateGenerator = {
    async generate(request) {
      if (request.operation !== input.operation) {
        throw new Error('Candidate operation does not match the prepared provider result.');
      }
      return input.generatedCandidates;
    },
  };
  const service = new QuestionCandidateService(
    repository,
    generator,
    {
      async getCurrentContext(trainingTaskId) {
        if (trainingTaskId !== input.trainingTaskId) {
          throw new Error('Candidate context requested for another training task.');
        }
        return input.expectedContext;
      },
    },
    {
      async adoptCandidate() {
        throw new Error('CANDIDATE_ADOPTION_GATEWAY_NOT_READY');
      },
    },
  );

  if (input.operation === 'generate') {
    return service.generateTaskCandidates({
      trainingTaskId: input.trainingTaskId,
      count: input.generatedCandidates.length,
      reasonCodes: input.reasonCodes,
      goals: input.goals,
      expectedContext: input.expectedContext,
      idempotencyKey: input.idempotencyKey,
    });
  }
  if (!input.baseCandidateId) {
    throw new Error('A base candidate is required for this operation.');
  }
  if (input.operation === 'regenerate') {
    return service.regenerateTaskCandidates({
      trainingTaskId: input.trainingTaskId,
      baseCandidateId: input.baseCandidateId,
      count: input.generatedCandidates.length,
      reasonCodes: input.reasonCodes,
      goals: input.goals,
      expectedContext: input.expectedContext,
      idempotencyKey: input.idempotencyKey,
    });
  }
  const structuredService = new StructuredQuestionCandidateOptimizationService(service);
  return structuredService.optimizeTaskCandidate({
    trainingTaskId: input.trainingTaskId,
    baseCandidateId: input.baseCandidateId,
    goals: input.goals || [],
    reasonCodes: input.reasonCodes,
    expectedContext: input.expectedContext,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function adoptQuestionTaskCandidate(
  input: AdoptQuestionTaskCandidateInput,
): Promise<CandidateAdoptionWorkflowResult> {
  const service = new QuestionCandidateService(
    repository,
    {
      async generate() {
        throw new Error('Candidate generation is not available during adoption.');
      },
    },
    {
      async getCurrentContext(trainingTaskId) {
        if (trainingTaskId !== input.trainingTaskId) {
          throw new Error('Candidate context requested for another training task.');
        }
        return resolveCurrentCandidateContext(trainingTaskId, input.expectedContext);
      },
    },
    new QuestionResourceCandidateAdoptionGateway(questionRepository),
  );
  return adoptQuestionCandidateAndRunChecks(input, {
    service,
    validate: validateQuestionResourceWorkbenchStructure,
    assess: completeQuestionResourceWorkbenchQualityCheck,
  });
}

async function resolveCurrentCandidateContext(
  trainingTaskId: string,
  expectedContext: CandidateRuntimeContext,
): Promise<CandidateRuntimeContext> {
  const drafts = await questionRepository.listDrafts();
  const expectedDraft = expectedContext.activeDraftId
    ? drafts.find((draft) => draft.draftId === expectedContext.activeDraftId) || null
    : null;
  const activeDraft = expectedDraft || drafts
    .filter((draft) => draft.taskId === trainingTaskId && draft.status !== 'archived')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
  if (!activeDraft) {
    return {
      materialVersionId: expectedContext.materialVersionId,
      observationPlanVersion: expectedContext.observationPlanVersion,
      trainingTaskVersion: expectedContext.trainingTaskVersion,
    };
  }
  return {
    materialVersionId: expectedContext.materialVersionId,
    observationPlanVersion: expectedContext.observationPlanVersion,
    trainingTaskVersion: expectedContext.trainingTaskVersion,
    activeDraftId: activeDraft.draftId,
    activeDraftRevision: activeDraft.revision,
    activeDraftContentHash: calculateQuestionEditableFieldsHash(
      extractQuestionEditableFields(activeDraft),
    ),
  };
}
