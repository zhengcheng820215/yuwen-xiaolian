import {
  QuestionCandidateService,
  type GeneratedQuestionCandidate,
  type QuestionCandidateGenerator,
} from '../ai/agents/questionCandidateService.ts';
import { QuestionResourceCandidateAdoptionGateway } from
  '../ai/agents/questionCandidateAdoptionGateway.ts';
import {
  adoptQuestionCandidateAndPublish,
  type CandidateAdoptionPublicationWorkflowResult,
} from '../ai/agents/questionCandidateAdoptionWorkflow.ts';
import { StructuredQuestionCandidateOptimizationService } from
  '../ai/agents/structuredQuestionCandidateOptimizationService.ts';
import { TrainingTaskInitialCandidateService } from
  '../ai/agents/trainingTaskInitialCandidateService.ts';
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
  type QuestionEditableFields,
} from '../ai/schemas/workingTaskContent.schema.ts';
import {
  completeQuestionResourceWorkbenchQualityCheck,
  decideQuestionResourceWorkbenchReview,
  freezeQuestionResourceWorkbenchDraft,
  submitQuestionResourceWorkbenchReview,
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

export type CreateOptimizationCandidateFromFormalVersionInput = {
  formalResourceId: string;
  baseFormalVersionId: string;
  generationCommandId: string;
  trainingTaskId: string;
  expectedContext: CandidateRuntimeContext;
  generatedCandidates: GeneratedQuestionCandidate[];
};

export type AdoptQuestionTaskCandidateInput = {
  trainingTaskId: string;
  candidateId: string;
  expectedContentHash: string;
  expectedContext: CandidateRuntimeContext;
  idempotencyKey: string;
  adoptedBy: string;
};

export type EnsureQuestionTaskInitialCandidateInput = {
  trainingTaskId: string;
  expectedTrainingTaskVersion: number;
  expectedContentHash: string;
  expectedContext: CandidateRuntimeContext;
  content: QuestionEditableFields;
  idempotencyKey: string;
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

export async function rejectQuestionTaskCandidateBatch(input: {
  trainingTaskId: string;
  candidateId: string;
  idempotencyKey: string;
  rejectedBy: string;
}): Promise<QuestionCandidate[]> {
  const service = new QuestionCandidateService(
    repository,
    { async generate() { throw new Error('Candidate generation is not available during rejection.'); } },
    { async getCurrentContext() { throw new Error('Candidate context is not required during rejection.'); } },
    { async adoptCandidate() { throw new Error('Candidate adoption is not available during rejection.'); } },
  );
  return service.rejectCandidateBatch(input);
}

export async function ensureQuestionTaskInitialCandidate(
  input: EnsureQuestionTaskInitialCandidateInput,
) {
  const service = new TrainingTaskInitialCandidateService(repository, {
    async getInitialCandidateSource(trainingTaskId) {
      if (trainingTaskId !== input.trainingTaskId) {
        throw new Error('Initial candidate source requested for another training task.');
      }
      return {
        trainingTaskVersion: input.expectedContext.trainingTaskVersion,
        contentHash: calculateQuestionEditableFieldsHash(input.content),
        content: input.content,
        context: input.expectedContext,
      };
    },
  });
  return service.ensureInitialCandidateFromTrainingTask({
    trainingTaskId: input.trainingTaskId,
    expectedTrainingTaskVersion: input.expectedTrainingTaskVersion,
    expectedContentHash: input.expectedContentHash,
    idempotencyKey: input.idempotencyKey,
  });
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
      listPeerQuestionContents,
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

export async function createOptimizationCandidateFromFormalVersion(
  input: CreateOptimizationCandidateFromFormalVersionInput,
): Promise<QuestionCandidate[]> {
  const generator: QuestionCandidateGenerator = {
    async generate() {
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
      listPeerQuestionContents,
    },
    {
      async adoptCandidate() {
        throw new Error('CANDIDATE_ADOPTION_GATEWAY_NOT_READY');
      },
    },
  );
  return service.generateFormalVersionOptimizationCandidates({
    trainingTaskId: input.trainingTaskId,
    formalResourceId: input.formalResourceId,
    baseFormalVersionId: input.baseFormalVersionId,
    count: input.generatedCandidates.length,
    reasonCodes: ['formal_version_optimization'],
    goals: ['create_new_formal_version'],
    expectedContext: input.expectedContext,
    idempotencyKey: input.generationCommandId,
  });
}

export async function adoptQuestionTaskCandidate(
  input: AdoptQuestionTaskCandidateInput,
): Promise<CandidateAdoptionPublicationWorkflowResult> {
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
  return adoptQuestionCandidateAndPublish(input, {
    service,
    validate: validateQuestionResourceWorkbenchStructure,
    assess: completeQuestionResourceWorkbenchQualityCheck,
    submitReview: (draftId, revision) => submitQuestionResourceWorkbenchReview(
      draftId,
      revision,
      [],
    ),
    approveReview: (draftId, revision) => decideQuestionResourceWorkbenchReview({
      draftId,
      expectedDraftRevision: revision,
      action: 'approve',
      reviewerId: input.adoptedBy || 'local-candidate-adopter',
      notes: '采用题目并通过自动质量门禁。',
      acceptedWarningCodes: [],
    }),
    publish: freezeQuestionResourceWorkbenchDraft,
    isPublished: async (draftId) => {
      const version = await questionRepository.getVersionByDraftId(draftId);
      if (!version || version.status !== 'frozen') return false;
      const registry = await questionRepository.getRegistryEntry(version.resourceId);
      return registry?.status === 'active'
        && registry.currentFrozenVersionId === version.resourceVersionId;
    },
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
      baseFormalResourceId: expectedContext.baseFormalResourceId,
      baseFormalVersionId: expectedContext.baseFormalVersionId,
    };
  }
  return {
    materialVersionId: expectedContext.materialVersionId,
    observationPlanVersion: expectedContext.observationPlanVersion,
    trainingTaskVersion: expectedContext.trainingTaskVersion,
    baseFormalResourceId: expectedContext.baseFormalResourceId,
    baseFormalVersionId: expectedContext.baseFormalVersionId,
    activeDraftId: activeDraft.draftId,
    activeDraftRevision: activeDraft.revision,
    activeDraftContentHash: calculateQuestionEditableFieldsHash(
      extractQuestionEditableFields(activeDraft),
    ),
  };
}

async function listPeerQuestionContents(
  trainingTaskId: string,
  context: CandidateRuntimeContext,
): Promise<QuestionEditableFields[]> {
  const drafts = (await questionRepository.listDrafts()).filter((draft) => (
    draft.status !== 'archived'
    && draft.taskId !== trainingTaskId
    && draft.materialVersionId === context.materialVersionId
  ));
  const latestByResourceId = new Map<string, typeof drafts[number]>();
  for (const draft of drafts) {
    const current = latestByResourceId.get(draft.resourceId);
    if (!current || draft.revision > current.revision
      || (draft.revision === current.revision && draft.updatedAt > current.updatedAt)) {
      latestByResourceId.set(draft.resourceId, draft);
    }
  }
  return [...latestByResourceId.values()].map(extractQuestionEditableFields);
}
