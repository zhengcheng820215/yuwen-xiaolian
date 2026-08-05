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

export async function rebaseQuestionTaskWorkingContent(input: Parameters<typeof rebaseWorkingTaskContent>[2]) {
  return rebaseWorkingTaskContent(workingRepository, questionRepository, input);
}

export async function discardQuestionTaskWorkingContent(trainingTaskId: string): Promise<void> {
  await workingRepository.delete(trainingTaskId);
}
