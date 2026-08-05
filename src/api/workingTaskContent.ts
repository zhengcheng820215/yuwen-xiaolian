import {
  getWorkingTaskContentState,
  getWorkingTaskContentConflictDetails,
  rebaseWorkingTaskContent,
  saveWorkingTaskContent,
  type SaveWorkingTaskContentInput,
} from '../ai/agents/workingTaskContentService.ts';
import { createBrowserQuestionResourceAdmissionRepository } from '../ai/repositories/formalResourceRepositoryRouter.ts';
import { IndexedDBWorkingTaskContentRepository } from '../ai/repositories/indexedDBWorkingTaskContentRepository.ts';

const workingRepository = new IndexedDBWorkingTaskContentRepository();
const questionRepository = createBrowserQuestionResourceAdmissionRepository();

/** @deprecated P6 compatibility only. New production UI must use immutable Candidates. */
export async function saveQuestionTaskWorkingContent(input: SaveWorkingTaskContentInput) {
  return saveWorkingTaskContent(workingRepository, questionRepository, input);
}

export async function getQuestionTaskWorkingContentState(trainingTaskId: string) {
  return getWorkingTaskContentState(workingRepository, questionRepository, trainingTaskId);
}

export async function getQuestionTaskWorkingContentConflictDetails(trainingTaskId: string) {
  return getWorkingTaskContentConflictDetails(
    workingRepository,
    questionRepository,
    trainingTaskId,
  );
}

/** @deprecated P6 compatibility only. Do not reconnect this to the production workbench. */
export async function rebaseQuestionTaskWorkingContent(input: Parameters<typeof rebaseWorkingTaskContent>[2]) {
  return rebaseWorkingTaskContent(workingRepository, questionRepository, input);
}

export async function discardQuestionTaskWorkingContent(trainingTaskId: string): Promise<void> {
  await workingRepository.delete(trainingTaskId);
}
