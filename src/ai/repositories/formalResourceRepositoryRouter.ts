import type { MaterialObservationRepository } from './materialObservationRepository.ts';
import type { QuestionResourceAdmissionRepository } from './questionResourceAdmissionRepository.ts';
import { IndexedDBMaterialObservationRepository } from './indexedDBMaterialObservationRepository.ts';
import { IndexedDBQuestionResourceAdmissionRepository } from './indexedDBQuestionResourceAdmissionRepository.ts';
import { LocalApiFormalResourceClient } from './localApiFormalResourceClient.ts';
import { LocalApiMaterialObservationRepository } from './localApiMaterialObservationRepository.ts';
import { LocalApiQuestionResourceAdmissionRepository } from './localApiQuestionResourceAdmissionRepository.ts';

const sharedFormalResourceClient = new LocalApiFormalResourceClient();

export function createBrowserQuestionResourceAdmissionRepository(): QuestionResourceAdmissionRepository {
  return createRouter(
    new IndexedDBQuestionResourceAdmissionRepository(),
    new LocalApiQuestionResourceAdmissionRepository(sharedFormalResourceClient),
  );
}

export function createBrowserMaterialObservationRepository(): MaterialObservationRepository {
  return createRouter(
    new IndexedDBMaterialObservationRepository(),
    new LocalApiMaterialObservationRepository(sharedFormalResourceClient),
  );
}

function createRouter<T extends object>(legacy: T, shared: T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      return async (...args: unknown[]) => {
        const { status } = await sharedFormalResourceClient.read();
        const repository = status.initialized ? shared : legacy;
        const operation = repository[property as keyof T];
        if (typeof operation !== 'function') {
          throw new Error(`Unknown repository operation: ${String(property)}`);
        }
        return (operation as (...values: unknown[]) => unknown).apply(repository, args);
      };
    },
  });
}
