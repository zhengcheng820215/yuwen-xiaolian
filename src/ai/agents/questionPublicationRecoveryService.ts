import type { MaterialObservationRepository } from '../repositories/materialObservationRepository.ts';
import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type { ResourceObservationLink } from '../schemas/materialObservation.schema.ts';
import type {
  ResourceRegistryEntry,
} from '../schemas/questionResourceAdmission.schema.ts';
import { createStructuredRuntimeError } from '../errors/structuredRuntimeError.ts';
import {
  ensureRegistryEntryForFrozenVersion,
} from './questionResourceAdmissionAgent.ts';
import { linkFrozenResourceToObservationTask } from './materialObservationApplicationService.ts';

export type QuestionPublicationRecoveryResult = {
  publicationStatus: 'completed' | 'partially_completed';
  resourceVersionId: string;
  reusedFrozenVersion: true;
  registryEntry: ResourceRegistryEntry;
  observationLink?: ResourceObservationLink;
  observationLinkIssues: string[];
};

export async function recoverQuestionPublicationFromFrozenVersion(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    draftId: string;
    planId: string;
    observationTaskPlanId: string;
  },
): Promise<QuestionPublicationRecoveryResult> {
  const version = await resourceRepository.getVersionByDraftId(input.draftId);
  if (!version) {
    throw createStructuredRuntimeError({
      code: 'PUBLICATION_RECOVERY_REQUIRED',
      message: '尚未找到可继续使用的正式题目版本，请重新执行正式发布。',
      operation: 'question_publication.recover',
      objectId: input.draftId,
      recoverability: 'user_action_required',
    });
  }

  const registryEntry = await ensureRegistryEntryForFrozenVersion(
    resourceRepository,
    version,
  );
  try {
    const linked = await linkFrozenResourceToObservationTask(
      resourceRepository,
      observationRepository,
      {
        planId: input.planId,
        observationTaskPlanId: input.observationTaskPlanId,
        resourceVersionId: version.resourceVersionId,
      },
    );
    return {
      publicationStatus: linked.issues.length === 0 ? 'completed' : 'partially_completed',
      resourceVersionId: version.resourceVersionId,
      reusedFrozenVersion: true,
      registryEntry,
      observationLink: linked.link,
      observationLinkIssues: linked.issues,
    };
  } catch (error) {
    return {
      publicationStatus: 'partially_completed',
      resourceVersionId: version.resourceVersionId,
      reusedFrozenVersion: true,
      registryEntry,
      observationLinkIssues: [publicationRecoveryMessage(error)],
    };
  }
}

function publicationRecoveryMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `正式题目版本已保留，但材料观测关联尚未完成。可直接重试补齐关联，不会创建新版本。${detail ? `（${detail}）` : ''}`;
}
